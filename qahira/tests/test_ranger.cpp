// Slice 6: the Ranger (bows, evasion, poison, marks, Frenzy), a class with two ascendancies, Act II's road, and the
// Marid Rifts' currency.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/save.hpp"
#include "game/classes.hpp"

using namespace q;

TEST(the_ranger_is_playable_with_a_bow_and_bow_skills_need_one) {
    CHECK(load_generated_tree());
    const ClassDef& c = class_def("ranger");
    CHECK(std::string(c.id) == "ranger" && c.playable && c.evasion > 0);
    World w;
    w.reset_hero("ranger");
    CHECK(w.hero.weapon().b().wkind == WK_BOW);
    CHECK(w.hero.talismans.size() == 4);
    SkillCtx split = w.slot_ctx(0);
    CHECK(split.def && std::string(split.def->id) == "split_arrow" && split.usable && split.projectiles == 3);
    // a maul in hand: the bow skills cannot be used, the Mark (not a bow skill) still can
    Rng r(1);
    w.hero.weapon() = make_item(find_base("worn_maul"), Rarity::Normal, 1, r);
    w.recompute_hero();
    CHECK(!w.slot_ctx(0).usable && w.slot_ctx(0).needs_weapon);
    CHECK(w.slot_ctx(1).usable && !w.slot_ctx(1).needs_weapon);
}

TEST(evasion_falls_off_against_deeper_monsters_and_is_capped) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("ranger");
    w.area_level = 1;
    float shallow = w.evade_chance();
    w.area_level = 25;
    float deep = w.evade_chance();
    CHECK(shallow > deep && deep > 0.f);
    w.hero.base.add(S_EVASION, MK_FLAT, 1e6f, 0, SRC_CLASS);
    w.recompute_hero();
    CHECK(std::fabs(w.evade_chance() - 0.75f) < 1e-4f);
}

TEST(poison_stacks_marks_crit_and_a_marked_death_gives_frenzy) {
    CHECK(load_generated_tree());
    World w;
    w.reset_hero("ranger");
    w.area_level = 10;
    Actor& m = w.spawn_monster(find_monster("timthal"), {3, 0}, Rarity::Normal, 10);
    m.life = m.life_max = 1e6f;
    size_t mi = w.actors.size() - 1;
    HeroHit hh;
    hh.hit.min[DT_PHYS] = hh.hit.max[DT_PHYS] = 50;
    hh.hit.crit_chance = 0;
    hh.poison = 1.f;
    hh.poison_mult = 1.f;
    hh.talisman = 0;   // Split Arrow: an attack
    float plain = 0;
    for (int k = 0; k < 3; k++) { float l0 = w.actors[mi].life; w.hit_enemy(w.actors[mi], hh, {0, 0}, 0); plain = l0 - w.actors[mi].life; }
    int stacks = 0;
    for (float t : w.actors[mi].poison_t) stacks += t > 0;
    CHECK(stacks == 3);
    // a Mark: its next hits are critical strikes, one per hit, then it is spent
    w.actors[mi].mark_t = 8;
    w.actors[mi].mark_hits = 2;
    float before = w.actors[mi].life;
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    float marked_hit = before - w.actors[mi].life;
    CHECK(w.actors[mi].mark_hits == 1 && marked_hit > plain * 1.2f);
    // the marked one dies: a Frenzy Charge
    CHECK(w.hero.frenzy == 0);
    w.actors[mi].life = 1;
    w.hit_enemy(w.actors[mi], hh, {0, 0}, 0);
    CHECK(!w.actors[mi].alive() && w.hero.frenzy == 1);
}

TEST(a_class_with_two_ascendancies_chooses_and_keeps_its_choice) {
    auto two = ascendancies_of("ranger");
    CHECK(two.size() == 2);
    CHECK(ascendancy_of("ranger", -1) == nullptr);                        // not chosen yet
    CHECK(ascendancy_of("warrior", -1) && std::string(ascendancy_of("warrior", -1)->id) == "ironclad");   // only one
    CHECK(ascendancy_of("ranger", find_ascendancy("ironclad")) == nullptr);   // another class's is never yours
    const Ascendancy* out = ascendancy_of("ranger", find_ascendancy("outrider"));
    CHECK(out && out->nodes.size() == 13 && ascendancy_of("ranger", find_ascendancy("marksman"))->nodes.size() == 13);
    Stats s;
    uint64_t rules = 0;
    asc_apply(*out, (1u << 3) | (1u << 4), s, rules);   // Venom, then Scorpion's Kiss
    CHECK((rules & KS_VIPER) && s.sum(S_POISON).flat == 20);
    // the choice is in the character file (v6)
    Hero h;
    h.passives.cls = "ranger";
    h.ascendancy = int8_t(find_ascendancy("outrider"));
    h.asc = 0x18;
    ByteWriter w;
    write_character(w, h);
    Hero b;
    ByteReader br(w.buf.data(), w.buf.size());
    CHECK(read_character(br, b));
    CHECK(b.ascendancy == h.ascendancy && b.asc == 0x18);
}

TEST(act_two_runs_up_the_nile_and_ends_below_the_valley) {
    const char* road[] = {"nile_bank", "village", "canal", "karnak", "valley", "tomb"};
    int last = 13;
    for (size_t i = 0; i < 6; i++) {
        int z = find_zone(road[i]);
        CHECK(z >= 0);
        const ZoneDef& d = zone_def(z);
        CHECK(d.act == 2 && d.level > last);
        last = d.level;
        if (i + 1 < 6) CHECK(std::string(d.next) == road[i + 1]);
        if (*d.boss) CHECK(boss_def(find_monster(d.boss)) != nullptr);
    }
    CHECK(std::string(zone_def(find_zone("mokattam")).next) == "nile_bank");   // Act I leads on to it
    CHECK(quest_passive_points(Q_NADDAHA | Q_RAM | Q_MARID) == 3);
    // the Rift Lord's court is an endgame zone, and its lord a boss
    CHECK(zone_def(find_zone("rift_court")).act == 0 && boss_def(find_monster("rift_lord")) != nullptr);
}

TEST(rift_currency_never_drops_at_random) {
    CHECK(currency_def(CUR_SPLINTER).weight == 0 && currency_def(CUR_RIFT_SEAL).weight == 0);
    Rng r(4);
    for (int k = 0; k < 2000; k++) {
        int c = roll_currency(r, 100);
        CHECK(c != CUR_SPLINTER && c != CUR_RIFT_SEAL);
    }
}
