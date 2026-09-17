package dev.foundry.core.expect;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

/**
 * A rule that judges each row on its own.
 *
 * <p>Only a row-level rule can be quarantined, because only a row-level rule can
 * say which rows to set aside.
 *
 * <p>Some row-level questions need context a single row does not have - is this
 * key unique across the whole dataset, does it exist in another table - so a rule
 * may first {@link #prepare} the data by adding working columns. The engine
 * projects those away again before anything downstream sees the result, so a rule
 * may add whatever it needs without leaking it into the pipeline.
 */
public interface RowRule extends ExpectationRule {

    /** Working columns this rule needs. They must be named {@code __foundry_*}. */
    default Dataset<Row> prepare(RuleEvalContext context, Dataset<Row> input) {
        return input;
    }

    /**
     * A boolean column that is true for rows satisfying the rule.
     *
     * <p>A null verdict counts as a failure: a rule that cannot tell has not been
     * satisfied.
     */
    Column passes(RuleEvalContext context);
}
