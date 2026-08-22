/*  The scene machine.
 *
 *  game_frame() runs exactly once per displayed frame: it advances whichever
 *  scene is current, ages the toasts, publishes the telemetry block the test
 *  harness reads, and then hands the two screens to the renderer.
 */
#include "game.h"

#include <string.h>

#include "art.h"
#include "audio.h"
#include "ui_layout.h"
#include "../../tools/ndsbot/telemetry.h"

#ifdef DS_BUILD
#include <nds.h>
#endif

Game g;
uint32_t g_last_touch;      /* what the platform layer last reported, for the harness */

/*  Kept in main RAM and flushed every frame. The harness finds it by its magic
 *  and reads the run's state out of the emulator; nothing else uses it. */
volatile Telemetry g_telemetry = { .magic0 = TELEMETRY_MAGIC0, .magic1 = TELEMETRY_MAGIC1 };

static void publish_telemetry(void) {
    g_telemetry.frame = g.frame;
    g_telemetry.scene = (uint32_t)g.scene;
    g_telemetry.floor = (uint32_t)g.dun.index + 1;
    g_telemetry.px = g.dun.px;
    g_telemetry.py = g.dun.py;
    g_telemetry.facing = g.dun.facing;
    g_telemetry.steps = g.dun.steps;
    g_telemetry.explored = g.dun.explored;
    g_telemetry.carl_hp = (uint32_t)g.hero[0].hp;
    g_telemetry.carl_hp_max = (uint32_t)g.hero[0].hp_max;
    g_telemetry.carl_level = g.hero[0].level;
    g_telemetry.carl_xp = (uint32_t)g.hero[0].xp;
    g_telemetry.donut_hp = (uint32_t)g.hero[1].hp;
    g_telemetry.donut_hp_max = (uint32_t)g.hero[1].hp_max;
    g_telemetry.donut_level = g.hero[1].level;
    g_telemetry.gold = (uint32_t)g.gold;
    g_telemetry.boxes = g.boxes_opened;
    g_telemetry.achievements = g.achievements;
    g_telemetry.battles_won = g.battles_won;
    g_telemetry.story_beat = g.story_beat;
    g_telemetry.flags = g.flags;
    g_telemetry.collapse = (uint32_t)(g.dun.collapse > 0 ? g.dun.collapse / 60 : 0);
#ifdef DS_BUILD
    extern uint32_t plat_touch_raw;
    g_telemetry.touch = g_last_touch ? g_last_touch : plat_touch_raw;
    if (g_last_touch && plat_touch_raw) g_telemetry.touch = g_last_touch;
    g_telemetry.touch_raw = plat_touch_raw;
#endif
    g_telemetry.checksum = g_telemetry.frame ^ g_telemetry.scene ^ g_telemetry.gold;
#ifdef DS_BUILD
    DC_FlushRange((void *)&g_telemetry, sizeof g_telemetry);
#endif
}

/* ---------------------------------------------------------------- toasts -- */

void game_toast(const char *text, int kind) {
    if (g.toast[0].life) {                    /* the System does not repeat itself */
        int same = 1;
        for (int i = 0; same && i < (int)sizeof g.toast[0].text; i++) {
            if (g.toast[0].text[i] != text[i]) same = 0;
            if (!text[i]) break;
        }
        if (same) { g.toast[0].life = 180; return; }
    }
    for (int i = MAX_TOASTS - 1; i > 0; i--) g.toast[i] = g.toast[i - 1];
    Toast *t = &g.toast[0];
    int n = 0;
    while (text[n] && n < (int)sizeof t->text - 1) { t->text[n] = text[n]; n++; }
    t->text[n] = 0;
    t->life = 180;
    t->kind = (uint8_t)kind;
}

static void toast_join(const char *a, const char *b) {
    char buf[38];
    int o = 0;
    for (const char *s = a; *s && o < 36; s++) buf[o++] = *s;
    for (const char *s = b; *s && o < 36; s++) buf[o++] = *s;
    buf[o] = 0;
    game_toast(buf, 1);
}

void game_award(int achievement) {
    if (achievement < 0 || achievement >= ach_count) return;
    if (g.achievements & (1u << achievement)) return;
    g.achievements |= 1u << achievement;
    audio_sfx(SFX_LEVEL);
    toast_join("Achievement: ", ach_defs[achievement].name);
    g.gold = (int16_t)(g.gold + ach_defs[achievement].gold);
    if (ach_defs[achievement].box < 4) game_open_box(ach_defs[achievement].box);
}

