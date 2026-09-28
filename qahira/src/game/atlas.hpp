// The endgame (GDD §10): the Map of al-Idrisi. In 1154 al-Idrisi drew the world for King Roger of Sicily with south
// at the top; its sites are the cities on that map. A chart (a map item of one of the Seven Climes, tiers 1-7, or of the
// Reaches of the Encircling Sea beyond them, tiers 8-16) is run on a revealed site of its tier; finishing a site reveals
// its neighbours and gives an Astrolabe point. Charts above the Fourth Clime drop once Act V is over; the masters of the
// last Reaches drop the King's Pearls, and four open the Marid King's throne.
//
// The chart drop rules live here, in one place, so the game and the tier-progression simulation (tools/chartsim.cpp)
// share them.
#pragma once
#include "core/math.hpp"
#include "game/items.hpp"
#include <string>
#include <vector>

namespace q {

constexpr int kChartTiers = 16;
constexpr int kChartTiersEarly = 4;             // the highest tier that drops before Act V is over
constexpr float kReachUp = 0.07f, kReachDown = 0.14f;   // above the Fourth: the chance a dropped chart is a tier up, down
constexpr int kPearlTier = 14;                 // the masters of this tier and above drop the King's Pearls
int chart_area_level(int tier);                 // T1 = 14 .. T4 = 17, then T5 = 54 .. T16 = 65 (after Act V)
std::string tier_name(int tier);                // "the Fifth Clime", "the Ninth Reach"
const char* tier_ordinal(int tier);             // "Fifth", "Ninth"

struct Site {
    const char* id;
    const char* name;
    const char* note;          // a line from the map's margin
    int tier;
    float lon, lat;            // where it is
    float mx, my;              // where the map draws it: a schematic of al-Idrisi's world, south up and east left, in
                               // units of the world's radius (the true positions crowd the Nile into one corner)
    const char* zone;          // its ZoneDef (game/acts.hpp): tileset, spawns, boss
    std::vector<const char*> links;
};

// Append only: characters store sites as bits.
const std::vector<Site>& sites();
int find_site(const std::string& id);
bool site_linked(int a, int b);
uint32_t starting_sites();                      // revealed from the first: the First Clime round Cairo
uint32_t reveal_after(int site);                // what finishing it reveals

// ---- charts (items): one base per clime, with their own mods
int chart_base(int tier);                       // an item base index
int chart_tier(const Item& it);                 // 0 if not a chart
struct ChartMods {
    float monster_life = 0, monster_damage = 0, monster_speed = 0, pack_size = 0, magic_packs = 0;
    float extra_fire = 0;      // monsters' hits add this share as fire
    float hero_res = 0;        // to your maximum resistances (negative)
    float quantity = 0, rarity = 0;
    float haboob = 0;          // added chance of a Haboob
};
ChartMods chart_mods(const Item& chart);
Item make_chart(int tier, Rng& rng, float magic_chance = 0.3f, float rare_chance = 0.08f);

// ---- the Astrolabe: the atlas tree, 23 nodes on four arms of an astrolabe's rete
enum AstroEffect : uint8_t {
    AX_NONE, AX_CHART_DROP, AX_TIER_UP, AX_HABOOB_CHANCE, AX_HABOOB_WIDTH, AX_HABOOB_METER, AX_HABOOB_REWARD, AX_PACK_SIZE,
    AX_RARITY, AX_BOSS_CHART, AX_SCRAPS, AX_QUANTITY, AX_MAGIC_CHARTS, AX_CURRENCY, AX_XP, AX_STORM_GUARD, AX_PEARLS, AX_COUNT
};
struct AstroNode {
    const char* name;
    const char* star;          // the astrolabe's rete pointer it sits on (a star name)
    int parent;                // -1 the centre
    vec2 pos;                  // on the plate, in rete units
    AstroEffect effect;
    float value;
    const char* text;
};
const std::vector<AstroNode>& astro_nodes();   // append only: characters store nodes as bits
bool astro_can_take(uint32_t held, int node);
float astro_value(uint32_t held, AstroEffect e);   // the sum of every held node's value for an effect
int astro_points(uint32_t sites_done);            // one per site finished

// ---- drops: what a chart run yields (shared with the simulation)
struct ChartRun {
    int tier = 1;
    ChartMods mods;
    uint32_t astro = 0;
    int max_tier = kChartTiersEarly;   // what a drop can reach: all sixteen once Act V is over
};
float chart_drop_chance(const ChartRun& r, Rarity monster);   // per kill
int roll_chart_tier(const ChartRun& r, Rng& rng);             // the tier of a dropped chart
int boss_chart_drops(const ChartRun& r, Rng& rng);            // charts from the site's boss
float haboob_chance(const ChartRun& r);
int pearl_drops(const ChartRun& r, Rng& rng);                  // King's Pearls from the master of a site of T14 and up

}  // namespace q
