package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.List;
import java.util.Objects;

/**
 * One column of a declared schema.
 *
 * @param type the declared type, in Spark's own DDL syntax ({@code string},
 *             {@code decimal(12,2)}, {@code array&lt;string&gt;}). It is kept as text
 *             here so that the metadata module stays engine-free; the core
 *             module compiles it with Spark's parser.
 * @param tags free-form labels such as {@code pii:email} or {@code key}, carried
 *             through to the generated catalogue
 */
public record FieldSpec(
        String name,
        String type,
        boolean nullable,
        String description,
        List<String> tags,
        SourceRef where) {

    public FieldSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(where, "where");
        tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public boolean hasTag(String tag) {
        return tags.contains(tag);
    }
}
