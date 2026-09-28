"""The Mercenary: a guard from a Garden City bank who kept working when the banks stopped. An olive field jacket with
the sleeves pushed up over a dark shirt, a dark red scarf, cargo trousers and boots, a leather bandolier of clay
grenade pots (the old sphero-conical pots of Fustat, filled with naphtha, as the Mamluks used them), and a crossbow
slung across the back. The sword is straight and double-edged, with a brass guard.

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

COL = dict(skin='#7E4E36', hair='#18120E', jacket='#4E5236', jacket2='#3E4228', shirt='#22242A', pants='#3A3630',
           scarf='#6A1E1A', leather='#4A3325', clay='#A8744A', clay2='#8A5A36', brass='#C89A45', steel='#9AA0A6',
           steel2='#6A6E74', wood='#5A3E26', string='#D8CCB0', eye='#2A1A10', fuse='#E8B060')


def skeleton():
    return rig.humanoid(height=1.84, shoulder=0.215, hip=0.108, arm_drop=52.0)


def build(J):
    m = Model('mercenary', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    pel, ch, nk, hd = H('pelvis'), H('chest'), H('neck'), H('head')
    k = (T_('head').z - hd.z) / 0.24

    # ---------------- head, cropped hair and a short beard; the forearms bare
    h = Part()
    hc = hd + V((0, 0.006, 0.105 * k))
    h.sphere(hc, (0.083, 0.097, 0.108 * k), seg=28)
    h.sphere(hc + V((0, -0.035, -0.07)) * k, (0.07, 0.074, 0.064 * k), seg=20)
    h.capsule(hc + V((0, -0.09, 0.0)) * k, hc + V((0, -0.1, -0.03)) * k, 0.01 * k, 0.014 * k, seg=8)
    h.capsule(nk + V((0, 0.012, -0.03)), hc + V((0, 0.0, -0.08)) * k, 0.062 * k, seg=14)
    for s in 'LR':
        el, wr, ht = H('forearm_' + s), H('hand_' + s), T_('hand_' + s)
        h.capsule(el + (wr - el) * 0.35, wr, 0.05, 0.04, seg=10)
        h.capsule(wr, wr + (ht - wr) * 0.9, 0.04, 0.034, seg=10)
    m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'], sigma=0.06, voxel=0.006,
          smooth=3, tris=1000)
    for sx in (-1, 1):
        e = Part()
        e.sphere(hc + V((sx * 0.032, -0.083, 0.018)) * k, (0.011 * k, 0.005 * k, 0.006 * k), seg=8)
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
    hair = Part()
    hair.grid([ring(z, -25, 205, 22, 0.006) for z in np.linspace(hc.z + 0.02 * k, hc.z + 0.1 * k, 4)], closed=False,
              fan_top=hc + V((0, 0.01, 0.112 * k)))
    m.add(hair, COL['hair'], rough=0.9, bone='head', solidify=0.006, sol_offset=-1, recalc=False, tris=400)
    beard = Part()
    beard.grid([ring(z, 200, 340, 14, 0.007) for z in np.linspace(hc.z - 0.1 * k, hc.z - 0.02 * k, 4)], closed=False)
    m.add(beard, COL['hair'], rough=0.9, bones=['head'], solidify=0.008, sol_offset=-1, recalc=False, tris=300)

    # ---------------- shirt, the field jacket (sleeves pushed up to the elbow), the scarf
    sh_z = H('upperarm_L').z
    torso = [(pel.z, 0.0, 0.165, 0.122), (pel.z + 0.12, 0.004, 0.158, 0.118), (ch.z, 0.01, 0.182, 0.13),
             (ch.z + 0.1, 0.014, 0.205, 0.138), (sh_z - 0.02, 0.018, 0.205, 0.126), (nk.z - 0.01, 0.02, 0.12, 0.092)]
    sh = Part()
    sh.loft([(z, 0, cy, rx - 0.004, ry - 0.004) for z, cy, rx, ry in torso], seg=28, caps=True)
    m.add(sh, COL['shirt'], rough=0.85, bones=['pelvis', 'spine', 'chest'], sigma=0.12, voxel=0.012, smooth=3, tris=600)
    jk = Part()
    jk.loft([(pel.z - 0.14, 0, 0.006, 0.19, 0.145), *[(z, 0, cy, rx + 0.014, ry + 0.014) for z, cy, rx, ry in torso]], seg=32, a0=-70, a1=250,
            caps=False)
    for s in 'LR':
        u, e = H('upperarm_' + s), H('forearm_' + s)
        jk.capsule(u, e, 0.072, 0.064, seg=14)
        jk.capsule(e - (e - u) * 0.05, e + (H('hand_' + s) - e) * 0.3, 0.07, 0.072, seg=14)   # the pushed-up cuff
    m.add(jk, COL['jacket'], rough=0.8, bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R',
                                                'forearm_L', 'forearm_R'], sigma=0.1, solidify=0.01, recalc=False, tris=1500)
    pk = Part()   # breast pockets and their flaps
    for sx in (-1, 1):
        pk.box(V((sx * 0.09, -0.15, ch.z + 0.1)), (0.08, 0.02, 0.09))
        pk.box(V((sx * 0.09, -0.16, ch.z + 0.15)), (0.085, 0.02, 0.03))
    m.add(pk, COL['jacket2'], rough=0.8, bone='chest')
    sc = Part()
    sc.loft([(nk.z - 0.05, 0, 0.012, 0.12, 0.105), (nk.z + 0.01, 0, 0.012, 0.09, 0.085), (nk.z + 0.06, 0, 0.012, 0.075, 0.075)],
            seg=24, caps=False, folds=4)
    sc.sweep([V((0.04, -0.1, nk.z - 0.03)), V((0.07, -0.14, ch.z + 0.1)), V((0.06, -0.15, ch.z - 0.02))], (0.004, 0.04), seg=6,
             hint=V((0, -1, 0)))
    m.add(sc, COL['scarf'], rough=0.9, bones=['neck', 'chest'], sigma=0.08, solidify=0.007, sol_offset=-1, recalc=False)

    # ---------------- cargo trousers, their side pockets, boots
    t = Part()
    t.sphere(pel + V((0, 0, -0.01)), (0.165, 0.122, 0.11), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.092, 0.072, seg=14)
        t.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.14)), 0.07, 0.06, seg=14)
    m.add(t, COL['pants'], rough=0.85, bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012, smooth=4,
          tris=800)
    cp = Part()
    for s, sx in (('L', 1), ('R', -1)):
        c = H('thigh_' + s).lerp(H('calf_' + s), 0.45)
        cp.box(c + V((sx * 0.09, -0.01, 0)), (0.03, 0.11, 0.13))
    m.add(cp, COL['pants'], rough=0.8, bones=['thigh_L', 'thigh_R'], sigma=0.06, bevel=0.008)
    for s in 'LR':
        warrior.boot(m, H('foot_' + s), T_('foot_' + s), s)

    # ---------------- belt with a scabbard; the bandolier of grenade pots; the crossbow on the back
    bl = Part()
    bl.loft([(pel.z - 0.02, 0, 0, 0.172, 0.13), (pel.z + 0.035, 0, 0, 0.172, 0.13)], seg=30, caps=False)
    m.add(bl, COL['leather'], rough=0.55, bone='pelvis', solidify=0.009, recalc=False)
    sb = Part()
    sb.capsule(V((0.19, -0.02, pel.z)), V((0.3, 0.3, pel.z - 0.72)), 0.03, 0.022, seg=8)
    m.add(sb, COL['leather'], rough=0.5, bones=['pelvis'], sigma=0.1)
    bd = Part()   # from the right shoulder across the chest to the left hip, and back round behind
    pots = [V((0.16 - 0.32 * f, -0.155, sh_z + 0.03 - (sh_z - pel.z) * f)) for f in np.linspace(0.12, 0.88, 12)]
    bd.sweep(pots, (0.006, 0.032), seg=6, hint=V((0, -1, 0)))
    back = [V((0.16 - 0.32 * f, 0.15, sh_z + 0.03 - (sh_z - pel.z) * (1 - f))) for f in np.linspace(0.0, 1.0, 8)]
    bd.sweep([pots[-1] + V((-0.02, 0.06, -0.02))] + back[1:-1] + [pots[0] + V((0.02, 0.06, 0.02))], (0.006, 0.032), seg=6,
             hint=V((0, 1, 0)))
    m.add(bd, COL['leather'], rough=0.55, bones=['chest', 'spine'], sigma=0.15)
    gp = Part()
    fu = Part()
    for f in (0.3, 0.45, 0.6, 0.75):
        c = V((0.16 - 0.32 * f, -0.19, sh_z + 0.03 - (sh_z - pel.z) * f))
        gp.sphere(c, (0.04, 0.04, 0.045), seg=10)
        gp.capsule(c + V((0, 0, 0.03)), c + V((0, 0, 0.065)), 0.014, 0.008, seg=6)
        fu.capsule(c + V((0, 0, 0.065)), c + V((0.01, 0, 0.09)), 0.004, seg=4)
    m.add(gp, COL['clay'], rough=0.8, bones=['chest', 'spine'], sigma=0.15)
    m.add(fu, COL['fuse'], rough=0.8, emit=0.2, bones=['chest', 'spine'], sigma=0.15)
    cb = Part()   # the slung crossbow: stock diagonal across the back, the prod across it
    s0, s1 = V((-0.14, 0.2, pel.z + 0.08)), V((0.16, 0.2, sh_z + 0.12))
    cb.capsule(s0, s1, 0.025, 0.03, seg=8)
    pc = s0.lerp(s1, 0.82)
    d = (s1 - s0).normalized()
    side = d.cross(V((0, 1, 0))).normalized()
    cb.sweep([pc - side * 0.3 + d * 0.04, pc, pc + side * 0.3 + d * 0.04], 0.016, seg=6)
    m.add(cb, COL['wood'], rough=0.6, bones=['chest', 'spine'], sigma=0.12)
    st = Part()
    st.capsule(pc - side * 0.3 + d * 0.04, pc + side * 0.3 + d * 0.04, 0.003, seg=4)
    m.add(st, COL['string'], rough=0.8, bones=['chest'], sigma=0.1)
    return m


def build_sword():
    """Weapon frame: grip at the origin, the blade along +Z, its edges along X. Straight, double-edged, with a fuller,
    a brass crossguard and pommel, and a leather-wrapped grip."""
    m = Model('sword')
    b = Part()
    b.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), w, 0.006) for z, w in ((0.1, 0.028), (0.6, 0.024), (0.82, 0.016), (0.9, 0.001))],
            seg=8, p=1.2)
    m.add(b, COL['steel'], rough=0.25, metal=1.0)
    f = Part()
    f.box(V((0, 0, 0.4)), (0.008, 0.0125, 0.5))
    m.add(f, COL['steel2'], rough=0.35, metal=1.0)
    g = Part()
    g.capsule(V((-0.1, 0, 0.09)), V((0.1, 0, 0.09)), 0.012, seg=8)
    for sx in (-1, 1):
        g.sphere(V((sx * 0.105, 0, 0.1)), 0.016, seg=8)
    g.sphere(V((0, 0, -0.11)), (0.024, 0.02, 0.028), seg=10)
    m.add(g, COL['brass'], rough=0.3, metal=1.0)
    gr = Part()
    gr.sweep([V((0.016 * math.cos(kk * 0.7), 0.014 * math.sin(kk * 0.7), -0.09 + 0.17 * kk / 30)) for kk in range(31)], 0.005, seg=5)
    m.add(gr, COL['leather'], rough=0.6)
    return m


def build_crossbow():
    """Weapon frame: grip at the origin, the bolt's flight along +Z (the stock runs back along -Z), the prod across X."""
    m = Model('crossbow')
    s = Part()
    s.box(V((0, 0, 0.12)), (0.045, 0.05, 0.62))
    s.box(V((0, -0.035, -0.22)), (0.05, 0.12, 0.16))   # the butt, dropped below the line
    m.add(s, COL['wood'], rough=0.6, bevel=0.01)
    p = Part()
    pts = [V((x, 0.012 * (1 - (x / 0.34) ** 2) * 0 + 0.0, 0.42 - 0.07 * (x / 0.34) ** 2)) for x in np.linspace(-0.34, 0.34, 11)]
    p.sweep(pts, lambda t: 0.018 - 0.008 * abs(t - 0.5) * 2, seg=6)
    m.add(p, COL['steel2'], rough=0.35, metal=0.9)
    st = Part()
    st.capsule(pts[0], V((0, 0, 0.14)), 0.003, seg=4)
    st.capsule(V((0, 0, 0.14)), pts[-1], 0.003, seg=4)
    m.add(st, COL['string'], rough=0.8)
    bt = Part()
    bt.capsule(V((0, 0.03, 0.14)), V((0, 0.03, 0.5)), 0.006, seg=5)
    m.add(bt, COL['brass'], rough=0.3, metal=1.0)
    tr = Part()
    tr.capsule(V((0, -0.035, 0.0)), V((0, -0.06, -0.04)), 0.006, seg=5)
    m.add(tr, COL['steel2'], rough=0.35, metal=0.9)
    return m


