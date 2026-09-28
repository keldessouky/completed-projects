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
         "marid_tomb", "The marid is still. Below it, something vast turns over", "farafra", "cache", "", false, -1, {0.9f, 0.9f, 1.1f}},
        // the endgame's Marid Rifts: a Rift Seal opens the Rift Lord's court (act 0, like a site, at the Fourth Clime's level)
        {"rift_court", "The Rift Lord's Court", "Water stands up in the dark like walls", "tomb", 0, 18, 2, 4, 1,
         "mus_tomb", "amb_river", {{"marid", 5}, {"marid_caller", 3}, {"tomb_ghoul", 2}}, "marid",
         "rift_lord", "The Rift Lord is unmade, and the court drains away", "", "cache", "", false, -1, {0.7f, 0.9f, 1.2f}},
        // Act III (Slice 7): the Western Desert
        {"farafra", "The White Desert", "Chalk towers in the moonlight, and the salt remembers the sea", "white", 3, 26, 4, 5, 3,
         "mus_desert", "amb_desert", {{"salt_jinn", 6}, {"desert_ghoul", 4}, {"hyena", 2}}, "salt_jinn",
         "", "", "sand_sea", "poster", "", false, -1, {0.95f, 1.0f, 1.12f}},
        {"sand_sea", "The Great Sand Sea", "The dunes sing at night. Something laughs back", "dunes", 3, 28, 3, 6, 2,
         "mus_desert", "amb_desert", {{"hyena", 5}, {"desert_ghoul", 4}, {"sand_jinn", 3}, {"sand_shade", 2}}, "hyena",
         "dab_a", "The hyena's eyes go dark, and you are your own again", "siwa", "cache", "", false, -1, {1.15f, 0.98f, 0.82f}},
        {"siwa", "Siwa", "The springs still run under the palms; nobody draws from them", "siwa", 3, 30, 4, 5, 3,
         "mus_siwa", "amb_desert", {{"desert_ghoul", 5}, {"sand_shade", 3}, {"salt_jinn", 3}}, "sand_shade",
         "", "", "shali", "cache", "bab_futuh", false, -1, {1.0f, 1.05f, 0.95f}},
        {"bab_futuh", "Bab al-Futuh", "The Second Trial. The gate of Conquests stands in the sand, and takes your body armour", "futuh", 3,
         32, 1, 5, 0, "mus_trial", "amb_desert", {{"iron_guard", 4}, {"salt_jinn", 3}, {"sand_jinn", 3}}, "iron_guard",
         "iron_mamluk", "The Iron Mamluk kneels, and the gate is only stone", "", "cache", "", true, 2 /* EQ_BODY */, {1.15f, 0.9f, 0.8f}},
        {"shali", "Shali", "The old town of salt and mud, melting in a rain that never came", "siwa", 3, 33, 4, 6, 3,
         "mus_siwa", "amb_desert", {{"desert_ghoul", 5}, {"hyena", 3}, {"sand_shade", 3}, {"salt_jinn", 2}}, "hyena",
         "", "", "oracle", "poster", "", false, -1, {1.1f, 0.92f, 0.85f}},
        {"oracle", "The Hill of the Oracle", "The oracle answered kings here. Tonight the wind answers", "siwa", 3, 35, 3, 6, 2,
         "mus_desert", "amb_desert", {{"sand_shade", 4}, {"desert_ghoul", 4}, {"salt_jinn", 3}, {"iron_guard", 1}}, "sand_shade",
         "sand_wraith", "The Sand-Wraith scatters on the wind. Act III is over", "ghadames", "cache", "", false, -1, {0.85f, 0.9f, 1.15f}},
        // Act IV (Slice 8): the Maghreb Coast
        {"ghadames", "Ghadames, the Covered City", "Lanes roofed against the sun, and something walking on the roofs", "ghadames", 4, 36, 4, 5, 3,
         "mus_maghreb", "amb_desert", {{"souq_silah", 4}, {"desert_ghoul", 4}, {"sand_shade", 3}}, "souq_silah",
         "", "", "chott", "poster", "", false, -1, {1.1f, 1.0f, 0.88f}},
        {"chott", "Chott el-Djerid", "A dry sea of salt, and on the horizon water that is not there", "chott", 4, 38, 3, 6, 2,
         "mus_maghreb", "amb_salt", {{"salt_ghoul", 5}, {"mirage", 4}, {"salt_jinn", 2}}, "salt_ghoul",
         "sarab", "The mirage breaks, and the salt is only salt", "tozeur", "cache", "", false, -1, {1.0f, 1.02f, 1.12f}},
        {"tozeur", "Tozeur", "Patterned brick in every wall, and the palm groves full of whispering", "tozeur", 4, 40, 4, 5, 3,
         "mus_maghreb", "amb_desert", {{"souq_silah", 4}, {"hyena", 3}, {"mirage", 3}, {"desert_ghoul", 3}}, "hyena",
         "", "", "medina", "cache", "", false, -1, {1.12f, 0.98f, 0.85f}},
        {"medina", "The Medina of Tunis", "Green doors in white walls; one of the doors has left its wall", "medina", 4, 42, 4, 6, 3,
         "mus_medina", "amb_street", {{"souq_silah", 5}, {"nasnas", 3}, {"salt_ghoul", 2}, {"iron_guard", 2}}, "iron_guard",
         "iron_door", "The Iron Door falls flat, and the medina is quiet", "souq", "cache", "", false, -1, {1.0f, 1.0f, 1.08f}},
        {"souq", "The Souq of the Chechia-Makers", "Red felt caps on every hook, and nobody to sell them", "medina", 4, 44, 3, 6, 2,
         "mus_medina", "amb_street", {{"souq_silah", 5}, {"nasnas", 4}, {"mirage", 2}}, "souq_silah",
         "", "", "sebkha", "poster", "", false, -1, {1.08f, 0.9f, 0.9f}},
        {"sebkha", "The Sebkha of Sijoumi", "The salt lake under the city, where the flamingos will not land", "chott", 4, 46, 3, 6, 2,
         "mus_maghreb", "amb_salt", {{"salt_ghoul", 6}, {"mirage", 3}, {"salt_jinn", 2}}, "salt_ghoul",
         "ghula_salt", "The Ghula of the Salt crumbles into brine. Act IV is over", "fes", "cache", "", false, -1, {0.95f, 1.0f, 1.15f}},
        // Act V (Slice 9): the Atlas and the Strait
        {"fes", "The Tanneries of Fes", "The dye pits steam in the dark, and the hides on the roofs are moving", "fes", 5, 46, 4, 5, 3,
         "mus_atlas", "amb_street", {{"dye_ghoul", 5}, {"blue_nasnas", 3}, {"desert_ghoul", 2}}, "dye_ghoul",
         "", "", "fes_bali", "poster", "", false, -1, {1.1f, 0.96f, 0.86f}},
        {"fes_bali", "Fes el-Bali", "Nine thousand lanes, and every door bolted from the inside", "fes", 5, 48, 3, 6, 3,
         "mus_atlas", "amb_street", {{"dye_ghoul", 4}, {"blue_nasnas", 4}, {"smoke_jinn", 2}}, "dye_ghoul",
         "", "", "chaouen", "cache", "", false, -1, {1.05f, 0.95f, 0.9f}},
        {"chaouen", "Chefchaouen, the Blue City", "Every wall is blue, and everyone in it is asleep, and choking", "chaouen", 5, 50, 4, 5, 3,
         "mus_atlas", "amb_street", {{"blue_nasnas", 5}, {"dye_ghoul", 3}, {"sea_marid", 2}}, "blue_nasnas",
         "bu_ghettat", "Bu Ghettat lets go, and the Blue City breathes", "jemaa", "cache", "", false, -1, {0.85f, 0.95f, 1.2f}},
        {"jemaa", "Jemaa el-Fnaa at Night", "The grills are still burning, and there is no one at them", "jemaa", 5, 52, 4, 6, 3,
         "mus_jemaa", "amb_market", {{"smoke_jinn", 5}, {"dye_ghoul", 3}, {"blue_nasnas", 3}}, "smoke_jinn",
         "dukhan", "Dukhan blows away on the night wind", "tangier", "poster", "bab_nasr", false, -1, {1.15f, 0.9f, 0.8f}},
        {"bab_nasr", "Bab al-Nasr", "The Third Trial. The Gate of Victory stands in the square, and takes your gloves", "futuh", 5,
         53, 1, 5, 0, "mus_trial", "amb_market", {{"nasr_guard", 4}, {"smoke_jinn", 3}, {"dye_ghoul", 3}}, "nasr_guard",
         "bronze_mamluk", "The Bronze Mamluk kneels, and the gate is only stone", "", "cache", "", true, 3 /* EQ_GLOVES */,
         {1.2f, 0.95f, 0.75f}},
        {"tangier", "The Kasbah of Tangier", "White walls over the Strait, and the sea is calling someone by name", "tangier", 5, 54, 4, 5, 3,
         "mus_strait", "amb_sea", {{"sea_marid", 5}, {"blue_nasnas", 3}, {"smoke_jinn", 2}}, "sea_marid",
         "", "", "strait", "cache", "", false, -1, {0.9f, 0.98f, 1.15f}},
        {"strait", "The Sea Walls of the Strait", "The rocks below the walls, and a woman standing in the surf", "tangier", 5, 56, 3, 6, 2,
         "mus_strait", "amb_sea", {{"sea_marid", 5}, {"nasr_guard", 1}, {"blue_nasnas", 3}}, "sea_marid",
         "qandisha", "Aisha Qandisha goes down into the sea. Act V is over", "", "cache", "", false, -1, {0.82f, 0.95f, 1.2f}},
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
        {Q_DABA, "The Hyena's Gaze", "Travellers on the Sand Sea walk off after something that laughs. Find it before you follow.", 1, 0},
        {Q_TRIAL2, "The Second Trial", "Pay the toll at Bab al-Futuh and bring its Iron Mamluk to its knees.", 0, 2},
        {Q_WRAITH, "The Oracle's Silence", "Climb the hill at Siwa where the oracle spoke, and silence what speaks there now.", 1, 0},
        {Q_SARAB, "The Mirage", "Travellers on the Chott walk out toward water that is not there. Find what shows it to them.", 1, 0},
        {Q_DOOR, "The Iron Door", "A door of the Tunis medina has torn itself from its wall. Put it down.", 1, 0},
        {Q_SALT, "The Ghula of the Salt", "Something crusted white has risen from the sebkha under the city. Lay it to rest.", 1, 0},
        {Q_PRESSER, "The Presser", "In Chefchaouen the sleepers wake choking. Find what sits on their chests.", 1, 0},
        {Q_TRIAL3, "The Third Trial", "Pay the toll at Bab al-Nasr and bring its Bronze Mamluk to its knees.", 0, 2},
        {Q_SMOKE, "The Smoke of the Stalls", "The night market's fires burn with a will of their own. Put out the one that leads them.", 1, 0},
        {Q_QANDISHA, "Aisha Qandisha", "Sailors on the Strait walk into the sea after a woman on the rocks. Meet her before the next one does.",
         1, 0},
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
