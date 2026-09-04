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
#include "views.h"


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
    /*  Three at a time. Walking in earns six achievements at once and a stack
        of six panels covers the floor the player is trying to look at; the
        rest are still queued and still arrive, just not all over the game. */
    int y = SCREEN_H - 16, shown = 0;
    for (int i = 0; i < MAX_TOASTS && shown < 3; i++) {
        const Toast *t = &g.toast[i];
        if (!t->life) continue;
        shown++;
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

static void draw_button(Surface *s, const Rect *r, int on);

/*  An item id to the icon drawn for it. The icons are emitted contiguously in
 *  item_defs' order starting at slot 1, so this is arithmetic rather than a
 *  table that could fall out of step with the item list. */
static const Sprite *item_sprite(int id) {
    if (id < 1 || id >= item_count) return 0;
    return sprite_table[SPR_ITEM_SPLINT_POTION + (id - 1)];
}

/*  What the thing actually does, in a line, from the numbers rather than the
 *  prose -- the blurb is flavour and does not always say. */
static void item_effect(char *out, int id) {
    const ItemDef *d = &item_defs[id];
    const char *lead = 0, *tail = 0;
    switch (d->kind) {
    case IT_HEAL:    lead = "Restores ";  tail = " health"; break;
    case IT_STAMINA: lead = "Restores ";  tail = " stamina"; break;
    case IT_BOMB:    lead = "Hits every foe for ";  tail = ""; break;
    case IT_REVIVE:  lead = "Revives at "; tail = " health"; break;
    case IT_BUFF:    lead = "Attack up for "; tail = " turns"; break;
    case IT_WEAPON:  lead = "Weapon. Attack +"; tail = ""; break;
    case IT_ARMOUR:  lead = "Armour. Defence +"; tail = ""; break;
    case IT_TRINKET: lead = "Trinket. Luck +"; tail = ""; break;
    default:         out[0] = 0; return;
    }
    int o = 0;
    for (const char *p = lead; *p; p++) out[o++] = *p;
    for (const char *p = gfx_num(d->power); *p; p++) out[o++] = *p;
    for (const char *p = tail; *p; p++) out[o++] = *p;
    out[o] = 0;
}


static void draw_title(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(51, 37, 74) /* arcane 0 */, RGB(58, 32, 37) /* blood 0 */);
    for (int i = 0; i < 60; i++) {          /* falling rubble, forever */
        int x = (int)((i * 8641 + g.anim / 2 + i * i) % SCREEN_W);
        int y = (int)((i * 4211 + g.anim * (1 + (i & 3))) % SCREEN_H);
        gfx_pixel(top, x, y, gfx_scale_colour(C_AMBER, 6 + (i & 7), 16));
    }
    /* The title block, then a floor for the two of them to stand on. */
    gfx_rect(top, 0, 26, SCREEN_W, 44, RGB(51, 37, 74) /* arcane 0 */);
    gfx_hline(top, 0, SCREEN_W - 1, 26, C_AMBER_DK);
    gfx_hline(top, 0, SCREEN_W - 1, 69, C_AMBER_DK);
    gfx_text_big(top, 20, 32, C_AMBER, "DUNGEON CRAWLER");
    gfx_text_big(top, 96, 50, C_MAGENTA, "CARL");
    gfx_text(top, 34, 76, C_DIM, "EIGHTEEN FLOORS.  NOBODY HAS SHOES.");

    int floor_y = SCREEN_H - 4;
    gfx_vgradient(top, 0, floor_y - 14, SCREEN_W, 18, RGB(53, 44, 69) /* cloth_purple 0 */, RGB(32, 34, 41) /* cloth_black 0 */);
    gfx_hline(top, 0, SCREEN_W - 1, floor_y - 14, gfx_scale_colour(C_AMBER_DK, 10, 16));
    for (int i = 0; i < 3; i++)                       /* light pooling on the floor */
        gfx_dither(top, 0, floor_y - 12 + i * 5, SCREEN_W, 5, C_AMBER_DK, 6 - i * 2);
    /*  Big. These are the two people the game is about and they were standing
        at sixty-four pixels in the middle of a two-hundred-and-fifty-six-pixel
        field, which read as a screen with a gap in it rather than a poster.
        At 150% they fill the lower half and the empty space becomes framing. */
    {
        const Sprite *c = hero_sprite(0), *d = hero_sprite(1);
        const int z = 150;
        int ch = c->h * z / 100, dh = d->h * z / 100;
        int cw = c->w * z / 100, dw = d->w * z / 100;
        for (int k = 0; k < 5; k++) {   /* they cast something onto the floor */
            gfx_dither(top, 14 + k * 2, floor_y - 6 + k, cw - k * 4, 1, C_VOID, 11 - k * 2);
            gfx_dither(top, SCREEN_W - 20 - dw + k * 2, floor_y - 5 + k, dw - k * 4, 1, C_VOID, 11 - k * 2);
        }
        gfx_sprite_scaled(top, c, 12, floor_y - ch, z, 100);
        gfx_sprite_scaled(top, d, SCREEN_W - 18 - dw, floor_y - dh + 2, z, 100);
        /*  The record goes in the gap between them: at this size they own the
            whole lower screen, and a line of text across it was being worn
            like a banner across Donut's crown. */
        if (season_count()) {
            int mid = cw + 18;
            gfx_text(top, mid, 108, C_DIM, "SEASONS");
            gfx_text(top, mid + 6, 120, C_INK, gfx_num(season_count()));
            gfx_text(top, mid, 136, C_DIM, "DEEPEST");
            gfx_text(top, mid + 6, 148, C_AMBER, gfx_num(season_best_floor()));
        }
    }

    backdrop(bot);
    gfx_vgradient(bot, 0, 0, SCREEN_W, 40, C_PANEL, C_VOID);
    gfx_text(bot, 8, 10, C_AMBER, "THE SYSTEM AWAITS YOUR DECISION");
    gfx_text(bot, 8, 24, C_DIM, "A season ends when the crawler does.");

    for (int i = 0; i < 2; i++)
        draw_button(bot, &kTitleOpts[i], g.title_cursor == i);
    /*  One line, not four. A title screen that opens with a control manual is
        a title screen that does not trust its first minute; the pad does what
        a pad does, and the full list lives on the party screen where somebody
        looking for it will go. */
    gfx_text(bot, 8, 52, C_DIM, "D-pad walks.  A acts.  Or use the stylus.");
    gfx_text(bot, 8, 66, C_DIM, "Progress comes back through a recall code.");
    gfx_text(bot, 8, 180, C_DIM, "(c) fan work. Story by Matt Dinniman.");
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

    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(51, 37, 74) /* arcane 0 */, RGB(51, 37, 74) /* arcane 0 */);
    for (int y = 0; y < SCREEN_H; y += 4)
        gfx_hline(top, 0, SCREEN_W - 1, y, gfx_scale_colour(RGB(51, 37, 74) /* arcane 0 */, 12, 16));

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
        /*  The beat so far, not just the line being spoken.
         *
         *  This box is a hundred and sixty pixels tall and one line of
         *  dialogue is forty of them, so showing only the current line left
         *  two thirds of the biggest panel in the game empty -- on the screen
         *  a player spends the most time reading. What belongs in that space
         *  is what was already said: it costs nothing to keep, it is the one
         *  thing somebody who looked away actually wants, and a beat is a
         *  conversation, which is a shape a transcript already has.
         *
         *  Laid out backwards from the current line until the box is full,
         *  then drawn forwards, so the line being revealed is always the
         *  bottom one and the older ones scroll off the top. */
        const int kX = 12, kW = SCREEN_W - 24, kTop = 12, kRow = 9;
        int rows_free = (SCREEN_H - 30 - 16) / kRow;

        char shown[220];
        const char *src = b->lines[g.beat_line].text;
        int n = 0;
        while (src[n] && n < (int)sizeof shown - 1 && n < g.beat_reveal) { shown[n] = src[n]; n++; }
        shown[n] = 0;

        int first = g.beat_line;
        int used = gfx_text_wrapped_count(kW, shown) + 1;
        while (first > 0) {
            int need = gfx_text_wrapped_count(kW, b->lines[first - 1].text) + 1;
            /*  A speaker change costs a name line. */
            if (b->lines[first - 1].speaker != b->lines[first].speaker) need++;
            if (used + need > rows_free) break;
            used += need;
            first--;
        }

        int y = kTop;
        int last_speaker = -1;
        for (int i = first; i <= g.beat_line; i++) {
            int who = b->lines[i].speaker;
            if (who != last_speaker) {
                gfx_text(bot, kX, y, i == g.beat_line
                         ? (who == SP_SYSTEM ? C_AMBER : C_MAGENTA) : C_WIN_EDGE,
                         speaker_names[who]);
                y += kRow;
                last_speaker = who;
            }
            /*  Said already, so it steps back; being said, so it is ink. */
            y += gfx_text_wrapped(bot, kX, y, kW,
                                  i == g.beat_line ? C_INK : C_DIM,
                                  i == g.beat_line ? shown : b->lines[i].text) * kRow;
            y += kRow / 2;
        }
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
            gfx_pixel(s, x0 + 2 + i * cell, y0 + 2 + j * cell, RGB(53, 44, 69) /* cloth_purple 0 */);

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
                gfx_rect(s, px, py, cell, cell, RGB(58, 65, 72) /* ink cool */);
                continue;
            }
            gfx_rect(s, px, py, cell, cell, RGB(38, 55, 66) /* ink blue */);
            uint16_t mark = 0;
            switch (t) {
            case T_DOWN: mark = C_GREEN; break;
            case T_UP:   mark = C_DIM; break;
            case T_SHOP: mark = C_GOLD; break;
            case T_SHRINE: mark = C_CYAN; break;
            case T_KIOSK: mark = C_AMBER; break;
            case T_BOSS: mark = C_RED; break;
            case T_NBOSS: mark = C_MAGENTA; break;
            case T_DOOR: mark = RGB(141, 93, 61) /* wood_dark 3 */; break;
            case T_BOX: case T_BOX_GOLD:
                mark = dungeon_is_used(mx, my) ? 0 : (t == T_BOX_GOLD ? C_GOLD : RGB(195, 138, 85) /* wood 3 */);
                break;
            default: break;
            }
            if (mark) gfx_rect(s, px + 1, py + 1, cell - 2, cell - 2, mark);
        }
    }
    /*  The party, as an arrowhead. It used to be a three-pixel block with a
     *  few loose pixels around it meant to suggest a wedge, and at map scale
     *  that reads as a dot: you could see where you were and not which way you
     *  were pointing.
     *
     *  A solid triangle, and nothing else -- the first version of this had a
     *  stem too, which at seven pixels turned the whole thing into a plus. */
    int px = x0 + 2 + (g.dun.px - cx) * cell + cell / 2;
    int py = y0 + 2 + (g.dun.py - cy) * cell + cell / 2;
    {
        static const int8_t kArrow[][2] = {
            {  0, -3 },
            { -1, -2 }, {  0, -2 }, {  1, -2 },
            { -2, -1 }, { -1, -1 }, {  0, -1 }, {  1, -1 }, {  2, -1 },
            { -3,  0 }, { -2,  0 }, { -1,  0 }, {  0,  0 }, {  1,  0 },
            {  2,  0 }, {  3,  0 },
        };
        const int n = (int)(sizeof kArrow / sizeof kArrow[0]);
        int f = g.dun.facing & 3;

        /*  Rotate a north-pointing offset into the facing. One shape, four
         *  directions: it cannot be right one way round and wrong another. */
        #define ROT(dx, dy, rx, ry) do {                                       \
            switch (f) {                                                       \
            case 1:  (rx) = -(dy); (ry) =  (dx); break;   /* east  */          \
            case 2:  (rx) = -(dx); (ry) = -(dy); break;   /* south */          \
            case 3:  (rx) =  (dy); (ry) = -(dx); break;   /* west  */          \
            default: (rx) =  (dx); (ry) =  (dy); break;   /* north */          \
            }                                                                  \
        } while (0)

        /*  A tight outline: the four orthogonal neighbours of every filled
         *  pixel that are not themselves filled. Smearing each pixel three by
         *  three, as the first attempt did, fills the triangle's own notches
         *  and hands back the blob this was meant to replace. */
        for (int i = 0; i < n; i++) {
            static const int8_t kSide[4][2] = { { 0, -1 }, { 1, 0 }, { 0, 1 }, { -1, 0 } };
            for (int k = 0; k < 4; k++) {
                int nx = kArrow[i][0] + kSide[k][0], ny = kArrow[i][1] + kSide[k][1];
                int filled = 0;
                for (int j = 0; j < n && !filled; j++)
                    filled = kArrow[j][0] == nx && kArrow[j][1] == ny;
                if (filled) continue;
                int rx, ry;
                ROT(nx, ny, rx, ry);
                gfx_pixel(s, px + rx, py + ry, C_VOID);
            }
        }
        for (int i = 0; i < n; i++) {
            int rx, ry;
            ROT(kArrow[i][0], kArrow[i][1], rx, ry);
            gfx_pixel(s, px + rx, py + ry, C_MAGENTA);
        }
        {   /* the tip, lit, so the point is findable at a glance */
            int rx, ry;
            ROT(kArrow[0][0], kArrow[0][1], rx, ry);
            gfx_pixel(s, px + rx, py + ry, C_INK);
        }
        #undef ROT
    }
}

