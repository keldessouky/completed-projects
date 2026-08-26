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
    if (gained) game_award(ACH_LEVEL_UP);
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

/*  Fills both party slots from the roster. Everything a crawler is comes from
 *  their CrawlerDef, so drafting the same pair in a different order gives the
 *  same two people. */
void party_draft(int a, int b) {
    if (a < 0 || a >= crawler_count) a = 0;
    if (b < 0 || b >= crawler_count) b = 1 % crawler_count;
    if (b == a) b = (a + 1) % crawler_count;
    const int pick[PARTY] = { a, b };

    memset(g.hero, 0, sizeof g.hero);
    for (int i = 0; i < PARTY; i++) {
        const CrawlerDef *c = &crawler_defs[pick[i]];
        Hero *h = &g.hero[i];
        h->crawler = (uint8_t)pick[i];
        h->name = c->name;
        h->title = c->title;
        h->st = c->st;
        h->level = 1;
        h->equip[0] = h->equip[1] = h->equip[2] = -1;
        hero_recompute(h);
        h->hp = h->hp_max;
        h->mp = h->mp_max;
    }
}

void party_new(void) { party_draft(0, 1); }

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
    game_award(ACH_LOOT);
    return 1;
}

int game_hero_skills(int hero, const SkillDef **out, int max) {
    int n = 0;
    for (int i = 0; i < skill_count && n < max; i++)
        if (skill_defs[i].owner == g.hero[hero].crawler &&
            skill_defs[i].unlock <= g.hero[hero].level)
            out[n++] = &skill_defs[i];
    return n;
}
