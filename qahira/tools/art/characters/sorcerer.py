"""The Sorcerer: an astronomer from Cairo University who kept her staff and her notebooks when the sun went out.
A long plum coat over a sand tunic, a turquoise head wrap, round brass glasses, a satchel of star charts; the staff
is ashwood with a brass astrolabe ring for a head and a lamp of turquoise light in it.

Everything is placed relative to the rig's joints, so the same code fits any height.
"""
import math
import numpy as np
from mathutils import Vector as V, Matrix

from qart.geom import Part, trees, hit_in, basis, resample, wrap, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul, frame_rot
from characters import warrior

COL = dict(skin='#9A6446', coat='#3E2C44', coat2='#2E2033', tunic='#B79C6E', pants='#2A2630', wrap='#1F8A8C', wrap2='#156A6E',
           brass='#C89A45', leather='#4A3325', glass='#9FD8E0', eye='#3A2418', lamp='#4FF0E0', wood='#6A4A30', sole='#17120F')


def skeleton():
    return rig.humanoid(height=1.74, shoulder=0.19, hip=0.11, arm_drop=56.0)


def build(J):
    m = Model('sorcerer', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    top = T_('head')
    k = (top.z - hd.z) / 0.24

    # ---------------- head and face
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.08 * k, 0.094 * k, 0.106 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.066 * k, 0.07 * k, 0.062 * k), seg=20)   # jaw and chin
    h.capsule(hc + V((0, -0.088, 0.0)) * k, hc + V((0, -0.098, -0.03)) * k, 0.009 * k, 0.012 * k, seg=8)   # nose
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.056 * k, seg=14)
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        h.capsule(wr, wr + (ht - wr) * 0.9, 0.036, 0.03, seg=10)
    m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck', 'hand_L', 'hand_R'], sigma=0.06, voxel=0.006, smooth=3, tris=900)
    for sx in (-1, 1):
        e = Part()
        e.sphere(hc + V((sx * 0.031, -0.08, 0.018)) * k, (0.011 * k, 0.005 * k, 0.006 * k), seg=8)
        m.add(e, COL['eye'], rough=0.3, bone='head')
    # round brass glasses
    gl = Part()
    for sx in (-1, 1):
        c = hc + V((sx * 0.032, -0.094, 0.018)) * k
        gl.sweep([c + V((0.021 * math.cos(a), 0, 0.021 * math.sin(a))) * k for a in np.linspace(0, TAU, 14, endpoint=False)],
                 0.0022, seg=5, closed=True)
        gl.capsule(c + V((sx * 0.021, 0.0, 0)) * k, c + V((sx * 0.05, 0.075, 0.005)) * k, 0.0018, seg=4)
    gl.capsule(hc + V((-0.011, -0.095, 0.02)) * k, hc + V((0.011, -0.095, 0.02)) * k, 0.002, seg=4)
    m.add(gl, COL['brass'], rough=0.3, metal=1.0, bone='head')
    lens = Part()
    for sx in (-1, 1):
        lens.sloft([(hc + V((sx * 0.032, -0.095 + dz, 0.018)) * k, V((1, 0, 0)), V((0, 0, 1)), 0.019 * k, 0.019 * k)
                    for dz in (-0.001, 0.001)], seg=12)
    m.add(lens, COL['glass'], rough=0.05, metal=0.2, emit=0.15, bone='head')

    # ---------------- the head wrap: a cap over the crown, a band round the sides and back that leaves the face
    # open, and a drape over the shoulders
    th = trees(m.items[0]['ob'])

    def ring(z, a0, a1, n, off):
        row = []
        for j in range(n):
            a = math.radians(a0 + (a1 - a0) * j / (n - 1)) if a1 - a0 < 360 else TAU * j / n
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((hc.x, hc.y + 0.01, z)), d, 0.3)
            row.append(loc + d * off)
        return row
    brow = hc.z + 0.045 * k
    cap = Part()
    cap.grid([ring(brow + (hc.z + 0.1 * k - brow) * v, 0, 360, 36, 0.016 + 0.004 * v) for v in np.linspace(0, 1, 5)],
             fan_top=hc + V((0, 0.012, 0.122 * k)))
    m.add(cap, COL['wrap'], rough=0.9, bone='head', solidify=0.005, sol_offset=-1, recalc=False, tris=500)
    band = Part()
    band.grid([ring(z, -35, 215, 24, 0.018) for z in np.linspace(hc.z - 0.12 * k, brow + 0.01, 6)], closed=False)
    m.add(band, COL['wrap'], rough=0.9, bones=['head', 'neck'], sigma=0.08, solidify=0.006, sol_offset=-1, recalc=False, tris=500)
    dr = Part()
    dr.loft([(hc.z - 0.12 * k, 0, 0.012, 0.085 * k, 0.09 * k), (nk.z, 0, 0.01, 0.13, 0.12), (nk.z - 0.07, 0, 0.012, 0.2, 0.15),
             (ch.z + 0.07, 0, 0.014, 0.205, 0.155)], seg=36, caps=False, folds=5)
    m.add(dr, COL['wrap2'], rough=0.9, bones=['head', 'neck', 'chest'], sigma=0.08, solidify=0.006, sol_offset=-1, recalc=False, tris=900)

    # ---------------- tunic, coat and sleeves
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.16, 0.12), (pel.z + 0.12, 0.004, 0.15, 0.115), (ch.z, 0.01, 0.17, 0.125),
             (ch.z + 0.1, 0.014, 0.19, 0.13), (sh_z - 0.02, 0.018, 0.19, 0.12), (nk.z - 0.01, 0.02, 0.12, 0.09)]
    tu = Part()
    tu.loft([(z, 0, cy, rx - 0.004, ry - 0.004) for z, cy, rx, ry in torso], seg=28, caps=True)
    m.add(tu, COL['tunic'], rough=0.85, bones=['pelvis', 'spine', 'chest'], sigma=0.12, voxel=0.012, smooth=3, tris=700)
    co = Part()
    co.loft([(z, 0, cy, rx + 0.012, ry + 0.012) for z, cy, rx, ry in torso], seg=32, a0=-62, a1=242, caps=False)
    for s in 'LR':
        sh, el, wr = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s)
        co.capsule(sh, el, 0.074, 0.066, seg=14)
        co.capsule(el, el + (wr - el) * 0.9, 0.066, 0.07, seg=14)   # wide cuffs
    m.add(co, COL['coat'], rough=0.8, bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                              'forearm_L', 'forearm_R'], sigma=0.1, solidify=0.01, recalc=False, tris=1600)
    # the long skirt of the coat, open at the front, to the shins
    for a0, a1, ph in ((-60, 84, 0.2), (96, 240, 1.1)):
        sk = Part()
        sk.loft([(pel.z + 0.03, 0, 0.0, 0.176, 0.136, 0.0), (pel.z - 0.14, 0, 0.012, 0.21, 0.165, 0.02),
                 (pel.z - 0.34, 0, 0.022, 0.25, 0.2, 0.04), (pel.z - 0.52, 0, 0.03, 0.28, 0.22, 0.055),
                 (pel.z - 0.62, 0, 0.034, 0.29, 0.23, 0.06)], seg=26, a0=a0, a1=a1, caps=False, folds=6, phase=ph)
        m.add(sk, COL['coat'], rough=0.8, bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.16, solidify=0.01, recalc=False)
    lapel = Part()
    for sx in (-1, 1):
        lapel.sweep([V((sx * 0.05, -0.14, ch.z + 0.16)), V((sx * 0.1, -0.15, ch.z + 0.02)), V((sx * 0.12, -0.14, pel.z + 0.05))],
                    (0.004, 0.028), seg=6, hint=V((0, -1, 0)))
    m.add(lapel, COL['coat2'], rough=0.8, bone='chest')

    # ---------------- trousers and boots
    t = Part()
    t.sphere(pel + V((0, 0, -0.01)), (0.16, 0.12, 0.11), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.085, 0.066, seg=14)
        t.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.14)), 0.064, 0.055, seg=14)
    m.add(t, COL['pants'], rough=0.85, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012,
          smooth=4, tris=800)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)

    # ---------------- belt, satchel and its strap, a star pendant
    bl = Part()
    bl.loft([(pel.z - 0.02, 0, 0, 0.17, 0.132), (pel.z + 0.035, 0, 0, 0.17, 0.132)], seg=30, caps=False)
    m.add(bl, COL['leather'], rough=0.55, bone='pelvis', solidify=0.008, recalc=False)
    sat = Part()
    sp = V((-0.2, 0.03, pel.z - 0.08))
    sat.box(sp, (0.07, 0.24, 0.2))
    sat.box(sp + V((-0.036, 0, 0.05)), (0.012, 0.25, 0.11))
    m.add(sat, COL['leather'], rough=0.6, bone='pelvis', bevel=0.012)
    pages = Part()
    pages.box(sp + V((0.0, 0.0, 0.1)), (0.05, 0.2, 0.02))
    m.add(pages, '#E8DCC0', rough=0.9, bone='pelvis')
    body = trees(*[it['ob'] for it in m.items[:8]])
    st = Part()
    path = [(20, sh_z + 0.02), (-20, ch.z + 0.1), (-60, ch.z - 0.02), (-110, pel.z + 0.12), (-150, pel.z + 0.02),
            (160, pel.z + 0.06), (120, ch.z - 0.02), (80, ch.z + 0.1), (50, sh_z + 0.03)]
    st.sweep(resample(wrap(body, path, 0.02), 40), (0.004, 0.018), seg=6, hint=lambda i, p: V((p.x, p.y, 0)), closed=True)
    m.add(st, COL['leather'], rough=0.6, bones=['chest', 'spine'], sigma=0.15)
    pd = Part()
    pc = V((0, -0.155, ch.z + 0.1))
    for i in range(8):
        a = TAU * i / 8
        r = 0.02 if i % 2 == 0 else 0.009
        pd.capsule(pc, pc + V((r * math.cos(a), -0.002, r * math.sin(a))), 0.004, seg=4)
    m.add(pd, COL['lamp'], rough=0.3, emit=0.9, bone='chest')
    return m


