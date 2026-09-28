// Ascendancy (GDD §5.3): each class's inner sky. The Trials of Ascendancy give its points (two per trial); a node is
// taken when its parent is held. Slice 4 brought one per class (the Warrior's Ironclad, the Sorcerer's Stormbinder);
// from Slice 6 a class can have two, and the character chooses one at the First Trial (Hero::ascendancy).
#pragma once
#include "core/math.hpp"
#include "game/stats.hpp"
#include <string>
#include <vector>

namespace q {

// the rules the simulation has to know about (Hero::keystones, alongside the tree's)
enum AscRule : uint64_t {
    KS_ENDURANCE = 1u << 8,    // gain an Endurance Charge on Break
    KS_UNSHAKEN = 1u << 9,     // no knockback; less damage taken at max charges
    KS_FOUNDRY = 1u << 10,     // slams: more damage to Broken enemies, +1 max charge
    KS_PLATE = 1u << 11,       // armour against elemental hits at half value
    KS_OATH = 1u << 12,        // life regeneration per Endurance Charge
    KS_IRON_CRY = 1u << 13,    // warcries grant Endurance Charges
    KS_BIND_COLD = 1u << 14,   // chilled and frozen enemies take more damage
    KS_STORM_EYE = 1u << 15,   // spell crits always Shock
    KS_WEAVER = 1u << 16,      // more Ignite damage
    // Slice 6: the Ranger's Marksman and Outrider
    KS_HAWK = 1u << 17,        // Marked enemies take more damage
    KS_LONG_SHOT = 1u << 18,   // projectile attacks: more damage the further the target
    KS_CRIT_FRENZY = 1u << 19, // critical strikes can grant Frenzy Charges
    KS_MARK_SPREAD = 1u << 20, // a Mark passes on when its bearer dies
    KS_VIPER = 1u << 21,       // poisons deal more and last longer
    KS_QIRBA = 1u << 22,       // flasks refill over time
    KS_KILL_FRENZY = 1u << 23, // kills can grant Frenzy Charges
    KS_PLAGUE = 1u << 24,      // a poisoned enemy's death spreads its poisons
    // Slice 7: the Mercenary's Duelist and Demolitionist
    KS_RIPOSTE = 1ull << 25,   // taking a hit readies Riposte
    KS_OPEN_WOUNDS = 1ull << 26,   // Bleeding enemies take more damage
    KS_SINGLE = 1ull << 27,    // more damage to Rare and Unique enemies
    KS_BLOOD_KILL = 1ull << 28,    // killing a Bleeding enemy recovers life
    KS_CRESCENT = 1ull << 29,  // every second Crescent Cut in a row is a crescent
    KS_TWO_POTS = 1ull << 30,  // Naffata throws a second pot
    KS_CHAIN_BURST = 1ull << 31,   // enemies killed by grenades burst
};

struct AscNode {
    const char* name;
    bool notable;
    int parent;                // -1: the start
    vec2 pos;                  // layout, in node units around the start
    std::vector<Mod> mods;
    uint64_t rule = 0;
    std::vector<const char*> text;
};

struct Ascendancy {
    const char* id;
    const char* name;
    const char* cls;
    const char* blurb;
    uint32_t color;
    std::vector<AscNode> nodes;   // append only: characters store held nodes as bits
};

const std::vector<Ascendancy>& ascendancies();
const Ascendancy* ascendancy_for(const std::string& cls);   // the class's first
std::vector<int> ascendancies_of(const std::string& cls);    // every ascendancy the class can take
// the character's: the one chosen, or the class's only one; null while a class with two has not chosen
const Ascendancy* ascendancy_of(const std::string& cls, int chosen);
int find_ascendancy(const std::string& id);
bool asc_can_take(const Ascendancy& a, uint32_t held, int node);
void asc_apply(const Ascendancy& a, uint32_t held, Stats& s, uint64_t& rules);   // mods sourced SRC_ASC + node
int asc_spent(uint32_t held);
constexpr uint16_t SRC_ASC = 500;
constexpr int kEnduranceMax = 3;

}  // namespace q