/* ---------------------------------------------------------------- scenes -- */

void game_set_scene(Scene s) {
    g.scene_return = g.scene;
    g.scene = s;
    g.fade = 12;
}

void game_story(int floor, int trigger, Scene after) {
    const Beat *b = beat_find(floor, trigger);
    if (!b) { if (after != g.scene) game_set_scene(after); return; }
    g.beat = b;
    g.beat_line = 0;
    g.beat_reveal = 0;
    g.beat_after = (uint8_t)after;
    if (b->id > g.story_beat) g.story_beat = b->id;
    if (g.story_beat >= 14) game_award(11);
    game_set_scene(SCENE_STORY);
}

/* Loot boxes: the show's whole economy, and the reason anyone keeps going. */
void game_open_box(int tier) {
    if (tier < 0) tier = 0;
    if (tier > 3) tier = 3;
    g.box_tier = (uint8_t)tier;
    g.box_phase = 0;
    g.box_timer = 0;
    g.boxes_opened++;
    audio_sfx(SFX_LOOT);

    static const uint8_t common[]  = { 1, 1, 3, 4, 6 };
    static const uint8_t better[]  = { 2, 2, 3, 5, 6, 7, 9 };
    static const uint8_t best[]    = { 2, 5, 8, 10, 11, 7, 9 };
    int item;
    if (tier == 0) item = common[rng_range(0, (int)sizeof common - 1)];
    else if (tier == 1) item = better[rng_range(0, (int)sizeof better - 1)];
    else item = best[rng_range(0, (int)sizeof best - 1)];
    g.box_item = (uint8_t)item;
    if (g.boxes_opened == 1) game_award(1);
    game_set_scene(SCENE_BOX);
}

/* ----------------------------------------------------------------- input -- */

static int touch_in(const PlatInput *in, const Rect *r) {
    return in->touch_pressed && in->touch_x >= r->x && in->touch_x < r->x + r->w &&
           in->touch_y >= r->y && in->touch_y < r->y + r->h;
}

static void start_new_run(void) {
    memset(&g.hero, 0, sizeof g.hero);
    party_new();
    g.gold = 40;
    memset(g.inventory, 0, sizeof g.inventory);
    inventory_add(1, 2);
    g.flags = 0;
    g.achievements = 0;
    g.boxes_opened = 0;
    g.battles_won = 0;
    g.story_beat = 0;
    /*  Book One starts above ground. The dungeon is entered at the end of
        chapter one, not before it. */
    chapter_begin(1);
}

static void update_title(const PlatInput *in) {
    Rect play = { 40, 118, 176, 26, "DESCEND" };
    Rect code = { 40, 150, 176, 24, "ENTER RECALL CODE" };
    if (in->pressed & (BTN_UP | BTN_DOWN)) g.title_cursor ^= 1;
    if ((in->pressed & (BTN_A | BTN_START)) || touch_in(in, &play)) {
        if (g.title_cursor == 0) {
            /* The season is what the recall code carries, so it has to fit
               the sixteen bits the code has room for. Loot is seeded off a
               mix of it rather than from it, so two seasons that happen to
               share a layout still roll differently. */
            g.season = ((0x1BADCA7Du ^ (g.frame * 2654435761u)) & 0xFFFF);
            if (!g.season) g.season = 0x1BAD;
            rng_seed(0x9E3779B9u ^ (g.season * 2654435761u));
            start_new_run();
        } else {
            g.code_mode = 1;
            g.code_len = 0;
            g.code[0] = 0;
            g.code_status = 0;
            game_set_scene(SCENE_CODE);
        }
    }
    if (touch_in(in, &code)) {
        g.title_cursor = 1;
        g.code_mode = 1;
        g.code_len = 0;
        g.code[0] = 0;
        g.code_status = 0;
        game_set_scene(SCENE_CODE);
    }
}

