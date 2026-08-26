#include "gfx.h"
#include "theme.h"

#include <string.h>

#include "art.h"

Surface gfx_surface(int screen) {
    Surface s;
    s.px = plat_screen(screen);
    s.w = SCREEN_W;
    s.h = SCREEN_H;
    return s;
}

void gfx_clear(Surface *s, uint16_t colour) {
    /* 32-bit stores: the ARM9 writes main RAM twice as fast in pairs. */
    uint32_t pair = ((uint32_t)colour << 16) | colour;
    uint32_t *p = (uint32_t *)s->px;
    int n = s->w * s->h / 2;
    while (n--) *p++ = pair;
}

void gfx_pixel(Surface *s, int x, int y, uint16_t c) {
    if ((unsigned)x < (unsigned)s->w && (unsigned)y < (unsigned)s->h)
        s->px[y * s->w + x] = c;
}

void gfx_hline(Surface *s, int x0, int x1, int y, uint16_t c) {
    if ((unsigned)y >= (unsigned)s->h) return;
    if (x0 > x1) { int t = x0; x0 = x1; x1 = t; }
    if (x1 < 0 || x0 >= s->w) return;
    if (x0 < 0) x0 = 0;
    if (x1 >= s->w) x1 = s->w - 1;
    uint16_t *p = s->px + y * s->w + x0;
    for (int x = x0; x <= x1; x++) *p++ = c;
}

void gfx_vline(Surface *s, int x, int y0, int y1, uint16_t c) {
    if ((unsigned)x >= (unsigned)s->w) return;
    if (y0 > y1) { int t = y0; y0 = y1; y1 = t; }
    if (y1 < 0 || y0 >= s->h) return;
    if (y0 < 0) y0 = 0;
    if (y1 >= s->h) y1 = s->h - 1;
    uint16_t *p = s->px + y0 * s->w + x;
    for (int y = y0; y <= y1; y++) { *p = c; p += s->w; }
}

void gfx_rect(Surface *s, int x, int y, int w, int h, uint16_t c) {
    for (int i = 0; i < h; i++) gfx_hline(s, x, x + w - 1, y + i, c);
}

void gfx_frame(Surface *s, int x, int y, int w, int h, uint16_t c) {
    gfx_hline(s, x, x + w - 1, y, c);
    gfx_hline(s, x, x + w - 1, y + h - 1, c);
    gfx_vline(s, x, y, y + h - 1, c);
    gfx_vline(s, x + w - 1, y, y + h - 1, c);
}

void gfx_panel(Surface *s, int x, int y, int w, int h, uint16_t fill, uint16_t edge) {
    gfx_rect(s, x + 1, y + 1, w - 2, h - 2, fill);
    gfx_hline(s, x + 1, x + w - 2, y, edge);
    gfx_hline(s, x + 1, x + w - 2, y + h - 1, edge);
    gfx_vline(s, x, y + 1, y + h - 2, edge);
    gfx_vline(s, x + w - 1, y + 1, y + h - 2, edge);
}

/*  A window with a shape to it: corners chamfered so it does not read as a
 *  spreadsheet cell, a light bevel down the top and left, a dark one down the
 *  bottom and right, and a gradient through the fill. */
void gfx_window(Surface *s, int x, int y, int w, int h,
                uint16_t top, uint16_t bottom, uint16_t hi, uint16_t lo,
                uint16_t edge) {
    if (w < 6 || h < 6) { gfx_panel(s, x, y, w, h, top, edge); return; }

    gfx_vgradient(s, x + 1, y + 1, w - 2, h - 2, top, bottom);

    /* the outline, with the four corner pixels cut away */
    gfx_hline(s, x + 2, x + w - 3, y, edge);
    gfx_hline(s, x + 2, x + w - 3, y + h - 1, edge);
    gfx_vline(s, x, y + 2, y + h - 3, edge);
    gfx_vline(s, x + w - 1, y + 2, y + h - 3, edge);
    gfx_pixel(s, x + 1, y + 1, edge);
    gfx_pixel(s, x + w - 2, y + 1, edge);
    gfx_pixel(s, x + 1, y + h - 2, edge);
    gfx_pixel(s, x + w - 2, y + h - 2, edge);

    /* the bevels, which are what make it look pressed out of something */
    gfx_hline(s, x + 2, x + w - 3, y + 1, hi);
    gfx_vline(s, x + 1, y + 2, y + h - 3, hi);
    gfx_hline(s, x + 2, x + w - 3, y + h - 2, lo);
    gfx_vline(s, x + w - 2, y + 2, y + h - 3, lo);
}

