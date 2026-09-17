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

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

import java.util.List;
import java.util.Set;

/**
 * Adds computed columns, keeping everything already there.
 *
 * <p>Where {@code select} states the whole output, {@code derive} states only
 * what changes. A column whose name already exists is replaced in place rather
 * than appended, so the column order stays stable as a pipeline grows - which
 * matters, because column order is part of what the planner verifies.
 */
public final class DeriveTransform implements Transform {

    @Override
    public String type() {
        return "derive";
    }

    @Override
    public String summary() {
        return "Add or replace columns, carrying the rest of the input through unchanged.";
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

        FieldSet output = carryThrough(input, from);
        for (ColumnDef def : Transforms.columns(context.config(), "columns", context)) {
            output = output.with(Transforms.planColumn(context, def, input, from));
        }
        return output;
    }

    private static FieldSet carryThrough(FieldSet input, String from) {
        List<PlanField> carried = input.fields().stream().map(f -> f.carriedFrom(from)).toList();
        return FieldSet.of(carried);
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> result = context.input(context.config().str("from"));
        for (ColumnDef def : SelectTransform.columnDefs(context)) {
            result = result.withColumn(def.name(), Transforms.toColumn(context, def));
        }
        return result;
    }
}
