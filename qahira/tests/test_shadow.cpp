// Slice 8: the Shadow (daggers and a quarterstaff on the back, traps, Wither, Power Charges, critical poison), its sky and
// keystone, and its two ascendancies.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/classes.hpp"
#include "game/save.hpp"
#include <cstdio>

using namespace q;

TEST(the_shadow_carries_a_dagger_and_a_quarterstaff_on_its_back) {
    CHECK(load_generated_tree());
    const ClassDef& c = class_def("shadow");
    CHECK(std::string(c.id) == "shadow" && c.playable && c.weapon2);
    World w;
    w.reset_hero("shadow");
    CHECK(w.hero.weapon().b().wkind == WK_DAGGER && w.hero.equip[EQ_WEAPON2].b().wkind == WK_QSTAFF);
    SkillCtx kiss = w.slot_ctx(0), spin = w.slot_ctx(3);
    CHECK(kiss.def && std::string(kiss.def->id) == "viper_kiss" && kiss.usable);
    CHECK(spin.def && std::string(spin.def->id) == "whirling_staff" && !spin.usable && spin.needs_weapon);
    w.actors[0].mana = w.actors[0].mana_max;
    w.start_skill(3, {0, 1});
    CHECK(w.hero.weapon().b().wkind == WK_QSTAFF && w.hero.equip[EQ_WEAPON2].b().wkind == WK_DAGGER);
    // a dagger found goes in hand, a quarterstaff on the back
    Rng r(5);
    w.actors[0].act = Act::Idle;
    w.start_skill(0, {0, 1});
    CHECK(w.hero.weapon().b().wkind == WK_DAGGER);
    CHECK(equip_slot_for(make_item(find_base("ash_staff"), Rarity::Normal, 1, r), w.hero.equip) == EQ_WEAPON2);
}

TEST(a_trap_lands_arms_and_bursts_when_an_enemy_comes_near) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("shadow");
    w.actors[0].mana = w.actors[0].mana_max;
    w.actors[0].target = {0, 6};
    w.actors[0].skill = 1;
    w.actors[0].facing = kPi / 2;
    w.resolve_skill(w.actors[0]);
    int traps = 0;
    for (auto& g : w.ground) traps += g.kind == GroundFx::Trap;
    CHECK(traps == 1);
    Input none{};
    for (int k = 0; k < 60; k++) w.step(none, 1.f / 60.f);   // it lands, arms, and waits
    w.spawn_monster(find_monster("ghoul"), {0, 12}, Rarity::Normal, 5);
    Actor& m = w.actors.back();
    m.life = m.life_max = 1e4f;
    m.pos = {0, 6.5f};
    const float before = m.life;
    w.step(none, 1.f / 60.f);
    CHECK(m.life < before);
    bool spent = true;
    for (auto& g : w.ground) if (g.kind == GroundFx::Trap && g.t < g.life) spent = false;
    CHECK(spent);
    // no more than trap_max out at once: the oldest goes
    for (int k = 0; k < w.trap_max() + 2; k++) { w.actors[0].target = {float(k) * 3.f, -8}; w.resolve_skill(w.actors[0]); }
    int out = 0;
    for (auto& g : w.ground) out += g.kind == GroundFx::Trap && g.t < g.life;
    CHECK(out == w.trap_max());
}

TEST(black_sand_withers_and_withered_enemies_take_more_chaos_and_poison) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("shadow");
    w.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
    size_t mi = w.actors.size() - 1;
    w.actors[mi].life = w.actors[mi].life_max = 1e4f;
    HeroHit hh;
    hh.hit.min[DT_CHAOS] = hh.hit.max[DT_CHAOS] = 10;
    hh.talisman = 2;   // Black Sand
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    CHECK(w.actors[mi].wither == 1 && w.actors[mi].wither_t > 3.9f);
    for (int k = 0; k < 20; k++) w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    CHECK(w.actors[mi].wither == 10);   // it stacks ten times
    Actor& m = w.actors[mi];
    const float before = m.life;
    w.hit_enemy(m, hh, {0, 0}, 0);
    CHECK(std::fabs((before - m.life) - 10.f * 1.6f) < 0.5f);   // 60% more chaos damage taken at ten stacks
    // a poison ticks harder on a withered enemy
    m.poison[0] = 10.f;
    m.poison_t[0] = 2.f;
    const float l0 = m.life;
    for (int k = 0; k < 30; k++) w.ailments_step(m, 1.f / 60.f);
    CHECK((l0 - m.life) > 10.f * 0.5f * 1.5f);
    // it fades
    for (int k = 0; k < 60 * 6; k++) w.ailments_step(m, 1.f / 60.f);
    CHECK(m.wither == 0);
}

TEST(quarterstaff_crits_grant_power_charges_and_power_raises_crit_chance) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("shadow");
    w.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
    size_t mi = w.actors.size() - 1;
    w.actors[mi].life = w.actors[mi].life_max = 1e6f;
    HeroHit hh;
    hh.hit.min[DT_PHYS] = hh.hit.max[DT_PHYS] = 5;
    hh.hit.crit_chance = 1.f;
    hh.talisman = 3;   // Whirling Staff
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    CHECK(w.hero.power == 1);
    for (int k = 0; k < 10; k++) w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    CHECK(w.hero.power == w.power_max() && w.power_max() == 3);
    // a dagger's crits always poison
    hh.talisman = 0;
    w.actors[mi].armour = 0;
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    bool poisoned = false;
    for (float t : w.actors[mi].poison_t) poisoned = poisoned || t > 0;
    CHECK(poisoned);
}

