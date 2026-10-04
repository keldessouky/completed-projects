"""The rooftop's upgrades (after the second run on the RP6): the building board, and each upgrade's three tiers as a
piece of furniture standing where game/rooftop.cpp puts it. Every piece is in the roof's own axes (x east, y north,
z up), centred on its anchor; the roof's parapet is 1.1 m high."""
import math
import random
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model

__all__ = ['export_all']

BRASS, COPPER, WOOD, DARKWOOD, IRON = '#C89A45', '#B8653A', '#7A5434', '#4E3422', '#3A3634'
CLAY, TILE_BLUE, TILE_WHITE, CLOTH_RED, CLOTH_CREAM = '#A8603A', '#2E6E9E', '#E8E0D0', '#9E2E26', '#E2D2B0'


def _m(name):
    m = Model(name)
    m.verbose = False
    return m


def _lathe(part, c, prof, seg=16):
    """A round body from (height, radius) pairs, standing at c."""
    part.sloft([(V(c) + V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in prof], seg=seg)


def _glass(part, c):
    _lathe(part, c, ((0.0, 0.025), (0.09, 0.035)), seg=8)


def _pigeon(m, c, rnd, facing=None):
    a = facing if facing is not None else rnd.uniform(0, TAU)
    d = V((math.cos(a), math.sin(a), 0))
    b = Part()
    b.sphere(V(c) + V((0, 0, 0.07)), (0.11, 0.07, 0.07), Matrix.Rotation(a, 4, 'Z'), seg=8)
    b.sphere(V(c) + d * 0.1 + V((0, 0, 0.13)), 0.04, seg=6)
    b.capsule(V(c) - d * 0.1 + V((0, 0, 0.07)), V(c) - d * 0.2 + V((0, 0, 0.09)), 0.03, 0.01, seg=5)
    m.add(b, rnd.choice(['#8C8E96', '#6E7078', '#B0B0B4', '#5A4E48']), rough=0.8)


def _lantern(m, c, glow='#FFB04A'):
    """A pierced brass lantern with its light inside."""
    p = Part()
    _lathe(p, c, ((0.0, 0.06), (0.05, 0.1), (0.2, 0.1), (0.28, 0.05), (0.36, 0.015)), seg=8)
    m.add(p, BRASS, rough=0.35, metal=1.0)
    g = Part()
    g.sphere(V(c) + V((0, 0, 0.13)), 0.075, seg=8)
    m.add(g, glow, rough=0.4, emit=1.0)


def board():
    """The building board: a wooden notice board on two legs with chalk plans pinned to it, a lamp on top."""
    m = _m('roof_board')
    wood = Part()
    for x in (-0.8, 0.8):
        wood.box((x, 0, 1.0), (0.09, 0.09, 2.0))
    wood.box((0, 0, 1.45), (1.7, 0.06, 1.0))
    wood.box((0, 0.04, 2.0), (1.8, 0.14, 0.08))
    m.add(wood, WOOD, rough=0.85, flat=True)
    slate = Part()
    slate.box((0, 0.035, 1.45), (1.5, 0.02, 0.86))
    m.add(slate, '#2E3430', rough=0.9, flat=True)
    chalk = Part()   # a roof plan in chalk: the parapet, the counter, a tower, little squares for tables
    for (x, z, w, h) in ((0, 1.78, 1.2, 0.02), (0, 1.12, 1.2, 0.02), (-0.6, 1.45, 0.02, 0.66), (0.6, 1.45, 0.02, 0.66),
                         (0.45, 1.5, 0.12, 0.36), (-0.4, 1.62, 0.1, 0.1), (-0.1, 1.3, 0.1, 0.1), (0.15, 1.6, 0.1, 0.1),
                         (-0.45, 1.25, 0.14, 0.03), (-0.45, 1.33, 0.03, 0.14)):
        chalk.box((x, 0.05, z), (w, 0.01, h))
    m.add(chalk, '#E8E4D8', rough=0.9, flat=True)
    paper = Part()
    paper.box((0.7, 0.06, 1.62), (0.22, 0.01, 0.28), Matrix.Rotation(0.1, 4, 'Y'))
    m.add(paper, '#D8C8A0', rough=0.9, flat=True)
    _lantern(m, (0, 0.1, 2.04))
    return m


def samovar(t):
    m = _m('roof_samovar_%d' % t)
    rnd = random.Random(10 + t)
    if t == 1:   # a brass samovar on a little stand, glasses beside it
        st = Part()
        st.box((0, 0, 0.36), (0.6, 0.6, 0.06))
        for x in (-0.25, 0.25):
            for y in (-0.25, 0.25):
                st.box((x, y, 0.17), (0.05, 0.05, 0.34))
        m.add(st, DARKWOOD, rough=0.8, flat=True)
        sv = Part()
        _lathe(sv, (0, 0, 0.39), ((0.0, 0.12), (0.06, 0.08), (0.12, 0.17), (0.42, 0.18), (0.5, 0.1), (0.56, 0.06), (0.62, 0.09), (0.66, 0.02)))
        sv.capsule((0.17, 0, 0.55), (0.3, 0, 0.5), 0.02, seg=5)
        m.add(sv, BRASS, rough=0.3, metal=1.0)
        cl = Part()
        cl.sphere((0, 0, 0.47), 0.06, seg=6)
        m.add(cl, '#FF6A20', rough=0.5, emit=0.9)
        gl = Part()
        for k in range(4):
            _glass(gl, (-0.2 + k * 0.12, -0.2, 0.39))
        m.add(gl, '#B0402A', rough=0.15, emit=0.05)
    elif t == 2:   # a bench and a copper tray table set for tea
        b = Part()
        b.box((0, 0.55, 0.42), (1.4, 0.4, 0.06))
        for x in (-0.6, 0.6):
            b.box((x, 0.55, 0.2), (0.06, 0.36, 0.4))
        m.add(b, WOOD, rough=0.85, flat=True)
        cu = Part()
        for x in (-0.4, 0.0, 0.4):
            cu.box((x, 0.55, 0.5), (0.36, 0.34, 0.1))
        m.add(cu, rnd.choice([CLOTH_RED, '#2A5E6E']), rough=0.95, flat=True)
        tr = Part()
        _lathe(tr, (0, -0.1, 0), ((0.0, 0.08), (0.45, 0.04), (0.47, 0.32), (0.5, 0.32)), seg=18)
        m.add(tr, COPPER, rough=0.35, metal=1.0)
        gl = Part()
        for k in range(6):
            a = TAU * k / 6
            _glass(gl, (math.cos(a) * 0.2, -0.1 + math.sin(a) * 0.2, 0.5))
        m.add(gl, '#B0402A', rough=0.15)
        tp = Part()
        _lathe(tp, (0, -0.1, 0.5), ((0.0, 0.05), (0.08, 0.08), (0.14, 0.04), (0.18, 0.01)), seg=10)
        m.add(tp, '#D8D8D8', rough=0.25, metal=0.9)
    else:   # the grand samovar: tall copper on a carved base, a lantern on a post
        base = Part()
        base.box((0, 0, 0.3), (0.8, 0.8, 0.6))
        m.add(base, DARKWOOD, rough=0.75, flat=True)
        inlay = Part()
        for z in (0.12, 0.48):
            inlay.box((0, 0, z), (0.84, 0.84, 0.04))
        m.add(inlay, '#E0D0A8', rough=0.6, flat=True)
        sv = Part()
        _lathe(sv, (0, 0, 0.6), ((0.0, 0.2), (0.1, 0.14), (0.2, 0.28), (0.8, 0.3), (0.95, 0.16), (1.05, 0.1), (1.15, 0.16), (1.25, 0.03)), seg=20)
        sv.capsule((0.28, 0, 0.85), (0.48, 0, 0.8), 0.03, seg=6)
        for a in (0.0, math.pi):
            sv.capsule((math.cos(a) * 0.3, math.sin(a) * 0.3, 1.3), (math.cos(a) * 0.36, math.sin(a) * 0.36, 1.1), 0.02, seg=5)
        m.add(sv, COPPER, rough=0.3, metal=1.0)
        cl = Part()
        cl.sphere((0, 0, 0.72), 0.1, seg=8)
        m.add(cl, '#FF6A20', rough=0.5, emit=1.0)
        post = Part()
        post.box((0.75, 0.3, 1.1), (0.06, 0.06, 2.2))
        post.box((0.6, 0.3, 2.15), (0.36, 0.05, 0.05))
        m.add(post, IRON, rough=0.6, metal=0.6, flat=True)
        _lantern(m, (0.45, 0.3, 1.72))
    return m


def loft(t):
    m = _m('roof_loft_%d' % t)
    rnd = random.Random(20 + t)
    if t == 1:   # a coop on legs, a wire front, pigeons on its roof
        c = Part()
        c.box((0, 0, 1.15), (1.2, 0.9, 0.7))
        for x in (-0.55, 0.55):
            for y in (-0.4, 0.4):
                c.box((x, y, 0.4), (0.07, 0.07, 0.8))
        c.box((0, 0, 1.55), (1.35, 1.05, 0.06))
        m.add(c, WOOD, rough=0.85, flat=True)
        wire = Part()
        for k in range(9):
            wire.box((0.61, -0.4 + k * 0.1, 1.15), (0.01, 0.01, 0.62))
        for k in range(6):
            wire.box((0.61, 0, 0.88 + k * 0.1), (0.01, 0.82, 0.01))
        m.add(wire, '#9A9A9A', rough=0.5, metal=0.8, flat=True)
        for k in range(4):
            _pigeon(m, (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.35, 0.35), 1.58), rnd)
    elif t == 2:   # a Cairo pigeon tower: four tall posts, cross-bracing, a platform up top
        p = Part()
        h = 3.4
        for x in (-0.5, 0.5):
            for y in (-0.5, 0.5):
                p.box((x, y, h / 2), (0.08, 0.08, h))
        for z in (1.0, 2.0, 3.0):
            for (a, b) in (((-0.5, -0.5), (0.5, -0.5)), ((0.5, -0.5), (0.5, 0.5)), ((0.5, 0.5), (-0.5, 0.5)), ((-0.5, 0.5), (-0.5, -0.5))):
                p.capsule((a[0], a[1], z - 0.5), (b[0], b[1], z), 0.025, seg=4)
        p.box((0, 0, h), (1.4, 1.4, 0.06))
        m.add(p, '#8C6A44', rough=0.9, flat=True)
        flags = Part()
        flags.box((0.0, 0.0, h + 0.6), (0.03, 0.03, 1.2))
        m.add(flags, IRON, rough=0.6, metal=0.5, flat=True)
        cloth = Part()
        cloth.box((0.22, 0.0, h + 1.05), (0.42, 0.02, 0.26))
        m.add(cloth, '#C83A2A', rough=0.95, flat=True)
        for k in range(7):
            a = TAU * k / 7
            _pigeon(m, (math.cos(a) * 0.55, math.sin(a) * 0.55, h + 0.03), rnd, a + math.pi / 2)
    else:   # a perch rail across the corner, crowded with pigeons, a flock wheeling above
        r = Part()
        for x in (-0.9, 0.9):
            r.box((x, 0, 0.7), (0.06, 0.06, 1.4))
        r.box((0, 0, 1.4), (1.9, 0.05, 0.05))
        r.box((0, 0, 0.9), (1.9, 0.05, 0.05))
        m.add(r, WOOD, rough=0.85, flat=True)
        for k in range(9):
            _pigeon(m, (-0.85 + k * 0.21, 0, 1.43 if k % 2 else 0.93), rnd, math.pi / 2)
        for k in range(8):   # the flock, high up
            a = TAU * k / 8
            _pigeon(m, (math.cos(a) * 1.2, math.sin(a) * 1.2, 4.0 + 0.3 * math.sin(3 * a)), rnd, a + math.pi / 2)
    return m


