package com.example.retail;

import dev.foundry.api.TransformInput;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.RowFactory;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What a team's tests for their own transform look like.
 *
 * <p>Note what is not here: no metadata, no planner, no warehouse, no pipeline.
 * A custom transform is a class with one method taking one argument, so its
 * tests build that argument and call it. That is the reason the interface is as
 * small as it is, and the reason {@code TransformInput} can be constructed
 * directly.
 *
 * <p>The scoring rules are exercised one at a time, because the value of moving
 * them out of SQL was being able to.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderRiskScoreTest {

    private static final StructType SCHEMA = new StructType()
            .add("order_id", DataTypes.StringType)
            .add("line_sku", DataTypes.StringType)
            .add("quantity", DataTypes.IntegerType)
            .add("unit_price", DataTypes.createDecimalType(12, 2))
            .add("discount", DataTypes.createDecimalType(12, 2))
            .add("line_total", DataTypes.createDecimalType(14, 2))
            .add("status", DataTypes.StringType)
            .add("channel", DataTypes.StringType)
            .add("category", DataTypes.StringType);

    private static SparkSession spark;

    @BeforeAll
    void startSpark() {
        spark = SparkSession.builder()
                .appName("retail-transforms-tests")
                .master("local[2]")
                .config("spark.ui.enabled", "false")
                .config("spark.sql.shuffle.partitions", "2")
                .getOrCreate();
        spark.sparkContext().setLogLevel("ERROR");
    }

    /** One order line, with everything unremarkable unless a test says otherwise. */
    private static Row line(String orderId, String total, String status, String channel,
                            String category, String discount) {
        return RowFactory.create(orderId, "SKU-1", 1,
                new BigDecimal("50.00"), new BigDecimal(discount),
                new BigDecimal(total), status, channel, category);
    }

    private static Row ordinary(String orderId, String total) {
        return line(orderId, total, "placed", "web", "kitchen", "0.00");
    }

    /** Scores the given rows and returns each line's score, band and reasons. */
    private Map<String, Scored> score(List<Row> rows, Map<String, String> options) {
        Dataset<Row> input = spark.createDataFrame(rows, SCHEMA);
        TransformInput.Builder builder = TransformInput.builder()
                .stepId("scored")
                .input("lines", input)
                .option("highValueThreshold", "100.00");
        options.forEach(builder::option);

        Dataset<Row> result = new OrderRiskScore().apply(builder.build());
        Map<String, Scored> out = new LinkedHashMap<>();
        for (Row row : result.select("order_id", "risk_score", "risk_band", "risk_reasons")
                .collectAsList()) {
            out.put(row.getString(0), new Scored(row.getInt(1), row.getString(2),
                    new ArrayList<>(row.getList(3))));
        }
        return out;
    }

    private Map<String, Scored> score(List<Row> rows) {
        return score(rows, Map.of());
    }

    private record Scored(int score, String band, List<String> reasons) {
    }

    @Test
    @DisplayName("an unremarkable line scores nothing and is called low risk")
    void ordinaryLinesScoreNothing() {
        Scored scored = score(List.of(ordinary("O-1", "40.00"))).get("O-1");
        assertEquals(0, scored.score());
        assertEquals("low", scored.band());
        assertEquals(List.of(), scored.reasons(), "no rule matched, so there is nothing to explain");
    }

    @Test
    @DisplayName("a line at or above the threshold is high value")
    void highValue() {
        Map<String, Scored> scored = score(List.of(
                ordinary("at", "100.00"),
                ordinary("above", "250.00"),
                ordinary("below", "99.99")));

        assertEquals(40, scored.get("at").score(), "the threshold is inclusive");
        assertEquals(40, scored.get("above").score());
        assertEquals(0, scored.get("below").score());
        assertEquals(List.of("high_value"), scored.get("above").reasons());
    }

    @Test
    @DisplayName("a discount of a quarter or more of the list value is a deep discount")
    void deepDiscount() {
        // quantity 1 at 50.00, so the list value is 50.00.
        Map<String, Scored> scored = score(List.of(
                line("deep", "37.50", "placed", "web", "kitchen", "12.50"),
                line("shallow", "45.00", "placed", "web", "kitchen", "5.00")));

        assertEquals(25, scored.get("deep").score());
        assertEquals(List.of("deep_discount"), scored.get("deep").reasons());
        assertEquals(0, scored.get("shallow").score());
    }

    @Test
    @DisplayName("a line whose product is not in the catalogue is flagged on its own")
    void uncataloguedProduct() {
        Scored scored = score(List.of(
                line("O-1", "25.00", "placed", "web", null, "0.00"))).get("O-1");

        assertEquals(20, scored.score());
        assertEquals(List.of("uncatalogued_product"), scored.reasons());
    }

    @Test
    @DisplayName("a watched channel counts once the line is worth half the threshold")
    void watchedChannel() {
        Map<String, Scored> scored = score(List.of(
                line("store_big", "60.00", "placed", "store", "kitchen", "0.00"),
                line("store_small", "20.00", "placed", "store", "kitchen", "0.00"),
                line("web_big", "60.00", "placed", "web", "kitchen", "0.00")));

        assertEquals(15, scored.get("store_big").score());
        assertEquals(List.of("watched_channel"), scored.get("store_big").reasons());
        assertEquals(0, scored.get("store_small").score(), "below half the threshold");
        assertEquals(0, scored.get("web_big").score(), "web is not a watched channel");
    }

    @Test
    @DisplayName("a status the warehouse does not recognise is flagged")
    void unrecognisedStatus() {
        Map<String, Scored> scored = score(List.of(
                line("odd", "20.00", "pending", "web", "kitchen", "0.00"),
                line("known", "20.00", "delivered", "web", "kitchen", "0.00")));

        assertEquals(10, scored.get("odd").score());
        assertEquals(List.of("unrecognised_status"), scored.get("odd").reasons());
        assertEquals(0, scored.get("known").score());
    }

    @Test
    @DisplayName("rules add up, and every reason that applied is reported")
    void rulesCombine() {
        // High value, deeply discounted, uncatalogued, in a watched channel, with
        // a status nobody recognises: every rule at once.
        Scored scored = score(List.of(RowFactory.create("O-1", "SKU-1", 10,
                new BigDecimal("50.00"), new BigDecimal("200.00"),
                new BigDecimal("300.00"), "pending", "store", null))).get("O-1");

        assertEquals(110, scored.score(), "the weights total 110");
        assertEquals("high", scored.band());
        assertEquals(List.of("high_value", "deep_discount", "uncatalogued_product",
                        "watched_channel", "unrecognised_status"), scored.reasons(),
                "reasons come back in the order the rules are declared");
    }

    @Test
    @DisplayName("the bands are drawn at 30 and 60")
    void bands() {
        Map<String, Scored> scored = score(List.of(
                // 20: uncatalogued only.
                line("low", "20.00", "placed", "web", null, "0.00"),
                // 40: high value only.
                ordinary("elevated", "150.00"),
                // 60: high value plus uncatalogued.
                line("high", "150.00", "placed", "web", null, "0.00")));

        assertEquals("low", scored.get("low").band());
        assertEquals(20, scored.get("low").score());
        assertEquals("elevated", scored.get("elevated").band());
        assertEquals(40, scored.get("elevated").score());
        assertEquals("high", scored.get("high").band());
        assertEquals(60, scored.get("high").score());
    }

    @Test
    @DisplayName("the threshold comes from the step's options, so the same class can be stricter")
    void optionsChangeTheOutcome() {
        List<Row> rows = List.of(ordinary("O-1", "60.00"));

        assertEquals(0, score(rows).get("O-1").score());
        assertEquals(40, score(rows, Map.of("highValueThreshold", "50.00")).get("O-1").score());
    }

    @Test
    @DisplayName("the watched channels are configurable")
    void watchedChannelsAreConfigurable() {
        List<Row> rows = List.of(line("O-1", "60.00", "placed", "web", "kitchen", "0.00"));

        assertEquals(0, score(rows).get("O-1").score());
        assertEquals(15, score(rows, Map.of("watchedChannels", "web,phone")).get("O-1").score());
    }

    @Test
    @DisplayName("the option the class cannot work without is declared, so the framework checks it")
    void declaresItsRequiredOptions() {
        assertEquals(java.util.Set.of("highValueThreshold"), new OrderRiskScore().requiredOptions());
    }

    @Test
    @DisplayName("a missing option says which one, rather than failing somewhere deeper")
    void missingOptionIsClear() {
        Dataset<Row> input = spark.createDataFrame(List.of(ordinary("O-1", "10.00")), SCHEMA);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> new OrderRiskScore().apply(TransformInput.of(input)));
        assertTrue(e.getMessage().contains("highValueThreshold"), e.getMessage());
    }

    @Test
    @DisplayName("an option that is not a number says so in terms of the metadata")
    void badOptionIsClear() {
        Dataset<Row> input = spark.createDataFrame(List.of(ordinary("O-1", "10.00")), SCHEMA);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> new OrderRiskScore().apply(TransformInput.builder()
                        .stepId("scored").input("lines", input)
                        .option("highValueThreshold", "a lot").build()));

        assertTrue(e.getMessage().contains("step 'scored'"), e.getMessage());
        assertTrue(e.getMessage().contains("'highValueThreshold'"), e.getMessage());
        assertTrue(e.getMessage().contains("'a lot'"), e.getMessage());
    }
}
