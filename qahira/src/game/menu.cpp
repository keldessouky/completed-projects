#include "game/menu.hpp"
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
        case Slot::Weapon: {  // a maul: long haft, heavy head
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

void Menu::hide() {
    open = false;
    vendor = false;
    held = -1;
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
        if (pick != Pick::None) { pick = Pick::None; return; }
        if (why_open) { why_open = false; return; }
        hide();
        return;
    }
    if (!vendor && (in.hit(BTN_L1) || in.hit(BTN_R1))) {
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
    if (step >= 0) move(w, step);
    if (in.hit(BTN_SOUTH)) act_south(w);
    else if (in.hit(BTN_NORTH)) act_north(w);
}

void Menu::move(World& w, int dir) {
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
                purse = std::min(int(CUR_COUNT) - 1, cx);
            } else if (dir == D_LEFT && vendor) {
                region = Region::Stock;
                cx = Inventory::W - 1;
            }
            break;
        case Region::Stock:
            if (hop(stock, cx, cy, dx, dy)) break;
            if (dir == D_RIGHT) { region = Region::Grid; cx = 0; }
            break;
        case Region::Purse:
            if (dir == D_LEFT) purse = std::max(0, purse - 1);
            else if (dir == D_RIGHT) purse = std::min(int(CUR_COUNT) - 1, purse + 1);
            else if (dir == D_UP) { region = Region::Grid; cx = purse; cy = Inventory::H - 1; int it = inv.at(cx, cy); if (it >= 0) { cx = inv.items[size_t(it)].x; cy = inv.items[size_t(it)].y; } }
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
    w.emit(Ev::Craft, w.actors[0].pos, 0);  // a soft tick
}

