"""Act II's folk creatures, the Nile to Luxor (GDD §9, brief §5: folklore only).

  marid     the River Marid: a jinn of the Nile's deep water, a body of black water that thins into a turning column,
            weed hanging from its shoulders, eyes like the moon on the river
  naddaha   El Naddaha, the Caller: the woman in the canal who calls men by name, in the voice of someone they love; a
            tall pale figure in a wet gown, hair to her knees, standing on the water

and three static meshes (the game sways and lights them; front is -Y):
  timthal   a possessed statue: a striding king in black granite, eyes lit by what has got into him
  ram       the Ram of the Avenue: a ram-headed sphinx off its plinth at Karnak (Act II's second boss)
  coil      one coil of the great serpent under the world, glimpsed moving through the pit of the deepest tomb
"""
import math
import random
from mathutils import Vector as V, Matrix

from qart.geom import Part, basis, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import ghoul, ghoula
from characters.jinn import _H, _frame, cast, float_idle, float_run


# ================================================================ the River Marid
MARID = dict(body='#163A4A', body2='#1E5064', foam='#A8DCE8', weed='#1E3A26', eye='#D8F8FF', water='#2A6478')


def marid_skeleton():
    return rig.humanoid(height=2.3, shoulder=0.24, hip=0.1, arm_drop=56.0, hunch=0.2, arm_len=1.22, leg_len=0.9)


