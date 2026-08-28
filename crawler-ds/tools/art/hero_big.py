"""Carl at battler scale, drawn properly.

The first attempt at this size was flat slabs of colour in thirty-three
shades, and I blamed the canvas. That was wrong twice over: the DS carries
some of the best sprite work anybody has ever done, and the thing stopping
this one was that I had drawn it with rectangles and left every tool in the
box shut. A sprite is not a diagram that has been coloured in. It has folds
where cloth bends, a terminator that wraps, strands in the hair, a shadow
under the jaw and a rim of cold light down the side facing away from the key.

So: layered forms rather than filled boxes, folds put in with stroke_shade so
they step whatever they land on along its own ramp and stay honest to the
light, soften_edges to take the staircase off every curve, and a face placed
pixel by pixel because a face has always had to be.
"""
import math

from forge_tools import Sprite
from palettes import INK, RAMPS

W, H = 96, 128

#  Where the feet are drawn, and separately where stage() stands the finished
#  figure. One number for both makes the legs grow every time the frame does.
FEET = 104
GROUND = 116

#  Landmarks, so the figure is built to a skeleton rather than to whatever
#  number looked right for the part being drawn at the time.
#  A standing adult is about half legs. The first pass gave him a thirty pixel
#  torso over thirty pixel legs and he came out built like a fire hydrant.
HEAD_CY, HEAD_RX, HEAD_RY = 17, 11, 13
NECK_Y = 28
#  Three widths, not one. SHOULDER_HW is how wide he is across the outside of
#  both sleeves; the torso under them is narrower and narrows further into the
#  waist. Driving the coat body off the shoulder span puts the sleeves outside
#  a torso that is already that wide and he grows shoulder pads.
SHOULDER_Y = 33
SHOULDER_HW = 21                            # outer edge of the sleeves
TORSO_HW = 15                               # the coat body at the chest
WAIST_HW = 9                                # and at the hem
HEM_Y = 62
HIP_Y, HIP_HW = 59, 12
KNEE_Y = 82


