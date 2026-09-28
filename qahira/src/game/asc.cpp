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
        // ---- Slice 6: the Ranger's two
        {"marksman", "Marksman", "ranger", "Marks, sure shots and the long draw: every arrow finds the one it was meant for", 0xE8C860,
         {
             {"Marksman", false, -1, {0, 0}, {}, 0, {}},
             {"Fletcher's Eye", false, 0, {-1.6f, 1.0f}, {M(S_CRIT_CHANCE, MK_INC, 15, T_PROJECTILE)}, 0,
              {"15% increased Critical Strike Chance with Projectiles"}},
             {"Hawk's Gaze", true, 1, {-2.8f, 2.2f}, {M(S_MARK, MK_FLAT, 2), M(S_MARK, MK_INC, 50)}, KS_HAWK,
              {"Your Marks make 2 more hits Critical Strikes and last 50% longer", "Marked enemies take 10% increased Damage"}},
             {"Steady Draw", false, 0, {0, 1.4f}, {M(S_DAMAGE, MK_INC, 10, T_PROJECTILE)}, 0, {"10% increased Projectile Damage"}},
             {"The Long Shot", true, 3, {0, 2.9f}, {}, KS_LONG_SHOT,
              {"Projectile Attacks deal up to 30% more Damage", "the further away the enemy they hit"}},
             {"Sure Hand", false, 0, {1.6f, 1.0f}, {M(S_CRIT_MULTI, MK_FLAT, 20, T_PROJECTILE)}, 0,
              {"+20% to Critical Strike Multiplier with Projectiles"}},
             {"Heart-Seeker", true, 5, {2.8f, 2.2f}, {M(S_CRIT_CHANCE, MK_FLAT, 1.5f, T_PROJECTILE), M(S_CRIT_MULTI, MK_FLAT, 30, T_PROJECTILE)}, 0,
              {"+1.5% to Critical Strike Chance with Projectiles", "+30% to Critical Strike Multiplier with Projectiles"}},
             {"Quick Nock", false, 0, {1.6f, -1.0f}, {M(S_ATTACK_SPEED, MK_INC, 6)}, 0, {"6% increased Attack Speed"}},
             {"Frenzied Aim", true, 7, {2.8f, -2.2f}, {M(S_FRENZY, MK_FLAT, 1)}, KS_CRIT_FRENZY,
              {"Critical Strikes have a 30% chance to grant a Frenzy Charge", "+1 to maximum Frenzy Charges"}},
             {"Watchful", false, 0, {0, -1.4f}, {M(S_EVASION, MK_FLAT, 40)}, 0, {"+40 to Evasion Rating"}},
             {"Falcon's Ward", true, 9, {0, -2.9f}, {M(S_MARK, MK_INC, 25)}, KS_MARK_SPREAD,
              {"When a Marked enemy dies, its Mark passes to the nearest enemy", "25% increased Mark Duration"}},
             {"Fletching", false, 0, {-1.6f, -1.0f}, {M(S_PROJ_SPEED, MK_INC, 10)}, 0, {"10% increased Projectile Speed"}},
             {"Split the Reed", true, 11, {-2.8f, -2.2f}, {M(S_PROJECTILES, MK_FLAT, 1), M(S_PROJ_SPEED, MK_INC, 10)}, 0,
              {"Skills fire an additional Projectile", "10% increased Projectile Speed"}},
         }},
        {"outrider", "Outrider", "ranger", "Speed, venom and a full waterskin: the one who reaches the next well first", 0x8FD14F,
         {
             {"Outrider", false, -1, {0, 0}, {}, 0, {}},
             {"Light Step", false, 0, {-1.6f, 1.0f}, {M(S_MOVE_SPEED, MK_INC, 5)}, 0, {"5% increased Movement Speed"}},
             {"Desert Wind", true, 1, {-2.8f, 2.2f}, {M(S_MOVE_SPEED, MK_INC, 8), M(S_ATTACK_SPEED, MK_INC, 8)}, 0,
              {"8% increased Movement Speed", "8% increased Attack Speed"}},
             {"Venom", false, 0, {0, 1.4f}, {M(S_POISON, MK_FLAT, 10)}, 0, {"+10% chance to Poison on Hit"}},
             {"Scorpion's Kiss", true, 3, {0, 2.9f}, {M(S_POISON, MK_FLAT, 10)}, KS_VIPER,
              {"Poisons you inflict deal 40% more Damage and last 1 second longer", "+10% chance to Poison on Hit"}},
             {"Waterskin", false, 0, {1.6f, 1.0f}, {M(S_FLASK_RECOVERY, MK_INC, 20)}, 0, {"20% increased Flask Recovery"}},
             {"Qirba of Plenty", true, 5, {2.8f, 2.2f}, {M(S_FLASK_RECOVERY, MK_INC, 20)}, KS_QIRBA,
              {"Your Flask refills a quarter-charge every 2 seconds", "20% increased Flask Recovery"}},
             {"Sand Walker", false, 0, {1.6f, -1.0f}, {M(S_EVASION, MK_INC, 15)}, 0, {"15% increased Evasion Rating"}},
             {"Mirage", true, 7, {2.8f, -2.2f}, {M(S_EVASION, MK_INC, 30), M(S_DEX, MK_FLAT, 10)}, 0,
              {"30% increased Evasion Rating", "+10 to Dexterity"}},
             {"Hunter's Pace", false, 0, {0, -1.4f}, {M(S_FRENZY, MK_FLAT, 1)}, 0, {"+1 to maximum Frenzy Charges"}},
             {"Running Fire", true, 9, {0, -2.9f}, {}, KS_KILL_FRENZY,
              {"Kills have a 35% chance to grant a Frenzy Charge"}},
             {"Adder", false, 0, {-1.6f, -1.0f}, {M(S_POISON_DAMAGE, MK_INC, 15)}, 0, {"15% increased Poison Damage"}},
             {"Plague Road", true, 11, {-2.8f, -2.2f}, {M(S_POISON_DAMAGE, MK_INC, 15)}, KS_PLAGUE,
              {"When a Poisoned enemy dies, its Poisons spread to enemies nearby", "15% increased Poison Damage"}},
         }},
        // ---- Slice 7: the Mercenary's two
        {"duelist", "Duelist", "mercenary", "One opponent at a time: a guard, an answer, and the wound left open", 0xC8423A,
         {
             {"Duelist", false, -1, {0, 0}, {}, 0, {}},
             {"Measured Step", false, 0, {-1.6f, 1.0f}, {M(S_ATTACK_SPEED, MK_INC, 6, T_SWORD)}, 0, {"6% increased Attack Speed with Swords"}},
             {"The Answer", true, 1, {-2.8f, 2.2f}, {M(S_DAMAGE, MK_INC, 15, T_SWORD)}, KS_RIPOSTE,
              {"When an enemy's Hit lands on you, Riposte is ready at once", "15% increased Damage with Swords"}},
             {"Blood-Letting", false, 0, {0, 1.4f}, {M(S_BLEED, MK_FLAT, 10)}, 0, {"+10% chance to cause Bleeding"}},
             {"Open Wounds", true, 3, {0, 2.9f}, {M(S_BLEED_DAMAGE, MK_INC, 20)}, KS_OPEN_WOUNDS,
              {"Bleeding enemies take 12% increased Damage from your Hits", "20% increased Bleeding Damage"}},
             {"Guard", false, 0, {1.6f, 1.0f}, {M(S_ARMOUR, MK_FLAT, 30), M(S_EVASION, MK_FLAT, 30)}, 0,
              {"+30 to Armour", "+30 to Evasion Rating"}},
             {"Single Combat", true, 5, {2.8f, 2.2f}, {}, KS_SINGLE, {"Your Hits deal 25% more Damage to Rare and Unique enemies"}},
             {"Keen Edge", false, 0, {1.6f, -1.0f}, {M(S_CRIT_CHANCE, MK_INC, 15, T_SWORD)}, 0,
              {"15% increased Critical Strike Chance with Swords"}},
             {"Fencer's Poise", true, 7, {2.8f, -2.2f}, {M(S_CRIT_CHANCE, MK_FLAT, 1.5f, T_SWORD), M(S_CRIT_MULTI, MK_FLAT, 25, T_SWORD)}, 0,
              {"+1.5% to Critical Strike Chance with Swords", "+25% to Critical Strike Multiplier with Swords"}},
             {"Scarred", false, 0, {0, -1.4f}, {M(S_LIFE, MK_FLAT, 20)}, 0, {"+20 to maximum Life"}},
             {"Second Wind", true, 9, {0, -2.9f}, {M(S_LIFE, MK_INC, 5)}, KS_BLOOD_KILL,
              {"Recover 3% of maximum Life when you kill a Bleeding enemy", "5% increased maximum Life"}},
             {"Footwork", false, 0, {-1.6f, -1.0f}, {M(S_MOVE_SPEED, MK_INC, 5)}, 0, {"5% increased Movement Speed"}},
             {"Crescent Moon", true, 11, {-2.8f, -2.2f}, {}, KS_CRESCENT, {"Every second Crescent Cut in a row is a crescent"}},
         }},
        {"demolitionist", "Demolitionist", "mercenary", "Naphtha, heavy bolts and a steady hand with a fuse: the crowd is the target", 0xE07A2A,
         {
             {"Demolitionist", false, -1, {0, 0}, {}, 0, {}},
             {"Naphtha", false, 0, {-1.6f, 1.0f}, {M(S_DAMAGE, MK_INC, 10, T_GRENADE)}, 0, {"10% increased Grenade Damage"}},
             {"Double Charge", true, 1, {-2.8f, 2.2f}, {}, KS_TWO_POTS, {"Naffata throws a second pot beside the first"}},
             {"Wide Burst", false, 0, {0, 1.4f}, {M(S_AREA, MK_INC, 8)}, 0, {"8% increased Area of Effect"}},
             {"Clinging Fire", true, 3, {0, 2.9f}, {M(S_IGNITE, MK_FLAT, 30, T_GRENADE), M(S_AREA, MK_INC, 10, T_GRENADE)}, 0,
              {"+30% chance to Ignite with Grenades", "10% increased Area of Effect of Grenades"}},
             {"Bolt Case", false, 0, {1.6f, 1.0f}, {M(S_DAMAGE, MK_INC, 12, T_CROSSBOW)}, 0, {"12% increased Damage with Crossbows"}},
             {"Heavy Quarrels", true, 5, {2.8f, 2.2f}, {M(S_PIERCE, MK_FLAT, 1), M(S_DAMAGE, MK_INC, 20, T_CROSSBOW)}, 0,
              {"Projectiles Pierce 1 more enemy", "20% increased Damage with Crossbows"}},
             {"Sapper's Hands", false, 0, {1.6f, -1.0f}, {M(S_ATTACK_SPEED, MK_INC, 6)}, 0, {"6% increased Attack Speed"}},
             {"Chain Reaction", true, 7, {2.8f, -2.2f}, {}, KS_CHAIN_BURST,
              {"Enemies killed by your Grenades burst, dealing 15% of their", "maximum Life as Fire Damage to enemies nearby"}},
             {"Leather Apron", false, 0, {0, -1.4f}, {M(S_LIFE, MK_FLAT, 15), M(S_FIRE_RES, MK_FLAT, 10)}, 0,
              {"+15 to maximum Life", "+10% to Fire Resistance"}},
             {"Blast Shield", true, 9, {0, -2.9f}, {M(S_FIRE_RES, MK_FLAT, 20), M(S_ARMOUR, MK_INC, 25)}, 0,
              {"+20% to Fire Resistance", "25% increased Armour"}},
             {"Quick Fuse", false, 0, {-1.6f, -1.0f}, {M(S_COOLDOWN_RECOVERY, MK_INC, 15, T_GRENADE)}, 0,
              {"15% increased Cooldown Recovery Rate of Grenades"}},
             {"Bandolier", true, 11, {-2.8f, -2.2f}, {M(S_COOLDOWN_RECOVERY, MK_INC, 30, T_GRENADE), M(S_DAMAGE, MK_MORE, 15, T_GRENADE)}, 0,
              {"30% increased Cooldown Recovery Rate of Grenades", "Grenades deal 15% more Damage"}},
         }},
    };
    return a;
}

