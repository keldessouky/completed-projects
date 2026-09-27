// The hero's belongings: a 12x5 grid of items, the equipped paper doll, currency and dinars, and the
// crafting currencies that act on items. Pure data and rules; the menu draws and drives it.
#pragma once
#include "game/items.hpp"
#include <string>
#include <vector>

namespace q {

enum EquipSlot : uint8_t { EQ_WEAPON, EQ_HELMET, EQ_BODY, EQ_GLOVES, EQ_BOOTS, EQ_BELT, EQ_AMULET, EQ_RING1, EQ_RING2, EQ_COUNT };
const char* equip_slot_name(int e);
bool slot_accepts(int e, const Item& it);
int equip_slot_for(const Item& it, const Item* equipped);   // prefers an empty ring slot

// Slice 2's five crafting currencies. The names are things from a Cairo street; what they do is plain
// PoE (the tooltip always says it).
enum Currency : uint8_t { CUR_BEAD, CUR_SALT, CUR_GROUNDS, CUR_SAFFRON, CUR_PIASTRE, CUR_COUNT };
struct CurrencyDef {
    const char* id;
    const char* name;
    const char* does;       // one line, PoE terms
    uint32_t color;
    int weight;             // drop weight
    int price;              // vendor price in dinars
};
const CurrencyDef& currency_def(int c);
int roll_currency(Rng& rng);
// Applies a currency to an item. Returns false (and a reason) when it cannot be used on it.
bool apply_currency(int c, Item& it, Rng& rng, std::string* why = nullptr);

struct InvItem {
    Item item;
    int x = 0, y = 0;
};

struct Inventory {
    static constexpr int W = 12, H = 5;
    std::vector<InvItem> items;

    int at(int x, int y) const;                          // item covering a cell, -1 if none
    bool fits(int x, int y, int w, int h, int ignore = -1) const;
    bool find_space(const Item& it, int& x, int& y) const;  // column-major first fit, like PoE
    bool add(const Item& it);
    bool place(const Item& it, int x, int y);
    Item take(int index);
};

// Loot filter presets, from showing everything to only what matters.
enum FilterPreset : uint8_t { FILTER_STORY, FILTER_STANDARD, FILTER_STRICT, FILTER_UBER, FILTER_COUNT };
const char* filter_name(int f);
const char* filter_desc(int f);
bool filter_shows(int f, const Item& it);

}  // namespace q
