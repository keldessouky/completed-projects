// The simulation: actors (hero and monsters), skills, projectiles, ground effects, loot, particles.
// Fixed 60 Hz steps; everything here is plain data so save states can serialise it.
#pragma once
#include "game/acts.hpp"
#include "game/asc.hpp"
#include "game/atlas.hpp"
#include "game/crafting.hpp"
#include "game/uniques.hpp"
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
enum class AttackKind : uint8_t { Claw, Slam, Spit, Boss, Leap, Beam };
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
    bool rigid = false;   // a possessed object: a static mesh, timed attacks instead of clip events
    const char* family = "";   // for the codex
    const char* voice = "ghoul";   // its sounds: <voice>_die
    const char* codex = "";        // the Journal entry its family unlocks
};
const std::vector<MonsterDef>& monster_defs();

// Bosses are data: a list of moves in priority order, used when their cooldown is ready and the hero is in range.
enum class MoveKind : uint8_t { Combo, Leap, Summon, Wail, Charge, Volley, Nova, Blink, Pools };
struct BossMove {
    MoveKind kind;
    const char* clip;
    float cooldown;
    float min_range, max_range;
    float dmg;             // times the monster's base damage
    uint8_t phase;         // from which phase (0 or 1)
};
struct BossDef {
    const char* monster;
    std::vector<BossMove> moves;
    float phase2_at;       // life fraction where phase 2 begins
    const char* phase2_line;
    const char* summon;    // what Summon raises
    int summon_n;
    float court;           // how far from home she may chase before walking back
    float haste2;          // speed in phase 2
    vec3 bolt;             // colour of Volley's projectiles
    bool call = false;     // her Wail is a Call: it pulls you in, not away (El Naddaha)
};
const BossDef* boss_def(int monster_def);
CharacterModel monster_model(int monster_def);   // a rigid monster's has a mesh name and no skeleton
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
    bool struck2 = false;          // ...and its second (a two-hit clip: Riposte)
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
    float move_cd[8] = {};         // bosses: each move's cooldown
    // elemental ailments (GDD §3.3)
    float ignite_t = 0, ignite_dps = 0;
    float chill_t = 0, chill = 0;  // slowed by `chill` (0..1)
    float freeze_meter = 0, frozen_t = 0;
    float shock_t = 0, shock = 0;  // takes `shock` percent more damage
    float poison[6] = {}, poison_t[6] = {};   // poison stacks: damage per second, seconds left (Slice 6)
    float mark_t = 0;              // Marked (a Ranger's mark): the next hits are critical strikes
    int mark_hits = 0;
    float bleed_t = 0, bleed_dps = 0;   // Bleeding (Slice 7): physical damage over time; the strongest one holds
    int wither = 0;                // Withered (Slice 8): each stack, 6% more chaos damage taken
    float wither_t = 0;
    bool rift = false;             // came through a Marid Rift: it leaves splinters
    bool dig = false;              // a buried chamber's guardian (Excavations)
    Animator anim;
    CharacterModel model;
    bool alive() const { return act != Act::Dead; }
};

// The life flask's tiers: each heals more of your life, over the same second and a half, and every second tier holds
// one charge more. Amm Sayed upgrades it for dinars once you are strong enough to carry it.
constexpr int kFlaskTiers = 7;
inline const char* flask_name(int t) {
    static const char* n[kFlaskTiers] = {"Clay Qulla", "Glazed Qulla", "Copper Flask", "Brass Flask", "Silver Flask", "Rosewater Flask",
                                         "Sabil Flask"};
    return n[t < 0 ? 0 : t >= kFlaskTiers ? kFlaskTiers - 1 : t];
}
inline int flask_charges(int t) { return 3 + t / 2; }                  // 3 3 4 4 5 5 6
inline float flask_heal(int t) { return 0.5f + 0.08f * float(t); }     // 50% .. 98% of your life
inline int flask_upgrade_level(int t) { return 8 + 10 * t; }         // the level the next tier (t + 1) needs
inline int flask_upgrade_price(int t) { return 150 * (t + 1) * (t + 1); }

