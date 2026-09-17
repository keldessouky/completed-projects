package dev.foundry.core.plan;

import dev.foundry.core.schema.FieldSet;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What each transform says its output will look like - column names, order and
 * the types it is prepared to commit to - worked out without Spark.
 *
 * <p>{@code AllTransformsIT} then runs the same transforms for real and checks
 * these predictions against what Spark produced.
 */
class TransformPlanningTest {

    private static FieldSet plan(Path root, String steps, String stepId) {
        return Fixtures.plan(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                """ + steps + """
                sinks: []
                """).fieldsOf(stepId).orElseThrow();
    }

    @Test
    @DisplayName("select produces exactly the listed columns, in the listed order")
    void select(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: select
                    from: orders
                    columns:
                      - unit_price
                      - order_id
                      - { name: net, expr: "quantity * unit_price", type: "decimal(14,2)" }
                      - { name: loud, expr: "upper(status)" }
                """, "s");
        assertEquals(List.of("unit_price", "order_id", "net", "loud"), fields.nameList());
        assertEquals("decimal(12,2)", fields.get("unit_price").orElseThrow().typeName(),
                "a column carried through keeps the type the schema gave it");
        assertEquals("decimal(14,2)", fields.get("net").orElseThrow().typeName(),
                "a declared type is a promise, because the transform casts to it");
        assertEquals("inferred", fields.get("loud").orElseThrow().typeName(),
                "an expression with no declared type is left for Spark to settle");
    }

