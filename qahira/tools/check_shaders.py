#!/usr/bin/env python3
"""Validates every shader as GLSL ES 3.00 (the RP6 path) with Khronos' glslangValidator."""
import os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
src = open(os.path.join(ROOT, 'src', 'gfx', 'shaders.cpp')).read()
S = dict(re.findall(r'const char\* (\w+) = R"\((.*?)\)";', src, re.S))
PRE = ("#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n"
       "precision highp usampler2D;\n")
fb = S['frame_block']
programs = {
    'mesh': (fb + S['mesh_vs'], fb + S['mesh_fs']),
    'bloom_down': (S['fullscreen_vs'], S['bloom_down_fs']),
    'bloom_up': (S['fullscreen_vs'], S['bloom_up_fs']),
    'composite': (S['fullscreen_vs'], S['composite_fs']),
    'sprite': (fb + S['sprite_vs'], S['sprite_fs']),
    'ui': (S['ui_vs'], S['ui_fs']),
}
extra = os.path.join(ROOT, 'src', 'gfx', 'shaders_extra.txt')
bad = 0
with tempfile.TemporaryDirectory() as d:
    for name, (vs, fs) in programs.items():
        for stage, text in (('vert', vs), ('frag', fs)):
            p = os.path.join(d, '%s.%s' % (name, stage))
            open(p, 'w').write(PRE + text)
            r = subprocess.run(['glslangValidator', p], capture_output=True, text=True)
            if r.returncode != 0:
                bad += 1
                print('FAIL', name, stage)
                print(r.stdout)
print('shaders: %d failures' % bad)
sys.exit(1 if bad else 0)
