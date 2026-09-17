package dev.foundry.metadata;

import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.PipelineSpec;
import dev.foundry.metadata.model.SchemaSpec;
import dev.foundry.metadata.model.SinkSpec;
import dev.foundry.metadata.model.SourceBinding;
import dev.foundry.metadata.yaml.YamlNode;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Every schema, dataset and pipeline found under a metadata root.
 *
 * <p>The repository is the closest thing this framework has to a compiler's
 * symbol table. Loading it does three things: parse each document, index it by
 * name, and check that every name one document uses is a name another document
 * defines. None of that needs Spark, a cluster or a single row of data, which
 * is what lets {@code foundry validate} run in a pre-commit hook.
 *
 * <p>A repository also carries a {@link #fingerprint()} over the bytes it was
 * built from. Every run records it, so a warehouse table can always be traced
 * back to the exact metadata revision that produced it.
 */
public final class MetadataRepository {

    private final Path root;
    private final Map<String, SchemaSpec> schemas;
    private final Map<String, DatasetSpec> datasets;
    private final Map<String, PipelineSpec> pipelines;
    private final List<String> files;
    private final String fingerprint;

    private MetadataRepository(Path root,
                               Map<String, SchemaSpec> schemas,
                               Map<String, DatasetSpec> datasets,
                               Map<String, PipelineSpec> pipelines,
                               List<String> files,
                               String fingerprint) {
        this.root = root;
        this.schemas = Map.copyOf(schemas);
        this.datasets = Map.copyOf(datasets);
        this.pipelines = Map.copyOf(pipelines);
        this.files = List.copyOf(files);
        this.fingerprint = fingerprint;
    }

    // ---------------------------------------------------------------- loading

    /** Loads a metadata root, throwing a report of everything wrong with it. */
    public static MetadataRepository load(Path root) {
        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository repository = load(root, diagnostics);
        diagnostics.throwIfErrors("metadata in " + root + " is not valid");
        return repository;
    }

    /**
     * Loads a metadata root, reporting into {@code diagnostics} instead of
     * throwing. The returned repository contains everything that did parse, so
     * callers can keep analysing after a partial failure.
     */
    public static MetadataRepository load(Path root, Diagnostics diagnostics) {
        if (!Files.isDirectory(root)) {
            diagnostics.error("missing-metadata-root", new SourceRef(root.toString(), 0, 0),
                    "metadata root does not exist or is not a directory");
            return new MetadataRepository(root, Map.of(), Map.of(), Map.of(), List.of(), fingerprintOf(List.of()));
        }

        MetadataLoader loader = new MetadataLoader(diagnostics);
        Map<String, SchemaSpec> schemas = new LinkedHashMap<>();
        Map<String, DatasetSpec> datasets = new LinkedHashMap<>();
        Map<String, PipelineSpec> pipelines = new LinkedHashMap<>();
        List<String> files = new ArrayList<>();
        List<byte[]> contents = new ArrayList<>();

        for (Path path : metadataFiles(root)) {
            String display = root.relativize(path).toString().replace('\\', '/');
            files.add(display);
            try {
                contents.add(Files.readAllBytes(path));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            List<YamlNode> documents;
            try {
                documents = YamlNode.loadAllFile(path, display);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            for (YamlNode document : documents) {
                try {
                    String kind = loader.kindOf(document);
                    if (kind == null) {
                        continue;
                    }
                    switch (kind) {
                        case "schema" -> put(schemas, loader.schema(document), SchemaSpec::name,
                                SchemaSpec::where, "schema", diagnostics);
                        case "dataset" -> put(datasets, loader.dataset(document), DatasetSpec::name,
                                DatasetSpec::where, "dataset", diagnostics);
                        case "pipeline" -> put(pipelines, loader.pipeline(document), PipelineSpec::name,
                                PipelineSpec::where, "pipeline", diagnostics);
                        default -> throw new IllegalStateException("unhandled kind " + kind);
                    }
                } catch (MetadataException e) {
                    diagnostics.addAll(e.diagnostics().all());
                }
            }
        }

        MetadataRepository repository = new MetadataRepository(root, schemas, datasets, pipelines,
                files, fingerprintOf(files, contents));
        repository.checkReferences(diagnostics);
        return repository;
    }

    private static <T> void put(Map<String, T> index, T value,
                                java.util.function.Function<T, String> name,
                                java.util.function.Function<T, SourceRef> position,
                                String kind, Diagnostics diagnostics) {
        String key = name.apply(value);
        T existing = index.putIfAbsent(key, value);
        if (existing != null) {
            diagnostics.error("duplicate-definition", position.apply(value),
                    kind + " '" + key + "' is defined twice",
                    "already defined at " + position.apply(existing).describe());
        }
    }

    private static List<Path> metadataFiles(Path root) {
        try (Stream<Path> walk = Files.walk(root)) {
            return walk.filter(Files::isRegularFile)
                    .filter(p -> {
                        String n = p.getFileName().toString();
                        return n.endsWith(".yaml") || n.endsWith(".yml");
                    })
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ------------------------------------------------------- reference checks

    /**
     * Cross-document checks that need no engine: every name used is a name
     * defined, and every partition column exists in the schema it partitions.
     *
     * <p>Checks that depend on what a transform does with its configuration are
     * not here - those belong to the planner, which knows the transforms.
     */
    private void checkReferences(Diagnostics diagnostics) {
        for (DatasetSpec dataset : datasets.values()) {
            SchemaSpec schema = schemas.get(dataset.schema());
            if (schema == null) {
                diagnostics.error("unknown-schema", dataset.where(),
                        "dataset '" + dataset.name() + "' refers to unknown schema '" + dataset.schema() + "'",
                        Suggest.hint(dataset.schema(), schemas.keySet()));
                continue;
            }
            for (String column : dataset.partitionBy()) {
                if (schema.field(column).isEmpty()) {
                    diagnostics.error("unknown-partition-column", dataset.where(),
                            "dataset '" + dataset.name() + "' partitions by '" + column
                                    + "', which schema '" + schema.name() + "' does not declare",
                            Suggest.hint(column, schema.fieldNames()));
                }
            }
        }

        for (PipelineSpec pipeline : pipelines.values()) {
            for (SourceBinding source : pipeline.sources()) {
                if (!datasets.containsKey(source.dataset())) {
                    diagnostics.error("unknown-dataset", source.where(),
                            "pipeline '" + pipeline.name() + "' reads unknown dataset '" + source.dataset() + "'",
                            Suggest.hint(source.dataset(), datasets.keySet()));
                }
            }
            for (SinkSpec sink : pipeline.sinks()) {
                if (!datasets.containsKey(sink.dataset())) {
                    diagnostics.error("unknown-dataset", sink.where(),
                            "pipeline '" + pipeline.name() + "' writes unknown dataset '" + sink.dataset() + "'",
                            Suggest.hint(sink.dataset(), datasets.keySet()));
                }
            }
            String quarantine = pipeline.quarantine();
            if (quarantine != null && !datasets.containsKey(quarantine)) {
                diagnostics.error("unknown-dataset", pipeline.where(),
                        "pipeline '" + pipeline.name() + "' quarantines into unknown dataset '" + quarantine + "'",
                        Suggest.hint(quarantine, datasets.keySet()));
            }
            if (quarantine == null && pipeline.usesQuarantine()) {
                diagnostics.error("missing-quarantine", pipeline.where(),
                        "pipeline '" + pipeline.name() + "' has a quarantine expectation but declares no"
                                + " quarantine dataset",
                        "add 'quarantine: <dataset>' to the pipeline, or change the action to warn or fail");
            }
        }
    }

    // ---------------------------------------------------------------- lookups

    public Path root() {
        return root;
    }

    public List<String> files() {
        return files;
    }

    public Collection<SchemaSpec> schemas() {
        return Collections.unmodifiableCollection(schemas.values());
    }

    public Collection<DatasetSpec> datasets() {
        return Collections.unmodifiableCollection(datasets.values());
    }

    public Collection<PipelineSpec> pipelines() {
        return Collections.unmodifiableCollection(pipelines.values());
    }

    public Optional<SchemaSpec> schema(String name) {
        return Optional.ofNullable(schemas.get(name));
    }

    public Optional<DatasetSpec> dataset(String name) {
        return Optional.ofNullable(datasets.get(name));
    }

    public Optional<PipelineSpec> pipeline(String name) {
        return Optional.ofNullable(pipelines.get(name));
    }

    public SchemaSpec requireSchema(String name, SourceRef where) {
        return schema(name).orElseThrow(() -> new MetadataException(Diagnostic.error("unknown-schema", where,
                "unknown schema '" + name + "'", Suggest.hint(name, schemas.keySet()))));
    }

    public DatasetSpec requireDataset(String name, SourceRef where) {
        return dataset(name).orElseThrow(() -> new MetadataException(Diagnostic.error("unknown-dataset", where,
                "unknown dataset '" + name + "'", Suggest.hint(name, datasets.keySet()))));
    }

    public PipelineSpec requirePipeline(String name) {
        return pipeline(name).orElseThrow(() -> new MetadataException(Diagnostic.error("unknown-pipeline",
                new SourceRef(root.toString(), 0, 0),
                "unknown pipeline '" + name + "'", Suggest.hint(name, pipelines.keySet()))));
    }

    // ------------------------------------------------------------ fingerprint

    /**
     * A SHA-256 over the metadata's file names and bytes, in path order.
     *
     * <p>Recorded in every run manifest. Two runs with the same fingerprint were
     * driven by byte-identical metadata; two that differ can be diffed in git to
     * see exactly what changed about the pipeline between them.
     */
    public String fingerprint() {
        return fingerprint;
    }

    private static String fingerprintOf(List<String> files) {
        return fingerprintOf(files, List.of());
    }

    private static String fingerprintOf(List<String> files, List<byte[]> contents) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < files.size(); i++) {
                digest.update(files.get(i).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
                if (i < contents.size()) {
                    digest.update(contents.get(i));
                }
                digest.update((byte) 0);
            }
            return "sha256:" + HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the platform", e);
        }
    }
}
