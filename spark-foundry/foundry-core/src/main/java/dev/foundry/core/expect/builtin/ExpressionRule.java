package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;
import dev.foundry.core.expr.ExpressionAnalyzer;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

import java.util.Set;

/**
 * An arbitrary boolean expression must hold for every row.
 *
 * <p>The general case, for invariants the named rules do not cover -
 * {@code shipped_at >= ordered_at}, {@code discount <= unit_price * quantity}.
 * The expression is parsed and checked against the step's columns like any other,
 * so a typo in an invariant is caught with everything else.
 */
public final class ExpressionRule implements RowRule {

    @Override
    public String name() {
        return "expression";
    }

    @Override
    public String summary() {
        return "An arbitrary boolean expression holds for every row.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("expr");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        YamlNode expr = context.config().required("expr");
        try {
            String resolved = context.params().inExpression(expr.asString(), expr.where());
            ExpressionAnalyzer.validate(resolved, expr.where(), context.subject(),
                    Set.of(context.spec().on()), context.describe(), context.diagnostics());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
        }
    }

    @Override
    public Column passes(RuleEvalContext context) {
        return functions.expr(context.resolve(context.config().str("expr")));
    }
}
