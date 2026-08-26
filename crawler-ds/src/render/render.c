/*  Every screen the game draws.
 *
 *  Two 16-bit buffers, redrawn from scratch each frame: the DS can afford it at
 *  this resolution and it keeps the drawing code honest — nothing here depends
 *  on what was on screen last frame.
 */
#include "gfx.h"
#include "theme.h"
#include "game.h"
#include "art.h"
#include "ui_layout.h"

void view3d_draw(Surface *s);
void view3d_arena(Surface *s, int floor_index);

/*  Book One covers the first two floors. The Over City is where Book Two
    goes, and everything below that is this game's own invention — the show
    runs eighteen floors whatever the books have got to. */
static const char *const kFloorNames[FLOORS] = {
    "FLOOR 1  THE TUTORIAL FLOOR",
    "FLOOR 2  THE BOROUGHS",
    "FLOOR 3  THE OVER CITY",
    "FLOOR 4  THE LONG COMMUTE",
    "FLOOR 5  THE PARKING STRUCTURE",
    "FLOOR 6  ADMINISTRATION",
    "FLOOR 7  THE WET FLOOR",
    "FLOOR 8  THE FULFILMENT CENTRE",
    "FLOOR 9  THE QUIET WARD",
    "FLOOR 10 THE GREEN ROOM",
    "FLOOR 11 THE STACKS",
    "FLOOR 12 CATERING",
    "FLOOR 13 THE CUTTING ROOM",
    "FLOOR 14 THE KENNELS",
    "FLOOR 15 THE LONG DARK RETAIL",
    "FLOOR 16 THE ARCHIVE",
    "FLOOR 17 THE BOARDROOM",
    "FLOOR 18 BROADCAST",
};

/*  Whoever is actually in that party slot this season. Everything below used
 *  to name Carl and Donut directly, which stopped being true the moment the
 *  roster did. */
static const Sprite *hero_sprite(int slot) {
    if (slot < 0 || slot >= PARTY) slot = 0;
    return sprite_table[crawler_defs[g.hero[slot].crawler].sprite];
}

/*  Every framed thing in the game goes through these two, so the chrome is
 *  one edit rather than ninety. A selected button swaps its gradient for the
 *  warm one and keeps the bevel, which reads as lit rather than as outlined. */
static void window(Surface *s, int x, int y, int w, int h, int lit) {
    gfx_window_shadow(s, x, y, w, h);
    gfx_window(s, x, y, w, h,
               lit ? C_SEL_TOP : C_WIN_TOP, lit ? C_SEL_BOT : C_WIN_BOT,
               lit ? C_SEL_HI : C_WIN_HI, C_WIN_LO, C_WIN_EDGE);
}

/*  The screen behind everything: a gradient with a faint weave in it, because
 *  a flat black background is the single loudest thing saying "terminal". */
static void backdrop(Surface *s) {
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, C_BG_TOP, C_BG_BOT);
    for (int y = 6; y < SCREEN_H; y += 16)      /* a faint weave, not a grid */
        gfx_dither(s, 0, y, SCREEN_W, 1, C_WIN_HI, 1);
    gfx_dither(s, 0, SCREEN_H - 26, SCREEN_W, 26, C_SHADOW, 3);
}

/* ------------------------------------------------------------- furniture -- */

static void system_bar(Surface *s, const char *left, const char *right) {
    gfx_vgradient(s, 0, 0, SCREEN_W, 14, C_WIN_TOP, C_WIN_BOT);
    gfx_hline(s, 0, SCREEN_W - 1, 0, C_WIN_HI);
    gfx_hline(s, 0, SCREEN_W - 1, 14, C_WIN_EDGE);
    gfx_hline(s, 0, SCREEN_W - 1, 13, C_WIN_LO);
    gfx_text(s, 5, 4, C_WIN_EDGE, left);
    gfx_text(s, 4, 3, C_AMBER, left);
    if (right) {
        int rx = SCREEN_W - 4 - gfx_text_width(right);
        gfx_text(s, rx + 1, 4, C_WIN_EDGE, right);
        gfx_text(s, rx, 3, C_INK, right);
    }
}

/*  "S347". The dungeon is generated per run, so which one you are in is real
 *  information and not decoration: two players comparing notes need it, and a
 *  recall code carries it. */
static void season_tag(Surface *s, int x, int y, uint16_t colour) {
    char tag[8];
    int n = game_season_number();
    tag[0] = 'S';
    tag[1] = (char)('0' + n / 100 % 10);
    tag[2] = (char)('0' + n / 10 % 10);
    tag[3] = (char)('0' + n % 10);
    tag[4] = 0;
    gfx_text(s, x, y, colour, tag);
}

/*  Health reads by colour before it reads by length, so the rule lives in one
 *  place: comfortable, hurt, about to go down. */
static uint16_t health_colour(int hp, int hp_max) {
    int pct = hp_max > 0 ? hp * 100 / hp_max : 0;
    return pct > 50 ? C_GREEN : pct > 20 ? C_GOLD : C_RED;
}

static void bar_meter(Surface *s, int x, int y, int w, int h, int value, int max,
                      uint16_t fill, const char *label) {
    if (max < 1) max = 1;
    if (value < 0) value = 0;
    int filled = value * (w - 2) / max;
    gfx_panel(s, x, y, w, h, C_VOID, C_EDGE);
    gfx_rect(s, x + 1, y + 1, filled, h - 2, fill);
    for (int i = 0; i < filled; i += 4) gfx_vline(s, x + 1 + i, y + 1, y + h - 2, gfx_scale_colour(fill, 20, 16));
    if (label) gfx_text(s, x + 3, y + (h - 7) / 2, C_INK, label);
}

static void toasts(Surface *s) {
    int y = SCREEN_H - 16;
    for (int i = 0; i < MAX_TOASTS; i++) {
        const Toast *t = &g.toast[i];
        if (!t->life) continue;
        int w = gfx_text_width(t->text) + 10;
        if (w > SCREEN_W - 8) w = SCREEN_W - 8;
        uint16_t edge = t->kind == 1 ? C_GOLD : t->kind == 2 ? C_MAGENTA : C_AMBER_DK;
        int slide = t->life > 170 ? (180 - t->life) * 2 : 0;
        gfx_panel(s, 4 - slide, y, w, 13, C_PANEL, edge);
        gfx_text(s, 9 - slide, y + 3, t->kind ? C_GOLD : C_INK, t->text);
        y -= 15;
        if (y < 40) break;
    }
}

static void party_strip(Surface *s, int y) {
    gfx_vgradient(s, 0, y - 6, SCREEN_W, 20, C_WIN_TOP, C_WIN_BOT);
    gfx_hline(s, 0, SCREEN_W - 1, y - 6, C_WIN_HI);
    gfx_hline(s, 0, SCREEN_W - 1, y + 13, C_WIN_EDGE);
    for (int i = 0; i < PARTY; i++) {
        const Hero *h = &g.hero[i];
        int x = 4 + i * 126;
        gfx_text(s, x, y, h->hp > 0 ? C_INK : C_RED, h->name);
        bar_meter(s, x + 40, y - 1, 50, 9, h->hp, h->hp_max, h->hp > h->hp_max / 4 ? C_GREEN : C_RED, 0);
        bar_meter(s, x + 94, y - 1, 24, 9, h->mp, h->mp_max, C_CYAN, 0);
    }
}

/* ---------------------------------------------------------------- title --- */

static void draw_title(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(10, 8, 18), RGB(44, 20, 40));
    for (int i = 0; i < 60; i++) {          /* falling rubble, forever */
        int x = (int)((i * 8641 + g.anim / 2 + i * i) % SCREEN_W);
        int y = (int)((i * 4211 + g.anim * (1 + (i & 3))) % SCREEN_H);
        gfx_pixel(top, x, y, gfx_scale_colour(C_AMBER, 6 + (i & 7), 16));
    }
    /* The title block, then a floor for the two of them to stand on. */
    gfx_rect(top, 0, 26, SCREEN_W, 44, RGB(14, 10, 20));
    gfx_hline(top, 0, SCREEN_W - 1, 26, C_AMBER_DK);
    gfx_hline(top, 0, SCREEN_W - 1, 69, C_AMBER_DK);
    gfx_text_big(top, 20, 32, C_AMBER, "DUNGEON CRAWLER");
    gfx_text_big(top, 96, 50, C_MAGENTA, "CARL");
    gfx_text(top, 26, 76, C_DIM, "EIGHTEEN FLOORS   one season at a time");

    int floor_y = SCREEN_H - 4;
    gfx_vgradient(top, 0, floor_y - 14, SCREEN_W, 18, RGB(16, 13, 22), RGB(34, 27, 38));
    gfx_hline(top, 0, SCREEN_W - 1, floor_y - 14, gfx_scale_colour(C_AMBER_DK, 10, 16));
    for (int i = 0; i < 3; i++)                       /* light pooling on the floor */
        gfx_dither(top, 0, floor_y - 12 + i * 5, SCREEN_W, 5, C_AMBER_DK, 6 - i * 2);
    gfx_sprite(top, hero_sprite(0), 22, floor_y - hero_sprite(0)->h);
    gfx_sprite(top, hero_sprite(1), SCREEN_W - 80, floor_y - hero_sprite(1)->h + 2);
    if (season_count()) {
        gfx_text(top, 24, 88, C_DIM, "Seasons run");
        gfx_text(top, 104, 88, C_INK, gfx_num(season_count()));
        gfx_text(top, 132, 88, C_DIM, "Deepest");
        gfx_text(top, 188, 88, C_AMBER, gfx_num(season_best_floor()));
        gfx_text(top, 24, 100, C_DIM, "Nobody who went down has come back up.");
    } else {
        gfx_text(top, 24, 92, C_INK, "Eighteen floors. Nobody is wearing shoes.");
    }

    backdrop(bot);
    gfx_vgradient(bot, 0, 0, SCREEN_W, 40, C_PANEL, C_VOID);
    gfx_text(bot, 8, 10, C_AMBER, "THE SYSTEM AWAITS YOUR DECISION");
    gfx_text(bot, 8, 24, C_DIM, "A season ends when the crawler does.");

    static const char *const opts[2] = { "NEW SEASON", "RESUME FROM CODE" };
    for (int i = 0; i < 2; i++) {
        int y = 118 + i * 32;
        int on = g.title_cursor == i;
        window(bot, 40, y, 176, i ? 24 : 26, on);
        gfx_text(bot, 40 + (176 - gfx_text_width(opts[i])) / 2, y + (i ? 8 : 9),
                 on ? C_AMBER : C_DIM, opts[i]);
    }
    gfx_text(bot, 8, 60, C_DIM, "D-PAD  walk and turn");
    gfx_text(bot, 8, 72, C_DIM, "A  act    B  back    START  party");
    gfx_text(bot, 8, 84, C_DIM, "L / R  sidestep     Y  quick heal");
    gfx_text(bot, 8, 96, C_DIM, "Or play it entirely with the stylus.");
    gfx_text(bot, 8, 178, C_DIM, "(c) fan work. Story by Matt Dinniman.");
}