/*  A soft shadow under a window, dithered so it fades rather than stops. */
void gfx_window_shadow(Surface *s, int x, int y, int w, int h) {
    gfx_dither(s, x + 2, y + h, w - 2, 2, C_SHADOW, 11);
    gfx_dither(s, x + w, y + 2, 2, h - 2, C_SHADOW, 11);
    gfx_dither(s, x + 3, y + h + 2, w - 4, 1, C_SHADOW, 5);
}

uint16_t gfx_mix(uint16_t a, uint16_t b, int t) {
    int ar = a & 31, ag = (a >> 5) & 31, ab = (a >> 10) & 31;
    int br = b & 31, bg = (b >> 5) & 31, bb = (b >> 10) & 31;
    int r = ar + (br - ar) * t / 16;
    int g = ag + (bg - ag) * t / 16;
    int bl = ab + (bb - ab) * t / 16;
    return (uint16_t)(0x8000 | (bl << 10) | (g << 5) | r);
}

uint16_t gfx_scale_colour(uint16_t c, int num, int den) {
    int r = (c & 31) * num / den, g = ((c >> 5) & 31) * num / den, b = ((c >> 10) & 31) * num / den;
    if (r > 31) r = 31;
    if (g > 31) g = 31;
    if (b > 31) b = 31;
    return (uint16_t)(0x8000 | (b << 10) | (g << 5) | r);
}

void gfx_vgradient(Surface *s, int x, int y, int w, int h, uint16_t top, uint16_t bottom) {
    for (int i = 0; i < h; i++) {
        uint16_t c = gfx_mix(top, bottom, h > 1 ? i * 16 / (h - 1) : 0);
        gfx_hline(s, x, x + w - 1, y + i, c);
    }
}

/* An ordered 4x4 dither, used for fog, grime and the System's scanlines. */
static const uint8_t kBayer[16] = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };

void gfx_dither(Surface *s, int x, int y, int w, int h, uint16_t c, int density) {
    int x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
    int x1 = x + w > s->w ? s->w : x + w;
    int y1 = y + h > s->h ? s->h : y + h;
    for (int j = y0; j < y1; j++) {
        const uint8_t *row = &kBayer[(j & 3) << 2];
        uint16_t *dst = s->px + j * s->w;
        for (int i = x0; i < x1; i++)
            if (row[i & 3] < density) dst[i] = c;
    }
}

void gfx_shade(Surface *s, int x, int y, int w, int h, int amount) {
    for (int j = 0; j < h; j++) {
        int yy = y + j;
        if ((unsigned)yy >= (unsigned)s->h) continue;
        for (int i = 0; i < w; i++) {
            int xx = x + i;
            if ((unsigned)xx >= (unsigned)s->w) continue;
            uint16_t *p = &s->px[yy * s->w + xx];
            *p = gfx_scale_colour(*p, amount, 16);
        }
    }
}

/* Fills the band between two vertical edges, shading from near to far. This is
   how the arena's walls are drawn. */
