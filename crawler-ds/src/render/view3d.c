/*  The corridor.
 *
 *  A grid crawler, drawn the way the DS ones were: a real perspective
 *  projection with every surface texture-mapped, rather than a stack of
 *  flat-filled rectangles with lines scratched over them.
 *
 *  The projection is a pinhole with the camera at the centre of its own cell,
 *  so a surface `z` cells away has screen half-width PROJ/z. Everything else
 *  falls out of that: the floor and ceiling are horizontal planes solved per
 *  scanline, the side walls are vertical planes solved per column, and the
 *  wall you are facing is parallel to the screen so it needs no correction at
 *  all. One divide per scanline and per column; the inner loops are adds and
 *  a table lookup.
 *
 *  Distance is fog, not darkness: each floor mixes toward its own haze colour
 *  through a precomputed palette per shade level, so a texel costs one lookup
 *  no matter how far away it is.
 */
#include "gfx.h"
#include "theme.h"
#include "game.h"
#include "art.h"

#define HORIZON 92
#define MAX_DEPTH 5

/*  Screen half-width of a surface exactly one cell from the camera. Wider than
 *  a true 35mm-ish lens on purpose: a one-cell-wide corridor on a 256px screen
 *  needs the far end to stay big enough to read. */
#define PROJ    135
#define VNUM    8        /* half-height = half-width * VNUM/VDEN */
#define VDEN    10
#define TEXELS  32       /* texture repeats once per cell, in both directions */
#define FP      8        /* fixed point shift for cell distances */

#define SHADES  8

static const int dx4[4] = { 0, 1, 0, -1 };
static const int dy4[4] = { -1, 0, 1, 0 };

/*  A texture plus the palette it is drawn through at each distance. */
typedef struct {
    const uint8_t *pix;
    uint16_t lut[SHADES][16];
} Shaded;

static void shade_build(Shaded *out, const Sprite *sp, uint16_t fog) {
    out->pix = sp->pix;
    for (int level = 0; level < SHADES; level++) {
        /* 0 is the near end and stays true; the far end is almost all haze. */
        int t = level * 15 / (SHADES - 1);
        for (int i = 0; i < 16; i++)
            out->lut[level][i] = gfx_mix(i < sp->npal ? sp->pal[i] : fog, fog, t);
    }
}

/*  Distance in cells (fixed point) to a shade level. */
static int shade_of(int zfp) {
    /*  Steep on purpose. The party is carrying the only light down here, so the
     *  cell in front of them should be lit and four cells out should be gone. */
    int level = (zfp - (1 << (FP - 1))) * SHADES / (4 << FP);
    if (level < 0) level = 0;
    if (level >= SHADES) level = SHADES - 1;
    return level;
}

typedef struct { Shaded wall, floor, ceil; uint16_t fog, trim; } Theme;

static void theme_for(Theme *th, int floor_index) {
    const Sprite *w, *f, *c;
    switch (floor_index % 3) {
    case 0:
        w = &spr_tex_wall_a; f = &spr_tex_floor_a; c = &spr_tex_ceil_a;
        th->fog = RGB(18, 20, 30); th->trim = RGB(210, 214, 226);
        break;
    case 1:
        w = &spr_tex_wall_b; f = &spr_tex_floor_b; c = &spr_tex_ceil_b;
        th->fog = RGB(22, 14, 12); th->trim = RGB(226, 168, 92);
        break;
    default:
        w = &spr_tex_wall_c; f = &spr_tex_floor_c; c = &spr_tex_ceil_c;
        th->fog = RGB(12, 10, 24); th->trim = RGB(196, 130, 255);
        break;
    }
    shade_build(&th->wall, w, th->fog);
    shade_build(&th->floor, f, th->fog);
    shade_build(&th->ceil, c, th->fog);
}

/* ------------------------------------------------------------ the planes ---- */

/*  Floor and ceiling. Both are horizontal planes, so a whole scanline sits at
 *  one distance: solve z once, then step the texture coordinate by a constant
 *  across the row. Texture space is locked to the dungeon grid, so walking a
 *  cell forward slides the floor by exactly one tile instead of swimming. */
