// The game shell: owns the World, the Areas, the Menu and the View; routes input, travels between areas
// behind a fade, keeps the character file, and implements app_api.
#include "platform/app_api.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"
#include "core/serial.hpp"
#include "gfx/renderer.hpp"
#include "ui/ui.hpp"
#include "game/areas.hpp"
#include "game/assets.hpp"
#include "game/world.hpp"
#include "game/menu.hpp"
#include "game/atlas_ui.hpp"
#include "game/sky.hpp"
#include "game/title.hpp"
#include "game/view.hpp"
#include "game/save.hpp"
#include "game/bots.hpp"
#include "game/classes.hpp"
#include "audio/audio.hpp"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/stat.h>
#include <string>

namespace q {

namespace {

enum class Travel : uint8_t { None, ZoneEntrance, ZonePortal, HubPortal, HubExit, Chart, Rift, Throne };

// the waypoint list: the hub and every zone whose waypoint you have touched
using Waypoints = WaypointList;

struct State {
    Platform* plat = nullptr;
    bool gpu = false;
    Renderer renderer;
    World world;
    Areas areas;
    Menu menu;
    Sky sky;
    Title title;
    int slot = 0;                 // which character file is being played
    View view;
    float select_t = -1;          // how long Select has been held in the field (-1: not held)
    Input last_input;
    uint64_t frame = 0;
    int wave = 0;
    float wave_t = 0;
    float rumble_strong = 0, rumble_weak = 0;
    Bot bot;
    Rng sfx_rng{77};
    Travel travel = Travel::None;
    int travel_zone = -1;         // where a ZoneEntrance goes
    Waypoints wp;
    MapScreen map;                // the Map of al-Idrisi, at the chart table
    int pinnacle = 0;             // where a Throne travel goes (Pinnacle)
    int chart_site = -1;          // where a Chart travel goes, and the chart it spends
    Item chart_item;
    float storm_k = 0;            // how deep in the Haboob the camera's fog is
    float fade_t = 0;             // > 0 fading out towards the travel, < 0 fading back in
    bool boss_music = false;
    bool zar_music = false;
    bool persist = true;          // write the character file (off for bots)
};

State* S = nullptr;
constexpr float kFade = 0.35f;

// the hero wears its class's model and name
void bind_hero_model(World& w) {
    Actor& h = w.actors[0];
    h.model = assets().character(hero_model());
    h.anim = Animator{};
    h.anim.bind(h.model.skel, h.model.anims);
    h.anim.play("idle", 0);
    h.name = class_def(w.hero.passives.cls).name;
}

// ---------------------------------------------------------------- the character file
std::string save_dir() { return S->plat ? S->plat->save_dir : std::string("."); }
std::string character_path() { return slot_path(save_dir(), S->slot); }

void save_character() {
    if (!S->persist || S->title.open) return;
    ByteWriter w;
    write_character(w, S->world.hero);
    std::string path = character_path(), tmp = path + ".tmp";
    FILE* f = fopen(tmp.c_str(), "wb");
    if (!f) { QWARN("cannot write %s", tmp.c_str()); return; }
    bool ok = fwrite(w.buf.data(), 1, w.buf.size(), f) == w.buf.size();
    ok = fclose(f) == 0 && ok;
    if (ok) rename(tmp.c_str(), path.c_str());
}

bool load_character(World& w) {
    FILE* f = fopen(character_path().c_str(), "rb");
    if (!f) return false;
    std::vector<uint8_t> buf;
    uint8_t chunk[4096];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, f)) > 0) buf.insert(buf.end(), chunk, chunk + n);
    fclose(f);
    ByteReader r(buf.data(), buf.size());
    Hero loaded = w.hero;  // keeps the class base stats
    if (!read_character(r, loaded)) {
        QWARN("character file unreadable; keeping it as .bad and starting fresh");
        rename(character_path().c_str(), (character_path() + ".bad").c_str());
        return false;
    }
    w.hero = loaded;
    w.recompute_hero();
    w.actors[0].life = w.actors[0].life_max;
    w.actors[0].mana = w.actors[0].mana_max;
    QLOG("character loaded: level %d, %d dinars", w.hero.level, w.hero.gold);
    return true;
}

// ---------------------------------------------------------------- music and areas
void area_audio() {
    Audio& a = audio();
    switch (S->areas.current) {
        case AreaId::Hub: a.music("mus_hijaz", 0.45f, 2.f); a.ambience("amb_street", 0.5f, 2.f); break;
        case AreaId::Zone: {
            const ZoneDef* zd = S->areas.def();
            a.music(zd ? zd->music : "mus_saba", 0.5f, 2.f);
            a.ambience(zd ? zd->ambience : "amb_necro", 0.6f, 2.f);
            break;
        }
        case AreaId::Street: a.music("mus_hijaz", 0.5f, 2.f); a.ambience("amb_street", 0.5f, 2.f); break;
    }
    S->boss_music = false;
    S->zar_music = false;
}

void arrived() {
    World& w = S->world;
    if (S->gpu) w.level.bind_gpu();
    S->view.follow(w, 1, true);
    S->view.banner = S->areas.name();
    S->view.banner_sub = S->areas.subtitle();
    S->view.banner_t = 3.f;
    S->view.map_open = false;
    area_audio();
}

