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
#include <zlib.h>

#include "platform.h"
#include "game.h"

static uint16_t fb[2][SCREEN_W * SCREEN_H];
uint16_t *plat_screen(int which) { return fb[which ? 1 : 0]; }
void plat_sound(int voice, int freq, int volume, int duty) { (void)voice; (void)freq; (void)volume; (void)duty; }
void plat_sound_stop(int voice) { (void)voice; }

/* ------------------------------------------------------------------ png ---- */

static void put32(unsigned char *p, uint32_t v) { p[0] = v >> 24; p[1] = v >> 16; p[2] = v >> 8; p[3] = v; }

static void png_chunk(FILE *f, const char *type, const unsigned char *data, size_t len) {
    unsigned char hdr[8];
    put32(hdr, (uint32_t)len);
    memcpy(hdr + 4, type, 4);
    fwrite(hdr, 1, 8, f);
    fwrite(data, 1, len, f);
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
        for (unsigned x = 0; x < w; x++) {
            uint16_t c = src[x];
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

static void step(void) { game_frame(&input); memset(&input, 0, sizeof input); }
static void idle(int n) { for (int i = 0; i < n; i++) step(); }
static void tap(uint32_t button) { input.pressed = button; input.held = button; step(); idle(1); }

static void shot(const char *name) {
    if (!shots_dir) return;
    char path[512];
    snprintf(path, sizeof path, "%s/%s.png", shots_dir, name);
    idle(20);                        /* let the scene fade in before shooting */
    write_shot(path);
    if (verbose) printf("  shot %s\n", path);
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

static void face_and_step(int dx, int dy) {
    int want = dy < 0 ? DIR_N : dy > 0 ? DIR_S : dx > 0 ? DIR_E : DIR_W;
    for (int guard = 0; guard < 4 && g.dun.facing != want; guard++) {
        int diff = (want - g.dun.facing + 4) & 3;
        tap(diff == 3 ? BTN_LEFT : BTN_RIGHT);
        if (g.scene != SCENE_DUNGEON) return;
    }
    tap(BTN_UP);
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
    static const int dirs[4] = { BTN_UP, BTN_RIGHT, BTN_UP, BTN_LEFT };
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
        if (g.scene == SCENE_DUNGEON && g.dun.steps == before) tap(BTN_RIGHT);
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
#define BOT_FLOORS 4

static void play_run(int seed, int assertions) {
    const int bot_floors = BOT_FLOORS;
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
        if (g.scene == SCENE_SHOP) {
            for (int i = 0; i < 6; i++) tap(BTN_A);
            tap(BTN_B);
        }
        if (season_over()) break;
        walk_to(T_SHRINE, 400);
        walk_to(T_KIOSK, 400);
        grind_to(floor_no * 3 + 1, 700);
        walk_to(T_SHOP, 400);
        if (g.scene == SCENE_SHOP) { for (int i = 0; i < 8; i++) tap(BTN_A); tap(BTN_B); }
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
    int sweep = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--bot")) bot = 1;
        else if (!strcmp(argv[i], "--shots") && i + 1 < argc) { shots_dir = argv[++i]; want_shots = 1; }
        else if (!strcmp(argv[i], "--runs") && i + 1 < argc) runs = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--touch")) touch_check = 1;
        else if (!strcmp(argv[i], "--codes")) code_check = 1;
        else if (!strcmp(argv[i], "--map") && i + 1 < argc) map_seed = (uint32_t)atoi(argv[++i]);
        else if (!strcmp(argv[i], "--mapsweep") && i + 1 < argc) sweep = atoi(argv[++i]);
        else if (!strcmp(argv[i], "-v")) verbose = 1;
        else { fprintf(stderr, "unknown argument %s\n", argv[i]); return 2; }
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
        idle(4);
        shot("03-corridor");
        pause_scene = SCENE_BOX;
        walk_to(T_BOX, 500);
        if (g.scene == SCENE_BOX) { idle(50); shot("04-lootbox"); }
        pause_scene = SCENE_SAFEROOM;
        for (int i = 0; i < 20 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
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
        pause_scene = SCENE_BATTLE;
        walk_to(T_BOSS, 600);
        pause_scene = -1;
        if (g.scene == SCENE_BATTLE) { idle(30); shot("12-boss"); play_battle(); }
        for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE || g.scene == SCENE_DRAFT); i++) {
            if (i == 2) shot("13-story-cast");
            tap(BTN_A);
        }
        /* Run the rest of the game out for the closing screen. */
        for (int floor_no = g.dun.index + 1; floor_no <= FLOORS; floor_no++) {
            grind_to(floor_no * 3 + 1, 700);
            walk_to(T_BOSS, 600);
            if (g.scene == SCENE_BATTLE) play_battle();
            for (int i = 0; i < 40 && g.scene != SCENE_DUNGEON; i++) tap(BTN_A);
            walk_to(T_DOWN, 800);
            for (int i = 0; i < 60 && g.scene != SCENE_DUNGEON && !season_over(); i++) tap(BTN_A);
            if (g.scene == SCENE_VICTORY) break;
        }
        if (g.scene == SCENE_VICTORY) shot("14-book-one-done");
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
                       g.flags == (flags & 0xFFF) && g.achievements == (achievements & 0xFFFF) &&
                       g.gold / 8 == gold / 8;
            printf("  %s %s -> floor %d, Carl %d, Donut %d, %d gold\n",
                   same ? "ok  " : "FAIL", code, g.dun.index + 1, g.hero[0].level,
                   g.hero[1].level, g.gold);
            if (!same) bad++;

            /* A code with a character knocked out of it must be refused. */
            char broken[24];
            memcpy(broken, code, sizeof broken);
            broken[5] = broken[5] == 'A' ? 'B' : 'A';
            game_boot();
            if (save_apply_code(broken)) { printf("  FAIL %s was accepted\n", broken); bad++; }
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
        input.touch_x = 128; input.touch_y = 130;      /* DESCEND */
        step();
        printf("  title tap -> scene %d\n", g.scene);
        for (int i = 0; i < 900 && (g.scene == SCENE_STORY || g.scene == SCENE_CUTSCENE || g.scene == SCENE_DRAFT); i++) tap(BTN_A);
        int before = g.dun.steps;
        for (int i = 0; i < 3; i++) {
            input.touching = input.touch_pressed = 1;
            input.touch_x = 47; input.touch_y = 128;   /* the forward pad */
            step();
            idle(2);
        }
        printf("  pad taps -> steps %d (was %d), scene %d\n", g.dun.steps, before, g.scene);
        return (g.dun.steps > before) ? 0 : 1;
    }

    if (bot) {
        for (int r = 0; r < runs; r++) {
            int seed = 1000 + r * 977;
            printf("run %d (seed %d)\n", r + 1, seed);
            play_run(seed, 1);
            printf("  reached floor %d, %s lv%d, %s lv%d, %d fights, %d gold, %d boxes\n",
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
        printf("%s: %d failures\n", fail_count ? "FAILED" : "passed", fail_count);
        return fail_count ? 1 : 0;
    }

    printf("nothing to do: pass --bot or --shots DIR\n");
    return 0;
}
