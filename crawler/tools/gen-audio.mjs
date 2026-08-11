#!/usr/bin/env node
/**
 * Crawler — procedural audio pipeline.
 *
 * Synthesizes every SFX and music loop from scratch (Karplus-Strong lyre,
 * frame drums, sine booms, filtered noise) and packs them into ONE mono
 * 22050 Hz 16-bit WAV, with a Howler sprite map written alongside.
 * All output is original, deterministic (seeded PRNG), and CC0.
 *
 * Usage: node tools/gen-audio.mjs
 * Out:   public/assets/audio.wav + src/generated/audio-sprites.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 22050;
const GAP_MS = 60; // silence between sprites so Howler never bleeds

// ---------- deterministic PRNG ----------
let seed = 0x5eed1eaf;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- tiny DSP toolkit ----------
const TAU = Math.PI * 2;
const secs = (n) => Math.round(n * SR);

function buf(sec) { return new Float32Array(secs(sec)); }

/** exponential decay envelope */
function expEnv(n, len, k) { return Math.exp((-k * n) / len); }

/** attack-decay envelope, attack in samples */
function adEnv(n, atk, len, k) {
  const a = n < atk ? n / atk : 1;
  return a * Math.exp((-k * Math.max(0, n - atk)) / len);
}

/** one-pole lowpass over a buffer, cutoff 0..1 (fraction of Nyquist-ish) */
function lowpass(b, cut) {
  let y = 0;
  const a = Math.min(1, cut);
  for (let i = 0; i < b.length; i++) { y += a * (b[i] - y); b[i] = y; }
  return b;
}
function highpass(b, cut) {
  let y = 0, py = 0;
  const a = Math.min(1, cut);
  for (let i = 0; i < b.length; i++) { y += a * (b[i] - y); const o = b[i] - y; py = o; b[i] = py; }
  return b;
}

/** soft clip for warmth */
const soft = (x) => Math.tanh(x);

/** Karplus-Strong plucked string — the lyre voice of the whole game. */
function pluck(freq, dur, { damp = 0.995, bright = 0.55, level = 1 } = {}) {
  const out = buf(dur);
  const N = Math.max(2, Math.round(SR / freq));
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = rnd() * 2 - 1;
  // soften the excitation for a thumb-plucked (not wire-picked) tone
  let px = 0;
  for (let i = 0; i < N; i++) { px = 0.6 * px + 0.4 * d[i]; d[i] = px; }
  let idx = 0, prev = 0;
  for (let n = 0; n < out.length; n++) {
    const cur = d[idx];
    const nxt = d[(idx + 1) % N];
    let v = 0.5 * (cur + nxt) * damp;
    v = bright * v + (1 - bright) * prev;
    prev = v;
    d[idx] = v;
    out[n] = cur * level;
    idx = (idx + 1) % N;
  }
  return out;
}

/** sine with optional pitch glide (fromHz→toHz over glideSec) */
function sine(dur, fromHz, toHz = fromHz, glideSec = dur, level = 1) {
  const out = buf(dur);
  let ph = 0;
  const g = secs(glideSec);
  for (let n = 0; n < out.length; n++) {
    const t = Math.min(1, n / g);
    const f = fromHz + (toHz - fromHz) * t;
    ph += (TAU * f) / SR;
    out[n] = Math.sin(ph) * level;
  }
  return out;
}

function noise(dur, level = 1) {
  const out = buf(dur);
  for (let n = 0; n < out.length; n++) out[n] = (rnd() * 2 - 1) * level;
  return out;
}

/** multiply buffer by envelope fn(n, len) */
function shape(b, fn) { for (let n = 0; n < b.length; n++) b[n] *= fn(n, b.length); return b; }

/** mix src into dst at offset (seconds), scaled */
function mixAt(dst, src, atSec, gain = 1) {
  const o = secs(atSec);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
  return dst;
}

