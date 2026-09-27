// The game shell: owns the World and View, runs the encounter script, and implements app_api.
#include "platform/app_api.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"
#include "core/serial.hpp"
#include "gfx/renderer.hpp"
#include "ui/ui.hpp"
#include "game/assets.hpp"
#include "game/world.hpp"
#include "game/view.hpp"
#include "game/save.hpp"
#include "game/bots.hpp"
#include "audio/audio.hpp"
#include <cstdlib>
#include <cstring>
#include <string>

namespace q {

namespace {

struct State {
    Platform* plat = nullptr;
    bool gpu = false;
    Renderer renderer;
    World world;
    View view;
    Input last_input;
    uint64_t frame = 0;
    int wave = 0;
    float wave_t = 0;
    float rumble_strong = 0, rumble_weak = 0;
    Bot bot;
    Rng sfx_rng{77};
};

State* S = nullptr;

// The Slice 1 encounter: three packs up the street, the last led by a rare Grave Bruiser.
void spawn_encounter(World& w) {
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

void setup_world(World& w) {
    w.level.clear();
    w.level.add_tile("street_a", {0, 0});
    w.level.add_tile("souq_a", {0, 24});
    w.level.add_tile("souq_b", {0, 48});
    w.reset_hero();
    w.actors[0].pos = {0, -9};
    w.actors[0].facing = kPi / 2;
    w.actors[0].model = assets().character("warrior");
    w.actors[0].anim.bind(w.actors[0].model.skel, w.actors[0].model.anims);
    w.actors[0].anim.play("idle", 0);
    spawn_encounter(w);
}

void respawn_hero(World& w) {
    Actor& h = w.actors[0];
    h.act = Act::Idle;
    h.life = h.life_max;
    h.mana = h.mana_max;
    h.pos = {0, -9};
    h.vel = h.knock = {0, 0};
    h.anim.play("idle", 0, true);
    w.hero.flask = w.hero.flask_max;
    S->view.follow(w, 1, true);
}

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
            case Ev::Pickup: a.play("pickup", 0.5f, 0, 1); break;
            case Ev::Drink: a.play("drink", 0.6f, 0, 1); break;
            case Ev::Crit: a.play("crit", 0.35f, pan, pv(1)); break;
            case Ev::Break: a.play("break", 0.7f, pan, pv(1)); break;
            case Ev::LevelUp: a.play("levelup", 0.6f, 0, 1); break;
            case Ev::HeroDie: a.play("slam", 0.8f, 0, 0.6f); break;
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
            default: break;
        }
    }
}

}  // namespace

bool app_init(const char* pack_path, Platform* plat) {
    S = new State();
    S->plat = plat;
    if (!pack().open_file(pack_path)) return false;
    if (!assets().character("warrior").skel) return false;
    setup_world(S->world);
    S->view.follow(S->world, 1, true);
    if (const char* b = getenv("QAHIRA_BOT")) S->bot.start(b);
    audio().init();
    audio().music("mus_hijaz", 0.5f, 3.f);
    audio().ambience("amb_street", 0.5f, 2.f);
    return true;
}

void app_shutdown() {
    if (!S) return;
    if (S->gpu) { S->renderer.shutdown(); assets().clear(); }
    delete S;
    S = nullptr;
}

void app_gpu_init() {
    S->gpu = true;
    S->renderer.init(1920, 1080, 0.75f);
    ui().init();
    for (auto& a : S->world.actors) a.model = assets().character(a.def < 0 ? "warrior" : monster_defs()[size_t(a.def)].model);
    assets().mesh("maul");
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
    S->bot.drive(w, in, S->frame);
    S->last_input = in;
    if (!w.actors[0].alive() && w.actors[0].dead_t > 1.2f && in.hit(BTN_SOUTH)) respawn_hero(w);
    w.step(in, dt);
    presentation_events();
    // keep the ghouls coming once the encounter is cleared
    if (w.enemies_alive() == 0) {
        S->wave_t += dt;
        if (S->wave_t > 5.f) {
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
    }
    S->view.follow(w, dt);
    // rumble decays; the platform gets the current level every frame
    S->rumble_strong = std::max(0.f, S->rumble_strong - dt * 5.f);
    S->rumble_weak = std::max(0.f, S->rumble_weak - dt * 6.f);
    if (S->plat && S->plat->rumble) S->plat->rumble(int(S->rumble_strong * 65535), int(S->rumble_weak * 65535));
}

void app_render(GLuint fbo, int w, int h) {
    Renderer& r = S->renderer;
    r.begin(S->view.cam, S->view.env, S->world.time);
    S->view.render_world(r, S->world);
    r.end(fbo, w, h, false);
    Ui& u = ui();
    u.begin();
    S->view.render_hud(S->world, S->last_input);
    u.end(fbo, w, h);
}

void app_audio(int16_t* stereo, int frames) { audio().mix(stereo, frames); }

// ---- save states
static const uint32_t kStateVersion = 3;

static ByteWriter save_state() {
    ByteWriter w;
    w.put(kStateVersion);
    write_world(w, S->world);
    w.put(S->wave); w.put(S->wave_t); w.put(S->frame);
    w.put(S->view.cam.target); w.put(S->view.cam.eye);
    return w;
}

size_t app_serialize_size() { return save_state().buf.size() + 64 * 1024; }
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
    r.get(S->wave); r.get(S->wave_t); r.get(S->frame);
    r.get(S->view.cam.target); r.get(S->view.cam.eye);
    return r.ok;
}

void app_set_option(const char*, const char*) {}
int app_test_status() { return S ? S->bot.status : 0; }
const char* app_test_message() { return S ? S->bot.message.c_str() : ""; }

}  // namespace q
