# ----------------------------------------------------------------------------- scene helpers
def look_at(obj, target):
    d = V(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(name, loc, target, lens=None, vfov=None, ortho=None):
    cd = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cd)
    scene.collection.objects.link(cam)
    cam.location = loc
    look_at(cam, target)
    if ortho:
        cd.type, cd.ortho_scale = 'ORTHO', ortho
    elif vfov:
        cd.sensor_fit = 'VERTICAL'
        cd.angle_y = math.radians(vfov)
    else:
        cd.lens = lens
    return cam


def area(name, loc, target, power, color, size=1.0, coll=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy, ld.color, ld.size = power, color, size
    ob = bpy.data.objects.new(name, ld)
    (coll or scene.collection).objects.link(ob)
    ob.location = loc
    look_at(ob, target)
    return ob


def point(name, loc, power, color, radius=0.1, coll=None):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy, ld.color, ld.shadow_soft_size = power, color, radius
    ob = bpy.data.objects.new(name, ld)
    (coll or scene.collection).objects.link(ob)
    ob.location = loc
    return ob


def world(color, strength=1.0):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = srgb(color)
    bg.inputs['Strength'].default_value = strength
    scene.world = w


def sun_backdrop(cam, dist, offset, radius, coll):
    """A plane facing the camera, painted with the black sun and its corona."""
    me = bpy.data.meshes.new('sky')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6.0)
    bm.to_mesh(me)
    ob = bpy.data.objects.new('sky', me)
    coll.objects.link(ob)
    bpy.context.view_layer.update()
    fwd = cam.matrix_world.to_quaternion() @ V((0, 0, -1))
    ob.location = cam.location + fwd * dist
    ob.rotation_euler = cam.rotation_euler
    m = bpy.data.materials.new('sky')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    N.remove(N['Principled BSDF'])
    tc = N.new('ShaderNodeTexCoord')
    sub = N.new('ShaderNodeVectorMath')
    sub.operation = 'DISTANCE'
    sub.inputs[1].default_value = (offset[0], offset[1], 0)
    L.new(tc.outputs['Object'], sub.inputs[0])
    div = N.new('ShaderNodeMath')
    div.operation = 'DIVIDE'
    div.inputs[1].default_value = radius * 3.2
    L.new(sub.outputs['Value'], div.inputs[0])
    ramp = N.new('ShaderNodeValToRGB')
    E = ramp.color_ramp.elements
    E[0].position, E[0].color = 0.0, (0.0, 0.0, 0.0, 1)
    E[1].position, E[1].color = 1.0, srgb('#120C1E')
    for pos, col in ((0.305, (0, 0, 0, 1)), (0.315, (6.0, 4.6, 2.8, 1)), (0.34, (3.2, 1.6, 0.45, 1)),
                     (0.42, (0.9, 0.35, 0.08, 1)), (0.6, srgb('#3A2150')), (0.8, srgb('#1E1430'))):
        e = ramp.color_ramp.elements.new(pos)
        e.color = col
    L.new(div.outputs['Value'], ramp.inputs['Fac'])
    em = N.new('ShaderNodeEmission')
    L.new(ramp.outputs['Color'], em.inputs['Color'])
    L.new(em.outputs['Emission'], N['Material Output'].inputs['Surface'])
    me.materials.append(m)
    ob.visible_shadow = False
    return ob


def render_settings(w, h, samples):
    r = scene.render
    r.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Punchy'
    except Exception:
        pass
    r.image_settings.file_format = 'PNG'


def _box(a, r):
    """Mean over a (2r+1)^2 window via integral images (edge-padded)."""
    p = np.pad(a, ((r + 1, r), (r + 1, r), (0, 0)), mode='edge')
    c = p.cumsum(0).cumsum(1)
    h, w = a.shape[:2]
    k = 2 * r + 1
    s = c[k:k + h, k:k + w] - c[0:h, k:k + w] - c[k:k + h, 0:w] + c[0:h, 0:w]
    return s / (k * k)