def carl_big():
    s = Sprite(W, H)
    F = s.register_family

    skin = F(s.ramp((185, 121, 104), 7, name='skin'))
    coat = F(s.ramp((56, 83, 56), 7, name='cloth_green'))
    tee = F(s.ramp((133, 134, 129), 6, name='stone'))
    linen = F(s.ramp((240, 233, 215), 6, name='cloth_cream'))
    hair = F(s.ramp((90, 60, 48), 6, name='hair_brown'))
    heart = F(s.ramp((184, 64, 61), 4, name='blood'))
    ink = s.ink(INK['brown'])
    white = s.ink(RAMPS['cloth_cream'][4])
    iris = s.ink(RAMPS['wood_dark'][1])
    cx = W // 2

    # ---- legs -------------------------------------------------------------
    for side in (-1, 1):
        s.limb(cx + side * 7, HIP_Y + 4, cx + side * 8, KNEE_Y, 13, 9, skin)
        s.limb(cx + side * 8, KNEE_Y, cx + side * 8, FEET - 6, 9, 6, skin)
        s.form(cx + side * 8, KNEE_Y, 5, 4, skin, wrap=1.5)     # the knee
        s.form(cx + side * (8 + side), KNEE_Y + 7, 4, 7, skin, wrap=1.45)    # calf
        #  Foot: the arch is what stops it reading as a peg, and the toes are
        #  cut apart by the line rather than merely lit differently.
        fx = cx + side * 8
        s.limb(fx, FEET - 6, fx + side * 2, FEET - 1, 11, 13, skin)
        s.shade_band(fx - 6, FEET - 4, fx + 6, FEET - 3, -1)
        for t in range(4):
            tx = fx - 5 + t * 3 + side
            s.rect(tx, FEET - 2, tx + 1, FEET, skin[5 - (t & 1)])
            s.put(tx + 2, FEET - 1, ink)
            s.put(tx + 2, FEET, ink)

    # ---- boxers -----------------------------------------------------------
    s.form(cx, HIP_Y + 8, HIP_HW, 12, linen, wrap=1.5, squash=0.55)
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 16, linen[4])
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 1, linen[5])   # waistband
    s.line(cx - HIP_HW, HIP_Y + 1, cx + HIP_HW, HIP_Y + 1, linen[2])
    s.rect(cx + HIP_HW - 6, HIP_Y + 2, cx + HIP_HW, HIP_Y + 16, linen[2])
    s.rect(cx - 3, HIP_Y + 11, cx + 3, HIP_Y + 16, linen[1])           # the gap
    for fx in (-11, -1, 8):                                            # folds
        s.stroke_shade(cx + fx, HIP_Y + 3, cx + fx - 2, HIP_Y + 15, -1, bend=0.4)
    s.line(cx - HIP_HW, HIP_Y + 16, cx - 4, HIP_Y + 16, linen[1])      # leg hems
    s.line(cx + 4, HIP_Y + 16, cx + HIP_HW, HIP_Y + 16, linen[1])

    HEART = (
        ".hh.hh.",
        "hHHhHHh",
        "hHHHHHh",
        ".hHHHh.",
        "..hHh..",
        "...h...",
    )
    for hx, hy in ((-13, HIP_Y + 5), (-3, HIP_Y + 3), (7, HIP_Y + 5),
                   (-9, HIP_Y + 11), (2, HIP_Y + 12)):
        s.stamp(cx + hx, hy, HEART, {'h': heart[1], 'H': heart[2]})

    # ---- the shirt, hanging below the coat ---------------------------------
    s.form(cx, HEM_Y - 6, 16, 9, tee, wrap=1.4, squash=0.6)
    s.rect(cx - 16, HEM_Y - 12, cx + 16, HIP_Y + 2, tee[4])
    s.rect(cx + 10, HEM_Y - 12, cx + 16, HIP_Y + 2, tee[2])
    s.line(cx - 16, HIP_Y + 2, cx + 16, HIP_Y + 2, tee[1])
    for fx in (-9, 3, 11):
        s.stroke_shade(cx + fx, HEM_Y - 11, cx + fx - 1, HIP_Y + 1, -1)

    #  Neck first of all: drawn with the head, at the end, it paints straight
    #  over the collar and the shirt and he ends up in an open coat with a
    #  bare chest under it.
    s.rect(cx - 6, NECK_Y - 2, cx + 6, SHOULDER_Y + 2, skin[3])
    s.shade_band(cx - 6, NECK_Y - 2, cx + 6, NECK_Y + 2, -2)         # under the jaw

    #  The shirt goes all the way up to the collar. Drawing it only where the
    #  coat's opening shows it leaves a bare chest above the V, which is a
    #  man wearing a jacket over nothing.
    s.form(cx, SHOULDER_Y + 9, 14, 13, tee, wrap=1.3, squash=0.4)
    s.rect(cx - 8, SHOULDER_Y - 3, cx + 8, SHOULDER_Y + 4, tee[4])
    s.line(cx - 8, SHOULDER_Y - 3, cx + 8, SHOULDER_Y - 3, tee[1])   # the crew neck
    s.shade_band(cx - 8, SHOULDER_Y - 3, cx + 8, SHOULDER_Y - 1, -1)

    # ---- the coat ----------------------------------------------------------
    #  Drawn row by row down a taper rather than as one column of rectangles.
    #  Constant width from shoulder to hem is what made the first pass read as
    #  a box with a head on it: the line from the deltoid in to the waist is
    #  most of what says this is a man and not a wardrobe.
    def coat_hw(y):
        t = (y - SHOULDER_Y) / float(HEM_Y - SHOULDER_Y)
        #  Eased, so the shoulder keeps its width for a moment before the
        #  torso starts drawing in. A straight line from one to the other is
        #  a funnel.
        return int(round(TORSO_HW + (WAIST_HW - TORSO_HW) * (t ** 1.6)))

    s.form(cx, (SHOULDER_Y + HEM_Y) // 2, TORSO_HW,
           (HEM_Y - SHOULDER_Y) // 2 + 5, coat, wrap=1.2, squash=0.3)
    for y in range(SHOULDER_Y, HEM_Y + 1):
        hw = coat_hw(y)
        s.rect(cx - hw, y, cx + hw, y, coat[3])
        s.rect(cx - hw, y, cx - hw + 3, y, coat[5])          # the lit side
        s.rect(cx + hw - 4, y, cx + hw, y, coat[1])          # and the far one
        s.rect(cx + hw - 1, y, cx + hw, y, coat[0])
    #  The opening: it widens on the way down the way an unzipped coat does,
    #  with a tape of lit cloth down each edge and the shirt behind it.
    for y in range(SHOULDER_Y + 3, HEM_Y):
        #  Clamped inside the coat: unclamped it widens past the torso it is
        #  cut into, eats the whole front of the garment, and leaves two green
        #  sleeves either side of a shirt with no jacket between them.
        #  Clamped to leave three pixels of coat either side and no more.
        #  Widening the hem instead so the shirt had room traded the whole
        #  V-taper away for it: an unfastened jacket is two narrow panels at
        #  the bottom, which is where the taper comes from.
        half = min(3 + (y - SHOULDER_Y) * 8 // (HEM_Y - SHOULDER_Y),
                   coat_hw(y) - 3)
        s.rect(cx - half, y, cx + half, y, tee[4])
        s.rect(cx + half - 3, y, cx + half, y, tee[2])
        s.put(cx - half - 1, y, coat[5])
        s.put(cx - half - 2, y, coat[4])
        s.put(cx + half + 1, y, coat[1])
    #  Folds down the body, and the shadow the coat throws on itself at the hem.
    for fx, bend in ((-11, 0.4), (-6, 0.2), (7, -0.2), (11, -0.4)):
        s.stroke_shade(cx + fx, SHOULDER_Y + 5, cx + fx - 3, HEM_Y - 2, -1, bend=bend)
    s.shade_band(cx - TORSO_HW, HEM_Y - 3, cx + TORSO_HW, HEM_Y, -1)

    #  The collar, folded back off the neck on both sides.
    s.poly([(cx - 11, SHOULDER_Y - 1), (cx - 4, SHOULDER_Y - 5),
            (cx - 2, SHOULDER_Y + 5), (cx - 10, SHOULDER_Y + 6)], coat[5])
    s.poly([(cx + 11, SHOULDER_Y - 1), (cx + 4, SHOULDER_Y - 5),
            (cx + 2, SHOULDER_Y + 5), (cx + 10, SHOULDER_Y + 6)], coat[2])
    s.line(cx - 4, SHOULDER_Y - 5, cx - 2, SHOULDER_Y + 5, coat[6])

    # ---- sleeves, cuffs, hands ---------------------------------------------
    for side in (-1, 1):
        ax = cx + side * (SHOULDER_HW - 5)
        s.form(ax, SHOULDER_Y + 4, 6, 7, coat, wrap=1.15)           # deltoid
        s.limb(ax, SHOULDER_Y + 4, cx + side * (WAIST_HW + 5), HEM_Y - 4, 9, 6, coat)
        s.stroke_shade(ax + side, SHOULDER_Y + 10, cx + side * (WAIST_HW + 3), HEM_Y - 6, -1)
        s.rect(cx + side * (WAIST_HW + 1), HEM_Y - 6, cx + side * (WAIST_HW + 7), HEM_Y - 4, coat[1])  # cuff
        s.form(cx + side * (WAIST_HW + 5), HEM_Y + 1, 4, 6, skin, wrap=1.4)      # the hand
        s.put(cx + side * (WAIST_HW + 5), HEM_Y + 5, skin[1])

    # ---- head ---------------------------------------------------------------
    #  Hair, then the face over it, then the clumps that stand off the top.
    #  Drawing the hair last lays a second cap of it across the eyes.
    s.form(cx, HEAD_CY - 2, HEAD_RX + 2, HEAD_RY + 1, hair, wrap=1.2)
    s.form(cx, HEAD_CY + 3, HEAD_RX, HEAD_RY - 2, skin, wrap=1.45)
    s.form(cx - HEAD_RX, HEAD_CY + 3, 3, 4, skin, wrap=1.4)          # ears
    s.form(cx + HEAD_RX, HEAD_CY + 3, 3, 4, skin, wrap=1.4)
    #  Clumps rather than a cap: he has not combed it since the ceiling fell.
    for tx, ty, w_, h_ in ((-11, 6, 5, 5), (-4, 3, 6, 6), (4, 4, 6, 5), (11, 8, 4, 5)):
        s.form(cx + tx, ty, w_, h_, hair, wrap=1.1)
    for i in range(-10, 11, 3):                                      # strands
        s.stroke_shade(cx + i, HEAD_CY - 13, cx + i - 2, HEAD_CY - 4, 1)

    #  The face. Eyes get a lid, a sclera, an iris and a pupil, because at
    #  twenty-four pixels across there is room for all four and a dot instead
    #  is the difference between a character and a smiley.
    FACE = (
        "..EEEEE.......EEEEE..",
        ".eeeeeee.....eeeeeee.",
        ".....................",
        "..lllll.......lllll..",
        "..wwiIw.......wIiww..",
        "...LLL.........LLL...",
        ".....................",
        "..........n..........",
        ".........nnn.........",
        "........nnnnn........",
        ".........NNN.........",
        ".....................",
        "...s...s...s...s...s.",
        "......MMMMMMM........",
        ".......mmmmm.........",
        "..s...s...s...s...s..",
    )
    #  A mouth drawn as a bar of the outline colour is a gash across the jaw.
    #  It is a line of his own darkest skin with a lit lower lip under it, and
    #  the stubble is stippled rather than filled -- solid, it swallows both.
    s.stamp(cx - 10, HEAD_CY - 2, FACE, {
        'E': hair[0], 'e': hair[1], 'l': skin[1], 'L': skin[2],
        'w': white, 'i': iris, 'I': ink, 'n': skin[2], 'N': skin[1],
        's': skin[1], 'M': skin[0], 'm': skin[4],
    })

    s.soften_edges(skin)
    s.soften_edges(coat)
    s.soften_edges(hair)
    return s.finish().stage(W, H, GROUND).emit()
