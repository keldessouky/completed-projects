"""The rooftop ahwa: the hub. A café on a roof in Islamic Cairo under the eclipse, with the city below."""
import json
import math
import random
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model
from env.necro import dome


def rooftop(name='rooftop', seed=3, W=20.0, L=20.0):
    rnd = random.Random(seed)
    m = Model(name)
    m.verbose = False
    lights, colliders, points = [], [], {}
    hw, hl = W / 2, L / 2
    # roof tiles
    groups = {}
    s = 1.0
    for j in range(int(L / s)):
        for i in range(int(W / s)):
            col = rnd.choice(['#8A8274', '#7E776A', '#928A7C', '#847C6E'])
            groups.setdefault(col, Part()).box((-hw + (i + 0.5) * s, -hl + (j + 0.5) * s, 0.02), (s - 0.03, s - 0.03, 0.04))
    for col, p in groups.items():
        m.add(p, col, rough=0.9, flat=True)
    base = Part()
    base.box((0, 0, -0.1), (W + 0.6, L + 0.6, 0.2))
    m.add(base, '#3A3430', rough=0.9, flat=True)
    # parapet with a gap to the south where the stair roof stands
    par = Part()
    t = 0.3
    par.box((0, hl + t / 2, 0.55), (W + 2 * t, t, 1.1))
    par.box((-hw - t / 2, 0, 0.55), (t, L, 1.1))
    par.box((hw + t / 2, 0, 0.55), (t, L, 1.1))
    par.box((0, -hl - t / 2, 0.55), (W + 2 * t, t, 1.1))
    m.add(par, '#9A8C78', rough=0.9, flat=True)
    colliders += [[0, hl + t / 2, hw + t, t / 2], [-hw - t / 2, 0, t / 2, hl], [hw + t / 2, 0, t / 2, hl], [0, -hl - t / 2, hw + t, t / 2]]
    # the stairwell hut (exit to the City of the Dead) in the south-west corner
    st = Part()
    st.box((-hw + 2.2, -hl + 2.0, 1.5), (4.0, 3.6, 3.0))
    m.add(st, '#8C7E6A', rough=0.9, flat=True)
    colliders.append([-hw + 2.2, -hl + 2.0, 2.0, 1.8])
    door = Part()
    door.box((-hw + 2.2, -hl + 3.82, 1.1), (1.2, 0.06, 2.2))
    m.add(door, '#FFB060', rough=0.5, emit=0.3, flat=True)
    lights.append(dict(p=[-hw + 2.2, -hl + 4.8, 1.8], r=6.0, c=[12, 7.5, 3.5]))
    points['stair'] = [-hw + 2.2, -hl + 4.3]
    # the tea counter against the east parapet
    ct = Part()
    ct.box((hw - 1.2, 3.0, 0.55), (1.2, 4.0, 1.1))
    m.add(ct, '#5A3E28', rough=0.7, flat=True)
    colliders.append([hw - 1.2, 3.0, 0.6, 2.0])
    top = Part()
    top.box((hw - 1.2, 3.0, 1.13), (1.3, 4.1, 0.06))
    m.add(top, '#C89A45', rough=0.35, metal=0.8, flat=True)
    kt = Part()
    kc = V((hw - 1.1, 2.0, 1.16))
    kt.sloft([(kc + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.12), (0.12, 0.16), (0.25, 0.1), (0.32, 0.03))], seg=12)
    kt.capsule(kc + V((0.12, 0, 0.12)), kc + V((0.28, 0, 0.26)), 0.018, seg=5)
    m.add(kt, '#C89A45', rough=0.3, metal=1.0)
    gl = Part()
    for k in range(6):
        g = V((hw - 1.4, 2.8 + k * 0.22, 1.16))
        gl.sloft([(g + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.025), (0.1, 0.035))], seg=8)
    m.add(gl, '#C0402A', rough=0.2, emit=0.05)
    points['vendor'] = [hw - 2.4, 0.9]   # where a customer stands
    points['keeper'] = [hw - 1.25, 0.45]  # Amm Sayed, at the end of his counter
    # tables, chairs and shisha pipes
    for k in range(5):
        tx = rnd.uniform(-hw + 5, hw - 4)
        ty = rnd.uniform(-hl + 5, hl - 3)
        tb = Part()
        tb.sloft([(V((tx, ty, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.2), (0.05, 0.04), (0.72, 0.04), (0.74, 0.35), (0.77, 0.35))], seg=14)
        m.add(tb, '#8C8E90', rough=0.4, metal=0.7)
        colliders.append([tx, ty, 0.35, 0.35])
        for c in range(rnd.randint(2, 3)):
            a = rnd.uniform(0, TAU)
            cx, cy = tx + math.cos(a) * 0.8, ty + math.sin(a) * 0.8
            ch = Part()
            ch.box((cx, cy, 0.42), (0.42, 0.42, 0.05), Matrix.Rotation(a, 4, 'Z'))
            ch.box((cx - math.cos(a) * 0.2, cy - math.sin(a) * 0.2, 0.7), (0.05 if abs(math.cos(a)) > 0.7 else 0.42, 0.42 if abs(math.cos(a)) > 0.7 else 0.05, 0.55), Matrix.Rotation(0, 4, 'Z'))
            for lx in (-0.18, 0.18):
                for ly in (-0.18, 0.18):
                    ch.box((cx + lx, cy + ly, 0.2), (0.03, 0.03, 0.4))
            m.add(ch, rnd.choice(['#6A4A2E', '#2A5E6E', '#8E2A22']), rough=0.7, flat=True)
        if rnd.random() < 0.6:
            sh = Part()
            sc = V((tx + 0.55, ty - 0.4, 0))
            sh.sloft([(sc + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.12), (0.18, 0.14), (0.3, 0.05), (0.75, 0.025), (0.8, 0.07), (0.86, 0.05))], seg=10)
            m.add(sh, rnd.choice(['#2A6E8A', '#8A2A5E', '#3A8A4A']), rough=0.2, metal=0.3)
            cl = Part()
            cl.sphere(sc + V((0, 0, 0.92)), 0.035, seg=6)
            m.add(cl, '#FF7A30', rough=0.5, emit=0.8)
    # string lights zig-zagging over the café
    ys = [-hl + 6, -2, 2, hl - 3]
    for a, b in zip(ys, ys[1:]):
        pts = [V((-hw + 1 + (W - 2) * (k / 24), a + (b - a) * (k / 24), 3.4 - 0.5 * math.sin(math.pi * k / 24))) for k in range(25)]
        wire = Part()
        wire.sweep(pts, 0.01, seg=4)
        m.add(wire, '#1A1A1A', rough=0.7)
        bl = Part()
        for p in pts[1:-1]:
            bl.sphere(p - V((0, 0, 0.06)), 0.05, seg=6)
        m.add(bl, rnd.choice(['#FFB04A', '#FFD08A', '#FF8A5A']), rough=0.3, emit=0.6)
        mid = pts[12]
        lights.append(dict(p=[mid.x, mid.y, 3.0], r=9.0, c=[20, 13, 7]))
    for p in ((0.0, 0.0), (-5, 5), (5, -5)):
        lights.append(dict(p=[p[0], p[1], 2.6], r=7.0, c=[10, 6.5, 3.2]))
    # water tanks and satellite dishes on the north side, laundry across a corner
    for k in range(2):
        wt = Part()
        c = V((-hw + 3 + k * 2.2, hl - 1.5, 0))
        wt.box(c + V((0, 0, 0.5)), (1.4, 1.4, 1.0))
        wt.sloft([(c + V((0, 0, 1.0 + zz)), V((1, 0, 0)), V((0, 1, 0)), 0.6, 0.6) for zz in (0.0, 1.3)], seg=14)
        m.add(wt, '#2E2E30', rough=0.6, flat=False)
        colliders.append([c.x, c.y, 0.75, 0.75])
    for k in range(3):
        d = Part()
        dc = V((hw - 1.5 - k * 1.6, hl - 1.2, 1.2))
        d.sphere(dc, (0.02, 0.5, 0.5), seg=14)
        d.capsule(dc, dc - V((0, 0, 1.2)), 0.03, seg=5)
        m.add(d, '#A8AAAC', rough=0.4, metal=0.5)
    lw = Part()
    p0, p1 = V((-hw + 0.3, -1.0, 1.9)), V((-3.0, hl - 0.3, 1.9))
    lw.sweep([p0, p0.lerp(p1, 0.5) - V((0, 0, 0.25)), p1], 0.008, seg=4)
    m.add(lw, '#C8C0B0', rough=0.8)
    for k in range(7):
        c = p0.lerp(p1, (k + 1) / 8) - V((0, 0, 0.2 + 0.2 * math.sin(math.pi * (k + 1) / 8)))
        cl = Part()
        cl.box(c - V((0, 0, 0.3)), (0.5, 0.03, 0.6), Matrix.Rotation(math.atan2(p1.y - p0.y, p1.x - p0.x), 4, 'Z'))
        m.add(cl, rnd.choice(['#D8C8B0', '#8E2A22', '#2A4E7E', '#C8A040', '#5A7A4A']), rough=0.95, flat=True)
    # potted plants along the south parapet
    for k in range(4):
        pp = Part()
        c = V((-2 + k * 2.6, -hl + 0.6, 0))
        pp.sloft([(c + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.2), (0.45, 0.26))], seg=10)
        m.add(pp, '#9A5A3A', rough=0.9)
        lf = Part()
        for f in range(6):
            a = TAU * f / 6 + rnd.uniform(0, 0.5)
            lf.sweep([c + V((0, 0, 0.45)), c + V((math.cos(a) * 0.35, math.sin(a) * 0.35, 0.9)), c + V((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.7))], (0.01, 0.07), seg=4, hint=V((0, 0, 1)))
        m.add(lf, '#3A6A2E', rough=0.8)
    # the city below and beyond: lower roofs, domes, minarets (decor, outside the play area)
    city = {}
    for k in range(70):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(hw + 3, hw + 26)
        cx, cy = math.cos(a) * r, math.sin(a) * r
        if abs(cx) < hw + 2 and abs(cy) < hl + 2:
            continue
        bw, bl, bh = rnd.uniform(4, 9), rnd.uniform(4, 9), rnd.uniform(-9, -2)
        col = rnd.choice(['#6E6254', '#5E5448', '#7A6C5C', '#4E463E'])
        city.setdefault(col, Part()).box((cx, cy, (bh - 14) / 2), (bw, bl, 14 + bh))
    for col, p in city.items():
        m.add(p, col, rough=0.95, flat=True)
    win = Part()
    for k in range(120):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(hw + 4, hw + 24)
        win.box((math.cos(a) * r, math.sin(a) * r, rnd.uniform(-8, -3)), (0.6, 0.6, 0.8))
    m.add(win, '#FFB25E', rough=0.4, emit=0.3, flat=True)
    for k in range(5):
        dd = Part()
        c = V((rnd.uniform(-22, 22), rnd.uniform(hl + 8, hl + 26), -2))
        dd.box(c - V((0, 0, 5)), (6, 6, 10))
        dome(dd, c, 2.6)
        m.add(dd, rnd.choice(['#9C8468', '#6E8A8A', '#A89070']), rough=0.8)
        mn = Part()
        mc = c + V((4.0, 1.5, 0))
        for zz, rr, hh in ((0, 0.8, 6), (6, 0.65, 4), (10, 0.5, 3)):
            mn.sloft([(mc + V((0, 0, zz + q)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for q in (0.0, hh)], seg=8)
            mn.sloft([(mc + V((0, 0, zz + hh + q)), V((1, 0, 0)), V((0, 1, 0)), rr + 0.3, rr + 0.3) for q in (0.0, 0.25)], seg=8)
        mn.sloft([(mc + V((0, 0, 13 + q)), V((1, 0, 0)), V((0, 1, 0)), r, r) for q, r in ((0.0, 0.45), (1.2, 0.02))], seg=8)
        m.add(mn, '#B0A084', rough=0.85)
        lights.append(dict(p=[mc.x, mc.y, 10.0], r=6.0, c=[4, 12, 10]))
    points['spawn'] = [0.0, -hl + 6.0]
    points['cat'] = [-4.0, 1.0]
    return m, dict(size=[W, L], lights=lights, colliders=colliders, points=points)


def export(mesh_dir, data_dir):
    m, meta = rooftop()
    m.export('%s/rooftop.qmesh' % mesh_dir, skinned=False, ao=True)
    with open('%s/rooftop.json' % data_dir, 'w') as f:
        json.dump(meta, f, indent=1)
