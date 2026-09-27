"""The Book of Fixed Stars, v1: lays out the passive tree from constellation specs, validates it, and writes
assets/generated/tree/tree.json (packed as data/tree.json) and build/tree_report.md.

    python3 tools/tree/build_tree.py

The sky is concentric (GDD §5.2): the Pole at the centre, class starts on an inner ring, the Ecliptic (a ring road
of attribute stars) around them, a band of constellations, and the lunar-mansion keystones on the rim. Angles are
degrees counter-clockwise from east; +y is up (the engine flips it for the screen).

Constellations are drawn from their real star patterns. Named stars are notables and keep their Arabic names;
minor stars fill in along the lines so the tree reads as a sky. v1 builds the Pole, the Warrior (Str) and
Sorcerer (Int) regions, the Templar arc of the Ecliptic between them, and two keystones.
"""
import json
import struct
import zlib
import math
import os
import sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'generated', 'tree', 'tree.json')
REPORT = os.path.join(ROOT, 'build', 'tree_report.md')

R_START, R_ECLIPTIC, R_RIM = 300.0, 470.0, 960.0

nodes, edges = [], set()


def polar(ang, r):
    a = math.radians(ang)
    return (r * math.cos(a), r * math.sin(a))


def node(kind, x, y, mods=(), name='', star='', const='', text=None, flag='', cls=''):
    nodes.append(dict(id=len(nodes), kind=kind, x=round(x, 1), y=round(y, 1), mods=[list(m) for m in mods], name=name,
                      star=star, const=const, text=text, flag=flag, cls=cls))
    return len(nodes) - 1


def link(a, b):
    if a != b:
        edges.add((min(a, b), max(a, b)))


def chain(a, b, n, mods, const=''):
    """n minor stars evenly spaced between nodes a and b, linked in a line."""
    ax, ay, bx, by = nodes[a]['x'], nodes[a]['y'], nodes[b]['x'], nodes[b]['y']
    prev = a
    for i in range(1, n + 1):
        t = i / (n + 1)
        m = node('minor', ax + (bx - ax) * t, ay + (by - ay) * t, mods, const=const)
        link(prev, m)
        prev = m
    link(prev, b)


# ---------------------------------------------------------------- mod shorthands
def inc(stat, v, tags=''): return (stat, 'inc', v, tags.split() if tags else [])
def flat(stat, v, tags=''): return (stat, 'flat', v, tags.split() if tags else [])
def more(stat, v, tags=''): return (stat, 'more', v, tags.split() if tags else [])


LIFE = [flat('life', 10)]
LIFE_PCT = [inc('life', 5)]
ARMOUR = [inc('armour', 12)]
MELEE = [inc('damage', 10, 'melee physical')]
SLAM = [inc('damage', 10, 'slam')]
BREAK = [inc('break', 10)]
WARCRY = [inc('warcry', 8)]
SPELL = [inc('damage', 10, 'spell')]
LIGHTNING = [inc('damage', 12, 'lightning')]
COLD = [inc('damage', 12, 'cold')]
SPELL_CRIT = [inc('crit_chance', 15, 'spell')]
CAST = [inc('cast_speed', 4)]
MANA = [flat('mana', 10)]
ES = [flat('es', 8)]
ES_PCT = [inc('es', 6)]
ELE_ATTACK = [inc('damage', 10, 'attack elemental')]

# ---------------------------------------------------------------- the Pole and the class starts
pole = node('pole', 0, 0, [flat('str', 5), flat('dex', 5), flat('int', 5)], name='The Pole', star='Polaris, al-Jady',
            text=['+5 to all Attributes', 'The Wanderer will begin here'], cls='wanderer')
CLASSES = [
    ('warrior', 'The Warrior', 210, 'Strength'),
    ('templar', 'The Templar', 150, 'Strength and Intelligence'),
    ('sorcerer', 'The Sorcerer', 90, 'Intelligence'),
    ('shadow', 'The Shadow', 30, 'Dexterity and Intelligence'),
    ('ranger', 'The Ranger', 330, 'Dexterity'),
    ('mercenary', 'The Mercenary', 270, 'Strength and Dexterity'),
]
IMPLEMENTED = {'warrior', 'sorcerer'}
starts, spokes = {}, {}
for cid, cname, ang, attr in CLASSES:
    x, y = polar(ang, R_START)
    starts[cid] = node('start', x, y, name=cname, text=[attr, '' if cid in IMPLEMENTED else 'Arrives in a later slice'], cls=cid)
    # a spoke of three stars to the Pole (the Wanderer's roads), only for the classes in this build
    if cid in IMPLEMENTED or cid == 'templar':
        before = len(nodes)
        chain(pole, starts[cid], 3, LIFE if cid != 'sorcerer' else MANA)
        spokes[cid] = list(range(before, len(nodes)))   # from the Pole outwards

