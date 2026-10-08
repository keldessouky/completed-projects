"""The item icons' sheet, from game-icons.net (https://github.com/game-icons/icons: CC BY 3.0, a few CC0), after the
second run on the RP6. Each base gets one of their icons for its kind, chosen by a word in its name where one fits and
otherwise in turn (so neighbours differ), coloured in its material, outlined, and fitted to its inventory cells (long
weapons stood upright). A unique takes its base's icon in its film poster's colours. Nothing is drawn here: the shapes
are game-icons.net's; this only colours, rotates and places them.

    python3 tools/icons/game_icons.py <game-icons checkout>
writes assets/icons/icons.qtex.z (zlib of "QTX1", u16 w, u16 h, RGBA8), assets/icons/icons.json ({"cell": 64, "bases": [[x, y, w,
h], ...] in item_bases() order, "uniques": [...]}) and assets/icons/CREDITS.md; tools/pack.py packs the first two.
Needs cairosvg and Pillow (pip install cairosvg pillow).
"""
import io
import json
import math
import os
import re
import struct
import sys

import cairosvg
from PIL import Image, ImageChops, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
CELL = 64   # the inventory's cell, in UI pixels: drawn one to one

# the icons each kind draws from, in turn
KINDS = {
    'WK_MAUL': ['delapouite/warhammer', 'lorc/flat-hammer', 'delapouite/3d-hammer', 'delapouite/thor-hammer', 'lorc/gavel',
                'delapouite/war-pick', 'delapouite/stake-hammer', 'lorc/claw-hammer'],
    'WK_STAFF': ['lorc/wizard-staff', 'delapouite/crescent-staff', 'willdabeast/orb-wand', 'delapouite/skull-staff',
                 'delapouite/lunar-wand', 'lorc/crystal-wand'],
    'WK_BOW': ['lorc/pocket-bow', 'lorc/high-shot', 'delapouite/bow-arrow', 'lorc/lightning-bow'],
    'WK_SWORD': ['lorc/broadsword', 'lorc/sparkling-sabre', 'lorc/crescent-blade', 'lorc/relic-blade', 'lorc/thunder-blade',
                 'skoll/crescent-blade', 'lorc/rune-sword'],
    'WK_CROSSBOW': ['carl-olsen/crossbow'],
    'WK_DAGGER': ['lorc/plain-dagger', 'lorc/broad-dagger', 'lorc/curvy-knife', 'skoll/bowie-knife', 'delapouite/dagger-rose',
                  'lorc/bowie-knife'],
    'WK_QSTAFF': ['delapouite/bo', 'delapouite/wood-stick', 'delapouite/water-diviner-stick', 'delapouite/glaive'],
    'WK_MACE': ['delapouite/flanged-mace', 'lorc/spiked-mace', 'lorc/mace-head', 'delapouite/bone-mace'],
    'WK_SCEPTRE': ['delapouite/winged-scepter', 'delapouite/bird-scepter', 'lorc/lantern', 'delapouite/sun-spear'],
    'Helmet': ['delapouite/light-helm', 'lorc/visored-helm', 'lorc/crested-helmet', 'carl-olsen/brutal-helm', 'lorc/barbute',
               'delapouite/closed-barbute', 'delapouite/turban', 'lorc/hood', 'delapouite/warlock-hood', 'lorc/sharp-crown',
               'delapouite/jewel-crown', 'lorc/laurel-crown'],
    'Body': ['lorc/breastplate', 'lorc/leather-vest', 'lorc/armor-vest', 'lorc/robe', 'lucasms/cloak', 'delapouite/chest-armor',
             'delapouite/leather-armor', 'lorc/scale-mail', 'lorc/mail-shirt', 'willdabeast/chain-mail', 'delapouite/pirate-coat'],
    'Gloves': ['delapouite/gauntlet', 'delapouite/gloves', 'lorc/mailed-fist', 'delapouite/winter-gloves'],
    'Boots': ['lorc/leather-boot', 'lorc/steeltoe-boots', 'lorc/boots', 'delapouite/metal-boot', 'delapouite/slippers',
              'lorc/walking-boot', 'delapouite/sandal'],
    'Belt': ['lucasms/belt', 'lorc/belt-buckles', 'delapouite/belt-armor'],
    'Amulet': ['lorc/gem-pendant', 'delapouite/emerald-necklace', 'delapouite/intricate-necklace', 'lucasms/necklace',
               'lorc/gem-necklace', 'delapouite/tribal-pendant', 'delapouite/pearl-necklace'],
    'Ring': ['delapouite/ring', 'delapouite/diamond-ring', 'lorc/engagement-ring', 'delapouite/power-ring', 'skoll/big-diamond-ring',
             'lorc/swirl-ring', 'delapouite/globe-ring'],
    'Chart': ['lorc/treasure-map', 'lorc/scroll-unfurled', 'lorc/tied-scroll'],
}
# a word in a base's name that picks an icon of its kind
WORDS = [('crescent', 'lorc/crescent-blade'), ('sabre', 'lorc/sparkling-sabre'), ('kilij', 'skoll/crescent-blade'),
         ('turban', 'delapouite/turban'), ('hood', 'lorc/hood'), ('circlet', 'lorc/sharp-crown'), ('crown', 'delapouite/jewel-crown'),
         ('robe', 'lorc/robe'), ('burnous', 'lucasms/cloak'), ('cloak', 'lucasms/cloak'), ('lamellar', 'lorc/scale-mail'),
         ('scale', 'lorc/scale-mail'), ('mail', 'lorc/mail-shirt'), ('plate', 'lorc/breastplate'), ('breastplate', 'lorc/breastplate'),
         ('leather', 'delapouite/leather-armor'), ('coat', 'delapouite/pirate-coat'), ('slipper', 'delapouite/slippers'),
         ('greave', 'delapouite/metal-boot'), ('gauntlet', 'delapouite/gauntlet'), ('lantern', 'lorc/lantern'),
         ('lighthouse', 'lorc/lantern'), ('pharos', 'lorc/lantern'), ('beacon', 'lorc/lantern'), ('gavel', 'lorc/gavel'),
         ('pick', 'delapouite/war-pick'), ('janbiya', 'lorc/curvy-knife'), ('khanjar', 'lorc/curvy-knife'), ('pearl', 'delapouite/pearl-necklace')]
