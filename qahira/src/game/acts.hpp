// The campaign's zones (GDD §9): each is a generated grid of one region's cells, with its level, its monsters, its
// landmark, and what waits at its far end (a boss, a trial gate, the way on). Act I runs
//   Downtown -> the Metro -> Khan el-Khalili -> al-Muizz Street (-> the Bab Zuweila trial) -> the City of the Dead
//   -> the Mokattam cliffs, and Act II
//   the River Road -> Kafr al-Nakhl -> the Ibrahimiya Canal -> Karnak -> the Valley of the Kings -> the Deep Tomb, and Act III
//   the White Desert -> the Great Sand Sea -> Siwa (-> the Bab al-Futuh trial) -> Shali -> the Hill of the Oracle
// and each zone's far court leads on to the next. Waypoints at the zone entrances carry you back to any you have seen.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace q {

struct SpawnEntry { const char* monster; int weight; };

struct ZoneDef {
    const char* id;
    const char* name;
    const char* subtitle;
    const char* tileset;          // region name in tools/art/env (necro, downtown, metro, ...)
    int act;
    int level;                    // monster level (the "area level")
    int w, h, branches;           // the grid the generator walks
    const char* music;
    const char* ambience;
    SpawnEntry spawns[5];         // weighted pack members
    const char* elite;            // the monster that turns up rare or magic in dead ends
    const char* boss;             // a unique in the far court ("" when a rare guards the way on)
    const char* boss_line;        // the banner when it falls
    const char* next;             // the zone the far court leads to ("" at an act's end)
    const char* landmark;         // what the landmark court holds: "cache", "bench", "poster"
    const char* side;             // an optional zone reached from the far court (Bab Zuweila from al-Muizz)
    bool trial;                   // an ascendancy trial: a toll slot, and two ascendancy points on the boss
    int toll_slot;                // the equipment slot the gatekeeper seals (-1 none)
    float env_tint[3];            // fog and ambient mood of the region
};

const std::vector<ZoneDef>& zone_defs();
int find_zone(const std::string& id);   // -1 if unknown
const ZoneDef& zone_def(int i);

// Quests (GDD §5.4: 24 of the 123 points come from quests). Bits in Hero::quests.
enum Quest : uint32_t {
    Q_MICROBUS = 1u << 0, Q_SILAH = 1u << 1, Q_NASNAS = 1u << 2, Q_TRIAL1 = 1u << 3, Q_GHULA = 1u << 4, Q_QUTRUB = 1u << 5,
    Q_BENCH = 1u << 6, Q_ACT1 = 1u << 7,
    Q_NADDAHA = 1u << 8, Q_RAM = 1u << 9, Q_MARID = 1u << 10, Q_ACT2 = 1u << 11,   // Act II
    Q_DABA = 1u << 12, Q_TRIAL2 = 1u << 13, Q_WRAITH = 1u << 14, Q_ACT3 = 1u << 15,  // Act III
    Q_SARAB = 1u << 16, Q_DOOR = 1u << 17, Q_SALT = 1u << 18, Q_ACT4 = 1u << 19,    // Act IV
    Q_PRESSER = 1u << 20, Q_TRIAL3 = 1u << 21, Q_SMOKE = 1u << 22, Q_QANDISHA = 1u << 23, Q_ACT5 = 1u << 24,   // Act V
};
// All resistances fall as the campaign goes on (GDD §9): -30% once Act III is over.
inline float act_res_penalty(uint32_t quests) { return (quests & Q_ACT3) ? 30.f : 0.f; }
struct QuestDef { uint32_t bit; const char* title; const char* text; int passive_points; int asc_points; };
const std::vector<QuestDef>& quest_defs();
int quest_passive_points(uint32_t quests);
int quest_asc_points(uint32_t quests);

}  // namespace q
