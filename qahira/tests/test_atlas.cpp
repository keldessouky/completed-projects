// The Map of al-Idrisi: every site is reachable from the First Clime, the Climes rise along its roads, charts roll
// only chart mods and those mods are read back, the Astrolabe's parents hold, and the drop rules stay sane.
#include "tests/check.hpp"
#include "game/save.hpp"

using namespace q;

TEST(every_site_can_be_reached_from_the_first_clime) {
    auto& S = sites();
    CHECK(S.size() == 16);
    uint32_t seen = starting_sites(), frontier = seen;
    for (int k = 0; k < 8; k++) {
        uint32_t next = seen;
        for (size_t i = 0; i < S.size(); i++) if (frontier >> i & 1) next |= reveal_after(int(i));
        frontier = next & ~seen;
        seen = next;
    }
    CHECK(seen == (1u << S.size()) - 1);
    for (size_t i = 0; i < S.size(); i++) {
        CHECK(find_zone(S[i].zone) >= 0);
        CHECK(zone_def(find_zone(S[i].zone)).act == 0);
        CHECK(zone_def(find_zone(S[i].zone)).level == chart_area_level(S[i].tier));
        for (const char* l : S[i].links) {
            int j = find_site(l);
            CHECK(j >= 0);
            if (j >= 0) CHECK(S[size_t(j)].tier >= S[i].tier);   // a road never leads back down a Clime
        }
        // every site but the Fourth Clime's leads on
        if (S[i].tier < kChartTiers) CHECK(!S[i].links.empty());
    }
}

TEST(charts_roll_chart_mods_and_read_them_back) {
    Rng r(3);
    for (int t = 1; t <= kChartTiers; t++) {
        for (int k = 0; k < 30; k++) {
            Item c = make_chart(t, r, 0.5f, 0.3f);
            CHECK(chart_tier(c) == t);
            CHECK(c.b().slot == Slot::Chart && equip_slot_for(c, nullptr) < 0);
            for (auto& a : c.affixes) CHECK(affix_defs()[a.def].effect == AE_CHART);
            ChartMods m = chart_mods(c);
            CHECK(m.quantity == 8.f * float(c.affixes.size()));
        }
        // currency works on charts as on any item
        Item c = make_item(chart_base(t), Rarity::Normal, chart_area_level(t), r);
        CHECK(apply_currency(CUR_SAFFRON, c, r) && c.rarity == Rarity::Rare && c.affixes.size() >= 4);
        for (auto& a : c.affixes) CHECK(affix_defs()[a.def].effect == AE_CHART);
    }
    // gear never rolls chart mods, and charts never drop as gear
    for (int k = 0; k < 200; k++) {
        Item g = random_drop(20, 0.5f, 0.4f, r);
        CHECK(g.b().slot != Slot::Chart);
        for (auto& a : g.affixes) CHECK(affix_defs()[a.def].effect != AE_CHART);
    }
}

TEST(the_astrolabe_and_the_drop_rules) {
    auto& n = astro_nodes();
    CHECK(n.size() == 20);
    for (size_t i = 0; i < n.size(); i++) CHECK(n[i].parent < int(i));   // parents come first
    CHECK(astro_can_take(0, 0) && !astro_can_take(0, 1) && astro_can_take(1u, 1));
    CHECK(astro_value(1u, AX_CHART_DROP) == 10.f && astro_points(0x7) == 3);
    ChartRun r;
    CHECK(chart_drop_chance(r, Rarity::Rare) > chart_drop_chance(r, Rarity::Magic));
    ChartRun rich = r;
    rich.astro = 1u | (1u << 4);   // Clear Skies needs no parent; Guided by Canopus needs its chain, but the value adds regardless
    CHECK(chart_drop_chance(rich, Rarity::Rare) > chart_drop_chance(r, Rarity::Rare));
    Rng g(9);
    int up = 0, down = 0;
    for (int k = 0; k < 4000; k++) {
        r.tier = 2;
        int t = roll_chart_tier(r, g);
        CHECK(t >= 1 && t <= kChartTiers);
        up += t == 3;
        down += t == 1;
    }
    CHECK(up > 600 && up < 1000 && down > 300 && down < 700);
    CHECK(haboob_chance(r) >= 0.3f && haboob_chance(r) <= 1.f);
}

TEST(character_v5_keeps_the_map) {
    Hero h;
    h.sites_revealed = 0xFF;
    h.sites_done = 0x13;
    h.astro = 0x21;
    Rng r(1);
    h.inv.add(make_chart(3, r));
    ByteWriter w;
    write_character(w, h);
    Hero b;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, b));
    CHECK(b.sites_revealed == 0xFF && b.sites_done == 0x13 && b.astro == 0x21);
    CHECK(b.inv.items.size() == 1 && chart_tier(b.inv.items[0].item) == 3);
    CHECK(b.astro_points() == 1);   // three sites done, two nodes set
}
