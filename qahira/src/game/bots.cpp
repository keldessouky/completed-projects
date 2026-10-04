#include "game/bots.hpp"
#include "game/settings.hpp"
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
    if (frame % 1200 == 0) { ignored_.clear(); ignored_loot_.clear(); }   // what was out of reach may not be any more
    if (scenario == "walk") walk(w, in, frame);
    else if (scenario == "fight") fight(w, m, in, frame);
    else if (scenario == "zone" || scenario == "sorcerer") zone(w, m, a, in, frame);
    else if (scenario == "tour") tour(w, m, a, in, frame);
    else if (scenario == "sky") sky(w, in, frame);
    else if (scenario == "title") title(w, in, frame);
    else if (scenario == "tour3") tour3(w, m, a, in, frame);
    else if (scenario == "bestiary") bestiary(w, a, in, frame);
    else if (scenario == "tour4") tour4(w, m, a, in, frame);
    else if (scenario == "act1" || scenario == "act2" || scenario == "act3" || scenario == "act4" || scenario == "act5" || scenario == "act6")
        act1(w, m, a, in, frame);
    else if (scenario == "tour5") tour5(w, a, in, frame);
    else if (scenario == "charts" || scenario == "reaches") charts(w, m, a, in, frame);
    else if (pinnacle_run()) king(w, m, a, in, frame);
    else if (scenario == "tour6") tour6(w, a, in, frame);
    else if (scenario == "rifts") rifts(w, m, a, in, frame);
    else if (scenario == "tour7") tour7(w, m, a, in, frame);
    else if (scenario == "digs") digs(w, m, a, in, frame);
    else if (scenario == "zar") zar(w, m, a, in, frame);
    else if (scenario == "tour8") tour8(w, m, a, in, frame);
    else if (scenario == "tour9") tour9(w, m, a, in, frame);
    else if (scenario == "tour10") tour10(w, m, a, in, frame);
    else if (scenario == "tour11") tour11(w, m, a, in, frame);
    else if (scenario == "tour12") tour12(w, m, a, in, frame);
    else if (scenario == "gallery") gallery(w, m, a, in, frame);
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
    float d = length(e.pos - h.pos);
    // progress is getting closer: pacing back and forth on the far side of a wall is not
    if (e.id != chase_id_ || d < chase_best_ - 0.5f) { chase_id_ = e.id; chase_best_ = d; chase_frame_ = now_; }
    else if (now_ - chase_frame_ > 240 && !w.level.line_clear(h.pos, e.pos, 0.3f)) { ignored_.push_back(e.id); chase_id_ = 0; return; }
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
        case GroundFx::Fire: case GroundFx::Water:   // a player stands in a little fire to land hits; the pilots do too while healthy
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
    // wedged on a corner the nav grid cuts tighter than the colliders allow: sidestep, then find the way again
    if (length(h.pos - unstick_pos_) > 0.3f || now_ - unstick_frame_ > 600) { unstick_pos_ = h.pos; unstick_frame_ = now_; }
    else if (now_ - unstick_frame_ > 45) {
        vec2 d = normalize(target - h.pos);
        float side = (now_ / 90) % 2 ? 1.f : -1.f;
        in.lstick = normalize(vec2{-d.y, d.x} * side - d * 0.3f);
        path_.clear();
        if (now_ - unstick_frame_ > 75) { unstick_pos_ = h.pos; unstick_frame_ = now_; }
        return;
    }
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

vec2 Bot::keep_to_court(const World& w, vec2 dir) const {
    const Actor& h = w.actors[0];
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& b = w.actors[i];
        if (b.rarity != Rarity::Unique || !b.alive() || length(h.pos - b.home) < 14.f) continue;
        vec2 home = normalize(b.home - h.pos), side{-dir.y, dir.x};
        if (dot(side, home) < 0) side = -side;
        dir = normalize(dir + side * 1.4f + home * 0.5f);
    }
    return dir;
}

// the Sorcerer's way (and the Ranger's): keep 5-9 m away, a glyph under the pack, Arc into crowds, the star on anything chilled
bool Bot::caster_combat(World& w, Input& in, uint64_t frame, float reach) {
    Actor& h = w.actors[0];
    for (auto& g : w.ground) {  // step out of telegraphs first, as the melee pilot does
        vec2 out;
        float dist;
        if (!in_danger(g, h, out, dist)) continue;
        // the Shadow's snares go down in a moment: a cone is traded while there is life to spare, or a boss that swings at
        // everything in reach is never hit
        if (w.hero.passives.cls == "shadow" && g.kind == GroundFx::Telegraph && g.half < kPi - 0.01f && h.life > h.life_max * 0.6f) continue;
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
        if (!e.alive() || (unreachable(e.id) && length(e.pos - h.pos) > 3.f)) continue;
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
        in.lstick = keep_to_court(w, normalize(-d));
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
    if (w.hero.passives.cls == "shadow") {   // (a boss) snares at its feet, Black Sand between
        if (ready(1)) press(in, BTN_WEST);
        else if (ready(2)) press(in, BTN_NORTH);
        return true;
    }
    if (w.hero.passives.cls == "ranger") {   // mark the strong, rain on crowds, sting the tough, and split the rest
        bool tough = target->rarity >= Rarity::Rare;
        if (ready(1) && tough && target->mark_t <= 0) press(in, BTN_WEST);                                          // Falcon's Mark
        else if (ready(2) && crowd >= 3 && dist < 10.f) press(in, BTN_NORTH);                                        // Rain of Arrows
        else if (ready(3) && tough) press(in, BTN_R1);                                                               // Scorpion Sting
        else if (ready(0)) press(in, BTN_SOUTH);                                                                     // Split Arrow
        else if (ready(3)) press(in, BTN_R1);
        return true;
    }
    bool chilled = target->chill_t > 0 || target->frozen_t > 0;
    if (ready(2) && (crowd >= 2 || target->rarity >= Rarity::Rare) && dist < 7.5f) press(in, BTN_NORTH);            // Frost Glyph
    else if (ready(3) && (chilled || target->rarity >= Rarity::Rare) && dist < 9.f) press(in, BTN_R1);             // Falling Star
    else if (ready(1) && crowd >= 2) press(in, BTN_WEST);                                                            // Arc
    else if (ready(0)) press(in, BTN_SOUTH);                                                                         // Ember Bolt
    else if (ready(1)) press(in, BTN_WEST);
    return true;
}

bool Bot::combat(World& w, Input& in, uint64_t frame, float reach) {
    if (w.hero.passives.cls == "sorcerer" || w.hero.passives.cls == "ranger") return caster_combat(w, in, frame, reach);
    Actor& h = w.actors[0];
    if (w.chart_site >= 0) {   // a site's master, too hurt to trade and the flask dry: back off out of its reach until life comes back
        const Actor* boss = nullptr;   // (a chart's level-14 master is the one fight where dodging forever at half life stalls a run)
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive() && length(w.actors[i].pos - h.pos) < 16.f) boss = &w.actors[i];
        if (!boss || h.life > h.life_max * 0.9f || (recovering_ && frame - recover_frame_ > 900)) recovering_ = false;   // (15 s at most:
        else if (h.life < h.life_max * 0.55f && w.hero.flask < 1 && frame - recover_frame_ > 1800) {                  //  a master that
            recovering_ = true;                                                                                       //  reaches far
            recover_frame_ = frame;                                                                                   //  never lets it
        }                                                                                                             //  come back)
        if (recovering_ && boss) {
            if (h.act == Act::Idle) {
                vec2 away = normalize(h.pos - boss->pos + vec2{0.01f, 0}), side{-away.y, away.x};
                if (!w.level.line_clear(h.pos, h.pos + away * 3.f, h.radius))
                    away = w.level.line_clear(h.pos, h.pos + side * 3.f, h.radius) ? side : -side;
                in.lstick = away;
                if (length(boss->pos - h.pos) < 3.5f && frame % 40 == 0) press(in, BTN_EAST);
            }
            return true;
        }
    }
    if (w.hero.passives.cls == "shadow" && h.mana >= 14.f)   // the Shadow has not the life to stand in front of a boss: kite it
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive() && length(w.actors[i].pos - h.pos) < reach + 2.f)
                return caster_combat(w, in, frame, reach);
    // step out of any telegraph we are standing in
    for (auto& g : w.ground) {
        vec2 out;
        float dist;
        if (!in_danger(g, h, out, dist)) continue;
        // a boss's swing (a cone) is traded, as a player does, while there is life to spare; circles and charges are not
        if (g.kind == GroundFx::Telegraph && g.half < kPi - 0.01f && h.life > h.life_max * 0.6f &&
            w.hero.passives.cls != "shadow") continue;   // (the Shadow has not the life to)
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
        // too hurt to trade blows (below 60%) but not yet at the flask's usual mark: drink, or it only ever dodges
        if (h.life < h.life_max * 0.6f && w.hero.flask >= 1 && frame % 20 == 0) press(in, BTN_L3);
        return true;
    }
    const Actor* target = nullptr;
    float best = 1e9f;
    int near = 0;
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& e = w.actors[i];
        if (!e.alive() || (unreachable(e.id) && length(e.pos - h.pos) > 3.f)) continue;
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
    if (w.hero.passives.cls == "mercenary") {   // bolts at range, a pot on a crowd, cut them bleeding, then open the wound
        auto ready = [&](int slot) {
            SkillCtx c = w.slot_ctx(slot);
            return c.def && w.hero.cooldowns[slot] <= 0 && h.mana >= c.mana &&
                   (c.usable || (c.needs_weapon && (w.hero.equip[EQ_WEAPON2].weapon().tags & skill_weapon_need(*c.def))));
        };
        const float dist = length(d);
        const bool tough = target->rarity >= Rarity::Rare;
        int crowd = 0;
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].alive() && length(w.actors[i].pos - target->pos) < 3.f) crowd++;
        const bool clear = w.level.line_clear(h.pos, target->pos, 0.2f);
        if (frame % 2) return true;
        in.rstick = normalize(d);
        if (ready(2) && (crowd >= 3 || tough) && dist < 9.f && clear) { press(in, BTN_NORTH); return true; }        // Naffata
        if (dist > range) {
            // Quarrel for what keeps its distance or runs; a boss is fought up close, where the sword is
            const bool ranged = target->def >= 0 && monster_defs()[size_t(target->def)].keep_distance > 0;
            if (ready(3) && dist < 12.f && clear && target->rarity != Rarity::Unique && (ranged || dist > 5.f)) { press(in, BTN_R1); return true; }
            chase(w, in, *target);
            return true;
        }
        in.lstick = normalize(d) * 0.3f;
        if (ready(1) && target->bleed_t > 1.f && (tough || target->life > target->life_max * 0.4f)) press(in, BTN_WEST);   // Riposte
        else if (ready(0)) press(in, BTN_SOUTH);                                                                               // Crescent Cut
        return true;
    }
    if (w.hero.passives.cls == "templar") {   // the beacon up, a brazier by the tough or a crowd, a slam into a pack, the burning strike
        auto ready = [&](int slot) {
            SkillCtx c = w.slot_ctx(slot);
            return c.def && w.hero.cooldowns[slot] <= 0 && h.mana >= c.mana && c.usable;
        };
        const float dist = length(d);
        const bool tough = target->rarity >= Rarity::Rare;
        int crowd = 0, totems = 0;
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].alive() && length(w.actors[i].pos - target->pos) < 3.f) crowd++;
        for (auto& g : w.ground) totems += g.kind == GroundFx::Totem && g.t < g.life;
        if (getenv("QAHIRA_BOT_TRACE") && frame % 120 == 0)
            fprintf(stderr, "templar: %s dist %.1f life %.0f/%.0f act %d clear %d crowd %d totems %d mana %.0f aura %d\n", target->name.c_str(), dist,
                    target->life, target->life_max, int(target->act), int(w.level.line_clear(h.pos, target->pos, 0.2f)), crowd, totems, h.mana,
                    int(w.hero.aura));
        if (frame % 2) return true;
        in.rstick = normalize(d);
        if (!w.hero.aura && ready(1)) { press(in, BTN_WEST); return true; }                                              // the Beacon
        if (ready(2) && totems == 0 && (tough || crowd >= 3) && dist < 7.f) { press(in, BTN_NORTH); return true; }       // Signal Fire
        if (dist > range) { chase(w, in, *target); return true; }
        in.lstick = normalize(d) * 0.3f;
        if (ready(3) && (crowd >= 3 || tough)) press(in, BTN_R1);   // Brazier Slam
        else if (ready(0)) press(in, BTN_SOUTH);                    // Ember Strike
        else if (ready(3)) press(in, BTN_R1);
        else if (ready(2) && totems == 0) press(in, BTN_NORTH);     // (a strike he has not the Strength for: the brazier fights)
        return true;
    }
    if (w.hero.passives.cls == "wanderer") {   // a Mark on the tough, a shout into the crowd, Arc at range, the staff up close
        auto ready = [&](int slot) {
            SkillCtx c = w.slot_ctx(slot);
            return c.def && w.hero.cooldowns[slot] <= 0 && h.mana >= c.mana && c.usable;
        };
        const float dist = length(d);
        const bool tough = target->rarity >= Rarity::Rare;
        int crowd = 0;
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].alive() && length(w.actors[i].pos - target->pos) < 3.f) crowd++;
        const bool clear = w.level.line_clear(h.pos, target->pos, 0.2f);
        if (frame % 2) return true;
        in.rstick = normalize(d);
        if (ready(2) && (crowd >= 3 || tough) && dist < 5.f) { press(in, BTN_NORTH); return true; }                 // Rallying Shout
        if (ready(3) && tough && target->mark_t <= 0 && dist < 13.f && clear && frame - mark_frame_ > 480) {           // Falcon's Mark
            mark_frame_ = frame;   // (once in eight seconds: its three crits are spent in a moment, and every cast is a swing lost)
            press(in, BTN_R1);
            return true;
        }
        if (dist > range) {
            const bool ranged = target->def >= 0 && monster_defs()[size_t(target->def)].keep_distance > 0;
            if (ready(1) && dist < 10.f && clear && (ranged || crowd >= 3)) { press(in, BTN_WEST); return true; }   // Arc
            chase(w, in, *target);
            return true;
        }
        in.lstick = normalize(d) * 0.3f;
        if (ready(0)) press(in, BTN_SOUTH);        // Whirling Staff
        else if (ready(1)) press(in, BTN_WEST);
        return true;
    }
    if (w.hero.passives.cls == "shadow") {   // Black Sand on the tough, a snare on a crowd, the staff when surrounded, the knife
        auto ready = [&](int slot) {
            SkillCtx c = w.slot_ctx(slot);
            return c.def && w.hero.cooldowns[slot] <= 0 && h.mana >= c.mana &&
                   (c.usable || (c.needs_weapon && (w.hero.equip[EQ_WEAPON2].weapon().tags & skill_weapon_need(*c.def))));
        };
        const float dist = length(d);
        const bool tough = target->rarity >= Rarity::Rare;
        int crowd = 0;
        for (size_t i = 1; i < w.actors.size(); i++)
            if (w.actors[i].alive() && length(w.actors[i].pos - target->pos) < 3.f) crowd++;
        const bool clear = w.level.line_clear(h.pos, target->pos, 0.2f);
        if (frame % 2) return true;
        in.rstick = normalize(d);
        if (ready(1) && (crowd >= 3 || tough) && dist < 8.f && clear) { press(in, BTN_WEST); return true; }         // Snare of Sparks
        if (ready(2) && tough && target->wither < 4 && dist < 11.f && clear) { press(in, BTN_NORTH); return true; }  // Black Sand
        if (dist > range) {
            const bool ranged = target->def >= 0 && monster_defs()[size_t(target->def)].keep_distance > 0;
            if (ready(2) && ranged && dist < 11.f && clear) { press(in, BTN_NORTH); return true; }
            chase(w, in, *target);
            return true;
        }
        in.lstick = normalize(d) * 0.3f;
        if (ready(3) && near >= 3) press(in, BTN_R1);   // Whirling Staff
        else if (ready(0)) press(in, BTN_SOUTH);        // Viper's Kiss
        return true;
    }
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
        {   // the way the menu itself moves (a whole item is one stop), searched breadth first; the old rule below if that fails
            auto hop = [&](int x, int y, int dx, int dy, int& ox, int& oy) {
                int start = g.at(x, y), nx = x + dx, ny = y + dy;
                while (start >= 0 && nx >= 0 && ny >= 0 && nx < Inventory::W && ny < Inventory::H && g.at(nx, ny) == start) { nx += dx; ny += dy; }
                if (nx < 0 || ny < 0 || nx >= Inventory::W || ny >= Inventory::H) return false;
                if (int it = g.at(nx, ny); it >= 0) { nx = g.items[size_t(it)].x; ny = g.items[size_t(it)].y; }
                ox = nx;
                oy = ny;
                return true;
            };
            const int want = g.at(x, y);
            auto goal = [&](int px, int py) { return want >= 0 ? g.at(px, py) == want : (px == x && py == y); };
            const Btn dirs[4] = {BTN_RIGHT, BTN_LEFT, BTN_DOWN, BTN_UP};
            const int ddx[4] = {1, -1, 0, 0}, ddy[4] = {0, 0, 1, -1};
            int first[Inventory::W * Inventory::H];
            std::fill(std::begin(first), std::end(first), -1);
            std::vector<int> q{m.cy * Inventory::W + m.cx};
            first[q[0]] = 4;
            for (size_t qi = 0; qi < q.size(); qi++) {
                int px = q[qi] % Inventory::W, py = q[qi] / Inventory::W;
                if (goal(px, py) && qi > 0) return dirs[first[q[qi]]];
                for (int d = 0; d < 4; d++) {
                    int ox, oy;
                    if (!hop(px, py, ddx[d], ddy[d], ox, oy) || first[oy * Inventory::W + ox] >= 0) continue;
                    first[oy * Inventory::W + ox] = qi == 0 ? d : first[q[qi]];
                    q.push_back(oy * Inventory::W + ox);
                }
            }
        }
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
        case Region::Bench: b = BTN_RIGHT; break;   // out of the recipe list, into your belongings
    }
    if (b != BTN_COUNT) press(in, b);
    return false;
}

