#include "game/inventory.hpp"
#include <algorithm>
#include <cmath>

namespace q {

const char* equip_slot_name(int e) {
    static const char* n[EQ_COUNT] = {"Weapon", "Helmet", "Body Armour", "Gloves", "Boots", "Belt", "Amulet", "Ring", "Ring",
                                        "Weapon Swap"};
    return e >= 0 && e < EQ_COUNT ? n[e] : "";
}

bool slot_accepts(int e, const Item& it) {
    if (it.empty()) return false;
    Slot s = it.b().slot;
    switch (e) {
        case EQ_WEAPON: case EQ_WEAPON2: return s == Slot::Weapon;
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
    // a weapon of the kind on the back (and not the kind in hand) replaces the one on the back
    if (it.b().slot == Slot::Weapon && equipped && !equipped[EQ_WEAPON2].empty() && it.b().wkind == equipped[EQ_WEAPON2].b().wkind &&
        it.b().wkind != equipped[EQ_WEAPON].b().wkind)
        return EQ_WEAPON2;
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
        {"rosewater_vial", "Rosewater Vial", "Refunds a passive star after level 20 (with dinars)", 0xF7A8C8, 4, 70},
        {"brass_stylus", "Brass Stylus", "Carves another Wafq slot into a Talisman (up to 5)", 0xD9A441, 4, 90},
        {"khamsa", "Khamsa", "Adds a modifier to a rare item", 0x7FC8E0, 8, 40, 3},
        {"bakhoor_ash", "Bakhoor Ash", "Removes a modifier from a rare item, then adds one", 0x8A7A6A, 6, 50, 4},
        {"broken_tea_glass", "Broken Tea Glass", "Removes a random modifier from a magic or rare item", 0xC04A3A, 7, 35, 3},
        {"drop_of_attar", "Drop of Attar", "Rerolls the numbers of an item's modifiers", 0xF2C0E0, 3, 120, 5},
        {"ifrits_ember", "Ifrit's Ember", "Corrupts an item: unpredictable, and final", 0xFF5A1A, 3, 100, 6},
        {"baharat_embers", "Baharat of Embers", "Adds a Fire modifier to a magic or rare item", 0xE0602A, 3, 60, 4},
        {"cumin_frost", "Cumin of the Night Wind", "Adds a Cold modifier to a magic or rare item", 0x8AC8F2, 3, 60, 4},
        {"dukkah_storm", "Dukkah of the Storm", "Adds a Lightning modifier to a magic or rare item", 0xF2E060, 3, 60, 4},
        {"zaatar_oasis", "Za'atar of the Oasis", "Adds a Life modifier to a magic or rare item", 0x6AB04A, 3, 60, 4},
        {"cardamom_scribe", "Cardamom of the Scribe", "Adds a Caster modifier to a magic or rare item", 0x7AC8A0, 3, 60, 4},
        {"sumac_hammer", "Sumac of the Hammer", "Adds a Physical Attack modifier to a magic or rare item", 0xB03A4A, 3, 60, 4},
        {"omen_bird", "Omen: the Bird in the Cup", "Read it: your next Khamsa or Blend adds a suffix", 0x6A4A2A, 2, 90, 5},
        {"omen_fish", "Omen: the Fish in the Cup", "Read it: your next Khamsa or Blend adds a prefix", 0x6A4A2A, 2, 90, 5},
        {"omen_door", "Omen: the Closed Door", "Read it: your next Glass or Ash spares bench modifiers", 0x6A4A2A, 2, 90, 5},
        {"omen_crescent", "Omen: the Crescent", "Read it: your next Ember cannot unmake an item", 0x6A4A2A, 2, 110, 6},
        {"marid_splinter", "Marid Splinter", "Fifty fuse into a Rift Seal", 0x5FC8E8, 0, 0, 999},
        {"rift_seal", "Rift Seal", "Opens the Rift Lord's court, at the chart table", 0x2E8AB8, 0, 0, 999},
        {"relic", "Relic", "Dug up in the Excavations. Amm Ramadan barters for them", 0x3AA8A0, 0, 0, 999},
        {"kings_pearl", "King's Pearl", "Four open the Marid King's throne, at the chart table", 0xE6EEF4, 0, 0, 999},
    };
    return d[c >= 0 && c < CUR_COUNT ? c : 0];
}

int roll_currency(Rng& rng, int area_level) {
    int total = 0;
    for (int c = 0; c < CUR_COUNT; c++) if (currency_def(c).min_level <= area_level) total += currency_def(c).weight;
    int r = rng.irange(0, total - 1);
    for (int c = 0; c < CUR_COUNT; c++) {
        if (currency_def(c).min_level > area_level) continue;
        r -= currency_def(c).weight;
        if (r < 0) return c;
    }
    return 0;
}

const std::vector<int>& blend_family(int c) {
    static const std::vector<std::vector<int>> fam = [] {
        const std::vector<std::vector<const char*>> ids = {
            {"fire_add", "fire_res", "ele_dmg"},                                   // Embers
            {"spell_cold", "cold_res", "ele_dmg"},                                 // Night Wind
            {"light_res", "ele_dmg", "spell_crit"},                                // Storm
            {"life", "regen", "life_on_hit"},                                      // Oasis
            {"spell_dmg", "cast_speed", "int", "mana", "mana_regen", "es_add", "es_inc"},   // Scribe
            {"phys_inc", "phys_add", "speed", "crit", "str", "break"},             // Hammer
        };
        std::vector<std::vector<int>> out;
        for (auto& l : ids) {
            std::vector<int> v;
            for (const char* id : l) if (int a = find_affix(id); a >= 0) v.push_back(a);
            out.push_back(v);
        }
        return out;
    }();
    static const std::vector<int> none;
    return c >= kFirstBlend && c <= kLastBlend ? fam[size_t(c - kFirstBlend)] : none;
}

bool apply_currency(int c, Item& it, Rng& rng, std::string* why, uint8_t* omens) {
    auto no = [&](const char* m) { if (why) *why = m; return false; };
    if (it.empty()) return no("Nothing to use it on");
    if (it.corrupted && c != CUR_ROSEWATER && c != CUR_STYLUS) return no("A corrupted item cannot be changed");
    if (it.rarity == Rarity::Unique && c != CUR_ATTAR && c != CUR_EMBER) return no("A unique item cannot be changed this way");
    int pre = 0, suf = 0;
    it.count_affixes(pre, suf);
    uint8_t om = omens ? *omens : 0;
    auto spend = [&](int omen) { if (omens && (om & omen_bit(omen))) *omens &= uint8_t(~omen_bit(omen)); };
    // an Omen of the Bird or the Fish decides the side of the next added mod
    int side = (om & omen_bit(CUR_OMEN_BIRD)) ? 0 : (om & omen_bit(CUR_OMEN_FISH)) ? 1 : -1;
    auto spend_side = [&] { if (side == 0) spend(CUR_OMEN_BIRD); else if (side == 1) spend(CUR_OMEN_FISH); };
    // a random removable mod (bench mods are spared under the Closed Door)
    auto removable = [&]() -> int {
        std::vector<int> r;
        for (size_t i = 0; i < it.affixes.size(); i++) {
            const Affix& a = it.affixes[i];
            if (a.flags & AF_IMPLICIT) continue;
            if ((a.flags & AF_CRAFTED) && (om & omen_bit(CUR_OMEN_DOOR))) continue;
            r.push_back(int(i));
        }
        return r.empty() ? -1 : r[size_t(rng.irange(0, int(r.size()) - 1))];
    };
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
            it.name = rare_name(rng, &it.b());
            int want = rng.irange(4, 6);
            while (int(it.affixes.size()) < want && roll_affix(it, rng)) {}
            return true;
        }
        case CUR_PIASTRE:
            if (it.rarity != Rarity::Magic) return no("Only works on a magic item");
            it.rarity = Rarity::Rare;
            it.name = rare_name(rng, &it.b());
            roll_affix(it, rng);
            return true;
        case CUR_KHAMSA:
            if (it.rarity != Rarity::Rare) return no("Only works on a rare item");
            if (pre >= 3 && suf >= 3) return no("This item has no room for another modifier");
            if (side == 1 && pre >= 3) return no("The Fish wants a prefix, and there is no room for one");
            if (side == 0 && suf >= 3) return no("The Bird wants a suffix, and there is no room for one");
            if (!roll_affix(it, rng, side)) return no("No modifier can be added");
            spend_side();
            return true;
        case CUR_BAKHOOR: {
            if (it.rarity != Rarity::Rare) return no("Only works on a rare item");
            int i = removable();
            if (i < 0) return no("Nothing here can be removed");
            it.affixes.erase(it.affixes.begin() + i);
            roll_affix(it, rng);
            spend(CUR_OMEN_DOOR);
            return true;
        }
        case CUR_GLASS: {
            if (it.rarity != Rarity::Magic && it.rarity != Rarity::Rare) return no("Only works on a magic or rare item");
            int i = removable();
            if (i < 0) return no("Nothing here can be removed");
            it.affixes.erase(it.affixes.begin() + i);
            spend(CUR_OMEN_DOOR);
            return true;
        }
        case CUR_ATTAR:
            if (it.affixes.empty()) return no("This item has no numbers to reroll");
            reroll_values(it, rng);
            return true;
        case CUR_EMBER: {
            it.corrupted = true;
            bool safe = om & omen_bit(CUR_OMEN_CRESCENT);
            spend(CUR_OMEN_CRESCENT);
            float r = rng.uniform();
            if (r < 0.3f) return true;                                 // nothing, but it is sealed now
            if (r < 0.6f) {                                            // an ember implicit
                static const char* imp[] = {"g_all_res", "g_life_pct", "g_crit", "g_cdr", "g_area", "g_skill_level"};
                static const float lo[] = {6, 4, 15, 6, 6, 1}, hi[] = {10, 7, 25, 10, 10, 1};
                int k = rng.irange(0, 5);
                Affix a{uint16_t(find_affix(imp[k])), 0, std::round(rng.range(lo[k], hi[k])), 0, AF_IMPLICIT};
                it.affixes.push_back(a);
                return true;
            }
            if (r < 0.82f) {                                           // one mod burns brighter
                std::vector<int> ex;
                for (size_t i = 0; i < it.affixes.size(); i++) if (!(it.affixes[i].flags & AF_IMPLICIT)) ex.push_back(int(i));
                if (!ex.empty()) {
                    Affix& a = it.affixes[size_t(ex[size_t(rng.irange(0, int(ex.size()) - 1))])];
                    a.v1 = std::round(a.v1 * 1.3f);
                    a.v2 = std::round(a.v2 * 1.3f);
                }
                return true;
            }
            if (safe || it.rarity == Rarity::Unique || it.rarity == Rarity::Normal) return true;
            // the fire takes it: every mod rerolled, as a rare
            it.affixes.erase(std::remove_if(it.affixes.begin(), it.affixes.end(), [](const Affix& a) { return !(a.flags & AF_IMPLICIT); }),
                             it.affixes.end());
            it.rarity = Rarity::Rare;
            if (it.name.empty()) it.name = rare_name(rng, &it.b());
            int want = rng.irange(4, 6);
            while (int(it.affixes.size()) < want && roll_affix(it, rng)) {}
            return true;
        }
        case CUR_ROSEWATER: return no("Used in the Book of Fixed Stars, to refund a star");
        case CUR_STYLUS: return no("Used on a Talisman, in the Talismans tab");
        default:
            if (c >= kFirstBlend && c <= kLastBlend) {
                if (it.rarity != Rarity::Magic && it.rarity != Rarity::Rare) return no("Only works on a magic or rare item");
                // a full magic item is upgraded to rare to make room
                Rarity was = it.rarity;
                if (it.rarity == Rarity::Magic && pre >= 1 && suf >= 1) { it.rarity = Rarity::Rare; it.name = rare_name(rng, &it.b()); }
                if (!roll_affix(it, rng, side, &blend_family(c))) {
                    if (was == Rarity::Magic && it.rarity == Rarity::Rare) { it.rarity = was; it.name.clear(); }
                    return no("No modifier of that family can be added here");
                }
                spend_side();
                return true;
            }
            if (is_omen(c)) return no("Read an Omen from your purse; it bends your next craft");
            return no("Unknown currency");
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
    if (it.b().slot == Slot::Chart) return true;   // charts always show, as currency does
    switch (f) {
        case FILTER_STANDARD: return it.rarity != Rarity::Normal;
        case FILTER_STRICT: return it.rarity >= Rarity::Rare;
        case FILTER_UBER: return it.rarity == Rarity::Unique || (it.rarity == Rarity::Rare && it.ilvl >= 10);
        default: return true;
    }
}

}  // namespace q