void do_travel(Travel t) {
    World& w = S->world;
    Areas& A = S->areas;
    switch (t) {
        case Travel::ZoneEntrance:
            if (A.current == AreaId::Zone && A.zone.valid && A.zone.def != S->travel_zone) A.close_zone(w);
            A.enter_zone(w, S->travel_zone, Arrival::Entrance);
            save_character();
            break;
        case Travel::ZonePortal: A.enter_zone(w, -1, Arrival::Portal); break;
        case Travel::HubPortal:
            A.leave_zone(w);
            A.enter_hub(w, Arrival::Portal);
            S->menu.restock(w);
            save_character();
            break;
        case Travel::HubExit:
            A.close_zone(w);
            A.enter_hub(w, Arrival::Entrance);
            S->menu.restock(w);
            save_character();
            break;
        case Travel::Chart:
            A.enter_chart(w, S->chart_site, S->chart_item);
            S->chart_item = Item{};
            save_character();
            break;
        case Travel::Rift:
            A.enter_rift_court(w);
            save_character();
            break;
        case Travel::Throne:
            A.enter_pinnacle(w, S->pinnacle);
            save_character();
            break;
        default: return;
    }
    arrived();
}

void begin_travel(Travel t, int zone = -1) {
    if (S->travel != Travel::None) return;
    S->travel = t;
    if (zone >= 0) S->travel_zone = zone;
    S->fade_t = kFade;
    S->world.emit(Ev::Portal, S->world.actors[0].pos, 0.5f);
}

// ---------------------------------------------------------------- presentation
void play_event_sounds(const World& w) {
    Audio& a = audio();
    Rng& r = S->sfx_rng;
    vec2 hp = w.actors[0].pos;
    for (const Event& e : w.events) {
        float pan = clampf((e.pos.x - hp.x) / 9.f, -1, 1) * 0.7f;
        float near = 1.f / (1.f + length(e.pos - hp) * 0.06f);
        auto pv = [&](float c) { return c * r.range(0.93f, 1.07f); };
        switch (e.type) {
            case Ev::Swing: e.mag > 2.5f ? a.play("crossbow", 0.55f, 0, pv(1)) : a.play("swing", 0.45f, 0, pv(e.mag > 1 ? 0.8f : 1.f)); break;
            case Ev::Impact: if (e.mag > 0) a.play("impact", 0.75f, pan, pv(1)); break;
            case Ev::SlamImpact: a.play("slam", 0.9f * std::min(1.f, e.mag) * near, pan, pv(1)); break;
            case Ev::Aftershock: a.play("aftershock", 0.95f, 0, pv(1)); break;
            case Ev::EnemyHit: a.play("hit", 0.35f * near, pan, pv(1)); break;
            case Ev::EnemyDie: {
                std::string v = std::string(e.def >= 0 ? monster_defs()[size_t(e.def)].voice : "ghoul") + "_die";
                if (a.play(v.c_str(), 0.55f * near, pan, pv(e.mag > 1.2f ? 0.75f : 1.f)) < 0) a.play("ghoul_die", 0.55f * near, pan, pv(1));
                break;
            }
            case Ev::HeroHit: a.play("hero_hit", 0.7f, 0, pv(1)); break;
            case Ev::Warcry: a.play("warcry", 0.85f, 0, 1); break;
            case Ev::Dodge: a.play("dodge", 0.5f, 0, pv(1)); break;
            case Ev::Spit: a.play("spit", 0.45f * near, pan, pv(1)); break;
            case Ev::Splash: a.play("splash", 0.35f * near, pan, pv(1)); break;
            case Ev::Pickup: a.play(e.mag > 1.5f ? "chest" : "pickup", 0.5f, 0, 1); break;
            case Ev::Drink: a.play("drink", 0.6f, 0, 1); break;
            case Ev::Crit: a.play("crit", 0.35f, pan, pv(1)); break;
            case Ev::Break: a.play("break", 0.7f, pan, pv(1)); break;
            case Ev::LevelUp: a.play("levelup", 0.6f, 0, 1); break;
            case Ev::HeroDie: a.play("slam", 0.8f, 0, 0.6f); break;
            case Ev::Portal: a.play("portal", e.mag < 1 ? 0.35f : 0.6f, pan, 1); break;
            case Ev::Gold: a.play("gold", 0.45f, pan, pv(1)); break;
            case Ev::Currency: a.play("currency", 0.5f, pan, 1); break;
            case Ev::BossDie: a.play("boss_wail", 0.8f, pan, 0.7f); break;
            case Ev::BossWail: a.play("boss_wail", 0.9f, pan, 1); break;
            case Ev::BossLeap: a.play("boss_leap", 0.7f, pan, 1); break;
            case Ev::Summon: a.play("summon", 0.85f, pan, 1); break;
            case Ev::Craft: e.mag > 0 ? a.play("craft", 0.5f, 0, 1) : a.play("ui_move", 0.35f, 0, 1); break;
            case Ev::Sell: a.play("sell", 0.5f, 0, 1); break;
            case Ev::InvFull: a.play("inv_full", 0.6f, 0, 1); break;
            case Ev::Cast: a.play(int(e.mag) == DT_COLD ? "cast_cold" : int(e.mag) == DT_LIGHTNING ? "cast_lightning" : "cast_fire", 0.5f, 0, pv(1)); break;
            case Ev::FireHit: a.play("fire_hit", 0.5f * near, pan, pv(1)); break;
            case Ev::ColdHit: a.play("frozen", 0.4f * near, pan, pv(1.2f)); break;
            case Ev::LightningHit: a.play("lightning_hit", 0.45f * near, pan, pv(1)); break;
            case Ev::StarFall: e.mag < 1 ? a.play("naffata", 0.8f, pan, pv(1)) : a.play("star_fall", 0.9f, pan, pv(1)); break;
            case Ev::WeaponSwap: a.play("weapon_swap", 0.5f, 0, pv(1)); break;
            case Ev::TrapSet: a.play("trap_set", 0.45f * near, pan, pv(1)); break;
            case Ev::TrapSnap: a.play("trap_snap", 0.7f * near, pan, pv(1)); break;
            case Ev::Power: a.play("power_charge", 0.4f, 0, pv(1)); break;
            case Ev::ZarStart: a.play("zar_start", 0.8f, pan, 1); break;
            case Ev::Trance: a.play("zar_trance", 0.85f, pan, 1); break;
            case Ev::Block: a.play("block", 0.6f, 0, pv(1)); break;
            case Ev::AuraOn: a.play(e.mag > 0.5f ? "aura_on" : "ui_move", 0.6f, 0, 1); break;
            case Ev::TotemSet: a.play("totem_plant", 0.7f, pan, pv(1)); break;
            case Ev::Bleed: a.play("bleed", e.mag > 1.5f ? 0.7f : 0.35f * near, pan, pv(e.mag > 1.5f ? 0.8f : 1.f)); break;
            case Ev::Frozen: a.play("frozen", 0.6f * near, pan, pv(1)); break;
            case Ev::Glyph: a.play("glyph", e.mag > 1.5f ? 0.8f : e.mag > 0.8f ? 0.55f : 0.25f, pan, e.mag > 1.5f ? 0.8f : pv(1)); break;
        }
    }
}