// A weapon is better only for the same skill: rated against the hand's weapon by the skill that weapon is rated by (a staff
// that makes a spell strong does nothing for the knife the pilot fights with)
static bool same_skill_better(const World& w, const Item& cand, const Item& hand, float margin) {
    const char* now_skill = nullptr;
    const char* new_skill = nullptr;
    const float now = w.hero_dps(hand, &now_skill), d = w.hero_dps(cand, &new_skill);
    if (now_skill && (!new_skill || std::string(now_skill) != new_skill)) return false;
    return d > now + margin;
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
        // one it cannot reach (a nook, another drop always selected first): left after six seconds, like any other
        if (loot_seed_ != equip_target) { loot_seed_ = equip_target; loot_frame_ = frame; }
        else if (frame - loot_frame_ > 360) { ignored_loot_.push_back(equip_target); equip_target = 0; loot_seed_ = 0; return false; }
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
        if (std::find(ignored_loot_.begin(), ignored_loot_.end(), g.item.seed) != ignored_loot_.end()) continue;
        int x, y;
        if (!H.inv.find_space(g.item, x, y)) continue;
        int slot = equip_slot_for(g.item, H.equip);
        // an archer keeps to bows, a Mercenary to the sword or crossbow in hand, and the others to mauls and staves
        auto own = [](uint8_t k) { return k == WK_BOW || k == WK_SWORD || k == WK_CROSSBOW; };
        // it is compared with the weapon of its own kind, in hand or on the back
        const Item& same = !H.equip[EQ_WEAPON2].empty() && H.equip[EQ_WEAPON2].b().wkind == g.item.b().wkind ? H.equip[EQ_WEAPON2] : H.weapon();
        const uint8_t hk = same.b().wkind, gk = g.item.b().wkind;
        bool better = g.item.b().slot == Slot::Weapon && same_skill_better(w, g.item, same, 0.5f) && (hk == gk || (!own(hk) && !own(gk)));
        bool fills = slot > EQ_WEAPON && H.equip[slot].empty();
        if (g.item.b().slot == Slot::Chart) {   // charts are the endgame's currency: always worth the space
            float d = length(g.pos - h.pos);
            if (d < bd) { bd = d; best = int(i); best_equip = false; }
            continue;
        }
        if (scenario == "act1" || scenario == "act2" || scenario == "act3" || scenario == "act4" || scenario == "act5" || scenario == "act6" ||
            scenario == "charts" ||
            scenario == "zar" || scenario == "reaches" || pinnacle_run()) {   // the long runs keep their bags for upgrades only
            if (slot < 0 || slot == H.sealed_slot) continue;
            better = better || (slot > EQ_WEAPON && upgrade(w, g.item));
            if (!better && !fills) continue;
        }
        if (!better && !fills && g.item.rarity < Rarity::Magic) continue;  // magic and up: to wear or to sell
        float d = length(g.pos - h.pos);
        if (d < bd) { bd = d; best = int(i); best_equip = better || fills; }
    }
    if (best < 0) return false;
    // a drop we cannot get to (a nook the hero does not fit, another drop always nearer): leave it after four seconds
    if (w.loot[size_t(best)].item.seed != loot_seed_) { loot_seed_ = w.loot[size_t(best)].item.seed; loot_frame_ = frame; }
    else if (frame - loot_frame_ > 240) { ignored_loot_.push_back(loot_seed_); loot_seed_ = 0; return false; }
    if (best_equip) { equip_target = w.loot[size_t(best)].item.seed; return true; }
    if (w.selected_loot == best) { if (frame % 6 == 0) press(in, BTN_LEFT); }
    else {
        // another drop on top of it is the one the field selects: step past, to the wanted one's far side
        vec2 p = w.loot[size_t(best)].pos;
        if (w.selected_loot >= 0 && length(w.loot[size_t(w.selected_loot)].pos - p) < 1.2f) {
            vec2 away = p - w.loot[size_t(w.selected_loot)].pos;
            p += (length(away) > 0.01f ? normalize(away) : vec2{0, 1}) * 0.7f;
        }
        steer(w, in, p);
    }
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
bool Bot::go_to_interact(World& w, Input& in, uint64_t frame, Interactable::Kind k, int target) {
    for (size_t i = 0; i < w.interacts.size(); i++) {
        const Interactable& it = w.interacts[i];
        if (it.kind != k || it.spent || (target >= 0 && it.target != target)) continue;
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
    // a save state in the middle of the boss fight, wherever it happens (with no landmark the first walk meets him)
    auto boss_save_state = [&]() {
        const Actor* boss = nullptr;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
        if (!in_zone || !boss || boss_state_ok || boss->ai_state <= 0 || boss->life >= boss->life_max * 0.97f || boss->act == Act::Skill) return true;
        float life = boss->life;
        int phase = boss->phase;
        if (!state_round_trip(w)) { fail("save state in the middle of the boss failed"); return false; }
        const Actor* b2 = nullptr;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique) b2 = &w.actors[i];
        if (!b2 || b2->life != life || b2->phase != phase) { fail("the boss did not survive the save state"); return false; }
        boss_state_ok = true;
        fprintf(stderr, "bot: save state mid-boss ok (boss life %.0f / %.0f)\n", life, boss->life_max);
        return true;
    };
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
            if (!boss_save_state()) return;
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
            if (!boss_save_state()) return;
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

// On the rooftop: the best weapon Amm Sayed has for the gold we carry, if it beats the one in hand, bought and worn. Each
// stock is looked through once (it changes every time we come home).
bool Bot::shop_weapon(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Hero& H = w.hero;
    if (a.current != AreaId::Hub) return false;
    if (m.open && m.vendor && !m.dealer) {
        int want = -1;
        for (size_t i = 0; i < m.stock.items.size(); i++) if (m.stock.items[i].item.seed == shop_want_) want = int(i);
        if (want < 0) {   // bought (or gone): leave, and wear it
            for (auto& e : H.inv.items) if (e.item.seed == shop_want_) equip_target = shop_want_;
            shop_want_ = 0;
            if (frame % 4 == 0) press(in, BTN_EAST);
            return true;
        }
        if (++menu_guard > 1200) { shop_want_ = 0; press(in, BTN_EAST); return true; }
        const InvItem& e = m.stock.items[size_t(want)];
        if (H.gold < Menu::buy_price(e.item)) { shop_want_ = 0; return true; }
        if (menu_nav(w, m, in, frame, Region::Stock, e.x, e.y) && frame % 4 == 0) press(in, BTN_SOUTH);
        return true;
    }
    if (m.open || equip_target) return false;
    if (!shop_want_) {
        if (m.stock.items.empty() || m.stock.items[0].item.seed == shop_seen_) return false;
        shop_seen_ = m.stock.items[0].item.seed;
        const float now = w.hero_dps(H.weapon());
        float best = now * 1.08f;
        for (auto& e : m.stock.items) {
            if (e.item.b().slot != Slot::Weapon || Menu::buy_price(e.item) > H.gold) continue;
            int x, y;
            if (!H.inv.find_space(e.item, x, y) || !same_skill_better(w, e.item, H.weapon(), 0.f)) continue;
            const float d = w.hero_dps(e.item);
            if (d > best) { best = d; shop_want_ = e.item.seed; }
        }
        if (!shop_want_) return false;
        menu_guard = 0;
        fprintf(stderr, "bot: shopping for a weapon (%.0f dps against %.0f), %d dinars\n", best, now, H.gold);
    }
    if (!go_to_interact(w, in, frame, Interactable::Vendor)) shop_want_ = 0;
    return true;
}

void Bot::act1(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    // each step is a zone and what finishes it: its quest, or (0) the way on to the next zone found
    // side: the step ends at the zone's side gate (a trial off a zone with no boss), not its way on
    struct Step { const char* zone; uint32_t quest; bool side = false; };
    static const Step order1[] = {{"downtown", Q_MICROBUS}, {"metro", Q_SILAH}, {"khan", Q_BENCH}, {"muizz", Q_NASNAS},
                                  {"bab_zuweila", Q_TRIAL1}, {"necropolis", Q_GHULA}, {"mokattam", Q_QUTRUB}};
    static const Step order2[] = {{"nile_bank", 0}, {"village", 0}, {"canal", Q_NADDAHA}, {"karnak", Q_RAM}, {"valley", 0},
                                  {"tomb", Q_MARID}};
    static const Step order3[] = {{"farafra", 0}, {"sand_sea", Q_DABA}, {"siwa", 0, true}, {"bab_futuh", Q_TRIAL2}, {"siwa", 0},
                                  {"shali", 0}, {"oracle", Q_WRAITH}};
    static const Step order4[] = {{"ghadames", 0}, {"chott", Q_SARAB}, {"tozeur", 0}, {"medina", Q_DOOR}, {"souq", 0}, {"sebkha", Q_SALT}};
    static const Step order5[] = {{"fes", 0}, {"fes_bali", 0}, {"chaouen", Q_PRESSER}, {"jemaa", Q_SMOKE}, {"bab_nasr", Q_TRIAL3},
                                  {"tangier", 0}, {"strait", Q_QANDISHA}};
    static const Step order6[] = {{"balad", 0}, {"harbour", Q_DUWAIS}, {"shibam", Q_SHIQQ}, {"rub", 0}, {"wabar", Q_HATIF}, {"iram", Q_HORSEMAN},
                                  {"totality", Q_ACT6}, {"gate_iram", Q_TRIAL4}};
    const int act = scenario == "act6" ? 6 : scenario == "act5" ? 5 : scenario == "act4" ? 4 : scenario == "act3" ? 3 : scenario == "act2" ? 2 : 1;
    const bool two = act >= 2;
    const Step* order = act == 6 ? order6 : act == 5 ? order5 : act == 4 ? order4 : act == 3 ? order3 : two ? order2 : order1;
    const size_t steps = act == 6 ? std::size(order6) : act == 5 ? std::size(order5) : act == 4 ? std::size(order4) : act == 3 ? std::size(order3)
                       : two ? std::size(order2) : std::size(order1);
    static const char* tags[] = {"", "act1", "act2", "act3", "act4", "act5", "act6"};
    const char* tag = tags[act];
    static const char* roman[] = {"", "I", "II", "III", "IV", "V", "VI"};
    auto step_done = [&](const Step& st) {
        if (st.quest) return (H.quests & st.quest) != 0;
        const ZoneDef& zd = zone_def(find_zone(st.zone));
        int next = find_zone(st.side ? zd.side : zd.next);
        return next >= 0 && H.waypoints.has(next);
    };
    if (frame == 1) {
        if (H.plan.empty()) if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        fprintf(stderr, "%s: a %s at level %d, %zu stars planned\n", tag, H.passives.cls.c_str(), H.level, H.plan.size());
    }
    if (frame > 60ull * 60 * 50) { fail(std::string("Act ") + roman[act] + " took longer than 50 minutes of play"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            const char* by = "?";
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].id == H.last_attacker && w.actors[i].def >= 0) by = monster_defs()[size_t(w.actors[i].def)].name;
            fprintf(stderr, "%s: died in %s at t=%.0fs, level %d, to %s\n", tag, a.name(), frame / 60.f, H.level, by);
            if (a.current == AreaId::Zone && a.zone.def == last_target_) zone_deaths_++;
        }
        if (deaths > 30) fail("died more than 30 times");
        return;
    }
    if (act == 6 && (H.quests & Q_ACT6) && H.ending == 0) {   // the choice at the heart of totality: the bot seals the Veil
        if (m.open || equip_target) { loot_and_equip(w, m, in, frame); return; }
        if (!go_to_interact(w, in, frame, Interactable::Veil) && frame % 600 == 0) fprintf(stderr, "act6: looking for the Veil\n");
        if (frame > 60ull * 60 * 49) fail("Apep fell but the Veil was never sealed");
        return;
    }
    if (act == 6 && a.current == AreaId::Zone && a.def() && std::string(a.def()->id) == "gate_iram" && H.sealed_slot < 0 && !m.open) {
        // the Fourth Trial asks a toll: the bot gives its body armour (a unique on top of the two points)
        if (go_to_interact(w, in, frame, Interactable::Toll, EQ_BODY)) return;
    }
    int target = -1;
    bool way_on = false;   // this step ends at the way on (or the side gate), not a quest
    bool via_side = false;
    for (size_t k = 0; k < steps; k++)
        if (!step_done(order[k])) { target = find_zone(order[k].zone); way_on = order[k].quest == 0; via_side = order[k].side; break; }
    if (target < 0 && two) {
        const uint32_t done = act == 6 ? Q_ACT6 : act == 5 ? Q_ACT5 : act == 4 ? Q_ACT4 : act == 3 ? Q_ACT3 : Q_ACT2;
        if (!(H.quests & done)) { fail(std::string("every boss fell but Act ") + roman[act] + " is not marked over"); return; }
        if (act == 6 && H.ending != 1) { fail("the Veil was not sealed"); return; }
        if (act == 6)   // the Fourth Trial's two points, spent as it ends (the pilot's usual spending comes later in the frame)
            if (const Ascendancy* asc = ascendancy_of(H.passives.cls, H.ascendancy))
                for (size_t i = 1; i < asc->nodes.size() && H.asc_points() > 0; i++)
                    if (asc_can_take(*asc, H.asc, int(i))) { H.asc |= 1u << i; fprintf(stderr, "%s: ascended: %s\n", tag, asc->nodes[i].name); }
        if (act == 6 && (__builtin_popcount(H.asc & ~1u) < 8 || H.asc_points() > 0)) {
            fail("Trial IV was passed but its ascendancy points were not spent");
            return;
        }
        if (act == 3 && __builtin_popcount(H.asc & ~1u) < 3) { fail("Trial II was passed but its ascendancy points were not spent"); return; }
        if (act == 5 && __builtin_popcount(H.asc & ~1u) < 5) { fail("Trial III was passed but its ascendancy points were not spent"); return; }
        char b[200];
        snprintf(b, sizeof b, "Act %s done: level %d, %d deaths, %d kills, %.1f minutes, %d zones", roman[act], H.level, deaths, H.kills,
                 frame / 3600.f, act_zones_);
        pass(b);
        return;
    }
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
            if (H.waypoints.has(int(i)) && !zone_defs()[i].trial && zone_defs()[i].level < zone_def(target).level &&
                (grind_zone_ < 0 || zone_defs()[i].level > zone_def(grind_zone_).level))
                grind_zone_ = int(i);
        grind_until_ = H.level + 1;
        zone_deaths_ = 0;
        if (grind_zone_ >= 0) fprintf(stderr, "%s: walled at %s; back to %s until level %d\n", tag, zone_def(target).name, zone_def(grind_zone_).name, grind_until_);
    }
    if (grind_zone_ >= 0 && H.level >= grind_until_) { fprintf(stderr, "%s: level %d; back to the act\n", tag, H.level); grind_zone_ = -1; }
    const bool grinding = grind_zone_ >= 0;
    if (grinding) target = grind_zone_;
    // spend what we have earned: stars along the plan (then any free neighbour), ascendancy nodes
    if (!m.open && frame % 20 == 0 && H.passive_points() > 0) {
        if (place_next_planned(w) < 0) {
            for (size_t i = 0; i < tree().stars.size(); i++)
                if (tree().stars[i].kind != StarKind::Keystone && H.passives.can_take(int(i))) { plan_to(H, int(i)); break; }
        }
    }
    if (!m.open && frame % 20 == 10 && H.asc_points() > 0 && H.ascendancy < 0 && !ascendancies_of(H.passives.cls).empty())
        H.ascendancy = int8_t(ascendancies_of(H.passives.cls)[0]);   // a class with two: the first
    if (!m.open && frame % 20 == 10 && H.asc_points() > 0)
        if (const Ascendancy* asc = ascendancy_of(H.passives.cls, H.ascendancy))
            for (size_t i = 1; i < asc->nodes.size(); i++)
                if (asc_can_take(*asc, H.asc, int(i))) { H.asc |= 1u << i; w.recompute_hero(); fprintf(stderr, "%s: ascended: %s\n", tag, asc->nodes[i].name); break; }
    // at home: a better weapon from Amm Sayed, if he has one we can pay for
    if (shop_weapon(w, m, a, in, frame)) return;
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
    if (!in_zone) shop_home_ = false;
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
        fprintf(stderr, "%s: t=%.0fs %s (area level %d): hero level %d, life %.0f, dps %.0f, %s (%s)\n", tag, frame / 60.f, a.name(), w.area_level,
                H.level, h.life_max, summarize(H).dps, H.weapon().display_name().c_str(), H.weapon().b().name);
        if (getenv("QAHIRA_BOT_TRACE"))
            for (int k = 0; k < 4; k++)
                if (const Talisman* t = H.slot_talisman(k)) fprintf(stderr, "   slot %d %s: %.0f dps\n", k, t->def().name, hero_skill_ctx(H, *t).hit.dps());
    }
    int here = L.cell_index_at(h.pos);
    if (here >= 0) visited_[size_t(here)] = 1;
    if (getenv("QAHIRA_BOSS_TRACE") && frame % 30 == 0)
        for (size_t i = 1; i < w.actors.size(); i++) {
            const Actor& e = w.actors[i];
            if (e.rarity != Rarity::Unique || !e.alive() || length(e.pos - h.pos) > 14.f) continue;
            fprintf(stderr, "boss: t=%.1f life %.0f/%.0f mana %.0f flask %d | dist %.1f boss %.0f act %d skill %d | fx %zu\n", frame / 60.f, h.life,
                    h.life_max, h.mana, int(w.hero.flask), length(e.pos - h.pos), e.life, int(e.act), e.skill, w.ground.size());
        }
    if (getenv("QAHIRA_BOT_TRACE") && frame % 600 == 0) {
        const Actor* b = nullptr;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique) b = &w.actors[i];
        fprintf(stderr, "%s trace: hero (%.1f,%.1f) cell %d goal %d arena %d | boss %s (%.1f,%.1f) life %.0f state %d | alive %zu\n", tag, h.pos.x,
                h.pos.y, here, act_goal_, L.arena, b ? b->name.c_str() : "-", b ? b->pos.x : 0.f, b ? b->pos.y : 0.f, b ? b->life : 0.f,
                b ? b->ai_state : -1, std::count_if(w.actors.begin() + 1, w.actors.end(), [](const Actor& a) { return a.alive(); }));
    }
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
    // walled (twice dead here) with dinars in hand: home by portal, to see what Amm Sayed has for us; at most once in
    // three minutes, and the way back is the waypoint
    if ((zone_deaths_ >= 2 || grinding) && !shop_home_ && H.gold >= 20 && (shop_frame_ == 0 || frame - shop_frame_ > 60 * 60 * 3)) {
        bool calm = true;
        for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].alive() && length(w.actors[i].pos - h.pos) < 10.f) calm = false;
        if (calm) { shop_home_ = true; shop_frame_ = frame; fprintf(stderr, "%s: home to shop, %d dinars\n", tag, H.gold); }
    }
    if (shop_home_) {
        if (combat(w, in, frame, 6.f)) return;
        if (go_to_interact(w, in, frame, Interactable::Portal)) return;
        if (frame % 30 == 0) press(in, BTN_UP);
        return;
    }
    if (grinding && !boss && a.zone.cleared) {   // swept and its boss dead: that is all this zone has; home, and back again
        bool left = false;
        for (size_t i = 0; i < L.cells.size(); i++) left = left || (!visited_[i] && int(i) != L.arena);
        if (!left) { grind_zone_ = -1; fprintf(stderr, "%s: %s is spent at level %d; back to the act\n", tag, a.name(), H.level); return; }
    }
    if (combat(w, in, frame, boss && boss->ai_state > 0 ? 30.f : 9.f)) { act_moved_frame_ = frame; act_last_pos_ = h.pos; return; }
    if (loot_and_equip(w, m, in, frame)) return;
    // a stuck walk: give up on that goal
    if (length(h.pos - act_last_pos_) > 1.5f) { act_last_pos_ = h.pos; act_moved_frame_ = frame; }
    if (frame - act_moved_frame_ > 60 * 15 && act_goal_ >= 0) {
        fprintf(stderr, "%s: stuck on the way to cell %d in %s; trying elsewhere\n", tag, act_goal_, a.name());
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
    // a zone with no quest of its own: once its far court is clear, the way on
    bool unswept = false;
    for (size_t i = 0; i < L.cells.size(); i++) unswept = unswept || (!visited_[i] && int(i) != L.arena);
    if (way_on && !grinding && a.zone.cleared && (H.level >= zd.level + 1 || !unswept)) {
        const Interactable::Kind k = via_side ? Interactable::Gate : Interactable::Next;
        for (auto& it : w.interacts)
            if (it.kind == k) { go_to_interact(w, in, frame, k); return; }
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

// ---------------------------------------------------------------- gallery: the art, posed for review
// Not a test: a fixed schedule of poses, one picture each, for the art review page. Run it with --hidden and
// --shot-every 130; every pose ends on a multiple of 130 frames, and stderr names it ("gallery: <frame> <kind> <id>").
//   QAHIRA_GALLERY=1..6   that act's zones: each walked into (a street picture), then its far court and boss in a
//                         fight (a second picture); run each with its own class (QAHIRA_CLASS) to show them all
//   QAHIRA_GALLERY=end    the rooftop, every menu and screen, then the pinnacles' courts and bosses
void Bot::gallery(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    constexpr uint64_t P = 130;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    const char* part = getenv("QAHIRA_GALLERY");
    const std::string which = part ? part : "1";
    auto name = [&](uint64_t f, const char* kind, const std::string& id) {
        fprintf(stderr, "gallery: %llu %s %s\n", (unsigned long long)f, kind, id.c_str());
    };
    h.life = h.life_max;   // nothing dies here but monsters, and skills never run dry
    h.mana = h.mana_max;
    if (frame == 1) {
        Rng r(77);
        H.level = which == "end" ? 40 : 10 * std::max(1, atoi(which.c_str()));
        H.gold = 4000;
        for (int c = CUR_KHAMSA; c < CUR_COUNT; c++) H.currency[c] = 1 + c % 4;
        for (int e = EQ_HELMET; e < EQ_COUNT; e++)   // dressed, so the doll and the sheet have something to show
            if (H.equip[e].empty() && e != EQ_WEAPON2) H.equip[e] = random_drop(H.level, 0.5f, 0.5f, r, e == EQ_HELMET ? Slot::Helmet
                : e == EQ_BODY ? Slot::Body : e == EQ_GLOVES ? Slot::Gloves : e == EQ_BOOTS ? Slot::Boots : e == EQ_BELT ? Slot::Belt
                : e == EQ_AMULET ? Slot::Amulet : Slot::Ring);
        for (int k = 0; k < 6; k++) H.inv.add(random_drop(H.level, 0.4f, 0.5f, r, Slot::Count));
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 40 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        if (H.ascendancy < 0 && !ascendancies_of(H.passives.cls).empty()) H.ascendancy = int8_t(ascendancies_of(H.passives.cls)[0]);
        if (ascendancy_of(H.passives.cls, H.ascendancy)) H.asc = 0x1E;
        H.codex = 0xFFFFFFFFFFFFFFFFull;
        w.recompute_hero();
        if (which != "end")
            for (size_t i = 0; i < zone_defs().size(); i++) if (zone_defs()[i].act == atoi(which.c_str())) gallery_zones_.push_back(int(i));
    }
    if (which != "end") {   // a zone in two pictures: the street, then the far court with its boss in a fight
        const uint64_t k = (frame - 1) / (2 * P), t = (frame - 1) % (2 * P);
        if (k >= gallery_zones_.size()) { pass("gallery done"); return; }
        const ZoneDef& zd = zone_defs()[size_t(gallery_zones_[k])];
        if (t == 0) {
            a.enter_zone(w, gallery_zones_[k], Arrival::Entrance);
            w.level.bind_gpu();
            name(k * 2 * P + P, "street", zd.id);
            name(k * 2 * P + 2 * P, "court", zd.id);
        }
        if (t < 90) { in.lstick = {0, 0.4f}; return; }
        if (t < P) { combat(w, in, frame, 9.f); return; }
        const ZoneLayout& L = a.zone.layout;
        if (t == P) {   // on to the far court, the crowd on the way left behind
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 14.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (t > P + 10) combat(w, in, frame, 30.f);
        return;
    }
    // the rooftop and the screens: one pose each, set up early in its slot and pictured at its end
    const uint64_t k = (frame - 1) / P, t = (frame - 1) % P;
    static const char* screens[] = {"rooftop", "inventory", "talismans", "character", "ascendancy", "journal", "settings", "game",
                                    "vendor", "bench", "dealer", "stars", "map", "title"};
    const uint64_t ns = sizeof screens / sizeof *screens;
    if (k < ns) {
        if (t != 4) return;
        const std::string sc = screens[k];
        name((k + 1) * P, "screen", sc);
        m.hide();
        if (sky_ui) sky_ui->open = false;
        if (map_ui) map_ui->open = false;
        if (sc == "inventory") { m.show(w, false); m.tab = MenuTab::Inventory; }
        else if (sc == "talismans") { m.show(w, false); m.tab = MenuTab::Talismans; }
        else if (sc == "character") { m.show(w, false); m.tab = MenuTab::Character; }
        else if (sc == "ascendancy") { m.show(w, false); m.tab = MenuTab::Ascendancy; }
        else if (sc == "journal") { m.show(w, false); m.tab = MenuTab::Journal; }
        else if (sc == "settings") { m.show(w, false); m.tab = MenuTab::Settings; m.settings_cursor = SET_VOL_MUSIC; }
        else if (sc == "game") { m.show(w, false); m.tab = MenuTab::Game; }
        else if (sc == "vendor") m.show(w, true);
        else if (sc == "bench") m.show_bench(w);
        else if (sc == "dealer") { m.show(w, true); m.dealer = true; m.restock_dealer(w); }
        else if (sc == "stars" && sky_ui) sky_ui->show(w);
        else if (sc == "map" && map_ui) map_ui->show(w);
        else if (sc == "title" && title_ui) { title_ui->scan(save_dir); title_ui->open = true; }
        return;
    }
    if (title_ui) title_ui->open = false;
    // the pinnacles: each court on arrival, then its boss in a fight
    const uint64_t j = (k - ns) / 2, u = (frame - 1) - (ns + 2 * j) * P;
    if (j >= PIN_COUNT) { pass("gallery done"); return; }
    if (u == 0) {
        m.hide();
        a.enter_pinnacle(w, int(j));
        w.level.bind_gpu();
        name((ns + 2 * j + 1) * P, "court", pinnacle_def(int(j)).zone + std::string(j % 2 ? "-uber" : ""));
        name((ns + 2 * j + 2) * P, "boss", pinnacle_def(int(j)).boss + std::string(j % 2 ? "-uber" : ""));
    }
    if (u < P - 30) { in.lstick = {0, 0.3f}; return; }
    combat(w, in, frame, 40.f);
}

// ---------------------------------------------------------------- charts: the endgame loop, from where Act I ends
void Bot::prepare(World& w) {
    if (scenario != "charts" && scenario != "tour6" && scenario != "act2" && scenario != "act3" && scenario != "act4" && scenario != "act5" &&
        scenario != "act6" &&
        scenario != "rifts" && scenario != "digs" && scenario != "zar" && scenario != "reaches" && !pinnacle_run())
        return;
    Hero& H = w.hero;
    Rng r(1404);
    const bool late = scenario == "reaches" || pinnacle_run();   // after Act V
    // Act II: as Act I leaves you; Act III and the rifts: as Act II does
    H.level = scenario == "act2" ? 13 : scenario == "rifts" ? 25 : scenario == "act3" ? 24 : scenario == "digs" ? 34 : scenario == "act4" ? 34 : scenario == "zar" ? 44 : scenario == "act5" ? 43 : scenario == "act6" ? 53
            : scenario == "reaches" ? 58 : pinnacle_run() ? 80 : 14;   // the pinnacles: as the Reaches leave you (the throne at 84)
    const int gear = pinnacle_run() ? 78 : scenario == "reaches" ? 50 : scenario == "act6" ? 48 : scenario == "act5" ? 40 : scenario == "act4" || scenario == "zar" ? 32
                   : scenario == "act3" || scenario == "digs" ? 24 : 14;
    H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1;
    H.recipes = kStarterRecipes;
    H.sites_revealed = starting_sites();
    if (scenario == "rifts") {
        H.quests |= Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2;
        H.currency[CUR_SPLINTER] = 34;   // a few rifts in already
    }
    if (scenario == "digs") H.quests |= Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 | Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3;
    if (scenario == "zar") H.quests |= Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 | Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4;
    if (late) {   // Act V behind you: the first four Climes charted (every site of the King's road, for the king), charts of the Fifth
        H.quests |= Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 | Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4 | Q_PRESSER |
                    Q_TRIAL3 | Q_SMOKE | Q_QANDISHA | Q_ACT5;
        for (size_t i = 0; i < sites().size(); i++)
            if (sites()[i].tier <= (pinnacle_run() ? kChartTiers : kChartTiersEarly)) H.sites_done |= 1u << i;
        for (size_t i = 0; i < sites().size(); i++) if (H.sites_done >> i & 1) H.sites_revealed |= reveal_after(int(i));
        H.astro = (1u << 0) | (1u << 1) | (1u << 3) | (1u << 4) | (1u << 2) | (1u << 20);
        if (scenario == "reaches") for (int k = 0; k < 4; k++) H.inv.add(make_chart(kChartTiersEarly + 1, r, 0.25f, 0.f));
        const PinnacleDef& pd = pinnacle_def(pinnacle_wanted());
        if (pinnacle_run()) H.currency[pd.currency] = pd.cost;
        if (scenario == "falak" || scenario == "subyan") {   // Falak and Umm al-Subyan are after the campaign: Act VI and the Fourth Trial behind you, the Veil sealed
            H.quests |= Q_DUWAIS | Q_SHIQQ | Q_HATIF | Q_HORSEMAN | Q_ACT6 | Q_TRIAL4;
            H.ending = 1;
        }
    }
    if (scenario == "act3" || scenario == "act4" || scenario == "act5" || scenario == "act6") {
        H.quests |= Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2;
        for (const char* z : {"nile_bank", "village", "canal", "karnak", "valley", "tomb"}) H.waypoints.add(find_zone(z));
    }
    if (scenario == "act6") {
        H.quests |= Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4 | Q_PRESSER | Q_TRIAL3 | Q_SMOKE | Q_QANDISHA | Q_ACT5;
        for (const char* z : {"farafra", "sand_sea", "siwa", "bab_futuh", "shali", "oracle", "ghadames", "chott", "tozeur", "medina", "souq",
                              "sebkha", "fes", "fes_bali", "chaouen", "jemaa", "bab_nasr", "tangier", "strait", "balad"})
            H.waypoints.add(find_zone(z));
    }
    if (scenario == "act5") {
        H.quests |= Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4;
        for (const char* z : {"farafra", "sand_sea", "siwa", "bab_futuh", "shali", "oracle", "ghadames", "chott", "tozeur", "medina", "souq",
                              "sebkha", "fes"})
            H.waypoints.add(find_zone(z));
    }
    if (scenario == "act4") {
        H.quests |= Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3;
        for (const char* z : {"farafra", "sand_sea", "siwa", "bab_futuh", "shali", "oracle", "ghadames"}) H.waypoints.add(find_zone(z));
    }
    if (scenario == "act2" || scenario == "act3" || scenario == "act4" || scenario == "act5" || scenario == "act6") {
        for (const char* z : {"downtown", "metro", "khan", "muizz", "necropolis", "mokattam", "nile_bank"}) H.waypoints.add(find_zone(z));
        if (scenario == "act3") H.waypoints.add(find_zone("farafra"));
        // QAHIRA_ACT_AT=<zone> (or QAHIRA_ACT2_AT): start further in, with what comes before it done (for working on one zone)
        const char* at = getenv("QAHIRA_ACT_AT");
        if (!at) at = getenv("QAHIRA_ACT2_AT");
        if (at && find_zone(at) >= 0) {
            static const std::pair<const char*, uint32_t> path2[] = {{"nile_bank", 0}, {"village", 0}, {"canal", Q_NADDAHA}, {"karnak", Q_RAM},
                                                                     {"valley", 0}, {"tomb", Q_MARID}};
            static const std::pair<const char*, uint32_t> path3[] = {{"farafra", 0}, {"sand_sea", Q_DABA}, {"siwa", 0}, {"bab_futuh", Q_TRIAL2},
                                                                     {"shali", 0}, {"oracle", Q_WRAITH}};
            static const std::pair<const char*, uint32_t> path4[] = {{"ghadames", 0}, {"chott", Q_SARAB}, {"tozeur", 0}, {"medina", Q_DOOR},
                                                                     {"souq", 0}, {"sebkha", Q_SALT}};
            static const std::pair<const char*, uint32_t> path5[] = {{"fes", 0}, {"fes_bali", 0}, {"chaouen", Q_PRESSER}, {"jemaa", Q_SMOKE},
                                                                     {"bab_nasr", Q_TRIAL3}, {"tangier", 0}, {"strait", Q_QANDISHA}};
            static const std::pair<const char*, uint32_t> path6[] = {{"balad", 0}, {"harbour", Q_DUWAIS}, {"shibam", Q_SHIQQ}, {"rub", 0},
                                                                     {"wabar", Q_HATIF}, {"iram", Q_HORSEMAN}, {"totality", Q_ACT6}};
            auto walk = [&](auto& path) {
                for (auto& [z, q] : path) {
                    if (std::string(z) == at) { H.level = zone_def(find_zone(z)).level - 1; break; }
                    H.quests |= q;
                    const ZoneDef& zd = zone_def(find_zone(z));
                    for (const char* n : {zd.next, zd.side}) if (find_zone(n) >= 0) H.waypoints.add(find_zone(n));
                }
            };
            if (scenario == "act6") walk(path6); else if (scenario == "act5") walk(path5); else if (scenario == "act4") walk(path4); else if (scenario == "act3") walk(path3); else walk(path2);
        }
    }
    else if (!late)
        for (int k = 0; k < 4; k++) H.inv.add(make_chart(1, r, 0.25f, 0.f));
    // what a player carries out of Act I: level-appropriate rares in every slot
    const bool caster = H.passives.cls == "sorcerer", ranger = H.passives.cls == "ranger", merc = H.passives.cls == "mercenary",
               shadow = H.passives.cls == "shadow", templar = H.passives.cls == "templar", wanderer = H.passives.cls == "wanderer";
    // armour of the class's defence: Hirz for the Sorcerer, evasion for the Ranger, armour for the Warrior, both for the Mercenary,
    // evasion and Hirz for the Shadow, armour and Hirz for the Templar
    auto best = [&](Slot slot, bool, int wk) {
        int b = -1;
        for (size_t i = 0; i < item_bases().size(); i++) {
            const ItemBase& ib = item_bases()[i];
            if (ib.slot != slot || ib.level > gear) continue;
            if (slot == Slot::Weapon && ib.wkind != wk) continue;
            if (slot == Slot::Helmet || slot == Slot::Body || slot == Slot::Gloves || slot == Slot::Boots) {
                int kind = ib.es > 0 && ib.evasion > 0 ? 4 : ib.es > 0 && ib.armour > 0 ? 5 : ib.es > 0 ? 1
                         : ib.evasion > 0 && ib.armour > 0 ? 3 : ib.evasion > 0 ? 2 : 0;
                if (kind != (caster ? 1 : ranger ? 2 : merc || wanderer ? 3 : shadow ? 4 : templar ? 5 : 0)) continue;
            }
            if (b < 0 || ib.level >= item_bases()[size_t(b)].level) b = int(i);
        }
        return b;
    };
    const Slot slots[EQ_COUNT] = {Slot::Weapon, Slot::Helmet, Slot::Body, Slot::Gloves, Slot::Boots, Slot::Belt, Slot::Amulet, Slot::Ring, Slot::Ring,
                                  Slot::Weapon};
    for (int e = 0; e < EQ_COUNT; e++) {
        if (e == EQ_WEAPON2 && !merc && !shadow) continue;
        const int wk = e == EQ_WEAPON2 ? (shadow ? WK_QSTAFF : WK_CROSSBOW) : caster ? WK_STAFF : ranger ? WK_BOW : merc ? WK_SWORD
                     : shadow ? WK_DAGGER : templar ? WK_SCEPTRE : wanderer ? WK_QSTAFF : WK_MAUL;
        if (int b = best(slots[e], caster, wk); b >= 0) H.equip[e] = make_item(b, Rarity::Rare, gear, r);
    }
    for (auto& t : H.talismans) t.level = uint8_t(gear == 14 ? 10 : gear == 24 ? 14 : gear == 32 ? 18 : 20);
    if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
    for (int k = 0; k < 150 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
    if (H.ascendancy < 0 && !ascendancies_of(H.passives.cls).empty()) H.ascendancy = int8_t(ascendancies_of(H.passives.cls)[0]);
    if (ascendancy_of(H.passives.cls, H.ascendancy)) H.asc = (1u << 1) | (1u << 2);   // Trial I's two points
    if ((scenario == "act4" || scenario == "act5" || scenario == "act6" || late) && ascendancy_of(H.passives.cls, H.ascendancy))
        H.asc |= (1u << 3) | (1u << 4);   // and Trial II's
    if ((late || scenario == "act6") && ascendancy_of(H.passives.cls, H.ascendancy)) H.asc |= (1u << 5) | (1u << 6);   // and Trial III's
    if ((scenario == "falak" || scenario == "subyan") && ascendancy_of(H.passives.cls, H.ascendancy)) H.asc |= (1u << 7) | (1u << 8);   // and Trial IV's
    if (scenario == "tour6") {   // further on: a few sites done, some of the Astrolabe set, charts of every Clime
        H.level = 17;
        H.sites_done = (1u << find_site("iskandariya")) | (1u << find_site("qus")) | (1u << find_site("wahat"));
        for (int s : {find_site("iskandariya"), find_site("qus"), find_site("wahat")}) H.sites_revealed |= reveal_after(s);
        H.astro = (1u << 0) | (1u << 1) | (1u << 5);
        for (int t = 1; t <= 4; t++) H.inv.add(make_chart(t, r, 0.6f, 0.3f));
        H.inv.add(make_chart(3, r, 0.f, 1.f));
    }
    w.recompute_hero();
    w.actors[0].life = w.actors[0].life_max;
    w.actors[0].mana = w.actors[0].mana_max;
}

void Bot::charts(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    if (frame > 60ull * 60 * 100) { fail("the charts took longer than 100 minutes of play (" + std::to_string(chart_runs_) + " runs)"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) { press(in, BTN_SOUTH); deaths++; fprintf(stderr, "charts: died in %s\n", a.name()); }
        if (deaths > 25) fail("died more than 25 times");
        return;
    }
    // done: a site of the Fourth Clime finished (reaches: of the Eighth Reach, from the Fifth Clime)
    const bool reaches = scenario == "reaches";
    const int goal = reaches ? 8 : kChartTiersEarly, low = reaches ? kChartTiersEarly + 1 : 1;
    for (size_t i = 0; i < sites().size(); i++)
        if ((H.sites_done >> i & 1) && sites()[i].tier == goal) {
            char b[240];
            int held[kChartTiers + 1] = {};
            for (auto& e : H.inv.items) held[chart_tier(e.item)]++;
            snprintf(b, sizeof b, "charted %s (%s) after %d runs: %d sites, %d Astrolabe nodes, %d Haboobs, %d deaths, level %d; "
                     "charts left T%d-%d: %d %d %d %d", sites()[i].name, tier_name(goal).c_str(), chart_runs_, __builtin_popcount(H.sites_done),
                     __builtin_popcount(H.astro), haboobs_seen_, deaths, H.level, low, goal, held[low], held[low + 1], held[low + 2], held[low + 3]);
            pass(b);
            return;
        }
    // points: stars as they come, the Astrolabe along the charts' arm first
    if (!m.open && frame % 20 == 0 && H.passive_points() > 0) place_next_planned(w);
    if (frame % 20 == 10 && H.astro_points() > 0) {
        static const int order[] = {0, 1, 3, 4, 2, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 18, 17, 19, 9, 20, 21, 22};
        for (int n : order)
            if (astro_can_take(H.astro, n)) { H.astro |= 1u << n; fprintf(stderr, "charts: Astrolabe: %s\n", astro_nodes()[size_t(n)].name); break; }
    }
    if (m.open || equip_target) { loot_and_equip(w, m, in, frame); return; }
    MapScreen& M = *map_ui;
    if (M.open) {   // at the table: walk the cursor to the chosen site, pick a chart, set out
        if (chart_target_ < 0) {
            int best = -1, score = -1;
            for (size_t s = 0; s < sites().size(); s++) {
                if (!(H.sites_revealed >> s & 1)) continue;
                int tier = sites()[s].tier;
                bool have = false;
                for (auto& e : H.inv.items) have = have || chart_tier(e.item) == tier;
                if (!have) continue;
                int sc = tier * 10 + ((H.sites_done >> s & 1) ? 0 : 15);
                if (sc > score) { score = sc; best = int(s); }
            }
            if (best < 0) {
                int n = 0;
                for (auto& e : H.inv.items) n += chart_tier(e.item) > 0;
                fail("out of charts that fit a revealed site after " + std::to_string(chart_runs_) + " runs (" + std::to_string(n) + " charts held)");
                return;
            }
            chart_target_ = best;
            map_presses_ = 0;
        }
        if (frame % 6) return;   // one press at a time, so each registers
        if (M.picking) { press(in, BTN_SOUTH); return; }
        if (M.cursor == chart_target_) { press(in, BTN_SOUTH); return; }
        if (++map_presses_ > 80) { fail("could not walk the map's cursor to " + std::string(sites()[size_t(chart_target_)].name)); return; }
        vec2 d = site_screen(sites()[size_t(chart_target_)]) - site_screen(sites()[size_t(M.cursor)]);
        if (getenv("QAHIRA_BOT_TRACE")) fprintf(stderr, "map: cursor %s -> %s (%.0f,%.0f)\n", sites()[size_t(M.cursor)].name, sites()[size_t(chart_target_)].name, d.x, d.y);
        // push the stick straight at it: the map's magnet picks the nearest site that way
        in.lstick = normalize(vec2{d.x, -d.y});
        return;
    }
    chart_target_ = -1;
    bool in_zone = a.current == AreaId::Zone;
    if (!in_zone) {   // the rooftop: to the table
        go_to_interact(w, in, frame, Interactable::ChartTable);
        return;
    }
    const ZoneLayout& L = a.zone.layout;
    if (a.zone.seed != run_seed_) {
        run_seed_ = a.zone.seed;
        run_frame_ = frame;
        chart_runs_++;
        visited_.assign(L.cells.size(), 0);
        act_moved_frame_ = frame;
        act_last_pos_ = h.pos;
        int held = 0;
        for (auto& e : H.inv.items) held += chart_tier(e.item) > 0;
        fprintf(stderr, "charts: t=%.0fs run %d, %s (tier %d, area level %d)%s: level %d, %zu mods; done %x revealed %x, %d charts left\n",
                frame / 60.f, chart_runs_, a.name(), w.chart.tier, w.area_level, w.haboob.armed ? ", a Haboob" : "", H.level,
                w.chart.mods.quantity > 0 ? size_t(w.chart.mods.quantity / 8) : size_t(0), H.sites_done, H.sites_revealed, held);
        if (w.haboob.armed) haboobs_seen_++;
    }
    int here = L.cell_index_at(h.pos);
    if (here >= 0) visited_[size_t(here)] = 1;
    const Actor* boss = nullptr;
    for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
    if (getenv("QAHIRA_BOT_TRACE") && frame % 300 == 0) {
        int alive = 0;
        for (size_t i = 1; i < w.actors.size(); i++) alive += w.actors[i].alive();
        fprintf(stderr, "trace t=%.0f pos (%.1f,%.1f) cell %d/%d arena %d alive %d boss %s cleared %d haboob armed %d active %d passed %d "
                "front %.0f..%.0f loot %zu eqt %u branch %s sel %d near %d life %.0f/%.0f flask %.1f\n", frame / 60.f, h.pos.x, h.pos.y, here, int(L.cells.size()), L.arena, alive,
                boss ? "yes" : "no", int(a.zone.cleared), int(w.haboob.armed), int(w.haboob.active), int(w.haboob.passed), w.haboob.front,
                w.haboob.y1, w.loot.size(), equip_target, branch_, w.selected_loot, w.near_interact, h.life, h.life_max, float(w.hero.flask));
        for (size_t i = 1; i < w.actors.size(); i++) {
            const Actor& e = w.actors[i];
            if (e.alive() && length(e.pos - h.pos) < 12)
                fprintf(stderr, "   enemy %s at (%.1f,%.1f) dist %.1f clear %d act %d skill %d t %.1f life %.0f ai %d hero-home %.1f mana %.0f ignored %d "
                        "ground %zu\n", e.name.c_str(), e.pos.x, e.pos.y, length(e.pos - h.pos), int(w.level.line_clear(h.pos, e.pos, 0.2f)), int(e.act),
                        e.skill, e.act_t, e.life, e.ai_state, length(h.pos - e.home), h.mana, int(unreachable(e.id)), w.ground.size());
        }
        for (auto& it : w.interacts) fprintf(stderr, "   interact %d at (%.1f,%.1f) '%s'\n", int(it.kind), it.pos.x, it.pos.y, it.label.c_str());
        for (size_t i = 0; i < w.loot.size(); i++)
            if (w.loot[i].kind == GroundItem::Gear)
                fprintf(stderr, "   loot %zu at (%.1f,%.1f) %s vis %d dist %.1f\n", i, w.loot[i].pos.x, w.loot[i].pos.y, w.loot[i].item.display_name().c_str(),
                        int(w.loot_visible(w.loot[i])), length(w.loot[i].pos - h.pos));
    }
    if (combat(w, in, frame, boss && boss->ai_state > 0 ? 30.f : 9.f)) { branch_ = "combat"; return; }
    if (loot_and_equip(w, m, in, frame)) { branch_ = "loot"; return; }
    branch_ = "other";
    // the Haboob: once it is up, go and stand in it until it has passed (that is where its rewards are)
    const Haboob& hb = w.haboob;
    if (hb.active && !hb.inside(h.pos)) {
        vec2 want{h.pos.x, hb.front - hb.depth * 0.5f};
        steer(w, in, w.level.resolve(want, h.radius));
        return;
    }
    if (hb.active) {   // inside: hold ground, let the jinn come
        if (frame % 60 == 0) steer(w, in, h.pos + vec2{0, 0.8f});
        return;
    }
    if (!boss && a.zone.cleared) {   // finished: home by the exit
        if (hb.armed && !hb.passed) return;   // wait for the storm first (it has not risen yet)
        if (go_to_interact(w, in, frame, Interactable::Exit)) return;
        if (frame % 30 == 0) press(in, BTN_UP);
        go_to_interact(w, in, frame, Interactable::Portal);
        return;
    }
    if (length(h.pos - act_last_pos_) > 1.5f) { act_last_pos_ = h.pos; act_moved_frame_ = frame; }
    steer(w, in, L.center(L.cells[size_t(L.arena)]) + vec2{0, 1.f});
}

// ---------------------------------------------------------------- tour6: the Map of al-Idrisi, the Astrolabe, a Haboob
void Bot::tour6(World& w, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    MapScreen& M = *map_ui;
    h.life = h.life_max;   // a tour, not a test
    if (a.current == AreaId::Hub && !M.open && !sky_open_frame_) { go_to_interact(w, in, frame, Interactable::ChartTable); return; }
    if (M.open && !sky_open_frame_) sky_open_frame_ = frame;   // the map's timeline starts when it opens
    auto at = [&](uint64_t f) { return sky_open_frame_ && frame == sky_open_frame_ + f; };
    if (at(140) || at(160) || at(180)) in.lstick = {-1, 0};   // walk the cursor west, towards the Maghreb
    if (at(260)) press(in, BTN_R1);                          // the Astrolabe
    if (at(300) || at(330)) in.lstick = {1, 0};
    if (at(420)) press(in, BTN_L1);
    if (at(440)) { M.cursor = find_site("barqa"); }
    if (at(470)) press(in, BTN_SOUTH);                       // choose a chart
    if (at(540)) press(in, BTN_SOUTH);                       // and set out
    if (a.current == AreaId::Zone) {
        if (stage == 0) {
            stage = 1;
            stage_frame = frame;
            a.arm_haboob(w);                                  // a storm, and soon
            w.haboob.delay = 2.f;
        }
        uint64_t t = frame - stage_frame;
        const Haboob& hb = w.haboob;
        if (hb.active && !hb.inside(h.pos) && t < 900)   // the storm to the hero, for the pictures
            w.haboob.front = std::min(hb.y1, h.pos.y + hb.depth * 0.4f);
        combat(w, in, frame, 9.f);
        if (t > 900) { pass("tour6 done"); return; }
    }
    if (frame > 60 * 60) pass("tour6 done");
}

// ---------------------------------------------------------------- rifts: a Marid Rift, a Rift Seal, the Rift Lord
void Bot::rifts(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    MapScreen& M = *map_ui;
    if (frame > 60ull * 60 * 20) { fail("the rifts took longer than 20 minutes of play"); return; }
    if (getenv("QAHIRA_BOT_TRACE") && frame % 600 == 0)
        fprintf(stderr, "rifts trace: area %d map %d picking %d menu %d seals %d near %d pos (%.1f,%.1f)\n", int(a.current), int(M.open), int(M.picking),
                int(m.open), H.currency[CUR_RIFT_SEAL], w.near_interact, h.pos.x, h.pos.y);
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) { press(in, BTN_SOUTH); deaths++; }
        if (deaths > 6) fail("died more than 6 times");
        return;
    }
    if (m.open) { loot_and_equip(w, m, in, frame); return; }
    if (a.current == AreaId::Hub) {
        if (!M.open) { go_to_interact(w, in, frame, Interactable::ChartTable); return; }
        if (frame % 10) return;
        if (H.currency[CUR_RIFT_SEAL] > 0) { press(in, BTN_WEST); return; }   // the seal, at the table
        if (!M.picking) {   // a chart of the First Clime, on a site of it
            for (size_t i = 0; i < sites().size(); i++)
                if (sites()[i].tier == 1 && (H.sites_revealed >> i & 1)) { M.cursor = int(i); break; }
        }
        press(in, BTN_SOUTH);
        return;
    }
    const ZoneDef* zd = a.def();
    if (!zd) return;
    if (std::string(zd->id) == "rift_court") {
        if (rift_stage_ < 3) { rift_stage_ = 3; fprintf(stderr, "rifts: t=%.0fs in the Rift Lord's court\n", frame / 60.f); }
        if (w.boss_killed) {
            char b[160];
            snprintf(b, sizeof b, "a rift opened and closed (%d splinters picked up), a Rift Seal made and spent, the Rift Lord killed in %.1f minutes, %d deaths",
                     H.currency[CUR_SPLINTER] + kSplintersPerSeal - rift_splinters0_, frame / 3600.f, deaths);
            pass(b);
            return;
        }
        if (combat(w, in, frame, 30.f)) return;
        const ZoneLayout& L = a.zone.layout;
        steer(w, in, L.center(L.cells[size_t(L.arena)]));
        return;
    }
    // a chart: make sure it has a rift (a test, not luck), open it, fight in it, and gather what it leaves
    Rift& rf = w.rift;
    if (!rf.armed) {
        rf = Rift{};
        rf.armed = true;
        const ZoneLayout& L = a.zone.layout;
        for (auto& c : L.cells) if (c.kind == ZoneCell::Normal) { rf.pos = L.center(c); break; }
        rift_splinters0_ = H.currency[CUR_SPLINTER];
        fprintf(stderr, "rifts: t=%.0fs a rift in %s\n", frame / 60.f, a.name());
    }
    if (H.currency[CUR_RIFT_SEAL] > 0) {   // home, to spend it
        if (rift_stage_ < 2) { rift_stage_ = 2; fprintf(stderr, "rifts: t=%.0fs a Rift Seal\n", frame / 60.f); }
        if (combat(w, in, frame, 10.f)) return;   // (a portal is only taken with nothing close)
        if (go_to_interact(w, in, frame, Interactable::Portal)) return;
        if (frame % 30 == 0) press(in, BTN_UP);
        return;
    }
    if (!rf.open && !rf.closed) { if (!combat(w, in, frame, 6.f)) steer(w, in, rf.pos); return; }
    if (rf.open) {
        if (rift_stage_ < 1) { rift_stage_ = 1; fprintf(stderr, "rifts: t=%.0fs the rift is open\n", frame / 60.f); }
        if (combat(w, in, frame, 14.f)) return;
        steer(w, in, rf.pos);
        return;
    }
    // closed: the rest of the rift's dead, and the splinters on the ground
    if (combat(w, in, frame, 14.f)) return;
    const GroundItem* best = nullptr;
    for (auto& g : w.loot)
        if (g.kind == GroundItem::Currency && g.currency == CUR_SPLINTER && (!best || length(g.pos - h.pos) < length(best->pos - h.pos))) best = &g;
    if (best) { steer(w, in, best->pos); return; }
    fail("the rift closed and its splinters did not make a Rift Seal");
}

// ---------------------------------------------------------------- king: four King's Pearls, the throne, the Marid King
void Bot::king(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    MapScreen& M = *map_ui;
    const PinnacleDef& pd = pinnacle_def(pinnacle_wanted());
    if (frame > 60ull * 60 * 20) { fail(std::string(pd.name) + " took longer than 20 minutes of play"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) {
            press(in, BTN_SOUTH);
            deaths++;
            const char* by = "?";
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].id == H.last_attacker && w.actors[i].def >= 0) by = monster_defs()[size_t(w.actors[i].def)].name;
            fprintf(stderr, "king: t=%.0fs died (to %s)\n", frame / 60.f, by);
        }
        if (deaths > 8) fail("died more than 8 times");
        return;
    }
    if (m.open) { loot_and_equip(w, m, in, frame); return; }
    if (a.current == AreaId::Hub) {
        if (king_stage_ >= 1) { fail("back on the rooftop, and the throne not taken"); return; }
        if (!M.open) { go_to_interact(w, in, frame, Interactable::ChartTable); return; }
        // the pinnacles, at the table: North opens the list, the cursor down to the one wanted, North again sets out
        if (frame % 10 == 0) press(in, M.pinnacles && M.pin_cursor != pinnacle_wanted() ? BTN_DOWN : BTN_NORTH);
        return;
    }
    const ZoneDef* zd = a.def();
    if (!zd || std::string(zd->id) != pd.zone) { fail(std::string("somewhere else: ") + (zd ? zd->id : "?")); return; }
    if (w.chart.uber != pd.uber) { fail("the uber flag is not as chosen"); return; }
    if (king_stage_ < 1) {
        king_stage_ = 1;
        stage_frame = frame;
        if (H.currency[pd.currency] != 0) { fail("the keys were not spent"); return; }
        const HeroSummary s = summarize(H);
        fprintf(stderr, "king: t=%.0fs before %s (level %d: %.0f life, %.0f Hirz, %.0f DPS, %.0f EHP)\n", frame / 60.f, pd.name,
                H.level, s.life, s.es, s.dps, s.ehp);
    }
    const Actor* boss = nullptr;
    for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
    if (getenv("QAHIRA_BOT_TRACE") && frame % 300 == 0) {
        int alive = 0;
        for (size_t i = 1; i < w.actors.size(); i++) alive += w.actors[i].alive();
        fprintf(stderr, "king trace t=%.0f pos (%.1f,%.1f) life %.0f/%.0f alive %d boss %s at %.1f m, %.0f%%, state %d, menu %d, act %d\n",
                frame / 60.f, h.pos.x, h.pos.y, h.life, h.life_max, alive, boss ? "yes" : "no", boss ? length(boss->pos - h.pos) : 0.f,
                boss ? 100.f * boss->life / boss->life_max : 0.f, boss ? boss->ai_state : -1, int(m.open), int(h.act));
    }
    if (boss && king_stage_ < 2 && boss->ai_state > 0) { king_stage_ = 2; fprintf(stderr, "king: t=%.0fs he rises\n", frame / 60.f); }
    if (boss && king_stage_ < 3 && boss->life < boss->life_max * 0.55f) { king_stage_ = 3; fprintf(stderr, "king: t=%.0fs his court rises\n", frame / 60.f); }
    if (w.boss_killed) {
        int uniques = 0;
        for (auto& g : w.loot) uniques += g.kind == GroundItem::Gear && g.item.rarity == Rarity::Unique;
        char b[200];
        snprintf(b, sizeof b, "%d %s spent at the table, %s killed in %.1f minutes, %d deaths, %d uniques on the floor", pd.cost,
                 pd.currency == CUR_PEARL ? "King's Pearls" : pd.currency == CUR_SCALE ? "Scales of Falak" : "Combs of Umm al-Subyan", pd.name,
                 frame / 3600.f, deaths, uniques);
        pass(b);
        return;
    }
    // a minute in and the King not yet woken: something out of reach is holding the pilot; go to him, fighting only what is close
    const bool to_him = boss && boss->ai_state == 0 && frame - stage_frame > 3600;
    // stalled (eight seconds without moving, say after a death at the entrance, held by something it cannot reach):
    // walk to the boss for five seconds, fighting nothing on the way
    if (length(h.pos - pin_last_pos_) > 0.5f) { pin_last_pos_ = h.pos; pin_still_ = frame; }
    if (boss && boss->ai_state == 0 && frame - pin_still_ > 480 && pin_walk_until_ < frame) pin_walk_until_ = frame + 300;
    if (boss && frame < pin_walk_until_) { steer(w, in, boss->pos); return; }
    if (combat(w, in, frame, to_him ? 5.f : 30.f)) return;
    const ZoneLayout& L = a.zone.layout;
    steer(w, in, to_him ? boss->pos : L.center(L.cells[size_t(L.arena)]));
}

