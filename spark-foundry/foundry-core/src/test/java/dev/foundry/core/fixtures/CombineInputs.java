package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** Reads two named inputs, to test the multi-input form. */
public final class CombineInputs implements DataTransform {

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.get("left").unionByName(input.get("right"));
    }
}
