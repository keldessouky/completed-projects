package dev.foundry.core.run;

import dev.foundry.core.plan.PipelinePlan;
import dev.foundry.core.plan.Planner;
import dev.foundry.metadata.MetadataRepository;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The shipped example, run end to end against its committed seed data.
 *
 * <p>Every number asserted here was worked out by hand from the CSVs before the
 * pipeline was run, which is what makes this a test rather than a recording of
 * whatever the code happened to do.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RetailExampleIT {

    @TempDir
    static Path warehouse;

    private static SparkSession spark;
    private static RunManifest orders;
    private static RunManifest profile;

    @BeforeAll
    void runBothPipelines() {
        spark = SparkFixture.session();
        SparkFixture.seededWarehouse(warehouse);

        MetadataRepository repository = MetadataRepository.load(
                SparkFixture.examples().resolve("metadata"));
        Planner planner = Planner.standard();
        PipelineRunner runner = new PipelineRunner(spark);

        PipelinePlan ordersPlan = planner.plan(repository, repository.requirePipeline("orders_daily"));
        orders = runner.run(ordersPlan, RunOptions.of(warehouse)
                .withParams(Map.of("run_date", "2026-03-05")));

        PipelinePlan profilePlan = planner.plan(repository, repository.requirePipeline("customer_profile"));
        profile = runner.run(profilePlan, RunOptions.of(warehouse));
    }

    private static Dataset<Row> read(String relative) {
        return spark.read().parquet(warehouse.resolve(relative).toString());
    }

    @Test
    @Order(1)
    @DisplayName("both pipelines succeed and record the metadata they ran from")
    void bothSucceed() {
        assertTrue(orders.succeeded(), orders.failure());
        assertTrue(profile.succeeded(), profile.failure());
        assertTrue(orders.metadataFingerprint().startsWith("sha256:"));
        assertEquals(orders.metadataFingerprint(), profile.metadataFingerprint(),
                "both ran from the same metadata, so both carry the same fingerprint");
        assertEquals(Map.of("run_date", "2026-03-05", "min_line_total", "0.01"), orders.params(),
                "the manifest records the default alongside the argument that was supplied");
    }

    @Test
    @Order(2)
    @DisplayName("nine order lines survive: fourteen delivered, one held back, one deduplicated, three rejected")
    void loadsTheExpectedOrderLines() {
        Map<String, Long> rows = new java.util.LinkedHashMap<>();
        orders.steps().forEach(step -> rows.put(step.id(), step.rows()));

        assertEquals(14L, rows.get("orders"), "the landing file has fourteen rows");
        assertEquals(13L, rows.get("in_scope"), "O-1011 was ordered after the run date");
        assertEquals(12L, rows.get("latest_lines"), "the re-delivered O-1002 line collapses into one");
        assertEquals(9L, rows.get("priced_lines"), "three rows were quarantined out of the flow");
        assertEquals(9L, rows.get("curated_lines"));
        assertEquals(8L, rows.get("daily"));

        assertEquals(9, read("curated/order_lines").count());
    }

    @Test
    @Order(3)
    @DisplayName("the curated table matches the contract it declares, column for column")
    void writesUnderContract() {
        Dataset<Row> lines = read("curated/order_lines");
        assertEquals(List.of("order_id", "line_sku", "customer_id", "order_date", "ordered_at",
                        "quantity", "unit_price", "discount", "line_total", "status", "channel",
                        "region", "segment", "category", "product_name"),
                List.of(lines.columns()));
        assertEquals("decimal(14,2)", lines.schema().apply("line_total").dataType().simpleString());
        assertEquals("decimal(12,2)", lines.schema().apply("unit_price").dataType().simpleString());
        assertEquals("date", lines.schema().apply("order_date").dataType().simpleString());
        assertEquals("int", lines.schema().apply("quantity").dataType().simpleString());
    }

    @Test
    @Order(4)
    @DisplayName("line totals are computed net of discount, on the surviving lines")
    void computesLineTotals() {
        Map<String, BigDecimal> totals = new java.util.LinkedHashMap<>();
        for (Row row : read("curated/order_lines")
                .select("order_id", "line_sku", "line_total").collectAsList()) {
            totals.put(row.getString(0) + "/" + row.getString(1), row.getDecimal(2));
        }

        assertEquals(9, totals.size());
        assertEquals(0, new BigDecimal("96.00").compareTo(totals.get("O-1001/SKU-100")));
        assertEquals(0, new BigDecimal("30.00").compareTo(totals.get("O-1001/SKU-201")),
                "32.00 less a 2.00 discount");
        assertEquals(0, new BigDecimal("270.00").compareTo(totals.get("O-1003/SKU-200")),
                "three at 95.00 less a 15.00 discount");
        assertEquals(0, new BigDecimal("182.00").compareTo(totals.get("O-1005/SKU-100")),
                "four at 48.00 less a 10.00 discount");
    }

    @Test
    @Order(5)
    @DisplayName("the later delivery of a re-sent line wins")
    void keepsTheLatestDelivery() {
        List<Row> resent = read("curated/order_lines")
                .filter("order_id = 'O-1002'").select("status", "channel").collectAsList();
        assertEquals(1, resent.size(), "the two deliveries collapse into one line");
        assertEquals("shipped", resent.get(0).getString(0),
                "the 23:00 delivery, not the 20:00 one");
        assertEquals("mobile", resent.get(0).getString(1));
    }

    @Test
    @Order(6)
    @DisplayName("a product missing from the catalogue leaves a gap, it does not lose the sale")
    void keepsOrdersForUnknownProducts() {
        List<Row> orphan = read("curated/order_lines")
                .filter("line_sku = 'SKU-900'").select("order_id", "category", "product_name")
                .collectAsList();
        assertEquals(1, orphan.size());
        assertEquals("O-1006", orphan.get(0).getString(0));
        assertNull(orphan.get(0).get(1), "the left join leaves category null");
        assertNull(orphan.get(0).get(2));
    }

    @Test
    @Order(7)
    @DisplayName("each rule rejected exactly the row it was written for")
    void quarantinesTheRightRows() {
        Map<String, ExpectationSummary> byName = summarise(orders);

        assertEquals(new ExpectationSummary(false, 1, 1),
                byName.get("order_identifiers_present"), "the row with no order id");
        assertEquals(new ExpectationSummary(false, 1, 1),
                byName.get("lines_are_worth_something"), "O-1008, discounted to nothing");
        assertEquals(new ExpectationSummary(false, 1, 1),
                byName.get("customer_is_known"), "O-1009, for customer C999");
        assertEquals(new ExpectationSummary(false, 1, 0),
                byName.get("status_is_recognised"), "O-1010's status only warns");
        assertEquals(new ExpectationSummary(true, 0, 0), byName.get("one_row_per_line"));
        assertEquals(new ExpectationSummary(true, 0, 0), byName.get("something_was_loaded"));

        assertEquals(3, orders.quarantinedRows());
        assertEquals("rejected_rows", orders.quarantineDataset());
    }

    @Test
    @Order(8)
    @DisplayName("a quarantined row keeps its evidence: the rule, the step and the row itself")
    void quarantineCarriesEvidence() {
        Dataset<Row> rejected = read("quarantine/rows");
        assertEquals(3, rejected.count());
        assertEquals(List.of("pipeline", "step", "expectation", "rule", "detected_at", "row"),
                List.of(rejected.columns()));

        List<String> rules = new ArrayList<>();
        for (Row row : rejected.select("pipeline", "step", "rule", "row").collectAsList()) {
            assertEquals("orders_daily", row.getString(0));
            assertEquals("priced_lines", row.getString(1));
            rules.add(row.getString(2));
            assertTrue(row.getString(3).startsWith("{"), "the offending row is kept as JSON");
        }
        assertEquals(List.of("expression", "not_null", "referential"), rules.stream().sorted().toList());

        String orphan = rejected.filter("rule = 'referential'").select("row")
                .collectAsList().get(0).getString(0);
        assertTrue(orphan.contains("C999"), "the rejected row still holds the value that broke the rule");
    }

    @Test
    @Order(9)
    @DisplayName("the daily mart rolls up to the figures worked out by hand")
    void buildsTheDailyMart() {
        Map<String, BigDecimal> revenue = new java.util.LinkedHashMap<>();
        Map<String, Long> units = new java.util.LinkedHashMap<>();
        Map<String, Long> orderCounts = new java.util.LinkedHashMap<>();
        for (Row row : read("marts/daily_revenue")
                .select("order_date", "region", "category", "revenue", "units", "orders")
                .collectAsList()) {
            String key = row.getDate(0) + "/" + row.getString(1) + "/" + row.get(2);
            revenue.put(key, row.getDecimal(3));
            units.put(key, row.getLong(4));
            orderCounts.put(key, row.getLong(5));
        }

        assertEquals(8, revenue.size());
        assertEquals(0, new BigDecimal("168.50").compareTo(revenue.get("2026-03-01/emea/kitchen")),
                "96.00 from O-1001 plus 72.50 from O-1002");
        assertEquals(3L, units.get("2026-03-01/emea/kitchen"));
        assertEquals(2L, orderCounts.get("2026-03-01/emea/kitchen"),
                "two distinct orders, not two lines");
        assertEquals(0, new BigDecimal("270.00").compareTo(revenue.get("2026-03-02/apac/home")));
        assertEquals(0, new BigDecimal("25.00").compareTo(revenue.get("2026-03-03/emea/null")),
                "the uncatalogued product still contributes revenue, under a null category");
    }

    @Test
    @Order(10)
    @DisplayName("the mart is partitioned by date, as its dataset declares")
    void partitionsTheMart() {
        assertTrue(Files.isDirectory(warehouse.resolve("marts/daily_revenue/order_date=2026-03-01")));
        assertTrue(Files.isDirectory(warehouse.resolve("marts/daily_revenue/order_date=2026-03-04")));
    }

    @Test
    @Order(11)
    @DisplayName("the second pipeline builds its mart from the first one's output")
    void buildsTheCustomerMart() {
        Dataset<Row> summary = read("marts/customer_summary");
        assertEquals(6, summary.count());

        Map<String, Row> byCustomer = new java.util.LinkedHashMap<>();
        for (Row row : summary.collectAsList()) {
            byCustomer.put(row.getAs("customer_id"), row);
        }

        Row amara = byCustomer.get("C001");
        assertEquals("Amara Okafor", amara.getAs("full_name"));
        assertEquals(2L, (long) amara.getAs("order_count"), "three lines across two orders");
        assertEquals(0, new BigDecimal("151.00")
                .compareTo(amara.getAs("lifetime_spend")), "96.00 + 30.00 + 25.00");
        assertNull(amara.getAs("last_category"),
                "her most recent line was the uncatalogued SKU-900");

        Row bo = byCustomer.get("C002");
        assertEquals(0, new BigDecimal("136.50").compareTo(bo.getAs("lifetime_spend")));
        assertEquals("lighting", bo.getAs("last_category"), "the 4 March desk lamp");
    }

    @Test
    @Order(12)
    @DisplayName("the manifest traces every written column back to the sources it reads")
    void recordsLineage() {
        assertEquals(java.util.Set.of("orders.quantity", "orders.unit_price", "orders.discount"),
                orders.lineage().get("daily_revenue.revenue"));
        assertEquals(java.util.Set.of("customers.region"), orders.lineage().get("daily_revenue.region"));
        assertEquals(java.util.Set.of("products.category"), orders.lineage().get("daily_revenue.category"));
        assertEquals(java.util.Set.of("orders.ordered_at"), orders.lineage().get("daily_revenue.order_date"));

        assertEquals(java.util.Set.of("lines.line_total"),
                profile.lineage().get("customer_summary.lifetime_spend"),
                "the second pipeline's lineage stops at its own source, as it must");
    }

    @Test
    @Order(13)
    @DisplayName("the manifest is written to disk and parses back")
    void writesAManifest() throws Exception {
        Path file = warehouse.resolve("_foundry/runs").resolve(orders.fileName());
        assertTrue(Files.exists(file), "expected a manifest at " + file);

        Object parsed = new org.yaml.snakeyaml.Yaml().load(Files.readString(file));
        assertNotNull(parsed);
        @SuppressWarnings("unchecked")
        Map<String, Object> manifest = (Map<String, Object>) parsed;
        assertEquals("orders_daily", manifest.get("pipeline"));
        assertEquals("succeeded", manifest.get("status"));
        assertEquals(orders.metadataFingerprint(), manifest.get("metadataFingerprint"));
        assertEquals(13, ((List<?>) manifest.get("steps")).size(), "three sources and ten steps");
        assertEquals(6, ((List<?>) manifest.get("expectations")).size());
    }

    private record ExpectationSummary(boolean satisfied, long offending, long quarantined) {
    }

    private static Map<String, ExpectationSummary> summarise(RunManifest manifest) {
        Map<String, ExpectationSummary> byName = new java.util.LinkedHashMap<>();
        manifest.expectations().forEach(result -> byName.put(result.name(),
                new ExpectationSummary(result.satisfied(), result.offendingRows(), result.quarantinedRows())));
        return byName;
    }
}
