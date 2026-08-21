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
void      plat_wait(void);
void      plat_sound(int voice, int freq, int volume, int duty);
void      plat_sound_stop(int voice);

void game_boot(void);
int  game_frame(const PlatInput *in);

#endif
