package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.Types;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;
import org.apache.spark.sql.types.DataType;

import java.util.List;
import java.util.Set;

/**
 * Changes the type of columns, written {@code column: type}.
 *
 * <p>This is the transform that turns a CSV landing zone into typed data, and
 * the point at which the planner stops guessing: after a cast, the column's type
 * is known, declared, and verified against the result on every run.
 */
public final class CastTransform implements Transform {

    @Override
    public String type() {
        return "cast";
    }

    @Override
    public String summary() {
        return "Change column types, written as column: type.";
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
        for (String name : columns.keys()) {
            YamlNode typeNode = columns.required(name);
            if (!input.has(name)) {
                context.error("unknown-column", typeNode.where(),
                        "cannot cast '" + name + "', which is not available here",
                        Suggest.hint(name, input.names()));
                continue;
            }
            try {
                DataType type = Types.parse(typeNode.asString(), typeNode.where());
                output = output.with(output.get(name).orElseThrow()
                        .withType(type)
                        .asNullable()
                        .withOrigin("cast from " + input.get(name).orElseThrow().typeName()));
            } catch (MetadataException e) {
                context.diagnostics().addAll(e.diagnostics().all());
            }
        }
        return output;
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> result = context.input(context.config().str("from"));
        YamlNode columns = context.config().required("columns");
        for (String name : columns.keys()) {
            YamlNode typeNode = columns.required(name);
            result = result.withColumn(name,
                    functions.col(name).cast(Types.parse(typeNode.asString(), typeNode.where())));
        }
        return result;
    }
}
