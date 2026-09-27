#include "game/level.hpp"
#include "game/assets.hpp"
#include "core/json.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"
#include <queue>

namespace q {

bool TileDef::load(const std::string& n) {
    name = n;
    Blob b = pack().get("data/tiles/" + n + ".json");
    if (!b) { QERR("tile %s missing", n.c_str()); return false; }
    std::string err;
    Json j = Json::parse(b.str(), &err);
    if (!err.empty()) { QERR("tile %s: %s", n.c_str(), err.c_str()); return false; }
    size = {j["size"][0].f(), j["size"][1].f()};
    for (auto& l : j["lights"].arr)
        lights.push_back({{l["p"][0].f(), l["p"][1].f(), l["p"][2].f()}, l["r"].f(), {l["c"][0].f(), l["c"][1].f(), l["c"][2].f()}});
    for (auto& c : j["colliders"].arr) colliders.push_back({{c[0].f(), c[1].f()}, {c[2].f(), c[3].f()}});
    for (auto& kv : j["points"].obj) points.push_back({kv.first, {kv.second[0].f(), kv.second[1].f()}});
    return true;
}

void Level::clear() {
    tiles.clear();
    colliders.clear();
    lights.clear();
    points.clear();
    lo = {1e9f, 1e9f};
    hi = {-1e9f, -1e9f};
    nav_dirty_ = true;
}

static vec2 rot90(vec2 p, int r) {
    for (int i = 0; i < (r & 3); i++) p = {-p.y, p.x};
    return p;
}

void Level::add_tile(const std::string& name, vec2 offset, int rot) {
    TileDef d;
    if (!d.load(name)) return;
    tiles.push_back({name, nullptr, offset, rot & 3});
    bool swap = rot & 1;
    for (auto& c : d.colliders) colliders.push_back({rot90(c.c, rot) + offset, swap ? vec2{c.h.y, c.h.x} : c.h});
    for (auto& l : d.lights) lights.push_back({vec3(rot90(l.p.xy(), rot) + offset, l.p.z), l.r, l.c});
    for (auto& pt : d.points) points.push_back({pt.first, rot90(pt.second, rot) + offset});
    vec2 hs = (swap ? vec2{d.size.y, d.size.x} : d.size) * 0.5f;
    lo = {std::min(lo.x, offset.x - hs.x), std::min(lo.y, offset.y - hs.y)};
    hi = {std::max(hi.x, offset.x + hs.x), std::max(hi.y, offset.y + hs.y)};
    nav_dirty_ = true;
}

void Level::bind_gpu() {
    for (auto& t : tiles) t.mesh = assets().mesh(t.name);
}

vec2 Level::resolve(vec2 p, float r) const {
    for (int iter = 0; iter < 2; iter++)
        for (const auto& c : colliders) {
            vec2 d = p - c.c;
            vec2 q{clampf(d.x, -c.h.x, c.h.x), clampf(d.y, -c.h.y, c.h.y)};
            vec2 diff = d - q;
            float dist = length(diff);
            if (dist < r) {
                if (dist > 1e-5f) p += diff / dist * (r - dist);
                else {  // centre inside the box: leave by the nearest face
                    float ox = c.h.x - std::fabs(d.x), oy = c.h.y - std::fabs(d.y);
                    if (ox < oy) p.x = c.c.x + sign(d.x) * (c.h.x + r);
                    else p.y = c.c.y + sign(d.y) * (c.h.y + r);
                }
            }
        }
    p.x = clampf(p.x, lo.x + r, hi.x - r);
    p.y = clampf(p.y, lo.y + r, hi.y - r);
    return p;
}

vec2 Level::point(const std::string& name, vec2 def) const {
    for (auto& pt : points) if (pt.first == name) return pt.second;
    return def;
}

bool Level::blocked(vec2 p, float r) const {
    for (const auto& c : colliders) {
        vec2 d = p - c.c;
        vec2 q{clampf(d.x, -c.h.x, c.h.x), clampf(d.y, -c.h.y, c.h.y)};
        if (length(d - q) < r) return true;
    }
    return p.x < lo.x || p.x > hi.x || p.y < lo.y || p.y > hi.y;
}

void Level::render(Renderer& r, float time, vec2 focus) const {
    for (auto& t : tiles) {
        if (!t.mesh) continue;
        if (std::fabs(t.offset.x - focus.x) > 30.f || std::fabs(t.offset.y - focus.y) > 34.f) continue;  // well off screen
        Instance in;
        in.model = mat4::translate(vec3(t.offset, 0)) * mat4::rot_z(t.rot * kPi / 2);
        r.draw(t.mesh, in);
    }
    for (size_t i = 0; i < lights.size(); i++) {
        const auto& l = lights[i];
        if (length(l.p.xy() - focus) > 28.f) continue;
        float flick = 0.92f + 0.08f * std::sin(time * (3.f + (i % 5)) + float(i) * 1.7f);
        r.light(l.p, l.r, l.c * flick);
    }
}

// ---------------------------------------------------------------- navigation
void Level::build_nav(float radius) const {
    NavGrid& g = nav_;
    g.radius = radius;
    g.origin = lo;
    g.w = std::max(1, int(std::ceil((hi.x - lo.x) / g.cell)));
    g.h = std::max(1, int(std::ceil((hi.y - lo.y) / g.cell)));
    g.solid.assign(size_t(g.w * g.h), 0);
    // rasterise every collider grown by the radius (square corners: a little conservative)
    for (const auto& c : colliders) {
        int x0 = std::max(0, int(std::floor((c.c.x - c.h.x - radius - lo.x) / g.cell)));
        int x1 = std::min(g.w - 1, int(std::floor((c.c.x + c.h.x + radius - lo.x) / g.cell)));
        int y0 = std::max(0, int(std::floor((c.c.y - c.h.y - radius - lo.y) / g.cell)));
        int y1 = std::min(g.h - 1, int(std::floor((c.c.y + c.h.y + radius - lo.y) / g.cell)));
        for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++) g.solid[size_t(y * g.w + x)] = 1;
    }
    for (int x = 0; x < g.w; x++) g.solid[size_t(x)] = g.solid[size_t((g.h - 1) * g.w + x)] = 1;
    for (int y = 0; y < g.h; y++) g.solid[size_t(y * g.w)] = g.solid[size_t(y * g.w + g.w - 1)] = 1;
    nav_dirty_ = false;
}

