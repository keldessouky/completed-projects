package dev.foundry.core.expect;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.Map;
import java.util.Set;

/** What a rule needs in order to check its own configuration, before any data. */
public final class RuleContext {

    private final ExpectationSpec spec;
    private final FieldSet subject;
    private final Map<String, FieldSet> available;
    private final ParamResolver params;
    private final Diagnostics diagnostics;

    public RuleContext(ExpectationSpec spec,
                       FieldSet subject,
                       Map<String, FieldSet> available,
                       ParamResolver params,
                       Diagnostics diagnostics) {
        this.spec = spec;
        this.subject = subject;
        this.available = Map.copyOf(available);
        this.params = params;
        this.diagnostics = diagnostics;
    }

    public ExpectationSpec spec() {
        return spec;
    }

    public YamlNode config() {
        return spec.config();
    }

    public SourceRef where() {
        return spec.where();
    }

    /** The columns of the step this expectation is attached to. */
    public FieldSet subject() {
        return subject;
    }

    /** Every named result in the pipeline, for rules that refer to another one. */
    public Map<String, FieldSet> available() {
        return available;
    }

    public Set<String> availableNames() {
        return available.keySet();
    }

    public ParamResolver params() {
        return params;
    }

    public Diagnostics diagnostics() {
        return diagnostics;
    }

    public String describe() {
        return "expectation '" + spec.name() + "' (" + spec.rule() + " on " + spec.on() + ")";
    }

    public void error(String code, SourceRef where, String message) {
        diagnostics.error(code, where, describe() + ": " + message);
    }

    public void error(String code, SourceRef where, String message, String hint) {
        diagnostics.error(code, where, describe() + ": " + message, hint);
    }

    public void warning(String code, SourceRef where, String message) {
        diagnostics.warning(code, where, describe() + ": " + message);
    }
}
