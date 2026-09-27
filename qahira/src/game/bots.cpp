#include "game/bots.hpp"
#include "game/save.hpp"
#include "platform/app_api.hpp"
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <deque>
#include <algorithm>

namespace q {

void Bot::start(const char* s) { scenario = s ? s : ""; }

void Bot::drive(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    if (scenario.empty() || status != 0) return;
    now_ = frame;
    if (scenario == "walk") walk(w, in, frame);
    else if (scenario == "fight") fight(w, m, in, frame);
    else if (scenario == "zone" || scenario == "sorcerer") zone(w, m, a, in, frame);
    else if (scenario == "tour") tour(w, m, a, in, frame);
    else if (scenario == "sky") sky(w, in, frame);
    else if (scenario == "title") title(w, in, frame);
    else if (scenario == "tour3") tour3(w, m, a, in, frame);
    else if (scenario == "bestiary") bestiary(w, a, in, frame);
    else if (scenario == "tour4") tour4(w, m, a, in, frame);
    else if (scenario == "act1") act1(w, m, a, in, frame);
    else if (scenario == "tour5") tour5(w, a, in, frame);
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

// ---------------------------------------------------------------- shared skills
// Walk to an enemy; one we have walked at for three seconds without getting anywhere is out of reach (behind a wall
// the nav grid cannot get round), and the pilots leave it be.
void Bot::chase(World& w, Input& in, const Actor& e) {
    const Actor& h = w.actors[0];
    if (e.id != chase_id_ || length(h.pos - chase_pos_) > 0.5f) { chase_id_ = e.id; chase_pos_ = h.pos; chase_frame_ = now_; }
    else if (now_ - chase_frame_ > 180) { ignored_.push_back(e.id); chase_id_ = 0; return; }
    steer(w, in, e.pos);
}

// Is the hero standing where this ground effect is about to hurt? `out` is the way out, `dist` how deep in.
static bool in_danger(const GroundFx& g, const Actor& h, vec2& out, float& dist) {
    vec2 d = h.pos - g.pos;
    dist = length(d);
    out = dist > 0.1f ? d / dist : from_angle(h.facing + kPi);
    switch (g.kind) {
        case GroundFx::Telegraph: {
            bool inside = dist < g.radius + h.radius + 0.4f;
            if (inside && g.half < kPi - 0.01f) inside = std::fabs(wrap_angle(angle_of(d) - g.angle)) < g.half + 0.3f;
            return inside;
        }
        case GroundFx::Fire:   // a player stands in a little fire to land hits; the pilots do too while healthy
            return g.t < g.life && dist < g.radius + h.radius + 0.3f && h.life < h.life_max * 0.55f;
        case GroundFx::Line: {   // a beam: sidestep, across the line
            vec2 ab = g.pos2 - g.pos;
            float L2 = std::max(1e-4f, dot(ab, ab));
            float t = clampf(dot(d, ab) / L2, 0.f, 1.f);
            vec2 off = h.pos - (g.pos + ab * t);
            float side = length(off);
            if (side > g.radius + h.radius + 0.4f) return false;
            vec2 n = normalize(vec2{-ab.y, ab.x});
            out = dot(off, n) >= 0 ? n : -n;
            dist = g.radius - side + 2.f;   // deep enough to roll
            return true;
        }
        default: return false;
    }
}
void Bot::steer(World& w, Input& in, vec2 target) {
    const Actor& h = w.actors[0];
    if (length(target - h.pos) < 0.4f) return;
    if (w.level.line_clear(h.pos, target, h.radius)) {
        in.lstick = normalize(target - h.pos);
        path_.clear();
        return;
    }
    if (path_.empty() || length(target - path_goal_) > 1.f || now_ - path_frame_ > 90) {
        bool ok = w.level.find_path(h.pos, target, h.radius + 0.1f, path_);
        if (getenv("QAHIRA_BOT_TRACE")) fprintf(stderr, "path from (%.1f,%.1f) to (%.1f,%.1f): %s, %zu legs\n", h.pos.x, h.pos.y, target.x, target.y, ok ? "ok" : "none", path_.size());
        path_goal_ = target;
        path_frame_ = now_;
        path_i_ = 0;
    }
    while (path_i_ < path_.size() && length(path_[path_i_] - h.pos) < 0.6f) path_i_++;
    vec2 wp = path_i_ < path_.size() ? path_[path_i_] : target;
    if (length(wp - h.pos) > 1e-3f) in.lstick = normalize(wp - h.pos);
}

// the Sorcerer's way: keep 5-9 m away, a glyph under the pack, Arc into crowds, the star on anything chilled
bool Bot::caster_combat(World& w, Input& in, uint64_t frame, float reach) {
    Actor& h = w.actors[0];
    for (auto& g : w.ground) {  // step out of telegraphs first, as the melee pilot does
        vec2 out;
        float dist;
        if (!in_danger(g, h, out, dist)) continue;
        for (size_t i = 1; i < w.actors.size(); i++) {
            const Actor& b = w.actors[i];
            if (b.rarity != Rarity::Unique || !b.alive() || length(h.pos - b.home) < 18.f) continue;
            vec2 home = normalize(b.home - h.pos);
            vec2 side{-out.y, out.x};
            if (dot(side, home) < 0) side = -side;
            out = normalize(out + side * 1.4f + home * 0.5f);
        }
        if (h.act == Act::Idle) {
            in.lstick = out;
            if (g.life - g.t < 0.45f) press(in, BTN_EAST);
        }
        return true;
    }
    const Actor* target = nullptr;
    float best = 1e9f;
    int near_me = 0;
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& e = w.actors[i];
        if (!e.alive() || unreachable(e.id)) continue;
        float d = length(e.pos - h.pos) - (e.rarity == Rarity::Unique ? 1.0f : 0.f);
        if (d < 3.2f) near_me++;
        float score = d - (e.rarity >= Rarity::Rare ? 2.f : 0.f);
        if (score < best) { best = score; target = &e; }
    }
    if (!target || length(target->pos - h.pos) > reach) return false;
    if (h.life < h.life_max * 0.5f && w.hero.flask >= 1 && frame % 20 == 0) press(in, BTN_L3);
    vec2 d = target->pos - h.pos;
    float dist = length(d);
    if (h.act != Act::Idle) return true;
    int crowd = 0;
    for (size_t i = 1; i < w.actors.size(); i++)
        if (w.actors[i].alive() && length(w.actors[i].pos - target->pos) < 4.f) crowd++;
    // too close: back off (and roll out of a pack)
    if (dist < 4.2f && w.level.line_clear(h.pos, h.pos - normalize(d) * 3.f, h.radius)) {
        in.lstick = normalize(-d);
        if (near_me >= 2 && frame % 30 == 0) press(in, BTN_EAST);
        if (frame % 3) return true;   // mostly walking; now and then a bolt over the shoulder
    }
    if (dist > 10.f || !w.level.line_clear(h.pos, target->pos, 0.2f)) { chase(w, in, *target); return true; }
    in.rstick = normalize(d);
    auto ready = [&](int slot) {
        SkillCtx c = w.slot_ctx(slot);
        return c.def && w.hero.cooldowns[slot] <= 0 && h.mana >= c.mana && c.usable;
    };
    if (frame % 2) return true;   // release between presses
    bool chilled = target->chill_t > 0 || target->frozen_t > 0;
    if (ready(2) && (crowd >= 2 || target->rarity >= Rarity::Rare) && dist < 7.5f) press(in, BTN_NORTH);            // Frost Glyph
    else if (ready(3) && (chilled || target->rarity >= Rarity::Rare) && dist < 9.f) press(in, BTN_R1);             // Falling Star
    else if (ready(1) && crowd >= 2) press(in, BTN_WEST);                                                            // Arc
    else if (ready(0)) press(in, BTN_SOUTH);                                                                         // Ember Bolt
    else if (ready(1)) press(in, BTN_WEST);
    return true;
}

bool Bot::combat(World& w, Input& in, uint64_t frame, float reach) {
    if (w.hero.passives.cls == "sorcerer") return caster_combat(w, in, frame, reach);
    Actor& h = w.actors[0];
    // step out of any telegraph we are standing in
    for (auto& g : w.ground) {
        vec2 out;
        float dist;
        if (!in_danger(g, h, out, dist)) continue;
        // against a boss, dodge back into her court rather than down the lanes (she resets if we flee)
        for (size_t i = 1; i < w.actors.size(); i++) {
            const Actor& b = w.actors[i];
            if (b.rarity != Rarity::Unique || !b.alive() || length(h.pos - b.home) < 20.f) continue;
            vec2 home = normalize(b.home - h.pos);
            vec2 side{-out.y, out.x};
            if (dot(side, home) < 0) side = -side;
            out = dist < 0.6f ? home : normalize(out + side * 1.2f);
        }
        if (h.act == Act::Idle) {
            in.lstick = out;
            if (g.life - g.t < 0.5f || g.radius - dist > 3.5f) press(in, BTN_EAST);
        }
        return true;
    }
    const Actor* target = nullptr;
    float best = 1e9f;
    int near = 0;
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& e = w.actors[i];
        if (!e.alive() || unreachable(e.id)) continue;
        float d = length(e.pos - h.pos) - (e.rarity == Rarity::Unique ? 1.5f : 0.f);
        if (d < 3.8f) near++;
        if (d < best) { best = d; target = &e; }
    }
    if (!target || best > reach) return false;
    if (h.life < h.life_max * 0.45f && w.hero.flask >= 1 && frame % 20 == 0) press(in, BTN_L3);
    int cracks = 0;
    for (auto& g : w.ground) if (g.kind == GroundFx::Crack && length(g.pos - h.pos) < 6) cracks++;
    vec2 d = target->pos - h.pos;
    if (h.act != Act::Idle) return true;
    // step back out of a bruiser's slam
    if (target->def >= 0 && monster_defs()[size_t(target->def)].attack == AttackKind::Slam && target->act == Act::Skill && best < 3.2f) {
        in.lstick = normalize(-d);
        press(in, BTN_EAST);
        return true;
    }
    float range = target->rarity == Rarity::Unique ? 2.6f : 2.3f;
    if (length(d) > range) { chase(w, in, *target); return true; }
    in.lstick = normalize(d) * 0.3f;
    if (w.hero.cooldowns[2] <= 0 && (near >= 2 || target->rarity >= Rarity::Rare) && h.mana >= 9) press(in, BTN_NORTH);
    else if (cracks >= 2 && h.mana >= 11) press(in, BTN_R1);
    else if (near >= 3 && h.mana >= 7) press(in, BTN_WEST);
    else press(in, BTN_SOUTH);
    return true;
}

