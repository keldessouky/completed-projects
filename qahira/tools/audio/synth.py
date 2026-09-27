"""Synthesises every sound in the game from code: sound effects, the ambience, and music in the maqamat.

Run with any Python that has numpy (Blender's bundled one works):
    /Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13 tools/audio/synth.py
Writes 16-bit mono WAV files into assets/generated/audio/.

Instruments are modal/physical approximations: the oud and qanun are sums of decaying, slightly inharmonic
partials excited by a pluck and coloured by a body impulse response; the ney is a breathy sine with vibrato;
the darbuka's dum is a pitch-dropping membrane and its tek a band of noise.
"""
import os
import sys
import wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'generated', 'audio')
SR = 48000
rng = np.random.default_rng(1)


# ------------------------------------------------------------------ primitives
def t_axis(dur, sr=SR):
    return np.arange(int(dur * sr)) / sr


def env_adsr(n, a, d, s, r, sr=SR):
    e = np.ones(n) * s
    ia, idd, ir = int(a * sr), int(d * sr), int(r * sr)
    ia = max(ia, 1)
    e[:ia] = np.linspace(0, 1, ia)
    e[ia:ia + idd] = np.linspace(1, s, len(e[ia:ia + idd]))
    if ir > 0:
        e[-ir:] *= np.linspace(1, 0, ir)
    return e


