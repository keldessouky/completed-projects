package dev.foundry.metadata;

import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.Enforcement;
import dev.foundry.metadata.model.ExpectationAction;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.model.FieldSpec;
import dev.foundry.metadata.model.ParamSpec;
import dev.foundry.metadata.model.ParamType;
import dev.foundry.metadata.model.PipelineSpec;
import dev.foundry.metadata.model.SchemaSpec;
import dev.foundry.metadata.model.SinkSpec;
import dev.foundry.metadata.model.SourceBinding;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.model.WriteMode;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Turns a composed YAML document into a model record.
 *
 * <p>Each loader method reports into a {@link Diagnostics} and keeps going past
 * a bad element where the rest of the document still makes sense - one broken
 * field should not hide the other nine. An element that cannot be built at all
 * is skipped, and its diagnostic explains why.
 */
public final class MetadataLoader {

    /** The document kinds this loader understands, for the "unknown kind" hint. */
    public static final Set<String> KINDS = new LinkedHashSet<>(List.of("schema", "dataset", "pipeline"));

    private static final Set<String> SCHEMA_KEYS = Set.of("kind", "name", "version", "description", "fields");
    private static final Set<String> FIELD_KEYS = Set.of("name", "type", "nullable", "description", "tags");
    private static final Set<String> DATASET_KEYS = Set.of("kind", "name", "schema", "format", "location",
            "options", "partitionBy", "enforcement", "writeMode", "description");
    private static final Set<String> PIPELINE_KEYS = Set.of("kind", "name", "description", "quarantine",
            "params", "sources", "steps", "expectations", "sinks");
    private static final Set<String> PARAM_KEYS = Set.of("name", "type", "required", "default", "description");
    private static final Set<String> SOURCE_KEYS = Set.of("alias", "dataset", "description");
    private static final Set<String> SINK_KEYS = Set.of("from", "dataset", "mode", "description");

    private final Diagnostics diagnostics;

    public MetadataLoader(Diagnostics diagnostics) {
        this.diagnostics = diagnostics;
    }

    /** The {@code kind:} of a document, or empty (with a diagnostic) if unusable. */
    public String kindOf(YamlNode document) {
        document.requireMapping();
        String kind = document.str("kind", null);
        if (kind == null) {
            diagnostics.error("missing-kind", document.where(),
                    "every metadata document needs a 'kind'",
                    "one of: " + String.join(", ", KINDS));
            return null;
        }
        if (!KINDS.contains(kind)) {
            diagnostics.error("unknown-kind", document.required("kind").where(),
                    "unknown kind '" + kind + "'", Suggest.hint(kind, KINDS));
            return null;
        }
        return kind;
    }

    // ---------------------------------------------------------------- schemas

    public SchemaSpec schema(YamlNode document) {
        document.requireMapping();
        diagnostics.addAll(document.unknownKeys(SCHEMA_KEYS));
        String name = document.qualifiedName("name");
        int version = document.intValue("version", 1);
        String description = document.str("description", null);

        List<FieldSpec> fields = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        List<YamlNode> fieldNodes = document.list("fields");
        if (fieldNodes.isEmpty()) {
            diagnostics.error("empty-schema", document.where(),
                    "schema '" + name + "' declares no fields");
        }
        for (YamlNode node : fieldNodes) {
            try {
                FieldSpec field = field(node);
                if (!seen.add(field.name())) {
                    diagnostics.error("duplicate-field", field.where(),
                            "schema '" + name + "' declares column '" + field.name() + "' twice");
                    continue;
                }
                fields.add(field);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
            }
        }
        return new SchemaSpec(name, version, description, fields, document.where());
    }

    private FieldSpec field(YamlNode node) {
        node.requireMapping();
        diagnostics.addAll(node.unknownKeys(FIELD_KEYS));
        String name = node.identifier("name");
        String type = node.str("type");
        boolean nullable = node.bool("nullable", true);
        String description = node.str("description", null);
        return new FieldSpec(name, type, nullable, description, node.strings("tags"), node.where());
    }

    // --------------------------------------------------------------- datasets

    public DatasetSpec dataset(YamlNode document) {
        document.requireMapping();
        diagnostics.addAll(document.unknownKeys(DATASET_KEYS));
        String name = document.identifier("name");
        String schema = document.str("schema");
        String format = document.str("format");
        String location = document.str("location");
        Enforcement enforcement = document.enumValue("enforcement", Enforcement.class, Enforcement.STRICT);
        WriteMode writeMode = document.enumValue("writeMode", WriteMode.class, WriteMode.OVERWRITE);
        return new DatasetSpec(name, schema, format, location,
                document.stringMap("options"), document.strings("partitionBy"),
                enforcement, writeMode, document.str("description", null), document.where());
    }

