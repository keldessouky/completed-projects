"""Carl, Princess Donut, and the two people who talk to them.

Proportions first: Carl is five heads tall and built like someone who used to
carry things for a living; Donut is drawn as a real Persian — a round skull, a
short muzzle, an enormous ruff — because the joke only lands if the cat is
convincingly a cat before it is a princess.
"""
from forge_tools import Sprite

PARTY_W, PARTY_H = 56, 72


def carl():
    """Boxer shorts, bare feet, and a jaw set against eighteen floors."""
    s = Sprite(PARTY_W, PARTY_H)
    skin = s.register_family(s.ramp((206, 154, 112), 6, dark=0.72))
    hair = s.register_family(s.ramp((74, 52, 38), 5))
    short = s.register_family(s.ramp((58, 92, 178), 6))
    band = s.register_family(s.ramp((228, 232, 240), 5))
    dark = s.ink((28, 26, 32))
    white = s.ink((246, 244, 238))
    blood = s.ink((146, 44, 44))
    grime = s.ink((92, 74, 62))

    # legs and feet, back to front
    s.limb(23, 54, 21, 66, 11, 8, skin)
    s.limb(33, 54, 35, 66, 11, 8, skin)
    s.separate(28, 56, 28, 66, skin, 2)              # the gap between them
    s.form(20, 68, 6, 4, skin, squash=0.5)
    s.form(36, 68, 6, 4, skin, squash=0.5)
    for x in (16, 18, 20, 22):                       # toes catch the light
        s.put(x, 66, skin[4])
    for x in (34, 36, 38, 40):
        s.put(x, 66, skin[4])

    # the shorts
    s.poly([(17, 43), (39, 43), (41, 55), (30, 57), (26, 57), (15, 55)], short[2])
    s.rect(17, 43, 39, 46, short[1])
    s.rect(17, 43, 39, 44, band[2])
    s.line(28, 46, 28, 57, short[0])
    for x in range(19, 39, 6):                       # the little anchors
        s.rect(x, 49, x + 1, 52, short[4])
        s.put(x - 1, 50, short[4])
        s.put(x + 2, 50, short[4])
    s.shade_band(15, 52, 41, 57, -1)

    # neck and torso
    s.limb(28, 20, 28, 26, 9, 11, skin)
    s.shade_band(23, 21, 33, 24, -1)                 # the head shadows the neck
    s.form(28, 33, 12, 14, skin, wrap=0.9)
    s.limb(20, 24, 21, 30, 7, 9, skin)               # trapezius
    s.limb(36, 24, 35, 30, 7, 9, skin)
    s.shade_band(22, 36, 34, 41, -1)                 # ribs into the waist
    s.line(28, 30, 28, 42, skin[1])                  # sternum
    s.put(23, 31, skin[1]); s.put(33, 31, skin[1])   # pectoral shadow
    s.line(21, 28, 27, 27, skin[4])                  # collarbones
    s.line(29, 27, 35, 28, skin[4])

    # arms, hanging and closed, set forward of the chest
    s.form(19, 27, 5, 5, skin)                       # deltoids
    s.form(37, 27, 5, 5, skin)
    s.limb(19, 27, 14, 40, 9, 7, skin)
    s.limb(37, 27, 42, 40, 9, 7, skin)
    s.separate(22, 28, 18, 40, skin, 2)              # inner arm edges
    s.separate(34, 28, 38, 40, skin, 2)
    s.limb(14, 40, 16, 50, 7, 6, skin)
    s.limb(42, 40, 40, 50, 7, 6, skin)
    s.form(16, 52, 3, 4, skin)                       # fists, closed
    s.form(40, 52, 3, 4, skin)
    s.put(15, 51, skin[1]); s.put(17, 53, skin[1])
    s.put(39, 51, skin[1]); s.put(41, 53, skin[1])

    # head
    s.form(28, 14, 9, 10, skin, wrap=0.85)
    s.poly([(20, 16), (36, 16), (34, 22), (22, 22)], skin[2])   # jaw
    s.shade_band(22, 20, 34, 23, -1)                            # under the chin
    s.form(28, 7, 10, 6, hair)                                  # slept-in hair
    s.poly([(19, 9), (24, 3), (33, 3), (37, 8), (36, 10), (20, 11)], hair[2])
    for x, y in ((20, 10), (24, 9), (29, 8), (34, 9)):          # a broken fringe
        s.poly([(x, y), (x + 3, y - 1), (x + 2, y + 3)], hair[1])
    s.put(19, 6, hair[4]); s.put(24, 2, hair[4]); s.put(31, 2, hair[3])
    s.line(37, 8, 39, 12, hair[1])

    # The face is placed pixel by pixel. Nothing procedural reads as a face.
    face = {
        'b': hair[1], 'B': hair[0], 'w': white, 'p': dark, 'c': s.ink((122, 152, 176)),
        'd': skin[1], 'D': skin[0], 'l': skin[4], 'm': s.ink((150, 88, 74)),
        'M': s.ink((104, 56, 50)), 't': grime,
    }
    s.stamp(18, 9, [
        "..BB...........BB....",
        "...bbbbb.....bbbbb...",
        "...dBBBBd...dBBBBd...",
        "....wwwww...wwwww....",
        "....wppww...wppww....",
        "....wppww...wppww....",
        ".....ddd.....ddd.....",
        ".....................",
        "..........dl.........",
        ".........ddl.........",
        ".........DDd.........",
        "........MMMMM........",
        ".........lll.........",
        ".....t.t...t.t.......",
        "......t.t.t.t.t......",
    ], face)
    s.put(22, 13, face['c'])                          # catchlights
    s.put(31, 13, face['c'])

    # the floor has been leaving marks
    s.put(38, 30, blood); s.put(39, 31, blood); s.put(39, 32, blood)
    s.put(17, 36, blood); s.put(18, 37, blood)
    s.put(33, 46, grime); s.put(22, 61, grime); s.put(37, 63, grime)
    return s.finish().emit()


