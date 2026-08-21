"""The cast, drawn in code.

Nothing here is traced from anything: each creature is a stack of ellipses,
polygons and lines with a light source in the upper left, outlined at the end so
it reads against a dark corridor. Run `python3 tools/forge.py --preview` to get
a contact sheet in docs/art/.
"""
import math

from palettes import ramp, rgb555
from png import Canvas


class Art:
    """A canvas plus the palette it is accumulating."""

    def __init__(self, w, h):
        self.c = Canvas(w, h)
        self.pal = [(0, 0, 0)]      # index 0 is transparent and never drawn

    def ink(self, rgb):
        rgb = tuple(int(v) for v in rgb)
        if rgb in self.pal:
            return self.pal.index(rgb)
        self.pal.append(rgb)
        return len(self.pal) - 1

    def ramp(self, base, steps=4, **kw):
        return [self.ink(c) for c in ramp(base, steps, **kw)]

    # -- shorthand ---------------------------------------------------------
    def blob(self, cx, cy, rx, ry, ramp_ids, light=(-0.35, -0.4)):
        """A shaded ellipse: the ramp is applied along the light direction."""
        n = len(ramp_ids)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                d = dx * dx + dy * dy
                if d > 1.0:
                    continue
                lit = (dx * light[0] + dy * light[1]) * 1.15 + (1.0 - d) * 0.45
                idx = int((lit + 0.62) * (n - 1))
                self.c.put(x, y, ramp_ids[max(0, min(n - 1, idx))])

    def bar(self, x0, y0, x1, y1, ramp_ids, horiz=True):
        """A rounded limb/plank shaded across its short axis."""
        n = len(ramp_ids)
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                if horiz:
                    t = (y - y0) / max(1, (y1 - y0))
                else:
                    t = (x - x0) / max(1, (x1 - x0))
                idx = int((1.0 - t) * (n - 1) * 0.9 + 0.2)
                self.c.put(x, y, ramp_ids[max(0, min(n - 1, idx))])

    def speckle(self, ids, density=7, seed=1):
        """Deterministic noise, for fur, rust and grime."""
        s = seed * 2654435761 & 0xFFFFFFFF
        for y in range(self.c.h):
            for x in range(self.c.w):
                s = (s * 1103515245 + 12345) & 0x7FFFFFFF
                if self.c.get(x, y) and (s >> 7) % density == 0:
                    cur = self.c.get(x, y)
                    if cur in ids:
                        pos = ids.index(cur)
                        self.c.put(x, y, ids[max(0, pos - 1)])

    def outline(self, rgb=(6, 6, 10)):
        self.c.outline(self.ink(rgb))

    def emit(self):
        return self.c, [rgb555(c) for c in self.pal]


# ---------------------------------------------------------------- the party --

def carl():
    """Barefoot, boxer shorts, and a supply of stubbornness that outlasts floors."""
    a = Art(64, 64)
    skin = a.ramp((206, 158, 120), 5)
    hair = a.ramp((62, 46, 38), 4)
    short = a.ramp((66, 96, 176), 5)
    dark = a.ink((26, 24, 30))
    blood = a.ink((158, 44, 46))

    a.blob(32, 30, 13, 14, skin)                        # chest
    a.c.rect(24, 30, 40, 33, skin[1])                   # ribs shading
    a.bar(16, 22, 23, 44, skin, horiz=False)            # arms
    a.bar(41, 22, 48, 44, skin, horiz=False)
    a.blob(20, 46, 5, 4, skin)                          # fists
    a.blob(44, 46, 5, 4, skin)
    a.blob(32, 14, 10, 11, skin)                        # head
    a.blob(32, 8, 11, 7, hair)                          # hair, slept-in
    a.c.put(23, 10, hair[1]); a.c.put(41, 11, hair[1])
    a.c.rect(26, 13, 29, 15, a.ink((250, 250, 250)))    # eyes
    a.c.rect(35, 13, 38, 15, a.ink((250, 250, 250)))
    a.c.rect(27, 14, 28, 15, dark)
    a.c.rect(36, 14, 37, 15, dark)
    a.c.rect(29, 19, 35, 20, a.ink((132, 84, 64)))      # jaw set
    a.c.rect(30, 22, 34, 23, skin[1])
    a.c.rect(21, 42, 43, 52, short[2])                  # the boxer shorts
    a.c.rect(21, 42, 43, 44, short[3])
    a.c.rect(31, 44, 33, 52, short[1])
    for x in range(23, 43, 5):
        a.c.rect(x, 46, x + 1, 50, short[3])            # the little anchors
        a.c.put(x + 1, 47, short[4])
    a.bar(23, 52, 30, 60, skin, horiz=False)            # legs
    a.bar(34, 52, 41, 60, skin, horiz=False)
    a.blob(26, 61, 6, 3, skin)                          # bare feet
    a.blob(38, 61, 6, 3, skin)
    a.c.put(27, 62, a.ink((172, 122, 96)))
    a.c.put(39, 62, a.ink((172, 122, 96)))
    for x, y in ((44, 26), (45, 27), (18, 34), (35, 38), (24, 55)):
        a.c.put(x, y, blood)                            # floor-one scrapes
    a.outline()
    return a.emit()


