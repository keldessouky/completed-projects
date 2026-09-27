"""The Warrior, game model (bind A-pose, skinned to the shared rig) and his animation set."""
import math
import numpy as np
from mathutils import Vector as V, Matrix, Quaternion as Q, noise

from qart.geom import Part, trees, hit_in, basis, resample, wrap, superellipse, frames, TAU
from qart.model import Model
from qart import rig
from qart.rig import Clip, keys, cyc, eul, frame_rot, smooth

COL = dict(skin='#8A573C', hair='#14100D', knit='#2B2A2E', coat='#34332C', pants='#2A292E', boot='#3A2920',
           cuff='#4A3528', sole='#17120F', lace='#6E5A42', leather='#33271F', wrap='#8C7E68', scarf='#5A1511',
           steel='#6A6E74', iron='#4A4D52', brass='#C89A45', eye='#FF9E2C', glass='#FFB04A', patch='#5B5A42')

TORSO = [(0.98, 0.0, 0.168, 0.128), (1.1, 0.004, 0.178, 0.132), (1.22, 0.01, 0.198, 0.142),
         (1.33, 0.014, 0.218, 0.152), (1.42, 0.018, 0.228, 0.146), (1.49, 0.022, 0.228, 0.13),
         (1.545, 0.026, 0.165, 0.108), (1.58, 0.026, 0.095, 0.085)]
BP = [(1.17, 0.0, 0.205, 0.162), (1.27, 0.004, 0.214, 0.17), (1.36, 0.008, 0.232, 0.178), (1.45, 0.01, 0.232, 0.165)]


