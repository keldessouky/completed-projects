#include "game/world.hpp"
#include "core/log.hpp"
#include "game/classes.hpp"
#include <algorithm>
#include <cstdio>

namespace q {

// ============================================================ data tables
const std::vector<MonsterDef>& monster_defs() {
    // append only: save states store the index
    static const std::vector<MonsterDef> d = [] {
        std::vector<MonsterDef> v = {
            {"ghoul", "Ghoul", "ghoul", 1.0f, {1, 1, 1}, 38, 4.3f, 0.42f, AttackKind::Claw, 1.5f, 1.3f, 5, 9, DT_PHYS, 10, 12, 0},
            {"ghoul_bruiser", "Grave Bruiser", "ghoul", 1.38f, {0.62f, 0.55f, 0.6f}, 110, 3.1f, 0.62f, AttackKind::Slam, 2.3f, 2.4f, 13, 19, DT_PHYS, 80, 40, 0},
            {"ghoul_spitter", "Bile Spitter", "ghoul", 0.95f, {0.72f, 0.95f, 0.62f}, 46, 3.7f, 0.4f, AttackKind::Spit, 9.0f, 2.0f, 7, 12, DT_CHAOS, 5, 16, 6.5f},
            {"umm_al_ghula", "Umm al-Ghula, Mother of the Ghouls", "ghoula", 1.25f, {1, 1, 1}, 760, 3.9f, 0.85f, AttackKind::Boss, 3.2f, 1.5f, 11, 17, DT_PHYS, 150, 420, 0},
            // Act I (Slice 4)
            {"cable_jinn", "Cable Jinn", "cable", 1.0f, {1, 1, 1}, 44, 4.0f, 0.45f, AttackKind::Claw, 1.6f, 1.4f, 5, 10, DT_LIGHTNING, 5, 14, 0},
            {"dish_sentinel", "Dish Sentinel", "dish", 1.0f, {1, 1, 1}, 60, 0.f, 0.6f, AttackKind::Beam, 11.f, 3.2f, 9, 15, DT_LIGHTNING, 20, 18, 0},
            {"silah", "Si'lah", "silah", 1.0f, {1, 1, 1}, 52, 4.6f, 0.45f, AttackKind::Leap, 6.5f, 3.0f, 8, 13, DT_PHYS, 10, 18, 0},
            {"nasnas", "Nasnas", "nasnas", 1.0f, {1, 1, 1}, 34, 5.2f, 0.4f, AttackKind::Claw, 1.4f, 1.0f, 4, 9, DT_PHYS, 5, 12, 0},
            {"qutrub", "Qutrub", "qutrub", 1.05f, {1, 1, 1}, 70, 5.0f, 0.5f, AttackKind::Leap, 7.0f, 2.8f, 10, 16, DT_PHYS, 20, 24, 0},
            {"microbus_jinn", "The Iron Microbus", "microbus", 1.0f, {1, 1, 1}, 400, 3.2f, 1.3f, AttackKind::Boss, 3.0f, 1.5f, 9, 14, DT_PHYS, 120, 300, 0},
            {"silah_sadat", "The Si'lah of Sadat Station", "silah", 1.45f, {0.8f, 0.9f, 1.1f}, 620, 4.4f, 0.8f, AttackKind::Boss, 2.8f, 1.3f, 10, 16, DT_PHYS, 60, 360, 0},
            {"nasnas_kabir", "al-Nasnas al-Kabir", "nasnas", 1.7f, {0.9f, 0.8f, 0.8f}, 700, 4.6f, 0.9f, AttackKind::Boss, 3.0f, 1.2f, 12, 18, DT_PHYS, 80, 400, 0},
            {"ifrit_zuweila", "The Ifrit of Bab Zuweila", "ifrit", 1.0f, {1, 1, 1}, 680, 3.6f, 1.0f, AttackKind::Boss, 3.4f, 1.4f, 11, 16, DT_FIRE, 100, 500, 0},
            {"qutrub_alpha", "The Qutrub of the Quarries", "qutrub", 1.55f, {0.85f, 0.8f, 0.75f}, 980, 5.0f, 0.9f, AttackKind::Boss, 3.2f, 1.1f, 15, 22, DT_PHYS, 90, 600, 0},
            // Slice 5: the Haboob's own
            {"sand_jinn", "Sand Jinn", "sand", 1.0f, {1, 1, 1}, 42, 5.0f, 0.45f, AttackKind::Claw, 1.6f, 1.2f, 6, 11, DT_PHYS, 10, 16, 0},
            // Act II (Slice 6): the Nile to Luxor
            {"marid", "River Marid", "marid", 1.0f, {1, 1, 1}, 60, 4.4f, 0.5f, AttackKind::Claw, 1.8f, 1.3f, 8, 13, DT_COLD, 10, 22, 0},
            {"marid_caller", "Marid Caller", "marid", 0.88f, {0.75f, 0.95f, 1.15f}, 44, 3.6f, 0.45f, AttackKind::Spit, 10.f, 2.2f, 7, 12, DT_COLD, 5, 22, 7.f},
            {"timthal", "Possessed Statue", "timthal", 1.0f, {1, 1, 1}, 120, 2.6f, 0.6f, AttackKind::Slam, 2.4f, 2.6f, 14, 21, DT_PHYS, 220, 40, 0},
            {"tomb_ghoul", "Tomb Ghoul", "ghoul", 1.1f, {0.9f, 0.82f, 0.62f}, 52, 4.6f, 0.45f, AttackKind::Claw, 1.6f, 1.2f, 8, 13, DT_PHYS, 20, 20, 0},
            {"naddaha", "El Naddaha, the Caller", "naddaha", 1.0f, {1, 1, 1}, 820, 3.4f, 0.8f, AttackKind::Boss, 3.0f, 1.4f, 13, 19, DT_COLD, 80, 900, 0},
            {"ram_sphinx", "The Ram of the Avenue", "ram", 1.0f, {1, 1, 1}, 1000, 3.0f, 1.6f, AttackKind::Boss, 3.6f, 1.6f, 16, 24, DT_PHYS, 300, 1100, 0},
            {"marid_tomb", "The Marid of the Deep Tomb", "marid", 1.7f, {0.7f, 0.82f, 1.2f}, 1100, 4.0f, 1.0f, AttackKind::Boss, 3.2f, 1.3f, 17, 26, DT_COLD, 120, 1400, 0},
            {"rift_lord", "The Rift Lord", "marid", 2.0f, {0.45f, 0.95f, 1.15f}, 1250, 4.2f, 1.1f, AttackKind::Boss, 3.4f, 1.2f, 18, 27, DT_COLD, 140, 1600, 0},
        };
        auto set = [&](const char* id, bool rigid, const char* fam, const char* voice = "ghoul") {
            for (auto& m : v) if (std::string(m.id) == id) { m.rigid = rigid; m.family = fam; m.voice = voice; }
        };
        auto codex = [&](const char* prefix, const char* entry) {
            for (auto& m : v) if (std::string(m.family).rfind(prefix, 0) == 0) m.codex = entry;
        };
        for (const char* g : {"ghoul", "ghoul_bruiser", "ghoul_spitter", "umm_al_ghula"}) set(g, false, "Ghouls of the City of the Dead");
        set("cable_jinn", false, "Possessed things", "spark");
        set("dish_sentinel", true, "Possessed things", "spark");
        set("microbus_jinn", true, "Possessed things", "metal");
        set("silah", false, "Si'lah, the shape-shifters", "whisper");
        set("silah_sadat", false, "Si'lah, the shape-shifters", "whisper");
        set("nasnas", false, "Nasnas, the half-men");
        set("nasnas_kabir", false, "Nasnas, the half-men");
        set("qutrub", false, "Qutrub, the grave wolves", "howl");
        set("qutrub_alpha", false, "Qutrub, the grave wolves", "howl");
        set("ifrit_zuweila", false, "Ifrit, the fire jinn", "fire");
        set("sand_jinn", false, "Sand jinn of the Haboob", "whisper");
        for (const char* g : {"marid", "marid_caller", "marid_tomb", "rift_lord"}) set(g, false, "Marids of the river", "whisper");
        set("naddaha", false, "El Naddaha, the Caller", "whisper");
        set("timthal", true, "Possessed statues", "metal");
        set("ram_sphinx", true, "Possessed statues", "metal");
        set("tomb_ghoul", false, "Ghouls of the tombs");
        codex("Ghouls", "ghouls");
        codex("Possessed", "possessed");
        codex("Si'lah", "silah");
        codex("Nasnas", "nasnas");
        codex("Qutrub", "qutrub");
        codex("Ifrit", "ifrit");
        codex("Sand jinn", "sand_jinn");
        codex("Marids", "marid");
        codex("El Naddaha", "naddaha");
        codex("Possessed statues", "statues");
        codex("Ghouls of the tombs", "tomb_ghouls");
        return v;
    }();
    return d;
}

CharacterModel monster_model(int def) {
    const MonsterDef& d = monster_defs()[size_t(def)];
    if (d.rigid) { CharacterModel c; c.name = d.model; return c; }   // a possessed object: one static mesh
    return assets().character(d.model);
}

const BossDef* boss_def(int monster) {
    static const std::vector<BossDef> d = {
        {"umm_al_ghula",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Wail, "wail", 11.f, 0, 99, 0, 1},
          {MoveKind::Leap, "leap", 6.f, 5.5f, 40, 1.6f, 0}, {MoveKind::Combo, "combo", 1.4f, 0, 3.6f, 1.f, 0}},
         0.55f, "RISE, MY CHILDREN", "ghoul", 5, 9.f, 1.25f, {0.6f, 1.f, 0.4f}},
        {"microbus_jinn",
         {{MoveKind::Summon, "", 1e9f, 0, 99, 0, 1}, {MoveKind::Nova, "", 6.f, 0, 5.f, 1.1f, 1},
          {MoveKind::Charge, "", 4.2f, 3.5f, 30, 1.6f, 0}, {MoveKind::Combo, "", 1.6f, 0, 3.2f, 1.f, 0}},
         0.5f, "THE DOORS FLY OPEN", "cable_jinn", 3, 10.f, 1.2f, {0.6f, 0.8f, 1.f}},
        {"silah_sadat",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Volley, "cast", 5.f, 5, 20, 0.6f, 1},
          {MoveKind::Blink, "cast", 5.f, 4.f, 30, 0, 0}, {MoveKind::Combo, "combo", 1.3f, 0, 3.2f, 1.f, 0}},
         0.5f, "THE PASSENGERS STEP FORWARD", "silah", 3, 10.f, 1.2f, {0.7f, 0.9f, 0.6f}},
        {"nasnas_kabir",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Nova, "slam", 7.f, 0, 4.5f, 1.2f, 1},
          {MoveKind::Leap, "leap", 4.f, 4.f, 25, 1.4f, 0}, {MoveKind::Combo, "combo", 1.2f, 0, 3.4f, 1.f, 0}},
         0.5f, "THE OTHER HALF ANSWERS", "nasnas", 4, 10.f, 1.25f, {0.8f, 0.6f, 0.5f}},
        {"ifrit_zuweila",
         {{MoveKind::Nova, "wail", 8.f, 0, 6.f, 1.3f, 1}, {MoveKind::Pools, "cast", 9.f, 0, 30, 0.5f, 0},
          {MoveKind::Volley, "cast", 4.f, 4.f, 30, 0.8f, 0}, {MoveKind::Combo, "combo", 1.4f, 0, 3.8f, 1.f, 0}},
         0.5f, "THE GATE'S FIRE BURNS IN HIM", "", 0, 10.f, 1.2f, {1.f, 0.5f, 0.15f}},
        {"qutrub_alpha",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Wail, "wail", 10.f, 0, 99, 0, 1},
          {MoveKind::Leap, "leap", 3.5f, 4.f, 25, 1.5f, 0}, {MoveKind::Combo, "combo", 1.1f, 0, 3.4f, 1.f, 0}},
         0.55f, "THE PACK ANSWERS", "qutrub", 3, 10.f, 1.3f, {0.7f, 0.7f, 0.7f}},
        // Act II
        {"naddaha",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Wail, "wail", 9.f, 0, 99, 0, 0},
          {MoveKind::Pools, "cast", 8.f, 0, 30, 0.5f, 1}, {MoveKind::Blink, "cast", 7.f, 5.f, 30, 0, 0},
          {MoveKind::Volley, "cast", 4.5f, 4.f, 30, 0.7f, 0}, {MoveKind::Combo, "combo", 1.3f, 0, 3.2f, 1.f, 0}},
         0.5f, "SHE CALLS YOU BY YOUR MOTHER'S VOICE", "marid", 3, 11.f, 1.2f, {0.55f, 0.85f, 1.f}, true},
        {"ram_sphinx",
         {{MoveKind::Summon, "", 1e9f, 0, 99, 0, 1}, {MoveKind::Nova, "", 6.5f, 0, 5.5f, 1.2f, 0},
          {MoveKind::Charge, "", 4.0f, 3.5f, 30, 1.6f, 0}, {MoveKind::Combo, "", 1.6f, 0, 3.6f, 1.f, 0}},
         0.5f, "THE AVENUE WAKES", "timthal", 3, 11.f, 1.25f, {0.55f, 0.85f, 1.f}},
        {"marid_tomb",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Pools, "cast", 8.f, 0, 30, 0.55f, 1},
          {MoveKind::Nova, "slam", 7.f, 0, 5.f, 1.3f, 0}, {MoveKind::Volley, "cast", 4.f, 4.f, 30, 0.8f, 0},
          {MoveKind::Combo, "combo", 1.2f, 0, 3.6f, 1.f, 0}},
         0.5f, "THE DEEP WATER RISES", "marid", 4, 11.f, 1.25f, {0.5f, 0.8f, 1.f}},
        {"rift_lord",
         {{MoveKind::Summon, "summon", 1e9f, 0, 99, 0, 1}, {MoveKind::Pools, "cast", 7.f, 0, 30, 0.55f, 0},
          {MoveKind::Blink, "cast", 6.5f, 5.f, 30, 0, 1}, {MoveKind::Nova, "slam", 6.5f, 0, 5.5f, 1.3f, 0},
          {MoveKind::Volley, "cast", 3.5f, 4.f, 30, 0.8f, 0}, {MoveKind::Combo, "combo", 1.1f, 0, 3.8f, 1.f, 0}},
         0.5f, "THE RIFT OPENS WIDER", "marid_caller", 4, 11.f, 1.3f, {0.45f, 0.9f, 1.f}},
    };
    if (monster < 0 || monster >= int(monster_defs().size())) return nullptr;
    const char* id = monster_defs()[size_t(monster)].id;
    for (auto& b : d) if (std::string(b.monster) == id) return &b;
    return nullptr;
}

int find_monster(const char* id) {
    auto& d = monster_defs();
    for (size_t i = 0; i < d.size(); i++) if (std::string(d[i].id) == id) return int(i);
    return 0;
}

const char* monster_mod_name(int m) {
    static const char* n[] = {"Hasted", "Armoured", "Frenzied", "Vampiric"};
    return m >= 0 && m < MM_COUNT ? n[m] : "";
}

// ============================================================ hero
static std::string g_hero_model = "warrior";
const char* hero_model() { return g_hero_model.c_str(); }

