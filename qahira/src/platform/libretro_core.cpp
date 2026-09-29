// libretro entry points: this is what RetroArch loads on the RP6.
#include "libretro.h"
#include "platform/app_api.hpp"
#include "core/log.hpp"
#include <cstring>
#include <string>
#include <vector>

using namespace q;

static retro_environment_t env_cb;
static retro_video_refresh_t video_cb;
static retro_audio_sample_t audio_cb;
static retro_audio_sample_batch_t audio_batch_cb;
static retro_input_poll_t poll_cb;
static retro_input_state_t state_cb;
static retro_log_printf_t log_cb;
static retro_hw_render_callback hw;
static retro_rumble_interface rumble_if;
static bool have_rumble = false;
static bool gpu_ready = false;
static bool loaded = false;
static uint32_t prev_buttons = 0;
static Platform plat;
static const int kW = 1920, kH = 1080;
// the performance mode (GDD §11.6): Balanced, 60 fps with the 3D at 75%; Battery, 40 fps (it divides the RP6's 120 Hz
// evenly) with the 3D at 67%. The simulation always steps at 60 Hz: at 40 fps a frame runs one or two steps.
static int g_fps = 60;
static float g_steps = 0;

static void check_variables(bool announce) {
    retro_variable var{"qahira_performance", nullptr};
    if (!env_cb || !env_cb(RETRO_ENVIRONMENT_GET_VARIABLE, &var) || !var.value) return;
    const bool battery = strncmp(var.value, "Battery", 7) == 0;
    app_set_option("qahira_performance", battery ? "battery" : "balanced");
    const int fps = battery ? 40 : 60;
    if (fps == g_fps) return;
    g_fps = fps;
    if (announce) {   // the frontend needs the new timing
        retro_system_av_info av;
        retro_get_system_av_info(&av);
        env_cb(RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO, &av);
    }
}

// a message on RetroArch's screen: it shows over a black picture, so a player sees why there is no game
static void osd(const char* msg, unsigned frames = 600) {
    if (!env_cb) return;
    retro_message m{msg, frames};
    env_cb(RETRO_ENVIRONMENT_SET_MESSAGE, &m);
}

static void log_sink(LogLevel l, const char* msg) {
    // the first few errors go on screen too (their first line): a shader the device's driver refuses, a missing file
    static int shown = 0;
    if (l == LogLevel::Error && shown < 3) {
        shown++;
        std::string first = std::string("Qahira: ") + msg;
        if (size_t nl = first.find('\n'); nl != std::string::npos) first.resize(nl);
        if (first.size() > 120) first.resize(120);
        osd(first.c_str(), 900);
    }
    if (log_cb) {
        retro_log_level lv = l == LogLevel::Error ? RETRO_LOG_ERROR : l == LogLevel::Warn ? RETRO_LOG_WARN : RETRO_LOG_INFO;
        log_cb(lv, "[qahira] %s\n", msg);
    } else {
        fprintf(stderr, "[qahira] %s\n", msg);
    }
}

static void do_rumble(int strong, int weak) {
    if (!have_rumble) return;
    rumble_if.set_rumble_state(0, RETRO_RUMBLE_STRONG, uint16_t(strong));
    rumble_if.set_rumble_state(0, RETRO_RUMBLE_WEAK, uint16_t(weak));
}

static void context_reset() {
    gpu_ready = true;
    app_gpu_init();
}

static void context_destroy() {
    app_gpu_lost();
    gpu_ready = false;
}

