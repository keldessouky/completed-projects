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
#include "game/sky.hpp"
#include "game/title.hpp"
#include "game/view.hpp"
#include "game/save.hpp"
#include "game/bots.hpp"
#include "game/classes.hpp"
#include "audio/audio.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/stat.h>
#include <string>

namespace q {

namespace {

enum class Travel : uint8_t { None, ZoneEntrance, ZonePortal, HubPortal, HubExit };

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
    float fade_t = 0;             // > 0 fading out towards the travel, < 0 fading back in
    bool boss_music = false;
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
        case AreaId::Necropolis: a.music("mus_saba", 0.5f, 2.f); a.ambience("amb_necro", 0.6f, 2.f); break;
        case AreaId::Street: a.music("mus_hijaz", 0.5f, 2.f); a.ambience("amb_street", 0.5f, 2.f); break;
    }
    S->boss_music = false;
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
        case Travel::ZoneEntrance: A.enter_zone(w, Arrival::Entrance); break;
        case Travel::ZonePortal: A.enter_zone(w, Arrival::Portal); break;
        case Travel::HubPortal:
            A.leave_zone(w);
            A.enter_hub(w, Arrival::Portal);
            S->menu.restock(w);
            save_character();
            break;
        case Travel::HubExit:
            A.close_zone();
            A.enter_hub(w, Arrival::Entrance);
            S->menu.restock(w);
            save_character();
            break;
        default: return;
    }
    arrived();
}

void begin_travel(Travel t) {
    if (S->travel != Travel::None) return;
    S->travel = t;
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
            case Ev::Swing: a.play("swing", 0.45f, 0, pv(e.mag > 1 ? 0.8f : 1.f)); break;
            case Ev::Impact: if (e.mag > 0) a.play("impact", 0.75f, pan, pv(1)); break;
            case Ev::SlamImpact: a.play("slam", 0.9f * std::min(1.f, e.mag) * near, pan, pv(1)); break;
            case Ev::Aftershock: a.play("aftershock", 0.95f, 0, pv(1)); break;
            case Ev::EnemyHit: a.play("hit", 0.35f * near, pan, pv(1)); break;
            case Ev::EnemyDie: a.play("ghoul_die", 0.55f * near, pan, pv(e.mag > 1.2f ? 0.75f : 1.f)); break;
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
            case Ev::StarFall: a.play("star_fall", 0.9f, pan, pv(1)); break;
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

void boss_state(World& w) {
    if (S->areas.current != AreaId::Necropolis) return;
    const Actor* boss = nullptr;
    for (size_t i = 1; i < w.actors.size(); i++)
        if (w.actors[i].rarity == Rarity::Unique && w.actors[i].alive()) boss = &w.actors[i];
    bool fighting = boss && boss->ai_state > 0 && w.actors[0].alive();
    if (fighting != S->boss_music) {
        S->boss_music = fighting;
        audio().music(fighting ? "mus_boss" : "mus_saba", fighting ? 0.6f : 0.5f, fighting ? 0.8f : 3.f);
    }
    if (w.boss_killed && !S->areas.zone.cleared) {
        S->areas.open_exit_portal(w);
        S->view.banner = "Umm al-Ghula is laid to rest";
        S->view.banner_sub = "A portal home opens in her court";
        S->view.banner_t = 4.f;
        save_character();
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
    for (auto& a : S->world.actors) a.model = assets().character(a.def < 0 ? hero_model() : monster_defs()[size_t(a.def)].model);
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
        if (in.hit(BTN_UP) && A.current == AreaId::Necropolis) A.cast_portal(w);
        if (in.hit(BTN_DOWN) && A.current == AreaId::Necropolis) S->view.map_open = !S->view.map_open;
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
            case Interactable::Stair: begin_travel(Travel::ZoneEntrance); break;
            case Interactable::Portal: begin_travel(A.current == AreaId::Hub ? Travel::ZonePortal : Travel::HubPortal); break;
            case Interactable::Exit: begin_travel(Travel::HubExit); break;
            case Interactable::Vendor: M.show(w, true); audio().play("ui_select", 0.4f, 0, 1); break;
            case Interactable::Chest: A.open_chest(w, w.used_interact); break;
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
    r.begin(S->view.cam, S->view.env, S->world.time);
    S->view.render_world(r, S->world);
    r.end(fbo, w, h, false);
    Ui& u = ui();
    u.begin();
    S->view.render_map(S->world, S->areas);
    if (!S->menu.open) S->view.render_hud(S->world, S->last_input, S->areas);
    S->menu.render(S->world);
    S->sky.render(S->world);
    u.end(fbo, w, h);
}

void app_audio(int16_t* stereo, int frames) { audio().mix(stereo, frames); }

// ---- save states
static const uint32_t kStateVersion = 6;  // 5: passives, Hirz, keystone state; 6: Talismans, ailments, glyphs

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
