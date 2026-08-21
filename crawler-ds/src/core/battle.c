/*  Turn-based combat.
 *
 *  Speed sets the order, attributes set the numbers, and the show narrates. The
 *  whole fight is a small state machine ticked once a frame so that animations,
 *  the desktop bot and a player mashing A all drive it the same way.
 */
#include "game.h"

#include <string.h>

#include "art.h"
#include "audio.h"
#include "ui_layout.h"

#define FOE_SLOT(i) ((i) + PARTY)

static void log_line(const char *a, const char *b, const char *c) {
    if (g.bat.n_log >= MAX_LOG) {
        for (int i = 1; i < MAX_LOG; i++)
            memcpy(g.bat.log[i - 1], g.bat.log[i], sizeof g.bat.log[0]);
        g.bat.n_log--;
    }
    char *dst = g.bat.log[g.bat.n_log];
    int o = 0;
    const char *parts[3] = { a, b, c };
    for (int p = 0; p < 3; p++)
        for (const char *s = parts[p]; s && *s && o < (int)sizeof g.bat.log[0] - 1; s++)
            dst[o++] = *s;
    dst[o] = 0;
    g.bat.n_log++;
}

void battle_log(const char *text) { log_line(text, 0, 0); }

static int foe_alive_count(void) {
    int n = 0;
    for (int i = 0; i < g.bat.n_foes; i++) if (g.bat.foes[i].alive) n++;
    return n;
}

int battle_foe_count(void) { return foe_alive_count(); }

static int first_live_foe(void) {
    for (int i = 0; i < g.bat.n_foes; i++) if (g.bat.foes[i].alive) return i;
    return 0;
}

static void order_turns(void) {
    int entries[PARTY + MAX_FOES], speeds[PARTY + MAX_FOES], n = 0;
    for (int i = 0; i < PARTY; i++) {
        if (g.hero[i].hp <= 0) continue;
        entries[n] = i;
        speeds[n++] = hero_speed(&g.hero[i]) + rng_range(0, 3);
    }
    for (int i = 0; i < g.bat.n_foes; i++) {
        if (!g.bat.foes[i].alive) continue;
        entries[n] = FOE_SLOT(i);
        speeds[n++] = foe_defs[g.bat.foes[i].def].spd + rng_range(0, 3);
    }
    for (int i = 1; i < n; i++)                      /* insertion sort, fastest first */
        for (int j = i; j > 0 && speeds[j] > speeds[j - 1]; j--) {
            int ts = speeds[j]; speeds[j] = speeds[j - 1]; speeds[j - 1] = ts;
            int te = entries[j]; entries[j] = entries[j - 1]; entries[j - 1] = te;
        }
    for (int i = 0; i < n; i++) g.bat.turn_order[i] = (uint8_t)entries[i];
    g.bat.n_turns = (uint8_t)n;
    g.bat.turn_index = 0;
}

void battle_start(int boss) {
    memset(&g.bat, 0, sizeof g.bat);
    g.bat.boss = (uint8_t)boss;
    int floor_no = g.dun.index + 1;

    if (boss) {
        g.bat.n_foes = 1;
        g.bat.foes[0].def = (uint8_t)foe_boss(floor_no);
    } else {
        int count = rng_range(1, floor_no >= 2 ? 3 : 2);
        g.bat.n_foes = (uint8_t)count;
        for (int i = 0; i < count; i++) g.bat.foes[i].def = (uint8_t)foe_pick(floor_no);
    }
    for (int i = 0; i < g.bat.n_foes; i++) {
        const FoeDef *d = &foe_defs[g.bat.foes[i].def];
        int hp = d->hp + rng_range(-d->hp / 10, d->hp / 10);
        g.bat.foes[i].hp = g.bat.foes[i].hp_max = (int16_t)hp;
        g.bat.foes[i].alive = 1;
    }
    for (int i = 0; i < PARTY; i++) {
        memset(g.hero[i].status, 0, sizeof g.hero[i].status);
        g.hero[i].guard = 0;
    }
    g.bat.phase = BAT_INTRO;
    g.bat.timer = 70;
    g.bat.target = (uint8_t)first_live_foe();
    log_line(foe_defs[g.bat.foes[0].def].name, boss ? " blocks the way." : " noticed you.", 0);
    game_set_scene(SCENE_BATTLE);
}

