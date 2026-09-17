package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.Set;

/** Adds a column from an option, and declares that it needs one. */
public final class AddLabel implements DataTransform {

    @Override
    public Set<String> requiredOptions() {
        return Set.of("label");
    }

    @Override
    public String describe() {
        return "adds a label from an option";
    }

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data().withColumn("label", functions.lit(input.option("label")));
    }
}
