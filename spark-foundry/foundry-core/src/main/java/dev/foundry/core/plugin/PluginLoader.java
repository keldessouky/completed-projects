package dev.foundry.core.plugin;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Puts a project's own jars on the path so its transforms can be named from
 * metadata.
 *
 * <p>Given a jar, or a directory of jars, or a directory of compiled classes,
 * this builds a class loader that can see them. The framework's own loader is
 * the parent, so a plugin sees {@code foundry-api} and Spark, and the framework
 * sees the plugin - which is exactly the visibility a transform needs and no
 * more.
 */
public final class PluginLoader {

    private PluginLoader() {
    }

    /**
     * A loader over the given paths, or the parent itself when there are none.
     *
     * @param paths jars, directories of jars, or directories of classes
     */
    public static ClassLoader forPaths(List<Path> paths, ClassLoader parent) {
        List<URL> urls = new ArrayList<>();
        for (Path path : expand(paths)) {
            try {
                urls.add(path.toUri().toURL());
            } catch (MalformedURLException e) {
                throw new IllegalArgumentException("cannot use '" + path + "' as a plugin path", e);
            }
        }
        if (urls.isEmpty()) {
            return parent;
        }
        return new URLClassLoader("foundry-plugins", urls.toArray(new URL[0]), parent);
    }

    /**
     * The paths to hand to Spark as {@code spark.jars}.
     *
     * <p>In local mode the driver's class loader is enough, because the executors
     * are in the same JVM. On a real cluster they are not, and a transform that
     * runs only on the driver is no use, so the jars have to be shipped too.
     * Directories of loose classes cannot be shipped this way and are left out.
     */
    public static List<Path> shippableJars(List<Path> paths) {
        return expand(paths).stream()
                .filter(path -> path.getFileName().toString().endsWith(".jar"))
                .toList();
    }

    /** Turns directories of jars into the jars themselves; leaves everything else. */
    private static List<Path> expand(List<Path> paths) {
        List<Path> out = new ArrayList<>();
        for (Path path : paths) {
            if (!Files.exists(path)) {
                throw new IllegalArgumentException("plugin path does not exist: " + path);
            }
            if (Files.isRegularFile(path)) {
                out.add(path);
                continue;
            }
            List<Path> jars = jarsIn(path);
            // A directory with no jars in it is taken to be compiled classes,
            // which is what a developer's target/classes looks like mid-change.
            out.addAll(jars.isEmpty() ? List.of(path) : jars);
        }
        return out;
    }

    private static List<Path> jarsIn(Path directory) {
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(path -> path.getFileName().toString().endsWith(".jar")).sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read plugin directory " + directory, e);
        }
    }
}