void presentation_events() {
    World& w = S->world;
    S->view.on_events(w);
    play_event_sounds(w);
    for (const Event& e : w.events) {
        switch (e.type) {
            case Ev::SlamImpact: S->rumble_strong = std::max(S->rumble_strong, 0.7f * e.mag); break;
            case Ev::Aftershock: S->rumble_strong = std::max(S->rumble_strong, 0.9f); break;
            case Ev::Impact: if (e.mag > 0) S->rumble_weak = std::max(S->rumble_weak, 0.5f); break;
            case Ev::HeroHit: S->rumble_strong = std::max(S->rumble_strong, 0.4f + e.mag); break;
            case Ev::Break: S->rumble_weak = std::max(S->rumble_weak, 0.8f); break;
            case Ev::BossWail: S->rumble_strong = std::max(S->rumble_strong, 0.6f); break;
            case Ev::Summon: S->rumble_strong = std::max(S->rumble_strong, 0.8f); break;
            case Ev::Trance: S->rumble_strong = std::max(S->rumble_strong, 0.6f); break;
            case Ev::StarFall: S->rumble_strong = std::max(S->rumble_strong, 0.8f); break;
            case Ev::Frozen: S->rumble_weak = std::max(S->rumble_weak, 0.6f); break;
            case Ev::LevelUp: save_character(); break;
            default: break;
        }
    }
}

// the Slice 1 street keeps its waves: a combat range for testing
void street_waves(World& w, float dt) {
    if (w.enemies_alive() > 0) return;
    S->wave_t += dt;
    if (S->wave_t <= 5.f) return;
    S->wave_t = 0;
    S->wave++;
    w.area_level = 1 + S->wave;
    int g = find_monster("ghoul"), sp = find_monster("ghoul_spitter"), b = find_monster("ghoul_bruiser");
    vec2 c = w.actors[0].pos + vec2{0, 12};
    c.y = std::min(c.y, w.level.hi.y - 4);
    for (int i = 0; i < 6 + S->wave; i++) w.spawn_monster(g, w.level.resolve(c + vec2{w.rng.range(-3, 3), w.rng.range(-2, 2)}, 0.5f), Rarity::Normal, w.area_level);
    w.spawn_monster(sp, w.level.resolve(c + vec2{3, 3}, 0.5f), Rarity::Normal, w.area_level);
    w.spawn_monster(b, w.level.resolve(c + vec2{0, 3}, 0.5f), S->wave % 2 ? Rarity::Rare : Rarity::Magic, w.area_level);
    S->view.banner = "The ghouls keep coming";
    S->view.banner_sub = "Wave " + std::to_string(S->wave + 1);
    S->view.banner_t = 2.5f;
}

// the quest a zone's boss completes
uint32_t boss_quest(const ZoneDef& zd) {
    std::string id = zd.id;
    if (id == "downtown") return Q_MICROBUS;
    if (id == "metro") return Q_SILAH;
    if (id == "muizz") return Q_NASNAS;
    if (id == "bab_zuweila") return Q_TRIAL1;
    if (id == "necropolis") return Q_GHULA;
    if (id == "mokattam") return Q_QUTRUB | Q_ACT1;
    if (id == "canal") return Q_NADDAHA;
    if (id == "karnak") return Q_RAM;
    if (id == "tomb") return Q_MARID | Q_ACT2;
    if (id == "sand_sea") return Q_DABA;
    if (id == "bab_futuh") return Q_TRIAL2;
    if (id == "oracle") return Q_WRAITH | Q_ACT3;
    if (id == "chott") return Q_SARAB;
    if (id == "medina") return Q_DOOR;
    if (id == "sebkha") return Q_SALT | Q_ACT4;
    if (id == "chaouen") return Q_PRESSER;
    if (id == "bab_nasr") return Q_TRIAL3;
    if (id == "jemaa") return Q_SMOKE;
    if (id == "strait") return Q_QANDISHA | Q_ACT5;
    if (id == "harbour") return Q_DUWAIS;
    if (id == "shibam") return Q_SHIQQ;
    if (id == "wabar") return Q_HATIF;
    if (id == "iram") return Q_HORSEMAN;
    if (id == "totality") return Q_ACT6;
    if (id == "gate_iram") return Q_TRIAL4;
    return 0;
}