def fft_filter(x, lo, hi, sr=SR, soft=0.15):
    """Band-pass with soft edges in the frequency domain."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / sr)
    g = np.ones_like(f)
    if lo > 0:
        g *= 1 / (1 + np.exp(-(f - lo) / (lo * soft + 1)))
    if hi < sr / 2:
        g *= 1 / (1 + np.exp((f - hi) / (hi * soft + 1)))
    return np.fft.irfft(X * g, n)


def conv(x, ir):
    n = len(x) + len(ir) - 1
    N = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]
    return y


def reverb_ir(dur=1.8, sr=SR, bright=0.35):
    t = t_axis(dur, sr)
    n = rng.standard_normal(len(t)) * np.exp(-t * 6.9 / dur)
    n = fft_filter(n, 120, 6000 * bright + 1500, sr)
    n[: int(0.012 * sr)] *= np.linspace(0, 1, int(0.012 * sr))
    return n / np.max(np.abs(n)) * 0.12


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x if m < 1e-9 else x / m * peak


def write(name, x, sr=SR):
    os.makedirs(OUT, exist_ok=True)
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    print('AUDIO %-12s %.2fs' % (name, len(x) / sr))


def noise(n):
    return rng.standard_normal(n)


# ------------------------------------------------------------------ instruments
BODY_IR = None


def body_ir(sr):
    global BODY_IR
    if BODY_IR is None or BODY_IR[0] != sr:
        t = t_axis(0.12, sr)
        ir = np.zeros_like(t)
        for f, d, a in ((105, 18, 1.0), (205, 25, 0.8), (440, 35, 0.5), (980, 60, 0.35), (2200, 90, 0.2)):
            ir += a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
        ir[0] += 3.0
        BODY_IR = (sr, ir / np.sum(np.abs(ir)) * 8)
    return BODY_IR[1]


def pluck(freq, dur, sr, bright=1.0, inharm=0.0004, pos=0.18, decay=1.6):
    t = t_axis(dur, sr)
    y = np.zeros_like(t)
    for n in range(1, 16):
        fn = freq * n * np.sqrt(1 + inharm * n * n)
        if fn > sr / 2 - 500:
            break
        amp = abs(np.sin(np.pi * n * pos)) / n ** (1.25 - 0.25 * bright)
        y += amp * np.sin(2 * np.pi * fn * t + rng.uniform(0, 6)) * np.exp(-t * decay * (1 + 0.35 * (n - 1) ** 1.2))
    click = noise(int(0.004 * sr)) * np.linspace(1, 0, int(0.004 * sr)) * 0.3
    y[: len(click)] += click
    return y


def oud(freq, dur, sr, vel=1.0):
    y = pluck(freq, dur, sr, bright=0.8, decay=1.9)
    y = conv(y, body_ir(sr))[: len(y)]
    return y * vel


def qanun(freq, dur, sr, vel=1.0):
    y = pluck(freq, dur, sr, bright=1.3, decay=1.2, pos=0.12, inharm=0.0002)
    return y * vel * 0.7


def ney(freq, dur, sr, vel=1.0):
    t = t_axis(dur, sr)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(freq * vib) / sr
    y = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    breath = fft_filter(noise(len(t)), freq * 0.8, freq * 4, sr) * 0.35
    e = env_adsr(len(t), 0.12, 0.2, 0.8, min(0.25, dur * 0.4), sr)
    return (y * 0.6 + breath) * e * vel


def dum(sr, vel=1.0):
    t = t_axis(0.45, sr)
    f = 85 + 110 * np.exp(-t * 35)
    y = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 7)
    y += fft_filter(noise(len(t)), 60, 400, sr) * np.exp(-t * 40) * 0.4
    return y * vel


def tek(sr, vel=1.0, hi=True):
    t = t_axis(0.12, sr)
    y = fft_filter(noise(len(t)), 2500 if hi else 700, 9000 if hi else 3500, sr) * np.exp(-t * (55 if hi else 30))
    y += np.sin(2 * np.pi * (420 if hi else 260) * t) * np.exp(-t * 60) * 0.5
    return y * vel


def riq(sr, vel=1.0):
    t = t_axis(0.18, sr)
    y = fft_filter(noise(len(t)), 5000, 12000, sr) * np.exp(-t * 22)
    return y * vel * 0.6


def place(buf, x, at, gain=1.0):
    i = int(at)
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


# ------------------------------------------------------------------ maqamat
def maqam(name, tonic):
    """Scale degrees in cents from the tonic; quarter tones where the maqam has them."""
    cents = {
        'hijaz': [0, 90, 390, 500, 700, 800, 1000, 1200],
        'rast': [0, 200, 350, 500, 700, 900, 1050, 1200],
        'bayati': [0, 150, 300, 500, 700, 800, 1000, 1200],
        'saba': [0, 150, 300, 400, 600, 700, 1000, 1200],
        'kurd': [0, 100, 300, 500, 700, 800, 1000, 1200],
        'nahawand': [0, 200, 300, 500, 700, 800, 1100, 1200],
    }[name]
    return [tonic * 2 ** (c / 1200) for c in cents]


RHYTHMS = {   # (stroke, beat within the 4/4 bar)
    'maqsum': [('D', 0.0), ('T', 0.5), ('T', 1.5), ('D', 2.0), ('T', 3.0)],
    'baladi': [('D', 0.0), ('D', 0.5), ('T', 1.5), ('D', 2.0), ('T', 3.0)],
    'saidi': [('D', 0.0), ('T', 0.5), ('D', 1.5), ('D', 2.0), ('T', 3.0)],
    'ayyub': [('D', 0.0), ('T', 0.75), ('D', 1.0), ('T', 1.5), ('D', 2.0), ('T', 2.75), ('D', 3.0), ('T', 3.5)],
    'wahda': [('D', 0.0), ('T', 2.0), ('T', 3.0)],
}


def compose(name, maq, tonic, bpm, bars, seed, sr=32000, melody_inst='oud', intensity=1.0, rhythm='maqsum', riq_p=0.55):
    r = np.random.default_rng(seed)
    beat = 60 / bpm
    total = bars * 4 * beat
    n = int(total * sr)
    mel = np.zeros(n)
    perc = np.zeros(n)
    drone = np.zeros(n)
    scale = maqam(maq, tonic)
    # drone: low tonic and fifth on the oud every two bars, and a soft ney pad
    for b in range(0, bars, 2):
        at = b * 4 * beat * sr
        place(drone, oud(tonic / 2, 4 * beat * 2, sr, 0.5), at)
        place(drone, oud(tonic / 2 * 1.5, 4 * beat * 2, sr, 0.25), at + beat * sr * 2)
    # the rhythm (maqsum by default: dum tek . tek dum . tek .)
    pattern = RHYTHMS[rhythm]
    for b in range(bars):
        for kind, off in pattern:
            at = (b * 4 + off) * beat * sr
            if kind == 'D':
                place(perc, dum(sr, 0.9), at)
            else:
                place(perc, tek(sr, 0.5), at)
        for k in range(8):
            if r.random() < riq_p:
                place(perc, riq(sr, 0.25 + 0.15 * r.random()), (b * 4 + k * 0.5 + 0.25) * beat * sr)
        if intensity > 1.0:  # the boss: doubled dums and a driving riq
            for off in (1.0, 2.5, 3.5):
                place(perc, dum(sr, 0.6 * (intensity - 0.4)), (b * 4 + off) * beat * sr)
            for k in range(16):
                place(perc, riq(sr, 0.18 + 0.1 * (k % 4 == 0)), (b * 4 + k * 0.25) * beat * sr)
        if b % 4 == 3:  # fill
            for k in range(4):
                place(perc, tek(sr, 0.4, hi=bool(k % 2)), (b * 4 + 3 + k * 0.25) * beat * sr)
    # melody: phrases that climb and fall through the jins and cadence on the tonic, fourth or fifth
    idx = 0
    t = 0.0
    phrase_end = 4 * beat * 2
    inst = {'oud': oud, 'qanun': qanun, 'ney': ney}[melody_inst]
    while t < total - beat:
        if t >= phrase_end:
            target = r.choice([0, 3, 4, 7])
            while idx != target:
                idx += 1 if target > idx else -1
                place(mel, inst(scale[idx], beat * 1.5, sr, 0.7), t * sr)
                t += beat / 2
            place(mel, inst(scale[idx], beat * 3, sr, 0.9), t * sr)
            t += beat * r.choice([2, 3])
            phrase_end = t + 4 * beat * r.choice([1, 2])
            continue
        step = r.choice([-2, -1, -1, 1, 1, 2, 0], p=[0.08, 0.26, 0.1, 0.26, 0.12, 0.08, 0.1])
        idx = int(np.clip(idx + step, 0, 7))
        dur = r.choice([0.25, 0.5, 0.5, 1.0, 1.5]) * beat
        vel = 0.55 + 0.35 * r.random()
        place(mel, inst(scale[idx], max(dur * 2, 0.5), sr, vel), t * sr)
        if dur <= 0.25 * beat and r.random() < 0.5:  # tremolo on short notes, as on a qanun
            place(mel, inst(scale[idx], 0.4, sr, vel * 0.6), (t + dur / 2) * sr)
        t += dur
    # a ney line in the second half, an octave up, slow
    for b in range(bars // 2, bars, 2):
        deg = int(r.choice([0, 2, 3, 4, 5]))
        place(mel, ney(scale[deg] * 2, 4 * beat * 1.8, sr, 0.35), b * 4 * beat * sr)
    mix = mel * 0.55 + perc * 0.45 + drone * 0.35
    rev = conv(mix, reverb_ir(2.2, sr, 0.3))[:n]
    mix = mix * 0.8 + rev * 0.6
    # loop seam: crossfade the tail into the head
    fade = int(0.5 * sr)
    mix[:fade] = mix[:fade] * np.linspace(0, 1, fade) + mix[-fade:] * np.linspace(1, 0, fade)
    mix = mix[:n - fade]
    write(name, norm(mix, 0.75), sr)


# ------------------------------------------------------------------ sound effects
def sfx():
    s = SR
    # whoosh of a heavy swing
    t = t_axis(0.35)
    sweep = np.exp(-((t - 0.15) / 0.08) ** 2)
    x = noise(len(t))
    x = fft_filter(x, 300, 2500) * sweep
    write('swing', norm(x, 0.6))
    # heavy impact: low thump, crunch
    t = t_axis(0.5)
    thump = np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-t * 30)) / s) * np.exp(-t * 9)
    crunch = fft_filter(noise(len(t)), 800, 5000) * np.exp(-t * 25)
    write('impact', norm(thump + crunch * 0.5, 0.85))
    # slam: bigger thump, debris, rumble
    t = t_axis(1.2)
    thump = np.sin(2 * np.pi * np.cumsum(45 + 80 * np.exp(-t * 20)) / s) * np.exp(-t * 5)
    debris = fft_filter(noise(len(t)), 1500, 7000) * (np.exp(-t * 6) * (rng.random(len(t)) < 0.02) * 6 + np.exp(-t * 18))
    rumble = fft_filter(noise(len(t)), 30, 180) * np.exp(-t * 3) * 1.5
    x = thump * 1.2 + debris * 0.4 + rumble
    x = x + conv(x, reverb_ir(0.8))[:len(x)] * 0.5
    write('slam', norm(x, 0.9))
    # aftershock: rolling eruption
    t = t_axis(1.6)
    x = fft_filter(noise(len(t)), 25, 260) * (1 - np.exp(-t * 12)) * np.exp(-t * 2.2) * 2
    for k in range(6):
        place(x, fft_filter(noise(int(0.2 * s)), 900, 6000) * np.exp(-t_axis(0.2) * 20) * 0.5, (0.05 + k * 0.12) * s)
    write('aftershock', norm(x, 0.9))
    # crit: bright metallic ring
    t = t_axis(0.7)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) * a for f, d, a in ((1240, 7, 1), (1985, 9, 0.6), (3110, 12, 0.4), (4720, 16, 0.25)))
    write('crit', norm(x, 0.45))
    # flesh hit
    t = t_axis(0.22)
    x = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 8) + 60) / s) * np.exp(-t * 25) + fft_filter(noise(len(t)), 400, 2500) * np.exp(-t * 40) * 0.6
    write('hit', norm(x, 0.6))
    # hero takes a hit: cloth and a dull knock
    t = t_axis(0.3)
    x = np.sin(2 * np.pi * np.cumsum(90 + 40 * np.exp(-t * 20)) / s) * np.exp(-t * 14) + fft_filter(noise(len(t)), 200, 1400) * np.exp(-t * 20) * 0.5
    write('hero_hit', norm(x, 0.7))
    # ghoul hiss
    t = t_axis(0.8)
    x = fft_filter(noise(len(t)), 2500, 7000) * env_adsr(len(t), 0.05, 0.2, 0.6, 0.4)
    x *= 1 + 0.5 * np.sin(2 * np.pi * 14 * t)
    write('ghoul_hiss', norm(x, 0.35))
    # ghoul crumbles to grave dust: granular crackle decaying
    t = t_axis(1.3)
    grains = (rng.random(len(t)) < 0.004 * np.exp(-t * 2.5)).astype(float)
    x = conv(grains, fft_filter(noise(int(0.01 * s)), 1500, 8000))[:len(t)] * 1.5
    x += fft_filter(noise(len(t)), 200, 1500) * np.exp(-t * 4) * 0.4
    write('ghoul_die', norm(x, 0.55))
    # bile spit and splash
    t = t_axis(0.35)
    f = 900 * np.exp(-t * 6) + 250
    x = fft_filter(noise(len(t)), 500, 3000) * np.exp(-t * 10) + np.sin(2 * np.pi * np.cumsum(f) / s) * np.exp(-t * 14) * 0.4
    write('spit', norm(x, 0.5))
    t = t_axis(0.5)
    x = fft_filter(noise(len(t)), 600, 4000) * np.exp(-t * 9) * (1 + 0.8 * np.sin(2 * np.pi * 30 * t))
    write('splash', norm(x, 0.5))
    # warcry: a growling brass-like roar
    t = t_axis(1.0)
    f0 = 95 + 25 * np.sin(np.pi * np.clip(t / 0.9, 0, 1))
    ph = 2 * np.pi * np.cumsum(f0) / s
    saw = sum(np.sin(k * ph) / k for k in range(1, 30))
    x = fft_filter(saw, 150, 1800) * env_adsr(len(t), 0.06, 0.2, 0.85, 0.35)
    x += fft_filter(noise(len(t)), 300, 2500) * env_adsr(len(t), 0.02, 0.2, 0.3, 0.3) * 0.4
    x = x + conv(x, reverb_ir(1.0))[:len(x)] * 0.6
    write('warcry', norm(x, 0.8))
    # dodge
    t = t_axis(0.3)
    x = fft_filter(noise(len(t)), 250, 1500) * np.exp(-((t - 0.1) / 0.07) ** 2)
    write('dodge', norm(x, 0.45))
    # pickup: brass chime
    t = t_axis(0.9)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((880, 5), (1320, 6), (2210, 9)))
    x[int(0.08 * s):] += sum(np.sin(2 * np.pi * f * t[: len(t) - int(0.08 * s)]) * np.exp(-t[: len(t) - int(0.08 * s)] * d) for f, d in ((1175, 5), (1760, 7)))
    write('pickup', norm(x, 0.4))
    # drink
    t = t_axis(0.6)
    x = np.zeros(len(t))
    for k in range(4):
        tt = t_axis(0.12)
        g = np.sin(2 * np.pi * np.cumsum(300 + 400 * tt / 0.12) / s) * np.exp(-tt * 25)
        place(x, g, (0.05 + k * 0.12) * s, 0.6)
    write('drink', norm(x, 0.5))
    # break: a crack and a low boom
    t = t_axis(0.8)
    x = fft_filter(noise(len(t)), 2000, 9000) * np.exp(-t * 35) + np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-t * 10)) / s) * np.exp(-t * 5)
    write('break', norm(x, 0.75))
    # level up: an ascending Hijaz run on the oud with shimmer
    x = np.zeros(int(2.2 * s))
    for k, f in enumerate(maqam('hijaz', 293.66)):
        place(x, oud(f, 1.2, s, 0.8), k * 0.09 * s)
    shimmer = sum(np.sin(2 * np.pi * f * t_axis(2.2)) for f in (1174.7, 1760, 2349)) * np.exp(-t_axis(2.2) * 2) * 0.15
    write('levelup', norm(x + shimmer, 0.6))
    # UI tick
    t = t_axis(0.06)
    write('ui_move', norm(np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 80), 0.25))
    t = t_axis(0.15)
    write('ui_select', norm(np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 30) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 40) * 0.5, 0.35))


def sfx_slice2():
    s = SR
    r = np.random.default_rng(21)
    # portal: a rising, breathy shimmer
    t = t_axis(1.4)
    f = 300 + 900 * t / 1.4
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * k) / s) / k for k in (1, 1.5, 2.01, 3.02))
    air = fft_filter(noise(len(t)), 800, 7000) * 0.5
    x = (tone * 0.4 + air) * env_adsr(len(t), 0.3, 0.3, 0.7, 0.6)
    write('portal', norm(x + conv(x, reverb_ir(1.5, s, 0.5))[:len(x)] * 0.6, 0.6))
    # dinars: a handful of small coin clinks
    x = np.zeros(int(0.5 * s))
    for k in range(5):
        tt = t_axis(0.25)
        f0 = r.uniform(3200, 5200)
        clink = sum(np.sin(2 * np.pi * f0 * m * tt) * np.exp(-tt * (30 + 10 * m)) for m in (1, 1.47, 2.09)) * 0.3
        place(x, clink, (0.02 + k * r.uniform(0.04, 0.08)) * s)
    write('gold', norm(x, 0.45))
    # currency: a glass bead's clear ding
    t = t_axis(0.9)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((1568, 5), (2350, 7), (3920, 10))) * 0.3
    write('currency', norm(x + conv(x, reverb_ir(1.2, s, 0.6))[:len(x)] * 0.4, 0.5))
    # craft: a bright, short chime with a touch of sparkle
    t = t_axis(0.6)
    x = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 9) + np.sin(2 * np.pi * 1975.5 * t) * np.exp(-t * 12) * 0.6
    x += fft_filter(noise(len(t)), 5000, 11000) * np.exp(-t * 20) * 0.3
    write('craft', norm(x, 0.5))
    # sell: coins into a palm
    x = np.zeros(int(0.6 * s))
    for k in range(8):
        tt = t_axis(0.2)
        f0 = r.uniform(2600, 4600)
        place(x, np.sin(2 * np.pi * f0 * tt) * np.exp(-tt * 40) * 0.25, (k * 0.035 + r.uniform(0, 0.02)) * s)
    write('sell', norm(x, 0.45))
    # inventory full: a dull wooden knock
    t = t_axis(0.25)
    x = np.sin(2 * np.pi * np.cumsum(180 - 60 * t) / s) * np.exp(-t * 25) + fft_filter(noise(len(t)), 200, 1200) * np.exp(-t * 40) * 0.4
    write('inv_full', norm(x, 0.45))
    # chest: a wooden creak and a warm chime
    t = t_axis(1.1)
    creak = np.sin(2 * np.pi * np.cumsum(120 + 60 * np.sin(2 * np.pi * 7 * t)) / s) * np.sign(np.sin(2 * np.pi * 31 * t)) * env_adsr(len(t), 0.05, 0.2, 0.5, 0.3)
    creak = fft_filter(creak, 200, 2500) * 0.4
    chime = np.zeros(len(t))
    for k, f in enumerate((587.3, 740, 880, 1174.7)):
        place(chime, np.sin(2 * np.pi * f * t_axis(0.7)) * np.exp(-t_axis(0.7) * 5) * 0.25, (0.45 + k * 0.06) * s)
    write('chest', norm(creak + chime, 0.55))
    # the wail: a screeching, wavering howl with formants
    t = t_axis(1.8)
    f = 520 + 180 * np.sin(2 * np.pi * 5.5 * t) + 300 * t
    voice = np.sign(np.sin(2 * np.pi * np.cumsum(f) / s)) * 0.5 + fft_filter(noise(len(t)), 1800, 5000) * 0.6
    voice = fft_filter(voice, 700, 4200) * env_adsr(len(t), 0.25, 0.3, 0.8, 0.5)
    write('boss_wail', norm(voice + conv(voice, reverb_ir(2.0, s, 0.4))[:len(voice)] * 0.7, 0.7))
    # the leap: a rushing whoosh upward
    t = t_axis(0.7)
    x = fft_filter(noise(len(t)), 300, 3000) * np.sin(np.pi * t / 0.7) ** 2
    write('boss_leap', norm(x, 0.55))
    # summon: ground rumbling open
    t = t_axis(1.6)
    x = fft_filter(noise(len(t)), 30, 220) * env_adsr(len(t), 0.4, 0.4, 0.8, 0.6) + fft_filter(noise(len(t)), 1500, 5000) * np.exp(-((t - 1.0) * 6) ** 2) * 0.3
    write('summon', norm(x, 0.75))


def sfx_slice3():
    """The Sorcerer's spells: three casts (fire, cold, lightning), their hits, the glyph and the falling star."""
    s = SR
    # fire cast: a breathy rush that ignites into a crackle
    t = t_axis(0.5)
    whoosh = fft_filter(noise(len(t)), 400, 3500) * np.sin(np.pi * np.clip(t / 0.35, 0, 1)) ** 2
    crackle = fft_filter(noise(len(t)), 2500, 8000) * (np.random.default_rng(3).random(len(t)) > 0.985) * 3
    write('cast_fire', norm((whoosh + crackle * np.exp(-t * 6)) * env_adsr(len(t), 0.02, 0.1, 0.8, 0.2), 0.5))
    # cold cast: glassy partials sweeping down, with a frosty hiss
    t = t_axis(0.7)
    f = 2400 - 900 * t
    glass = sum(np.sin(2 * np.pi * np.cumsum(f * m) / s) * np.exp(-t * (4 + 2 * m)) / m for m in (1, 1.51, 2.37))
    hiss = fft_filter(noise(len(t)), 5000, 12000) * np.exp(-t * 5) * 0.4
    write('cast_cold', norm(glass * 0.4 + hiss, 0.45))
    # lightning cast: a snap and a buzzing crackle
    t = t_axis(0.45)
    buzz = np.sign(np.sin(2 * np.pi * 110 * t + 3 * np.sin(2 * np.pi * 37 * t))) * 0.3
    snap = fft_filter(noise(len(t)), 1500, 9000) * np.exp(-t * 18)
    write('cast_lightning', norm((fft_filter(buzz, 200, 5000) * np.exp(-t * 7) + snap), 0.5))
    # fire hit: a soft thump into a burst of flame
    t = t_axis(0.45)
    thump = np.sin(2 * np.pi * np.cumsum(140 - 80 * t) / s) * np.exp(-t * 16)
    flame = fft_filter(noise(len(t)), 300, 2500) * np.exp(-t * 7) * 0.7
    write('fire_hit', norm(thump + flame, 0.55))
    # lightning hit: a sharp crack with a short tail
    t = t_axis(0.35)
    crack = fft_filter(noise(len(t)), 900, 10000) * np.exp(-t * 26) + np.sign(np.sin(2 * np.pi * 60 * t)) * np.exp(-t * 14) * 0.2
    write('lightning_hit', norm(crack, 0.5))
    # frozen: ice crystallising, a bright crunch and ringing
    t = t_axis(0.8)
    crunch = fft_filter(noise(len(t)), 3000, 11000) * np.exp(-t * 12)
    ring_ = sum(np.sin(2 * np.pi * f0 * t) * np.exp(-t * d) for f0, d in ((3136, 6), (4186, 8), (5274, 10))) * 0.2
    write('frozen', norm(crunch + ring_, 0.45))
    # glyph: a low hum with an airy shimmer, like a struck bowl
    t = t_axis(1.2)
    bowl = sum(np.sin(2 * np.pi * f0 * t + 0.3 * np.sin(2 * np.pi * 4 * t)) * np.exp(-t * d) for f0, d in ((392, 2.2), (587.3, 3), (933, 4)))
    air = fft_filter(noise(len(t)), 4000, 10000) * env_adsr(len(t), 0.1, 0.3, 0.3, 0.6) * 0.2
    x = bowl * 0.35 + air
    write('glyph', norm(x + conv(x, reverb_ir(1.4, s, 0.5))[:len(x)] * 0.5, 0.45))
    # falling star: a descending whistle, then a deep impact with debris
    t = t_axis(1.4)
    f = 3000 * np.exp(-t * 3.5) + 200
    whistle = np.sin(2 * np.pi * np.cumsum(f) / s) * np.clip(1 - t / 0.55, 0, 1) * 0.3
    hit_t = np.clip(t - 0.55, 0, None)
    boom = np.sin(2 * np.pi * np.cumsum(70 - 30 * hit_t) / s) * np.exp(-hit_t * 4) * (t > 0.55)
    debris = fft_filter(noise(len(t)), 200, 3000) * np.exp(-hit_t * 5) * (t > 0.55) * 0.6
    x = whistle + boom + debris
    write('star_fall', norm(x + conv(x, reverb_ir(1.6, s, 0.35))[:len(x)] * 0.4, 0.8))