/** inharmonic metallic strike (boss shields and plating) */
function metal(dur, base, level = 1) {
  const partials = [1, 2.76, 5.4, 8.93];
  const out = buf(dur);
  for (let p = 0; p < partials.length; p++) {
    const f = base * partials[p];
    if (f > SR * 0.45) continue;
    let ph = rnd() * TAU;
    const g = level / (p + 1.5);
    for (let n = 0; n < out.length; n++) {
      ph += (TAU * f) / SR;
      out[n] += Math.sin(ph) * g * expEnv(n, out.length, 6 + p * 2);
    }
  }
  return out;
}

// ---------- percussion voices ----------
function drumDum(level = 1) { // deep goblet-drum center hit
  const b = sine(0.28, 135, 62, 0.05, level);
  shape(b, (n, l) => adEnv(n, 12, l, 7));
  const slap = lowpass(noise(0.03, level * 0.5), 0.5);
  shape(slap, (n, l) => expEnv(n, l, 9));
  mixAt(b, slap, 0);
  return b;
}
function drumTek(level = 1) { // rim/edge hit
  const b = highpass(noise(0.09, level), 0.35);
  shape(b, (n, l) => expEnv(n, l, 10));
  mixAt(b, shape(sine(0.06, 470, 470, 0.06, level * 0.5), (n, l) => expEnv(n, l, 12)), 0);
  return b;
}
function shaker(level = 1) {
  const b = highpass(noise(0.05, level), 0.75);
  return shape(b, (n, l) => adEnv(n, 40, l, 8));
}
function bassNote(freq, dur, level = 1) { // plucked low string / muted saz
  const out = buf(dur);
  let ph = 0;
  for (let n = 0; n < out.length; n++) {
    ph += (TAU * freq) / SR;
    const saw = 2 * (ph / TAU - Math.floor(ph / TAU + 0.5));
    out[n] = saw * level;
  }
  lowpass(out, 0.09);
  return shape(out, (n, l) => adEnv(n, 8, l, 5.5));
}

// ---------- note table (D hijaz: D Eb F# G A Bb C) ----------
const NF = (semiFromA4) => 440 * Math.pow(2, semiFromA4 / 12);
const D2 = NF(-31), D3 = NF(-19), D4 = NF(-7), D5 = NF(5);
const HIJAZ = [0, 1, 4, 5, 7, 8, 10]; // semitone offsets from tonic
const noteAt = (tonic, deg, oct = 0) =>
  tonic * Math.pow(2, (HIJAZ[((deg % 7) + 7) % 7] + Math.floor(deg / 7) * 12) / 12 + oct);

// ================================================================
// SFX
// ================================================================
const sfx = {};

sfx.uiTap = (() => {
  const b = sine(0.055, 1050, 720, 0.05, 0.5);
  return shape(b, (n, l) => adEnv(n, 6, l, 8));
})();

sfx.shoot = (() => { // bowstring: short bright pluck + air tick
  const b = pluck(210, 0.13, { damp: 0.986, bright: 0.7, level: 0.55 });
  const tick = highpass(noise(0.02, 0.35), 0.5);
  shape(tick, (n, l) => expEnv(n, l, 8));
  return mixAt(b, tick, 0);
})();

sfx.doorGood = (() => { // rising glazed-brick chime: D5 → A5
  const b = buf(0.4);
  mixAt(b, shape(sine(0.3, D5, D5, 0.3, 0.4), (n, l) => expEnv(n, l, 5)), 0);
  mixAt(b, shape(sine(0.32, D5 * 1.5, D5 * 1.5, 0.3, 0.36), (n, l) => expEnv(n, l, 5)), 0.09);
  mixAt(b, shape(sine(0.2, D5 * 3, D5 * 3, 0.2, 0.1), (n, l) => expEnv(n, l, 7)), 0.09);
  return b;
})();

sfx.doorBad = (() => { // sour falling buzz
  const out = buf(0.34);
  let ph1 = 0, ph2 = 0;
  const f0 = noteAt(D3, 1); // Eb3
  for (let n = 0; n < out.length; n++) {
    const t = n / out.length;
    const f = f0 * (1 - 0.22 * t);
    ph1 += (TAU * f) / SR; ph2 += (TAU * f * 1.012) / SR;
    const saw = (p) => 2 * (p / TAU - Math.floor(p / TAU + 0.5));
    out[n] = (saw(ph1) + saw(ph2)) * 0.3;
  }
  lowpass(out, 0.16);
  return shape(out, (n, l) => adEnv(n, 30, l, 4));
})();

