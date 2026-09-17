package dev.foundry.core.plan;

import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataRepository;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * A small metadata root for planner tests: two landing schemas, one curated
 * output, and whatever pipeline the test wants to try against them.
 */
final class Fixtures {

    static final String SCHEMAS = """
            kind: schema
            name: retail.orders
            fields:
              - name: order_id
                type: string
                nullable: false
              - name: customer_id
                type: string
              - name: quantity
                type: int
              - name: unit_price
                type: "decimal(12,2)"
              - name: ordered_at
                type: timestamp
              - name: status
                type: string
            ---
            kind: schema
            name: retail.customers
            fields:
              - name: customer_id
                type: string
                nullable: false
              - name: region
                type: string
              - name: status
                type: string
            ---
            kind: schema
            name: retail.lines
            fields:
              - name: order_id
                type: string
              - name: region
                type: string
              - name: line_total
                type: "decimal(14,2)"
            ---
            kind: schema
            name: retail.quarantine
            fields:
              - name: pipeline
                type: string
                nullable: false
              - name: step
                type: string
                nullable: false
              - name: expectation
                type: string
                nullable: false
              - name: rule
                type: string
                nullable: false
              - name: detected_at
                type: timestamp
                nullable: false
              - name: row
                type: string
                nullable: false
            """;

    static final String DATASETS = """
            kind: dataset
            name: landing_orders
            schema: retail.orders
            format: csv
            location: "${data}/landing/orders"
            enforcement: additive
            options:
              header: "true"
            ---
            kind: dataset
            name: landing_customers
            schema: retail.customers
            format: csv
            location: "${data}/landing/customers"
            enforcement: additive
            options:
              header: "true"
            ---
            kind: dataset
            name: curated_lines
            schema: retail.lines
            format: parquet
            location: "${data}/curated/lines"
            ---
            kind: dataset
            name: rejects
            schema: retail.quarantine
            format: parquet
            location: "${data}/quarantine"
            writeMode: append
            """;

    /** A pipeline that plans cleanly, for tests that want to change one thing. */
    static final String GOOD_PIPELINE = """
            kind: pipeline
            name: p
            sources:
              - alias: orders
                dataset: landing_orders
              - alias: customers
                dataset: landing_customers
            steps:
              - id: priced
                type: derive
                from: orders
                columns:
                  - name: line_total
                    expr: "quantity * unit_price"
                    type: "decimal(14,2)"
              - id: regions
                type: select
                from: customers
                columns: [customer_id, region]
              - id: joined
                type: join
                left: priced
                right: regions
                on: [customer_id]
              - id: output
                type: select
                from: joined
                columns: [order_id, region, line_total]
            sinks:
              - from: output
                dataset: curated_lines
            """;

    private Fixtures() {
    }

    static Path write(Path root, String name, String content) {
        try {
            Path file = root.resolve(name);
            Files.createDirectories(file.getParent());
            Files.writeString(file, content, StandardCharsets.UTF_8);
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Lays out the fixture with {@code pipeline} as the only pipeline. */
    static Path metadata(Path root, String pipeline) {
        write(root, "schemas.yaml", SCHEMAS);
        write(root, "datasets.yaml", DATASETS);
        write(root, "pipelines/p.yaml", pipeline);
        return root;
    }

    /** Everything the loader and the planner have to say about a pipeline. */
    static Diagnostics diagnose(Path root, String pipeline) {
        metadata(root, pipeline);
        Diagnostics diagnostics = new Diagnostics();
        MetadataRepository repository = MetadataRepository.load(root, diagnostics);
        repository.pipeline("p").ifPresent(spec ->
                Planner.standard().plan(repository, spec, diagnostics));
        return diagnostics;
    }

    /** The plan, insisting that it be a clean one. */
    static PipelinePlan plan(Path root, String pipeline) {
        metadata(root, pipeline);
        MetadataRepository repository = MetadataRepository.load(root);
        return Planner.standard().plan(repository, repository.requirePipeline("p"));
    }

    /** The one error a test expects, failing usefully when there is not exactly one. */
    static dev.foundry.metadata.Diagnostic onlyError(Diagnostics diagnostics) {
        var errors = diagnostics.errors();
        if (errors.size() != 1) {
            throw new AssertionError("expected exactly one error, got " + errors.size()
                    + ":\n" + diagnostics.render());
        }
        return errors.get(0);
    }
}