def interp(table, z):
    z = min(max(z, table[0][0]), table[-1][0])
    for a, b in zip(table, table[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(x + (y - x) * t for x, y in zip(a[1:], b[1:]))


def ridge(x):
    return 0.014 * math.exp(-(x / 0.03) ** 2)


def bp_pt(a, z, off):
    cy, rx, ry = interp(BP, z)
    ar = math.radians(a)
    x = (rx + off) * math.cos(ar)
    return V((x, cy + (ry + off) * math.sin(ar) - ridge(x), z))


def build(J):
    m = Model('warrior', J)
    H = lambda b: J[b][0]
    T_ = lambda b: J[b][1]

    # ---------------- head
    h = Part()
    h.sphere((0, 0.008, 1.745), (0.086, 0.1, 0.112), seg=32)
    h.capsule((-0.05, -0.078, 1.758), (0.05, -0.078, 1.758), 0.019, seg=12)
    for sx in (-1, 1):
        h.sphere((sx * 0.085, 0.008, 1.722), (0.013, 0.028, 0.035), seg=12)
        h.sphere((sx * 0.05, -0.068, 1.712), (0.022, 0.016, 0.014), seg=12)
    h.sphere((0, -0.03, 1.66), (0.074, 0.08, 0.07), seg=24)
    h.capsule((0, -0.09, 1.742), (0, -0.101, 1.705), 0.01, 0.013, seg=10)
    h.capsule((0, 0.015, 1.5), (0, 0.0, 1.66), 0.066, seg=16)
    head = m.add(h, COL['skin'], rough=0.55, bones=['head', 'neck', 'chest'], sigma=0.07, voxel=0.006, smooth=3, tris=900)
    for sx in (-1, 1):
        e = Part()
        e.sphere((sx * 0.033, -0.086, 1.728), (0.0135, 0.006, 0.0065), seg=10)
        m.add(e, COL['eye'], rough=0.3, emit=1.0, bone='head')
        b_ = Part()
        b_.capsule((sx * 0.013, -0.1, 1.743), (sx * 0.055, -0.089, 1.751), 0.0045, 0.0025, seg=6)
        m.add(b_, COL['hair'], bone='head')

    # ---------------- knit cap
    th = trees(head)
    NA = 48
    zb = lambda a: 1.752 - 0.016 * math.sin(a)
    rows = []
    for i in range(8):
        v = i / 7
        row = []
        for k in range(NA):
            a = TAU * k / NA
            z = zb(a) + (1.85 - zb(a)) * v
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, 0.008, z)), d, 0.3)
            row.append(loc + d * (0.012 + 0.01 * v * v * max(0.0, math.sin(a))))
        rows.append(row)
    cp = Part()
    cp.grid(rows, fan_top=(0, 0.02, 1.874))
    brim = []
    for zo, off in ((-0.004, 0.013), (0.02, 0.026), (0.046, 0.016)):
        row = []
        for k in range(NA):
            a = TAU * k / NA
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, 0.008, zb(a) + zo)), d, 0.3)
            row.append(loc + d * off)
        brim.append(row)
    cp.grid(brim)
    m.add(cp, COL['knit'], rough=0.95, bone='head', solidify=0.004, sol_offset=-1, recalc=False, tris=450)

    # ---------------- coat torso and sleeves
    c = Part()
    c.loft([(z, 0, cy, rx, ry) for z, cy, rx, ry in TORSO], seg=32)
    for s in 'LR':
        c.sphere(H('upperarm_' + s), (0.095, 0.088, 0.085), seg=16)
    m.add(c, COL['coat'], bones=['pelvis', 'spine', 'chest', 'clavicle_L', 'clavicle_R'], sigma=0.12, voxel=0.012, smooth=4,
          tris=1500)
    for s in 'LR':
        sh, el, wr = H('upperarm_' + s), H('forearm_' + s), H('hand_' + s)
        sl = Part()
        sl.capsule(sh, sh + (el - sh) * 0.45, 0.08, 0.075, seg=14)
        sl.capsule(sh + (el - sh) * 0.45, el, 0.075, 0.064, seg=14)
        sl.capsule(el, el + (wr - el) * 0.92, 0.066, 0.056, seg=14)
        sl.capsule(el + (wr - el) * 0.7, el + (wr - el) * 0.93, 0.061, 0.058, seg=14)
        m.add(sl, COL['coat'], bones=['clavicle_' + s, 'upperarm_' + s, 'forearm_' + s], sigma=0.07, voxel=0.01, smooth=3,
              tris=500)
    col = Part()
    col.loft([(1.54, 0, 0.03, 0.122, 0.106, 0.01), (1.585, 0, 0.034, 0.114, 0.1, 0.015),
              (1.625, 0, 0.038, 0.116, 0.102, 0.02)], seg=28, a0=-35, a1=215, caps=False, folds=4)
    m.add(col, COL['coat'], bones=['chest', 'neck'], sigma=0.08, solidify=0.012, recalc=False)

    # ---------------- long coat skirt (two panels) and trousers
    for a0, a1, ph in ((-72, 84, 0.0), (96, 252, 1.3)):
        sk = Part()
        sk.loft([(1.0, 0, 0.0, 0.168, 0.128, 0.0), (0.84, 0, 0.012, 0.205, 0.158, 0.02),
                 (0.66, 0, 0.022, 0.25, 0.195, 0.045), (0.48, 0, 0.03, 0.29, 0.225, 0.06),
                 (0.36, 0, 0.034, 0.31, 0.24, 0.07)], seg=28, a0=a0, a1=a1, caps=False, folds=7, phase=ph)
        for vtx in sk.bm.verts:
            if vtx.co.z < 0.37:
                vtx.co.z += 0.012 * noise.noise(vtx.co * 40)
        m.add(sk, COL['coat'], bones=['pelvis', 'thigh_L', 'thigh_R'], sigma=0.16, solidify=0.012, recalc=False)
    t = Part()
    t.sphere((0, 0.0, 0.97), (0.17, 0.125, 0.12), seg=16)
    for s in 'LR':
        t.capsule(H('thigh_' + s), H('calf_' + s), 0.1, 0.075, seg=14)
        t.capsule(H('calf_' + s), H('foot_' + s) + V((0, 0, 0.14)), 0.074, 0.06, seg=14)
    m.add(t, COL['pants'], bones=['pelvis', 'thigh_L', 'calf_L', 'thigh_R', 'calf_R'], sigma=0.08, voxel=0.012, smooth=4,
          tris=900)

    # ---------------- boots
    for s in 'LR':
        boot(m, H('foot_' + s), T_('foot_' + s), s)

    # ---------------- fists
    for s in 'LR':
        wr, hd_t = H('hand_' + s), T_('hand_' + s)
        dv = (hd_t - wr).normalized()
        u, v_, w = basis(dv, V((0, -1, 0)))
        g = Part()
        g.capsule(wr + dv * 0.01, wr + dv * 0.075, 0.042, 0.047, seg=14)
        for k in range(4):
            g.sphere(wr + dv * 0.085 + v_ * ((k - 1.5) * 0.02) + u * 0.012, 0.014, seg=8)
        g.capsule(wr + dv * 0.03 - u * 0.03, wr + dv * 0.07 - u * 0.04 + v_ * 0.02, 0.014, seg=8)
        m.add(g, COL['leather'], rough=0.6, bone='hand_' + s, voxel=0.006, smooth=2, tris=260)
        cf = Part()
        cf.sloft([(wr + dv * dz, u, v_, r_, r_) for dz, r_ in ((0.005, 0.046), (-0.03, 0.05), (-0.05, 0.057))], seg=18,
                 caps=False)
        m.add(cf, COL['leather'], rough=0.6, bones=['hand_' + s, 'forearm_' + s], sigma=0.05, solidify=0.004, recalc=False)

    # ---------------- breastplate, frieze, rim, faulds
    bp = Part()
    bp.loft([(z, 0, cy, rx, ry) for z, cy, rx, ry in BP], seg=24, a0=208, a1=332, caps=False)
    for vtx in bp.bm.verts:
        vtx.co.y -= ridge(vtx.co.x)
    m.add(bp, COL['steel'], rough=0.42, metal=0.9, bone='chest', solidify=0.01, recalc=False)
    fr = Part()
    rows = [[bp_pt(212 + 116 * k / 24, z, 0.0115) for k in range(25)] for z in (1.398, 1.438)]
    fr.grid(rows, closed=False)
    m.add(fr, COL['brass'], rough=0.3, metal=1.0, bone='chest', solidify=0.002, recalc=False)
    rim = ([(a, 1.45) for a in np.linspace(208, 332, 16)] + [(332, z) for z in np.linspace(1.43, 1.19, 4)]
           + [(a, 1.17) for a in np.linspace(332, 208, 16)] + [(208, z) for z in np.linspace(1.19, 1.43, 4)])
    rm = Part()
    rm.sweep([bp_pt(a, z, 0.005) for a, z in rim], 0.007, seg=6, closed=True)
    m.add(rm, COL['steel'], rough=0.4, metal=0.9, bone='chest')
    for z0, z1 in ((1.105, 1.178), (1.045, 1.115)):
        fl = Part()
        secs = []
        for z in (z1, z0):
            cy, rx, ry = interp(TORSO, z)
            secs.append((z, 0, cy, rx + 0.022, ry + 0.024))
        fl.loft(secs, seg=20, a0=214, a1=326, caps=False)
        m.add(fl, COL['steel'], rough=0.45, metal=0.85, bone='spine', solidify=0.005, recalc=False)

    # ---------------- pauldron on the left shoulder, lames, bracer
    pd = Part()
    import bmesh
    bmesh.ops.create_uvsphere(pd.bm, u_segments=24, v_segments=12, radius=0.15)
    for vtx in pd.bm.verts[:]:
        if vtx.co.z < 0.095:
            pd.bm.verts.remove(vtx)
    for vtx in pd.bm.verts:
        vtx.co.z -= 0.095
    sh = H('upperarm_L')
    PM = Matrix.Translation(sh + V((0.035, 0.0, 0.065))) @ Matrix.Rotation(math.radians(-40), 4, 'Y') @ Matrix.Diagonal((1.0, 1.15, 1.9, 1))
    for v in pd.bm.verts:
        v.co = PM @ v.co
    m.add(pd, COL['brass'], rough=0.3, metal=1.0, bone='upperarm_L', solidify=0.006, recalc=False)
    rr = math.sqrt(0.15 ** 2 - 0.095 ** 2)
    pr = Part()
    pr.sweep([PM @ V((rr * math.cos(a), rr * math.sin(a), 0.0)) for a in np.linspace(0, TAU, 24, endpoint=False)], 0.006,
             seg=6, closed=True)
    m.add(pr, COL['brass'], rough=0.3, metal=1.0, bone='upperarm_L')
    ua = (H('forearm_L') - sh).normalized()
    q = ua.to_track_quat('Z', 'X').to_matrix().to_4x4()
    for t_, rr_ in ((0.3, 0.096), (0.48, 0.09)):
        lm = Part()
        lm.loft([(0, 0, 0, rr_, rr_), (0.06, 0, 0, rr_ * 0.97, rr_ * 0.97)], seg=16, a0=-95, a1=95, caps=False)
        LM = Matrix.Translation(sh + ua * (0.33 * t_)) @ q
        for v in lm.bm.verts:
            v.co = LM @ v.co
        m.add(lm, COL['steel'], rough=0.42, metal=0.9, bone='upperarm_L', solidify=0.005, recalc=False)
    el, wr = H('forearm_L'), H('hand_L')
    fw = (wr - el).normalized()
    br = Part()
    br.loft([(0, 0, 0, 0.071, 0.071), (0.12, 0, 0, 0.066, 0.066)], seg=18, caps=False)
    BM = Matrix.Translation(el + fw * 0.07) @ fw.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for v in br.bm.verts:
        v.co = BM @ v.co
    m.add(br, COL['steel'], rough=0.42, metal=0.9, bone='forearm_L', solidify=0.005, recalc=False)

    # ---------------- belt, buckle, pouches, lantern
    bl = Part()
    bl.loft([(0.965, 0, 0, 0.18, 0.139), (1.035, 0, 0, 0.18, 0.139)], seg=32, caps=False)
    m.add(bl, COL['leather'], rough=0.55, bone='pelvis', solidify=0.008, recalc=False)
    bk = Part()
    bk.box((0, -0.15, 1.0), (0.07, 0.012, 0.058))
    m.add(bk, COL['brass'], rough=0.3, metal=1.0, bone='pelvis')
    for a in (205, 158):
        ar = math.radians(a)
        n = V((math.cos(ar), math.sin(ar), 0))
        tg = V((-n.y, n.x, 0))
        base = V((0.182 * math.cos(ar), 0.141 * math.sin(ar), 0.93)) + n * 0.03
        R = Matrix((tg, n, V((0, 0, 1)))).transposed().to_4x4()
        p = Part()
        p.box(base, (0.09, 0.055, 0.1), R)
        p.box(base + n * 0.03 + V((0, 0, 0.03)), (0.096, 0.01, 0.05), R)
        m.add(p, COL['leather'], rough=0.55, bone='pelvis', bevel=0.008)
    ar = math.radians(335)
    n = V((math.cos(ar), math.sin(ar), 0))
    hook = V((0.186 * math.cos(ar), 0.145 * math.sin(ar), 0.975)) + n * 0.012
    ctr = hook + n * 0.045 - V((0, 0, 0.12))
    lp = Part()
    lp.sloft([(ctr + V((0, 0, 0.058)), V((1, 0, 0)), V((0, 1, 0)), 0.01, 0.01),
              (ctr + V((0, 0, 0.042)), V((1, 0, 0)), V((0, 1, 0)), 0.03, 0.03),
              (ctr + V((0, 0, 0.034)), V((1, 0, 0)), V((0, 1, 0)), 0.037, 0.037)], seg=8)
    lp.sloft([(ctr + V((0, 0, -0.036)), V((1, 0, 0)), V((0, 1, 0)), 0.036, 0.036),
              (ctr + V((0, 0, -0.046)), V((1, 0, 0)), V((0, 1, 0)), 0.03, 0.03)], seg=8)
    for k in range(8):
        a_ = TAU * (k + 0.5) / 8
        lp.capsule(ctr + V((0.033 * math.cos(a_), 0.033 * math.sin(a_), -0.036)),
                   ctr + V((0.033 * math.cos(a_), 0.033 * math.sin(a_), 0.034)), 0.0028, seg=5)
    lp.capsule(hook, ctr + V((0, 0, 0.06)), 0.004, seg=5)
    m.add(lp, COL['brass'], rough=0.3, metal=1.0, bone='pelvis')
    gl = Part()
    gl.sloft([(ctr + V((0, 0, -0.034)), V((1, 0, 0)), V((0, 1, 0)), 0.029, 0.029),
              (ctr + V((0, 0, 0.032)), V((1, 0, 0)), V((0, 1, 0)), 0.029, 0.029)], seg=8)
    m.add(gl, COL['glass'], rough=0.2, emit=0.6, bone='pelvis')
    m.lantern = ctr

    # ---------------- bandolier strap
    body = trees(*[it['ob'] for it in m.items[:6]])
    path = [(330, 1.52), (300, 1.45), (270, 1.35), (240, 1.23), (215, 1.12), (190, 1.06), (160, 1.1),
            (130, 1.2), (100, 1.31), (70, 1.42), (40, 1.5), (10, 1.54), (350, 1.53)]
    st = Part()
    pts = resample(wrap(body, path, 0.02), 48)
    st.sweep(pts, (0.0045, 0.02), seg=6, hint=lambda i, p: V((p.x, p.y, 0)), closed=True)
    m.add(st, COL['leather'], rough=0.55, bones=['chest', 'spine'], sigma=0.15)

    # ---------------- scarf: face cover, two flat wraps, knot, tails
    NA, NR = 48, 7
    zb2 = lambda a: 1.578 - 0.034 * max(0.0, -math.sin(a)) ** 2
    zt2 = lambda a: 1.688 - 0.024 * math.sin(a)
    rows = []
    for i in range(NR):
        v = i / (NR - 1)
        rr_ = []
        for k in range(NA):
            a = TAU * k / NA
            z = zb2(a) + (zt2(a) - zb2(a)) * v
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, -0.005, z)), d, 0.3)
            rr_.append(((loc - V((0, -0.005, z))).length, z, d))
        r = [x[0] for x in rr_]
        for _ in range(6):
            r = [max(r[k], 0.5 * (r[k - 1] + r[(k + 1) % NA])) for k in range(NA)]
        rows.append([V((0, -0.005, rr_[k][1])) + rr_[k][2] * (r[k] + 0.009 + 0.01 * (1 - v) ** 2 * max(0.0, -math.sin(TAU * k / NA)))
                     for k in range(NA)])
    sc = Part()
    sc.grid(rows)
    for zc, tilt, rx, ry, ph in ((1.55, 6, 0.132, 0.126, 0.0), (1.598, -17, 0.118, 0.112, 1.3)):
        Rt = Matrix.Rotation(math.radians(tilt), 3, 'X')
        pts = [V((0, 0.012, zc)) + Rt @ V((rx * (1 + 0.045 * math.sin(a * 9 + ph)) * math.cos(a),
                                            ry * (1 + 0.045 * math.sin(a * 9 + ph)) * math.sin(a), 0))
               for a in np.linspace(0, TAU, 40, endpoint=False)]
        sc.sweep(pts, lambda t, ph=ph: (0.0085 * (1 + 0.45 * math.sin(t * TAU * 11 + ph)), 0.036), seg=8,
                 hint=lambda i, p: V((p.x, p.y - 0.012, 0)), closed=True)
    m.add(sc, COL['scarf'], rough=0.92, bones=['head', 'neck', 'chest'], sigma=0.07, solidify=0.004, sol_offset=-1,
          recalc=False, tris=900)
    knot = V((0.092, -0.112, 1.548))
    kn = Part()
    kn.sphere(knot, (0.026, 0.02, 0.028), seg=12)
    for x0, x1, z1, off, w0 in ((0.1, 0.135, 1.27, 0.03, 0.032), (0.075, 0.08, 1.37, 0.04, 0.028)):
        tp = []
        for i in range(10):
            tt = i / 9
            z = knot.z - 0.015 - (knot.z - 0.015 - z1) * tt
            x = x0 + (x1 - x0) * tt
            y = -0.2 - off - 0.01 * tt
            tp.append(V((x, y + 0.01 * math.sin(tt * 5), z)))
        kn.sweep(tp, (0.0055, w0), seg=6, hint=V((0, -1, 0)))
    m.add(kn, COL['scarf'], rough=0.92, bone='chest')
    return m


