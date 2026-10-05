// Draws the app icon in code — a reactor core on a dark tile — and encodes it
// as PNG, a macOS .icns and a Windows .ico, with nothing but node:zlib.
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * PNG-encode raw RGBA pixels (`height` defaults to `width`). opaque: drop the
 * alpha channel (Apple wants app icons without one).
 */
export function encodePng(width, rgba, height = width, { opaque = false } = {}) {
  const bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc((width * bpp + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * bpp + 1)] = 0;
    if (!opaque) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    else for (let x = 0; x < width; x++) rgba.copy(raw, y * (width * 3 + 1) + 1 + x * 3, (y * width + x) * 4, (y * width + x) * 4 + 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // RGB or RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** The tile's colour at the top and bottom (it's a soft vertical gradient). */
export const TILE_TOP = [0.03, 0.05, 0.1];
export const TILE_BOTTOM = [0.06, 0.09, 0.17];

/**
 * Signed distance-ish coverage of the icon at (u, v) in [-1, 1]². Returns [r, g, b, a] in 0–1.
 * tile: 'rounded' (a macOS-style tile with transparent corners), 'square' (full bleed, for
 * iOS and maskable icons, whose corners the system rounds itself) or 'none' (just the
 * reactor, on transparency: Android's adaptive-icon foreground). scale shrinks the art.
 */
function shade(u, v, tile = 'rounded', scale = 1) {
  const over = (dst, src) => {
    const a = src[3] + dst[3] * (1 - src[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (src[i] * src[3] + dst[i] * dst[3] * (1 - src[3])) / a).concat(a);
  };
  const t = (v + 1) / 2;
  if (tile === 'rounded') {
    // Rounded-square tile (macOS icon grid: ~80% of the canvas).
    const s = 0.8, r = 0.36;
    const qx = Math.abs(u) - (s - r), qy = Math.abs(v) - (s - r);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    if (d > 0) return [0, 0, 0, 0];
  }
  let px = tile === 'none' ? [0, 0, 0, 0] : [0, 1, 2].map((i) => TILE_TOP[i] + (TILE_BOTTOM[i] - TILE_TOP[i]) * t).concat(1);
  u /= scale;
  v /= scale;
  // Glow behind the core.
  const rr = Math.hypot(u, v);
  px = over(px, [1, 0.7, 0.28, Math.max(0, 0.55 - rr * 1.1)]);
  // Three orbit rings: ellipses rotated 0°, 60°, 120°.
  for (const deg of [0, 60, 120]) {
    const a = (deg * Math.PI) / 180;
    const x = u * Math.cos(a) + v * Math.sin(a);
    const y = -u * Math.sin(a) + v * Math.cos(a);
    const e = Math.hypot(x / 0.6, y / 0.22) - 1; // 0 on the ellipse
    const line = Math.max(0, 1 - Math.abs(e) / 0.06);
    px = over(px, [0.31, 0.82, 1, Math.min(1, line * 1.4)]);
  }
  // Nucleus.
  const n = Math.max(0, 1 - rr / 0.16);
  px = over(px, [1, 0.95, 0.85, Math.min(1, n * 2.2)]);
  px = over(px, [1, 0.7, 0.28, Math.min(1, Math.max(0, 1 - rr / 0.13) * 1.6) * 0.6]);
  return px;
}

/** Raw RGBA pixels of the icon. ss = supersampling per axis, for smooth edges. */
export function renderIcon(size, { tile = 'rounded', scale = 1, ss = 3 } = {}) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const u = ((x + (i + 0.5) / ss) / size) * 2 - 1;
          const v = ((y + (j + 0.5) / ss) / size) * 2 - 1;
          const p = shade(u, v, tile, scale);
          acc = [acc[0] + p[0] * p[3], acc[1] + p[1] * p[3], acc[2] + p[2] * p[3], acc[3] + p[3]];
        }
      }
      const a = acc[3] / (ss * ss);
      const o = (y * size + x) * 4;
      out[o] = a ? Math.round((acc[0] / acc[3]) * 255) : 0;
      out[o + 1] = a ? Math.round((acc[1] / acc[3]) * 255) : 0;
      out[o + 2] = a ? Math.round((acc[2] / acc[3]) * 255) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/** The icon as a PNG. See shade() for the options. */
export const drawIcon = (size, opts = {}) => encodePng(size, renderIcon(size, opts), size, { opaque: opts.opaque });

/** A launch screen: the reactor, centred on the tile colour, any size. */
export function drawSplash(width, height, { coverage = 0.32 } = {}) {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let i = 0; i < 3; i++) out[o + i] = Math.round((TILE_TOP[i] + (TILE_BOTTOM[i] - TILE_TOP[i]) * t) * 255);
      out[o + 3] = 255;
    }
  }
  const size = Math.round(Math.min(width, height) * coverage);
  const art = renderIcon(size, { tile: 'none', ss: 2 });
  const ox = Math.round((width - size) / 2), oy = Math.round((height - size) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = art[(y * size + x) * 4 + 3] / 255;
      if (!a) continue;
      const o = ((oy + y) * width + ox + x) * 4;
      for (let i = 0; i < 3; i++) out[o + i] = Math.round(art[(y * size + x) * 4 + i] * a + out[o + i] * (1 - a));
    }
  }
  return encodePng(width, out, height, { opaque: true });
}

/** Width and height of a PNG file, from its header. */
export const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

/** An .icns holding PNG renditions — macOS reads 'ic08' (256), 'ic09' (512), 'ic10' (1024). */
export function makeIcns() {
  const parts = [['ic08', 256], ['ic09', 512], ['ic10', 1024]].map(([type, size]) => {
    const png = drawIcon(size);
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

/** A Windows .ico holding PNG renditions (16–256 px), which Windows Vista and later read directly. */
export function makeIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => drawIcon(s));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // 1 = icon
  head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; // 0 means 256
    e[1] = s === 256 ? 0 : s;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...pngs]);
}
