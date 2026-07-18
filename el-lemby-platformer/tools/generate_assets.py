#!/usr/bin/env python3
"""
Pixel-art asset generator for the El-Lemby platformer. The visual theme
(currently «اللي بالي بالك» — the prison sequel) is selected by THEMES /
ACTIVE_THEME below, or the LEMBY_THEME env var.

Generates every sprite, tile, and background strip the game uses as PNG files in
Sources/ElLembyCore/Resources/sprites/, plus a human-reviewable contact sheet in
docs/. Pure stdlib (zlib + struct) — no Pillow required.

Run from the project root:  python3 tools/generate_assets.py
"""

import os
import random
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES_DIR = os.path.join(ROOT, "Sources", "ElLembyCore", "Resources", "sprites")
DOCS_DIR = os.path.join(ROOT, "docs")

# ---------------------------------------------------------------------------
# Minimal PNG writer (RGBA, 8-bit)
# ---------------------------------------------------------------------------

def _chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def png_bytes(grid) -> bytes:
    h = len(grid)
    w = len(grid[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *px) for px in row) for row in grid
    )
    return (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(raw, 9))
            + _chunk(b"IEND", b""))


def write_png(path: str, grid) -> None:
    with open(path, "wb") as f:
        f.write(png_bytes(grid))


def write_ico(path: str, grids) -> None:
    """Windows .ico with PNG-compressed entries (Vista+)."""
    blobs = [(len(g[0]), png_bytes(g)) for g in grids]
    out = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    for size, blob in blobs:
        s = 0 if size >= 256 else size
        out += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    for _, blob in blobs:
        out += blob
    with open(path, "wb") as f:
        f.write(out)


# ---------------------------------------------------------------------------
# Grid helpers — a grid is a list of rows of (r, g, b, a) tuples
# ---------------------------------------------------------------------------

CLEAR = (0, 0, 0, 0)


def blank(w: int, h: int, color=CLEAR):
    return [[color for _ in range(w)] for _ in range(h)]


def put(grid, x: int, y: int, color) -> None:
    if 0 <= y < len(grid) and 0 <= x < len(grid[0]):
        grid[y][x] = color


def rect(grid, x: int, y: int, w: int, h: int, color) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(grid, xx, yy, color)


def blit(dst, src, ox: int, oy: int) -> None:
    for y, row in enumerate(src):
        for x, px in enumerate(row):
            if px[3] != 0:
                put(dst, ox + x, oy + y, px)


def scale(grid, k: int):
    out = []
    for row in grid:
        srow = []
        for px in row:
            srow.extend([px] * k)
        out.extend([list(srow) for _ in range(k)])
    return out


def from_map(rows, legend, width: int):
    """Build a grid from ASCII art rows. Rows shorter than `width` are padded
    with transparency so hand-authored maps stay forgiving."""
    grid = []
    for r, row in enumerate(rows):
        if len(row) > width:
            raise ValueError(f"row {r} is {len(row)} chars, max {width}: {row!r}")
        row = row.ljust(width, ".")
        line = []
        for ch in row:
            if ch not in legend:
                raise ValueError(f"unknown pixel char {ch!r} in row {r}")
            line.append(legend[ch] or CLEAR)
        grid.append(line)
    return grid


# ---------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------

def C(r, g, b, a=255):
    return (r, g, b, a)


PAL = {
    ".": None,                    # transparent
    "K": C(20, 15, 18),           # outline
    "H": C(42, 31, 24),           # hair, dark
    "h": C(70, 52, 36),           # hair highlight
    "S": C(205, 148, 96),         # skin
    "s": C(172, 116, 75),         # skin shade / hands
    "t": C(126, 87, 60),          # stubble
    "W": C(243, 236, 224),        # white
    "w": C(206, 197, 183),        # white shade
    "R": C(153, 47, 62),          # tracksuit maroon
    "r": C(112, 32, 47),          # maroon shade
    "B": C(58, 74, 112),          # thug galabeya blue
    "b": C(42, 53, 84),           # galabeya shade
    "C": C(216, 190, 141),        # thug cap beige
    "c": C(181, 152, 105),        # cap shade
    "P": C(216, 108, 143),        # Nousa dress pink
    "p": C(174, 76, 112),         # dress shade
    "M": C(168, 62, 62),          # lips
    "G": C(255, 199, 66),         # gold
    "g": C(199, 141, 29),        # gold shade
    "k": C(58, 52, 57),           # shoe dark gray
    "E": C(96, 148, 62),          # green (pickle bits)
    "D": C(226, 182, 112),        # bread light
    "d": C(178, 130, 72),         # bread crust
    "F": C(112, 75, 41),          # foul (bean) filling
    "N": C(232, 120, 138),        # heart pink
    "n": C(184, 76, 100),         # heart shade
    "U": C(170, 125, 80),         # cart wood
    "u": C(129, 91, 56),          # cart wood shade
    "Y": C(255, 223, 128),        # polished brass highlight
    "V": C(198, 44, 66),          # Batta's red dress
    "v": C(152, 28, 50),          # dress shade
}


# ---------------------------------------------------------------------------
# Themes — the game's look lives here, not in platform code. Every frontend
# loads sprites by name, so switching ACTIVE_THEME re-dresses macOS, Windows,
# and the web build at once. (UI strings are set per platform to match.)
#
#   harah — the original «اللمبي» (2002): the alley, maroon tracksuit.
#   bali  — «اللي بالي بالك» (2003): prison whites, the cell block & yard,
#           bread (رغيف عيش) as the canteen currency instead of coins.
# ---------------------------------------------------------------------------

