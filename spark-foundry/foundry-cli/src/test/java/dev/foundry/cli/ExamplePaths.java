package dev.foundry.cli;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Where the shipped retail example lives, for the CLI's tests.
 *
 * <p>Its plugin is found on disk rather than put on this module's classpath,
 * which keeps the tests honest about how a project's own transforms actually
 * reach the framework: through {@code --plugins}, and not otherwise.
 */
final class ExamplePaths {

    private ExamplePaths() {
    }

    static Path root() {
        Path fromModule = Path.of("..", "examples", "retail");
        return Files.isDirectory(fromModule) ? fromModule : Path.of("examples", "retail");
    }

    static Path metadata() {
        return root().resolve("metadata");
    }

    static Path seed() {
        return root().resolve("seed");
    }

    /** The plugin's compiled classes, present after any build that compiled it. */
    static Path pluginClasses() {
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

    /**
     * The plugin as something {@code --plugins} would be pointed at: its jar
     * after {@code mvn package}, its classes after a bare {@code mvn test}. Both
     * are legal, so the tests work whichever goal was run.
     */
    static Path plugin() {
        return jarIn(root().resolve("plugin").resolve("target")).orElseGet(ExamplePaths::pluginClasses);
    }

    private static Optional<Path> jarIn(Path directory) {
        if (!Files.isDirectory(directory)) {
            return Optional.empty();
        }
        try (Stream<Path> files = Files.list(directory)) {
            return files
                    .filter(path -> path.getFileName().toString().startsWith("retail-transforms"))
                    .filter(path -> path.getFileName().toString().endsWith(".jar"))
                    .findFirst();
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read " + directory, e);
        }
    }
}
