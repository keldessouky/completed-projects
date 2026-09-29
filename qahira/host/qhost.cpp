// qhost: a minimal libretro frontend for development on the Mac, linked straight to the core.
//   qhost <pack.qpk> [--headless] [--frames N] [--shot out.png] [--shot-every N] [--bot name] [--hidden]
// Keys: WASD move, mouse aims, J/K/U/I face buttons (south/east/west/north), L=R1, O=R2, Q=L2, E=L1,
//       1/2 flasks (L3/R3), Tab=Select, Enter=Start, arrows=D-pad, F5 save state, F9 load state, F12 screenshot.
#include "libretro.h"
#include "platform/app_api.hpp"
#include <SDL.h>
#include "gfx/gl.hpp"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <sys/stat.h>

extern "C" {
RETRO_API void retro_set_environment(retro_environment_t);
RETRO_API void retro_set_video_refresh(retro_video_refresh_t);
RETRO_API void retro_set_audio_sample(retro_audio_sample_t);
RETRO_API void retro_set_audio_sample_batch(retro_audio_sample_batch_t);
RETRO_API void retro_set_input_poll(retro_input_poll_t);
RETRO_API void retro_set_input_state(retro_input_state_t);
RETRO_API void retro_init(void);
RETRO_API bool retro_load_game(const retro_game_info*);
RETRO_API void retro_run(void);
RETRO_API void retro_unload_game(void);
RETRO_API size_t retro_serialize_size(void);
RETRO_API bool retro_serialize(void*, size_t);
RETRO_API bool retro_unserialize(const void*, size_t);
}

static bool g_headless = false;
static SDL_Window* g_win = nullptr;
static SDL_GLContext g_ctx = nullptr;
static GLuint g_fbo = 0, g_col = 0, g_depth = 0;
static retro_hw_render_callback g_hw;
static bool g_hw_on = false;
static SDL_AudioDeviceID g_audio = 0;
static SDL_GameController* g_pad = nullptr;
static int16_t g_btn[16];
static int16_t g_axes[4];
static int16_t g_trig[2];
static int g_ptr_x = 0, g_ptr_y = 0;
static bool g_ptr_down = false;
static std::string g_save_dir = "build/saves";
static FILE* g_wav = nullptr;
static uint32_t g_wav_frames = 0;
static const int W = 1920, H = 1080;

static void core_log(enum retro_log_level, const char* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
}

static uintptr_t get_fb() { return g_fbo; }
static retro_proc_address_t get_proc(const char* sym) { return (retro_proc_address_t)SDL_GL_GetProcAddress(sym); }
static bool set_rumble(unsigned, enum retro_rumble_effect, uint16_t) { return true; }

static bool env(unsigned cmd, void* data) {
    switch (cmd) {
        case RETRO_ENVIRONMENT_GET_LOG_INTERFACE: ((retro_log_callback*)data)->log = core_log; return true;
        case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: return true;
        case RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME:
        case RETRO_ENVIRONMENT_SET_CONTROLLER_INFO:
        case RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS: return true;
        case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char**)data = g_save_dir.c_str(); return true;
        case RETRO_ENVIRONMENT_GET_RUMBLE_INTERFACE: ((retro_rumble_interface*)data)->set_rumble_state = set_rumble; return true;
        case RETRO_ENVIRONMENT_SET_HW_RENDER: {
            if (g_headless) return false;
            auto* hw = (retro_hw_render_callback*)data;
            hw->get_current_framebuffer = get_fb;
            hw->get_proc_address = get_proc;
            g_hw = *hw;
            g_hw_on = true;
            return true;
        }
        default: return false;
    }
}

static void video(const void*, unsigned, unsigned, size_t) {}
static void audio1(int16_t, int16_t) {}
static size_t audio_batch(const int16_t* d, size_t frames) {
    if (g_wav) { fwrite(d, 4, frames, g_wav); g_wav_frames += uint32_t(frames); }
    if (g_audio && SDL_GetQueuedAudioSize(g_audio) < 48000 * 4 / 5) SDL_QueueAudio(g_audio, d, Uint32(frames * 4));
    return frames;
}
static void poll() {}
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id) {
    if (port != 0) return 0;
    if (device == RETRO_DEVICE_JOYPAD) return id < 16 ? g_btn[id] : 0;
    if (device == RETRO_DEVICE_ANALOG) {
        if (index == RETRO_DEVICE_INDEX_ANALOG_BUTTON) {
            if (id == RETRO_DEVICE_ID_JOYPAD_L2) return g_trig[0];
            if (id == RETRO_DEVICE_ID_JOYPAD_R2) return g_trig[1];
            return 0;
        }
        int base = index == RETRO_DEVICE_INDEX_ANALOG_LEFT ? 0 : 2;
        return g_axes[base + (id == RETRO_DEVICE_ID_ANALOG_Y ? 1 : 0)];
    }
    if (device == RETRO_DEVICE_POINTER) {
        if (id == RETRO_DEVICE_ID_POINTER_X) return int16_t(g_ptr_x);
        if (id == RETRO_DEVICE_ID_POINTER_Y) return int16_t(g_ptr_y);
        if (id == RETRO_DEVICE_ID_POINTER_PRESSED) return g_ptr_down;
    }
    return 0;
}