# ---------------------------------------------------------------- Draco, the Dragon, coiled round the Pole
def draco_arc(a_spoke, b_spoke, a_ang, b_ang, notable):
    a, b = spokes[a_spoke][1], spokes[b_spoke][1]   # the middle star of each spoke
    prev = a
    steps = 3
    for i in range(1, steps + 1):
        t = i / (steps + 1)
        ang = a_ang + (b_ang - a_ang) * t
        x, y = polar(ang, 185 + 40 * math.sin(math.pi * t))
        if i == 2:
            n = node('notable', x, y, notable[2], name=notable[1], star=notable[0], const='al-Tinnin')
        else:
            n = node('minor', x, y, [inc('damage', 6)] if i % 2 else LIFE, const='al-Tinnin')
        link(prev, n)
        prev = n
    link(prev, b)


draco_arc('sorcerer', 'templar', 90, 150, ('Thuban', 'al-Thuban, the Old Pole Star', [inc('damage', 15), inc('life', 4)]))
draco_arc('templar', 'warrior', 150, 210, ('Eltanin', 'al-Tinnin, the Dragon\'s Eye',
                                           [inc('attack_speed', 5), inc('cast_speed', 5), flat('life', 10)]))

# ---------------------------------------------------------------- the Ecliptic, from the Warrior round to the Sorcerer
ecl = []
for i, ang in enumerate([x * 10.0 for x in range(26, 4, -1)]):   # 260 .. 50 degrees
    x, y = polar(ang, R_ECLIPTIC)
    if ang >= 180:
        mods, label = [flat('str', 10)], 'Strength'
    elif ang <= 120:
        mods, label = [flat('int', 10)], 'Intelligence'
    else:
        mods, label = [flat('str', 5), flat('int', 5)], 'Strength and Intelligence'
    ecl.append(node('attr', x, y, mods, const='The Ecliptic'))
    if len(ecl) > 1:
        link(ecl[-2], ecl[-1])


def ecliptic_at(ang):
    return min(ecl, key=lambda n: abs(math.degrees(math.atan2(nodes[n]['y'], nodes[n]['x'])) % 360 - ang))


for cid in ('warrior', 'templar', 'sorcerer'):
    ang = dict((c[0], c[2]) for c in CLASSES)[cid]
    chain(starts[cid], ecliptic_at(ang), 1, LIFE if cid == 'warrior' else ES if cid == 'sorcerer' else LIFE)
# a small starter fan either side of each implemented start, onto the Ecliptic
for cid, ang, mods_a, mods_b in (('warrior', 210, MELEE, ARMOUR), ('sorcerer', 90, SPELL, ES_PCT)):
    for side, mods in ((-1, mods_a), (1, mods_b)):
        x, y = polar(ang + side * 13, R_START + 60)
        s = node('minor', x, y, mods)
        link(starts[cid], s)
        link(s, ecliptic_at(ang + side * 20))


# ---------------------------------------------------------------- constellations
def constellation(name, english, ang, radius, rot, scale, stars, lines, entries, fill=1):
    """stars: (key, kind, local_x, local_y, star_name, notable_name, mods, flag). Local x runs along the ring
    (counter-clockwise), local y outward. lines: pairs of keys; minors are filled along long lines."""
    ids = {}
    cx, cy = polar(ang, radius)
    ta = math.radians(ang + 90)  # tangent
    ra = math.radians(ang)       # radial
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for key, kind, lx, ly, star, title, mods, flag in stars:
        lx, ly = lx * cr - ly * sr, lx * sr + ly * cr
        x = cx + (math.cos(ta) * lx + math.cos(ra) * ly) * scale
        y = cy + (math.sin(ta) * lx + math.sin(ra) * ly) * scale
        ids[key] = node(kind, x, y, mods, name=title, star=star, const=name, flag=flag)
    con_lines = []
    for a, b in lines:
        ia, ib = ids[a], ids[b]
        d = math.hypot(nodes[ia]['x'] - nodes[ib]['x'], nodes[ia]['y'] - nodes[ib]['y'])
        n = max(0, int(d / 95) - 1) if fill else 0
        mods = stars[[s[0] for s in stars].index(a)][6] if nodes[ia]['kind'] == 'minor' else \
            stars[[s[0] for s in stars].index(b)][6] if nodes[ib]['kind'] == 'minor' else None
        filler = [m for m in (mods or []) if m[1] != 'more'][:1] or LIFE
        before = len(nodes)
        chain(ia, ib, n, filler, const=name)
        con_lines.append([ia, ib] + list(range(before, len(nodes))))
    for key, target in entries:
        a, b = nodes[ids[key]], nodes[target]
        gap = math.hypot(a['x'] - b['x'], a['y'] - b['y'])
        chain(ids[key], target, 1 if gap > 120 else 0, LIFE, const=name)
    constellations.append(dict(name=name, english=english, x=round(cx, 1), y=round(cy, 1), stars=list(ids.values())))
    return ids


constellations = []

