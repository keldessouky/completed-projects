"""Act VI's own things, Across the Red Sea (GDD §9, brief §5: folklore only).

  duwais     Umm al-Duwais of the stories of the Arabian coasts: a woman in a flowing robe of deep plum, gold at the
             hem, the wrists and the ears, black hair loose to the waist, sweet with perfume; where her right hand should
             be, a sickle-blade (the duwais), with which she takes those who follow her
  horseman   the Brass Horseman of the City of Brass (from the Thousand and One Nights), guardian of Iram's ruins: a
             rider in brass on a horse of brass, a lance couched, a round shield, the metal green at the seams; a
             possessed thing, one static mesh
  apep       Apep, the serpent of the dark who swallows the sun (ancient Egyptian): rearing from its own coils, black
             scales with a violet sheen, pale belly plates, eyes of white fire; one static mesh

Shiqq of Shibam (the half-man of the old Arab lore: one arm, one leg, one eye) is the nasnas grown tall, tinted with
mud; al-Hatif, the voice in the sands, is the sand-wraith's shroud gone pale.
"""
import math
import random
from mathutils import Vector as V

from qart.geom import Part, TAU
from qart.model import Model
from characters import atlas, nile
from characters.jinn import _H, _frame

DUWAIS = dict(skin='#B8845E', robe='#3A1E34', robe2='#5A2E4E', hair='#0E0C10', eye='#FFD08A', gold='#D8A83A', blade='#B8BEC6')


def duwais_skeleton():
    return atlas.qandisha_skeleton()


