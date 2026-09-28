"""The Wanderer: a courier of the long roads, who has carried letters between every city on al-Idrisi's map and knows a
little of every trade met on the way. A headwrap of sand-coloured cloth with a red border, wound round the head and over
the shoulders; a long travelling coat of undyed camel hair to the shin, open at the front over a pale tunic and belted
with leather; a satchel on a strap across the chest, where a small brass astrolabe hangs (the Pole is where the Wanderer
begins); a waterskin at the hip; wrapped shins and worn boots. The quarterstaff is the Shadow's ash staff.

The Wanderer moves on the Shadow's rig and clips: the staff whirled, a spell from the free hand, a warcry, a mark.
"""
import math
import numpy as np
from mathutils import Vector as V

from qart.geom import Part, trees, hit_in, TAU
from qart.model import Model
from qart import rig
from characters import warrior, shadow

COL = dict(skin='#A0704C', wrap='#CDBF9E', wrap2='#9A3A30', coat='#8A7658', coat2='#6E5C44', tunic='#D8CCB4', pants='#6A5E4C',
           leather='#5A3E28', brass='#C89A45', skin_bag='#7A5A3A', shin='#8A7A62', eye='#2A1A10', hair='#1E1812')


def skeleton():
    return rig.humanoid(height=1.76, shoulder=0.2, hip=0.105, arm_drop=54.0)


