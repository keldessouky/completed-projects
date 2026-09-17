package dev.foundry.core.plan;

import dev.foundry.core.schema.FieldSet;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.DatasetSpec;

import org.apache.spark.sql.types.StructType;

/** A resolved input: the alias a pipeline uses, and the contract behind it. */
public record SourcePlan(String alias, DatasetSpec dataset, StructType contract, FieldSet fields, SourceRef where) {
}
