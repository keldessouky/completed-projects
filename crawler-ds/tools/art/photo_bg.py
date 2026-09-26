"""The backgrounds: real photographs, framed and graded for the DS.

Every scene the game sets behind its sprites -- the street in chapter one,
the dungeon it fights in, the safe room -- is a view cut out of a
photographed 360-degree panorama. Poly Haven's are high dynamic range and
released CC0; Emil Persson's (Humus) cube maps are free to redistribute with
his readme. Where each one came from, and its terms, is in
assets/CREDITS.txt.

A panorama is a whole sphere of light, so a background is a camera placed
in it: which way it looks (`yaw`, `pitch`), how wide (`fov`), then an
exposure and a grade -- darker and cooler where the sprites have to stand
out, warmer where the scene is lit. The result is written as a 256x192 PNG
in assets/bg, which is what the build reads; the panoramas themselves are
not in the repository, only where to fetch them.

    python3 tools/art/photo_bg.py            # fetch what is missing, render all
    python3 tools/art/photo_bg.py street     # just the one

Needs network access to fetch the sources, and Pillow for the cube maps. The
build needs neither.
"""

import math
import os
import struct
import sys
import urllib.request
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'bg')
CACHE = os.environ.get('PHOTO_CACHE', os.path.join(ROOT, 'build', 'photo_cache'))

FILAMENT = 'https://raw.githubusercontent.com/google/filament/main/third_party/environments/'
THREE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/'

#  Where each panorama comes from. Poly Haven's originals, mirrored in the
#  sample folders of two open-source renderers.
SOURCES = {
    'parking_garage':      FILAMENT + 'parking_garage_2k.hdr',
    'graffiti_shelter':    FILAMENT + 'graffiti_shelter_2k.hdr',
    'pillars':             FILAMENT + 'pillars_2k.hdr',
    'the_sky_is_on_fire':  FILAMENT + 'the_sky_is_on_fire_2k.hdr',
    'venetian_crossroads': FILAMENT + 'venetian_crossroads_2k.hdr',
    'quarry_01':           THREE + 'equirectangular/quarry_01_1k.hdr',
    'venice_sunset':       THREE + 'equirectangular/venice_sunset_1k.hdr',
}
CUBES = {
    'castle': THREE + 'cube/SwedishRoyalCastle/',
}

W, H = 256, 192


