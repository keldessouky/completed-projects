"""The things the floors send at you.

Each one is built for its silhouette first — you should know what it is from the
shape alone at 72 pixels, before the palette or the face arrives — and lit by
the same key light as the party so the whole cast belongs to one game. The
bosses are not here: they are sculpted and lit in boss_paint.py.
"""
from forge_tools import Sprite

FOE = 72


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
    """Carrying something with a fuse, and pleased about it.

    Canine, which it was not. The first draft was a round brown body with big
    curved horns and two tusks -- a horned toad, and every kobold on floor one
    was one. Book one's are dogs: jackal-headed, lean, up on their toes.

    The second draft failed for a reason worth writing down: the head sat over
    the middle of the body, so the muzzle had nothing to project into and was
    drawn in a value one step off the skull, which made the whole head one
    blob with ears. A muzzle only reads if it leaves the skull's outline and
    changes value doing it. The head is offset left here, the snout runs well
    clear of the chest, and it is the lightest thing on the sprite.
    """
    s = Sprite(FOE, FOE)
    hide = s.register_family(s.ramp((176, 122, 70), 6))
    pale = s.register_family(s.ramp((230, 196, 148), 5))
    leather = s.register_family(s.ramp((92, 62, 40), 5))
    claw = s.register_family(s.ramp((230, 220, 198), 4))
    dark = s.ink((26, 18, 16))
    amber = s.ink((242, 182, 66))
    spark = s.ink((255, 232, 140))

    #  Digitigrade, and the legs are kept apart: the first pass ran both feet
    #  into one bar along the bottom and the stance vanished.
    for sx, hipx in ((-1, 32), (1, 46)):
        s.limb(hipx, 46, hipx + sx * 4, 55, 9, 6, hide)           # thigh
        s.limb(hipx + sx * 4, 55, hipx - sx * 1, 65, 6, 4, hide)  # hock
        s.poly([(hipx - sx * 6, 65), (hipx + sx * 3, 65),
                (hipx + sx * 3, 69), (hipx - sx * 7, 69)], hide[2])
        for t in range(3):
            s.put(hipx - sx * (6 - t * 3), 69, claw[3])

    s.limb(48, 42, 63, 54, 7, 3, hide)                # tail
    s.put(64, 55, hide[0])

    s.form(41, 40, 12, 13, hide, wrap=0.8)            # chest
    s.form(41, 46, 8, 8, pale, wrap=0.7)
    s.poly([(29, 35), (53, 35), (55, 41), (27, 41)], leather[2])  # satchel strap
    s.put(49, 38, leather[4])

    s.limb(31, 33, 22, 48, 8, 5, hide)                # arms
    s.limb(51, 33, 59, 41, 8, 5, hide)
    for t in range(3):
        s.put(20 + t, 50, claw[3])

    #  The head, offset left so the muzzle has somewhere to go.
    s.form(44, 19, 10, 9, hide, wrap=0.85)                        # skull
    s.poly([(36, 15), (44, 14), (44, 27), (34, 25)], hide[4])     # muzzle, lighter
    s.poly([(24, 19), (36, 15), (36, 25), (25, 24)], pale[3])     # and its bridge
    s.poly([(25, 23), (36, 22), (36, 27), (27, 26)], hide[2])     # the jaw under it
    s.form(24, 21, 3, 3, [dark, dark], wrap=1.2)                  # the nose
    for t in range(4):
        s.put(29 + t * 2, 26, claw[3])                            # teeth
    s.poly([(40, 11), (37, 1), (46, 10)], hide[2])                # ears, upright
    s.poly([(48, 11), (53, 2), (44, 10)], hide[2])
    s.poly([(41, 10), (39, 4), (45, 10)], leather[1])
    s.poly([(47, 10), (51, 4), (45, 10)], leather[1])
    s.form(38, 18, 2, 2, [dark, amber], wrap=1.2)                 # the eye
    s.put(38, 17, amber)

    s.line(59, 43, 63, 22, leather[2], 3)             # the thing with the fuse
    s.form(62, 18, 6, 6, s.register_family(s.ramp((196, 74, 46), 5)))
    s.line(64, 12, 68, 4, s.ink((150, 130, 100)))
    s.put(68, 3, spark); s.put(69, 2, spark); s.put(67, 1, s.ink((255, 190, 90)))
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
