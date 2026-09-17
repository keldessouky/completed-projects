package dev.foundry.cli;

/** A mistake in how the command was invoked, as opposed to a problem in the metadata. */
class UsageError extends RuntimeException {

    private static final long serialVersionUID = 1L;

    UsageError(String message) {
        super(message);
    }
}