THEMES = {
    "harah": {
        "pal": {},                       # base palette as-is
        "tiles": {},                     # base tile colors as-is
        "coin_light": C(255, 199, 66),   # gold coin
        "coin_dark": C(199, 141, 29),
        "bg_far": lambda rng: bg_far_harah(rng),
        "bg_near": lambda rng: bg_near_harah(rng),
        "bg_fore": lambda rng: bg_fore_harah(rng),
        # the goal/love-interest role (sprite names stay nousa_*): نوسة
        "goal_maps": lambda: (NOUSA_A, NOUSA_B),
    },
    "bali": {
        "pal": {
            "R": C(236, 232, 222),       # prison whites (was tracksuit maroon)
            "r": C(200, 194, 182),
            "C": C(238, 234, 226),       # bully's white prisoner cap
            "c": C(196, 190, 178),
        },
        "tiles": {
            "dust_light": C(186, 184, 176),   # concrete yard
            "dust_rim": C(108, 106, 100),
            "cobble_base": C(118, 116, 110),
            "stone_light": C(168, 166, 156),
            "stone_border": C(126, 124, 116),
            "dirt_base": C(102, 100, 94),
            "dirt_fleck_l": C(122, 120, 112),
            "dirt_fleck_d": C(84, 82, 78),
            "brick": C(140, 140, 136),        # cell-block stone
            "brick_hi": C(162, 162, 156),
            "brick_sh": C(114, 114, 110),
            "mortar": C(88, 88, 86),
        },
        "coin_light": C(214, 160, 84),   # رغيف عيش — bread, the yard currency
        "coin_dark": C(166, 113, 52),
        "bg_far": lambda rng: bg_far_bali(rng),
        "bg_near": lambda rng: bg_near_bali(rng),
        "bg_fore": lambda rng: bg_fore_bali(rng),
        # the goal/love-interest role (sprite names stay nousa_*): سونيا
        "goal_maps": lambda: (SONYA_A, SONYA_B),
    },
}

ACTIVE_THEME = os.environ.get("LEMBY_THEME", "bali")
THEME = THEMES[ACTIVE_THEME]
PAL.update(THEME["pal"])


def L(grid_rows, width=16):
    return from_map(grid_rows, PAL, width)


# ---------------------------------------------------------------------------
# El-Lemby — 16×24. Composed as shared head + torso variant + leg variant.
# Messy hair and stubble; his outfit colors come from the active theme
# (maroon tracksuit in the harah, prison whites in bali).
# ---------------------------------------------------------------------------

LEMBY_HEAD = [
    "....KKKKKK",
    "..KKHHHHHHKK",
    ".KHHHhHHHHHHK",
    ".KHHHHHHHHHHKK",
    "KHHhHHHHHHhHHK",
    "KHHHHHHHHHHHHK",
    ".KHSSSSSSSSHHK",
    ".KSSSSSSSSSSKK",
    ".KSWKSSSSWKSSK",
    ".KSSSSKSSSSSSK",
    ".KsSSSSSSSSSsK",
    ".KstttKKKtttsK",
    "..KKtttttttKK",
]

LEMBY_HEAD_HURT = [
    "....KKKKKK",
    "..KKHHHHHHKK",
    ".KHHHhHHHHHHK",
    ".KHHHHHHHHHHKK",
    "KHHhHHHHHHhHHK",
    "KHHHHHHHHHHHHK",
    ".KHSSSSSSSSHHK",
    ".KSSSSSSSSSSKK",
    ".KSKSKSSSKSKSK",   # X-ish squeezed eyes
    ".KSSSSKSSSSSSK",
    ".KsSSSSSSSSSsK",
    ".KstttKKtttssK",
    "..KKtttttttKK",
]

LEMBY_TORSO = [                # arms down, white zipper stripe
    "...KKSSSSKK",
    "..KRRRWWRRRK",
    ".KRRRRWWRRRRK",
    ".KRrRRWWRRrRK",
    ".KRrRRWWRRrRK",
    "..KsrrWWrrsK",
]

LEMBY_TORSO_PUMP = [           # one arm raised (jump / celebrate)
    "...KKSSSSKK",
    "..KRRRWWRRRKs",
    ".KRRRRWWRRRKsK",
    ".KRrRRWWRRRKK",
    ".KRrRRWWRRrK",
    "..KsrrWWrrK",
]

LEMBY_LEGS_IDLE = [
    "..KRRRRWWRRRRK",
    "..KRWRK..KRWRK",
    "..KRWRK..KRWRK",
    "..KRWRK..KRWRK",
    ".KkkkkK..KkkkkK",
]

LEMBY_LEGS_RUN_A = [           # stride: legs spread
    "..KRRRRWWRRRRK",
    ".KRWRK....KRWRK",
    ".KRWRK....KRWRK",
    ".KRWRK....KRWRK",
    "KkkkkK....KkkkkK",
]

LEMBY_LEGS_RUN_B = [           # pass pose: legs together, slight lift
    "..KRRRRWWRRRRK",
    "....KRWRRWRK",
    "....KRWRRWRK",
    "....KkkkkkkK",
    "",
]

LEMBY_LEGS_RUN_C = [           # opposite stride: right knee up
    "..KRRRRWWRRRRK",
    "..KRWRK..KRWRK",
    "..KRWRK..KkkkK",
    "..KRWRK",
    ".KkkkkK",
]

LEMBY_LEGS_JUMP = [            # both legs tucked
    "..KRRRRWWRRRRK",
    "..KRWRK..KRWRK",
    ".KkkkkK.KkkkkK",
    "",
    "",
]


def compose(head, torso, legs):
    rows = list(head) + list(torso) + list(legs)
    rows = [r for r in rows]
    while len(rows) < 24:
        rows.append("")
    return L(rows[:24])


# ---------------------------------------------------------------------------
# Thug (البلطجي) — 16×24 walking enemy. Beige cap, unibrow, mustache,
# dark blue galabeya.
# ---------------------------------------------------------------------------

THUG_HEAD = [
    "...KKKKKKKK",
    "..KCCCCCCCCK",
    ".KCCcCCCCCcCK",
    ".KCCCCCCCCCCK",
    ".KSSSSSSSSSSK",
    ".KSKKSSSSKKSK",
    ".KsWKSSSSWKsK",
    ".KSSSSKKSSSSK",
    ".KHHHHHHHHHHK",
    ".KHHHHHHHHHHK",
    "..KssSSSSssK",
]

THUG_BODY_A = [
    "..KKBBBBBBKK",
    ".KBBBBBBBBBBK",
    ".KBbBBBBBBbBK",
    ".KBbBBBBBBbBK",
    ".KBBBBBBBBBBK",
    ".KBbBBBBBBbBK",
    "KBBBBBBBBBBBBK",
    "KBBbBBBBBBbBBK",
    "KBBBBBBBBBBBBK",
    "KBbBBBBBBBBbBK",
    ".KKKKKKKKKKKK",
    "..KssK..KssK",
]