void apply_class_base(Hero& H, const std::string& cls) {
    const ClassDef& c = class_def(cls);
    Stats& b = H.base;
    b = Stats{};
    b.add(S_STR, MK_FLAT, c.str, 0, SRC_CLASS);
    b.add(S_DEX, MK_FLAT, c.dex, 0, SRC_CLASS);
    b.add(S_INT, MK_FLAT, c.intel, 0, SRC_CLASS);
    b.add(S_LIFE, MK_FLAT, c.life, 0, SRC_CLASS);
    b.add(S_MANA, MK_FLAT, c.mana, 0, SRC_CLASS);
    b.add(S_MANA_REGEN, MK_FLAT, 2.5f, 0, SRC_CLASS);
    if (c.armour > 0) b.add(S_ARMOUR, MK_FLAT, c.armour, 0, SRC_CLASS);
    if (c.es > 0) b.add(S_ES, MK_FLAT, c.es, 0, SRC_CLASS);
    if (c.evasion > 0) b.add(S_EVASION, MK_FLAT, c.evasion, 0, SRC_CLASS);
    g_hero_model = c.model;
}

void give_class_kit(Hero& H) {
    // four Talismans on the first bar, each with the two Wafq slots every Talisman starts with
    const ClassDef& c = class_def(H.passives.cls);
    H.talismans.clear();
    for (auto& b : H.bar) b = -1;
    for (int i = 0; i < 4; i++) {
        int sk = c.kit[i] && *c.kit[i] ? find_skill(c.kit[i]) : -1;
        if (sk < 0) continue;
        Talisman t;
        t.skill = int16_t(sk);
        H.talismans.push_back(t);
        H.bar[i] = int8_t(H.talismans.size() - 1);
    }
}

void World::reset_hero(const std::string& cls) {
    hero = Hero{};
    tree().load();
    const ClassDef& c = class_def(cls);
    hero.passives.reset(c.id);
    apply_class_base(hero, c.id);
    hero.weapon() = make_item(find_base(c.weapon), Rarity::Normal, 1, rng);
    give_class_kit(hero);
    Actor h;
    h.id = next_id++;
    h.team = TEAM_HERO;
    h.radius = 0.45f;
    h.speed = 5.2f;
    h.name = c.name;
    actors.clear();
    actors.push_back(h);
    recompute_hero();
    actors[0].life = actors[0].life_max;
    actors[0].mana = actors[0].mana_max;
}

void compute_hero_stats(Hero& H) {
    H.stats = H.base;
    H.stats.add(S_LIFE, MK_FLAT, 12.f * (H.level - 1), 0, SRC_LEVEL);
    H.stats.add(S_MANA, MK_FLAT, 6.f * (H.level - 1), 0, SRC_LEVEL);
    for (int e = 0; e < EQ_COUNT; e++)
        if (!H.equip[e].empty()) H.equip[e].add_global_mods(H.stats, uint16_t(1 + e));
    H.passives.apply(H.stats);
    H.keystones = H.passives.keystones();
    if (const Ascendancy* a = ascendancy_of(H.passives.cls, H.ascendancy)) asc_apply(*a, H.asc, H.stats, H.keystones);
    // attributes: Strength gives life and melee damage, Dexterity evasion, Intelligence mana and Hirz
    float str = H.stats.value(S_STR), dex = H.stats.value(S_DEX), in = H.stats.value(S_INT);
    H.stats.add(S_LIFE, MK_FLAT, str * 0.5f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_DAMAGE, MK_INC, str / 5.f, T_MELEE | T_PHYSICAL, SRC_ATTRIBUTES);
    H.stats.add(S_EVASION, MK_INC, dex / 5.f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_MANA, MK_FLAT, in * 0.5f, 0, SRC_ATTRIBUTES);
    H.stats.add(S_ES, MK_INC, in / 5.f, 0, SRC_ATTRIBUTES);
}

HeroSummary summarize(const Hero& hero) {
    HeroSummary s;
    Hero H = hero;
    compute_hero_stats(H);
    s.life = std::round(H.stats.value(S_LIFE));
    s.mana = std::round(H.stats.value(S_MANA));
    s.es = std::round(std::max(0.f, H.stats.value(S_ES)));
    s.armour = H.stats.value(S_ARMOUR);
    Defences d = defences_of(H.stats);
    for (int t = 0; t < DT_COUNT; t++) s.res[size_t(t)] = std::min(d.res[size_t(t)], d.max_res);
    s.str = H.stats.value(S_STR);
    s.dex = H.stats.value(S_DEX);
    s.intel = H.stats.value(S_INT);
    for (int slot = 0; slot < 10; slot++) {
        const Talisman* t = H.slot_talisman(slot);
        if (!t || (t->def().tags & (T_ATTACK | T_SPELL)) == 0) continue;
        SkillCtx c = skill_ctx(*t, H.stats, H.weapon().weapon());
        s.dps = c.hit.dps();   // against one target: one projectile of a fan (PoE's convention)
        s.skill = c.def->name;
        break;
    }
    // effective hit points against a mixed hit: life and Hirz through armour and average resistance
    // (half physical at 40 a hit, half elemental), so armour and resistances both count
    float avg_res = (s.res[DT_FIRE] + s.res[DT_COLD] + s.res[DT_LIGHTNING]) / 300.f;
    float taken = 0.5f * (1.f - armour_reduction(s.armour, 40.f)) + 0.5f * (1.f - avg_res);
    s.ehp = (s.life + s.es) / std::max(0.05f, taken);
    return s;
}

void World::recompute_hero() {
    Hero& H = hero;
    compute_hero_stats(H);
    Actor& a = actors[0];
    float old_max = a.life_max;
    a.life_max = std::round(H.stats.value(S_LIFE));
    a.mana_max = std::round(H.stats.value(S_MANA));
    a.armour = H.stats.value(S_ARMOUR);
    float old_es = H.es_max;
    H.es_max = std::round(std::max(0.f, H.stats.value(S_ES)));
    H.es = old_es > 0 ? std::min(H.es_max, H.es * H.es_max / old_es) : H.es_max;
    a.speed = 5.2f * (1 + H.stats.sum(S_MOVE_SPEED).inc / 100.f);
    if (old_max > 0 && old_max != a.life_max) a.life = std::min(a.life_max, a.life * a.life_max / old_max);
    a.mana = std::min(a.mana, a.mana_max);
}

SkillCtx World::slot_ctx(int slot) const {
    const Talisman* t = hero.slot_talisman(slot);
    return t ? skill_ctx(*t, hero.stats, hero_weapon()) : SkillCtx{};
}

float World::skill_cost(int slot) const { return slot_ctx(slot).mana; }

int World::main_slot() const {
    for (int slot = 0; slot < 10; slot++) {
        const Talisman* t = hero.slot_talisman(slot);
        if (t && (t->def().tags & (T_ATTACK | T_SPELL))) return slot;
    }
    return -1;
}

float World::hero_dps(const Item& weapon) const {
    int slot = main_slot();
    const Talisman* t = hero.slot_talisman(slot);
    if (!t) return 0;
    Stats s = hero.stats;
    s.remove_source(1);
    weapon.add_global_mods(s, 1);
    SkillCtx c = skill_ctx(*t, s, weapon.weapon());
    return c.usable ? c.hit.dps() : 0.f;   // one target's, as everywhere; a bow skill with a maul does nothing
}

// ============================================================ monsters
Actor& World::spawn_monster(int def, vec2 pos, Rarity rarity, int lvl) {
    const MonsterDef& d = monster_defs()[size_t(def)];
    Actor m;
    m.id = next_id++;
    m.team = TEAM_ENEMY;
    m.def = def;
    m.rarity = rarity;
    m.name = d.name;
    m.pos = pos;
    m.facing = -kPi / 2;
    m.scale = d.scale;
    m.tint = d.tint;
    m.radius = d.radius;
    float lvl_k = 1.f + 0.14f * (lvl - 1);
    m.life_max = d.life * lvl_k;
    m.armour = d.armour * lvl_k;
    m.speed = d.speed * rng.range(0.92f, 1.08f);
    m.attack_cd = rng.range(0.2f, 1.2f);
    if (rarity == Rarity::Magic) { m.life_max *= 1.8f; m.dmg_mult = 1.2f; }
    if (d.attack == AttackKind::Boss) {
        m.rarity = Rarity::Unique;
        m.home = pos;
        if (const BossDef* bd = boss_def(def))
            for (size_t i = 0; i < bd->moves.size() && i < 8; i++) m.move_cd[i] = bd->moves[i].phase ? 1e9f : (bd->moves[i].kind == MoveKind::Combo ? 0.f : 3.f);
    }
    if (rarity == Rarity::Rare) {
        m.life_max *= 2.6f;
        m.dmg_mult = 1.25f;
        m.scale *= 1.08f;
        static const char* a[] = {"Hollow", "Grave", "Dust", "Bone", "Salt", "Night"};
        static const char* b[] = {"Gnaw", "Hunger", "Mouth", "Keeper", "Rot", "Widow"};
        m.name = std::string(a[rng.next() % 6]) + " " + b[rng.next() % 6];
        int n = 2;
        for (int i = 0; i < n; i++) {
            uint8_t mm;
            do { mm = uint8_t(rng.next() % MM_COUNT); } while (i > 0 && mm == m.mods[0]);
            m.mods[i] = mm;
            if (mm == MM_HASTED) m.speed_mult = 1.35f;
            if (mm == MM_ARMOURED) m.armour += 400;
            if (mm == MM_FRENZIED) m.dmg_mult *= 1.3f;
        }
    }
    m.speed *= m.speed_mult;
    m.life = m.life_max;
    m.model = monster_model(def);
    m.anim.bind(m.model.skel, m.model.anims);
    m.anim.play("idle", 0);
    m.anim.t = rng.range(0, 2);
    actors.push_back(m);
    return actors.back();
}

int World::enemies_alive() const {
    int n = 0;
    for (size_t i = 1; i < actors.size(); i++) if (actors[i].alive()) n++;
    return n;
}

const Actor* World::focus_enemy() const {
    const Actor* best = nullptr;
    float bd = 1e9f;
    const Actor& h = actors[0];
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& a = actors[i];
        if (!a.alive() || a.rarity < Rarity::Rare) continue;
        float d = length(a.pos - h.pos) - (a.rarity == Rarity::Unique ? 6.f : 0.f);
        if (d < 14 && d < bd) { bd = d; best = &a; }
    }
    return best;
}

// ============================================================ step
void World::step(const Input& in, float dt) {
    events.clear();
    used_interact = -1;
    time += dt;
    fx_step(dt);
    if (coil_t >= 0 && (coil_t += dt) > 14.f) coil_t = -1;
    if (hitstop > 0) { hitstop -= dt; return; }
    hero_step(in, dt);
    for (size_t i = 1; i < actors.size(); i++) monster_step(actors[i], dt);
    separate();
    if (in_chart) { haboob_step(dt); rift_step(dt); }
    // projectiles: the monsters' bile and the hero's bolts
    Actor& h = actors[0];
    for (auto& p : projectiles) {
        p.pos += p.vel * dt;
        p.life -= dt;
        if (fx_rng.chance(0.6f)) {
            Particle q{vec3(p.pos, p.z), {0, 0, 0}, 0.3f, 0.3f, 0.25f, 0.05f, 0, 1, vec4(p.color, 0.8f), vec4(p.color * 0.5f, 0), 0, true};
            particles.push_back(q);
        }
        if (p.team == TEAM_ENEMY && h.alive() && length(p.pos - h.pos) < p.radius + h.radius) {
            damage_hero(p.dmg_min, p.dmg_max, p.dmg_type, p.pos - p.vel, 8, p.owner);
            p.life = 0;
        }
        if (p.team == TEAM_HERO && p.life > 0)
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                if (!e.alive() || length(e.pos - p.pos) > p.radius + e.radius) continue;
                hit_enemy(e, p.hh, p.pos - normalize(p.vel), 1.5f);
                emit(Ev::FireHit, p.pos);
                p.life = 0;
                break;
            }
        if (level.blocked(p.pos, 0.05f)) p.life = 0;
        if (p.life <= 0) {
            burst(vec3(p.pos, 0.3f), 12, vec4(p.color, 1), vec4(p.color * 0.3f, 0), 3.f, 0.18f, 0.5f, true);
            if (p.team == TEAM_ENEMY) emit(Ev::Splash, p.pos);
        }
    }
    projectiles.erase(std::remove_if(projectiles.begin(), projectiles.end(), [](const Projectile& p) { return p.life <= 0; }), projectiles.end());
    // ground effects: glyphs pulse, stars land
    for (size_t i = 0; i < ground.size(); i++) {
        GroundFx& g = ground[i];
        g.t += dt;
        if (g.kind == GroundFx::Glyph && g.t >= g.pulse && g.t < g.life) { g.pulse += 1.f; glyph_pulse(ground[i]); }
        if (g.kind == GroundFx::Meteor && g.t >= g.life) star_fall(ground[i]);
        if (g.kind == GroundFx::Rain && g.t >= g.pulse && g.t < g.life) {   // a volley lands
            g.pulse += 0.3f;
            HeroHit hh = g.hh;
            for (size_t k = 1; k < actors.size(); k++) {
                Actor& e = actors[k];
                if (e.alive() && length(e.pos - g.pos) < g.radius + e.radius) hit_enemy(e, hh, g.pos, 0.4f);
            }
            for (int a = 0; a < 10; a++) {   // the arrows, falling
                vec2 p = g.pos + rotate(vec2{fx_rng.range(0.f, g.radius), 0}, fx_rng.range(0.f, kTau));
                Particle q{vec3(p, 4.f), vec3(0.3f, 0.2f, -22.f), 0.18f, 0.18f, 0.05f, 0.05f, 0, 0, vec4(0.85f, 0.75f, 0.55f, 1),
                           vec4(0.7f, 0.6f, 0.4f, 0.6f), 0, false};
                particles.push_back(q);
            }
            burst(vec3(g.pos, 0.1f), 12, vec4(0.6f, 0.52f, 0.4f, 0.7f), vec4(0.5f, 0.44f, 0.36f, 0), 2.5f, 0.2f, 0.5f, false, -3.f, 1);
            emit(Ev::Impact, g.pos, 0.6f);
        }
        if ((g.kind == GroundFx::Fire || g.kind == GroundFx::Water) && g.t >= g.pulse && g.t < g.life) {   // a hazard: it bites twice a second
            g.pulse += 0.5f;
            const int dt_ = g.kind == GroundFx::Water ? DT_COLD : DT_FIRE;
            if (h.alive() && length(h.pos - g.pos) < g.radius + h.radius * 0.5f)
                damage_hero(g.hh.hit.min[size_t(dt_)] * 0.4f, g.hh.hit.max[size_t(dt_)] * 0.4f, dt_, g.pos, 0, g.owner, false);
        }
    }
    ground.erase(std::remove_if(ground.begin(), ground.end(), [](const GroundFx& g) { return g.t >= g.life; }), ground.end());
    // remove fully dissolved corpses
    actors.erase(std::remove_if(actors.begin() + 1, actors.end(), [](const Actor& a) { return a.act == Act::Dead && a.dead_t > 2.2f; }), actors.end());
    // the interactable in reach, if any
    near_interact = -1;
    float bi = 1e9f;
    for (size_t i = 0; i < interacts.size(); i++) {
        if (interacts[i].spent) continue;
        float d = length(interacts[i].pos - h.pos);
        if (d < interacts[i].radius && d < bi) { bi = d; near_interact = int(i); }
    }
    for (auto& n : npcs) n.anim.update(dt);
    // loot selection: the nearest item within reach
    selected_loot = -1;
    float bd = 2.2f;
    std::vector<GroundItem> pending_loot;   // a completed poster's unique, added after the walk
    for (size_t i = 0; i < loot.size(); i++) {
        GroundItem& g = loot[i];
        g.t += dt;
        float d = length(g.pos - h.pos);
        if (g.kind != GroundItem::Gear) {
            if (d < 1.3f && g.t > 0.4f && h.alive()) {
                if (g.kind == GroundItem::Gold) {
                    hero.gold += g.amount;
                    texts.push_back({vec3(g.pos, 1.2f), "+" + std::to_string(g.amount) + " dinars", 0xF5D76E, 0, 28});
                    emit(Ev::Gold, g.pos);
                } else if (g.kind == GroundItem::Wafq) {
                    hero.wafq[g.currency % WQ_COUNT]++;
                    texts.push_back({vec3(g.pos, 1.2f), wafq_def(g.currency).name, 0x2BB5AE, 0, 30});
                    emit(Ev::Currency, g.pos);
                } else if (g.kind == GroundItem::Blank) {
                    hero.blanks.push_back(uint8_t(g.amount));
                    std::sort(hero.blanks.begin(), hero.blanks.end());
                    texts.push_back({vec3(g.pos, 1.2f), "Blank Talisman (" + std::to_string(g.amount) + ")", 0xD4A84B, 0, 30});
                    emit(Ev::Currency, g.pos);
                } else if (g.kind == GroundItem::Scrap) {
                    int u = std::clamp(g.amount, 0, kMaxUniques - 1);
                    const UniqueDef& ud = unique_def(u);
                    meet_codex("posters");
                    texts.push_back({vec3(g.pos, 1.2f), std::string("Poster Scrap: ") + ud.film, 0xE08A3C, 0, 30});
                    emit(Ev::Currency, g.pos);
                    if (++hero.scraps[u] >= kScrapsPerPoster) {   // the poster is whole: what it shows is yours
                        hero.scraps[u] = 0;
                        GroundItem gi;
                        gi.item = make_unique(u, area_level, rng);
                        gi.pos = level.resolve(h.pos + vec2{0.8f, -0.6f}, 0.3f);
                        gi.id = next_id++;
                        pending_loot.push_back(gi);
                        notices.push_back(std::string("The poster is whole: ") + ud.film + " (" + std::to_string(ud.year) + ")");
                        emit(Ev::Pickup, g.pos, 2.f);
                    }
                } else {
                    hero.currency[g.currency] += g.amount;
                    if (g.currency == CUR_SPLINTER && hero.currency[CUR_SPLINTER] >= kSplintersPerSeal) {
                        hero.currency[CUR_SPLINTER] -= kSplintersPerSeal;
                        hero.currency[CUR_RIFT_SEAL]++;
                        notices.push_back("Fifty splinters fuse into a Rift Seal: open the Rift Lord's court at the chart table");
                    }
                    texts.push_back({vec3(g.pos, 1.2f), currency_def(g.currency).name, currency_def(g.currency).color, 0, 30});
                    emit(Ev::Currency, g.pos);
                    int c = g.currency;
                    if (c >= kFirstBlend && c <= kLastBlend) meet_codex("blends");
                    else if (is_omen(c)) meet_codex("omens");
                    else if (c == CUR_EMBER) meet_codex("ember");
                }
                g.t = -1;
            }
            continue;
        }
        if (d < bd && loot_visible(g)) { bd = d; selected_loot = int(i); }
    }
    loot.erase(std::remove_if(loot.begin(), loot.end(), [](const GroundItem& g) { return g.t < 0; }), loot.end());
    loot.insert(loot.end(), pending_loot.begin(), pending_loot.end());
    if (selected_loot >= int(loot.size())) selected_loot = -1;
}

