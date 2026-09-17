package dev.foundry.core.run;

import java.util.List;

/**
 * What one step did.
 *
 * @param plannedSchema what the planner claimed, in Spark DDL
 * @param actualSchema  what Spark produced, in Spark DDL. Both are recorded
 *                      because the second is where the types the planner left
 *                      open are finally settled
 * @param rows          -1 when row counting was switched off
 */
public record StepReport(
        String id,
        String type,
        List<String> inputs,
        String plannedSchema,
        String actualSchema,
        long rows,
        long durationMillis) {

    public StepReport {
        inputs = List.copyOf(inputs);
    }
}