// What a hero's delayed or travelling hit carries: the pipeline's numbers and the ailment chances.
struct HeroHit {
    HitDamage hit;
    float ignite = 0, shock = 0, shock_effect = 1, freeze = 1, brk = 1;
    float poison = 0, poison_mult = 1;   // chance to Poison (0..1), and its damage
    float bleed = 0, bleed_mult = 1;     // chance to cause Bleeding (0..1), and its damage
    int16_t talisman = -1;
};

struct Projectile {
    vec2 pos, vel;
    float z = 1.1f, radius = 0.3f, life = 1.5f;
    Team team = TEAM_ENEMY;
    float dmg_min = 0, dmg_max = 0;
    int dmg_type = DT_CHAOS;
    vec3 color{0.4f, 1.f, 0.3f};
    bool arrow = false;            // drawn as an arrow along its flight, not a ball of light
    HeroHit hh;                    // the hero's bolts
    uint32_t owner = 0;
    int8_t pierce = 0;             // enemies it may still pass through
    uint32_t pierced[4] = {};      // the ones it has (never hit twice)
};

struct GroundFx {
    enum Kind : uint8_t { Crack, Telegraph, Ring, Glyph, Meteor, Bolt, Fire, Line, Rain, Water, Grenade, Trap,
                          Totem, Embers } kind = Crack;   // Slice 9: a signal brazier; burning ground   // Fire: a hazard; Line: a
    // telegraphed strip; Rain: a Rain of Arrows (volleys on its pulses); Water: a cold hazard (Act II's pools);
    // Grenade: a pot in flight from pos2 to pos, bursting when it lands (Slice 7); Trap: in flight until `pulse`, then armed,
    // bursting when an enemy comes near (Slice 8)
    vec2 pos;
    float radius = 1, t = 0, life = 6, angle = 0, half = 0.6f;
    uint32_t owner = 0;
    uint32_t seed = 0;
    vec2 pos2;                     // a bolt's far end
    float pulse = 0;               // a glyph's next pulse
    HeroHit hh;                    // glyph pulses and meteors
};

// The Haboob (a chart mechanic): a wall of sand rolls north across the site. Inside the storm (the band behind its
// front) you can hardly see and sand jinn come with it; time spent and kills made inside fill its meter, and what it
// leaves behind when it has passed grows with the meter.
struct Haboob {
    bool armed = false;            // this chart has one
    bool active = false, passed = false;
    float delay = 20.f;            // seconds before it rises in the south
    float front = 0, depth = 16.f, speed = 0.75f;
    float y0 = 0, y1 = 0, x0 = 0, x1 = 0;   // the site's bounds
    float meter = 0;
    float spawn_t = 3.f;
    bool inside(vec2 p) const { return active && p.y <= front && p.y >= front - depth && p.x >= x0 && p.x <= x1; }
};

// A Marid Rift (Slice 6, charts after Act II): a tear in the air at one of the site's cells. Walk up to it and it
// opens, widening for a while and letting marids through; what dies in it leaves Marid Splinters.
struct Rift {
    bool armed = false, open = false, closed = false;
    vec2 pos;
    float t = 0, radius = 2.f, spawn_t = 0;
    int kills = 0, spawned = 0;
    static constexpr float kLife = 20.f;
};

// An Excavation (Slice 7, charts after Act III): a line of charges from a surveyor's stake to a buried chamber. Set each
// charge along the line, fire them from the stake, and the chamber is blown open with its guardians inside; kill them and
// search it for relics, which Amm Ramadan barters for.
struct Dig {
    static constexpr int kCharges = 4;
    bool armed = false, fired = false, opened = false, searchable = false, searched = false;
    vec2 stake, chamber;
    vec2 spots[kCharges];
    uint8_t set = 0, blown = 0;    // charges set, charges gone off (bits)
    float t = 0;                   // seconds since firing
    bool all_set() const { return set == (1u << kCharges) - 1; }
    int count_set() const { return __builtin_popcount(set); }
    static float blow_at(int i) { return 0.5f + 0.35f * float(i); }
    static float open_at() { return blow_at(kCharges) + 0.35f; }
};

