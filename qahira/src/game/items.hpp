// Items: bases, affixes, rarity, generation, and how an item turns into stats.
#pragma once
#include "game/stats.hpp"
#include <string>
#include <vector>

namespace q {

enum class Rarity : uint8_t { Normal, Magic, Rare, Unique };
enum class Slot : uint8_t { Weapon, Helmet, Body, Gloves, Boots, Belt, Amulet, Ring, Count };

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
};

enum AffixEffect : uint8_t {
    AE_LOCAL_PHYS_INC, AE_LOCAL_PHYS_ADD, AE_LOCAL_FIRE_ADD, AE_LOCAL_SPEED_INC, AE_LOCAL_CRIT_INC,
    AE_LOCAL_ARMOUR_INC, AE_LOCAL_ARMOUR_ADD,
    AE_STR, AE_DEX, AE_INT, AE_LIFE, AE_MANA, AE_FIRE_RES, AE_COLD_RES, AE_LIGHTNING_RES, AE_CHAOS_RES,
    AE_BREAK_INC, AE_LIFE_ON_HIT, AE_LIFE_REGEN, AE_MOVE_SPEED, AE_AREA_INC, AE_ATTACK_SPEED_INC,
};

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
};

struct Affix {
    uint16_t def;
    uint8_t tier;           // 0 weakest .. 2 strongest
    float v1, v2;
};

struct Item {
    uint16_t base = 0;
    Rarity rarity = Rarity::Normal;
    uint8_t ilvl = 1;
    std::vector<Affix> affixes;
    std::string name;       // rare / unique name; magic and normal names are built from affixes
    uint32_t seed = 0;
    const ItemBase& b() const;
    std::string display_name() const;
    std::vector<std::string> lines() const;   // stat block lines for the tooltip
    WeaponStats weapon() const;               // local mods applied
    void add_global_mods(Stats& s, uint16_t source) const;
};

const std::vector<ItemBase>& item_bases();
const std::vector<AffixDef>& affix_defs();
int find_base(const char* id);

Item make_item(int base, Rarity r, int ilvl, Rng& rng);
Item random_drop(int area_level, float rare_chance, float magic_chance, Rng& rng, Slot only = Slot::Count);
uint32_t rarity_color(Rarity r);

}  // namespace q
