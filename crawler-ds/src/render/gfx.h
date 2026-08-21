/*  The software renderer.
 *
 *  Both DS screens are plain 16-bit buffers in main RAM that the platform layer
 *  DMAs to VRAM once a frame, so everything here is portable C: the desktop
 *  harness draws the same pixels the handheld does.
 */
#ifndef CRAWLER_GFX_H
#define CRAWLER_GFX_H

#include <stdint.h>

#include "platform.h"

typedef struct {
    uint16_t *px;
    int w, h;
} Surface;

/* 5-5-5 with the DS's alpha bit always set. */
#define RGB(r, g, b) ((uint16_t)(0x8000 | (((b) >> 3) << 10) | (((g) >> 3) << 5) | ((r) >> 3)))

typedef struct {
    uint8_t  w, h, npal, pad;
    const uint16_t *pal;
    const uint8_t  *pix;
} Sprite;

/* --- surfaces ---------------------------------------------------------- */
Surface gfx_surface(int screen);
void    gfx_clear(Surface *s, uint16_t colour);

/* --- primitives -------------------------------------------------------- */
void gfx_pixel(Surface *s, int x, int y, uint16_t c);
void gfx_hline(Surface *s, int x0, int x1, int y, uint16_t c);
void gfx_vline(Surface *s, int x, int y0, int y1, uint16_t c);
void gfx_rect(Surface *s, int x, int y, int w, int h, uint16_t c);
void gfx_frame(Surface *s, int x, int y, int w, int h, uint16_t c);
void gfx_panel(Surface *s, int x, int y, int w, int h, uint16_t fill, uint16_t edge);
void gfx_vgradient(Surface *s, int x, int y, int w, int h, uint16_t top, uint16_t bottom);
void gfx_dither(Surface *s, int x, int y, int w, int h, uint16_t c, int density);
void gfx_shade(Surface *s, int x, int y, int w, int h, int amount);
void gfx_trapezoid(Surface *s, int x0, int yt0, int yb0, int x1, int yt1, int yb1,
                   uint16_t near_c, uint16_t far_c);

/* --- sprites ----------------------------------------------------------- */
void gfx_sprite(Surface *s, const Sprite *sp, int x, int y);
void gfx_sprite_scaled(Surface *s, const Sprite *sp, int x, int y, int num, int den);
void gfx_sprite_tinted(Surface *s, const Sprite *sp, int x, int y, uint16_t tint, int mix);

/* --- text -------------------------------------------------------------- */
#define TEXT_W 6            /* 5px glyph + 1px bearing */
#define TEXT_H 8            /* 7px glyph + 1px leading */
int  gfx_text(Surface *s, int x, int y, uint16_t c, const char *str);
int  gfx_text_big(Surface *s, int x, int y, uint16_t c, const char *str);
int  gfx_text_shadow(Surface *s, int x, int y, uint16_t c, uint16_t shadow, const char *str);
int  gfx_text_width(const char *str);
int  gfx_text_wrapped(Surface *s, int x, int y, int width_px, uint16_t c, const char *str);
int  gfx_text_wrapped_count(int width_px, const char *str);

/* Numbers, without dragging in stdio. */
const char *gfx_num(int value);
const char *gfx_numpad(int value, int digits);

/* --- easing / helpers -------------------------------------------------- */
uint16_t gfx_mix(uint16_t a, uint16_t b, int t /* 0..16 */);
uint16_t gfx_scale_colour(uint16_t c, int num, int den);

#endif
