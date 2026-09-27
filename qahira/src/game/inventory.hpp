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

// The crafting currencies. The names are things from a Cairo street; what they do is plain
// PoE (the tooltip always says it).
enum Currency : uint8_t { CUR_BEAD, CUR_SALT, CUR_GROUNDS, CUR_SAFFRON, CUR_PIASTRE,
                          CUR_ROSEWATER, CUR_STYLUS,   // Slice 3: respec, Wafq slots
                          // Slice 4: rares, and the Ifrit's Ember
                          CUR_KHAMSA, CUR_BAKHOOR, CUR_GLASS, CUR_ATTAR, CUR_EMBER,
                          // Spice Blends: add a mod of one family to a magic or rare item
                          CUR_BLEND_EMBERS, CUR_BLEND_FROST, CUR_BLEND_STORM, CUR_BLEND_OASIS, CUR_BLEND_SCRIBE, CUR_BLEND_HAMMER,
                          // Coffee-Cup Omens: read one to bend your next craft
                          CUR_OMEN_BIRD, CUR_OMEN_FISH, CUR_OMEN_DOOR, CUR_OMEN_CRESCENT,
                          // Slice 6: the Marid Rifts (they never drop at random)
                          CUR_SPLINTER, CUR_RIFT_SEAL,
                          CUR_COUNT };
constexpr int kSplintersPerSeal = 50;
constexpr int kFirstBlend = CUR_BLEND_EMBERS, kLastBlend = CUR_BLEND_HAMMER;
constexpr int kFirstOmen = CUR_OMEN_BIRD, kLastOmen = CUR_OMEN_CRESCENT;
inline bool is_omen(int c) { return c >= kFirstOmen && c <= kLastOmen; }
inline uint8_t omen_bit(int c) { return uint8_t(1u << (c - kFirstOmen)); }
constexpr int kCurrencyV2 = 5;   // how many the Slice 2 character file stored
struct CurrencyDef {
    const char* id;
    const char* name;
    const char* does;       // one line, PoE terms
    uint32_t color;
    int weight;             // drop weight
    int price;              // vendor price in dinars
    int min_level = 1;      // the area level it starts to drop at (staged unlocks, GDD §13)
};
const CurrencyDef& currency_def(int c);
int roll_currency(Rng& rng, int area_level = 100);
// Applies a currency to an item. Returns false (and a reason) when it cannot be used on it. `omens` is the hero's
// read Omens (bits by omen_bit); the one a craft uses is cleared.
bool apply_currency(int c, Item& it, Rng& rng, std::string* why = nullptr, uint8_t* omens = nullptr);
const std::vector<int>& blend_family(int c);   // the affixes a Spice Blend can add

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
