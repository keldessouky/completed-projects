#include "game/bots.hpp"
#include "platform/app_api.hpp"
#include <vector>
#include <cstdio>

namespace q {

void Bot::start(const char* s) { scenario = s ? s : ""; }

void Bot::drive(World& w, Input& in, uint64_t frame) {
    if (scenario.empty() || status != 0) return;
    if (scenario == "walk") walk(w, in, frame);
    else if (scenario == "fight") fight(w, in, frame);
    else fail("unknown bot " + scenario);
}

// round-trips a save state and checks the hero comes back exactly where it was
static bool state_round_trip(World& w) {
    size_t n = app_serialize_size();
    std::vector<uint8_t> st(n);
    if (!app_serialize(st.data(), n)) return false;
    vec2 saved = w.actors[0].pos;
    size_t count = w.actors.size();
    float life = w.actors[0].life;
    w.actors[0].pos += vec2{3, 3};
    w.actors[0].life = 1;
    if (!app_unserialize(st.data(), n)) return false;
    return length(w.actors[0].pos - saved) < 1e-5f && w.actors.size() == count && w.actors[0].life == life;
}

void Bot::walk(World& w, Input& in, uint64_t frame) {
    if (frame == 1) start_pos = w.actors[0].pos;
    in.lstick = {0, 1};
    if (frame == 120 && !state_round_trip(w)) { fail("save state round trip failed"); return; }
    if (frame >= 180) {
        float moved = length(w.actors[0].pos - start_pos);
        if (moved > 4.f) pass("walked " + std::to_string(moved) + " m");
        else fail("only moved " + std::to_string(moved));
    }
}

void Bot::fight(World& w, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    if (frame == 1) initial_enemies = w.enemies_alive();
    for (size_t i = 1; i < w.actors.size(); i++) {
        if (w.actors[i].rarity == Rarity::Rare) rare_seen = true;
    }
    if (rare_seen && !rare_killed) {
        bool alive = false;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Rare && w.actors[i].alive()) alive = true;
        if (!alive) rare_killed = true;
    }
    if (frame == 900) {
        if (!state_round_trip(w)) { fail("mid-fight save state round trip failed"); return; }
        state_ok = true;
    }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            fprintf(stderr, "bot: died at t=%.1f kills=%d level=%d life_max=%.0f alive=%d\n", w.time, w.hero.kills, w.hero.level,
                    h.life_max, w.enemies_alive());
        }
        if (deaths > 4) fail("died too often");
        return;
    }
    // loot: equip weapons that are upgrades
    if (w.selected_loot >= 0) {
        const Item& it = w.loot[size_t(w.selected_loot)].item;
        if (it.b().slot == Slot::Weapon && w.hero_dps(it) > w.hero_dps(w.hero.weapon) && frame % 6 == 0) {
            press(in, BTN_LEFT);
            picked_up = true;
            return;
        }
    }
    if (h.life < h.life_max * 0.4f && w.hero.flask >= 1 && frame % 20 == 0) press(in, BTN_L3);
    // nearest enemy and crowd size
    const Actor* target = nullptr;
    float best = 1e9f;
    int near = 0;
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& e = w.actors[i];
        if (!e.alive()) continue;
        float d = length(e.pos - h.pos);
        if (d < 3.8f) near++;
        if (d < best) { best = d; target = &e; }
    }
    int cracks = 0;
    for (auto& g : w.ground) if (g.kind == GroundFx::Crack && length(g.pos - h.pos) < 6) cracks++;
    if (!target) {
        // wander up the street to find the next pack, or pick up a nearby drop
        if (!w.loot.empty() && !picked_up) {
            vec2 d = w.loot[0].pos - h.pos;
            if (length(d) > 1.2f) in.lstick = normalize(d);
        } else in.lstick = {0, 0.8f};
        if (rare_killed && w.hero.kills >= initial_enemies) {
            if (!state_ok) { fail("never checked save state"); return; }
            pass("cleared " + std::to_string(w.hero.kills) + " ghouls incl. the rare, level " + std::to_string(w.hero.level) +
                 ", weapon " + w.hero.weapon.display_name() + (picked_up ? " (upgraded)" : "") + ", deaths " + std::to_string(deaths));
        }
        return;
    }
    vec2 d = target->pos - h.pos;
    if (h.act != Act::Idle) return;
    // step back out of a bruiser's slam
    if (target->def >= 0 && monster_defs()[size_t(target->def)].attack == AttackKind::Slam && target->act == Act::Skill && best < 3.2f) {
        in.lstick = normalize(-d);
        press(in, BTN_EAST);
        return;
    }
    if (best > 2.3f) { in.lstick = normalize(d); return; }
    in.lstick = normalize(d) * 0.3f;
    if (w.hero.cooldowns[2] <= 0 && near >= 2 && h.mana >= 9) press(in, BTN_NORTH);
    else if (cracks >= 2 && h.mana >= 11) press(in, BTN_R1);
    else if (near >= 3 && h.mana >= 7) press(in, BTN_WEST);
    else press(in, BTN_SOUTH);
    if (frame > 60 * 240) fail("fight took longer than 4 minutes");
}

}  // namespace q
