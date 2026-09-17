package dev.foundry.core.io;

import dev.foundry.core.param.ParamResolver;
import dev.foundry.core.param.Params;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.DatasetSpec;
import dev.foundry.metadata.model.ParamSpec;

import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves a dataset's declared location into a real path.
 *
 * <p>A location is written once, with {@code ${data}} standing for wherever this
 * environment keeps its warehouse and any pipeline parameter standing for
 * itself. The same metadata therefore runs against a developer's temporary
 * directory and a production bucket without a line of it changing - which is
 * what makes it reviewable as code rather than as configuration for one machine.
 */
public final class Locations {

    /** The placeholder for the warehouse root. */
    public static final String DATA_ROOT = "data";

    private Locations() {
    }

    public static String resolve(DatasetSpec spec, Path dataRoot, ParamResolver params) {
        return Params.substitute(spec.location(), name -> DATA_ROOT.equals(name)
                ? dataRoot.toString()
                : params.inText("${" + name + "}", spec.where()));
    }

    /** Reports any placeholder in the location that nothing can fill. */
    public static void check(DatasetSpec spec, List<ParamSpec> params, Diagnostics diagnostics) {
        Set<String> known = new LinkedHashSet<>(params.stream().map(ParamSpec::name).toList());
        known.add(DATA_ROOT);
        for (String used : Params.placeholders(spec.location())) {
            if (!known.contains(used)) {
                diagnostics.error("unknown-parameter", spec.where(),
                        "dataset '" + spec.name() + "' has location placeholder '${" + used
                                + "}', which the pipeline using it does not declare",
                        Suggest.hint(used, known));
            }
        }
    }
}
