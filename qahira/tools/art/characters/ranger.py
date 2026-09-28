"""The Ranger: a tracker from the oases of the Western Desert, who reads the sand the way the Sorcerer reads the sky. A
hooded cloak the colour of the dunes over a leather jerkin, an indigo scarf drawn over the mouth against the wind, a
falconer's gauntlet on the left forearm and a quiver of reed arrows on the back. The bow is a recurve of horn and
mulberry wood, held in the left hand.

Everything is placed relative to the rig's joints, so the same code fits any height.
"""
import math
import numpy as np
from mathutils import Vector as V

from qart.geom import Part, trees, hit_in, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul, frame_rot
from characters import warrior

COL = dict(skin='#8A5A3C', cloak='#B08A5A', cloak2='#8E6C43', jerkin='#5A3A24', tunic='#CDB791', pants='#3A3226',
           scarf='#2B3A6B', scarf2='#223056', leather='#4A3325', glove='#6B4A2E', eye='#2A1A10', brass='#C89A45',
           horn='#D8C7A0', wood='#6B3F22', string='#E8DCC0', fletch='#C9B48A', reed='#A88A55', sole='#17120F')


def skeleton():
    return rig.humanoid(height=1.80, shoulder=0.2, hip=0.105, arm_drop=54.0)


