"""Contact sheets of animation frames, skinned in numpy and rendered with Workbench (look/debug only)."""
import math
import bpy
import numpy as np
from mathutils import Vector as V, Matrix

from . import rig


def skin(data, J, P):
    W = P.world()
    mats = []
    for b in rig.NAMES:
        r, t = W[b]
        M = Matrix.Translation(t) @ r.to_matrix().to_4x4() @ Matrix.Translation(-J[b][0])
        mats.append(np.array(M, np.float32))
    mats = np.stack(mats)
    pts = np.c_[data['P'], np.ones(len(data['P']))]
    out = np.zeros((len(pts), 3), np.float32)
    for k in range(4):
        Mk = mats[data['bi'][:, k]]
        out += data['bw'][:, k:k + 1] * np.einsum('nij,nj->ni', Mk, pts)[:, :3]
    return out, W


def attach(data, W, bone):
    r, t = W[bone]
    M = np.array(Matrix.Translation(t) @ r.to_matrix().to_4x4(), np.float32)
    pts = np.c_[data['P'], np.ones(len(data['P']))]
    return (pts @ M.T)[:, :3]


def mesh_obj(name, P, T, C, occ, offset, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p + offset) for p in P], [], [tuple(t) for t in T])
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    rgba = np.c_[C / 255.0 * occ[:, None], np.ones(len(C))].astype(np.float32)
    lin = np.where(rgba[:, :3] <= 0.04045, rgba[:, :3] / 12.92, ((rgba[:, :3] + 0.055) / 1.055) ** 2.4)
    rgba[:, :3] = lin
    col.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = col
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def sheet(path, J, body, clips, weapon=None, weapon_bone='weapon_R', per_clip=6, spacing=1.6, view=(1, -1.4, 0.7)):
    scene = bpy.context.scene
    coll = bpy.data.collections.new('preview')
    scene.collection.children.link(coll)
    rows = len(clips)
    for ri, clip in enumerate(clips):
        for fi in range(per_clip):
            t = clip.duration * fi / max(1, per_clip - 1 if not clip.loop else per_clip)
            P = rig.pose_at(J, clip, t)
            pts, W = skin(body, J, P)
            off = V((fi * spacing, 0, -ri * 2.3))
            mesh_obj('b', pts, body['T'], body['C'], body['occ'], np.array(off), coll)
            if weapon is not None:
                wp = attach(weapon, W, weapon_bone)
                mesh_obj('w', wp, weapon['T'], weapon['C'], weapon['occ'], np.array(off), coll)
    cam_d = bpy.data.cameras.new('c')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = max(per_clip * spacing, rows * 2.3) + 0.6
    cam = bpy.data.objects.new('c', cam_d)
    coll.objects.link(cam)
    ctr = V(((per_clip - 1) * spacing / 2, 0, 1.0 - (rows - 1) * 2.3 / 2))
    d = V(view).normalized()
    cam.location = ctr + d * 20
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = int(240 * per_clip)
    scene.render.resolution_y = int(240 * per_clip * rows * 2.3 / (per_clip * spacing)) if rows * 2.3 > per_clip * spacing else int(240 * per_clip * (rows * 2.3 + 0.6) / (per_clip * spacing + 0.6))
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.collections.remove(coll)
    print('PREVIEW', path)
