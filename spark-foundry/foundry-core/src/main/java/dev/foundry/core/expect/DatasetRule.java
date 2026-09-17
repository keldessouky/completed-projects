package dev.foundry.core.expect;

/**
 * A rule about a dataset as a whole rather than about any particular row.
 *
 * <p>"There should be between 1 and 10,000 orders today" is not a statement any
 * single row can break, so such a rule can warn or fail a run but cannot
 * quarantine - there is nothing to set aside.
 */
public interface DatasetRule extends ExpectationRule {

    RuleOutcome evaluate(RuleEvalContext context);
}
