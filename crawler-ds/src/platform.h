/*  The whole surface the game is allowed to touch outside portable C.
 *
 *  Two implementations exist: src/ds (real hardware) and tools/hostsim (a
 *  desktop harness that runs the same game with a scripted player and writes
 *  PNGs). Keeping this list short is what makes the second one possible.
 */
#ifndef CRAWLER_PLATFORM_H
#define CRAWLER_PLATFORM_H

#include <stdint.h>

#define SCREEN_W 256
#define SCREEN_H 192
#define SCREEN_TOP    0
#define SCREEN_BOTTOM 1
/*  The dungeon's own layer, at half resolution, magnified back to full size by
 *  the 2D engine's affine hardware.
 *
 *  The CPU was writing all 49,152 pixels of the top screen every frame and
 *  that cost 25.8ms of a 31.8ms frame against a 16.7ms budget -- the cost
 *  tracks pixel count and nothing else, which three separate inner-loop
 *  rewrites failed to move. Quartering the pixels is the only thing that
 *  helps, and the hardware will magnify for free.
 *
 *  It is not the quality loss it sounds like. The party are 16x20 sprites that
 *  this renderer was already drawing pixel-doubled, so they come out of the
 *  magnifier identical; what actually softens is the wall and floor texture,
 *  and the result is a screen where everything is chunky at the same rate
 *  rather than 2x characters standing on 1x ground.
 *
 *  Text is the exception -- a 5x7 font cannot survive being halved -- so it
 *  stays on SCREEN_TOP, which is a full-resolution transparent layer sitting
 *  above this one. */
#define SCREEN_WORLD  2
#define WORLD_W 128
#define WORLD_H  96

enum {
    BTN_UP     = 1u << 0,
    BTN_DOWN   = 1u << 1,
    BTN_LEFT   = 1u << 2,
    BTN_RIGHT  = 1u << 3,
    BTN_A      = 1u << 4,
    BTN_B      = 1u << 5,
    BTN_X      = 1u << 6,
    BTN_Y      = 1u << 7,
    BTN_L      = 1u << 8,
    BTN_R      = 1u << 9,
    BTN_START  = 1u << 10,
    BTN_SELECT = 1u << 11,
};

typedef struct {
    uint32_t held;
    uint32_t pressed;      /* edge-triggered this frame */
    int      touching;
    int      touch_pressed;
    int      touch_x, touch_y;
} PlatInput;

uint16_t *plat_screen(int which);
/*  What the renderer reports as needing to reach the panels: which of the two
 *  framebuffers it touched this frame. Zero means nothing changed and neither
 *  screen has to be sent. */
#define RENDER_TOP     1
#define RENDER_BOTTOM  2
#define RENDER_WORLD   4

/*  How much of the full-size top layer actually changed this frame, in rows.
 *  The dungeon writes only its system bar there most frames, and sending the
 *  whole 96KB buffer to VRAM for sixteen rows of text was measured costing
 *  more than the dungeon's floor tiles. Reset to the whole screen after every
 *  present, so a caller that says nothing gets the safe answer. */
void      plat_top_rows(int y0, int rows);
void      plat_wait(void);
void      plat_present(int what);
void      plat_sound(int voice, int freq, int volume, int duty);
void      plat_sound_stop(int voice);

void game_boot(void);
int  game_frame(const PlatInput *in);

#endif
