package dev.foundry.core.plugin;

import dev.foundry.api.DataTransform;
import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;

/**
 * Resolves a class named in metadata into a usable {@link DataTransform}.
 *
 * <p>Every way this can go wrong gets its own diagnostic, because a class name
 * in a YAML file is exactly the kind of string that rots quietly: the class gets
 * renamed, or moved, or the jar is not on the path, and the pipeline keeps
 * validating until the night it runs. Resolution therefore happens while
 * planning, not while running, so {@code foundry validate} catches all of it.
 */
public final class TransformClasses {

    private TransformClasses() {
    }

    /**
     * Loads and instantiates the named class.
     *
     * <p>A fresh instance every time: a transform is handed everything it needs
     * through its argument, so there is no reason to share one between steps and
     * good reason not to.
     *
     * @throws MetadataException with a positioned diagnostic if it cannot be used
     */
    public static DataTransform instantiate(String className, ClassLoader loader, SourceRef where) {
        Class<?> type = load(className, loader, where);

        if (!DataTransform.class.isAssignableFrom(type)) {
            throw new MetadataException(Diagnostic.error("not-a-transform", where,
                    "'" + className + "' does not implement " + DataTransform.class.getName(),
                    "a custom transform implements DataTransform: one method taking a"
                            + " TransformInput and returning a Dataset<Row>"));
        }
        if (type.isInterface() || Modifier.isAbstract(type.getModifiers())) {
            throw new MetadataException(Diagnostic.error("transform-not-instantiable", where,
                    "'" + className + "' is "
                            + (type.isInterface() ? "an interface" : "abstract")
                            + ", so it cannot be constructed",
                    "name a concrete class"));
        }

        Constructor<?> constructor;
        try {
            constructor = type.getDeclaredConstructor();
        } catch (NoSuchMethodException e) {
            throw new MetadataException(Diagnostic.error("transform-not-instantiable", where,
                    "'" + className + "' has no no-argument constructor",
                    "the framework constructs the class itself; anything it needs to be told"
                            + " belongs in the step's 'options:'"));
        }
        if (!Modifier.isPublic(constructor.getModifiers()) || !Modifier.isPublic(type.getModifiers())) {
            throw new MetadataException(Diagnostic.error("transform-not-instantiable", where,
                    "'" + className + "' is not publicly constructible",
                    "make the class and its no-argument constructor public"));
        }

        try {
            return (DataTransform) constructor.newInstance();
        } catch (ReflectiveOperationException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            throw new MetadataException(Diagnostic.error("transform-not-instantiable", where,
                    "'" + className + "' could not be constructed: " + cause,
                    "its constructor threw; a transform's constructor should do nothing"
                            + " that can fail"));
        }
    }

    private static Class<?> load(String className, ClassLoader loader, SourceRef where) {
        try {
            return Class.forName(className, false, loader);
        } catch (ClassNotFoundException e) {
            throw new MetadataException(Diagnostic.error("unknown-transform-class", where,
                    "no class called '" + className + "' on the path",
                    "check the name, and pass the jar with --plugins <jar-or-directory>"));
        } catch (LinkageError e) {
            throw new MetadataException(Diagnostic.error("unknown-transform-class", where,
                    "'" + className + "' is on the path but could not be loaded: " + e.getMessage(),
                    "this usually means the plugin was built against a different version of"
                            + " foundry-api or Spark"));
        }
    }
}
