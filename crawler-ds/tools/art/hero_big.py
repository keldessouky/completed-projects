"""Carl at battler scale.

The party sprites are drawn to fit beside a message box on a 256x192 screen,
which puts Carl at fifty-seven pixels and leaves no room for a face that is
more than four features. This is the same man with twice the height to say it
in: shading across the arms and legs instead of flat columns, a jacket with
folds in it, a face with a brow ridge and a jaw, and toes that are toes.

Built with the forge's shaded primitives rather than placed pixel by pixel --
at this size a hand-placed grid is seven thousand characters and every one of
them is a chance to put a knee in the wrong place. The face is the exception,
and always is: nothing procedural reads as a face.
"""
from forge_tools import Sprite
from palettes import INK, RAMPS

W, H = 96, 128

#  Where the feet are drawn, and separately where stage() stands him. Keeping
#  one number for both makes the legs grow every time the frame does, and the
#  drawing chases the frame it is being fitted into.
FEET = 104
GROUND = 116


#  Landmarks, so the figure is built to a skeleton instead of to whatever
#  number looked right for the part being drawn at the time. The first pass
#  came out three heads tall and shoulders wider than he is high, because
#  every limb was placed against the one before it and nothing was placed
#  against him.
HEAD_CY, HEAD_RX, HEAD_RY = 17, 10, 12     # head spans y5..y29
NECK_Y = 27
SHOULDER_Y, SHOULDER_HW = 33, 17
HEM_Y = 64                                  # where the jacket stops
HIP_Y, HIP_HW = 62, 14
KNEE_Y = 86
FEET = 104