bool Bot::menu_nav(const World& w, const Menu& m, Input& in, uint64_t frame, Region r, int x, int y) {
    auto target_hit = [&]() {
        if (m.region != r) return false;
        if (r == Region::Purse) return m.purse == x;
        if (r == Region::Equip) return m.eq == x;
        const Inventory& g = r == Region::Stock ? m.stock : w.hero.inv;
        int want = g.at(x, y);
        return want >= 0 ? g.at(m.cx, m.cy) == want : (m.cx == x && m.cy == y);
    };
    if (target_hit()) return true;
    if (frame % 2) return false;  // release between presses so each one registers
    // across first: tall items snap the cursor to their top, so going down then up can loop
    // but when the column cannot be reached on this row (a wide item there snaps the cursor back), change rows first
    auto grid_dir = [&]() {
        const Inventory& g = m.region == Region::Stock ? m.stock : w.hero.inv;
        if (m.cx != x) {
            int there = g.at(x, m.cy);
            bool snaps = there >= 0 && there != g.at(x, y) && g.items[size_t(there)].x != x;
            if (!snaps || m.cy == y) return m.cx < x ? BTN_RIGHT : BTN_LEFT;
        }
        return m.cy < y ? BTN_DOWN : BTN_UP;
    };
    Btn b = BTN_COUNT;
    switch (m.region) {
        case Region::Equip: b = BTN_DOWN; break;
        case Region::Purse: b = r == Region::Purse ? (m.purse < x ? BTN_RIGHT : BTN_LEFT) : BTN_UP; break;
        case Region::Stock: b = r == Region::Stock ? grid_dir() : BTN_RIGHT; break;
        case Region::Grid: b = r == Region::Grid ? grid_dir() : r == Region::Stock ? BTN_LEFT : BTN_DOWN; break;
    }
    if (b != BTN_COUNT) press(in, b);
    return false;
}

bool Bot::loot_and_equip(World& w, Menu& m, Input& in, uint64_t frame) {
    Hero& H = w.hero;
    auto inv_index = [&](uint32_t seed) {
        for (size_t i = 0; i < H.inv.items.size(); i++) if (H.inv.items[i].item.seed == seed) return int(i);
        return -1;
    };
    auto ground_index = [&](uint32_t seed) {
        for (size_t i = 0; i < w.loot.size(); i++) if (w.loot[i].kind == GroundItem::Gear && w.loot[i].item.seed == seed) return int(i);
        return -1;
    };
    // in the menu: walk the cursor to the item, equip it, close
    if (m.open) {
        if (++menu_guard > 900) {
            char b[200];
            snprintf(b, sizeof b, "menu navigation got stuck: region %d cursor (%d,%d) eq %d, %zu items, target %s", int(m.region), m.cx, m.cy, m.eq,
                     H.inv.items.size(), equip_target ? "set" : "none");
            for (auto& e : H.inv.items) {
                int iw, ih;
                grid_size(e.item, iw, ih);
                fprintf(stderr, "  inv %s at (%d,%d) %dx%d seed %u%s\n", e.item.display_name().c_str(), e.x, e.y, iw, ih, e.item.seed,
                        e.item.seed == equip_target ? "  <- target" : "");
            }
            fail(b);
            return true;
        }
        int i = equip_target ? inv_index(equip_target) : -1;
        if (i < 0) {
            if (frame % 2 == 0) press(in, BTN_START);
            if (equip_target) { upgraded = true; picked_up = true; equip_target = 0; equips++; }
            return true;
        }
        const InvItem& e = H.inv.items[size_t(i)];
        if (menu_nav(w, m, in, frame, Region::Grid, e.x, e.y) && frame % 2 == 0) press(in, BTN_SOUTH);
        return true;
    }
    menu_guard = 0;
    if (equip_target) {
        if (inv_index(equip_target) >= 0) {
            if (frame % 2 == 0) press(in, BTN_START);
            return true;
        }
        int g = ground_index(equip_target);
        if (g < 0) { equip_target = 0; return false; }  // gone
        if (w.selected_loot == g) { if (frame % 6 == 0) press(in, BTN_LEFT); }
        else steer(w, in, w.loot[size_t(g)].pos);
        return true;
    }
    // choose the nearest wanted item in reach: weapon upgrades, empty slots, and rares
    const Actor& h = w.actors[0];
    int best = -1;
    float bd = 12.f;
    bool best_equip = false;
    for (size_t i = 0; i < w.loot.size(); i++) {
        const GroundItem& g = w.loot[i];
        if (g.kind != GroundItem::Gear || !w.loot_visible(g)) continue;
        int x, y;
        if (!H.inv.find_space(g.item, x, y)) continue;
        int slot = equip_slot_for(g.item, H.equip);
        bool better = g.item.b().slot == Slot::Weapon && w.hero_dps(g.item) > w.hero_dps(H.weapon()) + 0.5f;
        bool fills = slot > EQ_WEAPON && H.equip[slot].empty();
        if (scenario == "act1") {   // the long run keeps its bags for upgrades only
            if (slot < 0 || slot == H.sealed_slot) continue;
            better = better || (slot > EQ_WEAPON && upgrade(w, g.item));
            if (!better && !fills) continue;
        }
        if (!better && !fills && g.item.rarity < Rarity::Magic) continue;  // magic and up: to wear or to sell
        float d = length(g.pos - h.pos);
        if (d < bd) { bd = d; best = int(i); best_equip = better || fills; }
    }
    if (best < 0) return false;
    if (best_equip) { equip_target = w.loot[size_t(best)].item.seed; return true; }
    if (w.selected_loot == best) { if (frame % 6 == 0) press(in, BTN_LEFT); }
    else steer(w, in, w.loot[size_t(best)].pos);
    return true;
}

