#include "game/acts.hpp"

namespace q {

#define SITE_TINT(r, g, b) {r, g, b}

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
         "qutrub_alpha", "The Qutrub of the Quarries is dead. Act I is over", "nile_bank", "cache", "", false, -1, {0.9f, 0.95f, 1.1f}},
        // Slice 5: the sites of the Map of al-Idrisi (act 0: the endgame; no waypoints; the chart sets the level)
#define SITE(id, name, sub, tiles, tier, w, h, br, mus, amb, s1, w1, s2, w2, s3, w3, elite, boss, tint)                          \
        {"site_" id, name, sub, tiles, 0, 13 + tier, w, h, br, mus, amb, {{s1, w1}, {s2, w2}, {s3, w3}}, elite, boss,       \
         "The site's master falls. The chart is complete", "", "cache", "", false, -1, tint}
        SITE("iskandariya", "al-Iskandariya", "The lighthouse city, where the sea wind never rests", "muizz", 1, 3, 5, 2, "mus_muizz",
             "amb_street", "nasnas", 5, "ghoul", 5, "silah", 3, "nasnas", "nasnas_kabir", SITE_TINT(1.0f, 1.0f, 1.1f)),
        SITE("dimyat", "Dimyat", "The river's mouth, and its chains across the water", "khan", 1, 4, 4, 2, "mus_khan", "amb_street",
             "silah", 4, "cable_jinn", 5, "ghoul", 5, "silah", "silah_sadat", SITE_TINT(1.05f, 1.0f, 0.9f)),
        SITE("tinnis", "Tinnis", "An island of weavers in the lake", "downtown", 1, 3, 4, 2, "mus_downtown", "amb_street",
             "cable_jinn", 6, "dish_sentinel", 2, "ghoul", 5, "cable_jinn", "microbus_jinn", SITE_TINT(1.0f, 0.9f, 1.1f)),
        SITE("qus", "Qus", "Where the pilgrims' road leaves the Nile", "necro", 1, 4, 5, 3, "mus_saba", "amb_necro",
             "ghoul", 8, "ghoul_spitter", 3, "ghoul_bruiser", 2, "ghoul_bruiser", "umm_al_ghula", SITE_TINT(1.0f, 0.95f, 1.05f)),
        SITE("aswan", "Aswan", "The first cataract, and the granite of the kings", "mokattam", 2, 4, 5, 2, "mus_mokattam", "amb_cliffs",
             "qutrub", 5, "sand_jinn", 5, "ghoul", 3, "qutrub", "qutrub_alpha", SITE_TINT(1.1f, 0.95f, 0.85f)),
        SITE("wahat", "al-Wahat", "The Oases, green islands in the sand sea", "mokattam", 2, 3, 6, 2, "mus_mokattam", "amb_cliffs",
             "sand_jinn", 7, "nasnas", 4, "qutrub", 2, "sand_jinn", "ifrit_zuweila", SITE_TINT(1.15f, 1.0f, 0.8f)),
        SITE("barqa", "Barqa", "Red earth, and the road west", "muizz", 2, 4, 4, 3, "mus_muizz", "amb_street",
             "sand_jinn", 4, "nasnas", 5, "silah", 3, "nasnas", "nasnas_kabir", SITE_TINT(1.15f, 0.9f, 0.8f)),
        SITE("tur", "al-Tur", "The harbour below the mountain of Sinai", "mokattam", 2, 3, 5, 2, "mus_mokattam", "amb_cliffs",
             "qutrub", 5, "sand_jinn", 4, "silah", 3, "qutrub", "qutrub_alpha", SITE_TINT(1.0f, 0.95f, 0.95f)),
        SITE("atrabulus", "Atrabulus", "Tripoli of the West, walls to the sea", "khan", 3, 4, 5, 3, "mus_khan", "amb_street",
             "silah", 5, "cable_jinn", 4, "nasnas", 4, "silah", "silah_sadat", SITE_TINT(1.0f, 1.0f, 1.0f)),
        SITE("qayrawan", "al-Qayrawan", "The caravan city, and its great cisterns", "muizz", 3, 4, 5, 3, "mus_muizz", "amb_street",
             "sand_jinn", 5, "nasnas", 4, "ghoul_bruiser", 2, "sand_jinn", "ifrit_zuweila", SITE_TINT(1.1f, 0.95f, 0.85f)),
        SITE("mahdiya", "al-Mahdiya", "A fortress on a finger of rock", "gate", 3, 2, 6, 2, "mus_trial", "amb_necro",
             "ghoul", 4, "nasnas", 4, "cable_jinn", 4, "ghoul_bruiser", "ifrit_zuweila", SITE_TINT(1.1f, 0.85f, 0.8f)),
        SITE("ayla", "Ayla", "The port at the head of the gulf", "downtown", 3, 4, 4, 3, "mus_downtown", "amb_street",
             "cable_jinn", 5, "dish_sentinel", 3, "sand_jinn", 3, "cable_jinn", "microbus_jinn", SITE_TINT(1.0f, 0.95f, 1.0f)),
        SITE("tunis", "Tunis", "The lake, the olive groves, the white houses", "khan", 4, 4, 5, 3, "mus_khan", "amb_street",
             "nasnas", 5, "silah", 4, "ghoul", 4, "nasnas", "nasnas_kabir", SITE_TINT(1.0f, 1.0f, 1.05f)),
        SITE("balarm", "Balarm", "King Roger's court, where the map was drawn", "muizz", 4, 4, 6, 3, "mus_muizz", "amb_street",
             "silah", 5, "nasnas", 4, "qutrub", 3, "silah", "silah_sadat", SITE_TINT(1.0f, 0.95f, 1.1f)),
        SITE("fas", "Fas", "A city of a thousand lanes", "necro", 4, 5, 5, 3, "mus_saba", "amb_necro",
             "ghoul", 6, "ghoul_spitter", 3, "sand_jinn", 3, "ghoul_bruiser", "umm_al_ghula", SITE_TINT(1.05f, 0.95f, 1.0f)),
        SITE("sabta", "Sabta", "The strait, and the edge of the known sea", "gate", 4, 3, 6, 2, "mus_trial", "amb_cliffs",
             "qutrub", 5, "sand_jinn", 4, "nasnas", 3, "qutrub", "qutrub_alpha", SITE_TINT(0.95f, 0.95f, 1.1f)),
