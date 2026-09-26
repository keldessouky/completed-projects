"""Carl, Princess Donut, and the two people who talk to them.

Carl and Donut are taken from their reference art (import_ref.py, which
writes carl_ref.py and donut_ref.py); Mordecai and the Bopca are sculpted
and lit in party_paint.py, which writes mordecai_ref.py and bopca_ref.py in
the same format. This file only stands them in the party frame.
"""

#  The standard character frame: everyone stands on the same row, in the same
#  box, with the same shadow. See Sprite.stage in forge_tools.
#
#  Seventy-four tall, not the square the reference art uses: Donut is a cat
#  wearing a crown, and a crown is exactly the sort of thing that makes a
#  character taller than whoever sized the frame expected. The frame exists to
#  stand everybody on one floor under one shadow; it is not a reason to cut
#  the top off one of them.
PARTY_W, PARTY_H = 64, 74
GROUND = 69


#  The other two sizes the game shows the party at: small in battle, the
#  menus and the cutscenes, large on the title and the level-up. Each is
#  painted at that size, so every screen draws its sprite one to one; the
#  fractional scales this replaced (72%, 75%, 150% and others) each dropped
#  or doubled rows and columns of a finished drawing, unevenly.
SMALL, LARGE = 0.72, 1.5


def carl():
    """Carl, in what he had on when he went out after the cat: a jacket over
    a T-shirt, boxers with hearts on, and no shoes. Taken from his
    reference art."""
    return _from_ref(__import__('carl_ref'), 1)


def _from_ref(module, size):
    """A character taken from reference art (see import_ref.py): the
    importer already drew each size, so this only stands it in its frame."""
    from forge_tools import Sprite
    pal, rows = module.SIZES[size]
    alphabet = __import__('import_ref').ALPHABET
    s = Sprite(len(rows[0]), len(rows))
    idx = {alphabet[i]: s.ink(c) for i, c in enumerate(pal)}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * s.w + x] = idx[ch]
    k = (SMALL, 1.0, LARGE)[size]
    return s.stage(int(round(PARTY_W * k)), int(round(PARTY_H * k)),
                   int(round(GROUND * k))).emit()


def donut():
    """Princess Donut, sitting up, crowned: taken from her reference art."""
    import donut_ref
    return _from_ref(donut_ref, 1)


def mordecai():
    """The guide, as the first floor has him: a Rat Hooligan."""
    return _from_ref(__import__('mordecai_ref'), 1)


def bopca():
    """A Bopca: stout, green-tinted, shaggy, and an excellent cook."""
    return _from_ref(__import__('bopca_ref'), 1)


def carl_s():     return _from_ref(__import__('carl_ref'), 0)
def donut_s():    return _from_ref(__import__('donut_ref'), 0)
def mordecai_s(): return _from_ref(__import__('mordecai_ref'), 0)
def bopca_s():    return _from_ref(__import__('bopca_ref'), 0)
def carl_l():     return _from_ref(__import__('carl_ref'), 2)
def donut_l():    return _from_ref(__import__('donut_ref'), 2)
def mordecai_l(): return _from_ref(__import__('mordecai_ref'), 2)
def bopca_l():    return _from_ref(__import__('bopca_ref'), 2)


def carl_crocs_s():
    """Carl as he went out after the cat: the small sprite, with Bea's pink
    Crocs on. Chapter one only -- he is barefoot soon enough, because the
    dungeon likes him that way."""
    from forge_tools import Sprite
    alphabet = __import__('import_ref').ALPHABET
    pal, rows = __import__('carl_ref').SIZES[0]
    rows = [list(r) for r in rows]
    outline = rows[-1][[i for i, ch in enumerate(rows[-1]) if ch != '.'][0]]
    pinks = [(150, 58, 104), (218, 108, 158), (246, 164, 202)]
    #  The last three rows above the ground line are feet; a Croc is a clog,
    #  so it covers all of them. Shaded by how light the foot was there.
    for y in range(len(rows) - 4, len(rows) - 1):
        for x, ch in enumerate(rows[y]):
            if ch in ('.', outline):
                continue
            r, g, b = pal[alphabet.index(ch)]
            lum = (r * 3 + g * 6 + b) / 10.0
            rows[y][x] = '#' + str(0 if lum < 45 else 1 if lum < 110 else 2)
    s = Sprite(len(rows[0]), len(rows))
    idx = {alphabet[i]: s.ink(c) for i, c in enumerate(pal)}
    idx.update({'#%d' % k: s.ink(c) for k, c in enumerate(pinks)})
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                s.px[y * s.w + x] = idx[ch]
    return s.stage(int(round(PARTY_W * SMALL)), int(round(PARTY_H * SMALL)),
                   int(round(GROUND * SMALL))).emit()
