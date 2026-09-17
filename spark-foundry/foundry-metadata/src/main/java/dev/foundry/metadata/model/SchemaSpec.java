package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * A named data contract: the shape a dataset promises to have.
 *
 * <p>Schemas are declared once and referenced by name. Nothing in a pipeline
 * describes a column type inline, so there is exactly one place to change when
 * an upstream system changes, and exactly one place for a reviewer to look.
 */
public record SchemaSpec(
        String name,
        int version,
        String description,
        List<FieldSpec> fields,
        SourceRef where) {

    public SchemaSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(where, "where");
        fields = List.copyOf(Objects.requireNonNull(fields, "fields"));
    }

    public Set<String> fieldNames() {
        return new LinkedHashSet<>(fields.stream().map(FieldSpec::name).toList());
    }

    public Optional<FieldSpec> field(String fieldName) {
        return fields.stream().filter(f -> f.name().equals(fieldName)).findFirst();
    }
}