#undef SITE
        // Act II (Slice 6): the Nile to Luxor
        {"nile_bank", "The River Road", "The feluccas rot at their moorings, and the river is listening", "nile", 2, 14, 3, 6, 2,
         "mus_nile", "amb_river", {{"marid", 6}, {"ghoul", 4}, {"sand_jinn", 2}}, "marid",
         "", "", "village", "poster", "", false, -1, {0.85f, 0.95f, 1.12f}},
        {"village", "Kafr al-Nakhl", "A village of palms, and every door shut against the river", "village", 2, 16, 4, 5, 3,
         "mus_village", "amb_cliffs", {{"silah", 4}, {"qutrub", 3}, {"marid", 3}, {"nasnas", 3}}, "silah",
         "", "", "canal", "cache", "", false, -1, {1.05f, 0.95f, 0.9f}},
        {"canal", "The Ibrahimiya Canal", "Someone is calling your name from the water", "nile", 2, 18, 3, 6, 2,
         "mus_nile", "amb_river", {{"marid", 6}, {"marid_caller", 3}, {"silah", 2}}, "marid_caller",
         "naddaha", "El Naddaha sinks, and the canal is only water again", "karnak", "cache", "", false, -1, {0.8f, 0.95f, 1.15f}},
        {"karnak", "Karnak, the Hypostyle Hall", "A forest of stone, and the statues have turned their heads", "karnak", 2, 21, 4, 5, 3,
         "mus_karnak", "amb_temple", {{"timthal", 4}, {"sand_jinn", 4}, {"marid_caller", 3}}, "timthal",
         "ram_sphinx", "The Ram of the Avenue lies down again", "valley", "poster", "", false, -1, {1.05f, 0.95f, 0.95f}},
        {"valley", "The Valley of the Kings", "The diggers left their lamps burning when they ran", "valley", 2, 23, 4, 6, 3,
         "mus_karnak", "amb_temple", {{"tomb_ghoul", 6}, {"sand_jinn", 3}, {"timthal", 2}, {"qutrub", 2}}, "timthal",
         "", "", "tomb", "cache", "", false, -1, {1.1f, 1.0f, 0.9f}},
        {"tomb", "The Deep Tomb", "Below the painted stars, something older than the kings", "tomb", 2, 25, 3, 6, 2,
         "mus_tomb", "amb_tomb", {{"tomb_ghoul", 5}, {"marid", 4}, {"timthal", 2}}, "marid",
         "marid_tomb", "The marid is still. Below it, something vast turns over", "", "cache", "", false, -1, {0.9f, 0.9f, 1.1f}},
        // the endgame's Marid Rifts: a Rift Seal opens the Rift Lord's court (act 0, like a site, at the Fourth Clime's level)
        {"rift_court", "The Rift Lord's Court", "Water stands up in the dark like walls", "tomb", 0, 18, 2, 4, 1,
         "mus_tomb", "amb_river", {{"marid", 5}, {"marid_caller", 3}, {"tomb_ghoul", 2}}, "marid",
         "rift_lord", "The Rift Lord is unmade, and the court drains away", "", "cache", "", false, -1, {0.7f, 0.9f, 1.2f}},
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
        {Q_NADDAHA, "The Caller", "Something in the Ibrahimiya Canal calls the villagers by name. Silence it.", 1, 0},
        {Q_RAM, "The Avenue of Rams", "The statues of Karnak have woken. Lay the Ram of the Avenue down.", 1, 0},
        {Q_MARID, "The Deep Tomb", "Follow the river's jinn under the Valley of the Kings, to the tomb that has no king.", 1, 0},
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
