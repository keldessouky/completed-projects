package dev.foundry.metadata.json;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * A minimal streaming JSON writer for run manifests.
 *
 * <p>Hand-written rather than pulled in as a dependency: the manifest shape is
 * fully controlled by this framework, and a run artefact that outlives the code
 * that wrote it should not be coupled to a serialisation library's version
 * politics. Output is indented, because a manifest is read by people at least
 * as often as by machines.
 */
public final class Json {

    private enum Scope { OBJECT, ARRAY }

    private final StringBuilder out = new StringBuilder();
    private final Deque<Scope> scopes = new ArrayDeque<>();
    private final Deque<Boolean> empty = new ArrayDeque<>();

    public static Json writer() {
        return new Json();
    }

    public Json startObject() {
        prefix();
        out.append('{');
        scopes.push(Scope.OBJECT);
        empty.push(true);
        return this;
    }

    public Json startObject(String key) {
        prefix();
        writeKey(key);
        out.append('{');
        scopes.push(Scope.OBJECT);
        empty.push(true);
        return this;
    }

    public Json startArray(String key) {
        prefix();
        writeKey(key);
        out.append('[');
        scopes.push(Scope.ARRAY);
        empty.push(true);
        return this;
    }

    public Json end() {
        Scope scope = scopes.pop();
        boolean wasEmpty = empty.pop();
        if (!wasEmpty) {
            out.append(System.lineSeparator()).append(indent());
        }
        out.append(scope == Scope.OBJECT ? '}' : ']');
        return this;
    }

    public Json field(String key, String value) {
        prefix();
        writeKey(key);
        writeString(value);
        return this;
    }

    public Json field(String key, long value) {
        prefix();
        writeKey(key);
        out.append(value);
        return this;
    }

    public Json field(String key, double value) {
        prefix();
        writeKey(key);
        out.append(value);
        return this;
    }

    public Json field(String key, boolean value) {
        prefix();
        writeKey(key);
        out.append(value);
        return this;
    }

    /** Writes a bare string into the array currently being built. */
    public Json value(String value) {
        prefix();
        writeString(value);
        return this;
    }

    /** Writes {@code key: [..]} from an iterable of strings in one call. */
    public Json field(String key, Iterable<String> values) {
        startArray(key);
        for (String value : values) {
            value(value);
        }
        return end();
    }

    public String build() {
        if (!scopes.isEmpty()) {
            throw new IllegalStateException(scopes.size() + " unclosed JSON scope(s)");
        }
        return out + System.lineSeparator();
    }

    // --------------------------------------------------------------- internals

    private void prefix() {
        if (!scopes.isEmpty()) {
            if (!empty.peek()) {
                out.append(',');
            } else {
                empty.pop();
                empty.push(false);
            }
            out.append(System.lineSeparator()).append(indent());
        }
    }

    private void writeKey(String key) {
        writeString(key);
        out.append(": ");
    }

    private String indent() {
        return "  ".repeat(scopes.size());
    }

    private void writeString(String value) {
        if (value == null) {
            out.append("null");
            return;
        }
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }
}
