package dev.foundry.core.transform;

import dev.foundry.metadata.SourceRef;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.functions;

/** One term of an ordering, as used by {@code deduplicate} and {@code window}. */
public record OrderKey(String column, boolean ascending, Boolean nullsFirst, SourceRef where) {

    /** The Spark column, with the direction and null placement applied. */
    public Column toColumn() {
        Column base = functions.col(column);
        Column ordered = ascending ? base.asc() : base.desc();
        if (nullsFirst == null) {
            return ordered;
        }
        return ascending
                ? (nullsFirst ? base.asc_nulls_first() : base.asc_nulls_last())
                : (nullsFirst ? base.desc_nulls_first() : base.desc_nulls_last());
    }

    public String describe() {
        StringBuilder sb = new StringBuilder(column).append(ascending ? " asc" : " desc");
        if (nullsFirst != null) {
            sb.append(nullsFirst ? " nulls first" : " nulls last");
        }
        return sb.toString();
    }
}
