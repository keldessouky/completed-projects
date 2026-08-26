/*  The floor itself: walking it, seeing it, and the things standing on it.
 *
 *  Tiles are generated per run by mapgen from the season seed, so the same
 *  code always rebuilds the same floor and no two seasons share a layout.
 */
#include "game.h"

#include <string.h>

#include "art.h"
#include "audio.h"

static const int dx4[4] = { 0, 1, 0, -1 };     /* N E S W */
static const int dy4[4] = { -1, 0, 1, 0 };

/* Frames of floor life. The show is generous on the tutorial and less so after. */
/*  How long a floor exists. Deeper floors are bigger and get more clock, but
    not proportionally more: the squeeze is the point. */
static int32_t collapse_frames_for(int floor_index) {
    int minutes = 14 + floor_index * 2;
    if (minutes > 40) minutes = 40;
    return 60 * 60 * minutes;
}

char dungeon_tile(int x, int y) {
    if (x < 0 || y < 0 || x >= g.dun.w || y >= g.dun.h) return T_WALL;
    return g.dun.tiles[y * MAP_MAX + x];
}

static int bit_index(int x, int y) { return y * MAP_MAX + x; }

int dungeon_seen(int x, int y) {
    if (x < 0 || y < 0 || x >= MAP_MAX || y >= MAP_MAX) return 0;
    int i = bit_index(x, y);
    return (g.dun.seen[i >> 3] >> (i & 7)) & 1;
}

void dungeon_mark_seen(int x, int y) {
    if (x < 0 || y < 0 || x >= MAP_MAX || y >= MAP_MAX) return;
    int i = bit_index(x, y);
    if (!((g.dun.seen[i >> 3] >> (i & 7)) & 1)) {
        g.dun.seen[i >> 3] |= (uint8_t)(1 << (i & 7));
        g.dun.explored++;
        if (g.dun.explored == 200) game_award(ACH_CARTOGRAPHER);
    }
}

int dungeon_is_used(int x, int y) {
    if (x < 0 || y < 0 || x >= MAP_MAX || y >= MAP_MAX) return 1;
    int i = bit_index(x, y);
    return (g.dun.used[i >> 3] >> (i & 7)) & 1;
}

void dungeon_set_used(int x, int y) {
    if (x < 0 || y < 0 || x >= MAP_MAX || y >= MAP_MAX) return;
    int i = bit_index(x, y);
    g.dun.used[i >> 3] |= (uint8_t)(1 << (i & 7));
}

/*  Which neighbourhood the party is standing in. Corridors between rooms
 *  belong to whichever room is nearest, so the top bar never goes blank on
 *  the walk between two of them. */
int dungeon_zone_at(int x, int y) {
    int best = 0, best_d = 1 << 30;
    for (int i = 0; i < g.dun.n_rooms; i++) {
        int cx = g.dun.room_x[i] + g.dun.room_w[i] / 2;
        int cy = g.dun.room_y[i] + g.dun.room_h[i] / 2;
        int dx = x - cx, dy = y - cy;
        if (dx < 0) dx = -dx;
        if (dy < 0) dy = -dy;
        if (dx + dy < best_d) { best_d = dx + dy; best = i; }
    }
    return g.dun.n_rooms ? g.dun.room_zone[best] : 0;
}

int dungeon_zone(void) { return dungeon_zone_at(g.dun.px, g.dun.py); }

/*  A neighbourhood whose boss is down stops producing mobs. */
int dungeon_zone_cleared(void) {
    return (g.zone_cleared >> dungeon_zone()) & 1;
}

int dungeon_walkable(int x, int y) {
    char t = dungeon_tile(x, y);
    if (t == T_WALL) return 0;
    if (t == T_DOOR && !dungeon_is_used(x, y)) return 0;   /* doors open once asked */
    return 1;
}

/* What the party can see from where it stands: the tile it is on, its
   neighbours, and as far down the corridor ahead as the walls allow. */