def _cat_eye(s, cx, cy, key, flip=1):
    """One eye, placed pixel by pixel and mirrored for the other side.

    A vertical slit is a predator's eye — it is the single thing that made
    this face read as menacing rather than pettable. Donut gets a big round
    pupil filling most of the iris, a wide catchlight sitting on it, and a
    soft rim, which is what a cat's eye looks like in low light and what
    every friendly cat in every game has ever had.
    """
    grid = [
        "..kkkkk..",
        ".kdGGGdk.",
        "kdGGGGGdk",
        "kGGpppGGk",
        "kGGpppGGk",
        "kdGpppGLk",
        ".kgGGGgd.",
        "..kkkkk..",
    ]
    for j, row in enumerate(grid):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x = cx + (i - 4) * flip
            s.put(x, cy + j - 4, key[ch])
    for j, i in ((-1, -3), (1, 3), (0, -3), (0, 3)):             # fibres in the iris
        s.put(cx + i * flip, cy + j, key['f'])
    for dx, dy in ((-2, -2), (-1, -2), (-2, -1), (-1, -1)):      # the catchlight
        s.put(cx + dx * flip, cy + dy, key['w'])
    for dx, dy in ((0, -2), (-3, -2), (-2, 0)):                  # its soft edge
        s.put(cx + dx * flip, cy + dy, key['W'])
    s.put(cx + 2 * flip, cy + 2, key['b'])                       # the bounce
    s.put(cx + 1 * flip, cy + 2, key['b'])
    s.put(cx - 4 * flip, cy + 1, key['t'])                       # tear duct
    s.put(cx + 4 * flip, cy - 1, key['k'])
    for i in range(-3, 4):                                       # wet lower lid
        s.put(cx + i * flip, cy + 4, key['l'])


def donut():
    """Princess Donut.

    Hand-placed from `donut_grid`, on a fifteen-colour palette, with no
    shading pass of any kind applied afterwards. Everything else in this file
    is built from shaded primitives and then relit; that approach produces a
    small render rather than a sprite, and no amount of polishing on top of it
    fixes the underlying problem. See the note at the top of donut_grid.py.
    """
    import donut_grid as dg

    s = Sprite(dg.W, dg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(dg.KEY, dg.PALETTE)}
    for y, row in enumerate(dg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * dg.W + x] = idx[ch]
    return s.emit()


