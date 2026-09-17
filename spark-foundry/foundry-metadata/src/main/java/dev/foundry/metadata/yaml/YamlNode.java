package dev.foundry.metadata.yaml;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;

import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.error.Mark;
import org.yaml.snakeyaml.nodes.MappingNode;
import org.yaml.snakeyaml.nodes.Node;
import org.yaml.snakeyaml.nodes.NodeTuple;
import org.yaml.snakeyaml.nodes.ScalarNode;
import org.yaml.snakeyaml.nodes.SequenceNode;
import org.yaml.snakeyaml.nodes.Tag;

import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * A positioned, typed view over a YAML document.
 *
 * <p>The metadata is parsed with SnakeYAML's {@code compose} API rather than
 * bound straight onto Java objects. Composing keeps the node tree - and with it
 * every line and column - so a complaint about a field three levels down can
 * still point at the exact line that declared it. Binding would have thrown
 * that away, and with it the thing that makes metadata behave like code.
 *
 * <p>Accessors that cannot sensibly continue throw a {@link MetadataException}
 * carrying a single diagnostic. Callers that want to report more than one
 * problem per document catch at the element they are iterating - a field, a
 * step - and keep going.
 */
public final class YamlNode {

    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
    private static final Pattern QUALIFIED_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*");

    private final Node node;
    private final String file;
    /** Insertion-ordered so {@link #keys()} reports keys the way the author wrote them. */
    private final Map<String, YamlNode> mapping;
    private final List<YamlNode> sequence;

    private YamlNode(Node node, String file) {
        this.node = node;
        this.file = file;
        this.mapping = node instanceof MappingNode m ? indexMapping(m, file) : null;
        this.sequence = node instanceof SequenceNode s ? indexSequence(s, file) : null;
    }

    // ---------------------------------------------------------------- loading

