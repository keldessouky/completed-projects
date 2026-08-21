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


def donut():
    """Princess Donut: Persian, orange, tiara, entirely unbothered."""
    s = Sprite(PARTY_W, PARTY_H)
    fur = s.register_family(s.ramp((228, 148, 72), 6))
    ruff = s.register_family(s.ramp((248, 206, 152), 6))
    gold = s.register_family(s.ramp((250, 200, 64), 5))
    pink = s.ink((234, 146, 158))
    dark = s.ink((36, 26, 24))
    white = s.ink((250, 248, 242))
    eye = s.register_family(s.ramp((86, 196, 132), 4))

    # the tail comes round the front, because she knows where the camera is
    s.limb(43, 46, 51, 56, 10, 12, fur)
    s.limb(51, 56, 40, 68, 12, 10, fur)
    s.form(38, 69, 7, 3, ruff, squash=0.4)
    for i, (x, y) in enumerate(((46, 48), (50, 54), (48, 62), (43, 67))):
        s.poly([(x, y), (x + 4, y + 2), (x, y + 5)], fur[4] if i % 2 else fur[1])

    # body: a seated triangle, all coat
    s.poly([(28, 30), (43, 52), (45, 66), (11, 66), (13, 52)], fur[2])
    s.separate(43, 50, 45, 64, fur, 2)               # tail in front of the flank
    s.form(28, 52, 17, 15, fur, wrap=0.8)
    s.form(28, 54, 12, 12, ruff, wrap=0.7)           # chest ruff
    # Fur reads along the silhouette, not across the chest: short strokes that
    # break the outline, and a soft edge where the ruff meets the coat.
    for x, y, n in ((12, 48, 4), (13, 55, 5), (14, 62, 4),
                    (44, 50, 4), (44, 58, 5), (43, 64, 3)):
        for k in range(n):
            side = -1 if x < 28 else 1
            s.line(x, y + k * 2, x + side * 2, y + k * 2 + 1, fur[4] if k % 2 else fur[3])
    for x, y in ((18, 42), (24, 39), (32, 39), (38, 43)):
        s.line(x, y, x + 1, y + 5, fur[1])           # coat parting at the shoulders
    for i in range(9):                                # ruff feathering into fur
        s.put(16 + i * 2, 45 + (i % 3), ruff[4])
        s.put(15 + i * 2, 62 - (i % 3), fur[1])
    s.form(18, 64, 6, 4, ruff, squash=0.5)           # front paws
    s.form(34, 64, 6, 4, ruff, squash=0.5)
    for x in (14, 17, 20):
        s.put(x, 62, fur[1])
    for x in (30, 33, 36):
        s.put(x, 62, fur[1])

    # head: wide, flat-faced, enormous cheeks
    s.form(28, 24, 15, 13, fur, wrap=0.8)
    s.form(17, 28, 7, 7, ruff, wrap=0.6)             # cheek floof
    s.form(39, 28, 7, 7, ruff, wrap=0.6)
    s.poly([(13, 18), (16, 6), (24, 16)], fur[2])    # ears
    s.poly([(43, 18), (40, 6), (32, 16)], fur[2])
    s.poly([(15, 17), (17, 9), (21, 16)], pink)
    s.poly([(41, 17), (39, 9), (35, 16)], pink)
    s.put(16, 8, ruff[5]); s.put(40, 8, ruff[5])

    # Her face, placed by hand: the flat Persian muzzle and eyes with a lot of
    # opinion in them.
    face = {
        'f': fur[1], 'F': fur[0], 'r': ruff[4], 'R': ruff[5], 'w': white,
        'g': eye[2], 'G': eye[3], 'p': dark, 'n': pink, 'm': s.ink((178, 112, 96)),
    }
    s.stamp(15, 16, [
        "..fff...............fff..",
        ".ffFFf.............fFFff.",
        "..ffff.............ffff..",
        "...wggggw.......wggggw...",
        "..wgGGGGgw.....wgGGGGgw..",
        "..wgGppGgw.....wgGppGgw..",
        "..wgGppGgw.....wgGppGgw..",
        "...wgGGgw.......wgGGgw...",
        "....wggw.........wggw....",
        ".......RRRRRRRRRRR.......",
        "........RRnnnnnRR........",
        ".........nnnnnnn.........",
        "..........mm.mm..........",
        ".........m..r..m.........",
        "..........mm.mm..........",
    ], face)
    s.put(19, 20, white)                              # catchlights
    s.put(34, 20, white)
    for dy, x2 in ((-1, 6), (1, 6), (3, 8)):         # whiskers
        s.line(24, 31 + dy, x2, 28 + dy * 2, white)
        s.line(32, 31 + dy, 56 - x2, 28 + dy * 2, white)

    # the tiara, which she awarded herself
    s.poly([(16, 12), (20, 3), (24, 10), (28, 1), (32, 10), (36, 3), (40, 12)], gold[2])
    s.rect(16, 11, 40, 13, gold[3])
    s.rect(16, 13, 40, 14, gold[1])
    s.put(20, 5, s.ink((236, 96, 148)))
    s.put(28, 3, s.ink((124, 214, 250)))
    s.put(36, 5, s.ink((236, 96, 148)))
    s.put(22, 12, gold[4]); s.put(34, 12, gold[4])
    return s.finish().emit()


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