def mordecai():
    """The guide: short, broad, four eyes, a thousand seasons of this behind him."""
    s = Sprite(PARTY_W, PARTY_H)
    skin = s.register_family(s.ramp((142, 176, 130), 6))
    coat = s.register_family(s.ramp((104, 62, 142), 6))
    beard = s.register_family(s.ramp((168, 172, 186), 5, dark=0.66))
    cap = s.register_family(s.ramp((48, 44, 66), 5))
    sash = s.register_family(s.ramp((240, 190, 70), 5))
    dark = s.ink((26, 30, 26))
    white = s.ink((248, 246, 236))

    s.limb(22, 58, 21, 68, 10, 9, coat)              # boots
    s.limb(34, 58, 35, 68, 10, 9, coat)
    s.form(20, 69, 6, 3, cap, squash=0.5)
    s.form(36, 69, 6, 3, cap, squash=0.5)

    s.form(28, 46, 16, 17, coat, wrap=0.8)           # barrel of a body
    s.poly([(14, 34), (42, 34), (44, 62), (12, 62)], coat[2])
    s.line(28, 34, 28, 62, coat[0])                  # coat seam
    s.rect(14, 47, 42, 51, sash[2])                  # guild sash
    s.rect(14, 47, 42, 48, sash[3])
    s.rect(14, 51, 42, 51, sash[0])
    s.rect(24, 47, 32, 51, sash[4])                  # buckle
    s.limb(15, 36, 11, 54, 10, 8, coat)              # sleeves
    s.limb(41, 36, 45, 54, 10, 8, coat)
    s.form(11, 56, 4, 4, skin)
    s.form(45, 56, 4, 4, skin)

    s.form(28, 22, 12, 12, skin, wrap=0.85)          # head
    s.shade_band(18, 29, 38, 33, -1)
    # Four eyes, two rows, all of them tired.
    face = {
        'w': white, 'p': dark, 'd': skin[1], 'D': skin[0], 'l': skin[4],
        'c': s.ink((236, 198, 96)),
    }
    s.stamp(17, 15, [
        "..ddddd.....ddddd..",
        ".dwwwwwd...dwwwwwd.",
        ".wwcppcw...wwcppcw.",
        ".dwwppww...dwwppww.",
        "..dwwwd.....dwwwd..",
        "...ddd.......ddd...",
        "...................",
        "...dwwwd...dwwwd...",
        "...wcpcw...wcpcw...",
        "....ddd.....ddd....",
    ], face)
    # Beard: a wedge with weight in it, three tufts at the bottom edge.
    s.poly([(20, 29), (36, 29), (34, 40), (30, 44), (26, 44), (22, 40)], beard[2])
    s.form(28, 33, 8, 7, beard, wrap=0.75)
    s.poly([(22, 27), (34, 27), (33, 31), (23, 31)], beard[3])   # moustache
    s.line(28, 27, 28, 31, beard[1])
    for x in (23, 28, 33):                                       # tufts
        s.poly([(x - 2, 39), (x + 2, 39), (x, 45)], beard[1] if x != 28 else beard[3])
    for x in range(21, 36, 3):
        s.line(x, 32, x - 1, 39, beard[1] if x % 2 else beard[4])
    s.shade_band(20, 29, 36, 31, -1)                             # under the lip

    # Cap: a dome with a brim under it, and the brim casting onto the brow.
    s.form(28, 9, 14, 7, cap, wrap=0.85)
    s.poly([(10, 12), (46, 12), (44, 9), (12, 9)], cap[2])       # brim
    s.rect(10, 12, 46, 13, cap[0])
    s.line(13, 8, 22, 4, cap[4])                                 # a crease
    s.put(38, 6, cap[3])
    s.shade_band(17, 14, 39, 16, -1)                             # brim shadow
    return s.finish().emit()


def bopca():
    """The protector behind the counter: knee-high, waistcoated, unimpressed."""
    s = Sprite(PARTY_W, PARTY_H)
    hide = s.register_family(s.ramp((176, 142, 104), 6))
    vest = s.register_family(s.ramp((168, 42, 62), 6))
    shirt = s.register_family(s.ramp((226, 220, 206), 5))
    dark = s.ink((20, 18, 24))
    gold = s.ink((242, 208, 120))
    inner = s.ink((212, 156, 148))

    s.limb(24, 58, 23, 67, 9, 8, hide)               # stubby legs
    s.limb(33, 58, 34, 67, 9, 8, hide)
    s.form(22, 68, 5, 3, hide, squash=0.5)
    s.form(35, 68, 5, 3, hide, squash=0.5)

    s.form(28, 48, 13, 14, hide, wrap=0.85)          # body
    s.poly([(24, 36), (32, 36), (33, 60), (23, 60)], shirt[3])   # shirt front
    s.poly([(16, 35), (24, 36), (23, 62), (17, 60)], vest[2])    # waistcoat
    s.poly([(40, 35), (32, 36), (33, 62), (39, 60)], vest[2])
    s.line(17, 36, 22, 60, vest[4])
    s.line(39, 36, 34, 60, vest[1])
    s.put(25, 42, gold); s.put(25, 49, gold); s.put(25, 56, gold)
    s.limb(17, 40, 13, 54, 8, 6, hide)               # arms
    s.limb(39, 40, 43, 54, 8, 6, hide)
    s.form(13, 56, 4, 4, hide)
    s.form(43, 56, 4, 4, hide)

    s.form(28, 22, 14, 13, hide, wrap=0.9)           # oversized head
    s.poly([(16, 20), (2, 4), (18, 16)], hide[2])    # ears
    s.poly([(40, 20), (54, 4), (38, 16)], hide[2])
    s.poly([(15, 19), (7, 8), (17, 16)], inner)
    s.poly([(41, 19), (49, 8), (39, 16)], inner)
    # Black eyes with one hard catchlight each, and a mouth that has heard it.
    face = {
        'p': dark, 'g': s.ink((62, 58, 76)), 'w': s.ink((250, 250, 250)),
        'd': hide[1], 'l': hide[4], 'm': s.ink((122, 92, 64)),
    }
    s.stamp(18, 16, [
        "..ddd.......ddd..",
        ".dpppd.....dpppd.",
        ".pwppp.....pwppp.",
        ".pppgp.....pppgp.",
        ".dpppd.....dpppd.",
        "..ddd.......ddd..",
        ".................",
        "........ll.......",
        ".......dld.......",
        "......mmmmm......",
    ], face)
    s.shade_band(18, 31, 38, 34, -1)
    return s.finish().emit()
