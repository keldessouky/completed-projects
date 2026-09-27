// Tiled forward renderer: HDR scene -> bloom -> tonemapped composite into the frontend's framebuffer.
#pragma once
#include "gfx/gpu.hpp"
#include "gfx/mesh.hpp"
#include <vector>

namespace q {

struct Camera {
    vec3 eye{0, -10, 14};
    vec3 target{0, 0, 0};
    float fovy = radians(30.f);
    float znear = 1.0f, zfar = 80.f;
    mat4 view, proj, viewproj;
    void update(float aspect) {
        view = mat4::look_at(eye, target, {0, 0, 1});
        proj = mat4::perspective(fovy, aspect, znear, zfar);
        viewproj = proj * view;
    }
    // screen (0..1, y down) -> ray hit on ground plane z = h
    vec3 ground_point(vec2 uv, float h = 0.f) const;
    vec2 to_screen(vec3 p) const;  // 0..1, y down; returns {-1,-1} if behind
};

struct Environment {
    vec3 sun_dir = normalize(vec3{0.3f, -0.6f, 0.75f});
    vec3 sun_color = hex_lin(0x9C8AD8) * 2.2f;
    vec3 sky = hex_lin(0x5A4A8C) * 1.1f;
    vec3 ground = hex_lin(0x3A2830) * 0.6f;
    vec3 fog = hex_lin(0x1B1429) * 0.4f;
    float fog_start = 18, fog_end = 40, fog_max = 0.75f;
    vec3 clear = hex_lin(0x0B0910);
    float exposure = 1.0f;
    float bloom_strength = 0.9f;
    float bloom_threshold = 1.1f;
    vec3 lift = {0.02f, 0.012f, 0.03f};
    vec3 gain = {1.0f, 0.98f, 1.02f};
    float saturation = 1.05f;
    float vignette = 0.55f;
};

struct Instance {
    mat4 model;
    vec4 tint{1, 1, 1, 1};
    vec4 extra{-1, 0, 0, 0};  // palette texel offset, emissive boost, hit flash, dissolve
    vec4 rim{0, 0, 0, 0};     // rgb, strength
};

struct SpriteVertex {
    vec3 pos;
    vec2 uv;
    uint8_t color[4];
    vec4 params;
};

enum class Blend { Alpha, Additive };

class Renderer {
public:
    bool init(int out_w, int out_h, float scale);
    void shutdown();
    void resize_scene(float scale);

    void begin(const Camera& cam, const Environment& env, float time);
    int alloc_palette(int bones);           // returns texel offset, write with palette()
    float* palette(int texel_offset) { return &palette_[size_t(texel_offset) * 4]; }
    void draw(const GpuMesh* mesh, const Instance& inst);
    void light(vec3 pos, float radius, vec3 color);
    void quad(vec3 c, vec3 ax, vec3 ay, vec4 color, vec4 params, Blend blend);
    void ground(vec3 c, float r, vec4 color, vec4 params, Blend blend, float rot = 0.f);
    void billboard(vec3 c, float size, vec4 color, vec4 params);
    void end(GLuint out_fbo, int out_w, int out_h, bool flip_y);

    int scene_w() const { return scene_.w; }
    int scene_h() const { return scene_.h; }
    const Camera& camera() const { return cam_; }
    int draw_calls = 0, instances = 0, lights_used = 0;

private:
    struct Item { const GpuMesh* mesh; Instance inst; };
    void build_tiles();
    void draw_meshes();
    void draw_sprites(std::vector<SpriteVertex>& verts, Blend b);
    void bloom();

    Shader mesh_sh_, down_sh_, up_sh_, comp_sh_, sprite_sh_;
    RenderTarget scene_;
    std::vector<RenderTarget> bloom_;
    GLuint empty_vao_ = 0, inst_vbo_ = 0, ubo_ = 0, sprite_vao_ = 0, sprite_vbo_ = 0;
    Texture bones_, tiles_;
    std::vector<float> palette_;
    int palette_used_ = 0;
    std::vector<Item> items_;
    std::vector<vec4> light_pos_, light_col_;
    std::vector<uint8_t> tile_data_;
    std::vector<SpriteVertex> alpha_, additive_;
    int tiles_x_ = 16, tiles_y_ = 9;
    Camera cam_;
    Environment env_;
    float time_ = 0;
    float scale_ = 0.75f;
    int out_w_ = 1920, out_h_ = 1080;
};

}  // namespace q
