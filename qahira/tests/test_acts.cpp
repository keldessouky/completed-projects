// The campaign's zones: every zone in the table generates, its tiles join, and a hero can walk from the entrance
// to every cell. Needs the pack (tools/pack.py) for the tiles' colliders; skipped without it.
#include "tests/check.hpp"
#include "core/pack.hpp"
#include "game/acts.hpp"
#include "game/level.hpp"
#include "game/zone.hpp"
#include "game/areas.hpp"
#include <cstdio>
#include <string>

using namespace q;

static bool open_pack() {
    static int state = -1;
    if (state < 0) state = pack().open_file((std::string(QAHIRA_SOURCE_DIR) + "/build/Qahira.qpk").c_str()) ? 1 : 0;
    return state == 1;
}

TEST(every_zone_can_be_walked_from_its_entrance) {
    if (!open_pack()) { std::printf("  (skipped: no build/Qahira.qpk)\n"); return; }
    for (auto& zd : zone_defs()) {
        int bad = 0;
        for (uint32_t seed = 1; seed <= 20; seed++) {
            ZoneLayout z = generate_zone(seed * 2246822519u, zd.w, zd.h, zd.branches);
            Level L;
            build_zone_level(z, zd.tileset, L);
            CHECK(L.tiles.size() == z.cells.size());
            vec2 from = z.center(z.cells[size_t(z.entrance)]);
            std::vector<vec2> path;
            for (auto& c : z.cells) {
                if (&c == &z.cells[size_t(z.entrance)]) continue;
                if (!L.find_path(from, z.center(c), 0.55f, path)) {
                    if (bad++ < 3) std::printf("  %s seed %u: no way from the entrance to cell (%d,%d) kind %d mask %d\n", zd.id, seed, c.x, c.y, int(c.kind), c.mask);
                }
            }
        }
        CHECK(bad == 0);
    }
}

TEST(every_monster_a_zone_spawns_can_be_reached) {
    if (!open_pack()) { std::printf("  (skipped: no build/Qahira.qpk)\n"); return; }
    for (size_t zi = 0; zi < zone_defs().size(); zi++) {
        const ZoneDef& zd = zone_defs()[zi];
        int bad = 0, total = 0;
        for (uint32_t seed = 1; seed <= 8; seed++) {
            ZoneLayout z = generate_zone(seed * 2654435761u, zd.w, zd.h, zd.branches);
            World w;
            build_zone_level(z, zd.tileset, w.level);
            w.actors.resize(1);
            populate_zone(w, z, zd, zd.level);
            vec2 from = z.center(z.cells[size_t(z.entrance)]);
            std::vector<vec2> path;
            for (size_t i = 1; i < w.actors.size(); i++) {
                total++;
                const Actor& m = w.actors[i];
                // reachable: a path to it, or to a spot beside it (a sentinel may stand against a wall)
                bool ok = w.level.find_path(from, m.pos, 0.55f, path);
                for (int k = 0; k < 8 && !ok; k++) ok = w.level.find_path(from, m.pos + rotate(vec2{m.radius + 0.9f, 0}, k * kPi / 4), 0.55f, path);
                if (!ok && bad++ < 3) std::printf("  %s seed %u: %s at (%.1f,%.1f) cannot be reached\n", zd.id, seed, m.name.c_str(), m.pos.x, m.pos.y);
            }
        }
        CHECK(total > 0 && bad == 0);
    }
}
