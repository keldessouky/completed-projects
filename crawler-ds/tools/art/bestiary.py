"""The things the floors send at you.

Each one is built for its silhouette first — you should know what it is from the
shape alone at 72 pixels, before the palette or the face arrives — and lit by
the same key light as the party so the whole cast belongs to one game.
"""
from forge_tools import Sprite

FOE = 72
BOSS = 96


def sewer_rat():
    """Floor one's welcome: bigger than it should be, and better fed than you."""
    s = Sprite(FOE, FOE)
    fur = s.register_family(s.ramp((116, 106, 100), 6))
    belly = s.register_family(s.ramp((156, 146, 138), 5))
    skin = s.register_family(s.ramp((208, 152, 150), 5))
    dark = s.ink((28, 24, 26))
    white = s.ink((246, 244, 236))

    s.limb(56, 46, 70, 30, 7, 3, skin)               # tail, whipping up
    s.limb(46, 50, 58, 46, 9, 7, fur)
    s.form(38, 46, 20, 15, fur, wrap=0.85)           # body
    s.form(36, 52, 14, 8, belly, wrap=0.7)           # belly
    for x, y in ((24, 58), (34, 60), (46, 59), (55, 56)):    # four feet
        s.limb(x + 2, 52, x, y, 7, 5, fur)
        s.form(x, y + 2, 4, 3, skin, squash=0.5)
        for k in range(3):
            s.put(x - 2 + k * 2, y + 4, skin[4])

    s.form(18, 36, 12, 11, fur, wrap=0.85)           # head
    s.poly([(10, 30), (4, 16), (18, 26)], fur[2])    # ears
    s.poly([(26, 28), (30, 15), (34, 28)], fur[2])
    s.poly([(9, 28), (6, 19), (15, 26)], skin[3])
    s.poly([(27, 27), (29, 18), (32, 27)], skin[3])
    s.poly([(12, 38), (2, 42), (12, 46)], fur[1])    # snout
    s.form(4, 42, 3, 3, skin, wrap=0.7)              # nose
    s.put(3, 41, skin[4])
    s.stamp(5, 29, [
        "..ddd......ddd..",
        ".dwwwd....dwwwd.",
        ".dwppd....dwppd.",
        ".dwppd....dwppd.",
        "..ddd......ddd..",
    ], {'d': fur[0], 'w': white, 'p': dark})
    s.put(7, 31, s.ink((240, 120, 120)))             # a red catch in the eye
    s.put(18, 31, s.ink((240, 120, 120)))
    s.rect(4, 45, 9, 47, white)                      # incisors
    s.put(6, 48, white); s.put(8, 48, white)
    s.line(6, 44, 0, 40, s.ink((230, 226, 214)))     # whiskers
    s.line(6, 45, 0, 48, s.ink((230, 226, 214)))
    s.line(8, 46, 4, 52, s.ink((230, 226, 214)))
    for i, (x, y) in enumerate(((30, 34), (40, 32), (50, 36), (44, 44), (28, 44))):
        s.put(x, y, fur[1] if i % 2 else fur[4])     # matted fur
    return s.finish().stage(s.w, s.h, ground=None).emit()


def goblin_trapper():
    """The first thing most crawlers meet, so the first thing that has to not
    look like a smudge. Hand-placed from `goblin_grid`, fifteen colours, same
    method as the crawler roster."""
    import goblin_grid as gg

    s = Sprite(gg.W, gg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(gg.KEY, gg.PALETTE)}
    for y, row in enumerate(gg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * gg.W + x] = idx[ch]
    return s.stage(s.w, s.h, ground=None).emit()

def screaming_sofa():
    """Floor one keeps sending furniture. Nobody has explained why."""
    s = Sprite(FOE, FOE)
    cloth = s.register_family(s.ramp((156, 72, 60), 6))
    wood = s.register_family(s.ramp((104, 70, 46), 5))
    dark = s.ink((26, 10, 14))
    tooth = s.register_family(s.ramp((238, 234, 220), 4))
    spring = s.register_family(s.ramp((172, 176, 188), 4, warm=0.1))

    s.rect(10, 56, 62, 64, wood[1])                  # frame under the seat
    s.form(14, 66, 5, 5, wood, squash=0.4)           # feet
    s.form(58, 66, 5, 5, wood, squash=0.4)
    s.poly([(4, 26), (18, 22), (18, 58), (4, 58)], cloth[2])   # arms of the sofa
    s.poly([(68, 26), (54, 22), (54, 58), (68, 58)], cloth[1])
    s.form(9, 26, 6, 5, cloth, wrap=0.8)
    s.form(63, 26, 6, 5, cloth, wrap=0.8)
    s.poly([(16, 18), (56, 18), (58, 40), (14, 40)], cloth[3])  # back cushions
    s.line(36, 19, 36, 39, cloth[1])
    s.rect(14, 40, 58, 58, cloth[2])                 # seat
    s.line(14, 44, 58, 44, cloth[1])

    # The mouth: a split seat cushion with springs for teeth.
    s.poly([(20, 40), (52, 40), (46, 60), (26, 60)], dark)
    for i, x in enumerate(range(22, 50, 6)):
        s.poly([(x, 41), (x + 4, 41), (x + 2, 48)], tooth[2])
        s.poly([(x + 2, 59), (x + 6, 59), (x + 4, 53)], tooth[1])
    for x, y in ((28, 50), (40, 52)):                # springs
        for k in range(3):
            s.line(x, y + k * 2, x + 6, y + k * 2 + 1, spring[2 - k % 2])

    s.stamp(16, 22, [
        "ddddd..........ddddd",
        "dwwwwd........dwwwwd",
        "dwppwd........dwppwd",
        "dwppwd........dwppwd",
        ".dwwd..........dwwd.",
        "..dd............dd..",
    ], {'d': cloth[0], 'w': tooth[3], 'p': s.ink((20, 18, 24))})
    s.put(19, 24, s.ink((250, 250, 250)))
    s.put(53, 24, s.ink((250, 250, 250)))
    for x, y in ((22, 46), (48, 47), (30, 34), (44, 33)):        # stains
        s.put(x, y, cloth[0])
        s.put(x + 1, y + 1, cloth[1])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def sludge_mound():
    """Wet, patient, faintly sweet."""
    s = Sprite(FOE, FOE)
    goo = s.register_family(s.ramp((88, 182, 128), 6, dark=0.68))
    deep = s.register_family(s.ramp((44, 118, 92), 5))
    dark = s.ink((14, 38, 30))
    shine = s.ink((226, 255, 240))
    bone = s.register_family(s.ramp((222, 214, 190), 4))

    s.form(36, 50, 28, 19, goo, wrap=0.75)           # the mass
    s.form(28, 34, 16, 14, goo, wrap=0.7)            # the head end
    for x, r in ((10, 5), (22, 7), (46, 6), (60, 4)):            # it is spreading
        s.form(x, 66 - r, r + 2, r, goo, squash=0.5)
    s.form(30, 36, 10, 8, deep, wrap=0.6)            # something dissolving inside
    s.poly([(26, 34), (34, 33), (33, 40), (27, 41)], bone[2])
    s.put(28, 36, bone[0]); s.put(31, 38, bone[0])

    for i, (x, y) in enumerate(((52, 34), (58, 44), (16, 26), (44, 22))):   # drips
        s.form(x, y, 3 + i % 2, 4 + i % 2, goo, wrap=0.7)
        s.put(x, y + 5 + i % 2, goo[3])
    s.stamp(18, 26, [
        "..pppp......pppp..",
        ".pppppp....pppppp.",
        ".ppwppp....ppwppp.",
        ".pppppp....pppppp.",
        "..pppp......pppp..",
    ], {'p': dark, 'w': shine})
    for x, y in ((22, 44), (40, 40), (52, 52), (30, 58)):        # highlights on the skin
        s.put(x, y, goo[5])
        s.put(x + 1, y, goo[4])
    s.line(14, 48, 20, 46, goo[5])
    s.line(50, 60, 58, 58, goo[5])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def rot_sticker():
    """Floor one's nastiest surprise: a thing that adheres to whatever walks
    past and then goes off. Hand-placed from `rotsticker_grid`."""
    import rotsticker_grid as rg

    s = Sprite(rg.W, rg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(rg.KEY, rg.PALETTE)}
    for y, row in enumerate(rg.decorate(rg.grid())):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * rg.W + x] = idx[ch]
    return s.stage(s.w, s.h, ground=None).emit()