def awning(t):
    m = _m('roof_awning_%d' % t)
    rnd = random.Random(30 + t)
    if t == 1:   # a striped awning over Amm Sayed's counter (the counter runs north-south, 4 m, by the east parapet)
        posts = Part()
        for y in (-2.3, 2.3):
            posts.box((-1.2, y, 1.3), (0.08, 0.08, 2.6))
            posts.box((1.2, y, 1.5), (0.08, 0.08, 3.0))
        m.add(posts, DARKWOOD, rough=0.8, flat=True)
        for k in range(10):   # stripes, sloping down to the west
            s = Part()
            y = -2.3 + 4.6 * (k + 0.5) / 10
            s.box((0.0, y, 2.8), (2.5, 4.6 / 10, 0.04), Matrix.Rotation(-0.16, 4, 'Y'))
            m.add(s, CLOTH_RED if k % 2 else CLOTH_CREAM, rough=0.95, flat=True)
        val = Part()
        for k in range(10):
            val.box((-1.24, -2.3 + 4.6 * (k + 0.5) / 10, 2.52), (0.03, 0.4, 0.18))
        m.add(val, '#C8A040', rough=0.9, flat=True)
    elif t == 2:   # crates and baskets of wares in front of the counter
        for (x, y, z, s) in ((0, 0, 0.25, 0.5), (0.55, 0.1, 0.25, 0.5), (0.25, 0.05, 0.75, 0.5), (-0.1, 0.7, 0.2, 0.4)):
            c = Part()
            c.box((x, y, z), (s, s, s))
            m.add(c, rnd.choice([WOOD, '#8C6A44']), rough=0.9, flat=True)
            sl = Part()
            sl.box((x, y - s / 2 - 0.005, z), (s * 0.9, 0.01, 0.06))
            m.add(sl, DARKWOOD, rough=0.9, flat=True)
        for (x, y) in ((-0.6, -0.2), (-0.7, 0.5)):
            b = Part()
            _lathe(b, (x, y, 0), ((0.0, 0.18), (0.32, 0.24), (0.34, 0.24)), seg=12)
            m.add(b, '#B08A50', rough=0.95)
            g = Part()
            for k in range(5):
                g.sphere((x + rnd.uniform(-0.1, 0.1), y + rnd.uniform(-0.1, 0.1), 0.36), 0.07, seg=6)
            m.add(g, rnd.choice(['#E08A2A', '#C83A2A', '#6A9A3A']), rough=0.7)
        rug = Part()
        rug.capsule((0.2, -0.45, 0.12), (0.2, 0.45, 0.12), 0.12, seg=10)
        m.add(rug, '#8E2A22', rough=0.95)
    else:   # lanterns hung under the awning, and a painted sign along its top
        for k in range(4):
            y = -1.6 + k * 1.07
            ch = Part()
            ch.box((-0.6, y, 2.35), (0.01, 0.01, 0.3))
            m.add(ch, IRON, rough=0.6, metal=0.6, flat=True)
            _lantern(m, (-0.6, y, 1.86), rnd.choice(['#FFB04A', '#FF8A5A', '#FFD08A']))
        sg = Part()
        sg.box((-1.3, 0, 3.2), (0.05, 3.0, 0.5))
        m.add(sg, '#2A5E6E', rough=0.7, flat=True)
        lt = Part()
        for k in range(9):
            lt.box((-1.33, -1.2 + k * 0.3, 3.2), (0.01, 0.18, 0.24))
        m.add(lt, '#E8D8A0', rough=0.6, emit=0.15, flat=True)
    return m


