"""Act I's folk creatures on the shared rig (GDD §9, brief §5: folklore only).

  cable    the Cable Jinn: a tangle of the city's black wiring that has stood up, sparking at the joints
  silah    the Si'lah: a tall shape-shifter under a borrowed face, too many joints in its fingers
  nasnas   the Nasnas: half a man, split down the middle, hopping on its one leg
  qutrub   the Qutrub: a grave wolf, a ghoul gone to the dogs
  ifrit    the Ifrit of Bab Zuweila: fire from the waist up, smoke from the waist down

and the possessed things of Wust el-Balad, which are static meshes (the game sways and lights them):
  dish     a rooftop satellite dish that looks at you
  microbus the white-and-blue Cairo microbus that circles the square with no driver

Clips reuse the ghoul set (game/world.cpp picks clips by name, and falls back when one is missing).
"""
import math
import random
from mathutils import Vector as V, Matrix

from qart.geom import Part, basis, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import ghoul, ghoula


def _H(J):
    return (lambda b: J[b][0]), (lambda b: J[b][1])


def _frame(a, b):
    d = (b - a).normalized()
    u, v, w = basis(d, V((0, 0, 1)) if abs(d.z) < 0.9 else V((1, 0, 0)))
    return d, u, v


# ---------------------------------------------------------------- shared clips
def cast(P, t):
    ghoul.base_pose(P, t)
    up = keys(t, [(0.0, 0.0), (0.45, 1.0)])
    thrust = keys(t, [(0.5, 0.0), (0.62, 1.0), (0.85, 1.0), (1.1, 0.0)])
    P.rot['spine'] = eul(-20 * up + 30 * thrust, 0, 0)
    P.rot['chest'] = eul(-10 * up + 10 * thrust, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-40 - 110 * up + 60 * thrust, 0, sg * (30 * up - 20 * thrust))
        P.rot['forearm_' + s] = eul(-40 * up + 30 * thrust, 0, 0)


def float_idle(P, t):
    P.off['root'] = V((0, 0, 0.12 + 0.06 * math.sin(t / 2.4 * TAU)))
    P.rot['spine'] = eul(cyc(t, 2.4, 3), 0, cyc(t, 3.6, 3))
    P.rot['chest'] = eul(cyc(t, 2.4, 3, 0.4), 0, 0)
    P.rot['head'] = eul(-8 + cyc(t, 2.0, 4), 0, cyc(t, 4.8, 10))
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-10 + cyc(t, 2.4, 6, sg), 0, sg * 8)
        P.rot['forearm_' + s] = eul(-35, 0, 0)
        P.rot['thigh_' + s] = eul(-10, 0, 0)
        P.rot['calf_' + s] = eul(25, 0, 0)


def float_run(P, t):
    float_idle(P, t)
    P.rot['spine'] = eul(22, 0, cyc(t, 0.8, 5))
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(20 + cyc(t, 0.8, 10, sg), 0, sg * 20)


# ================================================================ the Cable Jinn
CABLE = dict(black='#1A1A1E', black2='#26262C', red='#8E2A22', yellow='#B8962C', blue='#2C4A7A', copper='#C07A40',
             spark='#8CE0FF', tape='#303036')


def cable_skeleton():
    return rig.humanoid(height=1.95, shoulder=0.2, hip=0.1, arm_drop=64.0, hunch=0.35, arm_len=1.22, leg_len=1.0)


def _strands(part, a, b, r, n, twist, rnd, thick=0.016, seg=5):
    d, u, v = _frame(a, b)
    L = (b - a).length
    steps = max(4, int(L / 0.06))
    for k in range(n):
        ph = TAU * k / n + rnd.uniform(-0.3, 0.3)
        rr = r * rnd.uniform(0.7, 1.1)
        pts = []
        for i in range(steps + 1):
            s = i / steps
            ang = ph + twist * s * TAU
            wob = 1 + 0.25 * math.sin(s * 7 + k)
            pts.append(a + d * (L * s) + (u * math.cos(ang) + v * math.sin(ang)) * rr * wob)
        part.sweep(pts, thick * rnd.uniform(0.8, 1.2), seg=seg)


