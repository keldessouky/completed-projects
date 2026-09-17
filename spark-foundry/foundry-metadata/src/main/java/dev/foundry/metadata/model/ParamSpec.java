package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.Objects;

/**
 * A value a pipeline expects to be given at run time.
 *
 * @param defaultValue used when the caller supplies nothing; null when there is
 *                     no default, in which case {@code required} decides whether
 *                     the run can proceed
 */
public record ParamSpec(
        String name,
        ParamType type,
        boolean required,
        String defaultValue,
        String description,
        SourceRef where) {

    public ParamSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(where, "where");
    }
}
