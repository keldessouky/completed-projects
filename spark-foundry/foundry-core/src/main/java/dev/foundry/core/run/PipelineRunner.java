package dev.foundry.core.run;

import dev.foundry.core.expect.ExpectationEngine;
import dev.foundry.core.expect.ExpectationFailure;
import dev.foundry.core.expect.ExpectationRegistry;
import dev.foundry.core.expect.ExpectationResult;
import dev.foundry.core.io.DatasetIo;
import dev.foundry.core.io.Locations;
import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.param.Params;
import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.SinkPlan;
import dev.foundry.core.plan.SourcePlan;
import dev.foundry.core.plan.StepPlan;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.model.DatasetSpec;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.StructType;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Executes a {@link PipelinePlan} on Spark.
 *
 * <p>By the time the runner is involved, everything that could be decided from
 * the metadata has been decided. What it adds is the things only data can
 * settle: the types the planner left open, the row counts, the quality rules,
 * and - on every single step - whether the transform kept the promise its plan
 * made.
 */
public final class PipelineRunner {

    private final SparkSession spark;
    private final ExpectationRegistry rules;

    public PipelineRunner(SparkSession spark, ExpectationRegistry rules) {
        this.spark = spark;
        this.rules = rules;
    }

    public PipelineRunner(SparkSession spark) {
        this(spark, ExpectationRegistry.builtIn());
    }

    /**
     * Runs the pipeline and returns its manifest.
     *
     * <p>A failure is recorded in the manifest and then rethrown, so the evidence
     * survives even when the run does not.
     */
    public RunManifest run(PipelinePlan plan, RunOptions options) {
        RunManifest.Builder manifest = new RunManifest.Builder()
                .pipeline(plan.name())
                .fingerprint(plan.fingerprint())
                .dataRoot(options.dataRoot().toString())
                .sparkVersion(spark.version());

        Diagnostics diagnostics = new Diagnostics();
        Map<String, String> bound = Params.bind(plan.spec().params(), options.params(),
                plan.spec().where(), diagnostics);
        diagnostics.throwIfErrors("pipeline '" + plan.name() + "' cannot run with these parameters");
        manifest.params(bound);

        ParamResolver params = ParamResolver.forRun(plan.spec(), bound);
        ExpectationEngine engine = new ExpectationEngine(rules, plan.name());
        Map<String, Dataset<Row>> results = new LinkedHashMap<>();
        List<Dataset<Row>> quarantined = new ArrayList<>();

        try {
            readSources(plan, options, params, engine, results, quarantined, manifest);
            runSteps(plan, options, params, engine, results, quarantined, manifest);

            // Every rule has now run. A failing rule whose action is 'fail' stops
            // the pipeline here, before anything is written, so a bad load never
            // half-lands.
            List<ExpectationResult> blocking = ExpectationEngine.blocking(manifest.expectationResults());
            if (!blocking.isEmpty()) {
                throw new ExpectationFailure(plan.name(), blocking);
            }

            writeQuarantine(plan, options, params, quarantined, manifest);
            writeSinks(plan, options, params, results, manifest);
            recordLineage(plan, manifest);

            RunManifest built = manifest.build(RunManifest.SUCCEEDED, null);
            persist(built, options);
            return built;
        } catch (RuntimeException e) {
            RunManifest built = manifest.build(RunManifest.FAILED, e.getMessage());
            persist(built, options);
            throw e;
        }
    }

    // ---------------------------------------------------------------- sources

    private void readSources(PipelinePlan plan, RunOptions options, ParamResolver params,
                             ExpectationEngine engine, Map<String, Dataset<Row>> results,
                             List<Dataset<Row>> quarantined, RunManifest.Builder manifest) {
        for (SourcePlan source : plan.sources()) {
            long started = System.nanoTime();
            String location = Locations.resolve(source.dataset(), options.dataRoot(), params);
            Dataset<Row> data = DatasetIo.read(spark, source.dataset(), source.contract(), location);

            // A source is a named result like any other, so expectations may be
            // attached to it - which is where a broken delivery is cheapest to
            // catch, before any work has been done on it.
            ExpectationEngine.Checked checked = engine.check(plan.expectationsOn(source.alias()),
                    data, results, params, spark);
            manifest.expectations(checked.results());
            quarantined.addAll(checked.quarantine());
            results.put(source.alias(), checked.data());

            manifest.step(new StepReport(source.alias(), "source", List.of(source.dataset().name()),
                    source.fields().toStructType().toDDL(), checked.data().schema().toDDL(),
                    rowsOf(checked.data(), options), millisSince(started)));
        }
    }