def boot(m, an, to, s):
    g = V((an.x, an.y, 0))
    f = V((to.x - an.x, to.y - an.y, 0)).normalized()
    sd = f.cross(V((0, 0, 1))).normalized()
    Z = V((0, 0, 1))
    SOLE = 0.024
    up_secs = [(-0.075, 0.066, 0.075), (-0.06, 0.082, 0.1), (-0.03, 0.09, 0.12), (0.0, 0.094, 0.118), (0.04, 0.098, 0.098),
               (0.08, 0.102, 0.08), (0.12, 0.102, 0.066), (0.155, 0.097, 0.056), (0.185, 0.086, 0.049),
               (0.205, 0.068, 0.043), (0.218, 0.044, 0.035), (0.224, 0.02, 0.026)]
    b = Part()
    b.sloft([(g + f * t + Z * (SOLE + hh / 2), sd, Z, w / 2, hh / 2) for t, w, hh in up_secs], seg=16, p=3.0)
    shaft = []
    for z in np.linspace(0.08, 0.3, 6):
        k = (z - 0.08) / 0.22
        shaft.append((V((an.x, an.y, z)) + f * (0.006 * k), f, sd, 0.063 + 0.013 * k, 0.056 + 0.011 * k))
    b.sloft(shaft, seg=16, p=2.2)
    b.sloft([(V((an.x, an.y, z)) + f * 0.006, f, sd, 0.078 + o, 0.068 + o) for z, o in ((0.29, 0.0), (0.305, 0.006), (0.325, 0.004))],
            seg=16, p=2.2)
    m.add(b, COL['boot'], rough=0.5, bones=['calf_' + s, 'foot_' + s], sigma=0.06, voxel=0.008, smooth=2, tris=450)
    sl = Part()
    sole_secs = [(-0.085, 0.07), (-0.07, 0.088), (-0.04, 0.098), (0.0, 0.104), (0.06, 0.11), (0.12, 0.114),
                 (0.17, 0.106), (0.205, 0.084), (0.225, 0.056), (0.234, 0.026)]
    sl.sloft([(g + f * t + Z * (SOLE / 2), sd, Z, w / 2 + 0.003, SOLE / 2) for t, w in sole_secs], seg=12, p=6.0)
    m.add(sl, COL['sole'], rough=0.8, bone='foot_' + s)
    # laces up the front of the shaft, as a single zig-zag strip (reads at game scale)
    lp = []
    for i, z in enumerate(np.linspace(0.11, 0.28, 7)):
        k = (z - 0.08) / 0.22
        front = V((an.x, an.y, z)) + f * (0.006 * k + (0.063 + 0.013 * k) * 0.99)
        lp.append(front + sd * (0.018 if i % 2 else -0.018))
    lc = Part()
    lc.sweep(lp, 0.0035, seg=5)
    m.add(lc, COL['lace'], rough=0.9, bones=['calf_' + s], sigma=0.1)


