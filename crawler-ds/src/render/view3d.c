/*  The corridor.
 *
 *  Not a raycaster: a stack of nested rectangles, the way the genre has always
 *  drawn a grid dungeon. Walls at each depth get their own shade, side walls
 *  are trapezoids between two depths, and everything past the first blocked
 *  tile is simply never drawn.
 */
#include "gfx.h"
#include "theme.h"
#include "game.h"
#include "art.h"

#define HORIZON 92
#define MAX_DEPTH 5

/* Half-width and half-height of the corridor opening at each depth. */
static const int kHalfW[MAX_DEPTH + 1] = { 164, 104, 64, 40, 25, 16 };
static const int kHalfH[MAX_DEPTH + 1] = { 132,  84, 52, 32, 20, 13 };

static const int dx4[4] = { 0, 1, 0, -1 };
static const int dy4[4] = { -1, 0, 1, 0 };

typedef struct { uint16_t wall, wall_dark, trim, floor_near, floor_far, ceil; } FloorPalette;

static FloorPalette palette_for(int floor_index) {
    FloorPalette p;
    switch (floor_index) {
    case 0:   /* poured concrete under a city that used to be up there */
        p.wall = RGB(150, 156, 172); p.wall_dark = RGB(66, 72, 92);
        p.trim = RGB(210, 214, 226);
        p.floor_near = RGB(104, 100, 108); p.floor_far = RGB(34, 34, 44);
        p.ceil = RGB(20, 22, 32);
        break;
    case 1:   /* rust, sodium light, things that drip */
        p.wall = RGB(168, 124, 84); p.wall_dark = RGB(74, 52, 38);
        p.trim = RGB(226, 168, 92);
        p.floor_near = RGB(112, 88, 64); p.floor_far = RGB(36, 26, 22);
        p.ceil = RGB(26, 18, 16);
        break;
    default:  /* the Over City: black stone and advertising */
        p.wall = RGB(96, 88, 150); p.wall_dark = RGB(38, 34, 66);
        p.trim = RGB(196, 130, 255);
        p.floor_near = RGB(78, 72, 112); p.floor_far = RGB(24, 20, 40);
        p.ceil = RGB(18, 14, 30);
        break;
    }
    return p;
}

static uint16_t depth_shade(uint16_t c, int depth) {
    static const int num[MAX_DEPTH + 1] = { 16, 14, 12, 10, 8, 7 };
    return gfx_scale_colour(c, num[depth > MAX_DEPTH ? MAX_DEPTH : depth], 16);
}

/* A stable per-tile hash, so the same wall always carries the same stain. */
static unsigned tile_hash(int x, int y, int salt) {
    unsigned h = (unsigned)(x * 73856093) ^ (unsigned)(y * 19349663) ^ (unsigned)(salt * 83492791);
    h ^= h >> 13;
    return h * 2654435761u;
}

static void brickwork(Surface *s, int x0, int x1, int yt, int yb, uint16_t line, int depth, int hash) {
    if (x1 - x0 < 3 || yb - yt < 4) return;
    int rows = 4 + (depth < 2 ? 2 : 0);
    for (int r = 1; r < rows; r++) {
        int y = yt + (yb - yt) * r / rows;
        gfx_hline(s, x0, x1, y, line);
    }
    for (int r = 0; r < rows; r++) {
        int y0 = yt + (yb - yt) * r / rows;
        int y1 = yt + (yb - yt) * (r + 1) / rows;
        int cols = 3;
        for (int c = 0; c < cols; c++) {
            int x = x0 + (x1 - x0) * (2 * c + 1 + (r & 1)) / (2 * cols);
            if (x > x0 && x < x1) gfx_vline(s, x, y0, y1, line);
        }
    }
    if ((hash & 7) == 0) {                      /* the occasional wet stain */
        int cx = x0 + (x1 - x0) / 2;
        gfx_dither(s, cx - (x1 - x0) / 6, yt, (x1 - x0) / 3, (yb - yt) / 2,
                   gfx_scale_colour(line, 6, 16), 8);
    }
}

static void draw_front_wall(Surface *s, const FloorPalette *p, int depth, int tx, int ty) {
    if (depth > MAX_DEPTH) depth = MAX_DEPTH;
    int hw = kHalfW[depth], hh = kHalfH[depth];
    int x0 = 128 - hw, x1 = 128 + hw;
    int yt = HORIZON - hh, yb = HORIZON + hh;
    if (x0 < 0) x0 = 0;
    if (x1 > SCREEN_W - 1) x1 = SCREEN_W - 1;
    uint16_t face = depth_shade(p->wall, depth);
    for (int y = yt; y <= yb; y++)
        gfx_hline(s, x0, x1, y, y < HORIZON ? gfx_mix(face, p->wall_dark, (HORIZON - y) * 8 / (hh + 1))
                                            : face);
    brickwork(s, x0, x1, yt, yb, depth_shade(p->wall_dark, depth), depth, (int)tile_hash(tx, ty, 1));
    gfx_frame(s, x0, yt, x1 - x0 + 1, yb - yt + 1, depth_shade(p->wall_dark, depth));
}

