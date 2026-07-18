// Chiptune synth — a JS port of tools/generate_sfx.py. Instead of shipping
// WAVs, the web build renders every effect and the maqam-hijaz music loop
// into buffers at load time from the same note data. Pure math (node-
// testable); the browser wrapper at the bottom feeds WebAudio.

export const SAMPLE_RATE = 22050;

function square(phase) {
  return phase % 1 < 0.5 ? 1 : -1;
}

function triangle(phase) {
  const p = phase % 1;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

// Deterministic noise (xorshift) so renders are reproducible.
function makeNoise(seed) {
  let s = seed >>> 0 || 2002;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

// events: [start, dur, freqFn|null (null = noise), osc, vol, decayPow]
export function renderEvents(events, length) {
  const n = Math.floor(length * SAMPLE_RATE);
  const buf = new Float32Array(n);
  const noise = makeNoise(2002);
  for (const [start, dur, freqFn, osc, vol, decay] of events) {
    const i0 = Math.floor(start * SAMPLE_RATE);
    const ns = Math.floor(dur * SAMPLE_RATE);
    let phase = 0;
    for (let i = 0; i < ns; i++) {
      const t01 = i / Math.max(1, ns - 1);
      const env = Math.pow(1 - t01, decay);
      let s;
      if (freqFn === null) {
        s = noise();
      } else {
        phase += freqFn(t01) / SAMPLE_RATE;
        s = osc(phase);
      }
      const j = i0 + i;
      if (j >= 0 && j < n) {
        buf[j] += s * vol * env;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    buf[i] = Math.max(-1, Math.min(1, buf[i]));
  }
  return buf;
}

const konst = (f) => () => f;
const sweep = (f0, f1) => (t) => f0 + (f1 - f0) * t;

export const SFX_DEFS = {
  jump: { length: 0.2, events: [[0, 0.18, sweep(240, 700), square, 0.5, 1.6]] },
  coin: {
    length: 0.26,
    events: [
      [0, 0.07, konst(987.77), square, 0.4, 0.8],
      [0.07, 0.16, konst(1318.51), square, 0.4, 1.8],
    ],
  },
  stomp: {
    length: 0.16,
    events: [
      [0, 0.05, null, null, 0.5, 1.2],
      [0, 0.14, sweep(200, 55), square, 0.55, 1.8],
    ],
  },
  hurt: { length: 0.28, events: [[0, 0.26, sweep(392, 130), square, 0.5, 1.2]] },
  powerup: {
    length: 0.375,
    events: [329.63, 349.23, 415.3, 493.88, 659.26].map((f, i) => [
      0.055 * i,
      0.09,
      konst(f),
      square,
      0.4,
      1.0,
    ]),
  },
  bump: { length: 0.1, events: [[0, 0.09, sweep(120, 70), square, 0.5, 1.5]] },
  win: {
    length: 0.9,
    events: (() => {
      const seq = [
        [329.63, 0.12],
        [415.3, 0.12],
        [493.88, 0.12],
        [659.26, 0.42],
      ];
      const ev = [];
      let t = 0;
      for (const [f, d] of seq) {
        ev.push([t, d, konst(f), square, 0.38, 0.9]);
        ev.push([t, d, konst(f / 2), triangle, 0.3, 0.9]);
        t += d;
      }
      return ev;
    })(),
  },
  gameover: {
    length: 1.5,
    events: (() => {
      const seq = [
        [659.26, 0.22],
        [523.25, 0.22],
        [440.0, 0.22],
        [349.23, 0.24],
        [329.63, 0.5],
      ];
      const ev = [];
      let t = 0;
      for (const [f, d] of seq) {
        ev.push([t, d, konst(f), triangle, 0.45, 0.8]);
        t += d;
      }
      return ev;
    })(),
  },
  checkpoint: {
    length: 0.42,
    events: [
      [0, 0.1, konst(440.0), square, 0.35, 0.7],
      [0, 0.1, konst(220.0), triangle, 0.3, 0.7],
      [0.1, 0.28, konst(659.26), square, 0.38, 1.2],
      [0.1, 0.28, konst(329.63), triangle, 0.3, 1.2],
    ],
  },
};

// --- music: maqam hijaz on E, 110 BPM, 8 bars ------------------------------

const NOTE_HZ = {
  E2: 82.41, F2: 87.31, B2: 123.47, C3: 130.81, D3: 146.83,
  E3: 164.81, F3: 174.61, "G#3": 207.65, A3: 220.0, B3: 246.94,
  E4: 329.63, F4: 349.23, "G#4": 415.3, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.26,
};

const MELODY = [
  "E5 D5 C5 B4 C5 B4 A4 G#4",
  "A4 B4 C5 B4 A4 G#4 F4 E4",
  "E4 F4 G#4 A4 B4 C5 D5 E5",
  "D5 C5 B4 A4 G#4 A4 F4 E4",
  "E5 - . E5 D5 C5 B4 C5",
  "D5 - C5 B4 A4 G#4 A4 B4",
  "C5 B4 A4 G#4 F4 G#4 A4 B4",
  "E4 - E4 F4 G#4 A4 B4 E5",
];

const BASS = [
  "E2 E3 E2 E3",
  "F2 F3 E2 B2",
  "E2 E3 A3 E3",
  "F2 F3 B2 E2",
  "E2 E3 E2 E3",
  "F2 F3 E2 B2",
  "A3 E3 F3 E3",
  "F2 B2 E2 E2",
];

export function musicEvents() {
  const bpm = 110;
  const eighth = 60 / bpm / 2;
  const length = 8 * 8 * eighth;
  const ev = [];
  MELODY.forEach((line, bar) => {
    const toks = line.split(/\s+/);
    let i = 0;
    while (i < toks.length) {
      const tok = toks[i];
      if (tok === "." || tok === "-") {
        i += 1;
        continue;
      }
      let dur = 1;
      let j = i + 1;
      while (j < toks.length && toks[j] === "-") {
        dur += 1;
        j += 1;
      }
      ev.push([(bar * 8 + i) * eighth, dur * eighth * 0.92, konst(NOTE_HZ[tok]), square, 0.16, 0.35]);
      i = j;
    }
  });
  BASS.forEach((line, bar) => {
    line.split(/\s+/).forEach((tok, q) => {
      ev.push([(bar * 8 + q * 2) * eighth, eighth * 2 * 0.9, konst(NOTE_HZ[tok]), triangle, 0.22, 0.25]);
    });
  });
  for (let e = 0; e < 64; e++) {
    if (e % 2 === 1) {
      ev.push([e * eighth, 0.03, null, null, 0.07, 2.0]);
    }
  }
  return { events: ev, length };
}

// --- browser wrapper --------------------------------------------------------

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.musicSource = null;
    this.musicBuffer = null;
    this.muted = false;
  }

  /** Must be called from a user gesture. Idempotent. */
  ensure() {
    if (this.ctx || typeof AudioContext === "undefined") {
      return;
    }
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    for (const [name, def] of Object.entries(SFX_DEFS)) {
      this.buffers[name] = this.toBuffer(renderEvents(def.events, def.length));
    }
    const music = musicEvents();
    this.musicBuffer = this.toBuffer(renderEvents(music.events, music.length));
  }

  toBuffer(samples) {
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    return buffer;
  }

  play(name) {
    if (!this.ctx || this.muted || !this.buffers[name]) {
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.ctx.destination);
    src.start();
  }

  startMusic() {
    if (!this.ctx || this.muted || this.musicSource || !this.musicBuffer) {
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    this.musicSource = src;
  }

  stopMusic() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // already stopped
      }
      this.musicSource = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }
}