static void update_story(const PlatInput *in) {
    const Beat *b = g.beat;
    if (!b) { game_set_scene((Scene)g.beat_after); return; }
    int len = 0;
    const char *text = b->lines[g.beat_line].text;
    while (text[len]) len++;
    if (g.beat_reveal < (uint16_t)len) {
        g.beat_reveal = (uint16_t)(g.beat_reveal + 2);
        if ((in->pressed & (BTN_A | BTN_B)) || in->touch_pressed) g.beat_reveal = (uint16_t)len;
        return;
    }
    if ((in->pressed & (BTN_A | BTN_B | BTN_START)) || in->touch_pressed) {
        g.beat_line++;
        g.beat_reveal = 0;
        if (g.beat_line >= b->count) {
            g.beat = 0;
            Scene after = (Scene)g.beat_after;
            game_set_scene(after);
            if (after == SCENE_DUNGEON && !(g.flags & F_TUTORIAL_DONE)) g.flags |= F_TUTORIAL_DONE;
        }
    }
}

static void update_dungeon(const PlatInput *in) {
    dungeon_tick();
    if (g.scene != SCENE_DUNGEON) return;

    static uint8_t repeat;
    uint32_t moved = in->pressed;
    if (in->held & (BTN_UP | BTN_DOWN | BTN_LEFT | BTN_RIGHT)) {
        if (repeat) repeat--;
        if (!repeat) { moved |= in->held; repeat = 9; }
    } else {
        repeat = 0;
    }

    if (moved & BTN_UP) dungeon_step(1);
    else if (moved & BTN_DOWN) dungeon_step(-1);
    else if (moved & BTN_LEFT) dungeon_turn(-1);
    else if (moved & BTN_RIGHT) dungeon_turn(1);
    if (g.scene != SCENE_DUNGEON) return;

    if (in->pressed & BTN_L) dungeon_strafe(0);
    if (in->pressed & BTN_R) dungeon_strafe(1);
    if (g.scene != SCENE_DUNGEON) return;

    if (in->pressed & BTN_A) dungeon_interact();
    if (in->pressed & (BTN_START | BTN_X)) { g.menu_tab = 0; game_set_scene(SCENE_MENU); return; }
    if (in->pressed & BTN_Y) {                       /* quick heal */
        for (int i = 1; i < item_count; i++)
            if (item_defs[i].kind == IT_HEAL && g.inventory[i]) {
                int who = g.hero[0].hp * 100 / g.hero[0].hp_max <=
                          g.hero[1].hp * 100 / g.hero[1].hp_max ? 0 : 1;
                hero_heal(&g.hero[who], item_defs[i].power);
                g.inventory[i]--;
                toast_join("Used ", item_defs[i].name);
                break;
            }
    }

    for (int i = 0; i < 4; i++)
        if (touch_in(in, &kDunPad[i])) {
            if (i == 0) dungeon_step(1);
            else if (i == 1) dungeon_step(-1);
            else if (i == 2) dungeon_turn(-1);
            else dungeon_turn(1);
            return;
        }
    if (touch_in(in, &kDunActions[0])) dungeon_interact();
    else if (touch_in(in, &kDunActions[1])) { g.menu_tab = 0; game_set_scene(SCENE_MENU); }
    else if (touch_in(in, &kDunActions[2])) g.menu_cursor ^= 1;      /* map zoom */
    else if (touch_in(in, &kDunActions[3])) {
        g.code_mode = 0;
        save_make_code(g.code);
        game_set_scene(SCENE_CODE);
    }
}

static void update_menu(const PlatInput *in) {
    for (int i = 0; i < 4; i++)
        if (touch_in(in, &kMenuTabs[i])) { g.menu_tab = (uint8_t)i; g.menu_cursor = 0; }
    if (in->pressed & BTN_R) g.menu_tab = (uint8_t)((g.menu_tab + 1) & 3);
    if (in->pressed & BTN_L) g.menu_tab = (uint8_t)((g.menu_tab + 3) & 3);
    if (in->pressed & BTN_DOWN) g.menu_cursor++;
    if (in->pressed & BTN_UP && g.menu_cursor) g.menu_cursor--;

    if (g.menu_tab == 1) {                            /* gear: equip from the bag */
        int list[INVENTORY], n = 0;
        for (int i = 1; i < item_count && i < INVENTORY; i++)
            if (g.inventory[i] && item_defs[i].kind >= IT_WEAPON) list[n++] = i;
        if (n) {
            if (g.menu_cursor >= n) g.menu_cursor = (uint8_t)(n - 1);
            for (int i = 0; i < n; i++) {
                Rect r = { 6, (int16_t)(52 + i * 18), 244, 17, 0 };
                if (touch_in(in, &r)) g.menu_cursor = (uint8_t)i;
            }
            if (in->pressed & BTN_A) {
                int item = list[g.menu_cursor];
                int hero = item_defs[item].kind == IT_TRINKET ? 1 : 0;
                if (equip_item(&g.hero[hero], item)) {
                    toast_join("Equipped ", item_defs[item].name);
                    int kinds = 0;
                    for (int h = 0; h < PARTY; h++)
                        for (int s = 0; s < 3; s++) if (g.hero[h].equip[s] > 0) kinds++;
                    if (kinds >= 4) game_award(10);
                }
            }
        }
    }

    if ((in->pressed & (BTN_B | BTN_START | BTN_X)) ||
        (in->touch_pressed && in->touch_y > 170 && in->touch_x > 190))
        game_set_scene(SCENE_DUNGEON);
}

