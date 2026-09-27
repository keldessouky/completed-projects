#include "game/level.hpp"
#include "game/assets.hpp"
#include "core/json.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"

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
    return true;
}

void Level::clear() {
    tiles.clear();
    colliders.clear();
    lights.clear();
    lo = {1e9f, 1e9f};
    hi = {-1e9f, -1e9f};
}

void Level::add_tile(const std::string& name, vec2 offset) {
    TileDef d;
    if (!d.load(name)) return;
    tiles.push_back({name, nullptr, offset});
    for (auto& c : d.colliders) colliders.push_back({c.c + offset, c.h});
    for (auto& l : d.lights) lights.push_back({l.p + vec3(offset, 0), l.r, l.c});
    lo = {std::min(lo.x, offset.x - d.size.x / 2), std::min(lo.y, offset.y - d.size.y / 2)};
    hi = {std::max(hi.x, offset.x + d.size.x / 2), std::max(hi.y, offset.y + d.size.y / 2)};
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
        Instance in;
        in.model = mat4::translate(vec3(t.offset, 0));
        r.draw(t.mesh, in);
    }
    for (size_t i = 0; i < lights.size(); i++) {
        const auto& l = lights[i];
        if (length(l.p.xy() - focus) > 28.f) continue;
        float flick = 0.92f + 0.08f * std::sin(time * (3.f + (i % 5)) + float(i) * 1.7f);
        r.light(l.p, l.r, l.c * flick);
    }
}

}  // namespace q
