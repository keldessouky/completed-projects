package dev.foundry.metadata;

import dev.foundry.metadata.json.Json;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JsonTest {

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parse(String json) {
        return new Yaml().load(json);
    }

    @Test
    @DisplayName("nested objects and arrays round-trip through a parser")
    void writesParseableJson() {
        String json = Json.writer().startObject()
                .field("name", "orders")
                .field("rows", 9L)
                .field("ok", true)
                .field("inputs", List.of("a", "b"))
                .startArray("steps")
                .startObject().field("id", "one").end()
                .startObject().field("id", "two").end()
                .end()
                .startObject("counts").field("total", 12L).end()
                .field("failure", (String) null)
                .end().build();

        Map<String, Object> parsed = parse(json);
        assertEquals("orders", parsed.get("name"));
        assertEquals(9, parsed.get("rows"));
        assertEquals(true, parsed.get("ok"));
        assertEquals(List.of("a", "b"), parsed.get("inputs"));
        assertEquals(2, ((List<?>) parsed.get("steps")).size());
        assertEquals(12, ((Map<?, ?>) parsed.get("counts")).get("total"));
        assertEquals(null, parsed.get("failure"));
    }

    @Test
    @DisplayName("quotes, backslashes and control characters are escaped")
    void escapesAwkwardText() {
        String json = Json.writer().startObject()
                .field("text", "he said \"no\"\nand C:\\path\tthere")
                .field("control", "\u0001")
                .end().build();
        assertEquals("he said \"no\"\nand C:\\path\tthere", parse(json).get("text"));
        assertEquals("\u0001", parse(json).get("control"));
    }

    @Test
    @DisplayName("an empty object or array is still valid")
    void writesEmptyContainers() {
        String json = Json.writer().startObject()
                .startObject("empty").end()
                .startArray("none").end()
                .end().build();
        assertEquals(Map.of(), parse(json).get("empty"));
        assertEquals(List.of(), parse(json).get("none"));
    }

    @Test
    @DisplayName("an unclosed scope is a programming error, caught at build time")
    void refusesUnbalancedOutput() {
        Json json = Json.writer().startObject().field("a", "b");
        assertTrue(assertThrows(IllegalStateException.class, json::build)
                .getMessage().contains("unclosed"));
    }
}