// ============================================================ belongings
bool World::pick_up(int i) {
    if (i < 0 || i >= int(loot.size()) || loot[size_t(i)].kind != GroundItem::Gear) return false;
    Actor& h = actors[0];
    if (!hero.inv.add(loot[size_t(i)].item)) {
        texts.push_back({vec3(h.pos, 2.4f), "Inventory full", 0xE0B0A0, 0, 32});
        emit(Ev::InvFull, h.pos);
        return false;
    }
    loot.erase(loot.begin() + i);
    selected_loot = -1;
    emit(Ev::Pickup, h.pos);
    return true;
}

bool World::equip_from_inventory(int i) {
    if (i < 0 || i >= int(hero.inv.items.size())) return false;
    InvItem entry = hero.inv.items[size_t(i)];
    int slot = equip_slot_for(entry.item, hero.equip);
    if (slot < 0) return false;
    hero.inv.take(i);
    Item old = hero.equip[slot];
    hero.equip[slot] = entry.item;
    // the old piece goes where the new one was if it fits, otherwise anywhere
    if (!old.empty() && !hero.inv.place(old, entry.x, entry.y) && !hero.inv.add(old)) {
        hero.equip[slot] = old;
        hero.inv.items.insert(hero.inv.items.begin() + i, entry);
        emit(Ev::InvFull, actors[0].pos);
        return false;
    }
    recompute_hero();
    emit(Ev::Pickup, actors[0].pos);
    return true;
}

bool World::unequip(int slot) {
    if (slot < 0 || slot >= EQ_COUNT || hero.equip[slot].empty() || slot == EQ_WEAPON) return false;
    if (!hero.inv.add(hero.equip[slot])) { emit(Ev::InvFull, actors[0].pos); return false; }
    hero.equip[slot] = Item{};
    recompute_hero();
    emit(Ev::Pickup, actors[0].pos);
    return true;
}