void boss_state(World& w) {
    const ZoneDef* zd = S->areas.def();
    if (!zd) return;
    const Actor* boss = nullptr;
    for (size_t i = 1; i < w.actors.size(); i++)
        if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
    bool fighting = boss && boss->ai_state > 0 && w.actors[0].alive();
    const bool zar = w.zar.started && !w.zar.over;   // the Zar's drums take over the music while the night plays
    if (fighting != S->boss_music || zar != S->zar_music) {
        S->boss_music = fighting;
        S->zar_music = zar;
        audio().music(fighting ? (zd->trial ? "mus_trial" : "mus_boss") : zar ? "mus_zar" : zd->music, fighting || zar ? 0.6f : 0.5f,
                      fighting ? 0.8f : zar ? 1.2f : 3.f);
    }
    if (w.boss_killed && !S->areas.zone.cleared && zd->act == 0) {   // a chart's site is finished
        S->areas.open_exit(w);
        Hero& H = w.hero;
        int site = w.chart_site;
        bool fresh = site >= 0 && !(H.sites_done >> site & 1);
        if (site >= 0) {
            H.sites_done |= 1u << site;
            uint32_t before = H.sites_revealed;
            H.sites_revealed |= reveal_after(site);
            int shown = __builtin_popcount(H.sites_revealed & ~before);
            if (shown) w.notices.push_back("The map grows: " + std::to_string(shown) + (shown == 1 ? " new site" : " new sites"));
        }
        S->view.banner = site >= 0 ? std::string(sites()[size_t(site)].name) + " is charted" : std::string(zd->boss_line);
        S->view.banner_sub = fresh ? "An Astrolabe point, and the road on is drawn" : "A portal home opens";
        S->view.banner_t = 5.f;
        if (fresh) w.meet_codex("astrolabe");
        save_character();
        return;
    }
    if (w.boss_killed && !S->areas.zone.cleared) {
        S->areas.open_exit(w);
        uint32_t q = boss_quest(*zd);
        if ((q & Q_TRIAL4) && w.hero.sealed_slot < 0) q &= ~Q_TRIAL4;   // the gate asks a toll: no toll, no trial
        const uint32_t fresh = q & ~w.hero.quests;
        w.hero.quests |= q;
        w.learn_recipe(recipe_for_zone(zd->id, true));
        for (const char* z : {zd->next, zd->side})   // the way on stays open: its waypoint is yours
            if (int n = find_zone(z); n >= 0 && !(zone_def(n).toll_slot == kTollChosen && !(w.hero.quests & Q_ACT6))) w.hero.waypoints.add(n);
        if (fresh & Q_TRIAL1) w.meet_codex("ascendancy");
        S->view.banner = zd->boss_line;
        int next = find_zone(zd->next);
        S->view.banner_sub = next >= 0 ? std::string("The way on to ") + zone_def(next).name + " is open" : "A portal home opens";
        if (fresh & Q_TRIAL1) S->view.banner_sub = "The trial is passed: two ascendancy points. Your amulet is returned when you leave";
        if (fresh & Q_TRIAL2) S->view.banner_sub = "The Second Trial is passed: two more ascendancy points. Your body armour is returned when you leave";
        if (fresh & Q_TRIAL4) S->view.banner_sub = "The Fourth Trial is passed: two more ascendancy points. The toll is returned when you leave";
        if ((q & Q_TRIAL4) == 0 && std::string(zd->id) == "gate_iram")
            S->view.banner_sub = "The Keeper falls, but the gate asked a toll and was paid nothing. Come back, and choose one";
        for (auto& qd : quest_defs())
            if ((fresh & qd.bit) && qd.passive_points) S->view.banner_sub += "  \xC2\xB7  +1 passive star";
        if (fresh & Q_ACT1) {
            S->view.banner = "Act I is over";
            S->view.banner_sub = "Cairo holds, for now. The eclipse does not end. On the rooftop, al-Idrisi's map is waiting.";
            // the endgame opens: the First Clime's sites, and four charts to start with
            w.hero.sites_revealed |= starting_sites();
            vec2 at = w.actors[0].pos;
            for (int k = 0; k < 4; k++) {
                GroundItem g;
                g.item = make_chart(1, w.rng, 0.25f, 0.f);
                g.pos = w.level.resolve(at + rotate(vec2{2.f, 0}, 0.5f + k * 1.5f), 0.3f);
                g.id = w.next_id++;
                w.loot.push_back(g);
            }
            w.notices.push_back("Four charts of the First Clime: run them at the table on the roof");
        }
        if (fresh & Q_ACT2) {
            S->view.banner = "Act II is over";
            S->view.banner_sub = "Under the kings, something vast turns in its sleep. The river's jinn were running from it.";
            // the glimpse: one coil of it slides through the pit beyond the burial hall
            const ZoneLayout& L = S->areas.zone.layout;
            const ZoneCell& c = L.cells[size_t(L.arena)];
            vec2 open = (c.mask & DIR_N) ? vec2{0, 1} : (c.mask & DIR_E) ? vec2{1, 0} : (c.mask & DIR_W) ? vec2{-1, 0} : vec2{0, -1};
            w.coil_at = L.center(c) - open * 6.3f;
            w.coil_dir = vec2{-open.y, open.x};
            w.coil_t = 0;
            w.shake = std::max(w.shake, 0.8f);
            w.emit(Ev::BossWail, w.coil_at, 3.f);
        }
        if (fresh & Q_ACT3) {
            S->view.banner = "Act III is over";
            S->view.banner_sub = "The desert's jinn were fleeing west, to the sea. All your resistances are 30% lower from here on.";
            w.meet_codex("res_penalty");
        }
        if (fresh & Q_ACT4) {
            S->view.banner = "Act IV is over";
            S->view.banner_sub = "In the medina the drums have started. The Zar Nights come to the charts: keep the circle playing.";
            w.meet_codex("zar");
        }
        if (fresh & Q_ACT5) {
            S->view.banner = "Act V is over";
            S->view.banner_sub = "The Strait is quiet. On the Map of al-Idrisi the far Climes open: charts to the Sixteenth tier.";
        }
        if (fresh & Q_ACT6) {   // the campaign's end: the sun let go, and the choice (GDD §9.3)
            S->view.banner = "Act VI is over";
            S->view.banner_sub = "Apep lets go of the sun. Seal the Veil, or leave the door open. All your resistances are 60% lower now.";
            w.meet_codex("veil");
            if (int g = find_zone("gate_iram"); g >= 0) w.hero.waypoints.add(g);   // the Fourth Trial opens, in Iram
            w.notices.push_back("The Gate of Iram opens: the Fourth Trial, by the waypoints");
            if (w.hero.ending == 0) {
                const ZoneLayout& L = S->areas.zone.layout;
                const vec2 c = L.center(L.cells[size_t(L.arena)]);
                w.interacts.push_back({Interactable::Veil, w.level.resolve(c + vec2{-3.f, -1.f}, 0.6f), 2.0f,
                                       "Seal the Veil: the sun comes back, the jinn go unseen (two more passive stars)"});
                w.interacts.push_back({Interactable::Door, w.level.resolve(c + vec2{3.f, -1.f}, 0.6f), 2.0f,
                                       "Leave the door open: the night stays, and the charts are harder and richer"});
            }
        }
        S->view.banner_t = fresh & (Q_ACT2 | Q_ACT3 | Q_ACT4 | Q_ACT5 | Q_ACT6) ? 9.f : 5.f;
        save_character();
    }
}

