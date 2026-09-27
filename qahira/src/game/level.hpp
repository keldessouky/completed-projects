// A playable area assembled from generated tiles (static mesh + JSON sidecar of colliders and lights).
#pragma once
#include "core/math.hpp"
#include "gfx/renderer.hpp"
#include <string>
#include <vector>

namespace q {

struct Collider { vec2 c, h; };  // axis-aligned box: centre, half extents
struct LightDef { vec3 p; float r; vec3 c; };

struct TileDef {
    std::string name;
    vec2 size;
    std::vector<LightDef> lights;
    std::vector<Collider> colliders;
    bool load(const std::string& name);
};

struct Level {
    struct Placed { std::string name; GpuMesh* mesh = nullptr; vec2 offset; };
    std::vector<Placed> tiles;
    std::vector<Collider> colliders;
    std::vector<LightDef> lights;
    vec2 lo{-1e9f, -1e9f}, hi{1e9f, 1e9f};

    void clear();
    void add_tile(const std::string& name, vec2 offset);
    void bind_gpu();                                 // look up meshes after a GL context exists
    vec2 resolve(vec2 p, float radius) const;        // push a circle out of colliders, clamp to bounds
    bool blocked(vec2 p, float radius) const;
    void render(Renderer& r, float time, vec2 focus) const;
};

}  // namespace q