// ---------------------------------------------------------------- walk
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

// ---------------------------------------------------------------- fight (the street)
void Bot::fight(World& w, Menu& m, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    if (frame == 1) initial_enemies = w.enemies_alive();
    for (size_t i = 1; i < w.actors.size(); i++)
        if (w.actors[i].rarity == Rarity::Rare) rare_seen = true;
    if (rare_seen && !rare_killed) {
        bool alive = false;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Rare && w.actors[i].alive()) alive = true;
        if (!alive) rare_killed = true;
    }
    if (frame >= 900 && !state_ok && !m.open) {
        if (!state_round_trip(w)) { fail("mid-fight save state round trip failed"); return; }
        state_ok = true;
    }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            fprintf(stderr, "bot: died at t=%.1f kills=%d level=%d life_max=%.0f alive=%d\n", w.time, w.hero.kills, w.hero.level, h.life_max,
                    w.enemies_alive());
        }
        if (deaths > 4) fail("died too often");
        return;
    }
    if (m.open || equip_target) { loot_and_equip(w, m, in, frame); return; }
    if (combat(w, in, frame, 30.f)) {
        if (frame > 60 * 240) fail("fight took longer than 4 minutes");
        return;
    }
    if (loot_and_equip(w, m, in, frame)) return;
    in.lstick = {0, 0.8f};  // up the street to the next pack
    if (rare_killed && w.hero.kills >= initial_enemies) {
        if (!state_ok) { fail("never checked save state"); return; }
        pass("cleared " + std::to_string(w.hero.kills) + " ghouls incl. the rare, level " + std::to_string(w.hero.level) + ", weapon " +
             w.hero.weapon().display_name() + ", " + std::to_string(equips) + " items equipped through the inventory, deaths " + std::to_string(deaths));
    }
}

// ---------------------------------------------------------------- zone (Slice 2's exit)
bool Bot::go_to_interact(World& w, Input& in, uint64_t frame, Interactable::Kind k) {
    for (size_t i = 0; i < w.interacts.size(); i++) {
        const Interactable& it = w.interacts[i];
        if (it.kind != k || it.spent) continue;
        if (w.near_interact == int(i)) {
            if (frame % 10 == 0) press(in, BTN_SOUTH);
        } else {
            steer(w, in, it.pos);
        }
        return true;
    }
    return false;
}

