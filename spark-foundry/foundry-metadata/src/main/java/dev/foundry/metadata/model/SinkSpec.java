package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.Objects;
import java.util.Optional;

/**
 * An output a pipeline writes: one step's result into one dataset.
 *
 * @param mode overrides the dataset's own write mode when present, so a dataset
 *             appended to by one pipeline can be rebuilt by another
 */
public record SinkSpec(String from, String dataset, WriteMode mode, SourceRef where) {

    public SinkSpec {
        Objects.requireNonNull(from, "from");
        Objects.requireNonNull(dataset, "dataset");
        Objects.requireNonNull(where, "where");
    }

    public Optional<WriteMode> modeOverride() {
        return Optional.ofNullable(mode);
    }
}
