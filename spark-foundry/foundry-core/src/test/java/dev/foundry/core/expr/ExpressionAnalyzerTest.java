package dev.foundry.core.expr;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.schema.Types;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;

import org.apache.spark.sql.types.DataTypes;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * These all run without a {@code SparkSession}. That is the point being tested
 * as much as the behaviour: expression checking has to be cheap enough to put in
 * a pre-commit hook, which means it cannot start a cluster.
 */
class ExpressionAnalyzerTest {

    private static final SourceRef WHERE = new SourceRef("pipeline.yaml", 12, 5);

    private static final FieldSet INPUT = FieldSet.of(List.of(
            PlanField.known("order_id", DataTypes.StringType, false, "source"),
            PlanField.known("quantity", DataTypes.IntegerType, true, "source"),
            PlanField.known("unit_price", DataTypes.createDecimalType(12, 2), true, "source"),
            PlanField.known("customer_id", DataTypes.StringType, true, "source"),
            PlanField.known("tags", DataTypes.createArrayType(DataTypes.StringType), true, "source"),
            PlanField.known("address", Types.parse("struct<city:string,postcode:string>", WHERE), true, "source"),
            PlanField.inferred("computed", "an expression")));

    private static List<String> refs(String expression) {
        return ExpressionAnalyzer.references(expression, WHERE).stream().map(ColumnRef::dotted).toList();
    }

    private static Diagnostics check(String expression) {
        Diagnostics diagnostics = new Diagnostics();
        ExpressionAnalyzer.validate(expression, WHERE, INPUT, "the expression", diagnostics);
        return diagnostics;
    }

    @Test
    @DisplayName("the columns an expression reads are found through functions and operators")
    void findsReferences() {
        assertEquals(List.of("quantity", "unit_price"), refs("quantity * unit_price"));
        assertEquals(List.of("quantity", "unit_price"), refs("sum(coalesce(quantity, 0) * unit_price)"));
        assertEquals(List.of("order_id"), refs("case when order_id is null then 'x' else order_id end")
                .stream().distinct().toList());
        assertEquals(List.of(), refs("1 + 2"), "a constant reads nothing");
    }

    @Test
    @DisplayName("an unknown column is an error naming the nearest real one")
    void rejectsUnknownColumns() {
        Diagnostics diagnostics = check("quantity * unit_pric");
        assertTrue(diagnostics.hasCode("unknown-column"));
        assertEquals("did you mean 'unit_price'?", diagnostics.errors().get(0).hint());
        assertEquals(WHERE, diagnostics.errors().get(0).where());
        assertTrue(diagnostics.errors().get(0).message().contains("the expression"));
    }

    @Test
    @DisplayName("every unknown column in one expression is reported, not just the first")
    void reportsEveryUnknownColumn() {
        assertEquals(2, check("nope * alsonope").errors().size());
    }

    @Test
    @DisplayName("a valid expression produces no diagnostics at all")
    void acceptsValidExpressions() {
        assertTrue(check("quantity * unit_price").isEmpty());
        assertTrue(check("upper(trim(order_id))").isEmpty());
        assertTrue(check("computed + 1").isEmpty());
        assertTrue(check("order_id in ('a', 'b')").isEmpty());
        assertTrue(check("sum(quantity) over (partition by customer_id)").isEmpty());
    }

    @Test
    @DisplayName("a struct is walked into, and a field it does not have is caught")
    void resolvesNestedFields() {
        assertTrue(check("address.city").isEmpty());

        Diagnostics diagnostics = check("address.postcde");
        assertTrue(diagnostics.hasCode("unknown-column"));
        assertTrue(diagnostics.errors().get(0).message().contains("struct 'address'"));
        assertEquals("did you mean 'postcode'?", diagnostics.errors().get(0).hint());
    }

    @Test
    @DisplayName("reading into something that is not a struct says so")
    void rejectsNestedAccessOnScalars() {
        Diagnostics diagnostics = check("order_id.city");
        assertTrue(diagnostics.hasCode("not-a-struct"));
        assertTrue(diagnostics.errors().get(0).message().contains("not a struct"));
    }

    @Test
    @DisplayName("a column the planner left untyped is not walked into, and not complained about")
    void staysQuietAboutColumnsItCannotType() {
        assertTrue(check("computed.anything").isEmpty(),
                "the planner never claimed a type for 'computed', so it cannot claim a mistake either");
    }

    @Test
    @DisplayName("a qualifier is stripped when it names an input rather than a column")
    void handlesQualifiedReferences() {
        Diagnostics diagnostics = new Diagnostics();
        ExpressionAnalyzer.validate("orders.quantity * orders.unit_price", WHERE, INPUT,
                Set.of("orders"), "the expression", diagnostics);
        assertTrue(diagnostics.isEmpty());

        Diagnostics unqualified = new Diagnostics();
        ExpressionAnalyzer.validate("elsewhere.quantity", WHERE, INPUT,
                Set.of("orders"), "the expression", unqualified);
        assertTrue(unqualified.hasCode("unknown-column"),
                "an unrecognised qualifier is a column reference, and there is no such column");
    }

    @Test
    @DisplayName("a lambda parameter is bound by the expression, not by the input")
    void ignoresLambdaParameters() {
        assertTrue(check("transform(tags, t -> upper(t))").isEmpty());
        assertTrue(check("filter(tags, x -> x != order_id)").isEmpty());
        assertTrue(check("aggregate(tags, '', (acc, t) -> concat(acc, t))").isEmpty());
    }

    @Test
    @DisplayName("unparseable SQL is a positioned diagnostic, not a parser exception")
    void reportsSyntaxErrors() {
        MetadataException e = assertThrows(MetadataException.class,
                () -> ExpressionAnalyzer.parse("quantity *", WHERE));
        assertEquals("invalid-expression", e.errors().get(0).code());
        assertEquals(WHERE, e.errors().get(0).where());

        Diagnostics collected = check("quantity *");
        assertTrue(collected.hasCode("invalid-expression"),
                "validate collects the parse failure rather than throwing out of a batch");
    }

    @Test
    @DisplayName("an empty expression is rejected before the parser sees it")
    void rejectsEmptyExpressions() {
        MetadataException e = assertThrows(MetadataException.class,
                () -> ExpressionAnalyzer.parse("   ", WHERE));
        assertEquals("empty-expression", e.errors().get(0).code());
    }
}
