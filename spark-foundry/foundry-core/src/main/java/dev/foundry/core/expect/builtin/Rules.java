package dev.foundry.core.expect.builtin;

import dev.foundry.core.expect.RuleContext;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.ExpectationSpec;
import dev.foundry.metadata.yaml.YamlNode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Configuration parsing shared by the built-in rules. */
final class Rules {

    private Rules() {
    }

    /** Reports any configuration key the rule does not understand. */
    static void checkKeys(RuleContext context, Set<String> configKeys) {
        Set<String> allowed = new LinkedHashSet<>(configKeys);
        allowed.addAll(ExpectationSpec.RESERVED_KEYS);
        context.diagnostics().addAll(context.config().unknownKeys(allowed));
    }

    /** A list of column names, each checked against the subject's columns. */
    static List<String> columns(RuleContext context, String key) {
        List<String> out = new ArrayList<>();
        YamlNode config = context.config();
        if (!config.has(key)) {
            context.error("missing-key", context.where(), "'" + key + "' is required");
            return out;
        }
        YamlNode node = config.required(key);
        for (YamlNode item : node.isScalar() ? List.of(node) : node.asList()) {
            String name = item.asString();
            if (!context.subject().has(name)) {
                context.error("unknown-column", item.where(),
                        "column '" + name + "' is not produced by '" + context.spec().on() + "'",
                        Suggest.hint(name, context.subject().names()));
                continue;
            }
            out.add(name);
        }
        if (out.isEmpty() && !node.isScalar() && node.asList().isEmpty()) {
            context.error("missing-key", node.where(), "'" + key + "' must name at least one column");
        }
        return out;
    }

    /** A single column name, checked against the subject's columns. */
    static String column(RuleContext context) {
        YamlNode node = context.config().required("column");
        String name = node.asString();
        if (!context.subject().has(name)) {
            context.error("unknown-column", node.where(),
                    "column '" + name + "' is not produced by '" + context.spec().on() + "'",
                    Suggest.hint(name, context.subject().names()));
        }
        return name;
    }

    /** Names the rule's working columns consistently so the engine can strip them. */
    static String working(String suffix) {
        return "__foundry_" + suffix;
    }
}
