#include "game/classes.hpp"

namespace q {

const std::vector<ClassDef>& class_defs() {
    static const std::vector<ClassDef> d = {
        {"warrior", "The Warrior", "warrior", "worn_maul", "Strength", 32, 14, 14, 62, 40, 0, 40,
         {"crushing_blow", "earthshatter", "rallying_shout", "aftershock"},
         "Heavy blows, cracked ground and warcries. Armour and Break.", true},
        {"sorcerer", "The Sorcerer", "sorcerer", "ashwood_staff", "Intelligence", 14, 14, 32, 48, 62, 22, 0,
         {"ember_bolt", "arc", "frost_glyph", "falling_star"},
         "Fire, cold and lightning. Chill and Shock them, then call down a star. Hirz and spell crits.", true},
        {"templar", "The Templar", "warrior", "worn_maul", "Strength and Intelligence", 23, 14, 23, 56, 50, 10, 20,
         {"", "", "", ""}, "Elemental melee, auras and totems.", false},
        {"ranger", "The Ranger", "warrior", "worn_maul", "Dexterity", 14, 32, 14, 54, 46, 0, 0,
         {"", "", "", ""}, "Bows and spears, evasion and flasks.", false},
        {"mercenary", "The Mercenary", "warrior", "worn_maul", "Strength and Dexterity", 23, 23, 14, 58, 42, 0, 20,
         {"", "", "", ""}, "Swords and crossbows, weapon swaps and bleeding.", false},
        {"shadow", "The Shadow", "warrior", "worn_maul", "Dexterity and Intelligence", 14, 23, 23, 52, 52, 10, 0,
         {"", "", "", ""}, "Daggers and quarterstaves, crits, poison and traps.", false},
    };
    return d;
}

const ClassDef& class_def(const std::string& id) {
    for (auto& c : class_defs()) if (id == c.id) return c;
    return class_defs()[0];
}

}  // namespace q
