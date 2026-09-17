package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.expressions.Window;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * The listed columns form a key: no two rows share the same combination.
 *
 * <p>Implemented with a counting window rather than a distinct-count comparison,
 * so that the rule can name the offending rows and, if asked, quarantine them
 * instead of only reporting that a total did not add up.
 */
public final class UniqueRule implements RowRule {

    private static final String COUNT_COLUMN = "__foundry_key_count";

    @Override
    public String name() {
        return "unique";
    }

    @Override
    public String summary() {
        return "No two rows share the same combination of the listed columns.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("columns");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        List<String> columns = Rules.columns(context, "columns");
        if (context.subject().has(COUNT_COLUMN)) {
            context.error("reserved-column", context.where(),
                    "the input already has a column called '" + COUNT_COLUMN + "', which this rule needs");
        }
        if (columns.size() == context.subject().size() && !columns.isEmpty()) {
            context.warning("whole-row-unique", context.where(),
                    "every column is part of the key, so this only rejects exact duplicate rows");
        }
    }

    @Override
    public Dataset<Row> prepare(RuleEvalContext context, Dataset<Row> input) {
        List<Column> keys = new ArrayList<>();
        for (String name : names(context)) {
            keys.add(functions.col(name));
        }
        return input.withColumn(COUNT_COLUMN,
                functions.count(functions.lit(1)).over(Window.partitionBy(keys.toArray(new Column[0]))));
    }

    @Override
    public Column passes(RuleEvalContext context) {
        return functions.col(COUNT_COLUMN).equalTo(1);
    }

    private List<String> names(RuleEvalContext context) {
        var node = context.config().required("columns");
        return (node.isScalar() ? List.of(node) : node.asList()).stream()
                .map(dev.foundry.metadata.yaml.YamlNode::asString).toList();
    }
}