void Bot::zone(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    auto next_stage = [&](int s) {
        stage = s;
        stage_frame = frame;
        fprintf(stderr, "bot: stage %d at t=%.1fs (level %d, kills %d, %d dinars)\n", s, frame / 60.f, H.level, H.kills, H.gold);
    };
    if (frame > 60ull * 60 * 12) { fail("zone run took longer than 12 minutes (stage " + std::to_string(stage) + ")"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            fprintf(stderr, "bot: died in stage %d at t=%.1f level=%d\n", stage, frame / 60.f, H.level);
        }
        if (deaths > 6) fail("died too often");
        return;
    }
    // a pending equip owns the controls (and the menu) until it is done
    if (stage != 4 && !(m.open && m.vendor) && (m.open || equip_target)) { loot_and_equip(w, m, in, frame); return; }
    bool in_zone = a.current == AreaId::Zone;
    const ZoneLayout& L = a.zone.layout;
    if (getenv("QAHIRA_BOT_TRACE") && frame % 300 == 0) {
        int cell = in_zone ? L.cell_index_at(h.pos) : -1;
        int alive = 0, near = 0;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].alive()) { alive++; if (length(w.actors[i].pos - h.pos) < 9) near++; }
        fprintf(stderr, "trace t=%.0f stage %d pos (%.1f,%.1f) cell %d act %d alive %d near %d loot %zu sel %d eqt %u menu %d vel %.2f\n", frame / 60.f,
                stage, h.pos.x, h.pos.y, cell, int(h.act), alive, near, w.loot.size(), w.selected_loot, equip_target, int(m.open), length(h.vel));
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].rarity == Rarity::Unique)
                fprintf(stderr, "      boss life %.0f/%.0f phase %d act %d skill %d ai %d dist %.1f home-dist %.1f | hero life %.0f/%.0f flask %.1f | home (%.1f,%.1f) arena (%.1f,%.1f)\n",
                        w.actors[i].life, w.actors[i].life_max, w.actors[i].phase, int(w.actors[i].act), w.actors[i].skill, w.actors[i].ai_state,
                        length(w.actors[i].pos - h.pos), length(h.pos - w.actors[i].home), h.life, h.life_max, H.flask, w.actors[i].home.x, w.actors[i].home.y,
                        L.center(L.cells[size_t(L.arena)]).x, L.center(L.cells[size_t(L.arena)]).y);
    }
    auto goto_zone = [&](vec2 goal) { steer(w, in, goal); };
    auto calm = [&](float r) {
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].alive() && length(w.actors[i].pos - h.pos) < r) return false;
        return true;
    };
    switch (stage) {
        case 0:  // the rooftop: take the stair down
            if (in_zone) { zone_kills0 = H.kills; zone_cells = int(L.cells.size()); zone_name_ = a.name(); next_stage(1); break; }
            go_to_interact(w, in, frame, Interactable::Stair);
            break;
        case 1: {  // fight toward the landmark; after a few packs, portal out
            if (combat(w, in, frame, 9.f)) break;
            if (loot_and_equip(w, m, in, frame)) break;
            if (H.kills - zone_kills0 >= 10 && calm(12.f)) {
                if (frame % 10 == 0) press(in, BTN_UP);
                for (auto& it : w.interacts) if (it.kind == Interactable::Portal) next_stage(2);
                break;
            }
            int goal = L.landmark >= 0 ? L.landmark : L.arena;
            goto_zone(L.center(L.cells[size_t(goal)]));
            break;
        }
        case 2:  // through the portal
            if (!in_zone) {
                portal_monsters = int(a.zone.monsters.size());
                next_stage(3);
                break;
            }
            if (combat(w, in, frame, 6.f)) break;
            go_to_interact(w, in, frame, Interactable::Portal);
            break;
        case 3: {  // the rooftop again: the portal back must be waiting here
            bool portal = false;
            for (auto& it : w.interacts) if (it.kind == Interactable::Portal) portal = true;
            if (!portal) { fail("no portal back to the zone in the hub"); return; }
            next_stage(5);
            break;
        }
        case 5:  // back through the portal, into the same streets
            menu_guard = 0;
            if (in_zone) {
                int alive = 0;
                for (size_t i = 1; i < w.actors.size(); i++) alive += w.actors[i].alive();
                if (alive != portal_monsters) { fail("the zone changed while we were away: " + std::to_string(alive) + " vs " + std::to_string(portal_monsters)); return; }
                if (length(h.pos - a.zone.portal) > 3.f) { fail("did not arrive at the portal"); return; }
                portal_done = true;
                next_stage(6);
                break;
            }
            go_to_interact(w, in, frame, Interactable::Portal);
            break;
        case 6: {  // the cache, then the boss (with a look at the map on the way in)
            if (frame == stage_frame + 30 || frame == stage_frame + 150) { press(in, BTN_DOWN); break; }
            const Actor* boss = nullptr;
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
            if (boss && boss->phase == 1 && !boss_state_ok && boss->act != Act::Skill) {
                float life = boss->life;
                if (!state_round_trip(w)) { fail("save state in the middle of the boss failed"); return; }
                const Actor* b2 = nullptr;
                for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique) b2 = &w.actors[i];
                if (!b2 || b2->life != life || b2->phase != 1) { fail("the boss did not survive the save state"); return; }
                boss_state_ok = true;
                fprintf(stderr, "bot: save state mid-boss ok (boss life %.0f / %.0f)\n", life, boss->life_max);
            }
            if (w.boss_killed || (!boss && a.zone.cleared)) { boss_frame = frame; next_stage(7); break; }
            if (combat(w, in, frame, boss && boss->ai_state > 0 ? 30.f : 9.f)) break;
            if (loot_and_equip(w, m, in, frame)) break;
            bool chest_left = false;
            for (auto& it : w.interacts) if (it.kind == Interactable::Chest && !it.spent) chest_left = true;
            if (chest_left) {
                const Interactable* ch = nullptr;
                for (auto& it : w.interacts) if (it.kind == Interactable::Chest) ch = &it;
                if (ch && L.cell_index_at(h.pos) == L.cell_index_at(ch->pos)) go_to_interact(w, in, frame, Interactable::Chest);
                else if (ch) goto_zone(ch->pos);
                break;
            }
            chest_done = chest_done || L.landmark >= 0;
            goto_zone(L.center(L.cells[size_t(L.arena)]) + vec2{0, 1.f});
            break;
        }
        case 7: {  // gather what the boss dropped, check the way on is open, then home by the exit or a portal
            if (combat(w, in, frame, 8.f)) break;
            if (frame < boss_frame + 60 * 8 && loot_and_equip(w, m, in, frame)) break;
            if (!in_zone) { next_stage(8); break; }
            bool way_on = false;
            for (auto& it : w.interacts) way_on = way_on || it.kind == Interactable::Next || it.kind == Interactable::Exit;
            if (!way_on) { fail("the boss fell but no way on opened"); return; }
            if (go_to_interact(w, in, frame, Interactable::Exit)) break;
            bool portal = false;
            for (auto& it : w.interacts) portal = portal || it.kind == Interactable::Portal;
            if (!portal) { if (frame % 10 == 0) press(in, BTN_UP); break; }
            go_to_interact(w, in, frame, Interactable::Portal);
            break;
        }
        case 8:  // home; visit Amm Sayed
            if (m.open && m.vendor) {
                gold_expected = H.gold;
                for (auto& e : H.inv.items) gold_expected += sell_price(e.item);
                beads0 = H.currency[CUR_BEAD];
                menu_guard = 0;
                next_stage(9);
                break;
            }
            go_to_interact(w, in, frame, Interactable::Vendor);
            break;
        case 9: {  // at the vendor: sell everything we carry, buy two Blue Beads, leave
            if (!m.open) {
                int bought = H.currency[CUR_BEAD] - beads0;
                if (H.gold != gold_expected - bought * currency_def(CUR_BEAD).price) {
                    fail("vendor arithmetic is off: " + std::to_string(H.gold) + " dinars, expected " +
                         std::to_string(gold_expected - bought * currency_def(CUR_BEAD).price));
                    return;
                }
                if (bought < 1) { fail("could not buy a Blue Bead"); return; }
                vendor_done = true;
                next_stage(10);
                break;
            }
            if (++menu_guard > 2400) { fail("vendor menu got stuck"); return; }
            if (!H.inv.items.empty()) {
                const InvItem& e = H.inv.items[0];
                if (menu_nav(w, m, in, frame, Region::Grid, e.x, e.y) && frame % 4 == 0) { press(in, BTN_SOUTH); sold++; }
                break;
            }
            if (H.currency[CUR_BEAD] < beads0 + 2 && H.gold >= currency_def(CUR_BEAD).price) {
                if (menu_nav(w, m, in, frame, Region::Purse, CUR_BEAD, 0) && frame % 4 == 0) press(in, BTN_SOUTH);
                break;
            }
            if (frame % 2 == 0) press(in, BTN_EAST);
            break;
        }
        case 10: {  // the character file round-trips
            ByteWriter bw;
            write_character(bw, H);
            Hero copy = w.hero;
            copy.inv.items.clear();
            copy.level = 0;
            ByteReader br(bw.buf.data(), bw.buf.size());
            if (!read_character(br, copy) || copy.level != H.level || copy.gold != H.gold || copy.inv.items.size() != H.inv.items.size() ||
                copy.weapon().seed != H.weapon().seed || copy.currency[CUR_BEAD] != H.currency[CUR_BEAD]) {
                fail("character file round trip failed");
                return;
            }
            if (!portal_done || !vendor_done || !boss_state_ok) { fail("skipped part of the loop"); return; }
            char b[480];
            snprintf(b, sizeof b,
                     "hub -> %s (%d cells) -> portal round trip -> %s -> its boss (save state mid-fight ok) -> hub -> "
                     "vendor (sold %d, bought beads) in %.0fs; level %d, %d kills, %d dinars, weapon %s, %d items equipped through the inventory, deaths %d",
                     zone_name_.c_str(), zone_cells, chest_done ? "the landmark's cache" : "no cache", sold, frame / 60.f, H.level, H.kills, H.gold,
                     H.weapon().display_name().c_str(), equips, deaths);
            pass(b);
            break;
        }
    }
}

