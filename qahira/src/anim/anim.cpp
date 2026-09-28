#include "anim/anim.hpp"
#include "core/log.hpp"
#include <cstring>

namespace q {

static std::string fixed_str(Reader& r, size_t n) {
    char buf[64] = {};
    r.bytes(buf, n);
    buf[n < 63 ? n : 63] = 0;
    return std::string(buf);
}

bool Skeleton::load(Blob b) {
    Reader r(b);
    char magic[4];
    r.bytes(magic, 4);
    if (memcmp(magic, "QSKL", 4)) { QERR("bad skeleton"); return false; }
    r.get<uint32_t>();
    uint32_t n = r.get<uint32_t>();
    bones.resize(n);
    for (auto& bn : bones) {
        bn.name = fixed_str(r, 32);
        bn.parent = r.get<int32_t>();
        r.bytes(&bn.bind.t, 12);
        r.bytes(&bn.bind.r, 16);
        r.bytes(&bn.bind.s, 12);
        r.bytes(bn.inv_bind.m, 64);
    }
    return true;
}

int Skeleton::find(const std::string& name) const {
    for (size_t i = 0; i < bones.size(); i++) if (bones[i].name == name) return int(i);
    return -1;
}

bool AnimSet::load(Blob b) {
    Reader r(b);
    char magic[4];
    r.bytes(magic, 4);
    if (memcmp(magic, "QANM", 4)) { QERR("bad anim set"); return false; }
    r.get<uint32_t>();
    uint32_t nclips = r.get<uint32_t>();
    uint32_t nb = r.get<uint32_t>();
    clips.resize(nclips);
    for (auto& c : clips) {
        c.name = fixed_str(r, 32);
        c.fps = r.get<float>();
        c.frames = int(r.get<uint32_t>());
        c.loop = (r.get<uint32_t>() & 1) != 0;
        c.bone_count = int(nb);
        uint32_t nev = r.get<uint32_t>();
        for (uint32_t i = 0; i < nev; i++) {
            AnimEvent e;
            e.name = fixed_str(r, 16);
            e.time = r.get<float>();
            c.events.push_back(e);
        }
        c.samples.resize(size_t(c.frames) * nb);
        for (auto& x : c.samples) { r.bytes(&x.t, 12); r.bytes(&x.r, 16); x.s = {1, 1, 1}; }
    }
    return true;
}

const Clip* AnimSet::find(const std::string& name) const {
    for (auto& c : clips) if (c.name == name) return &c;
    return nullptr;
}

void Clip::sample(float t, std::vector<Xform>& out) const {
    out.resize(size_t(bone_count));
    if (frames <= 0) return;
    float d = duration();
    if (loop && d > 0) { t = std::fmod(t, d); if (t < 0) t += d; }
    else t = clampf(t, 0, d);
    float f = t * fps;
    int f0 = int(f);
    if (f0 >= frames - 1) { f0 = frames - 1; f = float(f0); }
    int f1 = std::min(f0 + 1, frames - 1);
    float a = f - f0;
    const Xform* A = &samples[size_t(f0) * bone_count];
    const Xform* B = &samples[size_t(f1) * bone_count];
    for (int i = 0; i < bone_count; i++) out[size_t(i)] = blend(A[i], B[i], a);
}

float Clip::event_time(const char* name, float def) const {
    for (auto& e : events) if (e.name == name) return e.time;
    return def;
}

void blend_pose(std::vector<Xform>& a, const std::vector<Xform>& b, float w) {
    for (size_t i = 0; i < a.size() && i < b.size(); i++) a[i] = blend(a[i], b[i], w);
}

void Pose::set_bind(const Skeleton& s) {
    resize(s.bones.size());
    for (size_t i = 0; i < s.bones.size(); i++) local[i] = s.bones[i].bind;
}

void Pose::compute_model(const Skeleton& s, const mat4& root) {
    for (size_t i = 0; i < s.bones.size(); i++) {
        mat4 l = local[i].matrix();
        int p = s.bones[i].parent;
        model[i] = (p >= 0 ? model[size_t(p)] : root) * l;
    }
}

void Pose::write_palette(const Skeleton& s, float* rows) const {
    for (size_t i = 0; i < s.bones.size(); i++) {
        mat4 m = model[i] * s.bones[i].inv_bind;
        float* o = rows + i * 12;
        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 4; c++) o[r * 4 + c] = m(r, c);
    }
}

}  // namespace q