// A Zar Night (Slice 8, charts after Act IV): a drum circle in one of the site's cells. Sit down at the drum and the
// drummers start; the dead feed the rhythm, which runs down on its own. Each time it fills, the circle falls into a
// trance and pays out; the night ends when its song is over or the rhythm fails. What it has earned drops at the end.
struct Zar {
    bool armed = false, started = false, over = false;
    vec2 pos;
    int16_t zone = -1;             // whose monsters come to the drums
    float rhythm = 0, t = 0, wave_t = 0;
    int trances = 0, kills = 0, waves = 0;
    static constexpr float kSong = 45.f;     // seconds a night lasts
    static constexpr float kRadius = 14.f;   // deaths inside it feed the rhythm
    static constexpr float kStart = 50.f;
    float decay() const { return 4.f + t * 0.08f; }   // the drummers tire as the night goes on
};

// The spell effects' pixel-art flipbooks: rows of the effects sheet (tools/fx/fx_atlas.py). Append only, in step
// with EFFECTS there. The first six loop (projectiles); the rest play once over a particle's life.
enum FxSprite : int8_t {
    FX_NONE = -1,
    FX_FIREBALL, FX_ICE_SHARD, FX_SPARK_BALL, FX_POISON_BLOB, FX_SHADOW_ORB, FX_STONE,
    FX_EMBER, FX_FROST, FX_ZAP, FX_BUBBLE, FX_SMOKE, FX_STAR, FX_BLAST, FX_BLOOD, FX_WATER, FX_SHATTER, FX_VOID, FX_HOLY,
    FX_COUNT
};
constexpr int kFxLooping = FX_EMBER;   // rows below this loop
// the flipbook a burst of this colour is drawn with: embers, frost, sparks of gold, poison, smoke, blood, the void
int fx_for(vec4 c0, bool additive, uint8_t shape);
// the flipbook a projectile of this damage type (and colour) is drawn with, and the one it bursts into
int fx_projectile(int dmg_type, vec3 color);
int fx_impact(int dmg_type, vec3 color);

struct Particle {
    vec3 pos, vel;
    float life, max_life, size0, size1, gravity, drag;
    vec4 c0, c1;
    uint8_t shape;
    bool additive;
    int8_t fx = FX_NONE;           // drawn as a pixel-art flipbook (FxSprite) instead of a soft disc
};

struct FloatText {
    vec3 pos;
    std::string text;
    uint32_t color;
    float t = 0, size = 40;
};

struct GroundItem {
    enum Kind : uint8_t { Gear, Currency, Gold, Wafq, Blank, Scrap } kind = Gear;   // Wafq: `currency` is the id; Blank: `amount` is
    // the level; Scrap: a Poster Scrap, `amount` is the unique
    Item item;
    vec2 pos;
    float t = 0;
    uint32_t id = 0;
    int amount = 0;        // dinars, or a stack of currency
    uint8_t currency = 0;
};

struct Interactable {
    enum Kind : uint8_t { Stair, Portal, Vendor, Exit, Chest, Waypoint, Next, Bench, Gate, ChartTable,
                          Charge, Detonator, Chamber, Dealer,   // Slice 7: an Excavation's, and Amm Ramadan
                          Drum,                                 // Slice 8: a Zar Night's
                          Veil, Door,                           // Slice 10: the choice at the heart of totality
                          Toll } kind;                          // the Gate of Iram: a toll to choose (target: the slot)
    // Next: the way on to zone `target`; Gate: a side zone (a trial); Waypoint: the waypoint list; Bench: the Coppersmith
    vec2 pos;
    float radius = 1.8f;
    std::string label;
    float facing = 0;
    bool spent = false;        // an opened chest stays, but cannot be used again
    int16_t target = -1;       // a zone, for Next and Gate
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
                          Glyph, WeaponSwap, Bleed, TrapSet, TrapSnap, Power, ZarStart, Trance,
                          Block, AuraOn, TotemSet };
struct Event { Ev type; vec2 pos; float mag; int def = -1; };   // def: the monster, for its voice