def donut():
    """Princess Donut: Persian, orange, tiara, entirely unbothered."""
    a = Art(48, 56)
    fur = a.ramp((226, 146, 74), 5)
    fluff = a.ramp((246, 196, 138), 4)
    gold = a.ramp((250, 208, 80), 4)
    pink = a.ink((236, 140, 160))
    eye = a.ink((70, 190, 130))

    a.blob(24, 36, 15, 13, fur)                       # body
    a.blob(24, 36, 12, 10, fluff)                     # chest fluff
    a.blob(24, 19, 11, 10, fur)                       # head
    a.c.poly([(14, 14), (17, 4), (21, 13)], fur[2])   # ears
    a.c.poly([(34, 14), (31, 4), (27, 13)], fur[2])
    a.c.poly([(16, 13), (17, 8), (19, 12)], pink)
    a.c.poly([(32, 13), (31, 8), (29, 12)], pink)
    a.blob(19, 19, 3, 3, [eye, eye, a.ink((160, 240, 190))])   # eyes
    a.blob(29, 19, 3, 3, [eye, eye, a.ink((160, 240, 190))])
    a.c.put(19, 19, a.ink((16, 20, 16)))
    a.c.put(29, 19, a.ink((16, 20, 16)))
    a.c.rect(23, 23, 25, 24, pink)                    # nose
    a.c.line(22, 25, 14, 23, a.ink((250, 226, 200)))  # whiskers
    a.c.line(26, 25, 34, 23, a.ink((250, 226, 200)))
    a.c.line(22, 26, 15, 28, a.ink((250, 226, 200)))
    a.c.line(26, 26, 33, 28, a.ink((250, 226, 200)))
    a.c.poly([(17, 9), (20, 3), (24, 8), (28, 3), (31, 9)], gold[2])   # tiara
    a.c.put(24, 5, gold[3])
    a.c.put(20, 4, a.ink((120, 210, 240)))
    a.c.put(28, 4, a.ink((236, 90, 140)))
    a.bar(36, 30, 44, 34, fur)                        # tail
    a.blob(42, 32, 5, 4, fluff)
    a.speckle(fur, 9, seed=3)
    a.outline()
    return a.emit()


def mordecai():
    """The guide: short, broad, four eyes, a thousand seasons of this behind him."""
    a = Art(64, 64)
    skin = a.ramp((146, 176, 132), 5)
    coat = a.ramp((104, 66, 138), 5)
    beard = a.ramp((208, 208, 220), 4)
    cap = a.ramp((52, 46, 68), 4)

    a.blob(32, 42, 19, 20, coat)                        # barrel of a body
    a.c.rect(30, 26, 34, 60, coat[1])                   # coat seam
    a.bar(10, 34, 18, 54, coat, horiz=False)            # sleeves
    a.bar(46, 34, 54, 54, coat, horiz=False)
    a.blob(14, 56, 5, 4, skin)                          # hands
    a.blob(50, 56, 5, 4, skin)
    a.blob(32, 20, 14, 13, skin)                        # head
    a.c.rect(20, 22, 44, 24, skin[1])
    for x in (24, 34):                                  # four eyes, two rows
        a.c.rect(x, 15, x + 5, 18, a.ink((248, 244, 230)))
        a.c.rect(x + 2, 16, x + 3, 18, a.ink((28, 30, 26)))
    for x in (26, 34):
        a.c.rect(x, 21, x + 4, 23, a.ink((236, 232, 216)))
        a.c.put(x + 2, 22, a.ink((28, 30, 26)))
    a.blob(32, 32, 12, 9, beard)                        # beard
    a.c.rect(28, 26, 36, 30, skin[1])
    a.c.poly([(14, 12), (50, 12), (52, 8), (12, 8)], cap[2])   # flat cap
    a.blob(32, 7, 17, 5, cap)
    a.c.rect(12, 11, 52, 12, cap[0])
    a.c.rect(22, 40, 42, 44, a.ink((240, 200, 80)))     # guild sash
    a.c.rect(22, 40, 42, 41, a.ink((180, 140, 40)))
    a.outline()
    return a.emit()


