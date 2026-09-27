"""The zone cell kit: every region's 16 m cells share one layout, so the zone generator can join any of them.

A cell is lanes (the walkable ground) and blocks (what fills the rest). The lanes are a crossing in the middle and
arms to the open sides (mask N=1 E=2 S=4 W=8). A region supplies:
    ground(m, rnd)                               the floor under everything
    lanes(m, rnd, rects)                         the walkable surface
    block(m, rnd, x0, y0, x1, y1, sides, ctx)    fill one block rectangle; `sides` lists the lane-facing sides
    dress(m, rnd, rects, ctx)                    props and lights along the lanes
    entrance / arena / landmark (m, rnd, ctx)    the special cells' set pieces
and a lane width. ctx holds lights, colliders and named points.

Blocks south of a lane are kept low (the camera looks north over them); blocks north of it may be tall.
"""
import json
import random
import zlib

from qart.model import Model

CELL = 16.0


class Ctx:
    def __init__(self):
        self.lights, self.colliders, self.points = [], [], {}

    def light(self, p, r, c):
        self.lights.append(dict(p=[round(x, 3) for x in p], r=r, c=list(c)))

    def solid(self, cx, cy, hx, hy):
        self.colliders.append([round(cx, 3), round(cy, 3), round(hx, 3), round(hy, 3)])


def layout(mask, kind, lane):
    """Lane rectangles, block rectangles, and each block's lane-facing sides."""
    h = CELL / 2
    l = lane / 2
    if kind == 'arena':
        lanes = [(-6.5, -6.5, 6.5, 6.5), (-l, -h, l, -6.5)]
        blocks = [(-h, -h, -6.5, h), (6.5, -h, h, h), (-6.5, 6.5, 6.5, h), (-6.5, -h, -l, -6.5), (l, -h, 6.5, -6.5)]
    elif kind == 'landmark':
        lanes = [(-5.6, -5.6, 5.6, 5.6), (-l, 5.6, l, h)]
        blocks = [(-h, -h, -5.6, h), (5.6, -h, h, h), (-5.6, -h, 5.6, -5.6), (-5.6, 5.6, -l, h), (l, 5.6, 5.6, h)]
    else:
        lanes = [(-l, -l, l, l)]
        if mask & 1: lanes.append((-l, l, l, h))
        if mask & 4: lanes.append((-l, -h, l, -l))
        if mask & 2: lanes.append((l, -l, h, l))
        if mask & 8: lanes.append((-h, -l, -l, l))
        blocks = [(-h, l, -l, h), (l, l, h, h), (-h, -h, -l, -l), (l, -h, h, -l)]
        if not mask & 1: blocks.append((-l, l, l, h))
        if not mask & 4: blocks.append((-l, -h, l, -l))
        if not mask & 2: blocks.append((l, -l, h, l))
        if not mask & 8: blocks.append((-h, -l, -l, l))
    out = []
    for (x0, y0, x1, y1) in blocks:
        sides = []
        for (lx0, ly0, lx1, ly1) in lanes:
            if abs(y0 - ly1) < 0.05 and x0 < lx1 - 0.05 and x1 > lx0 + 0.05: sides.append('S')
            if abs(y1 - ly0) < 0.05 and x0 < lx1 - 0.05 and x1 > lx0 + 0.05: sides.append('N')
            if abs(x0 - lx1) < 0.05 and y0 < ly1 - 0.05 and y1 > ly0 + 0.05: sides.append('W')
            if abs(x1 - lx0) < 0.05 and y0 < ly1 - 0.05 and y1 > ly0 + 0.05: sides.append('E')
        out.append(((x0, y0, x1, y1), sorted(set(sides))))
    return lanes, out


def cell(region, name, mask, seed, kind='normal'):
    rnd = random.Random(seed)
    m = Model(name)
    m.verbose = False
    ctx = Ctx()
    lanes, blocks = layout(mask, kind, region.LANE)
    region.ground(m, rnd)
    region.lanes(m, rnd, lanes)
    for (x0, y0, x1, y1), sides in blocks:
        # low when a lane runs along its north side (the camera looks north over it)
        low = 'N' in sides
        region.block(m, rnd, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, sides, ctx, low)
    region.dress(m, rnd, lanes, ctx, kind)
    if kind == 'entrance':
        region.entrance(m, rnd, ctx)
    elif kind == 'arena':
        region.arena(m, rnd, ctx)
    elif kind == 'landmark':
        region.landmark(m, rnd, ctx)
    return m, dict(size=[CELL, CELL], mask=mask, kind=kind, lights=ctx.lights, colliders=ctx.colliders, points=ctx.points)


VARIANTS = [('end', 1, 'normal'), ('straight', 5, 'normal'), ('corner', 3, 'normal'), ('tee', 7, 'normal'), ('cross', 15, 'normal'),
            ('entrance', 1, 'entrance'), ('arena', 4, 'arena'), ('landmark', 1, 'landmark')]


def export_region(region, mesh_dir, data_dir, variants=2):
    for base, mask, kind in VARIANTS:
        for v in range(1 if kind != 'normal' else variants):
            name = '%s_%s_%d' % (region.NAME, base, v)
            m, meta = cell(region, name, mask, zlib.crc32(name.encode()) % 100000, kind)
            m.export('%s/%s.qmesh' % (mesh_dir, name), skinned=False, ao=True)
            with open('%s/%s.json' % (data_dir, name), 'w') as f:
                json.dump(meta, f, indent=1)