def marid(J):
    rnd = random.Random(31)
    m = Model('marid', J)
    H, T_ = _H(J)
    t = Part()
    t.capsule(H('spine'), H('chest'), 0.15, 0.2, seg=12)
    t.capsule(H('chest'), T_('chest'), 0.23, 0.15, seg=12)
    t.sphere(H('chest').lerp(T_('chest'), 0.5), (0.26, 0.18, 0.2), seg=14)
    for s_ in 'LR':
        t.sphere(H('upperarm_' + s_), 0.1, seg=10)
        t.capsule(H('upperarm_' + s_), H('forearm_' + s_), 0.085, 0.07, seg=10)
        t.capsule(H('forearm_' + s_), H('hand_' + s_), 0.07, 0.045, seg=10)
        wr, ht = H('hand_' + s_), T_('hand_' + s_)
        d, u, v = _frame(wr, ht)
        for k in range(4):   # webbed fingers
            b = wr + v * ((k - 1.5) * 0.022)
            t.capsule(b, b + d * 0.15 + u * 0.02, 0.014, 0.004, seg=5)
    t.capsule(H('neck'), H('head'), 0.08, 0.09, seg=10)
    m.add(t, MARID['body'], rough=0.12, metal=0.35, bones=['spine', 'chest', 'neck', 'clavicle_L', 'clavicle_R', 'upperarm_L',
                                                           'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'],
          sigma=0.1, voxel=0.014, smooth=3, tris=1300)
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd = Part()   # a long head like a fish's, the jaw hanging
    hd.sphere(h0 + up * 0.12 + fw * 0.02, (0.11, 0.15, 0.13), seg=14)
    hd.sphere(h0 + up * 0.04 + fw * 0.08, (0.08, 0.1, 0.05), seg=12)
    m.add(hd, MARID['body2'], rough=0.15, metal=0.3, bones=['head', 'neck'], sigma=0.06, voxel=0.01, smooth=2, tris=500)
    for s_ in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.14 + fw * 0.14 + V((s_ * 0.055, 0, 0)), (0.026, 0.012, 0.018), seg=8)
        m.add(e, MARID['eye'], rough=0.3, emit=0.9, bone='head')
    # weed hanging from the crown and shoulders
    wd = Part()
    for k in range(16):
        a = rnd.uniform(0, TAU)
        if k < 7:
            root = h0 + up * 0.2 + V((0.09 * math.cos(a), 0.09 * math.sin(a), 0))
            L = rnd.uniform(0.35, 0.6)
        else:
            s_ = rnd.choice('LR')
            root = H('upperarm_' + s_) + V((rnd.uniform(-0.08, 0.08), rnd.uniform(-0.05, 0.1), 0.08))
            L = rnd.uniform(0.3, 0.7)
        pts = [root + V((0.03 * math.sin(i * 1.7 + k), 0.04 * i / 4, -L * i / 4)) for i in range(5)]
        wd.sweep(pts, lambda t: (0.004, 0.025 * (1 - 0.6 * t)), seg=4, hint=V((math.cos(a), math.sin(a), 0)))
    m.add(wd, MARID['weed'], rough=0.7, bones=['head', 'chest', 'clavicle_L', 'clavicle_R'], sigma=0.2)
    # streaks of foam over the body, as if the water were still running off it
    fo = Part()
    for k in range(18):
        a = rnd.uniform(-2.4, 2.4)
        c = H('spine').lerp(T_('chest'), rnd.uniform(0.1, 0.95))
        p0 = c + V((0.22 * math.sin(a), -0.17 * math.cos(a), 0))
        fo.capsule(p0, p0 + V((0, 0, -rnd.uniform(0.08, 0.2))), 0.01, 0.003, seg=4)
    m.add(fo, MARID['foam'], rough=0.3, emit=0.25, bones=['chest', 'spine'], sigma=0.12)
    # below the waist, a turning column of river water ringed with foam where it meets the ground
    col = Part()
    pel = H('pelvis')
    secs = []
    for i in range(11):
        f = i / 10
        z = pel.z + 0.22 - f * (pel.z + 0.14)
        r = 0.26 - 0.17 * math.sin(math.pi * min(1.0, f * 1.1)) + 0.3 * f ** 3   # pinched in the middle, a splash at the foot
        secs.append((z, 0.05 * math.sin(f * 7), 0.04 * f, r, r * 0.9, 0.22))
    col.loft(secs, seg=22, caps=True, folds=5, phase=0.4)
    m.add(col, '#2E6A7E', rough=0.06, metal=0.35, emit=0.015, bones=['pelvis', 'spine', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.22,
          voxel=0.025, smooth=4, tris=700)
    ring = Part()
    for k in range(12):
        a = TAU * k / 12
        ring.sphere(V((0.3 * math.cos(a), 0.3 * math.sin(a), 0.1)), (0.09, 0.09, 0.05), seg=6)
    m.add(ring, MARID['foam'], rough=0.4, emit=0.08, bones=['pelvis', 'calf_L', 'calf_R'], sigma=0.3)
    return m


def marid_claw(P, t):
    ghoul.claw(P, t)
    P.off['root'] = V((0, 0, 0.1))


def marid_death(P, t):
    float_idle(P, t)
    k = keys(t, [(0.0, 0.0), (0.9, 1.0)])
    P.off['root'] = V((0, 0, 0.12 - 1.9 * k))   # it falls back into the water it came from
    P.rot['spine'] = eul(-20 * k, 0, 0)


def marid_combo(P, t):
    ghoula.combo(P, t)
    P.off['root'] = V((0, 0, 0.12))


MARID_CLIPS = [
    Clip('idle', 2.4, float_idle, loop=True),
    Clip('run', 0.8, float_run, loop=True),
    Clip('claw', 1.0, marid_claw, events={'hit': 0.56}),
    Clip('spit', 1.1, cast, events={'hit': 0.6}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('combo', 1.3, marid_combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, ghoula.wail, events={'hit': 1.0}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, marid_death),
]


# ================================================================ El Naddaha, the Caller
NADDAHA = dict(skin='#C8C0B8', gown='#B8C8C0', gown2='#8AA0A0', hair='#0E0C10', eye='#9FF0FF', shell='#E8E0D0', water='#2A6478',
               foam='#A8DCE8')


def naddaha_skeleton():
    return rig.humanoid(height=2.25, shoulder=0.18, hip=0.1, arm_drop=62.0, hunch=0.05, arm_len=1.12, leg_len=1.05)


def naddaha(J):
    rnd = random.Random(7)
    m = Model('naddaha', J)
    H, T_ = _H(J)
    pel, ch, nk = H('pelvis'), H('chest'), H('neck')
    h0, h1 = H('head'), T_('head')
    k = (h1.z - h0.z) / 0.24
    hc = h0 + V((0, 0.0, 0.105 * k))
    b = Part()   # a long neck, a small face, long pale arms and hands
    b.sphere(hc, (0.075 * k, 0.088 * k, 0.108 * k), seg=22)
    b.sphere(hc + V((0, -0.03, -0.07)) * k, (0.055 * k, 0.06 * k, 0.05 * k), seg=16)
    b.capsule(nk + V((0, 0.01, -0.03)), hc + V((0, 0, -0.08)) * k, 0.045 * k, seg=12)
    for s_ in 'LR':
        b.capsule(H('upperarm_' + s_), H('forearm_' + s_), 0.042, 0.036, seg=10)
        b.capsule(H('forearm_' + s_), H('hand_' + s_), 0.034, 0.026, seg=10)
        wr, ht = H('hand_' + s_), T_('hand_' + s_)
        d, u, v = _frame(wr, ht)
        for f in range(4):   # long fingers
            bb = wr + v * ((f - 1.5) * 0.016)
            b.capsule(bb, bb + d * 0.17 + u * 0.01, 0.009, 0.004, seg=5)
    m.add(b, NADDAHA['skin'], rough=0.35, bones=['head', 'neck', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'],
          sigma=0.06, voxel=0.007, smooth=3, tris=1200)
    for s_ in (-1, 1):
        e = Part()
        e.sphere(hc + V((s_ * 0.028, -0.078, 0.016)) * k, (0.013 * k, 0.005 * k, 0.007 * k), seg=8)
        m.add(e, NADDAHA['eye'], rough=0.3, emit=1.0, bone='head')
    # the gown: close at the chest, falling wet and heavy to the water, the hem dragging
    sh_z = H('upperarm_L').z
    g = Part()
    g.loft([(nk.z - 0.02, 0, 0.01, 0.08, 0.07, 0.0), (sh_z - 0.03, 0, 0.012, 0.17, 0.11, 0.0), (ch.z + 0.05, 0, 0.012, 0.15, 0.11, 0.01),
            (pel.z + 0.1, 0, 0.01, 0.14, 0.11, 0.015), (pel.z - 0.25, 0, 0.02, 0.2, 0.16, 0.03), (pel.z - 0.6, 0, 0.04, 0.26, 0.21, 0.05),
            (0.25, 0, 0.06, 0.33, 0.28, 0.06), (0.04, 0, 0.07, 0.4, 0.34, 0.07)], seg=34, caps=False, folds=7, phase=0.3)
    m.add(g, NADDAHA['gown'], rough=0.3, metal=0.1, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'],
          sigma=0.2, solidify=0.01, recalc=False, tris=1600)
    for s_ in 'LR':   # wide sleeves, to the elbow
        sl = Part()
        sl.capsule(H('upperarm_' + s_), H('upperarm_' + s_).lerp(H('forearm_' + s_), 1.1), 0.06, 0.09, seg=12)
        m.add(sl, NADDAHA['gown2'], rough=0.35, bones=['upperarm_' + s_, 'clavicle_' + s_], sigma=0.06, solidify=0.006, recalc=False)
    # the hair: black, wet, to the knees, a few strands across the face
    hair = Part()
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    for f in range(20):
        a = math.pi * (-0.05 + 1.1 * f / 19)
        root = hc + V((0.075 * k * math.cos(a), 0.02 + 0.05 * math.sin(a), 0.07 * k))
        L = rnd.uniform(1.0, 1.35)
        pts = [root]
        for i in range(1, 7):
            pts.append(root + V((0.06 * math.cos(a) * i / 6 + 0.02 * math.sin(i + f), 0.06 + 0.02 * i, -L * i / 6)))
        hair.sweep(pts, lambda t: (0.006, 0.035 * (1 - 0.5 * t)), seg=4, hint=V((math.cos(a), 0.5, 0)))
    for s_ in (-1, 1):
        root = hc + V((s_ * 0.03, -0.06, 0.08)) * k
        hair.sweep([root, root + V((s_ * 0.02, -0.035, -0.12)), root + V((s_ * 0.01, -0.03, -0.3))], (0.004, 0.012), seg=4, hint=V((0, -1, 0)))
    m.add(hair, NADDAHA['hair'], rough=0.2, metal=0.2, bones=['head', 'neck', 'chest', 'spine'], sigma=0.2)
    # a necklace of river shells
    sh = Part()
    for f in range(9):
        a = math.pi * (1.15 + 0.7 * f / 8)
        p = nk + V((0.1 * math.cos(a), 0.08 * math.sin(a) - 0.01, -0.07 - 0.03 * math.sin(math.pi * f / 8)))
        sh.sphere(p, (0.016, 0.01, 0.022), seg=6)
    m.add(sh, NADDAHA['shell'], rough=0.3, emit=0.1, bone='chest')
    # where she stands: a disc of black water, a ring of foam
    w = Part()
    w.loft([(0.02, 0, 0.05, 0.62, 0.58), (0.05, 0, 0.05, 0.5, 0.46)], seg=24, caps=True)
    m.add(w, NADDAHA['water'], rough=0.06, metal=0.45, bones=['pelvis', 'calf_L', 'calf_R'], sigma=0.4)
    fo = Part()
    for f in range(16):
        a = TAU * f / 16
        fo.sphere(V((0.58 * math.cos(a), 0.05 + 0.54 * math.sin(a), 0.06)), (0.07, 0.07, 0.03), seg=6)
    m.add(fo, NADDAHA['foam'], rough=0.4, emit=0.25, bones=['pelvis', 'calf_L', 'calf_R'], sigma=0.4)
    return m


def naddaha_idle(P, t):
    float_idle(P, t)
    P.off['root'] = V((0, 0, 0.04 + 0.03 * math.sin(t / 2.4 * TAU)))
    P.rot['head'] = eul(-4 + cyc(t, 3.1, 3), 0, cyc(t, 5.3, 12))
    for s_, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s_] = eul(-8 + cyc(t, 3.0, 5, sg), 0, sg * -22)
        P.rot['forearm_' + s_] = eul(-20, 0, 0)


def naddaha_run(P, t):
    naddaha_idle(P, t)
    P.rot['spine'] = eul(14, 0, 0)
    for s_, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s_] = eul(25, 0, sg * 25)


def naddaha_call(P, t):
    """The Call: arms opening wide, head back, then one hand reaching for you."""
    naddaha_idle(P, t)
    open_ = keys(t, [(0.0, 0.0), (0.7, 1.0), (1.3, 1.0), (1.8, 0.0)])
    reach = keys(t, [(0.9, 0.0), (1.2, 1.0), (1.5, 1.0), (1.8, 0.0)])
    P.rot['spine'] = eul(-12 * open_ + 14 * reach, 0, 0)
    P.rot['head'] = eul(-30 * open_ + 25 * reach, 0, 0)
    P.rot['upperarm_L'] = eul(-30 * open_, 0, 80 * open_)
    P.rot['upperarm_R'] = eul(-30 * open_ - 60 * reach, 0, -80 * open_ + 70 * reach)
    P.rot['forearm_R'] = eul(-10 * reach, 0, 0)


def naddaha_death(P, t):
    naddaha_idle(P, t)
    k = keys(t, [(0.0, 0.0), (1.2, 1.0)], ease=lambda u: u * u)
    P.off['root'] = V((0, 0, -2.3 * k))   # she sinks back, standing, into the canal
    P.rot['head'] = eul(-25 * k, 0, 0)
    for s_, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s_] = eul(-120 * k, 0, sg * 20 * k)