def build(J):
    m = Model('ranger', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    top = T_('head')
    k = (top.z - hd.z) / 0.24

    # ---------------- head, face and hands
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.08 * k, 0.094 * k, 0.106 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.066 * k, 0.07 * k, 0.062 * k), seg=20)
    h.capsule(hc + V((0, -0.088, 0.0)) * k, hc + V((0, -0.1, -0.03)) * k, 0.009 * k, 0.013 * k, seg=8)
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.058 * k, seg=14)
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        h.capsule(wr, wr + (ht - wr) * 0.9, 0.037, 0.031, seg=10)
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

    # the scarf: over the mouth and nose, round the neck, and a tail over the left shoulder
    sc = Part()
    sc.grid([ring(z, 0, 360, 32, 0.014) for z in np.linspace(hc.z - 0.11 * k, hc.z - 0.005 * k, 5)])
    m.add(sc, COL['scarf'], rough=0.9, bones=['head', 'neck'], sigma=0.08, solidify=0.007, sol_offset=-1, recalc=False, tris=600)
    nw = Part()
    nw.loft([(nk.z - 0.04, 0, 0.012, 0.11, 0.1), (nk.z + 0.02, 0, 0.01, 0.085, 0.08), (hc.z - 0.1 * k, 0, 0.012, 0.075 * k, 0.08 * k)],
            seg=28, caps=False, folds=4)
    m.add(nw, COL['scarf2'], rough=0.9, bones=['neck', 'chest', 'head'], sigma=0.08, solidify=0.007, sol_offset=-1, recalc=False)
    tail = Part()
    tail.sweep([V((0.08, -0.1, nk.z - 0.02)), V((0.14, -0.06, ch.z + 0.08)), V((0.16, 0.02, ch.z - 0.06))], (0.005, 0.045), seg=6,
               hint=V((1, 0, 0.2)))
    m.add(tail, COL['scarf'], rough=0.9, bone='chest')

    # the hood: a cowl over the crown that leaves the eyes open, falling to a peak at the back
    brow = hc.z + 0.035 * k
    hood = Part()
    rows = []
    for v in np.linspace(0, 1, 6):
        z = brow + (hc.z + 0.115 * k - brow) * v
        rows.append(ring(z, -45, 225, 26, 0.03 + 0.012 * (1 - v)))
    hood.grid(rows, closed=False, fan_top=hc + V((0, 0.03, 0.135 * k)))
    m.add(hood, COL['cloak'], rough=0.9, bone='head', solidify=0.008, sol_offset=-1, recalc=False, tris=500)
    back = Part()
    back.grid([ring(z, -60, 240, 24, 0.035 + 0.02 * (brow - z)) for z in np.linspace(hc.z - 0.1 * k, brow, 5)], closed=False)
    m.add(back, COL['cloak'], rough=0.9, bones=['head', 'neck'], sigma=0.08, solidify=0.008, sol_offset=-1, recalc=False, tris=500)

    # ---------------- tunic, jerkin and the cloak over the shoulders
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.155, 0.115), (pel.z + 0.12, 0.004, 0.145, 0.11), (ch.z, 0.01, 0.165, 0.12),
             (ch.z + 0.1, 0.014, 0.185, 0.125), (sh_z - 0.02, 0.018, 0.185, 0.115), (nk.z - 0.01, 0.02, 0.115, 0.088)]
    tu = Part()
    tu.loft([(z, 0, cy, rx - 0.004, ry - 0.004) for z, cy, rx, ry in torso], seg=28, caps=True)
    for s in 'LR':
        sh, el, wr = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s)
        tu.capsule(sh, el, 0.058, 0.05, seg=12)
        tu.capsule(el, el + (wr - el) * 0.85, 0.05, 0.045, seg=12)
    m.add(tu, COL['tunic'], rough=0.85, bones=['pelvis', 'spine', 'chest', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'],
          sigma=0.1, voxel=0.012, smooth=3, tris=900)
    je = Part()
    je.loft([(z, 0, cy, rx + 0.01, ry + 0.012) for z, cy, rx, ry in torso[:5]], seg=30, caps=False)
    m.add(je, COL['jerkin'], rough=0.6, bones=['pelvis', 'spine', 'chest'], sigma=0.12, solidify=0.01, recalc=False, tris=700)
    laces = Part()
    for i, z in enumerate(np.linspace(pel.z + 0.08, ch.z + 0.12, 5)):
        y = -0.135 - 0.01 * (z > ch.z)
        laces.capsule(V((-0.03, y, z)), V((0.03, y, z + 0.035)), 0.004, seg=4)
        laces.capsule(V((0.03, y, z)), V((-0.03, y, z + 0.035)), 0.004, seg=4)
    m.add(laces, COL['tunic'], rough=0.8, bone='chest')
    # the cloak: a short cape over the back and shoulders to mid-thigh, open at the front
    cl = Part()
    cl.loft([(nk.z - 0.01, 0, 0.03, 0.14, 0.12, 0.0), (sh_z - 0.02, 0, 0.034, 0.25, 0.16, 0.01), (ch.z + 0.02, 0, 0.05, 0.26, 0.19, 0.02),
             (pel.z + 0.04, 0, 0.07, 0.27, 0.21, 0.04), (pel.z - 0.24, 0, 0.09, 0.28, 0.22, 0.05)],
            seg=30, a0=20, a1=160, caps=False, folds=5, phase=0.6)
    m.add(cl, COL['cloak'], rough=0.9, bones=['chest', 'spine', 'pelvis', 'clavicle_L', 'clavicle_R'], sigma=0.14, solidify=0.009,
          recalc=False, tris=1000)
    for s, sx in (('L', 1), ('R', -1)):
        mt = Part()
        sh = H('upperarm_' + s)
        mt.sphere(sh + V((sx * 0.02, 0.01, 0.03)), (0.085, 0.09, 0.06), seg=14)
        m.add(mt, COL['cloak2'], rough=0.9, bones=['clavicle_' + s, 'upperarm_' + s], sigma=0.08)

    # ---------------- the gauntlet on the left forearm, a bracer on the right
    for s, big in (('L', True), ('R', False)):
        el, wr = H('forearm_' + s), H('hand_' + s)
        g = Part()
        g.capsule(el + (wr - el) * (0.25 if big else 0.45), wr + (wr - el) * (0.08 if big else 0.0), 0.062 if big else 0.055,
                  0.056 if big else 0.05, seg=14)
        m.add(g, COL['glove'], rough=0.55, bones=['forearm_' + s, 'hand_' + s], sigma=0.06, bevel=0.004)
        if big:
            st = Part()
            for f in (0.35, 0.6, 0.85):
                c = el + (wr - el) * f
                st.sphere(c, (0.066, 0.066, 0.008), seg=12)   # brass bands
            m.add(st, COL['brass'], rough=0.3, metal=1.0, bone='forearm_' + s)

    # ---------------- trousers, wraps and boots
    t = Part()
    t.sphere(pel + V((0, 0, -0.01)), (0.155, 0.115, 0.11), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.088, 0.07, seg=14)
        t.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.14)), 0.066, 0.056, seg=14)
    m.add(t, COL['pants'], rough=0.85, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012,
          smooth=4, tris=800)
    wraps = Part()
    for s in 'LR':
        kn, an = H('calf_' + s), H('foot_' + s)
        for f in np.linspace(0.35, 0.8, 5):
            c = kn + (an - kn) * f
            wraps.sphere(c, (0.068, 0.068, 0.012), seg=12)
    m.add(wraps, COL['cloak2'], rough=0.9, bones=['calf_L', 'calf_R'], sigma=0.05)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)

    # ---------------- belt with a knife and a pouch, the quiver on the back
    bl = Part()
    bl.loft([(pel.z - 0.02, 0, 0, 0.165, 0.128), (pel.z + 0.035, 0, 0, 0.165, 0.128)], seg=30, caps=False)
    m.add(bl, COL['leather'], rough=0.55, bone='pelvis', solidify=0.008, recalc=False)
    bk = Part()
    bk.box(V((0, -0.132, pel.z + 0.008)), (0.05, 0.012, 0.045))
    m.add(bk, COL['brass'], rough=0.3, metal=1.0, bone='pelvis')
    pouch = Part()
    pouch.box(V((0.16, -0.06, pel.z - 0.05)), (0.05, 0.1, 0.1))
    kn_ = Part()
    kn_.box(V((-0.16, -0.04, pel.z - 0.08)), (0.03, 0.05, 0.18))
    m.add(pouch, COL['leather'], rough=0.6, bone='pelvis', bevel=0.01)
    m.add(kn_, COL['glove'], rough=0.5, bone='pelvis', bevel=0.006)
    q0 = V((0.1, 0.17, pel.z + 0.02))
    q1 = V((-0.12, 0.17, sh_z + 0.12))
    qv = Part()
    qv.capsule(q0, q1, 0.05, 0.058, seg=14)
    m.add(qv, COL['leather'], rough=0.6, bones=['chest', 'spine'], sigma=0.1)
    qr = Part()
    for f in (0.1, 0.92):
        qr.sphere(q0 + (q1 - q0) * f, (0.062, 0.062, 0.012), seg=12)
    m.add(qr, COL['brass'], rough=0.3, metal=1.0, bones=['chest', 'spine'], sigma=0.1)
    ar = Part()
    fl = Part()
    d = (q1 - q0).normalized()
    for i in range(7):
        a = TAU * i / 7
        o = V((0.03 * math.cos(a), 0.022 * math.sin(a), 0))
        base = q1 + o - d * 0.05
        tip = q1 + o + d * 0.14
        ar.capsule(base, tip, 0.004, seg=4)
        fl.sweep([tip - d * 0.08, tip - d * 0.01], (0.002, 0.012), seg=4, hint=o if o.length > 0 else V((1, 0, 0)))
    m.add(ar, COL['reed'], rough=0.7, bone='chest')
    m.add(fl, COL['fletch'], rough=0.9, bone='chest')
    st = Part()
    st.sweep([V((0.17, -0.12, sh_z + 0.02)), V((0.06, -0.15, ch.z + 0.06)), V((-0.08, -0.14, ch.z - 0.08)),
              V((-0.15, -0.1, pel.z + 0.1))], (0.004, 0.016), seg=6, hint=V((0, -1, 0)))
    m.add(st, COL['leather'], rough=0.6, bones=['chest', 'spine'], sigma=0.15)
    return m


