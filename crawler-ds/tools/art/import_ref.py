"""Turn a piece of reference art into the game's sprites for a character.

For when the character should look like a picture rather than like
something drawn in battlers.py: Princess Donut is taken straight from the
reference art that was supplied for her. This cuts her out of the
painting, shrinks her to each size the game shows the party at, quantises,
and outlines her like the rest of the cast, then writes the result as a
data module (`<name>_ref.py`) so the build itself needs nothing but Python.

    python3 tools/art/import_ref.py donut

Needs Pillow; the game build does not, because the generated module is
committed.

Cutting her out is a traced outline rather than a colour key. The
painting's shadow fur is as dark as the dungeon floor behind it, and the
floor is lit warm near her, so no threshold separates the two. The eyes
are handled on their own for the same reason: shrinking averages the green
iris into the black pupil and comes out olive, and the green is the first
thing anyone sees in the reference.
"""
import colorsys
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

REFS = {
    'carl': dict(
        #  The reference, cropped round him and halved: 215x405.
        source='ref/carl_reference.png',
        outline=[(68, 40), (72, 22), (85, 12), (100, 5), (118, 2), (135, 8), (150, 15),
                 (158, 30), (155, 55), (152, 65), (152, 95), (145, 105), (140, 120),
                 (150, 125), (172, 135), (182, 150), (186, 180), (188, 232), (195, 240),
                 (196, 272), (185, 280), (170, 278), (165, 270), (166, 292), (165, 300),
                 (163, 375), (182, 385), (183, 398), (125, 399), (122, 375), (125, 300),
                 (122, 293), (100, 293), (97, 300), (96, 375), (100, 399), (35, 399),
                 (35, 385), (58, 375), (60, 300), (57, 292), (56, 280), (52, 280),
                 (20, 278), (18, 240), (22, 235), (20, 200), (22, 160), (35, 138),
                 (55, 125), (80, 120), (92, 115), (85, 112), (78, 95), (64, 90),
                 (60, 70), (66, 62), (65, 50)],
        heights=(49, 68, 103),
        edge=(0x1c, 0x12, 0x10),
        #  The hearts on his boxers are the joke, and shrinking plus the
        #  softer contrast turn them brown: inside the boxers, anything
        #  reddish goes back to heart red.
        recolour=[((62, 238, 162, 288), (0.0, 0.045), 0.35, (0xcc, 0x3a, 0x38))],
    ),
    'donut': dict(
        #  The reference, cropped round her and halved: 220x306.
        source='ref/donut_reference.png',
        outline=[(30, 22), (33, 13), (39, 22), (50, 11), (57, 22), (80, 4), (87, 22),
                 (107, 12), (113, 22), (128, 13), (134, 22), (136, 45), (147, 55),
                 (152, 80), (153, 120), (148, 145), (149, 165), (152, 190), (165, 212),
                 (172, 238), (184, 254), (203, 262), (211, 282), (206, 300), (160, 304),
                 (110, 304), (30, 304), (9, 292), (5, 255), (9, 215), (19, 196),
                 (22, 165), (12, 142), (7, 110), (10, 76), (17, 56), (29, 50)],
        eyes=[(57, 100), (107, 100)], nose=(82, 113),
        #  Drawn, not shrunk: big round eyes with a dark pupil and a white
        #  catchlight, one design per size, deliberately larger than a
        #  straight shrink would make them. Her eyes are most of why she is
        #  cute in the reference; shrunk, they came out as small green slits
        #  in a dark face, which read as a scowl.
        eye_art=(
            ["wD", "Dg"],
            [".DDD.", "DwwDD", "DwDDD", "DGgGD", ".DDD."],
            ["..DDD..", ".DgggD.", "DgwwDgD", "DgwDDgD", "DgDDDgD", ".DGGGD.", "..DDD.."]),
        nose_art=(["n"], ["nn"], [".nnn.", "..N.."]),
        #  A little cat mouth under the nose, turned up at the ends: the
        #  straight line the painting shrinks to reads as a frown.
        mouth=(82, 119.5),
        mouth_art=(["."], ["m.m"], ["m...m", ".m.m."]),
        #  Lift the muzzle: the painting's shadow between the eyes and under
        #  the nose shrinks into a scowl.
        muzzle=(82, 112, 27, 21),
        #  Above this row of the source only the crown is her; the dark
        #  between its points is dungeon.
        crown_to=24,
        feature_key={'D': (0x16, 0x10, 0x0c), 'w': (0xff, 0xfd, 0xf2),
                     'g': (0x9e, 0xd2, 0x52), 'G': (0x5e, 0x98, 0x32),
                     'n': (0xf2, 0x9e, 0xa4), 'N': (0xc8, 0x70, 0x7a),
                     'm': (0x4a, 0x30, 0x22)},
        #  Heights before the outline, one per party size: small, standard,
        #  large. Each plus its outline fits that size's frame (cast.py).
        #  About half Carl's height at each size: she is a cat, sitting. The
        #  poster stands them shoulder to shoulder; the game does not.
        heights=(25, 34, 52),
        #  At half the size the collar and the amethyst go murky: purples in
        #  that band go back to a clear amethyst.
        recolour=[((25, 150, 150, 215), (0.70, 0.93), 0.22, (0x8e, 0x5c, 0xbe))],
        edge=(0x1c, 0x12, 0x10),
    ),
}

#  Characters for palette indices in the generated grids.
ALPHABET = ('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
            '!#$%&*+-/:;<=>?@^_~')


