/*  Procedural floors.
 *
 *  Book One's three floors were hand-drawn ASCII, which is the right way to
 *  author a fixed story and the wrong way to build a roguelike: every run
 *  walked the same corridors. The premise is a televised dungeon that tears
 *  itself down and rebuilds for a new season, so the layout is generated per
 *  run from the season seed and the story beats are placed into it rather
 *  than drawn on top of it.
 *
 *  Rooms are placed first and each is joined to the one before it, which
 *  guarantees a connected floor without a reachability pass afterwards. The
 *  generator keeps its own random stream: floors have to regenerate
 *  identically when a recall code puts you back on one, and sharing the run's
 *  stream would make the layout depend on how many times you had missed.
 */
#include "game.h"

#include <string.h>

typedef struct { int8_t x, y, w, h; } Room;

static uint32_t gs;
static char *T;
static int W, H;

static uint32_t gnext(void) {
    gs ^= gs << 13; gs ^= gs >> 17; gs ^= gs << 5;
    return gs;
}

static int grange(int lo, int hi) {
    if (hi <= lo) return lo;
    return lo + (int)(gnext() % (uint32_t)(hi - lo + 1));
}

static void put(int x, int y, char c) {
    if (x >= 0 && y >= 0 && x < W && y < H) T[y * MAP_MAX + x] = c;
}

static char at(int x, int y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return T_WALL;
    return T[y * MAP_MAX + x];
}

static void carve_room(const Room *r) {
    for (int y = r->y; y < r->y + r->h; y++)
        for (int x = r->x; x < r->x + r->w; x++) put(x, y, T_FLOOR);
}

/* Once the vault is sealed nothing may cut through its ring, or the boss
   stops being a gate and becomes an ornament. */
static const Room *seal;

static int in_seal(int x, int y) {
    if (!seal) return 0;
    return x >= seal->x - 1 && x <= seal->x + seal->w &&
           y >= seal->y - 1 && y <= seal->y + seal->h;
}

static void carve_h(int x0, int x1, int y) {
    if (x1 < x0) { int t = x0; x0 = x1; x1 = t; }
    for (int x = x0; x <= x1; x++)
        if (at(x, y) == T_WALL && !in_seal(x, y)) put(x, y, T_FLOOR);
}

static void carve_v(int y0, int y1, int x) {
    if (y1 < y0) { int t = y0; y0 = y1; y1 = t; }
    for (int y = y0; y <= y1; y++)
        if (at(x, y) == T_WALL && !in_seal(x, y)) put(x, y, T_FLOOR);
}

static int overlaps(const Room *a, const Room *rooms, int n) {
    for (int i = 0; i < n; i++) {
        const Room *b = &rooms[i];
        if (a->x - 1 < b->x + b->w && b->x - 1 < a->x + a->w &&
            a->y - 1 < b->y + b->h && b->y - 1 < a->y + a->h) return 1;
    }
    return 0;
}

/* A spot inside a room that is still plain floor, so two features never land
   on the same tile and nothing is dropped in a doorway. */
static int spot(const Room *r, int *ox, int *oy) {
    for (int tries = 0; tries < 40; tries++) {
        int x = grange(r->x, r->x + r->w - 1);
        int y = grange(r->y, r->y + r->h - 1);
        if (at(x, y) != T_FLOOR) continue;
        int mouths = 0;                   /* not in front of a corridor mouth */
        if (at(x - 1, y) == T_FLOOR && x == r->x) mouths++;
        if (at(x + 1, y) == T_FLOOR && x == r->x + r->w - 1) mouths++;
        if (at(x, y - 1) == T_FLOOR && y == r->y) mouths++;
        if (at(x, y + 1) == T_FLOOR && y == r->y + r->h - 1) mouths++;
        if (mouths) continue;
        *ox = x; *oy = y;
        return 1;
    }
    for (int y = r->y; y < r->y + r->h; y++)
        for (int x = r->x; x < r->x + r->w; x++)
            if (at(x, y) == T_FLOOR) { *ox = x; *oy = y; return 1; }
    return 0;
}

