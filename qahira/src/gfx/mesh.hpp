// GPU meshes loaded from .qmesh (see tools/art/qart/model.py for the layout).
#pragma once
#include "gfx/gl.hpp"
#include "core/math.hpp"
#include "core/pack.hpp"

namespace q {

struct GpuMesh {
    GLuint vao = 0, vbo = 0, ibo = 0;
    int index_count = 0;
    int vertex_count = 0;
    bool skinned = false;
    vec3 bmin, bmax;
    bool load(Blob b);
    void destroy();
};

}  // namespace q

#include <vector>
namespace q {

// Builds static meshes in code (ground, simple props, debug shapes) in the .qmesh vertex layout.
struct MeshBuilder {
    struct Vtx { vec3 p; vec3 n; uint8_t c[4]; uint8_t m[4]; };
    std::vector<Vtx> v;
    std::vector<uint32_t> idx;
    uint8_t color[4] = {200, 200, 200, 255};
    uint8_t mat[4] = {204, 0, 0, 0};
    void set_color(vec3 srgb, float ao = 1.f) {
        color[0] = uint8_t(saturate(srgb.x) * 255); color[1] = uint8_t(saturate(srgb.y) * 255);
        color[2] = uint8_t(saturate(srgb.z) * 255); color[3] = uint8_t(saturate(ao) * 255);
    }
    void set_mat(float rough, float metal = 0, float emit = 0) {
        mat[0] = uint8_t(saturate(rough) * 255); mat[1] = uint8_t(saturate(metal) * 255); mat[2] = uint8_t(saturate(emit) * 255);
    }
    uint32_t vert(vec3 p, vec3 n) {
        Vtx x{p, n, {color[0], color[1], color[2], color[3]}, {mat[0], mat[1], mat[2], mat[3]}};
        v.push_back(x);
        return uint32_t(v.size() - 1);
    }
    void tri(uint32_t a, uint32_t b, uint32_t c) { idx.push_back(a); idx.push_back(b); idx.push_back(c); }
    void quad(vec3 a, vec3 b, vec3 c, vec3 d) {
        vec3 n = normalize(cross(b - a, d - a));
        uint32_t i0 = vert(a, n), i1 = vert(b, n), i2 = vert(c, n), i3 = vert(d, n);
        tri(i0, i1, i2); tri(i0, i2, i3);
    }
    void box(vec3 lo, vec3 hi) {
        vec3 p[8];
        for (int i = 0; i < 8; i++) p[i] = {i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z};
        quad(p[0], p[2], p[3], p[1]); quad(p[4], p[5], p[7], p[6]);
        quad(p[0], p[1], p[5], p[4]); quad(p[2], p[6], p[7], p[3]);
        quad(p[0], p[4], p[6], p[2]); quad(p[1], p[3], p[7], p[5]);
    }
    bool upload(GpuMesh& out) const;
};

}  // namespace q