/* ------------------------------------------------------------- resolving -- */

static void pop_damage(int slot, int amount) {
    if (slot < 0 || slot >= PARTY + MAX_FOES) return;
    g.bat.pop_damage[slot] = (int16_t)amount;
    g.bat.pop_life[slot] = 40;
}

static int roll_damage(int attack, int defence, int power_pct, int luck) {
    int raw = attack * power_pct / 100;
    int dmg = raw - defence / 2;
    if (dmg < 1) dmg = 1;
    dmg = dmg * rng_range(88, 114) / 100;
    if (rng_chance(4 + luck / 2)) {
        dmg = dmg * 9 / 5;                                /* the crowd loves a crit */
        audio_sfx(SFX_CRIT);
    } else {
        audio_sfx(SFX_HIT);
    }
    return dmg < 1 ? 1 : dmg;
}

static void hurt_foe(int index, int amount) {
    Foe *f = &g.bat.foes[index];
    if (!f->alive) return;
    f->hp = (int16_t)(f->hp - amount);
    pop_damage(FOE_SLOT(index), amount);
    g.bat.shake = 6;
    if (f->hp <= 0) {
        f->alive = 0;
        f->hp = 0;
        log_line(foe_defs[f->def].name, " is finished.", 0);
    }
}

static void hurt_hero(int index, int amount) {
    Hero *h = &g.hero[index];
    if (h->hp <= 0) return;
    if (h->guard) amount = amount / 2 + 1;
    if (g.hero[0].guard && index == 1 && g.hero[0].hp > 0) {   /* Carl steps in */
        index = 0;
        h = &g.hero[0];
        amount = amount * 3 / 4;
    }
    h->hp = (int16_t)(h->hp - amount);
    pop_damage(index, amount);
    g.hurt_flash = 10;
    audio_sfx(SFX_HURT);
    if (h->hp <= 0) {
        h->hp = 0;
        log_line(h->name, " is down.", 0);
    }
}

