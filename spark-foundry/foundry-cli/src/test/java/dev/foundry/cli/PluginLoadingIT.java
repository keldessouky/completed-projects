package dev.foundry.cli;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Loading a project's own transforms from a jar, through the command line.
 *
 * <p>The example plugin is deliberately not on this module's classpath. It is
 * found on disk, the way a deployment would find it, so that {@code --plugins}
 * is what makes the difference here rather than an accident of how the tests
 * were built. Without it, the pipeline that names a custom class must fail; with
 * it, the same pipeline must validate, plan and run.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PluginLoadingIT {

    private record Result(int code, String out, String err) {
    }

    private static Path plugin;
    private static Path pluginClasses;
    private static Path metadata;
    private static Path seed;

    @BeforeAll
    void locateTheExample() {
        metadata = ExamplePaths.metadata();
        seed = ExamplePaths.seed();
        pluginClasses = ExamplePaths.pluginClasses();
        plugin = ExamplePaths.plugin();
    }

    private static Result run(String... argv) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = new Foundry(new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8)).run(argv);
        return new Result(code, out.toString(StandardCharsets.UTF_8), err.toString(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("without the plugin, the pipeline that names a custom class does not validate")
    void failsWithoutThePlugin() {
        Result result = run("validate", "--metadata", metadata.toString());

        assertEquals(1, result.code(), result.out() + result.err());
        assertTrue(result.err().contains("error[unknown-transform-class]"), result.err());
        assertTrue(result.err().contains("com.example.retail.OrderRiskScore"), result.err());
        assertTrue(result.err().contains("--plugins"), result.err());
        assertTrue(result.err().contains("order_risk.yaml:"),
                "the diagnostic points at the line that names the class: " + result.err());
    }

    @Test
    @DisplayName("with the plugin, everything validates")
    void validatesWithThePlugin() {
        Result result = run("validate", "--metadata", metadata.toString(),
                "--plugins", plugin.toString());

        assertEquals(0, result.code(), result.err());
        assertTrue(result.out().contains("all valid"), result.out());
    }

    @Test
    @DisplayName("a directory of compiled classes works as well as a jar")
    void acceptsADirectory() {
        Result result = run("validate", "--metadata", metadata.toString(),
                "--plugins", pluginClasses.toString());

        assertEquals(0, result.code(), result.err());
        assertTrue(result.out().contains("all valid"), result.out());
    }

    @Test
    @DisplayName("a plugin path that does not exist is reported, not ignored")
    void rejectsAMissingPluginPath() {
        Result result = run("validate", "--metadata", metadata.toString(),
                "--plugins", "/no/such/place.jar");

        assertEquals(1, result.code());
        assertTrue(result.err().contains("/no/such/place.jar"), result.err());
    }

    @Test
    @DisplayName("the plan names the custom step and the contract it promises")
    void plansTheCustomStep() {
        Result result = run("plan", "--metadata", metadata.toString(),
                "--pipeline", "order_risk", "--plugins", plugin.toString());

        assertEquals(0, result.code(), result.err());
        assertTrue(result.out().contains("scored: java (com.example.retail.OrderRiskScore) <- lines"),
                result.out());
        assertTrue(result.out().contains("risk_reasons: array<string>"), result.out());
        assertTrue(result.out().contains("by_region: aggregate <- scored"),
                "declarative work downstream of the custom step is planned as usual");
    }

    @Test
    @DisplayName("the whole thing runs: declarative load, custom scoring, declarative rollup")
    void runsEndToEnd(@TempDir Path warehouse) throws IOException {
        for (String name : List.of("orders", "customers", "products")) {
            Path landing = warehouse.resolve("landing").resolve(name);
            Files.createDirectories(landing);
            Files.copy(seed.resolve(name + ".csv"), landing.resolve(name + ".csv"));
        }

        Result load = run("run", "--metadata", metadata.toString(), "--pipeline", "orders_daily",
                "--data", warehouse.toString(), "--param", "run_date=2026-03-05", "--quiet");
        assertEquals(0, load.code(), load.err());

        Result score = run("run", "--metadata", metadata.toString(), "--pipeline", "order_risk",
                "--data", warehouse.toString(), "--plugins", plugin.toString(), "--quiet");

        assertEquals(0, score.code(), score.err());
        assertTrue(score.out().contains("wrote 9 rows to order_risk"), score.out());
        assertTrue(score.out().contains("ok       every_line_is_scored"), score.out());
        assertTrue(score.out().contains("ok       scores_are_in_range"), score.out());
        assertTrue(score.out().contains("ok       bands_are_known"), score.out());
        assertFalse(score.out().contains("FAILED"), score.out());

        assertTrue(Files.isDirectory(warehouse.resolve("marts/order_risk")));
        assertTrue(Files.isDirectory(warehouse.resolve("marts/risk_by_region")));
    }

    @Test
    @DisplayName("the custom step is described in the generated catalogue")
    void documentsTheCustomStep(@TempDir Path out) throws IOException {
        Path file = out.resolve("catalogue.md");
        Result result = run("docs", "--metadata", metadata.toString(),
                "--plugins", plugin.toString(), "--out", file.toString());

        assertEquals(0, result.code(), result.err());
        String catalogue = Files.readString(file);
        assertTrue(catalogue.contains("### Pipeline: order_risk"), "the pipeline has a section");
        assertTrue(catalogue.contains("| `scored` | `java` |"), "the step is listed with its type");
        assertTrue(catalogue.contains("`com.example.retail.OrderRiskScore`"),
                "and with the class that does the work");
        assertTrue(catalogue.contains("`array<string>`"), "its declared types reach the page");
        assertTrue(catalogue.contains("`lines.line_total`"),
                "the declared lineage reaches the page");
    }
}