THUG_BODY_B = [
    "..KKBBBBBBKK",
    ".KBBBBBBBBBBK",
    ".KBbBBBBBBbBK",
    ".KBbBBBBBBbBK",
    ".KBBBBBBBBBBK",
    ".KBbBBBBBBbBK",
    "KBBBBBBBBBBBBK",
    "KBBbBBBBBBbBBK",
    "KBBBBBBBBBBBBK",
    "KBbBBBBBBBBbBK",
    ".KKKKKKKKKKKK",
    "....KssKKssK",
]

THUG_SQUASHED = [
    "",
    "",
    "...KKKKKKKK",
    "..KCCCCCCCCK",
    ".KCCcCCCCCcCK",
    ".KSKKSSSSKKSK",
    ".KHHHHHHHHHHK",
    "KBBBBBBBBBBBBK",
    "KBBbBBBBBBbBBK",
    ".KKKKKKKKKKKK",
]

# ---------------------------------------------------------------------------
# Nousa (نوسة) — 16×24 goal NPC. Long dark hair, pink dress.
# ---------------------------------------------------------------------------

NOUSA_A = [
    "...KKKKKKK",
    "..KHHHHHHHK",
    ".KHHHHHHHHHK",
    ".KHHSSSSSHHK",
    ".KHSSSSSSSHK",
    ".KHSWKSWKSHK",
    ".KHSSSSSSSHK",
    ".KHSSKMMSSHK",
    ".KHHSSSSSHHK",
    ".KHHHHHHHHHK",
    ".KHHKKKKKHHK",
    "..KKKSSSKK",
    "...KPPPPPK",
    "..KPPPPPPPK",
    "..KPpPPPPpK",
    ".KsKPPPPPKsK",
    ".KsKPpPPpKsK",
    "..KPPPPPPPK",
    ".KPPpPPPPpPK",
    ".KPPPPPPPPPK",
    "KPPpPPPPPPpPK",
    "KPPPPPPPPPPPK",
    ".KKKKKKKKKKK",
    "..KssK..KssK",
]

NOUSA_B = [                    # waving
    "...KKKKKKK",
    "..KHHHHHHHK",
    ".KHHHHHHHHHK",
    ".KHHSSSSSHHK",
    ".KHSSSSSSSHK",
    ".KHSWKSWKSHK.Ks",
    ".KHSSSSSSSHK.sK",
    ".KHSSKMMSSHKsK",
    ".KHHSSSSSHHKK",
    ".KHHHHHHHHHK",
    ".KHHKKKKKHHK",
    "..KKKSSSKKK",
    "...KPPPPPKK",
    "..KPPPPPPPK",
    "..KPpPPPPpK",
    ".KsKPPPPPK",
    ".KsKPpPPpK",
    "..KPPPPPPPK",
    ".KPPpPPPPpPK",
    ".KPPPPPPPPPK",
    "KPPpPPPPPPpPK",
    "KPPPPPPPPPPPK",
    ".KKKKKKKKKKK",
    "..KssK..KssK",
]

# ---------------------------------------------------------------------------
# سونيا (Sonya) — the sequel's glamorous sweetheart, 16×24, waiting at
# الزيارة. Blonde waves, red dress, a dramatic hourglass figure drawn in the
# Egyptian-comedy فتاة الأحلام register — stylized, clothed, and cartoonish.
# El-Lemby is completely smitten.
# ---------------------------------------------------------------------------

SONYA_A = [
    "....KKKKKKK",
    "..KKDDDDDDDKK",
    ".KDDdDDDDDDDK",
    ".KDDSSSSSDDDK",
    ".KDdSSSSSSDDK",
    ".KDSWKSWKSDDK",
    ".KDSSSSSSKDDK",
    ".KDSSKMMSSDDK",
    ".KDDSSSSSDDDK",
    ".KDDDDDDDDDDK",
    ".KDDKKSSKKDDK",
    "..KKVVVVVVKK",
    ".KVVVVVVVVVVK",
    "KVVvVVVVVVvVVK",
    "KVvVVVVVVVVvVK",
    ".KKvVVVVVVvKK",
    "...KvVVVVvK",
    "...KVVVVVVK",
    "..KVVVVVVVVK",
    ".KVVVVVVVVVVK",
    "KVVvVVVVVVvVVK",
    ".KKKKKKKKKKKK",
    "...KMK..KMK",
    "",
]

SONYA_B = [
    "....KKKKKKK",
    "..KKDDDDDDDKK",
    ".KDDdDDDDDDDK.s",
    ".KDDSSSSSDDDKsK",
    ".KDdSSSSSSDDKK",
    ".KDSWKSWKSDDK",
    ".KDSSSSSSKDDK",
    ".KDSSKMMSSDDK",
    ".KDDSSSSSDDDK",
    ".KDDDDDDDDDDK",
    ".KDDKKSSKKDDK",
    "..KKVVVVVVKK",
    ".KVVVVVVVVVVK",
    "KVVvVVVVVVvVVK",
    "KVvVVVVVVVVvVK",
    ".KKvVVVVVVvKK",
    "...KvVVVVvK",
    "...KVVVVVVK",
    "..KVVVVVVVVK",
    ".KVVVVVVVVVVK",
    "KVVvVVVVVVvVVK",
    ".KKKKKKKKKKKK",
    "...KMK..KMK",
    "",
]

# ---------------------------------------------------------------------------
# عربية الفول — the foul-cart checkpoint, 16×24 (idle / activated)
# A brass idra pot steaming on a wooden hand cart.
# ---------------------------------------------------------------------------

CART_IDLE = [
    "......w",
    "....w",
    ".....w..w",
    "....KKKKK",
    "...KgGGGgK",
    "..KgGGGGGgK",
    "..KgGGGGGgK",
    "..KgGGGGGgK",
    "...KgGGGgK",
    "....KgGgK",
    "..KKKKKKKKK",
    ".KUUUUUUUUUK",
    ".KUuUUUUUuUK",
    ".KUUUUUUUUUK",
    ".KuuuuuuuuuK",
    "..KKKKKKKKK",
    "...K.....K",
    "..KkK...KkK",
    ".KkkkK.KkkkK",
    ".KkKkK.KkKkK",
    ".KkkkK.KkkkK",
    "..KkK...KkK",
    "...K.....K",
    "",
]