def build_grenade():
    """A thrown pot: a sphero-conical clay vessel, its neck stopped, a burning wick."""
    m = Model('grenade')
    p = Part()
    p.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((-0.1, 0.005), (-0.07, 0.05), (0.0, 0.075), (0.05, 0.06),
                                                                           (0.08, 0.025), (0.1, 0.018))], seg=12)
    m.add(p, COL['clay'], rough=0.8)
    b = Part()
    for z in (-0.02, 0.02):
        b.sloft([(V((0, 0, z + dz)), V((1, 0, 0)), V((0, 1, 0)), 0.077, 0.077) for dz in (0.0, 0.006)], seg=12)
    m.add(b, COL['clay2'], rough=0.8)
    w = Part()
    w.capsule(V((0, 0, 0.1)), V((0.01, 0, 0.14)), 0.006, seg=5)
    m.add(w, COL['fuse'], rough=0.5, emit=0.9)
    return m


# ====================================================================== animation
def hold_sword(P, grip, blade, face=V((1, 0, 0)), pole=V((-0.9, 0.2, -0.5))):
    wr = frame_rot(blade, face)
    W = P.world()
    P.arm_ik('R', grip, W['upperarm_R'][1] + pole, weapon_rot=wr, wrist_rot=wr)


def free_left(P, palm, pole=V((0.9, 0.2, -0.5))):
    W = P.world()
    P.arm_ik('L', palm, W['upperarm_L'][1] + pole)


