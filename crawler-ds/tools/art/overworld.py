"""Overworld sprites: the party as seen from above and behind.

Sixteen by twenty, three facings each, four crawlers. Twenty rather than
twenty-four because the leader and the follower stand one tile apart and tiles
are sixteen pixels: any taller and the two of them overlap into a single totem
instead of reading as two people, one behind the other. At this size a
sprite is silhouette and two or three signature colours and nothing else, so
they share a body template and differ by palette and a handful of marks -- a
crown, a wide hat, ears. That is how the genre's overworld sprites have always
worked, and it keeps four characters consistent with each other in a way
twelve separately drawn grids would not.

Facings are down, up and side; the side one is mirrored for the other
direction at draw time rather than stored twice.
"""

import png
from palettes import INK, RAMPS as R
from forge_tools import rgb555

W, H = 16, 20
DOWN, UP, SIDE = 0, 1, 2


class Ow:
    def __init__(self):
        self.c = png.Canvas(W, H)
        self.pal = [(0, 0, 0)]          # 0 is transparent

    def ink(self, rgb):
        rgb = tuple(int(v) for v in rgb)
        if rgb not in self.pal:
            self.pal.append(rgb)
        return self.pal.index(rgb)

    def px(self, x, y, i):
        if 0 <= x < W and 0 <= y < H:
            self.c.px[y * W + x] = i

    def box(self, x0, y0, w, h, i):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.px(x, y, i)

    def row(self, y, x0, x1, i):
        for x in range(x0, x1 + 1):
            self.px(x, y, i)

    def emit(self):
        assert len(self.pal) <= 16, "an overworld sprite is a 4bpp sprite too"
        pal = self.pal + [(0, 0, 0)] * (16 - len(self.pal))
        return self.c, [rgb555(c) for c in pal[:16]]


#  A stride, six frames of it, and a breath, four.
#
#  The spec these were drawn to asks for six walk frames, which at sixteen
#  pixels sounds like more than the canvas can hold: the legs are three pixels
#  tall. It holds them, because a frame is not only where the legs are. Each
#  pose below moves a leg sideways, changes how far down it reaches, drops the
#  whole body by a pixel on the beats where the weight lands, and swings the
#  arms against the legs. Six of those are six readable poses even at this
#  size, and the difference between a walk that reads as walking and one that
#  reads as a sprite being slid across the floor is entirely in the bob.
#
#  The ground line does not move. A bob lowers the shoulders, the head and the
#  arms toward feet that stay where they are, and the legs take up the
#  difference -- which is what a step actually does and the thing that was
#  wrong with the first attempt, where the whole figure moved and the legs
#  came away from the floor.
#
#  (leg_l_dx, leg_r_dx, leg_l_lift, leg_r_lift, bob, arm_l_dy, arm_r_dy)
WALK = [
    (-1,  1, 0, 0, 0,  1, -1),   # 0  contact: left behind, right ahead
    ( 0,  1, 0, 0, 1,  1, -1),   # 1  down: the right foot takes the weight
    ( 0,  0, 1, 0, 0,  0,  0),   # 2  passing: the left foot comes through
    ( 1, -1, 0, 0, 0, -1,  1),   # 3  contact, mirrored
    ( 1,  0, 0, 0, 1, -1,  1),   # 4  down
    ( 0,  0, 0, 1, 0,  0,  0),   # 5  passing, mirrored
]

#  Standing still is not standing frozen. One pixel of rise and fall through
#  the shoulders, held longest at the top, which is what breathing looks like
#  when you only have one pixel to say it with.
IDLE = [
    (0, 0, 0, 0, 0, 0, 0),
    (0, 0, 0, 0, 0, 0, 0),
    (0, 0, 0, 0, 1, 0, 0),
    (0, 0, 0, 0, 0, 0, 0),
]

GROUND = 19          # the row every foot rests its outline on


