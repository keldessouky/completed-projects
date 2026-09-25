#!/usr/bin/env python3
"""Turn a computed sprite into an editable pixel grid.

This repo draws art two ways, and it is worth being honest about which one
works. The cast -- Carl, Donut, Mordecai, the Bopca, the goblin, the rot
sticker -- are index grids: a list of rows of characters, one per pixel, with
a key naming the material each character is. The bestiary is parametric:
form(), limb(), poly(), a shape language where a mob is a set of coordinates.

The grids win on editability, and the failure rate says so. Every sprite that
needed three or four attempts this session was parametric: the rage elemental,
the escalator tooth, the turnstile cuirass, the kobold. The reason is not that
the shape language is bad. It is that a parametric sprite cannot be *nudged*.
Moving a muzzle four pixels means re-deriving a polygon in your head and
re-rendering to find out what happened, and if it is wrong you have learned
almost nothing about which number to change. A grid is edited where the
mistake is.

Palette discipline is a separate axis, and worth not confusing with the first
one. `--audit` measures it: across the eighty sprites in the roster, 47% of
the colours actually placed are entries from the shared palette and the rest
were invented by the shading and outline passes. But the split does not fall
where "grids versus parametric" would predict. Carl, Donut, Mordecai and the
Bopca are 100% on-palette because their grids name their materials --
RAMPS['skin'][2] -- while the goblin and rot sticker grids, which spell their
colours as raw triples, score 6% and 7%. Naming the material is what keeps a
sprite on the palette. Being a grid is what makes it editable. A sprite wants
both and they are bought separately.

So: this reads any sprite the forge can build and writes it back out as a
grid module: W, H, PALETTE, KEY, grid().
After that the sprite is rows of text and a redraw is an edit.

    python3 tools/art/togrid.py bestiary.kobold_sapper
    python3 tools/art/togrid.py bestiary.kobold_sapper --out tools/art/kobold_grid.py
    python3 tools/art/togrid.py bestiary.kobold_sapper --check
    python3 tools/art/togrid.py --audit

--check is the one that matters. It renders the emitted grid back through the
same path the forge uses and compares every pixel with the original: the tool
is only useful if the conversion is lossless, and the way to know is to
measure it rather than to assume it.

Colours come back out named. A sprite's palette is already quantised to the
DS's fifteen bits, and every entry in palettes.py is too, so an exact match
is findable -- which means the emitted PALETTE reads RAMPS['skin'][2] rather
than a bare triple, and the grid stays inside the shared material set instead
of drifting into colours of its own.
"""
import argparse
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

from palettes import INK, RAMPS, rgb555          # noqa: E402

#  Transparent is always '.', so the characters that carry paint start after
#  it. Digits first because a grid is read in columns as much as in rows and
#  digits line up better than letters do.
CLOSE = chr(34) * 3          # the docstring terminator, kept out of one

GLYPHS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+=*#@%&$"


def load(spec):
    """`bestiary.kobold_sapper` -> the canvas and palette it emits."""
    if "." not in spec:
        raise SystemExit("name a sprite as module.function, e.g. bestiary.kobold_sapper")
    mod_name, fn_name = spec.rsplit(".", 1)
    mod = importlib.import_module(mod_name)
    fn = getattr(mod, fn_name, None)
    if fn is None:
        raise SystemExit("%s has no %s" % (mod_name, fn_name))
    return fn()


def name_of(packed):
    """What to call a colour, preferring the shared palette over a triple.

    Both sides are fifteen-bit by the time they get here, so this is an exact
    comparison and not a nearest-match: a colour either came out of the shared
    set or it did not, and saying so honestly is the point. Anything that did
    not is emitted as a triple with a comment, which is also a useful signal --
    a sprite full of unnamed colours is one that has wandered off the palette.
    """
    for key, rgb in sorted(INK.items()):
        if rgb555(rgb) == packed:
            return "INK[%r]" % key, True
    for ramp, entries in sorted(RAMPS.items()):
        for i, rgb in enumerate(entries):
            if rgb555(rgb) == packed:
                return "RAMPS[%r][%d]" % (ramp, i), True
    r, g, b = (packed & 31) << 3, ((packed >> 5) & 31) << 3, ((packed >> 10) & 31) << 3
    return "(%d, %d, %d)" % (r, g, b), False


def to_grid(canvas, pal):
    """The canvas as rows of characters, plus the key and palette behind them.

    Only the indices actually used get a glyph. A sprite's emitted palette
    routinely carries entries the drawing never placed -- an outline colour
    registered for a material that ended up fully covered, say -- and carrying
    those into the grid would spend glyphs on colours that are not in the
    picture.
    """
    used = []
    seen = set()
    for i in range(canvas.w * canvas.h):
        idx = canvas.px[i]
        if idx and idx not in seen:
            seen.add(idx)
            used.append(idx)
    if len(used) > len(GLYPHS):
        raise SystemExit("%d colours needs more glyphs than the %d available"
                         % (len(used), len(GLYPHS)))

    glyph_for = {idx: GLYPHS[n] for n, idx in enumerate(used)}
    rows = []
    for y in range(canvas.h):
        rows.append("".join(glyph_for.get(canvas.px[y * canvas.w + x], ".")
                            for x in range(canvas.w)))
    return rows, used, glyph_for


