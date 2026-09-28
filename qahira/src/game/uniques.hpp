// Uniques (GDD §7.4): each one is the prop from an invented golden-age Egyptian film, and each film's poster was
// torn up and scattered through the city. Collect a poster's four Scraps and the thing it shows is yours.
#pragma once
#include "game/items.hpp"
#include <vector>

namespace q {

struct UniqueMod { const char* affix; float lo, hi, lo2 = 0, hi2 = 0; };

struct UniqueDef {
    const char* id;
    const char* name;           // the item
    const char* base;           // an item base id
    const char* film;           // the poster's title
    const char* film_ar;        // the title as the poster prints it, transliterated
    int year;
    const char* starring;       // invented players
    const char* tagline;        // the poster's line
    uint32_t poster[2];         // the poster's two paint colours
    std::vector<UniqueMod> mods;
    std::vector<const char*> flavour;
};

constexpr int kScrapsPerPoster = 4;
constexpr int kMaxUniques = 64;   // room in the character file for later acts' posters

// Append only: characters store a unique's index (items and Poster Scraps).
const std::vector<UniqueDef>& unique_defs();
const UniqueDef& unique_def(int i);
int find_unique(const char* id);
Item make_unique(int u, int ilvl, Rng& rng);
void reroll_unique(Item& it, Rng& rng);                 // a Drop of Attar on a unique: new numbers in its ranges
int random_unique(int area_level, Rng& rng);            // one whose base can drop at this level (-1 none)

}  // namespace q
