// The rooftop built up (after the second run on the RP6): seven upgrades in three tiers, paid in dinars and currency,
// each with a use, kept in the character file (v11), and each tier a piece on the roof.
#include "tests/check.hpp"
#include "game/acts.hpp"
#include "game/crafting.hpp"
#include "game/menu.hpp"
#include "game/rooftop.hpp"
#include "game/save.hpp"

using namespace q;

TEST(rooftop_upgrades_cost_and_ask_for_what_they_say) {
    CHECK(roof_defs().size() == ROOF_COUNT && ROOF_COUNT <= kRoofSlots);
    Hero h;
    h.level = 5;
    std::string why;
    CHECK(!roof_can_build(h, ROOF_SAMOVAR, &why) && why == "Needs level 8");
    h.level = 8;
    CHECK(!roof_can_build(h, ROOF_SAMOVAR, &why) && why == "Not enough dinars");
    h.gold = 600;
    CHECK(roof_build(h, ROOF_SAMOVAR) && h.gold == 0 && roof_tier(h, ROOF_SAMOVAR) == 1);
    // the second tier asks for currency as well
    h.level = 30;
    h.gold = 5000;
    CHECK(!roof_can_build(h, ROOF_SAMOVAR, &why) && why.rfind("Needs 3 ", 0) == 0);
    h.currency[CUR_PIASTRE] = 3;
    CHECK(roof_build(h, ROOF_SAMOVAR) && h.currency[CUR_PIASTRE] == 0 && h.gold == 0 && roof_tier(h, ROOF_SAMOVAR) == 2);
    // the forge needs Usta Hassan on the roof, the lamps the Map
    h.gold = 100000;
    CHECK(!roof_can_build(h, ROOF_FORGE, &why) && why == "Usta Hassan isn't on the roof yet");
    CHECK(!roof_can_build(h, ROOF_LAMPS, &why) && why == "The Map of al-Idrisi isn't on the roof yet");
    h.quests |= Q_BENCH | Q_ACT1;
    CHECK(roof_can_build(h, ROOF_FORGE, nullptr) && roof_can_build(h, ROOF_LAMPS, nullptr));
    // three tiers and no more
    h.level = 99;
    for (int k = 0; k < 3; k++) roof_build(h, ROOF_LIGHTS);
    CHECK(roof_tier(h, ROOF_LIGHTS) == 3 && !roof_can_build(h, ROOF_LIGHTS, &why) && why == "Built as far as it goes");
}

TEST(rooftop_upgrades_do_what_they_say) {
    Hero h;
    CHECK(roof_xp_mult(h) == 1.f && roof_currency_mult(h) == 1.f && roof_stock_extra(h) == 0 && roof_bench_mult(h) == 1.f &&
          roof_flask_mult(h) == 1.f && roof_flask_extra(h) == 0 && roof_chart_mult(h) == 1.f && roof_props(h).empty());
    for (int u = 0; u < ROOF_COUNT; u++) h.roof[u] = 3;
    CHECK(std::abs(roof_xp_mult(h) - 1.12f) < 1e-5f && std::abs(roof_currency_mult(h) - 1.3f) < 1e-5f);
    CHECK(roof_stock_extra(h) == 6 && std::abs(roof_stock_rare(h) - 0.2f) < 1e-5f && roof_stock_level(h) == 2);
    CHECK(roof_bench_mult(h) == 0.5f && std::abs(roof_flask_mult(h) - 1.75f) < 1e-5f && roof_flask_extra(h) == 1);
    CHECK(std::abs(roof_chart_mult(h) - 1.3f) < 1e-5f);
    CHECK(recipe_price(h, 0) == std::max(1, int(std::lround(recipes()[0].cost * 0.5f))));
    CHECK(roof_props(h).size() == size_t(ROOF_COUNT * kRoofTiers));   // a piece for every tier
    // the awning's wares: more of them
    World w;
    w.hero.level = 30;
    Menu m;
    m.restock(w);
    const size_t plain = m.stock.items.size();
    w.hero.roof[ROOF_AWNING] = 3;
    m.restock(w);
    CHECK(m.stock.items.size() > plain);
}

TEST(rooftop_upgrades_are_kept_with_the_character) {
    Hero h;
    h.roof[ROOF_LOFT] = 2;
    h.roof[ROOF_LIGHTS] = 3;
    ByteWriter w;
    write_character(w, h);
    Hero r;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, r) && roof_tier(r, ROOF_LOFT) == 2 && roof_tier(r, ROOF_LIGHTS) == 3 && roof_tier(r, ROOF_SAMOVAR) == 0);
}
