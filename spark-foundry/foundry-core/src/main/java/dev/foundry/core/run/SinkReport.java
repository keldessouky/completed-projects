package dev.foundry.core.run;

/** What one sink wrote, and where. */
public record SinkReport(String from, String dataset, String format, String mode, String location, long rows) {
}
