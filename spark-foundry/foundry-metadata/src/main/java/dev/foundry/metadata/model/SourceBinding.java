package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.Objects;

/**
 * An input a pipeline reads, bound to a local alias.
 *
 * <p>The alias is what steps refer to. Renaming the underlying dataset is then
 * a one-line change here rather than an edit to every step that reads it.
 */
public record SourceBinding(String alias, String dataset, SourceRef where) {

    public SourceBinding {
        Objects.requireNonNull(alias, "alias");
        Objects.requireNonNull(dataset, "dataset");
        Objects.requireNonNull(where, "where");
    }
}
