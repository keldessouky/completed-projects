"""Act IV's own things, the Maghreb Coast (GDD §9, brief §5: folklore only).

  iron_door  the Iron Door of the souq: a great studded door of the Tunis medina, green and black, with its bronze
             knockers and its horseshoe of black and white stone, torn from its wall and walking; a jinn lives in it.
             A static mesh (a possessed thing, like the Ram of the Avenue)
  drummer    a musician of the Zar Nights, sitting on a low stool with a frame drum (the bendir) on the left knee, the
             right hand beating it; a white robe and a coloured sash

The Ghula of the Salt is Umm al-Ghula's body crusted white; the salt ghouls and the mirage jinn are the ghoul and the
sand jinn, tinted. The Mirage (Sarab) is the ifrit, pale as heat-shimmer.
"""
import math
from mathutils import Vector as V

from qart.geom import Part, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul


def iron_door():
    """The Iron Door, 3.2 m: two leaves of green-painted planks in a black iron frame, rows of domed studs, a bronze
    knocker on each leaf, the arch of alternating black and white voussoirs over it, and a jinn's light in the gap
    between the leaves. Front is -Y."""
    m = Model('iron_door')
    fr = Part()
    fr.box(V((0, 0, 1.4)), (2.4, 0.3, 2.8))
    m.add(fr, '#1E3A2C', rough=0.7)
    ir = Part()
    for x in (-1.2, 1.2):
        ir.box(V((x, 0, 1.4)), (0.12, 0.36, 2.8))
    for z in (0.05, 0.95, 1.85, 2.75):
        ir.box(V((0, -0.16, z)), (2.4, 0.06, 0.1))
    m.add(ir, '#1A1A1A', rough=0.4, metal=0.8)
    st = Part()
    for x in [(-1.0 + 0.25 * i) for i in range(9)]:
        for z in [(0.3 + 0.3 * j) for j in range(9)]:
            if abs(x) < 0.08:
                continue
            st.sphere(V((x, -0.17, z)), 0.035, seg=6)
    m.add(st, '#2A2A2A', rough=0.35, metal=0.9)
    kn = Part()
    for x in (-0.55, 0.55):
        kn.sweep([V((x + 0.14 * math.cos(a), -0.2, 1.55 + 0.14 * math.sin(a))) for a in [TAU * k / 16 for k in range(17)]], 0.02, seg=5)
        kn.sphere(V((x, -0.2, 1.72)), 0.05, seg=8)
    m.add(kn, '#B8863A', rough=0.3, metal=1.0)
    ar = Part()
    for k in range(11):
        a = math.pi * k / 10
        ar.box(V((1.35 * math.cos(a), -0.02, 2.8 + 0.7 * math.sin(a))), (0.3, 0.4, 0.26))
    m.add(ar, '#E8E2D6', rough=0.7)
    ar2 = Part()
    for k in range(10):
        a = math.pi * (k + 0.5) / 10
        ar2.box(V((1.35 * math.cos(a), -0.03, 2.8 + 0.7 * math.sin(a))), (0.28, 0.38, 0.24))
    m.add(ar2, '#2A2A2A', rough=0.7)
    gl = Part()
    gl.box(V((0, -0.17, 1.4)), (0.05, 0.02, 2.4))
    m.add(gl, '#FFB84A', rough=0.3, emit=1.0)
    return m


def drummer_skeleton():
    return rig.humanoid(height=1.7, shoulder=0.2, arm_drop=62.0)


def drummer(J):
    from characters import npc
    from characters.jinn import _H
    col = dict(npc.COL, skin='#7A4A30', hair='#1A1410', robe='#E8E4DA', robe2='#D0CCC2', vest='#5A2A6A', towel='#C8A030')
    m = npc.keeper(J, col=col, name='drummer')
    H, T_ = _H(J)
    dr = Part()   # the bendir: a wide frame drum of goat skin on a wooden hoop, held on the left forearm
    c = H('hand_L') + V((0.08, -0.12, 0.05))
    dr.sloft([(c + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.22, 0.22) for dz in (-0.04, 0.04)], seg=20)
    m.add(dr, '#8A6A44', rough=0.6, bone='hand_L', flat=True)
    sk = Part()
    sk.sloft([(c + V((0, 0, dz)), V((1, 0, 0)), V((0, 1, 0)), 0.205, 0.205) for dz in (0.04, 0.046)], seg=20)
    m.add(sk, '#E8D8B8', rough=0.8, bone='hand_L', flat=True)
    return m


def drummer_idle(P, t):
    # seated on a low stool, the drum on the left knee, the right hand beating the Zar's rhythm
    P.off['pelvis'] = V((0, 0, -0.42))
    for s in 'LR':
        P.rot['thigh_' + s] = eul(-85, 0, 0)
        P.rot['calf_' + s] = eul(90, 0, 0)
    beat = (t % 0.5) / 0.5
    hit = keys(beat, [(0.0, 0.0), (0.15, 1.0), (0.3, 0.0)])
    P.rot['spine'] = eul(10 + 3 * hit, 0, 0)
    P.rot['head'] = eul(8 + 6 * hit + cyc(t, 2.0, 3), 0, cyc(t, 4.0, 8))
    P.rot['upperarm_L'] = eul(-35, 0, 25)
    P.rot['forearm_L'] = eul(-70, 0, 0)
    P.rot['upperarm_R'] = eul(-40 - 25 * hit, 0, -10)
    P.rot['forearm_R'] = eul(-60 + 30 * hit, 0, 0)


DRUMMER_CLIPS = [Clip('idle', 2.0, drummer_idle, loop=True)]

CREATURES = [
    ('drummer', drummer_skeleton, drummer, DRUMMER_CLIPS),
]
STATICS = [('iron_door', iron_door)]