static void place(const Room *r, char tile) {
    int x, y;
    if (spot(r, &x, &y)) put(x, y, tile);
}

static uint8_t reach[MAP_MAX * MAP_MAX];

static void flood(int sx, int sy) {
    static int16_t qx[MAP_MAX * MAP_MAX], qy[MAP_MAX * MAP_MAX];
    memset(reach, 0, sizeof reach);
    int head = 0, tail = 0;
    qx[tail] = (int16_t)sx; qy[tail++] = (int16_t)sy;
    reach[sy * MAP_MAX + sx] = 1;
    static const int ddx[4] = { 0, 1, 0, -1 }, ddy[4] = { -1, 0, 1, 0 };
    while (head < tail) {
        int cx = qx[head], cy = qy[head]; head++;
        for (int d = 0; d < 4; d++) {
            int nx = cx + ddx[d], ny = cy + ddy[d];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (reach[ny * MAP_MAX + nx] || at(nx, ny) == T_WALL) continue;
            reach[ny * MAP_MAX + nx] = 1;
            qx[tail] = (int16_t)nx; qy[tail++] = (int16_t)ny;
        }
    }
}

/*  Digs a route from a stranded tile back to anything the flood can see.
 *
 *  An L-shaped corridor is not enough: when the vault sits between the two,
 *  the ring blocks both elbows, and since nothing about the choice changes
 *  between passes the repair loop then retries the same blocked route until
 *  it gives up. This walks a breadth-first route through the rock instead,
 *  round the vault rather than into it, and carves what it walked.
 */
static const int ddx4[4] = { 0, 1, 0, -1 }, ddy4[4] = { -1, 0, 1, 0 };

static int8_t came[MAP_MAX * MAP_MAX];
static uint8_t visited[MAP_MAX * MAP_MAX];

static int connect(int ox, int oy) {
    static int16_t qx[MAP_MAX * MAP_MAX], qy[MAP_MAX * MAP_MAX];
    memset(visited, 0, sizeof visited);
    int head = 0, tail = 0;
    qx[tail] = (int16_t)ox; qy[tail++] = (int16_t)oy;
    visited[oy * MAP_MAX + ox] = 1;
    came[oy * MAP_MAX + ox] = -1;
    while (head < tail) {
        int cx = qx[head], cy = qy[head]; head++;
        if (reach[cy * MAP_MAX + cx]) {
            int x = cx, y = cy;
            while (!(x == ox && y == oy)) {
                if (at(x, y) == T_WALL) put(x, y, T_FLOOR);
                int d = came[y * MAP_MAX + x];
                x -= ddx4[d]; y -= ddy4[d];
            }
            return 1;
        }
        for (int d = 0; d < 4; d++) {
            int nx = cx + ddx4[d], ny = cy + ddy4[d];
            if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
            if (visited[ny * MAP_MAX + nx] || in_seal(nx, ny)) continue;
            visited[ny * MAP_MAX + nx] = 1;
            came[ny * MAP_MAX + nx] = (int8_t)d;
            qx[tail] = (int16_t)nx; qy[tail++] = (int16_t)ny;
        }
    }
    return 0;
}

