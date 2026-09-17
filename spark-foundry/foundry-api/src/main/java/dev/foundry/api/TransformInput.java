package dev.foundry.api;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Everything a {@link DataTransform} is given: the data, the pipeline's
 * parameters, the step's options, and the session.
 *
 * <p>It can be built directly, which is the point - a custom transform is a
 * plain class with a plain argument, so its tests need a DataFrame and a few
 * options rather than a running framework:
 *
 * <pre>{@code
 * Dataset<Row> result = new RiskScore().apply(
 *         TransformInput.of(orders).withOption("threshold", "0.8"));
 * }</pre>
 */
public final class TransformInput {

    private final Map<String, Dataset<Row>> inputs;
    private final Map<String, String> params;
    private final Map<String, String> options;
    private final String stepId;
    private final SparkSession spark;

    private TransformInput(Builder builder) {
        this.inputs = Map.copyOf(builder.inputs);
        this.params = Map.copyOf(builder.params);
        this.options = Map.copyOf(builder.options);
        this.stepId = builder.stepId;
        this.spark = builder.spark;
    }

    /** A single unnamed input, for tests and for the common one-input case. */
    public static TransformInput of(Dataset<Row> data) {
        return builder().input("input", data).build();
    }

    public static Builder builder() {
        return new Builder();
    }

    // ------------------------------------------------------------------- data

    /**
     * The step's input, when there is exactly one - which is the usual case.
     *
     * @throws IllegalStateException if the step reads several inputs, where
     *                               {@link #get(String)} is the right question
     */
    public Dataset<Row> data() {
        if (inputs.size() != 1) {
            throw new IllegalStateException("step '" + stepId + "' reads " + inputs.size()
                    + " inputs " + inputs.keySet() + ", so data() is ambiguous; use get(name)");
        }
        return inputs.values().iterator().next();
    }

    /** One named input, as the step's metadata named it. */
    public Dataset<Row> get(String name) {
        Dataset<Row> data = inputs.get(name);
        if (data == null) {
            throw new IllegalArgumentException("step '" + stepId + "' has no input called '"
                    + name + "'; it reads " + inputs.keySet());
        }
        return data;
    }

    public Map<String, Dataset<Row>> inputs() {
        return inputs;
    }

    public Set<String> inputNames() {
        return new LinkedHashSet<>(inputs.keySet());
    }

    // ------------------------------------------------------------- parameters

    /**
     * A pipeline parameter. Already checked against its declared type by the
     * time it reaches here, so the typed accessors below cannot fail on a value
     * the framework let through.
     */
    public String param(String name) {
        return require(params, name, "parameter");
    }

    public Optional<String> optionalParam(String name) {
        return Optional.ofNullable(params.get(name));
    }

    public long longParam(String name) {
        return Long.parseLong(param(name).trim());
    }

    public int intParam(String name) {
        return Math.toIntExact(longParam(name));
    }

    public BigDecimal decimalParam(String name) {
        return new BigDecimal(param(name).trim());
    }

    public boolean booleanParam(String name) {
        return Boolean.parseBoolean(param(name).trim());
    }

    public LocalDate dateParam(String name) {
        return LocalDate.parse(param(name).trim());
    }

    public LocalDateTime timestampParam(String name) {
        return LocalDateTime.parse(param(name).trim().replace(' ', 'T'));
    }

    public Map<String, String> params() {
        return params;
    }

    // ---------------------------------------------------------------- options

    /**
     * A step option, from the step's {@code options:} block.
     *
     * <p>Options are how a transform is configured per step, so the same class
     * can serve several pipelines without a constant in it for each.
     */
    public String option(String key) {
        return require(options, key, "option");
    }

    public String option(String key, String fallback) {
        return options.getOrDefault(key, fallback);
    }

    public Optional<String> optionalOption(String key) {
        return Optional.ofNullable(options.get(key));
    }

    public long longOption(String key, long fallback) {
        String value = options.get(key);
        return value == null ? fallback : Long.parseLong(value.trim());
    }

    public double doubleOption(String key, double fallback) {
        String value = options.get(key);
        return value == null ? fallback : Double.parseDouble(value.trim());
    }

    public boolean booleanOption(String key, boolean fallback) {
        String value = options.get(key);
        return value == null ? fallback : Boolean.parseBoolean(value.trim());
    }

    public Map<String, String> options() {
        return options;
    }

    // ---------------------------------------------------------------- context

    /** The id of the step this transform is running as. */
    public String stepId() {
        return stepId;
    }

    /**
     * The session, for a transform that needs to read something of its own or
     * build a DataFrame from scratch. Most do not need it.
     */
    public SparkSession spark() {
        if (spark == null) {
            throw new IllegalStateException("no SparkSession was given to step '" + stepId + "'");
        }
        return spark;
    }

    private static String require(Map<String, String> values, String key, String what) {
        String value = values.get(key);
        if (value == null) {
            throw new IllegalArgumentException("no " + what + " called '" + key + "'"
                    + (values.isEmpty() ? "; none were given" : "; available: " + values.keySet()));
        }
        return value;
    }

    @Override
    public String toString() {
        return "TransformInput(step=" + stepId + ", inputs=" + inputs.keySet()
                + ", options=" + options.keySet() + ")";
    }

    /** Builds a {@link TransformInput}, for the framework and for tests alike. */
    public static final class Builder {

        private final Map<String, Dataset<Row>> inputs = new LinkedHashMap<>();
        private final Map<String, String> params = new LinkedHashMap<>();
        private final Map<String, String> options = new LinkedHashMap<>();
        private String stepId = "unnamed";
        private SparkSession spark;

        private Builder() {
        }

        public Builder input(String name, Dataset<Row> data) {
            inputs.put(name, data);
            return this;
        }

        public Builder inputs(Map<String, Dataset<Row>> values) {
            inputs.putAll(values);
            return this;
        }

        public Builder param(String name, String value) {
            params.put(name, value);
            return this;
        }

        public Builder params(Map<String, String> values) {
            params.putAll(values);
            return this;
        }

        public Builder option(String key, String value) {
            options.put(key, value);
            return this;
        }

        public Builder options(Map<String, String> values) {
            options.putAll(values);
            return this;
        }

        public Builder stepId(String value) {
            stepId = value;
            return this;
        }

        public Builder spark(SparkSession value) {
            spark = value;
            return this;
        }

        public TransformInput build() {
            return new TransformInput(this);
        }
    }

    /** Convenience for the one-input test case: {@code of(df).withOption(k, v)}. */
    public TransformInput withOption(String key, String value) {
        return builder().inputs(inputs).params(params).options(options)
                .option(key, value).stepId(stepId).spark(spark).build();
    }

    /** Convenience for the one-input test case: {@code of(df).withParam(k, v)}. */
    public TransformInput withParam(String name, String value) {
        return builder().inputs(inputs).params(params).options(options)
                .param(name, value).stepId(stepId).spark(spark).build();
    }
}
