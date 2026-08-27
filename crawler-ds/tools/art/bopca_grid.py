"""The Bopca, drawn rather than computed.

Small, enormous ears, enormous eyes, and the robe of somebody who was issued a
uniform and has strong feelings about it. Fifteen colours, hand-placed, no
shading pass afterwards.
"""

W, H = 56, 72

#  The Bopca out of the shared palette. See tools/art/palettes.py.
from palettes import INK, RAMPS

PALETTE = [
    INK['brown'],                     # X  outline
    RAMPS['tan'][0],                  # 1  fur, deepest
    RAMPS['tan'][1],                  # 2  fur, shadow
    RAMPS['tan'][2],                  # 3  fur, base
    RAMPS['sand'][4],                 # 4  fur, light
    RAMPS['cloth_red'][1],            # 5  ear, deep
    RAMPS['cloth_red'][4],            # 6  ear, lit
    RAMPS['blood'][1],                # 7  robe, dark
    RAMPS['blood'][2],                # 8  robe, base
    RAMPS['blood'][4],                # 9  robe, light
    RAMPS['cloth_cream'][3],          # 0  robe, the white panel
    RAMPS['cloth_cream'][4],          # w  the shine on the eye
    INK['ink'],                       # d  the eye itself
    RAMPS['gold'][4],                 # b  the trim they were issued
    RAMPS['skin'][4],                 # r  nose
]

KEY = "X1234567890wdbr"


def _row(*segs):
    row = ['.'] * W
    for x, s in segs:
        for i, ch in enumerate(s):
            row[x + i] = ch
    return ''.join(row)


def grid():
    r = _row
    g = [
        r(), r(), r(), r(),
        # ---- ears, which are most of him -----------------------------------
        r((10, "XX"), (44, "XX")),
        r((9, "X2X"), (44, "X2X")),
        r((9, "X32X"), (43, "X23X")),
        r((9, "X362X"), (42, "X263X")),
        r((10, "X362X"), (42, "X263X")),
        r((10, "X3662X"), (41, "X2663X")),
        r((11, "X3662X"), (41, "X2663X")),
        r((11, "X36662X"), (40, "X26663X")),
        r((12, "X36662X"), (39, "X26663X")),
        r((12, "X356662X"), (38, "X2666 3X".replace(" ", "5"))),
        r((13, "X3556662X"), (36, "X2666553X")),
        r((14, "X35566 2X".replace(" ", "6")), (35, "X2665553X")),
        # ---- head ----------------------------------------------------------
        r((15, "X33332X"), (21, "XXXXXXXXXX"), (34, "X23333X")),
        r((15, "X333322222222222222223333X")),
        r((17, "X3333333333333333333X")),
        r((17, "X3333333333333333333X"), (20, "XdddX"), (31, "XdddX")),
        r((17, "X3333333333333333333X"), (19, "XdwddX"), (30, "XdwddX")),
        r((17, "X3333333333333333333X"), (19, "XddddX"), (30, "XddddX")),
        r((17, "X3333333333333333333X"), (20, "XdddX"), (31, "XdddX")),
        r((17, "X3333333333333333333X"), (26, "XrrX")),
        r((18, "X33333333333333333X"), (26, "XrrX")),
        r((18, "X33333322222233333X"), (25, "X3XX3X")),
        r((19, "X3332222222222333X")),
        r((20, "XX22222222222 XX".replace(" ", "2"))),
        # ---- the robe -------------------------------------------------------
        r((16, "X788888880000000888888887X")),
        r((15, "X78888888800000008888888887X")),
        r((15, "X79988888800000008888888997X")),
        r((14, "X7999888888000000088888899 97X".replace(" ", "9"))),
        r((14, "X7998888888000000088888888997X")),
        r((14, "X798888888800000008888888897X")),
        r((14, "X7bbbbbbbb000000000bbbbbbb7X")),
        r((14, "X7888888880000000088888888 7X".replace(" ", "8"))),
        r((14, "X788888888000000008888888887X")),
        r((15, "X7888888800000000888888887X")),
        r((15, "X78888888000000008888888 7X".replace(" ", "8"))),
        r((16, "X788888800000000888888887X")),
        r((16, "X7888888000000008888888 7X".replace(" ", "8"))),
        r((17, "X78888800000000888888 7X".replace(" ", "8"))),
        r((17, "X7888880000000088888 87X".replace(" ", "8"))),
        r((18, "X788880000000088888 7X".replace(" ", "8"))),
        r((18, "X78888000000008888 87X".replace(" ", "8"))),
        r((19, "X7777000000007777 7X".replace(" ", "7"))),
        # ---- and the feet ----------------------------------------------------
        r((20, "X2222X"), (32, "X2222X")),
        r((19, "X332222X"), (31, "X2222 33X".replace(" ", "2"))),
        r((19, "X3322 2X".replace(" ", "2")), (32, "X22233X")),
        r((19, "XXXXXXX"), (32, "XXXXXXX")),
    ]
    while len(g) < H:
        g.append(r())
    return g