    /**
     * Every document in a file, for the {@code ---} separated style.
     *
     * <p>Composing only the first document would silently ignore the rest, which
     * is exactly the failure mode this loader exists to prevent.
     */
    public static List<YamlNode> loadAllFile(Path path, String displayName) {
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            LoaderOptions options = new LoaderOptions();
            options.setAllowDuplicateKeys(false);
            List<YamlNode> documents = new ArrayList<>();
            for (Node node : new Yaml(options).composeAll(reader)) {
                documents.add(new YamlNode(node, displayName));
            }
            if (documents.isEmpty()) {
                throw new MetadataException(Diagnostic.error("empty-document",
                        new SourceRef(displayName, 0, 0), "the file is empty"));
            }
            return documents;
        } catch (IOException e) {
            throw new MetadataException(Diagnostic.error("unreadable-file",
                    new SourceRef(displayName, 0, 0), "cannot read metadata file: " + e.getMessage()));
        } catch (org.yaml.snakeyaml.error.YAMLException e) {
            throw new MetadataException(Diagnostic.error("malformed-yaml",
                    new SourceRef(displayName, 0, 0), "not valid YAML: " + firstLine(e.getMessage())));
        }
    }

    /** Parses one document from a string. Used by tests and by inline defaults. */
    public static YamlNode loadString(String yaml, String displayName) {
        return load(new StringReader(yaml), displayName);
    }

    private static YamlNode load(Reader reader, String displayName) {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        Node composed;
        try {
            composed = new Yaml(options).compose(reader);
        } catch (RuntimeException e) {
            // SnakeYAML's own parse errors already carry a line; keep the text
            // but re-home it onto our diagnostic format.
            throw new MetadataException(Diagnostic.error("malformed-yaml",
                    new SourceRef(displayName, 0, 0), "not valid YAML: " + firstLine(e.getMessage())));
        }
        if (composed == null) {
            throw new MetadataException(Diagnostic.error("empty-document",
                    new SourceRef(displayName, 0, 0), "the file is empty"));
        }
        return new YamlNode(composed, displayName);
    }

    private static String firstLine(String message) {
        if (message == null) {
            return "unknown parse error";
        }
        return message.replace(System.lineSeparator(), " ").replace('\n', ' ').trim();
    }

    private static Map<String, YamlNode> indexMapping(MappingNode node, String file) {
        Map<String, YamlNode> index = new LinkedHashMap<>();
        for (NodeTuple tuple : node.getValue()) {
            if (!(tuple.getKeyNode() instanceof ScalarNode key)) {
                throw new MetadataException(Diagnostic.error("non-scalar-key",
                        refOf(tuple.getKeyNode(), file), "keys must be plain strings"));
            }
            YamlNode value = new YamlNode(tuple.getValueNode(), file);
            if (index.putIfAbsent(key.getValue(), value) != null) {
                throw new MetadataException(Diagnostic.error("duplicate-key",
                        refOf(key, file), "key '" + key.getValue() + "' is declared twice",
                        "the later value silently wins in most YAML tools; delete one"));
            }
        }
        return index;
    }

    private static List<YamlNode> indexSequence(SequenceNode node, String file) {
        List<YamlNode> items = new ArrayList<>(node.getValue().size());
        for (Node item : node.getValue()) {
            items.add(new YamlNode(item, file));
        }
        return items;
    }

    private static SourceRef refOf(Node node, String file) {
        Mark mark = node.getStartMark();
        if (mark == null) {
            return new SourceRef(file, 0, 0);
        }
        // SnakeYAML counts from zero; editors and compilers count from one.
        return new SourceRef(file, mark.getLine() + 1, mark.getColumn() + 1);
    }

    // ------------------------------------------------------------- inspection

    public SourceRef where() {
        return refOf(node, file);
    }

    public String file() {
        return file;
    }

    public boolean isMapping() {
        return mapping != null;
    }

    public boolean isSequence() {
        return sequence != null;
    }

    public boolean isScalar() {
        return node instanceof ScalarNode;
    }

    public boolean isNull() {
        return node instanceof ScalarNode scalar && Tag.NULL.equals(scalar.getTag());
    }

    /** Keys in declaration order. Empty for non-mappings. */
    public Set<String> keys() {
        return mapping == null ? Set.of() : new LinkedHashSet<>(mapping.keySet());
    }

    public boolean has(String key) {
        return mapping != null && mapping.containsKey(key) && !mapping.get(key).isNull();
    }

    // -------------------------------------------------------------- accessors

    /** The child at {@code key}, or a diagnostic naming what was expected. */
    public YamlNode required(String key) {
        requireMapping();
        YamlNode child = mapping.get(key);
        if (child == null || child.isNull()) {
            throw new MetadataException(Diagnostic.error("missing-key", where(),
                    "required key '" + key + "' is missing",
                    keys().isEmpty() ? null : "keys present here: " + String.join(", ", keys())));
        }
        return child;
    }

    public Optional<YamlNode> optional(String key) {
        if (mapping == null) {
            return Optional.empty();
        }
        YamlNode child = mapping.get(key);
        return child == null || child.isNull() ? Optional.empty() : Optional.of(child);
    }

    public String asString() {
        if (!(node instanceof ScalarNode scalar)) {
            throw new MetadataException(Diagnostic.error("expected-scalar", where(),
                    "expected a single value, found " + shape()));
        }
        return scalar.getValue();
    }

    public String str(String key) {
        return required(key).asString();
    }

    public String str(String key, String fallback) {
        return optional(key).map(YamlNode::asString).orElse(fallback);
    }

    /** A name usable as a Spark column or alias: letters, digits, underscore. */
    public String identifier(String key) {
        YamlNode child = required(key);
        String value = child.asString();
        if (!IDENTIFIER.matcher(value).matches()) {
            throw new MetadataException(Diagnostic.error("invalid-identifier", child.where(),
                    "'" + value + "' is not a valid " + key,
                    "identifiers start with a letter or underscore and contain only letters, digits and underscores"));
        }
        return value;
    }

    /** A dotted name, as used for schema names like {@code retail.orders.raw}. */
    public String qualifiedName(String key) {
        YamlNode child = required(key);
        String value = child.asString();
        if (!QUALIFIED_NAME.matcher(value).matches()) {
            throw new MetadataException(Diagnostic.error("invalid-name", child.where(),
                    "'" + value + "' is not a valid " + key,
                    "names are dot-separated identifiers, for example 'retail.orders.raw'"));
        }
        return value;
    }

    public int intValue(String key, int fallback) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return fallback;
        }
        String raw = child.get().asString();
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new MetadataException(Diagnostic.error("expected-integer", child.get().where(),
                    "'" + raw + "' is not a whole number"));
        }
    }

    public long longValue(String key, long fallback) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return fallback;
        }
        String raw = child.get().asString();
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            throw new MetadataException(Diagnostic.error("expected-integer", child.get().where(),
                    "'" + raw + "' is not a whole number"));
        }
    }

    public double doubleValue(String key, double fallback) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return fallback;
        }
        String raw = child.get().asString();
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            throw new MetadataException(Diagnostic.error("expected-number", child.get().where(),
                    "'" + raw + "' is not a number"));
        }
    }

    public boolean bool(String key, boolean fallback) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return fallback;
        }
        String raw = child.get().asString().trim().toLowerCase(Locale.ROOT);
        return switch (raw) {
            case "true", "yes", "on" -> true;
            case "false", "no", "off" -> false;
            default -> throw new MetadataException(Diagnostic.error("expected-boolean", child.get().where(),
                    "'" + raw + "' is not true or false"));
        };
    }

    /**
     * An enum constant, matched case-insensitively against the constant names
     * with underscores and hyphens treated alike.
     */
    public <E extends Enum<E>> E enumValue(String key, Class<E> type, E fallback) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return fallback;
        }
        String raw = child.get().asString().trim();
        String normalised = raw.replace('-', '_').toUpperCase(Locale.ROOT);
        for (E constant : type.getEnumConstants()) {
            if (constant.name().equals(normalised)) {
                return constant;
            }
        }
        List<String> legal = new ArrayList<>();
        for (E constant : type.getEnumConstants()) {
            legal.add(constant.name().toLowerCase(Locale.ROOT));
        }
        throw new MetadataException(Diagnostic.error("invalid-enum", child.get().where(),
                "'" + raw + "' is not a valid " + key, Suggest.hint(raw, legal)));
    }

    public List<YamlNode> asList() {
        if (sequence == null) {
            throw new MetadataException(Diagnostic.error("expected-list", where(),
                    "expected a list, found " + shape()));
        }
        return List.copyOf(sequence);
    }

    /** The list at {@code key}, or empty when absent. */
    public List<YamlNode> list(String key) {
        return optional(key).map(YamlNode::asList).orElseGet(List::of);
    }

    /**
     * The list at {@code key} as plain strings. A bare scalar is accepted as a
     * one-element list, because {@code groupBy: region} reads better than
     * {@code groupBy: [region]} when there is only one.
     */
    public List<String> strings(String key) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return List.of();
        }
        YamlNode value = child.get();
        if (value.isScalar()) {
            return List.of(value.asString());
        }
        return value.asList().stream().map(YamlNode::asString).toList();
    }

    /** A flat string-to-string mapping, as used for reader and writer options. */
    public Map<String, String> stringMap(String key) {
        Optional<YamlNode> child = optional(key);
        if (child.isEmpty()) {
            return Map.of();
        }
        YamlNode value = child.get();
        value.requireMapping();
        Map<String, String> out = new LinkedHashMap<>();
        for (String k : value.keys()) {
            out.put(k, value.required(k).asString());
        }
        return Map.copyOf(out);
    }

    // ------------------------------------------------------------- validation

    public YamlNode requireMapping() {
        if (mapping == null) {
            throw new MetadataException(Diagnostic.error("expected-mapping", where(),
                    "expected a block of keys, found " + shape()));
        }
        return this;
    }

    /**
     * Diagnostics for keys this node does not understand.
     *
     * <p>Silently ignoring an unrecognised key is how a mistyped {@code colums:}
     * becomes an afternoon of debugging. Every mapping in the metadata declares
     * the keys it accepts, and anything else is reported with the nearest legal
     * key as a hint.
     */
    public List<Diagnostic> unknownKeys(Set<String> allowed) {
        if (mapping == null) {
            return List.of();
        }
        List<Diagnostic> out = new ArrayList<>();
        for (Map.Entry<String, YamlNode> entry : mapping.entrySet()) {
            if (!allowed.contains(entry.getKey())) {
                out.add(Diagnostic.error("unknown-key", entry.getValue().where(),
                        "unknown key '" + entry.getKey() + "'",
                        Suggest.hint(entry.getKey(), allowed)));
            }
        }
        return out;
    }

    private String shape() {
        if (isNull()) {
            return "nothing";
        }
        if (isMapping()) {
            return "a block of keys";
        }
        if (isSequence()) {
            return "a list";
        }
        return "a single value";
    }

    @Override
    public String toString() {
        return "YamlNode(" + where().describe() + ", " + shape() + ")";
    }
}