void World::drop_from_inventory(int i) {
    if (i < 0 || i >= int(hero.inv.items.size())) return;
    GroundItem g;
    g.item = hero.inv.take(i);
    Actor& h = actors[0];
    g.pos = level.resolve(h.pos + from_angle(h.facing) * 1.2f + vec2{fx_rng.range(-0.3f, 0.3f), fx_rng.range(-0.3f, 0.3f)}, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

bool World::craft(int c, Item& target, std::string* why) {
    if (c < 0 || c >= CUR_COUNT || hero.currency[c] <= 0) { if (why) *why = "You have none left"; return false; }
    if (!apply_currency(c, target, rng, why, &hero.omens)) return false;
    hero.currency[c]--;
    recompute_hero();
    emit(Ev::Craft, actors[0].pos);
    return true;
}

void World::drop_currency(vec2 at, int c, int amount) {
    GroundItem g;
    g.kind = GroundItem::Currency;
    g.currency = uint8_t(c);
    g.amount = amount;
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

// ---- the Haboob
void World::haboob_step(float dt) {
    Haboob& hb = haboob;
    if (!hb.armed || hb.passed) return;
    Actor& h = actors[0];
    if (!hb.active) {
        if ((hb.delay -= dt) > 0) return;
        hb.active = true;
        hb.front = hb.y0;
        meet_codex("haboob");
        notices.push_back("A HABOOB rises in the south: stay in the storm");
        emit(Ev::BossWail, h.pos, 0.5f);
    }
    hb.front += hb.speed * dt;
    // the wall itself: sand thrown up along the front, near the hero
    for (int k = 0; k < 6; k++) {
        float x = h.pos.x + fx_rng.range(-16.f, 16.f);
        if (x < hb.x0 || x > hb.x1) continue;
        float y = hb.front - fx_rng.range(0.f, 2.5f);
        Particle q{vec3(x, y, fx_rng.range(0.2f, 5.f)), vec3(fx_rng.range(-1.f, 1.f), fx_rng.range(0.5f, 2.f), fx_rng.range(-0.3f, 0.6f)),
                   1.6f, 1.6f, fx_rng.range(0.4f, 0.9f), fx_rng.range(0.9f, 1.6f), 0, 0.2f, vec4(0.72f, 0.58f, 0.38f, 0.28f),
                   vec4(0.6f, 0.48f, 0.3f, 0), 1, false};
        particles.push_back(q);
    }
    if (hb.inside(h.pos) && h.alive()) {
        hb.meter += dt;
        for (int k = 0; k < 2; k++) {   // blowing sand all round you
            vec3 p = vec3(h.pos + vec2{fx_rng.range(-9.f, 9.f), fx_rng.range(-7.f, 7.f)}, fx_rng.range(0.2f, 3.f));
            Particle q{p, vec3(fx_rng.range(2.f, 4.f), fx_rng.range(1.f, 2.f), 0), 0.9f, 0.9f, 0.06f, 0.14f, 0, 0.05f,
                       vec4(0.8f, 0.66f, 0.45f, 0.5f), vec4(0.7f, 0.56f, 0.36f, 0), 0, false};
            particles.push_back(q);
        }
        if ((hb.spawn_t -= dt) <= 0) {   // the sand jinn ride in with it
            hb.spawn_t = rng.range(6.f, 9.f);
            int n = rng.irange(2, 4);
            int def = find_monster("sand_jinn");
            // out of the storm's murk, somewhere in sight of you (never inside a wall's pocket)
            vec2 from = h.pos;
            for (int t = 0; t < 12; t++) {
                vec2 c = level.resolve(h.pos + rotate(vec2{rng.range(5.f, 9.f), 0}, rng.range(0.f, kTau)), 0.6f);
                if (level.line_clear(h.pos, c, 0.6f)) { from = c; break; }
            }
            for (int i = 0; i < n; i++) {
                vec2 at = level.resolve(from + vec2{rng.range(-1.2f, 1.2f), rng.range(-1.2f, 1.2f)}, 0.5f);
                if (!level.line_clear(from, at, 0.5f)) at = from;
                Actor& m = spawn_monster(def, at,
                                         i == 0 && rng.chance(0.25f) ? Rarity::Magic : Rarity::Normal, area_level);
                m.ai_state = 1;   // already hunting
                burst(vec3(m.pos, 0.8f), 16, vec4(0.8f, 0.66f, 0.42f, 0.8f), vec4(0.6f, 0.5f, 0.3f, 0), 2.f, 0.3f, 0.8f, false, 1.f, 1);
            }
        }
    }
    if (hb.front - hb.depth > hb.y1) { hb.active = false; hb.passed = true; haboob_reward(); }
}

void World::rift_step(float dt) {
    Rift& rf = rift;
    if (!rf.armed || rf.closed) return;
    Actor& h = actors[0];
    if (!rf.open) {
        if (fx_rng.chance(0.3f))   // closed, it glimmers: a thin vertical seam of river light
            particles.push_back(Particle{vec3(rf.pos, fx_rng.range(0.3f, 2.6f)), vec3(0, 0, 0.6f), 0.8f, 0.8f, 0.12f, 0.02f, 0, 0,
                                         vec4(0.5f, 0.9f, 1.f, 0.9f), vec4(0.2f, 0.5f, 0.8f, 0), 0, true});
        if (!h.alive() || length(h.pos - rf.pos) > 7.f || !level.line_clear(h.pos, rf.pos, 0.3f)) return;
        rf.open = true;
        meet_codex("rifts");
        notices.push_back("A MARID RIFT tears open: kill what comes through");
        emit(Ev::BossWail, rf.pos, 0.7f);
        shake = std::max(shake, 0.4f);
    }
    rf.t += dt;
    rf.radius = 2.f + 6.5f * smoothstep(0.f, 10.f, rf.t);
    if (rf.t >= Rift::kLife) {
        rf.open = false;
        rf.closed = true;
        char b[80];
        snprintf(b, sizeof b, "The rift closes (%d of the marids' dead)", rf.kills);
        notices.push_back(b);
        emit(Ev::Portal, rf.pos, 1.f);
        return;
    }
    for (int k = 0; k < 3; k++) {   // the rift's edge, drawn in spray
        vec2 p = rf.pos + rotate(vec2{rf.radius, 0}, fx_rng.range(0.f, kTau));
        particles.push_back(Particle{vec3(p, 0.2f), vec3(0, 0, fx_rng.range(1.f, 3.f)), 0.7f, 0.7f, 0.18f, 0.05f, 0, 2.f,
                                     vec4(0.55f, 0.9f, 1.f, 0.8f), vec4(0.2f, 0.5f, 0.8f, 0), 0, true});
    }
    if ((rf.spawn_t -= dt) > 0 || rf.spawned >= 44) return;
    rf.spawn_t = rng.range(1.1f, 1.6f);
    static const char* kinds[] = {"marid", "marid", "marid", "marid_caller", "tomb_ghoul"};
    int n = rng.irange(2, 3);
    for (int i = 0; i < n; i++) {
        vec2 at = rf.pos;
        for (int t = 0; t < 8; t++) {
            vec2 c = level.resolve(rf.pos + rotate(vec2{rf.radius * rng.range(0.4f, 0.95f), 0}, rng.range(0.f, kTau)), 0.5f);
            if (level.line_clear(rf.pos, c, 0.5f)) { at = c; break; }
        }
        Rarity r = rng.chance(0.03f) ? Rarity::Rare : rng.chance(0.12f) ? Rarity::Magic : Rarity::Normal;
        Actor& m = spawn_monster(find_monster(kinds[rng.irange(0, 4)]), at, r, area_level);
        m.ai_state = 1;
        m.rift = true;
        rf.spawned++;
        burst(vec3(m.pos, 0.8f), 18, vec4(0.5f, 0.85f, 1.f, 0.9f), vec4(0.2f, 0.4f, 0.7f, 0), 3.f, 0.25f, 0.7f, true, 1.f);
    }
}

void World::haboob_reward() {
    Haboob& hb = haboob;
    Actor& h = actors[0];
    int currency = 1 + int(hb.meter / 14.f) + int(astro_value(chart.astro, AX_HABOOB_REWARD));
    vec2 at = level.resolve(h.pos + vec2{0, 1.5f}, 0.4f);
    for (int i = 0; i < currency; i++) drop_currency(at + rotate(vec2{1.4f, 0}, i * 0.9f), roll_currency(rng, area_level), 1);
    drop_gold(at, int(20 + hb.meter * 3.f));
    if (rng.chance(std::min(0.9f, hb.meter / 90.f))) {   // a long stay can leave a chart behind
        GroundItem g;
        g.item = make_chart(roll_chart_tier(chart, rng), rng);
        g.pos = level.resolve(at + vec2{-1.5f, 0.5f}, 0.3f);
        g.id = next_id++;
        loot.push_back(g);
    }
    char b[96];
    snprintf(b, sizeof b, "The Haboob passes (%d), and leaves %d currency behind", int(hb.meter), currency);
    notices.push_back(b);
    emit(Ev::Pickup, at, 2.f);
}

void World::gain_frenzy(int n) {
    int before = hero.frenzy;
    hero.frenzy = std::min(frenzy_max(), hero.frenzy + n);
    hero.frenzy_t = 10.f;
    if (hero.frenzy > before) texts.push_back({vec3(actors[0].pos, 2.8f), "FRENZY", 0x7AD890, 0, 28});
}

void World::gain_endurance(int n) {
    int before = hero.endurance;
    hero.endurance = std::min(endurance_max(), hero.endurance + n);
    hero.endurance_t = 10.f;
    if (hero.endurance > before) texts.push_back({vec3(actors[0].pos, 2.6f), "ENDURANCE", 0xE8A060, 0, 30});
}

bool World::learn_recipe(int r) {
    if (r < 0 || r >= 32 || (hero.recipes >> r & 1)) return false;
    hero.recipes |= 1u << r;
    notices.push_back(std::string("Recipe learned: ") + affix_defs()[recipe_affix(r).def].name + " (" + recipes()[size_t(r)].id + ")");
    return true;
}

void World::meet_codex(const char* id) {
    int c = find_codex(id);
    if (c < 0 || (hero.codex >> c & 1)) return;
    hero.codex |= uint64_t(1) << c;
    notices.push_back(std::string("New in the Journal: ") + codex_entries()[size_t(c)].title);
}

void World::drop_special(vec2 at, GroundItem::Kind kind, int value) {
    GroundItem g;
    g.kind = kind;
    if (kind == GroundItem::Wafq) { g.currency = uint8_t(value); g.amount = 1; }
    else g.amount = value;
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::drop_gold(vec2 at, int amount) {
    GroundItem g;
    g.kind = GroundItem::Gold;
    g.amount = std::max(1, amount);
    g.pos = level.resolve(at, 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

void World::anim_step(Actor& a, float dt) {
    a.anim.update(dt);
    a.hit_flash = std::max(0.f, a.hit_flash - dt * 6.f);
}

vec2 World::aim_assist(vec2 dir, float range, float cone) {
    const Actor& h = actors[0];
    float best = 1e9f;
    vec2 out = dir;
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& e = actors[i];
        if (!e.alive()) continue;
        vec2 d = e.pos - h.pos;
        float dist = length(d);
        if (dist > range + e.radius || dist < 1e-3f) continue;
        float ang = std::fabs(wrap_angle(angle_of(d) - angle_of(dir)));
        if (ang > cone) continue;
        float score = dist + ang * 2.f;
        if (score < best) { best = score; out = d / dist; }
    }
    return out;
}

void World::start_skill(int slot, vec2 stick) {
    Actor& h = actors[0];
    const Talisman* t = hero.slot_talisman(slot);
    if (!t) return;
    SkillCtx c = slot_ctx(slot);
    const SkillDef& sk = *c.def;
    if (!c.usable) {
        if (hero.cooldowns[slot] <= 0) {
            texts.push_back({vec3(h.pos, 2.4f), c.needs_bow ? std::string("Needs a bow")
                             : "Not enough " + std::string(sk.attr == ATTR_STR ? "Strength" : sk.attr == ATTR_DEX ? "Dexterity" : "Intelligence"),
                             0xE0B0A0, 0, 30});
            hero.cooldowns[slot] = 1.f;
        }
        return;
    }
    if (hero.cooldowns[slot] > 0 || h.mana < c.mana) return;
    h.mana -= c.mana;
    hero.cooldowns[slot] = c.cooldown;
    h.act = Act::Skill;
    h.act_t = 0;
    h.skill = slot;
    h.struck = false;
    // aim where the stick points (after a dodge the body still faces the roll), else where we face
    vec2 dir = length(stick) > 0.25f ? normalize(stick) : from_angle(h.facing);
    float reach = sk.shape == Shape::Circle ? sk.range + sk.radius : sk.shape == Shape::Cone ? sk.range : sk.range;
    if (sk.shape == Shape::Warcry || sk.shape == Shape::Detonate || sk.shape == Shape::Nova) reach = 4.f;
    dir = aim_assist(dir, reach + 1.5f, radians(sk.tags & T_SPELL ? 30 : 40));
    h.facing = angle_of(dir);
    // ground-targeted spells land on the enemy they were aimed at, or short of full reach
    h.target = h.pos + dir * std::min(sk.range, 5.5f);
    const Actor* best = nullptr;
    float bd = 1e9f;
    for (size_t i = 1; i < actors.size(); i++) {
        const Actor& e = actors[i];
        vec2 d = e.pos - h.pos;
        float dist = length(d);
        if (!e.alive() || dist > sk.range + e.radius || std::fabs(wrap_angle(angle_of(d) - h.facing)) > radians(35)) continue;
        if (dist < bd) { bd = dist; best = &e; }
    }
    if (best) h.target = best->pos;
    // a Warrior's clip set has no cast, a Sorcerer's no slam: fall back to the nearest gesture
    float spd = clampf(c.speed * (1.f + 0.04f * float(hero.frenzy)), 0.5f, 2.8f);
    if (!h.anim.play(sk.clip, 0.06f, true, spd)) {
        const char* alt = (sk.tags & T_SPELL) ? (sk.shape == Shape::Glyph || sk.shape == Shape::Meteor ? "slam" : "swing")
                                              : (sk.shape == Shape::Warcry ? "cast_ground" : sk.tags & T_SLAM ? "cast_ground" : "cast");
        h.anim.play(alt, 0.06f, true, spd);
    }
    if (sk.tags & T_SPELL) emit(Ev::Cast, h.pos, float(sk.base_type));
    else emit(Ev::Swing, h.pos, sk.tags & T_SLAM ? 1.5f : 1.f);
}

void World::hero_step(const Input& in, float dt) {
    Actor& h = actors[0];
    Hero& H = hero;
    for (float& c : H.cooldowns) c = std::max(0.f, c - dt);
    if (!h.alive()) {
        h.dead_t += dt;
        anim_step(h, dt);
        return;
    }
    // regeneration and flask
    h.mana = std::min(h.mana_max, h.mana + H.stats.value(S_MANA_REGEN, h.mana_max * 0.03f) * dt);
    // Hirz recharges after two seconds without taking damage
    H.overload_t = std::max(0.f, H.overload_t - dt);
    if (H.es_wait > 0) H.es_wait -= dt;
    else if (H.es < H.es_max) H.es = std::min(H.es_max, H.es + H.es_max * 0.2f * (1 + H.stats.sum(S_ES_RECHARGE).inc / 100.f) * dt);
    h.life = std::min(h.life_max, h.life + H.stats.value(S_LIFE_REGEN) * dt);
    // Endurance and Frenzy Charges fall off ten seconds after the last one was gained
    if (H.endurance > 0 && (H.endurance_t -= dt) <= 0) H.endurance = 0;
    if (H.frenzy > 0 && (H.frenzy_t -= dt) <= 0) H.frenzy = 0;
    if ((H.keystones & KS_OATH) && H.endurance > 0) h.life = std::min(h.life_max, h.life + h.life_max * 0.006f * H.endurance * dt);
    if (H.keystones & KS_QIRBA) H.flask = std::min(H.flask_max, H.flask + 0.125f * dt);   // Qirba of Plenty
    if (H.flask_heal_t > 0) {
        float rate = h.life_max * 0.5f / 1.5f * (1.f + H.stats.sum(S_FLASK_RECOVERY).inc / 100.f);
        h.life = std::min(h.life_max, h.life + rate * dt);
        H.flask_heal_t -= dt;
    }
    if (in.hit(BTN_L3) && H.flask >= 1 && h.life < h.life_max) {
        H.flask -= 1;
        H.flask_heal_t = 1.5f;
        emit(Ev::Drink, h.pos);
    }
    vec2 stick = in.lstick;
    bool busy = h.act == Act::Skill || h.act == Act::Dodge;
    // actions
    if (!busy) {
        // bar one on South / West / North / R1 / R2; holding L2 swaps in bar two
        static const Btn slot_btn[5] = {BTN_SOUTH, BTN_WEST, BTN_NORTH, BTN_R1, BTN_R2};
        const int bar = in.held(BTN_L2) ? 5 : 0;
        bool near_loot = selected_loot >= 0;
        bool calm = true;
        for (size_t i = 1; i < actors.size(); i++)
            if (actors[i].alive() && length(actors[i].pos - h.pos) < 6.f) calm = false;
        if (in.hit(BTN_SOUTH) && near_interact >= 0 && calm && !bar) {
            used_interact = near_interact;
        } else if ((in.hit(BTN_LEFT) || (in.hit(BTN_SOUTH) && calm && !bar)) && near_loot) {
            pick_up(selected_loot);
        } else if (in.hit(BTN_EAST)) {
            h.act = Act::Dodge;
            h.act_t = 0;
            if (length(stick) > 0.25f) h.facing = angle_of(stick);
            h.anim.play("dodge", 0.04f, true);
            emit(Ev::Dodge, h.pos);
        } else {
            for (int s = 0; s < 5; s++)
                if (in.hit(slot_btn[s])) { start_skill(bar + s, length(in.rstick) > 0.3f ? in.rstick : stick); break; }
        }
    }
    // movement
    vec2 want{0, 0};
    h.act_t += dt;
    if (h.act == Act::Idle) {
        want = stick * h.speed;
        if (length(stick) > 0.1f) h.facing = wrap_angle(h.facing + wrap_angle(angle_of(stick) - h.facing) * std::min(1.f, dt * 14.f));
        if (length(h.vel) > 0.6f) h.anim.play("run", 0.15f, false, clampf(length(h.vel) / 5.2f, 0.6f, 1.3f));
        else h.anim.play("idle", 0.25f);
    } else if (h.act == Act::Dodge) {
        want = from_angle(h.facing) * 9.5f * (1.f - h.anim.progress() * 0.6f);
        if (h.anim.done()) h.act = Act::Idle;
    } else if (h.act == Act::Skill) {
        want = stick * h.speed * 0.2f;
        const Talisman* t = H.slot_talisman(h.skill);
        const char* ev = t && t->def().shape == Shape::Warcry ? "cry" : "hit";
        if (!h.struck && (h.anim.event(ev) || h.anim.event("hit") || h.anim.event("cry"))) { h.struck = true; resolve_skill(h); }
        if (!t || h.anim.done() || h.anim.progress() > 0.92f) h.act = Act::Idle;

    } else if (h.act == Act::Hit) {
        if (h.anim.done()) h.act = Act::Idle;
    }
    h.vel = lerp(h.vel, want, std::min(1.f, dt * 16.f));
    h.pos = level.resolve(h.pos + h.vel * dt, h.radius);
    anim_step(h, dt);
}

// ============================================================ combat
bool World::in_glyph(vec2 p) const {
    for (const auto& g : ground)
        if (g.kind == GroundFx::Glyph && length(g.pos - p) < g.radius) return true;
    return false;
}

float World::hit_enemy(Actor& e, const HeroHit& hh, vec2 from, float knock, float extra_more) {
    Hero& H = hero;
    Actor& h = actors[0];
    HitDamage he = hh.hit;
    float k = extra_more;
    if (H.keystones & KS_FOLLOWER) k *= e.id == H.last_attacker ? 1.4f : 0.8f;   // al-Dabaran
    uint32_t sk_tags = hh.talisman >= 0 && hh.talisman < int(H.talismans.size()) ? H.talismans[size_t(hh.talisman)].def().tags : 0;
    if ((H.keystones & KS_FOUNDRY) && (sk_tags & T_SLAM) && e.broken_t > 0) k *= 1.25f;   // Hammer of the Foundry
    k *= 1.f + 0.04f * float(H.frenzy);                                                    // Frenzy Charges
    if ((H.keystones & KS_POINT_BLANK) && (sk_tags & T_PROJECTILE) && (sk_tags & T_ATTACK)) {   // al-Balda: near, more; far, less
        float d = length(e.pos - h.pos);
        k *= d <= 3.5f ? 1.4f : d >= 10.f ? 0.7f : 1.4f - 0.7f * (d - 3.5f) / 6.5f;
    }
    if ((H.keystones & KS_LONG_SHOT) && (sk_tags & T_PROJECTILE) && (sk_tags & T_ATTACK))   // The Long Shot
        k *= 1.f + 0.3f * clampf((length(e.pos - h.pos) - 3.f) / 9.f, 0.f, 1.f);
    if (e.mark_t > 0 && e.mark_hits > 0 && (sk_tags & T_ATTACK)) { he.crit_chance = 1.f; e.mark_hits--; }   // Marked: a sure crit
    for (int t = 0; t < DT_COUNT; t++) { he.min[size_t(t)] *= k; he.max[size_t(t)] *= k; }
    Defences def;
    def.armour = e.armour;
    def.damage_taken_inc = (e.broken_t > 0 ? 50.f : 0.f) + (e.shock_t > 0 ? e.shock : 0.f);
    if ((H.keystones & KS_BIND_COLD) && (e.chill_t > 0 || e.frozen_t > 0)) def.damage_taken_inc += 15.f;   // Binding Cold
    if ((H.keystones & KS_HAWK) && e.mark_t > 0) def.damage_taken_inc += 10.f;                              // Hawk's Gaze
    HitResult res = roll_hit(he, def, rng);
    if (res.crit && (H.keystones & KS_OVERLOAD)) H.overload_t = 6.f;
    if (res.crit && (H.keystones & KS_CRIT_FRENZY) && rng.chance(0.3f)) gain_frenzy(1);                    // Frenzied Aim
    e.life -= res.total;
    e.hit_flash = 1.f;
    vec2 d = e.pos - from;
    if (length(d) > 1e-4f) e.knock += normalize(d) * knock * (e.frozen_t > 0 ? 0.2f : 1.f);
    float leech = H.stats.value(S_LIFE_LEECH);
    if (leech > 0) h.life = std::min(h.life_max, h.life + leech);
    if (res.crit) {
        char b[32];
        snprintf(b, sizeof b, "%d", int(res.total));
        texts.push_back({vec3(e.pos, 2.2f), b, 0xF2A541, 0, 46});
        emit(Ev::Crit, e.pos);
    }
    vec3 hp = vec3(e.pos, 1.0f * e.scale);
    burst(hp, 7, vec4(1.f, 0.7f, 0.4f, 0.8f), vec4(0.9f, 0.3f, 0.1f, 0), 5.f, 0.08f, 0.3f, true, -9.f);
    burst(hp, 3, vec4(0.2f, 0.17f, 0.18f, 0.55f), vec4(0.15f, 0.13f, 0.14f, 0), 2.f, 0.22f, 0.5f, false, -4.f, 1);
    if (e.life <= 0) { kill(e); return res.total; }
    const bool unique = e.rarity == Rarity::Unique;
    // ailments: fire can Ignite, cold always Chills and builds Freeze, lightning can Shock
    float fire = res.by_type[DT_FIRE], cold = res.by_type[DT_COLD], light = res.by_type[DT_LIGHTNING];
    if (fire > 0 && hh.ignite > 0 && rng.chance(hh.ignite)) {
        float dps = fire * 0.9f * ((H.keystones & KS_WEAVER) ? 1.3f : 1.f);   // Ailment Weaver
        if (dps > e.ignite_dps || e.ignite_t <= 0) e.ignite_dps = dps;
        e.ignite_t = 4.f;
    }
    if (cold > 0) {
        e.chill = std::max(e.chill, clampf(0.3f * hh.freeze, 0.1f, 0.5f));
        e.chill_t = std::max(e.chill_t, 2.f);
        e.freeze_meter += cold / e.life_max * 100.f * 1.6f * hh.freeze * (unique ? 0.4f : 1.f);
        if (e.freeze_meter >= 100.f) {
            e.freeze_meter = 0;
            e.frozen_t = unique ? 0.8f : 1.6f;
            emit(Ev::Frozen, e.pos);
            texts.push_back({vec3(e.pos, 2.4f), "FROZEN", 0x9FD8FF, 0, 34});
        }
    }
    // poison: a stack of chaos over two seconds, from the physical and chaos damage of the hit
    float pc = res.by_type[DT_PHYS] + res.by_type[DT_CHAOS];
    if (pc > 0 && hh.poison > 0 && rng.chance(hh.poison)) {
        int slot = 0;
        for (int i = 1; i < 6; i++) if (e.poison_t[i] < e.poison_t[slot]) slot = i;
        const bool viper = H.keystones & KS_VIPER;   // Scorpion's Kiss
        e.poison[slot] = pc * 0.25f * hh.poison_mult * (viper ? 1.4f : 1.f);
        e.poison_t[slot] = viper ? 3.f : 2.f;
    }
    bool storm_eye = (H.keystones & KS_STORM_EYE) && res.crit && (sk_tags & T_SPELL);   // Eye of the Storm
    if ((light > 0 && hh.shock > 0 && rng.chance(hh.shock)) || storm_eye) {
        e.shock = std::max(e.shock, 20.f * hh.shock_effect);
        e.shock_t = 4.f;
    }
    // Break
    float rally = res.total > 0 && H.rally_hit ? 1.5f : 1.f;
    e.break_meter += res.total / e.life_max * 100.f * 1.7f * hh.brk * rally * (unique ? 0.5f : 1.f);
    if (e.break_meter >= 100.f) {
        e.break_meter = 0;
        e.stun_t = unique ? 2.5f : 1.4f;
        e.broken_t = unique ? 5.f : 3.0f;
        e.act = Act::Stun;
        e.anim.play("stagger", 0.08f, true);
        emit(Ev::Break, e.pos);
        texts.push_back({vec3(e.pos, 2.4f), "BROKEN", 0xFF2E88, 0, 34});
        if (H.keystones & KS_ENDURANCE) gain_endurance(1);   // Riveted Skin
    } else if (e.act != Act::Stun && res.total > e.life_max * 0.12f && e.rarity < Rarity::Rare && e.frozen_t <= 0) {
        e.act = Act::Hit;
        e.act_t = 0;
        e.anim.play("hit", 0.04f, true);
    }
    emit(Ev::EnemyHit, e.pos, res.total);
    return res.total;
}

void World::glyph_pulse(GroundFx& g) {
    HeroHit hh = g.hh;
    for (size_t i = 1; i < actors.size(); i++) {
        Actor& e = actors[i];
        if (e.alive() && length(e.pos - g.pos) < g.radius + e.radius) hit_enemy(e, hh, g.pos, 0.3f);
    }
    burst(vec3(g.pos, 0.2f), 10, vec4(0.6f, 0.85f, 1.f, 0.8f), vec4(0.3f, 0.5f, 1.f, 0), 2.5f, 0.12f, 0.6f, true, 1.f);
    emit(Ev::Glyph, g.pos, 0.5f);
}

void World::star_fall(GroundFx& g) {
    for (size_t i = 1; i < actors.size(); i++) {
        Actor& e = actors[i];
        if (!e.alive() || length(e.pos - g.pos) > g.radius + e.radius) continue;
        float more = (e.chill_t > 0 || e.frozen_t > 0) ? 1.6f : 1.f;   // the payoff for setting up with cold
        hit_enemy(e, g.hh, g.pos, 4.f, more);
    }
    // a Frost Glyph it lands in bursts: its cold hits everything inside at three times a pulse
    for (auto& gl : ground) {
        if (gl.kind != GroundFx::Glyph || gl.t >= gl.life || length(gl.pos - g.pos) > gl.radius + g.radius * 0.5f) continue;
        HeroHit burst_hit = gl.hh;
        for (int t = 0; t < DT_COUNT; t++) { burst_hit.hit.min[size_t(t)] *= 3; burst_hit.hit.max[size_t(t)] *= 3; }
        burst_hit.freeze *= 2;
        for (size_t i = 1; i < actors.size(); i++) {
            Actor& e = actors[i];
            if (e.alive() && length(e.pos - gl.pos) < gl.radius + e.radius) hit_enemy(e, burst_hit, gl.pos, 3.f);
        }
        burst(vec3(gl.pos, 0.2f), 40, vec4(0.7f, 0.9f, 1.f, 1), vec4(0.3f, 0.5f, 1.f, 0), 7.f, 0.16f, 0.8f, true, -4.f);
        gl.t = gl.life;
        emit(Ev::Glyph, gl.pos, 2.f);
    }
    burst(vec3(g.pos, 0.2f), 36, vec4(1.f, 0.8f, 0.4f, 1), vec4(1.f, 0.3f, 0.1f, 0), 8.f, 0.14f, 0.7f, true, -10.f);
    burst(vec3(g.pos, 0.1f), 18, vec4(0.4f, 0.36f, 0.34f, 0.8f), vec4(0.3f, 0.27f, 0.25f, 0), 4.f, 0.4f, 1.0f, false, -5.f, 1);
    emit(Ev::StarFall, g.pos);
    hitstop = std::max(hitstop, 0.05f);
    shake = std::max(shake, 0.55f);
}

void World::resolve_skill(Actor& h) {
    SkillCtx c = slot_ctx(h.skill);
    if (!c.def) return;
    const SkillDef& sk = *c.def;
    Hero& H = hero;
    vec2 dir = from_angle(h.facing);
    HeroHit hh;
    hh.hit = c.hit;
    hh.ignite = c.ignite;
    hh.shock = c.shock;
    hh.shock_effect = c.shock_effect;
    hh.freeze = c.freeze;
    hh.brk = c.break_mult;
    hh.poison = c.poison;
    hh.poison_mult = c.poison_mult;
    hh.talisman = H.bar[h.skill];
    float more = 1.f;
    H.rally_hit = false;
    if (H.rally > 0 && (sk.tags & T_ATTACK)) { more = 1.f + 0.4f * (1 + H.stats.sum(S_WARCRY).inc / 100.f); H.rally--; H.rally_hit = true; }
    if ((sk.tags & T_SPELL) && in_glyph(h.pos)) more *= 1.3f;   // a spell cast inside a glyph is empowered
    if ((H.keystones & KS_OVERLOAD) != 0) {
        hh.hit.crit_multi = 1.f;                                   // al-Simak: crits deal no extra damage...
        if (H.overload_t > 0)                                       // ...but charge your elements
            for (int t = DT_FIRE; t <= DT_LIGHTNING; t++) { hh.hit.min[size_t(t)] *= 1.4f; hh.hit.max[size_t(t)] *= 1.4f; }
    }
    for (int t = 0; t < DT_COUNT; t++) { hh.hit.min[size_t(t)] *= more; hh.hit.max[size_t(t)] *= more; }
    const float area = c.area;
    int hits = 0;
    auto hit_all = [&](vec2 at, float r, bool cone, float half) {
        for (size_t i = 1; i < actors.size(); i++) {
            Actor& e = actors[i];
            if (!e.alive()) continue;
            vec2 d = e.pos - at;
            float dist = length(d);
            if (dist > r + e.radius) continue;
            if (cone && dist > 0.3f && std::fabs(wrap_angle(angle_of(d) - h.facing)) > half) continue;
            hit_enemy(e, hh, at, sk.tags & T_SLAM ? 4.f : 2.5f);
            hits++;
        }
    };
    switch (sk.shape) {
        case Shape::Cone: {
            hit_all(h.pos, sk.range * area, true, sk.angle);
            if (hits > 0) {
                H.combo++;
                if (H.combo % 3 == 0) {
                    GroundFx g;
                    g.kind = GroundFx::Crack;
                    g.pos = h.pos + dir * 1.7f;
                    g.radius = 1.3f;
                    g.life = 9;
                    g.seed = rng.next();
                    ground.push_back(g);
                    emit(Ev::SlamImpact, g.pos, 0.6f);
                }
            } else H.combo = 0;
            emit(Ev::Impact, h.pos + dir * 1.5f, float(hits));
            hitstop = hits ? 0.045f : 0.f;
            break;
        }
        case Shape::Circle: {
            vec2 at = h.pos + dir * sk.range;
            hit_all(at, sk.radius * area, false, 0);
            for (int k = -1; k <= 1; k++) {
                GroundFx g;
                g.kind = GroundFx::Crack;
                g.pos = at + rotate(dir, k * 0.55f) * (k == 0 ? 1.4f : 0.9f);
                g.radius = 1.4f;
                g.life = 9;
                g.seed = rng.next();
                ground.push_back(g);
            }
            burst(vec3(at, 0.1f), 20, vec4(0.42f, 0.37f, 0.33f, 0.6f), vec4(0.3f, 0.27f, 0.25f, 0), 5.f, 0.28f, 0.8f, false, -6.f, 1);
            burst(vec3(at, 0.1f), 14, vec4(1.f, 0.7f, 0.3f, 1), vec4(1.f, 0.3f, 0.1f, 0), 6.f, 0.1f, 0.5f, true, -12.f);
            emit(Ev::SlamImpact, at, 1.f);
            hitstop = 0.07f;
            shake = std::max(shake, 0.5f);
            break;
        }
        case Shape::Detonate: {
            int n = 0;
            for (auto& g : ground) {
                if (g.kind != GroundFx::Crack || length(g.pos - h.pos) > sk.range) continue;
                hit_all(g.pos, sk.radius * area, false, 0);
                burst(vec3(g.pos, 0.1f), 22, vec4(1.f, 0.62f, 0.25f, 1), vec4(0.8f, 0.2f, 0.05f, 0), 7.f, 0.16f, 0.7f, true, -10.f);
                burst(vec3(g.pos, 0.1f), 14, vec4(0.6f, 0.52f, 0.45f, 0.9f), vec4(0.4f, 0.35f, 0.3f, 0), 4.f, 0.4f, 0.9f, false, -5.f, 1);
                g.t = g.life;
                n++;
            }
            if (n == 0) {
                hit_all(h.pos + dir * 0.6f, 2.6f * area, false, 0);
                burst(vec3(h.pos + dir * 0.6f, 0.1f), 20, vec4(0.62f, 0.55f, 0.48f, 0.9f), vec4(0.4f, 0.35f, 0.3f, 0), 5.f, 0.35f, 0.8f, false, -6.f, 1);
            }
            emit(Ev::Aftershock, h.pos, float(std::max(1, n)));
            hitstop = 0.08f;
            shake = std::max(shake, 0.4f + 0.12f * n);
            break;
        }
        case Shape::Warcry: {
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                if (!e.alive() || length(e.pos - h.pos) > sk.radius * area + e.radius) continue;
                e.break_meter += 35.f * c.break_mult * (e.rarity >= Rarity::Rare ? 0.6f : 1.f);
                if (e.break_meter >= 100.f) {
                    e.break_meter = 0; e.stun_t = 1.4f; e.broken_t = 3; e.act = Act::Stun;
                    e.anim.play("stagger", 0.08f, true);
                    emit(Ev::Break, e.pos);
                }
            }
            H.rally = 3 + int(H.stats.sum(S_WARCRY).flat);
            GroundFx g;
            g.kind = GroundFx::Ring;
            g.pos = h.pos;
            g.radius = sk.radius * area;
            g.life = 0.6f;
            ground.push_back(g);
            emit(Ev::Warcry, h.pos);
            if (H.keystones & KS_IRON_CRY) gain_endurance(2);   // The Iron Cry
            shake = std::max(shake, 0.3f);
            break;
        }
        case Shape::Projectile: {
            int n = std::max(1, c.projectiles);
            float spread = n > 1 ? radians(9.f) : 0.f;
            for (int k = 0; k < n; k++) {
                Projectile p;
                vec2 pd = rotate(dir, (k - (n - 1) * 0.5f) * spread);
                p.pos = h.pos + pd * 0.8f;
                p.vel = pd * c.proj_speed;
                p.z = 1.3f;
                p.radius = sk.radius;
                p.life = sk.range / std::max(1.f, c.proj_speed);
                p.team = TEAM_HERO;
                p.arrow = (sk.tags & T_ATTACK) && sk.base_type == DT_PHYS;
                p.color = sk.base_type == DT_COLD ? vec3{0.5f, 0.8f, 1.f} : sk.base_type == DT_LIGHTNING ? vec3{0.7f, 0.8f, 1.f}
                        : p.arrow ? (sk.poison > 0 ? vec3{0.55f, 0.9f, 0.3f} : vec3{1.f, 0.85f, 0.6f}) : vec3{1.f, 0.55f, 0.2f};
                p.hh = hh;
                projectiles.push_back(p);
            }
            break;
        }
        case Shape::Chain: {
            // leap to the target in front, then to the nearest enemy not yet struck, up to `chains` times
            std::vector<uint32_t> struck;
            vec2 from = h.pos + vec2{0, 0} + dir * 0.6f;
            Actor* cur = nullptr;
            float bd = 1e9f;
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                vec2 d = e.pos - h.pos;
                float dist = length(d);
                if (!e.alive() || dist > sk.range + e.radius || std::fabs(wrap_angle(angle_of(d) - h.facing)) > radians(40)) continue;
                if (dist < bd) { bd = dist; cur = &e; }
            }
            vec2 end = h.pos + dir * sk.range * 0.6f;
            for (int jump = 0; jump <= c.chains; jump++) {
                GroundFx b;
                b.kind = GroundFx::Bolt;
                b.pos = from;
                b.pos2 = cur ? cur->pos : end;
                b.life = 0.22f;
                b.seed = rng.next();
                ground.push_back(b);
                if (!cur) break;
                struck.push_back(cur->id);
                vec2 at = cur->pos;
                hit_enemy(*cur, hh, from, 1.f);
                emit(Ev::LightningHit, at);
                from = at;
                Actor* next = nullptr;
                float nd = 1e9f;
                for (size_t i = 1; i < actors.size(); i++) {
                    Actor& e = actors[i];
                    if (!e.alive() || std::find(struck.begin(), struck.end(), e.id) != struck.end()) continue;
                    float dist = length(e.pos - at);
                    if (dist < sk.radius * area && dist < nd) { nd = dist; next = &e; }
                }
                cur = next;
                if (!cur) break;
            }
            break;
        }
        case Shape::Glyph: {
            GroundFx g;
            g.kind = GroundFx::Glyph;
            g.pos = level.resolve(h.target, 0.2f);
            g.radius = sk.radius * area;
            g.life = sk.duration;
            g.pulse = 0.f;
            g.seed = rng.next();
            g.hh = hh;
            ground.push_back(g);
            emit(Ev::Glyph, g.pos, 1.f);
            break;
        }
        case Shape::Mark: {   // the enemy aimed at (or the nearest in front): its next attack hits are sure crits
            Actor* best = nullptr;
            float bd = 1e9f;
            for (size_t i = 1; i < actors.size(); i++) {
                Actor& e = actors[i];
                vec2 d = e.pos - h.pos;
                float dist = length(d);
                if (!e.alive() || dist > sk.range + e.radius) continue;
                float score = dist + std::fabs(wrap_angle(angle_of(d) - h.facing)) * 6.f - (e.rarity >= Rarity::Rare ? 4.f : 0.f);
                if (score < bd) { bd = score; best = &e; }
            }
            if (best) {
                best->mark_t = c.mark_duration;
                best->mark_hits = c.mark_hits;
                texts.push_back({vec3(best->pos, 2.6f), "MARKED", 0xE8C860, 0, 30});
                meet_codex("marks");
                burst(vec3(best->pos, 1.8f * best->scale), 14, vec4(1.f, 0.85f, 0.4f, 1), vec4(1.f, 0.6f, 0.2f, 0), 3.f, 0.1f, 0.5f, true, 0.f);
                emit(Ev::Glyph, best->pos, 0.5f);
            }
            break;
        }
        case Shape::Rain: {   // three volleys on the spot, each hitting everything under it
            GroundFx g;
            g.kind = GroundFx::Rain;
            g.pos = level.resolve(h.target, 0.2f);
            g.radius = sk.radius * area;
            g.life = 1.05f;
            g.pulse = 0.3f;
            g.hh = hh;
            ground.push_back(g);
            break;
        }
        case Shape::Meteor: {
            GroundFx g;
            g.kind = GroundFx::Meteor;
            g.pos = level.resolve(h.target, 0.2f);
            g.radius = sk.radius * area;
            g.life = 0.55f;
            g.seed = rng.next();
            g.hh = hh;
            ground.push_back(g);
            break;
        }
        default: break;
    }
}

void World::ailments_step(Actor& m, float dt) {
    if (m.ignite_t > 0) {
        m.ignite_t -= dt;
        m.life -= m.ignite_dps * dt;
        if (fx_rng.chance(0.25f))
            burst(vec3(m.pos, 0.8f * m.scale), 1, vec4(1.f, 0.55f, 0.15f, 0.9f), vec4(0.8f, 0.2f, 0.05f, 0), 1.2f, 0.14f, 0.5f, true, 2.f);
        if (m.life <= 0 && m.alive()) kill(m);
    }
    float pd = 0;
    for (int i = 0; i < 6; i++)
        if (m.poison_t[i] > 0) { m.poison_t[i] -= dt; pd += m.poison[i]; }
    if (pd > 0) {
        m.life -= pd * dt;
        if (fx_rng.chance(0.3f))
            burst(vec3(m.pos, 0.9f * m.scale), 1, vec4(0.45f, 0.9f, 0.3f, 0.9f), vec4(0.2f, 0.5f, 0.1f, 0), 0.8f, 0.12f, 0.6f, true, 1.f);
        if (m.life <= 0 && m.alive()) kill(m);
    }
    if (m.mark_t > 0 && ((m.mark_t -= dt) <= 0 || m.mark_hits <= 0)) { m.mark_t = 0; m.mark_hits = 0; }
    if (m.chill_t > 0 && (m.chill_t -= dt) <= 0) m.chill = 0;
    if (m.shock_t > 0 && (m.shock_t -= dt) <= 0) m.shock = 0;
    if (m.frozen_t > 0) m.frozen_t -= dt;
    m.freeze_meter = std::max(0.f, m.freeze_meter - 8.f * dt);
}

void World::kill(Actor& e) {
    e.act = Act::Dead;
    e.life = 0;
    e.dead_t = 0;
    e.anim.play("death", 0.05f, true);
    const MonsterDef& d = monster_defs()[size_t(e.def)];
    float xp = d.xp * (e.rarity == Rarity::Rare ? 6.f : e.rarity == Rarity::Magic ? 2.f : 1.f);
    xp *= 1.f + 0.3f * float(area_level - 1);                  // deeper areas are worth more
    if (in_chart) xp *= 1.f + astro_value(chart.astro, AX_XP) / 100.f;
    if (haboob.inside(e.pos)) haboob.meter += (e.rarity >= Rarity::Rare ? 5.f : e.rarity == Rarity::Magic ? 2.5f : 1.5f) *
                                              (1.f + astro_value(chart.astro, AX_HABOOB_METER) / 100.f);
    if (int over = hero.level - area_level - 2; over > 0)      // and little once you have outgrown them
        xp *= std::max(0.15f, 1.f - 0.2f * float(over));
    if (d.attack == AttackKind::Boss) {
        boss_killed = true;
        emit(Ev::BossDie, e.pos);
    }
    hero.xp += xp;
    hero.kills++;
    if (e.rift) {   // the rift's dead leave splinters
        rift.kills++;
        int n = e.rarity == Rarity::Rare ? 8 : e.rarity == Rarity::Magic ? 3 : rng.chance(0.6f) ? 1 : 0;
        if (n) drop_currency(level.resolve(e.pos, 0.3f), CUR_SPLINTER, n);
    }
    // the Ranger's charges and what passes on at a death: a Mark (Falcon's Ward), poisons (Plague Road)
    if (e.mark_t > 0) gain_frenzy(1);
    if ((hero.keystones & KS_KILL_FRENZY) && rng.chance(0.35f)) gain_frenzy(1);
    bool poisoned = false;
    for (float pt : e.poison_t) poisoned = poisoned || pt > 0;
    if ((e.mark_t > 0 && (hero.keystones & KS_MARK_SPREAD)) || (poisoned && (hero.keystones & KS_PLAGUE))) {
        Actor* near = nullptr;
        float nd = 6.f;
        for (size_t i = 1; i < actors.size(); i++) {
            Actor& o = actors[i];
            if (&o == &e || !o.alive()) continue;
            float d = length(o.pos - e.pos);
            if (poisoned && (hero.keystones & KS_PLAGUE) && d < 3.5f)
                for (int k = 0; k < 6; k++) if (e.poison_t[k] > o.poison_t[k]) { o.poison[k] = e.poison[k]; o.poison_t[k] = e.poison_t[k]; }
            if (d < nd) { nd = d; near = &o; }
        }
        if (near && e.mark_t > 0 && (hero.keystones & KS_MARK_SPREAD)) {
            near->mark_t = std::max(near->mark_t, e.mark_t);
            near->mark_hits = std::max(near->mark_hits, std::max(1, e.mark_hits));
            texts.push_back({vec3(near->pos, 2.6f), "MARKED", 0xE8C860, 0, 30});
        }
        if (poisoned && (hero.keystones & KS_PLAGUE)) burst(vec3(e.pos, 0.6f), 16, vec4(0.45f, 0.9f, 0.3f, 0.9f), vec4(0.2f, 0.5f, 0.1f, 0), 4.f, 0.15f, 0.6f, true, 0.f);
    }
    hero.flask = std::min(hero.flask_max, hero.flask + 0.25f);
    for (size_t i = 0; i < 4; i++) if (e.mods[i] == MM_VAMPIRIC) {}
    // level up
    for (;;) {
        float need = 90.f * std::pow(float(hero.level), 1.55f);
        if (hero.xp < need || hero.level >= 100) break;
        hero.xp -= need;
        hero.level++;
        recompute_hero();
        actors[0].life = actors[0].life_max;
        actors[0].mana = actors[0].mana_max;
        emit(Ev::LevelUp, actors[0].pos);
        texts.push_back({vec3(actors[0].pos, 2.6f), "LEVEL UP", 0xF2A541, 0, 44});
    }
    emit(Ev::EnemyDie, e.pos, e.scale, e.def);
    drop_loot(e);
}

void World::drop_loot(const Actor& e) {
    float rare = 0, magic = 0.05f, chance = 0.07f;
    auto scatter = [&](float r) { return e.pos + vec2{rng.range(-r, r), rng.range(-r, r)}; };
    if (e.rarity == Rarity::Unique) {
        for (int k = 0; k < 4; k++) {
            GroundItem g;
            g.item = random_drop(area_level + 2, k < 2 ? 1.f : 0.4f, 0.6f, rng, k == 0 ? Slot::Weapon : Slot::Count);
            g.pos = level.resolve(e.pos + rotate(vec2{1.4f, 0}, k * 1.57f + 0.4f), 0.3f);
            g.id = next_id++;
            loot.push_back(g);
        }
        for (int k = 0; k < 4; k++) drop_currency(e.pos + rotate(vec2{2.2f, 0}, k * 1.57f), k == 0 ? CUR_PIASTRE : roll_currency(rng, area_level + 2), 1);
        drop_gold(e.pos + vec2{0, -1.8f}, 60 + 12 * area_level);
        drop_special(e.pos + vec2{1.6f, -1.2f}, GroundItem::Wafq, rng.irange(0, WQ_COUNT - 1));
        drop_special(e.pos + vec2{-1.6f, -1.2f}, GroundItem::Blank, std::min(20, area_level + 1));
        if (in_chart)   // a site's master always carries charts
            for (int k = 0, n = boss_chart_drops(chart, rng); k < n; k++) {
                GroundItem g;
                g.item = make_chart(roll_chart_tier(chart, rng), rng, 0.4f, 0.12f);
                g.pos = level.resolve(e.pos + rotate(vec2{2.8f, 0}, 0.3f + k * 0.8f), 0.3f);
                g.id = next_id++;
                loot.push_back(g);
            }
        if (int u = random_unique(area_level + 2, rng); u >= 0) drop_special(e.pos + vec2{0, 1.8f}, GroundItem::Scrap, u);
        const bool lord = std::string(monster_defs()[size_t(e.def)].id) == "rift_lord";   // the Rift Lord: a unique, always
        if (lord)
            for (int k = 0; k < 3; k++) drop_currency(e.pos + rotate(vec2{3.0f, 0}, 0.8f + k * 0.7f), roll_currency(rng, area_level + 4), 1);
        if (rng.chance(lord ? 1.f : 0.08f)) if (int u = random_unique(area_level + 2, rng); u >= 0) {
            GroundItem g;
            g.item = make_unique(u, area_level + 2, rng);
            g.pos = level.resolve(e.pos + vec2{0, 2.6f}, 0.3f);
            g.id = next_id++;
            loot.push_back(g);
        }
        return;
    }
    // charts drop inside charts (and, rarely, in the act's last reaches)
    if (in_chart && rng.chance(chart_drop_chance(chart, e.rarity))) {
        GroundItem g;
        float mc = 0.3f * (1.f + astro_value(chart.astro, AX_MAGIC_CHARTS) / 100.f);
        g.item = make_chart(roll_chart_tier(chart, rng), rng, mc, 0.08f * (1.f + astro_value(chart.astro, AX_MAGIC_CHARTS) / 100.f));
        g.pos = level.resolve(scatter(0.9f), 0.3f);
        g.id = next_id++;
        loot.push_back(g);
    }
    const float qty = in_chart ? 1.f + (chart.mods.quantity + astro_value(chart.astro, AX_QUANTITY)) / 100.f : 1.f;
    const float rar = in_chart ? 1.f + (chart.mods.rarity + astro_value(chart.astro, AX_RARITY)) / 100.f : 1.f;
    // Poster Scraps, and now and then a unique itself
    float sc = (e.rarity == Rarity::Rare ? 0.05f : e.rarity == Rarity::Magic ? 0.012f : 0.0015f) *
               (in_chart ? 1.f + astro_value(chart.astro, AX_SCRAPS) / 100.f : 1.f);
    if (rng.chance(sc)) if (int u = random_unique(area_level, rng); u >= 0) drop_special(scatter(0.9f), GroundItem::Scrap, u);
    float un = e.rarity == Rarity::Rare ? 0.006f : e.rarity == Rarity::Magic ? 0.001f : 0.0002f;
    if (rng.chance(un)) if (int u = random_unique(area_level, rng); u >= 0) {
        GroundItem g;
        g.item = make_unique(u, area_level, rng);
        g.pos = level.resolve(scatter(0.6f), 0.3f);
        g.id = next_id++;
        loot.push_back(g);
    }
    // Wafq and Blank Talismans: rare finds, likelier from stronger monsters
    float wq = e.rarity == Rarity::Rare ? 0.3f : e.rarity == Rarity::Magic ? 0.06f : 0.008f;
    if (rng.chance(wq)) drop_special(scatter(0.9f), GroundItem::Wafq, rng.irange(0, WQ_COUNT - 1));
    float bl = e.rarity == Rarity::Rare ? 0.35f : e.rarity == Rarity::Magic ? 0.07f : 0.012f;
    if (rng.chance(bl)) drop_special(scatter(0.9f), GroundItem::Blank, std::clamp(area_level + rng.irange(-1, 1), 1, 20));
    // currency and dinars
    float cur_chance = (e.rarity == Rarity::Rare ? 0.9f : e.rarity == Rarity::Magic ? 0.25f : 0.045f) * qty *
                       (in_chart ? 1.f + astro_value(chart.astro, AX_CURRENCY) / 100.f : 1.f);
    if (rng.chance(cur_chance)) drop_currency(scatter(0.8f), roll_currency(rng, area_level), 1);
    float gold_chance = e.rarity == Rarity::Normal ? 0.22f : 1.f;
    if (rng.chance(gold_chance)) drop_gold(scatter(0.8f), int(rng.irange(2, 5) * (1 + area_level * 0.5f) * (e.rarity == Rarity::Rare ? 5 : 1)));
    if (e.rarity == Rarity::Rare) { chance = 1.f; rare = 1.f; }
    else if (e.rarity == Rarity::Magic) { chance = 0.35f; rare = 0.15f; magic = 0.6f; }
    chance = std::min(1.f, chance * qty);
    rare = std::min(1.f, rare * rar);
    magic = std::min(1.f - rare, magic * rar);
    if (!rng.chance(chance)) return;
    GroundItem g;
    // early on, a third of drops are weapons: the maul is the build
    Slot only = rng.chance(0.35f) ? Slot::Weapon : Slot::Count;
    g.item = random_drop(area_level + (e.rarity == Rarity::Rare ? 2 : 0), rare, magic, rng, only);
    g.pos = level.resolve(scatter(0.6f), 0.3f);
    g.id = next_id++;
    loot.push_back(g);
}

float World::evade_chance() const {
    // PoE's shape: evasion against the monsters' accuracy, which grows with the area; never more than 75%
    float e = std::max(0.f, hero.stats.value(S_EVASION)), acc = 18.f + 8.f * float(area_level);
    float k = std::pow(e / 4.f, 0.9f);
    return clampf(k / (acc + k), 0.f, 0.75f);
}

void World::damage_hero(float lo, float hi, int type, vec2 from, float break_amt, uint32_t attacker, bool evadable) {
    Actor& h = actors[0];
    if (!h.alive()) return;
    if (evadable && rng.chance(evade_chance())) {
        texts.push_back({vec3(h.pos, 2.2f), "EVADED", 0xB8D8A0, 0, 28});
        meet_codex("evasion");
        emit(Ev::Dodge, h.pos);
        return;
    }
    HitDamage hd;
    hd.min[size_t(type)] = lo;
    hd.max[size_t(type)] = hi;
    if (in_chart && attacker && chart.mods.extra_fire > 0) {   // a Burning chart: their hits carry fire too
        hd.min[DT_FIRE] += lo * chart.mods.extra_fire / 100.f;
        hd.max[DT_FIRE] += hi * chart.mods.extra_fire / 100.f;
    }
    Defences def = defences_of(hero.stats, in_chart ? -chart.mods.hero_res : 0.f);
    const int ec = hero.endurance;
    for (int t : {DT_FIRE, DT_COLD, DT_LIGHTNING}) def.res[size_t(t)] += 4.f * ec;   // Endurance Charges
    HitResult r = roll_hit(hd, def, rng);
    if (attacker) hero.last_attacker = attacker;
    if (ec > 0) r.by_type[DT_PHYS] *= 1.f - 0.04f * ec;
    if (hero.keystones & KS_PLATE)   // Plate upon Plate: armour at half value against the elemental part of a hit
        for (int t : {DT_FIRE, DT_COLD, DT_LIGHTNING})
            r.by_type[size_t(t)] *= 1.f - armour_reduction(def.armour * 0.5f, r.by_type[size_t(t)]);
    float taken = 0;
    for (float v : r.by_type) taken += v;
    if ((hero.keystones & KS_UNSHAKEN) && ec >= endurance_max()) taken *= 0.85f;   // Unshaken
    if (haboob.inside(h.pos)) taken *= std::max(0.5f, 1.f - astro_value(chart.astro, AX_STORM_GUARD) / 100.f);
    r.total = taken;
    float soak = std::min(hero.es, taken);                     // Hirz takes the hit first
    hero.es -= soak;
    hero.es_wait = 2.f;
    h.life -= taken - soak;
    h.hit_flash = 0.6f;
    if (!(hero.keystones & KS_UNSHAKEN)) h.knock += normalize(h.pos - from) * 1.5f;
    emit(Ev::HeroHit, h.pos, r.total / std::max(1.f, h.life_max));
    shake = std::max(shake, 0.25f);
    (void)break_amt;
    if (h.life <= 0) {
        h.life = 0;
        h.act = Act::Dead;
        h.dead_t = 0;
        h.anim.play("death", 0.05f, true);
        emit(Ev::HeroDie, h.pos);
    }
}

void World::monster_attack(Actor& m) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    Actor& h = actors[0];
    if (!h.alive()) return;
    vec2 fwd = from_angle(m.facing);
    float lo = d.dmg_min * m.dmg_mult * (1 + 0.12f * (area_level - 1)), hi = d.dmg_max * m.dmg_mult * (1 + 0.12f * (area_level - 1));
    switch (d.attack) {
        case AttackKind::Boss: break;  // boss_strike handles her
        case AttackKind::Claw: {
            vec2 dd = h.pos - m.pos;
            float dist = length(dd);
            if (dist <= d.attack_range * m.scale + h.radius + 0.2f && std::fabs(wrap_angle(angle_of(dd) - m.facing)) < radians(75))
                damage_hero(lo, hi, d.dmg_type, m.pos, 10, m.id);
            break;
        }
        case AttackKind::Slam: {
            vec2 c = m.pos + fwd * 1.3f * m.scale;
            if (length(h.pos - c) <= 1.7f * m.scale + h.radius) damage_hero(lo, hi, d.dmg_type, c, 30, m.id);
            burst(vec3(c, 0.1f), 18, vec4(0.5f, 0.45f, 0.42f, 0.9f), vec4(0.3f, 0.28f, 0.26f, 0), 4.f, 0.35f, 0.8f, false, -5.f, 1);
            emit(Ev::SlamImpact, c, 0.8f);
            shake = std::max(shake, 0.35f);
            break;
        }
        case AttackKind::Leap: {
            if (length(h.pos - m.target) <= 1.8f * m.scale + h.radius) damage_hero(lo, hi, d.dmg_type, m.target, 20, m.id);
            burst(vec3(m.target, 0.1f), 16, vec4(0.5f, 0.45f, 0.42f, 0.9f), vec4(0.3f, 0.28f, 0.26f, 0), 4.f, 0.3f, 0.7f, false, -5.f, 1);
            emit(Ev::SlamImpact, m.target, 0.6f);
            break;
        }
        case AttackKind::Beam: {
            // a line of lightning from the dish to where the telegraph pointed
            vec2 end = m.target;
            vec2 ab = end - m.pos;
            float t = clampf(dot(h.pos - m.pos, ab) / std::max(1e-3f, dot(ab, ab)), 0, 1);
            if (length(h.pos - (m.pos + ab * t)) < 0.9f + h.radius) damage_hero(lo, hi, d.dmg_type, m.pos, 8, m.id);
            GroundFx b;
            b.kind = GroundFx::Bolt;
            b.pos = m.pos;
            b.pos2 = end;
            b.life = 0.25f;
            b.seed = rng.next();
            ground.push_back(b);
            emit(Ev::LightningHit, end);
            break;
        }
        case AttackKind::Spit: {
            Projectile p;
            vec2 target = h.pos + h.vel * 0.35f;
            vec2 dir = normalize(target - m.pos);
            p.pos = m.pos + dir * 0.6f;
            p.vel = dir * 10.f;
            p.dmg_min = lo;
            p.dmg_max = hi;
            p.dmg_type = d.dmg_type;
            p.owner = m.id;
            projectiles.push_back(p);
            emit(Ev::Spit, m.pos);
            break;
        }
    }
    for (int i = 0; i < 4; i++)
        if (m.mods[i] == MM_VAMPIRIC) m.life = std::min(m.life_max, m.life + m.life_max * 0.04f);
}

void World::monster_step(Actor& m, float dt) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    Actor& h = actors[0];
    m.broken_t = std::max(0.f, m.broken_t - dt);
    m.knock = m.knock * std::exp(-10.f * dt);
    if (m.act == Act::Dead) {
        m.dead_t += dt;
        if (m.dead_t > 0.8f && m.dead_t - dt <= 0.8f)
            burst(vec3(m.pos, 0.6f), 30, vec4(0.55f, 0.5f, 0.52f, 0.85f), vec4(0.35f, 0.32f, 0.34f, 0), 1.6f, 0.3f, 1.4f, false, 1.5f, 1);
        anim_step(m, dt);
        return;
    }
    ailments_step(m, dt);
    if (*d.codex && length(m.pos - h.pos) < 11.f) meet_codex(d.codex);   // the first time you meet the family
    if (!m.alive()) return;
    if (m.frozen_t > 0) {  // frozen solid: no thought, no motion, only knockback
        m.vel = {0, 0};
        m.pos = level.resolve(m.pos + m.knock * dt, m.radius);
        return;
    }
    const float slow = 1.f - m.chill;  // chilled: everything they do runs slower
    dt *= slow;
    if (d.attack == AttackKind::Boss) { boss_step(m, dt); return; }
    vec2 to = h.pos - m.pos;
    float dist = length(to);
    vec2 dir = dist > 1e-4f ? to / dist : vec2{0, 1};
    vec2 want{0, 0};
    m.attack_cd -= dt * m.speed_mult;
    m.act_t += dt;
    switch (m.act) {
        case Act::Stun:
            m.stun_t -= dt;
            if (m.stun_t <= 0) { m.act = Act::Idle; }
            break;
        case Act::Hit:
            if (m.anim.done()) m.act = Act::Idle;
            break;
        case Act::Skill: {
            const bool rigid = d.rigid || !m.model.skel;
            const char* ev = d.attack == AttackKind::Spit ? "fire" : "hit";
            if (m.act_t < 0.3f && d.attack != AttackKind::Beam && d.attack != AttackKind::Leap)
                m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
            float hit_t = rigid ? 0.9f : (m.anim.cur ? m.anim.cur->event_time(ev, 0.5f) / std::max(0.1f, m.anim.speed) : 0.5f);
            if (d.attack == AttackKind::Leap) {  // airborne from the start of the clip to its strike
                float u = smoothstep(0.1f, 1.f, clampf(m.act_t / std::max(0.1f, hit_t), 0, 1));
                m.pos = level.resolve(lerp(m.from, m.target, u), m.radius);
            }
            bool fire = rigid ? m.act_t >= hit_t : (m.anim.event(ev) || m.act_t >= hit_t + 0.05f);
            if (!m.struck && fire) { m.struck = true; monster_attack(m); }
            bool done = rigid ? m.act_t >= hit_t + 0.5f : (m.anim.done() || !m.anim.cur);
            if (done) {
                m.act = Act::Idle;
                m.attack_cd = d.attack_cd * rng.range(0.8f, 1.25f);
            }
            if (d.attack == AttackKind::Leap) { anim_step(m, dt); return; }
            break;
        }
        default: {
            const bool rigid = d.rigid || !m.model.skel;
            bool aggro = m.ai_state > 0 || dist < 13.f || m.life < m.life_max;
            if (!aggro || !h.alive()) { if (!rigid) m.anim.play("idle", 0.25f); break; }
            m.ai_state = 1;
            float reach = (d.attack == AttackKind::Spit || d.attack == AttackKind::Beam || d.attack == AttackKind::Leap)
                              ? d.attack_range : d.attack_range * m.scale + h.radius;
            bool in_range = dist <= reach && (d.attack != AttackKind::Leap || dist > 2.5f || m.attack_cd > 0);
            if (d.attack == AttackKind::Leap && dist <= 2.5f) in_range = dist <= 1.8f * m.scale + h.radius;   // close in: a leap is a pounce
            if (d.keep_distance > 0) {
                if (dist < d.keep_distance - 1.5f) want = -dir * m.speed * 0.8f;
                else if (dist > d.keep_distance + 1.f) want = dir * m.speed;
            } else if (!in_range && m.speed > 0) {
                want = dir * m.speed;
                // no straight line to the hero: follow the nav grid round the walls
                m.ai_t -= dt;
                if (!level.line_clear(m.pos, h.pos, 0.3f)) {
                    if (m.ai_t <= 0 || length(m.target - m.pos) < 0.7f) {
                        std::vector<vec2> path;
                        m.ai_t = 0.6f + fx_rng.range(0, 0.3f);
                        if (level.find_path(m.pos, h.pos, 0.55f, path) && !path.empty()) m.target = path.front();
                        else m.target = h.pos;
                    }
                    if (length(m.target - m.pos) > 0.1f) want = normalize(m.target - m.pos) * m.speed;
                }
            }
            if (in_range && m.attack_cd <= 0 && (d.attack != AttackKind::Beam || level.line_clear(m.pos, h.pos, 0.1f))) {
                m.act = Act::Skill;
                m.act_t = 0;
                m.struck = false;
                m.facing = angle_of(to);
                const char* clip = d.attack == AttackKind::Claw ? "claw" : d.attack == AttackKind::Slam ? "slam" : d.attack == AttackKind::Leap ? "leap" : "spit";
                if (!rigid && !m.anim.play(clip, 0.08f, true, m.speed_mult)) m.anim.play(d.attack == AttackKind::Leap ? "slam" : "claw", 0.08f, true, m.speed_mult);
                // telegraph on the ground for everything that can really hurt
                GroundFx g;
                g.kind = GroundFx::Telegraph;
                g.owner = m.id;
                const Clip* c = rigid ? nullptr : m.anim.cur;
                float hit_t = rigid ? 0.9f : c ? c->event_time(d.attack == AttackKind::Spit ? "fire" : "hit", 0.5f) / m.speed_mult : 0.5f;
                g.life = hit_t;
                if (d.attack == AttackKind::Slam) { g.pos = m.pos + from_angle(m.facing) * 1.3f * m.scale; g.radius = 1.7f * m.scale; g.half = kPi; }
                else if (d.attack == AttackKind::Claw) { g.pos = m.pos; g.radius = d.attack_range * m.scale + 0.3f; g.half = radians(75); g.angle = m.facing; }
                else if (d.attack == AttackKind::Leap) {
                    m.from = m.pos;
                    m.target = level.resolve(h.pos + h.vel * 0.25f, m.radius);
                    g.pos = m.target;
                    g.radius = 1.8f * m.scale;
                    g.half = kPi;
                } else if (d.attack == AttackKind::Beam) {
                    m.target = m.pos + dir * d.attack_range;
                    g.kind = GroundFx::Line;
                    g.pos = m.pos;
                    g.pos2 = m.target;
                    g.radius = 0.9f;
                }
                if (d.attack != AttackKind::Spit) ground.push_back(g);
            }
            if (rigid) {
                if (length(want) < 0.1f && m.act == Act::Idle) m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 3.f));
            } else if (length(want) > 0.1f) {
                m.facing = wrap_angle(m.facing + wrap_angle(angle_of(want) - m.facing) * std::min(1.f, dt * 8.f));
                m.anim.play("run", 0.15f, false, clampf(length(want) / 4.3f, 0.6f, 1.4f));
            } else if (m.act == Act::Idle) {
                m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
                m.anim.play("idle", 0.25f);
            }
        }
    }
    m.vel = lerp(m.vel, want, std::min(1.f, dt * 10.f));
    m.pos = level.resolve(m.pos + (m.vel + m.knock) * dt, m.radius);
    if (d.rigid || !m.model.skel) m.hit_flash = std::max(0.f, m.hit_flash - dt * 6.f);
    else anim_step(m, dt);
}

