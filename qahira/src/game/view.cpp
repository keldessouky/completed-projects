#include "game/view.hpp"
#include <cstdio>
#include <cstdlib>
#include "ui/ui.hpp"
#include "game/menu.hpp"
#include <cstdio>

namespace q {

static const char* weapon_mesh(uint8_t wkind) { return wkind == WK_STAFF ? "staff" : wkind == WK_BOW ? "bow" : "maul"; }

void View::follow(const World& w, float dt, bool snap) {
    const Actor& h = w.actors[0];
    vec2 tp = h.pos + h.vel * 0.15f;
    vec3 target{tp.x, tp.y + 0.8f, 0.6f};
    // QAHIRA_CAM=dist,pitch: a closer look for art checks (dev hosts only)
    static const vec2 dp = [] {
        vec2 v{18.f, 55.f};
        if (const char* e = getenv("QAHIRA_CAM")) sscanf(e, "%f,%f", &v.x, &v.y);
        return v;
    }();
    float d = dp.x, pitch = radians(dp.y);
    vec3 off{0, -d * std::cos(pitch), d * std::sin(pitch)};
    cam.target = snap ? target : lerp(cam.target, target, std::min(1.f, dt * 8.f));
    cam.eye = cam.target + off;
    if (w.shake > 0) {
        float s = w.shake * w.shake * 0.35f;
        vec3 j{std::sin(w.time * 71.f) * s, std::sin(w.time * 57.f + 1.f) * s, std::sin(w.time * 63.f + 2.f) * s * 0.5f};
        cam.eye += j;
        cam.target += j;
    }
    cam.fovy = radians(30.f);
    for (auto& f : flashes) f.t += dt;
    flashes.erase(std::remove_if(flashes.begin(), flashes.end(), [](const Flash& f) { return f.t >= f.life; }), flashes.end());
    const Actor& ha = w.actors[0];
    shown_life = damp(shown_life, ha.life / std::max(1.f, ha.life_max), 10.f, dt);
    shown_mana = damp(shown_mana, ha.mana / std::max(1.f, ha.mana_max), 10.f, dt);
    banner_t = std::max(0.f, banner_t - dt);
}

void View::on_events(const World& w) {
    for (const Event& e : w.events) {
        switch (e.type) {
            case Ev::SlamImpact: flashes.push_back({vec3(e.pos, 0.6f), hex_lin(0xFFA040) * 30.f * e.mag, 6.f, 0, 0.25f}); break;
            case Ev::Aftershock: flashes.push_back({vec3(e.pos, 0.8f), hex_lin(0xFF8030) * 40.f, 9.f, 0, 0.3f}); break;
            case Ev::Warcry: flashes.push_back({vec3(e.pos, 1.2f), hex_lin(0xF2A541) * 25.f, 8.f, 0, 0.4f}); break;
            case Ev::Break: flashes.push_back({vec3(e.pos, 1.0f), hex_lin(0xFF2E88) * 20.f, 4.f, 0, 0.3f}); break;
            case Ev::LevelUp: banner = "Level " + std::to_string(w.hero.level); banner_sub = "Your life and mana grow."; banner_t = 2.5f; break;
            default: break;
        }
    }
}

void View::draw_skinned(Renderer& r, const CharacterModel& m, const Animator& anim, vec2 pos, float facing, float scale, Instance in) {
    GpuMesh* body = m.body ? m.body : assets().mesh(m.name);
    if (!m.skel || !body) return;
    pose_.resize(m.skel->bones.size());
    anim.pose(pose_, scratch_);
    mat4 root = mat4::translate(vec3(pos, 0)) * mat4::rot_z(facing + kPi / 2) * mat4::scale({scale, scale, scale});
    pose_.compute_model(*m.skel, root);
    int off = r.alloc_palette(int(m.skel->bones.size()));
    if (off < 0) return;
    pose_.write_palette(*m.skel, r.palette(off));
    in.extra.x = float(off);
    r.draw(body, in);
}

void View::draw_portal(Renderer& r, const World& w, vec2 pos, vec3 color, float t) {
    // a standing oval of swirling motes around a soft core, facing the camera
    vec3 c(pos, 1.35f);
    for (int i = 0; i < 30; i++) {
        float a = t * 1.7f + i * kTau / 30.f;
        float k = 0.85f + 0.15f * std::sin(t * 3.f + i * 1.3f);
        vec3 p = c + vec3{std::cos(a) * 0.78f * k, 0, std::sin(a) * 1.18f * k};
        r.billboard(p, 0.22f, vec4(color * 1.6f, 0.9f), {0, 1.4f, 0, 3}, Blend::Additive);
    }
    for (int i = 0; i < 3; i++) r.billboard(c + vec3{0, 0.01f * i, (i - 1) * 0.45f}, 1.2f, vec4(color * 0.5f, 0.45f), {0, 1.f, 0, 1}, Blend::Additive);
    r.ground(vec3(pos, 0.02f), 1.1f + 0.05f * std::sin(t * 2.f), vec4(color, 0.55f), {1, 0.1f, 0, 2}, Blend::Additive);
    r.light(c, 6.5f, color * 16.f);
    (void)w;
}

void View::draw_actor(Renderer& r, World& w, Actor& a, int index) {
    if (!a.model.body && !a.model.name.empty()) a.model.body = assets().mesh(a.model.name);
    const CharacterModel& m = a.model;
    if (!m.skel && m.body && index > 0) {
        // a possessed object: one mesh that sways, shudders when struck and lurches as it attacks
        Instance in;
        float sway = std::sin(w.time * 3.1f + a.id) * 0.03f + (a.act == Act::Skill ? std::sin(a.act_t * 40.f) * 0.04f : 0.f);
        float dissolve = a.act == Act::Dead ? clampf((a.dead_t - 0.85f) / 1.0f, 0, 1) : 0;
        in.model = mat4::translate(vec3(a.pos, 0)) * mat4::rot_z(a.facing + kPi / 2) * mat4::rotate(quat::axis_angle({1, 0, 0}, sway)) *
                   mat4::scale({a.scale, a.scale, a.scale});
        in.tint = vec4(a.tint, 1);
        in.extra = {-1, 0.15f + 0.1f * std::sin(w.time * 7.f + a.id), a.hit_flash * 0.6f, dissolve};
        in.rim = a.rarity == Rarity::Unique ? vec4(hex_lin(0xE08A3C), 0.4f) : vec4(hex_lin(0xFF2E88), 0.35f);
        if (a.broken_t > 0) in.rim = vec4(hex_lin(0xFF2E88), 1.2f);
        if (a.frozen_t > 0) in.rim = vec4(hex_lin(0x9FD8FF), 1.4f);
        r.draw(m.body, in);
        r.light(vec3(a.pos, 1.5f * a.scale), 4.f * a.scale, hex_lin(0x7AA8FF) * 6.f);
        if (dissolve < 1) r.ground(vec3(a.pos, 0), 1.0f * a.scale + a.radius * 0.5f, vec4(0, 0, 0, 0.5f * (1 - dissolve)), {0, 1.5f, 0, 1}, Blend::Alpha);
        return;
    }
    if (!m.skel || !m.body) return;
    pose_.resize(m.skel->bones.size());
    a.anim.pose(pose_, scratch_);
    mat4 root = mat4::translate(vec3(a.pos, 0)) * mat4::rot_z(a.facing + kPi / 2) * mat4::scale({a.scale, a.scale, a.scale});
    pose_.compute_model(*m.skel, root);
    int off = r.alloc_palette(int(m.skel->bones.size()));
    if (off < 0) return;
    pose_.write_palette(*m.skel, r.palette(off));
    Instance in;
    in.tint = vec4(a.tint, 1);
    float dissolve = a.act == Act::Dead ? clampf((a.dead_t - 0.85f) / 1.0f, 0, 1) : 0;
    in.extra = {float(off), 0, a.hit_flash * (index == 0 ? 0.18f : 0.6f), dissolve};
    if (index == 0) in.rim = vec4(hex_lin(0xF2A541), 0.2f);
    else if (a.rarity == Rarity::Unique) in.rim = vec4(hex_lin(0xE08A3C), 0.3f);
    else if (a.rarity == Rarity::Rare) in.rim = vec4(hex_lin(0xF5D76E), 0.9f);
    else if (a.rarity == Rarity::Magic) in.rim = vec4(hex_lin(0x7AA8FF), 0.7f);
    else in.rim = vec4(hex_lin(0xFF2E88), 0.25f);
    if (a.broken_t > 0) in.rim = vec4(hex_lin(0xFF2E88), 1.2f);
    // ailments: frost whitens and stills, shock flickers blue, fire glows from within
    if (a.frozen_t > 0) { in.tint = vec4(lerp(a.tint, vec3{0.75f, 0.9f, 1.2f}, 0.75f), 1); in.rim = vec4(hex_lin(0x9FD8FF), 1.4f); }
    else if (a.chill_t > 0) in.tint = vec4(lerp(a.tint, vec3{0.7f, 0.85f, 1.1f}, 0.35f), 1);
    if (a.shock_t > 0 && std::sin(w.time * 40.f + a.id) > 0.3f) in.rim = vec4(hex_lin(0xA8B8FF), 1.3f);
    if (a.ignite_t > 0) in.extra.y = 0.25f + 0.1f * std::sin(w.time * 17.f + a.id);
    bool poisoned = false;
    for (float pt : a.poison_t) poisoned = poisoned || pt > 0;
    if (poisoned) in.tint = vec4(lerp(vec3(in.tint.x, in.tint.y, in.tint.z), vec3{0.55f, 0.9f, 0.35f}, 0.3f), 1);
    r.draw(m.body, in);
    if (a.mark_t > 0 && a.alive()) {   // a Falcon's Mark: a turning sigil at the feet and a bright point overhead
        float t = w.time * 1.5f;
        r.ground(vec3(a.pos, 0.03f), 0.9f * a.scale + a.radius * 0.4f, vec4(1.f, 0.82f, 0.4f, 0.55f), {1, 0.06f, 0, 2}, Blend::Additive, t);
        r.billboard(vec3(a.pos, 2.3f * a.scale + 0.2f * std::sin(t * 2.f)), 0.3f, vec4(1.f, 0.85f, 0.5f, 0.9f), {0, 1.5f, 0, 4});
    }
    if (index == 0 && m.weapon_bone >= 0) {
        Instance wpn;
        bool bow = w.hero.weapon().b().wkind == WK_BOW;   // a bow is held in the left hand
        wpn.model = pose_.model[size_t(bow && m.weapon_bone_l >= 0 ? m.weapon_bone_l : m.weapon_bone)];
        wpn.rim = in.rim;
        wpn.extra = {-1, 0, a.hit_flash * 0.5f, 0};
        uint32_t rc = rarity_color(w.hero.weapon().rarity);
        if (w.hero.weapon().rarity != Rarity::Normal) wpn.rim = vec4(hex_lin(rc), 0.6f);
        r.draw(assets().mesh(weapon_mesh(w.hero.weapon().b().wkind)), wpn);
        vec3 hip = pose_.model[size_t(m.pelvis)].translation();
        r.light(hip + vec3{0, 0, 0.3f}, 6.5f, hex_lin(0xFFB04A) * 14.f);
    }
    if (dissolve < 1) r.ground(vec3(a.pos, 0), 0.75f * a.scale, vec4(0, 0, 0, 0.5f * (1 - dissolve)), {0, 1.5f, 0, 1}, Blend::Alpha);
}

void View::render_world(Renderer& r, World& w) {
    const Actor& h = w.actors[0];
    w.level.render(r, w.time, h.pos);
    for (size_t i = 0; i < w.actors.size(); i++) draw_actor(r, w, w.actors[i], int(i));
    for (auto& n : w.npcs) {
        Instance in;
        in.rim = vec4(hex_lin(0xF2A541), 0.12f);
        if (n.rigged) draw_skinned(r, n.cm, n.anim, n.pos, n.facing, n.scale, in);
        else {
            float breathe = 1.f + 0.02f * std::sin(w.time * 2.1f);
            in.model = mat4::translate(vec3(n.pos, 0)) * mat4::rot_z(n.facing + kPi / 2) * mat4::scale({n.scale, n.scale, n.scale * breathe});
            in.extra = {-1, 0, 0, 0};
            r.draw(assets().mesh(n.model), in);
        }
        r.ground(vec3(n.pos, 0), 0.6f * n.scale, vec4(0, 0, 0, 0.45f), {0, 1.5f, 0, 1}, Blend::Alpha);
    }
    for (size_t i = 0; i < w.interacts.size(); i++) {
        const Interactable& it = w.interacts[i];
        bool near = int(i) == w.near_interact;
        switch (it.kind) {
            case Interactable::Portal: draw_portal(r, w, it.pos, hex_lin(0x7A8CFF), w.time); break;
            case Interactable::Exit: draw_portal(r, w, it.pos, hex_lin(0xF2C060), w.time * 1.2f); break;
            case Interactable::Chest: {
                Instance in;
                in.model = mat4::translate(vec3(it.pos, 0)) * mat4::rot_z(it.facing);
                in.extra = {-1, 0, 0, 0};
                in.rim = vec4(hex_lin(0xF2A541), it.spent ? 0.f : 0.25f + (near ? 0.4f : 0.f));
                r.draw(assets().mesh(it.spent ? "chest_open" : "chest"), in);
                if (!it.spent) r.light(vec3(it.pos, 1.0f), 4.f, hex_lin(0xFFB050) * (near ? 10.f : 5.f));
                r.ground(vec3(it.pos, 0), 0.9f, vec4(0, 0, 0, 0.5f), {0, 1.5f, 0, 1}, Blend::Alpha);
                break;
            }
            case Interactable::Stair:
                r.ground(vec3(it.pos, 0.02f), 1.2f + 0.08f * std::sin(w.time * 2.f), vec4(hex_lin(0xF2A541), near ? 0.7f : 0.3f), {1, 0.08f, 0, 2},
                         Blend::Additive);
                break;
            default: break;
        }
    }
    // ground effects
    for (auto& g : w.ground) {
        float k = g.t / g.life;
        if (g.kind == GroundFx::Crack) {
            float fade = 1.f - smoothstep(0.75f, 1.f, k);
            float seed = float(g.seed % 1000) * 0.01f;
            r.ground(vec3(g.pos, 0), g.radius, vec4(0.03f, 0.02f, 0.02f, 0.9f * fade), {5, seed, 0, 1}, Blend::Alpha, seed);
            float glow = 0.5f + 0.5f * std::sin(w.time * 5.f + seed);
            r.ground(vec3(g.pos, 0.01f), g.radius * 0.96f, vec4(1.f, 0.45f, 0.12f, (0.35f + 0.25f * glow) * fade), {5, seed, 0, 2.5f}, Blend::Additive, seed);
        } else if (g.kind == GroundFx::Telegraph) {
            float a = 0.25f + 0.55f * k;
            if (g.half >= kPi - 0.01f) {
                r.ground(vec3(g.pos, 0), g.radius, vec4(1.f, 0.18f, 0.53f, a * 0.5f), {2, 0.05f, 0, 1}, Blend::Alpha);
                r.ground(vec3(g.pos, 0.01f), g.radius * k, vec4(1.f, 0.18f, 0.53f, a), {1, 0.12f, 0, 1.5f}, Blend::Additive);
            } else {
                r.ground(vec3(g.pos, 0), g.radius, vec4(1.f, 0.18f, 0.53f, a * 0.55f), {4, g.half, 0, 1}, Blend::Alpha, g.angle - kPi / 2);
            }
        } else if (g.kind == GroundFx::Ring) {
            r.ground(vec3(g.pos, 0.05f), g.radius * (0.3f + 0.7f * k), vec4(1.f, 0.7f, 0.3f, 1 - k), {1, 0.08f, 0, 3}, Blend::Additive);
        } else if (g.kind == GroundFx::Glyph) {
            // an inscribed circle with a slowly turning star inside, bright as it pulses
            float in_a = smoothstep(0.f, 0.3f, g.t) * (1.f - smoothstep(g.life - 0.5f, g.life, g.t));
            float beat = 0.6f + 0.4f * std::exp(-4.f * (g.t - std::floor(g.t)));
            vec4 ice{0.45f, 0.75f, 1.f, 0.55f * in_a * beat};
            r.ground(vec3(g.pos, 0.02f), g.radius, ice, {1, 0.05f, 0, 2}, Blend::Additive);
            r.ground(vec3(g.pos, 0.02f), g.radius * 0.78f, ice * 0.8f, {1, 0.03f, 0, 2}, Blend::Additive);
            r.ground(vec3(g.pos, 0.01f), g.radius, vec4(0.2f, 0.4f, 0.8f, 0.18f * in_a), {0, 1.5f, 0, 1}, Blend::Additive);
            for (int i = 0; i < 8; i++) {  // the star: short bright points round the rim
                float a = g.t * 0.4f + i * kTau / 8;
                r.billboard(vec3(g.pos + from_angle(a) * g.radius * 0.78f, 0.1f), 0.22f, vec4(0.6f, 0.85f, 1.f, 0.8f * in_a), {0, 1.5f, 0, 3});
            }
            r.light(vec3(g.pos, 1.0f), g.radius * 2.f, hex_lin(0x6FA8FF) * 6.f * in_a * beat);
        } else if (g.kind == GroundFx::Meteor) {
            // the telegraph on the ground and the star coming down onto it
            r.ground(vec3(g.pos, 0.02f), g.radius, vec4(1.f, 0.55f, 0.2f, 0.3f + 0.5f * k), {2, 0.05f, 0, 1}, Blend::Additive);
            r.ground(vec3(g.pos, 0.03f), g.radius * k, vec4(1.f, 0.7f, 0.3f, 0.7f), {1, 0.1f, 0, 1.5f}, Blend::Additive);
            vec3 p = vec3(g.pos, 0) + vec3{-3.f, 2.f, 12.f} * (1.f - k);
            r.billboard(p, 0.9f, vec4(1.f, 0.85f, 0.5f, 1), {0, 1.5f, 0, 4});
            r.billboard(p + vec3{-0.6f, 0.4f, 2.4f} * 0.5f, 0.6f, vec4(1.f, 0.5f, 0.2f, 0.6f), {0, 1.5f, 0, 4});
            r.light(p, 8.f, hex_lin(0xFFB060) * 20.f);
        } else if (g.kind == GroundFx::Rain) {
            // where the volleys land: a dusty ring, a thud of light on each volley
            float in_a = smoothstep(0.f, 0.1f, g.t) * (1.f - smoothstep(g.life - 0.2f, g.life, g.t));
            float beat = std::exp(-8.f * std::fmod(g.t, 0.3f));
            r.ground(vec3(g.pos, 0.02f), g.radius, vec4(0.9f, 0.75f, 0.5f, 0.45f * in_a), {1, 0.05f, 0, 1.5f}, Blend::Additive);
            r.ground(vec3(g.pos, 0.01f), g.radius, vec4(0.5f, 0.42f, 0.3f, 0.35f * in_a * beat), {0, 1.2f, 0, 1}, Blend::Alpha);
        } else if (g.kind == GroundFx::Water) {
            // a pool of the canal's black water opening under you, rimmed with foam
            float in_a = smoothstep(0.f, 0.3f, g.t) * (1.f - smoothstep(g.life - 0.6f, g.life, g.t));
            float warn = g.t < g.pulse - 0.4f ? 0.5f + 0.5f * std::sin(g.t * 20.f) : 1.f;
            r.ground(vec3(g.pos, 0.02f), g.radius, vec4(0.05f, 0.12f, 0.16f, 0.8f * in_a), {0, 1.2f, 0, 1}, Blend::Alpha);
            r.ground(vec3(g.pos, 0.03f), g.radius, vec4(0.55f, 0.85f, 1.f, 0.55f * in_a * warn), {1, 0.07f, 0, 2}, Blend::Additive, w.time * 0.7f);
            r.light(vec3(g.pos, 0.6f), g.radius * 2.5f, hex_lin(0x5FB8E0) * 5.f * in_a);
        } else if (g.kind == GroundFx::Fire) {
            float in_a = smoothstep(0.f, 0.3f, g.t) * (1.f - smoothstep(g.life - 0.6f, g.life, g.t));
            r.ground(vec3(g.pos, 0.02f), g.radius, vec4(1.f, 0.35f, 0.08f, 0.55f * in_a), {0, 1.2f, 0, 2}, Blend::Additive);
            r.ground(vec3(g.pos, 0.03f), g.radius * 0.6f, vec4(1.f, 0.7f, 0.25f, 0.5f * in_a), {0, 1.5f, 0, 2.5f}, Blend::Additive);
            if (std::fmod(w.time * 13.f + g.pos.x, 1.f) < 0.5f)
                r.billboard(vec3(g.pos + vec2{std::sin(w.time * 9.f) * g.radius * 0.5f, std::cos(w.time * 7.f) * g.radius * 0.5f}, 0.4f), 0.35f,
                            vec4(1.f, 0.6f, 0.2f, 0.8f * in_a), {0, 1.5f, 0, 3});
            r.light(vec3(g.pos, 0.8f), g.radius * 3.f, hex_lin(0xFF7020) * 8.f * in_a);
        } else if (g.kind == GroundFx::Line) {
            // a telegraphed strip: discs along the line, filling as the strike nears
            vec2 ab = g.pos2 - g.pos;
            int n = std::max(2, int(length(ab) / (g.radius * 0.9f)));
            for (int i = 0; i <= n; i++) {
                vec2 p = g.pos + ab * (float(i) / n);
                r.ground(vec3(p, 0.01f), g.radius, vec4(1.f, 0.18f, 0.53f, (0.2f + 0.45f * k) * 0.5f), {0, 0.5f, 0, 1}, Blend::Alpha);
            }
        } else if (g.kind == GroundFx::Bolt) {
            // a jagged line of bright points from one end to the other
            float a = 1.f - k;
            vec3 p0 = vec3(g.pos, 1.2f), p1 = vec3(g.pos2, 1.1f);
            Rng jr(g.seed);
            int n = std::max(4, int(length(g.pos2 - g.pos) / 0.35f));
            for (int i = 0; i <= n; i++) {
                float t = float(i) / n;
                vec3 p = lerp(p0, p1, t) + vec3{jr.range(-0.25f, 0.25f), jr.range(-0.25f, 0.25f), jr.range(-0.2f, 0.2f)} * std::sin(t * kPi);
                r.billboard(p, 0.22f, vec4(0.75f, 0.85f, 1.f, a), {0, 1.5f, 0, 4});
            }
            r.light(p1, 5.f, hex_lin(0x9FB8FF) * 14.f * a);
        }
    }
    if (w.rift.armed && !w.rift.closed) {   // a Marid Rift: a seam of river light, and when open, its widening ring
        const Rift& rf = w.rift;
        float k = rf.open ? 1.f : 0.35f;
        for (int i = 0; i < 7; i++) {
            float z = 0.3f + i * 0.4f;
            float wob = 0.12f * std::sin(w.time * 5.f + i * 1.3f);
            r.billboard(vec3(rf.pos + vec2{wob, 0}, z), (0.5f - std::fabs(i - 3) * 0.08f) * (0.6f + 0.8f * k), vec4(0.5f, 0.9f, 1.f, 0.8f * k),
                        {0, 1.5f, 0, 4}, Blend::Additive);
        }
        r.light(vec3(rf.pos, 1.4f), rf.open ? rf.radius * 1.5f : 4.f, hex_lin(0x5FC8E8) * (rf.open ? 14.f : 5.f));
        if (rf.open) {
            r.ground(vec3(rf.pos, 0.03f), rf.radius, vec4(0.4f, 0.8f, 1.f, 0.55f), {1, 0.04f, 0, 2}, Blend::Additive, w.time * 0.4f);
            r.ground(vec3(rf.pos, 0.02f), rf.radius, vec4(0.05f, 0.2f, 0.3f, 0.35f), {0, 1.2f, 0, 1}, Blend::Alpha);
        }
    }
    if (w.coil_t >= 0 && w.coil_t < 14.f) {   // Act II's end: a coil of the serpent rises through the pit and slides away
        float k = w.coil_t / 14.f;
        float rise = std::sin(k * kPi);
        vec2 at = w.coil_at + w.coil_dir * (-16.f + 32.f * k);
        Instance in;
        in.model = mat4::translate(vec3(at, -2.4f + 2.0f * rise)) * mat4::rot_z(angle_of(w.coil_dir));
        in.rim = vec4(hex_lin(0x6A5AA0), 0.5f * rise);
        r.draw(assets().mesh("coil"), in);
    }
    for (auto& p : w.projectiles) {
        if (p.arrow) {   // a reed arrow along its flight, with a faint streak behind
            Instance in;
            in.model = mat4::translate(vec3(p.pos, p.z)) * mat4::rot_z(angle_of(p.vel) - kPi / 2);
            in.rim = vec4(p.color, 0.8f);
            r.draw(assets().mesh("arrow"), in);
            vec2 back = p.pos - normalize(p.vel) * 0.5f;
            r.billboard(vec3(back, p.z), 0.18f, vec4(p.color, 0.5f), {0, 1.5f, 0, 4}, Blend::Additive);
            continue;
        }
        r.billboard(vec3(p.pos, p.z), 0.35f, vec4(p.color, 1), {0, 1.5f, 0, 4});
        r.light(vec3(p.pos, p.z), 4.f, p.color * 8.f);
    }
    for (auto& p : w.particles) {
        float k = 1.f - p.life / p.max_life;
        vec4 c = p.c0 + (p.c1 + p.c0 * -1.f) * k;
        float s = lerpf(p.size0, p.size1, k);
        if (p.additive) r.billboard(p.pos, s, c, {0, 1.2f, 0, 3}, Blend::Additive);
        else r.billboard(p.pos, s, c, {0, 0.8f, 0, 1}, Blend::Alpha);
    }
    for (auto& g : w.loot) {
        if (!w.loot_visible(g)) continue;
        float pulse = 0.8f + 0.2f * std::sin(w.time * 3 + g.id);
        float spin = float(g.id % 628) * 0.01f;
        float drop = std::max(0.f, 1.f - g.t / 0.35f);                  // a little hop as it lands
        float z = 0.02f + std::sin(std::min(1.f, g.t / 0.35f) * kPi) * 0.6f * (drop > 0 ? 1.f : 0.f);
        Instance in;
        in.extra = {-1, 0, 0, 0};
        if (g.kind == GroundItem::Gold) {
            in.model = mat4::translate(vec3(g.pos, z)) * mat4::rot_z(spin);
            in.rim = vec4(hex_lin(0xF5D76E), 0.3f);
            r.draw(assets().mesh("loot_coins"), in);
            continue;
        }
        if (g.kind == GroundItem::Wafq || g.kind == GroundItem::Blank || g.kind == GroundItem::Scrap) {
            // a small clay tablet: turquoise for a Wafq, brass for a Blank Talisman; a Poster Scrap in its poster's paint
            vec3 c = g.kind == GroundItem::Wafq ? hex_lin(0x2BB5AE) : g.kind == GroundItem::Blank ? hex_lin(0xD4A84B)
                                                                   : hex_lin(unique_def(g.amount).poster[0]);
            in.model = mat4::translate(vec3(g.pos, z)) * mat4::rot_z(spin);
            in.tint = vec4(c, 1);
            in.rim = vec4(c, 0.9f);
            r.draw(assets().mesh("loot_tablet"), in);
            r.ground(vec3(g.pos, 0), 0.5f, vec4(c, 0.6f * pulse), {0, 2, 0, 2}, Blend::Additive);
            r.beam(vec3(g.pos, 0), 4.5f, 0.28f, vec4(c, 0.7f * pulse));
            continue;
        }
        if (g.kind == GroundItem::Currency) {
            vec3 c = hex_lin(currency_def(g.currency).color);
            in.model = mat4::translate(vec3(g.pos, z)) * mat4::rot_z(spin) * mat4::scale({1.4f, 1.4f, 1.4f});
            in.tint = vec4(c, 1);
            in.rim = vec4(c, 0.9f);
            r.draw(assets().mesh("loot_bead"), in);
            r.ground(vec3(g.pos, 0), 0.45f, vec4(c, 0.55f * pulse), {0, 2, 0, 2}, Blend::Additive);
            if (g.currency >= CUR_SAFFRON) r.beam(vec3(g.pos, 0), 4.f, 0.25f, vec4(c, 0.6f * pulse));
            continue;
        }
        vec3 c = hex_lin(rarity_color(g.item.rarity));
        if (g.item.rarity >= Rarity::Rare) r.beam(vec3(g.pos, 0), 5.f, 0.35f, vec4(c, 0.8f * pulse));
        r.ground(vec3(g.pos, 0), 0.5f, vec4(c, 0.6f * pulse), {0, 2, 0, 2}, Blend::Additive);
        in.rim = vec4(c, 0.8f);
        Slot sl = g.item.b().slot;
        if (sl == Slot::Weapon) {
            in.model = mat4::translate(vec3(g.pos, z + 0.1f)) * mat4::rotate(quat::axis_angle({0, 1, 0}, kPi / 2)) * mat4::rot_z(spin);
            r.draw(assets().mesh(weapon_mesh(g.item.b().wkind)), in);
        } else {
            bool jewel = sl == Slot::Amulet || sl == Slot::Ring;
            in.model = mat4::translate(vec3(g.pos, z)) * mat4::rot_z(spin) * mat4::scale(jewel ? vec3{1.6f, 1.6f, 1.6f} : vec3{1, 1, 1});
            in.tint = vec4(jewel ? vec3{1, 1, 1} : lerp(c, vec3{1, 1, 1}, 0.55f), 1);
            r.draw(assets().mesh(jewel ? "loot_trinket" : "loot_bundle"), in);
        }
    }
    for (auto& f : flashes) {
        float k = 1.f - f.t / f.life;
        r.light(f.pos, f.radius, f.color * k);
    }
}

// ---------------------------------------------------------------- HUD
void draw_button_glyph(float cx, float cy, float s, int b) {
    Ui& u = ui();
    if (b <= BTN_NORTH) {
        // four dots in a diamond, the pressed position filled: reads the same on Xbox and Nintendo labels
        const vec2 at[4] = {{0, 1}, {1, 0}, {-1, 0}, {0, -1}};  // south, east, west, north
        for (int i = 0; i < 4; i++) {
            float x = cx + at[i].x * s * 0.42f, y = cy + at[i].y * s * 0.42f;
            if (i == b) u.disc(x, y, s * 0.26f, pal::bone);
            else u.ring(x, y, s * 0.2f, s * 0.14f, pal::dim);
        }
        return;
    }
    u.frame(cx - s * 0.6f, cy - s * 0.38f, s * 1.2f, s * 0.76f, pal::panel2, pal::dim, s * 0.2f, 2);
    if (b == BTN_START) {
        for (int i = -1; i <= 1; i++) u.line(cx - s * 0.24f, cy + i * s * 0.14f, cx + s * 0.24f, cy + i * s * 0.14f, s * 0.07f, pal::bone);
        return;
    }
    const char* t = b == BTN_R1 ? "R1" : b == BTN_R2 ? "R2" : b == BTN_L1 ? "L1" : b == BTN_L2 ? "L2" : b == BTN_L3 ? "M1" :
                    b == BTN_R3 ? "M2" : b == BTN_LEFT ? "\xE2\x86\x90" : b == BTN_UP ? "\xE2\x86\x91" : b == BTN_RIGHT ? "\xE2\x86\x92" :
                    b == BTN_DOWN ? "\xE2\x86\x93" : b == BTN_SELECT ? "SEL" : "?";
    u.text(cx, cy - s * 0.32f, t, s * 0.5f, pal::bone, Align::Center, 1);
}

void draw_skill_icon(float cx, float cy, float s, int glyph, bool ready) {
    Ui& u = ui();
    Rgba c = ready ? pal::amber : pal::dim;
    switch (glyph) {
        case 0:  // crushing blow: a heavy arc
            for (int i = 0; i < 9; i++) {
                float a0 = radians(200 + i * 16.f), a1 = radians(200 + (i + 1) * 16.f);
                u.line(cx + std::cos(a0) * s * 0.34f, cy + std::sin(a0) * s * 0.34f, cx + std::cos(a1) * s * 0.34f, cy + std::sin(a1) * s * 0.34f, s * 0.1f, c);
            }
            u.disc(cx + std::cos(radians(344)) * s * 0.34f, cy + std::sin(radians(344)) * s * 0.34f, s * 0.12f, c);
            break;
        case 1:  // earthshatter: cracks
            u.line(cx, cy + s * 0.3f, cx - s * 0.1f, cy - s * 0.05f, s * 0.07f, c);
            u.line(cx - s * 0.1f, cy - s * 0.05f, cx + s * 0.05f, cy - s * 0.32f, s * 0.07f, c);
            u.line(cx, cy + s * 0.3f, cx + s * 0.28f, cy + s * 0.05f, s * 0.06f, c);
            u.line(cx, cy + s * 0.3f, cx - s * 0.32f, cy + s * 0.18f, s * 0.06f, c);
            u.rect(cx - s * 0.36f, cy + s * 0.28f, s * 0.72f, s * 0.06f, c);
            break;
        case 2:  // rallying shout: rings
            u.ring(cx, cy, s * 0.36f, s * 0.3f, c);
            u.ring(cx, cy, s * 0.22f, s * 0.16f, c);
            u.disc(cx, cy, s * 0.08f, c);
            break;
        case 3:  // aftershock: a burst
            for (int i = 0; i < 8; i++) {
                float a = i * kPi / 4;
                u.line(cx + std::cos(a) * s * 0.12f, cy + std::sin(a) * s * 0.12f, cx + std::cos(a) * s * 0.38f, cy + std::sin(a) * s * 0.38f, s * 0.07f, c);
            }
            break;
        case 4:  // ember bolt: a flame with a tail
            u.disc(cx + s * 0.12f, cy - s * 0.1f, s * 0.16f, c);
            u.line(cx + s * 0.08f, cy - s * 0.06f, cx - s * 0.3f, cy + s * 0.3f, s * 0.12f, c.alpha(0.7f));
            u.line(cx - s * 0.02f, cy - s * 0.2f, cx - s * 0.28f, cy + s * 0.08f, s * 0.05f, c.alpha(0.5f));
            u.line(cx + s * 0.22f, cy + s * 0.04f, cx - s * 0.06f, cy + s * 0.34f, s * 0.05f, c.alpha(0.5f));
            break;
        case 5:  // frost glyph: a circle inscribed with a star
            u.ring(cx, cy, s * 0.36f, s * 0.31f, c);
            for (int i = 0; i < 6; i++) {
                float a0 = i * kTau / 6, a1 = (i + 2) * kTau / 6;
                u.line(cx + std::cos(a0) * s * 0.3f, cy + std::sin(a0) * s * 0.3f, cx + std::cos(a1) * s * 0.3f, cy + std::sin(a1) * s * 0.3f, s * 0.035f, c);
            }
            break;
        case 6:  // arc: a zig-zag bolt
            u.line(cx - s * 0.3f, cy - s * 0.3f, cx - s * 0.02f, cy - s * 0.02f, s * 0.07f, c);
            u.line(cx - s * 0.02f, cy - s * 0.02f, cx - s * 0.12f, cy + s * 0.06f, s * 0.07f, c);
            u.line(cx - s * 0.12f, cy + s * 0.06f, cx + s * 0.3f, cy + s * 0.32f, s * 0.07f, c);
            u.disc(cx + s * 0.3f, cy - s * 0.2f, s * 0.06f, c);
            u.disc(cx - s * 0.32f, cy + s * 0.22f, s * 0.05f, c);
            break;
        case 7:  // falling star: a star over a streak
            u.line(cx + s * 0.34f, cy - s * 0.34f, cx - s * 0.05f, cy + s * 0.05f, s * 0.06f, c.alpha(0.6f));
            for (int i = 0; i < 5; i++) {
                float a0 = -kPi / 2 + i * kTau / 5, a1 = -kPi / 2 + (i + 2) * kTau / 5;
                u.line(cx - s * 0.1f + std::cos(a0) * s * 0.22f, cy + s * 0.1f + std::sin(a0) * s * 0.22f, cx - s * 0.1f + std::cos(a1) * s * 0.22f,
                       cy + s * 0.1f + std::sin(a1) * s * 0.22f, s * 0.05f, c);
            }
            break;
        case 8:  // split arrow: three arrows fanning out
            for (int i = -1; i <= 1; i++) {
                float a = radians(-45 + i * 22.f), ca = std::cos(a), sa = std::sin(a);
                float x0 = cx - s * 0.3f, y0 = cy + s * 0.3f, x1 = x0 + ca * s * 0.66f, y1 = y0 + sa * s * 0.66f;
                u.line(x0, y0, x1, y1, s * 0.045f, c);
                u.line(x1, y1, x1 - std::cos(a - 0.5f) * s * 0.14f, y1 - std::sin(a - 0.5f) * s * 0.14f, s * 0.045f, c);
                u.line(x1, y1, x1 - std::cos(a + 0.5f) * s * 0.14f, y1 - std::sin(a + 0.5f) * s * 0.14f, s * 0.045f, c);
            }
            break;
        case 9:  // falcon's mark: a ring with sights, and the falcon's eye
            u.ring(cx, cy, s * 0.34f, s * 0.29f, c);
            for (int i = 0; i < 4; i++) {
                float a = i * kPi / 2;
                u.line(cx + std::cos(a) * s * 0.2f, cy + std::sin(a) * s * 0.2f, cx + std::cos(a) * s * 0.42f, cy + std::sin(a) * s * 0.42f, s * 0.05f, c);
            }
            u.disc(cx, cy, s * 0.1f, c);
            break;
        case 10:  // rain of arrows: shafts falling in a slant
            for (int i = 0; i < 5; i++) {
                float x = cx - s * 0.3f + i * s * 0.15f, y = cy - s * 0.3f + (i % 2) * s * 0.14f;
                u.line(x, y, x - s * 0.06f, y + s * 0.4f, s * 0.04f, c);
                u.line(x - s * 0.06f, y + s * 0.4f, x - s * 0.12f, y + s * 0.3f, s * 0.04f, c);
                u.line(x - s * 0.06f, y + s * 0.4f, x + s * 0.02f, y + s * 0.31f, s * 0.04f, c);
            }
            break;
        case 11: {  // scorpion sting: the tail curled over, a drop at its point
            float px = cx - s * 0.28f, py = cy + s * 0.3f;
            for (int i = 1; i <= 8; i++) {
                float a = radians(180 + i * 25.f), x = cx + std::cos(a) * s * 0.26f, y = cy + s * 0.04f + std::sin(a) * s * 0.3f;
                u.line(px, py, x, y, s * (0.1f - i * 0.007f), c);
                px = x; py = y;
            }
            u.line(px, py, px - s * 0.05f, py + s * 0.14f, s * 0.05f, c);
            u.disc(px - s * 0.06f, py + s * 0.24f, s * 0.06f, Rgba::hex(0x8FD14F).alpha(ready ? 1.f : 0.5f));
            break;
        }
        default: break;
    }
}

static vec2 to_ui(const Camera& cam, vec3 p) {
    vec2 s = cam.to_screen(p);
    return {s.x * 1920.f, s.y * 1080.f};
}

static void orb(float cx, float cy, float r, float frac, Rgba fill, Rgba glow, const char* label) {
    Ui& u = ui();
    u.disc(cx, cy, r + 10, pal::night.alpha(0.85f));
    u.disc(cx, cy, r, Rgba::hex(0x120E18));
    u.arc_fill(cx, cy, r - 2, frac, fill);
    u.arc_fill(cx, cy, r - 2, std::max(0.f, frac - 0.03f), glow.alpha(0.35f));
    u.ring(cx, cy, r + 6, r, pal::brass);
    u.text(cx, cy - 18, label, 30, pal::bone, Align::Center, 1.2f, true);
}

float draw_item_card(float x, float y, float bw, const Item& it, const World& world, const Item* compare, const std::string& footer, bool draw) {
    Ui& u = ui();
    auto lines = it.lines();
    float lh = 36;
    bool rare = it.rarity >= Rarity::Rare;
    float head = rare ? 96 : 64;
    float bh = head + 16 + lines.size() * lh + 14;
    bool delta = compare && it.b().slot == Slot::Weapon;
    if (delta) bh += 44;
    if (!footer.empty()) bh += 44;
    if (!draw) return bh;
    Rgba rc = Rgba::hex(rarity_color(it.rarity));
    u.frame(x, y, bw, bh, pal::panel.alpha(0.97f), rc.alpha(0.8f), 12, 2);
    u.rect(x + 2, y + 2, bw - 4, head - 4, rc.alpha(0.12f), 10);
    std::string title = it.display_name();
    float ts = std::min(34.f, 34.f * (bw - 36) / std::max(1.f, u.text_width(title, 34)));  // long names shrink to fit
    u.text(x + bw / 2, y + 12 + (34 - ts) * 0.5f, title, ts, rc, Align::Center, 1.2f);
    if (rare) u.text(x + bw / 2, y + 52, it.b().name, 26, rc.alpha(0.8f), Align::Center);
    float cy = y + head + 12;
    for (auto& l : lines) {
        Rgba c = pal::bone;
        std::string s = l;
        if (!s.empty() && s[0] == '~') { c = pal::soft; s = s.substr(1); }
        if (!s.empty() && s[0] == '#') { c = pal::dim; s = s.substr(1); }
        else if (s.find(':') == std::string::npos && c.r == pal::bone.r) c = pal::magic;
        u.text(x + bw / 2, cy, s, 28, c, Align::Center);
        cy += lh;
    }
    if (delta) {
        float d = world.hero_dps(it) - world.hero_dps(*compare);
        char b[64];
        const Talisman* mt = world.hero.slot_talisman(world.main_slot());
        snprintf(b, sizeof b, "%+.1f DPS with %s", d, mt ? mt->def().name : "your skill");
        u.text(x + bw / 2, cy + 6, b, 30, d >= 0 ? pal::good : pal::bad, Align::Center, 1);
        cy += 44;
    }
    if (!footer.empty()) u.text(x + bw / 2, cy + 6, footer, 28, pal::rare, Align::Center, 0.8f);
    return bh;
}

void View::render_map(const World& w, const Areas& areas) {
    if (!map_open || areas.current != AreaId::Zone) return;
    Ui& u = ui();
    const ZoneInstance& z = areas.zone;
    const ZoneLayout& L = z.layout;
    vec2 hp = w.actors[0].pos;
    float s = 12.f;
    auto to = [&](vec2 p) { return vec2{960 + (p.x - hp.x) * s, 560 - (p.y - hp.y) * s}; };
    float lane = 5.4f * s * 0.5f, half = L.cell * s * 0.5f;
    u.rect(0, 0, 1920, 1080, pal::night.alpha(0.35f));
    // unexplored cells that open off explored ones: faint, so you know where the lanes lead
    for (size_t i = 0; i < L.cells.size(); i++) {
        if (i >= z.revealed.size() || z.revealed[i]) continue;
        const ZoneCell& c = L.cells[i];
        bool near_known = false;
        const int dx[4] = {0, 1, 0, -1}, dy[4] = {1, 0, -1, 0};
        for (int k = 0; k < 4; k++)
            if (const ZoneCell* n = L.at(c.x + dx[k], c.y + dy[k])) {
                size_t ni = size_t(n - L.cells.data());
                if (ni < z.revealed.size() && z.revealed[ni]) near_known = true;
            }
        if (!near_known) continue;
        vec2 p = to(L.center(c));
        u.rect(p.x - half + 2, p.y - half + 2, half * 2 - 4, half * 2 - 4, pal::sand.alpha(0.06f), 6);
    }
    for (size_t i = 0; i < L.cells.size(); i++) {
        if (i >= z.revealed.size() || !z.revealed[i]) continue;
        const ZoneCell& c = L.cells[i];
        vec2 p = to(L.center(c));
        u.rect(p.x - half + 2, p.y - half + 2, half * 2 - 4, half * 2 - 4, pal::night.alpha(0.45f), 6);  // the cell's footprint
        Rgba col = pal::sand.alpha(0.55f);
        if (c.kind == ZoneCell::Arena) col = pal::magenta.alpha(0.6f);
        else if (c.kind == ZoneCell::Landmark) col = pal::amber.alpha(0.6f);
        else if (c.kind == ZoneCell::Entrance) col = pal::turquoise.alpha(0.6f);
        float core = (c.kind == ZoneCell::Arena || c.kind == ZoneCell::Landmark) ? half * 0.8f : lane;
        u.rect(p.x - core, p.y - core, core * 2, core * 2, col, 4);
        if (c.mask & DIR_N) u.rect(p.x - lane, p.y - half, lane * 2, half - core + 1, col);
        if (c.mask & DIR_S) u.rect(p.x - lane, p.y + core - 1, lane * 2, half - core + 1, col);
        if (c.mask & DIR_E) u.rect(p.x + core - 1, p.y - lane, half - core + 1, lane * 2, col);
        if (c.mask & DIR_W) u.rect(p.x - half, p.y - lane, half - core + 1, lane * 2, col);
    }
    auto revealed_at = [&](vec2 wp) {
        int ci = L.cell_index_at(wp);
        return ci >= 0 && size_t(ci) < z.revealed.size() && z.revealed[size_t(ci)];
    };
    for (auto& it : w.interacts) {
        if (!revealed_at(it.pos)) continue;
        vec2 p = to(it.pos);
        if (it.kind == Interactable::Portal) { u.disc(p.x, p.y, 11, Rgba::hex(0x7A8CFF)); u.ring(p.x, p.y, 15, 12, pal::bone); }
        else if (it.kind == Interactable::Exit) { u.disc(p.x, p.y, 11, Rgba::hex(0xF2C060)); u.ring(p.x, p.y, 15, 12, pal::bone); }
        else if (it.kind == Interactable::Chest && !it.spent) u.rect(p.x - 9, p.y - 7, 18, 14, pal::amber, 3);
    }
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& a = w.actors[i];
        if (!a.alive() || a.rarity != Rarity::Unique || !revealed_at(a.pos)) continue;
        vec2 p = to(a.pos);
        u.disc(p.x, p.y, 13, pal::magenta);
        u.disc(p.x - 4, p.y - 2, 3, pal::night);
        u.disc(p.x + 4, p.y - 2, 3, pal::night);
    }
    // the hero: an arrow pointing where they face
    vec2 c{960, 560};
    float f = w.actors[0].facing;
    vec2 d{std::cos(f), -std::sin(f)}, n{-d.y, d.x};
    vec2 tip = c + d * 18, l = c - d * 10 + n * 11, r = c - d * 10 - n * 11;
    u.line(tip.x, tip.y, l.x, l.y, 6, pal::amber);
    u.line(tip.x, tip.y, r.x, r.y, 6, pal::amber);
    u.line(l.x, l.y, r.x, r.y, 6, pal::amber);
    u.text(1880, 30, areas.name(), 30, pal::bone.alpha(0.8f), Align::Right, 1.f, true);
    u.text(1880, 70, "Level " + std::to_string(z.level), 24, pal::soft.alpha(0.8f), Align::Right);
}