def build_bow():
    """Weapon frame: grip at the origin, the stave along +Z, the string on the +X side (towards the archer). A recurve
    of mulberry wood with horn on the belly, sinew-wrapped, its tips flicking forward."""
    m = Model('bow')
    L = 0.62

    def limb(sgn):
        pts = []
        for u in np.linspace(0, 1, 14):
            z = sgn * (0.06 + L * u)
            # bowed away from the string, then recurved forward over the last fifth
            x = -0.04 * math.sin(u * math.pi * 0.85) + 0.07 * max(0.0, u - 0.8) / 0.2
            pts.append(V((x, 0, z)))
        return pts
    w = Part()
    for sgn in (1, -1):
        w.sweep(limb(sgn), lambda u: 0.016 - 0.009 * u, seg=8)
    w.capsule(V((0.0, 0, -0.08)), V((0.0, 0, 0.08)), 0.02, seg=10)
    m.add(w, COL['wood'], rough=0.6)
    hb = Part()
    for sgn in (1, -1):
        pts = [p + V((0.01, 0, 0)) for p in limb(sgn)[:10]]
        hb.sweep(pts, lambda u: 0.011 - 0.006 * u, seg=6)
    m.add(hb, COL['horn'], rough=0.4)
    gr = Part()
    gp = [V((0.023 * math.cos(kk * 0.6), 0.023 * math.sin(kk * 0.6), -0.07 + 0.14 * kk / 48)) for kk in range(49)]
    gr.sweep(gp, 0.004, seg=5)
    m.add(gr, COL['leather'], rough=0.6)
    tips = [limb(1)[-1], limb(-1)[-1]]
    s = Part()
    s.capsule(tips[0] + V((-0.004, 0, -0.02)), tips[1] + V((-0.004, 0, 0.02)), 0.0022, seg=4)
    m.add(s, COL['string'], rough=0.8)
    nk = Part()
    for p in tips:
        nk.sphere(p, 0.012, seg=8)
    m.add(nk, COL['brass'], rough=0.3, metal=1.0)
    return m