def ambience_necro(name, dur=40.0, sr=32000):
    """The Qarafa at night: wind between tomb walls, crickets, a far dog, the city a murmur away."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(9)
    wind = fft_filter(noise(len(t)), 150, 900, sr) * (0.5 + 0.35 * np.sin(2 * np.pi * t / 9) + 0.15 * np.sin(2 * np.pi * t / 3.7))
    city = fft_filter(noise(len(t)), 40, 220, sr) * 0.25
    x = wind * 0.6 + city
    for k in range(int(dur * 2)):  # crickets: short chirp trains
        at = r.uniform(0, dur - 0.5)
        f = r.uniform(3900, 4600)
        tt = t_axis(0.18, sr)
        chirp = np.sin(2 * np.pi * f * tt) * (np.sin(2 * np.pi * 45 * tt) > 0) * np.exp(-tt * 8) * r.uniform(0.01, 0.03)
        place(x, chirp, at * sr)
    for k in range(3):  # a far dog
        at = r.uniform(2, dur - 3)
        for j in range(r.integers(2, 4)):
            tt = t_axis(0.22, sr)
            bark = fft_filter(np.sign(np.sin(2 * np.pi * np.cumsum(420 - 200 * tt) / sr)) + noise(len(tt)) * 0.5, 300, 1400, sr)
            place(x, bark * np.exp(-tt * 12) * 0.05, (at + j * 0.35) * sr)
    x = x + conv(x, reverb_ir(3.0, sr, 0.15))[:len(x)] * 0.6
    fade = int(1.0 * sr)
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:len(x) - fade]
    write(name, norm(x, 0.45), sr)


def ambience(name, dur=40.0, sr=32000):
    """Cairo at night from a side street: traffic hum, distant horns, a dog, murmur."""
    t = t_axis(dur, sr)
    hum = fft_filter(noise(len(t)), 40, 400, sr) * (0.6 + 0.2 * np.sin(2 * np.pi * t / 13))
    air = fft_filter(noise(len(t)), 1500, 6000, sr) * 0.05
    x = hum + air
    r = np.random.default_rng(5)
    for k in range(10):  # distant car horns, two-tone, heavily filtered
        at = r.uniform(0, dur - 1.5)
        hd = r.uniform(0.15, 0.6)
        tt = t_axis(hd, sr)
        f = r.choice([370, 410, 440, 466])
        horn = (np.sign(np.sin(2 * np.pi * f * tt)) + np.sign(np.sin(2 * np.pi * f * 1.26 * tt))) * env_adsr(len(tt), 0.01, 0.05, 0.9, 0.05, sr)
        horn = fft_filter(horn, 300, 1500, sr) * r.uniform(0.04, 0.1)
        place(x, horn, at * sr)
        if r.random() < 0.5:
            place(x, horn * 0.8, (at + hd + 0.12) * sr)
    x = x + conv(x, reverb_ir(2.5, sr, 0.2))[:len(x)] * 0.8
    fade = int(1.0 * sr)
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:len(x) - fade]
    write(name, norm(x, 0.5), sr)


def sfx_slice4():
    """Act I's voices: what each kind of thing sounds like when it dies."""
    s = SR
    r = np.random.default_rng(44)
    # spark: a short crackle of arcing current and a falling hum
    t = t_axis(0.7)
    crack = np.zeros(len(t))
    for k in range(14):
        tt = t_axis(0.02)
        place(crack, fft_filter(noise(len(tt)), 2000, 9000) * np.exp(-tt * 200) * r.uniform(0.3, 1.0), r.uniform(0, 0.35) * s)
    hum = np.sign(np.sin(2 * np.pi * np.cumsum(120 - 80 * t) / s)) * np.exp(-t * 5) * 0.25
    write('spark_die', norm(crack + fft_filter(hum, 60, 1200), 0.6))
    # metal: a crumpling bang, glass, and a long groan of sheet steel
    t = t_axis(1.6)
    bang = fft_filter(noise(len(t)), 60, 900) * np.exp(-t * 9)
    groan = np.sin(2 * np.pi * np.cumsum(90 + 30 * np.sin(2 * np.pi * 3 * t)) / s) * env_adsr(len(t), 0.1, 0.3, 0.6, 0.8) * 0.35
    glass = np.zeros(len(t))
    for k in range(10):
        tt = t_axis(0.12)
        place(glass, np.sin(2 * np.pi * r.uniform(3000, 6500) * tt) * np.exp(-tt * 40) * 0.25, r.uniform(0.05, 0.5) * s)
    x = bang + fft_filter(groan, 50, 800) + glass
    write('metal_die', norm(x + conv(x, reverb_ir(1.4, s, 0.3))[:len(x)] * 0.4, 0.7))
    # whisper: a breathy exhalation that falls apart into many voices
    t = t_axis(1.2)
    x = np.zeros(len(t))
    for k in range(5):
        f_lo = r.uniform(900, 1400)
        br = fft_filter(noise(len(t)), f_lo, f_lo * 2.5) * env_adsr(len(t), 0.05 + 0.05 * k, 0.3, 0.5, 0.6)
        place(x, br * 0.3, k * 0.04 * s)
    write('whisper_die', norm(x + conv(x, reverb_ir(1.8, s, 0.5))[:len(x)] * 0.6, 0.5))
    # howl: a dog's yelp turning into a long falling howl
    t = t_axis(1.1)
    f = 700 * np.exp(-t * 1.2) + 220
    v = np.sin(2 * np.pi * np.cumsum(f) / s) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / s) + fft_filter(noise(len(t)), 500, 3000) * 0.2
    write('howl_die', norm(fft_filter(v, 150, 3500) * env_adsr(len(t), 0.01, 0.2, 0.6, 0.6), 0.6))
    # fire: a roar collapsing into crackling embers
    t = t_axis(1.8)
    roar = fft_filter(noise(len(t)), 80, 1200) * env_adsr(len(t), 0.02, 0.4, 0.4, 1.0)
    embers = np.zeros(len(t))
    for k in range(30):
        tt = t_axis(0.015)
        place(embers, fft_filter(noise(len(tt)), 2500, 8000) * np.exp(-tt * 300) * r.uniform(0.2, 0.6), r.uniform(0.2, 1.7) * s)
    x = roar + embers
    write('fire_die', norm(x + conv(x, reverb_ir(1.5, s, 0.3))[:len(x)] * 0.4, 0.7))


