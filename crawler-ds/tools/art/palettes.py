"""Colour for the sprite forge.

The single biggest difference between pixel art that reads as drawn and pixel
art that reads as generated is what happens inside a ramp. Scaling a colour's
brightness up and down gives you five shades of the same plastic. Real ramps
move in hue as well as value: shadows drift toward the ambient light (cool,
blue), highlights drift toward the key light (warm, yellow), and the middle of
the ramp is the most saturated part of it.

Everything the cast is drawn with comes out of `ramp()` below, so the whole game
is lit by the same two lights.
"""

# The two lights every ramp is built between.
AMBIENT = (46, 58, 116)      # cool bounce, the colour shadows fall toward
KEY = (255, 240, 198)        # warm key light, the colour highlights climb to


def clamp(v):
    return max(0, min(255, int(round(v))))


def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))


def saturate(c, amount):
    """Pushes a colour away from its own grey, which keeps mid-tones from going
    muddy as they darken."""
    grey = (c[0] * 30 + c[1] * 59 + c[2] * 11) / 100.0
    return tuple(clamp(grey + (c[i] - grey) * amount) for i in range(3))


def ramp(base, steps=5, dark=0.62, light=0.42, cool=0.30, warm=0.26):
    """A lit ramp for one material, darkest first.

    `dark`/`light` are how far the ends travel in value; `cool`/`warm` are how
    far they travel in hue, toward AMBIENT and KEY respectively.
    """
    out = []
    for i in range(steps):
        t = i / (steps - 1) if steps > 1 else 0.5
        if t < 0.5:
            k = (0.5 - t) * 2.0                      # 1.0 at the darkest step
            c = tuple(base[j] * (1.0 - dark * k) for j in range(3))
            c = mix(c, AMBIENT, cool * k * 0.55)
            c = saturate(c, 1.0 + 0.30 * k)
        else:
            k = (t - 0.5) * 2.0                      # 1.0 at the brightest step
            c = tuple(base[j] + (255 - base[j]) * light * k for j in range(3))
            c = mix(c, KEY, warm * k * 0.5)
            c = saturate(c, 1.0 - 0.18 * k)
        out.append(tuple(clamp(v) for v in c))
    return out


def outline_for(base):
    """The colour a shape is drawn against: its own hue, taken almost to black
    and cooled off. Far better than a uniform black key line."""
    c = tuple(base[i] * 0.20 for i in range(3))
    return mix(c, AMBIENT, 0.35)


def rim_for(base):
    """A cool backlight for the edge that faces away from the key.

    Kept close to the material: a rim that travels too far toward white stops
    looking like light and starts looking like chrome trim.
    """
    lifted = tuple(clamp(base[i] + (255 - base[i]) * 0.30) for i in range(3))
    return mix(lifted, (140, 190, 255), 0.34)


def rgb555(c):
    r, g, b = c
    return 0x8000 | ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3)


# The System's own chrome: black glass, amber type, hot magenta for anything the
# show wants you looking at. Shared with src/render/theme.h.
UI = {
    'void':      (8, 8, 12),
    'panel':     (18, 20, 30),
    'panel_lit': (30, 34, 48),
    'edge':      (64, 72, 96),
    'ink':       (232, 226, 210),
    'dim':       (140, 140, 152),
    'amber':     (255, 186, 62),
    'amber_dk':  (150, 96, 20),
    'magenta':   (255, 64, 160),
    'cyan':      (86, 220, 232),
    'green':     (110, 220, 120),
    'red':       (232, 68, 68),
    'blood':     (128, 24, 32),
    'gold':      (250, 208, 80),
    'stone':     (92, 88, 96),
    'stone_dk':  (48, 46, 54),
    'dirt':      (74, 60, 46),
}