// ---------------------------------------------------------------- sky (Slice 3's exit)
// A level-31 Sorcerer plans a 30-star path on the sticks (magnet cursor, D-pad along edges when the magnet misses),
// places it one Select at a time, and must do it all in under two minutes. Then a paid respec and a build code.
void Bot::sky(World& w, Input& in, uint64_t frame) {
    Hero& H = w.hero;
    Sky& S = *sky_ui;
    const PassiveTree& T = tree();
    auto next_stage = [&](int st) { stage = st; stage_frame = frame; fprintf(stderr, "bot: sky stage %d at %.1fs (plan %zu, held %d)\n", st, frame / 60.f, H.plan.size(), H.passives.spent()); };
    if (frame == 1) {
        H.level = 31;
        H.currency[CUR_ROSEWATER] = 2;
        H.gold = 1000;
        w.recompute_hero();
        return;
    }
    if (frame > 60ull * 60 * 4) { fail("sky run took longer than 4 minutes (stage " + std::to_string(stage) + ")"); return; }
    switch (stage) {
        case 0:  // hold Select to open the sky
            if (S.open) { sky_open_frame_ = frame; next_stage(1); break; }
            in.down |= 1u << BTN_SELECT;
            break;
        case 1: {  // choose targets: the far keystone first, then notables, until the plan reaches 30 stars
            Allocation a = H.passives;
            int start = T.class_start(H.passives.cls);
            std::vector<std::pair<size_t, int>> ks;
            for (auto& st : T.stars)
                if (st.kind == StarKind::Keystone || st.kind == StarKind::Notable) ks.push_back({a.path_to(st.id).size(), st.id});
            std::sort(ks.begin(), ks.end());
            int far_key = -1;
            for (auto& [d, id] : ks) if (T.stars[size_t(id)].kind == StarKind::Keystone && d <= 30) far_key = id;
            sky_targets_.clear();
            if (far_key >= 0) sky_targets_.push_back(far_key);
            for (auto& [d, id] : ks) if (id != far_key && d > 3) sky_targets_.push_back(id);
            (void)start;
            next_stage(2);
            break;
        }
        case 2: {  // walk the cursor to the next target and plan it
            if (H.plan.size() >= 30) { next_stage(3); break; }
            // skip targets the plan already covers
            while (!sky_targets_.empty() && (std::find(H.plan.begin(), H.plan.end(), uint16_t(sky_targets_.front())) != H.plan.end() ||
                                             H.passives.has(sky_targets_.front())))
                sky_targets_.erase(sky_targets_.begin());
            if (sky_targets_.empty()) { fail("ran out of stars to plan at " + std::to_string(H.plan.size())); return; }
            int target = sky_targets_.front();
            if (S.cursor == target) {
                if (frame % 2 == 0) { press(in, BTN_WEST); sky_targets_.erase(sky_targets_.begin()); sky_stuck_ = 0; }
                break;
            }
            if (frame % 2) break;   // let the direction release so each move registers
            vec2 d = T.stars[size_t(target)].pos - T.stars[size_t(S.cursor)].pos;
            if (S.cursor != sky_last_cursor_) { sky_last_cursor_ = S.cursor; sky_stuck_ = 0; } else sky_stuck_++;
            if (sky_stuck_ < 4) {
                in.lstick = normalize(d);   // the magnet
            } else {
                // the magnet found nothing: walk an edge towards the target instead (breadth-first over the tree)
                std::vector<int> prev(T.stars.size(), -1);
                std::deque<int> q{S.cursor};
                prev[size_t(S.cursor)] = S.cursor;
                while (!q.empty() && prev[size_t(target)] < 0) {
                    int c = q.front();
                    q.pop_front();
                    for (int n : T.stars[size_t(c)].adj) if (prev[size_t(n)] < 0) { prev[size_t(n)] = c; q.push_back(n); }
                }
                int step = target;
                while (prev[size_t(step)] != S.cursor && prev[size_t(step)] >= 0 && step != S.cursor) step = prev[size_t(step)];
                vec2 e = T.stars[size_t(step)].pos - T.stars[size_t(S.cursor)].pos;
                Btn b = std::fabs(e.x) > std::fabs(e.y) ? (e.x > 0 ? BTN_RIGHT : BTN_LEFT) : (e.y > 0 ? BTN_UP : BTN_DOWN);
                in.down |= 1u << b;
                sky_steps_++;
            }
            break;
        }
        case 3: {  // place the plan, one Select at a time
            if (H.passives.spent() >= 30) {
                float secs = (frame - sky_open_frame_) / 60.f;
                if (secs > 120.f) { fail("30 stars took " + std::to_string(secs) + " s (rule: under 2 minutes)"); return; }
                fprintf(stderr, "bot: 30 stars planned and placed in %.1f s on the sticks\n", secs);
                next_stage(4);
                break;
            }
            if (frame % 4 == 0) press(in, BTN_SELECT);
            if (frame - stage_frame > 60 * 20) { fail("could not place the plan: " + std::to_string(H.passives.spent()) + " held"); return; }
            break;
        }
        case 4: {  // a respec: refund a leaf star (level 31 costs a Rosewater Vial and dinars), apply with Start
            int leaf = -1;
            for (int id : H.passives.held()) if (H.passives.can_refund(id)) leaf = id;
            if (leaf < 0) { fail("no star can be refunded"); return; }
            if (S.cursor != leaf) { S.cursor = leaf; break; }   // (the stick walk is proven above)
            vials_ = H.currency[CUR_ROSEWATER];
            gold_ = H.gold;
            press(in, BTN_SOUTH);
            next_stage(5);
            break;
        }
        case 5:
            if (frame == stage_frame + 4) press(in, BTN_START);
            if (frame == stage_frame + 10) {
                if (H.passives.spent() != 29) { fail("the refund did not apply: " + std::to_string(H.passives.spent()) + " held"); return; }
                if (H.currency[CUR_ROSEWATER] != vials_ - 1 || H.gold != gold_ - respec_dinars(H.level)) { fail("the refund cost is wrong"); return; }
                next_stage(6);
            }
            break;
        case 6: {  // the build code round-trips, and East closes the sky
            Allocation back;
            if (!parse_build_code(build_code(H.passives), back) || back.held() != H.passives.held() || back.cls != H.passives.cls) {
                fail("build code round trip failed");
                return;
            }
            if (S.open) { if (frame % 4 == 0) press(in, BTN_EAST); break; }
            char b[200];
            snprintf(b, sizeof b, "30 stars planned on the sticks and placed in %.1f s, a paid respec, build code %s", (stage_frame - sky_open_frame_) / 60.f,
                     build_code(H.passives).c_str());
            pass(b);
            break;
        }
    }
}

// ---------------------------------------------------------------- title: a new Sorcerer, a delete, a new Warrior
void Bot::title(World& w, Input& in, uint64_t frame) {
    Title& T = *title_ui;
    auto file_exists = [&](int slot) {
        FILE* f = fopen(slot_path(save_dir, slot).c_str(), "rb");
        if (f) fclose(f);
        return f != nullptr;
    };
    auto next_stage = [&](int st) { stage = st; stage_frame = frame; };
    uint64_t t = frame - stage_frame;
    if (frame > 60 * 60) { fail("title run took too long (stage " + std::to_string(stage) + ")"); return; }
    switch (stage) {
        case 0:  // an empty title: South, Right to the Sorcerer, South
            if (t == 1 && (!T.open || T.slots[0].exists)) { fail("the title should open on empty slots"); return; }
            if (t == 10) press(in, BTN_SOUTH);
            if (t == 20 && !T.picking) { fail("South on an empty slot should choose a class"); return; }
            if (t == 30) press(in, BTN_RIGHT);
            if (t == 40) press(in, BTN_SOUTH);
            if (t == 50) next_stage(1);
            break;
        case 1:  // in the hub as a Sorcerer, with the slot's file written
            if (T.open) { fail("the title is still open after choosing a class"); return; }
            if (w.hero.passives.cls != "sorcerer" || std::string(hero_model()) != "sorcerer") { fail("the new character is not a Sorcerer"); return; }
            if (!file_exists(0)) { fail("the new character's file was not written"); return; }
            T.scan(save_dir);   // back to the title (as a restart would)
            T.open = true;
            T.cursor = 0;
            if (!T.slots[0].exists || T.slots[0].cls != "sorcerer") { fail("the title does not list the Sorcerer"); return; }
            next_stage(2);
            break;
        case 2:  // North twice deletes
            if (t == 10) press(in, BTN_NORTH);
            if (t == 20 && !file_exists(0)) { fail("one press of North deleted the character"); return; }
            if (t == 30) press(in, BTN_NORTH);
            if (t == 40) {
                if (file_exists(0) || T.slots[0].exists) { fail("two presses of North did not delete the character"); return; }
                next_stage(3);
            }
            break;
        case 3:  // and a Warrior in its place
            if (t == 10) press(in, BTN_SOUTH);
            if (t == 20) press(in, BTN_SOUTH);
            if (t == 30) {
                if (T.open || w.hero.passives.cls != "warrior" || !file_exists(0)) { fail("could not make a Warrior after the delete"); return; }
                remove(slot_path(save_dir, 0).c_str());
                pass("title: a new Sorcerer, her file, a delete on two presses, and a new Warrior");
            }
            break;
    }
}

