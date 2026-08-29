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

/*  Thirty-two, not sixteen. At sixteen the screen held a sixteen-by-twelve
 *  grid, which sounds generous and looked like a map: the crawlers were a
 *  sixteen-pixel sprite on a two-hundred-and-fifty-six-pixel screen -- a
 *  tenth of its height -- and most of what surrounded them was unexplored
 *  black, because a viewport that wide reaches past whatever a lamp has lit.
 *  Doubling the tile halves the reach in both directions, which fills the
 *  screen with room instead of void, and lets the party be drawn at twice the
 *  size so there is a person down there rather than a token.
 *
 *  It also lands the textures on their natural scale. They are authored
 *  thirty-two square; a sixteen-pixel tile read half of one, so every wall was
 *  the top sixteen rows of its texture and the bottom sixteen were never seen. */
#define TILE     32
#define TEXELS   32
#define WALL_LIP 8       /* how much of a wall's south face the camera sees */

/*  Light levels the tiles are drawn through. The DS keeps colour in a 16-bit
 *  halfword of which fifteen bits are colour, and this game draws into a direct
 *  framebuffer -- so there is no palette to run out of and a lit scene costs
 *  only the arithmetic. Sixteen levels is enough that a falloff reads as a
 *  falloff rather than as bands. */
#define LIGHT_LEVELS 16
#define LIGHT_MAX    (LIGHT_LEVELS - 1)

typedef struct {
    const uint8_t *wall, *floor;
    const uint16_t *wall_pal, *floor_pal;
    int wall_n, floor_n;
    uint16_t fog, trim, edge_lit, edge_dark;
    /*  Every palette entry, pre-mixed toward the haze at each light level, so a
     *  lit pixel costs one lookup rather than a blend. */
    uint16_t wall_lut[LIGHT_LEVELS][64];
    uint16_t floor_lut[LIGHT_LEVELS][64];
} Tiles;

static void build_lut(uint16_t lut[LIGHT_LEVELS][64], const uint16_t *pal, int n,
                      uint16_t fog) {
    if (n > 64) n = 64;
    for (int l = 0; l < LIGHT_LEVELS; l++) {
        /*  Not linear: the eye reads the first steps out of pitch dark as a
         *  much bigger change than the last steps into full light, so the curve
         *  spends its resolution near the bottom. */
        int t = (LIGHT_MAX - l) * (LIGHT_MAX - l) * 16 / (LIGHT_MAX * LIGHT_MAX);
        for (int i = 0; i < n; i++) lut[l][i] = gfx_mix(pal[i], fog, t);
    }
}

