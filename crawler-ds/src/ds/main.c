/*  DS entry point: bring up both screens as 16-bit framebuffers, then run the
 *  game loop. Everything above this file is portable C — the same core and the
 *  same renderer are compiled by tools/hostsim for the desktop bot.
 */
#include <nds.h>
#include <string.h>

#include "platform.h"

static u16 fb_top[SCREEN_W * SCREEN_H];
static u16 fb_bottom[SCREEN_W * SCREEN_H];
static u16 *sub_gfx;
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

u16 *plat_screen(int which) { return which == SCREEN_TOP ? fb_top : fb_bottom; }

void plat_init(void) {
    powerOn(POWER_ALL_2D);
    lcdMainOnTop();

    videoSetMode(MODE_FB0);          /* main engine: VRAM A straight to the LCD */
    vramSetBankA(VRAM_A_LCD);

    videoSetModeSub(MODE_5_2D);      /* sub engine: a 16-bit bitmap background  */
    vramSetBankC(VRAM_C_SUB_BG);
    int bg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    sub_gfx = bgGetGfxPtr(bg);

    irqEnable(IRQ_VBLANK);
    soundEnable();
    touch_calibration_init();
}

void plat_wait(void) { swiWaitForVBlank(); }

void plat_present(void) {
    DC_FlushRange(fb_top, sizeof fb_top);
    DC_FlushRange(fb_bottom, sizeof fb_bottom);
    swiWaitForVBlank();
    dmaCopyWords(0, fb_top, VRAM_A, sizeof fb_top);
    dmaCopyWords(1, fb_bottom, sub_gfx, sizeof fb_bottom);
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
        if (game_frame(&in)) plat_present();
        else plat_wait();
    }
}