// ---------------------------------------------------------------- the waypoint list
void open_waypoints(World& w) {
    Waypoints& W = S->wp;
    W.items.clear();
    if (S->areas.current != AreaId::Hub) W.items.push_back(-1);
    for (size_t i = 0; i < zone_defs().size(); i++)
        if (w.hero.waypoints.has(int(i)) || (i == size_t(find_zone("downtown"))))
            W.items.push_back(int(i));   // a trial is listed once its gate has opened
    // the act's order, not the table's
    std::sort(W.items.begin(), W.items.end(), [](int a, int b) { return (a < 0 ? -1 : zone_def(a).level) < (b < 0 ? -1 : zone_def(b).level); });
    W.cursor = 0;
    for (size_t i = 0; i < W.items.size(); i++) if (W.items[i] >= 0 && S->areas.zone.valid && W.items[i] == S->areas.zone.def) W.cursor = int(i);
    W.open = true;
    audio().play("portal", 0.4f, 0, 1.2f);
}

bool waypoints_update(World& w, const Input& in) {
    Waypoints& W = S->wp;
    if (!W.open) return false;
    int n = int(W.items.size());
    if (in.hit(BTN_UP) || (in.lstick.y > 0.7f && S->frame % 8 == 0)) W.cursor = (W.cursor + n - 1) % n;
    if (in.hit(BTN_DOWN) || (in.lstick.y < -0.7f && S->frame % 8 == 0)) W.cursor = (W.cursor + 1) % n;
    if (in.hit(BTN_EAST)) W.open = false;
    if (in.hit(BTN_SOUTH) && n > 0) {
        int z = W.items[size_t(W.cursor)];
        W.open = false;
        if (z < 0) begin_travel(Travel::HubExit);
        else begin_travel(Travel::ZoneEntrance, z);
    }
    (void)w;
    return true;
}

void waypoints_render() {
    const Waypoints& W = S->wp;
    if (!W.open) return;
    Ui& u = ui();
    // at most twelve rows at a time: the window scrolls with the cursor
    const int n = int(W.items.size()), rows = std::min(n, 12);
    const int first = std::clamp(W.cursor - rows / 2, 0, std::max(0, n - rows));
    float bw = 760, bh = 150 + rows * 64.f, x = 960 - bw / 2, y = 540 - bh / 2;
    u.rect(0, 0, 1920, 1080, pal::night.alpha(0.5f));
    u.frame(x, y, bw, bh, pal::panel.alpha(0.97f), pal::turquoise, 16, 2);
    u.text(960, y + 22, "Waypoints", 40, pal::turquoise, Align::Center, 1.2f, true);
    if (first > 0) u.text(960, y + 70, "\xE2\x96\xB2", 20, pal::dim, Align::Center);
    if (first + rows < n) u.text(960, y + bh - 34, "\xE2\x96\xBC", 20, pal::dim, Align::Center);
    for (size_t i = size_t(first); i < size_t(first + rows); i++) {
        float yy = y + 96 + (i - size_t(first)) * 64;
        bool cur = int(i) == W.cursor;
        if (cur) u.frame(x + 30, yy - 6, bw - 60, 56, pal::dusk, pal::amber, 10, 2);
        int z = W.items[i];
        u.text(x + 60, yy + 4, z < 0 ? "The Rooftop Ahwa" : zone_def(z).name, 30, cur ? pal::amber : pal::bone, Align::Left, cur ? 0.8f : 0.3f);
        if (z >= 0) {
            char b[48];
            snprintf(b, sizeof b, "Act %d  \xC2\xB7  level %d", zone_def(z).act, zone_def(z).level);
            u.text(x + bw - 60, yy + 8, b, 22, pal::dim, Align::Right);
        }
    }
}

}  // namespace

