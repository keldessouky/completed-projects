// Golden tests for the modifier engine and the damage pipeline.
#include "tests/check.hpp"
#include "game/stats.hpp"

using namespace q;

TEST(increased_is_additive_more_is_multiplicative) {
    Stats s;
    s.add(S_DAMAGE, MK_INC, 20);
    s.add(S_DAMAGE, MK_INC, 30);
    s.add(S_DAMAGE, MK_MORE, 50);
    s.add(S_DAMAGE, MK_MORE, 20);
    // (1 + 0.5) * 1.5 * 1.2 = 2.7
    CHECK_NEAR(s.value(S_DAMAGE, 1.f), 2.7f, 1e-4f);
}

TEST(tags_gate_modifiers) {
    Stats s;
    s.add(S_DAMAGE, MK_INC, 40, T_SLAM);
    s.add(S_DAMAGE, MK_INC, 10, T_PHYSICAL);
    s.add(S_DAMAGE, MK_INC, 25, T_SPELL);
    CHECK_NEAR(s.sum(S_DAMAGE, T_ATTACK | T_SLAM | T_PHYSICAL).inc, 50.f, 1e-4f);
    CHECK_NEAR(s.sum(S_DAMAGE, T_ATTACK | T_STRIKE | T_PHYSICAL).inc, 10.f, 1e-4f);
    CHECK_NEAR(s.sum(S_DAMAGE, T_SPELL | T_FIRE).inc, 25.f, 1e-4f);
}

TEST(attack_pipeline_golden) {
    Stats s;
    s.add(S_DAMAGE, MK_INC, 50, T_PHYSICAL);
    s.add(S_DAMAGE, MK_MORE, 20, T_SLAM);
    s.add(S_ADDED_MIN, MK_FLAT, 4, T_ATTACK | T_FIRE);
    s.add(S_ADDED_MAX, MK_FLAT, 8, T_ATTACK | T_FIRE);
    s.add(S_ATTACK_SPEED, MK_INC, 10);
    WeaponStats w;
    w.phys_min = 20; w.phys_max = 40; w.aps = 1.0f; w.crit = 5;
    SkillStats sk;
    sk.tags = T_ATTACK | T_MELEE | T_SLAM | T_AREA;
    sk.effectiveness = 1.5f;
    HitDamage h = compute_hit(s, w, sk);
    // phys: 20-40 * 1.5 = 30-60, * (1 + 0.5) * 1.2 = 54-108
    CHECK_NEAR(h.min[DT_PHYS], 54.f, 1e-3f);
    CHECK_NEAR(h.max[DT_PHYS], 108.f, 1e-3f);
    // fire: 4-8 * 1.5 = 6-12, * 1.2 more (slam), physical inc does not apply
    CHECK_NEAR(h.min[DT_FIRE], 7.2f, 1e-3f);
    CHECK_NEAR(h.max[DT_FIRE], 14.4f, 1e-3f);
    CHECK_NEAR(h.speed, 1.1f, 1e-4f);
    CHECK_NEAR(h.crit_chance, 0.05f, 1e-4f);
    // dps = (81 + 10.8) * (1 + 0.05 * 0.5) * 1.1
    CHECK_NEAR(h.dps(), 91.8f * 1.025f * 1.1f, 1e-2f);
}

TEST(spell_pipeline_uses_base_damage) {
    Stats s;
    s.add(S_DAMAGE, MK_INC, 30, T_ELEMENTAL);
    s.add(S_DAMAGE, MK_INC, 100, T_ATTACK);  // must not apply to spells
    SkillStats sk;
    sk.tags = T_SPELL | T_PROJECTILE;
    sk.base_min = 10; sk.base_max = 20; sk.base_type = DT_COLD;
    HitDamage h = compute_hit(s, WeaponStats{}, sk);
    CHECK_NEAR(h.min[DT_COLD], 13.f, 1e-4f);
    CHECK_NEAR(h.max[DT_COLD], 26.f, 1e-4f);
    CHECK_NEAR(h.min[DT_PHYS] + h.max[DT_PHYS], 0.f, 1e-6f);
}

TEST(armour_and_resistances) {
    CHECK_NEAR(armour_reduction(1000, 100), 0.5f, 1e-4f);         // 1000 / (1000 + 1000)
    CHECK_NEAR(armour_reduction(100000, 10), 0.9f, 1e-4f);        // capped
    CHECK_NEAR(armour_reduction(0, 50), 0.f, 1e-6f);
    Stats s;
    s.add(S_FIRE_RES, MK_FLAT, 120);
    Defences d = defences_of(s, 30);
    CHECK_NEAR(d.res[DT_FIRE], 90.f, 1e-4f);
    HitDamage h;
    h.min[DT_FIRE] = h.max[DT_FIRE] = 100;
    Rng rng(1);
    HitResult r = roll_hit(h, d, rng);
    CHECK_NEAR(r.total, 25.f, 1e-3f);                              // capped at 75%
}

TEST(crit_always_and_never) {
    HitDamage h;
    h.min[DT_PHYS] = h.max[DT_PHYS] = 10;
    h.crit_multi = 2.0f;
    Defences none;
    Rng rng(3);
    h.crit_chance = 1.f;
    CHECK_NEAR(roll_hit(h, none, rng).total, 20.f, 1e-4f);
    h.crit_chance = 0.f;
    CHECK_NEAR(roll_hit(h, none, rng).total, 10.f, 1e-4f);
}