void gfx_trapezoid(Surface *s, int x0, int yt0, int yb0, int x1, int yt1, int yb1,
                   uint16_t near_c, uint16_t far_c) {
    if (x0 == x1) return;
    int step = x1 > x0 ? 1 : -1;
    int span = x1 - x0;
    for (int x = x0; x != x1; x += step) {
        int t = (x - x0) * 16 / span;
        int yt = yt0 + (yt1 - yt0) * (x - x0) / span;
        int yb = yb0 + (yb1 - yb0) * (x - x0) / span;
        gfx_vline(s, x, yt, yb, gfx_mix(near_c, far_c, t));
    }
}

/*  The same sprite, mirrored. An overworld only needs three facings drawn if
 *  the fourth is the third turned round, which is how every sprite sheet in
 *  the genre saves a quarter of its art. */
void gfx_sprite_flip(Surface *s, const Sprite *sp, int x, int y) {
    for (int j = 0; j < sp->h; j++) {
        int yy = y + j;
        if ((unsigned)yy >= (unsigned)s->h) continue;
        const uint8_t *row = sp->pix + j * sp->w;
        uint16_t *dst = s->px + yy * s->w;
        for (int i = 0; i < sp->w; i++) {
            uint8_t idx = row[i];
            int xx = x + sp->w - 1 - i;
            if (idx && (unsigned)xx < (unsigned)s->w) dst[xx] = sp->pal[idx];
        }
    }
}

void gfx_sprite(Surface *s, const Sprite *sp, int x, int y) {
    for (int j = 0; j < sp->h; j++) {
        int yy = y + j;
        if ((unsigned)yy >= (unsigned)s->h) continue;
        const uint8_t *row = sp->pix + j * sp->w;
        uint16_t *dst = s->px + yy * s->w;
        for (int i = 0; i < sp->w; i++) {
            uint8_t idx = row[i];
            int xx = x + i;
            if (idx && (unsigned)xx < (unsigned)s->w) dst[xx] = sp->pal[idx];
        }
    }
}

/*  Scaled blits are the hot path in a fight, and the ARM9 has no divider: doing
 *  `i * den / num` per pixel costs more than the rest of the screen put
 *  together. The column map is built once per call and the source row is
 *  stepped with an accumulator, which takes the divisions from width*height
 *  down to width. */
void gfx_sprite_scaled(Surface *s, const Sprite *sp, int x, int y, int num, int den) {
    if (num == den) { gfx_sprite(s, sp, x, y); return; }
    int w = sp->w * num / den, h = sp->h * num / den;
    if (w <= 0 || h <= 0) return;

    static uint8_t colmap[SCREEN_W];
    int cols = w > SCREEN_W ? SCREEN_W : w;
    for (int i = 0; i < cols; i++) colmap[i] = (uint8_t)(i * den / num);

    int sy = 0, err = 0;
    for (int j = 0; j < h; j++) {
        int yy = y + j;
        if ((unsigned)yy < (unsigned)s->h && sy < sp->h) {
            const uint8_t *row = sp->pix + sy * sp->w;
            uint16_t *dst = s->px + yy * s->w;
            int i0 = 0, i1 = cols;
            if (x < 0) i0 = -x;
            if (x + i1 > s->w) i1 = s->w - x;
            for (int i = i0; i < i1; i++) {
                uint8_t idx = row[colmap[i]];
                if (idx) dst[x + i] = sp->pal[idx];
            }
        }
        err += den;                       /* advance the source row */
        while (err >= num) { err -= num; sy++; }
    }
}

void gfx_sprite_tinted(Surface *s, const Sprite *sp, int x, int y, uint16_t tint, int mix) {
    for (int j = 0; j < sp->h; j++) {
        int yy = y + j;
        if ((unsigned)yy >= (unsigned)s->h) continue;
        const uint8_t *row = sp->pix + j * sp->w;
        uint16_t *dst = s->px + yy * s->w;
        for (int i = 0; i < sp->w; i++) {
            uint8_t idx = row[i];
            int xx = x + i;
            if (idx && (unsigned)xx < (unsigned)s->w)
                dst[xx] = gfx_mix(sp->pal[idx], tint, mix);
        }
    }
}

/* ----------------------------------------------------------------- text -- */

