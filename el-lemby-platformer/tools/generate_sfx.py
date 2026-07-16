#!/usr/bin/env python3
"""
Chiptune SFX + music generator for «اللمبي: مغامرات الحارة».

Writes 16-bit mono WAVs into Sources/ElLembyCore/Resources/sfx/ and music/.
The music loop is written in maqam hijaz on E (E F G# A B C D) for an
Egyptian shaabi flavor on top of plain square/triangle chip voices.

Pure stdlib. Run from the project root:  python3 tools/generate_sfx.py
"""

import math
import os
import random
import struct
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(ROOT, "Sources", "ElLembyCore", "Resources", "sfx")
MUSIC_DIR = os.path.join(ROOT, "Sources", "ElLembyCore", "Resources", "music")

SR = 22050

# ---------------------------------------------------------------------------
# Synth primitives
# ---------------------------------------------------------------------------

def square(phase: float, duty: float = 0.5) -> float:
    return 1.0 if (phase % 1.0) < duty else -1.0


def triangle(phase: float) -> float:
    p = phase % 1.0
    return 4.0 * p - 1.0 if p < 0.5 else 3.0 - 4.0 * p


_rng = random.Random(2002)


def render(events, length: float):
    """events: list of (start, dur, freq_fn(t01)->Hz|None for noise, wave, vol, decay_pow)"""
    n = int(length * SR)
    buf = [0.0] * n
    for (start, dur, freq_fn, osc, vol, decay) in events:
        i0 = int(start * SR)
        ns = int(dur * SR)
        phase = 0.0
        for i in range(ns):
            t01 = i / max(1, ns - 1)
            env = (1.0 - t01) ** decay
            if freq_fn is None:
                s = _rng.uniform(-1.0, 1.0)
            else:
                f = freq_fn(t01)
                phase += f / SR
                s = osc(phase)
            j = i0 + i
            if 0 <= j < n:
                buf[j] += s * vol * env
    return buf


def write_wav(path: str, buf) -> None:
    frames = bytearray()
    for s in buf:
        s = max(-1.0, min(1.0, s))
        frames += struct.pack("<h", int(s * 32000))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(frames))


def const(f):
    return lambda t: f


def sweep(f0, f1):
    return lambda t: f0 + (f1 - f0) * t


# ---------------------------------------------------------------------------
# Sound effects
# ---------------------------------------------------------------------------

def sfx_jump():
    return render([(0.0, 0.18, sweep(240, 700), square, 0.5, 1.6)], 0.2)


def sfx_coin():
    return render([
        (0.00, 0.07, const(987.77), square, 0.4, 0.8),
        (0.07, 0.16, const(1318.51), square, 0.4, 1.8),
    ], 0.26)


def sfx_stomp():
    return render([
        (0.0, 0.05, None, None, 0.5, 1.2),
        (0.0, 0.14, sweep(200, 55), square, 0.55, 1.8),
    ], 0.16)


def sfx_hurt():
    return render([
        (0.0, 0.26, sweep(392, 130), square, 0.5, 1.2),
    ], 0.28)


def sfx_powerup():
    ev = []
    notes = [329.63, 349.23, 415.30, 493.88, 659.26]   # E F G# B E — hijaz sweep up
    for i, f in enumerate(notes):
        ev.append((0.055 * i, 0.09, const(f), square, 0.4, 1.0))
    return render(ev, 0.055 * len(notes) + 0.1)


def sfx_bump():
    return render([(0.0, 0.09, sweep(120, 70), square, 0.5, 1.5)], 0.1)


def sfx_win():
    ev = []
    seq = [(329.63, 0.12), (415.30, 0.12), (493.88, 0.12), (659.26, 0.42)]
    t = 0.0
    for f, d in seq:
        ev.append((t, d, const(f), square, 0.38, 0.9))
        ev.append((t, d, const(f / 2), triangle, 0.3, 0.9))
        t += d
    return render(ev, t + 0.12)


def sfx_gameover():
    ev = []
    seq = [(659.26, 0.22), (523.25, 0.22), (440.0, 0.22), (349.23, 0.24), (329.63, 0.5)]
    t = 0.0
    for f, d in seq:
        ev.append((t, d, const(f), triangle, 0.45, 0.8))
        t += d
    return render(ev, t + 0.1)


