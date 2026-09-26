"""Hand-drawn overworld grids: the party, from above and in front.

Drawn to the conventions of the handheld overworld -- the Gen 3 and 4 trainer
sprites, and Stardew's villagers:

  * The head is about half the height. At sixteen pixels a realistic head is
    four pixels wide and there is nowhere to put a face.
  * A one-pixel outline all round the silhouette, darkest on the outside and
    tinted by what it wraps, so a figure never melts into the floor.
  * Three tones per material, lit from the upper left: a highlight, the base,
    and a shadow that shifts cool rather than just going darker -- which is
    most of why Stardew's pixels read as warm and soft rather than muddy.
  * Eyes are one pixel wide and two tall. Nothing else says "face" at this
    size so cheaply.

Each grid is the figure from the top of the head down to where the legs
start; overworld.py draws the legs, because they are what the walk animates.
Characters are keys into the sprite's own palette; '.' is transparent.
"""

from palettes import RAMPS as R

W = 16

# ------------------------------------------------------------------ carl ---

CARL_PAL = {
    'o': (0x2a, 0x1f, 0x24),                       # outline: warm near-black
    'k': (0x3a, 0x26, 0x1c), 'h': (0x5e, 0x3e, 0x28), 'H': (0x86, 0x5a, 0x38),
    'z': (0xb4, 0x8e, 0x84),                        # stubble
    's': R['skin'][4], 'S': R['skin'][3], 'T': R['skin'][2], 'l': R['skin'][5],
    'e': (0x2a, 0x1f, 0x24),
    'g': R['cloth_green'][1], 'j': R['cloth_green'][2], 'J': R['cloth_green'][3],
    'W': R['cloth_cream'][4], 'w': R['cloth_cream'][2], 'r': R['blood'][3],
    't': R['steel'][3], 'u': R['steel'][2],
}

#  The jacket is open: a strip of chest shows down the middle, which is the
#  only way a front view says "jacket" rather than "green jumper".
CARL_DOWN = [
    ".....oooooo.....",
    "...oohHHHhhoo...",
    "..ohHHHhhhhhko..",
    ".ohHHhhhhhhhhko.",
    ".ohhhhhhhhhhkko.",
    ".okhhhhhhhhhhko.",
    ".oskkkssssskkko.",
    ".okssessssesSko.",
    ".oSssessssesSSo.",
    ".ozzsssskksszzo.",
    "..ozzzzzSzzzzo..",
    ".ogjjJJttJJjjgo.",
    "ogjJjjgtugjjjjgo",
    "ogjJjjgtugjjjjgo",
    "osgjjjgWwgjjjgso",
    ".ooWWWWWWWWWwoo.",
    "..oWrWWWWWrWwo..",
]

CARL_UP = [
    ".....oooooo.....",
    "...oohHHHhhoo...",
    "..ohHHHhhhhhko..",
    ".ohHHhhhhhhhhko.",
    ".ohHhhhhhhhhhko.",
    ".ohhhhhhhhhhkko.",
    ".okhhhhhhhhhkko.",
    ".okhhhhhhhhkkko.",
    ".okkhhhhhhhkkko.",
    ".oSkkkkkkkkkkSo.",
    "..oSSSSSSSSSSo..",
    ".ogjJjjjjjjjjgo.",
    "ogjJjjjjjjjjjjgo",
    "ogjJjjjjjjjjjggo",
    "osgjjjjjjjjjjgso",
    ".ooWWWWWWWWWwoo.",
    "..oWWrWWWWrWwo..",
]

#  Facing right; the renderer mirrors it for left.
CARL_SIDE = [
    "....oooooo......",
    "..oohHHHhhoo....",
    ".ohHHHhhhhhko...",
    ".ohHhhhhhhhhko..",
    "ohhhhhhhhhhhhko.",
    "okhhhhhhhhhhhko.",
    "okkhhhhsskkkkso.",
    "okkhhSssssssesso",
    ".okhSsssssssesso",
    ".okSsssssskkzzo.",
    "..oSzzzzzzzzTo..",
    "...ogjJjjjjgo...",
    "...ogjJjgjjgo...",
    "...ogjjJgjjgo...",
    "...ogjjjgsSgo...",
    "...oWWWWSWWwo...",
    "...oWrWWWWrwo...",
]


