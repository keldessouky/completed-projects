package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.Objects;
import java.util.Set;

/**
 * A data quality rule attached to a point in the pipeline.
 *
 * <p>Expectations hang off a step by id, so a rule can sit anywhere in the flow
 * rather than only at the edges. Checking an intermediate result is usually
 * where a defect is cheapest to understand.
 *
 * @param on   the step (or source alias) whose output is checked
 * @param rule the rule name, resolved against the rule registry
 */
public record ExpectationSpec(
        String name,
        String on,
        String rule,
        ExpectationAction action,
        YamlNode config,
        SourceRef where) {

    /** Keys the framework owns; everything else belongs to the rule. */
    public static final Set<String> RESERVED_KEYS = Set.of("name", "on", "rule", "action", "description");

    public ExpectationSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(on, "on");
        Objects.requireNonNull(rule, "rule");
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(config, "config");
        Objects.requireNonNull(where, "where");
    }
}
