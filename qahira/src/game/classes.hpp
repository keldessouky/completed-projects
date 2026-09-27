// Classes (GDD §4): plain PoE archetypes at points on the attribute wheel. A class sets your start in the sky, your
// base attributes, the gear and Talismans you begin with, and the model you wear.
#pragma once
#include <string>
#include <vector>

namespace q {

struct ClassDef {
    const char* id;
    const char* name;           // "The Warrior"
    const char* model;          // character mesh, skeleton and clips
    const char* weapon;         // starting weapon base
    const char* attr;           // "Strength"
    float str, dex, intel;
    float life, mana, es, armour;
    const char* kit[4];         // starting Talismans, in bar order
    const char* blurb;
    bool playable;              // arrives in this build
    float evasion = 0;          // base Evasion Rating
};

const std::vector<ClassDef>& class_defs();
const ClassDef& class_def(const std::string& id);   // the Warrior if unknown

}  // namespace q
