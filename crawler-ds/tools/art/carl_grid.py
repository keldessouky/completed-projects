"""Carl, drawn rather than computed.

Same method as donut_grid: a handful of materials taken from the shared
palette, every pixel placed by hand, and no shading pass afterwards. He stands
next to Donut on nearly every screen, so as long as he was built out of shaded
primitives the two of them read as being from different games.

He went outside after the cat in January, in what he had on: a shirt, the
jacket that was by the door, and white boxers with red hearts on them. He
never got as far as shoes. That is the whole joke and so it has to be the
whole silhouette -- dressed from the waist up and caught out from the waist
down, bare feet planted, nothing below the hem that anyone would have chosen
to be televised in.
"""

W, H = 56, 72

#  Every colour here is a step out of the shared palette rather than a triple
#  chosen for this sprite alone, so Carl and the wall behind him and the panel
#  under him are all made of the same material set. See tools/art/palettes.py.
from palettes import INK, RAMPS

PALETTE = [
    INK['brown'],                     # X  outline: his own hue, not black
    RAMPS['skin'][0],                 # 1  skin, deepest
    RAMPS['skin'][1],                 # 2  skin, shadow
    RAMPS['skin'][2],                 # 3  skin, base
    RAMPS['skin'][4],                 # 4  skin, light
    RAMPS['skin'][5],                 # 5  skin, highlight
    RAMPS['hair_brown'][0],           # 6  hair, dark
    RAMPS['hair_brown'][1],           # 7  hair, base
    RAMPS['hair_brown'][3],           # 8  hair, light
    RAMPS['cloth_cream'][1],          # 9  boxers, shadow
    RAMPS['cloth_cream'][3],          # 0  boxers, base
    RAMPS['cloth_cream'][4],          # b  boxers, lit
    RAMPS['cloth_cream'][4],          # w  white of the eye
    RAMPS['blood'][3],                # r  the scrapes he already has
    INK['warm'],                      # d  stubble, and the dirt on him
    RAMPS['cloth_green'][0],          # k  jacket, shadow side
    RAMPS['cloth_green'][1],          # j  jacket, base
    RAMPS['cloth_green'][2],          # J  jacket, lit side
    RAMPS['stone'][1],                # t  shirt, in the jacket's shadow
    RAMPS['stone'][3],                # s  shirt, base
    RAMPS['stone'][4],                # S  shirt, lit
    RAMPS['blood'][3],                # h  the hearts on the boxers
    RAMPS['cloth_green'][3],          # L  the trim down the jacket's opening
    RAMPS['hair_brown'][0],           # e  brows, and the stubble under them
]

