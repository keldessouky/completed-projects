package dev.foundry.core.plan;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.Diagnostics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A {@code java} step's contract, checked without Spark and without running the
 * class.
 *
 * <p>The class itself is resolved here, while planning, which is the whole point:
 * a renamed class, a class that is not a transform, a class that cannot be
 * constructed, or a step that forgot an option the class says it needs are all
 * caught by {@code foundry validate} rather than by a nightly load.
 */
class JavaTransformTest {

    private static final String FIXTURES = "dev.foundry.core.fixtures.";

    /** A pipeline with one java step, whose body the test supplies. */
    private static String pipeline(String step) {
        return """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                  - alias: customers
                    dataset: landing_customers
                steps:
                """ + step + """
                sinks: []
                """;
    }

    private static Diagnostics diagnose(@TempDir Path root, String step) {
        return Fixtures.diagnose(root, pipeline(step));
    }

    @Test
    @DisplayName("a java step declaring a schema plans to exactly that schema")
    void plansToADeclaredSchema(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, pipeline("""
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    schema: retail.lines
                """));

        var fields = plan.fieldsOf("scored").orElseThrow();
        assertEquals(List.of("order_id", "region", "line_total"), fields.nameList());
        assertEquals("decimal(14,2)", fields.get("line_total").orElseThrow().typeName(),
                "the contract is the metadata's, so its types are known");
    }

    @Test
    @DisplayName("a java step may list its columns inline instead")
    void plansToInlineColumns(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, pipeline("""
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    outputs:
                      - { name: order_id, type: string }
                      - { name: score, type: int }
                      - untyped
                """));

        var fields = plan.fieldsOf("scored").orElseThrow();
        assertEquals(List.of("order_id", "score", "untyped"), fields.nameList());
        assertEquals("int", fields.get("score").orElseThrow().typeName());
        assertEquals("inferred", fields.get("untyped").orElseThrow().typeName(),
                "a column with no declared type is left for the run to settle");
    }

    @Test
    @DisplayName("a step that declares nothing about its output is rejected")
    void requiresADeclaredContract(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                """));
        assertEquals("no-columns", error.code());
        assertTrue(error.hint().contains("schema:"), error.hint());
        assertTrue(error.hint().contains("outputs:"), error.hint());
    }

    @Test
    @DisplayName("declaring both a schema and inline columns is rejected")
    void rejectsBothForms(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    schema: retail.lines
                    outputs:
                      - { name: order_id, type: string }
                """));
        assertEquals("conflicting-outputs", error.code());
    }

    @Test
    @DisplayName("a class that is not on the path is caught while validating")
    void rejectsAMissingClass(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: com.nowhere.NoSuchTransform
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("unknown-transform-class", error.code());
        assertTrue(error.hint().contains("--plugins"), error.hint());
    }

    @Test
    @DisplayName("a class that does not implement the interface is caught")
    void rejectsANonTransform(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.NotATransform
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("not-a-transform", error.code());
        assertTrue(error.message().contains("DataTransform"), error.message());
    }

    @Test
    @DisplayName("a class with no no-argument constructor is caught, and told where config goes")
    void rejectsAClassNeedingArguments(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.NeedsArguments
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("transform-not-instantiable", error.code());
        assertTrue(error.hint().contains("options"), error.hint());
    }

    @Test
    @DisplayName("an abstract class is caught")
    void rejectsAnAbstractClass(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AbstractTransform
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("transform-not-instantiable", error.code());
        assertTrue(error.message().contains("abstract"), error.message());
    }

    @Test
    @DisplayName("a constructor that throws is reported as a constructor that throws")
    void rejectsAnExplodingConstructor(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.ExplodingConstructor
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("transform-not-instantiable", error.code());
        assertTrue(error.message().contains("nothing good happens"), error.message());
    }

    @Test
    @DisplayName("an option the class says it needs is checked against the step")
    void checksRequiredOptions(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AddLabel
                    from: orders
                    schema: retail.lines
                """));
        assertEquals("missing-option", error.code());
        assertTrue(error.message().contains("'label'"), error.message());

        Diagnostics satisfied = diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AddLabel
                    from: orders
                    options:
                      label: "checked"
                    schema: retail.lines
                """);
        assertFalse(satisfied.hasErrors(), satisfied.render());
    }

    @Test
    @DisplayName("a mistyped option name suggests the one that was set")
    void suggestsForAMistypedOption(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AddLabel
                    from: orders
                    options:
                      labl: "checked"
                    schema: retail.lines
                """));
        assertEquals("missing-option", error.code());
        assertEquals("this step sets 'labl' - is that a misspelling of it?", error.hint());
    }

    @Test
    @DisplayName("a step that says nothing about what it reads is rejected")
    void requiresAnInput(@TempDir Path root) {
        Diagnostics diagnostics = diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    schema: retail.lines
                """);
        assertTrue(diagnostics.hasCode("missing-key"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).hint().contains("inputs:"),
                diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("a step cannot use both from: and inputs:")
    void rejectsBothInputForms(@TempDir Path root) {
        Diagnostics diagnostics = diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    inputs: [orders, customers]
                    schema: retail.lines
                """);
        assertTrue(diagnostics.hasCode("conflicting-inputs"), diagnostics.render());
    }

    @Test
    @DisplayName("a multi-input step reports both dependencies, so the graph is right")
    void readsSeveralInputs(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, pipeline("""
                  - id: combined
                    type: java
                    class: dev.foundry.core.fixtures.CombineInputs
                    inputs: [orders, customers]
                    outputs:
                      - { name: customer_id, type: string }
                """));

        StepPlan step = plan.steps().stream()
                .filter(s -> s.id().equals("combined")).findFirst().orElseThrow();
        assertEquals(List.of("orders", "customers"), step.inputs());
    }

    @Test
    @DisplayName("a declared lineage block is applied, and checked against both sides")
    void appliesDeclaredLineage(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, pipeline("""
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    outputs:
                      - { name: order_id, type: string }
                      - { name: score, type: int }
                    lineage:
                      score: [quantity, unit_price]
                """));

        assertEquals(Set.of("orders.quantity", "orders.unit_price"),
                plan.lineage().sourcesOf("scored", "score"));
        assertEquals(Set.of("orders.order_id"), plan.lineage().sourcesOf("scored", "order_id"),
                "a column nobody declared lineage for is matched by name");
    }

    @Test
    @DisplayName("lineage for a column the step does not produce is rejected")
    void rejectsLineageForAnUnknownOutput(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    outputs:
                      - { name: score, type: int }
                    lineage:
                      scoer: [quantity]
                """));
        assertEquals("unknown-column", error.code());
        assertEquals("did you mean 'score'?", error.hint());
    }

    @Test
    @DisplayName("lineage naming a column no input has is rejected")
    void rejectsLineageFromAnUnknownInput(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    outputs:
                      - { name: score, type: int }
                    lineage:
                      score: [quantiy]
                """));
        assertEquals("unknown-column", error.code());
        assertEquals("did you mean 'quantity'?", error.hint());
    }

    @Test
    @DisplayName("an option may carry a pipeline parameter, and an undeclared one is caught")
    void checksParametersInOptions(@TempDir Path root) {
        Diagnostics ok = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                params:
                  - name: label_text
                    type: string
                    default: "checked"
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AddLabel
                    from: orders
                    options:
                      label: "${label_text}"
                    schema: retail.lines
                sinks: []
                """);
        assertFalse(ok.hasErrors(), ok.render());

        Diagnostics typo = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                params:
                  - name: label_text
                    type: string
                    default: "checked"
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.AddLabel
                    from: orders
                    options:
                      label: "${label_txt}"
                    schema: retail.lines
                sinks: []
                """);
        assertTrue(typo.hasCode("unknown-parameter"), typo.render());
        assertEquals("did you mean 'label_text'?", typo.errors().get(0).hint());
    }

    @Test
    @DisplayName("naming a schema nobody declared suggests one that exists")
    void rejectsAnUnknownSchema(@TempDir Path root) {
        Diagnostic error = Fixtures.onlyError(diagnose(root, """
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    schema: retail.line
                """));
        assertEquals("unknown-schema", error.code());
        assertEquals("did you mean 'retail.lines'?", error.hint());
    }

    @Test
    @DisplayName("a java step feeding a sink is contract-checked like any other")
    void isContractCheckedAtTheSink(@TempDir Path root) {
        Diagnostics diagnostics = Fixtures.diagnose(root, """
                kind: pipeline
                name: p
                sources:
                  - alias: orders
                    dataset: landing_orders
                steps:
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    outputs:
                      - { name: order_id, type: string }
                      - { name: region, type: string }
                      - { name: line_total, type: "decimal(8,4)" }
                sinks:
                  - from: scored
                    dataset: curated_lines
                """);
        assertTrue(diagnostics.hasCode("contract-type-mismatch"), diagnostics.render());
        assertTrue(diagnostics.errors().get(0).message().contains("decimal(14,2)"),
                diagnostics.errors().get(0).message());
    }

    @Test
    @DisplayName("the class is named in the plan, so a reader knows where the work happens")
    void namesTheClassInThePlan(@TempDir Path root) {
        PipelinePlan plan = Fixtures.plan(root, pipeline("""
                  - id: scored
                    type: java
                    class: dev.foundry.core.fixtures.PassThrough
                    from: orders
                    schema: retail.lines
                """));
        assertTrue(plan.render().contains(
                        "scored: java (dev.foundry.core.fixtures.PassThrough) <- orders"),
                plan.render());
    }
}
