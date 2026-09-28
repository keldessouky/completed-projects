"""The Shadow: a runner of the Tunis medina's rooftops, who carried whatever was paid for from one side of the old
city to the other by night and never once touched the lanes. A short hooded burnous of indigo-black over a dark tunic,
a litham drawn over the face to the eyes, baggy sirwal gathered at the shin, wrapped forearms and soft boots, a red
sash with a curved dagger in a brass sheath, and a belt of pouches for the traps.

The dagger is curved, with a brass hilt; the quarterstaff is ash with iron shoes; a trap is a sprung iron ring with a
coil. Everything is placed relative to the rig's joints, so the same code fits any height.
"""
import math
import numpy as np
from mathutils import Vector as V

from qart.geom import Part, trees, hit_in, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import warrior, mercenary as mc

COL = dict(skin='#9A6A48', cloak='#3E4470', cloak2='#2A2E50', veil='#242838', tunic='#5A5668', pants='#46445A',
           wrap='#6A5A48', sash='#8A2A26', leather='#3E2C22', brass='#C89A45', steel='#A8AEB4', steel2='#6A6E74',
           wood='#8A6A44', iron='#3A3C40', copper='#B87333', eye='#2A1A10')


def skeleton():
    return rig.humanoid(height=1.74, shoulder=0.198, hip=0.104, arm_drop=54.0)


