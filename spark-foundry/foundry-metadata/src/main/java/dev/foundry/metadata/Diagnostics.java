package dev.foundry.metadata;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * A collector for {@link Diagnostic}s.
 *
 * <p>Validation deliberately does not stop at the first problem. A pipeline
 * author would rather see every broken reference in one pass than fix them one
 * build at a time, so both the loader and the planner keep going after an error
 * wherever they can still make sense of what follows.
 */
public final class Diagnostics {

    private final List<Diagnostic> entries = new ArrayList<>();

    public void add(Diagnostic diagnostic) {
        entries.add(diagnostic);
    }

    public void addAll(Collection<Diagnostic> diagnostics) {
        entries.addAll(diagnostics);
    }

    public void error(String code, SourceRef where, String message) {
        add(Diagnostic.error(code, where, message));
    }

    public void error(String code, SourceRef where, String message, String hint) {
        add(Diagnostic.error(code, where, message, hint));
    }

    public void warning(String code, SourceRef where, String message) {
        add(Diagnostic.warning(code, where, message));
    }

    public void warning(String code, SourceRef where, String message, String hint) {
        add(Diagnostic.warning(code, where, message, hint));
    }

    public List<Diagnostic> all() {
        return Collections.unmodifiableList(entries);
    }

    public List<Diagnostic> errors() {
        return entries.stream().filter(d -> d.severity() == Severity.ERROR).toList();
    }

    public List<Diagnostic> warnings() {
        return entries.stream().filter(d -> d.severity() == Severity.WARNING).toList();
    }

    public boolean hasErrors() {
        return entries.stream().anyMatch(d -> d.severity() == Severity.ERROR);
    }

    public boolean isEmpty() {
        return entries.isEmpty();
    }

    public int size() {
        return entries.size();
    }

    /** True when any diagnostic carries this code. Tests assert on codes, not prose. */
    public boolean hasCode(String code) {
        return entries.stream().anyMatch(d -> d.code().equals(code));
    }

    /** Errors first, then by file and line, so the report reads top to bottom. */
    public List<Diagnostic> sorted() {
        return entries.stream()
                .sorted(Comparator.comparing((Diagnostic d) -> d.severity().ordinal())
                        .thenComparing(d -> d.where().file())
                        .thenComparingInt(d -> d.where().line())
                        .thenComparingInt(d -> d.where().column()))
                .toList();
    }

    /** The whole report as text, one diagnostic per line (plus hint lines). */
    public String render() {
        StringBuilder sb = new StringBuilder();
        for (Diagnostic d : sorted()) {
            sb.append(d.render()).append(System.lineSeparator());
        }
        return sb.toString();
    }

    /** Throws if anything failed; otherwise returns quietly so callers can chain. */
    public void throwIfErrors(String what) {
        if (hasErrors()) {
            throw new MetadataException(what, this);
        }
    }

    @Override
    public String toString() {
        return render();
    }
}