UPRIGHT = {'WK_MAUL', 'WK_STAFF', 'WK_BOW', 'WK_SWORD', 'WK_DAGGER', 'WK_QSTAFF', 'WK_MACE', 'WK_SCEPTRE', 'WK_CROSSBOW'}

# materials: a base colour and a highlight
MAT = {'iron': ('6e7076', 'c8cace'), 'steel': ('6a8296', 'd4e2ee'), 'bronze': ('9a5e28', 'e8b878'), 'brass': ('b0882c', 'f2dc8c'),
       'gold': ('c89614', 'fff0a0'), 'copper': ('a8522c', 'f0a878'), 'silver': ('9aa0a8', 'ffffff'), 'wood': ('7a4c2a', 'c89a6a'),
       'leather': ('7a4a28', 'c8925a'), 'cloth_red': ('9a2a24', 'e8806a'), 'cloth_blue': ('2e4a8e', '8ab0e0'),
       'cloth_black': ('3a3a48', '8a8a9c'), 'cloth_sand': ('a08454', 'ece0b8'), 'cloth_teal': ('1e7470', '88d8cc'),
       'paper': ('b8a47c', 'fbf2d8'), 'gem_green': ('18a048', 'b0ffc8'), 'gem_blue': ('1a5ac8', 'b0dcff'), 'gem_red': ('c01828', 'ffb0b0')}


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def material(b):
    n = b['name'].lower()
    for k, m in (('bronze', 'bronze'), ('brass', 'brass'), ('copper', 'copper'), ('gilded', 'gold'), ('sultan', 'gold'),
                 ('royal', 'gold'), ('jewelled', 'gold'), ('silver', 'silver'), ('iron', 'iron'), ('steel', 'steel'),
                 ('lantern', 'brass'), ('lighthouse', 'brass'), ('pharos', 'brass'), ('beacon', 'brass'), ('astrolabe', 'brass')):
        if k in n:
            return m
    s, lvl = b['slot'], b['level']
    if s == 'Chart':
        return 'paper'
    if s == 'Weapon':
        if b['wkind'] in ('WK_BOW', 'WK_QSTAFF', 'WK_STAFF'):
            return 'wood' if lvl < 60 else 'brass'
        return 'iron' if lvl < 20 else 'steel' if lvl < 66 else 'silver'
    if s in ('Amulet', 'Ring'):
        return 'gold' if lvl >= 50 else 'brass' if lvl >= 4 else 'bronze'
    if s == 'Belt':
        return 'leather'
    if b['armour'] > 0 and b['evasion'] == 0 and b['es'] == 0:
        return 'iron' if lvl < 30 else 'steel'
    if b['es'] > 0 and b['armour'] == 0 and b['evasion'] == 0:
        return 'cloth_blue'
    if b['es'] > 0:
        return 'cloth_black' if b['evasion'] > 0 else 'cloth_red'
    if b['armour'] > 0:
        return 'bronze'
    return 'leather' if lvl < 40 else 'cloth_sand'