sfx.partyGain = (() => { // quick harp gliss up
  const b = buf(0.42);
  mixAt(b, pluck(D4, 0.3, { level: 0.5 }), 0);
  mixAt(b, pluck(noteAt(D4, 3), 0.3, { level: 0.5 }), 0.07);
  mixAt(b, pluck(D5, 0.34, { level: 0.55 }), 0.14);
  return b;
})();

sfx.partyLoss = (() => {
  const b = sine(0.22, 150, 78, 0.09, 0.7);
  shape(b, (n, l) => adEnv(n, 8, l, 6));
  const gr = lowpass(noise(0.14, 0.4), 0.2);
  shape(gr, (n, l) => expEnv(n, l, 6));
  return mixAt(b, gr, 0.01);
})();

sfx.hitTick = (() => {
  const b = highpass(lowpass(noise(0.05, 0.7), 0.6), 0.2);
  return shape(b, (n, l) => expEnv(n, l, 9));
})();

sfx.enemyDie = (() => { // clay husk crunch
  const b = lowpass(noise(0.2, 0.9), 0.35);
  shape(b, (n, l) => expEnv(n, l, 7));
  mixAt(b, shape(sine(0.18, 170, 55, 0.12, 0.6), (n, l) => expEnv(n, l, 6)), 0);
  return b;
})();

sfx.bossHit = (() => {
  const b = sine(0.36, 96, 58, 0.1, 0.85);
  shape(b, (n, l) => adEnv(n, 10, l, 6));
  mixAt(b, metal(0.3, 380, 0.3), 0.005);
  return b;
})();

sfx.shieldClang = (() => {
  const b = metal(0.34, 440, 0.6);
  mixAt(b, shape(highpass(noise(0.04, 0.4), 0.4), (n, l) => expEnv(n, l, 9)), 0);
  return b;
})();

sfx.whoosh = (() => { // near-miss: falling-pitch air
  const out = noise(0.45, 1);
  // sweeping resonant-ish band: lowpass with falling cutoff minus heavier lowpass
  let y1 = 0, y2 = 0;
  for (let n = 0; n < out.length; n++) {
    const t = n / out.length;
    const cut = 0.5 * Math.pow(1 - t, 1.8) + 0.02;
    y1 += cut * (out[n] - y1);
    y2 += cut * 0.35 * (out[n] - y2);
    out[n] = (y1 - y2) * 2.2;
  }
  return shape(out, (n, l) => adEnv(n, 200, l, 3.2));
})();

sfx.breach = (() => { // gate falls: boom + debris crackle + rumble tail
  const b = buf(1.5);
  mixAt(b, shape(sine(1.1, 68, 40, 0.5, 1), (n, l) => adEnv(n, 20, l, 4.5)), 0);
  for (let i = 0; i < 26; i++) {
    const at = 0.08 + rnd() * 0.9;
    const cr = lowpass(noise(0.05 + rnd() * 0.06, 0.5), 0.25 + rnd() * 0.3);
    shape(cr, (n, l) => expEnv(n, l, 8));
    mixAt(b, cr, at, 0.5 * (1 - at / 1.4));
  }
  mixAt(b, shape(lowpass(noise(1.3, 0.5), 0.05), (n, l) => adEnv(n, 400, l, 3)), 0.1);
  for (let n = 0; n < b.length; n++) b[n] = soft(b[n] * 1.2);
  return b;
})();

sfx.bossWake = (() => { // servos grinding awake
  const b = lowpass(noise(0.85, 0.8), 0.08);
  // slow amplitude judder like stone slipping
  for (let n = 0; n < b.length; n++) {
    const t = n / SR;
    b[n] *= 0.55 + 0.45 * Math.sin(TAU * (7 + 5 * t) * t);
  }
  shape(b, (n, l) => adEnv(n, 900, l, 2.5));
  mixAt(b, shape(sine(0.7, 46, 60, 0.7, 0.4), (n, l) => adEnv(n, 800, l, 2.5)), 0.05);
  return b;
})();