# ---- the Warrior's sky (Strength, around 210 degrees)
leo = constellation('al-Asad', 'Leo, the Lion', 234, 640, 20, 78, [
    ('reg', 'notable', 0, 0, 'Regulus', 'Qalb al-Asad, the Lion\'s Heart', [flat('life', 30), inc('life', 8)], ''),
    ('alg', 'notable', 0.4, 1.3, 'Algieba', 'al-Jabha, the Brow', [flat('fire_res', 12), flat('cold_res', 12), flat('lightning_res', 12)], ''),
    ('den', 'notable', -2.1, 0.6, 'Denebola', 'Dhanab al-Asad, the Tail', [inc('armour', 30), flat('life_regen', 2)], ''),
    ('zos', 'minor', -1.2, 1.1, 'Zosma', '', LIFE, ''),
    ('che', 'minor', -1.1, 0.1, 'Chertan', '', ARMOUR, ''),
    ('adh', 'minor', 0.9, 2.1, 'Adhafera', '', LIFE_PCT, ''),
    ('ras', 'minor', 1.7, 2.6, 'Ras Elased', '', LIFE, ''),
], [('reg', 'che'), ('che', 'den'), ('den', 'zos'), ('zos', 'alg'), ('reg', 'alg'), ('alg', 'adh'), ('adh', 'ras')], [('reg', ecliptic_at(225))])

orion = constellation('al-Jabbar', 'Orion, the Giant', 209, 700, 0, 82, [
    ('bet', 'notable', -1.0, 1.5, 'Betelgeuse', 'Yad al-Jawza, the Hand', [inc('damage', 30, 'melee physical')], ''),
    ('bel', 'notable', 1.0, 1.4, 'Bellatrix', 'al-Najid, the Conqueror', [inc('attack_speed', 10), flat('str', 10)], ''),
    ('alk', 'minor', -0.7, 0.35, 'Alnitak', '', SLAM, ''),
    ('aln', 'minor', 0.0, 0.2, 'Alnilam', '', SLAM, ''),
    ('min', 'minor', 0.7, 0.05, 'Mintaka', '', SLAM, ''),
    ('rig', 'notable', 0.9, -1.2, 'Rigel', 'Rijl al-Jabbar, the Giant\'s Foot', [inc('damage', 25, 'slam'), inc('break', 15)], ''),
    ('sai', 'minor', -0.9, -1.1, 'Saiph', '', MELEE, ''),
    ('mei', 'minor', 0.0, 2.3, 'Meissa', '', MELEE, ''),
], [('bet', 'mei'), ('mei', 'bel'), ('bet', 'alk'), ('alk', 'aln'), ('aln', 'min'), ('min', 'bel'), ('bet', 'bel'), ('min', 'rig'), ('alk', 'sai'), ('sai', 'rig')],
    [('sai', ecliptic_at(205))])

taurus = constellation('al-Thawr', 'Taurus, the Bull', 184, 720, -10, 80, [
    ('ald', 'minor', 0, 0, 'Aldebaran', '', BREAK, ''),
    ('nat', 'notable', 1.3, 1.5, 'Elnath', 'al-Nath, the Butting Horn', [inc('warcry', 25), flat('warcry', 1)], ''),
    ('zet', 'notable', -1.2, 1.6, 'Tianguan', 'Qarn al-Thawr, the Horn', [inc('break', 30), inc('damage', 10, 'melee')], ''),
    ('hya', 'minor', 0.2, -0.8, 'the Hyades', '', WARCRY, ''),
    ('ple', 'notable', 1.0, -1.0, 'the Pleiades', 'al-Thurayya, the Many Little Ones', [inc('life', 6), inc('damage_taken', -6)], ''),
    ('tip', 'minor', 2.1, 2.2, '', '', BREAK, ''),
], [('ald', 'nat'), ('ald', 'zet'), ('ald', 'hya'), ('hya', 'ple'), ('nat', 'tip')], [('hya', ecliptic_at(185))])

# ---- the Templar's arc between them (Strength and Intelligence, around 150 degrees)
aquila = constellation('al-Nasr al-Tair', 'Aquila, the Flying Eagle', 150, 640, 0, 80, [
    ('alt', 'notable', 0, 0, 'Altair', 'al-Tair, the Flyer', [inc('damage', 20, 'elemental'), inc('cast_speed', 6), inc('attack_speed', 6)], ''),
    ('tar', 'minor', 0.8, 0.6, 'Tarazed', '', ELE_ATTACK, ''),
    ('ali', 'minor', -0.8, -0.5, 'Alshain', '', SPELL, ''),
    ('del', 'notable', 1.6, 1.6, 'Deneb el Okab', 'Dhanab al-Uqab, the Eagle\'s Tail', [flat('life', 20), flat('es', 20)], ''),
], [('alt', 'tar'), ('alt', 'ali'), ('tar', 'del')], [('ali', ecliptic_at(150))])

# ---- the Sorcerer's sky (Intelligence, around 90 degrees)
scorpius = constellation('al-Aqrab', 'Scorpius, the Scorpion', 58, 680, 30, 78, [
    ('ant', 'notable', 0, 0, 'Antares', 'Qalb al-Aqrab, the Scorpion\'s Heart', [inc('damage', 30, 'lightning'), inc('shock', 30)], ''),
    ('ikl', 'minor', 0.9, 0.9, 'Acrab', '', LIGHTNING, ''),
    ('dsc', 'minor', -0.4, -0.9, 'Larawag', '', LIGHTNING, ''),
    ('sha', 'notable', -1.6, -1.4, 'Shaula', 'al-Shawla, the Raised Tail', [flat('chains', 1), inc('damage', 10, 'lightning')], ''),
    ('dsh', 'notable', 1.8, 1.5, 'Dschubba', 'al-Jabha, the Forehead', [inc('cast_speed', 10), inc('mana_regen', 20)], ''),
    ('sar', 'minor', 2.7, 2.3, 'Sargas', '', LIGHTNING, ''),
], [('ant', 'ikl'), ('ikl', 'dsh'), ('ant', 'dsc'), ('dsc', 'sha'), ('dsh', 'sar')], [('sha', ecliptic_at(50))])

