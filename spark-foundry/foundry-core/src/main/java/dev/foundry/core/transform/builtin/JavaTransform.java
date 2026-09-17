package dev.foundry.core.transform.builtin;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;
import dev.foundry.core.plugin.TransformClasses;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.DeclaredOutputs;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Runs a transformation written in Java.
 *
 * <pre>{@code
 * - id: scored
 *   type: java
 *   class: com.acme.RiskScore
 *   from: priced_lines
 *   options:
 *     threshold: "0.80"
 *   schema: retail.orders.scored
 * }</pre>
 *
 * <p>This is the answer to work that does not belong in YAML: branching business
 * rules, a scoring model, a call into a library, anything with enough substance
 * to want unit tests of its own. The class implements
 * {@link DataTransform} - one method, in and out - and depends on
 * {@code foundry-api} and Spark, nothing else.
 *
 * <p>What stays in the metadata is the contract: which inputs the step reads,
 * what options it is configured with, and what columns and types it promises to
 * produce. The class is then checked against that promise at run time like any
 * other step. That division is the whole point - the framework cannot read Java
 * to work out what a class returns, so if the class were the only statement of
 * its own output then the sink's contract check, the static column checking of
 * everything downstream and the column lineage would all stop working at this
 * step. Declaring the shape keeps them working, and keeps the data's shape
 * reviewable without reading the implementation.
 *
 * <p>The class is resolved while planning, so a renamed or mistyped class is
 * caught by {@code foundry validate} rather than by a nightly load.
 */
public final class JavaTransform implements Transform {

    private static final Set<String> KEYS = Set.of("class", "from", "inputs", "options");

    private final ClassLoader loader;

    /** Resolves classes against the framework's own class loader. */
    public JavaTransform() {
        this(JavaTransform.class.getClassLoader());
    }

    /** Resolves classes against a loader that can also see the project's jars. */
    public JavaTransform(ClassLoader loader) {
        this.loader = loader;
    }

    @Override
    public String type() {
        return "java";
    }

    @Override
    public String summary() {
        return "Run a transformation written in Java, against the output contract the step declares.";
    }

    @Override
    public Set<String> configKeys() {
        Set<String> keys = new LinkedHashSet<>(KEYS);
        keys.addAll(DeclaredOutputs.CONFIG_KEYS);
        return keys;
    }

    /** The class, because that is what a reader of this step needs to know. */
    @Override
    public java.util.Optional<String> describeStep(StepSpec step) {
        return step.config().optional("class").map(YamlNode::asString);
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        boolean single = step.config().has("from");
        boolean several = step.config().has("inputs");
        if (single && several) {
            throw new MetadataException(Diagnostic.error("conflicting-inputs", step.where(),
                    "a java step reads either 'from:' one input or 'inputs:' several, not both"));
        }
        if (single) {
            return Transforms.singleInput(step, "from");
        }
        if (several) {
            return Transforms.listInput(step, "inputs");
        }
        throw new MetadataException(Diagnostic.error("missing-key", step.where(),
                "a java step must say what it reads",
                "add 'from: <step>' for one input, or 'inputs: [<step>, ...]' for several"));
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        YamlNode classNode = context.config().required("class");

        DataTransform transform;
        try {
            transform = TransformClasses.instantiate(classNode.asString(), loader, classNode.where());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
            // Without the class there is nothing to check the options against,
            // but the declared contract is still worth validating on its own.
            return DeclaredOutputs.parse(context, "a java step");
        }

        checkRequiredOptions(context, transform, classNode.asString());
        checkOptionParameters(context);
        return DeclaredOutputs.parse(context, "a java step");
    }

    /**
     * Points at the option the step did set, when one looks like a misspelling.
     *
     * <p>The suggestion runs the opposite way round from most: the required name
     * is the authority, so what is offered is the step's own key that looks like
     * it was meant to be that one.
     */
    private static String hintForMissingOption(String required, Set<String> present) {
        if (present.isEmpty()) {
            return "add an 'options:' block setting it";
        }
        return Suggest.closest(required, present)
                .map(found -> "this step sets '" + found + "' - is that a misspelling of it?")
                .orElse("options set here: " + String.join(", ", present));
    }

    /**
     * Options may carry {@code ${parameters}}, so one class can score strictly in
     * one pipeline and leniently in another without a recompile. A placeholder
     * the pipeline does not declare is caught here.
     */
    private void checkOptionParameters(PlanContext context) {
        if (!context.config().has("options")) {
            return;
        }
        YamlNode options = context.config().required("options");
        for (String key : options.keys()) {
            dev.foundry.core.param.Params.checkPlaceholders(options.required(key).asString(),
                    options.required(key).where(), context.pipeline().params(),
                    "option '" + key + "'", context.diagnostics());
        }
    }

    /**
     * Holds the class to the options it says it needs.
     *
     * <p>A transform that declares {@code requiredOptions()} gets them checked
     * here, while validating, rather than throwing out of {@code apply} after
     * forty minutes of upstream work.
     */
    private void checkRequiredOptions(PlanContext context, DataTransform transform, String className) {
        Map<String, String> declared = context.config().stringMap("options");
        for (String required : transform.requiredOptions()) {
            if (!declared.containsKey(required)) {
                context.error("missing-option", context.where(),
                        "'" + className + "' needs the option '" + required + "', which this step"
                                + " does not set",
                        hintForMissingOption(required, declared.keySet()));
            }
        }
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        YamlNode classNode = context.config().required("class");
        DataTransform transform =
                TransformClasses.instantiate(classNode.asString(), loader, classNode.where());

        TransformInput input = TransformInput.builder()
                .stepId(context.step().id())
                .inputs(context.inputs())
                .params(context.params().values())
                .options(resolveOptions(context))
                .spark(context.spark())
                .build();

        Dataset<Row> result = transform.apply(input);
        if (result == null) {
            throw new IllegalStateException("step '" + context.step().id() + "': "
                    + classNode.asString() + " returned null rather than a Dataset");
        }

        // Selecting the declared columns puts a custom transform under the same
        // contract as every built-in one: declared order, declared types. Any
        // disagreement beyond that - a missing column, a surprise column - is
        // caught by the runner's plan check, which names the class.
        return conform(result, context);
    }

    /** The step's options, with any {@code ${parameter}} filled in. */
    private Map<String, String> resolveOptions(ExecContext context) {
        Map<String, String> declared = context.config().stringMap("options");
        Map<String, String> resolved = new java.util.LinkedHashMap<>();
        declared.forEach((key, value) ->
                resolved.put(key, context.params().inText(value, context.where())));
        return resolved;
    }

    private Dataset<Row> conform(Dataset<Row> result, ExecContext context) {
        Set<String> produced = new LinkedHashSet<>(List.of(result.columns()));
        List<Column> columns = new ArrayList<>();
        for (var field : context.planned().fields()) {
            if (!produced.contains(field.name())) {
                // Let the plan check report this: it knows the whole picture and
                // says so in one message rather than one column at a time.
                return result;
            }
            Column column = functions.col(field.name());
            columns.add(field.typeKnown() ? column.cast(field.type()).as(field.name()) : column);
        }
        return result.select(columns.toArray(new Column[0]));
    }
}