/* ---------------------------------------------------------------- story --- */

static const Sprite *speaker_sprite(int speaker) {
    switch (speaker) {
    case SP_CARL:     return &spr_carl;
    case SP_DONUT:    return &spr_donut;
    case SP_MORDECAI: return &spr_mordecai;
    case SP_BOPCA:    return &spr_bopca;
    default: return 0;
    }
}

static void draw_story(Surface *top, Surface *bot) {
    const Beat *b = g.beat;
    int speaker = b ? b->lines[g.beat_line].speaker : SP_SYSTEM;

    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(12, 10, 20), RGB(28, 22, 44));
    for (int y = 0; y < SCREEN_H; y += 4)
        gfx_hline(top, 0, SCREEN_W - 1, y, gfx_scale_colour(RGB(40, 30, 60), 12, 16));

    const Sprite *portrait = speaker_sprite(speaker);
    if (portrait) {
        int bob = (g.anim / 16) % 2;
        gfx_sprite_scaled(top, portrait, 128 - portrait->w, 190 - portrait->h * 2 + bob, 200, 100);
    } else {
        /* The System has no face, so it gets a waveform. */
        for (int x = 0; x < SCREEN_W; x += 3) {
            int amp = 6 + ((x * 37 + g.anim * 3) % 23);
            gfx_vline(top, x, 120 - amp, 120 + amp, gfx_scale_colour(C_AMBER, 8 + (x & 7), 16));
        }
    }
    gfx_rect(top, 0, 0, SCREEN_W, 22, C_PANEL);
    gfx_hline(top, 0, SCREEN_W - 1, 22, speaker == SP_SYSTEM ? C_AMBER : C_MAGENTA);
    gfx_text(top, 6, 8, speaker == SP_SYSTEM ? C_AMBER : C_MAGENTA, speaker_names[speaker]);
    if (b) {
        gfx_text(top, SCREEN_W - 46, 8, C_DIM, gfx_num(g.beat_line + 1));
        gfx_text(top, SCREEN_W - 34, 8, C_DIM, "/");
        gfx_text(top, SCREEN_W - 26, 8, C_DIM, gfx_num(b->count));
    }

    backdrop(bot);
    window(bot, 4, 4, SCREEN_W - 8, SCREEN_H - 30, 0);
    if (b) {
        char shown[220];
        const char *src = b->lines[g.beat_line].text;
        int n = 0;
        while (src[n] && n < (int)sizeof shown - 1 && n < g.beat_reveal) { shown[n] = src[n]; n++; }
        shown[n] = 0;
        gfx_text_wrapped(bot, 12, 16, SCREEN_W - 24, C_INK, shown);
    }
    if (!b || g.beat_reveal > 200 || (g.anim & 32))
        gfx_text(bot, SCREEN_W - 116, SCREEN_H - 20, C_AMBER, "TAP OR PRESS A");
}

/* -------------------------------------------------------------- dungeon --- */

static void draw_map(Surface *s, int x0, int y0, int w, int h, int cell) {
    gfx_panel(s, x0, y0, w, h, C_VOID, C_EDGE);
    int cols = (w - 4) / cell, rows = (h - 4) / cell;

    /*  A lattice under the whole map, so the ground the party has not walked
     *  yet reads as somewhere they have not been rather than as a hole in the
     *  screen. It also says how big the floor is before they have seen it. */
    for (int j = 0; j <= rows; j++)
        for (int i = 0; i <= cols; i++)
            gfx_pixel(s, x0 + 2 + i * cell, y0 + 2 + j * cell, RGB(38, 42, 60));

    int cx = g.dun.px - cols / 2, cy = g.dun.py - rows / 2;
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cx + cols > g.dun.w) cx = g.dun.w - cols;
    if (cy + rows > g.dun.h) cy = g.dun.h - rows;
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;

    for (int j = 0; j < rows; j++) {
        for (int i = 0; i < cols; i++) {
            int mx = cx + i, my = cy + j;
            if (!dungeon_seen(mx, my)) continue;
            char t = dungeon_tile(mx, my);
            int px = x0 + 2 + i * cell, py = y0 + 2 + j * cell;
            if (t == T_WALL) {
                gfx_rect(s, px, py, cell, cell, RGB(62, 66, 88));
                continue;
            }
            gfx_rect(s, px, py, cell, cell, RGB(26, 32, 46));
            uint16_t mark = 0;
            switch (t) {
            case T_DOWN: mark = C_GREEN; break;
            case T_UP:   mark = C_DIM; break;
            case T_SHOP: mark = C_GOLD; break;
            case T_SHRINE: mark = C_CYAN; break;
            case T_KIOSK: mark = C_AMBER; break;
            case T_BOSS: mark = C_RED; break;
            case T_NBOSS: mark = C_MAGENTA; break;
            case T_DOOR: mark = RGB(150, 110, 60); break;
            case T_BOX: case T_BOX_GOLD:
                mark = dungeon_is_used(mx, my) ? 0 : (t == T_BOX_GOLD ? C_GOLD : RGB(190, 130, 80));
                break;
            default: break;
            }
            if (mark) gfx_rect(s, px + 1, py + 1, cell - 2, cell - 2, mark);
        }
    }
    /* The party: a wedge pointing where they face. */
    int px = x0 + 2 + (g.dun.px - cx) * cell + cell / 2;
    int py = y0 + 2 + (g.dun.py - cy) * cell + cell / 2;
    static const int8_t arrow[4][6] = {
        {  0, -3, -2, 2, 2, 2 }, {  3, 0, -2, -2, -2, 2 },
        {  0,  3,  2, -2, -2, -2 }, { -3, 0, 2, 2, 2, -2 },
    };
    const int8_t *a = arrow[g.dun.facing];
    gfx_pixel(s, px + a[0], py + a[1], C_MAGENTA);
    for (int i = 0; i < 3; i++) {
        gfx_pixel(s, px + a[0] / 2, py + a[1] / 2, C_MAGENTA);
        gfx_pixel(s, px + a[2] + i * (a[4] - a[2]) / 2, py + a[3] + i * (a[5] - a[3]) / 2, C_MAGENTA);
    }
    gfx_rect(s, px - 1, py - 1, 3, 3, C_MAGENTA);
}

static void draw_button(Surface *s, const Rect *r, int on) {
    window(s, r->x, r->y, r->w, r->h, on);
    if (r->label) {
        int tx = r->x + (r->w - gfx_text_width(r->label)) / 2;
        int ty = r->y + (r->h - 7) / 2;
        gfx_text(s, tx + 1, ty + 1, C_WIN_EDGE, r->label);      /* text shadow */
        gfx_text(s, tx, ty, on ? C_SEL_HI : C_INK, r->label);
    }
}

static void draw_dungeon(Surface *top, Surface *bot) {
    view3d_draw(top);
    if (g.hurt_flash) gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 16 + g.hurt_flash);

    int secs = g.dun.collapse > 0 ? (int)(g.dun.collapse / 60) : 0;
    char timer[10];
    {
        char mm[6];
        const char *src = gfx_num(secs / 60);          /* copy: gfx_num reuses its buffer */
        int o = 0;
        while (*src && o < 5) mm[o++] = *src++;
        mm[o] = 0;
        const char *ss = gfx_numpad(secs % 60, 2);
        o = 0;
        for (const char *p2 = mm; *p2; p2++) timer[o++] = *p2;
        timer[o++] = ':';
        while (*ss) timer[o++] = *ss++;
        timer[o] = 0;
    }
    {   /*  "F3 GOBLIN WORKSHOP": which floor, and where on it. */
        char where[40];
        int o = 0;
        where[o++] = 'F';
        for (const char *p = gfx_num(g.dun.index + 1); *p; p++) where[o++] = *p;
        where[o++] = ' ';
        for (const char *p = zone_defs[dungeon_zone()].name;
             *p && o < (int)sizeof where - 1; p++) where[o++] = *p;
        where[o] = 0;
        system_bar(top, where, secs ? timer : "COLLAPSING");
    }
    if (!secs && (g.anim & 16)) gfx_rect(top, 0, 0, SCREEN_W, 13, C_BLOOD);
    if (!secs) gfx_text(top, SCREEN_W - 4 - gfx_text_width("COLLAPSING"), 3, C_RED, "COLLAPSING");
    toasts(top);

    backdrop(bot);
    gfx_rect(bot, 0, 0, SCREEN_W, 22, C_PANEL);
    party_strip(bot, 7);
    gfx_hline(bot, 0, SCREEN_W - 1, 22, C_AMBER_DK);

    /*  The map is a hole in the console, so it gets an inset frame: dark
        bevel on the top and left, light on the bottom and right — the
        opposite of a button, which is what makes it read as recessed. */
    gfx_window(bot, 3, 25, SCREEN_W - 6, 88, C_WIN_LO, C_WIN_LO,
               C_WIN_LO, C_WIN_HI, C_WIN_EDGE);
    draw_map(bot, 6, 28, SCREEN_W - 12, 82, g.menu_cursor & 1 ? 8 : 6);

    /*  The d-pad needs somewhere to live, or four floating diamonds read as
        an unfinished screen. The housing also keeps the run's numbers off it. */
    window(bot, 2, 114, 96, 76, 0);
    for (int i = 0; i < 4; i++) draw_button(bot, &kDunPad[i], 0);
    for (int i = 0; i < 4; i++) draw_button(bot, &kDunActions[i], 0);

    window(bot, 100, 174, 152, 16, 0);
    gfx_text(bot, 106, 178, C_DIM, "GOLD");
    gfx_text(bot, 134, 178, C_GOLD, gfx_num(g.gold));
    gfx_text(bot, 180, 178, C_DIM, "BOXES");
    gfx_text(bot, 222, 178, C_INK, gfx_num(g.boxes_opened));
}

/* --------------------------------------------------------------- battle --- */


static void draw_damage_pops(Surface *s) {
    for (int i = 0; i < PARTY + MAX_FOES; i++) {
        if (!g.bat.pop_life[i]) continue;
        int rise = (40 - g.bat.pop_life[i]) / 3;
        int x, y;
        if (i < PARTY) { x = 40 + i * 150; y = 168 - rise; }
        else {
            int n = g.bat.n_foes ? g.bat.n_foes : 1;
            x = (SCREEN_W / n) * (i - PARTY) + SCREEN_W / (2 * n);
            y = 120 - rise;
        }
        int amount = g.bat.pop_damage[i];
        uint16_t c = amount < 0 ? C_GREEN : C_AMBER;
        const char *txt = gfx_num(amount < 0 ? -amount : amount);
        gfx_text_shadow(s, x - gfx_text_width(txt) / 2, y, c, C_SHADOW, txt);
    }
}

