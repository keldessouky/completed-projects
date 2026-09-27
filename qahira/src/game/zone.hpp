// Procedural zones: a grid of cells carved into a path from an entrance to a boss court, with side branches.
#pragma once
#include "core/math.hpp"
#include "game/level.hpp"
#include <string>
#include <vector>

namespace q {

enum CellMask : uint8_t { DIR_N = 1, DIR_E = 2, DIR_S = 4, DIR_W = 8 };

struct ZoneCell {
    int x = 0, y = 0;
    uint8_t mask = 0;
    enum Kind : uint8_t { Normal, Entrance, Arena, Branch, Landmark } kind = Normal;
    int depth = 0;       // steps from the entrance along the carved graph
    bool main = false;   // on the entrance -> boss path
};

struct ZoneLayout {
    int w = 0, h = 0;
    float cell = 16.f;
    std::vector<ZoneCell> cells;
    int entrance = -1, arena = -1, landmark = -1;
    uint32_t seed = 0;
    vec2 center(const ZoneCell& c) const { return {c.x * cell, c.y * cell}; }
    const ZoneCell* at(int x, int y) const;
    int cell_index_at(vec2 p) const;   // the cell containing a world position, -1 outside
};

ZoneLayout generate_zone(uint32_t seed, int w, int h, int branches);
void build_zone_level(const ZoneLayout& z, const char* tileset, Level& level);  // tileset: "necro"
uint8_t rotate_mask(uint8_t m, int quarter_turns_ccw);

}  // namespace q
