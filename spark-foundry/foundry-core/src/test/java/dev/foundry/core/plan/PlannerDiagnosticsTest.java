package dev.foundry.core.plan;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.Diagnostics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * One test per class of mistake a pipeline author can make.
 *
 * <p>Each asserts the diagnostic code, and most assert the hint too, because a
 * message that does not say what to do instead is only half of the feature.
 * None of these start Spark.
 */
class PlannerDiagnosticsTest {

    @Test
    @DisplayName("the reference pipeline plans with no errors at all")
    void theFixturePlansCleanly(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, Fixtures.GOOD_PIPELINE);
        assertFalse(diagnostics.hasErrors(), diagnostics.render());
    }

    @Test
    @DisplayName("a misspelled transform type suggests a real one")
    void unknownTransform(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: slect
                    from: orders
                    columns: [order_id]
                sinks:
                  - from: output
                    dataset: curated_lines
                """));
        assertEquals("unknown-transform", error.code());
        assertEquals("did you mean 'select'?", error.hint());
    }

    @Test
    @DisplayName("a step reading something that does not exist suggests what does")
    void unknownInput(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: select
                    from: order
                    columns: [order_id]
                sinks:
                  - from: output
                    dataset: curated_lines
                """));
        assertEquals("unknown-input", error.code());
        assertEquals("did you mean 'orders'?", error.hint());
    }

    @Test
    @DisplayName("steps that depend on each other in a loop are named in order")
    void cycles(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: a
                    type: filter
                    from: c
                    condition: "true"
                  - id: b
                    type: filter
                    from: a
                    condition: "true"
                  - id: c
                    type: filter
                    from: b
                    condition: "true"
                sinks:
                  - from: c
                    dataset: curated_lines
                """);
        assertTrue(diagnostics.hasCode("cycle"), diagnostics.render());
        Diagnostic cycle = diagnostics.errors().stream()
                .filter(d -> d.code().equals("cycle")).findFirst().orElseThrow();
        assertTrue(cycle.message().contains("->"), cycle.message());
        assertTrue(cycle.message().contains("a") && cycle.message().contains("b")
                && cycle.message().contains("c"), cycle.message());
    }

    @Test
    @DisplayName("a misspelled column in an expression is caught with a suggestion")
    void unknownColumnInExpression(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: select
                    from: orders
                    columns:
                      - { name: total, expr: "quantity * unit_pric" }
                sinks: []
                """));
        assertEquals("unknown-column", error.code());
        assertEquals("did you mean 'unit_price'?", error.hint());
        assertTrue(error.message().contains("step 'output' (select)"), error.message());
    }

    @Test
    @DisplayName("a misspelled configuration key is caught rather than ignored")
    void unknownConfigKey(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: select
                    from: orders
                    columns: [order_id]
                    colums: [order_id]
                sinks: []
                """));
        assertEquals("unknown-key", error.code());
        assertEquals("did you mean 'columns'?", error.hint());
    }

    @Test
    @DisplayName("a sink that cannot supply a contract column is rejected before Spark starts")
    void contractMissingColumn(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: select
                    from: orders
                    columns:
                      - order_id
                      - { name: line_total, expr: "quantity * unit_price", type: "decimal(14,2)" }
                sinks:
                  - from: output
                    dataset: curated_lines
                """));
        assertEquals("contract-missing-column", error.code());
        assertTrue(error.message().contains("region"), error.message());
    }

    @Test
    @DisplayName("a sink whose declared type disagrees with the contract is rejected")
    void contractTypeMismatch(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                  - id: regions
                    type: select
                    from: customers
                    columns: [customer_id, region]
                  - id: priced
                    type: derive
                    from: orders
                    columns:
                      - { name: line_total, expr: "quantity * unit_price", type: "decimal(8,4)" }
                  - id: joined
                    type: join
                    left: priced
                    right: regions
                    on: [customer_id]
                  - id: output
                    type: select
                    from: joined
                    columns: [order_id, region, line_total]
                sinks:
                  - from: output
                    dataset: curated_lines
                """));
        assertEquals("contract-type-mismatch", error.code());
        assertTrue(error.message().contains("decimal(8,4)"), error.message());
        assertTrue(error.message().contains("decimal(14,2)"), error.message());
    }

    @Test
    @DisplayName("a strict sink rejects a column the contract does not declare")
    void contractExtraColumn(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(Fixtures.diagnose(root,
                Fixtures.GOOD_PIPELINE.replace(
                        "columns: [order_id, region, line_total]",
                        "columns: [order_id, region, line_total, status]")));
        assertEquals("contract-extra-column", error.code());
        assertTrue(error.hint().contains("additive"), error.hint());
    }

    @Test
    @DisplayName("a column on both sides of a join is a clash, not an ambiguous reference later")
    void ambiguousJoinColumn(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                  - id: joined
                    type: join
                    left: orders
                    right: customers
                    on: [customer_id]
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("ambiguous-column"), diagnostics.render());
        Diagnostic error = diagnostics.errors().stream()
                .filter(d -> d.code().equals("ambiguous-column")).findFirst().orElseThrow();
        assertTrue(error.message().contains("status"), error.message());
        assertTrue(error.hint().contains("rename"), error.hint());
    }

    @Test
    @DisplayName("a join key missing from one side says which side")
    void unknownJoinKey(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                  - id: regions
                    type: select
                    from: customers
                    columns: [customer_id, region]
                  - id: joined
                    type: join
                    left: orders
                    right: regions
                    on: [order_id]
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("unknown-column"));
        assertTrue(diagnostics.errors().get(0).message().contains("right side"),
                diagnostics.render());
    }

    @Test
    @DisplayName("a join with nothing to join on is rejected, and cross join is offered")
    void joinWithoutACondition(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                  - id: regions
                    type: select
                    from: customers
                    columns: [customer_id, region]
                  - id: joined
                    type: join
                    left: orders
                    right: regions
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("missing-join-condition"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).hint().contains("cross"));
    }

    @Test
    @DisplayName("joining a step to itself is rejected")
    void selfJoin(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: joined
                    type: join
                    left: orders
                    right: orders
                    on: [order_id]
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("self-join"), diagnostics.render());
    }

    @Test
    @DisplayName("a misspelled quality rule suggests a real one")
    void unknownRule(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root,
                Fixtures.GOOD_PIPELINE + """
                        expectations:
                          - on: output
                            rule: notnull
                            columns: [order_id]
                        """);
        assertTrue(diagnostics.hasCode("unknown-rule"), diagnostics.render());
        assertEquals("did you mean 'not_null'?", diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("a rule naming a column the step does not produce is rejected")
    void unknownColumnInRule(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root,
                Fixtures.GOOD_PIPELINE + """
                        expectations:
                          - on: output
                            rule: not_null
                            columns: [order_di]
                        """);
        assertTrue(diagnostics.hasCode("unknown-column"), diagnostics.render());
        assertEquals("did you mean 'order_id'?", diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("a whole-dataset rule cannot be asked to quarantine")
    void datasetRuleCannotQuarantine(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root,
                Fixtures.GOOD_PIPELINE.replace("sinks:", """
                        quarantine: rejects
                        expectations:
                          - on: output
                            rule: row_count
                            min: 1
                            action: quarantine
                        sinks:"""));
        assertTrue(diagnostics.hasCode("cannot-quarantine"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).hint().contains("warn"));
    }

    @Test
    @DisplayName("an expectation attached to nothing suggests a step")
    void expectationOnUnknownStep(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root,
                Fixtures.GOOD_PIPELINE + """
                        expectations:
                          - on: outpu
                            rule: not_null
                            columns: [order_id]
                        """);
        assertTrue(diagnostics.hasCode("unknown-target"), diagnostics.render());
        assertEquals("did you mean 'output'?", diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("an undeclared parameter in an expression is caught")
    void unknownParameter(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                params:
                  - name: run_date
                    type: date
                    required: true
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: filter
                    from: orders
                    condition: "to_date(ordered_at) <= ${rundate}"
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("unknown-parameter"), diagnostics.render());
    }

    @Test
    @DisplayName("a step whose name is already a source alias is rejected")
    void nameCollision(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: orders
                    type: filter
                    from: orders
                    condition: "true"
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("name-collision"), diagnostics.render());
    }

    @Test
    @DisplayName("a sql step reading a table it never declared is caught by the parser")
    void unknownRelationInSql(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: sql
                    inputs: [orders]
                    query: "select o.order_id from orders o join customers c on c.customer_id = o.customer_id"
                    outputs:
                      - { name: order_id, type: string }
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("unknown-relation"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).message().contains("customers"));
    }

    @Test
    @DisplayName("a sql step's own CTEs are not mistaken for undeclared tables")
    void allowsCtesInSql(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: sql
                    inputs: [orders]
                    query: >-
                      with recent as (select * from orders)
                      select order_id from recent
                    outputs:
                      - { name: order_id, type: string }
                sinks: []
                """);
        assertFalse(diagnostics.hasErrors(), diagnostics.render());
    }

    @Test
    @DisplayName("a step nothing reads and nothing writes is a warning, not an error")
    void unusedStep(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, Fixtures.GOOD_PIPELINE.replace("sinks:", """
                  - id: leftover
                    type: filter
                    from: orders
                    condition: "true"
                sinks:"""));
        assertFalse(diagnostics.hasErrors(), diagnostics.render());
        assertTrue(diagnostics.hasCode("unused-step"), diagnostics.render());
        assertTrue(diagnostics.warnings().stream()
                .anyMatch(d -> d.message().contains("leftover")), diagnostics.render());
    }

    @Test
    @DisplayName("a step declared twice is rejected")
    void duplicateStep(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: filter
                    from: orders
                    condition: "true"
                  - id: output
                    type: filter
                    from: orders
                    condition: "false"
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("duplicate-step"), diagnostics.render());
    }

    @Test
    @DisplayName("a type Spark cannot parse is rejected with the DDL syntax explained")
    void invalidType(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: select
                    from: orders
                    columns:
                      - { name: total, expr: "quantity", type: "number(10)" }
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("invalid-type"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).hint().contains("decimal(p,s)"));
    }

    @Test
    @DisplayName("SQL that does not parse is a diagnostic, not a Spark exception")
    void invalidExpression(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: output
                    type: filter
                    from: orders
                    condition: "quantity >"
                sinks: []
                """);
        assertTrue(diagnostics.hasCode("invalid-expression"), diagnostics.render());
    }
}
