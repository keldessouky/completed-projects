"""Ghouls of the City of the Dead: gaunt, hunched, long-armed, wrapped in grave cloth. One model and one clip set
serve the swarmer, the bruiser (scaled up) and the spitter (tinted)."""
import math
import numpy as np
from mathutils import Vector as V, Matrix, noise

from qart.geom import Part, basis, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul

COL = dict(skin='#6E6474', skin2='#584E60', cloth='#2E2824', cloth2='#3C3228', nail='#C8C0B0', eye='#FF2E88',
           mouth='#1A0E14', bone='#B8AE98')


def skeleton():
    return rig.humanoid(height=1.72, shoulder=0.19, hip=0.1, arm_drop=62.0, hunch=0.78, arm_len=1.28, leg_len=0.95)


def build(J):
    m = Model('ghoul', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]

    # torso: a gaunt, bowed ribcage over a narrow waist
    t = Part()
    sp0, sp1 = H('spine'), T_('spine')
    ch0, ch1 = H('chest'), T_('chest')
    t.capsule(H('pelvis'), sp0, 0.12, 0.11, seg=12)
    t.capsule(sp0, sp1, 0.11, 0.14, seg=12)
    t.capsule(ch0, ch1, 0.15, 0.12, seg=12)
    fwd = (ch1 - ch0).normalized().cross(V((1, 0, 0))).normalized()
    for k in range(4):  # ribs pressing through the skin
        c = ch0 + (ch1 - ch0) * (0.2 + 0.18 * k)
        for s in (-1, 1):
            t.capsule(c + V((s * 0.02, 0, 0)) + fwd * 0.1, c + V((s * 0.14, 0, 0)) + fwd * 0.03, 0.018, seg=6)
    t.sphere(H('pelvis') + V((0, 0, -0.02)), (0.13, 0.1, 0.1), seg=12)
    # spine ridge down the back
    for k in range(7):
        c = sp0.lerp(ch1, k / 6)
        t.sphere(c - fwd * 0.12, 0.028, seg=6)
    m.add(t, COL['skin'], rough=0.6, bones=['pelvis', 'spine', 'chest', 'neck'], sigma=0.1, voxel=0.012, smooth=3, tris=700)

    # head: long skull, heavy brow, open jaw
    hd = Part()
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    hd.sphere(h0 + up * 0.1 - fw * 0.01, (0.085, 0.11, 0.1), seg=16)
    hd.capsule(h0 + up * 0.11 + fw * 0.06 + V((-0.05, 0, 0)), h0 + up * 0.11 + fw * 0.06 + V((0.05, 0, 0)), 0.022, seg=8)
    hd.sphere(h0 + up * 0.03 + fw * 0.07, (0.06, 0.07, 0.04), seg=12)
    hd.capsule(h0 + up * 0.0 + fw * 0.02, h0 - up * 0.04 + fw * 0.1, 0.035, seg=8)  # jaw hanging open
    hd.capsule(H('neck'), h0 + up * 0.04, 0.05, 0.055, seg=10)
    m.add(hd, COL['skin2'], rough=0.55, bones=['head', 'neck'], sigma=0.06, voxel=0.008, smooth=2, tris=450)
    for s in (-1, 1):
        e = Part()
        e.sphere(h0 + up * 0.09 + fw * 0.085 + V((s * 0.032, 0, 0)), (0.016, 0.01, 0.01), seg=8)
        m.add(e, COL['eye'], rough=0.3, emit=1.0, bone='head')
    teeth = Part()
    for k in range(6):
        x = (k - 2.5) * 0.014
        base = h0 + up * 0.035 + fw * 0.11 + V((x, 0, 0))
        teeth.capsule(base, base - up * 0.025, 0.005, 0.002, seg=5)
    m.add(teeth, COL['bone'], rough=0.5, bone='head')

    # limbs: long, sinewy arms with talons; bent legs
    for s in 'LR':
        a = Part()
        sh, el, wr, ht = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s), T_('hand_' + s)
        a.capsule(sh, el, 0.055, 0.04, seg=10)
        a.capsule(el, wr, 0.042, 0.03, seg=10)
        a.sphere(el, 0.045, seg=8)
        dv = (ht - wr).normalized()
        u, v_, w = basis(dv, V((0, -1, 0)))
        a.capsule(wr, wr + dv * 0.07, 0.035, 0.03, seg=8)
        m.add(a, COL['skin'], rough=0.6, bones=['clavicle_' + s, 'upperarm_' + s, 'forearm_' + s, 'hand_' + s], sigma=0.07,
              voxel=0.01, smooth=2, tris=260)
        cl = Part()
        for k in range(3):
            base = wr + dv * 0.07 + v_ * ((k - 1) * 0.022)
            tip = base + dv * 0.1 + u * 0.03
            cl.capsule(base, tip, 0.009, 0.002, seg=5)
        m.add(cl, COL['nail'], rough=0.4, bone='hand_' + s)
        l = Part()
        l.capsule(H('thigh_' + s), H('calf_' + s), 0.075, 0.05, seg=10)
        l.capsule(H('calf_' + s), H('foot_' + s), 0.045, 0.035, seg=10)
        l.capsule(H('foot_' + s), T_('foot_' + s), 0.035, 0.02, seg=8)
        m.add(l, COL['skin'], rough=0.6, bones=['pelvis', 'thigh_' + s, 'calf_' + s, 'foot_' + s], sigma=0.07, voxel=0.012,
              smooth=2, tris=260)

    # grave cloth: a ragged loincloth and a tattered shawl
    lc = Part()
    for k in range(9):
        a = TAU * k / 9
        top = H('pelvis') + V((0.13 * math.cos(a), 0.11 * math.sin(a), 0.03))
        bot = top + V((0.05 * math.cos(a), 0.05 * math.sin(a), -0.28 - 0.08 * math.sin(k * 2.7)))
        lc.sweep([top, top.lerp(bot, 0.5) + V((0, 0, 0.01)), bot], (0.004, 0.035), seg=4, hint=V((math.cos(a), math.sin(a), 0)))
    m.add(lc, COL['cloth'], rough=0.95, bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.12)
    sw = Part()
    for k in range(7):
        a = math.pi * (0.1 + 0.8 * k / 6)
        top = ch1 + V((0.16 * math.cos(a), 0.05 - 0.1 * math.sin(a), -0.02))
        bot = top + V((0.02 * math.cos(a), 0.08, -0.3 - 0.06 * math.sin(k * 1.9)))
        sw.sweep([top, bot], (0.004, 0.04), seg=4, hint=V((math.cos(a), 0.5, 0.2)))
    m.add(sw, COL['cloth2'], rough=0.95, bones=['chest', 'spine'], sigma=0.12)
    return m


