// The modifier engine and damage pipeline (GDD §8). Pure C++, no rendering: this is what the tests cover.
//
// Every number a character has comes from modifiers:  stat, kind (flat / increased / more), value, and the tags a
// context must carry for it to apply. "10% increased Physical Damage with Slams" is {Damage, Inc, 10, Physical|Slam}.
#pragma once
#include "core/math.hpp"
#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace q {

enum Tag : uint32_t {
    T_ATTACK = 1u << 0, T_SPELL = 1u << 1, T_MELEE = 1u << 2, T_AREA = 1u << 3, T_PROJECTILE = 1u << 4,
    T_SLAM = 1u << 5, T_STRIKE = 1u << 6, T_WARCRY = 1u << 7, T_DURATION = 1u << 8, T_MINION = 1u << 9,
    T_PHYSICAL = 1u << 10, T_FIRE = 1u << 11, T_COLD = 1u << 12, T_LIGHTNING = 1u << 13, T_CHAOS = 1u << 14,
    T_ELEMENTAL = 1u << 15, T_TWO_HAND = 1u << 16, T_MACE = 1u << 17, T_AILMENT = 1u << 18, T_CHANNEL = 1u << 19,
    T_CHAINING = 1u << 20, T_STAFF = 1u << 21, T_GLYPH = 1u << 22, T_BOW = 1u << 23, T_MARK = 1u << 24,
    T_SWORD = 1u << 25, T_CROSSBOW = 1u << 26, T_GRENADE = 1u << 27,   // Slice 7: the Mercenary
    T_DAGGER = 1u << 28, T_QSTAFF = 1u << 29, T_TRAP = 1u << 30,        // Slice 8: the Shadow
};

enum DamageType { DT_PHYS, DT_FIRE, DT_COLD, DT_LIGHTNING, DT_CHAOS, DT_COUNT };
uint32_t damage_type_tags(int dt);  // Physical, or Fire|Elemental, ...
const char* damage_type_name(int dt);

enum Stat : uint16_t {
    S_STR, S_DEX, S_INT,
    S_LIFE, S_MANA, S_LIFE_REGEN, S_MANA_REGEN, S_LIFE_LEECH,
    S_ARMOUR, S_EVASION, S_BLOCK,
    S_FIRE_RES, S_COLD_RES, S_LIGHTNING_RES, S_CHAOS_RES,
    S_DAMAGE,                 // generic damage; typed/conditioned via tags
    S_ADDED_MIN,              // added damage: value = min, second stat carries max (see ADDED_MAX), typed via tags
    S_ADDED_MAX,
    S_ATTACK_SPEED, S_CAST_SPEED, S_CRIT_CHANCE, S_CRIT_MULTI,
    S_AREA, S_MOVE_SPEED, S_BREAK, S_COOLDOWN_RECOVERY, S_MANA_COST, S_DAMAGE_TAKEN,
    S_FLASK_RECOVERY, S_ACCURACY,
    S_ES, S_ES_RECHARGE,      // Hirz: the energy shield analog (GDD §8)
    S_FREEZE, S_SHOCK,        // freeze buildup, effect of shock
    S_CHAINS, S_PROJ_SPEED, S_WARCRY,
    S_PROJECTILES,            // additional projectiles
    S_GAIN_FIRE,              // gain % of damage as extra Fire (pipeline step 3)
    S_IGNITE,                 // chance to Ignite, percent
    S_SKILL_LEVEL,            // + levels of every Talisman
    // Slice 6: the Ranger
    S_POISON,                 // chance to Poison, percent
    S_POISON_DAMAGE,          // poison's damage (inc/more)
    S_MARK,                   // hits a Mark guarantees as crits (flat), and its duration (inc)
    S_FRENZY,                 // maximum Frenzy Charges (flat)
    // Slice 7: the Mercenary
    S_BLEED,                  // chance to cause Bleeding, percent
    S_BLEED_DAMAGE,           // bleeding's damage (inc/more)
    S_PIERCE,                 // projectiles pierce this many more enemies
    // Slice 8: the Shadow
    S_POWER,                  // maximum Power Charges (flat)
    S_TRAP_THROW,             // traps: throwing speed (inc) and how many can be out at once (flat)
    S_WITHER,                 // Wither's effect (inc)
    S_COUNT
};
const char* stat_name(Stat s);
// Data files (the passive tree) name stats and tags by key: "life", "crit_chance"; "melee", "spell".
bool stat_from_key(const std::string& key, Stat& out);
bool tag_from_key(const std::string& key, uint32_t& out);