TEST(al_sharatan_trades_hit_damage_for_critical_poison) {
    CHECK(load_generated_tree());
    const PassiveTree& T = tree();
    int agony = -1;
    for (auto& st : T.stars) if (st.keystone == KS_AGONY) agony = st.id;
    CHECK(agony >= 0);
    CHECK(T.class_start("shadow") >= 0 && T.recommended_for("shadow") && !T.recommended_for("shadow")->empty());
    auto hit_once = [&](bool keystone, float& hit, float& poison) {
        World w;
        w.reset_hero("shadow");
        if (keystone) { w.hero.passives.taken[size_t(agony)] = 1; w.recompute_hero(); }
        w.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
        Actor& m = w.actors.back();
        m.life = m.life_max = 1e6f;
        m.armour = 0;
        HeroHit hh;
        hh.hit.min[DT_PHYS] = hh.hit.max[DT_PHYS] = 100;
        hh.hit.crit_chance = 1.f;
        hh.hit.crit_multi = 2.f;
        hh.talisman = 0;
        hit = w.hit_enemy(m, hh, {0, 0}, 0);
        poison = 0;
        for (float p : m.poison) poison += p;
    };
    float h0, p0, h1, p1;
    hit_once(false, h0, p0);
    hit_once(true, h1, p1);
    CHECK(std::fabs(h1 / h0 - 0.7f) < 0.01f);
    CHECK(p1 / p0 > 1.3f);   // 0.7 x 2
}

TEST(the_nightblade_and_the_mystic) {
    CHECK(load_generated_tree());
    auto two = ascendancies_of("shadow");
    CHECK(two.size() == 2);
    const Ascendancy* nb = ascendancy_of("shadow", find_ascendancy("nightblade"));
    const Ascendancy* my = ascendancy_of("shadow", find_ascendancy("mystic"));
    CHECK(nb && my && nb->nodes.size() == 13 && my->nodes.size() == 13);
    CHECK(uint64_t(KS_LOW_CRIT) == (1ull << 32) && uint64_t(KS_VEIL) == (1ull << 36));
    Stats s;
    uint64_t rules = 0;
    asc_apply(*nb, (1u << 1) | (1u << 2) | (1u << 7) | (1u << 8), s, rules);
    CHECK((rules & KS_LOW_CRIT) && s.sum(S_POWER).flat == 1);
    // Unseen Blade: every hit on a wounded enemy is a crit
    World w;
    w.reset_hero("shadow");
    w.hero.ascendancy = int8_t(find_ascendancy("nightblade"));
    w.hero.asc = (1u << 1) | (1u << 2) | (1u << 5) | (1u << 6);
    w.recompute_hero();
    CHECK((w.hero.keystones & KS_LOW_CRIT) && (w.hero.keystones & KS_POWER_KILL));
    w.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
    Actor& m = w.actors.back();
    m.life_max = 1e6f;
    m.life = 1e5f;
    HeroHit hh;
    hh.hit.min[DT_PHYS] = hh.hit.max[DT_PHYS] = 5;
    hh.hit.crit_chance = 0.f;
    hh.talisman = 0;
    int before = w.hero.power;
    m.life = 3.f;   // and a crit that kills gives a Power Charge
    w.hit_enemy(m, hh, {0, 0}, 0);
    CHECK(!m.alive() && w.hero.power == before + 1);
    // the Mystic: a quarterstaff's hits gain lightning and cold for each Power Charge
    World v;
    v.reset_hero("shadow");
    v.hero.ascendancy = int8_t(find_ascendancy("mystic"));
    v.hero.asc = (1u << 1) | (1u << 2) | (1u << 5) | (1u << 6);
    v.recompute_hero();
    CHECK((v.hero.keystones & KS_STAFF_STORM) && (v.hero.keystones & KS_CHARGE_COLD));
    v.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
    Actor& n = v.actors.back();
    n.life = n.life_max = 1e6f;
    n.armour = 0;
    HeroHit st;
    st.hit.min[DT_PHYS] = st.hit.max[DT_PHYS] = 100;
    st.hit.crit_chance = 0.f;
    st.talisman = 3;   // Whirling Staff
    const float bare = v.hit_enemy(n, st, {0, 0}, 0);
    v.hero.power = 2;
    const float charged = v.hit_enemy(n, st, {0, 0}, 0);
    CHECK(charged > bare * 1.2f && n.chill_t > 0);   // 16% as lightning and 16% as cold (less the ghoul's resistances), and a chill
}

TEST(a_save_state_v11_keeps_power_and_wither) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("shadow");
    w.hero.power = 2;
    w.hero.power_t = 5.f;
    w.spawn_monster(find_monster("ghoul"), {0, 2}, Rarity::Normal, 5);
    w.actors.back().wither = 7;
    w.actors.back().wither_t = 3.f;
    ByteWriter bw;
    write_world(bw, w);
    World b;
    ByteReader br(bw.buf.data(), bw.buf.size());
    CHECK(read_world(br, b));
    CHECK(b.hero.power == 2 && b.actors.back().wither == 7);
}
