// Skills (GDD §6): a skill is a Talisman; supports are Wafq, magic squares carved into it. PoE2's model: no gear
// sockets. A Talisman has a level (from the Blank it was carved from), 2 Wafq slots (a Brass Stylus adds more, up
// to 5), and an attribute requirement. Each Wafq can sit in one Talisman at a time.
#pragma once
#include "game/stats.hpp"
#include <string>
#include <vector>

namespace q {

// ---- skills ------------------------------------------------------------------
enum class Shape : uint8_t {
    Cone,       // melee arc in front
    Circle,     // area ahead (slams)
    Detonate,   // every crack in range erupts
    Warcry,     // around the hero
    Projectile, // bolts that fly and hit the first enemy
    Chain,      // a bolt to a target that jumps to others
    Glyph,      // an inscription on the ground that lasts
    Meteor,     // a delayed strike at a target point
    Nova,       // a ring out from the hero
    Mark,       // Slice 6: mark the enemy aimed at; its next hits are critical strikes
    Rain,       // Slice 6: volleys of arrows on a spot
};

enum Attr : uint8_t { ATTR_STR, ATTR_DEX, ATTR_INT };

struct SkillDef {
    const char* id;
    const char* name;
    const char* desc;
    uint32_t tags;
    const char* clip;
    float effectiveness;          // attacks: multiplier on weapon damage
    float base_min, base_max;     // spells: damage at level 1
    int base_type;                // spells: damage type
    float mana;
    float cooldown;
    Shape shape;
    float range, radius, angle;   // cone: range + half angle; circle: centre distance + radius; others: reach + radius
    float break_mult;
    uint8_t glyph;                // icon on the skill bar
    Attr attr;                    // requirement attribute
    const char* cls;              // the class kit it starts in ("" for none)
    // spells and elements
    int projectiles = 1;
    float proj_speed = 0;
    int chains = 0;
    float ignite = 0, shock = 0;  // base chance to Ignite / Shock, percent
    float duration = 0;           // glyphs
    float poison = 0;             // base chance to Poison, percent
};
const std::vector<SkillDef>& skill_defs();
int find_skill(const char* id);
int skill_requirement(const SkillDef& d, int level);   // attribute points needed at a Talisman level

// ---- Wafq (supports) ---------------------------------------------------------
enum WafqId : uint8_t { WQ_SATURN, WQ_JUPITER, WQ_MARS, WQ_SUN, WQ_VENUS, WQ_MERCURY, WQ_COUNT };
struct WafqDef {
    const char* id;
    const char* name;      // "Wafq of Saturn"
    int order;             // the magic square is order x order
    const char* does;      // what it does, in plain PoE terms
    uint32_t needs;        // tags a Talisman must carry for it to fit (0: any)
    float mana_mult;
};
const WafqDef& wafq_def(int w);
// The real magic square the Wafq is drawn as (row-major, order^2 numbers); every row, column and diagonal sums the same.
std::vector<int> magic_square(int order);

// ---- a carved Talisman ---------------------------------------------------------
struct Talisman {
    int16_t skill = -1;
    uint8_t level = 1;
    uint8_t slots = 2;                     // Wafq slots, 2..5
    int8_t wafq[5] = {-1, -1, -1, -1, -1};
    bool empty() const { return skill < 0; }
    const SkillDef& def() const { return skill_defs()[size_t(skill)]; }
    int wafq_count() const;
};

// Everything a cast needs, worked out once: the hero's stats plus the Wafq's mods, the pipeline's hit, and the
// shape's numbers after area, projectile and chain modifiers.
struct SkillCtx {
    const SkillDef* def = nullptr;
    bool needs_bow = false;   // a bow skill, and no bow in hand
    int level = 1;
    Stats stats;            // hero stats + Wafq mods (sourced SRC_WAFQ + id)
    SkillStats ss;
    HitDamage hit;
    float mana = 0, cooldown = 0;
    float speed = 1;        // animation speed (attack or cast speed over the base rate)
    float area = 1;         // radius multiplier
    int projectiles = 1, chains = 0;
    float proj_speed = 0;
    float ignite = 0, shock = 0;   // chances, 0..1
    float poison = 0, poison_mult = 1;
    int mark_hits = 3;
    float mark_duration = 8;
    float freeze = 1, shock_effect = 1, break_mult = 1;
    bool usable = true;     // attribute requirement met
};
SkillCtx skill_ctx(const Talisman& t, const Stats& hero, const WeaponStats& weapon);

}  // namespace q