# ---------------------------------------------------------------------- clips
def base_pose(P, t):
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['thigh_' + s] = eul(-25, 0, sg * 8)
        P.rot['calf_' + s] = eul(45, 0, 0)
        P.rot['foot_' + s] = eul(-20, 0, 0)
        P.rot['upperarm_' + s] = eul(-15, 0, 0)
        P.rot['forearm_' + s] = eul(-25, 0, 0)
    P.off['pelvis'] = V((0, 0, -0.1))


def idle(P, t):
    base_pose(P, t)
    P.rot['spine'] = eul(cyc(t, 2.0, 3), 0, cyc(t, 3.1, 3))
    P.rot['chest'] = eul(cyc(t, 2.0, 4, 0.5), 0, 0)
    P.rot['head'] = eul(-20 + cyc(t, 1.3, 4), 0, cyc(t, 2.6, 12) + (18 if (t % 2.6) > 2.3 else 0))
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-15 + cyc(t, 2.0, 5, sg), sg * cyc(t, 2.6, 4), 0)


def run(P, t):
    T = 0.5
    ph = t / T * math.tau
    P.off['pelvis'] = V((0, 0, -0.12 + 0.05 * abs(math.sin(ph))))
    P.rot['spine'] = eul(18, 0, 10 * math.sin(ph))
    P.rot['chest'] = eul(8, 0, -8 * math.sin(ph))
    P.rot['head'] = eul(-30, 0, -6 * math.sin(ph))
    for s, o, sg in (('L', 0.0, 1), ('R', math.pi, -1)):
        a = ph + o
        P.rot['thigh_' + s] = eul(-30 - 40 * math.sin(a), 0, sg * 6)
        P.rot['calf_' + s] = eul(45 + 45 * max(0.0, math.sin(a - 1.0)), 0, 0)
        P.rot['foot_' + s] = eul(-20 + 15 * math.sin(a), 0, 0)
        P.rot['upperarm_' + s] = eul(-30 + 45 * math.sin(a), 0, sg * 10)
        P.rot['forearm_' + s] = eul(-30 - 20 * max(0.0, math.sin(a)), 0, 0)