/*  A gap in the wall is a side corridor: dark, with its own lit floor strip, so
 *  a junction reads as somewhere to go rather than as missing geometry. */
static void draw_opening(Surface *s, const FloorPalette *p, int depth, int left) {
    int near_hw = kHalfW[depth], far_hw = kHalfW[depth + 1];
    int near_hh = kHalfH[depth], far_hh = kHalfH[depth + 1];
    int xn = left ? 128 - near_hw : 128 + near_hw;
    int xf = left ? 128 - far_hw : 128 + far_hw;
    if (xn < -20) xn = -20;
    if (xn > SCREEN_W + 20) xn = SCREEN_W + 20;
    uint16_t deep = gfx_scale_colour(p->wall_dark, 7, 16);
    gfx_trapezoid(s, xn, HORIZON - near_hh, HORIZON + near_hh,
                  xf, HORIZON - far_hh, HORIZON + far_hh, deep,
                  gfx_scale_colour(deep, 10, 16));
    int step = xf > xn ? 1 : -1;
    int span = xf - xn ? xf - xn : 1;
    for (int x = xn; x != xf; x += step) {           /* the side corridor's floor */
        int t = (x - xn) * 16 / span;
        int hh = near_hh + (far_hh - near_hh) * t / 16;
        gfx_vline(s, x, HORIZON + hh - 3, HORIZON + hh,
                  gfx_mix(p->floor_far, p->trim, 3 - t / 8));
    }
    gfx_vline(s, xf, HORIZON - far_hh, HORIZON + far_hh, gfx_scale_colour(p->trim, 5, 16));
}

static void draw_side_wall(Surface *s, const FloorPalette *p, int depth, int left, int tx, int ty) {
    int near_hw = kHalfW[depth], far_hw = kHalfW[depth + 1];
    int near_hh = kHalfH[depth], far_hh = kHalfH[depth + 1];
    int xn = left ? 128 - near_hw : 128 + near_hw;
    int xf = left ? 128 - far_hw  : 128 + far_hw;
    uint16_t near_c = depth_shade(p->wall, depth);
    uint16_t far_c = depth_shade(p->wall, depth + 1);
    if (left) { near_c = gfx_scale_colour(near_c, 13, 16); far_c = gfx_scale_colour(far_c, 13, 16); }

    gfx_trapezoid(s, xn, HORIZON - near_hh, HORIZON + near_hh,
                  xf, HORIZON - far_hh, HORIZON + far_hh, near_c, far_c);

    /* One horizontal course line, converging with the corridor. */
    unsigned h = tile_hash(tx, ty, left ? 2 : 3);
    int steps = left ? (xf - xn) : (xn - xf);
    if (steps < 0) steps = -steps;
    for (int band = 1; band < 4; band++) {
        int prev_x = xn, prev_y = 0;
        for (int i = 0; i <= steps; i += 2) {
            int x = left ? xn + i : xn - i;
            int t = steps ? i * 16 / steps : 0;
            int hh = near_hh + (far_hh - near_hh) * t / 16;
            int y = HORIZON - hh + (2 * hh) * band / 4;
            if (i) gfx_vline(s, x, prev_y, y, depth_shade(p->wall_dark, depth));
            prev_x = x; prev_y = y;
            (void)prev_x;
        }
    }
    if ((h & 15) == 0 && depth < 3) {          /* an emergency light, still on */
        int lx = left ? xn + 6 : xn - 8;
        gfx_rect(s, lx, HORIZON - near_hh / 2, 3, 6, p->trim);
        gfx_dither(s, lx - 3, HORIZON - near_hh / 2 - 3, 9, 12, p->trim, 6);
    }
}

/*  Floor and ceiling, with the grid drawn in perspective: horizontal courses at
 *  each depth boundary and rails converging on the vanishing point. Without
 *  these two sets of lines a grid crawler is just coloured rectangles. */
