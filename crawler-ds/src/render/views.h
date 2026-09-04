/*  The two world views, declared once.
 *
 *  These three were prototyped by hand at the top of render.c, which is the
 *  arrangement where a signature can change in view2d.c and the caller's
 *  private copy goes on disagreeing with it: C links them anyway and the
 *  argument list is read off the stack wrong. One header, included by both
 *  sides, is what makes the compiler check that instead.
 */
#ifndef VIEWS_H
#define VIEWS_H

#include "gfx.h"

/*  The dungeon, top-down, into the world layer. */
void view2d_draw(Surface *s);

/*  The party token, drawn at a screen position rather than at its tile: the
 *  battle screen needs them somewhere other than where they are standing. */
void view2d_draw_party(Surface *s, int cx, int cy);

/*  The floor and back wall a battle happens in front of. */
void view3d_arena(Surface *s, int floor_index);

#endif
