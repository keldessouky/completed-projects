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
    'k': (0x3a, 0x29, 0x25), 'h': (0x52, 0x3a, 0x30), 'H': (0x7a, 0x58, 0x44),
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
    'o': (0x3d, 0x22, 0x1c),
    'F': (0xfb, 0xcf, 0x9c), 'f': (0xf0, 0xae, 0x74), 'd': (0xd4, 0x86, 0x52),
    'D': (0xa4, 0x5c, 0x38),
    'c': (0xf6, 0xe3, 0xbd), 'C': (0xe0, 0xc2, 0x92),
    'p': (0xf0, 0x94, 0x8e), 'n': (0xe8, 0x80, 0x88),
    'e': (0x8c, 0xc0, 0x5a), 'E': (0x2a, 0x1c, 0x1c), 'w': (0xff, 0xfb, 0xf0),
    'Y': R['gold'][4], 'y': R['gold'][2], 'P': R['arcane'][2],
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


#  A floof, head-on and from behind: a round head set in a rounder body,
#  tufts breaking the outline at the cheeks and flanks, a cream ruff, big eyes
#  with a glint, a small crown perched on the lot.
_EARS = [(2, 1), (2, 2), (3, 2), (3, 3), (13, 1), (13, 2), (12, 2), (12, 3)]
_TUFTS = [(0, 9), (15, 9), (0, 10), (15, 10), (1, 13), (14, 13), (0, 14), (15, 14)]
_CROWN = {(5, 0): 'Y', (7, 0): 'Y', (8, 0): 'Y', (10, 0): 'Y',
          (5, 1): 'Y', (6, 1): 'Y', (7, 1): 'P', (8, 1): 'P', (9, 1): 'Y', (10, 1): 'Y',
          (5, 2): 'y', (6, 2): 'y', (7, 2): 'y', (8, 2): 'y', (9, 2): 'y', (10, 2): 'y'}

DONUT_DOWN = _painted(17, [
    ('ellipse', (8, 14.0, 6.6, 3.8), 'F', 'f', 'd'),
    ('pixels', _TUFTS, 'f', 'f', 'd'),
    ('pixels', _EARS, 'f', 'f', 'd'),
    ('ellipse', (8, 7.8, 7.2, 5.4), 'F', 'f', 'd'),
], {**_CROWN, **{
    (2, 2): 'p', (13, 2): 'p',
    (4, 6): 'E', (5, 6): 'E', (4, 7): 'w', (5, 7): 'E', (4, 8): 'e', (5, 8): 'E',
    (10, 6): 'E', (11, 6): 'E', (10, 7): 'w', (11, 7): 'E', (10, 8): 'e', (11, 8): 'E',
    (3, 9): 'p', (12, 9): 'p', (7, 9): 'n', (8, 9): 'n',
    (4, 10): 'c', (5, 10): 'c', (6, 10): 'c', (7, 10): 'D', (8, 10): 'D', (9, 10): 'c',
    (10, 10): 'c', (11, 10): 'c', (0, 10): 'c', (15, 10): 'c',
    (2, 11): 'c', (3, 11): 'c', (4, 11): 'c', (5, 11): 'c', (6, 11): 'c', (7, 11): 'c',
    (8, 11): 'c', (9, 11): 'c', (10, 11): 'c', (11, 11): 'c', (12, 11): 'c', (13, 11): 'c',
    (3, 12): 'C', (4, 12): 'c', (5, 12): 'c', (6, 12): 'P', (7, 12): 'P', (8, 12): 'P',
    (9, 12): 'P', (10, 12): 'c', (11, 12): 'c', (12, 12): 'C',
    (5, 13): 'c', (6, 13): 'c', (7, 13): 'Y', (8, 13): 'y', (9, 13): 'c', (10, 13): 'c',
    (5, 14): 'c', (6, 14): 'c', (7, 14): 'c', (8, 14): 'c', (9, 14): 'c', (10, 14): 'C',
    (6, 15): 'c', (7, 15): 'c', (8, 15): 'c', (9, 15): 'C',
    (6, 4): 'd', (9, 4): 'd',
}})

