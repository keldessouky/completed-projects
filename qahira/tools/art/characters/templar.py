"""The Templar: an officer of Cairo's old Khedivial fire brigade, who kept the city's signal fires lit when the rest of
the brigade was gone. A brass fireman's helmet with a comb crest and a leather neck curtain, a long double-breasted
coat of dark blue wool to the knee with two rows of brass buttons and red collar tabs, a broad belt with a brass
buckle and a signal lantern hanging from it, leather gauntlets, dark trousers and boots, and a heavy moustache.

His weapons: a sceptre that is a brass signal lantern on an iron staff, and a flanged iron mace. His totem is a signal
brazier on an iron tripod. Nothing he wears or carries is a religious sign. Everything is placed relative to the rig's
joints, so the same code fits any height.
"""
import math
import numpy as np
from mathutils import Vector as V

from qart.geom import Part, trees, hit_in, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import warrior, mercenary as mc

COL = dict(skin='#8A5A3E', hair='#1A1410', coat='#2C3448', coat2='#222838', collar='#8A2A26', brass='#C89A45',
           leather='#4A3424', glove='#3A2A20', pants='#26282E', iron='#3A3C40', steel='#8A8E94', wood='#6A4A30',
           glass='#FFB050', coal='#FF7A2A', eye='#2A1A10')


def skeleton():
    return rig.humanoid(height=1.86, shoulder=0.212, hip=0.108, arm_drop=56.0)