cygnus = constellation('al-Dajaja', 'Cygnus, the Hen', 96, 720, 0, 80, [
    ('den', 'notable', 0, 1.6, 'Deneb', 'Dhanab al-Dajaja, the Hen\'s Tail', [inc('crit_chance', 50, 'spell')], ''),
    ('sad', 'minor', 0, 0.3, 'Sadr', '', SPELL_CRIT, ''),
    ('gie', 'minor', -1.1, 0.5, 'Gienah', '', SPELL, ''),
    ('del', 'minor', 1.1, 0.1, 'Fawaris', '', SPELL, ''),
    ('alb', 'notable', 0.1, -1.2, 'Albireo', 'Minqar al-Dajaja, the Beak', [flat('crit_multi', 30, 'spell')], ''),
    ('wl', 'minor', -2.0, 0.9, '', '', SPELL_CRIT, ''),
    ('wr', 'minor', 2.0, -0.2, '', '', SPELL, ''),
], [('den', 'sad'), ('sad', 'gie'), ('sad', 'del'), ('sad', 'alb'), ('gie', 'wl'), ('del', 'wr')], [('alb', ecliptic_at(95))])

lyra = constellation('al-Nasr al-Waqi', 'Lyra, the Swooping Eagle', 122, 610, -15, 78, [
    ('veg', 'notable', 0, 0, 'Vega', 'al-Waqi, the Swooping One', [inc('damage', 25, 'cold'), inc('freeze', 30)], ''),
    ('she', 'minor', 0.9, 0.7, 'Sheliak', '', COLD, ''),
    ('sul', 'minor', -0.2, 1.2, 'Sulafat', '', COLD, ''),
    ('eps', 'notable', 1.2, 1.9, 'the Double Double', 'al-Adhfar, the Talons', [inc('area', 15, 'spell'), inc('damage', 10, 'spell area')], ''),
], [('veg', 'she'), ('veg', 'sul'), ('sul', 'eps'), ('she', 'eps')], [('veg', ecliptic_at(115))])

corona = constellation('al-Fakka', 'Corona Borealis, the Broken Dish', 80, 560, 0, 60, [
    ('alp', 'notable', 0, 1.2, 'Alphecca', 'Nayyir al-Fakka, the Bright One', [inc('es', 25), inc('es_recharge', 30)], ''),
    ('a1', 'minor', -1.1, 0.8, '', '', ES_PCT, ''),
    ('a2', 'minor', -1.3, -0.3, '', '', ES, ''),
    ('a3', 'minor', 1.1, 0.8, '', '', MANA, ''),
    ('a4', 'minor', 1.3, -0.3, '', '', ES, ''),
], [('a2', 'a1'), ('a1', 'alp'), ('alp', 'a3'), ('a3', 'a4')], [], fill=0)
link(corona['a2'], ecliptic_at(70))   # local -x is clockwise
link(corona['a4'], ecliptic_at(90))

# ---- more of the Warrior's sky: the Great Dog, below Orion
canis = constellation('al-Kalb al-Akbar', 'Canis Major, the Great Dog', 250, 660, 0, 80, [
    ('sir', 'notable', 0, 0.9, 'Sirius', 'al-Shira, the Leader', [flat('life_leech', 3), flat('life_regen', 2)], ''),
    ('mir', 'minor', 0.9, 1.4, 'Mirzam', '', MELEE, ''),
    ('adh', 'notable', -0.3, -0.8, 'Adhara', 'al-Adhara, the Maidens', [inc('attack_speed', 8), inc('damage', 10, 'melee')], ''),
    ('wez', 'minor', 0.6, -0.4, 'Wezen', '', LIFE, ''),
    ('alu', 'minor', 1.4, -1.0, 'Aludra', '', ARMOUR, ''),
    ('fur', 'minor', -1.2, 1.4, 'Furud', '', LIFE, ''),
], [('sir', 'mir'), ('sir', 'wez'), ('wez', 'adh'), ('wez', 'alu'), ('sir', 'fur')], [('adh', ecliptic_at(250))])

# ---- more of the Sorcerer's sky: Perseus, who carries the Demon's Head
perseus = constellation('Hamil Ras al-Ghul', 'Perseus, Bearer of the Demon\'s Head', 36, 660, 0, 80, [
    ('mir', 'notable', 0, 0, 'Mirfak', 'al-Mirfaq, the Elbow', [inc('cast_speed', 8), inc('mana_regen', 25)], ''),
    ('alg', 'notable', 1.2, 1.3, 'Algol', 'Ras al-Ghul, the Demon\'s Head', [inc('freeze', 20), inc('shock', 20), inc('damage', 12, 'elemental')], ''),
    ('m1', 'minor', -0.9, 0.7, 'Atik', '', MANA, ''),
    ('m2', 'minor', 0.9, -0.5, 'Menkib', '', ES, ''),
    ('m3', 'minor', -1.1, -0.6, '', '', CAST, ''),
    ('gor', 'minor', 2.3, 2.0, 'Gorgonea', '', COLD, ''),
], [('mir', 'alg'), ('mir', 'm1'), ('mir', 'm2'), ('mir', 'm3'), ('alg', 'gor')], [('m2', ecliptic_at(50))])