KEY = "X1234567890bwrdkjJtsShLe"


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

    def coat(shirt):
        """One row of the open jacket: a lapel each side, shirt between.

        The key light is up and to the left, so the near lapel takes the lit
        step and the far one the shadow step, and the shirt darkens where the
        lapel hangs over it. Without that last part the shirt reads as a
        white rectangle painted on the coat rather than as cloth under it.
        """
        #  A lit trim down each side of the opening, which is the zip tape.
        #  Without it the coat and the shirt meet on a colour change alone and
        #  the jacket reads as a painted panel rather than a garment with an
        #  edge that was sewn.
        run = "S" + "s" * (shirt - 2) + "t" if shirt > 2 else "S" * shirt
        side = (18 - shirt) // 2
        return ("X" + "J" + "j" * (side - 2) + "L" + run + "L"
                + "j" * (side - 2) + "k" + "X")

    def boxers():
        """White, with red hearts on them.

        Two of them, five across and four down. Three pixels wide was the
        first try and it reads as a V: at that size the two lobes are single
        pixels with a gap between, which the eye takes for horns. Five is the
        smallest a heart can be and still be a heart -- two lobes with a
        shoulder each, a body, and a point.
        """
        wide = 19
        rows = ["b" * wide] + ["0" * wide] * 8
        heart = (".h.h.", "hhhhh", ".hhh.", "..h..")
        for hx, hy in ((0, 1), (7, 1), (14, 1), (3, 5), (10, 5)):
            for j, hrow in enumerate(heart):
                row = list(rows[hy + j])
                for i, ch in enumerate(hrow):
                    if ch != ".":
                        row[hx + i] = ch
                rows[hy + j] = "".join(row)
        #  The shaded side, laid on after the hearts so it darkens those too.
        #  Two columns, not four: cream's shadow step is a mid grey, and four
        #  of them down the edge stopped reading as the far side of a white
        #  garment and started reading as a hole in it.
        return [row if k == 0 else row[:17] + "99" for k, row in enumerate(rows)]

    g = [
        r(), r(), r(),
        # ---- hair: slept on, then the world ended. Tufts standing up rather
        # ---- than a fringe cut straight across -- a flat cap of hair reads
        # ---- as a helmet, and nobody has combed this since the ceiling fell.
        r((24, "X6X..X66X..X6X")),
        r((22, "X6666666666666X")),
        r((20, "X76666666666666667X")),
        r((19, "X8766666666666666 7X".replace(" ", "6"))),
        r((19, "X87666666666666667X")),
        r((19, "X87666666666666667X")),
        # ---- the face. Brows first: they carry the whole expression, and at
        # ---- this size they do more of it than the eyes under them.
        r((19, "X4444444444444444X")),
        r((19, "X4433333333333334X"), (22, "eee"), (30, "eee")),
        r((19, "X4433333333333334X")),
        r((19, "X4433333333333334X"), (22, "wXw"), (30, "wXw")),
        r((19, "X4433333333333334X")),
        r((19, "X4433333333333334X"), (27, "2")),
        # ---- stubble is a shadow on skin, not a beard: the darkest step of
        # ---- his own skin ramp, over the lip and the jaw. Drawn in the
        # ---- outline colour instead -- which is what this was first -- it
        # ---- covers the mouth and he reads as a man in a balaclava.
        r((19, "X4412222222222114X"), (25, "111111")),
        r((19, "X4412222222222214X"), (26, "1X1")),
        r((20, "X41222222222114X")),
        r((21, "Xd1122222211dX")),
        # ---- neck, then the shoulders of a man who used to move things ----
        r((24, "X2222222X")),
        r((24, "X3333333X")),
        # ---- the jacket. Whatever was hanging by the door, over the shirt
        # ---- he had slept in, because it was snowing and he expected to be
        # ---- outside for about forty seconds.
        r((14, "X" + "kj" + "j" * 8 + "J" * 6 + "j" * 8 + "jk" + "X")),
        r((12, "X" + "kjj" + "j" * 9 + "J" * 6 + "j" * 9 + "jjk" + "X")),
        r((11, "X" + "kjjj" + "j" * 9 + "J" * 6 + "j" * 9 + "jjjk" + "X")),
        r((11, "X" + "kjjj" + "j" * 9 + "J" * 6 + "j" * 9 + "jjjk" + "X")),
        # ---- the coat, open, with the shirt showing down the middle of it -
        #  The opening widens on the way down, because that is what an
        #  unzipped jacket does. Narrowing it instead -- which was the first
        #  attempt -- draws a tapering wedge of shirt that reads as a necktie.
        body(coat(6), "XJjjkX", "XjjkkX"),
        body(coat(6), "XJjjkX", "XjjkkX"),
        body(coat(6), "XJjjkX", "XjjkkX"),
        body(coat(8), "XJjjkX", "XjjkkX"),
        body(coat(8), "XJjjkX", "XjjkkX"),
        body(coat(8), "XJjjkX", "XjjkkX"),
        body(coat(10), "XJjjkX", "XjjkkX"),
        body(coat(10), "XJjjkX", "XjjkkX"),
        body(coat(10), "XJjjkX", "XjjkkX"),
        #  The hem, then the shirt hanging out under it, then his hands. The
        #  shirt has to show below the coat or the two garments read as one.
        body("X" + "k" * 18 + "X", "XJjkkX", "XjkkkX"),
        body("X" + "t" + "s" * 16 + "t" + "X", "XJjkkX", "XjkkkX"),
        body("X" + "t" + "s" * 16 + "t" + "X", "XX44XX", "XX44XX"),
        body("X" + "t" + "s" * 16 + "t" + "X"),
        # ---- white boxers with red hearts, which is what he had on when he
        # ---- went out after the cat and is what the show made him famous in
        *[r((17, "X" + row + "X")) for row in boxers()],
        #  The hem splits into two legs; the gap is what stops the whole
        #  thing reading as a skirt.
        r((17, "X000000000XX0000999X")),
        r((17, "X00000000X"), (28, "X0099990X")),
        r((18, "X99000X"), (29, "X009990X")),
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
        #  Toes. Three of them a foot, cut apart by the outline colour, which
        #  is the whole difference between a bare foot and a rounded stump --
        #  and bare feet are the premise, so they are worth four pixels.
        r((15, "X5X4X4X3X"), (26, "X3X2X2X1X")),
        r((15, "XXXXXXXXX"), (26, "XXXXXXXXX")),
    ]
    while len(g) < H:
        g.append(r())
    return g
