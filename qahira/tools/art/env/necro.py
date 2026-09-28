"""The City of the Dead: 16 m grid cells of dusty lanes between walled tomb compounds, domed mausoleums
seen from above, cenotaphs, dead palms, lanterns at the junctions, lived-in doorways.

Cells are built in five canonical opening shapes (masks N=1 E=2 S=4 W=8) and rotated at runtime:
  dead end (N), straight (N+S), corner (N+E), tee (N+E+S), cross (all), plus the entrance, the boss court and
the landmark: an open court around a qubba (a small domed canopy on four columns) over an old cenotaph,
with a sabil basin and the Lamplighter's cache.
"""
import json
import math
import random
import zlib
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model

CELL = 16.0
LANE = 5.4
WALLS = ['#8A7258', '#7E684E', '#957C60', '#6E5C48']
DOMES = ['#9C8468', '#A89070', '#8A765E']


def dome(part, c, r, drum_h=0.6, seg=16):
    part.sloft([(c + V((0, 0, 0)), V((1, 0, 0)), V((0, 1, 0)), r, r), (c + V((0, 0, drum_h)), V((1, 0, 0)), V((0, 1, 0)), r, r)], seg=seg, caps=False)
    rows = []
    for k in range(7):
        a = (math.pi / 2) * k / 6
        z = drum_h + r * math.sin(a) * 1.08
        rr = r * math.cos(a)
        rows.append([c + V((rr * math.cos(t), rr * math.sin(t), z)) for t in [TAU * i / seg for i in range(seg)]])
    part.grid(rows, fan_top=c + V((0, 0, drum_h + r * 1.2)))


def compound(m, rnd, x0, y0, x1, y1, lights, colliders, lane_sides):
    """A walled tomb enclosure filling [x0,x1]x[y0,y1], with a domed tomb inside and a doorway onto a lane."""
    w, h = x1 - x0, y1 - y0
    if w < 1.5 or h < 1.5:
        return
    wall_h = rnd.uniform(2.4, 3.6)
    col = rnd.choice(WALLS)
    wall = Part()
    t = 0.35
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    wall.box((cx, y0 + t / 2, wall_h / 2), (w, t, wall_h))
    wall.box((cx, y1 - t / 2, wall_h / 2), (w, t, wall_h))
    wall.box((x0 + t / 2, cy, wall_h / 2), (t, h, wall_h))
    wall.box((x1 - t / 2, cy, wall_h / 2), (t, h, wall_h))
    # crenellated coping
    for k in range(int(w / 0.8)):
        wall.box((x0 + 0.4 + k * 0.8, y0 + t / 2, wall_h + 0.15), (0.35, t + 0.05, 0.3))
        wall.box((x0 + 0.4 + k * 0.8, y1 - t / 2, wall_h + 0.15), (0.35, t + 0.05, 0.3))
    m.add(wall, col, rough=0.92, flat=True)
    colliders.append([cx, cy, w / 2, h / 2])
    # interior floor, a domed tomb and cenotaphs (seen from above)
    fl = Part()
    fl.box((cx, cy, 0.03), (w - 2 * t, h - 2 * t, 0.06))
    m.add(fl, '#5A4A3A', rough=0.95, flat=True)
    if w > 4 and h > 4 and rnd.random() < 0.8:
        tomb = Part()
        tw, th = min(w, h) * 0.55, min(w, h) * 0.55
        tomb.box((cx, cy, 1.6), (tw, th, 3.2))
        m.add(tomb, rnd.choice(DOMES), rough=0.9, flat=True)
        dm = Part()
        dome(dm, V((cx, cy, 3.2)), tw * 0.42)
        m.add(dm, rnd.choice(['#B0A084', '#9A8A70', '#6E8A8A']), rough=0.8)
        if rnd.random() < 0.3:
            fin = Part()
            fin.capsule((cx, cy, 3.2 + tw * 0.5), (cx, cy, 3.2 + tw * 0.5 + 0.6), 0.03, seg=5)
            m.add(fin, '#C89A45', rough=0.3, metal=1.0)
    ce = Part()
    for k in range(rnd.randint(1, 4)):
        px = rnd.uniform(x0 + 0.8, x1 - 0.8)
        py = rnd.uniform(y0 + 0.8, y1 - 0.8)
        ce.box((px, py, 0.35), (0.6, 1.4, 0.6), Matrix.Rotation(rnd.choice([0, math.pi / 2]), 4, 'Z'))
        ce.box((px, py, 0.8), (0.12, 0.12, 0.5))
    m.add(ce, '#B8A890', rough=0.85, flat=True)
    # doorway facing a lane, sometimes lit from inside (families live here)
    if lane_sides:
        side = rnd.choice(lane_sides)
        dp = {'N': (cx, y1), 'S': (cx, y0), 'E': (x1, cy), 'W': (x0, cy)}[side]
        dd = Part()
        horiz = side in ('N', 'S')
        dd.box((dp[0], dp[1], 1.1), (1.2 if horiz else 0.4, 0.4 if horiz else 1.2, 2.2))
        lit = rnd.random() < 0.45
        m.add(dd, '#C8743A' if lit else '#1A1410', rough=0.6, emit=0.05 if lit else 0.0, flat=True)
        if lit:
            off = {'N': (0, 1.2), 'S': (0, -1.2), 'E': (1.2, 0), 'W': (-1.2, 0)}[side]
            lights.append(dict(p=[dp[0] + off[0], dp[1] + off[1], 1.6], r=5.5, c=[9.0, 5.8, 2.8]))


