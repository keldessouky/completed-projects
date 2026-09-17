package dev.foundry.metadata;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SuggestTest {

    @Test
    @DisplayName("the nearest candidate is offered for an ordinary typo")
    void findsTheNearestCandidate() {
        assertEquals(Optional.of("customer_id"),
                Suggest.closest("custmer_id", List.of("order_id", "customer_id", "sku")));
        assertEquals(Optional.of("columns"),
                Suggest.closest("colums", List.of("name", "columns", "type")));
        assertEquals(Optional.of("quantity"),
                Suggest.closest("Quantity", List.of("quantity", "unit_price")));
    }

    @Test
    @DisplayName("a short name needs a near-exact match before anything is suggested")
    void isStricterForShortNames() {
        assertEquals(Optional.of("sku"), Suggest.closest("sk", List.of("sku", "region")));
        assertTrue(Suggest.closest("zz", List.of("sku", "region")).isEmpty(),
                "two letters away from everything is not a typo, it is a different word");
    }

    @Test
    @DisplayName("nothing close enough falls back to listing what is legal")
    void listsCandidatesWhenNothingIsClose() {
        String hint = Suggest.hint("wildly_different_thing", List.of("asc", "desc"));
        assertEquals("known values: asc, desc", hint);
    }

    @Test
    @DisplayName("no candidates at all means no hint at all")
    void staysQuietWithNothingToSuggest() {
        org.junit.jupiter.api.Assertions.assertNull(Suggest.hint("anything", List.of()));
        assertTrue(Suggest.closest("anything", List.of()).isEmpty());
        assertTrue(Suggest.closest(null, List.of("a")).isEmpty());
    }

    @Test
    @DisplayName("edit distance counts insertions, deletions and substitutions")
    void measuresEditDistance() {
        assertEquals(0, Suggest.editDistance("abc", "abc"));
        assertEquals(1, Suggest.editDistance("abc", "abd"));
        assertEquals(1, Suggest.editDistance("abc", "ab"));
        assertEquals(1, Suggest.editDistance("ab", "abc"));
        assertEquals(3, Suggest.editDistance("", "abc"));
        assertEquals(3, Suggest.editDistance("kitten", "sitting"));
    }
}