def ambience_metro(name, dur=40.0, sr=32000):
    """Under Tahrir: the tunnel's low roar, a buzzing tube light, water dripping, a train that never arrives."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(17)
    roar = fft_filter(noise(len(t)), 25, 180, sr) * (0.7 + 0.3 * np.sin(2 * np.pi * t / 11))
    buzz = (np.sin(2 * np.pi * 100 * t) + 0.5 * np.sin(2 * np.pi * 200 * t) + 0.25 * np.sign(np.sin(2 * np.pi * 50 * t))) * 0.012
    buzz *= 0.6 + 0.4 * (np.sin(2 * np.pi * t / 5.3) > -0.7)   # the tube flickers
    x = roar * 0.7 + buzz
    for k in range(int(dur * 0.9)):   # drips, each one a short falling tone
        at = r.uniform(0, dur - 0.3)
        tt = t_axis(0.12, sr)
        f0 = r.uniform(900, 1600)
        drip = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.8 * np.exp(-tt * 40))) / sr) * np.exp(-tt * 35) * r.uniform(0.03, 0.07)
        place(x, drip, at * sr)
    for at in (9.0, 27.0):   # a far train: a swell of rumble and rail squeal, then nothing
        tt = t_axis(7.0, sr)
        sw = np.sin(np.pi * tt / 7.0) ** 2
        rum = fft_filter(noise(len(tt)), 30, 300, sr) * sw * 0.9
        sq = np.sin(2 * np.pi * np.cumsum(2400 + 300 * np.sin(2 * np.pi * tt * 0.7)) / sr) * sw ** 3 * 0.02
        place(x, rum + sq, at * sr)
    x = x + conv(x, reverb_ir(3.5, sr, 0.1))[:len(x)] * 0.9
    fade = int(1.0 * sr)
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:len(x) - fade]
    write(name, norm(x, 0.45), sr)


def ambience_cliffs(name, dur=40.0, sr=32000):
    """The Mokattam quarries: high wind over the cut stone, pebbles falling, the city far below, a howl."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(23)
    gust = 0.45 + 0.35 * np.sin(2 * np.pi * t / 7.1) + 0.2 * np.sin(2 * np.pi * t / 2.3 + 1)
    wind = fft_filter(noise(len(t)), 250, 2200, sr) * gust
    whistle = np.sin(2 * np.pi * np.cumsum(620 + 90 * np.sin(2 * np.pi * t / 5)) / sr) * np.clip(gust - 0.6, 0, 1) * 0.04
    city = fft_filter(noise(len(t)), 30, 160, sr) * 0.3
    x = wind * 0.55 + whistle + city
    for k in range(int(dur * 0.4)):   # pebbles skittering down the quarry face
        at = r.uniform(0, dur - 1)
        for j in range(r.integers(3, 7)):
            tt = t_axis(0.03, sr)
            place(x, fft_filter(noise(len(tt)), 1500, 6000, sr) * np.exp(-tt * 120) * r.uniform(0.05, 0.12), (at + j * r.uniform(0.05, 0.14)) * sr)
    for at in (13.0, 31.0):   # something howls on the far ridge
        tt = t_axis(2.2, sr)
        f = 330 + 140 * np.sin(np.pi * tt / 2.2) ** 0.7
        howl = np.sin(2 * np.pi * np.cumsum(f) / sr) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / sr)
        place(x, fft_filter(howl, 200, 1600, sr) * np.sin(np.pi * tt / 2.2) ** 2 * 0.05, at * sr)
    x = x + conv(x, reverb_ir(2.5, sr, 0.25))[:len(x)] * 0.6
    fade = int(1.0 * sr)
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:len(x) - fade]
    write(name, norm(x, 0.45), sr)


