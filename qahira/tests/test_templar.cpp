// Slice 9: the Templar (maces and sceptres, fire converted from the blow, the Beacon, a signal brazier, burning ground,
// Block), his keystone, and the Zealot and the Warden.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/classes.hpp"
#include "game/save.hpp"
#include <cstdio>

using namespace q;

TEST(the_templar_carries_a_lantern_sceptre_and_strikes_with_fire) {
    CHECK(load_generated_tree());
    const ClassDef& c = class_def("templar");
    CHECK(std::string(c.id) == "templar" && c.playable);
    World w;
    w.reset_hero("templar");
    CHECK(w.hero.weapon().b().wkind == WK_SCEPTRE && (w.hero.weapon().weapon().tags & T_MACE));
    CHECK(w.hero.talismans.size() == 4);
    // the sceptre's implicit: increased elemental damage
    CHECK(w.hero.stats.sum(S_DAMAGE, T_ELEMENTAL).inc >= 12.f);
    // Ember Strike: 60% of the blow is fire
    SkillCtx s = w.slot_ctx(0);
    CHECK(s.def && std::string(s.def->id) == "ember_strike" && s.usable);
    CHECK(s.hit.min[DT_FIRE] > s.hit.min[DT_PHYS]);
    Rng r(4);
    Item mace = make_item(find_base("flanged_mace"), Rarity::Normal, 12, r);
    int gw = 0, gh = 0;
    grid_size(mace, gw, gh);
    CHECK(gw == 1 && gh == 3 && mace.weapon().tags == T_MACE);
}

TEST(the_beacon_is_held_up_and_put_away) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("templar");
    const float mana = w.actors[0].mana_max;
    const float res = summarize(w.hero).res[DT_COLD];
    w.actors[0].skill = 1;
    w.resolve_skill(w.actors[0]);
    CHECK(w.hero.aura);
    CHECK(std::fabs(w.actors[0].mana_max - std::round(mana * 0.75f)) <= 1.f);
    CHECK(summarize(w.hero).res[DT_COLD] > res + 11.f);
    w.resolve_skill(w.actors[0]);
    CHECK(!w.hero.aura && std::fabs(w.actors[0].mana_max - mana) <= 1.f);
}

TEST(a_signal_brazier_throws_fire_and_burning_ground_burns) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("templar");
    w.actors[0].target = {0, 4};
    w.actors[0].skill = 2;   // Signal Fire
    w.resolve_skill(w.actors[0]);
    w.resolve_skill(w.actors[0]);
    int totems = 0;
    for (auto& g : w.ground) totems += g.kind == GroundFx::Totem && g.t < g.life;
    CHECK(totems == 1);   // one at a time: the second puts the first out
    w.spawn_monster(find_monster("ghoul"), {0, 9}, Rarity::Normal, 5);
    w.actors.back().life = w.actors.back().life_max = 1e4f;
    const size_t shots = w.projectiles.size();
    Input none{};
    for (int k = 0; k < 40; k++) w.step(none, 1.f / 60.f);
    CHECK(w.projectiles.size() > shots || w.actors.back().life < 1e4f);
    // Brazier Slam: the ground where it lands burns what stands on it, and mends the hero on it
    World v;
    v.reset_hero("templar");
    v.spawn_monster(find_monster("ghoul"), {0, 1.8f}, Rarity::Normal, 5);
    Actor& m = v.actors.back();
    m.life = m.life_max = 1e4f;
    m.speed = 0;
    v.actors[0].facing = kPi / 2;
    v.actors[0].skill = 3;
    v.resolve_skill(v.actors[0]);
    bool embers = false;
    for (auto& g : v.ground) embers = embers || g.kind == GroundFx::Embers;
    CHECK(embers);
    const float after_slam = m.life;
    v.actors[0].life = v.actors[0].life_max * 0.5f;
    v.actors[0].pos = {0, 1.2f};
    for (int k = 0; k < 90; k++) v.step(none, 1.f / 60.f);
    CHECK(m.life < after_slam);
    CHECK(v.actors[0].life > v.actors[0].life_max * 0.5f);
}

TEST(block_turns_a_hit_aside_whole) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("templar");
    w.hero.base.add(S_BLOCK, MK_FLAT, 200);   // (capped at 75%: most hits are blocked)
    w.recompute_hero();
    const float full = w.actors[0].life;
    int blocked = 0;
    for (int k = 0; k < 40; k++) {
        const float before = w.actors[0].life;
        w.damage_hero(10, 10, DT_PHYS, {0, 1}, 0, 0, true);
        blocked += w.actors[0].life >= before;
        w.actors[0].life = full;
        w.hero.es = 0;
    }
    CHECK(blocked > 20 && blocked < 40);
}

TEST(al_iklil_and_the_zealot_and_the_warden) {
    CHECK(load_generated_tree());
    const PassiveTree& T = tree();
    int crown = -1;
    for (auto& st : T.stars) if (st.keystone == KS_ALL_FIRE) crown = st.id;
    CHECK(crown >= 0);
    CHECK(T.class_start("templar") >= 0 && T.recommended_for("templar") && !T.recommended_for("templar")->empty());
    // al-Iklil: every kind of damage is fire, and 15% less of it
    World w;
    w.reset_hero("templar");
    w.hero.passives.taken[size_t(crown)] = 1;
    w.recompute_hero();
    CHECK(w.hero.keystones & KS_ALL_FIRE);
    // the two ascendancies and their rules
    auto two = ascendancies_of("templar");
    CHECK(two.size() == 2);
    const Ascendancy* ze = ascendancy_of("templar", find_ascendancy("zealot"));
    const Ascendancy* wa = ascendancy_of("templar", find_ascendancy("warden"));
    CHECK(ze && wa && ze->nodes.size() == 13 && wa->nodes.size() == 13);
    CHECK(uint64_t(KS_EMBER_FIRE) == (1ull << 37) && uint64_t(KS_AURA_FREE) == (1ull << 40));
    // A Lamp Without Cost: the Beacon reserves nothing
    World v;
    v.reset_hero("templar");
    v.hero.ascendancy = int8_t(find_ascendancy("warden"));
    v.hero.asc = (1u << 1) | (1u << 2) | (1u << 3) | (1u << 4);
    v.recompute_hero();
    CHECK((v.hero.keystones & KS_AURA_FREE) && (v.hero.keystones & KS_BLOCK_RECOVER));
    const float mana = v.actors[0].mana_max;
    v.actors[0].skill = 1;
    v.resolve_skill(v.actors[0]);
    CHECK(v.hero.aura && v.actors[0].mana_max == mana);
    // and a save state keeps it held up
    ByteWriter bw;
    write_world(bw, v);
    World b;
    ByteReader br(bw.buf.data(), bw.buf.size());
    CHECK(read_world(br, b));
    CHECK(b.hero.aura);
}
