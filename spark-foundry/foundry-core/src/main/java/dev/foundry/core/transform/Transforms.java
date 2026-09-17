package dev.foundry.core.transform;

import dev.foundry.core.expr.ColumnRef;
import dev.foundry.core.expr.ExpressionAnalyzer;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.schema.Types;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;
import org.apache.spark.sql.types.DataType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Configuration parsing shared by the built-in transforms. */
public final class Transforms {

    private static final Set<String> COLUMN_KEYS = Set.of("name", "expr", "type", "description");
    private static final Set<String> ORDER_KEYS = Set.of("column", "direction", "nulls");

    private Transforms() {
    }

    // ------------------------------------------------------------ input names

    /** Reads a single upstream name from {@code key}, as {@code from:} usually is. */
    public static List<InputRef> singleInput(StepSpec step, String key) {
        YamlNode node = step.config().required(key);
        return List.of(new InputRef(node.asString(), node.where()));
    }

    /** Reads a list of upstream names from {@code key}. */
    public static List<InputRef> listInput(StepSpec step, String key) {
        List<InputRef> refs = new ArrayList<>();
        for (YamlNode node : namesOf(step.config(), key)) {
            refs.add(new InputRef(node.asString(), node.where()));
        }
        if (refs.isEmpty()) {
            throw new MetadataException(Diagnostic.error("missing-key", step.where(),
                    "'" + key + "' must name at least one input"));
        }
        return refs;
    }

    private static List<YamlNode> namesOf(YamlNode config, String key) {
        YamlNode node = config.required(key);
        return node.isScalar() ? List.of(node) : node.asList();
    }

    /** The name a single-input step reads, for use in lineage and qualifiers. */
    public static String inputName(StepSpec step, String key) {
        return step.config().required(key).asString();
    }

    // ---------------------------------------------------------------- columns

    /**
     * A list of column definitions.
     *
     * <p>Two spellings are accepted, because both read well in different places:
     * a bare string {@code order_id} for carrying a column through untouched,
     * and a block with {@code name}, {@code expr} and optionally {@code type}
     * for computing one.
     */
    public static List<ColumnDef> columns(YamlNode config, String key, PlanContext context) {
        List<ColumnDef> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (YamlNode node : config.list(key)) {
            ColumnDef def;
            try {
                def = column(node);
            } catch (MetadataException e) {
                context.diagnostics().addAll(e.diagnostics().all());
                continue;
            }
            if (!seen.add(def.name())) {
                context.error("duplicate-column", def.where(),
                        "column '" + def.name() + "' is produced twice");
                continue;
            }
            out.add(def);
        }
        if (out.isEmpty()) {
            context.error("no-columns", config.where(), "'" + key + "' must list at least one column");
        }
        return out;
    }

    private static ColumnDef column(YamlNode node) {
        if (node.isScalar()) {
            String name = node.asString();
            return new ColumnDef(name, name, null, null, node.where());
        }
        node.requireMapping();
        List<Diagnostic> unknown = node.unknownKeys(COLUMN_KEYS);
        if (!unknown.isEmpty()) {
            throw new MetadataException(unknown.get(0));
        }
        String name = node.identifier("name");
        String expr = node.str("expr", name);
        return new ColumnDef(name, expr, node.str("type", null), node.str("description", null), node.where());
    }

    /**
     * Plans one computed column: substitute parameters, parse and check the
     * expression against the input, and decide what can be claimed about the
     * result.
     *
     * <p>A bare column reference keeps the input's type and nullability. A
     * declared {@code type:} is taken as a promise, because the transform casts
     * to it. Anything else is left for Spark to settle and reported as inferred.
     */
    public static PlanField planColumn(PlanContext context, ColumnDef def, FieldSet input, String inputName) {
        String expr;
        try {
            expr = context.resolve(def.expr(), def.where());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
            return PlanField.inferred(def.name(), def.expr());
        }

        String what = context.describe("column '" + def.name() + "'");
        ExpressionAnalyzer.validate(expr, def.where(), input, Set.of(inputName), what, context.diagnostics());
        Set<String> lineage = lineageOf(expr, def.where(), input, inputName);

        if (def.type() != null) {
            DataType type;
            try {
                type = Types.parse(def.type(), def.where());
            } catch (MetadataException e) {
                context.diagnostics().addAll(e.diagnostics().all());
                return PlanField.inferred(def.name(), def.expr()).from(lineage);
            }
            return PlanField.known(def.name(), type, true, def.expr()).from(lineage);
        }

        if (def.isPassthrough()) {
            return input.get(def.name())
                    .map(field -> field.withOrigin(inputName + "." + def.name()).from(lineage))
                    .orElseGet(() -> PlanField.inferred(def.name(), def.expr()).from(lineage));
        }
        return PlanField.inferred(def.name(), def.expr()).from(lineage);
    }