// ---------------------------------------------------------------- digs: an Excavation, and Amm Ramadan
void Bot::digs(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    MapScreen& M = *map_ui;
    auto stage = [&](int s, const char* what) {
        if (dig_stage_ >= s) return;
        dig_stage_ = s;
        fprintf(stderr, "digs: t=%.0fs %s\n", frame / 60.f, what);
    };
    if (frame > 60ull * 60 * 15) { fail("the excavation took longer than 15 minutes of play (stage " + std::to_string(dig_stage_) + ")"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) { press(in, BTN_SOUTH); deaths++; }
        if (deaths > 6) fail("died more than 6 times");
        return;
    }
    // at the dealer: walk the cursor to the cheapest thing the relics buy, and barter for it
    if (m.open && m.dealer) {
        if (H.currency[CUR_RELIC] < dig_relics_) {
            char b[200];
            snprintf(b, sizeof b, "an excavation: %d charges set and fired, the chamber's guardians killed, %d relics dug up, %d bartered "
                     "with Amm Ramadan; %.1f minutes, %d deaths", Dig::kCharges, dig_relics_, dig_relics_ - H.currency[CUR_RELIC], frame / 3600.f, deaths);
            pass(b);
            return;
        }
        int best = -1;
        for (size_t i = 0; i < m.stock.items.size(); i++) {
            int p = Menu::relic_price(m.stock.items[i].item);
            if (p <= H.currency[CUR_RELIC] && (best < 0 || p < Menu::relic_price(m.stock.items[size_t(best)].item))) best = int(i);
        }
        if (best < 0) { fail("Amm Ramadan has nothing the relics can buy"); return; }
        const InvItem& e = m.stock.items[size_t(best)];
        if (getenv("QAHIRA_BOT_TRACE") && frame % 60 == 0)
            fprintf(stderr, "digs: at the dealer: want %s at (%d,%d), cursor region %d (%d,%d)\n", e.item.b().name, e.x, e.y, int(m.region), m.cx, m.cy);

        if (menu_nav(w, m, in, frame, Region::Stock, e.x, e.y) && frame % 2 == 0) press(in, BTN_SOUTH);
        return;
    }
    if (m.open) { loot_and_equip(w, m, in, frame); return; }
    if (a.current == AreaId::Hub) {
        if (dig_stage_ >= 5) { stage(6, "home, to Amm Ramadan"); go_to_interact(w, in, frame, Interactable::Dealer); return; }
        if (!M.open) { go_to_interact(w, in, frame, Interactable::ChartTable); return; }
        if (frame % 10) return;
        if (!M.picking) {   // a chart of the First Clime, on a site of it
            for (size_t i = 0; i < sites().size(); i++)
                if (sites()[i].tier == 1 && (H.sites_revealed >> i & 1)) { M.cursor = int(i); break; }
        }
        press(in, BTN_SOUTH);
        return;
    }
    Dig& d = w.dig;
    if (!d.armed) {   // a test, not luck: this chart has an Excavation
        if (!a.arm_dig(w)) { fail(std::string("no room for an excavation in ") + a.name()); return; }
        stage(1, (std::string("an excavation in ") + a.name()).c_str());
    }
    if (!d.all_set()) { if (!combat(w, in, frame, 6.f)) go_to_interact(w, in, frame, Interactable::Charge); return; }
    if (!d.fired) { stage(2, "every charge set"); if (!combat(w, in, frame, 6.f)) go_to_interact(w, in, frame, Interactable::Detonator); return; }
    if (!d.opened) { stage(3, "fired"); if (!combat(w, in, frame, 6.f)) { in.lstick = normalize(d.stake - h.pos + vec2{0.01f, 0}) * 0.3f; } return; }
    if (!d.searchable) { stage(4, "the chamber is open"); if (!combat(w, in, frame, 16.f)) steer(w, in, d.chamber); return; }
    if (!d.searched) { if (!combat(w, in, frame, 8.f)) go_to_interact(w, in, frame, Interactable::Chamber); return; }
    stage(5, "the chamber searched");
    if (combat(w, in, frame, 8.f)) return;
    const GroundItem* best = nullptr;   // the relics on the ground
    for (auto& g : w.loot)
        if (g.kind == GroundItem::Currency && g.currency == CUR_RELIC && (!best || length(g.pos - h.pos) < length(best->pos - h.pos))) best = &g;
    if (best) { steer(w, in, best->pos); return; }
    if (dig_relics_ == 0) {
        dig_relics_ = H.currency[CUR_RELIC];
        if (dig_relics_ <= 0) { fail("the chamber was searched but no relics were picked up"); return; }
        fprintf(stderr, "digs: %d relics\n", dig_relics_);
    }
    if (go_to_interact(w, in, frame, Interactable::Portal)) return;
    if (frame % 30 == 0) press(in, BTN_UP);
}