def convert(cfg, height):
    from PIL import Image, ImageDraw, ImageEnhance
    half = Image.open(os.path.join(HERE, cfg['source'])).convert('RGB')
    mask = Image.new('L', half.size, 0)
    ImageDraw.Draw(mask).polygon(cfg['outline'], fill=255)
    for y in range(cfg.get('crown_to', 0)):
        for x in range(half.width):
            r, g, b = half.getpixel((x, y))
            if not (r > 80 and r - b > 30):
                mask.putpixel((x, y), 0)
    mcx, mcy, mrx, mry = cfg.get('muzzle', (0, 0, 1, 1))
    for y in range(int(mcy - mry), int(mcy + mry) + 1):
        for x in range(int(mcx - mrx), int(mcx + mrx) + 1):
            d = ((x - mcx) / mrx) ** 2 + ((y - mcy) / mry) ** 2
            if d <= 1 and 'muzzle' in cfg:
                r, g, b = half.getpixel((x, y))
                f = 1.0 + 0.35 * (1 - d)
                half.putpixel((x, y), (min(255, int(r * f + 10)), min(255, int(g * f + 8)),
                                       min(255, int(b * f + 4))))
    x0, y0, x1, y1 = mask.getbbox()
    src, m = half.crop((x0, y0, x1, y1)), mask.crop((x0, y0, x1, y1))
    w = round(src.width * height / src.height)
    rgb = src.resize((w, height), Image.LANCZOS)
    alpha = m.resize((w, height), Image.LANCZOS)
    #  Brighter and softer than the painting: it was lit dark for a poster,
    #  and at this size its contrast turns fluffy fur into harsh stripes.
    rgb = ImageEnhance.Brightness(rgb).enhance(1.24)
    rgb = ImageEnhance.Contrast(rgb).enhance(0.9)
    rgb = ImageEnhance.Color(rgb).enhance(1.06)

    sc = height / (y1 - y0)

    for (rx0, ry0, rx1, ry1), (h0, h1), smin, target in cfg.get('recolour', ()):
        for y in range(int((ry0 - y0) * sc), int((ry1 - y0) * sc) + 1):
            for x in range(int((rx0 - x0) * sc), int((rx1 - x0) * sc) + 1):
                if 0 <= x < w and 0 <= y < height:
                    h, l, s_ = colorsys.rgb_to_hls(*(v / 255 for v in rgb.getpixel((x, y))))
                    #  A window starting at 0 is red, and red wraps round.
                    if (h0 <= h <= h1 or (h0 == 0.0 and h >= 0.95)) and s_ >= smin and l < 0.8:
                        rgb.putpixel((x, y), target)

    #  Quantise in three groups, so the few accent pixels are not outvoted
    #  by forty-odd shades of brown: the coat, the jewellery's purples and
    #  the like, and the eyes.
    def accent(c):
        h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c))
        d = h * 360
        return s > 0.22 and l > 0.12 and (70 < d < 170 or 250 < d < 330 or d < 12 or d > 345)

    def requant(points, n, into):
        if not points:
            return
        strip = Image.new('RGB', (len(points), 1))
        for i, p in enumerate(points):
            strip.putpixel((i, 0), rgb.getpixel(p))
        q = strip.quantize(colors=min(n, len(points)), method=Image.Quantize.MEDIANCUT)
        q = q.convert('RGB')
        for i, p in enumerate(points):
            into.putpixel(p, q.getpixel((i, 0)))

    acc = [(x, y) for y in range(height) for x in range(w) if accent(rgb.getpixel((x, y)))]
    out = rgb.quantize(colors=40, method=Image.Quantize.MEDIANCUT).convert('RGB')
    requant(acc, 14, out)

    #  The face, drawn over the top at this size.
    size = cfg['heights'].index(height)
    key = cfg.get('feature_key', {})

    def stamp(art, cx, cy):
        ox = int(round((cx - x0) * sc - len(art[0]) / 2))
        oy = int(round((cy - y0) * sc - len(art) / 2))
        for j, row in enumerate(art):
            for i, ch in enumerate(row):
                if ch != '.' and 0 <= ox + i < w and 0 <= oy + j < height:
                    out.putpixel((ox + i, oy + j), key[ch])
    for ex, ey in cfg.get('eyes', ()):
        stamp(cfg['eye_art'][size], ex, ey)
    for part in ('mouth', 'nose'):
        if part in cfg:
            stamp(cfg[part + '_art'][size], *cfg[part])

    #  Opaque where the traced outline covers at least half a pixel, then a
    #  one-pixel outline round the lot, as the rest of the cast has.
    W, H = w + 2, height + 2
    px = {}
    for y in range(height):
        for x in range(w):
            if alpha.getpixel((x, y)) >= 128:
                px[(x + 1, y + 1)] = out.getpixel((x, y))
    for (x, y) in list(px):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in px:
                px[q] = cfg['edge']
    pal = sorted(set(px.values()))
    assert len(pal) < len(ALPHABET)
    rows = [''.join(ALPHABET[pal.index(px[(x, y)])] if (x, y) in px else '.'
                    for x in range(W)) for y in range(H)]
    return pal, rows


def main(name):
    cfg = REFS[name]
    out = ['"""Generated by tools/art/import_ref.py from %s -- do not edit;' % cfg['source'],
           'rerun the importer instead."""', '', 'SIZES = [']
    for h in cfg['heights']:
        pal, rows = convert(cfg, h)
        out.append('    (%r,\n     [' % (pal,))
        out += ['      %r,' % r for r in rows]
        out.append('     ]),')
    out.append(']')
    path = os.path.join(HERE, '%s_ref.py' % name)
    open(path, 'w').write('\n'.join(out) + '\n')
    print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'donut')
