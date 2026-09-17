package dev.foundry.core.transform;

import dev.foundry.metadata.SourceRef;

/**
 * An upstream result a step reads, named as the metadata wrote it.
 *
 * <p>Transforms report these before anything is planned, because the planner
 * needs the dependency graph in order to decide what to plan first.
 */
public record InputRef(String name, SourceRef where) {
}
