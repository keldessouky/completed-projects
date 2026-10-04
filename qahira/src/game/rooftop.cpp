#include "game/rooftop.hpp"
#include "game/acts.hpp"
#include "game/crafting.hpp"
#include "game/inventory.hpp"
#include "game/world.hpp"
#include <algorithm>
#include <cmath>

namespace q {

static_assert(ROOF_COUNT <= kRoofSlots, "the character file keeps kRoofSlots tiers");

const std::vector<RoofDef>& roof_defs() {
    // append only: a character keeps its tiers by index
    static const std::vector<RoofDef> d = {
        {"samovar", "The Samovar", "Amm Sayed's tea, stronger: a glass before every road",
         {"+4% experience", "+8% experience", "+12% experience"}, {8, 30, 60}, {600, 5000, 22000},
         {-1, CUR_PIASTRE, CUR_ATTAR}, {0, 3, 2}},
        {"loft", "The Pigeon Loft", "Pigeons that come home with whatever glitters in the city",
         {"+10% currency drops", "+20% currency drops", "+30% currency drops"}, {12, 35, 62}, {900, 6500, 26000},
         {-1, CUR_SAFFRON, CUR_KHAMSA}, {0, 4, 4}},
        {"awning", "Amm Sayed's Awning", "A proper stall for his wares, and room for more of them",
         {"2 more wares", "4 more wares, rares more often", "6 more wares, from two levels above you"}, {6, 28, 55},
         {500, 4000, 18000}, {-1, CUR_BEAD, CUR_PIASTRE}, {0, 10, 6}},
        {"forge", "Usta Hassan's Forge", "Bellows, a better anvil and a kiln: the bench works cheaper",
         {"Bench mods 20% cheaper", "Bench mods 35% cheaper", "Bench mods half price"}, {10, 32, 58}, {800, 6000, 24000},
         {-1, CUR_SALT, CUR_BAKHOOR}, {0, 10, 4}},
        {"cistern", "The Cistern", "Cool water on the roof: the flask fills faster out in the city",
         {"Kills fill the flask 25% more", "Kills fill the flask 50% more", "75% more, and a charge more"}, {15, 38, 64},
         {1000, 7000, 28000}, {-1, CUR_GROUNDS, CUR_GLASS}, {0, 10, 5}},
        {"lamps", "Lamps over the Map", "Light to read al-Idrisi's map by, and see more roads on it",
         {"+10% chart drops", "+20% chart drops", "+30% chart drops"}, {14, 40, 66}, {1200, 8000, 30000},
         {-1, CUR_SAFFRON, CUR_EMBER}, {0, 6, 2}},
        {"lights", "Lights and Rugs", "For the roof itself: somewhere worth coming home to",
         {"Rugs and cushions", "Lanterns along the parapet", "A jasmine trellis and a canopy"}, {1, 20, 45},
         {300, 2500, 10000}, {-1, -1, -1}, {0, 0, 0}},
    };
    return d;
}

int roof_tier(const Hero& h, int u) { return u >= 0 && u < kRoofSlots ? std::min<int>(h.roof[u], kRoofTiers) : 0; }

bool roof_can_build(const Hero& h, int u, std::string* why) {
    auto no = [&](const std::string& s) { if (why) *why = s; return false; };
    if (u < 0 || u >= int(roof_defs().size())) return no("Nothing to build");
    const RoofDef& d = roof_defs()[size_t(u)];
    const int t = roof_tier(h, u);
    if (t >= kRoofTiers) return no("Built as far as it goes");
    if (u == ROOF_FORGE && !(h.quests & Q_BENCH)) return no("Usta Hassan isn't on the roof yet");
    if (u == ROOF_LAMPS && !(h.quests & Q_ACT1)) return no("The Map of al-Idrisi isn't on the roof yet");
    if (h.level < d.level[t]) return no("Needs level " + std::to_string(d.level[t]));
    if (h.gold < d.gold[t]) return no("Not enough dinars");
    if (d.currency[t] >= 0 && h.currency[d.currency[t]] < d.count[t])
        return no(std::string("Needs ") + std::to_string(d.count[t]) + " " + currency_def(d.currency[t]).name);
    return true;
}

bool roof_build(Hero& h, int u) {
    if (!roof_can_build(h, u, nullptr)) return false;
    const RoofDef& d = roof_defs()[size_t(u)];
    const int t = roof_tier(h, u);
    h.gold -= d.gold[t];
    if (d.currency[t] >= 0) h.currency[d.currency[t]] -= d.count[t];
    h.roof[u] = uint8_t(t + 1);
    return true;
}

float roof_xp_mult(const Hero& h) { return 1.f + 0.04f * float(roof_tier(h, ROOF_SAMOVAR)); }
float roof_currency_mult(const Hero& h) { return 1.f + 0.1f * float(roof_tier(h, ROOF_LOFT)); }
int roof_stock_extra(const Hero& h) { return 2 * roof_tier(h, ROOF_AWNING); }
float roof_stock_rare(const Hero& h) { return roof_tier(h, ROOF_AWNING) >= 2 ? 0.1f * float(roof_tier(h, ROOF_AWNING) - 1) : 0.f; }
int roof_stock_level(const Hero& h) { return roof_tier(h, ROOF_AWNING) >= 3 ? 2 : 0; }
float roof_bench_mult(const Hero& h) {
    static const float m[kRoofTiers + 1] = {1.f, 0.8f, 0.65f, 0.5f};
    return m[roof_tier(h, ROOF_FORGE)];
}
float roof_flask_mult(const Hero& h) { return 1.f + 0.25f * float(roof_tier(h, ROOF_CISTERN)); }
int roof_flask_extra(const Hero& h) { return roof_tier(h, ROOF_CISTERN) >= 3 ? 1 : 0; }
float roof_chart_mult(const Hero& h) { return 1.f + 0.1f * float(roof_tier(h, ROOF_LAMPS)); }
int recipe_price(const Hero& h, int recipe) {
    return std::max(1, int(std::lround(float(recipes()[size_t(recipe)].cost) * roof_bench_mult(h))));
}

// where each tier's piece stands, relative to the spawn point (0, -4 on the roof: the roof runs -10..10 each way); a
// tier shows its piece and every piece below it. The meshes are drawn in the roof's own axes.
std::vector<RoofProp> roof_props(const Hero& h) {
    static const RoofProp pieces[ROOF_COUNT][kRoofTiers] = {
        {{"roof_samovar_1", {8.5f, 10.3f}, 0}, {"roof_samovar_2", {7.0f, 10.7f}, 0}, {"roof_samovar_3", {8.6f, 11.9f}, 0}},
        {{"roof_loft_1", {-8.7f, 8.0f}, 0}, {"roof_loft_2", {-8.7f, 6.3f}, 0}, {"roof_loft_3", {-8.7f, 9.7f}, 0}},
        {{"roof_awning_1", {8.6f, 7.0f}, 0}, {"roof_awning_2", {7.2f, 4.6f}, 0}, {"roof_awning_3", {8.6f, 7.0f}, 0}},
        {{"roof_forge_1", {-6.9f, 3.4f}, 0}, {"roof_forge_2", {-8.0f, 4.6f}, 0}, {"roof_forge_3", {-7.2f, 2.0f}, 0}},
        {{"roof_cistern_1", {-1.2f, 12.9f}, 0}, {"roof_cistern_2", {1.4f, 12.7f}, 0}, {"roof_cistern_3", {0.1f, 11.4f}, 0}},
        {{"roof_lamps_1", {4.6f, 3.8f}, 0}, {"roof_lamps_2", {4.6f, 3.8f}, 0}, {"roof_lamps_3", {6.0f, 4.9f}, 0}},
        {{"roof_lights_1", {-1.0f, 6.6f}, 0}, {"roof_lights_2", {0.0f, -5.4f}, 0}, {"roof_lights_3", {-9.2f, 6.0f}, 0}},
    };
    std::vector<RoofProp> out;
    for (int u = 0; u < ROOF_COUNT; u++)
        for (int t = 0; t < roof_tier(h, u); t++) out.push_back(pieces[u][t]);
    return out;
}

vec2 roof_board_pos() { return {-4.0f, -5.0f}; }

}  // namespace q
