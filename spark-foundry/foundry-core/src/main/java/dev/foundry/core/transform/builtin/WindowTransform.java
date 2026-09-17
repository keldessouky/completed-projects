package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.ColumnDef;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.OrderKey;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.expressions.Window;
import org.apache.spark.sql.expressions.WindowSpec;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Adds columns computed over a window: running totals, ranks, previous values.
 *
 * <p>The window is declared once, at the step, and every column in the step uses
 * it. That is a deliberate restriction: a step whose columns each need a
 * different frame is really several steps, and writing it as several steps keeps
 * each frame visible next to what it produces.
 */
public final class WindowTransform implements Transform {

    private static final Set<String> FRAME_KEYS = Set.of("type", "start", "end");

    @Override
    public String type() {
        return "window";
    }

    @Override
    public String summary() {
        return "Add columns computed over a window: running totals, ranks, lag and lead.";
    }

    @Override
    public Set<String> configKeys() {
        return Set.of("from", "partitionBy", "orderBy", "frame", "columns");
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        return Transforms.singleInput(step, "from");
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        String from = Transforms.inputName(context.step(), "from");
        FieldSet input = context.input(from);

        Transforms.requireColumns(context, context.config(), "partitionBy", input);
        List<OrderKey> ordering = Transforms.orderBy(context.config(), "orderBy", context, input);
        if (context.config().has("frame")) {
            checkFrame(context);
            if (ordering.isEmpty()) {
                context.error("missing-order", context.where(),
                        "a frame needs an 'orderBy' to be meaningful");
            }
        }

        FieldSet output = FieldSet.of(input.fields().stream().map(f -> f.carriedFrom(from)).toList());
        for (ColumnDef def : Transforms.columns(context.config(), "columns", context)) {
            if (input.has(def.name())) {
                context.error("duplicate-column", def.where(),
                        "window column '" + def.name() + "' would overwrite an input column",
                        "give it a different name so both remain available");
                continue;
            }
            output = output.with(Transforms.planColumn(context, def, input, from));
        }
        return output;
    }

    private void checkFrame(PlanContext context) {
        YamlNode frame = context.config().required("frame").requireMapping();
        context.diagnostics().addAll(frame.unknownKeys(FRAME_KEYS));
        try {
            frameType(frame);
            boundary(frame, "start", Window.unboundedPreceding());
            boundary(frame, "end", Window.currentRow());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
        }
    }

    private static String frameType(YamlNode frame) {
        String type = frame.str("type", "rows").toLowerCase(Locale.ROOT);
        if (!type.equals("rows") && !type.equals("range")) {
            throw new MetadataException(Diagnostic.error("invalid-frame", frame.where(),
                    "'" + type + "' is not a frame type", "write 'rows' or 'range'"));
        }
        return type;
    }

    /**
     * A frame boundary: an offset in rows, or one of the three named edges.
     * Negative offsets look back, positive ones look forward.
     */
    private static long boundary(YamlNode frame, String key, long fallback) {
        if (!frame.has(key)) {
            return fallback;
        }
        String raw = frame.str(key).trim().toLowerCase(Locale.ROOT).replace(" ", "");
        return switch (raw) {
            case "unbounded", "unboundedpreceding" -> Window.unboundedPreceding();
            case "unboundedfollowing" -> Window.unboundedFollowing();
            case "current", "currentrow" -> Window.currentRow();
            default -> {
                try {
                    yield Long.parseLong(raw);
                } catch (NumberFormatException e) {
                    throw new MetadataException(Diagnostic.error("invalid-frame",
                            frame.required(key).where(),
                            "'" + raw + "' is not a frame boundary",
                            "use a whole number of rows, or 'unbounded preceding',"
                                    + " 'current row' or 'unbounded following'"));
                }
            }
        };
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        Dataset<Row> input = context.input(context.config().str("from"));
        WindowSpec window = buildWindow(context);

        Dataset<Row> result = input;
        for (ColumnDef def : SelectTransform.columnDefs(context)) {
            Column column = functions.expr(context.resolve(def.expr(), def.where())).over(window);
            if (def.type() != null) {
                column = column.cast(dev.foundry.core.schema.Types.parse(def.type(), def.where()));
            }
            result = result.withColumn(def.name(), column);
        }
        return result;
    }

    private WindowSpec buildWindow(ExecContext context) {
        List<Column> partition = new ArrayList<>();
        for (var node : context.config().list("partitionBy")) {
            partition.add(functions.col(node.asString()));
        }
        List<Column> ordering = new ArrayList<>();
        for (OrderKey key : Transforms.orderBy(context.config(), "orderBy")) {
            ordering.add(key.toColumn());
        }

        WindowSpec window = Window.partitionBy(partition.toArray(new Column[0]))
                .orderBy(ordering.toArray(new Column[0]));
        if (!context.config().has("frame")) {
            return window;
        }
        YamlNode frame = context.config().required("frame");
        long start = boundary(frame, "start", Window.unboundedPreceding());
        long end = boundary(frame, "end", Window.currentRow());
        return frameType(frame).equals("range")
                ? window.rangeBetween(start, end)
                : window.rowsBetween(start, end);
    }
}