def cs(P, off):
    return warrior.chest_space(P, P.J['chest'][0] + off)


GUARD_G, GUARD_B = V((-0.2, -0.3, -0.18)), V((0.25, -0.5, 0.85)).normalized()   # sword forward and up, point at the enemy


def idle(P, t):
    P.rot['pelvis'] = eul(0, 0, -10)
    P.rot['spine'] = eul(4, 0, 8)
    warrior.stance_legs(P, t, crouch=0.15)
    warrior.breathe(P, t, 1.0)
    P.rot['head'] = eul(-3 + cyc(t, 4.2, 2), 0, -4 + cyc(t, 6.0, 6))
    hold_sword(P, cs(P, GUARD_G + V((0, 0, cyc(t, 2.4, 0.01)))), GUARD_B)
    free_left(P, cs(P, V((0.22, -0.16, -0.26))))


def run(P, t):
    T = 0.56
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
    hold_sword(P, cs(P, V((-0.24, -0.1 + 0.1 * math.sin(ph), -0.34))), V((0.05, 0.4, 1.0)).normalized())
    free_left(P, cs(P, V((0.2, -0.05 - 0.12 * math.sin(ph), -0.3))))


def swing(P, t):
    # a forehand cut, right to left, then back to guard
    wind = keys(t, [(0.0, 0.0), (0.2, 1.0), (0.24, 1.0)])
    cut = keys(t, [(0.22, 0.0), (0.34, 1.0), (0.42, 1.0), (0.66, 0.0)])
    turn = 35 * wind - 60 * cut
    P.rot['pelvis'] = eul(0, 0, turn * 0.4)
    P.rot['spine'] = eul(6, 0, turn * 0.3)
    P.rot['chest'] = eul(4, 0, turn * 0.4)
    warrior.stance_legs(P, t, crouch=0.2 + 0.3 * cut)
    wg, wb = V((-0.4, 0.05, 0.05)), V((-0.6, 0.5, 0.6)).normalized()
    eg, eb = V((0.25, -0.42, -0.1)), V((0.85, -0.5, -0.1)).normalized()
    if cut > 0:
        g = wg.lerp(eg, cut) if t < 0.42 else GUARD_G.lerp(eg, cut)
        b = wb.lerp(eb, cut) if t < 0.42 else GUARD_B.lerp(eb, cut)
    else:
        g, b = GUARD_G.lerp(wg, wind), GUARD_B.lerp(wb, wind)
    hold_sword(P, cs(P, g), b.normalized(), face=V((0, 0, 1)))
    free_left(P, cs(P, V((0.24, -0.14, -0.24)).lerp(V((0.3, 0.05, -0.2)), cut)))


