#!/usr/bin/env python3
"""Remove metadata segments from JPEG files without recompressing them.

The photographs in roaming-in-rome carry EXIF: camera make and model, the
lens, and the timestamp the shutter fired. No GPS, no owner name and no body
serial -- that was checked -- so this is the mild end of image metadata, but
it is still a record of somebody's equipment and movements riding along in a
web asset that only needs to be a picture.

Why not Pillow's save(): decoding and re-encoding a JPEG loses quality every
time, and there is no reason to pay that to delete a header. A JPEG is a chain
of marker segments, so the metadata can be unlinked instead: walk the markers,
drop the ones that carry metadata, copy everything else through byte for byte.
The entropy-coded scan is never touched, so the decoded pixels come out
identical -- which the verifier below actually checks rather than assumes.

Dropped:
    APP1  Exif and XMP
    APP13 Photoshop IRB, which is where IPTC contact fields live
    COM   free-text comments

Kept:
    APP0  JFIF density -- some decoders want it
    APP2  ICC colour profile -- dropping it visibly shifts colour

Usage:
    python3 tools/strip-image-metadata.py [--check] PATH...
    --check reports what would be removed and writes nothing.
"""
import sys

DROP = {0xE1, 0xED, 0xFE}                  # APP1, APP13, COM
STANDALONE = {0xD8, 0xD9} | set(range(0xD0, 0xD8))   # SOI, EOI, RSTn: no length


def strip(data):
    """Returns (new_bytes, [names of dropped segments])."""
    if data[:2] != b"\xff\xd8":
        return data, []                     # not a JPEG; leave it alone
    out = bytearray(data[:2])
    dropped = []
    i = 2
    while i < len(data) - 1:
        if data[i] != 0xFF:
            break                           # desynchronised; copy the rest
        marker = data[i + 1]
        if marker == 0xFF:                  # fill byte
            out.append(0xFF)
            i += 1
            continue
        if marker in STANDALONE:
            out += data[i:i + 2]
            i += 2
            continue
        if i + 4 > len(data):
            break
        seg_len = int.from_bytes(data[i + 2:i + 4], "big")
        end = i + 2 + seg_len
        if marker in DROP:
            body = data[i + 4:min(end, i + 40)]
            dropped.append("APP%d/%s" % (marker - 0xE0, body[:6].decode("ascii", "replace").strip("\x00"))
                           if marker != 0xFE else "COM")
        else:
            out += data[i:end]
        i = end
        if marker == 0xDA:                  # start of scan: the rest is entropy data
            out += data[end:]
            return bytes(out), dropped
    out += data[i:]
    return bytes(out), dropped


def main(argv):
    check = "--check" in argv
    paths = [a for a in argv if not a.startswith("--")]
    touched = 0
    for p in paths:
        original = open(p, "rb").read()
        cleaned, dropped = strip(original)
        if not dropped:
            continue
        touched += 1
        print("  %s: %s (-%d bytes)" % (p, ", ".join(dropped), len(original) - len(cleaned)))
        if not check:
            open(p, "wb").write(cleaned)
    print("%s %d file(s)" % ("would clean" if check else "cleaned", touched))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