static void apply_effect(int kind, int power, int from_hero, int actor, int target) {
    switch (kind) {
    case SK_HIT_ONE:
        if (from_hero)
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]) +
                                         (g.hero[actor].status[ST_ATKUP] ? 6 : 0),
                                         foe_defs[g.bat.foes[target].def].def -
                                         (g.bat.foes[target].status[ST_DEFDOWN] ? 4 : 0),
                                         power, g.hero[actor].st.luck));
        else
            hurt_hero(target, roll_damage(foe_defs[g.bat.foes[actor].def].atk,
                                          hero_defence(&g.hero[target]), power, 0));
        break;
    case SK_HIT_ALL:
        if (from_hero) {
            for (int i = 0; i < g.bat.n_foes; i++)
                if (g.bat.foes[i].alive)
                    hurt_foe(i, roll_damage(hero_attack(&g.hero[actor]),
                                            foe_defs[g.bat.foes[i].def].def, power,
                                            g.hero[actor].st.luck));
        } else {
            for (int i = 0; i < PARTY; i++)
                if (g.hero[i].hp > 0)
                    hurt_hero(i, roll_damage(foe_defs[g.bat.foes[actor].def].atk,
                                             hero_defence(&g.hero[i]), power, 0));
        }
        break;
    case SK_BLEED:
        if (from_hero) {
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]),
                                         foe_defs[g.bat.foes[target].def].def, power,
                                         g.hero[actor].st.luck));
            if (g.bat.foes[target].alive) {
                g.bat.foes[target].status[ST_BLEED] = 3;
                log_line(foe_defs[g.bat.foes[target].def].name, " is bleeding.", 0);
            }
        } else {
            hurt_hero(target, roll_damage(foe_defs[g.bat.foes[actor].def].atk,
                                          hero_defence(&g.hero[target]), power, 0));
            if (g.hero[target].hp > 0) g.hero[target].status[ST_BLEED] = 3;
        }
        break;
    case SK_STUN:
        if (from_hero) {
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]),
                                         foe_defs[g.bat.foes[target].def].def, power,
                                         g.hero[actor].st.luck));
            if (g.bat.foes[target].alive && rng_chance(65)) {
                g.bat.foes[target].status[ST_STUN] = 1;
                log_line(foe_defs[g.bat.foes[target].def].name, " loses its footing.", 0);
            }
        } else {
            hurt_hero(target, roll_damage(foe_defs[g.bat.foes[actor].def].atk,
                                          hero_defence(&g.hero[target]), power, 0));
            if (g.hero[target].hp > 0 && rng_chance(40)) g.hero[target].status[ST_STUN] = 1;
        }
        break;
    case SK_HEAL: {
        int amount = power + g.hero[actor].st.wit * 2 + g.hero[actor].level * 2;
        int who = target < PARTY ? target : 0;
        if (g.hero[who].hp <= 0) who = actor;
        hero_heal(&g.hero[who], amount);
        pop_damage(who, -amount);
        log_line(g.hero[who].name, " is patched up.", 0);
        break; }
    case SK_GUARD_ALL:
        for (int i = 0; i < PARTY; i++) g.hero[i].guard = 1;
        log_line("Carl", " covers the party.", 0);
        break;
    case SK_BUFF_ATK:
        g.hero[actor].status[ST_ATKUP] = 3;
        log_line(g.hero[actor].name, " is furious.", 0);
        break;
    case SK_DEBUFF_DEF:
        if (from_hero) {
            g.bat.foes[target].status[ST_DEFDOWN] = 3;
            log_line(foe_defs[g.bat.foes[target].def].name, " flinches.", 0);
        } else {
            g.hero[target].status[ST_DEFDOWN] = 3;
        }
        break;
    case SK_TAUNT:
        g.hero[actor].status[ST_ATKUP] = 2;
        for (int i = 0; i < g.bat.n_foes; i++)
            if (g.bat.foes[i].alive) g.bat.foes[i].status[ST_DEFDOWN] = 2;
        log_line("The viewers", " are screaming.", 0);
        break;
    default:
        break;
    }
}

static void tick_statuses_for_hero(int i) {
    Hero *h = &g.hero[i];
    if (h->hp <= 0) return;
    if (h->status[ST_BLEED]) {
        h->status[ST_BLEED]--;
        int d = 3 + h->level;
        h->hp = (int16_t)(h->hp - d);
        pop_damage(i, d);
        if (h->hp <= 0) { h->hp = 0; log_line(h->name, " bleeds out.", 0); }
    }
    for (int s = ST_STUN; s < ST_COUNT; s++) if (h->status[s]) h->status[s]--;
}

static void tick_statuses_for_foe(int i) {
    Foe *f = &g.bat.foes[i];
    if (!f->alive) return;
    if (f->status[ST_BLEED]) {
        f->status[ST_BLEED]--;
        int d = 4 + foe_defs[f->def].hp / 20;
        hurt_foe(i, d);
    }
    for (int s = ST_STUN; s < ST_COUNT; s++) if (f->status[s]) f->status[s]--;
}

static void finish_battle(int won, int fled);

