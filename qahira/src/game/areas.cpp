#include "game/areas.hpp"
#include "game/save.hpp"

namespace q {

static void place_hero(World& w, vec2 p, float facing) {
    Actor& h = w.actors[0];
    h.pos = w.level.resolve(p, h.radius);
    h.vel = h.knock = {0, 0};
    h.facing = facing;
    if (h.alive()) {
        h.act = Act::Idle;
        h.anim.play("idle", 0, true);
    }
}

static void clear_transient(World& w) {
    w.actors.resize(1);
    w.projectiles.clear();
    w.ground.clear();
    w.particles.clear();
    w.texts.clear();
    w.interacts.clear();
    w.npcs.clear();
    w.loot.clear();
    w.boss_killed = false;
}

const char* Areas::name() const {
    switch (current) {
        case AreaId::Hub: return "The Rooftop Ahwa";
        case AreaId::Necropolis: return "The City of the Dead";
        default: return "The Street of Lamps";
    }
}

const char* Areas::subtitle() const {
    switch (current) {
        case AreaId::Hub: return "Above the Qarafa, the kettle is always on";
        case AreaId::Necropolis: return "Something old is waking between the tombs";
        default: return "Combat range";
    }
}

// ---------------------------------------------------------------- the hub
static void hub_static(World& w) {
    w.level.clear();
    w.level.add_tile("rooftop", {0, 0});
    w.npcs.clear();
    vec2 cat = w.level.point("cat");
    Npc keeper;
    keeper.model = "keeper";
    keeper.pos = w.level.point("keeper");
    keeper.facing = kPi * 0.85f;
    keeper.cm = assets().character("keeper");
    keeper.anim.bind(keeper.cm.skel, keeper.cm.anims);
    keeper.anim.play("idle", 0);
    w.npcs.push_back(keeper);
    Npc c;
    c.model = "cat";
    c.pos = cat;
    c.rigged = false;
    c.facing = -1.0f;
    c.scale = 1.1f;
    w.npcs.push_back(c);
}

static vec2 hub_portal_pos(const World& w) { return w.level.point("spawn") + vec2{2.6f, 1.6f}; }

void Areas::enter_hub(World& w, Arrival how) {
    current = AreaId::Hub;
    clear_transient(w);
    hub_static(w);
    w.area_level = 1;
    vec2 stair = w.level.point("stair"), vendor = w.level.point("vendor");
    w.interacts.push_back({Interactable::Stair, stair, 2.0f, "Descend to the City of the Dead"});
    w.interacts.push_back({Interactable::Vendor, vendor, 2.0f, "Trade with Amm Sayed"});
    if (zone.valid && zone.has_portal)
        w.interacts.push_back({Interactable::Portal, hub_portal_pos(w), 1.7f, "Portal to the City of the Dead"});
    if (how == Arrival::Portal && zone.valid && zone.has_portal) place_hero(w, hub_portal_pos(w) + vec2{-1.4f, -0.6f}, kPi / 2);
    else place_hero(w, w.level.point("spawn"), kPi / 2);
}

// ---------------------------------------------------------------- the City of the Dead
void populate_zone(World& w, const ZoneLayout& z, int lvl) {
    int g = find_monster("ghoul"), sp = find_monster("ghoul_spitter"), b = find_monster("ghoul_bruiser");
    Rng& r = w.rng;
    for (const ZoneCell& c : z.cells) {
        vec2 ctr = z.center(c);
        auto at = [&](vec2 p) { return w.level.resolve(p, 0.6f); };
        auto jitter = [&](float k) { return vec2{r.range(-k, k), r.range(-k, k)}; };
        if (c.kind == ZoneCell::Entrance) continue;
        if (c.kind == ZoneCell::Arena) {
            Actor& a = w.spawn_monster(find_monster("umm_al_ghula"), at(ctr + vec2{0, 1.5f}), Rarity::Unique, lvl + 1);
            a.facing = -kPi / 2;
            continue;
        }
        if (c.kind == ZoneCell::Landmark) {
            // the cache is guarded: a rare bruiser and its pack
            w.spawn_monster(b, at(ctr + jitter(1.5f)), Rarity::Rare, lvl + 1);
            for (int i = 0; i < 4; i++) w.spawn_monster(g, at(ctr + jitter(3.f)), Rarity::Normal, lvl);
            w.spawn_monster(sp, at(ctr + jitter(3.f)), Rarity::Normal, lvl);
            continue;
        }
        int n = r.irange(3, 5) + std::min(3, c.depth / 2);
        for (int i = 0; i < n; i++) w.spawn_monster(g, at(ctr + jitter(2.f)), Rarity::Normal, lvl);
        if (c.depth >= 1 && r.chance(0.6f)) w.spawn_monster(sp, at(ctr + jitter(2.f)), Rarity::Normal, lvl);
        if (c.depth >= 2 && r.chance(0.5f)) w.spawn_monster(b, at(ctr + jitter(1.5f)), Rarity::Normal, lvl);
        if (c.kind == ZoneCell::Branch) {
            Rarity rr = r.chance(0.55f) ? Rarity::Rare : Rarity::Magic;
            w.spawn_monster(r.chance(0.5f) ? b : g, at(ctr), rr, lvl);
            if (rr == Rarity::Magic) w.spawn_monster(g, at(ctr + vec2{1, 1}), Rarity::Magic, lvl);
        }
    }
}

static vec2 entrance_dir(const ZoneCell& e) {
    return (e.mask & DIR_N) ? vec2{0, 1} : (e.mask & DIR_E) ? vec2{1, 0} : (e.mask & DIR_W) ? vec2{-1, 0} : vec2{0, -1};
}

static vec2 entrance_spot(const ZoneLayout& z) {
    const ZoneCell& e = z.cells[size_t(z.entrance)];
    return z.center(e) - entrance_dir(e) * 3.f;
}

void Areas::enter_zone(World& w, Arrival how) {
    current = AreaId::Necropolis;
    clear_transient(w);
    if (!zone.valid) {
        zone = ZoneInstance{};
        zone.seed = w.rng.next();
        zone.level = std::clamp(w.hero.level + 1, 2, 8);  // Slice 2 spans levels 1-8
        zone.layout = generate_zone(zone.seed, 4, 6, 3);
        build_zone_level(zone.layout, "necro", w.level);
        w.area_level = zone.level;
        populate_zone(w, zone.layout, zone.level);
        zone.revealed.assign(zone.layout.cells.size(), 0);
        if (zone.layout.landmark >= 0) {
            const ZoneCell& c = zone.layout.cells[size_t(zone.layout.landmark)];
            vec2 at = zone.layout.center(c);
            for (auto& p : w.level.points)
                if (p.first == "chest" && zone.layout.cell_index_at(p.second) == zone.layout.landmark) at = p.second;
            Interactable ch{Interactable::Chest, at, 1.9f, "Open the Lamplighter's cache"};
            ch.facing = angle_of(zone.layout.center(c) - at) - kPi / 2;
            w.interacts.push_back(ch);
        }
        zone.valid = true;
    } else {
        build_zone_level(zone.layout, "necro", w.level);
        w.area_level = zone.level;
        for (auto& m : zone.monsters) {
            w.actors.push_back(m);
            Actor& a = w.actors.back();
            a.model = assets().character(monster_defs()[size_t(a.def)].model);
            a.anim = Animator{};
            a.anim.bind(a.model.skel, a.model.anims);
            a.anim.play("idle", 0, true);
        }
        w.loot = zone.loot;
        w.interacts = zone.interacts;
    }
    const ZoneCell& e = zone.layout.cells[size_t(zone.layout.entrance)];
    if (how == Arrival::Portal && zone.has_portal) place_hero(w, zone.portal + vec2{-1.2f, -1.0f}, kPi / 2);
    else place_hero(w, entrance_spot(zone.layout), angle_of(entrance_dir(e)));
}

void Areas::leave_zone(World& w) {
    if (current != AreaId::Necropolis || !zone.valid) return;
    zone.monsters.clear();
    for (size_t i = 1; i < w.actors.size(); i++)
        if (w.actors[i].alive()) {
            Actor a = w.actors[i];
            a.act = Act::Idle;  // nobody is mid-swing when the hero comes back
            a.ai_state = 0;
            a.knock = a.vel = {0, 0};
            zone.monsters.push_back(a);
        }
    zone.loot = w.loot;
    zone.interacts = w.interacts;
}

void Areas::close_zone() { zone = ZoneInstance{}; }

void Areas::cast_portal(World& w) {
    if (current != AreaId::Necropolis) return;
    Actor& h = w.actors[0];
    vec2 at = w.level.resolve(h.pos + from_angle(h.facing) * 1.6f, 0.8f);
    w.interacts.erase(std::remove_if(w.interacts.begin(), w.interacts.end(), [](const Interactable& i) { return i.kind == Interactable::Portal; }),
                      w.interacts.end());
    w.interacts.push_back({Interactable::Portal, at, 1.7f, "Portal to the rooftop"});
    zone.has_portal = true;
    zone.portal = at;
    w.emit(Ev::Portal, at);
}

void Areas::open_exit_portal(World& w) {
    for (auto& i : w.interacts) if (i.kind == Interactable::Exit) return;
    vec2 c = zone.layout.center(zone.layout.cells[size_t(zone.layout.arena)]);
    vec2 at = w.level.resolve(c + vec2{0, -1.0f}, 0.8f);
    w.interacts.push_back({Interactable::Exit, at, 1.8f, "Portal home to the rooftop"});
    zone.cleared = true;
    w.emit(Ev::Portal, at);
}

void Areas::open_chest(World& w, int i) {
    if (i < 0 || i >= int(w.interacts.size())) return;
    Interactable& ch = w.interacts[size_t(i)];
    if (ch.kind != Interactable::Chest || ch.spent) return;
    ch.spent = true;
    ch.label.clear();
    int lvl = w.area_level + 1;
    vec2 pos = ch.pos;
    float out = ch.facing + kPi / 2;
    for (int k = 0; k < 3; k++) {
        GroundItem g;
        g.item = random_drop(lvl, k == 0 ? 1.f : 0.3f, 0.7f, w.rng);
        g.pos = w.level.resolve(pos + rotate(vec2{1.3f, 0}, out + (k - 1) * 0.7f), 0.3f);
        g.id = w.next_id++;
        w.loot.push_back(g);
    }
    w.drop_currency(pos + rotate(vec2{1.8f, 0}, out + 1.4f), roll_currency(w.rng), 1);
    w.drop_currency(pos + rotate(vec2{1.8f, 0}, out - 1.4f), CUR_SAFFRON, 1);
    w.drop_gold(pos + rotate(vec2{1.0f, 0}, out), 25 + 8 * lvl);
    w.burst(vec3(pos, 0.6f), 30, vec4(1.f, 0.75f, 0.35f, 1), vec4(1.f, 0.4f, 0.1f, 0), 3.f, 0.12f, 0.9f, true, -2.f);
    w.emit(Ev::Pickup, pos, 2.f);
}

void Areas::respawn(World& w) {
    Actor& h = w.actors[0];
    h.act = Act::Idle;
    h.dead_t = 0;
    h.life = h.life_max;
    h.mana = h.mana_max;
    w.hero.flask = w.hero.flask_max;
    w.projectiles.clear();
    w.ground.clear();
    if (current == AreaId::Necropolis) {
        // PoE2 rules: back to the entrance; a boss you were fighting heals and returns to her court
        vec2 court = zone.layout.center(zone.layout.cells[size_t(zone.layout.arena)]);
        for (size_t i = 1; i < w.actors.size(); i++) {
            Actor& a = w.actors[i];
            if (!a.alive()) continue;
            a.ai_state = 0;
            a.act = Act::Idle;
            if (a.rarity == Rarity::Unique) {
                a.life = a.life_max;
                a.phase = 0;
                a.break_meter = 0;
                a.broken_t = a.stun_t = 0;
                a.pos = court + vec2{0, 1.5f};
                a.cd2 = 3.f;
                a.cd3 = 1e9f;
            } else if (length(a.pos - court) < 12.f) {
                // her summoned brood goes back into the ground
                a.life = 0;
                a.act = Act::Dead;
                a.dead_t = 2.3f;
            }
        }
        const ZoneCell& e = zone.layout.cells[size_t(zone.layout.entrance)];
        place_hero(w, entrance_spot(zone.layout), angle_of(entrance_dir(e)));
    } else if (current == AreaId::Street) {
        place_hero(w, {0, -9}, kPi / 2);
    } else {
        place_hero(w, w.level.point("spawn"), kPi / 2);
    }
    h.anim.play("idle", 0, true);
}

void Areas::reveal(const World& w) {
    if (current != AreaId::Necropolis || zone.revealed.size() != zone.layout.cells.size()) return;
    vec2 p = w.actors[0].pos;
    for (size_t i = 0; i < zone.layout.cells.size(); i++)
        if (length(zone.layout.center(zone.layout.cells[i]) - p) < 19.f) zone.revealed[i] = 1;  // the cell you are in and what you can see
}

// ---------------------------------------------------------------- the Slice 1 street (combat range)
static void spawn_street_encounter(World& w) {
    int g = find_monster("ghoul"), b = find_monster("ghoul_bruiser"), s = find_monster("ghoul_spitter");
    auto pack = [&](vec2 c, int ghouls, int spitters, int bruisers, bool rare) {
        auto at = [&](vec2 p) { return w.level.resolve(p, 0.6f); };
        for (int i = 0; i < ghouls; i++) w.spawn_monster(g, at(c + vec2{w.rng.range(-1.8f, 1.8f), w.rng.range(-1.5f, 1.5f)}), Rarity::Normal, w.area_level);
        for (int i = 0; i < spitters; i++) w.spawn_monster(s, at(c + vec2{w.rng.range(-1.5f, 1.5f), w.rng.range(2.f, 3.5f)}), Rarity::Normal, w.area_level);
        for (int i = 0; i < bruisers; i++) w.spawn_monster(b, at(c + vec2{w.rng.range(-1.f, 1.f), 2.f}), Rarity::Normal, w.area_level);
        if (rare) w.spawn_monster(b, at(c + vec2{0, 3.f}), Rarity::Rare, w.area_level);
    };
    pack({0, 8}, 5, 0, 0, false);
    pack({0, 28}, 4, 2, 0, false);
    pack({0, 50}, 4, 1, 1, true);
}

static void street_static(World& w) {
    w.level.clear();
    w.level.add_tile("street_a", {0, 0});
    w.level.add_tile("souq_a", {0, 24});
    w.level.add_tile("souq_b", {0, 48});
}

void Areas::enter_street(World& w) {
    current = AreaId::Street;
    clear_transient(w);
    street_static(w);
    w.area_level = 1;
    place_hero(w, {0, -9}, kPi / 2);
    spawn_street_encounter(w);
}

// ---------------------------------------------------------------- save states
void Areas::rebuild(World& w) {
    switch (current) {
        case AreaId::Hub: hub_static(w); break;
        case AreaId::Necropolis: w.npcs.clear(); build_zone_level(zone.layout, "necro", w.level); break;
        case AreaId::Street: w.npcs.clear(); street_static(w); break;
    }
}

static void write_layout(ByteWriter& w, const ZoneLayout& z) {
    w.put(z.w); w.put(z.h); w.put(z.cell); w.put(z.entrance); w.put(z.arena); w.put(z.landmark); w.put(z.seed);
    w.put(uint16_t(z.cells.size()));
    for (auto& c : z.cells) { w.put(c.x); w.put(c.y); w.put(c.mask); w.put(c.kind); w.put(c.depth); w.put(c.main); }
}

static void read_layout(ByteReader& r, ZoneLayout& z) {
    r.get(z.w); r.get(z.h); r.get(z.cell); r.get(z.entrance); r.get(z.arena); r.get(z.landmark); r.get(z.seed);
    uint16_t n = r.get<uint16_t>();
    z.cells.clear();
    for (uint16_t i = 0; i < n && r.ok; i++) {
        ZoneCell c;
        r.get(c.x); r.get(c.y); r.get(c.mask); r.get(c.kind); r.get(c.depth); r.get(c.main);
        z.cells.push_back(c);
    }
}

static void write_interacts(ByteWriter& w, const std::vector<Interactable>& v) {
    w.put(uint16_t(v.size()));
    for (auto& i : v) { w.put(i.kind); w.put(i.pos); w.put(i.radius); w.str(i.label); w.put(i.facing); w.put(i.spent); }
}

static void read_interacts(ByteReader& r, std::vector<Interactable>& v) {
    uint16_t n = r.get<uint16_t>();
    v.clear();
    for (uint16_t k = 0; k < n && r.ok; k++) {
        Interactable i{};
        r.get(i.kind); r.get(i.pos); r.get(i.radius); i.label = r.str(); r.get(i.facing); r.get(i.spent);
        v.push_back(i);
    }
}

void Areas::write(ByteWriter& w) const {
    w.put(current);
    const ZoneInstance& z = zone;
    w.put(z.valid); w.put(z.cleared); w.put(z.has_portal); w.put(z.portal); w.put(z.level); w.put(z.seed);
    if (!z.valid) return;
    write_layout(w, z.layout);
    w.put(uint16_t(z.monsters.size()));
    for (auto& a : z.monsters) write_actor(w, a);
    w.put(uint16_t(z.loot.size()));
    for (auto& g : z.loot) write_ground_item(w, g);
    write_interacts(w, z.interacts);
    w.put(uint16_t(z.revealed.size()));
    if (!z.revealed.empty()) w.bytes(z.revealed.data(), z.revealed.size());
}

bool Areas::read(ByteReader& r) {
    r.get(current);
    ZoneInstance& z = zone;
    z = ZoneInstance{};
    r.get(z.valid); r.get(z.cleared); r.get(z.has_portal); r.get(z.portal); r.get(z.level); r.get(z.seed);
    if (!z.valid) return r.ok;
    read_layout(r, z.layout);
    uint16_t nm = r.get<uint16_t>();
    for (uint16_t i = 0; i < nm && r.ok; i++) {
        Actor a;
        read_actor(r, a);
        z.monsters.push_back(a);
    }
    uint16_t nl = r.get<uint16_t>();
    for (uint16_t i = 0; i < nl && r.ok; i++) z.loot.push_back(read_ground_item(r));
    read_interacts(r, z.interacts);
    uint16_t nr = r.get<uint16_t>();
    z.revealed.resize(nr);
    if (nr) r.bytes(z.revealed.data(), nr);
    return r.ok;
}

}  // namespace q
