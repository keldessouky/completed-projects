/*  Stats, levelling and the party's pockets.
 *
 *  One budget runs the whole game: every derived number below comes from the
 *  six attributes plus what the hero is carrying, so a piece of gear and a
 *  level-up point are always comparable.
 */
#include "game.h"

#include <string.h>

static int gear_bonus(const Hero *h, int kind) {
    int total = 0;
    for (int i = 0; i < 3; i++) {
        int id = h->equip[i];
        if (id <= 0 || id >= item_count) continue;
        if (item_defs[id].kind == kind) total += item_defs[id].power;
    }
    return total;
}

int hero_attack(const Hero *h) {
    int base = h->st.str * 2 + h->st.dex / 2 + h->level;
    if (h->st.cha > 8) base += (h->st.cha - 8) / 2;    /* Donut's audience helps */
    return base + gear_bonus(h, IT_WEAPON);
}

int hero_defence(const Hero *h) {
    return h->st.con + h->st.dex / 2 + h->level / 2 + gear_bonus(h, IT_ARMOUR);
}

int hero_speed(const Hero *h) { return h->st.dex * 2 + h->level; }

int hero_max_hp(const Hero *h) { return 34 + h->st.con * 7 + h->level * 5; }

int hero_max_mp(const Hero *h) { return 12 + h->st.wit * 3 + h->st.cha + h->level * 2; }

void hero_recompute(Hero *h) {
    h->hp_max = (int16_t)hero_max_hp(h);
    h->mp_max = (int16_t)hero_max_mp(h);
    if (h->hp > h->hp_max) h->hp = h->hp_max;
    if (h->mp > h->mp_max) h->mp = h->mp_max;
}

int hero_xp_needed(int level) { return 30 + level * level * 22; }

int hero_gain_xp(Hero *h, int xp) {
    int gained = 0;
    h->xp = (int16_t)(h->xp + xp);
    while (h->xp >= hero_xp_needed(h->level) && h->level < 30) {
        h->xp = (int16_t)(h->xp - hero_xp_needed(h->level));
        h->level++;
        h->points = (uint8_t)(h->points + 2);
        hero_recompute(h);
        h->hp = h->hp_max;
        h->mp = h->mp_max;
        gained++;
    }
    return gained;
}

void hero_heal(Hero *h, int amount) {
    if (h->hp <= 0 && amount > 0) return;          /* the downed need reviving */
    h->hp = (int16_t)(h->hp + amount);
    if (h->hp > h->hp_max) h->hp = h->hp_max;
}

int party_alive(void) {
    int n = 0;
    for (int i = 0; i < PARTY; i++) if (g.hero[i].hp > 0) n++;
    return n;
}

void party_new(void) {
    memset(g.hero, 0, sizeof g.hero);

    Hero *carl = &g.hero[0];
    carl->name = "Carl";
    carl->title = "Crawler";
    carl->st = (Stats){ 9, 6, 9, 5, 4, 5 };
    carl->level = 1;
    carl->equip[0] = carl->equip[1] = carl->equip[2] = -1;
    hero_recompute(carl);
    carl->hp = carl->hp_max;
    carl->mp = carl->mp_max;

    Hero *donut = &g.hero[1];
    donut->name = "Donut";
    donut->title = "Princess";
    donut->st = (Stats){ 4, 10, 5, 6, 12, 8 };
    donut->level = 1;
    donut->equip[0] = donut->equip[1] = donut->equip[2] = -1;
    hero_recompute(donut);
    donut->hp = donut->hp_max;
    donut->mp = donut->mp_max;
}

int inventory_add(int item, int count) {
    if (item <= 0 || item >= INVENTORY) return 0;
    int room = 99 - g.inventory[item];
    if (count > room) count = room;
    g.inventory[item] = (uint8_t)(g.inventory[item] + count);
    return count;
}

int inventory_count(int item) {
    if (item <= 0 || item >= INVENTORY) return 0;
    return g.inventory[item];
}

/* Equipping swaps whatever was in the slot back into the bag. */
int equip_item(Hero *h, int item) {
    if (item <= 0 || item >= item_count) return 0;
    const ItemDef *d = &item_defs[item];
    if (d->kind != IT_WEAPON && d->kind != IT_ARMOUR && d->kind != IT_TRINKET) return 0;
    int slot = d->kind == IT_WEAPON ? 0 : d->kind == IT_ARMOUR ? 1 : 2;
    if (!inventory_count(item)) return 0;
    g.inventory[item]--;
    if (h->equip[slot] > 0) inventory_add(h->equip[slot], 1);
    h->equip[slot] = (int8_t)item;
    hero_recompute(h);
    return 1;
}

int game_hero_skills(int hero, const SkillDef **out, int max) {
    int n = 0;
    for (int i = 0; i < skill_count && n < max; i++)
        if (skill_defs[i].owner == hero && skill_defs[i].unlock <= g.hero[hero].level)
            out[n++] = &skill_defs[i];
    return n;
}