    // ------------------------------------------------------------------ steps

    private void runSteps(PipelinePlan plan, RunOptions options, ParamResolver params,
                          ExpectationEngine engine, Map<String, Dataset<Row>> results,
                          List<Dataset<Row>> quarantined, RunManifest.Builder manifest) {
        for (StepPlan step : plan.steps()) {
            long started = System.nanoTime();
            Map<String, Dataset<Row>> inputs = new LinkedHashMap<>();
            for (String name : step.inputs()) {
                inputs.put(name, results.get(name));
            }

            ExecContext context = new ExecContext(spark, step.spec(), inputs, step.output(), params);
            Dataset<Row> produced = step.transform().execute(context);

            verify(step, produced.schema());

            ExpectationEngine.Checked checked = engine.check(plan.expectationsOn(step.id()),
                    produced, results, params, spark);
            manifest.expectations(checked.results());
            quarantined.addAll(checked.quarantine());
            results.put(step.id(), checked.data());

            manifest.step(new StepReport(step.id(), step.type(), step.inputs(),
                    describe(step.output()), produced.schema().toDDL(),
                    rowsOf(checked.data(), options), millisSince(started)));
        }
    }

    /**
     * Holds a transform to its plan.
     *
     * <p>Cheap - it compares two schemas - and it is the single check that makes
     * every other static guarantee in this framework trustworthy.
     */
    private void verify(StepPlan step, StructType actual) {
        List<String> problems = step.output().verify(actual);
        if (!problems.isEmpty()) {
            throw new PlanViolation(step.id(), step.type(), problems);
        }
    }

    // ----------------------------------------------------------------- output

    private void writeQuarantine(PipelinePlan plan, RunOptions options, ParamResolver params,
                                 List<Dataset<Row>> quarantined, RunManifest.Builder manifest) {
        if (plan.quarantine().isEmpty()) {
            return;
        }
        DatasetSpec dataset = plan.quarantine().get();
        if (quarantined.isEmpty()) {
            manifest.quarantine(dataset.name(), 0);
            return;
        }
        Dataset<Row> all = quarantined.get(0);
        for (int i = 1; i < quarantined.size(); i++) {
            all = all.unionByName(quarantined.get(i));
        }
        String location = Locations.resolve(dataset, options.dataRoot(), params);
        long rows = DatasetIo.write(all, dataset, dev.foundry.core.expect.Quarantine.SCHEMA,
                location, dataset.writeMode());
        manifest.quarantine(dataset.name(), rows);
    }

    private void writeSinks(PipelinePlan plan, RunOptions options, ParamResolver params,
                            Map<String, Dataset<Row>> results, RunManifest.Builder manifest) {
        for (SinkPlan sink : plan.sinks()) {
            String location = Locations.resolve(sink.dataset(), options.dataRoot(), params);
            long rows = DatasetIo.write(results.get(sink.from()), sink.dataset(), sink.contract(),
                    location, sink.mode());
            manifest.sink(new SinkReport(sink.from(), sink.dataset().name(), sink.dataset().format(),
                    sink.mode().name().toLowerCase(java.util.Locale.ROOT), location, rows));
        }
    }

    /** Records, for each written column, the source columns it came from. */
    private void recordLineage(PipelinePlan plan, RunManifest.Builder manifest) {
        for (SinkPlan sink : plan.sinks()) {
            plan.lineage().sourcesOf(sink.from()).forEach((column, origins) ->
                    manifest.lineage(sink.dataset().name() + "." + column, origins));
        }
    }

    private void persist(RunManifest manifest, RunOptions options) {
        if (options.manifestDir() == null) {
            return;
        }
        try {
            Files.createDirectories(options.manifestDir());
            Path file = options.manifestDir().resolve(manifest.fileName());
            Files.writeString(file, manifest.toJson(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("cannot write the run manifest", e);
        }
    }

    // ---------------------------------------------------------------- helpers

    private static long rowsOf(Dataset<Row> data, RunOptions options) {
        return options.countRows() ? data.count() : -1;
    }

    private static long millisSince(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    /** The planned schema as DDL, with the columns whose type was left open marked. */
    private static String describe(FieldSet planned) {
        List<String> parts = new ArrayList<>();
        planned.fields().forEach(field -> parts.add(field.name() + " " + field.typeName()));
        return String.join(",", parts);
    }
}
