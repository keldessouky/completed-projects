package dev.foundry.core.param;

import dev.foundry.metadata.Diagnostic;
import dev.foundry.metadata.Diagnostics;
import dev.foundry.metadata.MetadataException;
import dev.foundry.metadata.SourceRef;
import dev.foundry.metadata.Suggest;
import dev.foundry.metadata.model.ParamSpec;
import dev.foundry.metadata.model.ParamType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pipeline parameters, and their substitution into expressions and locations.
 *
 * <p>A parameter is written {@code ${name}} and is replaced by a SQL literal
 * before the surrounding expression is parsed. Doing it that way - rather than
 * pasting the caller's text straight in - means a parameter cannot change the
 * shape of an expression, and a date parameter that is not a date is rejected
 * at the command line rather than becoming a puzzling SQL error much later.
 */
public final class Params {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([A-Za-z_][A-Za-z0-9_]*)}");

    private Params() {
    }

    /** Every {@code ${name}} in a piece of text, in order of appearance. */
    public static Set<String> placeholders(String text) {
        Set<String> found = new LinkedHashSet<>();
        if (text == null) {
            return found;
        }
        Matcher matcher = PLACEHOLDER.matcher(text);
        while (matcher.find()) {
            found.add(matcher.group(1));
        }
        return found;
    }

    /** Replaces every placeholder using {@code lookup}, which must know them all. */
    public static String substitute(String text, java.util.function.Function<String, String> lookup) {
        if (text == null) {
            return null;
        }
        Matcher matcher = PLACEHOLDER.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String replacement = lookup.apply(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /** Reports any placeholder the pipeline does not declare. */
    public static void checkPlaceholders(String text, SourceRef where, List<ParamSpec> declared,
                                         String context, Diagnostics diagnostics) {
        Set<String> names = new LinkedHashSet<>(declared.stream().map(ParamSpec::name).toList());
        for (String used : placeholders(text)) {
            if (!names.contains(used)) {
                diagnostics.error("unknown-parameter", where,
                        context + " uses parameter '${" + used + "}', which the pipeline does not declare",
                        Suggest.hint(used, names));
            }
        }
    }

    /**
     * A SQL literal for a value of this type, with the value checked as it is
     * quoted. Strings are escaped, so a parameter cannot inject SQL.
     */
    public static String sqlLiteral(ParamType type, String value, SourceRef where, String name) {
        validate(type, value, where, name);
        return switch (type) {
            case STRING -> "'" + value.replace("'", "''") + "'";
            case INT, DECIMAL -> value;
            case BOOLEAN -> Boolean.parseBoolean(value) ? "true" : "false";
            case DATE -> "DATE '" + value + "'";
            case TIMESTAMP -> "TIMESTAMP '" + value + "'";
        };
    }

    /** Rejects a value that is not of the declared type, with a useful message. */
    public static void validate(ParamType type, String value, SourceRef where, String name) {
        try {
            switch (type) {
                case INT -> Long.parseLong(value.trim());
                case DECIMAL -> new java.math.BigDecimal(value.trim());
                case BOOLEAN -> {
                    String lower = value.trim().toLowerCase(java.util.Locale.ROOT);
                    if (!lower.equals("true") && !lower.equals("false")) {
                        throw new NumberFormatException("not a boolean");
                    }
                }
                case DATE -> LocalDate.parse(value.trim());
                case TIMESTAMP -> LocalDateTime.parse(value.trim().replace(' ', 'T'));
                case STRING -> {
                    // Anything is a string.
                }
            }
        } catch (NumberFormatException | DateTimeParseException | ArithmeticException e) {
            throw new MetadataException(Diagnostic.error("invalid-parameter", where,
                    "parameter '" + name + "' expects a " + type.name().toLowerCase(java.util.Locale.ROOT)
                            + ", but was given '" + value + "'",
                    expectedForm(type)));
        }
    }

    private static String expectedForm(ParamType type) {
        return switch (type) {
            case DATE -> "dates look like 2026-03-01";
            case TIMESTAMP -> "timestamps look like 2026-03-01T09:30:00";
            case INT -> "whole numbers only, no thousands separators";
            case DECIMAL -> "a decimal number such as 12.50";
            case BOOLEAN -> "true or false";
            case STRING -> null;
        };
    }

    /**
     * A stand-in value of the right type, used when planning without real
     * arguments. It exists so that {@code foundry plan} can parse and check every
     * expression in a pipeline whether or not the caller supplied parameters.
     */
    public static String placeholderValue(ParamType type) {
        return switch (type) {
            case STRING -> "";
            case INT -> "0";
            case DECIMAL -> "0";
            case BOOLEAN -> "false";
            case DATE -> "1970-01-01";
            case TIMESTAMP -> "1970-01-01T00:00:00";
        };
    }

    /**
     * Binds caller-supplied arguments to the declared parameters: defaults
     * applied, types checked, unknown names and missing required values
     * reported. Returns the values ready for substitution.
     */
    public static Map<String, String> bind(List<ParamSpec> declared, Map<String, String> supplied,
                                           SourceRef where, Diagnostics diagnostics) {
        Map<String, String> bound = new LinkedHashMap<>();
        Set<String> names = new LinkedHashSet<>(declared.stream().map(ParamSpec::name).toList());
        for (String given : supplied.keySet()) {
            if (!names.contains(given)) {
                diagnostics.error("unknown-parameter", where,
                        "no parameter named '" + given + "'", Suggest.hint(given, names));
            }
        }
        for (ParamSpec spec : declared) {
            String value = supplied.get(spec.name());
            if (value == null) {
                value = spec.defaultValue();
            }
            if (value == null) {
                if (spec.required()) {
                    diagnostics.error("missing-parameter", spec.where(),
                            "parameter '" + spec.name() + "' is required but was not supplied",
                            "pass it with --param " + spec.name() + "=<value>");
                }
                continue;
            }
            try {
                validate(spec.type(), value, spec.where(), spec.name());
                bound.put(spec.name(), value);
            } catch (MetadataException e) {
                diagnostics.addAll(e.diagnostics().all());
            }
        }
        return bound;
    }
}