static void update_shop(const PlatInput *in) {
    int stock[INVENTORY], n = 0;
    for (int i = 1; i < item_count; i++)
        if (item_defs[i].price > 0 && item_defs[i].price <= 500) stock[n++] = i;
    if (in->pressed & BTN_DOWN) g.shop_cursor = (uint8_t)((g.shop_cursor + 1) % n);
    if (in->pressed & BTN_UP) g.shop_cursor = (uint8_t)((g.shop_cursor + n - 1) % n);
    for (int i = 0; i < n; i++) {
        Rect r = { 6, (int16_t)(30 + i * 17), 244, 16, 0 };
        if (touch_in(in, &r)) g.shop_cursor = (uint8_t)i;
    }
    int buy = (in->pressed & BTN_A) != 0;
    Rect buy_btn = { 150, 166, 100, 22, "BUY" };
    if (touch_in(in, &buy_btn)) buy = 1;
    if (buy) {
        int item = stock[g.shop_cursor];
        if (g.gold >= item_defs[item].price) {
            g.gold = (int16_t)(g.gold - item_defs[item].price);
            inventory_add(item, 1);
            toast_join("Bought ", item_defs[item].name);
        } else {
            game_toast("Not enough gold. Bopca is unmoved.", 0);
        }
    }
    Rect leave = { 6, 166, 100, 22, "LEAVE" };
    if ((in->pressed & (BTN_B | BTN_START)) || touch_in(in, &leave)) game_set_scene(SCENE_DUNGEON);
}

static void update_box(const PlatInput *in) {
    g.box_timer++;
    if (g.box_phase == 0 && g.box_timer > 40) { g.box_phase = 1; g.box_timer = 0; }
    if (g.box_phase == 1 && (g.box_timer > 30 || (in->pressed & BTN_A) || in->touch_pressed)) {
        g.box_phase = 2;
        g.box_timer = 0;
        inventory_add(g.box_item, 1);
    }
    if (g.box_phase == 2 && (g.box_timer > 60 || (in->pressed & (BTN_A | BTN_B)) || in->touch_pressed)) {
        if (g.hero[0].points || g.hero[1].points) game_set_scene(SCENE_LEVELUP);
        else game_set_scene(SCENE_DUNGEON);
    }
}

static void update_levelup(const PlatInput *in) {
    int hero = g.hero[0].points ? 0 : 1;
    g.levelup_hero = (uint8_t)hero;
    if (!g.hero[hero].points) { game_set_scene(SCENE_DUNGEON); return; }
    uint8_t *stats = &g.hero[hero].st.str;
    if (in->pressed & BTN_DOWN) g.menu_cursor = (uint8_t)((g.menu_cursor + 1) % 6);
    if (in->pressed & BTN_UP) g.menu_cursor = (uint8_t)((g.menu_cursor + 5) % 6);
    int spend = (in->pressed & BTN_A) != 0;
    for (int i = 0; i < 6; i++) {
        Rect r = { 12, (int16_t)(46 + i * 20), 232, 19, 0 };
        if (touch_in(in, &r)) { g.menu_cursor = (uint8_t)i; spend = 1; }
    }
    if (spend) {
        stats[g.menu_cursor]++;
        g.hero[hero].points--;
        hero_recompute(&g.hero[hero]);
        if (!g.hero[0].points && !g.hero[1].points) game_set_scene(SCENE_DUNGEON);
    }
}

/*  The kiosk keyboard: five rows of the code alphabet, tapped or driven with
 *  the pad, because typing a code on a d-pad alone is a punishment. */
