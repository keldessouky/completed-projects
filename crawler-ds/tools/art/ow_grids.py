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
    'k': R['hair_brown'][1], 'h': R['hair_brown'][2], 'H': R['hair_brown'][3],
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
    ".okhhshhhhshkko.",
    ".okssssssssssko.",
    ".okssessssesSko.",
    ".oSssessssesSSo.",
    ".oSksssssssskSo.",
    "..okkkkTTkkkko..",
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
    "okhhhhhhhshhsko.",
    "okkhhhhssssssso.",
    "okkhhSssssssesso",
    ".okhSsssssssesso",
    ".okSssssssskkko.",
    "..oSSSSkkkkkko..",
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
    'o': (0x3b, 0x22, 0x1d),
    'F': (0xea, 0xa8, 0x6c), 'f': R['copper'][3], 'd': R['copper'][2], 'D': R['copper'][1],
    'c': R['sand'][5], 'C': R['sand'][4], 'q': R['sand'][3],
    'p': R['cloth_red'][4], 'n': R['cloth_red'][3],
    'e': R['grass'][4], 'E': (0x1f, 0x2a, 0x22),
    'Y': R['gold'][4], 'y': R['gold'][2], 'P': R['arcane'][2],
}

DONUT_DOWN = [
    "....oYoYYoYo....",
    ".o..oYYYYYYo..o.",
    "ofo.oyPyyPyo.ofo",
    "opfoooooooooofpo",
    "opfFFFdffdfffdpo",
    "ofFFfffddfffffdo",
    "ofFfffffffffffdo",
    "offEEffffffEEfdo",
    "offeEffccffeEfdo",
    "ofcccccnnccccCdo",
    "oddcccCqqCcccCdo",
    ".oddccccccccddo.",
    "..ooPPPPPPPPoo..",
    "..ofcccYyccCfo..",
    ".ofFcccccccCdfo.",
    ".offcccccccCdfo.",
    "..ofddddddddfo..",
]

DONUT_UP = [
    "....oYoYYoYo....",
    ".o..oYYYYYYo..o.",
    "ofo.oyyyyyyo.ofo",
    "offoooooooooofdo",
    "offfFFFffffffffo",
    "ofFFffdffdffffdo",
    "ofFffffddfffffdo",
    "offfffffffffffdo",
    "offfffffffffffdo",
    "oddfffffffffdddo",
    "odddffffffdddddo",
    ".oPPPPPPPPPPPoo.",
    "..ooddddddddo.oo",
    "..ofFfffffffdofo",
    ".ofFfffffffdddfo",
    ".offfffffffddfo.",
    "..ofddddddddoo..",
]

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


#  Facing right: a big round head up front, a round body behind it, and the
#  tail up in a curl -- proportions of a partner creature, not of a cat.
DONUT_SIDE = _painted(17, [
    ('pixels', [(1, 13), (1, 12), (1, 11), (1, 10), (2, 9), (2, 8), (2, 7), (3, 6),
                (3, 5), (2, 4), (2, 12), (2, 11)], 'f', 'f', 'd'),
    ('ellipse', (6.5, 13.0, 5.2, 3.6), 'F', 'f', 'd'),
    ('pixels', [(7, 2), (7, 3), (8, 3), (7, 4), (8, 4), (9, 4)], 'f', 'f', 'f'),
    ('ellipse', (10.4, 7.0, 4.1, 3.9), 'F', 'f', 'd'),
], {
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
