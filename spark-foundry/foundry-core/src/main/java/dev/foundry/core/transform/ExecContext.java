package dev.foundry.core.transform;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

import java.util.LinkedHashMap;
import java.util.Map;

/** Everything a transform needs in order to run one step. */
public final class ExecContext {

    private final SparkSession spark;
    private final StepSpec step;
    private final Map<String, Dataset<Row>> inputs;
    private final FieldSet planned;
    private final ParamResolver params;

    public ExecContext(SparkSession spark,
                       StepSpec step,
                       Map<String, Dataset<Row>> inputs,
                       FieldSet planned,
                       ParamResolver params) {
        this.spark = spark;
        this.step = step;
        this.inputs = new LinkedHashMap<>(inputs);
        this.planned = planned;
        this.params = params;
    }

    public SparkSession spark() {
        return spark;
    }

    public StepSpec step() {
        return step;
    }

    public YamlNode config() {
        return step.config();
    }

    public SourceRef where() {
        return step.where();
    }

    /** What the planner said this step would produce. */
    public FieldSet planned() {
        return planned;
    }

    public Map<String, Dataset<Row>> inputs() {
        return Map.copyOf(inputs);
    }

    public Dataset<Row> input(String name) {
        Dataset<Row> dataset = inputs.get(name);
        if (dataset == null) {
            throw new IllegalStateException("step '" + step.id() + "' asked for input '" + name
                    + "', which it never declared as a dependency");
        }
        return dataset;
    }

    /** Substitutes pipeline parameters into an expression, with real values. */
    public String resolve(String expression, SourceRef where) {
        return params.inExpression(expression, where);
    }

    public ParamResolver params() {
        return params;
    }
}
