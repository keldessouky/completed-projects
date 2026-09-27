"""QAHIRA character generator: shared geometry, surface and material helpers (v3)."""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector as V, Matrix, noise
from mathutils.bvhtree import BVHTree

TAU = 2 * math.pi
scene = bpy.context.scene


def align(p0, p1):
    d = V(p1) - V(p0)
    q = d.normalized().to_track_quat('Z', 'Y')
    return Matrix.Translation((V(p0) + V(p1)) / 2) @ q.to_matrix().to_4x4(), d.length


def basis(z_axis, hint=V((0, 0, 1))):
    """Orthonormal (u, v, w) with w = z_axis."""
    w = V(z_axis).normalized()
    u = V(hint) - w * V(hint).dot(w)
    if u.length < 1e-6:
        u = w.orthogonal()
    u.normalize()
    return u, w.cross(u), w


def frames(pts, hint=None):
    n = len(pts)
    T = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    Ns = []
    if hint is not None:
        for i in range(n):
            h = V(hint(i, pts[i]) if callable(hint) else hint)
            N = h - T[i] * h.dot(T[i])
            Ns.append((N if N.length > 1e-6 else T[i].orthogonal()).normalized())
    else:
        N = T[0].orthogonal().normalized()
        for i in range(n):
            N = (N - T[i] * N.dot(T[i])).normalized()
            Ns.append(N)
    return T, Ns, [T[i].cross(Ns[i]) for i in range(n)]


def superellipse(a, p):
    ca, sa = math.cos(a), math.sin(a)
    return math.copysign(abs(ca) ** (2 / p), ca), math.copysign(abs(sa) ** (2 / p), sa)


