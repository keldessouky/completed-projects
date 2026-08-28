#!/usr/bin/env python3
"""Say what a change actually did to the screenshots.

Every art change regenerates thirty-three PNGs across docs/, and until now the
only report on that was `git status` listing which files differ -- which is
every file, every time, because a palette edit touches all of them. That is
not a signal. It cannot tell you that you meant to warm the walls and also
removed the points from somebody's crown.

That is not hypothetical: the top ten rows of Princess Donut were being
cropped off for several commits, in renders I looked directly at, because the
flat gold band left behind looked deliberate. A tool that had said "donut
changed in rows 0-12, nothing else did" would have caught it the first time.

So this compares the working tree's screenshots against a git revision and
reports, per image, how much moved and where. Sorted by how much, because the
one at the top is either what you meant to do or the thing you did not notice.

    python3 tools/shotdiff.py                    # vs HEAD
    python3 tools/shotdiff.py --against HEAD~3
    python3 tools/shotdiff.py --write /tmp/diffs # heat maps of what moved

docs/rom/ is a live emulator run rather than a deterministic render, so a
large number there can be the party standing somewhere else rather than
anything about the art. docs/shots/ is the one to read closely.

Needs Pillow, which is deliberately not a dependency of this repo: nothing
that builds the ROM may require it (see tools/art/png.py, and the README's
claim that everything in the cartridge is made by code in here). This reads
the output, it does not make it, so it is allowed to want a library.
"""
import argparse
import io
import os
import subprocess
import sys

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit("shotdiff needs Pillow:  pip install Pillow\n"
             "(it is a developer tool; the ROM build does not use it)")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ('docs/shots', 'docs/rom', 'docs/art')

#  Paths handed to `git show` are relative to the repository root, which is not
#  necessarily this project's directory -- crawler-ds lives inside a larger
#  repo. Getting this wrong does not error; every file simply reports as new,
#  which looks like a real answer.
_top = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=ROOT,
                      capture_output=True, text=True).stdout.strip()
PREFIX = (os.path.relpath(ROOT, _top) + '/') if _top and os.path.relpath(ROOT, _top) != '.' else ''



def at_revision(rev, path):
    """The committed version of a file, or None if it is not in that tree."""
    r = subprocess.run(['git', 'show', '%s:%s%s' % (rev, PREFIX, path)],
                       cwd=ROOT, capture_output=True)
    return io.BytesIO(r.stdout) if r.returncode == 0 else None


def compare(before, after):
    """Fraction of pixels that differ, and the box they are in.

    Reported as a box rather than a count on purpose: ten percent of pixels
    spread evenly is a palette shift, and ten percent in a band across the top
    is something that has gone missing.
    """
    if before.size != after.size:
        return 1.0, None, 'resized %s -> %s' % (before.size, after.size)
    diff = ImageChops.difference(before.convert('RGB'), after.convert('RGB'))
    box = diff.getbbox()
    if box is None:
        return 0.0, None, ''
    #  Count pixels that actually moved, not just the box they sit in.
    grey = diff.convert('L')
    data = grey.get_flattened_data() if hasattr(grey, 'get_flattened_data') else grey.getdata()
    moved = sum(1 for p in data if p)
    return moved / float(before.size[0] * before.size[1]), box, ''


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--against', default='HEAD', help="git revision to compare with")
    ap.add_argument('--write', default=None, help="write heat maps into this directory")
    ap.add_argument('--quiet-under', type=float, default=0.001,
                    help="ignore changes smaller than this fraction of the image")
    a = ap.parse_args()

    if a.write:
        os.makedirs(a.write, exist_ok=True)

    rows, missing, added = [], [], []
    for d in DIRS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if not name.endswith('.png'):
                continue
            rel = '%s/%s' % (d, name)
            old = at_revision(a.against, rel)
            if old is None:
                added.append(rel)
                continue
            with Image.open(old) as b, Image.open(os.path.join(full, name)) as n:
                frac, box, note = compare(b, n)
                if frac > a.quiet_under:
                    rows.append((frac, rel, box, note))
                if a.write and frac > a.quiet_under and b.size == n.size:
                    hm = ImageChops.difference(b.convert('RGB'), n.convert('RGB'))
                    hm.point(lambda v: min(255, v * 6)).save(
                        os.path.join(a.write, name))

    #  Anything committed that is no longer produced. The screenshot tour has
    #  silently skipped shots before, leaving stale pictures in the docs.
    for d in DIRS:
        r = subprocess.run(['git', 'ls-tree', '--name-only',
                            '%s:%s%s' % (a.against, PREFIX, d)],
                           cwd=ROOT, capture_output=True, text=True)
        for name in r.stdout.split():
            if name.endswith('.png') and not os.path.exists(os.path.join(ROOT, d, name)):
                missing.append('%s/%s' % (d, name))

    rows.sort(reverse=True)
    if not rows and not missing and not added:
        print("  no screenshot changed against %s" % a.against)
        return 0
    print("  against %s:" % a.against)
    for frac, rel, box, note in rows:
        where = note or ('rows %d-%d, cols %d-%d' % (box[1], box[3], box[0], box[2]))
        print("    %5.1f%%  %-34s %s" % (frac * 100, rel, where))
    for rel in added:
        print("      new   %s" % rel)
    for rel in missing:
        print("      GONE  %s  (committed but no longer produced)" % rel)
    if a.write:
        print("  heat maps in %s" % a.write)
    return 0


if __name__ == '__main__':
    sys.exit(main())
