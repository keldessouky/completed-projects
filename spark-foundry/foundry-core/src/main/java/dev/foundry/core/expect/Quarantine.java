package dev.foundry.core.expect;

import dev.foundry.metadata.model.ExpectationSpec;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.List;

/**
 * The shape of a quarantine table, and how a rejected row is written into it.
 *
 * <p>One table holds rejects from every step of every pipeline, so the offending
 * row is stored as JSON rather than as columns. That is the trade that makes a
 * single quarantine dataset possible: rows from a five-column landing table and a
 * forty-column joined fact can sit side by side, each labelled with the pipeline,
 * the step and the rule that turned it away.
 */
public final class Quarantine {

    /** Columns every quarantine dataset must declare, in this order. */
    public static final StructType SCHEMA = new StructType(new StructField[]{
            new StructField("pipeline", DataTypes.StringType, false, org.apache.spark.sql.types.Metadata.empty()),
            new StructField("step", DataTypes.StringType, false, org.apache.spark.sql.types.Metadata.empty()),
            new StructField("expectation", DataTypes.StringType, false, org.apache.spark.sql.types.Metadata.empty()),
            new StructField("rule", DataTypes.StringType, false, org.apache.spark.sql.types.Metadata.empty()),
            new StructField("detected_at", DataTypes.TimestampType, false, org.apache.spark.sql.types.Metadata.empty()),
            new StructField("row", DataTypes.StringType, false, org.apache.spark.sql.types.Metadata.empty()),
    });

    private Quarantine() {
    }

    /** The declared type text for each quarantine column, for the docs and tests. */
    public static String schemaDescription() {
        List<String> parts = new ArrayList<>();
        for (StructField field : SCHEMA.fields()) {
            parts.add(field.name() + ": " + field.dataType().simpleString());
        }
        return String.join(", ", parts);
    }

    /** Turns rejected rows into quarantine rows, carrying the original as JSON. */
    public static Dataset<Row> wrap(Dataset<Row> rejected, String pipeline, ExpectationSpec expectation,
                                    List<String> originalColumns, java.time.Instant detectedAt) {
        List<Column> payload = new ArrayList<>();
        for (String name : originalColumns) {
            payload.add(functions.col(name));
        }
        return rejected.select(
                functions.lit(pipeline).as("pipeline"),
                functions.lit(expectation.on()).as("step"),
                functions.lit(expectation.name()).as("expectation"),
                functions.lit(expectation.rule()).as("rule"),
                functions.lit(java.sql.Timestamp.from(detectedAt)).as("detected_at"),
                functions.to_json(functions.struct(payload.toArray(new Column[0]))).as("row"));
    }
}
