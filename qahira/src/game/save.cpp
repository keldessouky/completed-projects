// Serialising the world: libretro save states now, character saves later. Cosmetic state (particles,
// floating text) is not saved; everything that affects the simulation is.
#include "game/save.hpp"

namespace q {

void write_item(ByteWriter& w, const Item& it) {
    w.put(it.base);
    w.put(uint8_t(it.rarity));
    w.put(it.ilvl);
    w.put(it.seed);
    w.str(it.name);
    w.put(uint8_t(it.affixes.size()));
    for (auto& a : it.affixes) { w.put(a.def); w.put(a.tier); w.put(a.v1); w.put(a.v2); }
}

Item read_item(ByteReader& r) {
    Item it;
    r.get(it.base);
    it.rarity = Rarity(r.get<uint8_t>());
    r.get(it.ilvl);
    r.get(it.seed);
    it.name = r.str();
    uint8_t n = r.get<uint8_t>();
    for (uint8_t i = 0; i < n && r.ok; i++) {
        Affix a;
        r.get(a.def); r.get(a.tier); r.get(a.v1); r.get(a.v2);
        it.affixes.push_back(a);
    }
    return it;
}

static void write_anim(ByteWriter& w, const Animator& a) {
    w.str(a.cur ? a.cur->name : "");
    w.put(a.t); w.put(a.speed); w.put(a.fired);
}

static void read_anim(ByteReader& r, Animator& a) {
    std::string clip = r.str();
    float t = r.get<float>(), spd = r.get<float>();
    uint32_t fired = r.get<uint32_t>();
    if (!clip.empty()) a.play(clip.c_str(), 0, true, spd);
    a.t = t;
    a.fired = fired;
    a.prev = nullptr;
    a.fade = 0;
}

void write_world(ByteWriter& w, const World& W) {
    w.put(W.time); w.put(W.next_id); w.put(W.area_level); w.put(W.hitstop);
    w.bytes(W.rng.s, sizeof W.rng.s);
    const Hero& H = W.hero;
    w.put(H.level); w.put(H.xp); w.put(H.rally); w.put(H.combo); w.put(H.flask); w.put(H.flask_heal_t); w.put(H.kills);
    w.bytes(H.skills, sizeof H.skills);
    w.bytes(H.cooldowns, sizeof H.cooldowns);
    write_item(w, H.weapon);
    w.put(uint8_t(H.gear.size()));
    for (auto& g : H.gear) write_item(w, g);
    w.put(uint32_t(W.actors.size()));
    for (const Actor& a : W.actors) {
        w.put(a.id); w.put(a.team); w.put(a.def); w.put(a.rarity); w.str(a.name); w.bytes(a.mods, 4);
        w.put(a.pos); w.put(a.vel); w.put(a.knock); w.put(a.facing); w.put(a.radius); w.put(a.scale); w.put(a.tint);
        w.put(a.life); w.put(a.life_max); w.put(a.mana); w.put(a.mana_max); w.put(a.armour); w.put(a.speed);
        w.put(a.dmg_mult); w.put(a.speed_mult); w.put(a.act); w.put(a.act_t); w.put(a.skill); w.put(a.struck);
        w.put(a.break_meter); w.put(a.broken_t); w.put(a.stun_t); w.put(a.hit_flash); w.put(a.dead_t);
        w.put(a.attack_cd); w.put(a.ai_t); w.put(a.ai_state);
        write_anim(w, a.anim);
    }
    w.vec(W.projectiles);
    w.vec(W.ground);
    w.put(uint32_t(W.loot.size()));
    for (auto& g : W.loot) { write_item(w, g.item); w.put(g.pos); w.put(g.t); w.put(g.id); }
}

bool read_world(ByteReader& r, World& W) {
    r.get(W.time); r.get(W.next_id); r.get(W.area_level); r.get(W.hitstop);
    r.bytes(W.rng.s, sizeof W.rng.s);
    Hero& H = W.hero;
    r.get(H.level); r.get(H.xp); r.get(H.rally); r.get(H.combo); r.get(H.flask); r.get(H.flask_heal_t); r.get(H.kills);
    r.bytes(H.skills, sizeof H.skills);
    r.bytes(H.cooldowns, sizeof H.cooldowns);
    H.weapon = read_item(r);
    uint8_t ng = r.get<uint8_t>();
    H.gear.clear();
    for (uint8_t i = 0; i < ng && r.ok; i++) H.gear.push_back(read_item(r));
    uint32_t na = r.get<uint32_t>();
    if (!r.ok || na == 0 || na > 4096) return false;
    W.actors.resize(na);
    for (Actor& a : W.actors) {
        r.get(a.id); r.get(a.team); r.get(a.def); r.get(a.rarity); a.name = r.str(); r.bytes(a.mods, 4);
        r.get(a.pos); r.get(a.vel); r.get(a.knock); r.get(a.facing); r.get(a.radius); r.get(a.scale); r.get(a.tint);
        r.get(a.life); r.get(a.life_max); r.get(a.mana); r.get(a.mana_max); r.get(a.armour); r.get(a.speed);
        r.get(a.dmg_mult); r.get(a.speed_mult); r.get(a.act); r.get(a.act_t); r.get(a.skill); r.get(a.struck);
        r.get(a.break_meter); r.get(a.broken_t); r.get(a.stun_t); r.get(a.hit_flash); r.get(a.dead_t);
        r.get(a.attack_cd); r.get(a.ai_t); r.get(a.ai_state);
        a.model = assets().character(a.def < 0 ? "warrior" : monster_defs()[size_t(a.def)].model);
        a.anim = Animator{};
        a.anim.bind(a.model.skel, a.model.anims);
        read_anim(r, a.anim);
    }
    r.vec(W.projectiles);
    r.vec(W.ground);
    uint32_t nl = r.get<uint32_t>();
    W.loot.clear();
    for (uint32_t i = 0; i < nl && r.ok; i++) {
        GroundItem g;
        g.item = read_item(r);
        r.get(g.pos); r.get(g.t); r.get(g.id);
        W.loot.push_back(g);
    }
    W.particles.clear();
    W.texts.clear();
    W.events.clear();
    W.recompute_hero();
    return r.ok;
}

}  // namespace q
