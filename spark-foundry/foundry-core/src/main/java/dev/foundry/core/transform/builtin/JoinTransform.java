package dev.foundry.core.transform.builtin;

import dev.foundry.core.expr.ExpressionAnalyzer;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Joins two inputs, either on shared key columns or on an explicit condition.
 *
 * <p>Two things here are deliberately stricter than Spark. First, a column name
 * that appears on both sides and is not a join key is an error, not an ambiguous
 * reference discovered later: the fix - rename one of them - is stated at the
 * point of the clash. Second, the output column list is computed and then
 * selected explicitly, so a join's result has a stable, predictable shape rather
 * than whatever order the optimiser happens to produce.
 */
public final class JoinTransform implements Transform {

    @Override
    public String type() {
        return "join";
    }

    @Override
    public String summary() {
        return "Join two inputs on shared key columns or an explicit condition.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("left", "right", "on", "condition", "how");
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        YamlNode left = step.config().required("left");
        YamlNode right = step.config().required("right");
        return List.of(new InputRef(left.asString(), left.where()),
                new InputRef(right.asString(), right.where()));
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        String leftName = context.config().str("left");
        String rightName = context.config().str("right");
        if (leftName.equals(rightName)) {
            context.error("self-join", context.where(),
                    "both sides of the join are '" + leftName + "'",
                    "join a step to itself by deriving a second, differently named step from it first");
        }
        FieldSet left = context.input(leftName);
        FieldSet right = context.input(rightName);
        JoinKind how = kind(context);

        List<String> keys = joinKeys(context, left, right);
        boolean hasCondition = context.config().has("condition");
        if (keys.isEmpty() && !hasCondition && how != JoinKind.CROSS) {
            context.error("missing-join-condition", context.where(),
                    "a join needs either 'on:' key columns or a 'condition:'",
                    "use 'how: cross' if joining every row to every row really is the intent");
        }
        if (!keys.isEmpty() && hasCondition) {
            context.error("conflicting-join-condition", context.where(),
                    "a join takes either 'on:' or 'condition:', not both");
        }
        if (hasCondition) {
            checkCondition(context, leftName, rightName, left, right);
        }

        return output(context, how, keys, leftName, rightName, left, right);
    }

    private JoinKind kind(PlanContext context) {
        try {
            return context.config().enumValue("how", JoinKind.class, JoinKind.INNER);
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
            return JoinKind.INNER;
        }
    }

    private List<String> joinKeys(PlanContext context, FieldSet left, FieldSet right) {
        List<String> keys = new ArrayList<>();
        for (YamlNode node : keyNodes(context.config())) {
            String key = node.asString();
            boolean known = true;
            if (!left.has(key)) {
                context.error("unknown-column", node.where(),
                        "join key '" + key + "' is not on the left side",
                        Suggest.hint(key, left.names()));
                known = false;
            }
            if (!right.has(key)) {
                context.error("unknown-column", node.where(),
                        "join key '" + key + "' is not on the right side",
                        Suggest.hint(key, right.names()));
                known = false;
            }
            if (known) {
                keys.add(key);
            }
        }
        return keys;
    }

    private static List<YamlNode> keyNodes(YamlNode config) {
        if (!config.has("on")) {
            return List.of();
        }
        YamlNode on = config.required("on");
        return on.isScalar() ? List.of(on) : on.asList();
    }

    private void checkCondition(PlanContext context, String leftName, String rightName,
                                FieldSet left, FieldSet right) {
        YamlNode condition = context.config().required("condition");
        try {
            String resolved = context.resolve(condition.asString(), condition.where());
            // Both sides are visible to the condition, each addressable by the
            // name of the step it came from.
            ExpressionAnalyzer.validate(resolved, condition.where(), left.concat(right),
                    Set.of(leftName, rightName), context.describe("the join condition"),
                    context.diagnostics());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
        }
    }

