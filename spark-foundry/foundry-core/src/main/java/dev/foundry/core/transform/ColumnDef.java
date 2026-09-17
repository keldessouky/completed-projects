package dev.foundry.core.transform;

import dev.foundry.metadata.SourceRef;

/**
 * A column a step produces.
 *
 * @param expr the SQL expression that computes it, before parameter substitution
 * @param type optionally, the type it must have. Declaring one is not a hint:
 *             the transform casts to it and the runner then verifies it, so a
 *             declared type is a guarantee rather than an expectation
 */
public record ColumnDef(String name, String expr, String type, String description, SourceRef where) {

    /** True when this column is just a column of the input, carried through as is. */
    public boolean isPassthrough() {
        return type == null && expr.equals(name);
    }
}
