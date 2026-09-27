"""QAHIRA — the Warrior, detail pass (v3). Everything here is generated; nothing is sculpted or downloaded.

usage: Blender -b --factory-startup -P warrior3.py -- <outdir> <preview|final> [hero,turn,game,details]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
import core
from core import *  # noqa: F401,F403

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
FINAL = len(argv) > 1 and argv[1] == 'final'
VIEWS = (argv[2] if len(argv) > 2 else 'hero,turn,game,details').split(',')
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
core.scene = scene

# ------------------------------------------------------------------ proportions
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


J = dict(shL=V((0.235, 0.02, 1.47)), shR=V((-0.235, 0.02, 1.47)),
         elL=V((0.315, -0.12, 1.2)), elR=V((-0.37, -0.03, 1.2)),
         hipL=V((0.11, 0.0, 0.96)), hipR=V((-0.11, 0.0, 0.96)),
         knL=V((0.16, -0.06, 0.53)), knR=V((-0.18, 0.04, 0.53)),
         anL=V((0.18, -0.02, 0.1)), anR=V((-0.235, 0.09, 0.1)),
         toL=V((0.2, -0.21, 0.045)), toR=V((-0.29, -0.1, 0.045)))
P_head, P_end = V((-0.4, 0.31, 1.88)), V((0.1, -0.39, 1.1))
AX = (P_head - P_end).normalized()


def on_haft(p):
    return P_end + AX * (V(p) - P_end).dot(AX)


J['gripR'] = on_haft((-0.12, -0.115, 1.41))
J['gripL'] = on_haft((0.075, -0.345, 1.15))
for s in 'LR':
    J['wr' + s] = J['grip' + s] + (J['el' + s] - J['grip' + s]).normalized() * 0.085


def materials():
    engr, frz = engraving_image(), frieze_image()
    M = dict(
        skin=material('skin', '#8A573C', rough=0.5, vary=0.08, bump=0.08, scale=500),
        scar=material('scar', '#A67659', rough=0.45, vary=0.05, bump=0.05, scale=500),
        hair=material('hair', '#14100D', rough=0.75, bump=0.8, scale=1400),
        knit=material('knit', '#2B2A2E', rough=0.95, vary=0.15, bump=0.4, scale=500, weave=900, sheen=0.15),
        coat=material('coat', '#34332C', rough=0.88, vary=0.2, bump=0.25, scale=260, sheen=0.15, weave=700, dust=0.3, wear=0.35),
        thread=material('thread', '#9A866A', rough=0.8, vary=0.1, bump=0.1, scale=600),
        patch=material('patch', '#5B5A42', rough=0.9, vary=0.2, bump=0.3, scale=300, weave=900, wear=0.5),
        pants=material('pants', '#2A292E', rough=0.85, vary=0.12, bump=0.25, scale=300, sheen=0.1, weave=800, dust=0.35),
        boot=material('boot', '#3A2920', rough=0.5, vary=0.25, bump=0.25, scale=90, wear=0.7, dust=0.35),
        cuff=material('cuff', '#4A3528', rough=0.55, vary=0.25, bump=0.3, scale=90, wear=0.7, dust=0.15),
        sole=material('sole', '#17120F', rough=0.8, vary=0.1, bump=0.4, scale=60, dust=0.4),
        lace=material('lace', '#6E5A42', rough=0.9, vary=0.1, bump=0.3, scale=800),
        leather=material('leather', '#33271F', rough=0.55, vary=0.25, bump=0.3, scale=110, wear=0.9),
        tooled=material('tooled', '#3B2B20', rough=0.55, vary=0.25, bump=0.25, scale=110, wear=0.9, image=frz, img_bump=0.6, img_dist=0.002),
        wrap=material('wrap', '#8C7E68', rough=0.9, vary=0.18, bump=0.5, scale=500, weave=1200),
        scarf=material('scarf', '#5A1511', rough=0.92, vary=0.18, bump=0.3, scale=350, sheen=0.12, weave=1100),
        steel=material('steel', '#6A6E74', rough=0.42, metal=0.9, vary=0.3, bump=0.15, scale=40, wear=1.0, scratch=0.06),
        iron=material('iron', '#4A4D52', rough=0.45, metal=0.85, vary=0.35, bump=0.3, scale=30, wear=1.0, scratch=0.08),
        brass=material('brass', '#C89A45', rough=0.3, metal=1.0, vary=0.18, bump=0.08, scale=60, image=engr, wear=0.6),
        brass_frieze=material('brass_frieze', '#C89A45', rough=0.3, metal=1.0, vary=0.18, bump=0.08, scale=60, image=frz, img_bump=0.8, img_dist=0.0015, wear=0.6),
        brass_plain=material('brass_plain', '#C89A45', rough=0.33, metal=1.0, vary=0.18, bump=0.08, scale=60, wear=0.6),
        eye=material('eye', '#FFB347', rough=0.3, emit='#FF9E2C', strength=18.0),
        glass=material('glass', '#FFB04A', rough=0.2, emit='#FFB04A', strength=14.0),
    )
    return M


# ------------------------------------------------------------------ the Warrior
def build_warrior():
    coll = bpy.data.collections.new('Warrior')
    scene.collection.children.link(coll)
    M = materials()
    B = Batch(coll)

    # ---------------- head, eyes, lids, brows, scar
    h = Part()
    h.sphere((0, 0.008, 1.745), (0.086, 0.1, 0.112), seg=48)
    h.capsule((-0.05, -0.078, 1.758), (0.05, -0.078, 1.758), 0.019)
    for sx in (-1, 1):
        h.sphere((sx * 0.085, 0.008, 1.722), (0.013, 0.028, 0.035))
        h.sphere((sx * 0.05, -0.068, 1.712), (0.022, 0.016, 0.014))
    h.sphere((0, -0.03, 1.66), (0.074, 0.08, 0.07), seg=32)
    h.capsule((0, -0.09, 1.742), (0, -0.101, 1.705), 0.01, 0.013)
    h.capsule((0, 0.015, 1.5), (0, 0.0, 1.66), 0.066)
    head = h.build('head', M['skin'], coll, voxel=0.0025, smooth=3)
    for sx in (-1, 1):
        e = Part()
        e.sphere((sx * 0.033, -0.086, 1.728), (0.0135, 0.006, 0.0065), seg=16)
        e.build('eye', M['eye'], coll)
        B('hair').capsule((sx * 0.013, -0.1, 1.743), (sx * 0.035, -0.098, 1.749), 0.0042, 0.0036, seg=8)
        B('hair').capsule((sx * 0.035, -0.098, 1.749), (sx * 0.055, -0.089, 1.751), 0.0036, 0.0022, seg=8)
    B('scar').capsule((0.024, -0.1, 1.778), (0.046, -0.094, 1.742), 0.0022, 0.0016, seg=8)

    # ---------------- knit watch cap, fitted by ray casting against the skull
    th = trees(head)
    NA = 96
    zb = lambda a: 1.752 - 0.016 * math.sin(a)  # higher over the brow, lower at the nape
    rows = []
    for i in range(16):
        v = i / 15
        row = []
        for k in range(NA):
            a = TAU * k / NA
            z = zb(a) + (1.85 - zb(a)) * v
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, 0.008, z)), d, 0.3)
            rib = 0.0017 * abs(math.sin(a * 40))
            row.append(loc + d * (0.008 + rib + 0.01 * v * v * max(0.0, math.sin(a))))
        rows.append(row)
    cp = Part()
    cp.grid(rows, fan_top=(0, 0.02, 1.872))
    cp.build('cap', M['knit'], coll, solidify=0.004, sol_offset=-1, subsurf=1, recalc=False)
    brim = []
    for zo, off in ((-0.004, 0.009), (0.012, 0.022), (0.034, 0.022), (0.046, 0.012)):
        row = []
        for k in range(NA):
            a = TAU * k / NA
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, 0.008, zb(a) + zo)), d, 0.3)
            row.append(loc + d * (off + 0.0022 * abs(math.sin(a * 40))))
        brim.append(row)
    br = Part()
    br.grid(brim)
    br.build('cap_brim', M['knit'], coll, solidify=0.003, sol_offset=-1, subsurf=1, recalc=False)

    # ---------------- coat: torso, deltoids, sleeves
    c = Part()
    c.loft([(z, 0, cy, rx, ry) for z, cy, rx, ry in TORSO], seg=56)
    for s in 'LR':
        sh, el, wr = J['sh' + s], J['el' + s], J['wr' + s]
        c.sphere(sh, (0.095, 0.088, 0.085))
        mid = sh + (el - sh) * 0.4
        c.capsule(sh, mid, 0.08, 0.075)
        c.capsule(mid, el, 0.075, 0.064)
        fa = el + (wr - el) * 0.35
        end = el + (wr - el) * 0.93
        c.capsule(el, fa, 0.066, 0.064)
        c.capsule(fa, end, 0.064, 0.056)
        c.capsule(el + (wr - el) * 0.7, end, 0.061, 0.058)  # turned-back cuff
    coat = c.build('coat', M['coat'], coll, voxel=0.0045, smooth=6)
    col = Part()
    col.loft([(1.54, 0, 0.03, 0.122, 0.106, 0.01), (1.585, 0, 0.034, 0.114, 0.1, 0.015),
              (1.625, 0, 0.038, 0.116, 0.102, 0.02)], seg=56, a0=-35, a1=215, caps=False, folds=4)
    collar = col.build('collar', M['coat'], coll, solidify=0.012, subsurf=2, recalc=False)

    # ---------------- long skirt: two panels, deep folds, frayed hem
    skirts = []
    for a0, a1, ph in ((-72, 84, 0.0), (96, 252, 1.3)):
        sk = Part()
        sk.loft([(1.0, 0, 0.0, 0.168, 0.128, 0.0), (0.84, 0, 0.012, 0.205, 0.158, 0.02),
                 (0.66, 0, 0.022, 0.25, 0.195, 0.045), (0.48, 0, 0.03, 0.29, 0.225, 0.06),
                 (0.36, 0, 0.034, 0.31, 0.24, 0.07)], seg=48, a0=a0, a1=a1, caps=False, folds=7, phase=ph)
        for vtx in sk.bm.verts:
            if vtx.co.z < 0.37:
                vtx.co.z += 0.012 * noise.noise(vtx.co * 40) + 0.004 * math.sin(vtx.co.x * 90)
        skirts.append(sk.build('skirt', M['coat'], coll, solidify=0.012, subsurf=2, recalc=False))

    # ---------------- trousers
    t = Part()
    t.sphere((0, 0.0, 0.97), (0.17, 0.125, 0.12))
    for s in 'LR':
        t.capsule(J['hip' + s], J['kn' + s], 0.1, 0.075)
        t.capsule(J['kn' + s], J['an' + s] + V((0, 0, 0.14)), 0.074, 0.06)
    t.build('trousers', M['pants'], coll, voxel=0.0045, smooth=6)

    # ---------------- boots
    for s in 'LR':
        boot(J['an' + s], J['to' + s], M, coll, B)

    # ---------------- breastplate, frieze band, rims, rivets, faulds
    bp = Part()
    bp.loft([(z, 0, cy, rx, ry) for z, cy, rx, ry in BP], seg=48, a0=208, a1=332, caps=False)
    for vtx in bp.bm.verts:
        vtx.co.y -= ridge(vtx.co.x)
    plate = bp.build('breastplate', M['steel'], coll, solidify=0.01, subsurf=2, recalc=False)
    fr = Part()
    rows, uvs = [], []
    for z in (1.398, 1.438):
        rows.append([bp_pt(212 + 116 * k / 60, z, 0.0115) for k in range(61)])
        uvs.append([((k / 60) * 10 / 8, (z - 1.398) / 0.04) for k in range(61)])
    fr.grid(rows, closed=False, uvs=uvs)
    fr.build('bp_frieze', M['brass_frieze'], coll, solidify=0.002, recalc=False)
    rim = ([(a, 1.45) for a in np.linspace(208, 332, 40)] + [(332, z) for z in np.linspace(1.44, 1.18, 10)]
           + [(a, 1.17) for a in np.linspace(332, 208, 40)] + [(208, z) for z in np.linspace(1.18, 1.44, 10)])
    B('steel').sweep([bp_pt(a, z, 0.005) for a, z in rim], 0.007, seg=10, closed=True)
    for a in np.linspace(214, 326, 11):
        B('brass_plain').sphere(bp_pt(a, 1.378, 0.012), 0.0055, seg=10)
        B('brass_plain').sphere(bp_pt(a, 1.188, 0.012), 0.0055, seg=10)
    faulds = []
    for z0, z1 in ((1.105, 1.178), (1.045, 1.115)):
        fl = Part()
        secs = []
        for z in (z1, (z0 + z1) / 2, z0):
            cy, rx, ry = interp(TORSO, z)
            secs.append((z, 0, cy, rx + 0.022, ry + 0.024))
        fl.loft(secs, seg=40, a0=214, a1=326, caps=False)
        faulds.append(fl.build('fauld', M['steel'], coll, solidify=0.005, subsurf=1, recalc=False))
        cy, rx, ry = interp(TORSO, z0)
        B('steel').sweep([V(((rx + 0.024) * math.cos(math.radians(a)), cy + (ry + 0.026) * math.sin(math.radians(a)), z0))
                          for a in np.linspace(214, 326, 30)], 0.004, seg=8)
        for a in (219, 321):
            cy, rx, ry = interp(TORSO, (z0 + z1) / 2)
            B('brass_plain').sphere(((rx + 0.028) * math.cos(math.radians(a)),
                                     cy + (ry + 0.03) * math.sin(math.radians(a)), (z0 + z1) / 2), 0.006, seg=10)

    # ---------------- pauldron (engraved brass tray) with rolled rim, rivets, lames
    pd = Part()
    bmesh.ops.create_uvsphere(pd.bm, u_segments=64, v_segments=32, radius=0.15)
    for vtx in pd.bm.verts[:]:
        if vtx.co.z < 0.095:
            pd.bm.verts.remove(vtx)
    uv = pd.bm.loops.layers.uv.new('UVMap')
    for f_ in pd.bm.faces:
        for lp in f_.loops:
            lp[uv].uv = (lp.vert.co.x / 0.15 * 0.5 + 0.5, lp.vert.co.y / 0.15 * 0.5 + 0.5)
    for vtx in pd.bm.verts:
        vtx.co.z -= 0.095
    pad = pd.build('pauldron', M['brass'], coll, solidify=0.006, subsurf=1, recalc=False)
    PM = Matrix.Translation((0.27, 0.02, 1.535)) @ Matrix.Rotation(math.radians(-40), 4, 'Y') @ Matrix.Diagonal((1.0, 1.15, 1.9, 1))
    pad.matrix_world = PM
    rr = math.sqrt(0.15 ** 2 - 0.095 ** 2)
    B('brass_plain').sweep([PM @ V((rr * math.cos(a), rr * math.sin(a), 0.0)) for a in np.linspace(0, TAU, 64, endpoint=False)],
                           0.006, seg=10, closed=True)
    for a in np.linspace(0, TAU, 12, endpoint=False):
        B('brass_plain').sphere(PM @ V((0.1 * math.cos(a), 0.1 * math.sin(a), 0.017)), 0.0055, seg=10)
    uaL = (J['elL'] - J['shL']).normalized()
    q = uaL.to_track_quat('Z', 'X').to_matrix().to_4x4()
    for i, (t_, rr_) in enumerate(((0.3, 0.096), (0.48, 0.09))):
        lm = Part()
        lm.loft([(0, 0, 0, rr_, rr_), (0.06, 0, 0, rr_ * 0.97, rr_ * 0.97)], seg=40, a0=-95, a1=95, caps=False)
        lo = lm.build('lame', M['steel'], coll, solidify=0.005, subsurf=1, recalc=False)
        LM = Matrix.Translation(J['shL'] + uaL * (0.33 * t_)) @ q
        lo.matrix_world = LM
        B('steel').sweep([LM @ V((rr_ * 1.03 * math.cos(math.radians(a)), rr_ * 1.03 * math.sin(math.radians(a)), 0.0))
                          for a in np.linspace(-95, 95, 30)], 0.0035, seg=8)
        for a in (-80, 80):
            B('brass_plain').sphere(LM @ V((rr_ * 1.06 * math.cos(math.radians(a)), rr_ * 1.06 * math.sin(math.radians(a)), 0.03)), 0.005, seg=10)
    # strap round the upper arm holding the lames
    ctr = J['shL'] + (J['elL'] - J['shL']) * 0.62
    u, v, w = basis(uaL)
    ring = [ctr + (u * math.cos(a) + v * math.sin(a)) * 0.083 for a in np.linspace(0, TAU, 48, endpoint=False)]
    B('leather').sweep(ring, (0.004, 0.012), seg=8, hint=lambda i, p: p - ctr, closed=True)

    # ---------------- bracer on the left forearm
    fwL = (J['wrL'] - J['elL']).normalized()
    br_ = Part()
    br_.loft([(0, 0, 0, 0.071, 0.071), (0.12, 0, 0, 0.066, 0.066)], seg=40, caps=False)
    bo = br_.build('bracer', M['steel'], coll, solidify=0.005, subsurf=1, recalc=False)
    BM = Matrix.Translation(J['elL'] + fwL * 0.07) @ fwL.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bo.matrix_world = BM
    for zz in (0.03, 0.09):
        B('leather').sweep([BM @ V((0.079 * math.cos(a), 0.079 * math.sin(a), zz)) for a in np.linspace(0, TAU, 40, endpoint=False)],
                           (0.003, 0.009), seg=8, hint=lambda i, p: p - BM @ V((0, 0, zz)), closed=True)
        for a in np.linspace(0, TAU, 6, endpoint=False):
            B('brass_plain').sphere(BM @ V((0.076 * math.cos(a), 0.076 * math.sin(a), 0.06 + (zz - 0.06) * 1.6)), 0.0045, seg=8)

    # ---------------- bandolier strap, wrapped round the torso over the plate
    tb = trees(coat, plate, *faulds)
    path = [(330, 1.52), (300, 1.45), (270, 1.35), (240, 1.23), (215, 1.12), (190, 1.06), (160, 1.1),
            (130, 1.2), (100, 1.31), (70, 1.42), (40, 1.5), (10, 1.54), (350, 1.53)]
    pts = resample(wrap(tb, path, 0.008), 120)
    B('leather').sweep(pts, (0.0045, 0.02), seg=8, hint=lambda i, p: V((p.x, p.y, 0)), closed=True)
    strap_obj_pts = pts
    for i in (18, 26, 34):
        p = pts[i]
        B('brass_plain').sphere(p + V((p.x, p.y, 0)).normalized() * 0.006, 0.006, seg=10)
    buckle(pts[42], V((pts[42].x, pts[42].y, 0)).normalized(), (pts[43] - pts[41]).normalized(), B)

    # ---------------- belt (tooled), buckle, pouches, lantern
    bl = Part()
    rows, uvs = [], []
    for z in (0.965, 1.035):
        rows.append([(0.18 * math.cos(a), 0.139 * math.sin(a), z) for a in np.linspace(0, TAU, 96, endpoint=False)])
        uvs.append([(k / 96 * 14 / 8, (z - 0.965) / 0.07) for k in range(96)])
    bl.grid(rows, uvs=uvs)
    bl.build('belt', M['tooled'], coll, solidify=0.008, subsurf=1, recalc=False)
    buckle(V((0, -0.149, 1.0)), V((0, -1, 0)), V((1, 0, 0)), B, w=0.07, h=0.058)
    B('leather').sweep([V((-0.02, -0.152, 1.0)), V((-0.06, -0.154, 0.985)), V((-0.075, -0.156, 0.95))], (0.003, 0.03), seg=8,
                       hint=V((0, -1, 0)))
    for a in (205, 158):
        pouch(a, M, coll, B)
    lantern(335, M, coll, B)

    # ---------------- gloved hands gripping the haft
    for s in 'LR':
        hand(J['grip' + s], J['el' + s], M, coll, B, left=(s == 'L'))

    # ---------------- the maul
    maul(M, coll, B)

    # ---------------- coat details: seams, stitching, hem, pockets, patch, buttons
    ts = trees(*skirts)
    tc_ = trees(coat)
    for a in (0, 180):
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        tang = V((-d.y, d.x, 0))
        seam = [hit_in(ts, V((0, 0.02, z)), d)[0] + d * 0.003 for z in np.linspace(0.96, 0.4, 30)]
        B('coat').sweep(seam, 0.003, seg=6)
        B('thread').dashed([p + tang * 0.007 + d * 0.001 for p in seam], 0.0011)
    for a0, a1 in ((-70, 82), (98, 250)):
        hem = [hit_in(ts, V((0, 0.03, 0.41)), V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0)))[0]
               for a in np.linspace(a0, a1, 70)]
        B('thread').dashed([p + V((p.x, p.y - 0.03, 0)).normalized() * 0.0025 for p in hem], 0.0011)
    for a in (-69, 249):
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        edge = [hit_in(ts, V((0, 0.02, z)), d)[0] + d * 0.002 for z in np.linspace(0.97, 0.4, 30)]
        B('thread').dashed(edge, 0.0011)
    for s in 'LR':
        sh, el = J['sh' + s], J['el' + s]
        ua = (el - sh).normalized()
        u, v, w = basis(ua)
        ctr = sh + ua * 0.05
        ring = []
        for a in np.linspace(0, TAU, 48, endpoint=False):
            p = ctr + (u * math.cos(a) + v * math.sin(a)) * 0.13
            loc, n = nearest(tc_, p)
            ring.append(loc + n * 0.002)
        B('coat').sweep(ring, 0.003, seg=6, closed=True)
        B('thread').dashed([p + ua * 0.006 for p in ring], 0.0011)
        wr = J['wr' + s]
        for k in (0.8, 0.88):
            p = el + (wr - el) * k
            out = V((p.x, p.y + 0.1, 0)).normalized() + V((0, 0, -0.3))
            loc, n = nearest(tc_, p + out.normalized() * 0.12)
            B('brass_plain').sphere(loc + n * 0.004, (0.0065, 0.0065, 0.0065), seg=10)
    for a in (322, 218):
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        loc, n = hit_in(ts, V((0, 0.02, 0.84)), d)
        tang = V((-d.y, d.x, 0))
        R = Matrix((tang, d, V((0, 0, 1)))).transposed().to_4x4() @ Matrix.Rotation(math.radians(-4), 4, 'Y')
        B('coat').box(loc + d * 0.006 + V((0, 0, 0.02)), (0.13, 0.008, 0.055), R)
        B('brass_plain').sphere(loc + d * 0.012 + V((0, 0, 0.0)), 0.0065, seg=10)
        B('thread').dashed([loc + d * 0.0105 + tang * x + V((0, 0, 0.043)) for x in np.linspace(-0.058, 0.058, 20)], 0.001)
    # a sewn patch on the right sleeve
    guess = J['shR'] + (J['elR'] - J['shR']) * 0.45 + V((-0.1, 0.0, 0.02))
    loc, n = nearest(tc_, guess)
    ua = (J['elR'] - J['shR']).normalized()
    tv = (ua - n * ua.dot(n)).normalized()
    tu = n.cross(tv)
    rows = []
    for j in range(8):
        row = []
        for i in range(8):
            q_ = loc + tu * ((i - 3.5) / 3.5 * 0.034) + tv * ((j - 3.5) / 3.5 * 0.034)
            l2, n2 = nearest(tc_, q_)
            row.append(l2 + n2 * 0.0025)
        rows.append(row)
    pa = Part()
    pa.grid(rows, closed=False)
    pa.build('patch', M['patch'], coll, solidify=0.0015, recalc=False)
    border = rows[0] + [r[-1] for r in rows[1:]] + rows[-1][::-1][1:] + [r[0] for r in rows[::-1][1:]]
    B('thread').dashed([p + n * 0.002 for p in border] + [border[0]], 0.0011, dash=0.006, gap=0.004)

    # ---------------- scarf: fitted face cover, two neck wraps, knot, fringed tails
    scarf(head, coat, collar, plate, faulds, strap_obj_pts, M, coll, B)

    B.flush(M)
    return coll


def buckle(p, n, t, B, w=0.034, h=0.03):
    """A brass buckle frame + prong lying on a strap at p (normal n, strap direction t)."""
    up = n.cross(t).normalized()
    c = p + n * 0.006
    corners = [c + t * sx * w / 2 + up * sy * h / 2 for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    loop = []
    for a, b in zip(corners, corners[1:] + corners[:1]):
        loop += [a.lerp(b, k / 6) for k in range(6)]
    B('brass_plain').sweep(loop, 0.0035, seg=8, closed=True)
    B('brass_plain').capsule(c - t * w * 0.45, c + t * w * 0.1 + n * 0.002, 0.0022, seg=8)


def pouch(a, M, coll, B):
    ar = math.radians(a)
    n = V((math.cos(ar), math.sin(ar), 0))
    tg = V((-n.y, n.x, 0))
    base = V((0.182 * math.cos(ar), 0.141 * math.sin(ar), 0.93)) + n * 0.03
    R = Matrix((tg, n, V((0, 0, 1)))).transposed().to_4x4()
    p = Part()
    p.box(base, (0.09, 0.055, 0.1), R)
    p.build('pouch', M['leather'], coll, bevel=0.012)
    f = Part()
    f.box(base + n * 0.03 + V((0, 0, 0.03)), (0.096, 0.008, 0.05), R @ Matrix.Rotation(math.radians(6), 4, 'X'))
    f.build('pouch_flap', M['leather'], coll, bevel=0.004)
    B('brass_plain').sphere(base + n * 0.036 + V((0, 0, 0.012)), 0.007, seg=10)
    B('thread').dashed([base + n * 0.0285 + tg * x - V((0, 0, 0.046)) for x in np.linspace(-0.04, 0.04, 14)], 0.001)


def lantern(a, M, coll, B):
    """Small brass lantern on the hip: the source of the player's light radius in game."""
    ar = math.radians(a)
    n = V((math.cos(ar), math.sin(ar), 0))
    hook = V((0.186 * math.cos(ar), 0.145 * math.sin(ar), 0.975)) + n * 0.012
    top = hook + n * 0.045 - V((0, 0, 0.06))
    link_pts = [hook.lerp(top, k / 3) for k in range(4)]
    for k, (p0, p1) in enumerate(zip(link_pts, link_pts[1:])):
        c_ = (p0 + p1) / 2
        u, v, w = basis((p1 - p0), n if k % 2 else n.cross(V((0, 0, 1))))
        B('brass_plain').sweep([c_ + w * 0.012 * math.cos(t) + u * 0.006 * math.sin(t) for t in np.linspace(0, TAU, 16, endpoint=False)],
                               0.0016, seg=6, closed=True)
    ctr = top - V((0, 0, 0.06))
    lp = Part()
    for zz, r_ in ((0.05, 0.012), (0.036, 0.03), (0.03, 0.036)):
        pass
    lp.sloft([(ctr + V((0, 0, 0.058)), V((1, 0, 0)), V((0, 1, 0)), 0.01, 0.01),
              (ctr + V((0, 0, 0.042)), V((1, 0, 0)), V((0, 1, 0)), 0.03, 0.03),
              (ctr + V((0, 0, 0.034)), V((1, 0, 0)), V((0, 1, 0)), 0.037, 0.037)], seg=8, p=2.0)
    lp.sloft([(ctr + V((0, 0, -0.036)), V((1, 0, 0)), V((0, 1, 0)), 0.036, 0.036),
              (ctr + V((0, 0, -0.046)), V((1, 0, 0)), V((0, 1, 0)), 0.03, 0.03)], seg=8, p=2.0)
    for k in range(8):
        a_ = TAU * (k + 0.5) / 8
        lp.capsule(ctr + V((0.033 * math.cos(a_), 0.033 * math.sin(a_), -0.036)),
                   ctr + V((0.033 * math.cos(a_), 0.033 * math.sin(a_), 0.034)), 0.0025, seg=6)
    lp.build('lantern', M['brass_plain'], coll)
    B('brass_plain').sweep([ctr + V((0, 0.014 * math.cos(t), 0.075 + 0.016 * math.sin(t))) for t in np.linspace(0, TAU, 20, endpoint=False)],
                           0.0022, seg=6, closed=True)
    g = Part()
    g.sloft([(ctr + V((0, 0, -0.034)), V((1, 0, 0)), V((0, 1, 0)), 0.029, 0.029),
             (ctr + V((0, 0, 0.032)), V((1, 0, 0)), V((0, 1, 0)), 0.029, 0.029)], seg=8, p=2.0)
    g.build('lantern_glass', M['glass'], coll)
    ld = bpy.data.lights.new('lantern_light', 'POINT')
    ld.energy, ld.color, ld.shadow_soft_size = 6.0, (1.0, 0.66, 0.32), 0.02
    lo = bpy.data.objects.new('lantern_light', ld)
    coll.objects.link(lo)
    lo.location = ctr


