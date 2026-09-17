package dev.foundry.core.io;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.core.schema.PlanField;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.Enforcement;

import org.apache.spark.sql.types.DataType;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Checks data - planned or actual - against a declared schema.
 *
 * <p>The same comparison is made twice in a pipeline's life. At planning time it
 * runs against what the planner says a step will produce, so a sink that cannot
 * possibly satisfy its contract is rejected before Spark starts. At run time it
 * runs against what Spark actually produced and what a file actually contains,
 * because a contract that is only checked on paper is not a contract.
 */
public final class Contracts {

    private Contracts() {
    }

    /**
     * Plan-time check: can this step's output satisfy this schema?
     *
     * <p>Types are compared only where the planner committed to one. A column it
     * left for Spark to settle is checked for presence, and verified for real
     * when the data is written.
     */
    public static void checkPlan(FieldSet produced,
                                 StructType expected,
                                 Enforcement enforcement,
                                 SourceRef where,
                                 String context,
                                 Diagnostics diagnostics) {
        if (enforcement == Enforcement.NONE) {
            return;
        }
        Set<String> expectedNames = new LinkedHashSet<>(List.of(expected.fieldNames()));

        for (StructField field : expected.fields()) {
            PlanField planned = produced.get(field.name()).orElse(null);
            if (planned == null) {
                diagnostics.error("contract-missing-column", where,
                        context + " does not produce column '" + field.name() + "', which the contract requires",
                        Suggest.hint(field.name(), produced.names()));
                continue;
            }
            if (planned.typeKnown() && !Objects.equals(planned.type(), field.dataType())) {
                diagnostics.error("contract-type-mismatch", where,
                        context + " produces '" + field.name() + "' as " + planned.typeName()
                                + ", but the contract declares " + field.dataType().simpleString(),
                        "cast it in the pipeline, or change the declared type if the contract is wrong");
            }
        }

        if (enforcement == Enforcement.STRICT) {
            for (PlanField planned : produced.fields()) {
                if (!expectedNames.contains(planned.name())) {
                    diagnostics.error("contract-extra-column", where,
                            context + " produces column '" + planned.name()
                                    + "', which the contract does not declare",
                            "add it to the schema, drop it in the pipeline,"
                                    + " or relax the dataset to 'enforcement: additive'");
                }
            }
        }
    }

    /**
     * Run-time check of a real schema against a contract.
     *
     * @return one message per breach, empty when the data honours the contract
     */
    public static List<String> check(StructType actual, StructType expected, Enforcement enforcement) {
        return check(actual, expected, enforcement, true);
    }

    /**
     * As {@link #check}, but able to compare column names only.
     *
     * <p>Some formats do not carry types. A CSV file is a grid of text: every
     * column in it is a string, and the types come from the contract, which the
     * reader supplies and which a failed parse then enforces. Comparing a
     * contract's {@code decimal(12,2)} against the string the file "has" would
     * reject every typed CSV dataset for a disagreement that is not real.
     *
     * @param compareTypes false when the source's types are an artefact of the
     *                     format rather than a fact about the data
     */
    public static List<String> check(StructType actual, StructType expected,
                                     Enforcement enforcement, boolean compareTypes) {
        List<String> problems = new ArrayList<>();
        if (enforcement == Enforcement.NONE) {
            return problems;
        }
        Set<String> actualNames = new LinkedHashSet<>(List.of(actual.fieldNames()));

        for (StructField field : expected.fields()) {
            if (!actualNames.contains(field.name())) {
                problems.add("column '" + field.name() + "' is declared but the data does not have it"
                        + nearestInData(field.name(), actualNames));
                continue;
            }
            if (!compareTypes) {
                continue;
            }
            DataType actualType = actual.apply(field.name()).dataType();
            if (!Objects.equals(actualType, field.dataType())) {
                problems.add("column '" + field.name() + "' is " + actualType.simpleString()
                        + " but the contract declares " + field.dataType().simpleString());
            }
        }

        if (enforcement == Enforcement.STRICT) {
            Set<String> expectedNames = new LinkedHashSet<>(List.of(expected.fieldNames()));
            for (String name : actualNames) {
                if (!expectedNames.contains(name)) {
                    problems.add("column '" + name + "' is present but not declared");
                }
            }
        }
        return problems;
    }

    /**
     * Points at the column the data does have, when one is close.
     *
     * <p>The suggestion runs the opposite way round from the loader's: there, the
     * metadata is wrong and the data is right; here the contract is the authority
     * and it is the incoming data that has drifted. Saying which of its columns
     * looks like the missing one usually identifies the rename that caused it.
     */
    private static String nearestInData(String declared, Set<String> present) {
        return Suggest.closest(declared, present)
                .map(found -> "; the data has '" + found + "' - has it been renamed?")
                .orElse("");
    }
}
