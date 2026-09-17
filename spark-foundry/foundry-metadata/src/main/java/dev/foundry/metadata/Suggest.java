package dev.foundry.metadata;

import java.util.Collection;
import java.util.Locale;
import java.util.Optional;

/**
 * "Did you mean ...?" support.
 *
 * <p>Most metadata mistakes are typos: a mistyped column, a mistyped key, a
 * pipeline that refers to {@code custmers}. Pointing at the nearest legal name
 * turns a dead end into a one-word fix, so the loader does it everywhere it
 * rejects an identifier.
 */
public final class Suggest {

    private Suggest() {
    }

    /**
     * The candidate closest to {@code input}, if one is close enough to be worth
     * offering. The distance budget grows with the length of the input so that
     * short names need a near-exact match and long ones tolerate a slip or two.
     */
    public static Optional<String> closest(String input, Collection<String> candidates) {
        if (input == null || candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }
        String needle = input.toLowerCase(Locale.ROOT);
        int budget = Math.max(1, Math.min(4, needle.length() / 3 + 1));
        String best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (String candidate : candidates) {
            if (candidate == null) {
                continue;
            }
            int distance = editDistance(needle, candidate.toLowerCase(Locale.ROOT));
            if (distance < bestDistance) {
                bestDistance = distance;
                best = candidate;
            }
        }
        if (best == null || bestDistance > budget) {
            return Optional.empty();
        }
        return Optional.of(best);
    }

    /**
     * A hint of the form {@code did you mean 'x'?}, falling back to listing the
     * legal values when nothing is close. Returns null when there is nothing
     * useful to say, which {@link Diagnostic} renders as "no hint".
     */
    public static String hint(String input, Collection<String> candidates) {
        Optional<String> best = closest(input, candidates);
        if (best.isPresent()) {
            return "did you mean '" + best.get() + "'?";
        }
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        return "known values: " + String.join(", ", candidates.stream().sorted().toList());
    }

    /** Standard Levenshtein distance over two rows of scratch space. */
    static int editDistance(String a, String b) {
        int n = b.length();
        int[] previous = new int[n + 1];
        int[] current = new int[n + 1];
        for (int j = 0; j <= n; j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= n; j++) {
                int substitution = previous[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1);
                current[j] = Math.min(substitution, Math.min(previous[j] + 1, current[j - 1] + 1));
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[n];
    }
}
