package dev.foundry.core.expect;

import dev.foundry.metadata.model.ExpectationAction;

/**
 * What one expectation found on one run.
 *
 * <p>Recorded in the run manifest whether or not it passed, because "this check
 * ran and was satisfied" is evidence, and a check that silently stopped running
 * is exactly the kind of thing worth noticing.
 */
public record ExpectationResult(
        String name,
        String rule,
        String on,
        ExpectationAction action,
        boolean satisfied,
        long offendingRows,
        long totalRows,
        long quarantinedRows,
        String detail) {

    /**
     * The verdict reads by what the action did, not only by whether the rule
     * held: rows that were quarantined were dealt with, and reporting that as a
     * failure would teach people to ignore the word.
     */
    public String verdict() {
        if (satisfied) {
            return "ok";
        }
        return switch (action) {
            case WARN -> "WARN";
            case QUARANTINE -> "diverted";
            case FAIL -> "FAILED";
        };
    }

    public String describe() {
        return String.format("%-8s %s on %s (%s): %s", verdict(), name, on, rule, detail);
    }
}
