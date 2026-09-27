"""Hub characters: the ahwa keeper (vendor, on the shared rig) and a Cairo street cat (a small static prop)."""
import math
from mathutils import Vector as V, Matrix

from qart.geom import Part, basis, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul

COL = dict(skin='#8A5A3C', hair='#8A8680', robe='#6A5E4E', robe2='#4E4638', vest='#2A2A30', towel='#D8D0C0', sandal='#3A2A20')


def keeper_skeleton():
    return rig.humanoid(height=1.72, shoulder=0.2, arm_drop=62.0)


def keeper(J, col=None, name='keeper'):
    C = col or COL
    m = Model(name, J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    # galabeya: one long robe from the shoulders to the ankles
    r = Part()
    secs = [(1.5, 0, 0.02, 0.2, 0.13), (1.4, 0, 0.02, 0.21, 0.15), (1.2, 0, 0.01, 0.2, 0.15), (1.0, 0, 0.0, 0.19, 0.15),
            (0.7, 0, 0.0, 0.23, 0.18), (0.35, 0, 0.0, 0.27, 0.2), (0.1, 0, 0.0, 0.29, 0.22)]
    r.loft(secs, seg=28, caps=True, folds=6)  # capped: the voxel remesh needs a closed surface
    for s in 'LR':
        sh, el, wr = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s)
        r.capsule(sh, el, 0.07, 0.065, seg=12)
        r.capsule(el, wr, 0.065, 0.075, seg=12)
    m.add(r, C['robe'], rough=0.9, bones=['pelvis', 'spine', 'chest', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R', 'clavicle_L',
                                             'clavicle_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'], sigma=0.12,
          voxel=0.012, smooth=3, tris=1400)
    v = Part()
    v.loft([(1.12, 0, 0.0, 0.215, 0.165), (1.3, 0, 0.012, 0.225, 0.17), (1.46, 0, 0.02, 0.225, 0.155)], seg=24, a0=-60, a1=240, caps=False)
    m.add(v, C['vest'], rough=0.8, bones=['spine', 'chest'], sigma=0.12, solidify=0.01, recalc=False)
    tw = Part()
    tw.sweep([V((0.12, 0.06, 1.53)), V((0.18, -0.05, 1.5)), V((0.2, -0.13, 1.35)), V((0.21, -0.14, 1.2))], (0.008, 0.07), seg=6, hint=V((1, -0.3, 0)))
    m.add(tw, C['towel'], rough=0.95, bone='chest')
    h = Part()
    h.sphere((0, 0.008, 1.61), (0.085, 0.1, 0.11), seg=24)
    h.capsule((0, 0.01, 1.45), (0, 0, 1.56), 0.055, seg=10)
    h.sphere((0, -0.085, 1.6), (0.018, 0.03, 0.025), seg=8)
    for sx in (-1, 1):
        h.sphere((sx * 0.085, 0.01, 1.6), (0.012, 0.025, 0.03), seg=8)
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        h.capsule(wr, ht, 0.04, 0.035, seg=8)
    m.add(h, C['skin'], rough=0.55, bones=['head', 'neck', 'hand_L', 'hand_R'], sigma=0.07, voxel=0.006, smooth=2, tris=700)
    hr = Part()
    hr.sphere((0, 0.02, 1.64), (0.088, 0.1, 0.1), seg=16)
    hr.capsule((-0.035, -0.095, 1.585), (0.035, -0.095, 1.585), 0.012, seg=6)  # moustache
    m.add(hr, C['hair'], rough=0.85, bones=['head'], sigma=0.1, voxel=0.006, smooth=1, tris=300)
    for s in 'LR':
        sd = Part()
        an, to = H('foot_' + s), T_('foot_' + s)
        sd.capsule(an + V((0, 0.03, -0.06)), to, 0.045, 0.035, seg=8)
        m.add(sd, C['sandal'], rough=0.7, bones=['foot_' + s], sigma=0.05)
    return m


def keeper_idle(P, t):
    P.rot['spine'] = eul(cyc(t, 3.2, 2), 0, cyc(t, 5.0, 3))
    P.rot['head'] = eul(-5 + cyc(t, 4.0, 3), 0, cyc(t, 6.5, 14))
    wipe = max(0.0, math.sin(t / 5.0 * math.tau))
    P.rot['upperarm_R'] = eul(-45 * wipe, 0, -20 * wipe)
    P.rot['forearm_R'] = eul(-70 * wipe + cyc(t, 0.6, 12) * wipe, 0, 0)
    P.rot['upperarm_L'] = eul(-10, 0, 8)
    P.rot['forearm_L'] = eul(-25, 0, 0)


KEEPER_CLIPS = [Clip('idle', 5.0, keeper_idle, loop=True)]


def cat():
    m = Model('cat')
    b = Part()
    b.sphere((0, 0.0, 0.2), (0.09, 0.2, 0.1), seg=16)
    b.sphere((0, -0.2, 0.27), (0.07, 0.07, 0.065), seg=14)
    for sx in (-1, 1):
        b.capsule((sx * 0.035, -0.21, 0.32), (sx * 0.045, -0.21, 0.37), 0.022, 0.004, seg=6)
        for ly in (-0.12, 0.12):
            b.capsule((sx * 0.05, ly, 0.16), (sx * 0.05, ly - 0.01, 0.0), 0.022, 0.018, seg=6)
    b.sweep([V((0, 0.19, 0.24)), V((0, 0.28, 0.3)), V((0.04, 0.33, 0.42)), V((0.08, 0.3, 0.5))], lambda t: 0.022 * (1 - 0.4 * t), seg=6)
    m.add(b, '#B06A30', rough=0.85, voxel=0.006, smooth=2, tris=900)
    e = Part()
    for sx in (-1, 1):
        e.sphere((sx * 0.028, -0.262, 0.285), 0.011, seg=6)
    m.add(e, '#8AFF6A', rough=0.3, emit=0.6)
    return m
