// The simulation: actors (hero and monsters), skills, projectiles, ground effects, loot, particles.
// Fixed 60 Hz steps; everything here is plain data so save states can serialise it.
#pragma once
#include "game/animator.hpp"
#include "game/assets.hpp"
#include "game/inventory.hpp"
#include "game/items.hpp"
#include "game/level.hpp"
#include "game/skills.hpp"
#include "game/stats.hpp"
#include "game/tree.hpp"
#include "platform/input.hpp"
#include <string>
#include <vector>

namespace q {

enum Team : uint8_t { TEAM_HERO, TEAM_ENEMY };
enum class Act : uint8_t { Idle, Skill, Dodge, Hit, Stun, Dead };

// ---- monsters ------------------------------------------------------------
enum class AttackKind : uint8_t { Claw, Slam, Spit, Boss };
struct MonsterDef {
    const char* id;
    const char* name;
    const char* model;
    float scale;
    vec3 tint;
    float life, speed, radius;
    AttackKind attack;
    float attack_range, attack_cd;
    float dmg_min, dmg_max;
    int dmg_type;
    float armour;
    float xp;
    float keep_distance;  // ranged: preferred distance from the hero
};
const std::vector<MonsterDef>& monster_defs();
int find_monster(const char* id);

enum MonsterMod : uint8_t { MM_HASTED, MM_ARMOURED, MM_FRENZIED, MM_VAMPIRIC, MM_COUNT };
const char* monster_mod_name(int m);

struct Actor {
    uint32_t id = 0;
    Team team = TEAM_ENEMY;
    int def = -1;                  // monster def, -1 for the hero
    Rarity rarity = Rarity::Normal;
    std::string name;
    uint8_t mods[4] = {255, 255, 255, 255};
    vec2 pos, vel, knock;
    float facing = 0;
    float radius = 0.45f;
    float scale = 1;
    vec3 tint{1, 1, 1};
    float life = 1, life_max = 1, mana = 0, mana_max = 0;
    float armour = 0;
    float speed = 5;
    float dmg_mult = 1, speed_mult = 1;
    Act act = Act::Idle;
    float act_t = 0;
    int skill = -1;                // skill being used
    bool struck = false;           // the skill's hit event has fired
    float break_meter = 0, broken_t = 0, stun_t = 0;
    float hit_flash = 0;
    float dead_t = 0;
    float attack_cd = 0;
    float ai_t = 0;
    int ai_state = 0;
    vec2 ai_dir;
    uint8_t phase = 0;
    float cd2 = 0, cd3 = 0;
    vec2 from, target;
    vec2 home;                     // bosses keep to their court
    // elemental ailments (GDD §3.3)
    float ignite_t = 0, ignite_dps = 0;
    float chill_t = 0, chill = 0;  // slowed by `chill` (0..1)
    float freeze_meter = 0, frozen_t = 0;
    float shock_t = 0, shock = 0;  // takes `shock` percent more damage
    Animator anim;
    CharacterModel model;
    bool alive() const { return act != Act::Dead; }
};

// What a hero's delayed or travelling hit carries: the pipeline's numbers and the ailment chances.
struct HeroHit {
    HitDamage hit;
    float ignite = 0, shock = 0, shock_effect = 1, freeze = 1, brk = 1;
    int16_t talisman = -1;
};

struct Projectile {
    vec2 pos, vel;
    float z = 1.1f, radius = 0.3f, life = 1.5f;
    Team team = TEAM_ENEMY;
    float dmg_min = 0, dmg_max = 0;
    int dmg_type = DT_CHAOS;
    vec3 color{0.4f, 1.f, 0.3f};
    HeroHit hh;                    // the hero's bolts
    uint32_t owner = 0;
};

struct GroundFx {
    enum Kind : uint8_t { Crack, Telegraph, Ring, Glyph, Meteor, Bolt } kind = Crack;
    vec2 pos;
    float radius = 1, t = 0, life = 6, angle = 0, half = 0.6f;
    uint32_t owner = 0;
    uint32_t seed = 0;
    vec2 pos2;                     // a bolt's far end
    float pulse = 0;               // a glyph's next pulse
    HeroHit hh;                    // glyph pulses and meteors
};

struct Particle {
    vec3 pos, vel;
    float life, max_life, size0, size1, gravity, drag;
    vec4 c0, c1;
    uint8_t shape;
    bool additive;
};

struct FloatText {
    vec3 pos;
    std::string text;
    uint32_t color;
    float t = 0, size = 40;
};

struct GroundItem {
    enum Kind : uint8_t { Gear, Currency, Gold, Wafq, Blank } kind = Gear;   // Wafq: `currency` is the id; Blank: `amount` is the level
    Item item;
    vec2 pos;
    float t = 0;
    uint32_t id = 0;
    int amount = 0;        // dinars, or a stack of currency
    uint8_t currency = 0;
};

struct Interactable {
    enum Kind : uint8_t { Stair, Portal, Vendor, Exit, Chest } kind;
    vec2 pos;
    float radius = 1.8f;
    std::string label;
    float facing = 0;
    bool spent = false;        // an opened chest stays, but cannot be used again
};

struct Npc {
    std::string model;
    vec2 pos;
    float facing = 0;
    float scale = 1;
    bool rigged = true;
    Animator anim;
    CharacterModel cm;
};

// Events the presentation layer (audio, rumble, HUD) consumes after each step.
enum class Ev : uint8_t { Swing, Impact, SlamImpact, EnemyHit, EnemyDie, HeroHit, Warcry, Dodge, Spit, Splash, Pickup,
                          Drink, Crit, Break, LevelUp, HeroDie, Aftershock, Portal, Gold, Currency, BossDie, BossWail,
                          BossLeap, Summon, Craft, Sell, InvFull, Cast, FireHit, ColdHit, LightningHit, StarFall, Frozen,
                          Glyph };
struct Event { Ev type; vec2 pos; float mag; };

struct Hero {
    Stats base;                    // class base stats
    Stats stats;                   // base + items + buffs (rebuilt when anything changes)
    Item equip[EQ_COUNT];          // the paper doll; empty items are free slots
    Inventory inv;
    int currency[CUR_COUNT] = {};
    int gold = 0;                  // dinars
    uint8_t filter = FILTER_STANDARD;
    Allocation passives;           // the class, and its stars in the Book of Fixed Stars
    std::vector<uint16_t> plan;    // planned stars, in the order they can be taken
    uint32_t keystones = 0;
    float es = 0, es_max = 0;      // Hirz, the energy shield
    float es_wait = 0;             // seconds until Hirz starts to recharge
    float overload_t = 0;          // al-Simak: elemental damage after a crit
    uint32_t last_attacker = 0;    // al-Dabaran: the last enemy that hit you
    int passive_points() const { return std::max(0, level - 1 - passives.spent()); }
    Item& weapon() { return equip[EQ_WEAPON]; }
    const Item& weapon() const { return equip[EQ_WEAPON]; }
    // skills: carved Talismans, the two bars of five that point at them, and what is not slotted yet
    std::vector<Talisman> talismans;
    int8_t bar[10] = {-1, -1, -1, -1, -1, -1, -1, -1, -1, -1};
    int wafq[WQ_COUNT] = {};       // Wafq not carved into a Talisman
    std::vector<uint8_t> blanks;   // Blank Talismans, by level
    float cooldowns[10] = {};
    const Talisman* slot_talisman(int slot) const {
        int t = slot >= 0 && slot < 10 ? bar[slot] : -1;
        return t >= 0 && t < int(talismans.size()) ? &talismans[size_t(t)] : nullptr;
    }
    int level = 1;
    float xp = 0;
    int rally = 0;                 // Rallying Shout charges
    bool rally_hit = false;        // the hit being resolved spent one (it builds more Break)
    int combo = 0;                 // consecutive Crushing Blow hits
    float flask = 3, flask_max = 3;
    float flask_heal_t = 0;
    float regen_acc = 0;
    int kills = 0;
};

// The hero's numbers for a sheet or a preview (the tree screen compares two of these).
struct HeroSummary {
    float life = 0, mana = 0, es = 0, armour = 0, dps = 0, ehp = 0;
    float str = 0, dex = 0, intel = 0;
    std::array<float, DT_COUNT> res{};
    std::string skill;
};
void compute_hero_stats(Hero& h);
void apply_class_base(Hero& h, const std::string& cls);   // the class's base stats (and the hero model)
void give_class_kit(Hero& h);                             // the class's starting Talismans on bar one
const char* hero_model();                                 // the current hero's model name            // base + level + gear + stars + attributes -> h.stats
HeroSummary summarize(const Hero& h);

class World {
public:
    Level level;
    std::vector<Actor> actors;     // [0] is always the hero
    std::vector<Projectile> projectiles;
    std::vector<GroundFx> ground;
    std::vector<Particle> particles;
    std::vector<FloatText> texts;
    std::vector<GroundItem> loot;
    std::vector<Event> events;
    std::vector<Interactable> interacts;
    std::vector<Npc> npcs;
    int near_interact = -1, used_interact = -1;
    Hero hero;
    Rng rng{1234};
    Rng fx_rng{99};
    uint32_t next_id = 1;
    float time = 0;
    float hitstop = 0;
    float shake = 0;
    int area_level = 1;
    bool boss_killed = false;
    int selected_loot = -1;