def _loop_fade(x, sr):
    fade = int(1.0 * sr)
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    return x[:len(x) - fade]


def ambience_river(name, dur=40.0, sr=32000):
    """The Nile at night: water lapping on the bank, frogs in the cane, crickets, a rope creaking on a mooring post."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(29)
    lap = fft_filter(noise(len(t)), 80, 900, sr) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 3.1) ** 2) * 0.5
    crick = np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 18 * t) > 0.6) * (np.sin(2 * np.pi * t / 1.7) > -0.2) * 0.006
    x = lap + crick
    for k in range(int(dur * 1.2)):   # frogs: short croaks, a low buzz with a falling edge
        at = r.uniform(0, dur - 0.4)
        tt = t_axis(r.uniform(0.12, 0.25), sr)
        f0 = r.uniform(180, 320)
        cro = np.sign(np.sin(2 * np.pi * f0 * tt)) * np.exp(-tt * 14) * (1 - np.exp(-tt * 200))
        place(x, fft_filter(cro, 150, 1400, sr) * r.uniform(0.02, 0.05), at * sr)
    for at in (6.0, 19.0, 33.0):   # a mooring rope creaks as the felucca rolls
        tt = t_axis(0.8, sr)
        f = 140 + 60 * np.sin(np.pi * tt / 0.8)
        cr = np.sign(np.sin(2 * np.pi * np.cumsum(f) / sr)) * np.sin(np.pi * tt / 0.8) ** 2
        place(x, fft_filter(cr, 300, 2400, sr) * 0.025, at * sr)
    x = x + conv(x, reverb_ir(2.0, sr, 0.3))[:len(x)] * 0.4
    write(name, norm(_loop_fade(x, sr), 0.45), sr)


def ambience_temple(name, dur=40.0, sr=32000):
    """Karnak and the Valley: a deep wind moving between stone columns, sand hissing across paving, an owl, far stone."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(37)
    gust = 0.5 + 0.3 * np.sin(2 * np.pi * t / 9.3) + 0.2 * np.sin(2 * np.pi * t / 3.7 + 2)
    wind = fft_filter(noise(len(t)), 60, 700, sr) * gust
    moan = np.sin(2 * np.pi * np.cumsum(96 + 12 * np.sin(2 * np.pi * t / 6)) / sr) * np.clip(gust - 0.55, 0, 1) * 0.08
    hiss = fft_filter(noise(len(t)), 3000, 9000, sr) * np.clip(gust - 0.5, 0, 1) * 0.12
    x = wind * 0.6 + moan + hiss
    for at in (8.0, 26.0):   # an owl, twice
        for j, d in enumerate((0.0, 0.5, 0.75)):
            tt = t_axis(0.35, sr)
            f = 420 - 60 * tt / 0.35
            place(x, np.sin(2 * np.pi * np.cumsum(f) / sr) * np.sin(np.pi * tt / 0.35) ** 2 * 0.03, (at + d) * sr)
    for at in (15.0, 34.0):   # stone grinding on stone, somewhere in the dark
        tt = t_axis(1.6, sr)
        place(x, fft_filter(noise(len(tt)), 40, 400, sr) * np.sin(np.pi * tt / 1.6) ** 2 * 0.35, at * sr)
    x = x + conv(x, reverb_ir(4.0, sr, 0.15))[:len(x)] * 0.8
    write(name, norm(_loop_fade(x, sr), 0.45), sr)


