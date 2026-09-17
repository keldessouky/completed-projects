package dev.foundry.metadata.model;

/**
 * The types a pipeline parameter may take.
 *
 * <p>Parameters arrive from a command line as text, so the point of the type is
 * to reject a bad value up front - {@code --param run_date=2026-02-31} should
 * fail before Spark starts, not halfway through a write.
 */
public enum ParamType {
    STRING,
    INT,
    DECIMAL,
    BOOLEAN,
    DATE,
    TIMESTAMP
}