def troglodyte():
    """Head and torso of a Komodo dragon on long bent kangaroo legs.

    Redrawn. It was an upright grey humanoid, which made it the fourth
    interchangeable biped on a roster that already had too many -- and it was
    wrong besides: the book is specific that the scaly legs are long and
    deeply bent and that the thing is emphatically not a person. Drawn with the
    hock high and the shin raked forward, with a tail out behind as a
    counterweight, it is the one creature here shaped like that.
    """
    s = Sprite(FOE, FOE)
    hide = s.register_family(s.ramp((104, 122, 86), 6))
    belly = s.register_family(s.ramp((168, 172, 132), 5))
    cloth = s.register_family(s.ramp((150, 130, 96), 4))
    claw = s.register_family(s.ramp((214, 206, 180), 4))
    dark = s.ink((22, 26, 20))
    tongue = s.ink((198, 96, 116))

    #  Tail first: long, thick at the root, out behind and low. It is what
    #  stops the forward lean reading as a fall.
    s.limb(40, 46, 68, 60, 13, 4, hide)
    s.limb(60, 56, 70, 66, 6, 3, hide)

    #  The legs. Thigh down and forward, shin raked back up, foot long and flat
    #  on the ground -- the hock sits high, which is the whole read.
    for hx, foot in ((26, 12), (38, 22)):
        s.limb(hx + 4, 44, hx - 4, 56, 14, 10, hide)     # thigh, forward
        s.limb(hx - 4, 56, hx + 6, 64, 10, 7, hide)      # shin, raked back
        s.poly([(hx + 2, 64), (hx + foot, 64), (hx + foot + 2, 69),
                (hx, 69)], hide[2])                      # the long foot
        for t in range(3):
            s.put(hx + foot + 1, 66 + t, claw[3])

    #  Torso, pitched forward over the hips rather than stacked above them.
    s.form(38, 38, 15, 14, hide, wrap=0.95)
    s.form(38, 42, 10, 9, belly, wrap=0.8)
    for y in range(34, 48, 3):
        s.line(31, y, 45, y, belly[1])
    s.poly([(28, 44), (50, 44), (48, 54), (30, 54)], cloth[2])   # loincloth
    s.line(28, 46, 50, 46, cloth[0])

    #  Arms, short and hanging forward off the chest.
    s.limb(30, 34, 22, 48, 8, 6, hide)
    s.limb(46, 33, 54, 46, 8, 6, hide)
    for x, y in ((21, 49), (55, 47)):
        s.form(x, y, 4, 4, hide, wrap=0.9)
        for t in range(3):
            s.put(x - 2 + t * 2, y + 4, claw[2])

    #  The head: long and low on a thick neck, carried out in front, not up.
    s.limb(38, 30, 22, 22, 11, 9, hide)
    s.poly([(6, 20), (24, 16), (26, 26), (8, 28)], hide[3])      # the snout
    s.poly([(6, 20), (24, 16), (24, 19), (7, 23)], hide[4])
    s.rect(6, 24, 24, 26, dark)                                  # the mouth line
    for i, x in enumerate(range(8, 24, 4)):
        s.poly([(x, 24), (x + 3, 24), (x + 1, 21)], claw[3])
    s.line(4, 26, 12, 27, tongue)                                # tongue, out
    s.put(16, 20, dark)                                          # the eye, small
    s.put(15, 20, s.ink((236, 232, 212)))
    for x, y in ((20, 14), (28, 13), (34, 15)):                  # dorsal ridge
        s.poly([(x, y), (x + 4, y - 1), (x + 3, y + 4)], hide[1])
    for x, y in ((44, 36), (34, 50), (52, 40)):                  # mottling
        s.form(x, y, 4, 3, hide[0:1] * 3, squash=0.6)
    return s.finish().stage(s.w, s.h, ground=None).emit()


def kobold_sapper():
    """Carrying something with a fuse, and pleased about it."""
    s = Sprite(FOE, FOE)
    scale = s.register_family(s.ramp((190, 112, 56), 6))
    belly = s.register_family(s.ramp((234, 190, 130), 5))
    horn = s.register_family(s.ramp((228, 214, 186), 5))
    leather = s.register_family(s.ramp((96, 66, 44), 5))
    dark = s.ink((28, 20, 18))
    white = s.ink((248, 244, 232))
    spark = s.ink((255, 232, 140))

    s.limb(30, 52, 26, 66, 11, 8, scale)             # legs
    s.limb(42, 52, 46, 66, 11, 8, scale)
    s.poly([(20, 68), (32, 68), (30, 71), (18, 71)], scale[1])   # splayed feet
    s.poly([(40, 68), (52, 68), (54, 71), (42, 71)], scale[1])
    s.limb(48, 44, 62, 52, 8, 5, scale)              # tail
    s.form(36, 44, 14, 15, scale, wrap=0.85)         # body
    s.form(36, 48, 9, 10, belly, wrap=0.7)
    for y in range(42, 56, 3):                       # belly scutes
        s.line(30, y, 42, y, belly[1])
    s.poly([(22, 40), (50, 40), (52, 46), (20, 46)], leather[2])  # satchel strap
    s.limb(24, 36, 16, 48, 9, 7, scale)              # arms
    s.limb(48, 36, 56, 44, 9, 7, scale)
    s.form(15, 50, 4, 4, scale)

    s.form(36, 24, 13, 12, scale, wrap=0.85)         # head
    s.poly([(28, 30), (44, 30), (40, 42), (32, 42)], scale[1])    # snout
    s.poly([(30, 36), (42, 36), (41, 41), (31, 41)], belly[3])
    s.poly([(26, 14), (18, 0), (32, 12)], horn[2])   # horns
    s.poly([(46, 14), (54, 0), (40, 12)], horn[2])
    s.line(20, 3, 27, 13, horn[4])
    s.stamp(26, 18, [
        ".ddd.....ddd.",
        "dwwwd...dwwwd",
        "dwrpd...dwrpd",
        ".dppd...dppd.",
        "..dd.....dd..",
    ], {'d': scale[1], 'w': white, 'p': dark, 'r': s.ink((222, 70, 40))})
    s.rect(32, 39, 33, 41, white)                    # teeth
    s.rect(38, 39, 39, 41, white)
    s.put(35, 34, dark); s.put(37, 34, dark)         # nostrils

    s.line(58, 46, 62, 22, leather[2], 3)            # the thing with the fuse
    s.form(60, 18, 6, 6, s.register_family(s.ramp((196, 74, 46), 5)))
    s.line(62, 12, 66, 4, s.ink((150, 130, 100)))
    s.put(66, 3, spark); s.put(67, 2, spark); s.put(65, 1, s.ink((255, 190, 90)))
    return s.finish().stage(s.w, s.h, ground=None).emit()


