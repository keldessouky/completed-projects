"""The game's colour, as a fixed set of hand-picked ramps.

This used to compute every ramp: take a base colour, push one end toward a
cool ambient and the other toward a warm key, and hope the middle stayed
saturated. That is a reasonable way to get a lit ramp out of nothing, and it
is why the cast never quite matched -- a computed ramp is correct in
isolation and arbitrary next to the ramp beside it. Two materials that should
have been kin came out related only by accident, and nothing in the game had
a colour it shared with anything else.

So none of it is computed now. Every ramp below is chosen, darkest first,
with the hue turning as it climbs the way a painter turns it: shadows toward
blue or toward the material's own brown, midtones the most saturated part,
highlights warming without washing out. A sprite picks ramps by name. Two
sprites that pick the same name are the same material, in the literal sense
that they are the same bytes.

Everything the game draws comes out of this file, which is what makes a floor,
a crawler standing on it and the panel around them look like one object.
"""

def _hex(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def _ramp(*hexes):
    return [_hex(h) for h in hexes]


#  The lines a shape is drawn against. Never pure black: black is a hole in
#  the screen, and a shape outlined in its own hue reads as an object with an
#  edge instead of a sticker.
INK = {
    'ink':   _hex('#24232A'),
    'dark':  _hex('#302D35'),
    'brown': _hex('#3D3030'),
    'green': _hex('#29372E'),
    'blue':  _hex('#263742'),
    'warm':  _hex('#493B3A'),      # a shadow, not a line
    'cool':  _hex('#3A4148'),
}

RAMPS = {
    # ---- skin -----------------------------------------------------------
    'skin':      _ramp('#633F3C', '#8A5950', '#B97968', '#D79A7D', '#E9B795', '#F0C8A5'),
    'tan':       _ramp('#714A35', '#A66D48', '#CE9163'),

    # ---- hair -----------------------------------------------------------
    'hair_brown':  _ramp('#392A27', '#5A3C30', '#7D5139', '#A16B45'),
    'hair_blonde': _ramp('#6F542C', '#A27C38', '#D0A84D', '#E8CB70'),
    'hair_red':    _ramp('#542D29', '#823A2F', '#B74D36', '#D66A45'),
    'hair_blue':   _ramp('#283C55', '#385C7E', '#4F7FA6', '#75A5C3'),
    'hair_silver': _ramp('#62656A', '#96999A', '#C5C5BE', '#E5E0D3'),

    # ---- clothing -------------------------------------------------------
    'cloth_cream':  _ramp('#4A4745', '#77736C', '#B5B0A3', '#DDD7C7', '#F0E9D7'),
    'cloth_black':  _ramp('#202229', '#30323A', '#464850', '#62646A'),
    'cloth_red':    _ramp('#54272B', '#813337', '#B64345', '#D65C54', '#E47A68'),
    'cloth_blue':   _ramp('#25354A', '#304B67', '#3D6688', '#5286AA', '#76A8C2'),
    'cloth_green':  _ramp('#26382D', '#385338', '#4D7042', '#68934D', '#89AD5D'),
    'cloth_purple': _ramp('#352C45', '#514064', '#6D4F82', '#906B9E'),

    # ---- metal ----------------------------------------------------------
    'steel':  _ramp('#34383C', '#50565A', '#737A7C', '#A3A7A3', '#D0CDC0'),
    'gold':   _ramp('#604820', '#8A6829', '#B28A35', '#D0A94B', '#E5C86A'),
    'copper': _ramp('#613B2D', '#895039', '#B56B48', '#D08A5B'),

    # ---- wood -----------------------------------------------------------
    'wood_dark': _ramp('#35251F', '#51372A', '#704833', '#8D5D3D'),
    'wood':      _ramp('#5B3826', '#805033', '#A86D42', '#C38A55', '#D8A66C'),

    # ---- environment ----------------------------------------------------
    'stone':         _ramp('#383A3B', '#505252', '#686A68', '#858681', '#A5A397'),
    'stone_ancient': _ramp('#403E39', '#5D574C', '#797263', '#989080', '#B3A78F'),
    'grass':         _ramp('#263B29', '#38552F', '#4D7138', '#689344', '#85AA51'),
    'leaves':        _ramp('#21402A', '#326039', '#4A7D45', '#679850', '#88AE60'),
    'water':         _ramp('#203F50', '#2E6075', '#3E8297', '#58A6B7', '#79C2C7'),
    'sand':          _ramp('#5F4B31', '#80653D', '#A5844E', '#C2A365', '#DCC080', '#E9D49A'),
    'snow':          _ramp('#626A70', '#8A9699', '#B7C1BF', '#D9DED6', '#F0EFE5'),
    'ice':           _ramp('#416D80', '#5E96A8', '#80BBC5', '#A9D6D7', '#D2E9DF'),

    # ---- effects --------------------------------------------------------
    'fire':      _ramp('#542628', '#8D3029', '#C54227', '#E7612E', '#F18C35', '#F4BC4C', '#F8DF79'),
    'arcane':    _ramp('#33254A', '#563D78', '#7653A0', '#9973C1', '#C09BD7'),
    'holy':      _ramp('#79672F', '#B29B3E', '#D4C05B', '#E9DD91', '#F5F0C8'),
    'poison':    _ramp('#293B28', '#3F6635', '#629344', '#88B94E', '#B3D765'),
    'lightning': _ramp('#59607C', '#7E8BB0', '#AAB8D0', '#D9E2E7', '#FFF7C2'),
    'blood':     _ramp('#3A2025', '#63252B', '#8D3035', '#B8403D', '#D55A48'),

    #  Smoke that is a thing rather than an effect. 'arcane' is a lit violet
    #  -- a spell, something a caster is proud of. This is the other kind:
    #  soot with a colour in it, dark enough that its top step is still
    #  darker than most ramps' bottom, so a body built from it reads as an
    #  absence with edges. Nothing else in the set covers that; 'cloth_black'
    #  is neutral and 'cloth_purple' is a garment.
    'smoke_violet': _ramp('#17131D', '#241C2E', '#342843', '#473658', '#5D4A6E', '#7A6588'),
}

#  Which line each ramp is drawn against. A green thing outlined in the blue
#  ink reads as cut out of the scene; outlined in the green ink it reads as
#  the dark side of itself.
_INK_FOR = {
    'grass': 'green', 'leaves': 'green', 'poison': 'green', 'cloth_green': 'green',
    'water': 'blue', 'ice': 'blue', 'snow': 'blue', 'lightning': 'blue',
    'cloth_blue': 'blue', 'hair_blue': 'blue', 'steel': 'blue',
    'skin': 'brown', 'tan': 'brown', 'wood': 'brown', 'wood_dark': 'brown',
    'sand': 'brown', 'copper': 'brown', 'hair_brown': 'brown', 'blood': 'brown',
    'stone': 'dark', 'stone_ancient': 'dark', 'cloth_black': 'dark',
    'smoke_violet': 'ink',
}


def clamp(v):
    return max(0, min(255, int(round(v))))


def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _hsl(c):
    r, g, b = (v / 255.0 for v in c)
    mx, mn = max(r, g, b), min(r, g, b)
    lum = (mx + mn) / 2.0
    d = mx - mn
    if d == 0:
        return 0.0, 0.0, lum
    sat = d / (2.0 - mx - mn) if lum > 0.5 else d / (mx + mn)
    if mx == r:
        hue = ((g - b) / d) % 6.0
    elif mx == g:
        hue = (b - r) / d + 2.0
    else:
        hue = (r - g) / d + 4.0
    return hue * 60.0, sat, lum


def nearest_ramp(base):
    """The curated ramp a loose RGB belongs to.

    Sprites across this repo name their colours as literal RGB triples, which
    was the only option while every ramp was computed on the spot. Rather than
    rewrite three thousand lines of drawing to name materials, a triple is
    matched to the ramp it belongs to and the drawing keeps its meaning: a
    brown boot still asks for brown and now gets *the* brown. Where the
    identity actually matters -- the cast, the panel, the walls -- the drawing
    names its material outright and never comes through here.

    Matching happens in hue, saturation and lightness rather than in RGB,
    against every entry of every ramp. Plain RGB distance sends each dark
    colour to whichever ramp has the darkest bottom step, which put a navy
    pair of boxer shorts in with pond water. Hue is weighted by how much
    colour the two actually have, so near-greys are settled on lightness
    instead of on a hue angle neither of them means.
    """
    bh, bs, bl = _hsl(base)
    best, best_d = None, 1e18
    for name, entries in RAMPS.items():
        for c in entries:
            h, sat, lum = _hsl(c)
            dh = abs(bh - h)
            dh = min(dh, 360.0 - dh)
            chroma = min(bs, sat)
            d = (dh * chroma * 2.2) ** 2
            d += ((bs - sat) * 260.0) ** 2
            d += ((bl - lum) * 90.0) ** 2
            if d < best_d:
                best, best_d = name, d
    return best


def resample(ramp, steps):
    """A curated ramp at a different length, keeping both ends.

    Interpolating between the two entries either side of each step rather
    than picking the nearest: a five-entry ramp asked for seven should get two
    new colours on the line the artist drew, not two duplicates.
    """
    if steps <= 1:
        return [ramp[len(ramp) // 2]]
    if steps == len(ramp):
        return list(ramp)
    out = []
    for i in range(steps):
        t = i * (len(ramp) - 1) / (steps - 1)
        lo = int(t)
        hi = min(lo + 1, len(ramp) - 1)
        out.append(mix(ramp[lo], ramp[hi], t - lo))
    return out


def ramp(base, steps=5, name=None, **_ignored):
    """A material's shades, darkest first.

    `name` picks a curated ramp outright. Without one the base RGB is matched
    to the ramp it belongs to, which is how the drawing code that predates
    this file keeps working and still ends up on the new palette.
    """
    key = name if name in RAMPS else nearest_ramp(base)
    return resample(RAMPS[key], steps)


def outline_for(base, name=None):
    """The line a material is drawn against: one of seven inks, chosen for its
    family, never black and never computed per sprite."""
    key = name if name in RAMPS else nearest_ramp(base)
    return INK[_INK_FOR.get(key, 'ink')]


def rim_for(base, name=None):
    """A cool backlight for the edge facing away from the key.

    Taken from the top of the material's own ramp and turned toward the cool
    ink's opposite, so a rim stays a lit edge of the thing rather than
    becoming chrome trim on it.
    """
    key = name if name in RAMPS else nearest_ramp(base)
    top = RAMPS[key][-1]
    return mix(top, (168, 206, 232), 0.42)


def rgb555(c):
    r, g, b = c
    return 0x8000 | ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3)


#  The System's own chrome. Black glass and amber type, drawn from the UI set
#  so the panel around the game is the same palette as the game in it.
UI = {
    'void':      _hex('#202329'),
    'panel':     _hex('#343840'),
    'panel_lit': _hex('#50555B'),
    'edge':      _hex('#777A78'),
    'ink':       _hex('#F0E6C9'),
    'dim':       _hex('#B7AD94'),
    'amber':     _hex('#E0C66A'),
    'amber_dk':  _hex('#C39B43'),
    'magenta':   _hex('#906B9E'),
    'cyan':      _hex('#58A6B7'),
    'green':     _hex('#89AD5D'),
    'red':       _hex('#B8403D'),
    'blood':     _hex('#63252B'),
    'gold':      _hex('#D0A94B'),
    'stone':     _hex('#686A68'),
    'stone_dk':  _hex('#383A3B'),
    'dirt':      _hex('#51372A'),
}
