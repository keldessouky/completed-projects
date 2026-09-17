package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** Returns null, which a careless implementation might. */
public final class ReturnsNothing implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return null;
    }
}