def combo(P, t):
    # two cuts: forehand, then a backhand the other way
    if t < 0.62:
        swing(P, t)
        return
    u = t - 0.62
    wind = keys(u, [(0.0, 0.0), (0.1, 1.0)])
    cut = keys(u, [(0.08, 0.0), (0.2, 1.0), (0.28, 1.0), (0.5, 0.0)])
    turn = -40 * wind + 60 * cut
    P.rot['pelvis'] = eul(0, 0, turn * 0.4)
    P.rot['spine'] = eul(6, 0, turn * 0.3)
    P.rot['chest'] = eul(4, 0, turn * 0.4)
    warrior.stance_legs(P, t, crouch=0.3)
    wg, wb = V((0.25, -0.42, -0.1)), V((0.85, -0.5, -0.1)).normalized()
    eg, eb = V((-0.45, -0.3, 0.0)), V((-0.9, -0.3, 0.2)).normalized()
    g = wg.lerp(eg, cut) if u < 0.28 else GUARD_G.lerp(eg, cut)
    b = wb.lerp(eb, cut) if u < 0.28 else GUARD_B.lerp(eb, cut)
    hold_sword(P, cs(P, g), b.normalized(), face=V((0, 0, -1)))
    free_left(P, cs(P, V((0.3, 0.05, -0.2))))