def build_staff():
    """Weapon frame: grip at the origin, haft along +Z. Ashwood with a brass astrolabe head and a lamp inside."""
    m = Model('staff')
    p = Part()
    pts = [V((0.004 * math.sin(z * 7), 0.003 * math.cos(z * 5), z)) for z in np.linspace(-0.95, 0.92, 12)]
    p.sweep(pts, lambda t: 0.019 - 0.004 * t, seg=10)
    m.add(p, COL['wood'], rough=0.7)
    g = Part()
    gp = [V((0.022 * math.cos(kk * 0.55), 0.022 * math.sin(kk * 0.55), -0.12 + 0.24 * kk / 60)) for kk in range(61)]
    g.sweep(gp, 0.004, seg=5)
    m.add(g, COL['leather'], rough=0.6)
    b = Part()
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((-1.0, 0.012), (-0.97, 0.024), (-0.9, 0.022))], seg=10)
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.88, 0.02), (0.93, 0.03), (0.96, 0.024))], seg=10)
    m.add(b, COL['brass'], rough=0.3, metal=1.0)
    # the astrolabe: an outer ring (the mater), a crossbar and three star pointers (the rete), and the lamp
    c = V((0, 0, 1.1))
    ring = Part()
    ring.sweep([c + V((0.13 * math.cos(a), 0, 0.13 * math.sin(a))) for a in np.linspace(0, TAU, 32, endpoint=False)], 0.011, seg=6, closed=True)
    ring.sweep([c + V((0.1 * math.cos(a), 0, 0.1 * math.sin(a))) for a in np.linspace(0, TAU, 28, endpoint=False)], 0.005, seg=5, closed=True)
    ring.capsule(c + V((-0.13, 0, 0)), c + V((0.13, 0, 0)), 0.006, seg=5)
    ring.capsule(c + V((0, 0, -0.13)), c + V((0, 0, 0.13)), 0.006, seg=5)
    for a in (0.6, 2.3, 4.1):
        ring.capsule(c + V((0.03 * math.cos(a), 0, 0.03 * math.sin(a))), c + V((0.09 * math.cos(a), 0, 0.09 * math.sin(a))), 0.004, 0.001, seg=4)
    ring.capsule(c + V((0, 0, -0.14)), V((0, 0, 0.95)), 0.012, seg=6)
    ring.sphere(c + V((0, 0, 0.15)), 0.018, seg=8)
    m.add(ring, COL['brass'], rough=0.28, metal=1.0)
    lamp = Part()
    lamp.sphere(c, 0.045, seg=14)
    m.add(lamp, COL['lamp'], rough=0.2, emit=1.0)
    return m


