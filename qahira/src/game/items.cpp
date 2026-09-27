#include "game/items.hpp"
#include "game/uniques.hpp"
#include <algorithm>
#include <array>
#include <cstdio>
#include <cstdlib>

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
        // Slice 3, the Sorcerer: staves and Hirz armour (append only: items store the base's index)
        {"ashwood_staff", "Ashwood Staff", Slot::Weapon, 1, 7, 13, 1.2f, 7, 0, 0, "18% increased Spell Damage", 0, WK_STAFF},
        {"astrolabe_staff", "Brass Astrolabe Staff", Slot::Weapon, 5, 11, 21, 1.2f, 7.5f, 0, 0, "24% increased Spell Damage", 0, WK_STAFF},
        {"qanun_staff", "Qanun-String Staff", Slot::Weapon, 11, 17, 32, 1.25f, 7.5f, 0, 0, "30% increased Spell Damage", 0, WK_STAFF},
        {"obsidian_staff", "Obsidian Staff", Slot::Weapon, 18, 26, 48, 1.2f, 8, 0, 0, "36% increased Spell Damage", 0, WK_STAFF},
        {"linen_hood", "Linen Hood", Slot::Helmet, 1, 0, 0, 0, 0, 0, 0, nullptr, 14, WK_NONE},
        {"scholars_coat", "Scholar's Coat", Slot::Body, 1, 0, 0, 0, 0, 0, 0, nullptr, 32, WK_NONE},
        {"silk_gloves", "Silk Gloves", Slot::Gloves, 1, 0, 0, 0, 0, 0, 0, nullptr, 9, WK_NONE},
        {"felt_slippers", "Felt Slippers", Slot::Boots, 1, 0, 0, 0, 0, 0, 0, nullptr, 10, WK_NONE},
        {"embroidered_hood", "Embroidered Hood", Slot::Helmet, 9, 0, 0, 0, 0, 0, 0, nullptr, 30, WK_NONE},
        {"astronomers_robe", "Astronomer's Robe", Slot::Body, 10, 0, 0, 0, 0, 0, 0, nullptr, 72, WK_NONE},
        {"lapis_ring", "Lapis Ring", Slot::Ring, 3, 0, 0, 0, 0, 0, 0, "+14% to Cold Resistance"},
        {"moonstone_amulet", "Moonstone Amulet", Slot::Amulet, 4, 0, 0, 0, 0, 0, 0, "+20 to maximum Hirz"},
        // Slice 5: charts of al-Idrisi's Seven Climes (map items), run on the Map of al-Idrisi
        {"chart_clime_1", "Chart of the First Clime", Slot::Chart, 14, 0, 0, 0, 0, 0, 0, nullptr, 0, WK_NONE},
        {"chart_clime_2", "Chart of the Second Clime", Slot::Chart, 15, 0, 0, 0, 0, 0, 0, nullptr, 0, WK_NONE},
        {"chart_clime_3", "Chart of the Third Clime", Slot::Chart, 16, 0, 0, 0, 0, 0, 0, nullptr, 0, WK_NONE},
        {"chart_clime_4", "Chart of the Fourth Clime", Slot::Chart, 17, 0, 0, 0, 0, 0, 0, nullptr, 0, WK_NONE},
        // Slice 6, the Ranger: bows and evasion armour
        {"reed_bow", "Reed Bow", Slot::Weapon, 1, 5, 11, 1.45f, 6, 0, 0, nullptr, 0, WK_BOW},
        {"acacia_bow", "Acacia Bow", Slot::Weapon, 5, 8, 17, 1.4f, 6.5f, 0, 0, nullptr, 0, WK_BOW},
        {"horn_bow", "Horn Bow", Slot::Weapon, 11, 13, 27, 1.35f, 7, 0, 0, "10% increased Projectile Speed", 0, WK_BOW},
        {"composite_bow", "Composite Bow", Slot::Weapon, 18, 19, 41, 1.4f, 7, 0, 0, "10% increased Projectile Speed", 0, WK_BOW},
        {"leather_hood", "Leather Hood", Slot::Helmet, 1, 0, 0, 0, 0, 0, 14, nullptr, 0, WK_NONE},
        {"hunters_jerkin", "Hunter's Jerkin", Slot::Body, 1, 0, 0, 0, 0, 0, 32, nullptr, 0, WK_NONE},
        {"suede_gloves", "Suede Gloves", Slot::Gloves, 1, 0, 0, 0, 0, 0, 9, nullptr, 0, WK_NONE},
        {"sand_striders", "Sand Striders", Slot::Boots, 1, 0, 0, 0, 0, 0, 11, nullptr, 0, WK_NONE},
        {"falconers_hood", "Falconer's Hood", Slot::Helmet, 9, 0, 0, 0, 0, 0, 38, nullptr, 0, WK_NONE},
        {"desert_coat", "Desert Coat", Slot::Body, 10, 0, 0, 0, 0, 0, 84, nullptr, 0, WK_NONE},
        {"jade_ring", "Jade Ring", Slot::Ring, 3, 0, 0, 0, 0, 0, 0, "+12 to Dexterity"},
    };
    return b;
}

