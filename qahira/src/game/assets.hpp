// Loads and caches meshes, skeletons and animation sets from the content pack.
#pragma once
#include "gfx/mesh.hpp"
#include "anim/anim.hpp"
#include <memory>
#include <string>
#include <unordered_map>

namespace q {

struct CharacterModel {
    std::string name;
    GpuMesh* body = nullptr;
    const Skeleton* skel = nullptr;
    const AnimSet* anims = nullptr;
    int weapon_bone = -1;
    int weapon_bone_l = -1;
    int pelvis = -1;
};

class Assets {
public:
    GpuMesh* mesh(const std::string& name);       // meshes/<name>.qmesh (GPU required)
    const Skeleton* skeleton(const std::string& name);
    const AnimSet* anims(const std::string& name);
    CharacterModel character(const std::string& name);
    void gpu_lost();                               // forget GL objects (context lost)
    void clear();

private:
    std::unordered_map<std::string, std::unique_ptr<GpuMesh>> meshes_;
    std::unordered_map<std::string, std::unique_ptr<Skeleton>> skels_;
    std::unordered_map<std::string, std::unique_ptr<AnimSet>> anims_;
};

Assets& assets();

}  // namespace q