CART_ACTIVE = [
    "..W...w...W",
    "....W...w",
    ".W...w....W",
    "....KKKKK...KE",
    "...KYGGGYK..KEE",
    "..KYGYYYGYK.KE",
    "..KYGYYYGYK.K",
    "..KYGYYYGYK.K",
    "...KYGGGYK..K",
    "....KYGYK...K",
    "..KKKKKKKKK.K",
    ".KUUUUUUUUUKK",
    ".KUuUUUUUuUK",
    ".KUUUUUUUUUK",
    ".KuuuuuuuuuK",
    "..KKKKKKKKK",
    "...K.....K",
    "..KkK...KkK",
    ".KkkkK.KkkkK",
    ".KkKkK.KkKkK",
    ".KkkkK.KkkkK",
    "..KkK...KkK",
    "...K.....K",
    "",
]

# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

COIN_FRAMES = [
    [   # full face — an Egyptian pound-ish coin, 12×12
        "...KKKKK",
        "..KGGGGGK",
        ".KGGggggGK",
        "KGGgGGGGgGK",
        "KGgGGGGGgGK",
        "KGgGGKKGgGK",
        "KGgGGKKGgGK",
        "KGgGGGGGgGK",
        "KGGgGGGGgGK",
        ".KGGggggGK",
        "..KGGGGGK",
        "...KKKKK",
    ],
    [   # 3/4 turn
        "....KKKK",
        "...KGGGK",
        "..KGggGK",
        "..KGgGGK",
        "..KGgGGK",
        "..KGgKGK",
        "..KGgKGK",
        "..KGgGGK",
        "..KGgGGK",
        "..KGggGK",
        "...KGGGK",
        "....KKKK",
    ],
    [   # edge-on
        ".....KK",
        ".....KGK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KgK",
        ".....KGK",
        ".....KK",
    ],
    [   # 3/4 turn (other side)
        "....KKKK",
        "...KGGGK",
        "..KGggGK",
        "..KGGgGK",
        "..KGGgGK",
        "..KGKgGK",
        "..KGKgGK",
        "..KGGgGK",
        "..KGGgGK",
        "..KGggGK",
        "...KGGGK",
        "....KKKK",
    ],
]

SANDWICH = [                   # ساندوتش فول — 14×11
    "....KKKKKK",
    "..KKDDDDDDKK",
    ".KDDDDDDDDDDK",
    "KDDDDDDDDDDDdK",
    "KDdFFFFFFFFddK",
    "KFFEFFFFEFFFdK",
    ".KFFFFFFFFFdK",
    "..KddddddddK",
    "...KKKKKKKK",
    "",
    "",
]

HEART = [                      # 8×8
    ".KK.KK",
    "KNNKNNK",
    "KNNNNnK",
    "KNNNNnK",
    ".KNNnK",
    "..KnK",
    "...K",
    "",
]

# ---------------------------------------------------------------------------
# Tiles — 16×16, drawn procedurally for regularity
# ---------------------------------------------------------------------------

T = 16

TILE_COLORS = {
    "dust_light": C(212, 170, 112),
    "dust_rim": C(126, 90, 55),
    "cobble_base": C(112, 80, 48),
    "stone_light": C(190, 148, 96),
    "stone_border": C(140, 102, 61),
    "dirt_base": C(124, 90, 54),
    "dirt_fleck_l": C(147, 109, 66),
    "dirt_fleck_d": C(100, 70, 42),
    "brick": C(177, 89, 58),
    "brick_hi": C(201, 111, 73),
    "brick_sh": C(141, 66, 45),
    "mortar": C(95, 49, 37),
    "wood": C(170, 125, 80),
    "wood_dark": C(129, 91, 56),
    "wood_frame": C(99, 68, 42),
    "wood_hi": C(196, 152, 103),
    "wood_used": C(134, 96, 60),
    "wood_used_dark": C(104, 72, 44),
    "sand_block": C(210, 192, 150),
    "sand_border": C(154, 136, 100),
    "sand_hi": C(233, 219, 180),
}

TILE_COLORS.update(THEME["tiles"])


def bevel(g):
    """2.5D depth pass for solid tiles: a light-catching top face and
    shadowed right/bottom edges, so runs of blocks read as extruded slabs."""
    h, w = len(g), len(g[0])

    def mix(px, f):
        r, gg, b, a = px
        return (min(255, round(r * f)), min(255, round(gg * f)),
                min(255, round(b * f)), a)

    out = [row[:] for row in g]
    for x in range(w):
        out[0][x] = mix(out[0][x], 1.25)
        out[1][x] = mix(out[1][x], 1.1)
        out[h - 1][x] = mix(out[h - 1][x], 0.82)
    for y in range(h):
        out[y][w - 1] = mix(out[y][w - 1], 0.8)
        out[y][w - 2] = mix(out[y][w - 2], 0.9)
    return out


def tile_ground(rng):
    g = blank(T, T, TILE_COLORS["cobble_base"])
    # packed dusty surface
    rect(g, 0, 0, T, 2, TILE_COLORS["dust_light"])
    rect(g, 0, 2, T, 1, TILE_COLORS["dust_rim"])
    # two courses of cobblestones
    for (sx, sy, sw, sh) in [(1, 4, 6, 5), (9, 4, 6, 5), (0, 10, 4, 5), (5, 10, 6, 5), (13, 10, 3, 5)]:
        rect(g, sx, sy, sw, sh, TILE_COLORS["stone_border"])
        rect(g, sx + 1, sy + 1, sw - 2, sh - 2, TILE_COLORS["stone_light"])
    for _ in range(6):
        put(g, rng.randrange(T), rng.randrange(3, T), TILE_COLORS["dust_rim"])
    return g


def tile_dirt(rng):
    g = blank(T, T, TILE_COLORS["dirt_base"])
    for _ in range(14):
        put(g, rng.randrange(T), rng.randrange(T), TILE_COLORS["dirt_fleck_l"])
    for _ in range(10):
        put(g, rng.randrange(T), rng.randrange(T), TILE_COLORS["dirt_fleck_d"])
    return g


