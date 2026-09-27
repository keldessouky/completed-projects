"""Shared humanoid rig, forward/inverse kinematics and procedural animation clips.

Every bone's bind frame is axis-aligned with the character (Z up, facing -Y, character's left is +X),
so a bone's local rotation is simply "how far it has turned from rest, in its parent's frame".
Clips are authored as functions of time; weapon poses are authored as grip positions and solved with IK.
"""
import math
import struct
from mathutils import Vector as V, Quaternion as Q, Euler, Matrix

BONES = [
    ('root', None), ('pelvis', 'root'), ('spine', 'pelvis'), ('chest', 'spine'), ('neck', 'chest'), ('head', 'neck'),
    ('clavicle_L', 'chest'), ('upperarm_L', 'clavicle_L'), ('forearm_L', 'upperarm_L'), ('hand_L', 'forearm_L'),
    ('clavicle_R', 'chest'), ('upperarm_R', 'clavicle_R'), ('forearm_R', 'upperarm_R'), ('hand_R', 'forearm_R'),
    ('thigh_L', 'pelvis'), ('calf_L', 'thigh_L'), ('foot_L', 'calf_L'),
    ('thigh_R', 'pelvis'), ('calf_R', 'thigh_R'), ('foot_R', 'calf_R'),
    ('weapon_R', 'hand_R'), ('weapon_L', 'hand_L'),
]
NAMES = [b for b, _ in BONES]
INDEX = {b: i for i, b in enumerate(NAMES)}
PARENT = {b: p for b, p in BONES}


def humanoid(height=1.88, shoulder=0.215, hip=0.105, arm_drop=50.0, hunch=0.0, arm_len=1.0, leg_len=1.0):
    """Bind-pose joint positions (head, tail) for each bone. arm_drop: degrees below horizontal (A-pose)."""
    k = height / 1.88
    J = {}
    pel = V((0, 0, 0.98 * k * leg_len))
    J['root'] = (V((0, 0, 0)), V((0, 0.1, 0)))
    J['pelvis'] = (pel, pel + V((0, 0, 0.12 * k)))
    # the spine bends forward (towards -Y) by `hunch` radians spread over spine and chest
    sp = J['pelvis'][1]
    d1 = V((0, -math.sin(hunch * 0.5), math.cos(hunch * 0.5)))
    ch = sp + d1 * 0.2 * k
    J['spine'] = (sp, ch)
    d2 = V((0, -math.sin(hunch), math.cos(hunch)))
    nk = ch + d2 * 0.22 * k
    J['chest'] = (ch, nk)
    J['neck'] = (nk, nk + V((0, -math.sin(hunch) * 0.1, 0.1)) * k)
    hd = J['neck'][1]
    J['head'] = (hd, hd + V((0, -math.sin(hunch) * 0.1, 0.24)) * k)
    a = math.radians(arm_drop)
    for side, s in (('L', 1), ('R', -1)):
        clav = nk + V((s * 0.03, 0.0, -0.03)) * k
        sh = nk + V((s * shoulder, 0.0, -0.05)) * k
        J['clavicle_' + side] = (clav, sh)
        dirv = V((s * math.cos(a), 0, -math.sin(a)))
        el = sh + dirv * 0.3 * k * arm_len
        wr = el + dirv * 0.27 * k * arm_len
        J['upperarm_' + side] = (sh, el)
        J['forearm_' + side] = (el, wr)
        J['hand_' + side] = (wr, wr + dirv * 0.09 * k)
        J['weapon_' + side] = (wr + dirv * 0.075 * k, wr + dirv * 0.075 * k + V((0, 0, 0.1)))
        hp = pel + V((s * hip, 0, -0.02)) * k
        kn = V((s * (hip + 0.015), -0.01, 0.53 * k * leg_len))
        an = V((s * (hip + 0.025), 0.0, 0.1 * k))
        J['thigh_' + side] = (hp, kn)
        J['calf_' + side] = (kn, an)
        J['foot_' + side] = (an, V((an.x, -0.17 * k, 0.03 * k)))
    return J


# ------------------------------------------------------------------ export
def write_skeleton(path, J):
    with open(path, 'wb') as f:
        f.write(b'QSKL' + struct.pack('<II', 1, len(BONES)))
        for name, parent in BONES:
            head = J[name][0]
            ph = J[parent][0] if parent else V((0, 0, 0))
            t = head - ph
            inv = Matrix.Translation(-head)
            nb = name.encode()[:31]
            f.write(nb + b'\0' * (32 - len(nb)))
            f.write(struct.pack('<i', INDEX[parent] if parent else -1))
            f.write(struct.pack('<3f', *t))
            f.write(struct.pack('<4f', 0, 0, 0, 1))
            f.write(struct.pack('<3f', 1, 1, 1))
            f.write(struct.pack('<16f', *[inv[r][c] for c in range(4) for r in range(4)]))


# ------------------------------------------------------------------ pose maths
def eul(rx=0.0, ry=0.0, rz=0.0):
    return Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_quaternion()


def arc(a, b):
    """Shortest rotation taking direction a onto direction b."""
    a, b = a.normalized(), b.normalized()
    return a.rotation_difference(b)


