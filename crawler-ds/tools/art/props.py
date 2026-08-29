"""The furniture of the dungeon: what stands in the corridor and what the show
hands out for surviving it."""
from forge_tools import Sprite

PROP = 40


def loot_box(tier=0):
    """A System loot box, in the four rarities the show pays in."""
    body_tint = [(178, 116, 60), (192, 200, 214), (248, 202, 70), (198, 92, 232)][tier]
    seam_tint = [(252, 214, 150), (246, 252, 255), (255, 246, 176), (250, 176, 255)][tier]
    s = Sprite(PROP, PROP)
    body = s.register_family(s.ramp(body_tint, 6))
    band = s.register_family(s.ramp(tuple(int(c * 0.55) for c in body_tint), 5))
    glow = s.ink(seam_tint)
    hot = s.ink(tuple(min(255, c + 40) for c in seam_tint))

    s.rect(5, 17, 35, 34, body[2])                   # the chest
    s.rect(5, 17, 35, 19, body[3])
    s.rect(5, 32, 35, 34, body[0])
    s.form(20, 12, 15, 6, body, squash=0.35)         # the domed lid
    s.rect(5, 12, 35, 17, body[3])
    s.rect(5, 16, 35, 17, band[1])                   # the seam
    s.rect(6, 16, 34, 16, glow)
    for x in (5, 35):                                # corner fittings
        s.rect(x - 2, 12, x + 2, 20, band[2])
        s.rect(x - 2, 29, x + 2, 34, band[2])
        s.put(x, 14, band[4])
    s.rect(16, 10, 24, 26, band[2])                  # the clasp strap
    s.rect(17, 10, 23, 11, band[4])
    s.rect(16, 18, 24, 24, band[3])
    s.rect(18, 20, 22, 22, glow)
    s.put(20, 21, hot)
    for x, y in ((8, 5), (30, 7), (20, 2), (13, 4), (27, 3)):     # it is pleased
        s.put(x, y, glow)
        s.put(x + 1, y + 1, hot)
    s.line(7, 22, 7, 30, body[4])                    # a highlight down the front
    return s.finish(rim=tier >= 2).emit()


def loot_box_open(tier=0):
    """The same chest with the lid off it.

    An opening animation in which the box stays shut is a box sitting still
    while something happens next to it, so the reveal needs a second state to
    cut to. The body is the closed sprite's body; what changes is that the
    domed lid is gone, there is a dark inside to see, and the rim it was
    sitting on catches the light coming out.
    """
    body_tint = [(178, 116, 60), (192, 200, 214), (248, 202, 70), (198, 92, 232)][tier]
    seam_tint = [(252, 214, 150), (246, 252, 255), (255, 246, 176), (250, 176, 255)][tier]
    s = Sprite(PROP, PROP)
    body = s.register_family(s.ramp(body_tint, 6))
    band = s.register_family(s.ramp(tuple(int(c * 0.55) for c in body_tint), 5))
    glow = s.ink(seam_tint)
    hot = s.ink(tuple(min(255, c + 40) for c in seam_tint))
    dark = s.ink(tuple(int(c * 0.18) for c in body_tint))

    s.rect(5, 17, 35, 34, body[2])                   # the chest, as before
    s.rect(5, 17, 35, 19, body[3])
    s.rect(5, 32, 35, 34, body[0])
    s.form(20, 15, 15, 4, band, squash=0.6)          # the rim the lid sat on
    s.form(20, 16, 13, 3, ids=[dark, dark, dark], squash=0.9)     # and the inside
    for x in range(8, 33):                           # light climbing out of it
        s.put(x, 13, glow if (x + tier) % 3 else hot)
    s.put(14, 12, hot)
    s.put(26, 12, hot)
    for x in (5, 35):                                # corner fittings
        s.rect(x - 2, 17, x + 2, 22, band[2])
        s.rect(x - 2, 29, x + 2, 34, band[2])
        s.put(x, 19, band[4])
    s.rect(16, 20, 24, 26, band[2])                  # what is left of the clasp
    s.rect(18, 21, 22, 24, glow)
    s.line(7, 23, 7, 30, body[4])
    return s.finish(rim=tier >= 2).emit()


def loot_lid(tier=0):
    """The lid, in the air, on its way somewhere else."""
    body_tint = [(178, 116, 60), (192, 200, 214), (248, 202, 70), (198, 92, 232)][tier]
    seam_tint = [(252, 214, 150), (246, 252, 255), (255, 246, 176), (250, 176, 255)][tier]
    s = Sprite(PROP, 20)
    body = s.register_family(s.ramp(body_tint, 6))
    band = s.register_family(s.ramp(tuple(int(c * 0.55) for c in body_tint), 5))
    glow = s.ink(seam_tint)

    s.form(20, 12, 15, 7, body, squash=0.35)         # the dome
    s.rect(5, 12, 35, 15, body[3])
    s.rect(5, 12, 35, 12, body[5])
    s.rect(5, 15, 35, 16, band[1])                   # the seam it broke along
    s.rect(6, 15, 34, 15, glow)
    for x in (5, 35):
        s.rect(x - 2, 8, x + 2, 16, band[2])
    s.rect(16, 6, 24, 16, band[2])                   # the strap over the top
    s.rect(17, 6, 23, 7, band[4])
    return s.finish(rim=tier >= 2).emit()


