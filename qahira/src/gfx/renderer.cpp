#include "gfx/renderer.hpp"
#include "gfx/shaders.hpp"
#include "core/log.hpp"
#include <algorithm>
#include <cstring>

namespace q {

static constexpr int kBoneTexW = 1024;
static constexpr int kMaxLights = 64;
static constexpr int kTileSlots = 32;  // count + 31 light indices

struct FrameBlock {
    mat4 viewproj, view;
    vec4 cam, sun_dir, sun_col, sky, ground, fog_col, fog_params, tile_info;
    vec4 lpos[kMaxLights];
    vec4 lcol[kMaxLights];
};

vec3 Camera::ground_point(vec2 uv, float h) const {
    mat4 inv = inverse(viewproj);
    vec2 ndc{uv.x * 2 - 1, 1 - uv.y * 2};
    vec4 a = inv * vec4(ndc.x, ndc.y, -1, 1), b = inv * vec4(ndc.x, ndc.y, 1, 1);
    vec3 p0 = a.xyz() / a.w, p1 = b.xyz() / b.w;
    vec3 d = p1 - p0;
    if (std::fabs(d.z) < 1e-6f) return p0;
    float t = (h - p0.z) / d.z;
    return p0 + d * t;
}

vec2 Camera::to_screen(vec3 p) const {
    vec4 c = viewproj * vec4(p, 1);
    if (c.w <= 0) return {-1, -1};
    return {(c.x / c.w) * 0.5f + 0.5f, 0.5f - (c.y / c.w) * 0.5f};
}

bool Renderer::init(int out_w, int out_h, float scale) {
    out_w_ = out_w;
    out_h_ = out_h;
    std::string fb = shaders::frame_block;
    bool ok = mesh_sh_.build("mesh", fb + shaders::mesh_vs, fb + shaders::mesh_fs) &&
              down_sh_.build("bloom_down", shaders::fullscreen_vs, shaders::bloom_down_fs) &&
              up_sh_.build("bloom_up", shaders::fullscreen_vs, shaders::bloom_up_fs) &&
              comp_sh_.build("composite", shaders::fullscreen_vs, shaders::composite_fs) &&
              sprite_sh_.build("sprite", fb + shaders::sprite_vs, shaders::sprite_fs);
    if (!ok) return false;
    mesh_sh_.bind_block("Frame", 0);
    sprite_sh_.bind_block("Frame", 0);
    glGenVertexArrays(1, &empty_vao_);
    glGenBuffers(1, &inst_vbo_);
    glGenBuffers(1, &ubo_);
    glBindBuffer(GL_UNIFORM_BUFFER, ubo_);
    glBufferData(GL_UNIFORM_BUFFER, sizeof(FrameBlock), nullptr, GL_DYNAMIC_DRAW);
    glGenVertexArrays(1, &sprite_vao_);
    glGenBuffers(1, &sprite_vbo_);
    glBindVertexArray(sprite_vao_);
    glBindBuffer(GL_ARRAY_BUFFER, sprite_vbo_);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(SpriteVertex), (void*)offsetof(SpriteVertex, pos));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(SpriteVertex), (void*)offsetof(SpriteVertex, uv));
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 4, GL_UNSIGNED_BYTE, GL_TRUE, sizeof(SpriteVertex), (void*)offsetof(SpriteVertex, color));
    glEnableVertexAttribArray(3);
    glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(SpriteVertex), (void*)offsetof(SpriteVertex, params));
    glBindVertexArray(0);
    bones_.create(kBoneTexW, 64, GL_RGBA32F, GL_RGBA, GL_FLOAT, nullptr, false);
    tiles_.create(kTileSlots, tiles_x_ * tiles_y_, GL_R8UI, GL_RED_INTEGER, GL_UNSIGNED_BYTE, nullptr, false);
    palette_.resize(size_t(kBoneTexW) * 64 * 4);
    resize_scene(scale);
    return true;
}

void Renderer::resize_scene(float scale) {
    scale_ = scale;
    scene_.destroy();
    for (auto& b : bloom_) b.destroy();
    bloom_.clear();
    int w = std::max(64, int(out_w_ * scale)), h = std::max(36, int(out_h_ * scale));
    scene_.create(w, h, GL_RGBA16F, true);
    int bw = w / 2, bh = h / 2;
    for (int i = 0; i < 6 && bw >= 4 && bh >= 4; i++) {
        RenderTarget rt;
        rt.create(bw, bh, GL_RGBA16F, false);
        bloom_.push_back(rt);
        bw /= 2;
        bh /= 2;
    }
    QLOG("scene target %dx%d, %zu bloom levels", w, h, bloom_.size());
}