def bramble_hound():
    """It was a dog. The floor improved it."""
    s = Sprite(FOE, FOE)
    bark = s.register_family(s.ramp((96, 74, 50), 6))
    thorn = s.register_family(s.ramp((188, 176, 148), 5))
    leaf = s.register_family(s.ramp((88, 146, 72), 5))
    ember = s.ink((252, 176, 48))
    dark = s.ink((22, 18, 14))

    s.limb(52, 46, 66, 34, 8, 4, bark)               # tail, a whip of bramble
    s.form(40, 46, 19, 14, bark, wrap=0.8)           # body
    for x, y in ((26, 58), (36, 60), (48, 59), (58, 56)):        # legs
        s.limb(x + 2, 52, x, y, 8, 6, bark)
        s.form(x, y + 3, 5, 3, bark, squash=0.5)
    s.form(18, 38, 12, 11, bark, wrap=0.8)           # head
    s.poly([(10, 32), (6, 18), (18, 28)], bark[3])   # ears
    s.poly([(24, 30), (30, 18), (30, 32)], bark[3])
    s.poly([(12, 40), (2, 44), (12, 48)], bark[1])   # muzzle
    s.put(4, 43, dark); s.put(5, 45, dark)

    # The ridge is bramble, not candles: dark wood with pale tips, at heights
    # that do not repeat.
    for i, (dx, height) in enumerate(((0, 9), (4, 5), (7, 12), (12, 7), (16, 10),
                                      (21, 6), (25, 11), (30, 8), (34, 5))):
        x = 22 + dx
        y = 36 + (i % 2) * 2
        s.poly([(x, y + 3), (x + 2, y - height), (x + 4, y + 3)], bark[1])
        s.line(x + 2, y - height, x + 2, y - height + 3, thorn[2])
        s.put(x + 2, y - height - 1, thorn[4])
        if i % 3 == 1:
            s.poly([(x - 2, y + 1), (x + 1, y - 4), (x + 4, y + 1)], leaf[1])
    for x, y in ((28, 52), (44, 54), (54, 50)):      # thorns along the flank
        s.poly([(x, y), (x + 4, y + 1), (x, y + 4)], thorn[1])

    s.stamp(8, 34, [
        "ddd....ddd",
        "deed...deed",
        "dedd...dedd",
        ".dd.....dd.",
    ], {'d': bark[0], 'e': ember})
    s.rect(3, 46, 9, 47, s.ink((238, 234, 220)))     # a line of teeth
    s.put(5, 48, s.ink((238, 234, 220)))
    for x, y in ((32, 44), (48, 42), (40, 50)):      # bark grain
        s.line(x, y, x + 5, y + 1, bark[1])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def doom_beetle():
    """Armoured, unbothered, extremely purple."""
    s = Sprite(FOE, FOE)
    shell = s.register_family(s.ramp((84, 66, 148), 6, dark=0.7))
    chitin = s.register_family(s.ramp((46, 38, 78), 5))
    gloss = s.ink((198, 184, 255))
    amber = s.ink((250, 216, 88))
    dark = s.ink((16, 14, 26))

    for i, y in enumerate((38, 48, 58)):             # six legs, jointed
        s.limb(24, y - 4, 10, y + 4 - i * 2, 6, 4, chitin)
        s.limb(48, y - 4, 62, y + 4 - i * 2, 6, 4, chitin)
        s.form(9, y + 5 - i * 2, 3, 2, chitin, squash=0.6)
        s.form(63, y + 5 - i * 2, 3, 2, chitin, squash=0.6)

    s.form(36, 44, 22, 19, shell, wrap=0.75)         # carapace
    s.line(36, 26, 36, 62, chitin[1], 2)             # the seam down the back
    for i, (x, y, r) in enumerate(((26, 38, 4), (46, 40, 5), (30, 52, 3), (44, 54, 4))):
        s.form(x, y, r, r - 1, shell, wrap=0.6)      # plate bosses
        s.put(x - 1, y - 1, gloss)
    s.form(36, 22, 12, 10, chitin, wrap=0.8)         # head
    s.poly([(28, 16), (16, 4), (30, 14)], chitin[2]) # mandibles
    s.poly([(44, 16), (56, 4), (42, 14)], chitin[2])
    s.line(18, 6, 29, 15, chitin[4])
    s.line(54, 6, 43, 15, chitin[1])
    s.line(30, 12, 26, 2, chitin[3])                 # antennae
    s.line(42, 12, 46, 2, chitin[3])
    s.stamp(28, 18, [
        ".aa....aa.",
        "aappa..appa",
        ".aa....aa.",
    ], {'a': amber, 'p': dark})
    s.rect(33, 26, 39, 27, dark)                     # jaw line
    return s.finish().stage(s.w, s.h, ground=None).emit()


def bone_bailiff():
    """It has a warrant. It will not show you."""
    s = Sprite(FOE, FOE)
    bone = s.register_family(s.ramp((216, 210, 190), 5, dark=0.62))
    robe = s.register_family(s.ramp((46, 52, 88), 6))
    trim = s.register_family(s.ramp((198, 158, 66), 5))
    wood = s.register_family(s.ramp((116, 82, 48), 5))
    dark = s.ink((14, 14, 20))
    fire = s.ink((252, 140, 60))

    s.poly([(20, 26), (52, 26), (60, 70), (12, 70)], robe[2])    # the robe
    s.poly([(20, 26), (36, 30), (36, 70), (12, 70)], robe[3])
    for x in range(16, 58, 6):                                   # folds
        s.line(x, 34, x - 2, 70, robe[1] if x % 4 else robe[4])
    s.rect(18, 40, 54, 45, trim[2])                              # sash of office
    s.rect(18, 40, 54, 41, trim[3])
    s.rect(18, 45, 54, 46, trim[0])
    s.limb(22, 32, 12, 50, 8, 6, robe)                           # sleeves
    s.limb(50, 32, 60, 48, 8, 6, robe)
    s.form(11, 52, 4, 4, bone)                                   # skeletal hands
    s.form(61, 50, 4, 4, bone)

    s.line(60, 8, 58, 62, wood[2], 3)                            # gavel-staff
    s.rect(52, 6, 68, 14, wood[3])
    s.rect(52, 6, 68, 7, wood[4])
    s.rect(52, 13, 68, 14, wood[0])
    s.rect(57, 4, 63, 6, trim[3])

    s.form(36, 18, 11, 12, bone, wrap=0.85)                      # skull
    s.poly([(26, 22), (46, 22), (44, 32), (28, 32)], bone[2])    # jaw
    s.line(28, 28, 44, 28, bone[0])
    for x in range(29, 44, 3):
        s.line(x, 28, x, 32, bone[0])
    s.stamp(28, 13, [
        "ppppp..ppppp",
        "pppfp..pfppp",
        "pppppp.pppp.",
        ".ppp....ppp.",
    ], {'p': dark, 'f': fire})
    s.rect(35, 20, 37, 24, dark)                                 # nasal cavity
    s.put(36, 19, bone[1])
    s.line(30, 12, 42, 12, bone[4])                              # cranial highlight
    return s.finish().stage(s.w, s.h, ground=None).emit()


