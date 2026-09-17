package dev.foundry.core.transform;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.schema.SchemaCompiler;
import dev.foundry.core.schema.Types;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.SchemaSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.types.DataType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The output contract of a step the framework cannot read.
 *
 * <p>Two transforms do work that is opaque to static analysis: {@code sql}, whose
 * query would have to be resolved against a catalog, and {@code java}, which is
 * compiled code. Neither can be asked what it will produce, so both are required
 * to say - in the metadata, where it is reviewable - and the runner then holds
 * them to it.
 *
 * <p>There are two ways to say it. Naming a declared schema is the better one:
 *
 * <pre>{@code
 * schema: retail.orders.scored
 * }</pre>
 *
 * <p>or the columns can be listed inline, which suits a step whose result is not
 * a table anyone else uses:
 *
 * <pre>{@code
 * outputs:
 *   - { name: order_id, type: string }
 *   - { name: risk, type: "decimal(5,2)" }
 * }</pre>
 *
 * <p>Either form may be followed by a {@code lineage:} block, because lineage is
 * the one thing that genuinely cannot be recovered from an opaque step:
 *
 * <pre>{@code
 * schema: retail.orders.risk
 * lineage:
 *   risk_score: [line_total, discount, category]
 *   risk_band: [line_total, discount, category]
 * }</pre>
 *
 * <p>Without it, a column is attributed to the same-named column of every input
 * that has one - right for a step that passes names through, and silent when it
 * does not, which is the honest answer. Declaring it is how an author states
 * what the framework cannot work out, and the names on both sides are checked,
 * so the declaration cannot quietly rot into a lie.
 */
public final class DeclaredOutputs {

    /** Keys an inline output column accepts. */
    public static final Set<String> COLUMN_KEYS = Set.of("name", "type", "description");

    /** Config keys a transform must allow for either form to be usable. */
    public static final Set<String> CONFIG_KEYS = Set.of("schema", "outputs", "lineage");

    private DeclaredOutputs() {
    }

    /**
     * Reads the step's declared output contract.
     *
     * @param what a phrase naming the transform, for the diagnostics
     * @return the declared fields, or an empty set when nothing usable was declared
     */
    public static FieldSet parse(PlanContext context, String what) {
        boolean hasSchema = context.config().has("schema");
        boolean hasOutputs = context.config().has("outputs");

        if (hasSchema && hasOutputs) {
            context.error("conflicting-outputs", context.where(),
                    "a step declares its output either with 'schema:' or with 'outputs:', not both");
            return FieldSet.empty();
        }
        if (hasSchema) {
            return withLineage(context, fromSchema(context));
        }
        if (hasOutputs) {
            return withLineage(context, fromOutputs(context));
        }
        context.error("no-columns", context.where(),
                what + " must declare the columns it produces",
                "add 'schema: <name>' to point at a declared schema, or 'outputs:' listing"
                        + " each column with its type");
        return FieldSet.empty();
    }

    // --------------------------------------------------------------- by name

    private static FieldSet fromSchema(PlanContext context) {
        YamlNode node = context.config().required("schema");
        String name = node.asString();
        SchemaSpec spec = context.schema(name).orElse(null);
        if (spec == null) {
            context.error("unknown-schema", node.where(),
                    "no schema called '" + name + "'", Suggest.hint(name, context.schemaNames()));
            return FieldSet.empty();
        }

        FieldSet declared = SchemaCompiler.fieldSet(spec, context.diagnostics());
        List<PlanField> fields = new ArrayList<>();
        for (PlanField field : declared.fields()) {
            fields.add(field.withOrigin("schema " + name)
                    .from(byName(context, field.name())));
        }
        return FieldSet.of(fields);
    }

    // -------------------------------------------------------------- inline

    private static FieldSet fromOutputs(PlanContext context) {
        List<PlanField> fields = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (YamlNode node : context.config().list("outputs")) {
            try {
                fields.add(column(context, node, seen));
            } catch (MetadataException e) {
                context.diagnostics().addAll(e.diagnostics().all());
            }
        }
        if (fields.isEmpty()) {
            context.error("no-columns", context.where(), "'outputs' must list at least one column");
        }
        return FieldSet.of(fields);
    }