// ---------------------------------------------------------------- app_api
bool app_init(const char* pack_path, Platform* plat) {
    S = new State();
    S->plat = plat;
    if (!pack().open_file(pack_path)) return false;
    if (!assets().character("warrior").skel) return false;
    World& w = S->world;
    if (const char* b = getenv("QAHIRA_BOT")) S->bot.start(b);
    S->bot.sky_ui = &S->sky;
    S->bot.wp_ui = &S->wp;
    S->bot.map_ui = &S->map;
    S->bot.title_ui = &S->title;
    S->persist = S->bot.scenario.empty() || S->bot.uses_title();
    if (S->bot.uses_title() && S->plat) {   // the title bot keeps its characters apart from yours
        S->plat->save_dir += "/bot_title";
        mkdir(S->plat->save_dir.c_str(), 0755);
        remove(slot_path(S->plat->save_dir, 0).c_str());
    }
    S->bot.save_dir = save_dir();
    // QAHIRA_CLASS picks a fresh character's class (the bots use it; players choose on the title screen)
    const char* cls = getenv("QAHIRA_CLASS");
    w.reset_hero(cls && *cls ? cls : S->bot.default_class());
    S->bot.prepare(w);   // a bot that starts further on sets its character up before the rooftop is built
    bind_hero_model(w);
    if (S->persist) {   // players begin at the title screen and choose a character
        S->title.scan(save_dir());
        S->title.open = true;
    }
    if (S->bot.scenario == "fight") S->areas.enter_street(w);
    else S->areas.enter_hub(w, Arrival::Entrance);
    S->menu.restock(w);
    audio().init();
    arrived();
    return true;
}

void app_shutdown() {
    if (!S) return;
    save_character();
    if (S->gpu) { S->renderer.shutdown(); assets().clear(); }
    delete S;
    S = nullptr;
}

void app_gpu_init() {
    S->gpu = true;
    S->renderer.init(1920, 1080, 0.75f);
    ui().init();
    for (auto& a : S->world.actors) a.model = a.def < 0 ? assets().character(hero_model()) : monster_model(a.def);
    assets().mesh("maul");
    assets().mesh("staff");
    S->world.level.bind_gpu();
}

void app_gpu_lost() {
    S->gpu = false;
    assets().gpu_lost();
}

