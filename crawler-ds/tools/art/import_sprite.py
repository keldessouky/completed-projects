"""Turn an ordinary PNG into a sprite this ROM can carry.

Drawing a character by hand out of shaded primitives is one way to get a
sprite and it is not the best one available. A sprite generator -- Retro
Diffusion, PixelLab, an SD pixel-art model, or an artist with a mouse --
will beat it, and the useful thing to do with that output is not admire it
but get it into the cartridge correctly, which is fiddly in ways that have
nothing to do with drawing:

  * a DS sprite is an indexed byte per pixel, so the image has to be
    quantised, and quantising by nearest RGB scatters a character's skin
    across four unrelated ramps;
  * the background has to go, including the halo of half-transparent pixels
    a generator leaves around the silhouette, which quantise to a bright
    fringe that reads as a sticker edge;
  * it has to be trimmed, scaled without smoothing -- a resampled pixel is a
    lie about what is underneath it -- and stood on the same ground row as
    everybody else, with the same shadow.

That is what this does. It is the half of the job worth automating.

    python3 tools/art/import_sprite.py carl.png --height 74 --out carl

Colours are matched into tools/art/palettes.py by default so an import sits
in the same world as the rest of the game; --keep-colours quantises the
source's own palette instead, for art that should not be recoloured.
"""
import argparse
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from palettes import INK, RAMPS, _hsl, rgb555            # noqa: E402

CATALOGUE = [c for ramp in RAMPS.values() for c in ramp] + list(INK.values())


def read_png(path):
    """Enough of a PNG reader for what a generator emits: 8-bit RGB or RGBA,
    any filter, no interlace."""
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit("%s is not a PNG" % path)
    i, idat, w, h, ct, bd = 8, b'', 0, 0, 0, 8
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        tag, dat = d[i + 4:i + 8], d[i + 8:i + 8 + ln]
        if tag == b'IHDR':
            w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', dat[:13])
            if bd != 8 or il:
                raise SystemExit("only 8-bit non-interlaced PNGs, sorry")
        elif tag == b'IDAT':
            idat += dat
        i += 12 + ln
    nch = {0: 1, 2: 3, 4: 2, 6: 4}.get(ct)
    if nch is None:
        raise SystemExit("palette PNGs are not handled; export RGB or RGBA")
    raw = zlib.decompress(idat)
    stride, rows, prev, o = w * nch, [], bytearray(w * nch), 0
    for _ in range(h):
        f = raw[o]
        line = bytearray(raw[o + 1:o + 1 + stride])
        o += 1 + stride
        if f == 1:
            for x in range(nch, stride):
                line[x] = (line[x] + line[x - nch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - nch] if x >= nch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - nch] if x >= nch else 0
                b = prev[x]
                c = prev[x - nch] if x >= nch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if (pa <= pb and pa <= pc)
                                      else (b if pb <= pc else c))) & 255
        rows.append(bytes(line))
        prev = line
    return w, h, nch, rows


def to_rgba(w, h, nch, rows, bg_tolerance=26):
    """Flatten to (r, g, b, a). Where there is no alpha channel the corner
    colour is taken as the background, which is what a generator on a flat
    backdrop gives you."""
    out = [[None] * w for _ in range(h)]
    corner = tuple(rows[0][0:3]) if nch >= 3 else (rows[0][0],) * 3
    for y in range(h):
        line = rows[y]
        for x in range(w):
            o = x * nch
            if nch >= 3:
                r, g, b = line[o], line[o + 1], line[o + 2]
                a = line[o + 3] if nch == 4 else 255
            else:
                r = g = b = line[o]
                a = line[o + 1] if nch == 2 else 255
            if nch in (1, 3):
                if abs(r - corner[0]) + abs(g - corner[1]) + abs(b - corner[2]) <= bg_tolerance:
                    a = 0
            out[y][x] = (r, g, b, a)
    return out


def trim(px):
    ys = [y for y, row in enumerate(px) for p in row if p[3] > 128]
    xs = [x for row in px for x, p in enumerate(row) if p[3] > 128]
    if not xs:
        raise SystemExit("the image is empty once the background is removed")
    return min(xs), max(xs), min(ys), max(ys)


