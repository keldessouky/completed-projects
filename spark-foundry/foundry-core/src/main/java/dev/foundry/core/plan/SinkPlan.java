package dev.foundry.core.plan;

import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.WriteMode;

import org.apache.spark.sql.types.StructType;

/** A resolved output: which step's result goes to which dataset, and how. */
public record SinkPlan(String from, DatasetSpec dataset, StructType contract, WriteMode mode, SourceRef where) {
}
