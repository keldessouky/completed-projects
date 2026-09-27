#include "game/bots.hpp"
#include "game/save.hpp"
#include "platform/app_api.hpp"
#include <cstdio>
#include <cstdlib>
#include <vector>

namespace q {

void Bot::start(const char* s) { scenario = s ? s : ""; }

void Bot::drive(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    if (scenario.empty() || status != 0) return;
    now_ = frame;
    if (scenario == "walk") walk(w, in, frame);
    else if (scenario == "fight") fight(w, m, in, frame);
    else if (scenario == "zone") zone(w, m, a, in, frame);
    else if (scenario == "tour") tour(w, m, a, in, frame);
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
void Bot::steer(World& w, Input& in, vec2 target) {
    const Actor& h = w.actors[0];
    if (length(target - h.pos) < 0.4f) return;
    if (w.level.line_clear(h.pos, target, h.radius)) {
        in.lstick = normalize(target - h.pos);
        path_.clear();
        return;
    }
    if (path_.empty() || length(target - path_goal_) > 1.f || now_ - path_frame_ > 90) {
        w.level.find_path(h.pos, target, h.radius + 0.1f, path_);
        path_goal_ = target;
        path_frame_ = now_;
        path_i_ = 0;
    }
    while (path_i_ < path_.size() && length(path_[path_i_] - h.pos) < 0.6f) path_i_++;
    vec2 wp = path_i_ < path_.size() ? path_[path_i_] : target;
    if (length(wp - h.pos) > 1e-3f) in.lstick = normalize(wp - h.pos);
}

bool Bot::combat(World& w, Input& in, uint64_t frame, float reach) {
    Actor& h = w.actors[0];
    // step out of any telegraph we are standing in
    for (auto& g : w.ground) {
        if (g.kind != GroundFx::Telegraph) continue;
        vec2 d = h.pos - g.pos;
        float dist = length(d);
        bool inside = dist < g.radius + h.radius + 0.4f;
        if (inside && g.half < kPi - 0.01f) inside = std::fabs(wrap_angle(angle_of(d) - g.angle)) < g.half + 0.3f;
        if (!inside) continue;
        vec2 out = dist > 0.1f ? d / dist : from_angle(h.facing + kPi);
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
        if (!e.alive()) continue;
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
    if (length(d) > range) { steer(w, in, target->pos); return true; }
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
    auto grid_dir = [&]() { return m.cx != x ? (m.cx < x ? BTN_RIGHT : BTN_LEFT) : (m.cy < y ? BTN_DOWN : BTN_UP); };
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
    bool in_zone = a.current == AreaId::Necropolis;
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
            if (in_zone) { zone_kills0 = H.kills; zone_cells = int(L.cells.size()); next_stage(1); break; }
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
        case 7:  // gather what she dropped, then the portal home
            if (combat(w, in, frame, 8.f)) break;
            if (frame < boss_frame + 60 * 8 && loot_and_equip(w, m, in, frame)) break;
            if (!in_zone) { next_stage(8); break; }
            go_to_interact(w, in, frame, Interactable::Exit);
            break;
        case 8:  // home: the zone is finished; visit Amm Sayed
            if (a.zone.valid) { fail("the finished zone is still alive"); return; }
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
                     "hub -> City of the Dead (%d cells) -> portal round trip -> %s -> Umm al-Ghula (save state mid-fight ok) -> hub -> "
                     "vendor (sold %d, bought beads) in %.0fs; level %d, %d kills, %d dinars, weapon %s, %d items equipped through the inventory, deaths %d",
                     zone_cells, chest_done ? "the Lamplighter's cache" : "no cache", sold, frame / 60.f, H.level, H.kills, H.gold,
                     H.weapon().display_name().c_str(), equips, deaths);
            pass(b);
            break;
        }
    }
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
    if (a.current == AreaId::Necropolis) {
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