// ---- bosses: moves from a table (boss_def), each resolved on its clip's events or, for a possessed object with no
// skeleton, on a timer. Leashed to their court: engaged, they follow a way; if the hero escapes or dies they walk home
// and heal.
namespace {
// a strike's timing when there is no clip: when it lands, and when the move is over
constexpr float kRigidHit = 0.85f, kRigidEnd = 1.5f;
}

void World::boss_strike(Actor& m, const char* ev) {
    Actor& h = actors[0];
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    const BossDef* bd = boss_def(m.def);
    if (!bd || m.skill < 0 || m.skill >= int(bd->moves.size())) return;
    const BossMove& mv = bd->moves[size_t(m.skill)];
    float k = 1 + 0.12f * (area_level - 1);
    float lo = d.dmg_min * k * m.dmg_mult * mv.dmg, hi = d.dmg_max * k * m.dmg_mult * mv.dmg;
    (void)ev;
    switch (mv.kind) {
        case MoveKind::Combo: {
            vec2 dd = h.pos - m.pos;
            if (length(dd) <= d.attack_range * std::max(1.f, m.scale * 0.8f) + h.radius &&
                std::fabs(wrap_angle(angle_of(dd) - m.facing)) < radians(70))
                damage_hero(lo, hi, d.dmg_type, m.pos, 12, m.id);
            break;
        }
        case MoveKind::Leap:
            if (length(h.pos - m.target) <= 2.7f + h.radius) damage_hero(lo, hi, d.dmg_type, m.target, 25, m.id);
            burst(vec3(m.target, 0.1f), 30, vec4(0.45f, 0.4f, 0.36f, 0.8f), vec4(0.3f, 0.27f, 0.25f, 0), 6.f, 0.35f, 1.0f, false, -6.f, 1);
            emit(Ev::SlamImpact, m.target, 1.2f);
            emit(Ev::BossLeap, m.target);
            shake = std::max(shake, 0.7f);
            break;
        case MoveKind::Wail: {
            if (bd->call) {   // the Call: it does not hurt much, but it draws you to her
                if (length(h.pos - m.pos) <= 9.f) {
                    damage_hero(h.life_max * 0.1f, h.life_max * 0.14f, DT_CHAOS, h.pos * 2.f - m.pos, 0, m.id, false);
                    h.knock += normalize(m.pos - h.pos) * std::min(22.f, length(m.pos - h.pos) * 3.f);
                    texts.push_back({vec3(h.pos, 2.4f), "YOUR NAME", 0x9FF0FF, 0, 32});
                }
            } else if (length(h.pos - m.pos) <= 7.5f) damage_hero(h.life_max * 0.28f, h.life_max * 0.34f, DT_CHAOS, m.pos, 40, m.id);
            GroundFx g;
            g.kind = GroundFx::Ring;
            g.pos = m.pos;
            g.radius = 7.5f;
            g.life = 0.7f;
            ground.push_back(g);
            emit(Ev::BossWail, m.pos, 2.f);
            shake = std::max(shake, 0.6f);
            break;
        }
        case MoveKind::Nova: {
            float r = mv.max_range;
            if (length(h.pos - m.pos) <= r + h.radius) damage_hero(lo, hi, d.dmg_type, m.pos, 30, m.id, false);
            GroundFx g;
            g.kind = GroundFx::Ring;
            g.pos = m.pos;
            g.radius = r;
            g.life = 0.6f;
            ground.push_back(g);
            vec4 c = d.dmg_type == DT_FIRE ? vec4(1.f, 0.5f, 0.15f, 1) : d.dmg_type == DT_LIGHTNING ? vec4(0.6f, 0.75f, 1.f, 1) : vec4(0.6f, 0.55f, 0.5f, 1);
            burst(vec3(m.pos, 0.3f), 40, c, c * 0.3f, 8.f, 0.16f, 0.6f, true, -4.f);
            emit(Ev::SlamImpact, m.pos, 1.3f);
            shake = std::max(shake, 0.55f);
            break;
        }
        case MoveKind::Summon: {
            int g = bd->summon && *bd->summon ? find_monster(bd->summon) : -1;
            if (g < 0) break;
            emit(Ev::Summon, m.pos);
            for (int i = 0; i < bd->summon_n; i++) {
                vec2 p = level.resolve(m.pos + rotate(vec2{3.2f, 0}, i * kTau / float(bd->summon_n) + 0.3f), 0.5f);
                Actor& a = spawn_monster(g, p, Rarity::Normal, area_level);
                a.ai_state = 1;
                burst(vec3(p, 0.1f), 16, vec4(0.4f, 0.35f, 0.3f, 0.8f), vec4(0.3f, 0.25f, 0.2f, 0), 3.f, 0.3f, 0.9f, false, -4.f, 1);
            }
            break;
        }
        case MoveKind::Volley: {
            vec2 aim = normalize(h.pos + h.vel * 0.3f - m.pos);
            for (int i = -2; i <= 2; i++) {
                Projectile p;
                vec2 dir = rotate(aim, i * 0.2f);
                p.pos = m.pos + dir * (m.radius + 0.4f);
                p.vel = dir * 11.f;
                p.z = 1.4f * std::max(1.f, m.scale * 0.8f);
                p.dmg_min = lo * 0.6f;   // a fan: at close range more than one bolt lands
                p.dmg_max = hi * 0.6f;
                p.dmg_type = d.dmg_type;
                p.color = bd->bolt;
                p.owner = m.id;
                p.life = 2.2f;
                projectiles.push_back(p);
            }
            emit(Ev::Spit, m.pos);
            break;
        }
        case MoveKind::Pools:
            for (int i = 0; i < 3; i++) {
                GroundFx g;
                g.kind = d.dmg_type == DT_COLD ? GroundFx::Water : GroundFx::Fire;
                g.pos = level.resolve(h.pos + rotate(vec2{i == 0 ? 0.f : 2.4f, 0}, i * 2.1f + rng.range(0, 1)), 0.2f);
                g.radius = 1.5f;
                g.life = 4.5f;
                g.pulse = 0.9f;   // a moment to step out before it bites
                g.owner = m.id;
                g.hh.hit.min[size_t(d.dmg_type)] = lo;
                g.hh.hit.max[size_t(d.dmg_type)] = hi;
                ground.push_back(g);
            }
            emit(d.dmg_type == DT_COLD ? Ev::Splash : Ev::FireHit, h.pos);
            break;
        case MoveKind::Charge: break;   // resolved while it travels (boss_step)
        case MoveKind::Blink: break;
    }
}