def bopca():
    """The protector behind the counter: knee-high, waistcoated, unimpressed."""
    a = Art(64, 64)
    hide = a.ramp((168, 136, 100), 5)
    vest = a.ramp((172, 44, 64), 5)
    dark = a.ink((22, 20, 26))

    a.blob(32, 42, 15, 17, hide)                        # body
    a.c.poly([(18, 30), (46, 30), (44, 60), (20, 60)], vest[2])   # waistcoat
    a.c.poly([(26, 30), (38, 30), (32, 48)], hide[3])   # open front
    a.c.rect(24, 34, 26, 36, a.ink((240, 210, 120)))    # buttons
    a.c.rect(24, 42, 26, 44, a.ink((240, 210, 120)))
    a.blob(32, 18, 13, 13, hide)                        # big head
    a.c.poly([(20, 16), (6, 4), (18, 22)], hide[2])     # ears
    a.c.poly([(44, 16), (58, 4), (46, 22)], hide[2])
    a.c.poly([(19, 15), (11, 7), (18, 19)], a.ink((214, 158, 150)))
    a.c.poly([(45, 15), (53, 7), (46, 19)], a.ink((214, 158, 150)))
    a.blob(26, 18, 5, 5, [dark, dark, a.ink((60, 56, 70))])       # black eyes
    a.blob(38, 18, 5, 5, [dark, dark, a.ink((60, 56, 70))])
    a.c.put(24, 16, a.ink((250, 250, 250)))
    a.c.put(36, 16, a.ink((250, 250, 250)))
    a.c.rect(30, 25, 34, 26, a.ink((118, 88, 62)))      # flat little mouth
    a.bar(12, 36, 18, 52, hide, horiz=False)            # arms
    a.bar(46, 36, 52, 52, hide, horiz=False)
    a.blob(15, 54, 4, 4, hide)
    a.blob(49, 54, 4, 4, hide)
    a.outline()
    return a.emit()


def dungeon_rat():
    a = Art(64, 64)
    fur = a.ramp((104, 96, 92), 5)
    pink = a.ramp((208, 150, 150), 3)
    a.blob(32, 40, 22, 14, fur)                       # body
    a.blob(16, 34, 11, 10, fur)                       # head
    a.c.poly([(10, 30), (4, 18), (16, 24)], fur[2])   # ears
    a.c.poly([(22, 28), (24, 16), (28, 26)], fur[2])
    a.c.line(52, 44, 62, 26, pink[1], 2)              # tail
    a.c.rect(8, 33, 10, 35, a.ink((230, 80, 80)))     # eye
    a.c.poly([(6, 38), (10, 36), (10, 42)], pink[2])  # snout
    a.c.rect(7, 39, 9, 41, a.ink((250, 250, 240)))    # teeth
    for x in range(20, 50, 9):
        a.bar(x, 50, x + 4, 58, fur, horiz=False)
    a.speckle(fur, 6, seed=11)
    a.outline()
    return a.emit()


def goblin():
    a = Art(64, 64)
    skin = a.ramp((110, 158, 82), 5)
    rag = a.ramp((92, 74, 58), 4)
    steel = a.ramp((160, 170, 186), 4)
    a.blob(32, 40, 13, 15, skin)
    a.c.rect(20, 34, 44, 48, rag[2])
    a.blob(32, 20, 12, 11, skin)
    a.c.poly([(20, 18), (6, 10), (22, 26)], skin[2])  # ears
    a.c.poly([(44, 18), (58, 10), (42, 26)], skin[2])
    a.c.rect(25, 18, 28, 20, a.ink((250, 210, 60)))
    a.c.rect(36, 18, 39, 20, a.ink((250, 210, 60)))
    a.c.rect(27, 26, 37, 27, a.ink((40, 30, 26)))
    for x in range(28, 37, 3):
        a.c.put(x, 28, a.ink((240, 236, 210)))
    a.bar(16, 30, 21, 46, skin, horiz=False)
    a.bar(43, 30, 48, 46, skin, horiz=False)
    a.c.line(48, 44, 56, 18, steel[2], 2)             # rusty spike
    a.c.line(49, 44, 57, 18, steel[1], 1)
    a.bar(24, 52, 29, 62, skin, horiz=False)
    a.bar(35, 52, 40, 62, skin, horiz=False)
    a.outline()
    return a.emit()


