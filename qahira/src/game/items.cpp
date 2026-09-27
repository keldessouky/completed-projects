#include "game/items.hpp"
#include <cstdio>

namespace q {

static constexpr uint32_t SB(Slot s) { return 1u << uint32_t(s); }
static constexpr uint32_t ARMOUR_SLOTS = SB(Slot::Helmet) | SB(Slot::Body) | SB(Slot::Gloves) | SB(Slot::Boots);
static constexpr uint32_t JEWELLERY = SB(Slot::Amulet) | SB(Slot::Ring) | SB(Slot::Belt);
static constexpr uint32_t ALL = 0xFF;

const std::vector<ItemBase>& item_bases() {
    static const std::vector<ItemBase> b = {
        // two-handed maces
        {"worn_maul", "Worn Maul", Slot::Weapon, 1, 12, 23, 1.0f, 5, 0, 0, nullptr},
        {"brass_maul", "Brass-Bound Maul", Slot::Weapon, 3, 17, 31, 0.95f, 5, 0, 0, nullptr},
        {"mokattam_sledge", "Mokattam Sledge", Slot::Weapon, 10, 26, 46, 0.95f, 5.5f, 0, 0, nullptr},
        {"citadel_maul", "Citadel Maul", Slot::Weapon, 18, 38, 66, 1.0f, 5, 0, 0, nullptr},
        // armour
        {"knit_cap", "Knit Cap", Slot::Helmet, 1, 0, 0, 0, 0, 12, 0, nullptr},
        {"riveted_cap", "Riveted Cap", Slot::Helmet, 8, 0, 0, 0, 0, 34, 0, nullptr},
        {"work_coat", "Work Coat", Slot::Body, 1, 0, 0, 0, 0, 28, 0, nullptr},
        {"riveted_breastplate", "Riveted Breastplate", Slot::Body, 9, 0, 0, 0, 0, 80, 0, nullptr},
        {"wrapped_gloves", "Wrapped Gloves", Slot::Gloves, 1, 0, 0, 0, 0, 8, 0, nullptr},
        {"laced_boots", "Laced Boots", Slot::Boots, 1, 0, 0, 0, 0, 9, 0, nullptr},
        {"tooled_belt", "Tooled Belt", Slot::Belt, 1, 0, 0, 0, 0, 0, 0, "+20 to maximum Life"},
        {"blue_bead_amulet", "Blue Bead Amulet", Slot::Amulet, 1, 0, 0, 0, 0, 0, 0, "+10 to all Attributes"},
        {"brass_ring", "Brass Ring", Slot::Ring, 1, 0, 0, 0, 0, 0, 0, "+15% to Fire Resistance"},
    };
    return b;
}

int find_base(const char* id) {
    auto& b = item_bases();
    for (size_t i = 0; i < b.size(); i++) if (std::string(b[i].id) == id) return int(i);
    return 0;
}

const std::vector<AffixDef>& affix_defs() {
    const uint32_t W = SB(Slot::Weapon);
    static const std::vector<AffixDef> a = {
        // prefixes
        {"phys_inc", true, "Heavy", AE_LOCAL_PHYS_INC, W, {1, 8, 16}, {15, 25, 35}, {24, 34, 49}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Physical Damage"},
        {"phys_add", true, "Serrated", AE_LOCAL_PHYS_ADD, W, {1, 7, 15}, {2, 4, 7}, {3, 6, 10}, {5, 9, 14}, {7, 13, 20}, "Adds %d to %d Physical Damage"},
        {"fire_add", true, "Smouldering", AE_LOCAL_FIRE_ADD, W, {2, 9, 17}, {3, 6, 10}, {5, 9, 14}, {7, 12, 19}, {10, 16, 26}, "Adds %d to %d Fire Damage"},
        {"life", true, "Hale", AE_LIFE, ARMOUR_SLOTS | JEWELLERY, {1, 6, 14}, {10, 20, 30}, {19, 29, 44}, {0, 0, 0}, {0, 0, 0}, "+%d to maximum Life"},
        {"mana", true, "Lucid", AE_MANA, JEWELLERY | SB(Slot::Helmet), {1, 7, 15}, {10, 18, 26}, {17, 25, 36}, {0, 0, 0}, {0, 0, 0}, "+%d to maximum Mana"},
        {"armour_inc", true, "Riveted", AE_LOCAL_ARMOUR_INC, ARMOUR_SLOTS, {1, 8, 16}, {15, 27, 40}, {26, 39, 60}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Armour"},
        {"armour_add", true, "Plated", AE_LOCAL_ARMOUR_ADD, ARMOUR_SLOTS, {1, 7, 15}, {8, 20, 36}, {19, 35, 60}, {0, 0, 0}, {0, 0, 0}, "+%d to Armour"},
        // suffixes
        {"speed", false, "of Skill", AE_LOCAL_SPEED_INC, W, {1, 9, 17}, {5, 8, 11}, {7, 10, 14}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Attack Speed"},
        {"crit", false, "of Rending", AE_LOCAL_CRIT_INC, W, {3, 10, 18}, {10, 20, 30}, {19, 29, 38}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Critical Strike Chance"},
        {"str", false, "of the Bull", AE_STR, ALL, {1, 8, 16}, {8, 13, 18}, {12, 17, 23}, {0, 0, 0}, {0, 0, 0}, "+%d to Strength"},
        {"dex", false, "of the Falcon", AE_DEX, ALL, {1, 8, 16}, {8, 13, 18}, {12, 17, 23}, {0, 0, 0}, {0, 0, 0}, "+%d to Dexterity"},
        {"int", false, "of the Scribe", AE_INT, ALL, {1, 8, 16}, {8, 13, 18}, {12, 17, 23}, {0, 0, 0}, {0, 0, 0}, "+%d to Intelligence"},
        {"fire_res", false, "of the Kiln", AE_FIRE_RES, ARMOUR_SLOTS | JEWELLERY, {1, 8, 16}, {6, 12, 18}, {11, 17, 24}, {0, 0, 0}, {0, 0, 0}, "+%d%% to Fire Resistance"},
        {"cold_res", false, "of the Night Wind", AE_COLD_RES, ARMOUR_SLOTS | JEWELLERY, {1, 8, 16}, {6, 12, 18}, {11, 17, 24}, {0, 0, 0}, {0, 0, 0}, "+%d%% to Cold Resistance"},
        {"light_res", false, "of the Storm", AE_LIGHTNING_RES, ARMOUR_SLOTS | JEWELLERY, {1, 8, 16}, {6, 12, 18}, {11, 17, 24}, {0, 0, 0}, {0, 0, 0}, "+%d%% to Lightning Resistance"},
        {"chaos_res", false, "of the Grave", AE_CHAOS_RES, ARMOUR_SLOTS | JEWELLERY, {6, 12, 20}, {5, 9, 13}, {8, 12, 17}, {0, 0, 0}, {0, 0, 0}, "+%d%% to Chaos Resistance"},
        {"break", false, "of the Hammer", AE_BREAK_INC, W | SB(Slot::Gloves), {1, 9, 17}, {10, 20, 30}, {19, 29, 40}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Break buildup"},
        {"life_on_hit", false, "of Feasting", AE_LIFE_ON_HIT, W | SB(Slot::Gloves) | SB(Slot::Ring), {4, 11, 18}, {2, 4, 6}, {3, 5, 8}, {0, 0, 0}, {0, 0, 0}, "Gain %d Life per enemy hit"},
        {"regen", false, "of the Oasis", AE_LIFE_REGEN, ARMOUR_SLOTS | JEWELLERY, {1, 9, 17}, {1, 2, 4}, {2, 4, 6}, {0, 0, 0}, {0, 0, 0}, "Regenerate %d Life per second"},
        {"move", false, "of the Road", AE_MOVE_SPEED, SB(Slot::Boots), {1, 10, 18}, {8, 12, 16}, {11, 15, 20}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Movement Speed"},
    };
    return a;
}

const ItemBase& Item::b() const { return item_bases()[base]; }

static const char* kRareA[] = {"Dusk", "Grave", "Brass", "Cinder", "Kohl", "Tomb", "Sable", "Ember", "Mokattam", "Qarafa",
                               "Night", "Ash", "Lantern", "Salt", "Jackal", "Eclipse"};
static const char* kRareB[] = {"Breaker", "Knell", "Hammer", "Crusher", "Maw", "Toll", "Verdict", "Weight", "Oath",
                               "Mourning", "Ward", "Hold", "Grip", "Step", "Veil", "Knot"};

Item make_item(int base, Rarity r, int ilvl, Rng& rng) {
    Item it;
    it.base = uint16_t(base);
    it.rarity = r;
    it.ilvl = uint8_t(std::max(1, std::min(255, ilvl)));
    it.seed = rng.next();
    const ItemBase& b = it.b();
    int want = r == Rarity::Magic ? rng.irange(1, 2) : r == Rarity::Rare ? rng.irange(3, 6) : 0;
    int pre = 0, suf = 0;
    int maxp = r == Rarity::Magic ? 1 : 3, maxs = maxp;
    auto& defs = affix_defs();
    for (int tries = 0; tries < 60 && int(it.affixes.size()) < want; tries++) {
        int d = rng.irange(0, int(defs.size()) - 1);
        const AffixDef& ad = defs[size_t(d)];
        if (!(ad.slots & SB(b.slot))) continue;
        if (ad.prefix ? pre >= maxp : suf >= maxs) continue;
        bool dup = false;
        for (auto& a : it.affixes) if (a.def == d) dup = true;
        if (dup || ilvl < ad.tier_levels[0]) continue;
        int top = 0;
        for (int t = 0; t < 3; t++) if (ilvl >= ad.tier_levels[t]) top = t;
        int tier = rng.chance(0.55f) ? top : rng.irange(0, top);
        Affix af{uint16_t(d), uint8_t(tier), 0, 0};
        af.v1 = std::round(rng.range(ad.lo[tier], ad.hi[tier]));
        af.v2 = std::round(rng.range(ad.lo2[tier], ad.hi2[tier]));
        it.affixes.push_back(af);
        (ad.prefix ? pre : suf)++;
    }
    if (r == Rarity::Rare) it.name = std::string(kRareA[rng.next() % 16]) + " " + kRareB[rng.next() % 16];
    return it;
}

Item random_drop(int area_level, float rare_chance, float magic_chance, Rng& rng, Slot only) {
    auto& bases = item_bases();
    std::vector<int> pool;
    for (size_t i = 0; i < bases.size(); i++)
        if (bases[i].level <= area_level && (only == Slot::Count || bases[i].slot == only)) pool.push_back(int(i));
    int base = pool.empty() ? 0 : pool[size_t(rng.irange(0, int(pool.size()) - 1))];
    float r = rng.uniform();
    Rarity rar = r < rare_chance ? Rarity::Rare : r < rare_chance + magic_chance ? Rarity::Magic : Rarity::Normal;
    return make_item(base, rar, area_level, rng);
}

std::string Item::display_name() const {
    if (rarity == Rarity::Rare || rarity == Rarity::Unique) return name;
    std::string n = b().name;
    if (rarity == Rarity::Magic) {
        for (auto& a : affixes) {
            const AffixDef& d = affix_defs()[a.def];
            if (d.prefix) n = std::string(d.name) + " " + n;
            else n = n + " " + d.name;
        }
    }
    return n;
}

WeaponStats Item::weapon() const {
    WeaponStats w;
    const ItemBase& bb = b();
    if (bb.slot != Slot::Weapon) return w;
    float add_lo = 0, add_hi = 0, inc = 0, speed = 0, crit = 0;
    for (auto& a : affixes) {
        switch (affix_defs()[a.def].effect) {
            case AE_LOCAL_PHYS_ADD: add_lo += a.v1; add_hi += a.v2; break;
            case AE_LOCAL_PHYS_INC: inc += a.v1; break;
            case AE_LOCAL_SPEED_INC: speed += a.v1; break;
            case AE_LOCAL_CRIT_INC: crit += a.v1; break;
            case AE_LOCAL_FIRE_ADD: w.add_min[DT_FIRE] += a.v1; w.add_max[DT_FIRE] += a.v2; break;
            default: break;
        }
    }
    w.phys_min = std::round((bb.phys_min + add_lo) * (1 + inc / 100.f));
    w.phys_max = std::round((bb.phys_max + add_hi) * (1 + inc / 100.f));
    w.aps = bb.aps * (1 + speed / 100.f);
    w.crit = bb.crit * (1 + crit / 100.f);
    w.valid = true;
    return w;
}

void Item::add_global_mods(Stats& s, uint16_t src) const {
    const ItemBase& bb = b();
    float armour_add = 0, armour_inc = 0;
    for (auto& a : affixes) {
        switch (affix_defs()[a.def].effect) {
            case AE_STR: s.add(S_STR, MK_FLAT, a.v1, 0, src); break;
            case AE_DEX: s.add(S_DEX, MK_FLAT, a.v1, 0, src); break;
            case AE_INT: s.add(S_INT, MK_FLAT, a.v1, 0, src); break;
            case AE_LIFE: s.add(S_LIFE, MK_FLAT, a.v1, 0, src); break;
            case AE_MANA: s.add(S_MANA, MK_FLAT, a.v1, 0, src); break;
            case AE_FIRE_RES: s.add(S_FIRE_RES, MK_FLAT, a.v1, 0, src); break;
            case AE_COLD_RES: s.add(S_COLD_RES, MK_FLAT, a.v1, 0, src); break;
            case AE_LIGHTNING_RES: s.add(S_LIGHTNING_RES, MK_FLAT, a.v1, 0, src); break;
            case AE_CHAOS_RES: s.add(S_CHAOS_RES, MK_FLAT, a.v1, 0, src); break;
            case AE_BREAK_INC: s.add(S_BREAK, MK_INC, a.v1, 0, src); break;
            case AE_LIFE_ON_HIT: s.add(S_LIFE_LEECH, MK_FLAT, a.v1, 0, src); break;
            case AE_LIFE_REGEN: s.add(S_LIFE_REGEN, MK_FLAT, a.v1, 0, src); break;
            case AE_MOVE_SPEED: s.add(S_MOVE_SPEED, MK_INC, a.v1, 0, src); break;
            case AE_AREA_INC: s.add(S_AREA, MK_INC, a.v1, 0, src); break;
            case AE_ATTACK_SPEED_INC: s.add(S_ATTACK_SPEED, MK_INC, a.v1, 0, src); break;
            case AE_LOCAL_ARMOUR_ADD: armour_add += a.v1; break;
            case AE_LOCAL_ARMOUR_INC: armour_inc += a.v1; break;
            default: break;
        }
    }
    if (bb.armour > 0 || armour_add > 0) s.add(S_ARMOUR, MK_FLAT, (bb.armour + armour_add) * (1 + armour_inc / 100.f), 0, src);
    if (bb.implicit) {
        std::string imp = bb.implicit;
        if (imp.find("maximum Life") != std::string::npos) s.add(S_LIFE, MK_FLAT, 20, 0, src);
        if (imp.find("all Attributes") != std::string::npos) { s.add(S_STR, MK_FLAT, 10, 0, src); s.add(S_DEX, MK_FLAT, 10, 0, src); s.add(S_INT, MK_FLAT, 10, 0, src); }
        if (imp.find("Fire Resistance") != std::string::npos) s.add(S_FIRE_RES, MK_FLAT, 15, 0, src);
    }
}

std::vector<std::string> Item::lines() const {
    std::vector<std::string> out;
    const ItemBase& bb = b();
    char buf[160];
    if (bb.slot == Slot::Weapon) {
        WeaponStats w = weapon();
        out.push_back("Two-Handed Mace");
        snprintf(buf, sizeof buf, "Physical Damage: %d-%d", int(w.phys_min), int(w.phys_max));
        out.push_back(buf);
        if (w.add_max[DT_FIRE] > 0) { snprintf(buf, sizeof buf, "Fire Damage: %d-%d", int(w.add_min[DT_FIRE]), int(w.add_max[DT_FIRE])); out.push_back(buf); }
        snprintf(buf, sizeof buf, "Critical Strike Chance: %.1f%%", w.crit);
        out.push_back(buf);
        snprintf(buf, sizeof buf, "Attacks per Second: %.2f", w.aps);
        out.push_back(buf);
    } else if (bb.armour > 0) {
        float add = 0, inc = 0;
        for (auto& a : affixes) {
            auto e = affix_defs()[a.def].effect;
            if (e == AE_LOCAL_ARMOUR_ADD) add += a.v1;
            if (e == AE_LOCAL_ARMOUR_INC) inc += a.v1;
        }
        snprintf(buf, sizeof buf, "Armour: %d", int((bb.armour + add) * (1 + inc / 100.f)));
        out.push_back(buf);
    }
    if (bb.implicit) out.push_back(std::string("~") + bb.implicit);
    for (auto& a : affixes) {
        const AffixDef& d = affix_defs()[a.def];
        if (std::string(d.fmt).find("to %d") != std::string::npos && d.effect != AE_STR && d.effect != AE_DEX && d.effect != AE_INT)
            snprintf(buf, sizeof buf, d.fmt, int(a.v1), int(a.v2));
        else snprintf(buf, sizeof buf, d.fmt, int(a.v1));
        out.push_back(buf);
    }
    snprintf(buf, sizeof buf, "#Item Level %d", ilvl);
    out.push_back(buf);
    return out;
}

uint32_t rarity_color(Rarity r) {
    switch (r) {
        case Rarity::Magic: return 0x7AA8FF;
        case Rarity::Rare: return 0xF5D76E;
        case Rarity::Unique: return 0xE08A3C;
        default: return 0xEDE3D1;
    }
}

}  // namespace q
