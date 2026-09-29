#!/usr/bin/env python3
"""Builds build/Qahira.qpk, the content pack ("ROM") the core loads."""
import os, struct, subprocess, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'build', 'Qahira.qpk')
VERSION = 1


def blender_fonts():
    """Blender's bundled OFL fonts: $BLENDER_FONTS, the Mac app, or the `bpy` module's datafiles."""
    import glob
    cands = [os.environ.get('BLENDER_FONTS', '')]
    cands += sorted(glob.glob('/Applications/Blender.app/Contents/Resources/*/datafiles/fonts'), reverse=True)
    try:
        import importlib.util
        spec = importlib.util.find_spec('bpy')
        if spec and spec.submodule_search_locations:
            for loc in spec.submodule_search_locations:
                cands += sorted(glob.glob(os.path.join(loc, '*', 'datafiles', 'fonts')), reverse=True)
    except Exception:
        pass
    cands += sorted(glob.glob('/opt/bpyenv/lib/python3*/site-packages/bpy/*/datafiles/fonts'), reverse=True)
    for c in cands:
        if c and os.path.isfile(os.path.join(c, 'Inter.woff2')):
            return c
    sys.exit('Blender fonts not found: set BLENDER_FONTS to Blender\'s datafiles/fonts')


def font(name_in, name_out):
    """OFL fonts that ship inside Blender, converted from WOFF2 to TTF with Google's woff2 tool."""
    dst_dir = os.path.join(ROOT, 'build', 'fonts')
    os.makedirs(dst_dir, exist_ok=True)
    src = os.path.join(blender_fonts(), name_in)
    tmp = os.path.join(dst_dir, name_out.replace('.ttf', '.woff2'))
    ttf = tmp[:-6] + '.ttf'
    if not os.path.exists(ttf) or os.path.getmtime(ttf) < os.path.getmtime(src):
        shutil.copy(src, tmp)
        subprocess.run(['woff2_decompress', tmp], check=True)
    return ttf


def fx_sheet():
    """The spell effects' pixel-art sheet (tools/fx/fx_atlas.py), drawn afresh each pack: it takes about a second."""
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'fx'))
    import fx_atlas
    out = os.path.join(ROOT, 'build', 'fx.qtex')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(fx_atlas.qtex(*fx_atlas.atlas()))
    return out


def collect():
    entries = []
    gen = os.path.join(ROOT, 'assets', 'generated')
    for sub in ('meshes', 'skel', 'anim', 'audio', 'textures'):
        d = os.path.join(gen, sub)
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                entries.append((sub + '/' + f, os.path.join(d, f)))
    tree = os.path.join(gen, 'tree', 'tree.json')
    if os.path.isfile(tree):
        entries.append(('data/tree.json', tree))
    tiles = os.path.join(gen, 'tiles')
    if os.path.isdir(tiles):
        for f in sorted(os.listdir(tiles)):
            entries.append(('data/tiles/' + f, os.path.join(tiles, f)))
    data = os.path.join(ROOT, 'data')
    for dirpath, _, files in os.walk(data):
        for f in sorted(files):
            full = os.path.join(dirpath, f)
            entries.append(('data/' + os.path.relpath(full, data).replace(os.sep, '/'), full))
    entries.append(('textures/fx.qtex', fx_sheet()))
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