void app_update(const Input& in_raw, float dt) {
    Input in = in_raw;
    S->frame++;
    World& w = S->world;
    Areas& A = S->areas;
    Menu& M = S->menu;
    S->bot.drive(w, M, A, in, S->frame);
    S->last_input = in;
    S->storm_k = damp(S->storm_k, w.haboob.inside(w.actors[0].pos) ? 1.f : 0.f, 2.5f, dt);
    if (S->title.open) {
        Title& T = S->title;
        switch (T.update(in, dt)) {
            case Title::Action::Play:
                S->slot = T.cursor;
                w.reset_hero(T.slots[T.cursor].cls);
                load_character(w);
                break;
            case Title::Action::New:
                S->slot = T.cursor;
                w.reset_hero(T.new_class());
                break;
            case Title::Action::Delete:
                remove(slot_path(save_dir(), T.cursor).c_str());
                T.scan(save_dir());
                audio().play("inv_full", 0.5f, 0, 1);
                return;
            default: return;
        }
        T.open = false;
        bind_hero_model(w);
        A = Areas{};
        A.enter_hub(w, Arrival::Entrance);
        S->menu.restock(w);
        save_character();
        arrived();
        audio().play("portal", 0.6f, 0, 1);
        return;
    }
    // travelling: fade out, move, fade in; the world holds still meanwhile
    if (S->fade_t > 0) {
        S->fade_t -= dt;
        if (S->fade_t <= 0) {
            do_travel(S->travel);
            S->travel = Travel::None;
            S->fade_t = -kFade;
        }
        S->view.fade = 1.f - std::max(0.f, S->fade_t) / kFade;
        return;
    }
    if (S->fade_t < 0) S->fade_t = std::min(0.f, S->fade_t + dt);
    S->view.fade = -S->fade_t / kFade;
    // the Book of Fixed Stars pauses the world too
    if (S->sky.open) {
        w.events.clear();
        S->sky.update(w, in, dt);
        presentation_events();
        if (S->sky.applied) { S->sky.applied = false; save_character(); }
        S->view.follow(w, dt);
        return;
    }
    S->sky.update(w, in, dt);  // its toast fades
    // Select: a tap places the next planned star (when one is waiting), a hold opens the sky
    if (in.held(BTN_SELECT) && !M.open) {
        if (S->select_t < 0) S->select_t = 0;
        S->select_t += dt;
        if (S->select_t >= 0.35f && S->select_t - dt < 0.35f) { S->sky.show(w); audio().play("ui_select", 0.4f, 0, 1); return; }
    } else if (S->select_t >= 0) {
        bool tap = S->select_t < 0.35f;
        S->select_t = -1;
        if (tap && !M.open) {
            int star = (!w.hero.plan.empty() && w.hero.passive_points() > 0) ? place_next_planned(w) : -1;
            if (star >= 0) {
                const Star& st = tree().stars[size_t(star)];
                S->sky.say("Placed " + (st.name.empty() ? std::string(st.text.empty() ? "a star" : st.text[0]) : st.name));
                audio().play("levelup", 0.4f, 0, 1.5f);
                save_character();
            } else {
                S->sky.show(w);
                audio().play("ui_select", 0.4f, 0, 1);
                return;
            }
        }
    }
    // the waypoint list and the Map of al-Idrisi pause the world
    if (waypoints_update(w, in)) { S->view.follow(w, dt); return; }
    if (S->map.open) {
        w.events.clear();
        S->map.update(w, in, dt);
        presentation_events();
        if (S->map.go_site >= 0) {   // a chart chosen: spend it and set out
            Hero& H = w.hero;
            if (S->map.go_chart >= 0 && S->map.go_chart < int(H.inv.items.size())) {
                S->chart_item = H.inv.take(S->map.go_chart);
                S->chart_site = S->map.go_site;
                begin_travel(Travel::Chart);
            }
            S->map.go_site = S->map.go_chart = -1;
        }
        if (S->map.go_rift) { S->map.go_rift = false; begin_travel(Travel::Rift); }
        if (S->map.go_pinnacle >= 0) { S->pinnacle = S->map.go_pinnacle; S->map.go_pinnacle = -1; begin_travel(Travel::Throne); }
        if (!S->map.open) save_character();
        S->view.follow(w, dt);
        return;
    }
    // the menu pauses the world
    if (M.open) {
        w.events.clear();
        bool was_open = M.open;
        M.update(w, in, dt);
        presentation_events();
        if (was_open && !M.open) save_character();
        S->view.follow(w, dt);
        return;
    }
    M.update(w, in, dt);  // toasts fade
    if (!w.notices.empty() && M.toast_t <= 0.2f) {   // recipes, codex entries, posters: one at a time
        M.say(w.notices.front());
        M.toast_t = 3.2f;
        w.notices.erase(w.notices.begin());
    }
    Actor& h = w.actors[0];
    if (in.hit(BTN_START) && h.alive()) {
        M.show(w, false);
        audio().play("ui_select", 0.4f, 0, 1);
        return;
    }
    if (!h.alive() && h.dead_t > 1.2f && in.hit(BTN_SOUTH)) {
        A.respawn(w);
        S->view.follow(w, 1, true);
    }
    // the D-pad: portal, map, loot filter (Left picks up, in the world step)
    if (h.alive()) {
        if (in.hit(BTN_UP) && A.current == AreaId::Zone) A.cast_portal(w);
        if (in.hit(BTN_DOWN) && A.current == AreaId::Zone) S->view.map_open = !S->view.map_open;
        if (in.hit(BTN_RIGHT)) {
            w.hero.filter = uint8_t((w.hero.filter + 1) % FILTER_COUNT);
            M.say(std::string("Loot filter: ") + filter_name(w.hero.filter) + "  \xC2\xB7  " + filter_desc(w.hero.filter));
            audio().play("ui_select", 0.35f, 0, 1);
        }
    }
    w.step(in, dt);
    presentation_events();
    // what South was used on
    if (w.used_interact >= 0 && size_t(w.used_interact) < w.interacts.size()) {
        const Interactable& it = w.interacts[size_t(w.used_interact)];
        switch (it.kind) {
            case Interactable::Stair: case Interactable::Waypoint: open_waypoints(w); break;
            case Interactable::Portal: begin_travel(A.current == AreaId::Hub ? Travel::ZonePortal : Travel::HubPortal); break;
            case Interactable::Exit: begin_travel(Travel::HubExit); break;
            case Interactable::Next: case Interactable::Gate: begin_travel(Travel::ZoneEntrance, it.target); break;
            case Interactable::Bench: w.hero.quests |= Q_BENCH; w.hero.recipes |= kStarterRecipes; w.meet_codex("bench");
                if (const ZoneDef* zd = S->areas.def()) if (int n = find_zone(zd->next); n >= 0) w.hero.waypoints.add(n);
                M.show_bench(w); audio().play("craft", 0.5f, 0, 1); break;
            case Interactable::Vendor: M.show(w, true); audio().play("ui_select", 0.4f, 0, 1); break;
            case Interactable::ChartTable: S->map.show(w); w.meet_codex("charts"); audio().play("portal", 0.4f, 0, 0.8f); break;
            case Interactable::Chest: A.open_chest(w, w.used_interact); break;
            case Interactable::Charge: case Interactable::Detonator: case Interactable::Chamber: w.dig_use(w.used_interact); break;
            case Interactable::Drum: w.zar_use(w.used_interact); break;
            case Interactable::Veil: case Interactable::Door: {   // the choice, once, for this character
                const bool seal = w.interacts[size_t(w.used_interact)].kind == Interactable::Veil;
                w.hero.ending = seal ? 1 : 2;
                w.interacts.erase(std::remove_if(w.interacts.begin(), w.interacts.end(), [](const Interactable& i) {
                                      return i.kind == Interactable::Veil || i.kind == Interactable::Door; }), w.interacts.end());
                S->view.banner = seal ? "The Veil is sealed" : "The door is left open";
                S->view.banner_sub = seal ? "The sun comes back over Cairo, and the jinn go back to being unseen. Two more passive stars."
                                          : "The eclipse stays. The jinn walk openly now, and the charts are harder, and richer.";
                S->view.banner_t = 8.f;
                w.emit(Ev::LevelUp, w.actors[0].pos);
                save_character();
                break;
            }
            case Interactable::Toll: {   // the Gate of Iram: the slot chosen is sealed until you leave, like the other gates'
                Hero& H = w.hero;
                const int slot = w.interacts[size_t(w.used_interact)].target;
                if (H.sealed_slot < 0 && slot >= 0 && slot < EQ_COUNT) {
                    H.sealed = H.equip[slot];
                    H.sealed_slot = int8_t(slot);
                    H.equip[slot] = Item{};
                    w.recompute_hero();
                }
                w.interacts.erase(std::remove_if(w.interacts.begin(), w.interacts.end(), [](const Interactable& i) {
                                      return i.kind == Interactable::Toll; }), w.interacts.end());
                S->view.banner = "The gate takes its toll";
                S->view.banner_sub = slot == EQ_WEAPON ? "Your weapon, the bravest toll. It is returned when you leave"
                                   : slot == EQ_BODY ? "Your body armour. It is returned when you leave"
                                                     : "Your helmet. It is returned when you leave";
                S->view.banner_t = 5.f;
                audio().play("portal", 0.4f, 0, 0.7f);
                break;
            }
            case Interactable::Dealer: M.show_dealer(w); w.meet_codex("excavations"); audio().play("ui_select", 0.4f, 0, 1); break;
        }
    }
    A.reveal(w);
    boss_state(w);
    if (A.current == AreaId::Street) street_waves(w, dt);
    S->view.follow(w, dt);
    // rumble decays; the platform gets the current level every frame
    S->rumble_strong = std::max(0.f, S->rumble_strong - dt * 5.f);
    S->rumble_weak = std::max(0.f, S->rumble_weak - dt * 6.f);
    if (S->plat && S->plat->rumble) S->plat->rumble(int(S->rumble_strong * 65535), int(S->rumble_weak * 65535));
}