def neon_mimic():
    """A loot box with opinions.

    Redrawn because it and the Screaming Sofa were the same silhouette -- a
    wide rectangle with a row of triangles across the middle -- in two
    palettes, which at 72 pixels is one creature shown twice. The concept was
    never the problem; the pose was. This one has got up on its legs and is
    coming at you, and the lid is hinged right back so the outline is a gaping
    wedge rather than a box. A sofa sits. A mimic chases.
    """
    s = Sprite(FOE, FOE)
    box = s.register_family(s.ramp((62, 148, 200), 6))
    trim = s.register_family(s.ramp((250, 206, 78), 5))
    tongue = s.register_family(s.ramp((196, 62, 96), 5))
    tooth = s.register_family(s.ramp((240, 240, 232), 4))
    dark = s.ink((18, 10, 22))
    glow = s.ink((156, 244, 255))
    leg = s.register_family(s.ramp((40, 44, 70), 4))

    #  Two stubby legs under it, mid-stride, so it reads as moving.
    s.limb(24, 52, 20, 68, 9, 7, leg)
    s.limb(48, 52, 55, 66, 9, 7, leg)
    s.form(19, 68, 6, 4, leg, squash=0.5)
    s.form(56, 66, 6, 4, leg, squash=0.5)

    #  The lower half: the chest itself, tipped forward onto its front edge.
    s.poly([(12, 40), (60, 36), (56, 60), (16, 62)], box[2])
    s.poly([(12, 40), (20, 39), (18, 62), (16, 62)], box[4])
    s.poly([(54, 37), (60, 36), (56, 60), (52, 60)], box[0])
    s.rect(30, 38, 42, 61, trim[2])                  # the strap, over the front
    s.poly([(12, 40), (60, 36), (60, 33), (12, 37)], trim[1])    # the rim it bites with
    for x in (14, 57):                               # corner fittings
        s.rect(x - 2, 40, x + 2, 47, trim[1])
        s.rect(x - 2, 54, x + 2, 60, trim[1])

    #  The lid, hinged all the way back and up. This is the whole silhouette:
    #  the gape between it and the body is a wedge, not a slot.
    s.poly([(14, 34), (58, 30), (66, 8), (24, 10)], box[1])
    s.poly([(14, 34), (22, 33), (30, 10), (24, 10)], box[3])
    s.poly([(24, 10), (66, 8), (64, 4), (26, 6)], trim[3])       # its far edge
    s.rect(38, 12, 50, 32, trim[1])                              # strap continues
    s.line(14, 34, 58, 30, glow)                                 # the seam glows
    for i in range(5):
        s.put(18 + i * 10, 33 - i // 2, s.ink((255, 255, 255)))

    #  Teeth on both rims, meeting at the hinge. Uneven, and longer at the
    #  front where the bite lands.
    s.poly([(14, 34), (58, 30), (56, 40), (16, 42)], dark)
    for i, x in enumerate(range(17, 56, 7)):
        drop = 10 - i
        s.poly([(x, 34 - i // 2), (x + 5, 34 - i // 2), (x + 2, 34 + drop)], tooth[3 if i % 2 else 2])
    for i, x in enumerate(range(20, 54, 7)):
        rise = 9 - i
        s.poly([(x, 41), (x + 5, 41), (x + 2, 41 - rise)], tooth[1])
    s.form(34, 42, 9, 4, tongue, wrap=0.7)                       # tongue, out the front
    s.form(31, 47, 5, 4, tongue, wrap=0.7)
    s.line(34, 40, 33, 49, tongue[0])

    #  Eyes up on the lid, looking down the length of itself at you.
    s.stamp(28, 16, [
        "ppppp........ppppp",
        "pmmmpp......pmmmpp",
        "pmwwmp......pmwwmp",
        "pmmmmp......pmmmmp",
        ".pppp........pppp.",
    ], {'p': dark, 'm': s.ink((250, 92, 172)), 'w': s.ink((255, 220, 245))})
    return s.finish().stage(s.w, s.h, ground=None).emit()


def club_bouncer():
    """You are not on the list."""
    s = Sprite(FOE, FOE)
    hide = s.register_family(s.ramp((146, 114, 84), 6))
    suit = s.register_family(s.ramp((38, 40, 58), 6))
    shirt = s.register_family(s.ramp((226, 222, 210), 5))
    tie = s.register_family(s.ramp((158, 30, 52), 5))
    dark = s.ink((16, 16, 22))
    neon = s.ink((252, 74, 168))

    s.limb(28, 56, 26, 70, 13, 11, suit)             # legs like bollards
    s.limb(46, 56, 48, 70, 13, 11, suit)
    s.form(36, 44, 22, 18, suit, wrap=0.8)           # the slab
    s.poly([(28, 26), (44, 26), (46, 60), (26, 60)], shirt[3])   # shirt
    s.poly([(26, 26), (36, 44), (30, 60)], suit[2])              # lapels
    s.poly([(46, 26), (36, 44), (42, 60)], suit[1])
    s.rect(33, 27, 39, 33, tie[2])                               # tie
    s.poly([(33, 33), (39, 33), (36, 48)], tie[1])
    s.limb(18, 34, 10, 58, 12, 9, suit)                          # arms
    s.limb(54, 34, 62, 58, 12, 9, suit)
    s.form(10, 60, 5, 4, hide)
    s.form(62, 60, 5, 4, hide)
    s.rect(50, 40, 60, 50, dark)                                 # the club pass
    s.rect(52, 42, 58, 48, neon)
    s.put(54, 44, s.ink((255, 210, 240)))

    s.form(36, 18, 13, 11, hide, wrap=0.85)                      # head, no neck
    s.rect(24, 6, 48, 10, hide[1])                               # flat top
    s.form(36, 7, 12, 4, hide, squash=0.4)
    s.stamp(22, 15, [
        "dddddddddddddddddddddddddddd",
        "dppppppddddddddddppppppd....",
        "dpwppppddddddddddppppwpd....",
        "dppppppddddddddddppppppd....",
        ".dddddd..........dddddd.....",
    ], {'d': dark, 'p': s.ink((26, 26, 34)), 'w': s.ink((150, 220, 240))})
    s.rect(30, 26, 42, 27, s.ink((104, 76, 56)))                 # a mouth, closed
    s.put(29, 24, hide[1]); s.put(43, 24, hide[1])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def vulture_fan():
    """Here for the highlights. Yours."""
    s = Sprite(FOE, FOE)
    feather = s.register_family(s.ramp((74, 70, 82), 6))
    skinny = s.register_family(s.ramp((214, 158, 132), 5))
    beak = s.register_family(s.ramp((238, 190, 74), 5))
    ruffle = s.register_family(s.ramp((238, 236, 228), 4))
    dark = s.ink((18, 16, 22))

    s.limb(30, 58, 28, 68, 7, 5, skinny)             # legs
    s.limb(42, 58, 44, 68, 7, 5, skinny)
    for x in (28, 44):
        for k in (-3, 0, 3):
            s.line(x, 69, x + k, 71, skinny[1])
    s.form(36, 46, 18, 16, feather, wrap=0.8)        # body
    s.poly([(20, 32), (2, 52), (14, 60), (24, 50)], feather[1])  # wings, folded
    s.poly([(52, 32), (70, 52), (58, 60), (48, 50)], feather[3])
    for i in range(5):                               # flight feathers
        s.line(6 + i * 3, 52 + i, 20 + i * 2, 40 + i * 3, feather[0])
        s.line(66 - i * 3, 52 + i, 52 - i * 2, 40 + i * 3, feather[0])
    s.form(36, 34, 12, 7, ruffle, wrap=0.7)          # the collar of down
    for i in range(9):
        s.put(26 + i * 2, 31 + (i % 3), ruffle[3])

    s.limb(34, 30, 34, 18, 9, 7, skinny)             # bare neck
    for y in range(20, 30, 3):
        s.line(30, y, 38, y, skinny[1])
    s.form(34, 14, 9, 8, feather, wrap=0.85)         # head
    s.poly([(34, 10), (54, 15), (34, 20)], beak[2])  # beak
    s.line(36, 15, 52, 15, beak[4])
    s.poly([(38, 16), (50, 16), (38, 20)], beak[1])
    s.stamp(28, 10, [
        ".ddd..",
        "dwwwd.",
        "dwppd.",
        ".ddd..",
    ], {'d': feather[0], 'w': s.ink((250, 248, 240)), 'p': dark})
    s.put(30, 12, s.ink((230, 90, 70)))
    for i in range(4):                               # a wattle
        s.put(33 + i % 2, 21 + i, skinny[1])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def boss_ratking():
    """Six rats, one crown, one shared and very bad idea."""
    s = Sprite(BOSS, BOSS)
    fur = s.register_family(s.ramp((124, 110, 100), 6))
    belly = s.register_family(s.ramp((162, 150, 140), 5))
    skin = s.register_family(s.ramp((212, 156, 152), 5))
    gold = s.register_family(s.ramp((250, 202, 66), 5))
    dark = s.ink((26, 22, 24))
    white = s.ink((246, 244, 236))
    red = s.ink((238, 74, 68))

    for i in range(7):                               # the knot of tails
        s.limb(70 + i, 74, 92 - i * 2, 52 - i * 5, 7, 3, skin)
        s.limb(26 - i, 76, 4 + i * 2, 56 - i * 5, 7, 3, skin)
    s.form(48, 66, 36, 24, fur, wrap=0.8)            # the shared mass
    s.form(48, 72, 26, 14, belly, wrap=0.7)
    for i, (x, y) in enumerate(((22, 60), (36, 76), (58, 78), (74, 62), (48, 58))):
        s.form(x, y, 9, 7, fur, wrap=0.7)            # lumps of rat under the fur
        s.put(x - 2, y - 2, fur[4] if i % 2 else fur[1])

    heads = ((18, 44, 11), (36, 32, 12), (60, 30, 12), (78, 46, 11),
             (28, 58, 10), (68, 60, 10))
    for i, (x, y, r) in enumerate(heads):
        for a in range(0, 360, 5):                   # a dark gap per head
            import math
            s.put(x + (r + 1.4) * math.cos(math.radians(a)),
                  y + (r + 1.4) * math.sin(math.radians(a)), dark)
    for i, (x, y, r) in enumerate(heads):
        s.poly([(x - r + 1, y - r + 3), (x - r - 5, y - r - 8), (x - 2, y - r + 1)], fur[2])
        s.poly([(x + r - 1, y - r + 3), (x + r + 5, y - r - 8), (x + 2, y - r + 1)], fur[2])
        s.poly([(x - r + 1, y - r + 3), (x - r - 3, y - r - 5), (x - 3, y - r + 1)], skin[3])
        s.poly([(x + r - 1, y - r + 3), (x + r + 3, y - r - 5), (x + 3, y - r + 1)], skin[3])
        s.form(x, y, r, r - 1, fur, wrap=0.85)
        s.poly([(x - 4, y + 2), (x + 4, y + 2), (x, y + r)], fur[1])      # snout
        s.form(x, y + r - 1, 2, 2, skin, wrap=0.6)
        s.stamp(x - 7, y - 4, [
            "ddd..ddd",
            "dwpd.dwpd",
            "ddd..ddd",
        ], {'d': fur[0], 'w': white, 'p': dark})
        s.put(x - 5, y - 3, red)
        s.put(x + 3, y - 3, red)
        s.rect(x - 2, y + r - 1, x + 2, y + r, white)                     # teeth
        s.line(x - 5, y + 2, x - 12, y - 1, s.ink((228, 224, 212)))       # whiskers
        s.line(x + 5, y + 2, x + 12, y - 1, s.ink((228, 224, 212)))

    s.poly([(32, 22), (39, 4), (48, 18), (57, 4), (64, 22)], gold[2])     # the crown
    s.rect(32, 20, 64, 25, gold[3])
    s.rect(32, 25, 64, 26, gold[0])
    s.line(33, 21, 63, 21, gold[4])
    s.put(39, 7, s.ink((238, 96, 150)))
    s.put(48, 5, s.ink((124, 214, 250)))
    s.put(57, 7, s.ink((238, 96, 150)))
    for x in (36, 48, 60):
        s.put(x, 23, gold[4])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def boss_foreman():
    """Management has come down to the floor."""
    s = Sprite(BOSS, BOSS)
    skin = s.register_family(s.ramp((150, 98, 72), 6))
    denim = s.register_family(s.ramp((52, 72, 124), 6))
    vis = s.register_family(s.ramp((216, 232, 74), 5))
    steel = s.register_family(s.ramp((176, 182, 196), 5, warm=0.08))
    hat = s.register_family(s.ramp((248, 174, 40), 5))
    board = s.register_family(s.ramp((222, 212, 186), 4))
    dark = s.ink((22, 20, 24))
    white = s.ink((248, 246, 238))

    s.limb(38, 70, 34, 92, 18, 15, denim)            # legs
    s.limb(60, 70, 64, 92, 18, 15, denim)
    s.rect(26, 90, 44, 95, s.ink((44, 38, 40)))      # boots
    s.rect(54, 90, 72, 95, s.ink((44, 38, 40)))
    s.form(49, 56, 26, 24, denim, wrap=0.8)          # torso
    s.poly([(30, 36), (68, 36), (72, 76), (26, 76)], denim[2])
    s.poly([(38, 36), (60, 36), (60, 76), (38, 76)], vis[2])     # hi-vis vest
    s.rect(38, 48, 60, 53, s.ink((226, 232, 240)))               # reflective bands
    s.rect(38, 60, 60, 65, s.ink((226, 232, 240)))
    s.line(49, 36, 49, 76, vis[1])
    s.limb(30, 40, 16, 66, 15, 11, skin)             # arms
    s.limb(68, 40, 82, 62, 15, 11, skin)
    s.form(14, 68, 6, 5, skin)

    s.rect(2, 60, 30, 72, steel[3])                  # a very large wrench
    s.rect(2, 56, 14, 76, steel[2])
    s.rect(4, 62, 10, 70, dark)
    s.line(16, 62, 30, 62, steel[4])
    s.rect(70, 58, 92, 88, board[2])                 # clipboard
    s.rect(70, 58, 92, 62, steel[2])
    for y in range(66, 86, 5):
        s.rect(74, y, 88, y + 1, s.ink((96, 96, 108)))

    s.form(49, 26, 15, 14, skin, wrap=0.85)          # head
    s.poly([(34, 22), (64, 22), (60, 40), (38, 40)], skin[2])
    s.stamp(36, 22, [
        "dddddd....dddddd",
        "dwwwwd....dwwwwd",
        "dwppwd....dwppwd",
        ".dwwd......dwwd.",
        "..dd........dd..",
    ], {'d': skin[1], 'w': white, 'p': dark})
    s.rect(46, 32, 52, 34, skin[1])                  # nose
    s.rect(42, 38, 56, 40, s.ink((110, 58, 52)))     # a mouth mid-sentence
    s.rect(44, 40, 54, 41, dark)
    for x in range(38, 62, 3):                       # stubble
        s.put(x, 43, s.ink((92, 64, 56)))
    s.form(49, 14, 20, 9, hat, wrap=0.8)             # the hard hat
    s.poly([(26, 18), (72, 18), (70, 22), (28, 22)], hat[2])
    s.rect(26, 18, 72, 19, hat[4])
    s.rect(28, 22, 70, 23, hat[0])
    s.line(49, 6, 49, 18, hat[4])                    # the ridge
    s.rect(56, 10, 64, 14, s.ink((40, 40, 48)))      # a sticker
    return s.finish().stage(s.w, s.h, ground=None).emit()


def boss_producer():
    """The show, wearing a person."""
    s = Sprite(BOSS, BOSS)
    suit = s.register_family(s.ramp((38, 24, 56), 6))
    shirt = s.register_family(s.ramp((16, 14, 26), 5))
    neon = s.register_family(s.ramp((250, 62, 158), 5, cool=0.1))
    glass = s.register_family(s.ramp((92, 216, 236), 5))
    steel = s.register_family(s.ramp((150, 146, 178), 5, warm=0.06))
    dark = s.ink((10, 8, 16))

    for i in range(7):                               # cables, holding it up
        x = 8 + i * 13
        s.limb(x, 96, 40 + i * 3, 62, 5, 3, neon if i % 2 else steel)
        s.put(x, 94, neon[4])
    s.form(48, 62, 30, 30, suit, wrap=0.8)           # the body
    s.poly([(20, 34), (48, 26), (76, 34), (80, 84), (16, 84)], suit[2])
    s.poly([(34, 30), (48, 44), (62, 30), (58, 78), (38, 78)], shirt[2])  # shirt
    s.poly([(34, 30), (48, 44), (40, 30)], suit[4])                       # lapels
    s.poly([(62, 30), (48, 44), (56, 30)], suit[1])
    s.poly([(44, 34), (52, 34), (50, 46), (46, 46)], neon[2])             # tie
    s.limb(22, 38, 8, 70, 14, 10, suit)                                   # arms
    s.limb(74, 38, 88, 70, 14, 10, suit)
    s.form(7, 72, 5, 5, steel)
    s.form(89, 72, 5, 5, steel)

    s.rect(24, 46, 72, 52, neon[2])                  # a lit band across the chest
    s.rect(24, 46, 72, 47, neon[4])
    for x in range(28, 70, 6):
        s.put(x, 49, s.ink((255, 220, 245)))

    s.form(48, 22, 17, 16, steel, wrap=0.8)          # the head housing
    s.rect(34, 10, 62, 34, steel[1])
    s.rect(36, 12, 60, 32, glass[1])                 # a screen for a face
    for y in range(12, 33, 2):                       # scanlines
        s.rect(36, y, 60, y, glass[0])
    s.stamp(38, 15, [
        "pppp....pppp",
        "pppp....pppp",
        "............",
        "............",
        "..pppppppp..",
        "..p.p..p.p..",
    ], {'p': dark})
    s.rect(36, 12, 60, 13, glass[4])                 # screen glare
    s.line(38, 14, 44, 14, glass[3])
    # A lighting truss, and his lamps hanging off it. Without the truss the
    # lamps read as two squares floating in the air beside his head.
    s.rect(4, 0, 92, 2, steel[1])
    s.rect(4, 0, 92, 0, steel[3])
    s.rect(4, 3, 92, 3, steel[0])
    for x in range(8, 92, 12):                       # the truss's cross-bracing
        s.line(x, 0, x + 6, 3, steel[2])
        s.line(x + 6, 0, x, 3, steel[0])
    for x in (10, 84):                               # studio lamps, on him
        s.rect(x - 1, 3, x + 1, 5, steel[1])         # the yoke it hangs from
        s.rect(x - 5, 5, x + 5, 13, dark)
        s.rect(x - 3, 7, x + 3, 11, s.ink((255, 246, 210)))
        s.put(x, 9, s.ink((255, 255, 255)))
    return s.finish().stage(s.w, s.h, ground=None).emit()


#  ---------------------------------------------------------------- the block --
#
#  The dungeon did not invent these. It took a floor of somebody's building and
#  a strip of somebody's high street, and it gave them teeth -- which is what
#  makes it frightening in a way a goblin is not, and what the roster was short
#  of. They are also drawn to be told apart by outline alone at seventy-two
#  pixels, which the six upright bipeds already here cannot manage: a tall
#  narrow box, a squat wide one, a fat cylinder, a bare pole, and a box with
#  something swinging off it.

def snack_machine():
    """It ate your change. Now it is hungry."""
    s = Sprite(FOE, FOE)
    shell = s.register_family(s.ramp((188, 62, 58), 6))
    glass = s.register_family(s.ramp((70, 122, 148), 5))
    steel = s.register_family(s.ramp((150, 156, 166), 5))
    lit = s.ink((252, 236, 158))
    dark = s.ink((22, 14, 18))
    tooth = s.register_family(s.ramp((240, 236, 224), 4))

    #  Leaning, because a vending machine that has come off its wall is not
    #  standing straight any more.
    s.poly([(20, 6), (54, 9), (56, 62), (18, 62)], shell[2])     # the cabinet
    s.poly([(20, 6), (26, 7), (24, 62), (18, 62)], shell[4])     # lit edge
    s.poly([(50, 8), (54, 9), (56, 62), (50, 62)], shell[0])
    s.poly([(26, 12), (49, 14), (50, 44), (26, 43)], glass[1])   # the window
    for r in range(3):                                           # rows of stock
        y = 17 + r * 9
        for c in range(4):
            x = 29 + c * 5
            s.rect(x, y, x + 3, y + 5, [lit, shell[3], glass[3], steel[3]][(r + c) % 4])
    s.rect(26, 12, 49, 13, glass[4])
    s.rect(51, 16, 54, 20, steel[3])                             # coin slot
    s.rect(52, 17, 53, 19, dark)

    #  The dispensing tray is the mouth, and it has been widened from inside.
    s.poly([(24, 48), (52, 50), (50, 60), (26, 59)], dark)
    for i, x in enumerate(range(27, 50, 5)):
        s.poly([(x, 49), (x + 4, 49), (x + 2, 55)], tooth[2])
        s.poly([(x + 2, 59), (x + 6, 59), (x + 4, 54)], tooth[1])
    s.rect(20, 62, 56, 65, steel[1])                             # it stands on its own base
    for x, y in ((30, 30), (44, 24), (36, 40)):                  # scuffs
        s.put(x, y, glass[0])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def wheelie_bin():
    """Bins on this floor have opinions about you."""
    s = Sprite(FOE, FOE)
    body = s.register_family(s.ramp((60, 108, 72), 6))
    lid = s.register_family(s.ramp((48, 88, 60), 5))
    rubber = s.register_family(s.ramp((44, 42, 50), 4))
    dark = s.ink((16, 22, 18))
    tooth = s.register_family(s.ramp((226, 224, 210), 4))
    slime = s.register_family(s.ramp((156, 176, 92), 4))

    s.poly([(14, 26), (58, 26), (54, 60), (18, 60)], body[2])    # the tub, tapering
    s.poly([(14, 26), (22, 26), (24, 60), (18, 60)], body[4])
    s.poly([(50, 26), (58, 26), (54, 60), (48, 60)], body[0])
    for x in range(20, 54, 6):                                   # moulded ribs
        s.line(x, 30, x + 1, 58, body[1])
    s.form(22, 62, 6, 6, rubber, wrap=0.7)                       # castors
    s.form(50, 62, 6, 6, rubber, wrap=0.7)

    #  The lid is the jaw. No row of triangles: the sofa already owns that
    #  mouth and so does the snack machine, and three creatures grinning the
    #  same grin is the repetition this whole pass is meant to remove. A bin
    #  bites by hinging, so it is drawn hinged -- thrown back on its pivot,
    #  with the rim of the tub as the lower teeth and the dark of the liner
    #  between them.
    s.poly([(10, 10), (56, 4), (58, 14), (12, 21)], lid[3])      # lid, flung open
    s.poly([(10, 10), (56, 4), (54, 2), (12, 8)], lid[4])
    s.rect(54, 4, 58, 16, lid[1])                                # the hinge side
    s.poly([(16, 24), (56, 24), (50, 44), (22, 44)], dark)       # the liner
    s.poly([(14, 22), (58, 22), (56, 27), (16, 27)], body[4])    # rim, catching light
    for x in (26, 38, 46):                                       # what is in it
        s.form(x, 40, 5, 3, slime, squash=0.5)
    for x in (30, 42):                                           # and what is looking up
        s.form(x, 33, 3, 3, tooth, wrap=0.9)
        s.put(x, 33, dark)
    return s.finish().stage(s.w, s.h, ground=None).emit()


def rusted_boiler():
    """The pressure gauge is in the red. It has been for years."""
    s = Sprite(FOE, FOE)
    iron = s.register_family(s.ramp((132, 108, 86), 6))
    rust = s.register_family(s.ramp((146, 74, 40), 5))
    brass = s.register_family(s.ramp((198, 156, 66), 5))
    steam = s.register_family(s.ramp((198, 206, 214), 4))
    dark = s.ink((24, 16, 14))
    hot = s.ink((252, 170, 70))

    s.form(36, 40, 22, 20, iron, wrap=0.8)                       # the drum
    s.rect(14, 24, 58, 56, iron[2])
    s.form(36, 24, 22, 6, iron, squash=0.5)                      # domed top
    s.form(36, 56, 22, 6, iron, squash=0.5)
    for y in (28, 52):                                           # riveted bands
        s.rect(14, y, 58, y + 3, iron[1])
        for x in range(17, 58, 6): s.put(x, y + 1, iron[4])
    for x, y, r in ((22, 36, 4), (48, 44, 5), (30, 50, 3)):      # rust blooms
        s.form(x, y, r, r, rust, wrap=1.2)

    s.form(36, 38, 8, 8, brass, wrap=0.9)                        # the gauge, its face
    s.form(36, 38, 6, 6, [dark, dark, dark], squash=0.9)
    s.line(36, 38, 41, 34, hot)                                  # needle, in the red
    s.put(36, 38, brass[4])
    #  Pipes low and short. Run up and out from the shoulders they read as
    #  arms, and the whole point of this one is that it is a cylinder among a
    #  roster of boxes and blobs.
    s.line(14, 46, 4, 50, iron[3], thick=4)
    s.line(58, 46, 68, 50, iron[3], thick=4)
    s.form(4, 50, 5, 5, iron, wrap=0.8)
    s.form(68, 50, 5, 5, iron, wrap=0.8)
    s.form(36, 20, 7, 4, iron, squash=0.5)                       # a stack, on top
    s.rect(33, 12, 39, 22, iron[2])
    s.rect(33, 12, 35, 22, iron[4])
    for i, (x, y) in enumerate(((36, 8), (33, 3), (40, 4))):     # steam, going up
        s.form(x, y, 5 - i, 3, steam, squash=0.6)
    s.rect(24, 58, 30, 66, iron[1])                              # stubby legs
    s.rect(42, 58, 48, 66, iron[1])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def parking_meter():
    """Your time expired before you arrived."""
    s = Sprite(FOE, FOE)
    post = s.register_family(s.ramp((104, 110, 118), 5))
    head = s.register_family(s.ramp((72, 96, 132), 5))
    glass = s.register_family(s.ramp((214, 226, 236), 4))
    dark = s.ink((18, 20, 26))
    red = s.ink((222, 66, 58))

    #  Almost nothing wide about it. Among a roster of blocks and blobs, a bare
    #  vertical line is the one silhouette nothing else can be confused with.
    s.limb(36, 66, 34, 30, 9, 7, post)                           # the pole
    s.rect(28, 62, 44, 66, post[1])                              # base plate
    for y in range(38, 62, 6):                                   # collar rings
        s.rect(30, y, 39, y + 1, post[0])

    s.poly([(24, 10), (46, 10), (48, 30), (22, 30)], head[2])    # the head
    s.poly([(24, 10), (30, 10), (28, 30), (22, 30)], head[4])
    s.poly([(42, 10), (46, 10), (48, 30), (44, 30)], head[0])
    s.form(35, 9, 12, 4, head, squash=0.4)                       # its little cap
    s.poly([(27, 14), (43, 14), (44, 25), (26, 25)], glass[2])   # the window
    s.poly([(29, 16), (41, 16), (42, 23), (28, 23)], dark)
    s.stamp(30, 17, [
        "rr..rr..rr",
        "r.r.r.r.r.",
        "rr..rr..rr",
    ], {'r': red})                                               # EXPIRED, forever
    s.rect(45, 15, 48, 19, post[3])                              # coin slot
    s.rect(46, 16, 47, 18, dark)
    s.put(30, 12, glass[3])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def payphone():
    """It is ringing. It is for you."""
    s = Sprite(FOE, FOE)
    shell = s.register_family(s.ramp((44, 68, 60), 6))
    steel = s.register_family(s.ramp((158, 164, 174), 5))
    dark = s.ink((14, 18, 18))
    tooth = s.register_family(s.ramp((232, 230, 218), 4))
    cord = s.register_family(s.ramp((32, 34, 40), 4))

    s.poly([(16, 8), (48, 8), (50, 56), (14, 56)], shell[2])     # the box
    s.poly([(16, 8), (24, 8), (22, 56), (14, 56)], shell[4])
    s.poly([(44, 8), (48, 8), (50, 56), (44, 56)], shell[0])
    s.form(32, 8, 17, 5, shell, squash=0.45)                     # hooded top
    s.rect(20, 14, 44, 22, steel[1])                             # the keypad
    for r in range(3):
        for c in range(3):
            s.put(23 + c * 7, 16 + r * 2, steel[4])
    s.rect(20, 26, 44, 30, dark)                                 # coin return
    s.rect(21, 27, 43, 29, steel[0])

    #  No teeth. The coin return is the mouth and it is a slot, which is more
    #  unpleasant than a grin and keeps this one from wearing the sofa's face.
    s.poly([(20, 36), (44, 36), (42, 46), (22, 46)], dark)
    s.rect(22, 38, 42, 40, steel[0])
    s.poly([(24, 44), (30, 44), (27, 40)], tooth[2])             # two, not a row
    s.poly([(34, 44), (40, 44), (37, 40)], tooth[1])

    #  The receiver swinging off the hook is the whole silhouette -- a box with
    #  something hanging -- so it is drawn at a size that survives the battle
    #  screen rather than as a grey speck in the corner. The cord coils.
    for k in range(7):                                           # coiled cord
        x = 50 + (k % 2) * 2
        s.rect(x, 30 + k * 4, x + 5, 32 + k * 4, cord[2])
        s.rect(x, 30 + k * 4, x + 5, 30 + k * 4, cord[1])
    s.limb(50, 58, 64, 66, 10, 10, steel)                        # the handset
    s.form(50, 58, 6, 6, steel, wrap=0.8)                        # earpiece
    s.form(64, 66, 6, 6, steel, wrap=0.8)                        # mouthpiece
    s.form(50, 58, 3, 3, [dark, dark, dark], squash=0.9)
    s.form(64, 66, 3, 3, [dark, dark, dark], squash=0.9)
    s.put(48, 55, steel[4])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def the_hoarder():
    """The first boss of the whole thing, and she was a person.

    Fifteen feet of her, roughly thirty-five, enormously obese, matted black
    hair, sores and scabs, one tooth left. Filthy torn t-shirt, no bra, tight
    blue sweatpants with PINK down the leg. She speaks Spanish, she is plainly
    in agony, and she has no idea what is happening to her -- the dungeon took
    a mentally ill woman and stretched her into a boss for television, and Carl
    is sick about it afterwards.

    So she is drawn as a person that something was done to, not as a designed
    creature: human proportions, wrong scale, sitting collapsed in her own
    rubbish, small head on a vast body. Nothing here is spiky or clawed. She
    was a green blob sharing the Sludge Mound's sprite before this, which threw
    away the one thing that makes the scene land.
    """
    s = Sprite(BOSS, BOSS)
    skin = s.register_family(s.ramp((214, 176, 156), 6))
    sore = s.register_family(s.ramp((178, 88, 82), 4))
    shirt = s.register_family(s.ramp((198, 196, 186), 5))
    pants = s.register_family(s.ramp((72, 96, 158), 5))
    #  Named, not matched. ramp() snaps a loose RGB to the nearest curated
    #  family, and anything near black lands on stone_ancient -- which is why
    #  her matted black hair kept coming out khaki grey however dark the base
    #  colour was. cloth_black is the one that is actually dark.
    hair = s.register_family(s.ramp((30, 24, 28), 4, name='cloth_black'))
    bag = s.register_family(s.ramp((44, 44, 50), 4))
    trash = s.register_family(s.ramp((176, 158, 118), 4))
    dark = s.ink((22, 14, 18))
    pink = s.ink((246, 108, 178))          # the lettering down the leg. Canon.
    tooth = s.ink((236, 230, 206))

    #  The rubbish she sits in, first, so she sits *in* it and not on it.
    for x, y, r in ((10, 84, 12), (30, 88, 14), (60, 86, 13), (84, 82, 11)):
        s.form(x, y, r, r // 2 + 3, bag, wrap=0.9, squash=0.4)
    for x, y in ((16, 78), (40, 84), (68, 80), (88, 76), (26, 90)):
        s.form(x, y, 4, 3, trash, squash=0.5)

    #  The body: a vast lopsided mass, wider at the base, slumped to one side.
    s.form(48, 64, 38, 26, skin, wrap=1.3)
    s.form(44, 50, 30, 20, skin, wrap=1.3)
    s.poly([(18, 62), (78, 58), (84, 84), (12, 86)], skin[2])
    s.poly([(18, 62), (34, 60), (30, 86), (12, 86)], skin[3])   # lit side
    s.poly([(70, 58), (78, 58), (84, 84), (72, 86)], skin[1])

    #  Sweatpants, and the word down the leg that the book bothers to mention.
    s.poly([(14, 74), (82, 72), (86, 92), (10, 94)], pants[2])
    s.poly([(14, 74), (32, 73), (28, 94), (10, 94)], pants[3])
    for i, x in enumerate((18, 23, 28, 33)):                    # P I N K
        s.rect(x, 80, x + 3, 87, pink)
    s.rect(19, 80, 20, 87, pants[0])
    s.rect(29, 83, 31, 84, pants[0])

    #  The shirt: torn, too small, riding up over the belly.
    s.poly([(22, 40), (70, 37), (76, 68), (18, 71)], shirt[2])
    s.poly([(22, 40), (36, 39), (32, 70), (18, 71)], shirt[3])
    s.poly([(40, 62), (58, 61), (56, 72), (42, 72)], skin[2])   # where it rides up
    for x, y in ((30, 52), (62, 48), (48, 66)):                 # stains
        s.form(x, y, 4, 3, shirt[0:1] * 3, squash=0.6)
    s.line(66, 40, 70, 58, shirt[0])                            # the tear

    #  Arms, hanging. Not raised, not clawed. She is not posturing at you.
    s.limb(24, 46, 8, 74, 15, 11, skin)
    s.limb(68, 44, 88, 70, 15, 11, skin)
    s.form(8, 76, 7, 6, skin, wrap=1.2)
    s.form(89, 72, 7, 6, skin, wrap=1.2)

    #  A small head on all of that, which is most of why the scale reads.
    s.form(46, 26, 15, 15, skin, wrap=1.4)
    s.poly([(31, 22), (61, 20), (64, 8), (28, 10)], hair[1])    # matted, unwashed
    s.poly([(31, 22), (38, 21), (34, 6), (28, 10)], hair[2])
    for x, y in ((30, 26), (62, 24), (34, 14), (58, 12)):
        s.line(x, y, x - 2, y + 8, hair[0])
    for x, y in ((36, 40), (58, 38), (28, 34), (66, 32), (44, 18)):   # sores
        s.form(x, y, 3, 2, sore, wrap=1.1)

    #  The face. Small eyes, not saucers -- the brows do the work, drawn up in
    #  the middle the way a face does when it is frightened rather than angry.
    s.rect(39, 25, 41, 27, dark)
    s.rect(52, 24, 54, 26, dark)
    s.put(39, 25, s.ink((228, 224, 226)))
    s.put(52, 24, s.ink((228, 224, 226)))
    s.line(36, 22, 42, 19, hair[0])
    s.line(51, 19, 57, 22, hair[0])
    s.line(37, 23, 42, 20, hair[1])
    s.line(51, 20, 56, 23, hair[1])
    s.form(46, 36, 8, 6, [dark, dark, dark], wrap=0.9)          # the mouth, open
    s.rect(44, 33, 46, 37, tooth)                               # the tooth

    #  The rubbish again, in front this time. Drawn only behind her she sat on
    #  a pile nobody could see; the room is described as mountains of it and it
    #  is half of what the scene is about.
    for x, y, r in ((6, 90, 10), (28, 93, 12), (58, 92, 11), (86, 89, 9)):
        s.form(x, y, r, r // 3 + 3, bag, wrap=0.9, squash=0.4)
    for x, y in ((12, 88), (36, 91), (64, 89), (82, 86)):
        s.form(x, y, 4, 3, trash, squash=0.5)
        s.put(x - 2, y - 2, trash[3])

    #  And what comes out of her, constantly.
    roach = s.register_family(s.ramp((92, 62, 40), 4))
    for i, (x, y) in enumerate(((44, 41), (50, 44), (40, 46))):
        s.form(x, y, 3, 2, roach, squash=0.5)
        s.put(x - 3, y, roach[0])
        s.put(x + 3, y, roach[0])
    return s.finish(rim=False).stage(s.w, s.h, ground=None).emit()


def bad_llama():
    """It is a llama. The book's joke is that it is simply a bad one.

    Spits something molten, drops llama steaks and baggies of low-grade meth,
    and will trade with you if you have anything it wants. A long neck over a
    compact barrel is a silhouette nothing else in the roster owns.
    """
    s = Sprite(FOE, FOE)
    wool = s.register_family(s.ramp((198, 176, 142), 6))
    face = s.register_family(s.ramp((172, 148, 116), 5))
    hoof = s.register_family(s.ramp((70, 58, 50), 4))
    dark = s.ink((26, 20, 18))
    tooth = s.ink((226, 214, 168))
    spit = s.register_family(s.ramp((236, 128, 48), 4))

    s.limb(24, 44, 20, 66, 9, 6, wool)               # legs
    s.limb(34, 46, 32, 66, 9, 6, wool)
    s.limb(46, 44, 50, 66, 9, 6, wool)
    s.limb(54, 46, 58, 66, 9, 6, wool)
    for x in (20, 32, 50, 58):
        s.form(x, 67, 4, 3, hoof, squash=0.5)
    s.form(38, 42, 20, 13, wool, wrap=1.1)           # the barrel
    s.limb(56, 46, 62, 40, 7, 5, wool)               # stumpy tail

    #  The neck: long, near-vertical, and the whole point of the outline.
    s.limb(30, 40, 24, 14, 11, 8, wool)
    s.form(23, 12, 8, 7, wool, wrap=1.1)             # the head
    s.poly([(16, 10), (26, 9), (27, 16), (15, 17)], face[3])     # muzzle
    s.poly([(20, 4), (23, 3), (24, 9), (20, 9)], wool[4])        # ears, upright
    s.poly([(26, 3), (29, 4), (29, 9), (26, 9)], wool[2])
    s.put(21, 11, dark)                              # eye
    s.put(20, 11, s.ink((240, 238, 230)))
    s.rect(15, 14, 20, 15, dark)                     # the mouth
    s.rect(16, 15, 17, 16, tooth)

    #  Molten spit, mid-arc, going where you are.
    for i, (x, y, r) in enumerate(((10, 17, 3), (5, 21, 2), (1, 26, 2))):
        s.form(x, y, r, r, spit, wrap=0.8)
    for x, y in ((44, 40), (36, 48), (52, 44)):      # matted patches
        s.form(x, y, 4, 3, wool[0:1] * 3, squash=0.6)
    return s.finish().stage(s.w, s.h, ground=None).emit()


def mind_horror():
    """A floating brain trailing jellyfish tentacles. Attacks with headaches.

    The only thing in book one with no ground contact, which is worth a great
    deal on a roster where everything else stands on something: a sprite with
    no feet reads as wrong immediately.
    """
    s = Sprite(FOE, FOE)
    brain = s.register_family(s.ramp((214, 150, 158), 6))
    fold = s.register_family(s.ramp((166, 104, 120), 5))
    veil = s.register_family(s.ramp((186, 176, 214), 5))
    dark = s.ink((44, 22, 40))
    glow = s.ink((214, 196, 255))

    #  Tentacles first, hanging and drifting, so the mass sits over them.
    for i, x in enumerate((22, 30, 38, 46, 54)):
        sway = (i % 3) - 1
        s.limb(x, 40, x + sway * 6, 62 + (i % 2) * 6, 6, 2, veil)
        s.put(x + sway * 6, 63 + (i % 2) * 6, veil[4])
    for i, x in enumerate((26, 42, 50)):             # a couple of longer ones
        s.limb(x, 42, x - 4 + i * 4, 70, 4, 2, veil)

    #  The mass: two lobes with a hard central split, which is what makes a
    #  blob read as a brain rather than as another sludge.
    s.form(28, 28, 14, 13, brain, wrap=1.3)
    s.form(46, 28, 14, 13, brain, wrap=1.3)
    s.form(37, 22, 10, 8, brain, wrap=1.3)
    s.rect(36, 14, 38, 40, fold[1])                  # the split
    for i, (x, y, w) in enumerate(((22, 20, 9), (48, 19, 9), (20, 30, 8),
                                   (50, 31, 8), (28, 16, 7), (44, 15, 7),
                                   (24, 36, 7), (48, 37, 7))):
        s.line(x, y, x + w, y + 2, fold[2])          # the folds
        s.line(x, y + 1, x + w, y + 3, fold[0])
    s.form(30, 20, 4, 3, brain[4:5] * 3, squash=0.7)  # a highlight off the top

    #  No face. Two cold points where one ought to be.
    s.put(31, 30, dark); s.put(32, 30, dark)
    s.put(43, 30, dark); s.put(44, 30, dark)
    s.put(31, 29, glow); s.put(43, 29, glow)
    for i, r in enumerate((18, 22)):                 # a psionic halo
        for a in range(0, 360, 30):
            import math
            x = int(37 + r * math.cos(math.radians(a)))
            y = int(28 + (r * 0.7) * math.sin(math.radians(a)))
            if 0 <= x < s.w and 0 <= y < s.h and not s.get(x, y):
                s.put(x, y, glow if i else veil[3])
    return s.finish(rim=False).stage(s.w, s.h, ground=None).emit()


def brindle_grub():
    """The floor's janitor. Spawns on corpses and levels up by eating them.

    Individually a joke -- the danger is the count. A legless curl is a shape
    nothing else here has, and it stays readable when several are on screen at
    once, which is the whole point of the creature.

    Built as overlapping segments along a curve rather than a body with bands
    drawn on afterwards: the first version put the banding on as separate
    strokes and they came out as a row of bars sticking through the outline,
    which read as a comb glued to a blob. A maggot is segments.
    """
    import math
    s = Sprite(FOE, FOE)
    flesh = s.register_family(s.ramp((226, 214, 168), 6))
    band = s.register_family(s.ramp((188, 168, 120), 6))
    dark = s.ink((44, 34, 26))
    mouth = s.ink((122, 62, 54))

    #  A comma laid on its side: fat at the head, curling down and back.
    N = 11
    pts = []
    for i in range(N):
        t = i / float(N - 1)
        ang = math.radians(-40 + 150 * t)
        x = 30 + 20 * math.cos(ang) + 6 * t
        y = 30 + 22 * math.sin(ang) - 4 * t
        pts.append((x, y, 13 - 8 * t))          # radius tapers to the tail
    for i, (x, y, r) in enumerate(reversed(pts)):
        s.form(x, y, r, r * 0.92, band if i % 2 else flesh, wrap=1.35)

    #  The head end, once, over the top so the face is not cut by a segment.
    hx, hy, hr = pts[0]
    s.form(hx, hy, hr + 1, hr, flesh, wrap=1.4)
    s.form(hx - 4, hy - 5, 4, 3, flesh[5:6] * 3, squash=0.6)     # wet highlight
    s.form(hx - 3, hy + 5, 5, 3, [mouth, mouth, mouth], wrap=0.9)
    for dx in (-5, 2):
        s.put(int(hx + dx), int(hy - 1), dark)
    for dx, dy in ((-9, 3), (-7, -6)):                            # bristles
        s.line(int(hx + dx), int(hy + dy), int(hx + dx - 3), int(hy + dy + 2), band[0])
    return s.finish().stage(s.w, s.h, ground=None).emit()


def rage_elemental():
    """Level ninety-three, on a floor where you are eleven.

    Not something that lives here. It is released as a *penalty* -- somebody
    breaks one of the floor's posted rules and the System sends this after
    them, which is the dungeon at its most honestly cruel: a video game being
    unfair on purpose and broadcasting it.

    The book does not describe it, so this is invention and marked as such.
    What it is drawn to be is a punishment rather than an animal: no face, no
    limbs to speak of, roughly upright because that is more frightening than
    not, and burning from the inside out. Nothing to reason with.
    """
    s = Sprite(BOSS, BOSS)
    core = s.register_family(s.ramp((248, 196, 72), 6))
    body = s.register_family(s.ramp((214, 92, 44), 6))
    outer = s.register_family(s.ramp((146, 44, 40), 5))
    ash = s.register_family(s.ramp((62, 46, 48), 4))
    white = s.ink((255, 246, 214))

    #  A column, wider at the shoulders, boiling at the top.
    s.poly([(30, 12), (66, 12), (76, 60), (60, 92), (36, 92), (20, 60)], outer[2])
    s.poly([(30, 12), (46, 12), (44, 92), (36, 92), (20, 60)], outer[3])
    s.poly([(34, 18), (62, 18), (70, 58), (56, 86), (40, 86), (26, 58)], body[2])
    s.poly([(38, 24), (58, 24), (64, 56), (52, 80), (44, 80), (32, 56)], body[4])
    s.poly([(42, 30), (54, 30), (58, 54), (50, 74), (46, 74), (38, 54)], core[3])
    s.poly([(45, 36), (51, 36), (53, 52), (48, 66), (46, 66), (43, 52)], core[5])

    #  Cracks, as if it is splitting under its own heat.
    for x0, y0, x1, y1 in ((36, 30, 30, 52), (60, 34, 66, 56),
                           (44, 60, 38, 80), (54, 62, 60, 82)):
        s.line(x0, y0, x1, y1, core[4])
        s.line(x0 + 1, y0, x1 + 1, y1, body[0])

    #  It boils off the top instead of having a head. Deliberately: a face
    #  would make it a creature with intentions, and it has exactly one.
    for i, (x, y, r) in enumerate(((40, 10, 7), (54, 8, 6), (47, 4, 5),
                                   (33, 6, 4), (61, 12, 4))):
        s.form(x, y, r, r - 1, body if i % 2 else core, wrap=1.2)
    for x, y in ((44, 2), (52, 1), (48, 8)):
        s.put(x, y, white)

    #  And it leaves the floor scorched where it has been standing.
    for x, y, w in ((28, 92, 9), (48, 94, 12), (66, 92, 8)):
        s.form(x, y, w, 3, ash, squash=0.5)
    for x in range(24, 72, 7):
        s.put(x, 90, ash[0])
    return s.finish(rim=False).stage(s.w, s.h, ground=None).emit()
