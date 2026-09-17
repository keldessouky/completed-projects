package dev.foundry.core.transform;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.model.StepSpec;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

import java.util.List;
import java.util.Set;

/**
 * One kind of step, both as the planner sees it and as Spark runs it.
 *
 * <p>The defining decision of this framework is that a transform implements
 * {@link #plan} and {@link #execute} side by side, in one class. Planning says
 * what the output will look like; execution produces it. Keeping them together
 * means a change to one is made with the other in view - and the runner then
 * checks that they agreed, on every step of every run, by comparing the planned
 * {@link FieldSet} against the schema Spark actually returned.
 *
 * <p>Without that pairing, static analysis of a pipeline would be a second,
 * separate model of what the engine does: useful right up until it quietly
 * drifts, at which point it is worse than nothing.
 *
 * <p>A transform also owns its configuration. It declares the keys it accepts
 * ({@link #configKeys()}) so that unknown ones are rejected with a suggestion,
 * and it validates its own options during planning. Adding a transform is
 * therefore a single class and a single registry line - no change to the
 * loader, the planner or the runner.
 */
public interface Transform {

    /** The name used as {@code type:} in a step. */
    String type();

    /** One line for the generated reference documentation. */
    String summary();

    /** The configuration keys this transform understands, beyond the reserved ones. */
    Set<String> configKeys();

    /**
     * The upstream names this step reads.
     *
     * <p>Called before any planning, with nothing resolved, so it may only look
     * at the step's own configuration. It may throw a
     * {@link dev.foundry.metadata.MetadataException} if the configuration is so
     * malformed that no dependency can be read out of it.
     */
    List<InputRef> inputs(StepSpec step);

    /**
     * Validates this step against its inputs and returns the columns it produces.
     *
     * <p>Problems are reported into {@link PlanContext#diagnostics()} rather than
     * thrown wherever the transform can still describe its output, so that one
     * bad column does not hide the rest of the pipeline.
     */
    FieldSet plan(PlanContext context);

    /** Produces the step's result. Called only after planning succeeded. */
    Dataset<Row> execute(ExecContext context);
}
