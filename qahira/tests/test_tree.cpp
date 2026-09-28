// The Book of Fixed Stars: loading, PoE allocation rules, keystones and build codes, on the generated tree.
#include "tests/check.hpp"
#include <algorithm>
#include "game/tree.hpp"
#include "tests/fixture.hpp"

using namespace q;

static int find_star(const char* name) {
    for (auto& s : tree().stars) if (s.name.rfind(name, 0) == 0) return s.id;
    return -1;
}

TEST(tree_loads_with_class_starts_and_keystones) {
    CHECK(load_generated_tree());
    CHECK(tree().stars.size() > 120);
    CHECK(tree().class_start("warrior") >= 0 && tree().class_start("sorcerer") >= 0);
    int ks = 0;
    for (auto& s : tree().stars) if (s.kind == StarKind::Keystone) { ks++; CHECK(s.keystone != 0); }
    CHECK(ks >= 3);
}

TEST(allocation_follows_the_connections) {
    CHECK(load_generated_tree());
    Allocation a;
    a.reset("warrior");
    int follower = find_star("al-Dabaran");
    CHECK(follower >= 0);
    CHECK(!a.can_take(follower));
    std::vector<int> path = a.path_to(follower);
    CHECK(path.size() >= 5 && path.size() <= 12);
    CHECK(path.back() == follower);
    for (int s : path) { CHECK(a.can_take(s)); a.taken[size_t(s)] = 1; }   // each is adjacent to what we hold
    CHECK(a.spent() == int(path.size()));
    CHECK((a.keystones() & KS_FOLLOWER) != 0);
    CHECK(a.can_refund(follower));                    // a leaf can go
    CHECK(!a.can_refund(path[path.size() / 2]));       // the middle of the road cannot
    CHECK(a.path_to(follower).empty());                // already held
    // the Sorcerer's start is not a road for the Warrior
    CHECK(a.path_to(tree().class_start("sorcerer")).empty());
}

TEST(held_stars_become_stats) {
    CHECK(load_generated_tree());
    Allocation a;
    a.reset("warrior");
    int heart = find_star("Qalb al-Asad");
    CHECK(heart >= 0);
    for (int s : a.path_to(heart)) a.taken[size_t(s)] = 1;
    Stats st;
    a.apply(st);
    CHECK(st.sum(S_LIFE).flat >= 30);
    CHECK(st.sum(S_LIFE).inc >= 8);
    st.remove_source(uint16_t(1000 + heart));
    CHECK(st.sum(S_LIFE).inc < 8);
}

TEST(build_codes_round_trip_and_reject_damage) {
    CHECK(load_generated_tree());
    Allocation a;
    a.reset("sorcerer");
    for (int s : a.path_to(find_star("al-Simak"))) a.taken[size_t(s)] = 1;
    std::string code = build_code(a);
    CHECK(code.rfind("Q1S-", 0) == 0);
    Allocation b;
    CHECK(parse_build_code(code, b));
    CHECK(b.cls == "sorcerer" && b.taken == a.taken);
    std::string bad = code;
    bad[5] = bad[5] == 'A' ? 'B' : 'A';
    CHECK(!parse_build_code(bad, b));
    CHECK(!parse_build_code("hello", b));
}

TEST(stars_from_earlier_slices_never_move) {
    // characters store stars by id: every slice appends to the sky, and these must stay where Slice 3 put them
    CHECK(load_generated_tree());
    const PassiveTree& T = tree();
    struct Pin { int id; const char* name; float x, y; };
    const Pin pins[] = {{0, "The Pole", 0, 0}, {51, "Qalb al-Asad, the Lion's Heart", -376.2f, -517.8f},
                        {59, "Yad al-Jawza, the Hand", -759.6f, -327.3f}, {64, "Rijl al-Jabbar, the Giant's Foot", -490.4f, -356.2f},
                        {100, "", 170.6f, 587.3f}, {127, "al-Dabaran, the Follower", -902.1f, -328.3f}, {130, "", -127.6f, 894.4f}};
    for (auto& p : pins) {
        CHECK(p.id < int(T.stars.size()));
        if (p.id >= int(T.stars.size())) continue;
        const Star& s = T.stars[size_t(p.id)];
        CHECK(s.name == p.name);
        CHECK_NEAR(s.pos.x, p.x, 0.05);
        CHECK_NEAR(s.pos.y, p.y, 0.05);
    }
    CHECK(T.class_start("ranger") >= 0 && std::find(T.implemented.begin(), T.implemented.end(), "ranger") != T.implemented.end());
    CHECK(T.recommended_for("ranger") && !T.recommended_for("ranger")->empty());
}