def boot(an, to, M, coll, B):
    g = V((an.x, an.y, 0))
    f = V((to.x - an.x, to.y - an.y, 0)).normalized()
    s = f.cross(V((0, 0, 1))).normalized()
    Z = V((0, 0, 1))
    SOLE = 0.024
    up_secs = [(-0.075, 0.066, 0.075), (-0.06, 0.082, 0.1), (-0.03, 0.09, 0.12), (0.0, 0.094, 0.118), (0.04, 0.098, 0.098),
               (0.08, 0.102, 0.08), (0.12, 0.102, 0.066), (0.155, 0.097, 0.056), (0.185, 0.086, 0.049),
               (0.205, 0.068, 0.043), (0.218, 0.044, 0.035), (0.224, 0.02, 0.026)]
    b = Part()
    b.sloft([(g + f * t + Z * (SOLE + hh / 2), s, Z, w / 2, hh / 2) for t, w, hh in up_secs], seg=36, p=3.0)
    shaft = []
    for z in np.linspace(0.08, 0.3, 14):
        k = (z - 0.08) / 0.22
        wr_ = 0.0016 * (math.sin(z * 120) + 0.8 * noise.noise(V((an.x * 40, z * 40, 3.0)))) * (1 - k)
        shaft.append((V((an.x, an.y, z)) + f * (0.006 * k), f, s, 0.063 + 0.013 * k + wr_, 0.056 + 0.011 * k + wr_))
    b.sloft(shaft, seg=36, p=2.2)
    b.build('boot', M['boot'], coll, voxel=0.0035, smooth=3)
    # folded cuff at the top of the shaft
    cf = Part()
    cf.sloft([(V((an.x, an.y, z)) + f * 0.006, f, s, 0.076 + o, 0.068 + o) for z, o in ((0.29, 0.001), (0.301, 0.006), (0.316, 0.007), (0.327, 0.002))],
             seg=36, p=2.2, caps=False)
    cf.build('boot_cuff', M['cuff'], coll, solidify=0.005, sol_offset=-1, subsurf=1)
    # sole with heel block, welt stitching, toe-cap seam
    sl = Part()
    sole_secs = [(-0.085, 0.07), (-0.07, 0.088), (-0.04, 0.098), (0.0, 0.104), (0.06, 0.11), (0.12, 0.114),
                 (0.17, 0.106), (0.205, 0.084), (0.225, 0.056), (0.234, 0.026)]
    sl.sloft([(g + f * t + Z * (SOLE / 2), s, Z, w / 2 + 0.003, SOLE / 2) for t, w in sole_secs], seg=28, p=6.0)
    sl.sloft([(g + f * t + Z * 0.008, s, Z, w / 2 + 0.002, 0.008) for t, w in sole_secs[:4]], seg=28, p=6.0)
    sl.build('sole', M['sole'], coll, bevel=0.002)
    left = [g + f * t + s * (w / 2 - 0.004) + Z * (SOLE + 0.001) for t, w in sole_secs]
    right = [g + f * t - s * (w / 2 - 0.004) + Z * (SOLE + 0.001) for t, w in sole_secs]
    B('thread').dashed(left + right[::-1] + [left[0]], 0.0012, dash=0.006, gap=0.004)
    t0, w0, h0 = 0.14, 0.1, 0.061
    arc = []
    for a in np.linspace(0.15, math.pi - 0.15, 20):
        x, y = superellipse(a, 3.0)
        arc.append(g + f * t0 + Z * (SOLE + h0 / 2) + s * (w0 / 2 + 0.002) * x + Z * (h0 / 2 + 0.002) * y)
    B('thread').dashed(arc, 0.0011, dash=0.005, gap=0.0035)
    B('leather').sweep([p - f * 0.004 for p in arc], 0.0025, seg=6)
    # eyelets and criss-cross laces up the front of the shaft
    rows = []
    for z in np.linspace(0.11, 0.285, 7):
        k = (z - 0.08) / 0.22
        rf = 0.063 + 0.013 * k
        front = V((an.x, an.y, z)) + f * (0.006 * k + rf * 0.97)
        rows.append((front + s * 0.021, front - s * 0.021))
    for eL, eR in rows:
        for e in (eL, eR):
            u_, v_, w_ = basis(f)
            B('brass_plain').sweep([e + (u_ * math.cos(a) + v_ * math.sin(a)) * 0.0045 for a in np.linspace(0, TAU, 12, endpoint=False)],
                                   0.0016, seg=6, closed=True)
    for (aL, aR), (bL, bR) in zip(rows, rows[1:]):
        for p0, p1 in ((aL, bR), (aR, bL)):
            mid = (p0 + p1) / 2 + f * 0.004
            B('lace').sweep([p0, mid, p1], 0.0022, seg=6)
    top = (rows[-1][0] + rows[-1][1]) / 2 + f * 0.006
    for side in (1, -1):
        loop = [top + s * side * (0.012 + 0.012 * math.sin(t)) + Z * 0.012 * math.cos(t) - Z * 0.004 for t in np.linspace(0, math.pi, 10)]
        B('lace').sweep([top] + loop, 0.002, seg=6)
        B('lace').sweep([top, top + s * side * 0.01 - Z * 0.02 + f * 0.004, top + s * side * 0.014 - Z * 0.045 + f * 0.006], 0.002, seg=6)