RETRO_API void retro_set_environment(retro_environment_t cb) {
    env_cb = cb;
    retro_log_callback logging;
    if (cb(RETRO_ENVIRONMENT_GET_LOG_INTERFACE, &logging)) log_cb = logging.log;
    set_log_sink(log_sink);
    bool no_game = false;
    cb(RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME, &no_game);
    static const retro_controller_description pads[] = {{"RetroPad", RETRO_DEVICE_JOYPAD}};
    static const retro_controller_info ports[] = {{pads, 1}, {nullptr, 0}};
    cb(RETRO_ENVIRONMENT_SET_CONTROLLER_INFO, (void*)ports);
    static retro_input_descriptor desc[] = {
        {0, RETRO_DEVICE_ANALOG, RETRO_DEVICE_INDEX_ANALOG_LEFT, RETRO_DEVICE_ID_ANALOG_X, "Move"},
        {0, RETRO_DEVICE_ANALOG, RETRO_DEVICE_INDEX_ANALOG_RIGHT, RETRO_DEVICE_ID_ANALOG_X, "Aim"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_B, "Skill 1 / Interact"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_A, "Dodge / Back"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_Y, "Skill 2"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_X, "Skill 3"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R, "Skill 4 / next menu tab"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R2, "Skill 5 (analog)"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L2, "Second skill bar"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L, "Previous menu tab"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L3, "Life flask (M1)"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R3, "Build codes (in the Book of Fixed Stars)"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_START, "Menu"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_SELECT, "Book of Fixed Stars (hold) / place a star (tap)"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_UP, "Portal"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_LEFT, "Pick up"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_RIGHT, "Next loot filter"},
        {0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_DOWN, "Map"},
        {0, 0, 0, 0, nullptr},
    };
    cb(RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS, desc);
    static const retro_variable vars[] = {
        {"qahira_performance", "Performance; Balanced (60 fps)|Battery (40 fps)"},
        {nullptr, nullptr},
    };
    cb(RETRO_ENVIRONMENT_SET_VARIABLES, (void*)vars);
}

RETRO_API void retro_set_video_refresh(retro_video_refresh_t cb) { video_cb = cb; }
RETRO_API void retro_set_audio_sample(retro_audio_sample_t cb) { audio_cb = cb; }
RETRO_API void retro_set_audio_sample_batch(retro_audio_sample_batch_t cb) { audio_batch_cb = cb; }
RETRO_API void retro_set_input_poll(retro_input_poll_t cb) { poll_cb = cb; }
RETRO_API void retro_set_input_state(retro_input_state_t cb) { state_cb = cb; }

RETRO_API void retro_init(void) {}
RETRO_API void retro_deinit(void) {}
RETRO_API unsigned retro_api_version(void) { return RETRO_API_VERSION; }

RETRO_API void retro_get_system_info(retro_system_info* info) {
    memset(info, 0, sizeof(*info));
    info->library_name = "Qahira";
    info->library_version = "0.1.0";
    info->valid_extensions = "qpk|bin";   // (a phone browser may save the pack as .bin; the core checks the pack itself)
    info->need_fullpath = true;
    info->block_extract = true;
}

RETRO_API void retro_get_system_av_info(retro_system_av_info* info) {
    info->geometry.base_width = kW;
    info->geometry.base_height = kH;
    info->geometry.max_width = kW;
    info->geometry.max_height = kH;
    info->geometry.aspect_ratio = 16.f / 9.f;
    info->timing.fps = double(g_fps);
    info->timing.sample_rate = 48000.0;
}

RETRO_API void retro_set_controller_port_device(unsigned, unsigned) {}
RETRO_API void retro_reset(void) {}