static void draw_button(Surface *s, const Rect *r, int on) {
    window(s, r->x, r->y, r->w, r->h, on);
    if (r->label) {
        int tx = r->x + (r->w - gfx_text_width(r->label)) / 2;
        int ty = r->y + (r->h - 7) / 2;
        /*  A selected button is paper, so what is written on it is ink; an
            unselected one is back-lit glass, so it is light on dark. */
        gfx_text(s, tx + 1, ty + 1, on ? C_SEL_DIM : C_WIN_EDGE, r->label);
        gfx_text(s, tx, ty, on ? C_SEL_INK : C_INK, r->label);
    }
}

/*  Set by render_frame before it dispatches: whether the bottom screen's
 *  contents have changed since it was last drawn. */
static int s_draw_bottom = 1;
/*  Set on the first frame drawn after the scene changes. The dungeon's overlay
 *  is only wiped in bands, so on the way in it is still carrying whatever the
 *  previous scene painted edge to edge and needs one full clear. Tracking that
 *  from inside draw_dungeon does not work -- the scene is always the dungeon
 *  by the time it runs, so the flag latches on the first visit and every later
 *  entry keeps the last screen underneath the floor. It has to be observed
 *  where the scenes actually change. */
static int s_scene_changed = 1;

static void draw_dungeon(Surface *top, Surface *bot) {
    /*  The dungeon goes on the half-size layer the hardware magnifies; the
     *  text goes on the full-size layer above it, because a 5x7 font does not
     *  survive being halved.
     *
     *  The overlay is transparent where nothing is written, so it costs only
     *  the rows that carry something. Clearing all of it would put back most
     *  of the cost this split exists to remove, so only two bands are wiped:
     *  the system bar, always, and the strip the toasts stack up -- while any
     *  is alive, and once more on the frame after the last one dies, or its
     *  panel would be left painted on a layer nothing else touches. */
    Surface world = gfx_surface(SCREEN_WORLD);
#ifndef ABL_NOVIEW
    view2d_draw(&world);
#endif
    if (g.hurt_flash) gfx_shade(&world, 0, 0, WORLD_W, WORLD_H, 16 + g.hurt_flash);

    /*  Wipe only what the overlay carries. Arriving from another scene it is
        still holding that scene's full-screen artwork, so the whole layer goes
        once on the way in; after that it is the bar every frame and the toast
        strip while toasts exist, plus one more frame after the last one dies
        or its panel would stay painted on a layer nothing else touches. */
    {
        static int toast_band_dirty;
        if (s_scene_changed) gfx_rect(top, 0, 0, SCREEN_W, SCREEN_H, 0);
        gfx_rect(top, 0, 0, SCREEN_W, 16, 0);
        int alive = 0;
        for (int i = 0; i < MAX_TOASTS; i++) if (g.toast[i].life) alive = 1;
        if (alive || toast_band_dirty) gfx_rect(top, 0, 36, SCREEN_W, SCREEN_H - 36, 0);
        /*  ...and only send what was touched. Sixteen rows of system bar is
            8KB; the whole layer is 96KB, and shipping it every frame cost
            more than drawing the dungeon's floor. */
        if (s_scene_changed || alive || toast_band_dirty) plat_top_rows(0, SCREEN_H);
        else plat_top_rows(0, 16);
        toast_band_dirty = alive;
    }

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

    /*  The console below is a fixed object with four live readouts on it, and
     *  redrawing the whole of it -- housing, buttons, map lattice, weave --
     *  was measured at half of every frame. It is drawn when one of those
     *  readouts changes and left alone otherwise; see
     *  render_bottom_signature. */
    if (!s_draw_bottom) return;
#ifdef ABL_NOBOTTOM
    return;
#endif

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
    for (int i = 0; i < DUN_PAD_N; i++) draw_button(bot, &kDunPad[i], 0);
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

/*  The arena is drawn by what is left of the perspective renderer, so a fight
 *  happens on the same ground the party were walking on -- in the same
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
                   int hp, int hp_max, int mine, int rank) {
    const int h = 24;
    window(s, x, y, w, h, 0);
    /*  Several bosses wear the sprite of the mob they lead, and at 72 pixels
        the boss and the mob scale to within a percent of each other. So the
        box says it: a gold rule across the top, and what it is. */
    if (rank) {
        gfx_hline(s, x + 1, x + w - 2, y, rank == 2 ? C_GOLD : C_AMBER);
        gfx_hline(s, x + 1, x + w - 2, y + 1, gfx_scale_colour(rank == 2 ? C_GOLD : C_AMBER, 7, 16));
    }
    gfx_hline(s, x + 1, x + w - 2, y + 1, gfx_scale_colour(C_INK, 3, 16));
    gfx_text(s, x + 5, y + 4, rank ? C_GOLD : C_INK, name);
    if (!rank) {
        gfx_text(s, x + w - 26, y + 4, C_DIM, "L");
        gfx_text(s, x + w - 20, y + 4, C_AMBER, gfx_num(level));
    }

    if (hp_max < 1) hp_max = 1;
    if (hp < 0) hp = 0;

    /*  Your own numbers sit on the bar's line rather than under it. Two of
     *  these stack above the message box, and the row they used to take was
     *  the band the foes stand in. */
    /*  A boss gives up bar width for its tag: there is no room on the name
        line once a name like "The Street Preacher" is on it. */
    const char *tag = rank == 2 ? "BOROUGH" : rank == 1 ? "BLOCK" : 0;
    char num[16];
    int nw = tag ? gfx_text_width(tag) + 6 : 0;
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
    if (tag) gfx_text(s, x + w - 5 - gfx_text_width(tag), by - 1, C_AMBER, tag);
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
/*  A full card per crawler: level, health and stamina with the actual numbers
 *  on them, whatever is running on them this turn, and what they are holding.
 *  This is what the bottom screen shows while a message is being read.
 *
 *  The first version put the battle log here alone, which on turn one is a
 *  single sentence and a hundred and forty empty pixels -- the same fault the
 *  duplicated roster had, committed by its replacement. The party's own state
 *  is the one panel that is always full, is never on the top screen in this
 *  much detail, and is what you actually want while deciding a turn. */
static void party_cards(Surface *bot, int y) {
    static const char *kStatus[ST_COUNT] = { "BLEED", "STUN", "ATK+", "DEF-" };
    static const uint16_t kStatusCol[ST_COUNT] = { C_RED, C_MAGENTA, C_GREEN, C_AMBER };
    for (int i = 0; i < PARTY; i++) {
        const Hero *h = &g.hero[i];
        int x = 6 + i * 124, w = 120;
        int down = h->hp <= 0;
        window(bot, x, y, w, 74, 0);

        gfx_text(bot, x + 6, y + 6, down ? C_RED : C_INK, h->name);
        gfx_text(bot, x + w - 26, y + 6, C_DIM, "L");
        gfx_text(bot, x + w - 20, y + 6, C_AMBER, gfx_num(h->level));

        gfx_text(bot, x + 6, y + 20, C_GOLD, "HP");
        bar_meter(bot, x + 24, y + 19, w - 30, 8, h->hp, h->hp_max,
                  health_colour(h->hp, h->hp_max), 0);
        gfx_text(bot, x + 6, y + 32, C_DIM, gfx_num(h->hp));
        gfx_text(bot, x + 6 + gfx_text_width(gfx_num(h->hp)), y + 32, C_DIM, "/");
        gfx_text(bot, x + 12 + gfx_text_width(gfx_num(h->hp)), y + 32, C_DIM,
                 gfx_num(h->hp_max));

        gfx_text(bot, x + 6, y + 44, C_CYAN, "SP");
        bar_meter(bot, x + 24, y + 43, w - 30, 8, h->mp, h->mp_max, C_CYAN, 0);

        /*  Statuses where they can be seen before choosing, not after. A stun
            you find out about by losing the turn is a bug report. */
        int sx = x + 6;
        for (int k = 0; k < ST_COUNT; k++) {
            if (!h->status[k]) continue;
            int tw = gfx_text_width(kStatus[k]);
            if (sx + tw > x + w - 6) break;
            gfx_text(bot, sx, y + 58, kStatusCol[k], kStatus[k]);
            sx += tw + 6;
        }
        if (down) gfx_text(bot, x + 6, y + 58, C_RED, "DOWN");
        else if (h->guard) gfx_text(bot, x + 6, y + 58, C_GREEN, "GUARDING");
        else if (sx == x + 6) {
            int wep = h->equip[0];
            gfx_text(bot, x + 6, y + 58, C_DIM,
                     wep > 0 ? item_defs[wep].name : "bare hands");
        }
    }
}

/*  What just happened, oldest at the top. This replaced a second copy of the
 *  enemy roster: the top screen already carries every foe's name and health
 *  under its feet, so listing them again down here was two screens spending
 *  their space on one fact. The log is the thing a turn-based fight actually
 *  hides -- by the time you have read "Donut is down" the message box has
 *  moved on -- so the half of the screen that is not taking orders shows the
 *  last few lines instead. */
static void battle_log_panel(Surface *bot, int y, int rows) {
    gfx_text(bot, 6, y, C_AMBER, "WHAT HAPPENED");
    int first = g.bat.n_log - rows;
    if (first < 0) first = 0;
    int shown = 0;
    for (int i = first; i < g.bat.n_log; i++, shown++) {
        int ry = y + 14 + shown * 11;
        /*  The newest line is the one being read out; the older ones fade back
            so the eye lands on the bottom of the list without a cursor. */
        int newest = (i == g.bat.n_log - 1);
        gfx_text(bot, 10, ry, newest ? C_INK : C_DIM, g.bat.log[i]);
    }
    if (!shown) gfx_text(bot, 10, y + 14, C_DIM, "Nothing yet. Give it a second.");
}

/*  A foe's health, worn by the foe. The three of these used to be stacked in
 *  the top-left corner as full-width boxes, which put the roster as far from
 *  the thing it described as the screen allows, buried the arena art behind
 *  it, and still left the bottom screen showing the same three names again.
 *  Hung under the sprite it belongs to, the same information costs a sixth of
 *  the pixels and needs no reading order at all: the bar that is dropping is
 *  under the one you hit.
 *
 *  The plate is as wide as its name needs, clamped to the slot the foe stands
 *  in, so three of them side by side cannot collide however long the names. */
/*  Fit a foe's name into the room its slot has.
 *
 *  Separate from the plate, and not static, because it is the part with a
 *  rule in it that a test can hold: every name in the roster has to come out
 *  of here no wider than the room it was given. The plate that used to do
 *  this inline only sized its own box -- the text stayed full width and was
 *  centred from a negative offset, so it hung out over both neighbours and
 *  two Goblin Trappers printed as "Goblin TrapperGoblin Trapper".
 *
 *  The leading word goes first: these are "<modifier> <noun>" names and the
 *  noun is the half that says what the thing is. Only then is it cut
 *  mid-word. One- and two-foe fights have room for anything in the roster
 *  and never come through the shortening at all.
 */
const char *render_fit_name(const char *name, int room, char *buf, int cap) {
    if (gfx_text_width(name) <= room) return name;
    for (const char *p = name; *p; p++)
        if (*p == ' ' && gfx_text_width(p + 1) <= room) return p + 1;
    int len = 0;
    while (name[len] && len < cap - 1) { buf[len] = name[len]; len++; }
    buf[len] = 0;
    while (len > 1 && gfx_text_width(buf) > room) buf[--len] = 0;
    return buf;
}

static void foe_plate(Surface *s, int cx, int y, int room,
                      const FoeDef *def, int hp, int hp_max) {
    const char *tag = def->rank == 2 ? "BOROUGH" : def->rank == 1 ? "BLOCK" : 0;
    char cut[32];
    const char *name = render_fit_name(def->name, room, cut, (int)sizeof cut);
    int nw = gfx_text_width(name);
    int w = nw + 8;
    if (w > room) w = room;
    if (w < 34) w = 34;
    int x = cx - w / 2;
    if (x < 2) x = 2;
    if (x + w > SCREEN_W - 2) x = SCREEN_W - 2 - w;

    /*  A boss announces itself: the plate is gold-ruled and carries its tier,
        because several of them wear the sprite of the mob they lead. */
    if (def->rank) {
        uint16_t gold = def->rank == 2 ? C_GOLD : C_AMBER;
        gfx_hline(s, x, x + w - 1, y - 2, gold);
        /*  Under the bar, not over the name: a boss banner sits at the very
            top of the screen and there is no room above it for a tag. */
        if (tag) {
            int tw = gfx_text_width(tag);
            gfx_text(s, x + (w - tw) / 2, y + 16, gold, tag);
        }
    }
    /*  Drawn on the arena rather than in a window: a bordered box per foe was
        three more frames competing with the sprites. A shadowed name and a
        thin bar sit on the background without boxing it in. */
    int tx = x + (w - nw) / 2;
    gfx_text(s, tx + 1, y + 1, C_VOID, name);
    gfx_text(s, tx, y, def->rank ? C_GOLD : C_INK, name);
    bar_meter(s, x, y + 9, w, 5, hp, hp_max, health_colour(hp, hp_max), 0);
    if (hp * 100 / (hp_max < 1 ? 1 : hp_max) <= 20 && (g.anim & 16))
        gfx_rect(s, x + 1, y + 10, (w - 2) * hp / (hp_max < 1 ? 1 : hp_max), 3, C_INK);
}

static void draw_battle(Surface *top, Surface *bot) {
    int floor_index = g.dun.index;
    draw_arena(top, floor_index);

    /*  Foes on the far side, party in the near corner, the way the camera sits
     *  in every turn-based fight since 1996.
     *
     *  They stand in a line-up: the screen is divided into one slot per foe
     *  and each is centred in its own, feet on a shared baseline. The old
     *  placement packed them rightwards from a fixed margin and staggered
     *  every other one twelve pixels down, which was a way of stopping big
     *  sprites from touching -- but once each foe carries its own name and
     *  health plate, a stagger drops one foe's plate straight through its
     *  neighbour's knees, and 58 pixels of spacing cannot hold a plate wide
     *  enough to write "Club Bouncer" on. Slots fix both: nothing overlaps by
     *  construction, and the plate simply gets told how much room it has. */
    int msg_top = SCREEN_H - 38;
    /*  The party's own boxes start at y=98, so a plate hung under a foe has to
     *  be finished by then -- the first cut of this put the names at 92 and
     *  the bars underneath them disappeared behind Carl's box. */
    const int kBase = 78;             /* the floor a mob stands on */
    /*  Four, not twelve. The band has to be tall enough that the biggest
        thing in the roster fits inside it without being clipped to the same
        height as the second biggest -- at a 66px ceiling a Screaming Sofa and
        a Club Bouncer came out identical no matter what their bulk said, and
        the column was decorative. */
    const int kCeil = 4;              /* and the ceiling it cannot grow past */
    int slot_w = SCREEN_W / (g.bat.n_foes < 1 ? 1 : g.bat.n_foes);
    for (int i = 0; i < g.bat.n_foes; i++) {
        const Foe *f = &g.bat.foes[i];
        const Sprite *sp = sprite_table[foe_defs[f->def].sprite];
        /*  Sized to a target height on screen, not to a percentage of the
            source art. Several bosses are built from a mob's own sprite --
            the Hoarder is a Sludge Mound, the Juicer a Troglodyte -- so a flat
            percentage left them the same size as the thing they lead, while
            the 96px boss art at the same percentage was too tall to fit above
            the party's health boxes. Rank picks the height; the scale falls
            out of whatever the sprite happens to be. */
        /*  A boss wears its name as a banner across the top instead of a
            plate at its feet. Hanging one under a boss costs it the sixteen
            pixels of height that are most of what makes it read as a boss,
            and a single foe has the whole width to write on anyway. */
        int rank = foe_defs[f->def].rank;
        int plate_y = kBase + 4, base = kBase, ceil_ = kCeil;
        if (rank) { plate_y = 6; base = 96; ceil_ = 24; }
        /*  Height comes from what the thing is, not just from how many are
            in the room. Everything used to be normalised to one target, so a
            sewer rat and a club bouncer arrived the same size and a boss was
            a mob at the same scale with a gold rule over it; the roster's
            bulk column is what makes a fight have a big one in it.

            The room still gets a say -- three foes have to fit side by side
            -- but it scales the whole line-up rather than flattening it. */
        int room = rank ? 84 : g.bat.n_foes >= 3 ? 46 : g.bat.n_foes == 2 ? 50 : 56;
        int bulk = foe_defs[f->def].bulk ? foe_defs[f->def].bulk : 100;
        int want = room * bulk / 100;
        int headroom = base - ceil_;
        if (want > headroom) want = headroom;
        int scale = want * 100 / (sp->h ? sp->h : 1);
        /*  Never enlarge past the slot: three wide sprites at a height that
            fits would still run into each other sideways. */
        int max_w = slot_w - 8;
        if (sp->w * scale / 100 > max_w) scale = max_w * 100 / (sp->w ? sp->w : 1);
        int fw = sp->w * scale / 100, fh = sp->h * scale / 100;

        int cx = slot_w * i + slot_w / 2;
        int fx = cx - fw / 2;
        int fy = base - fh - (int)((g.anim / 14 + i) & 1);    /* a slow idle bob */
        if (fy < ceil_) fy = ceil_;
        if (fx < 2) fx = 2;
        if (fx + fw > SCREEN_W - 2) fx = SCREEN_W - 2 - fw;

        for (int k = 0; k < 4; k++)                 /* the platform it stands on */
            gfx_dither(top, fx + k, fy + fh + k - 2, fw - k * 2, 1, C_SHADOW, 12 - k * 3);
        if (!f->alive) { gfx_shade(top, fx, fy, fw, fh, 11); continue; }
        gfx_sprite_scaled(top, sp, fx, fy, scale, 100);
        if (g.bat.shake && g.bat.target == i)
            gfx_shade(top, fx, fy, fw, fh, 10);
        foe_plate(top, rank ? SCREEN_W / 2 : cx, plate_y,
                  rank ? SCREEN_W - 16 : slot_w - 6, &foe_defs[f->def],
                  f->hp, f->hp_max);
        /*  The opening has to be seen or the mechanic is a dice roll. It gets
            the loudest thing the screen has: a ring round the foe that is
            showing it, and the tell itself under the banner. */
        if (g.bat.tell && g.bat.tell_foe == i) {
            uint16_t ring = (g.anim & 8) ? C_GOLD : C_AMBER;
            gfx_frame(top, fx - 3, fy - 3, fw + 6, fh + 6, ring);
            gfx_frame(top, fx - 4, fy - 4, fw + 8, fh + 8, gfx_mix(ring, C_VOID, 8));
            const char *t = foe_defs[f->def].tell;
            if (t) {
                int tw = gfx_text_width(t);
                int tx = (SCREEN_W - tw) / 2;
                gfx_panel(top, tx - 5, plate_y + 18, tw + 10, 12, C_VOID, ring);
                gfx_text(top, tx, plate_y + 21, ring, t);
            }
        }
        if (g.bat.broken && g.bat.tell_foe == i)
            gfx_shade(top, fx, fy, fw, fh, 22);
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

    /*  Only yours are boxed now. Theirs are plates under their feet, drawn
     *  with the sprites above; a box each in the corner was the same three
     *  names the bottom screen was also listing. */
    for (int i = 0; i < PARTY; i++)
        hp_box(top, SCREEN_W - 122, msg_top - 56 + i * 28, 118,
               g.hero[i].name, g.hero[i].level, g.hero[i].hp, g.hero[i].hp_max, 1, 0);

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
        party_cards(bot, 26);
        battle_log_panel(bot, 108, 5);
        gfx_text(bot, 8, 178, C_DIM, "A or tap to continue");
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
            int y = 30 + shown * 20;
            window(bot, 6, y, 244, 19, on);
            const Sprite *ic = item_sprite(i);
            if (ic) gfx_sprite_scaled(bot, ic, 9, y + 1, 53, 100);
            gfx_text(bot, 32, y + 6, on ? C_AMBER : C_INK, item_defs[i].name);
            gfx_text(bot, 208, y + 6, C_INK, "x");
            gfx_text(bot, 216, y + 6, C_INK, gfx_num(g.inventory[i]));
            if (on) {
                char eff[64];
                item_effect(eff, i);
                gfx_text(bot, 12, 158, C_GREEN, eff);
                gfx_text_wrapped(bot, 12, 170, 236, C_DIM, item_defs[i].blurb);
            }
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
        party_cards(bot, 26);
        battle_log_panel(bot, 108, 5);
        if (foe >= 0 && foe < g.bat.n_foes) {
            const char *name = foe_defs[g.bat.foes[foe].def].name;
            gfx_text(bot, 6, 178, C_MAGENTA, name);
            gfx_text(bot, 6 + gfx_text_width(name) + 4, 178, C_DIM, "is taking its turn.");
        }
        return;
    }
    {
        const char *who = g.hero[g.bat.actor].name;
        gfx_text(bot, 6, 26, C_DIM, "What will");
        gfx_text(bot, 62, 26, C_MAGENTA, who);
        gfx_text(bot, 62 + gfx_text_width(who) + 4, 26, C_DIM, "do?");
    }
    for (int i = 0; i < 4; i++)
        draw_button(bot, &kBatCommands[i], g.bat.cursor == i);
    /*  A line under the block saying what the highlighted one does. Four bare
        verbs on a first playthrough leave GUARD ambiguous -- guard whom? --
        and the strip is free now that the roster has gone. */
    {
        static const char *kWhat[4] = {
            "Swing at one of them. Or pick a move.",
            "Open the bag. Potions, bombs, whatever survived.",
            "Brace. Halves the next hit, and Carl covers Donut.",
            "Try to leave. Bosses do not allow it.",
        };
        int c = g.bat.cursor < 4 ? g.bat.cursor : 0;
        gfx_text(bot, 8, 162, C_DIM, kWhat[c]);
    }
}

/* ----------------------------------------------------------------- draft -- */

static void draw_draft(Surface *top, Surface *bot)
{
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(51, 37, 74) /* arcane 0 */, RGB(51, 37, 74) /* arcane 0 */);
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
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(32, 63, 80) /* water 0 */, RGB(37, 53, 74) /* cloth_blue 0 */);
    for (int i = 0; i < 7; i++) {                       /* blocks against the sky */
        int bx = i * 40 - 8, bw = 34;
        int bh = 70 + ((i * 37) % 5) * 12;
        gfx_rect(s, bx, SCREEN_H - bh - 26, bw, bh, RGB(37, 53, 74) /* cloth_blue 0 */);
        for (int wy = 0; wy < bh - 12; wy += 12)        /* a few lights still on */
            for (int wx = 0; wx < bw - 8; wx += 10)
                if (((i * 7 + wx + wy) % 11) < 3)
                    gfx_rect(s, bx + 4 + wx, SCREEN_H - bh - 20 + wy, 4, 5,
                             RGB(111, 84, 44) /* hair_blonde 0 */);
    }
    gfx_rect(s, 0, SCREEN_H - 26, SCREEN_W, 26, RGB(32, 34, 41) /* cloth_black 0 */);
    gfx_hline(s, 0, SCREEN_W - 1, SCREEN_H - 26, RGB(32, 34, 41) /* cloth_black 0 */);
    for (int i = 0; i < 70; i++) {                      /* rain, going sideways */
        int x = (i * 53 + g.anim * 3) % (SCREEN_W + 40) - 20;
        int y = (i * 31 + g.anim * 6) % SCREEN_H;
        gfx_pixel(s, x, y, RGB(81, 64, 100) /* cloth_purple 1 */);
        gfx_pixel(s, x + 1, y + 2, RGB(38, 55, 66) /* ink blue */);
    }
    if (lit) {                                          /* the cat, up the ironwork */
        for (int y = 96; y < SCREEN_H - 26; y += 8)     /* the ladder she went up */
            gfx_rect(s, 172, y, 22, 2, RGB(58, 65, 72) /* ink cool */);
        gfx_rect(s, 170, 96, 3, SCREEN_H - 122, RGB(70, 72, 80) /* cloth_black 2 */);
        gfx_rect(s, 192, 96, 3, SCREEN_H - 122, RGB(52, 56, 64) /* ui panel */);
        gfx_rect(s, 148, 92, 60, 4, RGB(80, 85, 91) /* ui panel_lit */);  /* the landing she is on */
        gfx_hline(s, 148, 207, 92, RGB(98, 106, 112) /* snow 0 */);
        gfx_sprite_scaled(s, &spr_donut, 162, 92 - spr_donut.h * 52 / 100, 52, 100);
    }
    gfx_sprite_scaled(s, &spr_carl, 40, SCREEN_H - 26 - spr_carl.h * 78 / 100, 78, 100);
}