static const char kKeyRows[4][10] = {
    "ABCDEFGH", "JKLMNPQR", "STUVWXYZ", "23456789"
};

static void update_code(const PlatInput *in) {
    if (g.code_mode == 0) {                           /* showing a code */
        Rect ok = { 78, 158, 100, 24, "DONE" };
        if ((in->pressed & (BTN_A | BTN_B | BTN_START)) || touch_in(in, &ok))
            game_set_scene(SCENE_DUNGEON);
        return;
    }
    int row = g.code_cursor / 8, col = g.code_cursor % 8;
    if (in->pressed & BTN_RIGHT) col = (col + 1) % 8;
    if (in->pressed & BTN_LEFT) col = (col + 7) % 8;
    if (in->pressed & BTN_DOWN) row = (row + 1) % 4;
    if (in->pressed & BTN_UP) row = (row + 3) % 4;
    g.code_cursor = (uint8_t)(row * 8 + col);

    int typed = -1;
    for (int r = 0; r < 4; r++)
        for (int c = 0; c < 8; c++) {
            Rect key = { (int16_t)(8 + c * 30), (int16_t)(60 + r * 26), 28, 24, 0 };
            if (touch_in(in, &key)) typed = r * 8 + c;
        }
    if (in->pressed & BTN_A) typed = g.code_cursor;
    if (typed >= 0 && g.code_len < 16) {
        g.code[g.code_len++] = kKeyRows[typed / 8][typed % 8];
        g.code[g.code_len] = 0;
        g.code_status = 0;
    }
    Rect del = { 8, 166, 74, 22, "DELETE" };
    Rect go  = { 90, 166, 74, 22, "ENTER" };
    Rect back = { 172, 166, 76, 22, "BACK" };
    if ((in->pressed & BTN_B) || touch_in(in, &del)) {
        if (g.code_len) g.code[--g.code_len] = 0;
    }
    if ((in->pressed & BTN_START) || touch_in(in, &go)) {
        if (save_apply_code(g.code)) {
            g.code_status = 1;
            game_toast("Run restored. Try to look surprised.", 0);
            game_set_scene(SCENE_DUNGEON);
        } else {
            g.code_status = 2;
        }
    }
    if (touch_in(in, &back)) game_set_scene(SCENE_TITLE);
}

static void update_end(const PlatInput *in) {
    if ((in->pressed & (BTN_A | BTN_START)) || in->touch_pressed) {
        memset(&g.dun, 0, sizeof g.dun);
        g.scene = SCENE_TITLE;
        g.title_cursor = 0;
    }
}

/*  The show numbers its seasons, so the run does too: a stable three-digit
 *  label derived from the same seed the dungeon is built from. */
int game_season_number(void) {
    uint32_t h = g.season;
    h ^= h >> 16; h *= 0x7FEB352Du; h ^= h >> 15;
    return (int)(h % 899u) + 101;
}

/* --------------------------------------------------------------- chapter -- */

/*  A chapter is read, not fought. It runs on the same rule as a battle
 *  message: type the line out, wait to be dismissed, and stop for an answer
 *  when the line wants one. */
void chapter_begin(int chapter) {
    g.chapter = (uint8_t)chapter;
    g.cut_line = 0;
    g.cut_reveal = 0;
    g.cut_answer = 255;
    g.cut_choice = 0;
    g.cut_shake = 0;
    g.cut_backdrop = BD_STREET;
    game_set_scene(SCENE_CUTSCENE);
}

static const Chapter *chapter_now(void) {
    for (int i = 0; i < chapter_count; i++)
        if (chapters[i].chapter == g.chapter) return &chapters[i];
    return &chapters[0];
}

const CutLine *chapter_line(void) {
    const Chapter *c = chapter_now();
    if (g.cut_line >= c->count) return 0;
    return &c->lines[g.cut_line];
}

/*  What is on screen right now: the line itself, or the reply to the answer
 *  just given. Returns how much of it has been typed. */
int chapter_text(const char **out) {
    const CutLine *l = chapter_line();
    if (!l) { if (out) *out = ""; return 0; }
    const char *text = l->text;
    if ((l->flags & CUT_CHOICE) && g.cut_answer != 255)
        text = l->reply[g.cut_answer] ? l->reply[g.cut_answer] : l->text;
    if (out) *out = text;
    return g.cut_reveal;
}

