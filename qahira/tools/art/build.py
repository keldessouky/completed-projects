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
from characters import warrior, ghoul, npc, ghoula
from env import street, souq, necro, rooftop
from props import props

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
if want('ghoul'):
    J = ghoul.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'ghoul.qskel'), J)
    rig.bake(J, ghoul.CLIPS, os.path.join(OUT, 'anim', 'ghoul.qanim'))
    body = ghoul.build(J).export(os.path.join(OUT, 'meshes', 'ghoul.qmesh'))
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'ghoul_anims.png'), J, body, ghoul.CLIPS)

if want('ghoula'):
    J = ghoula.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'ghoula.qskel'), J)
    rig.bake(J, ghoula.CLIPS, os.path.join(OUT, 'anim', 'ghoula.qanim'))
    body = ghoula.build(J).export(os.path.join(OUT, 'meshes', 'ghoula.qmesh'))
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'ghoula_anims.png'), J, body, ghoula.CLIPS)

if want('street'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for i, nm in enumerate(('street_a', 'street_b', 'street_c')):
        street.export(nm, seed=11 + i * 7, mesh_dir=os.path.join(OUT, 'meshes'), data_dir=tiles)
if want('souq'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for i, nm in enumerate(('souq_a', 'souq_b', 'souq_c')):
        souq.export(nm, seed=5 + i * 13, mesh_dir=os.path.join(OUT, 'meshes'), data_dir=tiles)
if want('necro'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    necro.export_all(os.path.join(OUT, 'meshes'), tiles)
if want('hub'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    rooftop.export(os.path.join(OUT, 'meshes'), tiles)
    J = npc.keeper_skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'keeper.qskel'), J)
    rig.bake(J, npc.KEEPER_CLIPS, os.path.join(OUT, 'anim', 'keeper.qanim'))
    kb = npc.keeper(J).export(os.path.join(OUT, 'meshes', 'keeper.qmesh'))
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'keeper_anims.png'), J, kb, npc.KEEPER_CLIPS)
    npc.cat().export(os.path.join(OUT, 'meshes', 'cat.qmesh'), skinned=False)
if want('props'):
    props.export_all(os.path.join(OUT, 'meshes'))
print('BUILD DONE')