static void backdrop_collapse(Surface *s)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(99, 37, 43) /* blood 1 */, RGB(57, 42, 39) /* hair_brown 0 */);
    for (int i = 0; i < 7; i++) {                       /* what is left of them */
        int bx = i * 40 - 8, bw = 34;
        int bh = 10 + ((i * 29) % 4) * 8;
        gfx_rect(s, bx, SCREEN_H - bh - 26, bw, bh, RGB(36, 35, 42) /* ink ink */);
    }
    gfx_rect(s, 0, SCREEN_H - 26, SCREEN_W, 26, RGB(36, 35, 42) /* ink ink */);
    for (int i = 0; i < 120; i++) {                     /* dust, going up */
        int x = (i * 71 + g.anim) % SCREEN_W;
        int y = SCREEN_H - ((i * 37 + g.anim * 2) % SCREEN_H);
        gfx_pixel(s, x, y, i & 1 ? RGB(73, 59, 58) /* ink warm */ : RGB(61, 48, 48) /* ink brown */);
    }
    gfx_sprite_scaled(s, &spr_carl, 40, SCREEN_H - 26 - spr_carl.h * 78 / 100, 78, 100);
}

static void backdrop_announce(Surface *s)
{
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(51, 37, 74) /* arcane 0 */, RGB(51, 37, 74) /* arcane 0 */);
    for (int i = 0; i < 40; i++) {                      /* the broadcast carrier */
        int y = (i * 9 + g.anim / 2) % SCREEN_H;
        gfx_hline(s, 0, SCREEN_W - 1, y, RGB(51, 37, 74) /* arcane 0 */);
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
    gfx_vgradient(s, 0, 0, SCREEN_W, SCREEN_H, RGB(32, 34, 41) /* cloth_black 0 */, RGB(32, 34, 41) /* cloth_black 0 */);
    for (int i = 0; i < 9; i++) {                       /* steps going down */
        int inset = i * 12;
        gfx_rect(s, 40 + inset, 30 + i * 16, SCREEN_W - 80 - inset * 2, 12,
                 gfx_scale_colour(RGB(70, 72, 80) /* cloth_black 2 */, 14 - i, 16));
        gfx_hline(s, 40 + inset, SCREEN_W - 41 - inset, 30 + i * 16, RGB(36, 35, 42) /* ink ink */);
    }
    gfx_rect(s, 112, 158, 32, 34, RGB(51, 37, 74) /* arcane 0 */);
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
            gfx_rect(top, 0, y, (shake < 0 ? -shake : shake), 4, RGB(36, 35, 42) /* ink ink */);
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

    int asking = chapter_asking();
    int box_h = asking ? 64 : 120;
    window(bot, 4, 24, SCREEN_W - 8, box_h, 0);

    /*  What has been said so far, with the line being typed at the bottom.
     *
     *  The box is a hundred and twenty pixels tall and a line of dialogue is
     *  about forty of them, so showing only the current line left two thirds
     *  of the largest panel in the game empty -- on the screen the player is
     *  looking at while they read. The lines already spoken are the obvious
     *  thing to put there: they cost nothing to keep, they are what somebody
     *  who glanced away wants back, and a chapter is a conversation, which is
     *  a shape a transcript already fits. Laid out backwards from the current
     *  line until the box is full, then drawn forwards, so the line being
     *  revealed is always the last one.
     *
     *  Not while a question is up: there the box is short and the answers
     *  below it are what the screen is for. */
    const int kX = 10, kW = SCREEN_W - 20, kRow = 9;
    int y = 30;
    if (!asking) {
        const Chapter *ch = 0;
        for (int i = 0; i < chapter_count; i++)
            if (chapters[i].chapter == g.chapter) ch = &chapters[i];
        int here = g.cut_line;
        int first = here;
        if (ch && here < ch->count) {
            int rows_free = (box_h - 12) / kRow;
            int used = gfx_text_wrapped_count(kW, shown) + 1;
            while (first > 0) {
                const CutLine *prev = &ch->lines[first - 1];
                /*  A question's own text is on screen with its answers; it
                    does not belong in the transcript twice. */
                int need = gfx_text_wrapped_count(kW, prev->text) + 1;
                if (used + need > rows_free) break;
                used += need;
                first--;
            }
            for (int i = first; i < here; i++)
                y += gfx_text_wrapped(bot, kX, y, kW, C_DIM, ch->lines[i].text) * kRow
                   + kRow / 2;
        }
    }
    gfx_text_wrapped(bot, kX, y, kW, C_INK, shown);

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
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(32, 34, 41) /* cloth_black 0 */, RGB(53, 44, 69) /* cloth_purple 0 */);
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
        gfx_text(bot, 6, 108, C_AMBER, "BAG");
        int y = 120, shown = 0;
        for (int i = 1; i < item_count && shown < 4; i++) {
            if (!g.inventory[i]) continue;
            const Sprite *ic = item_sprite(i);
            if (ic) gfx_sprite_scaled(bot, ic, 10, y - 2, 53, 100);
            gfx_text(bot, 34, y + 3, C_INK, item_defs[i].name);
            gfx_text(bot, 214, y + 3, C_DIM, gfx_num(g.inventory[i]));
            y += 18;
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
        /*  `first` and not `top`: this function's first parameter is the top
            Surface, and an int called top shadowing it inside a drawing
            routine is a compile away from being passed to gfx_text. */
        int first = sel - rows / 2;
        if (first > ach_count - rows) first = ach_count - rows;
        if (first < 0) first = 0;
        for (int r = 0; r < rows && first + r < ach_count; r++) {
            int i = first + r, y = 48 + r * 23;
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
        gfx_text_wrapped(bot, 6, 46, 244, C_INK,
                         "Everything down here is broadcast. Fights you win loudly pay better than "
                         "fights you win quietly, and the audience decides what loud means.");
        gfx_text(bot, 6, 82, C_DIM, "Story beats seen");
        gfx_text(bot, 180, 82, C_INK, gfx_num(g.story_beat + 1));
        gfx_text(bot, 6, 94, C_DIM, "Floor");
        gfx_text(bot, 180, 94, C_INK, gfx_num(g.dun.index + 1));

        /*  The controls live here. They used to be four lines on the title
            screen, which is the one screen that should be selling the game
            rather than explaining it; this is the tab somebody actually opens
            when they want to look something up. */
        gfx_hline(bot, 6, 249, 108, C_WIN_EDGE);
        gfx_text(bot, 6, 114, C_AMBER, "CONTROLS");
        static const char *const kRow[5][2] = {
            { "D-pad",  "walk, four ways" },
            { "A / B",  "act, back" },
            { "X",      "this screen" },
            { "Y",      "quick heal" },
            { "Stylus", "everything, if you prefer" },
        };
        for (int i = 0; i < 5; i++) {
            gfx_text(bot, 10, 128 + i * 11, C_INK, kRow[i][0]);
            gfx_text(bot, 74, 128 + i * 11, C_DIM, kRow[i][1]);
        }
    }
    Rect back = { 194, 172, 56, 18, "BACK" };
    draw_button(bot, &back, 0);
}

