"""Generates every game asset into assets/generated. Run with Blender:
   Blender -b --factory-startup -P tools/art/build.py -- [--preview] [only=warrior,maul]
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
import qart.geom as geom
geom.scene = bpy.context.scene

from qart import rig, preview
from characters import warrior
from env import street

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in args
ONLY = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('only=')), None)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'generated')
PREV = os.path.join(ROOT, 'build', 'preview')
for d in ('meshes', 'skel', 'anim'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
os.makedirs(PREV, exist_ok=True)


def want(name):
    return ONLY is None or name in ONLY


if want('warrior'):
    J = rig.humanoid()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'warrior.qskel'), J)
    rig.bake(J, warrior.CLIPS, os.path.join(OUT, 'anim', 'warrior.qanim'))
    body = warrior.build(J).export(os.path.join(OUT, 'meshes', 'warrior.qmesh'))
    maul = warrior.build_maul().export(os.path.join(OUT, 'meshes', 'maul.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'warrior_anims.png'), J, body, warrior.CLIPS, weapon=maul)
if want('street'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for i, nm in enumerate(('street_a', 'street_b', 'street_c')):
        street.export(nm, seed=11 + i * 7, mesh_dir=os.path.join(OUT, 'meshes'), data_dir=tiles)
print('BUILD DONE')
