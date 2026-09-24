"""The bosses that were wearing their mob's sprite.

Eleven of the fifteen bosses in the table pointed at a mob's art. Worse, three
pairs pointed at the *same* mob -- the Bailiff Prime and the Street Preacher
were one sprite, so were the House Mimic and the Silk Road Toll, so were the
Carrion Anchor and the Ratings Spike -- so a boss fight could open on a picture
indistinguishable from the corridor mob and from a different boss.

content.c already says what these should be: "each is still the local mob with
something from the surface welded on." So that is what they are built as. The
mob's finished drawing goes in the middle, untouched; the boss is what is added
around it and what colour it is. That keeps the family resemblance the design
wants -- the Kennelmaster reads as a hound's boss, not as a new animal -- and it
means the mob art only has one place to be fixed.

Three layers, each outlined on its own. Re-outlining the composite would put a
second ring around the mob, which is already outlined, and the silhouette came
out a line-weight heavier than every other sprite in the game. A prop in front
gets its own outline where it crosses the mob, which is what a real overlap
looks like; a prop behind is hidden wherever the mob covers it.
"""
from forge_tools import Sprite
from palettes import RAMPS, nearest_ramp
import bestiary

BOSS = 96


# ---------------------------------------------------------------- helpers ----

def _lum(c):
    return c[0] * 3 + c[1] * 6 + c[2]


def swap(families):
    """Recolour by material rather than by colour.

    {'cloth_blue': 'sand'} moves every colour that belongs to the blue cloth
    ramp onto the matching step of the sand ramp -- matched by where it sits in
    its own ramp, not by distance, so the shading keeps its shape and only the
    material changes. Colours outside the named families pass through.
    """
    def fn(rgb):
        fam = nearest_ramp(rgb)
        if fam not in families:
            return rgb
        src, dst = RAMPS[fam], RAMPS[families[fam]]
        step = min(range(len(src)), key=lambda i: abs(_lum(src[i]) - _lum(rgb)))
        return dst[round(step * (len(dst) - 1) / max(1, len(src) - 1))]
    return fn


def paste(s, drawing, ox, oy, recolour=None):
    """Lay a finished drawing into this one at (ox, oy)."""
    canvas = drawing[0] if isinstance(drawing, tuple) else drawing
    remap = {}
    for y in range(canvas.h):
        for x in range(canvas.w):
            idx = canvas.px[y * canvas.w + x]
            if not idx:
                continue
            if idx not in remap:
                rgb = canvas.pal[idx]
                remap[idx] = s.ink(recolour(rgb) if recolour else rgb)
            s.put(ox + x, oy + y, remap[idx])


def layer(draw):
    """A layer of additions, outlined by itself."""
    l = Sprite(BOSS, BOSS)
    draw(l)
    l.finish(rim=False)
    return l


