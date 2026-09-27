// Slice 0 app: the Warrior on a street at dusk, driven by the RetroPad.
#include "platform/app_api.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"
#include "gfx/renderer.hpp"
#include "ui/ui.hpp"
#include "game/assets.hpp"
#include "game/animator.hpp"
#include <cstdlib>
#include <cstring>
#include <string>

namespace q {

namespace {

struct Player {
    vec2 pos{0, 0};
    vec2 vel{0, 0};
    float facing = kPi / 2;  // world angle, +Y is north (away from camera)
    Animator anim;
    float action_t = 0;
};

struct State {
    Platform* plat = nullptr;
    bool gpu = false;
    Renderer renderer;
    Environment env;
    Camera cam;
    CharacterModel warrior;
    GpuMesh* maul = nullptr;
    GpuMesh ground;
    Player player;
    Pose pose;
    std::vector<Xform> scratch;
    double time = 0;
    uint64_t frame = 0;
    // bot
    std::string bot;
    int test_status = 0;
    std::string test_msg;
    vec2 start_pos;
    // perf
    float fps_smooth = 60;
};

State* S = nullptr;

void build_ground() {
    MeshBuilder mb;
    mb.set_mat(0.85f);
    Rng rng(7);
    const float tile = 0.5f;
    for (int y = -60; y < 60; y++)
        for (int x = -40; x < 40; x++) {
            float shade = rng.range(0.82f, 1.05f);
            vec3 base = hex_rgb(0x5A4F48) * shade;
            if (rng.chance(0.08f)) base = hex_rgb(0x433A35);
            mb.set_color(base, 1.f);
            float g = 0.012f;
            vec3 a{x * tile + g, y * tile + g, 0}, b{(x + 1) * tile - g, y * tile + g, 0};
            vec3 c{(x + 1) * tile - g, (y + 1) * tile - g, 0}, d{x * tile + g, (y + 1) * tile - g, 0};
            mb.quad(a, b, c, d);
        }
    mb.set_color(hex_rgb(0x1E1A18), 0.6f);
    mb.quad({-20, -30, -0.01f}, {20, -30, -0.01f}, {20, 30, -0.01f}, {-20, 30, -0.01f});
    mb.upload(S->ground);
}

void update_player(const Input& in, float dt) {
    Player& p = S->player;
    vec2 stick = in.lstick;
    bool acting = !p.anim.cur || (!p.anim.cur->loop && !p.anim.done());
    if (in.hit(BTN_SOUTH) && !acting) { p.anim.play("slam", 0.08f, true); acting = true; }
    else if (in.hit(BTN_WEST) && !acting) { p.anim.play("swing", 0.08f, true); acting = true; }
    else if (in.hit(BTN_NORTH) && !acting) { p.anim.play("warcry", 0.1f, true); acting = true; }
    else if (in.hit(BTN_EAST) && !acting) {
        p.anim.play("dodge", 0.05f, true);
        acting = true;
        if (length(stick) > 0.2f) p.facing = angle_of(stick);
        p.action_t = 0;
    }
    float speed = 5.2f;
    vec2 want{0, 0};
    if (!acting) {
        want = stick * speed;
        if (length(stick) > 0.1f) p.facing = wrap_angle(p.facing + wrap_angle(angle_of(stick) - p.facing) * std::min(1.f, dt * 14.f));
    } else if (p.anim.playing("dodge")) {
        want = from_angle(p.facing) * 9.5f * (1.f - p.anim.progress() * 0.6f);
    }
    p.vel = lerp(p.vel, want, std::min(1.f, dt * 16.f));
    p.pos += p.vel * dt;
    if (!acting) {
        if (length(p.vel) > 0.6f) p.anim.play("run", 0.15f, false, clampf(length(p.vel) / speed, 0.6f, 1.2f));
        else p.anim.play("idle", 0.25f);
    }
    if (acting && p.anim.done()) p.anim.play(length(stick) > 0.1f ? "run" : "idle", 0.15f);
    p.anim.update(dt);
    if (p.anim.event("hit") && S->plat && S->plat->rumble) S->plat->rumble(40000, 20000);
}

void update_camera(float dt) {
    vec2 tp = S->player.pos + S->player.vel * 0.15f;
    vec3 target{tp.x, tp.y + 0.8f, 0.6f};
    float d = 18.f, pitch = radians(55.f);
    vec3 eye = target + vec3{0, -d * std::cos(pitch), d * std::sin(pitch)};
    S->cam.target = lerp(S->cam.target, target, std::min(1.f, dt * 8.f));
    S->cam.eye = S->cam.target + (eye - target);
    S->cam.fovy = radians(30.f);
}

void run_bot(Input& in) {
    if (S->bot.empty()) return;
    if (S->bot == "walk") {
        if (S->frame == 1) S->start_pos = S->player.pos;
        in.lstick = {0, 1};
        if (S->frame == 60) in.pressed |= 1u << BTN_SOUTH, in.down |= 1u << BTN_SOUTH;
        if (S->frame >= 180) {
            float moved = length(S->player.pos - S->start_pos);
            if (moved > 4.f) { S->test_status = 1; S->test_msg = "walked " + std::to_string(moved) + " m"; }
            else { S->test_status = 2; S->test_msg = "only moved " + std::to_string(moved); }
        }
    }
}

}  // namespace

bool app_init(const char* pack_path, Platform* plat) {
    S = new State();
    S->plat = plat;
    if (!pack().open_file(pack_path)) return false;
    S->warrior = assets().character("warrior");
    if (!S->warrior.skel || !S->warrior.anims) return false;
    S->player.anim.bind(S->warrior.skel, S->warrior.anims);
    S->player.anim.play("idle", 0);
    if (const char* b = getenv("QAHIRA_BOT")) S->bot = b;
    S->cam.target = {0, 0.8f, 0.6f};
    update_camera(1.f);
    return true;
}

void app_shutdown() {
    if (!S) return;
    if (S->gpu) { S->renderer.shutdown(); S->ground.destroy(); assets().clear(); }
    delete S;
    S = nullptr;
}

void app_gpu_init() {
    S->gpu = true;
    S->renderer.init(1920, 1080, 0.75f);
    ui().init();
    S->warrior.body = assets().mesh("warrior");
    S->maul = assets().mesh("maul");
    build_ground();
}

void app_gpu_lost() {
    S->gpu = false;
    assets().gpu_lost();
}

void app_update(const Input& in_raw, float dt) {
    Input in = in_raw;
    S->frame++;
    run_bot(in);
    S->time += dt;
    update_player(in, dt);
    update_camera(dt);
}

void app_render(GLuint fbo, int w, int h) {
    Renderer& r = S->renderer;
    r.begin(S->cam, S->env, float(S->time));
    Instance g;
    r.draw(&S->ground, g);
    // the Warrior
    Player& p = S->player;
    const CharacterModel& m = S->warrior;
    S->pose.resize(m.skel->bones.size());
    p.anim.pose(S->pose, S->scratch);
    mat4 root = mat4::translate({p.pos.x, p.pos.y, 0}) * mat4::rot_z(p.facing + kPi / 2);
    S->pose.compute_model(*m.skel, root);
    int off = r.alloc_palette(int(m.skel->bones.size()));
    S->pose.write_palette(*m.skel, r.palette(off));
    Instance body;
    body.extra = {float(off), 0, 0, 0};
    body.rim = vec4(hex_lin(0xF2A541), 0.18f);
    r.draw(m.body, body);
    if (m.weapon_bone >= 0 && S->maul) {
        Instance wpn;
        wpn.model = S->pose.model[size_t(m.weapon_bone)];
        wpn.rim = body.rim;
        r.draw(S->maul, wpn);
    }
    // the lantern on his hip, and a warm pool around him
    vec3 hip = S->pose.model[size_t(m.pelvis)].translation();
    r.light(hip + vec3{0.25f, -0.1f, -0.1f}, 6.f, hex_lin(0xFFB04A) * 16.f);
    // street lights to test the tiled lighting
    for (int i = 0; i < 12; i++) {
        float y = -24.f + i * 4.5f;
        bool pink = i % 2;
        r.light({i % 3 == 0 ? -7.5f : 7.5f, y, 2.6f}, 7.f, (pink ? hex_lin(0xFF2E88) : hex_lin(0x2BD1C8)) * 26.f);
    }
    for (int i = 0; i < 12; i++) {
        float y = -24.f + i * 4.5f;
        r.ground({i % 3 == 0 ? -7.5f : 7.5f, y, 0.f}, 1.4f, vec4(1, 0.4f, 0.7f, 0.25f), {0, 2, 0, 1}, Blend::Additive);
    }
    // soft contact shadow
    r.ground({p.pos.x, p.pos.y, 0.f}, 0.75f, vec4(0, 0, 0, 0.55f), {0, 1.5f, 0, 1}, Blend::Alpha);
    r.end(fbo, w, h, false);

    Ui& u = ui();
    u.begin();
    u.text(40, 30, "QAHIRA", 56, pal::amber, Align::Left, 1.5f);
    u.text(40, 92, "Slice 0 \xC2\xB7 First Light", 28, pal::soft);
    char buf[128];
    snprintf(buf, sizeof buf, "draws %d  inst %d  lights %d", r.draw_calls, r.instances, r.lights_used);
    u.text(1880, 30, buf, 24, pal::dim, Align::Right);
    u.frame(40, 960, 560, 80, pal::panel.alpha(0.85f), pal::line, 14, 2);
    u.text(64, 978, "J slam   U swing   I warcry   K dodge", 26, pal::bone);
    u.ring(1800, 960, 70, 62, pal::brass);
    u.arc_fill(1800, 960, 60, 0.7f, pal::life);
    u.end(fbo, w, h);
}

void app_audio(int16_t* stereo, int frames) { memset(stereo, 0, size_t(frames) * 4); }

// ---- save states: a versioned byte stream of the simulation state
size_t app_serialize_size() { return 256; }
bool app_serialize(void* data, size_t size) {
    if (size < 256) return false;
    memset(data, 0, size);
    uint8_t* d = (uint8_t*)data;
    uint32_t ver = 1;
    memcpy(d, &ver, 4);
    memcpy(d + 4, &S->player.pos, 8);
    memcpy(d + 12, &S->player.facing, 4);
    memcpy(d + 16, &S->time, 8);
    return true;
}
bool app_unserialize(const void* data, size_t size) {
    if (size < 256) return false;
    const uint8_t* d = (const uint8_t*)data;
    uint32_t ver;
    memcpy(&ver, d, 4);
    if (ver != 1) return false;
    memcpy(&S->player.pos, d + 4, 8);
    memcpy(&S->player.facing, d + 12, 4);
    memcpy(&S->time, d + 16, 8);
    return true;
}
void app_set_option(const char*, const char*) {}
int app_test_status() { return S ? S->test_status : 0; }
const char* app_test_message() { return S ? S->test_msg.c_str() : ""; }

}  // namespace q
