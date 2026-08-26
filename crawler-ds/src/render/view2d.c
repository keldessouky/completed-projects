/*  The floor, from above.
 *
 *  A tile map with the camera locked to the party, which is the view the
 *  battles were always drawn for: a Pokemon fight in front of a first-person
 *  corridor was two different games bolted together.
 *
 *  The corridor renderer's textures survive the change. They were built as
 *  tiling 32x32 surfaces, so read from overhead at sixteen screen pixels to
 *  the dungeon tile each one spans a 2x2 block and the pattern never lines up
 *  with the grid -- which is what stops a tiled floor looking like graph
 *  paper. The projection maths and the arena it also drew are still in
 *  view3d.c, because the battle background uses them.
 */
#include "gfx.h"
#include "theme.h"
#include "game.h"
#include "art.h"

#define TILE     16
#define TEXELS   32
#define WALL_LIP 4       /* how much of a wall's south face the camera sees */

typedef struct {
    const uint8_t *wall, *floor;
    const uint16_t *wall_pal, *floor_pal;
    uint16_t fog, trim, edge_lit, edge_dark;
} Tiles;

static void tiles_for(Tiles *t, int floor_index) {
    static const uint8_t kOrder[18] = { 0, 3, 1, 3, 2, 0, 1, 4, 2, 3, 0, 4, 1, 2, 4, 0, 3, 2 };
    int slot = floor_index >= 0 && floor_index < 18 ? kOrder[floor_index] : floor_index % 5;
    const Sprite *w, *f;
    switch (slot) {
    case 0: w = &spr_tex_wall_a; f = &spr_tex_floor_a;
            t->fog = RGB(18, 20, 30); t->trim = RGB(210, 214, 226); break;
    case 1: w = &spr_tex_wall_b; f = &spr_tex_floor_b;
            t->fog = RGB(22, 14, 12); t->trim = RGB(226, 168, 92); break;
    case 2: w = &spr_tex_wall_c; f = &spr_tex_floor_c;
            t->fog = RGB(12, 10, 24); t->trim = RGB(196, 130, 255); break;
    case 3: w = &spr_tex_wall_d; f = &spr_tex_floor_d;
            t->fog = RGB(20, 14, 12); t->trim = RGB(236, 198, 128); break;
    default: w = &spr_tex_wall_e; f = &spr_tex_floor_e;
            t->fog = RGB(10, 16, 12); t->trim = RGB(226, 208, 112); break;
    }
    t->wall = w->pix;  t->wall_pal = w->pal;
    t->floor = f->pix; t->floor_pal = f->pal;
    t->edge_lit = gfx_mix(t->trim, t->fog, 7);
    t->edge_dark = gfx_mix(t->fog, C_VOID, 2);
}

/*  Where the camera is, in world pixels, including the slide between two tiles
 *  that a step is part way through. */
static void camera_of(int *cx, int *cy) {
    int px = g.dun.px * TILE + TILE / 2;
    int py = g.dun.py * TILE + TILE / 2;
    if (g.dun.move_anim) {
        /*  The party is drawn at the destination and the world is slid back
         *  under them, so the sprite stays centred and the floor moves. */
        int t = g.dun.move_anim;
        px -= g.dun.move_dx * TILE * t / WALK_FRAMES;
        py -= g.dun.move_dy * TILE * t / WALK_FRAMES;
    }
    *cx = px - SCREEN_W / 2;
    *cy = py - SCREEN_H / 2;
}

static int solid(int x, int y) { return dungeon_tile(x, y) == T_WALL; }

/*  One tile of floor or wall, sampled from the theme's texture by world
 *  position so the pattern runs across tile boundaries instead of repeating
 *  inside each one. */
