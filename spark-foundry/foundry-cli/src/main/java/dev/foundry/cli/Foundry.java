package dev.foundry.cli;

import dev.foundry.core.docs.CatalogGenerator;
import dev.foundry.core.expect.ExpectationFailure;
import dev.foundry.core.io.ContractViolation;
import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.Planner;
import dev.foundry.core.run.PipelineRunner;
import dev.foundry.core.run.PlanViolation;
import dev.foundry.core.run.RunManifest;
import dev.foundry.core.run.RunOptions;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.MetadataRepository;
import dev.foundry.metadata.model.PipelineSpec;

import org.apache.spark.sql.SparkSession;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * The {@code foundry} command.
 *
 * <p>Three of the four commands - {@code validate}, {@code plan} and
 * {@code docs} - never start Spark. They are meant to run in a pre-commit hook
 * and in code review, in the second or so it takes to parse a directory of YAML,
 * which is the whole point of putting this much into the metadata.
 */
public final class Foundry {

    private static final String USAGE = """
            foundry - build Spark ETL pipelines from metadata

            Usage:
              foundry validate --metadata <dir>
              foundry plan     --metadata <dir> [--pipeline <name>]
              foundry run      --metadata <dir> --pipeline <name> --data <dir> [options]
              foundry docs     --metadata <dir> [--out <file>]

            Options:
              --metadata <dir>     directory of schema, dataset and pipeline YAML
              --pipeline <name>    which pipeline to act on (default: all, where that makes sense)
              --data <dir>         the warehouse root, substituted for ${data} in locations
              --param name=value   a pipeline parameter; repeat for more than one
              --manifests <dir>    where to write run manifests (default: <data>/_foundry/runs)
              --no-row-counts      skip per-step row counts, for a faster run with a thinner manifest
              --master <url>       Spark master (default: local[*])
              --out <file>         where 'docs' writes its catalogue (default: stdout)
              --quiet              suppress Spark's own logging

            validate, plan and docs never start Spark.
            """;

    private final PrintStream out;
    private final PrintStream err;

    public Foundry(PrintStream out, PrintStream err) {
        this.out = out;
        this.err = err;
    }

    public static void main(String[] argv) {
        System.exit(new Foundry(System.out, System.err).run(argv));
    }

    /** @return the process exit code */
    public int run(String[] argv) {
        if (argv.length == 0 || argv[0].equals("--help") || argv[0].equals("-h") || argv[0].equals("help")) {
            out.print(USAGE);
            return argv.length == 0 ? 2 : 0;
        }
        String command = argv[0];
        Args args = Args.parse(argv, 1);
        try {
            return switch (command) {
                case "validate" -> validate(args);
                case "plan" -> plan(args);
                case "run" -> execute(args);
                case "docs" -> docs(args);
                default -> {
                    err.println("unknown command '" + command + "'");
                    String hint = dev.foundry.metadata.Suggest.hint(command,
                            Set.of("validate", "plan", "run", "docs"));
                    if (hint != null) {
                        err.println("  " + hint);
                    }
                    yield 2;
                }
            };
        } catch (UsageError e) {
            err.println("foundry: " + e.getMessage());
            err.println();
            err.print(USAGE);
            return 2;
        } catch (MetadataException e) {
            err.println(e.getMessage());
            return 1;
        } catch (PlanViolation | ContractViolation | ExpectationFailure e) {
            err.println(e.getMessage());
            return 1;
        } catch (RuntimeException e) {
            err.println("foundry: " + e);
            return 1;
        }
    }

    // --------------------------------------------------------------- validate

    private int validate(Args args) {
        args.rejectUnknown(Set.of("metadata", "pipeline"));
        Path root = args.requirePath("metadata", "the directory holding your YAML");

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository repository = MetadataRepository.load(root, diagnostics);
        Planner planner = Planner.standard();
        for (PipelineSpec pipeline : selected(repository, args)) {
            planner.plan(repository, pipeline, diagnostics);
        }

        if (!diagnostics.isEmpty()) {
            err.print(diagnostics.render());
        }
        int errors = diagnostics.errors().size();
        int warnings = diagnostics.warnings().size();
        if (errors > 0) {
            err.println(summary(repository, errors, warnings));
            return 1;
        }
        out.println(summary(repository, 0, warnings));
        return 0;
    }

