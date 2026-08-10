#!/usr/bin/env node
/**
 * Crown & Circuit — procedural audio.
 *
 * Synthesizes every SFX and music bed from scratch and packs them into ONE
 * mono 22050 Hz 16-bit WAV with a Howler sprite map. All original, all CC0,
 * deterministic (seeded PRNG) so the same command yields identical bytes.
 *
 * The five weapon voices are the point: a blade whoosh, a black-powder crack,
 * a rifle report, a machine-gun chatter, and a laser zap. The five music beds
 * walk the same chord bed from lute-ish plucks to a synth arpeggio.
 *
 * Usage: node tools/gen-audio.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 22050;
const GAP_MS = 60;

let seed = 0xc0ffee;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const expEnv = (n, len, k) => Math.exp((-k * n) / len);
const adEnv = (n, atk, len, k) => (n < atk ? n / atk : 1) * Math.exp((-k * Math.max(0, n - atk)) / len);
const soft = (x) => Math.tanh(x);

function lowpass(b, cut) { let y = 0; for (let i = 0; i < b.length; i++) { y += cut * (b[i] - y); b[i] = y; } return b; }
function highpass(b, cut) { let y = 0; for (let i = 0; i < b.length; i++) { y += cut * (b[i] - y); b[i] = b[i] - y; } return b; }
function shape(b, fn) { for (let n = 0; n < b.length; n++) b[n] *= fn(n, b.length); return b; }
function noise(dur, lvl = 1) { const b = buf(dur); for (let n = 0; n < b.length; n++) b[n] = (rnd() * 2 - 1) * lvl; return b; }
function sine(dur, f0, f1 = f0, glide = dur, lvl = 1) {
  const b = buf(dur); let ph = 0; const g = Math.round(glide * SR);
  for (let n = 0; n < b.length; n++) {
    const t = Math.min(1, n / g);
    ph += (TAU * (f0 + (f1 - f0) * t)) / SR;
    b[n] = Math.sin(ph) * lvl;
  }
  return b;
}
function mixAt(dst, src, at, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
  return dst;
}
/** Karplus-Strong pluck — the medieval voice */
function pluck(freq, dur, { damp = 0.995, bright = 0.55, level = 1 } = {}) {
  const out = buf(dur);
  const N = Math.max(2, Math.round(SR / freq));
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = rnd() * 2 - 1;
  let px = 0;
  for (let i = 0; i < N; i++) { px = 0.6 * px + 0.4 * d[i]; d[i] = px; }
  let idx = 0, prev = 0;
  for (let n = 0; n < out.length; n++) {
    const cur = d[idx], nxt = d[(idx + 1) % N];
    let v = 0.5 * (cur + nxt) * damp;
    v = bright * v + (1 - bright) * prev;
    prev = v; d[idx] = v; out[n] = cur * level;
    idx = (idx + 1) % N;
  }
  return out;
}
/** band-limited saw for synth eras */
function saw(dur, f0, f1 = f0, lvl = 1) {
  const b = buf(dur); let ph = 0; const n1 = b.length;
  for (let n = 0; n < n1; n++) {
    const f = f0 + (f1 - f0) * (n / n1);
    ph += f / SR; ph -= Math.floor(ph);
    b[n] = (ph * 2 - 1) * lvl;
  }
  return b;
}
function square(dur, f, lvl = 1, duty = 0.5) {
  const b = buf(dur); let ph = 0;
  for (let n = 0; n < b.length; n++) { ph += f / SR; ph -= Math.floor(ph); b[n] = (ph < duty ? 1 : -1) * lvl; }
  return b;
}

const sfx = {};

// ---------- UI ----------
sfx.uiTap = shape(sine(0.05, 980, 700, 0.045, 0.5), (n, l) => adEnv(n, 5, l, 8));
sfx.uiBack = shape(sine(0.07, 520, 340, 0.06, 0.45), (n, l) => adEnv(n, 5, l, 7));