def kobold():
    a = Art(64, 64)
    scale = a.ramp((186, 112, 58), 5)
    belly = a.ramp((228, 186, 128), 4)
    horn = a.ramp((232, 216, 186), 4)

    a.blob(32, 42, 15, 17, scale)                       # body
    a.blob(32, 46, 9, 11, belly)                        # belly
    a.blob(32, 20, 13, 12, scale)                       # head
    a.c.poly([(24, 26), (40, 26), (36, 38), (28, 38)], scale[1])  # snout
    a.c.poly([(26, 34), (38, 34), (37, 38), (27, 38)], belly[2])
    a.c.rect(29, 36, 30, 38, a.ink((250, 250, 240)))    # teeth
    a.c.rect(34, 36, 35, 38, a.ink((250, 250, 240)))
    a.c.poly([(22, 12), (16, 0), (28, 10)], horn[2])    # horns
    a.c.poly([(42, 12), (48, 0), (36, 10)], horn[2])
    a.c.rect(25, 18, 28, 21, a.ink((250, 240, 220)))    # eyes
    a.c.rect(36, 18, 39, 21, a.ink((250, 240, 220)))
    a.c.rect(26, 19, 27, 21, a.ink((214, 60, 30)))
    a.c.rect(37, 19, 38, 21, a.ink((214, 60, 30)))
    a.bar(14, 34, 20, 50, scale, horiz=False)           # arms
    a.bar(44, 34, 50, 50, scale, horiz=False)
    a.bar(24, 56, 30, 63, scale, horiz=False)           # legs
    a.bar(34, 56, 40, 63, scale, horiz=False)
    a.c.line(48, 30, 52, 56, a.ink((104, 78, 52)), 3)   # a lit fuse on a stick
    a.blob(50, 26, 5, 5, a.ramp((214, 84, 48), 3))
    a.c.put(52, 22, a.ink((252, 226, 120)))
    a.c.line(46, 42, 56, 40, scale[3], 1)               # tail
    a.outline()
    return a.emit()


def sludge():
    a = Art(64, 64)
    goo = a.ramp((92, 176, 128), 5)
    a.blob(32, 44, 24, 18, goo)
    a.blob(26, 30, 14, 12, goo)
    for x, r in ((14, 4), (26, 6), (40, 5), (52, 3)):
        a.blob(x, 60 - r, r, r, goo)
    a.c.rect(20, 28, 24, 32, a.ink((16, 40, 30)))
    a.c.rect(32, 26, 36, 30, a.ink((16, 40, 30)))
    a.c.put(21, 29, a.ink((230, 255, 240)))
    a.c.put(33, 27, a.ink((230, 255, 240)))
    for i, (x, y) in enumerate(((44, 22), (48, 30), (18, 18))):   # drips
        a.blob(x, y, 2 + i % 2, 3 + i % 2, goo)
    a.speckle(goo, 5, seed=7)
    a.outline()
    return a.emit()


def screaming_sofa():
    """Floor one keeps sending furniture. Nobody has explained why."""
    a = Art(64, 64)
    cloth = a.ramp((150, 74, 62), 5)
    wood = a.ramp((96, 66, 44), 3)
    a.c.rect(6, 30, 58, 52, cloth[2])
    a.c.rect(6, 22, 58, 32, cloth[3])
    a.c.rect(4, 30, 14, 50, cloth[1])
    a.c.rect(50, 30, 60, 50, cloth[1])
    a.c.rect(10, 52, 16, 58, wood[1])
    a.c.rect(48, 52, 54, 58, wood[1])
    mouth = a.ink((30, 12, 16))
    a.c.poly([(22, 36), (42, 36), (38, 50), (26, 50)], mouth)   # the mouth
    for x in range(24, 41, 4):
        a.c.poly([(x, 36), (x + 3, 36), (x + 1, 41)], a.ink((240, 238, 226)))
        a.c.poly([(x, 50), (x + 3, 50), (x + 1, 45)], a.ink((240, 238, 226)))
    a.c.rect(16, 26, 22, 30, a.ink((250, 250, 250)))
    a.c.rect(42, 26, 48, 30, a.ink((250, 250, 250)))
    a.c.rect(18, 27, 20, 29, a.ink((20, 20, 24)))
    a.c.rect(44, 27, 46, 29, a.ink((20, 20, 24)))
    a.outline()
    return a.emit()


