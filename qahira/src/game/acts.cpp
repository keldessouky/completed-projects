#include "game/acts.hpp"

namespace q {

// Append only: the character file stores which zones' waypoints you have, by index.
const std::vector<ZoneDef>& zone_defs() {
    static const std::vector<ZoneDef> d = {
        {"necropolis", "The City of the Dead", "Something old is waking between the tombs", "necro", 1, 10, 4, 6, 3,
         "mus_saba", "amb_necro", {{"ghoul", 10}, {"ghoul_spitter", 3}, {"ghoul_bruiser", 2}}, "ghoul_bruiser",
         "umm_al_ghula", "Umm al-Ghula is laid to rest", "mokattam", "cache", "", false, -1, {1.0f, 0.9f, 1.1f}},
        {"downtown", "Wust el-Balad", "The neon still burns; the traffic does not", "downtown", 1, 2, 3, 4, 2,
         "mus_downtown", "amb_street", {{"ghoul", 8}, {"cable_jinn", 5}, {"dish_sentinel", 2}}, "cable_jinn",
         "microbus_jinn", "The microbus stops for good", "metro", "poster", "", false, -1, {1.1f, 0.85f, 1.0f}},
        {"metro", "The Metro under Tahrir", "The last train never left Sadat Station", "metro", 1, 4, 3, 5, 2,
         "mus_metro", "amb_metro", {{"silah", 5}, {"ghoul", 6}, {"cable_jinn", 4}}, "silah",
         "silah_sadat", "The shape-shifter of Sadat Station is still", "khan", "cache", "", false, -1, {0.8f, 1.0f, 1.0f}},
        {"khan", "Khan el-Khalili", "Brass and spice and something moving in the lanterns", "khan", 1, 5, 4, 4, 3,
         "mus_khan", "amb_street", {{"ghoul", 6}, {"nasnas", 5}, {"ghoul_spitter", 2}}, "nasnas",
         "", "", "muizz", "bench", "", false, -1, {1.1f, 0.95f, 0.85f}},
        {"muizz", "al-Muizz Street", "A thousand years of stone, and the gate at its end", "muizz", 1, 7, 3, 6, 3,
         "mus_muizz", "amb_street", {{"nasnas", 5}, {"ghoul", 5}, {"qutrub", 2}, {"ghoul_bruiser", 2}}, "qutrub",
         "nasnas_kabir", "al-Nasnas al-Kabir falls in half again", "necropolis", "cache", "bab_zuweila", false, -1, {1.05f, 0.95f, 0.9f}},
        {"bab_zuweila", "Bab Zuweila", "The First Trial. The gatekeeper takes your amulet as the toll", "gate", 1, 8, 1, 5, 0,
         "mus_trial", "amb_necro", {{"ghoul", 4}, {"nasnas", 3}, {"cable_jinn", 3}}, "ghoul_bruiser",
         "ifrit_zuweila", "The ifrit of Bab Zuweila is bound again", "", "cache", "", true, 6 /* EQ_AMULET */, {1.2f, 0.8f, 0.7f}},
        {"mokattam", "The Mokattam Cliffs", "Above the city, the quarries howl", "mokattam", 1, 12, 4, 5, 3,
         "mus_mokattam", "amb_cliffs", {{"qutrub", 6}, {"ghoul", 5}, {"ghoul_spitter", 2}}, "qutrub",
         "qutrub_alpha", "The Qutrub of the Quarries is dead. Act I is over", "", "cache", "", false, -1, {0.9f, 0.95f, 1.1f}},
    };
    return d;
}

int find_zone(const std::string& id) {
    auto& d = zone_defs();
    for (size_t i = 0; i < d.size(); i++) if (id == d[i].id) return int(i);
    return -1;
}

const ZoneDef& zone_def(int i) { return zone_defs()[size_t(i >= 0 && i < int(zone_defs().size()) ? i : 0)]; }

const std::vector<QuestDef>& quest_defs() {
    static const std::vector<QuestDef> d = {
        {Q_MICROBUS, "The Iron Microbus", "Stop the possessed microbus that circles the square in Wust el-Balad.", 0, 0},
        {Q_SILAH, "Sadat Station", "Find what wears the faces of the passengers under Tahrir.", 1, 0},
        {Q_BENCH, "The Coppersmith", "Find Usta Hassan's workshop in Khan el-Khalili.", 0, 0},
        {Q_NASNAS, "Half a Man", "Put down al-Nasnas al-Kabir on al-Muizz Street.", 0, 0},
        {Q_TRIAL1, "The First Trial", "Pay the toll at Bab Zuweila and bind its ifrit.", 0, 2},
        {Q_GHULA, "Mother of the Ghouls", "Lay Umm al-Ghula to rest in the City of the Dead.", 1, 0},
        {Q_QUTRUB, "The Quarries", "Kill the Qutrub of the Quarries on the Mokattam cliffs.", 1, 0},
    };
    return d;
}

int quest_passive_points(uint32_t q) {
    int n = 0;
    for (auto& d : quest_defs()) if (q & d.bit) n += d.passive_points;
    return n;
}

int quest_asc_points(uint32_t q) {
    int n = 0;
    for (auto& d : quest_defs()) if (q & d.bit) n += d.asc_points;
    return n;
}

}  // namespace q