def build(J):
    m = Model('templar', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    k = (T_('head').z - hd.z) / 0.24

    # ---------------- head with a heavy moustache; hands inside gauntlets below
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.084, 0.098, 0.108 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.072, 0.076, 0.066 * k), seg=20)
    h.capsule(hc + V((0, -0.09, 0.0)) * k, hc + V((0, -0.1, -0.03)) * k, 0.01 * k, 0.014 * k, seg=8)
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.064 * k, seg=14)
    m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck'], sigma=0.06, voxel=0.006, smooth=3, tris=900)
    for sx in (-1, 1):
        e = Part()
        e.sphere(hc + V((sx * 0.032, -0.084, 0.018)) * k, (0.011 * k, 0.005 * k, 0.006 * k), seg=8)
        m.add(e, COL['eye'], rough=0.3, bone='head')
    ms = Part()   # the moustache, full and turned down at the ends
    mo = hc + V((0, -0.1, -0.035)) * k
    for sx in (-1, 1):
        ms.sweep([mo + V((sx * 0.004, 0, 0)), mo + V((sx * 0.03, 0.004, -0.004)) * k, mo + V((sx * 0.048, 0.012, -0.022)) * k],
                 (0.011 * k, 0.008 * k), seg=6)
    m.add(ms, COL['hair'], rough=0.9, bone='head')

    # ---------------- the brass helmet: a dome, a brim, a comb crest front to back, a leather neck curtain
    he = Part()
    top = hc + V((0, 0.004, 0.02 * k))
    he.loft([(top.z + dz, 0, top.y, rx, ry) for dz, rx, ry in ((0.0, 0.1, 0.114), (0.05, 0.094, 0.108), (0.09, 0.076, 0.088),
                                                               (0.115, 0.048, 0.058), (0.128, 0.012, 0.014))], seg=28, caps=True)
    m.add(he, COL['brass'], rough=0.25, metal=1.0, bone='head')
    br = Part()   # the brim, wider at the back
    br.loft([(top.z - 0.004, 0, top.y + 0.012, 0.118, 0.14), (top.z + 0.008, 0, top.y + 0.01, 0.112, 0.132)], seg=28, caps=True)
    m.add(br, COL['brass'], rough=0.3, metal=1.0, bone='head')
    cr = Part()
    cr.sweep([V((0, top.y - 0.1, top.z + 0.05)), V((0, top.y - 0.06, top.z + 0.13)), V((0, top.y + 0.02, top.z + 0.16)),
              V((0, top.y + 0.1, top.z + 0.1)), V((0, top.y + 0.13, top.z + 0.02))], (0.008, 0.024), seg=6, hint=V((1, 0, 0)))
    m.add(cr, COL['brass'], rough=0.2, metal=1.0, bone='head')
    nc = Part()
    nc.loft([(top.z - 0.14, 0, top.y + 0.03, 0.11, 0.12), (top.z - 0.004, 0, top.y + 0.02, 0.112, 0.128)], seg=24, a0=20, a1=160,
            caps=False)
    m.add(nc, COL['leather'], rough=0.7, bones=['head', 'neck'], solidify=0.006, recalc=False)

    # ---------------- the long coat: double-breasted, to the knee, brass buttons, red collar tabs; the belt
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.17, 0.126), (pel.z + 0.12, 0.004, 0.162, 0.122), (ch.z, 0.01, 0.186, 0.134),
             (ch.z + 0.1, 0.014, 0.21, 0.142), (sh_z - 0.02, 0.018, 0.21, 0.13), (nk.z - 0.01, 0.02, 0.122, 0.094)]
    co = Part()
    knee = H('calf_L').z + 0.04
    co.loft([(knee, 0, 0.02, 0.25, 0.2), (pel.z - 0.14, 0, 0.01, 0.22, 0.17), *[(z, 0, cy, rx + 0.016, ry + 0.016) for z, cy, rx, ry in torso]],
            seg=36, caps=False, folds=5)
    for s in 'LR':
        u, e, w_ = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s)
        co.capsule(u, e, 0.076, 0.066, seg=14)
        co.capsule(e, e + (w_ - e) * 0.82, 0.066, 0.058, seg=14)
    m.add(co, COL['coat'], rough=0.85, bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                               'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R'], sigma=0.12, solidify=0.012, recalc=False,
          tris=1800)
    qt = Part()   # the quilting: horizontal seams across the skirts
    for z in np.linspace(knee + 0.06, pel.z - 0.16, 4):
        f = (z - knee) / max(1e-3, pel.z - 0.14 - knee)
        rx, ry = 0.25 + (0.22 - 0.25) * f + 0.004, 0.2 + (0.17 - 0.2) * f + 0.004
        qt.loft([(z - 0.004, 0, 0.02, rx, ry), (z + 0.004, 0, 0.02, rx, ry)], seg=36, caps=False)
    m.add(qt, COL['coat2'], rough=0.85, bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.12)
    bt = Part()
    for sx in (-1, 1):
        for z in np.linspace(pel.z + 0.06, sh_z - 0.08, 5):
            bt.sphere(V((sx * 0.065, -0.155 - 0.01 * (z > ch.z), z)), 0.013, seg=8)
    m.add(bt, COL['brass'], rough=0.25, metal=1.0, bones=['spine', 'chest'], sigma=0.12)
    cl = Part()   # the standing collar, with red tabs
    cl.loft([(nk.z - 0.03, 0, 0.02, 0.1, 0.09), (nk.z + 0.03, 0, 0.02, 0.092, 0.085)], seg=24, caps=False)
    m.add(cl, COL['coat'], rough=0.8, bones=['neck', 'chest'], solidify=0.008, recalc=False)
    tb = Part()
    for sx in (-1, 1):
        tb.box(V((sx * 0.06, -0.075, nk.z)), (0.035, 0.012, 0.04))
    m.add(tb, COL['collar'], rough=0.8, bone='neck')
    bl = Part()
    bl.loft([(pel.z + 0.02, 0, 0, 0.19, 0.145), (pel.z + 0.075, 0, 0, 0.19, 0.145)], seg=32, caps=False)
    m.add(bl, COL['leather'], rough=0.55, bone='pelvis', solidify=0.01, recalc=False)
    bk = Part()
    bk.box(V((0, -0.15, pel.z + 0.048)), (0.07, 0.014, 0.06))
    m.add(bk, COL['brass'], rough=0.25, metal=1.0, bone='pelvis')
    ln = Part()   # the signal lantern at the right hip
    lc = V((-0.2, -0.04, pel.z - 0.12))
    ln.sloft([(lc + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), r, r) for dz, r in ((-0.07, 0.045), (0.05, 0.045))], seg=12)
    ln.capsule(lc + V((0, 0, 0.06)), lc + V((0, 0, 0.12)), 0.01, seg=6)
    m.add(ln, COL['brass'], rough=0.3, metal=1.0, bones=['pelvis'], sigma=0.1)
    lg = Part()
    lg.sphere(lc, (0.035, 0.035, 0.05), seg=10)
    m.add(lg, COL['glass'], rough=0.2, emit=1.2, bones=['pelvis'], sigma=0.1)

    # ---------------- gauntlets, trousers, boots
    gl = Part()
    for s in 'LR':
        e, w_, ht = H('forearm_' + s), H('hand_' + s), T_('hand_' + s)
        gl.capsule(e + (w_ - e) * 0.7, w_, 0.058, 0.046, seg=10)
        gl.capsule(w_, w_ + (ht - w_) * 0.9, 0.044, 0.038, seg=10)
    m.add(gl, COL['glove'], rough=0.6, bones=['forearm_L', 'forearm_R', 'hand_L', 'hand_R'], sigma=0.05, voxel=0.006, smooth=2, tris=500)
    t = Part()
    t.sphere(pel + V((0, 0, -0.01)), (0.168, 0.124, 0.11), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.094, 0.074, seg=14)
        t.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.14)), 0.072, 0.062, seg=14)
    m.add(t, COL['pants'], rough=0.85, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012, smooth=4,
          tris=700)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)
    return m