static void begin_next_turn(void) {
    if (!foe_alive_count()) { finish_battle(1, 0); return; }
    if (!party_alive())     { finish_battle(0, 0); return; }

    if (g.bat.turn_index >= g.bat.n_turns) {
        for (int i = 0; i < PARTY; i++) { tick_statuses_for_hero(i); g.hero[i].guard = 0; }
        for (int i = 0; i < g.bat.n_foes; i++) tick_statuses_for_foe(i);
        if (!foe_alive_count()) { finish_battle(1, 0); return; }
        if (!party_alive())     { finish_battle(0, 0); return; }
        order_turns();
    }

    int actor = g.bat.turn_order[g.bat.turn_index++];
    g.bat.actor = (uint8_t)actor;

    if (actor < PARTY) {
        if (g.hero[actor].hp <= 0) { begin_next_turn(); return; }
        if (g.hero[actor].status[ST_STUN]) {
            log_line(g.hero[actor].name, " is still getting up.", 0);
            g.bat.phase = BAT_RESOLVE;
            g.bat.timer = 30;
            return;
        }
        g.bat.phase = BAT_CHOOSE;
        g.bat.cursor = 0;
        g.bat.menu = 0;
        if (!g.bat.foes[g.bat.target].alive) g.bat.target = (uint8_t)first_live_foe();
        return;
    }

    int fi = actor - PARTY;
    if (!g.bat.foes[fi].alive) { begin_next_turn(); return; }
    if (g.bat.foes[fi].status[ST_STUN]) {
        log_line(foe_defs[g.bat.foes[fi].def].name, " is flat on its back.", 0);
        g.bat.phase = BAT_RESOLVE;
        g.bat.timer = 26;
        return;
    }
    /* Foe AI: mostly swing, sometimes do the thing it is known for. Donut is
       louder than Carl, so she draws attention when she has been taunting. */
    const FoeDef *d = &foe_defs[g.bat.foes[fi].def];
    int target = 0;
    int live[PARTY], n = 0;
    for (int i = 0; i < PARTY; i++) if (g.hero[i].hp > 0) live[n++] = i;
    if (!n) { finish_battle(0, 0); return; }
    target = live[rng_range(0, n - 1)];
    if (g.hero[1].hp > 0 && g.hero[1].status[ST_ATKUP] && rng_chance(60)) target = 1;

    if (rng_chance(d->trick)) {
        log_line(d->name, ": ", d->quip);
        apply_effect(d->trick_kind, d->trick_power, 0, fi, target);
    } else {
        apply_effect(SK_HIT_ONE, 100, 0, fi, target);
    }
    g.bat.phase = BAT_RESOLVE;
    g.bat.timer = 34;
}

static void finish_battle(int won, int fled) {
    if (fled) {
        g.bat.phase = BAT_FLED;
        g.bat.timer = 50;
        return;
    }
    if (!won) {
        g.bat.phase = BAT_LOST;
        g.bat.timer = 90;
        return;
    }
    int xp = 0, gold = 0;
    for (int i = 0; i < g.bat.n_foes; i++) {
        const FoeDef *d = &foe_defs[g.bat.foes[i].def];
        xp += d->xp;
        gold += d->gold + rng_range(0, d->gold / 3);
    }
    g.bat.xp_won = (int16_t)xp;
    g.bat.gold_won = (int16_t)gold;
    g.gold = (int16_t)(g.gold + gold);
    g.battles_won++;
    for (int i = 0; i < PARTY; i++)
        if (g.hero[i].hp > 0 && hero_gain_xp(&g.hero[i], xp)) audio_sfx(SFX_LEVEL);

    if (g.battles_won == 1) game_award(0);
    if (g.battles_won == 10) game_award(3);
    if (g.gold >= 500) game_award(5);
    if (g.hero[0].level >= 5) game_award(2);
    {
        int untouched = 1;
        for (int i = 0; i < PARTY; i++) if (g.hero[i].hp < g.hero[i].hp_max) untouched = 0;
        if (untouched) game_award(6);
    }
    if (g.bat.boss) {
        int floor_no = g.dun.index + 1;
        if (floor_no == 1) { g.flags |= F_FLOOR1_BOSS; game_award(7); }
        if (floor_no == 2) { g.flags |= F_FLOOR2_BOSS; game_award(8); }
        if (floor_no == 3) { g.flags |= F_FLOOR3_BOSS; game_award(9); }
        game_open_box(floor_no >= 3 ? 3 : 2);
    } else if (rng_chance(30)) {
        game_open_box(rng_chance(20) ? 1 : 0);
    }
    g.bat.phase = BAT_WON;
    g.bat.timer = 110;
}