const Ascendancy* ascendancy_for(const std::string& cls) {
    for (auto& a : ascendancies()) if (cls == a.cls) return &a;
    return nullptr;
}

std::vector<int> ascendancies_of(const std::string& cls) {
    std::vector<int> v;
    auto& a = ascendancies();
    for (size_t i = 0; i < a.size(); i++) if (cls == a[i].cls) v.push_back(int(i));
    return v;
}

const Ascendancy* ascendancy_of(const std::string& cls, int chosen) {
    auto& a = ascendancies();
    if (chosen >= 0 && chosen < int(a.size()) && cls == a[size_t(chosen)].cls) return &a[size_t(chosen)];
    std::vector<int> v = ascendancies_of(cls);
    return v.size() == 1 ? &a[size_t(v[0])] : nullptr;
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

void asc_apply(const Ascendancy& a, uint32_t held, Stats& s, uint64_t& rules) {
    for (size_t i = 1; i < a.nodes.size(); i++) {
        if (!(held >> i & 1)) continue;
        for (Mod m : a.nodes[i].mods) { m.source = uint16_t(SRC_ASC + i); s.add(m); }
        rules |= a.nodes[i].rule;
    }
}

int asc_spent(uint32_t held) { return __builtin_popcount(held & ~1u); }

}  // namespace q
