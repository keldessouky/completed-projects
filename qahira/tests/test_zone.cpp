// Zones and navigation: generated layouts are sound, tiles rotate the right way, and paths go round walls.
#include "tests/check.hpp"
#include "game/level.hpp"
#include "game/zone.hpp"
#include <deque>

using namespace q;

TEST(rotate_mask_turns_counter_clockwise) {
    CHECK(rotate_mask(DIR_N, 1) == DIR_W);
    CHECK(rotate_mask(DIR_E, 1) == DIR_N);
    CHECK(rotate_mask(DIR_N | DIR_E, 2) == (DIR_S | DIR_W));
    CHECK(rotate_mask(DIR_N | DIR_E | DIR_S, 4) == (DIR_N | DIR_E | DIR_S));
}

TEST(zones_are_connected_with_dead_end_courts) {
    for (uint32_t seed = 1; seed <= 300; seed++) {
        ZoneLayout z = generate_zone(seed * 2654435761u, 4, 6, 3);
        CHECK(z.entrance >= 0 && z.arena >= 0 && z.entrance != z.arena);
        auto single = [](uint8_t m) { return m == DIR_N || m == DIR_E || m == DIR_S || m == DIR_W; };
        CHECK(single(z.cells[size_t(z.arena)].mask));
        CHECK(single(z.cells[size_t(z.entrance)].mask));
        if (z.landmark >= 0) CHECK(single(z.cells[size_t(z.landmark)].mask));
        // openings agree on both sides, and every cell is reachable from the entrance
        const int dx[4] = {0, 1, 0, -1}, dy[4] = {1, 0, -1, 0};
        const uint8_t bit[4] = {DIR_N, DIR_E, DIR_S, DIR_W}, back[4] = {DIR_S, DIR_W, DIR_N, DIR_E};
        std::vector<int> seen(z.cells.size(), 0);
        std::deque<int> q{z.entrance};
        seen[size_t(z.entrance)] = 1;
        while (!q.empty()) {
            const ZoneCell& c = z.cells[size_t(q.front())];
            q.pop_front();
            for (int k = 0; k < 4; k++) {
                if (!(c.mask & bit[k])) continue;
                const ZoneCell* n = z.at(c.x + dx[k], c.y + dy[k]);
                CHECK(n != nullptr);
                if (!n) continue;
                CHECK(n->mask & back[k]);
                int ni = int(n - z.cells.data());
                if (!seen[size_t(ni)]) { seen[size_t(ni)] = 1; q.push_back(ni); }
            }
        }
        for (int s : seen) CHECK(s == 1);
    }
}

TEST(nav_grid_finds_the_way_round_a_wall) {
    Level L;
    L.lo = {-10, -10};
    L.hi = {10, 10};
    L.colliders.push_back({{0, 0}, {0.5f, 7.f}});   // a wall from y=-7 to 7 down the middle
    std::vector<vec2> path;
    CHECK(L.find_path({-5, 0}, {5, 0}, 0.45f, path));
    CHECK(path.size() >= 2);
    CHECK_NEAR(path.back().x, 5, 1e-3);
    vec2 at{-5, 0};
    for (vec2 p : path) { CHECK(L.line_clear(at, p, 0.4f)); at = p; }   // every leg is walkable
    Level box;
    box.lo = {-10, -10};
    box.hi = {10, 10};
    for (auto c : {Collider{{0, 3}, {3, 0.5f}}, Collider{{0, -3}, {3, 0.5f}}, Collider{{3, 0}, {0.5f, 3}}, Collider{{-3, 0}, {0.5f, 3}}})
        box.colliders.push_back(c);
    CHECK(!box.find_path({-8, -8}, {0, 0}, 0.45f, path));  // sealed room
}
