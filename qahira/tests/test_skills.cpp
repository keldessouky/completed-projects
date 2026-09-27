// Skills: Talismans and their levels, the Wafq supports, the magic squares they are drawn as, and the Sorcerer's
// spells through the damage pipeline.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/save.hpp"
#include "game/sky.hpp"
#include "game/world.hpp"
#include "ui/qr.hpp"

using namespace q;

static Hero sorcerer() {
    load_generated_tree();
    Hero h;
    h.passives.reset("sorcerer");
    apply_class_base(h, "sorcerer");
    Rng rng(5);
    h.weapon() = make_item(find_base("ashwood_staff"), Rarity::Normal, 1, rng);
    give_class_kit(h);
    compute_hero_stats(h);
    return h;
}

TEST(every_wafq_is_a_real_magic_square) {
    for (int w = 0; w < WQ_COUNT; w++) {
        int n = wafq_def(w).order;
        std::vector<int> m = magic_square(n);
        int target = n * (n * n + 1) / 2;
        std::vector<int> seen(size_t(n * n + 1), 0);
        for (int v : m) if (v >= 1 && v <= n * n) seen[size_t(v)]++;
        for (int v = 1; v <= n * n; v++) CHECK(seen[size_t(v)] == 1);   // 1..n^2, each once
        int d1 = 0, d2 = 0;
        for (int i = 0; i < n; i++) {
            int r = 0, c = 0;
            for (int j = 0; j < n; j++) { r += m[size_t(i * n + j)]; c += m[size_t(j * n + i)]; }
            CHECK(r == target && c == target);
            d1 += m[size_t(i * n + i)];
            d2 += m[size_t(i * n + n - 1 - i)];
        }
        CHECK(d1 == target && d2 == target);
    }
    for (int n = 3; n <= 9; n++) {   // and the Moon's, and every order between, for later Wafq
        std::vector<int> m = magic_square(n);
        int target = n * (n * n + 1) / 2, r0 = 0;
        for (int j = 0; j < n; j++) r0 += m[size_t(j)];
        CHECK(r0 == target);
    }
}

TEST(sorcerer_kit_and_wafq_change_the_numbers) {
    Hero h = sorcerer();
    const Talisman* bolt = h.slot_talisman(0);
    CHECK(bolt && std::string(bolt->def().id) == "ember_bolt");
    SkillCtx base = skill_ctx(*bolt, h.stats, h.weapon().weapon());
    CHECK(base.usable && base.hit.max[DT_FIRE] > 0 && base.hit.max[DT_PHYS] == 0);
    // the staff's implicit: 18% increased Spell Damage over level-1 base damage 7-11
    CHECK_NEAR(base.hit.min[DT_FIRE] / 7.0, base.hit.max[DT_FIRE] / 11.0, 1e-4);
    // Saturn: 30% more damage, and 30% more mana
    Talisman sat = *bolt;
    sat.wafq[0] = WQ_SATURN;
    SkillCtx s = skill_ctx(sat, h.stats, h.weapon().weapon());
    CHECK_NEAR(s.hit.average() / base.hit.average(), 1.3, 1e-3);
    CHECK(s.mana > base.mana);
    // Venus on a bolt: two more projectiles, 20% less damage each
    Talisman ven = *bolt;
    ven.wafq[0] = WQ_VENUS;
    SkillCtx v = skill_ctx(ven, h.stats, h.weapon().weapon());
    CHECK(v.projectiles == 3);
    CHECK_NEAR(v.hit.average() / base.hit.average(), 0.8, 1e-3);
    // Venus on Arc chains twice more instead; the Sun does not fit a bolt (no Area tag), so it does nothing
    Talisman arc = *h.slot_talisman(1);
    arc.wafq[0] = WQ_VENUS;
    CHECK(skill_ctx(arc, h.stats, h.weapon().weapon()).chains == 5);
    Talisman sun = *bolt;
    sun.wafq[0] = WQ_SUN;
    CHECK_NEAR(skill_ctx(sun, h.stats, h.weapon().weapon()).hit.average(), base.hit.average(), 1e-3);
    // Jupiter: gain 25% of the (fire) damage as extra fire
    Talisman jup = *bolt;
    jup.wafq[0] = WQ_JUPITER;
    CHECK_NEAR(skill_ctx(jup, h.stats, h.weapon().weapon()).hit.average() / base.hit.average(), 1.25, 1e-3);
    // Mars: 20% more cast speed
    Talisman mars = *bolt;
    mars.wafq[1] = WQ_MARS;
    CHECK_NEAR(skill_ctx(mars, h.stats, h.weapon().weapon()).hit.speed / base.hit.speed, 1.2, 1e-3);
    // a higher level hits harder, and a level-10 Talisman asks for more Intelligence than a new Sorcerer has
    Talisman hi = *bolt;
    hi.level = 10;
    SkillCtx h10 = skill_ctx(hi, h.stats, h.weapon().weapon());
    CHECK(h10.hit.average() > base.hit.average() * 2.5f);
    CHECK(!h10.usable);
}

