"""Carl, Princess Donut, and the two people who talk to them.

Drawn in battlers.py, cel painted to the handheld battler's brief: about
three heads tall, flat tones with a hard shadow edge, a dark outline round the
silhouette, and the face placed by hand. This file only stands them in the
party frame.
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
    a T-shirt, boxers with hearts on, and no shoes."""
    return _staged(battlers.carl)


def donut():
    """Princess Donut, sitting up, crowned."""
    return _staged(battlers.donut)


def mordecai():
    """The guide: short, broad, four eyes, a thousand seasons of this behind him."""
    return _staged(battlers.mordecai)


def bopca():
    """The Bopca: issued a uniform, has strong feelings about it."""
    return _staged(battlers.bopca)


def carl_s():     return _staged(battlers.carl, SMALL)
def donut_s():    return _staged(battlers.donut, SMALL)
def mordecai_s(): return _staged(battlers.mordecai, SMALL)
def bopca_s():    return _staged(battlers.bopca, SMALL)
def carl_l():     return _staged(battlers.carl, LARGE)
def donut_l():    return _staged(battlers.donut, LARGE)
def mordecai_l(): return _staged(battlers.mordecai, LARGE)
def bopca_l():    return _staged(battlers.bopca, LARGE)