def carl_big():
    s = Sprite(W, H)

    skin = s.ramp((185, 121, 104), 6, name='skin')
    coat = s.ramp((56, 83, 56), 6, name='cloth_green')
    tee = s.ramp((133, 134, 129), 5, name='stone')
    linen = s.ramp((240, 233, 215), 5, name='cloth_cream')
    hair = s.ramp((90, 60, 48), 5, name='hair_brown')
    heart = s.ink(RAMPS['blood'][3])
    heart_d = s.ink(RAMPS['blood'][1])
    ink = s.ink(INK['brown'])
    stub = skin[1]
    cx = W // 2

    # ---- legs: hip to knee to ankle, then the feet ------------------------
    for side in (-1, 1):
        hx = cx + side * 7
        s.limb(hx, HIP_Y + 6, cx + side * 9, KNEE_Y, 15, 12, skin)
        s.limb(cx + side * 9, KNEE_Y, cx + side * 9, FEET - 5, 12, 10, skin)
        fx = cx + side * 9
        s.limb(fx, FEET - 5, fx + side * 3, FEET - 1, 10, 13, skin)
        #  Toes, cut apart by the outline. Bare feet are the premise of the
        #  book and the first thing that reads wrong if they are stumps.
        for t in range(4):
            tx = fx - 5 + t * 3 + side
            s.rect(tx, FEET - 1, tx + 1, FEET, skin[4 - (t & 1)])
            s.put(tx + 2, FEET, ink)

    # ---- the boxers -------------------------------------------------------
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 16, linen[3])
    s.rect(cx - HIP_HW, HIP_Y - 2, cx + HIP_HW, HIP_Y + 1, linen[4])
    s.rect(cx + HIP_HW - 6, HIP_Y + 2, cx + HIP_HW, HIP_Y + 16, linen[1])
    s.rect(cx - 3, HIP_Y + 10, cx + 3, HIP_Y + 16, linen[1])
    #  Seven across, not eleven. The shirt hangs over the waistband, which is
    #  correct and also means the top third of the shorts is not visible --
    #  the first pass put two of the hearts up there, under the shirt, where
    #  nobody would ever see them.
    HEART = (
        ".hh.hh.",
        "hhhhhhh",
        "hhhhhhh",
        ".hhhhh.",
        "..hhh..",
        "...h...",
    )
    for hx, hy in ((-13, HIP_Y + 5), (-3, HIP_Y + 4), (7, HIP_Y + 5),
                   (-9, HIP_Y + 12), (2, HIP_Y + 12)):
        s.stamp(cx + hx, hy, HEART, {'h': heart})
        s.stamp(cx + hx, hy, HEART[:1], {'h': heart_d})

    # ---- the shirt, hanging below the coat --------------------------------
    s.rect(cx - 15, HEM_Y - 10, cx + 15, HIP_Y + 2, tee[2])
    s.rect(cx + 9, HEM_Y - 10, cx + 15, HIP_Y + 2, tee[1])

    # ---- the coat ---------------------------------------------------------
    s.form(cx, (SHOULDER_Y + HEM_Y) // 2, SHOULDER_HW, (HEM_Y - SHOULDER_Y) // 2 + 4,
           coat, wrap=1.25, squash=0.4)
    s.rect(cx - SHOULDER_HW, SHOULDER_Y, cx + SHOULDER_HW, HEM_Y, coat[2])
    s.rect(cx - SHOULDER_HW, SHOULDER_Y, cx - SHOULDER_HW + 5, HEM_Y, coat[4])
    s.rect(cx + SHOULDER_HW - 5, SHOULDER_Y, cx + SHOULDER_HW, HEM_Y, coat[0])
    #  The opening, widening on the way down the way an unzipped coat does,
    #  with a lit tape down each edge of it.
    for y in range(SHOULDER_Y + 1, HEM_Y):
        half = 3 + (y - SHOULDER_Y) * 7 // (HEM_Y - SHOULDER_Y)
        #  Plain cloth with the lapel's shadow falling across the near edge.
        #  Banding it every few rows, which was meant to read as folds, reads
        #  as a zip: a shirt in an open coat is a flat panel at this size.
        s.rect(cx - half, y, cx + half, y, tee[2])
        s.rect(cx + half - 2, y, cx + half, y, tee[1])
        s.put(cx - half - 1, y, coat[4])
        s.put(cx + half + 1, y, coat[1])
    s.rect(cx - SHOULDER_HW, HEM_Y - 2, cx + SHOULDER_HW, HEM_Y, coat[0])

    # ---- arms: sleeve to the wrist, then a hand ---------------------------
    for side in (-1, 1):
        ax = cx + side * (SHOULDER_HW - 2)
        s.limb(ax, SHOULDER_Y + 2, ax + side * 3, HEM_Y - 2, 13, 10,
               coat if side < 0 else coat[:5])
        s.limb(ax + side * 3, HEM_Y - 2, ax + side * 4, HEM_Y + 7, 9, 8, skin)

    # ---- head -------------------------------------------------------------
    #  Hair first, face over it, tufts back on top. Drawing the hair last --
    #  which is the obvious order -- lays a second cap of it straight across
    #  the eyes and he comes out wearing a mask.
    s.form(cx, HEAD_CY - 1, HEAD_RX + 2, HEAD_RY + 2, hair, wrap=1.2)
    s.form(cx, HEAD_CY + 3, HEAD_RX, HEAD_RY - 1, skin, wrap=1.35)
    s.rect(cx - 5, NECK_Y, cx + 5, SHOULDER_Y + 1, skin[2])
    s.rect(cx - 5, NECK_Y, cx + 5, NECK_Y + 1, skin[1])
    for tx, ty, tr in ((-8, 3, 4), (-2, 1, 4), (5, 2, 4), (9, 6, 3)):
        s.form(cx + tx, ty + 2, tr, tr + 1, hair, wrap=1.1)

    FACE = (
        "..eeee.....eeee..",
        ".eeeeee...eeeeee.",
        ".................",
        "..wXXw.....wXXw..",
        "...X.........X...",
        ".................",
        ".......nnn.......",
        "......nnnnn......",
        ".................",
        "..sssssssssss....",
        "...ss.XXX.ss.....",
        "....sssssss......",
    )
    s.stamp(cx - 8, HEAD_CY - 1, FACE, {
        'e': hair[0], 'w': linen[4], 'X': ink, 'n': skin[1], 's': stub,
    })

    return s.finish().stage(W, H, GROUND).emit()
