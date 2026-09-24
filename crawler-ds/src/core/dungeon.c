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

/*  What the party can see from where they stand.
 *
 *  Overhead, sight is a lamp radius rather than a corridor cone: the old
 *  version lit three tiles around the party and a line ahead, which is
 *  everything a first-person view could show and almost nothing on a screen
 *  that draws sixteen tiles across. The lamp lights a disc, and each of the
 *  four corridors running off it is followed until a wall stops it, so a
 *  junction shows you your options without showing you the floor.
 */
#define SIGHT_R 3

void dungeon_light_of_sight(void) {
    int x = g.dun.px, y = g.dun.py;
    for (int j = -SIGHT_R; j <= SIGHT_R; j++)
        for (int i = -SIGHT_R; i <= SIGHT_R; i++)
            if (i * i + j * j <= SIGHT_R * SIGHT_R + 1)
                dungeon_mark_seen(x + i, y + j);

    for (int f = 0; f < 4; f++)
        for (int d = 1; d <= 8; d++) {
            int tx = x + dx4[f] * d, ty = y + dy4[f] * d;
            dungeon_mark_seen(tx, ty);
            /*  The walls either side of a corridor are part of seeing it. */
            dungeon_mark_seen(tx + dy4[f], ty + dx4[f]);
            dungeon_mark_seen(tx - dy4[f], ty - dx4[f]);
            if (dungeon_tile(tx, ty) == T_WALL) break;
        }
}

