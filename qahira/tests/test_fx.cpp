// The spells' pixel art: the sheet's rows and the game's FxSprite enum stay in step, and a burst's colour picks its
// flipbook.
#include "tests/check.hpp"
#include "game/world.hpp"
#include <fstream>
#include <sstream>

using namespace q;

TEST(the_effects_sheet_and_the_enum_agree) {
    std::ifstream f(std::string(QAHIRA_SOURCE_DIR) + "/tools/fx/fx_atlas.py");
    std::stringstream ss;
    ss << f.rdbuf();
    const std::string src = ss.str();
    const size_t a = src.find("EFFECTS = ["), b = src.find("\n]", a);
    CHECK(a != std::string::npos && b != std::string::npos);
    int rows = 0;
    for (size_t p = src.find("('", a); p != std::string::npos && p < b; p = src.find("('", p + 1)) rows++;
    CHECK(rows == FX_COUNT);
    CHECK(src.find("('fireball'", a) < src.find("('ember'", a) && kFxLooping == FX_EMBER);
}

TEST(a_burst_picks_its_flipbook_by_colour) {
    CHECK(fx_for(vec4(1.f, 0.7f, 0.4f, 1), true, 0) == FX_EMBER);          // a hit's sparks
    CHECK(fx_for(vec4(1.f, 0.85f, 0.5f, 1), true, 0) == FX_HOLY);          // gold
    CHECK(fx_for(vec4(0.7f, 0.85f, 1.f, 1), true, 0) == FX_FROST);         // cold
    CHECK(fx_for(vec4(0.45f, 0.9f, 0.3f, 1), true, 0) == FX_BUBBLE);       // poison
    CHECK(fx_for(vec4(0.7f, 0.06f, 0.05f, 1), false, 0) == FX_BLOOD);      // blood
    CHECK(fx_for(vec4(0.6f, 0.52f, 0.4f, 1), false, 1) == FX_SMOKE);       // dust
    CHECK(fx_projectile(DT_FIRE, {1, 0.5f, 0.2f}) == FX_FIREBALL && fx_impact(DT_FIRE, {1, 0.5f, 0.2f}) == FX_BLAST);
    CHECK(fx_projectile(DT_CHAOS, {0.4f, 1.f, 0.3f}) == FX_POISON_BLOB);   // the monsters' bile
    CHECK(fx_projectile(DT_CHAOS, {0.6f, 0.2f, 0.9f}) == FX_SHADOW_ORB);
    // bursts keep drawing from fx_rng as before: a burst of twelve spends as many numbers as it always did
    World w;
    Rng before = w.fx_rng;
    w.burst(vec3(0, 0, 1), 12, vec4(1, 0.7f, 0.4f, 1), vec4(1, 0.3f, 0.1f, 0), 3.f, 0.2f, 0.5f, true);
    for (int i = 0; i < 12 * 6; i++) before.range(0.f, 1.f);
    CHECK(before.range(0.f, 1.f) == w.fx_rng.range(0.f, 1.f));
    CHECK(w.particles.size() == 4 && w.particles[0].fx == FX_EMBER);
}
