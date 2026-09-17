package dev.foundry.metadata.model;

/** What happens to a run when an expectation is not met. */
public enum ExpectationAction {

    /** Record the breach in the run manifest and carry on. */
    WARN,

    /** Stop the run. Nothing downstream of the breach is written. */
    FAIL,

    /**
     * Divert the offending rows to the pipeline's quarantine dataset and let
     * the clean remainder continue.
     *
     * <p>This is the action that makes a rule safe to add to a live pipeline:
     * bad rows stop polluting the warehouse without the whole load going down,
     * and the quarantine table says exactly which rows and which rule.
     */
    QUARANTINE
}