enum ModKind : uint8_t { MK_FLAT, MK_INC, MK_MORE };

struct Mod {
    Stat stat;
    ModKind kind;
    float value;
    uint32_t tags = 0;       // all of these must be present in the query context
    uint16_t source = 0;     // who granted it (item slot, passive, buff) — used to remove groups
};

// Where a modifier came from, for the "Why?" breakdown: equipment slots are 1..9, then these ranges.
enum ModSource : uint16_t {
    SRC_NONE = 0, SRC_CLASS = 50, SRC_LEVEL = 80, SRC_ATTRIBUTES = 90, SRC_WAFQ = 600,  // + wafq id
    SRC_STAR = 1000,                                                                   // + star id
};

struct StatSum {
    float flat = 0, inc = 0, more = 1;
    float apply(float base) const { return (base + flat) * (1.f + inc / 100.f) * more; }
};

class Stats {
public:
    std::vector<Mod> mods;
    void add(const Mod& m) { mods.push_back(m); }
    void add(Stat s, ModKind k, float v, uint32_t tags = 0, uint16_t src = 0) { mods.push_back({s, k, v, tags, src}); }
    void remove_source(uint16_t src);
    StatSum sum(Stat s, uint32_t context = 0) const;
    float value(Stat s, float base = 0, uint32_t context = 0) const { return sum(s, context).apply(base); }
    // the mods that apply to a stat in a context, for "Why?"
    std::vector<Mod> why(Stat s, uint32_t context = 0) const;
};

// ---- the damage pipeline -------------------------------------------------
struct WeaponStats {
    float phys_min = 0, phys_max = 0, aps = 1.0f, crit = 5.0f, range = 1.2f;
    std::array<float, DT_COUNT> add_min{}, add_max{};  // other local added damage
    uint32_t tags = 0;       // weapon tags an attack's context carries (Mace, Staff, Two-Handed)
    bool valid = false;
};

struct SkillStats {
    uint32_t tags = T_ATTACK | T_MELEE;
    float effectiveness = 1.0f;       // attacks: multiplier on weapon + added damage
    float base_min = 0, base_max = 0; // spells: base damage at this level
    int base_type = DT_PHYS;
    float crit = 5.0f;                // spells use this; attacks use the weapon's
    float break_mult = 1.0f;
};

struct HitDamage {
    std::array<float, DT_COUNT> min{}, max{};
    float crit_chance = 0;   // 0..1
    float crit_multi = 1.5f;
    float speed = 1.0f;      // attacks or casts per second
    float average() const;   // expected hit before crit
    float dps() const;       // expected damage per second against no defences
};

HitDamage compute_hit(const Stats& attacker, const WeaponStats& weapon, const SkillStats& skill);

struct Defences {
    float armour = 0, evasion = 0;
    std::array<float, DT_COUNT> res{};  // percent, uncapped
    float max_res = 75;
    float damage_taken_inc = 0;         // e.g. while Broken
};
Defences defences_of(const Stats& s, float res_penalty = 0);

struct HitResult {
    float total = 0;
    std::array<float, DT_COUNT> by_type{};
    bool crit = false;
};

// Roll a hit (Rng decides the damage roll and crit) and mitigate it.
HitResult roll_hit(const HitDamage& d, const Defences& def, Rng& rng);
float armour_reduction(float armour, float raw_phys);  // 0..0.9

}  // namespace q
