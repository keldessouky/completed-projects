"""Umm al-Ghula, Mother of the Ghouls: the City of the Dead's boss. A towering ghoul with long hair, a
tattered shroud, a necklace of bones and great talons."""
import math
from mathutils import Vector as V

from qart.geom import Part, basis, TAU
from qart import rig
from qart.rig import Clip, keys, cyc, eul
from characters import ghoul


def skeleton():
    return rig.humanoid(height=2.45, shoulder=0.24, hip=0.12, arm_drop=58.0, hunch=0.62, arm_len=1.35, leg_len=0.97)


def build(J):
    m = ghoul.build(J)
    m.name = 'ghoula'
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]
    h0, h1 = H('head'), T_('head')
    up = (h1 - h0).normalized()
    fw = up.cross(V((1, 0, 0))).normalized()
    # long black hair falling over the shoulders and down the back
    hair = Part()
    for k in range(14):
        a = math.pi * (0.1 + 0.8 * k / 13)
        root = h0 + up * 0.16 + V((0.08 * math.cos(a), 0, 0)) - fw * (0.05 + 0.04 * math.sin(a))
        pts = [root]
        for i in range(1, 6):
            pts.append(root + V((0.09 * math.cos(a) * i / 5, 0.07 * i, -0.17 * i)) - fw * 0.02 * i)
        hair.sweep(pts, lambda t: (0.006, 0.03 * (1 - 0.6 * t)), seg=4, hint=V((0, 1, 0.3)))
    m.add(hair, '#141012', rough=0.8, bones=['head', 'neck', 'chest'], sigma=0.14)
    # the shroud: long tattered strips from the shoulders to the ground
    sh = Part()
    ch1 = T_('chest')
    for k in range(12):
        a = math.pi * (-0.15 + 1.3 * k / 11)
        top = ch1 + V((0.2 * math.cos(a), 0.12 - 0.05 * math.sin(a), -0.05))
        bot = V((top.x * 1.4, top.y + 0.15, 0.25 + 0.2 * math.sin(k * 2.1)))
        sh.sweep([top, top.lerp(bot, 0.5) + V((0, 0.05, 0)), bot], (0.005, 0.07), seg=4, hint=V((math.cos(a), 0.6, 0)))
    m.add(sh, '#3A3634', rough=0.95, bones=['chest', 'spine', 'pelvis', 'thigh_L', 'thigh_R'], sigma=0.25)
    # necklace of bones
    nk = Part()
    c = H('neck')
    for k in range(11):
        a = math.pi * (1.1 + 0.8 * k / 10)
        p = c + V((0.13 * math.cos(a), 0.1 * math.sin(a) - 0.02, -0.06 - 0.04 * math.sin(math.pi * k / 10)))
        nk.capsule(p, p - V((0, 0, 0.05)), 0.012, 0.006, seg=5)
    m.add(nk, '#D8CEB4', rough=0.6, bone='chest')
    # great talons
    for s in 'LR':
        wr, ht = H('hand_' + s), T_('hand_' + s)
        dv = (ht - wr).normalized()
        u, v_, w = basis(dv, V((0, -1, 0)))
        cl = Part()
        for k in range(4):
            base = wr + dv * 0.08 + v_ * ((k - 1.5) * 0.025)
            cl.capsule(base, base + dv * 0.2 + u * 0.06, 0.014, 0.003, seg=5)
        m.add(cl, '#E0D8C4', rough=0.35, bone='hand_' + s)
    return m


def base(P, t):
    ghoul.base_pose(P, t)


def idle(P, t):
    ghoul.idle(P, t)
    P.rot['head'] = eul(-15 + cyc(t, 2.2, 5), 0, cyc(t, 3.3, 18))


def run(P, t):
    ghoul.run(P, t * 0.85)


def combo(P, t):
    base(P, t)
    w1 = keys(t, [(0.0, 0.0), (0.35, 1.0)])
    s1 = keys(t, [(0.33, 0.0), (0.45, 1.0)])
    w2 = keys(t, [(0.5, 0.0), (0.7, 1.0)])
    s2 = keys(t, [(0.68, 0.0), (0.8, 1.0), (1.0, 1.0), (1.25, 0.0)])
    P.rot['spine'] = eul(10 + 15 * s1 + 15 * s2, 0, 30 * w1 - 50 * s1 - 40 * w2 + 60 * s2)
    P.rot['upperarm_R'] = eul(-30 - 70 * w1 + 60 * s1, 0, -50 * w1 + 50 * s1)
    P.rot['forearm_R'] = eul(-60 * w1 + 50 * s1, 0, 0)
    P.rot['upperarm_L'] = eul(-30 - 70 * w2 + 60 * s2, 0, 50 * w2 - 50 * s2)
    P.rot['forearm_L'] = eul(-60 * w2 + 50 * s2, 0, 0)


def leap(P, t):
    base(P, t)
    crouch = keys(t, [(0.0, 0.0), (0.35, 1.0), (0.45, 0.0)])
    air = keys(t, [(0.4, 0.0), (0.62, 1.0), (0.85, 0.0)])
    land = keys(t, [(0.84, 0.0), (0.9, 1.0), (1.2, 0.0)])
    P.off['root'] = V((0, 0, 2.2 * air))
    P.off['pelvis'] = V((0, 0, -0.1 - 0.35 * crouch - 0.3 * land))
    P.rot['spine'] = eul(20 * crouch - 20 * air + 40 * land, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(20 * crouch - 150 * air + 120 * land, 0, sg * 25 * air)
        P.rot['thigh_' + s] = eul(-25 - 40 * crouch - 30 * land, 0, sg * 8)
        P.rot['calf_' + s] = eul(45 + 60 * crouch + 50 * land, 0, 0)


def wail(P, t):
    base(P, t)
    k = keys(t, [(0.0, 0.0), (0.9, 1.0), (1.4, 1.0), (1.8, 0.0)])
    P.rot['spine'] = eul(-35 * k, 0, 0)
    P.rot['chest'] = eul(-20 * k, 0, 0)
    P.rot['head'] = eul(-45 * k + cyc(t, 0.08, 4 * k), 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-40 * k, 0, sg * 70 * k)
        P.rot['forearm_' + s] = eul(-30 * k, 0, 0)


def summon(P, t):
    base(P, t)
    up = keys(t, [(0.0, 0.0), (0.8, 1.0)])
    down = keys(t, [(0.8, 0.0), (1.0, 1.0), (1.4, 0.0)])
    P.rot['spine'] = eul(-20 * up + 50 * down, 0, 0)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['upperarm_' + s] = eul(-170 * up + 150 * down, 0, sg * 20)
    P.off['pelvis'] = V((0, 0, -0.1 - 0.3 * down))


CLIPS = [
    Clip('idle', 2.6, idle, loop=True),
    Clip('run', 0.6, run, loop=True),
    Clip('combo', 1.3, combo, events={'hit': 0.45, 'hit2': 0.8}),
    Clip('leap', 1.3, leap, events={'hit': 0.88}),
    Clip('wail', 1.9, wail, events={'hit': 1.0}),
    Clip('summon', 1.5, summon, events={'summon': 1.0}),
    Clip('hit', 0.3, ghoul.hit),
    Clip('stagger', 1.2, ghoul.stagger, loop=True),
    Clip('death', 1.0, ghoul.death),
]