def build_sceptre():
    """Weapon frame: grip at the origin, the head along +Z. An iron staff with a leather grip, and at its head a brass
    signal lantern: a base, four bars round a glowing glass, a pierced cap and a ring to hang it by."""
    m = Model('sceptre')
    s = Part()
    s.capsule(V((0, 0, -0.12)), V((0, 0, 0.52)), 0.015, seg=8)
    m.add(s, COL['iron'], rough=0.45, metal=0.8)
    g = Part()
    g.capsule(V((0, 0, -0.1)), V((0, 0, 0.06)), 0.02, seg=8)
    m.add(g, COL['leather'], rough=0.7)
    b = Part()
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.52, 0.03), (0.56, 0.055), (0.58, 0.055))], seg=12)
    for a in range(4):
        c = V((math.cos(TAU * a / 4 + 0.4) * 0.05, math.sin(TAU * a / 4 + 0.4) * 0.05, 0))
        b.capsule(c + V((0, 0, 0.58)), c + V((0, 0, 0.72)), 0.006, seg=5)
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.72, 0.058), (0.75, 0.05), (0.8, 0.02))], seg=12)
    b.sweep([V((0.015 * math.cos(a), 0, 0.82 + 0.015 * math.sin(a))) for a in np.linspace(0, TAU, 12)], 0.004, seg=4)
    m.add(b, COL['brass'], rough=0.25, metal=1.0)
    l = Part()
    l.sphere(V((0, 0, 0.65)), (0.04, 0.04, 0.06), seg=12)
    m.add(l, COL['glass'], rough=0.2, emit=1.5)
    return m


def build_mace():
    """Weapon frame: grip at the origin, the head along +Z. A wooden haft bound with iron, and a head of six flanges."""
    m = Model('mace')
    s = Part()
    s.capsule(V((0, 0, -0.1)), V((0, 0, 0.48)), 0.017, seg=8)
    m.add(s, COL['wood'], rough=0.6)
    h = Part()
    h.sphere(V((0, 0, 0.5)), (0.04, 0.04, 0.07), seg=12)
    for a in range(6):
        d = V((math.cos(TAU * a / 6), math.sin(TAU * a / 6), 0))
        h.box(V((0, 0, 0.5)) + d * 0.05, (0.07 if abs(d.x) > 0.5 else 0.012, 0.012 if abs(d.x) > 0.5 else 0.07, 0.13))
    h.capsule(V((0, 0, 0.56)), V((0, 0, 0.61)), 0.018, 0.006, seg=8)
    h.capsule(V((0, 0, -0.1)), V((0, 0, -0.07)), 0.024, seg=8)
    m.add(h, COL['iron'], rough=0.4, metal=0.9)
    return m


