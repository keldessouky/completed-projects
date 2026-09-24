/*  The same game, on your desktop.
 *
 *  src/core and src/render are portable C, so this harness compiles them
 *  against a stub platform layer and plays the game with a bot that reads the
 *  map and walks it. It runs a full three-floor playthrough in a second or two
 *  and can dump PNGs of any frame, which is how the screenshots in docs/ are
 *  made and how the balance is checked without touching an emulator.
 *
 *    hostsim --bot            play the whole game, assert it is completable
 *    hostsim --shots DIR      write PNGs of the scenes along the way
 *    hostsim --runs N         play N times with different seeds (balance sweep)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <zlib.h>
#include <math.h>

#include "platform.h"
#include "game.h"
#include "gfx.h"

/*  Declared in render.c rather than a header of its own. */
void view2d_draw(Surface *s);
#include "ui_layout.h"
#include "art.h"
#include "theme.h"

static uint16_t fb[2][SCREEN_W * SCREEN_H];
/*  The dungeon's half-size layer. On the DS this is a background the 2D engine
 *  magnifies; here it is composed in software at capture time, so a screenshot
 *  and an assertion see what the panel would show. */
static uint16_t fb_world[WORLD_W * WORLD_H];
uint16_t *plat_screen(int which) {
    return which == SCREEN_WORLD ? fb_world : fb[which ? 1 : 0];
}
/*  The DS fades in hardware; here the levels are kept and applied when a
    screenshot is composed, the same way the world layer is. */
static int bright[2];
void plat_brightness(int top, int bottom) { bright[0] = top; bright[1] = bottom; }
static uint16_t brighten(uint16_t c, int level) {
    if (!level) return c;
    int ch[3] = { c & 31, (c >> 5) & 31, (c >> 10) & 31 };
    for (int i = 0; i < 3; i++)
        ch[i] = level < 0 ? ch[i] - ch[i] * -level / 16 : ch[i] + (31 - ch[i]) * level / 16;
    return (uint16_t)((c & 0x8000) | (ch[2] << 10) | (ch[1] << 5) | ch[0]);
}
void plat_sound(int voice, int freq, int volume, int duty) { (void)voice; (void)freq; (void)volume; (void)duty; }
void plat_sound_stop(int voice) { (void)voice; }
/*  No VRAM here, so nothing to limit; the composition at capture time reads
    the whole buffer either way. */
void plat_top_rows(int y0, int rows) { (void)y0; (void)rows; }

/* ------------------------------------------------------------------ png ---- */

static void put32(unsigned char *p, uint32_t v) { p[0] = v >> 24; p[1] = v >> 16; p[2] = v >> 8; p[3] = v; }

static void png_chunk(FILE *f, const char *type, const unsigned char *data, size_t len) {
    unsigned char hdr[8];
    put32(hdr, (uint32_t)len);
    memcpy(hdr + 4, type, 4);
    fwrite(hdr, 1, 8, f);
    /*  IEND carries no data, and fwrite is declared never to take a null
     *  pointer even for a zero-length write. */
    if (len) fwrite(data, 1, len, f);
    uLong crc = crc32(0, (const Bytef *)type, 4);
    if (len) crc = crc32(crc, data, (uInt)len);
    unsigned char c[4];
    put32(c, (uint32_t)crc);
    fwrite(c, 1, 4, f);
}

/* Writes both screens stacked, the way a DS shows them. */
static void write_shot(const char *path) {
    unsigned w = SCREEN_W, h = SCREEN_H * 2;
    size_t raw_len = (size_t)h * (1 + (size_t)w * 3);
    unsigned char *raw = malloc(raw_len), *o = raw;
    for (unsigned y = 0; y < h; y++) {
        *o++ = 0;
        const uint16_t *src = fb[y < SCREEN_H ? 0 : 1] + (y % SCREEN_H) * SCREEN_W;
        /*  The top screen is two layers: the magnified world underneath and
            the full-resolution overlay above it, which is see-through
            wherever its alpha bit is clear. */
        const uint16_t *wsrc = (y < SCREEN_H && g.scene == SCENE_DUNGEON)
                             ? fb_world + (y / 2) * WORLD_W : 0;
        for (unsigned x = 0; x < w; x++) {
            uint16_t c = src[x];
            if (wsrc && !(c & 0x8000)) c = wsrc[x / 2];
            c = brighten(c, bright[y < SCREEN_H ? 0 : 1]);
            *o++ = (unsigned char)(((c) & 31) * 255 / 31);
            *o++ = (unsigned char)(((c >> 5) & 31) * 255 / 31);
            *o++ = (unsigned char)(((c >> 10) & 31) * 255 / 31);
        }
    }
    uLongf zlen = compressBound((uLong)raw_len);
    unsigned char *z = malloc(zlen);
    compress2(z, &zlen, raw, (uLong)raw_len, 9);
    FILE *f = fopen(path, "wb");
    if (!f) { fprintf(stderr, "cannot write %s\n", path); exit(2); }
    static const unsigned char sig[8] = { 137, 'P', 'N', 'G', 13, 10, 26, 10 };
    fwrite(sig, 1, 8, f);
    unsigned char ihdr[13];
    put32(ihdr, w); put32(ihdr + 4, h);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = ihdr[11] = ihdr[12] = 0;
    png_chunk(f, "IHDR", ihdr, sizeof ihdr);
    png_chunk(f, "IDAT", z, zlen);
    png_chunk(f, "IEND", NULL, 0);
    fclose(f);
    free(z); free(raw);
}

/* ------------------------------------------------------------------ bot ---- */

static PlatInput input;
static const char *shots_dir;
static int verbose;
static int pause_scene = -1;      /* the tour stops here instead of tapping through */

/*  What the screens are showing, as opposed to what is in the buffers.
 *
 *  The renderer skips a frame outright when its signature says nothing
 *  visible changed, and the DS then keeps showing the last frame it was sent.
 *  A field the signature leaves out is drawn once and then left: the
 *  dungeon's console kept the first dark frame of a fade until the party
 *  moved, the map ignored its zoom button, a boss's roster row did not light
 *  for its tell. With this on, every frame what the screens hold is compared
 *  with a frame drawn fresh from the same state.
 *
 *  Some lag is the design -- the battle redraws its idle motion every fourth
 *  frame, the title every second -- so what is measured is how long a screen
 *  stays wrong, not whether it ever is. A few frames is a frame rate. Longer
 *  is a picture that is waiting for the player to do something before it
 *  catches up. */
#define STALE_MAX_LAG 4    /* the longest the design asks for is three */
static int stale_on;
static uint16_t shown[3][SCREEN_W * SCREEN_H];
typedef struct { int worst, frame, px, x0, y0, x1, y1; } Stale;
static Stale stale[SCENE_COUNT][3];
static int stale_age[3];
static uint16_t check_buf[3][SCREEN_W * SCREEN_H];

static void stale_check(int what) {
    uint16_t *bufs[3] = { fb[0], fb[1], fb_world };
    const size_t sizes[3] = { sizeof fb[0], sizeof fb[1], sizeof fb_world };
    const int widths[3] = { SCREEN_W, SCREEN_W, WORLD_W };
    if (what & RENDER_TOP) memcpy(shown[0], bufs[0], sizes[0]);
    if (what & RENDER_BOTTOM) memcpy(shown[1], bufs[1], sizes[1]);
    if (what & RENDER_WORLD) memcpy(shown[2], bufs[2], sizes[2]);
    /*  The buffers are the renderer's scratch as well: keep them, so the
        fresh draw does not become the next frame's starting point. */
    for (int k = 0; k < 3; k++) memcpy(check_buf[k], bufs[k], sizes[k]);
    render_invalidate();
    int fresh = render_frame();
    for (int k = 0; k < 3; k++) {
        if (k == 2 && !(fresh & RENDER_WORLD)) { stale_age[k] = 0; continue; }  /* hidden */
        int n = 0, x0 = 9999, y0 = 9999, x1 = -1, y1 = -1;
        for (size_t i = 0; i < sizes[k] / 2; i++)
            if (shown[k][i] != bufs[k][i]) {
                int x = (int)(i % (size_t)widths[k]), y = (int)(i / (size_t)widths[k]);
                n++;
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x > x1) x1 = x;
                if (y > y1) y1 = y;
            }
        stale_age[k] = n ? stale_age[k] + 1 : 0;
        Stale *st = &stale[g.scene][k];
        if (stale_age[k] > st->worst) {
            st->worst = stale_age[k];
            st->frame = (int)g.frame; st->px = n;
            st->x0 = x0; st->y0 = y0; st->x1 = x1; st->y1 = y1;
        }
    }
    for (int k = 0; k < 3; k++) memcpy(bufs[k], check_buf[k], sizes[k]);
}

static void step(void) {
    int what = game_frame(&input);
    memset(&input, 0, sizeof input);
    if (stale_on) stale_check(what);
}
static void idle(int n) { for (int i = 0; i < n; i++) step(); }
static void tap(uint32_t button) { input.pressed = button; input.held = button; step(); idle(1); }

/*  Toasts stack three deep and sit for a few seconds, which is a third of the
 *  top screen. A picture meant to show what the floor looks like should not be
 *  mostly a picture of achievement banners. */
static void wait_toasts(void) {
    for (int i = 0; i < 600; i++) {
        int alive = 0;
        for (int k = 0; k < MAX_TOASTS; k++) if (g.toast[k].life) alive = 1;
        if (!alive) return;
        idle(1);
    }
}

static void shot(const char *name) {
    if (!shots_dir) return;
    char path[512];
    snprintf(path, sizeof path, "%s/%s.png", shots_dir, name);
    idle(20);                        /* let the scene fade in before shooting */
    write_shot(path);
    if (verbose) printf("  shot %s\n", path);
}

/* ------------------------------------------------------------- contrast -- */