# ---- more of the Templar's arc: the Charioteer and the Crow
auriga = constellation('al-Ayyuq', 'Auriga, the Charioteer', 170, 600, 0, 78, [
    ('cap', 'notable', 0, 0.7, 'Capella', 'al-Ayyuq, the Goat Star', [flat('life', 25), inc('es', 12), flat('str', 5), flat('int', 5)], ''),
    ('men', 'minor', 1.0, 0.2, 'Menkalinan', '', ES, ''),
    ('han', 'minor', -1.0, 0.3, 'Hassaleh', '', LIFE, ''),
    ('kid', 'minor', 0.1, -0.5, 'the Kids', '', ES, ''),
], [('cap', 'men'), ('cap', 'han'), ('cap', 'kid')], [('kid', ecliptic_at(170))])

corvus = constellation('al-Ghurab', 'Corvus, the Crow', 136, 780, 0, 72, [
    ('gie', 'notable', 0, 0, 'Gienah', 'al-Ghurab, the Crow', [inc('area', 15), inc('warcry', 15)], ''),
    ('alc', 'minor', 0.9, 0.5, 'Algorab', '', [inc('area', 5)], ''),
    ('kra', 'minor', -0.9, 0.6, 'Kraz', '', ELE_ATTACK, ''),
    ('min', 'minor', 0.0, -0.9, 'Minkar', '', SPELL, ''),
], [('gie', 'alc'), ('gie', 'kra'), ('gie', 'min')], [('min', aquila['del'])])

# ---- the rim: two lunar mansions
KEYSTONES = [
    ('al-Dabaran, the Follower', 'Aldebaran, the 4th lunar mansion', 'follower', 200,
     ['You deal 40% more damage to the last enemy that hit you', 'You deal 20% less damage to all others'], orion['bet']),
    ('al-Simak, the Unarmed', 'Spica, the 14th lunar mansion', 'overload', 100,
     ['Your critical strikes deal no extra damage', 'A critical strike grants 40% more elemental damage for 6 seconds'], cygnus['den']),
]
keystones = []
for title, star, flag, ang, text, anchor in KEYSTONES:
    x, y = polar(ang, R_RIM)
    k = node('keystone', x, y, name=title, star=star, flag=flag, text=text, const='the Lunar Mansions')
    chain(anchor, k, 1, LIFE if flag == 'follower' else SPELL, const='the Lunar Mansions')
    keystones.append(k)

# ================================================================ Slice 6: the Ranger's sky
# Everything below is appended after the Slice 3 stars, so their ids (which characters store) never move.
PROJ = [inc('damage', 10, 'projectile')]
EVASION = [inc('evasion', 12)]
DEX = [flat('dex', 10)]
IMPLEMENTED.add('ranger')
nodes[starts['ranger']]['text'] = ['Dexterity', '']
before = len(nodes)
chain(pole, starts['ranger'], 3, EVASION)
spokes['ranger'] = list(range(before, len(nodes)))

# the Ecliptic closes: on from 50 degrees round through the Shadow's and the Ranger's skies to 260
ring = [ecl[-1]]
for ang in [x * 10.0 for x in range(4, -10, -1)]:   # 40 .. -90 (= 270)
    x, y = polar(ang, R_ECLIPTIC)
    a360 = ang % 360
    if 300 <= a360 < 360:
        mods = [flat('dex', 10)]
    elif a360 < 60:
        mods = [flat('dex', 5), flat('int', 5)]
    else:
        mods = [flat('str', 5), flat('dex', 5)]
    ring.append(node('attr', x, y, mods, const='The Ecliptic'))
    link(ring[-2], ring[-1])
link(ring[-1], ecl[0])
ecl.extend(ring[1:])

chain(starts['ranger'], ecliptic_at(330), 1, EVASION)
for side, mods in ((-1, PROJ), (1, EVASION)):
    x, y = polar(330 + side * 13, R_START + 60)
    s_ = node('minor', x, y, mods)
    link(starts['ranger'], s_)
    link(s_, ecliptic_at(330 + side * 20))

sagittarius = constellation('al-Rami', 'Sagittarius, the Archer', 330, 680, 0, 80, [
    ('kau', 'notable', 0, 0, 'Kaus Australis', 'al-Qaws, the Bow', [inc('damage', 30, 'projectile')], ''),
    ('kam', 'minor', 0.9, 0.3, 'Kaus Media', '', PROJ, ''),
    ('kbo', 'minor', -0.2, -1.0, 'Kaus Borealis', '', PROJ, ''),
    ('phi', 'minor', -0.7, 0.8, '', '', EVASION, ''),
    ('asc', 'notable', -1.3, 1.5, 'Ascella', 'al-Zuba, the Claw', [inc('crit_chance', 40, 'projectile'), flat('crit_multi', 10, 'projectile')], ''),
    ('nun', 'notable', 1.2, 1.5, 'Nunki', "al-Na'aim, the Ostriches", [inc('attack_speed', 8), inc('move_speed', 6)], ''),
    ('tau', 'minor', 1.9, 2.4, 'Tau', '', PROJ, ''),
], [('kau', 'kam'), ('kau', 'kbo'), ('kau', 'phi'), ('phi', 'asc'), ('kam', 'nun'), ('nun', 'tau')], [('kbo', ecliptic_at(330))])

