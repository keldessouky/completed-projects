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
        if (g.bat.log_shown) g.bat.log_shown--;
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

/*  A foe's printed attack, reward and defence, scaled for how deep this is.
 *  Without this the bestiary runs out of threat around floor four and the
 *  back half of the descent is a walk. */
static int foe_atk(int index) {
    return foe_defs[g.bat.foes[index].def].atk *
           foe_stat_scale(g.dun.index + 1, g.bat.foes[index].def) / 100;
}

static int foe_def_at_depth(int index) {
    return foe_defs[g.bat.foes[index].def].def *
           foe_stat_scale(g.dun.index + 1, g.bat.foes[index].def) / 100;
}

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

    /*  boss: 0 a wandering encounter, 1 the borough boss on the stairwell,
        2 the neighbourhood's own boss. */
    if (boss) {
        g.bat.n_foes = 1;
        g.bat.foes[0].def = (uint8_t)(boss == 2 ? foe_nboss(floor_no) : foe_boss(floor_no));
    } else {
        int count = rng_range(1, floor_no >= 2 ? 3 : 2);
        g.bat.n_foes = (uint8_t)count;
        /*  Mostly the neighbourhood's own mob, sometimes something wandered in
            from next door -- and rats, which infest every neighbourhood on the
            floor whatever else lives there, and eat what is left afterwards. */
        int local = zone_defs[dungeon_zone()].foe;
        for (int i = 0; i < count; i++) {
            int roll = rng_range(0, 99);
            g.bat.foes[i].def = (uint8_t)(roll < 62 ? local : roll < 80 ? 0 : foe_pick(floor_no));
        }
        /*  And whatever the quadrant's grubs have decided to do about all the
            corpses. They take slots off the encounter rather than adding to
            it -- three things is still three things -- so a floor the party
            has cleared out sends them fights made mostly of consequences. */
        int joining = g.grubs >= GRUB_SWARM ? 2 : g.grubs >= GRUB_JOIN ? 1 : 0;
        for (int i = 0; i < joining && i < count; i++)
            g.bat.foes[count - 1 - i].def = (uint8_t)foe_grub();
    }
    for (int i = 0; i < g.bat.n_foes; i++) {
        const FoeDef *d = &foe_defs[g.bat.foes[i].def];
        int scale = foe_stat_scale(floor_no, g.bat.foes[i].def);
        /*  Grubs level up by eating, so the pile the party has made is what
            makes them worth anything. */
        if (g.bat.foes[i].def == foe_grub())
            scale = scale * (100 + g.grubs / 4) / 100;
        int hp = d->hp * scale / 100;
        hp += rng_range(-hp / 10, hp / 10);
        if (hp > 30000) hp = 30000;
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
    log_line(foe_defs[g.bat.foes[0].def].name,
             boss == 2 ? " runs this neighbourhood." :
             boss ? " blocks the way." : " noticed you.", 0);
    game_set_scene(SCENE_BATTLE);
}


/* ------------------------------------------------------------- the tell -- */

static void hurt_foe(int index, int amount);   /* defined with the resolving */

/*  Mordecai's one piece of real advice: everything with a boss card has a way
 *  to be broken, and it is never its health bar. So a boss spends most of the
 *  fight closed, and every few turns it does the thing its entry describes --
 *  the Hoarder's next grub crowning, the Juicer's veins standing out, the Ball
 *  of Swine getting up to speed. That opening lasts one round and wants one
 *  specific answer off the command menu. Take it and the boss reels; miss it
 *  and it shuts again and you have spent a turn.
 *
 *  This is what stops a boss being a mob with four times the health.
 */
static int boss_index(void) {
    for (int i = 0; i < g.bat.n_foes; i++)
        if (g.bat.foes[i].alive && foe_defs[g.bat.foes[i].def].weak) return i;
    return -1;
}