// ---------------------------------------------------------------- tour3: Slice 3's screens, for screenshots
void Bot::tour3(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Hero& H = w.hero;
    Sky& S = *sky_ui;
    auto at = [&](uint64_t f) { return frame == f; };
    if (at(1)) {
        Rng r(11);
        H.level = 14;
        H.gold = 420;
        H.currency[CUR_STYLUS] = 2;
        H.currency[CUR_ROSEWATER] = 1;
        H.weapon() = make_item(find_base("astrolabe_staff"), Rarity::Rare, 12, r);
        H.equip[EQ_BODY] = make_item(find_base("astronomers_robe"), Rarity::Rare, 12, r);
        H.equip[EQ_HELMET] = make_item(find_base("embroidered_hood"), Rarity::Magic, 12, r);
        H.equip[EQ_AMULET] = make_item(find_base("moonstone_amulet"), Rarity::Rare, 12, r);
        H.equip[EQ_RING1] = make_item(find_base("lapis_ring"), Rarity::Magic, 12, r);
        for (auto& t : H.talismans) t.level = 7;
        H.talismans[0].wafq[0] = WQ_SATURN;
        H.talismans[0].wafq[1] = WQ_VENUS;
        H.talismans[1].wafq[0] = WQ_MERCURY;
        H.talismans[3].wafq[0] = WQ_SUN;
        H.talismans[3].slots = 3;
        H.wafq[WQ_MARS] = 1;
        H.wafq[WQ_JUPITER] = 2;
        H.blanks = {6, 9, 12};
        for (int t : *tree().recommended_for("sorcerer")) plan_to(H, t);
        for (int k = 0; k < 11; k++) place_next_planned(w);
        w.recompute_hero();
        w.actors[0].life = w.actors[0].life_max;
        w.actors[0].mana = w.actors[0].mana_max;
        H.es = H.es_max;
    }
    // the Talismans tab: the bar, then a Wafq slot (its square), then the Character tab and a Why?
    if (at(60)) press(in, BTN_START);
    if (at(80)) press(in, BTN_R1);
    if (at(170)) press(in, BTN_RIGHT);
    if (at(260)) press(in, BTN_R1);
    if (at(330)) press(in, BTN_NORTH);
    if (at(420)) press(in, BTN_START);
    // the sky: hold Select, walk a little, open the code panel
    if (frame > 440 && frame < 470) in.down |= 1u << BTN_SELECT;
    if (frame > 500 && frame < 560 && S.open && frame % 12 == 0) { in.lstick = {0.8f, 0.6f}; }
    if (at(600) && S.open) press(in, BTN_R3);
    if (at(700) && S.open) press(in, BTN_EAST);
    if (at(720) && S.open) press(in, BTN_EAST);
    // down into the necropolis for the spells
    if (frame > 740 && a.current == AreaId::Hub && !m.open && !S.open) go_to_interact(w, in, frame, Interactable::Stair);
    if (a.current == AreaId::Zone) {
        if (stage == 0) { stage = 1; stage_frame = frame; }
        if (!combat(w, in, frame, 12.f)) {   // walk towards the nearest pack
            const Actor* best = nullptr;
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].alive() && (!best || length(w.actors[i].pos - w.actors[0].pos) < length(best->pos - w.actors[0].pos))) best = &w.actors[i];
            if (best) steer(w, in, best->pos);
        }
        if (frame - stage_frame > 60 * 30) pass("tour3 done");
    }
    if (!w.actors[0].alive() && w.actors[0].dead_t > 1.3f && frame % 10 == 0) press(in, BTN_SOUTH);
    if (frame > 60 * 90) pass("tour3 done");
}

// ---------------------------------------------------------------- bestiary: each monster in turn, for screenshots
void Bot::bestiary(World& w, Areas& a, Input& in, uint64_t frame) {
    (void)a;
    static const char* ids[] = {"cable_jinn", "dish_sentinel", "silah", "nasnas", "qutrub", "microbus_jinn", "silah_sadat",
                                "nasnas_kabir", "ifrit_zuweila", "qutrub_alpha"};
    const int n = int(sizeof ids / sizeof *ids), each = 100;
    Actor& h = w.actors[0];
    h.life = h.life_max;
    int k = int(frame - 2) / each;
    if (k >= n) { pass("bestiary done"); return; }
    if ((frame - 2) % each == 0) {
        for (size_t i = 1; i < w.actors.size(); i++) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 9;
        w.spawn_monster(find_monster(ids[k]), h.pos + vec2{2.5f, 2.5f}, Rarity::Normal, 1);
    }
    (void)in;
}

// ---------------------------------------------------------------- tour4: Act I's screens, for screenshots
void Bot::tour4(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    (void)a;
    Hero& H = w.hero;
    auto at = [&](uint64_t f) { return frame == f; };
    if (at(1)) {
        Rng r(21);
        H.level = 16;
        H.gold = 900;
        H.quests = Q_MICROBUS | Q_SILAH | Q_BENCH | Q_NASNAS | Q_TRIAL1;
        H.recipes = 0x7F;
        H.codex = 0x1FFF & ~(1u << 5);
        H.scraps[1] = 3;
        H.scraps[3] = 1;
        H.scraps[16] = 2;
        for (int c = CUR_KHAMSA; c < CUR_COUNT; c++) H.currency[c] = 1 + c % 3;
        H.weapon() = make_unique(find_unique("qadis_gavel"), 14, r);
        H.equip[EQ_BODY] = make_item(find_base("riveted_breastplate"), Rarity::Rare, 14, r);
        H.equip[EQ_HELMET] = make_item(find_base("riveted_cap"), Rarity::Magic, 14, r);
        H.equip[EQ_HELMET].affixes.resize(1);
        H.inv.add(make_unique(find_unique("tram_driver"), 12, r));
        H.inv.add(make_item(find_base("brass_ring"), Rarity::Rare, 14, r));
        w.recompute_hero();
        m.show_bench(w);
    }
    // the bench: walk down the recipes, choose one, cross to the helmet
    if (frame > 20 && frame < 120 && frame % 20 == 0) press(in, BTN_DOWN);
    if (at(140)) press(in, BTN_SOUTH);
    if (at(170)) press(in, BTN_RIGHT);
    if (at(180)) press(in, BTN_UP);
    if (at(260)) press(in, BTN_SOUTH);
    if (at(300)) { m.hide(); m.show(w, false); }
    // the purse: the new currencies, and an Omen read
    if (at(320)) press(in, BTN_DOWN);
    if (frame > 330 && frame < 480 && frame % 12 == 0) press(in, BTN_RIGHT);
    if (at(560)) press(in, BTN_SOUTH);
    // Ascendancy, then the Journal
    if (at(620)) press(in, BTN_R1);
    if (at(630)) press(in, BTN_R1);
    if (at(640)) press(in, BTN_R1);
    if (at(660)) press(in, BTN_UP);
    if (at(680)) press(in, BTN_SOUTH);
    if (at(700)) press(in, BTN_UP);
    if (at(720)) press(in, BTN_SOUTH);
    if (at(800)) press(in, BTN_R1);
    if (at(820)) press(in, BTN_RIGHT);
    if (at(900)) press(in, BTN_RIGHT);
    if (at(920)) press(in, BTN_DOWN);
    if (frame > 1000) {
        if (!(H.asc & 0x6) && !(H.asc & 0x18)) { fail("tour4: no ascendancy node was taken"); return; }
        pass("tour4 done");
    }
}

