"""Khan el-Khalili souq alleys: flagstones, stone shopfronts with pointed arches, warm shop interiors,
hanging brass lanterns, trays, spice sacks, khayamiya textiles, and mashrabiya balconies overhead."""
import json
import math
import random
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model

STONE = ['#8C7A62', '#806E58', '#94826A', '#7A6A56']
KHAYAMIYA = ['#B0302A', '#1F5E8A', '#D8A23A', '#2A7A5A', '#6A2A6E', '#D86A2A']
SPICE = ['#C8551E', '#D8A020', '#8A3A1A', '#6A7A2A', '#A0281E', '#E0C070']


def pointed_arch(cy, width, spring, rfrac=0.7, seg=10):
    """Mamluk two-centred pointed arch: (y, z) points from the left springing, over the apex, to the right."""
    r = width * rfrac
    cl = cy + (r - width / 2)
    ta = math.acos(max(-1.0, min(1.0, (cy - cl) / r)))
    left = [(cl + r * math.cos(t), spring + r * math.sin(t)) for t in [math.pi + (ta - math.pi) * k / seg for k in range(seg + 1)]]
    right = [(2 * cy - y, z) for y, z in reversed(left[:-1])]
    return left + right


def souq_tile(name, seed=1, W=11.0, L=24.0, alley=5.0):
    rnd = random.Random(seed)
    m = Model(name)
    m.verbose = False
    lights, colliders = [], []
    hw = alley / 2

    # ---------------- flagstones: irregular, darker and worn in the middle
    bed = Part()
    bed.box((0, 0, -0.03), (W, L, 0.06))
    m.add(bed, '#1A1614', rough=0.95, flat=True)
    groups = {}
    y = -L / 2
    while y < L / 2:
        h = rnd.uniform(0.45, 0.85)
        x = -W / 2
        while x < W / 2:
            w = rnd.uniform(0.5, 1.1)
            x1 = min(x + w, W / 2)
            mid = abs((x + x1) / 2) < hw
            col = rnd.choice(['#5E5248', '#564A42', '#62564C', '#4E443C'] if mid else ['#6A5E52', '#665A4E'])
            groups.setdefault(col, Part()).box(((x + x1) / 2, y + h / 2, 0.015), (x1 - x - 0.04, h - 0.04, 0.04))
            x = x1
        y += h
    for col, part in groups.items():
        m.add(part, col, rough=0.8, flat=True)

    # ---------------- shopfronts on both sides
    for sx in (-1, 1):
        face_x = sx * hw
        y = -L / 2
        while y < L / 2 - 0.5:
            bay = min(rnd.uniform(3.0, 4.2), L / 2 - y)
            stone = rnd.choice(STONE)
            height = rnd.uniform(7.5, 11.0)
            # pier + wall mass above the arch
            wall = Part()
            wall.box((face_x + sx * 1.6, y + bay / 2, height / 2), (3.2 - 0.02, bay - 0.02, height))
            m.add(wall, stone, rough=0.9, flat=True)
            # the arched shop opening: a warm-lit recess
            aw = bay - 0.9
            rec = Part()
            rec.box((face_x + sx * 1.5, y + bay / 2, 1.8), (0.1, aw, 3.6))
            m.add(rec, rnd.choice(['#FFB060', '#FFC47A', '#FF9E50']), rough=0.5, emit=0.12, flat=True)
            arch = pointed_arch(y + bay / 2, aw, 2.0, 0.7)
            ar = Part()
            ar.sweep([V((face_x - sx * 0.02, py, pz)) for py, pz in arch], 0.09, seg=6)
            for py, pz in (arch[0], arch[-1]):
                ar.box((face_x - sx * 0.02, py, pz / 2), (0.2, 0.2, pz))
            m.add(ar, '#B8A488', rough=0.85)
            # carved frieze band across the facade
            fz = Part()
            fz.box((face_x - sx * 0.04, y + bay / 2, 4.1), (0.12, bay, 0.35))
            m.add(fz, '#A89478', rough=0.85, flat=True)
            lights.append(dict(p=[face_x + sx * 0.6, y + bay / 2, 2.2], r=6.0, c=[1.0 * 9, 0.62 * 9, 0.3 * 9]))
            # goods at the shop mouth
            gy = y + bay / 2
            r = rnd.random()
            gx = face_x - sx * 0.55
            if r < 0.35:  # stacked brass trays
                tr = Part()
                for k in range(rnd.randint(3, 6)):
                    tr.sloft([(V((gx, gy + rnd.uniform(-0.6, 0.6), 0.1 + k * 0.06)), V((1, 0, 0)), V((0, 1, 0)), 0.35 - k * 0.02, 0.35 - k * 0.02),
                              (V((gx, gy, 0.14 + k * 0.06)), V((1, 0, 0)), V((0, 1, 0)), 0.33 - k * 0.02, 0.33 - k * 0.02)], seg=14)
                m.add(tr, '#C89A45', rough=0.3, metal=1.0)
            elif r < 0.7:  # spice sacks with heaped tops
                for k in range(rnd.randint(3, 5)):
                    sp = Part()
                    c = V((gx + rnd.uniform(-0.15, 0.15), gy - 0.9 + k * 0.45, 0.0))
                    sp.sloft([(c + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((0.0, 0.2), (0.45, 0.22), (0.5, 0.18))], seg=10)
                    m.add(sp, '#C8B090', rough=0.95)
                    hp = Part()
                    hp.sphere(c + V((0, 0, 0.5)), (0.18, 0.18, 0.1), seg=10)
                    m.add(hp, rnd.choice(SPICE), rough=0.95)
            else:  # a lantern seller's rack: glowing coloured fawanees
                lr = Part()
                lr.box((gx, gy, 1.2), (0.06, 1.6, 2.4))
                m.add(lr, '#2A2220', rough=0.7, flat=True)
                for k in range(8):
                    col = rnd.choice(['#FF6A3A', '#FFB04A', '#3AB0FF', '#FF3A8A', '#6AFF8A'])
                    fl = Part()
                    fp = V((gx - sx * 0.12, gy - 0.6 + (k % 4) * 0.4, 0.8 + (k // 4) * 0.8))
                    fl.sloft([(fp + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((-0.14, 0.02), (-0.08, 0.08), (0.08, 0.08), (0.16, 0.02))], seg=6)
                    m.add(fl, col, rough=0.3, emit=0.4)
                lights.append(dict(p=[gx - sx * 0.5, gy, 1.4], r=5.0, c=[1.0 * 10, 0.5 * 10, 0.5 * 10]))
            colliders.append([face_x - sx * 0.3 + sx * 0.0, gy, 0.35, bay / 2 - 0.2])
            colliders.append([face_x + sx * 1.6, y + bay / 2, 1.6, bay / 2])
            # khayamiya panels hanging beside the arch
            if rnd.random() < 0.6:
                kp = Part()
                kx = face_x - sx * 0.06
                ky = y + 0.25
                kp.box((kx, ky, 2.9), (0.03, 0.45, 1.3))
                m.add(kp, rnd.choice(KHAYAMIYA), rough=0.95, flat=True)
                kd = Part()
                for q in range(3):
                    kd.box((kx - sx * 0.02, ky, 2.5 + q * 0.4), (0.03, 0.32, 0.1))
                m.add(kd, rnd.choice(KHAYAMIYA), rough=0.95, flat=True)
            # mashrabiya balcony above some bays
            if rnd.random() < 0.55:
                mb = Part()
                bx = face_x - sx * 0.45
                mb.box((bx, y + bay / 2, 5.0), (0.9, bay - 1.0, 0.12))
                for q in range(int((bay - 1.0) / 0.12)):
                    for zq in range(12):
                        if (q + zq) % 2 == 0:
                            mb.box((bx - sx * 0.44, y + 0.55 + q * 0.12, 5.1 + zq * 0.12), (0.04, 0.05, 0.05))
                mb.box((bx - sx * 0.44, y + bay / 2, 5.1), (0.06, bay - 1.0, 0.06))
                mb.box((bx - sx * 0.44, y + bay / 2, 6.55), (0.06, bay - 1.0, 0.06))
                mb.box((bx, y + bay / 2, 6.62), (0.95, bay - 0.95, 0.1))
                m.add(mb, '#5A3A24', rough=0.8, flat=True)
                glow = Part()
                glow.box((bx + sx * 0.3, y + bay / 2, 5.8), (0.05, bay - 1.2, 1.2))
                m.add(glow, '#FFB060', rough=0.5, emit=0.25, flat=True)
            # a hanging brass lantern on a bracket over the alley
            if rnd.random() < 0.6:
                hl = Part()
                hb = V((face_x, y + bay / 2 + 0.6, 3.6))
                hl.capsule(hb, hb + V((-sx * 0.7, 0, 0)), 0.025, seg=5)
                hl.capsule(hb + V((-sx * 0.7, 0, 0)), hb + V((-sx * 0.7, 0, -0.35)), 0.012, seg=5)
                m.add(hl, '#2A2220', rough=0.6, metal=0.5)
                lb = Part()
                lc = hb + V((-sx * 0.7, 0, -0.55))
                lb.sloft([(lc + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for zz, rr in ((-0.25, 0.03), (-0.16, 0.14), (0.12, 0.14), (0.24, 0.03))], seg=8)
                m.add(lb, '#C89A45', rough=0.3, metal=1.0, emit=0.0)
                gl = Part()
                gl.sloft([(lc + V((0, 0, zz)), V((1, 0, 0)), V((0, 1, 0)), 0.11, 0.11) for zz in (-0.13, 0.1)], seg=8)
                m.add(gl, '#FFB04A', rough=0.2, emit=0.35)
                lights.append(dict(p=[lc.x, lc.y, lc.z], r=6.5, c=[1.0 * 16, 0.66 * 16, 0.32 * 16]))
            y += bay

    # ---------------- a stone arch spanning the alley at the north end (high, so it frames rather than hides)
    sa = Part()
    for sx in (-1, 1):
        sa.box((sx * (hw + 0.2), L / 2 - 0.4, 3.2), (0.5, 0.6, 6.4))
    arch = pointed_arch(0.0, alley + 0.4, 4.2, 0.6, seg=12)
    sa.sweep([V((py, L / 2 - 0.4, pz)) for py, pz in arch], 0.28, seg=6)
    m.add(sa, '#9A8870', rough=0.85)
    for sx in (-1, 1):
        colliders.append([sx * (hw + 0.2), L / 2 - 0.4, 0.3, 0.35])
    return m, dict(size=[W, L], street=alley, lights=lights, colliders=colliders)


def export(name, seed, mesh_dir, data_dir):
    m, meta = souq_tile(name, seed)
    m.export('%s/%s.qmesh' % (mesh_dir, name), skinned=False, ao=True)
    with open('%s/%s.json' % (data_dir, name), 'w') as f:
        json.dump(meta, f, indent=1)
    return meta
