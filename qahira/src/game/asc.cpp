#include "game/asc.hpp"

namespace q {

static Mod M(Stat s, ModKind k, float v, uint32_t tags = 0) { return Mod{s, k, v, tags, 0}; }

const std::vector<Ascendancy>& ascendancies() {
    static const std::vector<Ascendancy> a = {
        {"ironclad", "Ironclad", "warrior", "Armour, Endurance Charges, and a body the city cannot move", 0xB0B8C0,
         {
             {"Ironclad", false, -1, {0, 0}, {}, 0, {}},
             {"Rivets", false, 0, {-1.6f, 1.0f}, {M(S_ARMOUR, MK_INC, 15)}, 0, {"15% increased Armour"}},
             {"Riveted Skin", true, 1, {-2.8f, 2.2f}, {}, KS_ENDURANCE,
              {"Gain an Endurance Charge when you Break an enemy", "Each Endurance Charge: 4% less Physical Damage taken",
               "and +4% to Elemental Resistances"}},
             {"Broad Back", false, 0, {0, 1.4f}, {M(S_LIFE, MK_FLAT, 20)}, 0, {"+20 to maximum Life"}},
             {"Unshaken", true, 3, {0, 2.9f}, {}, KS_UNSHAKEN,
              {"You cannot be knocked back", "15% less Damage taken from Hits while at maximum Endurance Charges"}},
             {"Heavy Hands", false, 0, {1.6f, 1.0f}, {M(S_DAMAGE, MK_INC, 10, T_SLAM)}, 0, {"10% increased Slam Damage"}},
             {"Hammer of the Foundry", true, 5, {2.8f, 2.2f}, {}, KS_FOUNDRY,
              {"Slams deal 25% more Damage to Broken enemies", "+1 to maximum Endurance Charges"}},
             {"Crack the Shell", false, 0, {1.6f, -1.0f}, {M(S_BREAK, MK_INC, 10)}, 0, {"10% increased Break buildup"}},
             {"Plate upon Plate", true, 7, {2.8f, -2.2f}, {M(S_ARMOUR, MK_INC, 20)}, KS_PLATE,
              {"20% increased Armour", "Armour also applies to Elemental Damage from Hits, at half its value"}},
             {"Deep Breath", false, 0, {0, -1.4f}, {M(S_LIFE_REGEN, MK_FLAT, 2)}, 0, {"Regenerate 2 Life per second"}},
             {"Unbreakable Oath", true, 9, {0, -2.9f}, {}, KS_OATH,
              {"Regenerate 0.6% of maximum Life per second", "per Endurance Charge"}},
             {"Loud Voice", false, 0, {-1.6f, -1.0f}, {M(S_WARCRY, MK_INC, 10)}, 0, {"10% increased Warcry Effect"}},
             {"The Iron Cry", true, 11, {-2.8f, -2.2f}, {}, KS_IRON_CRY, {"Your Warcries grant 2 Endurance Charges"}},
         }},
        {"stormbinder", "Stormbinder", "sorcerer", "Elemental ailments bound together, and spells that crack like thunder", 0x8AC8F2,
         {
             {"Stormbinder", false, -1, {0, 0}, {}, 0, {}},
             {"Frostbite", false, 0, {-1.6f, 1.0f}, {M(S_DAMAGE, MK_INC, 10, T_COLD)}, 0, {"10% increased Cold Damage"}},
             {"Binding Cold", true, 1, {-2.8f, 2.2f}, {M(S_FREEZE, MK_INC, 30)}, KS_BIND_COLD,
              {"30% increased Freeze Buildup", "Chilled and Frozen enemies take 15% increased Damage"}},
             {"Static", false, 0, {0, 1.4f}, {M(S_DAMAGE, MK_INC, 10, T_LIGHTNING)}, 0, {"10% increased Lightning Damage"}},
             {"Eye of the Storm", true, 3, {0, 2.9f}, {M(S_SHOCK, MK_INC, 25)}, KS_STORM_EYE,
              {"Critical Strikes with Spells always Shock", "25% increased Effect of Shock"}},
             {"Omen Reader", false, 0, {1.6f, 1.0f}, {M(S_CRIT_CHANCE, MK_INC, 15, T_SPELL)}, 0,
              {"15% increased Critical Strike Chance for Spells"}},
             {"Heart of the Tempest", true, 5, {2.8f, 2.2f}, {M(S_CRIT_CHANCE, MK_FLAT, 1.5f, T_SPELL), M(S_CRIT_MULTI, MK_FLAT, 30, T_SPELL)}, 0,
              {"+1.5% to Critical Strike Chance for Spells", "+30% to Critical Strike Multiplier for Spells"}},
             {"Kindling", false, 0, {1.6f, -1.0f}, {M(S_DAMAGE, MK_INC, 10, T_FIRE)}, 0, {"10% increased Fire Damage"}},
             {"Ailment Weaver", true, 7, {2.8f, -2.2f}, {M(S_IGNITE, MK_FLAT, 10)}, KS_WEAVER,
              {"Ignites you inflict deal 30% more Damage", "+10% chance to Ignite"}},
             {"Warding Script", false, 0, {0, -1.4f}, {M(S_ES, MK_FLAT, 15)}, 0, {"+15 to maximum Hirz"}},
             {"Storm Mantle", true, 9, {0, -2.9f}, {M(S_ES, MK_INC, 20), M(S_ES_RECHARGE, MK_INC, 40)}, 0,
              {"20% increased maximum Hirz", "40% increased Hirz Recharge Rate"}},
             {"Quick Tongue", false, 0, {-1.6f, -1.0f}, {M(S_CAST_SPEED, MK_INC, 8)}, 0, {"8% increased Cast Speed"}},
             {"Conductor", true, 11, {-2.8f, -2.2f}, {M(S_CHAINS, MK_FLAT, 1), M(S_DAMAGE, MK_INC, 15, T_LIGHTNING)}, 0,
              {"Skills Chain +1 time", "15% increased Lightning Damage"}},
         }},
    };
    return a;
}

const Ascendancy* ascendancy_for(const std::string& cls) {
    for (auto& a : ascendancies()) if (cls == a.cls) return &a;
    return nullptr;
}

int find_ascendancy(const std::string& id) {
    auto& a = ascendancies();
    for (size_t i = 0; i < a.size(); i++) if (id == a[i].id) return int(i);
    return -1;
}

bool asc_can_take(const Ascendancy& a, uint32_t held, int node) {
    if (node <= 0 || node >= int(a.nodes.size()) || (held >> node & 1)) return false;
    int p = a.nodes[size_t(node)].parent;
    return p == 0 || (p > 0 && (held >> p & 1));
}

void asc_apply(const Ascendancy& a, uint32_t held, Stats& s, uint32_t& rules) {
    for (size_t i = 1; i < a.nodes.size(); i++) {
        if (!(held >> i & 1)) continue;
        for (Mod m : a.nodes[i].mods) { m.source = uint16_t(SRC_ASC + i); s.add(m); }
        rules |= a.nodes[i].rule;
    }
}

int asc_spent(uint32_t held) { return __builtin_popcount(held & ~1u); }

}  // namespace q