void Menu::act_south(World& w) {
    Hero& H = w.hero;
    if (tab == MenuTab::Filter) {
        H.filter = uint8_t(filter_cursor);
        say(std::string("Loot filter: ") + filter_name(H.filter));
        w.emit(Ev::Pickup, w.actors[0].pos);
        return;
    }
    if (tab != MenuTab::Inventory) return;
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
            if (vendor) {
                const CurrencyDef& d = currency_def(purse);
                if (H.gold < d.price) { say("Not enough dinars"); return; }
                H.gold -= d.price;
                H.currency[purse]++;
                say(std::string("Bought a ") + d.name);
                w.emit(Ev::Sell, w.actors[0].pos);
                return;
            }
            if (H.currency[purse] <= 0) { say("You have none"); return; }
            held = purse;
            say(std::string(currency_def(purse).name) + ": choose an item");
            return;
        case Region::Stock: {
            int i = hovered_stock();
            if (i < 0) return;
            const Item& it = stock.items[size_t(i)].item;
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
        static const char* names[] = {"Inventory", "Talismans", "Character", "Loot Filter"};
        float tx = PX + 110;
        draw_button_glyph(PX + 50, PY + 44, 40, BTN_L1);
        for (int t = 0; t < int(MenuTab::Count); t++) {
            bool on = int(tab) == t;
            float tw = u.text_width(names[t], 28) + 28;
            if (on) u.frame(tx, PY + 20, tw, 50, pal::dusk, pal::amber, 10, 2);
            u.text(tx + tw / 2, PY + 28, names[t], 28, on ? pal::amber : pal::soft, Align::Center, on ? 1.f : 0.3f);
            tx += tw + 10;
        }
        draw_button_glyph(tx + 34, PY + 44, 40, BTN_R1);
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
            snprintf(b, sizeof b, "%.1f", w.hero_dps(H.weapon()));
            stat("CRUSHING BLOW", std::string(b) + " DPS", pal::bone);
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
        for (int c = 0; c < CUR_COUNT; c++) {
            float x = GX + c * C, y = PUY;
            bool cur = region == Region::Purse && purse == c;
            u.frame(x + 2, y + 2, C - 4, C - 4, pal::panel2, cur ? pal::amber : pal::line, 6, cur ? 3.f : 1.f);
            draw_currency_icon(x + C / 2, y + C / 2, C * 0.9f, c, H.currency[c] > 0 ? 1.f : 0.35f);
            u.text(x + C - 8, y + C - 30, std::to_string(H.currency[c]), 22, pal::bone, Align::Right, 1.f, true);
            if (held == c) u.ring(x + C / 2, y + C / 2, C * 0.46f, C * 0.4f, pal::amber);
        }
        char g[64];
        snprintf(g, sizeof g, "%d", H.gold);
        u.disc(GX + 5 * C + 50, PUY + C / 2, 16, pal::brass);
        u.disc(GX + 5 * C + 46, PUY + C / 2 - 4, 5, Rgba::hex(0xFFF0B0));
        u.text(GX + 5 * C + 78, PUY + 12, g, 36, pal::rare, Align::Left, 1.f);
        u.text(GX + 5 * C + 78 + u.text_width(g, 36) + 10, PUY + 20, "dinars", 26, pal::dim);
        if (region == Region::Purse) {
            const CurrencyDef& d = currency_def(purse);
            float x = PX - 620, y = PUY - 150;
            u.frame(x, y, 600, 190, pal::panel.alpha(0.97f), Rgba::hex(d.color).alpha(0.8f), 12, 2);
            u.text(x + 300, y + 16, d.name, 34, Rgba::hex(d.color), Align::Center, 1.2f);
            u.text(x + 300, y + 66, d.does, 26, pal::bone, Align::Center);
            u.text(x + 300, y + 110, vendor ? "Buy for " + std::to_string(d.price) + " dinars" : "You have " + std::to_string(H.currency[purse]),
                   26, vendor ? pal::rare : pal::soft, Align::Center);
        }
        // the vendor's wares
        if (vendor) {
            u.frame(VX, VY, VW, 446, pal::panel.alpha(0.96f), pal::line, 16, 2);
            u.text(VX + VW / 2, VY + 22, "Amm Sayed's Wares", 38, pal::amber, Align::Center, 1.2f, true);
            u.text(VX + VW / 2, VY + 70, "Tools of the trade, and a glass of tea on the house", 22, pal::dim, Align::Center);
            grid_cells(SX, SY, stock, region == Region::Stock, cx, cy, false);
            if (int i = hovered_stock(); i >= 0) {
                tip = &stock.items[size_t(i)].item;
                int slot = equip_slot_for(*tip, H.equip);
                if (slot >= 0 && !H.equip[slot].empty()) compare = &H.equip[slot];
                footer = "Buy for " + std::to_string(buy_price(*tip)) + " dinars";
            }
            tip_y = 540;
        }
        // tooltip, and the equipped piece it would replace
        if (tip) {
            float tw = vendor ? 415 : 560;
            float x = vendor ? VX : PX - tw - 24;
            float h1 = draw_item_card(0, 0, tw, *tip, w, compare, footer, false);
            float y = std::clamp(tip_y, 20.f, 1060.f - h1);
            if (vendor) y = 530;
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
        if (held >= 0) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Use on item"}, {BTN_EAST, "Put back"}});
        else if (vendor) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, region == Region::Stock || region == Region::Purse ? "Buy" : "Sell"}, {BTN_EAST, "Leave"}});
        else if (region == Region::Grid) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Equip"}, {BTN_NORTH, "Drop"}, {BTN_EAST, "Close"}});
        else if (region == Region::Purse) legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, "Pick up"}, {BTN_EAST, "Close"}});
        else legend(PX + 30, PY + PH - 58, {{BTN_SOUTH, eq == EQ_WEAPON ? "-" : "Unequip"}, {BTN_EAST, "Close"}});
    } else if (tab == MenuTab::Talismans) {
        tal_render(w);
    } else if (tab == MenuTab::Character) {
        char_render(w);
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
    }
    if (toast_t > 0) {
        float a = std::min(1.f, toast_t / 0.3f);
        float tw = u.text_width(toast, 30) + 60;
        u.frame(PX + PW / 2 - tw / 2, PY + PH - 130, tw, 56, pal::panel2.alpha(a), pal::brass.alpha(a), 10, 2);
        u.text(PX + PW / 2, PY + PH - 122, toast, 30, pal::bone.alpha(a), Align::Center, 0.6f);
    }
}

}  // namespace q
