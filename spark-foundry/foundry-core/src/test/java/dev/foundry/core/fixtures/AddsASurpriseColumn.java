package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

/**
 * Returns a column its step never declared.
 *
 * <p>The framework projects a custom transform down to its declared columns, so
 * this one is here to prove that an undeclared extra is dropped rather than
 * leaking into the warehouse.
 */
public final class AddsASurpriseColumn implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        // Everything the step declared, plus one column it did not.
        return input.data()
                .withColumn("label", functions.lit(input.option("label")))
                .withColumn("surprise", functions.lit("unasked for"));
    }
}