// ---------- weapons, one per era ----------
sfx.sfxBlade = (() => {                       // steel whoosh + light ring
  const b = noise(0.16, 0.8);
  let y1 = 0, y2 = 0;
  for (let n = 0; n < b.length; n++) {
    const t = n / b.length;
    const cut = 0.72 * (1 - t * 0.75) + 0.05;
    y1 += cut * (b[n] - y1); y2 += cut * 0.4 * (b[n] - y2);
    b[n] = (y1 - y2) * 2.4;
  }
  shape(b, (n, l) => adEnv(n, 60, l, 7));
  mixAt(b, shape(sine(0.1, 2100, 2600, 0.1, 0.12), (n, l) => expEnv(n, l, 9)), 0.02);
  return b;
})();

sfx.sfxMusket = (() => {                      // black powder: crack + smoke tail
  const b = buf(0.34);
  const crack = lowpass(noise(0.09, 1), 0.55);
  shape(crack, (n, l) => expEnv(n, l, 14));
  mixAt(b, crack, 0);
  mixAt(b, shape(sine(0.18, 190, 62, 0.09, 0.75), (n, l) => adEnv(n, 4, l, 8)), 0);
  const tail = lowpass(noise(0.26, 0.36), 0.12);
  shape(tail, (n, l) => adEnv(n, 300, l, 4.5));
  mixAt(b, tail, 0.05);
  return b;
})();

sfx.sfxRifle = (() => {                       // sharper, tighter report
  const b = buf(0.22);
  const crack = highpass(noise(0.05, 1), 0.35);
  shape(crack, (n, l) => expEnv(n, l, 18));
  mixAt(b, crack, 0);
  mixAt(b, shape(sine(0.12, 320, 90, 0.05, 0.6), (n, l) => adEnv(n, 3, l, 12)), 0);
  mixAt(b, shape(lowpass(noise(0.16, 0.28), 0.2), (n, l) => expEnv(n, l, 6)), 0.03);
  return b;
})();

sfx.sfxMg = (() => {                          // one chunky MG round
  const b = buf(0.14);
  mixAt(b, shape(highpass(noise(0.035, 0.95), 0.45), (n, l) => expEnv(n, l, 20)), 0);
  mixAt(b, shape(sine(0.09, 260, 70, 0.035, 0.7), (n, l) => adEnv(n, 2, l, 14)), 0);
  mixAt(b, shape(sine(0.05, 1400, 900, 0.05, 0.14), (n, l) => expEnv(n, l, 16)), 0);
  return b;
})();

sfx.sfxLaser = (() => {                       // descending zap with a glassy tail
  const b = buf(0.2);
  mixAt(b, shape(saw(0.12, 1750, 420, 0.5), (n, l) => adEnv(n, 2, l, 10)), 0);
  mixAt(b, shape(sine(0.16, 2600, 700, 0.12, 0.3), (n, l) => expEnv(n, l, 8)), 0);
  mixAt(b, shape(highpass(noise(0.05, 0.2), 0.6), (n, l) => expEnv(n, l, 12)), 0);
  lowpass(b, 0.75);
  return b;
})();

