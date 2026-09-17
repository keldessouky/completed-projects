package dev.foundry.metadata;

/**
 * Where a piece of metadata came from: a file, and a position inside it.
 *
 * <p>Every node the loader produces carries one of these. It is what lets a
 * validation failure read like a compiler error instead of a stack trace.
 */
public record SourceRef(String file, int line, int column) {

    /** Used for metadata that was built in memory rather than read from disk. */
    public static final SourceRef UNKNOWN = new SourceRef("<unknown>", 0, 0);

    public SourceRef {
        if (file == null || file.isBlank()) {
            throw new IllegalArgumentException("file is required");
        }
    }

    /** {@code pipelines/retail_daily.yaml:42:7}, or just the file when unpositioned. */
    public String describe() {
        if (line <= 0) {
            return file;
        }
        return file + ":" + line + ":" + column;
    }

    @Override
    public String toString() {
        return describe();
    }
}