static void glyph(Surface *s, int x, int y, uint16_t c, unsigned char ch) {
    if (ch < FONT_FIRST || ch > FONT_LAST) ch = '?';
    const uint8_t *rows = font5x7[ch - FONT_FIRST];
    for (int j = 0; j < 7; j++) {
        uint8_t bits = rows[j];
        if (!bits) continue;
        for (int i = 0; i < 5; i++)
            if (bits & (1 << (4 - i))) gfx_pixel(s, x + i, y + j, c);
    }
}

int gfx_text(Surface *s, int x, int y, uint16_t c, const char *str) {
    int x0 = x;
    for (; *str; str++) {
        if (*str == '\n') { y += TEXT_H; x = x0; continue; }
        glyph(s, x, y, c, (unsigned char)*str);
        x += TEXT_W;
    }
    return x;
}

int gfx_text_shadow(Surface *s, int x, int y, uint16_t c, uint16_t shadow, const char *str) {
    gfx_text(s, x + 1, y + 1, shadow, str);
    return gfx_text(s, x, y, c, str);
}

int gfx_text_big(Surface *s, int x, int y, uint16_t c, const char *str) {
    for (; *str; str++) {
        unsigned char ch = (unsigned char)*str;
        if (ch < FONT_FIRST || ch > FONT_LAST) ch = '?';
        const uint8_t *rows = font5x7[ch - FONT_FIRST];
        for (int j = 0; j < 7; j++) {
            uint8_t bits = rows[j];
            for (int i = 0; i < 5; i++)
                if (bits & (1 << (4 - i))) gfx_rect(s, x + i * 2, y + j * 2, 2, 2, c);
        }
        x += TEXT_W * 2;
    }
    return x;
}

int gfx_text_width(const char *str) {
    int n = 0;
    for (; *str; str++) n++;
    return n * TEXT_W;
}

/* Word-wraps at the given pixel width; returns the number of lines drawn.
   Passing a NULL surface measures without drawing. */
static int wrap(Surface *s, int x, int y, int width_px, uint16_t c, const char *str) {
    int cols = width_px / TEXT_W;
    int line = 0;
    while (*str) {
        while (*str == ' ') str++;
        if (!*str) break;
        const char *end = str;
        const char *last_space = 0;
        int n = 0;
        while (*end && n < cols && *end != '\n') {
            if (*end == ' ') last_space = end;
            end++;
            n++;
        }
        if (*end && *end != '\n' && *end != ' ' && last_space) end = last_space;
        if (s) {
            int px = x;
            for (const char *p = str; p < end; p++) {
                glyph(s, px, y + line * TEXT_H, c, (unsigned char)*p);
                px += TEXT_W;
            }
        }
        line++;
        str = end;
        if (*str == '\n') str++;
    }
    return line;
}

int gfx_text_wrapped(Surface *s, int x, int y, int width_px, uint16_t c, const char *str) {
    return wrap(s, x, y, width_px, c, str);
}

int gfx_text_wrapped_count(int width_px, const char *str) {
    return wrap(0, 0, 0, width_px, 0, str);
}

static char num_buf[16];

const char *gfx_num(int value) {
    char tmp[12];
    int n = 0, neg = value < 0;
    unsigned v = neg ? (unsigned)(-value) : (unsigned)value;
    do { tmp[n++] = (char)('0' + v % 10); v /= 10; } while (v);
    int o = 0;
    if (neg) num_buf[o++] = '-';
    while (n) num_buf[o++] = tmp[--n];
    num_buf[o] = 0;
    return num_buf;
}

const char *gfx_numpad(int value, int digits) {
    const char *s = gfx_num(value);
    static char pad[16];
    int len = 0;
    while (s[len]) len++;
    int o = 0;
    for (int i = len; i < digits && o < 15; i++) pad[o++] = '0';
    for (int i = 0; i < len && o < 15; i++) pad[o++] = s[i];
    pad[o] = 0;
    return pad;
}
