package dev.foundry.core.expect;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

import java.util.Map;

/** What a rule needs in order to judge real data. */
public final class RuleEvalContext {

    private final ExpectationSpec spec;
    private final Dataset<Row> subject;
    private final Map<String, Dataset<Row>> available;
    private final ParamResolver params;
    private final SparkSession spark;

    public RuleEvalContext(ExpectationSpec spec,
                           Dataset<Row> subject,
                           Map<String, Dataset<Row>> available,
                           ParamResolver params,
                           SparkSession spark) {
        this.spec = spec;
        this.subject = subject;
        this.available = Map.copyOf(available);
        this.params = params;
        this.spark = spark;
    }

    public ExpectationSpec spec() {
        return spec;
    }

    public YamlNode config() {
        return spec.config();
    }

    public SourceRef where() {
        return spec.where();
    }

    public Dataset<Row> subject() {
        return subject;
    }

    public Dataset<Row> other(String name) {
        Dataset<Row> dataset = available.get(name);
        if (dataset == null) {
            throw new IllegalStateException("expectation '" + spec.name() + "' refers to '" + name
                    + "', which is not available at this point in the pipeline");
        }
        return dataset;
    }

    public ParamResolver params() {
        return params;
    }

    public SparkSession spark() {
        return spark;
    }

    /** Substitutes pipeline parameters into an expression. */
    public String resolve(String expression) {
        return params.inExpression(expression, spec.where());
    }
}
