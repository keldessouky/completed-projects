// Slice 10: Act VI across the Red Sea to the heart of totality, the choice after Apep, and the codex kept in order.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/acts.hpp"
#include "game/crafting.hpp"
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
