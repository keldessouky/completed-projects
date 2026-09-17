package dev.foundry.api;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;

import java.util.Set;

/**
 * A transformation written in Java: take the input, transform it, return it.
 *
 * <p>This is the escape hatch for the work that does not want to be YAML -
 * branching business logic, a scoring model, a call into a library, anything
 * with enough substance to deserve its own unit tests. Implement this, put the
 * jar on the path, and name the class from a step:
 *
 * <pre>{@code
 * public final class RiskScore implements DataTransform {
 *     @Override
 *     public Dataset<Row> apply(TransformInput input) {
 *         return input.data().withColumn("risk", ...);
 *     }
 * }
 * }</pre>
 *
 * <pre>{@code
 * - id: scored
 *   type: java
 *   class: com.acme.RiskScore
 *   from: priced_lines
 *   schema: retail.orders.scored     # what this step promises to produce
 * }</pre>
 *
 * <h2>The contract stays in the metadata</h2>
 *
 * <p>A custom transform does not declare its own output schema in code. The step
 * declares it - by naming a schema, or by listing the columns inline - and the
 * runner then checks what this class actually returned against that declaration,
 * exactly as it does for every built-in transform.
 *
 * <p>That split is deliberate. The framework cannot read Java to work out what a
 * class will produce, so if the class were the only statement of its own output
 * then everything downstream of it would be unknowable: no static column
 * checking, no contract check on the sink, no column lineage. Putting the
 * contract in the metadata keeps all of that working, keeps the shape of the
 * data reviewable without reading the implementation, and turns "this class
 * quietly started returning a different column" from a silent corruption into a
 * failed run that names the step.
 *
 * <p>Implementations must have a public no-argument constructor. They are
 * instantiated once per run, on the driver, and everything they need comes from
 * {@link TransformInput}: the data, the pipeline's parameters, and the step's
 * own options.
 */
@FunctionalInterface
public interface DataTransform {

    /**
     * Transforms the step's input into its result.
     *
     * <p>Called once, on the driver. What comes back is a description of a
     * computation, not the data itself, so this method should stay cheap - build
     * the {@code Dataset} and return it rather than collecting anything.
     */
    Dataset<Row> apply(TransformInput input);

    /**
     * Option keys this transform cannot work without.
     *
     * <p>Declaring them here gets them checked when the pipeline is validated, so
     * a step that forgot one fails in a pre-commit hook rather than halfway
     * through a nightly load.
     */
    default Set<String> requiredOptions() {
        return Set.of();
    }

    /** A short phrase for plans and the generated catalogue. */
    default String describe() {
        return getClass().getSimpleName();
    }
}
