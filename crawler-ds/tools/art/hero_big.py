"""Carl at battler scale, in the style the genre actually uses.

This was a lambert-shaded figure: every form lit by a real surface normal
against a key light, which gives a soft airbrushed roundness. That is the
wrong language for this game. Anime and the sprite work that came out of it
-- Pokemon's trainers, the Ace Attorney cast, every fighting-game portrait --
is cel shaded: flat areas of colour with a hard edge where the shadow starts,
two or three tones to a material and no gradient anywhere. The roundness
comes from where you put the shadow's edge, not from smearing the ramp across
the form.

So nothing here is shaded by a normal. Every mass is filled flat, and the
shadow is a second copy of the same shape inset toward the key, which leaves
a crescent of the darker tone along the side facing away from it. Hair is
pointed clumps rather than a soft cap, and the eyes are given the room the
style spends on them: at this size an anime eye is a seventh of the face.
"""
from forge_tools import Sprite
from palettes import INK, RAMPS

W, H = 96, 128
FEET = 104
GROUND = 116

#  Roughly four and a half heads. Realistic is seven and a half; the style
#  trades some of that for a head big enough to carry the eyes, which are
#  where all the acting happens.
HEAD_CY, HEAD_RX, HEAD_RY = 21, 13, 13
CHIN_Y = 34
NECK_Y = 33
SHOULDER_Y = 38
SHOULDER_HW = 21
TORSO_HW = 15
WAIST_HW = 10
HEM_Y = 66
HIP_Y, HIP_HW = 63, 12
KNEE_Y = 84


