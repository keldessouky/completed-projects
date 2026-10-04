// The endgame past level 70 (after the first run on the RP6): the Reaches climb to area level 82 and the pinnacles to
// 84-85, affixes have three tiers above their table for the endgame's item levels, every kind of base has a tier at
// 66-80, monsters grow faster past 66, and the levels past 70 are a long road.
#include "tests/check.hpp"
#include "game/acts.hpp"
#include "game/atlas.hpp"
#include "game/items.hpp"
#include "game/world.hpp"
#include "core/math.hpp"
#include <cmath>
#include <set>

using namespace q;

TEST(affixes_have_three_endgame_tiers_above_their_table) {
    const AffixDef& life = affix_defs()[size_t(find_affix("life"))];
    const AffixDef& move = affix_defs()[size_t(find_affix("move"))];
    const AffixDef& fres = affix_defs()[size_t(find_affix("fire_res"))];
    CHECK(affix_tiers(life) == kAffixTiers && affix_tier_level(life, 3) == 36 && affix_tier_level(life, 5) == 78);
    float lo, hi, lo2, hi2, tlo, thi, tlo2, thi2;
    affix_range(life, 2, tlo, thi, tlo2, thi2);
    affix_range(life, 5, lo, hi, lo2, hi2);
    CHECK(tlo == 30 && thi == 44 && lo == 63 && hi == 92);   // the table's best, 2.1 times
    affix_range(move, 5, lo, hi, lo2, hi2);
    CHECK(hi <= 30);                                         // speed grows less (20 at the table's best)
    affix_range(fres, 5, lo, hi, lo2, hi2);
    CHECK(hi >= 44 && hi <= 46);                             // resistances to about PoE's best
    // the bench's and the Spring's tables stay as they are
    CHECK(affix_tiers(affix_defs()[size_t(find_affix("spring"))]) == 3);
    // an item of level 82 rolls the endgame's tiers, one of level 20 never does
    Rng r(7);
    int high = 0, low_high = 0;
    for (int i = 0; i < 300; i++) {
        for (const Affix& a : make_item(find_base("bastion_gauntlets"), Rarity::Rare, 82, r).affixes) high += a.tier >= 3;
        for (const Affix& a : make_item(find_base("riveted_cap"), Rarity::Rare, 20, r).affixes) low_high += a.tier >= 3;
    }
    CHECK(high > 300 && low_high == 0);
}

TEST(every_kind_of_base_has_an_endgame_tier) {
    std::set<int> kinds;
    std::set<std::pair<int, int>> armour;   // slot, defence (1 armour, 2 evasion, 4 Hirz)
    int jewellery = 0;
    for (const ItemBase& b : item_bases()) {
        if (b.level < 66 || b.slot == Slot::Chart) continue;
        if (b.slot == Slot::Weapon) kinds.insert(b.wkind);
        else if (b.slot <= Slot::Boots) armour.insert({int(b.slot), (b.armour > 0) | (b.evasion > 0) << 1 | (b.es > 0) << 2});
        else jewellery++;
    }
    CHECK(kinds.size() == 9 && armour.size() == 24 && jewellery == 4);
    // the 80s are the best of their kind
    for (int k = WK_MAUL; k <= WK_SCEPTRE; k++) {
        float best = 0;
        int best_level = 0;
        for (const ItemBase& b : item_bases())
            if (b.slot == Slot::Weapon && b.wkind == k && b.phys_max > best) { best = b.phys_max; best_level = b.level; }
        CHECK(best_level == 80);
    }
    // the implicits say what they give
    Rng r(3);
    Stats s;
    make_item(find_base("coral_amulet"), Rarity::Normal, 70, r).add_global_mods(s, 1);
    CHECK(s.value(S_FIRE_RES) == 12 && s.value(S_LIGHTNING_RES) == 12);
    Stats t;
    make_item(find_base("long_road_staff"), Rarity::Normal, 80, r).add_global_mods(t, 1);
    CHECK(t.value(S_STR) == 18 && t.value(S_INT) == 18);
    // and they drop where the Reaches are
    int found = 0;
    for (int i = 0; i < 2000; i++) found += random_drop(82, 0.3f, 0.4f, r).b().level >= 66;
    CHECK(found > 300);
}

TEST(the_reaches_and_pinnacles_climb_past_the_campaign) {
    CHECK(chart_area_level(16) == 82);
    for (const char* z : {"king_throne", "falak_lair", "subyan_house"}) CHECK(zone_def(find_zone(z)).level >= 84);
    // monsters grow as they did through the campaign, and faster past 66
    CHECK(std::abs(monster_life_k(56) - (1 + 0.14f * 55)) < 1e-4f && std::abs(monster_damage_k(66) - (1 + 0.12f * 65)) < 1e-4f);
    CHECK(monster_life_k(82) > 1.05f * (1 + 0.14f * 81) && monster_damage_k(82) > 1.05f * (1 + 0.12f * 81));
    CHECK(monster_life_k(84) < 1.4f * monster_life_k(68));   // the throne at 84 a third harder than at its old 68, not double
}

TEST(the_levels_past_seventy_are_the_long_road) {
    CHECK(std::abs(level_xp_need(50) - 90.f * std::pow(50.f, 1.55f)) < 1.f);   // as it was to 69
    CHECK(level_xp_need(90) > 6.f * 90.f * std::pow(90.f, 1.55f));
    CHECK(xp_allowance(50) == 2 && xp_allowance(82) == 9);                       // a level-91 hero still learns at 82
}