static void draw_planes(Surface *s, const Theme *th) {
    const Dungeon *d = &g.dun;
    int f = d->facing, rf = (f + 1) & 3;
    int fx = dx4[f], fy = dy4[f], rx = dx4[rf], ry = dy4[rf];

    for (int y = 0; y < SCREEN_H; y++) {
        int dy = y > HORIZON ? y - HORIZON : HORIZON - y;
        if (dy < 1) dy = 1;
        int below = y > HORIZON;
        const Shaded *sh = below ? &th->floor : &th->ceil;

        /* half-height dy  ->  half-width  ->  distance, all in one go */
        int zfp = PROJ * VNUM * (1 << FP) / (dy * VDEN);
        if (zfp > (12 << FP)) zfp = 12 << FP;      /* stop at the fog wall */
        int level = shade_of(zfp);

        /*  Past the last shade level the texture contributes a sixteenth of
         *  itself and nothing more; the band either side of the horizon is a
         *  third of the screen, so filling it flat is most of the cost of the
         *  whole plane pass for a difference nobody can see. */
        if (level == SHADES - 1) {
            gfx_hline(s, 0, SCREEN_W - 1, y, th->fog);
            continue;
        }
        const uint16_t *lut = sh->lut[level];

        /*  Stepping one screen pixel sideways moves TEXELS*z/PROJ texels, so
         *  the whole row is one multiply-accumulate per pixel. Everything is
         *  kept in texels, .FP fixed point, anchored to the dungeon grid. */
        int step = TEXELS * zfp / PROJ;            /* texels per pixel, .FP */
        int wx = ((d->px * TEXELS) << FP) + fx * (zfp * TEXELS) - rx * (SCREEN_W / 2) * step;
        int wy = ((d->py * TEXELS) << FP) + fy * (zfp * TEXELS) - ry * (SCREEN_W / 2) * step;
        int sx = rx * step, sy = ry * step;

        uint16_t *dst = s->px + y * SCREEN_W;
        for (int x = 0; x < SCREEN_W; x++) {
            int u = wx >> FP, v = wy >> FP;
            dst[x] = lut[sh->pix[(v & (TEXELS - 1)) * TEXELS + (u & (TEXELS - 1))]];
            wx += sx; wy += sy;
        }
    }
}

/*  The wall you are facing. It is parallel to the screen, so the mapping is a
 *  plain stretch: one cell of wall across, one cell of wall down. */
static void draw_front(Surface *s, const Theme *th, int depth) {
    int zfp = (depth << FP) + (1 << (FP - 1));
    int hw = PROJ * (1 << FP) / zfp;
    int hh = hw * VNUM / VDEN;
    int x0 = 128 - hw, x1 = 128 + hw;
    int yt = HORIZON - hh, yb = HORIZON + hh;
    const uint16_t *lut = th->wall.lut[shade_of(zfp)];
    const uint16_t *edge = th->wall.lut[shade_of(zfp + (1 << FP))];

    int du = TEXELS * 65536 / (x1 - x0 + 1), dv = TEXELS * 65536 / (yb - yt + 1);
    /* Standing right up against a wall puts most of it off-screen; clip the
       loop rather than testing hundreds of columns that go nowhere. */
    int cx0 = x0 < 0 ? 0 : x0, cx1 = x1 >= SCREEN_W ? SCREEN_W - 1 : x1;
    int cy0 = yt < 0 ? 0 : yt, cy1 = yb >= SCREEN_H ? SCREEN_H - 1 : yb;
    for (int y = cy0; y <= cy1; y++) {
        int v = (y - yt) * dv;
        const uint8_t *row = th->wall.pix + ((v >> 16) & (TEXELS - 1)) * TEXELS;
        uint16_t *dst = s->px + y * SCREEN_W;
        int u = (cx0 - x0) * du;
        for (int x = cx0; x <= cx1; x++, u += du)
            dst[x] = lut[row[(u >> 16) & (TEXELS - 1)]];
    }
    /* A darker line where the wall meets the side walls, so the corner reads. */
    if (x0 >= 0) gfx_vline(s, x0, yt > 0 ? yt : 0, yb < SCREEN_H ? yb : SCREEN_H - 1, edge[0]);
    if (x1 < SCREEN_W) gfx_vline(s, x1, yt > 0 ? yt : 0, yb < SCREEN_H ? yb : SCREEN_H - 1, edge[0]);
}

