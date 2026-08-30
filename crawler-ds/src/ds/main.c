/*  DS entry point: bring up both screens as 16-bit framebuffers, then run the
 *  game loop. Everything above this file is portable C — the same core and the
 *  same renderer are compiled by tools/hostsim for the desktop bot.
 */
#include <nds.h>
#include <string.h>

#include "platform.h"

static u16 fb_top[SCREEN_W * SCREEN_H];
static u16 fb_bottom[SCREEN_W * SCREEN_H];
static u16 fb_world[WORLD_W * WORLD_H];
static u16 *sub_gfx, *main_gfx, *world_gfx;
uint32_t plat_touch_raw;      /* diagnostics: what the ARM7 actually digitised */

/*  Turning digitiser counts into pixels.
 *
 *  libnds asks the ARM7 to do this with the calibration the console's owner
 *  burned into firmware, which is the right answer on hardware. Emulators that
 *  boot a homebrew ROM directly often hand over a blank user-settings block,
 *  and the ARM7 then divides by a zero span and reports every touch as the top
 *  left corner. So: use the firmware calibration when it is present and
 *  sane, and fall back to the DS's factory values when it is not.
 */
static int cal_x1, cal_y1, cal_x2, cal_y2;
static int cal_px1, cal_py1, cal_px2, cal_py2;

static void touch_calibration_init(void) {
    const PERSONAL_DATA *pd = PersonalData;
    int ok = pd && pd->calX2 != pd->calX1 && pd->calY2 != pd->calY1 &&
             pd->calX2px != pd->calX1px && pd->calY2px != pd->calY1px;
    if (ok) {
        cal_x1 = pd->calX1; cal_y1 = pd->calY1;
        cal_x2 = pd->calX2; cal_y2 = pd->calY2;
        cal_px1 = pd->calX1px; cal_py1 = pd->calY1px;
        cal_px2 = pd->calX2px; cal_py2 = pd->calY2px;
    } else {
        cal_x1 = 0x0200; cal_x2 = 0x0E00; cal_px1 = 0x20; cal_px2 = 0xE0;
        cal_y1 = 0x0DF0; cal_y2 = 0x04F0; cal_py1 = 0x20; cal_py2 = 0xB0;
    }
}

static void touch_map(int rawx, int rawy, int *out_x, int *out_y) {
    int x = (rawx - cal_x1) * (cal_px2 - cal_px1) / (cal_x2 - cal_x1) + cal_px1;
    int y = (rawy - cal_y1) * (cal_py2 - cal_py1) / (cal_y2 - cal_y1) + cal_py1;
    *out_x = x < 0 ? 0 : x > SCREEN_W - 1 ? SCREEN_W - 1 : x;
    *out_y = y < 0 ? 0 : y > SCREEN_H - 1 ? SCREEN_H - 1 : y;
}

/*  libnds reports a failed assertion through the demo console, and console.c
 *  is not built into this SDK because the game draws its own text (see
 *  tools/setup-sdk.sh). bgInit() asserts on its arguments, so the symbol has
 *  to resolve. A no-op is safe here rather than silent: __sassert ends in
 *  while(1) whatever this does, so a broken argument still freezes the ROM on
 *  the frame it happens, which is what a developer would want to see. */
PrintConsole *consoleDemoInit(void) { return 0; }

u16 *plat_screen(int which) {
    return which == SCREEN_TOP ? fb_top
         : which == SCREEN_WORLD ? fb_world : fb_bottom;
}

void plat_init(void) {
    powerOn(POWER_ALL_2D);
    lcdMainOnTop();

    /*  Two layers on the top screen instead of one raw framebuffer.
     *
     *  MODE_FB0 pointed the LCD straight at VRAM A, which is the simplest
     *  thing that works and gives the 2D engine nothing to do. It also meant
     *  every pixel on the screen had to be written by the CPU, and at 49,152
     *  of them a frame that was 25.8ms of a 31.8ms frame.
     *
     *  Now: BG2 carries the dungeon at half size and the affine hardware
     *  magnifies it back up (PA and PD are the source step per screen pixel,
     *  so 0.5 in 8.8 fixed point is a doubling), and BG3 sits above it at full
     *  resolution for text, which cannot survive being halved. BG3's pixels
     *  are transparent wherever bit 15 is clear, so the layer costs only the
     *  rows something is actually written on.
     *
     *  VRAM: BG3's 256x256 bitmap is 128KB, which is all of bank A, so bank B
     *  goes to the main engine too and BG2 lives at the start of it. mapBase
     *  counts 16KB units, and B begins 128KB in. */
    videoSetMode(MODE_5_2D);
    vramSetBankA(VRAM_A_MAIN_BG);
    vramSetBankB(VRAM_B_MAIN_BG);

    int bg_world = bgInit(2, BgType_Bmp16, BgSize_B16_128x128, 8, 0);
    int bg_ui    = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    world_gfx = bgGetGfxPtr(bg_world);
    main_gfx  = bgGetGfxPtr(bg_ui);
    bgSetPriority(bg_ui, 0);          /* lower number is nearer the front */
    bgSetPriority(bg_world, 1);
    bgSetScale(bg_world, 1 << 7, 1 << 7);   /* half a source pixel per screen pixel */
    bgSetCenter(bg_world, 0, 0);
    bgSetScroll(bg_world, 0, 0);
    bgUpdate();
    memset(fb_top, 0, sizeof fb_top);       /* transparent until drawn on */
    memset(main_gfx, 0, SCREEN_W * SCREEN_H * 2);

    videoSetModeSub(MODE_5_2D);      /* sub engine: a 16-bit bitmap background  */
    vramSetBankC(VRAM_C_SUB_BG);
    int bg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    sub_gfx = bgGetGfxPtr(bg);

    irqEnable(IRQ_VBLANK);
    soundEnable();
    touch_calibration_init();
}