def bramble_hound():
    a = Art(64, 64)
    bark = a.ramp((88, 70, 48), 5)
    leaf = a.ramp((86, 140, 70), 4)
    a.blob(34, 40, 20, 12, bark)
    a.blob(14, 32, 11, 9, bark)
    a.c.poly([(8, 26), (4, 14), (14, 24)], bark[3])
    a.c.poly([(20, 24), (24, 14), (26, 26)], bark[3])
    a.c.rect(7, 31, 10, 33, a.ink((250, 160, 40)))
    for x in range(20, 52, 6):
        a.c.line(x, 30, x - 3, 18, leaf[2], 1)
        a.c.line(x, 30, x + 3, 20, leaf[1], 1)
    for x in range(20, 50, 10):
        a.bar(x, 48, x + 4, 60, bark, horiz=False)
    a.c.line(54, 38, 62, 26, bark[2], 2)
    a.speckle(bark, 5, seed=17)
    a.outline()
    return a.emit()


def bone_bailiff():
    a = Art(64, 64)
    bone = a.ramp((214, 208, 186), 4)
    robe = a.ramp((44, 48, 78), 4)
    a.c.poly([(18, 26), (46, 26), (52, 62), (12, 62)], robe[2])
    a.c.rect(20, 32, 44, 36, robe[3])
    a.blob(32, 16, 10, 11, bone)
    a.c.rect(26, 14, 29, 18, a.ink((16, 16, 20)))
    a.c.rect(35, 14, 38, 18, a.ink((16, 16, 20)))
    a.c.put(27, 15, a.ink((250, 120, 60)))
    a.c.put(36, 15, a.ink((250, 120, 60)))
    a.c.rect(29, 22, 35, 24, a.ink((60, 56, 48)))
    for x in range(29, 36, 2):
        a.c.put(x, 23, bone[3])
    a.bar(10, 28, 16, 44, bone, horiz=False)
    a.bar(48, 28, 54, 44, bone, horiz=False)
    a.c.line(52, 20, 52, 58, a.ink((120, 96, 60)), 2)     # gavel-staff
    a.c.rect(46, 16, 58, 22, a.ink((150, 120, 70)))
    a.outline()
    return a.emit()


def doom_beetle():
    a = Art(64, 64)
    shell = a.ramp((72, 60, 128), 5)
    chit = a.ramp((40, 34, 60), 3)
    a.blob(32, 40, 22, 16, shell)
    a.c.line(32, 26, 32, 54, chit[0], 2)
    a.blob(32, 22, 11, 9, chit)
    a.c.poly([(24, 16), (16, 6), (28, 14)], chit[1])
    a.c.poly([(40, 16), (48, 6), (36, 14)], chit[1])
    a.c.rect(26, 20, 29, 23, a.ink((250, 220, 80)))
    a.c.rect(35, 20, 38, 23, a.ink((250, 220, 80)))
    for y in (36, 44, 52):
        a.c.line(10, y, 22, y - 4, chit[1], 2)
        a.c.line(54, y, 42, y - 4, chit[1], 2)
    for i in range(6):
        a.c.put(24 + i * 3, 34 + (i % 2) * 3, a.ink((160, 150, 220)))
    a.outline()
    return a.emit()


def neon_mimic():
    """A loot box with opinions."""
    a = Art(64, 64)
    box = a.ramp((60, 140, 190), 5)
    trim = a.ramp((250, 208, 80), 4)
    a.c.rect(10, 28, 54, 58, box[2])
    a.c.rect(10, 28, 54, 32, box[3])
    a.c.rect(10, 44, 54, 46, trim[2])
    a.c.rect(30, 28, 34, 58, trim[1])
    a.c.poly([(10, 28), (54, 28), (48, 12), (16, 12)], box[1])   # lid, thrown back
    mouth = a.ink((24, 10, 20))
    a.c.poly([(14, 30), (50, 30), (44, 44), (20, 44)], mouth)
    for x in range(16, 47, 5):
        a.c.poly([(x, 30), (x + 4, 30), (x + 2, 37)], a.ink((240, 240, 230)))
    a.c.rect(18, 18, 24, 24, a.ink((250, 90, 170)))
    a.c.rect(40, 18, 46, 24, a.ink((250, 90, 170)))
    a.c.rect(20, 20, 22, 22, a.ink((20, 16, 24)))
    a.c.rect(42, 20, 44, 22, a.ink((20, 16, 24)))
    a.outline()
    return a.emit()


