package dev.foundry.core.plan;

import dev.foundry.core.expect.DatasetRule;
import dev.foundry.core.expect.ExpectationRegistry;
import dev.foundry.core.expect.ExpectationRule;
import dev.foundry.core.expect.Quarantine;
import dev.foundry.core.expect.RuleContext;
import dev.foundry.core.io.Contracts;
import dev.foundry.core.io.Locations;
import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.SchemaCompiler;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.TransformRegistry;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.MetadataRepository;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.ExpectationAction;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.model.PipelineSpec;
import dev.foundry.metadata.model.SchemaSpec;
import dev.foundry.metadata.model.SinkSpec;
import dev.foundry.metadata.model.SourceBinding;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.model.WriteMode;

import org.apache.spark.sql.types.StructType;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns a {@link PipelineSpec} into a checked, ordered {@link PipelinePlan}.
 *
 * <p>Everything here happens without a {@code SparkSession}, without a cluster
 * and without reading a byte of data. That is the whole argument for treating
 * pipeline metadata as code: the questions that usually cost a forty-minute
 * nightly run to answer - does this column exist, do these types line up, does
 * this output fit the table it is written to - are answered in the time it takes
 * to save a file.
 *
 * <p>The planner reports as much as it can in one pass. A step whose inputs
 * failed to plan is skipped rather than reported twice, so the output stays
 * proportional to the number of real mistakes.
 */
public final class Planner {

    private final TransformRegistry transforms;
    private final ExpectationRegistry rules;

    public Planner(TransformRegistry transforms, ExpectationRegistry rules) {
        this.transforms = transforms;
        this.rules = rules;
    }

    public static Planner standard() {
        return new Planner(TransformRegistry.builtIn(), ExpectationRegistry.builtIn());
    }

    public TransformRegistry transforms() {
        return transforms;
    }

    public ExpectationRegistry rules() {
        return rules;
    }

    /** Plans a pipeline, throwing a full report if anything is wrong with it. */
    public PipelinePlan plan(MetadataRepository repository, PipelineSpec pipeline) {
        Diagnostics diagnostics = new Diagnostics();
        PipelinePlan plan = plan(repository, pipeline, diagnostics);
        diagnostics.throwIfErrors("pipeline '" + pipeline.name() + "' is not valid");
        return plan;
    }

    /** Plans a pipeline, reporting into {@code diagnostics} instead of throwing. */
    public PipelinePlan plan(MetadataRepository repository, PipelineSpec pipeline, Diagnostics diagnostics) {
        ParamResolver params = ParamResolver.forPlanning(pipeline);
        Map<String, FieldSet> byName = new LinkedHashMap<>();

        List<SourcePlan> sources = planSources(repository, pipeline, byName, diagnostics);
        Map<String, List<InputRef>> dependencies = new LinkedHashMap<>();
        Map<String, Transform> stepTransforms = new LinkedHashMap<>();
        List<StepSpec> usable = resolveSteps(pipeline, byName.keySet(), dependencies, stepTransforms, diagnostics);
        List<StepSpec> ordered = order(pipeline, usable, dependencies, byName.keySet(), diagnostics);

        List<StepPlan> steps = planSteps(pipeline, ordered, dependencies, stepTransforms, params, byName, diagnostics);

        // A step that failed to resolve or plan has already been reported once.
        // Everything downstream of it would now also look broken, so those names
        // are remembered and the second round of complaints is suppressed: a
        // report should have one entry per mistake, not one per consequence.
        Set<String> alreadyReported = new LinkedHashSet<>();
        for (StepSpec step : pipeline.steps()) {
            if (!byName.containsKey(step.id())) {
                alreadyReported.add(step.id());
            }
        }

        List<ExpectationSpec> expectations =
                planExpectations(pipeline, byName, alreadyReported, params, diagnostics);
        DatasetSpec quarantine = planQuarantine(repository, pipeline, diagnostics);
        List<SinkPlan> sinks = planSinks(repository, pipeline, byName, alreadyReported, diagnostics);

        warnAboutDeadSteps(pipeline, steps, sinks, expectations, diagnostics);
        return new PipelinePlan(pipeline, sources, steps, expectations, sinks, quarantine, byName,
                repository.fingerprint());
    }

