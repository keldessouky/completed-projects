package dev.foundry.cli;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The three commands that never start Spark.
 *
 * <p>Their exit codes matter as much as their output: {@code foundry validate} is
 * meant to sit in a pre-commit hook and in CI, where the only thing anyone reads
 * is whether it returned zero.
 */
class FoundryCliTest {

    private record Result(int code, String out, String err) {
        boolean ok() {
            return code == 0;
        }
    }

    private static Result run(String... argv) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = new Foundry(new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8)).run(argv);
        return new Result(code, out.toString(StandardCharsets.UTF_8), err.toString(StandardCharsets.UTF_8));
    }

    private static Path examples() {
        Path fromModule = Path.of("..", "examples", "retail", "metadata");
        return Files.isDirectory(fromModule) ? fromModule : Path.of("examples", "retail", "metadata");
    }

    private static Path broken(Path root) throws Exception {
        Files.createDirectories(root);
        Files.writeString(root.resolve("m.yaml"), """
                kind: schema
                name: t.rows
                fields:
                  - name: id
                    type: string
                ---
                kind: dataset
                name: landing
                schema: t.rows
                format: csv
                location: "${data}/landing"
                ---
                kind: pipeline
                name: p
                sources:
                  - alias: rows
                    dataset: landing
                steps:
                  - id: output
                    type: select
                    from: rows
                    columns:
                      - { name: id, expr: "upper(idd)" }
                sinks: []
                """, StandardCharsets.UTF_8);
        return root;
    }

    @Test
    @DisplayName("validate returns zero and a one-line summary for sound metadata")
    void validateAccepts() {
        Result result = run("validate", "--metadata", examples().toString());
        assertTrue(result.ok(), result.err());
        assertTrue(result.out().contains("all valid"), result.out());
        assertTrue(result.out().contains("2 pipeline(s)"), result.out());
    }

    @Test
    @DisplayName("validate returns non-zero and points at the line that is wrong")
    void validateRejects(@TempDir Path root) throws Exception {
        Result result = run("validate", "--metadata", broken(root).toString());
        assertEquals(1, result.code());
        assertTrue(result.err().contains("error[unknown-column]"), result.err());
        assertTrue(result.err().contains("did you mean 'id'?"), result.err());
        assertTrue(result.err().contains("m.yaml:"), result.err());
    }

    @Test
    @DisplayName("plan prints the graph, the columns and the rules")
    void planPrints() {
        Result result = run("plan", "--metadata", examples().toString(), "--pipeline", "orders_daily");
        assertTrue(result.ok(), result.err());
        assertTrue(result.out().contains("pipeline orders_daily"));
        assertTrue(result.out().contains("sources"));
        assertTrue(result.out().contains("latest_lines: deduplicate <- in_scope"));
        assertTrue(result.out().contains("line_total: decimal(14,2)"));
        assertTrue(result.out().contains("[expect referential -> quarantine]"));
        assertTrue(result.out().contains("curated_lines -> curated_order_lines"));
    }

    @Test
    @DisplayName("docs writes a catalogue where it is told to")
    void docsWritesAFile(@TempDir Path root) throws Exception {
        Path out = root.resolve("nested").resolve("catalogue.md");
        Result result = run("docs", "--metadata", examples().toString(), "--out", out.toString());

        assertTrue(result.ok(), result.err());
        assertTrue(Files.exists(out));
        assertTrue(Files.readString(out).contains("# Data catalogue"));
        assertTrue(result.out().contains("wrote "));
    }

    @Test
    @DisplayName("docs with no --out prints to standard output")
    void docsPrints() {
        Result result = run("docs", "--metadata", examples().toString());
        assertTrue(result.ok(), result.err());
        assertTrue(result.out().startsWith("# Data catalogue"));
    }

    @Test
    @DisplayName("a missing required option explains itself and shows the usage")
    void missingOption() {
        Result result = run("validate");
        assertEquals(2, result.code());
        assertTrue(result.err().contains("--metadata is required"), result.err());
        assertTrue(result.err().contains("Usage:"), result.err());
    }

    @Test
    @DisplayName("a misspelled option is rejected with the right one offered")
    void unknownOption() {
        Result result = run("validate", "--metadat", examples().toString());
        assertEquals(2, result.code());
        assertTrue(result.err().contains("unknown option --metadat"), result.err());
        assertTrue(result.err().contains("did you mean 'metadata'?"), result.err());
    }

    @Test
    @DisplayName("a misspelled command is rejected with the right one offered")
    void unknownCommand() {
        Result result = run("validte", "--metadata", examples().toString());
        assertEquals(2, result.code());
        assertTrue(result.err().contains("unknown command 'validte'"), result.err());
        assertTrue(result.err().contains("did you mean 'validate'?"), result.err());
    }

    @Test
    @DisplayName("a pipeline that does not exist suggests one that does")
    void unknownPipeline() {
        Result result = run("plan", "--metadata", examples().toString(), "--pipeline", "orders_dail");
        assertEquals(1, result.code());
        assertTrue(result.err().contains("unknown pipeline 'orders_dail'"), result.err());
        assertTrue(result.err().contains("did you mean 'orders_daily'?"), result.err());
    }

    @Test
    @DisplayName("no arguments prints the usage and returns non-zero")
    void noArguments() {
        Result result = run();
        assertEquals(2, result.code());
        assertTrue(result.out().contains("foundry - build Spark ETL pipelines from metadata"));
    }

    @Test
    @DisplayName("help is asked for on purpose, so it returns zero")
    void help() {
        Result result = run("--help");
        assertTrue(result.ok());
        assertTrue(result.out().contains("Usage:"));
        assertTrue(result.out().contains("never start Spark"));
    }

    @Test
    @DisplayName("options may be written --name value or --name=value, and repeated")
    void argumentForms() {
        Args args = Args.parse(new String[]{
                "--metadata", "a", "--pipeline=b", "--param", "x=1", "--param=y=2", "--quiet"}, 0);

        assertEquals("a", args.get("metadata").orElseThrow());
        assertEquals("b", args.get("pipeline").orElseThrow());
        assertEquals(java.util.Map.of("x", "1", "y", "2"), args.params("param"));
        assertTrue(args.flag("quiet"));
        assertTrue(args.get("nothing").isEmpty());
    }

    @Test
    @DisplayName("a --param without an equals sign is rejected")
    void malformedParam() {
        Args args = Args.parse(new String[]{"--param", "justaname"}, 0);
        assertTrue(org.junit.jupiter.api.Assertions
                .assertThrows(UsageError.class, () -> args.params("param"))
                .getMessage().contains("name=value"));
    }
}
