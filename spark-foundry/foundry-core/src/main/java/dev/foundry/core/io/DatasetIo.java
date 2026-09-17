package dev.foundry.core.io;

import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.Enforcement;
import dev.foundry.metadata.model.WriteMode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.DataFrameWriter;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.functions;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Reading and writing datasets under their declared contracts.
 *
 * <p>Two habits of ordinary Spark code are deliberately not repeated here.
 *
 * <p>The first is schema inference. A pipeline that infers its input's types
 * quietly changes behaviour when the data changes - a column of digits that
 * arrives with one letter in it becomes a string, and every arithmetic
 * expression downstream starts returning null. Here the declared schema is
 * supplied to the reader, so the types are the ones that were reviewed.
 *
 * <p>The second is positional CSV reading. Spark matches a supplied schema to a
 * CSV by position and simply renames the columns, so a producer that reorders
 * two columns of the same type silently swaps their contents. This reader sets
 * {@code enforceSchema=false}, which makes Spark check the header instead.
 */
public final class DatasetIo {

    private DatasetIo() {
    }

    // ---------------------------------------------------------------- reading

    /**
     * Reads a dataset, applying its declared schema and enforcement.
     *
     * @param expected the compiled schema the dataset promises
     */
    public static Dataset<Row> read(SparkSession spark, DatasetSpec spec, StructType expected, String location) {
        if (spec.enforcement() == Enforcement.NONE) {
            return reader(spark, spec, location).load(location);
        }

        StructType physical = peek(spark, spec, location);
        // A text format's "types" are all string, which says nothing about the
        // data - so for those, the contract is checked on column names and then
        // enforced by the reader, which fails rather than nulling what will not
        // parse. A self-describing format's types are real and are compared.
        List<String> problems = Contracts.check(physical, expected, spec.enforcement(),
                carriesTypes(spec));
        if (!problems.isEmpty()) {
            throw new ContractViolation(spec, "reading", location, problems);
        }

        // Read in the file's own column order, with the declared types applied,
        // so that a header check can succeed; then present the declared order.
        Dataset<Row> raw = reader(spark, spec, location)
                .schema(readSchema(physical, expected))
                .load(location);
        return project(raw, expected, spec.enforcement());
    }

    /** The source's own column names and types, without imposing anything. */
    private static StructType peek(SparkSession spark, DatasetSpec spec, String location) {
        Map<String, String> options = new LinkedHashMap<>(spec.options());
        if (isCsv(spec)) {
            // Only the header is needed; inferring types would defeat the point.
            options.putIfAbsent("inferSchema", "false");
        }
        return spark.read().format(spec.format()).options(options).load(location).schema();
    }

    /** The physical layout, with declared types replacing the physical ones. */
    private static StructType readSchema(StructType physical, StructType expected) {
        Set<String> declared = new LinkedHashSet<>(List.of(expected.fieldNames()));
        List<StructField> fields = new ArrayList<>();
        for (StructField field : physical.fields()) {
            fields.add(declared.contains(field.name()) ? expected.apply(field.name()) : field);
        }
        return new StructType(fields.toArray(new StructField[0]));
    }

    /** Declared columns in declared order; under additive, extras follow them. */
    private static Dataset<Row> project(Dataset<Row> raw, StructType expected, Enforcement enforcement) {
        List<Column> columns = new ArrayList<>();
        Set<String> declared = new LinkedHashSet<>(List.of(expected.fieldNames()));
        for (String name : expected.fieldNames()) {
            columns.add(functions.col(name));
        }
        if (enforcement == Enforcement.ADDITIVE) {
            for (String name : raw.columns()) {
                if (!declared.contains(name)) {
                    columns.add(functions.col(name));
                }
            }
        }
        return raw.select(columns.toArray(new Column[0]));
    }

    private static org.apache.spark.sql.DataFrameReader reader(SparkSession spark, DatasetSpec spec,
                                                               String location) {
        Map<String, String> options = new LinkedHashMap<>(spec.options());
        if (isCsv(spec)) {
            // Match the header against the schema rather than trusting position.
            options.putIfAbsent("enforceSchema", "false");
            if (spec.enforcement() == Enforcement.STRICT) {
                // A value that will not parse is a contract breach, not a null.
                options.putIfAbsent("mode", "FAILFAST");
            }
        }
        return spark.read().format(spec.format()).options(options);
    }

    private static boolean isCsv(DatasetSpec spec) {
        return spec.format().toLowerCase(Locale.ROOT).equals("csv");
    }

    /** Formats whose files record the type of each column, rather than only its text. */
    private static final Set<String> TYPED_FORMATS = Set.of("parquet", "orc", "avro", "json", "delta");

    private static boolean carriesTypes(DatasetSpec spec) {
        return TYPED_FORMATS.contains(spec.format().toLowerCase(Locale.ROOT));
    }

    // ---------------------------------------------------------------- writing

    /**
     * Writes a dataset under its contract.
     *
     * <p>The data is conformed to the declared schema first - declared columns,
     * in declared order - so what lands on disk is what the schema says,
     * regardless of the shape the last step happened to produce.
     *
     * @return the number of rows written
     */
    public static long write(Dataset<Row> data, DatasetSpec spec, StructType expected,
                             String location, WriteMode mode) {
        List<String> problems = Contracts.check(data.schema(), expected, spec.enforcement());
        if (!problems.isEmpty()) {
            throw new ContractViolation(spec, "writing", location, problems);
        }

        Dataset<Row> conformed = spec.enforcement() == Enforcement.NONE
                ? data
                : project(data, expected, spec.enforcement());
        // Counted before the write so the manifest records what was written even
        // for formats whose writer reports nothing back.
        conformed = conformed.cache();
        long rows = conformed.count();

        DataFrameWriter<Row> writer = conformed.write()
                .format(spec.format())
                .options(spec.options())
                .mode(mode.sparkMode());
        if (!spec.partitionBy().isEmpty()) {
            writer = writer.partitionBy(spec.partitionBy().toArray(new String[0]));
        }
        writer.save(location);
        conformed.unpersist(false);
        return rows;
    }
}
