package dev.foundry.metadata;

import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.Enforcement;
import dev.foundry.metadata.model.ExpectationAction;
import dev.foundry.metadata.model.PipelineSpec;
import dev.foundry.metadata.model.SchemaSpec;
import dev.foundry.metadata.model.WriteMode;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MetadataRepositoryTest {

    private static final String SCHEMA = """
            kind: schema
            name: retail.orders
            description: Orders.
            fields:
              - name: order_id
                type: string
                nullable: false
                tags: [key]
              - name: total
                type: "decimal(12,2)"
            """;

    private static final String DATASET = """
            kind: dataset
            name: orders
            schema: retail.orders
            format: parquet
            location: "${data}/orders"
            """;

    static Path write(Path root, String name, String content) throws IOException {
        Path file = root.resolve(name);
        Files.createDirectories(file.getParent());
        Files.writeString(file, content, StandardCharsets.UTF_8);
        return file;
    }

    @Test
    @DisplayName("a directory of documents is indexed by name")
    void loadsADirectory(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        write(root, "pipelines/p.yaml", """
                kind: pipeline
                name: p
                sources:
                  - alias: o
                    dataset: orders
                steps:
                  - id: keep
                    type: filter
                    from: o
                    condition: "total > 0"
                sinks:
                  - from: keep
                    dataset: orders
                """);

        MetadataRepository repository = MetadataRepository.load(root);
        assertEquals(3, repository.files().size());

        SchemaSpec schema = repository.schema("retail.orders").orElseThrow();
        assertEquals(2, schema.fields().size());
        assertFalse(schema.fields().get(0).nullable());
        assertTrue(schema.fields().get(0).hasTag("key"));
        assertEquals("decimal(12,2)", schema.fields().get(1).type());

        DatasetSpec dataset = repository.dataset("orders").orElseThrow();
        assertEquals(Enforcement.STRICT, dataset.enforcement(), "enforcement defaults to strict");
        assertEquals(WriteMode.OVERWRITE, dataset.writeMode());

        PipelineSpec pipeline = repository.pipeline("p").orElseThrow();
        assertEquals(1, pipeline.steps().size());
        assertEquals("keep", pipeline.steps().get(0).id());
    }

    @Test
    @DisplayName("several documents may share a file")
    void loadsMultipleDocumentsPerFile(@TempDir Path root) throws IOException {
        write(root, "all.yaml", SCHEMA + "---\n" + DATASET);
        MetadataRepository repository = MetadataRepository.load(root);
        assertTrue(repository.schema("retail.orders").isPresent());
        assertTrue(repository.dataset("orders").isPresent());
    }

    @Test
    @DisplayName("JSON documents are read too, and keep their positions")
    void loadsJsonDocuments(@TempDir Path root) throws IOException {
        // YAML 1.2 is a superset of JSON and the parser reads it natively, so a
        // team that generates its metadata, or simply prefers braces, loses
        // nothing - including the line numbers in its diagnostics.
        write(root, "schemas/orders.json", """
                {
                  "kind": "schema",
                  "name": "retail.orders",
                  "description": "Written as JSON.",
                  "fields": [
                    { "name": "order_id", "type": "string", "nullable": false },
                    { "name": "total", "type": "decimal(12,2)" }
                  ]
                }
                """);
        write(root, "datasets/orders.yaml", DATASET);

        MetadataRepository repository = MetadataRepository.load(root);
        SchemaSpec schema = repository.schema("retail.orders").orElseThrow();
        assertEquals(2, schema.fields().size());
        assertEquals("Written as JSON.", schema.description());
        assertFalse(schema.fields().get(0).nullable());
        assertEquals("decimal(12,2)", schema.fields().get(1).type());
        assertEquals("schemas/orders.json", schema.fields().get(1).where().file());
        assertEquals(7, schema.fields().get(1).where().line(),
                "a JSON document's diagnostics point at real lines");
    }

    @Test
    @DisplayName("a mistake in JSON is reported the same way as one in YAML")
    void reportsJsonMistakes(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.json", """
                {
                  "kind": "schema",
                  "name": "retail.orders",
                  "fields": [
                    { "name": "order_id", "type": "string" }
                  ],
                  "feilds": []
                }
                """);

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("unknown-key"), diagnostics.render());
        assertEquals("did you mean 'fields'?", diagnostics.errors().get(0).hint());
        assertEquals(7, diagnostics.errors().get(0).where().line());
    }

    @Test
    @DisplayName("JSON and YAML may sit side by side in one tree")
    void mixesFormats(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.json", """
                {
                  "kind": "dataset",
                  "name": "orders",
                  "schema": "retail.orders",
                  "format": "parquet",
                  "location": "${data}/orders",
                  "enforcement": "additive"
                }
                """);

        MetadataRepository repository = MetadataRepository.load(root);
        assertTrue(repository.schema("retail.orders").isPresent());
        assertEquals(Enforcement.ADDITIVE, repository.dataset("orders").orElseThrow().enforcement());
    }

    @Test
    @DisplayName("a dataset pointing at a schema nobody declared is rejected, with a suggestion")
    void rejectsUnknownSchema(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET.replace("retail.orders", "retail.order"));

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("unknown-schema"));
        assertEquals("did you mean 'retail.orders'?", diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("a pipeline reading a dataset nobody declared is rejected")
    void rejectsUnknownDataset(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        write(root, "pipelines/p.yaml", """
                kind: pipeline
                name: p
                sources:
                  - alias: o
                    dataset: ordres
                steps:
                  - id: keep
                    type: filter
                    from: o
                    condition: "true"
                sinks:
                  - from: keep
                    dataset: orders
                """);

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("unknown-dataset"));
        assertTrue(diagnostics.errors().stream().anyMatch(d -> "did you mean 'orders'?".equals(d.hint())));
    }

    @Test
    @DisplayName("partitioning by a column the schema does not declare is rejected")
    void rejectsUnknownPartitionColumn(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET + "partitionBy: [order_data]\n");

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("unknown-partition-column"));
    }

    @Test
    @DisplayName("two documents claiming the same name are rejected, pointing at both")
    void rejectsDuplicateDefinitions(@TempDir Path root) throws IOException {
        write(root, "schemas/a.yaml", SCHEMA);
        write(root, "schemas/b.yaml", SCHEMA);

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("duplicate-definition"));
        assertTrue(diagnostics.errors().get(0).hint().contains("schemas/a.yaml"));
    }

    @Test
    @DisplayName("a quarantine action without a quarantine dataset is rejected")
    void requiresQuarantineDataset(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        write(root, "pipelines/p.yaml", """
                kind: pipeline
                name: p
                sources:
                  - alias: o
                    dataset: orders
                steps:
                  - id: keep
                    type: filter
                    from: o
                    condition: "true"
                expectations:
                  - on: keep
                    rule: not_null
                    columns: [order_id]
                    action: quarantine
                sinks:
                  - from: keep
                    dataset: orders
                """);

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertTrue(diagnostics.hasCode("missing-quarantine"));
    }

    @Test
    @DisplayName("a pipeline with no sinks is a warning, not an error")
    void warnsAboutPipelinesThatWriteNothing(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        write(root, "pipelines/p.yaml", """
                kind: pipeline
                name: p
                sources:
                  - alias: o
                    dataset: orders
                steps:
                  - id: keep
                    type: filter
                    from: o
                    condition: "true"
                """);

        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root, diagnostics);
        assertFalse(diagnostics.hasErrors());
        assertTrue(diagnostics.hasCode("no-sinks"));
    }

    @Test
    @DisplayName("defaults are applied, and expectations get a name if they are not given one")
    void appliesDefaults(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        write(root, "pipelines/p.yaml", """
                kind: pipeline
                name: p
                sources:
                  - alias: o
                    dataset: orders
                steps:
                  - id: keep
                    type: filter
                    from: o
                    condition: "true"
                expectations:
                  - on: keep
                    rule: not_null
                    columns: [order_id]
                sinks:
                  - from: keep
                    dataset: orders
                """);

        PipelineSpec pipeline = MetadataRepository.load(root).pipeline("p").orElseThrow();
        assertEquals("not_null_on_keep", pipeline.expectations().get(0).name());
        assertEquals(ExpectationAction.FAIL, pipeline.expectations().get(0).action(),
                "an expectation with no action stated stops the run");
    }

    @Test
    @DisplayName("the fingerprint follows the bytes, not the clock")
    void fingerprintsContent(@TempDir Path root, @TempDir Path other) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        String first = MetadataRepository.load(root).fingerprint();

        assertEquals(first, MetadataRepository.load(root).fingerprint(),
                "loading the same files twice gives the same fingerprint");

        write(other, "schemas/orders.yaml", SCHEMA);
        write(other, "datasets/orders.yaml", DATASET);
        assertEquals(first, MetadataRepository.load(other).fingerprint(),
                "the same content in another directory gives the same fingerprint");

        write(root, "schemas/orders.yaml", SCHEMA.replace("Orders.", "Order lines."));
        assertNotEquals(first, MetadataRepository.load(root).fingerprint(),
                "changing a description changes the fingerprint");

        assertTrue(first.startsWith("sha256:"));
    }

    @Test
    @DisplayName("a missing metadata root is reported, not thrown as an IO error")
    void reportsMissingRoot(@TempDir Path root) {
        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository.load(root.resolve("nope"), diagnostics);
        assertTrue(diagnostics.hasCode("missing-metadata-root"));
    }

    @Test
    @DisplayName("looking up something that is not there suggests what is")
    void suggestsOnLookup(@TempDir Path root) throws IOException {
        write(root, "schemas/orders.yaml", SCHEMA);
        write(root, "datasets/orders.yaml", DATASET);
        MetadataRepository repository = MetadataRepository.load(root);

        MetadataException e = assertThrows(MetadataException.class,
                () -> repository.requireDataset("order", SourceRef.UNKNOWN));
        assertEquals("unknown-dataset", e.errors().get(0).code());
        assertEquals("did you mean 'orders'?", e.errors().get(0).hint());
    }
}
