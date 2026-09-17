package dev.foundry.core.run;

import dev.foundry.core.expect.ExpectationResult;
import dev.foundry.metadata.json.Json;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The record of one run.
 *
 * <p>Written next to the data, as JSON, every time a pipeline runs. It answers
 * the questions that come up when a table looks wrong: which metadata produced
 * this, with what arguments, how many rows went in and came out at each step,
 * which quality rules ran and what they found, and where each column ultimately
 * came from.
 *
 * <p>The {@code metadataFingerprint} is the load-bearing field. It is a hash of
 * the metadata files this run was driven by, so a table can always be traced
 * back to an exact revision - and two runs that disagree can be explained by
 * diffing the metadata between their fingerprints, which is a git operation
 * rather than an archaeology project.
 */
public record RunManifest(
        String runId,
        String pipeline,
        String metadataFingerprint,
        String status,
        Instant startedAt,
        Instant finishedAt,
        Map<String, String> params,
        String dataRoot,
        String sparkVersion,
        List<StepReport> steps,
        List<ExpectationResult> expectations,
        List<SinkReport> sinks,
        String quarantineDataset,
        long quarantinedRows,
        Map<String, Set<String>> lineage,
        String failure) {

    public static final String SUCCEEDED = "succeeded";
    public static final String FAILED = "failed";

    public RunManifest {
        params = Map.copyOf(params);
        steps = List.copyOf(steps);
        expectations = List.copyOf(expectations);
        sinks = List.copyOf(sinks);
        lineage = Map.copyOf(lineage);
    }

    public boolean succeeded() {
        return SUCCEEDED.equals(status);
    }

    public long durationMillis() {
        return Duration.between(startedAt, finishedAt).toMillis();
    }

    /** The file name this manifest is written under. */
    public String fileName() {
        return pipeline + "-" + runId + ".json";
    }

    public String toJson() {
        Json json = Json.writer().startObject()
                .field("runId", runId)
                .field("pipeline", pipeline)
                .field("metadataFingerprint", metadataFingerprint)
                .field("status", status)
                .field("startedAt", startedAt.toString())
                .field("finishedAt", finishedAt.toString())
                .field("durationMillis", durationMillis())
                .field("dataRoot", dataRoot)
                .field("sparkVersion", sparkVersion);

        json.startObject("params");
        params.forEach(json::field);
        json.end();

        json.startArray("steps");
        for (StepReport step : steps) {
            json.startObject()
                .field("id", step.id())
                .field("type", step.type())
                .field("inputs", step.inputs())
                .field("plannedSchema", step.plannedSchema())
                .field("actualSchema", step.actualSchema())
                .field("rows", step.rows())
                .field("durationMillis", step.durationMillis())
                .end();
        }
        json.end();

        json.startArray("expectations");
        for (ExpectationResult result : expectations) {
            json.startObject()
                .field("name", result.name())
                .field("rule", result.rule())
                .field("on", result.on())
                .field("action", result.action().name().toLowerCase(java.util.Locale.ROOT))
                .field("satisfied", result.satisfied())
                .field("offendingRows", result.offendingRows())
                .field("quarantinedRows", result.quarantinedRows())
                .field("totalRows", result.totalRows())
                .field("detail", result.detail())
                .end();
        }
        json.end();

        json.startArray("sinks");
        for (SinkReport sink : sinks) {
            json.startObject()
                .field("from", sink.from())
                .field("dataset", sink.dataset())
                .field("format", sink.format())
                .field("mode", sink.mode())
                .field("location", sink.location())
                .field("rows", sink.rows())
                .end();
        }
        json.end();

        json.startObject("quarantine")
            .field("dataset", quarantineDataset)
            .field("rows", quarantinedRows)
            .end();

        json.startObject("lineage");
        // Sorted so that two runs of the same metadata produce byte-identical
        // lineage, which makes the manifests diffable.
        new java.util.TreeMap<>(lineage).forEach((column, origins) ->
                json.field(column, new java.util.TreeSet<>(origins)));
        json.end();

        json.field("failure", failure);
        return json.end().build();
    }

    /** A short human summary, as the CLI prints it. */
    public String summary() {
        StringBuilder sb = new StringBuilder();
        sb.append(succeeded() ? "succeeded" : "FAILED")
          .append(" in ").append(durationMillis()).append(" ms")
          .append(System.lineSeparator());
        for (SinkReport sink : sinks) {
            sb.append("  wrote ").append(sink.rows()).append(sink.rows() == 1 ? " row" : " rows")
              .append(" to ").append(sink.dataset()).append(" (").append(sink.location()).append(')')
              .append(System.lineSeparator());
        }
        if (quarantinedRows > 0) {
            sb.append("  quarantined ").append(quarantinedRows)
              .append(quarantinedRows == 1 ? " row into " : " rows into ").append(quarantineDataset)
              .append(System.lineSeparator());
        }
        for (ExpectationResult result : expectations) {
            sb.append("  ").append(result.describe()).append(System.lineSeparator());
        }
        if (failure != null) {
            sb.append("  ").append(failure).append(System.lineSeparator());
        }
        return sb.toString();
    }

    /** A builder, because a manifest is assembled across a whole run. */
    public static final class Builder {
        private final String runId = java.util.UUID.randomUUID().toString().substring(0, 8);
        private final Instant startedAt = Instant.now();
        private final List<StepReport> steps = new java.util.ArrayList<>();
        private final List<ExpectationResult> expectations = new java.util.ArrayList<>();
        private final List<SinkReport> sinks = new java.util.ArrayList<>();
        private final Map<String, Set<String>> lineage = new LinkedHashMap<>();
        private String pipeline = "";
        private String fingerprint = "";
        private String dataRoot = "";
        private String sparkVersion = "";
        private Map<String, String> params = Map.of();
        private String quarantineDataset;
        private long quarantinedRows;

        public Builder pipeline(String value) {
            this.pipeline = value;
            return this;
        }

        public Builder fingerprint(String value) {
            this.fingerprint = value;
            return this;
        }

        public Builder dataRoot(String value) {
            this.dataRoot = value;
            return this;
        }

        public Builder sparkVersion(String value) {
            this.sparkVersion = value;
            return this;
        }

        public Builder params(Map<String, String> values) {
            this.params = Map.copyOf(values);
            return this;
        }

        public Builder step(StepReport report) {
            steps.add(report);
            return this;
        }

        public Builder expectations(List<ExpectationResult> results) {
            expectations.addAll(results);
            return this;
        }

        public Builder sink(SinkReport report) {
            sinks.add(report);
            return this;
        }

        public Builder quarantine(String dataset, long rows) {
            this.quarantineDataset = dataset;
            this.quarantinedRows = rows;
            return this;
        }

        public Builder lineage(String column, Set<String> origins) {
            lineage.put(column, origins);
            return this;
        }

        public List<ExpectationResult> expectationResults() {
            return List.copyOf(expectations);
        }

        public RunManifest build(String status, String failure) {
            return new RunManifest(runId, pipeline, fingerprint, status, startedAt, Instant.now(),
                    params, dataRoot, sparkVersion, steps, expectations, sinks,
                    quarantineDataset, quarantinedRows, lineage, failure);
        }
    }
}
