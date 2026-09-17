package dev.foundry.core.run;

import dev.foundry.core.expect.ExpectationRegistry;
import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.Planner;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.TransformRegistry;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.MetadataRepository;
import dev.foundry.metadata.model.StepSpec;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.functions;
import org.apache.spark.sql.types.DataTypes;
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
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Proves the check that everything else depends on.
 *
 * <p>Each test registers a transform whose {@code plan} deliberately disagrees
 * with its {@code execute} - the exact bug that would quietly invalidate every
 * static guarantee this framework makes - and asserts that the runner catches it,
 * names the step, and stops before writing anything.
 *
 * <p>Without this, the plan-verification code would itself be untested: the
 * shipped transforms all agree with their plans, so nothing would ever exercise
 * the failure path.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PlanViolationIT {

    private static final String METADATA = """
            kind: schema
            name: t.rows
            fields:
              - name: id
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
            schema: t.rows
            format: parquet
            location: "${data}/out"
            # The sink is left unenforced on purpose. With a contract in place the
            # planner would catch most of these lies first - which it should, and
            # which plannerCatchesItFirst below asserts - but then the runtime
            # check would never be exercised.
            enforcement: none
            ---
            kind: pipeline
            name: p
            sources:
              - alias: rows
                dataset: landing
            steps:
              - id: output
                type: liar
                from: rows
            sinks:
              - from: output
                dataset: out
            """;

    private static SparkSession spark;

    @BeforeAll
    void setUp() {
        spark = SparkFixture.session();
    }

    /** A transform that promises one thing and does another. */
    private abstract static class Liar implements Transform {
        @Override
        public String type() {
            return "liar";
        }

        @Override
        public String summary() {
            return "A transform for testing, whose plan does not match what it does.";
        }

        @Override
        public Set<String> configKeys() {
            return Set.of("from");
        }

        @Override
        public List<InputRef> inputs(StepSpec step) {
            return Transforms.singleInput(step, "from");
        }
    }

    private PlanViolation runWith(Path warehouse, Transform liar) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"), METADATA, StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "d.csv", "id\nR-1\nR-2\n");

        MetadataRepository repository = MetadataRepository.load(metadata);
        Planner planner = new Planner(TransformRegistry.builtIn().register(liar),
                ExpectationRegistry.builtIn());
        PipelinePlan plan = planner.plan(repository, repository.requirePipeline("p"));

        PlanViolation violation = assertThrows(PlanViolation.class,
                () -> new PipelineRunner(spark).run(plan, RunOptions.of(warehouse)));
        assertFalse(SparkFixture.hasParquet(warehouse.resolve("out")),
                "nothing may be written once a step has broken its plan");
        return violation;
    }

    @Test
    @DisplayName("a transform that produces a column it did not plan is caught")
    void catchesAnUnplannedColumn(@TempDir Path warehouse) throws IOException {
        PlanViolation violation = runWith(warehouse, new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(
                        PlanField.known("id", DataTypes.StringType, true, "test")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from"))
                        .withColumn("surprise", functions.lit(1));
            }
        });

        assertEquals("output", violation.step());
        assertTrue(violation.problems().get(0).contains("'surprise'"), violation.getMessage());
        assertTrue(violation.problems().get(0).contains("the plan did not predict"));
        assertTrue(violation.getMessage().contains("plan() and execute() disagree"));
    }

    @Test
    @DisplayName("a transform that loses a column it planned is caught")
    void catchesAMissingColumn(@TempDir Path warehouse) throws IOException {
        PlanViolation violation = runWith(warehouse, new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(
                        PlanField.known("id", DataTypes.StringType, true, "test"),
                        PlanField.known("promised", DataTypes.StringType, true, "test")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from"));
            }
        });
        assertTrue(violation.problems().get(0).contains("planned column 'promised' is missing"),
                violation.getMessage());
    }

    @Test
    @DisplayName("a transform that produces the wrong type is caught")
    void catchesAWrongType(@TempDir Path warehouse) throws IOException {
        PlanViolation violation = runWith(warehouse, new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(
                        PlanField.known("id", DataTypes.LongType, true, "test")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from"));
            }
        });
        assertTrue(violation.problems().get(0).contains("planned as bigint"), violation.getMessage());
        assertTrue(violation.problems().get(0).contains("came out as string"), violation.getMessage());
    }

    @Test
    @DisplayName("a transform that reorders its columns is caught")
    void catchesAReorder(@TempDir Path warehouse) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"),
                METADATA.replace("""
                          - name: id
                            type: string
                        """, """
                          - name: id
                            type: string
                          - name: label
                            type: string
                        """), StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "d.csv", "id,label\nR-1,a\n");

        MetadataRepository repository = MetadataRepository.load(metadata);
        Planner planner = new Planner(TransformRegistry.builtIn().register(new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(
                        PlanField.known("id", DataTypes.StringType, true, "test"),
                        PlanField.known("label", DataTypes.StringType, true, "test")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from")).select("label", "id");
            }
        }), ExpectationRegistry.builtIn());
        PipelinePlan plan = planner.plan(repository, repository.requirePipeline("p"));

        PlanViolation violation = assertThrows(PlanViolation.class,
                () -> new PipelineRunner(spark).run(plan, RunOptions.of(warehouse)));
        assertTrue(violation.problems().get(0).contains("column order differs"),
                violation.getMessage());
    }

    @Test
    @DisplayName("where a contract makes the lie visible, the planner catches it without Spark")
    void plannerCatchesItFirst(@TempDir Path warehouse) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"),
                METADATA.replace("enforcement: none", "enforcement: strict"),
                StandardCharsets.UTF_8);

        MetadataRepository repository = MetadataRepository.load(metadata);
        Planner planner = new Planner(TransformRegistry.builtIn().register(new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(
                        PlanField.known("id", DataTypes.StringType, true, "test"),
                        PlanField.known("promised", DataTypes.StringType, true, "test")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from"));
            }
        }), ExpectationRegistry.builtIn());

        dev.foundry.metadata.Diagnostics diagnostics = new dev.foundry.metadata.Diagnostics();
        planner.plan(repository, repository.requirePipeline("p"), diagnostics);
        assertTrue(diagnostics.hasCode("contract-extra-column"), diagnostics.render());
    }

    @Test
    @DisplayName("a column the planner left untyped is not held to a type it never claimed")
    void allowsAnInferredType(@TempDir Path warehouse) throws IOException {
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("m.yaml"), METADATA, StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing"), "d.csv", "id\nR-1\n");

        MetadataRepository repository = MetadataRepository.load(metadata);
        Planner planner = new Planner(TransformRegistry.builtIn().register(new Liar() {
            @Override
            public FieldSet plan(PlanContext context) {
                return FieldSet.of(List.of(PlanField.inferred("id", "who knows")));
            }

            @Override
            public Dataset<Row> execute(ExecContext context) {
                return context.input(context.config().str("from"));
            }
        }), ExpectationRegistry.builtIn());

        RunManifest manifest = new PipelineRunner(spark)
                .run(planner.plan(repository, repository.requirePipeline("p")),
                        RunOptions.of(warehouse));
        assertTrue(manifest.succeeded(), manifest.failure());
        assertTrue(manifest.steps().stream().anyMatch(s -> s.id().equals("output")
                        && s.plannedSchema().contains("id inferred")),
                "the manifest records that the type was settled at run time, not planned");
    }
}
