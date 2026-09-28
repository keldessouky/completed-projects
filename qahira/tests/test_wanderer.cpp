// Slice 10: the Wanderer begins at the Pole of the sky and walks through the other classes' starts; his Fragments are
// one notable from each of six other ascendancies, and three may be held; he wakes once a character has finished the
// campaign, after which every resistance is 60% lower.
#include "tests/check.hpp"
#include "tests/fixture.hpp"
#include "game/classes.hpp"
#include "game/save.hpp"
#include "game/title.hpp"

using namespace q;

TEST(the_wanderer_begins_at_the_pole_and_walks_through_the_starts) {
    CHECK(load_generated_tree());
    const PassiveTree& T = tree();
    const ClassDef& c = class_def("wanderer");
    CHECK(std::string(c.id) == "wanderer" && c.playable);
    CHECK(T.class_start("wanderer") == T.pole && T.pole >= 0);
    CHECK(T.recommended_for("wanderer") && !T.recommended_for("wanderer")->empty());
    Allocation a;
    a.reset("wanderer");
    CHECK(!a.can_take(T.pole));   // his start, held already
    int spoke = -1;
    for (int n : T.stars[size_t(T.pole)].adj) if (a.can_take(n)) spoke = n;
    CHECK(spoke >= 0);
    // walk out along a spoke to a class start, and take it: the other classes cannot
    int start = -1;
    std::vector<int> path;
    for (auto& s : T.stars) if (s.kind == StarKind::Start && s.cls == "shadow") start = s.id;
    CHECK(start >= 0);
    path = a.path_to(start);
    CHECK(!path.empty() && path.back() == start);
    for (int n : path) { CHECK(a.can_take(n)); a.taken[size_t(n)] = 1; }
    CHECK(a.has(start));
    Allocation w;
    w.reset("warrior");
    CHECK(w.path_to(start).empty());
    // his kit: a staff and a skill from four other classes
    World v;
    v.reset_hero("wanderer");
    CHECK(v.hero.weapon().b().wkind == WK_QSTAFF && std::string(v.hero.weapon().b().id) == "travellers_staff");
    CHECK(v.hero.talismans.size() == 4);
    CHECK(v.hero.stats.value(S_STR) >= 30 && v.hero.stats.value(S_DEX) >= 30 && v.hero.stats.value(S_INT) >= 30);   // +10 from the staff
    SkillCtx s0 = v.slot_ctx(0);
    CHECK(s0.def && std::string(s0.def->id) == "whirling_staff" && s0.usable);
}

TEST(fragments_three_notables_from_six_ascendancies) {
    CHECK(load_generated_tree());
    auto two = ascendancies_of("wanderer");
    CHECK(two.size() == 1);
    const Ascendancy* f = ascendancy_of("wanderer", -1);
    CHECK(f && std::string(f->id) == "fragments" && f->nodes.size() == 13 && f->max_notables == 3);
    // each notable carries the rule of another ascendancy's
    std::vector<uint64_t> rules;
    for (auto& n : f->nodes) if (n.notable) rules.push_back(n.rule);
    CHECK(rules.size() == 6);
    for (uint64_t r : rules) CHECK(r != 0);
    // take three pairs; the fourth notable is refused, its minor is not
    uint32_t held = 0;
    for (int pair = 0; pair < 3; pair++) {
        int minor = 1 + 2 * pair, notable = minor + 1;
        CHECK(asc_can_take(*f, held, minor));
        held |= 1u << minor;
        CHECK(asc_can_take(*f, held, notable));
        held |= 1u << notable;
    }
    CHECK(asc_notables(*f, held) == 3);
    CHECK(asc_can_take(*f, held, 7));
    held |= 1u << 7;
    CHECK(!asc_can_take(*f, held, 8));
    World w;
    w.reset_hero("wanderer");
    w.hero.asc = (1u << 1) | (1u << 2) | (1u << 3) | (1u << 4);
    w.recompute_hero();
    CHECK((w.hero.keystones & KS_ENDURANCE) && (w.hero.keystones & KS_STORM_EYE));
}

TEST(the_wanderer_wakes_after_the_campaign_and_resistances_fall_sixty) {
    CHECK(act_res_penalty(Q_ACT3) == 30.f && act_res_penalty(Q_ACT3 | Q_ACT6) == 60.f && act_res_penalty(0) == 0.f);
    Title t;
    t.wanderer_unlocked = false;
    CHECK(!t.pickable(class_def("wanderer")) && t.pickable(class_def("templar")));
    t.wanderer_unlocked = true;
    CHECK(t.pickable(class_def("wanderer")));
    // a character file keeps the quest that wakes him
    Hero h;
    h.quests = Q_ACT5 | Q_ACT6;
    ByteWriter bw;
    write_character(bw, h);
    Hero b;
    ByteReader br(bw.buf.data(), bw.buf.size());
    CHECK(read_character(br, b) && (b.quests & Q_ACT6));
}
