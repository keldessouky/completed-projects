package dev.foundry.core.expr;

import java.util.List;

/**
 * A column referenced by an expression, as the parser saw it.
 *
 * <p>Kept as parts rather than a single string because {@code order.customer.id}
 * is genuinely ambiguous: it could be a qualifier and a struct path, a struct
 * path alone, or two levels of nesting. Resolution decides; the parser only
 * reports.
 */
public record ColumnRef(List<String> parts) {

    public ColumnRef {
        parts = List.copyOf(parts);
        if (parts.isEmpty()) {
            throw new IllegalArgumentException("a column reference needs at least one part");
        }
    }

    public String first() {
        return parts.get(0);
    }

    public String last() {
        return parts.get(parts.size() - 1);
    }

    public boolean isQualified() {
        return parts.size() > 1;
    }

    public String dotted() {
        return String.join(".", parts);
    }

    @Override
    public String toString() {
        return dotted();
    }
}
