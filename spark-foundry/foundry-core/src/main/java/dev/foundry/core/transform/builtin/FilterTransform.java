package dev.foundry.core.transform.builtin;

import dev.foundry.core.expr.ExpressionAnalyzer;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.List;
import java.util.Set;

/** Keeps the rows for which a condition holds. The shape of the data is unchanged. */
public final class FilterTransform implements Transform {

    @Override
    public String type() {
        return "filter";
    }

    @Override
    public String summary() {
        return "Keep only the rows matching a condition.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("from", "condition");
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

        YamlNode condition = context.config().required("condition");
        try {
            String resolved = context.resolve(condition.asString(), condition.where());
            ExpressionAnalyzer.validate(resolved, condition.where(), input, Set.of(from),
                    context.describe("the filter condition"), context.diagnostics());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
        }

        // A filter changes which rows survive, never which columns exist.
        return FieldSet.of(input.fields().stream().map(f -> f.carriedFrom(from)).toList());
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        YamlNode condition = context.config().required("condition");
        return context.input(context.config().str("from"))
                .filter(functions.expr(context.resolve(condition.asString(), condition.where())));
    }
}
