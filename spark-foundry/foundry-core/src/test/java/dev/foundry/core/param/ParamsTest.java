package dev.foundry.core.param;

import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.model.ParamSpec;
import dev.foundry.metadata.model.ParamType;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ParamsTest {

    private static final SourceRef WHERE = new SourceRef("p.yaml", 3, 1);

    private static ParamSpec param(String name, ParamType type, boolean required, String defaultValue) {
        return new ParamSpec(name, type, required, defaultValue, null, WHERE);
    }

    @Test
    @DisplayName("placeholders are found and substituted")
    void substitutes() {
        assertEquals(Set.of("run_date", "region"),
                Params.placeholders("where day = ${run_date} and region = ${region}"));
        assertEquals("a=1 b=1", Params.substitute("a=${x} b=${x}", name -> "1"));
        assertEquals("nothing to do", Params.substitute("nothing to do", name -> "!"));
    }

    @Test
    @DisplayName("a value is checked against its declared type before it goes anywhere")
    void validatesTypes() {
        Params.validate(ParamType.DATE, "2026-03-05", WHERE, "run_date");
        Params.validate(ParamType.INT, "42", WHERE, "n");
        Params.validate(ParamType.DECIMAL, "12.50", WHERE, "amount");
        Params.validate(ParamType.BOOLEAN, "true", WHERE, "flag");
        Params.validate(ParamType.TIMESTAMP, "2026-03-05T09:30:00", WHERE, "at");
        Params.validate(ParamType.STRING, "anything at all", WHERE, "s");

        MetadataException e = assertThrows(MetadataException.class,
                () -> Params.validate(ParamType.DATE, "2026-02-31", WHERE, "run_date"));
        assertEquals("invalid-parameter", e.errors().get(0).code());
        assertEquals("dates look like 2026-03-01", e.errors().get(0).hint());

        assertThrows(MetadataException.class,
                () -> Params.validate(ParamType.INT, "1,000", WHERE, "n"));
        assertThrows(MetadataException.class,
                () -> Params.validate(ParamType.BOOLEAN, "maybe", WHERE, "flag"));
    }

    @Test
    @DisplayName("a parameter becomes a typed SQL literal, not pasted-in text")
    void producesSqlLiterals() {
        assertEquals("DATE '2026-03-05'",
                Params.sqlLiteral(ParamType.DATE, "2026-03-05", WHERE, "d"));
        assertEquals("42", Params.sqlLiteral(ParamType.INT, "42", WHERE, "n"));
        assertEquals("true", Params.sqlLiteral(ParamType.BOOLEAN, "TRUE", WHERE, "b"));
        assertEquals("'emea'", Params.sqlLiteral(ParamType.STRING, "emea", WHERE, "r"));
    }

    @Test
    @DisplayName("a quote in a string parameter is escaped, not passed through")
    void escapesStringLiterals() {
        assertEquals("'O''Brien'", Params.sqlLiteral(ParamType.STRING, "O'Brien", WHERE, "name"));
        assertEquals("''' or 1=1 --'",
                Params.sqlLiteral(ParamType.STRING, "' or 1=1 --", WHERE, "name"),
                "a parameter cannot change the shape of the expression it lands in");
    }

    @Test
    @DisplayName("binding applies defaults, checks types and reports what is missing")
    void binds() {
        List<ParamSpec> declared = List.of(
                param("run_date", ParamType.DATE, true, null),
                param("region", ParamType.STRING, false, "emea"));

        Diagnostics ok = new Diagnostics();
        Map<String, String> bound = Params.bind(declared, Map.of("run_date", "2026-03-05"), WHERE, ok);
        assertEquals(Map.of("run_date", "2026-03-05", "region", "emea"), bound);
        assertTrue(ok.isEmpty());

        Diagnostics missing = new Diagnostics();
        Params.bind(declared, Map.of(), WHERE, missing);
        assertTrue(missing.hasCode("missing-parameter"));
        assertTrue(missing.errors().get(0).hint().contains("--param run_date="));

        Diagnostics unknown = new Diagnostics();
        Params.bind(declared, Map.of("run_date", "2026-03-05", "run_dat", "x"), WHERE, unknown);
        assertTrue(unknown.hasCode("unknown-parameter"));
        assertEquals("did you mean 'run_date'?", unknown.errors().get(0).hint());

        Diagnostics badType = new Diagnostics();
        Params.bind(declared, Map.of("run_date", "yesterday"), WHERE, badType);
        assertTrue(badType.hasCode("invalid-parameter"));
    }

    @Test
    @DisplayName("planning fills unsupplied parameters with a stand-in of the right type")
    void planningUsesStandIns() {
        dev.foundry.metadata.model.PipelineSpec pipeline = new dev.foundry.metadata.model.PipelineSpec(
                "p", null, List.of(param("run_date", ParamType.DATE, true, null)),
                List.of(), List.of(), List.of(), List.of(), null, WHERE);

        ParamResolver planning = ParamResolver.forPlanning(pipeline);
        assertEquals("day <= DATE '1970-01-01'", planning.inExpression("day <= ${run_date}", WHERE),
                "a stand-in keeps the expression parseable when nothing was supplied");

        ParamResolver running = ParamResolver.forRun(pipeline, Map.of("run_date", "2026-03-05"));
        assertEquals("day <= DATE '2026-03-05'", running.inExpression("day <= ${run_date}", WHERE));
    }

    @Test
    @DisplayName("a run with a parameter missing refuses rather than guessing")
    void runningRefusesToGuess() {
        dev.foundry.metadata.model.PipelineSpec pipeline = new dev.foundry.metadata.model.PipelineSpec(
                "p", null, List.of(param("run_date", ParamType.DATE, true, null)),
                List.of(), List.of(), List.of(), List.of(), null, WHERE);

        ParamResolver running = ParamResolver.forRun(pipeline, Map.of());
        MetadataException e = assertThrows(MetadataException.class,
                () -> running.inExpression("day <= ${run_date}", WHERE));
        assertEquals("missing-parameter", e.errors().get(0).code());
    }

    @Test
    @DisplayName("a location may use ${data} and the pipeline's own parameters, and nothing else")
    void checksLocationPlaceholders() {
        List<ParamSpec> declared = List.of(param("run_date", ParamType.DATE, true, null));

        Diagnostics ok = new Diagnostics();
        dev.foundry.core.io.Locations.check(dataset("${data}/orders/${run_date}"), declared, ok);
        assertTrue(ok.isEmpty(), ok.render());

        Diagnostics typo = new Diagnostics();
        dev.foundry.core.io.Locations.check(dataset("${data}/orders/${run_dt}"), declared, typo);
        assertTrue(typo.hasCode("unknown-parameter"));
        assertEquals("did you mean 'run_date'?", typo.errors().get(0).hint());
    }

    @Test
    @DisplayName("a location resolves ${data} to the warehouse root of this run")
    void resolvesLocations() {
        dev.foundry.metadata.model.PipelineSpec pipeline = new dev.foundry.metadata.model.PipelineSpec(
                "p", null, List.of(param("run_date", ParamType.DATE, true, null)),
                List.of(), List.of(), List.of(), List.of(), null, WHERE);

        assertEquals("/tmp/wh/orders/2026-03-05",
                dev.foundry.core.io.Locations.resolve(dataset("${data}/orders/${run_date}"),
                        java.nio.file.Path.of("/tmp/wh"),
                        ParamResolver.forRun(pipeline, Map.of("run_date", "2026-03-05"))));
    }

    private static dev.foundry.metadata.model.DatasetSpec dataset(String location) {
        return new dev.foundry.metadata.model.DatasetSpec("d", "s", "parquet", location,
                Map.of(), List.of(), dev.foundry.metadata.model.Enforcement.STRICT,
                dev.foundry.metadata.model.WriteMode.OVERWRITE, null, WHERE);
    }
}
