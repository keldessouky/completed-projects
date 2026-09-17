package dev.foundry.core.plan;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Column-level lineage, folded out of what each transform reported.
 *
 * <p>Every transform says only which of its immediate inputs' columns each of
 * its outputs reads - a single hop, which is the only thing a transform can
 * honestly know. Walking those hops back to the pipeline's sources gives the
 * question people actually ask: this number in this report, where does it come
 * from?
 *
 * <p>Because it is derived from the same code that plans and runs each step,
 * this lineage cannot drift from what the pipeline does, the way a separately
 * maintained diagram always eventually does.
 */
public final class Lineage {

    private final Map<String, FieldSet> byName;
    private final Set<String> sources;
    private final Map<String, Set<String>> cache = new LinkedHashMap<>();

    Lineage(Map<String, FieldSet> byName, Set<String> sources) {
        this.byName = Map.copyOf(byName);
        this.sources = Set.copyOf(sources);
    }

    /**
     * The source columns one column ultimately derives from, each as
     * {@code <source alias>.<column>}.
     */
    public Set<String> sourcesOf(String node, String column) {
        return resolve(node + "." + column, new ArrayDeque<>());
    }

    /** Source columns for every column of one step, in column order. */
    public Map<String, Set<String>> sourcesOf(String node) {
        Map<String, Set<String>> out = new LinkedHashMap<>();
        FieldSet fields = byName.get(node);
        if (fields == null) {
            return out;
        }
        for (PlanField field : fields.fields()) {
            out.put(field.name(), sourcesOf(node, field.name()));
        }
        return out;
    }

    private Set<String> resolve(String reference, Deque<String> visiting) {
        Set<String> cached = cache.get(reference);
        if (cached != null) {
            return cached;
        }
        // A pipeline's graph is acyclic by the time lineage is computed, but a
        // guard costs nothing and turns a hang into a sensible answer.
        if (visiting.contains(reference)) {
            return Set.of();
        }

        int dot = reference.lastIndexOf('.');
        String node = reference.substring(0, dot);
        String column = reference.substring(dot + 1);

        if (sources.contains(node)) {
            Set<String> result = Set.of(reference);
            cache.put(reference, result);
            return result;
        }

        FieldSet fields = byName.get(node);
        if (fields == null) {
            return Set.of();
        }
        PlanField field = fields.get(column).orElse(null);
        if (field == null) {
            return Set.of();
        }
        if (field.derivedFrom().isEmpty()) {
            // A column conjured from a literal has no upstream column at all.
            Set<String> result = Set.of();
            cache.put(reference, result);
            return result;
        }

        visiting.push(reference);
        Set<String> result = new LinkedHashSet<>();
        for (String upstream : field.derivedFrom()) {
            result.addAll(resolve(upstream, visiting));
        }
        visiting.pop();

        Set<String> immutable = Set.copyOf(result);
        cache.put(reference, immutable);
        return immutable;
    }
}