void View::render_hud(World& w, const Input& in, const Areas& areas) {
    Ui& u = ui();
    const Actor& h = w.actors[0];
    const Hero& H = w.hero;
    // the Haboob: where its front is, and what staying in it has earned
    if (w.haboob.active) {
        const Haboob& hb = w.haboob;
        bool in = hb.inside(h.pos);
        float x = 1880, y = 90;
        u.frame(x - 300, y, 300, 64, pal::panel.alpha(0.85f), in ? Rgba::hex(0xC8A060) : pal::line, 10, 2);
        u.text(x - 286, y + 6, in ? "IN THE HABOOB" : "HABOOB", 24, Rgba::hex(0xE0C080), Align::Left, 1.f);
        char b[32];
        snprintf(b, sizeof b, "%d", int(hb.meter));
        u.text(x - 16, y + 6, b, 24, pal::bone, Align::Right, 1.f);
        float k = clampf((hb.front - hb.y0) / std::max(1.f, hb.y1 - hb.y0 + hb.depth), 0.f, 1.f);   // its crossing
        u.rect(x - 286, y + 42, 272, 8, pal::night.alpha(0.8f), 4);
        u.rect(x - 286, y + 42, 272 * k, 8, Rgba::hex(0xC8A060), 4);
        if (!in) {   // which way the storm is
            float dy = h.pos.y > hb.front ? -1.f : 1.f;
            u.text(x - 150, y + 66, dy < 0 ? "the storm is south of you" : "the storm is north of you", 20, pal::dim, Align::Center);
        }
    }
    // a Marid Rift: its time left, and what has died in it
    if (w.rift.open || (w.rift.armed && !w.rift.closed && length(w.rift.pos - h.pos) < 22.f)) {
        const Rift& rf = w.rift;
        float x = 1880, y = w.haboob.active ? 190 : 90;
        u.frame(x - 300, y, 300, 64, pal::panel.alpha(0.85f), rf.open ? Rgba::hex(0x5FC8E8) : pal::line, 10, 2);
        u.text(x - 286, y + 6, rf.open ? "MARID RIFT" : "A RIFT, CLOSED", 24, Rgba::hex(0x8FDFF0), Align::Left, 1.f);
        char b[32];
        snprintf(b, sizeof b, "%d", rf.kills);
        if (rf.open) u.text(x - 16, y + 6, b, 24, pal::bone, Align::Right, 1.f);
        float k = rf.open ? 1.f - rf.t / Rift::kLife : 1.f;
        u.rect(x - 286, y + 42, 272, 8, pal::night.alpha(0.8f), 4);
        u.rect(x - 286, y + 42, 272 * k, 8, Rgba::hex(0x5FC8E8), 4);
    }
    // floating texts
    for (auto& t : w.texts) {
        vec2 p = to_ui(cam, t.pos);
        float a = 1.f - smoothstep(0.6f, 1.1f, t.t);
        u.text(p.x, p.y, t.text, t.size * (1 + 0.3f * std::max(0.f, 0.15f - t.t) / 0.15f), Rgba::hex(t.color).alpha(a), Align::Center, 1.5f, true);
    }
    // small bars over damaged monsters
    for (size_t i = 1; i < w.actors.size(); i++) {
        const Actor& a = w.actors[i];
        if (!a.alive() || a.life >= a.life_max || a.rarity >= Rarity::Rare) continue;
        vec2 p = to_ui(cam, vec3(a.pos, 2.1f * a.scale));
        u.rect(p.x - 40, p.y, 80, 8, pal::night.alpha(0.8f));
        u.rect(p.x - 39, p.y + 1, 78 * a.life / a.life_max, 6, a.rarity == Rarity::Magic ? pal::magic : pal::bad);
    }
    // loot labels (what the filter shows) and the card of the selected item
    for (size_t i = 0; i < w.loot.size(); i++) {
        const GroundItem& g = w.loot[i];
        if (!w.loot_visible(g) || g.t < 0.3f) continue;
        vec2 p = to_ui(cam, vec3(g.pos, 0.5f));
        std::string n;
        Rgba c;
        float size = 26;
        if (g.kind == GroundItem::Gold) { n = std::to_string(g.amount) + " dinars"; c = pal::rare.alpha(0.85f); size = 22; }
        else if (g.kind == GroundItem::Currency) { n = currency_def(g.currency).name; c = Rgba::hex(currency_def(g.currency).color); }
        else if (g.kind == GroundItem::Wafq) { n = wafq_def(g.currency).name; c = pal::turquoise; }
        else if (g.kind == GroundItem::Blank) { n = "Blank Talisman (level " + std::to_string(g.amount) + ")"; c = pal::brass; }
        else if (g.kind == GroundItem::Scrap) { n = std::string("Poster Scrap: ") + unique_def(g.amount).film; c = pal::unique; }
        else { n = g.item.display_name(); c = Rgba::hex(rarity_color(g.item.rarity)); }
        float tw = u.text_width(n, size) + 24;
        bool sel = int(i) == w.selected_loot;
        u.frame(p.x - tw / 2, p.y - 44, tw, size + 10, pal::night.alpha(0.88f), sel ? c : pal::line, 6, 2);
        u.text(p.x, p.y - 40, n, size, c, Align::Center, 0.6f);
    }
    if (w.selected_loot >= 0) {
        const Item& it = w.loot[size_t(w.selected_loot)].item;
        int slot = equip_slot_for(it, H.equip);
        const Item* cmp = slot >= 0 && !H.equip[slot].empty() ? &H.equip[slot] : nullptr;
        float bw = 560;
        float bh = draw_item_card(0, 0, bw, it, w, cmp, "", false);
        float x = 1920 - bw - 60, y = std::max(20.f, 1080 - bh - 250);
        draw_item_card(x, y, bw, it, w, cmp, "", true);
        draw_button_glyph(x + 40, y + bh + 26, 40, BTN_LEFT);
        u.text(x + 72, y + bh + 10, "Pick up", 28, pal::bone);
    }
    // what South does here
    if (w.near_interact >= 0 && h.alive()) {
        const Interactable& it = w.interacts[size_t(w.near_interact)];
        vec2 p = to_ui(cam, vec3(it.pos, it.kind == Interactable::Portal || it.kind == Interactable::Exit ? 2.9f : 2.2f));
        float tw = u.text_width(it.label, 30) + 90;
        u.frame(p.x - tw / 2, p.y - 30, tw, 58, pal::panel.alpha(0.92f), pal::amber.alpha(0.8f), 12, 2);
        draw_button_glyph(p.x - tw / 2 + 34, p.y - 1, 40, BTN_SOUTH);
        u.text(p.x - tw / 2 + 64, p.y - 20, it.label, 30, pal::bone, Align::Left, 0.6f);
    }
    // target frame
    if (const Actor* f = w.focus_enemy()) {
        float bw = 620, x = 960 - bw / 2, y = 40;
        u.text(960, y, f->name, 36, f->rarity == Rarity::Unique ? pal::unique : pal::rare, Align::Center, 1.4f, true);
        std::string mods;
        for (int i = 0; i < 4; i++) if (f->mods[i] < MM_COUNT) mods += std::string(mods.empty() ? "" : "  \xC2\xB7  ") + monster_mod_name(f->mods[i]);
        u.text(960, y + 44, mods, 24, pal::soft, Align::Center);
        u.frame(x, y + 80, bw, 24, pal::night, pal::line, 6, 2);
        u.rect(x + 3, y + 83, (bw - 6) * f->life / f->life_max, 18, pal::life, 4);
        u.rect(x, y + 110, bw, 8, pal::night.alpha(0.8f), 3);
        u.rect(x, y + 110, bw * std::min(1.f, f->break_meter / 100.f), 8, f->broken_t > 0 ? pal::magenta : pal::amber.alpha(0.8f), 3);
    }
    // orbs
    char buf[64];
    if (H.es_max > 0) snprintf(buf, sizeof buf, "%d+%d", int(std::ceil(h.life)), int(std::ceil(H.es)));
    else snprintf(buf, sizeof buf, "%d", int(std::ceil(h.life)));
    orb(170, 900, 110, shown_life, Rgba::hex(0xA3202A), Rgba::hex(0xFF6040), buf);
    if (H.es_max > 0) {  // Hirz: a pale ring round the life orb
        float k = H.es / H.es_max;
        for (int i = 0; i < 48; i++) {
            if (i >= int(k * 48 + 0.5f)) break;
            float a0 = kPi / 2 + kTau * i / 48.f, a1 = kPi / 2 + kTau * (i + 1) / 48.f;
            u.line(170 + std::cos(a0) * 124, 900 + std::sin(a0) * 124, 170 + std::cos(a1) * 124, 900 + std::sin(a1) * 124, 9,
                   Rgba::hex(0xBFE6FF).alpha(0.85f));
        }
    }
    snprintf(buf, sizeof buf, "%d", int(h.mana));
    orb(1750, 900, 110, shown_mana, Rgba::hex(0x1F4FA8), Rgba::hex(0x60A0FF), buf);
    // flask pips beside the life orb
    for (int i = 0; i < int(H.flask_max); i++) {
        float x = 318 + i * 30, y = 990;
        float fill = clampf(H.flask - i, 0, 1);
        u.frame(x, y - 40, 22, 48, pal::night, pal::brass.alpha(0.7f), 6, 2);
        if (fill > 0) u.rect(x + 3, y + 5 - 42 * fill, 16, 42 * fill, pal::life, 4);
    }
    draw_button_glyph(344, 1036, 36, BTN_L3);
    // Endurance Charges (Ironclad): small ember-red studs above the flasks, dimming as they run out
    for (int i = 0; i < H.endurance; i++) {
        float x = 330 + i * 30, y = 900, k = clampf(H.endurance_t / 3.f, 0.35f, 1.f);
        u.disc(x, y, 12, pal::night.alpha(0.8f));
        u.disc(x, y, 9, Rgba::hex(0xE8703A).alpha(k));
        u.disc(x - 3, y - 3, 3, Rgba::hex(0xFFE0C0).alpha(k));
    }
    // Frenzy Charges (the Ranger's): small green studs beside them, dimming as they run out
    for (int i = 0; i < H.frenzy; i++) {
        float x = 330 + (H.endurance + i) * 30 + (H.endurance ? 12 : 0), y = 900, k = clampf(H.frenzy_t / 3.f, 0.35f, 1.f);
        u.disc(x, y, 12, pal::night.alpha(0.8f));
        u.disc(x, y, 9, Rgba::hex(0x6FCF5A).alpha(k));
        u.disc(x - 3, y - 3, 3, Rgba::hex(0xE0FFD0).alpha(k));
    }
    // skill bar: bar one, or bar two while L2 is held (a small strip shows the other)
    static const int btn[5] = {BTN_SOUTH, BTN_WEST, BTN_NORTH, BTN_R1, BTN_R2};
    const int bar = in.held(BTN_L2) ? 5 : 0;
    float sx = 960 - 5 * 120 / 2.f;
    for (int s = 0; s < 5; s++) {
        float x = sx + s * 120, y = 930;
        int slot = bar + s;
        const Talisman* t = H.slot_talisman(slot);
        u.frame(x + 4, y, 108, 108, pal::panel.alpha(0.92f), bar ? pal::turquoise.alpha(0.7f) : pal::line, 14, 2);
        if (t) {
            SkillCtx c = w.slot_ctx(slot);
            bool ready = H.cooldowns[slot] <= 0 && h.mana >= c.mana && c.usable;
            draw_skill_icon(x + 58, y + 50, 84, t->def().glyph, ready);
            if (H.cooldowns[slot] > 0 && c.cooldown > 0) {
                float k = std::min(1.f, H.cooldowns[slot] / c.cooldown);
                u.rect(x + 6, y + 2 + 104 * (1 - k), 104, 104 * k, pal::night.alpha(0.6f), 12);
            }
            if (h.mana < c.mana || !c.usable) u.rect(x + 6, y + 2, 104, 104, Rgba::hex(0x10204A).alpha(0.5f), 12);
            for (int k = 0; k < t->slots; k++)   // Wafq pips along the bottom edge
                u.disc(x + 58 + (k - (t->slots - 1) * 0.5f) * 14, y + 96, 4.5f, t->wafq[k] >= 0 ? pal::turquoise : pal::line);
        }
        draw_button_glyph(x + 58, y + 124, 34, btn[s]);
    }
    bool second = false;
    for (int s = 5; s < 10; s++) second = second || H.slot_talisman(s);
    if (second) {
        draw_button_glyph(sx - 40, 984, 36, BTN_L2);
        u.text(sx - 40, 1008, bar ? "2" : "1", 22, bar ? pal::turquoise : pal::dim, Align::Center, 1.f);
    }
    if (H.rally > 0) {
        u.frame(sx + 4, 870, 250, 44, pal::panel.alpha(0.9f), pal::amber, 10, 2);
        snprintf(buf, sizeof buf, "Rally \xC3\x97%d  40%% more", H.rally);
        u.text(sx + 20, 876, buf, 26, pal::amber, Align::Left, 1);
    }
    // xp bar
    float need = 90.f * std::pow(float(H.level), 1.55f);
    u.rect(300, 1068, 1320, 6, pal::night.alpha(0.9f), 3);
    u.rect(300, 1068, 1320 * std::min(1.f, H.xp / need), 6, pal::brass, 3);
    snprintf(buf, sizeof buf, "Level %d", H.level);
    u.text(290, 1052, buf, 24, pal::soft, Align::Right);
    if (H.passive_points() > 0) {
        const Star* next = !H.plan.empty() && size_t(H.plan[0]) < tree().stars.size() ? &tree().stars[H.plan[0]] : nullptr;
        if (next) snprintf(buf, sizeof buf, "Place %s", next->name.empty() ? (next->text.empty() ? "the next star" : next->text[0].c_str())
                                                                             : next->name.substr(0, next->name.find(',')).c_str());
        else snprintf(buf, sizeof buf, "%d star%s to place", H.passive_points(), H.passive_points() == 1 ? "" : "s");
        float tw = u.text_width(buf, 24) + 70;
        u.frame(1620 - tw, 1000, tw, 44, pal::panel.alpha(0.9f), pal::brass, 10, 2);
        draw_button_glyph(1620 - tw + 28, 1022, 34, BTN_SELECT);
        u.text(1620 - tw + 52, 1008, buf, 24, pal::rare, Align::Left, 0.6f);
    }
    // banner (level up)
    if (banner_t > 0) {
        float a = std::min(1.f, banner_t / 0.4f);
        u.text(960, 300, banner, 72, pal::amber.alpha(a), Align::Center, 2, true);
        u.text(960, 384, banner_sub, 30, pal::bone.alpha(a), Align::Center);
    }
    // field hints: what the D-pad does here
    {
        float x = 40, y = 40;
        auto hint = [&](int b, const char* t) {
            draw_button_glyph(x + 22, y + 18, 36, b);
            u.text(x + 50, y + 2, t, 24, pal::soft.alpha(0.75f), Align::Left, 0.4f, true);
            y += 44;
        };
        hint(BTN_START, "Inventory");
        if (areas.current == AreaId::Zone) {
            hint(BTN_UP, "Portal");
            hint(BTN_DOWN, map_open ? "Hide map" : "Map");
        }
        hint(BTN_RIGHT, (std::string("Filter: ") + filter_name(H.filter)).c_str());
    }
    // death
    if (!h.alive()) {
        float a = std::min(1.f, h.dead_t / 1.2f);
        u.rect(0, 0, 1920, 1080, pal::night.alpha(0.55f * a));
        u.text(960, 420, "You fell in the long night", 64, pal::bone.alpha(a), Align::Center, 1.5f, true);
        if (h.dead_t > 1.2f) {
            draw_button_glyph(830, 560, 52, BTN_SOUTH);
            u.text(880, 540, areas.current == AreaId::Hub ? "Rise again" : "Rise again at the entrance", 34, pal::soft.alpha(a));
        }
    }
    if (fade > 0) u.rect(0, 0, 1920, 1080, Rgba(0, 0, 0, 255).alpha(fade));
}

}  // namespace q