static void tiles_for(Tiles *t, int floor_index) {
    static const uint8_t kOrder[18] = { 0, 3, 1, 3, 2, 0, 1, 4, 2, 3, 0, 4, 1, 2, 4, 0, 3, 2 };
    int slot = floor_index >= 0 && floor_index < 18 ? kOrder[floor_index] : floor_index % 5;
    const Sprite *w, *f;
    switch (slot) {
    case 0: w = &spr_tex_wall_a; f = &spr_tex_floor_a;
            t->fog = RGB(38, 55, 66) /* ink blue */; t->trim = RGB(217, 226, 231) /* lightning 3 */; break;
    case 1: w = &spr_tex_wall_b; f = &spr_tex_floor_b;
            t->fog = RGB(53, 37, 31) /* wood_dark 0 */; t->trim = RGB(229, 200, 106) /* gold 4 */; break;
    case 2: w = &spr_tex_wall_c; f = &spr_tex_floor_c;
            t->fog = RGB(51, 37, 74) /* arcane 0 */; t->trim = RGB(192, 155, 215) /* arcane 4 */; break;
    case 3: w = &spr_tex_wall_d; f = &spr_tex_floor_d;
            t->fog = RGB(53, 37, 31) /* wood_dark 0 */; t->trim = RGB(232, 203, 112) /* hair_blonde 3 */; break;
    default: w = &spr_tex_wall_e; f = &spr_tex_floor_e;
            t->fog = RGB(38, 56, 45) /* cloth_green 0 */; t->trim = RGB(224, 198, 106) /* ui amber */; break;
    }
    t->wall = w->pix;  t->wall_pal = w->pal;  t->wall_n = w->npal;
    t->floor = f->pix; t->floor_pal = f->pal; t->floor_n = f->npal;
    build_lut(t->wall_lut, w->pal, w->npal, t->fog);
    build_lut(t->floor_lut, f->pal, f->npal, t->fog);
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

/* ---------------------------------------------------------------- light ---- */

/*  How bright a tile corner is, and what colour is doing it.
 *
 *  The party carry the only reliable light down here, and a few things on the
 *  floor make their own -- a safe room's windows, the kiosk's screen, the glow
 *  off a boss chamber. Before this the map was lit by a flag: a tile was either
 *  explored and fully bright or unexplored and black, which is a fog of war
 *  rather than a light, and it made every floor read flat.
 */
/*  What each tile gives off: radius in tiles, strength, and colour. */
static int emitter(char tile, int *radius, uint16_t *tint) {
    switch (tile) {
    case T_SHRINE: *radius = 5; *tint = RGB(255, 247, 194) /* lightning 4 */; return 13;  /* safe room  */
    case T_SHOP:   *radius = 4; *tint = RGB(248, 223, 121) /* fire 6 */; return 11;  /* the stall  */
    case T_KIOSK:  *radius = 4; *tint = RGB(121, 194, 199) /* water 4 */; return 12;  /* its screen */
    case T_DOWN:   *radius = 4; *tint = RGB(179, 215, 101) /* poison 4 */; return 11;  /* the way on */
    case T_BOSS:
    case T_NBOSS:  *radius = 4; *tint = RGB(241, 140, 53) /* fire 4 */;  return 12;  /* the chamber */
    case T_BOX:
    case T_BOX_GOLD: *radius = 2; *tint = RGB(248, 223, 121) /* fire 6 */; return 7;
    default: return 0;
    }
}

/*  The lamps on screen this frame.
 *
 *  Gathered once and then read by every corner. The first version of this
 *  searched an eleven-by-eleven neighbourhood from each of the two hundred and
 *  twenty-one corners -- twenty-seven thousand tile lookups a frame, which took
 *  the game from forty-six frames a second to eighteen. Almost all of it was
 *  finding the same four lamps over and over.
 */
#define MAX_LAMPS 16

/*  `fall` is the lamp's falloff already worked out for every square distance it
 *  reaches, because the ARM9 has no divide instruction: a quadratic falloff
 *  evaluated per corner per lamp is three and a half thousand calls into
 *  __aeabi_idiv a frame, and measuring found that -- not the per-pixel blend I
 *  assumed -- was where two thirds of the frame had gone. A lamp reaches five
 *  tiles at most, so the whole table is twenty-six bytes. */
typedef struct {
    int16_t x, y;
    uint8_t radius, strength, r2;
    uint8_t glow;               /* how far the colour carries, in pixels */
    uint16_t tint;
    uint8_t fall[26];
} Lamp;

static Lamp s_lamp[MAX_LAMPS];
static int s_lamps;

static void gather_lamps(int tx0, int ty0, int cols, int rows) {
    s_lamps = 0;
    /*  A margin, so a lamp just off screen still lights the edge it is
     *  spilling onto rather than snapping on when it scrolls into view. */
    for (int j = -5; j <= rows + 5 && s_lamps < MAX_LAMPS; j++)
        for (int i = -5; i <= cols + 5 && s_lamps < MAX_LAMPS; i++) {
            int ex = tx0 + i, ey = ty0 + j;
            if (!dungeon_seen(ex, ey)) continue;
            char tile = dungeon_tile(ex, ey);
            if ((tile == T_BOX || tile == T_BOX_GOLD) && dungeon_is_used(ex, ey)) continue;
            int radius = 0;
            uint16_t tint = 0;
            int strength = emitter(tile, &radius, &tint);
            if (!strength) continue;
            Lamp *l = &s_lamp[s_lamps++];
            l->x = (int16_t)ex; l->y = (int16_t)ey;
            l->radius = (uint8_t)radius; l->strength = (uint8_t)strength;
            l->tint = tint;
            l->r2 = (uint8_t)(radius * radius);
            /*  Colour carries a quarter as far as brightness. A shrine throws
             *  light five tiles but is only *coloured* for one and a bit of
             *  them, which is both what a warm lamp in a cold room looks like
             *  and what makes the pass affordable: the tint costs area, and
             *  area is the square of this number.
             *
             *  It was TILE/2 when a tile was sixteen pixels. Doubling the tile
             *  kept the radius the same in tiles and so quadrupled it in
             *  pixels, and measuring the ROM over a fixed six hundred emulator
             *  frames -- tools/ndsbot/perf.txt, which exists because the
             *  playthrough script's `until` loops make its frame counter
             *  incomparable between runs -- put the dungeon at 298 game frames
             *  against the old build's 379. Building with -DABL_NOGLOW gave
             *  396, so this pass was the whole of the difference and none of
             *  it was the bigger tiles. Back at TILE/4 the pixel radius is
             *  what it always was and the measurement is 379 again, exactly
             *  the old number, for a view at twice the size. */
            l->glow = (uint8_t)(radius * TILE / 4);
            for (int e2 = 0; e2 < l->r2; e2++)
                l->fall[e2] = (uint8_t)((l->r2 - e2) * strength / l->r2);
        }
}

/*  Light at one tile corner: the party's lamp, plus whichever gathered lamps
 *  reach it. Falloff is quadratic, which is both what light does and cheap to
 *  do in integers. */
#define LAMP_R 6

/*  The party's own lamp, the one light that is always on. Constant, so it is
 *  worked out once for the whole run rather than per corner per frame. */
static const uint8_t kPartyFall[LAMP_R * LAMP_R] = {
    15, 14, 14, 13, 13, 12, 12, 12, 11, 11, 10, 10,
    10,  9,  9,  8,  8,  7,  7,  7,  6,  6,  5,  5,
     5,  4,  4,  3,  3,  2,  2,  2,  1,  1,  0,  0,
};

static uint8_t light_at(int tx, int ty) {
    int dx = tx - g.dun.px, dy = ty - g.dun.py;
    int d2 = dx * dx + dy * dy;
    int best = d2 < LAMP_R * LAMP_R ? kPartyFall[d2] : 0;

    for (int n = 0; n < s_lamps; n++) {
        const Lamp *l = &s_lamp[n];
        /*  Reject on the bounding box before spending two multiplies: most
         *  corners are out of reach of most lamps. */
        int ex = tx - l->x;
        if (ex < -5 || ex > 5) continue;
        int ey = ty - l->y;
        if (ey < -5 || ey > 5) continue;
        int e2 = ex * ex + ey * ey;
        if (e2 >= l->r2) continue;
        int fall = l->fall[e2];
        if (fall > best) best = fall;
    }

    /*  Ground the party has walked but is not standing in keeps a little
     *  light: a roguelike remembers its floor, and a map that goes pitch black
     *  the moment you step away is one you cannot read your way back across. */
    if (dungeon_seen(tx, ty) && best < 4) best = 4;
    return (uint8_t)(best > LIGHT_MAX ? LIGHT_MAX : best);
}

/*  The colour a lamp throws on what it is lighting, laid over the tiles after
 *  they are drawn. Kept out of the per-pixel tile loop on purpose: a blend on
 *  every one of the screen's pixels costs far more than a blend on the few
 *  hundred that are close enough to a coloured source to show it. */
/*  Newton would be shorter; this is the bit-by-bit method, which needs no
 *  division and no seed, and is called once per row rather than per pixel. */
static int isqrt_(int v) {
    int r = 0, b = 1 << 14;
    while (b > v) b >>= 2;
    while (b) {
        if (v >= r + b) { v -= r + b; r = (r >> 1) + b; }
        else r >>= 1;
        b >>= 2;
    }
    return r;
}

#define GLOW_A 7   /* the strongest a lamp tints what it lights, in sixteenths */

static void glow_pass(Surface *s, int cx, int cy) {
    /*  One byte table per channel per strength, so a tinted pixel is three
     *  lookups instead of a call, six multiplies and three divides. The tint
     *  is constant for the whole disc, which is what makes this possible, and
     *  lamps of the same colour reuse the tables they built.
     *
     *  This pass, not the per-pixel light in the tile blit, was where the frame
     *  rate had gone: measured by taking each stage out one at a time, after
     *  two confident guesses about the blit turned out to be worth three
     *  frames a second between them. */
    static uint8_t tab[GLOW_A + 1][3][32];
    uint16_t built = 0;

    for (int n = 0; n < s_lamps; n++) {
        const Lamp *l = &s_lamp[n];
        int r = l->glow;
        int r2 = r * r;
        int ox = l->x * TILE + TILE / 2 - cx;
        int oy = l->y * TILE + TILE / 2 - cy;
        if (ox + r < 0 || ox - r >= SCREEN_W || oy + r < 0 || oy - r >= SCREEN_H) continue;

        if (l->tint != built) {
            built = l->tint;
            int tc[3] = { built & 31, (built >> 5) & 31, (built >> 10) & 31 };
            for (int a = 1; a <= GLOW_A; a++)
                for (int c = 0; c < 3; c++)
                    for (int v = 0; v < 32; v++)
                        tab[a][c][v] = (uint8_t)(v + (tc[c] - v) * a / 16);
        }

        /*  Strength by reciprocal rather than division: one multiply and a
         *  shift stands in for (r2 - d2) * GLOW_A / r2. */
        int inv = ((GLOW_A << 16) + r2 - 1) / r2;
        int vmin = r2 / GLOW_A;                 /* below this the tint rounds away */

        int y0 = oy - r < 0 ? -oy : -r;
        int y1 = oy + r >= SCREEN_H ? SCREEN_H - 1 - oy : r;

        for (int y = y0; y <= y1; y++) {
            uint16_t *dst = s->px + (oy + y) * SCREEN_W + ox;
            int q = r2 - y * y;
            if (q < vmin) continue;             /* nothing on this row shows */
            /*  Where the tint stops on this row, solved rather than searched
             *  for: a third of the bounding box is outside the disc or too
             *  faint to show, and walking it was a third of the pass. */
            int xr = isqrt_(q - vmin);
            int x0 = ox - xr < 0 ? -ox : -xr;
            int x1 = ox + xr >= SCREEN_W ? SCREEN_W - 1 - ox : xr;
            /*  x squared, stepped: (x+1)^2 - x^2 is 2x + 1, so the distance
             *  across a row costs an add rather than a multiply. */
            int xx = x0 * x0, dxx = 2 * x0 + 1;
            for (int x = x0; x <= x1; x++) {
                int v = q - xx;
                xx += dxx; dxx += 2;
                int a = (v * inv) >> 16;
                if (a <= 0) continue;
                if (a > GLOW_A) a = GLOW_A;
                const uint8_t (*t)[32] = tab[a];
                uint16_t c = dst[x];
                dst[x] = (uint16_t)(0x8000 | (t[2][(c >> 10) & 31] << 10)
                                           | (t[1][(c >> 5) & 31] << 5)
                                           |  t[0][c & 31]);
            }
        }
    }
}

/*  One tile, lit. `l` is the light at its four corners; the level is bilinear
 *  across the tile so a lamp falls off smoothly instead of in tile-sized
 *  squares. Colour is not applied here -- see glow_pass, which does it over the
 *  few hundred pixels close enough to a coloured source to show it rather than
 *  over every pixel on the screen. */
static void blit_tile_lit(Surface *s, const Tiles *t, int sx, int sy, int wx, int wy,
                          int is_wall, int shade, const uint8_t l[4]) {
    /*  Clip the tile to the screen once instead of testing every pixel, and
     *  hoist the texture row out of the inner loop. */
    int x0 = sx < 0 ? 0 : sx, x1 = sx + TILE > SCREEN_W ? SCREEN_W : sx + TILE;
    int y0 = sy < 0 ? 0 : sy, y1 = sy + TILE > SCREEN_H ? SCREEN_H : sy + TILE;
    if (x0 >= x1 || y0 >= y1) return;

    const uint8_t *pix = is_wall ? t->wall : t->floor;
    const uint16_t (*lut)[64] = is_wall ? t->wall_lut : t->floor_lut;
    /*  Both read the full thirty-two rows now. The wall used to mask to
     *  sixteen so its pattern came out at the right scale on a sixteen-pixel
     *  tile; on a thirty-two-pixel tile that would repeat the top half twice
     *  and band every wall across the middle. */
    int vmask = TEXELS - 1;

    for (int py = y0; py < y1; py++) {
        int y = py - sy;
        int fy = y * 256 / TILE;
        int left  = (l[0] * (256 - fy) + l[2] * fy) >> 8;
        int right = (l[1] * (256 - fy) + l[3] * fy) >> 8;

        /*  A tile is sixteen wide and a texture thirty-two, and tiles land on
         *  multiples of sixteen, so a row of one tile reads sixteen texels
         *  starting at either 0 or 16 and can never run off the end. That is
         *  what lets the source be a plain walking pointer with no wrap test. */
        const uint8_t *src = pix + ((wy + y) & vmask) * TEXELS
                                 + ((wx + x0 - sx) & (TEXELS - 1));
        uint16_t *dst = s->px + py * SCREEN_W + x0;
        uint16_t *end = s->px + py * SCREEN_W + x1;

        /*  Multiplied, not shifted: the difference between two corners is
         *  routinely negative and shifting a negative left is undefined. */
        int slope = (right - left) * 256;
        int lvl = left * 256 + slope * (x0 - sx) / TILE;
        int step = slope / TILE;

        /*  The light is bilinear across the tile but the palette it selects is
         *  one of sixteen, so over sixteen pixels it changes hands two or
         *  three times at most. Choosing the shade per run instead of per
         *  pixel takes the inner loop down to a load, a load and a store --
         *  and this loop, measured against the rest of the frame one stage at
         *  a time, is what decides whether the screen makes its vblank. */
        while (dst < end) {
            int raw = lvl >> 8;
            int level = raw - shade;
            if (level < 0) level = 0;
            else if (level > LIGHT_MAX) level = LIGHT_MAX;
            const uint16_t *lrow = lut[level];
            if (!step) {                              /* flat: the common case */
                while (dst < end) *dst++ = lrow[*src++];
                break;
            }
            do {
                *dst++ = lrow[*src++];
                lvl += step;
            } while (dst < end && (lvl >> 8) == raw);
        }
    }
}

/*  One crawler, at a screen position, facing a direction. Three sprites and a
 *  mirror cover the four facings; the bob is a single pixel on alternate
 *  half-strides, which at this size is the whole walk cycle. */
/*  Ten frames per facing, in the order tools/art/overworld.py emits them:
 *  six of a walk cycle, then four of a breath. */
#define OW_FRAMES 10
#define OW_WALK    6
#define OW_IDLE    4

static void draw_crawler(Surface *s, int slot, int sx, int sy, int facing,
                         int walking, int stride) {
    int who = g.hero[slot].crawler & 3;
    static const uint8_t kFace[4] = { 1, 2, 0, 2 };   /* N->up E->side S->down W->side */

    /*  A stride is half the cycle and takes a whole tile, so the six frames
     *  span two tiles and the same foot does not lead twice in a row --
     *  which is exactly what a single bobbing sprite looked like it was
     *  doing before there were frames to play. Standing still runs the
     *  breath instead, slowly, off the global clock. */
    int frame;
    if (walking) {
        int elapsed = WALK_FRAMES - g.dun.move_anim;
        int half = elapsed * (OW_WALK / 2) / WALK_FRAMES;
        if (half > OW_WALK / 2 - 1) half = OW_WALK / 2 - 1;
        frame = (stride & 1) * (OW_WALK / 2) + half;
    } else {
        frame = OW_WALK + ((g.anim >> 4) & (OW_IDLE - 1));
    }
    const Sprite *sp = sprite_table[SPR_OW_CARL_DOWN_0
                                    + (who * 3 + kFace[facing & 3]) * OW_FRAMES + frame];
    /*  Drawn at twice the art's size, because the tile is. The overworld
        sprites are authored sixteen by twenty for a sixteen-pixel grid; on a
        thirty-two-pixel grid at native size they would be half a tile wide,
        which is the token they used to look like. Doubling is the right
        enlargement for pixel art -- every source pixel becomes an exact two
        by two block, so the outlines stay hard and nothing is resampled. */
    const int z = 200;
    int w = sp->w * z / 100, h = sp->h * z / 100;
    /*  A shadow, so the party sits on the floor rather than hovering over it. */
    gfx_dither(s, sx + 6, sy + h - 4, w - 12, 5, C_VOID, 8);
    if ((facing & 3) == 3) gfx_sprite_scaled_flip(s, sp, sx, sy, z, 100);
    else gfx_sprite_scaled(s, sp, sx, sy, z, 100);
    if (g.hero[slot].hp <= 0) gfx_shade(s, sx, sy, w, h, 9);
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
    /*  The follower is half a cycle behind the leader, because two people
        walking in perfect lockstep read as one person and a copy of them. */
    /*  Half the doubled sprite across, and enough of it above the tile centre
        that the feet land on the floor rather than the sprite straddling it. */
    const int kOffX = 16, kOffY = 28;
    int stride = (int)g.dun.steps;
    if (fy > cy) {
        draw_crawler(s, 0, cx - kOffX, cy - kOffY, f, walking, stride);
        draw_crawler(s, 1, fx - kOffX, fy - kOffY, f, walking, stride + 1);
    } else {
        draw_crawler(s, 1, fx - kOffX, fy - kOffY, f, walking, stride + 1);
        draw_crawler(s, 0, cx - kOffX, cy - kOffY, f, walking, stride);
    }
}

void view2d_draw(Surface *s) {
    const Dungeon *d = &g.dun;
    Tiles t;
    tiles_for(&t, d->index);

    int cx, cy;
    camera_of(&cx, &cy);
    /*  Floor division, not C's truncation: at the west and north edges of a
     *  floor the camera runs negative, and truncating toward zero there puts
     *  the grid one tile out and leaves a column of the screen uncovered. */
    int tx0 = (cx >= 0 ? cx / TILE : -((TILE - 1 - cx) / TILE)) - 1;
    int ty0 = (cy >= 0 ? cy / TILE : -((TILE - 1 - cy) / TILE)) - 1;
    int cols = SCREEN_W / TILE + 3, rows = SCREEN_H / TILE + 3;

    /*  Light sampled once per tile corner for the whole visible grid, so a tile
     *  and its neighbour agree about the corner they share and the falloff is
     *  continuous across the screen. */
    static uint8_t grid[(SCREEN_H / TILE + 4)][(SCREEN_W / TILE + 4)];
    /*  One pass of thirty-two-bit stores over the screen, which is cheaper
     *  than the two hundred clipped rectangles it would take to lay the same
     *  haze down tile by tile -- that was tried, and cost a fifth of the frame
     *  to save a tenth. */
    gfx_clear(s, t.fog);

    gather_lamps(tx0, ty0, cols, rows);

    /*  Three hundred and twenty corners, each weighing itself against every
     *  lamp on screen, is a fifth of the frame -- and none of it changes
     *  between two frames in which the party has not crossed a tile boundary.
     *  So it is worked out on the frames where something moved and read back
     *  on the rest, which is most of them: a step takes eight frames and shifts
     *  the corner grid at most twice. The key is everything the answer depends
     *  on. The lamp signature covers a box being opened or a floor being
     *  swapped underneath us; px/py cover both the party's own lamp and the
     *  ground they have just remembered. */
    {
        /*  Unsigned throughout: a hash is meant to wrap, and signed overflow
         *  is undefined rather than wrapping. */
        uint32_t sig = (uint32_t)s_lamps * 2654435761u + g.season;
        for (int n = 0; n < s_lamps; n++)
            sig = sig * 31u + (uint32_t)s_lamp[n].x * 71u
                            + (uint32_t)s_lamp[n].y * 13u + s_lamp[n].strength;

        static uint32_t key[6] = { 1, 1, 1, 1, 1, 1 };
        if (key[0] != (uint32_t)tx0 || key[1] != (uint32_t)ty0 ||
            key[2] != (uint32_t)d->index || key[3] != (uint32_t)g.dun.px ||
            key[4] != (uint32_t)g.dun.py || key[5] != sig) {
            key[0] = (uint32_t)tx0; key[1] = (uint32_t)ty0; key[2] = (uint32_t)d->index;
            key[3] = (uint32_t)g.dun.px; key[4] = (uint32_t)g.dun.py; key[5] = sig;
            for (int j = 0; j <= rows; j++)
                for (int i = 0; i <= cols; i++)
                    grid[j][i] = light_at(tx0 + i, ty0 + j);
        }
    }

    /*  Floor first, everywhere, then walls on top of it: a wall's south face
     *  hangs over the tile below and has to be drawn after it. */
    for (int j = 0; j < rows; j++)
        for (int i = 0; i < cols; i++) {
            int mx = tx0 + i, my = ty0 + j;
            if (!dungeon_seen(mx, my) || solid(mx, my)) continue;
            const uint8_t corner[4] = { grid[j][i], grid[j][i + 1],
                                        grid[j + 1][i], grid[j + 1][i + 1] };
            blit_tile_lit(s, &t, mx * TILE - cx, my * TILE - cy,
                          mx * TILE, my * TILE, 0, 0, corner);
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
            const uint8_t corner[4] = { grid[j][i], grid[j][i + 1],
                                        grid[j + 1][i], grid[j + 1][i + 1] };
            blit_tile_lit(s, &t, sx, sy, mx * TILE, my * TILE, 1, 4, corner);
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
            int scale = 80;   /* against a tile twice the size */
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

    /*  Colour from the lamps, over the tiles and under the party. */
#ifndef ABL_NOGLOW
    glow_pass(s, cx, cy);
#endif

    view2d_draw_party(s, SCREEN_W / 2, SCREEN_H / 2);

    /*  Everything the party has not walked past yet stays under the haze.
     *
     *  The screen was cleared to that same haze before anything was drawn on
     *  it, so almost every unexplored tile is already the right colour and
     *  repainting all of them was costing as much as drawing the entire floor.
     *  The only ones that need it are the ones a lamp has just thrown colour
     *  across -- a thin border where explored ground meets the dark. */
    for (int n = 0; n < s_lamps; n++) {
        const Lamp *l = &s_lamp[n];
        int reach = l->glow / TILE + 1;
        int i0 = l->x - reach, i1 = l->x + reach;
        int j0 = l->y - reach, j1 = l->y + reach;
        if (i0 < tx0) i0 = tx0;
        if (j0 < ty0) j0 = ty0;
        if (i1 >= tx0 + cols) i1 = tx0 + cols - 1;
        if (j1 >= ty0 + rows) j1 = ty0 + rows - 1;
        for (int my = j0; my <= j1; my++)
            for (int mx = i0; mx <= i1; mx++) {
                if (dungeon_seen(mx, my)) continue;
                gfx_rect(s, mx * TILE - cx, my * TILE - cy, TILE, TILE, t.fog);
            }
    }
    for (int i = 0; i < 10; i++) {
        int a = (10 - i) / 3;
        if (!a) continue;
        gfx_vline(s, i, 0, SCREEN_H - 1, gfx_mix(s->px[i], C_VOID, a));
        gfx_vline(s, SCREEN_W - 1 - i, 0, SCREEN_H - 1,
                  gfx_mix(s->px[SCREEN_W - 1 - i], C_VOID, a));
    }
}