def ground(m, rnd, mask_lanes):
    g = Part()
    g.box((0, 0, -0.05), (CELL, CELL, 0.1))
    m.add(g, '#4A3E32', rough=0.97, flat=True)
    # lanes: packed earth with scattered paving and debris
    lp = Part()
    for (x0, y0, x1, y1) in mask_lanes:
        lp.box(((x0 + x1) / 2, (y0 + y1) / 2, 0.005), (x1 - x0, y1 - y0, 0.02))
    m.add(lp, '#6A5A48', rough=0.95, flat=True)
    st = Part()
    for (x0, y0, x1, y1) in mask_lanes:
        for k in range(int((x1 - x0) * (y1 - y0) / 3)):
            px, py = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
            s = rnd.uniform(0.3, 0.7)
            st.box((px, py, 0.02), (s, s * rnd.uniform(0.6, 1.2), 0.04), Matrix.Rotation(rnd.uniform(0, 3), 4, 'Z'))
    m.add(st, '#7A6A56', rough=0.9, flat=True)


def cell(name, mask, seed, kind='normal'):
    """mask bits: N=1 E=2 S=4 W=8 (the side has an opening)."""
    rnd = random.Random(seed)
    m = Model(name)
    m.verbose = False
    lights, colliders = [], []
    h = CELL / 2
    l = LANE / 2
    lanes = [(-l, -l, l, l)]
    if mask & 1: lanes.append((-l, l, l, h))
    if mask & 4: lanes.append((-l, -h, l, -l))
    if mask & 2: lanes.append((l, -l, h, l))
    if mask & 8: lanes.append((-h, -l, -l, l))
    if kind == 'arena':
        lanes = [(-6.5, -6.5, 6.5, 6.5), (-l, -h, l, -6.5)]
    if kind == 'landmark':
        lanes = [(-5.6, -5.6, 5.6, 5.6), (-l, 5.6, l, h)]
    points = {}
    ground(m, rnd, lanes)
    # compounds fill everything that is not lane
    if kind == 'arena':
        blocks = [(-h, -h, -6.5, h), (6.5, -h, h, h), (-6.5, 6.5, 6.5, h), (-6.5, -h, -l, -6.5), (l, -h, 6.5, -6.5)]
    elif kind == 'landmark':
        blocks = [(-h, -h, -5.6, h), (5.6, -h, h, h), (-5.6, -h, 5.6, -5.6), (-5.6, 5.6, -l, h), (l, 5.6, 5.6, h)]
    else:
        blocks = [(-h, l, -l, h), (l, l, h, h), (-h, -h, -l, -l), (l, -h, h, -l)]
        if not mask & 1: blocks.append((-l, l, l, h))
        if not mask & 4: blocks.append((-l, -h, l, -l))
        if not mask & 2: blocks.append((l, -l, h, l))
        if not mask & 8: blocks.append((-h, -l, -l, l))
    for (x0, y0, x1, y1) in blocks:
        sides = []
        if y0 >= l - 0.01 or (kind == 'arena' and y0 >= 6.4) or (kind == 'landmark' and y0 >= 5.5): sides.append('S')
        if y1 <= -l + 0.01: sides.append('N')
        if x0 >= l - 0.01: sides.append('W')
        if x1 <= -l + 0.01: sides.append('E')
        compound(m, rnd, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, lights, colliders, sides)
    # lanterns on posts at the lane junction
    for k in range(rnd.randint(1, 2)):
        px, py = rnd.choice([(-l + 0.4, -l + 0.4), (l - 0.4, l - 0.4), (l - 0.4, -l + 0.4), (-l + 0.4, l - 0.4)])
        lp = Part()
        lp.capsule((px, py, 0), (px, py, 2.6), 0.05, seg=6)
        m.add(lp, '#2A2420', rough=0.6, metal=0.4)
        gl = Part()
        gl.sloft([(V((px, py, 2.6 + zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.08), (0.25, 0.1), (0.35, 0.03))], seg=6)
        m.add(gl, '#FFB04A', rough=0.3, emit=0.35)
        lights.append(dict(p=[px, py, 2.4], r=7.0, c=[14.0, 8.5, 3.6]))
        colliders.append([px, py, 0.12, 0.12])
    # dead palms and rubble
    for k in range(rnd.randint(0, 2)):
        bx0, by0, bx1, by1 = rnd.choice(blocks) if blocks else (0, 0, 0, 0)
        px, py = (bx0 + bx1) / 2 + rnd.uniform(-1, 1), (by0 + by1) / 2 + rnd.uniform(-1, 1)
        pm = Part()
        top = V((px + rnd.uniform(-0.5, 0.5), py + rnd.uniform(-0.5, 0.5), rnd.uniform(5, 7)))
        pm.capsule((px, py, 0), top, 0.14, 0.1, seg=6)
        for f in range(7):
            a = TAU * f / 7
            pm.sweep([top, top + V((math.cos(a) * 1.0, math.sin(a) * 1.0, 0.1)), top + V((math.cos(a) * 1.8, math.sin(a) * 1.8, -0.7))],
                     (0.012, 0.12), seg=4, hint=V((0, 0, 1)))
        m.add(pm, '#4A3A26', rough=0.9)
    if kind == 'arena':
        # the great tomb of Umm al-Ghula at the north of the court, and a ring of broken cenotaphs
        gt = Part()
        gt.box((0, 5.2, 2.2), (7, 2.6, 4.4))
        m.add(gt, '#7A6650', rough=0.9, flat=True)
        gd = Part()
        dome(gd, V((0, 5.2, 4.4)), 1.9)
        m.add(gd, '#5E7A74', rough=0.7)
        colliders.append([0, 5.2, 3.5, 1.3])
        for k in range(10):
            a = TAU * k / 10
            px, py = math.cos(a) * 5.2, math.sin(a) * 5.2 - 0.6
            if py > 3.2:
                continue
            cb = Part()
            cb.box((px, py, 0.25), (0.5, 1.1, 0.5 * rnd.uniform(0.6, 1.2)), Matrix.Rotation(a, 4, 'Z'))
            m.add(cb, '#B0A088', rough=0.85, flat=True)
        for px in (-4.5, 4.5):
            lights.append(dict(p=[px, 3.0, 2.2], r=8.0, c=[16.0, 4.0, 9.0]))
        br = Part()
        for px in (-4.5, 4.5):
            br.sloft([(V((px, 3.0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.3), (0.9, 0.22), (1.1, 0.35))], seg=10)
        m.add(br, '#3A3230', rough=0.7, metal=0.3)
        fire = Part()
        for px in (-4.5, 4.5):
            fire.sphere((px, 3.0, 1.25), (0.25, 0.25, 0.18), seg=8)
        m.add(fire, '#FF3A8A', rough=0.5, emit=1.0)
    if kind == 'landmark':
        # the qubba: four columns, a square entablature with a band of muqarnas-like steps, and a ribbed dome
        q = Part()
        for sx in (-1, 1):
            for sy in (-1, 1):
                q.capsule((sx * 1.5, sy * 1.5 + 0.8, 0), (sx * 1.5, sy * 1.5 + 0.8, 2.9), 0.16, 0.13, seg=10)
                q.box((sx * 1.5, sy * 1.5 + 0.8, 0.15), (0.5, 0.5, 0.3))
                colliders.append([sx * 1.5, sy * 1.5 + 0.8, 0.2, 0.2])
        q.box((0, 0.8, 3.1), (3.7, 3.7, 0.4))
        for k in range(3):
            q.box((0, 0.8, 3.35 + k * 0.14), (3.5 - k * 0.35, 3.5 - k * 0.35, 0.14))
        m.add(q, '#B49C7C', rough=0.85, flat=True)
        qd = Part()
        dome(qd, V((0, 0.8, 3.75)), 1.35, drum_h=0.25, seg=20)
        m.add(qd, '#C8B89A', rough=0.75)
        rib = Part()
        for k in range(12):
            a = TAU * k / 12
            pts = []
            for i in range(7):
                t = (math.pi / 2) * i / 6
                rr = 1.37 * math.cos(t)
                pts.append(V((rr * math.cos(a), 0.8 + rr * math.sin(a), 4.0 + 1.37 * 1.08 * math.sin(t))))
            rib.sweep(pts, 0.03, seg=4)
        m.add(rib, '#A08A6A', rough=0.7)
        fin = Part()
        fin.capsule((0, 0.8, 5.5), (0, 0.8, 6.1), 0.035, seg=6)
        fin.sphere((0, 0.8, 5.75), 0.08, seg=8)
        m.add(fin, '#C89A45', rough=0.3, metal=1.0)
        cen = Part()
        cen.box((0, 0.8, 0.45), (1.0, 2.0, 0.9))
        cen.box((0, 0.8, 0.95), (0.8, 1.8, 0.1))
        cen.capsule((0, 0.05, 0.95), (0, 0.05, 1.6), 0.07, seg=8)
        m.add(cen, '#D8CCB4', rough=0.8, flat=True)
        colliders.append([0, 0.8, 0.55, 1.05])
        # the sabil basin: an octagonal stone trough with a little water left in it
        sb = Part()
        sb.sloft([(V((-3.6, -2.6, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.95), (0.55, 0.95), (0.6, 1.05))], seg=8)
        m.add(sb, '#9A8A74', rough=0.85, flat=True)
        wt = Part()
        wt.sloft([(V((-3.6, -2.6, zz)), V((1, 0, 0)), V((0, 1, 0)), 0.8, 0.8) for zz in (0.46, 0.5)], seg=8)
        m.add(wt, '#2A4A50', rough=0.1)
        colliders.append([-3.6, -2.6, 0.9, 0.9])
        # hanging lamps inside the qubba and on tall posts around the court
        lamp = Part()
        lamp.sloft([(V((0, 0.8, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((2.1, 0.05), (2.3, 0.16), (2.5, 0.05))], seg=8)
        m.add(lamp, '#FFC060', rough=0.3, emit=0.9)
        lights.append(dict(p=[0, 0.8, 2.3], r=9.0, c=[22.0, 13.0, 5.0]))
        for px, py in ((4.4, -4.4), (4.4, 4.2), (-4.4, 4.2)):
            lp = Part()
            lp.capsule((px, py, 0), (px, py, 3.0), 0.05, seg=6)
            m.add(lp, '#2A2420', rough=0.6, metal=0.4)
            gl = Part()
            gl.sloft([(V((px, py, 3.0 + zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.08), (0.25, 0.1), (0.35, 0.03))], seg=6)
            m.add(gl, '#FFB04A', rough=0.3, emit=0.35)
            lights.append(dict(p=[px, py, 2.8], r=7.5, c=[12.0, 7.5, 3.2]))
            colliders.append([px, py, 0.12, 0.12])
        points['chest'] = [2.6, -3.3]
    if kind == 'entrance':
        gate = Part()
        for sx in (-1, 1):
            gate.box((sx * (l + 0.5), -h + 1.0, 2.2), (1.0, 1.0, 4.4))
        gate.box((0, -h + 1.0, 4.6), (LANE + 2.0, 1.0, 0.8))
        m.add(gate, '#8A7258', rough=0.9, flat=True)
        for sx in (-1, 1):
            colliders.append([sx * (l + 0.5), -h + 1.0, 0.5, 0.5])
    return m, dict(size=[CELL, CELL], mask=mask, kind=kind, lights=lights, colliders=colliders, points=points)


VARIANTS = [
    ('necro_end', 1, 'normal'), ('necro_straight', 5, 'normal'), ('necro_corner', 3, 'normal'),
    ('necro_tee', 7, 'normal'), ('necro_cross', 15, 'normal'), ('necro_entrance', 1, 'entrance'), ('necro_arena', 4, 'arena'),
    ('necro_landmark', 1, 'landmark'),
]


def export_all(mesh_dir, data_dir, variants=2):
    for base, mask, kind in VARIANTS:
        n = 1 if kind != 'normal' else variants
        for v in range(n):
            name = '%s_%d' % (base, v)
            m, meta = cell(name, mask, seed=zlib.crc32(name.encode()) % 100000, kind=kind)
            m.export('%s/%s.qmesh' % (mesh_dir, name), skinned=False, ao=True)
            with open('%s/%s.json' % (data_dir, name), 'w') as f:
                json.dump(meta, f, indent=1)