def tile_brick(_rng):
    g = blank(T, T, TILE_COLORS["brick"])
    for course in range(4):
        y = course * 4
        rect(g, 0, y, T, 1, TILE_COLORS["brick_hi"])       # top of each brick course
        rect(g, 0, y + 3, T, 1, TILE_COLORS["mortar"])     # horizontal mortar
        joints = (7,) if course % 2 == 0 else (3, 11)      # running bond
        for x in joints:
            rect(g, x, y, 1, 3, TILE_COLORS["mortar"])
            rect(g, x + 1, y + 1, 1, 1, TILE_COLORS["brick_sh"])
    return g


def _crate_base(fill, dark, frame, hi):
    g = blank(T, T, fill)
    rect(g, 0, 0, T, T, fill)
    # plank seams
    rect(g, 0, 5, T, 1, dark)
    rect(g, 0, 10, T, 1, dark)
    # frame
    rect(g, 0, 0, T, 1, frame)
    rect(g, 0, T - 1, T, 1, frame)
    rect(g, 0, 0, 1, T, frame)
    rect(g, T - 1, 0, 1, T, frame)
    rect(g, 1, 1, T - 2, 1, hi)
    rect(g, 1, 1, 1, T - 2, hi)
    return g


def tile_crate(_rng):
    g = _crate_base(TILE_COLORS["wood"], TILE_COLORS["wood_dark"],
                    TILE_COLORS["wood_frame"], TILE_COLORS["wood_hi"])
    for (x, y) in [(2, 2), (13, 2), (2, 13), (13, 13)]:
        put(g, x, y, TILE_COLORS["wood_frame"])
    return g


QMARK = [   # Arabic question mark ؟ (mirrored), 5×9
    ".GGG",
    "G...G",
    "G",
    ".G",
    "..G",
    "..G",
    "",
    "..G",
    "",
]


def tile_mystery(_rng):
    g = tile_crate(_rng)
    mark = from_map(QMARK, {".": None, "G": PAL["G"]}, 5)
    shadow = from_map(QMARK, {".": None, "G": PAL["K"]}, 5)
    blit(g, shadow, 7, 4)
    blit(g, mark, 6, 3)
    return g


def tile_crate_used(_rng):
    g = _crate_base(TILE_COLORS["wood_used"], TILE_COLORS["wood_used_dark"],
                    TILE_COLORS["wood_frame"], TILE_COLORS["wood_used_dark"])
    for (x, y) in [(4, 4), (11, 7), (6, 12)]:
        put(g, x, y, TILE_COLORS["wood_frame"])
    return g


def tile_stone(_rng):
    g = blank(T, T, TILE_COLORS["sand_block"])
    rect(g, 0, 0, T, 1, TILE_COLORS["sand_hi"])
    rect(g, 0, 0, 1, T, TILE_COLORS["sand_hi"])
    rect(g, 0, T - 1, T, 1, TILE_COLORS["sand_border"])
    rect(g, T - 1, 0, 1, T, TILE_COLORS["sand_border"])
    for (x, y) in [(4, 6), (5, 6), (10, 11), (12, 4)]:
        put(g, x, y, TILE_COLORS["sand_border"])
    return g


# ---------------------------------------------------------------------------
# Background strips (parallax layers)
# ---------------------------------------------------------------------------

BG_W = 480
SKY = C(166, 204, 216)


def hazed(color, amount):
    """Mix a color toward the sky for atmospheric depth, keeping gameplay
    elements visually dominant over the backdrop."""
    r, g, b, a = color
    return (round(r + (SKY[0] - r) * amount),
            round(g + (SKY[1] - g) * amount),
            round(b + (SKY[2] - b) * amount),
            a)


def haze_grid(grid, amount):
    return [[hazed(px, amount) if px[3] != 0 else px for px in row] for row in grid]

BUILDING_COLORS = [
    (C(216, 189, 147), C(188, 160, 118)),
    (C(199, 162, 115), C(172, 136, 92)),
    (C(199, 143, 110), C(170, 116, 86)),
    (C(226, 211, 175), C(196, 180, 143)),
]
WINDOW_DARK = C(91, 74, 58)
WINDOW_LIT = C(232, 196, 106)
WINDOW_FRAME = C(64, 51, 41)
SHUTTER = C(79, 125, 116)
DISH = C(198, 198, 192)
TANK = C(168, 158, 146)
LINE = C(70, 60, 52)
CLOTH_COLORS = [C(214, 84, 84), C(240, 234, 220), C(94, 130, 178), C(228, 186, 96)]
FAR_TONE = C(172, 150, 124)
FAR_DETAIL = C(154, 133, 108)