/*  Relative luminance of a 15-bit colour, the WCAG way. */
static double lum15(uint16_t c) {
    double ch[3] = { (c & 31) / 31.0, ((c >> 5) & 31) / 31.0, ((c >> 10) & 31) / 31.0 };
    for (int i = 0; i < 3; i++)
        ch[i] = ch[i] <= 0.03928 ? ch[i] / 12.92 : pow((ch[i] + 0.055) / 1.055, 2.4);
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

static double contrast15(uint16_t a, uint16_t b) {
    double la = lum15(a), lb = lum15(b);
    return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

/*  The commonest colour on one scanline of a rect: text is sparse, so that is
 *  the background, gradient or not. */
static uint16_t line_bg(const uint16_t *fb_, int x0, int y, int w) {
    uint16_t best = fb_[y * SCREEN_W + x0];
    int best_n = 0;
    for (int i = 0; i < w; i++) {
        uint16_t c = fb_[y * SCREEN_W + x0 + i];
        int n = 0;
        for (int j = 0; j < w; j++) n += fb_[y * SCREEN_W + x0 + j] == c;
        if (n > best_n) { best_n = n; best = c; }
    }
    return best;
}

/*  How legible a row's text is once it is selected.
 *
 *  A lit row changes its background and, if the renderer is doing its job,
 *  its text colours with it -- so the text cannot be found by colour in the lit
 *  frame, because text that has vanished into the paper is exactly the case
 *  being looked for. It is found in the unlit frame instead, as whatever
 *  stands off its scanline's background there, and then each of those pixels
 *  is scored against the background in the lit frame. Returns the worst ratio,
 *  and how many text pixels were found so a rect that missed the text can be
 *  told from one that passed. */
static double lit_text_contrast(const uint16_t *glass, const uint16_t *paper,
                                int x0, int y0, int w, int h, int *found) {
    double worst = 99.0;
    *found = 0;
    for (int y = y0; y < y0 + h; y++) {
        uint16_t gbg = line_bg(glass, x0, y, w), pbg = line_bg(paper, x0, y, w);
        for (int x = x0; x < x0 + w; x++) {
            if (contrast15(glass[y * SCREEN_W + x], gbg) < 2.0) continue;
            double c = contrast15(paper[y * SCREEN_W + x], pbg);
            if (c < worst) worst = c;
            (*found)++;
        }
    }
    return worst;
}

/* Breadth-first over the floor, so the bot walks like someone with a map. */
typedef struct { int x, y; } Pt;

static int find_path(int sx, int sy, int tx, int ty, int *first_dx, int *first_dy) {
    static int16_t came[MAP_MAX * MAP_MAX];
    static Pt queue[MAP_MAX * MAP_MAX];
    for (int i = 0; i < MAP_MAX * MAP_MAX; i++) came[i] = -1;
    int head = 0, tail = 0;
    queue[tail++] = (Pt){ sx, sy };
    came[sy * MAP_MAX + sx] = sy * MAP_MAX + sx;
    static const int dx[4] = { 0, 1, 0, -1 }, dy[4] = { -1, 0, 1, 0 };
    while (head < tail) {
        Pt p = queue[head++];
        if (p.x == tx && p.y == ty) {
            int cur = ty * MAP_MAX + tx;
            while (came[cur] != cur && came[came[cur]] != came[cur]) cur = came[cur];
            *first_dx = (cur % MAP_MAX) - sx;
            *first_dy = (cur / MAP_MAX) - sy;
            return 1;
        }
        for (int d = 0; d < 4; d++) {
            int nx = p.x + dx[d], ny = p.y + dy[d];
            if (nx < 0 || ny < 0 || nx >= MAP_MAX || ny >= MAP_MAX) continue;
            if (came[ny * MAP_MAX + nx] != -1) continue;
            char t = dungeon_tile(nx, ny);
            if (t == T_WALL) continue;
            came[ny * MAP_MAX + nx] = (int16_t)(p.y * MAP_MAX + p.x);
            queue[tail++] = (Pt){ nx, ny };
        }
    }
    return 0;
}

/*  Overhead, a direction is a button. Pressing into a wall turns to face it
 *  without moving, so a blocked step costs one extra tap and no more. */
static const int kDirButton[4] = { BTN_UP, BTN_RIGHT, BTN_DOWN, BTN_LEFT };

static void face_and_step(int dx, int dy) {
    int want = dy < 0 ? DIR_N : dy > 0 ? DIR_S : dx > 0 ? DIR_E : DIR_W;
    if (g.dun.facing != (uint8_t)want) {
        tap(kDirButton[want]);          /* the first press turns to face it */
        if (g.scene != SCENE_DUNGEON) return;
    }
    tap(kDirButton[want]);
}

/* Fights: hit the biggest thing until it stops moving, drink when low. */
static void play_battle(void) {
    /*  Battles now say one thing at a time and wait to be read, so the bot has
     *  to read too: any tap while a message is up dismisses the message rather
     *  than pressing a button. Commands are FIGHT, BAG, GUARD, RUN. */
    int guard = 0;
    while (g.scene == SCENE_BATTLE && guard++ < 9000) {
        if (battle_message(0) >= 0) { tap(BTN_A); continue; }
        if (g.bat.phase != BAT_CHOOSE || g.bat.actor >= PARTY) { tap(BTN_A); continue; }

        int hero = g.bat.actor;
        int hurt = g.hero[hero].hp * 100 / (g.hero[hero].hp_max ? g.hero[hero].hp_max : 1);
        const SkillDef *skills[8];
        int n = game_hero_skills(hero, skills, 8);
        int have_potion = 0;
        for (int i = 1; i < item_count; i++)
            if (item_defs[i].kind == IT_HEAL && g.inventory[i]) have_potion = 1;

        if (hurt < 35 && have_potion) {                  /* BAG, first item */
            g.bat.cursor = 1;
            tap(BTN_A);
            if (g.bat.phase == BAT_ITEM) { g.bat.cursor = 0; tap(BTN_A); }
            continue;
        }

        /* FIGHT, then the hardest damaging move there is stamina for. The
           free move is in the list, so there is always something to pick. */
        int best = -1;
        for (int i = 0; i < n; i++)
            if (skills[i]->cost <= g.hero[hero].mp &&
                (skills[i]->kind == SK_HIT_ONE || skills[i]->kind == SK_HIT_ALL) &&
                (best < 0 || skills[i]->power > skills[best]->power)) best = i;
        g.bat.cursor = 0;
        tap(BTN_A);
        if (g.bat.phase == BAT_SKILL) {
            g.bat.cursor = (uint8_t)(best >= 0 ? best : 0);
            tap(BTN_A);
            if (g.bat.phase == BAT_TARGET) tap(BTN_A);
        }
    }
}

/*  Wanders the floor picking fights until the party is levelled enough to be
 *  worth the boss's time. A player does this by exploring; the bot has to be
 *  told. */
static void grind_to(int level, int max_steps) {
    static const int dirs[4] = { BTN_UP, BTN_RIGHT, BTN_DOWN, BTN_LEFT };
    for (int i = 0; i < max_steps && g.hero[0].level < level; i++) {
        if ((int)g.scene == pause_scene) return;
        if (g.scene == SCENE_BATTLE) { play_battle(); continue; }
        if (g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY ||
            g.scene == SCENE_TITLE || g.scene == SCENE_DRAFT) return;
        if (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE ||
            g.scene == SCENE_BOX || g.scene == SCENE_LEVELUP ||
            g.scene == SCENE_SHOP || g.scene == SCENE_CODE ||
            g.scene == SCENE_SAFEROOM) { tap(BTN_A); continue; }
        if (g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY) return;
        if (g.scene != SCENE_DUNGEON) { tap(BTN_B); continue; }
        uint16_t before = g.dun.steps;
        if (g.scene == SCENE_GAMEOVER || g.scene == SCENE_TITLE ||
            g.scene == SCENE_DRAFT) break;
        tap(dirs[i & 3]);
        if (g.scene == SCENE_DUNGEON && g.dun.steps == before) tap(dirs[(i + 1) & 3]);
        /* Patch up between fights if the bag allows it. */
        if (g.hero[0].hp * 3 < g.hero[0].hp_max) tap(BTN_Y);
        if (g.hero[1].hp * 3 < g.hero[1].hp_max) tap(BTN_Y);
    }
}

/*  Has this season ended? Once it has, every "tap until we are back in the
 *  corridor" loop has to stop: tapping on past the recap reaches the title,
 *  and one more tap there starts a whole new season underneath the test. */
static int season_over(void) {
    return g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY ||
           g.scene == SCENE_TITLE || g.scene == SCENE_DRAFT;
}

/* Walks to the first tile matching `want`, fighting whatever interrupts. */
static int walk_to(char want, int max_steps) {
    for (int steps = 0; steps < max_steps; steps++) {
        if ((int)g.scene == pause_scene) return 1;
        /*  Rule 12. Nothing else on the floor matters while that is behind
            you, and the answer is the stairwell -- so abandon whatever this
            walk was for and let the caller route to the stairs. A bot that
            keeps shopping while it is being hunted is not testing the
            mechanic, it is just dying to it. */
        if (g.rage_hunt && want != T_DOWN) return 0;
        if (g.scene == SCENE_BATTLE) { play_battle(); continue; }
        if (g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY ||
            g.scene == SCENE_TITLE || g.scene == SCENE_DRAFT) return 0;
        if (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE ||
            g.scene == SCENE_BOX || g.scene == SCENE_LEVELUP ||
            g.scene == SCENE_SHOP || g.scene == SCENE_CODE ||
            g.scene == SCENE_SAFEROOM) { tap(BTN_A); continue; }
        if (g.scene != SCENE_DUNGEON) { tap(BTN_B); continue; }

        int tx = -1, ty = -1;
        for (int y = 0; y < g.dun.h && tx < 0; y++)
            for (int x = 0; x < g.dun.w; x++)
                if (dungeon_tile(x, y) == want && !dungeon_is_used(x, y)) { tx = x; ty = y; break; }
        if (tx < 0) return 0;
        if (g.dun.px == tx && g.dun.py == ty) return 1;
        int dx = 0, dy = 0;
        if (!find_path(g.dun.px, g.dun.py, tx, ty, &dx, &dy)) return 0;
        face_and_step(dx, dy);
    }
    return 0;
}

static int fail_count;

static void check(int condition, const char *what) {
    printf("  %s %s\n", condition ? "ok  " : "FAIL", what);
    if (!condition) fail_count++;
}

/*  How deep the bot is asked to go. A full eighteen-floor descent is a long
 *  test and the interesting failures are all in the first few floors, so the
 *  playthrough check drives a slice and the assertions are about depth rather
 *  than about finishing. */
/*  The depth the run has to reach for the assertion to pass. */
#define BOT_FLOORS 4
/*  Buy the best gear the floor sells and put it on.
 *
 *  The bot had no idea equipment existed: at a shop it tapped A six times
 *  with the cursor at the top of the list, which bought potions. So the whole
 *  gear economy could be added, or removed, without moving a single number
 *  this harness prints -- five seeded runs came back byte-identical to the
 *  ones before it. A bot that never equips cannot report whether equipping
 *  matters.
 *
 *  Buying goes through the real cursor and the real BUY press. Wearing calls
 *  equip_item directly rather than driving the gear tab, because what the
 *  menu does with a d-pad is covered by its own test and what this wants to
 *  measure is the fight afterwards.
 */
static void kit_out(void) {
    if (g.scene != SCENE_SHOP) return;
    int stock[MAX_STOCK];
    int n = shop_stock(g.dun.index + 1, stock, MAX_STOCK);
    for (int slot = 0; slot < 3; slot++) {
        int want = -1;
        for (int i = 0; i < n; i++) {
            const ItemDef *d = &item_defs[stock[i]];
            if (d->kind < IT_WEAPON || d->slot != slot) continue;
            if (d->price > g.gold) continue;
            if (want < 0 || d->power > item_defs[want].power) want = stock[i];
        }
        if (want < 0) continue;
        for (int i = 0; i < n; i++)
            if (stock[i] == want) g.shop_cursor = (uint8_t)i;
        tap(BTN_A);
    }
    /*  Consumables only with what is left over, and only when there is
        nothing left to save for -- the first version of this bought four
        potions at every shop and arrived at the next one with twenty gold,
        so it could never afford a weapon and reported the gear economy as
        having no effect. */
    int cheapest = 0;
    for (int i = 1; i < item_count; i++) {
        const ItemDef *d = &item_defs[i];
        if (d->kind < IT_WEAPON || d->floor > g.dun.index + 1) continue;
        int worn = 0;
        for (int h = 0; h < PARTY; h++)
            if (g.hero[h].equip[d->slot] == i) worn = 1;
        if (worn) continue;
        if (!cheapest || d->price < cheapest) cheapest = d->price;
    }
    g.shop_cursor = 0;
    for (int i = 0; i < 4 && g.gold > cheapest; i++) tap(BTN_A);
}

static void wear_best(void) {
    for (int h = 0; h < PARTY; h++)
        for (int slot = 0; slot < 3; slot++) {
            int want = -1;
            for (int i = 1; i < item_count; i++) {
                const ItemDef *d = &item_defs[i];
                if (d->kind < IT_WEAPON || d->slot != slot || !g.inventory[i]) continue;
                if (want < 0 || d->power > item_defs[want].power) want = i;
            }
            if (want > 0) equip_item(&g.hero[h], want);
        }
}

/*  How many times round the floor loop before giving up. The loop used to stop
    at four, so most runs ended alive with the bot simply out of budget, and
    the floor a run "reached" said more about the harness than the game. */
#define BOT_ITERS  22

static void play_run(int seed, int assertions) {
    const int bot_floors = BOT_ITERS;
    game_boot();
    rng_seed((uint32_t)seed);
    idle(2 + seed % 41);        /* the title screen seeds from the frame you press on */
    tap(BTN_A);                                        /* title -> descend */
    for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE); i++) tap(BTN_A);
    /*  Draft a different pair per seed, so the roster gets exercised rather
        than just the first two names on it. */
    if (g.scene == SCENE_DRAFT) {
        g.draft_cursor = (uint8_t)(seed % crawler_count);
        tap(BTN_A);
        g.draft_cursor = (uint8_t)((seed / 7 + 1) % crawler_count);
        if (g.draft_cursor == g.draft_pick[0])
            g.draft_cursor = (uint8_t)((g.draft_cursor + 1) % crawler_count);
        tap(BTN_A);
    }
    for (int i = 0; i < 60 && g.scene == SCENE_DRAFT; i++) tap(BTN_A);
    if (verbose) printf("  drafted %s and %s\n", g.hero[0].name, g.hero[1].name);

    for (int floor_no = 1; floor_no <= bot_floors; floor_no++) {
        if (assertions) printf("floor %d\n", floor_no);
        /* Shop first if we can afford anything, then the boss, then the stairs. */
        walk_to(T_BOX_GOLD, 400);
        walk_to(T_SHOP, 400);
        if (g.scene == SCENE_SHOP) { kit_out(); tap(BTN_B); wear_best(); }
        if (season_over()) break;
        walk_to(T_SHRINE, 400);
        walk_to(T_KIOSK, 400);
        grind_to(floor_no * 3 + 1, 700);
        walk_to(T_SHOP, 400);
        if (g.scene == SCENE_SHOP) { kit_out(); tap(BTN_B); wear_best(); }
        if (g.rage_hunt) walk_to(T_DOWN, 800);
        walk_to(T_SHRINE, 400);
        walk_to(T_BOSS, 600);
        if (g.scene == SCENE_BATTLE) play_battle();
        for (int i = 0; i < 40 && g.scene != SCENE_DUNGEON && !season_over(); i++) tap(BTN_A);
        if (season_over()) break;
        int before = g.dun.index;
        int32_t collapse_at_exit;
        collapse_at_exit = g.dun.collapse;
        walk_to(T_DOWN, 800);
        for (int i = 0; i < 60 && g.scene != SCENE_DUNGEON && !season_over(); i++) tap(BTN_A);
        /*  No per-floor "cleared" assertion any more: the party can descend
            while grinding, so the loop and the floor number stop being in
            lockstep almost immediately. How deep the season got is the
            assertion that means something, and it is made at the end. */
        if (assertions && verbose)
            printf("       floor %d: %ld s of collapse timer left\n",
                   floor_no, (long)(collapse_at_exit / 60));
        (void)before;
        if (g.scene != SCENE_DUNGEON) break;   /* the season ended */
    }

    /*  Let the run settle. With a long budget the loop can stop part way
        through a loot box or a shop, and ending mid-animation is not the same
        thing as being wedged -- which is what the assertion is actually about.
        Anything that will not clear in eighty taps genuinely is stuck. */
    for (int i = 0; i < 80 && g.scene != SCENE_DUNGEON && !season_over(); i++)
        tap(BTN_A);
    for (int i = 0; i < 20 && g.scene != SCENE_DUNGEON && !season_over(); i++)
        tap(BTN_B);
}