def resize(px, x0, x1, y0, y1, tw, th):
    """Box filter down, nearest up. Averaging on the way up invents pixels
    that were never drawn, which is the one thing pixel art cannot survive."""
    sw, sh = x1 - x0 + 1, y1 - y0 + 1
    out = []
    for j in range(th):
        row = []
        for i in range(tw):
            sx0 = x0 + i * sw // tw
            sx1 = max(sx0 + 1, x0 + (i + 1) * sw // tw)
            sy0 = y0 + j * sh // th
            sy1 = max(sy0 + 1, y0 + (j + 1) * sh // th)
            r = g = b = a = n = 0
            for sy in range(sy0, sy1):
                for sx in range(sx0, sx1):
                    p = px[sy][sx]
                    if p[3] > 128:
                        r += p[0]; g += p[1]; b += p[2]; a += 1
                    n += 1
            #  A pixel is only kept if most of what it covers was solid. This
            #  is what removes the soft halo a generator leaves around a
            #  silhouette, which otherwise quantises into a bright fringe.
            row.append((r // a, g // a, b // a, 255) if a * 2 > n else (0, 0, 0, 0))
        out.append(row)
    return out


def snap(rgb):
    bh, bs, bl = _hsl(rgb)
    best, bd = None, None
    for c in CATALOGUE:
        h, sat, lum = _hsl(c)
        dh = abs(bh - h)
        dh = min(dh, 360.0 - dh)
        d = (dh * min(bs, sat) * 2.2) ** 2
        d += ((bs - sat) * 260.0) ** 2
        d += ((bl - lum) * 200.0) ** 2
        if bd is None or d < bd:
            best, bd = c, d
    return best


def quantise(px, limit, keep_colours):
    """Median-cut on the image's own colours when keeping them, otherwise
    every pixel is matched into the shared palette first and the result is
    already small."""
    if not keep_colours:
        cache, out = {}, []
        for row in px:
            o = []
            for p in row:
                if p[3] < 128:
                    o.append(None)
                    continue
                key = p[:3]
                if key not in cache:
                    cache[key] = snap(key)
                o.append(cache[key])
            out.append(o)
        return out

    buckets = [[p[:3] for row in px for p in row if p[3] >= 128]]
    while len(buckets) < limit:
        widest, axis, span = None, 0, -1
        for bi, b in enumerate(buckets):
            if len(b) < 2:
                continue
            for ax in range(3):
                lo = min(c[ax] for c in b)
                hi = max(c[ax] for c in b)
                if hi - lo > span:
                    widest, axis, span = bi, ax, hi - lo
        if widest is None:
            break
        b = sorted(buckets[widest], key=lambda c: c[axis])
        buckets[widest:widest + 1] = [b[:len(b) // 2], b[len(b) // 2:]]
    reps = [tuple(sum(c[k] for c in b) // len(b) for k in range(3))
            for b in buckets if b]
    cache, out = {}, []
    for row in px:
        o = []
        for p in row:
            if p[3] < 128:
                o.append(None)
                continue
            key = p[:3]
            if key not in cache:
                cache[key] = min(reps, key=lambda c: sum((c[k] - key[k]) ** 2
                                                         for k in range(3)))
            o.append(cache[key])
        out.append(o)
    return out


def build(path, height, limit, keep_colours, frame_w, frame_h, ground):
    w, h, nch, rows = read_png(path)
    px = to_rgba(w, h, nch, rows)
    x0, x1, y0, y1 = trim(px)
    tw = max(1, int(round((x1 - x0 + 1) * height / float(y1 - y0 + 1))))
    small = resize(px, x0, x1, y0, y1, tw, height)
    mapped = quantise(small, limit, keep_colours)

    from forge_tools import Sprite
    fw = frame_w or tw
    fh = frame_h or height
    s = Sprite(fw, fh)
    ox = (fw - tw) // 2
    oy = (ground - height) if ground is not None else 0
    for j, row in enumerate(mapped):
        for i, c in enumerate(row):
            if c is not None:
                s.put(ox + i, oy + j, s.ink(c))
    if ground is not None:
        s = s.stage(fw, fh, ground)
    return s, w, h, tw, len(s.pal) - 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('image')
    ap.add_argument('--height', type=int, default=74,
                    help="how tall the character should end up, in pixels")
    ap.add_argument('--colours', type=int, default=32)
    ap.add_argument('--keep-colours', action='store_true',
                    help="quantise the source's own palette instead of "
                         "matching it into the game's")
    ap.add_argument('--frame', default='64x74', help="the sprite frame, WxH")
    ap.add_argument('--ground', type=int, default=None,
                    help="the row the feet stand on; adds the shared shadow")
    ap.add_argument('--out', default=None, help="write a preview PNG here")
    a = ap.parse_args()
    fw, fh = (int(v) for v in a.frame.lower().split('x'))
    sp, sw, sh, tw, n = build(a.image, a.height, a.colours, a.keep_colours,
                              fw, fh, a.ground)
    print("  %s: %dx%d -> %dx%d in a %dx%d frame, %d colours"
          % (os.path.basename(a.image), sw, sh, tw, a.height, fw, fh, n))
    if a.out:
        buf = bytearray()
        for y in range(sp.h):
            for x in range(sp.w):
                i = sp.px[y * sp.w + x]
                buf += bytes(sp.pal[i] if i else (40, 36, 52))
        import png as pngmod
        pngmod.write_rgb(a.out, sp.w, sp.h, buf)
        print("  preview: %s" % a.out)