void World::boss_step(Actor& m, float dt) {
    const MonsterDef& d = monster_defs()[size_t(m.def)];
    const BossDef* bd = boss_def(m.def);
    Actor& h = actors[0];
    if (!bd) return;
    vec2 to = h.pos - m.pos;
    float dist = length(to);
    vec2 dir = dist > 1e-4f ? to / dist : vec2{0, 1};
    float haste = m.phase ? bd->haste2 : 1.f;
    for (size_t i = 0; i < bd->moves.size() && i < 8; i++) m.move_cd[i] -= dt * haste;
    m.act_t += dt;
    vec2 want{0, 0};
    const bool rigid = d.rigid || !m.model.skel;
    auto telegraph = [&](GroundFx::Kind kind, vec2 at, float r, float half, float angle, float life, vec2 at2 = {}) {
        GroundFx g;
        g.kind = kind;
        g.owner = m.id;
        g.pos = at;
        g.pos2 = at2;
        g.radius = r;
        g.half = half;
        g.angle = angle;
        g.life = life;
        ground.push_back(g);
    };
    auto hit_time = [&](const char* ev) {
        if (rigid) return kRigidHit;
        const Clip* c = m.anim.cur;
        return c ? c->event_time(ev, 0.8f) / std::max(0.1f, m.anim.speed) : 0.8f;
    };
    auto start = [&](int i) {
        const BossMove& mv = bd->moves[size_t(i)];
        m.act = Act::Skill;
        m.act_t = 0;
        m.skill = i;
        m.struck = false;
        m.facing = angle_of(to);
        m.move_cd[i] = mv.cooldown;
        if (!rigid && !(mv.clip && *mv.clip && m.anim.play(mv.clip, 0.08f, true, haste)))
            m.anim.play(mv.kind == MoveKind::Combo ? "claw" : "slam", 0.08f, true, haste);
        switch (mv.kind) {
            case MoveKind::Combo: telegraph(GroundFx::Telegraph, m.pos, d.attack_range * std::max(1.f, m.scale * 0.8f) + 0.4f, radians(70), m.facing, hit_time("hit")); break;
            case MoveKind::Leap: {
                m.from = m.pos;
                vec2 aim = h.pos + h.vel * 0.3f;
                if (length(aim - m.home) > bd->court) aim = m.home + normalize(aim - m.home) * bd->court;
                m.target = level.resolve(aim, m.radius);
                telegraph(GroundFx::Telegraph, m.target, 2.7f, kPi, 0, hit_time("hit"));
                break;
            }
            case MoveKind::Wail: telegraph(GroundFx::Telegraph, m.pos, 7.5f, kPi, 0, hit_time("hit")); break;
            case MoveKind::Nova: telegraph(GroundFx::Telegraph, m.pos, mv.max_range, kPi, 0, hit_time("hit")); break;
            case MoveKind::Charge: {
                m.from = m.pos;
                vec2 aim = m.pos + dir * std::min(14.f, dist + 4.f);
                m.target = level.resolve(aim, m.radius);
                telegraph(GroundFx::Line, m.pos, m.radius + 0.4f, 0, 0, kRigidHit, m.target);
                break;
            }
            case MoveKind::Blink: {
                // vanish, and step out beside the hero
                burst(vec3(m.pos, 1.0f), 24, vec4(0.5f, 0.6f, 0.5f, 0.8f), vec4(0.2f, 0.25f, 0.2f, 0), 3.f, 0.3f, 0.7f, false, 1.f, 1);
                m.pos = level.resolve(h.pos - from_angle(h.facing) * 3.f + perp(dir) * rng.range(-1.5f, 1.5f), m.radius);
                burst(vec3(m.pos, 1.0f), 24, vec4(0.5f, 0.6f, 0.5f, 0.8f), vec4(0.2f, 0.25f, 0.2f, 0), 3.f, 0.3f, 0.7f, false, 1.f, 1);
                emit(Ev::Portal, m.pos, 0.5f);
                for (size_t k = 0; k < bd->moves.size(); k++) if (bd->moves[k].kind == MoveKind::Combo) m.move_cd[k] = 0;
                m.act = Act::Idle;
                break;
            }
            default: break;
        }
    };
    switch (m.act) {
        case Act::Stun:
            m.stun_t -= dt;
            if (m.stun_t <= 0) m.act = Act::Idle;
            break;
        case Act::Skill: {
            const BossMove& mv = bd->moves[size_t(m.skill)];
            float t_hit = hit_time(mv.kind == MoveKind::Summon ? "summon" : "hit");
            if (mv.kind == MoveKind::Leap) {  // airborne: travel to the landing point
                float p = rigid ? clampf(m.act_t / kRigidHit, 0, 1) : m.anim.progress();
                m.pos = lerp(m.from, m.target, smoothstep(rigid ? 0.2f : 0.3f, rigid ? 1.f : 0.66f, p));
            }
            if (mv.kind == MoveKind::Charge && m.act_t >= kRigidHit && m.act_t < kRigidHit + 0.55f) {
                // the dash: fast along the telegraphed line, and whoever is in the way is struck once
                float u = clampf((m.act_t - kRigidHit) / 0.55f, 0, 1);
                m.pos = level.resolve(lerp(m.from, m.target, u), m.radius);
                if (!m.struck && length(h.pos - m.pos) < m.radius + h.radius + 0.3f) {
                    m.struck = true;
                    float k = 1 + 0.12f * (area_level - 1);
                    damage_hero(d.dmg_min * k * mv.dmg, d.dmg_max * k * mv.dmg, DT_PHYS, m.pos, 40, m.id);
                    h.knock += normalize(h.pos - m.pos) * 6.f;
                    shake = std::max(shake, 0.6f);
                }
                if (fx_rng.chance(0.5f)) burst(vec3(m.pos, 0.2f), 3, vec4(0.5f, 0.45f, 0.4f, 0.7f), vec4(0.3f, 0.28f, 0.25f, 0), 2.f, 0.3f, 0.6f, false, 1.f, 1);
            } else if (!m.struck && mv.kind != MoveKind::Charge) {
                bool fire = rigid ? m.act_t >= t_hit : (m.anim.event(mv.kind == MoveKind::Summon ? "summon" : "hit") || m.anim.event("hit") ||
                                                        (m.anim.cur && m.act_t >= t_hit + 0.05f));
                if (fire) { m.struck = true; boss_strike(m, "hit"); }
            }
            if (mv.kind == MoveKind::Combo && !rigid && m.anim.event("hit2")) boss_strike(m, "hit2");
            bool done = rigid ? m.act_t >= kRigidEnd : (m.anim.done() || !m.anim.cur || m.act_t > 4.f);
            if (done) {
                m.act = Act::Idle;
                if (mv.kind == MoveKind::Wail) {  // spent after the wail: a Break window
                    m.act = Act::Stun;
                    m.stun_t = 1.8f;
                    m.broken_t = 3.0f;
                    m.anim.play("stagger", 0.1f, true);
                    texts.push_back({vec3(m.pos, 3.2f), "EXHAUSTED", 0xFF2E88, 0, 34});
                }
            }
            break;
        }
        default: {
            float leash = m.ai_state > 0 ? bd->court + 17.f : bd->court + 8.f;
            if (length(h.pos - m.home) > leash || !h.alive()) {
                m.ai_state = 0;
                vec2 back = m.home - m.pos;
                if (length(back) > 0.8f) {
                    want = normalize(back) * m.speed;
                    m.facing = wrap_angle(m.facing + wrap_angle(angle_of(back) - m.facing) * std::min(1.f, dt * 6.f));
                    if (!rigid) m.anim.play("run", 0.15f, false, 1.f);
                } else if (!rigid) {
                    m.anim.play("idle", 0.25f);
                }
                m.life = std::min(m.life_max, m.life + m.life_max * 0.08f * dt);
                if (m.life >= m.life_max) {  // fully reset
                    m.phase = 0;
                    m.break_meter = 0;
                    for (size_t i = 0; i < bd->moves.size() && i < 8; i++) m.move_cd[i] = bd->moves[i].phase ? 1e9f : 0.f;
                }
                break;
            }
            bool aggro = m.ai_state > 0 || dist < 11.f || m.life < m.life_max;
            if (!aggro) { if (!rigid) m.anim.play("idle", 0.25f); break; }
            m.ai_state = 1;
            if (m.phase == 0 && m.life < m.life_max * bd->phase2_at) {
                m.phase = 1;
                for (size_t i = 0; i < bd->moves.size() && i < 8; i++)
                    if (bd->moves[i].phase) m.move_cd[i] = bd->moves[i].kind == MoveKind::Summon ? 0.f : bd->moves[i].cooldown * 0.45f;
                texts.push_back({vec3(m.pos, 3.4f), bd->phase2_line, 0xFF2E88, 0, 38});
            }
            int pick = -1;
            for (size_t i = 0; i < bd->moves.size() && i < 8; i++) {
                const BossMove& mv = bd->moves[i];
                if (mv.phase > m.phase || m.move_cd[i] > 0) continue;
                float reach = mv.kind == MoveKind::Combo ? d.attack_range * std::max(1.f, m.scale * 0.8f) + h.radius : mv.max_range;
                if (dist < mv.min_range || dist > reach) continue;
                pick = int(i);
                break;
            }
            if (pick >= 0) { start(pick); break; }
            want = dir * m.speed * haste;
            m.facing = wrap_angle(m.facing + wrap_angle(angle_of(to) - m.facing) * std::min(1.f, dt * 6.f));
            if (!rigid) m.anim.play("run", 0.15f, false, 1.f);
        }
    }
    bool moving_itself = m.act == Act::Skill && m.skill >= 0 && m.skill < int(bd->moves.size()) &&
                         (bd->moves[size_t(m.skill)].kind == MoveKind::Leap || bd->moves[size_t(m.skill)].kind == MoveKind::Charge);
    if (!moving_itself) {
        m.vel = lerp(m.vel, want, std::min(1.f, dt * 8.f));
        m.pos = level.resolve(m.pos + (m.vel + m.knock * 0.3f) * dt, m.radius);
    }
    if (rigid) m.hit_flash = std::max(0.f, m.hit_flash - dt * 6.f);
    else anim_step(m, dt);
}

