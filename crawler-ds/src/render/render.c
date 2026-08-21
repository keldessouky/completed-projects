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

static const char *const kFloorNames[FLOORS] = {
    "FLOOR 1  THE BEDROOM FLOOR",
    "FLOOR 2  THE WORKS",
    "FLOOR 3  THE OVER CITY",
};

/* ------------------------------------------------------------- furniture -- */

static void system_bar(Surface *s, const char *left, const char *right) {
    gfx_rect(s, 0, 0, SCREEN_W, 13, C_PANEL);
    gfx_hline(s, 0, SCREEN_W - 1, 13, C_AMBER_DK);
    gfx_text(s, 4, 3, C_AMBER, left);
    if (right) gfx_text(s, SCREEN_W - 4 - gfx_text_width(right), 3, C_INK, right);
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
    gfx_text(top, 26, 76, C_DIM, "BOOK ONE   an unofficial fan game");

    int floor_y = SCREEN_H - 4;
    gfx_vgradient(top, 0, floor_y - 14, SCREEN_W, 18, RGB(16, 13, 22), RGB(34, 27, 38));
    gfx_hline(top, 0, SCREEN_W - 1, floor_y - 14, gfx_scale_colour(C_AMBER_DK, 10, 16));
    for (int i = 0; i < 3; i++)                       /* light pooling on the floor */
        gfx_dither(top, 0, floor_y - 12 + i * 5, SCREEN_W, 5, C_AMBER_DK, 6 - i * 2);
    gfx_sprite(top, &spr_carl, 22, floor_y - spr_carl.h);
    gfx_sprite(top, &spr_donut, SCREEN_W - 80, floor_y - spr_donut.h + 2);
    gfx_text(top, 24, 92, C_INK, "18 floors. He is not wearing shoes.");

    gfx_clear(bot, C_VOID);
    gfx_vgradient(bot, 0, 0, SCREEN_W, 40, C_PANEL, C_VOID);
    gfx_text(bot, 8, 10, C_AMBER, "THE SYSTEM AWAITS YOUR DECISION");
    gfx_text(bot, 8, 24, C_DIM, "The audience is already watching.");

    static const char *const opts[2] = { "DESCEND", "ENTER RECALL CODE" };
    for (int i = 0; i < 2; i++) {
        int y = 118 + i * 32;
        int on = g.title_cursor == i;
        gfx_panel(bot, 40, y, 176, i ? 24 : 26, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
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

    gfx_clear(bot, C_VOID);
    gfx_panel(bot, 4, 4, SCREEN_W - 8, SCREEN_H - 30, C_PANEL, C_EDGE);
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
    gfx_panel(s, r->x, r->y, r->w, r->h, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
    if (r->label)
        gfx_text(s, r->x + (r->w - gfx_text_width(r->label)) / 2, r->y + (r->h - 7) / 2,
                 on ? C_AMBER : C_INK, r->label);
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
    system_bar(top, kFloorNames[g.dun.index], secs ? timer : "COLLAPSING");
    if (!secs && (g.anim & 16)) gfx_rect(top, 0, 0, SCREEN_W, 13, C_BLOOD);
    if (!secs) gfx_text(top, SCREEN_W - 4 - gfx_text_width("COLLAPSING"), 3, C_RED, "COLLAPSING");
    toasts(top);

    gfx_clear(bot, C_VOID);
    gfx_rect(bot, 0, 0, SCREEN_W, 22, C_PANEL);
    party_strip(bot, 7);
    gfx_hline(bot, 0, SCREEN_W - 1, 22, C_AMBER_DK);

    draw_map(bot, 4, 26, SCREEN_W - 8, 84, g.menu_cursor & 1 ? 8 : 6);

    gfx_text(bot, 6, 114, C_DIM, "GOLD");
    gfx_text(bot, 6, 124, C_GOLD, gfx_num(g.gold));
    gfx_text(bot, 6, 138, C_DIM, "BOXES");
    gfx_text(bot, 6, 148, C_INK, gfx_num(g.boxes_opened));

    for (int i = 0; i < 4; i++) draw_button(bot, &kDunPad[i], 0);
    for (int i = 0; i < 4; i++) draw_button(bot, &kDunActions[i], 0);
}

/* --------------------------------------------------------------- battle --- */

static void draw_foe_slots(Surface *s) {
    int n = g.bat.n_foes;
    for (int i = 0; i < n; i++) {
        const Foe *f = &g.bat.foes[i];
        const FoeDef *d = &foe_defs[f->def];
        const Sprite *sp = sprite_table[d->sprite];
        /* Enemies live in the middle band so the party can stand in the
           corners without anyone standing inside anyone else. One enemy gets
           the whole stage and is drawn big; three have to share it. */
        int band = 160, left = 48;
        int cx = n > 1 ? left + band * i / (n - 1) : SCREEN_W / 2;
        int scale = g.bat.boss ? 105 : n >= 3 ? 88 : n == 2 ? 108 : 130;
        int w = sp->w * scale / 100, h = sp->h * scale / 100;
        int base = g.bat.boss ? 158 : n >= 3 ? 150 : 156;
        int shake = (g.bat.shake && i == g.bat.target) ? ((g.anim & 2) ? 2 : -2) : 0;
        if (!f->alive) continue;
        /* A soft dithered shadow, so the thing is standing on the floor rather
           than on a plinth. */
        for (int j = 0; j < 7; j++) {
            int half = (w / 3) * (7 - j) / 7 + 2;
            gfx_dither(s, cx - half, base + j - 2, half * 2, 1, C_SHADOW, 14 - j * 2);
        }
        if (g.bat.phase == BAT_TARGET && i == g.bat.target) {
            gfx_frame(s, cx - w / 2 - 3, base - h - 3, w + 6, h + 6, C_MAGENTA);
            gfx_text(s, cx - gfx_text_width(d->name) / 2, base - h - 14, C_MAGENTA, d->name);
        }
        gfx_sprite_scaled(s, sp, cx - w / 2 + shake, base - h, scale, 100);
        bar_meter(s, cx - 28, base + 10, 56, 7, f->hp, f->hp_max, C_RED, 0);
        if (f->status[ST_BLEED]) gfx_text(s, cx + 30, base + 10, C_BLOOD, "\206");
    }
}

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

/*  The arena is the corridor the party was standing in: the same walls, pulled
 *  back far enough to swing in, with the show's lights on the ceiling. */
static void draw_arena(Surface *s, int floor_index) {
    uint16_t wall = floor_index == 0 ? RGB(84, 88, 104) : floor_index == 1 ? RGB(104, 76, 52) : RGB(64, 58, 104);
    uint16_t deep = gfx_scale_colour(wall, 5, 16);
    uint16_t ground = gfx_scale_colour(wall, 9, 16);

    gfx_vgradient(s, 0, 0, SCREEN_W, 148, gfx_scale_colour(wall, 3, 16), deep);
    gfx_vgradient(s, 0, 148, SCREEN_W, SCREEN_H - 148, ground, gfx_scale_colour(ground, 20, 16));
    /* Side walls, converging on a vanishing point behind the enemies. */
    for (int i = 0; i < 46; i++) {
        int t = i * 16 / 46;
        uint16_t c = gfx_mix(gfx_scale_colour(wall, 12, 16), deep, t);
        gfx_vline(s, i, 0, 148 - i, c);
        gfx_vline(s, SCREEN_W - 1 - i, 0, 148 - i, c);
    }
    for (int i = 0; i < 5; i++) {                 /* floor courses */
        int y = 150 + i * i * 2;
        if (y < SCREEN_H) gfx_hline(s, 0, SCREEN_W - 1, y, gfx_scale_colour(ground, 22 - i * 2, 16));
    }
    for (int i = 0; i < 4; i++) {                 /* studio lights */
        int x = 26 + i * 68;
        int pulse = 10 + ((g.anim / 3 + i * 7) & 5);
        gfx_rect(s, x, 6, 14, 5, gfx_scale_colour(C_AMBER, pulse, 16));
        gfx_dither(s, x - 6, 11, 26, 22, gfx_scale_colour(C_AMBER, 5, 16), 5);
    }
}

static void draw_battle(Surface *top, Surface *bot) {
    int floor_index = g.dun.index;
    draw_arena(top, floor_index);
    draw_foe_slots(top);
    draw_damage_pops(top);

    {
        /* The party stands in the front corners, feet past the bottom edge, the
           way a camera behind them would frame it. */
        int bob = (g.anim / 12) & 1;
        const Sprite *c = &spr_carl, *dn = &spr_donut;
        const int party_scale = 68;
        int cw = c->w * party_scale / 100, ch = c->h * party_scale / 100;
        int dw = dn->w * party_scale / 100, dh = dn->h * party_scale / 100;
        for (int i = 0; i < 5; i++) {                  /* contact shadows */
            gfx_dither(top, 4 + i, SCREEN_H - 4 + i - 3, cw - i * 2, 1, C_SHADOW, 13 - i * 2);
            gfx_dither(top, SCREEN_W - dw - 2 + i, SCREEN_H - 4 + i - 3, dw - i * 2, 1, C_SHADOW, 13 - i * 2);
        }
        gfx_sprite_scaled(top, c, 2, SCREEN_H - ch - 2 + bob, party_scale, 100);
        gfx_sprite_scaled(top, dn, SCREEN_W - dw - 2, SCREEN_H - dh - 2 - bob, party_scale, 100);
        if (g.hero[0].hp <= 0) gfx_shade(top, 0, SCREEN_H - ch - 2, cw + 4, ch, 8);
        if (g.hero[1].hp <= 0) gfx_shade(top, SCREEN_W - dw - 4, SCREEN_H - dh - 2, dw + 4, dh, 8);
    }
    if (g.hurt_flash) gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 16 + g.hurt_flash);

    const char *header = g.bat.boss ? "BOSS ENCOUNTER" : "ENCOUNTER";
    system_bar(top, header, g.bat.boss ? foe_defs[g.bat.foes[0].def].name : kFloorNames[floor_index]);
    if (g.bat.phase == BAT_INTRO) {
        const char *quip = foe_defs[g.bat.foes[0].def].quip;
        int lines = gfx_text_wrapped_count(228, quip);
        gfx_panel(top, 8, 16, SCREEN_W - 16, 10 + lines * TEXT_H, C_PANEL, C_MAGENTA);
        gfx_text_wrapped(top, 14, 21, 228, C_INK, quip);
    }
    if (g.bat.phase == BAT_WON) {
        gfx_panel(top, 28, 70, 200, 52, C_PANEL, C_GOLD);
        gfx_text_big(top, 62, 78, C_GOLD, "CLEARED");
        gfx_text(top, 44, 98, C_INK, "XP");
        gfx_text(top, 66, 98, C_AMBER, gfx_num(g.bat.xp_won));
        gfx_text(top, 124, 98, C_INK, "GOLD");
        gfx_text(top, 158, 98, C_GOLD, gfx_num(g.bat.gold_won));
    }
    if (g.bat.phase == BAT_LOST) {
        gfx_shade(top, 0, 0, SCREEN_W, SCREEN_H, 7);
        gfx_text_big(top, 40, 84, C_RED, "PARTY DOWN");
    }

    gfx_clear(bot, C_VOID);
    gfx_rect(bot, 0, 0, SCREEN_W, 20, C_PANEL);
    party_strip(bot, 6);
    gfx_hline(bot, 0, SCREEN_W - 1, 20, C_AMBER_DK);

    if (g.bat.phase == BAT_SKILL) {
        const SkillDef *skills[8];
        int n = game_hero_skills(g.bat.actor, skills, 8);
        gfx_text(bot, 6, 24, C_AMBER, "SKILLS");
        for (int i = 0; i < n; i++) {
            int on = g.bat.cursor == i;
            int afford = g.hero[g.bat.actor].mp >= skills[i]->cost;
            gfx_panel(bot, 6, 30 + i * 18, 244, 17, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
            gfx_text(bot, 12, 35 + i * 18, afford ? (on ? C_AMBER : C_INK) : C_DIM, skills[i]->name);
            gfx_text(bot, 190, 35 + i * 18, afford ? C_CYAN : C_RED, gfx_num(skills[i]->cost));
            gfx_text(bot, 208, 35 + i * 18, C_DIM, "SP");
        }
        if (n) gfx_text_wrapped(bot, 6, 142, 244, C_DIM, skills[g.bat.cursor < n ? g.bat.cursor : 0]->blurb);
        draw_button(bot, &kBatCommands[5], 0);
        return;
    }
    if (g.bat.phase == BAT_ITEM) {
        gfx_text(bot, 6, 24, C_AMBER, "ITEMS");
        int shown = 0;
        for (int i = 1; i < item_count && shown < 6; i++) {
            if (!g.inventory[i]) continue;
            int k = item_defs[i].kind;
            if (k != IT_HEAL && k != IT_STAMINA && k != IT_BOMB && k != IT_REVIVE && k != IT_BUFF) continue;
            int on = g.bat.cursor == shown;
            gfx_panel(bot, 6, 30 + shown * 18, 244, 17, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
            gfx_text(bot, 12, 35 + shown * 18, on ? C_AMBER : C_INK, item_defs[i].name);
            gfx_text(bot, 214, 35 + shown * 18, C_INK, gfx_num(g.inventory[i]));
            shown++;
        }
        if (!shown) gfx_text(bot, 12, 40, C_DIM, "The bag is empty. Bold strategy.");
        draw_button(bot, &kBatCommands[5], 0);
        return;
    }

    gfx_text(bot, 6, 24, C_AMBER, g.bat.phase == BAT_TARGET ? "PICK A TARGET" : "ORDERS");
    if (g.bat.phase == BAT_CHOOSE) {
        const char *who = g.hero[g.bat.actor].name;
        gfx_text(bot, SCREEN_W - 8 - gfx_text_width(who), 24, C_MAGENTA, who);
    }
    gfx_panel(bot, 4, 34, SCREEN_W - 8, 48, C_PANEL, C_EDGE);
    for (int i = 0; i < g.bat.n_log && i < 4; i++)
        gfx_text(bot, 10, 39 + i * 11, i == 0 ? C_INK : C_DIM,
                 g.bat.log[g.bat.n_log - 1 - i]);

    if (g.bat.phase == BAT_TARGET) {
        gfx_rect(bot, 4, 34, SCREEN_W - 8, 48, C_VOID);
        for (int i = 0; i < g.bat.n_foes; i++) {
            if (!g.bat.foes[i].alive) continue;
            Rect r = { (int16_t)(8 + i * 82), 44, 76, 34, 0 };
            draw_button(bot, &r, g.bat.target == i);
            const char *nm = foe_defs[g.bat.foes[i].def].name;
            gfx_text(bot, r.x + 4, r.y + 6, g.bat.target == i ? C_AMBER : C_INK, nm);
            bar_meter(bot, r.x + 4, r.y + 20, 68, 8, g.bat.foes[i].hp, g.bat.foes[i].hp_max, C_RED, 0);
        }
    }
    for (int i = 0; i < 6; i++) {
        if (i == 5 && g.bat.phase != BAT_TARGET) continue;
        draw_button(bot, &kBatCommands[i], g.bat.phase == BAT_CHOOSE && g.bat.cursor == i);
    }

}

/* ----------------------------------------------------------------- menu --- */

static void draw_menu(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(14, 14, 22), RGB(26, 26, 40));
    system_bar(top, "PARTY STATUS", kFloorNames[g.dun.index]);

    for (int i = 0; i < PARTY; i++) {
        const Hero *h = &g.hero[i];
        int x = 4 + i * 128;
        gfx_panel(top, x, 18, 124, 168, C_PANEL, C_EDGE);
        gfx_sprite_scaled(top, i ? &spr_donut : &spr_carl, x + 40, 22, 75, 100);
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

    gfx_clear(bot, C_VOID);
    for (int i = 0; i < 4; i++) draw_button(bot, &kMenuTabs[i], g.menu_tab == i);
    gfx_hline(bot, 0, SCREEN_W - 1, 26, C_AMBER_DK);

    if (g.menu_tab == 0) {
        gfx_text(bot, 6, 34, C_AMBER, "THE RUN SO FAR");
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
            gfx_panel(bot, 6, 52 + i * 18, 244, 17, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
            gfx_text(bot, 12, 57 + i * 18, on ? C_AMBER : C_INK, item_defs[list[i]].name);
            gfx_text(bot, 200, 57 + i * 18, C_CYAN, gfx_num(item_defs[list[i]].power));
        }
        if (!n) gfx_text(bot, 12, 56, C_DIM, "No gear yet. Boxes hold most of it.");
        else gfx_text_wrapped(bot, 6, 166, 244, C_DIM, item_defs[list[g.menu_cursor < n ? g.menu_cursor : 0]].blurb);
    } else if (g.menu_tab == 2) {
        gfx_text(bot, 6, 34, C_AMBER, "ACHIEVEMENTS");
        for (int i = 0; i < ach_count && i < 12; i++) {
            int got = (g.achievements >> i) & 1;
            int x = 6 + (i % 2) * 124, y = 48 + (i / 2) * 22;
            gfx_panel(bot, x, y, 120, 20, C_PANEL, got ? C_GOLD : C_EDGE);
            gfx_text(bot, x + 4, y + 3, got ? C_GOLD : C_DIM, ach_defs[i].name);
            gfx_text(bot, x + 4, y + 11, C_DIM, got ? "unlocked" : ach_defs[i].how);
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
    gfx_panel(top, 120, 60, 130, 118, C_PANEL, C_EDGE);
    gfx_text(top, 126, 66, C_AMBER, item_defs[stock[sel]].name);
    gfx_text_wrapped(top, 126, 80, 120, C_INK, item_defs[stock[sel]].blurb);
    gfx_text(top, 126, 150, C_DIM, "PRICE");
    gfx_text(top, 170, 150, C_GOLD, gfx_num(item_defs[stock[sel]].price));
    gfx_text(top, 126, 162, C_DIM, "PURSE");
    gfx_text(top, 170, 162, C_GOLD, gfx_num(g.gold));

    gfx_clear(bot, C_VOID);
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
        gfx_panel(bot, 6, y, 244, 17, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
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

    gfx_clear(bot, C_VOID);
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
    gfx_sprite_scaled(top, hero ? &spr_donut : &spr_carl, 16, 40, 150, 100);
    gfx_text_big(top, 150, 50, C_GREEN, "LEVEL");
    gfx_text_big(top, 150, 70, C_AMBER, gfx_num(h->level));
    gfx_text(top, 150, 100, C_DIM, "POINTS LEFT");
    gfx_text(top, 150, 112, C_INK, gfx_num(h->points));
    gfx_text_wrapped(top, 20, 160, 216, C_DIM,
                     "Spend them where the show can see: attributes drive every number in a fight.");

    gfx_clear(bot, C_VOID);
    gfx_text(bot, 8, 12, C_AMBER, "SPEND A POINT");
    gfx_text(bot, 180, 12, C_INK, gfx_num(h->points));
    gfx_text(bot, 196, 12, C_DIM, "left");
    static const char *const names[6] = { "STRENGTH", "DEXTERITY", "CONSTITUTION", "WITS", "CHARISMA", "LUCK" };
    static const char *const what[6] = { "damage", "dodge, speed", "health", "stamina", "the crowd", "crits, loot" };
    const uint8_t *stats = &h->st.str;
    for (int i = 0; i < 6; i++) {
        int on = g.menu_cursor == i;
        gfx_panel(bot, 12, 46 + i * 20, 232, 19, on ? C_PANEL_LIT : C_PANEL, on ? C_AMBER : C_EDGE);
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

    gfx_panel(top, 88, 56, 162, 96, C_PANEL, C_AMBER_DK);
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

    gfx_clear(bot, C_VOID);
    if (!g.code_mode) {
        gfx_text_wrapped(bot, 10, 20, 236, C_INK,
                         "The kiosk prints your progress as a code. Enter it from the title screen "
                         "and the System puts you back where you were standing.");
        Rect ok = { 78, 158, 100, 24, "DONE" };
        draw_button(bot, &ok, 1);
        return;
    }
    gfx_text(bot, 8, 10, C_AMBER, "ENTER THE CODE");
    gfx_panel(bot, 8, 24, 240, 24, C_PANEL, C_EDGE);
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
    gfx_text_big(top, 44, 60, C_RED, "CRAWLER DOWN");
    gfx_text(top, 30, 90, C_INK, "The audience is already watching someone else.");
    gfx_text(top, 30, 104, C_DIM, "Floor");
    gfx_text(top, 70, 104, C_AMBER, gfx_num(g.dun.index + 1));
    gfx_text(top, 100, 104, C_DIM, "Fights won");
    gfx_text(top, 180, 104, C_AMBER, gfx_num(g.battles_won));
    gfx_sprite_scaled(top, &spr_boss_producer, 158, 112, 80, 100);

    gfx_clear(bot, C_VOID);
    gfx_text_wrapped(bot, 12, 40, 232, C_INK,
                     "Every run ends on the same note: something finally got a full turn. "
                     "The System keeps your achievements and a recall code keeps your floor.");
    gfx_text(bot, 12, 150, C_AMBER, "TAP TO RETURN TO THE TITLE");
}

static void draw_victory(Surface *top, Surface *bot) {
    gfx_vgradient(top, 0, 0, SCREEN_W, SCREEN_H, RGB(14, 10, 26), RGB(46, 18, 44));
    for (int i = 0; i < 80; i++) {
        int x = (i * 61 + g.anim / 2) % SCREEN_W;
        int y = (i * 29 + g.anim) % SCREEN_H;
        gfx_pixel(top, x, y, i & 1 ? C_GOLD : C_MAGENTA);
    }
    gfx_text_big(top, 30, 40, C_GOLD, "END OF BOOK ONE");
    gfx_sprite(top, &spr_carl, 34, 108);
    gfx_sprite(top, &spr_donut, 150, 112);
    gfx_text(top, 24, 168, C_INK, "Three floors down. Fifteen to go.");

    gfx_clear(bot, C_VOID);
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
        for (int i = 0; i < MAX_FOES; i++) { MIX(g.bat.foes[i].hp); MIX(g.bat.foes[i].alive); }
        for (int i = 0; i < PARTY + MAX_FOES; i++) MIX(g.bat.pop_life[i] / 4);
        MIX(g.anim >> 2);
    }
    /* Scenes that are alive even when the player is not. */
    if (g.scene == SCENE_TITLE || g.scene == SCENE_STORY || g.scene == SCENE_BOX ||
        g.scene == SCENE_VICTORY)
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
    case SCENE_LEVELUP:  draw_levelup(&top, &bot);  break;
    case SCENE_CODE:     draw_code(&top, &bot);     break;
    case SCENE_GAMEOVER: draw_gameover(&top, &bot); break;
    case SCENE_VICTORY:  draw_victory(&top, &bot);  break;
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
