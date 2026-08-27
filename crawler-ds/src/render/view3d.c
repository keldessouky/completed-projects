/*  The ground a fight happens on.
 *
 *  What is left of the perspective renderer that used to draw the whole
 *  dungeon. The overworld is a tile map now, but a battle still wants a floor
 *  running away from the camera and a wall behind it, so the projection stays:
 *  a pinhole with the camera in its own cell, a surface `z` cells away having
 *  screen half-width PROJ/z, horizontal planes solved once per scanline.
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
    uint16_t lut[SHADES][32];   /* textures carry a tonal grain now, not 4bpp */
} Shaded;

static void shade_build(Shaded *out, const Sprite *sp, uint16_t fog) {
    out->pix = sp->pix;
    for (int level = 0; level < SHADES; level++) {
        /* 0 is the near end and stays true; the far end is almost all haze. */
        int t = level * 15 / (SHADES - 1);
        for (int i = 0; i < 32; i++)
            out->lut[level][i] = gfx_mix(i < sp->npal ? sp->pal[i] : fog, fog, t);
    }
}

/*  Distance in cells (fixed point) to a shade level. */
static int shade_of(int zfp) {
    int level = (zfp - (1 << (FP - 1))) * SHADES / (4 << FP);
    if (level < 0) level = 0;
    if (level >= SHADES) level = SHADES - 1;
    return level;
}

typedef struct { Shaded wall, floor, ceil; uint16_t fog, trim; } Theme;

static void theme_for(Theme *th, int floor_index) {
    const Sprite *w, *f, *c;
    /*  Five looks over eighteen floors rather than three. Not a cycle: the
        order puts the two the book actually describes -- poured concrete on
        one, tenement brick on two -- where they belong, and lets the rest
        arrive as the run goes down. */
    static const uint8_t kOrder[18] = { 0, 3, 1, 3, 2, 0, 1, 4, 2, 3, 0, 4, 1, 2, 4, 0, 3, 2 };
    int slot = floor_index >= 0 && floor_index < 18 ? kOrder[floor_index] : floor_index % 5;
    switch (slot) {
    case 0:
        w = &spr_tex_wall_a; f = &spr_tex_floor_a; c = &spr_tex_ceil_a;
        th->fog = RGB(38, 55, 66) /* ink blue */; th->trim = RGB(217, 226, 231) /* lightning 3 */;
        break;
    case 1:
        w = &spr_tex_wall_b; f = &spr_tex_floor_b; c = &spr_tex_ceil_b;
        th->fog = RGB(53, 37, 31) /* wood_dark 0 */; th->trim = RGB(229, 200, 106) /* gold 4 */;
        break;
    case 2:
        w = &spr_tex_wall_c; f = &spr_tex_floor_c; c = &spr_tex_ceil_c;
        th->fog = RGB(51, 37, 74) /* arcane 0 */; th->trim = RGB(192, 155, 215) /* arcane 4 */;
        break;
    case 3:
        w = &spr_tex_wall_d; f = &spr_tex_floor_d; c = &spr_tex_ceil_d;
        th->fog = RGB(53, 37, 31) /* wood_dark 0 */; th->trim = RGB(232, 203, 112) /* hair_blonde 3 */;
        break;
    default:
        w = &spr_tex_wall_e; f = &spr_tex_floor_e; c = &spr_tex_ceil_e;
        th->fog = RGB(38, 56, 45) /* cloth_green 0 */; th->trim = RGB(224, 198, 106) /* ui amber */;
        break;
    }
    shade_build(&th->wall, w, th->fog);
    shade_build(&th->floor, f, th->fog);
    shade_build(&th->ceil, c, th->fog);
}

/* ----------------------------------------------------------------- arena ---- */

/*  The battle arena. The floor the party is standing on, but the camera has swung
 *  out and up: the party stand in the near corner and the foes on the far
 *  side, each on a lit platform, which is the arrangement every turn-based
 *  fight has used since 1996 and the one the sprites are drawn for.
 *
 *  This is the last of the perspective renderer. The overworld is drawn from
 *  above by view2d.c now, but a fight still wants a floor running away from
 *  the camera, and it stays locked to the dungeon tile the party were standing
 *  on -- so the ground under a fight is the ground they were walking.
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
