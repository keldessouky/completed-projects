"""Act V's own things, the Atlas and the Strait (GDD §9, brief §5: folklore only).

  qandisha   ʿAisha Qandisha of the Moroccan stories: a tall woman of the springs and rivers, beautiful to look at, who
             draws men to the water. Under her dress, the legs and hooves of a goat. A deep green dress to mid-calf, gold
             at the wrists and ears, black hair to the waist, eyes of amber light; she stands ankle-deep in spring water.

The Presser of Chefchaouen (Bu Ghettat, who sits on sleepers' chests) is the sand-wraith's shroud, dark as indigo; the
Smoke of the Stalls is the ifrit gone grey with smoke; the Bronze Mamluk of Bab al-Nasr is the Iron Mamluk in bronze.
"""
import math
import random
from mathutils import Vector as V

from qart.geom import Part, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import ghoul, ghoula, nile
from characters.jinn import _H, _frame, cast

QANDISHA = dict(skin='#B88A6A', dress='#1E5A3E', dress2='#2E7A52', hair='#0E0C10', eye='#FFB84A', gold='#D8A83A', fur='#4A3A2A',
                hoof='#1A1614', water='#2A6478', foam='#A8DCE8')


def qandisha_skeleton():
    return rig.humanoid(height=2.3, shoulder=0.18, hip=0.1, arm_drop=60.0, hunch=0.03, arm_len=1.08, leg_len=1.06)