RETRO_API bool retro_load_game(const retro_game_info* game) {
    if (!game || !game->path) return false;
    retro_pixel_format fmt = RETRO_PIXEL_FORMAT_XRGB8888;
    env_cb(RETRO_ENVIRONMENT_SET_PIXEL_FORMAT, &fmt);
    // the context: GL 3.3 core on the desktop; on Android, GLES 3 (the shaders are GLSL ES 3.00). RetroArch builds differ
    // in which GLES requests they accept, so the plainest comes first: "GLES 3", then 3.2 and 3.1 by version
    struct Try { retro_hw_context_type type; unsigned major, minor; const char* name; };
#if defined(__ANDROID__)
    static const Try tries[] = {{RETRO_HW_CONTEXT_OPENGLES3, 3, 0, "GLES 3"},
                                {RETRO_HW_CONTEXT_OPENGLES_VERSION, 3, 2, "GLES 3.2"},
                                {RETRO_HW_CONTEXT_OPENGLES_VERSION, 3, 1, "GLES 3.1"}};
#else
    static const Try tries[] = {{RETRO_HW_CONTEXT_OPENGL_CORE, 3, 3, "GL 3.3 core"}};
#endif
    plat.has_gpu = false;
    for (const Try& t : tries) {
        memset(&hw, 0, sizeof(hw));
        hw.context_type = t.type;
        hw.version_major = t.major;
        hw.version_minor = t.minor;
        hw.context_reset = context_reset;
        hw.context_destroy = context_destroy;
        hw.depth = false;  // the core renders into its own targets; the frontend FBO only receives the composite
        hw.stencil = false;
        hw.bottom_left_origin = true;
        if (env_cb(RETRO_ENVIRONMENT_SET_HW_RENDER, &hw)) {
            plat.has_gpu = true;
            QLOG("hardware context: %s", t.name);
            break;
        }
        QWARN("the frontend refused a %s context", t.name);
    }
    if (!plat.has_gpu) {
        QWARN("no hardware context: running without video (headless)");
        // which driver RetroArch says it is using: if it is not GL, the video driver setting did not stick
        retro_hw_context_type pref = RETRO_HW_CONTEXT_NONE;
        const bool known = env_cb(RETRO_ENVIRONMENT_GET_PREFERRED_HW_RENDER, &pref);
        if (known && pref == RETRO_HW_CONTEXT_VULKAN)
            osd("Qahira: RetroArch is still on the vulkan driver. Settings > Drivers > Video > gl, then Configuration File > "
                "Save Current Configuration, and restart", 1200);
        else
            osd("Qahira: RetroArch refused every GLES 3 context. Please report this (Settings > Drivers > Video shows which driver)", 1200);
    }
    have_rumble = env_cb(RETRO_ENVIRONMENT_GET_RUMBLE_INTERFACE, &rumble_if);
    plat.rumble = do_rumble;
    const char* dir = nullptr;
    if (env_cb(RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY, &dir) && dir && *dir) plat.save_dir = dir;
    else {   // no saves folder (or "keep saves with the content"): beside the pack, as "." is "/" on Android
        const std::string p = game->path ? game->path : "";
        const size_t cut = p.find_last_of("/\\");
        plat.save_dir = cut == std::string::npos ? std::string(".") : p.substr(0, cut);
    }
    loaded = app_init(game->path, &plat);
    if (loaded) check_variables(false);
    return loaded;
}

RETRO_API bool retro_load_game_special(unsigned, const retro_game_info*, size_t) { return false; }

RETRO_API void retro_unload_game(void) {
    if (loaded) app_shutdown();
    loaded = false;
}

RETRO_API unsigned retro_get_region(void) { return RETRO_REGION_NTSC; }

static float axis(int16_t v) { return v < 0 ? v / 32768.f : v / 32767.f; }

static vec2 stick(unsigned index) {
    vec2 v{axis(state_cb(0, RETRO_DEVICE_ANALOG, index, RETRO_DEVICE_ID_ANALOG_X)),
           -axis(state_cb(0, RETRO_DEVICE_ANALOG, index, RETRO_DEVICE_ID_ANALOG_Y))};
    float l = length(v);
    const float dz = 0.15f;
    if (l < dz) return {0, 0};
    float k = std::min(1.f, (l - dz) / (1 - dz));
    return v / l * k;
}