class Part:
    """Accumulates primitives in one bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uvl = None

    # ---- primitives
    def sphere(self, c, r, rot=None, seg=24):
        rx, ry, rz = r if isinstance(r, (tuple, list)) else (r, r, r)
        M = Matrix.Translation(V(c)) @ (rot if rot else Matrix()) @ Matrix.Diagonal((rx, ry, rz, 1))
        bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=max(6, seg // 2), radius=1.0, matrix=M)

    def capsule(self, p0, p1, r0, r1=None, seg=20):
        r1 = r0 if r1 is None else r1
        M, L = align(p0, p1)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r0, radius2=r1, depth=max(L, 1e-4), matrix=M)
        self.sphere(p0, r0, seg=seg)
        self.sphere(p1, r1, seg=seg)

    def box(self, c, size, rot=None):
        M = Matrix.Translation(V(c)) @ (rot if rot else Matrix()) @ Matrix.Diagonal((*size, 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)

    # ---- surfaces
    def _uv_layer(self):
        if self.uvl is None:
            self.uvl = self.bm.loops.layers.uv.get('UVMap') or self.bm.loops.layers.uv.new('UVMap')
        return self.uvl

    def bridge(self, rings, closed=True, caps=False, uvs=None, fan_top=None):
        n = len(rings[0])
        uvl = self._uv_layer() if uvs else None
        for ri in range(len(rings) - 1):
            r0, r1 = rings[ri], rings[ri + 1]
            for k in range(n if closed else n - 1):
                j = (k + 1) % n
                f = self.bm.faces.new((r0[k], r0[j], r1[j], r1[k]))
                if uvs:
                    for lp, uv in zip(f.loops, (uvs[ri][k], uvs[ri][j], uvs[ri + 1][j], uvs[ri + 1][k])):
                        lp[uvl].uv = uv
        if closed and caps:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        if fan_top is not None:
            t = self.bm.verts.new(V(fan_top))
            last = rings[-1]
            for k in range(n):
                self.bm.faces.new((last[k], last[(k + 1) % n], t))

    def grid(self, rows, closed=True, caps=False, uvs=None, fan_top=None):
        rings = [[self.bm.verts.new(V(p)) for p in row] for row in rows]
        self.bridge(rings, closed, caps, uvs, fan_top)

    def loft(self, secs, seg=40, a0=0.0, a1=360.0, caps=True, folds=0, phase=0.0):
        """Horizontal ellipse rings (z, cx, cy, rx, ry[, fold amplitude])."""
        closed = (a1 - a0) >= 360
        n = seg if closed else seg + 1
        rows = []
        for sec in secs:
            z, cx, cy, rx, ry = sec[:5]
            amp = sec[5] if len(sec) > 5 else 0.0
            row = []
            for i in range(n):
                a = math.radians(a0 + (a1 - a0) * i / seg)
                k = 1.0 + amp * math.sin(folds * a + phase) if folds else 1.0
                row.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a), z))
            rows.append(row)
        self.grid(rows, closed, caps and closed)

    def sloft(self, secs, seg=32, p=2.0, caps=True, closed=True, a0=0.0, a1=TAU):
        """General loft: secs = (centre, u, v, ru, rv); superellipse exponent p."""
        n = seg if closed else seg + 1
        rows = []
        for c, u, v, ru, rv in secs:
            row = []
            for k in range(n):
                x, y = superellipse(a0 + (a1 - a0) * k / seg, p)
                row.append(V(c) + V(u) * ru * x + V(v) * rv * y)
            rows.append(row)
        self.grid(rows, closed, caps and closed)

    def sweep(self, pts, r, seg=10, hint=None, caps=True, closed=False):
        """Tube/ribbon along a polyline. r: float, (rx, ry) or f(t)->either; rx lies along the hint."""
        pts = [V(p) for p in pts]
        if closed:
            pts_f = [pts[-1]] + pts + [pts[0]]
            T, N, B = frames(pts_f, hint)
            T, N, B = T[1:-1], N[1:-1], B[1:-1]
        else:
            T, N, B = frames(pts, hint)
        rows = []
        m = len(pts)
        for i, p in enumerate(pts):
            ri = r(i / max(1, m - 1)) if callable(r) else r
            rx, ry = ri if isinstance(ri, tuple) else (ri, ri)
            rows.append([p + N[i] * rx * math.cos(TAU * k / seg) + B[i] * ry * math.sin(TAU * k / seg)
                         for k in range(seg)])
        rings = [[self.bm.verts.new(q) for q in row] for row in rows]
        if closed:
            rings.append(rings[0])
            self.bridge(rings, True, False)
        else:
            self.bridge(rings, True, caps)

    def dashed(self, pts, r, dash=0.008, gap=0.006):
        """Stitching: short tubes spaced along a polyline."""
        pts = [V(p) for p in pts]
        cum = [0.0]
        for a, b in zip(pts, pts[1:]):
            cum.append(cum[-1] + (b - a).length)

        def at(s):
            for j in range(len(cum) - 1):
                if cum[j + 1] >= s:
                    t = (s - cum[j]) / max(cum[j + 1] - cum[j], 1e-9)
                    return pts[j].lerp(pts[j + 1], t)
            return pts[-1]
        s = 0.0
        while s + dash <= cum[-1]:
            self.capsule(at(s), at(s + dash), r, seg=6)
            s += dash + gap

    # ---- output
    def build(self, name, mat, coll, voxel=None, smooth=0, solidify=0.0, sol_offset=1.0, subsurf=0,
              bevel=0.0, recalc=True):
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        me.materials.append(mat)
        if voxel:
            m = ob.modifiers.new('fuse', 'REMESH')
            m.mode, m.voxel_size, m.use_smooth_shade = 'VOXEL', voxel, True
        if smooth:
            m = ob.modifiers.new('relax', 'SMOOTH')
            m.factor, m.iterations = 0.6, smooth
        if solidify:
            m = ob.modifiers.new('thick', 'SOLIDIFY')
            m.thickness, m.offset = solidify, sol_offset
        if bevel:
            m = ob.modifiers.new('bevel', 'BEVEL')
            m.width, m.segments = bevel, 3
        if subsurf:
            m = ob.modifiers.new('sub', 'SUBSURF')
            m.levels = m.render_levels = subsurf
        for p in me.polygons:
            p.use_smooth = True
        return ob


class Batch:
    """Many small bits (rivets, stitches) that share a material: one object each."""

    def __init__(self, coll):
        self.coll, self.parts = coll, {}

    def __call__(self, key):
        if key not in self.parts:
            self.parts[key] = Part()
        return self.parts[key]

    def flush(self, mats):
        for key, part in self.parts.items():
            part.build(key, mats[key], self.coll)
        self.parts = {}


# ---- surfaces of already-built objects ----------------------------------------
def trees(*obs):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return [BVHTree.FromObject(o, dg) for o in obs]


def hit_in(ts, axis_pt, d, R=0.45):
    """Outermost surface point met by a ray fired inward from axis_pt + d*R."""
    d = V(d).normalized()
    o = V(axis_pt) + d * R
    best = None
    for t in ts:
        loc, nrm, idx, dist = t.ray_cast(o, -d, R + 0.3)
        if loc is not None and (best is None or dist < best[1]):
            best = (loc, dist, nrm)
    if best is None:
        return V(axis_pt) + d * 0.05, d
    return best[0], best[2]


def nearest(ts, p):
    best = None
    for t in ts:
        loc, nrm, idx, dist = t.find_nearest(V(p))
        if loc is not None and (best is None or dist < best[2]):
            best = (loc, nrm, dist)
    return best[0], best[1]


def wrap(ts, path, off, cy=0.0):
    """path of (angle_deg, z) around the body -> points sitting `off` outside the outermost surface."""
    out = []
    for a, z in path:
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        loc, _ = hit_in(ts, V((0, cy, z)), d)
        out.append(loc + d * off)
    return out


def resample(pts, n):
    pts = [V(p) for p in pts]
    L = [0.0]
    for a, b in zip(pts, pts[1:]):
        L.append(L[-1] + (b - a).length)
    out = []
    for i in range(n):
        s = L[-1] * i / (n - 1)
        j = max(k for k in range(len(L)) if L[k] <= s + 1e-12)
        j = min(j, len(pts) - 2)
        t = (s - L[j]) / max(L[j + 1] - L[j], 1e-9)
        out.append(pts[j].lerp(pts[j + 1], t))
    return out


# ---- materials ------------------------------------------------------------------
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


def sock(node, ident, out=False):
    for s in (node.outputs if out else node.inputs):
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def mix_rgb(N, L, a_out, b_out, fac, blend='MIX'):
    m = N.new('ShaderNodeMix')
    m.data_type, m.blend_type = 'RGBA', blend
    if isinstance(fac, (int, float)):
        sock(m, 'Factor_Float').default_value = fac
    else:
        L.new(fac, sock(m, 'Factor_Float'))
    for ident, v in (('A_Color', a_out), ('B_Color', b_out)):
        if isinstance(v, tuple):
            sock(m, ident).default_value = v
        else:
            L.new(v, sock(m, ident))
    return sock(m, 'Result_Color', out=True)


def maprange(N, L, src, fmin, fmax, tmin=0.0, tmax=1.0):
    m = N.new('ShaderNodeMapRange')
    L.new(src, m.inputs['Value'])
    m.inputs['From Min'].default_value, m.inputs['From Max'].default_value = fmin, fmax
    m.inputs['To Min'].default_value, m.inputs['To Max'].default_value = tmin, tmax
    return m.outputs['Result']


def material(name, color, rough=0.7, metal=0.0, vary=0.12, bump=0.25, scale=120.0, emit=None, strength=0.0,
             image=None, img_bump=0.9, img_dist=0.004, wear=0.0, dust=0.0, weave=0.0, sheen=0.0, scratch=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bsdf = N['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if sheen:
        bsdf.inputs['Sheen Weight'].default_value = sheen
        bsdf.inputs['Sheen Tint'].default_value = srgb(color)
    tc = N.new('ShaderNodeTexCoord')
    geo = N.new('ShaderNodeNewGeometry')
    c = srgb(color)
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value, nz.inputs['Detail'].default_value = 6.0, 6.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = tuple(x * (1 - vary) for x in c[:3]) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1, x * (1 + vary)) for x in c[:3]) + (1,)
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.35, 0.65
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    img = None
    if image is not None:
        img = N.new('ShaderNodeTexImage')
        img.image, img.extension = image, 'REPEAT'
        L.new(tc.outputs['UV'], img.inputs['Vector'])
        col = mix_rgb(N, L, col, maprange(N, L, img.outputs['Color'], 0, 1, 0.3, 1.0), 1.0, 'MULTIPLY')
    if wear:
        edge = maprange(N, L, geo.outputs['Pointiness'], 0.5, 0.535)
        lighter = tuple(min(1, x * (2.2 if metal else 1.6)) for x in c[:3]) + (1,)
        f = N.new('ShaderNodeMath')
        f.operation = 'MULTIPLY'
        L.new(edge, f.inputs[0])
        f.inputs[1].default_value = wear
        col = mix_rgb(N, L, col, lighter, f.outputs[0])
    if dust:
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(geo.outputs['Position'], sep.inputs['Vector'])
        low = maprange(N, L, sep.outputs['Z'], 0.45, 0.0)
        f = N.new('ShaderNodeMath')
        f.operation = 'MULTIPLY'
        L.new(low, f.inputs[0])
        L.new(nz.outputs['Fac'], f.inputs[1])
        f2 = N.new('ShaderNodeMath')
        f2.operation = 'MULTIPLY'
        L.new(f.outputs[0], f2.inputs[0])
        f2.inputs[1].default_value = dust
        col = mix_rgb(N, L, col, srgb('#9A8A72'), f2.outputs[0])
    L.new(col, bsdf.inputs['Base Color'])
    if scratch:
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1.0, 1.0, 40.0)
        L.new(tc.outputs['Object'], mp.inputs['Vector'])
        sn = N.new('ShaderNodeTexNoise')
        sn.inputs['Scale'].default_value = 30.0
        L.new(mp.outputs['Vector'], sn.inputs['Vector'])
        L.new(maprange(N, L, sn.outputs['Fac'], 0.3, 0.7, rough - scratch, rough + scratch), bsdf.inputs['Roughness'])
    # bump stack
    fine = N.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = scale
    L.new(tc.outputs['Object'], fine.inputs['Vector'])
    h = fine.outputs['Fac']
    if weave:
        wx = N.new('ShaderNodeTexWave')
        wx.bands_direction = 'X'
        wz = N.new('ShaderNodeTexWave')
        wz.bands_direction = 'Z'
        for w in (wx, wz):
            w.inputs['Scale'].default_value = weave
            L.new(tc.outputs['Object'], w.inputs['Vector'])
        add = N.new('ShaderNodeMath')
        add.operation = 'ADD'
        L.new(wx.outputs['Fac'], add.inputs[0])
        L.new(wz.outputs['Fac'], add.inputs[1])
        add2 = N.new('ShaderNodeMath')
        add2.operation = 'ADD'
        L.new(add.outputs[0], add2.inputs[0])
        L.new(h, add2.inputs[1])
        h = add2.outputs[0]
    bmp = N.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = bump
    bmp.inputs['Distance'].default_value = 0.002
    L.new(h, bmp.inputs['Height'])
    nrm = bmp.outputs['Normal']
    if img is not None:
        b2 = N.new('ShaderNodeBump')
        b2.inputs['Strength'].default_value = img_bump
        b2.inputs['Distance'].default_value = img_dist
        L.new(img.outputs['Color'], b2.inputs['Height'])
        L.new(nrm, b2.inputs['Normal'])
        nrm = b2.outputs['Normal']
    L.new(nrm, bsdf.inputs['Normal'])
    if emit:
        bsdf.inputs['Emission Color'].default_value = srgb(emit)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def _lines_image(name, w, h, draw):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = draw(x, y)
    g = np.clip((d - 2.0) / 3.0, 0, 1)  # 0 in grooves, 1 elsewhere
    img = bpy.data.images.new(name, w, h, float_buffer=False)
    rgba = np.dstack([g, g, g, np.ones_like(g)]).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


def _seg(x, y, ax, ay, bx, by):
    px, py, vx, vy = x - ax, y - ay, bx - ax, by - ay
    t = np.clip((px * vx + py * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(px - t * vx, py - t * vy)


def star_lines(x, y, cx, cy, R, rot, step=3):
    pts = [(cx + R * math.cos(rot + k * math.pi / 4), cy + R * math.sin(rot + k * math.pi / 4)) for k in range(8)]
    d = np.full(x.shape, 1e9, np.float32)
    for k in range(8):
        a, b = pts[k], pts[(k + step) % 8]
        d = np.minimum(d, _seg(x, y, *a, *b))
    return d


def engraving_image(res=1024):
    """Eight-fold rosette, the kind hammered into a Cairo brass tray."""
    c = res / 2

    def draw(x, y):
        r = np.hypot(x - c, y - c)
        d = np.minimum(star_lines(x, y, c, c, 0.86 * c, math.pi / 8), star_lines(x, y, c, c, 0.44 * c, 0.0))
        for R in (0.95, 0.9, 0.2):
            d = np.minimum(d, np.abs(r - R * c))
        for k in range(16):
            a = k * math.pi / 8
            d = np.minimum(d, np.abs(np.hypot(x - c - 0.66 * c * math.cos(a), y - c - 0.66 * c * math.sin(a)) - 0.03 * c))
        d[r > 0.97 * c] = 99
        return d
    return _lines_image('engraving', res, res, draw)


def frieze_image(tiles=8, t=256):
    """A repeating band of eight-point stars between two rules."""
    def draw(x, y):
        cx = (np.floor(x / t) + 0.5) * t
        d = np.minimum(star_lines(x, y, cx, t / 2, 0.36 * t, 0.0, step=2), star_lines(x, y, cx, t / 2, 0.36 * t, math.pi / 4, step=2))
        d = np.minimum(d, np.abs(np.hypot(x - cx, y - t / 2) - 0.12 * t))
        for yy in (0.06 * t, 0.94 * t):
            d = np.minimum(d, np.abs(y - yy))
        return d
    return _lines_image('frieze', tiles * t, t, draw)
