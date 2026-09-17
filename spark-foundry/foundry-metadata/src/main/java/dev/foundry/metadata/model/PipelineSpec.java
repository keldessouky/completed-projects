package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * A whole pipeline: what it reads, what it does, what it checks, what it writes.
 *
 * <p>This record is the unit of review. It is the artefact a change request
 * touches, and everything the planner needs to say whether the change is sound
 * is inside it - no code to read alongside.
 *
 * @param quarantine the dataset that receives rows diverted by a
 *                   {@link ExpectationAction#QUARANTINE} rule; required only if
 *                   some expectation actually uses that action
 */
public record PipelineSpec(
        String name,
        String description,
        List<ParamSpec> params,
        List<SourceBinding> sources,
        List<StepSpec> steps,
        List<ExpectationSpec> expectations,
        List<SinkSpec> sinks,
        String quarantine,
        SourceRef where) {

    public PipelineSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(where, "where");
        params = params == null ? List.of() : List.copyOf(params);
        sources = sources == null ? List.of() : List.copyOf(sources);
        steps = steps == null ? List.of() : List.copyOf(steps);
        expectations = expectations == null ? List.of() : List.copyOf(expectations);
        sinks = sinks == null ? List.of() : List.copyOf(sinks);
    }

    public Optional<StepSpec> step(String id) {
        return steps.stream().filter(s -> s.id().equals(id)).findFirst();
    }

    public Optional<SourceBinding> source(String alias) {
        return sources.stream().filter(s -> s.alias().equals(alias)).findFirst();
    }

    public Optional<ParamSpec> param(String paramName) {
        return params.stream().filter(p -> p.name().equals(paramName)).findFirst();
    }

    public Optional<String> quarantineDataset() {
        return Optional.ofNullable(quarantine);
    }

    public boolean usesQuarantine() {
        return expectations.stream().anyMatch(e -> e.action() == ExpectationAction.QUARANTINE);
    }
}
