#include "game/asc.hpp"
// The menu's Talismans tab (skills and their Wafq) and Character tab (the sheet, with a "Why?" for every number).
#include "game/classes.hpp"
#include "game/menu.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <cstdio>

namespace q {

namespace {
constexpr float PX = 1030, PY = 36, PW = 850, PH = 1008;   // the right panel (as in menu.cpp)
constexpr float LX = 40, LY = 36, LW = 950;                 // the left card
constexpr int kBlankRow = 10;
enum Dir { D_UP, D_DOWN, D_LEFT, D_RIGHT };

void legend(float x, float y, std::initializer_list<std::pair<int, const char*>> items) {
    Ui& u = ui();
    for (auto& [b, label] : items) {
        draw_button_glyph(x + 20, y + 18, 38, b);
        x += 48;
        x += u.text(x, y, label, 26, pal::soft) + 30;
    }
}

const char* attr_name(Attr a) { return a == ATTR_STR ? "Strength" : a == ATTR_DEX ? "Dexterity" : "Intelligence"; }

// a Wafq drawn as its magic square: the numbers in a grid, the magic sum underneath
void draw_square(float x, float y, float size, int wafq, float alpha = 1) {
    Ui& u = ui();
    const WafqDef& d = wafq_def(wafq);
    std::vector<int> sq = magic_square(d.order);
    float cell = size / d.order;
    u.frame(x - 4, y - 4, size + 8, size + 8, pal::night.alpha(alpha), pal::turquoise.alpha(0.8f * alpha), 6, 2);
    for (int r = 0; r < d.order; r++)
        for (int c = 0; c < d.order; c++) {
            float cx = x + c * cell, cy = y + r * cell;
            if ((r + c) % 2 == 0) u.rect(cx, cy, cell, cell, pal::turquoise.alpha(0.08f * alpha));
            char b[8];
            snprintf(b, sizeof b, "%d", sq[size_t(r * d.order + c)]);
            float fs = std::min(cell * 0.55f, 30.f);
            if (fs >= 9) u.text(cx + cell / 2, cy + (cell - fs * 1.2f) / 2, b, fs, pal::bone.alpha(alpha), Align::Center, 0.3f);
        }
}

std::string source_name(const Hero& H, uint16_t src) {
    if (src >= 1 && src <= EQ_COUNT) {
        const Item& it = H.equip[src - 1];
        return it.empty() ? equip_slot_name(src - 1) : it.display_name() + " (" + equip_slot_name(src - 1) + ")";
    }
    if (src == SRC_CLASS) return class_def(H.passives.cls).name;
    if (src == SRC_LEVEL) return "Level " + std::to_string(H.level);
    if (src == SRC_ATTRIBUTES) return "Attributes";
    if (src >= SRC_WAFQ && src < int(SRC_WAFQ) + int(WQ_COUNT)) return wafq_def(src - SRC_WAFQ).name;
    if (src > SRC_ASC && src < SRC_WAFQ)
        if (const Ascendancy* a = ascendancy_for(H.passives.cls); a && src - SRC_ASC < int(a->nodes.size()))
            return std::string(a->nodes[size_t(src - SRC_ASC)].name) + " (" + a->name + ")";
    if (src >= SRC_STAR) {
        const PassiveTree& T = tree();
        int id = src - SRC_STAR;
        if (id < int(T.stars.size())) {
            const Star& s = T.stars[size_t(id)];
            if (!s.name.empty()) return s.name.substr(0, s.name.find(','));
            return s.kind == StarKind::Attr ? "an attribute star" : "a minor star in " + (s.constellation.empty() ? std::string("the sky") : s.constellation);
        }
    }
    return "the base";
}

std::string mod_value(const Mod& m, bool percent_flat = false) {
    char b[48];
    if (m.kind == MK_FLAT) snprintf(b, sizeof b, percent_flat ? "%+.0f%%" : "%+.0f", m.value);
    else if (m.kind == MK_INC) snprintf(b, sizeof b, m.value >= 0 ? "%.0f%% increased" : "%.0f%% reduced", std::fabs(m.value));
    else snprintf(b, sizeof b, m.value >= 0 ? "%.0f%% more" : "%.0f%% less", std::fabs(m.value));
    return b;
}
}  // namespace

// ================================================================ Talismans
void Menu::tal_update(World& w, const Input& in, int dir) {
    Hero& H = w.hero;
    auto say_tick = [&]() { w.emit(Ev::Craft, w.actors[0].pos, 0); };
    if (pick != Pick::None) {
        int n = int(pick_items.size());
        if (dir == D_UP) pick_cursor = std::max(0, pick_cursor - 1);
        if (dir == D_DOWN) pick_cursor = std::min(n - 1, pick_cursor + 1);
        if (!in.hit(BTN_SOUTH) || n == 0) return;
        int v = pick_items[size_t(pick_cursor)];
        if (pick == Pick::Talisman) {
            int8_t& slot = H.bar[tal_row];
            int8_t old = slot;
            for (auto& b : H.bar) if (b == v && v >= 0) b = old;   // taking it from another slot swaps
            slot = int8_t(v);
            say(v >= 0 ? std::string("Set ") + H.talismans[size_t(v)].def().name : "Slot cleared");
        } else if (pick == Pick::Wafq) {
            Talisman* t = const_cast<Talisman*>(H.slot_talisman(tal_row));
            int k = tal_col - 1;
            if (t && k >= 0 && k < t->slots) {
                if (t->wafq[k] >= 0) H.wafq[t->wafq[k]]++;
                t->wafq[k] = -1;
                if (v >= 0 && H.wafq[v] > 0) { H.wafq[v]--; t->wafq[k] = int8_t(v); say(std::string("Carved the ") + wafq_def(v).name); }
                else say("Wafq taken out");
                w.recompute_hero();
            }
        } else if (pick == Pick::Carve) {
            int blank = tal_col;
            if (blank >= 0 && blank < int(H.blanks.size())) {
                int lvl = H.blanks[size_t(blank)];
                H.blanks.erase(H.blanks.begin() + blank);
                Talisman* same = nullptr;
                for (auto& t : H.talismans) if (t.skill == v && (!same || t.level < same->level)) same = &t;
                if (same && same->level < lvl) {
                    same->level = uint8_t(lvl);
                    say(std::string(skill_defs()[size_t(v)].name) + " rises to level " + std::to_string(lvl));
                } else {
                    Talisman t;
                    t.skill = int16_t(v);
                    t.level = uint8_t(lvl);
                    H.talismans.push_back(t);
                    for (auto& b : H.bar) if (b < 0) { b = int8_t(H.talismans.size() - 1); break; }
                    say(std::string("Carved ") + skill_defs()[size_t(v)].name + " at level " + std::to_string(lvl));
                }
                tal_col = std::min(tal_col, std::max(0, int(H.blanks.size()) - 1));
            }
        }
        w.emit(Ev::Craft, w.actors[0].pos, 1);
        pick = Pick::None;
        return;
    }
    const Talisman* t = tal_row < 10 ? H.slot_talisman(tal_row) : nullptr;
    int cols = tal_row == kBlankRow ? std::max(1, int(H.blanks.size())) : t ? 1 + t->slots + (t->slots < 5 ? 1 : 0) : 1;
    if (dir == D_UP) { tal_row = std::max(0, tal_row - 1); tal_col = 0; say_tick(); }
    if (dir == D_DOWN) { tal_row = std::min(kBlankRow, tal_row + 1); tal_col = 0; say_tick(); }
    if (dir == D_LEFT) { tal_col = std::max(0, tal_col - 1); say_tick(); }
    if (dir == D_RIGHT) { tal_col = std::min(cols - 1, tal_col + 1); say_tick(); }
    if (!in.hit(BTN_SOUTH)) return;
    pick_items.clear();
    pick_cursor = 0;
    if (tal_row == kBlankRow) {
        if (H.blanks.empty()) { say("No Blank Talismans: monsters drop them"); return; }
        for (size_t i = 0; i < skill_defs().size(); i++) pick_items.push_back(int(i));
        pick = Pick::Carve;
        return;
    }
    if (tal_col == 0) {
        pick_items.push_back(-1);
        for (size_t i = 0; i < H.talismans.size(); i++) pick_items.push_back(int(i));
        pick = Pick::Talisman;
        for (size_t i = 0; i < pick_items.size(); i++) if (pick_items[i] == H.bar[tal_row]) pick_cursor = int(i);
        return;
    }
    if (!t) return;
    if (tal_col == 1 + t->slots) {   // the "+": a Brass Stylus adds a slot
        if (H.currency[CUR_STYLUS] <= 0) { say("You need a Brass Stylus"); return; }
        const_cast<Talisman*>(t)->slots++;
        H.currency[CUR_STYLUS]--;
        w.emit(Ev::Craft, w.actors[0].pos, 1);
        say("Carved another Wafq slot");
        return;
    }
    pick_items.push_back(-1);
    for (int q = 0; q < WQ_COUNT; q++) {
        const WafqDef& d = wafq_def(q);
        if (H.wafq[q] > 0 && (!d.needs || (t->def().tags & d.needs))) pick_items.push_back(q);
    }
    pick = Pick::Wafq;
}

void Menu::tal_render(const World& w) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    char b[160];
    static const int kBtn[5] = {BTN_SOUTH, BTN_WEST, BTN_NORTH, BTN_R1, BTN_R2};
    float y0 = PY + 100;
    for (int r = 0; r < 10; r++) {
        float y = y0 + r * 64 + (r >= 5 ? 14 : 0);
        const Talisman* t = H.slot_talisman(r);
        bool row_on = tal_row == r;
        u.frame(PX + 24, y, PW - 48, 58, row_on ? pal::panel2 : pal::panel.alpha(0.6f), row_on ? pal::line : pal::line.alpha(0.4f), 10, 1);
        if (r >= 5) draw_button_glyph(PX + 52, y + 31, 30, BTN_L2);
        draw_button_glyph(PX + (r >= 5 ? 94 : 60), y + 31, 34, kBtn[r % 5]);
        float nx = PX + 130;
        if (t) {
            SkillCtx c = skill_ctx(*t, H.stats, H.weapon().weapon());
            draw_skill_icon(nx + 24, y + 31, 50, t->def().glyph, c.usable);
            snprintf(b, sizeof b, "%s", t->def().name);
            u.text(nx + 60, y + 8, b, 26, c.usable ? pal::bone : pal::bad, Align::Left, 0.6f);
            snprintf(b, sizeof b, "Level %d  \xC2\xB7  %.0f mana", t->level, c.mana);
            u.text(nx + 60, y + 36, b, 20, pal::dim);
            for (int k = 0; k < 5; k++) {
                float sx = PX + 470 + k * 58, sy = y + 9;
                bool cur = row_on && tal_col == k + 1;
                if (k < t->slots) {
                    u.frame(sx, sy, 44, 44, pal::night, cur ? pal::amber : t->wafq[k] >= 0 ? pal::turquoise : pal::line, 6, cur ? 3.f : 1.5f);
                    if (t->wafq[k] >= 0) {
                        char nb[4];
                        snprintf(nb, sizeof nb, "%d", wafq_def(t->wafq[k]).order);
                        u.text(sx + 22, sy + 8, nb, 24, pal::turquoise, Align::Center, 1.f);
                    }
                } else if (k == t->slots) {
                    u.frame(sx, sy, 44, 44, pal::night.alpha(0.5f), cur ? pal::amber : pal::line.alpha(0.5f), 6, cur ? 3.f : 1.f);
                    u.text(sx + 22, sy + 4, "+", 30, pal::dim, Align::Center);
                }
            }
        } else {
            u.text(nx + 10, y + 16, "Empty", 26, pal::dim);
        }
        if (row_on && tal_col == 0) {
            u.rect(PX + 24, y, 5, 58, pal::amber);
            u.rect(PX + PW - 29, y, 5, 58, pal::amber);
        }
    }
    // Blank Talismans
    float by = y0 + 10 * 64 + 30;
    u.text(PX + 34, by, "Blank Talismans", 24, pal::brass, Align::Left, 1.f);
    if (H.blanks.empty()) u.text(PX + 270, by, "none yet: monsters drop them", 22, pal::dim);
    for (size_t i = 0; i < H.blanks.size() && i < 12; i++) {
        float bx = PX + 34 + i * 64, bby = by + 34;
        bool cur = tal_row == kBlankRow && tal_col == int(i);
        u.frame(bx, bby, 54, 54, pal::panel2, cur ? pal::amber : pal::brass.alpha(0.6f), 8, cur ? 3.f : 1.5f);
        u.text(bx + 27, bby + 12, std::to_string(H.blanks[i]), 26, pal::brass, Align::Center, 1.f);
    }
    // Wafq and Styluses in hand
    float wy = by + 104;
    std::string held = "Wafq in hand:";
    int any = 0;
    for (int q = 0; q < WQ_COUNT; q++)
        if (H.wafq[q]) { held += std::string(any++ ? "," : "") + " " + std::to_string(H.wafq[q]) + "\xC3\x97" + std::to_string(wafq_def(q).order); }
    if (!any) held += " none";
    held += "   \xC2\xB7   Brass Styluses: " + std::to_string(H.currency[CUR_STYLUS]);
    u.text(PX + 34, wy, held, 22, pal::soft);