void dungeon_light_of_sight(void) {
    int x = g.dun.px, y = g.dun.py;
    for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++)
            dungeon_mark_seen(x + i, y + j);
    int f = g.dun.facing;
    for (int d = 1; d <= 6; d++) {
        int tx = x + dx4[f] * d, ty = y + dy4[f] * d;
        dungeon_mark_seen(tx, ty);
        /* peek sideways down the corridor, the way a torch would */
        dungeon_mark_seen(tx + dy4[f], ty + dx4[f]);
        dungeon_mark_seen(tx - dy4[f], ty - dx4[f]);
        if (dungeon_tile(tx, ty) == T_WALL) break;
    }
}

void dungeon_enter(int floor_index) {
    if (floor_index >= FLOORS) floor_index = FLOORS - 1;
    memset(&g.dun, 0, sizeof g.dun);
    g.zone_cleared = 0;          /* a new floor is a new set of neighbourhoods */
    g.pending_zone = 0;
    g.dun.index = (uint8_t)floor_index;
    mapgen_build(floor_index, g.season);
    for (int y = 0; y < g.dun.h; y++)
        for (int x = 0; x < g.dun.w; x++) {
            char t = g.dun.tiles[y * MAP_MAX + x];
            if (t == T_START || t == T_UP) { g.dun.px = (uint8_t)x; g.dun.py = (uint8_t)y; }
        }
    /* Face whichever way there is floor to walk on. */
    for (int f = 0; f < 4; f++)
        if (dungeon_tile(g.dun.px + dx4[f], g.dun.py + dy4[f]) != T_WALL) { g.dun.facing = (uint8_t)f; break; }
    g.dun.steps_to_encounter = (uint16_t)rng_range(7, 14);
    g.dun.collapse = collapse_frames_for(floor_index);
    dungeon_light_of_sight();
}

static void enter_tile(int x, int y) {
    char t = dungeon_tile(x, y);
    switch (t) {
    case T_BOX:
    case T_BOX_GOLD:
        if (!dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            game_open_box(t == T_BOX_GOLD ? 2 : rng_chance(35) ? 1 : 0);
        }
        break;
    case T_SHOP:
        if (!(g.flags & F_SEEN_SHOP)) {
            g.flags |= F_SEEN_SHOP;
            game_story(g.dun.index + 1, TRIG_SHOP, SCENE_SHOP);
        } else {
            game_set_scene(SCENE_SHOP);
        }
        break;
    case T_SHRINE:
        /*  A safe room. Which building it is stays fixed for a given tile on a
            given floor, so a player can learn a floor's layout and a recall
            code brings back the same one. */
        g.safe_room = (uint8_t)(((x * 73856093) ^ (y * 19349663) ^
                                 ((g.dun.index + 1) * 83492791)) % safe_room_count);
        if (!dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            for (int i = 0; i < PARTY; i++) {
                if (g.hero[i].hp <= 0) g.hero[i].hp = 1;
                hero_heal(&g.hero[i], g.hero[i].hp_max);
                g.hero[i].mp = g.hero[i].mp_max;
            }
        }
        game_set_scene(SCENE_SAFEROOM);
        break;
    case T_KIOSK:
        game_set_scene(SCENE_CODE);
        g.code_mode = 0;
        save_make_code(g.code);
        break;
    case T_BOSS:
        if (!dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            battle_start(1);
        }
        break;
    case T_NBOSS:
        /*  A neighbourhood boss sits in its own chamber and cannot leave it.
            Putting one down shuts the neighbourhood: nothing spawns there
            afterwards, which is the floor's reward for clearing a square. */
        if (!dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            g.pending_zone = (uint8_t)(dungeon_zone_at(x, y) + 1);
            battle_start(2);
        }
        break;
    case T_DOWN:
        if (g.dun.index + 1 < FLOORS) {
            audio_sfx(SFX_DOWN);
            game_toast("Stairs down. The floor above stops existing.", 0);
            dungeon_enter(g.dun.index + 1);
            game_story(g.dun.index + 1, TRIG_FLOOR_ENTER, SCENE_DUNGEON);
        } else {
            game_story(0, TRIG_GAME_END, SCENE_VICTORY);
        }
        break;
    default:
        if (t >= '1' && t <= '9' && !dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            game_story(g.dun.index + 1, t - '0', SCENE_DUNGEON);
        }
        break;
    }
}