    private static PlanField column(PlanContext context, YamlNode node, Set<String> seen) {
        String name;
        String typeText = null;

        if (node.isScalar()) {
            name = node.asString();
        } else {
            node.requireMapping();
            List<Diagnostic> unknown = node.unknownKeys(COLUMN_KEYS);
            if (!unknown.isEmpty()) {
                throw new MetadataException(unknown.get(0));
            }
            name = node.identifier("name");
            typeText = node.str("type", null);
        }
        if (!seen.add(name)) {
            throw new MetadataException(Diagnostic.error("duplicate-column", node.where(),
                    "column '" + name + "' is declared twice"));
        }

        PlanField field = typeText == null
                ? PlanField.inferred(name, "declared")
                : known(name, Types.parse(typeText, node.where()));
        return field.from(byName(context, name));
    }

    private static PlanField known(String name, DataType type) {
        return PlanField.known(name, type, true, "declared as " + type.simpleString());
    }

    // -------------------------------------------------------------- lineage

    /**
     * Applies the optional {@code lineage:} block over whatever the shape said.
     *
     * <p>Both sides are checked: a key must be a column this step declares, and
     * each value must be a column of one of its inputs. A lineage block that has
     * drifted from either is a build failure, which is the only way a hand-written
     * claim about data flow stays worth reading.
     */
    private static FieldSet withLineage(PlanContext context, FieldSet declared) {
        if (!context.config().has("lineage")) {
            return declared;
        }
        YamlNode block = context.config().required("lineage").requireMapping();
        FieldSet result = declared;

        for (String column : block.keys()) {
            YamlNode value = block.required(column);
            if (!declared.has(column)) {
                context.error("unknown-column", value.where(),
                        "lineage is declared for '" + column + "', which this step does not produce",
                        Suggest.hint(column, declared.names()));
                continue;
            }
            Set<String> sources = resolve(context, value);
            result = result.with(result.get(column).orElseThrow().from(sources));
        }
        return result;
    }

    /**
     * Resolves one lineage entry into qualified {@code input.column} references.
     *
     * <p>A bare name is taken to mean that column of whichever inputs have it,
     * which is what an author means most of the time; an {@code input.column}
     * pair says exactly which, for the case where two inputs share a name.
     */
    private static Set<String> resolve(PlanContext context, YamlNode value) {
        Set<String> sources = new LinkedHashSet<>();
        for (YamlNode item : value.isScalar() ? List.of(value) : value.asList()) {
            String reference = item.asString();
            int dot = reference.indexOf('.');

            if (dot > 0 && context.inputNames().contains(reference.substring(0, dot))) {
                String input = reference.substring(0, dot);
                String column = reference.substring(dot + 1);
                if (!context.input(input).has(column)) {
                    context.error("unknown-column", item.where(),
                            "'" + reference + "' names no column of '" + input + "'",
                            Suggest.hint(column, context.input(input).names()));
                    continue;
                }
                sources.add(reference);
                continue;
            }

            Set<String> found = byName(context, reference);
            if (found.isEmpty()) {
                context.error("unknown-column", item.where(),
                        "'" + reference + "' is not a column of any of this step's inputs",
                        Suggest.hint(reference, allColumns(context)));
                continue;
            }
            sources.addAll(found);
        }
        return sources;
    }

    /** The same-named column of every input that has one. */
    private static Set<String> byName(PlanContext context, String column) {
        Set<String> sources = new LinkedHashSet<>();
        for (Map.Entry<String, FieldSet> input : context.inputs().entrySet()) {
            if (input.getValue().has(column)) {
                sources.add(input.getKey() + "." + column);
            }
        }
        return sources;
    }

    private static Set<String> allColumns(PlanContext context) {
        Set<String> names = new LinkedHashSet<>();
        context.inputs().values().forEach(fields -> names.addAll(fields.names()));
        return names;
    }

    /** Where the inline form was written, for a diagnostic that needs a position. */
    static SourceRef where(PlanContext context) {
        return context.config().has("outputs")
                ? context.config().required("outputs").where()
                : context.where();
    }
}