def build_maul():
    """Weapon frame: grip at the origin, haft along +Z, the head's long axis along X."""
    m = Model('maul')
    p = Part()
    p.capsule((0, 0, -0.3), (0, 0, 0.78), 0.018, seg=10)
    m.add(p, COL['iron'], rough=0.45, metal=0.85, flat=False)
    w = Part()
    gp = [V((0.0205 * math.cos(k * 0.6), 0.0205 * math.sin(k * 0.6), -0.28 + 0.3 * k / 90)) for k in range(91)]
    w.sweep(gp, 0.004, seg=5)
    m.add(w, COL['leather'], rough=0.6)
    hd = Part()
    hd.box((0, 0, 0.8), (0.36, 0.17, 0.17))
    m.add(hd, COL['iron'], rough=0.45, metal=0.85, bevel=0.02, flat=True)
    for off in (-0.14, 0.14):
        b = Part()
        b.box((off, 0, 0.8), (0.035, 0.185, 0.185))
        m.add(b, COL['brass'], rough=0.3, metal=1.0, flat=True)
    for sg in (-1, 1):
        f = Part()
        f.box((sg * 0.183, 0, 0.8), (0.006, 0.13, 0.13))
        m.add(f, COL['brass'], rough=0.3, metal=1.0, flat=True)
    c = Part()
    c.sloft([(V((0, 0, 0.8 - 0.085 - dz)), V((1, 0, 0)), V((0, 1, 0)), r, r) for dz, r in ((0.075, 0.021), (0.03, 0.026), (0.0, 0.032))], seg=12)
    m.add(c, COL['iron'], rough=0.45, metal=0.85)
    pm = Part()
    pm.sphere((0, 0, -0.33), 0.03, seg=12)
    m.add(pm, COL['brass'], rough=0.3, metal=1.0)
    return m