void dungeon_enter(int floor_index) {
    /*  A new floor is a new quadrant, and its grubs are somebody else's
        problem. This is the release valve on the pressure the party builds by
        clearing rooms: the floor tells you to move on and moving on works. */
    g.grubs = 0;

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
        /*  Picked up, not opened. Standing in a corridor prising open a box
            the System is broadcasting is how crawlers stop being crawlers --
            they get carried to a safe room and opened there. */
        if (!dungeon_is_used(x, y)) {
            dungeon_set_used(x, y);
            game_hold_box(t == T_BOX_GOLD ? 2 : rng_chance(35) ? 1 : 0);
            audio_sfx(SFX_STEP);
            game_toast(game_boxes_held() > 1 ? "Another box. Open them somewhere safe."
                                             : "Loot box stowed. Safe rooms only.", 0);
        }
        break;
    case T_SHOP:
        /*  Nothing on the first floor drops gold, so a stall that only sells
            is a locked door with a shopkeeper behind it. Down here the Bopca
            hands out a ration instead, which is what the unstaffed safe rooms
            do in the book -- experience cookies and dexterity candies. */
        if (g.dun.index == 0) {
            if (!dungeon_is_used(x, y)) {
                dungeon_set_used(x, y);
                inventory_add(ITEM_SPLINT, 2);
                inventory_add(ITEM_ENERGY, 2);
                for (int i = 0; i < PARTY; i++) hero_gain_xp(&g.hero[i], 24);
                game_toast("The Bopca hands over a ration. No charge.", 0);
            } else {
                game_toast("The Bopca has nothing left for you.", 0);
            }
            break;
        }
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
            /*  Mobs are destroyed crossing a stairwell threshold, and the
                thing chasing you is a mob. It works. It works once: the
                developers watch the recap, congratulate you on camera, and
                close it. */
            if (g.rage_hunt) {
                if (!g.rage_patched) {
                    g.rage_patched = 1;
                    g.rage_hunt = 0;
                    game_award(ACH_LOOPHOLE);
                    game_toast("It did not survive the threshold.", 1);
                    game_toast("PATCH NOTE: that will not work again.", 2);
                } else {
                    game_toast("It came down the stairs after you.", 2);
                }
            }
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

/*  Run down the slide between tiles. Called once a frame from dungeon_tick. */
void dungeon_view_tick(void) {
    if (g.dun.move_anim > 0) g.dun.move_anim--;
}

/*  Walk, the way an overworld walks: the direction you press is the direction
 *  you face, and if the way is blocked you turn to look at what blocked you
 *  rather than refusing the input. Pressing into a wall to change which way
 *  you are pointing is how every top-down game in the genre works. */
void dungeon_walk(int dir) {
    dir &= 3;
    if (g.dun.move_anim) return;                /* mid-stride */
    if (g.dun.facing != (uint8_t)dir) {
        g.dun.facing = (uint8_t)dir;
        dungeon_light_of_sight();
        if (!dungeon_walkable(g.dun.px + dx4[dir], g.dun.py + dy4[dir])) return;
    }
    dungeon_step(1);
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

    g.dun.move_dx = (int8_t)(nx - g.dun.px);
    g.dun.move_dy = (int8_t)(ny - g.dun.py);
    g.dun.move_anim = WALK_FRAMES;
    g.dun.px = (uint8_t)nx;
    g.dun.py = (uint8_t)ny;
    g.dun.steps++;
    audio_sfx(SFX_STEP);
    /*  It is closing. Nothing to fight it with -- the only move is the stairs,
        and only while that still works. */
    if (g.rage_hunt) {
        if (--g.rage_hunt == 0) {
            game_toast("It caught up.", 2);
            battle_start_foe(foe_rage(), " is here for you.");
            return;
        }
        if (g.rage_hunt == 20 || g.rage_hunt == 10)
            game_toast("It is still coming.", 2);
        else if (g.rage_hunt == 4)
            game_toast("It is right behind you.", 2);
    }
    dungeon_light_of_sight();
    enter_tile(nx, ny);
    if (g.scene != SCENE_DUNGEON) return;

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
    dungeon_view_tick();
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

/* ------------------------------------------------------------ the map ---- */

/*  One tile on the map, in pixels. Zoom is its own byte now -- it used to ride
 *  in bit 0 of menu_cursor, which the party menu moves as a cursor. */
int dungeon_map_cell(void) { return g.map_zoom ? 8 : 6; }

/*  Along one axis: the first tile the panel shows. A floor that fits is
 *  centred in the panel, which can put the first tile before the floor's
 *  edge; one that does not follows the party and stops at its walls. Floors
 *  run 25 to 30 across and the panel holds 40 at the smaller cell, so the
 *  first case is the usual one -- the map used to sit against the left edge
 *  with a third of the panel to its right drawn as ground that was not
 *  there. */
static int map_origin(int at, int size, int fit) {
    if (fit >= size) return -(fit - size) / 2;
    int o = at - fit / 2;
    if (o + fit > size) o = size - fit;
    return o < 0 ? 0 : o;
}

/*  Which tile sits in the map panel's top-left corner, and how many fit.
 *
 *  Both the renderer and the stylus read this, so a tap lands on the square
 *  that was drawn under it: the camera arithmetic used to live inline in
 *  draw_map, and a second copy of it in the input code is exactly the
 *  arrangement that drifts. */
void dungeon_map_view(int w, int h, int *cx, int *cy, int *cols, int *rows) {
    int cell = dungeon_map_cell();
    *cols = (w - 4) / cell;
    *rows = (h - 4) / cell;
    *cx = map_origin(g.dun.px, g.dun.w, *cols);
    *cy = map_origin(g.dun.py, g.dun.h, *rows);
}

/*  The tile under a point in the map panel. 0 if the point is on the frame,
 *  past the last whole cell, or in the margin around a floor that fits. */
int dungeon_map_pick(int px, int py, int x0, int y0, int w, int h, int *mx, int *my) {
    int cell = dungeon_map_cell(), cx, cy, cols, rows;
    dungeon_map_view(w, h, &cx, &cy, &cols, &rows);
    int i = (px - x0 - 2), j = (py - y0 - 2);
    if (i < 0 || j < 0) return 0;
    i /= cell;
    j /= cell;
    if (i >= cols || j >= rows) return 0;
    *mx = cx + i;
    *my = cy + j;
    return *mx >= 0 && *my >= 0 && *mx < g.dun.w && *my < g.dun.h;
}

/*  May a route pass over this tile on the way somewhere else?
 *
 *  Only if stepping on it does nothing. A boss tile starts the fight, the
 *  stairs go down, the shop, shrine and kiosk open, and picking up a box can
 *  arm Rule 12 -- none of which should happen because a stylus drew a line
 *  through them. Spent tiles are inert and fine. The tapped tile itself is
 *  the exception, because that one the player chose. */
static int passable(int x, int y) {
    if (!dungeon_walkable(x, y) || !dungeon_seen(x, y)) return 0;
    switch (dungeon_tile(x, y)) {
    case T_FLOOR: case T_START: case T_UP: case T_DOOR:
        return 1;
    case T_BOX: case T_BOX_GOLD: case T_BOSS: case T_NBOSS: case T_SHRINE:
        return dungeon_is_used(x, y);
    default:
        return 0;
    }
}

/*  The first step of the shortest route to (tx, ty), as a direction, or -1.
 *
 *  Breadth-first over ground the party has seen -- a stylus should not be a
 *  way to navigate fog, and routing through unexplored squares would quietly
 *  reveal what is in them. Searched backwards from the target so the answer
 *  is simply which neighbour of the party is closest to it. */
int dungeon_route(int tx, int ty) {
    if (tx == g.dun.px && ty == g.dun.py) return -1;
    if (!dungeon_walkable(tx, ty) || !dungeon_seen(tx, ty)) return -1;

    static uint8_t dist[MAP_MAX * MAP_MAX];
    static uint16_t queue[MAP_MAX * MAP_MAX];
    memset(dist, 0xFF, sizeof dist);
    int head = 0, tail = 0;
    dist[ty * MAP_MAX + tx] = 0;
    queue[tail++] = (uint16_t)(ty * MAP_MAX + tx);
    while (head < tail) {
        int at = queue[head++], x = at % MAP_MAX, y = at / MAP_MAX;
        for (int d = 0; d < 4; d++) {
            int nx = x + dx4[d], ny = y + dy4[d];
            if (nx < 0 || ny < 0 || nx >= g.dun.w || ny >= g.dun.h) continue;
            int n = ny * MAP_MAX + nx;
            if (dist[n] != 0xFF) continue;
            /*  The party's own square is where the search ends, whatever it
                is standing on. */
            if (!(nx == g.dun.px && ny == g.dun.py) && !passable(nx, ny)) continue;
            dist[n] = (uint8_t)(dist[at] + 1 > 250 ? 250 : dist[at] + 1);
            queue[tail++] = (uint16_t)n;
        }
    }
    int best = -1, best_d = 0xFF;
    for (int d = 0; d < 4; d++) {
        int nx = g.dun.px + dx4[d], ny = g.dun.py + dy4[d];
        if (nx < 0 || ny < 0 || nx >= g.dun.w || ny >= g.dun.h) continue;
        int v = dist[ny * MAP_MAX + nx];
        if (v < best_d) { best_d = v; best = d; }
    }
    return best;
}
