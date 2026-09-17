package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

import java.util.Set;

/**
 * A column stays within bounds.
 *
 * <p>Either bound may be left out, so this covers "never negative" as readily as
 * "between 0 and 100". Bounds are written as text and compared against the
 * column's own type, so the same rule serves numbers, dates and timestamps.
 */
public final class RangeRule implements RowRule {

    @Override
    public String name() {
        return "range";
    }

    @Override
    public String summary() {
        return "A column stays between the given bounds.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("column", "min", "max", "minInclusive", "maxInclusive", "allowNull");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        Rules.column(context);
        if (!context.config().has("min") && !context.config().has("max")) {
            context.error("missing-key", context.where(),
                    "a range needs at least one of 'min' or 'max'");
        }
    }

    @Override
    public Column passes(RuleEvalContext context) {
        Column column = functions.col(context.config().str("column"));
        Column condition = functions.lit(true);

        if (context.config().has("min")) {
            Column min = functions.lit(context.config().str("min")).cast(columnType(context));
            condition = condition.and(context.config().bool("minInclusive", true)
                    ? column.geq(min) : column.gt(min));
        }
        if (context.config().has("max")) {
            Column max = functions.lit(context.config().str("max")).cast(columnType(context));
            condition = condition.and(context.config().bool("maxInclusive", true)
                    ? column.leq(max) : column.lt(max));
        }
        return context.config().bool("allowNull", true) ? column.isNull().or(condition) : condition;
    }

    /** Bounds are compared in the column's own type, not as strings. */
    private org.apache.spark.sql.types.DataType columnType(RuleEvalContext context) {
        String name = context.config().str("column");
        return context.subject().schema().apply(name).dataType();
    }
}