// A bit per zone index, for 128 zones (the zones outgrew 64 in Slice 9: the sites of the higher Climes)
struct ZoneBits {
    uint64_t w[2] = {0, 0};
    ZoneBits() = default;
    ZoneBits(uint64_t lo) : w{lo, 0} {}
    bool has(int i) const { return i >= 0 && i < 128 && (w[i >> 6] >> (i & 63) & 1); }
    void add(int i) { if (i >= 0 && i < 128) w[i >> 6] |= 1ull << (i & 63); }
    bool operator==(const ZoneBits& o) const { return w[0] == o.w[0] && w[1] == o.w[1]; }
};

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
    uint64_t keystones = 0;
    float es = 0, es_max = 0;      // Hirz, the energy shield
    float es_wait = 0;             // seconds until Hirz starts to recharge
    float overload_t = 0;          // al-Simak: elemental damage after a crit
    uint32_t last_attacker = 0;    // al-Dabaran: the last enemy that hit you
    ZoneBits waypoints;            // zones whose waypoint you have touched (bit = zone index)
    uint32_t quests = 0;           // Quest bits (game/acts.hpp)
    Item sealed;                   // what a trial's gatekeeper holds as the toll
    int8_t sealed_slot = -1;
    // Slice 4: crafting, posters, the codex, the ascendancy
    uint8_t omens = 0;             // Coffee-Cup Omens read, waiting for a craft (bits by omen_bit)
    uint32_t recipes = 0;          // the bench recipes you know (game/crafting.hpp)
    uint8_t scraps[kMaxUniques] = {};   // Poster Scraps held, per unique
    uint64_t codex = 0;            // codex entries you have seen
    uint32_t asc = 0;              // ascendancy nodes held (bits, game/asc.hpp)
    int8_t ascendancy = -1;        // the one chosen (an index into ascendancies()); -1 before the choice, or a class with one
    // Slice 5: the Map of al-Idrisi
    uint32_t sites_revealed = 0;   // sites you can run a chart on (bits, game/atlas.hpp)
    uint32_t sites_done = 0;       // sites finished: each gives an Astrolabe point
    uint32_t astro = 0;            // Astrolabe nodes held
    int astro_points() const { return std::max(0, q::astro_points(sites_done) - __builtin_popcount(astro)); }
    int frenzy = 0;                // Frenzy Charges (Slice 6): 4% more damage and speed each
    float frenzy_t = 0;
    bool aura = false;             // the Templar's Beacon is held up (Slice 9)
    int8_t ending = 0;             // after Apep (Slice 10): 1 the Veil sealed, 2 the door left open
    int power = 0;                 // Power Charges (Slice 8): 40% increased Critical Strike Chance each
    float power_t = 0;
    int endurance = 0;             // Endurance Charges (Ironclad)
    float endurance_t = 0;         // seconds until they fall off
    int asc_points() const;        // from trials, minus nodes held
    int passive_points() const;    // level - 1 + quest points - stars placed
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
    uint8_t flask_tier = 0;        // the life flask, upgraded at Amm Sayed's (Slice 11 follow-up): kFlaskTiers
    float flask_heal_t = 0;
    float regen_acc = 0;
    int kills = 0;
};