/* ----------------------------------------------------------------- shop --- */

static void draw_shop(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(57, 42, 39) /* hair_brown 0 */, RGB(53, 37, 31) /* wood_dark 0 */);
    system_bar(top, "BOPCA PROVISIONS", "STOCK IS WHAT IT IS");
    gfx_sprite_scaled(top, &spr_bopca, 4, 58, 150, 100);
    gfx_sprite_scaled(top, &spr_shop, 196, 22, 120, 100);

    int stock[INVENTORY], n = 0;
    for (int i = 1; i < item_count; i++)
        if (item_defs[i].price > 0 && item_defs[i].price <= 500) stock[n++] = i;
    int sel = g.shop_cursor < n ? g.shop_cursor : 0;
    window(top, 120, 60, 130, 118, 0);
    /*  What it looks like, next to what it is called. A shop that lists names
        and prices and shows nothing is a spreadsheet. */
    {
        const Sprite *ic = item_sprite(stock[sel]);
        if (ic) {
            gfx_panel(top, 126, 66, 38, 38, C_VOID, C_AMBER_DK);
            gfx_sprite_scaled(top, ic, 129, 69, 100, 100);
        }
        gfx_text(top, 170, 70, C_AMBER, item_defs[stock[sel]].name);
        char eff[64];
        item_effect(eff, stock[sel]);
        gfx_text_wrapped(top, 170, 84, 76, C_GREEN, eff);
    }
    gfx_text_wrapped(top, 126, 110, 120, C_INK, item_defs[stock[sel]].blurb);
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
        int y = 26 + i * 19;
        window(bot, 6, y, 244, 18, on);
        const Sprite *ic = item_sprite(item);
        if (ic) gfx_sprite_scaled(bot, ic, 9, y + 1, 50, 100);
        gfx_text(bot, 30, y + 6, on ? C_AMBER : C_INK, item_defs[item].name);
        gfx_text(bot, 186, y + 6, g.gold >= item_defs[item].price ? C_GOLD : C_RED,
                 gfx_num(item_defs[item].price));
        gfx_text(bot, 228, y + 6, C_DIM, "x");
        gfx_text(bot, 236, y + 6, C_DIM, gfx_num(g.inventory[item]));
    }
    /*  The pager goes in the header. Rows carry icons now and are a pixel
        taller each, which walked the seventh one down onto where this used to
        sit, just above the button bar. */
    if (n > rows) {
        gfx_text(bot, 60, 7, C_DIM, gfx_num(sel + 1));
        gfx_text(bot, 74, 7, C_DIM, "/");
        gfx_text(bot, 82, 7, C_DIM, gfx_num(n));
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
    const uint16_t warm_hi = RGB(255, 247, 194) /* lightning 4 */, warm = RGB(194, 163, 101) /* sand 3 */;
    const uint16_t wall = RGB(179, 167, 143) /* stone_ancient 4 */, wall_lo = RGB(121, 114, 99) /* stone_ancient 2 */;
    const uint16_t tile_a = RGB(229, 224, 211) /* hair_silver 3 */, tile_b = RGB(80, 82, 82) /* stone 1 */;

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
        const uint16_t bez = RGB(36, 35, 42) /* ink ink */, bez_hi = RGB(80, 85, 91) /* ui panel_lit */;
        const uint16_t scr = RGB(38, 55, 66) /* ink blue */, lit = RGB(121, 194, 199) /* water 4 */;
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
                int n = 0;                  /* `w` is the panel width above */
                for (int k = 0; k < len && n < 14; k++) {
                    who[n++] = raw[k];
                    int left = len - 1 - k;
                    if (left && left % 3 == 0) who[n++] = ',';
                }
                who[n] = 0;
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
            gfx_frame(top, x, y, w, h, RGB(32, 34, 41) /* cloth_black 0 */);
        }
    }

    {   /* The back counter, and the hatch behind it. Without them the upper
           half is a gradient, and a gradient is not a room. */
        const uint16_t lam = RGB(137, 80, 57) /* copper 1 */, lam_hi = RGB(195, 138, 85) /* wood 3 */;
        const uint16_t lam_lo = RGB(91, 56, 38) /* wood 0 */, glass = RGB(217, 222, 214) /* snow 3 */;
        (void)glass;
        gfx_rect(top, 0, 100, 118, 28, lam);
        gfx_rect(top, 0, 100, 118, 3, lam_hi);
        gfx_rect(top, 0, 125, 118, 3, lam_lo);
        for (int x = 8; x < 118; x += 26)            /* stools, bolted down */
            gfx_rect(top, x, 96, 14, 4, RGB(165, 163, 151) /* stone 4 */);
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
    gfx_hline(top, 0, SCREEN_W - 1, 128, RGB(64, 62, 57) /* stone_ancient 0 */);
    gfx_hline(top, 0, SCREEN_W - 1, 129, RGB(121, 114, 99) /* stone_ancient 2 */);

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
    window(bot, 8, 100, 240, 34, 0);
    gfx_text(bot, 16, 108, C_GREEN, "Everyone is patched up.");
    gfx_text(bot, 16, 120, C_DIM, "The floor outside has not stopped.");

    int held = game_boxes_held();
    window(bot, 8, 138, 240, 40, held > 0);
    if (held) {
        gfx_text(bot, 16, 146, C_GOLD, "BOXES TO OPEN");
        gfx_text(bot, 122, 146, C_INK, gfx_num(held));
        /*  What is in the pile, so the run of them has a shape before it
            starts rather than being a surprise each time. */
        static const char *const kTier[4] = { "BRZ", "SLV", "GLD", "LEG" };
        static const uint16_t kTierCol[4] = { RGB(195, 138, 85) /* wood 3 */, RGB(217, 226, 231) /* lightning 3 */,
                                              RGB(244, 188, 76) /* fire 5 */, RGB(192, 155, 215) /* arcane 4 */ };
        int x = 16;
        for (int t = 3; t >= 0; t--) {
            if (!g.boxes_held[t]) continue;
            gfx_text(bot, x, 162, kTierCol[t], kTier[t]);
            gfx_text(bot, x + 20, 162, C_INK, gfx_num(g.boxes_held[t]));
            x += 40;
        }
        gfx_text(bot, 150, 146, C_AMBER, "A OPENS");
        gfx_text(bot, 150, 162, C_DIM, "B LEAVES");
    } else {
        gfx_text(bot, 16, 148, C_DIM, "No boxes to open. Bring some back.");
        gfx_text(bot, 16, 162, C_AMBER, "A OR B TO LEAVE");
    }
}

