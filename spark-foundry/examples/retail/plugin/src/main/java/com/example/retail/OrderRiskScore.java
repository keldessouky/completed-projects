package com.example.retail;

import dev.foundry.api.DataTransform;
import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.functions;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Scores each order line for how much it wants a second look.
 *
 * <h2>Why this is Java and not YAML</h2>
 *
 * <p>It could be a single enormous {@code CASE} expression. It should not be.
 * The rules below change often, each one has a reason someone will ask about,
 * and the weights are the sort of thing that gets tuned by argument. As Java
 * they are a list of named records: adding a rule is one line, the reasons a row
 * scored what it did come out as data rather than being reverse-engineered from
 * the total, and the whole thing has unit tests that run in milliseconds without
 * a warehouse.
 *
 * <p>That is the line to look for when deciding where a piece of logic belongs.
 * Shaping data - projecting, joining, aggregating, deduplicating - is better
 * declared, because the shape is what everything downstream depends on. Business
 * rules with names and histories are better in code, where they can be read,
 * argued with and tested.
 *
 * <h2>What is still declared</h2>
 *
 * <p>The columns this produces, and their types, are in the pipeline metadata,
 * not here. Its thresholds come from the step's {@code options:}, so the same
 * class can score strictly in one pipeline and leniently in another without a
 * recompile.
 */
public final class OrderRiskScore implements DataTransform {

    /** Score at or above which a line is called high risk. */
    private static final int HIGH_BAND = 60;
    /** Score at or above which a line is called elevated. */
    private static final int ELEVATED_BAND = 30;

    /**
     * One reason a line might be worth looking at.
     *
     * @param code    what shows up in {@code risk_reasons}
     * @param weight  what it contributes to the score
     */
    private record RiskRule(String code, int weight, Column holds) {
    }

    @Override
    public Set<String> requiredOptions() {
        // Declared, so a step that forgets one fails validation rather than the
        // nightly load. There is no sensible default for "what counts as a lot
        // of money" - it depends on the business, so the business states it.
        return Set.of("highValueThreshold");
    }

    @Override
    public String describe() {
        return "order risk scoring";
    }

    @Override
    public Dataset<Row> apply(TransformInput input) {
        BigDecimal highValue = decimal(input, "highValueThreshold");
        double discountRatio = input.doubleOption("discountRatioThreshold", 0.25);
        List<String> watchedChannels = List.of(input.option("watchedChannels", "store").split(","));

        List<RiskRule> rules = rules(highValue, discountRatio, watchedChannels);

        Column score = functions.lit(0);
        List<Column> flags = new ArrayList<>();
        for (RiskRule rule : rules) {
            score = score.plus(functions.when(rule.holds(), rule.weight()).otherwise(0));
            flags.add(functions.when(rule.holds(), functions.lit(rule.code())));
        }

        // array_compact drops the nulls the unmatched rules left behind, so the
        // result is just the reasons that actually applied.
        Column reasons = functions.array_compact(functions.array(flags.toArray(new Column[0])));

        return input.data()
                .withColumn("risk_score", score.cast("int"))
                .withColumn("risk_reasons", reasons)
                .withColumn("risk_band", band(functions.col("risk_score")));
    }

    /**
     * An option as a decimal, complaining in terms the person who wrote the
     * metadata can act on rather than in terms of a character array.
     */
    private static BigDecimal decimal(TransformInput input, String key) {
        String value = input.option(key);
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("step '" + input.stepId() + "': option '" + key
                    + "' must be a decimal number, but was '" + value + "'", e);
        }
    }

    /**
     * The rules, in the order their reasons are reported.
     *
     * <p>Kept as a method rather than inlined so a test can read it back, and so
     * that adding a rule is a single line in one obvious place.
     */
    private List<RiskRule> rules(BigDecimal highValue, double discountRatio, List<String> watchedChannels) {
        Column lineTotal = functions.col("line_total");
        Column listValue = functions.col("quantity").multiply(functions.col("unit_price"));

        return List.of(
                new RiskRule("high_value", 40,
                        lineTotal.geq(functions.lit(highValue))),

                new RiskRule("deep_discount", 25,
                        listValue.gt(0).and(functions.col("discount")
                                .divide(listValue).geq(functions.lit(discountRatio)))),

                // A product nobody catalogued is worth a look on its own: it is
                // either a new line nobody told the warehouse about, or a typo.
                new RiskRule("uncatalogued_product", 20,
                        functions.col("category").isNull()),

                new RiskRule("watched_channel", 15,
                        functions.col("channel").isin(watchedChannels.toArray())
                                .and(lineTotal.geq(functions.lit(highValue).divide(2)))),

                new RiskRule("unrecognised_status", 10,
                        functions.not(functions.col("status").isin("placed", "paid", "shipped",
                                "delivered", "cancelled", "refunded"))));
    }

    private Column band(Column score) {
        return functions.when(score.geq(HIGH_BAND), "high")
                .when(score.geq(ELEVATED_BAND), "elevated")
                .otherwise("low");
    }
}
