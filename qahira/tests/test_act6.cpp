// Slice 10: Act VI across the Red Sea to the heart of totality, the choice after Apep, and the codex kept in order.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/acts.hpp"
#include "game/crafting.hpp"
#include "game/items.hpp"
#include "game/skills.hpp"
#include "game/save.hpp"
#include "game/zone.hpp"

using namespace q;

TEST(act_six_runs_from_jeddah_to_the_heart_of_totality) {
    const char* road[] = {"balad", "harbour", "shibam", "wabar", "iram", "totality"};
    const size_t n = sizeof road / sizeof *road;
    int last = 55;
    for (size_t i = 0; i < n; i++) {
        int z = find_zone(road[i]);
        CHECK(z >= 0 && z < 128);   // a waypoint bit
        const ZoneDef& d = zone_def(z);
        CHECK(d.act == 6 && d.level >= last && d.level <= 68);
        last = d.level;
        if (*d.boss) CHECK(boss_def(find_monster(d.boss)) != nullptr);
        for (auto& s : d.spawns) if (s.monster) CHECK(std::string(monster_defs()[size_t(find_monster(s.monster))].id) == s.monster);
    }
    CHECK(std::string(zone_def(find_zone("strait")).next) == "balad");   // Act V leads on to it
    CHECK(std::string(zone_def(find_zone("harbour")).boss) == "umm_duwais");
    CHECK(std::string(zone_def(find_zone("wabar")).boss) == "al_hatif");
    CHECK(std::string(zone_def(find_zone("iram")).boss) == "brass_horseman");
    for (const char* rigid : {"brass_horseman", "apep", "brass_guard"}) CHECK(monster_defs()[size_t(find_monster(rigid))].rigid);
    // after Apep every resistance is 60% lower, and the act gives two stars
    CHECK(act_res_penalty(Q_ACT3 | Q_ACT6) == 60);
    CHECK(act_res_penalty(Q_ACT3 | Q_ACT5) == 30);
    CHECK(quest_passive_points(Q_ACT6) == 2);
}

TEST(the_choice_after_apep_is_kept_and_sealing_gives_two_stars) {
    Hero h;
    h.level = 10;
    int open = h.passive_points();
    h.ending = 1;
    CHECK(h.passive_points() == open + 2);
    h.ending = 2;
    CHECK(h.passive_points() == open);
    ByteWriter w;
    write_character(w, h);
    Hero r;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, r));
    CHECK(r.ending == 2);
}

// characters store codex entries as bits by index: the table only ever grows at the end
TEST(the_codex_is_append_only) {
    const char* order[] = {"ghouls", "possessed", "silah", "nasnas", "qutrub", "ifrit", "waypoints", "trial", "bench",
                           "blends", "omens", "ember", "posters", "ascendancy", "charts", "haboob", "astrolabe",
                           "sand_jinn", "marid", "naddaha", "statues", "tomb_ghouls", "marks", "rifts", "evasion",
                           "bleeding", "hyenas", "salt_jinn", "desert_ghouls", "wraith", "mamluk", "res_penalty",
                           "excavations", "traps", "salt_ghouls", "mirage", "zar", "iron_door", "auras", "dye_ghouls",
                           "smoke", "presser", "qandisha", "reaches", "marid_king", "coral_ghouls", "duwais", "shiqq",
                           "hatif", "brass", "apep", "veil"};
    const size_t n = sizeof order / sizeof *order;
    auto& c = codex_entries();
    CHECK(c.size() >= n && c.size() <= 64);   // they fit in Hero::codex
    for (size_t i = 0; i < n; i++) CHECK(std::string(c[i].id) == order[i]);
    // every family's codex key names an entry
    for (auto& m : monster_defs()) if (*m.codex) CHECK(find_codex(m.codex) >= 0);
}

// past Act V the hero keeps growing: every weapon kind has a base near 56, every kind of armour one past 40 and
// gloves and boots at 50, and Blank Talismans climb past 20 in the last areas
TEST(bases_and_talismans_keep_growing_past_act_five) {
    for (int wk = WK_MAUL; wk <= WK_SCEPTRE; wk++) {
        int top = 0;
        for (auto& b : item_bases()) if (b.slot == Slot::Weapon && b.wkind == wk) top = std::max(top, b.level);
        CHECK(top >= 56);
    }
    // the six kinds of defence: armour, evasion, Hirz, and each pair
    auto kind = [](const ItemBase& b) { return (b.armour > 0 ? 1 : 0) | (b.evasion > 0 ? 2 : 0) | (b.es > 0 ? 4 : 0); };
    for (int k : {1, 2, 4, 3, 6, 5})
        for (Slot s : {Slot::Helmet, Slot::Body, Slot::Gloves, Slot::Boots}) {
            int top = 0;
            for (auto& b : item_bases()) if (b.slot == s && kind(b) == k) top = std::max(top, b.level);
            CHECK(top >= (s == Slot::Helmet || s == Slot::Body ? 38 : 50));
        }
    CHECK(blank_cap(20) == 20 && blank_cap(44) == 20 && blank_cap(56) == 23 && blank_cap(68) == 25);
    // an area past Act V mostly drops the newer bases
    Rng rng(11);
    int late = 0;
    for (int i = 0; i < 400; i++) if (random_drop(64, 0.1f, 0.3f, rng, Slot::Count).b().level >= 44) late++;
    CHECK(late > 400 / 3);
}

// the Fourth Trial: a side zone of Iram that opens after the campaign; the hero chooses the toll; eight points in all
TEST(the_gate_of_iram_is_the_fourth_trial_and_you_choose_the_toll) {
    int g = find_zone("gate_iram");
    CHECK(g >= 0 && g < 128);
    const ZoneDef& d = zone_def(g);
    CHECK(d.trial && d.toll_slot == kTollChosen && d.act == 6 && d.level == 68);
    CHECK(std::string(zone_def(find_zone("iram")).side) == "gate_iram");
    CHECK(std::string(d.boss) == "iram_keeper" && boss_def(find_monster("iram_keeper")) != nullptr);
    CHECK(quest_asc_points(Q_TRIAL1 | Q_TRIAL2 | Q_TRIAL3 | Q_TRIAL4) == 8);
    CHECK(quest_passive_points(Q_TRIAL4) == 0);
}
