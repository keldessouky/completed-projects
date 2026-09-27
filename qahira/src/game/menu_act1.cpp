// Act I's screens in the menu: Usta Hassan's Bench (beside your belongings), the Ascendancy tab, and the Journal
// (quests, the codex, and the film posters you are piecing together).
#include "game/menu.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <cmath>
#include <cstdio>

namespace q {

namespace {
void legend(float x, float y, std::initializer_list<std::pair<int, const char*>> items) {
    Ui& u = ui();
    for (auto& [b, label] : items) {
        draw_button_glyph(x + 20, y + 18, 38, b);
        x += 48;
        x += u.text(x, y, label, 26, pal::soft) + 30;
    }
}

constexpr float PX = 1030, PY = 36, PW = 850, PH = 1008;
constexpr float BX = 40, BY = 36, BW = 400, BH = 1008;       // the bench's recipe list
constexpr float ROW = 50;
enum Dir { D_UP, D_DOWN, D_LEFT, D_RIGHT };

std::string affix_text(const Affix& a) {
    const AffixDef& d = affix_defs()[a.def];
    char b[128];
    if (std::string(d.fmt).find("to %d") != std::string::npos && d.effect != AE_STR && d.effect != AE_DEX && d.effect != AE_INT)
        snprintf(b, sizeof b, d.fmt, int(a.v1), int(a.v2));
    else snprintf(b, sizeof b, d.fmt, int(a.v1));
    return b;
}

// the item the cursor is on, in the belongings panel
Item* target_item(World& w, const Menu& m) {
    Hero& H = w.hero;
    if (m.region == Region::Grid) { int i = m.hovered_inv(w); return i >= 0 ? &H.inv.items[size_t(i)].item : nullptr; }
    if (m.region == Region::Equip) return H.equip[m.eq].empty() ? nullptr : &H.equip[m.eq];
    return nullptr;
}

float fit(const std::string& t, float fs, float w) { return std::min(fs, fs * w / std::max(1.f, ui().text_width(t, fs))); }
}  // namespace

// ================================================================ the bench
void Menu::bench_move(World& w, int dir) {
    int n = int(recipes().size()) + 1;
    if (dir == D_UP) bench_cursor = (bench_cursor + n - 1) % n;
    if (dir == D_DOWN) bench_cursor = (bench_cursor + 1) % n;
    if (dir == D_RIGHT) {
        region = Region::Grid;
        cx = 0;
        cy = 0;
        int it = w.hero.inv.at(cx, cy);
        if (it >= 0) { cx = w.hero.inv.items[size_t(it)].x; cy = w.hero.inv.items[size_t(it)].y; }
    }
}

bool Menu::bench_south(World& w) {
    Hero& H = w.hero;
    int n = int(recipes().size());
    if (region == Region::Bench) {
        if (bench_cursor == n) { held_recipe = kTakeOff; say("Choose an item to take its bench mod off"); return true; }
        if (!(H.recipes >> bench_cursor & 1)) { say(std::string("Not found yet: ") + recipes()[size_t(bench_cursor)].where); return true; }
        held_recipe = bench_cursor;
        say("Choose an item for Usta Hassan");
        return true;
    }
    if (held_recipe < 0) return false;
    Item* it = target_item(w, *this);
    if (!it) return true;
    std::string why;
    if (held_recipe == kTakeOff) {
        if (!remove_crafted(*it, &why)) { say(why); return true; }
        say("The bench mod is off");
    } else {
        int cost = recipes()[size_t(held_recipe)].cost;
        if (!recipe_fits(held_recipe, *it, &why)) { say(why); return true; }
        if (H.gold < cost) { say("Not enough dinars"); return true; }
        H.gold -= cost;
        apply_recipe(held_recipe, *it, &why);
        say("Crafted: " + affix_text(recipe_affix(held_recipe)));
    }
    held_recipe = -1;
    w.recompute_hero();
    w.emit(Ev::Craft, w.actors[0].pos);
    return true;
}

void Menu::bench_render(const World& w, const Item*& tip, float& tip_y, std::string& footer) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    u.frame(BX, BY, BW, BH, pal::panel.alpha(0.96f), pal::line, 16, 2);
    u.text(BX + BW / 2, BY + 20, "Usta Hassan's Bench", 34, pal::amber, Align::Center, 1.2f, true);
    u.text(BX + BW / 2, BY + 64, "One bench mod per item, exact, for dinars", 20, pal::dim, Align::Center);
    int n = int(recipes().size());
    float y = BY + 104;
    for (int r = 0; r <= n; r++) {
        bool cur = region == Region::Bench && bench_cursor == r, chosen = held_recipe == r || (r == n && held_recipe == kTakeOff);
        u.frame(BX + 14, y, BW - 28, ROW - 6, cur ? pal::dusk : pal::panel2, chosen ? pal::amber : cur ? pal::brass : pal::line, 8, cur || chosen ? 2.f : 1.f);
        if (r == n) {
            u.text(BX + 30, y + 9, "Take off a bench mod", 24, pal::soft);
            u.text(BX + BW - 30, y + 11, "free", 20, pal::dim, Align::Right);
        } else {
            bool known = H.recipes >> r & 1;
            std::string t = known ? affix_text(recipe_affix(r)) : "?  " + std::string(recipes()[size_t(r)].where);
            u.text(BX + 30, y + 9, t, fit(t, 24, BW - 130), known ? pal::turquoise : pal::dim);
            if (known) u.text(BX + BW - 30, y + 11, std::to_string(recipes()[size_t(r)].cost) + " d", 20, pal::rare, Align::Right);
        }
        y += ROW;
    }
    // what the chosen recipe would do to the item under the cursor
    if (held_recipe >= 0 && tip) {
        std::string why;
        if (held_recipe == kTakeOff) footer = tip->has_crafted() ? "Take its bench mod off" : "It has no bench mod";
        else footer = recipe_fits(held_recipe, *tip, &why) ? "Craft for " + std::to_string(recipes()[size_t(held_recipe)].cost) + " dinars" : why;
    }
    (void)tip_y;
}