# ====================================================================== animation
def chest_frame(P):
    W = P.world()
    return W['chest'][0], W['chest'][1], W


STANCE = dict(grip=V((-0.13, -0.24, 1.36)), h=V((-0.5, 0.7, 0.78)).normalized())


def hold_maul(P, grip, h, face=None, pole_r=V((-0.9, 0.3, -0.4)), pole_l=V((0.9, -0.2, -0.5)), left_gap=0.36):
    """Both hands on the haft: right palm at `grip`, left palm lower down the haft. Positions in model space."""
    face = face or h.cross(V((0, 0, 1))).normalized()
    wr = frame_rot(h, face)
    W = P.world()
    P.arm_ik('R', grip, W['upperarm_R'][1] + pole_r, weapon_rot=wr, wrist_rot=wr)
    W = P.world()
    lpos = grip - h * left_gap
    P.arm_ik('L', lpos, W['upperarm_L'][1] + pole_l, wrist_rot=wr)


def chest_space(P, local):
    """A point given relative to the chest's bind head, carried along with the chest's current motion."""
    cr, cp, W = chest_frame(P)
    return cp + cr @ (local - P.J['chest'][0])


def breathe(P, t, amt=1.0):
    P.rot['chest'] = eul(cyc(t, 2.4, 2.0 * amt), 0, 0) @ P.rot['chest']
    P.off['pelvis'] = V((0, 0, cyc(t, 2.4, 0.006 * amt)))


