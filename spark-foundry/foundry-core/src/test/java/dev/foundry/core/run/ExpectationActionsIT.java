package dev.foundry.core.run;

import dev.foundry.core.expect.ExpectationFailure;
import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.Planner;
import dev.foundry.metadata.MetadataRepository;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** What each of the three actions actually does to a run, and to the data. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ExpectationActionsIT {

    private static final String METADATA = """
            kind: schema
            name: t.rows
            fields:
              - name: id
                type: string
              - name: grade
                type: string
            ---
            kind: schema
            name: t.quarantine
            fields:
              - name: pipeline
                type: string
                nullable: false
              - name: step
                type: string
                nullable: false
              - name: expectation
                type: string
                nullable: false
              - name: rule
                type: string
                nullable: false
              - name: detected_at
                type: timestamp
                nullable: false
              - name: row
                type: string
                nullable: false
            ---
            kind: dataset
            name: landing
            schema: t.rows
            format: csv
            location: "${data}/landing"
            options:
              header: "true"
            ---
            kind: dataset
            name: out
            schema: t.rows
            format: parquet
            location: "${data}/out"
            ---
            kind: dataset
            name: rejects
            schema: t.quarantine
            format: parquet
            location: "${data}/rejects"
            writeMode: append
            ---
            kind: pipeline
            name: p
            quarantine: rejects
            sources:
              - alias: rows
                dataset: landing
            steps:
              - id: output
                type: select
                from: rows
                columns: [id, grade]
            expectations:
              - name: grades_are_known
                on: output
                rule: accepted_values
                column: grade
                values: [a, b]
                action: ACTION
            sinks:
              - from: output
                dataset: out
            """;

    private static final String DATA = """
            id,grade
            R-1,a
            R-2,b
            R-3,z
            """;

    private static SparkSession spark;

    @BeforeAll
    void setUp() {
        spark = SparkFixture.session();
    }

    private RunManifest run(Path warehouse, String action) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"), METADATA.replace("ACTION", action),
                StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "data.csv", DATA);

        MetadataRepository repository = MetadataRepository.load(metadata);
        PipelinePlan plan = Planner.standard().plan(repository, repository.requirePipeline("p"));
        return new PipelineRunner(spark).run(plan, RunOptions.of(warehouse));
    }

    @Test
    @DisplayName("warn records the breach and changes nothing")
    void warnLetsEverythingThrough(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "warn");

        assertTrue(manifest.succeeded());
        assertFalse(manifest.expectations().get(0).satisfied());
        assertEquals(1, manifest.expectations().get(0).offendingRows());
        assertEquals(0, manifest.expectations().get(0).quarantinedRows());
        assertEquals("WARN", manifest.expectations().get(0).verdict());
        assertEquals(3, manifest.sinks().get(0).rows(), "all three rows were written");
    }

    @Test
    @DisplayName("fail stops the run before anything is written")
    void failWritesNothing(@TempDir Path warehouse) {
        ExpectationFailure e = assertThrows(ExpectationFailure.class, () -> run(warehouse, "fail"));

        assertEquals(1, e.failures().size());
        assertEquals("grades_are_known", e.failures().get(0).name());
        assertTrue(e.getMessage().contains("1 of 3 rows failed"));
        assertFalse(SparkFixture.hasParquet(warehouse.resolve("out")),
                "a failing rule must not leave a half-loaded table behind");
    }

    @Test
    @DisplayName("a failed run still writes its manifest, so the evidence survives")
    void failStillWritesAManifest(@TempDir Path warehouse) {
        assertThrows(ExpectationFailure.class, () -> run(warehouse, "fail"));

        Path runs = warehouse.resolve("_foundry/runs");
        assertTrue(Files.isDirectory(runs));
        List<Path> manifests = list(runs);
        assertEquals(1, manifests.size());
        String json = read(manifests.get(0));
        assertTrue(json.contains("\"status\": \"failed\""), json);
        assertTrue(json.contains("grades_are_known"), json);
    }

    @Test
    @DisplayName("quarantine diverts the offending rows and lets the rest load")
    void quarantineDivertsAndContinues(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "quarantine");

        assertTrue(manifest.succeeded());
        assertEquals(1, manifest.expectations().get(0).quarantinedRows());
        assertEquals("diverted", manifest.expectations().get(0).verdict());
        assertEquals(2, manifest.sinks().get(0).rows(), "the two good rows still loaded");
        assertEquals(1, manifest.quarantinedRows());

        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertEquals(List.of("R-1", "R-2"),
                written.select("id").collectAsList().stream().map(r -> r.getString(0)).sorted().toList());

        Dataset<Row> rejected = spark.read().parquet(warehouse.resolve("rejects").toString());
        assertEquals(1, rejected.count());
        Row reject = rejected.collectAsList().get(0);
        assertEquals("p", reject.getAs("pipeline"));
        assertEquals("output", reject.getAs("step"));
        assertEquals("grades_are_known", reject.getAs("expectation"));
        assertEquals("accepted_values", reject.getAs("rule"));
        assertTrue(reject.getAs("row").toString().contains("R-3"),
                "the rejected row is kept whole, as JSON");
    }

    @Test
    @DisplayName("a quarantine dataset whose schema is wrong is rejected before the run")
    void rejectsAWrongQuarantineSchema(@TempDir Path warehouse) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"),
                METADATA.replace("ACTION", "quarantine")
                        .replace("""
                                  - name: row
                                    type: string
                                    nullable: false
                                """, """
                                  - name: payload
                                    type: string
                                    nullable: false
                                """),
                StandardCharsets.UTF_8);

        dev.foundry.metadata.Diagnostics diagnostics = new dev.foundry.metadata.Diagnostics();
        MetadataRepository repository = MetadataRepository.load(metadata, diagnostics);
        Planner.standard().plan(repository, repository.requirePipeline("p"), diagnostics);

        assertTrue(diagnostics.hasCode("quarantine-schema"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).hint().contains("row: string"));
    }

    private static List<Path> list(Path directory) {
        try (java.util.stream.Stream<Path> files = Files.list(directory)) {
            return files.toList();
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}