static void tell_tick(void) {
    int b = boss_index();
    if (b < 0) return;
    if (g.bat.broken) { g.bat.broken--; return; }
    if (g.bat.tell) {
        if (--g.bat.tell == 0) log_line("The opening", " closes.", 0);
        return;
    }
    if (g.bat.tell_wait) { g.bat.tell_wait--; return; }

    g.bat.tell = 2;                    /* up for this round and the next */
    g.bat.tell_foe = (uint8_t)b;
    g.bat.tell_wait = (uint8_t)rng_range(2, 4);
    const FoeDef *d = &foe_defs[g.bat.foes[b].def];
    log_line(d->tell ? d->tell : "It leaves itself open.", 0, 0);
    /*  Said once a run, not once a fight and not once a turn: it lives
        outside g.bat, which is wiped at every battle_start. The player is
        meant to work out which button the opening wants, not be told. */
    static int explained;
    if (!explained) {
        explained = 1;
        log_line("Mordecai:", " that is the opening. Hit it right.", 0);
    }
    audio_sfx(SFX_CRIT);
}

/*  Did that command answer the opening? Called with the menu index the player
 *  picked: 0 fight, 1 bag, 2 guard, 3 run. A move chosen off the FIGHT menu
 *  answers WEAK_MOVE; a plain swing answers WEAK_HIT. */
static int tell_answered(int weak, int menu, int used_move) {
    switch (weak) {
    case WEAK_HIT:   return menu == 0 && !used_move;
    case WEAK_MOVE:  return menu == 0 && used_move;
    case WEAK_ITEM:  return menu == 1;
    case WEAK_GUARD: return menu == 2;
    default:         return 0;
    }
}