static void blit_tile(Surface *s, const Tiles *t, int sx, int sy, int wx, int wy,
                      int is_wall, int shade) {
    const uint8_t *pix = is_wall ? t->wall : t->floor;
    const uint16_t *pal = is_wall ? t->wall_pal : t->floor_pal;
    for (int y = 0; y < TILE; y++) {
        int py = sy + y;
        if (py < 0 || py >= SCREEN_H) continue;
        /*  One texel to one screen pixel, so a 32x32 texture spans a 2x2 block
         *  of tiles and the pattern crosses tile boundaries. Scaling the whole
         *  texture into each tile instead made every tile identical and turned
         *  a concrete floor into graph paper.
         *
         *  A wall texture was drawn for a vertical surface, so the details that
         *  make it read from the side -- the painted dado, the neon strip --
         *  become a stripe across the tops seen from above. Walls take the
         *  plain upper half, which also tiles once per tile rather than once
         *  per two. */
        int v = (wy + y) & (is_wall ? (TEXELS / 2 - 1) : (TEXELS - 1));
        uint16_t *dst = s->px + py * SCREEN_W;
        for (int x = 0; x < TILE; x++) {
            int px = sx + x;
            if (px < 0 || px >= SCREEN_W) continue;
            int u = (wx + x) & (TEXELS - 1);
            uint16_t c = pal[pix[v * TEXELS + u]];
            /*  Positive shade sinks a surface into the haze; negative lifts it
             *  toward the floor's own trim, which is how the walkable ground
             *  ends up brighter than the walls rather than merely less dark. */
            if (shade > 0) c = gfx_mix(c, t->fog, shade);
            else if (shade < 0) c = gfx_mix(c, t->trim, -shade);
            dst[px] = c;
        }
    }
}

/*  One crawler, at a screen position, facing a direction. Three sprites and a
 *  mirror cover the four facings; the bob is a single pixel on alternate
 *  half-strides, which at this size is the whole walk cycle. */
static void draw_crawler(Surface *s, int slot, int sx, int sy, int facing, int walking) {
    int who = g.hero[slot].crawler & 3;
    static const uint8_t kFace[4] = { 1, 2, 0, 2 };   /* N->up E->side S->down W->side */
    const Sprite *sp = sprite_table[SPR_OW_CARL_DOWN + who * 3 + kFace[facing & 3]];
    int bob = walking && ((g.dun.move_anim >> 1) & 1);
    sy -= bob;
    /*  A shadow, so the party sits on the floor rather than hovering over it. */
    gfx_dither(s, sx + 3, sy + sp->h - 2, sp->w - 6, 3, C_VOID, 8);
    if ((facing & 3) == 3) gfx_sprite_flip(s, sp, sx, sy);
    else gfx_sprite(s, sp, sx, sy);
    if (g.hero[slot].hp <= 0) gfx_shade(s, sx, sy, sp->w, sp->h, 9);
}

/*  The party: whoever is leading, and the other one walking in their tracks.
 *  A follower a tile behind is the genre's way of saying there are two of you
 *  without giving the second one a square to be blocked by. */
void view2d_draw_party(Surface *s, int cx, int cy) {
    static const int dx4[4] = { 0, 1, 0, -1 };
    static const int dy4[4] = { -1, 0, 1, 0 };
    int f = g.dun.facing & 3;
    int walking = g.dun.move_anim > 0;

    int slide_x = 0, slide_y = 0;
    if (walking) {
        slide_x = g.dun.move_dx * TILE * g.dun.move_anim / WALK_FRAMES;
        slide_y = g.dun.move_dy * TILE * g.dun.move_anim / WALK_FRAMES;
    }

    /*  The follower stands where the leader was a tile ago and is still
     *  finishing the step before that, so it trails by exactly one stride. */
    int fx = cx - dx4[f] * TILE + slide_x;
    int fy = cy - dy4[f] * TILE + slide_y;

    /*  Painter's order by screen row: whoever is further down the screen is
     *  nearer the camera and goes on top. Drawing the leader last regardless
     *  hid the follower's head behind them whenever the party walked north --
     *  which took Donut's crown and ears with it, and she is most of what
     *  makes the pair recognisable at this size. */
    if (fy > cy) {
        draw_crawler(s, 0, cx - 8, cy - 14, f, walking);
        draw_crawler(s, 1, fx - 8, fy - 14, f, walking);
    } else {
        draw_crawler(s, 1, fx - 8, fy - 14, f, walking);
        draw_crawler(s, 0, cx - 8, cy - 14, f, walking);
    }
}