def _body(o, spec, facing, pose=None):
    """Head, torso, arms and legs. The proportions are deliberately large in
    the head: at sixteen pixels a realistic one is four pixels wide and reads
    as nothing at all."""
    out = o.ink(spec['outline'])
    skin = o.ink(spec['skin'])
    skin_d = o.ink(spec['skin_dark'])
    body = o.ink(spec['body'])
    body_d = o.ink(spec['body_dark'])
    legs = o.ink(spec['legs'])
    hair = o.ink(spec['hair'])

    ldx, rdx, llift, rlift, bob, ladj, radj = pose or IDLE[0]

    #  Legs, from under the torso down to the floor. A one pixel gap between
    #  them is what separates standing from a solid block; the gap is also
    #  where a stride is visible at all. A lifted foot leaves the ground line
    #  and the leg above it shortens to match.
    for dx, lift, x0 in ((ldx, llift, 4), (rdx, rlift, 9)):
        top = 16 + bob
        foot = GROUND - lift
        if foot > top:
            o.box(x0 + dx, top, 3, foot - top, legs)
        o.row(foot, x0 + dx, x0 + dx + 2, out)

    #  Torso, wider at the shoulders. Everything from the waist up rides the
    #  bob together, so the figure compresses rather than floating.
    o.box(4, 11 + bob, 8, 5, body)
    o.row(10 + bob, 5, 10, body)
    o.box(4, 14 + bob, 8, 2, body_d)
    for y in range(10 + bob, 16 + bob):
        o.px(3, y, out)
        o.px(12, y, out)

    #  Arms, hanging clear of the body so the silhouette stays readable, and
    #  swinging against the legs the way a real one does.
    for adj, ax in ((ladj, 2), (radj, 12)):
        top = 11 + bob + adj
        o.box(ax, top, 2, 4, body)
        o.px(ax if ax < 8 else ax + 1, top + 4, skin_d)
        for y in range(top, top + 5):
            o.px(ax - 1 if ax < 8 else ax + 2, y, out)

    #  Head. It rides the bob with the torso, or the body walks out from
    #  under it.
    b = bob
    o.box(3, 3 + b, 10, 7, skin)
    o.row(2 + b, 4, 11, skin)
    o.row(10 + b, 4, 11, skin_d)
    for y in range(2 + b, 10 + b):
        o.px(2, y, out)
        o.px(13, y, out)
    o.row(1 + b, 4, 11, out)

    #  Hair, and the face if we are looking at it.
    if facing == UP:
        o.box(3, 2 + b, 10, 6, hair)
        o.row(1 + b, 4, 11, out)
    else:
        o.box(3, 2 + b, 10, 3, hair)
        o.px(3, 5 + b, hair)
        o.px(12, 5 + b, hair)
        eye = o.ink(spec['eye'])
        #  One pixel an eye, set wide. Two-pixel eyes are what most sprites
        #  this size use, but they need a wider head than this one has: on a
        #  ten pixel skull they join up under the hair and read as a bandit's
        #  mask rather than a face.
        if facing == DOWN:
            o.px(5, 7 + b, eye)
            o.px(10, 7 + b, eye)
            o.px(7, 9 + b, skin_d)
            o.px(8, 9 + b, skin_d)
        else:
            o.px(10, 7 + b, eye)
            #  A side view is a head turned: shift the mass and lose an arm.
            o.box(2, 11 + bob + ladj, 2, 4, 0)
            o.box(1, 11 + bob, 1, 5, 0)
    return out


def _crown(o, spec, b=0):
    c = o.ink(spec['accent'])
    d = o.ink(spec['accent_dark'])
    #  Narrow, so it sits between a pair of ears rather than flattening them.
    for x, h in ((5, 2), (7, 3), (9, 2)):
        for y in range(h):
            o.px(x, 1 - y + b, c)
            o.px(x + 1, 1 - y + b, d if y else c)
    o.row(2 + b, 5, 10, d)


def _hat(o, spec, b=0):
    c = o.ink(spec['accent'])
    d = o.ink(spec['accent_dark'])
    o.row(2 + b, 0, 15, c)
    o.row(3 + b, 1, 14, d)
    o.box(4, 0 + b, 8, 2, c)