static void tell_answer(int menu, int used_move) {
    if (!g.bat.tell) return;
    int b = g.bat.tell_foe;
    if (b >= g.bat.n_foes || !g.bat.foes[b].alive) return;
    const FoeDef *d = &foe_defs[g.bat.foes[b].def];
    if (!tell_answered(d->weak, menu, used_move)) return;

    /*  A quarter of what it started with, which is enough to make finding the
        answer the fight rather than a bonus on top of it. */
    Foe *f = &g.bat.foes[b];
    int hit = f->hp_max / 4 + 1;
    g.bat.tell = 0;
    g.bat.broken = 2;
    f->status[ST_DEFDOWN] = 3;
    hurt_foe(b, hit);
    log_line(d->name, " is wide open.", 0);
    game_award(ACH_DAMAGE);
    audio_sfx(SFX_CRIT);
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

/*  Kills landed by the blow currently being resolved. Two in one go is worth
 *  an achievement, so the count has to survive across the calls a single
 *  hit-all attack makes. */
static int s_kills_this_blow;

static void hurt_foe(int index, int amount) {
    Foe *f = &g.bat.foes[index];
    if (!f->alive) return;
    f->hp = (int16_t)(f->hp - amount);
    pop_damage(FOE_SLOT(index), amount);
    g.bat.shake = 6;
    game_award(ACH_DAMAGE);
    if (foe_defs[f->def].rank) game_award(ACH_BOSS_BABE);
    if (f->hp <= 0) {
        f->alive = 0;
        f->hp = 0;
        if (++s_kills_this_blow == 2) game_award(ACH_TWO_AT_ONCE);
        /*  A corpse with no grubs near it gets between one and fifteen sent
            to eat it. They are harmless one at a time; the count is the
            threat, and the count is entirely the party's own doing. */
        if (g.grubs < GRUB_CAP) {
            int add = rng_range(1, 15);
            g.grubs = (uint16_t)(g.grubs + add > GRUB_CAP ? GRUB_CAP : g.grubs + add);
            if (g.grubs >= GRUB_PUPA && g.grubs - add < GRUB_PUPA)
                game_toast("Pupae in the corners. Take the stairs.", 2);
        }
        /*  Carl fights barefoot and, for most of the first floor, unarmed. The
            show has a box for each of those, and they are the two the book
            makes a running joke of. */
        if (g.bat.actor < PARTY && g.hero[g.bat.actor].equip[0] <= 0) {
            game_award(ACH_BARE_HANDS);
            if (g.hero[g.bat.actor].crawler == CR_CARL) game_award(ACH_PODOPHILIA);
        }
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
    s_kills_this_blow = 0;      /* one blow, however many things it lands on */
    switch (kind) {
    case SK_HIT_ONE:
        if (from_hero)
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]) +
                                         (g.hero[actor].status[ST_ATKUP] ? 6 : 0),
                                         foe_def_at_depth(target) -
                                         (g.bat.foes[target].status[ST_DEFDOWN] ? 4 : 0),
                                         power, g.hero[actor].st.luck));
        else
            hurt_hero(target, roll_damage(foe_atk(actor),
                                          hero_defence(&g.hero[target]), power, 0));
        break;
    case SK_HIT_ALL:
        if (from_hero) {
            for (int i = 0; i < g.bat.n_foes; i++)
                if (g.bat.foes[i].alive)
                    hurt_foe(i, roll_damage(hero_attack(&g.hero[actor]),
                                            foe_def_at_depth(i), power,
                                            g.hero[actor].st.luck));
        } else {
            for (int i = 0; i < PARTY; i++)
                if (g.hero[i].hp > 0)
                    hurt_hero(i, roll_damage(foe_atk(actor),
                                             hero_defence(&g.hero[i]), power, 0));
        }
        break;
    case SK_BLEED:
        if (from_hero) {
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]),
                                         foe_def_at_depth(target), power,
                                         g.hero[actor].st.luck));
            if (g.bat.foes[target].alive) {
                g.bat.foes[target].status[ST_BLEED] = 3;
                log_line(foe_defs[g.bat.foes[target].def].name, " is bleeding.", 0);
            }
        } else {
            hurt_hero(target, roll_damage(foe_atk(actor),
                                          hero_defence(&g.hero[target]), power, 0));
            if (g.hero[target].hp > 0) g.hero[target].status[ST_BLEED] = 3;
        }
        break;
    case SK_STUN:
        if (from_hero) {
            hurt_foe(target, roll_damage(hero_attack(&g.hero[actor]),
                                         foe_def_at_depth(target), power,
                                         g.hero[actor].st.luck));
            if (g.bat.foes[target].alive && rng_chance(65)) {
                g.bat.foes[target].status[ST_STUN] = 1;
                log_line(foe_defs[g.bat.foes[target].def].name, " loses its footing.", 0);
            }
        } else {
            hurt_hero(target, roll_damage(foe_atk(actor),
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
        tell_tick();
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
    /*  The neighbourhood shuts down the moment its boss does. */
    if (g.pending_zone) {
        g.zone_cleared |= (uint16_t)(1u << (g.pending_zone - 1));
        game_award(ACH_NEIGHBOURHOOD);
        game_toast("The neighbourhood goes quiet.", 0);
        g.pending_zone = 0;
    }

    int xp = 0, gold = 0;
    for (int i = 0; i < g.bat.n_foes; i++) {
        const FoeDef *d = &foe_defs[g.bat.foes[i].def];
        int scale = foe_scale(g.dun.index + 1);
        xp += d->xp * scale / 100;
        /*  Mobs do not drop gold until the second floor: the first floor pays
            in loot boxes and experience only. */
        if (g.dun.index > 0)
            gold += (d->gold + rng_range(0, d->gold / 3)) * scale / 100;
    }
    g.bat.xp_won = (int16_t)xp;
    g.bat.gold_won = (int16_t)gold;
    g.gold = (int16_t)(g.gold + gold);
    g.battles_won++;
    for (int i = 0; i < PARTY; i++)
        if (g.hero[i].hp > 0 && hero_gain_xp(&g.hero[i], xp)) audio_sfx(SFX_LEVEL);

    if (g.battles_won == 1) game_award(ACH_FIRST_KILL);
    {
        int untouched = 1;
        for (int i = 0; i < PARTY; i++) if (g.hero[i].hp < g.hero[i].hp_max) untouched = 0;
        (void)untouched;
    }
    if (g.bat.boss) {
        int floor_no = g.dun.index + 1;
        if (floor_no == 1) g.flags |= F_FLOOR1_BOSS;
        if (floor_no == 2) g.flags |= F_FLOOR2_BOSS;
        if (floor_no == 3) g.flags |= F_FLOOR3_BOSS;
        game_award(ACH_STAIRWELL);
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
    tell_answer(1, 0);          /* the cart, the fuse, the ledger */
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
        s_kills_this_blow = 0;
        for (int i = 0; i < g.bat.n_foes; i++)
            if (g.bat.foes[i].alive) hurt_foe(i, d->power + rng_range(0, 10));
        game_award(ACH_BOOM);
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
    case 0:   /* fight: pick a move */
        g.bat.phase = BAT_SKILL;
        g.bat.cursor = 0;
        break;
    case 1:   /* bag */
        g.bat.phase = BAT_ITEM;
        g.bat.cursor = 0;
        break;
    case 2:   /* guard */
        g.hero[actor].guard = 1;
        hero_heal(&g.hero[actor], 4 + g.hero[actor].level);
        log_line(g.hero[actor].name, " braces.", 0);
        tell_answer(2, 0);
        g.bat.phase = BAT_RESOLVE;
        g.bat.timer = 24;
        break;
    case 3:   /* run */
        /*  A borough boss is standing on the stairwell, so there is genuinely
            nowhere to go. A neighbourhood boss is in a chamber you walked into
            and can walk back out of -- which matters, because it is levels
            above anything else on the floor and the party can meet one on
            their first corridor. */
        if (g.bat.boss == 1) {
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
    int commands = 4;
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
    if (touch_in(in, &kBatCommands[BAT_BACK])) { g.bat.phase = BAT_CHOOSE; return; }

    int fire = (in->pressed & BTN_A) != 0;
    for (int i = 0; i < 3 && !fire; i++)
        if (touch_in(in, &kBatCommands[i])) fire = 1;
    if (!fire) return;

    int actor = g.bat.actor;
    if (g.bat.menu == 0) {
        log_line(g.hero[actor].name, " strikes.", 0);
        /*  A free swing. That is what WEAK_HIT wants -- the Hoarder is choked
            by something jammed down her throat, not by a special move. */
        tell_answer(0, 0);
        apply_effect(SK_HIT_ONE, 100, 1, actor, g.bat.target);
    } else {
        const SkillDef *skills[8];
        int n = game_hero_skills(actor, skills, 8);
        int idx = g.bat.cursor < n ? g.bat.cursor : 0;
        const SkillDef *sk = skills[idx];
        g.hero[actor].mp = (int16_t)(g.hero[actor].mp - sk->cost);
        log_line(g.hero[actor].name, ": ", sk->name);
        /*  Anything that costs stamina is a real move; the free one at the top
            of the list is still a swing however it is labelled. */
        tell_answer(0, sk->cost > 0);
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
    if (touch_in(in, &kBatCommands[BAT_BACK])) { g.bat.phase = BAT_CHOOSE; return; }
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
    tell_answer(0, sk->cost > 0);
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
    if (touch_in(in, &kBatCommands[BAT_BACK])) { g.bat.phase = BAT_CHOOSE; return; }
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

/*  The message the player is currently reading, if there is one. Returns how
 *  many characters of it have been typed out. */
int battle_message(const char **out) {
    if (g.bat.log_shown >= g.bat.n_log) {
        if (out) *out = g.bat.n_log ? g.bat.log[g.bat.n_log - 1] : "";
        return -1;                                  /* nothing pending */
    }
    if (out) *out = g.bat.log[g.bat.log_shown];
    return g.bat.reveal;
}

/*  Types the pending line out, then waits to be dismissed. Everything else in
 *  the battle stops while this runs, which is the whole point: a turn that
 *  resolves faster than it can be read is a turn nobody saw. */
static int pump_messages(const PlatInput *in) {
    if (g.bat.log_shown >= g.bat.n_log) return 0;
    const char *line = g.bat.log[g.bat.log_shown];
    int len = 0;
    while (line[len]) len++;
    int go = (in->pressed & (BTN_A | BTN_B)) || in->touch_pressed;

    if (g.bat.reveal < (uint16_t)len) {
        g.bat.reveal += 2;                          /* two characters a frame */
        if (go || g.bat.reveal > (uint16_t)len) g.bat.reveal = (uint16_t)len;
        if (g.bat.reveal >= (uint16_t)len) g.bat.hold = 46;
        return 1;
    }
    if (g.bat.hold) g.bat.hold--;
    if (go || !g.bat.hold) {
        g.bat.log_shown++;
        g.bat.reveal = 0;
        g.bat.hold = 0;
    }
    return 1;
}

void battle_update(const PlatInput *in) {
    if (g.bat.shake) g.bat.shake--;
    for (int i = 0; i < PARTY + MAX_FOES; i++) if (g.bat.pop_life[i]) g.bat.pop_life[i]--;
    if (pump_messages(in)) return;

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
