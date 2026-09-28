#include "game/zone.hpp"
#include "core/log.hpp"
#include <algorithm>

namespace q {

uint8_t rotate_mask(uint8_t m, int r) {
    for (int i = 0; i < (r & 3); i++)
        m = uint8_t(((m & DIR_N) ? DIR_W : 0) | ((m & DIR_E) ? DIR_N : 0) | ((m & DIR_S) ? DIR_E : 0) | ((m & DIR_W) ? DIR_S : 0));
    return m;
}

const ZoneCell* ZoneLayout::at(int x, int y) const {
    for (auto& c : cells) if (c.x == x && c.y == y) return &c;
    return nullptr;
}

int ZoneLayout::cell_index_at(vec2 p) const {
    int x = int(std::floor(p.x / cell + 0.5f)), y = int(std::floor(p.y / cell + 0.5f));
    for (size_t i = 0; i < cells.size(); i++) if (cells[i].x == x && cells[i].y == y) return int(i);
    return -1;
}

ZoneLayout generate_zone(uint32_t seed, int w, int h, int branches) {
    ZoneLayout z;
    z.w = w;
    z.h = h;
    z.seed = seed;
    Rng rng(seed);
    std::vector<int> grid(size_t(w * h), -1);
    auto idx = [&](int x, int y) { return y * w + x; };
    auto add = [&](int x, int y) {
        ZoneCell c;
        c.x = x;
        c.y = y;
        z.cells.push_back(c);
        grid[size_t(idx(x, y))] = int(z.cells.size()) - 1;
        return int(z.cells.size()) - 1;
    };
    auto link = [&](int a, int b) {
        ZoneCell& A = z.cells[size_t(a)];
        ZoneCell& B = z.cells[size_t(b)];
        if (B.y > A.y) { A.mask |= DIR_N; B.mask |= DIR_S; }
        else if (B.y < A.y) { A.mask |= DIR_S; B.mask |= DIR_N; }
        else if (B.x > A.x) { A.mask |= DIR_E; B.mask |= DIR_W; }
        else { A.mask |= DIR_W; B.mask |= DIR_E; }
    };
    // main path: a biased random walk up the grid
    int x = rng.irange(0, w - 1), y = 0;
    int cur = add(x, y);
    z.entrance = cur;
    z.cells[size_t(cur)].kind = ZoneCell::Entrance;
    z.cells[size_t(cur)].main = true;
    int guard = 0;
    while (y < h - 1 && guard++ < 200) {
        int dir;
        float r = rng.uniform();
        if (r < 0.55f) dir = 0;             // north
        else if (r < 0.775f) dir = 1;       // east
        else dir = 2;                       // west
        int nx = x + (dir == 1) - (dir == 2), ny = y + (dir == 0);
        if (nx < 0 || nx >= w || grid[size_t(idx(nx, ny))] >= 0) { nx = x; ny = y + 1; }
        int nc = add(nx, ny);
        link(cur, nc);
        z.cells[size_t(nc)].main = true;
        z.cells[size_t(nc)].depth = z.cells[size_t(cur)].depth + 1;
        cur = nc;
        x = nx;
        y = ny;
    }
    // the last cell becomes the boss court: step once more north if possible so it is a clean dead end
    if (z.cells[size_t(cur)].mask != DIR_S && y + 1 < h && grid[size_t(idx(x, y + 1))] < 0) {
        int nc = add(x, y + 1);
        link(cur, nc);
        z.cells[size_t(nc)].main = true;
        z.cells[size_t(nc)].depth = z.cells[size_t(cur)].depth + 1;
        cur = nc;
    }
    z.arena = cur;
    z.cells[size_t(cur)].kind = ZoneCell::Arena;
    // side branches off the main path (never from the entrance or the arena)
    for (int b = 0; b < branches; b++) {
        std::vector<int> from;
        for (size_t i = 0; i < z.cells.size(); i++)
            if (z.cells[i].main && int(i) != z.entrance && int(i) != z.arena) from.push_back(int(i));
        if (from.empty()) break;
        int src = from[size_t(rng.irange(0, int(from.size()) - 1))];
        int len = rng.irange(1, 2);
        int c = src;
        for (int k = 0; k < len; k++) {
            ZoneCell cc = z.cells[size_t(c)];
            int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
            int start = rng.irange(0, 3);
            bool placed = false;
            for (int t = 0; t < 4 && !placed; t++) {
                int* d = dirs[(start + t) % 4];
                int nx = cc.x + d[0], ny = cc.y + d[1];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[size_t(idx(nx, ny))] >= 0) continue;
                // never open into the arena's side
                int nc = add(nx, ny);
                link(c, nc);
                z.cells[size_t(nc)].kind = ZoneCell::Branch;
                z.cells[size_t(nc)].depth = z.cells[size_t(c)].depth + 1;
                c = nc;
                placed = true;
            }
            if (!placed) break;
        }
    }
    // the landmark: the deepest branch dead end becomes the qubba court with the Lamplighter's cache
    int best = -1;
    for (size_t i = 0; i < z.cells.size(); i++) {
        const ZoneCell& c = z.cells[i];
        bool dead_end = c.mask == DIR_N || c.mask == DIR_E || c.mask == DIR_S || c.mask == DIR_W;
        if (c.kind == ZoneCell::Branch && dead_end && (best < 0 || c.depth > z.cells[size_t(best)].depth)) best = int(i);
    }
    if (best >= 0) {
        z.landmark = best;
        z.cells[size_t(best)].kind = ZoneCell::Landmark;
    }
    return z;
}

void build_zone_level(const ZoneLayout& z, const char* tileset, Level& level) {
    struct Canon { const char* name; uint8_t mask; };
    static const Canon canon[] = {{"end", DIR_N}, {"straight", DIR_N | DIR_S}, {"corner", DIR_N | DIR_E}, {"tee", DIR_N | DIR_E | DIR_S},
                                  {"cross", 15}};
    level.clear();
    Rng rng(z.seed ^ 0x5bd1e995u);
    for (const ZoneCell& c : z.cells) {
        std::string base;
        uint8_t canon_mask = 0;
        if (c.kind == ZoneCell::Entrance) { base = std::string(tileset) + "_entrance_0"; canon_mask = DIR_N; }
        else if (c.kind == ZoneCell::Arena) { base = std::string(tileset) + "_arena_0"; canon_mask = DIR_S; }
        else if (c.kind == ZoneCell::Landmark) { base = std::string(tileset) + "_landmark_0"; canon_mask = DIR_N; }
        int rot = -1;
        if (base.empty()) {
            for (auto& k : canon)
                for (int r = 0; r < 4 && rot < 0; r++)
                    if (rotate_mask(k.mask, r) == c.mask) { base = std::string(tileset) + "_" + k.name + "_" + std::to_string(rng.irange(0, 1)); rot = r; canon_mask = k.mask; }
        } else {
            for (int r = 0; r < 4; r++) if (rotate_mask(canon_mask, r) == c.mask) { rot = r; break; }
        }
        if (rot < 0) { QWARN("zone cell mask %d has no tile", c.mask); rot = 0; }
        level.add_tile(base, z.center(c), rot);
    }
}

}  // namespace q