static void draw_box(Surface *top, Surface *bot) {
    static const char *const tiers[4] = { "BRONZE", "SILVER", "GOLD", "LEGENDARY" };
    static const uint16_t tier_colour[4] = { RGB(195, 138, 85) /* wood 3 */, RGB(217, 226, 231) /* lightning 3 */, RGB(244, 188, 76) /* fire 5 */, RGB(192, 155, 215) /* arcane 4 */ };
    uint16_t c = tier_colour[g.box_tier];
    int phase = g.box_phase, t = (int)g.box_timer;
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(32, 34, 41) /* cloth_black 0 */, gfx_scale_colour(c, 5, 16));
    system_bar(top, "LOOT BOX", tiers[g.box_tier]);

    const Sprite *box = sprite_table[SPR_BOX_BRONZE + g.box_tier];
    const Sprite *open_box = sprite_table[SPR_BOX_OPEN_BRONZE + g.box_tier];
    const Sprite *lid = sprite_table[SPR_LID_BRONZE + g.box_tier];
    const Sprite *icon = item_sprite(g.box_item);
    int cx = 128, cy = 108;

    /*  Beat one: it rattles, and the rattle builds. The box used to bob
     *  gently on a four-frame counter for forty frames and then cut straight
     *  to the answer, which is a wait rather than an opening. */
    if (phase == BOX_SHAKE) {
        int build = t * 16 / 52;                       /* 0..16 over the beat */
        int amp = 1 + build / 4;
        int jx = ((t * 7919) % 3) - 1, jy = ((t * 104729) % 3) - 1;
        for (int i = 0; i < 5 + build; i++) {          /* seams leaking light */
            int a = (i * 71 + t * 6) % 360;
            int dx = ((a % 61) - 30) * (10 + build) / 24;
            int dy = ((a % 47) - 23) * (10 + build) / 24;
            gfx_pixel(top, cx + dx, cy - 22 + dy, gfx_scale_colour(c, 8 + (i & 7), 16));
        }
        gfx_sprite_scaled(top, box, cx - box->w + jx * amp,
                          cy - box->h + jy * amp, 200, 100);
        /*  The line that used to be here said "The box is deciding.", which
            the bottom screen also says, and it sat exactly where the
            achievement toasts stack. */
    }

    /*  Beat two: the lid goes, and the light it was holding gets out. */
    if (phase == BOX_BURST) {
        /*  A real ring, rasterised, rather than pixels scattered by modulo
            arithmetic -- the first cut of this walked an angle through a
            handful of primes and produced specks in the corners that read as
            dust, not as a shockwave. */
        int r = 6 + t * 8;
        for (int k = 0; k < 3; k++) {
            int rr = r - k * 6;
            if (rr < 3) continue;
            int fade = 14 - k * 3 - t / 3;
            if (fade < 3) continue;
            /*  x = rr cos, y = rr sin, stepped as an integer circle. */
            int px = rr, py = 0, err = 1 - rr;
            while (px >= py) {
                static const int8_t oct[8][2] = { {1,1},{1,-1},{-1,1},{-1,-1},
                                                  {1,1},{1,-1},{-1,1},{-1,-1} };
                for (int o = 0; o < 8; o++) {
                    int ax = (o < 4 ? px : py) * oct[o][0];
                    int ay = (o < 4 ? py : px) * oct[o][1];
                    gfx_pixel(top, cx + ax, cy - 20 + ay / 2,
                              gfx_scale_colour(c, fade, 16));
                }
                py++;
                if (err < 0) err += 2 * py + 1;
                else { px--; err += 2 * (py - px) + 1; }
            }
        }
        gfx_sprite_scaled(top, open_box, cx - open_box->w, cy - open_box->h, 200, 100);
        int fly = t * 3;                              /* the lid, leaving */
        gfx_sprite_scaled(top, lid, cx - lid->w, cy - open_box->h * 2 - fly + 8,
                          200, 100);
        /*  A white blink on the first few frames. gfx_shade scales by
            amount/16, so sixteen is unchanged and above it brightens -- and
            zero multiplies the screen by nothing and paints it black. Writing
            this as `t < 6 ? 16 + (6 - t) * 2 : 0` therefore blacked out the
            whole top screen for the rest of the beat. The call has to be
            skipped, not passed a zero. */
        if (t < 6) gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 16 + (6 - t) * 2);
    }

    /*  Beat three: it comes up out of the box, growing as it rises. */
    if (phase == BOX_RISE && icon) {
        int p = t * 100 / 33;                          /* 0..100 through the rise */
        if (p > 100) p = 100;
        int zoom = 120 + p * 80 / 100;                 /* 120% -> 200% */
        int rise = 40 * p / 100;
        gfx_sprite_scaled(top, open_box, cx - open_box->w, cy - open_box->h, 200, 100);
        for (int k = 0; k < 4; k++)                    /* light under it */
            gfx_dither(top, cx - 30 + k * 6, cy - 26 - rise + k * 3, 60 - k * 12, 2,
                       c, 12 - k * 3);
        int iw = icon->w * zoom / 100, ih = icon->h * zoom / 100;
        gfx_sprite_scaled(top, icon, cx - iw / 2, cy - 24 - rise - ih / 2, zoom, 100);
    }

    /*  And then it stops, and waits, and lets you look at it. */
    if (phase == BOX_CARD) {
        if (icon) {
            int iw = icon->w * 250 / 100, ih = icon->h * 250 / 100;
            for (int k = 0; k < 5; k++)                /* a plinth of light */
                gfx_dither(top, cx - 40 + k * 8, 132 + k * 2, 80 - k * 16, 2, c, 12 - k * 2);
            gfx_sprite_scaled(top, icon, cx - iw / 2, 128 - ih, 250, 100);
        }
        /*  No chest on this beat. It was drawn behind the prize and the two
            overlapped into one shape; the card is about the thing you won. */
        gfx_panel(top, 20, 140, 216, 20, C_PANEL, c);
        gfx_text(top, 20 + (216 - gfx_text_width(item_defs[g.box_item].name)) / 2, 146,
                 c, item_defs[g.box_item].name);
        gfx_text(top, 8, 168, C_DIM, "You got it. Read it, then close it.");
    }

    /* ---- bottom: the record while it opens, the card once it is open ------ */
    backdrop(bot);
    if (phase != BOX_CARD) {
        gfx_text_big(bot, 12, 14, c, tiers[g.box_tier]);
        gfx_text(bot, 12, 40, C_DIM, "The box is deciding.");
        gfx_text(bot, 12, 54, C_DIM, "Boxes opened this run");
        gfx_text(bot, 212, 54, C_INK, gfx_num(g.boxes_opened));
        gfx_hline(bot, 12, SCREEN_W - 13, 68, C_WIN_EDGE);
        gfx_text(bot, 12, 76, C_AMBER, "IN THE BAG");
        int shown = 0;
        for (int i = 1; i < item_count && shown < 7; i++) {
            if (!g.inventory[i]) continue;
            gfx_text(bot, 16, 92 + shown * 12, C_INK, item_defs[i].name);
            gfx_text(bot, 214, 92 + shown * 12, C_DIM, "x");
            gfx_text(bot, 222, 92 + shown * 12, C_DIM, gfx_num(g.inventory[i]));
            shown++;
        }
        if (!shown) gfx_text(bot, 16, 92, C_DIM, "Nothing yet. This is the first thing.");
        gfx_text(bot, 12, 178, C_DIM, "Tap to skip.");
        return;
    }

    /*  The card. An RPG that names a reward and shows nothing is asking you to
     *  take its word for what you won, so: the icon, the name, what it does in
     *  numbers, what the show says about it, and how many you are now carrying. */
    const ItemDef *d = &item_defs[g.box_item];
    window(bot, 6, 6, SCREEN_W - 12, 150, 0);
    if (icon) {
        gfx_panel(bot, 14, 14, 44, 44, C_VOID, c);
        gfx_sprite_scaled(bot, icon, 16, 16, 125, 100);
    }
    gfx_text(bot, 66, 16, c, d->name);
    static const char *const kSlot[3] = { "WEAPON", "ARMOUR", "TRINKET" };
    const char *kind = d->kind == IT_WEAPON || d->kind == IT_ARMOUR || d->kind == IT_TRINKET
                     ? kSlot[d->slot < 3 ? d->slot : 0] : "CONSUMABLE";
    gfx_text(bot, 66, 28, C_DIM, kind);

    char effect[64];
    item_effect(effect, g.box_item);
    gfx_text(bot, 66, 44, C_GREEN, effect);

    gfx_hline(bot, 14, SCREEN_W - 20, 64, C_WIN_EDGE);
    gfx_text_wrapped(bot, 14, 72, SCREEN_W - 32, C_INK, d->blurb);

    gfx_text(bot, 14, 118, C_DIM, "In the bag");
    gfx_text(bot, 90, 118, C_INK, gfx_num(g.inventory[g.box_item]));
    gfx_text(bot, 14, 132, C_DIM, "Boxes opened this run");
    gfx_text(bot, 168, 132, C_INK, gfx_num(g.boxes_opened));

    /*  A button, because "it will go away on its own" is what it used to do. */
    {
        Rect close = { 78, 164, 100, 24, "CLOSE" };
        draw_button(bot, &close, 1);
    }
}