def hand(grip, elbow, M, coll, B, left):
    e1 = V(elbow) - V(grip)
    e1 = (e1 - AX * e1.dot(AX)).normalized()
    e2 = AX.cross(e1)
    wrist = V(grip) + (V(elbow) - V(grip)).normalized() * 0.085
    kb = V(grip) + e1 * 0.03
    h = Part()
    R = Matrix((e1, AX, e2)).transposed()
    h.capsule(wrist, kb + e1 * 0.01, 0.031, 0.03, seg=16)
    h.sphere(kb + e1 * 0.014 + e2 * 0.006, (0.026, 0.05, 0.044), rot=R.to_4x4())
    radii = [0.0112, 0.0122, 0.0118, 0.0104]
    offs = [-0.034, -0.0115, 0.0115, 0.033]
    if left:
        offs = offs[::-1]
    for r_, o in zip(radii, offs):
        Rg = 0.018 + r_ + 0.0012
        root = kb + AX * o + e2 * 0.014
        pts = [root] + [V(grip) + AX * o + (e1 * math.cos(tt) + e2 * math.sin(tt)) * Rg for tt in np.radians(np.linspace(40, 262, 12))]
        h.sweep(pts, lambda t, r_=r_: r_ * (1 - 0.2 * t), seg=10)
        h.sphere(root, r_ * 1.4, seg=12)
        h.sphere(V(grip) + AX * o + (e1 * math.cos(math.radians(180)) + e2 * math.sin(math.radians(180))) * Rg, r_ * 1.12, seg=10)
    to = offs[0] + (-0.02 if not left else 0.02)
    pts = [kb + AX * to - e2 * 0.012] + [V(grip) + AX * to + (e1 * math.cos(tt) + e2 * math.sin(tt)) * 0.031
                                        for tt in np.radians(np.linspace(-25, -150, 9))]
    h.sweep(pts, lambda t: 0.0138 * (1 - 0.2 * t), seg=10)
    h.build('glove', M['leather'], coll, voxel=0.0022, smooth=2)
    fd = (V(elbow) - wrist).normalized()
    u, v, w = basis(fd)
    cf = Part()
    cf.sloft([(wrist + fd * dz, u, v, r_, r_) for dz, r_ in ((-0.012, 0.045), (0.02, 0.05), (0.045, 0.059))], seg=32, caps=False)
    cf.build('glove_cuff', M['leather'], coll, solidify=0.004, subsurf=1, recalc=False)
    B('thread').dashed([wrist + fd * 0.04 + (u * math.cos(a) + v * math.sin(a)) * 0.061 for a in np.linspace(0, TAU, 60)], 0.001)
    Rk = Matrix((AX, e1, e2)).transposed().to_4x4()
    B('steel').box(kb + e1 * 0.033 + e2 * 0.012, (0.066, 0.008, 0.026), Rk)
    for o in (-0.024, 0.024):
        B('brass_plain').sphere(kb + e1 * 0.038 + e2 * 0.012 + AX * o, 0.004, seg=8)
    if not left:  # tape wound round the right wrist
        c0 = wrist + fd * 0.05
        B('wrap').sweep([c0 + fd * (0.05 * k / 120) + (u * math.cos(k * 0.55) + v * math.sin(k * 0.55)) * 0.059 for k in range(121)],
                        0.0045, seg=6)