sfx.coin = (() => {
  const b = buf(0.14);
  mixAt(b, shape(sine(0.12, 1245, 1245, 0.1, 0.32), (n, l) => expEnv(n, l, 7)), 0);
  mixAt(b, shape(sine(0.1, 1655, 1655, 0.1, 0.26), (n, l) => expEnv(n, l, 7)), 0.02);
  return b;
})();

sfx.starPop = (() => {
  const b = buf(0.2);
  mixAt(b, shape(sine(0.16, 1560, 1980, 0.14, 0.35), (n, l) => expEnv(n, l, 6)), 0);
  mixAt(b, shape(sine(0.12, 2340, 2340, 0.1, 0.18), (n, l) => expEnv(n, l, 8)), 0.03);
  return b;
})();

sfx.upgrade = (() => { // affirming chord pluck D-A-D
  const b = buf(0.5);
  mixAt(b, pluck(D4, 0.45, { level: 0.45 }), 0);
  mixAt(b, pluck(D4 * 1.5, 0.42, { level: 0.4 }), 0.02);
  mixAt(b, pluck(D5, 0.4, { level: 0.42 }), 0.04);
  return b;
})();

sfx.winJingle = (() => { // short victory phrase (results screen)
  const b = buf(1.3);
  const seq = [[0, 0], [0.14, 2], [0.28, 4], [0.42, 7]]; // D F# A D'
  for (const [at, deg] of seq) mixAt(b, pluck(noteAt(D4, deg), 0.7, { level: 0.5 }), at);
  mixAt(b, drumDum(0.9), 0.42);
  mixAt(b, shape(sine(0.7, D5, D5, 0.7, 0.2), (n, l) => adEnv(n, 400, l, 4)), 0.5);
  return b;
})();

sfx.failSting = (() => {
  const b = buf(1.6);
  mixAt(b, pluck(noteAt(D3, 1), 1.0, { level: 0.5, damp: 0.997 }), 0);   // Eb3
  mixAt(b, pluck(D3, 1.2, { level: 0.55, damp: 0.997 }), 0.35);
  mixAt(b, shape(sine(1.2, D2, D2 * 0.94, 1.0, 0.5), (n, l) => adEnv(n, 600, l, 3)), 0.35);
  return b;
})();