/*  Is this floor actually completable? Flood from the entrance and insist
 *  every feature the game needs is standing somewhere the party can reach.
 *  Printing the map with unreachable floor marked is how the three separate
 *  generator bugs behind this were each found. */
static int floor_is_sound(int show) {
    static uint8_t seen[MAP_MAX * MAP_MAX];
    static int16_t qx[MAP_MAX * MAP_MAX], qy[MAP_MAX * MAP_MAX];
    static const int ddx[4] = { 0, 1, 0, -1 }, ddy[4] = { -1, 0, 1, 0 };
    memset(seen, 0, sizeof seen);
    int head = 0, tail = 0;
    qx[tail] = g.dun.px; qy[tail++] = g.dun.py;
    seen[g.dun.py * MAP_MAX + g.dun.px] = 1;
    while (head < tail) {
        int cx = qx[head], cy = qy[head]; head++;
        for (int d = 0; d < 4; d++) {
            int nx = cx + ddx[d], ny = cy + ddy[d];
            if (nx < 0 || ny < 0 || nx >= g.dun.w || ny >= g.dun.h) continue;
            if (seen[ny * MAP_MAX + nx] || dungeon_tile(nx, ny) == T_WALL) continue;
            seen[ny * MAP_MAX + nx] = 1;
            qx[tail] = (int16_t)nx; qy[tail++] = (int16_t)ny;
        }
    }
    if (show) {
        for (int y = 0; y < g.dun.h; y++) {
            for (int x = 0; x < g.dun.w; x++) {
                char t = dungeon_tile(x, y);
                putchar(t != T_WALL && !seen[y * MAP_MAX + x] ? '?' : t);
            }
            putchar('\n');
        }
    }
    int bad = 0;
    for (const char *c = ">bnSR*1234"; *c; c++) {
        int found = 0, reach2 = 0;
        for (int y = 0; y < g.dun.h; y++)
            for (int x = 0; x < g.dun.w; x++)
                if (dungeon_tile(x, y) == *c) {
                    found = 1;
                    if (seen[y * MAP_MAX + x]) reach2 = 1;
                }
        if (!found) { if (show) printf("  MISSING '%c'\n", *c); bad++; }
        else if (!reach2) { if (show) printf("  UNREACHABLE '%c'\n", *c); bad++; }
    }
    return !bad;
}