/*  The arena is drawn by the corridor renderer, so a fight happens in the same
 *  place the party were standing. All this adds is the show's lighting rig,
 *  which is the one thing down there that is not part of the building. */
static void draw_arena(Surface *s, int floor_index) {
    view3d_arena(s, floor_index);
    for (int i = 0; i < 4; i++) {                 /* studio lights */
        int x = 26 + i * 68;
        int pulse = 10 + ((g.anim / 3 + i * 7) & 5);
        gfx_rect(s, x, 4, 14, 5, gfx_scale_colour(C_AMBER, pulse, 16));
        gfx_rect(s, x, 9, 14, 1, gfx_scale_colour(C_AMBER, 4, 16));
        gfx_dither(s, x - 6, 10, 26, 20, gfx_scale_colour(C_AMBER, 5, 16), 5);
    }
}

/*  A Pokemon battle box: name, level, a health bar that changes colour as it
 *  empties, and — on your own side only — the numbers. The shape is doing the
 *  work here, so it is drawn rather than assembled out of panels: a slab with
 *  one corner cut, pointing at whoever it belongs to. */
static void hp_box(Surface *s, int x, int y, int w, const char *name, int level,
                   int hp, int hp_max, int mine) {
    const int h = 24;
    window(s, x, y, w, h, 0);
    gfx_hline(s, x + 1, x + w - 2, y + 1, gfx_scale_colour(C_INK, 3, 16));
    gfx_text(s, x + 5, y + 4, C_INK, name);
    gfx_text(s, x + w - 26, y + 4, C_DIM, "L");
    gfx_text(s, x + w - 20, y + 4, C_AMBER, gfx_num(level));

    if (hp_max < 1) hp_max = 1;
    if (hp < 0) hp = 0;

    /*  Your own numbers sit on the bar's line rather than under it. Two of
     *  these stack above the message box, and the row they used to take was
     *  the band the foes stand in. */
    char num[16];
    int nw = 0;
    if (mine) {
        int o = 0;
        for (const char *p = gfx_num(hp); *p; p++) num[o++] = *p;
        num[o++] = '/';
        for (const char *p = gfx_num(hp_max); *p; p++) num[o++] = *p;
        num[o] = 0;
        nw = gfx_text_width(num) + 4;
    }
    int bx = x + 24, by = y + 15, bw = w - 30 - nw;
    gfx_text(s, x + 5, by - 1, C_GOLD, "HP");
    gfx_panel(s, bx, by, bw, 6, C_VOID, C_EDGE);
    int filled = hp * (bw - 2) / hp_max;
    int pct = hp * 100 / hp_max;
    if (filled > 0) gfx_rect(s, bx + 1, by + 1, filled, 4, health_colour(hp, hp_max));
    if (pct <= 20 && (g.anim & 16)) gfx_rect(s, bx + 1, by + 1, filled, 4, C_INK);
    if (mine) gfx_text(s, x + w - 5 - gfx_text_width(num), by - 1, C_INK, num);
}

/*  The message box across the bottom of the battle, typed out a couple of
 *  characters a frame with the little blinking marker that says the game is
 *  waiting for you and not stuck. */
static void message_box(Surface *s) {
    const char *line = 0;
    int reveal = battle_message(&line);
    int y = SCREEN_H - 38;
    window(s, 4, y, SCREEN_W - 8, 34, 0);
    gfx_hline(s, 6, SCREEN_W - 7, y + 2, gfx_scale_colour(C_AMBER_DK, 8, 16));
    if (!line || !*line) return;

    char shown[48];
    int n = 0;
    for (const char *p = line; *p && n < (int)sizeof shown - 1; p++) {
        if (reveal >= 0 && n >= reveal) break;
        shown[n++] = *p;
    }
    shown[n] = 0;
    gfx_text_wrapped(s, 10, y + 8, SCREEN_W - 20, C_INK, shown);
    int done = reveal < 0 || !line[n];
    if (done && (g.anim & 16))
        gfx_text(s, SCREEN_W - 18, y + 22, C_AMBER, "\177");
}

/*  The foes, listed with the health the top screen only hints at. Up there the
 *  Pokemon idiom holds -- a bar and no numbers for the other side -- but the
 *  touch screen is where the fight actually gets planned, so it gets the
 *  detail, and it fills the band above the command buttons that was bare. */
static void foe_roster(Surface *bot, int y) {
    for (int i = 0; i < g.bat.n_foes; i++) {
        const Foe *f = &g.bat.foes[i];
        const FoeDef *def = &foe_defs[f->def];
        int row = y + i * 17;
        int targeted = g.bat.phase == BAT_TARGET && g.bat.target == i;
        window(bot, 6, row, 244, 16, targeted);
        gfx_text(bot, 12, row + 5, f->alive ? (targeted ? C_AMBER : C_INK) : C_DIM, def->name);
        if (!f->alive) {
            gfx_text(bot, 208, row + 5, C_DIM, "DOWN");
            continue;
        }
        gfx_text(bot, 140, row + 5, C_DIM, "HP");
        bar_meter(bot, 156, row + 5, 88, 6, f->hp, f->hp_max,
                  health_colour(f->hp, f->hp_max), 0);
    }
}

static void draw_battle(Surface *top, Surface *bot) {
    int floor_index = g.dun.index;
    draw_arena(top, floor_index);

    /*  Foes on the far side, party in the near corner, the way the camera sits
     *  in every turn-based fight since 1996. */
    int msg_top = SCREEN_H - 38;
    for (int i = 0; i < g.bat.n_foes; i++) {
        const Foe *f = &g.bat.foes[i];
        const Sprite *sp = sprite_table[foe_defs[f->def].sprite];
        int scale = g.bat.boss ? 104 : g.bat.n_foes >= 3 ? 64 : g.bat.n_foes == 2 ? 80 : 104;
        int fw = sp->w * scale / 100, fh = sp->h * scale / 100;
        int fx = SCREEN_W - 20 - fw - i * (g.bat.n_foes >= 3 ? 58 : 74);
        /*  High enough to clear the party's boxes, which sit in the bottom
            right: a foe drawn under them reads as clipped. */
        int fy = 16 + (i & 1) * 12 - (int)((g.anim / 14 + i) & 1);
        if (fx < 4) fx = 4;
        for (int k = 0; k < 4; k++)                 /* the platform it stands on */
            gfx_dither(top, fx + k, fy + fh + k - 2, fw - k * 2, 1, C_SHADOW, 12 - k * 3);
        if (!f->alive) { gfx_shade(top, fx, fy, fw, fh, 11); continue; }
        gfx_sprite_scaled(top, sp, fx, fy, scale, 100);
        if (g.bat.shake && g.bat.target == i)
            gfx_shade(top, fx, fy, fw, fh, 10);
    }

    {
        int bob = (g.anim / 12) & 1;
        const Sprite *c = hero_sprite(0), *dn = hero_sprite(1);
        const int party_scale = 72;
        int cw = c->w * party_scale / 100, ch = c->h * party_scale / 100;
        int dw = dn->w * party_scale / 100, dh = dn->h * party_scale / 100;
        int base = msg_top - 6;
        for (int i = 0; i < 5; i++)
            gfx_dither(top, 6 + i, base - 3 + i, cw - i * 2, 1, C_SHADOW, 13 - i * 2);
        gfx_sprite_scaled(top, c, 4, base - ch + bob, party_scale, 100);
        gfx_sprite_scaled(top, dn, 4 + cw + 2, base - dh - bob, party_scale, 100);
        if (g.hero[0].hp <= 0) gfx_shade(top, 4, base - ch, cw, ch, 9);
        if (g.hero[1].hp <= 0) gfx_shade(top, 4 + cw + 2, base - dh, dw, dh, 9);
    }
    draw_damage_pops(top);
    if (g.hurt_flash) gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 16 + g.hurt_flash);

    /*  Their boxes on the left, yours on the right: opposite corners, so a
     *  glance tells you which side is losing. */
    for (int i = 0, shown = 0; i < g.bat.n_foes; i++) {
        const Foe *f = &g.bat.foes[i];
        if (!f->alive) continue;
        hp_box(top, 4, 4 + shown * 27, 116, foe_defs[f->def].name,
               foe_defs[f->def].floor ? foe_defs[f->def].floor : g.dun.index + 1,
               f->hp, f->hp_max, 0);
        shown++;
    }
    for (int i = 0; i < PARTY; i++)
        hp_box(top, SCREEN_W - 122, msg_top - 56 + i * 28, 118,
               g.hero[i].name, g.hero[i].level, g.hero[i].hp, g.hero[i].hp_max, 1);

    message_box(top);

    if (g.bat.phase == BAT_WON) {
        window(top, 44, 56, 168, 44, 0);
        gfx_text_big(top, 74, 62, C_GOLD, "WON");
        gfx_text(top, 54, 82, C_INK, "XP");
        gfx_text(top, 76, 82, C_AMBER, gfx_num(g.bat.xp_won));
        gfx_text(top, 130, 82, C_INK, "GOLD");
        gfx_text(top, 164, 82, C_GOLD, gfx_num(g.bat.gold_won));
    }
    if (g.bat.phase == BAT_LOST) {
        gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 7);
        gfx_text_big(top, 40, 70, C_RED, "PARTY DOWN");
    }

    /* ---- bottom screen: the four buttons, and what each opens -------------- */
    backdrop(bot);
    gfx_rect(bot, 0, 0, SCREEN_W, 20, C_PANEL);
    party_strip(bot, 6);
    gfx_hline(bot, 0, SCREEN_W - 1, 20, C_AMBER_DK);

    if (battle_message(0) >= 0) {                   /* reading: no menu yet */
        gfx_text(bot, 6, 26, C_AMBER, "AGAINST YOU");
        foe_roster(bot, 36);
        gfx_text(bot, 8, 176, C_DIM, "A or tap to continue");
        return;
    }

    if (g.bat.phase == BAT_SKILL) {
        const SkillDef *skills[8];
        int n = game_hero_skills(g.bat.actor, skills, 8);
        gfx_text(bot, 6, 24, C_AMBER, "MOVES");
        for (int i = 0; i < n; i++) {
            int on = g.bat.cursor == i;
            int afford = g.hero[g.bat.actor].mp >= skills[i]->cost;
            window(bot, 6, 30 + i * 18, 244, 17, on);
            gfx_text(bot, 12, 35 + i * 18, afford ? (on ? C_AMBER : C_INK) : C_DIM, skills[i]->name);
            gfx_text(bot, 186, 35 + i * 18, C_DIM, "SP");
            gfx_text(bot, 204, 35 + i * 18, afford ? C_CYAN : C_RED, gfx_num(skills[i]->cost));
        }
        if (n) gfx_text_wrapped(bot, 6, 142, 244, C_DIM, skills[g.bat.cursor < n ? g.bat.cursor : 0]->blurb);
        draw_button(bot, &kBatCommands[BAT_BACK], 0);
        return;
    }
    if (g.bat.phase == BAT_ITEM) {
        gfx_text(bot, 6, 24, C_AMBER, "BAG");
        int shown = 0;
        for (int i = 1; i < item_count && shown < 6; i++) {
            if (!g.inventory[i]) continue;
            int k = item_defs[i].kind;
            if (k != IT_HEAL && k != IT_STAMINA && k != IT_BOMB && k != IT_REVIVE && k != IT_BUFF) continue;
            int on = g.bat.cursor == shown;
            window(bot, 6, 30 + shown * 18, 244, 17, on);
            gfx_text(bot, 12, 35 + shown * 18, on ? C_AMBER : C_INK, item_defs[i].name);
            gfx_text(bot, 208, 35 + shown * 18, C_INK, "x");
            gfx_text(bot, 216, 35 + shown * 18, C_INK, gfx_num(g.inventory[i]));
            shown++;
        }
        if (!shown) gfx_text(bot, 12, 40, C_DIM, "The bag is empty. Bold strategy.");
        draw_button(bot, &kBatCommands[BAT_BACK], 0);
        return;
    }
    if (g.bat.phase == BAT_TARGET) {
        gfx_text(bot, 6, 24, C_AMBER, "WHICH ONE");
        for (int i = 0; i < g.bat.n_foes; i++) {
            if (!g.bat.foes[i].alive) continue;
            Rect r = { (int16_t)(8 + i * 82), 40, 76, 40, 0 };
            draw_button(bot, &r, g.bat.target == i);
            gfx_text(bot, r.x + 4, r.y + 6, g.bat.target == i ? C_AMBER : C_INK,
                     foe_defs[g.bat.foes[i].def].name);
            bar_meter(bot, r.x + 4, r.y + 24, 68, 8, g.bat.foes[i].hp, g.bat.foes[i].hp_max,
                      health_colour(g.bat.foes[i].hp, g.bat.foes[i].hp_max), 0);
        }
        draw_button(bot, &kBatCommands[BAT_BACK], 0);
        return;
    }

    /*  actor indexes the party for 0..PARTY-1 and the foes above that, so the
        prompt is only asking anybody anything while a hero has the turn. */
    if (g.bat.phase != BAT_CHOOSE || g.bat.actor >= PARTY) {
        /*  Somebody else's turn. The screen still carries the roster, because a
         *  touch screen that empties out mid-fight reads as the game hanging. */
        int foe = g.bat.actor - PARTY;
        gfx_text(bot, 6, 26, C_AMBER, "AGAINST YOU");
        if (foe >= 0 && foe < g.bat.n_foes) {
            const char *name = foe_defs[g.bat.foes[foe].def].name;
            gfx_text(bot, 6, 176, C_MAGENTA, name);
            gfx_text(bot, 6 + gfx_text_width(name) + 4, 176, C_DIM, "is taking its turn.");
        }
        foe_roster(bot, 36);
        return;
    }
    {
        const char *who = g.hero[g.bat.actor].name;
        gfx_text(bot, 6, 26, C_DIM, "What will");
        gfx_text(bot, 62, 26, C_MAGENTA, who);
        gfx_text(bot, 62 + gfx_text_width(who) + 4, 26, C_DIM, "do?");
    }
    foe_roster(bot, 38);
    for (int i = 0; i < 4; i++)
        draw_button(bot, &kBatCommands[i], g.bat.cursor == i);
}