class Pose:
    """World-space FK over the shared rig. rot[b] = local rotation (parent frame); off[b] = extra translation."""

    def __init__(self, J):
        self.J = J
        self.rot = {b: Q() for b in NAMES}
        self.off = {b: V((0, 0, 0)) for b in NAMES}

    def local_t(self, b):
        p = PARENT[b]
        ph = self.J[p][0] if p else V((0, 0, 0))
        return self.J[b][0] - ph + self.off[b]

    def world(self):
        W = {}
        for b in NAMES:
            p = PARENT[b]
            t = self.local_t(b)
            if p is None:
                W[b] = (self.rot[b].copy(), t.copy())
            else:
                pr, pt = W[p]
                W[b] = (pr @ self.rot[b], pt + pr @ t)
        return W

    def head(self, b, W=None):
        W = W or self.world()
        return W[b][1]

    def set_world_rot(self, b, q_world, W):
        p = PARENT[b]
        pr = W[p][0] if p else Q()
        self.rot[b] = pr.inverted() @ q_world

    # ---- two-bone IK: place the palm of `side` at `palm`, elbow bending towards `pole`
    def arm_ik(self, side, palm, pole, weapon_rot=None, wrist_rot=None):
        ua, fa, hd = 'upperarm_' + side, 'forearm_' + side, 'hand_' + side
        J = self.J
        L1 = (J[ua][1] - J[ua][0]).length
        L2 = (J[fa][1] - J[fa][0]).length
        palm_off = (J['weapon_' + side][0] - J[hd][0]).length
        d1b = (J[ua][1] - J[ua][0]).normalized()
        d2b = (J[fa][1] - J[fa][0]).normalized()
        target = V(palm)
        for _ in range(3):
            W = self.world()
            S = W[ua][1]
            fdir = (W[fa][0] @ d2b) if W else d2b
            wrist = target - fdir * palm_off
            D = wrist - S
            dist = min(D.length, (L1 + L2) * 0.999)
            dirn = D.normalized()
            # elbow position from the law of cosines, bent towards the pole
            cos_a = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)
            cos_a = max(-1.0, min(1.0, cos_a))
            sin_a = math.sqrt(1 - cos_a * cos_a)
            pv = V(pole) - S
            pv = (pv - dirn * pv.dot(dirn))
            pv = pv.normalized() if pv.length > 1e-6 else dirn.orthogonal().normalized()
            E = S + dirn * (L1 * cos_a) + pv * (L1 * sin_a)
            q_ua = arc(d1b, E - S)
            self.set_world_rot(ua, q_ua, W)
            W = self.world()
            cur = W[ua][0] @ d2b
            q_fa = arc(cur, wrist - E) @ W[ua][0]
            self.set_world_rot(fa, q_fa, W)
        W = self.world()
        if wrist_rot is not None:
            self.set_world_rot(hd, wrist_rot, W)
            W = self.world()
        else:
            self.rot[hd] = Q()
        if weapon_rot is not None:
            self.set_world_rot('weapon_' + side, weapon_rot, W)


def frame_rot(z_dir, x_dir):
    """World rotation whose +Z points along z_dir and +X roughly along x_dir (weapon frames)."""
    z = V(z_dir).normalized()
    x = V(x_dir) - z * V(x_dir).dot(z)
    x = x.normalized() if x.length > 1e-6 else z.orthogonal().normalized()
    y = z.cross(x)
    M = Matrix((x, y, z)).transposed()
    return M.to_quaternion()


# ------------------------------------------------------------------ keyframe helpers
def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def keys(t, ks, ease=smooth):
    """Piecewise interpolation of (time, value) keys; values may be floats or Vectors."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1:
            u = ease((t - t0) / max(t1 - t0, 1e-6))
            if isinstance(v0, V):
                return v0.lerp(v1, u)
            return v0 + (v1 - v0) * u
    return ks[-1][1]


def cyc(t, period, amp, phase=0.0):
    return amp * math.sin(math.tau * (t / period) + phase)


class Clip:
    def __init__(self, name, duration, fn, loop=False, events=None, fps=30):
        self.name, self.duration, self.fn, self.loop, self.events, self.fps = name, duration, fn, loop, events or {}, fps


def bake(J, clips, path):
    with open(path, 'wb') as f:
        f.write(b'QANM' + struct.pack('<III', 1, len(clips), len(BONES)))
        for c in clips:
            frames = max(2, int(round(c.duration * c.fps)) + 1)
            nb = c.name.encode()[:31]
            f.write(nb + b'\0' * (32 - len(nb)))
            f.write(struct.pack('<fII', c.fps, frames, 1 if c.loop else 0))
            f.write(struct.pack('<I', len(c.events)))
            for en, et in c.events.items():
                e = en.encode()[:15]
                f.write(e + b'\0' * (16 - len(e)) + struct.pack('<f', et))
            for fi in range(frames):
                t = min(fi / c.fps, c.duration)
                if c.loop and fi == frames - 1:
                    t = 0.0
                P = Pose(J)
                c.fn(P, t)
                for b in NAMES:
                    lt = P.local_t(b)
                    q = P.rot[b].normalized()
                    f.write(struct.pack('<3f', *lt) + struct.pack('<4f', q.x, q.y, q.z, q.w))


def pose_at(J, clip, t):
    P = Pose(J)
    clip.fn(P, t)
    return P
