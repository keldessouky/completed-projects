"""Colour ramps for the sprite forge.

Everything the game draws is built from short ramps: a base hue lit from the
upper left and shaded into shadow, which is what gives the cast a single light
source without anybody hand-picking pixels.
"""


def clamp(v):
    return max(0, min(255, int(round(v))))


def ramp(base, steps=4, lighten=0.55, darken=0.45):
    """A ramp from shadow to highlight around `base`, darkest first."""
    r, g, b = base
    out = []
    for i in range(steps):
        t = i / (steps - 1) if steps > 1 else 0.5
        if t < 0.5:
            k = 1.0 - darken * (1.0 - t * 2)
            out.append((clamp(r * k), clamp(g * k), clamp(b * k)))
        else:
            k = (t - 0.5) * 2
            out.append((clamp(r + (255 - r) * lighten * k),
                        clamp(g + (255 - g) * lighten * k),
                        clamp(b + (255 - b) * lighten * k)))
    return out


def rgb555(c):
    r, g, b = c
    return 0x8000 | ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3)


# The game's fixed UI colours, in the System's own taste: black glass, amber
# type, a hot magenta for anything the show wants you to look at.
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