    private String summary(MetadataRepository repository, int errors, int warnings) {
        StringBuilder sb = new StringBuilder();
        sb.append(repository.files().size()).append(" file(s): ")
          .append(repository.schemas().size()).append(" schema(s), ")
          .append(repository.datasets().size()).append(" dataset(s), ")
          .append(repository.pipelines().size()).append(" pipeline(s)");
        if (errors == 0 && warnings == 0) {
            return sb.append(" - all valid").toString();
        }
        return sb.append(" - ").append(errors).append(" error(s), ")
                 .append(warnings).append(" warning(s)").toString();
    }

    // ------------------------------------------------------------------- plan

    private int plan(Args args) {
        args.rejectUnknown(Set.of("metadata", "pipeline"));
        Path root = args.requirePath("metadata", "the directory holding your YAML");
        MetadataRepository repository = MetadataRepository.load(root);
        Planner planner = Planner.standard();

        Diagnostics diagnostics = new Diagnostics();
        for (PipelineSpec pipeline : selected(repository, args)) {
            PipelinePlan plan = planner.plan(repository, pipeline, diagnostics);
            if (!diagnostics.hasErrors()) {
                out.println(plan.render());
            }
        }
        if (!diagnostics.isEmpty()) {
            err.print(diagnostics.render());
        }
        return diagnostics.hasErrors() ? 1 : 0;
    }

    // -------------------------------------------------------------------- run

    private int execute(Args args) {
        args.rejectUnknown(Set.of("metadata", "pipeline", "data", "param", "manifests",
                "no-row-counts", "master", "quiet"));
        Path root = args.requirePath("metadata", "the directory holding your YAML");
        Path data = args.requirePath("data", "the warehouse root");
        String name = args.require("pipeline", "which pipeline to run");

        MetadataRepository repository = MetadataRepository.load(root);
        PipelineSpec spec = repository.requirePipeline(name);
        PipelinePlan plan = Planner.standard().plan(repository, spec);

        RunOptions options = RunOptions.of(data)
                .withParams(args.params("param"))
                .withRowCounts(!args.flag("no-row-counts"))
                .withManifestDir(args.path("manifests", data.resolve("_foundry").resolve("runs")));

        if (args.flag("quiet")) {
            org.apache.log4j.Logger.getRootLogger().setLevel(org.apache.log4j.Level.WARN);
        }
        SparkSession spark = session(args, "foundry:" + name);
        try {
            out.println("running " + name + " against " + data);
            RunManifest manifest = new PipelineRunner(spark).run(plan, options);
            out.print(manifest.summary());
            out.println("  manifest: " + options.manifestDir().resolve(manifest.fileName()));
            return 0;
        } finally {
            spark.stop();
        }
    }

    private SparkSession session(Args args, String appName) {
        return SparkSession.builder()
                .appName(appName)
                .master(args.get("master").orElse("local[*]"))
                .config("spark.ui.enabled", "false")
                .config("spark.sql.shuffle.partitions", "8")
                // Predictable output: one file per partition rather than a
                // directory whose shape depends on the cluster it ran on.
                .config("spark.sql.sources.partitionOverwriteMode", "dynamic")
                .getOrCreate();
    }

    // ------------------------------------------------------------------- docs

    private int docs(Args args) {
        args.rejectUnknown(Set.of("metadata", "out"));
        Path root = args.requirePath("metadata", "the directory holding your YAML");
        MetadataRepository repository = MetadataRepository.load(root);
        Planner planner = Planner.standard();

        List<PipelinePlan> plans = new ArrayList<>();
        for (PipelineSpec pipeline : repository.pipelines()) {
            plans.add(planner.plan(repository, pipeline));
        }
        String catalogue = new CatalogGenerator(repository, plans,
                planner.transforms(), planner.rules()).generate();

        if (args.get("out").isEmpty()) {
            out.print(catalogue);
            return 0;
        }
        Path file = args.requirePath("out", "where to write the catalogue");
        try {
            if (file.getParent() != null) {
                Files.createDirectories(file.getParent());
            }
            Files.writeString(file, catalogue, StandardCharsets.UTF_8);
        } catch (java.io.IOException e) {
            throw new UncheckedWrite(file, e);
        }
        out.println("wrote " + file);
        return 0;
    }

    private static final class UncheckedWrite extends RuntimeException {
        private static final long serialVersionUID = 1L;

        UncheckedWrite(Path file, java.io.IOException cause) {
            super("cannot write " + file + ": " + cause.getMessage(), cause);
        }
    }

    // ---------------------------------------------------------------- helpers

    private List<PipelineSpec> selected(MetadataRepository repository, Args args) {
        return args.get("pipeline")
                .map(name -> List.of(repository.requirePipeline(name)))
                .orElseGet(() -> new ArrayList<>(repository.pipelines()));
    }
}
