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
        {"templar", "The Templar", "templar", "lantern_sceptre", "Strength and Intelligence", 23, 14, 23, 56, 50, 10, 20,
         {"ember_strike", "beacon", "signal_fire", "brazier_slam"},
         "A lantern on an iron staff, and fire in everything it strikes. Hold up the beacon, plant a brazier, and let the "
         "ground burn under them.", true},
        {"ranger", "The Ranger", "ranger", "reed_bow", "Dexterity", 14, 32, 14, 54, 46, 0, 0,
         {"split_arrow", "falcons_mark", "rain_of_arrows", "scorpion_sting"},
         "Bows and marks, poison and evasion. Mark the strongest, rain on the rest.", true, 60},
        {"mercenary", "The Mercenary", "mercenary", "guard_sword", "Strength and Dexterity", 23, 23, 14, 58, 42, 0, 20,
         {"crescent_cut", "riposte", "naffata", "quarrel"},
         "A sword in hand and a crossbow on the back. Cut them bleeding, then finish the wound; a pot of naphtha for the "
         "crowd.", true, 30, "light_crossbow"},
        {"shadow", "The Shadow", "shadow", "night_knife", "Dexterity and Intelligence", 14, 23, 23, 52, 52, 10, 0,
         {"viper_kiss", "snare_of_sparks", "black_sand", "whirling_staff"},
         "A dagger in hand and a quarterstaff on the back. Poison the one in front, snare the crowd, wither what is left.",
         true, 30, "ash_staff"},
        // Slice 10: the Wanderer begins at the Pole, a little of every road, once a character has finished the campaign
        {"wanderer", "The Wanderer", "wanderer", "travellers_staff", "All three", 20, 20, 20, 60, 50, 10, 30,
         {"whirling_staff", "arc", "rallying_shout", "falcons_mark"},
         "A courier of the long roads, with a staff and a little of every trade: a spell, a shout, a mark, and the staff to "
         "finish it. Begins at the Pole of the sky, with a road to every class.", true, 30},
    };
    return d;
}

const ClassDef& class_def(const std::string& id) {
    for (auto& c : class_defs()) if (id == c.id) return c;
    return class_defs()[0];
}

}  // namespace q