def forge(t):
    m = _m('roof_forge_%d' % t)
    if t == 1:   # an anvil on a stump, and leather bellows
        s = Part()
        _lathe(s, (0, 0, 0), ((0.0, 0.3), (0.6, 0.28)), seg=12)
        m.add(s, '#6A4A2E', rough=0.9)
        a = Part()
        a.box((0, 0, 0.7), (0.5, 0.2, 0.12))
        a.box((0, 0, 0.62), (0.26, 0.16, 0.08))
        a.capsule((0.25, 0, 0.72), (0.42, 0, 0.7), 0.06, 0.01, seg=6)
        m.add(a, IRON, rough=0.45, metal=0.9, flat=True)
        b = Part()
        b.sloft([(V((0.75 + q * 0.5, 0.4, 0.25)), V((0, 1, 0)), V((0, 0, 1)), 0.22 * (1 - q * 0.7), 0.06 + 0.08 * math.sin(math.pi * q)) for q in (0.0, 0.3, 0.6, 1.0)], seg=10)
        m.add(b, '#5A3A26', rough=0.9)
        hm = Part()
        hm.capsule((-0.1, 0.0, 0.78), (0.15, 0.1, 0.8), 0.015, seg=4)
        hm.box((-0.12, -0.01, 0.8), (0.05, 0.08, 0.05))
        m.add(hm, IRON, rough=0.5, metal=0.8)
    elif t == 2:   # a rack of tools against the parapet
        r = Part()
        r.box((0, 0, 1.0), (1.4, 0.06, 0.06))
        r.box((0, 0, 1.6), (1.4, 0.06, 0.06))
        for x in (-0.68, 0.68):
            r.box((x, 0, 0.85), (0.06, 0.06, 1.7))
        m.add(r, WOOD, rough=0.85, flat=True)
        t_ = Part()
        for k in range(6):
            x = -0.55 + k * 0.22
            t_.capsule((x, 0.05, 1.55), (x, 0.05, 1.05), 0.015, seg=4)
            if k % 2:
                t_.box((x, 0.05, 1.02), (0.12, 0.05, 0.06))
            else:
                t_.capsule((x - 0.04, 0.05, 1.05), (x - 0.06, 0.05, 0.95), 0.012, seg=4)
                t_.capsule((x + 0.04, 0.05, 1.05), (x + 0.06, 0.05, 0.95), 0.012, seg=4)
        m.add(t_, IRON, rough=0.5, metal=0.8)
    else:   # a little clay kiln, its mouth glowing, a chimney
        k = Part()
        k.sphere((0, 0, 0.45), (0.6, 0.6, 0.55), seg=16)
        k.box((0, 0, 0.12), (1.2, 1.2, 0.24))
        _lathe(k, (0.15, 0.15, 0.85), ((0.0, 0.12), (0.7, 0.1), (0.75, 0.13)), seg=10)
        m.add(k, CLAY, rough=0.95)
        mo = Part()
        mo.sphere((0, -0.52, 0.35), (0.2, 0.06, 0.16), seg=10)
        m.add(mo, '#FF6A20', rough=0.5, emit=1.0)
    return m