def club_bouncer():
    a = Art(64, 64)
    hide = a.ramp((142, 112, 84), 5)
    suit = a.ramp((34, 36, 52), 5)
    shirt = a.ramp((222, 218, 210), 4)

    a.blob(32, 44, 21, 19, suit)                        # slab of a torso
    a.c.poly([(24, 26), (40, 26), (36, 56), (28, 56)], shirt[2])  # shirt front
    a.c.poly([(24, 26), (32, 40), (40, 26)], suit[3])   # lapels
    a.c.rect(30, 28, 34, 34, a.ink((160, 30, 50)))      # tie
    a.c.poly([(30, 34), (34, 34), (32, 46)], a.ink((132, 22, 42)))
    a.blob(32, 16, 12, 11, hide)                        # head, no neck
    a.c.rect(20, 15, 44, 17, a.ink((18, 18, 22)))       # shades
    a.c.rect(22, 13, 30, 18, a.ink((22, 22, 28)))
    a.c.rect(34, 13, 42, 18, a.ink((22, 22, 28)))
    a.c.put(24, 14, a.ink((120, 200, 220)))
    a.c.put(36, 14, a.ink((120, 200, 220)))
    a.c.rect(28, 22, 36, 23, a.ink((96, 70, 52)))
    a.c.rect(24, 6, 40, 10, hide[1])                    # flat top
    a.bar(8, 32, 18, 56, suit, horiz=False)             # arms, folded low
    a.bar(46, 32, 56, 56, suit, horiz=False)
    a.blob(13, 58, 6, 4, hide)
    a.blob(51, 58, 6, 4, hide)
    a.c.rect(44, 36, 52, 44, a.ink((250, 60, 150)))     # club pass, glowing
    a.c.rect(46, 38, 50, 42, a.ink((255, 190, 230)))
    a.outline()
    return a.emit()


def vulture_fan():
    a = Art(64, 64)
    feather = a.ramp((70, 66, 74), 5)
    skinny = a.ramp((214, 156, 130), 3)
    a.blob(32, 40, 18, 16, feather)
    a.c.poly([(14, 30), (2, 46), (18, 50)], feather[1])   # wings
    a.c.poly([(50, 30), (62, 46), (46, 50)], feather[1])
    a.bar(28, 18, 36, 30, skinny, horiz=False)            # bare neck
    a.blob(32, 14, 9, 8, feather)
    a.c.poly([(32, 12), (48, 16), (32, 20)], a.ink((240, 190, 70)))
    a.c.rect(27, 11, 30, 14, a.ink((250, 240, 240)))
    a.c.put(28, 12, a.ink((20, 20, 24)))
    a.bar(26, 54, 30, 62, skinny, horiz=False)
    a.bar(34, 54, 38, 62, skinny, horiz=False)
    a.outline()
    return a.emit()


# ------------------------------------------------------------------ bosses ---

def boss_ratking():
    """Six rats, one crown, one shared and very bad idea."""
    a = Art(96, 96)
    fur = a.ramp((124, 108, 100), 5)
    gold = a.ramp((250, 208, 80), 4)
    pink = a.ramp((212, 154, 154), 3)
    gap = a.ink((26, 22, 24))

    a.blob(48, 66, 34, 24, fur)                                  # the tangled mass
    a.speckle(fur, 6, seed=23)
    heads = ((16, 44, 11), (34, 34, 12), (60, 32, 12), (80, 46, 11), (28, 60, 10), (68, 60, 10))
    for (x, y, r) in heads:
        for t in range(0, 360, 6):                               # a dark gap per head
            a.c.put(int(x + (r + 1) * math.cos(math.radians(t))),
                    int(y + (r + 1) * math.sin(math.radians(t))), gap)
    for (x, y, r) in heads:
        a.c.poly([(x - r + 1, y - r + 3), (x - r - 4, y - r - 7), (x - 2, y - r + 1)], fur[2])
        a.c.poly([(x + r - 1, y - r + 3), (x + r + 4, y - r - 7), (x + 2, y - r + 1)], fur[2])
        a.blob(x, y, r, r - 1, fur)
        a.c.rect(x - 5, y - 3, x - 3, y - 1, a.ink((244, 72, 72)))
        a.c.rect(x + 3, y - 3, x + 5, y - 1, a.ink((244, 72, 72)))
        a.c.poly([(x - 3, y + 3), (x + 3, y + 3), (x, y + 8)], pink[1])
        a.c.put(x - 1, y + 7, a.ink((250, 250, 240)))
        a.c.put(x + 1, y + 7, a.ink((250, 250, 240)))
    a.c.poly([(34, 20), (41, 4), (48, 16), (55, 4), (62, 20)], gold[2])   # the crown
    a.c.rect(34, 18, 62, 22, gold[3])
    a.c.put(41, 7, a.ink((236, 90, 140)))
    a.c.put(48, 12, a.ink((120, 210, 240)))
    a.c.put(55, 7, a.ink((236, 90, 140)))
    for i in range(5):                                           # tails
        a.c.line(82, 72 + i, 95, 52 - i * 4, pink[1], 2)
        a.c.line(14, 74 + i, 2, 56 - i * 4, pink[1], 2)
    a.outline()
    return a.emit()


