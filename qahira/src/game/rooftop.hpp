// The Rooftop Ahwa built up (after the second run on the RP6): a board by the stair lists what the roof can have, each in
// three tiers bought with dinars (and currency from the second), each with a use and something new to see on the roof.
//   the samovar (experience), the pigeon loft (currency), Amm Sayed's awning (his stock), Usta Hassan's forge (the bench's
//   prices), the cistern (the flask), the lamps over the chart table (charts), and the lights, rugs and plants (the roof)
// A character's tiers are kept with it (character file v11). The table is append-only: tiers are stored by index.
#pragma once
#include "core/math.hpp"
#include <string>
#include <vector>

namespace q {

struct Hero;

enum RoofUpgrade : uint8_t { ROOF_SAMOVAR, ROOF_LOFT, ROOF_AWNING, ROOF_FORGE, ROOF_CISTERN, ROOF_LAMPS, ROOF_LIGHTS, ROOF_COUNT };
constexpr int kRoofTiers = 3;
constexpr int kRoofSlots = 12;   // room in the character file for upgrades yet to come

struct RoofDef {
    const char* id;
    const char* name;
    const char* blurb;               // what it is, on the board
    const char* gives[kRoofTiers];   // what each tier gives, in a few words
    int level[kRoofTiers];           // the character level each tier asks
    int gold[kRoofTiers];            // dinars
    int currency[kRoofTiers];        // and a currency (-1: none), so many of it
    int count[kRoofTiers];
};
const std::vector<RoofDef>& roof_defs();

int roof_tier(const Hero& h, int u);                    // 0 (not built) .. kRoofTiers
bool roof_can_build(const Hero& h, int u, std::string* why);
bool roof_build(Hero& h, int u);                        // pays and builds the next tier; false if it can't

// what the tiers do
float roof_xp_mult(const Hero& h);          // the samovar: 1.04 / 1.08 / 1.12
float roof_currency_mult(const Hero& h);    // the loft: currency drops 1.1 / 1.2 / 1.3 as often
int roof_stock_extra(const Hero& h);        // the awning: 2 / 4 / 6 more wares
float roof_stock_rare(const Hero& h);       // and rares among them more often (0 / 0.1 / 0.2 more)
int roof_stock_level(const Hero& h);        // and, at the third, wares two levels above you
float roof_bench_mult(const Hero& h);       // the forge: the bench's prices 0.8 / 0.65 / 0.5
float roof_flask_mult(const Hero& h);       // the cistern: a kill fills the flask 1.25 / 1.5 / 1.75 as much
int roof_flask_extra(const Hero& h);        // and one charge more at the third
float roof_chart_mult(const Hero& h);       // the lamps: charts drop 1.1 / 1.2 / 1.3 as often
int recipe_price(const Hero& h, int recipe);   // a bench recipe's dinars, with the forge's discount

// what to see on the roof: each built upgrade's props, by tier (a static mesh, where it stands relative to the spawn
// point, and which way it faces)
struct RoofProp {
    const char* model;
    vec2 at;
    float facing;
};
std::vector<RoofProp> roof_props(const Hero& h);
vec2 roof_board_pos();   // the board, relative to the spawn point

}  // namespace q
