package dev.foundry.core.schema;

import org.apache.spark.sql.types.DataType;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * One column as the planner understands it, before any data has been touched.
 *
 * <p>The type is optional, and that is the honest part of this design. A column
 * read from a declared schema, or written with an explicit {@code type:}, has a
 * type the planner knows for certain. A column computed by an expression like
 * {@code sum(quantity * unit_price)} does not: working out that it is
 * {@code decimal(22,2)} means running Spark's analyser, which means a session.
 *
 * <p>So the planner records what it knows and admits what it does not, rather
 * than guessing. Everything it does claim, the runner then checks against the
 * schema Spark actually produced - see {@link FieldSet#verify}. An author who
 * wants certainty writes the type down, and the transform casts to it.
 *
 * @param origin      a short human phrase for how this column came to be, shown
 *                    by {@code foundry plan}
 * @param derivedFrom the columns of this step's <em>immediate</em> inputs that
 *                    this column reads, each as {@code <input>.<column>}. The
 *                    planner folds these into end-to-end lineage, which is why
 *                    each transform only has to report one hop.
 */
public record PlanField(String name, DataType type, boolean nullable, String origin, Set<String> derivedFrom) {

    public PlanField {
        Objects.requireNonNull(name, "name");
        derivedFrom = derivedFrom == null ? Set.of() : new LinkedHashSet<>(derivedFrom);
    }

    public static PlanField known(String name, DataType type, boolean nullable, String origin) {
        return new PlanField(name, Objects.requireNonNull(type, "type"), nullable, origin, Set.of());
    }

    /** A column whose type only Spark can settle, at run time. */
    public static PlanField inferred(String name, String origin) {
        return new PlanField(name, null, true, origin, Set.of());
    }

    /**
     * The same column, arriving unchanged from {@code input}.
     *
     * <p>The origin is re-pointed at the input rather than kept, so a plan reads
     * as one hop per step: a filter's {@code order_id} says it came from the step
     * before it, not from the expression that first computed it five steps back.
     * The full chain is still recoverable - that is what {@code derivedFrom} and
     * {@link dev.foundry.core.plan.Lineage} are for.
     */
    public PlanField carriedFrom(String input) {
        String reference = input + "." + name;
        return new PlanField(name, type, nullable, reference, Set.of(reference));
    }

    public PlanField from(Set<String> sources) {
        return new PlanField(name, type, nullable, origin, sources);
    }

    public Optional<DataType> declaredType() {
        return Optional.ofNullable(type);
    }

    public boolean typeKnown() {
        return type != null;
    }

    public String typeName() {
        return type == null ? "inferred" : type.simpleString();
    }

    public PlanField renamedTo(String newName) {
        return new PlanField(newName, type, nullable, origin, derivedFrom);
    }

    public PlanField withOrigin(String newOrigin) {
        return new PlanField(name, type, nullable, newOrigin, derivedFrom);
    }

    public PlanField withType(DataType newType) {
        return new PlanField(name, newType, nullable, origin, derivedFrom);
    }

    /** Drops a type the planner can no longer stand behind. */
    public PlanField withUnknownType() {
        return new PlanField(name, null, true, origin, derivedFrom);
    }

    public PlanField asNullable() {
        return nullable ? this : new PlanField(name, type, true, origin, derivedFrom);
    }
}
