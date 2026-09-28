// Slice 9's endgame piece: the charts climb past the Fourth Clime once Act V is over (the Fifth, Sixth and Seventh Climes,
// then the Reaches of the Encircling Sea to the Sixteenth), the masters of the last Reaches drop the King's Pearls, and
// four of them open the Marid King's throne. The zones outgrew 64, so waypoints are kept for 128.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/atlas.hpp"
#include "game/save.hpp"
#include <set>

using namespace q;

TEST(sixteen_tiers_of_charts_each_with_its_own_base_and_level) {
    CHECK(kChartTiers == 16);
    CHECK(chart_area_level(1) == 14 && chart_area_level(4) == 17);
    CHECK(chart_area_level(5) == 54 && chart_area_level(16) == 65);   // a level a tier, from near Act V's end (56)
    CHECK(tier_name(5) == "the Fifth Clime" && tier_name(7) == "the Seventh Clime" && tier_name(8) == "the Eighth Reach" &&
          tier_name(16) == "the Sixteenth Reach");
    std::set<int> bases;
    Rng r(5);
    for (int t = 1; t <= kChartTiers; t++) {
        CHECK(chart_base(t) >= 0);
        bases.insert(chart_base(t));
        CHECK(item_bases()[size_t(chart_base(t))].level == chart_area_level(t));
        Item c = make_chart(t, r, 0.5f, 0.3f);
        CHECK(chart_tier(c) == t);
        int n = 0;   // and every tier has sites to run it on
        for (auto& s : sites()) n += s.tier == t;
        CHECK(n >= 1);
    }
    CHECK(bases.size() == size_t(kChartTiers));
    // the higher sites are act 0, at their tier's level, with a master that is a boss
    for (auto& s : sites()) {
        const ZoneDef& z = zone_def(find_zone(s.zone));
        CHECK(z.act == 0 && z.level == chart_area_level(s.tier) && boss_def(find_monster(z.boss)) != nullptr);
    }
}

TEST(charts_drop_past_the_fourth_clime_only_after_act_five) {
    Rng g(11);
    ChartRun early;
    early.tier = kChartTiersEarly;
    int over = 0;
    for (int k = 0; k < 3000; k++) over += roll_chart_tier(early, g) > kChartTiersEarly;
    CHECK(over == 0);
    ChartRun late = early;
    late.max_tier = kChartTiers;
    for (int k = 0; k < 3000; k++) over += roll_chart_tier(late, g) == kChartTiersEarly + 1;
    CHECK(over > 450 && over < 750);   // a fifth of the time, the next tier up
    late.tier = kChartTiers;
    for (int k = 0; k < 500; k++) CHECK(roll_chart_tier(late, g) <= kChartTiers);
}

TEST(the_masters_of_the_last_reaches_drop_the_kings_pearls) {
    CHECK(currency_def(CUR_PEARL).weight == 0);   // never at random
    Rng r(2);
    for (int k = 0; k < 3000; k++) CHECK(roll_currency(r, 100) != CUR_PEARL);
    ChartRun run;
    Rng g(3);
    for (int t = 1; t < kPearlTier; t++) {
        run.tier = t;
        for (int k = 0; k < 200; k++) CHECK(pearl_drops(run, g) == 0);
    }
    run.tier = kChartTiers;
    int n = 0;
    for (int k = 0; k < 2000; k++) n += pearl_drops(run, g);
    CHECK(n > 1200 && n < 1580);   // 49%, and 20% another
    run.astro = 1u << 21;           // The King's Tribute: 30% more
    int m = 0;
    for (int k = 0; k < 2000; k++) m += pearl_drops(run, g);
    CHECK(m > n);
    // in the world: the master of the Encircling Ocean, killed again and again
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("warrior");
    w.in_chart = true;
    w.chart_site = find_site("muhit");
    w.chart.tier = kChartTiers;
    w.area_level = chart_area_level(kChartTiers);
    int pearls = 0;
    for (int k = 0; k < 40; k++) {
        Actor& b = w.spawn_monster(find_monster("rift_lord"), {0, 5}, Rarity::Normal, w.area_level);
        w.kill(b);
        for (auto& gi : w.loot) if (gi.kind == GroundItem::Currency && gi.currency == CUR_PEARL) pearls += gi.amount;
        w.loot.clear();
        w.actors.resize(1);
    }
    CHECK(pearls > 16 && pearls < 48);
}

TEST(the_marid_kings_throne) {
    int z = find_zone("king_throne");
    CHECK(z >= 0);
    const ZoneDef& d = zone_def(z);
    CHECK(d.act == 0 && d.level > chart_area_level(kChartTiers));
    int king = find_monster("marid_king");
    CHECK(king >= 0 && std::string(d.boss) == "marid_king");
    const BossDef* b = boss_def(king);
    CHECK(b && b->call && b->moves.size() == 7);
    CHECK(std::string(monster_defs()[size_t(king)].codex) == "marid_king");
    CHECK(kPearlsPerThrone == 4 && currency_def(CUR_PEARL).weight == 0);
}

TEST(waypoints_are_kept_for_128_zones) {
    CHECK(zone_defs().size() > 64 && zone_defs().size() <= 128);
    ZoneBits b;
    b.add(3);
    b.add(70);
    b.add(127);
    CHECK(b.has(3) && b.has(70) && b.has(127) && !b.has(71) && !b.has(128) && !b.has(-1));
    Hero h;
    h.waypoints = b;
    h.currency[CUR_PEARL] = 3;
    ByteWriter w;
    write_character(w, h);
    Hero r;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, r));
    CHECK(r.waypoints == b && r.currency[CUR_PEARL] == 3);
}
