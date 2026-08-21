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
    return s.finish().emit()


def goblin_trapper():
    """Sponsored by nobody, trying extremely hard."""
    s = Sprite(FOE, FOE)
    skin = s.register_family(s.ramp((112, 160, 84), 6))
    rag = s.register_family(s.ramp((96, 76, 58), 5))
    steel = s.register_family(s.ramp((168, 176, 190), 5, dark=0.7, warm=0.1))
    dark = s.ink((24, 26, 20))
    white = s.ink((244, 242, 228))
    gold = s.ink((236, 202, 96))

    s.limb(30, 52, 26, 66, 10, 8, skin)              # legs, bandy
    s.limb(42, 52, 46, 66, 10, 8, skin)
    s.form(25, 67, 5, 4, skin, squash=0.5)
    s.form(47, 67, 5, 4, skin, squash=0.5)

    s.form(36, 44, 13, 14, skin, wrap=0.85)          # torso
    s.poly([(24, 44), (48, 44), (50, 58), (22, 58)], rag[2])  # rags
    for x in range(25, 48, 5):
        s.poly([(x, 56), (x + 3, 56), (x + 1, 61)], rag[1])
    s.line(30, 46, 44, 50, rag[4])
    s.limb(24, 36, 16, 50, 9, 7, skin)               # arms
    s.limb(48, 36, 56, 48, 9, 7, skin)
    s.form(15, 52, 4, 4, skin)
    s.form(57, 50, 4, 4, skin)

    s.line(58, 8, 54, 52, s.ink((104, 78, 52)), 3)   # a rusty spike on a stick
    s.poly([(56, 4), (62, 14), (56, 20), (52, 12)], steel[3])
    s.line(57, 6, 59, 14, steel[4])
    s.put(60, 16, steel[1])

    s.form(36, 24, 12, 12, skin, wrap=0.85)          # head
    s.poly([(25, 20), (6, 16), (10, 26), (26, 30)], skin[2])   # ears, out sideways
    s.poly([(47, 20), (66, 16), (62, 26), (46, 30)], skin[2])
    s.line(10, 19, 24, 23, skin[4])
    s.line(62, 19, 48, 23, skin[1])
    s.put(8, 25, gold)                               # an earring, obviously
    s.stamp(26, 17, [
        ".ddd......ddd.",
        "dwwwwd..dwwwwd",
        "dwwgpd..dwgppd",
        ".dwppd..dwppd.",
        "..ddd....ddd..",
        "..............",
        "......dd......",
        ".....dppd.....",
        "....wwwwww....",
        "....wpwpww....",
    ], {'d': skin[1], 'w': white, 'p': dark, 'g': gold})
    s.line(29, 30, 43, 30, skin[0])                  # brow ridge
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


def neon_mimic():
    """A loot box with opinions."""
    s = Sprite(FOE, FOE)
    box = s.register_family(s.ramp((62, 148, 200), 6))
    trim = s.register_family(s.ramp((250, 206, 78), 5))
    tongue = s.register_family(s.ramp((196, 62, 96), 5))
    tooth = s.register_family(s.ramp((240, 240, 232), 4))
    dark = s.ink((18, 10, 22))
    glow = s.ink((156, 244, 255))

    s.rect(10, 40, 62, 66, box[2])                   # the body of the box
    s.rect(10, 40, 62, 43, box[3])
    s.rect(10, 63, 62, 66, box[0])
    s.rect(30, 40, 42, 66, trim[2])                  # the strap
    s.rect(30, 40, 42, 41, trim[3])
    s.poly([(10, 40), (62, 40), (56, 16), (16, 16)], box[1])     # lid, thrown back
    s.rect(16, 16, 56, 19, box[3])
    s.rect(30, 16, 42, 40, trim[1])
    for x in (10, 62):                               # corner fittings
        s.rect(x - 2, 40, x + 2, 46, trim[1])
        s.rect(x - 2, 60, x + 2, 66, trim[1])

    s.poly([(14, 40), (58, 40), (50, 60), (22, 60)], dark)       # the mouth
    for i, x in enumerate(range(16, 56, 6)):                     # teeth
        s.poly([(x, 41), (x + 5, 41), (x + 2, 50)], tooth[3 if i % 2 else 2])
        s.poly([(x + 3, 59), (x + 8, 59), (x + 5, 51)], tooth[1])
    s.form(36, 56, 10, 5, tongue, wrap=0.7)                      # tongue
    s.line(36, 52, 36, 59, tongue[0])
    s.line(10, 44, 62, 44, glow)                                 # the seam glows
    for i in range(6):
        s.put(12 + i * 9, 43, s.ink((255, 255, 255)))

    s.stamp(16, 22, [
        "ppppp........ppppp",
        "pmmmpp......pmmmpp",
        "pmwwmp......pmwwmp",
        "pmmmmp......pmmmmp",
        ".pppp........pppp.",
    ], {'p': dark, 'm': s.ink((250, 92, 172)), 'w': s.ink((255, 220, 245))})
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    return s.finish().emit()


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
    for x in (10, 84):                               # studio lamps, on him
        s.rect(x - 5, 2, x + 5, 10, dark)
        s.rect(x - 3, 4, x + 3, 8, s.ink((255, 246, 210)))
        s.put(x, 6, s.ink((255, 255, 255)))
    return s.finish().emit()
