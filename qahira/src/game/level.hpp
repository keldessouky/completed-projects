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
    std::vector<std::pair<std::string, vec2>> points;
    bool load(const std::string& name);
};

struct Level {
    struct Placed { std::string name; GpuMesh* mesh = nullptr; vec2 offset; int rot = 0; };
    std::vector<Placed> tiles;
    std::vector<Collider> colliders;
    std::vector<LightDef> lights;
    std::vector<std::pair<std::string, vec2>> points;
    vec2 lo{-1e9f, -1e9f}, hi{1e9f, 1e9f};
    vec2 point(const std::string& name, vec2 def = {0, 0}) const;

    void clear();
    void add_tile(const std::string& name, vec2 offset, int rot = 0);  // rot: quarter turns counter-clockwise
    void bind_gpu();                                 // look up meshes after a GL context exists
    vec2 resolve(vec2 p, float radius) const;        // push a circle out of colliders, clamp to bounds
    bool blocked(vec2 p, float radius) const;
    void render(Renderer& r, float time, vec2 focus) const;
    // A* over a 0.5 m grid rasterised from the colliders (built on first use, rebuilt when tiles change);
    // the path is string-pulled to a few straight legs. Returns false when the goal cannot be reached.
    bool find_path(vec2 from, vec2 to, float radius, std::vector<vec2>& out) const;
    bool line_clear(vec2 a, vec2 b, float radius) const;

private:
    struct NavGrid {
        vec2 origin;
        float cell = 0.5f, radius = -1;
        int w = 0, h = 0;
        std::vector<uint8_t> solid;
    };
    mutable NavGrid nav_;
    mutable bool nav_dirty_ = true;
    void build_nav(float radius) const;
};

}  // namespace q
