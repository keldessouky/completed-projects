"""Carl, Princess Donut, and the two people who talk to them.

Carl and Donut are taken from their reference art (import_ref.py, which
writes carl_ref.py and donut_ref.py); Mordecai and the Bopca are cel painted
in battlers.py. This file only stands them in the party frame.
"""
import battlers

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


def _staged(draw, k=1.0):
    return draw(k).sprite().stage(int(round(PARTY_W * k)), int(round(PARTY_H * k)),
                                  int(round(GROUND * k))).emit()


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
    """The guide: short, broad, four eyes, a thousand seasons of this behind him."""
    return _staged(battlers.mordecai)


def bopca():
    """The Bopca: issued a uniform, has strong feelings about it."""
    return _staged(battlers.bopca)


def carl_s():     return _from_ref(__import__('carl_ref'), 0)
def donut_s():    return _from_ref(__import__('donut_ref'), 0)
def mordecai_s(): return _staged(battlers.mordecai, SMALL)
def bopca_s():    return _staged(battlers.bopca, SMALL)
def carl_l():     return _from_ref(__import__('carl_ref'), 2)
def donut_l():    return _from_ref(__import__('donut_ref'), 2)
def mordecai_l(): return _staged(battlers.mordecai, LARGE)
def bopca_l():    return _staged(battlers.bopca, LARGE)