    // ---- the card on the left: what the cursor is on
    const Talisman* t = tal_row < 10 ? H.slot_talisman(tal_row) : nullptr;
    auto card = [&](float h) { u.frame(LX, LY, LW, h, pal::panel.alpha(0.96f), pal::turquoise.alpha(0.7f), 14, 2); };
    if (pick != Pick::None) {
        const char* title = pick == Pick::Talisman ? "Choose a Talisman" : pick == Pick::Wafq ? "Choose a Wafq" : "Carve the Blank";
        float h = 130 + pick_items.size() * 52;
        card(std::min(h, 1000.f));
        u.text(LX + LW / 2, LY + 20, title, 34, pal::amber, Align::Center, 1.2f);
        if (pick == Pick::Carve && tal_col < int(H.blanks.size()))
            u.text(LX + LW / 2, LY + 64, "A level " + std::to_string(H.blanks[size_t(tal_col)]) + " Blank: any Talisman, carved at that level", 22, pal::dim,
                   Align::Center);
        for (size_t i = 0; i < pick_items.size() && i < 16; i++) {
            float y = LY + 110 + i * 52;
            bool cur = int(i) == pick_cursor;
            if (cur) u.frame(LX + 20, y - 6, LW - 40, 48, pal::dusk, pal::amber, 8, 2);
            int v = pick_items[i];
            std::string l, r;
            if (pick == Pick::Talisman) {
                if (v < 0) l = "Empty";
                else {
                    const Talisman& tt = H.talismans[size_t(v)];
                    l = std::string(tt.def().name) + ", level " + std::to_string(tt.level);
                    for (int s = 0; s < 10; s++) if (H.bar[s] == v) r = "on slot " + std::to_string(s + 1);
                }
            } else if (pick == Pick::Wafq) {
                if (v < 0) l = "Leave it empty";
                else { l = wafq_def(v).name; r = std::to_string(H.wafq[v]) + " in hand"; }
            } else {
                const SkillDef& d = skill_defs()[size_t(v)];
                l = d.name;
                r = std::string(attr_name(d.attr)) + (*d.cls ? std::string("  \xC2\xB7  ") + class_def(d.cls).name : "");
            }
            u.text(LX + 44, y, l, 28, cur ? pal::amber : pal::bone, Align::Left, cur ? 0.8f : 0.3f);
            if (!r.empty()) u.text(LX + LW - 44, y + 4, r, 22, pal::dim, Align::Right);
        }
        legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Choose"}, {BTN_EAST, "Back"}});
        if (pick == Pick::Wafq && pick_cursor < int(pick_items.size()) && pick_items[size_t(pick_cursor)] >= 0) {
            int v = pick_items[size_t(pick_cursor)];
            float sq = 300;
            draw_square(LX + LW - sq - 60, LY + 120, sq, v);
            u.wrap(LX + LW - sq - 60, LY + 120 + sq + 30, sq, wafq_def(v).does, 22, pal::soft);
        }
        return;
    }
    if (tal_row == kBlankRow) {
        card(220);
        u.text(LX + LW / 2, LY + 20, "Blank Talismans", 34, pal::brass, Align::Center, 1.2f);
        u.wrap(LX + 40, LY + 80, LW - 80, "Carve a Blank into any Talisman at its level. If you already carry that Talisman at a lower level, "
               "it rises to the Blank's level and keeps its Wafq (a skill gem, PoE2 style).", 24, pal::soft);
        legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Carve"}, {BTN_EAST, "Close"}});
        return;
    }
    if (!t) {
        card(160);
        u.text(LX + LW / 2, LY + 20, "An empty slot", 34, pal::dim, Align::Center, 1.2f);
        u.text(LX + LW / 2, LY + 80, "South: choose one of your Talismans for it", 24, pal::soft, Align::Center);
        legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Choose"}, {BTN_EAST, "Close"}});
        return;
    }
    if (tal_col >= 1 && tal_col <= t->slots) {
        int wq = t->wafq[tal_col - 1];
        if (wq < 0) {
            card(200);
            u.text(LX + LW / 2, LY + 20, "An empty Wafq slot", 34, pal::turquoise, Align::Center, 1.2f);
            u.wrap(LX + 40, LY + 80, LW - 80, "South: carve a Wafq into it. A Wafq is a support gem: a magic square that changes how the "
                   "Talisman works. Each Wafq sits in one Talisman at a time.", 24, pal::soft);
        } else {
            const WafqDef& d = wafq_def(wq);
            card(560);
            u.text(LX + LW / 2, LY + 20, d.name, 36, pal::turquoise, Align::Center, 1.2f);
            snprintf(b, sizeof b, "A magic square of order %d  \xC2\xB7  every line sums to %d", d.order, d.order * (d.order * d.order + 1) / 2);
            u.text(LX + LW / 2, LY + 66, b, 22, pal::dim, Align::Center);
            draw_square(LX + 60, LY + 130, 380, wq);
            u.wrap(LX + 480, LY + 140, LW - 530, std::string(d.does) + ".", 26, pal::bone, 1.35f);
            snprintf(b, sizeof b, "Mana cost \xC3\x97%.2f", d.mana_mult);
            u.text(LX + 480, LY + 360, b, 24, pal::soft);
            if (d.needs && !(t->def().tags & d.needs)) u.text(LX + 480, LY + 400, "It does not fit this Talisman", 24, pal::bad);
        }
        legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Change"}, {BTN_EAST, "Close"}});
        return;
    }
    if (tal_col == t->slots + 1) {
        card(170);
        u.text(LX + LW / 2, LY + 20, "Brass Stylus", 34, pal::brass, Align::Center, 1.2f);
        snprintf(b, sizeof b, "Carve another Wafq slot (up to 5). You have %d.", H.currency[CUR_STYLUS]);
        u.text(LX + LW / 2, LY + 80, b, 24, pal::soft, Align::Center);
        legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Carve a slot"}, {BTN_EAST, "Close"}});
        return;
    }
    // the Talisman itself, worked out with everything it carries
    SkillCtx c = skill_ctx(*t, H.stats, H.weapon().weapon());
    const SkillDef& d = t->def();
    card(640);
    u.text(LX + LW / 2, LY + 20, d.name, 38, pal::amber, Align::Center, 1.3f);
    snprintf(b, sizeof b, "Talisman, level %d  \xC2\xB7  %s", t->level, (d.tags & T_SPELL) ? "Spell" : (d.tags & T_ATTACK) ? "Attack" : "Warcry");
    u.text(LX + LW / 2, LY + 70, b, 24, pal::dim, Align::Center);
    float y = LY + 116;
    y += u.wrap(LX + 40, y, LW - 80, d.desc, 26, pal::bone, 1.3f) + 16;
    auto row = [&](const char* k, const std::string& v, Rgba col = pal::bone) {
        u.text(LX + 60, y, k, 26, pal::soft);
        u.text(LX + LW - 60, y, v, 26, col, Align::Right, 0.6f);
        y += 38;
    };
    int req = skill_requirement(d, t->level);
    static const Stat attr_stat[3] = {S_STR, S_DEX, S_INT};
    snprintf(b, sizeof b, "%d %s (you have %d)", req, attr_name(d.attr), int(H.stats.value(attr_stat[d.attr])));
    if (req > 0) row("Requires", b, c.usable ? pal::good : pal::bad);
    snprintf(b, sizeof b, "%.0f", c.mana);
    row("Mana cost", b);
    if (c.cooldown > 0) { snprintf(b, sizeof b, "%.1f s", c.cooldown); row("Cooldown", b); }
    if (d.tags & (T_ATTACK | T_SPELL)) {
        std::string dmg;
        for (int k = 0; k < DT_COUNT; k++)
            if (c.hit.max[size_t(k)] > 0) {
                snprintf(b, sizeof b, "%s%.0f-%.0f %s", dmg.empty() ? "" : ", ", c.hit.min[size_t(k)], c.hit.max[size_t(k)], damage_type_name(k));
                dmg += b;
            }
        row("Damage", dmg.empty() ? "-" : dmg);
        snprintf(b, sizeof b, "%.2f per second", c.hit.speed);
        row((d.tags & T_SPELL) ? "Casts" : "Attacks", b);
        snprintf(b, sizeof b, "%.1f%%", c.hit.crit_chance * 100);
        row("Critical strike chance", b);
        snprintf(b, sizeof b, "%.1f", c.hit.dps() * std::max(1, c.projectiles));
        row("Damage per second", b, pal::amber);
    }
    if (c.projectiles > 1) row("Projectiles", std::to_string(c.projectiles));
    if (c.chains > 0) row("Chains", std::to_string(c.chains));
    if (c.ignite > 0) { snprintf(b, sizeof b, "%.0f%%", c.ignite * 100); row("Chance to Ignite", b); }
    if (c.shock > 0) { snprintf(b, sizeof b, "%.0f%%", c.shock * 100); row("Chance to Shock", b); }
    legend(PX + 30, PY + PH - 58 + 0, {{BTN_SOUTH, "Change"}, {BTN_RIGHT, "Wafq"}, {BTN_EAST, "Close"}});
}