def claw(P, t):
    base_pose(P, t)
    wind = keys(t, [(0.0, 0.0), (0.42, 1.0), (0.5, 1.0)])
    strike = keys(t, [(0.48, 0.0), (0.58, 1.0), (0.75, 1.0), (1.0, 0.0)])
    P.rot['spine'] = eul(10 - 10 * wind + 25 * strike, 0, 25 * wind - 45 * strike)
    P.rot['chest'] = eul(-10 * wind + 10 * strike, 0, 15 * wind - 25 * strike)
    P.rot['head'] = eul(-25, 0, 0)
    P.rot['upperarm_R'] = eul(-20 - 70 * wind + 50 * strike, 0, -60 * wind + 40 * strike)
    P.rot['forearm_R'] = eul(-60 * wind + 50 * strike, 0, 0)
    P.rot['upperarm_L'] = eul(-15 - 40 * strike, 0, 30 * strike)


def slam(P, t):
    base_pose(P, t)
    wind = keys(t, [(0.0, 0.0), (0.7, 1.0), (0.78, 1.0)])
    strike = keys(t, [(0.76, 0.0), (0.86, 1.0), (1.05, 1.0), (1.3, 0.0)])
    P.rot['spine'] = eul(-25 * wind + 45 * strike, 0, 0)
    P.rot['chest'] = eul(-15 * wind + 20 * strike, 0, 0)
    P.rot['head'] = eul(-30 + 10 * strike, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-15 - 150 * wind + 110 * strike, 0, sg * 10)
        P.rot['forearm_' + s] = eul(-40 * wind + 20 * strike, 0, 0)
    P.off['pelvis'] = V((0, 0, -0.1 + 0.05 * wind - 0.12 * strike))


def spit(P, t):
    base_pose(P, t)
    rear = keys(t, [(0.0, 0.0), (0.4, 1.0), (0.46, 1.0)])
    lunge = keys(t, [(0.44, 0.0), (0.52, 1.0), (0.7, 1.0), (0.9, 0.0)])
    P.rot['spine'] = eul(-20 * rear + 30 * lunge, 0, 0)
    P.rot['chest'] = eul(-15 * rear + 15 * lunge, 0, 0)
    P.rot['neck'] = eul(-25 * rear + 30 * lunge, 0, 0)
    P.rot['head'] = eul(-35 * rear + 15 * lunge, 0, 0)


def hit(P, t):
    k = keys(t, [(0.0, 0.0), (0.05, 1.0), (0.3, 0.0)])
    idle(P, t)
    P.rot['spine'] = eul(-20 * k, 0, 10 * k) @ P.rot['spine']
    P.rot['head'] = eul(-25 * k, 0, 0) @ P.rot['head']


def stagger(P, t):
    base_pose(P, t)
    P.rot['spine'] = eul(-15 + cyc(t, 0.6, 6), 0, cyc(t, 0.9, 15))
    P.rot['head'] = eul(-10 + cyc(t, 0.5, 10), 0, cyc(t, 0.7, 20))
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(10 + cyc(t, 0.6, 12, sg), 0, sg * 20)


def death(P, t):
    k = keys(t, [(0.0, 0.0), (0.55, 1.0)], ease=lambda u: u * u)
    base_pose(P, t)
    P.rot['root'] = eul(80 * k, 0, 0)
    P.off['root'] = V((0, 0, 0))
    P.rot['spine'] = eul(20 * k, 0, 0)
    P.rot['head'] = eul(30 * k, 0, 20 * k)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-80 * k, 0, sg * 30 * k)


CLIPS = [
    Clip('idle', 2.6, idle, loop=True),
    Clip('run', 0.5, run, loop=True),
    Clip('claw', 1.0, claw, events={'hit': 0.56}),
    Clip('slam', 1.3, slam, events={'hit': 0.85}),
    Clip('spit', 0.9, spit, events={'fire': 0.5}),
    Clip('hit', 0.3, hit),
    Clip('stagger', 1.2, stagger, loop=True),
    Clip('death', 1.0, death),
]
