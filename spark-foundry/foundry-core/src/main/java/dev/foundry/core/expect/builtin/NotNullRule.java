package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

import java.util.List;
import java.util.Set;

/** Every listed column must have a value on every row. */
public final class NotNullRule implements RowRule {

    @Override
    public String name() {
        return "not_null";
    }

    @Override
    public String summary() {
        return "Every listed column has a value on every row.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("columns");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        Rules.columns(context, "columns");
    }

    @Override
    public Column passes(RuleEvalContext context) {
        Column condition = functions.lit(true);
        for (var node : columnNodes(context)) {
            condition = condition.and(functions.col(node).isNotNull());
        }
        return condition;
    }

    private List<String> columnNodes(RuleEvalContext context) {
        var node = context.config().required("columns");
        return (node.isScalar() ? List.of(node) : node.asList()).stream()
                .map(dev.foundry.metadata.yaml.YamlNode::asString).toList();
    }
}
