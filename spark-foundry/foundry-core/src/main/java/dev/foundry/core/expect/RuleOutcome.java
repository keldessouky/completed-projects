package dev.foundry.core.expect;

/**
 * What a rule found.
 *
 * @param offending how many rows broke the rule, or -1 when the rule does not
 *                  count rows
 * @param detail    a short phrase for the run manifest and the console, such as
 *                  {@code "3 of 120 rows"} or {@code "row count 0, expected at least 1"}
 */
public record RuleOutcome(boolean satisfied, long offending, String detail) {

    public static RuleOutcome satisfied(String detail) {
        return new RuleOutcome(true, 0, detail);
    }

    public static RuleOutcome broken(long offending, String detail) {
        return new RuleOutcome(false, offending, detail);
    }
}