/*  A side wall spans one cell of depth, from `depth` to `depth + 1`. It is a
 *  vertical plane running away from the camera, so each screen column sits at
 *  its own distance -- which is exactly what the half-width tells us, since
 *  the wall is half a cell to the side and half-width is PROJ/z. */
static void draw_side(Surface *s, const Theme *th, int depth, int left, int dim) {
    int znear = (depth << FP) + (1 << (FP - 1));
    int zfar = znear + (1 << FP);
    int hw_near = PROJ * (1 << FP) / znear;
    int hw_far = PROJ * (1 << FP) / zfar;

    for (int hw = hw_near; hw > hw_far; hw--) {
        int x = left ? 128 - hw : 128 + hw;
        if (x < 0 || x >= SCREEN_W || hw <= 0) continue;
        int zfp = PROJ * (1 << FP) / hw;
        int u = (zfp - znear) * TEXELS / (1 << FP);
        int hh = hw * VNUM / VDEN;
        int yt = HORIZON - hh, yb = HORIZON + hh;

        int level = shade_of(zfp) + dim;
        /* The left wall faces away from the light the party carries. */
        if (left) level++;
        if (level >= SHADES) level = SHADES - 1;
        const uint16_t *lut = th->wall.lut[level];

        int dv = TEXELS * 65536 / (yb - yt + 1), v = 0;
        for (int y = yt; y <= yb; y++, v += dv) {
            if (y < 0 || y >= SCREEN_H) continue;
            s->px[y * SCREEN_W + x] =
                lut[th->wall.pix[((v >> 16) & (TEXELS - 1)) * TEXELS + (u & (TEXELS - 1))]];
        }
    }
}

/*  A gap in the wall is a side corridor. Drawing it as a void reads as missing
 *  geometry, so it gets the same wall texture pushed back into the haze -- the
 *  passage's far side, unlit -- with the floor of the passage catching enough
 *  light at the threshold to say there is somewhere to walk. */
static void draw_opening(Surface *s, const Theme *th, int depth, int left) {
    draw_side(s, th, depth, left, 3);

    int znear = (depth << FP) + (1 << (FP - 1));
    int zfar = znear + (1 << FP);
    int hw_near = PROJ * (1 << FP) / znear;
    int hw_far = PROJ * (1 << FP) / zfar;

    for (int hw = hw_near; hw > hw_far; hw--) {
        int x = left ? 128 - hw : 128 + hw;
        if (x < 0 || x >= SCREEN_W) continue;
        int hh = hw * VNUM / VDEN;
        int zfp = PROJ * (1 << FP) / hw;
        int level = shade_of(zfp);
        uint16_t glow = gfx_mix(th->trim, th->fog, 9 + level);
        for (int i = 0; i < 3; i++) {
            int y = HORIZON + hh - i;
            if (y >= 0 && y < SCREEN_H)
                s->px[y * SCREEN_W + x] = gfx_mix(s->px[y * SCREEN_W + x], glow, 8 + i * 2);
        }
        int cy = HORIZON - hh;
        if (cy >= 0 && cy < SCREEN_H)
            s->px[cy * SCREEN_W + x] = gfx_mix(s->px[cy * SCREEN_W + x], th->fog, 6);
    }
}

/* ----------------------------------------------------------------- arena ---- */

/*  The battle arena. Same corridor, same textures, but the camera has swung
 *  out and up: the party stand in the near corner and the foes on the far
 *  side, each on a lit platform, which is the arrangement every turn-based
 *  fight has used since 1996 and the one the sprites are drawn for.
 *
 *  The floor is the same perspective plane as the corridor and stays locked to
 *  the same dungeon tile, so the ground under a fight is the ground the party
 *  were standing on a moment earlier.
 */
#define ARENA_HZ 68