def ambience_tomb(name, dur=40.0, sr=32000):
    """Under the Valley: nearly nothing. A low drone of the rock, sand trickling, a breath that is not yours."""
    t = t_axis(dur, sr)
    r = np.random.default_rng(41)
    drone = fft_filter(noise(len(t)), 20, 90, sr) * 0.6 + np.sin(2 * np.pi * 55 * t) * 0.01
    x = drone
    for k in range(int(dur * 0.5)):   # sand trickling from a crack
        at = r.uniform(0, dur - 2)
        tt = t_axis(r.uniform(0.6, 1.8), sr)
        place(x, fft_filter(noise(len(tt)), 2000, 7000, sr) * np.sin(np.pi * tt / tt[-1]) ** 2 * r.uniform(0.02, 0.05), at * sr)
    for at in (12.0, 29.0):   # a long exhale, from the direction of the pit
        tt = t_axis(3.0, sr)
        place(x, fft_filter(noise(len(tt)), 150, 900, sr) * np.sin(np.pi * tt / 3.0) ** 3 * 0.25, at * sr)
    x = x + conv(x, reverb_ir(5.0, sr, 0.08))[:len(x)] * 1.0
    write(name, norm(_loop_fade(x, sr), 0.4), sr)


def music_act2():
    """Act II, Upper Egypt: the Sa'idi rhythm of the south, and slower music below ground."""
    compose('mus_nile', 'rast', 130.81, 96, 24, seed=71, melody_inst='ney', rhythm='saidi')
    compose('mus_village', 'bayati', 146.83, 112, 24, seed=73, melody_inst='qanun', rhythm='saidi', riq_p=0.7)
    compose('mus_karnak', 'nahawand', 110.0, 70, 16, seed=79, melody_inst='ney', rhythm='wahda', riq_p=0.15)
    compose('mus_tomb', 'saba', 110.0, 64, 16, seed=83, melody_inst='oud', rhythm='wahda', riq_p=0.1, intensity=0.8)