# ====================================================================== animation
def cs(P, off):
    """A point given as an offset from the chest's bind position, carried with the chest's current motion."""
    return warrior.chest_space(P, P.J['chest'][0] + off)


def hold_staff(P, grip, haft, face=V((1, 0, 0)), pole=V((-0.9, 0.2, -0.5))):
    wr = frame_rot(haft, face)
    W = P.world()
    P.arm_ik('R', grip, W['upperarm_R'][1] + pole, weapon_rot=wr, wrist_rot=wr)


def free_left(P, palm, pole=V((0.9, 0.2, -0.5))):
    W = P.world()
    P.arm_ik('L', palm, W['upperarm_L'][1] + pole)


def two_hands(P, grip, haft, face=V((1, 0, 0)), gap=0.34):
    hold_staff(P, grip, haft, face)
    free_left(P, grip + haft.normalized() * gap, V((0.9, -0.2, -0.4)))


IDLE_G, IDLE_H = V((-0.26, -0.1, -0.36)), V((0.05, -0.12, 1.0)).normalized()


def idle(P, t):
    P.rot['pelvis'] = eul(0, 0, 6)
    P.rot['spine'] = eul(2, 0, -4)
    warrior.stance_legs(P, t, crouch=-0.2)
    warrior.breathe(P, t, 0.8)
    P.rot['head'] = eul(-2 + cyc(t, 4.4, 2), 0, -6 + cyc(t, 6.2, 5))
    hold_staff(P, cs(P, IDLE_G), IDLE_H)
    free_left(P, cs(P, V((0.2, -0.12, -0.3 + cyc(t, 2.4, 0.01)))))