/* ---------------------------------------------------------------- input -- */

static int touch_in(const PlatInput *in, const Rect *r) {
    return in->touch_pressed && in->touch_x >= r->x && in->touch_x < r->x + r->w &&
           in->touch_y >= r->y && in->touch_y < r->y + r->h;
}

static void use_item(int item) {
    const ItemDef *d = &item_defs[item];
    int actor = g.bat.actor;
    switch (d->kind) {
    case IT_HEAL: {
        int who = actor;
        for (int i = 0; i < PARTY; i++)
            if (g.hero[i].hp > 0 && g.hero[i].hp * 100 / g.hero[i].hp_max <
                g.hero[who].hp * 100 / g.hero[who].hp_max) who = i;
        hero_heal(&g.hero[who], d->power);
        pop_damage(who, -d->power);
        log_line(g.hero[who].name, " drinks the ", d->name);
        break; }
    case IT_STAMINA:
        g.hero[actor].mp = (int16_t)(g.hero[actor].mp + d->power);
        if (g.hero[actor].mp > g.hero[actor].mp_max) g.hero[actor].mp = g.hero[actor].mp_max;
        log_line(g.hero[actor].name, " cracks the ", d->name);
        break;
    case IT_BOMB:
        for (int i = 0; i < g.bat.n_foes; i++)
            if (g.bat.foes[i].alive) hurt_foe(i, d->power + rng_range(0, 10));
        log_line("The room", " goes very bright.", 0);
        break;
    case IT_REVIVE:
        for (int i = 0; i < PARTY; i++)
            if (g.hero[i].hp <= 0) {
                g.hero[i].hp = (int16_t)(g.hero[i].hp_max / 2);
                log_line(g.hero[i].name, " gets back up.", 0);
                break;
            }
        break;
    case IT_BUFF:
        g.hero[actor].status[ST_ATKUP] = 3;
        log_line(g.hero[actor].name, " is running very hot.", 0);
        break;
    default:
        break;
    }
    g.inventory[item]--;
}

static void choose_action(int action) {
    int actor = g.bat.actor;
    switch (action) {
    case 0:   /* strike */
        g.bat.phase = BAT_TARGET;
        g.bat.menu = 0;
        break;
    case 1:   /* skill */
        g.bat.phase = BAT_SKILL;
        g.bat.cursor = 0;
        break;
    case 2:   /* item */
        g.bat.phase = BAT_ITEM;
        g.bat.cursor = 0;
        break;
    case 3:   /* guard */
        g.hero[actor].guard = 1;
        hero_heal(&g.hero[actor], 4 + g.hero[actor].level);
        log_line(g.hero[actor].name, " braces.", 0);
        g.bat.phase = BAT_RESOLVE;
        g.bat.timer = 24;
        break;
    case 4:   /* run */
        if (g.bat.boss) {
            log_line("There is", " nowhere to run to.", 0);
            g.bat.phase = BAT_RESOLVE;
            g.bat.timer = 30;
        } else if (rng_chance(40 + hero_speed(&g.hero[actor]))) {
            log_line("You back", " out of the room.", 0);
            finish_battle(0, 1);
        } else {
            log_line("The exit", " is further than it looked.", 0);
            g.bat.phase = BAT_RESOLVE;
            g.bat.timer = 30;
        }
        break;
    default:
        break;
    }
}

static void update_choose(const PlatInput *in) {
    int commands = 5;
    if (in->pressed & (BTN_RIGHT | BTN_DOWN)) g.bat.cursor = (uint8_t)((g.bat.cursor + 1) % commands);
    if (in->pressed & (BTN_LEFT | BTN_UP)) g.bat.cursor = (uint8_t)((g.bat.cursor + commands - 1) % commands);
    if (in->pressed & BTN_A) { choose_action(g.bat.cursor); return; }
    for (int i = 0; i < commands; i++)
        if (touch_in(in, &kBatCommands[i])) { g.bat.cursor = (uint8_t)i; choose_action(i); return; }
}