def build_totem():
    """The signal brazier planted as a totem: an iron tripod, a brass bowl heaped with glowing coals, and a tall iron
    pole above it with a signal lantern at the top."""
    m = Model('totem')
    t = Part()
    for a in range(3):
        d = V((math.cos(TAU * a / 3), math.sin(TAU * a / 3), 0))
        t.capsule(d * 0.34, V((0, 0, 0.72)) + d * 0.1, 0.022, 0.018, seg=6)
    t.capsule(V((0, 0, 0.72)), V((0, 0, 1.7)), 0.02, seg=8)
    t.sweep([V((0.12 * math.cos(a), 0.12 * math.sin(a), 0.38)) for a in np.linspace(0, TAU, 16)], 0.01, seg=4, closed=True)
    m.add(t, COL['iron'], rough=0.45, metal=0.85)
    b = Part()
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.72, 0.12), (0.8, 0.26), (0.86, 0.3))], seg=20)
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((1.62, 0.05), (1.66, 0.08), (1.82, 0.08), (1.88, 0.03))], seg=12)
    m.add(b, COL['brass'], rough=0.3, metal=1.0)
    c = Part()
    for i in range(9):
        a = TAU * i / 9
        c.sphere(V((math.cos(a) * 0.14, math.sin(a) * 0.14, 0.88)), (0.07, 0.06, 0.05), seg=8)
    c.sphere(V((0, 0, 0.9)), (0.12, 0.12, 0.07), seg=10)
    m.add(c, COL['coal'], rough=0.8, emit=1.6)
    g = Part()
    g.sphere(V((0, 0, 1.74)), (0.055, 0.055, 0.07), seg=10)
    m.add(g, COL['glass'], rough=0.2, emit=1.5)
    return m


# ====================================================================== animation
# The Templar moves as the Mercenary does (the same rig and hands), heavier; the sceptre held like a short sword. Two
# clips of his own: planting the brazier (both hands driving the pole down), and raising the lantern for the aura.
def idle(P, t):
    mc.idle(P, t)
    P.rot['spine'] = eul(4, 0, 4)


def plant(P, t):
    # the brazier's pole driven into the ground with both hands
    up = keys(t, [(0.0, 0.0), (0.25, 1.0)])
    down = keys(t, [(0.25, 0.0), (0.45, 1.0), (0.7, 1.0), (0.95, 0.0)])
    P.rot['spine'] = eul(6 + 26 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.3 + 0.5 * down)
    g = V((-0.1, -0.35, 0.05)).lerp(V((-0.05, -0.5, -0.5)), down)
    mc.hold_sword(P, mc.cs(P, g.lerp(V((-0.15, -0.25, 0.2)), up * (1 - down))), V((0.0, -0.3, -1.0)).normalized())
    mc.free_left(P, mc.cs(P, g + V((0.12, 0, 0.05))))


def raise_(P, t):
    # the lantern-sceptre lifted high, its light spreading
    k_ = keys(t, [(0.0, 0.0), (0.35, 1.0), (0.6, 1.0), (0.9, 0.0)])
    P.rot['spine'] = eul(-6 * k_, 0, 0)
    warrior.stance_legs(P, t, crouch=0.2)
    mc.hold_sword(P, mc.cs(P, mc.GUARD_G.lerp(V((-0.12, -0.2, 0.55)), k_)), mc.GUARD_B.lerp(V((0, 0, 1)), k_).normalized())
    mc.free_left(P, mc.cs(P, V((0.26, -0.12, -0.22)).lerp(V((0.3, -0.25, 0.1)), k_)))


CLIPS = [
    Clip('idle', 2.6, idle, loop=True),
    Clip('run', 0.56, mc.run, loop=True),
    Clip('swing', 0.62, mc.swing, events={'hit': 0.33}),
    Clip('combo', 1.14, mc.combo, events={'hit': 0.32, 'hit2': 0.8}),
    Clip('slam', 0.9, mc.slam, events={'hit': 0.48}),
    Clip('plant', 0.95, plant, events={'hit': 0.45}),
    Clip('raise', 0.9, raise_, events={'hit': 0.35}),
    Clip('cast', 0.8, mc.cast, events={'hit': 0.32}),
    Clip('cast_ground', 0.8, mc.cast_ground, events={'hit': 0.45}),
    Clip('warcry', 0.85, mc.warcry, events={'cry': 0.3}),
    Clip('throw', 0.8, mc.throw, events={'hit': 0.42}),
    Clip('dodge', 0.48, mc.dodge),
    Clip('hit', 0.3, mc.hit),
    Clip('death', 1.4, mc.death),
]