def maul(M, coll, B):
    side = AX.cross(V((0, 0, 1))).normalized()
    up = side.cross(AX).normalized()
    R = Matrix((side, up, AX)).transposed().to_4x4()
    Part_ = Part()
    Part_.capsule(P_end - AX * 0.02, P_head + AX * 0.07, 0.018)
    Part_.build('haft', M['iron'], coll)
    gp = [P_end + AX * (0.02 + 0.28 * k / 1200) + (up * math.cos(k * 30 * TAU / 1200) + side * math.sin(k * 30 * TAU / 1200)) * 0.0195
          for k in range(1201)]
    B('leather').sweep(gp, (0.0022, 0.0058), seg=8, hint=lambda i, p: (p - P_end) - AX * (p - P_end).dot(AX))
    hd = Part()
    hd.box(P_head, (0.36, 0.17, 0.17), R)
    hd.build('maul_head', M['iron'], coll, bevel=0.02)
    for off in (-0.14, 0.14):
        c_ = P_head + side * off
        B('brass_plain').box(c_, (0.035, 0.185, 0.185), R)
        for nrm, oth in ((up, AX), (-up, AX), (AX, up), (-AX, up)):
            for o in (-0.05, 0.05):
                B('brass_plain').sphere(c_ + nrm * 0.093 + oth * o, 0.0065, seg=10)
    for sgn in (-1, 1):
        cc = P_head + side * sgn * 0.1825
        hs = 0.066
        quad = [[cc - up * hs - AX * hs, cc + up * hs - AX * hs], [cc - up * hs + AX * hs, cc + up * hs + AX * hs]]
        fp = Part()
        fp.grid(quad, closed=False, uvs=[[(0, 0), (1, 0)], [(0, 1), (1, 1)]])
        fp.build('maul_face', M['brass'], coll, solidify=0.004, recalc=False)
    col_ = Part()
    col_.sloft([(P_head - AX * (0.085 + dz), side, up, r_, r_) for dz, r_ in ((0.075, 0.021), (0.03, 0.026), (0.0, 0.032))], seg=24)
    col_.build('maul_collar', M['iron'], coll)
    B('brass_plain').sphere(P_end - AX * 0.035, 0.03, seg=20)
    c0 = P_end - AX * 0.085
    B('leather').sweep([c0 + AX * 0.035 * math.cos(t) + side * 0.02 * math.sin(t) - V((0, 0, 0.03)) * (1 - math.cos(t)) for t in np.linspace(0, TAU, 30, endpoint=False)],
                       0.003, seg=6, closed=True)