    @Test
    @DisplayName("derive keeps the input and appends, replacing same-named columns in place")
    void derive(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: derive
                    from: orders
                    columns:
                      - { name: net, expr: "quantity * unit_price", type: "decimal(14,2)" }
                      - { name: status, expr: "lower(status)" }
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "quantity", "unit_price",
                "ordered_at", "status", "net"), fields.nameList());
        assertEquals("inferred", fields.get("status").orElseThrow().typeName(),
                "replacing a column in place keeps its position but not its old type");
    }

    @Test
    @DisplayName("filter changes which rows survive, never which columns exist")
    void filter(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: filter
                    from: orders
                    condition: "quantity > 0"
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "quantity", "unit_price",
                "ordered_at", "status"), fields.nameList());
    }

    @Test
    @DisplayName("rename keeps position and type")
    void rename(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: rename
                    from: orders
                    columns:
                      quantity: units
                      unit_price: price
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "units", "price",
                "ordered_at", "status"), fields.nameList());
        assertEquals("decimal(12,2)", fields.get("price").orElseThrow().typeName());
    }

    @Test
    @DisplayName("drop removes the named columns and nothing else")
    void drop(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: drop
                    from: orders
                    columns: [status, ordered_at]
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "quantity", "unit_price"), fields.nameList());
    }

    @Test
    @DisplayName("cast makes a type known where it may not have been")
    void cast(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: cast
                    from: orders
                    columns:
                      quantity: bigint
                      unit_price: "decimal(18,4)"
                """, "s");
        assertEquals("bigint", fields.get("quantity").orElseThrow().typeName());
        assertEquals("decimal(18,4)", fields.get("unit_price").orElseThrow().typeName());
        assertEquals(6, fields.size(), "casting changes types, not the column list");
    }

    @Test
    @DisplayName("join puts the keys first, then the left's columns, then the right's")
    void join(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: regions
                    type: select
                    from: customers
                    columns: [customer_id, region]
                  - id: s
                    type: join
                    left: orders
                    right: regions
                    on: [customer_id]
                """, "s");
        assertEquals(List.of("customer_id", "order_id", "quantity", "unit_price",
                "ordered_at", "status", "region"), fields.nameList());
    }

    @Test
    @DisplayName("an outer join makes the null-padded side nullable")
    void outerJoinNullability(@TempDir Path root) {
        FieldSet left = plan(root, """
                  - id: regions
                    type: select
                    from: customers
                    columns: [customer_id, region]
                  - id: s
                    type: join
                    left: regions
                    right: orders
                    on: [customer_id]
                    how: left
                """, "s");
        assertFalse(left.get("customer_id").orElseThrow().nullable(),
                "the left side's key is as it was");
        assertTrue(left.get("order_id").orElseThrow().nullable(),
                "the right side may be absent, so its non-null column becomes nullable");
    }

    @Test
    @DisplayName("aggregate produces the grouping columns then the measures")
    void aggregate(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: aggregate
                    from: orders
                    groupBy: [status]
                    measures:
                      - { name: total, expr: "sum(quantity)", type: bigint }
                      - { name: lines, expr: "count(1)" }
                """, "s");
        assertEquals(List.of("status", "total", "lines"), fields.nameList());
        assertEquals("bigint", fields.get("total").orElseThrow().typeName());
        assertEquals("inferred", fields.get("lines").orElseThrow().typeName());
    }

    @Test
    @DisplayName("distinct with columns projects; without them it keeps everything")
    void distinct(@TempDir Path root) {
        assertEquals(List.of("customer_id", "status"), plan(root, """
                  - id: s
                    type: distinct
                    from: orders
                    columns: [customer_id, status]
                """, "s").nameList());

        assertEquals(6, plan(root, """
                  - id: s
                    type: distinct
                    from: orders
                """, "s").size());
    }

    @Test
    @DisplayName("deduplicate keeps the input's shape exactly")
    void deduplicate(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: deduplicate
                    from: orders
                    keys: [order_id]
                    orderBy: [ordered_at desc]
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "quantity", "unit_price",
                "ordered_at", "status"), fields.nameList());
    }

    @Test
    @DisplayName("window appends its columns to the input")
    void window(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: window
                    from: orders
                    partitionBy: [customer_id]
                    orderBy: [ordered_at desc]
                    columns:
                      - { name: recency, expr: "row_number()", type: int }
                      - { name: running, expr: "sum(quantity)" }
                """, "s");
        assertEquals(List.of("order_id", "customer_id", "quantity", "unit_price",
                "ordered_at", "status", "recency", "running"), fields.nameList());
        assertEquals("int", fields.get("recency").orElseThrow().typeName());
    }

    @Test
    @DisplayName("union merges by name, and keeps a type only where both sides agree")
    void union(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: a
                    type: select
                    from: orders
                    columns:
                      - order_id
                      - { name: amount, expr: "unit_price", type: "decimal(12,2)" }
                  - id: b
                    type: select
                    from: orders
                    columns:
                      - order_id
                      - { name: amount, expr: "quantity", type: "decimal(18,4)" }
                  - id: s
                    type: union
                    inputs: [a, b]
                """, "s");
        assertEquals(List.of("order_id", "amount"), fields.nameList());
        assertEquals("inferred", fields.get("amount").orElseThrow().typeName(),
                "the two sides disagree on the type, so the planner stops claiming one");
    }

    @Test
    @DisplayName("sql produces what it declares, and nothing else")
    void sql(@TempDir Path root) {
        FieldSet fields = plan(root, """
                  - id: s
                    type: sql
                    inputs: [orders]
                    query: "select order_id, sum(quantity) as units from orders group by order_id"
                    outputs:
                      - { name: order_id, type: string }
                      - units
                """, "s");
        assertEquals(List.of("order_id", "units"), fields.nameList());
        assertEquals("string", fields.get("order_id").orElseThrow().typeName());
        assertEquals("inferred", fields.get("units").orElseThrow().typeName());
    }

    @Test
    @DisplayName("lineage walks a column back through every step to its sources")
    void lineage(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, Fixtures.GOOD_PIPELINE);

        assertEquals(java.util.Set.of("orders.quantity", "orders.unit_price"),
                plan.lineage().sourcesOf("output", "line_total"));
        assertEquals(java.util.Set.of("customers.region"),
                plan.lineage().sourcesOf("output", "region"));
        assertEquals(java.util.Set.of("orders.order_id"),
                plan.lineage().sourcesOf("output", "order_id"));
    }

    @Test
    @DisplayName("steps are ordered so every input is ready before its reader runs")
    void topologicalOrder(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, Fixtures.GOOD_PIPELINE);
        List<String> order = plan.steps().stream().map(StepPlan::id).toList();

        assertTrue(order.indexOf("priced") < order.indexOf("joined"));
        assertTrue(order.indexOf("regions") < order.indexOf("joined"));
        assertTrue(order.indexOf("joined") < order.indexOf("output"));
    }

    @Test
    @DisplayName("a step declared before the one it reads is still ordered correctly")
    void orderIsByDependencyNotByDeclaration(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: second
                    type: filter
                    from: first
                    condition: "quantity > 0"
                  - id: first
                    type: filter
                    from: orders
                    condition: "true"
                sinks: []
                """);
        assertEquals(List.of("first", "second"), plan.steps().stream().map(StepPlan::id).toList());
    }
}
