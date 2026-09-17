package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.core.transform.ColumnDef;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Groups rows and computes measures over each group.
 *
 * <p>The output is exactly the grouping columns followed by the measures, in the
 * order they were declared - not whatever order the engine produces - so that a
 * new measure appended to the metadata appends a column to the table rather than
 * reshuffling it.
 */
public final class AggregateTransform implements Transform {

    @Override
    public String type() {
        return "aggregate";
    }

    @Override
    public String summary() {
        return "Group by columns and compute measures over each group.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("from", "groupBy", "measures");
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

        List<String> groupBy = Transforms.requireColumns(context, context.config(), "groupBy", input);
        List<PlanField> fields = new ArrayList<>();
        Set<String> names = new LinkedHashSet<>();
        for (String name : groupBy) {
            fields.add(input.get(name).orElseThrow().carriedFrom(from).withOrigin("grouping key"));
            names.add(name);
        }

        for (ColumnDef measure : Transforms.columns(context.config(), "measures", context)) {
            if (!names.add(measure.name())) {
                context.error("duplicate-column", measure.where(),
                        "measure '" + measure.name() + "' collides with a grouping column");
                continue;
            }
            fields.add(Transforms.planColumn(context, measure, input, from));
        }
        if (groupBy.isEmpty()) {
            context.warning("global-aggregate", context.where(),
                    "no grouping columns, so this produces a single row for the whole input");
        }
        return FieldSet.of(fields);
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> input = context.input(context.config().str("from"));

        List<Column> groupBy = new ArrayList<>();
        for (var node : context.config().list("groupBy")) {
            groupBy.add(functions.col(node.asString()));
        }
        List<ColumnDef> measures = measureDefs(context);
        List<Column> aggregated = new ArrayList<>();
        for (ColumnDef measure : measures) {
            aggregated.add(Transforms.toColumn(context, measure));
        }

        Dataset<Row> result = input.groupBy(groupBy.toArray(new Column[0]))
                .agg(aggregated.get(0), aggregated.subList(1, aggregated.size()).toArray(new Column[0]));

        // Re-select so the column order is the declared one, whatever Spark did.
        return result.select(context.planned().nameList().stream()
                .map(functions::col).toArray(Column[]::new));
    }

    private List<ColumnDef> measureDefs(ExecContext context) {
        List<ColumnDef> out = new ArrayList<>();
        for (var node : context.config().list("measures")) {
            if (node.isScalar()) {
                String name = node.asString();
                out.add(new ColumnDef(name, name, null, null, node.where()));
            } else {
                String name = node.str("name");
                out.add(new ColumnDef(name, node.str("expr", name), node.str("type", null),
                        node.str("description", null), node.where()));
            }
        }
        return out;
    }
}
