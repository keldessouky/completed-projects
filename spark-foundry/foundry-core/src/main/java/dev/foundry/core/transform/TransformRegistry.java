package dev.foundry.core.transform;

import dev.foundry.core.transform.builtin.AggregateTransform;
import dev.foundry.core.transform.builtin.CastTransform;
import dev.foundry.core.transform.builtin.DeduplicateTransform;
import dev.foundry.core.transform.builtin.DeriveTransform;
import dev.foundry.core.transform.builtin.DistinctTransform;
import dev.foundry.core.transform.builtin.DropTransform;
import dev.foundry.core.transform.builtin.FilterTransform;
import dev.foundry.core.transform.builtin.JoinTransform;
import dev.foundry.core.transform.builtin.RenameTransform;
import dev.foundry.core.transform.builtin.SelectTransform;
import dev.foundry.core.transform.builtin.SqlTransform;
import dev.foundry.core.transform.builtin.UnionTransform;
import dev.foundry.core.transform.builtin.WindowTransform;
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

/**
 * The transforms a pipeline may use, looked up by the name in {@code type:}.
 *
 * <p>The built-in set is registered here, and a registry can be extended with
 * project-specific transforms without touching anything else - the loader never
 * knew what a transform was, and the planner only knows the {@link Transform}
 * interface.
 */
public final class TransformRegistry {

    private final Map<String, Transform> transforms = new LinkedHashMap<>();

    private TransformRegistry() {
    }

    /** The transforms that ship with the framework. */
    public static TransformRegistry builtIn() {
        TransformRegistry registry = new TransformRegistry();
        List<Transform> builtIn = List.of(
                new SelectTransform(),
                new DeriveTransform(),
                new FilterTransform(),
                new RenameTransform(),
                new DropTransform(),
                new CastTransform(),
                new JoinTransform(),
                new UnionTransform(),
                new AggregateTransform(),
                new DistinctTransform(),
                new DeduplicateTransform(),
                new WindowTransform(),
                new SqlTransform());
        builtIn.forEach(registry::register);
        return registry;
    }

    /** Adds a transform, or replaces one of the same name. */
    public TransformRegistry register(Transform transform) {
        transforms.put(transform.type(), transform);
        return this;
    }

    public Optional<Transform> find(String type) {
        return Optional.ofNullable(transforms.get(type));
    }

    /** Looks up a transform, or throws a diagnostic naming the nearest match. */
    public Transform require(String type, SourceRef where) {
        Transform transform = transforms.get(type);
        if (transform == null) {
            throw new MetadataException(Diagnostic.error("unknown-transform", where,
                    "no transform called '" + type + "'", Suggest.hint(type, transforms.keySet())));
        }
        return transform;
    }

    public Set<String> types() {
        return transforms.keySet();
    }

    public Collection<Transform> all() {
        return transforms.values();
    }
}