static void update_target(const PlatInput *in) {
    if (in->pressed & (BTN_RIGHT | BTN_DOWN)) {
        for (int i = 1; i <= g.bat.n_foes; i++) {
            int t = (g.bat.target + i) % g.bat.n_foes;
            if (g.bat.foes[t].alive) { g.bat.target = (uint8_t)t; break; }
        }
    }
    if (in->pressed & (BTN_LEFT | BTN_UP)) {
        for (int i = 1; i <= g.bat.n_foes; i++) {
            int t = (g.bat.target + g.bat.n_foes - i) % g.bat.n_foes;
            if (g.bat.foes[t].alive) { g.bat.target = (uint8_t)t; break; }
        }
    }
    /* Tapping an enemy on the top screen is not possible, so the bottom screen
       carries one button per living foe along the log strip. */
    for (int i = 0; i < g.bat.n_foes; i++) {
        Rect r = { (int16_t)(8 + i * 82), 78, 76, 24, 0 };
        if (g.bat.foes[i].alive && touch_in(in, &r)) g.bat.target = (uint8_t)i;
    }
    if (in->pressed & BTN_B) { g.bat.phase = BAT_CHOOSE; return; }
    if (touch_in(in, &kBatCommands[5])) { g.bat.phase = BAT_CHOOSE; return; }

    int fire = (in->pressed & BTN_A) != 0;
    for (int i = 0; i < 3 && !fire; i++)
        if (touch_in(in, &kBatCommands[i])) fire = 1;
    if (!fire) return;

    int actor = g.bat.actor;
    if (g.bat.menu == 0) {
        log_line(g.hero[actor].name, " strikes.", 0);
        apply_effect(SK_HIT_ONE, 100, 1, actor, g.bat.target);
    } else {
        const SkillDef *skills[8];
        int n = game_hero_skills(actor, skills, 8);
        int idx = g.bat.cursor < n ? g.bat.cursor : 0;
        const SkillDef *sk = skills[idx];
        g.hero[actor].mp = (int16_t)(g.hero[actor].mp - sk->cost);
        log_line(g.hero[actor].name, ": ", sk->name);
        apply_effect(sk->kind, sk->power, 1, actor, g.bat.target);
    }
    g.bat.phase = BAT_RESOLVE;
    g.bat.timer = 34;
}

static void update_skill(const PlatInput *in) {
    const SkillDef *skills[8];
    int n = game_hero_skills(g.bat.actor, skills, 8);
    if (!n) { g.bat.phase = BAT_CHOOSE; return; }
    if (in->pressed & BTN_DOWN) g.bat.cursor = (uint8_t)((g.bat.cursor + 1) % n);
    if (in->pressed & BTN_UP) g.bat.cursor = (uint8_t)((g.bat.cursor + n - 1) % n);
    if (in->pressed & BTN_B) { g.bat.phase = BAT_CHOOSE; return; }
    if (touch_in(in, &kBatCommands[5])) { g.bat.phase = BAT_CHOOSE; return; }
    for (int i = 0; i < n; i++) {
        Rect r = { 6, (int16_t)(30 + i * 18), 244, 17, 0 };
        if (touch_in(in, &r)) g.bat.cursor = (uint8_t)i;
    }
    int fire = (in->pressed & BTN_A) != 0;
    for (int i = 0; i < n && !fire; i++) {
        Rect r = { 6, (int16_t)(30 + i * 18), 244, 17, 0 };
        if (touch_in(in, &r) && g.bat.cursor == i) fire = 1;
    }
    if (!fire) return;
    const SkillDef *sk = skills[g.bat.cursor];
    if (g.hero[g.bat.actor].mp < sk->cost) {
        log_line("Not enough", " stamina.", 0);
        return;
    }
    g.bat.menu = 1;
    if (sk->kind == SK_HIT_ONE || sk->kind == SK_BLEED || sk->kind == SK_STUN ||
        sk->kind == SK_DEBUFF_DEF) {
        g.bat.phase = BAT_TARGET;
        if (!g.bat.foes[g.bat.target].alive) g.bat.target = (uint8_t)first_live_foe();
        return;
    }
    g.hero[g.bat.actor].mp = (int16_t)(g.hero[g.bat.actor].mp - sk->cost);
    log_line(g.hero[g.bat.actor].name, ": ", sk->name);
    apply_effect(sk->kind, sk->power, 1, g.bat.actor, g.bat.target);
    g.bat.phase = BAT_RESOLVE;
    g.bat.timer = 34;
}