inline int Hero::asc_points() const { return std::max(0, quest_asc_points(quests) - asc_spent(asc)); }
inline int Hero::passive_points() const {
    return std::max(0, level - 1 + quest_passive_points(quests) + (ending == 1 ? 2 : 0) - passives.spent());   // (the Veil sealed: +2)
}

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
// A Talisman worked out with the weapon it will be used with: `weapon` if given (a comparison), else the one in hand, or
// the one on the back when the skill needs it and using the skill would swap it into hand.
SkillCtx hero_skill_ctx(const Hero& h, const Talisman& t, const Item* weapon = nullptr);

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
    Rift rift;
    Dig dig;                       // an Excavation in this chart (Slice 7)
    Zar zar;                       // a Zar Night in this chart (Slice 8)
    float coil_t = -1;             // Act II's end: a coil of the serpent passing through the pit (seconds in; -1 none)
    vec2 coil_at, coil_dir;
    // a chart run: its tier and mods, the Astrolabe it was opened under, and its Haboob
    bool in_chart = false;
    int chart_site = -1;
    ChartRun chart;
    Haboob haboob;
    int selected_loot = -1;

    Actor& hero_actor() { return actors[0]; }
    void reset_hero(const std::string& cls = "warrior");
    void recompute_hero();
    Actor& spawn_monster(int def, vec2 pos, Rarity rarity = Rarity::Normal, int level = 1);
    void kill(Actor& e);
    void damage_hero(float lo, float hi, int type, vec2 from, float break_amt, uint32_t attacker = 0, bool evadable = true);
    void step(const Input& in, float dt);

    // queries used by the HUD and tests
    int enemies_alive() const;
    const Actor* focus_enemy() const;      // rare/unique being fought, for the target frame
    float skill_cost(int slot) const;
    SkillCtx slot_ctx(int slot) const;                // the Talisman on a bar slot, worked out
    // the DPS of the first damaging skill this weapon can use (its name in `skill`), with this weapon
    float hero_dps(const Item& weapon, const char** skill = nullptr) const;
    int main_slot() const;
    WeaponStats hero_weapon() const { return hero.weapon().weapon(); }
    bool loot_visible(const GroundItem& g) const { return g.kind != GroundItem::Gear || filter_shows(hero.filter, g.item); }

    // belongings (the menu drives these; each keeps the stats current)
    bool pick_up(int loot_index);
    bool equip_from_inventory(int inv_index);
    bool unequip(int slot);
    bool swap_weapons();                 // the weapon in hand for the one on the back (Slice 7)
    void drop_from_inventory(int inv_index);
    bool craft(int currency, Item& target, std::string* why);
    void drop_currency(vec2 at, int currency, int amount);
    void drop_gold(vec2 at, int amount);
    void drop_special(vec2 at, GroundItem::Kind kind, int value);   // a Wafq (value: id), a Blank Talisman (value: level),
                                                                    // or a Poster Scrap (value: unique)
    bool learn_recipe(int r);                 // true if it was new (a banner says so)
    void meet_codex(const char* id);          // the first time: an entry and a toast
    void gain_endurance(int n);
    void gain_frenzy(int n);
    void gain_power(int n);
    void rift_step(float dt);
    void dig_step(float dt);
    void dig_use(int interact);          // a charge set, the charges fired, the chamber searched
    void zar_step(float dt);
    void zar_use(int interact);          // the drum: the night begins
    void zar_end();                      // the song is over (or the rhythm failed): what the night earned
    int frenzy_max() const { return 3 + int(hero.stats.sum(S_FRENZY).flat); }
    int power_max() const { return 3 + int(hero.stats.sum(S_POWER).flat); }
    int trap_max() const { return 3 + int(hero.stats.sum(S_TRAP_THROW).flat); }
    float evade_chance() const;   // against this area's monsters
    void haboob_step(float dt);
    void haboob_reward();
    int endurance_max() const { return kEnduranceMax + ((hero.keystones & KS_FOUNDRY) ? 1 : 0); }
    std::vector<std::string> notices;         // for the HUD: recipes learned, codex entries, posters completed

    void emit(Ev t, vec2 p, float mag = 1, int def = -1) { events.push_back({t, p, mag, def}); }
    void burst(vec3 p, int n, vec4 c0, vec4 c1, float speed, float size, float life, bool additive, float gravity = -6.f, uint8_t shape = 0);
    // one pixel-art flipbook played once where something struck or burst (draws nothing from fx_rng)
    void sprite_fx(vec3 p, int fx, float size, float life, vec3 vel = {0, 0, 0});

    // one hit on an enemy: mitigation, ailments, Break, knockback, leech, death. Returns the damage dealt.
    float hit_enemy(Actor& e, const HeroHit& hh, vec2 from, float knock, float extra_more = 1.f);
    void start_skill(int slot, vec2 stick);   // what a bar button does (a weapon swap first, if the skill needs it)
    void resolve_skill(Actor& h);             // the skill's hit, when its clip reaches it
    void ailments_step(Actor& m, float dt);

private:
    void hero_step(const Input& in, float dt);
    void monster_step(Actor& m, float dt);
    void boss_step(Actor& m, float dt);
    void boss_strike(Actor& m, const char* ev);
    void anim_step(Actor& a, float dt);
    void glyph_pulse(GroundFx& g);
    void star_fall(GroundFx& g);
    void grenade_burst(GroundFx& g);
    void sword_cut(Actor& h, const SkillDef& sk, HeroHit hh, float area, vec2 dir);
    bool in_glyph(vec2 p) const;
    // evadable: an attack (melee, arrows, bile) that Evasion can avoid; spells, novas and burning ground cannot be
    void monster_attack(Actor& m);
    void drop_loot(const Actor& e);
    void separate();
    void fx_step(float dt);
    vec2 aim_assist(vec2 dir, float range, float cone);
};

}  // namespace q
