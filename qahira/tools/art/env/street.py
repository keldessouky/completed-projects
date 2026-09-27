"""Downtown Cairo street tiles: paving, kerbs, apartment facades with balconies, AC units, satellite
dishes, shop shutters, awnings and neon, strings of festival lights. Exports a static mesh plus a JSON
sidecar with colliders and light sources for the engine.

Tile frame: the street runs along Y (north), the tile spans x in [-W/2, W/2] and y in [-L/2, L/2].
"""
import json
import math
import random
import numpy as np
from mathutils import Vector as V, Matrix

from qart.geom import Part
from qart.model import Model

PLASTER = ['#8A7560', '#9C8263', '#7E6A5A', '#A08870', '#8C6E62', '#7A7468', '#9A7A5E']
NEON = [('#FF2E88', (1.0, 0.18, 0.53)), ('#2BD1C8', (0.17, 0.82, 0.78)), ('#F2A541', (0.95, 0.65, 0.26)),
        ('#7A5CFF', (0.48, 0.36, 1.0))]


def street_tile(name, seed=1, W=14.0, L=24.0, street=7.0):
    rnd = random.Random(seed)
    m = Model(name)
    m.verbose = False
    lights, colliders, decals = [], [], []
    hw = street / 2

    # ---------------- paving: stones with gaps over a dark bed, kerbs, raised pavements
    bed = Part()
    bed.box((0, 0, -0.03), (W, L, 0.06))
    m.add(bed, '#1C1816', rough=0.95, flat=True)
    groups = {}
    s = 0.6
    ny = int(L / s)
    for j in range(ny):
        y0 = -L / 2 + j * s
        off = (s / 2) if j % 2 else 0
        x = -hw - off
        while x < hw:
            x0, x1 = max(x, -hw), min(x + s, hw)
            if x1 - x0 > 0.05:
                col = rnd.choice(['#5A4F48', '#564B44', '#5E534B', '#4E443E', '#625650'])
                groups.setdefault(col, Part()).box(((x0 + x1) / 2, y0 + s / 2, 0.01), (x1 - x0 - 0.03, s - 0.03, 0.03))
            x += s
    for col, part in groups.items():
        m.add(part, col, rough=0.85, flat=True)
    for sx in (-1, 1):
        k = Part()
        k.box((sx * (hw + 0.1), 0, 0.07), (0.2, L, 0.16))
        m.add(k, '#6E6660', rough=0.8, flat=True)
        pw = W / 2 - hw - 0.2
        slabs = {}
        n = int(L / 0.9)
        for j in range(n):
            col = rnd.choice(['#6A5E54', '#645850', '#70645A', '#5E534C'])
            slabs.setdefault(col, Part()).box((sx * (hw + 0.2 + pw / 2), -L / 2 + (j + 0.5) * L / n, 0.075),
                                              (pw - 0.04, L / n - 0.04, 0.15))
        for col, part in slabs.items():
            m.add(part, col, rough=0.85, flat=True)
        # sodium street lamps on the kerb
        for j in range(2):
            ly = -L / 2 + (j + 0.5) * L / 2 + (3 if sx > 0 else -3)
            lp = Part()
            base = V((sx * (hw + 0.35), ly, 0.15))
            lp.capsule(base, base + V((0, 0, 4.6)), 0.06, 0.045, seg=8)
            lp.capsule(base + V((0, 0, 4.6)), base + V((-sx * 1.1, 0, 4.9)), 0.045, seg=8)
            m.add(lp, '#2A2A2C', rough=0.5, metal=0.6)
            hd = Part()
            hd.box(base + V((-sx * 1.2, 0, 4.85)), (0.45, 0.22, 0.12))
            m.add(hd, '#FFC070', rough=0.3, emit=0.9, flat=True)
            lights.append(dict(p=[base.x - sx * 1.2, ly, 4.3], r=9.0, c=[1.0 * 18, 0.62 * 18, 0.28 * 18]))
            colliders.append([base.x, ly, 0.15, 0.15])

    # ---------------- facades on both sides
    for sx in (-1, 1):
        face_x = sx * (W / 2)
        y = -L / 2
        while y < L / 2 - 1.0:
            bw = min(rnd.uniform(5.5, 8.5), L / 2 - y)
            floors = rnd.randint(3, 5)
            fh = 3.1
            height = 3.6 + floors * fh
            depth = 6.0
            col = rnd.choice(PLASTER)
            b = Part()
            b.box((face_x + sx * depth / 2, y + bw / 2, height / 2), (depth, bw - 0.08, height))
            m.add(b, col, rough=0.92, flat=True)
            colliders.append([face_x + (sx * depth / 2), y + bw / 2, depth / 2 + 0.05, bw / 2])
            # cornice and roof parapet
            c = Part()
            c.box((face_x - sx * 0.12, y + bw / 2, height + 0.15), (0.35, bw, 0.3))
            c.box((face_x - sx * 0.08, y + bw / 2, 3.55), (0.28, bw, 0.18))
            m.add(c, '#B09A80', rough=0.9, flat=True)
            # ground floor: a shop with a shutter, a signboard and a neon sign
            shop_w = bw - 1.2
            sh = Part()
            for k in range(int(shop_w / 0.12)):
                sh.box((face_x - sx * 0.03, y + 0.6 + k * 0.12 + 0.06, 1.35), (0.05, 0.1, 2.7))
            m.add(sh, '#3C3F44', rough=0.5, metal=0.6, flat=True)
            bd = Part()
            bd.box((face_x - sx * 0.06, y + bw / 2, 3.05), (0.08, shop_w, 0.7))
            m.add(bd, '#1A1420', rough=0.6, flat=True)
            hexc, lc = rnd.choice(NEON)
            ns = Part()
            L1 = shop_w * rnd.uniform(0.55, 0.8)
            ns.box((face_x - sx * 0.12, y + bw / 2, 3.1), (0.05, L1, 0.1))
            for k in range(rnd.randint(2, 4)):
                cx = y + bw / 2 - L1 / 2 + rnd.uniform(0.2, L1 - 0.2)
                ns.box((face_x - sx * 0.12, cx, 2.92), (0.05, rnd.uniform(0.15, 0.5), 0.08))
            m.add(ns, hexc, rough=0.3, emit=1.0, flat=True)
            lights.append(dict(p=[face_x - sx * 1.0, y + bw / 2, 2.6], r=7.5, c=[x * 16 for x in lc]))
            # an awning on some shops
            if rnd.random() < 0.5:
                aw = Part()
                awc = rnd.choice(['#8E2A22', '#2A5E6E', '#7A6A2A', '#5A2A5E'])
                p0 = V((face_x, y + 0.8, 2.75))
                n = V((-sx, 0, 0))
                for k in range(8):
                    yy = y + 0.8 + k * (shop_w - 0.4) / 8
                    q = Part()
                    aw.grid([[V((face_x, yy, 2.75)), V((face_x, yy + (shop_w - 0.4) / 8 - 0.02, 2.75))],
                             [V((face_x - sx * 1.2, yy, 2.35)), V((face_x - sx * 1.2, yy + (shop_w - 0.4) / 8 - 0.02, 2.35))]],
                            closed=False)
                m.add(aw, awc if k % 2 else awc, rough=0.9, solidify=0.02, flat=True, recalc=False)
            # upper floors: windows (some lit), balconies, AC units, laundry
            for f in range(floors):
                zc = 3.6 + f * fh + 1.5
                nwin = max(1, int(bw / 2.2))
                for k in range(nwin):
                    wy = y + (k + 0.5) * bw / nwin
                    lit = rnd.random() < 0.35
                    wn = Part()
                    wn.box((face_x - sx * 0.02, wy, zc), (0.06, 1.0, 1.4))
                    if lit:
                        m.add(wn, rnd.choice(['#FFB25E', '#FFC98A', '#FF9E5A']), rough=0.3, emit=0.35, flat=True)
                    else:
                        m.add(wn, '#15121A', rough=0.25, metal=0.2, flat=True)
                    fr = Part()
                    fr.box((face_x - sx * 0.05, wy, zc + 0.75), (0.12, 1.2, 0.12))
                    fr.box((face_x - sx * 0.05, wy, zc - 0.75), (0.12, 1.2, 0.12))
                    m.add(fr, '#B8A68C', rough=0.85, flat=True)
                    r = rnd.random()
                    if r < 0.45:
                        bc = Part()
                        bc.box((face_x - sx * 0.45, wy, zc - 0.78), (0.9, 1.5, 0.1))
                        for q in range(9):
                            bc.box((face_x - sx * 0.88, wy - 0.7 + q * 0.175, zc - 0.4), (0.03, 0.03, 0.75))
                        bc.box((face_x - sx * 0.88, wy, zc - 0.02), (0.05, 1.5, 0.05))
                        m.add(bc, '#3A3430', rough=0.6, metal=0.4, flat=True)
                        if rnd.random() < 0.4:
                            ld = Part()
                            for q in range(4):
                                ld.box((face_x - sx * 0.7, wy - 0.5 + q * 0.3, zc - 0.25), (0.02, 0.22, 0.4))
                            m.add(ld, rnd.choice(['#C8B8A0', '#8E2A22', '#2A4E7E', '#D8C8B0']), rough=0.95, flat=True)
                    elif r < 0.75:
                        ac = Part()
                        ac.box((face_x - sx * 0.25, wy + 0.8, zc - 0.9), (0.5, 0.7, 0.45))
                        m.add(ac, '#8C8E90', rough=0.5, metal=0.4, flat=True)
            # rooftop: satellite dishes and a water tank
            for k in range(rnd.randint(1, 3)):
                d = Part()
                dy = y + rnd.uniform(0.8, bw - 0.8)
                dc = V((face_x + sx * rnd.uniform(0.8, 3.0), dy, height + 0.7))
                d.sphere(dc, (0.02, 0.45, 0.45), seg=16)
                d.capsule(dc, dc - V((0, 0, 0.7)), 0.03, seg=6)
                m.add(d, '#9A9C9E', rough=0.4, metal=0.5, matrix=None)
            if rnd.random() < 0.5:
                wt = Part()
                wt.sloft([(V((face_x + sx * 2.5, y + bw / 2, height + zz)), V((1, 0, 0)), V((0, 1, 0)), 0.6, 0.6) for zz in (0.0, 1.2)], seg=12)
                m.add(wt, '#2E2E30', rough=0.6)
            y += bw

    # ---------------- strings of festival lights across the street
    for k in range(3):
        yy = -L / 2 + (k + 0.5) * L / 3 + rnd.uniform(-1, 1)
        pts = []
        for i in range(25):
            t = i / 24
            pts.append(V((-hw - 1.0 + (street + 2.0) * t, yy + 0.4 * math.sin(math.pi * t), 5.6 - 1.2 * math.sin(math.pi * t))))
        wire = Part()
        wire.sweep(pts, 0.01, seg=4)
        m.add(wire, '#1A1A1A', rough=0.7)
        bl = Part()
        for p in pts[1:-1]:
            bl.sphere(p - V((0, 0, 0.06)), 0.05, seg=6)
        m.add(bl, rnd.choice(['#FFB04A', '#FFD08A']), rough=0.3, emit=0.8)
        lights.append(dict(p=[0.0, yy, 4.6], r=8.0, c=[1.0 * 30, 0.7 * 30, 0.4 * 30]))

    # ---------------- props on the pavements
    for k in range(rnd.randint(3, 6)):
        sx = rnd.choice((-1, 1))
        px = sx * rnd.uniform(hw + 0.5, W / 2 - 0.5)
        py = rnd.uniform(-L / 2 + 1, L / 2 - 1)
        cr = Part()
        sz = rnd.uniform(0.5, 0.8)
        cr.box((px, py, sz / 2 + 0.15), (sz, sz, sz), Matrix.Rotation(rnd.uniform(0, 1), 4, 'Z'))
        m.add(cr, rnd.choice(['#6B4A2E', '#5A3E26', '#7A5A36']), rough=0.85, flat=True)
        colliders.append([px, py, sz / 2 + 0.05, sz / 2 + 0.05])
    return m, dict(size=[W, L], street=street, lights=lights, colliders=colliders)


def export(name, seed, mesh_dir, data_dir):
    m, meta = street_tile(name, seed)
    m.export('%s/%s.qmesh' % (mesh_dir, name), skinned=False, ao=True)
    with open('%s/%s.json' % (data_dir, name), 'w') as f:
        json.dump(meta, f, indent=1)
    return meta
