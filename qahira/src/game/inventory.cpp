#include "game/inventory.hpp"

namespace q {

const char* equip_slot_name(int e) {
    static const char* n[EQ_COUNT] = {"Weapon", "Helmet", "Body Armour", "Gloves", "Boots", "Belt", "Amulet", "Ring", "Ring"};
    return e >= 0 && e < EQ_COUNT ? n[e] : "";
}

bool slot_accepts(int e, const Item& it) {
    if (it.empty()) return false;
    Slot s = it.b().slot;
    switch (e) {
        case EQ_WEAPON: return s == Slot::Weapon;
        case EQ_HELMET: return s == Slot::Helmet;
        case EQ_BODY: return s == Slot::Body;
        case EQ_GLOVES: return s == Slot::Gloves;
        case EQ_BOOTS: return s == Slot::Boots;
        case EQ_BELT: return s == Slot::Belt;
        case EQ_AMULET: return s == Slot::Amulet;
        case EQ_RING1: case EQ_RING2: return s == Slot::Ring;
        default: return false;
    }
}

int equip_slot_for(const Item& it, const Item* equipped) {
    if (it.empty()) return -1;
    if (it.b().slot == Slot::Ring) return equipped && !equipped[EQ_RING1].empty() && equipped[EQ_RING2].empty() ? EQ_RING2 : EQ_RING1;
    for (int e = 0; e < EQ_COUNT; e++) if (slot_accepts(e, it)) return e;
    return -1;
}

// ---- currency
const CurrencyDef& currency_def(int c) {
    static const CurrencyDef d[CUR_COUNT] = {
        {"blue_bead", "Blue Bead", "Makes a normal item magic", 0x5FA8FF, 40, 6},
        {"pinch_of_salt", "Pinch of Salt", "Adds a modifier to a magic item with room for one", 0xE8E4DA, 26, 9},
        {"coffee_grounds", "Coffee Grounds", "Rerolls the modifiers of a magic item", 0x9A6A44, 20, 12},
        {"saffron_thread", "Saffron Thread", "Makes a normal item rare", 0xFF8A2A, 7, 45},
        {"gilded_piastre", "Gilded Piastre", "Makes a magic item rare, adding a modifier", 0xF5D76E, 7, 55},
    };
    return d[c >= 0 && c < CUR_COUNT ? c : 0];
}

int roll_currency(Rng& rng) {
    int total = 0;
    for (int c = 0; c < CUR_COUNT; c++) total += currency_def(c).weight;
    int r = rng.irange(0, total - 1);
    for (int c = 0; c < CUR_COUNT; c++) {
        r -= currency_def(c).weight;
        if (r < 0) return c;
    }
    return 0;
}

bool apply_currency(int c, Item& it, Rng& rng, std::string* why) {
    auto no = [&](const char* m) { if (why) *why = m; return false; };
    if (it.empty()) return no("Nothing to use it on");
    int pre = 0, suf = 0;
    for (auto& a : it.affixes) (affix_defs()[a.def].prefix ? pre : suf)++;
    switch (c) {
        case CUR_BEAD:
            if (it.rarity != Rarity::Normal) return no("Only works on a normal item");
            it.rarity = Rarity::Magic;
            roll_affix(it, rng);
            if (rng.chance(0.5f)) roll_affix(it, rng);
            return true;
        case CUR_SALT:
            if (it.rarity != Rarity::Magic) return no("Only works on a magic item");
            if (pre >= 1 && suf >= 1) return no("This item has no room for another modifier");
            if (!roll_affix(it, rng)) return no("No modifier can be added");
            return true;
        case CUR_GROUNDS:
            if (it.rarity != Rarity::Magic) return no("Only works on a magic item");
            it.affixes.clear();
            roll_affix(it, rng);
            if (rng.chance(0.5f)) roll_affix(it, rng);
            return true;
        case CUR_SAFFRON: {
            if (it.rarity != Rarity::Normal) return no("Only works on a normal item");
            it.rarity = Rarity::Rare;
            it.name = rare_name(rng);
            int want = rng.irange(4, 6);
            while (int(it.affixes.size()) < want && roll_affix(it, rng)) {}
            return true;
        }
        case CUR_PIASTRE:
            if (it.rarity != Rarity::Magic) return no("Only works on a magic item");
            it.rarity = Rarity::Rare;
            it.name = rare_name(rng);
            roll_affix(it, rng);
            return true;
        default: return no("Unknown currency");
    }
}

// ---- grid
int Inventory::at(int x, int y) const {
    for (size_t i = 0; i < items.size(); i++) {
        int w, h;
        grid_size(items[i].item, w, h);
        if (x >= items[i].x && x < items[i].x + w && y >= items[i].y && y < items[i].y + h) return int(i);
    }
    return -1;
}

bool Inventory::fits(int x, int y, int w, int h, int ignore) const {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    for (size_t i = 0; i < items.size(); i++) {
        if (int(i) == ignore) continue;
        int iw, ih;
        grid_size(items[i].item, iw, ih);
        if (x < items[i].x + iw && items[i].x < x + w && y < items[i].y + ih && items[i].y < y + h) return false;
    }
    return true;
}

bool Inventory::find_space(const Item& it, int& ox, int& oy) const {
    int w, h;
    grid_size(it, w, h);
    for (int x = 0; x + w <= W; x++)
        for (int y = 0; y + h <= H; y++)
            if (fits(x, y, w, h)) { ox = x; oy = y; return true; }
    return false;
}

bool Inventory::add(const Item& it) {
    int x, y;
    if (!find_space(it, x, y)) return false;
    items.push_back({it, x, y});
    return true;
}

bool Inventory::place(const Item& it, int x, int y) {
    int w, h;
    grid_size(it, w, h);
    if (!fits(x, y, w, h)) return false;
    items.push_back({it, x, y});
    return true;
}

Item Inventory::take(int i) {
    if (i < 0 || i >= int(items.size())) return Item{};
    Item it = items[size_t(i)].item;
    items.erase(items.begin() + i);
    return it;
}

// ---- loot filter
const char* filter_name(int f) {
    static const char* n[FILTER_COUNT] = {"Story", "Standard", "Strict", "Uber"};
    return f >= 0 && f < FILTER_COUNT ? n[f] : "";
}

const char* filter_desc(int f) {
    static const char* d[FILTER_COUNT] = {
        "Everything that drops",
        "Hides normal items",
        "Rare and unique items only",
        "Uniques and rares of item level 10+ only",
    };
    return f >= 0 && f < FILTER_COUNT ? d[f] : "";
}

bool filter_shows(int f, const Item& it) {
    switch (f) {
        case FILTER_STANDARD: return it.rarity != Rarity::Normal;
        case FILTER_STRICT: return it.rarity >= Rarity::Rare;
        case FILTER_UBER: return it.rarity == Rarity::Unique || (it.rarity == Rarity::Rare && it.ilvl >= 10);
        default: return true;
    }
}

}  // namespace q