def build_arrow():
    """A loosed arrow, for the game's projectiles: the tip at +Y, 0.7 m of reed, a bronze head, three vanes."""
    m = Model('arrow')
    sh = Part()
    sh.capsule(V((0, -0.36, 0)), V((0, 0.3, 0)), 0.008, seg=6)
    m.add(sh, COL['reed'], rough=0.7)
    hd = Part()
    hd.sloft([(V((0, y, 0)), V((1, 0, 0)), V((0, 0, 1)), r, r * 0.4) for y, r in ((0.29, 0.012), (0.33, 0.02), (0.38, 0.001))], seg=6)
    m.add(hd, COL['brass'], rough=0.3, metal=1.0, emit=0.3)
    fl = Part()
    for i in range(3):
        a = TAU * i / 3
        d = V((math.cos(a), 0, math.sin(a)))
        fl.sweep([V((0, -0.34, 0)), V((0, -0.2, 0))], (0.004, 0.028), seg=4, hint=d)
    m.add(fl, COL['fletch'], rough=0.9)
    return m


# ====================================================================== animation
# The character faces -Y with its left side at +X. An archer turns side-on to shoot, the left shoulder to the target.
FWD = V((0, -1, 0))
UP = V((0, 0, 1))


def bow_rot(aim, cant=0.0):
    """The bow's frame: the stave up (tilted by cant towards the archer's right), the string back along the aim."""
    up = (UP + V((-math.sin(math.radians(cant)), 0, 0))).normalized()
    up = (up - aim * up.dot(aim)).normalized()
    return frame_rot(up, -aim)


def hold_bow(P, grip, aim, cant=10.0, pole=V((0.9, 0.3, -0.6))):
    wr = bow_rot(aim, cant)
    W = P.world()
    P.arm_ik('L', grip, W['upperarm_L'][1] + pole, weapon_rot=wr, wrist_rot=wr)


def right_hand(P, palm, pole=V((-0.6, 0.6, -0.3))):
    W = P.world()
    P.arm_ik('R', palm, W['upperarm_R'][1] + pole)


def head_pos(P):
    W = P.world()
    return W['head'][1]


def lowered(P):
    """The bow carried low in the left hand, the right hand loose."""
    W = P.world()
    sh = W['upperarm_L'][1]
    hold_bow(P, sh + V((0.12, -0.14, -0.46)), V((0.2, -1, -0.9)).normalized(), cant=0, pole=V((0.6, 0.4, -0.4)))
    shR = W['upperarm_R'][1]
    right_hand(P, shR + V((-0.1, -0.06, -0.5)), V((-0.6, 0.4, -0.2)))


def idle(P, t):
    P.rot['pelvis'] = eul(0, 0, -8)
    P.rot['spine'] = eul(3, 0, 5)
    warrior.stance_legs(P, t, crouch=-0.1)
    warrior.breathe(P, t, 0.9)
    P.rot['head'] = eul(-2 + cyc(t, 4.0, 2), 0, 4 + cyc(t, 5.6, 7))   # scanning the horizon
    lowered(P)


