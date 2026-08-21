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


def _cat_eye(s, cx, cy, key, flip=1):
    """One eye, placed pixel by pixel and mirrored for the other side.

    A vertical slit is a predator's eye — it is the single thing that made
    this face read as menacing rather than pettable. Donut gets a big round
    pupil filling most of the iris, a wide catchlight sitting on it, and a
    soft rim, which is what a cat's eye looks like in low light and what
    every friendly cat in every game has ever had.
    """
    grid = [
        "..kkkkk..",
        ".kdGGGdk.",
        "kdGGGGGdk",
        "kGGpppGGk",
        "kGGpppGGk",
        "kdGpppGLk",
        ".kgGGGgd.",
        "..kkkkk..",
    ]
    for j, row in enumerate(grid):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x = cx + (i - 4) * flip
            s.put(x, cy + j - 4, key[ch])
    for j, i in ((-1, -3), (1, 3), (0, -3), (0, 3)):             # fibres in the iris
        s.put(cx + i * flip, cy + j, key['f'])
    for dx, dy in ((-2, -2), (-1, -2), (-2, -1), (-1, -1)):      # the catchlight
        s.put(cx + dx * flip, cy + dy, key['w'])
    for dx, dy in ((0, -2), (-3, -2), (-2, 0)):                  # its soft edge
        s.put(cx + dx * flip, cy + dy, key['W'])
    s.put(cx + 2 * flip, cy + 2, key['b'])                       # the bounce
    s.put(cx + 1 * flip, cy + 2, key['b'])
    s.put(cx - 4 * flip, cy + 1, key['t'])                       # tear duct
    s.put(cx + 4 * flip, cy - 1, key['k'])
    for i in range(-3, 4):                                       # wet lower lid
        s.put(cx + i * flip, cy + 4, key['l'])


