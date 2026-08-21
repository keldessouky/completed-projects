#!/usr/bin/env python3
"""Lays out the three floors and writes them as ASCII maps under tools/floors/.

A floor is a perfect maze (recursive backtracker on the odd cells) with rooms
punched through it, a few extra loops so it is not a tree, and most of the
pointless dead ends pruned away. Fixtures are then placed by walking distance
from the arrival tile: the stairs down as far away as the floor allows, the boss
before them, the shop early, boxes in whatever dead ends survived.

The maps are generated once, from fixed seeds, and committed as text; the game
only ever reads the .txt files, so they can be hand-edited afterwards.

Legend
    #  wall              .  floor            <  stairs up (arrival)
    >  stairs down       +  door             S  shop (a Bopca runs it)
    R  shrine            *  System kiosk (save point)
    c  loot box          C  gold loot box    b  boss
    1-9  story trigger   @  where the game starts
"""
import os
import random
import sys
from collections import deque

FLOORS = [
    # name,    w,  h, seed,   rooms, boxes, prune, loops
    ("floor1", 25, 19, 10441, 5, 3, 0.72, 5),
    ("floor2", 29, 21, 20692, 7, 4, 0.62, 7),
    ("floor3", 29, 21, 31337, 7, 4, 0.55, 9),
]

WALL, FLOOR = '#', '.'


def maze(w, h, rnd):
    grid = [[WALL] * w for _ in range(h)]
    start = (1, 1)
    grid[1][1] = FLOOR
    stack = [start]
    while stack:
        x, y = stack[-1]
        options = []
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            nx, ny = x + dx, y + dy
            if 0 < nx < w - 1 and 0 < ny < h - 1 and grid[ny][nx] == WALL:
                options.append((nx, ny, dx, dy))
        if not options:
            stack.pop()
            continue
        nx, ny, dx, dy = rnd.choice(options)
        grid[y + dy // 2][x + dx // 2] = FLOOR
        grid[ny][nx] = FLOOR
        stack.append((nx, ny))
    return grid


def add_rooms(grid, rnd, count):
    h, w = len(grid), len(grid[0])
    rooms = []
    for _ in range(count * 12):
        if len(rooms) >= count:
            break
        rw, rh = rnd.randrange(3, 7), rnd.randrange(3, 6)
        x = rnd.randrange(1, w - rw - 1)
        y = rnd.randrange(1, h - rh - 1)
        if any(x < ox + ow + 1 and ox < x + rw + 1 and y < oy + oh + 1 and oy < y + rh + 1
               for ox, oy, ow, oh in rooms):
            continue
        rooms.append((x, y, rw, rh))
        for j in range(y, y + rh):
            for i in range(x, x + rw):
                grid[j][i] = FLOOR
    return rooms


def prune_dead_ends(grid, rnd, keep):
    """Fills in dead ends, keeping a fraction of them for treasure to live in."""
    h, w = len(grid), len(grid[0])
    changed = True
    while changed:
        changed = False
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if grid[y][x] != FLOOR:
                    continue
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                        if grid[y + dy][x + dx] != WALL)
                if n == 1 and rnd.random() < keep:
                    grid[y][x] = WALL
                    changed = True


def add_loops(grid, rnd, count):
    h, w = len(grid), len(grid[0])
    made = 0
    for _ in range(count * 40):
        if made >= count:
            break
        x, y = rnd.randrange(2, w - 2), rnd.randrange(2, h - 2)
        if grid[y][x] != WALL:
            continue
        horiz = grid[y][x - 1] == FLOOR and grid[y][x + 1] == FLOOR and \
            grid[y - 1][x] == WALL and grid[y + 1][x] == WALL
        vert = grid[y - 1][x] == FLOOR and grid[y + 1][x] == FLOOR and \
            grid[y][x - 1] == WALL and grid[y][x + 1] == WALL
        if horiz or vert:
            grid[y][x] = FLOOR
            made += 1