    // ---------------------------------------------------------------- sources

    private List<SourcePlan> planSources(MetadataRepository repository, PipelineSpec pipeline,
                                         Map<String, FieldSet> byName, Diagnostics diagnostics) {
        List<SourcePlan> plans = new ArrayList<>();
        for (SourceBinding binding : pipeline.sources()) {
            DatasetSpec dataset;
            SchemaSpec schema;
            try {
                dataset = repository.requireDataset(binding.dataset(), binding.where());
                schema = repository.requireSchema(dataset.schema(), dataset.where());
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            Locations.check(dataset, pipeline.params(), diagnostics);
            StructType contract = SchemaCompiler.compile(schema, diagnostics);
            FieldSet fields = FieldSet.of(contract, "dataset " + dataset.name());
            byName.put(binding.alias(), fields);
            plans.add(new SourcePlan(binding.alias(), dataset, contract, fields, binding.where()));
        }
        return plans;
    }

    // ------------------------------------------------------------------ graph

    /** Resolves each step's transform and dependencies, dropping ones that cannot be read. */
    private List<StepSpec> resolveSteps(PipelineSpec pipeline,
                                        Set<String> sourceAliases,
                                        Map<String, List<InputRef>> dependencies,
                                        Map<String, Transform> stepTransforms,
                                        Diagnostics diagnostics) {
        Set<String> names = new LinkedHashSet<>(sourceAliases);
        List<StepSpec> usable = new ArrayList<>();

        for (StepSpec step : pipeline.steps()) {
            if (sourceAliases.contains(step.id())) {
                diagnostics.error("name-collision", step.where(),
                        "step '" + step.id() + "' has the same name as a source alias",
                        "rename one of them; every result in a pipeline needs a name of its own");
                continue;
            }
            Transform transform;
            try {
                transform = transforms.require(step.type(), step.where());
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            List<InputRef> inputs;
            try {
                inputs = transform.inputs(step);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            stepTransforms.put(step.id(), transform);
            dependencies.put(step.id(), inputs);
            names.add(step.id());
            usable.add(step);
        }

        // Reference checking happens once every name is known, so a step may
        // legally read one declared after it.
        for (StepSpec step : usable) {
            for (InputRef input : dependencies.get(step.id())) {
                if (!names.contains(input.name())) {
                    diagnostics.error("unknown-input", input.where(),
                            "step '" + step.id() + "' reads '" + input.name()
                                    + "', which is not a source or step in this pipeline",
                            Suggest.hint(input.name(), names));
                }
                if (input.name().equals(step.id())) {
                    diagnostics.error("self-reference", input.where(),
                            "step '" + step.id() + "' reads itself");
                }
            }
        }
        return usable;
    }

    /** Depth-first topological order, reporting the cycle when there is one. */
    private List<StepSpec> order(PipelineSpec pipeline,
                                 List<StepSpec> steps,
                                 Map<String, List<InputRef>> dependencies,
                                 Set<String> sourceAliases,
                                 Diagnostics diagnostics) {
        Map<String, StepSpec> byId = new LinkedHashMap<>();
        steps.forEach(step -> byId.put(step.id(), step));

        List<StepSpec> ordered = new ArrayList<>();
        Set<String> done = new LinkedHashSet<>();
        Set<String> onStack = new LinkedHashSet<>();
        Deque<String> path = new ArrayDeque<>();
        Set<String> reported = new LinkedHashSet<>();

        for (StepSpec step : steps) {
            visit(step.id(), byId, dependencies, sourceAliases, done, onStack, path, ordered,
                    reported, diagnostics);
        }
        return ordered;
    }

    private void visit(String id,
                       Map<String, StepSpec> byId,
                       Map<String, List<InputRef>> dependencies,
                       Set<String> sourceAliases,
                       Set<String> done,
                       Set<String> onStack,
                       Deque<String> path,
                       List<StepSpec> ordered,
                       Set<String> reported,
                       Diagnostics diagnostics) {
        if (done.contains(id) || sourceAliases.contains(id)) {
            return;
        }
        StepSpec step = byId.get(id);
        if (step == null) {
            return;
        }
        if (!onStack.add(id)) {
            if (reported.add(id)) {
                List<String> cycle = new ArrayList<>(path);
                java.util.Collections.reverse(cycle);
                int start = cycle.indexOf(id);
                List<String> loop = start < 0 ? cycle : cycle.subList(start, cycle.size());
                diagnostics.error("cycle", step.where(),
                        "these steps depend on each other in a loop: "
                                + String.join(" -> ", loop) + " -> " + id,
                        "a pipeline has to be a one-way graph; break the loop by splitting a step");
            }
            return;
        }
        path.push(id);
        for (InputRef input : dependencies.getOrDefault(id, List.of())) {
            visit(input.name(), byId, dependencies, sourceAliases, done, onStack, path, ordered,
                    reported, diagnostics);
        }
        path.pop();
        onStack.remove(id);
        done.add(id);
        ordered.add(step);
    }

    // ------------------------------------------------------------------ steps

    private List<StepPlan> planSteps(PipelineSpec pipeline,
                                     List<StepSpec> ordered,
                                     Map<String, List<InputRef>> dependencies,
                                     Map<String, Transform> stepTransforms,
                                     ParamResolver params,
                                     Map<String, FieldSet> byName,
                                     Diagnostics diagnostics) {
        List<StepPlan> plans = new ArrayList<>();
        for (StepSpec step : ordered) {
            List<InputRef> inputs = dependencies.get(step.id());
            Map<String, FieldSet> resolved = new LinkedHashMap<>();
            boolean ready = true;
            for (InputRef input : inputs) {
                FieldSet fields = byName.get(input.name());
                if (fields == null) {
                    // Its producer already failed and was reported; saying so
                    // again for every step downstream helps nobody.
                    ready = false;
                    break;
                }
                resolved.put(input.name(), fields);
            }
            if (!ready) {
                continue;
            }

            Transform transform = stepTransforms.get(step.id());
            PlanContext context = new PlanContext(pipeline, step, resolved, params, diagnostics);
            FieldSet output;
            try {
                output = transform.plan(context);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            if (output.isEmpty()) {
                continue;
            }
            byName.put(step.id(), output);
            plans.add(new StepPlan(step, transform,
                    inputs.stream().map(InputRef::name).toList(), output));
        }
        return plans;
    }

    // ----------------------------------------------------------- expectations

    private List<ExpectationSpec> planExpectations(PipelineSpec pipeline,
                                                   Map<String, FieldSet> byName,
                                                   Set<String> alreadyReported,
                                                   ParamResolver params,
                                                   Diagnostics diagnostics) {
        List<ExpectationSpec> planned = new ArrayList<>();
        for (ExpectationSpec spec : pipeline.expectations()) {
            FieldSet subject = byName.get(spec.on());
            if (subject == null) {
                if (alreadyReported.contains(spec.on())) {
                    continue;
                }
                diagnostics.error("unknown-target", spec.where(),
                        "expectation '" + spec.name() + "' is attached to '" + spec.on()
                                + "', which is not a source or step in this pipeline",
                        Suggest.hint(spec.on(), byName.keySet()));
                continue;
            }
            ExpectationRule rule;
            try {
                rule = rules.require(spec.rule(), spec.where());
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            if (spec.action() == ExpectationAction.QUARANTINE && rule instanceof DatasetRule) {
                diagnostics.error("cannot-quarantine", spec.where(),
                        "rule '" + spec.rule() + "' judges the dataset as a whole, so it has no"
                                + " offending rows to quarantine",
                        "use 'action: warn' or 'action: fail' for this rule");
                continue;
            }
            RuleContext context = new RuleContext(spec, subject, byName, params, diagnostics);
            try {
                rule.validate(context);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            planned.add(spec);
        }
        return planned;
    }

    private DatasetSpec planQuarantine(MetadataRepository repository, PipelineSpec pipeline,
                                       Diagnostics diagnostics) {
        if (pipeline.quarantine() == null) {
            return null;
        }
        DatasetSpec dataset;
        SchemaSpec schema;
        try {
            dataset = repository.requireDataset(pipeline.quarantine(), pipeline.where());
            schema = repository.requireSchema(dataset.schema(), dataset.where());
        } catch (MetadataException e) {
            diagnostics.addAll(e.diagnostics().all());
            return null;
        }
        StructType declared = SchemaCompiler.compile(schema, diagnostics);
        List<String> problems = Contracts.check(Quarantine.SCHEMA, declared,
                dev.foundry.metadata.model.Enforcement.STRICT);
        if (!problems.isEmpty()) {
            diagnostics.error("quarantine-schema", schema.where(),
                    "schema '" + schema.name() + "' cannot hold quarantined rows: " + problems.get(0),
                    "a quarantine schema declares exactly: " + Quarantine.schemaDescription());
        }
        return dataset;
    }

    // ------------------------------------------------------------------ sinks

    private List<SinkPlan> planSinks(MetadataRepository repository, PipelineSpec pipeline,
                                     Map<String, FieldSet> byName, Set<String> alreadyReported,
                                     Diagnostics diagnostics) {
        List<SinkPlan> plans = new ArrayList<>();
        for (SinkSpec sink : pipeline.sinks()) {
            FieldSet produced = byName.get(sink.from());
            if (produced == null) {
                if (alreadyReported.contains(sink.from())) {
                    continue;
                }
                diagnostics.error("unknown-target", sink.where(),
                        "sink writes '" + sink.from() + "', which is not a source or step in this pipeline",
                        Suggest.hint(sink.from(), byName.keySet()));
                continue;
            }
            DatasetSpec dataset;
            SchemaSpec schema;
            try {
                dataset = repository.requireDataset(sink.dataset(), sink.where());
                schema = repository.requireSchema(dataset.schema(), dataset.where());
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                continue;
            }
            Locations.check(dataset, pipeline.params(), diagnostics);
            StructType contract = SchemaCompiler.compile(schema, diagnostics);

            // The check that pays for this whole design: a step that cannot
            // satisfy the table it feeds is caught now, not after the load.
            Contracts.checkPlan(produced, contract, dataset.enforcement(), sink.where(),
                    "step '" + sink.from() + "'", diagnostics);

            WriteMode mode = sink.modeOverride().orElse(dataset.writeMode());
            plans.add(new SinkPlan(sink.from(), dataset, contract, mode, sink.where()));
        }
        return plans;
    }

    // --------------------------------------------------------------- warnings

    /** Steps nothing reads and nothing writes are almost always a leftover. */
    private void warnAboutDeadSteps(PipelineSpec pipeline, List<StepPlan> steps, List<SinkPlan> sinks,
                                    List<ExpectationSpec> expectations, Diagnostics diagnostics) {
        Set<String> used = new LinkedHashSet<>();
        steps.forEach(step -> used.addAll(step.inputs()));
        sinks.forEach(sink -> used.add(sink.from()));
        expectations.forEach(expectation -> used.add(expectation.on()));

        for (StepPlan step : steps) {
            if (!used.contains(step.id())) {
                diagnostics.warning("unused-step", step.where(),
                        "nothing reads step '" + step.id() + "' and nothing writes it",
                        "delete it, or add a sink or an expectation that uses it");
            }
        }
        for (SourceBinding source : pipeline.sources()) {
            if (!used.contains(source.alias())) {
                diagnostics.warning("unused-source", source.where(),
                        "nothing reads source '" + source.alias() + "'");
            }
        }
    }
}