lepus = constellation('al-Arnab', 'Lepus, the Hare', 298, 610, 0, 72, [
    ('arn', 'notable', 0, 0, 'Arneb', 'al-Arnab, the Hare', [inc('move_speed', 10), inc('evasion', 30)], ''),
    ('nih', 'notable', 1.2, 1.2, 'Nihal', 'al-Nihal, the Thirst-Quenchers', [inc('flask', 30), flat('life_regen', 2)], ''),
    ('m1', 'minor', -1.1, 0.5, '', '', EVASION, ''),
    ('m2', 'minor', 0.6, -0.8, '', '', DEX, ''),
], [('arn', 'm1'), ('arn', 'm2'), ('arn', 'nih')], [('m2', ecliptic_at(300))])

pegasus = constellation('al-Faras al-Azam', 'Pegasus, the Great Horse', 358, 700, 0, 80, [
    ('mar', 'notable', 0, 0, 'Markab', 'Markab al-Faras, the Saddle', [inc('evasion', 40), flat('life', 15)], ''),
    ('alg', 'minor', 1.1, -0.4, 'Algenib', '', PROJ, ''),
    ('hom', 'minor', -0.9, 0.5, 'Homam', '', EVASION, ''),
    ('eni', 'notable', -1.3, 1.5, 'Enif', 'Anf al-Faras, the Nose', [inc('proj_speed', 20), inc('damage', 15, 'projectile')], ''),
    ('sch', 'notable', 1.3, 1.2, 'Scheat', "Sa'd al-Matar, the Rain's Luck", [flat('poison', 20), inc('poison_damage', 25)], ''),
], [('mar', 'alg'), ('mar', 'hom'), ('hom', 'eni'), ('alg', 'sch')], [('alg', ecliptic_at(350))])

x, y = polar(322, R_RIM)
k = node('keystone', x, y, name='al-Balda, Point Blank', star='the 21st lunar mansion', flag='point_blank',
         text=['Projectile attacks deal up to 40% more damage to enemies near you', 'and up to 30% less to enemies far away'],
         const='the Lunar Mansions')
chain(sagittarius['asc'], k, 1, PROJ, const='the Lunar Mansions')
keystones.append(k)

# ---------------------------------------------------------------- Recommended Paths (GDD §13)
# the notables and keystones a new player aims for, in order; the tree screen can plan them in one press
RECOMMENDED = {
    'warrior': [orion['rig'], orion['sai'], leo['reg'], orion['bet'], orion['bel'], taurus['zet'], taurus['nat'], keystones[0]],
    'sorcerer': [corona['alp'], lyra['veg'], scorpius['ant'], scorpius['sha'], perseus['mir'], perseus['alg'], cygnus['den']],
    'ranger': [sagittarius['kau'], lepus['arn'], sagittarius['asc'], pegasus['mar'], pegasus['eni'], sagittarius['nun'], keystones[2]],
}

# ---------------------------------------------------------------- text for every node
NAMES = {'life': 'maximum Life', 'mana': 'maximum Mana', 'es': 'maximum Hirz', 'str': 'Strength', 'int': 'Intelligence',
         'dex': 'Dexterity', 'armour': 'Armour', 'evasion': 'Evasion', 'fire_res': 'Fire Resistance',
         'cold_res': 'Cold Resistance', 'lightning_res': 'Lightning Resistance', 'chaos_res': 'Chaos Resistance',
         'life_regen': 'Life Regeneration per second', 'mana_regen': 'Mana Regeneration', 'attack_speed': 'Attack Speed',
         'cast_speed': 'Cast Speed', 'crit_chance': 'Critical Strike Chance', 'crit_multi': 'Critical Strike Multiplier',
         'area': 'Area of Effect', 'break': 'Break buildup', 'warcry': 'Warcry effect', 'es_recharge': 'Hirz recharge rate',
         'freeze': 'Freeze buildup', 'shock': 'Effect of Shock', 'chains': 'Chain', 'damage_taken': 'damage taken',
         'move_speed': 'Movement Speed', 'life_leech': 'Life', 'poison': 'chance to Poison', 'poison_damage': 'Poison damage',
         'proj_speed': 'Projectile Speed', 'flask': 'Flask Recovery', 'mark': 'Mark effect'}
TAGW = {'melee': 'Melee', 'physical': 'Physical', 'slam': 'Slam', 'spell': 'Spell', 'lightning': 'Lightning', 'cold': 'Cold',
        'fire': 'Fire', 'elemental': 'Elemental', 'attack': 'Attack', 'area': 'Area', 'projectile': 'Projectile', 'bow': 'Bow'}


