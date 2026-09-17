package dev.foundry.core.run;

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
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Custom transforms running for real.
 *
 * <p>The interesting cases are the ones where the class and the metadata
 * disagree. A custom transform is opaque to static analysis, so the declared
 * contract plus the runner's check of it is the only thing standing between a
 * changed class and silently wrong data downstream - and it needs to be shown
 * working, not asserted in a comment.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CustomTransformIT {

    private static final String METADATA = """
            kind: schema
            name: t.rows
            fields:
              - name: id
                type: string
              - name: amount
                type: "decimal(10,2)"
            ---
            kind: schema
            name: t.labelled
            fields:
              - name: id
                type: string
              - name: amount
                type: "decimal(10,2)"
              - name: label
                type: string
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
            schema: t.labelled
            format: parquet
            location: "${data}/out"
            ---
            kind: pipeline
            name: p
            params:
              - name: label_text
                type: string
                default: "checked"
            sources:
              - alias: rows
                dataset: landing
            steps:
              - id: labelled
                type: java
                class: CLASS
                from: rows
                options:
                  label: "${label_text}"
                schema: t.labelled
                lineage:
                  label: [id]
            sinks:
              - from: labelled
                dataset: out
            """;

    private static final String DATA = """
            id,amount
            R-1,10.00
            R-2,20.50
            """;

    private static SparkSession spark;

    @BeforeAll
    void setUp() {
        spark = SparkFixture.session();
    }

    private PipelinePlan plan(Path warehouse, String metadata) throws IOException {
        Path root = warehouse.resolve("metadata");
        Files.createDirectories(root);
        Files.writeString(root.resolve("m.yaml"), metadata, StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "d.csv", DATA);

        MetadataRepository repository = MetadataRepository.load(root);
        return Planner.standard().plan(repository, repository.requirePipeline("p"));
    }

    private RunManifest run(Path warehouse, String className, Map<String, String> params)
            throws IOException {
        PipelinePlan plan = plan(warehouse,
                METADATA.replace("CLASS", "dev.foundry.core.fixtures." + className));
        return new PipelineRunner(spark).run(plan, RunOptions.of(warehouse).withParams(params));
    }

    @Test
    @DisplayName("a custom transform runs, and its result is written under the declared contract")
    void runsACustomTransform(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "AddLabel", Map.of());

        assertTrue(manifest.succeeded(), manifest.failure());
        assertEquals(2, manifest.sinks().get(0).rows());

        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertEquals(List.of("id", "amount", "label"), List.of(written.columns()));
        assertEquals("decimal(10,2)", written.schema().apply("amount").dataType().simpleString());
        assertEquals(List.of("checked", "checked"),
                written.select("label").collectAsList().stream().map(row -> row.getString(0)).toList());
    }

    @Test
    @DisplayName("an option carrying a parameter reaches the class with the run's value")
    void passesParametersThroughOptions(@TempDir Path warehouse) throws IOException {
        run(warehouse, "AddLabel", Map.of("label_text", "reviewed"));

        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertEquals(Set.of("reviewed"),
                Set.copyOf(written.select("label").collectAsList().stream()
                        .map(row -> row.getString(0)).toList()));
    }

    @Test
    @DisplayName("pipeline parameters reach the class, typed")
    void passesTypedParameters(@TempDir Path warehouse) throws IOException {
        PipelinePlan plan = plan(warehouse, """
                kind: schema
                name: t.rows
                fields:
                  - name: id
                    type: string
                  - name: amount
                    type: "decimal(10,2)"
                ---
                kind: dataset
                name: landing
                schema: t.rows
                format: csv
                location: "${data}/landing"
                options:
                  header: "true"
                ---
                kind: pipeline
                name: p
                params:
                  - name: run_date
                    type: date
                    required: true
                  - name: batch_size
                    type: int
                    default: "500"
                sources:
                  - alias: rows
                    dataset: landing
                steps:
                  - id: stamped
                    type: java
                    class: dev.foundry.core.fixtures.UsesParameters
                    from: rows
                    outputs:
                      - { name: id, type: string }
                      - { name: as_of, type: string }
                      - { name: batch, type: int }
                sinks: []
                expectations:
                  - name: stamped_with_the_run_date
                    on: stamped
                    rule: expression
                    expr: "as_of = '2026-03-05' and batch = 500"
                """);

        RunManifest manifest = new PipelineRunner(spark).run(plan,
                RunOptions.of(warehouse).withParams(Map.of("run_date", "2026-03-05")));
        assertTrue(manifest.succeeded(), manifest.failure());
        assertTrue(manifest.expectations().get(0).satisfied(),
                manifest.expectations().get(0).describe());
    }

    @Test
    @DisplayName("a column the class returns but nobody declared is dropped, not written")
    void projectsAwayUndeclaredColumns(@TempDir Path warehouse) throws IOException {
        // The class adds 'surprise'; the contract does not mention it. A strict
        // sink would otherwise refuse the write, and nothing downstream could
        // have known the column existed.
        RunManifest manifest = run(warehouse, "AddsASurpriseColumn", Map.of());

        assertTrue(manifest.succeeded(), manifest.failure());
        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertFalse(List.of(written.columns()).contains("surprise"),
                "an undeclared column must not reach the warehouse");
        assertEquals(List.of("id", "amount", "label"), List.of(written.columns()));
    }

    @Test
    @DisplayName("a class that drops a declared column fails the run, naming the step")
    void catchesAMissingColumn(@TempDir Path warehouse) throws IOException {
        PlanViolation violation = assertThrows(PlanViolation.class,
                () -> run(warehouse, "LosesAColumn", Map.of()));

        assertEquals("labelled", violation.step());
        assertTrue(violation.problems().get(0).contains("planned column 'label' is missing"),
                violation.getMessage());
        assertFalse(SparkFixture.hasParquet(warehouse.resolve("out")),
                "nothing may be written once the class has broken its contract");
    }

    @Test
    @DisplayName("a class that returns null says so, rather than throwing somewhere deeper")
    void catchesANullResult(@TempDir Path warehouse) {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> run(warehouse, "ReturnsNothing", Map.of()));
        assertTrue(e.getMessage().contains("returned null"), e.getMessage());
        assertTrue(e.getMessage().contains("labelled"), e.getMessage());
    }

    @Test
    @DisplayName("the declared lineage is what the manifest records")
    void recordsDeclaredLineage(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "AddLabel", Map.of());

        assertEquals(Set.of("rows.id"), manifest.lineage().get("out.label"),
                "the metadata said label comes from id, and that is what was recorded");
        assertEquals(Set.of("rows.amount"), manifest.lineage().get("out.amount"),
                "a column nobody declared lineage for is matched by name");
    }

    @Test
    @DisplayName("a custom step is reported in the manifest like any other")
    void appearsInTheManifest(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "AddLabel", Map.of());

        StepReport step = manifest.steps().stream()
                .filter(report -> report.id().equals("labelled")).findFirst().orElseThrow();
        assertEquals("java", step.type());
        assertEquals(List.of("rows"), step.inputs());
        assertEquals(2, step.rows());
        assertTrue(step.actualSchema().contains("label"), step.actualSchema());
        assertTrue(step.plannedSchema().contains("label string"), step.plannedSchema());
    }
}
