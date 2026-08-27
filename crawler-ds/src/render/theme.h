/*  The System's palette.
 *
 *  Every colour here is a step out of the same set the cast is drawn from
 *  (tools/art/palettes.py), so the panel around the game is made of the same
 *  material as the game inside it. It used to be its own invented set of
 *  near-blacks and hot neons, which is why the chrome and the art never
 *  looked like they came from one machine.
 *
 *  Nothing is pure black. Black is a hole in the screen; the darkest thing
 *  here is the ink the sprites are outlined in, so a panel edge and a
 *  crawler's edge are the same line.
 */
#ifndef CRAWLER_THEME_H
#define CRAWLER_THEME_H

#include "gfx.h"

/* --- the console: back-lit blue glass ------------------------------------ */
/*  Not neutral grey. Putting the whole interface on the neutral ramp made a
 *  game whose walls are stone and whose crawlers are copper sit inside a
 *  panel that was the same colour as the walls -- everything one temperature
 *  and nothing separating the machine from the building it is bolted to. The
 *  System is back-lit, so it is drawn out of the blue ramp, which puts it at
 *  the opposite end of the palette from everything it frames. */
#define C_VOID      RGB(0x26, 0x37, 0x42)
#define C_PANEL     RGB(0x25, 0x35, 0x4A)
#define C_PANEL_LIT RGB(0x30, 0x4B, 0x67)
#define C_EDGE      RGB(0x3D, 0x66, 0x88)
#define C_INK       RGB(0xF0, 0xE6, 0xC9)
#define C_DIM       RGB(0xB7, 0xAD, 0x94)
#define C_AMBER     RGB(0xE0, 0xC6, 0x6A)
#define C_AMBER_DK  RGB(0xC3, 0x9B, 0x43)
#define C_SHADOW    RGB(0x24, 0x23, 0x2A)
#define C_PAPER     RGB(0xF1, 0xE8, 0xD0)
#define C_PAPER_DIM RGB(0xD1, 0xC5, 0xA8)

/* --- the colours the show uses to point at things ------------------------ */
#define C_MAGENTA   RGB(0x90, 0x6B, 0x9E)   /* arcane          */
#define C_CYAN      RGB(0x58, 0xA6, 0xB7)   /* water           */
#define C_GREEN     RGB(0x89, 0xAD, 0x5D)   /* grass           */
#define C_RED       RGB(0xB8, 0x40, 0x3D)   /* blood           */
#define C_BLOOD     RGB(0x63, 0x25, 0x2B)
#define C_GOLD      RGB(0xD0, 0xA9, 0x4B)

/*  Window chrome.
 *
 *  A DS window has a dark outline, a light bevel down its top and left, a
 *  dark one down its bottom and right, a gradient through the fill and a soft
 *  shadow under it — that is where the whole "this is a game and not a
 *  console" impression comes from. The fill is the UI dark ramp; the bevels
 *  are its own two ends, so a window is one material lit from a corner rather
 *  than five unrelated blues.
 */
#define C_WIN_TOP   RGB(0x3D, 0x66, 0x88)
#define C_WIN_BOT   RGB(0x25, 0x35, 0x4A)
#define C_WIN_HI    RGB(0x76, 0xA8, 0xC2)
#define C_WIN_LO    RGB(0x26, 0x37, 0x42)
#define C_WIN_EDGE  RGB(0x24, 0x23, 0x2A)

/*  Selection is paper.
 *
 *  Everything else in the System is cold and back-lit, so the one thing the
 *  player has picked is the one warm thing on the panel, and it takes dark
 *  text the way a page does. Lighting a button by tinting it amber made it
 *  glow like every other indicator; making it a different *material* is what
 *  separates "the thing you are on" from "the thing that is flashing".
 */
#define C_SEL_TOP   RGB(0xF1, 0xE8, 0xD0)
#define C_SEL_BOT   RGB(0xD1, 0xC5, 0xA8)
#define C_SEL_HI    RGB(0xF1, 0xE8, 0xD0)
#define C_SEL_INK   RGB(0x20, 0x21, 0x27)   /* what you write on paper */
#define C_SEL_DIM   RGB(0x46, 0x43, 0x3D)

#define C_BG_TOP    RGB(0x26, 0x37, 0x42)
#define C_BG_BOT    RGB(0x24, 0x23, 0x2A)

#endif
