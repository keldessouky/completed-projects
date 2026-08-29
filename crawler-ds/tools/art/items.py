"""What the boxes pay out.

One icon per entry in `item_defs`, at ICON square, drawn in the same key light
as everything else so a potion sitting next to a crawler looks like it came
from the same world. An RPG that names an item and then shows you nothing is
asking you to take its word for what you just won; these exist so the reward
screen has something to actually reveal.

The index order here is the item table's order, and `tools/forge.py` emits them
contiguously so the renderer can go straight from an item id to a sprite.
"""
from forge_tools import Sprite

ICON = 32


def _base(s):
    """A soft plate under the object, so a dark icon still reads on a dark card."""
    shade = s.ink((26, 24, 32))
    for i, w in enumerate((11, 9, 6)):
        s.rect(16 - w, 27 + i, 15 + w, 27 + i, shade)


def splint_potion():
    """A squat bottle of something that tastes like pennies."""
    s = Sprite(ICON, ICON)
    glass = s.register_family(s.ramp((84, 150, 176), 6))
    fluid = s.register_family(s.ramp((196, 62, 74), 6))
    cork = s.register_family(s.ramp((150, 108, 62), 5))
    shine = s.ink((236, 248, 255))
    _base(s)
    s.form(16, 19, 8, 8, glass, wrap=1.4)            # the round belly
    s.form(16, 21, 6, 5, fluid, wrap=1.3)            # what is in it
    s.rect(13, 8, 18, 13, glass[3])                  # the neck
    s.rect(13, 8, 14, 13, glass[1])
    s.rect(12, 5, 19, 8, cork[2])                    # the stopper
    s.rect(12, 5, 19, 5, cork[4])
    s.line(11, 16, 11, 22, glass[5])                 # a highlight down the glass
    s.put(12, 15, shine)
    return s.finish().emit()


def cold_slice():
    """Pizza the dungeon swears is fresh."""
    s = Sprite(ICON, ICON)
    crust = s.register_family(s.ramp((198, 148, 84), 6))
    cheese = s.register_family(s.ramp((236, 190, 92), 6))
    pep = s.register_family(s.ramp((178, 58, 56), 5))
    _base(s)
    s.poly([(16, 4), (27, 26), (5, 26)], cheese[3])   # the wedge
    s.poly([(16, 6), (24, 24), (8, 24)], cheese[4])
    s.rect(5, 24, 27, 27, crust[3])                   # the crust end
    s.rect(5, 24, 27, 25, crust[5])
    s.rect(5, 27, 27, 27, crust[1])
    for x, y, r in ((16, 13, 2), (12, 20, 2), (21, 20, 2)):
        s.form(x, y, r, r, pep, squash=0.5)           # and the toppings
    s.put(14, 10, cheese[5])
    return s.finish().emit()


def energy_drink():
    """Legally distinct from the one you know."""
    s = Sprite(ICON, ICON)
    can = s.register_family(s.ramp((72, 176, 96), 6))
    metal = s.register_family(s.ramp((188, 196, 206), 5))
    mark = s.ink((248, 236, 96))
    _base(s)
    s.rect(10, 6, 21, 27, can[2])                     # the can
    s.rect(10, 6, 13, 27, can[4])                     # lit side
    s.rect(19, 6, 21, 27, can[0])                     # shaded side
    s.rect(10, 5, 21, 7, metal[3])                    # the rim
    s.rect(10, 25, 21, 27, metal[2])
    s.rect(13, 6, 14, 7, metal[4])
    s.rect(11, 13, 20, 15, can[5])                    # the label band
    s.line(13, 11, 16, 18, mark)                      # a lightning bolt
    s.line(16, 18, 14, 18, mark)
    s.line(18, 12, 16, 19, mark)
    return s.finish().emit()


def pipe_bomb():
    """Thrown, not placed.

    Lying on its side. Stood upright with square caps it read as a crate with
    stripes painted on it: the caps were the same value as the barrel, a lit
    rule ran across the whole width tying them together, and the tape bands
    ran the wrong way. A pipe needs the cylinder shading to go across its
    short axis and the caps to be darker rings that break the silhouette.
    """
    s = Sprite(ICON, ICON)
    steel = s.register_family(s.ramp((132, 138, 148), 6))
    cap = s.register_family(s.ramp((84, 88, 98), 5))
    tape = s.register_family(s.ramp((150, 96, 48), 5))
    fuse = s.register_family(s.ramp((92, 74, 58), 4))
    spark = s.ink((255, 236, 150))
    hot = s.ink((250, 168, 60))
    _base(s)
    s.rect(6, 13, 26, 23, steel[2])                   # the barrel
    s.rect(6, 13, 26, 14, steel[5])                   # lit along the top
    s.rect(6, 15, 26, 16, steel[4])
    s.rect(6, 21, 26, 23, steel[0])                   # dark along the bottom
    s.rect(4, 11, 8, 25, cap[2])                      # a threaded cap each end
    s.rect(24, 11, 28, 25, cap[2])
    s.rect(4, 11, 8, 13, cap[4])
    s.rect(24, 11, 28, 13, cap[4])
    for y in range(12, 25, 3):                        # thread grooves
        s.line(4, y, 8, y, cap[0])
        s.line(24, y, 28, y, cap[0])
    s.rect(13, 13, 19, 23, tape[2])                   # taped round the middle
    s.rect(13, 13, 19, 14, tape[4])
    s.rect(13, 21, 19, 23, tape[0])
    s.line(26, 12, 29, 5, fuse[2], thick=2)           # the fuse, already lit
    s.put(29, 5, hot)
    s.put(30, 4, spark)
    s.put(28, 3, spark)
    return s.finish().emit()