def carl_anime():
    s = Sprite(W, H)
    F = s.register_family

    #  Four tones a material: deep shadow, shadow, base, highlight. Cel work
    #  wants the steps far apart -- a ramp with small gaps between its entries
    #  reads as a gradient however hard the edges are.
    skin = F(s.ramp((185, 121, 104), 4, name='skin'))
    coat = F(s.ramp((56, 83, 56), 4, name='cloth_green'))
    tee = F(s.ramp((133, 134, 129), 4, name='stone'))
    linen = F(s.ramp((240, 233, 215), 4, name='cloth_cream'))
    hair = F(s.ramp((90, 60, 48), 4, name='hair_brown'))
    heart = F(s.ramp((184, 64, 61), 3, name='blood'))
    ink = s.ink(INK['brown'])
    white = s.ink(RAMPS['cloth_cream'][4])
    iris = s.ink(RAMPS['wood'][1])
    iris_hi = s.ink(RAMPS['wood'][3])
    cx = W // 2

    def cel(fn, shadow, base, light=None):
        """Flat fill, then the lit area inset toward the key.

        The shadow is not computed; it is the part of the shape the lit copy
        does not cover. That single idea is the whole difference between this
        and the version before it.
        """
        fn(shadow, 0, 0)
        fn(base, -2, -2)
        if light is not None:
            fn(light, -5, -5)

    # ---- legs ---------------------------------------------------------------
    for side in (-1, 1):
        def leg(col, ox, oy, side=side):
            s.limb(cx + side * 7 + ox, HIP_Y + 4 + oy,
                   cx + side * 8 + ox, KNEE_Y + oy, 12, 9, [col])
            s.limb(cx + side * 8 + ox, KNEE_Y + oy,
                   cx + side * 8 + ox, FEET - 6 + oy, 9, 6, [col])
        cel(leg, skin[1], skin[2])
        fx = cx + side * 8
        s.limb(fx, FEET - 6, fx + side * 2, FEET - 1, 10, 12, [skin[1]])
        s.limb(fx - 1, FEET - 7, fx + side * 2 - 1, FEET - 2, 9, 11, [skin[2]])
        for t in range(4):
            tx = fx - 5 + t * 3 + side
            s.rect(tx, FEET - 2, tx + 1, FEET - 1, skin[3 - (t & 1)])
            s.put(tx + 2, FEET - 2, ink)
            s.put(tx + 2, FEET - 1, ink)

    # ---- boxers -------------------------------------------------------------
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 16, linen[1])
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW - 5, HIP_Y + 14, linen[3])
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 1, linen[3])
    s.line(cx - HIP_HW, HIP_Y + 1, cx + HIP_HW, HIP_Y + 1, linen[1])
    s.rect(cx - 3, HIP_Y + 11, cx + 3, HIP_Y + 16, linen[0])
    HEART = (
        ".hh.hh.",
        "hHHhHHh",
        "hHHHHHh",
        ".hHHHh.",
        "..hHh..",
        "...h...",
    )
    for hx, hy in ((-11, HIP_Y + 5), (-2, HIP_Y + 3), (6, HIP_Y + 6),
                   (-7, HIP_Y + 11)):
        s.stamp(cx + hx, hy, HEART, {'h': heart[0], 'H': heart[1]})

    # ---- shirt --------------------------------------------------------------
    s.rect(cx - 15, HEM_Y - 13, cx + 15, HIP_Y + 2, tee[1])
    s.rect(cx - 15, HEM_Y - 13, cx + 9, HIP_Y + 2, tee[2])
    s.rect(cx - 9, SHOULDER_Y - 4, cx + 9, SHOULDER_Y + 6, tee[2])
    s.rect(cx + 4, SHOULDER_Y - 4, cx + 9, SHOULDER_Y + 6, tee[1])
    s.line(cx - 9, SHOULDER_Y - 4, cx + 9, SHOULDER_Y - 4, tee[0])

    # ---- the coat -----------------------------------------------------------
    def coat_hw(y):
        t = (y - SHOULDER_Y) / float(HEM_Y - SHOULDER_Y)
        return int(round(TORSO_HW + (WAIST_HW - TORSO_HW) * (t ** 1.6)))

    for y in range(SHOULDER_Y, HEM_Y + 1):
        hw = coat_hw(y)
        s.rect(cx - hw, y, cx + hw, y, coat[1])            # the shadow side
        s.rect(cx - hw, y, cx + hw - 5, y, coat[2])        # the lit body
        s.rect(cx - hw, y, cx - hw + 2, y, coat[3])        # the edge facing the key
    #  The opening. Three pixels of coat left either side, which is where the
    #  taper lives: an unfastened jacket is two narrow panels at the bottom.
    for y in range(SHOULDER_Y + 3, HEM_Y):
        half = min(3 + (y - SHOULDER_Y) * 8 // (HEM_Y - SHOULDER_Y), coat_hw(y) - 3)
        s.rect(cx - half, y, cx + half, y, tee[2])
        s.rect(cx + half - 2, y, cx + half, y, tee[1])
        s.put(cx - half - 1, y, coat[3])
        s.put(cx + half + 1, y, coat[0])
    s.rect(cx - coat_hw(HEM_Y), HEM_Y - 1, cx + coat_hw(HEM_Y), HEM_Y, coat[0])

    #  Collar, folded back off the neck.
    s.poly([(cx - 12, SHOULDER_Y - 1), (cx - 4, SHOULDER_Y - 6),
            (cx - 2, SHOULDER_Y + 5), (cx - 11, SHOULDER_Y + 6)], coat[3])
    s.poly([(cx + 12, SHOULDER_Y - 1), (cx + 4, SHOULDER_Y - 6),
            (cx + 2, SHOULDER_Y + 5), (cx + 11, SHOULDER_Y + 6)], coat[1])

    # ---- sleeves ------------------------------------------------------------
    for side in (-1, 1):
        ax = cx + side * (SHOULDER_HW - 5)
        def sleeve(col, ox, oy, ax=ax, side=side):
            s.limb(ax + ox, SHOULDER_Y + 3 + oy,
                   cx + side * (WAIST_HW + 5) + ox, HEM_Y - 4 + oy, 10, 7, [col])
        cel(sleeve, coat[1], coat[2])
        s.rect(cx + side * (WAIST_HW + 1), HEM_Y - 6,
               cx + side * (WAIST_HW + 7), HEM_Y - 4, coat[0])
        hx = cx + side * (WAIST_HW + 5)
        s.form(hx, HEM_Y + 1, 4, 6, [skin[1]])
        s.form(hx - 1, HEM_Y, 4, 5, [skin[2]])

    # ---- neck, then the head ------------------------------------------------
    s.rect(cx - 5, NECK_Y - 3, cx + 5, SHOULDER_Y + 2, skin[2])
    s.rect(cx - 5, NECK_Y - 3, cx + 5, NECK_Y, skin[1])    # the jaw's shadow

    #  The head: wide at the temples, tapering to a small rounded chin, which
    #  is the shape the style is built on.
    def skull(col, ox, oy):
        s.form(cx + ox, HEAD_CY + oy, HEAD_RX, HEAD_RY - 1, [col])
        s.poly([(cx - HEAD_RX + 1 + ox, HEAD_CY + 4 + oy),
                (cx + HEAD_RX - 1 + ox, HEAD_CY + 4 + oy),
                (cx + 5 + ox, CHIN_Y + oy), (cx - 5 + ox, CHIN_Y + oy)], col)
    cel(skull, skin[1], skin[2])
    s.form(cx - HEAD_RX + 1, HEAD_CY + 3, 2, 3, [skin[2]])     # ears, mostly hidden
    s.form(cx + HEAD_RX - 1, HEAD_CY + 3, 2, 3, [skin[1]])

    #  Hair in clumps that point up and out from a hairline, not a soft cap.
    #  Built the first time as triangles hung off the middle of the skull,
    #  which sent them sideways and gave him wings.
    HAIRLINE = HEAD_CY - 3
    #  Wide, overlapping clumps. Narrow ones spaced apart are a crown of
    #  thorns; hair is a mass with points on it, not points on their own.
    SPIKES = ((-15, -5, -11, -14), (-11, 0, -6, -18), (-6, 5, 0, -20),
              (0, 11, 7, -18), (6, 15, 13, -13))
    for x0, x1, tipx, tipy in SPIKES:
        s.poly([(cx + x0, HAIRLINE + 4), (cx + x1, HAIRLINE + 4),
                (cx + tipx + 2, HEAD_CY + tipy), (cx + tipx - 2, HEAD_CY + tipy)],
               hair[1])
    for x0, x1, tipx, tipy in SPIKES:
        s.poly([(cx + x0 + 1, HAIRLINE + 3), (cx + x1 - 1, HAIRLINE + 3),
                (cx + tipx, HEAD_CY + tipy + 2), (cx + tipx - 3, HEAD_CY + tipy + 2)],
               hair[2])
    #  The mass the clumps grow out of, and a lit plane along the top of it.
    s.form(cx, HAIRLINE - 2, HEAD_RX + 1, 8, [hair[1]])
    s.form(cx - 2, HAIRLINE - 4, HEAD_RX - 1, 7, [hair[2]])
    for i in range(-10, 11, 4):
        s.line(cx + i, HAIRLINE - 7, cx + i + 3, HAIRLINE - 4, hair[3])

    #  The eyes, set wide and given the room the style spends on them: a lash
    #  line, a sclera, an iris darker at the top where the lid shades it, a
    #  pupil and a catchlight in the corner the key comes from. Small dark
    #  ones set close together read as goggles, which is what they were.
    EYE = (
        "..XXXX..",
        ".XXXXXX.",
        "XwIIIIiX",
        "XwIPPIiX",
        "XwiPPiiX",
        "XwiiiiiX",
        ".XiiiiX.",
        "..XXXX..",
    )
    KEY = {'X': ink, 'w': white, 'i': iris_hi, 'I': iris, 'P': ink}
    s.stamp(cx - 12, HEAD_CY - 2, EYE, KEY)
    s.stamp(cx + 4, HEAD_CY - 2, EYE, KEY)
    for ex in (-11, 5):
        s.rect(cx + ex + 1, HEAD_CY, cx + ex + 2, HEAD_CY + 1, white)

    #  Brows, high and angled, which is where the expression is.
    s.line(cx - 12, HEAD_CY - 4, cx - 5, HEAD_CY - 5, hair[0], 2)
    s.line(cx + 5, HEAD_CY - 5, cx + 12, HEAD_CY - 4, hair[0], 2)
    #  A nose of two pixels and a mouth of four. Anything more stops being
    #  this style.
    s.put(cx, HEAD_CY + 8, skin[1])
    s.put(cx + 1, HEAD_CY + 8, skin[1])
    s.line(cx - 2, HEAD_CY + 11, cx + 2, HEAD_CY + 11, skin[0])
    s.rect(cx - 8, HEAD_CY + 7, cx - 6, HEAD_CY + 8, skin[1])   # cheeks
    s.rect(cx + 7, HEAD_CY + 7, cx + 9, HEAD_CY + 8, skin[1])

    return s.finish(rim=False).stage(W, H, GROUND).emit()


carl_big = carl_anime
