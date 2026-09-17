package dev.foundry.metadata.model;

/** What a sink does with data that is already at its location. */
public enum WriteMode {
    OVERWRITE,
    APPEND,
    ERROR_IF_EXISTS,
    IGNORE;

    /** The corresponding Spark {@code SaveMode} name. */
    public String sparkMode() {
        return switch (this) {
            case OVERWRITE -> "overwrite";
            case APPEND -> "append";
            case ERROR_IF_EXISTS -> "errorifexists";
            case IGNORE -> "ignore";
        };
    }
}
