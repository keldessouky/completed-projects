#!/usr/bin/env python3
"""Builds build/Qahira.qpk, the content pack ("ROM") the core loads."""
import os, struct, subprocess, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'build', 'Qahira.qpk')
VERSION = 1
BLENDER_FONTS = '/Applications/Blender.app/Contents/Resources/5.2/datafiles/fonts'


def font(name_in, name_out):
    """OFL fonts that ship inside Blender, converted from WOFF2 to TTF with Google's woff2 tool."""
    dst_dir = os.path.join(ROOT, 'build', 'fonts')
    os.makedirs(dst_dir, exist_ok=True)
    src = os.path.join(BLENDER_FONTS, name_in)
    tmp = os.path.join(dst_dir, name_out.replace('.ttf', '.woff2'))
    ttf = tmp[:-6] + '.ttf'
    if not os.path.exists(ttf) or os.path.getmtime(ttf) < os.path.getmtime(src):
        shutil.copy(src, tmp)
        subprocess.run(['woff2_decompress', tmp], check=True)
    return ttf


def collect():
    entries = []
    gen = os.path.join(ROOT, 'assets', 'generated')
    for sub in ('meshes', 'skel', 'anim', 'audio', 'textures'):
        d = os.path.join(gen, sub)
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                entries.append((sub + '/' + f, os.path.join(d, f)))
    tiles = os.path.join(gen, 'tiles')
    if os.path.isdir(tiles):
        for f in sorted(os.listdir(tiles)):
            entries.append(('data/tiles/' + f, os.path.join(tiles, f)))
    data = os.path.join(ROOT, 'data')
    for dirpath, _, files in os.walk(data):
        for f in sorted(files):
            full = os.path.join(dirpath, f)
            entries.append(('data/' + os.path.relpath(full, data).replace(os.sep, '/'), full))
    entries.append(('fonts/ui.ttf', font('Inter.woff2', 'ui.ttf')))
    entries.append(('fonts/arabic.ttf', font('NotoSansArabic-VariableFont_wdth,wght.woff2', 'arabic.ttf')))
    return entries


def main():
    entries = collect()
    blobs = [open(p, 'rb').read() for _, p in entries]
    header = b'QPK1' + struct.pack('<II', VERSION, len(entries))
    index_size = sum(2 + len(n.encode()) + 16 for n, _ in entries)
    off = len(header) + index_size
    index = b''
    for (name, _), blob in zip(entries, blobs):
        nb = name.encode()
        index += struct.pack('<H', len(nb)) + nb + struct.pack('<QQ', off, len(blob))
        off += len(blob)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(header + index)
        for b in blobs:
            f.write(b)
    print('packed %d entries, %.1f MB -> %s' % (len(entries), off / 1048576, OUT))


if __name__ == '__main__':
    main()