void World::separate() {
    for (size_t i = 0; i < actors.size(); i++) {
        Actor& a = actors[i];
        if (!a.alive()) continue;
        for (size_t j = i + 1; j < actors.size(); j++) {
            Actor& b = actors[j];
            if (!b.alive()) continue;
            vec2 d = b.pos - a.pos;
            float r = a.radius + b.radius;
            float l2 = dot(d, d);
            if (l2 >= r * r || l2 < 1e-8f) continue;
            float l = std::sqrt(l2);
            vec2 push = d / l * (r - l);
            float wa = i == 0 ? 0.15f : 0.5f, wb = 0.5f;
            a.pos -= push * wa;
            b.pos += push * wb;
        }
    }
    // townsfolk stand their ground
    Actor& h = actors[0];
    for (const Npc& n : npcs) {
        vec2 d = h.pos - n.pos;
        float r = h.radius + 0.35f * n.scale, len = length(d);
        if (len < r && len > 1e-4f) h.pos = level.resolve(n.pos + d / len * r, h.radius);
    }
}

void World::burst(vec3 p, int n, vec4 c0, vec4 c1, float speed, float size, float life, bool additive, float gravity, uint8_t shape) {
    for (int i = 0; i < n && particles.size() < 3000; i++) {
        vec3 dir = normalize(vec3{fx_rng.range(-1, 1), fx_rng.range(-1, 1), fx_rng.range(0.1f, 1.2f)});
        Particle q;
        q.pos = p;
        q.vel = dir * speed * fx_rng.range(0.4f, 1.f);
        q.life = q.max_life = life * fx_rng.range(0.6f, 1.2f);
        q.size0 = size * fx_rng.range(0.7f, 1.3f);
        q.size1 = shape == 1 ? q.size0 * 1.8f : q.size0 * 0.3f;
        q.gravity = gravity;
        q.drag = shape == 1 ? 2.5f : 1.f;
        q.c0 = c0;
        q.c1 = c1;
        q.shape = shape;
        q.additive = additive;
        particles.push_back(q);
    }
}

void World::fx_step(float dt) {
    for (auto& p : particles) {
        p.vel.z += p.gravity * dt;
        p.vel = p.vel * std::exp(-p.drag * dt);
        p.pos += p.vel * dt;
        if (p.pos.z < 0.02f) { p.pos.z = 0.02f; p.vel.z *= -0.3f; p.vel = p.vel * 0.7f; }
        p.life -= dt;
    }
    particles.erase(std::remove_if(particles.begin(), particles.end(), [](const Particle& p) { return p.life <= 0; }), particles.end());
    for (auto& t : texts) { t.t += dt; t.pos.z += dt * 1.2f; }
    texts.erase(std::remove_if(texts.begin(), texts.end(), [](const FloatText& t) { return t.t > 1.1f; }), texts.end());
    shake = std::max(0.f, shake - dt * 1.8f);
}

}  // namespace q
