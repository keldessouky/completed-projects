package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** A transform whose constructor throws. */
public final class ExplodingConstructor implements DataTransform {

    public ExplodingConstructor() {
        throw new IllegalStateException("nothing good happens in a transform's constructor");
    }

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data();
    }
}
