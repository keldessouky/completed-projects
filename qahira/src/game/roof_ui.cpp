#include "game/roof_ui.hpp"
#include "game/inventory.hpp"
#include "game/menu.hpp"
#include "game/rooftop.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <algorithm>
#include <cmath>

namespace q {

namespace {
constexpr float PX = 210, PY = 70, PW = 1500, PH = 940;   // the board
constexpr float LX = PX + 50, LW = 760, RX = PX + 860, RW = PW - 910;   // the list, and the piece under the cursor
}  // namespace

void RoofScreen::show(const World&) {
    open = true;
    built = false;
    cursor = std::clamp(cursor, 0, int(roof_defs().size()) - 1);
    last_dir_ = 0;
}

void RoofScreen::update(World& w, const Input& in, float dt) {
    msg_t = std::max(0.f, msg_t - dt);
    if (!open) return;
    if (in.hit(BTN_EAST) || in.hit(BTN_START)) { hide(); return; }
    const int n = int(roof_defs().size());
    int dir = in.held(BTN_UP) || in.lstick.y > 0.6f ? -1 : in.held(BTN_DOWN) || in.lstick.y < -0.6f ? 1 : 0;
    if (dir == 0) last_dir_ = 0;
    else if (dir != last_dir_) { last_dir_ = dir; repeat_t_ = 0.3f; cursor = (cursor + dir + n) % n; }
    else if ((repeat_t_ -= dt) <= 0) { repeat_t_ = 0.12f; cursor = (cursor + dir + n) % n; }
    if (in.hit(BTN_SOUTH)) {
        std::string why;
        if (!roof_can_build(w.hero, cursor, &why)) { say(why); return; }
        roof_build(w.hero, cursor);
        const RoofDef& d = roof_defs()[size_t(cursor)];
        say(std::string(d.name) + ": " + d.gives[roof_tier(w.hero, cursor) - 1]);
        built = true;
        w.recompute_hero();   // the cistern's charge
        w.emit(Ev::Craft, w.actors[0].pos);
    }
}

void RoofScreen::render(const World& w) const {
    if (!open) return;
    Ui& u = ui();
    const Hero& H = w.hero;
    u.rect(0, 0, 1920, 1080, pal::night.alpha(0.82f));
    u.frame(PX, PY, PW, PH, pal::panel, pal::brass, 16, 3);
    u.text(PX + PW / 2, PY + 30, "Build up the roof", 46, pal::bone, Align::Center, 1.f);
    u.text(PX + PW / 2, PY + 92, "Each piece in three tiers, kept with this character", 26, pal::dim, Align::Center);
    u.text(PX + PW - 50, PY + 40, std::to_string(H.gold) + " dinars", 30, pal::rare, Align::Right, 0.8f);
    // the list
    float y = PY + 150;
    for (int i = 0; i < int(roof_defs().size()); i++) {
        const RoofDef& d = roof_defs()[size_t(i)];
        const int t = roof_tier(H, i);
        const bool cur = cursor == i;
        u.frame(LX, y, LW, 88, cur ? pal::dusk : pal::panel2, cur ? pal::amber : pal::line, 12, cur ? 3.f : 1.f);
        u.text(LX + 24, y + 12, d.name, 32, cur ? pal::amber : pal::bone, Align::Left, 0.8f);
        u.text(LX + 24, y + 52, t > 0 ? d.gives[t - 1] : "Not built", 22, t > 0 ? pal::good : pal::dim);
        for (int k = 0; k < kRoofTiers; k++) {   // the tiers built, as three lamps
            const float cx = LX + LW - 120 + k * 38.f, cy = y + 44;
            u.disc(cx, cy, 14, pal::night);
            if (k < t) u.disc(cx, cy, 11, pal::amber);
            else u.ring(cx, cy, 11, 9, pal::line);
        }
        y += 96;
    }
    // the piece under the cursor
    const RoofDef& d = roof_defs()[size_t(cursor)];
    const int t = roof_tier(H, cursor);
    float ry = PY + 150;
    u.frame(RX, ry, RW, 720, pal::panel2, pal::line, 12, 1);
    ry += 24;
    u.text(RX + 30, ry, d.name, 38, pal::bone, Align::Left, 1.f);
    ry += 60;
    u.wrap(RX + 30, ry, RW - 60, d.blurb, 24, pal::soft);
    ry += 90;
    for (int k = 0; k < kRoofTiers; k++) {   // every tier: built, next, or later
        const bool done = k < t, next = k == t;
        const Rgba c = done ? pal::good : next ? pal::amber : pal::dim;
        const float lw = u.text(RX + 30, ry, done ? "Built" : next ? "Next" : "Later", 26, c, Align::Left, 0.6f);
        u.text(RX + 30 + std::max(110.f, lw + 24), ry, d.gives[k], 26, c);
        ry += 44;
    }
    ry += 20;
    if (t < kRoofTiers) {
        u.text(RX + 30, ry, "Costs", 26, pal::dim);
        ry += 42;
        const bool lvl_ok = H.level >= d.level[t], gold_ok = H.gold >= d.gold[t];
        u.text(RX + 50, ry, "Level " + std::to_string(d.level[t]), 28, lvl_ok ? pal::bone : pal::bad);
        ry += 42;
        u.text(RX + 50, ry, std::to_string(d.gold[t]) + " dinars", 28, gold_ok ? pal::rare : pal::bad);
        ry += 42;
        if (d.currency[t] >= 0) {
            const int have = H.currency[d.currency[t]];
            draw_currency_icon(RX + 66, ry + 16, 34, d.currency[t]);
            const float cw = u.text(RX + 96, ry, std::to_string(d.count[t]) + " " + currency_def(d.currency[t]).name, 26,
                                    have >= d.count[t] ? pal::bone : pal::bad);
            u.text(RX + 96 + cw + 20, ry, "You have " + std::to_string(have), 22, pal::dim);
            ry += 46;
        }
        std::string why;
        const bool can = roof_can_build(H, cursor, &why);
        ry += 20;
        u.text(RX + 30, ry, can ? "South builds it" : why, 28, can ? pal::good : pal::bad, Align::Left, 0.8f);
    } else {
        u.text(RX + 30, ry, "Built as far as it goes", 28, pal::good, Align::Left, 0.8f);
    }
    // the buttons, and what happened
    float lx = PX + 40;
    const float ly = PY + PH - 62;
    draw_button_glyph(lx + 20, ly + 18, 38, BTN_SOUTH);
    lx += 48;
    lx += u.text(lx, ly, "Build", 26, pal::soft) + 34;
    draw_button_glyph(lx + 20, ly + 18, 38, BTN_EAST);
    u.text(lx + 48, ly, "Close", 26, pal::soft);
    if (msg_t > 0) {
        const float a = std::min(1.f, msg_t / 0.3f), tw = u.text_width(msg, 30) + 60;
        u.frame(PX + PW / 2 - tw / 2, PY + PH - 140, tw, 56, pal::panel2.alpha(a), pal::brass.alpha(a), 10, 2);
        u.text(PX + PW / 2, PY + PH - 132, msg, 30, pal::bone.alpha(a), Align::Center, 0.6f);
    }
}

}  // namespace q