/* ----------------------------------------------------------------- draft -- */

static void draw_draft(Surface *top, Surface *bot)
{
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(10, 8, 18), RGB(34, 16, 34));
    for (int i = 0; i < 50; i++) {                 /* the studio, always on */
        int x = (int)((i * 8641 + g.anim / 2) % SCREEN_W);
        int y = (int)((i * 4211 + g.anim) % SCREEN_H);
        gfx_pixel(top, x, y, gfx_scale_colour(C_MAGENTA, 4 + (i & 5), 16));
    }
    {
        char label[24];
        int o = 0;
        for (const char *p = "SEASON "; *p; p++) label[o++] = *p;
        for (const char *p = gfx_num(game_season_number()); *p; p++) label[o++] = *p;
        label[o] = 0;
        system_bar(top, label, "WHO IS GOING DOWN");
    }

    /*  The two chairs. An empty one is a silhouette, because the shape of the
        decision is "two of them" before it is "which two". */
    for (int i = 0; i < PARTY; i++) {
        int x = 14 + i * 122;
        int filled = i < g.draft_slot;              /* chairs fill in order */
        int previewing = (i == g.draft_slot);
        gfx_panel(top, x, 22, 110, 132, C_PANEL, previewing ? C_AMBER : C_EDGE);
        const CrawlerDef *c = &crawler_defs[filled ? g.draft_pick[i] : g.draft_cursor];
        const Sprite *sp = sprite_table[c->sprite];
        int sw = sp->w * 88 / 100;
        if (filled || previewing) {
            gfx_sprite_scaled(top, sp, x + (110 - sw) / 2, 30, 88, 100);
            if (previewing) gfx_shade(top, x + 2, 24, 106, 100, 8);   /* not yours yet */
            gfx_text(top, x + 6, 126, filled ? C_AMBER : C_DIM, c->name);
            gfx_text(top, x + 6, 138, C_DIM, filled ? c->title : "not confirmed");
        } else {
            gfx_text(top, x + 30, 74, C_DIM, "EMPTY");
            gfx_text(top, x + 12, 126, C_DIM, "second chair");
        }
    }
    {
        const CrawlerDef *c = &crawler_defs[g.draft_cursor];
        window(top, 6, 158, SCREEN_W - 12, 30, 0);
        gfx_text(top, 12, 163, C_MAGENTA, c->name);
        gfx_text_wrapped(top, 12, 174, SCREEN_W - 24, C_INK, c->blurb);
    }

    /* ---- the roster ------------------------------------------------------- */
    backdrop(bot);
    gfx_rect(bot, 0, 0, SCREEN_W, 22, C_PANEL);
    gfx_text(bot, 8, 7, C_AMBER, g.draft_slot ? "AND WHO ELSE" : "PICK A CRAWLER");
    gfx_hline(bot, 0, SCREEN_W - 1, 22, C_AMBER_DK);

    for (int i = 0; i < crawler_count; i++) {
        int x = 6 + (i % 2) * 124, y = 30 + (i / 2) * 60;
        int on = g.draft_cursor == i;
        int taken = g.draft_slot == 1 && g.draft_pick[0] == i;
        gfx_panel(bot, x, y, 120, 56, on ? C_PANEL_LIT : C_PANEL,
                  on ? C_AMBER : taken ? C_DIM : C_EDGE);
        const CrawlerDef *c = &crawler_defs[i];
        const Sprite *sp = sprite_table[c->sprite];
        gfx_sprite_scaled(bot, sp, x + 4, y + 3, 68, 100);
        gfx_text(bot, x + 46, y + 8, taken ? C_DIM : on ? C_AMBER : C_INK, c->name);
        gfx_text(bot, x + 46, y + 20, C_DIM, c->title);
        const Stats *st = &c->st;
        gfx_text(bot, x + 46, y + 34, C_DIM, "STR");
        gfx_text(bot, x + 68, y + 34, C_INK, gfx_num(st->str));
        gfx_text(bot, x + 84, y + 34, C_DIM, "DEX");
        gfx_text(bot, x + 106, y + 34, C_INK, gfx_num(st->dex));
        gfx_text(bot, x + 46, y + 44, C_DIM, "CON");
        gfx_text(bot, x + 68, y + 44, C_INK, gfx_num(st->con));
        gfx_text(bot, x + 84, y + 44, C_DIM, "LCK");
        gfx_text(bot, x + 106, y + 44, C_INK, gfx_num(st->luck));
        if (taken) gfx_shade(bot, x, y, 120, 56, 9);
    }

    {
        Rect go = { 6, 158, 244, 28, "DESCEND" };
        int ready = g.draft_slot >= 1 && g.draft_pick[0] != g.draft_cursor;
        gfx_panel(bot, go.x, go.y, go.w, go.h, ready ? C_PANEL_LIT : C_PANEL,
                  ready ? C_AMBER : C_EDGE);
        gfx_text(bot, go.x + 96, go.y + 11, ready ? C_AMBER : C_DIM,
                 g.draft_slot ? "DESCEND" : "PICK TWO");
    }
}

/* -------------------------------------------------------------- cutscene -- */

/*  Five backdrops, drawn rather than stored: a street at three in the morning,
 *  the same street ninety seconds later, the sky when it starts talking, the
 *  stairwell, and the first corridor. Each is a gradient, a silhouette and one
 *  moving thing, which is all a backdrop has to be when the words are doing
 *  the work. */
static void backdrop_street(Surface *s, int lit)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(6, 7, 16), RGB(20, 22, 40));
    for (int i = 0; i < 7; i++) {                       /* blocks against the sky */
        int bx = i * 40 - 8, bw = 34;
        int bh = 70 + ((i * 37) % 5) * 12;
        gfx_rect(s, bx, SCREEN_H - bh - 26, bw, bh, RGB(10, 11, 20));
        for (int wy = 0; wy < bh - 12; wy += 12)        /* a few lights still on */
            for (int wx = 0; wx < bw - 8; wx += 10)
                if (((i * 7 + wx + wy) % 11) < 3)
                    gfx_rect(s, bx + 4 + wx, SCREEN_H - bh - 20 + wy, 4, 5,
                             RGB(90, 80, 40));
    }
    gfx_rect(s, 0, SCREEN_H - 26, SCREEN_W, 26, RGB(14, 14, 20));
    gfx_hline(s, 0, SCREEN_W - 1, SCREEN_H - 26, RGB(30, 30, 42));
    for (int i = 0; i < 70; i++) {                      /* rain, going sideways */
        int x = (i * 53 + g.anim * 3) % (SCREEN_W + 40) - 20;
        int y = (i * 31 + g.anim * 6) % SCREEN_H;
        gfx_pixel(s, x, y, RGB(60, 70, 100));
        gfx_pixel(s, x + 1, y + 2, RGB(40, 48, 70));
    }
    if (lit) {                                          /* the cat, up the ironwork */
        for (int y = 96; y < SCREEN_H - 26; y += 8)     /* the ladder she went up */
            gfx_rect(s, 172, y, 22, 2, RGB(58, 58, 74));
        gfx_rect(s, 170, 96, 3, SCREEN_H - 122, RGB(72, 72, 88));
        gfx_rect(s, 192, 96, 3, SCREEN_H - 122, RGB(48, 48, 62));
        gfx_rect(s, 148, 92, 60, 4, RGB(76, 76, 92));  /* the landing she is on */
        gfx_hline(s, 148, 207, 92, RGB(104, 104, 120));
        gfx_sprite_scaled(s, &spr_donut, 162, 92 - spr_donut.h * 52 / 100, 52, 100);
    }
    gfx_sprite_scaled(s, &spr_carl, 40, SCREEN_H - 26 - spr_carl.h * 78 / 100, 78, 100);
}