// ================================================================ Character, with "Why?"
namespace {
struct SheetRow {
    const char* label;
    Stat stat;
    uint32_t ctx;
    int kind;   // 0 plain value, 1 percent, 2 the main skill's DPS, 3 resistance, 4 speed of the main skill
};
const SheetRow kRows[] = {
    {"Main skill DPS", S_DAMAGE, 0, 2},
    {"Attacks or casts per second", S_ATTACK_SPEED, 0, 4},
    {"Critical strike chance", S_CRIT_CHANCE, 0, 5},
    {"Maximum life", S_LIFE, 0, 0},
    {"Maximum mana", S_MANA, 0, 0},
    {"Maximum Hirz (energy shield)", S_ES, 0, 0},
    {"Armour", S_ARMOUR, 0, 0},
    {"Evasion", S_EVASION, 0, 0},
    {"Fire resistance", S_FIRE_RES, 0, 3},
    {"Cold resistance", S_COLD_RES, 0, 3},
    {"Lightning resistance", S_LIGHTNING_RES, 0, 3},
    {"Chaos resistance", S_CHAOS_RES, 0, 3},
    {"Life regeneration", S_LIFE_REGEN, 0, 0},
    {"Mana regeneration", S_MANA_REGEN, 0, 0},
    {"Strength", S_STR, 0, 0},
    {"Dexterity", S_DEX, 0, 0},
    {"Intelligence", S_INT, 0, 0},
    {"Movement speed", S_MOVE_SPEED, 0, 1},
};
constexpr int kRowCount = int(sizeof kRows / sizeof kRows[0]);
}  // namespace