// ---------- feedback ----------
sfx.sfxHit = shape(highpass(lowpass(noise(0.05, 0.7), 0.6), 0.22), (n, l) => expEnv(n, l, 11));
sfx.sfxKill = (() => {
  const b = lowpass(noise(0.17, 0.85), 0.3);
  shape(b, (n, l) => expEnv(n, l, 8));
  mixAt(b, shape(sine(0.14, 150, 48, 0.1, 0.5), (n, l) => expEnv(n, l, 7)), 0);
  return b;
})();
sfx.sfxCoin = (() => {
  const b = buf(0.13);
  mixAt(b, shape(sine(0.11, 1320, 1320, 0.1, 0.3), (n, l) => expEnv(n, l, 8)), 0);
  mixAt(b, shape(sine(0.09, 1980, 1980, 0.09, 0.22), (n, l) => expEnv(n, l, 9)), 0.018);
  return b;
})();
sfx.sfxBuild = (() => {                        // stone thunk + rising chime
  const b = buf(0.7);
  mixAt(b, shape(sine(0.24, 150, 62, 0.08, 0.85), (n, l) => adEnv(n, 5, l, 7)), 0);
  mixAt(b, shape(lowpass(noise(0.16, 0.55), 0.28), (n, l) => expEnv(n, l, 8)), 0);
  mixAt(b, pluck(523, 0.4, { level: 0.34 }), 0.06);
  mixAt(b, pluck(784, 0.42, { level: 0.32 }), 0.14);
  mixAt(b, pluck(1046, 0.44, { level: 0.3 }), 0.22);
  return b;
})();
sfx.sfxCrumble = (() => {
  const b = buf(0.6);
  for (let i = 0; i < 16; i++) {
    const cr = lowpass(noise(0.05 + rnd() * 0.05, 0.55), 0.22 + rnd() * 0.25);
    shape(cr, (n, l) => expEnv(n, l, 9));
    mixAt(b, cr, rnd() * 0.4, 0.7);
  }
  mixAt(b, shape(sine(0.4, 110, 44, 0.2, 0.6), (n, l) => adEnv(n, 40, l, 5)), 0);
  return b;
})();
sfx.sfxKeepHit = (() => {
  const b = buf(0.5);
  mixAt(b, shape(sine(0.36, 96, 52, 0.14, 0.9), (n, l) => adEnv(n, 5, l, 6)), 0);
  mixAt(b, shape(lowpass(noise(0.2, 0.5), 0.2), (n, l) => expEnv(n, l, 7)), 0);
  return b;
})();
sfx.sfxHurt = (() => {
  const b = shape(sine(0.24, 340, 120, 0.12, 0.6), (n, l) => adEnv(n, 4, l, 8));
  mixAt(b, shape(highpass(noise(0.08, 0.35), 0.4), (n, l) => expEnv(n, l, 9)), 0);
  return b;
})();
sfx.sfxDown = (() => {                          // the king falls
  const b = buf(1.2);
  mixAt(b, shape(sine(0.9, 220, 55, 0.7, 0.75), (n, l) => adEnv(n, 20, l, 3.6)), 0);
  mixAt(b, shape(lowpass(noise(0.5, 0.4), 0.12), (n, l) => expEnv(n, l, 5)), 0.05);
  mixAt(b, pluck(196, 0.9, { level: 0.3, damp: 0.997 }), 0.1);
  return b;
})();
sfx.sfxWave = (() => {                          // horn: a wave is coming
  const b = buf(1.1);
  for (const [f, at, lv] of [[196, 0, 0.5], [262, 0.22, 0.45], [392, 0.44, 0.4]]) {
    const h = buf(0.7);
    let ph = 0;
    for (let n = 0; n < h.length; n++) {
      ph += (TAU * f) / SR;
      h[n] = (Math.sin(ph) + 0.4 * Math.sin(ph * 2) + 0.16 * Math.sin(ph * 3)) * lv;
    }
    shape(h, (n, l) => adEnv(n, 900, l, 3.4));
    mixAt(b, h, at);
  }
  return b;
})();
sfx.sfxEra = (() => {                           // era advance: rising sweep + impact
  const b = buf(2.0);
  mixAt(b, shape(saw(0.9, 110, 880, 0.5), (n, l) => adEnv(n, 2000, l, 2.4)), 0);
  mixAt(b, shape(sine(1.2, 60, 40, 0.9, 0.9), (n, l) => adEnv(n, 60, l, 3)), 0.85);
  mixAt(b, shape(highpass(noise(0.7, 0.4), 0.5), (n, l) => adEnv(n, 1600, l, 3)), 0.2);
  for (let i = 0; i < 4; i++) mixAt(b, pluck(523 * Math.pow(2, i / 4), 0.7, { level: 0.24 }), 0.9 + i * 0.09);
  for (let n = 0; n < b.length; n++) b[n] = soft(b[n] * 1.1);
  return b;
})();
sfx.sfxCard = shape(sine(0.3, 660, 990, 0.25, 0.34), (n, l) => adEnv(n, 200, l, 5));
sfx.sfxWin = (() => {
  const b = buf(2.4);
  const seq = [0, 4, 7, 12, 16, 19];
  for (let i = 0; i < seq.length; i++) {
    mixAt(b, pluck(261.6 * Math.pow(2, seq[i] / 12), 1.2, { level: 0.36, damp: 0.997 }), i * 0.13);
  }
  mixAt(b, shape(sine(1.2, 65, 65, 1.2, 0.4), (n, l) => adEnv(n, 400, l, 3)), 0.8);
  return b;
})();
sfx.sfxLose = (() => {
  const b = buf(2.0);
  mixAt(b, pluck(196, 1.4, { level: 0.42, damp: 0.997 }), 0);
  mixAt(b, pluck(185, 1.4, { level: 0.4, damp: 0.997 }), 0.4);
  mixAt(b, shape(sine(1.4, 98, 88, 1.2, 0.5), (n, l) => adEnv(n, 500, l, 2.8)), 0.4);
  return b;
})();