def run(P, t):
    T = 0.6
    ph = t / T * math.tau
    P.rot['pelvis'] = eul(0, 0, 8 * math.sin(ph))
    P.off['pelvis'] = V((0, 0, -0.02 + 0.03 * abs(math.sin(ph))))
    P.rot['spine'] = eul(8, 0, -8 * math.sin(ph))
    for s, o in (('L', 0.0), ('R', math.pi)):
        a = ph + o
        P.rot['thigh_' + s] = eul(-36 * math.sin(a) - 6, 0, 0)
        P.rot['calf_' + s] = eul(16 + 50 * max(0.0, math.sin(a - 1.2)) + 18 * max(0.0, -math.sin(a)), 0, 0)
        P.rot['foot_' + s] = eul(-10 + 16 * math.sin(a - 0.4), 0, 0)
    P.rot['head'] = eul(-6, 0, 4 * math.sin(ph))
    hold_staff(P, cs(P, V((-0.26, -0.22, -0.3))), V((0.1, -0.7, 0.7)).normalized())
    free_left(P, cs(P, V((0.2, -0.05 + 0.12 * math.sin(ph), -0.3))))


def cast(P, t):
    # draw back 0 -> 0.18, thrust the lamp forward to 0.3 (release), hold, recover to 0.62
    back = keys(t, [(0.0, 0.0), (0.18, 1.0), (0.24, 1.0), (0.3, 0.0)])
    out = keys(t, [(0.2, 0.0), (0.3, 1.0), (0.42, 1.0), (0.62, 0.0)])
    P.rot['pelvis'] = eul(0, 0, 10 * back - 14 * out)
    P.rot['spine'] = eul(4 + 8 * out, 0, 8 * back - 10 * out)
    warrior.stance_legs(P, t, crouch=0.15 * out)
    P.rot['head'] = eul(-4 + 4 * out, 0, 0)
    g = IDLE_G.lerp(V((-0.22, 0.12, -0.2)), back).lerp(V((-0.12, -0.46, 0.0)), out)
    hv = IDLE_H.lerp(V((-0.1, 0.4, 1.0)).normalized(), back).lerp(V((0.0, -1.0, 0.45)).normalized(), out)
    hold_staff(P, cs(P, g), hv.normalized())
    free_left(P, cs(P, V((0.2, -0.12, -0.3)).lerp(V((0.12, -0.44, 0.02)), out)))


def cast_ground(P, t):
    # lift the staff high 0 -> 0.3, bring the butt down in front at 0.45, hold, recover to 0.8
    up = keys(t, [(0.0, 0.0), (0.3, 1.0), (0.38, 1.0), (0.45, 0.0)])
    down = keys(t, [(0.38, 0.0), (0.45, 1.0), (0.6, 1.0), (0.8, 0.0)])
    P.rot['spine'] = eul(2 - 10 * up + 14 * down, 0, 0)
    P.rot['chest'] = eul(-8 * up + 8 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.1 * up + 0.5 * down)
    P.rot['head'] = eul(-10 * up + 6 * down, 0, 0)
    g = IDLE_G.lerp(V((-0.18, -0.1, 0.32)), up).lerp(V((-0.1, -0.38, -0.2)), down)
    hv = IDLE_H.lerp(V((0.0, 0.1, 1.0)).normalized(), up).lerp(V((0.0, 0.25, 1.0)).normalized(), down)
    two_hands(P, cs(P, g), hv.normalized(), gap=0.22)