int main(int argc, char **argv) {
    int bot = 0, runs = 1, want_shots = 0, touch_check = 0, code_check = 0;
    uint32_t map_seed = 0;
    int sweep = 0, profile = 0, gallery = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--bot")) bot = 1;
        else if (!strcmp(argv[i], "--shots") && i + 1 < argc) { shots_dir = argv[++i]; want_shots = 1; }
        else if (!strcmp(argv[i], "--runs") && i + 1 < argc) runs = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--touch")) touch_check = 1;
        else if (!strcmp(argv[i], "--codes")) code_check = 1;
        else if (!strcmp(argv[i], "--map") && i + 1 < argc) map_seed = (uint32_t)atoi(argv[++i]);
        else if (!strcmp(argv[i], "--mapsweep") && i + 1 < argc) sweep = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--profile")) profile = 1;
        else if (!strcmp(argv[i], "--boss-gallery") && i + 1 < argc) {
            shots_dir = argv[++i]; gallery = 1;
        }
        else if (!strcmp(argv[i], "-v")) verbose = 1;
        else { fprintf(stderr, "unknown argument %s\n", argv[i]); return 2; }
    }

    /*  Every boss, in its arena, at the size the renderer actually draws it.
     *
     *  The screenshot tour reaches one boss, and a sprite judged on a
     *  checkerboard at 4x is not the sprite a player sees: it is scaled to a
     *  target height, stood on a platform, framed by a banner and the party's
     *  boxes, and read at a distance. Eleven bosses were redrawn at once, so
     *  this puts each one on the battle screen and photographs it. Not part of
     *  the docs: it writes wherever it is pointed. */
    if (gallery) {
        game_boot();
        g.season = 0x0B05;
        dungeon_enter(0);
        int n = 0;
        for (int d = 0; d < foe_count; d++) {
            if (!foe_defs[d].rank) continue;
            battle_start_foe(d, " blocks the way.");
            idle(30);
            char name[64];
            int k = 0;
            for (const char *c = foe_defs[d].name; *c && k < 60; c++)
                name[k++] = (*c == ' ') ? '-' : (char)(*c | 0x20);
            name[k] = 0;
            shot(name);
            n++;
        }
        printf("boss gallery: %d bosses written to %s\n", n, shots_dir);
        return 0;
    }

    if (want_shots) {
        /* A guided tour: one frame from each scene worth looking at. */
        game_boot();
        rng_seed(7);
        idle(4);
        shot("01-title");
        tap(BTN_A);
        idle(60);
        shot("02-chapter-street");
        /* Walk the chapter, stopping to photograph each backdrop the first
           time it comes up and the first question it asks. */
        {
            int seen[BD_COUNT] = { 0 }, asked = 0;
            for (int i = 0; i < 1200 && g.scene == SCENE_CUTSCENE; i++) {
                if (chapter_asking() && !asked) {
                    asked = 1; idle(2); shot("03-chapter-choice");
                }
                if (g.cut_backdrop < BD_COUNT && !seen[g.cut_backdrop] && g.cut_reveal > 30) {
                    seen[g.cut_backdrop] = 1;
                    idle(2);
                    shot(g.cut_backdrop == BD_COLLAPSE ? "04-chapter-collapse"
                       : g.cut_backdrop == BD_ANNOUNCE ? "05-chapter-system"
                       : g.cut_backdrop == BD_STAIRS   ? "06-chapter-stairs"
                       : g.cut_backdrop == BD_STREET_CAT ? "02b-chapter-cat" : "02c-chapter");
                }
                tap(BTN_A);
            }
        }
        for (int i = 0; i < 900 && g.scene == SCENE_CUTSCENE; i++) tap(BTN_A);
        if (g.scene == SCENE_DRAFT) { idle(6); shot("07-draft"); }
        for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE || g.scene == SCENE_DRAFT); i++) tap(BTN_A);
        /*  Wait for the floor itself rather than shooting on a frame count:
            the opening now hands out achievements, and a toast or a box scene
            landing on the shot frame meant the picture named "the floor" was
            whatever happened to be up. */
        for (int i = 0; i < 300 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
        pause_scene = SCENE_BOX;
        walk_to(T_BOX, 500);
        /*  One shot per beat of the opening, so the animation is something
            that can be looked at rather than taken on trust: it rattles, the
            lid goes, the thing rises, and then the card waits. The last one
            has no timer on it, so idling past it does not close it. */
        if (g.scene == SCENE_BOX) {
            /*  shot() idles twenty frames of its own before it writes, so
                these are the gaps on top of that. The beats are 52, 22 and 32
                frames long, so the captures land at 45 (rattling hard), 65
                (mid burst), 90 (mid rise) and 120 (the card, which waits). */
            idle(25); shot("04-lootbox-shake");
            idle(0);  shot("04b-lootbox-burst");
            idle(5);  shot("04c-lootbox-rise");
            idle(10); shot("04d-lootbox-card");
        }
        pause_scene = SCENE_SAFEROOM;
        for (int i = 0; i < 20 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
        /*  The floor, taken once there is a floor to look at. On the frame the
            party arrive there is one lit stub of corridor on screen and the
            entry achievements stacked over it, which is the least this
            renderer ever has to show. A box later there is a room, a map with
            something on it, and no banners. */
        wait_toasts();
        shot("03-floor");
        walk_to(T_SHRINE, 700);
        if (g.scene == SCENE_SAFEROOM) { idle(8); shot("04b-safe-room"); }
        pause_scene = -1;
        for (int i = 0; i < 20 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
        /* Pace the corridor until something takes an interest. */
        for (int guard = 0; g.scene != SCENE_BATTLE && guard < 400; guard++) {
            if (g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY ||
            g.scene == SCENE_TITLE || g.scene == SCENE_DRAFT) return 0;
        if (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE ||
            g.scene == SCENE_BOX || g.scene == SCENE_LEVELUP ||
                g.scene == SCENE_SHOP || g.scene == SCENE_CODE ||
            g.scene == SCENE_SAFEROOM) { tap(BTN_A); continue; }
            if (g.scene != SCENE_DUNGEON) { tap(BTN_B); continue; }
            tap(BTN_UP);
            if (g.scene == SCENE_DUNGEON && g.dun.steps == (uint16_t)(guard / 4)) tap(BTN_RIGHT);
        }
        if (g.scene == SCENE_BATTLE) {
            idle(40);
            shot("05-battle");
            tap(BTN_A);
            idle(4);
            shot("06-battle-orders");
            play_battle();
        }
        for (int i = 0; i < 20 && g.scene != SCENE_DUNGEON; i++) { shot("07-reward"); tap(BTN_A); }
        tap(BTN_START);
        idle(4);
        shot("08-party");
        g.menu_tab = 2;                 /* the achievement list, which is its own screen now */
        idle(4);
        shot("08b-achievements");
        g.menu_tab = 0;
        tap(BTN_B);
        pause_scene = SCENE_SHOP;
        walk_to(T_SHOP, 400);
        if (g.scene == SCENE_SHOP) shot("09-shop");
        pause_scene = -1;
        tap(BTN_B);
        pause_scene = SCENE_CODE;
        walk_to(T_KIOSK, 400);
        if (g.scene == SCENE_CODE) shot("10-recall-code");
        pause_scene = -1;
        tap(BTN_A);
        pause_scene = SCENE_LEVELUP;
        grind_to(5, 500);
        if (g.scene == SCENE_LEVELUP) shot("11-levelup");
        pause_scene = -1;
        for (int i = 0; i < 30 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
        /*  Only photograph it if it is actually a boss. walk_to stops at the
            first battle, and a wandering encounter on the way to the stairs
            is a battle -- so the picture called "12-boss" was a Sewer Rat the
            moment the RNG sequence shifted under it. Fight the interruption
            off and walk again, with the pause still armed: clearing it here
            is what made the first version of this guard do nothing, because
            walk_to then fought the boss instead of stopping in front of it. */
        pause_scene = SCENE_BATTLE;
        walk_to(T_BOSS, 600);
        for (int tries = 0; tries < 8 && g.scene == SCENE_BATTLE && !g.bat.boss; tries++) {
            play_battle();
            for (int i = 0; i < 40 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
            walk_to(T_BOSS, 600);
        }
        pause_scene = -1;
        if (g.scene == SCENE_BATTLE && g.bat.boss) { idle(30); shot("12-boss"); }
        if (g.scene == SCENE_BATTLE) play_battle();

        /*  The Rage Elemental, photographed on purpose.
         *
         *  Rule 12 releases it and nothing else does, so a screenshot tour
         *  will never wander into one -- which meant the one sprite in the
         *  game that had never been looked at in place was the one drawn
         *  from a reference nobody here can open. Arm the hunt with one step
         *  left, take the step, take the picture, and put the whole game
         *  state back: the tour has a season to finish and a level-93
         *  monster is not survivable at this point, which is the entire
         *  point of it. */
        for (int i = 0; i < 40 && g.scene != SCENE_DUNGEON && !season_over(); i++)
            tap(BTN_A);
        if (g.scene == SCENE_DUNGEON) {
            Game keep = g;
            static const int dirs[4] = { BTN_UP, BTN_RIGHT, BTN_DOWN, BTN_LEFT };
            g.rage_hunt = 1;
            /*  A step into a wall is not a step, and the hunt only counts
                down on ones that happen -- so cycle the facings rather than
                pressing UP four times into the same corner. */
            for (int i = 0; i < 12 && g.scene == SCENE_DUNGEON; i++)
                tap(dirs[i & 3]);
            if (g.scene == SCENE_BATTLE) { idle(30); shot("13-rage"); }
            g = keep;
        }
        for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE || g.scene == SCENE_DRAFT); i++)
            tap(BTN_A);
        /* Run the rest of the game out for the closing screen. */
        for (int floor_no = g.dun.index + 1; floor_no <= FLOORS; floor_no++) {
            grind_to(floor_no * 3 + 1, 700);
            if (g.rage_hunt) walk_to(T_DOWN, 800);
            walk_to(T_BOSS, 600);
            if (g.scene == SCENE_BATTLE) play_battle();
            for (int i = 0; i < 40 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
            walk_to(T_DOWN, 800);
            for (int i = 0; i < 60 && g.scene != SCENE_DUNGEON && !season_over(); i++) tap(BTN_A);
            if (g.scene == SCENE_VICTORY) break;
        }
        /*  The endings, shot deliberately rather than hoped for. Both used to
            depend on the bot reaching them inside the tour -- which it stopped
            doing -- so the files sat in docs for days showing a build with an
            achievement in it that no longer exists. A screenshot tour is
            documenting a screen, not asserting a playthrough, so it is allowed
            to put the game in the state it wants to photograph. */
        {
            /*  A fight, held at the point where it is asking for orders. */
            if (g.scene != SCENE_DUNGEON) { g.scene = SCENE_DUNGEON; }
            battle_start(0);
            idle(40);
            shot("05-battle");                 /* the opening, message still up */
            for (int i = 0; i < 400 && g.bat.phase != BAT_CHOOSE; i++) tap(BTN_A);
            if (g.bat.phase == BAT_CHOOSE) { idle(4); shot("06-battle-orders"); }

            /*  The shop, which only exists from the second floor down now that
                the first one pays in rations rather than gold. */
            g.scene = SCENE_DUNGEON;
            if (g.dun.index == 0) dungeon_enter(1);
            g.gold = 320;
            game_set_scene(SCENE_SHOP);
            idle(8);
            shot("09-shop");

            /*  Spending a level, with points actually owed. */
            g.hero[0].points = 2;
            game_set_scene(SCENE_LEVELUP);
            idle(8);
            shot("11-levelup");

            /*  Clear anything the staged screens left on the toast queue: an
                ending screen photographed with "not enough gold" across it is
                a picture of the tour, not of the game. */
            memset(g.toast, 0, sizeof g.toast);
            g.scene = SCENE_VICTORY;
            idle(6);
            shot("14-victory");
            memset(g.toast, 0, sizeof g.toast);
            g.scene = SCENE_GAMEOVER;
            idle(6);
            shot("15-season-over");
        }

        /*  Every shot the README shows has to have been written by this run.
            Anything missing is a picture of a game that no longer exists. */
        {
            static const char *const kWanted[] = {
                "01-title", "02-chapter-street", "03-floor", "04-lootbox-shake",
                "04b-safe-room", "05-battle", "06-battle-orders", "07-draft",
                "08-party", "08b-achievements", "09-shop", "10-recall-code",
                "11-levelup", "12-boss", "13-rage", "14-victory",
                "15-season-over",
            };
            int missing = 0;
            for (size_t i = 0; i < sizeof kWanted / sizeof kWanted[0]; i++) {
                char path[256];
                snprintf(path, sizeof path, "%s/%s.png", shots_dir, kWanted[i]);
                FILE *f = fopen(path, "rb");
                if (f) { fclose(f); continue; }
                printf("  MISSING %s\n", kWanted[i]);
                missing++;
            }
            if (missing) {
                printf("%d screenshot(s) the docs reference were not written\n", missing);
                return 1;
            }
        }
        printf("screenshots written to %s\n", shots_dir);
        return 0;
    }

    if (code_check) {
        /* A code is only a save if it survives the round trip. Play a while,
           print the code, wipe the run, type it back in, compare. */
        int bad = 0;
        for (int seed = 0; seed < 6; seed++) {
            play_run(400 + seed * 131, 0);
            int floor_index = g.dun.index, carl = g.hero[0].level, donut = g.hero[1].level;
            int gold = g.gold, fights = g.battles_won;
            uint32_t flags = g.flags, achievements = g.achievements;
            char code[24];
            save_make_code(code);

            game_boot();
            if (!save_apply_code(code)) { printf("  FAIL %s did not parse\n", code); bad++; continue; }
            int same = g.dun.index == floor_index && g.hero[0].level == carl &&
                       g.hero[1].level == donut && g.battles_won == (uint16_t)(fights > 127 ? 127 : fights) &&
                       g.flags == (flags & 0xFFF) &&
                       /*  Lossless now: the earned achievements go in the code
                           and the six the draft decides are rebuilt from the
                           crawler pair, so nothing is truncated away. */
                       g.achievements == achievements &&
                       g.gold / 8 == gold / 8;
            printf("  %s %s -> floor %d, Carl %d, Donut %d, %d gold\n",
                   same ? "ok  " : "FAIL", code, g.dun.index + 1, g.hero[0].level,
                   g.hero[1].level, g.gold);
            if (!same)
                printf("       floor %d/%d carl %d/%d donut %d/%d fights %u/%d "
                       "flags %08X/%08X ach %08X/%08X gold %d/%d\n",
                       g.dun.index, floor_index, g.hero[0].level, carl,
                       g.hero[1].level, donut, (unsigned)g.battles_won, fights,
                       g.flags, flags & 0xFFF, g.achievements, achievements,
                       g.gold, gold);
            if (!same) bad++;

            /* A code with a character knocked out of it must be refused. */
            char broken[24];
            memcpy(broken, code, sizeof broken);
            broken[5] = broken[5] == 'A' ? 'B' : 'A';
            game_boot();
            if (save_apply_code(broken)) { printf("  FAIL %s was accepted\n", broken); bad++; }
        }
        /*  The format round-trip above proved the encoder agrees with the
            decoder, and the feature was still completely broken: the kiosk
            printed sixteen of twenty characters and the keyboard refused the
            last four, so no code the game produced could be typed back in.
            This walks the path a player actually walks. */
        {
            game_boot();
            play_run(4242, 0);
            save_make_code(g.code);
            char code[32];
            memcpy(code, g.code, sizeof code - 1);
            code[sizeof code - 1] = 0;

            int printed = 0;
            for (int line = 0; line * CODE_PER_ROW < CODE_CHARS; line++) {
                char row[32];
                int from = line * CODE_PER_ROW;
                int count = CODE_CHARS - from;
                if (count > CODE_PER_ROW) count = CODE_PER_ROW;
                printed += code_format(row, code, from, count, '-') -
                           (count - 1) / CODE_GROUP;
            }
            if (printed != CODE_CHARS) {
                printf("  FAIL the kiosk shows %d of %d characters\n", printed, CODE_CHARS);
                bad++;
            } else printf("  ok   the kiosk shows all %d characters\n", CODE_CHARS);

            /*  Type it, one key at a time, through the same cap the keyboard
                applies -- then hand the result to the decoder. */
            char typed[32];
            int n = 0;
            for (int i = 0; code[i] && n < CODE_CHARS; i++) typed[n++] = code[i];
            typed[n] = 0;
            if (n != CODE_CHARS) {
                printf("  FAIL the keyboard accepts %d of %d characters\n", n, CODE_CHARS);
                bad++;
            } else printf("  ok   the keyboard accepts all %d characters\n", CODE_CHARS);

            game_boot();
            if (!save_apply_code(typed)) {
                printf("  FAIL a code typed exactly as printed was rejected\n");
                bad++;
            } else printf("  ok   a code typed exactly as printed restores the run\n");
        }
        printf("%s: %d bad\n", bad ? "FAILED" : "passed", bad);
        return bad ? 1 : 0;
    }

    if (sweep) {
        /* Every season has to be finishable. A layout that looks fine and has
           its stairs behind a wall is a dead run, and it is exactly the kind
           of thing a generator produces once in a few hundred tries — too
           rare to meet by playing, certain to be met by somebody. */
        int bad = 0;
        for (int s2 = 1; s2 <= sweep; s2++) {
            game_boot();
            g.season = (uint32_t)s2;
            for (int f = 0; f < FLOORS; f++) {
                dungeon_enter(f);
                if (!floor_is_sound(0)) {
                    printf("  FAIL season seed %d floor %d is not completable\n", s2, f + 1);
                    bad++;
                }
            }
        }
        printf("  %s %d season seeds generate completable floors\n",
               bad ? "FAIL" : "ok  ", sweep);
        return bad ? 1 : 0;
    }

    if (profile) {
        /*  How long the dungeon view takes, per stage, on a fixed floor at a
         *  fixed spot.
         *
         *  The ROM harness cannot answer this. The season seed is mixed from
         *  g.frame at the moment NEW SEASON is pressed, and g.frame depends on
         *  how fast frames are rendering -- so every ablation build gets a
         *  *different dungeon*, with different walls and lamps on screen, and
         *  the thing being measured changes with the thing being tested. That
         *  is how a build with less work in it measured slower than the
         *  baseline. Here the season is pinned, the party is put on a known
         *  tile, and the same frame is drawn ten thousand times.
         *
         *  Stages are removed at compile time (ABL_NO*) and the whole draw is
         *  timed each way, rather than timing from inside: a timer around a
         *  stage measures the timer as much as the stage when the stage is a
         *  few thousand cycles.
         */
        game_boot();
        g.season = 0x1BAD;
        dungeon_enter(0);
        /*  Somewhere with walls, floor and a lamp in view rather than the
            entrance stub, so the measurement is of a representative frame. */
        walk_to(T_KIOSK, 400);        /* stands it next to a lamp */
        Surface top = gfx_surface(SCREEN_TOP);
        const int N = 10000;
        /*  Warm the caches and the corner grid so the first iteration is not
            paying for everyone. */
        for (int i = 0; i < 50; i++) view2d_draw(&top);
        clock_t t0 = clock();
        for (int i = 0; i < N; i++) view2d_draw(&top);
        clock_t t1 = clock();
        double us = (double)(t1 - t0) * 1e6 / CLOCKS_PER_SEC / N;
        printf("view2d_draw  %8.2f us/frame   (season %d floor 1 at %d,%d, %d steps in)\n",
               us, game_season_number(), g.dun.px, g.dun.py, g.dun.steps);
        return 0;
    }

    if (map_seed) {
        game_boot();
        g.season = map_seed;
        int bad = 0;
        for (int f = 0; f < FLOORS; f++) {
            dungeon_enter(f);
            printf("--- season %d floor %d  (%dx%d)  start %d,%d\n",
                   game_season_number(), f + 1, g.dun.w, g.dun.h, g.dun.px, g.dun.py);
            for (int r = 0; r < g.dun.n_rooms; r++)
                printf("    room %d at %d,%d  %s\n", r, g.dun.room_x[r], g.dun.room_y[r],
                       zone_defs[g.dun.room_zone[r]].name);
            if (!floor_is_sound(1)) bad++;
        }
        printf("%s\n", bad ? "FLOOR CHECK FAILED" : "all features present and reachable");
        return bad ? 1 : 0;
    }

    if (touch_check) {
        /* Confirms the touch layout is wired up without an emulator in the way. */
        game_boot();
        idle(2);
        input.touching = input.touch_pressed = 1;
        /*  Read off the layout, for the same reason the pad below does: this
            was a hard-coded 128,130 and when the title buttons moved up it
            landed in the gap between them, so the test failed on a tap that
            a player would never have made. */
        input.touch_x = (int16_t)(kTitleOpts[0].x + kTitleOpts[0].w / 2);
        input.touch_y = (int16_t)(kTitleOpts[0].y + kTitleOpts[0].h / 2);
        step();
        printf("  title tap -> scene %d\n", g.scene);
        for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE || g.scene == SCENE_DRAFT); i++) tap(BTN_A);
        int before = g.dun.steps;
        for (int i = 0; i < 3; i++) {
            input.touching = input.touch_pressed = 1;
            /*  The pad is four absolute directions now, so tapping a fixed one
                proves nothing: it might be a wall. The party always spawns
                facing somewhere walkable, so tap that. Read off the layout, so
                moving a button cannot silently break the test for buttons. */
            static const int kPadForFacing[4] = { 0, 3, 1, 2 };   /* N E S W */
            const Rect *pad = &kDunPad[kPadForFacing[g.dun.facing & 3]];
            input.touch_x = (int16_t)(pad->x + pad->w / 2);
            input.touch_y = (int16_t)(pad->y + pad->h / 2);
            step();
            idle(2);
        }
        printf("  pad taps -> steps %d (was %d), scene %d\n", g.dun.steps, before, g.scene);
        int fail = (g.dun.steps > before) ? 0 : 1;

        /*  A loot box has to wait to be dismissed.
         *
         *  It used to close itself after sixty frames -- one second to read a
         *  name, an effect line and a description -- so the screen took itself
         *  away mid-sentence. That is the sort of thing that comes back the
         *  moment somebody adds a timer for the animation and reaches for the
         *  same variable, so it is asserted rather than eyeballed: run the
         *  opening well past every beat, and the card must still be up. */
        game_open_box(0);
        idle(400);
        if (g.scene != SCENE_BOX || g.box_phase != BOX_CARD) {
            printf("  box card -> scene %d phase %d (wanted the card, still up)\n",
                   g.scene, g.box_phase);
            fail = 1;
        } else {
            printf("  box card -> still up after 400 frames\n");
        }
        /*  ...and a tap has to be what closes it. */
        input.touching = input.touch_pressed = 1;
        input.touch_x = 128; input.touch_y = 176;
        step();
        idle(2);
        if (g.scene == SCENE_BOX) {
            printf("  box card -> tap did not close it\n");
            fail = 1;
        } else {
            printf("  box card -> a tap closed it\n");
        }
        /*  Bosses open up, the opening can be taken, and taking it kills
         *  them outright.
         *
         *  This mechanic is invisible from outside: a boss that never raises
         *  its tell, or one whose opening cannot be answered, reads exactly
         *  like a boss with a lot of health, and nothing else in the suite
         *  would notice.
         *
         *  Every boss, not one. The old version of this drove whatever
         *  battle_start(2) happened to pick for one season seed -- it printed
         *  "The Juicer wants 2" and proved nothing whatever about the other
         *  thirteen rows or about three of the four answers. battle_start_foe
         *  puts any of them on the screen directly, so the table is checked
         *  against the code rather than sampled.
         *
         *  The party guards while the opening is down, and is topped up every
         *  turn. Both matter: guarding does the boss no damage, so its health
         *  bar is still full when the answer lands, and a kill at full health
         *  is the only thing that distinguishes an instant kill from chip
         *  damage that happened to finish. Against the quarter-health version
         *  this fought before, every row here fails.
         *
         *  White-box on purpose -- the cursor is set directly rather than
         *  simulating menu navigation, because what is under test is whether
         *  the answer kills the boss, not whether a d-pad can reach it. */
        {
            printf("== every boss opens up, and the opening kills it\n");
            g.season = 0x1BAD;
            dungeon_enter(0);
            int checked = 0, kinds[5] = { 0, 0, 0, 0, 0 };
            for (int d = 0; d < foe_count; d++) {
                int weak = foe_defs[d].weak;
                if (!weak) continue;
                battle_start_foe(d, " blocks the way.");
                const char *bname = foe_defs[d].name;
                int full = g.bat.foes[0].hp_max;
                int saw_tell = 0, hp_at_answer = -1, answer_t = -1;

                for (int t = 0; t < 8000 && g.scene == SCENE_BATTLE; t++) {
                    /*  Stop shortly after the first answer, not at the end of
                        the fight. Letting the loop run on is how the first
                        cut of this passed thirteen bosses against the old
                        quarter-health hit: they died eventually, off the
                        fourth opening, and "dead by the end" cannot tell that
                        apart from dead on the answer. */
                    if (answer_t >= 0 && t - answer_t > 300) break;
                    if (g.bat.tell) saw_tell = 1;
                    for (int h = 0; h < PARTY; h++) {
                        g.hero[h].mp = g.hero[h].mp_max;
                        g.hero[h].hp = g.hero[h].hp_max;
                    }
                    if (g.bat.phase == BAT_CHOOSE && g.bat.actor < PARTY) {
                        /*  GUARD while it is closed: anything else chips the
                            health bar and ruins the measurement. */
                        int want = 2;
                        if (g.bat.tell) {
                            want = weak == WEAK_ITEM ? 1 : weak == WEAK_GUARD ? 2 : 0;
                            if (hp_at_answer < 0) {
                                hp_at_answer = g.bat.foes[0].hp;
                                answer_t = t;
                            }
                        }
                        input.touching = input.touch_pressed = 1;
                        input.touch_x = (int16_t)(kBatCommands[want].x + 8);
                        input.touch_y = (int16_t)(kBatCommands[want].y + 8);
                        step();
                        continue;
                    }
                    if (g.bat.phase == BAT_SKILL) {
                        const SkillDef *sk[8];
                        int n = game_hero_skills(g.bat.actor, sk, 8);
                        int pick = -1;
                        if (g.bat.tell && weak == WEAK_MOVE) {
                            for (int i = 0; i < n; i++)
                                if (sk[i]->cost > 0 && g.hero[g.bat.actor].mp >= sk[i]->cost) {
                                    pick = i; break;
                                }
                            if (pick < 0) {
                                printf("  FAIL %-20s no stamina move to answer with\n", bname);
                                fail = 1;
                            }
                        }
                        g.bat.cursor = (uint8_t)(pick < 0 ? 0 : pick);
                        tap(BTN_A);
                        continue;
                    }
                    tap(BTN_A);
                }

                int dead = !g.bat.foes[0].alive || g.bat.foes[0].hp <= 0;
                int at_full = hp_at_answer >= full;
                if (!saw_tell) {
                    printf("  FAIL %-20s never opened up\n", bname);
                    fail = 1;
                } else if (!dead) {
                    printf("  FAIL %-20s answered at %d/%d, still standing on %d\n",
                           bname, hp_at_answer, full, g.bat.foes[0].hp);
                    fail = 1;
                } else if (!at_full) {
                    /*  Died, but had already been worn down -- so this row
                        does not show an instant kill and must not pass as
                        one. */
                    printf("  FAIL %-20s died from %d/%d, not from full\n",
                           bname, hp_at_answer, full);
                    fail = 1;
                } else {
                    kinds[weak]++;
                    checked++;
                }
            }
            printf("  boss tells -> %d bosses killed outright from full health"
                   " (hit %d, move %d, guard %d, item %d)\n",
                   checked, kinds[WEAK_HIT], kinds[WEAK_MOVE],
                   kinds[WEAK_GUARD], kinds[WEAK_ITEM]);
            /*  All four answers have to be represented, or a whole branch of
                tell_answered is going untested behind a green line. */
            if (!kinds[WEAK_HIT] || !kinds[WEAK_MOVE] ||
                !kinds[WEAK_GUARD] || !kinds[WEAK_ITEM]) {
                printf("  boss tells -> an answer kind was never exercised\n");
                fail = 1;
            }
        }
        /*  Killing things fills the quadrant with grubs, and the grubs turn
         *  up. Another mechanic with no visible surface: if the counter never
         *  rises, or rises but never reaches a fight, the game plays exactly
         *  as it did before and no other check notices. */
        {
            g.season = 0x1BAD;
            dungeon_enter(0);
            if (g.grubs != 0) { printf("  grubs -> a new floor started dirty\n"); fail = 1; }
            g.grubs = GRUB_SWARM;                 /* as if the party had cleared out */
            int with_grubs = 0;
            for (int t = 0; t < 40 && !with_grubs; t++) {
                battle_start(0);
                for (int i = 0; i < g.bat.n_foes; i++)
                    if (g.bat.foes[i].def == foe_grub()) with_grubs = 1;
            }
            printf("  grubs -> at pressure %d they %s\n", GRUB_SWARM,
                   with_grubs ? "turn up" : "NEVER turn up");
            if (!with_grubs) fail = 1;

            /*  ...and a clean quadrant should not be sending them at all. */
            g.grubs = 0;
            int clean = 0;
            for (int t = 0; t < 40; t++) {
                battle_start(0);
                for (int i = 0; i < g.bat.n_foes; i++)
                    if (g.bat.foes[i].def == foe_grub()) clean++;
            }
            /*  Not zero-tolerance: foe_pick can legitimately roll a grub as a
                wandering mob. But at pressure zero they must be rare. */
            printf("  grubs -> clean quadrant sent %d in 40 fights\n", clean);
            if (clean > 12) { printf("  grubs -> too many with no pressure\n"); fail = 1; }

            /*  Taking the stairs leaves them behind. */
            g.grubs = GRUB_PUPA;
            dungeon_enter(1);
            if (g.grubs != 0) { printf("  grubs -> stairs did not clear them\n"); fail = 1; }
            else printf("  grubs -> the stairs leave them behind\n");
        }

        /*  The content tables have to be internally consistent.
         *
         *  Nothing here is clever; it is the class of bug that takes the
         *  whole game down rather than making it play badly, and none of it
         *  was checked. A sprite index off the end of sprite_table is an
         *  out-of-bounds read on every frame the foe is on screen, and
         *  foe_boss returning a junk index for one floor out of eighteen is a
         *  crash nobody meets until they get that far. */
        {
            printf("== the content tables agree with themselves\n");
            int bad = 0;
            for (int i = 0; i < foe_count; i++) {
                const FoeDef *d = &foe_defs[i];
                /*  Unsigned, so only the upper bound can be wrong -- the
                    compiler said so when this was written with a < 0 in it. */
                if (d->sprite >= SPR_COUNT) {
                    printf("  FAIL %s: sprite %d outside the table\n", d->name, d->sprite);
                    bad++;
                } else if (!sprite_table[d->sprite]) {
                    printf("  FAIL %s: sprite %d is null\n", d->name, d->sprite);
                    bad++;
                }
                if (!d->name || !d->name[0]) { printf("  FAIL foe %d has no name\n", i); bad++; }
                if (d->hp < 1) { printf("  FAIL %s has %d hp\n", d->name, d->hp); bad++; }
                /*  A tell with no weakness never gets read out, and a
                    weakness with no tell is an opening the player cannot
                    see -- either way the pair is half-wired. */
                if (!!d->weak != !!d->tell) {
                    printf("  FAIL %s: weak=%d tell=%s -- half a mechanic\n",
                           d->name, d->weak, d->tell ? d->tell : "(none)");
                    bad++;
                }
            }
            for (int i = 0; i < item_count; i++)
                if (!item_defs[i].name || !item_defs[i].name[0]) {
                    printf("  FAIL item %d has no name\n", i); bad++;
                }
            /*  Every floor has to be able to name both its bosses. */
            for (int f = 1; f <= FLOORS; f++) {
                int b = foe_boss(f), nb = foe_nboss(f);
                if (b < 0 || b >= foe_count || !foe_defs[b].rank) {
                    printf("  FAIL floor %d: foe_boss -> %d\n", f, b); bad++;
                }
                if (nb < 0 || nb >= foe_count || !foe_defs[nb].rank) {
                    printf("  FAIL floor %d: foe_nboss -> %d\n", f, nb); bad++;
                }
            }
            printf("  tables -> %d foes, %d items, %d floors of bosses, %d problems\n",
                   foe_count, item_count, FLOORS, bad);
            if (bad) fail = 1;
        }

        /*  The descent has to sell you something.
         *
         *  Gear used to be five pieces, every one of them buyable on floor
         *  one: the shop stocked anything under 500 gold regardless of depth,
         *  and the best loot box paid out the same Fire Axe Handle. Runs were
         *  finishing on twenty thousand gold with nothing to spend it on, so
         *  fifteen of the eighteen floors had no economy at all. */
        {
            printf("== the shop keeps up with the descent\n");
            /*  MAX_STOCK, not a roomier local array. The first version of
                this declared stock[64] while both real call sites passed
                INVENTORY -- twelve -- so the test measured a shop the game
                never draws and reported nineteen lines on floor eighteen
                while the ROM was truncating to twelve. A harness that gives
                itself a bigger buffer than the program is testing a program
                that does not exist. */
            int stock[MAX_STOCK];
            if (item_count - 1 > MAX_STOCK) {
                printf("  FAIL %d purchasable items will not fit %d stock slots\n",
                       item_count - 1, MAX_STOCK);
                fail = 1;
            }
            int first = shop_stock(1, stock, MAX_STOCK);
            int last = shop_stock(FLOORS, stock, MAX_STOCK);
            int prev = first, monotonic = 1;
            for (int f = 2; f <= FLOORS; f++) {
                int n = shop_stock(f, stock, MAX_STOCK);
                if (n < prev) monotonic = 0;
                prev = n;
            }
            printf("  shop -> %d lines on floor 1, %d on floor %d\n", first, last, FLOORS);
            if (!monotonic) {
                printf("  FAIL stock shrank on the way down\n"); fail = 1;
            }
            if (last <= first) {
                printf("  FAIL floor %d sells nothing floor 1 did not\n", FLOORS); fail = 1;
            }
            /*  Every piece of gear has to become reachable somewhere, or it is
                a row in a table that no player can ever hold. */
            int unreachable = 0;
            for (int i = 1; i < item_count; i++) {
                if (item_defs[i].kind < IT_WEAPON) continue;
                int seen = 0, n = shop_stock(FLOORS, stock, MAX_STOCK);
                for (int k = 0; k < n; k++) if (stock[k] == i) seen = 1;
                if (!seen) {
                    printf("  FAIL %s is never in stock\n", item_defs[i].name);
                    unreachable++;
                }
            }
            if (unreachable) fail = 1;
            /*  And the deep gear must actually be strong enough to be worth
                the walk -- a tier that adds nothing is decoration. */
            int best_early = 0, best_late = 0;
            for (int i = 1; i < item_count; i++) {
                const ItemDef *d = &item_defs[i];
                if (d->kind != IT_WEAPON) continue;
                if (d->floor <= 2 && d->power > best_early) best_early = d->power;
                if (d->power > best_late) best_late = d->power;
            }
            printf("  gear -> best weapon on floor 1-2 is +%d, deepest is +%d\n",
                   best_early, best_late);
            if (best_late < best_early * 2) {
                printf("  FAIL the gear curve is too flat to matter\n"); fail = 1;
            }
            /*  Priced against what a run of that depth is actually carrying,
                which is not the same as what it finishes with. Seeded runs
                hold about 2,400 gold by their second floor and 6,000 by their
                third -- the end-of-run figure of twenty thousand is a late
                spike and was the wrong number to price a mid-run shop
                against. Each tier has to be affordable near where it unlocks,
                or it is a row nobody buys. */
            static const struct { int floor; int purse; } kSeen[] = {
                { 2, 2400 }, { 3, 6000 }, { 5, 6000 }, { 9, 6000 }, { 13, 6000 },
            };
            for (size_t k = 0; k < sizeof kSeen / sizeof kSeen[0]; k++) {
                int n2 = shop_stock(kSeen[k].floor, stock, MAX_STOCK), afford = 0;
                for (int i = 0; i < n2; i++)
                    if (item_defs[stock[i]].kind >= IT_WEAPON &&
                        item_defs[stock[i]].price <= kSeen[k].purse) afford++;
                printf("  purse -> floor %2d with %d gold can afford %d of the gear on sale\n",
                       kSeen[k].floor, kSeen[k].purse, afford);
                if (!afford) {
                    printf("  FAIL nothing on floor %d is affordable at that depth\n",
                           kSeen[k].floor);
                    fail = 1;
                }
            }
        }

        /*  Tap the map and the party walks there.
         *
         *  Driven through real touch coordinates on the map panel, the way a
         *  stylus would, not through dungeon_route directly. And the marker is
         *  read back out of the rendered bottom screen and fed to the picker:
         *  a renderer and a picker that disagreed about the camera would put
         *  the marker on one square and walk the party to another, and the
         *  only way to see that is to look at what was drawn. */
        {
            printf("== tap the map to walk\n");
            /*  The walk, its marker and the zoom button all draw on the
                console, which has a signature of its own; watch it. */
            memset(stale, 0, sizeof stale);
            memset(stale_age, 0, sizeof stale_age);
            stale_on = 1;
            g.season = 0x7A95;
            game_set_scene(SCENE_DUNGEON);
            dungeon_enter(0);
            idle(20);
            /*  Reveal the floor so there is somewhere to tap, and keep the
                corridor quiet so a wandering fight does not end the walk for
                a reason unrelated to the walk. */
            for (int y = 0; y < g.dun.h; y++)
                for (int x = 0; x < g.dun.w; x++) dungeon_mark_seen(x, y);
            g.dun.steps_to_encounter = 60000;

            /*  The farthest square on screen the router will take them to. */
            int cell = dungeon_map_cell(), cx, cy, cols, rows;
            dungeon_map_view(kDunMap.w, kDunMap.h, &cx, &cy, &cols, &rows);
            int best = -1, bx = 0, by = 0;
            for (int j = 0; j < rows; j++)
                for (int i = 0; i < cols; i++) {
                    int mx = cx + i, my = cy + j;
                    if (dungeon_tile(mx, my) != T_FLOOR) continue;
                    if (dungeon_route(mx, my) < 0) continue;
                    int d = abs(mx - g.dun.px) + abs(my - g.dun.py);
                    if (d > best) { best = d; bx = mx; by = my; }
                }
            int sx = kDunMap.x + 2 + (bx - cx) * cell + cell / 2;
            int sy = kDunMap.y + 2 + (by - cy) * cell + cell / 2;
            int from_x = g.dun.px, from_y = g.dun.py;

            /*  Every square that would go off if stood on, as it is now: a box
                is spent the frame it is stepped on, so asking afterwards
                whether it was used would always say yes. */
            static uint8_t armed[MAP_MAX * MAP_MAX];
            for (int y = 0; y < g.dun.h; y++)
                for (int x = 0; x < g.dun.w; x++) {
                    char t = dungeon_tile(x, y);
                    armed[y * MAP_MAX + x] =
                        (t == T_DOWN || t == T_SHOP || t == T_KIOSK) ||
                        ((t == T_BOSS || t == T_NBOSS || t == T_BOX ||
                          t == T_BOX_GOLD || t == T_SHRINE) && !dungeon_is_used(x, y));
                }

            /*  A floor narrower than the panel is centred in it, and the
                margin either side is not ground: a tap there goes nowhere. */
            if (cx < 0) {
                input.touching = input.touch_pressed = 1;
                input.touch_x = (int16_t)(kDunMap.x + 2 + cell / 2);
                input.touch_y = (int16_t)sy;
                step();
                printf("  map walk -> floor is %d wide in a %d-cell panel, %d cells of margin; "
                       "a tap there %s\n", g.dun.w, cols, -cx,
                       g.dun.goal ? "SETS A GOAL" : "does nothing");
                if (g.dun.goal) {
                    printf("  FAIL a tap off the edge of the floor started a walk\n");
                    fail = 1;
                }
            } else {
                printf("  FAIL expected floor 1 to be narrower than the map panel\n");
                fail = 1;
            }

            input.touching = input.touch_pressed = 1;
            input.touch_x = (int16_t)sx;
            input.touch_y = (int16_t)sy;
            step();

            /*  Find the goal marker in what was drawn -- a square frame whose
                four corners share one colour -- and ask the picker what is
                under its middle. */
            {
                const uint16_t *bot = plat_screen(SCREEN_BOTTOM);
                int e = cell + 1, found = 0, gx = -1, gy = -1;
                for (int y = kDunMap.y; y + e < kDunMap.y + kDunMap.h && !found; y++)
                    for (int x = kDunMap.x; x + e < kDunMap.x + kDunMap.w && !found; x++) {
                        uint16_t c = bot[y * SCREEN_W + x];
                        if (c != C_AMBER && c != C_GOLD) continue;
                        if (bot[y * SCREEN_W + x + e] != c || bot[(y + e) * SCREEN_W + x] != c ||
                            bot[(y + e) * SCREEN_W + x + e] != c ||
                            bot[y * SCREEN_W + x + e / 2] != c) continue;
                        int mx, my;
                        if (dungeon_map_pick(x + 1 + cell / 2, y + 1 + cell / 2, kDunMap.x,
                                             kDunMap.y, kDunMap.w, kDunMap.h, &mx, &my)) {
                            gx = mx;
                            gy = my;
                        }
                        found = 1;
                    }
                printf("  map walk -> the marker is drawn over (%d,%d)\n", gx, gy);
                if (gx != bx || gy != by) {
                    printf("  FAIL the marker is not on the square that was tapped\n");
                    fail = 1;
                }
            }

            int trod_on_trigger = 0, frames = 0;
            for (; frames < 4000 && g.dun.goal && g.scene == SCENE_DUNGEON; frames++) {
                step();
                if (!(g.dun.px == bx && g.dun.py == by) &&
                    armed[g.dun.py * MAP_MAX + g.dun.px])
                    trod_on_trigger = 1;
            }
            idle(WALK_FRAMES + 2);
            printf("  map walk -> tapped (%d,%d) at screen (%d,%d); walked from (%d,%d) "
                   "to (%d,%d) in %d frames\n", bx, by, sx, sy, from_x, from_y,
                   g.dun.px, g.dun.py, frames);
            if (best < 3) {
                printf("  FAIL nothing far enough away to make this a real walk\n");
                fail = 1;
            } else if (g.dun.px != bx || g.dun.py != by) {
                printf("  FAIL the party did not end on the square that was tapped\n");
                fail = 1;
            }
            if (trod_on_trigger) {
                printf("  FAIL the route stepped on something that goes off\n");
                fail = 1;
            }

            /*  A d-pad press takes the character back mid-route. */
            input.touching = input.touch_pressed = 1;
            input.touch_x = (int16_t)(kDunMap.x + 2 + (from_x - cx) * cell + cell / 2);
            input.touch_y = (int16_t)(kDunMap.y + 2 + (from_y - cy) * cell + cell / 2);
            step();
            int was = g.dun.goal;
            idle(WALK_FRAMES);
            tap(BTN_LEFT);
            printf("  map walk -> a d-pad press %s the route\n",
                   was && !g.dun.goal ? "cancels" : "DOES NOT cancel");
            if (!was || g.dun.goal) {
                printf("  FAIL a route kept walking under the player's own d-pad press\n");
                fail = 1;
            }

            /*  The zoom used to live in bit 0 of menu_cursor, which the party
                menu moves as a cursor. Open it, move the cursor an odd number
                of times, come back, and the map had changed size. */
            int before = dungeon_map_cell();
            input.touching = input.touch_pressed = 1;
            input.touch_x = (int16_t)(kDunActions[2].x + kDunActions[2].w / 2);
            input.touch_y = (int16_t)(kDunActions[2].y + kDunActions[2].h / 2);
            step();
            idle(1);
            int zoomed = dungeon_map_cell();
            tap(BTN_START);
            tap(BTN_DOWN);
            tap(BTN_B);
            idle(2);
            printf("  map zoom -> %d px to %d px, %d px after a trip through the party menu\n",
                   before, zoomed, dungeon_map_cell());
            if (zoomed == before) {
                printf("  FAIL the zoom button does not change the map\n");
                fail = 1;
            }
            if (g.scene != SCENE_DUNGEON || dungeon_map_cell() != zoomed) {
                printf("  FAIL the party menu changed the map's zoom\n");
                fail = 1;
            }
            /*  And a zoom that changes the number but not the picture is the
                same bug from the other side: the console has its own
                signature, and zoom was once in the main one only. The map
                has to change on the frame the button is pressed. */
            {
                /*  Past the fade back from the menu first: it redraws the
                    console every frame, and would carry a zoom that the
                    signature had forgotten. And halfway between the ticks of
                    the console's own blink, which redraws it every sixteen
                    frames -- the first version of this pressed on one. */
                idle(30);
                while ((g.anim & 15) != 6) idle(1);
                static uint16_t before_px[SCREEN_W * SCREEN_H];
                memcpy(before_px, shown[1], sizeof before_px);
                input.touching = input.touch_pressed = 1;
                input.touch_x = (int16_t)(kDunActions[2].x + kDunActions[2].w / 2);
                input.touch_y = (int16_t)(kDunActions[2].y + kDunActions[2].h / 2);
                step();
                int changed = 0;
                for (int y = kDunMap.y; y < kDunMap.y + kDunMap.h; y++)
                    for (int x = kDunMap.x; x < kDunMap.x + kDunMap.w; x++)
                        changed += shown[1][y * SCREEN_W + x] != before_px[y * SCREEN_W + x];
                printf("  map zoom -> %d px of the map changed on the frame it was pressed\n",
                       changed);
                if (changed < 100) {
                    printf("  FAIL the zoom button does not redraw the map\n");
                    fail = 1;
                }
            }
            idle(40);
            stale_on = 0;
            for (int sc = 0; sc < SCENE_COUNT; sc++)
                for (int k = 0; k < 3; k++)
                    if (stale[sc][k].worst > STALE_MAX_LAG) {
                        printf("  FAIL screen %d in scene %d stayed behind the game for %d "
                               "frames\n", k, sc, stale[sc][k].worst);
                        fail = 1;
                    }
            memset(stale, 0, sizeof stale);
        }

        /*  Every achievement arrives with its whole name. The toast holds
            thirty-seven characters and used to spend thirteen of them on
            "Achievement: ", which cut the show's longest titles short. */
        {
            printf("== achievement toasts carry the whole name\n");
            int cut = 0;
            /*  Awarding pays out gold and boxes; put them back after. */
            uint32_t had = g.achievements;
            int32_t gold = g.gold;
            uint8_t held[sizeof g.boxes_held];
            memcpy(held, g.boxes_held, sizeof held);
            for (int i = 0; i < ach_count; i++) {
                g.achievements &= ~(1u << i);
                game_award(i);
                if (strcmp(g.toast[0].text, ach_defs[i].name) != 0 || g.toast[0].kind != 3) {
                    printf("  FAIL \"%s\" arrived as \"%s\"\n", ach_defs[i].name, g.toast[0].text);
                    cut++;
                }
            }
            g.achievements = had;
            g.gold = gold;
            memcpy(g.boxes_held, held, sizeof held);
            memset(g.toast, 0, sizeof g.toast);
            printf("  toasts -> %d of %d names arrived whole\n", ach_count - cut, ach_count);
            if (cut) fail = 1;
            /*  The FEATS list shows name and how-to on every row, in a 244px
                window with 12px of margin, the name after a star. */
            for (int i = 0; i < ach_count; i++)
                if (gfx_text_width(ach_defs[i].how) > 232 ||
                    gfx_text_width(ach_defs[i].name) > 232 - 9 - 30) {
                    printf("  FAIL \"%s\" runs off its row in the FEATS list\n", ach_defs[i].name);
                    fail = 1;
                }
        }

        /*  The code keyboard can be left with the buttons alone.
         *
         *  BACK was a stylus-only button and B only deleted, so a player who
         *  opened RESUME FROM CODE with the pad had no way out but a code that
         *  worked. The ROM bot found this after a lost run: it sat on the
         *  keyboard for three hundred rounds typing and deleting. */
        {
            printf("== the code keyboard lets go\n");
            game_set_scene(SCENE_TITLE);
            idle(2);
            g.title_cursor = 0;
            tap(BTN_DOWN);
            tap(BTN_A);
            int opened = g.scene == SCENE_CODE && g.code_mode;
            tap(BTN_A);
            tap(BTN_A);
            int typed = g.code_len;
            tap(BTN_B);
            tap(BTN_B);
            int emptied = g.scene == SCENE_CODE && g.code_len == 0;
            tap(BTN_B);
            printf("  code keys -> opened %d, typed %d, two Bs empty it %d, a third B leaves "
                   "for scene %d\n", opened, typed, emptied, g.scene);
            if (!opened || typed != 2 || !emptied) {
                printf("  FAIL the keyboard did not type and delete with the buttons\n");
                fail = 1;
            }
            if (g.scene != SCENE_TITLE) {
                printf("  FAIL B on an empty code does not go back to the title\n");
                fail = 1;
            }
        }

        /*  The selected row can be read.
         *
         *  The selection is paper -- a pale fill with dark writing -- and most
         *  lists drew their selected label in amber, which on paper measures
         *  1.0:1; the counts, prices and stats beside it stayed their glass
         *  colours and fared no better. A boss's name went pale in the roster
         *  at the moment its tell was up. Each case is rendered with the row
         *  off and on, and the text scored where it stands. */
        {
            printf("== selected rows are legible\n");
            static uint16_t glass[SCREEN_W * SCREEN_H], paper[SCREEN_W * SCREEN_H];
            const uint16_t *bot = plat_screen(SCREEN_BOTTOM);
            /*  min_px is how much text the rect must contain for the
                measurement to count: one glyph on a key is sixteen. */
            struct { const char *what; int scene; int x, y, w, h, min_px; } cases[] = {
                { "shop row, affordable",   SCENE_SHOP,    28, 28, 220, 14, 60 },
                { "shop row, too dear",     SCENE_SHOP,    28, 28, 220, 14, 60 },
                { "level-up stat row",      SCENE_LEVELUP, 16, 49, 226, 14, 60 },
                { "foe roster during tell", SCENE_BATTLE,  28, 112, 118, 12, 60 },
                { "keyboard key",           SCENE_CODE,    10, 62, 24, 20, 10 },
            };
            for (unsigned k = 0; k < sizeof cases / sizeof cases[0]; k++) {
                if (cases[k].scene == SCENE_BATTLE) {
                    int def = -1;
                    for (int i = 0; i < foe_count && def < 0; i++)
                        if (foe_defs[i].rank && foe_defs[i].tell) def = i;
                    battle_start_foe(def, " blocks the way.");
                } else {
                    game_set_scene(cases[k].scene);
                }
                idle(30);
                g.fade = 0;
                g.gold = k == 1 ? 0 : 9999;
                g.code_mode = 1;
                for (int lit = 0; lit < 2; lit++) {
                    switch (cases[k].scene) {
                    case SCENE_SHOP:    g.shop_cursor = lit ? 0 : 1; break;
                    case SCENE_LEVELUP: g.menu_cursor = lit ? 0 : 1; break;
                    case SCENE_CODE:    g.code_cursor = lit ? 0 : 1; break;
                    case SCENE_BATTLE:
                        g.bat.phase = BAT_RESOLVE;
                        g.bat.actor = PARTY;
                        g.bat.tell = lit ? 2 : 0;
                        g.bat.tell_foe = 0;
                        break;
                    }
                    render_frame();
                    memcpy(lit ? paper : glass, bot, sizeof glass);
                }
                int found;
                double c = lit_text_contrast(glass, paper, cases[k].x, cases[k].y,
                                             cases[k].w, cases[k].h, &found);
                int mid = cases[k].y + cases[k].h / 2;
                double lit_l = lum15(line_bg(paper, cases[k].x, mid, cases[k].w));
                double off_l = lum15(line_bg(glass, cases[k].x, mid, cases[k].w));
                printf("  %-24s -> worst text %.2f:1 over %d px\n", cases[k].what, c, found);
                if (lit_l < 0.4 || off_l > 0.2) {
                    /*  Otherwise this compares glass with glass and passes
                        having measured nothing -- which it did, the first
                        time, because the roster never redrew for a tell. */
                    printf("  FAIL the %s did not light (background %.2f -> %.2f)\n",
                           cases[k].what, off_l, lit_l);
                    fail = 1;
                } else if (found < cases[k].min_px) {
                    printf("  FAIL found no text to measure in the %s\n", cases[k].what);
                    fail = 1;
                } else if (c < 3.0) {
                    printf("  FAIL the %s cannot be read once selected\n", cases[k].what);
                    fail = 1;
                }
            }
            g.code_mode = 0;
            game_set_scene(SCENE_DUNGEON);
            idle(2);
        }

        /*  The item table and the icon strip are one list in two files.
         *
         *  item_sprite() maps an id straight onto the sprite table by
         *  position, so adding a row to content.c without adding an icon to
         *  items.py silently shifts every icon after it -- the potion starts
         *  drawing as pizza and nothing crashes. This pins the two ends
         *  together. */
        {
            printf("== every item has its own icon\n");
            int bad = 0;
            if (SPR_ITEM_RATINGS_CHIP != SPR_ITEM_SPLINT_POTION + item_count - 2) {
                printf("  FAIL %d items but the icon strip spans %d\n",
                       item_count - 1, SPR_ITEM_RATINGS_CHIP - SPR_ITEM_SPLINT_POTION + 1);
                bad = 1;
            }
            for (int i = 1; i < item_count; i++) {
                int sp = SPR_ITEM_SPLINT_POTION + (i - 1);
                if (sp >= SPR_COUNT || !sprite_table[sp]) {
                    printf("  FAIL %s has no icon\n", item_defs[i].name);
                    bad = 1;
                }
            }
            if (!bad) printf("  icons -> %d items, %d icons, aligned\n",
                             item_count - 1, SPR_ITEM_RATINGS_CHIP - SPR_ITEM_SPLINT_POTION + 1);
            if (bad) fail = 1;
        }

        /*  Gear the player can hold has to do something once held. All three
         *  of these were broken in different ways and none of them would have
         *  shown up as anything but the game feeling flat. */
        {
            printf("== equipment changes the numbers\n");
            g.season = 0x6EA2;
            dungeon_enter(0);
            int weapon = 0, armour = 0, trinket = 0;
            for (int i = 1; i < item_count; i++) {
                if (item_defs[i].kind == IT_WEAPON && !weapon) weapon = i;
                if (item_defs[i].kind == IT_ARMOUR && !armour) armour = i;
                if (item_defs[i].kind == IT_TRINKET && !trinket) trinket = i;
            }
            /*  The trinket. gear_bonus was only ever consulted for weapons and
                armour, and every damage roll read st.luck straight off the
                stat block -- so a trinket's power column was decoration, and
                the Lucky Molar had been on sale for 260 gold doing nothing. */
            Hero *h = &g.hero[1];
            int luck_before = hero_luck(h);
            inventory_add(trinket, 1);
            if (!equip_item(h, trinket)) { printf("  FAIL could not equip a trinket\n"); fail = 1; }
            printf("  trinket -> luck %d then %d\n", luck_before, hero_luck(h));
            if (hero_luck(h) <= luck_before) {
                printf("  FAIL the trinket's luck is never counted\n"); fail = 1;
            }
            /*  The second crawler. The gear menu picked the hero from the item
                kind -- trinkets to hero 1, everything else to hero 0 -- so
                hero 1 could never hold a weapon or wear armour, and fought all
                eighteen floors bare-handed. */
            int atk_before = hero_attack(h), def_before = hero_defence(h);
            inventory_add(weapon, 1);
            inventory_add(armour, 1);
            int got_w = equip_item(h, weapon), got_a = equip_item(h, armour);
            printf("  crawler 2 -> attack %d then %d, defence %d then %d\n",
                   atk_before, hero_attack(h), def_before, hero_defence(h));
            if (!got_w || !got_a) {
                printf("  FAIL the second crawler was refused a weapon or armour\n"); fail = 1;
            }
            if (hero_attack(h) <= atk_before || hero_defence(h) <= def_before) {
                printf("  FAIL equipping the second crawler changed nothing\n"); fail = 1;
            }
        }

        /*  Gold is an int16_t and the new gear gives a hoarding player a
         *  reason to sit near the ceiling. A wrap turns a fortune into a debt
         *  in one kill. */
        {
            printf("== gold does not wrap\n");
            g.gold = 0;
            for (int i = 0; i < 200; i++) gold_add(1000);
            printf("  gold -> 200,000 paid in, holding %d\n", g.gold);
            if (g.gold < 0) { printf("  FAIL gold went negative\n"); fail = 1; }
            gold_add(-999999);
            if (g.gold < 0) { printf("  FAIL an overspend went negative\n"); fail = 1; }
            g.gold = 40;
        }

        /*  Depth has to keep costing something.
         *
         *  foe_stat_scale is the whole difficulty curve: it is what stops
         *  floor eighteen playing like floor one with a different palette.
         *  If it ever came back flat, or inverted, every other test here
         *  would still pass and the game would simply stop being a game. */
        {
            printf("== the descent keeps getting harder\n");
            int mob = 0;                       /* the sewer rat: on every floor */
            int prev = foe_stat_scale(1, mob), bad = 0, first = prev;
            for (int f = 2; f <= FLOORS; f++) {
                int now = foe_stat_scale(f, mob);
                if (now < prev) {
                    printf("  FAIL floor %d scales to %d, below floor %d's %d\n",
                           f, now, f - 1, prev);
                    bad++;
                }
                prev = now;
            }
            printf("  scaling -> %s goes %d%% on floor 1 to %d%% on floor %d\n",
                   foe_defs[mob].name, first, prev, FLOORS);
            /*  Monotonic is not enough on its own -- a curve that rises by
                one percent over eighteen floors is monotonic and useless. */
            if (prev < first * 2) {
                printf("  scaling -> the curve is too flat to be a difficulty curve\n");
                bad++;
            }
            if (bad) fail = 1;
        }

        /*  Defence has to be worth having, and breaking a boss's guard has to
         *  be worth doing. Both are one number deep inside roll_damage that
         *  nothing else in this suite would notice going missing.
         *
         *  Driven through the real command path rather than a test hook into
         *  battle.c: a `battle_hit_for_test` exported from shipped code to
         *  make a test easier is the kind of thing this repo should not grow.
         *  Averaged over many swings because roll_damage has an 88-114%
         *  spread and a crit roll in it -- one sample proves nothing. */
        {
            printf("== armour does something\n");
            long dealt[2] = { 0, 0 };
            for (int mode = 0; mode < 2; mode++) {
                g.season = 0x51DE;
                dungeon_enter(0);
                rng_seed(0xD0D0);            /* same swings on both passes */
                battle_start(0);
                Foe *f = &g.bat.foes[0];
                f->hp = f->hp_max = 30000;
                for (int i = 1; i < g.bat.n_foes; i++) g.bat.foes[i].alive = 0;
                g.bat.n_foes = 1;
                int swings = 0;
                for (int t = 0; t < 20000 && g.scene == SCENE_BATTLE && swings < 240; t++) {
                    for (int h = 0; h < PARTY; h++) {
                        g.hero[h].hp = g.hero[h].hp_max;
                        g.hero[h].mp = g.hero[h].mp_max;
                    }
                    /*  Re-armed every pass: the status ticks itself down. */
                    f->status[ST_DEFDOWN] = mode ? 3 : 0;
                    if (f->hp < 20000) {                  /* keep it standing */
                        dealt[mode] += 30000 - f->hp;
                        f->hp = 30000;
                    }
                    if (g.bat.phase == BAT_CHOOSE && g.bat.actor < PARTY) {
                        input.touching = input.touch_pressed = 1;
                        input.touch_x = (int16_t)(kBatCommands[0].x + 8);   /* FIGHT */
                        input.touch_y = (int16_t)(kBatCommands[0].y + 8);
                        step();
                        swings++;
                        continue;
                    }
                    if (g.bat.phase == BAT_SKILL) {
                        g.bat.cursor = 0;                 /* the free swing */
                        tap(BTN_A);
                        continue;
                    }
                    tap(BTN_A);
                }
                dealt[mode] += 30000 - f->hp;
                printf("  damage -> %s: %ld over %d swings\n",
                       mode ? "guard broken" : "guard up", dealt[mode], swings);
            }
            if (dealt[0] < 1 || dealt[1] < 1) {
                printf("  FAIL no damage was dealt in one of the passes\n");
                fail = 1;
            } else if (dealt[1] <= dealt[0]) {
                printf("  FAIL breaking the guard did not make it easier to hurt"
                       " (%ld vs %ld)\n", dealt[1], dealt[0]);
                fail = 1;
            } else {
                printf("  damage -> breaking the guard is worth %ld%% more\n",
                       (dealt[1] - dealt[0]) * 100 / dealt[0]);
            }
        }

        /*  Every foe's name has to fit the slot it is written in.
         *
         *  A three-foe line-up gives each plate SCREEN_W/3 - 6 pixels. The
         *  plate box was clamped to that but the name was not, and a name
         *  wider than its box is centred from a negative offset -- straight
         *  over both neighbours. "Goblin TrapperGoblin Trapper" shipped in
         *  docs/shots/05-battle.png looking like a rendering fault, which is
         *  what it was. Checked against the whole roster rather than the one
         *  name that happened to be photographed. */
        {
            printf("== a crowded line-up still reads\n");
            int room = 256 / 3 - 6, over = 0, shortened = 0;
            char buf[32];
            for (int i = 0; i < foe_count; i++) {
                const char *fitted = render_fit_name(foe_defs[i].name, room,
                                                     buf, (int)sizeof buf);
                int w = gfx_text_width(fitted);
                if (w > room) {
                    printf("  FAIL %-18s %dpx in %dpx\n", foe_defs[i].name, w, room);
                    over++;
                }
                if (fitted != foe_defs[i].name) shortened++;
            }
            printf("  names -> %d of %d shortened to fit %dpx, %d still over\n",
                   shortened, foe_count, room, over);
            if (over) fail = 1;
            /*  And the shortening has to actually be reached: if nothing in
                the roster is long enough to trigger it, this test is green
                for the wrong reason and will stay green when it breaks. */
            if (!shortened) {
                printf("  names -> nothing was long enough to exercise this\n");
                fail = 1;
            }
        }
        /*  The thing the rules release must never be rolled as scenery. It
         *  is rank 0 on tier 1, which is exactly the shape of an ordinary
         *  wandering mob, so nothing about its data keeps it out of a
         *  corridor -- only foe_pick's exclusion does. */
        {
            int leaked = 0;
            for (int f = 1; f <= FLOORS; f++)
                for (int t = 0; t < 300; t++)
                    if (foe_pick(f) == foe_rage()) leaked++;
            printf("  rage -> rolled as a wandering mob %d times in %d picks\n",
                   leaked, FLOORS * 300);
            if (leaked) fail = 1;
        }
        /*  The achievement table and its enum have to stay the same length,
         *  or every name after the mismatch is attached to the wrong feat and
         *  nothing complains. */
        if (ach_count != ACH_LOOPHOLE + 1) {
            printf("  achievements -> %d rows for %d enum entries\n",
                   ach_count, ACH_LOOPHOLE + 1);
            fail = 1;
        } else printf("  achievements -> %d rows, enum agrees\n", ach_count);

        /*  Rule 12: open boxes where you were told not to and the floor sends
         *  something you cannot fight. The stairs take it off you exactly
         *  once, and then that gets patched. */
        {
            g.season = 0x1BAD;

            /*  Not on floor one, where the party is level two and the game is
                still explaining itself. */
            dungeon_enter(0);
            g.rage_hunt = 0; g.rage_patched = 0; g.rage_done = 0;
            memset(g.boxes_held, 0, sizeof g.boxes_held);
            for (int i = 0; i < RAGE_TRIGGER * 2; i++) game_hold_box(0);
            printf("  rule 12 -> armed on floor one: %s\n",
                   g.rage_hunt ? "YES (wrong)" : "no");
            if (g.rage_hunt) fail = 1;

            dungeon_enter(1);
            g.rage_hunt = 0; g.rage_patched = 0; g.rage_done = 0;
            memset(g.boxes_held, 0, sizeof g.boxes_held);
            for (int i = 0; i < RAGE_TRIGGER; i++) game_hold_box(0);
            printf("  rule 12 -> carrying %d stowed boxes started a hunt: %s\n",
                   RAGE_TRIGGER, g.rage_hunt ? "yes" : "NO");
            if (!g.rage_hunt) fail = 1;

            /*  ...and it only ever comes once a run. */
            g.rage_hunt = 0;
            memset(g.boxes_held, 0, sizeof g.boxes_held);
            for (int i = 0; i < RAGE_TRIGGER * 2; i++) game_hold_box(0);
            printf("  rule 12 -> it came a second time: %s\n",
                   g.rage_hunt ? "YES (wrong)" : "no");
            if (g.rage_hunt) fail = 1;

            /*  Winning fights must not trigger it -- the boxes a battle hands
                you are opened on the spot by the game, not by the player. */
            g.rage_done = 0; g.rage_hunt = 0;
            memset(g.boxes_held, 0, sizeof g.boxes_held);
            for (int i = 0; i < 20; i++) game_open_box(0);
            printf("  rule 12 -> battle rewards started a hunt: %s\n",
                   g.rage_hunt ? "YES (wrong)" : "no");
            if (g.rage_hunt) fail = 1;

            /*  The stairwell, once. Stand on the stairs and use them. */
            g.rage_patched = 0;
            for (int round = 0; round < 2; round++) {
                dungeon_enter(1);
                int sx = -1, sy = -1;
                for (int y = 0; y < g.dun.h && sx < 0; y++)
                    for (int x = 0; x < g.dun.w; x++)
                        if (dungeon_tile(x, y) == T_DOWN) { sx = x; sy = y; break; }
                if (sx < 0) { printf("  rule 12 -> no stairs on the floor\n"); fail = 1; break; }
                g.dun.px = (uint8_t)sx; g.dun.py = (uint8_t)sy;
                g.rage_hunt = 5;
                dungeon_interact();
                if (round == 0) {
                    printf("  rule 12 -> stairwell cleared it: %s, patched: %s\n",
                           g.rage_hunt ? "NO" : "yes", g.rage_patched ? "yes" : "NO");
                    if (g.rage_hunt || !g.rage_patched) fail = 1;
                } else {
                    /*  Patched. It follows you down. */
                    printf("  rule 12 -> after the patch the stairs %s\n",
                           g.rage_hunt ? "no longer save you" : "STILL SAVE YOU (wrong)");
                    if (!g.rage_hunt) fail = 1;
                }
            }
        }
        return fail;
    }

    if (bot) {
        stale_on = 1;
        for (int r = 0; r < runs; r++) {
            int seed = 1000 + r * 977;
            printf("run %d (seed %d)\n", r + 1, seed);
            play_run(seed, 1);
            printf("  [%s] reached floor %d, %s lv%d, %s lv%d, %d fights, %d gold, %d boxes\n",
                   g.scene == SCENE_VICTORY ? "WON " : g.scene == SCENE_GAMEOVER ? "died" : "----",
                   g.dun.index + 1, g.hero[0].name, g.hero[0].level,
                   g.hero[1].name, g.hero[1].level, g.battles_won, g.gold, g.boxes_opened);
            /*  A season ends when the crawler does, so the assertion is about
                depth, not about finishing: the bot is asked to get four floors
                down alive and to have earned it on the way. */
            check(g.dun.index + 1 >= BOT_FLOORS, "the season got at least four floors down");
            /*  Dying is the expected end of a season, not a failure. What
                would be a failure is ending somewhere that is neither the
                dungeon nor an ending — wedged in a menu with nothing to do. */
            check(g.scene == SCENE_GAMEOVER || g.scene == SCENE_VICTORY ||
                  g.scene == SCENE_DUNGEON, "the season ended somewhere it should");
            check(g.hero[0].level >= 4, "the crawlers levelled on the way");
            check(g.battles_won >= 6, "the run involved a real number of fights");
            check(g.boxes_opened >= 3, "loot boxes actually opened");
        }
        stale_on = 0;
        {
            static const char *const kScreen[3] = { "top", "bottom", "world" };
            int any = 0;
            for (int sc = 0; sc < SCENE_COUNT; sc++)
                for (int k = 0; k < 3; k++) {
                    const Stale *st = &stale[sc][k];
                    if (!st->worst) continue;
                    int bad = st->worst > STALE_MAX_LAG;
                    printf("  %s %-6s in scene %2d: behind a fresh draw for up to %d frames "
                           "(at frame %d, %d px in (%d,%d)-(%d,%d))\n",
                           bad ? "STALE" : "lag  ", kScreen[k], sc, st->worst, st->frame,
                           st->px, st->x0, st->y0, st->x1, st->y1);
                    any |= bad;
                }
            check(!any, "no screen stays behind the game state for more than a few frames");
        }
        printf("%s: %d failures\n", fail_count ? "FAILED" : "passed", fail_count);
        return fail_count ? 1 : 0;
    }

    printf("nothing to do: pass --bot or --shots DIR\n");
    return 0;
}
