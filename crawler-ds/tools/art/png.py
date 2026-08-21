"""Minimal PNG writer (8-bit RGB), so the art tools can show their work without
a third-party imaging library."""
import struct
import zlib


def write_rgb(path, width, height, pixels):
    """pixels: a flat list/bytearray of length width*height*3."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        start = y * width * 3
        raw += bytes(pixels[start:start + width * 3])
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


class Canvas:
    """A tiny indexed-colour canvas: index 0 is transparent."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h)

    def put(self, x, y, idx):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = idx

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y * self.w + x]
        return 0

    def rect(self, x0, y0, x1, y1, idx):
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.px[y * self.w + x] = idx

    def ellipse(self, cx, cy, rx, ry, idx):
        if rx <= 0 or ry <= 0:
            return
        for y in range(max(0, int(cy - ry)), min(self.h, int(cy + ry) + 1)):
            for x in range(max(0, int(cx - rx)), min(self.w, int(cx + rx) + 1)):
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.px[y * self.w + x] = idx

    def line(self, x0, y0, x1, y1, idx, thick=1):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            for oy in range(thick):
                for ox in range(thick):
                    self.put(int(x) + ox, int(y) + oy, idx)

    def poly(self, points, idx):
        ys = [p[1] for p in points]
        for y in range(max(0, int(min(ys))), min(self.h, int(max(ys)) + 1)):
            xs = []
            n = len(points)
            for i in range(n):
                x0, y0 = points[i]
                x1, y1 = points[(i + 1) % n]
                if (y0 <= y < y1) or (y1 <= y < y0):
                    t = (y - y0) / (y1 - y0)
                    xs.append(x0 + (x1 - x0) * t)
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(xs[i]), int(xs[i + 1]) + 1):
                    self.put(x, y, idx)

    def outline(self, idx, over=None):
        """Draws an outline in `idx` around every non-empty pixel."""
        src = bytes(self.px)
        for y in range(self.h):
            for x in range(self.w):
                if src[y * self.w + x]:
                    continue
                near = False
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= xx < self.w and 0 <= yy < self.h and src[yy * self.w + xx]:
                        if over is None or src[yy * self.w + xx] in over:
                            near = True
                if near:
                    self.px[y * self.w + x] = idx

    def shade(self, palette_map, condition):
        """Recolours pixels where condition(x, y, idx) is true."""
        for y in range(self.h):
            for x in range(self.w):
                i = self.px[y * self.w + x]
                if i and condition(x, y, i):
                    self.px[y * self.w + x] = palette_map.get(i, i)
