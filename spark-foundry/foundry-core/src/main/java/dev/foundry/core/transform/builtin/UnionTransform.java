package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.model.StepSpec;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Stacks several inputs into one.
 *
 * <p>Matching is by name by default, because matching by position is how two
 * pipelines that both look right end up with the city in the postcode column.
 * Positional union is still available, but it has to be asked for.
 */
public final class UnionTransform implements Transform {

    @Override
    public String type() {
        return "union";
    }

    @Override
    public String summary() {
        return "Stack several inputs into one, matched by column name.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("inputs", "byName", "allowMissingColumns");
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        return Transforms.listInput(step, "inputs");
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        boolean byName = context.config().bool("byName", true);
        boolean allowMissing = context.config().bool("allowMissingColumns", false);
        if (allowMissing && !byName) {
            context.error("conflicting-options", context.where(),
                    "'allowMissingColumns' only makes sense when matching by name");
        }

        List<String> names = inputNames(context);
        if (names.size() < 2) {
            context.warning("single-input-union", context.where(),
                    "a union of one input does nothing");
        }
        if (names.isEmpty()) {
            return FieldSet.empty();
        }

        String firstName = names.get(0);
        FieldSet result = FieldSet.of(context.input(firstName).fields().stream()
                .map(f -> f.carriedFrom(firstName)).toList());

        for (int i = 1; i < names.size(); i++) {
            String name = names.get(i);
            FieldSet other = context.input(name);
            result = byName
                    ? mergeByName(context, result, other, name, allowMissing)
                    : mergeByPosition(context, result, other, name);
        }
        return result;
    }

    private List<String> inputNames(PlanContext context) {
        List<String> names = new ArrayList<>();
        var node = context.config().required("inputs");
        for (var item : node.isScalar() ? List.of(node) : node.asList()) {
            names.add(item.asString());
        }
        return names;
    }

    private FieldSet mergeByName(PlanContext context, FieldSet result, FieldSet other,
                                 String otherName, boolean allowMissing) {
        Set<String> missing = new LinkedHashSet<>(result.names());
        missing.removeAll(other.names());
        Set<String> extra = new LinkedHashSet<>(other.names());
        extra.removeAll(result.names());

        if (!allowMissing && !missing.isEmpty()) {
            context.error("union-mismatch", context.where(),
                    "input '" + otherName + "' is missing column(s) " + missing,
                    "add them upstream, or set 'allowMissingColumns: true' to null-fill them");
        }
        if (!allowMissing && !extra.isEmpty()) {
            context.error("union-mismatch", context.where(),
                    "input '" + otherName + "' has extra column(s) " + extra,
                    "drop them upstream, or set 'allowMissingColumns: true' to null-fill the others");
        }

        List<PlanField> merged = new ArrayList<>();
        for (PlanField field : result.fields()) {
            merged.add(reconcile(field, other.get(field.name()).orElse(null), otherName, allowMissing));
        }
        if (allowMissing) {
            for (String name : extra) {
                merged.add(other.get(name).orElseThrow().carriedFrom(otherName)
                        .asNullable().withOrigin("only in " + otherName));
            }
        }
        return FieldSet.of(merged);
    }

    private PlanField reconcile(PlanField field, PlanField other, String otherName, boolean allowMissing) {
        Set<String> lineage = new LinkedHashSet<>(field.derivedFrom());
        if (other == null) {
            return allowMissing ? field.asNullable().withOrigin("absent from " + otherName) : field;
        }
        lineage.add(otherName + "." + other.name());
        // A type is only still known if both sides carry the same one.
        PlanField merged = Objects.equals(field.type(), other.type()) ? field : field.withUnknownType();
        if (other.nullable()) {
            merged = merged.asNullable();
        }
        return merged.from(lineage);
    }

    private FieldSet mergeByPosition(PlanContext context, FieldSet result, FieldSet other, String otherName) {
        if (result.size() != other.size()) {
            context.error("union-mismatch", context.where(),
                    "input '" + otherName + "' has " + other.size() + " column(s) but the union expects "
                            + result.size(),
                    "positional unions require identical arity; matching by name is usually what you want");
            return result;
        }
        List<PlanField> merged = new ArrayList<>();
        for (int i = 0; i < result.size(); i++) {
            merged.add(reconcile(result.fields().get(i), other.fields().get(i), otherName, false));
        }
        return FieldSet.of(merged);
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        boolean byName = context.config().bool("byName", true);
        boolean allowMissing = context.config().bool("allowMissingColumns", false);
        List<String> names = new ArrayList<>();
        var node = context.config().required("inputs");
        for (var item : node.isScalar() ? List.of(node) : node.asList()) {
            names.add(item.asString());
        }

        Dataset<Row> result = context.input(names.get(0));
        for (int i = 1; i < names.size(); i++) {
            Dataset<Row> other = context.input(names.get(i));
            result = byName ? result.unionByName(other, allowMissing) : result.union(other);
        }
        return result;
    }
}