void mapgen_build(int floor_index, uint32_t season) {
    /* Deeper floors are bigger, and the seed is per-floor so floor two does
       not become floor one's twin. */
    /*  Floors grow with depth up to what the tile buffer can hold, which is
        MAP_MAX minus a wall on each side. */
    W = 25 + floor_index;
    H = 19 + floor_index;
    if (W > MAP_MAX - 2) W = MAP_MAX - 2;
    if (H > MAP_MAX - 2) H = MAP_MAX - 2;
    T = g.dun.tiles;
    seal = NULL;
    gs = (season ^ (0x9E3779B9u * (uint32_t)(floor_index + 1)));
    if (!gs) gs = 0x1BADCA7Du;

    memset(T, T_WALL, MAP_MAX * MAP_MAX);

    Room rooms[MAX_ROOMS];
    int n = 0;
    int want = 6 + floor_index / 2;
    if (want > MAX_ROOMS) want = MAX_ROOMS;
    for (int tries = 0; tries < 300 && n < want; tries++) {
        Room r;
        r.w = (int8_t)grange(4, 7);
        r.h = (int8_t)grange(3, 5);
        r.x = (int8_t)grange(1, W - r.w - 2);
        r.y = (int8_t)grange(1, H - r.h - 2);
        if (overlaps(&r, rooms, n)) continue;
        rooms[n++] = r;
    }

    /* The way out is the room farthest from the way in, so a floor is a
       journey rather than a corridor. Moving it to the end of the chain
       matters: rooms are joined in sequence, and the exit gets sealed below,
       which would cut the chain in half if it sat in the middle of it. */
    if (n > 2) {
        int sx = rooms[0].x + rooms[0].w / 2, sy = rooms[0].y + rooms[0].h / 2;
        int far = 1, best = -1;
        for (int i = 1; i < n; i++) {
            int cx = rooms[i].x + rooms[i].w / 2, cy = rooms[i].y + rooms[i].h / 2;
            int dx = cx - sx, dy = cy - sy;
            int d = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
            if (d > best) { best = d; far = i; }
        }
        Room t = rooms[far]; rooms[far] = rooms[n - 1]; rooms[n - 1] = t;
    }

    for (int i = 0; i < n; i++) carve_room(&rooms[i]);
    for (int i = 1; i < n; i++) {
        int ax = rooms[i - 1].x + rooms[i - 1].w / 2;
        int ay = rooms[i - 1].y + rooms[i - 1].h / 2;
        int bx = rooms[i].x + rooms[i].w / 2;
        int by = rooms[i].y + rooms[i].h / 2;
        if (gnext() & 1) { carve_h(ax, bx, ay); carve_v(ay, by, bx); }
        else             { carve_v(ay, by, ax); carve_h(ax, bx, by); }
    }

    /* Seal the exit room and cut exactly one way in. The boss stands in that
       doorway, so the stairs cannot be reached without going through it —
       which is the whole shape of a floor in the books. */
    Room *ex = &rooms[n - 1];
    for (int x = ex->x - 1; x <= ex->x + ex->w; x++) {
        put(x, ex->y - 1, T_WALL);
        put(x, ex->y + ex->h, T_WALL);
    }
    for (int y = ex->y - 1; y <= ex->y + ex->h; y++) {
        put(ex->x - 1, y, T_WALL);
        put(ex->x + ex->w, y, T_WALL);
    }
    /* The entrance goes down before anything is sealed, and every
       reachability question below is asked from it. Asking from a room's
       centre instead is what let broken floors through: a centre can end up
       under the vault's ring, and a flood that starts on rock reaches
       nothing, so everything reads as connected while the floor is in
       pieces. */
    int sx, sy;
    if (!spot(&rooms[0], &sx, &sy)) { sx = rooms[0].x; sy = rooms[0].y; }
    put(sx, sy, floor_index ? T_UP : T_START);

    seal = ex;

    int mx = ex->x + ex->w / 2, my = ex->y + ex->h / 2;

    /* Try each side until one of them actually tunnels out to open floor. A
       door facing the start is nicest, but a door that connects is the
       requirement: a sealed vault is a dead run. */
    static const int sdx[4] = { -1, 1, 0, 0 }, sdy[4] = { 0, 0, -1, 1 };
    int order[4] = { 0, 1, 2, 3 };
    if (sx > ex->x)      { order[0] = 1; order[1] = 0; }
    if (sy > ex->y)      { order[2] = 3; order[3] = 2; }
    int doorx = -1, doory = -1;
    for (int k = 0; k < 4 && doorx < 0; k++) {
        int side = order[k];
        int dx = sdx[side], dy = sdy[side];
        int px = dx < 0 ? ex->x - 1 : dx > 0 ? ex->x + ex->w : mx;
        int py = dy < 0 ? ex->y - 1 : dy > 0 ? ex->y + ex->h : my;
        int hit = 0, len = 0;
        for (int x = px + dx, y = py + dy;
             x > 0 && y > 0 && x < W - 1 && y < H - 1; x += dx, y += dy, len++) {
            if (at(x, y) != T_WALL) { hit = 1; break; }
            if (len > MAP_MAX) break;
        }
        if (!hit) continue;
        put(px, py, T_FLOOR);
        for (int x = px + dx, y = py + dy;
             x > 0 && y > 0 && x < W - 1 && y < H - 1; x += dx, y += dy) {
            if (at(x, y) != T_WALL) break;
            put(x, y, T_FLOOR);
        }
        doorx = px; doory = py;
    }
    if (doorx < 0) {                       /* no side tunnelled: give up the seal */
        seal = NULL;
        doorx = mx; doory = ex->y + ex->h;
        put(doorx, doory, T_FLOOR);
        carve_v(doory, sy, doorx);
        carve_h(doorx, sx, sy);
    }

    /* Sealing the vault can strand a whole branch whose only corridor ran
       along the ring — and the vault's own tunnel can come out inside that
       branch, which is how a floor ends up looking connected and playing as
       a dead run. So repair generically: flood, take any floor the flood
       cannot see, join it back, repeat. Tiles inside the ring are skipped;
       the vault has its door and must not get a second one. */
    for (int pass = 0; pass < 64; pass++) {
        flood(sx, sy);
        int ox = -1, oy = -1;
        for (int y = 1; y < H - 1 && ox < 0; y++)
            for (int x = 1; x < W - 1; x++)
                if (at(x, y) != T_WALL && !reach[y * MAP_MAX + x] && !in_seal(x, y)) {
                    ox = x; oy = y; break;
                }
        if (ox < 0) break;
        if (!connect(ox, oy)) break;
    }
    /* The entrance has to be somewhere the flood actually got to: a room's
       centre can end up under the vault's ring, and flooding from a wall
       reaches nothing, which makes every other check pass while the floor is
       in pieces. */
    flood(sx, sy);

    place(ex, T_DOWN);
    put(doorx, doory, T_BOSS);

    /* The rest, spread over the rooms between the two, so the shop and the
       shrine are never the same corner of the same box. */
    static const char kit[] = { T_SHOP, T_SHRINE, T_KIOSK, '1', '2', '3', '4' };
    int mid = n - 2 > 0 ? n - 2 : 1;
    for (int i = 0; i < (int)sizeof kit; i++)
        place(&rooms[1 + (int)(gnext() % (uint32_t)mid)], kit[i]);

    /*  Neighbourhood bosses, each in a room of its own. Four to a square on
        the real floor; three to a generated one, which is about the same
        density and still leaves somewhere to walk. */
    for (int i = 0; i < 3; i++) {
        Room *r = &rooms[1 + (int)(gnext() % (uint32_t)mid)];
        place(r, T_NBOSS);
        place(r, T_DOOR);        /* so walking in on one is a decision */
    }
    int boxes = grange(3, 5);
    for (int i = 0; i < boxes; i++)
        place(&rooms[gnext() % (uint32_t)(n - 1)], i == 0 ? T_BOX_GOLD : T_BOX);

    /*  Tag every room with a neighbourhood that has turned up by this depth.
        The entrance room is always the quiet one, so a floor does not open
        with something eating you. */
    int pool[16], np = 0;
    for (int i = 0; i < zone_count && np < 16; i++)
        if (zone_defs[i].from_floor <= floor_index + 1) pool[np++] = i;
    if (!np) pool[np++] = 0;
    g.dun.n_rooms = (uint8_t)n;
    for (int i = 0; i < n; i++) {
        g.dun.room_x[i] = rooms[i].x;
        g.dun.room_y[i] = rooms[i].y;
        g.dun.room_w[i] = rooms[i].w;
        g.dun.room_h[i] = rooms[i].h;
        g.dun.room_zone[i] = (uint8_t)(i == 0 ? pool[0] : pool[gnext() % (uint32_t)np]);
    }

    g.dun.w = (uint8_t)W;
    g.dun.h = (uint8_t)H;
    seal = NULL;
}
