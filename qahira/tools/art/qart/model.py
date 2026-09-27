"""Collects generated parts into one game mesh: decimation, baked AO, skin weights, .qmesh export.

Vertex format (see src/gfx/mesh.cpp): pos f32x3, normal f32x3, colour u8x4 (sRGB albedo + AO),
material u8x4 (roughness, metalness, emissive, flags), [skinned: bone index u8x4, weight u8x4].
"""
import math
import struct
import bpy
import bmesh
import numpy as np
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree

from . import rig


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Model:
    def __init__(self, name, J=None):
        self.name = name
        self.J = J
        self.items = []
        self.verbose = True
        self.coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.coll)

    def add(self, part, color, rough=0.8, metal=0.0, emit=0.0, flags=0, bone=None, bones=None, sigma=0.09,
            voxel=None, smooth=0, solidify=0.0, sol_offset=1.0, subsurf=0, bevel=0.0, decimate=None, flat=False,
            recalc=True, matrix=None, tris=None):
        ob = part.build('%s_%d' % (self.name, len(self.items)), None, self.coll, voxel=voxel, smooth=smooth,
                        solidify=solidify, sol_offset=sol_offset, subsurf=subsurf, bevel=bevel, recalc=recalc)
        if matrix is not None:
            ob.matrix_world = matrix
        if voxel:
            ob.modifiers['fuse'].use_smooth_shade = not flat
        if flat:
            for p in ob.data.polygons:
                p.use_smooth = False
        if tris:
            dg = bpy.context.evaluated_depsgraph_get()
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            have = len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
            decimate = min(1.0, tris / max(have, 1))
        if decimate and decimate < 1.0:
            m = ob.modifiers.new('lod', 'DECIMATE')
            m.ratio = decimate
        self.items.append(dict(ob=ob, color=hex_rgb(color), mat=(rough, metal, emit, flags), bone=bone, bones=bones,
                               sigma=sigma))
        return ob

    # ------------------------------------------------------------------
    def _gather(self):
        dg = bpy.context.evaluated_depsgraph_get()
        P, N, C, M, TRI, OWN = [], [], [], [], [], []
        self.counts = []
        base = 0
        for idx, it in enumerate(self.items):
            ob = it['ob']
            oe = ob.evaluated_get(dg)
            me = oe.to_mesh()
            me.transform(ob.matrix_world)
            me.calc_loop_triangles()
            cn = me.corner_normals
            remap = {}
            verts = me.vertices
            for tri in me.loop_triangles:
                ids = []
                for vi, li in zip(tri.vertices, tri.loops):
                    n = cn[li].vector
                    key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3))
                    j = remap.get(key)
                    if j is None:
                        j = len(P)
                        remap[key] = j
                        P.append(tuple(verts[vi].co))
                        N.append((n.x, n.y, n.z))
                        OWN.append(idx)
                    ids.append(j)
                TRI.append(ids)
            self.counts.append((ob.name, len(me.loop_triangles)))
            oe.to_mesh_clear()
        return (np.array(P, np.float32), np.array(N, np.float32), np.array(TRI, np.uint32), np.array(OWN, np.int32))

    def _ao(self, P, N, T, rays=14, dist=0.3):
        bvh = BVHTree.FromPolygons([tuple(p) for p in P], [tuple(t) for t in T])
        rng = np.random.default_rng(7)
        dirs = rng.normal(size=(rays, 3))
        dirs /= np.linalg.norm(dirs, axis=1)[:, None]
        ao = np.ones(len(P), np.float32)
        for i in range(len(P)):
            n = N[i]
            p = V(P[i]) + V(n) * 0.003
            hit = 0
            for d in dirs:
                if d @ n < 0:
                    d = -d
                dv = V(d * 0.7 + n * 0.3).normalized()
                if bvh.ray_cast(p, dv, dist)[0] is not None:
                    hit += 1
            ao[i] = 1.0 - 0.8 * hit / rays
        return ao

    def _weights(self, P, OWN):
        n = len(P)
        bi = np.zeros((n, 4), np.uint8)
        bw = np.zeros((n, 4), np.float32)
        J = self.J
        for idx, it in enumerate(self.items):
            sel = np.where(OWN == idx)[0]
            if len(sel) == 0:
                continue
            if it['bone']:
                bi[sel, 0] = rig.INDEX[it['bone']]
                bw[sel, 0] = 1.0
                continue
            names = it['bones']
            pts = P[sel]
            W = []
            for b in names:
                h, t = np.array(J[b][0]), np.array(J[b][1])
                d = t - h
                tt = np.clip(((pts - h) @ d) / max(d @ d, 1e-9), 0, 1)
                closest = h + tt[:, None] * d
                dist = np.linalg.norm(pts - closest, axis=1)
                W.append(np.exp(-(dist / it['sigma']) ** 2) + 1e-6)
            W = np.stack(W, axis=1)
            order = np.argsort(-W, axis=1)[:, :4]
            top = np.take_along_axis(W, order, axis=1)
            top /= top.sum(axis=1, keepdims=True)
            for k in range(min(4, len(names))):
                bi[sel, k] = [rig.INDEX[names[o]] for o in order[:, k]]
                bw[sel, k] = top[:, k]
        return bi, bw

    def export(self, path, ao=True, skinned=True):
        P, N, T, OWN = self._gather()
        occ = self._ao(P, N, T) if ao else np.ones(len(P), np.float32)
        C = np.array([self.items[o]['color'] for o in OWN], np.uint8)
        MAT = np.array([[int(x * 255 if i < 3 else x) for i, x in enumerate(self.items[o]['mat'])] for o in OWN], np.uint8)
        if skinned:
            bi, bw = self._weights(P, OWN)
            bw8 = np.round(bw * 255).astype(np.int32)
            bw8[:, 0] += 255 - bw8.sum(axis=1)  # exact sum
            bw8 = np.clip(bw8, 0, 255).astype(np.uint8)
        lo, hi = P.min(axis=0), P.max(axis=0)
        with open(path, 'wb') as f:
            f.write(b'QMSH' + struct.pack('<IIII', 1, 1 if skinned else 0, len(P), T.size))
            f.write(struct.pack('<6f', *lo, *hi))
            rows = []
            for i in range(len(P)):
                rows.append(struct.pack('<6f', *P[i], *N[i]))
                rows.append(bytes((C[i][0], C[i][1], C[i][2], int(occ[i] * 255))))
                rows.append(bytes(MAT[i]))
                if skinned:
                    rows.append(bytes(bi[i]) + bytes(bw8[i]))
            f.write(b''.join(rows))
            f.write(T.astype('<u4').tobytes())
        print('EXPORT %s: %d verts, %d tris' % (path, len(P), len(T)))
        if self.verbose:
            for n, c in sorted(self.counts, key=lambda x: -x[1])[:14]:
                print('   %-14s %6d' % (n, c))
        return dict(P=P, N=N, T=T, C=C, occ=occ, bi=bi if skinned else None, bw=bw if skinned else None)