NADDAHA_CLIPS = [
    Clip('idle', 2.4, naddaha_idle, loop=True),
    Clip('run', 0.8, naddaha_run, loop=True),
    Clip('combo', 1.3, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, naddaha_call, events={'hit': 1.0}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.6, naddaha_death),
]


# ================================================================ static: the possessed of Karnak, and the serpent
def _granite(m, part, col='#2E2A2C'):
    m.add(part, col, rough=0.35, metal=0.1)


def timthal():
    """A striding king in black granite, 2.6 m: left foot forward, arms at his sides, the striped headcloth."""
    m = Model('timthal')
    b = Part()
    b.box((0, 0.1, 0.15), (0.8, 1.3, 0.3))                        # the base
    b.box((0, 0.1, 0.02), (0.7, 1.2, 0.04))
    lg = Part()
    lg.box((0.12, -0.2, 0.75), (0.2, 0.26, 0.9))                  # the left leg, forward
    lg.box((-0.12, 0.3, 0.75), (0.2, 0.26, 0.9))
    lg.box((0, 0.1, 1.28), (0.5, 0.5, 0.36))                      # the kilt
    lg.box((0, -0.14, 1.2), (0.16, 0.04, 0.4))                    # its front panel
    lg.loft([(1.46, 0, 0.1, 0.22, 0.14), (1.9, 0, 0.1, 0.3, 0.16), (2.05, 0, 0.1, 0.32, 0.15)], seg=12, caps=True)
    for sx in (-1, 1):
        lg.capsule(V((sx * 0.33, 0.1, 2.0)), V((sx * 0.3, 0.1, 1.3)), 0.07, 0.06, seg=8)
        lg.sphere(V((sx * 0.3, 0.08, 1.25)), (0.06, 0.07, 0.08), seg=8)
    _granite(m, b, '#3A3436')
    _granite(m, lg)
    hd = Part()
    hd.sphere(V((0, 0.1, 2.22)), (0.13, 0.14, 0.16), seg=14)
    hd.loft([(2.05, 0, 0.14, 0.25, 0.12), (2.3, 0, 0.14, 0.2, 0.14), (2.4, 0, 0.12, 0.15, 0.12)], seg=12, a0=-40, a1=220, caps=False)
    for sx in (-1, 1):   # the lappets of the headcloth over the chest
        hd.box((sx * 0.13, -0.02, 1.98), (0.08, 0.04, 0.28))
    hd.capsule(V((0, 0.02, 2.0)), V((0, 0.0, 1.88)), 0.03, 0.02, seg=6)   # the beard
    _granite(m, hd)
    st = Part()
    for z in (2.12, 2.2, 2.28, 2.36):
        st.loft([(z, 0, 0.14, 0.255, 0.145), (z + 0.03, 0, 0.14, 0.255, 0.145)], seg=12, a0=-40, a1=220, caps=False)
    m.add(st, '#C8A860', rough=0.3, metal=0.9)
    ey = Part()
    for sx in (-1, 1):
        ey.sphere(V((sx * 0.05, -0.03, 2.25)), (0.028, 0.01, 0.014), seg=8)
    m.add(ey, '#9FE8FF', rough=0.3, emit=1.0)
    cr = Part()   # cracks where the marid got in, lit from inside
    rnd = random.Random(3)
    for k in range(8):
        z = rnd.uniform(0.7, 2.0)
        x = rnd.uniform(-0.18, 0.18)
        cr.capsule(V((x, -0.16, z)), V((x + rnd.uniform(-0.08, 0.08), -0.16, z - rnd.uniform(0.1, 0.25))), 0.008, 0.003, seg=4)
    m.add(cr, '#7FE0FF', rough=0.3, emit=0.6)
    return m