static void make_fbo() {
    glGenFramebuffers(1, &g_fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, g_fbo);
    glGenTextures(1, &g_col);
    glBindTexture(GL_TEXTURE_2D, g_col);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, W, H, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, g_col, 0);
    glGenRenderbuffers(1, &g_depth);
    glBindRenderbuffer(GL_RENDERBUFFER, g_depth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, W, H);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, g_depth);
}

static void screenshot(const char* path) {
    std::vector<uint8_t> px(size_t(W) * H * 4), flip(px.size());
    glBindFramebuffer(GL_READ_FRAMEBUFFER, g_fbo);
    glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, px.data());
    for (int y = 0; y < H; y++) memcpy(&flip[size_t(y) * W * 4], &px[size_t(H - 1 - y) * W * 4], size_t(W) * 4);
    for (size_t i = 3; i < flip.size(); i += 4) flip[i] = 255;
    stbi_write_png(path, W, H, 4, flip.data(), W * 4);
    fprintf(stderr, "screenshot %s\n", path);
}

static void read_input(bool focus) {
    memset(g_btn, 0, sizeof g_btn);
    memset(g_axes, 0, sizeof g_axes);
    g_trig[0] = g_trig[1] = 0;
    if (!focus) return;
    const Uint8* k = SDL_GetKeyboardState(nullptr);
    auto set = [&](int id, bool v) { if (v) g_btn[id] = 1; };
    set(RETRO_DEVICE_ID_JOYPAD_B, k[SDL_SCANCODE_J] || k[SDL_SCANCODE_SPACE]);
    set(RETRO_DEVICE_ID_JOYPAD_A, k[SDL_SCANCODE_K] || k[SDL_SCANCODE_BACKSPACE]);
    set(RETRO_DEVICE_ID_JOYPAD_Y, k[SDL_SCANCODE_U]);
    set(RETRO_DEVICE_ID_JOYPAD_X, k[SDL_SCANCODE_I]);
    set(RETRO_DEVICE_ID_JOYPAD_L, k[SDL_SCANCODE_E]);
    set(RETRO_DEVICE_ID_JOYPAD_R, k[SDL_SCANCODE_L]);
    set(RETRO_DEVICE_ID_JOYPAD_L3, k[SDL_SCANCODE_1]);
    set(RETRO_DEVICE_ID_JOYPAD_R3, k[SDL_SCANCODE_2]);
    set(RETRO_DEVICE_ID_JOYPAD_SELECT, k[SDL_SCANCODE_TAB]);
    set(RETRO_DEVICE_ID_JOYPAD_START, k[SDL_SCANCODE_RETURN] || k[SDL_SCANCODE_ESCAPE]);
    set(RETRO_DEVICE_ID_JOYPAD_UP, k[SDL_SCANCODE_UP]);
    set(RETRO_DEVICE_ID_JOYPAD_DOWN, k[SDL_SCANCODE_DOWN]);
    set(RETRO_DEVICE_ID_JOYPAD_LEFT, k[SDL_SCANCODE_LEFT]);
    set(RETRO_DEVICE_ID_JOYPAD_RIGHT, k[SDL_SCANCODE_RIGHT]);
    if (k[SDL_SCANCODE_Q]) g_trig[0] = 32767;
    if (k[SDL_SCANCODE_O]) g_trig[1] = 32767;
    int lx = (k[SDL_SCANCODE_D] ? 1 : 0) - (k[SDL_SCANCODE_A] ? 1 : 0);
    int ly = (k[SDL_SCANCODE_S] ? 1 : 0) - (k[SDL_SCANCODE_W] ? 1 : 0);
    float n = (lx && ly) ? 0.7071f : 1.f;
    g_axes[0] = int16_t(lx * 32767 * n);
    g_axes[1] = int16_t(ly * 32767 * n);
    if (g_pad) {
        auto b = [&](SDL_GameControllerButton sb) { return SDL_GameControllerGetButton(g_pad, sb) != 0; };
        set(RETRO_DEVICE_ID_JOYPAD_B, b(SDL_CONTROLLER_BUTTON_A));
        set(RETRO_DEVICE_ID_JOYPAD_A, b(SDL_CONTROLLER_BUTTON_B));
        set(RETRO_DEVICE_ID_JOYPAD_Y, b(SDL_CONTROLLER_BUTTON_X));
        set(RETRO_DEVICE_ID_JOYPAD_X, b(SDL_CONTROLLER_BUTTON_Y));
        set(RETRO_DEVICE_ID_JOYPAD_L, b(SDL_CONTROLLER_BUTTON_LEFTSHOULDER));
        set(RETRO_DEVICE_ID_JOYPAD_R, b(SDL_CONTROLLER_BUTTON_RIGHTSHOULDER));
        set(RETRO_DEVICE_ID_JOYPAD_L3, b(SDL_CONTROLLER_BUTTON_LEFTSTICK));
        set(RETRO_DEVICE_ID_JOYPAD_R3, b(SDL_CONTROLLER_BUTTON_RIGHTSTICK));
        set(RETRO_DEVICE_ID_JOYPAD_SELECT, b(SDL_CONTROLLER_BUTTON_BACK));
        set(RETRO_DEVICE_ID_JOYPAD_START, b(SDL_CONTROLLER_BUTTON_START));
        set(RETRO_DEVICE_ID_JOYPAD_UP, b(SDL_CONTROLLER_BUTTON_DPAD_UP));
        set(RETRO_DEVICE_ID_JOYPAD_DOWN, b(SDL_CONTROLLER_BUTTON_DPAD_DOWN));
        set(RETRO_DEVICE_ID_JOYPAD_LEFT, b(SDL_CONTROLLER_BUTTON_DPAD_LEFT));
        set(RETRO_DEVICE_ID_JOYPAD_RIGHT, b(SDL_CONTROLLER_BUTTON_DPAD_RIGHT));
        auto ax = [&](SDL_GameControllerAxis a) { return SDL_GameControllerGetAxis(g_pad, a); };
        if (!lx && !ly) { g_axes[0] = ax(SDL_CONTROLLER_AXIS_LEFTX); g_axes[1] = ax(SDL_CONTROLLER_AXIS_LEFTY); }
        g_axes[2] = ax(SDL_CONTROLLER_AXIS_RIGHTX);
        g_axes[3] = ax(SDL_CONTROLLER_AXIS_RIGHTY);
        g_trig[0] = std::max<int16_t>(g_trig[0], ax(SDL_CONTROLLER_AXIS_TRIGGERLEFT));
        g_trig[1] = std::max<int16_t>(g_trig[1], ax(SDL_CONTROLLER_AXIS_TRIGGERRIGHT));
    }
    if (g_trig[0] > 8000) g_btn[RETRO_DEVICE_ID_JOYPAD_L2] = 1;
    if (g_trig[1] > 8000) g_btn[RETRO_DEVICE_ID_JOYPAD_R2] = 1;
}