// ================================================================
// MUSIC — pattern renderer with seamless wrap-add loops
// ================================================================
/** render events into an exactly-loopable buffer: tails fold back to the start */
function renderLoop(lenSec, events) {
  const N = secs(lenSec);
  const tail = secs(2.5);
  const work = new Float32Array(N + tail);
  for (const [at, b, gain] of events) {
    const o = Math.round(at * SR);
    for (let i = 0; i < b.length && o + i < work.length; i++) work[o + i] += b[i] * (gain ?? 1);
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = work[i];
  for (let i = 0; i < tail; i++) out[i] += work[N + i]; // wrap tails → seamless
  return out;
}

/** drone rendered for exact loop length with slow breathing */
function drone(lenSec, freq, level) {
  const out = buf(lenSec);
  let p1 = 0, p2 = 0;
  const lfoHz = 1 / (lenSec / 2); // integer cycles over the loop → seamless
  for (let n = 0; n < out.length; n++) {
    const t = n / SR;
    p1 += (TAU * freq) / SR;
    p2 += (TAU * freq * 1.5) / SR;
    const breathe = 0.75 + 0.25 * Math.sin(TAU * lfoHz * t);
    out[n] = (Math.sin(p1) + 0.35 * Math.sin(p2)) * level * breathe;
  }
  return out;
}

// ---- title loop: 84 bpm, 8 bars — sparse, vast, pre-dawn ----
const music = {};
{
  const bpm = 84, beat = 60 / bpm, bars = 8, len = bars * 4 * beat;
  const ev = [];
  // lyre phrase, stated twice with variation (degrees in D hijaz, octave 4)
  const phraseA = [[0, 0], [1, 2], [2, 3], [3, 4], [4.5, 3], [6, 1], [8, 0]];
  const phraseB = [[0, 4], [1, 5], [2, 4], [3, 7], [4.5, 4], [6, 2], [7, 1], [8, 0]];
  for (const [phrase, barOff] of [[phraseA, 0], [phraseB, 4]]) {
    for (const [bt, deg] of phrase) {
      const at = (barOff * 4 + bt) * beat;
      ev.push([at, pluck(noteAt(D4, deg), 1.6, { damp: 0.9975, level: 0.34, bright: 0.5 })]);
      ev.push([at + 0.19, pluck(noteAt(D4, deg), 1.2, { damp: 0.997, level: 0.1, bright: 0.4 })]); // echo
    }
  }
  // heartbeat drum on bar starts
  for (let bar = 0; bar < bars; bar++) {
    ev.push([bar * 4 * beat, drumDum(0.5)]);
    if (bar % 2 === 1) ev.push([(bar * 4 + 2.5) * beat, drumTek(0.16)]);
  }
  const b = renderLoop(len, ev);
  const dr = drone(len, D2, 0.16);
  for (let i = 0; i < b.length; i++) b[i] = soft(b[i] + dr[i]);
  music.musicTitle = b;
}

// ---- run loop: 104 bpm, 8 bars — driving maqsum groove ----
{
  const bpm = 104, beat = 60 / bpm, bars = 8, len = bars * 4 * beat;
  const ev = [];
  // maqsum-ish pattern per bar, in eighths: D - T T D - T -
  const patt = [[0, 'D'], [1, 'T'], [1.5, 'T'], [2, 'D'], [3, 'T']];
  for (let bar = 0; bar < bars; bar++) {
    for (const [bt, kind] of patt) {
      const at = (bar * 4 + bt) * beat;
      ev.push([at, kind === 'D' ? drumDum(0.62) : drumTek(0.3)]);
    }
    for (let e = 0; e < 8; e++) if (e % 2 === 1) ev.push([(bar * 4 + e * 0.5) * beat, shaker(0.12)]);
    // bass: tonic pulse with a lift at bar ends
    const bassPatt = bar % 4 === 3 ? [[0, D2], [1, D2], [2, noteAt(D2, 5)], [3, noteAt(D2, 6)]]
                                   : [[0, D2], [1, D2], [2, D2], [2.5, D2], [3, noteAt(D2, 4)]];
    for (const [bt, f] of bassPatt) ev.push([(bar * 4 + bt) * beat, bassNote(f, 0.24, 0.5)]);
  }
  // lyre ostinato: two-bar cell, higher answer in back half
  const cellA = [[0, 0], [0.5, 2], [1, 3], [2, 2], [2.5, 3], [3, 4]];
  const cellB = [[0, 7], [0.5, 5], [1, 4], [2, 3], [2.5, 2], [3, 1]];
  for (let bar = 0; bar < bars; bar++) {
    const cell = bar % 4 < 2 ? cellA : cellB;
    if (bar % 2 === 0) for (const [bt, deg] of cell) {
      ev.push([(bar * 4 + bt) * beat, pluck(noteAt(D4, deg), 0.9, { damp: 0.996, level: 0.27, bright: 0.6 })]);
    }
  }
  const b = renderLoop(len, ev);
  const dr = drone(len, D2, 0.1);
  for (let i = 0; i < b.length; i++) b[i] = soft((b[i] + dr[i]) * 1.05);
  music.musicRun = b;
}

// ---- boss loop: 92 bpm, 8 bars — heavier, half-time, industrial ----
{
  const bpm = 92, beat = 60 / bpm, bars = 8, len = bars * 4 * beat;
  const ev = [];
  for (let bar = 0; bar < bars; bar++) {
    // half-time: the kick lands on 1 and 3 only, so it sits under the fight
    ev.push([(bar * 4 + 0) * beat, drumDum(0.78)]);
    ev.push([(bar * 4 + 2) * beat, drumDum(0.62)]);
    ev.push([(bar * 4 + 3.5) * beat, drumTek(0.34)]);
    if (bar % 2 === 1) ev.push([(bar * 4 + 1.5) * beat, drumTek(0.22)]);
    for (let e = 0; e < 8; e++) if (e % 4 === 2) ev.push([(bar * 4 + e * 0.5) * beat, shaker(0.09)]);
    // bass hammers the tonic, dropping a semitone every fourth bar
    const root = bar % 4 === 3 ? noteAt(D2, -1) : D2;
    for (const bt of [0, 1.5, 2, 3]) ev.push([(bar * 4 + bt) * beat, bassNote(root, 0.3, 0.62)]);
  }
  // a sparse two-note motif, high and cold, answering every other bar
  for (let bar = 1; bar < bars; bar += 2) {
    ev.push([(bar * 4 + 2) * beat, pluck(noteAt(D4, 1), 1.4, { damp: 0.9975, level: 0.22, bright: 0.35 })]);
    ev.push([(bar * 4 + 3) * beat, pluck(noteAt(D4, 0), 1.4, { damp: 0.9975, level: 0.18, bright: 0.3 })]);
  }
  const b = renderLoop(len, ev);
  const dr = drone(len, D2, 0.2);
  for (let i = 0; i < b.length; i++) b[i] = soft((b[i] + dr[i]) * 1.08);
  music.musicBoss = b;
}

// ---- victory sting: 3.2s sunrise flourish ----
{
  const b = buf(3.2);
  const seq = [[0, 0], [0.12, 2], [0.24, 4], [0.36, 5], [0.48, 7], [0.72, 9], [0.96, 11], [1.2, 14]];
  for (const [at, deg] of seq) mixAt(b, pluck(noteAt(D4, deg), 1.6, { level: 0.4, damp: 0.997 }), at);
  mixAt(b, drumDum(0.9), 1.2);
  mixAt(b, drumDum(0.7), 1.65);
  mixAt(b, shape(sine(1.9, D5 * 2, D5 * 2, 1.9, 0.12), (n, l) => adEnv(n, 2000, l, 3.5)), 1.2);
  mixAt(b, drone(1.9, D3, 0.2), 1.2);
  for (let n = 0; n < b.length; n++) b[n] = soft(b[n]);
  music.musicVictory = b;
}

// ================================================================
// pack everything into one WAV + sprite map
// ================================================================
const entries = [];
let cursor = 0;
const gap = Math.round((GAP_MS / 1000) * SR);
const chunks = [];
const loops = new Set(['musicTitle', 'musicRun', 'musicBoss']);

function normalize(b, peak = 0.89) {
  let max = 0;
  for (let i = 0; i < b.length; i++) max = Math.max(max, Math.abs(b[i]));
  if (max > 0) { const g = peak / max; for (let i = 0; i < b.length; i++) b[i] *= g; }
  return b;
}

for (const [name, b] of [...Object.entries(sfx), ...Object.entries(music)]) {
  normalize(b, name.startsWith('music') ? 0.78 : 0.89);
  const startMs = Math.round((cursor / SR) * 1000);
  const durMs = Math.round((b.length / SR) * 1000);
  entries.push([name, startMs, durMs, loops.has(name)]);
  chunks.push(b);
  cursor += b.length + gap;
}

const total = new Float32Array(cursor);
let off = 0;
for (const b of chunks) { total.set(b, off); off += b.length + gap; }

// PCM16 WAV
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

const spriteMap = {};
for (const [name, start, dur, loop] of entries) {
  spriteMap[name] = loop ? [start, dur, true] : [start, dur];
}
writeFileSync(
  join(ROOT, 'src/generated/audio-sprites.json'),
  JSON.stringify({ sprites: spriteMap }, null, 2),
);

console.log(`audio.wav: ${(wav.length / 1024 / 1024).toFixed(2)} MB, ${(cursor / SR).toFixed(1)}s, ${entries.length} sprites`);
for (const [name, start, dur] of entries) console.log(`  ${name.padEnd(14)} @${String(start).padStart(6)}ms  ${dur}ms`);