def mod_text(m):
    stat, kind, v, tags = m
    tw = ' '.join(TAGW[t] for t in tags)
    if stat == 'damage':
        what = (tw + ' Damage').strip()
    elif stat in ('crit_chance', 'crit_multi') and 'spell' in tags:
        what = NAMES[stat] + ' for Spells'
    else:
        what = NAMES[stat]
    if stat == 'chains':
        return 'Arc chains %+d more time%s' % (v, '' if v == 1 else 's')
    if stat == 'life_leech':
        return 'Gain %d Life per enemy hit' % v
    if stat == 'warcry' and kind == 'flat':
        return 'Warcries grant %+d Rally charge' % v
    if kind == 'flat':
        if stat.endswith('_res') or stat == 'crit_multi':
            return '%+d%% to %s' % (v, what)
        if stat == 'life_regen':
            return 'Regenerate %d Life per second' % v
        return '%+d to %s' % (v, what)
    if kind == 'inc':
        if v < 0:
            return '%d%% less %s' % (-v, what) if stat == 'damage_taken' else '%d%% reduced %s' % (-v, what)
        return '%d%% increased %s' % (v, what)
    return '%d%% more %s' % (v, what)


for n in nodes:
    if n['text'] is None:
        lines = [mod_text(m) for m in n['mods']]
        # three resistances read as one line
        res = [l for l in lines if l.endswith('Resistance') and l.startswith('+')]
        if len(res) == 3 and len(set(l.split('%')[0] for l in res)) == 1:
            lines = [l for l in lines if l not in res] + [res[0].split(' to ')[0] + ' to all Elemental Resistances']
        n['text'] = lines
    n['text'] = [t for t in n['text'] if t]

# ---------------------------------------------------------------- validation (GDD §5.7, adapted for v1)
adj = {n['id']: set() for n in nodes}
for a, b in edges:
    adj[a].add(b)
    adj[b].add(a)
errors, notes = [], []


def dist_from(start):
    """points needed to allocate each node from a class start (never pathing through other starts)"""
    d = {start: 0}
    q = deque([start])
    while q:
        c = q.popleft()
        for n in adj[c]:
            if n in d or (nodes[n]['kind'] == 'start' and n != start):
                continue
            d[n] = d[c] + 1
            q.append(n)
    return d


allocatable = [n['id'] for n in nodes if n['kind'] != 'start']
for cid in IMPLEMENTED:
    d = dist_from(starts[cid])
    missing = [n for n in allocatable if n not in d]
    if missing:
        errors.append('%s cannot reach %d stars (e.g. %s)' % (cid, len(missing), nodes[missing[0]]))
    kd = sorted(d.get(k, 999) for k in keystones)
    if kd[0] > 25:
        errors.append('%s: nearest keystone is %d points away (rule: <= 25)' % (cid, kd[0]))
    if kd[-1] > 60:
        errors.append('%s: farthest keystone is %d points away (rule: <= 60)' % (cid, kd[-1]))
    notes.append('%s reaches the keystones in %s points' % (cid, ', '.join(str(k) for k in kd)))

for cid, targets in RECOMMENDED.items():
    held = {starts[cid]}
    total = 0
    for t in targets:
        # cheapest route from everything held so far
        d = {h: 0 for h in held}
        prev = {}
        q = deque(held)
        while q:
            c = q.popleft()
            for n in adj[c]:
                if n in d or (nodes[n]['kind'] == 'start' and n != starts[cid]):
                    continue
                d[n] = d[c] + 1
                prev[n] = c
                q.append(n)
        if t not in d:
            errors.append('%s: recommended star %d is unreachable' % (cid, t))
            continue
        c = t
        while c not in held:
            held.add(c)
            total += 1
            c = prev[c]
    notes.append('%s\'s Recommended Path takes %d points' % (cid, total))

# spacing for the controller UI
for i, a in enumerate(nodes):
    for b in nodes[i + 1:]:
        dd = math.hypot(a['x'] - b['x'], a['y'] - b['y'])
        if dd < 44:
            errors.append('stars %d and %d are only %.0f apart' % (a['id'], b['id'], dd))
for a, b in edges:
    dd = math.hypot(nodes[a]['x'] - nodes[b]['x'], nodes[a]['y'] - nodes[b]['y'])
    if dd > 190:
        errors.append('edge %d-%d is %.0f long' % (a, b, dd))

# no two edges may cross: a sky you can read on a handheld
def crosses(p1, p2, p3, p4):
    def orient(a, b, c):
        v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        return 0 if abs(v) < 1e-6 else (1 if v > 0 else -1)
    return orient(p1, p2, p3) * orient(p1, p2, p4) < 0 and orient(p3, p4, p1) * orient(p3, p4, p2) < 0


pts = {n['id']: (n['x'], n['y']) for n in nodes}
el = sorted(edges)
for i, (a, b) in enumerate(el):
    for c, d in el[i + 1:]:
        if len({a, b, c, d}) == 4 and crosses(pts[a], pts[b], pts[c], pts[d]):
            errors.append('edges %d-%d (%s) and %d-%d (%s) cross' % (a, b, nodes[a]['const'] or nodes[a]['kind'], c, d,
                                                                  nodes[c]['const'] or nodes[c]['kind']))

