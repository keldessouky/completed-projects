package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RowRule;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.expect.RuleEvalContext;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Every key in this step exists in another one: a foreign key, checked.
 *
 * <p>Implemented as a left join against the distinct keys of the referenced
 * result, marking rows that found no match. That makes orphans quarantinable -
 * the usual thing you want, since an order whose customer is missing should not
 * block the other ten thousand orders, but must not be counted in a
 * customer-level total either.
 */
public final class ReferentialRule implements RowRule {

    private static final String MATCH_COLUMN = "__foundry_ref_match";

    @Override
    public String name() {
        return "referential";
    }

    @Override
    public String summary() {
        return "Every key in this step exists in another step's result.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("columns", "references", "referencedColumns");
    }

    @Override
    public void validate(RuleContext context) {
        Rules.checkKeys(context, configKeys());
        List<String> columns = Rules.columns(context, "columns");

        YamlNode referencesNode = context.config().required("references");
        String references = referencesNode.asString();
        FieldSet referenced = context.available().get(references);
        if (referenced == null) {
            context.error("unknown-reference", referencesNode.where(),
                    "'" + references + "' is not a source or step in this pipeline",
                    Suggest.hint(references, context.availableNames()));
            return;
        }
        if (references.equals(context.spec().on())) {
            context.error("self-reference", referencesNode.where(),
                    "a step cannot check its keys against itself");
            return;
        }

        List<String> referencedColumns = context.config().strings("referencedColumns");
        if (referencedColumns.isEmpty()) {
            referencedColumns = columns;
        }
        if (referencedColumns.size() != columns.size()) {
            context.error("mismatched-key", context.where(),
                    "'columns' has " + columns.size() + " column(s) but 'referencedColumns' has "
                            + referencedColumns.size());
            return;
        }
        for (String name : referencedColumns) {
            if (!referenced.has(name)) {
                context.error("unknown-column", referencesNode.where(),
                        "'" + references + "' has no column '" + name + "'",
                        Suggest.hint(name, referenced.names()));
            }
        }
        if (context.subject().has(MATCH_COLUMN)) {
            context.error("reserved-column", context.where(),
                    "the input already has a column called '" + MATCH_COLUMN + "', which this rule needs");
        }
    }

    @Override
    public Dataset<Row> prepare(RuleEvalContext context, Dataset<Row> input) {
        List<String> columns = context.config().strings("columns");
        List<String> referencedColumns = context.config().strings("referencedColumns");
        if (referencedColumns.isEmpty()) {
            referencedColumns = columns;
        }

        // Only the key columns are needed, deduplicated, so the join stays small
        // and cannot itself multiply rows.
        List<Column> projection = new ArrayList<>();
        for (int i = 0; i < referencedColumns.size(); i++) {
            projection.add(functions.col(referencedColumns.get(i)).as("__foundry_ref_" + i));
        }
        Dataset<Row> keys = context.other(context.config().str("references"))
                .select(projection.toArray(new Column[0]))
                .distinct()
                .withColumn(MATCH_COLUMN, functions.lit(true));

        Column condition = null;
        for (int i = 0; i < columns.size(); i++) {
            Column equality = input.col(columns.get(i)).equalTo(keys.col("__foundry_ref_" + i));
            condition = condition == null ? equality : condition.and(equality);
        }

        Dataset<Row> joined = input.join(keys, condition, "left_outer");
        for (int i = 0; i < referencedColumns.size(); i++) {
            joined = joined.drop("__foundry_ref_" + i);
        }
        return joined;
    }

    @Override
    public Column passes(RuleEvalContext context) {
        return functions.col(MATCH_COLUMN).isNotNull();
    }
}
