#include "game/uniques.hpp"
#include <cmath>
#include <string>

namespace q {

// Every film is invented; so are the players. The years run through the cinema's golden age.
const std::vector<UniqueDef>& unique_defs() {
    static const std::vector<UniqueDef> d = {
        // ---- weapons
        {"doormans_knock", "Knock of the Iron Doorman", "worn_maul", "The Iron Doorman", "al-Bawwab al-Hadidi", 1953,
         "Hamdi Sabet · Nawal Fakhry", "No one gets past him. No one.", {0xB0402A, 0x1E2A3A},
         {{"phys_inc", 60, 80}, {"g_break", 30, 40}, {"str", 15, 20}, {"g_dmg_taken", 10, 10}},
         {"He opened the door once, in 1953.", "He has been closing it ever since."}},
        {"qadis_gavel", "The Qadi's Gavel", "brass_maul", "Verdict at Midnight", "Hukm fi Muntasaf al-Layl", 1949,
         "Fouad Kamel · Samira Adel", "The court is in session until dawn", {0x2A2440, 0xD4A84B},
         {{"phys_add", 8, 12, 18, 24}, {"speed", 10, 15}, {"g_crit_multi", 20, 30}, {"life_on_hit", 4, 6}},
         {"Order in the court."}},
        {"quarry_king", "Sledge of the Quarry King", "mokattam_sledge", "King of the Quarries", "Malik al-Mahagir", 1958,
         "Taher Mansour · Layla Mounir", "He split the mountain for her", {0xC8A060, 0x5A2A1A},
         {{"phys_inc", 90, 120}, {"g_slam_dmg", 25, 35}, {"g_area", 15, 20}, {"g_move_less", 5, 5}},
         {"The mountain remembers every blow."}},
        {"nile_boat_staff", "The Conductor's Staff", "ashwood_staff", "Song of the Nile Boat", "Ughniyat al-Markab", 1951,
         "Karim Zaki · Hoda Salem", "Music on the water, and one voice above it", {0x2A6A8A, 0xF2D2A0},
         {{"spell_dmg", 40, 60}, {"cast_speed", 10, 15}, {"g_skill_level", 1, 1}, {"g_mana_cost", 10, 15}},
         {"Every spell a downbeat."}},
        {"astrologers_staff", "The Astrologer's Last Staff", "astrolabe_staff", "The Night the Stars Fell", "Laylat Suqut al-Nujum", 1956,
         "Adel Ramzy · Wedad Nour", "He read the sky. The sky read him back.", {0x141C3A, 0x8AA8FF},
         {{"spell_crit", 60, 80}, {"g_crit_multi", 25, 35}, {"g_light_dmg", 30, 40}, {"g_shock", 20, 30}},
         {"The last reading was his own."}},
        // ---- helmets
        {"street_magician", "Cap of the Street Magician", "knit_cap", "The Magician of Clot Bey", "Sahir Clot Bey", 1950,
         "Mahmoud Shukry · Zeinab Hafez", "Now you see him...", {0x6A1A3A, 0xF2A541},
         {{"life", 30, 40}, {"int", 15, 20}, {"g_cdr", 10, 15}, {"g_mana_regen", 20, 30}},
         {"...now you do not."}},
        {"boxers_headguard", "The Boxer's Headguard", "riveted_cap", "Champion of Shubra", "Batal Shubra", 1955,
         "Anwar Fathy · Mona Ragab", "Twelve rounds against the whole city", {0xC02A2A, 0xEDE3D1},
         {{"armour_inc", 80, 100}, {"life", 40, 50}, {"g_break", 15, 20}, {"g_life_regen", 3, 5}},
         {"He never went down. Not once."}},
        {"seventh_daughter", "Veil of the Seventh Daughter", "linen_hood", "The Seventh Daughter", "al-Bint al-Sabi'a", 1948,
         "Nabila Ezzat · Omar Wahby", "Six sisters married. The seventh listened to the wind.", {0x3A5A7A, 0xD8E8F2},
         {{"es_add", 30, 40}, {"g_es_recharge", 30, 40}, {"g_cold_dmg", 20, 30}, {"g_freeze", 20, 25}},
         {"She heard the frost coming three nights early."}},
        // ---- body armour
        {"tram_driver", "Coat of the Night Tram Driver", "work_coat", "Last Tram to Heliopolis", "Akhir Tram li Masr al-Gadida", 1954,
         "Salah Nazmi · Aida Kamel", "Every stop is the wrong one", {0x2A4A3A, 0xE8C060},
         {{"armour_add", 60, 80}, {"life", 50, 60}, {"g_all_res", 8, 12}, {"g_move", 5, 5}},
         {"The last passenger never got off."}},
        {"gates_hold", "Breastplate of the Siege", "riveted_breastplate", "The Gates Hold", "al-Abwab Samida", 1957,
         "Ezzat Nabil · Sanaa Morsi", "A thousand years of stone, and one night", {0x5A3A2A, 0xD4A84B},
         {{"armour_inc", 120, 150}, {"g_life_pct", 8, 10}, {"g_warcry", 20, 30}, {"chaos_res", 15, 20}},
         {"The gate is still standing. So is he."}},
        {"sleepless_astronomer", "Robe of the Sleepless Astronomer", "astronomers_robe", "A Thousand Nights Awake", "Alf Layla Sahira", 1952,
         "Magdy Wahba · Shahira Nour", "She counted every star, twice", {0x1A1A3A, 0xC8B0F2},
         {{"es_inc", 100, 130}, {"int", 25, 30}, {"g_spell_dmg", 20, 25}, {"g_mana_pct", 10, 15}},
         {"The thousand-and-first night, she slept."}},
        // ---- gloves
        {"pickpocket", "The Pickpocket's Gloves", "wrapped_gloves", "The Thief of Attaba", "Harami al-Ataba", 1947,
         "Ismail Hamdy · Fikriya Salem", "Quick hands, a quicker smile", {0xE0B040, 0x3A2A4A},
         {{"g_attack_speed", 10, 14}, {"dex", 20, 25}, {"life_on_hit", 3, 5}, {"g_crit", 25, 35}},
         {"Your wallet was his before you felt the bump."}},
        {"glassblower", "Hands of the Glassblower", "silk_gloves", "Fire in the Glassworks", "Nar fil Masna'", 1959,
         "Hassan Yousry · Ferial Badr", "Where the glass glows, love burns", {0xE0602A, 0x2A1A14},
         {{"g_fire_dmg", 25, 35}, {"g_ignite", 10, 15}, {"g_cast_speed", 8, 10}, {"fire_res", 20, 25}},
         {"Never let the breath go cold."}},
        // ---- boots
        {"corniche_runner", "Boots of the Corniche Runner", "laced_boots", "The Runner of the Corniche", "Adda'a al-Corniche", 1956,
         "Sherif Qandil · Leila Ezz", "From Anfushi to Montaza before the sun", {0x2A8AB0, 0xF2E0B0},
         {{"move", 25, 30}, {"life", 30, 40}, {"g_flask", 20, 30}, {"light_res", 20, 25}},
         {"The sea wind never caught him."}},
        {"sleepwalker", "Slippers of the Sleepwalker", "felt_slippers", "She Walks at Night", "Tamshi fil Layl", 1953,
         "Doria Selim · Kamal Sherif", "Do not wake her. Do not follow her.", {0x4A2A6A, 0xB0A0D8},
         {{"move", 15, 20}, {"es_add", 20, 30}, {"g_es_recharge", 20, 30}, {"cold_res", 20, 30}},
         {"She has never once tripped on the stairs."}},
        // ---- belt
        {"bulaq_wrestler", "The Wrestler's Belt", "tooled_belt", "The Wrestler of Bulaq", "Musari' Bulaq", 1950,
         "Gamal Barakat · Sawsan Helmy", "The strongest man on the river", {0x8A2A1A, 0xE8C890},
         {{"str", 25, 30}, {"life", 40, 60}, {"g_armour", 80, 120}, {"g_break", 15, 20}},
         {"He lifted the ferry. Twice. For a bet."}},
        // ---- amulets
        {"balcony_voice", "The Singer's Pendant", "blue_bead_amulet", "The Voice from the Balcony", "Sawt min al-Balakona", 1951,
         "Aziza Nasr · Yehia Selim", "The whole street stopped to listen", {0x2A3A8A, 0xF2C0D0},
         {{"g_skill_level", 1, 1}, {"g_mana_regen", 30, 40}, {"g_all_res", 10, 15}, {"g_cdr", 8, 10}},
         {"The traffic stopped. The kettles stopped.", "The city listened."}},
        {"moon_zamalek", "Moon over Zamalek", "moonstone_amulet", "Moon over Zamalek", "Qamar Fawq al-Zamalek", 1955,
         "Medhat Ragab · Nahed Fakhry", "A houseboat, a promise, and a moon", {0x1A2A4A, 0xF2F2E0},
         {{"g_es", 40, 50}, {"ele_dmg", 20, 30}, {"int", 20, 25}, {"g_cold_dmg", 15, 20}},
         {"The river keeps what the moon lets fall."}},
        // ---- rings
        {"bridegroom", "The Bridegroom's Ring", "brass_ring", "The Wedding That Never Was", "al-Farah Illi Ma Hasalsh", 1949,
         "Ramzi Tawfiq · Safaa Galal", "The zaffa came. The groom did not.", {0xD4A84B, 0xB02A4A},
         {{"life", 30, 40}, {"fire_res", 25, 30}, {"life_on_hit", 3, 4}, {"g_gain_fire", 8, 12}},
         {"It still burns a little, to wear it."}},
        {"blue_scarab", "The Detective's Signet", "lapis_ring", "The Case of the Blue Scarab", "Qadiyat al-Ju'ran al-Azraq", 1958,
         "Hussein Sadek · Nermine Kamal", "Every clue leads to Khan el-Khalili", {0x1A4A8A, 0xE8D8A0},
         {{"g_crit", 30, 40}, {"g_crit_multi", 15, 20}, {"int", 10, 15}, {"cold_res", 25, 30}},
         {"The scarab was a fake. The ring is not."}},
    };
    return d;
}

const UniqueDef& unique_def(int i) { return unique_defs()[size_t(i >= 0 && i < int(unique_defs().size()) ? i : 0)]; }

int find_unique(const char* id) {
    auto& d = unique_defs();
    for (size_t i = 0; i < d.size(); i++) if (std::string(d[i].id) == id) return int(i);
    return -1;
}

static void roll_mods(Item& it, const UniqueDef& d, Rng& rng) {
    it.affixes.clear();
    for (auto& m : d.mods) {
        int a = find_affix(m.affix);
        if (a < 0) continue;
        Affix af{uint16_t(a), 2, std::round(rng.range(m.lo, m.hi)), std::round(rng.range(m.lo2, m.hi2))};
        it.affixes.push_back(af);
    }
}

Item make_unique(int u, int ilvl, Rng& rng) {
    const UniqueDef& d = unique_def(u);
    Item it;
    it.base = uint16_t(find_base(d.base));
    it.rarity = Rarity::Unique;
    it.ilvl = uint8_t(std::max(1, std::min(255, ilvl)));
    it.seed = rng.next();
    it.unique = uint16_t(u);
    it.name = d.name;
    roll_mods(it, d, rng);
    return it;
}

void reroll_unique(Item& it, Rng& rng) {
    const UniqueDef& d = unique_def(it.unique);
    std::vector<Affix> keep;
    for (auto& a : it.affixes) if (a.flags & (AF_CRAFTED | AF_IMPLICIT)) keep.push_back(a);
    roll_mods(it, d, rng);
    it.affixes.insert(it.affixes.end(), keep.begin(), keep.end());
}

int random_unique(int area_level, Rng& rng) {
    std::vector<int> pool;
    auto& d = unique_defs();
    for (size_t i = 0; i < d.size(); i++)
        if (item_bases()[size_t(find_base(d[i].base))].level <= area_level) pool.push_back(int(i));
    return pool.empty() ? -1 : pool[size_t(rng.irange(0, int(pool.size()) - 1))];
}

}  // namespace q
