"""Princess Donut, drawn rather than computed.

Everything else in this folder builds a sprite out of shaded primitives —
ellipses with a lambert term, capsules, a global relight — which produces a
small render, not a sprite. The tell is the palette: the previous Donut used
200 colours in fourteen-step ramps ten luma apart, and the shading never
resolved into shapes you could read.

Real hardware sprite art of this era is 4bpp. Every palette in pokeemerald is
exactly sixteen colours; every NCLR in pokeheartgold is bit depth 3, which is
the same thing. That constraint is not an obstacle to work around, it is what
produces the look: with four steps to a material you cannot blend, so every
boundary has to be a decision, and the values have to use the whole range from
near-black to white or the sprite goes muddy.

So: fifteen colours and a transparent index, four steps to each material about
forty luma apart, and every pixel placed by hand.
"""

W, H = 56, 72

# index 0 is transparent. Fifteen colours, which is what the hardware gives you.
#  Donut out of the shared palette: her coat is the copper ramp, her tiara the
#  gold one, and both are the same bytes as every other copper and gold thing
#  in the game. See tools/art/palettes.py.
from palettes import INK, RAMPS

PALETTE = [
    INK['brown'],                     # X  outline, and the pupil
    RAMPS['copper'][0],               # 1  coat, deepest
    RAMPS['copper'][1],               # 2  coat, shadow
    RAMPS['copper'][2],               # 3  coat, base
    RAMPS['copper'][3],               # 4  coat, light
    RAMPS['wood_dark'][2],            # 5  ruff and chest, in shadow
    RAMPS['sand'][3],                 # 6  ruff and chest, where the light gets in
    RAMPS['cloth_cream'][4],          # 7  the muzzle, the catchlight, the whiskers
    RAMPS['gold'][1],                 # 8  gold, shadow
    RAMPS['gold'][3],                 # 9  gold, base
    RAMPS['gold'][4],                 # 0  gold, light
    RAMPS['cloth_purple'][2],         # p  pink, shadow
    RAMPS['cloth_purple'][3],         # P  pink, base
    RAMPS['grass'][2],                # g  eye, shadowed iris
    RAMPS['grass'][4],                # G  eye, lit iris
]

KEY = "X1234567890pPgG"


def _row(*segs):
    """One row of the sprite. Segments are (x, "chars") so the pixels are
    placed at coordinates rather than counted out in a 56-character string."""
    row = ['.'] * W
    for x, s in segs:
        for i, ch in enumerate(s):
            row[x + i] = ch
    return ''.join(row)


def run(*parts):
    """Expands (char, count) pairs into a string, so a run of nineteen coat
    pixels is written as one pair rather than counted out by eye."""
    return ''.join(ch * n for ch, n in parts)


def hrow(x0, cream_l, lit, base, shadow, cream_r):
    """One row of the head: outline, cheek furnishings, the lit side of the
    ginger cap, its base, its shadow side, the far cheek, outline. Widths are
    chosen per row rather than derived, which is the whole point."""
    return (x0, 'X' + '6' * cream_l + '4' * lit + '3' * base
                    + '2' * shadow + '5' * cream_r + 'X')