def scarf(head, coat, collar, plate, faulds, strap_pts, M, coll, B):
    th = trees(head)
    NA, NR = 120, 16
    zb = lambda a: 1.578 - 0.034 * max(0.0, -math.sin(a)) ** 2
    zt = lambda a: 1.688 - 0.024 * math.sin(a)
    rows = []
    for i in range(NR):
        v = i / (NR - 1)
        rr = []
        for k in range(NA):
            a = TAU * k / NA
            z = zb(a) + (zt(a) - zb(a)) * v
            d = V((math.cos(a), math.sin(a), 0))
            loc, _ = hit_in(th, V((0, -0.005, z)), d, 0.3)
            rr.append(((loc - V((0, -0.005, z))).length, z, d))
        r = [x[0] for x in rr]
        for _ in range(10):  # pulled taut across the hollows beside the nose
            r = [max(r[k], 0.5 * (r[k - 1] + r[(k + 1) % NA])) for k in range(NA)]
        row = []
        for k in range(NA):
            a = TAU * k / NA
            _, z, d = rr[k]
            # folds run diagonally down towards the knot on the left
            fold = 0.0032 * math.sin((a * 5 - v * 7.0) + 1.3 * math.sin(a * 3)) * (0.4 + 0.6 * v)
            sag = 0.01 * (1 - v) ** 2 * max(0.0, -math.sin(a))
            row.append(V((0, -0.005, z)) + d * (r[k] + 0.0065 + fold + sag))
        rows.append(row)
    fc = Part()
    fc.grid(rows)
    fc.build('scarf_face', M['scarf'], coll, solidify=0.004, sol_offset=-1, subsurf=1, recalc=False)
    B('scarf').sweep(rows[-1], 0.004, seg=8, closed=True)
    # two flat bands of cloth round the neck; the upper one climbs over the chin in front
    for zc, tilt, rx, ry, ph in ((1.55, 6, 0.132, 0.126, 0.0), (1.598, -17, 0.118, 0.112, 1.3)):
        Rt = Matrix.Rotation(math.radians(tilt), 3, 'X')
        pts = []
        for a in np.linspace(0, TAU, 128, endpoint=False):
            bunch = 1 + 0.045 * math.sin(a * 9 + ph) + 0.03 * noise.noise(V((math.cos(a) * 3, math.sin(a) * 3, ph)))
            pts.append(V((0, 0.012, zc)) + Rt @ V((rx * bunch * math.cos(a), ry * bunch * math.sin(a), 0)))
        B('scarf').sweep(pts, lambda t, ph=ph: (0.0085 * (1 + 0.45 * math.sin(t * TAU * 11 + ph)), 0.036 * (1 + 0.14 * math.sin(t * TAU * 6 + ph))),
                         seg=14, hint=lambda i, p: V((p.x, p.y - 0.012, 0)), closed=True)
    # knot: a tight core with two flattened loops
    knot = V((0.092, -0.112, 1.548))
    kp = Part()
    kp.sphere(knot, (0.024, 0.018, 0.026), seg=20)
    kp.build('scarf_knot', M['scarf'], coll, subsurf=1)
    kn = V((0.55, -0.83, 0.0)).normalized()
    ku, kv, kw = basis(kn, V((0, 0, 1)))
    for ang, sc in ((35, 1.0), (-145, 0.85)):
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        dirv = ku * ca + kv * sa
        loop = [knot + dirv * (0.022 * sc * (1 - math.cos(t))) + kv.cross(dirv) * 0.0 + (dirv.cross(kn)) * (0.018 * sc * math.sin(t)) + kn * 0.006
                for t in np.linspace(0, TAU, 28, endpoint=False)]
        B('scarf').sweep(loop, (0.005, 0.012), seg=10, hint=kn, closed=True)
    # tails draped over the chest, fringed
    body = trees(coat, plate, *faulds)
    for x0, x1, z1, off, w0, w1, ph in ((0.1, 0.135, 1.27, 0.018, 0.032, 0.026, 0.0), (0.075, 0.08, 1.37, 0.03, 0.028, 0.023, 1.1)):
        pts = []
        for i in range(28):
            tt = i / 27
            z = knot.z - 0.015 - (knot.z - 0.015 - z1) * tt
            x = x0 + (x1 - x0) * tt + 0.01 * math.sin(tt * 5 + ph)
            loc, _ = hit_in(body, V((x, 0.0, z)), V((0, -1, 0)), 0.5)
            pts.append(V((x, min(loc.y, knot.y + 0.02) - off - 0.004 * math.sin(tt * 7 + ph), z)))
        B('scarf').sweep(pts, lambda t, w0=w0, w1=w1, ph=ph: (0.0045 * (1 + 0.3 * math.sin(t * 19 + ph)), w0 + (w1 - w0) * t),
                         seg=12, hint=lambda i, p, ph=ph: V((0.25 * math.sin(i * 0.35 + ph), -1, 0)))
        T, N, Bn = frames(pts, V((0, -1, 0)))
        end = pts[-1]
        for k in range(11):
            o = (k / 10 - 0.5) * 2 * w1 * 0.92
            p0 = end + Bn[-1] * o
            B('scarf').capsule(p0, p0 - V((0.002 * math.sin(k * 1.7), 0.002, 0.03 + 0.006 * math.sin(k * 2.3))), 0.0019, seg=6)


# ------------------------------------------------------------------ scenes
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenes.py')).read())