// ================================================================ the Ascendancy tab
namespace {
constexpr float AX = PX + PW / 2, AY = PY + 492, AU = 72;   // the inner sky's centre and scale
vec2 node_screen(const AscNode& n) { return {AX + n.pos.x * AU, AY - n.pos.y * AU}; }
bool has_child(const Ascendancy& a, uint32_t held, int node) {
    for (size_t i = 1; i < a.nodes.size(); i++) if (a.nodes[i].parent == node && (held >> i & 1)) return true;
    return false;
}
}  // namespace

void Menu::asc_update(World& w, const Input& in, int dir) {
    Hero& H = w.hero;
    const Ascendancy* a = ascendancy_for(H.passives.cls);
    if (!a) return;
    int n = int(a->nodes.size());
    asc_cursor = std::clamp(asc_cursor, 0, n - 1);
    if (dir >= 0) {
        vec2 want{dir == D_LEFT ? -1.f : dir == D_RIGHT ? 1.f : 0.f, dir == D_UP ? 1.f : dir == D_DOWN ? -1.f : 0.f};
        vec2 from = a->nodes[size_t(asc_cursor)].pos;
        int best = -1;
        float bs = 1e9f;
        for (int i = 0; i < n; i++) {
            if (i == asc_cursor) continue;
            vec2 d = a->nodes[size_t(i)].pos - from;
            float along = dot(d, want);
            if (along <= 0.2f) continue;
            float score = along + std::fabs(dot(d, vec2{want.y, -want.x})) * 1.6f;
            if (score < bs) { bs = score; best = i; }
        }
        if (best >= 0) { asc_cursor = best; w.emit(Ev::Craft, w.actors[0].pos, 0); }
    }
    if (in.hit(BTN_SOUTH)) {
        if (H.asc >> asc_cursor & 1) { say("You hold this already"); return; }
        if (H.asc_points() <= 0) { say(H.quests & Q_TRIAL1 ? "No ascendancy points left" : "Pass the First Trial at Bab Zuweila to ascend"); return; }
        if (!asc_can_take(*a, H.asc, asc_cursor)) { say("Take the node before it first"); return; }
        H.asc |= 1u << asc_cursor;
        w.recompute_hero();
        say(std::string("Ascended: ") + a->nodes[size_t(asc_cursor)].name);
        w.emit(Ev::LevelUp, w.actors[0].pos);
    }
    if (in.hit(BTN_WEST) && (H.asc >> asc_cursor & 1)) {   // a refund costs a Rosewater Vial, like a star after level 20
        if (has_child(*a, H.asc, asc_cursor)) { say("Refund the nodes after it first"); return; }
        if (H.currency[CUR_ROSEWATER] <= 0) { say("A refund costs a Rosewater Vial"); return; }
        H.currency[CUR_ROSEWATER]--;
        H.asc &= ~(1u << asc_cursor);
        w.recompute_hero();
        say("Refunded");
    }
}