def stance_legs(P, t, crouch=0.0):
    P.rot['thigh_L'] = eul(-8 - 10 * crouch, 0, 6)
    P.rot['calf_L'] = eul(12 + 22 * crouch, 0, 0)
    P.rot['foot_L'] = eul(-4 - 12 * crouch, 0, -6)
    P.rot['thigh_R'] = eul(10 - 10 * crouch, 0, -8)
    P.rot['calf_R'] = eul(6 + 22 * crouch, 0, 0)
    P.rot['foot_R'] = eul(-16 - 12 * crouch, 0, 8)
    P.off['pelvis'] = P.off['pelvis'] + V((0, 0, -0.03 - 0.1 * crouch))


def idle(P, t):
    P.rot['pelvis'] = eul(0, 0, -12)
    P.rot['spine'] = eul(4, 0, 6)
    stance_legs(P, t)
    breathe(P, t)
    P.rot['head'] = eul(-4 + cyc(t, 4.8, 2), 0, 8 + cyc(t, 6.0, 3))
    hold_maul(P, chest_space(P, STANCE['grip']), STANCE['h'])


def run(P, t):
    T = 0.62
    ph = t / T * math.tau
    P.rot['pelvis'] = eul(0, 0, 8 * math.sin(ph))
    P.off['pelvis'] = V((0, 0, -0.03 + 0.035 * abs(math.sin(ph)) - 0.015))
    P.rot['spine'] = eul(10, 0, -10 * math.sin(ph))
    P.rot['chest'] = eul(4 + 2 * math.sin(ph * 2), 0, -4 * math.sin(ph))
    for s, o in (('L', 0.0), ('R', math.pi)):
        a = ph + o
        swing = 38 * math.sin(a)
        P.rot['thigh_' + s] = eul(-swing - 8, 0, 0)
        knee = 18 + 55 * max(0.0, math.sin(a - 1.2)) + 20 * max(0.0, -math.sin(a))
        P.rot['calf_' + s] = eul(knee, 0, 0)
        P.rot['foot_' + s] = eul(-10 + 18 * math.sin(a - 0.4), 0, 0)
    P.rot['head'] = eul(-8, 0, 4 * math.sin(ph))
    bob = V((0, 0, 0.012 * math.sin(ph * 2)))
    hold_maul(P, chest_space(P, STANCE['grip'] + bob), STANCE['h'])