    /** The input columns an expression reads, as {@code <input>.<column>}. */
    public static Set<String> lineageOf(String expression, SourceRef where, FieldSet input, String inputName) {
        Set<String> lineage = new LinkedHashSet<>();
        List<ColumnRef> refs;
        try {
            refs = ExpressionAnalyzer.references(expression, where);
        } catch (MetadataException e) {
            return lineage;
        }
        for (ColumnRef ref : refs) {
            String head = ref.isQualified() && !input.has(ref.first()) ? ref.parts().get(1) : ref.first();
            if (input.has(head)) {
                lineage.add(inputName + "." + head);
            }
        }
        return lineage;
    }

    /** The Spark column for a planned column: the expression, cast if a type was declared. */
    public static Column toColumn(ExecContext context, ColumnDef def) {
        Column column = functions.expr(context.resolve(def.expr(), def.where()));
        if (def.type() != null) {
            column = column.cast(Types.parse(def.type(), def.where()));
        }
        return column.as(def.name());
    }

    // --------------------------------------------------------------- ordering

    /**
     * An ordering, written either as {@code ordered_at desc} or as a block with
     * {@code column}, {@code direction} and {@code nulls}.
     */
    public static List<OrderKey> orderBy(YamlNode config, String key, PlanContext context, FieldSet input) {
        List<OrderKey> out = new ArrayList<>();
        for (YamlNode node : config.list(key)) {
            OrderKey orderKey;
            try {
                orderKey = orderKey(node);
            } catch (MetadataException e) {
                context.diagnostics().addAll(e.diagnostics().all());
                continue;
            }
            if (!input.has(orderKey.column())) {
                context.error("unknown-column", orderKey.where(),
                        "orders by '" + orderKey.column() + "', which is not available here",
                        Suggest.hint(orderKey.column(), input.names()));
                continue;
            }
            out.add(orderKey);
        }
        return out;
    }

    /** The same ordering, re-read at run time once planning has approved it. */
    public static List<OrderKey> orderBy(YamlNode config, String key) {
        List<OrderKey> out = new ArrayList<>();
        for (YamlNode node : config.list(key)) {
            out.add(orderKey(node));
        }
        return out;
    }

    private static OrderKey orderKey(YamlNode node) {
        if (node.isScalar()) {
            String text = node.asString().trim();
            String[] parts = text.split("\\s+");
            String column = parts[0];
            boolean ascending = true;
            if (parts.length > 1) {
                String direction = parts[1].toLowerCase(Locale.ROOT);
                if (direction.equals("desc")) {
                    ascending = false;
                } else if (!direction.equals("asc")) {
                    throw new MetadataException(Diagnostic.error("invalid-order", node.where(),
                            "'" + parts[1] + "' is not a sort direction", "write 'asc' or 'desc'"));
                }
            }
            if (parts.length > 2) {
                throw new MetadataException(Diagnostic.error("invalid-order", node.where(),
                        "cannot read ordering '" + text + "'",
                        "write '<column> asc|desc', or use a block with column/direction/nulls"));
            }
            return new OrderKey(column, ascending, null, node.where());
        }
        node.requireMapping();
        List<Diagnostic> unknown = node.unknownKeys(ORDER_KEYS);
        if (!unknown.isEmpty()) {
            throw new MetadataException(unknown.get(0));
        }
        String column = node.identifier("column");
        String direction = node.str("direction", "asc").toLowerCase(Locale.ROOT);
        if (!direction.equals("asc") && !direction.equals("desc")) {
            throw new MetadataException(Diagnostic.error("invalid-order", node.required("direction").where(),
                    "'" + direction + "' is not a sort direction", "write 'asc' or 'desc'"));
        }
        Boolean nullsFirst = null;
        if (node.has("nulls")) {
            String nulls = node.str("nulls").toLowerCase(Locale.ROOT);
            nullsFirst = switch (nulls) {
                case "first" -> Boolean.TRUE;
                case "last" -> Boolean.FALSE;
                default -> throw new MetadataException(Diagnostic.error("invalid-order",
                        node.required("nulls").where(),
                        "'" + nulls + "' is not a null placement", "write 'first' or 'last'"));
            };
        }
        return new OrderKey(column, direction.equals("asc"), nullsFirst, node.where());
    }

    // ---------------------------------------------------------------- columns

    /** Checks a list of plain column names against the input, reporting each miss. */
    public static List<String> requireColumns(PlanContext context, YamlNode config, String key, FieldSet input) {
        List<String> out = new ArrayList<>();
        for (YamlNode node : config.list(key)) {
            String name = node.asString();
            if (!input.has(name)) {
                context.error("unknown-column", node.where(),
                        "'" + key + "' names column '" + name + "', which is not available here",
                        Suggest.hint(name, input.names()));
                continue;
            }
            out.add(name);
        }
        return out;
    }

    /** Reports any configuration key the transform does not understand. */
    public static void checkKeys(PlanContext context, Set<String> configKeys) {
        Set<String> allowed = new LinkedHashSet<>(configKeys);
        allowed.addAll(StepSpec.RESERVED_KEYS);
        context.diagnostics().addAll(context.config().unknownKeys(allowed));
    }
}