/* -------------------------------------------------------------- levelup --- */

static void draw_levelup(Surface *top, Surface *bot) {
    int hero = g.levelup_hero;
    const Hero *h = &g.hero[hero];
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(32, 35, 41) /* ui void */, RGB(38, 59, 41) /* grass 0 */);
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
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(38, 55, 66) /* ink blue */, RGB(38, 55, 66) /* ink blue */);
    system_bar(top, g.code_mode ? "RECALL CODE ENTRY" : "SYSTEM KIOSK", "THE SHOW REMEMBERS");
    gfx_sprite_scaled(top, &spr_shrine, 12, 60, 200, 100);

    window(top, 88, 56, 162, 96, 0);
    gfx_text(top, 94, 62, C_DIM, g.code_mode ? "TYPED" : "WRITE THIS DOWN");
    /*  Ten characters to a row, split five and five: twenty at double size do
        not fit across the panel, and the row count comes off CODE_CHARS so a
        longer code cannot silently lose its tail again. */
    for (int line = 0; line * CODE_PER_ROW < CODE_CHARS; line++) {
        char row[CODE_PER_ROW + CODE_PER_ROW / CODE_GROUP + 2];
        int from = line * CODE_PER_ROW;
        int count = CODE_CHARS - from;
        if (count > CODE_PER_ROW) count = CODE_PER_ROW;
        code_format(row, g.code, from, count, '-');
        gfx_text_big(top, 94, 76 + line * 20, C_AMBER, row);
    }
    if (!g.code_mode) {
        gfx_text_wrapped(top, 94, 118, 150, C_INK,
                         "Twenty characters. They put this run back on this floor.");
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
    window(bot, 8, 20, 240, 36, 0);
    {
        /*  Laid out exactly like the kiosk prints it, so a player copying one
            across is matching shapes rather than counting characters. */
        int typed = 0;
        while (typed < CODE_CHARS && g.code[typed]) typed++;
        for (int line = 0; line * CODE_PER_ROW < CODE_CHARS; line++) {
            char row[CODE_PER_ROW + CODE_PER_ROW / CODE_GROUP + 2];
            int from = line * CODE_PER_ROW;
            int count = typed - from;
            if (count < 0) count = 0;
            if (count > CODE_PER_ROW) count = CODE_PER_ROW;
            int glyphs = code_format(row, g.code, from, count, ' ');
            gfx_text_big(bot, 12, 24 + line * 16, C_INK, row);
            if ((g.anim & 16) && typed >= from && typed < from + CODE_PER_ROW)
                gfx_rect(bot, 12 + glyphs * 12, 24 + line * 16, 8, 14, C_AMBER);
        }
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
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(99, 37, 43) /* blood 1 */, RGB(32, 34, 41) /* cloth_black 0 */);
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
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(51, 37, 74) /* arcane 0 */, RGB(51, 37, 74) /* arcane 0 */);
    for (int i = 0; i < 80; i++) {
        int x = (i * 61 + g.anim / 2) % SCREEN_W;
        int y = (i * 29 + g.anim) % SCREEN_H;
        gfx_pixel(top, x, y, i & 1 ? C_GOLD : C_MAGENTA);
    }
    /*  Eighteen floors, not three, and not a book: this is the screen for
     *  having walked out the other end of a whole season. */
    gfx_text_big(top, 44, 40, C_GOLD, "YOU GOT OUT");
    season_tag(top, 30, 62, C_MAGENTA);
    gfx_sprite(top, hero_sprite(0), 34, 86);
    gfx_sprite(top, hero_sprite(1), 150, 90);
    gfx_text(top, 12, 166, C_INK, "Eighteen floors. The show has run out");
    gfx_text(top, 12, 177, C_INK, "of floor before it ran out of you.");

    backdrop(bot);
    gfx_text(bot, 8, 10, C_AMBER, "FINAL STANDINGS");
    /*  Whoever actually went down, not the default pair: any two of the four
        can be drafted and naming the wrong ones on the ending screen is a poor
        way to finish. */
    gfx_text(bot, 8, 30, C_DIM, g.hero[0].name); gfx_text(bot, 120, 30, C_INK, gfx_num(g.hero[0].level));
    gfx_text(bot, 8, 42, C_DIM, g.hero[1].name); gfx_text(bot, 120, 42, C_INK, gfx_num(g.hero[1].level));
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
    /*  The step between two tiles, the walk bob and the boss chamber's pulse
     *  all live in these two, and without them the dungeon redrew only when
     *  the party changed square -- so the slide this renderer was built to do
     *  never reached the screen at all. */
    if (g.scene == SCENE_DUNGEON) { MIX(g.dun.move_anim); MIX(g.anim >> 2); }

    /* Scenes that are alive even when the player is not. */
    if (g.scene == SCENE_TITLE) MIX(season_count());
    if (g.scene == SCENE_TITLE || g.scene == SCENE_STORY || g.scene == SCENE_BOX ||
        g.scene == SCENE_SAFEROOM || g.scene == SCENE_VICTORY)
        MIX(g.anim >> 1);
    if (g.scene == SCENE_CODE) MIX(g.anim >> 4);
    #undef MIX
    return h;
}