def build(J):
    m = Model('shadow', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    k = (T_('head').z - hd.z) / 0.24

    # ---------------- head and hands (the face is veiled; only the eyes and the hands show)
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.079, 0.093, 0.104 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.064, 0.068, 0.06 * k), seg=20)
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.056 * k, seg=14)
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        h.capsule(wr, wr + (ht - wr) * 0.9, 0.036, 0.03, seg=10)
    m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck', 'hand_L', 'hand_R'], sigma=0.06, voxel=0.006, smooth=3, tris=900)
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
    # the litham: from under the eyes down round the jaw and neck
    lt = Part()
    lt.grid([ring(z, 0, 360, 26, 0.008) for z in np.linspace(hc.z - 0.13 * k, hc.z - 0.005 * k, 5)], closed=True)
    m.add(lt, COL['veil'], rough=0.95, bones=['head', 'neck'], sigma=0.06, solidify=0.006, sol_offset=-1, recalc=False, tris=500)
    # the hood: round the head, open at the face, falling to the shoulders
    hood = Part()
    rows = [ring(z, -40, 220, 22, 0.018 + 0.01 * (hc.z + 0.12 * k - z)) for z in np.linspace(hc.z - 0.06 * k, hc.z + 0.1 * k, 5)]
    hood.grid(rows, closed=False, fan_top=hc + V((0, 0.02, 0.13 * k)))
    m.add(hood, COL['cloak'], rough=0.9, bones=['head', 'neck'], sigma=0.08, solidify=0.008, sol_offset=-1, recalc=False, tris=600)

    # ---------------- tunic, the short burnous over it, the sash
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.158, 0.118), (pel.z + 0.12, 0.004, 0.15, 0.112), (ch.z, 0.01, 0.172, 0.124),
             (ch.z + 0.1, 0.014, 0.192, 0.13), (sh_z - 0.02, 0.018, 0.192, 0.12), (nk.z - 0.01, 0.02, 0.112, 0.088)]
    tu = Part()
    tu.loft([(pel.z - 0.1, 0, 0.0, 0.17, 0.13)] + [(z, 0, cy, rx - 0.004, ry - 0.004) for z, cy, rx, ry in torso], seg=28, caps=True)
    for s in 'LR':
        tu.capsule(H('upperarm_' + s), H('forearm_' + s), 0.058, 0.05, seg=12)
    m.add(tu, COL['tunic'], rough=0.85, bones=['pelvis', 'spine', 'chest', 'upperarm_L', 'upperarm_R'], sigma=0.12, voxel=0.012,
          smooth=3, tris=700)
    bn = Part()   # the burnous: a hooded cape to mid-thigh, open at the front
    bn.loft([(pel.z - 0.3, 0, 0.03, 0.25, 0.19, 0.06), (pel.z - 0.1, 0, 0.025, 0.22, 0.17, 0.04),
             *[(z, 0, cy + 0.006, rx + 0.022, ry + 0.022) for z, cy, rx, ry in torso[2:]]], seg=32, a0=-60, a1=240, caps=False, folds=7)
    for s in 'LR':
        u = H('upperarm_' + s)
        bn.capsule(u, u + (H('forearm_' + s) - u) * 0.7, 0.075, 0.068, seg=12)
    m.add(bn, COL['cloak'], rough=0.9, bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R'],
          sigma=0.12, solidify=0.01, recalc=False, tris=1500)
    tr = Part()   # a dark border down the burnous' front edges
    for sx in (-1, 1):
        tr.sweep([V((sx * 0.12, -0.16, pel.z - 0.3)), V((sx * 0.11, -0.15, ch.z)), V((sx * 0.07, -0.1, nk.z))], (0.004, 0.018), seg=5,
                 hint=V((0, -1, 0)))
    m.add(tr, COL['cloak2'], rough=0.9, bones=['pelvis', 'spine', 'chest'], sigma=0.12)
    sa = Part()
    sa.loft([(pel.z - 0.02, 0, 0, 0.168, 0.125), (pel.z + 0.05, 0, 0.004, 0.166, 0.124)], seg=30, caps=False)
    sa.sweep([V((0.1, -0.12, pel.z)), V((0.13, -0.14, pel.z - 0.14)), V((0.12, -0.13, pel.z - 0.26))], (0.004, 0.035), seg=6,
             hint=V((0, -1, 0)))
    m.add(sa, COL['sash'], rough=0.9, bones=['pelvis'], solidify=0.008, recalc=False)

    # ---------------- sirwal gathered at the shin, wrapped forearms and shins, soft boots
    t = Part()
    t.sphere(pel + V((0, 0, -0.03)), (0.17, 0.13, 0.12), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.1, 0.085, seg=14)
        t.capsule(H('calf_' + s), H('calf_' + s).lerp(H('foot_' + s), 0.55), 0.08, 0.06, seg=14)
    m.add(t, COL['pants'], rough=0.9, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012, smooth=4,
          tris=800)
    wp = Part()
    for s in 'LR':
        e, w_ = H('forearm_' + s), H('hand_' + s)
        for f in np.linspace(0.3, 0.95, 5):
            c = e.lerp(w_, f)
            wp.sloft([(c + (w_ - e).normalized() * dz, V((1, 0, 0)), V((0, 1, 0)), 0.047, 0.047) for dz in (-0.012, 0.012)], seg=10)
        c0, c1 = H('calf_' + s).lerp(H('foot_' + s), 0.5), H('foot_' + s) + V((0, 0, 0.1))
        for f in np.linspace(0.0, 1.0, 5):
            c = c0.lerp(c1, f)
            wp.sloft([(c + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.056, 0.056) for dz in (-0.012, 0.012)], seg=10)
    m.add(wp, COL['wrap'], rough=0.9, bones=['forearm_L', 'forearm_R', 'calf_L', 'calf_R'], sigma=0.06)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)

    # ---------------- the dagger's brass sheath at the sash; pouches for the traps; a coil of cord
    sb = Part()
    c0 = V((-0.06, -0.15, pel.z + 0.02))
    sb.sweep([c0, c0 + V((-0.02, -0.02, -0.12)), c0 + V((0.03, -0.03, -0.22)), c0 + V((0.09, -0.02, -0.26))], (0.018, 0.012), seg=8)
    m.add(sb, COL['brass'], rough=0.3, metal=1.0, bones=['pelvis'], sigma=0.1)
    pu = Part()
    for a in (100, 140, 220, 260):
        r = math.radians(a)
        c = V((0.172 * math.cos(r), 0.13 * math.sin(r), pel.z - 0.04))
        pu.box(c, (0.07, 0.05, 0.08))
    m.add(pu, COL['leather'], rough=0.6, bones=['pelvis'], sigma=0.1, bevel=0.008)
    co = Part()
    co.sloft([(V((0.13, 0.1, pel.z + dz)), V((1, 0, 0)), V((0, 1, 0)), 0.06, 0.05) for dz in (-0.03, 0.03)], seg=14)
    m.add(co, COL['wrap'], rough=0.9, bones=['pelvis'], sigma=0.1)
    return m


