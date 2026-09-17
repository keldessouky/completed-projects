package dev.foundry.core.run;

import dev.foundry.core.expect.ExpectationResult;
import dev.foundry.core.expect.ExpectationRegistry;
import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.Planner;
import dev.foundry.core.plan.StepPlan;
import dev.foundry.core.transform.TransformRegistry;
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
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Every transform and every quality rule, in one pipeline, run for real.
 *
 * <p>The point is the last test in the class: for each of the fourteen steps, the
 * schema the planner predicted without Spark is compared against the schema Spark
 * produced. That is the property the whole framework rests on - static analysis
 * of a pipeline is only worth anything if the analysis and the engine agree - and
 * it is checked here for every transform rather than only for the ones the
 * example happens to use.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AllTransformsIT {

    private static final String EVENTS = """
            id,actor,kind,amount,at,version
            E1,alice,click,10.00,2026-01-01T10:00:00,1
            E1,alice,click,12.00,2026-01-01T10:00:00,2
            E2,bob,view,5.50,2026-01-02T11:00:00,1
            E3,alice,buy,99.99,2026-01-03T09:00:00,1
            E4,carol,click,0.00,2026-01-04T08:00:00,1
            E5,bob,buy,20.00,2026-01-05T07:00:00,1
            """;

    private static final String METADATA = """
            kind: schema
            name: events.landing
            fields:
              - name: id
                type: string
              - name: actor
                type: string
              - name: kind
                type: string
              - name: amount
                type: string
              - name: at
                type: string
              - name: version
                type: string
            ---
            kind: schema
            name: events.report
            fields:
              - name: region
                type: string
              - name: total
                type: "decimal(20,4)"
              - name: events
                type: bigint
            ---
            kind: dataset
            name: landing_events
            schema: events.landing
            format: csv
            location: "${data}/landing/events"
            enforcement: additive
            options:
              header: "true"
            ---
            kind: dataset
            name: report
            schema: events.report
            format: parquet
            location: "${data}/report"
            ---
            kind: pipeline
            name: everything
            description: Uses every transform and every rule the framework ships with.
            sources:
              - alias: events
                dataset: landing_events
            steps:
              - id: typed
                type: select
                from: events
                columns:
                  - id
                  - actor
                  - kind
                  - { name: amount, expr: "amount", type: "decimal(10,2)" }
                  - { name: at, expr: "at", type: timestamp }
                  - { name: version, expr: "version", type: int }

              - id: deduped
                type: deduplicate
                from: typed
                keys: [id]
                orderBy: [version desc]

              - id: positive
                type: filter
                from: deduped
                condition: "amount > 0"

              - id: renamed
                type: rename
                from: positive
                columns:
                  kind: event_kind

              - id: dropped
                type: drop
                from: renamed
                columns: [version]

              - id: derived
                type: derive
                from: dropped
                columns:
                  - { name: is_purchase, expr: "event_kind = 'buy'" }

              - id: recast
                type: cast
                from: derived
                columns:
                  amount: "decimal(14,4)"

              - id: windowed
                type: window
                from: recast
                partitionBy: [actor]
                orderBy: [at]
                frame:
                  type: rows
                  start: unbounded preceding
                  end: current row
                columns:
                  - { name: seq, expr: "row_number()", type: int }
                  - { name: running, expr: "sum(amount)", type: "decimal(20,4)" }

              - id: actors
                type: distinct
                from: deduped
                columns: [actor]

              - id: actor_info
                type: derive
                from: actors
                columns:
                  - name: region
                    expr: "case when actor = 'alice' then 'emea' when actor = 'bob' then 'apac' else 'amer' end"

              - id: joined
                type: join
                left: windowed
                right: actor_info
                on: [actor]
                how: inner

              - id: clicks
                type: filter
                from: joined
                condition: "event_kind = 'click'"

              - id: buys
                type: filter
                from: joined
                condition: "event_kind = 'buy'"

              - id: unioned
                type: union
                inputs: [clicks, buys]

              - id: buyers
                type: distinct
                from: buys
                columns: [actor]

              - id: everyone
                type: join
                left: actors
                right: buyers
                on: [actor]
                how: full

              - id: agg
                type: aggregate
                from: joined
                groupBy: [region]
                measures:
                  - { name: total, expr: "sum(amount)", type: "decimal(20,4)" }
                  - { name: events, expr: "count(1)", type: bigint }

              - id: labelled
                type: java
                class: dev.foundry.core.fixtures.AddLabel
                from: agg
                options:
                  label: "checked"
                outputs:
                  - { name: region, type: string }
                  - { name: total, type: "decimal(20,4)" }
                  - { name: events, type: bigint }
                  - { name: label, type: string }
                lineage:
                  label: [region]

              - id: output
                type: sql
                inputs: [labelled]
                query: "select region, total, events from labelled where events > 0"
                outputs:
                  - { name: region, type: string }
                  - { name: total, type: "decimal(20,4)" }
                  - { name: events, type: bigint }

            expectations:
              - name: identifiers_present
                on: typed
                rule: not_null
                columns: [id, actor]
              - name: one_row_per_event
                on: deduped
                rule: unique
                columns: [id]
              - name: known_kinds
                on: typed
                rule: accepted_values
                column: kind
                values: [click, view, buy]
              - name: amounts_are_positive
                on: positive
                rule: range
                column: amount
                min: "0.01"
              - name: identifiers_look_right
                on: typed
                rule: regex
                column: id
                pattern: "^E[0-9]+$"
              - name: running_total_covers_the_row
                on: windowed
                rule: expression
                expr: "running >= amount"
              - name: everyone_is_accounted_for
                on: everyone
                rule: row_count
                min: 3
              - name: actors_are_known
                on: joined
                rule: referential
                columns: [actor]
                references: actors

            sinks:
              - from: unioned
                dataset: report
                mode: ignore
              - from: output
                dataset: report
            """;

    @TempDir
    static Path warehouse;

    private static SparkSession spark;
    private static PipelinePlan plan;
    private static RunManifest manifest;

    @BeforeAll
    void runIt() throws IOException {
        spark = SparkFixture.session();
        Path metadata = warehouse.resolve("metadata");
        Files.createDirectories(metadata);
        Files.writeString(metadata.resolve("all.yaml"), withoutTheIgnoredSink(), StandardCharsets.UTF_8);
        SparkFixture.csv(warehouse.resolve("landing/events"), "events.csv", EVENTS);

        MetadataRepository repository = MetadataRepository.load(metadata);
        plan = Planner.standard().plan(repository, repository.requirePipeline("everything"));
        manifest = new PipelineRunner(spark).run(plan, RunOptions.of(warehouse));
    }

    /** The union branch exists to exercise the transform; only 'output' is written. */
    private static String withoutTheIgnoredSink() {
        return METADATA.replace("""
                sinks:
                  - from: unioned
                    dataset: report
                    mode: ignore
                  - from: output
                    dataset: report
                """, """
                sinks:
                  - from: output
                    dataset: report
                """);
    }

    @Test
    @DisplayName("a pipeline using every transform runs to completion")
    void runs() {
        assertTrue(manifest.succeeded(), manifest.failure());
    }

    @Test
    @DisplayName("every transform the framework ships with is exercised here")
    void coversEveryTransform() {
        Set<String> used = new java.util.LinkedHashSet<>(
                plan.steps().stream().map(StepPlan::type).toList());
        Set<String> available = TransformRegistry.builtIn().types();
        assertEquals(Set.of(), difference(available, used),
                "these transforms are not covered by this test");
    }

    @Test
    @DisplayName("every quality rule the framework ships with is exercised here")
    void coversEveryRule() {
        Set<String> used = new java.util.LinkedHashSet<>(
                manifest.expectations().stream().map(ExpectationResult::rule).toList());
        Set<String> available = ExpectationRegistry.builtIn().names();
        assertEquals(Set.of(), difference(available, used),
                "these rules are not covered by this test");
    }

    @Test
    @DisplayName("each transform did what its plan said it would")
    void transformsBehaveAsPlanned() {
        Map<String, Long> rows = new LinkedHashMap<>();
        manifest.steps().forEach(step -> rows.put(step.id(), step.rows()));

        assertEquals(6L, rows.get("events"));
        assertEquals(5L, rows.get("deduped"), "the two deliveries of E1 collapse into one");
        assertEquals(4L, rows.get("positive"), "E4 has an amount of zero");
        assertEquals(3L, rows.get("actors"), "alice, bob and carol, before the filter");
        assertEquals(4L, rows.get("joined"));
        assertEquals(3L, rows.get("unioned"), "two clicks... one click and two buys");
        assertEquals(3L, rows.get("everyone"), "a full join keeps carol, who never bought anything");
        assertEquals(2L, rows.get("agg"), "emea and apac");
        assertEquals(2L, rows.get("labelled"), "the custom transform changes columns, not rows");
    }

    @Test
    @DisplayName("a custom Java transform sits in the graph like any other step")
    void customTransformParticipates() {
        StepPlan labelled = plan.steps().stream()
                .filter(step -> step.id().equals("labelled")).findFirst().orElseThrow();
        assertEquals("java", labelled.type());
        assertEquals(List.of("agg"), labelled.inputs());
        assertEquals(List.of("region", "total", "events", "label"), labelled.output().nameList());

        // The declared contract is what lets the sql step downstream be checked
        // at all: without it, nothing could know 'region' would be there.
        assertEquals(java.util.Set.of("events.actor"),
                plan.lineage().sourcesOf("labelled", "label"),
                "the declared lineage was followed back through the graph");
    }

    @Test
    @DisplayName("the deduplicate step keeps the version it was told to")
    void deduplicateKeepsTheChosenRow() {
        Dataset<Row> report = spark.read().parquet(warehouse.resolve("report").toString());
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        for (Row row : report.collectAsList()) {
            totals.put(row.getString(0), row.getDecimal(1));
        }
        // alice: E1 at version 2 (12.00) plus E3 (99.99); bob: 5.50 plus 20.00.
        assertEquals(0, new BigDecimal("111.9900").compareTo(totals.get("emea")),
                "version 2 of E1 was kept, not version 1");
        assertEquals(0, new BigDecimal("25.5000").compareTo(totals.get("apac")));
    }

    @Test
    @DisplayName("every rule was satisfied by data that was built to satisfy it")
    void everyRulePasses() {
        List<String> broken = manifest.expectations().stream()
                .filter(result -> !result.satisfied())
                .map(ExpectationResult::describe)
                .toList();
        assertEquals(List.of(), broken);
    }

    @Test
    @DisplayName("the window's frame produces a running total, not a partition total")
    void windowFrameIsRespected() {
        // Asserted through the expectation above plus the mart: if the frame had
        // been the whole partition, alice's first row would already hold 111.99.
        assertTrue(manifest.expectations().stream()
                .anyMatch(r -> r.rule().equals("expression") && r.satisfied()));
    }

    @Test
    @DisplayName("what the planner predicted is what Spark produced, for every step")
    void thePlanMatchesReality() {
        Map<String, String> planned = new LinkedHashMap<>();
        Map<String, String> actual = new LinkedHashMap<>();
        for (StepReport step : manifest.steps()) {
            planned.put(step.id(), step.plannedSchema());
            actual.put(step.id(), step.actualSchema());
        }

        List<String> problems = new ArrayList<>();
        for (StepPlan step : plan.steps()) {
            org.apache.spark.sql.types.StructType schema =
                    parse(actual.get(step.id()));
            step.output().verify(schema).forEach(problem ->
                    problems.add(step.id() + " (" + step.type() + "): " + problem));
        }
        assertEquals(List.of(), problems,
                "a transform's plan() and execute() disagree");
        assertEquals(plan.steps().size() + plan.sources().size(), manifest.steps().size());
    }

    private static org.apache.spark.sql.types.StructType parse(String ddl) {
        return org.apache.spark.sql.types.StructType.fromDDL(ddl);
    }

    private static Set<String> difference(Set<String> all, Set<String> used) {
        Set<String> missing = new java.util.LinkedHashSet<>(all);
        missing.removeAll(used);
        return missing;
    }
}
