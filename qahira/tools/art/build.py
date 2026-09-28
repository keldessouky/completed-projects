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
from characters import warrior, ghoul, npc, ghoula, sorcerer, jinn, ranger, nile, mercenary, desert, shadow, maghreb, templar
from env import street, souq, necro, rooftop, kit, regions, regions2, regions3, regions4
from props import props, dig

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in args
ONLY = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('only=')), None)
REGION_NAMES = ('downtown', 'metro', 'khan', 'muizz', 'mokattam', 'gate')
REGION2_NAMES = ('nile', 'village', 'karnak', 'valley', 'tomb')
REGION3_NAMES = ('white', 'siwa', 'dunes', 'futuh')
REGION4_NAMES = ('ghadames', 'chott', 'tozeur', 'medina')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'generated')
PREV = os.path.join(ROOT, 'build', 'preview')
for d in ('meshes', 'skel', 'anim'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
os.makedirs(PREV, exist_ok=True)


def want(name):
    if name == 'act1' and ONLY is not None and any(r in ONLY for r in REGION_NAMES):
        return True
    if name == 'act2' and ONLY is not None and any(r in ONLY for r in REGION2_NAMES):
        return True
    if name == 'act3' and ONLY is not None and any(r in ONLY for r in REGION3_NAMES):
        return True
    if name == 'act4' and ONLY is not None and any(r in ONLY for r in REGION4_NAMES):
        return True
    return ONLY is None or name in ONLY


if want('warrior'):
    J = rig.humanoid()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'warrior.qskel'), J)
    rig.bake(J, warrior.CLIPS, os.path.join(OUT, 'anim', 'warrior.qanim'))
    body = warrior.build(J).export(os.path.join(OUT, 'meshes', 'warrior.qmesh'))
    maul = warrior.build_maul().export(os.path.join(OUT, 'meshes', 'maul.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'warrior_anims.png'), J, body, warrior.CLIPS, weapon=maul)
if want('sorcerer'):
    J = sorcerer.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'sorcerer.qskel'), J)
    rig.bake(J, sorcerer.CLIPS, os.path.join(OUT, 'anim', 'sorcerer.qanim'))
    body = sorcerer.build(J).export(os.path.join(OUT, 'meshes', 'sorcerer.qmesh'))
    staff = sorcerer.build_staff().export(os.path.join(OUT, 'meshes', 'staff.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'sorcerer_anims.png'), J, body, sorcerer.CLIPS, weapon=staff)
if want('ranger'):
    J = ranger.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'ranger.qskel'), J)
    rig.bake(J, ranger.CLIPS, os.path.join(OUT, 'anim', 'ranger.qanim'))
    body = ranger.build(J).export(os.path.join(OUT, 'meshes', 'ranger.qmesh'))
    bow = ranger.build_bow().export(os.path.join(OUT, 'meshes', 'bow.qmesh'), skinned=False)
    ranger.build_arrow().export(os.path.join(OUT, 'meshes', 'arrow.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'ranger_anims.png'), J, body, ranger.CLIPS, weapon=bow, weapon_bone='weapon_L')
if want('mercenary'):
    J = mercenary.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'mercenary.qskel'), J)
    rig.bake(J, mercenary.CLIPS, os.path.join(OUT, 'anim', 'mercenary.qanim'))
    body = mercenary.build(J).export(os.path.join(OUT, 'meshes', 'mercenary.qmesh'))
    sword = mercenary.build_sword().export(os.path.join(OUT, 'meshes', 'sword.qmesh'), skinned=False)
    mercenary.build_crossbow().export(os.path.join(OUT, 'meshes', 'crossbow.qmesh'), skinned=False)
    mercenary.build_grenade().export(os.path.join(OUT, 'meshes', 'grenade.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'mercenary_anims.png'), J, body, mercenary.CLIPS, weapon=sword)
if want('shadow'):
    J = shadow.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'shadow.qskel'), J)
    rig.bake(J, shadow.CLIPS, os.path.join(OUT, 'anim', 'shadow.qanim'))
    body = shadow.build(J).export(os.path.join(OUT, 'meshes', 'shadow.qmesh'))
    dagger = shadow.build_dagger().export(os.path.join(OUT, 'meshes', 'dagger.qmesh'), skinned=False)
    shadow.build_qstaff().export(os.path.join(OUT, 'meshes', 'qstaff.qmesh'), skinned=False)
    shadow.build_trap().export(os.path.join(OUT, 'meshes', 'trap.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'shadow_anims.png'), J, body, shadow.CLIPS, weapon=dagger)
if want('templar'):
    J = templar.skeleton()
    rig.write_skeleton(os.path.join(OUT, 'skel', 'templar.qskel'), J)
    rig.bake(J, templar.CLIPS, os.path.join(OUT, 'anim', 'templar.qanim'))
    body = templar.build(J).export(os.path.join(OUT, 'meshes', 'templar.qmesh'))
    sceptre = templar.build_sceptre().export(os.path.join(OUT, 'meshes', 'sceptre.qmesh'), skinned=False)
    templar.build_mace().export(os.path.join(OUT, 'meshes', 'mace.qmesh'), skinned=False)
    templar.build_totem().export(os.path.join(OUT, 'meshes', 'totem.qmesh'), skinned=False)
    if PREVIEW:
        preview.sheet(os.path.join(PREV, 'templar_anims.png'), J, body, templar.CLIPS, weapon=sceptre)
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

for nm, skel, build, clips in jinn.CREATURES + nile.CREATURES + desert.CREATURES + maghreb.CREATURES:
    if want(nm) or want('creatures'):
        J = skel()
        rig.write_skeleton(os.path.join(OUT, 'skel', nm + '.qskel'), J)
        rig.bake(J, clips, os.path.join(OUT, 'anim', nm + '.qanim'))
        body = build(J).export(os.path.join(OUT, 'meshes', nm + '.qmesh'))
        if PREVIEW:
            preview.sheet(os.path.join(PREV, nm + '_anims.png'), J, body, clips)
for nm, build in jinn.STATICS + nile.STATICS + desert.STATICS + maghreb.STATICS:
    if want(nm) or want('creatures'):
        build().export(os.path.join(OUT, 'meshes', nm + '.qmesh'), skinned=False)

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
if want('act1'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for R in regions.REGIONS:
        if ONLY is None or 'act1' in ONLY or R.NAME in ONLY:
            kit.export_region(R, os.path.join(OUT, 'meshes'), tiles)
if want('act2'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for R in regions2.REGIONS:
        if ONLY is None or 'act2' in ONLY or R.NAME in ONLY:
            kit.export_region(R, os.path.join(OUT, 'meshes'), tiles)
if want('act3'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for R in regions3.REGIONS:
        if ONLY is None or 'act3' in ONLY or R.NAME in ONLY:
            kit.export_region(R, os.path.join(OUT, 'meshes'), tiles)
if want('act4'):
    tiles = os.path.join(OUT, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for R in regions4.REGIONS:
        if ONLY is None or 'act4' in ONLY or R.NAME in ONLY:
            kit.export_region(R, os.path.join(OUT, 'meshes'), tiles)
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
if want('props') or want('dig'):
    dig.export_all(os.path.join(OUT, 'meshes'))
print('BUILD DONE')