    Actor& hero_actor() { return actors[0]; }
    void reset_hero(const std::string& cls = "warrior");
    void recompute_hero();
    Actor& spawn_monster(int def, vec2 pos, Rarity rarity = Rarity::Normal, int level = 1);
    void step(const Input& in, float dt);

    // queries used by the HUD and tests
    int enemies_alive() const;
    const Actor* focus_enemy() const;      // rare/unique being fought, for the target frame
    float skill_cost(int slot) const;
    SkillCtx slot_ctx(int slot) const;                // the Talisman on a bar slot, worked out
    float hero_dps(const Item& weapon) const;        // the main (first damaging) skill's DPS with this weapon
    int main_slot() const;
    WeaponStats hero_weapon() const { return hero.weapon().weapon(); }
    bool loot_visible(const GroundItem& g) const { return g.kind != GroundItem::Gear || filter_shows(hero.filter, g.item); }

    // belongings (the menu drives these; each keeps the stats current)
    bool pick_up(int loot_index);
    bool equip_from_inventory(int inv_index);
    bool unequip(int slot);
    void drop_from_inventory(int inv_index);
    bool craft(int currency, Item& target, std::string* why);
    void drop_currency(vec2 at, int currency, int amount);
    void drop_gold(vec2 at, int amount);
    void drop_special(vec2 at, GroundItem::Kind kind, int value);   // a Wafq (value: id) or a Blank Talisman (value: level)