void Renderer::shutdown() {
    mesh_sh_.destroy(); down_sh_.destroy(); up_sh_.destroy(); comp_sh_.destroy(); sprite_sh_.destroy();
    scene_.destroy();
    for (auto& b : bloom_) b.destroy();
    bones_.destroy();
    tiles_.destroy();
    GLuint bufs[] = {inst_vbo_, ubo_, sprite_vbo_};
    glDeleteBuffers(3, bufs);
    glDeleteVertexArrays(1, &empty_vao_);
    glDeleteVertexArrays(1, &sprite_vao_);
}

void Renderer::begin(const Camera& cam, const Environment& env, float time) {
    cam_ = cam;
    cam_.update(float(scene_.w) / float(scene_.h));
    env_ = env;
    time_ = time;
    items_.clear();
    light_pos_.clear();
    light_col_.clear();
    alpha_.clear();
    additive_.clear();
    palette_used_ = 0;
    draw_calls = instances = 0;
}

int Renderer::alloc_palette(int bones) {
    int texels = bones * 3;
    if ((palette_used_ + texels) * 4 > int(palette_.size())) return -1;
    int off = palette_used_;
    palette_used_ += texels;
    return off;
}

void Renderer::draw(const GpuMesh* mesh, const Instance& inst) {
    if (!mesh || !mesh->vao) return;
    items_.push_back({mesh, inst});
}

void Renderer::light(vec3 pos, float radius, vec3 color) {
    if (int(light_pos_.size()) >= kMaxLights) return;
    light_pos_.push_back(vec4(pos, radius));
    light_col_.push_back(vec4(color, 0));
}

static void put(std::vector<SpriteVertex>& v, vec3 p, vec2 uv, vec4 c, vec4 params) {
    SpriteVertex s;
    s.pos = p;
    s.uv = uv;
    s.color[0] = uint8_t(saturate(c.x) * 255);
    s.color[1] = uint8_t(saturate(c.y) * 255);
    s.color[2] = uint8_t(saturate(c.z) * 255);
    s.color[3] = uint8_t(saturate(c.w) * 255);
    s.params = params;
    v.push_back(s);
}

void Renderer::quad(vec3 c, vec3 ax, vec3 ay, vec4 color, vec4 params, Blend blend) {
    auto& v = blend == Blend::Alpha ? alpha_ : additive_;
    vec3 a = c - ax - ay, b = c + ax - ay, cc = c + ax + ay, d = c - ax + ay;
    put(v, a, {0, 0}, color, params); put(v, b, {1, 0}, color, params); put(v, cc, {1, 1}, color, params);
    put(v, a, {0, 0}, color, params); put(v, cc, {1, 1}, color, params); put(v, d, {0, 1}, color, params);
}

void Renderer::ground(vec3 c, float r, vec4 color, vec4 params, Blend blend, float rot) {
    vec3 ax{std::cos(rot) * r, std::sin(rot) * r, 0}, ay{-std::sin(rot) * r, std::cos(rot) * r, 0};
    quad(c + vec3{0, 0, 0.02f}, ax, ay, color, params, blend);
}

void Renderer::billboard(vec3 c, float size, vec4 color, vec4 params, Blend blend) {
    vec3 right{cam_.view(0, 0), cam_.view(0, 1), cam_.view(0, 2)};
    vec3 up{cam_.view(1, 0), cam_.view(1, 1), cam_.view(1, 2)};
    quad(c, right * size, up * size, color, params, blend);
}

void Renderer::beam(vec3 base, float height, float width, vec4 color) {
    vec3 right{cam_.view(0, 0), cam_.view(0, 1), cam_.view(0, 2)};
    right = normalize(vec3{right.x, right.y, 0});
    quad(base + vec3{0, 0, height * 0.5f}, right * width, vec3{0, 0, height * 0.5f}, color, {6, 0, 0, 1}, Blend::Additive);
}

