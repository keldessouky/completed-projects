"""Carl, drawn rather than computed.

Same method as donut_grid: fifteen colours and a transparent index, four steps
to a material, every pixel placed by hand, and no shading pass afterwards. He
stands next to Donut on nearly every screen, so as long as he was built out of
shaded primitives the two of them read as being from different games.

He is a big man in boxer shorts with no shoes on, which is the whole joke and
so has to be the whole silhouette: wide at the shoulders, bare feet planted,
nothing on him that anyone would have chosen to be wearing.
"""

W, H = 56, 72

PALETTE = [
    (26, 18, 22),        # X  outline
    (116, 72, 54),       # 1  skin, deepest
    (166, 110, 82),      # 2  skin, shadow
    (212, 154, 118),     # 3  skin, base
    (240, 194, 154),     # 4  skin, light
    (255, 226, 196),     # 5  skin, highlight
    (48, 32, 24),        # 6  hair, dark
    (88, 58, 38),        # 7  hair, base
    (132, 92, 58),       # 8  hair, light
    (26, 40, 82),        # 9  shorts, dark
    (52, 78, 142),       # 0  shorts, base
    (94, 128, 198),      # b  shorts, light
    (242, 240, 232),     # w  white of the eye
    (168, 58, 54),       # r  the scrapes he already has
    (92, 74, 78),        # d  stubble, and the dirt on him
]
KEY = "X1234567890bwrd"


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
    # Arms hang clear of the body with a gap between, or they read as slabs
    # bolted to the shoulders. Torso x18..37, arms outside that, legs under it.
    def body(torso, arm_l="X3332X", arm_r="X2333X"):
        return r((11, arm_l), (18, torso), (39, arm_r))

    g = [
        r(), r(), r(), r(), r(), r(),
        # ---- hair: slept on, then the world ended -------------------------
        r((23, "XXXXXXXXXX")),
        r((21, "XX76666667XX")),
        r((20, "X7766666666 7X".replace(" ", "7"))),
        r((19, "X8766666666677X")),
        r((19, "X87666666666677X")),
        r((19, "X876666666666667X")),
        r((19, "X87666666666666 7X".replace(" ", "6"))),
        r((19, "X8766666666666667X")),
        # ---- face. Eyes are a pupil with a catch beside it on the lit
        # ---- side; stubble is a shade along the jaw, not a black band.
        r((19, "X4444444444444444X")),
        r((19, "X4443333333333334X"), (22, "2222"), (30, "2222")),
        r((19, "X4433333333333334X"), (23, "wX"), (31, "wX")),
        r((19, "X4433333333333334X"), (23, "22"), (31, "22")),
        r((19, "X4433333333333334X"), (27, "2")),
        r((19, "X4433333333333334X"), (26, "212")),
        r((19, "X4433333333333334X"), (25, "dddddd")),
        r((19, "X44d3333333333d34X")),
        r((20, "X4d33333333333dX")),
        r((21, "Xdd333333333ddX")),
        # ---- neck, then the shoulders of a man who used to move things ----
        r((24, "X2222222X")),
        r((24, "X3333333X")),
        r((14, "X22" + "3" * 8 + "4" * 6 + "3" * 8 + "22X")),
        r((12, "X222" + "3" * 9 + "4" * 6 + "3" * 9 + "222X")),
        r((11, "X2222" + "3" * 9 + "4" * 6 + "3" * 9 + "2222X")),
        r((11, "X2333" + "3" * 9 + "4" * 6 + "3" * 9 + "3332X")),
        # ---- chest and belly ----------------------------------------------
        body("X33334444444443332X"[:18] + "X"),
        body("X3333444444444333 X".replace(" ", "2")),
        body("X333X4444444X333 2X".replace(" ", "3")),
        body("X3333444444443332 X".replace(" ", "2")),
        body("X3333344444433322 X".replace(" ", "2")),
        body("X33333344443332222 X"[:18] + "X"),
        body("X3333333333333222 X".replace(" ", "2")),
        body("X333333332X3332222 X"[:18] + "X", "X333 X".replace(" ", "2"), "X 333X".replace(" ", "2")),
        body("X3333333333333222 X".replace(" ", "2"), "X3332X", "X2333X"),
        body("X33333333333332 2 X".replace(" ", "2"), "X4332X", "X2334X"),
        body("X3333333333332222 X".replace(" ", "2"), "X4432X", "X2344X"),
        body("X332222222222222 2X".replace(" ", "2"), "XX44XX", "XX44XX"),
        # ---- shorts, and the legs of somebody who is going to run a lot ---
        r((17, "X0000000000000000000X")),
        r((17, "Xbbbbbbbbbbbbbbbbbbb0X"[:20] + "X")),
        r((17, "Xbb000000000000000990X"[:20] + "X")),
        r((17, "X0b00000000000000990 X"[:20] + "X")),
        r((17, "X0000000000000009990 X"[:20] + "X")),
        r((17, "X000000000XX00099990X")),
        r((17, "X00000000X"), (28, "X0009990X")),
        r((18, "X999000X"), (29, "X0099 0X".replace(" ", "9"))),
        r((19, "X9990X"), (30, "X0990X")),
        r((19, "X333X"), (30, "X332X")),
        r((19, "X3443X"), (29, "X3322X")),
        r((19, "X3443X"), (29, "X3322X")),
        r((19, "X3443X"), (29, "X3322X")),
        r((19, "X3443X"), (29, "X3322X")),
        r((19, "X3343X"), (29, "X3222X")),
        r((18, "X33343X"), (28, "X32222X")),
        r((18, "X34443X"), (28, "X33222X")),
        # ---- and no shoes, which is the entire joke -----------------------
        r((16, "XX44443XX"), (27, "XX33222XX")),
        r((15, "X4444443X"), (26, "X3332222X")),
        r((15, "X5444443X"), (26, "X3222221X")),
        r((15, "XXXXXXXX"), (26, "XXXXXXXX")),
    ]
    while len(g) < H:
        g.append(r())
    return g
