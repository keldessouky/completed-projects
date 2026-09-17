package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

import java.util.List;
import java.util.Set;

/**
 * Renames columns, written {@code oldName: newName}.
 *
 * <p>Spark's own {@code withColumnRenamed} is silent when the column does not
 * exist, which makes a typo in a rename invisible until something much later
 * fails to find a column that was never created. Here an unknown source column
 * is an error with a suggestion.
 */
public final class RenameTransform implements Transform {

    @Override
    public String type() {
        return "rename";
    }

    @Override
    public String summary() {
        return "Rename columns, written as oldName: newName.";
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

        YamlNode columns = context.config().required("columns").requireMapping();
        for (String oldName : columns.keys()) {
            YamlNode target = columns.required(oldName);
            String newName = target.asString();
            if (!input.has(oldName)) {
                context.error("unknown-column", target.where(),
                        "cannot rename '" + oldName + "', which is not available here",
                        Suggest.hint(oldName, input.names()));
                continue;
            }
            if (!oldName.equals(newName) && output.has(newName)) {
                context.error("duplicate-column", target.where(),
                        "renaming '" + oldName + "' to '" + newName + "' would collide with an existing column");
                continue;
            }
            output = output.renamed(oldName, newName);
        }
        return output;
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> result = context.input(context.config().str("from"));
        YamlNode columns = context.config().required("columns");
        for (String oldName : columns.keys()) {
            result = result.withColumnRenamed(oldName, columns.required(oldName).asString());
        }
        return result;
    }
}
