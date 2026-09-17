package dev.foundry.core;

import dev.foundry.core.plugin.PluginLoader;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

/**
 * Locates the shipped retail example, so the framework's own tests exercise the
 * same metadata a reader will.
 *
 * <p>The example's plugin jar is found on disk rather than put on the test
 * classpath, which keeps the tests honest about how a project's own transforms
 * actually reach the framework.
 */
public final class Examples {

    private Examples() {
    }

    /** The example's root, wherever the test was started from. */
    public static Path root() {
        Path fromModule = Path.of("..", "examples", "retail");
        if (Files.isDirectory(fromModule)) {
            return fromModule;
        }
        Path fromRoot = Path.of("examples", "retail");
        if (Files.isDirectory(fromRoot)) {
            return fromRoot;
        }
        throw new IllegalStateException("cannot find examples/retail from "
                + Path.of(".").toAbsolutePath());
    }

    public static Path metadata() {
        return root().resolve("metadata");
    }

    public static Path seed() {
        return root().resolve("seed");
    }

    /**
     * The example plugin, as something {@code --plugins} would be pointed at.
     *
     * <p>Its jar after {@code mvn package}, and its compiled classes after a bare
     * {@code mvn test}, which never packages anything. Both are legal plugin
     * paths, so the tests work either way rather than depending on which goal
     * someone happened to run.
     */
    public static Path pluginPath() {
        Path target = root().resolve("plugin").resolve("target");
        try (Stream<Path> files = Files.list(target)) {
            Path jar = files
                    .filter(path -> path.getFileName().toString().startsWith("retail-transforms"))
                    .filter(path -> path.getFileName().toString().endsWith(".jar"))
                    .findFirst()
                    .orElse(null);
            if (jar != null) {
                return jar;
            }
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read " + target, e);
        }
        return pluginClasses();
    }

    /** The plugin's compiled classes, which exist after any build that compiled it. */
    public static Path pluginClasses() {
        Path classes = root().resolve("plugin").resolve("target").resolve("classes");
        if (!Files.isDirectory(classes)) {
            // Failing loudly beats skipping: a test that quietly stops running is
            // worse than no test at all.
            throw new IllegalStateException("the example plugin has not been built; run"
                    + " 'mvn test' or 'mvn package' from the project root (looked in "
                    + classes.toAbsolutePath() + ")");
        }
        return classes;
    }

    /** A loader that can see the example's own transform classes. */
    public static ClassLoader pluginLoader() {
        return PluginLoader.forPaths(List.of(pluginPath()), Examples.class.getClassLoader());
    }
}