# ---------------------------------------------------------------------------
# Music — maqam hijaz on E, 110 BPM, 8 bars, loopable
# ---------------------------------------------------------------------------

N = {
    "E2": 82.41, "F2": 87.31, "B2": 123.47, "C3": 130.81, "D3": 146.83,
    "E3": 164.81, "F3": 174.61, "G#3": 207.65, "A3": 220.0, "B3": 246.94,
    "E4": 329.63, "F4": 349.23, "G#4": 415.30, "A4": 440.0, "B4": 493.88,
    "C5": 523.25, "D5": 587.33, "E5": 659.26,
}

MELODY = [  # 8 bars × 8 eighths; "." = rest, "-" = tie (extend previous)
    "E5 D5 C5 B4 C5 B4 A4 G#4",
    "A4 B4 C5 B4 A4 G#4 F4 E4",
    "E4 F4 G#4 A4 B4 C5 D5 E5",
    "D5 C5 B4 A4 G#4 A4 F4 E4",
    "E5 - . E5 D5 C5 B4 C5",
    "D5 - C5 B4 A4 G#4 A4 B4",
    "C5 B4 A4 G#4 F4 G#4 A4 B4",
    "E4 - E4 F4 G#4 A4 B4 E5",
]

BASS = [  # 8 bars × 4 quarters
    "E2 E3 E2 E3",
    "F2 F3 E2 B2",
    "E2 E3 A3 E3",
    "F2 F3 B2 E2",
    "E2 E3 E2 E3",
    "F2 F3 E2 B2",
    "A3 E3 F3 E3",
    "F2 B2 E2 E2",
]


def music_loop():
    bpm = 110.0
    eighth = 60.0 / bpm / 2.0
    length = 8 * 8 * eighth
    ev = []
    # melody — square, slightly detached notes
    for bar, line in enumerate(MELODY):
        toks = line.split()
        assert len(toks) == 8, f"melody bar {bar} has {len(toks)} tokens"
        i = 0
        while i < len(toks):
            tok = toks[i]
            if tok == ".":
                i += 1
                continue
            if tok == "-":
                i += 1
                continue
            dur = 1
            j = i + 1
            while j < len(toks) and toks[j] == "-":
                dur += 1
                j += 1
            start = (bar * 8 + i) * eighth
            ev.append((start, dur * eighth * 0.92, const(N[tok]), square, 0.16, 0.35))
            i = j
    # bass — triangle quarters
    for bar, line in enumerate(BASS):
        toks = line.split()
        assert len(toks) == 4, f"bass bar {bar} has {len(toks)} tokens"
        for q, tok in enumerate(toks):
            start = (bar * 8 + q * 2) * eighth
            ev.append((start, eighth * 2 * 0.9, const(N[tok]), triangle, 0.22, 0.25))
    # hat — noise ticks on the off-eighths
    for e in range(8 * 8):
        if e % 2 == 1:
            ev.append((e * eighth, 0.03, None, None, 0.07, 2.0))
    return render(ev, length)


# ---------------------------------------------------------------------------

def main():
    os.makedirs(SFX_DIR, exist_ok=True)
    os.makedirs(MUSIC_DIR, exist_ok=True)
    out = {
        "jump.wav": sfx_jump(),
        "coin.wav": sfx_coin(),
        "stomp.wav": sfx_stomp(),
        "hurt.wav": sfx_hurt(),
        "powerup.wav": sfx_powerup(),
        "bump.wav": sfx_bump(),
        "win.wav": sfx_win(),
        "gameover.wav": sfx_gameover(),
    }
    for name, buf in out.items():
        write_wav(os.path.join(SFX_DIR, name), buf)
        print(f"wrote sfx/{name} ({len(buf) / SR:.2f}s)")
    m = music_loop()
    write_wav(os.path.join(MUSIC_DIR, "harah_loop.wav"), m)
    print(f"wrote music/harah_loop.wav ({len(m) / SR:.2f}s)")


if __name__ == "__main__":
    main()
