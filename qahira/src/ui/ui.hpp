// Immediate-mode 2D drawing for HUD and menus, in a fixed 1920x1080 logical space.
#pragma once
#include "gfx/gpu.hpp"
#include "core/pack.hpp"
#include <string>
#include <vector>
#include <unordered_map>

namespace q {

struct Rgba {
    uint8_t r = 255, g = 255, b = 255, a = 255;
    Rgba() = default;
    constexpr Rgba(uint8_t r_, uint8_t g_, uint8_t b_, uint8_t a_ = 255) : r(r_), g(g_), b(b_), a(a_) {}
    static constexpr Rgba hex(uint32_t h, uint8_t a = 255) { return {uint8_t(h >> 16), uint8_t(h >> 8), uint8_t(h), a}; }
    Rgba alpha(float f) const { return {r, g, b, uint8_t(a * (f < 0 ? 0 : f > 1 ? 1 : f))}; }
    Rgba mix(Rgba o, float t) const {
        return {uint8_t(r + (o.r - r) * t), uint8_t(g + (o.g - g) * t), uint8_t(b + (o.b - b) * t), uint8_t(a + (o.a - a) * t)};
    }
};

namespace pal {
constexpr Rgba night = Rgba::hex(0x07060A), panel = Rgba::hex(0x0E0B14), panel2 = Rgba::hex(0x16111F),
               line = Rgba::hex(0x2E2540), dusk = Rgba::hex(0x2B1E44), amber = Rgba::hex(0xF2A541),
               turquoise = Rgba::hex(0x2BB5AE), magenta = Rgba::hex(0xFF2E88), brass = Rgba::hex(0xD4A84B),
               sand = Rgba::hex(0xC9A27A), bone = Rgba::hex(0xEDE3D1), soft = Rgba::hex(0xBDB3C9),
               dim = Rgba::hex(0x7D7390), life = Rgba::hex(0xC0392B), mana = Rgba::hex(0x2F6FD6);
// the loot and comparison colours change with the colour-blind setting (game/settings.cpp)
inline Rgba magic = Rgba::hex(0x7AA8FF), rare = Rgba::hex(0xF5D76E), unique = Rgba::hex(0xE08A3C),
            good = Rgba::hex(0x7BD389), bad = Rgba::hex(0xE0525C);
}

enum class Align { Left, Center, Right };

struct Glyph {
    float u0, v0, u1, v1;
    float xoff, yoff, w, h, advance;
};

class Ui {
public:
    bool init();
    void begin(float w = 1920, float h = 1080);
    void end(GLuint fbo, int w, int h);

    void rect(float x, float y, float w, float h, Rgba c, float radius = 0);
    void frame(float x, float y, float w, float h, Rgba fill, Rgba border, float radius = 10, float bw = 2);
    void ring(float cx, float cy, float r_out, float r_in, Rgba c);
    void disc(float cx, float cy, float r, Rgba c) { ring(cx, cy, r, 0, c); }
    void line(float x0, float y0, float x1, float y1, float w, Rgba c);
    void arc_fill(float cx, float cy, float r, float frac, Rgba c);  // orb fill from the bottom
    float text(float x, float y, const std::string& s, float size, Rgba c, Align a = Align::Left, float weight = 0,
               bool outline = false);
    float text_width(const std::string& s, float size) const;
    float wrap(float x, float y, float w, const std::string& s, float size, Rgba c, float line_h = 1.3f, float weight = 0);
    void push_clip(float x, float y, float w, float h);
    void pop_clip();
    float width() const { return w_; }
    float height() const { return h_; }
    // Slice 11: in Arabic the whole layout is mirrored (x -> width - x, left and right alignment swapped), except where
    // a screen turns it off (the Map of al-Idrisi and the sky keep their geography); text grows with the text size
    void set_rtl(bool on) { rtl_ = on; }
    bool rtl() const { return rtl_; }
    bool set_mirror_enabled(bool on) { bool was = mirror_on_; mirror_on_ = on; return was; }
    bool mirrored() const { return rtl_ && mirror_on_; }
    void set_text_scale(float s) { text_scale_ = s; }
    float text_scale() const { return text_scale_; }

private:
    struct V { float x, y, u, v; uint8_t c[4]; float p[4]; };
    void quad(float x0, float y0, float x1, float y1, float u0, float v0, float u1, float v1, Rgba c, const float p[4]);
    void flush();
    static uint32_t next_cp(const std::string& s, size_t& i);
    Shader sh_;
    GLuint vao_ = 0, vbo_ = 0;
    Texture font_, white_;
    std::unordered_map<uint32_t, Glyph> glyphs_;
    float font_px_ = 48, ascent_ = 0, line_ = 0;
    std::vector<V> verts_;
    std::vector<V> font_verts_;
    float w_ = 1920, h_ = 1080;
    std::vector<vec4> clips_;
    bool rtl_ = false, mirror_on_ = true;
    float text_scale_ = 1.f;
    float mx(float x, float w = 0) const { return mirrored() ? w_ - x - w : x; }
    float text_raw(float x, float y, const std::string& s, float size, Rgba c, Align a, float weight, bool outline);
    float width_raw(const std::string& s, float size) const;
};

Ui& ui();

}  // namespace q
