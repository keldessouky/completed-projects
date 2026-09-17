package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/** A column matches a regular expression - identifier formats, codes, postcodes. */
public final class RegexRule implements RowRule {

    @Override
    public String name() {
        return "regex";
    }

    @Override
    public String summary() {
        return "A column matches a regular expression.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("column", "pattern", "allowNull");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        Rules.column(context);
        var patternNode = context.config().required("pattern");
        try {
            // Compiled here purely to reject a bad pattern at validation time.
            Pattern.compile(patternNode.asString());
        } catch (PatternSyntaxException e) {
            context.error("invalid-pattern", patternNode.where(),
                    "not a valid regular expression: " + e.getDescription());
        }
    }

    @Override
    public Column passes(RuleEvalContext context) {
        Column column = functions.col(context.config().str("column"));
        Column matches = column.rlike(context.config().str("pattern"));
        return context.config().bool("allowNull", true) ? column.isNull().or(matches) : matches;
    }
}
