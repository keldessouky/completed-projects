// Items: bases, affixes, rarity, generation, and how an item turns into stats.
#pragma once
#include "game/stats.hpp"
#include <string>
#include <vector>

namespace q {

enum class Rarity : uint8_t { Normal, Magic, Rare, Unique };
enum class Slot : uint8_t { Weapon, Helmet, Body, Gloves, Boots, Belt, Amulet, Ring, Chart, Count };   // Chart: a map item

enum WeaponKind : uint8_t { WK_NONE, WK_MAUL, WK_STAFF, WK_BOW, WK_SWORD, WK_CROSSBOW, WK_DAGGER, WK_QSTAFF, WK_MACE, WK_SCEPTRE };

struct ItemBase {
    const char* id;
    const char* name;
    Slot slot;
    int level;            // minimum drop level
    // weapons
    float phys_min, phys_max, aps, crit;
    // armour pieces
    float armour, evasion;
    const char* implicit;  // text of the implicit, if any
    float es = 0;          // Hirz on armour pieces
    uint8_t wkind = WK_MAUL;
};

enum AffixEffect : uint8_t {
    AE_LOCAL_PHYS_INC, AE_LOCAL_PHYS_ADD, AE_LOCAL_FIRE_ADD, AE_LOCAL_SPEED_INC, AE_LOCAL_CRIT_INC,
    AE_LOCAL_ARMOUR_INC, AE_LOCAL_ARMOUR_ADD,
    AE_STR, AE_DEX, AE_INT, AE_LIFE, AE_MANA, AE_FIRE_RES, AE_COLD_RES, AE_LIGHTNING_RES, AE_CHAOS_RES,
    AE_BREAK_INC, AE_LIFE_ON_HIT, AE_LIFE_REGEN, AE_MOVE_SPEED, AE_AREA_INC, AE_ATTACK_SPEED_INC,
    // Slice 3: spells and Hirz
    AE_SPELL_DMG_INC, AE_CAST_SPEED_INC, AE_LOCAL_ES_ADD, AE_LOCAL_ES_INC, AE_SPELL_COLD_ADD, AE_ELE_DMG_INC, AE_MANA_REGEN,
    AE_SPELL_CRIT_INC,
    // Slice 4: bench, corruption and unique mods that map straight onto one stat (AffixDef::gstat/gkind/gtags)
    AE_GENERIC, AE_ALL_RES, AE_ALL_ATTR,
    AE_CHART,   // a chart's mod: it changes the site it is run on (game/atlas.cpp reads it by id)
    // Slice 6: evasion armour
    AE_LOCAL_EVASION_ADD, AE_LOCAL_EVASION_INC,
};
// AffixDef::need: which bases in a slot can roll it (0: any)
enum AffixNeed : uint16_t { NEED_ARMOUR = 1, NEED_ES = 2, NEED_MAUL = 4, NEED_STAFF = 8, NEED_EVASION = 16, NEED_BOW = 32, NEED_SWORD = 64,
                            NEED_CROSSBOW = 128, NEED_DAGGER = 256, NEED_QSTAFF = 512 };

struct AffixDef {
    const char* id;
    bool prefix;
    const char* name;       // "Heavy" / "of Skill"
    AffixEffect effect;
    uint32_t slots;         // bitmask of Slot
    int tier_levels[3];     // item level needed for tiers 3,2,1 (index 0 is the weakest)
    float lo[3], hi[3];     // value range per tier (for added damage: min range; hi2 is the max)
    float lo2[3], hi2[3];   // second value (added damage max), unused otherwise
    const char* fmt;        // "%d%% increased Physical Damage"
    uint16_t need = 0;      // AffixNeed bits
    // AE_GENERIC: the stat it adds to. An affix with no slots never rolls on drops (bench, corruption, uniques).
    Stat gstat = S_COUNT;
    ModKind gkind = MK_FLAT;
    uint32_t gtags = 0;
    float gsign = 1;        // -1: "reduced" / "less" text over a positive number
};

enum AffixFlag : uint8_t { AF_CRAFTED = 1, AF_IMPLICIT = 2 };   // from the bench; an Ifrit's Ember implicit

struct Affix {
    uint16_t def;
    uint8_t tier;           // 0 weakest .. 2 the table's best; 3..5 the endgame's tiers above it (affix_range)
    float v1, v2;
    uint8_t flags = 0;      // AffixFlag
};

static constexpr uint16_t kNoItem = 0xFFFF;

struct Item {
    uint16_t base = kNoItem;
    Rarity rarity = Rarity::Normal;
    uint8_t ilvl = 1;
    std::vector<Affix> affixes;
    std::string name;       // rare / unique name; magic and normal names are built from affixes
    uint32_t seed = 0;
    bool corrupted = false; // touched by an Ifrit's Ember: no more crafting
    uint16_t unique = kNoItem;   // index into unique_defs() (game/uniques.hpp)
    bool empty() const { return base == kNoItem; }
    void count_affixes(int& pre, int& suf) const;   // explicit mods, bench mods included
    bool has_crafted() const;
    const ItemBase& b() const;                // a placeholder base (slot Count) when empty
    std::string display_name() const;
    std::vector<std::string> lines() const;   // stat block lines for the tooltip
    WeaponStats weapon() const;               // local mods applied
    float local_es() const;                   // Hirz on an armour piece, local mods applied
    float local_evasion() const;              // evasion on an armour piece, local mods applied
    void add_global_mods(Stats& s, uint16_t source) const;
};

// an affix's tiers: the three in its table, then (for gear) three more for the endgame, from item level 36, 58 and
// 78, each the table's best range made larger (less for speed and resistances)
constexpr int kAffixTiers = 6;
int affix_tiers(const AffixDef& ad);                 // 3, or kAffixTiers for gear
int affix_tier_level(const AffixDef& ad, int tier);
void affix_range(const AffixDef& ad, int tier, float& lo, float& hi, float& lo2, float& hi2);

const std::vector<ItemBase>& item_bases();
const std::vector<AffixDef>& affix_defs();
int find_base(const char* id);
int find_affix(const char* id);

Item make_item(int base, Rarity r, int ilvl, Rng& rng);
// One affix within the rarity's prefix/suffix limits. want_prefix 1/0 forces a prefix or a suffix; `only` limits the
// choice to those affix indices (a Spice Blend's family).
bool roll_affix(Item& it, Rng& rng, int want_prefix = -1, const std::vector<int>* only = nullptr);
void reroll_values(Item& it, Rng& rng);       // new numbers within each affix's tier
std::string rare_name(Rng& rng, const ItemBase* base = nullptr);
void grid_size(const Item& it, int& w, int& h);  // inventory cells: a maul is 2x4, a ring 1x1
int sell_price(const Item& it);               // in dinars
Item random_drop(int area_level, float rare_chance, float magic_chance, Rng& rng, Slot only = Slot::Count);
uint32_t rarity_color(Rarity r);

}  // namespace q