def build(J):
    m = Model('wanderer', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    k = (T_('head').z - hd.z) / 0.24

    # ---------------- head, face and hands; a short dark beard
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.079, 0.093, 0.104 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.064, 0.068, 0.06 * k), seg=20)
    h.sphere(hc + V((0, -0.092, -0.01)) * k, (0.014, 0.022, 0.03 * k), seg=10)   # the nose
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.056 * k, seg=14)
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        h.capsule(wr, wr + (ht - wr) * 0.9, 0.036, 0.03, seg=10)
    m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck', 'hand_L', 'hand_R'], sigma=0.06, voxel=0.006, smooth=3, tris=1000)
    bd = Part()
    bd.sphere(hc + V((0, -0.05, -0.085)) * k, (0.06, 0.05, 0.045 * k), seg=14)
    m.add(bd, COL['hair'], rough=0.9, bone='head', sigma=0.05)
    for sx in (-1, 1):
        e = Part()
        e.sphere(hc + V((sx * 0.031, -0.08, 0.018)) * k, (0.011 * k, 0.005 * k, 0.006 * k), seg=8)
        m.add(e, COL['eye'], rough=0.3, bone='head')
    th = trees(m.items[0]['ob'])

    def ring(z, a0, a1, n, off):
        row = []
        for j in range(n):
            a = math.radians(a0 + (a1 - a0) * j / (n - 1)) if a1 - a0 < 360 else TAU * j / n
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((hc.x, hc.y + 0.01, z)), d, 0.3)
            row.append(loc + d * off)
        return row
    # the headwrap: wound round the crown, open at the face, its tail falling over the shoulders
    hw = Part()
    rows = [ring(z, -50, 230, 24, 0.016 + 0.012 * (hc.z + 0.12 * k - z)) for z in np.linspace(hc.z - 0.07 * k, hc.z + 0.11 * k, 6)]
    hw.grid(rows, closed=False, fan_top=hc + V((0, 0.02, 0.135 * k)))
    m.add(hw, COL['wrap'], rough=0.95, bones=['head', 'neck'], sigma=0.08, solidify=0.009, sol_offset=-1, recalc=False, tris=700)
    bnd = Part()   # its red border band across the brow
    bnd.grid([ring(z, -50, 230, 24, 0.03) for z in (hc.z + 0.045 * k, hc.z + 0.07 * k)], closed=False)
    m.add(bnd, COL['wrap2'], rough=0.9, bones=['head'], sigma=0.06, solidify=0.006, sol_offset=-1, recalc=False)
    tl = Part()   # the tail over the left shoulder and down the back
    tl.sweep([hc + V((0.07, 0.05, -0.02)) * k, nk + V((0.12, 0.06, -0.02)), H('clavicle_L') + V((0.05, 0.1, -0.06)),
              ch + V((0.1, 0.13, -0.12))], (0.006, 0.07), seg=6, hint=V((0, 1, 0)))
    m.add(tl, COL['wrap'], rough=0.95, bones=['head', 'neck', 'chest'], sigma=0.12)

    # ---------------- the tunic, the long coat over it, the belt
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.16, 0.12), (pel.z + 0.12, 0.004, 0.152, 0.114), (ch.z, 0.01, 0.174, 0.126),
             (ch.z + 0.1, 0.014, 0.194, 0.132), (sh_z - 0.02, 0.018, 0.194, 0.122), (nk.z - 0.01, 0.02, 0.114, 0.09)]
    tu = Part()
    tu.loft([(pel.z - 0.12, 0, 0.0, 0.17, 0.13)] + [(z, 0, cy, rx - 0.004, ry - 0.004) for z, cy, rx, ry in torso], seg=28, caps=True)
    m.add(tu, COL['tunic'], rough=0.85, bones=['pelvis', 'spine', 'chest'], sigma=0.12, voxel=0.012, smooth=3, tris=700)
    calf = H('calf_L').z
    co = Part()   # the coat: to the shin, open at the front
    co.loft([(calf - 0.08, 0, 0.04, 0.28, 0.24, 0.07), (pel.z - 0.3, 0, 0.03, 0.25, 0.2, 0.05), (pel.z - 0.1, 0, 0.025, 0.22, 0.17, 0.04),
             *[(z, 0, cy + 0.006, rx + 0.024, ry + 0.024) for z, cy, rx, ry in torso[2:]]], seg=34, a0=-62, a1=242, caps=False, folds=8)
    for s in 'LR':
        co.capsule(H('upperarm_' + s), H('forearm_' + s).lerp(H('hand_' + s), 0.8), 0.07, 0.058, seg=12)
    m.add(co, COL['coat'], rough=0.95, bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                             'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R'], sigma=0.14, solidify=0.011, recalc=False,
          tris=1800)
    ed = Part()   # the coat's darker front edges and cuffs
    for sx in (-1, 1):
        ed.sweep([V((sx * 0.13, -0.19, calf - 0.08)), V((sx * 0.12, -0.16, pel.z - 0.1)), V((sx * 0.11, -0.15, ch.z)),
                  V((sx * 0.07, -0.1, nk.z))], (0.004, 0.02), seg=5, hint=V((0, -1, 0)))
    m.add(ed, COL['coat2'], rough=0.9, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R'], sigma=0.14)
    be = Part()
    be.loft([(pel.z + 0.03, 0, 0.0, 0.178, 0.132), (pel.z + 0.08, 0, 0.004, 0.176, 0.13)], seg=30, caps=False)
    m.add(be, COL['leather'], rough=0.6, bones=['pelvis'], solidify=0.008, recalc=False)

    # ---------------- the satchel strap across the chest, the satchel, the astrolabe on the strap, the waterskin
    st = Part()
    st.sweep([H('clavicle_R') + V((0.0, -0.1, 0.03)), ch + V((0.0, -0.15, 0.0)), pel + V((-0.14, -0.1, 0.02)),
              pel + V((-0.2, 0.0, -0.05))], (0.005, 0.03), seg=6, hint=V((0, -1, 0)))
    m.add(st, COL['leather'], rough=0.6, bones=['chest', 'spine', 'pelvis'], sigma=0.12)
    sb = Part()
    sb.box(pel + V((-0.21, 0.02, -0.12)), (0.06, 0.2, 0.17))
    m.add(sb, COL['leather'], rough=0.65, bones=['pelvis'], sigma=0.1, bevel=0.015)
    ab = Part()   # the astrolabe: a brass disc, its rete a ring and a pointer
    c = ch + V((0.0, -0.165, 0.04))
    ab.sloft([(c + V((0, dy, 0)), V((1, 0, 0)), V((0, 0, 1)), 0.05, 0.05) for dy in (-0.006, 0.006)], seg=18)
    ab.sweep([c + V((0.04 * math.cos(a), -0.009, 0.04 * math.sin(a))) for a in [TAU * j / 16 for j in range(17)]], 0.003, seg=4)
    ab.sweep([c + V((-0.035, -0.01, -0.02)), c + V((0.035, -0.01, 0.03))], 0.003, seg=4)
    m.add(ab, COL['brass'], rough=0.25, metal=1.0, bones=['chest'], sigma=0.1)
    ws = Part()
    ws.sphere(pel + V((0.2, -0.02, -0.14)), (0.06, 0.08, 0.1), seg=14)
    m.add(ws, COL['skin_bag'], rough=0.7, bones=['pelvis'], sigma=0.1)

    # ---------------- trousers, wrapped shins, boots
    t = Part()
    t.sphere(pel + V((0, 0, -0.03)), (0.17, 0.13, 0.12), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.098, 0.082, seg=14)
        t.capsule(H('calf_' + s), H('calf_' + s).lerp(H('foot_' + s), 0.55), 0.075, 0.058, seg=14)
    m.add(t, COL['pants'], rough=0.9, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012, smooth=4,
          tris=800)
    wp = Part()
    for s in 'LR':
        c0, c1 = H('calf_' + s).lerp(H('foot_' + s), 0.45), H('foot_' + s) + V((0, 0, 0.1))
        for f in np.linspace(0.0, 1.0, 5):
            cc = c0.lerp(c1, f)
            wp.sloft([(cc + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.058, 0.058) for dz in (-0.012, 0.012)], seg=10)
    m.add(wp, COL['shin'], rough=0.9, bones=['calf_L', 'calf_R'], sigma=0.06)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)
    return m


# the Shadow's clips fit the same rig: the staff whirled, the free hand's cast, the warcry, the dodge
CLIPS = shadow.CLIPS