int find_base(const char* id) {
    auto& b = item_bases();
    for (size_t i = 0; i < b.size(); i++) if (std::string(b[i].id) == id) return int(i);
    return 0;
}

int find_affix(const char* id) {
    auto& a = affix_defs();
    for (size_t i = 0; i < a.size(); i++) if (std::string(a[i].id) == id) return int(i);
    return -1;
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
        {"armour_inc", true, "Riveted", AE_LOCAL_ARMOUR_INC, ARMOUR_SLOTS, {1, 8, 16}, {15, 27, 40}, {26, 39, 60}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Armour", NEED_ARMOUR},
        {"armour_add", true, "Plated", AE_LOCAL_ARMOUR_ADD, ARMOUR_SLOTS, {1, 7, 15}, {8, 20, 36}, {19, 35, 60}, {0, 0, 0}, {0, 0, 0}, "+%d to Armour", NEED_ARMOUR},
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
        // Slice 3 (append only: items store the affix's index)
        {"spell_dmg", true, "Scholar's", AE_SPELL_DMG_INC, W | SB(Slot::Amulet), {1, 8, 16}, {12, 22, 32}, {21, 31, 45}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Spell Damage", NEED_STAFF},
        {"es_add", true, "Warded", AE_LOCAL_ES_ADD, ARMOUR_SLOTS, {1, 7, 15}, {6, 14, 24}, {13, 23, 38}, {0, 0, 0}, {0, 0, 0}, "+%d to maximum Hirz", NEED_ES},
        {"es_inc", true, "Inscribed", AE_LOCAL_ES_INC, ARMOUR_SLOTS, {1, 8, 16}, {15, 27, 40}, {26, 39, 60}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Hirz", NEED_ES},
        {"spell_cold", true, "Frosted", AE_SPELL_COLD_ADD, W | SB(Slot::Ring) | SB(Slot::Amulet), {2, 9, 17}, {2, 4, 7}, {3, 6, 9}, {5, 8, 12}, {7, 11, 17}, "Adds %d to %d Cold Damage to Spells", NEED_STAFF},
        {"ele_dmg", true, "Kindled", AE_ELE_DMG_INC, SB(Slot::Ring) | SB(Slot::Amulet) | SB(Slot::Gloves), {1, 8, 16}, {8, 14, 20}, {13, 19, 27}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Elemental Damage"},
        {"cast_speed", false, "of Recitation", AE_CAST_SPEED_INC, W | SB(Slot::Ring) | SB(Slot::Amulet) | SB(Slot::Gloves), {2, 10, 18}, {5, 8, 11}, {7, 10, 15}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Cast Speed", NEED_STAFF},
        {"mana_regen", false, "of the Well", AE_MANA_REGEN, W | JEWELLERY | SB(Slot::Helmet), {1, 8, 16}, {20, 30, 40}, {29, 39, 55}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Mana Regeneration Rate"},
        {"spell_crit", false, "of Omens", AE_SPELL_CRIT_INC, W | SB(Slot::Amulet), {3, 10, 18}, {20, 35, 50}, {34, 49, 70}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Critical Strike Chance for Spells", NEED_STAFF},
    };
    // Slice 4: mods that never roll on drops (no slots): uniques, the Ifrit's Ember and the bench use them.
    // Append only, after the rolled ones.
    static const std::vector<AffixDef> g = [] {
        struct G { const char* id; bool pre; const char* fmt; Stat st; ModKind k; uint32_t tags; float sign; };
        const G list[] = {
            {"g_life_pct", true, "%d%% increased maximum Life", S_LIFE, MK_INC, 0, 1},
            {"g_crit_multi", false, "+%d%% to Critical Strike Multiplier", S_CRIT_MULTI, MK_FLAT, 0, 1},
            {"g_attack_speed", false, "%d%% increased Attack Speed", S_ATTACK_SPEED, MK_INC, 0, 1},
            {"g_cast_speed", false, "%d%% increased Cast Speed", S_CAST_SPEED, MK_INC, 0, 1},
            {"g_area", false, "%d%% increased Area of Effect", S_AREA, MK_INC, 0, 1},
            {"g_dmg_taken", false, "%d%% increased Damage taken", S_DAMAGE_TAKEN, MK_INC, 0, 1},
            {"g_mana_cost", false, "%d%% reduced Mana Cost of Skills", S_MANA_COST, MK_INC, 0, -1},
            {"g_fire_dmg", true, "%d%% increased Fire Damage", S_DAMAGE, MK_INC, T_FIRE, 1},
            {"g_cold_dmg", true, "%d%% increased Cold Damage", S_DAMAGE, MK_INC, T_COLD, 1},
            {"g_light_dmg", true, "%d%% increased Lightning Damage", S_DAMAGE, MK_INC, T_LIGHTNING, 1},
            {"g_phys_dmg", true, "%d%% increased Physical Damage", S_DAMAGE, MK_INC, T_PHYSICAL, 1},
            {"g_slam_dmg", true, "%d%% increased Slam Damage", S_DAMAGE, MK_INC, T_SLAM, 1},
            {"g_spell_dmg", true, "%d%% increased Spell Damage", S_DAMAGE, MK_INC, T_SPELL, 1},
            {"g_warcry", false, "%d%% increased Warcry Effect", S_WARCRY, MK_INC, 0, 1},
            {"g_skill_level", false, "+%d to Level of all Talismans", S_SKILL_LEVEL, MK_FLAT, 0, 1},
            {"g_ignite", false, "%d%% chance to Ignite", S_IGNITE, MK_FLAT, 0, 1},
            {"g_freeze", false, "%d%% increased Freeze Buildup", S_FREEZE, MK_INC, 0, 1},
            {"g_shock", false, "%d%% increased Effect of Shock", S_SHOCK, MK_INC, 0, 1},
            {"g_chains", false, "Skills Chain +%d times", S_CHAINS, MK_FLAT, 0, 1},
            {"g_gain_fire", true, "Gain %d%% of Physical Damage as extra Fire Damage", S_GAIN_FIRE, MK_FLAT, 0, 1},
            {"g_es_recharge", false, "%d%% increased Hirz Recharge Rate", S_ES_RECHARGE, MK_INC, 0, 1},
            {"g_flask", false, "%d%% increased Flask Life Recovery", S_FLASK_RECOVERY, MK_INC, 0, 1},
            {"g_move", false, "%d%% increased Movement Speed", S_MOVE_SPEED, MK_INC, 0, 1},
            {"g_move_less", false, "%d%% reduced Movement Speed", S_MOVE_SPEED, MK_INC, 0, -1},
            {"g_cdr", false, "%d%% increased Cooldown Recovery Rate", S_COOLDOWN_RECOVERY, MK_INC, 0, 1},
            {"g_armour", true, "+%d to Armour", S_ARMOUR, MK_FLAT, 0, 1},
            {"g_es", true, "+%d to maximum Hirz", S_ES, MK_FLAT, 0, 1},
            {"g_es_pct", true, "%d%% increased maximum Hirz", S_ES, MK_INC, 0, 1},
            {"g_mana_pct", true, "%d%% increased maximum Mana", S_MANA, MK_INC, 0, 1},
            {"g_break", false, "%d%% increased Break buildup", S_BREAK, MK_INC, 0, 1},
            {"g_crit", false, "%d%% increased Critical Strike Chance", S_CRIT_CHANCE, MK_INC, 0, 1},
            {"g_ele_dmg", true, "%d%% increased Elemental Damage", S_DAMAGE, MK_INC, T_ELEMENTAL, 1},
            {"g_life_regen", false, "Regenerate %d Life per second", S_LIFE_REGEN, MK_FLAT, 0, 1},
            {"g_mana_regen", false, "%d%% increased Mana Regeneration Rate", S_MANA_REGEN, MK_INC, 0, 1},
            {"g_leech", false, "Gain %d Life per enemy hit", S_LIFE_LEECH, MK_FLAT, 0, 1},
            {"g_projectiles", false, "Skills fire %d additional Projectiles", S_PROJECTILES, MK_FLAT, 0, 1},
            {"g_phys_more", true, "%d%% more Physical Damage", S_DAMAGE, MK_MORE, T_PHYSICAL, 1},
            {"g_spell_more", true, "%d%% more Spell Damage", S_DAMAGE, MK_MORE, T_SPELL, 1},
            {"g_life_less", true, "%d%% less maximum Life", S_LIFE, MK_MORE, 0, -1},
        };
        std::vector<AffixDef> v;
        for (const G& e : list) {
            AffixDef d{e.id, e.pre, "", AE_GENERIC, 0, {1, 1, 1}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, e.fmt};
            d.gstat = e.st;
            d.gkind = e.k;
            d.gtags = e.tags;
            d.gsign = e.sign;
            v.push_back(d);
        }
        v.push_back(AffixDef{"g_all_res", false, "", AE_ALL_RES, 0, {1, 1, 1}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, "+%d%% to all Elemental Resistances"});
        v.push_back(AffixDef{"g_all_attr", false, "", AE_ALL_ATTR, 0, {1, 1, 1}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, "+%d to all Attributes"});
        return v;
    }();
    // Slice 5: chart mods (risk, and 8% more items each). They roll only on charts. Append only, after the rest.
    const uint32_t CH = SB(Slot::Chart);
    static const std::vector<AffixDef> c = {
        {"cm_life", true, "Hulking", AE_CHART, CH, {14, 15, 16}, {20, 30, 40}, {29, 39, 50}, {0, 0, 0}, {0, 0, 0}, "Monsters have %d%% more Life"},
        {"cm_damage", true, "Savage", AE_CHART, CH, {14, 15, 16}, {10, 15, 20}, {14, 19, 25}, {0, 0, 0}, {0, 0, 0}, "Monsters deal %d%% more Damage"},
        {"cm_packs", true, "Teeming", AE_CHART, CH, {14, 15, 16}, {15, 22, 30}, {21, 29, 40}, {0, 0, 0}, {0, 0, 0}, "%d%% more Monsters"},
        {"cm_fire", true, "Burning", AE_CHART, CH, {14, 15, 16}, {15, 20, 25}, {19, 24, 30}, {0, 0, 0}, {0, 0, 0}, "Monsters' hits add %d%% of their damage as Fire"},
        {"cm_elites", true, "Crowned", AE_CHART, CH, {14, 15, 16}, {20, 30, 40}, {29, 39, 50}, {0, 0, 0}, {0, 0, 0}, "%d%% more Magic and Rare Monsters"},
        {"cm_speed", false, "of Haste", AE_CHART, CH, {14, 15, 16}, {10, 14, 18}, {13, 17, 22}, {0, 0, 0}, {0, 0, 0}, "Monsters move %d%% faster"},
        {"cm_res", false, "of the Simoom", AE_CHART, CH, {14, 15, 16}, {5, 8, 11}, {7, 10, 14}, {0, 0, 0}, {0, 0, 0}, "-%d%% to your maximum Resistances"},
        {"cm_rarity", false, "of Plenty", AE_CHART, CH, {14, 15, 16}, {10, 15, 20}, {14, 19, 25}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Rarity of Items found"},
        {"cm_sand", false, "of Sand", AE_CHART, CH, {14, 15, 16}, {35, 50, 70}, {49, 69, 100}, {0, 0, 0}, {0, 0, 0}, "+%d%% chance of a Haboob"},
    };
    // Slice 6: evasion, projectiles, poison (rolled; append only, after the chart mods)
    static const std::vector<AffixDef> r = [&] {
        std::vector<AffixDef> v = {
            {"ev_add", true, "Swift", AE_LOCAL_EVASION_ADD, ARMOUR_SLOTS, {1, 7, 15}, {8, 20, 36}, {19, 35, 60}, {0, 0, 0}, {0, 0, 0}, "+%d to Evasion Rating", NEED_EVASION},
            {"ev_inc", true, "Nimble", AE_LOCAL_EVASION_INC, ARMOUR_SLOTS, {1, 8, 16}, {15, 27, 40}, {26, 39, 60}, {0, 0, 0}, {0, 0, 0}, "%d%% increased Evasion Rating", NEED_EVASION},
        };
        auto gen = [&](const char* id, bool pre, const char* name, uint32_t slots, std::array<float, 6> v6, const char* fmt, Stat st,
                       ModKind k, uint32_t tags, uint8_t need) {
            AffixDef d{id, pre, name, AE_GENERIC, slots, {1, 8, 16}, {v6[0], v6[2], v6[4]}, {v6[1], v6[3], v6[5]}, {0, 0, 0}, {0, 0, 0}, fmt, need};
            d.gstat = st;
            d.gkind = k;
            d.gtags = tags;
            v.push_back(d);
        };
        gen("proj_dmg", true, "Fletched", SB(Slot::Weapon) | SB(Slot::Amulet) | SB(Slot::Gloves), {12, 21, 22, 31, 32, 45},
            "%d%% increased Projectile Damage", S_DAMAGE, MK_INC, T_PROJECTILE, 0);
        gen("poison_chance", false, "of Venom", SB(Slot::Weapon) | SB(Slot::Gloves) | SB(Slot::Ring), {8, 12, 13, 18, 19, 25},
            "%d%% chance to Poison on Hit", S_POISON, MK_FLAT, 0, 0);
        gen("proj_speed", false, "of the Falcon's Flight", SB(Slot::Weapon) | SB(Slot::Gloves), {10, 15, 16, 22, 23, 30},
            "%d%% increased Projectile Speed", S_PROJ_SPEED, MK_INC, 0, NEED_BOW);
        gen("bow_crit", false, "of the Hawk", SB(Slot::Weapon), {10, 20, 21, 30, 31, 40},
            "%d%% increased Critical Strike Chance with Bows", S_CRIT_CHANCE, MK_INC, T_BOW, NEED_BOW);
        return v;
    }();
    static const std::vector<AffixDef> all = [&] {
        std::vector<AffixDef> v = a;
        v.insert(v.end(), g.begin(), g.end());
        v.insert(v.end(), c.begin(), c.end());
        v.insert(v.end(), r.begin(), r.end());
        return v;
    }();
    return all;
    return a;
}

static bool fits_need(const AffixDef& ad, const ItemBase& b) {
    if (!ad.need) return true;
    if (ARMOUR_SLOTS & SB(b.slot)) {
        if (!(ad.need & (NEED_ARMOUR | NEED_ES | NEED_EVASION))) return true;
        return ((ad.need & NEED_ARMOUR) && b.armour > 0) || ((ad.need & NEED_ES) && b.es > 0) || ((ad.need & NEED_EVASION) && b.evasion > 0);
    }
    if (b.slot == Slot::Weapon) {
        if (!(ad.need & (NEED_MAUL | NEED_STAFF | NEED_BOW))) return true;
        return ((ad.need & NEED_MAUL) && b.wkind == WK_MAUL) || ((ad.need & NEED_STAFF) && b.wkind == WK_STAFF) ||
               ((ad.need & NEED_BOW) && b.wkind == WK_BOW);
    }
    return true;
}

const ItemBase& Item::b() const {
    static const ItemBase none{"none", "Nothing", Slot::Count, 0, 0, 0, 0, 0, 0, 0, nullptr, 0, WK_NONE};
    return base < item_bases().size() ? item_bases()[base] : none;
}

static const char* kRareA[] = {"Dusk", "Grave", "Brass", "Cinder", "Kohl", "Tomb", "Sable", "Ember", "Mokattam", "Qarafa",
                               "Night", "Ash", "Lantern", "Salt", "Jackal", "Eclipse"};
static const char* kRareB[] = {"Breaker", "Knell", "Hammer", "Crusher", "Maw", "Toll", "Verdict", "Weight", "Oath",
                               "Mourning", "Ward", "Hold", "Grip", "Step", "Veil", "Knot"};

std::string rare_name(Rng& rng) { return std::string(kRareA[rng.next() % 16]) + " " + kRareB[rng.next() % 16]; }

void Item::count_affixes(int& pre, int& suf) const {
    pre = suf = 0;
    for (auto& a : affixes)
        if (!(a.flags & AF_IMPLICIT)) (affix_defs()[a.def].prefix ? pre : suf)++;
}

bool Item::has_crafted() const {
    for (auto& a : affixes) if (a.flags & AF_CRAFTED) return true;
    return false;
}

bool roll_affix(Item& it, Rng& rng, int want_prefix, const std::vector<int>* only) {
    if (it.rarity != Rarity::Magic && it.rarity != Rarity::Rare) return false;
    int limit = it.rarity == Rarity::Magic ? 1 : 3;
    int pre, suf;
    it.count_affixes(pre, suf);
    auto& defs = affix_defs();
    const ItemBase& b = it.b();
    std::vector<int> cand;
    for (size_t d = 0; d < defs.size(); d++) {
        const AffixDef& ad = defs[d];
        if (!(ad.slots & SB(b.slot)) || !fits_need(ad, b)) continue;
        if (ad.prefix ? pre >= limit : suf >= limit) continue;
        if (want_prefix >= 0 && ad.prefix != (want_prefix == 1)) continue;
        if (only && std::find(only->begin(), only->end(), int(d)) == only->end()) continue;
        bool dup = false;
        for (auto& a : it.affixes) if (a.def == d) dup = true;
        if (dup || it.ilvl < ad.tier_levels[0]) continue;
        cand.push_back(int(d));
    }
    if (cand.empty()) return false;
    int d = cand[size_t(rng.irange(0, int(cand.size()) - 1))];
    const AffixDef& ad = defs[size_t(d)];
    int top = 0;
    for (int t = 0; t < 3; t++) if (it.ilvl >= ad.tier_levels[t]) top = t;
    int tier = rng.chance(0.55f) ? top : rng.irange(0, top);
    Affix af{uint16_t(d), uint8_t(tier), 0, 0};
    af.v1 = std::round(rng.range(ad.lo[tier], ad.hi[tier]));
    af.v2 = std::round(rng.range(ad.lo2[tier], ad.hi2[tier]));
    it.affixes.push_back(af);
    return true;
}

void reroll_values(Item& it, Rng& rng) {
    if (it.unique != kNoItem) { reroll_unique(it, rng); return; }
    for (auto& a : it.affixes) {
        if (a.flags & (AF_CRAFTED | AF_IMPLICIT)) continue;   // bench mods are fixed; implicits are the ember's
        const AffixDef& ad = affix_defs()[a.def];
        a.v1 = std::round(rng.range(ad.lo[a.tier], ad.hi[a.tier]));
        a.v2 = std::round(rng.range(ad.lo2[a.tier], ad.hi2[a.tier]));
    }
}

Item make_item(int base, Rarity r, int ilvl, Rng& rng) {
    Item it;
    it.base = uint16_t(base);
    it.rarity = r;
    it.ilvl = uint8_t(std::max(1, std::min(255, ilvl)));
    it.seed = rng.next();
    int want = r == Rarity::Magic ? rng.irange(1, 2) : r == Rarity::Rare ? rng.irange(3, 6) : 0;
    while (int(it.affixes.size()) < want && roll_affix(it, rng)) {}
    if (r == Rarity::Rare) it.name = rare_name(rng);
    return it;
}

void grid_size(const Item& it, int& w, int& h) {
    switch (it.b().slot) {
        case Slot::Weapon: w = 2; h = 4; break;
        case Slot::Body: w = 2; h = 3; break;
        case Slot::Helmet: case Slot::Gloves: case Slot::Boots: w = 2; h = 2; break;
        case Slot::Belt: w = 2; h = 1; break;
        default: w = 1; h = 1; break;
    }
}

int sell_price(const Item& it) {
    switch (it.rarity) {
        case Rarity::Magic: return 3 + it.ilvl / 3;
        case Rarity::Rare: return 9 + it.ilvl / 2 + int(it.affixes.size());
        case Rarity::Unique: return 25 + it.ilvl;
        default: return 1;
    }
}

Item random_drop(int area_level, float rare_chance, float magic_chance, Rng& rng, Slot only) {
    auto& bases = item_bases();
    std::vector<int> pool;
    for (size_t i = 0; i < bases.size(); i++)
        if (bases[i].level <= area_level && (only == Slot::Count ? bases[i].slot != Slot::Chart : bases[i].slot == only)) pool.push_back(int(i));
    int base = pool.empty() ? 0 : pool[size_t(rng.irange(0, int(pool.size()) - 1))];
    float r = rng.uniform();
    Rarity rar = r < rare_chance ? Rarity::Rare : r < rare_chance + magic_chance ? Rarity::Magic : Rarity::Normal;
    return make_item(base, rar, area_level, rng);
}

std::string Item::display_name() const {
    if (rarity == Rarity::Unique && unique != kNoItem) return unique_def(unique).name;
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
    w.tags = T_TWO_HAND | (bb.wkind == WK_STAFF ? T_STAFF : bb.wkind == WK_BOW ? T_BOW | T_PROJECTILE : T_MACE);
    if (bb.wkind == WK_BOW) w.range = 12.f;
    w.valid = true;
    return w;
}

float Item::local_evasion() const {
    const ItemBase& bb = b();
    float add = 0, inc = 0;
    for (auto& a : affixes) {
        auto e = affix_defs()[a.def].effect;
        if (e == AE_LOCAL_EVASION_ADD) add += a.v1;
        if (e == AE_LOCAL_EVASION_INC) inc += a.v1;
    }
    return (bb.evasion + add) * (1 + inc / 100.f);
}

float Item::local_es() const {
    const ItemBase& bb = b();
    float add = 0, inc = 0;
    for (auto& a : affixes) {
        auto e = affix_defs()[a.def].effect;
        if (e == AE_LOCAL_ES_ADD) add += a.v1;
        if (e == AE_LOCAL_ES_INC) inc += a.v1;
    }
    return (bb.es + add) * (1 + inc / 100.f);
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
            case AE_SPELL_DMG_INC: s.add(S_DAMAGE, MK_INC, a.v1, T_SPELL, src); break;
            case AE_CAST_SPEED_INC: s.add(S_CAST_SPEED, MK_INC, a.v1, 0, src); break;
            case AE_SPELL_COLD_ADD: s.add(S_ADDED_MIN, MK_FLAT, a.v1, T_SPELL | T_COLD, src); s.add(S_ADDED_MAX, MK_FLAT, a.v2, T_SPELL | T_COLD, src); break;
            case AE_ELE_DMG_INC: s.add(S_DAMAGE, MK_INC, a.v1, T_ELEMENTAL, src); break;
            case AE_MANA_REGEN: s.add(S_MANA_REGEN, MK_INC, a.v1, 0, src); break;
            case AE_SPELL_CRIT_INC: s.add(S_CRIT_CHANCE, MK_INC, a.v1, T_SPELL, src); break;
            case AE_GENERIC: {
                const AffixDef& d = affix_defs()[a.def];
                s.add(d.gstat, d.gkind, a.v1 * d.gsign, d.gtags, src);
                break;
            }
            case AE_ALL_RES: for (Stat r : {S_FIRE_RES, S_COLD_RES, S_LIGHTNING_RES}) s.add(r, MK_FLAT, a.v1, 0, src); break;
            case AE_ALL_ATTR: for (Stat r : {S_STR, S_DEX, S_INT}) s.add(r, MK_FLAT, a.v1, 0, src); break;
            default: break;
        }
    }
    if (bb.es > 0) s.add(S_ES, MK_FLAT, local_es(), 0, src);
    if (bb.evasion > 0) s.add(S_EVASION, MK_FLAT, local_evasion(), 0, src);
    if (bb.armour > 0 || armour_add > 0) s.add(S_ARMOUR, MK_FLAT, (bb.armour + armour_add) * (1 + armour_inc / 100.f), 0, src);
    if (bb.implicit) {
        std::string imp = bb.implicit;
        if (imp.find("maximum Life") != std::string::npos) s.add(S_LIFE, MK_FLAT, 20, 0, src);
        if (imp.find("all Attributes") != std::string::npos) { s.add(S_STR, MK_FLAT, 10, 0, src); s.add(S_DEX, MK_FLAT, 10, 0, src); s.add(S_INT, MK_FLAT, 10, 0, src); }
        if (imp.find("Fire Resistance") != std::string::npos) s.add(S_FIRE_RES, MK_FLAT, 15, 0, src);
        if (imp.find("Cold Resistance") != std::string::npos) s.add(S_COLD_RES, MK_FLAT, 14, 0, src);
        if (imp.find("maximum Hirz") != std::string::npos) s.add(S_ES, MK_FLAT, 20, 0, src);
        if (imp.find("Spell Damage") != std::string::npos) s.add(S_DAMAGE, MK_INC, float(atoi(bb.implicit)), T_SPELL, src);
        if (imp.find("Projectile Speed") != std::string::npos) s.add(S_PROJ_SPEED, MK_INC, 10, 0, src);
        if (imp.find("to Dexterity") != std::string::npos) s.add(S_DEX, MK_FLAT, 12, 0, src);
    }
}

std::vector<std::string> Item::lines() const {
    std::vector<std::string> out;
    const ItemBase& bb = b();
    char buf[160];
    if (bb.slot == Slot::Weapon) {
        WeaponStats w = weapon();
        out.push_back(bb.wkind == WK_STAFF ? "Staff" : bb.wkind == WK_BOW ? "Bow" : "Two-Handed Mace");
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
    } else if (bb.es > 0) {
        snprintf(buf, sizeof buf, "Hirz: %d", int(local_es()));
        out.push_back(buf);
    } else if (bb.evasion > 0) {
        snprintf(buf, sizeof buf, "Evasion Rating: %d", int(local_evasion()));
        out.push_back(buf);
    } else if (bb.slot == Slot::Chart) {
        snprintf(buf, sizeof buf, "Clime %d chart: Area Level %d", bb.level - 13, bb.level);
        out.push_back(buf);
        out.push_back("~Run it on a site of its Clime, at the chart table");
    }
    if (bb.implicit) out.push_back(std::string("~") + bb.implicit);
    auto text = [&](const Affix& a) {
        const AffixDef& d = affix_defs()[a.def];
        if (std::string(d.fmt).find("to %d") != std::string::npos && d.effect != AE_STR && d.effect != AE_DEX && d.effect != AE_INT)
            snprintf(buf, sizeof buf, d.fmt, int(a.v1), int(a.v2));
        else snprintf(buf, sizeof buf, d.fmt, int(a.v1));
        return std::string(buf);
    };
    for (auto& a : affixes) if (a.flags & AF_IMPLICIT) out.push_back("~" + text(a));
    for (auto& a : affixes) if (!(a.flags & AF_IMPLICIT)) out.push_back(((a.flags & AF_CRAFTED) ? "^" : "") + text(a));
    if (unique != kNoItem) for (auto& l : unique_def(unique).flavour) out.push_back("\"" + std::string(l));
    if (corrupted) out.push_back("!Corrupted");
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
