package dev.foundry.core.plan;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.Transform;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.StepSpec;

import java.util.List;

/**
 * One planned step: what it reads, and what it will produce.
 *
 * <p>{@code output} is a claim, made before any data was seen. The runner holds
 * the step to it.
 */
public record StepPlan(StepSpec spec, Transform transform, List<String> inputs, FieldSet output) {

    public StepPlan {
        inputs = List.copyOf(inputs);
    }

    public String id() {
        return spec.id();
    }

    public String type() {
        return spec.type();
    }

    public String description() {
        return spec.description();
    }

    public SourceRef where() {
        return spec.where();
    }
}