int main(int argc, char** argv) {
    const char* pack = "build/Qahira.qpk";
    int frames = -1, shot_every = 0;
    const char* shot = nullptr;
    bool hidden = false;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "--headless") g_headless = true;
        else if (a == "--hidden") hidden = true;
        else if (a == "--frames" && i + 1 < argc) frames = atoi(argv[++i]);
        else if (a == "--shot" && i + 1 < argc) shot = argv[++i];
        else if (a == "--shot-every" && i + 1 < argc) shot_every = atoi(argv[++i]);
        else if (a == "--bot" && i + 1 < argc) setenv("QAHIRA_BOT", argv[++i], 1);
        else if (a == "--wav" && i + 1 < argc) { g_wav = fopen(argv[++i], "wb"); uint8_t hdr[44] = {}; fwrite(hdr, 1, 44, g_wav); }
        else if (a == "--opt" && i + 1 < argc) {
            std::string kv = argv[++i];
            size_t eq = kv.find('=');
            if (eq != std::string::npos) setenv(("QAHIRA_OPT_" + kv.substr(0, eq)).c_str(), kv.substr(eq + 1).c_str(), 1);
        } else pack = argv[i];
    }
    mkdir("build", 0755);
    mkdir(g_save_dir.c_str(), 0755);
    if (!g_headless) {
        SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO | SDL_INIT_GAMECONTROLLER);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 1);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG);
        SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);
        g_win = SDL_CreateWindow("QAHIRA (dev host)", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 1280, 720,
                                 SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI | (hidden ? SDL_WINDOW_HIDDEN : 0));
        g_ctx = SDL_GL_CreateContext(g_win);
        SDL_GL_SetSwapInterval(1);
        make_fbo();
        SDL_AudioSpec want{}, have{};
        want.freq = 48000;
        want.format = AUDIO_S16SYS;
        want.channels = 2;
        want.samples = 1024;
        g_audio = SDL_OpenAudioDevice(nullptr, 0, &want, &have, 0);
        if (g_audio) SDL_PauseAudioDevice(g_audio, 0);
        for (int i = 0; i < SDL_NumJoysticks(); i++)
            if (SDL_IsGameController(i)) { g_pad = SDL_GameControllerOpen(i); break; }
    }
    retro_set_environment(env);
    retro_set_video_refresh(video);
    retro_set_audio_sample(audio1);
    retro_set_audio_sample_batch(audio_batch);
    retro_set_input_poll(poll);
    retro_set_input_state(input_state);
    retro_init();
    retro_game_info gi{};
    gi.path = pack;
    if (!retro_load_game(&gi)) { fprintf(stderr, "load failed\n"); return 1; }
    if (g_hw_on && g_hw.context_reset) g_hw.context_reset();

    std::vector<uint8_t> state;
    bool quit = false;
    int frame = 0, shot_n = 0;
    while (!quit) {
        bool focus = true;
        if (!g_headless) {
            SDL_Event e;
            while (SDL_PollEvent(&e)) {
                if (e.type == SDL_QUIT) quit = true;
                if (e.type == SDL_KEYDOWN && !e.key.repeat) {
                    if (e.key.keysym.sym == SDLK_F5) { state.resize(retro_serialize_size()); retro_serialize(state.data(), state.size()); fprintf(stderr, "state saved (%zu bytes)\n", state.size()); }
                    if (e.key.keysym.sym == SDLK_F9 && !state.empty()) { retro_unserialize(state.data(), state.size()); fprintf(stderr, "state loaded\n"); }
                    if (e.key.keysym.sym == SDLK_F12) { char p[64]; snprintf(p, sizeof p, "build/shot_%03d.png", shot_n++); screenshot(p); }
                }
                if (e.type == SDL_CONTROLLERDEVICEADDED && !g_pad) g_pad = SDL_GameControllerOpen(e.cdevice.which);
                if (e.type == SDL_MOUSEBUTTONDOWN) g_ptr_down = true;
                if (e.type == SDL_MOUSEBUTTONUP) g_ptr_down = false;
            }
            int ww, wh, mx, my;
            SDL_GetWindowSize(g_win, &ww, &wh);
            SDL_GetMouseState(&mx, &my);
            g_ptr_x = int((mx / float(ww)) * 0xfffe) - 0x7fff;
            g_ptr_y = int((my / float(wh)) * 0xfffe) - 0x7fff;
            focus = (SDL_GetWindowFlags(g_win) & SDL_WINDOW_INPUT_FOCUS) != 0 || hidden;
        }
        read_input(focus && !hidden);
        retro_run();
        frame++;
        if (!g_headless) {
            if (shot_every > 0 && frame % shot_every == 0) { char p[96]; snprintf(p, sizeof p, "build/seq_%04d.png", frame); screenshot(p); }
            if (shot && frames > 0 && frame == frames) screenshot(shot);
            int dw, dh;
            SDL_GL_GetDrawableSize(g_win, &dw, &dh);
            glBindFramebuffer(GL_READ_FRAMEBUFFER, g_fbo);
            glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
            glViewport(0, 0, dw, dh);
            glClearColor(0, 0, 0, 1);
            glClear(GL_COLOR_BUFFER_BIT);
            float s = std::min(dw / float(W), dh / float(H));
            int bw = int(W * s), bh = int(H * s), bx = (dw - bw) / 2, by = (dh - bh) / 2;
            glBlitFramebuffer(0, 0, W, H, bx, by, bx + bw, by + bh, GL_COLOR_BUFFER_BIT, GL_LINEAR);
            if (!hidden) SDL_GL_SwapWindow(g_win);
        }
        int st = q::app_test_status();
        if (st != 0) { fprintf(stderr, "TEST %s: %s\n", st == 1 ? "PASS" : "FAIL", q::app_test_message()); quit = true; if (st == 2) { retro_unload_game(); return 2; } }
        if (frames > 0 && frame >= frames) quit = true;
        if (q::app_exit_requested()) quit = true;
    }
    retro_unload_game();
    if (g_wav) {  // patch the RIFF header now that the length is known
        uint32_t data = g_wav_frames * 4, riff = 36 + data, fmt_len = 16, rate = 48000, byte_rate = 48000 * 4;
        uint16_t pcm = 1, ch = 2, align = 4, bits = 16;
        fseek(g_wav, 0, SEEK_SET);
        fwrite("RIFF", 1, 4, g_wav); fwrite(&riff, 4, 1, g_wav); fwrite("WAVEfmt ", 1, 8, g_wav);
        fwrite(&fmt_len, 4, 1, g_wav); fwrite(&pcm, 2, 1, g_wav); fwrite(&ch, 2, 1, g_wav); fwrite(&rate, 4, 1, g_wav);
        fwrite(&byte_rate, 4, 1, g_wav); fwrite(&align, 2, 1, g_wav); fwrite(&bits, 2, 1, g_wav);
        fwrite("data", 1, 4, g_wav); fwrite(&data, 4, 1, g_wav);
        fclose(g_wav);
    }
    return 0;
}