def stairs_down():
    """Down. Always down, and the floor behind you is on a timer."""
    s = Sprite(PROP, PROP)
    stone = s.register_family(s.ramp((116, 112, 122), 6))
    deep = s.ink((8, 8, 14))

    s.rect(0, 2, 39, 39, stone[1])                   # the shaft walls
    s.poly([(4, 2), (35, 2), (30, 16), (9, 16)], deep)           # the dark below
    for i in range(6):                               # the steps, nearest widest
        y = 32 - i * 5
        inset = i * 2
        s.rect(2 + inset, y, 37 - inset, y + 3, stone[3])        # tread
        s.rect(2 + inset, y, 37 - inset, y, stone[5])            # lit nose
        s.rect(2 + inset, y + 3, 37 - inset, y + 4, stone[0])    # riser in shadow
        s.put(3 + inset, y + 1, stone[4])
    s.rect(0, 36, 39, 39, stone[2])
    for x, y in ((6, 30), (28, 24), (14, 20)):       # chipped edges
        s.put(x, y, stone[0])
        s.put(x + 1, y, stone[1])
    return s.finish(rim=False).emit()


def shop_stall():
    """Bopca's counter: the awning is the only new-looking thing on the floor."""
    s = Sprite(PROP, PROP)
    wood = s.register_family(s.ramp((128, 90, 54), 6))
    cloth = s.register_family(s.ramp((188, 58, 68), 5))
    cream = s.register_family(s.ramp((236, 224, 196), 5))
    brass = s.register_family(s.ramp((238, 196, 96), 5))

    s.rect(3, 20, 37, 37, wood[2])                   # the counter
    s.rect(3, 20, 37, 22, wood[4])
    for x in range(5, 37, 6):
        s.line(x, 23, x, 36, wood[1])
    s.rect(3, 34, 37, 37, wood[0])
    for i, x in enumerate(range(2, 38, 6)):          # scalloped awning
        panel = cloth[2] if i % 2 else cream[3]
        s.poly([(x, 6), (x + 6, 6), (x + 6, 15), (x + 3, 18), (x, 15)], panel)
    s.rect(0, 3, 39, 7, cloth[3])
    s.rect(0, 3, 39, 4, cloth[4])
    s.rect(0, 7, 39, 8, cloth[0])
    s.rect(8, 24, 32, 30, brass[2])                  # goods on the counter
    s.rect(8, 24, 32, 25, brass[4])
    for x in range(10, 32, 5):
        s.rect(x, 26, x + 2, 29, brass[0])
    return s.finish().emit()


def shrine():
    """Somewhere to bleed less."""
    s = Sprite(PROP, PROP)
    stone = s.register_family(s.ramp((120, 124, 148), 6))
    glow = s.register_family(s.ramp((104, 226, 240), 5, cool=0.05))
    trim = s.register_family(s.ramp((196, 168, 96), 5))

    s.poly([(8, 12), (32, 12), (34, 38), (6, 38)], stone[2])     # the plinth
    s.rect(6, 34, 34, 38, stone[1])
    s.rect(4, 37, 36, 39, stone[3])
    s.poly([(11, 4), (29, 4), (32, 12), (8, 12)], stone[3])      # the cap
    s.rect(8, 11, 32, 12, stone[0])
    s.rect(13, 16, 27, 32, s.ink((22, 26, 40)))                  # the niche
    s.form(20, 24, 6, 8, glow, wrap=0.6)                         # the light in it
    for r, step in ((9, 1), (12, 0)):                            # its spill
        for a in range(0, 360, 24):
            import math
            s.put(20 + r * math.cos(math.radians(a)),
                  24 + r * 0.8 * math.sin(math.radians(a)), glow[step])
    s.rect(13, 16, 27, 17, trim[2])
    s.rect(13, 31, 27, 32, trim[1])
    s.put(20, 14, trim[4])
    return s.finish().emit()


def door():
    """Shut, and then not."""
    s = Sprite(PROP, PROP)
    wood = s.register_family(s.ramp((108, 74, 48), 6))
    iron = s.register_family(s.ramp((124, 128, 142), 5, warm=0.05))

    s.rect(4, 3, 36, 38, wood[2])
    for x in range(5, 36, 5):                        # planks
        s.line(x, 3, x, 38, wood[1])
        s.line(x + 1, 3, x + 1, 38, wood[3])
    s.rect(4, 3, 36, 5, wood[4])                     # lit top edge
    s.rect(4, 36, 36, 38, wood[0])
    for y in (10, 30):                               # iron bands
        s.rect(3, y, 37, y + 3, iron[2])
        s.rect(3, y, 37, y, iron[4])
        s.rect(3, y + 3, 37, y + 3, iron[0])
        for x in range(6, 36, 7):
            s.put(x, y + 1, iron[4])
    s.form(29, 21, 4, 4, iron)                       # the ring
    s.put(29, 19, iron[4])
    s.rect(28, 24, 30, 27, iron[1])
    for x, y in ((10, 22), (16, 34), (22, 8)):       # somebody has been at it
        s.put(x, y, wood[0])
        s.put(x + 1, y + 1, wood[0])
    return s.finish().emit()
