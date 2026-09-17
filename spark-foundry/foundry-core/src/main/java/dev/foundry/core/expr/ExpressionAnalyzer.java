package dev.foundry.core.expr;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;

import org.apache.spark.sql.catalyst.analysis.UnresolvedAttribute;
import org.apache.spark.sql.catalyst.expressions.UnresolvedNamedLambdaVariable;
import org.apache.spark.sql.catalyst.expressions.Expression;
import org.apache.spark.sql.catalyst.parser.CatalystSqlParser$;
import org.apache.spark.sql.types.DataType;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Static analysis of the SQL expressions embedded in pipeline metadata.
 *
 * <p>This is the piece that earns the phrase "metadata as code". A pipeline is
 * full of expression strings - {@code quantity * unit_price},
 * {@code sum(line_total)}, {@code region in ('emea','apac')} - and in most
 * declarative ETL tools those strings are opaque until the job runs and fails.
 *
 * <p>Here they are parsed with Spark's own {@code CatalystSqlParser} and walked
 * for the columns they touch, which is then checked against the schema the
 * planner says flows into that step. A misspelled column is a build failure with
 * a line number and a suggestion, seconds after it is typed - not a stack trace
 * forty minutes into a nightly load.
 *
 * <p>Crucially this needs no {@code SparkSession}: the parser is a pure function
 * from text to a syntax tree. Nothing is started, nothing is read.
 *
 * <p>What it deliberately does not do is infer result types. Typing
 * {@code sum(quantity * unit_price)} means running Spark's analyser against a
 * real catalog, so the planner records such columns as inferred and the runner
 * reports the type Spark settled on. See {@link PlanField}.
 */
public final class ExpressionAnalyzer {

    private ExpressionAnalyzer() {
    }

    /** Parses an expression, or throws a positioned diagnostic. */
    public static Expression parse(String expression, SourceRef where) {
        if (expression == null || expression.isBlank()) {
            throw new MetadataException(Diagnostic.error("empty-expression", where,
                    "an expression is required here"));
        }
        try {
            return CatalystSqlParser$.MODULE$.parseExpression(expression);
        } catch (Exception e) {
            // Spark's ParseException descends from AnalysisException, which is a
            // checked exception on the Scala side and so invisible to javac.
            // Catching RuntimeException would let every syntax error escape.
            throw new MetadataException(Diagnostic.error("invalid-expression", where,
                    "cannot parse expression: " + expression,
                    firstLine(e.getMessage())));
        }
    }

    /** Every column an expression refers to, in the order the parser met them. */
    public static List<ColumnRef> references(String expression, SourceRef where) {
        Expression parsed = parse(expression, where);
        List<ColumnRef> refs = new ArrayList<>();
        Set<String> lambdaVariables = new LinkedHashSet<>();
        collectLambdaVariables(parsed, lambdaVariables);
        collectReferences(parsed, refs, lambdaVariables);
        return refs;
    }

    /**
     * Checks an expression against the columns available to it.
     *
     * @param qualifiers aliases the expression may legally prefix a column with,
     *                   such as the step's own input name in a join
     * @param context    what to call this expression in the message, e.g.
     *                   {@code "column 'line_total'"}
     */
    public static void validate(String expression,
                                SourceRef where,
                                FieldSet input,
                                Set<String> qualifiers,
                                String context,
                                Diagnostics diagnostics) {
        List<ColumnRef> refs;
        try {
            refs = references(expression, where);
        } catch (MetadataException e) {
            diagnostics.addAll(e.diagnostics().all());
            return;
        }
        for (ColumnRef ref : refs) {
            resolve(ref, input, qualifiers).report(ref, where, input, context, diagnostics);
        }
    }

    /** As {@link #validate} with no legal qualifiers. */
    public static void validate(String expression,
                                SourceRef where,
                                FieldSet input,
                                String context,
                                Diagnostics diagnostics) {
        validate(expression, where, input, Set.of(), context, diagnostics);
    }

    // ------------------------------------------------------------- resolution

    /** How a reference resolved, and what to say when it did not. */
    private sealed interface Resolution {

        void report(ColumnRef ref, SourceRef where, FieldSet input, String context, Diagnostics diagnostics);

        record Ok() implements Resolution {
            @Override
            public void report(ColumnRef ref, SourceRef where, FieldSet input,
                               String context, Diagnostics diagnostics) {
                // Nothing to say.
            }
        }

