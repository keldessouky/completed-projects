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
    'donut': dict(
        #  The reference, cropped round her and halved: 220x306.
        source='ref/donut_reference.png',
        outline=[(30, 22), (33, 13), (39, 22), (50, 11), (57, 22), (80, 4), (87, 22),
                 (107, 12), (113, 22), (128, 13), (134, 22), (136, 45), (147, 55),
                 (152, 80), (153, 120), (148, 145), (149, 165), (152, 190), (165, 212),
                 (172, 238), (184, 254), (203, 262), (211, 282), (206, 300), (160, 304),
                 (110, 304), (30, 304), (9, 292), (5, 255), (9, 215), (19, 196),
                 (22, 165), (12, 142), (7, 110), (10, 76), (17, 56), (29, 50)],
        eyes=[(57, 100), (107, 100)], eye_r=8.0,
        #  Heights before the outline, one per party size: small, standard,
        #  large. Each plus its outline fits that size's frame (cast.py).
        heights=(49, 68, 103),
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
    x0, y0, x1, y1 = mask.getbbox()
    src, m = half.crop((x0, y0, x1, y1)), mask.crop((x0, y0, x1, y1))
    w = round(src.width * height / src.height)
    rgb = src.resize((w, height), Image.LANCZOS)
    alpha = m.resize((w, height), Image.LANCZOS)
    #  A touch brighter and punchier than the painting: it was lit for a
    #  poster, and the game puts her on a dozen different backgrounds.
    rgb = ImageEnhance.Brightness(rgb).enhance(1.14)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    rgb = ImageEnhance.Color(rgb).enhance(1.04)

    #  The eyes: keep the pupil, keep the glint, put the green back.
    sc = height / (y1 - y0)
    eyes = []
    for ex, ey in cfg['eyes']:
        cx, cy, r = (ex - x0) * sc, (ey - y0) * sc, cfg['eye_r'] * sc
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if not (0 <= x < w and 0 <= y < height) or (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                    continue
                h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in rgb.getpixel((x, y))))
                if 0.07 < l < 0.72 and (0.06 < h < 0.4 or s < 0.25):
                    nr, ng, nb = colorsys.hls_to_rgb(0.24, min(0.6, max(0.34, l * 1.8)), 0.72)
                    rgb.putpixel((x, y), (int(nr * 255), int(ng * 255), int(nb * 255)))
                    eyes.append((x, y))

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

    eyeset = set(eyes)
    acc = [(x, y) for y in range(height) for x in range(w)
           if (x, y) not in eyeset and accent(rgb.getpixel((x, y)))]
    out = rgb.quantize(colors=44, method=Image.Quantize.MEDIANCUT).convert('RGB')
    requant(acc, 14, out)
    requant(eyes, 4, out)

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
