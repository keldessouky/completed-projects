package dev.foundry.core.plan;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.model.PipelineSpec;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A whole pipeline, resolved and checked, ready to run.
 *
 * <p>Producing one of these is the expensive part of the work and none of it
 * needs Spark: the schemas are compiled, the graph is ordered, every expression
 * is parsed against the columns that will reach it, and every sink is checked
 * against its contract. What remains is execution.
 */
public final class PipelinePlan {

    private final PipelineSpec spec;
    private final List<SourcePlan> sources;
    private final List<StepPlan> steps;
    private final List<ExpectationSpec> expectations;
    private final List<SinkPlan> sinks;
    private final DatasetSpec quarantine;
    private final Map<String, FieldSet> byName;
    private final Lineage lineage;
    private final String fingerprint;

    PipelinePlan(PipelineSpec spec,
                 List<SourcePlan> sources,
                 List<StepPlan> steps,
                 List<ExpectationSpec> expectations,
                 List<SinkPlan> sinks,
                 DatasetSpec quarantine,
                 Map<String, FieldSet> byName,
                 String fingerprint) {
        this.fingerprint = fingerprint;
        this.spec = spec;
        this.sources = List.copyOf(sources);
        this.steps = List.copyOf(steps);
        this.expectations = List.copyOf(expectations);
        this.sinks = List.copyOf(sinks);
        this.quarantine = quarantine;
        this.byName = new LinkedHashMap<>(byName);
        this.lineage = new Lineage(byName, sources.stream().map(SourcePlan::alias)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    }

    public PipelineSpec spec() {
        return spec;
    }

    /**
     * The fingerprint of the metadata this plan was built from.
     *
     * <p>Carried on the plan rather than looked up later, so that the manifest a
     * run writes names the exact bytes that drove it even if the files on disk
     * have moved on since.
     */
    public String fingerprint() {
        return fingerprint;
    }

    public String name() {
        return spec.name();
    }

    public List<SourcePlan> sources() {
        return sources;
    }

    /** The steps in execution order. */
    public List<StepPlan> steps() {
        return steps;
    }

    public List<ExpectationSpec> expectations() {
        return expectations;
    }

    /** The expectations attached to one step, in declared order. */
    public List<ExpectationSpec> expectationsOn(String node) {
        return expectations.stream().filter(e -> e.on().equals(node)).toList();
    }

    public List<SinkPlan> sinks() {
        return sinks;
    }

    public Optional<DatasetSpec> quarantine() {
        return Optional.ofNullable(quarantine);
    }

    /** Every named result - sources and steps alike - and the columns it carries. */
    public Map<String, FieldSet> byName() {
        return java.util.Collections.unmodifiableMap(byName);
    }

    public Optional<FieldSet> fieldsOf(String node) {
        return Optional.ofNullable(byName.get(node));
    }

    public Lineage lineage() {
        return lineage;
    }

    // ---------------------------------------------------------------- reports

    /** The plan as {@code foundry plan} prints it. */
    public String render() {
        StringBuilder sb = new StringBuilder();
        sb.append("pipeline ").append(spec.name());
        if (spec.description() != null) {
            sb.append(" - ").append(spec.description());
        }
        sb.append(System.lineSeparator());

        if (!spec.params().isEmpty()) {
            sb.append(System.lineSeparator()).append("  parameters").append(System.lineSeparator());
            for (var param : spec.params()) {
                sb.append("    ").append(param.name()).append(": ")
                  .append(param.type().name().toLowerCase(java.util.Locale.ROOT))
                  .append(param.required() ? " (required)" : " (default: " + param.defaultValue() + ")")
                  .append(System.lineSeparator());
            }
        }

        sb.append(System.lineSeparator()).append("  sources").append(System.lineSeparator());
        for (SourcePlan source : sources) {
            sb.append("    ").append(source.alias()).append(" <- ").append(source.dataset().name())
              .append(" (").append(source.dataset().format()).append(", ")
              .append(source.fields().size()).append(" columns)").append(System.lineSeparator());
        }

        sb.append(System.lineSeparator()).append("  steps").append(System.lineSeparator());
        for (StepPlan step : steps) {
            sb.append("    ").append(step.id()).append(": ").append(step.type());
            step.transform().describeStep(step.spec())
                    .ifPresent(detail -> sb.append(" (").append(detail).append(')'));
            if (!step.inputs().isEmpty()) {
                sb.append(" <- ").append(String.join(", ", step.inputs()));
            }
            sb.append(System.lineSeparator());
            if (step.description() != null) {
                sb.append("        # ").append(step.description()).append(System.lineSeparator());
            }
            for (PlanField field : step.output().fields()) {
                sb.append("        ").append(field.name()).append(": ").append(field.typeName());
                if (field.origin() != null && !field.origin().equals(field.name())) {
                    sb.append("  <- ").append(field.origin());
                }
                sb.append(System.lineSeparator());
            }
            for (ExpectationSpec expectation : expectationsOn(step.id())) {
                sb.append("        [expect ").append(expectation.rule()).append(" -> ")
                  .append(expectation.action().name().toLowerCase(java.util.Locale.ROOT)).append(']')
                  .append(System.lineSeparator());
            }
        }

        sb.append(System.lineSeparator()).append("  sinks").append(System.lineSeparator());
        for (SinkPlan sink : sinks) {
            sb.append("    ").append(sink.from()).append(" -> ").append(sink.dataset().name())
              .append(" (").append(sink.dataset().format()).append(", ")
              .append(sink.mode().name().toLowerCase(java.util.Locale.ROOT)).append(')')
              .append(System.lineSeparator());
        }
        if (quarantine != null) {
            sb.append("    rejected rows -> ").append(quarantine.name()).append(System.lineSeparator());
        }
        return sb.toString();
    }

    /** The graph as a Mermaid flowchart, for the generated catalogue. */
    public String mermaid() {
        StringBuilder sb = new StringBuilder("flowchart LR").append(System.lineSeparator());
        Map<String, String> ids = new LinkedHashMap<>();
        int counter = 0;

        for (SourcePlan source : sources) {
            String id = "n" + counter++;
            ids.put(source.alias(), id);
            sb.append("    ").append(id).append("[(").append(source.alias()).append(")]")
              .append(System.lineSeparator());
        }
        for (StepPlan step : steps) {
            String id = "n" + counter++;
            ids.put(step.id(), id);
            sb.append("    ").append(id).append("[\"").append(step.id())
              .append("<br/><small>").append(step.type()).append("</small>\"]")
              .append(System.lineSeparator());
        }
        List<String> sinkIds = new ArrayList<>();
        for (SinkPlan sink : sinks) {
            String id = "n" + counter++;
            sinkIds.add(id);
            sb.append("    ").append(id).append("[/").append(sink.dataset().name()).append("/]")
              .append(System.lineSeparator());
        }

        for (StepPlan step : steps) {
            for (String input : step.inputs()) {
                String from = ids.get(input);
                if (from != null) {
                    sb.append("    ").append(from).append(" --> ").append(ids.get(step.id()))
                      .append(System.lineSeparator());
                }
            }
        }
        for (int i = 0; i < sinks.size(); i++) {
            String from = ids.get(sinks.get(i).from());
            if (from != null) {
                sb.append("    ").append(from).append(" --> ").append(sinkIds.get(i))
                  .append(System.lineSeparator());
            }
        }
        return sb.toString();
    }
}
