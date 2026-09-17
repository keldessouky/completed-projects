package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * A column only ever holds one of a fixed set of values.
 *
 * <p>The classic catch for an upstream system that quietly adds a new status
 * code. Nulls are allowed by default, because "missing" and "not one of these"
 * are different complaints - use {@code not_null} for the first.
 */
public final class AcceptedValuesRule implements RowRule {

    @Override
    public String name() {
        return "accepted_values";
    }

    @Override
    public String summary() {
        return "A column only holds one of a fixed set of values.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("column", "values", "allowNull");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        Rules.column(context);
        if (context.config().strings("values").isEmpty()) {
            context.error("missing-key", context.where(), "'values' must list at least one accepted value");
        }
    }

    @Override
    public Column passes(RuleEvalContext context) {
        Column column = functions.col(context.config().str("column"));
        List<Object> values = new ArrayList<>(context.config().strings("values"));
        Column accepted = column.isin(values.toArray());
        return context.config().bool("allowNull", true) ? column.isNull().or(accepted) : accepted;
    }
}