static void backdrop_collapse(Surface *s)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(36, 14, 10), RGB(12, 8, 10));
    for (int i = 0; i < 7; i++) {                       /* what is left of them */
        int bx = i * 40 - 8, bw = 34;
        int bh = 10 + ((i * 29) % 4) * 8;
        gfx_rect(s, bx, SCREEN_H - bh - 26, bw, bh, RGB(16, 12, 14));
    }
    gfx_rect(s, 0, SCREEN_H - 26, SCREEN_W, 26, RGB(20, 16, 16));
    for (int i = 0; i < 120; i++) {                     /* dust, going up */
        int x = (i * 71 + g.anim) % SCREEN_W;
        int y = SCREEN_H - ((i * 37 + g.anim * 2) % SCREEN_H);
        gfx_pixel(s, x, y, i & 1 ? RGB(80, 66, 58) : RGB(52, 42, 40));
    }
    gfx_sprite_scaled(s, &spr_carl, 40, SCREEN_H - 26 - spr_carl.h * 78 / 100, 78, 100);
}

static void backdrop_announce(Surface *s)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(4, 4, 8), RGB(14, 6, 20));
    for (int i = 0; i < 40; i++) {                      /* the broadcast carrier */
        int y = (i * 9 + g.anim / 2) % SCREEN_H;
        gfx_hline(s, 0, SCREEN_W - 1, y, RGB(18, 10, 26));
    }
    int w = 200, x = (SCREEN_W - w) / 2;
    window(s, x, 62, w, 60, 0);
    gfx_text_big(s, x + 20, 72, C_MAGENTA, "THE SYSTEM");
    gfx_text(s, x + 20, 96, C_DIM, "BORANT CORPORATION");
    gfx_text(s, x + 20, 108, C_AMBER, "DUNGEON CRAWLER WORLD");
    if (g.anim & 16) gfx_rect(s, x + w - 22, 68, 8, 8, C_RED);
}

static void backdrop_stairs(Surface *s)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(10, 10, 16), RGB(4, 4, 6));
    for (int i = 0; i < 9; i++) {                       /* steps going down */
        int inset = i * 12;
        gfx_rect(s, 40 + inset, 30 + i * 16, SCREEN_W - 80 - inset * 2, 12,
                 gfx_scale_colour(RGB(70, 66, 76), 14 - i, 16));
        gfx_hline(s, 40 + inset, SCREEN_W - 41 - inset, 30 + i * 16, RGB(26, 24, 30));
    }
    gfx_rect(s, 112, 158, 32, 34, RGB(2, 2, 4));
    gfx_sprite_scaled(s, hero_sprite(0), 22, 120, 70, 100);
    gfx_sprite_scaled(s, hero_sprite(1), 186, 128, 58, 100);
}

static void draw_cutscene(Surface *top, Surface *bot)
{
    int shake = g.cut_shake ? (int)((g.anim * 7) % 5) - 2 : 0;

    switch (g.cut_backdrop) {
    case BD_STREET:     backdrop_street(top, 0); break;
    case BD_STREET_CAT: backdrop_street(top, 1); break;
    case BD_COLLAPSE:   backdrop_collapse(top);  break;
    case BD_ANNOUNCE:   backdrop_announce(top);  break;
    case BD_STAIRS:     backdrop_stairs(top);    break;
    default:            draw_arena(top, 0);      break;
    }
    if (shake) {                    /* a cheap jolt: bands of the frame slid sideways */
        for (int y = 0; y < SCREEN_H; y += 4)
            gfx_rect(top, 0, y, (shake < 0 ? -shake : shake), 4, RGB(0, 0, 0));
    }
    if (g.fade) gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 16 + g.fade);

    {
        const Chapter *c = 0;
        for (int i = 0; i < chapter_count; i++)
            if (chapters[i].chapter == g.chapter) c = &chapters[i];
        char label[24];
        int o = 0;
        for (const char *p = "CHAPTER "; *p; p++) label[o++] = *p;
        for (const char *p = gfx_num(g.chapter); *p; p++) label[o++] = *p;
        label[o] = 0;
        system_bar(top, label, c ? c->title : "");
    }

    /* ---- the words, on the screen you are holding a stylus over ---------- */
    backdrop(bot);
    gfx_vgradient(bot, 0, 0, SCREEN_W, 30, C_PANEL, C_VOID);

    const CutLine *l = chapter_line();
    if (!l) return;
    const char *text = 0;
    int reveal = chapter_text(&text);

    const char *who = speaker_names[l->speaker];
    if (who && *who) {
        uint16_t tint = l->speaker == SP_SYSTEM ? C_MAGENTA
                      : l->speaker == SP_CARL   ? C_AMBER
                      : l->speaker == SP_DONUT  ? C_GOLD : C_INK;
        gfx_text(bot, 8, 9, tint, who);
    }

    char shown[320];
    int n = 0;
    for (const char *p = text; *p && n < (int)sizeof shown - 1 && n < reveal; p++)
        shown[n++] = *p;
    shown[n] = 0;
    window(bot, 4, 24, SCREEN_W - 8, chapter_asking() ? 64 : 120, 0);
    gfx_text_wrapped(bot, 10, 30, SCREEN_W - 20, C_INK, shown);

    if (chapter_asking()) {
        int count = 0;
        while (count < 3 && l->opt[count]) count++;
        for (int i = 0; i < count; i++) {
            Rect r = { 8, (int16_t)(96 + i * 30), 240, 26, 0 };
            int on = g.cut_choice == i;
            gfx_panel(bot, r.x, r.y, r.w, r.h, on ? C_PANEL_LIT : C_PANEL,
                      on ? C_AMBER : C_EDGE);
            gfx_text(bot, r.x + 10, r.y + 9, on ? C_AMBER : C_INK, l->opt[i]);
            if (on) gfx_text(bot, r.x + 2, r.y + 9, C_AMBER, "\177");
        }
        return;
    }
    if (!text[n] && (g.anim & 16))
        gfx_text(bot, SCREEN_W - 16, 132, C_AMBER, "\177");
}

/* ----------------------------------------------------------------- menu --- */

static void draw_menu(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(14, 14, 22), RGB(26, 26, 40));
    system_bar(top, "PARTY STATUS", kFloorNames[g.dun.index]);

    for (int i = 0; i < PARTY; i++) {
        const Hero *h = &g.hero[i];
        int x = 4 + i * 128;
        window(top, x, 18, 124, 168, 0);
        gfx_sprite_scaled(top, hero_sprite(i), x + 40, 22, 75, 100);
        gfx_text(top, x + 6, 84, C_AMBER, h->name);
        gfx_text(top, x + 6, 94, C_DIM, h->title);
        gfx_text(top, x + 6, 106, C_INK, "LV");
        gfx_text(top, x + 24, 106, C_INK, gfx_num(h->level));
        gfx_text(top, x + 48, 106, C_DIM, "XP");
        gfx_text(top, x + 66, 106, C_CYAN, gfx_num(h->xp));
        bar_meter(top, x + 6, 116, 112, 9, h->hp, h->hp_max, C_GREEN, 0);
        bar_meter(top, x + 6, 128, 112, 9, h->mp, h->mp_max, C_CYAN, 0);
        static const char *const names[6] = { "STR", "DEX", "CON", "WIT", "CHA", "LCK" };
        const uint8_t *stats = &h->st.str;
        for (int k = 0; k < 6; k++) {
            int sx = x + 6 + (k % 2) * 58, sy = 142 + (k / 2) * 11;
            gfx_text(top, sx, sy, C_DIM, names[k]);
            gfx_text(top, sx + 26, sy, C_INK, gfx_num(stats[k]));
        }
        gfx_text(top, x + 6, 176, C_DIM, "ATK");
        gfx_text(top, x + 30, 176, C_AMBER, gfx_num(hero_attack(h)));
        gfx_text(top, x + 64, 176, C_DIM, "DEF");
        gfx_text(top, x + 88, 176, C_AMBER, gfx_num(hero_defence(h)));
    }

    backdrop(bot);
    for (int i = 0; i < 4; i++) draw_button(bot, &kMenuTabs[i], g.menu_tab == i);
    gfx_hline(bot, 0, SCREEN_W - 1, 26, C_AMBER_DK);

    if (g.menu_tab == 0) {
        gfx_text(bot, 6, 34, C_AMBER, "THE RUN SO FAR");
        season_tag(bot, 214, 34, C_MAGENTA);
        gfx_text(bot, 6, 48, C_DIM, "Gold");        gfx_text(bot, 110, 48, C_GOLD, gfx_num(g.gold));
        gfx_text(bot, 6, 60, C_DIM, "Fights won");  gfx_text(bot, 110, 60, C_INK, gfx_num(g.battles_won));
        gfx_text(bot, 6, 72, C_DIM, "Boxes opened");gfx_text(bot, 110, 72, C_INK, gfx_num(g.boxes_opened));
        gfx_text(bot, 6, 84, C_DIM, "Steps taken"); gfx_text(bot, 110, 84, C_INK, gfx_num(g.dun.steps));
        gfx_text(bot, 6, 96, C_DIM, "Tiles seen");  gfx_text(bot, 110, 96, C_INK, gfx_num(g.dun.explored));
        gfx_text(bot, 6, 112, C_AMBER, "BAG");
        int y = 124, shown = 0;
        for (int i = 1; i < item_count && shown < 5; i++) {
            if (!g.inventory[i]) continue;
            gfx_text(bot, 12, y, C_INK, item_defs[i].name);
            gfx_text(bot, 214, y, C_DIM, gfx_num(g.inventory[i]));
            y += 11;
            shown++;
        }
        if (!shown) gfx_text(bot, 12, y, C_DIM, "Nothing. Bopca sells things.");
    } else if (g.menu_tab == 1) {
        gfx_text(bot, 6, 34, C_AMBER, "EQUIP  (A on a line)");
        int list[INVENTORY], n = 0;
        for (int i = 1; i < item_count && i < INVENTORY; i++)
            if (g.inventory[i] && item_defs[i].kind >= IT_WEAPON) list[n++] = i;
        for (int i = 0; i < n && i < 6; i++) {
            int on = g.menu_cursor == i;
            window(bot, 6, 52 + i * 18, 244, 17, on);
            gfx_text(bot, 12, 57 + i * 18, on ? C_AMBER : C_INK, item_defs[list[i]].name);
            gfx_text(bot, 200, 57 + i * 18, C_CYAN, gfx_num(item_defs[list[i]].power));
        }
        if (!n) gfx_text(bot, 12, 56, C_DIM, "No gear yet. Boxes hold most of it.");
        else gfx_text_wrapped(bot, 6, 166, 244, C_DIM, item_defs[list[g.menu_cursor < n ? g.menu_cursor : 0]].blurb);
    } else if (g.menu_tab == 2) {
        /*  Full width and scrolled, not a two-column grid: the show's own
            achievement names run to twenty-eight characters and there are
            twenty-one of them, so a 120px cell truncated most of the list and
            a fixed twelve rows never showed the rest of it at all. */
        int got_n = 0;
        for (int i = 0; i < ach_count; i++) got_n += (g.achievements >> i) & 1;
        gfx_text(bot, 6, 34, C_AMBER, "ACHIEVEMENTS");
        gfx_text(bot, 186, 34, C_DIM, gfx_num(got_n));
        gfx_text(bot, 204, 34, C_DIM, "of");
        gfx_text(bot, 222, 34, C_INK, gfx_num(ach_count));

        const int rows = 5;      /* six ran under the BACK button */
        int sel = g.menu_cursor < ach_count ? g.menu_cursor : ach_count - 1;
        int top = sel - rows / 2;
        if (top > ach_count - rows) top = ach_count - rows;
        if (top < 0) top = 0;
        for (int r = 0; r < rows && top + r < ach_count; r++) {
            int i = top + r, y = 48 + r * 23;
            int got = (g.achievements >> i) & 1;
            window(bot, 6, y, 244, 21, i == sel);
            gfx_text(bot, 12, y + 3, got ? C_GOLD : C_DIM, ach_defs[i].name);
            gfx_text(bot, 12, y + 12, C_DIM, got ? "unlocked" : ach_defs[i].how);
            if (got && ach_defs[i].box < 4) {
                static const char *const kTier[4] = { "BRZ", "SLV", "GLD", "LEG" };
                gfx_text(bot, 222, y + 3, C_AMBER, kTier[ach_defs[i].box]);
            }
        }
    } else {
        gfx_text(bot, 6, 34, C_AMBER, "THE SHOW");
        gfx_text_wrapped(bot, 6, 48, 244, C_INK,
                         "Everything down here is broadcast. Fights you win loudly pay better than "
                         "fights you win quietly, and the audience decides what loud means.");
        gfx_text(bot, 6, 96, C_DIM, "Story beats seen");
        gfx_text(bot, 180, 96, C_INK, gfx_num(g.story_beat + 1));
        gfx_text(bot, 6, 108, C_DIM, "Floor");
        gfx_text(bot, 180, 108, C_INK, gfx_num(g.dun.index + 1));
        gfx_text_wrapped(bot, 6, 128, 244, C_DIM,
                         "A System kiosk on each floor prints a recall code. Sixteen characters, "
                         "and the run comes back.");
    }
    Rect back = { 194, 172, 56, 18, "BACK" };
    draw_button(bot, &back, 0);
}