static int isqrt16(int v) {
    int r = 0, b = 1 << 14;
    while (b > v) b >>= 2;
    while (b) {
        if (v >= r + b) { v -= r + b; r = (r >> 1) + b; }
        else r >>= 1;
        b >>= 2;
    }
    return r;
}

/*  A lit disc of ground for one side of the fight to stand on, with enough
 *  thickness under it to read as raised rather than painted on. */
static void platform(Surface *s, const Theme *th, int cx, int cy, int rx, int ry) {
    const uint8_t *pix = th->floor.pix;
    const uint16_t *lit = th->floor.lut[0];
    const uint16_t *mid = th->floor.lut[1];
    const uint16_t *dark = th->floor.lut[4];

    for (int y = cy - ry; y <= cy + ry; y++) {
        if (y < 0 || y >= SCREEN_H) continue;
        int dy = y - cy;
        int hw = rx * isqrt16((ry * ry - dy * dy) * 4096 / (ry * ry)) / 64;
        if (hw <= 0) continue;
        const uint16_t *lut = dy < -ry + 3 ? mid : lit;   /* far edge in shade */
        uint16_t *dst = s->px + y * SCREEN_W;
        for (int x = cx - hw; x <= cx + hw; x++) {
            if (x < 0 || x >= SCREEN_W) continue;
            dst[x] = lut[pix[(y & (TEXELS - 1)) * TEXELS + (x & (TEXELS - 1))]];
        }
        /*  The rim: a bright lip on the outside and a dark one just inside it,
         *  which is the whole reason a flat disc reads as an edge. */
        for (int k = 0; k < 2; k++) {
            int xl = cx - hw + k, xr = cx + hw - k;
            const uint16_t *r = k ? dark : lit;
            if (xl >= 0 && xl < SCREEN_W) dst[xl] = r[k ? 0 : 4];
            if (xr >= 0 && xr < SCREEN_W) dst[xr] = r[k ? 0 : 4];
        }
    }
    /* Thickness: a band of shadow hanging off the front edge. */
    for (int i = 1; i <= 4; i++) {
        int y = cy + ry + i;
        if (y < 0 || y >= SCREEN_H) continue;
        int hw = rx - i * rx / 6;
        gfx_dither(s, cx - hw, y, hw * 2, 1, th->fog, 14 - i * 2);
    }
}

void view3d_arena(Surface *s, int floor_index) {
    const Dungeon *d = &g.dun;
    Theme th;
    theme_for(&th, floor_index);

    /*  The far wall. It is flat-on and a fixed distance away, so it is a plain
     *  stretch: four cells of wall across the screen, one cell tall, with the
     *  top of the room falling away into the haze. */
    {
        int du = TEXELS * 4 * 65536 / SCREEN_W;
        int dv = TEXELS * 65536 / ARENA_HZ;
        for (int y = 0; y < ARENA_HZ; y++) {
            const uint8_t *row = th.wall.pix + (((y * dv) >> 16) & (TEXELS - 1)) * TEXELS;
            /* Level 3 at the skirting, deeper toward the ceiling. */
            const uint16_t *lut = th.wall.lut[3 + (ARENA_HZ - y) * 4 / ARENA_HZ];
            uint16_t *dst = s->px + y * SCREEN_W;
            int u = 0;
            for (int x = 0; x < SCREEN_W; x++, u += du)
                dst[x] = lut[row[(u >> 16) & (TEXELS - 1)]];
        }
    }

    /* The floor, on the same projection and the same tile as the corridor. */
    {
        int f = d->facing, rf = (f + 1) & 3;
        int fx = dx4[f], fy = dy4[f], rx = dx4[rf], ry = dy4[rf];
        for (int y = ARENA_HZ; y < SCREEN_H; y++) {
            int dy = y - ARENA_HZ;
            if (dy < 1) dy = 1;
            int zfp = PROJ * VNUM * (1 << FP) / (dy * VDEN);
            if (zfp > (12 << FP)) zfp = 12 << FP;
            /*  A step darker than the corridor floor: the platforms are the
             *  lit ground here, and they only read as raised if the rest of
             *  the room sits below them. */
            int level = shade_of(zfp) + 1;
            const uint16_t *lut = th.floor.lut[level < SHADES ? level : SHADES - 1];
            int step = TEXELS * zfp / PROJ;
            int wx = ((d->px * TEXELS) << FP) + fx * (zfp * TEXELS) - rx * (SCREEN_W / 2) * step;
            int wy = ((d->py * TEXELS) << FP) + fy * (zfp * TEXELS) - ry * (SCREEN_W / 2) * step;
            int sx = rx * step, sy = ry * step;
            uint16_t *dst = s->px + y * SCREEN_W;
            for (int x = 0; x < SCREEN_W; x++) {
                int u = wx >> FP, v = wy >> FP;
                dst[x] = lut[th.floor.pix[(v & (TEXELS - 1)) * TEXELS + (u & (TEXELS - 1))]];
                wx += sx; wy += sy;
            }
        }
    }

    /* Where the wall meets the floor, and the haze that gathers in the corner. */
    gfx_hline(s, 0, SCREEN_W - 1, ARENA_HZ, th.wall.lut[6][0]);
    for (int i = 0; i < 8; i++)
        gfx_dither(s, 0, ARENA_HZ + 1 + i, SCREEN_W, 1, th.fog, 12 - i);

    /*  Placed to meet the sprites' feet: foes stand high on the far side, the
     *  party low in the near corner, each disc wide enough for a full row. */
    platform(s, &th, 176, 90, 82, 11);
    platform(s, &th, 44, 148, 70, 12);
}

