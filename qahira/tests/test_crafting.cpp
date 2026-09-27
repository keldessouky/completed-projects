// Act I's crafting: the new currencies, Spice Blends, Omens, the Ifrit's Ember, the bench, uniques, and the
// character file that carries all of it (and still reads the older ones).
#include "tests/check.hpp"
#include "game/save.hpp"

using namespace q;

static Item rare(const char* base, Rng& r, int n) {
    Item it = make_item(find_base(base), Rarity::Normal, 20, r);
    it.rarity = Rarity::Rare;
    it.name = "Test Piece";
    while (int(it.affixes.size()) < n && roll_affix(it, r)) {}
    return it;
}

TEST(khamsa_glass_and_the_omens) {
    Rng r(5);
    for (int k = 0; k < 40; k++) {
        Item it = rare("work_coat", r, 3);
        size_t n = it.affixes.size();
        CHECK(apply_currency(CUR_KHAMSA, it, r));
        CHECK(it.affixes.size() == n + 1);
        // the Bird: the next Khamsa adds a suffix (when there is room for one)
        Item b = rare("work_coat", r, 2);
        int pre, suf;
        b.count_affixes(pre, suf);
        uint8_t om = omen_bit(CUR_OMEN_BIRD);
        if (suf < 3) {
            CHECK(apply_currency(CUR_KHAMSA, b, r, nullptr, &om));
            int p2, s2;
            b.count_affixes(p2, s2);
            CHECK(s2 == suf + 1 && p2 == pre && om == 0);
        }
    }
    // Broken Tea Glass takes a mod; under the Closed Door it never takes the bench mod
    for (int k = 0; k < 30; k++) {
        Item it = rare("work_coat", r, 2);
        it.affixes.push_back(Affix{uint16_t(find_affix("cold_res")), 0, 12, 0, AF_CRAFTED});
        uint8_t om = omen_bit(CUR_OMEN_DOOR);
        CHECK(apply_currency(CUR_GLASS, it, r, nullptr, &om));
        CHECK(it.has_crafted() && om == 0);
    }
}

TEST(spice_blends_add_their_family) {
    Rng r(9);
    for (int c = kFirstBlend; c <= kLastBlend; c++) {
        const auto& fam = blend_family(c);
        CHECK(!fam.empty());
        for (int k = 0; k < 20; k++) {
            const char* base = c == CUR_BLEND_HAMMER ? "brass_maul" : c == CUR_BLEND_SCRIBE ? "brass_ring" : "brass_ring";
            Item it = make_item(find_base(base), Rarity::Magic, 20, r);
            size_t n = it.affixes.size();
            std::string why;
            if (!apply_currency(c, it, r, &why)) continue;   // a ring may have no room for the family's side
            CHECK(it.affixes.size() == n + 1);
            CHECK(std::find(fam.begin(), fam.end(), int(it.affixes.back().def)) != fam.end());
            if (n == 2) CHECK(it.rarity == Rarity::Rare);   // a full magic item is made rare to make room
        }
    }
}

TEST(the_ember_corrupts_and_seals) {
    Rng r(13);
    int changed = 0;
    for (int k = 0; k < 200; k++) {
        Item it = rare("riveted_cap", r, 4);
        Item before = it;
        CHECK(apply_currency(CUR_EMBER, it, r));
        CHECK(it.corrupted);
        if (it.affixes.size() != before.affixes.size() || it.affixes[0].v1 != before.affixes[0].v1) changed++;
        std::string why;
        CHECK(!apply_currency(CUR_KHAMSA, it, r, &why) && !why.empty());
        CHECK(!apply_currency(CUR_EMBER, it, r));
    }
    CHECK(changed > 60 && changed < 180);
}

TEST(the_bench_adds_one_exact_mod) {
    Rng r(2);
    Item it = make_item(find_base("work_coat"), Rarity::Magic, 10, r);
    it.affixes.clear();
    it.affixes.push_back(Affix{uint16_t(find_affix("armour_inc")), 0, 20, 0});   // a prefix, so a suffix is free
    int kiln = find_recipe("kiln"), hale = find_recipe("hale");
    std::string why;
    CHECK(apply_recipe(kiln, it, &why));
    CHECK(it.has_crafted() && it.affixes.back().v1 == recipe_affix(kiln).v1);
    CHECK(!apply_recipe(find_recipe("night_wind"), it, &why));   // one bench mod per item
    CHECK(remove_crafted(it, &why) && !it.has_crafted());
    CHECK(!apply_recipe(hale, it, &why));                        // life is a prefix: no room on a magic item
    Item maul = make_item(find_base("worn_maul"), Rarity::Rare, 10, r);
    maul.affixes.clear();
    CHECK(!apply_recipe(kiln, maul, &why));                      // resistances do not go on a weapon
    CHECK(recipe_for_zone("metro", false) == find_recipe("storm"));
}

