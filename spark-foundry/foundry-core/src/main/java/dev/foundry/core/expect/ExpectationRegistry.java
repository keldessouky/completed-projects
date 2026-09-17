package dev.foundry.core.expect;

import dev.foundry.core.expect.builtin.AcceptedValuesRule;
import dev.foundry.core.expect.builtin.ExpressionRule;
import dev.foundry.core.expect.builtin.NotNullRule;
import dev.foundry.core.expect.builtin.RangeRule;
import dev.foundry.core.expect.builtin.ReferentialRule;
import dev.foundry.core.expect.builtin.RegexRule;
import dev.foundry.core.expect.builtin.RowCountRule;
import dev.foundry.core.expect.builtin.UniqueRule;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** The quality rules a pipeline may use, looked up by the name in {@code rule:}. */
public final class ExpectationRegistry {

    private final Map<String, ExpectationRule> rules = new LinkedHashMap<>();

    private ExpectationRegistry() {
    }

    /** The rules that ship with the framework. */
    public static ExpectationRegistry builtIn() {
        ExpectationRegistry registry = new ExpectationRegistry();
        List<ExpectationRule> builtIn = List.of(
                new NotNullRule(),
                new UniqueRule(),
                new AcceptedValuesRule(),
                new RangeRule(),
                new RegexRule(),
                new ExpressionRule(),
                new RowCountRule(),
                new ReferentialRule());
        builtIn.forEach(registry::register);
        return registry;
    }

    public ExpectationRegistry register(ExpectationRule rule) {
        rules.put(rule.name(), rule);
        return this;
    }

    public Optional<ExpectationRule> find(String name) {
        return Optional.ofNullable(rules.get(name));
    }

    public ExpectationRule require(String name, SourceRef where) {
        ExpectationRule rule = rules.get(name);
        if (rule == null) {
            throw new MetadataException(Diagnostic.error("unknown-rule", where,
                    "no quality rule called '" + name + "'", Suggest.hint(name, rules.keySet())));
        }
        return rule;
    }

    public Set<String> names() {
        return rules.keySet();
    }

    public Collection<ExpectationRule> all() {
        return rules.values();
    }
}