/* ----------------------------------------------------------------- shop --- */

static void draw_shop(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(18, 14, 12), RGB(38, 26, 18));
    system_bar(top, "BOPCA PROVISIONS", "STOCK IS WHAT IT IS");
    gfx_sprite_scaled(top, &spr_bopca, 4, 58, 150, 100);
    gfx_sprite_scaled(top, &spr_shop, 196, 22, 120, 100);

    int stock[INVENTORY], n = 0;
    for (int i = 1; i < item_count; i++)
        if (item_defs[i].price > 0 && item_defs[i].price <= 500) stock[n++] = i;
    int sel = g.shop_cursor < n ? g.shop_cursor : 0;
    window(top, 120, 60, 130, 118, 0);
    gfx_text(top, 126, 66, C_AMBER, item_defs[stock[sel]].name);
    gfx_text_wrapped(top, 126, 80, 120, C_INK, item_defs[stock[sel]].blurb);
    gfx_text(top, 126, 150, C_DIM, "PRICE");
    gfx_text(top, 170, 150, C_GOLD, gfx_num(item_defs[stock[sel]].price));
    gfx_text(top, 126, 162, C_DIM, "PURSE");
    gfx_text(top, 170, 162, C_GOLD, gfx_num(g.gold));

    backdrop(bot);
    gfx_rect(bot, 0, 0, SCREEN_W, 22, C_PANEL);
    gfx_text(bot, 6, 7, C_AMBER, "STOCK");
    gfx_text(bot, 150, 7, C_DIM, "PURSE");
    gfx_text(bot, 196, 7, C_GOLD, gfx_num(g.gold));
    gfx_hline(bot, 0, SCREEN_W - 1, 22, C_AMBER_DK);
    const int rows = 7;
    int top_row = sel >= rows ? sel - rows + 1 : 0;
    for (int i = 0; i < rows && top_row + i < n; i++) {
        int item = stock[top_row + i];
        int on = sel == top_row + i;
        int y = 28 + i * 18;
        window(bot, 6, y, 244, 17, on);
        gfx_text(bot, 12, y + 5, on ? C_AMBER : C_INK, item_defs[item].name);
        gfx_text(bot, 186, y + 5, g.gold >= item_defs[item].price ? C_GOLD : C_RED,
                 gfx_num(item_defs[item].price));
        gfx_text(bot, 228, y + 5, C_DIM, "x");
        gfx_text(bot, 236, y + 5, C_DIM, gfx_num(g.inventory[item]));
    }
    if (n > rows) {
        gfx_text(bot, 120, 158, C_DIM, gfx_num(sel + 1));
        gfx_text(bot, 134, 158, C_DIM, "/");
        gfx_text(bot, 142, 158, C_DIM, gfx_num(n));
    }
    gfx_rect(bot, 0, 162, SCREEN_W, SCREEN_H - 162, C_VOID);
    Rect leave = { 6, 166, 100, 22, "LEAVE" };
    Rect buy = { 150, 166, 100, 22, "BUY" };
    draw_button(bot, &leave, 0);
    draw_button(bot, &buy, 1);
}

/* ------------------------------------------------------------------ box --- */

/*  A safe room. The whole point of them in the book is that they are mundane:
 *  a Waffle House with the lights on, four hundred feet under a dead city, on
 *  a floor that is going to stop existing. So this is the one screen down here
 *  that is warm and evenly lit -- no fog, no vignette, no haze, and a chequer
 *  floor, because that is what the floor of one of these actually looks like. */
static void draw_safe_room(Surface *top, Surface *bot) {
    const SafeRoomDef *r = &safe_room_defs[g.safe_room % safe_room_count];
    const uint16_t warm_hi = RGB(252, 244, 214), warm = RGB(214, 196, 158);
    const uint16_t wall = RGB(178, 158, 126), wall_lo = RGB(120, 104, 84);
    const uint16_t tile_a = RGB(226, 220, 204), tile_b = RGB(92, 88, 84);

    gfx_vgradient(top, 0, 0, SCREEN_W, 120, warm_hi, wall);
    gfx_vgradient(top, 0, 120, SCREEN_W, 8, wall_lo, wall_lo);

    for (int i = 0; i < 2; i++) {              /* the strip lights, humming */
        int x = 34 + i * 116;
        gfx_rect(top, x, 22, 88, 7, warm_hi);
        gfx_rect(top, x, 29, 88, 2, warm);
        gfx_dither(top, x - 8, 31, 104, 18, warm_hi, 5);
    }

    {   /*  The three screens every safe room has. One counts the floor down
           and the crawlers with it, one is waiting for a leaderboard that
           does not exist yet, and one is about this particular building.
           The middle one is the joke: it is the same message everywhere. */
        const uint16_t bez = RGB(38, 34, 40), bez_hi = RGB(86, 80, 88);
        const uint16_t scr = RGB(16, 26, 30), lit = RGB(120, 226, 236);
        /*  Twelve characters is what fits inside a bezel three-to-a-screen,
            so the wording is cut to that rather than being clipped by it. */
        static const char *const kScreenTwo[] = { "LEADERBOARD", "POPULATES ON",
                                                  "COLLAPSE OF", "FLOOR THREE" };
        for (int i = 0; i < 3; i++) {
            int x = 3 + i * 85, y = 34, w = 82, h = 48;
            gfx_rect(top, x, y, w, h, bez);
            gfx_rect(top, x, y, w, 2, bez_hi);
            gfx_rect(top, x + 3, y + 3, w - 6, h - 6, scr);
            for (int sy = y + 3; sy < y + h - 3; sy += 2)   /* the scanlines */
                gfx_hline(top, x + 3, x + w - 4, sy, gfx_scale_colour(scr, 22, 16));

            if (i == 0) {
                int secs = g.dun.collapse / 60;
                char clock[8];
                int o = 0;
                for (const char *p = gfx_num(secs / 60); *p; p++) clock[o++] = *p;
                clock[o++] = ':';
                for (const char *p = gfx_numpad(secs % 60, 2); *p; p++) clock[o++] = *p;
                clock[o] = 0;
                gfx_text(top, x + 5, y + 7, C_DIM, "COLLAPSE IN");
                gfx_text(top, x + 5, y + 18, C_RED, clock);
                gfx_text(top, x + 5, y + 29, C_DIM, "CRAWLERS");
                /*  It clicks down while you are standing there, which is the
                    only reason anybody looks at it twice. */
                /*  Grouped: eight bare digits read as a serial number, and
                    this one is supposed to read as a population. */
                char who[16];
                const char *raw = gfx_num((int)crawlers_left());
                int len = 0;
                while (raw[len]) len++;
                int w = 0;
                for (int k = 0; k < len && w < 14; k++) {
                    who[w++] = raw[k];
                    int left = len - 1 - k;
                    if (left && left % 3 == 0) who[w++] = ',';
                }
                who[w] = 0;
                gfx_text(top, x + 5, y + 39, lit, who);
            } else if (i == 1) {
                for (int k = 0; k < 4; k++)
                    gfx_text(top, x + 5, y + 7 + k * 11, C_DIM, kScreenTwo[k]);
            } else {
                gfx_text(top, x + 5, y + 7, C_GOLD, "THIS ROOM");
                gfx_text(top, x + 5, y + 18, C_INK, "NO FIGHTING");
                gfx_text(top, x + 5, y + 28, C_INK, "NO FILMING");
                gfx_text(top, x + 5, y + 38, C_GREEN, "FREE REFILLS");
            }
            gfx_frame(top, x, y, w, h, RGB(14, 12, 16));
        }
    }

    {   /* The back counter, and the hatch behind it. Without them the upper
           half is a gradient, and a gradient is not a room. */
        const uint16_t lam = RGB(148, 74, 62), lam_hi = RGB(196, 118, 96);
        const uint16_t lam_lo = RGB(84, 40, 34), glass = RGB(198, 214, 208);
        (void)glass;
        gfx_rect(top, 0, 100, 118, 28, lam);
        gfx_rect(top, 0, 100, 118, 3, lam_hi);
        gfx_rect(top, 0, 125, 118, 3, lam_lo);
        for (int x = 8; x < 118; x += 26)            /* stools, bolted down */
            gfx_rect(top, x, 96, 14, 4, RGB(160, 156, 150));
    }

    /*  The floor, in perspective by rows: squares get shorter and wider as they
        run back, which is all a chequer needs to sit down flat. */
    for (int y = 128; y < SCREEN_H; y++) {
        int depth = y - 128;
        /*  Find the band this row belongs to, and take the square size from
            where the band starts -- not from the row. Sizing per row makes
            every row in a band a different width and the whole floor shears. */
        int band = 0, acc = 0, size;
        for (;;) {
            size = 11 + acc / 3;
            int rows = size / 2 + 1;
            if (depth < acc + rows) break;
            acc += rows;
            band++;
        }
        int off = (band & 1) ? size / 2 : 0;
        for (int x = 0; x < SCREEN_W; x++)
            top->px[y * SCREEN_W + x] = ((((x + off) / size) + band) & 1) ? tile_a : tile_b;
    }
    gfx_hline(top, 0, SCREEN_W - 1, 128, RGB(60, 56, 52));
    gfx_hline(top, 0, SCREEN_W - 1, 129, RGB(112, 104, 96));

    {   /* The party, standing in it, not fighting anything for once. */
        const Sprite *a = hero_sprite(0), *b = hero_sprite(1);
        const int sc = 96;
        int ah = a->h * sc / 100, bh = b->h * sc / 100;
        int bob = (g.anim / 20) & 1;
        gfx_sprite_scaled(top, a, 42, 176 - ah + bob, sc, 100);
        gfx_sprite_scaled(top, b, 42 + a->w * sc / 100 + 8, 178 - bh - bob, sc, 100);
    }

    system_bar(top, "SAFE ROOM", kFloorNames[g.dun.index]);

    backdrop(bot);
    gfx_text_big(bot, 12, 26, C_GOLD, r->name);
    gfx_text_wrapped(bot, 12, 58, 232, C_INK, r->blurb);
    window(bot, 8, 104, 240, 46, 0);
    gfx_text(bot, 16, 112, C_GREEN, "Everyone is patched up.");
    gfx_text(bot, 16, 128, C_DIM, "Health and stamina full. The floor");
    gfx_text(bot, 16, 138, C_DIM, "outside has not stopped for this.");
    gfx_text(bot, 12, 168, C_AMBER, "TAP TO CONTINUE");
}

