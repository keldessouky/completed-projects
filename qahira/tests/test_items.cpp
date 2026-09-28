// Items and belongings: the inventory grid and the crafting currencies' PoE rules.
#include "tests/check.hpp"
#include "game/inventory.hpp"

using namespace q;

static Item base_item(const char* id, Rarity r = Rarity::Normal, int ilvl = 10) {
    Rng rng(42);
    return make_item(find_base(id), r, ilvl, rng);
}

TEST(inventory_fills_columns_first_and_respects_sizes) {
    Inventory inv;
    // a maul is 2x4: six of them fill columns 0-11 of rows 0-3, leaving row 4 free
    for (int i = 0; i < 6; i++) CHECK(inv.add(base_item("worn_maul")));
    CHECK(inv.items[1].x == 2 && inv.items[1].y == 0);
    CHECK(!inv.add(base_item("worn_maul")));               // no 2x4 space left
    CHECK(!inv.add(base_item("work_coat")));               // nor 2x3
    CHECK(inv.add(base_item("tooled_belt")));              // 2x1 fits in the bottom row
    CHECK(inv.items.back().y == 4 && inv.items.back().x == 0);
    for (int i = 0; i < 10; i++) CHECK(inv.add(base_item("brass_ring")));
    CHECK(!inv.add(base_item("brass_ring")));              // 60 cells used exactly
    CHECK(inv.at(1, 3) == 0 && inv.at(0, 4) == 6 && inv.at(11, 4) >= 0);
    Item t = inv.take(0);
    CHECK(!t.empty() && inv.fits(0, 0, 2, 4));
    CHECK(inv.place(t, 0, 0) && !inv.fits(1, 1, 1, 1));
}

TEST(currency_follows_poe_rules) {
    Rng rng(7);
    Item it = base_item("worn_maul", Rarity::Normal, 20);
    std::string why;
    CHECK(!apply_currency(CUR_SALT, it, rng, &why) && !why.empty());   // augment needs magic
    CHECK(apply_currency(CUR_BEAD, it, rng));                          // transmute
    CHECK(it.rarity == Rarity::Magic && it.affixes.size() >= 1 && it.affixes.size() <= 2);
    CHECK(!apply_currency(CUR_BEAD, it, rng));
    if (it.affixes.size() == 1) { CHECK(apply_currency(CUR_SALT, it, rng)); CHECK(it.affixes.size() == 2); }
    CHECK(!apply_currency(CUR_SALT, it, rng));                         // no room for a third
    for (int i = 0; i < 20; i++) {                                     // alteration keeps it magic, 1-2 mods
        CHECK(apply_currency(CUR_GROUNDS, it, rng));
        CHECK(it.rarity == Rarity::Magic && !it.affixes.empty() && it.affixes.size() <= 2);
    }
    size_t before = it.affixes.size();
    CHECK(apply_currency(CUR_PIASTRE, it, rng));                       // regal: magic -> rare, +1 mod
    CHECK(it.rarity == Rarity::Rare && it.affixes.size() == before + 1 && !it.name.empty());
    Item n = base_item("work_coat", Rarity::Normal, 20);
    CHECK(apply_currency(CUR_SAFFRON, n, rng));                        // alchemy: 4-6 mods
    CHECK(n.rarity == Rarity::Rare && n.affixes.size() >= 4 && n.affixes.size() <= 6);
    int pre = 0, suf = 0;
    for (auto& a : n.affixes) (affix_defs()[a.def].prefix ? pre : suf)++;
    CHECK(pre <= 3 && suf <= 3);
}