def music_act1():
    """Act I: one piece per region, each in its own maqam and rhythm."""
    compose('mus_downtown', 'rast', 146.83, 108, 24, seed=41, melody_inst='qanun', rhythm='baladi')
    compose('mus_metro', 'kurd', 110.0, 76, 16, seed=43, melody_inst='ney', rhythm='wahda', riq_p=0.2)
    compose('mus_khan', 'bayati', 146.83, 100, 24, seed=47, rhythm='maqsum')
    compose('mus_muizz', 'hijaz', 130.81, 90, 20, seed=53, melody_inst='qanun', rhythm='saidi')
    compose('mus_mokattam', 'saba', 146.83, 118, 24, seed=59, rhythm='saidi', intensity=1.2)
    compose('mus_trial', 'hijaz', 146.83, 136, 32, seed=61, rhythm='ayyub', intensity=1.5)


if __name__ == '__main__':
    only = sys.argv[1:] or ['sfx', 'music', 'ambience']
    if 'sfx' in only:
        sfx()
        sfx_slice2()
        sfx_slice3()
        sfx_slice4()
    if 'ambience' in only:
        ambience('amb_street')
        ambience_necro('amb_necro')
        ambience_metro('amb_metro')
        ambience_cliffs('amb_cliffs')
    if 'act1' in only:
        sfx_slice4()
        ambience_metro('amb_metro')
        ambience_cliffs('amb_cliffs')
        music_act1()
    if 'act2' in only or 'ambience' in only:
        ambience_river('amb_river')
        ambience_temple('amb_temple')
        ambience_tomb('amb_tomb')
    if 'act2' in only or 'music' in only:
        music_act2()
    if 'music' in only:
        compose('mus_hijaz', 'hijaz', 146.83, 96, 24, seed=11)
        compose('mus_saba', 'saba', 130.81, 72, 20, seed=23, melody_inst='qanun')
        compose('mus_boss', 'kurd', 146.83, 128, 32, seed=31, intensity=1.6)
        music_act1()