def build_dagger():
    """Weapon frame: grip at the origin, the blade along +Z. A curved blade with a raised spine, a brass hilt that flares
    at the pommel, a wire-wrapped grip."""
    m = Model('dagger')
    b = Part()
    pts = [(z, 0.04 * (z / 0.3) ** 2) for z in np.linspace(0.07, 0.32, 8)]
    b.sloft([(V((x, 0, z)), V((1, 0, 0)), V((0, 1, 0)), w, 0.005) for (z, x), w in zip(pts, (0.022, 0.024, 0.024, 0.022, 0.018, 0.013, 0.008, 0.001))],
            seg=8, p=1.3)
    m.add(b, COL['steel'], rough=0.2, metal=1.0)
    g = Part()
    g.capsule(V((-0.04, 0, 0.065)), V((0.04, 0, 0.065)), 0.009, seg=6)
    g.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.8) for z, r in ((-0.1, 0.03), (-0.085, 0.024), (-0.06, 0.012))], seg=10)
    m.add(g, COL['brass'], rough=0.3, metal=1.0)
    gr = Part()
    gr.capsule(V((0, 0, -0.06)), V((0, 0, 0.06)), 0.012, seg=8)
    m.add(gr, COL['iron'], rough=0.5, metal=0.6)
    return m


def build_qstaff():
    """Weapon frame: held at the middle; the staff runs along Z both ways. Ash, with iron shoes at the ends and a
    leather wrap where the hands go."""
    m = Model('qstaff')
    s = Part()
    s.capsule(V((0, 0, -0.8)), V((0, 0, 0.8)), 0.017, seg=10)
    m.add(s, COL['wood'], rough=0.6)
    sh = Part()
    for z in (-0.8, 0.8):
        sh.capsule(V((0, 0, z * 0.92)), V((0, 0, z * 1.02)), 0.021, seg=10)
    m.add(sh, COL['iron'], rough=0.4, metal=0.9)
    w = Part()
    for z in (-0.25, 0.25):
        w.capsule(V((0, 0, z - 0.1)), V((0, 0, z + 0.1)), 0.021, seg=10)
    m.add(w, COL['leather'], rough=0.7)
    return m


def build_trap():
    """A trap on the ground: an iron ring of teeth on a spring, a copper coil in the middle, a small charm of blue glass."""
    m = Model('trap')
    r = Part()
    r.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for z, rr in ((0.01, 0.26), (0.04, 0.25))], seg=20)
    m.add(r, COL['iron'], rough=0.45, metal=0.9)
    t = Part()
    for k in range(12):
        a = TAU * k / 12
        c = V((math.cos(a) * 0.23, math.sin(a) * 0.23, 0.06))
        t.box(c, (0.03, 0.02, 0.06))
    m.add(t, COL['steel2'], rough=0.35, metal=0.9)
    c = Part()
    c.sweep([V((0.09 * math.cos(a), 0.09 * math.sin(a), 0.02 + 0.03 * a / TAU)) for a in np.linspace(0, 3 * TAU, 40)], 0.008, seg=5)
    m.add(c, COL['copper'], rough=0.3, metal=1.0)
    g = Part()
    g.sphere(V((0, 0, 0.12)), 0.03, seg=10)
    m.add(g, '#3A8AD8', rough=0.1, emit=0.8)
    return m


# ====================================================================== animation
# The Shadow moves as the Mercenary does (the same rig and hands), lower and quicker; a dagger held forward like a short
# sword. Two clips of its own: a lunging stab, and a staff whirled round the body.
def idle(P, t):
    mc.idle(P, t)
    warrior.stance_legs(P, t, crouch=0.35)
    P.rot['spine'] = eul(12, 0, 8)


