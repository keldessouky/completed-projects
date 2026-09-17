package dev.foundry.core.run;

import dev.foundry.core.io.ContractViolation;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What a declared schema actually buys you at read time.
 *
 * <p>Each of these is a way that plain Spark would have carried on and produced
 * plausible, wrong data.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ContractEnforcementIT {

    private static final String BASE = """
            kind: schema
            name: t.orders
            fields:
              - name: order_id
                type: string
              - name: region
                type: string
              - name: amount
                type: string
            ---
            kind: dataset
            name: landing
            schema: t.orders
            format: csv
            location: "${data}/landing"
            enforcement: %s
            options:
              header: "true"
            ---
            kind: schema
            name: t.out
            fields:
              - name: order_id
                type: string
              - name: amount
                type: "decimal(10,2)"
            ---
            kind: dataset
            name: out
            schema: t.out
            format: parquet
            location: "${data}/out"
            ---
            kind: pipeline
            name: p
            sources:
              - alias: orders
                dataset: landing
            steps:
              - id: output
                type: select
                from: orders
                columns:
                  - order_id
                  - { name: amount, expr: "amount", type: "decimal(10,2)" }
            sinks:
              - from: output
                dataset: out
            """;

    private static SparkSession spark;

    @BeforeAll
    void setUp() {
        spark = SparkFixture.session();
    }

    private RunManifest run(Path warehouse, String enforcement, String csv) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"), BASE.formatted(enforcement), StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "data.csv", csv);

        MetadataRepository repository = MetadataRepository.load(metadata);
        PipelinePlan plan = Planner.standard().plan(repository, repository.requirePipeline("p"));
        return new PipelineRunner(spark).run(plan, RunOptions.of(warehouse));
    }

    @Test
    @DisplayName("data that matches its contract is read and written without complaint")
    void acceptsConformingData(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "strict", """
                order_id,region,amount
                O-1,emea,10.00
                O-2,apac,20.50
                """);
        assertTrue(manifest.succeeded(), manifest.failure());
        assertEquals(2, manifest.sinks().get(0).rows());

        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertEquals(List.of("order_id", "amount"), List.of(written.columns()));
        assertEquals("decimal(10,2)", written.schema().apply("amount").dataType().simpleString());
    }

    @Test
    @DisplayName("a column the contract requires but the file does not have stops the run")
    void rejectsMissingColumns(@TempDir Path warehouse) {
        ContractViolation e = assertThrows(ContractViolation.class, () -> run(warehouse, "strict", """
                order_id,amount
                O-1,10.00
                """));
        assertEquals("landing", e.dataset());
        assertTrue(e.problems().get(0).contains("column 'region' is declared but the data does not have it"),
                e.getMessage());
        assertTrue(e.getMessage().contains("m.yaml"), "the message points at the declaration");
    }

    @Test
    @DisplayName("a strict dataset rejects a column nobody declared")
    void rejectsUndeclaredColumnsWhenStrict(@TempDir Path warehouse) {
        ContractViolation e = assertThrows(ContractViolation.class, () -> run(warehouse, "strict", """
                order_id,region,amount,gift_wrap
                O-1,emea,10.00,true
                """));
        assertTrue(e.problems().get(0).contains("'gift_wrap' is present but not declared"),
                e.getMessage());
    }

    @Test
    @DisplayName("an additive dataset lets an unexpected column through and ignores it")
    void allowsExtraColumnsWhenAdditive(@TempDir Path warehouse) throws IOException {
        RunManifest manifest = run(warehouse, "additive", """
                order_id,region,amount,gift_wrap
                O-1,emea,10.00,true
                """);
        assertTrue(manifest.succeeded(), manifest.failure());
        assertEquals(1, manifest.sinks().get(0).rows());
    }

    @Test
    @DisplayName("a renamed column upstream is reported as a rename, not as two unrelated problems")
    void suggestsForMisspelledColumns(@TempDir Path warehouse) {
        ContractViolation e = assertThrows(ContractViolation.class, () -> run(warehouse, "strict", """
                order_id,regoin,amount
                O-1,emea,10.00
                """));
        assertTrue(e.problems().stream()
                        .anyMatch(p -> p.contains("the data has 'regoin' - has it been renamed?")),
                e.getMessage());
    }

    @Test
    @DisplayName("a reordered CSV is read by header, not by position")
    void readsCsvByHeaderNotPosition(@TempDir Path warehouse) throws IOException {
        // Both columns are strings, so reading positionally would succeed and put
        // the region in the order id. This is the failure the reader exists to stop.
        RunManifest manifest = run(warehouse, "strict", """
                region,order_id,amount
                emea,O-1,10.00
                """);
        assertTrue(manifest.succeeded(), manifest.failure());

        Dataset<Row> written = spark.read().parquet(warehouse.resolve("out").toString());
        assertEquals("O-1", written.collectAsList().get(0).getString(0),
                "the order id came from the order_id column, wherever it sat in the file");
    }

    @Test
    @DisplayName("a value that will not parse is a breach, not a silent null")
    void refusesToNullUnparseableValues(@TempDir Path warehouse) {
        // Under Spark's default PERMISSIVE mode this row would load with a null
        // amount and the run would report success.
        assertThrows(Exception.class, () -> run(warehouse, "strict", """
                order_id,region,amount
                O-1,emea,not a number
                """));
    }
}