static void draw_box(Surface *top, Surface *bot) {
    static const char *const tiers[4] = { "BRONZE", "SILVER", "GOLD", "LEGENDARY" };
    static const uint16_t tier_colour[4] = { RGB(190, 130, 80), RGB(200, 206, 218), RGB(250, 208, 80), RGB(206, 96, 236) };
    uint16_t c = tier_colour[g.box_tier];
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(10, 10, 16), gfx_scale_colour(c, 5, 16));
    system_bar(top, "LOOT BOX", tiers[g.box_tier]);

    int cx = 128, cy = 100;
    int rays = g.box_phase >= 1 ? 16 : 6;
    for (int i = 0; i < rays; i++) {
        int a = (i * 360 / rays + (int)(g.anim * 2)) % 360;
        int dx = (a < 90 || a > 270) ? 1 : -1;
        int len = 40 + (i * 13) % 60;

        int x2 = cx + dx * len, y2 = cy + ((i & 1) ? len / 2 : -len / 3);
        gfx_vline(top, x2 > cx ? x2 : cx, y2, y2 + 1, gfx_scale_colour(c, 8, 16));
    }
    const Sprite *box = sprite_table[SPR_BOX_BRONZE + g.box_tier];
    int bob = g.box_phase == 0 ? ((g.anim / 4) & 3) : 0;
    gfx_sprite_scaled(top, box, cx - box->w, cy - box->h + bob, 200, 100);
    if (g.box_phase >= 2) {
        gfx_panel(top, 28, 138, 200, 40, C_PANEL, c);
        gfx_text(top, 36, 146, c, item_defs[g.box_item].name);
        gfx_text_wrapped(top, 36, 158, 186, C_INK, item_defs[g.box_item].blurb);
    }

    backdrop(bot);
    gfx_text_big(bot, 24, 60, c, tiers[g.box_tier]);
    gfx_text(bot, 24, 88, C_DIM, g.box_phase >= 2 ? "Added to the bag." : "The box is deciding.");
    gfx_text(bot, 24, 108, C_DIM, "Boxes opened this run");
    gfx_text(bot, 210, 108, C_INK, gfx_num(g.boxes_opened));
    if (g.box_phase >= 1) gfx_text(bot, 24, 160, C_AMBER, "TAP TO CONTINUE");
}

/* -------------------------------------------------------------- levelup --- */

static void draw_levelup(Surface *top, Surface *bot) {
    int hero = g.levelup_hero;
    const Hero *h = &g.hero[hero];
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(12, 16, 14), RGB(24, 40, 30));
    system_bar(top, "LEVEL UP", h->name);
    gfx_sprite_scaled(top, hero_sprite(hero), 16, 40, 150, 100);
    gfx_text_big(top, 150, 50, C_GREEN, "LEVEL");
    gfx_text_big(top, 150, 70, C_AMBER, gfx_num(h->level));
    gfx_text(top, 150, 100, C_DIM, "POINTS LEFT");
    gfx_text(top, 150, 112, C_INK, gfx_num(h->points));
    gfx_text_wrapped(top, 20, 160, 216, C_DIM,
                     "Spend them where the show can see: attributes drive every number in a fight.");

    backdrop(bot);
    gfx_text(bot, 8, 12, C_AMBER, "SPEND A POINT");
    gfx_text(bot, 180, 12, C_INK, gfx_num(h->points));
    gfx_text(bot, 196, 12, C_DIM, "left");
    static const char *const names[6] = { "STRENGTH", "DEXTERITY", "CONSTITUTION", "WITS", "CHARISMA", "LUCK" };
    static const char *const what[6] = { "damage", "dodge, speed", "health", "stamina", "the crowd", "crits, loot" };
    const uint8_t *stats = &h->st.str;
    for (int i = 0; i < 6; i++) {
        int on = g.menu_cursor == i;
        window(bot, 12, 46 + i * 20, 232, 19, on);
        gfx_text(bot, 18, 52 + i * 20, on ? C_AMBER : C_INK, names[i]);
        gfx_text(bot, 140, 52 + i * 20, C_DIM, what[i]);
        gfx_text(bot, 224, 52 + i * 20, C_CYAN, gfx_num(stats[i]));
    }
}

/* ----------------------------------------------------------------- code --- */

static const char kKeyRowsView[4][10] = { "ABCDEFGH", "JKLMNPQR", "STUVWXYZ", "23456789" };

static void draw_code(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(10, 12, 18), RGB(22, 26, 40));
    system_bar(top, g.code_mode ? "RECALL CODE ENTRY" : "SYSTEM KIOSK", "THE SHOW REMEMBERS");
    gfx_sprite_scaled(top, &spr_shrine, 12, 60, 200, 100);

    window(top, 88, 56, 162, 96, 0);
    gfx_text(top, 94, 62, C_DIM, g.code_mode ? "TYPED" : "WRITE THIS DOWN");
    /* Sixteen characters do not fit across the panel at double size, so they
       go two groups to a line: XXXX-XXXX over XXXX-XXXX. */
    for (int line = 0; line < 2; line++) {
        char row[12];
        int o = 0;
        for (int i = line * 8; i < line * 8 + 8 && g.code[i]; i++) {
            row[o++] = g.code[i];
            if ((i % 4) == 3 && g.code[i + 1] && i % 8 != 7) row[o++] = '-';
        }
        row[o] = 0;
        gfx_text_big(top, 94, 76 + line * 20, C_AMBER, row);
    }
    if (!g.code_mode) {
        gfx_text_wrapped(top, 94, 118, 150, C_INK,
                         "Sixteen characters. They put this run back on this floor.");
    } else if (g.code_status == 2) {
        gfx_text(top, 94, 124, C_RED, "THAT CODE IS NOT A CODE");
    } else if (g.code_status == 1) {
        gfx_text(top, 94, 124, C_GREEN, "RUN RESTORED");
    }

    backdrop(bot);
    if (!g.code_mode) {
        gfx_text_wrapped(bot, 10, 20, 236, C_INK,
                         "The kiosk prints your progress as a code. Enter it from the title screen "
                         "and the System puts you back where you were standing.");
        Rect ok = { 78, 158, 100, 24, "DONE" };
        draw_button(bot, &ok, 1);
        return;
    }
    gfx_text(bot, 8, 10, C_AMBER, "ENTER THE CODE");
    window(bot, 8, 24, 240, 24, 0);
    {
        char shown[20];
        int o = 0;
        for (int i = 0; g.code[i] && o < 19; i++) {
            shown[o++] = g.code[i];
            if ((i % 4) == 3 && g.code[i + 1]) shown[o++] = ' ';
        }
        shown[o] = 0;
        gfx_text_big(bot, 12, 30, C_INK, shown);
        if (g.anim & 16) gfx_rect(bot, 12 + o * 12, 30, 8, 14, C_AMBER);
    }
    for (int r = 0; r < 4; r++)
        for (int c = 0; c < 8; c++) {
            int on = g.code_cursor == r * 8 + c;
            char label[2] = { kKeyRowsView[r][c], 0 };
            Rect key = { (int16_t)(8 + c * 30), (int16_t)(60 + r * 26), 28, 24, 0 };
            draw_button(bot, &key, on);
            gfx_text(bot, key.x + 11, key.y + 8, on ? C_AMBER : C_INK, label);
        }
    Rect del = { 8, 166, 74, 22, "DELETE" };
    Rect go = { 90, 166, 74, 22, "ENTER" };
    Rect back = { 172, 166, 76, 22, "BACK" };
    draw_button(bot, &del, 0);
    draw_button(bot, &go, 1);
    draw_button(bot, &back, 0);
}

/* ------------------------------------------------------------- endgames --- */