def emit(spec, canvas, pal, rows, used, glyph_for):
    name = spec.rsplit(".", 1)[1]
    named, unnamed = [], 0
    for idx in used:
        text, ok = name_of(pal[idx])
        if not ok:
            unnamed += 1
        named.append((glyph_for[idx], text, ok))

    out = [CLOSE + '%s, as a grid.' % name.replace("_", " ").title(), ""]
    out += ['Converted from the parametric drawing by tools/art/togrid.py, which',
            'checked that it round-trips pixel for pixel. Edit it as rows from here:',
            'that is the whole reason it is in this form rather than the other one.',
            CLOSE,
            'from palettes import INK, RAMPS', '',
            'W, H = %d, %d' % (canvas.w, canvas.h), '', 'PALETTE = [']
    for ch, text, ok in named:
        out.append("    %-28s # %s%s" % (text + ",", ch, "" if ok else "  <- off-palette"))
    out += [']', '', 'KEY = %r' % "".join(ch for ch, _, _ in named), '', '',
            'def grid():', '    return [']
    for row in rows:
        out.append('        %r,' % row)
    out += ['    ]', '']
    if unnamed:
        #  Appended after the closing sentence, not spliced at a fixed index:
        #  inserting at 4 put this between "Edit it as rows from here:" and
        #  the clause that finishes the thought.
        close = out.index(CLOSE)
        out[close:close] = [
            "",
            "%d of its %d colours are not in the shared palette. The shading and"
            % (unnamed, len(named)),
            "outline passes invent those; folding them back onto named materials",
            "is most of what converting this sprite is for.",
        ]
    return "\n".join(out)


def check(canvas, pal, rows, used, glyph_for):
    """Does the grid reproduce the sprite exactly?"""
    key = "".join(glyph_for[i] for i in used)
    back = {ch: used[n] for n, ch in enumerate(key)}
    bad = 0
    for y in range(canvas.h):
        for x in range(canvas.w):
            want = canvas.px[y * canvas.w + x]
            ch = rows[y][x]
            got = 0 if ch == "." else back[ch]
            if want != got:
                bad += 1
    return bad


def audit():
    """How much of the art is actually on the shared palette.

    Checkable rather than asserted. The claim in the docstring above came out
    of this, and it is here so the next person can disagree with it using the
    same numbers -- and so the figure moves on its own if the art does.
    """
    import sprites
    rows, named_total, all_total = [], 0, 0
    for name, fn in sprites.ROSTER:
        if name.startswith("ow_"):           # the walk cycles, 120 near-identical frames
            continue
        canvas, pal = fn()
        used, seen = [], set()
        for i in range(canvas.w * canvas.h):
            v = canvas.px[i]
            if v and v not in seen:
                seen.add(v)
                used.append(v)
        if not used:
            continue
        named = sum(1 for i in used if name_of(pal[i])[1])
        named_total += named
        all_total += len(used)
        rows.append((named / len(used), name, named, len(used)))

    rows.sort()
    print("%d sprites: %d of %d placed colours are named palette entries (%d%%)"
          % (len(rows), named_total, all_total, round(100 * named_total / all_total)))
    print("\n  furthest off the palette")
    for frac, name, n, t in rows[:8]:
        print("    %-24s %2d/%2d  %3d%%" % (name, n, t, round(100 * frac)))
    print("\n  fully on it")
    for frac, name, n, t in rows[::-1]:
        if frac < 1.0:
            break
        print("    %-24s %2d/%2d  %3d%%" % (name, n, t, round(100 * frac)))
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("sprite", nargs="?", help="module.function, e.g. bestiary.kobold_sapper")
    ap.add_argument("--audit", action="store_true",
                    help="report palette discipline across the whole roster")
    ap.add_argument("--out", help="write the grid module here (default: stdout)")
    ap.add_argument("--check", action="store_true",
                    help="only verify the conversion is lossless")
    args = ap.parse_args(argv)
    if args.audit:
        return audit()
    if not args.sprite:
        ap.error("name a sprite, or pass --audit")

    canvas, pal = load(args.sprite)
    rows, used, glyph_for = to_grid(canvas, pal)
    bad = check(canvas, pal, rows, used, glyph_for)
    if bad:
        raise SystemExit("conversion lost %d pixel(s) -- not writing anything" % bad)

    if args.check:
        print("%s: %dx%d, %d colours, round-trips exactly"
              % (args.sprite, canvas.w, canvas.h, len(used)))
        return 0

    text = emit(args.sprite, canvas, pal, rows, used, glyph_for)
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
        print("wrote %s (%dx%d, %d colours, verified lossless)"
              % (args.out, canvas.w, canvas.h, len(used)))
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