// ---------------------------------------------------------------- act1: the whole act, from a fresh character
bool Bot::upgrade(World& w, const Item& it) {
    for (auto& j : judged_) if (j.first == it.seed) return j.second;
    Hero& H = w.hero;
    int slot = equip_slot_for(it, H.equip);
    bool up = false;
    if (slot >= 0) {
        HeroSummary now = summarize(H);
        Hero t = H;
        t.equip[slot] = it;
        HeroSummary then = summarize(t);
        up = (then.ehp > now.ehp * 1.04f && then.dps >= now.dps * 0.97f) || (then.dps > now.dps * 1.04f && then.ehp >= now.ehp * 0.97f);
    }
    judged_.push_back({it.seed, up});
    return up;
}

void Bot::act1(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    struct Step { const char* zone; uint32_t quest; };
    static const Step order[] = {{"downtown", Q_MICROBUS}, {"metro", Q_SILAH}, {"khan", Q_BENCH}, {"muizz", Q_NASNAS},
                                 {"bab_zuweila", Q_TRIAL1}, {"necropolis", Q_GHULA}, {"mokattam", Q_QUTRUB}};
    if (frame == 1) {
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        fprintf(stderr, "act1: a fresh %s, %zu stars planned\n", H.passives.cls.c_str(), H.plan.size());
    }
    if (frame > 60ull * 60 * 50) { fail("Act I took longer than 50 minutes of play"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            fprintf(stderr, "act1: died in %s at t=%.0fs, level %d\n", a.name(), frame / 60.f, H.level);
            if (a.current == AreaId::Zone && a.zone.def == last_target_) zone_deaths_++;
        }
        if (deaths > 30) fail("died more than 30 times");
        return;
    }
    int target = -1;
    for (const Step& st : order)
        if (!(H.quests & st.quest)) { target = find_zone(st.zone); break; }
    if (target < 0) {
        if (!(H.quests & Q_ACT1)) { fail("every boss fell but Act I is not marked over"); return; }
        if (!(H.asc & ~1u)) { fail("the trial was passed but no ascendancy node was taken"); return; }
        char b[200];
        snprintf(b, sizeof b, "Act I done: level %d, %d deaths, %d kills, %.1f minutes, %d zones, %d recipes, %d poster scraps", H.level,
                 deaths, H.kills, frame / 3600.f, act_zones_, __builtin_popcount(H.recipes), [&] { int n = 0; for (auto s : H.scraps) n += s; return n; }());
        pass(b);
        return;
    }
    // a wall: after four deaths at one zone, go back to the deepest zone behind us and gain a level there
    if (target != last_target_) { last_target_ = target; zone_deaths_ = 0; }
    if (zone_deaths_ >= 4 && grind_zone_ < 0) {
        for (size_t i = 0; i < zone_defs().size(); i++)
            if ((H.waypoints >> i & 1) && !zone_defs()[i].trial && zone_defs()[i].level < zone_def(target).level &&
                (grind_zone_ < 0 || zone_defs()[i].level > zone_def(grind_zone_).level))
                grind_zone_ = int(i);
        grind_until_ = H.level + 1;
        zone_deaths_ = 0;
        if (grind_zone_ >= 0) fprintf(stderr, "act1: walled at %s; back to %s until level %d\n", zone_def(target).name, zone_def(grind_zone_).name, grind_until_);
    }
    if (grind_zone_ >= 0 && H.level >= grind_until_) { fprintf(stderr, "act1: level %d; back to the act\n", H.level); grind_zone_ = -1; }
    const bool grinding = grind_zone_ >= 0;
    if (grinding) target = grind_zone_;
    // spend what we have earned: stars along the plan (then any free neighbour), ascendancy nodes
    if (!m.open && frame % 20 == 0 && H.passive_points() > 0) {
        if (place_next_planned(w) < 0) {
            for (size_t i = 0; i < tree().stars.size(); i++)
                if (tree().stars[i].kind != StarKind::Keystone && H.passives.can_take(int(i))) { plan_to(H, int(i)); break; }
        }
    }
    if (!m.open && frame % 20 == 10 && H.asc_points() > 0)
        if (const Ascendancy* asc = ascendancy_for(H.passives.cls))
            for (size_t i = 1; i < asc->nodes.size(); i++)
                if (asc_can_take(*asc, H.asc, int(i))) { H.asc |= 1u << i; w.recompute_hero(); fprintf(stderr, "act1: ascended: %s\n", asc->nodes[i].name); break; }
    // screens that open on the way: the bench (look, and leave), the loot menu, the waypoint list
    if (m.open && m.bench) { if (frame % 20 == 0) press(in, BTN_EAST); return; }
    if (m.open || equip_target) { loot_and_equip(w, m, in, frame); return; }
    if (wp_ui && wp_ui->open) {
        int idx = -1;
        for (size_t i = 0; i < wp_ui->items.size(); i++) if (wp_ui->items[i] == target) idx = int(i);
        if (idx < 0) { fail(std::string("no waypoint to ") + zone_def(target).name); return; }
        if (frame % 8 == 0) press(in, wp_ui->cursor == idx ? BTN_SOUTH : BTN_DOWN);
        return;
    }
    bool in_zone = a.current == AreaId::Zone;
    if (!in_zone) {   // the rooftop: down the stair to the waypoint list
        go_to_interact(w, in, frame, Interactable::Stair);
        return;
    }
    const ZoneLayout& L = a.zone.layout;
    if (a.zone.seed != act_seed_) {
        act_seed_ = a.zone.seed;
        visited_.assign(L.cells.size(), 0);
        act_zone_frame_ = act_moved_frame_ = frame;
        act_last_pos_ = h.pos;
        act_goal_ = -1;
        act_zones_++;
        fprintf(stderr, "act1: t=%.0fs %s (area level %d): hero level %d, life %.0f, dps %.0f\n", frame / 60.f, a.name(), w.area_level, H.level,
                h.life_max, summarize(H).dps);
    }
    int here = L.cell_index_at(h.pos);
    if (here >= 0) visited_[size_t(here)] = 1;
    if (a.zone.def != target) {   // done here: the way on, or home by portal
        if (combat(w, in, frame, 8.f)) return;
        for (auto& it : w.interacts)
            if ((it.kind == Interactable::Next || it.kind == Interactable::Gate) && it.target == target) { go_to_interact(w, in, frame, it.kind); return; }
        if (go_to_interact(w, in, frame, Interactable::Portal)) return;
        if (frame % 30 == 0) press(in, BTN_UP);
        return;
    }
    const ZoneDef& zd = zone_def(a.zone.def);
    const Actor* boss = nullptr;
    for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
    if (grinding && !boss && a.zone.cleared) {   // swept and its boss dead: that is all this zone has; home, and back again
        bool left = false;
        for (size_t i = 0; i < L.cells.size(); i++) left = left || (!visited_[i] && int(i) != L.arena);
        if (!left) { grind_zone_ = -1; fprintf(stderr, "act1: %s is spent at level %d; back to the act\n", a.name(), H.level); return; }
    }
    if (combat(w, in, frame, boss && boss->ai_state > 0 ? 30.f : 9.f)) { act_moved_frame_ = frame; act_last_pos_ = h.pos; return; }
    if (loot_and_equip(w, m, in, frame)) return;
    // a stuck walk: give up on that goal
    if (length(h.pos - act_last_pos_) > 1.5f) { act_last_pos_ = h.pos; act_moved_frame_ = frame; }
    if (frame - act_moved_frame_ > 60 * 15 && act_goal_ >= 0) {
        fprintf(stderr, "act1: stuck on the way to cell %d in %s; trying elsewhere\n", act_goal_, a.name());
        visited_[size_t(act_goal_)] = 1;
        act_moved_frame_ = frame;
    }
    if (std::string(zd.landmark) == "bench" && !(H.quests & Q_BENCH)) {
        if (!go_to_interact(w, in, frame, Interactable::Bench)) steer(w, in, L.center(L.cells[size_t(L.landmark)]));
        return;
    }
    for (auto& it : w.interacts)   // the landmark's cache: a recipe, and a little gear
        if (it.kind == Interactable::Chest && !it.spent) {
            if (L.cell_index_at(h.pos) == L.cell_index_at(it.pos)) go_to_interact(w, in, frame, Interactable::Chest);
            else steer(w, in, it.pos);
            act_goal_ = L.cell_index_at(it.pos);
            return;
        }
    // under-levelled for the boss: sweep the cells we have not walked yet (nearest first)
    if (H.level < zd.level + 1 || grinding) {
        int best = -1;
        float bd = 1e9f;
        for (size_t i = 0; i < L.cells.size(); i++) {
            if (visited_[i] || int(i) == L.arena) continue;
            float d = length(L.center(L.cells[i]) - h.pos);
            if (d < bd) { bd = d; best = int(i); }
        }
        if (best >= 0) { act_goal_ = best; steer(w, in, L.center(L.cells[size_t(best)])); return; }
    }
    act_goal_ = L.arena;
    steer(w, in, L.center(L.cells[size_t(L.arena)]) + vec2{0, 1.f});
}

