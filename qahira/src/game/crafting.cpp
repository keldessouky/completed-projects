#include "game/crafting.hpp"
#include <cmath>

namespace q {

const std::vector<Recipe>& recipes() {
    static const std::vector<Recipe> r = {
        {"hale", "life", 0, 10, "Usta Hassan's own"},
        {"kiln", "fire_res", 0, 10, "Usta Hassan's own"},
        {"night_wind", "cold_res", 0, 10, "Usta Hassan's own"},
        {"storm", "light_res", 0, 12, "The cache under Tahrir"},
        {"bull", "str", 1, 18, "Khan el-Khalili"},
        {"scribe", "int", 1, 18, "Khan el-Khalili"},
        {"heavy", "phys_inc", 1, 30, "al-Nasnas al-Kabir"},
        {"scholars", "spell_dmg", 1, 30, "al-Nasnas al-Kabir"},
        {"skill", "speed", 1, 35, "The City of the Dead"},
        {"recitation", "cast_speed", 1, 35, "The City of the Dead"},
        {"road", "move", 1, 40, "The Mokattam cliffs"},
        {"riveted", "armour_inc", 1, 30, "The Bab Zuweila trial"},
        {"inscribed", "es_inc", 1, 30, "The Bab Zuweila trial"},
        {"hale_ii", "life", 2, 60, "The Qutrub of the Quarries"},
        {"grave", "chaos_res", 0, 25, "The Iron Microbus"},
        {"well", "mana_regen", 1, 20, "The Si'lah of Sadat Station"},
    };
    return r;
}

int find_recipe(const char* id) {
    auto& r = recipes();
    for (size_t i = 0; i < r.size(); i++) if (std::string(r[i].id) == id) return int(i);
    return -1;
}

Affix recipe_affix(int r) {
    const Recipe& rc = recipes()[size_t(r)];
    int a = find_affix(rc.affix);
    const AffixDef& d = affix_defs()[size_t(a)];
    int t = rc.tier;
    return Affix{uint16_t(a), uint8_t(t), std::round((d.lo[t] + d.hi[t]) * 0.5f), std::round((d.lo2[t] + d.hi2[t]) * 0.5f), AF_CRAFTED};
}

bool recipe_fits(int r, const Item& it, std::string* why) {
    auto no = [&](const char* m) { if (why) *why = m; return false; };
    if (it.empty()) return no("Choose an item");
    if (it.corrupted) return no("A corrupted item cannot go on the bench");
    if (it.rarity == Rarity::Unique) return no("Usta Hassan will not touch a unique");
    if (it.rarity == Rarity::Normal) return no("Only a magic or rare item takes a bench mod");
    if (it.has_crafted()) return no("This item already carries a bench mod");
    Affix a = recipe_affix(r);
    const AffixDef& d = affix_defs()[a.def];
    if (!(d.slots & (1u << uint32_t(it.b().slot)))) return no("That mod cannot go on this kind of item");
    for (auto& x : it.affixes) if (x.def == a.def) return no("The item already has that mod");
    int pre, suf;
    it.count_affixes(pre, suf);
    int limit = it.rarity == Rarity::Magic ? 1 : 3;
    if (d.prefix ? pre >= limit : suf >= limit) return no(d.prefix ? "No room for another prefix" : "No room for another suffix");
    return true;
}

bool apply_recipe(int r, Item& it, std::string* why) {
    if (!recipe_fits(r, it, why)) return false;
    it.affixes.push_back(recipe_affix(r));
    return true;
}

bool remove_crafted(Item& it, std::string* why) {
    if (!it.has_crafted()) { if (why) *why = "There is no bench mod to take off"; return false; }
    if (it.corrupted) { if (why) *why = "A corrupted item cannot go on the bench"; return false; }
    for (size_t i = 0; i < it.affixes.size();)
        if (it.affixes[i].flags & AF_CRAFTED) it.affixes.erase(it.affixes.begin() + long(i));
        else i++;
    return true;
}

int recipe_for_zone(const std::string& zone, bool boss) {
    struct M { const char* zone; const char* cache; const char* boss; };
    static const M m[] = {
        {"downtown", "", "grave"}, {"metro", "storm", "well"}, {"khan", "bull", ""}, {"muizz", "scribe", "heavy"},
        {"bab_zuweila", "riveted", "inscribed"}, {"necropolis", "skill", "recitation"}, {"mokattam", "road", "hale_ii"},
    };
    for (auto& e : m)
        if (zone == e.zone) return find_recipe(boss ? e.boss : e.cache);
    return -1;
}

const std::vector<CodexEntry>& codex_entries() {
    static const std::vector<CodexEntry> c = {
        {"ghouls", CX_MONSTER, "Ghouls of the City of the Dead",
         "Grave-eaters from the old tombs of the Qarafa. They come in packs, and the big ones hit hard: step out of the slam."},
        {"possessed", CX_MONSTER, "Possessed things",
         "Jinn who have climbed into the city's cables, dishes and machines. Watch the ground: their beams are drawn before they fire."},
        {"silah", CX_MONSTER, "Si'lah, the shape-shifters",
         "The oldest of the jinn tricksters, who wear the faces of the people they meet. They leap at you from far away."},
        {"nasnas", CX_MONSTER, "Nasnas, the half-men",
         "Half a man, split down the middle: one eye, one arm, one leg. They hop faster than you would think."},
        {"qutrub", CX_MONSTER, "Qutrub, the grave wolves",
         "Ghouls who went to the dogs. They hunt the quarries in packs and leap from the rocks."},
        {"ifrit", CX_MONSTER, "Ifrit, the fire jinn",
         "Smokeless fire given a body. Bound in the gates of old Cairo; some of the bindings are older than the gates."},
        {"waypoints", CX_MECHANIC, "Waypoints",
         "Every zone's entrance has one. Touch it once, and from any waypoint or the rooftop stair you can travel there again."},
        {"trial", CX_MECHANIC, "The Trials of Ascendancy",
         "At Bab Zuweila the gatekeeper takes a toll: one of your equipped items, held until you leave. Win, and you ascend: "
         "two points for your class's ascendancy."},
        {"bench", CX_MECHANIC, "The Coppersmith's Bench",
         "Usta Hassan's crafts are exact: a known mod at a known value, for dinars. One bench mod per item; he can take it off again. "
         "Recipes are found in the city."},
        {"blends", CX_MECHANIC, "Spice Blends",
         "Each Blend adds a mod of its family: fire, cold, lightning, life, casting or physical attacks. On a full magic item it makes "
         "the item rare to make room."},
        {"omens", CX_MECHANIC, "Coffee-Cup Omens",
         "Read the grounds in the cup and your next craft bends: the Bird gives a suffix, the Fish a prefix, the Closed Door spares "
         "bench mods, the Crescent keeps the Ember from unmaking an item."},
        {"ember", CX_MECHANIC, "The Ifrit's Ember",
         "Corruption: the item may be unchanged, may gain an implicit, may burn one mod brighter, or may be remade. Whatever happens, "
         "it can never be changed again."},
        {"posters", CX_MECHANIC, "Poster Scraps",
         "The city's old cinema posters were torn up and scattered. Four scraps make a poster, and a whole poster gives you what it shows."},
        {"ascendancy", CX_MECHANIC, "Ascendancy",
         "Your class's inner sky. Trials give its points; each node changes how your class plays."},
        // Slice 5
        {"charts", CX_MECHANIC, "The Map of al-Idrisi",
         "Al-Idrisi drew the world for King Roger in 1154, with south at the top. Run a chart of a Clime on a site of that Clime at "
         "the chart table; finish the site and its neighbours appear. Charts drop inside charts."},
        {"haboob", CX_MECHANIC, "The Haboob",
         "A wall of sand rolls across the site. Inside it you can hardly see, and the sand jinn come with it; the longer you stay in "
         "the storm and the more you kill there, the more it leaves behind when it passes."},
        {"astrolabe", CX_MECHANIC, "The Astrolabe",
         "Every site you finish gives a point for the Astrolabe, the map's own tree: more charts, higher Climes, deeper storms."},
        {"sand_jinn", CX_MONSTER, "Sand jinn of the Haboob", "They ride the storm wall and fall apart into sand when it has passed."},
        // Slice 6: the Ranger, and Act II
        {"marid", CX_MONSTER, "Marids of the river",
         "The strongest of the jinn, and the Nile's are the oldest. Their water is cold: keep your cold resistance up, and step out "
         "of the pools they open under you."},
        {"naddaha", CX_MONSTER, "El Naddaha, the Caller",
         "The woman in the canal who calls men by name in the voice of someone they love. When she calls, you go to her: be ready "
         "to roll away when you arrive."},
        {"statues", CX_MONSTER, "Possessed statues",
         "Karnak's kings and rams with a marid inside. Slow, heavy, and armoured: their slams are drawn on the ground first."},
        {"tomb_ghouls", CX_MONSTER, "Ghouls of the tombs",
         "The Valley's own grave-eaters, pale with the dust of the kings."},
        {"marks", CX_MECHANIC, "Marks, poison and Frenzy",
         "A Mark makes your next hits on its bearer Critical Strikes; when a Marked enemy dies you gain a Frenzy Charge, 4% more "
         "damage and speed each. Poison stacks: every poisoning hit adds its own."},
        {"rifts", CX_MECHANIC, "Marid Rifts",
         "After Act II, a chart may hold a tear in the air. Walk up to it and it opens, widening for twenty seconds while the "
         "river's marids come through. What dies in it leaves Marid Splinters; fifty make a Rift Seal, which opens the Rift "
         "Lord's court at the chart table."},
        {"evasion", CX_MECHANIC, "Evasion",
         "Evasion Rating gives a chance to take no damage at all from a hit, up to 75%. Deeper areas' monsters are more accurate. "
         "Pools and blasts cannot be evaded."},
        // Slice 7: the Mercenary, and Act III
        {"bleeding", CX_MECHANIC, "Bleeding and the weapon swap",
         "A Bleeding enemy loses 70% of the hit's physical damage over five seconds; a stronger bleed replaces a weaker. The "
         "Mercenary carries a second weapon on the back: a skill that needs it swaps it into hand, and the one before goes back."},
        {"hyenas", CX_MONSTER, "al-Dab', the hyenas",
         "The old stories say a hyena's gaze bewitches a traveller, who follows it laughing into its den. When she stares, you go "
         "to her: be ready to roll away when you arrive."},
        {"salt_jinn", CX_MONSTER, "Salt jinn of the White Desert",
         "Jinn of the dry sea bed, crusted white. Their armour is thick; break it with heavy hits."},
        {"desert_ghouls", CX_MONSTER, "Ghouls of the sands",
         "The ghoul was a creature of the desert before it came to the cities: it calls to travellers from the dark and waits."},
        {"wraith", CX_MONSTER, "Sand shades",
         "Hooded shapes of blown sand with two points of light inside. They throw burning sand from afar: keep your fire "
         "resistance up."},
        {"mamluk", CX_MONSTER, "The armour of Bab al-Futuh",
         "The gate's jinn wear the armour of the soldiers who once held it. Nothing is inside; the armour is very hard to hurt."},
        {"res_penalty", CX_MECHANIC, "The eclipse and your resistances",
         "Past Act III the eclipse weighs on everything: all your resistances are 30% lower. Keep them up with gear and the sky."},
        // Slice 8: the Shadow, and Act IV
        {"traps", CX_MECHANIC, "Traps, Wither and Power Charges",
         "A trap is thrown, lands and arms; it bursts when an enemy comes near. Chaos spells Wither: each stack, 6% more chaos "
         "damage taken, poison included. A quarterstaff's crits grant Power Charges, 40% increased Critical Strike Chance each."},
        {"salt_ghouls", CX_MONSTER, "Ghouls of the salt",
         "The ghouls of the Chott and the sebkha, crusted white where the brine dried on them. Their mother is older than the city."},
        {"mirage", CX_MONSTER, "Mirages",
         "Sarab: the jinn of the heat-shimmer, who shows travellers water on the horizon and walks them out onto the salt. They "
         "throw lightning from afar and are gone when you reach them."},
        {"zar", CX_MECHANIC, "Zar Nights",
         "After Act IV, a chart may hold a drum circle. Sit down at the drum and the Zar begins: the site's creatures come to the "
         "drums, every death near the circle feeds the rhythm, and the rhythm runs down on its own. Each time it fills, the circle "
         "falls into a trance and pays out. Play the song to its end for one more reward; let the rhythm fail and the night is over."},
        {"iron_door", CX_MONSTER, "The Iron Door",
         "One of the great studded doors of the medina, green and black under its arch, with a jinn in it. It is very hard to hurt."},
        {"excavations", CX_MECHANIC, "Excavations",
         "After Act III, a chart may hold a buried chamber. Set charges along the line to it and fire them; guardians climb out "
         "of the dust. What you dig up is traded with Amm Ramadan, the antiquities dealer, for what he keeps under the counter."},
    };
    return c;
}

int find_codex(const char* id) {
    auto& c = codex_entries();
    for (size_t i = 0; i < c.size(); i++) if (std::string(c[i].id) == id) return int(i);
    return -1;
}

}  // namespace q