DONUT_UP = _painted(17, [
    ('pixels', [(13, 12), (14, 11), (14, 10), (15, 9), (15, 8), (14, 7), (13, 11), (13, 10),
                (14, 9)], 'f', 'f', 'd'),
    ('ellipse', (8, 14.0, 6.6, 3.8), 'F', 'f', 'd'),
    ('pixels', _TUFTS, 'f', 'f', 'd'),
    ('pixels', _EARS, 'f', 'f', 'd'),
    ('ellipse', (8, 7.8, 7.2, 5.4), 'F', 'f', 'd'),
], {**_CROWN, **{
    (7, 1): 'Y', (8, 1): 'Y',
    (6, 5): 'd', (9, 5): 'd', (7, 6): 'd', (8, 6): 'd',
    (0, 10): 'c', (15, 10): 'c',
    (4, 12): 'P', (5, 12): 'P', (6, 12): 'P', (7, 12): 'P', (8, 12): 'P', (9, 12): 'P',
    (10, 12): 'P', (11, 12): 'P',
    (14, 8): 'F', (15, 9): 'F',
}})


#  Facing right: a big round head up front, a round body behind it, and the
#  tail up in a curl -- proportions of a partner creature, not of a cat.
DONUT_SIDE = _painted(17, [
    ('pixels', [(1, 13), (1, 12), (1, 11), (1, 10), (2, 9), (2, 8), (2, 7), (3, 6),
                (3, 5), (2, 4), (2, 12), (2, 11)], 'f', 'f', 'd'),
    ('ellipse', (6.5, 13.0, 5.2, 3.6), 'F', 'f', 'd'),
    ('pixels', [(7, 2), (7, 3), (8, 3), (7, 4), (8, 4), (9, 4)], 'f', 'f', 'f'),
    ('pixels', [(0, 12), (0, 14), (4, 9), (6, 9), (12, 11), (8, 16), (3, 16)], 'f', 'f', 'd'),
    ('ellipse', (10.4, 7.0, 4.1, 3.9), 'F', 'f', 'd'),
    ('pixels', [(6, 6), (6, 8), (15, 6)], 'f', 'f', 'd'),
], {
    (9, 10): 'c', (10, 10): 'c', (8, 9): 'c', (13, 10): 'c',

    (7, 3): 'p', (8, 4): 'p',
    (10, 2): 'Y', (11, 2): 'P', (12, 2): 'Y', (10, 1): 'Y', (12, 1): 'Y', (10, 3): 'y', (11, 3): 'y', (12, 3): 'y',
    (7, 10): 'P', (8, 10): 'P', (9, 11): 'P',
    (11, 6): 'e', (11, 7): 'E', (12, 6): 'e', (12, 7): 'E',
    (12, 8): 'c', (13, 8): 'c', (13, 9): 'c', (12, 9): 'C', (11, 9): 'c', (14, 7): 'n', (13, 7): 'c',
    (14, 8): 'c', (11, 10): 'C', (12, 10): 'C',
    (9, 14): 'c', (10, 14): 'c', (8, 15): 'c', (9, 15): 'c', (10, 15): 'C', (11, 14): 'C',
    (2, 3): 'F', (3, 4): 'F',
})


# -------------------------------------------------------------- mordecai ---

#  The game guide: green, four eyes, a grey beard, a flat black hat wider
#  than he is and a robe to the floor. The hat is the silhouette -- nothing
#  else in the dungeon has a brim.
MORD_PAL = {
    'o': (0x22, 0x1e, 0x2a),
    'A': R['cloth_purple'][3], 'a': R['cloth_purple'][2], 'z': R['cloth_purple'][1],
    'Z': R['cloth_purple'][0],
    's': (0xa3, 0xb0, 0x7e), 'S': (0x7b, 0x8c, 0x5c), 'T': (0x57, 0x66, 0x44),
    'h': R['hair_silver'][2], 'H': R['hair_silver'][3],
    'e': R['gold'][4], 'Y': R['gold'][3], 'k': R['cloth_black'][1],
    'B': R['cloth_black'][3], 'b': R['cloth_black'][2], 'x': R['cloth_black'][0],
}

MORD_DOWN = [
    "................",
    "................",
    ".....oooooo.....",
    "....oBbbbbxo....",
    ".ooxxxxxxxxxxoo.",
    "oBbbbbbbbbbbxxxo",
    ".ooosssssssssoo.",
    "..osesssssesso..",
    "..oSsesssessSo..",
    "..ohhSSTTSShho..",
    "...ohhhhhhhho...",
    "..oaAAaYYazzzo..",
    ".oaAaaaYYaazzzo.",
    ".saAaaaaaaazzzs.",
    ".oaAaaaaaaazzzo.",
    ".oaAaaaaaaazzzo.",
    "..ozzzzzzzzZZo..",
    "..oZZZZZZZZZZo..",
]