/* ------------------------------------------------------------------ props ---- */

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
    Theme th;
    theme_for(&th, d->index);

    draw_planes(s, &th);

    int f = d->facing;
    int lf = (f + 3) & 3, rf = (f + 1) & 3;

    int blocked = MAX_DEPTH;
    for (int depth = 1; depth <= MAX_DEPTH; depth++) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        if (dungeon_tile(tx, ty) == T_WALL) { blocked = depth; break; }
    }

    draw_front(s, &th, blocked);

    /* Far to near, so nearer walls overwrite the ones behind them. */
    for (int depth = blocked - 1; depth >= 0; depth--) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        if (dungeon_tile(tx + dx4[lf], ty + dy4[lf]) == T_WALL)
            draw_side(s, &th, depth, 1, 0);
        else
            draw_opening(s, &th, depth, 1);
        if (dungeon_tile(tx + dx4[rf], ty + dy4[rf]) == T_WALL)
            draw_side(s, &th, depth, 0, 0);
        else
            draw_opening(s, &th, depth, 0);
    }

    /* Anything standing in the corridor, nearest last. */
    for (int depth = blocked; depth >= 0; depth--) {
        int tx = d->px + dx4[f] * depth, ty = d->py + dy4[f] * depth;
        char tile = dungeon_tile(tx, ty);
        if (depth == 0 && tile != T_DOWN && tile != T_UP) continue;
        const Sprite *sp = prop_for(tile);
        if (!sp) continue;
        if ((tile == T_BOX || tile == T_BOX_GOLD) && dungeon_is_used(tx, ty)) continue;
        int zfp = (depth << FP) + (1 << (FP - 1));
        int hw = PROJ * (1 << FP) / zfp;
        int hh = hw * VNUM / VDEN;
        int scale = hw * 100 / 96;                 /* a prop is about a cell tall */
        if (scale < 24) scale = 24;
        if (scale > 190) scale = 190;
        int w = sp->w * scale / 100, h = sp->h * scale / 100;
        int base = HORIZON + hh - 2;
        gfx_sprite_scaled(s, sp, 128 - w / 2, base - h, scale, 100);
        int level = shade_of(zfp);
        if (level) gfx_dither(s, 128 - w / 2, base - h, w, h, th.fog, level * 2);
    }

    /* Vignette: the corridor should feel like it is closing. */
    for (int i = 0; i < 12; i++) {
        int a = (12 - i) / 2;
        gfx_vline(s, i, 0, SCREEN_H - 1, gfx_mix(s->px[i], th.fog, a));
        gfx_vline(s, SCREEN_W - 1 - i, 0, SCREEN_H - 1, gfx_mix(s->px[SCREEN_W - 1 - i], th.fog, a));
    }
}