def stab(P, t):
    # a lunge: the dagger driven forward at chest height, the back foot pushing off
    load = keys(t, [(0.0, 0.0), (0.14, 1.0)])
    go = keys(t, [(0.12, 0.0), (0.24, 1.0), (0.32, 1.0), (0.55, 0.0)])
    P.rot['pelvis'] = eul(0, 0, 10 * load - 20 * go)
    P.rot['spine'] = eul(8 + 14 * go, 0, 10 * load - 16 * go)
    warrior.stance_legs(P, t, crouch=0.3 + 0.4 * go)
    P.off['pelvis'] = V((0, -0.18 * go, 0))
    g = mc.GUARD_G.lerp(V((-0.28, 0.02, -0.12)), load).lerp(V((-0.05, -0.62, -0.05)), go)
    b = mc.GUARD_B.lerp(V((0.0, -1.0, 0.15)).normalized(), go).normalized()
    mc.hold_sword(P, mc.cs(P, g), b)
    mc.free_left(P, mc.cs(P, V((0.24, -0.1, -0.2)).lerp(V((0.3, 0.2, -0.1)), go)))


def spin(P, t):
    # the staff whirled round the body in a full turn, low; its ends pass through everything near
    u = keys(t, [(0.0, 0.0), (0.7, 1.0)], ease=lambda x: x * x * (3 - 2 * x))
    P.rot['root'] = eul(0, 0, -360 * u)
    warrior.stance_legs(P, t, crouch=0.5)
    P.rot['spine'] = eul(10, 0, 0)
    mc.hold_sword(P, mc.cs(P, V((0.0, -0.36, -0.12))), V((1.0, -0.1, 0.05)).normalized(), face=V((0, 0, 1)))
    mc.free_left(P, mc.cs(P, V((0.12, -0.34, -0.12))))


def throw(P, t):
    # a trap bowled underarm across the ground from the left hand
    back = keys(t, [(0.0, 0.0), (0.25, 1.0)])
    out = keys(t, [(0.25, 0.0), (0.42, 1.0), (0.55, 1.0), (0.8, 0.0)])
    P.rot['spine'] = eul(10 + 16 * out, 0, 15 * back - 20 * out)
    warrior.stance_legs(P, t, crouch=0.35 + 0.35 * out)
    mc.hold_sword(P, mc.cs(P, mc.GUARD_G), mc.GUARD_B)
    p = V((0.22, -0.16, -0.26)).lerp(V((0.3, 0.2, -0.45)), back).lerp(V((0.12, -0.55, -0.5)), out)
    mc.free_left(P, mc.cs(P, p), V((0.9, 0.3, -0.2)))


def cast(P, t):
    # the left palm thrust out, the black sand leaving it
    k_ = keys(t, [(0.0, 0.0), (0.3, 1.0), (0.5, 1.0), (0.8, 0.0)])
    P.rot['spine'] = eul(8 + 8 * k_, 0, -15 * k_)
    warrior.stance_legs(P, t, crouch=0.35)
    mc.hold_sword(P, mc.cs(P, mc.GUARD_G.lerp(V((-0.3, 0.05, -0.2)), k_)), mc.GUARD_B)
    mc.free_left(P, mc.cs(P, V((0.22, -0.16, -0.26)).lerp(V((0.05, -0.6, 0.05)), k_)), V((0.9, 0.3, -0.2)))


CLIPS = [
    Clip('idle', 2.4, idle, loop=True),
    Clip('run', 0.52, mc.run, loop=True),
    Clip('stab', 0.55, stab, events={'hit': 0.24}),
    Clip('swing', 0.6, mc.swing, events={'hit': 0.32}),
    Clip('combo', 1.12, mc.combo, events={'hit': 0.32, 'hit2': 0.8}),
    Clip('spin', 0.8, spin, events={'hit': 0.35}),
    Clip('slam', 0.86, mc.slam, events={'hit': 0.46}),
    Clip('throw', 0.8, throw, events={'hit': 0.42}),
    Clip('cast', 0.8, cast, events={'hit': 0.32}),
    Clip('cast_ground', 0.8, mc.cast_ground, events={'hit': 0.45}),
    Clip('warcry', 0.85, mc.warcry, events={'cry': 0.3}),
    Clip('dodge', 0.46, mc.dodge),
    Clip('hit', 0.3, mc.hit),
    Clip('death', 1.4, mc.death),
]
