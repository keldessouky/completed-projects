#!/usr/bin/env python3
"""The art review page: the gallery bot's pictures (tools/review/capture.sh) as build/review/index.html and
build/review/img/, ready to publish as an Artifact. Each zone, pinnacle, screen and the spell-effects sheet is one
item the owner marks Keep, Improve or Redo, with a note; the marks live in the Artifact's database, collection
"reviews", one document per item id (zone-<id>, pin-<zone>, screen-<name>, fx-sheet).

    python3 tools/review/build.py
"""
import datetime
import json
import os
import re
import subprocess
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD = os.path.join(ROOT, 'build')
OUT = os.path.join(BUILD, 'review')
IMG = os.path.join(OUT, 'img')

# the class each part was pictured with (capture.sh)
CLASSES = {'1': 'the Warrior', '2': 'the Ranger', '3': 'the Mercenary', '4': 'the Shadow', '5': 'the Templar',
           '6': 'the Wanderer', 'end': 'the Sorcerer'}
ACTS = {1: 'Cairo', 2: 'The Nile to Luxor', 3: 'The Western Desert', 4: 'The Maghreb Coast', 5: 'The Atlas and the Strait',
        6: 'Across the Red Sea'}
ROMAN = {1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI'}
SCREENS = [
    ('rooftop', 'The Rooftop Ahwa', 'The hub: Amm Sayed, the bench, the chart table and the stair down'),
    ('inventory', 'Inventory and equipment', 'The paper doll, the bag and the item tooltips'),
    ('talismans', 'Talismans', 'The skill bar and its Wafq slots'),
    ('character', 'Character sheet', 'Every number, each with its "Why?"'),
    ('ascendancy', 'Ascendancy', 'The trial points and the class\'s ascendancy tree'),
    ('journal', 'Journal', 'Quests, the codex and the poster scraps'),
    ('settings', 'Settings', 'Language, text size, loot colours, shake, L2, music'),
    ('game', 'Game menu', 'Resume, update, quit to the title, exit'),
    ('vendor', "Amm Sayed's Wares", 'The vendor, and the flask upgrade'),
    ('bench', "Usta Hassan's Bench", 'The crafting bench'),
    ('dealer', "Amm Ramadan's Antiquities", 'The relic dealer'),
    ('stars', 'The Book of Fixed Stars', 'The passive tree'),
    ('map', 'The Map of al-Idrisi', 'The endgame map, south at the top'),
    ('roof', 'Build up the roof', 'The rooftop\'s building board: seven upgrades in three tiers'),
    ('rooftop_built', 'The rooftop, built up', 'Every upgrade at its third tier'),
    ('title', 'Title screen', 'The four character slots under the eclipse'),
]


def zones():
    """id -> name, subtitle, tileset, act, level, boss id, trial (from src/game/acts.cpp)."""
    src = open(os.path.join(ROOT, 'src', 'game', 'acts.cpp'), encoding='utf-8').read()
    out = {}
    head = re.compile(r'\{"(\w+)",\s*"([^"]*)",\s*"([^"]*)",\s*"(\w+)",\s*(\d+),\s*(\d+),')
    tail = re.compile(r'\}\},\s*"(\w*)",\s*"(\w*)",\s*"((?:[^"\\]|\\.)*)",\s*"(\w*)",\s*"(\w*)",\s*"(\w*)",\s*(true|false)')
    for m in head.finditer(src):
        t = tail.search(src, m.end())
        if not t:
            continue
        out[m.group(1)] = dict(name=m.group(2), sub=m.group(3), tileset=m.group(4), act=int(m.group(5)),
                               level=int(m.group(6)), boss=t.group(2), elite=t.group(1), trial=t.group(7) == 'true')
    return out


def monsters():
    src = open(os.path.join(ROOT, 'src', 'game', 'world.cpp'), encoding='utf-8').read()
    return {m.group(1): m.group(2) for m in re.finditer(r'\{"(\w+)", "([^"]+)", "(\w+)", [\d.]+f,', src)}


def pinnacles():
    src = open(os.path.join(ROOT, 'src', 'game', 'atlas.cpp'), encoding='utf-8').read()
    return [(m.group(1), m.group(2), m.group(3), m.group(4) == 'true')
            for m in re.finditer(r'\{"([^"]+)", "(\w+)", "(\w+)", CUR_\w+, [^,]+, (true|false),', src)]


def poses(part):
    """(frame, kind, id) the gallery bot pictured in this part."""
    path = os.path.join(BUILD, 'gal_' + part, 'names.txt')
    if not os.path.exists(path):
        sys.exit('no pictures for part %s: run tools/review/capture.sh first' % part)
    out = []
    for line in open(path):
        p = line.split()
        if len(p) == 4 and p[0] == 'gallery:':
            out.append((int(p[1]), p[2], p[3]))
    return out


def picture(part, frame, name):
    src = os.path.join(BUILD, 'gal_' + part, 'build', 'seq_%04d.png' % frame)
    dst = os.path.join(IMG, name + '.jpg')
    Image.open(src).convert('RGB').resize((1280, 720), Image.LANCZOS).save(dst, quality=80, optimize=True, progressive=True)
    return 'img/' + name + '.jpg'


def main():
    os.makedirs(IMG, exist_ok=True)
    for f in os.listdir(IMG):
        os.remove(os.path.join(IMG, f))
    zd, mons = zones(), monsters()
    groups = []
    for act in range(1, 7):
        part = str(act)
        shots = {}
        for frame, kind, zid in poses(part):
            shots.setdefault(zid, {})[kind] = picture(part, frame, '%s-%s' % (zid, kind))
        items = []
        for zid in sorted(shots, key=lambda z: (zd[z]['level'], z)):
            z = zd[zid]
            meta = [('Area level', str(z['level'])), ('Region', z['tileset'])]
            if z['boss']:
                meta.append(('Boss', mons.get(z['boss'], z['boss'])))
            elif z['elite']:
                meta.append(('Guard', mons.get(z['elite'], z['elite'])))
            if z['trial']:
                meta.append(('Ascendancy trial', 'yes'))
            meta.append(('Pictured with', CLASSES[part]))
            items.append(dict(id='zone-' + zid, section='act%d' % act, title=z['name'], sub=z['sub'], meta=meta,
                              shots=[dict(src=shots[zid]['street'], label='The street, walking in'),
                                     dict(src=shots[zid]['court'], label='The far court' + (', the boss in a fight' if z['boss'] else ''))]))
        groups.append(dict(id='act%d' % act, eyebrow='Act ' + ROMAN[act], short='Act ' + ROMAN[act], title=ACTS[act],
                           note='Each zone twice: the street as you walk in, then the far court in a fight. Pictured with %s, '
                                'so the class and its spell effects show too.' % CLASSES[part], items=items))
    # the pinnacles (normal and uber in one item) and the screens, from the "end" part
    end = poses('end')
    shot = {}
    for frame, kind, iid in end:
        shot[(kind, iid)] = picture('end', frame, '%s-%s' % (kind, iid))
    pins = []
    for name, zone, boss, uber in pinnacles():
        if uber:
            continue
        bname = mons.get(boss, name)
        pins.append(dict(id='pin-' + zone, section='pinnacles', title=name, sub=zd.get(zone, {}).get('name', ''),
                         meta=[('Area level', str(zd.get(zone, {}).get('level', 70))), ('Boss', bname), ('Pictured with', CLASSES['end'])],
                         shots=[dict(src=shot[('court', zone)], label='The court on arrival'),
                                dict(src=shot[('boss', boss)], label=bname + ' in a fight'),
                                dict(src=shot[('court', zone + '-uber')], label='The uber court'),
                                dict(src=shot[('boss', boss + '-uber')], label='The uber version in a fight')]))
    groups.append(dict(id='pinnacles', eyebrow='Endgame', short='Pinnacles', title='The pinnacles',
                       note='The three pinnacle bosses, each with its uber version.', items=pins))
    scr = [dict(id='screen-' + sid, section='screens', title=title, sub=sub, meta=[],
                shots=[dict(src=shot[('screen', sid)], label=title)]) for sid, title, sub in SCREENS if ('screen', sid) in shot]
    groups.append(dict(id='screens', eyebrow='Interface', short='Screens', title='Screens and menus',
                       note='The rooftop and every menu, at the 1920 by 1080 the game draws its interface in.', items=scr))
    # the spell effects: the sheet, at twice its size
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'fx'))
    import fx_atlas
    w, h, rgba = fx_atlas.atlas()
    sheet = Image.frombytes('RGBA', (w, h), rgba)
    bg = Image.new('RGBA', sheet.size, (24, 20, 30, 255))
    bg.alpha_composite(sheet)
    bg = bg.convert('RGB').resize((w * 2, h * 2), Image.NEAREST)
    bg.save(os.path.join(IMG, 'fx-sheet.png'), optimize=True)
    groups.append(dict(id='effects', eyebrow='Spells', short='Effects', title='Spell effects',
                       note='The pixel-art sheet every spell and hit is drawn from: eighteen effects of eight frames. They show '
                            'in play in the far-court pictures above.',
                       items=[dict(id='fx-sheet', section='effects', title='The effects sheet',
                                   sub='Fireball, ice shard, spark ball, poison, shadow orb, stone; embers, frost, zap, bubble, '
                                       'smoke, hit star, explosion, blood, splash, ice shards, void, gold',
                                   meta=[('Frames', '8 per effect'), ('Cell', '32 × 32 px')],
                                   shots=[dict(src='img/fx-sheet.png', label='All eighteen effects, frame by frame', pixel=True,
                                               w=w * 2, h=h * 2)])]))
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    n = sum(len(g['items']) for g in groups)
    data = dict(build='Pictured from build %s on %s: %d items to review.' % (commit, datetime.date.today().isoformat(), n),
                groups=groups)
    page = open(os.path.join(ROOT, 'tools', 'review', 'review.html'), encoding='utf-8').read()
    page = page.replace('/*REVIEW_DATA*/{"build": "", "groups": []}', json.dumps(data, ensure_ascii=False))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)
    size = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG))
    print('%d items, %d pictures (%.1f MB) -> %s' % (n, len(os.listdir(IMG)), size / 1e6, os.path.join(OUT, 'index.html')))


if __name__ == '__main__':
    main()