def cable(J):
    rnd = random.Random(7)
    m = Model('cable', J)
    H, T_ = _H(J)
    black, colour = Part(), Part()
    segs = [('pelvis', 'spine', 0.13, 7), ('spine', 'chest', 0.15, 8), ('chest', 'neck', 0.17, 9), ('neck', 'head', 0.05, 4)]
    for a, b, r, n in segs:
        _strands(black, H(a), H(b) if b != 'head' else H('head'), r, n, 0.6, rnd, 0.02)
    # the chest: loops of cable wound round and round
    ch0, ch1 = H('chest'), T_('chest')
    for k in range(5):
        c = ch0.lerp(ch1, 0.15 + 0.17 * k)
        rx, ry = 0.17 - 0.012 * k, 0.12
        pts = [c + V((rx * math.cos(a), ry * math.sin(a), 0.03 * math.sin(3 * a + k))) for a in
               [TAU * i / 18 for i in range(18)]]
        (colour if k in (1, 3) else black).sweep(pts, 0.018, seg=5, closed=True)
    for s in 'LR':
        _strands(black, H('clavicle_' + s), H('upperarm_' + s), 0.03, 3, 0.3, rnd)
        _strands(black, H('upperarm_' + s), H('forearm_' + s), 0.045, 5, 0.8, rnd)
        _strands(black, H('forearm_' + s), H('hand_' + s), 0.035, 4, 0.9, rnd)
        _strands(black, H('thigh_' + s), H('calf_' + s), 0.06, 6, 0.7, rnd, 0.02)
        _strands(black, H('calf_' + s), H('foot_' + s), 0.045, 5, 0.8, rnd)
        _strands(colour, H('upperarm_' + s), H('hand_' + s), 0.05, 1, 1.4, rnd, 0.012)
        _strands(colour, H('thigh_' + s), H('foot_' + s), 0.07, 1, 1.2, rnd, 0.012)
        # frayed fingers: bare copper ends
        wr, ht = H('hand_' + s), T_('hand_' + s)
        d, u, v = _frame(wr, ht)
        cu = Part()
        for k in range(5):
            base = wr + v * ((k - 2) * 0.015)
            tip = base + d * (0.16 + 0.03 * math.sin(k)) + u * 0.02 * (k - 2)
            black.sweep([base, base.lerp(tip, 0.6)], 0.01, seg=5)
            cu.sweep([base.lerp(tip, 0.6), tip], 0.005, seg=4)
        m.add(cu, CABLE['copper'], rough=0.3, metal=1.0, bone='hand_' + s)
        # a foot of knotted cable
        f = Part()
        f.sphere(H('foot_' + s).lerp(T_('foot_' + s), 0.5), (0.05, 0.1, 0.035), seg=8)
        m.add(f, CABLE['tape'], rough=0.7, bone='foot_' + s)
    m.add(black, CABLE['black'], rough=0.45, bones=['pelvis', 'spine', 'chest', 'neck', 'head', 'clavicle_L', 'clavicle_R',
                                                     'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R',
                                                     'thigh_L', 'thigh_R', 'calf_L', 'calf_R', 'foot_L', 'foot_R'], sigma=0.06)
    m.add(colour, CABLE['red'], rough=0.5, bones=['chest', 'spine', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R',
                                                  'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.06)
    # the head: a knot of wire around one glowing bulb, and a junction box for a jaw
    h0, h1 = H('head'), T_('head')
    hk = Part()
    c = h0.lerp(h1, 0.45)
    for k in range(6):
        a0 = TAU * k / 6
        ax = V((math.cos(a0), math.sin(a0), 0.6)).normalized()
        u, v, w = basis(ax)
        pts = [c + (u * math.cos(a) + v * math.sin(a)) * 0.1 for a in [TAU * i / 14 for i in range(14)]]
        hk.sweep(pts, 0.014, seg=5, closed=True)
    m.add(hk, CABLE['black2'], rough=0.45, bones=['head'], sigma=0.05)
    jb = Part()
    jb.box(c + V((0, -0.05, -0.1)), (0.13, 0.1, 0.06))
    m.add(jb, CABLE['yellow'], rough=0.6, bone='head')
    bulb = Part()
    bulb.sphere(c + V((0, -0.06, 0.01)), 0.045, seg=12)
    m.add(bulb, CABLE['spark'], rough=0.2, emit=1.0, bone='head')
    # sparks at the joints: small glowing insulators
    sp = Part()
    for b in ('forearm_L', 'forearm_R', 'calf_L', 'calf_R', 'chest'):
        p = H(b)
        sp.sphere(p + V((0, -0.05, 0)), (0.02, 0.02, 0.03), seg=8)
    m.add(sp, CABLE['spark'], rough=0.2, emit=0.9, bones=['forearm_L', 'forearm_R', 'calf_L', 'calf_R', 'chest'], sigma=0.03)
    ins = Part()
    for b in ('upperarm_L', 'upperarm_R', 'thigh_L', 'thigh_R'):
        a_, b_ = H(b), T_(b)
        d, u, v = _frame(a_, b_)
        c2 = a_.lerp(b_, 0.5)
        ins.capsule(c2 - d * 0.03, c2 + d * 0.03, 0.06, seg=8)
    m.add(ins, CABLE['tape'], rough=0.8, bones=['upperarm_L', 'upperarm_R', 'thigh_L', 'thigh_R'], sigma=0.05)
    return m


def cable_idle(P, t):
    ghoul.idle(P, t)
    P.rot['head'] = eul(-10 + cyc(t, 0.23, 6 if (t % 2.6) < 0.5 else 0), 0, cyc(t, 2.6, 15))   # a twitch, like a fault


CABLE_CLIPS = [
    Clip('idle', 2.6, cable_idle, loop=True),
    Clip('run', 0.5, ghoul.run, loop=True),
    Clip('claw', 1.0, ghoul.claw, events={'hit': 0.56}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]


# ================================================================ the Si'lah
SILAH = dict(robe='#3C463E', robe2='#2A302C', mask='#E6DFCF', eye='#A6FF78', hand='#8C8A84', mouth='#141414')


def silah_skeleton():
    return rig.humanoid(height=2.1, shoulder=0.19, hip=0.1, arm_drop=70.0, hunch=0.28, arm_len=1.25, leg_len=1.08)


def silah(J):
    m = Model('silah', J)
    H, T_ = _H(J)
    # a long hooded robe that hides the legs and drags on the ground
    r = Part()
    z_sh = H('neck').z - 0.05
    secs = [(z_sh + 0.05, 0, 0.0, 0.12, 0.1), (z_sh, 0, 0.0, 0.2, 0.13), (z_sh - 0.25, 0, 0.0, 0.18, 0.13),
            (z_sh - 0.6, 0, 0.0, 0.17, 0.13), (z_sh - 1.0, 0, 0.02, 0.24, 0.18), (0.35, 0, 0.03, 0.3, 0.24),
            (0.02, 0, 0.04, 0.34, 0.27)]
    r.loft(secs, seg=24, caps=True, folds=7)
    for s in 'LR':
        r.capsule(H('upperarm_' + s), H('forearm_' + s), 0.055, 0.05, seg=10)
        r.capsule(H('forearm_' + s), H('hand_' + s), 0.05, 0.07, seg=10)   # wide sleeves
    m.add(r, SILAH['robe'], rough=0.95, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R', 'clavicle_L',
                                                'clavicle_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'],
          sigma=0.14, voxel=0.014, smooth=3, tris=1200)
    # tattered strips at the hem and the shoulders
    st = Part()
    for k in range(16):
        a = TAU * k / 16
        top = V((0.3 * math.cos(a), 0.24 * math.sin(a) + 0.03, 0.25))
        bot = V((0.36 * math.cos(a), 0.28 * math.sin(a) + 0.03, 0.0))
        st.sweep([top, bot], (0.004, 0.05), seg=4, hint=V((math.cos(a), math.sin(a), 0)))
    m.add(st, SILAH['robe2'], rough=0.95, bones=['pelvis', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.2)
    # the hood
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd = Part()
    hd.sphere(h0 + up * 0.11 + fw * -0.03, (0.13, 0.14, 0.15), seg=16)
    m.add(hd, SILAH['robe2'], rough=0.95, bones=['head', 'neck'], sigma=0.06, voxel=0.01, smooth=2, tris=400)
    # the borrowed face: a smooth pale oval, holes for eyes, a smile too wide
    f = Part()
    f.sphere(h0 + up * 0.1 + fw * 0.07, (0.075, 0.03, 0.1), seg=16)
    m.add(f, SILAH['mask'], rough=0.35, bone='head')
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.13 + fw * 0.098 + V((s * 0.028, 0, 0)), (0.014, 0.006, 0.008), seg=8)
        m.add(e, SILAH['eye'], rough=0.3, emit=1.0, bone='head')
    mo = Part()
    mo.sweep([h0 + up * 0.05 + fw * 0.095 + V((x, 0, 0.012 * (x / 0.05) ** 2)) for x in (-0.05, -0.025, 0, 0.025, 0.05)],
             0.005, seg=5)
    m.add(mo, SILAH['mouth'], rough=0.5, bone='head')
    # long grey hands, five fingers with one joint too many
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        d, u, v = _frame(wr, ht)
        hp = Part()
        hp.sphere(wr + d * 0.04, (0.035, 0.03, 0.045), seg=8)
        for k in range(5):
            base = wr + d * 0.06 + v * ((k - 2) * 0.015)
            pts = [base, base + d * 0.08 + u * 0.01, base + d * 0.16 + u * 0.035, base + d * 0.23 + u * 0.07]
            hp.sweep(pts, lambda t: 0.008 * (1 - 0.6 * t), seg=5)
        m.add(hp, SILAH['hand'], rough=0.5, bone='hand_' + s)
    return m


def silah_idle(P, t):
    ghoul.base_pose(P, t)
    P.rot['spine'] = eul(8 + cyc(t, 3.0, 3), 0, cyc(t, 4.0, 4))
    P.rot['neck'] = eul(cyc(t, 3.0, 5), 0, 0)
    P.rot['head'] = eul(-10, cyc(t, 5.0, 25), 0)   # the head tilts, as if listening
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-5 + cyc(t, 3.0, 4, sg), 0, sg * 5)
        P.rot['forearm_' + s] = eul(-15, 0, 0)
    P.off['pelvis'] = V((0, 0, -0.05))


def silah_run(P, t):
    ghoul.run(P, t)
    P.rot['spine'] = eul(28, 0, 6 * math.sin(t / 0.5 * TAU))
    P.rot['head'] = eul(-35, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(40, 0, sg * 25)   # arms trailing behind
        P.rot['forearm_' + s] = eul(-10, 0, 0)


SILAH_CLIPS = [
    Clip('idle', 5.0, silah_idle, loop=True),
    Clip('run', 0.5, silah_run, loop=True),
    Clip('claw', 1.0, ghoul.claw, events={'hit': 0.56}),
    Clip('leap', 1.3, ghoula.leap, events={'hit': 0.88}),
    Clip('combo', 1.3, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]


# ================================================================ the Nasnas
NASNAS = dict(skin='#5E4030', cut='#5A1E1C', cut2='#7A2A26', rag='#6E665A', rag2='#4E483E', eye='#FFA040', hair='#1E1A18')


def nasnas_skeleton():
    return rig.humanoid(height=1.8, shoulder=0.18, hip=0.09, arm_drop=60.0, hunch=0.2, arm_len=1.15, leg_len=1.05)


def nasnas(J):
    """Only the left half (+X) is built. The cut face is a flat, dark wound down the middle."""
    m = Model('nasnas', J)
    H, T_ = _H(J)
    pel, nk = H('pelvis'), H('neck')
    t = Part()
    secs = [(pel.z - 0.05, 0, 0.0, 0.15, 0.11), (pel.z + 0.12, 0, -0.01, 0.15, 0.11), (pel.z + 0.3, 0, -0.03, 0.18, 0.12),
            (nk.z - 0.12, 0, -0.05, 0.21, 0.13), (nk.z, 0, -0.06, 0.12, 0.09)]
    t.loft(secs, seg=14, a0=-90, a1=90, caps=False)
    m.add(t, NASNAS['skin'], rough=0.65, bones=['pelvis', 'spine', 'chest', 'neck'], sigma=0.1, solidify=0.02, recalc=False)
    # the wound: one flat plane down the middle
    w = Part()
    rows = []
    for z, cy, ry in ((pel.z - 0.05, 0.0, 0.1), (pel.z + 0.3, -0.03, 0.11), (nk.z - 0.12, -0.05, 0.12), (nk.z, -0.06, 0.08)):
        rows.append([(0.001, cy - ry, z), (0.001, cy + ry, z)])
    w.grid(rows, closed=False)
    m.add(w, NASNAS['cut'], rough=0.4, bones=['pelvis', 'spine', 'chest', 'neck'], sigma=0.1, solidify=0.01, recalc=False)
    # half a head, and its one eye
    h0, h1 = H('head'), T_('head')
    hd = Part()
    hsecs = [(h0.z - 0.02, 0, h0.y, 0.05, 0.06), (h0.z + 0.06, 0, h0.y - 0.01, 0.085, 0.1), (h0.z + 0.14, 0, h0.y, 0.09, 0.105),
             (h0.z + 0.21, 0, h0.y + 0.01, 0.06, 0.08), (h0.z + 0.24, 0, h0.y + 0.01, 0.01, 0.01)]
    hd.loft(hsecs, seg=12, a0=-90, a1=90, caps=False)
    m.add(hd, NASNAS['skin'], rough=0.6, bones=['head', 'neck'], sigma=0.05, solidify=0.015, recalc=False)
    hw = Part()
    hw.grid([[(0.001, h0.y - 0.06, h0.z - 0.02), (0.001, h0.y + 0.06, h0.z - 0.02)],
             [(0.001, h0.y - 0.1, h0.z + 0.1), (0.001, h0.y + 0.1, h0.z + 0.1)],
             [(0.001, h0.y - 0.06, h0.z + 0.22), (0.001, h0.y + 0.07, h0.z + 0.22)]], closed=False)
    m.add(hw, NASNAS['cut2'], rough=0.4, bone='head', solidify=0.008, recalc=False)
    e = Part()
    e.sphere(V((0.035, h0.y - 0.095, h0.z + 0.12)), (0.018, 0.01, 0.012), seg=8)
    m.add(e, NASNAS['eye'], rough=0.3, emit=1.0, bone='head')
    hr = Part()
    for k in range(6):
        root = V((0.02 + 0.012 * k, h0.y + 0.02, h0.z + 0.2))
        hr.sweep([root, root + V((0.02, 0.08, -0.1)), root + V((0.03, 0.12, -0.22))], (0.004, 0.02), seg=4, hint=V((1, 0, 0)))
    m.add(hr, NASNAS['hair'], rough=0.9, bones=['head', 'neck'], sigma=0.08)
    # one arm, one leg
    a = Part()
    a.capsule(H('upperarm_L'), H('forearm_L'), 0.05, 0.042, seg=10)
    a.capsule(H('forearm_L'), H('hand_L'), 0.042, 0.032, seg=10)
    wr, ht = H('hand_L'), T_('hand_L')
    d, u, v = _frame(wr, ht)
    a.sphere(wr + d * 0.04, (0.035, 0.03, 0.045), seg=8)
    for k in range(4):
        base = wr + d * 0.07 + v * ((k - 1.5) * 0.017)
        a.capsule(base, base + d * 0.08 + u * 0.02, 0.009, 0.006, seg=5)
    a.capsule(H('thigh_L'), H('calf_L'), 0.075, 0.055, seg=10)
    a.capsule(H('calf_L'), H('foot_L'), 0.05, 0.038, seg=10)
    a.capsule(H('foot_L'), T_('foot_L'), 0.04, 0.03, seg=8)
    m.add(a, NASNAS['skin'], rough=0.65, bones=['clavicle_L', 'upperarm_L', 'forearm_L', 'hand_L', 'pelvis', 'thigh_L',
                                                 'calf_L', 'foot_L'], sigma=0.07)
    # half a galabeya, torn
    rg = Part()
    rsecs = [(nk.z - 0.1, 0, -0.05, 0.23, 0.15), (pel.z + 0.1, 0, -0.01, 0.19, 0.14), (pel.z - 0.25, 0, 0.0, 0.23, 0.17),
             (pel.z - 0.5, 0, 0.0, 0.25, 0.18)]
    rg.loft(rsecs, seg=12, a0=-90, a1=90, caps=False, folds=3)
    m.add(rg, NASNAS['rag'], rough=0.95, bones=['pelvis', 'spine', 'chest', 'thigh_L'], sigma=0.12, solidify=0.012, recalc=False)
    tt = Part()
    for k in range(6):
        a_ = -math.pi / 2 + math.pi * k / 5
        top = V((0.22 * math.cos(a_), 0.17 * math.sin(a_), pel.z - 0.48))
        tt.sweep([top, top + V((0.02 * math.cos(a_), 0.02 * math.sin(a_), -0.16 - 0.06 * math.sin(k * 2.3)))], (0.004, 0.04),
                 seg=4, hint=V((math.cos(a_), math.sin(a_), 0)))
    m.add(tt, NASNAS['rag2'], rough=0.95, bones=['pelvis', 'thigh_L'], sigma=0.15)
    return m


def nasnas_base(P, t):
    ghoul.base_pose(P, t)
    P.rot['thigh_L'] = eul(-15, 0, -8)   # the one leg under the middle of the body
    P.rot['calf_L'] = eul(30, 0, 0)
    P.rot['spine'] = eul(0, 0, -8)
    P.off['pelvis'] = V((0, 0, -0.06))


def nasnas_idle(P, t):
    nasnas_base(P, t)
    b = abs(math.sin(t / 1.2 * math.pi))   # it cannot stand still: a small hop to keep its balance
    P.off['root'] = V((0, 0, 0.05 * b))
    P.rot['calf_L'] = eul(30 + 20 * (1 - b), 0, 0)
    P.rot['upperarm_L'] = eul(-10 + cyc(t, 2.4, 10), 0, 25)
    P.rot['head'] = eul(-10, 0, cyc(t, 2.4, 10))


def nasnas_run(P, t):
    nasnas_base(P, t)
    ph = t / 0.45
    b = math.sin(ph * math.pi) if ph < 1 else 0
    P.off['root'] = V((0, 0, 0.3 * max(0.0, b)))
    P.rot['thigh_L'] = eul(-15 - 35 * b, 0, -8)
    P.rot['calf_L'] = eul(30 + 60 * (1 - b), 0, 0)
    P.rot['spine'] = eul(20, 0, -8)
    P.rot['upperarm_L'] = eul(-60 * b + 20, 0, 40)


def nasnas_claw(P, t):
    nasnas_base(P, t)
    wind = keys(t, [(0.0, 0.0), (0.42, 1.0), (0.5, 1.0)])
    strike = keys(t, [(0.48, 0.0), (0.58, 1.0), (0.75, 1.0), (1.0, 0.0)])
    P.rot['spine'] = eul(10 - 10 * wind + 25 * strike, 0, -25 * wind + 45 * strike)
    P.rot['upperarm_L'] = eul(-20 - 70 * wind + 50 * strike, 0, 60 * wind - 40 * strike)
    P.rot['forearm_L'] = eul(-60 * wind + 50 * strike, 0, 0)


def nasnas_slam(P, t):
    nasnas_base(P, t)
    wind = keys(t, [(0.0, 0.0), (0.7, 1.0), (0.78, 1.0)])
    strike = keys(t, [(0.76, 0.0), (0.86, 1.0), (1.05, 1.0), (1.3, 0.0)])
    P.off['root'] = V((0, 0, 0.5 * wind * (1 - strike)))
    P.rot['spine'] = eul(-25 * wind + 45 * strike, 0, 0)
    P.rot['upperarm_L'] = eul(-15 - 150 * wind + 110 * strike, 0, 10)
    P.rot['calf_L'] = eul(30 + 60 * strike, 0, 0)


def nasnas_combo(P, t):
    nasnas_base(P, t)
    for t0 in (0.0, 0.45):
        u = t - t0
        wind = keys(u, [(0.0, 0.0), (0.3, 1.0)])
        strike = keys(u, [(0.33, 0.0), (0.45, 1.0), (0.6, 0.0)])
        if 0 <= u < 0.6:
            P.rot['upperarm_L'] = eul(-30 - 80 * wind + 70 * strike, 0, 50 * wind - 40 * strike)
            P.rot['spine'] = eul(10 + 20 * strike, 0, -20 * wind + 30 * strike)


NASNAS_CLIPS = [
    Clip('idle', 2.4, nasnas_idle, loop=True),
    Clip('run', 0.45, nasnas_run, loop=True),
    Clip('claw', 1.0, nasnas_claw, events={'hit': 0.56}),
    Clip('slam', 1.3, nasnas_slam, events={'hit': 0.85}),
    Clip('combo', 1.1, nasnas_combo, events={'hit': 0.4, 'hit2': 0.85}),
    Clip('leap', 1.3, ghoula.leap, events={'hit': 0.88}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]


# ================================================================ the Qutrub
QUTRUB = dict(fur='#3E342C', fur2='#2A231E', skin='#4E4038', eye='#FFC23A', claw='#D8CCB4', tooth='#E4DCC8', nose='#1A1414')


def qutrub_skeleton():
    return rig.humanoid(height=1.9, shoulder=0.21, hip=0.11, arm_drop=66.0, hunch=0.95, arm_len=1.32, leg_len=0.9)


def qutrub(J):
    rnd = random.Random(31)
    m = Model('qutrub', J)
    H, T_ = _H(J)
    t = Part()
    t.capsule(H('pelvis'), H('spine'), 0.15, 0.17, seg=12)
    t.capsule(H('spine'), H('chest'), 0.18, 0.23, seg=12)
    t.capsule(H('chest'), T_('chest'), 0.24, 0.17, seg=12)
    t.sphere(H('pelvis'), (0.16, 0.14, 0.13), seg=12)
    for s in 'LR':
        t.sphere(H('upperarm_' + s), 0.1, seg=10)
        t.capsule(H('upperarm_' + s), H('forearm_' + s), 0.09, 0.065, seg=10)
        t.capsule(H('forearm_' + s), H('hand_' + s), 0.065, 0.055, seg=10)
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.11, 0.065, seg=10)
        t.capsule(H('calf_' + s), H('foot_' + s), 0.06, 0.04, seg=10)
        t.capsule(H('foot_' + s), T_('foot_' + s), 0.04, 0.025, seg=8)
    m.add(t, QUTRUB['fur'], rough=0.9, bones=['pelvis', 'spine', 'chest', 'neck', 'clavicle_L', 'clavicle_R', 'upperarm_L',
                                               'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R', 'thigh_L', 'thigh_R',
                                               'calf_L', 'calf_R', 'foot_L', 'foot_R'], sigma=0.08, voxel=0.014, smooth=3, tris=1400)
    # a mane of ragged tufts down the neck and back
    mn = Part()
    ch0, ch1 = H('chest'), T_('chest')
    fwd = (ch1 - ch0).normalized().cross(V((1, 0, 0))).normalized()
    for k in range(22):
        s = k / 21
        c = H('spine').lerp(T_('head') if s > 0.8 else ch1, s if s <= 0.8 else 1.0)
        side = rnd.uniform(-0.12, 0.12)
        base = c - fwd * 0.14 + V((side, 0, 0))
        tip = base - fwd * rnd.uniform(0.08, 0.16) + V((side * 0.5, 0.06, 0.04))
        mn.capsule(base, tip, 0.03, 0.004, seg=5)
    m.add(mn, QUTRUB['fur2'], rough=0.95, bones=['spine', 'chest', 'neck'], sigma=0.08)
    # the wolf's head: a long snout, ears laid back, teeth
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd = Part()
    hd.sphere(h0 + up * 0.08, (0.095, 0.11, 0.1), seg=14)
    hd.capsule(h0 + up * 0.07 + fw * 0.05, h0 + up * 0.03 + fw * 0.22, 0.06, 0.035, seg=10)
    hd.capsule(h0 + fw * 0.05, h0 - up * 0.02 + fw * 0.19, 0.035, 0.022, seg=8)   # the jaw, open
    hd.capsule(H('neck'), h0 + up * 0.04, 0.08, 0.075, seg=10)
    for s in (-1, 1):
        hd.capsule(h0 + up * 0.15 + V((s * 0.05, 0, 0)), h0 + up * 0.2 - fw * 0.1 + V((s * 0.08, 0, 0)), 0.03, 0.005, seg=6)
    m.add(hd, QUTRUB['skin'], rough=0.75, bones=['head', 'neck'], sigma=0.05, voxel=0.008, smooth=2, tris=600)
    ns = Part()
    ns.sphere(h0 + up * 0.03 + fw * 0.25, (0.022, 0.018, 0.018), seg=8)
    m.add(ns, QUTRUB['nose'], rough=0.3, bone='head')
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.12 + fw * 0.09 + V((s * 0.045, 0, 0)), (0.015, 0.01, 0.009), seg=8)
        m.add(e, QUTRUB['eye'], rough=0.3, emit=1.0, bone='head')
    th = Part()
    for k in range(5):
        x = (k - 2) * 0.016
        th.capsule(h0 + up * 0.035 + fw * (0.14 + 0.015 * abs(k - 2)) + V((x, 0, 0)),
                   h0 + up * 0.005 + fw * (0.15 + 0.015 * abs(k - 2)) + V((x, 0, 0)), 0.006, 0.002, seg=5)
    m.add(th, QUTRUB['tooth'], rough=0.4, bone='head')
    # a bushy tail
    tl = Part()
    p0 = H('pelvis') + V((0, 0.12, 0.03))
    tl.sweep([p0, p0 + V((0, 0.18, -0.05)), p0 + V((0, 0.36, -0.2)), p0 + V((0.02, 0.48, -0.42))],
             lambda t: 0.035 + 0.05 * math.sin(math.pi * min(1, t * 1.3)), seg=8)
    m.add(tl, QUTRUB['fur2'], rough=0.95, bone='pelvis')
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        d, u, v = _frame(wr, ht)
        cl = Part()
        for k in range(4):
            base = wr + d * 0.07 + v * ((k - 1.5) * 0.022)
            cl.capsule(base, base + d * 0.11 + u * 0.04, 0.011, 0.002, seg=5)
        m.add(cl, QUTRUB['claw'], rough=0.35, bone='hand_' + s)
    return m


def qutrub_run(P, t):
    """Down on all fours: the arms join the legs in a gallop."""
    T = 0.45
    ph = t / T * TAU
    P.off['pelvis'] = V((0, 0, -0.18 + 0.07 * abs(math.sin(ph))))
    P.rot['spine'] = eul(35 + 6 * math.sin(ph), 0, 0)
    P.rot['chest'] = eul(15 - 8 * math.sin(ph), 0, 0)
    P.rot['head'] = eul(-45, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        a = ph + (0.4 if s == 'R' else 0)
        P.rot['thigh_' + s] = eul(-35 - 45 * math.sin(a), 0, sg * 6)
        P.rot['calf_' + s] = eul(50 + 50 * max(0.0, math.sin(a - 1.0)), 0, 0)
        P.rot['foot_' + s] = eul(-20 + 15 * math.sin(a), 0, 0)
        P.rot['upperarm_' + s] = eul(-50 + 55 * math.sin(a + math.pi), 0, sg * 8)
        P.rot['forearm_' + s] = eul(-15, 0, 0)


def qutrub_howl(P, t):
    ghoula.wail(P, t)
    k = keys(t, [(0.0, 0.0), (0.9, 1.0), (1.4, 1.0), (1.8, 0.0)])
    P.rot['head'] = eul(-70 * k, 0, 0)


QUTRUB_CLIPS = [
    Clip('idle', 2.6, ghoul.idle, loop=True),
    Clip('run', 0.45, qutrub_run, loop=True),
    Clip('claw', 1.0, ghoul.claw, events={'hit': 0.56}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('leap', 1.3, ghoula.leap, events={'hit': 0.88}),
    Clip('combo', 1.2, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, qutrub_howl, events={'hit': 1.0}),
    Clip('summon', 1.5, qutrub_howl, events={'summon': 1.0}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]


# ================================================================ the Ifrit
IFRIT = dict(skin='#4A1C14', skin2='#32140E', ember='#FF7A20', flame='#FFB040', smoke='#2A2422', smoke2='#1C1816',
             horn='#241A16', gold='#B08A3A', eye='#FFE070')


def ifrit_skeleton():
    return rig.humanoid(height=3.1, shoulder=0.3, hip=0.12, arm_drop=55.0, hunch=0.3, arm_len=1.12, leg_len=0.95)


def ifrit(J):
    rnd = random.Random(99)
    m = Model('ifrit', J)
    H, T_ = _H(J)
    # a massive chest and arms
    t = Part()
    t.capsule(H('spine'), H('chest'), 0.2, 0.27, seg=14)
    t.capsule(H('chest'), T_('chest'), 0.3, 0.2, seg=14)
    t.sphere(H('chest').lerp(T_('chest'), 0.55), (0.36, 0.24, 0.24), seg=16)
    for s in 'LR':
        t.sphere(H('upperarm_' + s), 0.15, seg=12)
        t.capsule(H('upperarm_' + s), H('forearm_' + s), 0.13, 0.1, seg=12)
        t.capsule(H('forearm_' + s), H('hand_' + s), 0.1, 0.08, seg=12)
        wr, ht = H('hand_' + s), T_('hand_' + s)
        t.sphere(wr.lerp(ht, 0.5), (0.08, 0.06, 0.09), seg=10)
    t.capsule(H('neck'), H('head'), 0.14, 0.12, seg=12)
    m.add(t, IFRIT['skin'], rough=0.55, bones=['spine', 'chest', 'neck', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                                'forearm_L', 'forearm_R', 'hand_L', 'hand_R'], sigma=0.12, voxel=0.02, smooth=3,
          tris=1600)
    # cracks of fire across the skin
    cr = Part()
    ch0, ch1 = H('chest'), T_('chest')
    for k in range(14):
        a = rnd.uniform(-2.2, 2.2)
        z = rnd.uniform(0.1, 0.9)
        c = ch0.lerp(ch1, z)
        p0 = c + V((0.33 * math.sin(a), -0.22 * math.cos(a), 0))
        p1 = p0 + V((rnd.uniform(-0.08, 0.08), 0, rnd.uniform(-0.12, 0.12)))
        cr.capsule(p0, p1, 0.012, 0.004, seg=5)
    for s in 'LR':
        for k in range(4):
            a_, b_ = H('upperarm_' + s), H('hand_' + s)
            c = a_.lerp(b_, 0.15 + 0.2 * k)
            ang = rnd.uniform(0, TAU)
            off = V((math.cos(ang), math.sin(ang), 0)) * 0.11
            cr.capsule(c + off, c + off + V((0, 0, 0.07)), 0.01, 0.004, seg=5)
    m.add(cr, IFRIT['ember'], rough=0.3, emit=0.45, bones=['chest', 'spine', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'],
          sigma=0.1)
    # the head: heavy brow, burning eyes, two curling horns, a crown of flame
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd = Part()
    hd.sphere(h0 + up * 0.14, (0.14, 0.15, 0.17), seg=16)
    hd.capsule(h0 + up * 0.2 + fw * 0.12 + V((-0.09, 0, 0)), h0 + up * 0.2 + fw * 0.12 + V((0.09, 0, 0)), 0.035, seg=8)
    hd.sphere(h0 + up * 0.05 + fw * 0.1, (0.1, 0.08, 0.07), seg=12)
    m.add(hd, IFRIT['skin2'], rough=0.55, bones=['head', 'neck'], sigma=0.06, voxel=0.012, smooth=2, tris=600)
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.17 + fw * 0.145 + V((s * 0.05, 0, 0)), (0.024, 0.012, 0.012), seg=8)
        m.add(e, IFRIT['eye'], rough=0.3, emit=0.8, bone='head')
        hn = Part()
        b0 = h0 + up * 0.26 + V((s * 0.1, 0, 0))
        pts = [b0, b0 + V((s * 0.12, 0.05, 0.08)), b0 + V((s * 0.2, 0.14, 0.2)), b0 + V((s * 0.2, 0.1, 0.36))]
        hn.sweep(pts, lambda t: 0.05 * (1 - 0.85 * t), seg=8)
        m.add(hn, IFRIT['horn'], rough=0.5, bone='head')
    fl = Part()
    for k in range(9):
        a = math.pi * (0.1 + 0.8 * k / 8)
        b0 = h0 + up * 0.26 + V((0.1 * math.cos(a), 0.06 - 0.08 * math.sin(a), 0))
        fl.capsule(b0, b0 + up * (0.12 + 0.1 * rnd.random()) + V((0, 0.08, 0)), 0.03, 0.004, seg=6)
    m.add(fl, IFRIT['flame'], rough=0.3, emit=0.6, bones=['head'], sigma=0.05)
    # broken gold cuffs: the ifrit was bound, once
    for s in 'LR':
        cu = Part()
        wr = H('hand_' + s)
        el = H('forearm_' + s)
        d, u, v = _frame(el, wr)
        c = el.lerp(wr, 0.8)
        cu.capsule(c - d * 0.05, c + d * 0.05, 0.115, seg=12)
        for k in range(2):
            p = c + u * 0.12 + v * (0.03 * k) - d * 0.02 * k
            cu.capsule(p, p + u * 0.06 - V((0, 0, 0.12)), 0.02, seg=6)
        m.add(cu, IFRIT['gold'], rough=0.3, metal=1.0, bone='forearm_' + s)
    # from the waist down: a turning column of smoke, embers in it
    sm = Part()
    pel = H('pelvis')
    secs = []
    for i in range(9):
        s = i / 8
        z = pel.z + 0.25 - s * (pel.z + 0.15)
        r = 0.3 * (1 - s) ** 0.8 + 0.05
        secs.append((z, 0.05 * math.sin(s * 5), 0.08 * s, r, r * 0.9, 0.12))
    sm.loft(secs, seg=18, caps=True, folds=5, phase=0.7)
    m.add(sm, IFRIT['smoke'], rough=0.95, bones=['pelvis', 'spine', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.25,
          voxel=0.03, smooth=4, tris=800)
    wisp = Part()
    for k in range(10):
        a = TAU * k / 10
        z = pel.z - rnd.uniform(0.0, 0.9)
        r = 0.3 * (1 - (pel.z + 0.25 - z) / (pel.z + 0.15)) + 0.1
        p0 = V((r * math.cos(a), r * math.sin(a), z))
        wisp.sweep([p0, p0 + V((0.1 * math.cos(a + 1), 0.1 * math.sin(a + 1), -0.18))], (0.005, 0.05), seg=4,
                   hint=V((math.cos(a), math.sin(a), 0)))
    m.add(wisp, IFRIT['smoke2'], rough=0.95, bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.2)
    em = Part()
    for k in range(14):
        a = rnd.uniform(0, TAU)
        z = pel.z + 0.2 - rnd.uniform(0.0, 1.2)
        r = 0.28 * max(0.15, (z / (pel.z + 0.2))) + 0.03
        em.sphere(V((r * math.cos(a), r * math.sin(a), z)), 0.018, seg=6)
    m.add(em, IFRIT['ember'], rough=0.3, emit=0.5, bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.2)
    return m


def ifrit_combo(P, t):
    ghoula.combo(P, t)
    P.off['root'] = V((0, 0, 0.12))


def ifrit_roar(P, t):
    ghoula.wail(P, t)
    P.off['root'] = V((0, 0, 0.12 + 0.2 * keys(t, [(0.0, 0.0), (0.9, 1.0), (1.4, 1.0), (1.8, 0.0)])))


def ifrit_death(P, t):
    float_idle(P, t)
    k = keys(t, [(0.0, 0.0), (1.0, 1.0)])
    P.off['root'] = V((0, 0, 0.12 - 1.4 * k))   # it sinks into its own smoke
    P.rot['spine'] = eul(30 * k, 0, 0)
    P.rot['head'] = eul(-40 * k, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-120 * k, 0, sg * 40 * k)


IFRIT_CLIPS = [
    Clip('idle', 2.4, float_idle, loop=True),
    Clip('run', 0.8, float_run, loop=True),
    Clip('combo', 1.4, ifrit_combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, ifrit_roar, events={'hit': 1.0}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.2, ifrit_death),
]


# ================================================================ the Sand Jinn (Slice 5: the Haboob's own)
SAND = dict(body='#B8925A', body2='#8E6C3E', ribbon='#D8B880', eye='#FFF0B0', dark='#5A4428')


def sand_skeleton():
    return rig.humanoid(height=2.05, shoulder=0.21, hip=0.1, arm_drop=58.0, hunch=0.25, arm_len=1.2, leg_len=0.9)


def sand(J):
    """A figure of blown sand: a lean body that thins into a whirling column below the waist, ribbons of sand round it."""
    rnd = random.Random(17)
    m = Model('sand', J)
    H, T_ = _H(J)
    t = Part()
    t.capsule(H('spine'), H('chest'), 0.13, 0.17, seg=12)
    t.capsule(H('chest'), T_('chest'), 0.19, 0.13, seg=12)
    for s_ in 'LR':
        t.capsule(H('upperarm_' + s_), H('forearm_' + s_), 0.06, 0.05, seg=10)
        t.capsule(H('forearm_' + s_), H('hand_' + s_), 0.05, 0.03, seg=10)
        wr, ht = H('hand_' + s_), T_('hand_' + s_)
        d, u, v = _frame(wr, ht)
        for k in range(3):   # fingers of sand, drawn out to points
            b = wr + v * ((k - 1) * 0.02)
            t.capsule(b, b + d * 0.14 + u * 0.03, 0.014, 0.002, seg=5)
    t.capsule(H('neck'), H('head'), 0.06, 0.07, seg=10)
    m.add(t, SAND['body'], rough=0.95, bones=['spine', 'chest', 'neck', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                              'forearm_L', 'forearm_R', 'hand_L', 'hand_R'], sigma=0.1, voxel=0.014, smooth=3, tris=1100)
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd = Part()   # a head like a wrapped face, swept back into a trailing plume
    hd.sphere(h0 + up * 0.11, (0.1, 0.12, 0.13), seg=14)
    hd.sweep([h0 + up * 0.14 - fw * 0.05, h0 + up * 0.2 - fw * 0.2, h0 + up * 0.18 - fw * 0.42], lambda t: 0.08 * (1 - 0.8 * t), seg=8)
    m.add(hd, SAND['body2'], rough=0.95, bones=['head', 'neck'], sigma=0.06, voxel=0.01, smooth=2, tris=500)
    for s_ in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.12 + fw * 0.1 + V((s_ * 0.035, 0, 0)), (0.02, 0.008, 0.01), seg=8)
        m.add(e, SAND['eye'], rough=0.3, emit=0.8, bone='head')
    # below the waist, a column of turning sand
    col = Part()
    pel = H('pelvis')
    secs = []
    for i in range(9):
        f = i / 8
        z = pel.z + 0.2 - f * (pel.z + 0.1)
        r = 0.2 * (1 - f) ** 0.7 + 0.04
        secs.append((z, 0.04 * math.sin(f * 6), 0.05 * f, r, r * 0.9, 0.15))
    col.loft(secs, seg=16, caps=True, folds=6, phase=1.3)
    m.add(col, SAND['body2'], rough=0.95, bones=['pelvis', 'spine', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.22,
          voxel=0.025, smooth=4, tris=600)
    # ribbons of sand wound round the body
    rb = Part()
    for k in range(4):
        z0 = 0.2 + 0.35 * k
        ph = rnd.uniform(0, TAU)
        pts = []
        for i in range(14):
            a_ = ph + i / 13 * TAU * 0.8
            r = 0.3 + 0.05 * math.sin(i)
            pts.append(V((r * math.cos(a_), r * math.sin(a_), z0 + 0.25 * i / 13)))
        rb.sweep(pts, lambda t: (0.004, 0.03 * math.sin(math.pi * t) + 0.004), seg=4, hint=V((0, 0, 1)))
    m.add(rb, SAND['ribbon'], rough=0.9, bones=['pelvis', 'spine', 'chest'], sigma=0.3)
    return m


def sand_claw(P, t):
    ghoul.claw(P, t)
    P.off['root'] = V((0, 0, 0.12))


def sand_death(P, t):
    float_idle(P, t)
    k = keys(t, [(0.0, 0.0), (0.9, 1.0)])
    P.off['root'] = V((0, 0, 0.12 - 1.6 * k))   # it pours away into the ground
    P.rot['spine'] = eul(25 * k, 0, 0)


SAND_CLIPS = [
    Clip('idle', 2.4, float_idle, loop=True),
    Clip('run', 0.8, float_run, loop=True),
    Clip('claw', 1.0, sand_claw, events={'hit': 0.56}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, sand_death),
]


# ================================================================ possessed things (static)
def dish():
    m = Model('dish')
    b = Part()
    b.box((0, 0.05, 0.12), (0.5, 0.5, 0.24))   # a concrete block on the roof it was bolted to
    m.add(b, '#6A6660', rough=0.95, bevel=0.02)
    p = Part()
    p.capsule(V((0, 0.05, 0.24)), V((0, 0.05, 1.3)), 0.04, seg=10)
    p.capsule(V((0, 0.05, 1.3)), V((0, -0.05, 1.4)), 0.04, seg=10)
    m.add(p, '#4A4A4E', rough=0.5, metal=0.8)
    # the dish: a shallow paraboloid facing forward (-Y) and up, dented, streaked with rust
    d = Part()
    rot = Matrix.Rotation(math.radians(-70), 4, 'X')
    rows = []
    for i in range(7):
        r = 0.6 * i / 6
        depth = 0.18 * (r / 0.6) ** 2
        rows.append([rot @ V((r * math.cos(a), r * math.sin(a), depth)) + V((0, -0.1, 1.45))
                     for a in [TAU * k / 24 for k in range(24)]])
    d.grid(rows, closed=True)
    m.add(d, '#C8C4B8', rough=0.5, metal=0.4, solidify=0.02, recalc=False)
    rust = Part()
    for k in range(5):
        a = TAU * k / 5 + 0.4
        rust.sphere(rot @ V((0.4 * math.cos(a), 0.4 * math.sin(a), 0.08)) + V((0, -0.1, 1.45)), (0.08, 0.05, 0.02), rot=rot, seg=8)
    m.add(rust, '#7A4424', rough=0.9)
    arm = Part()
    focus = rot @ V((0, 0, 0.55)) + V((0, -0.1, 1.45))
    base = rot @ V((0, -0.55, 0.12)) + V((0, -0.1, 1.45))
    arm.capsule(base, focus, 0.018, seg=8)
    m.add(arm, '#4A4A4E', rough=0.5, metal=0.8)
    eye = Part()
    eye.sphere(focus, (0.07, 0.07, 0.07), seg=12)
    m.add(eye, '#7FD8FF', rough=0.2, emit=1.0)
    # its cables, torn loose, trailing on the ground
    c = Part()
    for k, (x, y) in enumerate(((0.3, 0.5), (-0.4, 0.4), (0.1, 0.7))):
        c.sweep([V((0, 0.05, 1.0)), V((x * 0.5, 0.2 + y * 0.3, 0.5)), V((x, y, 0.03)), V((x * 1.4, y * 1.5, 0.02))], 0.015, seg=5)
    m.add(c, '#1A1A1E', rough=0.45)
    return m


def microbus():
    """A Toyota-style Cairo microbus, white with the blue stripe, a roof rack, and nobody at the wheel. Front is -Y."""
    m = Model('microbus')
    L, W = 4.6, 1.8
    b = Part()
    b.box((0, 0.15, 1.2), (W, L - 0.3, 1.5))
    b.box((0, -L / 2 + 0.25, 0.95), (W, 0.4, 1.0))    # the snub nose
    m.add(b, '#A8A49A', rough=0.55, metal=0.1, bevel=0.08)
    st = Part()
    for sx in (-1, 1):
        st.box((sx * (W / 2 + 0.005), 0.0, 0.95), (0.01, L - 0.1, 0.16))
    st.box((0, -L / 2 + 0.045, 0.95), (W - 0.1, 0.01, 0.16))
    m.add(st, '#2A5AA0', rough=0.5)
    gl = Part()
    for sx in (-1, 1):
        for k in range(4):
            y = -1.1 + k * 0.85
            gl.box((sx * (W / 2 + 0.006), y, 1.55), (0.01, 0.7, 0.5))
    gl.box((0, -L / 2 + 0.43, 1.6), (W - 0.2, 0.02, 0.6))    # windscreen
    m.add(gl, '#8A2A18', rough=0.1, emit=0.35)   # a red glow inside where the passengers should be
    lamps = Part()
    for sx in (-1, 1):
        lamps.sphere((sx * 0.62, -L / 2 + 0.04, 0.9), (0.14, 0.03, 0.1), seg=10)
    m.add(lamps, '#E8D8A0', rough=0.1, emit=0.35)
    gr = Part()
    gr.box((0, -L / 2 + 0.035, 0.68), (1.0, 0.03, 0.22))
    gr.box((0, -L / 2 + 0.0, 0.48), (W + 0.04, 0.12, 0.14))   # bumper
    gr.box((0, L / 2 + 0.0, 0.48), (W + 0.04, 0.12, 0.14))
    m.add(gr, '#2A2A2C', rough=0.6, metal=0.4)
    wh = Part()
    for sx in (-1, 1):
        for y in (-1.45, 1.35):
            wh.capsule(V((sx * (W / 2 - 0.12), y, 0.36)), V((sx * (W / 2 + 0.03), y, 0.36)), 0.34, seg=16)
    m.add(wh, '#181818', rough=0.8)
    rk = Part()
    for sx in (-1, 1):
        rk.capsule(V((sx * 0.8, -1.9, 2.05)), V((sx * 0.8, 2.0, 2.05)), 0.025, seg=6)
    for k in range(6):
        y = -1.8 + k * 0.75
        rk.capsule(V((-0.8, y, 2.05)), V((0.8, y, 2.05)), 0.02, seg=6)
    m.add(rk, '#3A3A3C', rough=0.5, metal=0.8)
    bund = Part()
    bund.box((0.2, -0.6, 2.25), (0.9, 1.0, 0.35), rot=Matrix.Rotation(0.1, 4, 'Z'))
    bund.box((-0.3, 0.9, 2.2), (0.7, 0.8, 0.3), rot=Matrix.Rotation(-0.2, 4, 'Z'))
    m.add(bund, '#8A6A40', rough=0.95, bevel=0.06)
    ru = Part()
    rnd = random.Random(4)
    for k in range(9):
        sx = rnd.choice((-1, 1))
        ru.sphere((sx * (W / 2 + 0.01), rnd.uniform(-2, 2), rnd.uniform(0.5, 1.1)), (0.02, rnd.uniform(0.1, 0.25), 0.08), seg=8)
    m.add(ru, '#7A4A2A', rough=0.9)
    return m


# ================================================================ Usta Hassan, the coppersmith
def coppersmith_skeleton():
    return rig.humanoid(height=1.72, shoulder=0.21, arm_drop=62.0)


def coppersmith(J):
    from characters import npc
    col = dict(npc.COL, skin='#7A4A30', hair='#D8D4CC', robe='#4A5A6A', robe2='#3A4854', vest='#2E2A26', towel='#B8B0A0')
    m = npc.keeper(J, col=col, name='coppersmith')
    H, T_ = _H(J)
    ap = Part()
    ap.loft([(0.55, 0, -0.04, 0.26, 0.2), (0.95, 0, -0.03, 0.22, 0.18), (1.3, 0, -0.02, 0.22, 0.17)], seg=14, a0=200, a1=340,
            caps=False)
    m.add(ap, '#5A3A22', rough=0.8, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R'], sigma=0.12, solidify=0.012,
          recalc=False)
    cap = Part()
    cap.loft([(1.64, 0, 0.01, 0.093, 0.105), (1.7, 0, 0.012, 0.09, 0.1), (1.72, 0, 0.012, 0.06, 0.07)], seg=18, caps=True)
    m.add(cap, '#EAE6DC', rough=0.9, bone='head')
    hm = Part()
    wr, ht = H('hand_R'), T_('hand_R')
    d, u, v = _frame(wr, ht)
    grip = wr.lerp(ht, 0.6)
    hm.capsule(grip - u * 0.08, grip + u * 0.2, 0.014, seg=6)
    hm.box(grip + u * 0.22, (0.06, 0.06, 0.12), rot=Matrix.Rotation(0, 4, 'Z'))
    m.add(hm, '#B87333', rough=0.35, metal=1.0, bone='hand_R')
    return m


def coppersmith_idle(P, t):
    P.rot['spine'] = eul(12, 0, 0)
    P.rot['head'] = eul(10 + cyc(t, 3.0, 3), 0, cyc(t, 7.0, 10))
    beat = t % 0.9
    up = keys(beat, [(0.0, 0.0), (0.55, 1.0)])
    down = keys(beat, [(0.55, 0.0), (0.68, 1.0), (0.9, 0.0)])
    k = up * (1 - down)
    rest = 1.0 if (t % 5.4) > 4.2 else 0.0   # every sixth blow he stops to look at the work
    k *= 1 - rest
    P.rot['upperarm_R'] = eul(-40 - 70 * k, 0, -15)
    P.rot['forearm_R'] = eul(-60 - 30 * k, 0, 0)
    P.rot['upperarm_L'] = eul(-35, 0, 10)
    P.rot['forearm_L'] = eul(-50, 0, 0)


COPPERSMITH_CLIPS = [Clip('idle', 5.4, coppersmith_idle, loop=True)]


CREATURES = [
    ('cable', cable_skeleton, cable, CABLE_CLIPS),
    ('silah', silah_skeleton, silah, SILAH_CLIPS),
    ('nasnas', nasnas_skeleton, nasnas, NASNAS_CLIPS),
    ('qutrub', qutrub_skeleton, qutrub, QUTRUB_CLIPS),
    ('ifrit', ifrit_skeleton, ifrit, IFRIT_CLIPS),
    ('coppersmith', coppersmith_skeleton, coppersmith, COPPERSMITH_CLIPS),
    ('sand', sand_skeleton, sand, SAND_CLIPS),
]
STATICS = [('dish', dish), ('microbus', microbus)]