// ---------------------------------------------------------------- zar: a Zar Night, sat down to and held to the song's end
void Bot::zar(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Actor& h = w.actors[0];
    Hero& H = w.hero;
    MapScreen& M = *map_ui;
    auto stage = [&](int s, const char* what) {
        if (dig_stage_ >= s) return;
        dig_stage_ = s;
        fprintf(stderr, "zar: t=%.0fs %s\n", frame / 60.f, what);
    };
    if (frame > 60ull * 60 * 12) { fail("the Zar Night took longer than 12 minutes of play (stage " + std::to_string(dig_stage_) + ")"); return; }
    if (!h.alive()) {
        if (h.dead_t > 1.3f && frame % 10 == 0) { press(in, BTN_SOUTH); deaths++; }
        if (deaths > 6) fail("died more than 6 times");
        return;
    }
    if (m.open) { loot_and_equip(w, m, in, frame); return; }
    if (a.current == AreaId::Hub) {
        if (!M.open) { go_to_interact(w, in, frame, Interactable::ChartTable); return; }
        if (frame % 10) return;
        if (!M.picking)
            for (size_t i = 0; i < sites().size(); i++)
                if (sites()[i].tier == 1 && (H.sites_revealed >> i & 1)) { M.cursor = int(i); break; }
        press(in, BTN_SOUTH);
        return;
    }
    Zar& z = w.zar;
    if (!z.armed) {   // a test, not luck: this chart has a Zar Night
        if (!a.arm_zar(w)) { fail(std::string("no room for a Zar Night in ") + a.name()); return; }
        stage(1, (std::string("drummers in ") + a.name()).c_str());
    }
    if (!z.started) { if (!combat(w, in, frame, 6.f)) go_to_interact(w, in, frame, Interactable::Drum); return; }
    if (!z.over) {   // hold the circle: fight what comes, and never stray far from the drums
        stage(2, "the Zar begins");
        if (length(h.pos - z.pos) > Zar::kRadius * 0.6f && h.act == Act::Idle) { steer(w, in, z.pos); return; }
        if (!combat(w, in, frame, Zar::kRadius)) steer(w, in, z.pos + rotate(vec2{3.5f, 0}, float(frame) * 0.01f));
        if (frame % 600 == 0) fprintf(stderr, "zar: t=%.0fs rhythm %.0f, %d trances, %d kills\n", frame / 60.f, z.rhythm, z.trances, z.kills);
        return;
    }
    stage(3, "the song is over");
    if (getenv("QAHIRA_BOT_TRACE") && frame % 300 == 0) {
        int near = 0;
        for (size_t i = 1; i < w.actors.size(); i++) near += w.actors[i].alive() && length(w.actors[i].pos - h.pos) < 8.f;
        fprintf(stderr, "zar trace: hero (%.1f,%.1f) drums (%.1f,%.1f) enemies near %d, loot %zu, picks %d\n", h.pos.x, h.pos.y, z.pos.x, z.pos.y, near,
                w.loot.size(), dig_relics_);
    }
    if (z.trances < 1) { fail("the Zar Night ended with no trance (" + std::to_string(z.kills) + " kills)"); return; }
    if (combat(w, in, frame, 8.f)) return;
    const GroundItem* best = nullptr;   // what the night paid out, near the drums
    for (auto& g : w.loot)
        if (length(g.pos - z.pos) < 6.f && (!best || length(g.pos - h.pos) < length(best->pos - h.pos))) best = &g;
    if (best && dig_relics_ < 400) { dig_relics_++; steer(w, in, best->pos); if (frame % 12 == 0) press(in, BTN_SOUTH); return; }
    char b[200];
    snprintf(b, sizeof b, "a Zar Night in %s: %d trance%s, %d kills in the circle, the song %s; %.1f minutes, %d deaths", a.name(), z.trances,
             z.trances == 1 ? "" : "s", z.kills, z.rhythm > 0 ? "played to its end" : "cut short", frame / 3600.f, deaths);
    pass(b);
}