def run(P, t):
    T = 0.58
    ph = t / T * math.tau
    P.rot['pelvis'] = eul(0, 0, 8 * math.sin(ph))
    P.off['pelvis'] = V((0, 0, -0.02 + 0.035 * abs(math.sin(ph))))
    P.rot['spine'] = eul(10, 0, -8 * math.sin(ph))
    for s, o in (('L', 0.0), ('R', math.pi)):
        a = ph + o
        P.rot['thigh_' + s] = eul(-40 * math.sin(a) - 6, 0, 0)
        P.rot['calf_' + s] = eul(16 + 55 * max(0.0, math.sin(a - 1.2)) + 18 * max(0.0, -math.sin(a)), 0, 0)
        P.rot['foot_' + s] = eul(-10 + 16 * math.sin(a - 0.4), 0, 0)
    P.rot['head'] = eul(-6, 0, 4 * math.sin(ph))
    W = P.world()
    sh = W['upperarm_L'][1]
    hold_bow(P, sh + V((0.1, -0.1 - 0.12 * math.sin(ph + math.pi), -0.44)), V((0.1, -1, -0.5)).normalized(), cant=0,
             pole=V((0.6, 0.4, -0.4)))
    shR = W['upperarm_R'][1]
    right_hand(P, shR + V((-0.08, -0.05 + 0.14 * math.sin(ph), -0.44)), V((-0.5, 0.5, -0.3)))


def draw_pose(P, t, draw, loose, aim_up=0.0, crouch=0.0):
    """Side-on stance, bow arm out along the aim, the right hand drawn to the cheek (draw 0..1), then loosed."""
    turn = -55 * max(draw, loose)
    P.rot['pelvis'] = eul(0, 0, turn * 0.5)
    P.rot['spine'] = eul(2 - 6 * aim_up, 0, turn * 0.3)
    P.rot['chest'] = eul(-8 * aim_up, 0, turn * 0.25)
    warrior.stance_legs(P, t, crouch=crouch)
    P.rot['head'] = eul(-4 - 14 * aim_up, 0, -turn * 0.8)    # the eyes stay on the target
    aim = (FWD + UP * (1.1 * aim_up)).normalized()
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    rest_g = shL + V((0.12, -0.14, -0.46))
    up = max(draw, loose)
    grip = rest_g.lerp(shL + aim * 0.58 + V((0, 0, -0.02)), up)
    hold_bow(P, grip, aim.lerp(V((0.2, -1, -0.9)).normalized(), 1 - up).normalized(), cant=10 * up)
    # the right hand: from the quiver to the string at the grip, then back to the cheek; after the loose it springs back
    hd = head_pos(P)
    anchor = hd + V((-0.03, -0.1, -0.1)) + aim * 0.02
    nock = grip + V((-0.02, 0.1, 0.0))
    if loose > 0:
        palm = anchor.lerp(anchor + V((-0.12, 0.1, 0.02)), loose)
    else:
        palm = (shR + V((-0.08, -0.05, -0.44))).lerp(nock, keys(draw, [(0.0, 0.0), (0.4, 1.0)])).lerp(anchor, keys(draw, [(0.4, 0.0), (1.0, 1.0)]))
    right_hand(P, palm, V((-0.2, 0.9, 0.2)))


def shoot(P, t):
    # nock and draw to 0.3, hold a breath, loose at 0.34, follow through, recover by 0.6
    draw = keys(t, [(0.0, 0.0), (0.3, 1.0), (0.34, 1.0)])
    loose = keys(t, [(0.33, 0.0), (0.38, 1.0), (0.46, 1.0), (0.6, 0.0)])
    draw_pose(P, t, draw if t < 0.34 else 0.0, loose if t >= 0.33 else 0.0, crouch=0.1)


def shoot_up(P, t):
    draw = keys(t, [(0.0, 0.0), (0.34, 1.0), (0.4, 1.0)])
    loose = keys(t, [(0.39, 0.0), (0.44, 1.0), (0.54, 1.0), (0.7, 0.0)])
    draw_pose(P, t, draw if t < 0.4 else 0.0, loose if t >= 0.39 else 0.0, aim_up=1.0, crouch=0.2)