TEST(uniques_are_whole_and_attar_rerolls_them) {
    Rng r(4);
    CHECK(unique_defs().size() == 20);
    for (int u = 0; u < int(unique_defs().size()); u++) {
        const UniqueDef& d = unique_def(u);
        CHECK(find_base(d.base) != 0 || std::string(d.base) == "worn_maul");
        Item it = make_unique(u, 10, r);
        CHECK(it.rarity == Rarity::Unique && it.unique == u && it.affixes.size() == d.mods.size());
        CHECK(it.display_name() == d.name);
        for (size_t i = 0; i < d.mods.size(); i++) {
            CHECK(find_affix(d.mods[i].affix) >= 0);
            CHECK(it.affixes[i].v1 >= d.mods[i].lo && it.affixes[i].v1 <= d.mods[i].hi);
        }
        Stats s;
        it.add_global_mods(s, 1);   // every mod lands somewhere
        CHECK(apply_currency(CUR_ATTAR, it, r));
        CHECK(it.affixes.size() == d.mods.size());
        CHECK(!apply_currency(CUR_KHAMSA, it, r));
    }
}

TEST(ascendancy_nodes_need_their_parent) {
    const Ascendancy* a = ascendancy_for("warrior");
    CHECK(a && std::string(a->id) == "ironclad" && a->nodes.size() >= 13);
    CHECK(asc_can_take(*a, 0, 1) && !asc_can_take(*a, 0, 2));
    CHECK(asc_can_take(*a, 1u << 1, 2));
    Stats s;
    uint32_t rules = 0;
    asc_apply(*a, (1u << 1) | (1u << 2), s, rules);
    CHECK((rules & KS_ENDURANCE) && s.sum(S_ARMOUR).inc == 15);
    CHECK(ascendancy_for("sorcerer") && asc_spent((1u << 1) | (1u << 2)) == 2);
}

TEST(character_v4_round_trips_act_one) {
    Rng r(8);
    Hero h;
    h.level = 12;
    h.waypoints = 0x5D;
    h.quests = Q_MICROBUS | Q_TRIAL1;
    h.recipes = 0x1F;
    h.codex = 0x3FFF;
    h.asc = 0x6;
    h.omens = omen_bit(CUR_OMEN_FISH);
    h.scraps[3] = 2;
    h.currency[CUR_EMBER] = 3;
    h.sealed = make_unique(find_unique("balcony_voice"), 8, r);
    h.sealed_slot = EQ_AMULET;
    h.weapon() = rare("brass_maul", r, 4);
    h.weapon().corrupted = true;
    h.weapon().affixes.push_back(Affix{uint16_t(find_affix("g_all_res")), 0, 8, 0, AF_IMPLICIT});
    ByteWriter w;
    write_character(w, h);
    Hero b;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, b));
    CHECK(b.waypoints == 0x5D && b.quests == h.quests && b.recipes == 0x1F && b.codex == 0x3FFF && b.asc == 0x6);
    CHECK(b.omens == h.omens && b.scraps[3] == 2 && b.currency[CUR_EMBER] == 3 && b.sealed_slot == EQ_AMULET);
    CHECK(b.sealed.unique == h.sealed.unique && b.sealed.display_name() == "The Singer's Pendant");
    CHECK(b.weapon().corrupted && (b.weapon().affixes.back().flags & AF_IMPLICIT));
    CHECK(b.asc_points() == 0);   // Trial I's two points, both spent
}

TEST(a_version_3_character_still_loads) {
    // hand-written in the Slice 3 layout: no Act I block, items without flags
    ByteWriter w;
    w.put(uint32_t(0x31484351));
    w.put(uint32_t(3));
    w.put(int(9)); w.put(float(50)); w.put(int(40)); w.put(int(77)); w.put(uint8_t(FILTER_STANDARD));
    w.put(uint8_t(7));
    for (int c = 0; c < 7; c++) w.put(int(c));
    w.str("warrior");
    w.put(uint16_t(0));
    w.put(uint8_t(0));                       // no Talismans
    int8_t bar[10] = {-1, -1, -1, -1, -1, -1, -1, -1, -1, -1};
    w.bytes(bar, sizeof bar);
    w.put(uint8_t(0));                       // Wafq
    w.put(uint16_t(0));                      // Blanks
    w.put(uint16_t(0));                      // plan
    w.put(uint8_t(EQ_COUNT));
    for (int e = 0; e < EQ_COUNT; e++) {
        w.put(uint16_t(e == 0 ? find_base("worn_maul") : kNoItem));
        w.put(uint8_t(e == 0 ? 1 : 0)); w.put(uint8_t(5)); w.put(uint32_t(99)); w.str("");
        w.put(uint8_t(e == 0 ? 1 : 0));
        if (e == 0) { w.put(uint16_t(find_affix("phys_inc"))); w.put(uint8_t(0)); w.put(float(20)); w.put(float(0)); }
    }
    w.put(uint16_t(0));
    Hero h;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, h));
    CHECK(h.level == 9 && h.gold == 77 && h.currency[CUR_STYLUS] == 6 && h.currency[CUR_KHAMSA] == 0);
    CHECK(h.weapon().affixes.size() == 1 && h.weapon().affixes[0].v1 == 20 && !h.weapon().corrupted);
    CHECK(h.quests == 0 && h.sealed_slot == -1 && h.weapon().unique == kNoItem);
}
