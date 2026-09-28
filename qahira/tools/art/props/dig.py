"""Excavations (Slice 7's endgame piece): the surveyor's stake with its plunger box, a blasting charge set in the sand,
the doorway of a buried chamber, and a relic on the ground. Static meshes; the engine places and tints them."""
import math
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model

__all__ = ['stake', 'charge', 'chamber', 'loot_relic', 'export_all']


def stake():
    """A surveyor's stake with a red rag, and beside it the plunger box that fires the charges down the line."""
    m = Model('dig_stake')
    m.verbose = False
    p = Part()
    p.box((0, 0, 0.75), (0.06, 0.06, 1.5))
    m.add(p, '#8A6A44', rough=0.85, bevel=0.01, flat=True)
    f = Part()
    f.box((0.13, 0, 1.36), (0.24, 0.012, 0.16))
    m.add(f, '#B02A22', rough=0.9, flat=True)
    b = Part()
    b.box((0.45, -0.1, 0.16), (0.36, 0.26, 0.32))
    m.add(b, '#5A3E26', rough=0.7, bevel=0.015, flat=True)
    h = Part()
    h.capsule((0.45, -0.1, 0.3), (0.45, -0.1, 0.62), 0.018, seg=6)
    h.capsule((0.33, -0.1, 0.62), (0.57, -0.1, 0.62), 0.024, seg=6)
    m.add(h, '#6A6E74', rough=0.35, metal=0.9)
    w = Part()
    w.sweep([V((0.63, -0.1, 0.2)), V((0.8, -0.2, 0.05)), V((1.1, -0.1, 0.02))], 0.008, seg=4)
    m.add(w, '#1A1A1A', rough=0.6)
    return m


def charge():
    """A bundle of blasting sticks bound with wire, set in a scrape in the sand, its fuse wire trailing."""
    m = Model('dig_charge')
    m.verbose = False
    s = Part()
    for i, (x, y) in enumerate(((0, 0), (0.06, 0.02), (-0.05, 0.04), (0.02, 0.07))):
        s.capsule((x, y, 0.06), (x, y, 0.34), 0.035, seg=8)
    m.add(s, '#B8342A', rough=0.7)
    b = Part()
    for z in (0.12, 0.28):
        b.sloft([(V((0.005, 0.035, z + dz)), V((1, 0, 0)), V((0, 1, 0)), 0.1, 0.085) for dz in (0.0, 0.012)], seg=12)
    m.add(b, '#6A6E74', rough=0.4, metal=0.8)
    w = Part()
    w.sweep([V((0, 0.03, 0.34)), V((0.05, 0.05, 0.46)), V((0.2, 0.1, 0.4)), V((0.4, 0.1, 0.03))], 0.007, seg=4)
    m.add(w, '#1A1A1A', rough=0.6)
    d = Part()
    d.sloft([(V((0, 0.03, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.9) for z, r in ((0.005, 0.3), (0.03, 0.2), (0.05, 0.08))], seg=16)
    m.add(d, '#C8B08A', rough=0.95)
    return m


def chamber():
    """The doorway of a buried chamber once the sand is blown away: a sandstone frame and lintel over steps going
    down into the dark, the lintel carved with a band of zigzags and rosettes."""
    m = Model('dig_chamber')
    m.verbose = False
    st = Part()
    for sx in (-1, 1):
        st.box((sx * 1.05, 0, 0.9), (0.4, 0.5, 1.8))
    st.box((0, 0, 2.0), (2.7, 0.62, 0.42))
    m.add(st, '#C8A878', rough=0.85, bevel=0.02, flat=True)
    c = Part()
    for i in range(9):
        x = -1.1 + i * 0.275
        c.box((x, -0.315, 2.0 + (0.06 if i % 2 else -0.06)), (0.2, 0.02, 0.08), rot=Matrix.Rotation(math.radians(45 if i % 2 else -45), 4, 'Y'))
    for x in (-0.95, 0.95):
        c.sphere((x, -0.32, 2.0), (0.09, 0.02, 0.09), seg=10)
    m.add(c, '#8A6A44', rough=0.8, flat=True)
    dk = Part()
    dk.box((0, 0.02, 0.8), (1.7, 0.1, 1.6))
    m.add(dk, '#0A0806', rough=1.0, flat=True)
    sp = Part()
    for i in range(4):
        sp.box((0, -0.45 - i * 0.28, 0.02 + (3 - i) * 0.0), (1.6, 0.26, 0.04))
    m.add(sp, '#B89868', rough=0.9, bevel=0.01, flat=True)
    r = Part()
    for k in range(10):
        a = TAU * k / 10
        r.sphere((math.cos(a) * 1.9, math.sin(a) * 1.4 - 0.4, 0.05), (0.35, 0.3, 0.12), seg=10)
    m.add(r, '#D8C49A', rough=0.95)
    return m


def loot_relic():
    """A relic on the ground: a small glazed figure broken off at the knees (the engine tints it)."""
    m = Model('loot_relic')
    m.verbose = False
    b = Part()
    b.loft([(0.02, 0, 0, 0.05, 0.035), (0.12, 0, 0, 0.055, 0.04), (0.2, 0, 0, 0.045, 0.035), (0.24, 0, 0, 0.03, 0.025)], seg=12)
    b.sphere((0, 0, 0.28), (0.035, 0.035, 0.04), seg=10)
    m.add(b, '#E8F0EC', rough=0.3, emit=0.25)
    return m


def export_all(mesh_dir):
    for m in (stake(), charge(), chamber(), loot_relic()):
        m.export('%s/%s.qmesh' % (mesh_dir, m.name), skinned=False, ao=True)
