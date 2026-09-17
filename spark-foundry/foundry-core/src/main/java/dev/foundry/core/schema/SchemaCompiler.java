package dev.foundry.core.schema;

import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.model.FieldSpec;
import dev.foundry.metadata.model.SchemaSpec;

import org.apache.spark.sql.types.Metadata;
import org.apache.spark.sql.types.MetadataBuilder;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.List;

/**
 * Compiles a declared {@link SchemaSpec} into a Spark {@link StructType}.
 *
 * <p>Descriptions and tags are carried into Spark's per-column metadata rather
 * than dropped, so the documentation a schema author wrote survives into the
 * written files and can be read back off the data itself.
 */
public final class SchemaCompiler {

    /** Spark column-metadata key holding the description from the schema. */
    public static final String COMMENT_KEY = "comment";
    /** Spark column-metadata key holding the declared tags. */
    public static final String TAGS_KEY = "foundry.tags";

    private SchemaCompiler() {
    }

    /** Compiles, throwing a report if any field's declared type is unusable. */
    public static StructType compile(SchemaSpec spec) {
        Diagnostics diagnostics = new Diagnostics();
        StructType compiled = compile(spec, diagnostics);
        diagnostics.throwIfErrors("schema '" + spec.name() + "' does not compile");
        return compiled;
    }

    /** Compiles, reporting bad fields and leaving them out of the result. */
    public static StructType compile(SchemaSpec spec, Diagnostics diagnostics) {
        List<StructField> fields = new ArrayList<>(spec.fields().size());
        for (FieldSpec field : spec.fields()) {
            try {
                fields.add(new StructField(field.name(),
                        Types.parse(field.type(), field.where()),
                        field.nullable(),
                        metadataFor(field)));
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
            }
        }
        return new StructType(fields.toArray(new StructField[0]));
    }

    /** The compiled schema as a {@link FieldSet}, ready for the planner. */
    public static FieldSet fieldSet(SchemaSpec spec, Diagnostics diagnostics) {
        return FieldSet.of(compile(spec, diagnostics), "schema " + spec.name());
    }

    private static Metadata metadataFor(FieldSpec field) {
        MetadataBuilder builder = new MetadataBuilder();
        if (field.description() != null && !field.description().isBlank()) {
            builder.putString(COMMENT_KEY, field.description());
        }
        if (!field.tags().isEmpty()) {
            builder.putStringArray(TAGS_KEY, field.tags().toArray(new String[0]));
        }
        return builder.build();
    }
}