def ram():
    """The Ram of the Avenue: a ram-headed sphinx in sandstone, 4 m, crouched as on its plinth, with a king between its
    forepaws; possessed, its eyes and the cracks in it burn river-blue. Front is -Y."""
    m = Model('ram')
    s = '#C8A878'
    b = Part()
    b.sloft([(V((0, y, 0.95)), V((1, 0, 0)), V((0, 0, 1)), rx, rz) for y, rx, rz in ((1.9, 0.4, 0.5), (1.2, 0.72, 0.85), (0.0, 0.8, 0.95),
                                                                                     (-0.9, 0.78, 0.95), (-1.3, 0.6, 0.8))], seg=16, p=2.4)
    for sx in (-1, 1):   # haunches and forelegs laid along the ground
        b.sphere(V((sx * 0.62, 1.2, 0.55)), (0.4, 0.8, 0.55), seg=12)
        b.capsule(V((sx * 0.45, -0.8, 0.25)), V((sx * 0.45, -2.1, 0.2)), 0.22, 0.2, seg=10)
    b.capsule(V((0.3, 1.9, 0.5)), V((0.6, 2.4, 0.2)), 0.1, 0.06, seg=8)   # the tail, curled round
    m.add(b, s, rough=0.8)
    hd = Part()
    hd.sphere(V((0, -1.55, 1.95)), (0.42, 0.55, 0.45), seg=16)
    hd.sphere(V((0, -2.05, 1.8)), (0.26, 0.34, 0.28), seg=12)   # the muzzle
    hd.loft([(1.2, 0, -1.4, 0.55, 0.5), (1.75, 0, -1.45, 0.5, 0.45)], seg=14, caps=False)   # the mane
    m.add(hd, s, rough=0.8)
    hn = Part()
    for sx in (-1, 1):   # the ram's horns, curled down and round
        pts = []
        for i in range(12):
            a = i / 11 * TAU * 0.85
            r = 0.38 - 0.02 * i
            pts.append(V((sx * (0.36 + 0.06 * i / 11), -1.55 + r * math.sin(a) * 0.7, 2.15 - r + r * math.cos(a))))
        hn.sweep(pts, lambda t: 0.12 * (1 - 0.8 * t) + 0.02, seg=8)
    m.add(hn, '#B89868', rough=0.7)
    kg = Part()   # the little king between the paws
    kg.box((0, -1.7, 0.6), (0.34, 0.3, 0.9))
    kg.sphere(V((0, -1.72, 1.15)), (0.11, 0.12, 0.14), seg=10)
    m.add(kg, '#B89868', rough=0.8)
    ey = Part()
    for sx in (-1, 1):
        ey.sphere(V((sx * 0.22, -1.98, 2.0)), (0.05, 0.02, 0.035), seg=8)
    m.add(ey, '#9FE8FF', rough=0.3, emit=1.0)
    cr = Part()
    rnd = random.Random(9)
    for k in range(18):
        y = rnd.uniform(-1.2, 1.8)
        a = rnd.uniform(-1.3, 1.3)
        p0 = V((0.8 * math.sin(a), y, 0.95 + 0.9 * math.cos(a)))
        cr.capsule(p0, p0 + V((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.2, 0.2), -rnd.uniform(0.15, 0.3))), 0.016, 0.004, seg=4)
    m.add(cr, '#7FE0FF', rough=0.3, emit=0.6)
    return m