# ----------------------------------------------------------------- donut ---

#  A cat, on four feet, trotting at Carl's heel -- the way a partner walks
#  behind its trainer in the handheld games, which is what the two of them
#  are. Standing upright with ears on, she read as a person in a crown.
DONUT_PAL = {
    #  A brown tabby Persian: dark coat, golden guard hairs, a tan muzzle.
    'o': (0x24, 0x17, 0x12),
    'F': (0xa8, 0x7a, 0x46), 'f': (0x72, 0x4e, 0x2e), 'd': (0x54, 0x38, 0x22),
    'D': (0x38, 0x26, 0x18), 'g': (0xd8, 0xae, 0x6a),
    'c': (0xa8, 0x7e, 0x4c), 'C': (0x8a, 0x64, 0x3c),
    'p': (0x54, 0x38, 0x22), 'n': (0xe0, 0x8a, 0x8a),   # inner ear: the dark fur, for a 4bpp slot
    'e': (0x9c, 0xc4, 0x4c), 'E': (0x1c, 0x12, 0x10), 'w': (0xff, 0xfb, 0xe8),
    'Y': (0xde, 0xb2, 0x48), 'y': (0xae, 0x80, 0x2e), 'P': R['arcane'][2],
}

def _painted(rows, shapes, marks):
    """A grid from filled shapes, shaded from the upper left and outlined
    automatically: the side-on cat is curves all the way round, and typing a
    curve by hand one row at a time is how the first one came out a dog.

    shapes: (kind, args, light, base, dark) drawn in order.
    marks: {(x, y): key} placed last, for the face and the jewellery."""
    g = [['.'] * W for _ in range(rows)]
    for kind, a, light, base, dark in shapes:
        if kind == 'ellipse':
            cx, cy, rx, ry = a
            for y in range(rows):
                for x in range(W):
                    dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                    d = dx * dx + dy * dy
                    if d <= 1.0:
                        #  Which way this bit of the surface faces: up and
                        #  left catches the light, down and right does not.
                        lit = -dx * 0.7 - dy * 0.7
                        g[y][x] = light if lit > 0.45 and d > 0.25 else \
                            dark if lit < -0.35 and d > 0.3 else base
        elif kind == 'pixels':
            for x, y in a:
                g[y][x] = base
    for (x, y), k in marks.items():
        g[y][x] = k
    #  The outline: every empty pixel touching the figure along an edge.
    out = [r[:] for r in g]
    for y in range(rows):
        for x in range(W):
            if g[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < rows and g[ny][nx] not in '.':
                    out[y][x] = 'o'
                    break
    return [''.join(r) for r in out]


#  A small cat. Carl is twenty pixels tall; a cat sitting at his heel comes
#  up to his knee, so she is about twelve -- crown included -- in the bottom
#  of the same sixteen by twenty box, with the top of it left empty.
_CROWN = {(5, 4): 'Y', (7, 4): 'Y', (9, 4): 'Y',
          (5, 5): 'Y', (6, 5): 'Y', (7, 5): 'P', (8, 5): 'Y', (9, 5): 'Y',
          (5, 6): 'y', (6, 6): 'y', (7, 6): 'y', (8, 6): 'y', (9, 6): 'y'}
_COLLAR = {(5, 14): 'P', (6, 14): 'P', (7, 14): 'P', (8, 14): 'P', (9, 14): 'P',
           (10, 14): 'P', (7, 15): 'Y'}
_HEAD = [('pixels', [(3, 7), (4, 7), (4, 8), (12, 7), (11, 7), (11, 8)], 'f', 'f', 'd'),
         ('ellipse', (8, 10.8, 5.4, 3.9), 'F', 'f', 'd'),
         ('pixels', [(2, 11), (13, 11), (2, 12), (13, 12)], 'f', 'f', 'd')]

DONUT_DOWN = _painted(17, [
    ('ellipse', (8, 15.0, 5.0, 2.4), 'F', 'f', 'd'),
] + _HEAD, {**_CROWN, **_COLLAR, **{
    (4, 8): 'p', (11, 8): 'p',
    (5, 10): 'w', (6, 10): 'E', (5, 11): 'E', (6, 11): 'e',
    (9, 10): 'w', (10, 10): 'E', (9, 11): 'E', (10, 11): 'e',
    (7, 12): 'n', (8, 12): 'n', (6, 12): 'c', (9, 12): 'c', (7, 13): 'c', (8, 13): 'c',
    (4, 9): 'g', (11, 9): 'g', (3, 13): 'g', (12, 15): 'g',
}})

DONUT_UP = _painted(17, [
    ('pixels', [(13, 14), (14, 13), (14, 12), (14, 11), (13, 10)], 'f', 'f', 'd'),
    ('ellipse', (8, 15.0, 5.0, 2.4), 'F', 'f', 'd'),
] + _HEAD, {**_CROWN, **{
    (7, 5): 'Y',
    (4, 14): 'P', (5, 14): 'P', (6, 14): 'P', (7, 14): 'P', (8, 14): 'P', (9, 14): 'P',
    (10, 14): 'P', (11, 14): 'P',
    (6, 9): 'g', (9, 9): 'g', (7, 11): 'd', (8, 11): 'd', (4, 12): 'g', (11, 12): 'g',
    (14, 11): 'F',
}})


#  Facing right: a round head up front, a round body behind it, the tail up
#  in a curl, all of it knee-high to Carl.
DONUT_SIDE = _painted(17, [
    ('pixels', [(2, 15), (2, 14), (1, 13), (1, 12), (2, 11), (2, 10)], 'f', 'f', 'd'),
    ('ellipse', (7.0, 14.8, 4.8, 2.3), 'F', 'f', 'd'),
    ('pixels', [(9, 7), (9, 8), (10, 8)], 'f', 'f', 'f'),
    ('ellipse', (11.2, 11.4, 3.4, 3.0), 'F', 'f', 'd'),
], {
    (11, 6): 'Y', (13, 6): 'Y', (11, 7): 'Y', (12, 7): 'P', (13, 7): 'Y',
    (11, 8): 'y', (12, 8): 'y', (13, 8): 'y',
    (9, 8): 'p',
    (12, 10): 'E', (12, 11): 'e', (14, 11): 'n', (13, 12): 'c', (14, 12): 'c',
    (9, 13): 'P', (10, 13): 'P', (10, 14): 'Y',
    (5, 13): 'g', (7, 15): 'g', (2, 11): 'g',
})


# -------------------------------------------------------------- mordecai ---

#  The game guide as the first floor has him: a Rat Hooligan. Round ears, a
#  snout, grey fur and a white beard, a black vest, blue trousers, and his
#  hands wrung together in front of him. The ears are the silhouette.
MORD_PAL = {
    'o': (0x22, 0x1e, 0x24),
    'h': (176, 172, 178), 'g': (140, 136, 144), 'G': (100, 96, 106),
    'p': (222, 160, 164), 'P': (170, 110, 120),
    'e': (0x16, 0x12, 0x18), 'w': (214, 212, 216),
    'k': (44, 42, 50), 'K': (74, 72, 82),
    'j': (70, 96, 160), 'J': (50, 70, 124),
}

MORD_DOWN = [
    "................",
    ".ooo........ooo.",
    "ophpo......ophpo",
    "oppgoooooooogppo",
    ".ooghhhhhhhhgoo.",
    "..oghhhhhhhhgo..",
    "..ohhehhhhehgo..",
    "..ohhhhpphhhgo..",
    "..oghhhhhhhggo..",
    "...ogwhhhhwgo...",
    "....owhPPhwo....",
    "..ookowwwwokoo..",
    ".okkKkwwwwkkkko.",
    ".ogkKkkwwkkkkgo.",
    ".ogkKgpppPgkkgo.",
    ".oGkkkgppgkkkGo.",
    "..ojjjjjjjjJJo..",
]

MORD_UP = [
    "................",
    ".ooo........ooo.",
    "ogggo......ogggo",
    "ogggoooooooogggo",
    ".ooghhhhhhhhgoo.",
    "..oghhhhhhhhgo..",
    "..oghhhhhhhhgo..",
    "..oghhhhhhhggo..",
    "..ogghhhhhhggo..",
    "...oggggggggo...",
    "....ogggGggo....",
    "..ookkkkkkkkoo..",
    ".okkKkkkkkkkkko.",
    ".ogkKkkkkkkkkgo.",
    ".ogkKkkkkkkkkgo.",
    ".oGkkkkkkkkkkGo.",
    "..ojjjjjjjjJJo..",
]

MORD_SIDE = [
    "................",
    "....ooo.........",
    "...ophpo........",
    "...ophpooooo....",
    "....oohhhhhho...",
    "....oghhhhhhoo..",
    "....oghhhhehhho.",
    "....ogghhhhhhhPo",
    "....oggghhwwwoo.",
    ".....oggwwwwo...",
    "......owwwo.....",
    ".....okkkgo.....",
    "....okkKkgo.....",
    "....okkKgppo....",
    "....okkkgppo....",
    "....oGkkkgo.....",
    ".opPojjjjjo.....",
]


# ----------------------------------------------------------------- bopca ---

#  Stout, green-tinted and shaggy all over, a small face peering out of the
#  hair, a big nose, an apron -- they are good cooks -- and a coin pouch,
#  because giving discounts goes against their nature.
BOPCA_PAL = {
    'o': (0x26, 0x22, 0x18),
    'H': (150, 136, 90), 'h': (122, 110, 72), 'g': (84, 76, 52),
    's': (154, 190, 112), 'S': (112, 150, 86), 'n': (180, 204, 128),
    'e': (0x14, 0x14, 0x10),
    'a': (226, 220, 200), 'A': (176, 160, 130), 'b': (130, 88, 50),
}

BOPCA_DOWN = [
    "................",
    "................",
    "................",
    ".....oooooo.....",
    "...ooHHhhhhoo...",
    "..oHHhhhhhhhgo..",
    "..oHhHhhhhhhgo..",
    ".oHhsesssesshgo.",
    ".oHhsssnnssShgo.",
    ".oHhhSsssSShhgo.",
    ".oHhhhhhhhhhhgo.",
    "ohHhhaaaaaahhhgo",
    "ohHhhaaaaaAhhhgo",
    "osHhhaaaaaAbhgso",
    "oSHhhaaaaaAbhgSo",
    ".ohhhaAAAAAhhgo.",
    "..ohhhhhhhhhgo..",
]

BOPCA_UP = [
    "................",
    "................",
    "................",
    ".....oooooo.....",
    "...ooHHhhhhoo...",
    "..oHHhhhhhhhgo..",
    "..oHhhhhhhhhgo..",
    ".oHhhhhhhhhhhgo.",
    ".oHhhhhhhhhhhgo.",
    ".oHhhhhhhhhhhgo.",
    ".oHhhhhhhhhhhgo.",
    "ohHhhhhaahhhhhgo",
    "ohHhhhhhhhhhhhgo",
    "osHhhhhhhhhhhgso",
    "oSHhhhhhhhhhhgSo",
    ".ohhhhhhhhhhhgo.",
    "..ohhhhhhhhhgo..",
]

BOPCA_SIDE = [
    "................",
    "................",
    "................",
    "......oooo......",
    "....ooHhhhoo....",
    "...oHHhhhhhgo...",
    "...oHhhhhhhhgo..",
    "..oHhhhhhssesso.",
    "..oHhhhhhsssnno.",
    "..oHhhhhhhSssgo.",
    "..oHhhhhhhhhhgo.",
    "..ohHhhhhhhaago.",
    "..ohHhhhhhhaAgo.",
    "..ohHhhhhhsaAgo.",
    "..ohHhhhhhSaAgo.",
    "...ohhhhhhhhgo..",
    "....ohhhhhhgo...",
]


def check(name, grid, rows):
    assert len(grid) == rows, "%s: %d rows, wanted %d" % (name, len(grid), rows)
    for i, r in enumerate(grid):
        assert len(r) == W, "%s row %d is %d wide: %r" % (name, i, len(r), r)