def cast(P, t):
    # a thrown sign: the gauntlet raised and swept towards the target (a falcon sent out), the bow held low
    raise_ = keys(t, [(0.0, 0.0), (0.2, 1.0), (0.26, 1.0)])
    out = keys(t, [(0.22, 0.0), (0.32, 1.0), (0.44, 1.0), (0.64, 0.0)])
    P.rot['pelvis'] = eul(0, 0, 12 * raise_ - 14 * out)
    P.rot['spine'] = eul(4 + 6 * out, 0, 10 * raise_ - 10 * out)
    warrior.stance_legs(P, t, crouch=0.15 * out)
    P.rot['head'] = eul(-6 * raise_, 0, 0)
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    g = (shL + V((0.12, -0.14, -0.46))).lerp(shL + V((0.14, -0.1, 0.18)), raise_).lerp(shL + V((-0.02, -0.6, 0.02)), out)
    hold_bow(P, g, V((0.2, -1, -0.9)).normalized().lerp(V((0.1, -1, 0.3)).normalized(), max(raise_, out)).normalized(), cant=40 * out)
    right_hand(P, shR + V((-0.08, -0.05, -0.44)))


def cast_ground(P, t):
    # kneel and press the right palm to the sand
    down = keys(t, [(0.0, 0.0), (0.4, 1.0), (0.62, 1.0), (0.8, 0.0)])
    P.rot['spine'] = eul(20 * down, 0, 0)
    P.rot['chest'] = eul(10 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.9 * down)
    P.rot['head'] = eul(10 * down, 0, 0)
    W = P.world()
    shR = W['upperarm_R'][1]
    lowered(P)
    right_hand(P, (shR + V((-0.08, -0.05, -0.44))).lerp(V((-0.1, -0.42, 0.12)), down), V((-0.7, 0.3, 0.2)))


def swing(P, t):
    # a backhand with the bow: its limb as a club
    wind = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.26, 1.0)])
    sw = keys(t, [(0.24, 0.0), (0.36, 1.0), (0.46, 1.0), (0.72, 0.0)])
    turn = -40 * wind + 70 * sw
    P.rot['pelvis'] = eul(0, 0, turn * 0.4)
    P.rot['spine'] = eul(6, 0, turn * 0.3)
    P.rot['chest'] = eul(4, 0, turn * 0.4)
    warrior.stance_legs(P, t, crouch=0.3 * wind + 0.4 * sw)
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    wind_g, end_g = shL + V((-0.2, -0.2, -0.05)), shL + V((0.45, -0.3, -0.15))
    wind_a, end_a = V((-1, -0.3, 0.2)).normalized(), V((1, -0.6, 0.0)).normalized()
    g = wind_g.lerp(end_g, sw) if sw > 0 else (shL + V((0.12, -0.14, -0.46))).lerp(wind_g, wind)
    a = wind_a.lerp(end_a, sw) if sw > 0 else V((0.2, -1, -0.9)).normalized().lerp(wind_a, wind)
    hold_bow(P, g, a.normalized(), cant=70 * max(wind, sw))
    right_hand(P, shR + V((-0.08, -0.05, -0.44)))


def slam(P, t):
    # a leap and a stamp: the bow raised overhead, then both feet down
    up = keys(t, [(0.0, 0.0), (0.34, 1.0), (0.44, 1.0), (0.47, 0.0)])
    down = keys(t, [(0.36, 0.0), (0.47, 1.0), (0.62, 1.0), (0.9, 0.0)])
    P.rot['spine'] = eul(4 - 12 * up + 22 * down, 0, 0)
    P.rot['chest'] = eul(-8 * up + 12 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.2 * up + 0.8 * down)
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    g = (shL + V((0.12, -0.14, -0.46))).lerp(shL + V((0.0, -0.1, 0.4)), up).lerp(shL + V((-0.05, -0.5, -0.3)), down)
    hold_bow(P, g, V((0.2, -1, -0.9)).normalized().lerp(V((0, -0.4, 1)).normalized(), up).lerp(V((0, -1, -0.8)).normalized(), down).normalized())
    right_hand(P, (shR + V((-0.08, -0.05, -0.44))).lerp(shR + V((-0.1, -0.4, -0.3)), down))