// ---------------------------------------------------------------- tour9: the Shadow, Act IV, a Zar Night (screenshots)
void Bot::tour9(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"ghadames", "chott", "tozeur", "medina", "souq", "sebkha"};
    const uint64_t z0 = 240, each = 300;
    // QAHIRA_TOUR_ZAR=1: straight to the Zar Night (after the first frame's setup)
    if (frame > 1 && getenv("QAHIRA_TOUR_ZAR")) frame += z0 + 6 * each - 2;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    auto at = [&](uint64_t f) { return frame == f; };
    h.life = h.life_max;   // a tour, not a test
    if (at(1)) {
        Rng r(37);
        H.level = 38;
        H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1 | Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 |
                   Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3;
        H.weapon() = make_item(find_base("djerid_dagger"), Rarity::Rare, 36, r);
        H.equip[EQ_WEAPON2] = make_item(find_base("palm_heart_staff"), Rarity::Rare, 36, r);
        const char* armour[] = {"veiled_hood", "night_burnous", "silk_wraps", "rooftop_slippers"};
        const int eq[] = {EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS};
        for (int k = 0; k < 4; k++) H.equip[eq[k]] = make_item(find_base(armour[k]), Rarity::Rare, 36, r);
        for (auto& t : H.talismans) t.level = 16;
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 40 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        for (int k = 0; k < 60 && H.passive_points() > 0; k++) {   // the rest wherever they can go, so the HUD has none left
            int take = -1;
            for (auto& st : tree().stars) if (H.passives.can_take(st.id)) { take = st.id; break; }
            if (take < 0) break;
            H.passives.taken[size_t(take)] = 1;
        }
        H.ascendancy = -1;
        H.asc = 0;
        w.recompute_hero();
    }
    // the choice of ascendancy: look at both, take the Mystic
    if (at(10)) { m.show(w, false); m.tab = MenuTab::Ascendancy; }
    if (at(80)) press(in, BTN_RIGHT);
    if (at(130)) press(in, BTN_SOUTH);
    if (at(150)) { H.asc = (1u << 1) | (1u << 2) | (1u << 5) | (1u << 6); w.recompute_hero(); }
    if (at(230)) m.hide();
    if (frame < z0) return;
    const uint64_t zones_end = z0 + 6 * each;
    if (frame < zones_end) {
        int k = int((frame - z0) / each), t = int((frame - z0) % each);
        if (t == 0) {
            a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour9: %s at frame %llu\n", a.name(), (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 110 && *zone_def(find_zone(zones[k])).boss) {   // boss zones: skip ahead to the far court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (k == 5 && t == 250)   // the Ghula falls: Act IV is over
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) w.actors[i].life = 1;
        combat(w, in, frame, t > 110 ? 30.f : 9.f);
        return;
    }
    // a chart with a Zar Night: sat down at the drum, and the circle held
    const uint64_t zar0 = zones_end, zar_len = 900;
    if (frame < zar0 + zar_len) {
        int t = int(frame - zar0);
        Zar& z = w.zar;
        if (t == 0) {
            H.quests |= Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4;
            Rng r(9);
            a.enter_chart(w, find_site("tunis"), make_chart(4, r, 0.f, 0.f));
            w.level.bind_gpu();
            // a tour: the Zar alone (no rift or dig the chart may also have rolled)
            w.rift = Rift{};
            w.dig = Dig{};
            w.interacts.erase(std::remove_if(w.interacts.begin(), w.interacts.end(), [](const Interactable& i) {
                                  return i.kind == Interactable::Charge || i.kind == Interactable::Detonator; }), w.interacts.end());
            if (!z.armed) a.arm_zar(w);
            for (size_t i = 1; i < w.actors.size(); i++) if (length(w.actors[i].pos - z.pos) < 30.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
            h.pos = w.level.resolve(z.pos + vec2{0, -5.f}, h.radius);   // a tour: skip the walk
            fprintf(stderr, "tour9: a Zar Night at frame %llu\n", (unsigned long long)frame);
        }
        if (!z.started && t >= 130)   // (a tour: whatever the pilot could not reach is done for it)
            for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Drum) w.zar_use(int(i));
        if (!z.started) { if (t < 70) steer(w, in, z.pos + vec2{0, -3.f}); else if (!go_to_interact(w, in, frame, Interactable::Drum)) steer(w, in, z.pos); return; }
        if (t == 560) z.rhythm = std::max(z.rhythm, 97.f);   // a tour, only a few seconds of the night: a trance to show
        if (!z.over) {
            if (length(h.pos - z.pos) > Zar::kRadius * 0.6f && h.act == Act::Idle) { steer(w, in, z.pos); return; }
            if (!combat(w, in, frame, Zar::kRadius)) steer(w, in, z.pos + rotate(vec2{3.5f, 0}, float(frame) * 0.01f));
            return;
        }
        steer(w, in, z.pos + vec2{0, -3.f});
        return;
    }
    pass("tour9 done");
}

