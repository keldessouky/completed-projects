"""Act VI's regions for the cell kit (env/kit.py): Across the Red Sea.

  balad    al-Balad, old Jeddah: houses of coral stone, grey-white with bands of plaster, four and five storeys high,
           each hung with rawasheen (the projecting wooden bay windows, their lattices painted green, blue and brown);
           wooden benches along the lanes; a coffee seller's stand for the landmark
  shibam   Shibam in Wadi Hadramawt: tower houses of mudbrick six storeys high, tapering, whitewashed at the top, their
           windows small and deep; palm-rib ladders and water jars in the lanes; a well with its bucket frame
  iram     Iram of the Pillars, the lost city in the sand: red sandstone ruins, broken walls, and colossal pillars carved in
           bands, some standing and some fallen; a ring of pillars round a paved circle for the arena

No mosque stands in any of them (brief.md §5): houses, towers, a well, a coffee stand and ruins only.
Blocks south of a lane stay low (the camera looks north over them); blocks north of it may be tall.
The Empty Quarter reuses the dunes, the Ruins of Wabar Shali's, the Old Harbour Tangier's sea walls, and Totality over
Luxor the hall of Karnak under a black sun.
"""
import math
from mathutils import Vector as V

from qart.geom import TAU
from env.regions import Paint, post_lamp, face_points, frange, junction_corners


def rawshan(P, px, py, n, horiz, z, color, h=1.6):
    """A projecting latticed bay window on a wall: a box out from the face, its front a lattice of thin slats."""
    ox, oy = n[0] * 0.35, n[1] * 0.35
    w = 1.1
    P(color).box((px + ox, py + oy, z), (w if horiz else 0.7, 0.7 if horiz else w, h))
    for k in range(5):   # the lattice's slats, a shade darker
        f = -w / 2 + (k + 0.5) * w / 5
        P('#2A1E14').box((px + ox + n[0] * 0.36 + (f if horiz else 0), py + oy + n[1] * 0.36 + (0 if horiz else f), z),
                         (0.04 if horiz else 0.02, 0.02 if horiz else 0.04, h * 0.85))
    P(color).box((px + ox, py + oy, z + h / 2 + 0.1), (w + 0.2 if horiz else 0.8, 0.8 if horiz else w + 0.2, 0.14))   # its hood