void app_render(GLuint fbo, int w, int h) {
    if (S->title.open) {  // the title covers everything: no need to draw the world behind it
        Ui& u = ui();
        u.begin();
        S->title.render();
        u.end(fbo, w, h);
        return;
    }
    Renderer& r = S->renderer;
    // the zone's mood, and the Haboob's sand when you are inside it
    Environment env = S->view.env;
    if (const ZoneDef* zd = S->areas.def()) {
        vec3 t{zd->env_tint[0], zd->env_tint[1], zd->env_tint[2]};
        env.fog = env.fog * t;
        env.sky = env.sky * t;
        env.ground = env.ground * t;
    }
    float k = S->storm_k;
    if (k > 0.01f) {
        env.fog = lerp(env.fog, hex_lin(0x6A5034) * 0.4f, k);
        env.fog_start = lerpf(env.fog_start, 6.f, k);
        env.fog_end = lerpf(env.fog_end, 20.f, k);
        env.fog_max = lerpf(env.fog_max, 0.8f, k);
        env.sky = lerp(env.sky, hex_lin(0xC09060) * 0.9f, k * 0.6f);
        env.sun_color = env.sun_color * (1.f - 0.5f * k);
    }
    r.begin(S->view.cam, env, S->world.time);
    S->view.render_world(r, S->world);
    r.end(fbo, w, h, false);
    Ui& u = ui();
    u.begin();
    S->view.render_map(S->world, S->areas);
    if (!S->menu.open) S->view.render_hud(S->world, S->last_input, S->areas);
    S->menu.render(S->world);
    waypoints_render();
    S->sky.render(S->world);
    S->map.render(S->world);
    u.end(fbo, w, h);
}

void app_audio(int16_t* stereo, int frames) { audio().mix(stereo, frames); }

// ---- save states
static const uint32_t kStateVersion = 16;  // 5: passives, Hirz, keystone state; 6: Talismans, ailments, glyphs; 7: Act I;
                                           // 8: chart runs and the Haboob; 9: poison, marks, Frenzy, arrows;
                                           // 10: bleeding, piercing bolts, grenades, the weapon swap;
                                           // 11: traps, Wither, Power Charges; 12: Zar Nights;
                                           // 13: the Beacon, totems, burning ground; 14: charts to T16 (a chart run's
                                           // highest tier), waypoints for 128 zones; 15: the Veil and the Door;
                                           // 16: a pinnacle's uber flag

static ByteWriter save_state() {
    ByteWriter w;
    w.put(kStateVersion);
    write_world(w, S->world);
    S->areas.write(w);
    w.put(S->wave); w.put(S->wave_t); w.put(S->frame); w.put(S->slot);
    w.put(S->view.cam.target); w.put(S->view.cam.eye); w.put(S->view.map_open);
    return w;
}

size_t app_serialize_size() { return save_state().buf.size() + 256 * 1024; }
bool app_serialize(void* data, size_t size) {
    ByteWriter w = save_state();
    if (w.buf.size() > size) return false;
    memset(data, 0, size);
    memcpy(data, w.buf.data(), w.buf.size());
    return true;
}
bool app_unserialize(const void* data, size_t size) {
    ByteReader r(data, size);
    if (r.get<uint32_t>() != kStateVersion) return false;
    if (!read_world(r, S->world)) return false;
    if (!S->areas.read(r)) return false;
    r.get(S->wave); r.get(S->wave_t); r.get(S->frame); r.get(S->slot);
    S->title.open = false;
    r.get(S->view.cam.target); r.get(S->view.cam.eye); r.get(S->view.map_open);
    S->areas.rebuild(S->world);
    if (S->gpu) S->world.level.bind_gpu();
    S->menu.hide();
    S->sky.hide();
    S->travel = Travel::None;
    S->fade_t = 0;
    S->view.fade = 0;
    area_audio();
    return r.ok;
}

void app_set_option(const char*, const char*) {}
int app_test_status() { return S ? S->bot.status : 0; }
const char* app_test_message() { return S ? S->bot.message.c_str() : ""; }

}  // namespace q
