package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.model.StepSpec;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Removes duplicate rows.
 *
 * <p>With {@code columns:} it first projects down to those columns, which is the
 * usual way to build a small dimension out of a wide fact table.
 */
public final class DistinctTransform implements Transform {

    @Override
    public String type() {
        return "distinct";
    }

    @Override
    public String summary() {
        return "Remove duplicate rows, optionally after projecting to a subset of columns.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("from", "columns");
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

        if (!context.config().has("columns")) {
            return FieldSet.of(input.fields().stream().map(f -> f.carriedFrom(from)).toList());
        }
        List<PlanField> fields = new ArrayList<>();
        for (String name : Transforms.requireColumns(context, context.config(), "columns", input)) {
            fields.add(input.get(name).orElseThrow().carriedFrom(from));
        }
        return FieldSet.of(fields);
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> input = context.input(context.config().str("from"));
        if (!context.config().has("columns")) {
            return input.distinct();
        }
        List<Column> columns = new ArrayList<>();
        for (var node : context.config().list("columns")) {
            columns.add(functions.col(node.asString()));
        }
        return input.select(columns.toArray(new Column[0])).distinct();
    }
}