def cistern(t):
    m = _m('roof_cistern_%d' % t)
    if t == 1:   # three clay zir jars on a wooden stand, a tin cup on a chain
        st = Part()
        st.box((0, 0, 0.45), (1.8, 0.6, 0.06))
        for x in (-0.85, 0.85):
            st.box((x, 0, 0.22), (0.07, 0.55, 0.44))
        m.add(st, WOOD, rough=0.85, flat=True)
        for x in (-0.55, 0.0, 0.55):
            j = Part()
            _lathe(j, (x, 0, 0.48), ((0.0, 0.08), (0.2, 0.24), (0.5, 0.26), (0.7, 0.16), (0.78, 0.12), (0.82, 0.14)), seg=14)
            m.add(j, CLAY, rough=0.95)
        cp = Part()
        _lathe(cp, (0.3, -0.3, 0.48), ((0.0, 0.04), (0.08, 0.05)), seg=8)
        m.add(cp, '#B8B8B8', rough=0.3, metal=0.9)
    elif t == 2:   # a copper tank on legs with a tap
        tk = Part()
        tk.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), 0.55, 0.55) for z in (0.8, 1.9)], seg=18)
        tk.sloft([(V((0, 0, 1.9 + z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.0, 0.55), (0.18, 0.3), (0.22, 0.05))], seg=18)
        m.add(tk, COPPER, rough=0.35, metal=1.0)
        lg = Part()
        for a in (0.4, 2.0, 3.6, 5.2):
            lg.capsule((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.0), (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.85), 0.04, seg=5)
        m.add(lg, IRON, rough=0.6, metal=0.6)
        tap = Part()
        tap.capsule((0, -0.55, 0.95), (0, -0.75, 0.9), 0.03, seg=6)
        tap.capsule((0, -0.75, 0.9), (0, -0.78, 0.78), 0.02, seg=5)
        m.add(tap, BRASS, rough=0.3, metal=1.0)
    else:   # a tiled octagonal basin with water in it and a spout in the middle
        b = Part()
        R = 1.1
        pts = [(math.cos(TAU * (k + 0.5) / 8) * R, math.sin(TAU * (k + 0.5) / 8) * R) for k in range(8)]
        for (a, c) in zip(pts, pts[1:] + pts[:1]):
            mid = ((a[0] + c[0]) / 2, (a[1] + c[1]) / 2)
            ang = math.atan2(c[1] - a[1], c[0] - a[0])
            ln = math.hypot(c[0] - a[0], c[1] - a[1])
            b.box((mid[0], mid[1], 0.3), (ln + 0.04, 0.16, 0.6), Matrix.Rotation(ang, 4, 'Z'))
        m.add(b, TILE_WHITE, rough=0.4, flat=True)
        band = Part()
        for (a, c) in zip(pts, pts[1:] + pts[:1]):
            mid = ((a[0] + c[0]) / 2 * 1.01, (a[1] + c[1]) / 2 * 1.01)
            ang = math.atan2(c[1] - a[1], c[0] - a[0])
            ln = math.hypot(c[0] - a[0], c[1] - a[1])
            band.box((mid[0], mid[1], 0.42), (ln, 0.17, 0.14), Matrix.Rotation(ang, 4, 'Z'))
        m.add(band, TILE_BLUE, rough=0.3, flat=True)
        w = Part()
        w.sloft([(V((0, 0, z)), V((1, 0, 0)), V((0, 1, 0)), 1.0, 1.0) for z in (0.4, 0.5)], seg=8)
        m.add(w, '#3A8AB8', rough=0.05, emit=0.08)
        sp = Part()
        _lathe(sp, (0, 0, 0.5), ((0.0, 0.12), (0.3, 0.06), (0.45, 0.14), (0.5, 0.04)), seg=12)
        m.add(sp, BRASS, rough=0.3, metal=1.0)
    return m


def lamps(t):
    m = _m('roof_lamps_%d' % t)
    if t == 1:   # a brass lamp post by the chart table, its lamp hanging over the map
        p = Part()
        p.box((1.0, 0.8, 1.3), (0.07, 0.07, 2.6))
        p.box((0.5, 0.8, 2.58), (1.05, 0.05, 0.05))
        m.add(p, BRASS, rough=0.35, metal=1.0, flat=True)
        ch = Part()
        ch.box((0.0, 0.8, 2.4), (0.01, 0.01, 0.36))
        m.add(ch, IRON, rough=0.6, metal=0.6, flat=True)
        _lantern(m, (0.0, 0.8, 1.86))
    elif t == 2:   # two more poles and a line of pierced lamps across the table
        p = Part()
        for x in (-1.5, 1.5):
            p.box((x, -0.6, 1.3), (0.06, 0.06, 2.6))
        p.sweep([V((-1.5, -0.6, 2.55)), V((0, -0.6, 2.35)), V((1.5, -0.6, 2.55))], 0.01, seg=4)
        m.add(p, IRON, rough=0.6, metal=0.6)
        for x in (-0.8, 0.0, 0.8):
            _lantern(m, (x, -0.6, 1.98), '#FFD08A')
    else:   # a brass armillary sphere on a stand beside the table
        s = Part()
        _lathe(s, (0, 0, 0), ((0.0, 0.25), (0.05, 0.25), (0.08, 0.06), (0.9, 0.04), (0.95, 0.08)), seg=12)
        m.add(s, DARKWOOD, rough=0.7)
        rings = Part()
        c = V((0, 0, 1.35))
        for (ax, ang) in (('X', 0.0), ('Y', math.pi / 2), ('X', 1.2), ('Z', 0.0)):
            M = Matrix.Rotation(ang, 4, ax)
            pts = [c + M @ V((math.cos(TAU * k / 24) * 0.42, math.sin(TAU * k / 24) * 0.42, 0)) for k in range(25)]
            rings.sweep(pts, 0.012, seg=4)
        m.add(rings, BRASS, rough=0.3, metal=1.0)
        e = Part()
        e.sphere(c, 0.09, seg=10)
        m.add(e, '#3A6A9A', rough=0.4)
    return m


def lights(t):
    m = _m('roof_lights_%d' % t)
    rnd = random.Random(70 + t)
    if t == 1:   # two rugs on the roof, and floor cushions
        for (x, y, w, l, base, border) in ((0, 0, 2.4, 1.6, '#8E2A22', '#E0C070'), (1.6, 1.4, 1.6, 1.1, '#2A4E7E', '#D8C8A0')):
            r = Part()
            r.box((x, y, 0.045), (w, l, 0.01))
            m.add(r, base, rough=0.95, flat=True)
            b = Part()
            for (dx, dy, bw, bl) in ((0, l / 2 - 0.1, w, 0.08), (0, -l / 2 + 0.1, w, 0.08), (w / 2 - 0.1, 0, 0.08, l), (-w / 2 + 0.1, 0, 0.08, l)):
                b.box((x + dx, y + dy, 0.052), (bw, bl, 0.006))
            for k in range(3):
                b.box((x, y, 0.052), (0.3 + k * 0.3, 0.04, 0.006), Matrix.Rotation(k * math.pi / 3, 4, 'Z'))
            m.add(b, border, rough=0.9, flat=True)
        for k in range(4):
            c = Part()
            c.sphere((-0.9 + k * 0.6, -1.05, 0.12), (0.26, 0.22, 0.1), seg=8)
            m.add(c, rnd.choice(['#C83A2A', '#E0A030', '#2A6E5E', '#6A3A7A']), rough=0.95)
    elif t == 2:   # lanterns along the south parapet's top, and a garland
        for k in range(9):
            x = -7.4 + k * 2.0
            _lantern(m, (x, 0.0, 1.12), rnd.choice(['#FFB04A', '#FF8A5A', '#FFD08A']))
        g = Part()
        pts = [V((-7.4 + 16.0 * q / 32, 0.05, 1.7 - 0.25 * abs(math.sin(math.pi * q / 4)))) for q in range(33)]
        g.sweep(pts, 0.012, seg=4)
        m.add(g, '#3A6A2E', rough=0.8)
        fl = Part()
        for p in pts[::2]:
            fl.sphere(p - V((0, 0, 0.03)), 0.035, seg=5)
        m.add(fl, '#F0E8D0', rough=0.8, emit=0.05)
    else:   # a trellis along the west parapet with jasmine on it, and a cloth canopy out over the roof
        tr = Part()
        for y in (-2.2, -1.1, 0.0, 1.1, 2.2):
            tr.box((0, y, 1.3), (0.06, 0.06, 2.6))
        for z in (0.8, 1.5, 2.2):
            tr.box((0, 0, z), (0.05, 4.5, 0.04))
        for y in (-2.2, 0.0, 2.2):
            tr.box((0.9, y, 1.3), (0.06, 0.06, 2.6))
            tr.box((0.45, y, 2.58), (0.95, 0.05, 0.05))
        m.add(tr, WOOD, rough=0.85, flat=True)
        lv = Part()
        fl = Part()
        for k in range(60):
            y, z = rnd.uniform(-2.2, 2.2), rnd.uniform(0.3, 2.5)
            lv.sphere((rnd.uniform(-0.05, 0.12), y, z), (0.06, 0.12, 0.09), seg=5)
            if k % 3 == 0:
                fl.sphere((0.14, y + 0.05, z + 0.04), 0.03, seg=4)
        m.add(lv, '#3A6A2E', rough=0.8)
        m.add(fl, '#F8F4E8', rough=0.7, emit=0.1)
        cv = Part()
        cv.box((0.5, 0, 2.66), (1.1, 4.6, 0.03), Matrix.Rotation(0.08, 4, 'Y'))
        m.add(cv, '#E8D8B0', rough=0.95, flat=True)
    return m


def export_all(mesh_dir):
    ms = [board()]
    for make in (samovar, loft, awning, forge, cistern, lamps, lights):
        ms += [make(t) for t in (1, 2, 3)]
    for m in ms:
        m.export('%s/%s.qmesh' % (mesh_dir, m.name), skinned=False, ao=True)
