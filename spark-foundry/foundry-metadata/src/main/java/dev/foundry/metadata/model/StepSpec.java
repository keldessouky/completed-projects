package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.Objects;
import java.util.Set;

/**
 * One transformation in a pipeline.
 *
 * <p>Only the three framework-level keys are parsed here. The rest of the block
 * is handed to the transform named by {@code type} as an unparsed
 * {@link YamlNode}, because a transform is the only thing that knows which keys
 * it accepts and what they mean. That is what makes the transform set an
 * extension point rather than a closed enum: adding a transform adds its
 * configuration, its validation and its diagnostics in one class, with no
 * change to the loader.
 */
public record StepSpec(
        String id,
        String type,
        String description,
        YamlNode config,
        SourceRef where) {

    /** Keys the framework owns; everything else belongs to the transform. */
    public static final Set<String> RESERVED_KEYS = Set.of("id", "type", "description");

    public StepSpec {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(config, "config");
        Objects.requireNonNull(where, "where");
    }
}
