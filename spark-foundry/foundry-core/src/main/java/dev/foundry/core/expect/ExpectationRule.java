package dev.foundry.core.expect;

import java.util.Set;

/**
 * A data quality rule that a pipeline may attach to a step.
 *
 * <p>Like a transform, a rule owns its configuration: it declares the keys it
 * accepts and checks them against the columns it will see, so a rule that names
 * a column that does not exist is a validation failure rather than a run that
 * silently passes because the predicate never matched anything.
 *
 * <p>Rules come in two shapes - see {@link RowRule} and {@link DatasetRule} -
 * because "which rows are bad" and "is this dataset acceptable" are genuinely
 * different questions, and only the first can be answered by setting the bad
 * rows aside.
 */
public interface ExpectationRule {

    /** The name used as {@code rule:} in an expectation. */
    String name();

    /** One line for the generated reference documentation. */
    String summary();

    /** The configuration keys this rule understands, beyond the reserved ones. */
    Set<String> configKeys();

    /** Checks this rule's configuration against the columns it will be given. */
    void validate(RuleContext context);
}