// ---------------------------------------------------------------- tour10: the Templar, Act V, the Reaches, the Marid King (screenshots)
void Bot::tour10(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"fes", "chaouen", "jemaa", "bab_nasr", "tangier", "strait"};
    const uint64_t z0 = 240, each = 300;
    // QAHIRA_TOUR_KING=1: straight to the map of the Reaches and the throne (after the first frame's setup)
    if (frame > 1 && getenv("QAHIRA_TOUR_KING")) frame += z0 + 6 * each - 2;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    auto at = [&](uint64_t f) { return frame == f; };
    h.life = h.life_max;   // a tour, not a test
    if (at(1)) {
        Rng r(41);
        H.level = 52;
        H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1 | Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 |
                   Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4;
        H.weapon() = make_item(find_base("beacon_sceptre"), Rarity::Rare, 50, r);
        const char* armour[] = {"crested_helmet", "officers_greatcoat", "brigade_gauntlets", "brigade_boots"};
        const int eq[] = {EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS};
        for (int k = 0; k < 4; k++) H.equip[eq[k]] = make_item(find_base(armour[k]), Rarity::Rare, 50, r);
        for (auto& t : H.talismans) t.level = 20;
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 80 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        H.ascendancy = -1;
        H.asc = 0;
        w.recompute_hero();
    }
    // the choice of ascendancy: look at both, take the Warden
    if (at(10)) { m.show(w, false); m.tab = MenuTab::Ascendancy; }
    if (at(80)) press(in, BTN_RIGHT);
    if (at(130)) press(in, BTN_SOUTH);
    if (at(150)) { H.asc = (1u << 1) | (1u << 2) | (1u << 3) | (1u << 4); w.recompute_hero(); }
    if (at(230)) m.hide();
    if (frame < z0) return;
    const uint64_t zones_end = z0 + 6 * each;
    if (frame < zones_end) {
        int k = int((frame - z0) / each), t = int((frame - z0) % each);
        if (t == 0) {
            a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour10: %s at frame %llu\n", a.name(), (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 110 && *zone_def(find_zone(zones[k])).boss) {   // boss zones: skip ahead to the far court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (t == 20 && !H.aura) { h.skill = 1; w.resolve_skill(h); }   // the Beacon held up
        combat(w, in, frame, t > 110 ? 30.f : 9.f);
        return;
    }
    // the Map of al-Idrisi after Act V: the Reaches, part charted, a few pearls
    const uint64_t map0 = zones_end, map_len = 360;
    MapScreen& M = *map_ui;
    if (frame < map0 + map_len) {
        int t = int(frame - map0);
        if (t == 0) {
            H.quests |= Q_PRESSER | Q_TRIAL3 | Q_SMOKE | Q_QANDISHA | Q_ACT5;
            for (size_t i = 0; i < sites().size(); i++) if (sites()[i].tier <= 9 && sites()[i].id != std::string("baghdad")) H.sites_done |= 1u << i;
            for (size_t i = 0; i < sites().size(); i++) if (H.sites_done >> i & 1) H.sites_revealed |= reveal_after(int(i));
            H.astro = (1u << 0) | (1u << 1) | (1u << 2) | (1u << 3) | (1u << 20) | (1u << 21) | (1u << 5);
            Rng r(12);
            for (int tier : {9, 9, 10, 10, 10, 11, 8, 12, 14}) H.inv.add(make_chart(tier, r, 0.4f, 0.2f));
            H.currency[CUR_PEARL] = kPearlsPerThrone;
            a.close_zone(w);
            a.enter_hub(w, Arrival::Entrance);
            w.level.bind_gpu();
            M.show(w);
            M.cursor = find_site("jabal_qamar");
            fprintf(stderr, "tour10: the map at frame %llu\n", (unsigned long long)frame);
        }
        if (t == 150) M.cursor = find_site("adan");
        if (t == 250) M.cursor = find_site("muhit");
        return;
    }
    // the throne: four pearls at the table, and the Marid King
    const uint64_t king0 = map0 + map_len, king_len = 1200;
    if (frame < king0 + king_len) {
        int t = int(frame - king0);
        if (t == 0) {
            M.hide();
            H.currency[CUR_PEARL] -= kPearlsPerThrone;
            H.level = 70;
            w.recompute_hero();
            a.enter_throne(w);
            w.level.bind_gpu();
            fprintf(stderr, "tour10: the throne at frame %llu\n", (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 60) {   // a tour: straight to his court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -6.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (t == 20 && !H.aura) { h.skill = 1; w.resolve_skill(h); }
        if (t == 900)   // and he falls, for the last pictures
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) w.actors[i].life = 1;
        combat(w, in, frame, 30.f);
        return;
    }
    pass("tour10 done");
}

// ---------------------------------------------------------------- tour12: Slice 11's screens (run with QAHIRA_LANG=ar for Arabic)
void Bot::tour12(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    h.life = h.life_max;
    (void)in;
    auto at = [&](uint64_t f) { return frame == f; };
    if (at(1)) {   // a character a little way in, with things in the bag to colour
        Rng r(71);
        H.level = 24;
        H.gold = 1234;
        H.weapon() = make_item(find_base("citadel_maul"), Rarity::Rare, 24, r);
        H.equip[EQ_HELMET] = make_item(find_base("riveted_cap"), Rarity::Magic, 24, r);
        H.equip[EQ_BODY] = make_item(find_base("riveted_breastplate"), Rarity::Rare, 24, r);
        for (const char* b : {"mokattam_sledge", "work_coat", "brass_ring", "tooled_belt", "laced_boots"})
            H.inv.add(make_item(find_base(b), b[0] == 'b' ? Rarity::Rare : Rarity::Magic, 24, r));
        if (int u = random_unique(24, r); u >= 0) H.inv.add(make_unique(u, 24, r));
        w.recompute_hero();
    }
    if (at(80)) m.show(w, false);                                    // the items
    if (at(220)) m.tab = MenuTab::Character;
    if (at(360)) { m.tab = MenuTab::Settings; m.settings_cursor = SET_LANG; }
    if (at(460)) m.settings_cursor = SET_COLOURS;
    if (at(500)) set_setting(SET_COLOURS, 1);                        // red-green safe
    if (at(560)) { m.hide(); w.hero.gold = 5000; m.show(w, true); }   // Amm Sayed: the flask to upgrade
    if (at(660)) { m.hide(); m.show(w, false); m.tab = MenuTab::Settings; m.settings_cursor = SET_TEXT; set_setting(SET_TEXT, 2); }
    if (at(760)) { set_setting(SET_TEXT, 0); set_setting(SET_COLOURS, 0); m.hide(); }
    if (frame > 760 && frame < 1000) {   // the HUD, on the rooftop
        steer(w, in, a.zone.valid ? h.pos : h.pos + vec2{0.5f, 0.f});
    }
    if (at(1000)) {   // Umm al-Subyan in her house
        H.level = 70;
        H.quests |= Q_ACT6;
        w.recompute_hero();
        a.enter_pinnacle(w, PIN_SUBYAN);
        w.level.bind_gpu();
    }
    if (frame > 1000 && frame < 1700) {
        const ZoneLayout& L = a.zone.layout;
        if (at(1060)) {
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -6.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (frame > 1060) combat(w, in, frame, 30.f);
        return;
    }
    if (frame >= 1700) pass("tour12 done");
}

// ---------------------------------------------------------------- tour11: the Wanderer, Act VI, the choice, the Gate of Iram, Falak (screenshots)
void Bot::tour11(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"balad", "harbour", "shibam", "rub", "iram", "totality"};
    const uint64_t z0 = 60, each = 300;
    // QAHIRA_TOUR_GATE=1: straight to the Gate of Iram (after the first frame's setup)
    if (frame > 1 && getenv("QAHIRA_TOUR_GATE")) frame += z0 + 6 * each - 2;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    h.life = h.life_max;   // a tour, not a test
    (void)m;
    if (frame == 1) {
        Rng r(61);
        H.level = 62;
        H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1 | Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2 |
                   Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3 | Q_SARAB | Q_DOOR | Q_SALT | Q_ACT4 | Q_PRESSER | Q_TRIAL3 | Q_SMOKE | Q_QANDISHA | Q_ACT5;
        H.weapon() = make_item(find_base("caravan_staff"), Rarity::Rare, 60, r);
        const char* armour[] = {"kettle_helm", "scale_hauberk", "mamluk_gauntlets", "mamluk_boots"};
        const int eq[] = {EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS};
        for (int k = 0; k < 4; k++) H.equip[eq[k]] = make_item(find_base(armour[k]), Rarity::Rare, 60, r);
        for (auto& t : H.talismans) t.level = 20;
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 80 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        if (!ascendancies_of(H.passives.cls).empty()) H.ascendancy = int8_t(ascendancies_of(H.passives.cls)[0]);
        H.asc = (1u << 1) | (1u << 2) | (1u << 3) | (1u << 4) | (1u << 5) | (1u << 6);
        w.recompute_hero();
        return;
    }
    if (frame < z0) return;
    const uint64_t zones_end = z0 + 6 * each;
    if (frame < zones_end) {
        int k = int((frame - z0) / each), t = int((frame - z0) % each);
        if (t == 0) {
            a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour11: %s at frame %llu\n", a.name(), (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 110 && *zone_def(find_zone(zones[k])).boss) {   // boss zones: skip ahead to the far court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (std::string(zones[k]) == "totality" && t == 200) {   // Apep lets go: the two columns of the choice
            H.quests |= Q_DUWAIS | Q_SHIQQ | Q_HATIF | Q_HORSEMAN | Q_ACT6;
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].alive()) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
            w.interacts.push_back({Interactable::Veil, w.level.resolve(h.pos + vec2{-2.6f, 2.f}, 0.6f), 2.0f, "Seal the Veil"});
            w.interacts.push_back({Interactable::Door, w.level.resolve(h.pos + vec2{2.6f, 2.f}, 0.6f), 2.0f, "Leave the door open"});
        }
        if (t >= 200 && std::string(zones[k]) == "totality") return;   // stand between them
        combat(w, in, frame, t > 110 ? 30.f : 9.f);
        return;
    }
    // the Gate of Iram: the three scales, then the Keeper
    const uint64_t gate0 = zones_end, gate_len = 700;
    if (frame < gate0 + gate_len) {
        int t = int(frame - gate0);
        if (t == 0) {
            H.quests |= Q_DUWAIS | Q_SHIQQ | Q_HATIF | Q_HORSEMAN | Q_ACT6;
            H.ending = 1;
            a.enter_zone(w, find_zone("gate_iram"), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour11: the Gate of Iram at frame %llu\n", (unsigned long long)frame);
        }
        if (t < 260) {   // walk up to the scales
            for (auto& it : w.interacts) if (it.kind == Interactable::Toll && it.target == EQ_BODY && length(it.pos - h.pos) > 1.2f) steer(w, in, it.pos);
            return;
        }
        if (t == 260) go_to_interact(w, in, frame, Interactable::Toll, EQ_BODY);
        const ZoneLayout& L = a.zone.layout;
        if (t == 330) {
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (t > 260 && t < 330) { go_to_interact(w, in, frame, Interactable::Toll, EQ_BODY); return; }
        combat(w, in, frame, 30.f);
        return;
    }
    // the Pinnacles at the chart table
    MapScreen& M = *map_ui;
    const uint64_t map0 = gate0 + gate_len, map_len = 240;
    if (frame < map0 + map_len) {
        int t = int(frame - map0);
        if (t == 0) {
            H.currency[CUR_PEARL] = 9;
            H.currency[CUR_SCALE] = 5;
            a.close_zone(w);
            a.enter_hub(w, Arrival::Entrance);
            w.level.bind_gpu();
            M.show(w);
            M.pinnacles = true;
            M.pin_cursor = PIN_FALAK;
            fprintf(stderr, "tour11: the pinnacles at frame %llu\n", (unsigned long long)frame);
        }
        if (t == 150) M.pin_cursor = PIN_FALAK_UBER;
        return;
    }
    // Falak, beneath the world
    const uint64_t falak0 = map0 + map_len, falak_len = 1100;
    if (frame < falak0 + falak_len) {
        int t = int(frame - falak0);
        if (t == 0) {
            M.hide();
            H.level = 70;
            w.recompute_hero();
            a.enter_pinnacle(w, PIN_FALAK);
            w.level.bind_gpu();
            fprintf(stderr, "tour11: Falak at frame %llu\n", (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 60) {
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -6.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        combat(w, in, frame, 30.f);
        return;
    }
    pass("tour11 done");
}

// ---------------------------------------------------------------- tour8: the Mercenary, Act III, an Excavation (screenshots)
void Bot::tour8(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"farafra", "sand_sea", "siwa", "bab_futuh", "shali", "oracle"};
    const uint64_t z0 = 240, each = 300;
    // QAHIRA_TOUR_DIG=1: straight to the Excavation (after the first frame's setup)
    if (frame > 1 && getenv("QAHIRA_TOUR_DIG")) frame += z0 + 6 * each - 2;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    auto at = [&](uint64_t f) { return frame == f; };
    h.life = h.life_max;   // a tour, not a test
    if (at(1)) {
        Rng r(31);
        H.level = 30;
        H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1 | Q_NADDAHA | Q_RAM | Q_MARID | Q_ACT2;
        H.weapon() = make_item(find_base("damascus_blade"), Rarity::Rare, 28, r);
        H.equip[EQ_WEAPON2] = make_item(find_base("siege_arbalest"), Rarity::Rare, 28, r);
        const char* armour[] = {"nasal_helm", "lamellar_coat", "scale_gauntlets", "march_boots"};
        const int eq[] = {EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS};
        for (int k = 0; k < 4; k++) H.equip[eq[k]] = make_item(find_base(armour[k]), Rarity::Rare, 28, r);
        for (auto& t : H.talismans) t.level = 14;
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 40 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        H.ascendancy = -1;
        H.asc = 0;
        w.recompute_hero();
    }
    // the choice of ascendancy: look at both, take the Demolitionist
    if (at(10)) { m.show(w, false); m.tab = MenuTab::Ascendancy; }
    if (at(80)) press(in, BTN_RIGHT);
    if (at(130)) press(in, BTN_SOUTH);
    if (at(150)) { H.asc = (1u << 1) | (1u << 2) | (1u << 7) | (1u << 8); w.recompute_hero(); }
    if (at(230)) m.hide();
    if (frame < z0) return;
    const uint64_t zones_end = z0 + 6 * each;
    if (frame < zones_end) {
        int k = int((frame - z0) / each), t = int((frame - z0) % each);
        if (t == 0) {
            a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour8: %s at frame %llu\n", a.name(), (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 110 && *zone_def(find_zone(zones[k])).boss) {   // boss zones: skip ahead to the far court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (k == 5 && t == 250)   // the wraith falls: Act III is over
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) w.actors[i].life = 1;
        combat(w, in, frame, t > 110 ? 30.f : 9.f);
        return;
    }
    // a chart with an Excavation: the line of charges, fired, the chamber and its guardians
    const uint64_t dig0 = zones_end, dig_len = 620;
    if (frame < dig0 + dig_len) {
        int t = int(frame - dig0);
        Dig& d = w.dig;
        if (t == 0) {
            H.quests |= Q_DABA | Q_TRIAL2 | Q_WRAITH | Q_ACT3;
            Rng r(5);
            a.enter_chart(w, find_site("wahat"), make_chart(2, r, 0.f, 0.f));
            w.level.bind_gpu();
            if (!w.dig.armed) a.arm_dig(w);
            for (size_t i = 1; i < w.actors.size(); i++) if (length(w.actors[i].pos - d.stake) < 40.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
            fprintf(stderr, "tour8: an excavation at frame %llu\n", (unsigned long long)frame);
        }
        if (t == 1) h.pos = w.level.resolve(d.spots[0] + normalize(d.stake - d.spots[0] + vec2{0.01f, 0}) * 4.f, h.radius);   // a tour: skip the walk
        if (t < 60) { steer(w, in, d.spots[0]); return; }
        if (t == 60) for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Charge && w.interacts[i].target > 0) w.dig_use(int(i));
        if (t < 140) { if (!go_to_interact(w, in, frame, Interactable::Charge)) steer(w, in, d.stake); return; }
        if (t == 140 && !d.all_set()) {   // (a tour: whatever the pilot could not reach is set for it)
            fprintf(stderr, "tour8: charge 0 not set by hand (near %d, hero %.1f,%.1f spot %.1f,%.1f)\n", w.near_interact, h.pos.x, h.pos.y,
                    d.spots[0].x, d.spots[0].y);
            for (size_t i = 0; i < w.interacts.size(); i++) if (w.interacts[i].kind == Interactable::Charge) w.dig_use(int(i));
        }
        if (!d.fired) { go_to_interact(w, in, frame, Interactable::Detonator); return; }
        if (t == 330) for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].dig) w.actors[i].life = 1;
        if (d.searchable && !d.searched) {
            static bool moved = false;   // a tour: to the chamber's door, rather than the walk back up the line
            if (!moved) { moved = true; h.pos = w.level.resolve(d.chamber + normalize(d.stake - d.chamber + vec2{0.01f, 0}) * 5.f, h.radius); }
            go_to_interact(w, in, frame, Interactable::Chamber);
            return;
        }
        if (d.searched) { steer(w, in, d.chamber + normalize(d.stake - d.chamber + vec2{0.01f, 0}) * 4.f); return; }
        if (!d.opened) { steer(w, in, d.spots[1]); return; }   // towards the line, to watch it go off
        combat(w, in, frame, 16.f);
        return;
    }
    // home, and Amm Ramadan's back room
    int t = int(frame - dig0 - dig_len);
    if (t == 0) {
        H.currency[CUR_RELIC] = 9;
        a.close_zone(w);
        a.enter_hub(w, Arrival::Entrance);
        w.level.bind_gpu();
        h.pos = w.level.point("spawn") + vec2{-2.6f, -0.6f};
    }
    if (t < 60 && !m.open) { go_to_interact(w, in, frame, Interactable::Dealer); return; }
    if (t == 60 && !m.open) m.show_dealer(w);
    if (t > 70 && t < 140 && m.open && frame % 10 == 0 && m.cx < 2) press(in, BTN_RIGHT);
    if (t == 260) { m.hide(); pass("tour8 done"); }
}

// ---------------------------------------------------------------- tour7: the Ranger, Act II, a Marid Rift (screenshots)
void Bot::tour7(World& w, Menu& m, Areas& a, Input& in, uint64_t frame) {
    static const char* zones[] = {"nile_bank", "village", "canal", "karnak", "valley", "tomb"};
    const uint64_t z0 = 240, each = 300;
    Hero& H = w.hero;
    Actor& h = w.actors[0];
    auto at = [&](uint64_t f) { return frame == f; };
    h.life = h.life_max;   // a tour, not a test
    if (at(1)) {
        Rng r(21);
        H.level = 22;
        H.quests = Q_MICROBUS | Q_SILAH | Q_NASNAS | Q_TRIAL1 | Q_GHULA | Q_QUTRUB | Q_BENCH | Q_ACT1 | Q_NADDAHA | Q_RAM;
        H.weapon() = make_item(find_base("composite_bow"), Rarity::Rare, 20, r);
        const char* armour[] = {"falconers_hood", "desert_coat", "suede_gloves", "sand_striders"};
        const int eq[] = {EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS};
        for (int k = 0; k < 4; k++) if (find_base(armour[k]) >= 0) H.equip[eq[k]] = make_item(find_base(armour[k]), Rarity::Rare, 20, r);
        for (auto& t : H.talismans) t.level = 12;
        if (const auto* rec = tree().recommended_for(H.passives.cls)) for (int t : *rec) plan_to(H, t);
        for (int k = 0; k < 40 && H.passive_points() > 0; k++) if (place_next_planned(w) < 0) break;
        H.ascendancy = -1;
        H.asc = 0;
        w.recompute_hero();
    }
    // the choice of ascendancy, at the First Trial's reward: look at both, take the Outrider
    if (at(10)) { m.show(w, false); m.tab = MenuTab::Ascendancy; }
    if (at(80)) press(in, BTN_RIGHT);
    if (at(130)) press(in, BTN_SOUTH);
    if (at(150)) { H.asc = (1u << 3) | (1u << 4); w.recompute_hero(); }
    if (at(230)) m.hide();
    if (frame < z0) return;
    // six zones of `each` frames (the Deep Tomb twice as long, for what comes after its marid), then the rift
    int k = int((frame - z0) / each), t = int((frame - z0) % each);
    if (k >= 5) { uint64_t f5 = frame - z0 - 5 * each; k = f5 < 2 * each ? 5 : f5 < 3 * each ? 6 : 7; t = int(k == 5 ? f5 : f5 - 2 * each); }
    if (k < 6) {
        if (t == 0) {
            a.enter_zone(w, find_zone(zones[k]), Arrival::Entrance);
            w.level.bind_gpu();
            fprintf(stderr, "tour7: %s at frame %llu\n", a.name(), (unsigned long long)frame);
        }
        const ZoneLayout& L = a.zone.layout;
        if (t == 90) {   // skip ahead to the far court
            h.pos = w.level.resolve(L.center(L.cells[size_t(L.arena)]) + vec2{0, -5.f}, h.radius);
            for (size_t i = 1; i < w.actors.size(); i++)
                if (w.actors[i].rarity != Rarity::Unique && length(w.actors[i].pos - h.pos) < 10.f) w.actors[i].life = 0, w.actors[i].act = Act::Dead, w.actors[i].dead_t = 3;
        }
        if (k == 5 && t == 230)   // the Deep Tomb's marid falls, for the glimpse of what lies below
            for (size_t i = 1; i < w.actors.size(); i++) if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) w.actors[i].life = 1;
        if (k == 5 && t > 300 && w.coil_t >= 0) {   // to the edge of the pit, to watch
            steer(w, in, w.coil_at - normalize(w.coil_at - L.center(L.cells[size_t(L.arena)])) * 3.f);
            return;
        }
        combat(w, in, frame, t > 90 ? 30.f : 9.f);
        return;
    }
    // a chart with a Marid Rift
    if (k == 6 && t == 0) {
        H.quests |= Q_MARID | Q_ACT2;
        Rng r(3);
        a.enter_chart(w, find_site("iskandariya"), make_chart(1, r, 0.f, 0.f));
        w.level.bind_gpu();
        w.rift = Rift{};
        w.rift.armed = true;
        w.rift.pos = w.level.resolve(h.pos + vec2{0, 4.5f}, 0.5f);
    }
    if (k == 6) { combat(w, in, frame, 12.f); return; }
    pass("tour7 done");
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