/*  ABL_NOVSYNC is for measurement only. With the vblank wait in, a frame
 *  costs one vblank or two and nothing in between, so every stage that fits
 *  inside the slack measures as free and every stage that tips over the edge
 *  measures as a whole 16.7ms -- which compresses real differences to nothing
 *  and inflates trivial ones. Unsynced, the frame counter is proportional to
 *  actual work and the stages can be compared. */
void plat_wait(void) {
#ifndef ABL_NOVSYNC
    swiWaitForVBlank();
#endif
}

/*  `what` is RENDER_TOP | RENDER_BOTTOM: which of the two framebuffers the
 *  renderer actually touched. Sending a screen the renderer left alone costs a
 *  ninety-six kilobyte copy for nothing, which on this machine is most of a
 *  frame.
 *
 *  The flush is the whole cache in one instruction rather than a walk over the
 *  ranges: the data cache is four kilobytes and the two buffers are a hundred
 *  and ninety-two, so walking them is thousands of line operations to clean a
 *  cache that could only have held the last one percent of them anyway. */
static int s_top_y0, s_top_rows = SCREEN_H;
void plat_top_rows(int y0, int rows) {
    if (y0 < 0) y0 = 0;
    if (y0 + rows > SCREEN_H) rows = SCREEN_H - y0;
    s_top_y0 = y0;
    s_top_rows = rows < 0 ? 0 : rows;
}

void plat_present(int what) {
#ifndef ABL_NOFLUSH
    DC_FlushAll();
#endif
#ifndef ABL_NOVSYNC
    swiWaitForVBlank();
#endif
#ifndef ABL_NODMA
    if ((what & RENDER_TOP) && s_top_rows)
        dmaCopyWords(0, fb_top + s_top_y0 * SCREEN_W, main_gfx + s_top_y0 * SCREEN_W,
                     (unsigned)s_top_rows * SCREEN_W * 2);
    if (what & RENDER_WORLD)  dmaCopyWords(2, fb_world, world_gfx, sizeof fb_world);
    if (what & RENDER_BOTTOM) dmaCopyWords(1, fb_bottom, sub_gfx, sizeof fb_bottom);
#endif
    s_top_y0 = 0;
    s_top_rows = SCREEN_H;
}

void plat_poll(PlatInput *in) {
    scanKeys();
    u32 held = keysHeld(), down = keysDown();
    in->held = 0;
    in->pressed = 0;
    static const struct { u32 nds; u32 bit; } map[] = {
        { KEY_UP, BTN_UP }, { KEY_DOWN, BTN_DOWN }, { KEY_LEFT, BTN_LEFT }, { KEY_RIGHT, BTN_RIGHT },
        { KEY_A, BTN_A }, { KEY_B, BTN_B }, { KEY_X, BTN_X }, { KEY_Y, BTN_Y },
        { KEY_L, BTN_L }, { KEY_R, BTN_R }, { KEY_START, BTN_START }, { KEY_SELECT, BTN_SELECT },
    };
    for (unsigned i = 0; i < sizeof map / sizeof map[0]; i++) {
        if (held & map[i].nds) in->held |= map[i].bit;
        if (down & map[i].nds) in->pressed |= map[i].bit;
    }
    in->touching = (held & KEY_TOUCH) != 0;
    in->touch_pressed = (down & KEY_TOUCH) != 0;
    if (in->touching) {
        touchPosition tp;
        touchRead(&tp);
        plat_touch_raw = ((uint32_t)tp.rawx << 16) | tp.rawy;
        if (tp.rawx || tp.rawy) {
            int x, y;
            touch_map(tp.rawx, tp.rawy, &x, &y);
            in->touch_x = x;
            in->touch_y = y;
        } else {
            in->touch_x = tp.px;
            in->touch_y = tp.py;
        }
    }
}

int main(void) {
    plat_init();
    game_boot();
    for (;;) {
        PlatInput in;
        plat_poll(&in);
        int what = game_frame(&in);
        if (what) plat_present(what);
        else plat_wait();
    }
}
