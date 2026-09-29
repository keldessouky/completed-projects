#include "game/areas.hpp"
#include "game/save.hpp"

namespace q {

// `anchor`: a spot known to be open (a portal, which was cast where the hero stood). The hero arrives beside it only
// when there is a clear line from it; otherwise on it, never in a pocket between two blocks.
static void place_hero(World& w, vec2 p, float facing, const vec2* anchor = nullptr) {
    Actor& h = w.actors[0];
    h.pos = w.level.resolve(p, h.radius);
    if (anchor && !w.level.line_clear(*anchor, h.pos, h.radius)) h.pos = w.level.resolve(*anchor, h.radius);
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
    w.coil_t = -1;
}

const char* Areas::name() const {
    switch (current) {
        case AreaId::Hub: return "The Rooftop Ahwa";
        case AreaId::Zone: return zone.valid ? zone_def(zone.def).name : "";
        default: return "The Street of Lamps";
    }
}

const char* Areas::subtitle() const {
    switch (current) {
        case AreaId::Hub: return "Above the Qarafa, the kettle is always on";
        case AreaId::Zone: return zone.valid ? zone_def(zone.def).subtitle : "";
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
    if (w.hero.quests & Q_BENCH) {   // Usta Hassan came up to the roof with his bench
        Npc smith;
        smith.model = "coppersmith";
        smith.pos = w.level.point("spawn") + vec2{-5.2f, 4.6f};
        smith.facing = -kPi * 0.25f;
        smith.cm = assets().character("coppersmith");
        smith.anim.bind(smith.cm.skel, smith.cm.anims);
        smith.anim.play("idle", 0);
        w.npcs.push_back(smith);
    }
    if (w.hero.quests & Q_ACT3) {   // Amm Ramadan came up from Siwa with a sack of what he calls antiquities
        Npc dealer;
        dealer.model = "dealer";
        dealer.pos = w.level.point("spawn") + vec2{-4.6f, -2.2f};
        dealer.facing = kPi * 0.2f;
        dealer.cm = assets().character("dealer");
        dealer.anim.bind(dealer.cm.skel, dealer.cm.anims);
        dealer.anim.play("idle", 0);
        w.npcs.push_back(dealer);
    }
}

static vec2 hub_portal_pos(const World& w) { return w.level.point("spawn") + vec2{2.6f, 1.6f}; }

void Areas::enter_hub(World& w, Arrival how) {
    current = AreaId::Hub;
    clear_transient(w);
    hub_static(w);
    w.area_level = 1;
    vec2 stair = w.level.point("stair"), vendor = w.level.point("vendor");
    w.interacts.push_back({Interactable::Stair, stair, 2.0f, "Down into the city"});
    w.interacts.push_back({Interactable::Vendor, vendor, 2.0f, "Trade with Amm Sayed"});
    if (w.hero.quests & Q_BENCH)
        w.interacts.push_back({Interactable::Bench, w.level.point("spawn") + vec2{-4.2f, 3.6f}, 1.9f, "Usta Hassan's bench"});
    if (w.hero.quests & Q_ACT3)
        w.interacts.push_back({Interactable::Dealer, w.level.point("spawn") + vec2{-3.8f, -1.6f}, 1.9f, "Barter with Amm Ramadan"});
    if (w.hero.quests & Q_ACT1)   // the chart table: al-Idrisi's map, spread out under the lights
        w.interacts.push_back({Interactable::ChartTable, w.level.point("spawn") + vec2{4.6f, 3.8f}, 1.9f, "The Map of al-Idrisi"});
    w.in_chart = false;
    if (zone.valid && zone.has_portal)
        w.interacts.push_back({Interactable::Portal, hub_portal_pos(w), 1.7f, std::string("Portal to ") + zone_def(zone.def).name});
    if (how == Arrival::Portal && zone.valid && zone.has_portal) {
        vec2 portal = hub_portal_pos(w);
        place_hero(w, portal + vec2{-1.4f, -0.6f}, kPi / 2, &portal);
    }
    else place_hero(w, w.level.point("spawn"), kPi / 2);
}

// ---------------------------------------------------------------- the City of the Dead
void populate_zone(World& w, const ZoneLayout& z, const ZoneDef& zd, int lvl, const ChartMods* cm) {
    Rng& r = w.rng;
    const size_t first = w.actors.size();
    const float packs = cm ? 1.f + cm->pack_size / 100.f : 1.f, elites = cm ? cm->magic_packs / 100.f : 0.f;
    int total = 0;
    for (auto& e : zd.spawns) if (e.monster) total += e.weight;
    auto pick = [&]() {
        int k = r.irange(0, std::max(1, total) - 1);
        for (auto& e : zd.spawns) {
            if (!e.monster) continue;
            if ((k -= e.weight) < 0) return find_monster(e.monster);
        }
        return find_monster("ghoul");
    };
    const int elite = find_monster(zd.elite);
    for (const ZoneCell& c : z.cells) {
        vec2 ctr = z.center(c);
        auto at = [&](vec2 p) { return w.level.resolve(p, 0.6f); };
        auto jitter = [&](float k) { return vec2{r.range(-k, k), r.range(-k, k)}; };
        if (c.kind == ZoneCell::Entrance) continue;
        if (c.kind == ZoneCell::Arena) {
            if (*zd.boss) {
                Actor& a = w.spawn_monster(find_monster(zd.boss), at(ctr + vec2{0, 1.5f}), Rarity::Unique, lvl + 1);
                a.facing = -kPi / 2;
            } else {   // no boss: a rare and its pack guard the way on
                w.spawn_monster(elite, at(ctr + vec2{0, 1.5f}), Rarity::Rare, lvl + 1);
                for (int i = 0; i < 4; i++) w.spawn_monster(pick(), at(ctr + jitter(3.f)), Rarity::Normal, lvl);
            }
            continue;
        }
        if (c.kind == ZoneCell::Landmark) {
            // the landmark is guarded: a rare and its pack
            w.spawn_monster(elite, at(ctr + jitter(1.5f)), Rarity::Rare, lvl + 1);
            for (int i = 0; i < 5; i++) w.spawn_monster(pick(), at(ctr + jitter(3.f)), Rarity::Normal, lvl);
            continue;
        }
        int n = int(std::round((r.irange(3, 5) + std::min(3, c.depth / 2)) * packs));
        for (int i = 0; i < n; i++)
            w.spawn_monster(pick(), at(ctr + jitter(2.f)), r.chance(elites * 0.12f) ? Rarity::Magic : Rarity::Normal, lvl);
        if (c.kind == ZoneCell::Branch) {
            Rarity rr = r.chance(0.55f) ? Rarity::Rare : Rarity::Magic;
            w.spawn_monster(elite, at(ctr), rr, lvl);
            if (rr == Rarity::Magic) w.spawn_monster(pick(), at(ctr + vec2{1, 1}), Rarity::Magic, lvl);
        }
        if (cm && c.kind == ZoneCell::Normal && r.chance(elites * 0.3f)) w.spawn_monster(elite, at(ctr + jitter(1.f)), Rarity::Rare, lvl);
    }
    if (cm)   // the chart's mods on every monster it brought
        for (size_t i = first; i < w.actors.size(); i++) {
            Actor& m = w.actors[i];
            m.life_max *= 1.f + cm->monster_life / 100.f;
            m.dmg_mult *= 1.f + cm->monster_damage / 100.f;
            m.speed *= 1.f + cm->monster_speed / 100.f;
        }
    for (size_t i = first; i < w.actors.size(); i++) w.actors[i].life = w.actors[i].life_max;
}

static vec2 entrance_dir(const ZoneCell& e) {
    return (e.mask & DIR_N) ? vec2{0, 1} : (e.mask & DIR_E) ? vec2{1, 0} : (e.mask & DIR_W) ? vec2{-1, 0} : vec2{0, -1};
}

// just past the cell's centre, towards its open side: behind the centre stands the cell's block, which would hide
// the hero from the camera
static vec2 entrance_spot(const ZoneLayout& z) {
    const ZoneCell& e = z.cells[size_t(z.entrance)];
    return z.center(e) + entrance_dir(e) * 1.5f;
}

void Areas::enter_zone(World& w, int def, Arrival how) {
    if (def >= 0 && (!zone.valid || zone.def != def)) close_zone(w);   // another zone: a new instance
    current = AreaId::Zone;
    clear_transient(w);
    if (!zone.valid) {
        const ZoneDef& zd = zone_def(def);
        zone = ZoneInstance{};
        zone.def = def;
        zone.seed = w.rng.next();
        zone.level = zd.level;
        zone.layout = generate_zone(zone.seed, zd.w, zd.h, zd.branches);
        build_zone_level(zone.layout, zd.tileset, w.level);
        w.area_level = zone.level;
        w.in_chart = zd.act == 0;
        populate_zone(w, zone.layout, zd, zone.level, w.in_chart ? &w.chart.mods : nullptr);
        zone.revealed.assign(zone.layout.cells.size(), 0);
        // the waypoint at the entrance (a chart's site has none: the table sends you)
        const ZoneCell& e = zone.layout.cells[size_t(zone.layout.entrance)];
        vec2 wp = w.level.resolve(zone.layout.center(e) + vec2{2.2f, 0.5f}, 0.8f);
        if (zd.act > 0) w.interacts.push_back({Interactable::Waypoint, wp, 1.7f, "Waypoint"});
        if (zone.layout.landmark >= 0) {
            const ZoneCell& c = zone.layout.cells[size_t(zone.layout.landmark)];
            vec2 at = zone.layout.center(c);
            int ci = zone.layout.landmark;
            for (auto& p : w.level.points)
                if (p.first == "chest" && zone.layout.cell_index_at(p.second) == ci) at = p.second;
            Interactable ch{Interactable::Chest, at, 1.9f, "Open the cache"};
            ch.facing = angle_of(zone.layout.center(c) - at) - kPi / 2;
            w.interacts.push_back(ch);
            if (std::string(zd.landmark) == "bench")
                for (auto& p : w.level.points)
                    if (p.first == "bench" && zone.layout.cell_index_at(p.second) == ci)
                        w.interacts.push_back({Interactable::Bench, p.second, 1.9f, "The Coppersmith's Bench"});
        }
        if (!*zd.boss) open_exit(w);   // no boss: the way on is open from the start
        zone.valid = true;
        // a trial takes its toll at the gate: one slot is sealed until you leave
        if (zd.trial && zd.toll_slot >= 0 && w.hero.sealed_slot < 0) {
            w.hero.sealed = w.hero.equip[zd.toll_slot];
            w.hero.sealed_slot = int8_t(zd.toll_slot);
            w.hero.equip[zd.toll_slot] = Item{};
            w.recompute_hero();
        }
    } else {
        const ZoneDef& zd = zone_def(zone.def);
        build_zone_level(zone.layout, zd.tileset, w.level);
        w.area_level = zone.level;
        for (auto& m : zone.monsters) {
            w.actors.push_back(m);
            Actor& a = w.actors.back();
            a.model = monster_model(a.def);
            a.anim = Animator{};
            a.anim.bind(a.model.skel, a.model.anims);
            a.anim.play("idle", 0, true);
        }
        w.loot = zone.loot;
        w.interacts = zone.interacts;
        w.in_chart = zd.act == 0;
    }
    if (zone_def(zone.def).act > 0) {
        w.hero.waypoints.add(zone.def);
        w.meet_codex("waypoints");
    }
    if (zone_def(zone.def).trial) w.meet_codex("trial");
    const ZoneCell& e = zone.layout.cells[size_t(zone.layout.entrance)];
    if (how == Arrival::Portal && zone.has_portal) place_hero(w, zone.portal + vec2{-1.2f, -1.0f}, kPi / 2, &zone.portal);
    else place_hero(w, entrance_spot(zone.layout), angle_of(entrance_dir(e)));
}

void Areas::enter_chart(World& w, int site, const Item& chart) {
    const Site& st = sites()[size_t(site)];
    close_zone(w);
    w.chart = ChartRun{};
    w.chart.tier = st.tier;
    w.chart.mods = chart_mods(chart);
    w.chart.astro = w.hero.astro;
    w.chart.max_tier = (w.hero.quests & Q_ACT5) ? kChartTiers : kChartTiersEarly;
    if (w.hero.ending == 2) {   // the door left open (Slice 10): the night's world is harder, and richer
        w.chart.mods.monster_life += 25;
        w.chart.mods.monster_damage += 15;
        w.chart.mods.quantity += 25;
        w.chart.mods.rarity += 25;
    }
    enter_zone(w, find_zone(st.zone), Arrival::Entrance);   // (a fresh instance: it closes the last one first)
    w.chart_site = site;
    // the Haboob, if the chart has one: it rises in the south of the site after a while
    if (w.rng.chance(haboob_chance(w.chart))) arm_haboob(w);
    // a Marid Rift, once Act II is behind you: in one of the site's cells, away from the way in and the master's court
    if ((w.hero.quests & Q_ACT2) && w.rng.chance(0.35f)) {
        std::vector<int> cells;
        for (size_t i = 0; i < zone.layout.cells.size(); i++)
            if (zone.layout.cells[i].kind == ZoneCell::Normal) cells.push_back(int(i));
        if (!cells.empty()) {
            w.rift = Rift{};
            w.rift.armed = true;
            w.rift.pos = zone.layout.center(zone.layout.cells[size_t(cells[size_t(w.rng.irange(0, int(cells.size()) - 1))])]);
        }
    }
    // an Excavation, once Act III is behind you: a stake near the way in, and a buried chamber further on
    if ((w.hero.quests & Q_ACT3) && w.rng.chance(0.35f)) arm_dig(w);
    // a Zar Night, once Act IV is behind you: a drum circle in one of the site's cells
    if ((w.hero.quests & Q_ACT4) && w.rng.chance(0.35f)) arm_zar(w);
    w.meet_codex("charts");
    if (st.tier > kChartTiersEarly) w.meet_codex("reaches");
}

bool Areas::arm_dig(World& w) {
    const ZoneLayout& L = zone.layout;
    const vec2 in = L.center(L.cells[size_t(L.entrance)]);
    std::vector<int> cells;
    for (size_t i = 0; i < L.cells.size(); i++) if (L.cells[i].kind == ZoneCell::Normal) cells.push_back(int(i));
    if (cells.size() < 2) return false;
    // the stake in the ordinary cell nearest the way in; the chamber in the one two or three cells on from it
    std::sort(cells.begin(), cells.end(), [&](int a, int b) { return length(L.center(L.cells[size_t(a)]) - in) < length(L.center(L.cells[size_t(b)]) - in); });
    const vec2 stake = L.center(L.cells[size_t(cells[0])]);
    int far = cells.back();
    for (int c : cells) {
        float d = length(L.center(L.cells[size_t(c)]) - stake);
        if (d > 20.f && d < 40.f) { far = c; break; }
    }
    const vec2 chamber = L.center(L.cells[size_t(far)]);
    std::vector<vec2> path;
    if (!w.level.find_path(stake, chamber, 0.6f, path) || path.empty()) return false;
    path.insert(path.begin(), stake);
    float total = 0;
    for (size_t i = 1; i < path.size(); i++) total += length(path[i] - path[i - 1]);
    if (total < 10.f) return false;
    Dig& d = w.dig;
    d = Dig{};
    d.armed = true;
    d.stake = w.level.resolve(stake + vec2{1.6f, 0.4f}, 0.8f);
    d.chamber = chamber;
    for (int k = 0; k < Dig::kCharges; k++) {   // evenly down the line, the last a few metres short of the chamber
        float want = total * (0.18f + 0.64f * float(k) / float(Dig::kCharges - 1)), run = 0;
        vec2 at = path.back();
        for (size_t i = 1; i < path.size(); i++) {
            float seg = length(path[i] - path[i - 1]);
            if (run + seg >= want) { at = path[i - 1] + (path[i] - path[i - 1]) * ((want - run) / std::max(1e-3f, seg)); break; }
            run += seg;
        }
        d.spots[k] = w.level.resolve(at, 0.5f);
        Interactable ch{Interactable::Charge, d.spots[k], 1.6f, "Set a charge"};
        ch.target = int16_t(k);
        w.interacts.push_back(ch);
    }
    w.interacts.push_back({Interactable::Detonator, d.stake, 1.8f, "The surveyor's stake: set the charges down the line"});
    w.notices.push_back("A surveyor's stake: something is buried here");
    return true;
}

bool Areas::arm_zar(World& w) {
    const ZoneLayout& L = zone.layout;
    std::vector<int> cells;
    for (size_t i = 0; i < L.cells.size(); i++)
        if (L.cells[i].kind == ZoneCell::Normal && (!w.rift.armed || length(L.center(L.cells[i]) - w.rift.pos) > 6.f) &&
            (!w.dig.armed || length(L.center(L.cells[i]) - w.dig.stake) > 6.f))
            cells.push_back(int(i));
    if (cells.empty()) return false;
    Zar& z = w.zar;
    z = Zar{};
    z.armed = true;
    z.zone = int16_t(zone.def);
    z.pos = w.level.resolve(L.center(L.cells[size_t(cells[size_t(w.rng.irange(0, int(cells.size()) - 1))])]), 1.2f);
    w.interacts.push_back({Interactable::Drum, w.level.resolve(z.pos + vec2{0, -1.4f}, 0.5f), 1.8f, "Sit down at the drum: begin the Zar"});
    w.notices.push_back("Somewhere in the site, drummers are waiting");
    return true;
}

void Areas::enter_rift_court(World& w) {
    close_zone(w);
    w.chart = ChartRun{};
    w.chart.tier = kChartTiersEarly;   // the court is at the Fourth Clime's level
    w.chart.astro = w.hero.astro;
    w.chart.max_tier = (w.hero.quests & Q_ACT5) ? kChartTiers : kChartTiersEarly;
    enter_zone(w, find_zone("rift_court"), Arrival::Entrance);
    w.chart_site = -1;
}

void Areas::enter_throne(World& w) {
    close_zone(w);
    w.chart = ChartRun{};
    w.chart.tier = kChartTiers;
    w.chart.max_tier = kChartTiers;
    w.chart.astro = w.hero.astro;
    enter_zone(w, find_zone("king_throne"), Arrival::Entrance);
    w.chart_site = -1;
    w.meet_codex("marid_king");
}

void Areas::arm_haboob(World& w) {
    Haboob& hb = w.haboob;
    hb = Haboob{};
    hb.armed = true;
    float lo_x = 1e9f, hi_x = -1e9f, lo_y = 1e9f, hi_y = -1e9f;
    for (auto& c : zone.layout.cells) {
        vec2 p = zone.layout.center(c);
        lo_x = std::min(lo_x, p.x - 8); hi_x = std::max(hi_x, p.x + 8);
        lo_y = std::min(lo_y, p.y - 8); hi_y = std::max(hi_y, p.y + 8);
    }
    hb.x0 = lo_x; hb.x1 = hi_x; hb.y0 = lo_y; hb.y1 = hi_y;
    hb.depth *= 1.f + astro_value(w.chart.astro, AX_HABOOB_WIDTH) / 100.f;
    hb.front = lo_y;
    hb.delay = w.rng.range(8.f, 20.f);
    // it crosses the site in about two minutes, whatever its size
    hb.speed = std::max(0.5f, (hi_y - lo_y + hb.depth) / 120.f);
}

void Areas::leave_zone(World& w) {
    if (current != AreaId::Zone || !zone.valid) return;
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

void Areas::close_zone(World& w) {
    // the gatekeeper gives the toll back when you leave a trial, finished or not
    Hero& H = w.hero;
    if (H.sealed_slot >= 0) {
        if (H.equip[H.sealed_slot].empty()) H.equip[H.sealed_slot] = H.sealed;
        else if (!H.sealed.empty() && !H.inv.add(H.sealed)) H.equip[H.sealed_slot] = H.sealed;   // never lost
        H.sealed = Item{};
        H.sealed_slot = -1;
        w.recompute_hero();
    }
    zone = ZoneInstance{};
    w.chart_site = -1;
    w.haboob = Haboob{};
    w.rift = Rift{};
    w.dig = Dig{};
    w.zar = Zar{};
}

void Areas::cast_portal(World& w) {
    if (current != AreaId::Zone) return;
    Actor& h = w.actors[0];
    vec2 at = w.level.resolve(h.pos + from_angle(h.facing) * 1.6f, 0.8f);
    w.interacts.erase(std::remove_if(w.interacts.begin(), w.interacts.end(), [](const Interactable& i) { return i.kind == Interactable::Portal; }),
                      w.interacts.end());
    w.interacts.push_back({Interactable::Portal, at, 1.7f, "Portal to the rooftop"});
    zone.has_portal = true;
    zone.portal = at;
    w.emit(Ev::Portal, at);
}

void Areas::open_exit(World& w) {
    const ZoneDef& zd = zone_def(zone.def);
    vec2 c = zone.layout.center(zone.layout.cells[size_t(zone.layout.arena)]);
    auto has = [&](Interactable::Kind k) { for (auto& i : w.interacts) if (i.kind == k) return true; return false; };
    int next = find_zone(zd.next), side = find_zone(zd.side);
    if (next >= 0 && !has(Interactable::Next)) {
        Interactable it{Interactable::Next, w.level.resolve(c + vec2{0, -1.0f}, 0.8f), 1.8f, std::string("On to ") + zone_def(next).name};
        it.target = int16_t(next);
        w.interacts.push_back(it);
    }
    if (side >= 0 && !has(Interactable::Gate)) {
        Interactable it{Interactable::Gate, w.level.resolve(c + vec2{3.4f, 1.0f}, 0.8f), 1.8f, std::string("Enter ") + zone_def(side).name};
        it.target = int16_t(side);
        w.interacts.push_back(it);
    }
    if (next < 0 && !has(Interactable::Exit))
        w.interacts.push_back({Interactable::Exit, w.level.resolve(c + vec2{0, -1.0f}, 0.8f), 1.8f, "Portal home to the rooftop"});
    zone.cleared = true;
    w.emit(Ev::Portal, c);
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
    if (const ZoneDef* zd = def()) {
        w.learn_recipe(recipe_for_zone(zd->id, false));
        if (std::string(zd->landmark) == "poster")   // the cinema's old billboard: scraps of its posters
            for (int k = 0; k < 2; k++)
                if (int u = random_unique(lvl + 2, w.rng); u >= 0) w.drop_special(pos + rotate(vec2{2.2f, 0}, out + (k ? 0.6f : -0.6f)), GroundItem::Scrap, u);
    }
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
    if (current == AreaId::Zone) {
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
                if (const BossDef* bd = boss_def(a.def))
                    for (size_t k = 0; k < bd->moves.size() && k < 8; k++) a.move_cd[k] = bd->moves[k].phase ? 1e9f : 3.f;
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
    if (current != AreaId::Zone || zone.revealed.size() != zone.layout.cells.size()) return;
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
    w.in_chart = false;
    street_static(w);
    w.area_level = 1;
    place_hero(w, {0, -9}, kPi / 2);
    spawn_street_encounter(w);
}

// ---------------------------------------------------------------- save states
void Areas::rebuild(World& w) {
    switch (current) {
        case AreaId::Hub: hub_static(w); break;
        case AreaId::Zone: w.npcs.clear(); build_zone_level(zone.layout, zone_def(zone.def).tileset, w.level); break;
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
    for (auto& i : v) { w.put(i.kind); w.put(i.pos); w.put(i.radius); w.str(i.label); w.put(i.facing); w.put(i.spent); w.put(i.target); }
}

static void read_interacts(ByteReader& r, std::vector<Interactable>& v) {
    uint16_t n = r.get<uint16_t>();
    v.clear();
    for (uint16_t k = 0; k < n && r.ok; k++) {
        Interactable i{};
        r.get(i.kind); r.get(i.pos); r.get(i.radius); i.label = r.str(); r.get(i.facing); r.get(i.spent); r.get(i.target);
        v.push_back(i);
    }
}

void Areas::write(ByteWriter& w) const {
    w.put(current);
    const ZoneInstance& z = zone;
    w.put(z.valid); w.put(z.def); w.put(z.cleared); w.put(z.has_portal); w.put(z.portal); w.put(z.level); w.put(z.seed);
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
    r.get(z.valid); r.get(z.def); r.get(z.cleared); r.get(z.has_portal); r.get(z.portal); r.get(z.level); r.get(z.seed);
    if (z.valid && (z.def < 0 || z.def >= int(zone_defs().size()))) return false;
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
