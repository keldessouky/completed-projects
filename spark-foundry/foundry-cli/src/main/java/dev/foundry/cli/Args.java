package dev.foundry.cli;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A small command-line parser.
 *
 * <p>Hand-rolled rather than pulled in: the surface is four commands and a
 * handful of options, and a framework whose whole argument is that dependencies
 * should be justified may as well hold itself to it.
 */
final class Args {

    private final Map<String, List<String>> options = new LinkedHashMap<>();
    private final List<String> positional = new ArrayList<>();

    private Args() {
    }

    /** Accepts {@code --name value}, {@code --name=value} and bare flags. */
    static Args parse(String[] argv, int from) {
        Args args = new Args();
        for (int i = from; i < argv.length; i++) {
            String arg = argv[i];
            if (!arg.startsWith("--")) {
                args.positional.add(arg);
                continue;
            }
            String name = arg.substring(2);
            String value;
            int equals = name.indexOf('=');
            if (equals >= 0) {
                value = name.substring(equals + 1);
                name = name.substring(0, equals);
            } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
                value = argv[++i];
            } else {
                value = "true";
            }
            args.options.computeIfAbsent(name, key -> new ArrayList<>()).add(value);
        }
        return args;
    }

    Optional<String> get(String name) {
        List<String> values = options.get(name);
        return values == null || values.isEmpty() ? Optional.empty() : Optional.of(values.get(values.size() - 1));
    }

    List<String> all(String name) {
        return options.getOrDefault(name, List.of());
    }

    boolean flag(String name) {
        return get(name).map(value -> !value.equalsIgnoreCase("false")).orElse(false);
    }

    String require(String name, String what) {
        return get(name).orElseThrow(() -> new UsageError("--" + name + " is required (" + what + ")"));
    }

    Path requirePath(String name, String what) {
        return Path.of(require(name, what));
    }

    Path path(String name, Path fallback) {
        return get(name).map(Path::of).orElse(fallback);
    }

    List<String> positional() {
        return List.copyOf(positional);
    }

    /** {@code --param name=value}, repeatable. */
    Map<String, String> params(String name) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String entry : all(name)) {
            int equals = entry.indexOf('=');
            if (equals <= 0) {
                throw new UsageError("--" + name + " takes name=value, got '" + entry + "'");
            }
            values.put(entry.substring(0, equals), entry.substring(equals + 1));
        }
        return values;
    }

    /** Rejects an option this command does not understand, rather than ignoring it. */
    void rejectUnknown(java.util.Set<String> known) {
        for (String name : options.keySet()) {
            if (!known.contains(name)) {
                String hint = dev.foundry.metadata.Suggest.hint(name, known);
                throw new UsageError("unknown option --" + name + (hint == null ? "" : "; " + hint));
            }
        }
    }
}
