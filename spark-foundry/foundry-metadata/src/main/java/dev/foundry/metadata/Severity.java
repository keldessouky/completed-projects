package dev.foundry.metadata;

/** How much a {@link Diagnostic} matters. Errors stop a build; warnings do not. */
public enum Severity {
    ERROR,
    WARNING;

    public String lower() {
        return name().toLowerCase(java.util.Locale.ROOT);
    }
}