void Menu::char_update(World& w, const Input& in, int dir) {
    if (dir == D_UP) { why_row = std::max(0, why_row - 1); w.emit(Ev::Craft, w.actors[0].pos, 0); }
    if (dir == D_DOWN) { why_row = std::min(kRowCount - 1, why_row + 1); w.emit(Ev::Craft, w.actors[0].pos, 0); }
    if (in.hit(BTN_NORTH) || in.hit(BTN_SOUTH)) why_open = !why_open;
}

void Menu::char_render(const World& w) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    const Actor& h = w.actors[0];
    const Stats& s = H.stats;
    char b[160];
    float x = PX + 50, y = PY + 100;
    u.text(x, y, class_def(H.passives.cls).name, 40, pal::amber, Align::Left, 1.4f, true);
    snprintf(b, sizeof b, "Level %d  \xC2\xB7  %d stars placed, %d to place  \xC2\xB7  %d laid to rest", H.level, H.passives.spent(),
             H.passive_points(), H.kills);
    u.text(x, y + 50, b, 22, pal::soft);
    y += 100;
    int main = w.main_slot();
    SkillCtx mc = w.slot_ctx(main);
    Defences d = defences_of(s);
    for (int r = 0; r < kRowCount; r++) {
        const SheetRow& row = kRows[r];
        std::string v;
        switch (row.kind) {
            case 2: snprintf(b, sizeof b, "%.1f  (%s)", mc.def ? mc.hit.dps() * std::max(1, mc.projectiles) : 0.f, mc.def ? mc.def->name : "-"); v = b; break;
            case 4: snprintf(b, sizeof b, "%.2f", mc.def ? mc.hit.speed : 0.f); v = b; break;
            case 5: snprintf(b, sizeof b, "%.1f%%", mc.def ? mc.hit.crit_chance * 100 : 0.f); v = b; break;
            case 3: {
                int t = row.stat == S_FIRE_RES ? DT_FIRE : row.stat == S_COLD_RES ? DT_COLD : row.stat == S_LIGHTNING_RES ? DT_LIGHTNING : DT_CHAOS;
                snprintf(b, sizeof b, "%d%%", int(std::min(d.res[size_t(t)], d.max_res)));
                v = b;
                break;
            }
            case 1: snprintf(b, sizeof b, "%+.0f%%", s.sum(row.stat).inc); v = b; break;
            default: {
                float val = row.stat == S_LIFE ? h.life_max : row.stat == S_MANA ? h.mana_max : row.stat == S_ES ? H.es_max
                          : row.stat == S_MANA_REGEN ? s.value(S_MANA_REGEN, h.mana_max * 0.03f) : s.value(row.stat);
                snprintf(b, sizeof b, row.stat == S_LIFE_REGEN || row.stat == S_MANA_REGEN ? "%.1f / s" : "%.0f", val);
                v = b;
            }
        }
        bool cur = why_row == r;
        if (cur) u.frame(PX + 30, y - 5, PW - 60, 42, pal::dusk, pal::amber, 8, 2);
        u.text(x + 10, y, row.label, 26, cur ? pal::amber : pal::soft, Align::Left, cur ? 0.6f : 0.f);
        u.text(PX + PW - 60, y, v, 26, pal::bone, Align::Right, 0.6f);
        y += 42;
    }
    legend(PX + 30, PY + PH - 58, {{BTN_NORTH, why_open ? "Hide why" : "Why?"}, {BTN_L1, "Tabs"}, {BTN_EAST, "Close"}});
    if (!why_open) return;
    // ---- "Why?": every modifier behind the number, and where it came from
    const SheetRow& row = kRows[why_row];
    std::vector<std::pair<std::string, std::string>> lines;
    auto add_mods = [&](Stat st, uint32_t ctx, bool pct_flat) {
        for (const Mod& m : (row.kind == 2 || row.kind == 4 || row.kind == 5 ? mc.stats : s).why(st, ctx)) {
            if (std::fabs(m.value) < 0.01f) continue;
            lines.push_back({mod_value(m, pct_flat), source_name(H, m.source)});
        }
    };
    std::string head = row.label;
    if (row.kind == 2 && mc.def) {
        // the hit pipeline, step by step (GDD §8)
        const SkillDef& sd = *mc.def;
        head = std::string(sd.name) + ": the hit, step by step";
        if (sd.tags & T_ATTACK) {
            WeaponStats ws = H.weapon().weapon();
            snprintf(b, sizeof b, "%.0f-%.0f physical from %s, at %.0f%% effectiveness", ws.phys_min, ws.phys_max, H.weapon().display_name().c_str(),
                     mc.ss.effectiveness * 100);
        } else {
            snprintf(b, sizeof b, "%.0f-%.0f %s at level %d", mc.ss.base_min, mc.ss.base_max, damage_type_name(sd.base_type), mc.level);
        }
        lines.push_back({"1 Base", b});
        for (int t = 0; t < DT_COUNT; t++) {
            uint32_t ctx = sd.tags | damage_type_tags(t);
            for (const Mod& m : mc.stats.why(S_ADDED_MIN, ctx)) {
                float hi = 0;
                for (const Mod& m2 : mc.stats.why(S_ADDED_MAX, ctx)) if (m2.source == m.source) hi += m2.value;
                snprintf(b, sizeof b, "Adds %.0f-%.0f %s", m.value, hi, damage_type_name(t));
                lines.push_back({"2 Added", std::string(b) + " (" + source_name(H, m.source) + ")"});
            }
        }
        for (const Mod& m : mc.stats.why(S_GAIN_FIRE, sd.tags)) lines.push_back({"3 Gain", mod_value(m, true) + " of damage as Fire (" + source_name(H, m.source) + ")"});
        float inc_total = 0;
        uint32_t ctx_all = sd.tags | damage_type_tags(sd.tags & T_SPELL ? sd.base_type : DT_PHYS);
        for (const Mod& m : mc.stats.why(S_DAMAGE, ctx_all))
            if (m.kind == MK_INC) { inc_total += m.value; lines.push_back({"4 Increased", mod_value(m) + " (" + source_name(H, m.source) + ")"}); }
        snprintf(b, sizeof b, "%.0f%% increased in all", inc_total);
        lines.push_back({"4 Increased", b});
        for (const Mod& m : mc.stats.why(S_DAMAGE, ctx_all))
            if (m.kind == MK_MORE) lines.push_back({"5 More", mod_value(m) + " (" + source_name(H, m.source) + ")"});
        snprintf(b, sizeof b, "%.1f%% chance, x%.2f damage", mc.hit.crit_chance * 100, mc.hit.crit_multi);
        lines.push_back({"6 Crit", b});
        snprintf(b, sizeof b, "%.2f per second", mc.hit.speed);
        lines.push_back({"Speed", b});
        snprintf(b, sizeof b, "%.1f average hit, %.1f per second", mc.hit.average(), mc.hit.dps() * std::max(1, mc.projectiles));
        lines.push_back({"Result", b});
    } else if (row.kind == 4) {
        add_mods(mc.def && (mc.def->tags & T_SPELL) ? S_CAST_SPEED : S_ATTACK_SPEED, mc.def ? mc.def->tags : 0, false);
    } else if (row.kind == 5) {
        add_mods(S_CRIT_CHANCE, mc.def ? mc.def->tags : 0, false);
    } else {
        add_mods(row.stat, 0, row.kind == 3);
        if (row.kind == 3) lines.push_back({"Cap", "75% at most; the rest is over the cap"});
    }
    float h2 = 120 + std::min<size_t>(lines.size(), 22) * 38;
    u.frame(LX, LY, LW, h2, pal::panel.alpha(0.97f), pal::amber.alpha(0.8f), 14, 2);
    u.text(LX + LW / 2, LY + 20, std::string("Why? ") + head, 32, pal::amber, Align::Center, 1.1f);
    float yy = LY + 84;
    if (lines.empty()) u.text(LX + 40, yy, "Nothing changes it: this is the base value.", 26, pal::soft);
    for (size_t i = 0; i < lines.size() && i < 22; i++) {
        u.text(LX + 40, yy, lines[i].first, 24, pal::brass, Align::Left, 0.6f);
        float fs = std::min(24.f, 24.f * (LW - 300) / std::max(1.f, u.text_width(lines[i].second, 24)));
        u.text(LX + 250, yy + (24 - fs) * 0.5f, lines[i].second, fs, pal::bone);
        yy += 38;
    }
}

}  // namespace q