def kuwahara(a, r):
    """Classic 4-quadrant Kuwahara: flattens detail into painted strokes, keeps edges."""
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    h, w = a.shape[:2]
    best = np.full((h, w), np.inf, np.float32)
    out = np.zeros_like(a)
    for dy in (-1, 1):
        for dx in (-1, 1):
            sh = (dy * r // 2, dx * r // 2)
            m = np.roll(_box(a, r // 2), sh, (0, 1))
            ml = np.roll(_box(lum, r // 2), sh, (0, 1))[..., 0]
            m2 = np.roll(_box(lum * lum, r // 2), sh, (0, 1))[..., 0]
            var = m2 - ml * ml
            sel = var < best
            best[sel] = var[sel]
            out[sel] = m[sel]
    return out


def bloom(a, amt):
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    hi = a * np.clip((lum - 0.62) / 0.3, 0, 1)[..., None]
    acc = np.zeros_like(a)
    small = hi[::4, ::4]
    for r, wgt in ((2, 0.5), (6, 0.35), (16, 0.25)):
        b = _box(_box(small, r), r)
        acc += wgt * np.repeat(np.repeat(b, 4, 0), 4, 1)[:a.shape[0], :a.shape[1]]
    return np.clip(a + amt * acc, 0, 1)


def post(path, painterly=0, bloom_amt=0.5):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    a = px.reshape(h, w, 4)[..., :3].copy()
    if painterly:
        a = kuwahara(a, painterly)
    if bloom_amt:
        a = bloom(a, bloom_amt)
    px.reshape(h, w, 4)[..., :3] = a
    img.pixels.foreach_set(px)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def shoot(cam, path, painterly=0, bloom_amt=0.5):
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    post(path, painterly, bloom_amt)
    print('WROTE', path)

# ----------------------------------------------------------------------------- views
def hero(coll):
    render_settings(1080, 1350, 256 if FINAL else 48)
    world('#2A1E40', 1.0)
    scene.view_settings.exposure = -0.3
    cam = camera('cam_hero', (1.5, -3.6, 1.05), (0.0, 0.0, 1.1), lens=56)
    lc = bpy.data.collections.new('hero_rig')
    scene.collection.children.link(lc)
    area('key', (1.9, -1.2, 2.2), (0, 0, 1.25), 170, (1.0, 0.7, 0.42), 0.6, lc)
    area('fill', (-2.4, -1.8, 2.6), (0, 0, 1.1), 55, (0.5, 0.42, 1.0), 3.0, lc)
    area('rim', (-1.5, 2.2, 2.4), (0, 0, 1.3), 1300, (1.0, 0.55, 0.22), 0.6, lc)
    area('rim2', (1.8, 1.9, 1.6), (0, 0, 1.1), 700, (1.0, 0.6, 0.28), 0.5, lc)
    gm_ = bpy.data.meshes.new('hground')
    bm_ = bmesh.new()
    bmesh.ops.create_circle(bm_, cap_ends=True, segments=64, radius=2.2)
    bm_.to_mesh(gm_)
    go_ = bpy.data.objects.new('hground', gm_)
    lc.objects.link(go_)
    gm_.materials.append(material('hstone', '#0C0A10', rough=0.95, vary=0.3, bump=0.3, scale=6))
    sun_backdrop(cam, 7.0, (-0.9, 1.35), 0.55, lc)
    shoot(cam, os.path.join(OUT, 'hero.png'), painterly=0, bloom_amt=0.5)
    bpy.data.collections.remove(lc)


def turnaround(coll):
    render_settings(2400, 1080, 192 if FINAL else 32)
    scene.view_settings.exposure = -0.3
    world('#1B1429', 0.6)
    vl = bpy.context.view_layer.layer_collection.children[coll.name]
    vl.exclude = True
    tc = bpy.data.collections.new('turn')
    scene.collection.children.link(tc)
    for i, rot in enumerate((0, 90, 180)):
        e = bpy.data.objects.new(f'inst{i}', None)
        e.instance_type, e.instance_collection = 'COLLECTION', coll
        e.location = ((i - 1) * 1.25, 0, 0)
        e.rotation_euler = (0, 0, math.radians(rot))
        tc.objects.link(e)
    # floor for contact shadow
    fm = bpy.data.meshes.new('floor')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    bm.to_mesh(fm)
    fl = bpy.data.objects.new('floor', fm)
    tc.objects.link(fl)
    fm.materials.append(material('floor', '#1B1429', rough=0.9, vary=0.0, bump=0.0))
    cam = camera('cam_turn', (0, -9, 1.03), (0, 0, 1.03), ortho=4.7)
    area('key', (2.5, -4, 3.5), (0, 0, 1), 700, (1.0, 0.9, 0.8), 4, tc)
    area('rim', (0, 4, 3), (0, 0, 1.2), 900, (1.0, 0.6, 0.28), 5, tc)
    area('fill', (-4, -3, 2), (0, 0, 1), 250, (0.6, 0.5, 1.0), 4, tc)
    shoot(cam, os.path.join(OUT, 'turnaround.png'), painterly=0, bloom_amt=0.3)
    bpy.data.collections.remove(tc)
    vl.exclude = False


def stone_material(name, a='#6A5E55', b='#4E443E', mortar='#2A2420', scale=1.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bsdf = N['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    tc = N.new('ShaderNodeTexCoord')
    br = N.new('ShaderNodeTexBrick')
    br.inputs['Color1'].default_value = srgb(a)
    br.inputs['Color2'].default_value = srgb(b)
    br.inputs['Mortar'].default_value = srgb(mortar)
    br.inputs['Scale'].default_value = scale
    br.inputs['Mortar Size'].default_value = 0.012
    br.inputs['Brick Width'].default_value = 0.9
    br.inputs['Row Height'].default_value = 0.45
    L.new(tc.outputs['Object'], br.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.5
    L.new(br.outputs['Color'], mix.inputs['A'])
    L.new(nz.outputs['Color'], mix.inputs['B'])
    L.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    bmp = N.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.6
    L.new(br.outputs['Fac'], bmp.inputs['Height'])
    L.new(bmp.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def ghoul(pos, yaw, mats, coll):
    """A hunched graveyard ghoul, built the same way as the hero."""
    Rz = Matrix.Rotation(yaw, 4, 'Z')
    T = lambda p: Rz @ V(p) + V(pos)
    g = Part()
    g.capsule(T((0, 0.08, 0.8)), T((0, -0.3, 1.02)), 0.13, 0.16)
    g.sphere(T((0, -0.02, 1.02)), (0.12, 0.14, 0.1))
    g.sphere(T((0, -0.5, 0.98)), (0.085, 0.12, 0.085))
    for s in (-1, 1):
        g.capsule(T((s * 0.17, -0.28, 1.05)), T((s * 0.32, -0.45, 0.62)), 0.05, 0.04)
        g.capsule(T((s * 0.32, -0.45, 0.62)), T((s * 0.34, -0.62, 0.12)), 0.04, 0.03)
        g.sphere(T((s * 0.34, -0.66, 0.08)), (0.05, 0.08, 0.03))
        g.capsule(T((s * 0.12, 0.0, 0.75)), T((s * 0.17, -0.18, 0.42)), 0.075, 0.055)
        g.capsule(T((s * 0.17, -0.18, 0.42)), T((s * 0.16, 0.05, 0.06)), 0.05, 0.04)
    g.build('ghoul', mats[0], voxel=0.01, smooth=4, coll=coll)
    for s in (-1, 1):
        e = Part()
        e.sphere(T((s * 0.035, -0.6, 1.0)), 0.018, seg=12)
        e.build('geye', mats[1], coll=coll)


def game(coll):
    """The real gameplay camera: 55° pitch, 30° vertical FOV, 1920x1080."""
    render_settings(1920, 1080, 256 if FINAL else 48)
    scene.view_settings.exposure = 0.0
    world('#2B1E44', 0.22)
    gc = bpy.data.collections.new('street')
    scene.collection.children.link(gc)
    # ground: worn stone paving
    fm = bpy.data.meshes.new('ground')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
    bm.to_mesh(fm)
    g = bpy.data.objects.new('ground', fm)
    gc.objects.link(g)
    fm.materials.append(stone_material('paving', '#5A4F48', '#433A35', '#1E1A18', scale=2.4))
    wall = stone_material('wall', '#5E4C40', '#524236', '#2A221C', scale=0.9)
    plaster = material('plaster', '#8A7560', rough=0.95, vary=0.35, bump=0.6, scale=4)
    win_lit = material('winlit', '#FFB25E', emit='#FFB25E', strength=6)
    win_dark = material('windark', '#15121A', rough=0.3)
    metal = material('metal', '#4C4F55', rough=0.5, metal=0.6, vary=0.3, bump=0.4, scale=6)
    neon_m = material('neonM', '#FF2E88', emit='#FF2E88', strength=22)
    neon_t = material('neonT', '#1FA3A0', emit='#2BD1C8', strength=18)
    signbg = material('signbg', '#1A1420', rough=0.6)
    crate = material('crate', '#6B4A2E', rough=0.8, vary=0.3, bump=0.5, scale=10)
    bulbs = (material('bulbA', '#FFB04A', emit='#FFB04A', strength=14),
             material('bulbB', '#FF7A3A', emit='#FF7A3A', strength=12))
    rng_ = np.random.default_rng(7)
    for side, x in ((-1, -6.2), (1, 6.2)):
        w = Part()
        w.box((x + side * 1.0, 2, 4.5), (2.0, 30, 9.0))
        w.build('wall', wall, coll=gc)
        face = x
        for k, y in enumerate(np.arange(-8, 13, 3.4)):
            # ground floor: shop shutter + neon sign on a dark board
            sh = Part()
            sh.box((face - side * 0.03, y, 1.3), (0.06, 2.6, 2.6))
            sh.build('shutter', metal, coll=gc)
            bd = Part()
            bd.box((face - side * 0.06, y, 2.95), (0.06, 2.6, 0.6))
            bd.build('board', signbg, coll=gc)
            lit = (k + (side > 0)) % 2
            ns = Part()
            ns.box((face - side * 0.1, y, 2.95), (0.04, 1.9, 0.12))
            ns.box((face - side * 0.1, y - 0.7, 3.12), (0.04, 0.35, 0.1))
            ns.build('neon', neon_m if lit else neon_t, coll=gc)
            point('signlight', (face - side * 0.9, y, 2.8), 90,
                  (1.0, 0.3, 0.6) if lit else (0.3, 1.0, 0.95), 0.5, gc)
            # upper floors: windows (some lit), balconies, AC units
            for z in (4.6, 7.0):
                wn = Part()
                wn.box((face - side * 0.02, y, z), (0.05, 1.0, 1.3))
                wn.build('win', win_lit if rng_.random() < 0.35 else win_dark, coll=gc)
                if rng_.random() < 0.6:
                    bc = Part()
                    bc.box((face - side * 0.45, y, z - 0.72), (0.9, 1.6, 0.1))
                    bc.box((face - side * 0.88, y, z - 0.35), (0.04, 1.6, 0.7))
                    bc.build('balcony', plaster, coll=gc)
                else:
                    ac = Part()
                    ac.box((face - side * 0.25, y + 0.9, z - 0.9), (0.5, 0.7, 0.45))
                    ac.build('ac', metal, coll=gc)
    # strings of festival lights across the street
    for y0 in (-5.0, 1.0, 7.0):
        for i in range(24):
            t_ = i / 23
            xx = -6.2 + 12.4 * t_
            zz = 5.2 - 1.2 * math.sin(math.pi * t_)
            yy = y0 + 0.8 * math.sin(math.pi * t_)
            b_ = Part()
            b_.sphere((xx, yy, zz), 0.035, seg=10)
            b_.build('bulb', bulbs[i % 2], coll=gc)
        point('stringlight', (0, y0 + 0.8, 4.0), 260, (1.0, 0.75, 0.45), 2.0, gc)
    for p in ((2.6, 2.2, 0.35), (3.2, 2.9, 0.3), (-3.4, -3.0, 0.35), (3.8, -4.5, 0.3), (-4.0, 5.0, 0.4)):
        cb = Part()
        cb.box(p, (0.7, 0.7, p[2] * 2), Matrix.Rotation(p[0], 4, 'Z'))
        cb.build('crate', crate, coll=gc)
    # ghouls closing in from the north, magenta-eyed
    gm = (material('ghoulskin', '#5B5463', rough=0.55, vary=0.35, bump=0.6, scale=20),
          material('ghouleye', '#FF2E88', emit='#FF2E88', strength=60))
    for pos, yaw in (((-1.6, 3.6, 0), 2.9), ((0.9, 4.6, 0), 3.3), ((2.4, 3.2, 0), 3.7), ((-0.4, 6.2, 0), 3.1)):
        ghoul(pos, yaw, gm, gc)
    # the player's own warm light (the Melam glow) and a violet dusk from the sky
    point('melam', (0.0, -0.2, 2.2), 160, (1.0, 0.68, 0.38), 0.4, gc)
    sd = bpy.data.lights.new('dusk', 'SUN')
    sd.energy, sd.color, sd.angle = 0.8, (0.55, 0.45, 1.0), math.radians(8)
    so = bpy.data.objects.new('dusk', sd)
    gc.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-160))
    d = 18.0
    target = V((0, 1.2, 0.6))
    cam = camera('cam_game', target + V((0, -d * math.cos(math.radians(55)), d * math.sin(math.radians(55)))),
                 target, vfov=30)
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    ys = []
    for ob in coll.all_objects:
        if ob.type == 'MESH':
            for c_ in ob.bound_box:
                ys.append(world_to_camera_view(scene, cam, ob.matrix_world @ V(c_)).y)
    print('CHAR_PX_HEIGHT', round((max(ys) - min(ys)) * 1080))
    shoot(cam, os.path.join(OUT, 'game.png'), painterly=0, bloom_amt=0.7)
    bpy.data.collections.remove(gc)




def details(coll):
    """Close-ups: the scarf and face, the grip and armour, the boots."""
    render_settings(1000, 1000, 256 if FINAL else 48)
    world('#1B1429', 0.5)
    scene.view_settings.exposure = -0.7
    lc = bpy.data.collections.new('detail_rig')
    scene.collection.children.link(lc)
    area('key', (1.4, -1.7, 2.0), (0, 0, 1.0), 170, (1.0, 0.72, 0.46), 0.8, lc)
    area('fill', (-2.2, -1.6, 1.8), (0, 0, 0.9), 70, (0.5, 0.42, 1.0), 3.0, lc)
    area('rim', (-1.4, 2.1, 2.2), (0, 0, 1.2), 1100, (1.0, 0.55, 0.22), 0.6, lc)
    area('rim2', (1.8, 1.8, 0.8), (0, 0, 0.5), 600, (1.0, 0.6, 0.28), 0.5, lc)
    gm_ = bpy.data.meshes.new('dground')
    bm_ = bmesh.new()
    bmesh.ops.create_circle(bm_, cap_ends=True, segments=64, radius=3.0)
    bm_.to_mesh(gm_)
    go_ = bpy.data.objects.new('dground', gm_)
    lc.objects.link(go_)
    gm_.materials.append(material('dstone', '#0C0A10', rough=0.95, vary=0.3, bump=0.3, scale=6))
    for name, loc, tgt, lens in (('detail_head', (0.55, -0.98, 1.76), (0.012, -0.03, 1.665), 110),
                                 ('detail_hands', (0.95, -1.3, 1.5), (0.02, -0.22, 1.3), 75),
                                 ('detail_boots', (0.62, -1.15, 0.42), (-0.03, -0.02, 0.15), 70)):
        cam = camera('cam_' + name, loc, tgt, lens=lens)
        shoot(cam, os.path.join(OUT, name + '.png'), painterly=0, bloom_amt=0.35)
    bpy.data.collections.remove(lc)


coll = build_warrior()
for v in VIEWS:
    {'hero': hero, 'turn': turnaround, 'game': game, 'details': details}[v](coll)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'warrior.blend'))
print('DONE')
