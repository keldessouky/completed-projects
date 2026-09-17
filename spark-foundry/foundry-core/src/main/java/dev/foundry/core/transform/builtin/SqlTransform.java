package dev.foundry.core.transform.builtin;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.transform.DeclaredOutputs;
import dev.foundry.core.transform.ExecContext;
import dev.foundry.core.transform.InputRef;
import dev.foundry.core.transform.PlanContext;
import dev.foundry.core.transform.Transform;
import dev.foundry.core.transform.Transforms;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.StepSpec;
import dev.foundry.metadata.yaml.YamlNode;

import org.apache.spark.sql.Column;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.catalyst.analysis.UnresolvedRelation;
import org.apache.spark.sql.catalyst.parser.CatalystSqlParser$;
import org.apache.spark.sql.catalyst.plans.logical.LogicalPlan;
import org.apache.spark.sql.catalyst.plans.logical.UnresolvedWith;
import org.apache.spark.sql.functions;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Runs free-form Spark SQL over the step's declared inputs.
 *
 * <p>The escape hatch, and it still has to declare itself. The query names its
 * inputs, which are registered as temporary views under exactly those names, and
 * it declares the columns it produces. The runner then verifies the result
 * against that declaration like any other step, so a {@code sql} step cannot
 * quietly change the shape of everything downstream of it.
 *
 * <p>Even the query text is checked without a session: it is parsed with Spark's
 * own parser, and every table it reads must be a declared input or a CTE the
 * query itself defines. A join against a table nobody wired up is caught at
 * validation time rather than as a "table or view not found" at 3am.
 *
 * <p>The one thing it cannot do is report exact column lineage. Working out that
 * {@code sum(l.line_total) as spend} reads {@code lines.line_total} means
 * resolving the query against a catalog - that is, re-implementing Spark's
 * analyser, which would be a second model of the engine's behaviour and would
 * drift from it. So an output column is attributed to the same-named column of
 * every input that has one, and to nothing when no name matches. An author who
 * knows better says so with {@code derivedFrom:} on the column, which
 * {@link DeclaredOutputs} then checks against the inputs.
 */
public final class SqlTransform implements Transform {

    @Override
    public String type() {
        return "sql";
    }

    @Override
    public String summary() {
        return "Run Spark SQL over the declared inputs, producing the declared columns.";
    }

    @Override
    public Set<String> configKeys() {
        Set<String> keys = new LinkedHashSet<>(Set.of("inputs", "query"));
        keys.addAll(DeclaredOutputs.CONFIG_KEYS);
        return keys;
    }

    @Override
    public List<InputRef> inputs(StepSpec step) {
        return Transforms.listInput(step, "inputs");
    }

    @Override
    public FieldSet plan(PlanContext context) {
        Transforms.checkKeys(context, configKeys());
        YamlNode queryNode = context.config().required("query");

        String query;
        try {
            query = context.resolve(queryNode.asString(), queryNode.where());
            checkRelations(context, query, queryNode.where());
        } catch (MetadataException e) {
            context.diagnostics().addAll(e.diagnostics().all());
        }

        return DeclaredOutputs.parse(context, "a sql step");
    }

    /** Every table the query reads must be a declared input or one of its own CTEs. */
    private void checkRelations(PlanContext context, String query, SourceRef where) {
        LogicalPlan plan;
        try {
            plan = CatalystSqlParser$.MODULE$.parsePlan(query);
        } catch (Exception e) {
            // ParseException is checked on the Scala side; see ExpressionAnalyzer.
            context.error("invalid-query", where, "cannot parse the query",
                    e.getMessage() == null ? null : e.getMessage().replace('\n', ' ').trim());
            return;
        }

        List<String> relations = new ArrayList<>();
        Set<String> cteNames = new LinkedHashSet<>();
        walk(plan, relations, cteNames);

        Set<String> available = new LinkedHashSet<>(context.inputNames());
        for (String relation : relations) {
            if (available.contains(relation) || cteNames.contains(relation)) {
                continue;
            }
            Set<String> legal = new LinkedHashSet<>(available);
            legal.addAll(cteNames);
            context.error("unknown-relation", where,
                    "the query reads '" + relation + "', which is not one of this step's inputs",
                    Suggest.hint(relation, legal));
        }
    }

    private static void walk(LogicalPlan plan, List<String> relations, Set<String> cteNames) {
        if (plan instanceof UnresolvedRelation relation) {
            relations.add(relation.multipartIdentifier().mkString("."));
        }
        if (plan instanceof UnresolvedWith with) {
            scala.collection.Iterator<? extends scala.Tuple2<String, ?>> cteIterator =
                    with.cteRelations().iterator();
            while (cteIterator.hasNext()) {
                cteNames.add(cteIterator.next()._1());
            }
        }
        scala.collection.Iterator<LogicalPlan> children = plan.children().iterator();
        while (children.hasNext()) {
            walk(children.next(), relations, cteNames);
        }
    }

    @Override
    public Dataset<Row> execute(ExecContext context) {
        // The inputs are registered under the names the query uses. These views
        // are session-scoped and are replaced on each run of the step.
        context.inputs().forEach((name, dataset) -> dataset.createOrReplaceTempView(name));

        YamlNode queryNode = context.config().required("query");
        Dataset<Row> result = context.spark().sql(context.resolve(queryNode.asString(), queryNode.where()));

        // Selecting the declared columns puts the query's result under the same
        // contract as every other step: declared order, declared types.
        List<Column> columns = new ArrayList<>();
        for (var field : context.planned().fields()) {
            Column column = functions.col(field.name());
            columns.add(field.typeKnown() ? column.cast(field.type()).as(field.name()) : column);
        }
        return result.select(columns.toArray(new Column[0]));
    }
}