def swing(P, t):
    wind = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.26, 1.0)])
    sw = keys(t, [(0.24, 0.0), (0.36, 1.0), (0.46, 1.0), (0.72, 0.0)])
    turn = 40 * wind - 70 * sw
    P.rot['pelvis'] = eul(0, 0, turn * 0.4)
    P.rot['spine'] = eul(6, 0, turn * 0.3)
    P.rot['chest'] = eul(4, 0, turn * 0.4)
    warrior.stance_legs(P, t, crouch=0.3 * wind + 0.4 * sw)
    wind_g, wind_h = V((-0.3, 0.08, -0.25)), V((-0.7, 0.6, 0.25)).normalized()
    end_g, end_h = V((0.2, -0.32, -0.25)), V((0.8, -0.55, 0.05)).normalized()
    g = IDLE_G.lerp(wind_g, wind)
    hv = IDLE_H.lerp(wind_h, wind)
    if sw > 0:
        if t < 0.46:
            g, hv = wind_g.lerp(end_g, sw), wind_h.lerp(end_h, sw)
        else:
            g, hv = IDLE_G.lerp(end_g, sw), IDLE_H.lerp(end_h, sw)
    two_hands(P, cs(P, g), hv.normalized(), face=V((0, 0, 1)), gap=0.3)


def slam(P, t):
    up = keys(t, [(0.0, 0.0), (0.34, 1.0), (0.44, 1.0), (0.47, 0.0)])
    down = keys(t, [(0.36, 0.0), (0.47, 1.0), (0.62, 1.0), (0.9, 0.0)])
    P.rot['spine'] = eul(4 - 14 * up + 22 * down, 0, 0)
    P.rot['chest'] = eul(-10 * up + 14 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.2 * up + 0.8 * down)
    over_g, over_h = V((-0.02, 0.05, 0.42)), V((0.0, 0.6, 0.35)).normalized()
    hit_g, hit_h = V((0.0, -0.48, -0.36)), V((0.0, -0.75, -0.65)).normalized()
    g = IDLE_G.lerp(over_g, up)
    hv = IDLE_H.lerp(over_h, up)
    if down > 0:
        g = (over_g if up > 0.5 else g).lerp(hit_g, down) if t < 0.62 else hit_g.lerp(IDLE_G, 1 - down)
        hv = (over_h if up > 0.5 else hv).lerp(hit_h, down) if t < 0.62 else hit_h.lerp(IDLE_H, 1 - down)
    two_hands(P, cs(P, g), hv.normalized(), gap=0.28)


def warcry(P, t):
    k_ = keys(t, [(0.0, 0.0), (0.25, 1.0), (0.6, 1.0), (0.85, 0.0)])
    P.rot['spine'] = eul(-10 * k_, 0, 0)
    P.rot['chest'] = eul(-12 * k_, 0, 0)
    P.rot['head'] = eul(-20 * k_, 0, 0)
    warrior.stance_legs(P, t, crouch=0.3 * k_)
    hold_staff(P, cs(P, IDLE_G.lerp(V((-0.2, -0.1, 0.45)), k_)), IDLE_H.lerp(V((0.0, -0.1, 1.0)).normalized(), k_).normalized())
    free_left(P, cs(P, V((0.2, -0.12, -0.3)).lerp(V((0.32, -0.2, 0.3)), k_)))


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
    two_hands(P, cs(P, IDLE_G.lerp(V((-0.05, -0.28, -0.2)), tuck)), IDLE_H.lerp(V((0.9, 0.0, 0.3)).normalized(), tuck).normalized(), gap=0.3)


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
    P.rot['head'] = eul(-25 * k_, 0, -10 * k_)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['thigh_' + s] = eul(-18 * k_, 0, sg * 10 * k_)
        P.rot['calf_' + s] = eul(28 * k_, 0, 0)
        P.rot['upperarm_' + s] = eul(-20 * k_, sg * -40 * k_, 0)
        P.rot['forearm_' + s] = eul(-30 * k_, 0, 0)


CLIPS = [
    Clip('idle', 2.4, idle, loop=True),
    Clip('run', 0.6, run, loop=True),
    Clip('cast', 0.62, cast, events={'hit': 0.3}),
    Clip('cast_ground', 0.8, cast_ground, events={'hit': 0.45}),
    Clip('swing', 0.72, swing, events={'hit': 0.34}),
    Clip('slam', 0.9, slam, events={'hit': 0.47}),
    Clip('warcry', 0.85, warcry, events={'cry': 0.3}),
    Clip('dodge', 0.46, dodge),
    Clip('hit', 0.3, hit),
    Clip('death', 1.4, death),
]