MORD_UP = [
    "................",
    "................",
    ".....oooooo.....",
    "....oBbbbbxo....",
    ".ooxxxxxxxxxxoo.",
    "oBbbbbbbbbbbxxxo",
    ".ooosssssssssoo.",
    "..osssssssssso..",
    "..osssssssssso..",
    "..oSsssssssssSo.",
    "...oSSSSSSSSo...",
    "..oaAAaaaazzzo..",
    ".oaAaaaaaaazzzo.",
    ".saAaaaaaaazzzs.",
    ".oaAaaaaaaazzzo.",
    ".oaAaaaaaaazzzo.",
    "..ozzzzzzzzZZo..",
    "..oZZZZZZZZZZo..",
]

MORD_SIDE = [
    "................",
    "................",
    "......oooooo....",
    ".....oBbbbbxo...",
    "..ooxxxxxxxxxoo.",
    ".oBbbbbbbbbbxxxo",
    "..oooSssssssooo.",
    "....oSsssssesso.",
    "....oSsssssesso.",
    "....oSShhhhhhso.",
    ".....ohhhhhho...",
    "....oaAAaazzo...",
    "...oaAaaaazzzo..",
    "...oaAaazsszzo..",
    "...oaAaaazzzzo..",
    "...oaAaaaazzzo..",
    "...ozzzzzzzZZo..",
    "...oZZZZZZZZZo..",
]


# ----------------------------------------------------------------- bopca ---

#  Small, tawny, all ears, in a red coat with a white front.
BOPCA_PAL = {
    'o': (0x33, 0x24, 0x1c),
    'l': R['wood'][4], 's': R['wood'][3], 'S': R['wood'][2], 'T': R['wood'][1],
    'p': R['cloth_red'][4],
    'e': (0x26, 0x20, 0x24),
    'R': R['blood'][4], 'r': R['blood'][3], 'q': R['blood'][2],
    'c': R['cloth_cream'][4],
}

BOPCA_DOWN = [
    ".oo..........oo.",
    ".olo........oSo.",
    ".olpo......opSo.",
    "..olpo....opSo..",
    "..olpooooooSSo..",
    "...ollssssssSo..",
    "..olssssssssSSo.",
    "..olsesssssesSo.",
    "..osseSssssesSo.",
    "..oSsssppsssSSo.",
    "...oSSSSSSSSTo..",
    "..orRRrccrrrqo..",
    ".orRrrrccrrrrqo.",
    ".srRrrrccrrrrqs.",
    ".orRrrrccrrrrqo.",
    "..orrrrrrrrrro..",
    "..oqqqqqqqqqqo..",
]

BOPCA_UP = [
    ".oo..........oo.",
    ".olo........oSo.",
    ".olSo......oSSo.",
    "..olSo....oSSo..",
    "..olSooooooSSo..",
    "...ollssssssSo..",
    "..olssssssssSSo.",
    "..olsssssssssSo.",
    "..osssssssssSSo.",
    "..oSssssssssSSo.",
    "...oSSSSSSSSTo..",
    "..orRRrrrrrrqo..",
    ".orRrrrrrrrrrqo.",
    ".srRrrrrrrrrrqs.",
    ".orRrrrrrrrrrqo.",
    "..orrrrrrrrrro..",
    "..oqqqqqqqqqqo..",
]

BOPCA_SIDE = [
    "..oo............",
    "..olo...........",
    "...olpo.........",
    "....olpo........",
    ".....olpooo.....",
    "....ollssssoo...",
    "...olsssssssso..",
    "...oSsssssssesoo",
    "...oSSssssssesso",
    "...oSSsssssssppo",
    "....oTSSSSSSSSo.",
    ".....orRrrcqo...",
    "....orRrrrcrqo..",
    "....orRrrscrqo..",
    "....orRrrrcrqo..",
    "....orrrrrrrro..",
    "....oqqqqqqqqo..",
]


def check(name, grid, rows):
    assert len(grid) == rows, "%s: %d rows, wanted %d" % (name, len(grid), rows)
    for i, r in enumerate(grid):
        assert len(r) == W, "%s row %d is %d wide: %r" % (name, i, len(r), r)