void Renderer::build_tiles() {
    int nt = tiles_x_ * tiles_y_;
    tile_data_.assign(size_t(nt) * kTileSlots, 0);
    float tw = float(scene_.w) / tiles_x_, th = float(scene_.h) / tiles_y_;
    const mat4& vp = cam_.viewproj;
    for (size_t li = 0; li < light_pos_.size(); li++) {
        vec3 p = light_pos_[li].xyz();
        float r = light_pos_[li].w;
        // screen-space bounds from the 8 corners of the light's bounding box
        float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f;
        bool any = false;
        for (int k = 0; k < 8; k++) {
            vec3 c = p + vec3{(k & 1) ? r : -r, (k & 2) ? r : -r, (k & 4) ? r : -r};
            vec4 h = vp * vec4(c, 1);
            if (h.w <= 0.05f) { x0 = y0 = -1e9f; x1 = y1 = 1e9f; any = true; break; }
            float sx = (h.x / h.w * 0.5f + 0.5f) * scene_.w, sy = (h.y / h.w * 0.5f + 0.5f) * scene_.h;
            x0 = std::min(x0, sx); x1 = std::max(x1, sx); y0 = std::min(y0, sy); y1 = std::max(y1, sy);
            any = true;
        }
        if (!any || x1 < 0 || y1 < 0 || x0 > scene_.w || y0 > scene_.h) continue;
        int tx0 = std::max(0, int(x0 / tw)), tx1 = std::min(tiles_x_ - 1, int(x1 / tw));
        int ty0 = std::max(0, int(y0 / th)), ty1 = std::min(tiles_y_ - 1, int(y1 / th));
        for (int ty = ty0; ty <= ty1; ty++)
            for (int tx = tx0; tx <= tx1; tx++) {
                uint8_t* slot = &tile_data_[size_t(ty * tiles_x_ + tx) * kTileSlots];
                if (slot[0] < kTileSlots - 1) slot[1 + slot[0]++] = uint8_t(li);
            }
    }
}

void Renderer::draw_meshes() {
    if (items_.empty()) return;
    std::stable_sort(items_.begin(), items_.end(), [](const Item& a, const Item& b) { return a.mesh < b.mesh; });
    std::vector<Instance> inst(items_.size());
    for (size_t i = 0; i < items_.size(); i++) inst[i] = items_[i].inst;
    glBindBuffer(GL_ARRAY_BUFFER, inst_vbo_);
    glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(inst.size() * sizeof(Instance)), inst.data(), GL_STREAM_DRAW);
    mesh_sh_.use();
    mesh_sh_.set("uBones", 0);
    mesh_sh_.set("uTiles", 1);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, bones_.id);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, tiles_.id);
    size_t i = 0;
    while (i < items_.size()) {
        const GpuMesh* m = items_[i].mesh;
        size_t j = i;
        while (j < items_.size() && items_[j].mesh == m) j++;
        glBindVertexArray(m->vao);
        glBindBuffer(GL_ARRAY_BUFFER, inst_vbo_);
        size_t base = i * sizeof(Instance);
        for (int c = 0; c < 4; c++) {
            glEnableVertexAttribArray(8 + c);
            glVertexAttribPointer(8 + c, 4, GL_FLOAT, GL_FALSE, sizeof(Instance), (void*)(base + c * 16));
            glVertexAttribDivisor(8 + c, 1);
        }
        const size_t offs[3] = {offsetof(Instance, tint), offsetof(Instance, extra), offsetof(Instance, rim)};
        for (int c = 0; c < 3; c++) {
            glEnableVertexAttribArray(12 + c);
            glVertexAttribPointer(12 + c, 4, GL_FLOAT, GL_FALSE, sizeof(Instance), (void*)(base + offs[c]));
            glVertexAttribDivisor(12 + c, 1);
        }
        mesh_sh_.set("uSkinned", m->skinned ? 1 : 0);
        glDrawElementsInstanced(GL_TRIANGLES, m->index_count, GL_UNSIGNED_INT, nullptr, GLsizei(j - i));
        draw_calls++;
        instances += int(j - i);
        i = j;
    }
    glBindVertexArray(0);
}

void Renderer::draw_sprites(std::vector<SpriteVertex>& v, Blend b) {
    if (v.empty()) return;
    glBindVertexArray(sprite_vao_);
    glBindBuffer(GL_ARRAY_BUFFER, sprite_vbo_);
    glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(v.size() * sizeof(SpriteVertex)), v.data(), GL_STREAM_DRAW);
    sprite_sh_.use();
    glEnable(GL_BLEND);
    if (b == Blend::Alpha) glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE);
    else glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE, GL_ZERO, GL_ONE);
    glDepthMask(GL_FALSE);
    glDrawArrays(GL_TRIANGLES, 0, GLsizei(v.size()));
    glDepthMask(GL_TRUE);
    glDisable(GL_BLEND);
    draw_calls++;
    glBindVertexArray(0);
}

