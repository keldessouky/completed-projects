"""Act III's creatures, the Western Desert (GDD §9, brief §5: folklore only).

  wraith   the Sand-Wraith of Siwa: a hooded shroud with nothing inside but blown sand and two points of light, a crown
           of salt crystals, its hem trailing away into a dust stream; it floats
  mamluk   the Iron Mamluk of Bab al-Futuh (Trial II): an empty suit of Mamluk armour the gate's jinn wear: a pointed
           helmet with a nasal and a mail aventail, lamellar over mail, a round shield and a flanged mace

The hyena of the old stories (al-dab', whose gaze bewitches the traveller who meets it) and the salt jinn are the
Qutrub and the Sand Jinn, tinted by the game.
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


# ================================================================ the Sand-Wraith of Siwa
WRAITH = dict(shroud='#C8B894', shroud2='#A8966E', void='#0A0806', eye='#FFE8A0', salt='#F4F0E8', dust='#D8C49A')


def wraith_skeleton():
    return rig.humanoid(height=2.7, shoulder=0.24, hip=0.11, arm_drop=60.0, hunch=0.25, arm_len=1.25, leg_len=0.9)


def wraith(J):
    rnd = random.Random(41)
    m = Model('wraith', J)
    H, T_ = _H(J)
    pel, ch, nk = H('pelvis'), H('chest'), H('neck')
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    # the shroud: from the hood down over the shoulders, falling to a ragged hem that is not quite touching the ground
    sh = Part()
    sh.loft([(h0.z + 0.28, 0, 0.02, 0.06, 0.06, 0.0), (h0.z + 0.18, 0, 0.02, 0.16, 0.17, 0.0), (nk.z, 0, 0.02, 0.18, 0.16, 0.01),
             (H('upperarm_L').z - 0.05, 0, 0.02, 0.3, 0.2, 0.02), (ch.z, 0, 0.03, 0.28, 0.2, 0.03), (pel.z, 0, 0.05, 0.3, 0.24, 0.05),
             (pel.z * 0.5, 0, 0.08, 0.38, 0.3, 0.08), (0.25, 0, 0.1, 0.44, 0.36, 0.1)], seg=32, caps=False, folds=8, phase=0.7)
    m.add(sh, WRAITH['shroud'], rough=0.95, bones=['head', 'neck', 'chest', 'spine', 'pelvis', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'],
          sigma=0.2, solidify=0.012, recalc=False, tris=1800)
    face = Part()   # the hood's opening: nothing inside
    face.sphere(h0 + up * 0.12 + fw * 0.06, (0.11, 0.06, 0.13), seg=14)
    m.add(face, WRAITH['void'], rough=1.0, bones=['head'])
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.14 + fw * 0.11 + V((s * 0.04, 0, 0)), (0.018, 0.01, 0.012), seg=8)
        m.add(e, WRAITH['eye'], rough=0.3, emit=1.0, bone='head')
    # sleeves hanging from the arms, and long hands of packed sand
    for s in 'LR':
        sl = Part()
        sl.capsule(H('upperarm_' + s), H('forearm_' + s), 0.065, 0.07, seg=12)
        sl.capsule(H('forearm_' + s), H('hand_' + s), 0.07, 0.09, seg=12)
        el, wr = H('forearm_' + s), H('hand_' + s)   # the sleeve's hanging cloth, below the forearm
        sl.sweep([el.lerp(wr, 0.3) - V((0, 0, 0.05)), el.lerp(wr, 0.6) - V((0, 0, 0.25)), el.lerp(wr, 0.8) - V((0, -0.02, 0.5))],
                 lambda t: (0.006, 0.08 * (1 - 0.5 * t)), seg=4, hint=V((1, 0, 0)))
        m.add(sl, WRAITH['shroud2'], rough=0.95, bones=['upperarm_' + s, 'forearm_' + s, 'clavicle_' + s], sigma=0.08, solidify=0.01,
              recalc=False)
        hd = Part()
        wr, ht = H('hand_' + s), T_('hand_' + s)
        d, u, v = _frame(wr, ht)
        for k in range(4):
            b = wr + v * ((k - 1.5) * 0.028)
            hd.capsule(b, b + d * 0.22 + u * 0.03, 0.018, 0.004, seg=5)
        m.add(hd, WRAITH['dust'], rough=0.95, bone='hand_' + s)
    # a crown of salt crystals standing up from the hood
    cr = Part()
    for k in range(9):
        a = math.pi * (0.15 + 0.7 * k / 8)
        b = h0 + up * 0.26 + V((0.12 * math.cos(a), 0.04 - 0.1 * math.sin(a), 0))
        cr.capsule(b, b + up * rnd.uniform(0.12, 0.26) + V((0.03 * math.cos(a), -0.02, 0)), 0.02, 0.004, seg=5)
    m.add(cr, WRAITH['salt'], rough=0.2, emit=0.15, bones=['head'])
    # the hem trails away as a stream of dust
    du = Part()
    for k in range(18):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(0.3, 0.5)
        p0 = V((r * math.cos(a), r * math.sin(a) + 0.1, rnd.uniform(0.15, 0.45)))
        du.sweep([p0, p0 + V((0.1 * math.cos(a), 0.25, -0.12)), p0 + V((0.15 * math.cos(a), 0.55, -0.2))], lambda t: (0.005, 0.05 * (1 - t)), seg=4,
                 hint=V((0, 0, 1)))
    m.add(du, WRAITH['dust'], rough=0.95, bones=['pelvis', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.3)
    return m


def wraith_idle(P, t):
    float_idle(P, t)
    P.off['root'] = V((0, 0, 0.2 + 0.06 * math.sin(t / 2.4 * TAU)))


def wraith_death(P, t):
    wraith_idle(P, t)
    k = keys(t, [(0.0, 0.0), (1.4, 1.0)])
    P.off['root'] = V((0, 0, 0.2 - 2.4 * k))   # it collapses into the sand it was
    P.rot['spine'] = eul(30 * k, 0, 0)


WRAITH_CLIPS = [
    Clip('idle', 2.4, wraith_idle, loop=True),
    Clip('run', 0.8, float_run, loop=True),
    Clip('combo', 1.3, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('wail', 1.9, ghoula.wail, events={'hit': 1.0}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.6, wraith_death),
]


# ================================================================ the Iron Mamluk of Bab al-Futuh
MAMLUK = dict(iron='#4A4D52', iron2='#5E6268', brass='#C89A45', mail='#3A3C40', cloth='#6A1E1A', leather='#4A3325', eye='#5AB8FF',
              wood='#5A3E26')


def mamluk_skeleton():
    return rig.humanoid(height=2.35, shoulder=0.26, hip=0.12, arm_drop=55.0, hunch=0.1, arm_len=1.05, leg_len=1.0)


def mamluk(J):
    m = Model('mamluk', J)
    H, T_ = _H(J)
    pel, ch, nk = H('pelvis'), H('chest'), H('neck')
    # mail everywhere under the plates
    ml = Part()
    ml.capsule(H('spine'), T_('chest'), 0.24, 0.2, seg=14)
    ml.sphere(pel, (0.22, 0.17, 0.16), seg=14)
    for s in 'LR':
        ml.capsule(H('upperarm_' + s), H('forearm_' + s), 0.09, 0.08, seg=12)
        ml.capsule(H('forearm_' + s), H('hand_' + s), 0.08, 0.07, seg=12)
        ml.capsule(H('thigh_' + s), H('calf_' + s), 0.11, 0.09, seg=12)
        ml.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.1)), 0.09, 0.08, seg=12)
    m.add(ml, MAMLUK['mail'], rough=0.5, metal=0.8, bones=['pelvis', 'spine', 'chest', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R',
                                                           'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.1, voxel=0.018, smooth=3, tris=1400)
    # lamellar: rows of small plates round the torso, down to a skirt of plates
    lm = Part()
    for i in range(8):
        z = pel.z - 0.3 + i * 0.12
        r = 0.26 if z > pel.z else 0.3
        for j in range(22):
            a = TAU * j / 22
            lm.box(V((r * math.cos(a), 0.02 + r * 0.8 * math.sin(a), z)), (0.07, 0.02, 0.1), rot=Matrix.Rotation(a + math.pi / 2, 4, 'Z'))
    m.add(lm, MAMLUK['iron2'], rough=0.4, metal=0.9, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R'], sigma=0.18)
    sp = Part()   # pauldrons and greaves
    for s, sx in (('L', 1), ('R', -1)):
        sp.sphere(H('upperarm_' + s) + V((sx * 0.03, 0, 0.03)), (0.14, 0.14, 0.1), seg=12)
        sp.capsule(H('calf_' + s) + V((0, -0.05, 0)), H('calf_' + s).lerp(H('foot_' + s), 0.8) + V((0, -0.06, 0)), 0.08, 0.07, seg=10)
    m.add(sp, MAMLUK['iron'], rough=0.4, metal=0.9, bones=['clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R', 'calf_L', 'calf_R'], sigma=0.08)
    sash = Part()
    sash.loft([(pel.z + 0.06, 0, 0.02, 0.27, 0.2), (pel.z + 0.14, 0, 0.02, 0.27, 0.2)], seg=24, caps=False)
    m.add(sash, MAMLUK['cloth'], rough=0.9, bone='pelvis', solidify=0.01, recalc=False)
    # the helmet: a tall pointed bowl, a nasal, a mail aventail round the neck; inside, only the jinn's light
    h0, h1 = H('head'), T_('head')
    hm = Part()
    hm.sloft([(h0 + V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.12, 0.13), (0.24, 0.12), (0.34, 0.07), (0.44, 0.01))], seg=16)
    hm.box(h0 + V((0, -0.13, 0.12)), (0.03, 0.02, 0.14))
    m.add(hm, MAMLUK['iron'], rough=0.35, metal=0.9, bone='head')
    br = Part()
    br.sloft([(h0 + V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), 0.135, 0.135) for z in (0.12, 0.15)], seg=16)
    br.sphere(h0 + V((0, 0, 0.45)), 0.02, seg=6)
    m.add(br, MAMLUK['brass'], rough=0.3, metal=1.0, bone='head')
    av = Part()
    av.loft([(h0.z + 0.12, 0, 0.0, 0.13, 0.13), (nk.z - 0.02, 0, 0.0, 0.18, 0.17)], seg=20, a0=-60, a1=240, caps=False)
    m.add(av, MAMLUK['mail'], rough=0.5, metal=0.8, bones=['head', 'neck'], sigma=0.08, solidify=0.01, recalc=False)
    vd = Part()
    vd.sphere(h0 + V((0, -0.02, 0.06)), (0.1, 0.1, 0.11), seg=12)
    m.add(vd, '#0A0A0E', rough=1.0, bone='head')
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + V((s * 0.04, -0.11, 0.1)), (0.016, 0.008, 0.01), seg=8)
        m.add(e, MAMLUK['eye'], rough=0.3, emit=1.0, bone='head')
    # the round shield on the left forearm, the flanged mace in the right hand
    wl, el = H('hand_L'), H('forearm_L')
    d, u, v = _frame(el, wl)
    c = el.lerp(wl, 0.55) + u * 0.12
    shd = Part()
    shd.sloft([(c + u * dz, d, v, r, r) for dz, r in ((0.0, 0.32), (0.04, 0.3), (0.07, 0.1))], seg=20)
    m.add(shd, MAMLUK['wood'], rough=0.6, bones=['forearm_L'])
    bs = Part()
    bs.sloft([(c + u * (dz + 0.005), d, v, r, r) for dz, r in ((0.0, 0.33), (0.02, 0.33))], seg=20, caps=False)
    bs.sphere(c + u * 0.08, 0.06, seg=10)
    m.add(bs, MAMLUK['brass'], rough=0.3, metal=1.0, bones=['forearm_L'])
    wr, ht = H('hand_R'), T_('hand_R')
    d, u, v = _frame(wr, ht)
    g = wr.lerp(ht, 0.6)
    mc = Part()
    mc.capsule(g - d * 0.15, g + d * 0.55, 0.018, seg=8)
    m.add(mc, MAMLUK['wood'], rough=0.6, bone='hand_R')
    hd = Part()
    top = g + d * 0.55
    for k in range(6):
        a = TAU * k / 6
        off = (u * math.cos(a) + v * math.sin(a)) * 0.05
        hd.box(top + off + d * 0.02, (0.02, 0.02, 0.12))
    hd.sphere(top + d * 0.02, 0.045, seg=10)
    m.add(hd, MAMLUK['iron'], rough=0.35, metal=0.9, bone='hand_R')
    return m


MAMLUK_CLIPS = [
    Clip('idle', 2.6, ghoul.idle, loop=True),
    Clip('run', 0.6, ghoula.run, loop=True),
    Clip('combo', 1.3, ghoula.combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('leap', 1.3, ghoula.leap, events={'hit': 0.88}),
    Clip('wail', 1.9, ghoula.wail, events={'hit': 1.0}),
    Clip('summon', 1.5, ghoula.summon, events={'summon': 1.0}),
    Clip('slam', 1.3, ghoul.slam, events={'hit': 0.85}),
    Clip('cast', 1.1, cast, events={'hit': 0.6}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]


# ================================================================ Amm Ramadan, the antiquities dealer (Excavations)
def dealer_skeleton():
    return rig.humanoid(height=1.68, shoulder=0.2, arm_drop=62.0)


def dealer(J):
    """An old dealer in antiquities: a dark galabeya under a worn tweed jacket, a red tarboosh, round spectacles, and a
    small glazed figure held up to the light."""
    from characters import npc
    col = dict(npc.COL, skin='#8A5E40', hair='#E8E4DC', robe='#3E3A48', robe2='#2E2A36', vest='#6A5A3A', towel='#C8C0B0')
    m = npc.keeper(J, col=col, name='dealer')
    H, T_ = _H(J)
    head = H('head')
    tb = Part()
    tb.loft([(1.655, 0, 0.012, 0.094, 0.104), (1.72, 0, 0.012, 0.086, 0.094), (1.76, 0, 0.012, 0.078, 0.086)], seg=18, caps=True)
    m.add(tb, '#9A1E1A', rough=0.8, bone='head')
    ts = Part()
    ts.sweep([V((0, 0.01, 1.765)), V((0.03, 0.05, 1.74)), V((0.06, 0.07, 1.68))], 0.006, seg=4)
    m.add(ts, '#1A1414', rough=0.9, bone='head')
    gl = Part()
    for sx in (-1, 1):
        ring = [V((sx * 0.035 + 0.022 * math.cos(a), -0.1, 1.615 + 0.018 * math.sin(a))) for a in [TAU * k / 12 for k in range(12)]]
        gl.sweep(ring, 0.0035, seg=4, closed=True)
    gl.capsule(V((-0.013, -0.1, 1.615)), V((0.013, -0.1, 1.615)), 0.003, seg=4)
    m.add(gl, '#C89A45', rough=0.3, metal=1.0, bone='head')
    fg = Part()
    wr, ht = H('hand_R'), T_('hand_R')
    grip = wr.lerp(ht, 0.8)
    fg.sphere(grip + V((0, 0, 0.05)), (0.022, 0.018, 0.045), seg=10)
    fg.sphere(grip + V((0, 0, 0.11)), (0.018, 0.018, 0.02), seg=8)
    m.add(fg, '#3AA8A0', rough=0.25, emit=0.15, bone='hand_R')
    return m


def dealer_idle(P, t):
    # he lifts the figure to his spectacles, turns it, and lowers it again
    look = keys(t % 6.0, [(0.0, 0.0), (1.2, 1.0), (3.8, 1.0), (5.0, 0.0)])
    P.rot['spine'] = eul(6, 0, 0)
    P.rot['head'] = eul(8 + 10 * look + cyc(t, 3.0, 2), 0, cyc(t, 7.0, 6))
    P.rot['upperarm_R'] = eul(-30 - 45 * look, 0, -20 + 10 * look)
    P.rot['forearm_R'] = eul(-50 - 60 * look, 0, 25 * math.sin(t * 1.7) * look)
    P.rot['upperarm_L'] = eul(-10, 0, 8)
    P.rot['forearm_L'] = eul(-35, 0, 0)


DEALER_CLIPS = [Clip('idle', 6.0, dealer_idle, loop=True)]


CREATURES = [
    ('wraith', wraith_skeleton, wraith, WRAITH_CLIPS),
    ('mamluk', mamluk_skeleton, mamluk, MAMLUK_CLIPS),
    ('dealer', dealer_skeleton, dealer, DEALER_CLIPS),
]
STATICS = []
