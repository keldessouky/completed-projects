"""Carl, Princess Donut, and the two people who talk to them.

Proportions first: Carl is five heads tall and built like someone who used to
carry things for a living; Donut is drawn as a real Persian — a round skull, a
short muzzle, an enormous ruff — because the joke only lands if the cat is
convincingly a cat before it is a princess.
"""
from forge_tools import Sprite

#  The standard character frame: everyone stands on the same row, in the same
#  box, with the same shadow. See Sprite.stage in forge_tools.
PARTY_W, PARTY_H = 64, 64


def carl():
    """Carl.

    Hand-placed from `carl_grid`, same as Donut: materials named out of the
    shared palette, no shading pass afterwards. He stands beside her on nearly
    every screen, so while he was built out of shaded primitives the two of
    them read as coming from different games.
    """
    import carl_grid as cg

    s = Sprite(cg.W, cg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(cg.KEY, cg.PALETTE)}
    for y, row in enumerate(cg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * cg.W + x] = idx[ch]
    return s.stage(PARTY_W, PARTY_H).emit()


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

    Hand-placed from `donut_grid`, on a fifteen-colour palette, with no
    shading pass of any kind applied afterwards. Everything else in this file
    is built from shaded primitives and then relit; that approach produces a
    small render rather than a sprite, and no amount of polishing on top of it
    fixes the underlying problem. See the note at the top of donut_grid.py.
    """
    import donut_grid as dg

    s = Sprite(dg.W, dg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(dg.KEY, dg.PALETTE)}
    for y, row in enumerate(dg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * dg.W + x] = idx[ch]
    return s.stage(PARTY_W, PARTY_H).emit()


def mordecai():
    """The guide: short, broad, four eyes, a thousand seasons of this behind him.

    Hand-placed from `mordecai_grid`, same fifteen-colour method as the rest of
    the roster.
    """
    import mordecai_grid as mg

    s = Sprite(mg.W, mg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(mg.KEY, mg.PALETTE)}
    for y, row in enumerate(mg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * mg.W + x] = idx[ch]
    return s.stage(PARTY_W, PARTY_H).emit()

def bopca():
    """The Bopca: issued a uniform, has strong feelings about it.

    Hand-placed from `bopca_grid`.
    """
    import bopca_grid as bg

    s = Sprite(bg.W, bg.H)
    idx = {ch: s.ink(colour) for ch, colour in zip(bg.KEY, bg.PALETTE)}
    for y, row in enumerate(bg.grid()):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * bg.W + x] = idx[ch]
    return s.stage(PARTY_W, PARTY_H).emit()

