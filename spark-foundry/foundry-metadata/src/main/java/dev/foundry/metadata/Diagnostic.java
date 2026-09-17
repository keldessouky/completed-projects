package dev.foundry.metadata;

import java.util.Objects;

/**
 * One problem found in the metadata.
 *
 * @param severity whether this stops the build
 * @param code     a stable identifier, e.g. {@code unknown-column}, so rules can
 *                 be looked up in the reference and asserted on in tests
 * @param where    the position in the metadata that is at fault
 * @param message  what is wrong, in one line
 * @param hint     optionally, what to do about it
 */
public record Diagnostic(Severity severity, String code, SourceRef where, String message, String hint) {

    public Diagnostic {
        Objects.requireNonNull(severity, "severity");
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(where, "where");
        Objects.requireNonNull(message, "message");
    }

    public static Diagnostic error(String code, SourceRef where, String message) {
        return new Diagnostic(Severity.ERROR, code, where, message, null);
    }

    public static Diagnostic error(String code, SourceRef where, String message, String hint) {
        return new Diagnostic(Severity.ERROR, code, where, message, hint);
    }

    public static Diagnostic warning(String code, SourceRef where, String message) {
        return new Diagnostic(Severity.WARNING, code, where, message, null);
    }

    public static Diagnostic warning(String code, SourceRef where, String message, String hint) {
        return new Diagnostic(Severity.WARNING, code, where, message, hint);
    }

    /** Renders as {@code file:line:col: error[code]: message} plus an indented hint. */
    public String render() {
        StringBuilder sb = new StringBuilder();
        sb.append(where.describe()).append(": ")
          .append(severity.lower()).append('[').append(code).append("]: ")
          .append(message);
        if (hint != null && !hint.isBlank()) {
            sb.append(System.lineSeparator()).append("        hint: ").append(hint);
        }
        return sb.toString();
    }

    @Override
    public String toString() {
        return render();
    }
}