# notable power bands: a rough "points" score per notable
WEIGHT = {('damage', 'inc'): 1.0, ('life', 'flat'): 0.5, ('life', 'inc'): 2.5, ('armour', 'inc'): 0.8, ('es', 'inc'): 1.0,
          ('es', 'flat'): 0.6, ('fire_res', 'flat'): 0.8, ('cold_res', 'flat'): 0.8, ('lightning_res', 'flat'): 0.8,
          ('attack_speed', 'inc'): 2.0, ('cast_speed', 'inc'): 1.6, ('crit_chance', 'inc'): 0.6, ('crit_multi', 'flat'): 1.0,
          ('break', 'inc'): 0.8, ('warcry', 'inc'): 0.6, ('warcry', 'flat'): 12.0, ('shock', 'inc'): 0.4, ('freeze', 'inc'): 0.4,
          ('chains', 'flat'): 20.0, ('str', 'flat'): 0.8, ('int', 'flat'): 0.8, ('mana_regen', 'inc'): 0.5,
          ('es_recharge', 'inc'): 0.4, ('life_regen', 'flat'): 4.0, ('area', 'inc'): 1.0, ('damage_taken', 'inc'): -2.5,
          ('life_leech', 'flat'): 6.0, ('mana', 'flat'): 0.4}
for n in nodes:
    if n['kind'] != 'notable':
        continue
    score = sum(WEIGHT.get((m[0], m[1]), 1.0) * m[2] for m in n['mods'])
    n['power'] = round(score, 1)
    if not 22 <= score <= 48:
        errors.append('notable %s scores %.1f (band 22-48)' % (n['name'], score))

# concentration: generic stats should not pile up in one constellation
GENERIC = ('life', 'armour', 'es', 'str', 'int', 'mana')
by_const = {}
for n in nodes:
    for m in n['mods']:
        if m[0] in GENERIC and m[1] == 'flat':
            by_const.setdefault(m[0], {}).setdefault(n['const'] or n['kind'], 0)
            by_const[m[0]][n['const'] or n['kind']] += m[2]
for stat, per in by_const.items():
    total = sum(per.values())
    for c, v in per.items():
        if c not in ('The Ecliptic', 'minor') and total > 0 and v / total > 0.4 and len(per) >= 3:
            errors.append('%s holds %.0f%% of all flat %s' % (c, 100 * v / total, stat))

counts = {}
for n in nodes:
    counts[n['kind']] = counts.get(n['kind'], 0) + 1

os.makedirs(os.path.dirname(OUT), exist_ok=True)
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
with open(OUT, 'w') as f:
    json.dump(dict(version=1, classes={cid: starts[cid] for cid in starts}, implemented=sorted(IMPLEMENTED), pole=pole,
                   recommended=RECOMMENDED,
                   nodes=nodes, edges=sorted(edges), constellations=constellations, keystones=keystones), f, indent=0)
with open(REPORT, 'w') as f:
    f.write('# Tree report\n\n%d stars, %d edges: %s\n\n' % (len(nodes), len(edges), ', '.join('%d %s' % (v, k) for k, v in sorted(counts.items()))))
    f.write('\n'.join('- ' + s for s in notes) + '\n\n## Notables\n\n| Star | Notable | Power |\n|---|---|---|\n')
    for n in nodes:
        if n['kind'] == 'notable':
            f.write('| %s | %s | %.1f |\n' % (n['star'], n['name'], n['power']))
    f.write('\n## Problems\n\n' + ('\n'.join('- ' + e for e in errors) if errors else 'none') + '\n')
print('TREE %d stars, %d edges (%s); %s' % (len(nodes), len(edges), ', '.join('%d %s' % (v, k) for k, v in sorted(counts.items())),
                                          '; '.join(notes)))


def preview(path, size=1400):
    """A plain PNG of the sky (pure Python): edges, stars by kind, class starts. For eyeballing the layout."""
    img = bytearray(size * size * 3)
    span = max(max(abs(n['x']), abs(n['y'])) for n in nodes) + 60
    to = lambda x, y: (int(size / 2 + x / span * size / 2), int(size / 2 - y / span * size / 2))

    def put(px, py, c):
        if 0 <= px < size and 0 <= py < size:
            i = (py * size + px) * 3
            img[i:i + 3] = bytes(c)

    def line(a, b, c):
        (x0, y0), (x1, y1) = to(a['x'], a['y']), to(b['x'], b['y'])
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            put(x0 + (x1 - x0) * k // n, y0 + (y1 - y0) * k // n, c)

    def dot(n, r, c):
        cx, cy = to(n['x'], n['y'])
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    put(cx + dx, cy + dy, c)

    for a, b in edges:
        line(nodes[a], nodes[b], (90, 80, 60))
    style = {'minor': (4, (200, 190, 160)), 'attr': (4, (120, 170, 220)), 'notable': (8, (242, 180, 70)),
             'keystone': (13, (255, 60, 140)), 'start': (11, (60, 200, 190)), 'pole': (11, (255, 255, 255))}
    for n in nodes:
        r, c = style[n['kind']]
        dot(n, r, c)
    raw = b''.join(b'\x00' + bytes(img[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) +
                chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


preview(os.path.join(ROOT, 'build', 'tree_preview.png'))
if errors:
    print('TREE INVALID:\n  ' + '\n  '.join(errors))
    sys.exit(1)