def slam(P, t):
    # windup 0 -> 0.34, strike to 0.47 (impact), recover to 0.9
    up = keys(t, [(0.0, 0.0), (0.34, 1.0), (0.44, 1.0), (0.47, 0.0)])
    down = keys(t, [(0.36, 0.0), (0.47, 1.0), (0.62, 1.0), (0.9, 0.0)])
    P.rot['pelvis'] = eul(0, 0, -12 * (1 - down))
    P.rot['spine'] = eul(4 - 14 * up + 24 * down, 0, 6 * (1 - up - down))
    P.rot['chest'] = eul(-10 * up + 16 * down, 0, 0)
    stance_legs(P, t, crouch=0.2 * up + 0.9 * down)
    P.rot['head'] = eul(-4 - 10 * up + 6 * down, 0, 0)
    base_g, base_h = STANCE['grip'], STANCE['h']
    over_g, over_h = V((-0.02, 0.02, 1.98)), V((0.0, 0.55, 0.35)).normalized()
    hit_g, hit_h = V((0.0, -0.5, 0.95)), V((0.0, -0.72, -0.7)).normalized()
    g = base_g.lerp(over_g, up)
    hv = base_h.lerp(over_h, up)
    if down > 0:
        g = (over_g if up > 0.5 else g).lerp(hit_g, down) if t < 0.62 else hit_g.lerp(base_g, 1 - down)
        hv = (over_h if up > 0.5 else hv).lerp(hit_h, down) if t < 0.62 else hit_h.lerp(base_h, 1 - down)
    hold_maul(P, chest_space(P, g), hv.normalized(), face=V((1, 0, 0)), left_gap=0.3)