def second_wind():
    """Puts a downed crawler back on their feet."""
    s = Sprite(ICON, ICON)
    glass = s.register_family(s.ramp((214, 226, 236), 6))
    fluid = s.register_family(s.ramp((96, 210, 168), 6))
    steel = s.register_family(s.ramp((150, 158, 170), 5))
    shine = s.ink((248, 255, 255))
    _base(s)
    s.rect(11, 9, 20, 26, glass[3])                   # a syringe barrel
    s.rect(11, 9, 13, 26, glass[5])
    s.rect(19, 9, 20, 26, glass[1])
    s.rect(12, 14, 19, 25, fluid[3])                  # the dose
    s.rect(12, 14, 14, 25, fluid[5])
    s.rect(9, 7, 22, 9, steel[3])                     # the flange
    s.rect(13, 3, 18, 7, steel[2])                    # the plunger
    s.rect(13, 3, 18, 4, steel[4])
    s.line(16, 26, 16, 30, steel[4])                  # the needle
    s.put(12, 12, shine)
    return s.finish().emit()


def adrenaline_shot():
    """Three turns of hitting much harder."""
    s = Sprite(ICON, ICON)
    body = s.register_family(s.ramp((216, 84, 62), 6))
    steel = s.register_family(s.ramp((176, 182, 194), 5))
    glow = s.ink((255, 214, 120))
    _base(s)
    s.rect(11, 6, 20, 24, body[2])                    # an auto-injector
    s.rect(11, 6, 13, 24, body[4])
    s.rect(19, 6, 20, 24, body[0])
    s.rect(11, 5, 20, 7, steel[3])
    s.rect(10, 22, 21, 25, steel[2])
    s.rect(12, 11, 19, 16, body[5])                   # the window
    s.rect(13, 12, 18, 15, glow)
    s.line(16, 25, 16, 29, steel[4])
    s.put(13, 8, steel[4])
    return s.finish().emit()


def rebar():
    """Concrete still attached. That is the point."""
    s = Sprite(ICON, ICON)
    iron = s.register_family(s.ramp((104, 72, 50), 6))   # rust, not flesh
    grey = s.register_family(s.ramp((146, 146, 152), 5))
    _base(s)
    #  A round lump of concrete on a stick is a mace, which is what the first
    #  version drew. Concrete that broke off a wall has flat faces and corners,
    #  so it gets a polygon, and it sits at the bottom where the weight is.
    #  Same treatment as the axe haft: a shaded capsule rather than parallel
    #  lines, kept off the top of the ramp because at iron[4] the highlight
    #  came out pink and the bar read as a bone.
    s.limb(10, 25, 24, 4, 5, 4, iron[:4])             # the bar, on the diagonal
    for i in range(6):                                # its ribs, the giveaway
        x = 11 + i * 2
        y = 22 - i * 3
        s.line(x - 2, y + 1, x + 2, y - 2, iron[0])
    s.poly([(4, 22), (12, 19), (15, 26), (9, 30), (3, 28)], grey[2])
    s.poly([(4, 22), (12, 19), (11, 24), (5, 26)], grey[4])      # a lit face
    s.poly([(9, 30), (15, 26), (13, 29)], grey[0])               # and one in shade
    for x, y in ((6, 24), (10, 27), (12, 22)):        # aggregate showing
        s.put(x, y, grey[1])
    return s.finish().emit()


def axe_handle():
    """No head. The handle was always the good part."""
    s = Sprite(ICON, ICON)
    wood = s.register_family(s.ramp((162, 112, 62), 6))
    grip = s.register_family(s.ramp((58, 54, 62), 5))
    steel = s.register_family(s.ramp((186, 192, 202), 5))
    _base(s)
    #  A limb, not stacked lines. Three parallel one-pixel lines down a steep
    #  diagonal stair-step against each other, and the alternating light and
    #  dark segments that produced read as the scoring on a baguette. limb()
    #  shades across the short axis, which is what a turned handle does.
    s.limb(10, 27, 21, 6, 6, 4, wood)                 # the haft, tapering up
    for i in range(4):                                # taped grip at the bottom
        y = 26 - i * 2
        x = 10 + i // 2
        s.line(x - 2, y, x + 2, y - 1, grip[2])
    s.line(15, 19, 16, 17, wood[1])                   # a little grain
    s.line(18, 13, 19, 11, wood[1])
    s.poly([(19, 7), (24, 3), (26, 6), (21, 10)], steel[2])   # the collar
    s.line(19, 7, 24, 3, steel[4])
    return s.finish().emit()


