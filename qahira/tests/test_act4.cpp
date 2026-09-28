// Slice 8: Act IV along the Maghreb coast to the Ghula of the Salt, and the Zar Nights.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "core/pack.hpp"
#include "game/areas.hpp"
#include "game/atlas.hpp"
#include "game/save.hpp"
#include "game/zone.hpp"
#include <cstdio>

using namespace q;

TEST(act_four_runs_from_ghadames_to_the_sebkha) {
    const char* road[] = {"ghadames", "chott", "tozeur", "medina", "souq", "sebkha"};
    int last = 35;
    for (size_t i = 0; i < 6; i++) {
        int z = find_zone(road[i]);
        CHECK(z >= 0 && z < 64);   // a waypoint bit
        const ZoneDef& d = zone_def(z);
        CHECK(d.act == 4 && d.level > last && d.level <= 46);
        last = d.level;
        if (i + 1 < 6) CHECK(std::string(d.next) == road[i + 1]);
        if (*d.boss) CHECK(boss_def(find_monster(d.boss)) != nullptr);
        for (auto& s : d.spawns) if (s.monster) CHECK(std::string(monster_defs()[size_t(find_monster(s.monster))].id) == s.monster);
    }
    CHECK(std::string(zone_def(find_zone("oracle")).next) == "ghadames");   // Act III leads on to it
    CHECK(std::string(zone_def(find_zone("sebkha")).boss) == "ghula_salt");
    CHECK(monster_defs()[size_t(find_monster("iron_door"))].rigid);   // a possessed door: one static mesh
    CHECK(quest_passive_points(Q_SARAB | Q_DOOR | Q_SALT) == 3);
    CHECK(act_res_penalty(Q_ACT3 | Q_ACT4) == 30);
}

namespace {
bool open_pack() {
    static int state = -1;
    if (state < 0) state = pack().open_file((std::string(QAHIRA_SOURCE_DIR) + "/build/Qahira.qpk").c_str()) ? 1 : 0;
    if (state != 1) std::printf("  (skipped: no build/Qahira.qpk)\n");
    return state == 1;
}

// a chart's level with a Zar Night armed in it
bool zar_world(World& w, Areas& a, uint32_t seed) {
    const ZoneDef& zd = zone_def(find_zone("site_iskandariya"));
    a.zone.def = find_zone("site_iskandariya");
    a.zone.layout = generate_zone(seed * 2654435761u, zd.w, zd.h, zd.branches);
    build_zone_level(a.zone.layout, zd.tileset, w.level);
    w.actors.resize(1);
    w.in_chart = true;
    w.area_level = 20;
    return a.arm_zar(w);
}
}  // namespace

TEST(a_zar_night_fills_with_the_dead_and_pays_its_trances) {
    if (!open_pack()) return;
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("warrior");
    Areas a;
    CHECK(zar_world(w, a, 3));
    Zar& z = w.zar;
    CHECK(z.armed && !z.started);
    int drum = -1;
    for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Drum) drum = int(i);
    CHECK(drum >= 0);
    w.zar_use(drum);
    CHECK(z.started && std::fabs(z.rhythm - Zar::kStart) < 1e-3f);
    // it runs down on its own
    Input none{};
    w.actors[0].life = w.actors[0].life_max = 1e6f;
    for (int k = 0; k < 120; k++) w.step(none, 1.f / 60.f);   // (the first wave comes after a second and a half)
    CHECK(z.rhythm < Zar::kStart && z.waves >= 1);
    // what comes to the drums comes from where they can be seen
    for (size_t i = 1; i < w.actors.size(); i++) CHECK(w.level.line_clear(z.pos, w.actors[i].pos, 0.3f) || length(w.actors[i].pos - z.pos) < 13.f);
    // deaths inside the circle feed it; a full rhythm is a trance, and it pays
    const size_t coin = w.loot.size();
    for (int k = 0; k < 10; k++) {
        Actor& m = w.spawn_monster(find_monster("ghoul"), w.level.resolve(z.pos + vec2{2.f, 0}, 0.5f), Rarity::Normal, 20);
        w.kill(m);
    }
    CHECK(z.kills >= 10);
    w.step(none, 1.f / 60.f);
    CHECK(z.trances == 1 && z.rhythm < 100.f && w.loot.size() > coin);
    // a save state keeps the night
    ByteWriter bw;
    write_world(bw, w);
    World b;
    ByteReader br(bw.buf.data(), bw.buf.size());
    CHECK(read_world(br, b));
    CHECK(b.zar.started && b.zar.trances == 1 && b.zar.kills == z.kills);
    // the song ends: an item for the trance and one for the song
    const size_t before = w.loot.size();
    z.t = Zar::kSong;
    w.step(none, 1.f / 60.f);
    CHECK(z.over);
    int items = 0;
    for (size_t i = before; i < w.loot.size(); i++) items += w.loot[i].kind == GroundItem::Gear;
    CHECK(items == 2);
}

TEST(a_zar_night_ends_when_the_rhythm_fails) {
    if (!open_pack()) return;
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("warrior");
    Areas a;
    CHECK(zar_world(w, a, 5));
    for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Drum) w.zar_use(int(i));
    w.zar.rhythm = 0.5f;
    w.zar_step(1.f);
    CHECK(w.zar.over && w.zar.trances == 0);
    int items = 0;
    for (auto& g : w.loot) items += g.kind == GroundItem::Gear;
    CHECK(items == 0);   // nothing earned
}

TEST(zar_nights_come_after_act_four_only) {
    if (!open_pack()) return;
    int armed_before = 0, armed_after = 0;
    for (int k = 0; k < 20; k++) {
        for (int after = 0; after < 2; after++) {
            World w;
            w.reset_hero("warrior");
            w.hero.quests = after ? Q_ACT4 : Q_ACT3;
            w.rng = Rng(uint64_t(k) * 7 + 1);
            Areas a;
            Rng r(uint64_t(k) + 11);
            a.enter_chart(w, 0, make_chart(1, r));
            (after ? armed_after : armed_before) += w.zar.armed;
        }
    }
    CHECK(armed_before == 0 && armed_after > 2 && armed_after < 16);
}

TEST(act_five_runs_from_fes_to_the_strait_with_trial_three) {
    const char* road[] = {"fes", "fes_bali", "chaouen", "jemaa", "tangier", "strait"};
    int last = 45;
    for (size_t i = 0; i < 6; i++) {
        int z = find_zone(road[i]);
        CHECK(z >= 0 && z < 64);
        const ZoneDef& d = zone_def(z);
        CHECK(d.act == 5 && d.level > last && d.level <= 56);
        last = d.level;
        if (i + 1 < 6) CHECK(std::string(d.next) == road[i + 1]);
        if (*d.boss) CHECK(boss_def(find_monster(d.boss)) != nullptr);
        for (auto& s : d.spawns) if (s.monster) CHECK(std::string(monster_defs()[size_t(find_monster(s.monster))].id) == s.monster);
    }
    CHECK(std::string(zone_def(find_zone("sebkha")).next) == "fes");   // Act IV leads on to it
    const ZoneDef& trial = zone_def(find_zone("bab_nasr"));
    CHECK(trial.trial && trial.toll_slot == EQ_GLOVES && std::string(zone_def(find_zone("jemaa")).side) == "bab_nasr");
    CHECK(std::string(zone_def(find_zone("strait")).boss) == "qandisha");
    CHECK(quest_asc_points(Q_TRIAL1 | Q_TRIAL2 | Q_TRIAL3) == 6 && quest_passive_points(Q_PRESSER | Q_SMOKE | Q_QANDISHA) == 3);
}
