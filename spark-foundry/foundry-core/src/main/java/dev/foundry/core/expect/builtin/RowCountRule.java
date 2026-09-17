package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.DatasetRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;
import dev.foundry.core.expect.RuleOutcome;

import java.util.Set;

/**
 * The step produces a plausible number of rows.
 *
 * <p>The rule that catches the failure mode no row-level check ever will: a
 * source that delivered an empty file, or a join that fanned out and multiplied
 * the data tenfold. Both produce rows that are individually perfect.
 */
public final class RowCountRule implements DatasetRule {

    @Override
    public String name() {
        return "row_count";
    }

    @Override
    public String summary() {
        return "The step produces a row count within the given bounds.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("min", "max");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        if (!context.config().has("min") && !context.config().has("max")) {
            context.error("missing-key", context.where(), "a row count needs at least one of 'min' or 'max'");
        }
        long min = context.config().longValue("min", Long.MIN_VALUE);
        long max = context.config().longValue("max", Long.MAX_VALUE);
        if (min > max) {
            context.error("impossible-range", context.where(),
                    "min (" + min + ") is greater than max (" + max + "), so nothing can satisfy this");
        }
    }

    @Override
    public RuleOutcome evaluate(RuleEvalContext context) {
        long count = context.subject().count();
        long min = context.config().longValue("min", Long.MIN_VALUE);
        long max = context.config().longValue("max", Long.MAX_VALUE);

        if (count < min) {
            return RuleOutcome.broken(0, "row count " + count + ", expected at least " + min);
        }
        if (count > max) {
            return RuleOutcome.broken(0, "row count " + count + ", expected at most " + max);
        }
        return RuleOutcome.satisfied("row count " + count + " is within bounds");
    }
}
