"""The Goblin Trapper, drawn rather than computed.

The first thing most crawlers meet, so the first thing that has to not look
like a smudge. Fifteen colours, hand-placed, no shading pass afterwards —
the same method as the crawler roster, at the bestiary's 72x72.
"""

W, H = 72, 72

PALETTE = [
    (18, 24, 20),        # X  outline
    (44, 70, 42),        # 1  skin, deepest
    (74, 110, 64),       # 2  skin, shadow
    (114, 156, 92),      # 3  skin, base
    (154, 194, 124),     # 4  skin, light
    (44, 36, 30),        # 5  rags, dark
    (82, 68, 54),        # 6  rags, base
    (120, 102, 78),      # 7  rags, light
    (68, 46, 28),        # 8  the stick
    (114, 82, 50),       # 9  the stick, lit
    (152, 160, 174),     # 0  the wire he traps with
    (255, 244, 204),     # w  the lamp
    (250, 170, 62),      # r  the lamp, further out
    (16, 12, 18),        # d  eyes and mouth
    (230, 212, 118),     # y  teeth, and the shine in the eye
]
KEY = "X1234567890wrdy"


def _row(*segs):
    row = ['.'] * W
    for x, s in segs:
        for i, ch in enumerate(s):
            row[x + i] = ch
    return ''.join(row)


def run(*parts):
    return ''.join(ch * n for ch, n in parts)


def grid():
    r = _row
    g = [
        r(), r(), r(), r(), r(), r(), r(), r(),
        # ---- the lamp he carries, held out on a stick ---------------------
        r((52, "XXXX")),
        r((51, "XrwwrX")),
        r((51, "XwwwwX")),
        r((51, "XrwwrX")),
        r((52, "XrrX")),
        r((53, "X9X")),
        # ---- ears, joined to the head rather than floating beside it ------
        r((26, "XXXXXXXXXXXXXXXXXXXX"), (54, "X9X")),
        r((23, "X22222222222222222222222X"), (54, "X8X")),
        r((21, "X2222333333333333333322222X"), (53, "X9X")),
        r((18, "XX2222333333333333333333322222X"), (53, "X8X")),
        r((15, "XX22233333333333333333333333322222XX"), (52, "X9X")),
        r((13, "X22333433333333333333333333333322222X"), (52, "X8X")),
        r((12, "X2334433333333333333333333333333322 2X".replace(" ", "2")), (51, "X9X")),
        r((13, "X23443333333333333333333333333333222X"), (51, "X8X")),
        r((15, "XX443333333333333333333333333322222XX"), (50, "X9X")),
        # ---- the face. A flat green mass is what made the old one read as
        # ---- a smudge: it needs a lit side and a shadow side like anything.
        r((20, "X" + "4" * 4 + "3" * 14 + "2" * 7 + "X"), (52, "X8X")),
        r((20, "X" + "4" * 4 + "3" * 14 + "2" * 7 + "X"), (24, "XXXXX"), (39, "XXXXX"), (52, "X9X")),
        r((20, "X" + "4" * 4 + "3" * 14 + "2" * 7 + "X"), (24, "XydyX"), (39, "XydyX"), (51, "X8X")),
        r((20, "X" + "4" * 4 + "3" * 14 + "2" * 7 + "X"), (24, "XdddX"), (39, "XdddX"), (51, "X9X")),
        r((20, "X" + "4" * 4 + "3" * 14 + "2" * 7 + "X"), (25, "XXX"), (40, "XXX"), (50, "X8X")),
        r((20, "X" + "4" * 4 + "3" * 13 + "2" * 7 + "X"), (31, "X332X"), (50, "X9X")),
        r((21, "X" + "4" * 4 + "3" * 12 + "2" * 7 + "X"), (31, "X322X"), (49, "X8X")),
        r((21, "X" + "4" * 4 + "3" * 11 + "2" * 7 + "X"), (31, "X321X"), (49, "X9X")),
        r((22, "X" + "4" * 3 + "3" * 11 + "2" * 6 + "X"), (31, "X321X"), (48, "X8X")),
        r((22, "X" + "4" * 3 + "3" * 10 + "2" * 6 + "X"), (31, "X21X"), (48, "X9X")),
        r((23, "X" + "4" * 3 + "3" * 9 + "2" * 6 + "X"), (32, "X1X"), (47, "X8X")),
        r((23, "X" + "4" * 3 + "3" * 9 + "2" * 6 + "X"), (26, "XXXXXXXXX"), (47, "X9X")),
        r((24, "X" + "4" * 3 + "3" * 7 + "2" * 6 + "X"), (26, "XyXyXyXyX"), (46, "X8X")),
        r((24, "X" + "4" * 3 + "3" * 7 + "2" * 6 + "X"), (26, "XXXXXXXXX"), (46, "X9X")),
        r((25, "X" + "4" * 2 + "3" * 7 + "2" * 6 + "X"), (45, "X8X")),
        r((26, "X" + "4" * 2 + "3" * 6 + "2" * 5 + "X"), (45, "X9X")),
        r((27, "XX" + "3" * 5 + "2" * 4 + "XX"), (44, "X8X")),
        # ---- shoulders, rags, and the arm that holds the lamp -------------
        r((29, "XX22222XX"), (41, "X8X")),
        r((22, "X6666666666666666666X"), (41, "X9X")),
        r((20, "X666677766666666777666X"), (40, "X8X")),
        r((19, "X23X"), (22, "X66777766666667777 66X".replace(" ", "6")), (45, "X33X")),
        r((19, "X332X"), (22, "X6677776666666777766X"), (45, "X332X")),
        r((19, "X332X"), (22, "X667776666666677766X"), (46, "X33X")),
        r((19, "X33X"), (22, "X66666666666666666 6X".replace(" ", "6")), (46, "X33X")),
        r((20, "X33X"), (22, "X6666666666666666666X"), (46, "X32X")),
        r((20, "X33X"), (22, "X6600000000000006666X"), (46, "X32X")),
        r((20, "X32X"), (22, "X6600000000000006666X"), (46, "X22X")),
        r((20, "X22X"), (22, "X666666666666666666 X".replace(" ", "6")), (46, "X22X")),
        r((20, "X33X"), (23, "X55666666666666665X"), (46, "X33X")),
        r((21, "X33X"), (23, "X5556666666666665X"), (46, "X33X")),
        r((21, "X33X"), (24, "X555666666666655X"), (46, "X33X")),
        r((22, "X23X"), (24, "X5555666666655 X".replace(" ", "5")), (46, "X32X")),
        r((22, "XXX"), (25, "X55555555555 X".replace(" ", "5")), (46, "XXX")),
        # ---- and the legs he runs away on ---------------------------------
        r((26, "X2222X"), (38, "X2222X")),
        r((26, "X2332X"), (38, "X2332X")),
        r((26, "X2332X"), (38, "X2332X")),
        r((26, "X2332X"), (38, "X2332X")),
        r((25, "X23332X"), (37, "X23332X")),
        r((24, "X233332X"), (36, "X233332X")),
        r((24, "XXXXXXXX"), (36, "XXXXXXXX")),
    ]
    while len(g) < H:
        g.append(r())
    return g
