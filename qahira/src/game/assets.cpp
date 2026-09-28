#include "game/assets.hpp"
#include "core/log.hpp"

namespace q {

Assets& assets() { static Assets a; return a; }

GpuMesh* Assets::mesh(const std::string& name) {
    auto it = meshes_.find(name);
    if (it != meshes_.end()) return it->second.get();
    auto m = std::make_unique<GpuMesh>();
    Blob b = pack().get("meshes/" + name + ".qmesh");
    if (!b || !m->load(b)) { QERR("mesh %s missing", name.c_str()); m.reset(); }
    GpuMesh* p = m.get();
    meshes_[name] = std::move(m);
    return p;
}

const Skeleton* Assets::skeleton(const std::string& name) {
    auto it = skels_.find(name);
    if (it != skels_.end()) return it->second.get();
    auto s = std::make_unique<Skeleton>();
    Blob b = pack().get("skel/" + name + ".qskel");
    if (!b || !s->load(b)) { QERR("skeleton %s missing", name.c_str()); s.reset(); }
    const Skeleton* p = s.get();
    skels_[name] = std::move(s);
    return p;
}

const AnimSet* Assets::anims(const std::string& name) {
    auto it = anims_.find(name);
    if (it != anims_.end()) return it->second.get();
    auto a = std::make_unique<AnimSet>();
    Blob b = pack().get("anim/" + name + ".qanim");
    if (!b || !a->load(b)) { QERR("anims %s missing", name.c_str()); a.reset(); }
    const AnimSet* p = a.get();
    anims_[name] = std::move(a);
    return p;
}

CharacterModel Assets::character(const std::string& name) {
    CharacterModel c;
    c.name = name;
    c.skel = skeleton(name);
    c.anims = anims(name);
    if (c.skel) {
        c.weapon_bone = c.skel->find("weapon_R");
        c.weapon_bone_l = c.skel->find("weapon_L");
        c.pelvis = c.skel->find("pelvis");
    }
    return c;
}

void Assets::gpu_lost() {
    for (auto& kv : meshes_) if (kv.second) { kv.second->vao = kv.second->vbo = kv.second->ibo = 0; }
    meshes_.clear();
}

void Assets::clear() {
    for (auto& kv : meshes_) if (kv.second) kv.second->destroy();
    meshes_.clear();
    skels_.clear();
    anims_.clear();
}

}  // namespace q