def distances(grid, start):
    h, w = len(grid), len(grid[0])
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and grid[n[1]][n[0]] != WALL and n not in dist:
                dist[n] = dist[(x, y)] + 1
                q.append(n)
    return dist


def open_tiles(grid):
    return [(x, y) for y, row in enumerate(grid) for x, c in enumerate(row) if c == FLOOR]


def dead_ends(grid):
    h, w = len(grid), len(grid[0])
    return [(x, y) for y in range(1, h - 1) for x in range(1, w - 1)
            if grid[y][x] == FLOOR and
            sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if grid[y + dy][x + dx] != WALL) == 1]


def build(name, w, h, seed, rooms, boxes, prune, loops):
    rnd = random.Random(seed)
    grid = maze(w, h, rnd)
    add_rooms(grid, rnd, rooms)
    prune_dead_ends(grid, rnd, prune)
    add_loops(grid, rnd, loops)

    tiles = open_tiles(grid)
    start = min(tiles, key=lambda p: p[0] + p[1])
    dist = distances(grid, start)
    reach = [p for p in tiles if p in dist]
    reach.sort(key=lambda p: dist[p])
    if len(reach) < len(tiles):                      # drop anything walled off
        for (x, y) in tiles:
            if (x, y) not in dist:
                grid[y][x] = WALL

    far = reach[-1]
    grid[start[1]][start[0]] = '@' if name == 'floor1' else '<'
    grid[far[1]][far[0]] = '>'

    # The boss stands between the party and the stairs: the tile one step back
    # along the path down, so it cannot be walked around.
    def step_towards(target, back):
        cur = target
        for _ in range(back):
            best, bestd = cur, dist.get(cur, 0)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (cur[0] + dx, cur[1] + dy)
                if n in dist and dist[n] < bestd:
                    best, bestd = n, dist[n]
            cur = best
        return cur

    boss = step_towards(far, 2)
    if grid[boss[1]][boss[0]] == FLOOR:
        grid[boss[1]][boss[0]] = 'b'
    door = step_towards(far, 4)
    if grid[door[1]][door[0]] == FLOOR:
        grid[door[1]][door[0]] = '+'

    span = dist[far]
    def place_at(fraction, ch, taken):
        want = int(span * fraction)
        best = None
        for p in reach:
            if grid[p[1]][p[0]] != FLOOR or p in taken:
                continue
            if best is None or abs(dist[p] - want) < abs(dist[best] - want):
                best = p
        if best:
            grid[best[1]][best[0]] = ch
            taken.add(best)
        return best

    taken = set()
    place_at(0.18, 'S', taken)        # the shop, early enough to matter
    place_at(0.45, 'R', taken)        # a shrine to bleed on
    place_at(0.62, '*', taken)        # System kiosk / save point
    ends = [p for p in dead_ends(grid) if grid[p[1]][p[0]] == FLOOR]
    ends.sort(key=lambda p: -dist.get(p, 0))
    for i, p in enumerate(ends[:boxes]):
        grid[p[1]][p[0]] = 'C' if i == 0 else 'c'
    for i, frac in enumerate((0.06, 0.3, 0.55, 0.8)):
        place_at(frac, str(i + 1), taken)
    return grid


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'floors')
    os.makedirs(out_dir, exist_ok=True)
    for (name, w, h, seed, rooms, boxes, prune, loops) in FLOORS:
        grid = build(name, w, h, seed, rooms, boxes, prune, loops)
        text = "\n".join("".join(row) for row in grid)
        with open(os.path.join(out_dir, name + '.txt'), 'w') as f:
            f.write(text + "\n")
        walkable = sum(row.count(c) for row in grid for c in '.<>+SR*cCb@123456789')
        print("%s: %dx%d, %d walkable tiles" % (name, w, h, walkable))
        if '--show' in sys.argv:
            print(text)
            print()


if __name__ == '__main__':
    main()