def swing(P, t):
    wind = keys(t, [(0.0, 0.0), (0.22, 1.0), (0.26, 1.0)])
    sw = keys(t, [(0.24, 0.0), (0.36, 1.0), (0.46, 1.0), (0.72, 0.0)])
    turn = 40 * wind - 70 * sw
    P.rot['pelvis'] = eul(0, 0, -12 + turn * 0.4)
    P.rot['spine'] = eul(6, 0, turn * 0.3)
    P.rot['chest'] = eul(4, 0, turn * 0.4)
    stance_legs(P, t, crouch=0.3 * wind + 0.4 * sw)
    wind_g, wind_h = V((-0.3, 0.05, 1.18)), V((-0.6, 0.6, 0.35)).normalized()
    end_g, end_h = V((0.28, -0.3, 1.15)), V((0.75, -0.55, 0.1)).normalized()
    g = STANCE['grip'].lerp(wind_g, wind)
    hv = STANCE['h'].lerp(wind_h, wind)
    if sw > 0:
        if t < 0.46:
            g, hv = wind_g.lerp(end_g, sw), wind_h.lerp(end_h, sw)
        else:
            g, hv = STANCE['grip'].lerp(end_g, sw), STANCE['h'].lerp(end_h, sw)
    hold_maul(P, chest_space(P, g), hv.normalized(), face=V((0, 0, 1)), left_gap=0.28)


def warcry(P, t):
    k = keys(t, [(0.0, 0.0), (0.25, 1.0), (0.6, 1.0), (0.85, 0.0)])
    P.rot['spine'] = eul(-12 * k, 0, 0)
    P.rot['chest'] = eul(-14 * k, 0, 0)
    P.rot['head'] = eul(-22 * k, 0, 0)
    stance_legs(P, t, crouch=0.35 * k)
    g = STANCE['grip'].lerp(V((-0.28, -0.12, 1.9)), k)
    hv = STANCE['h'].lerp(V((-0.2, 0.2, 1.0)).normalized(), k)
    wr = frame_rot(hv.normalized(), V((1, 0, 0)))
    W = P.world()
    P.arm_ik('R', chest_space(P, g), W['upperarm_R'][1] + V((-0.9, 0.3, -0.3)), weapon_rot=wr, wrist_rot=wr)
    W = P.world()
    P.arm_ik('L', chest_space(P, V((0.34, -0.28, 1.5 - 0.35 * (1 - k)))), W['upperarm_L'][1] + V((0.8, 0.4, -0.5)))


def dodge(P, t):
    r = keys(t, [(0.0, 0.0), (0.42, 1.0)])
    tuck = keys(t, [(0.0, 0.0), (0.08, 1.0), (0.34, 1.0), (0.46, 0.0)])
    P.off['root'] = V((0, 0, 0.55))
    P.off['pelvis'] = V((0, 0, -0.55 - 0.12 * tuck))
    P.rot['root'] = eul(360 * r, 0, 0)
    P.rot['spine'] = eul(30 * tuck, 0, 0)
    P.rot['chest'] = eul(25 * tuck, 0, 0)
    P.rot['head'] = eul(20 * tuck, 0, 0)
    for s in 'LR':
        P.rot['thigh_' + s] = eul(-95 * tuck, 0, 0)
        P.rot['calf_' + s] = eul(120 * tuck, 0, 0)
    hold_maul(P, chest_space(P, STANCE['grip'].lerp(V((-0.05, -0.3, 1.25)), tuck)), STANCE['h'])


def hit(P, t):
    k = keys(t, [(0.0, 0.0), (0.06, 1.0), (0.3, 0.0)])
    idle(P, t)
    P.rot['chest'] = eul(-14 * k, 0, 8 * k) @ P.rot['chest']
    P.rot['head'] = eul(-18 * k, 0, 0) @ P.rot['head']


def death(P, t):
    k = keys(t, [(0.0, 0.0), (0.7, 1.0)], ease=lambda u: u * u)
    b = keys(t, [(0.7, 0.0), (0.8, 1.0), (0.95, 0.0)])
    P.rot['root'] = eul(-(88 * k - 4 * b), 0, 0)
    P.rot['spine'] = eul(-12 * k, 0, 0)
    P.rot['head'] = eul(-25 * k, 0, 10 * k)
    for s, sg in (('L', 1), ('R', -1)):
        P.rot['thigh_' + s] = eul(-20 * k, 0, sg * 10 * k)
        P.rot['calf_' + s] = eul(30 * k, 0, 0)
        P.rot['upperarm_' + s] = eul(-20 * k, sg * -40 * k, 0)
        P.rot['forearm_' + s] = eul(-30 * k, 0, 0)


CLIPS = [
    Clip('idle', 2.4, idle, loop=True),
    Clip('run', 0.62, run, loop=True),
    Clip('slam', 0.9, slam, events={'hit': 0.47}),
    Clip('swing', 0.72, swing, events={'hit': 0.34}),
    Clip('warcry', 0.85, warcry, events={'cry': 0.3}),
    Clip('dodge', 0.46, dodge),
    Clip('hit', 0.3, hit),
    Clip('death', 1.4, death),
]