// ================= music: five beds over one chord walk =================
function renderLoop(lenSec, events) {
  const N = Math.round(lenSec * SR);
  const tail = Math.round(2.6 * SR);
  const work = new Float32Array(N + tail);
  for (const [at, b, gain] of events) {
    const o = Math.round(at * SR);
    for (let i = 0; i < b.length && o + i < work.length; i++) work[o + i] += b[i] * (gain ?? 1);
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = work[i];
  for (let i = 0; i < tail; i++) out[i] += work[N + i];
  return out;
}
function drone(lenSec, freq, level) {
  const out = buf(lenSec);
  let p1 = 0, p2 = 0;
  const lfoHz = 1 / (lenSec / 2);
  for (let n = 0; n < out.length; n++) {
    const t = n / SR;
    p1 += (TAU * freq) / SR; p2 += (TAU * freq * 1.5) / SR;
    out[n] = (Math.sin(p1) + 0.3 * Math.sin(p2)) * level * (0.75 + 0.25 * Math.sin(TAU * lfoHz * t));
  }
  return out;
}
function kick(level = 1) {
  const b = sine(0.26, 150, 45, 0.05, level);
  return shape(b, (n, l) => adEnv(n, 3, l, 8));
}
function snare(level = 1) {
  const b = highpass(noise(0.14, level), 0.4);
  shape(b, (n, l) => expEnv(n, l, 9));
  mixAt(b, shape(sine(0.09, 200, 160, 0.09, level * 0.4), (n, l) => expEnv(n, l, 10)), 0);
  return b;
}
function hat(level = 1) { return shape(highpass(noise(0.04, level), 0.8), (n, l) => expEnv(n, l, 12)); }

const music = {};
// Aeolian on A: A B C D E F G — same degrees across all five beds.
const AEOL = [0, 2, 3, 5, 7, 8, 10];
const note = (root, deg, oct = 0) =>
  root * Math.pow(2, AEOL[((deg % 7) + 7) % 7] / 12 + Math.floor(deg / 7) + oct);
const A2 = 110, A3 = 220, A4 = 440;

/** Each era's bed shares the chord walk but changes instrument and drive. */
function bed(eraIdx, bpm, bars, opts) {
  const beat = 60 / bpm;
  const len = bars * 4 * beat;
  const ev = [];
  const prog = [0, 5, 3, 4];   // i - VI - IV - V, one per bar-pair
  for (let bar = 0; bar < bars; bar++) {
    const deg = prog[Math.floor(bar / (bars / 4)) % 4];
    // drums
    if (opts.drums) {
      ev.push([bar * 4 * beat, kick(opts.kick)]);
      ev.push([(bar * 4 + 2) * beat, kick(opts.kick * 0.85)]);
      if (eraIdx >= 1) ev.push([(bar * 4 + 1) * beat, snare(opts.snare)]);
      if (eraIdx >= 1) ev.push([(bar * 4 + 3) * beat, snare(opts.snare)]);
      if (eraIdx >= 3) for (let e = 0; e < 8; e++) ev.push([(bar * 4 + e * 0.5) * beat, hat(0.1)]);
    }
    // bass
    for (let s = 0; s < 4; s++) {
      const f = note(A2, deg);
      const b = eraIdx >= 3
        ? shape(saw(0.22, f, f, 0.5), (n, l) => adEnv(n, 4, l, 5))
        : shape(pluck(f, 0.4, { level: 0.5, damp: 0.99 }), (n, l) => adEnv(n, 2, l, 3));
      if (eraIdx >= 3) lowpass(b, 0.1);
      ev.push([(bar * 4 + s) * beat, b, 0.55]);
    }
    // lead: pluck early, arpeggio late
    const cell = eraIdx >= 3 ? [0, 2, 4, 6, 4, 2] : [0, 2, 4, 2];
    for (let i = 0; i < cell.length; i++) {
      const f = note(eraIdx >= 3 ? A4 : A3, deg + cell[i]);
      const dur = eraIdx >= 3 ? 0.2 : 0.8;
      const v = eraIdx >= 3
        ? shape(square(dur, f, 0.16, 0.32), (n, l) => adEnv(n, 3, l, 6))
        : pluck(f, dur, { level: 0.24, damp: 0.996 });
      ev.push([(bar * 4 + i * (4 / cell.length)) * beat, v]);
    }
  }
  const b = renderLoop(len, ev);
  const dr = drone(len, A2 / 2, opts.drone);
  for (let i = 0; i < b.length; i++) b[i] = soft((b[i] + dr[i]) * opts.drive);
  return b;
}

music.musicIron     = bed(0, 84,  4, { drums: true, kick: 0.5, snare: 0.0, drone: 0.16, drive: 1.0 });
music.musicPowder   = bed(1, 96,  4, { drums: true, kick: 0.6, snare: 0.22, drone: 0.15, drive: 1.05 });
music.musicIndustry = bed(2, 108, 4, { drums: true, kick: 0.7, snare: 0.3, drone: 0.14, drive: 1.1 });
music.musicModern   = bed(3, 122, 4, { drums: true, kick: 0.8, snare: 0.34, drone: 0.13, drive: 1.15 });
music.musicNeon     = bed(4, 134, 4, { drums: true, kick: 0.9, snare: 0.36, drone: 0.12, drive: 1.2 });
music.musicTitle    = bed(0, 76,  4, { drums: false, kick: 0, snare: 0, drone: 0.2, drive: 0.95 });

// ================= pack =================
const entries = [];
let cursor = 0;
const gap = Math.round((GAP_MS / 1000) * SR);
const chunks = [];
const loops = new Set(Object.keys(music));

function normalize(b, peak) {
  let max = 0;
  for (let i = 0; i < b.length; i++) max = Math.max(max, Math.abs(b[i]));
  if (max > 0) { const g = peak / max; for (let i = 0; i < b.length; i++) b[i] *= g; }
  return b;
}

for (const [name, b] of [...Object.entries(sfx), ...Object.entries(music)]) {
  normalize(b, name.startsWith('music') ? 0.74 : 0.88);
  entries.push([name, Math.round((cursor / SR) * 1000), Math.round((b.length / SR) * 1000), loops.has(name)]);
  chunks.push(b);
  cursor += b.length + gap;
}

const total = new Float32Array(cursor);
let off = 0;
for (const b of chunks) { total.set(b, off); off += b.length + gap; }

const dataLen = total.length * 2;
const wav = Buffer.alloc(44 + dataLen);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataLen, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataLen, 40);
for (let i = 0; i < total.length; i++) {
  const v = Math.max(-1, Math.min(1, total[i]));
  wav.writeInt16LE((v * 32767) | 0, 44 + i * 2);
}

mkdirSync(join(ROOT, 'public/assets'), { recursive: true });
mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
writeFileSync(join(ROOT, 'public/assets/audio.wav'), wav);

const sprites = {};
for (const [name, start, dur, loop] of entries) sprites[name] = loop ? [start, dur, true] : [start, dur];
writeFileSync(join(ROOT, 'src/generated/audio-sprites.json'), JSON.stringify({ sprites }, null, 2));

console.log(`audio.wav: ${(wav.length / 1024 / 1024).toFixed(2)} MB, ${(cursor / SR).toFixed(1)}s, ${entries.length} sprites`);
for (const [n, s, d] of entries) console.log(`  ${n.padEnd(14)} @${String(s).padStart(6)}ms ${d}ms`);
