package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** A custom transform that does nothing, for testing the machinery around it. */
public final class PassThrough implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data();
    }
}