void Renderer::bloom() {
    glBindVertexArray(empty_vao_);
    glDisable(GL_DEPTH_TEST);
    down_sh_.use();
    down_sh_.set("uSrc", 0);
    glActiveTexture(GL_TEXTURE0);
    const Texture* src = &scene_.color;
    for (size_t i = 0; i < bloom_.size(); i++) {
        glBindFramebuffer(GL_FRAMEBUFFER, bloom_[i].fbo);
        glViewport(0, 0, bloom_[i].w, bloom_[i].h);
        glBindTexture(GL_TEXTURE_2D, src->id);
        down_sh_.set("uTexel", vec2{1.f / src->w, 1.f / src->h});
        down_sh_.set("uThreshold", i == 0 ? env_.bloom_threshold : 0.f);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        src = &bloom_[i].color;
    }
    up_sh_.use();
    up_sh_.set("uSrc", 0);
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    for (int i = int(bloom_.size()) - 1; i > 0; i--) {
        glBindFramebuffer(GL_FRAMEBUFFER, bloom_[size_t(i - 1)].fbo);
        glViewport(0, 0, bloom_[size_t(i - 1)].w, bloom_[size_t(i - 1)].h);
        glBindTexture(GL_TEXTURE_2D, bloom_[size_t(i)].color.id);
        up_sh_.set("uTexel", vec2{1.f / bloom_[size_t(i)].w, 1.f / bloom_[size_t(i)].h});
        glDrawArrays(GL_TRIANGLES, 0, 3);
    }
    glDisable(GL_BLEND);
}

void Renderer::end(GLuint out_fbo, int out_w, int out_h, bool flip_y) {
    // per-frame uniforms
    FrameBlock fb{};
    fb.viewproj = cam_.viewproj;
    fb.view = cam_.view;
    fb.cam = vec4(cam_.eye, time_);
    fb.sun_dir = vec4(normalize(env_.sun_dir), 0);
    fb.sun_col = vec4(env_.sun_color, 0);
    fb.sky = vec4(env_.sky, 0);
    fb.ground = vec4(env_.ground, 0);
    fb.fog_col = vec4(env_.fog, 0);
    fb.fog_params = {env_.fog_start, env_.fog_end, env_.fog_max, 0};
    fb.tile_info = {float(tiles_x_), float(tiles_y_), float(scene_.w) / tiles_x_, float(scene_.h) / tiles_y_};
    for (size_t i = 0; i < light_pos_.size(); i++) { fb.lpos[i] = light_pos_[i]; fb.lcol[i] = light_col_[i]; }
    lights_used = int(light_pos_.size());
    glBindBuffer(GL_UNIFORM_BUFFER, ubo_);
    glBufferSubData(GL_UNIFORM_BUFFER, 0, sizeof(FrameBlock), &fb);
    glBindBufferBase(GL_UNIFORM_BUFFER, 0, ubo_);
    build_tiles();
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glBindTexture(GL_TEXTURE_2D, tiles_.id);
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, kTileSlots, tiles_x_ * tiles_y_, GL_RED_INTEGER, GL_UNSIGNED_BYTE, tile_data_.data());
    glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
    if (palette_used_ > 0) {
        int rows = (palette_used_ + kBoneTexW - 1) / kBoneTexW;
        glBindTexture(GL_TEXTURE_2D, bones_.id);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, kBoneTexW, rows, GL_RGBA, GL_FLOAT, palette_.data());
    }

    // scene
    glBindFramebuffer(GL_FRAMEBUFFER, scene_.fbo);
    glViewport(0, 0, scene_.w, scene_.h);
    glClearColor(env_.clear.x, env_.clear.y, env_.clear.z, 1);
    glClearDepthf(1.f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);
    glDisable(GL_CULL_FACE);
    draw_meshes();
    glEnable(GL_POLYGON_OFFSET_FILL);
    glPolygonOffset(-1.f, -2.f);
    draw_sprites(alpha_, Blend::Alpha);
    glDisable(GL_POLYGON_OFFSET_FILL);
    draw_sprites(additive_, Blend::Additive);

    bloom();

    // composite into the frontend's framebuffer at output resolution
    glBindFramebuffer(GL_FRAMEBUFFER, out_fbo);
    glViewport(0, 0, out_w, out_h);
    glDisable(GL_DEPTH_TEST);
    glBindVertexArray(empty_vao_);
    comp_sh_.use();
    comp_sh_.set("uScene", 0);
    comp_sh_.set("uBloom", 1);
    comp_sh_.set("uBloomStrength", bloom_.empty() ? 0.f : env_.bloom_strength);
    comp_sh_.set("uExposure", env_.exposure);
    comp_sh_.set("uLift", env_.lift);
    comp_sh_.set("uGain", env_.gain);
    comp_sh_.set("uSaturation", env_.saturation);
    comp_sh_.set("uVignette", env_.vignette);
    comp_sh_.set("uFlipY", flip_y ? 1.f : 0.f);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, scene_.color.id);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, bloom_.empty() ? scene_.color.id : bloom_[0].color.id);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    glActiveTexture(GL_TEXTURE0);
    glBindVertexArray(0);
}

}  // namespace q