def boss_foreman():
    """Floor two's management: hard hat, clipboard, absolutely no notes."""
    a = Art(96, 96)
    skin = a.ramp((146, 96, 74), 5)
    denim = a.ramp((54, 70, 118), 4)
    steel = a.ramp((176, 180, 192), 4)
    hat = a.ramp((248, 176, 40), 4)
    a.blob(48, 54, 26, 26, denim)
    a.blob(48, 24, 15, 14, skin)
    a.c.rect(30, 12, 66, 16, hat[2])
    a.blob(48, 12, 18, 9, hat)
    a.c.rect(38, 20, 44, 24, a.ink((30, 26, 30)))
    a.c.rect(52, 20, 58, 24, a.ink((30, 26, 30)))
    a.c.put(40, 21, a.ink((250, 210, 90)))
    a.c.put(54, 21, a.ink((250, 210, 90)))
    a.c.rect(40, 32, 56, 34, a.ink((40, 24, 24)))
    a.bar(14, 40, 26, 70, skin, horiz=False)
    a.bar(70, 40, 82, 70, skin, horiz=False)
    a.c.rect(6, 66, 30, 74, steel[2])                    # a very large wrench
    a.c.rect(4, 62, 14, 78, steel[3])
    a.c.rect(6, 68, 10, 72, a.ink((20, 20, 24)))
    a.c.rect(66, 60, 88, 84, a.ink((222, 214, 190)))     # clipboard
    for y in range(64, 82, 4):
        a.c.rect(70, y, 84, y + 1, a.ink((90, 90, 100)))
    a.c.rect(36, 74, 60, 92, denim[1])
    a.outline()
    return a.emit()


def boss_producer():
    """The show, wearing a person. Book one's last thing standing."""
    a = Art(96, 96)
    suit = a.ramp((30, 18, 42), 5)
    neon = a.ramp((250, 64, 160), 4)
    glass = a.ramp((90, 220, 236), 4)
    a.blob(48, 56, 30, 32, suit)
    a.c.poly([(18, 34), (48, 22), (78, 34), (72, 60), (24, 60)], suit[3])
    a.blob(48, 22, 16, 16, suit)
    a.blob(48, 22, 13, 12, glass)                        # a screen for a face
    for y in range(12, 32, 3):
        a.c.rect(36, y, 60, y, glass[1])
    a.c.rect(40, 18, 45, 22, a.ink((16, 16, 24)))
    a.c.rect(51, 18, 56, 22, a.ink((16, 16, 24)))
    a.c.rect(41, 26, 55, 28, a.ink((16, 16, 24)))
    for i in range(6):                                   # cables / limbs
        a.c.line(20 + i * 12, 60, 6 + i * 18, 92, neon[2], 2)
    a.c.rect(30, 44, 66, 48, neon[2])
    a.c.rect(44, 40, 52, 56, neon[1])
    a.c.rect(12, 8, 20, 16, neon[3])                     # camera lights
    a.c.rect(76, 8, 84, 16, neon[3])
    a.outline()
    return a.emit()


# ------------------------------------------------------------------- props ---

