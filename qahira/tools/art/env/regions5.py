"""Act V's regions for the cell kit (env/kit.py): the Atlas and the Strait.

  fes      Fes el-Bali and its tanneries: ochre and umber walls, leather hides drying on the roofs and hung on poles,
           the honeycomb of the dye pits (white lime, saffron, poppy red, indigo, henna) for the landmark
  chaouen  Chefchaouen: lanes and stairs washed in every blue, whitewashed trims, flower pots on the steps, a spring
           under an arch
  jemaa    Jemaa el-Fnaa at night: a great open square of beaten earth, the food stalls under their canvas with smoke
           and lanterns, orange-juice carts in a row, strings of lamps between poles
  tangier  Tangier on the Strait: the kasbah's white walls and blue doors, the ramparts over the sea with their old
           cannons, and the water of the Strait beyond

No mosque stands in any of them (brief.md §5): the tanneries, the lanes, the square and the walls only.
Blocks south of a lane stay low (the camera looks north over them); blocks north of it may be tall.
"""
import math
from mathutils import Vector as V

from qart.geom import TAU
from env.regions import Paint, post_lamp, face_points, frange, junction_corners


# ================================================================ Fes el-Bali and its tanneries
class Fes:
    NAME, LANE = 'fes', 4.4
    WALLS = ['#B08A5A', '#9C7A50', '#C49A64', '#8A6A44']
    DYES = ['#F0ECE0', '#E0A83A', '#B8322A', '#3A4E8A', '#A85A2A', '#6A8A3A']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#6E5A44').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#8A7458', rough=0.95).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for _ in range(int((x1 - x0) * (y1 - y0) / 6)):   # stains of dye trodden into the lane
                x, y = rnd.uniform(x0 + 0.3, x1 - 0.3), rnd.uniform(y0 + 0.3, y1 - 0.3)
                P(rnd.choice(Fes.DYES[1:]), rough=0.9).box((x, y, 0.022), (rnd.uniform(0.3, 0.7), rnd.uniform(0.3, 0.7), 0.01))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.6, 3.2) if low else rnd.uniform(5.0, 7.0)
        P(rnd.choice(Fes.WALLS)).box((cx, cy, h / 2), (w, d, h))
        # hides drying on the roof, flat in the sun
        for _ in range(int(w * d / 3)):
            P(rnd.choice(['#D8B888', '#C8A070', '#E0C898', '#B89060'])).box((rnd.uniform(x0 + 0.4, x1 - 0.4), rnd.uniform(y0 + 0.4, y1 - 0.4),
                                                                              h + 0.03), (0.7, 0.5, 0.03))
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    # a tannery door, low and dark, with a pole of hides hung beside it
                    P('#2A2016').box((px + n[0] * 0.03, py + n[1] * 0.03, 1.0), (0.9 if horiz else 0.06, 0.06 if horiz else 0.9, 2.0))
                    ox = (0.8 if horiz else 0)
                    oy = (0 if horiz else 0.8)
                    P('#5A4430', flat=False).capsule(V((px + ox + n[0] * 0.3, py + oy + n[1] * 0.3, 0)),
                                                    V((px + ox + n[0] * 0.3, py + oy + n[1] * 0.3, 2.6)), 0.04, seg=5)
                    P(rnd.choice(Fes.DYES[1:])).box((px + ox + n[0] * 0.36, py + oy + n[1] * 0.36, 1.8),
                                                    (0.5 if horiz else 0.03, 0.03 if horiz else 0.5, 0.8))
                elif rnd.random() < 0.3:
                    P('#3A2A1A').box((px + n[0] * 0.05, py + n[1] * 0.05, 3.2), (0.5 if horiz else 0.06, 0.06 if horiz else 0.5, 0.6))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # a stack of cured hides on a donkey's saddle frame, and a lamp on a bracket
            P('#5A4430').box((x, y, 0.4), (0.8, 0.5, 0.8))
            for k in range(4):
                P(rnd.choice(['#D8B888', '#B8322A', '#E0A83A'])).box((x, y, 0.84 + 0.05 * k), (0.9, 0.6, 0.04))
            P('#FFB060', rough=0.3, emit=0.9, flat=False).sphere((x, y + 0.4, 2.3), (0.12, 0.12, 0.16), seg=6)
            ctx.light((x, y + 0.4, 2.2), 5.0, (12.0, 7.5, 3.0))
            ctx.solid(x, y, 0.45, 0.3)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # a gate of the old city: a horseshoe arch in faded blue and green tile over ochre
        for sx in (-1, 1):
            x = sx * (Fes.LANE / 2 + 0.8)
            P('#C49A64').box((x, -7.0, 2.6), (1.6, 1.6, 5.2))
            P('#2E5A8A').box((x - sx * 0.02, -6.18, 2.6), (1.3, 0.04, 3.6))
            ctx.solid(x, -7.0, 0.8, 0.8)
            post_lamp(P, ctx, sx * (Fes.LANE / 2 - 0.4), -5.4, h=2.6, color='#FFB060', light=(11.0, 7.0, 2.8))
        P('#C49A64', flat=False).sloft([(V((0, -7.0 + dy, 4.2)), V((1, 0, 0)), V((0, 0, 1)), Fes.LANE / 2 + 0.8, 1.1) for dy in (-0.8, 0.8)],
                                       seg=18, a0=-0.3, a1=math.pi + 0.3, closed=False)
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a tanners' yard: vats round the edge, hides stretched on frames, a great stone vat of lime in the middle
        for k in range(9):
            a = TAU * k / 9 + 0.2
            x, y = math.cos(a) * 6.2, math.sin(a) * 6.2
            if y < -4.5 and abs(x) < 3.0:
                continue
            P('#D8D0C0', flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.8), (0.7, 0.8))], seg=12)
            P(rnd.choice(Fes.DYES), rough=0.4).box((x, y, 0.66), (1.2, 1.2, 0.04))
            ctx.solid(x, y, 0.8, 0.8)
        P('#D8D0C0', flat=False).sloft([(V((0, 1.5, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 1.4), (0.8, 1.4))], seg=16)
        P('#F0ECE0', rough=0.6).box((0, 1.5, 0.76), (2.2, 2.2, 0.04))
        ctx.solid(0, 1.5, 1.4, 1.4)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -1.0, h=2.6, color='#FFB060', light=(12.0, 7.5, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the dye pits seen from the terrace: a honeycomb of round vats in every colour (to the south)
        for i in range(5):
            for j in range(2):
                x, y = -3.2 + i * 1.6 + (0.8 if j else 0), -5.6 + j * 1.3
                P('#D8D0C0', flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.72), (0.5, 0.72))], seg=12)
                P(rnd.choice(Fes.DYES), rough=0.35).box((x, y, 0.46), (1.0, 1.0, 0.03))
        ctx.solid(0, -5.0, 4.4, 1.3)
        ctx.light((0, -3.4, 2.6), 8.0, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


# ================================================================ Chefchaouen, the blue city
class Chaouen:
    NAME, LANE = 'chaouen', 4.2
    BLUES = ['#4A7AB8', '#6A9AD0', '#3A6AA8', '#8AB0DC', '#5A8AC8']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#6A86A8').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#7A9AC0', rough=0.9).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            horiz = (x1 - x0) > (y1 - y0)
            # shallow steps across the lane, their edges painted white
            if horiz:
                for x in frange(x0 + 0.8, x1 - 0.8, 1.8):
                    P('#E8EEF4').box((x, (y0 + y1) / 2, 0.03), (0.08, y1 - y0, 0.03))
            else:
                for y in frange(y0 + 0.8, y1 - 0.8, 1.8):
                    P('#E8EEF4').box(((x0 + x1) / 2, y, 0.03), (x1 - x0, 0.08, 0.03))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.6, 3.2) if low else rnd.uniform(4.8, 6.6)
        blue = rnd.choice(Chaouen.BLUES)
        P(blue).box((cx, cy, h / 2), (w, d, h))
        P('#F0F2F4').box((cx, cy, h + 0.06), (w + 0.1, d + 0.1, 0.12))
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    # a door in a deeper blue under a white frame
                    P('#F0F2F4').box((px + n[0] * 0.03, py + n[1] * 0.03, 1.2), (1.1 if horiz else 0.06, 0.06 if horiz else 1.1, 2.5))
                    P('#1E4A8A').box((px + n[0] * 0.06, py + n[1] * 0.06, 1.1), (0.9 if horiz else 0.06, 0.06 if horiz else 0.9, 2.2))
                elif rnd.random() < 0.5:
                    # pots of geraniums on the wall, one above another
                    for k in range(2):
                        z = 1.2 + 0.7 * k
                        P('#C86A3A', flat=False).sphere((px + n[0] * 0.14, py + n[1] * 0.14, z), (0.12, 0.12, 0.13), seg=6)
                        P(rnd.choice(['#D8302A', '#E86A8A', '#F0A030']), flat=False).sphere((px + n[0] * 0.16, py + n[1] * 0.16, z + 0.16),
                                                                                           (0.13, 0.13, 0.1), seg=6)
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # a lamp on a white bracket, a cat's bowl, a basket of blue powder paint for the walls
            P('#F0F2F4').box((x, y, 1.2), (0.08, 0.08, 2.4))
            P('#FFC070', rough=0.3, emit=0.9, flat=False).sphere((x, y, 2.5), (0.13, 0.13, 0.18), seg=6)
            P('#8A6A44', flat=False).sphere((x + 0.35, y, 0.2), (0.22, 0.22, 0.2), seg=6)
            P('#2A5AB8', flat=False).sphere((x + 0.35, y, 0.34), (0.18, 0.18, 0.08), seg=6)
            ctx.light((x, y, 2.4), 5.0, (10.0, 8.0, 5.0))
            ctx.solid(x, y, 0.4, 0.25)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the lane in from the hills: two blue piers and a white arch, a lamp either side
        for sx in (-1, 1):
            x = sx * (Chaouen.LANE / 2 + 0.7)
            P('#4A7AB8').box((x, -7.0, 2.2), (1.4, 1.4, 4.4))
            ctx.solid(x, -7.0, 0.7, 0.7)
            post_lamp(P, ctx, sx * (Chaouen.LANE / 2 - 0.4), -5.4, h=2.5, color='#FFC070', light=(10.0, 8.0, 5.0))
        P('#F0F2F4', flat=False).sloft([(V((0, -7.0 + dy, 3.6)), V((1, 0, 0)), V((0, 0, 1)), Chaouen.LANE / 2 + 0.7, 0.9)
                                        for dy in (-0.7, 0.7)], seg=18, a0=0, a1=math.pi, closed=False)
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the square under the kasbah: blue walls round it, a stair up to the far side, the old spring in the middle
        for k in range(8):
            a = TAU * k / 8 + 0.4
            x, y = math.cos(a) * 6.3, math.sin(a) * 6.3
            if y < -4.5 and abs(x) < 3.0:
                continue
            P(rnd.choice(Chaouen.BLUES)).box((x, y, 1.2), (1.2, 1.2, 2.4))
            ctx.solid(x, y, 0.6, 0.6)
        P('#F0F2F4', flat=False).sloft([(V((0, 1.8, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 1.1), (0.6, 1.1))], seg=16)
        P('#6AAAD8', rough=0.05, metal=0.3, emit=0.15).box((0, 1.8, 0.62), (1.6, 1.6, 0.02))
        ctx.solid(0, 1.8, 1.1, 1.1)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -1.0, h=2.6, color='#FFC070', light=(11.0, 8.5, 5.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the spring of Ras el-Ma under its arch, the water running out over the stones (to the south)
        P('#4A7AB8').box((0, -5.2, 1.6), (4.2, 1.2, 3.2))
        P('#F0F2F4', flat=False).sloft([(V((0, -5.2 + dy, 3.0)), V((1, 0, 0)), V((0, 0, 1)), 1.2, 0.9) for dy in (-0.6, 0.6)], seg=14,
                                       a0=0, a1=math.pi, closed=False)
        P('#6AAAD8', rough=0.05, metal=0.3, emit=0.2).box((0, -4.0, 0.03), (2.6, 1.6, 0.02))
        ctx.solid(0, -5.2, 2.1, 0.6)
        ctx.light((0, -3.4, 2.2), 7.0, (8.0, 10.0, 14.0))
        ctx.points['chest'] = [3.0, -2.0]
        P.flush()


# ================================================================ Jemaa el-Fnaa at night
class Jemaa:
    NAME, LANE = 'jemaa', 6.8

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A6A4A').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#A07A54', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # food stalls in rows under canvas, their benches out front; tall blocks are the red walls behind
        if not low:
            h = rnd.uniform(4.2, 5.6)
            P('#B85A3A').box((cx, cy, h / 2), (w, d, h))
        else:
            P('#6A4A30').box((cx, cy, 0.5), (w, d, 1.0))
            for x in frange(x0 + 0.8, x1 - 0.8, 1.6):   # the canvas roofs on their poles
                P('#E8DCC0', flat=False).box((x, cy, 2.5), (1.5, d + 0.2, 0.06))
                for y in (y0 + 0.1, y1 - 0.1):
                    P('#3A2A1A', flat=False).capsule(V((x, y, 0)), V((x, y, 2.5)), 0.04, seg=5)
            for s in sides:
                pts, n = face_points(x0, y0, x1, y1, s)
                for i, (px, py) in enumerate(pts):
                    if i % 2 == 0:   # the grill's glow and its smoke; a lantern hung over it
                        P('#FF7A2A', rough=0.5, emit=1.3).box((px - n[0] * 0.3, py - n[1] * 0.3, 1.02), (0.6, 0.6, 0.04))
                        P('#FFB060', rough=0.3, emit=1.0, flat=False).sphere((px, py, 2.2), (0.12, 0.12, 0.16), seg=6)
                        ctx.light((px + n[0] * 0.8, py + n[1] * 0.8, 1.8), 5.0, (14.0, 7.0, 2.5))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.7:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # an orange-juice cart: green paint, a pyramid of oranges, a lamp
            P('#2E7A4A').box((x, y, 0.5), (1.2, 0.7, 1.0))
            for k in range(6):
                P('#F08A20', flat=False).sphere((x - 0.4 + (k % 3) * 0.4, y - 0.12 + (k // 3) * 0.24, 1.12), 0.1, seg=6)
            P('#FFC070', rough=0.3, emit=1.0, flat=False).sphere((x, y, 1.9), (0.1, 0.1, 0.14), seg=6)
            ctx.light((x, y, 1.9), 4.5, (12.0, 9.0, 4.0))
            ctx.solid(x, y, 0.65, 0.4)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # into the square from the souqs: a string of lamps between two poles
        for sx in (-1, 1):
            x = sx * (Jemaa.LANE / 2 + 0.3)
            P('#3A2A1A', flat=False).capsule(V((x, -6.4, 0)), V((x, -6.4, 3.4)), 0.06, seg=6)
            ctx.solid(x, -6.4, 0.2, 0.2)
        for k in range(9):
            t = k / 8
            x = -(Jemaa.LANE / 2 + 0.3) + (Jemaa.LANE + 0.6) * t
            P(['#FFB060', '#FF7A5A', '#FFD070'][k % 3], rough=0.3, emit=1.2, flat=False).sphere((x, -6.4, 3.3 - 0.6 * math.sin(math.pi * t)), 0.1, seg=6)
        ctx.light((0, -6.0, 2.6), 7.0, (12.0, 8.0, 4.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the open heart of the square: a ring of stalls' smoke and light round a wide space of beaten earth
        for k in range(10):
            a = TAU * k / 10 + 0.3
            x, y = math.cos(a) * 6.4, math.sin(a) * 6.4
            if y < -4.5 and abs(x) < 3.0:
                continue
            P('#E8DCC0').box((x, y, 2.4), (1.6, 1.6, 0.06))
            P('#3A2A1A', flat=False).capsule(V((x, y, 0)), V((x, y, 2.4)), 0.05, seg=5)
            P('#FF7A2A', rough=0.5, emit=1.2).box((x, y, 0.6), (0.9, 0.9, 0.04))
            P('#6A4A30').box((x, y, 0.3), (1.0, 1.0, 0.56))
            ctx.solid(x, y, 0.55, 0.55)
            ctx.light((x * 0.9, y * 0.9, 1.6), 5.5, (14.0, 7.0, 2.5))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the storytellers' ring: low stools round a lamp on the ground, empty tonight (to the south)
        for k in range(7):
            a = math.pi + math.pi * k / 6
            x, y = math.cos(a) * 1.8, -4.6 + math.sin(a) * 0.9
            P('#6A4A30').box((x, y, 0.2), (0.4, 0.4, 0.4))
        P('#FFC070', rough=0.3, emit=1.2, flat=False).sphere((0, -4.6, 0.25), (0.15, 0.15, 0.2), seg=6)
        ctx.solid(0, -4.8, 2.0, 0.8)
        ctx.light((0, -4.6, 1.0), 6.0, (14.0, 9.0, 4.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


# ================================================================ Tangier on the Strait
class Tangier:
    NAME, LANE = 'tangier', 5.0

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A8A84').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#A8A49A', rough=0.9).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.5, x1 - 0.5, 1.0):   # cobbles
                for y in frange(y0 + 0.5, y1 - 0.5, 1.0):
                    if rnd.random() < 0.3:
                        P(rnd.choice(['#B8B4AA', '#98948A'])).box((x, y, 0.025), (0.9, 0.9, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.6, 3.2) if low else rnd.uniform(5.0, 7.0)
        P('#F2F0EA').box((cx, cy, h / 2), (w, d, h))
        P('#DCD8CE').box((cx, cy, h + 0.08), (w + 0.1, d + 0.1, 0.16))
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    P('#2E6AA8').box((px + n[0] * 0.05, py + n[1] * 0.05, 1.1), (0.9 if horiz else 0.06, 0.06 if horiz else 0.9, 2.2))
                elif rnd.random() < 0.35:
                    # a window with a blue shutter and a wrought grille
                    P('#2E6AA8').box((px + n[0] * 0.05, py + n[1] * 0.05, 3.0), (0.7 if horiz else 0.07, 0.07 if horiz else 0.7, 0.9))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # fishing nets over a barrel, and a lamp
            P('#6A4A30', flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), 0.3, 0.3) for z in (0.0, 0.8)], seg=10)
            P('#6A7A5A', rough=0.95).box((x, y, 0.84), (0.9, 0.9, 0.06))
            P('#FFB060', rough=0.3, emit=0.9, flat=False).sphere((x + 0.5, y, 2.3), (0.12, 0.12, 0.16), seg=6)
            P('#1A1A1A', metal=0.6).box((x + 0.5, y, 1.15), (0.06, 0.06, 2.3))
            ctx.light((x + 0.5, y, 2.2), 5.0, (12.0, 7.5, 3.0))
            ctx.solid(x, y, 0.35, 0.35)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the kasbah's gate: a thick white arch, a lamp either side
        for sx in (-1, 1):
            x = sx * (Tangier.LANE / 2 + 0.9)
            P('#F2F0EA').box((x, -7.0, 2.6), (1.8, 1.8, 5.2))
            ctx.solid(x, -7.0, 0.9, 0.9)
            post_lamp(P, ctx, sx * (Tangier.LANE / 2 - 0.4), -5.4, h=2.6, color='#FFB060', light=(11.0, 7.0, 2.8))
        P('#F2F0EA', flat=False).sloft([(V((0, -7.0 + dy, 4.2)), V((1, 0, 0)), V((0, 0, 1)), Tangier.LANE / 2 + 0.9, 1.0)
                                        for dy in (-0.9, 0.9)], seg=18, a0=0, a1=math.pi, closed=False)
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the rampart over the Strait: a low parapet round the far side, old cannons in their embrasures, the sea beyond
        P('#1A3A5A', rough=0.1, metal=0.2, emit=0.12).box((0, 9.0, -0.3), (22.0, 6.0, 0.05))
        for k in range(9):
            a = math.pi * 0.08 + math.pi * 0.84 * k / 8
            x, y = math.cos(a) * 6.6, math.sin(a) * 6.6
            P('#D8D4CA').box((x, y, 0.5), (1.4, 1.0, 1.0))
            ctx.solid(x, y, 0.7, 0.5)
            if k % 2 == 1:
                P('#2A2A2A', metal=0.8, flat=False).capsule(V((x * 0.86, y * 0.86, 0.55)), V((x * 1.02, y * 1.02, 0.75)), 0.14, 0.1, seg=8)
        for sx in (-1, 1):
            P('#D8D4CA').box((sx * 6.4, -2.0, 0.5), (1.0, 5.0, 1.0))
            ctx.solid(sx * 6.4, -2.0, 0.5, 2.5)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -1.0, h=2.6, color='#FFB060', light=(12.0, 7.5, 3.0))
        ctx.light((0, 6.0, 3.0), 12.0, (5.0, 8.0, 12.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # an old café's terrace over the water: tables and chairs, glasses of mint tea left on them (to the south)
        for i in range(3):
            x = -2.4 + i * 2.4
            P('#E8E2D6', flat=False).sloft([(V((x, -5.0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.0, 0.08), (0.72, 0.08),
                                                                                                           (0.74, 0.45))], seg=12)
            P('#8AC8A0', rough=0.1, emit=0.2, flat=False).sphere((x + 0.15, -5.0, 0.82), (0.05, 0.05, 0.08), seg=6)
            for sx in (-1, 1):
                P('#6A4A30').box((x + sx * 0.6, -5.0, 0.23), (0.4, 0.4, 0.46))
        ctx.solid(0, -5.0, 3.4, 0.6)
        ctx.light((0, -3.6, 2.4), 7.5, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


REGIONS = [Fes, Chaouen, Jemaa, Tangier]