def _cat(o, spec, facing, b=0):
    """Ears and a muzzle. Donut is the most recognisable thing in the game and
    without these she is a person in a crown."""
    out = o.ink(spec['outline'])
    fur = o.ink(spec['skin'])
    fur_d = o.ink(spec['skin_dark'])
    pink = o.ink(spec['inner_ear'])
    #  Out at the corners of the head, so the crown can sit between them.
    for base in (1, 11):
        for i in range(3):
            o.row(2 - i + b, base + i, base + 3 - i, fur)
            o.px(base + i - 1, 2 - i + b, out)
            o.px(base + 4 - i, 2 - i + b, out)
        o.px(base + 2, 1 + b, pink)
    if facing != UP:
        #  A muzzle in the same cream as the head is invisible, so it gets its
        #  own lighter tone and a line under it.
        muzzle = o.ink(spec['muzzle'])
        o.box(5, 7 + b, 6, 3, muzzle)
        o.row(10 + b, 6, 9, fur_d)
        o.px(4, 8 + b, out)
        o.px(11, 8 + b, out)
        nose = o.ink(spec['nose'])
        o.px(7, 7 + b, nose)
        o.px(8, 7 + b, nose)
        o.px(7, 8 + b, fur_d)
        o.px(8, 8 + b, fur_d)


def _tall_ears(o, spec, b=0):
    """A Bopca's ears are most of a Bopca: long, pointed, and up."""
    c = o.ink(spec['skin'])
    d = o.ink(spec['skin_dark'])
    out = o.ink(spec['outline'])
    for base, lean in ((3, -1), (11, 1)):
        for i in range(5):
            x = base + lean * (i // 2)
            y = 4 - i + b
            o.px(x, y, c if i < 3 else d)
            o.px(x + lean, y, d)
            o.px(x - lean, y, out)


CAST = {
    'carl': dict(
        outline=INK['brown'], skin=R['skin'][3], skin_dark=R['skin'][1],
        body=R['skin'][3], body_dark=R['skin'][1], legs=R['cloth_blue'][2],
        hair=R['hair_brown'][0], eye=INK['ink'], accent=R['cloth_blue'][2],
        accent_dark=R['cloth_blue'][0], marks=()),
    'donut': dict(
        outline=INK['brown'], skin=R['sand'][5], skin_dark=R['tan'][2],
        body=R['copper'][3], body_dark=R['copper'][1], legs=R['tan'][2],
        hair=R['copper'][3], eye=R['grass'][4], accent=R['gold'][3],
        accent_dark=R['gold'][1], inner_ear=R['cloth_red'][4],
        nose=R['cloth_red'][3], muzzle=R['cloth_cream'][4], marks=('crown', 'cat')),
    'mordecai': dict(
        outline=INK['green'], skin=R['stone_ancient'][3], skin_dark=R['stone_ancient'][1],
        body=R['cloth_purple'][2], body_dark=R['cloth_purple'][0], legs=INK['dark'],
        hair=R['hair_silver'][2], eye=R['gold'][4], accent=R['cloth_purple'][1],
        accent_dark=R['cloth_purple'][0], marks=('hat',)),
    'bopca': dict(
        outline=INK['brown'], skin=R['sand'][4], skin_dark=R['tan'][1],
        body=R['blood'][3], body_dark=R['blood'][1], legs=R['wood_dark'][2],
        hair=R['sand'][4], eye=INK['ink'], accent=R['sand'][4],
        accent_dark=R['tan'][1], marks=('tall_ears',)),
}


#  Six walk frames then four idle frames, in that order, for each facing.
#  The renderer indexes them arithmetically off the first, so the order here
#  is the contract -- see FRAMES in src/render/view2d.c.
WALK_FRAMES_N = len(WALK)
IDLE_FRAMES_N = len(IDLE)
FRAMES_N = WALK_FRAMES_N + IDLE_FRAMES_N


def make(name, facing, frame=0):
    spec = CAST[name]
    pose = WALK[frame] if frame < WALK_FRAMES_N else IDLE[frame - WALK_FRAMES_N]
    b = pose[4]
    o = Ow()
    _body(o, spec, facing, pose)
    for mark in spec['marks']:
        if mark == 'crown':
            _crown(o, spec, b)
        elif mark == 'hat':
            _hat(o, spec, b)
        elif mark == 'cat':
            _cat(o, spec, facing, b)
        elif mark == 'tall_ears':
            _tall_ears(o, spec, b)
    return o.emit()


ROSTER = [('ow_%s_%s_%d' % (n, f, k), (lambda n=n, i=i, k=k: make(n, i, k)))
          for n in ('carl', 'donut', 'mordecai', 'bopca')
          for i, f in ((DOWN, 'down'), (UP, 'up'), (SIDE, 'side'))
          for k in range(FRAMES_N)]
