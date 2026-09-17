package dev.foundry.metadata;

import java.util.List;

/**
 * Thrown when metadata cannot be loaded or does not hold together.
 *
 * <p>The message is the full diagnostic report rather than a single line: by
 * the time this is thrown, every problem that could be found has been found,
 * and printing them all is the whole point.
 */
public class MetadataException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final transient Diagnostics diagnostics;
    private final String summary;

    public MetadataException(String summary, Diagnostics diagnostics) {
        super(buildMessage(summary, diagnostics));
        this.summary = summary;
        this.diagnostics = diagnostics;
    }

    public MetadataException(Diagnostic diagnostic) {
        this(diagnostic.message(), single(diagnostic));
    }

    private static Diagnostics single(Diagnostic diagnostic) {
        Diagnostics d = new Diagnostics();
        d.add(diagnostic);
        return d;
    }

    private static String buildMessage(String summary, Diagnostics diagnostics) {
        int errors = diagnostics.errors().size();
        StringBuilder sb = new StringBuilder(summary)
                .append(" (").append(errors).append(errors == 1 ? " error" : " errors").append(')')
                .append(System.lineSeparator());
        sb.append(diagnostics.render());
        return sb.toString();
    }

    public Diagnostics diagnostics() {
        return diagnostics;
    }

    public List<Diagnostic> errors() {
        return diagnostics.errors();
    }

    public String summary() {
        return summary;
    }
}
