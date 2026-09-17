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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Projects an input down to exactly the listed columns.
 *
 * <p>The usual first step of a pipeline: take a wide, loosely typed landing
 * table and state, in one place, which of its columns this pipeline actually
 * depends on and what they are called from here on.
 */
public final class SelectTransform implements Transform {

    @Override
    public String type() {
        return "select";
    }

    @Override
    public String summary() {
        return "Produce exactly the listed columns, each from an expression over the input.";
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

        List<PlanField> fields = new ArrayList<>();
        for (ColumnDef def : Transforms.columns(context.config(), "columns", context)) {
            fields.add(Transforms.planColumn(context, def, input, from));
        }
        return FieldSet.of(fields);
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        String from = context.config().str("from");
        List<Column> columns = new ArrayList<>();
        for (ColumnDef def : columnDefs(context)) {
            columns.add(Transforms.toColumn(context, def));
        }
        return context.input(from).select(columns.toArray(new Column[0]));
    }

    /** Re-reads the column list at run time; planning has already validated it. */
    static List<ColumnDef> columnDefs(ExecContext context) {
        List<ColumnDef> out = new ArrayList<>();
        for (var node : context.config().list("columns")) {
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
