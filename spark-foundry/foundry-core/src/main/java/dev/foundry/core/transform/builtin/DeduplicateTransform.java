package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.OrderKey;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.model.StepSpec;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.expressions.Window;
import org.apache.spark.sql.expressions.WindowSpec;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Keeps one row per key: the first, by a declared ordering.
 *
 * <p>Distinct from {@code distinct}, and the one people actually need. Change
 * feeds and re-delivered extracts arrive with several versions of the same
 * record, and "the latest one" is a choice that has to be written down. Here it
 * is, next to the key it applies to, rather than buried in a window function
 * three files away.
 */
public final class DeduplicateTransform implements Transform {

    /** Ranking column, dropped before the result is returned. */
    private static final String RANK_COLUMN = "__foundry_rank";

    @Override
    public String type() {
        return "deduplicate";
    }

    @Override
    public String summary() {
        return "Keep one row per key, chosen by an explicit ordering.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("from", "keys", "orderBy");
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        return Transforms.singleInput(step, "from");
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        String from = Transforms.inputName(context.step(), "from");
        FieldSet input = context.input(from);

        List<String> keys = Transforms.requireColumns(context, context.config(), "keys", input);
        if (keys.isEmpty()) {
            context.error("missing-key", context.where(), "'keys' must name at least one column");
        }
        if (Transforms.orderBy(context.config(), "orderBy", context, input).isEmpty()) {
            context.error("missing-order", context.where(),
                    "'orderBy' must say which row to keep",
                    "for example 'orderBy: [received_at desc]' to keep the most recent");
        }
        if (input.has(RANK_COLUMN)) {
            context.error("reserved-column", context.where(),
                    "the input already has a column called '" + RANK_COLUMN + "', which this step needs");
        }
        return FieldSet.of(input.fields().stream().map(f -> f.carriedFrom(from)).toList());
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> input = context.input(context.config().str("from"));

        List<Column> partition = new ArrayList<>();
        for (var node : context.config().list("keys")) {
            partition.add(functions.col(node.asString()));
        }
        List<Column> ordering = new ArrayList<>();
        for (OrderKey key : Transforms.orderBy(context.config(), "orderBy")) {
            ordering.add(key.toColumn());
        }

        WindowSpec window = Window.partitionBy(partition.toArray(new Column[0]))
                .orderBy(ordering.toArray(new Column[0]));
        return input.withColumn(RANK_COLUMN, functions.row_number().over(window))
                .filter(functions.col(RANK_COLUMN).equalTo(1))
                .drop(RANK_COLUMN);
    }
}