def slam(P, t):
    # an overhead cut, both hands, down through the target
    up = keys(t, [(0.0, 0.0), (0.32, 1.0), (0.42, 1.0), (0.46, 0.0)])
    down = keys(t, [(0.36, 0.0), (0.46, 1.0), (0.6, 1.0), (0.86, 0.0)])
    P.rot['spine'] = eul(4 - 14 * up + 22 * down, 0, 0)
    P.rot['chest'] = eul(-10 * up + 14 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.2 * up + 0.7 * down)
    og, ob = V((-0.05, 0.05, 0.4)), V((0.0, 0.7, 0.4)).normalized()
    hg, hb = V((0.0, -0.46, -0.3)), V((0.0, -0.8, -0.55)).normalized()
    g = GUARD_G.lerp(og, up)
    b = GUARD_B.lerp(ob, up)
    if down > 0:
        g = (og if up > 0.5 else g).lerp(hg, down) if t < 0.6 else hg.lerp(GUARD_G, 1 - down)
        b = (ob if up > 0.5 else b).lerp(hb, down) if t < 0.6 else hb.lerp(GUARD_B, 1 - down)
    hold_sword(P, cs(P, g), b.normalized())
    free_left(P, cs(P, g + V((0.06, -0.02, 0.1))), V((0.9, -0.2, -0.4)))


def throw(P, t):
    # a grenade pot from the bandolier, thrown overarm with the left hand; the sword kept at guard
    reach = keys(t, [(0.0, 0.0), (0.18, 1.0)])
    back = keys(t, [(0.15, 0.0), (0.34, 1.0), (0.4, 1.0)])
    out = keys(t, [(0.38, 0.0), (0.48, 1.0), (0.58, 1.0), (0.8, 0.0)])
    P.rot['pelvis'] = eul(0, 0, 20 * back - 25 * out)
    P.rot['spine'] = eul(4 - 10 * back + 16 * out, 0, 20 * back - 25 * out)
    warrior.stance_legs(P, t, crouch=0.15 + 0.2 * out)
    hold_sword(P, cs(P, GUARD_G.lerp(V((-0.3, -0.1, -0.3)), max(back, out))), GUARD_B)
    p = V((0.22, -0.16, -0.26)).lerp(V((0.1, -0.2, -0.1)), reach).lerp(V((0.28, 0.25, 0.35)), back)
    p = p.lerp(V((0.1, -0.6, 0.25)), out)
    free_left(P, cs(P, p), V((0.9, 0.3, -0.2)))


