package dev.foundry.core.schema;

import org.apache.spark.sql.types.DataType;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * An ordered set of {@link PlanField}s: what one step's output looks like.
 *
 * <p>This is the value that flows through the planner. Every transform takes
 * field sets in and returns a field set out, and it does so without a Spark
 * session, which is why a whole pipeline can be checked end to end before
 * anything is started.
 */
public final class FieldSet {

    private static final FieldSet EMPTY = new FieldSet(List.of());

    private final List<PlanField> fields;

    private FieldSet(List<PlanField> fields) {
        this.fields = List.copyOf(fields);
    }

    public static FieldSet empty() {
        return EMPTY;
    }

    public static FieldSet of(List<PlanField> fields) {
        return new FieldSet(fields);
    }

    /** Lifts a fully known Spark schema, as read from a declared data contract. */
    public static FieldSet of(StructType struct, String origin) {
        List<PlanField> fields = new ArrayList<>(struct.fields().length);
        for (StructField field : struct.fields()) {
            fields.add(PlanField.known(field.name(), field.dataType(), field.nullable(), origin));
        }
        return new FieldSet(fields);
    }

    public List<PlanField> fields() {
        return fields;
    }

    public int size() {
        return fields.size();
    }

    public boolean isEmpty() {
        return fields.isEmpty();
    }

    /** Column names in order. Used for reference checking and did-you-mean hints. */
    public Set<String> names() {
        return new LinkedHashSet<>(fields.stream().map(PlanField::name).toList());
    }

    public List<String> nameList() {
        return fields.stream().map(PlanField::name).toList();
    }

    public boolean has(String name) {
        return fields.stream().anyMatch(f -> f.name().equals(name));
    }

    public Optional<PlanField> get(String name) {
        return fields.stream().filter(f -> f.name().equals(name)).findFirst();
    }

    // ------------------------------------------------------------ derivations

    /** Appends a column, replacing any existing one of the same name in place. */
    public FieldSet with(PlanField field) {
        List<PlanField> out = new ArrayList<>(fields.size() + 1);
        boolean replaced = false;
        for (PlanField existing : fields) {
            if (existing.name().equals(field.name())) {
                out.add(field);
                replaced = true;
            } else {
                out.add(existing);
            }
        }
        if (!replaced) {
            out.add(field);
        }
        return new FieldSet(out);
    }

    public FieldSet without(String name) {
        return new FieldSet(fields.stream().filter(f -> !f.name().equals(name)).toList());
    }

    public FieldSet renamed(String from, String to) {
        return new FieldSet(fields.stream().map(f -> f.name().equals(from) ? f.renamedTo(to) : f).toList());
    }

    /** All columns made nullable, as an outer join does to its null-padded side. */
    public FieldSet allNullable() {
        return new FieldSet(fields.stream().map(PlanField::asNullable).toList());
    }

    public FieldSet concat(FieldSet other) {
        List<PlanField> out = new ArrayList<>(fields);
        out.addAll(other.fields);
        return new FieldSet(out);
    }

    /** A Spark schema, which is only possible when every type is known. */
    public StructType toStructType() {
        List<StructField> out = new ArrayList<>(fields.size());
        for (PlanField field : fields) {
            DataType type = field.declaredType().orElseThrow(() -> new IllegalStateException(
                    "column '" + field.name() + "' has no planned type; it can only be settled at run time"));
            out.add(new StructField(field.name(), type, field.nullable(), org.apache.spark.sql.types.Metadata.empty()));
        }
        return new StructType(out.toArray(new StructField[0]));
    }

    // ----------------------------------------------------------- verification

    /**
     * Compares this plan against the schema Spark actually produced.
     *
     * <p>This is the check that keeps the whole framework honest. Every claim
     * the planner makes about a step - which columns, in what order, and of what
     * type where it committed to one - is re-checked against reality on every
     * run. If a transform's planning logic and its execution logic ever disagree,
     * the run says so, naming the step and the column, instead of writing
     * quietly wrong data.
     *
     * <p>Columns whose type the planner left open are checked for presence and
     * position only; a type it never claimed is not a type it can get wrong.
     *
     * @return one message per disagreement, empty when the plan held
     */
    public List<String> verify(StructType actual) {
        List<String> problems = new ArrayList<>();
        List<String> plannedNames = nameList();
        List<String> actualNames = new ArrayList<>();
        for (StructField field : actual.fields()) {
            actualNames.add(field.name());
        }

        for (String name : plannedNames) {
            if (!actualNames.contains(name)) {
                problems.add("planned column '" + name + "' is missing from the result");
            }
        }
        for (String name : actualNames) {
            if (!plannedNames.contains(name)) {
                problems.add("result has column '" + name + "', which the plan did not predict");
            }
        }
        if (problems.isEmpty() && !plannedNames.equals(actualNames)) {
            problems.add("column order differs: planned " + plannedNames + ", got " + actualNames);
        }

        for (PlanField planned : fields) {
            if (!planned.typeKnown()) {
                continue;
            }
            int index = actual.getFieldIndex(planned.name()).isEmpty()
                    ? -1 : (int) actual.getFieldIndex(planned.name()).get();
            if (index < 0) {
                continue;
            }
            DataType actualType = actual.fields()[index].dataType();
            if (!Objects.equals(planned.type(), actualType)) {
                problems.add("column '" + planned.name() + "' was planned as "
                        + planned.typeName() + " but came out as " + actualType.simpleString());
            }
        }
        return problems;
    }

    /** One line per column, as printed by {@code foundry plan}. */
    public String describe() {
        if (fields.isEmpty()) {
            return "(no columns)";
        }
        StringBuilder sb = new StringBuilder();
        for (PlanField field : fields) {
            sb.append(System.lineSeparator())
              .append("        ").append(field.name())
              .append(": ").append(field.typeName());
            if (!field.nullable()) {
                sb.append(" not null");
            }
        }
        return sb.substring(System.lineSeparator().length());
    }

    /** A compact one-line form: {@code a: string, b: int}. */
    public String summary() {
        return String.join(", ", fields.stream().map(f -> f.name() + ": " + f.typeName()).toList());
    }

    @Override
    public String toString() {
        return "FieldSet(" + summary() + ")";
    }
}