static void update_item(const PlatInput *in) {
    int usable[INVENTORY], n = 0;
    for (int i = 1; i < item_count && i < INVENTORY; i++) {
        if (!g.inventory[i]) continue;
        int k = item_defs[i].kind;
        if (k == IT_HEAL || k == IT_STAMINA || k == IT_BOMB || k == IT_REVIVE || k == IT_BUFF)
            usable[n++] = i;
    }
    if (in->pressed & BTN_B) { g.bat.phase = BAT_CHOOSE; return; }
    if (touch_in(in, &kBatCommands[5])) { g.bat.phase = BAT_CHOOSE; return; }
    if (!n) return;
    if (in->pressed & BTN_DOWN) g.bat.cursor = (uint8_t)((g.bat.cursor + 1) % n);
    if (in->pressed & BTN_UP) g.bat.cursor = (uint8_t)((g.bat.cursor + n - 1) % n);
    int fire = (in->pressed & BTN_A) != 0;
    for (int i = 0; i < n; i++) {
        Rect r = { 6, (int16_t)(30 + i * 18), 244, 17, 0 };
        if (touch_in(in, &r)) { g.bat.cursor = (uint8_t)i; fire = 1; }
    }
    if (!fire) return;
    use_item(usable[g.bat.cursor < n ? g.bat.cursor : 0]);
    g.bat.phase = BAT_RESOLVE;
    g.bat.timer = 34;
}

void battle_update(const PlatInput *in) {
    if (g.bat.shake) g.bat.shake--;
    for (int i = 0; i < PARTY + MAX_FOES; i++) if (g.bat.pop_life[i]) g.bat.pop_life[i]--;

    switch (g.bat.phase) {
    case BAT_INTRO:
        if (g.bat.timer) g.bat.timer--;
        if (!g.bat.timer || (in->pressed & (BTN_A | BTN_B)) || in->touch_pressed) begin_next_turn();
        break;
    case BAT_CHOOSE: update_choose(in); break;
    case BAT_TARGET: update_target(in); break;
    case BAT_SKILL:  update_skill(in);  break;
    case BAT_ITEM:   update_item(in);   break;
    case BAT_RESOLVE:
        if (g.bat.timer) g.bat.timer--;
        if (!g.bat.timer) begin_next_turn();
        break;
    case BAT_WON:
    case BAT_FLED:
        if (g.bat.timer) g.bat.timer--;
        if (!g.bat.timer || (in->pressed & (BTN_A | BTN_B)) || in->touch_pressed) {
            if (g.bat.boss && g.bat.phase == BAT_WON)
                game_story(g.dun.index + 1, TRIG_BOSS_WIN, SCENE_DUNGEON);
            else if (g.hero[0].points || g.hero[1].points)
                game_set_scene(SCENE_LEVELUP);
            else
                game_set_scene(SCENE_DUNGEON);
        }
        break;
    case BAT_LOST:
        if (g.bat.timer) g.bat.timer--;
        if (!g.bat.timer) game_set_scene(SCENE_GAMEOVER);
        break;
    default:
        break;
    }
}
