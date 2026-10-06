#include "ui/ui.hpp"
#include "ui/arabic.hpp"
#include "ui/lang.hpp"
#include "gfx/shaders.hpp"
#include "core/log.hpp"
#include "stb_truetype.h"
#include <cstring>

namespace q {

Ui& ui() { static Ui u; return u; }


uint32_t Ui::next_cp(const std::string& s, size_t& i) {
    uint8_t c = uint8_t(s[i++]);
    if (c < 0x80) return c;
    int n = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : 1;
    uint32_t cp = c & (0x3F >> n);
    for (int k = 0; k < n && i < s.size(); k++) cp = (cp << 6) | (uint8_t(s[i++]) & 0x3F);
    return cp;
}

bool Ui::init() {
    if (!sh_.build("ui", shaders::ui_vs, shaders::ui_fs)) return false;
    glGenVertexArrays(1, &vao_);
    glGenBuffers(1, &vbo_);
    glBindVertexArray(vao_);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(V), (void*)offsetof(V, x));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(V), (void*)offsetof(V, u));
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 4, GL_UNSIGNED_BYTE, GL_TRUE, sizeof(V), (void*)offsetof(V, c));
    glEnableVertexAttribArray(3);
    glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(V), (void*)offsetof(V, p));
    glBindVertexArray(0);

    // SDF glyph atlas, with a white block in the corner for solid fills
    const int AW = 1024, AH = 1024;
    std::vector<uint8_t> atlas(size_t(AW) * AH, 0);
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) atlas[size_t(y) * AW + x] = 255;
    Blob ttf = pack().get("fonts/ui.ttf");
    if (!ttf) { QERR("missing fonts/ui.ttf"); return false; }
    stbtt_fontinfo fi;
    if (!stbtt_InitFont(&fi, ttf.data, stbtt_GetFontOffsetForIndex(ttf.data, 0))) { QERR("bad font"); return false; }
    float scale = stbtt_ScaleForPixelHeight(&fi, font_px_);
    int asc, desc, gap;
    stbtt_GetFontVMetrics(&fi, &asc, &desc, &gap);
    ascent_ = asc * scale;
    line_ = (asc - desc + gap) * scale;
    std::vector<uint32_t> cps;
    for (uint32_t c = 32; c < 127; c++) cps.push_back(c);
    for (uint32_t c : {0xB7u, 0xD7u, 0x2022u, 0x2014u, 0x2013u, 0x2192u, 0x2190u, 0x2191u, 0x2193u, 0x2605u, 0x25B2u, 0x25BCu,
                       0x2026u, 0x201Cu, 0x201Du, 0x2019u, 0xB0u, 0xB1u, 0x2212u, 0x2264u, 0x2265u, 0x221Eu})
        cps.push_back(c);
    const int pad = 6;
    int px = 8, py = 0, row_h = 0;
    auto bake = [&](stbtt_fontinfo& fi, float scale, const std::vector<uint32_t>& cps) {
    for (uint32_t cp : cps) {
        int gi = stbtt_FindGlyphIndex(&fi, int(cp));
        if (gi == 0 && cp != 32) continue;
        int w = 0, h = 0, xo = 0, yo = 0;
        unsigned char* sdf = stbtt_GetGlyphSDF(&fi, scale, gi, pad, 128, 128.f / pad, &w, &h, &xo, &yo);
        int adv, lsb;
        stbtt_GetGlyphHMetrics(&fi, gi, &adv, &lsb);
        if (px + w + 1 >= AW) { px = 0; py += row_h + 1; row_h = 0; }
        if (py + h >= AH) { QWARN("font atlas full"); break; }
        if (sdf) {
            for (int y = 0; y < h; y++) memcpy(&atlas[size_t(py + y) * AW + px], sdf + y * w, size_t(w));
            stbtt_FreeSDF(sdf, nullptr);
        }
        Glyph g;
        g.u0 = float(px) / AW; g.v0 = float(py) / AH; g.u1 = float(px + w) / AW; g.v1 = float(py + h) / AH;
        g.xoff = float(xo); g.yoff = float(yo); g.w = float(w); g.h = float(h); g.advance = adv * scale;
        glyphs_[cp] = g;
        px += w + 1;
        row_h = std::max(row_h, h);
    }
    };
    bake(fi, scale, cps);
    // Arabic (Slice 11): the contextual forms of Presentation Forms-B and the lam-alef ligatures, Arabic digits and
    // punctuation, from Noto Sans Arabic at the Latin font's em size (a touch larger: Arabic reads small beside Latin)
    if (Blob ar = pack().get("fonts/arabic.ttf")) {
        stbtt_fontinfo fa;
        if (stbtt_InitFont(&fa, ar.data, stbtt_GetFontOffsetForIndex(ar.data, 0))) {
            const float em_px = scale * float((fi.data[fi.head + 18] << 8) | fi.data[fi.head + 19]);   // the Latin font's em (unitsPerEm), in pixels
            const float sa = stbtt_ScaleForMappingEmToPixels(&fa, em_px * 1.12f);
            std::vector<uint32_t> ac;
            for (uint32_t c = 0xFE70; c <= 0xFEFC; c++) ac.push_back(c);
            for (uint32_t c = 0x0621; c <= 0x064A; c++) ac.push_back(c);
            for (uint32_t c = 0x0660; c <= 0x066C; c++) ac.push_back(c);
            for (uint32_t c : {0x060Cu, 0x061Bu, 0x061Fu}) ac.push_back(c);
            bake(fa, sa, ac);
        }
    }
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    font_.create(AW, AH, GL_R8, GL_RED, GL_UNSIGNED_BYTE, atlas.data(), true);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
    QLOG("ui font: %zu glyphs", glyphs_.size());
    return true;
}