def qandisha(J):
    rnd = random.Random(11)
    m = Model('qandisha', J)
    H, T_ = _H(J)
    pel, ch, nk = H('pelvis'), H('chest'), H('neck')
    h0, h1 = H('head'), T_('head')
    k = (h1.z - h0.z) / 0.24
    hc = h0 + V((0, 0.0, 0.105 * k))
    b = Part()   # a fine face, long arms, long hands
    b.sphere(hc, (0.076 * k, 0.089 * k, 0.108 * k), seg=22)
    b.sphere(hc + V((0, -0.03, -0.07)) * k, (0.056 * k, 0.06 * k, 0.05 * k), seg=16)
    b.capsule(nk + V((0, 0.01, -0.03)), hc + V((0, 0, -0.08)) * k, 0.046 * k, seg=12)
    for s_ in 'LR':
        b.capsule(H('upperarm_' + s_), H('forearm_' + s_), 0.042, 0.036, seg=10)
        b.capsule(H('forearm_' + s_), H('hand_' + s_), 0.034, 0.026, seg=10)
        wr, ht = H('hand_' + s_), T_('hand_' + s_)
        d, u, v = _frame(wr, ht)
        for f in range(4):
            bb = wr + v * ((f - 1.5) * 0.016)
            b.capsule(bb, bb + d * 0.15 + u * 0.01, 0.009, 0.004, seg=5)
    m.add(b, QANDISHA['skin'], rough=0.35, bones=['head', 'neck', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'],
          sigma=0.06, voxel=0.007, smooth=3, tris=1200)
    for s_ in (-1, 1):
        e = Part()
        e.sphere(hc + V((s_ * 0.028, -0.079, 0.016)) * k, (0.013 * k, 0.005 * k, 0.007 * k), seg=8)
        m.add(e, QANDISHA['eye'], rough=0.3, emit=1.2, bone='head')
    # the dress: fitted at the chest, falling to mid-calf, a border of lighter green at the hem
    sh_z = H('upperarm_L').z
    calf = H('calf_L').z
    g = Part()
    g.loft([(nk.z - 0.02, 0, 0.01, 0.08, 0.07, 0.0), (sh_z - 0.03, 0, 0.012, 0.17, 0.11, 0.0), (ch.z + 0.05, 0, 0.012, 0.15, 0.11, 0.01),
            (pel.z + 0.1, 0, 0.01, 0.14, 0.11, 0.015), (pel.z - 0.25, 0, 0.02, 0.2, 0.16, 0.03), (calf + 0.02, 0, 0.03, 0.26, 0.22, 0.05)],
           seg=34, caps=False, folds=6, phase=0.2)
    m.add(g, QANDISHA['dress'], rough=0.45, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R'], sigma=0.2, solidify=0.01, recalc=False,
          tris=1500)
    hm = Part()
    hm.loft([(calf + 0.02, 0, 0.03, 0.262, 0.222), (calf + 0.08, 0, 0.03, 0.255, 0.215)], seg=34, caps=False)
    m.add(hm, QANDISHA['dress2'], rough=0.45, bones=['thigh_L', 'thigh_R'], sigma=0.2, solidify=0.008, recalc=False)
    for s_ in 'LR':   # sleeves to the wrist, a gold band at each
        sl = Part()
        sl.capsule(H('upperarm_' + s_), H('forearm_' + s_).lerp(H('hand_' + s_), 0.85), 0.052, 0.046, seg=12)
        m.add(sl, QANDISHA['dress'], rough=0.45, bones=['upperarm_' + s_, 'forearm_' + s_, 'clavicle_' + s_], sigma=0.06, solidify=0.006,
              recalc=False)
        gb = Part()
        c = H('forearm_' + s_).lerp(H('hand_' + s_), 0.9)
        gb.sloft([(c + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.05, 0.05) for dz in (-0.015, 0.015)], seg=12)
        m.add(gb, QANDISHA['gold'], rough=0.25, metal=1.0, bones=['forearm_' + s_], sigma=0.05)
    # below the hem: a goat's legs, the knee bent back, shaggy, and cloven hooves
    gl = Part()
    for s_ in 'LR':
        kn, ft = H('calf_' + s_), H('foot_' + s_)
        hock = kn.lerp(ft, 0.5) + V((0, 0.12, 0))
        gl.capsule(kn + V((0, 0, -0.02)), hock, 0.06, 0.045, seg=10)
        gl.capsule(hock, ft + V((0, -0.02, 0.06)), 0.045, 0.034, seg=10)
    m.add(gl, QANDISHA['fur'], rough=0.95, bones=['calf_L', 'calf_R', 'foot_L', 'foot_R'], sigma=0.06, voxel=0.008, smooth=2, tris=700)
    hf = Part()
    for s_ in 'LR':
        ft = H('foot_' + s_)
        for sx in (-1, 1):
            hf.sphere(ft + V((sx * 0.022, -0.05, 0.03)), (0.024, 0.045, 0.035), seg=8)
    m.add(hf, QANDISHA['hoof'], rough=0.3, bones=['foot_L', 'foot_R'], sigma=0.05)
    # the hair: black, to the waist; gold rings at the ears
    hair = Part()
    for f in range(18):
        a = math.pi * (-0.05 + 1.1 * f / 17)
        root = hc + V((0.075 * k * math.cos(a), 0.02 + 0.05 * math.sin(a), 0.07 * k))
        L = rnd.uniform(0.7, 0.9)
        pts = [root]
        for i in range(1, 6):
            pts.append(root + V((0.06 * math.cos(a) * i / 5 + 0.015 * math.sin(i + f), 0.06 + 0.02 * i, -L * i / 5)))
        hair.sweep(pts, lambda t: (0.006, 0.035 * (1 - 0.5 * t)), seg=4, hint=V((math.cos(a), 0.5, 0)))
    m.add(hair, QANDISHA['hair'], rough=0.3, metal=0.1, bones=['head', 'neck', 'chest', 'spine'], sigma=0.2)
    er = Part()
    for s_ in (-1, 1):
        c = hc + V((s_ * 0.078, 0.0, -0.03)) * k
        er.sweep([c + V((0, 0.02 * math.cos(a), -0.03 - 0.02 * math.sin(a))) for a in [TAU * j / 10 for j in range(11)]], 0.004, seg=4)
    m.add(er, QANDISHA['gold'], rough=0.25, metal=1.0, bone='head')
    # where she stands: spring water, a ring of foam
    w = Part()
    w.loft([(0.02, 0, 0.05, 0.62, 0.58), (0.05, 0, 0.05, 0.5, 0.46)], seg=24, caps=True)
    m.add(w, QANDISHA['water'], rough=0.06, metal=0.45, bones=['pelvis', 'calf_L', 'calf_R'], sigma=0.4)
    fo = Part()
    for f in range(16):
        a = TAU * f / 16
        fo.sphere(V((0.58 * math.cos(a), 0.05 + 0.54 * math.sin(a), 0.06)), (0.07, 0.07, 0.03), seg=6)
    m.add(fo, QANDISHA['foam'], rough=0.4, emit=0.25, bones=['pelvis', 'calf_L', 'calf_R'], sigma=0.4)
    return m


def qandisha_death(P, t):
    nile.naddaha_idle(P, t)
    k = keys(t, [(0.0, 0.0), (1.2, 1.0)], ease=lambda u: u * u)
    P.off['root'] = V((0, 0, -2.4 * k))   # she goes down into the spring, standing, as the stories say she came
    P.rot['head'] = eul(-20 * k, 0, 0)


QANDISHA_CLIPS = [
    Clip('idle', 2.4, nile.naddaha_idle, loop=True),
    Clip('run', 0.8, nile.naddaha_run, loop=True),
    Clip('combo', 1.3, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, nile.naddaha_call, events={'hit': 1.0}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('leap', 1.2, ghoula.leap, events={'hit': 0.8}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.6, qandisha_death),
]

CREATURES = [
    ('qandisha', qandisha_skeleton, qandisha, QANDISHA_CLIPS),
]
STATICS = []
