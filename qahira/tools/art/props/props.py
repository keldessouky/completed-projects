"""Small props: the Lamplighter's cache (closed and open) and the meshes loot uses on the ground.
Loot meshes are near-white where the engine tints them (currency beads take their currency's colour)."""
import math
import bmesh
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from qart.model import Model

__all__ = ['chest', 'loot_bundle', 'loot_trinket', 'loot_coins', 'loot_bead', 'export_all']


def _xform(part, M):
    bmesh.ops.transform(part.bm, matrix=M, verts=list(part.bm.verts))


def _ngon(part, pts):
    part.bm.faces.new([part.bm.verts.new(V(p)) for p in pts])


def chest(open_=False):
    m = Model('chest_open' if open_ else 'chest')
    m.verbose = False
    w, d, h = 1.0, 0.62, 0.5
    body = Part()
    body.box((0, 0, h / 2), (w, d, h))
    m.add(body, '#5A3A22', rough=0.8, flat=True)
    if open_:
        glow = Part()
        glow.box((0, 0, h - 0.02), (w - 0.1, d - 0.1, 0.04))
        m.add(glow, '#FFC060', rough=0.4, emit=0.6, flat=True)
    # the lid: a shallow barrel vault hinged at the back edge
    arc = [(-d / 2 * math.cos(math.pi * i / 8), 0.16 * math.sin(math.pi * i / 8)) for i in range(9)]
    lid = Part()
    lid.grid([[(x, y, h + z) for x in (-w / 2, w / 2)] for (y, z) in arc], closed=False)
    _ngon(lid, [(-w / 2, y, h + z) for (y, z) in arc])
    _ngon(lid, [(w / 2, y, h + z) for (y, z) in reversed(arc)])
    bands, lid_bands = Part(), Part()
    for x in (-0.35, 0.0, 0.35):
        bands.box((x, 0, h / 2), (0.06, d + 0.02, h + 0.02))
        for i in range(8):
            (y0, z0), (y1, z1) = arc[i], arc[i + 1]
            lid_bands.capsule((x, y0 * 1.04, h + z0 * 1.06 + 0.005), (x, y1 * 1.04, h + z1 * 1.06 + 0.005), 0.022, seg=5)
    lock = Part()
    lock.box((0, -d / 2 - 0.02, h - 0.05), (0.14, 0.04, 0.16))
    if open_:
        hinge = Matrix.Translation((0, d / 2, h)) @ Matrix.Rotation(math.radians(-105), 4, 'X') @ Matrix.Translation((0, -d / 2, -h))
        for part in (lid, lid_bands, lock):
            _xform(part, hinge)
    m.add(lid, '#6A4428', rough=0.8, flat=True)
    m.add(bands, '#B88A3A', rough=0.35, metal=1.0, flat=True)
    m.add(lid_bands, '#B88A3A', rough=0.35, metal=1.0)
    m.add(lock, '#C89A45', rough=0.3, metal=1.0, flat=True)
    return m


def loot_bundle():
    """A folded cloth bundle tied with cord: armour on the ground."""
    m = Model('loot_bundle')
    m.verbose = False
    b = Part()
    b.sphere((0, 0, 0.13), (0.3, 0.22, 0.13), seg=16)
    b.sphere((0.05, 0.02, 0.24), (0.2, 0.15, 0.07), seg=12)
    m.add(b, '#E8E2D6', rough=0.9, voxel=0.01, smooth=2, tris=500)
    c = Part()
    c.sweep([V((-0.31, 0, 0.12)), V((-0.2, 0, 0.27)), V((0.0, 0, 0.3)), V((0.2, 0, 0.27)), V((0.31, 0, 0.12))], 0.014, seg=5)
    c.sweep([V((0, -0.23, 0.12)), V((0, -0.14, 0.26)), V((0, 0.0, 0.3)), V((0, 0.14, 0.26)), V((0, 0.23, 0.12))], 0.014, seg=5)
    m.add(c, '#8A6A40', rough=0.8)
    return m


def loot_trinket():
    """A brass ring with a blue bead: jewellery on the ground."""
    m = Model('loot_trinket')
    m.verbose = False
    r = Part()
    pts = [V((0.11 * math.cos(a), 0.11 * math.sin(a), 0.03)) for a in [TAU * i / 16 for i in range(17)]]
    r.sweep(pts, 0.025, seg=6)
    m.add(r, '#E0B860', rough=0.3, metal=1.0)
    bd = Part()
    bd.sphere((0.11, 0, 0.07), 0.05, seg=10)
    m.add(bd, '#3A7AE0', rough=0.2, emit=0.15)
    return m


def loot_coins():
    """A small spill of dinars."""
    m = Model('loot_coins')
    m.verbose = False
    import random
    rnd = random.Random(7)
    c = Part()
    for k in range(9):
        a = rnd.uniform(0, TAU)
        rr = rnd.uniform(0, 0.16)
        z = 0.01 + (0.02 * k if k < 4 else 0.0)
        c.sloft([(V((rr * math.cos(a), rr * math.sin(a), z)), V((1, 0, 0)), V((0, 1, 0)), 0.055, 0.055),
                 (V((rr * math.cos(a), rr * math.sin(a), z + 0.012)), V((1, 0, 0)), V((0, 1, 0)), 0.055, 0.055)], seg=10)
    m.add(c, '#F0C860', rough=0.25, metal=1.0, flat=True)
    return m


def loot_bead():
    """A glass bead on a knotted thread: every crafting currency shares it, tinted per kind."""
    m = Model('loot_bead')
    m.verbose = False
    b = Part()
    b.sphere((0, 0, 0.1), (0.09, 0.09, 0.08), seg=14)
    m.add(b, '#F4F4F4', rough=0.15, emit=0.3)
    t = Part()
    t.sweep([V((-0.14, 0.02, 0.02)), V((-0.08, 0, 0.1)), V((0.08, 0, 0.1)), V((0.14, -0.03, 0.02))], 0.008, seg=4)
    m.add(t, '#6A5A48', rough=0.9)
    return m


def export_all(mesh_dir):
    for m in (chest(False), chest(True), loot_bundle(), loot_trinket(), loot_coins(), loot_bead()):
        m.export('%s/%s.qmesh' % (mesh_dir, m.name), skinned=False, ao=True)