def brow(x0, coat_l, cream, coat_r):
    """One row of the body: ginger flank, the cream ruff, ginger flank.

    The ruff is the largest area on the sprite and flat cream across all of it
    reads as a bib rather than a chest, so it carries the same four steps as
    everything else — lit toward the key, base, shadow away from it.
    """
    hi = cream // 5
    lo = max(1, cream // 4)
    return (x0, 'X' + '4' + '3' * (coat_l - 1)
                    + '7' * hi + '6' * (cream - hi - lo) + '5' * lo
                    + '2' * coat_r + 'X')


EYE = ["..XXXXX..", ".XgggggX.", "XgG7XXGGX", "XgGXXXGGX",
       "XgGXXXGGX", "XggGGGGGX", ".XGGGGGX.", "..XXXXX.."]


def grid():
    r = _row
    g = [
        # ---- crown: five points, each with a stone, valleys left open ------
        r(),
        r(),
        r((27, "XX")),
        r((26, "XPPX")),
        r((26, "XppX")),
        r((21, "XX"), (26, "X09X"), (34, "XX")),
        r((20, "XPPX"), (25, "X0098X"), (33, "XPPX")),
        r((20, "XppX"), (25, "X0098X"), (33, "XppX")),
        r((15, "XX"), (20, "X09X"), (25, "X0098X"), (33, "X09X"), (40, "XX")),
        r((14, "XPPX"), (19, "X0098X"), (25, "X0098X"), (32, "X0098X"), (39, "XPPX")),
        r((14, "XppX"), (19, "X0098X"), (24, "X009988X"), (32, "X0098X"), (39, "XppX")),
        r((13, "X09X"), (19, "X0098X"), (24, "X009988X"), (32, "X0098X"), (38, "X09X")),
        r((13, "X0098X"), (19, "X0098X"), (24, "X009988X"), (32, "X0098X"), (37, "X0098X")),
        r((13, "X0098X"), (18, "X00998X"), (24, "X009988X"), (32, "X00998X"), (37, "X0098X")),
        r((12, "X" + "0" * 29 + "X")),
        r((12, "X" + "9" * 29 + "X")),
        r((12, "X" + "9" * 11 + "PPPP" + "9" * 14 + "X")),
        r((12, "X8" + "9" * 9 + "pPPp" + "9" * 9 + "8" * 4 + "X")),
        r((12, "X" + "8" * 11 + "ppPp" + "8" * 14 + "X")),
        r((12, "X" + "8" * 29 + "X")),
        r((12, "X" * 31)),

        # ---- ears behind, head over them, so the bases tuck away -----------
        r((4, "X22PPPPP333X"), (40, "X333PPPPP22X"), hrow(18, 0, 3, 8, 8, 0)),
        r((4, "X2PPPPPPP33X"), (40, "X33PPPPPPP2X"), hrow(16, 0, 4, 9, 9, 0)),
        r((4, "X2PPPPPPP33X"), (40, "X33PPPPPPP2X"), hrow(15, 0, 5, 9, 10, 0)),
        r((5, "X2PPPPPP33X"), (40, "X33PPPPPP2X"), hrow(14, 0, 5, 10, 11, 0)),
        r((6, "X2PPPP33X"), (41, "X33PPPP2X"), hrow(13, 0, 6, 11, 11, 0)),
        r((8, "X2PP33X"), (42, "X33PP2X"), hrow(13, 1, 5, 11, 11, 0)),

        # ---- the face. Cheek furnishings from here down, so the ginger
        # ---- reads as a cap and a bar down the nose rather than a slab.
        r(hrow(12, 2, 5, 11, 9, 4)),
        r(hrow(12, 3, 4, 11, 8, 5)),
        r(hrow(11, 4, 3, 12, 8, 6), (16, EYE[0]), (31, EYE[0])),
        r(hrow(11, 5, 2, 12, 8, 6), (16, EYE[1]), (31, EYE[1]), (8, "X566"), (45, "665X")),
        r(hrow(11, 5, 2, 12, 8, 6), (16, EYE[2]), (31, EYE[2]), (7, "X5666"), (45, "6665X")),
        r(hrow(11, 6, 1, 12, 7, 7), (16, EYE[3]), (31, EYE[3]), (8, "X566"), (45, "665X")),
        r(hrow(12, 6, 1, 11, 6, 7), (16, EYE[4]), (31, EYE[4]), (7, "X5666"), (45, "6665X")),
        r(hrow(12, 7, 0, 10, 6, 8), (16, EYE[5]), (31, EYE[5]), (8, "X566"), (45, "665X")),
        r(hrow(13, 7, 0, 9, 5, 8), (16, EYE[6]), (31, EYE[6]), (7, "X5666"), (45, "6665X")),
        r(hrow(14, 7, 0, 8, 5, 8), (16, EYE[7]), (31, EYE[7]), (10, "X566"), (43, "665X")),

        # ---- muzzle: cream, a small pink nose, the smallest mouth on her ---
        r(hrow(15, 7, 0, 6, 5, 8), (21, "....777777....")),
        r(hrow(16, 7, 0, 5, 4, 8), (21, "..7777777777..")),
        r(hrow(17, 7, 0, 3, 4, 8), (21, ".677777777776.")),
        r(hrow(18, 7, 0, 2, 3, 8), (21, "66777PPPP77766")),
        r(hrow(19, 6, 0, 2, 2, 7), (21, "66777pPPp77766")),
        r(hrow(20, 6, 0, 0, 2, 6), (21, ".66777pp77766.")),
        r((22, "X" + "6" * 5 + "5" * 5 + "X"), (21, ".6677X77X7766.")),
        r((23, "X" + "6" * 4 + "5" * 4 + "X"), (22, "..6666666655..")),

        # ---- neck into the ruff, the collar, the donut, paws, tail ------
        # The ginger/cream boundary steps in and out row by row so the
        # flank reads as fur meeting fur rather than a stripe on a slab.
        r(brow(20, 0, 15, 0), (24, "5" * 9)),
        r(brow(17, 1, 19, 1), (21, "5" * 15)),
        r(brow(15, 2, 22, 2)),
        r(brow(13, 3, 24, 3)),
        r(brow(11, 4, 26, 4)),
        r(brow(10, 5, 25, 5), (16, "XPPPPX"), (34, "XPPPPX")),
        r(brow(10, 5, 25, 5), (16, "X" + "P" * 23 + "X")),
        r(brow(10, 6, 23, 6), (16, "X" + "P0PPP0PPP0PPP0PPP0PPP0P" + "X")),
        r(brow(10, 5, 25, 5), (16, "X" + "p" * 23 + "X")),
        r(brow(10, 6, 23, 6), (20, "X" + "p" * 15 + "X"), (23, "...XXXX...")),
        r(brow(10, 6, 23, 6), (23, ".XXPPPPXX.")),
        r(brow(10, 7, 21, 7), (23, "XP7PPPPppX"), (46, 'X3332X')),
        r(brow(10, 6, 23, 6), (23, "XPPP55PppX"), (45, 'X33322X')),
        r(brow(10, 7, 21, 7), (23, "XPPP55PppX"), (44, 'X222222X')),
        r(brow(10, 7, 21, 7), (23, "XPPP55Pp7X"), (43, 'X33333322X')),
        r(brow(10, 8, 19, 8), (23, "XPPPPPPppX"), (42, 'X333333322X')),
        r(brow(10, 8, 19, 8), (23, ".X999888X."), (41, 'X2222222222X')),
        r(brow(10, 8, 19, 8), (23, "..X8888X.."), (40, 'X33333333322X')),
        r(brow(11, 8, 17, 8), (23, "...XXXX..."), (15, "...XXXXXX..."), (29, "...XXXXXX..."), (39, 'X333333333322X')),
        r(brow(11, 9, 15, 9), (15, ".XX666666XX."), (29, ".XX655555XX."), (38, 'X2222222222222X')),
        r(brow(12, 9, 13, 9), (15, "XX66777766XX"), (29, "XX66655556XX"), (37, 'X66333333333322X')),
        r(brow(12, 9, 13, 9), (15, "X6677777766X"), (29, "X6666555566X"), (36, 'X667733333333322X')),
        r(brow(13, 9, 11, 9), (15, "X6677777766X"), (29, "X6666555566X"), (36, 'X667733333333322X')),
        r(brow(13, 9, 11, 9), (15, "X667X77X766X"), (29, "X666X55X566X"), (36, 'X66773333333332X')),
        r(brow(14, 9, 9, 9), (15, "X667X77X766X"), (29, "X666X55X566X"), (37, 'X6673333333332X')),
        r((15, "X6677777766X"), (29, "X6666555566X"), (38, 'X66333333332X')),
        r((15, "X" * 12), (29, "X" * 12), (39, 'XXXXXXXXXXX')),
    ]
    return g
