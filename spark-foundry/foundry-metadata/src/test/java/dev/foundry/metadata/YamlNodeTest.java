package dev.foundry.metadata;

import dev.foundry.metadata.yaml.YamlNode;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YamlNodeTest {

    private static YamlNode load(String yaml) {
        return YamlNode.loadString(yaml, "test.yaml");
    }

    @Test
    @DisplayName("a value knows the line it was written on")
    void reportsPositions() {
        YamlNode document = load("""
                kind: schema
                name: retail.orders
                fields:
                  - name: order_id
                    type: string
                """);
        assertEquals(2, document.required("name").where().line());
        YamlNode field = document.list("fields").get(0);
        assertEquals(4, field.required("name").where().line());
        assertEquals(5, field.required("type").where().line());
        assertEquals("test.yaml:5:11", field.required("type").where().describe());
    }

    @Test
    @DisplayName("a key written twice is rejected rather than silently overwritten")
    void rejectsDuplicateKeys() {
        MetadataException e = assertThrows(MetadataException.class,
                () -> load("name: first\nname: second\n"));
        assertEquals("duplicate-key", e.errors().get(0).code());
        assertEquals(2, e.errors().get(0).where().line());
    }

    @Test
    @DisplayName("an unrecognised key is an error, with the nearest legal key offered")
    void suggestsForUnknownKeys() {
        YamlNode document = load("name: orders\ncolums: []\n");
        List<Diagnostic> unknown = document.unknownKeys(Set.of("name", "columns", "type"));
        assertEquals(1, unknown.size());
        assertEquals("unknown-key", unknown.get(0).code());
        assertTrue(unknown.get(0).message().contains("colums"));
        assertEquals("did you mean 'columns'?", unknown.get(0).hint());
    }

    @Test
    @DisplayName("a missing required key names the keys that were present")
    void reportsMissingKeys() {
        MetadataException e = assertThrows(MetadataException.class,
                () -> load("name: orders\n").required("type"));
        assertEquals("missing-key", e.errors().get(0).code());
        assertTrue(e.errors().get(0).hint().contains("name"));
    }

    @Test
    @DisplayName("scalars are converted strictly, and say so when they cannot be")
    void convertsScalars() {
        YamlNode document = load("""
                count: 12
                ratio: 0.5
                yes_flag: yes
                off_flag: off
                text: hello
                """);
        assertEquals(12, document.intValue("count", 0));
        assertEquals(0.5, document.doubleValue("ratio", 0), 1e-9);
        assertTrue(document.bool("yes_flag", false));
        assertFalse(document.bool("off_flag", true));
        assertEquals("hello", document.str("text"));
        assertEquals(7, document.intValue("absent", 7));

        MetadataException e = assertThrows(MetadataException.class,
                () -> document.intValue("text", 0));
        assertEquals("expected-integer", e.errors().get(0).code());
    }

    @Test
    @DisplayName("an enum value is matched loosely and suggests a legal one")
    void convertsEnums() {
        assertEquals(Shape.ROUND_ISH, load("shape: round-ish\n")
                .enumValue("shape", Shape.class, Shape.SQUARE));
        assertEquals(Shape.SQUARE, load("other: 1\n")
                .enumValue("shape", Shape.class, Shape.SQUARE));

        MetadataException e = assertThrows(MetadataException.class,
                () -> load("shape: sqare\n").enumValue("shape", Shape.class, Shape.ROUND_ISH));
        assertEquals("invalid-enum", e.errors().get(0).code());
        assertEquals("did you mean 'square'?", e.errors().get(0).hint());
    }

    @Test
    @DisplayName("a single value is accepted where a list is expected")
    void acceptsScalarForList() {
        assertEquals(List.of("region"), load("groupBy: region\n").strings("groupBy"));
        assertEquals(List.of("region", "day"), load("groupBy: [region, day]\n").strings("groupBy"));
        assertEquals(List.of(), load("other: 1\n").strings("groupBy"));
    }

    @Test
    @DisplayName("identifiers and dotted names are validated")
    void validatesNames() {
        assertEquals("order_id", load("name: order_id\n").identifier("name"));
        assertEquals("retail.orders.raw", load("name: retail.orders.raw\n").qualifiedName("name"));

        MetadataException e = assertThrows(MetadataException.class,
                () -> load("name: order-id\n").identifier("name"));
        assertEquals("invalid-identifier", e.errors().get(0).code());
    }

    @Test
    @DisplayName("asking a list for keys, or a mapping for items, says what was found")
    void reportsWrongShape() {
        MetadataException list = assertThrows(MetadataException.class,
                () -> load("fields: [a, b]\n").required("fields").requireMapping());
        assertEquals("expected-mapping", list.errors().get(0).code());
        assertTrue(list.errors().get(0).message().contains("a list"));

        MetadataException mapping = assertThrows(MetadataException.class,
                () -> load("fields:\n  a: 1\n").required("fields").asList());
        assertEquals("expected-list", mapping.errors().get(0).code());
    }

    @Test
    @DisplayName("YAML that does not parse becomes a diagnostic, not a stack trace")
    void reportsMalformedYaml() {
        MetadataException e = assertThrows(MetadataException.class, () -> load("name: [unclosed\n"));
        assertEquals("malformed-yaml", e.errors().get(0).code());
    }

    @Test
    @DisplayName("an empty file is reported rather than treated as an empty document")
    void reportsEmptyDocument() {
        MetadataException e = assertThrows(MetadataException.class, () -> load("# just a comment\n"));
        assertEquals("empty-document", e.errors().get(0).code());
    }

    private enum Shape { SQUARE, ROUND_ISH }
}