def read_bases():
    src = open(os.path.join(ROOT, 'src', 'game', 'items.cpp'), encoding='utf-8').read()
    body = src[src.index('const std::vector<ItemBase>& item_bases()'):src.index('int find_base(')]
    pat = re.compile(r'\{"(\w+)", "((?:[^"\\]|\\.)*)", Slot::(\w+), (\d+), ([-\d.]+)f?, ([-\d.]+)f?, ([-\d.]+)f?, ([-\d.]+)f?, '
                     r'([-\d.]+)f?, ([-\d.]+)f?, (nullptr|"(?:[^"\\]|\\.)*")(?:, ([-\d.]+)f?)?(?:, (WK_\w+))?\}')
    out = [dict(id=m.group(1), name=m.group(2), slot=m.group(3), level=int(m.group(4)), armour=float(m.group(9)),
                evasion=float(m.group(10)), es=float(m.group(12) or 0), wkind=m.group(13) or 'WK_MAUL') for m in pat.finditer(body)]
    rows = len(re.findall(r'\{"\w+", "(?:[^"\\]|\\.)*", Slot::', body))
    assert len(out) == rows, 'read %d of %d item bases' % (len(out), rows)
    return out


def read_uniques():
    src = open(os.path.join(ROOT, 'src', 'game', 'uniques.cpp'), encoding='utf-8').read()
    out = []
    for m in re.finditer(r'\{"(\w+)", "((?:[^"\\]|\\.)*)", "(\w+)", "', src):
        p = re.search(r'\{(0x[0-9A-Fa-f]+), (0x[0-9A-Fa-f]+)\}', src[m.end():m.end() + 1500])
        out.append(dict(id=m.group(1), base=m.group(3), poster=(int(p.group(1), 16), int(p.group(2), 16)) if p else (0xC0402A, 0xF0C060)))
    return out


def cells(b):
    if b['slot'] == 'Weapon':
        return {'WK_DAGGER': (1, 2), 'WK_SWORD': (1, 3), 'WK_MACE': (1, 3), 'WK_SCEPTRE': (1, 3), 'WK_QSTAFF': (1, 4),
                'WK_CROSSBOW': (2, 3)}.get(b['wkind'], (2, 4))
    return {'Body': (2, 3), 'Helmet': (2, 2), 'Gloves': (2, 2), 'Boots': (2, 2), 'Belt': (2, 1)}.get(b['slot'], (1, 1))


def shape(src_dir, name, upright):
    """The icon as an alpha mask (white on black in the SVG), stood upright when it lies diagonally."""
    png = cairosvg.svg2png(url=os.path.join(src_dir, name + '.svg'), output_width=512, output_height=512)
    a = Image.open(io.BytesIO(png)).convert('L')
    def crop(im):
        box = im.point(lambda v: 255 if v > 40 else 0).getbbox()
        return im.crop(box) if box else im
    if not upright:
        return crop(a)
    # whichever way stands it tallest: most of their weapons lie on a diagonal, some are upright already
    return max((crop(a.rotate(r, resample=Image.BICUBIC, expand=True)) for r in (0, 45, -45, 90)), key=lambda im: im.height / max(1, im.width))


def colour(mask, base, light, w, h):
    """The mask fitted into w x h, filled with the material lit from the top, outlined dark."""
    m = mask.copy()
    m.thumbnail((w - 8, h - 8), Image.LANCZOS)
    canvas = Image.new('L', (w, h), 0)
    canvas.paste(m, ((w - m.width) // 2, (h - m.height) // 2))
    grad = Image.new('RGB', (w, h))
    b, l = hx(base), hx(light)
    for y in range(h):
        t = max(0.0, min(1.0, 1.0 - y / max(1, h - 1)))   # lighter at the top
        c = tuple(int(b[i] + (l[i] - b[i]) * t * 0.75) for i in range(3))
        grad.paste(c, (0, y, w, y + 1))
    shade = canvas.filter(ImageFilter.GaussianBlur(2))
    fill = Image.composite(grad, Image.new('RGB', (w, h), tuple(int(v * 0.55) for v in b)),
                           ImageChops.multiply(canvas, shade.point(lambda v: min(255, v * 2))))
    outline = canvas.filter(ImageFilter.MaxFilter(5))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (w, h), (22, 16, 12, 255)), (0, 0), outline)
    out.paste(fill.convert('RGBA'), (0, 0), canvas)
    return out


