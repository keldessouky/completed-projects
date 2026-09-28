// The Coppersmith's Bench (GDD §7.4): Usta Hassan's deterministic crafts. Each recipe adds one known mod at a fixed
// value for dinars; an item carries one bench mod at a time. Recipes are found in the city: the landmark caches and
// the bosses of Act I each teach one.
#pragma once
#include "game/items.hpp"
#include <string>
#include <vector>

namespace q {

struct Recipe {
    const char* id;
    const char* affix;         // the affix it adds
    int tier;                  // at the middle of this tier
    int cost;                  // dinars
    const char* where;         // where it is found, for the bench list
};

// Append only: characters store the recipes they know as bits.
const std::vector<Recipe>& recipes();
int find_recipe(const char* id);
constexpr uint32_t kStarterRecipes = 0x7;   // the first three come with the bench
Affix recipe_affix(int r);                     // the exact mod it adds
// Can this recipe go on this item? (slot, a free prefix/suffix, no other bench mod, not corrupted or unique)
bool recipe_fits(int r, const Item& it, std::string* why);
bool apply_recipe(int r, Item& it, std::string* why);
bool remove_crafted(Item& it, std::string* why);
int recipe_for_zone(const std::string& zone, bool boss);   // what a zone's cache or boss teaches (-1 none)

// ---- the codex (GDD §13): an entry the first time you meet each monster family and each mechanic
enum CodexKind : uint8_t { CX_MONSTER, CX_MECHANIC };
struct CodexEntry { const char* id; CodexKind kind; const char* title; const char* text; };
const std::vector<CodexEntry>& codex_entries();   // append only: characters store bits
int find_codex(const char* id);

}  // namespace q