RETRO_API void retro_run(void) {
    poll_cb();
    Input in;
    static const unsigned map[BTN_COUNT] = {
        RETRO_DEVICE_ID_JOYPAD_B, RETRO_DEVICE_ID_JOYPAD_A, RETRO_DEVICE_ID_JOYPAD_Y, RETRO_DEVICE_ID_JOYPAD_X,
        RETRO_DEVICE_ID_JOYPAD_L, RETRO_DEVICE_ID_JOYPAD_R, RETRO_DEVICE_ID_JOYPAD_L2, RETRO_DEVICE_ID_JOYPAD_R2,
        RETRO_DEVICE_ID_JOYPAD_L3, RETRO_DEVICE_ID_JOYPAD_R3, RETRO_DEVICE_ID_JOYPAD_SELECT, RETRO_DEVICE_ID_JOYPAD_START,
        RETRO_DEVICE_ID_JOYPAD_UP, RETRO_DEVICE_ID_JOYPAD_DOWN, RETRO_DEVICE_ID_JOYPAD_LEFT, RETRO_DEVICE_ID_JOYPAD_RIGHT};
    for (int b = 0; b < BTN_COUNT; b++)
        if (state_cb(0, RETRO_DEVICE_JOYPAD, 0, map[b])) in.down |= 1u << b;
    in.lstick = stick(RETRO_DEVICE_INDEX_ANALOG_LEFT);
    in.rstick = stick(RETRO_DEVICE_INDEX_ANALOG_RIGHT);
    in.l2 = state_cb(0, RETRO_DEVICE_ANALOG, RETRO_DEVICE_INDEX_ANALOG_BUTTON, RETRO_DEVICE_ID_JOYPAD_L2) / 32767.f;
    in.r2 = state_cb(0, RETRO_DEVICE_ANALOG, RETRO_DEVICE_INDEX_ANALOG_BUTTON, RETRO_DEVICE_ID_JOYPAD_R2) / 32767.f;
    if (in.l2 <= 0 && in.held(BTN_L2)) in.l2 = 1;
    if (in.r2 <= 0 && in.held(BTN_R2)) in.r2 = 1;
    if (in.l2 > 0.25f) in.down |= 1u << BTN_L2;
    if (in.r2 > 0.25f) in.down |= 1u << BTN_R2;
    static bool was_touching = false;
    in.touching = state_cb(0, RETRO_DEVICE_POINTER, 0, RETRO_DEVICE_ID_POINTER_PRESSED) != 0;
    if (in.touching) {
        in.touch = {(state_cb(0, RETRO_DEVICE_POINTER, 0, RETRO_DEVICE_ID_POINTER_X) + 0x7fff) / float(0xfffe) * kW,
                    (state_cb(0, RETRO_DEVICE_POINTER, 0, RETRO_DEVICE_ID_POINTER_Y) + 0x7fff) / float(0xfffe) * kH};
    }
    in.tapped = was_touching && !in.touching;
    was_touching = in.touching;
    in.update_edges(prev_buttons);
    prev_buttons = in.down;

    bool updated = false;
    if (env_cb(RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE, &updated) && updated) check_variables(true);
    // 60 simulation steps a second whatever the frame rate; a second step in one frame sees no new presses
    g_steps += 60.f / float(g_fps);
    for (bool first = true; g_steps >= 1.f; g_steps -= 1.f, first = false) {
        if (!first) { in.pressed = 0; in.released = 0; in.tapped = false; }
        app_update(in, 1.f / 60.f);
    }

    if (gpu_ready) {
        app_render(GLuint(hw.get_current_framebuffer()), kW, kH);
        video_cb(RETRO_HW_FRAME_BUFFER_VALID, kW, kH, 0);
    } else if (video_cb) {
        video_cb(nullptr, kW, kH, 0);
        // no picture: say why, every ten seconds
        static unsigned n = 0;
        if (n++ % 600 == 0)
            osd(plat.has_gpu ? "Qahira: waiting for the GL context (video driver gl?)"
                             : "Qahira: no GL context. Settings > Drivers > Video > gl, Configuration File > Save Current Configuration, restart", 540);
    }

    static int16_t audio[1200 * 2];
    const int frames = 48000 / g_fps;   // 800 at 60 fps, 1200 at 40
    app_audio(audio, frames);
    if (audio_batch_cb) audio_batch_cb(audio, size_t(frames));
}

RETRO_API size_t retro_serialize_size(void) { return app_serialize_size(); }
RETRO_API bool retro_serialize(void* data, size_t size) { return app_serialize(data, size); }
RETRO_API bool retro_unserialize(const void* data, size_t size) { return app_unserialize(data, size); }
RETRO_API void retro_cheat_reset(void) {}
RETRO_API void retro_cheat_set(unsigned, bool, const char*) {}
RETRO_API void* retro_get_memory_data(unsigned) { return nullptr; }
RETRO_API size_t retro_get_memory_size(unsigned) { return 0; }