void view2d_draw(Surface *s) {
    const Dungeon *d = &g.dun;
    Tiles t;
    tiles_for(&t, d->index);

    int cx, cy;
    camera_of(&cx, &cy);
    int tx0 = cx / TILE - 1, ty0 = cy / TILE - 1;
    int cols = SCREEN_W / TILE + 3, rows = SCREEN_H / TILE + 3;

    gfx_clear(s, t.fog);

    /*  Floor first, everywhere, then walls on top of it: a wall's south face
     *  hangs over the tile below and has to be drawn after it. */
    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            if (!dungeon_seen(mx, my) || solid(mx, my)) continue;
            /*  And the floor comes up a step, away from the walls rather than
             *  only having them move away from it. */
            blit_tile(s, &t, mx * TILE - cx, my * TILE - cy, mx * TILE, my * TILE, 0, -2);
        }

    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            if (!dungeon_seen(mx, my) || !solid(mx, my)) continue;
            int sx = mx * TILE - cx, sy = my * TILE - cy;
            /*  Overhead, a wall and the floor beside it are the same material
             *  at the same angle, so nothing separates them but what the
             *  renderer decides to do. Half-and-half toward the haze was not
             *  enough -- the map read as one texture with a person standing on
             *  it. Walls go most of the way down, and every exposed edge gets
             *  a line, which between them is what makes a block a block. */
            blit_tile(s, &t, sx, sy, mx * TILE, my * TILE, 1, 11);
            /*  A block only reads as having height if the camera can see a
             *  sliver of the face pointing at it, so a wall with open floor
             *  below gets one, plus the shadow it throws. */
            if (!solid(mx, my + 1) && dungeon_seen(mx, my + 1)) {
                gfx_rect(s, sx, sy + TILE, TILE, WALL_LIP,
                         gfx_mix(t.wall_pal[0], t.fog, 9));
                gfx_hline(s, sx, sx + TILE - 1, sy + TILE, t.edge_lit);
                gfx_dither(s, sx, sy + TILE + WALL_LIP, TILE, 2, C_VOID, 6);
            }
            /*  Every exposed edge gets a line, so a block of wall has a shape
             *  rather than melting into the block beside it. */
            if (!solid(mx, my - 1)) gfx_hline(s, sx, sx + TILE - 1, sy, t.edge_dark);
            if (!solid(mx - 1, my)) gfx_vline(s, sx, sy, sy + TILE - 1, t.edge_dark);
            if (!solid(mx + 1, my)) gfx_vline(s, sx + TILE - 1, sy, sy + TILE - 1, t.edge_dark);
        }

    /*  Anything standing on the floor. Drawn small: these are props seen from
     *  above now, not things filling a corridor. */
    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            if (!dungeon_seen(mx, my)) continue;
            const Sprite *sp = 0;
            switch (dungeon_tile(mx, my)) {
            case T_DOWN: case T_UP: sp = &spr_stairs; break;
            case T_SHOP: sp = &spr_shop; break;
            case T_SHRINE: case T_KIOSK: sp = &spr_shrine; break;
            case T_DOOR: sp = &spr_door; break;
            case T_BOX: sp = &spr_box_bronze; break;
            case T_BOX_GOLD: sp = &spr_box_gold; break;
            default: break;
            }
            char tile = dungeon_tile(mx, my);
            if ((tile == T_BOX || tile == T_BOX_GOLD) && dungeon_is_used(mx, my)) sp = 0;
            if (!sp) continue;
            int scale = 40;
            int w = sp->w * scale / 100, h = sp->h * scale / 100;
            gfx_sprite_scaled(s, sp, mx * TILE - cx + (TILE - w) / 2,
                              my * TILE - cy + TILE - h, scale, 100);
        }

    /*  The bosses get a marker rather than a sprite: their art is battle-sized
     *  and a boss chamber should read as a door you choose to walk through. */
    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            char tile = dungeon_tile(mx, my);
            if ((tile != T_BOSS && tile != T_NBOSS) || !dungeon_seen(mx, my)) continue;
            if (dungeon_is_used(mx, my)) continue;
            int sx = mx * TILE - cx, sy = my * TILE - cy;
            uint16_t c = tile == T_BOSS ? C_RED : C_MAGENTA;
            gfx_frame(s, sx + 1, sy + 1, TILE - 2, TILE - 2, c);
            gfx_frame(s, sx + 3, sy + 3, TILE - 6, TILE - 6, gfx_mix(c, t.fog, 8));
            if ((g.anim >> 3) & 1) gfx_rect(s, sx + 6, sy + 6, 4, 4, c);
        }

    view2d_draw_party(s, SCREEN_W / 2, SCREEN_H / 2);

    /*  Everything the party has not walked past yet stays under the haze, and
     *  the edge of what they can see is a soft one. */
    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            if (dungeon_seen(mx, my)) continue;
            int sx = mx * TILE - cx, sy = my * TILE - cy;
            gfx_rect(s, sx, sy, TILE, TILE, t.fog);
        }
    for (int i = 0; i < 10; i++) {
        int a = (10 - i) / 3;
        if (!a) continue;
        gfx_vline(s, i, 0, SCREEN_H - 1, gfx_mix(s->px[i], C_VOID, a));
        gfx_vline(s, SCREEN_W - 1 - i, 0, SCREEN_H - 1,
                  gfx_mix(s->px[SCREEN_W - 1 - i], C_VOID, a));
    }
}
