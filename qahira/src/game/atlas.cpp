#include "game/atlas.hpp"
#include "game/inventory.hpp"
#include <algorithm>
#include <array>
#include <cmath>

namespace q {

int chart_area_level(int tier) {
    tier = std::clamp(tier, 1, kChartTiers);
    return tier <= kChartTiersEarly ? 13 + tier : 49 + tier;   // the higher tiers begin near Act V's end (level 56), a level a tier
}

const char* tier_ordinal(int tier) {
    static const char* n[kChartTiers] = {"First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth",
                                         "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth"};
    return n[std::clamp(tier, 1, kChartTiers) - 1];
}

// al-Idrisi's world has Seven Climes; beyond the Seventh are the Reaches of the Encircling Sea
std::string tier_name(int tier) { return std::string("the ") + tier_ordinal(tier) + (tier <= 7 ? " Clime" : " Reach"); }

// The cities on al-Idrisi's map, round Cairo (the rooftop). Tiers are the Seven Climes, counted outwards.
const std::vector<Site>& sites() {
    static const std::vector<Site> s = {
        // the First Clime
        {"iskandariya", "al-Iskandariya", "The lighthouse city, where the sea wind never rests", 1, 29.9f, 31.2f, -0.20f, 0.25f, "site_iskandariya",
         {"wahat", "barqa"}},
        {"dimyat", "Dimyat", "The river's mouth, and its chains across the water", 1, 31.8f, 31.4f, -0.40f, 0.31f, "site_dimyat", {"tur"}},
        {"tinnis", "Tinnis", "An island of weavers in the lake", 1, 32.4f, 31.1f, -0.60f, 0.27f, "site_tinnis", {"tur"}},
        {"qus", "Qus", "Where the pilgrims' road leaves the Nile", 1, 32.8f, 25.9f, -0.50f, -0.28f, "site_qus", {"aswan", "wahat"}},
        // the Second
        {"aswan", "Aswan", "The first cataract, and the granite of the kings", 2, 32.9f, 24.1f, -0.52f, -0.50f, "site_aswan", {"ayla"}},
        {"wahat", "al-Wahat", "The Oases, green islands in the sand sea", 2, 29.2f, 26.0f, -0.22f, -0.18f, "site_wahat", {"qayrawan"}},
        {"barqa", "Barqa", "Red earth, and the road west", 2, 20.9f, 32.5f, -0.02f, 0.22f, "site_barqa", {"atrabulus"}},
        {"tur", "al-Tur", "The harbour below the mountain of Sinai", 2, 33.6f, 28.2f, -0.68f, 0.02f, "site_tur", {"ayla"}},
        // the Third
        {"atrabulus", "Atrabulus", "Tripoli of the West, walls to the sea", 3, 13.2f, 32.9f, 0.24f, 0.20f, "site_atrabulus", {"mahdiya"}},
        {"qayrawan", "al-Qayrawan", "The caravan city, and its great cisterns", 3, 10.1f, 35.7f, 0.40f, 0.08f, "site_qayrawan", {"mahdiya", "fas"}},
        {"mahdiya", "al-Mahdiya", "A fortress on a finger of rock", 3, 11.1f, 35.5f, 0.47f, 0.24f, "site_mahdiya", {"tunis", "balarm"}},
        {"ayla", "Ayla", "The port at the head of the gulf", 3, 35.0f, 29.5f, -0.80f, -0.14f, "site_ayla", {"tunis"}},   // the sea road west
        // the Fourth
        {"tunis", "Tunis", "The lake, the olive groves, the white houses", 4, 10.2f, 36.8f, 0.56f, 0.33f, "site_tunis", {"balarm", "saraqusa"}},
        {"balarm", "Balarm", "King Roger's court, where the map was drawn", 4, 13.4f, 38.1f, 0.40f, 0.60f, "site_balarm", {"saraqusa"}},
        {"fas", "Fas", "A city of a thousand lanes", 4, -5.0f, 34.0f, 0.80f, 0.08f, "site_fas", {"sabta", "marrakush"}},
        {"sabta", "Sabta", "The strait, and the edge of the known sea", 4, -5.3f, 35.9f, 0.84f, 0.33f, "site_sabta", {}},
        // Slice 9: past the Fourth Clime, two roads: south across the sand to the gold country, and east over the sea to the
        // cities of the Levant; the southern road runs on round the edge of the world, to the Encircling Ocean
        {"marrakush", "Marrakush", "The red city at the foot of the snows", 5, -8.0f, 31.6f, 0.86f, -0.10f, "site_marrakush", {"sijilmasa"}},
        {"saraqusa", "Saraqusa", "Sicily's other harbour, and the old quarries under the town", 5, 15.3f, 37.1f, 0.18f, 0.54f, "site_saraqusa",
         {"iqritish"}},
        {"sijilmasa", "Sijilmasa", "The last city before the sand, where the gold caravans gather", 6, -4.3f, 31.3f, 0.62f, -0.22f,
         "site_sijilmasa", {"awdaghust"}},
        {"iqritish", "Iqritish", "An island of a hundred harbours, and a maze in its hills", 6, 25.1f, 35.3f, -0.12f, 0.50f, "site_iqritish",
         {"dimashq"}},
        {"awdaghust", "Awdaghust", "Wells in the sand, houses of stone, and the date palms", 7, -10.4f, 17.4f, 0.80f, -0.40f,
         "site_awdaghust", {"ghana"}},
        {"dimashq", "Dimashq", "Seven rivers and their orchards, and the swordsmiths' market", 7, 36.3f, 33.5f, -0.78f, 0.44f,
         "site_dimashq", {"baghdad"}},
        {"ghana", "Ghana", "Two towns on the river, and gold in its sand", 8, -8.0f, 15.7f, 0.54f, -0.62f, "site_ghana", {"kawkaw"}},
        {"baghdad", "Baghdad", "The Round City, and its House of Wisdom", 8, 44.4f, 33.3f, -0.86f, 0.20f, "site_baghdad", {}},   // the eastern road ends
        {"kawkaw", "Kawkaw", "A king's city on the great river of the south", 9, 0.0f, 16.3f, 0.26f, -0.44f, "site_kawkaw", {"jabal_qamar"}},
        {"jabal_qamar", "Jabal al-Qamar", "The Mountains of the Moon, where the Nile begins in ten springs", 10, 29.9f, 0.4f, -0.04f, -0.50f,
         "site_jabal_qamar", {"sufala"}},
        {"sufala", "Sufala", "The last harbour down the eastern coast, and gold dug from the hills", 11, 34.8f, -20.2f, 0.10f, -0.78f,
         "site_sufala", {"qumr"}},
        {"qumr", "Qumr", "The island of the moon, a month's sailing long", 12, 46.0f, -19.0f, -0.20f, -0.84f, "site_qumr", {"maqdishu"}},
        {"maqdishu", "Maqdishu", "White houses on the dunes, and ships from the Indies", 13, 45.3f, 2.0f, -0.40f, -0.70f, "site_maqdishu",
         {"adan"}},
        {"adan", "Adan", "A harbour inside a dead fire-mountain, and the half-men in its hills", 14, 45.0f, 12.8f, -0.66f, -0.58f,
         "site_adan", {"waqwaq"}},
        {"waqwaq", "al-Waq-Waq", "An island at the world's end, where a tree calls out", 15, 120.0f, 0.0f, -0.78f, -0.40f, "site_waqwaq",
         {"muhit"}},
        {"muhit", "al-Bahr al-Muhit", "The Encircling Ocean. Past it the map is blank", 16, 130.0f, -10.0f, -0.98f, -0.16f, "site_muhit", {}},
    };
    return s;
}

int find_site(const std::string& id) {
    auto& s = sites();
    for (size_t i = 0; i < s.size(); i++) if (id == s[i].id) return int(i);
    return -1;
}

bool site_linked(int a, int b) {
    auto& s = sites();
    for (const char* l : s[size_t(a)].links) if (find_site(l) == b) return true;
    for (const char* l : s[size_t(b)].links) if (find_site(l) == a) return true;
    return false;
}

uint32_t starting_sites() {
    uint32_t m = 0;
    auto& s = sites();
    for (size_t i = 0; i < s.size(); i++) if (s[i].tier == 1) m |= 1u << i;
    return m;
}

uint32_t reveal_after(int site) {
    uint32_t m = 0;
    for (size_t i = 0; i < sites().size(); i++) if (site_linked(site, int(i))) m |= 1u << i;
    return m;
}

// ---- charts
int chart_base(int tier) {
    static const std::array<int, kChartTiers> ids = [] {
        std::array<int, kChartTiers> v{};
        for (int t = 1; t <= kChartTiers; t++) v[size_t(t - 1)] = find_base(("chart_clime_" + std::to_string(t)).c_str());
        return v;
    }();
    return ids[size_t(std::clamp(tier, 1, kChartTiers) - 1)];
}

int chart_tier(const Item& it) {
    if (it.empty() || it.b().slot != Slot::Chart) return 0;
    for (int t = 1; t <= kChartTiers; t++) if (it.base == chart_base(t)) return t;
    return 0;
}

ChartMods chart_mods(const Item& chart) {
    ChartMods m;
    for (auto& a : chart.affixes) {
        std::string id = affix_defs()[a.def].id;
        float v = a.v1;
        if (id == "cm_life") m.monster_life += v;
        else if (id == "cm_damage") m.monster_damage += v;
        else if (id == "cm_speed") m.monster_speed += v;
        else if (id == "cm_packs") m.pack_size += v;
        else if (id == "cm_elites") m.magic_packs += v;
        else if (id == "cm_fire") m.extra_fire += v;
        else if (id == "cm_res") m.hero_res -= v;
        else if (id == "cm_rarity") m.rarity += v;
        else if (id == "cm_sand") m.haboob += v;
        m.quantity += 8.f;   // every mod on a chart is risk, and pays: 8% more items each (PoE's rule)
    }
    return m;
}

Item make_chart(int tier, Rng& rng, float magic_chance, float rare_chance) {
    float r = rng.uniform();
    Rarity rar = r < rare_chance ? Rarity::Rare : r < rare_chance + magic_chance ? Rarity::Magic : Rarity::Normal;
    return make_item(chart_base(tier), rar, chart_area_level(tier), rng);
}

// ---- the Astrolabe
const std::vector<AstroNode>& astro_nodes() {
    // four arms: charts (Suhail / Canopus), the Haboob (al-Simak), riches (al-Shi'ra / Sirius), the road (al-Nasr / Altair)
    static const std::vector<AstroNode> n = {
        // charts
        {"Clear Skies", "Suhail", -1, {0, 1.2f}, AX_CHART_DROP, 10, "10% more charts found"},
        {"The Cartographer's Hand", "Suhail", 0, {0, 2.2f}, AX_TIER_UP, 10, "Charts you find are a Clime higher 10% more often"},
        {"Inked Margins", "Suhail", 1, {-0.6f, 3.1f}, AX_MAGIC_CHARTS, 25, "Charts you find are magic or rare 25% more often"},
        {"The King's Commission", "Suhail", 1, {0.6f, 3.1f}, AX_BOSS_CHART, 35, "A site's master drops another chart 35% of the time"},
        {"Guided by Canopus", "Suhail", 3, {0.6f, 4.1f}, AX_CHART_DROP, 15, "15% more charts found"},
        // the Haboob
        {"The Sand Wind", "al-Simak", -1, {1.2f, 0}, AX_HABOOB_CHANCE, 15, "+15% chance of a Haboob in a chart"},
        {"Deep Storm", "al-Simak", 5, {2.2f, 0}, AX_HABOOB_WIDTH, 25, "The Haboob's storm is 25% deeper"},
        {"Sand Jinn Hunters", "al-Simak", 6, {3.1f, 0.6f}, AX_HABOOB_METER, 30, "Kills inside the storm fill it 30% faster"},
        {"The Storm's Leavings", "al-Simak", 6, {3.1f, -0.6f}, AX_HABOOB_REWARD, 1, "What the Haboob leaves holds another currency"},
        {"Sandstorm Veteran", "al-Simak", 8, {4.1f, -0.6f}, AX_STORM_GUARD, 12, "12% less damage taken inside the storm"},
        // riches
        {"Rich Cities", "al-Shi'ra", -1, {0, -1.2f}, AX_RARITY, 10, "10% increased rarity of items found in charts"},
        {"Teeming Roads", "al-Shi'ra", 10, {0, -2.2f}, AX_PACK_SIZE, 10, "10% more monsters in charts"},
        {"Old Currents", "al-Shi'ra", 11, {-0.6f, -3.1f}, AX_CURRENCY, 20, "20% more currency found in charts"},
        {"Poster Hunters", "al-Shi'ra", 11, {0.6f, -3.1f}, AX_SCRAPS, 50, "50% more Poster Scraps found in charts"},
        {"The Merchant's Scales", "al-Shi'ra", 12, {-0.6f, -4.1f}, AX_QUANTITY, 8, "8% increased quantity of items found in charts"},
        // the road
        {"Travelling Scholar", "al-Nasr", -1, {-1.2f, 0}, AX_XP, 10, "10% more experience in charts"},
        {"Seasoned Traveller", "al-Nasr", 15, {-2.2f, 0}, AX_STORM_GUARD, 8, "8% less damage taken inside the storm"},
        {"The Long Road", "al-Nasr", 16, {-3.1f, 0.6f}, AX_QUANTITY, 6, "6% increased quantity of items found in charts"},
        {"Charts in the Saddlebag", "al-Nasr", 16, {-3.1f, -0.6f}, AX_CHART_DROP, 10, "10% more charts found"},
        {"The Seventh Clime", "al-Nasr", 17, {-4.1f, 0.6f}, AX_TIER_UP, 10, "Charts you find are a Clime higher 10% more often"},
        // Slice 9: the Reaches, and the Marid King's tribute
        {"Beyond the Seventh Clime", "Suhail", 2, {-0.6f, 4.1f}, AX_TIER_UP, 10, "Charts you find are a tier higher 10% more often"},
        {"The King's Tribute", "Suhail", 20, {-1.3f, 3.6f}, AX_PEARLS, 30, "The masters of the last Reaches drop King's Pearls 30% more often"},
        {"The Pearl Divers", "al-Shi'ra", 13, {0.6f, -4.1f}, AX_PEARLS, 20, "The masters of the last Reaches drop King's Pearls 20% more often"},
    };
    return n;
}

bool astro_can_take(uint32_t held, int node) {
    auto& n = astro_nodes();
    if (node < 0 || node >= int(n.size()) || (held >> node & 1)) return false;
    int p = n[size_t(node)].parent;
    return p < 0 || (held >> p & 1);
}

float astro_value(uint32_t held, AstroEffect e) {
    float v = 0;
    auto& n = astro_nodes();
    for (size_t i = 0; i < n.size(); i++) if ((held >> i & 1) && n[i].effect == e) v += n[i].value;
    return v;
}

int astro_points(uint32_t sites_done) { return __builtin_popcount(sites_done); }

// ---- drops
float chart_drop_chance(const ChartRun& r, Rarity monster) {
    float base = monster == Rarity::Rare ? 0.12f : monster == Rarity::Magic ? 0.02f : 0.003f;
    float more = 1.f + astro_value(r.astro, AX_CHART_DROP) / 100.f;
    return base * more * (1.f + r.mods.quantity / 100.f);
}

int roll_chart_tier(const ChartRun& r, Rng& rng) {
    // past the Fourth Clime the climb is slower: a chart a tier up is rarer, and one a tier down commoner
    const bool reach = r.tier > kChartTiersEarly;
    float up = (reach ? kReachUp : 0.2f) + astro_value(r.astro, AX_TIER_UP) / (reach ? 300.f : 100.f);
    float down = reach ? kReachDown : 0.12f;
    float x = rng.uniform();
    int t = x < up ? r.tier + 1 : x < up + down ? r.tier - 1 : r.tier;
    return std::clamp(t, 1, std::clamp(r.max_tier, 1, kChartTiers));
}

int boss_chart_drops(const ChartRun& r, Rng& rng) {
    int n = rng.chance(0.65f) ? 1 : 0;
    if (rng.chance(0.2f)) n++;
    if (rng.chance(astro_value(r.astro, AX_BOSS_CHART) / 100.f)) n++;
    return n;
}

int pearl_drops(const ChartRun& r, Rng& rng) {
    if (r.tier < kPearlTier) return 0;
    const float more = 1.f + astro_value(r.astro, AX_PEARLS) / 100.f;
    int n = rng.chance(std::min(1.f, (0.25f + 0.12f * float(r.tier - kPearlTier)) * more)) ? 1 : 0;   // T14 25%, T15 37%, T16 49%
    if (r.tier == kChartTiers && rng.chance(0.2f * more)) n++;
    return n;
}

int scale_drops(const ChartRun& r, bool campaign_over, Rng& rng) {
    if (!campaign_over || r.tier < kChartTiers - 1) return 0;
    return rng.chance(r.tier == kChartTiers ? 0.3f : 0.15f) ? 1 : 0;   // T15 15%, T16 30%
}

const PinnacleDef& pinnacle_def(int p) {
    static const PinnacleDef d[PIN_COUNT] = {
        {"The Marid King", "king_throne", "marid_king", CUR_PEARL, kPearlsPerThrone, false,
         "the masters of the Fourteenth Reach and up carry King's Pearls"},
        {"The Marid King Unbound", "king_throne", "marid_king", CUR_PEARL, 2 * kPearlsPerThrone, true,
         "eight King's Pearls: the King with the whole sea behind him"},
        {"Falak, beneath the World", "falak_lair", "falak", CUR_SCALE, kPearlsPerThrone, false,
         "the Keeper of the Gate of Iram, and the last two Reaches' masters after Act VI, carry Scales of Falak"},
        {"Falak Awake", "falak_lair", "falak", CUR_SCALE, 2 * kPearlsPerThrone, true,
         "eight Scales of Falak: the serpent that holds the world, awake"},
    };
    return d[std::clamp(p, 0, PIN_COUNT - 1)];
}

void uber_mods(ChartMods& m) {
    m.monster_life += 200;
    m.monster_damage += 50;
    m.quantity += 50;
    m.rarity += 50;
}

float haboob_chance(const ChartRun& r) {
    return std::min(1.f, 0.3f + astro_value(r.astro, AX_HABOOB_CHANCE) / 100.f + r.mods.haboob / 100.f);
}

}  // namespace q