int chapter_asking(void) {
    const CutLine *l = chapter_line();
    if (!l || !(l->flags & CUT_CHOICE) || g.cut_answer != 255) return 0;
    const char *text = l->text;
    int len = 0;
    while (text[len]) len++;
    return g.cut_reveal >= (uint16_t)len;      /* only once it has been read */
}

static void chapter_advance(void) {
    const CutLine *l = chapter_line();
    if (l && (l->flags & CUT_CHOICE) && g.cut_answer == 255) return;
    if (l && (l->flags & CUT_AWARD)) game_award(l->award);
    g.cut_line++;
    g.cut_reveal = 0;
    g.cut_answer = 255;
    g.cut_choice = 0;
    const CutLine *next = chapter_line();
    if (!next) {                                /* chapter over: into the floor */
        dungeon_enter(0);
        game_set_scene(SCENE_DUNGEON);
        return;
    }
    if (next->backdrop != BD_KEEP) g.cut_backdrop = next->backdrop;
    if (next->flags & CUT_SHAKE) g.cut_shake = 40;
    if (next->flags & CUT_FLASH) g.fade = 14;
}

void chapter_update(const PlatInput *in) {
    if (g.cut_shake) g.cut_shake--;
    const CutLine *l = chapter_line();
    if (!l) { chapter_advance(); return; }

    const char *text = 0;
    chapter_text(&text);
    int len = 0;
    while (text[len]) len++;
    int go = (in->pressed & (BTN_A | BTN_START)) || in->touch_pressed;

    if (g.cut_reveal < (uint16_t)len) {
        g.cut_reveal += 2;
        if (go || g.cut_reveal > (uint16_t)len) g.cut_reveal = (uint16_t)len;
        return;
    }

    if (chapter_asking()) {                     /* the line wants an answer */
        int n = 0;
        while (n < 3 && l->opt[n]) n++;
        if (in->pressed & BTN_DOWN) g.cut_choice = (uint8_t)((g.cut_choice + 1) % n);
        if (in->pressed & BTN_UP) g.cut_choice = (uint8_t)((g.cut_choice + n - 1) % n);
        for (int i = 0; i < n; i++) {
            Rect r = { 8, (int16_t)(96 + i * 30), 240, 26, 0 };
            if (touch_in(in, &r)) g.cut_choice = (uint8_t)i;
        }
        int fire = (in->pressed & BTN_A) != 0;
        for (int i = 0; i < n && !fire; i++) {
            Rect r = { 8, (int16_t)(96 + i * 30), 240, 26, 0 };
            if (touch_in(in, &r) && g.cut_choice == i) fire = 1;
        }
        if (fire) { g.cut_answer = g.cut_choice; g.cut_reveal = 0; }
        return;
    }

    if (go) chapter_advance();
}

/* ------------------------------------------------------------------ loop -- */

void game_boot(void) {
    memset(&g, 0, sizeof g);
    rng_seed(0x1BADCA7Du);
    party_new();
    g.scene = SCENE_TITLE;
    g.season = 0x1BADCA7Du;
    mapgen_build(0, g.season);          /* the title screen has a map behind it */
    publish_telemetry();
}

int game_frame(const PlatInput *in) {
    if (in->touching) g_last_touch = 0x1000000u | ((uint32_t)in->touch_x << 8) | (uint32_t)(in->touch_y & 0xFF);
    g.frame++;
    g.anim++;
    if (g.fade) g.fade--;
    if (g.hurt_flash) g.hurt_flash--;
    for (int i = 0; i < MAX_TOASTS; i++) if (g.toast[i].life) g.toast[i].life--;

    switch (g.scene) {
    case SCENE_TITLE:    update_title(in);   break;
    case SCENE_STORY:    update_story(in);   break;
    case SCENE_CUTSCENE: chapter_update(in); break;
    case SCENE_DUNGEON:  update_dungeon(in); break;
    case SCENE_BATTLE:   battle_update(in);  break;
    case SCENE_MENU:     update_menu(in);    break;
    case SCENE_SHOP:     update_shop(in);    break;
    case SCENE_BOX:      update_box(in);     break;
    case SCENE_LEVELUP:  update_levelup(in); break;
    case SCENE_CODE:     update_code(in);    break;
    case SCENE_GAMEOVER:
    case SCENE_VICTORY:  update_end(in);     break;
    default: break;
    }

    audio_frame();
    publish_telemetry();
    return render_frame();
}
