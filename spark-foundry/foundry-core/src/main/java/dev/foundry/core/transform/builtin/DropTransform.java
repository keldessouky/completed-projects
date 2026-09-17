package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
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
 * Removes columns.
 *
 * <p>Dropping a column that is not there is treated as an error rather than
 * ignored: it almost always means the pipeline above changed shape, and saying
 * so at once is cheaper than discovering it downstream.
 */
public final class DropTransform implements Transform {

    @Override
    public String type() {
        return "drop";
    }

    @Override
    public String summary() {
        return "Remove the named columns from the input.";
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
        FieldSet output = FieldSet.of(input.fields().stream().map(f -> f.carriedFrom(from)).toList());

        List<String> dropped = Transforms.requireColumns(context, context.config(), "columns", input);
        for (String name : dropped) {
            output = output.without(name);
        }
        if (output.isEmpty() && !dropped.isEmpty()) {
            context.error("no-columns", context.where(), "dropping these columns would leave nothing behind");
        }
        return output;
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> result = context.input(context.config().str("from"));
        for (var node : context.config().list("columns")) {
            result = result.drop(node.asString());
        }
        return result;
    }
}