def crop(s, margin=1):
    """Trim a canvas to what is drawn on it.

    The renderer scales a boss's whole canvas to a target height, so empty
    frame is not free: it shrinks the creature before the creature is ever
    scaled. The first cut of these left the mob at its native 72 pixels inside
    a 96-pixel frame, and in a real battle frame eleven new bosses came out at
    about half the size of the four originals, which are drawn to fill theirs.
    Measured, seven of them were carrying 20-30% empty height; the Kennelmaster
    filled 68% of its canvas. Cropped, they render at close to one screen pixel
    per drawn pixel, which is what the mob art was authored at.
    """
    op = [i for i, v in enumerate(s.px) if v]
    xs = [i % s.w for i in op]
    ys = [i // s.w for i in op]
    x0, x1 = max(0, min(xs) - margin), min(s.w - 1, max(xs) + margin)
    y0, y1 = max(0, min(ys) - margin), min(s.h - 1, max(ys) + margin)
    t = Sprite(x1 - x0 + 1, y1 - y0 + 1)
    t.pal = list(s.pal)
    for y in range(y0, y1 + 1):
        row = y * s.w
        for x in range(x0, x1 + 1):
            t.px[(y - y0) * t.w + (x - x0)] = s.px[row + x]
    return t


def boss(mob, at=(12, 24), behind=None, front=None, recolour=None):
    s = Sprite(BOSS, BOSS)
    if behind:
        paste(s, layer(behind), 0, 0)
    paste(s, mob(), at[0], at[1], recolour)
    if front:
        paste(s, layer(front), 0, 0)
    return crop(s).emit()


# ------------------------------------------------------------------ bosses ----

def the_juicer():
    """A troglodyte that found a use for people.

    Its tell is the veins standing out along its arms, so the veins are drawn
    on in front, where they cross the mob's own shading. The press is behind it
    and to one side: a tank with something red in it and a hose back to the
    creature, which is the whole of the joke and does not need a face.
    """
    def behind(s):
        glass = s.register_family(s.ramp((150, 190, 200), 5))
        juice = s.register_family(s.ramp((170, 40, 46), 5, name='blood'))
        steel = s.register_family(s.ramp((150, 152, 158), 5, name='steel'))
        #  No taller than the creature. It reached the top of the frame in the
        #  first pass, and once the renderer scaled the whole canvas to the
        #  boss's height the tank set the scale and the troglodyte came out
        #  small underneath it -- a prop should not be what sizes a boss.
        s.rect(64, 34, 88, 80, glass[1])                 # the tank
        s.rect(66, 50, 86, 78, juice[2])                 # what is in it
        s.rect(66, 50, 86, 52, juice[4])                 # its meniscus
        s.rect(66, 36, 67, 78, glass[4])                 # a highlight down the glass
        for y in (34, 58, 80):                           # the bands holding it
            s.rect(62, y - 1, 90, y + 1, steel[2])
        s.rect(62, 30, 90, 33, steel[3])                 # the lid
        s.limb(64, 60, 44, 50, 4, 4, steel[1:])          # the hose back to it

    def front(s):
        #  Placed from the grid, not by eye. The first pass put these at
        #  (24..50, 56..76), which is the slab it is carrying -- they read as
        #  red paint on a rock. Printed with togrid, the troglodyte's hide is
        #  the green column down its left side (mob x 18-29) and its thighs
        #  below row 54; the slab is the grey block between. Mob coordinates
        #  here are offset by the paste at (4, 24).
        vein = s.register_family(s.ramp((210, 60, 60), 4, name='blood'))
        for x0, y0, x1, y1 in ((26, 58, 29, 70), (29, 60, 31, 72),
                               (24, 64, 26, 76),                  # the arm
                               (28, 80, 32, 86), (44, 80, 46, 86)):  # the thighs
            s.line(x0, y0, x1, y1, vein[3])
            s.put(x1, y1, vein[1])

    return boss(bestiary.troglodyte, at=(4, 24), behind=behind, front=front)


def goblin_war_chief():
    """Sponsored. Finally.

    A war bonnet for the silhouette, because a chief is recognised from the
    top of the head down, and a sash in the sponsor's colours across the chest.
    Its tell is turning away to read what the deal is paying, so the free hand
    holds something lit -- the one piece of System hardware on a goblin.
    """
    def behind(s):
        feather = s.register_family(s.ramp((226, 214, 190), 5, name='cloth_cream'))
        tip = s.register_family(s.ramp((180, 60, 50), 4, name='cloth_red'))
        for i, (x, y) in enumerate(((26, 16), (32, 8), (40, 4), (48, 3),
                                    (56, 4), (64, 8), (70, 16))):
            s.limb(46, 34, x, y, 4, 3, feather)          # feathers fanning up
            s.form(x, y, 2, 3, tip, wrap=1.1)            # dipped tips

    def front(s):
        band = s.register_family(s.ramp((120, 70, 50), 5, name='copper'))
        gold = s.register_family(s.ramp((200, 160, 70), 5, name='gold'))
        glow = s.ink((104, 224, 190))
        s.rect(30, 30, 62, 35, band[2])                  # the bonnet's band
        for x in range(33, 60, 6):
            s.put(x, 32, gold[4])
        s.limb(34, 46, 62, 66, 5, 5, gold)               # the sponsor's sash
        s.form(48, 56, 3, 3, [gold[1], glow], wrap=1.2)  # and its logo
        s.rect(14, 56, 24, 66, band[0])                  # the tablet
        s.rect(15, 57, 23, 65, glow)
        s.line(16, 63, 22, 58, s.ink((236, 252, 244)))   # a figure going up

    return boss(bestiary.goblin_trapper, at=(12, 26), behind=behind, front=front)


def sapper_foreman():
    """It has requisitioned the whole quadrant.

    A hard hat between the ears and a belt of charges at the waist. The tell is
    the fuse burning at his belt, so one of the charges is lit and the spark is
    the brightest thing on the sprite.
    """
    def front(s):
        hat = s.register_family(s.ramp((226, 186, 60), 5, name='hair_blonde'))
        charge = s.register_family(s.ramp((180, 56, 48), 5, name='cloth_red'))
        strap = s.register_family(s.ramp((92, 62, 40), 4, name='wood_dark'))
        spark = s.ink((255, 236, 150))
        s.form(56, 40, 9, 5, hat, wrap=1.0, squash=0.3)  # the hard hat
        s.rect(46, 43, 66, 45, hat[1])                   # its brim
        s.line(56, 35, 56, 44, hat[4])                   # the ridge down it
        s.rect(38, 66, 64, 68, strap[2])                 # the belt
        for i in range(5):                               # the charges on it
            x = 40 + i * 5
            s.rect(x, 62, x + 3, 72, charge[2])
            s.rect(x, 62, x + 1, 72, charge[4])
        s.line(64, 64, 70, 58, s.ink((150, 130, 100)))   # the lit one's fuse
        for x, y in ((71, 57), (72, 56), (70, 56), (72, 58)):
            s.put(x, y, spark)

    return boss(bestiary.kobold_sapper, at=(12, 24), front=front)


def the_kennelmaster():
    """Whistles once. Everything with teeth comes.

    The alpha, so it keeps the hound's body and gets what marks it as the one
    the others answer to: a spiked collar, the chain it broke, and the whistle
    on the collar that the tell is about.
    """
    #  Placed from the grid. The first pass drew the collar at mob rows 20-42,
    #  which is the ear and the top of the shoulder, and it read as a red post
    #  stuck in the hound's back. Printed with togrid, the eyes are at rows
    #  34-37, the teeth at 46-48, and the head meets the body at x 20-24 across
    #  rows 36-50: that is the neck. Paste offset is (12, 24).
    def behind(s):
        chain = s.register_family(s.ramp((140, 144, 150), 4, name='steel'))
        for i in range(7):                               # the broken chain
            x, y = 38 + i * 7, 62 - i * 5
            s.form(x, y, 3, 2, chain, wrap=1.2)
            s.form(x, y, 1, 1, [0], wrap=1.0)

    def front(s):
        leather = s.register_family(s.ramp((70, 40, 36), 5, name='blood'))
        stud = s.register_family(s.ramp((200, 204, 210), 4, name='snow'))
        brass = s.register_family(s.ramp((200, 160, 70), 5, name='gold'))
        s.limb(35, 58, 33, 76, 6, 6, leather)            # the collar, on the neck
        for i in range(5):                               # its spikes
            y = 60 + i * 4
            s.line(37, y, 41, y - 1, stud[3])
            s.put(41, y - 1, stud[0])
        s.form(33, 79, 3, 2, brass, wrap=1.0)            # the whistle, hanging
        s.line(33, 76, 33, 78, brass[4])

    return boss(bestiary.bramble_hound, at=(12, 24), behind=behind, front=front)


def bailiff_prime():
    """Serving papers on the entire floor.

    The court, worn: a full-bottomed wig framing the skull, the chain of office
    across the chest, and the warrant itself in the free hand -- unrolled,
    because the tell is that he stops to read it aloud.
    """
    def front(s):
        wig = s.register_family(s.ramp((230, 224, 208), 5, name='cloth_cream'))
        gold = s.register_family(s.ramp((200, 160, 70), 5, name='gold'))
        paper = s.register_family(s.ramp((230, 220, 190), 4, name='sand'))
        ink = s.ink((70, 60, 60))
        s.form(42, 26, 12, 5, wig, wrap=1.1)             # the wig's crown
        for side in (26, 58):                            # its lappets, in curls
            for k in range(5):
                s.form(side, 30 + k * 6, 4, 3, wig, wrap=1.2)
        s.limb(30, 60, 42, 68, 3, 3, gold)               # the chain of office
        s.limb(42, 68, 54, 60, 3, 3, gold)
        s.form(42, 70, 4, 4, gold, wrap=0.9)             # its badge
        s.rect(4, 46, 18, 86, paper[2])                  # the warrant, unrolled
        s.form(11, 46, 7, 2, paper, wrap=1.0)            # rolled at the top
        s.form(11, 86, 7, 2, paper, wrap=1.0)            # and the bottom
        for y in range(52, 82, 4):
            s.line(7, y, 15, y, ink)                     # its lines of charge
        s.form(11, 78, 2, 2, s.register_family(s.ramp((180, 40, 40), 3, name='blood')))

    return boss(bestiary.bone_bailiff, at=(16, 24), front=front)


def street_preacher():
    """Has been expecting you. Personally.

    The same bone the Bailiff Prime is built on, and it has to be told apart
    from him at a glance -- they were one sprite. So the robe is sackcloth
    instead of court blue, there is a sandwich board where the chain of office
    was, and the free hand holds a bullhorn: the tell is that he turns to
    address the balcony.
    """
    def front(s):
        wood = s.register_family(s.ramp((140, 96, 56), 5, name='wood'))
        board = s.register_family(s.ramp((226, 220, 200), 4, name='cloth_cream'))
        paint = s.ink((170, 40, 40))
        horn = s.register_family(s.ramp((220, 214, 200), 5, name='snow'))
        band = s.register_family(s.ramp((180, 50, 46), 4, name='cloth_red'))
        s.rect(34, 58, 64, 88, wood[1])                  # the sandwich board
        s.rect(36, 60, 62, 86, board[2])
        for y, w in ((64, 22), (69, 16), (74, 20), (79, 12)):
            s.line(38, y, 38 + w, y, paint)              # its lettering, unread
        s.line(36, 58, 40, 44, wood[2])                  # its straps
        s.line(62, 58, 58, 44, wood[2])
        s.poly([(30, 38), (10, 26), (10, 42)], horn[2])  # the bullhorn
        s.poly([(30, 38), (18, 31), (18, 40)], horn[4])
        s.form(10, 34, 3, 8, horn[1:], wrap=1.0)         # its bell
        s.rect(26, 36, 30, 40, band[2])                  # the grip

    return boss(bestiary.bone_bailiff, at=(18, 24), front=front,
                recolour=swap({'cloth_blue': 'sand', 'hair_blue': 'sand',
                               'water': 'sand'}))


def the_doorman():
    """The list got shorter. You were on it.

    A rope line in front of him -- the velvet and two brass posts -- is the
    whole idea of a door he is standing in, and the earpiece and clipboard say
    who he is working for. The tell is him setting his weight, which the stance
    already does.
    """
    def front(s):
        brass = s.register_family(s.ramp((200, 160, 70), 5, name='gold'))
        velvet = s.register_family(s.ramp((150, 30, 50), 5, name='cloth_red'))
        coil = s.ink((200, 200, 196))
        board = s.register_family(s.ramp((140, 96, 56), 4, name='wood'))
        paper = s.ink((230, 224, 210))
        for x in (6, 88):                                # the posts
            s.rect(x - 1, 70, x + 1, 94, brass[2])
            s.form(x, 69, 3, 3, brass, wrap=0.9)
            s.rect(x - 4, 93, x + 4, 95, brass[1])
        for x in range(8, 88):                           # the rope, swagged
            y = 74 + int(8 * (1 - ((x - 47) / 40.0) ** 2))
            s.rect(x, y, x, y + 2, velvet[2] if x % 5 else velvet[3])
        for y in range(36, 54, 2):                       # the earpiece coil
            s.put(62 + (y // 2) % 2, y, coil)
        s.rect(70, 54, 84, 72, board[1])                 # the list
        s.rect(72, 58, 82, 70, paper)
        for y in range(60, 70, 3):
            s.line(73, y, 81, y, board[0])
        s.rect(75, 53, 79, 56, brass[3])                 # its clip

    return boss(bestiary.club_bouncer, at=(12, 22), front=front)


def house_mimic():
    """It was the room. It was always the room.

    A box that has been a room long enough to have furnished itself: a lamp on
    its lid and a picture hanging off its side. The joke is that it is domestic,
    so nothing added is a weapon.
    """
    def behind(s):
        frame = s.register_family(s.ramp((160, 120, 60), 5, name='wood'))
        canvas_ = s.register_family(s.ramp((110, 150, 120), 4, name='leaves'))
        s.rect(2, 34, 20, 56, frame[1])                  # the frame
        s.rect(4, 36, 18, 54, canvas_[2])
        s.form(11, 44, 5, 4, canvas_[1:], wrap=1.1)      # a landscape in it
        s.line(11, 34, 20, 28, frame[3])                 # its hanging wire

    def front(s):
        shade = s.register_family(s.ramp((236, 214, 160), 5, name='sand'))
        stem = s.register_family(s.ramp((180, 150, 90), 4, name='gold'))
        glow = s.ink((255, 240, 190))
        s.rect(51, 16, 53, 28, stem[2])                  # the lamp's stem
        s.rect(46, 26, 58, 28, stem[1])                  # its base
        s.poly([(44, 16), (60, 16), (56, 4), (48, 4)], shade[2])  # its shade
        s.poly([(48, 4), (52, 4), (48, 16), (44, 16)], shade[4])
        s.line(45, 17, 59, 17, glow)                     # the light under it

    return boss(bestiary.neon_mimic, at=(18, 24), behind=behind, front=front)


def silk_road_toll():
    """Everything that passes pays. You are passing.

    The House Mimic's own box, and they were one sprite, so it is recoloured to
    lacquer and gold and given a barrier arm: a toll, not a room. Its tell is
    opening its ledger to price you, so the ledger is open and in front.
    """
    def behind(s):
        white = s.register_family(s.ramp((226, 226, 220), 4, name='snow'))
        red = s.register_family(s.ramp((180, 40, 40), 4, name='cloth_red'))
        post = s.register_family(s.ramp((100, 100, 108), 4, name='stone'))
        s.rect(20, 40, 25, 94, post[2])                  # the barrier post
        for i in range(8):                               # its striped arm
            x = 0 + i * 4
            s.rect(x, 40, x + 3, 45, (red if i % 2 else white)[2])

    def front(s):
        gold = s.register_family(s.ramp((210, 170, 70), 5, name='gold'))
        page = s.register_family(s.ramp((236, 228, 200), 4, name='sand'))
        ink = s.ink((70, 60, 60))
        for x, y in ((30, 91), (38, 93), (46, 90), (60, 92), (70, 91), (54, 94)):
            s.form(x, y, 3, 2, gold, wrap=0.9)           # what has been paid
        s.rect(70, 60, 92, 78, page[2])                  # the ledger, open
        s.line(81, 60, 81, 78, page[0])                  # its spine
        for y in range(63, 76, 3):
            s.line(72, y, 79, y, ink)
            s.line(83, y, 90, y, ink)

    return boss(bestiary.neon_mimic, at=(20, 24), behind=behind, front=front,
                recolour=swap({'cloth_blue': 'cloth_red', 'water': 'cloth_red',
                               'hair_blue': 'cloth_red', 'ice': 'gold',
                               'lightning': 'gold'}))


def carrion_anchor():
    """Live from the top of the pile.

    A vulture behind a news desk. The desk is the silhouette -- a bird in front
    of a long flat shape reads as broadcasting before anything else does -- and
    a microphone on a stalk and a tie on the neck finish it.
    """
    def front(s):
        desk = s.register_family(s.ramp((90, 60, 44), 5, name='wood_dark'))
        trim = s.register_family(s.ramp((200, 160, 70), 4, name='gold'))
        tie = s.register_family(s.ramp((170, 36, 44), 4, name='cloth_red'))
        mic = s.register_family(s.ramp((60, 62, 70), 4, name='cloth_black'))
        s.poly([(52, 58), (56, 58), (58, 72), (54, 76), (50, 72)], tie[2])  # the tie
        s.rect(4, 72, 92, 95, desk[1])                   # the desk
        s.rect(4, 72, 92, 75, desk[3])                   # its top
        s.rect(4, 80, 92, 81, trim[2])                   # the network's rule
        s.form(48, 88, 6, 3, trim, wrap=1.0)             # and its logo
        s.line(74, 72, 70, 58, mic[2])                   # the mic's stalk
        s.form(69, 56, 3, 3, mic, wrap=1.0)              # the mic

    return boss(bestiary.vulture_fan, at=(12, 12), front=front)


def ratings_spike():
    """Numbers are up. That is your fault.

    The Carrion Anchor's bird, and they were one sprite. So this one is lit in
    the System's own colours and stands in front of the thing its name is: a
    ratings line climbing off the top of the frame. The tell is the numbers
    spiking, and they are behind it the whole fight.
    """
    def behind(s):
        glow = s.ink((104, 224, 190))
        hot = s.ink((236, 252, 244))
        pts = ((2, 92), (16, 80), (26, 86), (40, 62), (52, 70), (66, 38),
               (76, 46), (92, 4))
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            s.line(x0, y0, x1, y1, glow, 3)
            s.line(x0, y0 - 1, x1, y1 - 1, hot)
        s.poly([(92, 2), (84, 6), (90, 12)], glow)       # the arrowhead

    def front(s):
        spark = s.ink((255, 240, 150))
        for x, y in ((30, 20), (70, 18), (22, 44), (80, 40)):
            s.line(x - 3, y, x + 3, y, spark)
            s.line(x, y - 3, x, y + 3, spark)

    return boss(bestiary.vulture_fan, at=(12, 24), behind=behind, front=front,
                recolour=swap({'cloth_black': 'arcane', 'stone': 'arcane',
                               'stone_ancient': 'cloth_purple'}))