def prop_box(tier=0):
    """A System loot box, in the four rarities the show hands out."""
    tint = [(184, 118, 62), (198, 204, 216), (250, 208, 80), (206, 96, 236)][tier]
    seam = [(252, 214, 150), (245, 252, 255), (255, 246, 180), (252, 180, 255)][tier]
    a = Art(32, 32)
    body = a.ramp(tint, 5)
    dark = a.ink((30, 26, 34))
    glow = a.ink(seam)

    a.c.rect(5, 15, 27, 28, body[2])                  # the box
    a.c.rect(5, 15, 27, 17, body[1])
    a.c.rect(5, 26, 27, 28, body[0])
    a.c.rect(5, 8, 27, 15, body[3])                   # the lid
    a.c.rect(7, 6, 25, 9, body[4])
    a.c.rect(5, 14, 27, 15, dark)                     # the seam under the lid
    a.c.rect(6, 14, 26, 14, glow)
    a.c.rect(13, 12, 19, 22, body[1])                 # clasp strap
    a.c.rect(14, 16, 18, 20, glow)
    a.c.rect(15, 17, 17, 19, a.ink((255, 255, 255)))
    for x in (5, 27):                                 # corner fittings
        a.c.rect(x - 1, 15, x + 1, 18, body[4])
        a.c.rect(x - 1, 25, x + 1, 28, body[4])
    a.c.put(9, 3, glow); a.c.put(23, 4, glow); a.c.put(16, 1, glow)
    a.outline()
    return a.emit()


def prop_stairs():
    """Down. Always down, and the floor behind you is on a timer."""
    a = Art(32, 32)
    stone = a.ramp((110, 106, 116), 5)
    deep = a.ink((10, 10, 16))
    a.c.rect(1, 3, 30, 30, stone[0])                  # the shaft
    a.c.rect(4, 3, 27, 12, deep)                      # dark at the bottom
    for i in range(5):                                # steps, near ones widest
        y = 26 - i * 4
        inset = i * 2
        a.c.rect(2 + inset, y, 29 - inset, y + 2, stone[3])
        a.c.rect(2 + inset, y + 2, 29 - inset, y + 3, stone[1])
        a.c.rect(2 + inset, y, 29 - inset, y, stone[4])
    a.c.rect(0, 29, 31, 31, stone[2])
    a.outline()
    return a.emit()


def prop_shop():
    a = Art(32, 32)
    wood = a.ramp((124, 88, 54), 4)
    cloth = a.ramp((190, 60, 70), 4)
    a.c.rect(2, 14, 30, 30, wood[2])
    for x in range(2, 31, 6):
        a.c.rect(x, 6, x + 3, 14, cloth[2])
        a.c.rect(x + 3, 6, x + 5, 14, cloth[1])
    a.c.rect(0, 4, 32, 7, cloth[3])
    a.c.rect(6, 18, 26, 22, a.ink((240, 210, 120)))
    a.outline()
    return a.emit()


def prop_shrine():
    a = Art(32, 32)
    stone = a.ramp((110, 116, 140), 4)
    glow = a.ramp((110, 230, 240), 4)
    a.c.rect(6, 10, 26, 30, stone[2])
    a.c.rect(10, 4, 22, 12, stone[3])
    a.blob(16, 16, 6, 7, glow)
    a.c.rect(12, 26, 20, 28, stone[1])
    a.outline()
    return a.emit()


def prop_door():
    a = Art(32, 32)
    wood = a.ramp((96, 66, 44), 4)
    iron = a.ramp((120, 124, 136), 3)
    a.c.rect(4, 4, 28, 30, wood[2])
    for x in range(6, 28, 6):
        a.c.rect(x, 4, x + 3, 30, wood[1])
    a.c.rect(4, 10, 28, 12, iron[1])
    a.c.rect(4, 22, 28, 24, iron[1])
    a.c.rect(22, 16, 25, 19, iron[2])
    a.outline()
    return a.emit()


ROSTER = [
    ('carl', carl), ('donut', donut), ('mordecai', mordecai), ('bopca', bopca),
    ('rat', dungeon_rat), ('goblin', goblin), ('kobold', kobold), ('sludge', sludge),
    ('sofa', screaming_sofa), ('hound', bramble_hound), ('bailiff', bone_bailiff),
    ('beetle', doom_beetle), ('mimic', neon_mimic), ('bouncer', club_bouncer),
    ('vulture', vulture_fan),
    ('boss_ratking', boss_ratking), ('boss_foreman', boss_foreman), ('boss_producer', boss_producer),
    ('box_bronze', lambda: prop_box(0)), ('box_silver', lambda: prop_box(1)),
    ('box_gold', lambda: prop_box(2)), ('box_legendary', lambda: prop_box(3)),
    ('stairs', prop_stairs), ('shop', prop_shop), ('shrine', prop_shrine), ('door', prop_door),
]
