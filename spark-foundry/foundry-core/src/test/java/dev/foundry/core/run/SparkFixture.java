package dev.foundry.core.run;

import org.apache.spark.sql.SparkSession;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

/**
 * One local Spark session, shared by every integration test in this module.
 *
 * <p>Starting a session costs several seconds, and a suite that pays that per
 * test class is a suite people stop running. The session is never stopped: the
 * JVM exiting at the end of the build does that, and stopping it here would only
 * force the next class to pay for a new one.
 */
final class SparkFixture {

    private static SparkSession session;

    private SparkFixture() {
    }

    static synchronized SparkSession session() {
        if (session == null) {
            session = SparkSession.builder()
                    .appName("foundry-tests")
                    .master("local[2]")
                    .config("spark.ui.enabled", "false")
                    .config("spark.sql.shuffle.partitions", "2")
                    .config("spark.sql.warehouse.dir",
                            System.getProperty("java.io.tmpdir") + "/foundry-test-warehouse")
                    .getOrCreate();
            session.sparkContext().setLogLevel("ERROR");
        }
        return session;
    }

    /** The example metadata, wherever the test happens to have been started from. */
    static Path examples() {
        return dev.foundry.core.Examples.root();
    }

    /** Lays the example's seed CSVs into a throwaway warehouse's landing zone. */
    static Path seededWarehouse(Path root) {
        try {
            Path seed = examples().resolve("seed");
            for (String name : new String[]{"orders", "customers", "products"}) {
                Path landing = root.resolve("landing").resolve(name);
                Files.createDirectories(landing);
                Files.copy(seed.resolve(name + ".csv"), landing.resolve(name + ".csv"));
            }
            return root;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Writes a CSV straight into a landing directory, for the IO tests. */
    static void csv(Path directory, String name, String content) {
        try {
            Files.createDirectories(directory);
            Files.writeString(directory.resolve(name), content, java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** True when a directory holds at least one Parquet part file. */
    static boolean hasParquet(Path directory) {
        if (!Files.isDirectory(directory)) {
            return false;
        }
        try (Stream<Path> walk = Files.walk(directory)) {
            return walk.anyMatch(p -> p.getFileName().toString().endsWith(".parquet"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