void Ui::begin(float w, float h) {
    w_ = w;
    h_ = h;
    verts_.clear();
    clips_.clear();
}

void Ui::quad(float x0, float y0, float x1, float y1, float u0, float v0, float u1, float v1, Rgba c, const float p[4]) {
    V a{x0, y0, u0, v0, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V b{x1, y0, u1, v0, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V d{x1, y1, u1, v1, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V e{x0, y1, u0, v1, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    verts_.push_back(a); verts_.push_back(b); verts_.push_back(d);
    verts_.push_back(a); verts_.push_back(d); verts_.push_back(e);
}

void Ui::rect(float x, float y, float w, float h, Rgba c, float radius) {
    if (w <= 0 || h <= 0 || c.a == 0) return;
    x = mx(x, w);
    if (radius <= 0.5f) {
        float p[4] = {0, 0, 0, 0};
        quad(x, y, x + w, y + h, 1.f / 1024, 1.f / 1024, 2.f / 1024, 2.f / 1024, c, p);
        return;
    }
    float p[4] = {2, w / 2, h / 2, std::min(radius, std::min(w, h) / 2)};
    quad(x, y, x + w, y + h, -w / 2, -h / 2, w / 2, h / 2, c, p);
}

void Ui::frame(float x, float y, float w, float h, Rgba fill, Rgba border, float radius, float bw) {
    rect(x, y, w, h, border, radius);
    rect(x + bw, y + bw, w - 2 * bw, h - 2 * bw, fill, std::max(0.f, radius - bw));
}

void Ui::ring(float cx, float cy, float r_out, float r_in, Rgba c) {
    float p[4] = {3, r_out, r_in, 0};
    float e = r_out + 1;
    cx = mx(cx);
    quad(cx - e, cy - e, cx + e, cy + e, -e, -e, e, e, c, p);
}

void Ui::line(float x0, float y0, float x1, float y1, float w, Rgba c) {
    x0 = mx(x0);
    x1 = mx(x1);
    vec2 d = normalize(vec2{x1 - x0, y1 - y0}), n = perp(d) * (w * 0.5f);
    float p[4] = {0, 0, 0, 0};
    float u = 1.f / 1024;
    V a{x0 + n.x, y0 + n.y, u, u, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V b{x1 + n.x, y1 + n.y, u, u, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V cc{x1 - n.x, y1 - n.y, u, u, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    V d2{x0 - n.x, y0 - n.y, u, u, {c.r, c.g, c.b, c.a}, {p[0], p[1], p[2], p[3]}};
    verts_.push_back(a); verts_.push_back(b); verts_.push_back(cc);
    verts_.push_back(a); verts_.push_back(cc); verts_.push_back(d2);
}

void Ui::arc_fill(float cx, float cy, float r, float frac, Rgba c) {
    frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
    float top = cy + r - 2 * r * frac;
    push_clip(cx - r - 1, top, 2 * r + 2, cy + r - top + 1);
    ring(cx, cy, r, 0, c);
    pop_clip();
}

float Ui::text_width(const std::string& s, float size) const {
    std::string t;
    return width_raw(translate(s, t) ? t : s, size * text_scale_);
}

float Ui::width_raw(const std::string& s, float size) const {
    float k = size / font_px_, w = 0;
    if (has_arabic(s)) {   // shaped: the contextual forms have their own widths
        for (char32_t cp : arabic_line(s)) if (auto it = glyphs_.find(uint32_t(cp)); it != glyphs_.end()) w += it->second.advance * k;
        return w;
    }
    for (size_t i = 0; i < s.size();) {
        uint32_t cp = next_cp(s, i);
        auto it = glyphs_.find(cp);
        if (it != glyphs_.end()) w += it->second.advance * k;
    }
    return w;
}

float Ui::text(float x, float y, const std::string& s, float size, Rgba c, Align a, float weight, bool outline) {
    std::string t;
    const std::string& str = translate(s, t) ? t : s;
    if (mirrored()) {
        x = w_ - x;
        a = a == Align::Left ? Align::Right : a == Align::Right ? Align::Left : a;
    }
    // the size grows with the text size setting, the line stays where the caller put it
    return text_raw(x, y, str, size * text_scale_, c, a, weight, outline);
}

float Ui::text_raw(float x, float y, const std::string& s, float size, Rgba c, Align a, float weight, bool outline) {
    float k = size / font_px_;
    float w = width_raw(s, size);
    if (a == Align::Center) x -= w / 2;
    else if (a == Align::Right) x -= w;
    float base = y + ascent_ * k;
    float p[4] = {1, 0.5f - weight * 0.12f, outline ? 0.18f : 0.f, 0};
    const bool ar = has_arabic(s);
    const std::u32string shaped = ar ? arabic_line(s) : std::u32string();
    for (size_t i = 0, j = 0; ar ? j < shaped.size() : i < s.size();) {
        uint32_t cp = ar ? uint32_t(shaped[j++]) : next_cp(s, i);
        auto it = glyphs_.find(cp);
        if (it == glyphs_.end()) continue;
        const Glyph& g = it->second;
        if (g.w > 0) quad(x + g.xoff * k, base + g.yoff * k, x + (g.xoff + g.w) * k, base + (g.yoff + g.h) * k, g.u0, g.v0, g.u1, g.v1, c, p);
        x += g.advance * k;
    }
    return w;
}

float Ui::wrap(float x, float y, float w, const std::string& s0, float size, Rgba c, float line_h, float weight) {
    std::string tt;
    const std::string s = translate(s0, tt) ? tt : s0;   // the whole paragraph first: its lines have no entries
    line_h *= text_scale_;   // text() applies the text size; the line height follows it
    std::string line, word;
    float cy = y;
    auto emit = [&]() { text(x, cy, line, size, c, Align::Left, weight); cy += size * line_h; line.clear(); };
    for (size_t i = 0; i <= s.size(); i++) {
        char ch = i < s.size() ? s[i] : ' ';
        if (ch == ' ' || ch == '\n') {
            std::string trial = line.empty() ? word : line + " " + word;
            if (!line.empty() && text_width(trial, size) > w) { emit(); line = word; }
            else line = trial;
            word.clear();
            if (ch == '\n') emit();
        } else word += ch;
    }
    if (!line.empty()) emit();
    return cy - y;
}

void Ui::push_clip(float x, float y, float w, float h) {
    x = mx(x, w);
    verts_.push_back(V{-1e9f, 0, 0, 0, {0, 0, 0, 0}, {x, y, w, h}});  // clip marker
    clips_.push_back(vec4{x, y, w, h});
}

void Ui::pop_clip() {
    clips_.pop_back();
    vec4 c = clips_.empty() ? vec4{0, 0, -1, -1} : clips_.back();
    verts_.push_back(V{-1e9f, 0, 0, 0, {0, 0, 0, 0}, {c.x, c.y, c.z, c.w}});
}

void Ui::set_icons(int w, int h, const void* rgba) {
    icons_.destroy();
    icons_.create(w, h, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, rgba, false);
}

void Ui::icon(float x, float y, float w, float h, int sx, int sy, int sw, int sh, Rgba tint) {
    if (!icons_.id || sw <= 0 || sh <= 0) return;
    float p[4] = {4, 0, 0, 0};
    const float iw = float(icons_.w), ih = float(icons_.h);
    x = mx(x, w);   // where it goes mirrors with the screen; the picture keeps its way round
    quad(x, y, x + w, y + h, sx / iw, sy / ih, (sx + sw) / iw, (sy + sh) / ih, tint, p);
}

void Ui::end(GLuint fbo, int w, int h) {
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glViewport(0, 0, w, h);
    glDisable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    sh_.use();
    sh_.set("uScreen", vec2{w_, h_});
    sh_.set("uTex", 0);
    sh_.set("uIcons", 1);
    sh_.set("uFlipY", 0.f);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, icons_.id ? icons_.id : white_.id);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, font_.id);
    glBindVertexArray(vao_);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_);
    // split the stream at clip markers
    std::vector<V> batch;
    batch.reserve(verts_.size());
    auto draw = [&]() {
        if (batch.empty()) return;
        glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(batch.size() * sizeof(V)), batch.data(), GL_STREAM_DRAW);
        glDrawArrays(GL_TRIANGLES, 0, GLsizei(batch.size()));
        batch.clear();
    };
    float sx = float(w) / w_, sy = float(h) / h_;
    for (auto& v : verts_) {
        if (v.x == -1e9f) {
            draw();
            if (v.p[2] < 0) glDisable(GL_SCISSOR_TEST);
            else {
                glEnable(GL_SCISSOR_TEST);
                glScissor(int(v.p[0] * sx), int(h - (v.p[1] + v.p[3]) * sy), int(v.p[2] * sx + 1), int(v.p[3] * sy + 1));
            }
            continue;
        }
        batch.push_back(v);
    }
    draw();
    glDisable(GL_SCISSOR_TEST);
    glDisable(GL_BLEND);
    glBindVertexArray(0);
}

}  // namespace q
