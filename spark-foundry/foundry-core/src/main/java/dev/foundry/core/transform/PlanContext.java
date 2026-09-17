package dev.foundry.core.transform;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.PipelineSpec;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Everything a transform needs in order to plan one step. */
public final class PlanContext {

    private final PipelineSpec pipeline;
    private final StepSpec step;
    private final Map<String, FieldSet> inputs;
    private final ParamResolver params;
    private final Diagnostics diagnostics;

    public PlanContext(PipelineSpec pipeline,
                       StepSpec step,
                       Map<String, FieldSet> inputs,
                       ParamResolver params,
                       Diagnostics diagnostics) {
        this.pipeline = pipeline;
        this.step = step;
        this.inputs = new LinkedHashMap<>(inputs);
        this.params = params;
        this.diagnostics = diagnostics;
    }

    public PipelineSpec pipeline() {
        return pipeline;
    }

    public StepSpec step() {
        return step;
    }

    public String stepId() {
        return step.id();
    }

    public YamlNode config() {
        return step.config();
    }

    public SourceRef where() {
        return step.where();
    }

    public Diagnostics diagnostics() {
        return diagnostics;
    }

    public ParamResolver params() {
        return params;
    }

    /** The resolved inputs, keyed by the name the step used. */
    public Map<String, FieldSet> inputs() {
        return Map.copyOf(inputs);
    }

    public Set<String> inputNames() {
        return inputs.keySet();
    }

    /**
     * The columns arriving from one named input. The planner has already
     * resolved every name a transform reported, so an unknown one here is a bug
     * in the transform rather than in the metadata.
     */
    public FieldSet input(String name) {
        FieldSet fields = inputs.get(name);
        if (fields == null) {
            throw new IllegalStateException("step '" + step.id() + "' asked for input '" + name
                    + "', which it never declared as a dependency");
        }
        return fields;
    }

    /** Substitutes pipeline parameters into an expression. */
    public String resolve(String expression, SourceRef where) {
        return params.inExpression(expression, where);
    }

    // -------------------------------------------------------------- reporting

    /** Prefix used so a message reads "step 'x' (type y): ...". */
    public String describeStep() {
        return "step '" + step.id() + "' (" + step.type() + ")";
    }

    /**
     * {@code what}, prefixed with the step it belongs to.
     *
     * <p>Used for the diagnostics the expression analyser raises directly. A line
     * number alone tells you where to look; the step name tells you what you were
     * looking at, which is what someone reading a hundred-line report needs.
     */
    public String describe(String what) {
        return describeStep() + ": " + what;
    }

    public void error(String code, SourceRef where, String message) {
        diagnostics.error(code, where, describeStep() + ": " + message);
    }

    public void error(String code, SourceRef where, String message, String hint) {
        diagnostics.error(code, where, describeStep() + ": " + message, hint);
    }

    public void warning(String code, SourceRef where, String message) {
        diagnostics.warning(code, where, describeStep() + ": " + message);
    }

    public void warning(String code, SourceRef where, String message, String hint) {
        diagnostics.warning(code, where, describeStep() + ": " + message, hint);
    }
}
