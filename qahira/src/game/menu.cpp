#include "game/menu.hpp"
#include "game/settings.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <cstdio>

namespace q {

// ---- layout (virtual 1920x1080)
namespace {
constexpr float C = 64;                       // one inventory cell
constexpr float PX = 1030, PY = 36, PW = 850, PH = 1008;
constexpr float EX = PX + 41, EY = PY + 104;  // equipment
constexpr float GX = PX + 41, GY = 580;       // inventory grid
constexpr float PUY = 912;                    // purse row
constexpr float VX = 40, VY = 36, VW = 850;   // vendor panel
constexpr float SX = VX + 41, SY = VY + 104;  // vendor stock grid
constexpr int kPurseCells = 10;               // currencies shown at once; the row scrolls

struct SlotRect { float x, y, w, h; };
constexpr SlotRect kSlots[EQ_COUNT] = {
    {0.4f, 0.3f, 2, 4},    // weapon
    {5, 0, 2, 2},          // helmet
    {5, 2.25f, 2, 3},      // body
    {2.9f, 3.75f, 2, 2},   // gloves
    {7.35f, 3.75f, 2, 2},  // boots
    {5, 5.4f, 2, 1},       // belt
    {7.35f, 1.0f, 1, 1},   // amulet
    {3.6f, 2.4f, 1, 1},    // ring 1
    {7.35f, 2.4f, 1, 1},   // ring 2
};

vec2 slot_center(int e) { return {EX + (kSlots[e].x + kSlots[e].w / 2) * C, EY + (kSlots[e].y + kSlots[e].h / 2) * C}; }

enum Dir { D_UP, D_DOWN, D_LEFT, D_RIGHT };
}  // namespace

// ---------------------------------------------------------------- icons
void draw_currency_icon(float cx, float cy, float s, int c, float alpha) {
    Ui& u = ui();
    Rgba col = Rgba::hex(currency_def(c).color).alpha(alpha);
    if (is_omen(c)) {   // a small coffee cup, the grounds' shape inside
        u.rect(cx - s * 0.24f, cy - s * 0.16f, s * 0.42f, s * 0.36f, Rgba::hex(0xEDE3D1).alpha(alpha), s * 0.08f);
        u.ring(cx + s * 0.22f, cy, s * 0.11f, s * 0.06f, Rgba::hex(0xEDE3D1).alpha(alpha));
        u.disc(cx - s * 0.03f, cy - s * 0.1f, s * 0.12f, col);
        static const float mx[4] = {-0.08f, 0.05f, 0.0f, -0.05f};
        u.disc(cx + s * mx[c - kFirstOmen], cy - s * 0.12f, s * 0.05f, Rgba::hex(0x1A120C).alpha(alpha));
        u.rect(cx - s * 0.32f, cy + s * 0.2f, s * 0.58f, s * 0.05f, pal::brass.alpha(alpha), 2);
        return;
    }
    if (c >= kFirstBlend && c <= kLastBlend) {   // a little paper cone of spice
        u.line(cx - s * 0.26f, cy - s * 0.18f, cx, cy + s * 0.3f, s * 0.08f, Rgba::hex(0xE8DCC0).alpha(alpha));
        u.line(cx + s * 0.26f, cy - s * 0.18f, cx, cy + s * 0.3f, s * 0.08f, Rgba::hex(0xE8DCC0).alpha(alpha));
        u.disc(cx, cy - s * 0.16f, s * 0.26f, col);
        u.disc(cx - s * 0.08f, cy - s * 0.22f, s * 0.07f, Rgba::hex(0xFFFFFF).alpha(0.4f * alpha));
        return;
    }
    if (c == CUR_SPLINTER) {   // a sliver of river-glass
        u.line(cx - s * 0.18f, cy + s * 0.28f, cx + s * 0.16f, cy - s * 0.3f, s * 0.16f, col);
        u.line(cx - s * 0.12f, cy + s * 0.18f, cx + s * 0.1f, cy - s * 0.2f, s * 0.05f, Rgba::hex(0xFFFFFF).alpha(0.6f * alpha));
        return;
    }
    if (c == CUR_PEARL) {   // a pearl in a half-shell
        u.disc(cx, cy + s * 0.14f, s * 0.38f, Rgba::hex(0x3A5A78).alpha(alpha));
        u.disc(cx, cy + s * 0.08f, s * 0.32f, Rgba::hex(0x9ABACC).alpha(alpha));
        u.disc(cx, cy - s * 0.02f, s * 0.2f, col);
        u.disc(cx - s * 0.06f, cy - s * 0.08f, s * 0.07f, Rgba::hex(0xFFFFFF).alpha(0.8f * alpha));
        u.ring(cx, cy - s * 0.02f, s * 0.2f, s * 0.17f, Rgba::hex(0xC8A8D8).alpha(0.6f * alpha));
        return;
    }
    if (c == CUR_RIFT_SEAL) {   // a round seal with the river's three waves on it
        u.disc(cx, cy, s * 0.36f, col);
        u.ring(cx, cy, s * 0.36f, s * 0.3f, Rgba::hex(0x8FDFF0).alpha(alpha));
        for (int k = -1; k <= 1; k++)
            for (int i = 0; i < 4; i++) {
                float x0 = cx - s * 0.2f + i * s * 0.1f, y0 = cy + k * s * 0.1f + (i % 2 ? -1.f : 1.f) * s * 0.025f;
                u.line(x0, y0, x0 + s * 0.1f, cy + k * s * 0.1f + (i % 2 ? 1.f : -1.f) * s * 0.025f, s * 0.03f, Rgba::hex(0xD8F8FF).alpha(alpha));
            }
        return;
    }
    u.disc(cx, cy + s * 0.04f, s * 0.36f, Rgba::hex(0x000000).alpha(0.35f * alpha));
    u.disc(cx, cy, s * 0.32f, col);
    u.disc(cx - s * 0.1f, cy - s * 0.1f, s * 0.09f, Rgba::hex(0xFFFFFF).alpha(0.7f * alpha));
    u.ring(cx, cy, s * 0.34f, s * 0.3f, pal::night.alpha(0.5f * alpha));
}

void draw_item_icon(float x, float y, float w, float h, const Item& it, float alpha) {
    Ui& u = ui();
    Rgba c = Rgba::hex(rarity_color(it.rarity)).alpha(alpha);
    Rgba d = c.mix(pal::night, 0.45f);
    float cx = x + w / 2, cy = y + h / 2, s = std::min(w, h);
    switch (it.b().slot) {
        case Slot::Weapon: {  // a maul: long haft, heavy head (a staff: a ring for a head; a bow: a curve and its string)
            if (it.b().wkind == WK_BOW) {
                float px = cx + w * 0.12f;
                for (int i = 0; i < 10; i++) {
                    float a0 = -kPi / 2 + kPi * i / 10.f, a1 = -kPi / 2 + kPi * (i + 1) / 10.f;
                    u.line(px - std::cos(a0) * w * 0.3f, cy + std::sin(a0) * h * 0.4f, px - std::cos(a1) * w * 0.3f, cy + std::sin(a1) * h * 0.4f, s * 0.07f, c);
                }
                u.line(px, cy - h * 0.4f, px, cy + h * 0.4f, s * 0.02f, Rgba::hex(0xE8DCC0).alpha(alpha));
                u.line(cx - w * 0.3f, cy, px + w * 0.14f, cy, s * 0.025f, d);
                break;
            }
            if (it.b().wkind == WK_STAFF) {
                u.line(cx - w * 0.14f, y + h * 0.92f, cx + w * 0.1f, y + h * 0.26f, s * 0.07f, d);
                u.ring(cx + w * 0.14f, y + h * 0.18f, s * 0.14f, s * 0.1f, c);
                u.disc(cx + w * 0.14f, y + h * 0.18f, s * 0.05f, c);
                break;
            }
            u.line(cx - w * 0.18f, y + h * 0.9f, cx + w * 0.08f, y + h * 0.22f, s * 0.09f, d);
            u.line(cx - w * 0.32f, y + h * 0.2f, cx + w * 0.38f, y + h * 0.28f, s * 0.26f, c);
            u.line(cx - w * 0.3f, y + h * 0.2f, cx + w * 0.36f, y + h * 0.28f, s * 0.08f, d);
            u.disc(cx - w * 0.2f, y + h * 0.9f, s * 0.06f, c);
            break;
        }
        case Slot::Helmet:
            for (int i = 0; i < 10; i++) {
                float a0 = kPi + kPi * i / 10.f, a1 = kPi + kPi * (i + 1) / 10.f;
                u.line(cx + std::cos(a0) * s * 0.3f, cy + s * 0.08f + std::sin(a0) * s * 0.3f, cx + std::cos(a1) * s * 0.3f,
                       cy + s * 0.08f + std::sin(a1) * s * 0.3f, s * 0.12f, c);
            }
            u.line(cx - s * 0.38f, cy + s * 0.12f, cx + s * 0.38f, cy + s * 0.12f, s * 0.08f, d);
            u.line(cx, cy - s * 0.2f, cx, cy + s * 0.12f, s * 0.05f, d);
            break;
        case Slot::Body:
            u.line(cx - w * 0.3f, y + h * 0.22f, cx + w * 0.3f, y + h * 0.22f, s * 0.1f, c);
            u.line(cx - w * 0.28f, y + h * 0.22f, cx - w * 0.24f, y + h * 0.82f, s * 0.14f, c);
            u.line(cx + w * 0.28f, y + h * 0.22f, cx + w * 0.24f, y + h * 0.82f, s * 0.14f, c);
            u.rect(cx - w * 0.22f, y + h * 0.26f, w * 0.44f, h * 0.56f, c, 6);
            u.line(cx - w * 0.3f, y + h * 0.25f, cx - w * 0.42f, y + h * 0.6f, s * 0.1f, d);
            u.line(cx + w * 0.3f, y + h * 0.25f, cx + w * 0.42f, y + h * 0.6f, s * 0.1f, d);
            u.line(cx, y + h * 0.28f, cx, y + h * 0.8f, s * 0.03f, d);
            break;
        case Slot::Gloves:
            u.rect(cx - s * 0.2f, cy - s * 0.05f, s * 0.36f, s * 0.34f, c, 6);
            for (int i = 0; i < 4; i++) u.line(cx - s * 0.16f + i * s * 0.1f, cy - s * 0.05f, cx - s * 0.17f + i * s * 0.11f, cy - s * 0.32f, s * 0.07f, c);
            u.line(cx + s * 0.16f, cy + s * 0.05f, cx + s * 0.3f, cy - s * 0.1f, s * 0.08f, c);
            u.rect(cx - s * 0.22f, cy + s * 0.25f, s * 0.4f, s * 0.08f, d, 3);
            break;
        case Slot::Boots:
            u.line(cx - s * 0.08f, cy - s * 0.32f, cx - s * 0.08f, cy + s * 0.18f, s * 0.2f, c);
            u.line(cx - s * 0.16f, cy + s * 0.2f, cx + s * 0.3f, cy + s * 0.2f, s * 0.16f, c);
            u.line(cx - s * 0.2f, cy + s * 0.3f, cx + s * 0.34f, cy + s * 0.3f, s * 0.05f, d);
            break;
        case Slot::Belt:
            u.line(x + w * 0.08f, cy, x + w * 0.92f, cy, h * 0.26f, c);
            u.ring(cx, cy, h * 0.24f, h * 0.14f, d);
            break;
        case Slot::Amulet:
            u.line(cx - s * 0.3f, cy - s * 0.35f, cx, cy + s * 0.05f, s * 0.04f, d);
            u.line(cx + s * 0.3f, cy - s * 0.35f, cx, cy + s * 0.05f, s * 0.04f, d);
            u.disc(cx, cy + s * 0.16f, s * 0.16f, Rgba::hex(0x3A7AE0).alpha(alpha));
            u.ring(cx, cy + s * 0.16f, s * 0.2f, s * 0.15f, c);
            break;
        case Slot::Ring:
            u.ring(cx, cy + s * 0.04f, s * 0.26f, s * 0.17f, c);
            u.disc(cx, cy - s * 0.2f, s * 0.08f, d);
            break;
        case Slot::Chart: {   // a rolled chart, tied, with a compass rose on its face
            Rgba parch = Rgba::hex(0xD8C090).alpha(alpha);
            u.rect(cx - s * 0.34f, cy - s * 0.22f, s * 0.68f, s * 0.44f, parch, s * 0.06f);
            u.disc(cx - s * 0.34f, cy, s * 0.22f, parch.mix(pal::night, 0.2f));
            u.disc(cx + s * 0.34f, cy, s * 0.22f, parch.mix(pal::night, 0.2f));
            u.line(cx, cy - s * 0.16f, cx, cy + s * 0.16f, s * 0.04f, c);
            u.line(cx - s * 0.16f, cy, cx + s * 0.16f, cy, s * 0.04f, c);
            u.ring(cx, cy, s * 0.1f, s * 0.06f, c);
            u.rect(cx + s * 0.12f, cy - s * 0.24f, s * 0.05f, s * 0.48f, d, 2);
            break;
        }
        default: break;
    }
}

// ---------------------------------------------------------------- state
void Menu::show(World& w, bool at_vendor) {
    open = true;
    vendor = at_vendor;
    tab = MenuTab::Inventory;
    held = -1;
    filter_cursor = w.hero.filter;
    if (vendor) { region = Region::Stock; cx = 0; cy = 0; }
    else if (!w.hero.inv.items.empty()) { region = Region::Grid; cx = w.hero.inv.items[0].x; cy = w.hero.inv.items[0].y; }
    else { region = Region::Equip; eq = EQ_WEAPON; }
    last_dir_ = -1;
}

void Menu::show_dealer(World& w) {
    show(w, true);
    dealer = true;
    restock_dealer(w);
}

// Amm Ramadan's back room: a couple of uniques, rares a little above your level, and charts of the highest Clime
void Menu::restock_dealer(World& w) {
    stock.items.clear();
    Rng& r = w.rng;
    const int lvl = std::max(1, w.hero.level) + 2;
    for (int i = 0; i < 2; i++) stock.add(make_unique(r.irange(0, int(unique_defs().size()) - 1), lvl, r));
    for (int i = 0; i < 5; i++) {
        Item it = random_drop(lvl, 1.f, 0.f, r, i == 0 ? Slot::Weapon : Slot::Count);
        if (it.b().slot == Slot::Chart) it = random_drop(lvl, 1.f, 0.f, r, Slot::Weapon);
        stock.add(it);
    }
    // the Fourth Clime's charts; once Act V is over, the Fifth's, the first step past the old edge of the map
    const int tier = (w.hero.quests & Q_ACT5) ? kChartTiersEarly + 1 : kChartTiersEarly;
    for (int i = 0; i < 2; i++) stock.add(make_chart(tier, r, 0.5f, 0.3f));
}

int Menu::relic_price(const Item& it) {
    if (it.rarity == Rarity::Unique) return 12;
    if (it.b().slot == Slot::Chart) return 3;
    return it.rarity == Rarity::Rare ? 4 : 2;
}

void Menu::show_bench(World& w) {
    show(w, false);
    bench = true;
    region = Region::Bench;
    bench_cursor = 0;
    held_recipe = -1;
}

void Menu::hide() {
    open = false;
    vendor = false;
    dealer = false;
    bench = false;
    held = -1;
    held_recipe = -1;
}

void Menu::restock(World& w) {
    stock.items.clear();
    int lvl = std::max(1, w.hero.level);
    Rng& r = w.rng;
    // two weapons, then armour and jewellery; mostly magic, sometimes rare
    for (int i = 0; i < 9; i++) {
        Slot only = i < 2 ? Slot::Weapon : Slot::Count;
        Item it = random_drop(lvl + 1, i == 0 ? 0.35f : 0.08f, 0.75f, r, only);
        if (it.rarity == Rarity::Normal) it = make_item(it.base, Rarity::Magic, it.ilvl, r);
        stock.add(it);
    }
}

int Menu::hovered_inv(const World& w) const {
    if (region != Region::Grid) return -1;
    return w.hero.inv.at(cx, cy);
}

int Menu::hovered_stock() const {
    if (region != Region::Stock) return -1;
    return stock.at(cx, cy);
}

// ---------------------------------------------------------------- input
void Menu::update(World& w, const Input& in, float dt) {
    toast_t = std::max(0.f, toast_t - dt);
    if (!open) return;
    if (in.hit(BTN_START)) { hide(); return; }
    if (in.hit(BTN_EAST)) {
        if (held >= 0) { held = -1; return; }
        if (held_recipe >= 0) { held_recipe = -1; return; }
        if (pick != Pick::None) { pick = Pick::None; return; }
        if (why_open) { why_open = false; return; }
        hide();
        return;
    }
    if (!vendor && !bench && (in.hit(BTN_L1) || in.hit(BTN_R1))) {
        int n = int(MenuTab::Count);
        tab = MenuTab((int(tab) + (in.hit(BTN_R1) ? 1 : n - 1)) % n);
        held = -1;
        pick = Pick::None;
        why_open = false;
        w.emit(Ev::Craft, w.actors[0].pos, 0);
        return;
    }
    // direction with auto-repeat: D-pad or the left stick
    int dir = -1;
    if (in.held(BTN_UP) || in.lstick.y > 0.6f) dir = D_UP;
    else if (in.held(BTN_DOWN) || in.lstick.y < -0.6f) dir = D_DOWN;
    else if (in.held(BTN_LEFT) || in.lstick.x < -0.6f) dir = D_LEFT;
    else if (in.held(BTN_RIGHT) || in.lstick.x > 0.6f) dir = D_RIGHT;
    int step = -1;
    if (dir < 0) last_dir_ = -1;
    else if (dir != last_dir_) { last_dir_ = dir; repeat_t_ = 0.3f; step = dir; }
    else if ((repeat_t_ -= dt) <= 0) { repeat_t_ = 0.09f; step = dir; }
    if (tab == MenuTab::Talismans && !vendor) { tal_update(w, in, step); return; }
    if (tab == MenuTab::Character && !vendor) { char_update(w, in, step); return; }
    if (tab == MenuTab::Ascendancy && !vendor) { asc_update(w, in, step); return; }
    if (tab == MenuTab::Journal && !vendor) { journal_update(w, in, step); return; }
    if (step >= 0) move(w, step);
    if (in.hit(BTN_SOUTH)) act_south(w);
    else if (in.hit(BTN_NORTH)) act_north(w);
}

void Menu::move(World& w, int dir) {
    if (tab == MenuTab::Settings) {   // up and down the rows, left and right through a row's choices, kept at once
        if (dir == D_UP) settings_cursor = (settings_cursor + SET_COUNT - 1) % SET_COUNT;
        if (dir == D_DOWN) settings_cursor = (settings_cursor + 1) % SET_COUNT;
        if (dir == D_LEFT || dir == D_RIGHT) {
            // in Arabic the screen is mirrored: right on the stick is back through the choices
            const bool fwd = (dir == D_RIGHT) != ui().mirrored();
            set_setting(settings_cursor, setting_value(settings_cursor) + (fwd ? 1 : -1));
            save_settings();
            w.emit(Ev::Craft, w.actors[0].pos, 0);
        }
        return;
    }
    if (tab == MenuTab::Filter) {
        if (dir == D_UP) filter_cursor = std::max(0, filter_cursor - 1);
        if (dir == D_DOWN) filter_cursor = std::min(int(FILTER_COUNT) - 1, filter_cursor + 1);
        return;
    }
    if (tab != MenuTab::Inventory) return;
    const Inventory& inv = w.hero.inv;
    auto hop = [&](const Inventory& g, int& x, int& y, int dx, int dy) -> bool {
        // step once, then keep stepping while still inside the same item: whole items are one stop
        int start = g.at(x, y);
        int nx = x + dx, ny = y + dy;
        while (start >= 0 && nx >= 0 && ny >= 0 && nx < Inventory::W && ny < Inventory::H && g.at(nx, ny) == start) { nx += dx; ny += dy; }
        if (nx < 0 || ny < 0 || nx >= Inventory::W || ny >= Inventory::H) return false;
        int it = g.at(nx, ny);
        if (it >= 0) { nx = g.items[size_t(it)].x; ny = g.items[size_t(it)].y; }  // an item is one stop
        x = nx;
        y = ny;
        return true;
    };
    int dx = dir == D_LEFT ? -1 : dir == D_RIGHT ? 1 : 0, dy = dir == D_UP ? -1 : dir == D_DOWN ? 1 : 0;
    switch (region) {
        case Region::Grid:
            if (hop(inv, cx, cy, dx, dy)) break;
            if (dir == D_UP) {
                // the equipment slot nearest above this column
                float x = GX + (cx + 0.5f) * C, best = 1e9f;
                for (int e = 0; e < EQ_COUNT; e++) {
                    float d = std::fabs(slot_center(e).x - x) + (EY + 7 * C - slot_center(e).y) * 0.4f;
                    if (d < best) { best = d; eq = e; }
                }
                region = Region::Equip;
            } else if (dir == D_DOWN) {
                region = Region::Purse;
                purse = std::min(int(CUR_COUNT) - 1, purse_scroll + std::min(cx, kPurseCells - 1));
            } else if (dir == D_LEFT && vendor) {
                region = Region::Stock;
                cx = Inventory::W - 1;
            } else if (dir == D_LEFT && bench) {
                region = Region::Bench;
            }
            break;
        case Region::Bench:
            bench_move(w, dir);
            break;
        case Region::Stock:
            if (hop(stock, cx, cy, dx, dy)) break;
            if (dir == D_RIGHT) { region = Region::Grid; cx = 0; }
            break;
        case Region::Purse:
            if (dir == D_LEFT) purse = std::max(0, purse - 1);
            else if (dir == D_RIGHT) purse = std::min(int(CUR_COUNT) - 1, purse + 1);
            else if (dir == D_UP) { region = Region::Grid; cx = std::min(Inventory::W - 1, purse - purse_scroll); cy = Inventory::H - 1; int it = inv.at(cx, cy); if (it >= 0) { cx = inv.items[size_t(it)].x; cy = inv.items[size_t(it)].y; } }
            break;
        case Region::Equip: {
            vec2 from = slot_center(eq), want{float(dx), float(dy)};
            int best = -1;
            float bs = 1e9f;
            for (int e = 0; e < EQ_COUNT; e++) {
                if (e == eq) continue;
                vec2 d = slot_center(e) - from;
                float along = dot(d, want);
                if (along <= 8) continue;
                float score = along + std::fabs(dot(d, vec2{want.y, -want.x})) * 2.f;
                if (score < bs) { bs = score; best = e; }
            }
            if (best >= 0) eq = best;
            else if (dir == D_DOWN) {
                region = Region::Grid;
                cy = 0;
                cx = std::clamp(int((slot_center(eq).x - GX) / C), 0, Inventory::W - 1);
                int it = inv.at(cx, cy);
                if (it >= 0) cx = inv.items[size_t(it)].x;
            }
            break;
        }
    }
    if (purse < purse_scroll) purse_scroll = purse;
    if (purse >= purse_scroll + kPurseCells) purse_scroll = purse - kPurseCells + 1;
    w.emit(Ev::Craft, w.actors[0].pos, 0);  // a soft tick
}

void Menu::act_south(World& w) {
    Hero& H = w.hero;
    if (tab == MenuTab::Settings) { move(w, ui().mirrored() ? D_LEFT : D_RIGHT); return; }
    if (tab == MenuTab::Filter) {
        H.filter = uint8_t(filter_cursor);
        say(std::string("Loot filter: ") + filter_name(H.filter));
        w.emit(Ev::Pickup, w.actors[0].pos);
        return;
    }
    if (tab != MenuTab::Inventory) return;
    if (bench && bench_south(w)) return;
    std::string why;
    switch (region) {
        case Region::Grid: {
            int i = hovered_inv(w);
            if (i < 0) return;
            if (held >= 0) {
                if (!w.craft(held, H.inv.items[size_t(i)].item, &why)) say(why);
                if (held >= 0 && H.currency[held] <= 0) held = -1;
                return;
            }
            if (vendor && dealer) { say("Amm Ramadan sells, he does not buy"); return; }
            if (vendor) {
                int price = sell_price(H.inv.items[size_t(i)].item);
                H.inv.take(i);
                H.gold += price;
                say("Sold for " + std::to_string(price) + " dinars");
                w.emit(Ev::Sell, w.actors[0].pos);
                return;
            }
            if (!w.equip_from_inventory(i)) say("No room to swap that");
            return;
        }
        case Region::Equip:
            if (held >= 0) {
                if (H.equip[eq].empty()) return;
                if (!w.craft(held, H.equip[eq], &why)) say(why);
                if (held >= 0 && H.currency[held] <= 0) held = -1;
                return;
            }
            if (eq == EQ_WEAPON) { say("You need something to swing"); return; }
            if (!H.equip[eq].empty() && !w.unequip(eq)) say("Your inventory is full");
            return;
        case Region::Purse:
            if (vendor && dealer) { say("Amm Ramadan sells, he does not buy"); return; }
            if (vendor) {
                const CurrencyDef& d = currency_def(purse);
                if (d.price <= 0) { say("Amm Sayed has none of those"); return; }
                if (H.gold < d.price) { say("Not enough dinars"); return; }
                H.gold -= d.price;
                H.currency[purse]++;
                say(std::string("Bought a ") + d.name);
                w.emit(Ev::Sell, w.actors[0].pos);
                return;
            }
            if (H.currency[purse] <= 0) { say("You have none"); return; }
            if (is_omen(purse)) {   // an Omen is read, not used on an item
                if (H.omens & omen_bit(purse)) { say("That Omen is already in your cup"); return; }
                H.omens |= omen_bit(purse);
                H.currency[purse]--;
                say(std::string("You read the cup: ") + (currency_def(purse).name + 7));
                w.emit(Ev::Craft, w.actors[0].pos);
                return;
            }
            held = purse;
            say(std::string(currency_def(purse).name) + ": choose an item");
            return;
        case Region::Bench: return;   // bench_south handled it
        case Region::Stock: {
            int i = hovered_stock();
            if (i < 0) return;
            const Item& it = stock.items[size_t(i)].item;
            if (dealer) {   // the antiquities dealer takes relics
                int price = relic_price(it);
                if (H.currency[CUR_RELIC] < price) { say("Not enough relics"); return; }
                if (!H.inv.add(it)) { say("Your inventory is full"); return; }
                H.currency[CUR_RELIC] -= price;
                stock.take(i);
                say("Bartered for " + std::to_string(price) + " relics");
                w.emit(Ev::Sell, w.actors[0].pos);
                return;
            }
            int price = buy_price(it);
            if (H.gold < price) { say("Not enough dinars"); return; }
            if (!H.inv.add(it)) { say("Your inventory is full"); return; }
            H.gold -= price;
            stock.take(i);
            say("Bought for " + std::to_string(price) + " dinars");
            w.emit(Ev::Sell, w.actors[0].pos);
            return;
        }
    }
}

void Menu::act_north(World& w) {
    if (tab == MenuTab::Inventory && vendor && !dealer) {   // Amm Sayed upgrades the life flask
        Hero& H = w.hero;
        const int t = H.flask_tier;
        if (t + 1 >= kFlaskTiers) { say("Your flask is the best there is"); return; }
        if (H.level < flask_upgrade_level(t)) { say("Come back at level " + std::to_string(flask_upgrade_level(t))); return; }
        if (H.gold < flask_upgrade_price(t)) { say("Not enough dinars"); return; }
        H.gold -= flask_upgrade_price(t);
        H.flask_tier = uint8_t(t + 1);
        w.recompute_hero();
        H.flask = H.flask_max;
        say(std::string("Your flask is now a ") + flask_name(H.flask_tier));
        w.emit(Ev::Craft, w.actors[0].pos, 1.f);
        return;
    }
    if (tab != MenuTab::Inventory || vendor || region != Region::Grid || held >= 0) return;
    int i = hovered_inv(w);
    if (i < 0) return;
    w.drop_from_inventory(i);
    say("Dropped");
}

// ---------------------------------------------------------------- drawing
static void outline(float x, float y, float w, float h, Rgba c, float t) {
    Ui& u = ui();
    u.rect(x, y, w, t, c);
    u.rect(x, y + h - t, w, t, c);
    u.rect(x, y + t, t, h - 2 * t, c);
    u.rect(x + w - t, y + t, t, h - 2 * t, c);
}

static void legend(float x, float y, std::initializer_list<std::pair<int, const char*>> items) {
    Ui& u = ui();
    for (auto& [b, label] : items) {
        draw_button_glyph(x + 20, y + 18, 38, b);
        x += 48;
        x += u.text(x, y, label, 26, pal::soft) + 34;
    }
}

static void grid_cells(float gx, float gy, const Inventory& inv, bool cursor_on, int cx, int cy, bool dim_all) {
    Ui& u = ui();
    u.frame(gx - 6, gy - 6, Inventory::W * C + 12, Inventory::H * C + 12, pal::night.alpha(0.7f), pal::line, 8, 2);
    for (int y = 0; y < Inventory::H; y++)
        for (int x = 0; x < Inventory::W; x++) u.frame(gx + x * C + 2, gy + y * C + 2, C - 4, C - 4, pal::panel2.alpha(0.8f), pal::line.alpha(0.5f), 5, 1);
    int hi = cursor_on ? inv.at(cx, cy) : -1;
    for (size_t i = 0; i < inv.items.size(); i++) {
        const InvItem& e = inv.items[i];
        int w, h;
        grid_size(e.item, w, h);
        Rgba rc = Rgba::hex(rarity_color(e.item.rarity));
        float x = gx + e.x * C + 2, y = gy + e.y * C + 2, ww = w * C - 4, hh = h * C - 4;
        u.frame(x, y, ww, hh, rc.mix(pal::panel, 0.82f).alpha(0.95f), rc.alpha(int(i) == hi ? 1.f : 0.45f), 6, int(i) == hi ? 3.f : 1.5f);
        draw_item_icon(x, y, ww, hh, e.item, dim_all ? 0.5f : 1.f);
    }
    if (cursor_on) {
        float x = gx + cx * C, y = gy + cy * C, ww = C, hh = C;
        if (hi >= 0) {
            int w, h;
            grid_size(inv.items[size_t(hi)].item, w, h);
            x = gx + inv.items[size_t(hi)].x * C;
            y = gy + inv.items[size_t(hi)].y * C;
            ww = w * C;
            hh = h * C;
        }
        outline(x - 3, y - 3, ww + 6, hh + 6, pal::amber, 4);
    }
}

void Menu::render(const World& w) const {
    Ui& u = ui();
    const Hero& H = w.hero;
    if (!open) {
        if (toast_t > 0) {
            float a = std::min(1.f, toast_t / 0.3f);
            float tw = u.text_width(toast, 30) + 60;
            u.frame(960 - tw / 2, 180, tw, 56, pal::panel.alpha(0.92f * a), pal::brass.alpha(a), 10, 2);
            u.text(960, 188, toast, 30, pal::bone.alpha(a), Align::Center, 0.6f);
        }
        return;
    }
    u.rect(0, 0, 1920, 1080, pal::night.alpha(0.45f));
    // ---- the right panel with its tabs
    u.frame(PX, PY, PW, PH, pal::panel.alpha(0.96f), pal::line, 16, 2);
    if (vendor) {
        u.text(PX + PW / 2, PY + 22, "Your Belongings", 38, pal::bone, Align::Center, 1.2f, true);
    } else {
        static const char* names[] = {"Items", "Talismans", "Character", "Ascendancy", "Journal", "Filter", "Settings"};
        if (bench) {
            u.text(PX + PW / 2, PY + 22, "Your Belongings", 38, pal::bone, Align::Center, 1.2f, true);
        } else {
            // the tabs shrink to fit between the shoulder glyphs
            float fs = 28, avail = PW - 190, total = 0;
            for (int t = 0; t < int(MenuTab::Count); t++) total += u.text_width(names[t], fs) + 22 + 8;
            if (total > avail) fs *= avail / total;
            float tx = PX + 95;
            draw_button_glyph(PX + 48, PY + 44, 40, BTN_L1);
            for (int t = 0; t < int(MenuTab::Count); t++) {
                bool on = int(tab) == t;
                float tw = u.text_width(names[t], fs) + 22;
                if (on) u.frame(tx, PY + 20, tw, 50, pal::dusk, pal::amber, 10, 2);
                u.text(tx + tw / 2, PY + 45 - fs * 0.6f, names[t], fs, on ? pal::amber : pal::soft, Align::Center, on ? 1.f : 0.3f);
                tx += tw + 8;
            }
            draw_button_glyph(tx + 30, PY + 44, 40, BTN_R1);
        }
    }
    const Item* tip = nullptr;
    const Item* compare = nullptr;
    std::string footer;
    float tip_y = 200;
    if (tab == MenuTab::Inventory) {
        // equipment
        {
            for (int e = 0; e < EQ_COUNT; e++) {
                const SlotRect& s = kSlots[e];
                float x = EX + s.x * C, y = EY + s.y * C, ww = s.w * C, hh = s.h * C;
                const Item& it = H.equip[e];
                bool cur = region == Region::Equip && eq == e;
                Rgba rc = it.empty() ? pal::line : Rgba::hex(rarity_color(it.rarity));
                u.frame(x, y, ww, hh, it.empty() ? pal::night.alpha(0.6f) : rc.mix(pal::panel, 0.82f), cur ? pal::amber : rc.alpha(0.6f), 8, cur ? 3.f : 1.5f);
                if (it.empty()) u.text(x + ww / 2, y + hh / 2 - 12, equip_slot_name(e), 18, pal::dim, Align::Center);
                else draw_item_icon(x, y, ww, hh, it);
                if (cur && !it.empty()) { tip = &it; tip_y = y; }
            }
            // a small stat column
            float sx = EX + 9.9f * C, sy = EY + 4;
            char b[64];
            auto stat = [&](const char* k, const std::string& v, Rgba c) {
                u.text(sx, sy, k, 22, pal::dim);
                u.text(sx, sy + 24, v, 30, c, Align::Left, 0.8f);
                sy += 70;
            };
            stat("LEVEL", std::to_string(H.level), pal::amber);
            HeroSummary sum = summarize(H);
            std::string sk = sum.skill.empty() ? std::string("DAMAGE") : sum.skill;
            for (auto& ch : sk) ch = char(std::toupper(static_cast<unsigned char>(ch)));
            snprintf(b, sizeof b, "%.1f", sum.dps);
            stat(sk.c_str(), std::string(b) + " DPS", pal::bone);
            snprintf(b, sizeof b, "%d", int(w.actors[0].life_max));
            stat("LIFE", b, Rgba::hex(0xE06050));
            snprintf(b, sizeof b, "%d", int(w.actors[0].armour));
            stat("ARMOUR", b, pal::sand);
            u.line(EX, GY - 22, EX + 12 * C, GY - 22, 2, pal::line);
        }
        grid_cells(GX, GY, H.inv, region == Region::Grid, cx, cy, false);
        if (int i = hovered_inv(w); i >= 0) {
            tip = &H.inv.items[size_t(i)].item;
            tip_y = GY + H.inv.items[size_t(i)].y * C;
            int slot = equip_slot_for(*tip, H.equip);
            if (slot >= 0 && !H.equip[slot].empty()) compare = &H.equip[slot];
            footer = vendor ? "Sell for " + std::to_string(sell_price(*tip)) + " dinars" : "";
        }
        // purse
        for (int k = 0; k < kPurseCells && purse_scroll + k < CUR_COUNT; k++) {
            int c = purse_scroll + k;
            float x = GX + k * C, y = PUY;
            bool cur = region == Region::Purse && purse == c;
            u.frame(x + 2, y + 2, C - 4, C - 4, pal::panel2, cur ? pal::amber : pal::line, 6, cur ? 3.f : 1.f);
            draw_currency_icon(x + C / 2, y + C / 2, C * 0.9f, c, H.currency[c] > 0 ? 1.f : 0.35f);
            u.text(x + C - 8, y + C - 30, std::to_string(H.currency[c]), 22, pal::bone, Align::Right, 1.f, true);
            if (held == c) u.ring(x + C / 2, y + C / 2, C * 0.46f, C * 0.4f, pal::amber);
        }
        if (purse_scroll > 0) u.text(GX - 22, PUY + 14, "<", 30, pal::amber);
        if (purse_scroll + kPurseCells < CUR_COUNT) u.text(GX + kPurseCells * C + 4, PUY + 14, ">", 30, pal::amber);
        for (int o = kFirstOmen; o <= kLastOmen; o++)   // the Omens in your cup
            if (H.omens & omen_bit(o)) u.ring(GX + (o - kFirstOmen) * 18 + 8, PUY - 10, 7, 4, pal::amber);
        char g[64];
        snprintf(g, sizeof g, "%d", H.gold);
        float gx = GX + kPurseCells * C + 30;
        u.disc(gx + 14, PUY + C / 2, 14, pal::brass);
        u.disc(gx + 10, PUY + C / 2 - 4, 4, Rgba::hex(0xFFF0B0));
        u.text(gx + 34, PUY + 16, g, std::min(32.f, 32.f * 110 / std::max(1.f, u.text_width(g, 32))), pal::rare, Align::Left, 1.f);
        if (region == Region::Purse) {
            const CurrencyDef& d = currency_def(purse);
            float x = PX - 620, y = PUY - 150;
            u.frame(x, y, 600, 190, pal::panel.alpha(0.97f), Rgba::hex(d.color).alpha(0.8f), 12, 2);
            auto fit = [&](const char* t, float fs) { return std::min(fs, fs * 560 / std::max(1.f, u.text_width(t, fs))); };
            u.text(x + 300, y + 16, d.name, fit(d.name, 34), Rgba::hex(d.color), Align::Center, 1.2f);
            u.text(x + 300, y + 66, d.does, fit(d.does, 26), pal::bone, Align::Center);
            u.text(x + 300, y + 110, vendor ? "Buy for " + std::to_string(d.price) + " dinars" : "You have " + std::to_string(H.currency[purse]),
                   26, vendor ? pal::rare : pal::soft, Align::Center);
        }
        // the vendor's wares
        if (vendor) {
            u.frame(VX, VY, VW, 506, pal::panel.alpha(0.96f), pal::line, 16, 2);
            u.text(VX + VW / 2, VY + 22, dealer ? "Amm Ramadan's Antiquities" : "Amm Sayed's Wares", 38, pal::amber, Align::Center, 1.2f, true);
            u.text(VX + VW / 2, VY + 70, dealer ? "What the sand gave back. He takes relics, not money" : "Tools of the trade, and a glass of tea on the house",
                   22, pal::dim, Align::Center);
            grid_cells(SX, SY, stock, region == Region::Stock, cx, cy, false);
            if (!dealer) {   // the flask, and what its next tier costs
                const int t = H.flask_tier;
                char fb[200];
                snprintf(fb, sizeof fb, "%s: heals %d%%, %d charges", flask_name(t), int(flask_heal(t) * 100 + 0.5f), flask_charges(t));
                u.text(VX + VW / 2, VY + 440, fb, 24, pal::bone, Align::Center, 0.6f);
                if (t + 1 < kFlaskTiers) {
                    snprintf(fb, sizeof fb, "Upgrade to a %s (%d%%, %d charges): %d dinars, level %d", flask_name(t + 1),
                             int(flask_heal(t + 1) * 100 + 0.5f), flask_charges(t + 1), flask_upgrade_price(t), flask_upgrade_level(t));
                    const bool can = H.level >= flask_upgrade_level(t) && H.gold >= flask_upgrade_price(t);
                    u.text(VX + VW / 2, VY + 468, fb, std::min(22.f, 22.f * (VW - 40) / std::max(1.f, u.text_width(fb, 22))),
                           can ? pal::rare : pal::dim, Align::Center);
                }
            }
            if (int i = hovered_stock(); i >= 0) {
                tip = &stock.items[size_t(i)].item;
                int slot = equip_slot_for(*tip, H.equip);
                if (slot >= 0 && !H.equip[slot].empty()) compare = &H.equip[slot];
                footer = dealer ? "Barter for " + std::to_string(relic_price(*tip)) + " relics (you have " +
                                      std::to_string(H.currency[CUR_RELIC]) + ")"
                                : "Buy for " + std::to_string(buy_price(*tip)) + " dinars";
            }
            tip_y = 590;
        }
        if (bench) bench_render(w, tip, tip_y, footer);
        // tooltip, and the equipped piece it would replace
        if (tip) {
            float tw = vendor ? 415 : 560;
            float x = vendor ? VX : PX - tw - 24;
            float h1 = draw_item_card(0, 0, tw, *tip, w, compare, footer, false);
            float y = std::clamp(tip_y, 20.f, 1060.f - h1);
            if (vendor) y = 590;
            draw_item_card(x, y, tw, *tip, w, compare, footer, true);
            if (compare && compare != tip) {
                float h2 = draw_item_card(0, 0, tw, *compare, w, nullptr, "", false);
                float x2 = vendor ? x + tw + 20 : x;
                float y2 = vendor ? y : y + h1 + 16;
                if (!vendor && y2 + h2 > 1060) y2 = std::max(20.f, y - h2 - 16 - 30);
                u.text(x2 + 12, y2 - 30, "EQUIPPED", 22, pal::dim, Align::Left, 1);
                draw_item_card(x2, y2, tw, *compare, w, nullptr, "", true);
            }
        }
        // legend
        if (held >= 0 || held_recipe >= 0) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, held_recipe >= 0 ? "Craft on item" : "Use on item"}, {BTN_EAST, "Put back"}});
        else if (bench && region == Region::Bench) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Choose recipe"}, {BTN_EAST, "Leave"}});
        else if (vendor && !dealer)
            legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, region == Region::Stock || region == Region::Purse ? "Buy" : "Sell"}, {BTN_NORTH, "Upgrade flask"},
                                           {BTN_EAST, "Leave"}});
        else if (vendor) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, region == Region::Stock || region == Region::Purse ? "Buy" : "Sell"}, {BTN_EAST, "Leave"}});
        else if (region == Region::Grid) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Equip"}, {BTN_NORTH, "Drop"}, {BTN_EAST, "Close"}});
        else if (region == Region::Purse) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Pick up"}, {BTN_EAST, "Close"}});
        else legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, eq == EQ_WEAPON ? "-" : "Unequip"}, {BTN_EAST, "Close"}});
    } else if (tab == MenuTab::Talismans) {
        tal_render(w);
    } else if (tab == MenuTab::Character) {
        char_render(w);
    } else if (tab == MenuTab::Ascendancy) {
        asc_render(w);
    } else if (tab == MenuTab::Journal) {
        journal_render(w);
    } else if (tab == MenuTab::Filter) {
        float x = PX + 60, y = PY + 120;
        u.text(x, y, "Choose what the ground shows you.", 28, pal::soft);
        u.text(x, y + 38, "Dinars and currency always show, and are picked up as you walk.", 24, pal::dim);
        y += 110;
        for (int f = 0; f < FILTER_COUNT; f++) {
            bool cur = filter_cursor == f, act = H.filter == f;
            u.frame(x - 10, y, PW - 100, 110, cur ? pal::dusk : pal::panel2, cur ? pal::amber : pal::line, 12, cur ? 3.f : 1.f);
            u.text(x + 20, y + 16, filter_name(f), 36, act ? pal::amber : pal::bone, Align::Left, 1.f);
            u.text(x + 20, y + 62, filter_desc(f), 24, pal::soft);
            if (act) u.text(PX + PW - 80, y + 36, "ACTIVE", 24, pal::amber, Align::Right, 1.f);
            y += 126;
        }
        u.text(x, y + 10, "Quick switch in the field: D-pad Right", 24, pal::dim);
        legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Apply"}, {BTN_EAST, "Close"}});
    } else if (tab == MenuTab::Settings) {
        float x = PX + 60, y = PY + 130;
        u.text(x, y, "Saved for every character on this device", 26, pal::dim);
        y += 70;
        for (int r = 0; r < SET_COUNT; r++) {
            const bool cur = settings_cursor == r;
            u.frame(x - 10, y, PW - 100, 96, cur ? pal::dusk : pal::panel2, cur ? pal::amber : pal::line, 12, cur ? 3.f : 1.f);
            u.text(x + 20, y + 28, setting_label(r), 32, pal::bone, Align::Left, 0.8f);
            const std::string v = setting_choice_name(r, setting_value(r));
            const float vx = PX + PW - 110;
            u.text(vx, y + 28, v, 32, cur ? pal::amber : pal::soft, Align::Right, 0.8f);
            if (cur) {   // the arrows either side of the choice
                const bool m = ui().mirrored();   // the arrows point outward on either side, mirrored or not
                u.text(vx - u.text_width(v, 32) - 40, y + 26, m ? "\xE2\x86\x92" : "\xE2\x86\x90", 32, pal::amber, Align::Left);
                u.text(vx + 14, y + 26, m ? "\xE2\x86\x90" : "\xE2\x86\x92", 32, pal::amber, Align::Left);
            }
            y += 112;
        }
        // the loot colours, as they are now
        y += 10;
        const char* names2[] = {"Magic", "Rare", "Unique"};
        const Rgba cs[] = {pal::magic, pal::rare, pal::unique};
        for (int k = 0; k < 3; k++) {
            u.frame(x + k * 200.f, y, 180, 60, cs[k].mix(pal::panel, 0.8f), cs[k], 8, 2);
            u.text(x + k * 200.f + 90, y + 14, names2[k], 28, cs[k], Align::Center, 0.8f);
        }
        legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Change"}, {BTN_EAST, "Close"}});
    }
    if (toast_t > 0) {
        float a = std::min(1.f, toast_t / 0.3f);
        float tw = u.text_width(toast, 30) + 60;
        u.frame(PX + PW / 2 - tw / 2, PY + PH - 130, tw, 56, pal::panel2.alpha(a), pal::brass.alpha(a), 10, 2);
        u.text(PX + PW / 2, PY + PH - 122, toast, 30, pal::bone.alpha(a), Align::Center, 0.6f);
    }
}

}  // namespace q
