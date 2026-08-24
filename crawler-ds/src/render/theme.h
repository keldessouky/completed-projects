/*  The System's palette. Black glass, amber type, magenta for anything the
 *  show wants you looking at. */
#ifndef CRAWLER_THEME_H
#define CRAWLER_THEME_H

#include "gfx.h"

#define C_VOID      RGB(8, 8, 12)
#define C_PANEL     RGB(18, 20, 30)
#define C_PANEL_LIT RGB(30, 34, 48)
#define C_EDGE      RGB(64, 72, 96)
#define C_INK       RGB(232, 226, 210)
#define C_DIM       RGB(132, 132, 148)
#define C_AMBER     RGB(255, 186, 62)
#define C_AMBER_DK  RGB(150, 96, 20)
#define C_MAGENTA   RGB(255, 64, 160)
#define C_CYAN      RGB(86, 220, 232)
#define C_GREEN     RGB(110, 220, 120)
#define C_RED       RGB(232, 68, 68)
#define C_BLOOD     RGB(128, 24, 32)
#define C_GOLD      RGB(250, 208, 80)
#define C_SHADOW    RGB(4, 4, 8)

/*  Window chrome.
 *
 *  Everything used to be a one-pixel amber outline on near-black, which is a
 *  terminal, not a handheld. A DS window has a dark outline, a light bevel
 *  down its top and left, a dark one down its bottom and right, a gradient
 *  through the fill and a soft shadow under it — that is where the whole
 *  "this is a game and not a console" impression comes from.
 */
#define C_WIN_TOP   RGB(62, 70, 112)
#define C_WIN_BOT   RGB(28, 30, 58)
#define C_WIN_HI    RGB(128, 140, 192)
#define C_WIN_LO    RGB(16, 16, 32)
#define C_WIN_EDGE  RGB(8, 8, 16)

#define C_SEL_TOP   RGB(136, 100, 40)
#define C_SEL_BOT   RGB(74, 50, 16)
#define C_SEL_HI    RGB(240, 190, 96)

#define C_BG_TOP    RGB(34, 30, 60)
#define C_BG_BOT    RGB(12, 12, 26)

#endif
