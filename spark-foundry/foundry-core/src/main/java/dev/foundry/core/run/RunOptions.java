package dev.foundry.core.run;

import java.nio.file.Path;
import java.util.Map;

/**
 * How one run should behave.
 *
 * @param dataRoot    what {@code ${data}} means for this run
 * @param params      the pipeline's arguments, before type checking
 * @param manifestDir where to write the run manifest, or null to write none
 * @param countRows   count each step's output. On by default: knowing where a
 *                    pipeline lost or multiplied its rows is usually worth one
 *                    extra pass, and it is the difference between a manifest you
 *                    can debug from and a list of step names
 */
public record RunOptions(Path dataRoot, Map<String, String> params, Path manifestDir, boolean countRows) {

    public RunOptions {
        params = Map.copyOf(params);
    }

    public static RunOptions of(Path dataRoot) {
        return new RunOptions(dataRoot, Map.of(), dataRoot.resolve("_foundry").resolve("runs"), true);
    }

    public RunOptions withParams(Map<String, String> values) {
        return new RunOptions(dataRoot, values, manifestDir, countRows);
    }

    public RunOptions withManifestDir(Path directory) {
        return new RunOptions(dataRoot, params, directory, countRows);
    }

    public RunOptions withRowCounts(boolean enabled) {
        return new RunOptions(dataRoot, params, manifestDir, enabled);
    }
}