    // -------------------------------------------------------------- pipelines

    public PipelineSpec pipeline(YamlNode document) {
        document.requireMapping();
        diagnostics.addAll(document.unknownKeys(PIPELINE_KEYS));
        String name = document.identifier("name");
        String description = document.str("description", null);
        String quarantine = document.str("quarantine", null);

        List<ParamSpec> params = collect(document.list("params"), this::param, "param");
        List<SourceBinding> sources = collect(document.list("sources"), this::source, "source");
        List<StepSpec> steps = collect(document.list("steps"), this::step, "step");
        List<ExpectationSpec> expectations =
                collect(document.list("expectations"), this::expectation, "expectation");
        List<SinkSpec> sinks = collect(document.list("sinks"), this::sink, "sink");

        rejectDuplicates(params, ParamSpec::name, ParamSpec::where, "duplicate-param",
                "pipeline '" + name + "' declares parameter");
        rejectDuplicates(sources, SourceBinding::alias, SourceBinding::where, "duplicate-source",
                "pipeline '" + name + "' binds source alias");
        rejectDuplicates(steps, StepSpec::id, StepSpec::where, "duplicate-step",
                "pipeline '" + name + "' declares step");
        rejectDuplicates(expectations, ExpectationSpec::name, ExpectationSpec::where, "duplicate-expectation",
                "pipeline '" + name + "' declares expectation");

        if (steps.isEmpty()) {
            diagnostics.error("empty-pipeline", document.where(),
                    "pipeline '" + name + "' declares no steps");
        }
        if (sinks.isEmpty()) {
            diagnostics.warning("no-sinks", document.where(),
                    "pipeline '" + name + "' writes nothing",
                    "add a 'sinks:' entry, or this pipeline only proves its inputs parse");
        }
        return new PipelineSpec(name, description, params, sources, steps, expectations, sinks,
                quarantine, document.where());
    }

    private ParamSpec param(YamlNode node) {
        node.requireMapping();
        diagnostics.addAll(node.unknownKeys(PARAM_KEYS));
        String name = node.identifier("name");
        ParamType type = node.enumValue("type", ParamType.class, ParamType.STRING);
        String defaultValue = node.str("default", null);
        boolean required = node.bool("required", defaultValue == null);
        if (required && defaultValue != null) {
            diagnostics.warning("redundant-default", node.where(),
                    "parameter '" + name + "' is required, so its default can never apply");
        }
        return new ParamSpec(name, type, required, defaultValue, node.str("description", null), node.where());
    }

    private SourceBinding source(YamlNode node) {
        node.requireMapping();
        diagnostics.addAll(node.unknownKeys(SOURCE_KEYS));
        return new SourceBinding(node.identifier("alias"), node.str("dataset"), node.where());
    }

    private StepSpec step(YamlNode node) {
        node.requireMapping();
        String id = node.identifier("id");
        String type = node.str("type");
        // The remaining keys belong to the transform, which validates them when
        // the planner resolves this step. Nothing is checked here.
        return new StepSpec(id, type, node.str("description", null), node, node.where());
    }

    private ExpectationSpec expectation(YamlNode node) {
        node.requireMapping();
        String on = node.identifier("on");
        String rule = node.str("rule");
        ExpectationAction action = node.enumValue("action", ExpectationAction.class, ExpectationAction.FAIL);
        String name = node.str("name", rule + "_on_" + on);
        return new ExpectationSpec(name, on, rule, action, node, node.where());
    }

    private SinkSpec sink(YamlNode node) {
        node.requireMapping();
        diagnostics.addAll(node.unknownKeys(SINK_KEYS));
        WriteMode mode = node.has("mode") ? node.enumValue("mode", WriteMode.class, null) : null;
        return new SinkSpec(node.identifier("from"), node.str("dataset"), mode, node.where());
    }

    // ---------------------------------------------------------------- helpers

    /** Builds each element, recording and skipping the ones that fail. */
    private <T> List<T> collect(List<YamlNode> nodes, java.util.function.Function<YamlNode, T> build, String what) {
        List<T> out = new ArrayList<>(nodes.size());
        for (YamlNode node : nodes) {
            try {
                out.add(build.apply(node));
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
                diagnostics.warning("skipped-element", node.where(),
                        "this " + what + " was skipped because it could not be read");
            }
        }
        return out;
    }

    private <T> void rejectDuplicates(List<T> items,
                                      java.util.function.Function<T, String> key,
                                      java.util.function.Function<T, SourceRef> position,
                                      String code,
                                      String prefix) {
        Set<String> seen = new LinkedHashSet<>();
        for (T item : items) {
            String k = key.apply(item);
            if (!seen.add(k)) {
                diagnostics.error(code, position.apply(item), prefix + " '" + k + "' twice");
            }
        }
    }
}