void dungeon_turn(int delta) {
    g.dun.facing = (uint8_t)((g.dun.facing + delta + 4) & 3);
    dungeon_light_of_sight();
}

void dungeon_step(int forward) {
    int f = g.dun.facing;
    int nx = g.dun.px + dx4[f] * forward;
    int ny = g.dun.py + dy4[f] * forward;
    char t = dungeon_tile(nx, ny);
    if (t == T_DOOR && !dungeon_is_used(nx, ny)) {
        dungeon_set_used(nx, ny);
        audio_sfx(SFX_DOOR);
        game_toast("The door gives. Something behind it does not.", 0);
        return;
    }
    if (!dungeon_walkable(nx, ny)) return;

    g.dun.px = (uint8_t)nx;
    g.dun.py = (uint8_t)ny;
    g.dun.steps++;
    audio_sfx(SFX_STEP);
    dungeon_light_of_sight();
    enter_tile(nx, ny);
    if (g.scene != SCENE_DUNGEON) return;

    /*  Owed boxes arrive a few steps apart. Walking in earns five of them at
        once, and five box scenes back to back is a wall between the player and
        the first corridor -- the show hands them over as you go instead. */
    if (g.box_queue_n && g.dun.steps % 6 == 0) { game_drain_box_queue(); return; }
    if (g.dun.steps_to_encounter) g.dun.steps_to_encounter--;
    if (!g.dun.steps_to_encounter) {
        g.dun.steps_to_encounter = (uint16_t)rng_range(8, 16);
        if (dungeon_zone_cleared()) return;      /* its boss is down */
        battle_start(0);
    }
}

/* Sideways, without turning: the shoulder buttons. */
void dungeon_strafe(int right) {
    int f = (g.dun.facing + (right ? 1 : 3)) & 3;
    int nx = g.dun.px + dx4[f], ny = g.dun.py + dy4[f];
    if (!dungeon_walkable(nx, ny)) return;
    g.dun.px = (uint8_t)nx;
    g.dun.py = (uint8_t)ny;
    g.dun.steps++;
    dungeon_light_of_sight();
    enter_tile(nx, ny);
    if (g.scene != SCENE_DUNGEON) return;
    /*  Owed boxes arrive a few steps apart. Walking in earns five of them at
        once, and five box scenes back to back is a wall between the player and
        the first corridor -- the show hands them over as you go instead. */
    if (g.box_queue_n && g.dun.steps % 6 == 0) { game_drain_box_queue(); return; }
    if (g.dun.steps_to_encounter) g.dun.steps_to_encounter--;
    if (!g.dun.steps_to_encounter) {
        g.dun.steps_to_encounter = (uint16_t)rng_range(8, 16);
        if (dungeon_zone_cleared()) return;      /* its boss is down */
        battle_start(0);
    }
}

void dungeon_interact(void) { enter_tile(g.dun.px, g.dun.py); }

/* The countdown. When it runs out the floor does not politely wait. */
void dungeon_tick(void) {
    if (g.dun.collapse > 0) {
        g.dun.collapse--;
        if (g.dun.collapse == 60 * 60)
            game_toast("One minute of floor left.", 0);
        if (g.dun.collapse == 0)
            game_toast("The floor is coming down. Find the stairs.", 0);
    } else if ((g.frame & 63) == 0) {
        for (int i = 0; i < PARTY; i++)
            if (g.hero[i].hp > 0) g.hero[i].hp = (int16_t)(g.hero[i].hp - 3);
        g.hurt_flash = 8;
        if (!party_alive()) game_set_scene(SCENE_GAMEOVER);
    }
}
