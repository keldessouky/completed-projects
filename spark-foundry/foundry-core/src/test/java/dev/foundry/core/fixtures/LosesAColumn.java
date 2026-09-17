package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** Drops a column its step promised, so the plan check has something to catch. */
public final class LosesAColumn implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data().drop("label");
    }
}