TEST(a_warrior_can_use_a_spell_and_a_sorcerer_an_attack) {
    Hero h = sorcerer();
    Talisman blow;
    blow.skill = int16_t(find_skill("crushing_blow"));
    SkillCtx c = skill_ctx(blow, h.stats, h.weapon().weapon());
    CHECK(c.usable && c.hit.max[DT_PHYS] > 0);        // a staff swing: 7-13 physical, 110% effectiveness
    CHECK_NEAR(c.hit.speed, 1.2, 1e-3);                // the staff's attack speed
}

TEST(plans_follow_the_tree_and_place_one_star_per_press) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("sorcerer");
    Hero& H = w.hero;
    const auto* rec = tree().recommended_for("sorcerer");
    CHECK(rec && rec->size() >= 5);
    for (int t : *rec) plan_to(H, t);
    CHECK(H.plan.size() >= rec->size());
    // every planned star can be taken in order
    Allocation a = H.passives;
    for (uint16_t s : H.plan) { CHECK(a.can_take(s)); a.taken[s] = 1; }
    CHECK(place_next_planned(w) < 0);                  // level 1: no star to place
    H.level = 4;
    int first = H.plan.front();
    CHECK(place_next_planned(w) == first && H.passives.has(first) && H.plan.front() != first);
    CHECK(place_next_planned(w) >= 0 && place_next_planned(w) >= 0 && place_next_planned(w) < 0);   // three points, three stars
    // a build code becomes an ordered plan
    std::vector<uint16_t> order = order_plan(H.passives, a.held());
    Allocation b = H.passives;
    for (uint16_t s : order) { CHECK(b.can_take(s)); b.taken[s] = 1; }
    CHECK(b.held() == a.held());
    CHECK(respec_dinars(19) == 0 && respec_dinars(20) > 0);
}

TEST(character_file_v3_keeps_talismans_wafq_blanks_and_the_plan) {
    CHECK(load_generated_tree());
    Hero h = sorcerer();
    h.talismans[0].wafq[1] = WQ_MARS;
    h.talismans[1].slots = 4;
    h.wafq[WQ_SATURN] = 2;
    h.blanks = {3, 7};
    h.bar[6] = 2;
    h.currency[CUR_ROSEWATER] = 5;
    plan_to(h, tree().recommended_for("sorcerer")->front());
    ByteWriter w;
    write_character(w, h);
    Hero r;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, r));
    CHECK(r.passives.cls == "sorcerer" && r.talismans.size() == h.talismans.size());
    CHECK(r.talismans[0].wafq[1] == WQ_MARS && r.talismans[1].slots == 4 && r.wafq[WQ_SATURN] == 2);
    CHECK(r.blanks == h.blanks && r.bar[6] == 2 && r.currency[CUR_ROSEWATER] == 5 && r.plan == h.plan);
    CHECK(std::string(hero_model()) == "sorcerer");
}

TEST(qr_codes_have_their_finders_and_format) {
    QrCode c = qr_encode("Q1S-00CC07ZYE1G18M0020J0000002-4B");
    CHECK(c.version == 3 && c.size == 29);
    for (auto [ox, oy] : {std::pair{0, 0}, {c.size - 7, 0}, {0, c.size - 7}}) {   // the three finder patterns
        CHECK(c.at(ox, oy) && c.at(ox + 6, oy + 6) && !c.at(ox + 1, oy + 1) && c.at(ox + 3, oy + 3));
    }
    for (int i = 8; i < c.size - 8; i++) CHECK(c.at(i, 6) == (i % 2 == 0));   // timing
    CHECK(c.at(8, c.size - 8));                                              // the dark module
    CHECK(qr_encode(std::string(300, 'x')).size == 0);                       // too long for version 10
}
