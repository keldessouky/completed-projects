package dev.foundry.core.param;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.ParamSpec;
import dev.foundry.metadata.model.PipelineSpec;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Substitutes a pipeline's parameters into expressions and dataset locations.
 *
 * <p>The same resolver serves planning and running. Planning uses stand-in
 * values so that every expression can still be parsed and checked with nothing
 * supplied; running uses the caller's real arguments. Because both go through
 * the same code path, a pipeline that plans cleanly is a pipeline whose
 * expressions will parse when it runs.
 */
public final class ParamResolver {

    private final Map<String, ParamSpec> declared = new LinkedHashMap<>();
    private final Map<String, String> values;
    private final boolean planning;

    private ParamResolver(PipelineSpec pipeline, Map<String, String> values, boolean planning) {
        for (ParamSpec spec : pipeline.params()) {
            declared.put(spec.name(), spec);
        }
        this.values = Map.copyOf(values);
        this.planning = planning;
    }

    /** A resolver that fills every parameter with a stand-in of the right type. */
    public static ParamResolver forPlanning(PipelineSpec pipeline) {
        return new ParamResolver(pipeline, Map.of(), true);
    }

    /** A resolver over real, already-bound values. */
    public static ParamResolver forRun(PipelineSpec pipeline, Map<String, String> values) {
        return new ParamResolver(pipeline, values, false);
    }

    /** Substitutes parameters as SQL literals, for embedding in an expression. */
    public String inExpression(String text, SourceRef where) {
        return Params.substitute(text, name -> {
            ParamSpec spec = require(name, where);
            return Params.sqlLiteral(spec.type(), valueOf(spec), where, name);
        });
    }

    /** Substitutes parameters as plain text, for embedding in a path. */
    public String inText(String text, SourceRef where) {
        return Params.substitute(text, name -> valueOf(require(name, where)));
    }

    /** The bound values, as recorded in the run manifest. */
    public Map<String, String> values() {
        return values;
    }

    public boolean isPlanning() {
        return planning;
    }

    private ParamSpec require(String name, SourceRef where) {
        ParamSpec spec = declared.get(name);
        if (spec == null) {
            throw new MetadataException(Diagnostic.error("unknown-parameter", where,
                    "no parameter named '" + name + "'",
                    declared.isEmpty() ? "this pipeline declares no parameters"
                            : "declared: " + String.join(", ", declared.keySet())));
        }
        return spec;
    }

    private String valueOf(ParamSpec spec) {
        String value = values.get(spec.name());
        if (value != null) {
            return value;
        }
        if (spec.defaultValue() != null) {
            return spec.defaultValue();
        }
        if (planning) {
            return Params.placeholderValue(spec.type());
        }
        throw new MetadataException(Diagnostic.error("missing-parameter", spec.where(),
                "parameter '" + spec.name() + "' has no value",
                "pass it with --param " + spec.name() + "=<value>"));
    }
}
