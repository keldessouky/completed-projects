"""Mordecai, drawn rather than computed.

Short, broad, four eyes, a beard he has clearly stopped maintaining, and the
coat of somebody who has been doing this job for a very long time. Same method
as the others: fifteen colours, hand-placed, no shading pass afterwards.
"""

W, H = 56, 72

PALETTE = [
    (24, 22, 30),        # X  outline
    (74, 100, 68),       # 1  skin, deepest
    (108, 140, 96),      # 2  skin, shadow
    (146, 180, 132),     # 3  skin, base
    (182, 214, 168),     # 4  skin, light
    (44, 26, 62),        # 5  coat, dark
    (86, 52, 118),       # 6  coat, base
    (128, 88, 168),      # 7  coat, light
    (96, 100, 116),      # 8  beard, shadow
    (176, 182, 198),     # 9  beard, light
    (26, 24, 40),        # 0  cap
    (232, 186, 68),      # b  sash and buckle
    (240, 240, 232),     # w  eyes
    (150, 108, 40),      # r  the sash where it folds
    (58, 60, 74),        # d  cap highlight, boot leather
]
KEY = "X1234567890bwrd"


def _row(*segs):
    row = ['.'] * W
    for x, s in segs:
        for i, ch in enumerate(s):
            row[x + i] = ch
    return ''.join(row)


def grid():
    r = _row
    g = [
        r(), r(), r(), r(), r(), r(), r(), r(),
        # ---- the cap, which has a brim on it like a decision --------------
        r((22, "XXXXXXXXXXXX")),
        r((21, "X0000dddd0000X")),
        r((20, "X000dddddddd000X")),
        r((20, "X00dddddddddd000X")),
        r((12, "XX00000000000000000000XX")),
        r((10, "X00000000000000000000000000X")),
        r((10, "X0000000000000000000000000 X".replace(" ", "0"))),
        r((11, "XXXXXXXXXXXXXXXXXXXXXXXXXX")),
        # ---- four eyes, two rows, all of them tired ------------------------
        r((17, "X2222222222222222X")),
        r((17, "X2333333333333332X"), (20, "XwwX"), (32, "XwwX")),
        r((17, "X2333333333333332X"), (20, "XwXX"), (32, "XXwX")),
        r((17, "X2333333333333332X"), (21, "22"), (33, "22")),
        r((17, "X2333333333333332X"), (22, "XwwX"), (30, "XwwX")),
        r((17, "X2333333333333332X"), (22, "XwXX"), (30, "XXwX")),
        r((17, "X2333333333333332X"), (26, "22")),
        r((18, "X23333333333332X"), (25, "2112")),
        # ---- the beard ----------------------------------------------------
        r((17, "X8999999999999998X")),
        r((16, "X899999999999999998X")),
        r((16, "X899999999999999998X")),
        r((17, "X8999999999999998X")),
        r((18, "X89999999999998X")),
        r((19, "X899999999998X")),
        r((20, "X8999999998X")),
        r((21, "XX899998XX")),
        # ---- coat ---------------------------------------------------------
        r((13, "X56666666666666666666666665X")),
        r((11, "X5666666666666666666666666665X")),
        r((11, "X5666777666666666666666677766X")),
        r((11, "X566777766666666666666667777 6X".replace(" ", "6"))),
        r((11, "X56677776666666666666666777766X")),
        r((11, "X5667777666666666666666677766X")),
        r((11, "X566777666666666666666666777 6X".replace(" ", "6"))),
        r((11, "X5666666666666666666666666666X")),
        # ---- the guild sash -----------------------------------------------
        r((11, "X5bbbbbbbbbbbbbbbbbbbbbbbbbbb5X")),
        r((11, "X5bbbbbbbbbbXbbbbXbbbbbbbbbbb5X")),
        r((11, "X5rrrrrrrrrrXbbbbXrrrrrrrrrrr5X")),
        r((11, "X5666666666666666666666666666 X".replace(" ", "5"))),
        r((11, "X566666666666666666666666666 6X".replace(" ", "6"))),
        r((12, "X5666666666666666666666666 6X".replace(" ", "6"))),
        r((12, "X56666666666666666666666666X")),
        r((13, "X566666666666666666666666X")),
        # ---- and the boots ------------------------------------------------
        r((14, "X5666666666666666666665X")),
        r((14, "X5666666X"), (30, "X66666 5X".replace(" ", "6"))),
        r((14, "X566666X"), (31, "X66665X")),
        r((14, "X56666X"), (32, "X6665X")),
        r((14, "Xdddddd X".replace(" ", "d")), (32, "Xdddd X".replace(" ", "d"))),
        r((13, "XddddddddX"), (31, "Xddddddd X".replace(" ", "d"))),
        r((13, "XXXXXXXXXX"), (31, "XXXXXXXXX")),
    ]
    while len(g) < H:
        g.append(r())
    return g