static void draw_gameover(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(24, 6, 10), RGB(6, 4, 6));
    gfx_text_big(top, 30, 24, C_RED, "SEASON OVER");
    season_tag(top, 30, 46, C_MAGENTA);
    gfx_text(top, 60, 46, C_DIM, "ends here. There is no continue.");

    /*  Depth is the score, so it is the biggest thing on the screen. */
    window(top, 24, 62, 116, 58, 0);
    gfx_text(top, 30, 68, C_DIM, "REACHED");
    gfx_text_big(top, 30, 80, C_AMBER, gfx_num(g.dun.index + 1));
    gfx_text(top, 30, 106, C_DIM, "of eighteen floors");

    window(top, 148, 62, 84, 58, 0);
    gfx_text(top, 154, 68, C_DIM, "Level");
    gfx_text(top, 200, 68, C_AMBER, gfx_num(g.hero[0].level));
    gfx_text(top, 154, 80, C_DIM, "Fights");
    gfx_text(top, 200, 80, C_AMBER, gfx_num(g.battles_won));
    gfx_text(top, 154, 92, C_DIM, "Boxes");
    gfx_text(top, 200, 92, C_AMBER, gfx_num(g.boxes_opened));
    gfx_text(top, 154, 104, C_DIM, "Gold");
    gfx_text(top, 200, 104, C_GOLD, gfx_num(g.gold));

    for (int i = 0; i < PARTY; i++) {            /* who it was, for the record */
        const Sprite *sp = hero_sprite(i);
        int w = sp->w * 52 / 100;
        gfx_sprite_scaled(top, sp, 24 + i * 64, 126, 52, 100);
        gfx_shade(top, 24 + i * 64, 126, w, sp->h * 52 / 100, 10);
        gfx_text(top, 24 + i * 64, 126 + sp->h * 52 / 100, C_DIM, g.hero[i].name);
    }
    gfx_sprite_scaled(top, &spr_boss_producer, 168, 120, 62, 100);

    backdrop(bot);
    gfx_text_wrapped(bot, 12, 24, 232, C_INK,
                     "The floor took them, the feed cut, and the audience was "
                     "already watching somebody else before the dust settled. "
                     "Achievements stay on file. Nothing else does.");
    window(bot, 12, 76, 232, 62, 0);
    gfx_text(bot, 18, 82, C_AMBER, "THIS SITTING");
    gfx_text(bot, 18, 96, C_DIM, "Seasons run");
    gfx_text(bot, 150, 96, C_INK, gfx_num(season_count() + 1));
    gfx_text(bot, 18, 108, C_DIM, "Deepest floor");
    gfx_text(bot, 150, 108, C_AMBER,
             gfx_num(g.dun.index + 1 > season_best_floor() ? g.dun.index + 1
                                                           : season_best_floor()));
    gfx_text(bot, 18, 120, C_DIM, "Most fights won");
    gfx_text(bot, 150, 120, C_INK,
             gfx_num(g.battles_won > season_best_kills() ? g.battles_won
                                                         : season_best_kills()));
    gfx_text(bot, 12, 156, C_AMBER, "TAP FOR THE NEXT SEASON");
}

static void draw_victory(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(14, 10, 26), RGB(46, 18, 44));
    for (int i = 0; i < 80; i++) {
        int x = (i * 61 + g.anim / 2) % SCREEN_W;
        int y = (i * 29 + g.anim) % SCREEN_H;
        gfx_pixel(top, x, y, i & 1 ? C_GOLD : C_MAGENTA);
    }
    gfx_text_big(top, 30, 40, C_GOLD, "END OF BOOK ONE");
    season_tag(top, 30, 62, C_MAGENTA);
    gfx_sprite(top, hero_sprite(0), 34, 108);
    gfx_sprite(top, hero_sprite(1), 150, 112);
    gfx_text(top, 24, 168, C_INK, "Three floors down. Fifteen to go.");

    backdrop(bot);
    gfx_text(bot, 8, 10, C_AMBER, "FINAL STANDINGS");
    gfx_text(bot, 8, 30, C_DIM, "Carl");        gfx_text(bot, 120, 30, C_INK, gfx_num(g.hero[0].level));
    gfx_text(bot, 8, 42, C_DIM, "Princess Donut"); gfx_text(bot, 120, 42, C_INK, gfx_num(g.hero[1].level));
    gfx_text(bot, 8, 54, C_DIM, "Fights won");  gfx_text(bot, 120, 54, C_INK, gfx_num(g.battles_won));
    gfx_text(bot, 8, 66, C_DIM, "Boxes opened");gfx_text(bot, 120, 66, C_INK, gfx_num(g.boxes_opened));
    gfx_text(bot, 8, 78, C_DIM, "Gold");        gfx_text(bot, 120, 78, C_GOLD, gfx_num(g.gold));
    int got = 0;
    for (int i = 0; i < ach_count; i++) if ((g.achievements >> i) & 1) got++;
    gfx_text(bot, 8, 90, C_DIM, "Achievements"); gfx_text(bot, 120, 90, C_GOLD, gfx_num(got));
    gfx_text(bot, 8, 116, C_AMBER, "TAP TO RETURN TO THE TITLE");
}

/* ----------------------------------------------------------------- entry -- */

/*  Both screens are redrawn from scratch or not at all: a turn-based crawler is
 *  a still image most of the time, so the frame is skipped outright when
 *  nothing that can be seen has changed. That is the difference between the DS
 *  running this at 30 frames a second and at 60. */
static uint32_t render_signature(void) {
    uint32_t h = 2166136261u;
    #define MIX(v) do { h = (h ^ (uint32_t)(v)) * 16777619u; } while (0)
    MIX(g.scene); MIX(g.fade); MIX(g.hurt_flash);
    MIX(g.dun.index); MIX(g.dun.px); MIX(g.dun.py); MIX(g.dun.facing);
    MIX(g.dun.explored); MIX(g.dun.steps); MIX(g.dun.collapse / 60);
    MIX(g.gold); MIX(g.boxes_opened); MIX(g.battles_won); MIX(g.achievements);
    MIX(g.menu_tab); MIX(g.menu_cursor); MIX(g.shop_cursor); MIX(g.title_cursor);
    MIX(g.code_len); MIX(g.code_cursor); MIX(g.code_status); MIX(g.code_mode);
    MIX(g.beat_line); MIX(g.beat_reveal); MIX(g.story_beat);
    MIX(g.box_phase); MIX(g.box_item); MIX(g.box_tier);
    MIX(g.levelup_hero);
    for (int i = 0; i < PARTY; i++) {
        MIX(g.hero[i].hp); MIX(g.hero[i].mp); MIX(g.hero[i].level);
        MIX(g.hero[i].points); MIX(g.hero[i].xp);
        for (int k = 0; k < 3; k++) MIX(g.hero[i].equip[k]);
    }
    for (int i = 0; i < MAX_TOASTS; i++) MIX(g.toast[i].life ? g.toast[i].life / 4 + 1 : 0);
    if (g.scene == SCENE_BATTLE) {
        MIX(g.bat.phase); MIX(g.bat.cursor); MIX(g.bat.target); MIX(g.bat.actor);
        MIX(g.bat.n_log); MIX(g.bat.shake); MIX(g.bat.timer / 6);
        MIX(g.bat.log_shown); MIX(g.bat.reveal);   /* the line being typed out */
        for (int i = 0; i < MAX_FOES; i++) { MIX(g.bat.foes[i].hp); MIX(g.bat.foes[i].alive); }
        for (int i = 0; i < PARTY + MAX_FOES; i++) MIX(g.bat.pop_life[i] / 4);
        MIX(g.anim >> 2);
    }
    if (g.scene == SCENE_DRAFT) {
        MIX(g.draft_cursor); MIX(g.draft_slot);
        MIX(g.draft_pick[0]); MIX(g.draft_pick[1]); MIX(g.anim >> 1);
    }
    if (g.scene == SCENE_CUTSCENE) {
        MIX(g.chapter); MIX(g.cut_line); MIX(g.cut_reveal);
        MIX(g.cut_backdrop); MIX(g.cut_choice); MIX(g.cut_answer);
        MIX(g.cut_shake); MIX(g.anim >> 1);        /* rain and dust keep moving */
    }
    /* Scenes that are alive even when the player is not. */
    if (g.scene == SCENE_TITLE) MIX(season_count());
    if (g.scene == SCENE_TITLE || g.scene == SCENE_STORY || g.scene == SCENE_BOX ||
        g.scene == SCENE_SAFEROOM || g.scene == SCENE_VICTORY)
        MIX(g.anim >> 1);
    if (g.scene == SCENE_CODE) MIX(g.anim >> 4);
    #undef MIX
    return h;
}

int render_frame(void) {
    static uint32_t last_signature;
    static int primed;
    uint32_t sig = render_signature();
    if (primed && sig == last_signature) return 0;
    last_signature = sig;
    primed = 1;

    Surface top = gfx_surface(SCREEN_TOP);
    Surface bot = gfx_surface(SCREEN_BOTTOM);

    switch (g.scene) {
    case SCENE_TITLE:    draw_title(&top, &bot);    break;
    case SCENE_STORY:    draw_story(&top, &bot);    break;
    case SCENE_DUNGEON:  draw_dungeon(&top, &bot);  break;
    case SCENE_BATTLE:   draw_battle(&top, &bot);   break;
    case SCENE_MENU:     draw_menu(&top, &bot);     break;
    case SCENE_SHOP:     draw_shop(&top, &bot);     break;
    case SCENE_BOX:      draw_box(&top, &bot);      break;
    case SCENE_SAFEROOM: draw_safe_room(&top, &bot); break;
    case SCENE_LEVELUP:  draw_levelup(&top, &bot);  break;
    case SCENE_CODE:     draw_code(&top, &bot);     break;
    case SCENE_GAMEOVER: draw_gameover(&top, &bot); break;
    case SCENE_VICTORY:  draw_victory(&top, &bot);  break;
    case SCENE_CUTSCENE: draw_cutscene(&top, &bot); break;
    case SCENE_DRAFT:    draw_draft(&top, &bot);    break;
    default: break;
    }

    /* Paused screens are for reading; the System can wait its turn. */
    if (g.scene != SCENE_DUNGEON && g.scene != SCENE_BATTLE &&
        g.scene != SCENE_MENU && g.scene != SCENE_CODE && g.scene != SCENE_SHOP) toasts(&top);
    if (g.fade) {                                   /* a short wipe between scenes */
        int a = g.fade;
        gfx_shade(&top, 0, 0, SCREEN_W, SCREEN_H, 16 - a);
        gfx_shade(&bot, 0, 0, SCREEN_W, SCREEN_H, 16 - a);
    }
    return 1;
}