void Menu::asc_render(const World& w) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    const Ascendancy* a = ascendancy_for(H.passives.cls);
    if (!a) { u.text(PX + PW / 2, PY + 300, "No ascendancy for this class yet", 30, pal::dim, Align::Center); return; }
    Rgba col = Rgba::hex(a->color);
    u.text(PX + PW / 2, PY + 96, a->name, 44, col, Align::Center, 1.2f, true);
    u.text(PX + PW / 2, PY + 150, a->blurb, fit(a->blurb, 24, PW - 80), pal::soft, Align::Center);
    int pts = H.asc_points();
    std::string p = (H.quests & Q_TRIAL1) || H.asc ? "Ascendancy points: " + std::to_string(pts) : "Pass the First Trial at Bab Zuweila to ascend";
    u.text(PX + PW / 2, PY + 186, p, 24, pts > 0 ? pal::amber : pal::dim, Align::Center, 0.6f);
    // the inner sky: a ring of night, lines from each node to its parent
    u.ring(AX, AY, AU * 3.55f, AU * 3.5f, col.alpha(0.25f));
    for (size_t i = 1; i < a->nodes.size(); i++) {
        const AscNode& nd = a->nodes[i];
        vec2 p0 = node_screen(nd), p1 = node_screen(a->nodes[size_t(std::max(0, nd.parent))]);
        bool lit = (H.asc >> i & 1);
        u.line(p0.x, p0.y, p1.x, p1.y, lit ? 5.f : 2.f, lit ? col : pal::line);
    }
    float pulse = 0.5f + 0.5f * std::sin(w.time * 4.f);
    for (size_t i = 0; i < a->nodes.size(); i++) {
        const AscNode& nd = a->nodes[i];
        vec2 p = node_screen(nd);
        bool held = i == 0 || (H.asc >> i & 1), can = pts > 0 && asc_can_take(*a, H.asc, int(i));
        float r = i == 0 ? 34 : nd.notable ? 26 : 15;
        if (can) u.ring(p.x, p.y, r + 10, r + 6, pal::amber.alpha(0.4f + 0.5f * pulse));
        u.disc(p.x, p.y, r, held ? col : pal::panel2);
        u.ring(p.x, p.y, r, r - 3, held ? pal::bone : col.alpha(0.6f));
        if (nd.notable) u.ring(p.x, p.y, r - 7, r - 9, held ? pal::night.alpha(0.6f) : col.alpha(0.3f));
        if (int(i) == asc_cursor) u.ring(p.x, p.y, r + 16, r + 12, pal::amber);
    }
    // the node under the cursor
    const AscNode& nd = a->nodes[size_t(asc_cursor)];
    float y = PY + 742;
    u.frame(PX + 40, y, PW - 80, 186, pal::panel2, nd.notable ? col : pal::line, 12, 2);
    u.text(PX + PW / 2, y + 16, nd.name, 32, nd.notable ? col : pal::bone, Align::Center, 1.f);
    float ly = y + 60;
    for (const char* t : nd.text) { u.text(PX + PW / 2, ly, t, fit(t, 25, PW - 120), pal::magic, Align::Center); ly += 34; }
    if (asc_cursor == 0) u.text(PX + PW / 2, ly, "Your ascendancy's heart: every path starts here", 24, pal::dim, Align::Center);
    legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Ascend"}, {BTN_WEST, "Refund (Rosewater)"}, {BTN_EAST, "Close"}});
}