def fetch(url, path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print('fetching', url)
        urllib.request.urlretrieve(url, path)
    return path


# ------------------------------------------------------------ radiance hdr --

def load_hdr(path, step=1):
    """A Radiance .hdr as (w, h, rows of floats), every `step`th pixel."""
    data = open(path, 'rb').read()
    pos = data.index(b'\n\n') + 2
    end = data.index(b'\n', pos)
    dims = data[pos:end].split()
    h, w = int(dims[1]), int(dims[3])
    pos = end + 1
    rows = []
    for y in range(h):
        #  New-style run-length scanlines: 2 2 hi lo, then four channels.
        if data[pos] == 2 and data[pos + 1] == 2:
            pos += 4
            chans = []
            for c in range(4):
                ch = bytearray()
                while len(ch) < w:
                    n = data[pos]
                    pos += 1
                    if n > 128:
                        ch += bytes([data[pos]]) * (n - 128)
                        pos += 1
                    else:
                        ch += data[pos:pos + n]
                        pos += n
                chans.append(ch)
            r, g, b, e = chans
        else:
            raw = data[pos:pos + w * 4]
            pos += w * 4
            r, g, b, e = raw[0::4], raw[1::4], raw[2::4], raw[3::4]
        if y % step:
            continue
        row = []
        for x in range(0, w, step):
            ex = e[x]
            if ex:
                f = math.ldexp(1.0, ex - 136)
                row.append((r[x] * f, g[x] * f, b[x] * f))
            else:
                row.append((0.0, 0.0, 0.0))
        rows.append(row)
    return len(rows[0]), len(rows), rows


class Pano:
    """An equirectangular panorama, sampled by direction."""

    def __init__(self, w, h, rows):
        self.w, self.h, self.rows = w, h, rows

    def sample(self, dx, dy, dz):
        lon = math.atan2(dx, -dz)
        lat = math.asin(max(-1.0, min(1.0, dy)))
        u = (lon / (2 * math.pi) + 0.5) * self.w - 0.5
        v = (0.5 - lat / math.pi) * self.h - 0.5
        x0, y0 = math.floor(u), math.floor(v)
        fx, fy = u - x0, v - y0
        y0c, y1c = max(0, min(self.h - 1, y0)), max(0, min(self.h - 1, y0 + 1))
        a = self.rows[y0c][x0 % self.w]
        b = self.rows[y0c][(x0 + 1) % self.w]
        c = self.rows[y1c][x0 % self.w]
        d = self.rows[y1c][(x0 + 1) % self.w]
        return tuple((a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy
                     for k in range(3))


class Cube:
    """Six photographs on the faces of a cube, sampled by direction."""

    def __init__(self, faces):
        self.faces = faces            # name -> PIL image, RGB, linearised on read

    def sample(self, dx, dy, dz):
        ax, ay, az = abs(dx), abs(dy), abs(dz)
        if ax >= ay and ax >= az:
            face, u, v, m = ('px', -dz, -dy, ax) if dx > 0 else ('nx', dz, -dy, ax)
        elif ay >= az:
            face, u, v, m = ('py', dx, dz, ay) if dy > 0 else ('ny', dx, -dz, ay)
        else:
            face, u, v, m = ('pz', dx, -dy, az) if dz > 0 else ('nz', -dx, -dy, az)
        im = self.faces[face]
        x = (u / m * 0.5 + 0.5) * (im.width - 1)
        y = (v / m * 0.5 + 0.5) * (im.height - 1)
        r, g, b = im.getpixel((int(x), int(y)))
        return ((r / 255.0) ** 2.2, (g / 255.0) ** 2.2, (b / 255.0) ** 2.2)


def _load(name):
    if name in CUBES:
        from PIL import Image
        faces = {}
        for f in ('px', 'nx', 'py', 'ny', 'pz', 'nz'):
            p = fetch(CUBES[name] + f + '.jpg', os.path.join(CACHE, '%s_%s.jpg' % (name, f)))
            faces[f] = Image.open(p).convert('RGB')
        return Cube(faces)
    path = fetch(SOURCES[name], os.path.join(CACHE, os.path.basename(SOURCES[name])))
    return Pano(*load_hdr(path))


# ----------------------------------------------------------------- camera --

def render(src, yaw, pitch, fov, w=W, h=H, ss=2, roll=0.0):
    """A pinhole camera in the panorama: linear light, `w` x `h`, each pixel
    the average of ss x ss rays."""
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    cr, sr = math.cos(math.radians(roll)), math.sin(math.radians(roll))
    t = math.tan(math.radians(fov) / 2)
    img = []
    for j in range(h):
        row = []
        for i in range(w):
            acc = [0.0, 0.0, 0.0]
            for sj in range(ss):
                for si in range(ss):
                    px = ((i + (si + 0.5) / ss) / w * 2 - 1) * t
                    py = -((j + (sj + 0.5) / ss) / h * 2 - 1) * t * h / w
                    px, py = px * cr - py * sr, px * sr + py * cr
                    #  Camera looks down -z; pitch about x, then yaw about y.
                    x, y, z = px, py, -1.0
                    y, z = y * cp - z * sp, y * sp + z * cp
                    x, z = x * cy + z * sy, -x * sy + z * cy
                    n = math.sqrt(x * x + y * y + z * z)
                    c = src.sample(x / n, y / n, z / n)
                    acc[0] += c[0]
                    acc[1] += c[1]
                    acc[2] += c[2]
            k = 1.0 / (ss * ss)
            row.append((acc[0] * k, acc[1] * k, acc[2] * k))
        img.append(row)
    return img


def develop(img, exposure=1.0, tint=(1.0, 1.0, 1.0), contrast=1.0, sat=1.0, lift=0.0,
            vignette=0.0, fade_bottom=0.0):
    """Linear light to 8-bit: exposure and tint, a filmic curve, then the
    grade. Returns rows of 8-bit RGB tuples."""
    h, w = len(img), len(img[0])
    out = []
    for j, row in enumerate(img):
        orow = []
        for i, (r, g, b) in enumerate(row):
            r, g, b = r * exposure * tint[0], g * exposure * tint[1], b * exposure * tint[2]
            #  ACES-style filmic curve (Narkowicz fit).
            def curve(v):
                v = max(0.0, v)
                return max(0.0, min(1.0, (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)))
            r, g, b = curve(r), curve(g), curve(b)
            r, g, b = r ** (1 / 2.2), g ** (1 / 2.2), b ** (1 / 2.2)
            lum = r * 0.3 + g * 0.59 + b * 0.11
            r, g, b = (lum + (r - lum) * sat, lum + (g - lum) * sat, lum + (b - lum) * sat)
            r, g, b = [(v - 0.5) * contrast + 0.5 + lift for v in (r, g, b)]
            if vignette:
                dx, dy = (i + 0.5) / w - 0.5, (j + 0.5) / h - 0.5
                f = 1.0 - vignette * (dx * dx + dy * dy) * 2.2
                r, g, b = r * f, g * f, b * f
            if fade_bottom:
                f = 1.0 - fade_bottom * max(0.0, (j / h - 0.55) / 0.45)
                r, g, b = r * f, g * f, b * f
            orow.append(tuple(max(0, min(255, int(v * 255 + 0.5))) for v in (r, g, b)))
        out.append(orow)
    return out


# ------------------------------------------------------------------ shots --
#
#  What each background is a picture of, and why that one. `src` is a
#  panorama above; the camera looks along `yaw` (degrees round from the
#  panorama's centre), tilted by `pitch`, `fov` wide. Battle arenas look a
#  few degrees down so the horizon sits at the line the foes stand on.

COOL = (0.82, 0.94, 1.18)
WARM = (1.12, 0.94, 0.74)
DUST = (1.30, 0.82, 0.56)

SHOTS = {
    #  The title: the sky over the sea at the end of the world.
    'title':    dict(src='the_sky_is_on_fire', yaw=290, pitch=8, fov=90,
                     grade=dict(exposure=0.55, contrast=1.05, vignette=0.45, fade_bottom=0.35)),
    #  Chapter one, 2:23 in the morning: a city street after rain, lit
    #  windows, wet stone, nobody about.
    'street':   dict(src='castle', yaw=0, pitch=3, fov=86,
                     grade=dict(exposure=0.9, tint=COOL, sat=0.85, vignette=0.5)),
    #  The same city, ninety seconds later: nothing standing, dust in the air.
    'collapse': dict(src='quarry_01', yaw=60, pitch=4, fov=90,
                     grade=dict(exposure=0.42, tint=DUST, contrast=0.92, sat=0.9, vignette=0.55)),
    #  The sky, when it starts talking.
    'sky':      dict(src='the_sky_is_on_fire', yaw=300, pitch=38, fov=90,
                     grade=dict(exposure=0.3, contrast=1.1, sat=1.2, vignette=0.45)),
    #  The book's staircase down is an ornate one: stone, columns, going away
    #  into the dark.
    'stairs':   dict(src='pillars', yaw=45, pitch=-8, fov=90,
                     grade=dict(exposure=0.085, tint=COOL, sat=0.7, contrast=1.1, vignette=0.85)),
    #  Battle arenas, one per material the floors are built from (the order
    #  view2d.c and view3d.c pick them in): poured concrete, a tagged shelter,
    #  old stone, tenement brick, and a courtyard of the city at night.
    'arena_a':  dict(src='parking_garage', yaw=0, pitch=-6, fov=90,
                     grade=dict(exposure=0.32, sat=0.8, vignette=0.55)),
    'arena_b':  dict(src='graffiti_shelter', yaw=250, pitch=-6, fov=90,
                     grade=dict(exposure=0.26, sat=0.65, contrast=0.9, vignette=0.6)),
    'arena_c':  dict(src='pillars', yaw=135, pitch=-6, fov=90,
                     grade=dict(exposure=0.2, tint=WARM, sat=0.75, vignette=0.6)),
    'arena_d':  dict(src='venetian_crossroads', yaw=135, pitch=-6, fov=90,
                     grade=dict(exposure=0.28, tint=WARM, sat=0.8, vignette=0.6)),
    'arena_e':  dict(src='castle', yaw=200, pitch=-4, fov=90,
                     grade=dict(exposure=0.75, tint=COOL, sat=0.85, vignette=0.55)),
    #  The ends: a wasteland for losing, a sunrise over water for winning.
    'gameover': dict(src='quarry_01', yaw=200, pitch=5, fov=90,
                     grade=dict(exposure=0.3, tint=DUST, sat=0.8, vignette=0.6)),
    'victory':  dict(src='venice_sunset', yaw=0, pitch=3, fov=90,
                     grade=dict(exposure=0.5, contrast=1.08, sat=1.1, vignette=0.4)),
}


# ------------------------------------------------------------------ tiles --
#
#  The dungeon's floor and wall tiles, cut out of the same panoramas as the
#  arenas so a fight happens in the place it was walked into. A floor is the
#  camera pointed straight down at the ground it was taken on; a wall is a
#  patch of wall looked at square-on. Each is made to tile -- a copy shifted
#  by half is blended in at the edges, so the seams meet themselves -- and
#  kept to 32 colours, which is what the tile renderer's tables hold.

TILES = {
    #  Poured concrete: the garage.
    'tile_floor_a': dict(src='parking_garage', yaw=0, pitch=-90, fov=50,
                         grade=dict(key=0.85, sat=0.45, contrast=1.45)),
    'tile_wall_a':  dict(src='parking_garage', yaw=90, pitch=56, fov=8,
                         grade=dict(key=0.5, sat=0.6, contrast=1.4)),
    #  The shelter: leaf litter underfoot, graffiti on every wall.
    'tile_floor_b': dict(src='graffiti_shelter', yaw=0, pitch=-90, fov=50,
                         grade=dict(key=1.1, sat=0.9)),
    'tile_wall_b':  dict(src='graffiti_shelter', yaw=250, pitch=5, fov=30,
                         grade=dict(key=0.75, sat=0.9)),
    #  Old stone: terrazzo between the columns, and the blockwork.
    'tile_floor_c': dict(src='pillars', yaw=0, pitch=-90, fov=50,
                         grade=dict(key=1.2, sat=0.9, contrast=1.25)),
    'tile_wall_c':  dict(src='pillars', yaw=200, pitch=0, fov=25,
                         grade=dict(key=0.7, sat=0.85, contrast=1.25)),
    #  Tenement brick: paving and a weathered facade.
    'tile_floor_d': dict(src='venetian_crossroads', yaw=300, pitch=-75, fov=30,
                         grade=dict(key=1.2, sat=0.9, contrast=1.2)),
    'tile_wall_d':  dict(src='venetian_crossroads', yaw=90, pitch=25, fov=8,
                         grade=dict(key=0.75, sat=0.95, contrast=1.2)),
    #  The city at night: wet cobbles and palace stone.
    'tile_floor_e': dict(src='castle', yaw=0, pitch=-35, fov=20,
                         grade=dict(key=1.1, sat=0.6, contrast=1.15, tint=COOL)),
    'tile_wall_e':  dict(src='castle', yaw=200, pitch=28, fov=8,
                         grade=dict(key=0.7, sat=0.85, contrast=1.15)),
}

TILE = 32


def seamless(patch, n, m):
    """A tile `n` square from a patch `n + m` square: across the last `m`
    texels of each axis the patch's own continuation is cross-faded in, so
    the tile's far edge runs straight on into its near one."""
    def fold(get, x):
        #  x in [0, n): blend P[x + n] into P[x] over the first m texels.
        if x >= m:
            return get(x)
        t = (x + 0.5) / m
        a, b = get(x + n), get(x)
        return tuple(a[k] * (1 - t) + b[k] * t for k in range(3))
    rows = [[fold(lambda i, r=r: r[i], x) for x in range(n)] for r in patch]
    return [[fold(lambda j, x=x: rows[j][x], y) for x in range(n)] for y in range(n)]


def cut_tile(name):
    t = TILES[name]
    src = load(t['src'])
    n, m = 64, 16
    #  The patch is n + m wide: the camera's field of view is widened to
    #  match, so the tile still covers `fov`.
    fov = 2 * math.degrees(math.atan(math.tan(math.radians(t.get('fov', 40)) / 2) * (n + m) / n))
    img = render(src, t['yaw'], t.get('pitch', 0), fov, w=n + m, h=n + m, ss=2)
    img = seamless(img, n, m)
    #  Exposed to its own middle grey, then keyed: a tile has to hold up
    #  under the dungeon's lighting, which only ever darkens it.
    lum = sorted(r * 0.3 + g * 0.59 + b * 0.11 for row in img for (r, g, b) in row)
    grade = dict(t.get('grade', {}))
    grade['exposure'] = grade.pop('key', 1.0) * 0.18 / (lum[len(lum) // 2] or 1e-4)
    rows = develop(img, **grade)
    #  Down to 32 x 32 by averaging each 2 x 2 block.
    small = [[tuple((rows[2 * y][2 * x][k] + rows[2 * y][2 * x + 1][k] + rows[2 * y + 1][2 * x][k]
                     + rows[2 * y + 1][2 * x + 1][k]) // 4 for k in range(3))
              for x in range(TILE)] for y in range(TILE)]
    import png
    from PIL import Image
    im = Image.new('RGB', (TILE, TILE))
    im.putdata([c for row in small for c in row])
    q = im.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[:32 * 3]
    palette = [ds_colour(tuple(pal[i:i + 3])) for i in range(0, len(pal), 3)]
    path = os.path.join(ROOT, 'assets', 'tiles', name + '.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    png.write_indexed(path, TILE, TILE, palette, q.tobytes())
    print('wrote', name)


def ds_colour(c):
    """The nearest colour the DS can show: five bits a channel."""
    return tuple((v >> 3) * 255 // 31 for v in c)


def write_png(path, rows):
    """Reduce to the DS's colours, then to 256 with error diffusion, and
    write it as an indexed PNG the build can read."""
    import png
    from PIL import Image
    h, w = len(rows), len(rows[0])
    im = Image.new('RGB', (w, h))
    im.putdata([c for row in rows for c in row])
    q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    pal = q.getpalette()[:256 * 3]
    palette = [ds_colour(tuple(pal[i:i + 3])) for i in range(0, len(pal), 3)]
    while len(palette) < 256:
        palette.append((0, 0, 0))
    png.write_indexed(path, w, h, palette, q.tobytes())


def shoot(name):
    s = SHOTS[name]
    src = load(s['src'])
    img = render(src, s['yaw'], s.get('pitch', 0), s.get('fov', 90), roll=s.get('roll', 0.0))
    rows = develop(img, **s.get('grade', {}))
    os.makedirs(OUT, exist_ok=True)
    write_png(os.path.join(OUT, name + '.png'), rows)
    print('wrote', name)


_loaded = {}


def load(name):
    if name not in _loaded:
        _loaded[name] = _load(name)
    return _loaded[name]


if __name__ == '__main__':
    for name in sys.argv[1:] or sorted(SHOTS) + sorted(TILES):
        (cut_tile if name in TILES else shoot)(name)
