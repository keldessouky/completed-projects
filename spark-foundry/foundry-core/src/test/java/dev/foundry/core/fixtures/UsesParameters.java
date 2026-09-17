package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

/** Reads a pipeline parameter, typed, to test that they arrive. */
public final class UsesParameters implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data()
                .withColumn("as_of", functions.lit(input.dateParam("run_date").toString()))
                .withColumn("batch", functions.lit(input.intParam("batch_size")));
    }
}