# ================================================================ al-Balad, old Jeddah
class Balad:
    NAME, LANE = 'balad', 4.4
    STONE = ['#D8CFC0', '#CEC4B2', '#E2DACC', '#C8BCA8']
    WOOD = ['#3E6A5A', '#3A5A8A', '#6A4A30', '#4A6A4A', '#7A5A3A']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#9A8E7A').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#B8AC96', rough=0.95).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for _ in range(int((x1 - x0) * (y1 - y0) / 8)):   # patches of old paving
                x, y = rnd.uniform(x0 + 0.4, x1 - 0.4), rnd.uniform(y0 + 0.4, y1 - 0.4)
                P(rnd.choice(['#A89C86', '#C8BCA6']), rough=0.9).box((x, y, 0.022), (rnd.uniform(0.5, 1.0), rnd.uniform(0.4, 0.8), 0.01))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.8, 3.4) if low else rnd.uniform(7.0, 9.5)
        P(rnd.choice(Balad.STONE)).box((cx, cy, h / 2), (w, d, h))
        for z in frange(2.2, h - 0.5, 2.4):   # the plaster bands between storeys
            P('#F0EAE0').box((cx, cy, z), (w + 0.06, d + 0.06, 0.18))
        P('#F0EAE0').box((cx, cy, h + 0.25), (w + 0.1, d + 0.1, 0.5))   # the parapet
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    P(rnd.choice(Balad.WOOD[2:])).box((px + n[0] * 0.04, py + n[1] * 0.04, 1.1), (0.9 if horiz else 0.06, 0.06 if horiz else 0.9, 2.2))
                elif not low and rnd.random() < 0.55:
                    rawshan(P, px, py, n, horiz, rnd.choice([3.4, 5.8]), rnd.choice(Balad.WOOD))
                elif low and rnd.random() < 0.3:
                    P('#3A2E22').box((px + n[0] * 0.04, py + n[1] * 0.04, 1.9), (0.6 if horiz else 0.06, 0.06 if horiz else 0.6, 0.8))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # a wooden bench (a merkaz) with a lamp over it
            P('#6A4A30').box((x, y, 0.3), (1.4, 0.6, 0.12))
            for sx in (-1, 1):
                P('#5A3E28').box((x + sx * 0.6, y, 0.15), (0.1, 0.5, 0.3))
            P('#FFB060', rough=0.3, emit=0.9, flat=False).sphere((x, y + 0.5, 2.4), (0.12, 0.12, 0.16), seg=6)
            ctx.light((x, y + 0.5, 2.3), 5.0, (12.0, 7.5, 3.0))
            ctx.solid(x, y, 0.7, 0.3)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # a gate in the old wall: coral-stone towers either side, a flat lintel of timber
        for sx in (-1, 1):
            x = sx * (Balad.LANE / 2 + 0.8)
            P('#D8CFC0').box((x, -7.0, 2.8), (1.6, 1.6, 5.6))
            P('#F0EAE0').box((x, -7.0, 5.7), (1.8, 1.8, 0.3))
            ctx.solid(x, -7.0, 0.8, 0.8)
            post_lamp(P, ctx, sx * (Balad.LANE / 2 - 0.4), -5.4, h=2.6, color='#FFB060', light=(11.0, 7.0, 2.8))
        P('#6A4A30').box((0, -7.0, 4.3), (Balad.LANE + 1.8, 1.0, 0.4))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a small square under the houses: tall facades hung with rawasheen round the far side, benches, lamps
        for k in range(7):
            a = math.pi * 0.1 + math.pi * 0.8 * k / 6
            x, y = math.cos(a) * 7.0, math.sin(a) * 7.0
            P(rnd.choice(Balad.STONE)).box((x, y, 3.5), (2.2, 1.2, 7.0))
            n = (-math.cos(a), -math.sin(a))
            rawshan(P, x + n[0] * 0.3, y + n[1] * 0.3, n, abs(n[1]) > abs(n[0]), 3.6, rnd.choice(Balad.WOOD))
            ctx.solid(x, y, 1.1, 0.6)
        for sx in (-1, 1):
            P('#6A4A30').box((sx * 4.0, -1.0, 0.3), (0.6, 1.8, 0.12))
            ctx.solid(sx * 4.0, -1.0, 0.3, 0.9)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -3.0, h=2.6, color='#FFB060', light=(12.0, 7.5, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a coffee seller's stand: a counter, brass dallah pots on a tray, small cups, a charcoal brazier (to the south)
        P('#6A4A30').box((0, -5.2, 0.5), (2.8, 0.8, 1.0))
        for i in range(4):
            P('#C89A45', metal=1.0, rough=0.25, flat=False).sphere((-0.9 + i * 0.6, -5.2, 1.18), (0.12, 0.12, 0.18), seg=8)
        P('#2A2A2A', metal=0.5).box((1.8, -5.2, 0.35), (0.6, 0.6, 0.7))
        P('#FF7A2A', emit=1.2).box((1.8, -5.2, 0.72), (0.5, 0.5, 0.04))
        ctx.solid(0.2, -5.2, 1.8, 0.45)
        ctx.light((0, -4.0, 2.4), 7.5, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


# ================================================================ Shibam, the towers of Hadramawt
class Shibam:
    NAME, LANE = 'shibam', 4.0
    MUD = ['#B08A60', '#A07C54', '#BC966A', '#9A7650']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A6E4E').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#A08260', rough=1.0).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        mud = rnd.choice(Shibam.MUD)
        if low:
            h = rnd.uniform(2.6, 3.2)
            P(mud).box((cx, cy, h / 2), (w, d, h))
            P('#EFE8DC').box((cx, cy, h + 0.1), (w + 0.04, d + 0.04, 0.2))
        else:
            # a tower house: tapering a little as it rises, its top storeys whitewashed
            h = rnd.uniform(11.0, 15.0)
            for k in range(4):
                z0, z1 = h * k / 4, h * (k + 1) / 4
                shrink = 0.08 * k
                col = '#EFE8DC' if k == 3 else mud
                P(col).box((cx, cy, (z0 + z1) / 2), (w - shrink, d - shrink, z1 - z0))
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    P('#5A3E28').box((px + n[0] * 0.04, py + n[1] * 0.04, 1.0), (0.8 if horiz else 0.06, 0.06 if horiz else 0.8, 2.0))
                for z in ([] if low else frange(3.4, 10.0, 2.2)):   # small deep windows, storey on storey, framed in white
                    if rnd.random() < 0.5:
                        P('#EFE8DC').box((px + n[0] * 0.03, py + n[1] * 0.03, z), (0.6 if horiz else 0.05, 0.05 if horiz else 0.6, 0.7))
                        P('#1E1610').box((px + n[0] * 0.05, py + n[1] * 0.05, z), (0.4 if horiz else 0.05, 0.05 if horiz else 0.4, 0.5))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # water jars on a stand, and a palm-rib ladder against the wall
            for k in range(3):
                P('#9A5A3A', flat=False).sphere((x + k * 0.45 - 0.45, y, 0.35), (0.2, 0.2, 0.3), seg=8)
            P('#7A6A4A').box((x + 0.9, y, 1.4), (0.08, 0.5, 2.8))
            ctx.solid(x, y, 0.7, 0.3)
            post_lamp(P, ctx, x - 0.9, y, h=2.4, color='#FFB060', light=(11.0, 7.0, 2.8))
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the town gate in the mud wall, whitewashed round its arch
        for sx in (-1, 1):
            x = sx * (Shibam.LANE / 2 + 0.9)
            P('#A07C54').box((x, -7.0, 3.0), (1.8, 1.8, 6.0))
            P('#EFE8DC').box((x, -7.0, 6.1), (1.9, 1.9, 0.2))
            ctx.solid(x, -7.0, 0.9, 0.9)
            post_lamp(P, ctx, sx * (Shibam.LANE / 2 - 0.4), -5.4, h=2.6, color='#FFB060', light=(11.0, 7.0, 2.8))
        P('#EFE8DC', flat=False).sloft([(V((0, -7.0 + dy, 4.4)), V((1, 0, 0)), V((0, 0, 1)), Shibam.LANE / 2 + 0.9, 1.0)
                                        for dy in (-0.9, 0.9)], seg=18, a0=0, a1=math.pi, closed=False)
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the square below the towers: tall houses round the far side, a trough, lamps
        for k in range(6):
            a = math.pi * 0.12 + math.pi * 0.76 * k / 5
            x, y = math.cos(a) * 7.2, math.sin(a) * 7.2
            h = rnd.uniform(12.0, 15.0)
            P(rnd.choice(Shibam.MUD)).box((x, y, h * 0.4), (2.4, 2.0, h * 0.8))
            P('#EFE8DC').box((x, y, h * 0.9), (2.3, 1.9, h * 0.2))
            ctx.solid(x, y, 1.2, 1.0)
        P('#8A6E4E').box((0, 3.0, 0.3), (2.6, 0.8, 0.6))
        P('#3A6A7A', rough=0.1, metal=0.3).box((0, 3.0, 0.58), (2.4, 0.6, 0.02))
        ctx.solid(0, 3.0, 1.3, 0.4)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -1.0, h=2.6, color='#FFB060', light=(12.0, 7.5, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the town well: a round curb, a timber frame over it with its pulley and a leather bucket (to the south)
        P('#A07C54', flat=False).sloft([(V((0, -5.2, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 1.0), (0.8, 1.0))], seg=16)
        P('#1A2A30', rough=0.1).box((0, -5.2, 0.78), (1.4, 1.4, 0.02))
        for sx in (-1, 1):
            P('#6A4A30').box((sx * 1.0, -5.2, 1.4), (0.14, 0.14, 2.8))
        P('#6A4A30').box((0, -5.2, 2.8), (2.2, 0.14, 0.14))
        P('#5A3E28', flat=False).sphere((0, -5.2, 1.9), (0.22, 0.22, 0.25), seg=8)
        ctx.solid(0, -5.2, 1.1, 1.1)
        ctx.light((0, -4.0, 2.4), 7.5, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


# ================================================================ Iram of the Pillars
def pillar(P, x, y, h, r=0.9, fallen=False, rnd=None, color='#B8704A'):
    """A colossal column carved in bands; standing, or fallen along the ground in drums."""
    if fallen:
        a = rnd.uniform(0, TAU) if rnd else 0.0
        d = V((math.cos(a), math.sin(a), 0))
        for k in range(4):
            c = V((x, y, r)) + d * (k * 2.1 * r)
            P(color, flat=False).sloft([(c + d * dz, d, V((0, 0, 1)), r, r) for dz in (-r, r)], seg=14)
        return
    P(color, flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z in (0, h)], seg=16)
    for z in frange(1.2, h - 0.5, 1.8):   # the carved bands
        P('#8A4A30', flat=False).sloft([(V((x, y, z + dz)), V((1, 0, 0)), V((0, 1, 0)), r + 0.08, r + 0.08) for dz in (-0.12, 0.12)], seg=16)
    P('#C88A5A').box((x, y, h + 0.2), (r * 2.6, r * 2.6, 0.4))   # the capital


class Iram:
    NAME, LANE = 'iram', 5.0
    STONE = ['#B8704A', '#A86240', '#C47E54', '#9A5A3A']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#C8A070').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#D4AE7C', rough=1.0).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for _ in range(int((x1 - x0) * (y1 - y0) / 10)):   # paving slabs showing through the sand
                x, y = rnd.uniform(x0 + 0.5, x1 - 0.5), rnd.uniform(y0 + 0.5, y1 - 0.5)
                P(rnd.choice(Iram.STONE), rough=0.9).box((x, y, 0.022), (rnd.uniform(0.8, 1.4), rnd.uniform(0.6, 1.0), 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # ruin: a broken wall round the plot, sand heaped inside, and pillars where the plot is big enough
        h = rnd.uniform(1.4, 2.4) if low else rnd.uniform(3.0, 5.0)
        col = rnd.choice(Iram.STONE)
        P(col).box((cx, cy, h / 2), (w, d, h))
        P('#C8A070').box((cx, cy, h + 0.15), (w - 0.3, d - 0.3, 0.3))
        for _ in range(int(w * d / 6)):   # tumbled blocks on top
            P(col).box((rnd.uniform(x0 + 0.4, x1 - 0.4), rnd.uniform(y0 + 0.4, y1 - 0.4), h + 0.4), (0.7, 0.5, 0.5))
        if not low and w > 3.0 and d > 3.0:
            pillar(P, cx, cy, rnd.uniform(8.0, 12.0), r=0.8, color=col)
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.8))
            # a fallen column in drums across the corner, and a lamp of the dead city's own light
            pillar(P, x, y, 0, r=0.55, fallen=True, rnd=rnd)
            P('#FFD08A', rough=0.3, emit=1.0, flat=False).sphere((x, y, 1.6), (0.14, 0.14, 0.14), seg=6)
            ctx.light((x, y, 1.6), 5.0, (12.0, 8.5, 4.0))
            ctx.solid(x, y, 0.6, 0.6)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # two great pillars either side of the way in, one leaning, the sand drifted against them
        for sx in (-1, 1):
            x = sx * (Iram.LANE / 2 + 1.0)
            pillar(P, x, -7.0, 10.0 if sx < 0 else 8.0, r=0.95)
            ctx.solid(x, -7.0, 1.0, 1.0)
            post_lamp(P, ctx, sx * (Iram.LANE / 2 - 0.4), -5.2, h=2.4, color='#FFD08A', light=(11.0, 8.0, 4.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the ring of pillars round a paved circle, open to the south
        P('#B8704A', rough=0.8).box((0, 0.5, 0.02), (11.0, 11.0, 0.04))
        for k in range(10):
            a = TAU * k / 10 + 0.3
            x, y = math.cos(a) * 6.6, math.sin(a) * 6.6
            if y < -4.0 and abs(x) < 3.2:
                continue
            pillar(P, x, y, rnd.uniform(9.0, 13.0), r=0.8)
            ctx.solid(x, y, 0.85, 0.85)
        for x in (-3.2, 3.2):
            post_lamp(P, ctx, x, -1.5, h=2.6, color='#FFD08A', light=(12.0, 8.5, 4.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a colossal stone head face-down in the sand, cracked across (to the south)
        P('#B8704A', flat=False).sphere((0, -5.4, 0.9), (1.6, 1.3, 1.1), seg=16)
        P('#8A4A30').box((0, -5.4, 1.9), (3.0, 0.1, 0.1))
        P('#C88A5A').box((0, -4.1, 0.3), (1.2, 0.5, 0.6))
        ctx.solid(0, -5.2, 1.6, 1.3)
        ctx.light((0, -3.6, 2.6), 7.5, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


REGIONS = [Balad, Shibam, Iram]
