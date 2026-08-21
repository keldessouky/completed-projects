#include "game.h"

/* xorshift32: cheap, good enough for loot and misses, and reproducible so a
   recall code always rebuilds the same run. */
void rng_seed(uint32_t seed) { g.rng = seed ? seed : 0x1BADCA7Du; }

uint32_t rng_next(void) {
    uint32_t x = g.rng;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    g.rng = x;
    return x;
}

int rng_range(int lo, int hi) {
    if (hi <= lo) return lo;
    return lo + (int)(rng_next() % (uint32_t)(hi - lo + 1));
}

int rng_chance(int percent) { return (int)(rng_next() % 100) < percent; }