// ---------------------------------------------------------------- tour5: every Act I zone and its boss, for screenshots
void Bot::tour5(World& w, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"downtown", "metro", "khan", "muizz", "bab_zuweila", "necropolis", "mokattam"};
    const int n = 7, each = 260;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    if (frame == 1) {
        Rng r(5);
        H.level = 14;
        H.weapon() = make_unique(find_unique("quarry_king"), 14, r);
        H.equip[EQ_BODY] = make_item(find_base("riveted_breastplate"), Rarity::Rare, 14, r);
        H.equip[EQ_HELMET] = make_unique(find_unique("boxers_headguard"), 14, r);
        H.asc = 0x6;
        w.recompute_hero();
    }
    h.life = h.life_max;   // a tour, not a test: nothing dies here but monsters
    int k = int(frame - 2) / each, t = int(frame - 2) % each;
    if (k >= n) { pass("tour5 done"); return; }
    if (t == 0) {
        a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
        w.level.bind_gpu();
        fprintf(stderr, "tour5: %s at frame %llu\n", a.name(), (unsigned long long)frame);
    }
    if (t < 100) { in.lstick = {0, 0.4f}; return; }
    const ZoneLayout& L = a.zone.layout;
    if (t == 110) {   // skip ahead to the far court
        h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 14.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
    }
    if (t > 120) combat(w, in, frame, 30.f);
}

// ---------------------------------------------------------------- tour (screenshots)
void Bot::tour(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    auto at = [&](uint64_t f) { return frame == f; };
    if (at(1)) {
        // a character a few hours in
        Rng r(7);
        H.level = 6;
        H.gold = 342;
        for (int c = 0; c < CUR_COUNT; c++) H.currency[c] = 1 + (5 - c) * 2;
        H.weapon() = make_item(find_base("brass_maul"), Rarity::Rare, 7, r);
        H.equip[EQ_HELMET] = make_item(find_base("knit_cap"), Rarity::Magic, 6, r);
        H.equip[EQ_BODY] = make_item(find_base("work_coat"), Rarity::Rare, 6, r);
        H.equip[EQ_BOOTS] = make_item(find_base("laced_boots"), Rarity::Magic, 5, r);
        H.equip[EQ_RING1] = make_item(find_base("brass_ring"), Rarity::Magic, 6, r);
        H.equip[EQ_AMULET] = make_item(find_base("blue_bead_amulet"), Rarity::Rare, 7, r);
        const char* bag[] = {"mokattam_sledge", "wrapped_gloves", "tooled_belt", "brass_ring", "riveted_cap", "work_coat", "worn_maul"};
        Rarity rr[] = {Rarity::Rare, Rarity::Magic, Rarity::Rare, Rarity::Rare, Rarity::Magic, Rarity::Normal, Rarity::Magic};
        for (int i = 0; i < 7; i++) H.inv.add(make_item(find_base(bag[i]), rr[i], 8, r));
        w.recompute_hero();
        h.life = h.life_max;
        h.mana = h.mana_max;
        m.restock(w);
    }
    // the rooftop, then the menu tabs
    if (at(100)) press(in, BTN_START);
    if (frame > 110 && frame < 125 && m.open && frame % 8 == 0) press(in, BTN_RIGHT);   // walk onto the coat: its card
    if (at(200)) press(in, BTN_R1);
    if (at(260)) press(in, BTN_R1);
    if (at(320)) press(in, BTN_START);
    // Amm Sayed
    if (frame > 330 && frame < 600 && !m.open) go_to_interact(w, in, frame, Interactable::Vendor);
    if (frame > 330 && frame < 600 && m.open && frame % 8 == 0 && m.region == Region::Stock && m.cx < 4) press(in, BTN_RIGHT);
    if (at(600)) press(in, BTN_EAST);
    // down the stair
    if (frame > 610 && a.current == AreaId::Hub && !m.open) go_to_interact(w, in, frame, Interactable::Stair);
    if (a.current == AreaId::Zone) {
        if (stage == 0) { stage = 1; stage_frame = frame; }
        uint64_t t = frame - stage_frame;
        if (t == 200) press(in, BTN_DOWN);
        if (t == 300) press(in, BTN_DOWN);
        if (t == 320) {  // skip ahead to her court (a tour, not a test)
            const ZoneLayout& L = a.zone.layout;
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 20.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (t > 20 && t < 200) combat(w, in, frame, 9.f);
        if (t > 330) combat(w, in, frame, 30.f);
        if (t > 330 + 60 * 40) pass("tour done");
    }
    if (!h.alive() && h.dead_t > 1.3f && frame % 10 == 0) press(in, BTN_SOUTH);
    if (frame > 60 * 120) pass("tour done");
}

}  // namespace q
