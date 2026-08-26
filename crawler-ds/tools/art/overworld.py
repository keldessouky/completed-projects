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


def _body(o, spec, facing):
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

    #  Legs and feet, planted. A one pixel gap between them is what separates
    #  standing from a solid block.
    o.box(4, 16, 3, 3, legs)
    o.box(9, 16, 3, 3, legs)
    o.row(19, 4, 6, out)
    o.row(19, 9, 11, out)

    #  Torso, wider at the shoulders.
    o.box(4, 11, 8, 5, body)
    o.row(10, 5, 10, body)
    o.box(4, 14, 8, 2, body_d)
    for y in range(10, 16):
        o.px(3, y, out)
        o.px(12, y, out)

    #  Arms, hanging clear of the body so the silhouette stays readable.
    o.box(2, 11, 2, 4, body)
    o.box(12, 11, 2, 4, body)
    o.px(2, 15, skin_d)
    o.px(13, 15, skin_d)
    for y in range(11, 16):
        o.px(1, y, out)
        o.px(14, y, out)

    #  Head.
    o.box(3, 3, 10, 7, skin)
    o.row(2, 4, 11, skin)
    o.row(10, 4, 11, skin_d)
    for y in range(2, 10):
        o.px(2, y, out)
        o.px(13, y, out)
    o.row(1, 4, 11, out)

    #  Hair, and the face if we are looking at it.
    if facing == UP:
        o.box(3, 2, 10, 6, hair)
        o.row(1, 4, 11, out)
    else:
        o.box(3, 2, 10, 3, hair)
        o.px(3, 5, hair)
        o.px(12, 5, hair)
        eye = o.ink(spec['eye'])
        if facing == DOWN:
            o.px(5, 7, eye)
            o.px(6, 7, eye)
            o.px(9, 7, eye)
            o.px(10, 7, eye)
            o.px(7, 9, skin_d)
            o.px(8, 9, skin_d)
        else:
            o.px(9, 7, eye)
            o.px(10, 7, eye)
            #  A side view is a head turned: shift the mass and lose an arm.
            o.box(2, 11, 2, 4, 0)
            o.box(1, 11, 1, 5, 0)
    return out


def _crown(o, spec):
    c = o.ink(spec['accent'])
    d = o.ink(spec['accent_dark'])
    #  Narrow, so it sits between a pair of ears rather than flattening them.
    for x, h in ((5, 2), (7, 3), (9, 2)):
        for y in range(h):
            o.px(x, 1 - y, c)
            o.px(x + 1, 1 - y, d if y else c)
    o.row(2, 5, 10, d)


def _hat(o, spec):
    c = o.ink(spec['accent'])
    d = o.ink(spec['accent_dark'])
    o.row(2, 0, 15, c)
    o.row(3, 1, 14, d)
    o.box(4, 0, 8, 2, c)


def _cat(o, spec, facing):
    """Ears and a muzzle. Donut is the most recognisable thing in the game and
    without these she is a person in a crown."""
    out = o.ink(spec['outline'])
    fur = o.ink(spec['skin'])
    fur_d = o.ink(spec['skin_dark'])
    pink = o.ink(spec['inner_ear'])
    #  Out at the corners of the head, so the crown can sit between them.
    for base in (1, 11):
        for i in range(3):
            o.row(2 - i, base + i, base + 3 - i, fur)
            o.px(base + i - 1, 2 - i, out)
            o.px(base + 4 - i, 2 - i, out)
        o.px(base + 2, 1, pink)
    if facing != UP:
        #  A muzzle in the same cream as the head is invisible, so it gets its
        #  own lighter tone and a line under it.
        muzzle = o.ink(spec['muzzle'])
        o.box(5, 7, 6, 3, muzzle)
        o.row(10, 6, 9, fur_d)
        o.px(4, 8, out)
        o.px(11, 8, out)
        nose = o.ink(spec['nose'])
        o.px(7, 7, nose)
        o.px(8, 7, nose)
        o.px(7, 8, fur_d)
        o.px(8, 8, fur_d)


def _tall_ears(o, spec):
    """A Bopca's ears are most of a Bopca: long, pointed, and up."""
    c = o.ink(spec['skin'])
    d = o.ink(spec['skin_dark'])
    out = o.ink(spec['outline'])
    for base, lean in ((3, -1), (11, 1)):
        for i in range(5):
            x = base + lean * (i // 2)
            y = 4 - i
            o.px(x, y, c if i < 3 else d)
            o.px(x + lean, y, d)
            o.px(x - lean, y, out)


CAST = {
    'carl': dict(
        outline=(18, 14, 18), skin=(214, 158, 118), skin_dark=(158, 108, 78),
        body=(214, 158, 118), body_dark=(158, 108, 78), legs=(58, 84, 148),
        hair=(52, 38, 30), eye=(24, 20, 24), accent=(58, 84, 148),
        accent_dark=(36, 54, 100), marks=()),
    'donut': dict(
        outline=(38, 24, 20), skin=(238, 206, 168), skin_dark=(196, 150, 110),
        body=(226, 176, 124), body_dark=(178, 128, 86), legs=(196, 150, 110),
        hair=(226, 176, 124), eye=(46, 176, 148), accent=(250, 208, 80),
        accent_dark=(190, 142, 34), inner_ear=(232, 148, 156),
        nose=(226, 120, 132), muzzle=(250, 232, 206), marks=('crown', 'cat')),
    'mordecai': dict(
        outline=(20, 14, 26), skin=(150, 132, 120), skin_dark=(102, 88, 82),
        body=(96, 62, 128), body_dark=(62, 38, 86), legs=(48, 36, 56),
        hair=(176, 172, 180), eye=(240, 220, 120), accent=(72, 46, 96),
        accent_dark=(44, 26, 60), marks=('hat',)),
    'bopca': dict(
        outline=(28, 16, 18), skin=(206, 178, 150), skin_dark=(158, 130, 106),
        body=(168, 44, 48), body_dark=(112, 26, 32), legs=(84, 66, 54),
        hair=(206, 178, 150), eye=(28, 20, 24), accent=(206, 178, 150),
        accent_dark=(158, 130, 106), marks=('tall_ears',)),
}


def make(name, facing):
    spec = CAST[name]
    o = Ow()
    _body(o, spec, facing)
    for mark in spec['marks']:
        if mark == 'crown':
            _crown(o, spec)
        elif mark == 'hat':
            _hat(o, spec)
        elif mark == 'cat':
            _cat(o, spec, facing)
        elif mark == 'tall_ears':
            _tall_ears(o, spec)
    return o.emit()


ROSTER = [('ow_%s_%s' % (n, f), (lambda n=n, i=i: make(n, i)))
          for n in ('carl', 'donut', 'mordecai', 'bopca')
          for i, f in ((DOWN, 'down'), (UP, 'up'), (SIDE, 'side'))]