bool Level::line_clear(vec2 a, vec2 b, float radius) const {
    float len = length(b - a);
    int steps = std::max(1, int(len / 0.25f));
    for (int i = 0; i <= steps; i++)
        if (blocked(lerp(a, b, float(i) / steps), radius)) return false;
    return true;
}

bool Level::find_path(vec2 from, vec2 to, float radius, std::vector<vec2>& out) const {
    out.clear();
    if (nav_dirty_ || std::fabs(nav_.radius - radius) > 1e-3f) build_nav(radius);
    const NavGrid& g = nav_;
    auto cell_of = [&](vec2 p) {
        int x = std::clamp(int((p.x - g.origin.x) / g.cell), 0, g.w - 1), y = std::clamp(int((p.y - g.origin.y) / g.cell), 0, g.h - 1);
        return y * g.w + x;
    };
    auto centre = [&](int i) { return vec2{g.origin.x + (i % g.w + 0.5f) * g.cell, g.origin.y + (i / g.w + 0.5f) * g.cell}; };
    auto nearest_free = [&](int i) {
        if (!g.solid[size_t(i)]) return i;
        int cx = i % g.w, cy = i / g.w;
        for (int r = 1; r < 12; r++)
            for (int dy = -r; dy <= r; dy++)
                for (int dx = -r; dx <= r; dx++) {
                    if (std::max(std::abs(dx), std::abs(dy)) != r) continue;
                    int x = cx + dx, y = cy + dy;
                    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
                    if (!g.solid[size_t(y * g.w + x)]) return y * g.w + x;
                }
        return -1;
    };
    int s = nearest_free(cell_of(from)), t = nearest_free(cell_of(to));
    if (s < 0 || t < 0) return false;
    std::vector<float> cost(g.solid.size(), 1e30f);
    std::vector<int> prev(g.solid.size(), -1);
    using Node = std::pair<float, int>;
    std::priority_queue<Node, std::vector<Node>, std::greater<Node>> open;
    auto h = [&](int i) {
        float dx = std::fabs(float(i % g.w - t % g.w)), dy = std::fabs(float(i / g.w - t / g.w));
        return (dx + dy) + (1.41421f - 2.f) * std::min(dx, dy);
    };
    cost[size_t(s)] = 0;
    open.push({h(s), s});
    const int dx[8] = {1, -1, 0, 0, 1, 1, -1, -1}, dy[8] = {0, 0, 1, -1, 1, -1, 1, -1};
    bool found = false;
    while (!open.empty()) {
        auto [f, i] = open.top();
        open.pop();
        if (i == t) { found = true; break; }
        if (f - h(i) > cost[size_t(i)] + 1e-4f) continue;  // stale entry
        int x = i % g.w, y = i / g.w;
        for (int k = 0; k < 8; k++) {
            int nx = x + dx[k], ny = y + dy[k];
            if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
            int n = ny * g.w + nx;
            if (g.solid[size_t(n)]) continue;
            if (k >= 4 && (g.solid[size_t(y * g.w + nx)] || g.solid[size_t(ny * g.w + x)])) continue;  // no corner cutting
            float c = cost[size_t(i)] + (k >= 4 ? 1.41421f : 1.f);
            if (c < cost[size_t(n)]) {
                cost[size_t(n)] = c;
                prev[size_t(n)] = i;
                open.push({c + h(n), n});
            }
        }
    }
    if (!found) return false;
    std::vector<vec2> raw;
    for (int i = t; i >= 0; i = prev[size_t(i)]) raw.push_back(centre(i));
    std::reverse(raw.begin(), raw.end());
    raw.back() = blocked(to, radius) ? raw.back() : to;
    // string pulling on the grid: walk forward while the straight line stays in free cells
    auto grid_clear = [&](vec2 a, vec2 b) {
        int steps = std::max(1, int(length(b - a) / (g.cell * 0.5f)));
        for (int i = 0; i <= steps; i++)
            if (g.solid[size_t(cell_of(lerp(a, b, float(i) / steps)))]) return false;
        return true;
    };
    vec2 at = from;
    size_t k = 0;
    while (k < raw.size()) {
        size_t far = k;
        while (far + 1 < raw.size() && grid_clear(at, raw[far + 1])) far++;
        out.push_back(raw[far]);
        at = raw[far];
        k = far + 1;
    }
    return true;
}

}  // namespace q