def main(src_dir):
    bases, uniques = read_bases(), read_uniques()
    turn, used, icons = {}, set(), []
    for b in bases:
        kind = b['wkind'] if b['slot'] == 'Weapon' else b['slot']
        pool = KINDS.get(kind, KINDS['Ring'])
        pick = next((i for w, i in WORDS if w in b['name'].lower() and i in pool), None)
        if pick is None:
            pick = pool[turn.get(kind, 0) % len(pool)]
            turn[kind] = turn.get(kind, 0) + 1
        used.add(pick)
        base, light = MAT[material(b)]
        w, h = cells(b)
        icons.append(colour(shape(src_dir, pick, kind in UPRIGHT), base, light, w * CELL, h * CELL))
        b['icon'] = pick
    by_id = {b['id']: (i, b) for i, b in enumerate(bases)}
    for u in uniques:   # the base's icon in the poster's colours
        if u['base'] not in by_id:
            icons.append(None)
            continue
        i, b = by_id[u['base']]
        a, c = '%06x' % u['poster'][0], '%06x' % u['poster'][1]
        w, h = cells(b)
        img = colour(shape(src_dir, b['icon'], (b['wkind'] if b['slot'] == 'Weapon' else b['slot']) in UPRIGHT), a, c, w * CELL, h * CELL)
        glow = img.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
        halo = Image.new('RGBA', img.size, hx(c) + (0,))
        halo.putalpha(glow.point(lambda v: v // 2))
        icons.append(Image.alpha_composite(halo, img))
    # shelves on a sheet 2048 wide
    W, x, y, row, places = 2048, 0, 0, 0, []
    for im in icons:
        if im is None:
            places.append(None)
            continue
        if x + im.width > W:
            x, y, row = 0, y + row, 0
        places.append((x, y))
        x += im.width
        row = max(row, im.height)
    sheet = Image.new('RGBA', (W, y + row), (0, 0, 0, 0))
    for im, p in zip(icons, places):
        if im is not None:
            sheet.paste(im, p)
    out = os.path.join(ROOT, 'assets', 'icons')
    os.makedirs(out, exist_ok=True)
    import zlib   # kept compressed in git; tools/pack.py expands it into the pack
    with open(os.path.join(out, 'icons.qtex.z'), 'wb') as f:
        f.write(zlib.compress(b'QTX1' + struct.pack('<HH', sheet.width, sheet.height) + sheet.tobytes(), 9))
    idx = {'cell': CELL, 'bases': [], 'uniques': []}
    for k, im in enumerate(icons):
        rect = [places[k][0], places[k][1], im.width, im.height] if im is not None else [0, 0, 0, 0]
        (idx['bases'] if k < len(bases) else idx['uniques']).append(rect)
    with open(os.path.join(out, 'icons.json'), 'w') as f:
        json.dump(idx, f, separators=(',', ':'))
    authors = sorted({u.split('/')[0] for u in used})
    with open(os.path.join(out, 'CREDITS.md'), 'w') as f:
        f.write('# Item icons\n\nThe item icons are from [game-icons.net](https://game-icons.net) '
                '([source](https://github.com/game-icons/icons)), licensed under '
                '[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (some CC0), by: ' + ', '.join(authors) + '.\n\n'
                'QAHIRA colours, rotates, outlines and places them (tools/icons/game_icons.py). The icons used:\n\n')
        for u in sorted(used):
            f.write('- `%s` by %s\n' % (u.split('/')[1], u.split('/')[0]))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(os.path.join(ROOT, 'build', 'icons_preview.png'))
    print('%d bases, %d uniques, %d icons by %d authors -> %d x %d' % (len(bases), len(uniques), len(used), len(authors), W, sheet.height))


if __name__ == '__main__':
    main(sys.argv[1])