def donut():
    """Princess Donut.

    Drawn as a Persian first and a princess second: the flat face, the enormous
    ruff, the ear furnishings and the plumed tail have to land before the tiara
    means anything. Seated, front on, chin very slightly up.
    """
    s = Sprite(PARTY_W, PARTY_H)
    coat = s.register_family(s.ramp((198, 140, 92), 14, dark=0.72, light=0.30, warm=0.30))
    saddle = s.register_family(s.ramp((150, 102, 66), 12, dark=0.78, light=0.26))
    # A near-white base wastes half a ramp: every step above the midpoint lands
    # inside five units of luma. Cream is a mid-value material lit brightly,
    # not a white one darkened, and it keeps almost no cool in shadow or the
    # bib — the largest single area on her — turns grey.
    # The two coats have to occupy different value bands or the whole animal
    # below the neck reads as one grey mass. White fur in shadow is still
    # light: cream keeps a high floor and lives in the top of the range, and
    # the ginger is capped below it so the bib always reads as the brighter
    # material no matter which way the lamp is pointing.
    cream = s.register_family(s.ramp((228, 206, 172), 14,
                                     cool=0.02, dark=0.30, light=0.64, warm=0.30))
    gold = s.register_family(s.ramp((250, 198, 60), 12, dark=0.76, light=0.55))
    ear_pink = s.register_family(s.ramp((214, 128, 138), 9))
    collar = s.register_family(s.ramp((226, 132, 166), 10, dark=0.70, light=0.42))
    glaze = s.register_family(s.ramp((242, 150, 188), 10, dark=0.66, light=0.46))

    dark = s.ink((32, 22, 24))
    rim = s.ink((40, 28, 30))
    iris_dark = s.ink((44, 128, 92))
    iris_light = s.ink((126, 214, 148))
    pupil = s.ink((16, 14, 20))
    spec = s.ink((255, 255, 255))
    bounce = s.ink((150, 202, 214))
    tear = s.ink((122, 76, 62))
    nose = s.ink((240, 156, 164))
    nose_dark = s.ink((186, 100, 112))
    mouth = s.ink((126, 74, 68))
    whisk = s.ink((252, 248, 240))
    whisk_far = s.ink((196, 178, 168))

    # ---- tail: comes round the front, because she knows where the camera is --
    s.limb(44, 44, 52, 56, 11, 14, coat)
    s.limb(52, 56, 42, 69, 14, 11, coat)
    for i, (x, y) in enumerate(((46, 46), (50, 52), (51, 60), (47, 66), (42, 69))):
        band = saddle[4] if i % 2 else coat[7]       # a tail is always banded
        s.line(x - 4, y, x + 4, y + 2, band)
        s.line(x - 4, y + 1, x + 4, y + 3, band if i % 2 else coat[9])
    s.form(41, 69, 7, 3, cream, squash=0.5)          # the white tip
    for k in range(5):                               # plume, breaking the outline
        s.taper_line(53 - k, 48 + k * 4, 56, 44 + k * 5, coat[9], coat[6])

    # ---- body: a seated cone, mostly coat -----------------------------------
    s.poly([(28, 34), (42, 54), (44, 67), (12, 67), (14, 54)], coat[6])
    s.form(28, 54, 17, 14, coat, wrap=0.62)
    s.separate(43, 50, 44, 65, coat, 2)              # the tail sits in front
    s.form(28, 30, 15, 12, saddle, wrap=0.66)        # darker over the shoulders
    for x, y, n, side in ((13, 48, 3, -1), (14, 58, 3, -1),
                          (43, 50, 3, 1), (42, 60, 3, 1)):
        for k in range(n):                           # coat breaking the silhouette
            s.taper_line(x, y + k * 3, x + side * 3, y + k * 3 + 2, coat[9], coat[7])

    # ---- the ruff: the biggest single thing about a Persian -----------------
    s.form(28, 47, 14, 11, cream, wrap=0.96)
    s.form(28, 43, 11, 6, cream, wrap=0.90)
    s.feather(15, 41, 58, cream, coat, depth=3, seed=3)      # bib into the belly
    s.feather(16, 40, 39, cream, saddle, depth=3, seed=7)    # bib into the chest
    for x, y0, y1 in ((20, 44, 55), (36, 45, 56)):   # the ruff falls in panels
        s.taper_line(x, y0, x - 1, y1, cream[6], cream[8])
    s.taper_line(28, 42, 28, 54, cream[12], cream[10])   # the lit centre line

    # ---- front paws ---------------------------------------------------------
    for px in (19, 35):
        s.form(px, 65, 7, 6, cream, wrap=0.94)
        s.form(px, 69, 7, 3, cream, squash=0.5)
        s.shade_band(px - 7, 61, px + 7, 62, -3)                  # the belly casts
        s.stroke_shade(px - 6, 63, px + 6, 63, -2, only=cream)    # where the leg ends
        s.stroke_shade(px - 5, 64, px + 5, 64, 2, only=cream)     # and catches again
        for k in (-4, -1, 2):                                     # toes
            s.stroke_shade(px + k, 66, px + k, 71, -4, only=cream)
            s.stroke_shade(px + k + 1, 66, px + k + 1, 71, 2, only=cream)
        s.shade_band(px - 7, 71, px + 7, 71, -3)
    s.shade_form(28, 68, 4, 5, -3, soft=0)                        # between the paws

    # ---- head ---------------------------------------------------------------
    s.form(28, 25, 16, 13, coat, wrap=0.6)           # skull, wide and round
    s.form(28, 20, 13, 7, saddle, wrap=0.58)         # darker across the top
    s.form(14, 31, 7, 6, cream, wrap=0.92)           # cheek furnishings, low
    s.form(42, 31, 7, 6, cream, wrap=0.86)
    s.feather(8, 20, 27, cream, coat, depth=3, seed=11)
    s.feather(36, 48, 27, cream, coat, depth=3, seed=13)
    for i, (dy, out) in enumerate(((1, 5), (6, 6), (11, 4))):  # tufts, tip-lit
        s.poly([(13, 24 + dy), (13 - out, 27 + dy), (14, 31 + dy)], cream[6])
        s.poly([(13, 26 + dy), (13 - out + 1, 28 + dy), (14, 30 + dy)], cream[9])
        s.poly([(43, 24 + dy), (43 + out, 27 + dy), (42, 31 + dy)], cream[4])
        s.poly([(43, 26 + dy), (43 + out - 1, 28 + dy), (42, 30 + dy)], cream[7])
    # ---- how the light actually falls -------------------------------------
    # Everything above is drawn at its own local value; this is where the sprite
    # gets a light direction you can read across the room. Key from the upper
    # left, occlusion under every overhang.
    s.shade_form(29, 41, 12, 4, -2, soft=0)          # the head onto the ruff
    s.shade_form(28, 59, 13, 3, -1, soft=0)          # the ruff onto the belly
    s.shade_form(43, 55, 5, 11, -2, soft=0)          # the flank behind the tail
    s.shade_form(28, 70, 5, 3, -2, soft=0)           # between the front legs

    s.relight(strength=0.46, ambient=0.24)

    # Re-cut the joins the lamp softened. A relight is a lighting pass, not a
    # drawing pass: it does not know that the head sits in front of the ruff.
    s.shade_form(28, 44, 13, 4, -2, soft=0)          # the head onto the ruff
    s.shade_form(28, 22, 11, 3, -2, soft=0)          # the crown onto the brow
    s.shade_form(43, 54, 5, 12, -1, soft=0)          # the flank behind the tail
    # Fur on the chest runs down and outward from the throat. Drawn as short
    # tapers rather than pixels so it reads as hair lying in a direction.
    for x, y in ((21, 46), (25, 44), (32, 44), (36, 46),
                 (19, 53), (24, 52), (33, 52), (37, 54)):
        out = -1 if x < 28 else 1
        s.stroke_shade(x, y, x + out * 2, y + 7, -1, out * 0.4, only=cream)
    s.stroke_shade(28, 43, 28, 56, 1, only=cream)    # the light down her front
    s.stroke_shade(26, 44, 25, 57, -1, skip=1, only=cream)   # the fold beside it

    # Everything from here is a feature with a value of its own — the
    # muzzle, the eyes, the metal — and is drawn after the lamp so the
    # relight cannot average it away.
    s.form(28, 35, 11, 6, cream, wrap=0.92)           # cream from the nose down
    s.feather(17, 39, 30, cream, coat, depth=3, seed=23)
    # A ginger cat wears a bar of colour down the bridge of the nose. It also
    # frames the eyes, which otherwise float on a pale field.
    s.poly([(25, 18), (31, 18), (30, 30), (26, 30)], coat[6])
    s.line(28, 20, 28, 29, coat[7])
    s.feather(25, 31, 30, coat, cream, depth=2, seed=29)

    # The muzzle is drawn whole rather than assembled: at this size the nose,
    # the philtrum and the two whisker pads are four or five pixels each, and
    # anything procedural turns them into one brown smudge.
    muzzle = {
        's': cream[2], 'd': cream[3], 'h': cream[4], 'v': cream[5],
        'c': cream[7], 'C': cream[9], 'H': cream[11], 'A': cream[12],
        'n': nose, 'N': nose_dark, 'P': s.ink((255, 206, 212)),
        'm': mouth, 'M': s.ink((168, 116, 100)),   # the mouth, fading at its corners
    }
    # Opaque all the way to its edge: a gap in the middle of the muzzle shows
    # the underside of the head form, which is the darkest fur on the sprite.
    # Odd width so the nose, the philtrum and the mouth share one centre
    # column — an even one puts the mouth half a pixel off and it stops
    # reading as a mouth and starts reading as a drip.
    rows = [
        "....cCCCCCc....",
        "..cCHnnnnnCcv..",
        ".cCHHnPNNnCcvh.",
        "cCHHHCnNnCcvvhh",
        "cCHHHCCmCCcvvhh",       # the philtrum, one pixel of it
        "cCHHCCMCMCcvvhh",       # and the mouth, barely there
        "cCdHCCCCCCcvdhh",       # whisker roots, one dot to a pad
        ".cCHCCCCCCcvvh.",
        ".cCdCCHHHCcdvh.",       # the chin, catching the key
        "..cCCCHHHcvvh..",
        "...cCCCcvvh....",
        "....cvsssvh....",
    ]
    for row in rows:
        assert len(row) == 15, (len(row), row)
    s.stamp(21, 30, rows, muzzle)
    s.shade_band(20, 42, 36, 43, -2)                 # what the chin casts

    # ---- the collar, and the donut she is named after -----------------------
    # Drawn after the lamp, like the muzzle and the metal: this is the single
    # thing that tells you which cat this is, and a relight would average it
    # into the ruff.
    for x in range(18, 39):
        t = (x - 28) / 10.0
        y = 44 + int(round((1.0 - t * t) * 3.0))          # a band around a throat
        lit = x < 28
        s.put(x, y, collar[8 if lit else 6])              # the edge catching light
        s.put(x, y + 1, collar[7 if lit else 5])
        s.put(x, y + 2, collar[5 if lit else 3])
        s.put(x, y + 3, collar[2])                        # rolling under
        if x % 5 == 3:                                    # studs, set into the band
            s.put(x, y + 1, gold[10])
            s.put(x, y + 2, gold[6])

    donut = {
        'd': s.ink((198, 96, 132)), 'g': glaze[8], 'G': glaze[6], 'k': glaze[3],
        'h': glaze[9], 'b': s.ink((214, 168, 110)), 'B': s.ink((176, 128, 78)),
        'o': s.ink((92, 52, 62)), 's': s.ink((255, 248, 232)),
        'S': s.ink((160, 226, 220)),
    }
    rows = [
        "..ddddd..",
        ".dhhggGd.",
        "dhhgsgGkd",                                      # sprinkles on the glaze
        "dhgoooGkd",
        "dggoooGkd",
        "dgSgggGkd",
        ".dgGGGkd.",
        ".dbbbbBd.",                                      # the dough underneath
        "..dBBBd..",
    ]
    for row in rows:
        assert len(row) == 9, row
    s.stamp(24, 49, rows, donut)
    s.put(27, 48, gold[9])                                # the ring it hangs from
    s.put(28, 48, gold[5])
    s.shade_band(23, 58, 33, 59, -1)                      # what it casts on the bib

    # ---- ears, drawn before the crown so it sits between them ---------------
    # A Persian's ears are small, low and wide-set, and they are mostly fur: a
    # big pale-pink triangle reads as a paper flag stapled to her head. The
    # opening is a third of the ear, sits at the bottom of it, and is half
    # closed by the furnishings spilling out.
    for side in (-1, 1):
        bx = 28 + side * 12
        tx, ty = bx + side * 4, 6
        s.poly([(bx - side * 6, 19), (tx, ty), (bx + side * 8, 18)], coat[7])
        s.taper_line(tx, ty, bx + side * 8, 18, coat[11], coat[8])   # lit outer edge
        s.taper_line(tx, ty, bx - side * 6, 19, coat[4], coat[6])    # inner, in shade
        s.put(tx + side, ty + 1, coat[8])            # the tip, rounded rather than pointed
        s.put(tx - side, ty + 1, coat[6])
        s.poly([(bx - side * 3, 17), (bx + side * 3, 9), (bx + side * 6, 16)], ear_pink[3])
        s.poly([(bx - side * 2, 16), (bx + side * 3, 11), (bx + side * 5, 15)], ear_pink[5])
        s.poly([(bx - side * 1, 15), (bx + side * 3, 13), (bx + side * 3, 15)], ear_pink[7])
        s.put(bx + side * 3, 13, ear_pink[8])        # light through thin skin
        for k in range(4):                           # furnishings, spilling out
            s.taper_line(bx - side * 2, 16 - k * 2, bx - side * 7 - k, 13 - k * 2,
                         cream[11], cream[8])

    # ---- the tiara she awarded herself --------------------------------------
    # Five points, a jewelled band and a gem on every tip: she does not wear a
    # tiara, she wears a crown. Each point is a solid facet with a lit face and
    # a shadowed one meeting at a centre ridge — drawn as thin spikes it reads
    # as a picket fence.
    gem = s.ink((228, 92, 140))
    gem_hi = s.ink((252, 168, 200))
    gem_lo = s.ink((156, 44, 92))
    # Narrow enough that the valleys between the points stay open. The two
    # faces carry the form on their own; a highlight up every ridge as well
    # corrugates the whole crown.
    for bx, apex in ((20, 7), (24, 4), (28, 1), (32, 4), (36, 7)):
        s.poly([(bx - 2, 15), (bx, apex), (bx + 2, 15)], gold[6])
        s.poly([(bx - 2, 15), (bx, apex), (bx, 15)], gold[10])        # lit face
        s.poly([(bx, apex), (bx + 2, 15), (bx, 15)], gold[3])         # turned away
        s.put(bx, apex, gem)                                          # a stone on the tip
        s.put(bx, apex + 1, gem_lo)
    s.rect(18, 14, 38, 19, gold[8])                       # the band
    s.line(18, 14, 38, 14, gold[11])                      # a highlight along the top
    s.rect(18, 19, 38, 20, gold[2])                       # its underside
    for x in (28,):                                       # one stone set in it
        s.put(x, 17, gem)
        s.put(x + 1, 17, gem)
        s.put(x, 18, gem_lo)
        s.put(x + 1, 18, gem_lo)
        s.put(x, 16, gem_hi)
    for x in (22, 25, 32, 35):                            # settings along the band
        s.put(x, 17, gold[11])
        s.put(x, 18, gold[5])
    s.shade_band(19, 21, 37, 23, -1)                      # the crown casts on the fur

    # ---- the face -----------------------------------------------------------
    key = {'k': rim, 'g': iris_dark, 'G': iris_light, 'p': pupil,
           'w': spec, 'b': bounce, 't': tear,
           'd': s.ink((26, 74, 58)),          # the rim, a shade off black
           'L': s.ink((186, 240, 186)),       # light pooling at the far side
           'f': s.ink((70, 168, 116)),        # fibres in the iris
           'W': s.ink((214, 240, 246)),       # the catchlight's soft edge
           'l': s.ink((250, 236, 210))}       # wet lower lid
    _cat_eye(s, 22, 27, key, flip=1)
    _cat_eye(s, 34, 27, key, flip=-1)


    # Whiskers live outside the head. Drawn across the cheek fur they turn the
    # whole face into a grey haze; kept to a root mark on the pad and a thin
    # line beyond the silhouette, they read as whiskers at any size.
    s.shade_band(17, 21, 25, 21, -1)                 # the brow ridge, barely there
    s.shade_band(31, 21, 39, 21, -1)
    s.line(17, 32, 24, 32, cream[9])                 # cream fur seating them
    s.line(32, 32, 39, 32, cream[9])
    for dy, spread, bend in ((-2, -7, -1.1), (1, 1, 0.3), (4, 7, 1.4)):
        s.taper_line(11, 31 + dy, 0, 29 + spread, whisk, whisk_far, bend)
        s.taper_line(45, 31 + dy, 55, 29 + spread, whisk, whisk_far, bend)

    s.soften_edges(coat)
    s.soften_edges(cream)
    s.finish()
    s.antialias_outline()
    return s.emit()


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
