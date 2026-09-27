#include "game/view.hpp"
#include "ui/ui.hpp"
#include <cstdio>

namespace q {

void View::follow(const World& w, float dt, bool snap) {
    const Actor& h = w.actors[0];
    vec2 tp = h.pos + h.vel * 0.15f;
    vec3 target{tp.x, tp.y + 0.8f, 0.6f};
    float d = 18.f, pitch = radians(55.f);
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

void View::draw_actor(Renderer& r, World& w, Actor& a, int index) {
    if (!a.model.body && !a.model.name.empty()) a.model.body = assets().mesh(a.model.name);
    const CharacterModel& m = a.model;
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
    else if (a.rarity == Rarity::Rare) in.rim = vec4(hex_lin(0xF5D76E), 0.9f);
    else if (a.rarity == Rarity::Magic) in.rim = vec4(hex_lin(0x7AA8FF), 0.7f);
    else in.rim = vec4(hex_lin(0xFF2E88), 0.25f);
    if (a.broken_t > 0) in.rim = vec4(hex_lin(0xFF2E88), 1.2f);
    r.draw(m.body, in);
    if (index == 0 && m.weapon_bone >= 0) {
        Instance wpn;
        wpn.model = pose_.model[size_t(m.weapon_bone)];
        wpn.rim = in.rim;
        wpn.extra = {-1, 0, a.hit_flash * 0.5f, 0};
        uint32_t rc = rarity_color(w.hero.weapon.rarity);
        if (w.hero.weapon.rarity != Rarity::Normal) wpn.rim = vec4(hex_lin(rc), 0.6f);
        r.draw(assets().mesh("maul"), wpn);
        vec3 hip = pose_.model[size_t(m.pelvis)].translation();
        r.light(hip + vec3{0, 0, 0.3f}, 6.5f, hex_lin(0xFFB04A) * 14.f);
    }
    if (dissolve < 1) r.ground(vec3(a.pos, 0), 0.75f * a.scale, vec4(0, 0, 0, 0.5f * (1 - dissolve)), {0, 1.5f, 0, 1}, Blend::Alpha);
}

void View::render_world(Renderer& r, World& w) {
    const Actor& h = w.actors[0];
    w.level.render(r, w.time, h.pos);
    for (size_t i = 0; i < w.actors.size(); i++) draw_actor(r, w, w.actors[i], int(i));
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
        }
    }
    for (auto& p : w.projectiles) {
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
        uint32_t rc = rarity_color(g.item.rarity);
        vec3 c = hex_lin(rc);
        float pulse = 0.8f + 0.2f * std::sin(w.time * 3 + g.id);
        if (g.item.rarity >= Rarity::Rare) r.beam(vec3(g.pos, 0), 5.f, 0.35f, vec4(c, 0.8f * pulse));
        r.ground(vec3(g.pos, 0), 0.5f, vec4(c, 0.6f * pulse), {0, 2, 0, 2}, Blend::Additive);
        Instance in;
        in.model = mat4::translate(vec3(g.pos, 0.1f)) * mat4::rotate(quat::axis_angle({0, 1, 0}, kPi / 2)) * mat4::rot_z(float(g.id));
        in.rim = vec4(c, 0.8f);
        r.draw(assets().mesh("maul"), in);
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
    const char* t = b == BTN_R1 ? "R1" : b == BTN_R2 ? "R2" : b == BTN_L1 ? "L1" : b == BTN_L2 ? "L2" : b == BTN_L3 ? "M1" :
                    b == BTN_R3 ? "M2" : b == BTN_LEFT ? "\xE2\x97\x80" : "?";
    u.frame(cx - s * 0.6f, cy - s * 0.38f, s * 1.2f, s * 0.76f, pal::panel2, pal::dim, s * 0.2f, 2);
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

void View::render_hud(World& w, const Input& in) {
    Ui& u = ui();
    const Actor& h = w.actors[0];
    const Hero& H = w.hero;
    (void)in;
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
    // loot labels and the tooltip of the selected item
    for (size_t i = 0; i < w.loot.size(); i++) {
        const GroundItem& g = w.loot[i];
        vec2 p = to_ui(cam, vec3(g.pos, 0.5f));
        std::string n = g.item.display_name();
        float tw = u.text_width(n, 26) + 24;
        bool sel = int(i) == w.selected_loot;
        u.frame(p.x - tw / 2, p.y - 44, tw, 36, pal::night.alpha(0.88f), sel ? Rgba::hex(rarity_color(g.item.rarity)) : pal::line, 6, 2);
        u.text(p.x, p.y - 40, n, 26, Rgba::hex(rarity_color(g.item.rarity)), Align::Center, 0.6f);
    }
    if (w.selected_loot >= 0) {
        const Item& it = w.loot[size_t(w.selected_loot)].item;
        auto lines = it.lines();
        float bw = 560, lh = 36, bh = 110 + lines.size() * lh + 70;
        float x = 1920 - bw - 60, y = 1080 - bh - 230;
        Rgba rc = Rgba::hex(rarity_color(it.rarity));
        u.frame(x, y, bw, bh, pal::panel.alpha(0.96f), rc.alpha(0.8f), 12, 2);
        u.rect(x + 2, y + 2, bw - 4, 84, rc.alpha(0.12f), 10);
        u.text(x + bw / 2, y + 14, it.display_name(), 34, rc, Align::Center, 1.2f);
        if (it.rarity >= Rarity::Rare) u.text(x + bw / 2, y + 50, it.b().name, 26, rc.alpha(0.8f), Align::Center);
        float cy = y + 100;
        for (auto& l : lines) {
            Rgba c = pal::bone;
            std::string s = l;
            if (!s.empty() && s[0] == '~') { c = pal::soft; s = s.substr(1); }
            if (!s.empty() && s[0] == '#') { c = pal::dim; s = s.substr(1); }
            else if (s.find(':') == std::string::npos && c.r == pal::bone.r) c = pal::magic;
            u.text(x + bw / 2, cy, s, 28, c, Align::Center);
            cy += lh;
        }
        if (it.b().slot == Slot::Weapon) {
            float delta = w.hero_dps(it) - w.hero_dps(H.weapon);
            char b[64];
            snprintf(b, sizeof b, "%+.1f DPS with Crushing Blow", delta);
            u.text(x + bw / 2, cy + 8, b, 30, delta >= 0 ? pal::good : pal::bad, Align::Center, 1);
        }
        draw_button_glyph(x + bw / 2 - 90, y + bh - 26, 44, BTN_LEFT);
        u.text(x + bw / 2 - 58, y + bh - 42, it.b().slot == Slot::Weapon ? "Equip" : "Pick up", 28, pal::bone);
    }
    // target frame
    if (const Actor* f = w.focus_enemy()) {
        float bw = 620, x = 960 - bw / 2, y = 40;
        u.text(960, y, f->name, 36, pal::rare, Align::Center, 1.4f, true);
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
    snprintf(buf, sizeof buf, "%d", int(std::ceil(h.life)));
    orb(170, 900, 110, shown_life, Rgba::hex(0xA3202A), Rgba::hex(0xFF6040), buf);
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
    // skill bar
    static const int btn[5] = {BTN_SOUTH, BTN_WEST, BTN_NORTH, BTN_R1, BTN_R2};
    float sx = 960 - 5 * 120 / 2.f;
    for (int s = 0; s < 5; s++) {
        float x = sx + s * 120, y = 930;
        int sk = H.skills[s];
        u.frame(x + 4, y, 108, 108, pal::panel.alpha(0.92f), pal::line, 14, 2);
        if (sk >= 0) {
            const SkillDef& d = skill_defs()[size_t(sk)];
            bool ready = H.cooldowns[s] <= 0 && h.mana >= d.mana;
            draw_skill_icon(x + 58, y + 50, 84, d.glyph, ready);
            if (H.cooldowns[s] > 0) {
                float k = H.cooldowns[s] / std::max(0.01f, d.cooldown);
                u.rect(x + 6, y + 2 + 104 * (1 - k), 104, 104 * k, pal::night.alpha(0.6f), 12);
            }
            if (h.mana < d.mana) u.rect(x + 6, y + 2, 104, 104, Rgba::hex(0x10204A).alpha(0.5f), 12);
        }
        draw_button_glyph(x + 58, y + 124, 34, btn[s]);
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
    // banner (level up)
    if (banner_t > 0) {
        float a = std::min(1.f, banner_t / 0.4f);
        u.text(960, 300, banner, 72, pal::amber.alpha(a), Align::Center, 2, true);
        u.text(960, 384, banner_sub, 30, pal::bone.alpha(a), Align::Center);
    }
    // death
    if (!h.alive()) {
        float a = std::min(1.f, h.dead_t / 1.2f);
        u.rect(0, 0, 1920, 1080, pal::night.alpha(0.55f * a));
        u.text(960, 420, "You fell in the long night", 64, pal::bone.alpha(a), Align::Center, 1.5f, true);
        if (h.dead_t > 1.2f) {
            draw_button_glyph(830, 560, 52, BTN_SOUTH);
            u.text(880, 540, "Rise again at the street's mouth", 34, pal::soft.alpha(a));
        }
    }
}

}  // namespace q
