package dev.foundry.core.expect;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.metadata.model.ExpectationAction;
import dev.foundry.metadata.model.ExpectationSpec;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.functions;
import org.apache.spark.storage.StorageLevel;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Applies a step's expectations to its result.
 *
 * <p>Expectations run in the order they are declared, and each sees what the one
 * before it left behind. That matters for quarantine: once the rows with no
 * customer have been set aside, the revenue-by-customer check that follows is
 * asking its question of data that can actually answer it.
 *
 * <p>Rules that only warn or fail do not touch the data at all - they are
 * measurements, and a measurement that changed what it measured would be a poor
 * one.
 */
public final class ExpectationEngine {

    private final ExpectationRegistry registry;
    private final String pipelineName;

    public ExpectationEngine(ExpectationRegistry registry, String pipelineName) {
        this.registry = registry;
        this.pipelineName = pipelineName;
    }

    /**
     * The result of checking one step.
     *
     * @param data       what flows on downstream, with quarantined rows removed
     * @param quarantine rejected rows, already in the quarantine shape
     */
    public record Checked(Dataset<Row> data, List<ExpectationResult> results, List<Dataset<Row>> quarantine) {
    }

    public Checked check(List<ExpectationSpec> expectations,
                         Dataset<Row> input,
                         Map<String, Dataset<Row>> available,
                         ParamResolver params,
                         SparkSession spark) {
        List<ExpectationResult> results = new ArrayList<>();
        List<Dataset<Row>> quarantined = new ArrayList<>();
        if (expectations.isEmpty()) {
            return new Checked(input, results, quarantined);
        }

        // The step's result is about to be counted and filtered several times
        // over; materialising it once is much cheaper than recomputing the whole
        // upstream chain for every rule.
        Dataset<Row> current = input.persist(StorageLevel.MEMORY_AND_DISK());
        try {
            long total = current.count();
            for (ExpectationSpec spec : expectations) {
                ExpectationRule rule = registry.require(spec.rule(), spec.where());
                RuleEvalContext context = new RuleEvalContext(spec, current, available, params, spark);

                if (rule instanceof DatasetRule datasetRule) {
                    RuleOutcome outcome = datasetRule.evaluate(context);
                    results.add(new ExpectationResult(spec.name(), spec.rule(), spec.on(), spec.action(),
                            outcome.satisfied(), Math.max(outcome.offending(), 0), total, 0, outcome.detail()));
                    continue;
                }

                RowRule rowRule = (RowRule) rule;
                Applied applied = applyRowRule(rowRule, spec, context, current, total, spark);
                results.add(applied.result());
                applied.quarantine().ifPresent(quarantined::add);
                if (applied.remaining() != null) {
                    current = applied.remaining();
                    total = applied.result().totalRows() - applied.result().quarantinedRows();
                }
            }
            return new Checked(current, results, quarantined);
        } finally {
            // The persisted handle is released; anything derived from it keeps
            // its own lineage and will be recomputed if Spark needs it again.
            input.unpersist(false);
        }
    }

    /** @param remaining non-null only when rows were quarantined out of the flow */
    private record Applied(ExpectationResult result, java.util.Optional<Dataset<Row>> quarantine,
                           Dataset<Row> remaining) {
    }

    private Applied applyRowRule(RowRule rule, ExpectationSpec spec, RuleEvalContext context,
                                 Dataset<Row> current, long total, SparkSession spark) {
        List<String> originalColumns = List.of(current.columns());

        Dataset<Row> prepared = rule.prepare(context, current);
        // A null verdict means the rule could not tell, which is not the same as
        // being satisfied, so it counts against the row.
        Column passes = functions.coalesce(rule.passes(context), functions.lit(false));
        Dataset<Row> rejected = prepared.filter(functions.not(passes));

        if (spec.action() != ExpectationAction.QUARANTINE) {
            long offending = rejected.count();
            return new Applied(new ExpectationResult(spec.name(), spec.rule(), spec.on(), spec.action(),
                    offending == 0, offending, total, 0, describe(offending, total)),
                    java.util.Optional.empty(), null);
        }

        Dataset<Row> quarantine = Quarantine.wrap(
                select(rejected, originalColumns), pipelineName, spec, originalColumns, Instant.now())
                .persist(StorageLevel.MEMORY_AND_DISK());
        long offending = quarantine.count();
        Dataset<Row> remaining = offending == 0 ? current : select(prepared.filter(passes), originalColumns);

        return new Applied(new ExpectationResult(spec.name(), spec.rule(), spec.on(), spec.action(),
                offending == 0, offending, total, offending,
                offending == 0 ? describe(0, total) : describe(offending, total) + ", quarantined"),
                java.util.Optional.of(quarantine), remaining);
    }

    /** Drops any working columns a rule added, restoring the step's own shape. */
    private static Dataset<Row> select(Dataset<Row> dataset, List<String> columns) {
        return dataset.select(columns.stream().map(functions::col).toArray(Column[]::new));
    }

    private static String describe(long offending, long total) {
        if (offending == 0) {
            return total + (total == 1 ? " row checked" : " rows checked");
        }
        return offending + " of " + total + (total == 1 ? " row" : " rows") + " failed";
    }

    /** The expectations that failed and whose action says the run must stop. */
    public static List<ExpectationResult> blocking(List<ExpectationResult> results) {
        return results.stream()
                .filter(r -> !r.satisfied() && r.action() == ExpectationAction.FAIL)
                .toList();
    }
}