/*  What the bottom screen is made of, for the scenes where it is mostly
 *  furniture. Everywhere else it shares the top screen's signature and is
 *  redrawn whenever the top is, which is what it did before. */
static uint32_t render_bottom_signature(void) {
    if (g.scene != SCENE_DUNGEON) return render_signature();
    uint32_t h = 2166136261u;
    #define MIX(v) do { h = (h ^ (uint32_t)(v)) * 16777619u; } while (0)
    MIX(g.scene);
    MIX(g.dun.index); MIX(g.dun.px); MIX(g.dun.py); MIX(g.dun.facing);
    MIX(g.dun.explored); MIX(g.menu_cursor);
    MIX(g.gold); MIX(g.boxes_opened);
    for (int i = 0; i < PARTY; i++) {
        MIX(g.hero[i].hp); MIX(g.hero[i].hp_max);
        MIX(g.hero[i].mp); MIX(g.hero[i].mp_max);
    }
    MIX(g.anim >> 4);              /* a bar under a quarter full blinks */
    #undef MIX
    return h;
}

int render_frame(void) {
    static uint32_t last_signature, last_bottom;
    static int primed;
    uint32_t sig = render_signature();
#ifndef ABL_NOSIGCACHE
    if (primed && sig == last_signature) return 0;
#endif
    uint32_t bsig = render_bottom_signature();
    s_draw_bottom = !primed || bsig != last_bottom;

    last_signature = sig;
    last_bottom = bsig;
    primed = 1;

    Surface top = gfx_surface(SCREEN_TOP);
    Surface bot = gfx_surface(SCREEN_BOTTOM);

    {
        /*  Unsigned, because Scene is: comparing it against a signed -1
            sentinel warns, and 255 is not a scene either. */
        static unsigned last_scene = 255u;
        s_scene_changed = ((unsigned)g.scene != last_scene);
        last_scene = (unsigned)g.scene;
    }

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
    if (g.fade) {
        int a = g.fade;
        /*  Walking into a fight gets a proper transition rather than a fade:
         *  the screen closes in bands from both edges and opens on the arena,
         *  which is the beat the genre has used to say "something has found
         *  you" since the machines were too slow to do anything else. */
        if (g.scene == SCENE_BATTLE) {
            int shut = (14 - a) * (SCREEN_H / 2) / 14;
            for (int y = 0; y < SCREEN_H; y++) {
                int from_edge = y < SCREEN_H / 2 ? y : SCREEN_H - 1 - y;
                if (from_edge < shut) continue;             /* already open */
                /*  Alternate rows lag by a band, so the shutter has teeth and
                 *  does not read as a plain box closing. */
                if (((y >> 2) & 1) && from_edge < shut + 6) continue;
                gfx_hline(&top, 0, SCREEN_W - 1, y, C_VOID);
            }
            gfx_shade(&bot, 0, 0, SCREEN_W, SCREEN_H, 16 - a);
            if (a > 10) gfx_shade(&top, 0, 0, SCREEN_W, SCREEN_H, 30);
        } else {                                    /* a short wipe otherwise */
            gfx_shade(&top, 0, 0, SCREEN_W, SCREEN_H, 16 - a);
            gfx_shade(&bot, 0, 0, SCREEN_W, SCREEN_H, 16 - a);
        }
        /*  The dungeon is not on `top` any more, so a fade that only touched
            that layer would dim the text and leave the floor at full
            brightness underneath it. */
        if (g.scene == SCENE_DUNGEON) {
            Surface w = gfx_surface(SCREEN_WORLD);
            gfx_shade(&w, 0, 0, WORLD_W, WORLD_H, 16 - a);
        }
    }
    /*  The world layer is only ever touched by the dungeon, so it only needs
        sending when the dungeon drew. Every other scene paints the full-size
        layer opaque from edge to edge and hides it. */
    int what = s_draw_bottom ? RENDER_TOP | RENDER_BOTTOM : RENDER_TOP;
    if (g.scene == SCENE_DUNGEON) what |= RENDER_WORLD;
    return what;
}