// ================================================================ the Journal
int journal_rows(const Hero& h, int section) {
    (void)h;
    if (section == 0) return int(quest_defs().size());
    if (section == 1) return int(codex_entries().size());
    return int(unique_defs().size());
}

void Menu::journal_update(World& w, const Input& in, int dir) {
    (void)in;
    const Hero& H = w.hero;
    if (dir == D_LEFT || dir == D_RIGHT) {
        journal_section = (journal_section + (dir == D_RIGHT ? 1 : 2)) % 3;
        journal_row = 0;
        w.emit(Ev::Craft, w.actors[0].pos, 0);
    }
    int n = journal_rows(H, journal_section);
    if (dir == D_UP) journal_row = (journal_row + n - 1) % n;
    if (dir == D_DOWN) journal_row = (journal_row + 1) % n;
    if (dir == D_UP || dir == D_DOWN) w.emit(Ev::Craft, w.actors[0].pos, 0);
}

void draw_poster(float x, float y, float w, float h, int unique, int scraps, float alpha) {
    Ui& u = ui();
    const UniqueDef& d = unique_def(unique);
    Rgba a = Rgba::hex(d.poster[0]).alpha(alpha), b = Rgba::hex(d.poster[1]).alpha(alpha);
    // painted in bands, from one colour to the other, like a hand-painted billboard
    const int bands = 14;
    for (int k = 0; k < bands; k++) u.rect(x, y + h * k / bands, w, h / bands + 1, a.mix(b, float(k) / (bands - 1) * 0.7f));
    u.rect(x + w * 0.1f, y + h * 0.22f, w * 0.8f, h * 0.42f, b.mix(pal::night, 0.55f), 12);   // the scene
    u.disc(x + w * 0.35f, y + h * 0.38f, w * 0.12f, a.mix(pal::bone, 0.35f));                 // two faces
    u.disc(x + w * 0.62f, y + h * 0.42f, w * 0.1f, a.mix(pal::bone, 0.2f));
    u.text(x + w / 2, y + h * 0.05f, std::to_string(d.year), 26, pal::bone.alpha(alpha), Align::Center, 0.6f);
    u.text(x + w / 2, y + h * 0.1f, d.film_ar, fit(d.film_ar, 26, w - 40), b.mix(pal::bone, 0.6f), Align::Center, 0.6f);
    u.text(x + w / 2, y + h * 0.68f, d.film, fit(d.film, 44, w - 40), pal::bone.alpha(alpha), Align::Center, 1.2f, true);
    u.text(x + w / 2, y + h * 0.77f, d.tagline, fit(d.tagline, 24, w - 40), pal::bone.alpha(0.85f * alpha), Align::Center);
    u.text(x + w / 2, y + h * 0.86f, d.starring, fit(d.starring, 24, w - 40), pal::rare.alpha(alpha), Align::Center, 0.6f);
    // the quarters you do not have are torn away
    for (int q = scraps; q < kScrapsPerPoster; q++) {
        float qx = x + (q % 2) * w / 2, qy = y + (q / 2) * h / 2;
        u.rect(qx, qy, w / 2, h / 2, pal::night.alpha(0.88f * alpha));
        u.line(qx + 6, qy + h / 2 - 20, qx + w / 2 - 6, qy + 20, 3, pal::line.alpha(alpha));
    }
    Rgba fr = pal::brass.alpha(alpha);   // the frame: four strips, so nothing covers the paint
    u.rect(x - 4, y - 4, w + 8, 4, fr);
    u.rect(x - 4, y + h, w + 8, 4, fr);
    u.rect(x - 4, y, 4, h, fr);
    u.rect(x + w, y, 4, h, fr);
}