        record UnknownColumn(String name) implements Resolution {
            @Override
            public void report(ColumnRef ref, SourceRef where, FieldSet input,
                               String context, Diagnostics diagnostics) {
                diagnostics.error("unknown-column", where,
                        context + " refers to column '" + name + "', which is not available here",
                        Suggest.hint(name, input.names()));
            }
        }

        record NotAStruct(String path, String type) implements Resolution {
            @Override
            public void report(ColumnRef ref, SourceRef where, FieldSet input,
                               String context, Diagnostics diagnostics) {
                diagnostics.error("not-a-struct", where,
                        context + " reads '" + ref.dotted() + "', but '" + path + "' is " + type
                                + ", not a struct");
            }
        }

        record UnknownNestedField(String path, String name, Set<String> available) implements Resolution {
            @Override
            public void report(ColumnRef ref, SourceRef where, FieldSet input,
                               String context, Diagnostics diagnostics) {
                diagnostics.error("unknown-column", where,
                        context + " reads '" + ref.dotted() + "', but struct '" + path
                                + "' has no field '" + name + "'",
                        Suggest.hint(name, available));
            }
        }
    }

    private static Resolution resolve(ColumnRef ref, FieldSet input, Set<String> qualifiers) {
        List<String> parts = ref.parts();
        // A leading qualifier only counts as one when it cannot be a real column;
        // a column genuinely named like the alias wins, as it does in Spark.
        if (parts.size() > 1 && qualifiers.contains(parts.get(0)) && !input.has(parts.get(0))) {
            parts = parts.subList(1, parts.size());
        }
        if (parts.isEmpty()) {
            return new Resolution.Ok();
        }

        String head = parts.get(0);
        Optional<PlanField> field = input.get(head);
        if (field.isEmpty()) {
            return new Resolution.UnknownColumn(head);
        }
        if (parts.size() == 1) {
            return new Resolution.Ok();
        }

        // A type the planner never claimed cannot be walked into, and a column
        // it left open is not evidence of a mistake - accept and move on.
        Optional<DataType> type = field.get().declaredType();
        if (type.isEmpty()) {
            return new Resolution.Ok();
        }

        DataType current = type.get();
        StringBuilder path = new StringBuilder(head);
        for (int i = 1; i < parts.size(); i++) {
            if (!(current instanceof StructType struct)) {
                return new Resolution.NotAStruct(path.toString(), current.simpleString());
            }
            String part = parts.get(i);
            Optional<Object> index = toOptional(struct.getFieldIndex(part));
            if (index.isEmpty()) {
                Set<String> available = new LinkedHashSet<>(List.of(struct.fieldNames()));
                return new Resolution.UnknownNestedField(path.toString(), part, available);
            }
            current = struct.fields()[(Integer) index.get()].dataType();
            path.append('.').append(part);
        }
        return new Resolution.Ok();
    }

    @SuppressWarnings("unchecked")
    private static Optional<Object> toOptional(scala.Option<?> option) {
        return option.isEmpty() ? Optional.empty() : Optional.of(((scala.Option<Object>) option).get());
    }

    // -------------------------------------------------------------- traversal

    private static void collectReferences(Expression expression, List<ColumnRef> out, Set<String> bound) {
        if (expression instanceof UnresolvedAttribute attribute) {
            List<String> parts = scalaList(attribute.nameParts());
            // Lambda parameters are bound by the expression itself, not supplied
            // by the input schema, so they are not references to check.
            if (!(parts.size() == 1 && bound.contains(parts.get(0)))) {
                out.add(new ColumnRef(parts));
            }
            return;
        }
        scala.collection.Iterator<Expression> children = expression.children().iterator();
        while (children.hasNext()) {
            collectReferences(children.next(), out, bound);
        }
    }

    private static void collectLambdaVariables(Expression expression, Set<String> out) {
        if (expression instanceof UnresolvedNamedLambdaVariable variable) {
            out.addAll(scalaList(variable.nameParts()));
        }
        scala.collection.Iterator<Expression> children = expression.children().iterator();
        while (children.hasNext()) {
            collectLambdaVariables(children.next(), out);
        }
    }

    private static List<String> scalaList(scala.collection.Seq<String> seq) {
        List<String> out = new ArrayList<>(seq.size());
        scala.collection.Iterator<String> it = seq.iterator();
        while (it.hasNext()) {
            out.add(it.next());
        }
        return out;
    }

    private static String firstLine(String message) {
        if (message == null) {
            return null;
        }
        String flat = message.replace('\n', ' ').replace('\r', ' ').trim();
        return flat.length() > 200 ? flat.substring(0, 200) + "..." : flat;
    }
}