def bg_far_harah(rng):
    """Distant skyline silhouette with a minaret and dome — 480×88, tiles horizontally."""
    H = 88
    g = blank(BG_W, H)
    x = 0
    heights = []
    while x < BG_W:
        w = rng.choice([36, 44, 52, 60, 68])
        w = min(w, BG_W - x)
        h = rng.randrange(28, 62)
        heights.append((x, w, h))
        rect(g, x, H - h, w, h, FAR_TONE)
        for wy in range(H - h + 4, H - 4, 8):
            for wx in range(x + 4, x + w - 3, 9):
                put(g, wx, wy, FAR_DETAIL)
                put(g, wx + 1, wy, FAR_DETAIL)
        x += w
    # minaret near 1/3 across
    mx = BG_W // 3
    rect(g, mx, H - 78, 6, 78, FAR_TONE)
    rect(g, mx - 2, H - 58, 10, 4, FAR_TONE)          # balcony ring
    rect(g, mx + 1, H - 84, 4, 6, FAR_TONE)           # top cone
    put(g, mx + 2, H - 86, FAR_TONE)                  # finial
    put(g, mx + 3, H - 86, FAR_TONE)
    # dome near 3/4 across
    dx = 3 * BG_W // 4
    for i, span in enumerate([6, 10, 14, 16, 18, 18]):
        rect(g, dx + (18 - span) // 2, H - 36 + i, span, 1, FAR_TONE)
    rect(g, dx, H - 30, 18, 30, FAR_TONE)
    rect(g, dx + 8, H - 40, 2, 4, FAR_DETAIL)
    return g


def bg_near_harah(rng):
    """Alley buildings with windows, dishes, tanks and laundry — 480×120, tiles horizontally."""
    H = 120
    g = blank(BG_W, H)
    x = 0
    tops = []  # (x, w, roof_y) for roof props / laundry
    while x < BG_W:
        w = rng.choice([48, 56, 64, 72])
        w = min(w, BG_W - x)
        if BG_W - (x + w) < 40:
            w = BG_W - x
        h = rng.randrange(70, 112)
        fill, shade = BUILDING_COLORS[rng.randrange(len(BUILDING_COLORS))]
        roof_y = H - h
        rect(g, x, roof_y, w, h, fill)
        rect(g, x + w - 3, roof_y, 3, h, shade)               # side shading
        rect(g, x, roof_y, w, 2, shade)                       # parapet
        # windows
        for wy in range(roof_y + 8, H - 12, 16):
            for wx in range(x + 5, x + w - 8, 13):
                lit = rng.random() < 0.18
                rect(g, wx, wy, 6, 9, WINDOW_FRAME)
                rect(g, wx + 1, wy + 1, 4, 7, WINDOW_LIT if lit else WINDOW_DARK)
                if rng.random() < 0.3:                        # shutters
                    rect(g, wx - 1, wy + 1, 1, 7, SHUTTER)
                    rect(g, wx + 6, wy + 1, 1, 7, SHUTTER)
                if rng.random() < 0.35:                       # balcony ledge
                    rect(g, wx - 1, wy + 9, 8, 1, shade)
        tops.append((x, w, roof_y))
        x += w
    # roof props
    for (bx, bw, ry) in tops:
        if rng.random() < 0.7:  # satellite dish
            dx = bx + rng.randrange(4, max(5, bw - 10))
            rect(g, dx + 1, ry - 5, 4, 4, DISH)
            put(g, dx, ry - 4, DISH)
            put(g, dx + 2, ry - 1, WINDOW_FRAME)
            rect(g, dx + 2, ry - 1, 1, 1, WINDOW_FRAME)
        if rng.random() < 0.4:  # water tank
            tx = bx + rng.randrange(2, max(3, bw - 12))
            rect(g, tx, ry - 8, 8, 8, TANK)
            rect(g, tx, ry - 8, 8, 1, DISH)
    # laundry lines between building seams
    for i in range(len(tops) - 1):
        if rng.random() < 0.55:
            (bx, bw, _) = tops[i]
            seam = bx + bw
            y = rng.randrange(46, 78)
            span = 34
            for lx in range(seam - span // 2, seam + span // 2):
                sag = 1 if abs(lx - seam) < span // 4 else 0
                put(g, lx, y + sag, LINE)
            for j, cx in enumerate(range(seam - span // 2 + 4, seam + span // 2 - 4, 8)):
                cloth = CLOTH_COLORS[(i + j) % len(CLOTH_COLORS)]
                sag = 1 if abs(cx - seam) < span // 4 else 0
                rect(g, cx, y + sag + 1, 5, 6, cloth)
    return g


PRISON_WALL_FAR = C(152, 150, 144)
PRISON_WALL_FAR_D = C(132, 130, 124)
PRISON_WALL = C(170, 168, 160)
PRISON_WALL_D = C(146, 144, 136)
PRISON_WINDOW = C(70, 68, 64)
PRISON_BAR = C(202, 200, 190)
PRISON_WIRE = C(64, 62, 58)
PRISON_LAMP = C(232, 196, 106)


def bg_far_bali(rng):
    """The outer prison wall with watchtowers — 480×88, tiles horizontally."""
    H = 88
    g = blank(BG_W, H)
    wall_h = 34
    rect(g, 0, H - wall_h, BG_W, wall_h, PRISON_WALL_FAR)
    rect(g, 0, H - wall_h, BG_W, 2, PRISON_WALL_FAR_D)          # coping
    for x in range(0, BG_W, 16):                                 # crenel hints
        rect(g, x, H - wall_h + 4, 8, 1, PRISON_WALL_FAR_D)
    for tx in (70, 250, 400):
        tx += rng.randrange(-12, 12)
        rect(g, tx + 3, H - 66, 8, 34, PRISON_WALL_FAR)          # shaft
        rect(g, tx, H - 78, 14, 13, PRISON_WALL_FAR)             # cabin
        rect(g, tx, H - 78, 14, 2, PRISON_WALL_FAR_D)            # roof
        rect(g, tx + 2, H - 74, 3, 5, PRISON_WINDOW)             # cabin glass
        rect(g, tx + 8, H - 74, 3, 5, PRISON_WINDOW)
    return g


def bg_near_bali(rng):
    """The cell-block façade: barred windows, barbed wire, a searchlight and
    the prison laundry line — 480×120, tiles horizontally."""
    H = 120
    g = blank(BG_W, H)

    # cell-block segments with yard gaps between them, so the far wall and
    # watchtowers stay visible and the parallax keeps its depth
    segments = []
    x = 0
    while x < BG_W:
        w = rng.choice([150, 170, 190])
        if BG_W - x < 230:
            w = BG_W - x          # last segment ends flush for clean tiling
        w = min(w, BG_W - x)
        h = rng.choice([68, 76, 84])
        segments.append((x, w, h))
        rect(g, x, H - h, w, h, PRISON_WALL)
        rect(g, x, H - h, w, 2, PRISON_WALL_D)                   # parapet
        for y in range(H - h + 14, H, 22):                       # course seams
            rect(g, x, y, w, 1, PRISON_WALL_D)
        rect(g, x + w - 3, H - h, 3, h, PRISON_WALL_D)           # side shading
        # barred windows
        rows = (H - h + 8,) if h < 76 else (H - h + 8, H - h + 44)
        for wy in rows:
            for wx in range(x + 8, x + w - 14, 24):
                rect(g, wx, wy, 12, 16, PRISON_WINDOW)
                rect(g, wx - 1, wy - 1, 14, 1, PRISON_WALL_D)    # lintel
                for bx in (wx + 2, wx + 5, wx + 8):
                    rect(g, bx, wy, 1, 16, PRISON_BAR)
                rect(g, wx, wy + 7, 12, 1, PRISON_BAR)           # cross bar
        x += w + rng.choice([36, 48])

    # lower front wall with barbed wire, running the whole yard
    front_h = 24
    rect(g, 0, H - front_h, BG_W, front_h, PRISON_WALL_D)
    rect(g, 0, H - front_h, BG_W, 1, PRISON_WALL)
    wy = H - front_h - 4
    for zx in range(0, BG_W, 8):                                 # wire zigzag
        put(g, zx, wy + 3, PRISON_WIRE)
        put(g, zx + 1, wy + 2, PRISON_WIRE)
        put(g, zx + 2, wy + 1, PRISON_WIRE)
        put(g, zx + 3, wy, PRISON_WIRE)
        put(g, zx + 4, wy + 1, PRISON_WIRE)
        put(g, zx + 5, wy + 2, PRISON_WIRE)
        put(g, zx + 6, wy + 3, PRISON_WIRE)
        put(g, zx + 3, wy - 1, PRISON_WIRE)                      # barb
    for zx in range(0, BG_W, 4):
        put(g, zx, wy + 4, PRISON_WIRE)                          # bottom strand

    # searchlight pole and prison laundry in the gaps between blocks
    for i in range(len(segments) - 1):
        (bx, bw, bh) = segments[i]
        seam = bx + bw
        gap = segments[i + 1][0] - seam if i + 1 < len(segments) else 0
        if gap < 24:
            continue
        if i % 2 == 0:
            px = seam + gap // 2
            rect(g, px, H - front_h - 30, 2, 30, PRISON_WIRE)
            rect(g, px - 3, H - front_h - 35, 8, 5, PRISON_WIRE)
            rect(g, px - 2, H - front_h - 34, 6, 3, PRISON_LAMP)
        else:
            ly = H - 64
            for lx in range(seam - 14, seam + gap + 14):
                sag = 1 if abs(lx - (seam + gap // 2)) < gap // 3 else 0
                put(g, lx, ly + sag, PRISON_WIRE)
            for j, cx in enumerate(range(seam - 8, seam + gap + 2, 9)):
                cloth = C(238, 236, 228) if j % 2 == 0 else C(120, 138, 168)
                rect(g, cx, ly + 2, 5, 6, cloth)
    return g


FORE_DARK = C(35, 32, 38, 235)
FORE_MID = C(52, 48, 56, 235)


def bg_fore_harah(rng):
    """Foreground silhouettes for the alley — crates, pots and awning poles
    sliding in front of the action. 480×22, tiles horizontally."""
    H = 22
    g = blank(BG_W, H)
    rect(g, 0, H - 7, BG_W, 7, FORE_DARK)                        # curb band
    for x in range(0, BG_W, 60):
        kind = rng.randrange(3)
        px = x + rng.randrange(0, 24)
        if kind == 0:                                            # crate stack
            rect(g, px, H - 16, 12, 9, FORE_DARK)
            rect(g, px + 1, H - 16, 10, 1, FORE_MID)
        elif kind == 1:                                          # clay pot
            rect(g, px + 2, H - 13, 8, 6, FORE_DARK)
            rect(g, px + 1, H - 14, 10, 2, FORE_DARK)
            rect(g, px + 3, H - 15, 6, 1, FORE_MID)
        else:                                                    # awning pole
            rect(g, px + 4, H - 20, 2, 13, FORE_DARK)
            rect(g, px, H - 21, 10, 2, FORE_DARK)
    return g


def bg_fore_bali(rng):
    """Foreground silhouettes for the yard — railing posts with a sagging
    chain and the odd bucket. 480×22, tiles horizontally."""
    H = 22
    g = blank(BG_W, H)
    rect(g, 0, H - 6, BG_W, 6, FORE_DARK)                        # curb band
    posts = list(range(6, BG_W, 48))
    for px in posts:
        rect(g, px, H - 18, 3, 12, FORE_DARK)
        rect(g, px, H - 18, 3, 1, FORE_MID)
    for i in range(len(posts) - 1):                              # chain sag
        x0, x1 = posts[i] + 3, posts[i + 1]
        for lx in range(x0, x1):
            t = (lx - x0) / max(1, x1 - x0)
            sag = round(3.5 * (1 - (2 * t - 1) ** 2))
            put(g, lx, H - 16 + sag, FORE_DARK)
            put(g, lx, H - 15 + sag, FORE_DARK)
    # last span ends at BG_W; close the loop for clean tiling
    x0 = posts[-1] + 3
    for lx in range(x0, BG_W + 6):
        t = (lx - x0) / max(1, (posts[0] + BG_W) - x0)
        sag = round(3.5 * (1 - (2 * t - 1) ** 2))
        put(g, lx % BG_W, H - 16 + sag, FORE_DARK)
        put(g, lx % BG_W, H - 15 + sag, FORE_DARK)
    if rng.random() < 0.9:                                       # a bucket
        bx = rng.choice(posts) + 18
        rect(g, bx, H - 12, 7, 6, FORE_DARK)
        rect(g, bx + 1, H - 13, 5, 1, FORE_MID)
    return g


# ---------------------------------------------------------------------------
# App icon — 32×32 Lemby face, exported at 256×256
# ---------------------------------------------------------------------------

ICON = [
    "......KKKKKKKKKKKKKK",
    "....KKHHHHHHHHHHHHHHKK",
    "...KHHHHhHHHHHHHhHHHHHK",
    "..KHHHhHHHHHHHHHHHHhHHHK",
    ".KHHHHHHHHHHHHHHHHHHHHHHK",
    ".KHHHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHHHHHHHHHHHHHHHHHHHHHK",
    "KHHHSSSSSSSSSSSSSSSSSSHHHK",
    "KHHSSSSSSSSSSSSSSSSSSSSHHK",
    "KHHSSSSSSSSSSSSSSSSSSSSHHK",
    ".KSSWWKKSSSSSSSSSWWKKSSSK",
    ".KSSWWKKSSSSSSSSSWWKKSSSK",
    ".KSSSSSSSSSKKSSSSSSSSSSK",
    ".KSSSSSSSSSKKSSSSSSSSSSK",
    ".KsSSSSSSSSSSSSSSSSSSssK",
    ".KsSSSSSSSSSSSSSSSSSSssK",
    ".KstSSSSKKKKKKKKKSSSStsK",
    "..KsttttKWWWWWWWKttttsK",
    "..KsttttKKKKKKKKKttttsK",
    "...KstttttttttttttttsK",
    "....KKttttttttttttKK",
    "......KKKKKKKKKKKK",
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_all():
    rng = random.Random(1602)  # seeded: El-Lemby premiered in 2002; 16px tiles
    coin_legend = {".": None, "K": PAL["K"],
                   "G": THEME["coin_light"], "g": THEME["coin_dark"]}

    sprites = {
        # player
        "lemby_idle_0": compose(LEMBY_HEAD, LEMBY_TORSO, LEMBY_LEGS_IDLE),
        "lemby_idle_1": compose([""] + LEMBY_HEAD[:-1], LEMBY_TORSO, LEMBY_LEGS_IDLE),
        "lemby_run_0": compose(LEMBY_HEAD, LEMBY_TORSO, LEMBY_LEGS_RUN_A),
        "lemby_run_1": compose(LEMBY_HEAD, LEMBY_TORSO, LEMBY_LEGS_RUN_B),
        "lemby_run_2": compose(LEMBY_HEAD, LEMBY_TORSO, LEMBY_LEGS_RUN_C),
        "lemby_jump_0": compose(LEMBY_HEAD, LEMBY_TORSO_PUMP, LEMBY_LEGS_JUMP),
        "lemby_hurt_0": compose(LEMBY_HEAD_HURT, LEMBY_TORSO, LEMBY_LEGS_RUN_A),
        # enemies
        "thug_walk_0": L(THUG_HEAD + THUG_BODY_A + [""] * (24 - len(THUG_HEAD) - len(THUG_BODY_A))),
        "thug_walk_1": L(THUG_HEAD + THUG_BODY_B + [""] * (24 - len(THUG_HEAD) - len(THUG_BODY_B))),
        "thug_squashed": L(THUG_SQUASHED[:10]),
        # NPC — the goal/love-interest role, chosen by the theme
        # (نوسة in the الحارة theme, سونيا in اللي بالي بالك)
        "nousa_0": L(THEME["goal_maps"]()[0]),
        "nousa_1": L(THEME["goal_maps"]()[1]),
        # checkpoint cart
        "checkpoint_idle": L(CART_IDLE),
        "checkpoint_active": L(CART_ACTIVE),
        # items — the coin's colors come from the theme (gold in the harah,
        # رغيف عيش bread in the prison yard)
        "coin_0": from_map(COIN_FRAMES[0], coin_legend, 12),
        "coin_1": from_map(COIN_FRAMES[1], coin_legend, 12),
        "coin_2": from_map(COIN_FRAMES[2], coin_legend, 12),
        "coin_3": from_map(COIN_FRAMES[3], coin_legend, 12),
        "sandwich": from_map(SANDWICH, PAL, 14),
        "heart": from_map(HEART, PAL, 8),
        # tiles — beveled for the 2.5D extruded-slab look
        "tile_ground": bevel(tile_ground(rng)),
        "tile_dirt": bevel(tile_dirt(rng)),
        "tile_brick": bevel(tile_brick(rng)),
        "tile_crate": bevel(tile_crate(rng)),
        "tile_mystery": bevel(tile_mystery(rng)),
        "tile_crate_used": bevel(tile_crate_used(rng)),
        "tile_stone": bevel(tile_stone(rng)),
        # backgrounds (theme-built, hazed toward the sky for readability)
        # plus the un-hazed foreground plane that slides in front of play
        "bg_far": haze_grid(THEME["bg_far"](rng), 0.52),
        "bg_near": haze_grid(THEME["bg_near"](rng), 0.30),
        "bg_fore": THEME["bg_fore"](rng),
        # icon source
        "icon_32": from_map(ICON, PAL, 32),
    }
    return sprites


def main():
    os.makedirs(SPRITES_DIR, exist_ok=True)
    os.makedirs(DOCS_DIR, exist_ok=True)
    sprites = build_all()

    for name, grid in sprites.items():
        write_png(os.path.join(SPRITES_DIR, f"{name}.png"), grid)

    # App icons: pad the face onto a square canvas, then export the macOS
    # PNG (icns source) and the Windows .ico.
    icon_sq = blank(32, 32)
    blit(icon_sq, sprites["icon_32"], 0, 4)
    write_png(os.path.join(SPRITES_DIR, "icon_256.png"), scale(icon_sq, 8))
    ico_dir = os.path.join(ROOT, "windows", "ElLemby.App")
    if os.path.isdir(ico_dir):
        write_ico(os.path.join(ico_dir, "AppIcon.ico"), [icon_sq, scale(icon_sq, 8)])

    # contact sheet for docs / review: characters+items 6×, tiles 6×, bgs 1×
    sheet_scale = 6
    names = ["lemby_idle_0", "lemby_idle_1", "lemby_run_0", "lemby_run_1",
             "lemby_run_2", "lemby_jump_0", "lemby_hurt_0",
             "thug_walk_0", "thug_walk_1", "thug_squashed", "nousa_0", "nousa_1",
             "checkpoint_idle", "checkpoint_active",
             "coin_0", "coin_1", "coin_2", "coin_3", "sandwich", "heart",
             "tile_ground", "tile_dirt", "tile_brick", "tile_crate",
             "tile_mystery", "tile_crate_used", "tile_stone", "icon_32"]
    cell = 34 * sheet_scale
    cols = 7
    rows = (len(names) + cols - 1) // cols
    sheet_h = rows * cell + 130 * 2 + 30
    sheet = blank(cols * cell + 20, sheet_h, C(56, 58, 66))
    for i, name in enumerate(names):
        gx = 10 + (i % cols) * cell
        gy = 10 + (i // cols) * cell
        g = scale(sprites[name], sheet_scale)
        blit(sheet, g, gx, gy)
    blit(sheet, sprites["bg_far"], 10, rows * cell + 20)
    blit(sheet, sprites["bg_near"], 10, rows * cell + 20 + 92)
    write_png(os.path.join(DOCS_DIR, "sprites.png"), sheet)

    print(f"wrote {len(sprites) + 1} sprites to {SPRITES_DIR}")
    print(f"wrote contact sheet to {os.path.join(DOCS_DIR, 'sprites.png')}")


if __name__ == "__main__":
    sys.exit(main())