def warcry(P, t):
    k_ = keys(t, [(0.0, 0.0), (0.25, 1.0), (0.6, 1.0), (0.85, 0.0)])
    P.rot['spine'] = eul(-10 * k_, 0, 0)
    P.rot['chest'] = eul(-12 * k_, 0, 0)
    P.rot['head'] = eul(-20 * k_, 0, 0)
    warrior.stance_legs(P, t, crouch=0.3 * k_)
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    hold_bow(P, (shL + V((0.12, -0.14, -0.46))).lerp(shL + V((0.1, -0.1, 0.5)), k_),
             V((0.2, -1, -0.9)).normalized().lerp(V((0, -0.3, 1)).normalized(), k_).normalized())
    right_hand(P, (shR + V((-0.08, -0.05, -0.44))).lerp(shR + V((-0.3, -0.2, 0.2)), k_))


def dodge(P, t):
    r = keys(t, [(0.0, 0.0), (0.42, 1.0)])
    tuck = keys(t, [(0.0, 0.0), (0.08, 1.0), (0.34, 1.0), (0.46, 0.0)])
    P.off['root'] = V((0, 0, 0.5))
    P.off['pelvis'] = V((0, 0, -0.5 - 0.1 * tuck))
    P.rot['root'] = eul(360 * r, 0, 0)
    P.rot['spine'] = eul(30 * tuck, 0, 0)
    P.rot['chest'] = eul(25 * tuck, 0, 0)
    P.rot['head'] = eul(20 * tuck, 0, 0)
    for s in 'LR':
        P.rot['thigh_' + s] = eul(-95 * tuck, 0, 0)
        P.rot['calf_' + s] = eul(120 * tuck, 0, 0)
    W = P.world()
    shL, shR = W['upperarm_L'][1], W['upperarm_R'][1]
    hold_bow(P, shL + V((0.05, -0.25, -0.3)), V((0, -0.4, 1)).normalized(), cant=0)
    right_hand(P, shR + V((-0.05, -0.25, -0.3)))


def hit(P, t):
    k_ = keys(t, [(0.0, 0.0), (0.06, 1.0), (0.3, 0.0)])
    idle(P, t)
    P.rot['chest'] = eul(-14 * k_, 0, 8 * k_) @ P.rot['chest']
    P.rot['head'] = eul(-18 * k_, 0, 0) @ P.rot['head']


def death(P, t):
    k_ = keys(t, [(0.0, 0.0), (0.7, 1.0)], ease=lambda u: u * u)
    b = keys(t, [(0.7, 0.0), (0.8, 1.0), (0.95, 0.0)])
    P.rot['root'] = eul(-(86 * k_ - 4 * b), 0, 0)
    P.rot['spine'] = eul(-10 * k_, 0, 0)
    P.rot['head'] = eul(-25 * k_, 0, 10 * k_)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['thigh_' + s] = eul(-18 * k_, 0, sg * 10 * k_)
        P.rot['calf_' + s] = eul(28 * k_, 0, 0)
        P.rot['upperarm_' + s] = eul(-20 * k_, sg * -40 * k_, 0)
        P.rot['forearm_' + s] = eul(-30 * k_, 0, 0)


CLIPS = [
    Clip('idle', 2.4, idle, loop=True),
    Clip('run', 0.58, run, loop=True),
    Clip('shoot', 0.6, shoot, events={'hit': 0.34}),
    Clip('shoot_up', 0.7, shoot_up, events={'hit': 0.4}),
    Clip('cast', 0.64, cast, events={'hit': 0.32}),
    Clip('cast_ground', 0.8, cast_ground, events={'hit': 0.45}),
    Clip('swing', 0.72, swing, events={'hit': 0.36}),
    Clip('slam', 0.9, slam, events={'hit': 0.47}),
    Clip('warcry', 0.85, warcry, events={'cry': 0.3}),
    Clip('dodge', 0.46, dodge),
    Clip('hit', 0.3, hit),
    Clip('death', 1.4, death),
]
