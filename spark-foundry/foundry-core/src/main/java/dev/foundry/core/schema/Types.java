package dev.foundry.core.schema;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;

import org.apache.spark.sql.catalyst.parser.CatalystSqlParser$;
import org.apache.spark.sql.types.DataType;

/**
 * Declared type text to a Spark {@link DataType}.
 *
 * <p>The metadata does not invent a type language. A field says
 * {@code decimal(12,2)} or {@code array&lt;struct&lt;id:string&gt;&gt;} and that string is
 * handed to Spark's own DDL parser, so anything Spark can express, the metadata
 * can declare, and the two can never drift apart.
 *
 * <p>Note what this needs: a parser, and nothing else. No session, no cluster,
 * no data. Type errors in metadata are caught in milliseconds.
 */
public final class Types {

    private Types() {
    }

    /** Parses declared type text, or throws a positioned diagnostic. */
    public static DataType parse(String text, SourceRef where) {
        if (text == null || text.isBlank()) {
            throw new MetadataException(Diagnostic.error("missing-type", where, "a type is required"));
        }
        try {
            return CatalystSqlParser$.MODULE$.parseDataType(text.trim());
        } catch (Exception e) {
            // ParseException is checked on the Scala side; see ExpressionAnalyzer.
            throw new MetadataException(Diagnostic.error("invalid-type", where,
                    "'" + text + "' is not a type Spark understands",
                    "types use Spark's DDL syntax: string, int, bigint, boolean, date, timestamp,"
                            + " decimal(p,s), array<t>, map<k,v>, struct<name:type,...>"));
        }
    }

    /** The short, readable name used in plans and the generated catalogue. */
    public static String describe(DataType type) {
        return type == null ? "?" : type.simpleString();
    }
}