    private FieldSet output(PlanContext context, JoinKind how, List<String> keys,
                            String leftName, String rightName, FieldSet left, FieldSet right) {
        List<PlanField> fields = new ArrayList<>();
        Set<String> keySet = new LinkedHashSet<>(keys);

        for (String key : keys) {
            fields.add(joinKeyField(how, key, leftName, rightName, left, right));
        }
        for (PlanField field : left.fields()) {
            if (keySet.contains(field.name())) {
                continue;
            }
            PlanField carried = field.carriedFrom(leftName);
            fields.add(how.nullPadsLeft() ? carried.asNullable() : carried);
        }
        if (!how.keepsRightColumns()) {
            return FieldSet.of(fields);
        }
        Set<String> leftNames = left.names();
        for (PlanField field : right.fields()) {
            if (keySet.contains(field.name())) {
                continue;
            }
            if (leftNames.contains(field.name())) {
                context.error("ambiguous-column", context.where(),
                        "column '" + field.name() + "' exists on both sides of the join",
                        "rename it on one side first, or add it to 'on:' if it is a join key");
                continue;
            }
            PlanField carried = field.carriedFrom(rightName);
            fields.add(how.nullPadsRight() ? carried.asNullable() : carried);
        }
        return FieldSet.of(fields);
    }

    private PlanField joinKeyField(JoinKind how, String key, String leftName, String rightName,
                                   FieldSet left, FieldSet right) {
        PlanField fromLeft = left.get(key).orElseThrow();
        PlanField fromRight = right.get(key).orElseThrow();
        Set<String> lineage = new LinkedHashSet<>(List.of(leftName + "." + key, rightName + "." + key));

        if (how == JoinKind.FULL) {
            // Either side may be absent, so the key is coalesced and only keeps a
            // known type when both sides agree on one.
            boolean sameType = Objects.equals(fromLeft.type(), fromRight.type());
            PlanField merged = sameType ? fromLeft : fromLeft.withUnknownType();
            return merged.asNullable().withOrigin("coalesce of both sides").from(lineage);
        }
        PlanField chosen = how == JoinKind.RIGHT ? fromRight : fromLeft;
        PlanField result = chosen.withOrigin("join key").from(lineage);
        return how.nullPadsLeft() && how != JoinKind.RIGHT ? result.asNullable() : result;
    }

    // -------------------------------------------------------------- execution

    @Override
    public Dataset<Row> execute(ExecContext context) {
        String leftName = context.config().str("left");
        String rightName = context.config().str("right");
        JoinKind how = context.config().enumValue("how", JoinKind.class, JoinKind.INNER);

        // Aliasing each side lets a condition - and our own output select - name
        // columns unambiguously, which is what keeps the result shape stable.
        Dataset<Row> left = context.input(leftName).as(leftName);
        Dataset<Row> right = context.input(rightName).as(rightName);

        List<String> keys = new ArrayList<>();
        for (YamlNode node : keyNodes(context.config())) {
            keys.add(node.asString());
        }

        Dataset<Row> joined;
        if (how == JoinKind.CROSS && keys.isEmpty() && !context.config().has("condition")) {
            joined = left.crossJoin(right);
        } else {
            Column condition = keys.isEmpty()
                    ? functions.expr(context.resolve(context.config().str("condition"),
                            context.config().required("condition").where()))
                    : keyCondition(keys, leftName, rightName);
            joined = left.join(right, condition, how.sparkName());
        }

        return joined.select(outputColumns(context, how, keys, leftName, rightName).toArray(new Column[0]));
    }

    private Column keyCondition(List<String> keys, String leftName, String rightName) {
        Column condition = null;
        for (String key : keys) {
            Column equality = functions.col(leftName + "." + key).equalTo(functions.col(rightName + "." + key));
            condition = condition == null ? equality : condition.and(equality);
        }
        return condition;
    }

    private List<Column> outputColumns(ExecContext context, JoinKind how, List<String> keys,
                                       String leftName, String rightName) {
        Set<String> keySet = new LinkedHashSet<>(keys);
        List<Column> columns = new ArrayList<>();
        for (String key : keys) {
            Column left = functions.col(leftName + "." + key);
            Column right = functions.col(rightName + "." + key);
            columns.add(switch (how) {
                case FULL -> functions.coalesce(left, right).as(key);
                case RIGHT -> right.as(key);
                default -> left.as(key);
            });
        }
        for (String name : context.input(leftName).columns()) {
            if (!keySet.contains(name)) {
                columns.add(functions.col(leftName + "." + name).as(name));
            }
        }
        if (how.keepsRightColumns()) {
            for (String name : context.input(rightName).columns()) {
                if (!keySet.contains(name)) {
                    columns.add(functions.col(rightName + "." + name).as(name));
                }
            }
        }
        return columns;
    }
}
