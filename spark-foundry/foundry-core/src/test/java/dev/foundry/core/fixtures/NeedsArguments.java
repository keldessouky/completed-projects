package dev.foundry.core.fixtures;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/** A transform with no no-argument constructor, which cannot be constructed. */
public final class NeedsArguments implements DataTransform {

    private final String setting;

    public NeedsArguments(String setting) {
        this.setting = setting;
    }

    @Override
    public Dataset<Row> apply(TransformInput input) {
        return input.data().filter(setting);
    }
}