void Menu::journal_render(const World& w) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    static const char* sec[] = {"Quests", "Codex", "Posters"};
    float sx = PX + 70;
    for (int k = 0; k < 3; k++) {
        bool on = journal_section == k;
        float tw = u.text_width(sec[k], 30) + 40;
        u.frame(sx, PY + 92, tw, 50, on ? pal::dusk : pal::panel2, on ? pal::amber : pal::line, 10, on ? 2.f : 1.f);
        u.text(sx + tw / 2, PY + 100, sec[k], 30, on ? pal::amber : pal::soft, Align::Center, on ? 1.f : 0.3f);
        sx += tw + 14;
    }
    int n = journal_rows(H, journal_section);
    const float row = journal_section == 2 ? 38 : 46;
    int first = std::clamp(journal_row - 8, 0, std::max(0, n - 18));
    float y = PY + 170;
    float dx = PX - 640, dy = PY + 60, dw = 600;   // the detail card, over the dimmed world
    for (int i = first; i < n && y < PY + PH - 90; i++) {
        bool cur = i == journal_row;
        std::string t;
        Rgba c = pal::bone;
        std::string right;
        if (journal_section == 0) {
            const QuestDef& q = quest_defs()[size_t(i)];
            bool done = H.quests & q.bit;
            t = q.title;
            c = done ? pal::good : pal::bone;
            right = done ? "done" : "";
        } else if (journal_section == 1) {
            const CodexEntry& e = codex_entries()[size_t(i)];
            bool seen = H.codex >> i & 1;
            t = seen ? e.title : "? ? ?";
            c = seen ? (e.kind == CX_MONSTER ? pal::sand : pal::turquoise) : pal::dim;
        } else {
            const UniqueDef& d = unique_def(i);
            t = d.film;
            int sc = H.scraps[i];
            c = sc > 0 ? pal::unique : pal::soft;
            right = std::to_string(sc) + " / " + std::to_string(kScrapsPerPoster);
        }
        if (cur) u.frame(PX + 40, y - 4, PW - 80, row - 2, pal::dusk, pal::amber, 8, 2);
        u.text(PX + 60, y + 4, t, fit(t, row > 40 ? 28 : 25, PW - 260), c, Align::Left, cur ? 0.8f : 0.3f);
        if (!right.empty()) u.text(PX + PW - 60, y + 6, right, 22, pal::dim, Align::Right);
        y += row;
    }
    // the detail of the row under the cursor
    if (journal_section == 2) {
        draw_poster(dx + 60, dy + 30, 480, 690, journal_row, H.scraps[journal_row]);
        const UniqueDef& d = unique_def(journal_row);
        std::string s = std::string("Shows: ") + d.name;
        u.text(dx + dw / 2 - 0, dy + 750, s, fit(s, 26, dw), pal::unique, Align::Center, 0.8f);
        u.text(dx + dw / 2, dy + 790, "Four scraps make the poster, and the poster gives you what it shows", 20, pal::dim, Align::Center);
    } else {
        std::string title, text;
        if (journal_section == 0) {
            const QuestDef& q = quest_defs()[size_t(journal_row)];
            title = q.title;
            text = q.text;
            if (q.passive_points) text += "  Reward: " + std::to_string(q.passive_points) + " passive star.";
            if (q.asc_points) text += "  Reward: " + std::to_string(q.asc_points) + " ascendancy points.";
        } else {
            const CodexEntry& e = codex_entries()[size_t(journal_row)];
            bool seen = H.codex >> journal_row & 1;
            title = seen ? e.title : "Not yet met";
            text = seen ? e.text : "You will find this entry when you first meet it in the city.";
        }
        u.frame(dx, dy + 60, dw, 360, pal::panel.alpha(0.97f), pal::line, 12, 2);
        u.text(dx + dw / 2, dy + 80, title, fit(title, 32, dw - 40), pal::amber, Align::Center, 1.f);
        u.wrap(dx + 30, dy + 140, dw - 60, text, 26, pal::bone);
    }
    legend(PX + 30, PY + PH - 58, {{BTN_LEFT, "Section"}, {BTN_EAST, "Close"}});
}

}  // namespace q
