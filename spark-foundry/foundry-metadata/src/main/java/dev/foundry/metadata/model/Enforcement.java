package dev.foundry.metadata.model;

/**
 * How hard a dataset's declared schema is enforced when it is read or written.
 *
 * <p>This is the knob that decides whether a data contract is a promise or a
 * suggestion, so it is declared per dataset rather than set globally: a landing
 * zone fed by someone else's export and a table this pipeline owns deserve
 * different answers.
 */
public enum Enforcement {

    /**
     * The data must match the contract exactly: same columns, same types, no
     * extras. Anything else fails the run before a single row is written.
     */
    STRICT,

    /**
     * Every declared column must be present and of the declared type, but
     * unexpected extra columns are allowed through. The usual choice for a
     * landing zone whose producer adds fields without warning.
     */
    ADDITIVE,

    /**
     * The contract is documentation only. Nothing is checked. Useful while a
     * new source is being explored, and a smell anywhere else.
     */
    NONE
}
