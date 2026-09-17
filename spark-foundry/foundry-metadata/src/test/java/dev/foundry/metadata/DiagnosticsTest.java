package dev.foundry.metadata;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DiagnosticsTest {

    private static final SourceRef LATE = new SourceRef("b.yaml", 10, 1);
    private static final SourceRef EARLY = new SourceRef("a.yaml", 2, 3);

    @Test
    @DisplayName("a diagnostic renders like a compiler error, with its hint indented")
    void rendersLikeACompiler() {
        Diagnostic diagnostic = Diagnostic.error("unknown-column", EARLY,
                "column 'custmer_id' is not available here", "did you mean 'customer_id'?");
        String rendered = diagnostic.render();
        assertTrue(rendered.startsWith("a.yaml:2:3: error[unknown-column]: column 'custmer_id'"));
        assertTrue(rendered.contains("hint: did you mean 'customer_id'?"));
    }

    @Test
    @DisplayName("a position-less diagnostic prints just the file")
    void rendersWithoutAPosition() {
        assertEquals("a.yaml", new SourceRef("a.yaml", 0, 0).describe());
    }

    @Test
    @DisplayName("errors sort before warnings, then by file and line")
    void sortsForReading() {
        Diagnostics diagnostics = new Diagnostics();
        diagnostics.warning("w", EARLY, "a warning");
        diagnostics.error("e2", LATE, "second error");
        diagnostics.error("e1", EARLY, "first error");

        assertEquals("e1", diagnostics.sorted().get(0).code());
        assertEquals("e2", diagnostics.sorted().get(1).code());
        assertEquals("w", diagnostics.sorted().get(2).code());
    }

    @Test
    @DisplayName("warnings alone do not stop a build")
    void separatesErrorsFromWarnings() {
        Diagnostics diagnostics = new Diagnostics();
        diagnostics.warning("w", EARLY, "a warning");
        assertFalse(diagnostics.hasErrors());
        assertEquals(1, diagnostics.warnings().size());
        diagnostics.throwIfErrors("should not throw");

        diagnostics.error("e", EARLY, "an error");
        assertTrue(diagnostics.hasErrors());
        assertTrue(diagnostics.hasCode("e"));
    }

    @Test
    @DisplayName("the thrown report counts the errors and includes every one of them")
    void reportsEverythingAtOnce() {
        Diagnostics diagnostics = new Diagnostics();
        diagnostics.error("one", EARLY, "first problem");
        diagnostics.error("two", LATE, "second problem");

        MetadataException e = assertThrows(MetadataException.class,
                () -> diagnostics.throwIfErrors("metadata is not valid"));
        assertTrue(e.getMessage().contains("metadata is not valid (2 errors)"));
        assertTrue(e.getMessage().contains("first problem"));
        assertTrue(e.getMessage().contains("second problem"));
        assertEquals(2, e.errors().size());
    }
}
