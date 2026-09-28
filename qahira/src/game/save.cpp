// Serialising the world: libretro save states now, character saves later. Cosmetic state (particles,
// floating text) is not saved; everything that affects the simulation is.
#include "game/save.hpp"

namespace q {

// Item format 2 (character v4): corruption, the unique it is, and each affix's bench/implicit flags
void write_item(ByteWriter& w, const Item& it) {
    w.put(it.base);
    w.put(uint8_t(it.rarity));
    w.put(it.ilvl);
    w.put(it.seed);
    w.str(it.name);
    w.put(uint8_t(it.affixes.size()));
    for (auto& a : it.affixes) { w.put(a.def); w.put(a.tier); w.put(a.v1); w.put(a.v2); w.put(a.flags); }
    w.put(uint8_t(it.corrupted));
    w.put(it.unique);
}

Item read_item(ByteReader& r, int fmt) {
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
        if (fmt >= 2) r.get(a.flags);
        if (a.def < affix_defs().size()) it.affixes.push_back(a);
    }
    if (fmt >= 2) {
        it.corrupted = r.get<uint8_t>() != 0;
        r.get(it.unique);
        if (it.unique != kNoItem && it.unique >= unique_defs().size()) it.unique = kNoItem;
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

void write_actor(ByteWriter& w, const Actor& a) {
    w.put(a.id); w.put(a.team); w.put(a.def); w.put(a.rarity); w.str(a.name); w.bytes(a.mods, 4);
    w.put(a.pos); w.put(a.vel); w.put(a.knock); w.put(a.facing); w.put(a.radius); w.put(a.scale); w.put(a.tint);
    w.put(a.life); w.put(a.life_max); w.put(a.mana); w.put(a.mana_max); w.put(a.armour); w.put(a.speed);
    w.put(a.dmg_mult); w.put(a.speed_mult); w.put(a.act); w.put(a.act_t); w.put(a.skill); w.put(a.struck);
    w.put(a.break_meter); w.put(a.broken_t); w.put(a.stun_t); w.put(a.hit_flash); w.put(a.dead_t);
    w.put(a.attack_cd); w.put(a.ai_t); w.put(a.ai_state);
    w.put(a.phase); w.put(a.cd2); w.put(a.cd3); w.put(a.from); w.put(a.target); w.put(a.home);
    w.put(a.ignite_t); w.put(a.ignite_dps); w.put(a.chill_t); w.put(a.chill); w.put(a.freeze_meter); w.put(a.frozen_t);
    w.put(a.shock_t); w.put(a.shock);
    w.bytes(a.poison, sizeof a.poison); w.bytes(a.poison_t, sizeof a.poison_t); w.put(a.mark_t); w.put(a.mark_hits); w.put(a.rift);
    w.put(a.bleed_t); w.put(a.bleed_dps); w.put(a.struck2); w.put(a.dig);
    w.bytes(a.move_cd, sizeof a.move_cd);
    write_anim(w, a.anim);
}

void read_actor(ByteReader& r, Actor& a) {
    r.get(a.id); r.get(a.team); r.get(a.def); r.get(a.rarity); a.name = r.str(); r.bytes(a.mods, 4);
    r.get(a.pos); r.get(a.vel); r.get(a.knock); r.get(a.facing); r.get(a.radius); r.get(a.scale); r.get(a.tint);
    r.get(a.life); r.get(a.life_max); r.get(a.mana); r.get(a.mana_max); r.get(a.armour); r.get(a.speed);
    r.get(a.dmg_mult); r.get(a.speed_mult); r.get(a.act); r.get(a.act_t); r.get(a.skill); r.get(a.struck);
    r.get(a.break_meter); r.get(a.broken_t); r.get(a.stun_t); r.get(a.hit_flash); r.get(a.dead_t);
    r.get(a.attack_cd); r.get(a.ai_t); r.get(a.ai_state);
    r.get(a.phase); r.get(a.cd2); r.get(a.cd3); r.get(a.from); r.get(a.target); r.get(a.home);
    r.get(a.ignite_t); r.get(a.ignite_dps); r.get(a.chill_t); r.get(a.chill); r.get(a.freeze_meter); r.get(a.frozen_t);
    r.get(a.shock_t); r.get(a.shock);
    r.bytes(a.poison, sizeof a.poison); r.bytes(a.poison_t, sizeof a.poison_t); r.get(a.mark_t); r.get(a.mark_hits); r.get(a.rift);
    r.get(a.bleed_t); r.get(a.bleed_dps); r.get(a.struck2); r.get(a.dig);
    r.bytes(a.move_cd, sizeof a.move_cd);
    a.model = a.def < 0 ? assets().character(hero_model()) : monster_model(a.def);
    a.anim = Animator{};
    a.anim.bind(a.model.skel, a.model.anims);
    read_anim(r, a.anim);
}

void write_ground_item(ByteWriter& w, const GroundItem& g) {
    w.put(g.kind); write_item(w, g.item); w.put(g.pos); w.put(g.t); w.put(g.id); w.put(g.amount); w.put(g.currency);
}

GroundItem read_ground_item(ByteReader& r) {
    GroundItem g;
    r.get(g.kind);
    g.item = read_item(r);
    r.get(g.pos); r.get(g.t); r.get(g.id); r.get(g.amount); r.get(g.currency);
    return g;
}

// ---- the character: what persists between sessions
static const uint32_t kCharMagic = 0x31484351;  // "QCH1"
static const uint32_t kCharVersion = 7;   // 2: the class and its stars; 3: Talismans, Wafq, Blanks, currency count;
                                          // 4: Act I (waypoints, quests, the toll, recipes, scraps, codex, omens,
                                          //    ascendancy) and item format 2; 5: the Map of al-Idrisi (sites, the
                                          //    Astrolabe); 6: the ascendancy chosen; 7: the weapon swap slot, 64-bit waypoints

void write_character(ByteWriter& w, const Hero& H) {
    w.put(kCharMagic);
    w.put(kCharVersion);
    w.put(H.level); w.put(H.xp); w.put(H.kills); w.put(H.gold); w.put(H.filter);
    w.put(uint8_t(CUR_COUNT));
    w.bytes(H.currency, sizeof H.currency);
    w.str(H.passives.cls);
    std::vector<int> held = H.passives.held();
    w.put(uint16_t(held.size()));
    for (int id : held) w.put(uint16_t(id));
    // skills
    w.put(uint8_t(H.talismans.size()));
    for (auto& t : H.talismans) { w.put(t.skill); w.put(t.level); w.put(t.slots); w.bytes(t.wafq, sizeof t.wafq); }
    w.bytes(H.bar, sizeof H.bar);
    w.put(uint8_t(WQ_COUNT));
    w.bytes(H.wafq, sizeof H.wafq);
    w.put(uint16_t(H.blanks.size()));
    if (!H.blanks.empty()) w.bytes(H.blanks.data(), H.blanks.size());
    w.put(uint16_t(H.plan.size()));
    for (uint16_t p : H.plan) w.put(p);
    w.put(uint8_t(EQ_COUNT));
    for (auto& e : H.equip) write_item(w, e);
    w.put(uint16_t(H.inv.items.size()));
    for (auto& e : H.inv.items) { write_item(w, e.item); w.put(uint8_t(e.x)); w.put(uint8_t(e.y)); }
    // v4
    w.put(H.waypoints); w.put(H.quests);   // v7: waypoints are 64 bits (the zones outgrew 32)
    write_item(w, H.sealed); w.put(H.sealed_slot);
    w.put(H.omens); w.put(H.recipes); w.put(H.codex); w.put(H.asc);
    w.put(uint8_t(kMaxUniques));
    w.bytes(H.scraps, sizeof H.scraps);
    // v5
    w.put(H.sites_revealed); w.put(H.sites_done); w.put(H.astro);
    // v6
    w.put(H.ascendancy);
}

bool read_character(ByteReader& r, Hero& H) {
    if (r.get<uint32_t>() != kCharMagic) return false;
    uint32_t version = r.get<uint32_t>();
    if (version < 1 || version > kCharVersion) return false;
    r.get(H.level); r.get(H.xp); r.get(H.kills); r.get(H.gold); r.get(H.filter);
    for (int& c : H.currency) c = 0;
    if (version >= 3) {
        uint8_t nc = r.get<uint8_t>();
        for (int c = 0; c < nc && r.ok; c++) { int v = r.get<int>(); if (c < CUR_COUNT) H.currency[c] = v; }
    } else {
        for (int c = 0; c < kCurrencyV2; c++) H.currency[c] = r.get<int>();
        int old_skills[5];
        r.bytes(old_skills, sizeof old_skills);   // the Slice 2 skill bar: rebuilt from the class kit below
    }
    tree().load();
    std::string cls = "warrior";   // Slice 2 characters were all Warriors, with no stars yet
    if (version >= 2) cls = r.str();
    if (cls.empty()) cls = "warrior";
    apply_class_base(H, cls);
    H.passives.reset(cls);
    if (version >= 2) {
        uint16_t n = r.get<uint16_t>();
        for (uint16_t i = 0; i < n && r.ok; i++) {
            uint16_t id = r.get<uint16_t>();
            if (id < H.passives.taken.size()) H.passives.taken[id] = 1;
        }
    }
    H.talismans.clear();
    H.plan.clear();
    for (auto& b : H.bar) b = -1;
    for (int& wq : H.wafq) wq = 0;
    H.blanks.clear();
    if (version >= 3) {
        uint8_t nt = r.get<uint8_t>();
        for (uint8_t i = 0; i < nt && r.ok; i++) {
            Talisman t;
            r.get(t.skill); r.get(t.level); r.get(t.slots); r.bytes(t.wafq, sizeof t.wafq);
            if (t.skill >= int(skill_defs().size())) t.skill = -1;
            H.talismans.push_back(t);
        }
        r.bytes(H.bar, sizeof H.bar);
        uint8_t nw = r.get<uint8_t>();
        for (int i = 0; i < nw && r.ok; i++) { int v = r.get<int>(); if (i < WQ_COUNT) H.wafq[i] = v; }
        uint16_t nb = r.get<uint16_t>();
        H.blanks.resize(nb);
        if (nb) r.bytes(H.blanks.data(), nb);
        uint16_t np = r.get<uint16_t>();
        H.plan.clear();
        for (uint16_t i = 0; i < np && r.ok; i++) {
            uint16_t id = r.get<uint16_t>();
            if (id < tree().stars.size()) H.plan.push_back(id);
        }
        for (auto& b : H.bar) if (b >= int(H.talismans.size())) b = -1;
    } else {
        give_class_kit(H);
    }
    uint8_t ne = r.get<uint8_t>();
    if (ne != (version >= 7 ? EQ_COUNT : kEquipV6)) return false;
    const int fmt = version >= 4 ? 2 : 1;
    for (auto& e : H.equip) e = Item{};
    for (int e = 0; e < ne && r.ok; e++) H.equip[e] = read_item(r, fmt);
    uint16_t ni = r.get<uint16_t>();
    H.inv.items.clear();
    for (uint16_t i = 0; i < ni && r.ok; i++) {
        InvItem e;
        e.item = read_item(r, fmt);
        e.x = r.get<uint8_t>();
        e.y = r.get<uint8_t>();
        H.inv.items.push_back(e);
    }
    H.waypoints = H.quests = H.recipes = H.asc = 0;
    H.codex = 0;
    H.omens = 0;
    H.sealed = Item{};
    H.sealed_slot = -1;
    for (auto& sc : H.scraps) sc = 0;
    if (version >= 4) {
        if (version >= 7) r.get(H.waypoints);
        else H.waypoints = r.get<uint32_t>();
        r.get(H.quests);
        H.sealed = read_item(r, fmt); r.get(H.sealed_slot);
        r.get(H.omens); r.get(H.recipes); r.get(H.codex); r.get(H.asc);
        uint8_t ns = r.get<uint8_t>();
        for (int i = 0; i < ns && r.ok; i++) { uint8_t v = r.get<uint8_t>(); if (i < kMaxUniques) H.scraps[i] = v; }
        if (H.sealed_slot >= EQ_COUNT) H.sealed_slot = -1;
    }
    H.sites_revealed = H.sites_done = H.astro = 0;
    if (version >= 5) { r.get(H.sites_revealed); r.get(H.sites_done); r.get(H.astro); }
    H.ascendancy = -1;
    if (version >= 6) r.get(H.ascendancy);
    if (H.ascendancy >= int(ascendancies().size())) H.ascendancy = -1;
    if (H.quests & Q_BENCH) H.recipes |= kStarterRecipes;
    if (H.quests & Q_ACT1) H.sites_revealed |= starting_sites();   // an Act I finished before the map existed
    if (H.filter >= FILTER_COUNT) H.filter = FILTER_STANDARD;
    return r.ok;
}

void write_world(ByteWriter& w, const World& W) {
    w.put(W.time); w.put(W.next_id); w.put(W.area_level); w.put(W.hitstop); w.put(W.boss_killed);
    w.bytes(W.rng.s, sizeof W.rng.s);
    const Hero& H = W.hero;
    write_character(w, H);
    w.put(H.rally); w.put(H.combo); w.put(H.flask); w.put(H.flask_heal_t);
    w.put(H.es); w.put(H.es_wait); w.put(H.overload_t); w.put(H.last_attacker);
    w.bytes(H.cooldowns, sizeof H.cooldowns);
    w.put(H.endurance); w.put(H.endurance_t); w.put(H.frenzy); w.put(H.frenzy_t);
    w.put(W.in_chart); w.put(W.chart_site); w.put(W.chart); w.put(W.haboob); w.put(W.rift); w.put(W.dig);
    w.put(uint32_t(W.actors.size()));
    for (const Actor& a : W.actors) write_actor(w, a);
    w.vec(W.projectiles);
    w.vec(W.ground);
    w.put(uint32_t(W.loot.size()));
    for (auto& g : W.loot) write_ground_item(w, g);
    w.put(uint16_t(W.interacts.size()));
    for (auto& i : W.interacts) { w.put(i.kind); w.put(i.pos); w.put(i.radius); w.str(i.label); w.put(i.facing); w.put(i.spent); w.put(i.target); }
}

bool read_world(ByteReader& r, World& W) {
    r.get(W.time); r.get(W.next_id); r.get(W.area_level); r.get(W.hitstop); r.get(W.boss_killed);
    r.bytes(W.rng.s, sizeof W.rng.s);
    Hero& H = W.hero;
    if (!read_character(r, H)) return false;
    r.get(H.rally); r.get(H.combo); r.get(H.flask); r.get(H.flask_heal_t);
    float es = r.get<float>();
    r.get(H.es_wait); r.get(H.overload_t); r.get(H.last_attacker);
    r.bytes(H.cooldowns, sizeof H.cooldowns);
    r.get(H.endurance); r.get(H.endurance_t); r.get(H.frenzy); r.get(H.frenzy_t);
    r.get(W.in_chart); r.get(W.chart_site); r.get(W.chart); r.get(W.haboob); r.get(W.rift); r.get(W.dig);
    uint32_t na = r.get<uint32_t>();
    if (!r.ok || na == 0 || na > 4096) return false;
    W.actors.resize(na);
    for (Actor& a : W.actors) read_actor(r, a);
    r.vec(W.projectiles);
    r.vec(W.ground);
    uint32_t nl = r.get<uint32_t>();
    W.loot.clear();
    for (uint32_t i = 0; i < nl && r.ok; i++) {
        W.loot.push_back(read_ground_item(r));
    }
    uint16_t ni = r.get<uint16_t>();
    W.interacts.clear();
    for (uint16_t i = 0; i < ni && r.ok; i++) {
        Interactable it{};
        r.get(it.kind); r.get(it.pos); r.get(it.radius); it.label = r.str(); r.get(it.facing); r.get(it.spent); r.get(it.target);
        W.interacts.push_back(it);
    }
    W.particles.clear();
    W.texts.clear();
    W.events.clear();
    W.recompute_hero();
    H.es = std::min(es, H.es_max);
    return r.ok;
}

}  // namespace q