def duct_tape():
    """Wrapped over everything that bleeds."""
    s = Sprite(ICON, ICON)
    tape = s.register_family(s.ramp((128, 132, 140), 6))
    core = s.register_family(s.ramp((76, 62, 54), 5))
    _base(s)
    #  A roll seen at a slight angle, so the hole is an ellipse rather than a
    #  circle and the near edge shows its wound thickness. Drawn flat with a
    #  dark disc in the middle it read as a pebble with a fin.
    s.form(16, 16, 11, 10, tape, wrap=0.9)            # the outer roll
    s.rect(5, 16, 27, 21, tape[2])                    # the thickness of it
    s.form(16, 21, 11, 6, tape, wrap=0.9, squash=0.6)  # the near rim
    for y in range(17, 22):                           # wound layers on the edge
        s.line(6, y, 26, y, tape[1] if y % 2 else tape[3])
    for x in range(6, 27):                            # punch the hole through
        for y in range(9, 21):
            if ((x - 16) / 5.0) ** 2 + ((y - 15) / 4.0) ** 2 <= 1.0:
                s.put(x, y, 0)
    s.form(16, 15, 5, 4, core, wrap=0.9, squash=0.7)  # the cardboard core
    for x in range(12, 21):
        for y in range(11, 19):
            if ((x - 16) / 3.2) ** 2 + ((y - 15) / 2.6) ** 2 <= 1.0:
                s.put(x, y, 0)
    s.put(9, 11, tape[5])                             # a highlight off the top
    s.put(10, 10, tape[5])
    return s.finish().emit()


def riot_vest():
    """Looted off something that failed to riot."""
    s = Sprite(ICON, ICON)
    plate = s.register_family(s.ramp((62, 70, 88), 6))
    strap = s.register_family(s.ramp((38, 40, 48), 5))
    mark = s.ink((228, 196, 96))
    _base(s)
    #  A vest is read from its neck notch and its arm holes. The first version
    #  drew a torso and then covered it with a centre seam and a cinch strap,
    #  which quartered it into four bright panes and read as a window.
    s.poly([(9, 6), (13, 6), (16, 9), (19, 6), (23, 6),               # shoulders
            (26, 11), (26, 27), (6, 27), (6, 11)], plate[2])
    s.poly([(9, 6), (13, 6), (16, 9), (16, 27), (6, 27), (6, 11)], plate[4])
    s.poly([(13, 6), (16, 9), (19, 6), (17, 12), (15, 12)], strap[3])  # the collar
    for x in (6, 25):                                 # the arm holes
        for y in range(11, 18):
            s.put(x, y, 0)
            s.put(x + (1 if x < 16 else -1), y, strap[1])
    s.rect(10, 13, 22, 15, strap[2])                  # segmented plates
    s.rect(10, 19, 22, 21, strap[2])
    s.rect(15, 9, 17, 27, strap[1])                   # the zip, thin
    s.rect(11, 22, 14, 25, mark)                      # a stencilled number
    s.put(20, 11, plate[5])
    return s.finish().emit()


def lucky_molar():
    """Not yours. Luckier than yours."""
    s = Sprite(ICON, ICON)
    bone = s.register_family(s.ramp((226, 218, 196), 6))
    root = s.register_family(s.ramp((176, 160, 132), 5))
    gold = s.register_family(s.ramp((228, 178, 62), 5))
    _base(s)
    s.form(16, 14, 8, 7, bone, wrap=1.2)              # the crown
    s.rect(9, 14, 23, 19, bone[3])
    s.poly([(10, 18), (14, 18), (13, 27), (11, 27)], root[2])    # two roots
    s.poly([(18, 18), (22, 18), (21, 27), (19, 27)], root[2])
    s.line(10, 18, 11, 26, root[4])
    s.rect(18, 11, 21, 14, gold[3])                   # a gold filling, inset
    s.rect(18, 11, 21, 11, gold[4])
    s.put(21, 14, gold[1])
    s.put(12, 10, bone[5])
    return s.finish().emit()


#  Index order is item_defs' order. Slot 0 is the table's "-" placeholder and
#  has no icon, so the roster starts at 1 and the renderer offsets by one.
ROSTER = [
    ('item_splint_potion',   splint_potion),
    ('item_cold_slice',      cold_slice),
    ('item_energy_drink',    energy_drink),
    ('item_pipe_bomb',       pipe_bomb),
    ('item_second_wind',     second_wind),
    ('item_adrenaline_shot', adrenaline_shot),
    ('item_rebar',           rebar),
    ('item_axe_handle',      axe_handle),
    ('item_duct_tape',       duct_tape),
    ('item_riot_vest',       riot_vest),
    ('item_lucky_molar',     lucky_molar),
]
