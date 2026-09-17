package dev.foundry.metadata.model;

import dev.foundry.metadata.SourceRef;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * A physical binding of a {@link SchemaSpec} to somewhere data actually lives.
 *
 * <p>Splitting the contract (what the columns are) from the binding (where the
 * bytes are, in what format) is what lets the same schema describe a landing
 * file, a curated table and a test fixture without being restated.
 *
 * @param location may contain {@code ${placeholders}}: {@code ${data}} for the
 *                 warehouse root, plus any parameter the running pipeline
 *                 declares. Resolved at run time, so one definition serves every
 *                 environment and every partition
 */
public record DatasetSpec(
        String name,
        String schema,
        String format,
        String location,
        Map<String, String> options,
        List<String> partitionBy,
        Enforcement enforcement,
        WriteMode writeMode,
        String description,
        SourceRef where) {

    public DatasetSpec {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(schema, "schema");
        Objects.requireNonNull(format, "format");
        Objects.requireNonNull(location, "location");
        Objects.requireNonNull(enforcement, "enforcement");
        Objects.requireNonNull(writeMode, "writeMode");
        Objects.requireNonNull(where, "where");
        options = options == null ? Map.of() : Map.copyOf(options);
        partitionBy = partitionBy == null ? List.of() : List.copyOf(partitionBy);
    }
}