def coil():
    """One coil of the serpent: 16 m of body in a slow S, black scales with a sheen, pale belly plates. It runs along X."""
    m = Model('coil')
    pts, belly = [], []
    for i in range(33):
        f = i / 32
        x = -8 + 16 * f
        y = 1.2 * math.sin(f * TAU * 0.75)
        z = 0.9 + 0.8 * math.sin(f * math.pi)
        pts.append(V((x, y, z)))
        belly.append(V((x, y, z - 0.9)))
    b = Part()
    b.sweep(pts, lambda t: 1.1 + 0.25 * math.sin(math.pi * t), seg=16)
    m.add(b, '#16141C', rough=0.25, metal=0.5)
    sc = Part()
    rnd = random.Random(5)
    for i in range(120):   # a sheen of larger scales along the back
        f = rnd.random()
        k = int(f * 32)
        p = pts[k].lerp(pts[min(32, k + 1)], f * 32 - k)
        a = rnd.uniform(-1.2, 1.2)
        sc.sphere(p + V((0, 1.05 * math.sin(a), 1.05 * math.cos(a))), (0.22, 0.18, 0.06), seg=6)
    m.add(sc, '#2A2638', rough=0.2, metal=0.7)
    bl = Part()
    bl.sweep(belly, (0.7, 0.2), seg=8, hint=V((0, 1, 0)))
    m.add(bl, '#8A8270', rough=0.5)
    return m


CREATURES = [
    ('marid', marid_skeleton, marid, MARID_CLIPS),
    ('naddaha', naddaha_skeleton, naddaha, NADDAHA_CLIPS),
]
STATICS = [('timthal', timthal), ('ram', ram), ('coil', coil)]