static void draw_ground(Surface *s, const FloorPalette *p) {
    gfx_vgradient(s, 0, 0, SCREEN_W, HORIZON, gfx_scale_colour(p->ceil, 26, 16), p->ceil);
    gfx_vgradient(s, 0, HORIZON, SCREEN_W, SCREEN_H - HORIZON, p->floor_far, p->floor_near);

    uint16_t floor_line = gfx_mix(p->floor_near, p->trim, 4);
    uint16_t ceil_line = gfx_mix(p->ceil, p->trim, 3);

    for (int d = 0; d <= MAX_DEPTH; d++) {           /* courses across the floor */
        int y = HORIZON + kHalfH[d];
        if (y < SCREEN_H) gfx_hline(s, 0, SCREEN_W - 1, y, gfx_scale_colour(floor_line, 16 - d * 2, 16));
        int cy = HORIZON - kHalfH[d];
        if (cy > 0) gfx_hline(s, 0, SCREEN_W - 1, cy, gfx_scale_colour(ceil_line, 14 - d * 2, 16));
    }
    for (int rail = -3; rail <= 3; rail++) {         /* rails into the distance */
        if (!rail) continue;
        int near_x = 128 + rail * kHalfW[0] / 1;
        int far_x = 128 + rail * kHalfW[MAX_DEPTH];
        int y0 = HORIZON + kHalfH[0], y1 = HORIZON + kHalfH[MAX_DEPTH];
        for (int y = y1; y <= y0 && y < SCREEN_H; y++) {
            int t = (y - y1) * 16 / (y0 - y1 + 1);
            int x = far_x + (near_x - far_x) * t / 16;
            gfx_pixel(s, x, y, gfx_scale_colour(floor_line, 6 + t / 2, 16));
        }
        int cy0 = HORIZON - kHalfH[0], cy1 = HORIZON - kHalfH[MAX_DEPTH];
        for (int y = cy0 > 0 ? cy0 : 0; y <= cy1; y++) {
            int t = (cy1 - y) * 16 / (cy1 - cy0 + 1);
            int x = far_x + (near_x - far_x) * t / 16;
            gfx_pixel(s, x, y, gfx_scale_colour(ceil_line, 5 + t / 2, 16));
        }
    }
    /* A pool of light where the party is standing, because they carry one. */
    for (int i = 0; i < 5; i++)
        gfx_dither(s, 0, SCREEN_H - 40 + i * 8, SCREEN_W, 8,
                   gfx_mix(p->floor_near, p->trim, 2), 10 - i * 2);
    gfx_dither(s, 0, HORIZON, SCREEN_W, 24, p->floor_far, 6);
}

static const Sprite *prop_for(char tile) {
    switch (tile) {
    case T_DOWN:  return &spr_stairs;
    case T_UP:    return &spr_stairs;
    case T_SHOP:  return &spr_shop;
    case T_SHRINE:return &spr_shrine;
    case T_KIOSK: return &spr_shrine;
    case T_BOX:   return &spr_box_bronze;
    case T_BOX_GOLD: return &spr_box_gold;
    case T_DOOR:  return &spr_door;
    default: return 0;
    }
}

void view3d_draw(Surface *s) {
    const Dungeon *d = &g.dun;
    FloorPalette p = palette_for(d->index);

    draw_ground(s, &p);

    int f = d->facing;
    int lf = (f + 3) & 3, rf = (f + 1) & 3;

    int blocked = MAX_DEPTH;
    for (int depth = 1; depth <= MAX_DEPTH; depth++) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        if (dungeon_tile(tx, ty) == T_WALL) { blocked = depth; break; }
    }

    /* Far to near: the front wall first, then the side walls closing in. */
    {
        int tx = d->px + dx4[f] * blocked, ty = d->py + dy4[f] * blocked;
        draw_front_wall(s, &p, blocked, tx, ty);
    }
    for (int depth = blocked - 1; depth >= 0; depth--) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        if (dungeon_tile(tx + dx4[lf], ty + dy4[lf]) == T_WALL)
            draw_side_wall(s, &p, depth, 1, tx, ty);
        else
            draw_opening(s, &p, depth, 1);
        if (dungeon_tile(tx + dx4[rf], ty + dy4[rf]) == T_WALL)
            draw_side_wall(s, &p, depth, 0, tx, ty);
        else
            draw_opening(s, &p, depth, 0);
    }

    /* Anything standing in the corridor, nearest last. */
    for (int depth = blocked; depth >= 0; depth--) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        char tile = dungeon_tile(tx, ty);
        if (depth == 0 && tile != T_DOWN && tile != T_UP) continue;
        const Sprite *sp = prop_for(tile);
        if (!sp) continue;
        if ((tile == T_BOX || tile == T_BOX_GOLD) && dungeon_is_used(tx, ty)) continue;
        int scale = 200 - depth * 34;
        if (scale < 40) scale = 40;
        int w = sp->w * scale / 100, h = sp->h * scale / 100;
        int base = HORIZON + kHalfH[depth < MAX_DEPTH ? depth : MAX_DEPTH] - 2;
        gfx_sprite_scaled(s, sp, 128 - w / 2, base - h, scale, 100);
        if (depth > 1)
            gfx_dither(s, 128 - w / 2, base - h, w, h, p.floor_far, depth * 3);
    }

    /* Vignette: the corridor should feel like it is closing. */
    for (int i = 0; i < 12; i++) {
        int a = (12 - i) / 2;
        gfx_vline(s, i, 0, SCREEN_H - 1, gfx_mix(s->px[i], C_VOID, a));
        gfx_vline(s, SCREEN_W - 1 - i, 0, SCREEN_H - 1, gfx_mix(s->px[SCREEN_W - 1 - i], C_VOID, a));
    }
}