    void emit(Ev t, vec2 p, float mag = 1) { events.push_back({t, p, mag}); }
    void burst(vec3 p, int n, vec4 c0, vec4 c1, float speed, float size, float life, bool additive, float gravity = -6.f, uint8_t shape = 0);

private:
    void hero_step(const Input& in, float dt);
    void monster_step(Actor& m, float dt);
    void boss_step(Actor& m, float dt);
    void boss_strike(Actor& m, const char* ev);
    void anim_step(Actor& a, float dt);
    void start_skill(int slot, vec2 stick);
    void resolve_skill(Actor& h);
    // one hit on an enemy: mitigation, ailments, Break, knockback, leech, death. Returns the damage dealt.
    float hit_enemy(Actor& e, const HeroHit& hh, vec2 from, float knock, float extra_more = 1.f);
    void glyph_pulse(GroundFx& g);
    void star_fall(GroundFx& g);
    bool in_glyph(vec2 p) const;
    void ailments_step(Actor& m, float dt);
    void damage_hero(float lo, float hi, int type, vec2 from, float break_amt, uint32_t attacker = 0);
    void kill(Actor& e);
    void monster_attack(Actor& m);
    void drop_loot(const Actor& e);
    void separate();
    void fx_step(float dt);
    vec2 aim_assist(vec2 dir, float range, float cone);
};

}  // namespace q