def duwais(J):
    rnd = random.Random(23)
    m = Model('duwais', J)
    H, T_ = _H(J)
    pel, ch, nk = H('pelvis'), H('chest'), H('neck')
    h0, h1 = H('head'), T_('head')
    k = (h1.z - h0.z) / 0.24
    hc = h0 + V((0, 0.0, 0.105 * k))
    b = Part()   # face, arms, the left hand
    b.sphere(hc, (0.076 * k, 0.089 * k, 0.108 * k), seg=22)
    b.sphere(hc + V((0, -0.03, -0.07)) * k, (0.056 * k, 0.06 * k, 0.05 * k), seg=16)
    b.capsule(nk + V((0, 0.01, -0.03)), hc + V((0, 0, -0.08)) * k, 0.046 * k, seg=12)
    for s_ in 'LR':
        b.capsule(H('upperarm_' + s_), H('forearm_' + s_), 0.042, 0.036, seg=10)
        b.capsule(H('forearm_' + s_), H('hand_' + s_), 0.034, 0.026, seg=10)
    wr, ht = H('hand_L'), T_('hand_L')
    d, u, v = _frame(wr, ht)
    for f in range(4):
        bb = wr + v * ((f - 1.5) * 0.016)
        b.capsule(bb, bb + d * 0.14 + u * 0.01, 0.009, 0.004, seg=5)
    m.add(b, DUWAIS['skin'], rough=0.35, bones=['head', 'neck', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'],
          sigma=0.06, voxel=0.007, smooth=3, tris=1200)
    for s_ in (-1, 1):
        e = Part()
        e.sphere(hc + V((s_ * 0.028, -0.079, 0.016)) * k, (0.013 * k, 0.005 * k, 0.007 * k), seg=8)
        m.add(e, DUWAIS['eye'], rough=0.3, emit=1.0, bone='head')
    # the sickle for a right hand: a grip in the wrist, a curved blade sweeping forward and up
    wr, ht = H('hand_R'), T_('hand_R')
    d, u, v = _frame(wr, ht)
    sk = Part()
    pts = [wr + d * (0.05 + 0.3 * math.sin(a)) + u * (0.25 * (1 - math.cos(a))) for a in [math.pi * 0.75 * j / 10 for j in range(11)]]
    sk.sweep(pts, lambda t: (0.006, 0.04 * (1 - 0.8 * t)), seg=4, hint=v)
    m.add(sk, DUWAIS['blade'], rough=0.2, metal=1.0, bones=['hand_R'], sigma=0.05)
    # the robe: from the shoulders to the ground, flowing, a band of gold at the hem
    sh_z = H('upperarm_L').z
    foot = H('foot_L').z
    g = Part()
    g.loft([(nk.z - 0.02, 0, 0.01, 0.08, 0.07, 0.0), (sh_z - 0.03, 0, 0.012, 0.18, 0.12, 0.0), (ch.z + 0.05, 0, 0.012, 0.16, 0.12, 0.01),
            (pel.z + 0.1, 0, 0.01, 0.16, 0.12, 0.015), (pel.z - 0.3, 0, 0.02, 0.24, 0.2, 0.03), (foot + 0.02, 0, 0.04, 0.34, 0.3, 0.06)],
           seg=34, caps=False, folds=8, phase=0.4)
    m.add(g, DUWAIS['robe'], rough=0.45, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R'], sigma=0.2, solidify=0.01,
          recalc=False, tris=1600)
    hm = Part()
    hm.loft([(foot + 0.02, 0, 0.04, 0.342, 0.302), (foot + 0.1, 0, 0.04, 0.33, 0.29)], seg=34, caps=False)
    m.add(hm, DUWAIS['gold'], rough=0.3, metal=0.9, bones=['calf_L', 'calf_R'], sigma=0.2, solidify=0.008, recalc=False)
    for s_ in 'LR':   # wide sleeves, gold at the cuff
        sl = Part()
        sl.capsule(H('upperarm_' + s_), H('forearm_' + s_).lerp(H('hand_' + s_), 0.8), 0.06, 0.07, seg=12)
        m.add(sl, DUWAIS['robe2'], rough=0.45, bones=['upperarm_' + s_, 'forearm_' + s_, 'clavicle_' + s_], sigma=0.06, solidify=0.006,
              recalc=False)
        gb = Part()
        c = H('forearm_' + s_).lerp(H('hand_' + s_), 0.85)
        gb.sloft([(c + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.075, 0.075) for dz in (-0.015, 0.015)], seg=12)
        m.add(gb, DUWAIS['gold'], rough=0.25, metal=1.0, bones=['forearm_' + s_], sigma=0.05)
    # the hair, loose to the waist; gold at the ears
    hair = Part()
    for f in range(18):
        a = math.pi * (-0.05 + 1.1 * f / 17)
        root = hc + V((0.075 * k * math.cos(a), 0.02 + 0.05 * math.sin(a), 0.07 * k))
        L = rnd.uniform(0.7, 0.9)
        pts = [root]
        for i in range(1, 6):
            pts.append(root + V((0.06 * math.cos(a) * i / 5 + 0.015 * math.sin(i + f), 0.06 + 0.02 * i, -L * i / 5)))
        hair.sweep(pts, lambda t: (0.006, 0.035 * (1 - 0.5 * t)), seg=4, hint=V((math.cos(a), 0.5, 0)))
    m.add(hair, DUWAIS['hair'], rough=0.3, metal=0.1, bones=['head', 'neck', 'chest', 'spine'], sigma=0.2)
    er = Part()
    for s_ in (-1, 1):
        c = hc + V((s_ * 0.078, 0.0, -0.03)) * k
        er.sweep([c + V((0, 0.02 * math.cos(a), -0.03 - 0.02 * math.sin(a))) for a in [TAU * j / 10 for j in range(11)]], 0.004, seg=4)
    m.add(er, DUWAIS['gold'], rough=0.25, metal=1.0, bone='head')
    return m


def horseman():
    """The Brass Horseman: about 3.4 m to the lance's tip; the horse faces -Y (the way the engine's static meshes face)."""
    m = Model('horseman')
    brass, verd, dark = '#B8923A', '#5A8A6A', '#3A2E1A'
    h = Part()   # the horse
    h.sphere(V((0, 0.1, 1.45)), (0.42, 0.95, 0.46), seg=20)
    h.capsule(V((0, -0.7, 1.6)), V((0, -1.05, 2.25)), 0.22, 0.18, seg=12)
    h.sphere(V((0, -1.25, 2.3)), (0.14, 0.34, 0.16), seg=12)
    for sx in (-1, 1):
        for y in (-0.55, 0.75):
            h.capsule(V((sx * 0.22, y, 1.2)), V((sx * 0.24, y - 0.05, 0.62)), 0.1, 0.07, seg=8)
            h.capsule(V((sx * 0.24, y - 0.05, 0.62)), V((sx * 0.24, y, 0.08)), 0.065, 0.06, seg=8)
        h.sphere(V((sx * 0.08, -1.12, 2.5)), (0.04, 0.03, 0.08), seg=6)   # the ears
    h.capsule(V((0, 1.0, 1.55)), V((0, 1.3, 0.95)), 0.08, 0.04, seg=8)   # the tail
    m.add(h, brass, rough=0.3, metal=1.0)
    mn = Part()   # the mane, and the green of old brass at the seams
    mn.sweep([V((0, -0.72 + 0.04 * i, 1.9 + 0.1 * i)) for i in range(8)][::-1], (0.03, 0.06), seg=4, hint=V((1, 0, 0)))
    for sx in (-1, 1):
        mn.sweep([V((sx * 0.43, y, 1.45 + 0.05 * math.sin(y * 3))) for y in [-0.7 + 1.5 * j / 8 for j in range(9)]], 0.015, seg=4)
    m.add(mn, verd, rough=0.6, metal=0.3)
    r = Part()   # the rider
    r.sphere(V((0, 0.15, 2.2)), (0.26, 0.2, 0.34), seg=16)
    r.sphere(V((0, 0.1, 2.72)), (0.14, 0.15, 0.17), seg=14)
    r.sloft([(V((0, 0.1, z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for z, rr in ((2.78, 0.16), (2.98, 0.1), (3.12, 0.02))], seg=12)   # helm
    for sx in (-1, 1):
        r.capsule(V((sx * 0.26, 0.15, 2.3)), V((sx * 0.36, -0.1, 2.0)), 0.07, 0.06, seg=8)
        r.capsule(V((sx * 0.2, 0.1, 1.85)), V((sx * 0.46, -0.05, 1.3)), 0.09, 0.07, seg=8)
    m.add(r, brass, rough=0.28, metal=1.0)
    ln = Part()   # the lance couched under the right arm, far forward
    ln.capsule(V((0.36, 0.5, 2.05)), V((0.3, -2.4, 2.15)), 0.035, seg=8)
    ln.sloft([(V((0.3, y, 2.15)), V((1, 0, 0)), V((0, 0, 1)), w, w) for y, w in ((-2.4, 0.05), (-2.75, 0.001))], seg=8)
    m.add(ln, dark, rough=0.5, metal=0.6)
    sh = Part()   # the round shield on the left arm
    sh.sloft([(V((-0.5, dy, 2.0)), V((0, 1, 0)), V((0, 0, 1)), 0.34, 0.34) for dy in (-0.05, 0.02)], seg=18)
    m.add(sh, brass, rough=0.25, metal=1.0)
    ey = Part()   # the light in the helm's slit
    ey.box(V((0, -0.05, 2.78)), (0.14, 0.02, 0.02))
    m.add(ey, '#FFE08A', rough=0.3, emit=2.0)
    return m


def apep():
    """Apep rearing: coils on the ground (about 3 m across), the neck rising to about 5 m, the head facing -Y."""
    m = Model('apep')
    coils, pts = Part(), []
    for i in range(49):   # two turns of coil round the base, rising
        a = TAU * 2 * i / 48
        r_ = 1.5 - 0.35 * i / 48
        pts.append(V((r_ * math.cos(a), r_ * math.sin(a), 0.35 + 0.3 * i / 48)))
    for i in range(1, 15):   # then up and forward, the neck
        t = i / 14
        pts.append(V((0.0 + 0.1 * math.sin(t * 3), 0.6 - 1.6 * t, 0.65 + 4.3 * math.sin(t * math.pi / 2))))
    coils.sweep(pts, lambda t: 0.42 - 0.18 * max(0.0, (t - 0.75) / 0.25), seg=14)
    m.add(coils, '#16121E', rough=0.22, metal=0.5)
    sc = Part()
    rnd = random.Random(9)
    for _ in range(160):   # the violet sheen of the larger scales
        f = rnd.random()
        i = int(f * (len(pts) - 1))
        p = pts[i].lerp(pts[i + 1], f * (len(pts) - 1) - i)
        sc.sphere(p + V((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0.3)), (0.14, 0.12, 0.04), seg=6)
    m.add(sc, '#4A3A6A', rough=0.2, metal=0.7)
    hd = Part()
    top = pts[-1]
    hd.sphere(top + V((0, -0.35, 0.05)), (0.42, 0.62, 0.3), seg=18)
    hd.sphere(top + V((0, -0.9, 0.0)), (0.3, 0.3, 0.2), seg=14)
    m.add(hd, '#1A1624', rough=0.25, metal=0.5)
    for sx in (-1, 1):
        e = Part()
        e.sphere(top + V((sx * 0.24, -0.62, 0.16)), (0.07, 0.09, 0.05), seg=8)
        m.add(e, '#F0F4FF', rough=0.2, emit=3.0)
    fg = Part()   # the fangs
    for sx in (-1, 1):
        fg.capsule(top + V((sx * 0.12, -1.08, -0.05)), top + V((sx * 0.12, -1.1, -0.28)), 0.03, 0.005, seg=6)
    m.add(fg, '#E8E0D0', rough=0.3)
    bl = Part()   # pale belly plates up the front of the neck
    bl.sweep([p + V((0, -0.3, 0)) for p in pts[49:]], (0.2, 0.05), seg=6, hint=V((0, -1, 0)))
    m.add(bl, '#8A8270', rough=0.5)
    return m


CREATURES = [
    ('duwais', duwais_skeleton, duwais, atlas.QANDISHA_CLIPS),
]
STATICS = [('horseman', horseman), ('apep', apep)]