def shoot(P, t):
    # the crossbow up to the shoulder (it is drawn in the right hand when a crossbow is the weapon), aim, loose, recoil
    up = keys(t, [(0.0, 0.0), (0.22, 1.0)])
    kick = keys(t, [(0.3, 0.0), (0.34, 1.0), (0.5, 0.0)])
    down = keys(t, [(0.6, 0.0), (0.8, 1.0)])
    a = up * (1 - down)
    P.rot['pelvis'] = eul(0, 0, -20 * a)
    P.rot['spine'] = eul(4 - 6 * kick, 0, -15 * a)
    warrior.stance_legs(P, t, crouch=0.15)
    P.rot['head'] = eul(6 * a, 0, 15 * a)
    aim = V((0, -1, 0.05)).normalized()
    g = V((-0.24, -0.1, -0.34)).lerp(V((-0.1, -0.22, 0.02)) + V((0, 0.05, 0.01)) * kick, a)
    hold_sword(P, cs(P, g), V((0.05, 0.4, 1.0)).normalized().lerp(aim, a).normalized(), face=V((0, 0, 1)))
    free_left(P, cs(P, V((0.22, -0.16, -0.26)).lerp(V((-0.02, -0.5, 0.04)), a)))


def cast(P, t):
    throw(P, t)


def cast_ground(P, t):
    down = keys(t, [(0.0, 0.0), (0.4, 1.0), (0.62, 1.0), (0.8, 0.0)])
    P.rot['spine'] = eul(18 * down, 0, 0)
    warrior.stance_legs(P, t, crouch=0.8 * down)
    hold_sword(P, cs(P, GUARD_G.lerp(V((-0.1, -0.4, -0.45)), down)), GUARD_B.lerp(V((0, -0.3, -1)).normalized(), down).normalized())
    free_left(P, cs(P, V((0.22, -0.16, -0.26)).lerp(V((0.1, -0.4, -0.5)), down)))


def warcry(P, t):
    k_ = keys(t, [(0.0, 0.0), (0.25, 1.0), (0.6, 1.0), (0.85, 0.0)])
    P.rot['spine'] = eul(-10 * k_, 0, 0)
    P.rot['chest'] = eul(-12 * k_, 0, 0)
    P.rot['head'] = eul(-20 * k_, 0, 0)
    warrior.stance_legs(P, t, crouch=0.3 * k_)
    hold_sword(P, cs(P, GUARD_G.lerp(V((-0.2, -0.1, 0.45)), k_)), GUARD_B.lerp(V((0.0, -0.1, 1.0)).normalized(), k_).normalized())
    free_left(P, cs(P, V((0.22, -0.16, -0.26)).lerp(V((0.32, -0.2, 0.3)), k_)))


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
    hold_sword(P, cs(P, GUARD_G.lerp(V((-0.05, -0.28, -0.2)), tuck)), GUARD_B.lerp(V((0.9, 0.0, 0.3)).normalized(), tuck).normalized())
    free_left(P, cs(P, V((0.1, -0.28, -0.2))))


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
    Clip('run', 0.56, run, loop=True),
    Clip('swing', 0.66, swing, events={'hit': 0.32}),
    Clip('combo', 1.12, combo, events={'hit': 0.32, 'hit2': 0.8}),
    Clip('slam', 0.86, slam, events={'hit': 0.46}),
    Clip('throw', 0.8, throw, events={'hit': 0.46}),
    Clip('shoot', 0.8, shoot, events={'hit': 0.32}),
    Clip('cast', 0.8, cast, events={'hit': 0.46}),
    Clip('cast_ground', 0.8, cast_ground, events={'hit': 0.45}),
    Clip('warcry', 0.85, warcry, events={'cry': 0.3}),
    Clip('dodge', 0.46, dodge),
    Clip('hit', 0.3, hit),
    Clip('death', 1.4, death),
]
