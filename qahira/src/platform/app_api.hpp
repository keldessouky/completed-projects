// What the libretro layer needs from the game.
#pragma once
#include "platform/input.hpp"
#include "gfx/gl.hpp"
#include <cstddef>
#include <cstdint>
#include <string>

namespace q {

struct Platform {
    std::string save_dir;
    std::string core_path;   // the core's own file, which an update replaces (empty when the game isn't a core)
    bool has_gpu = false;
    void (*rumble)(int strong, int weak) = nullptr;   // 0..65535
    int fps = 60;
};

bool app_init(const char* pack_path, Platform* plat);
void app_shutdown();
void app_gpu_init();                         // GL context (re)created
void app_gpu_lost();                         // GL context destroyed
void app_update(const Input& in, float dt);  // one fixed step
void app_render(GLuint fbo, int w, int h);
void app_audio(int16_t* stereo, int frames); // fill interleaved stereo at 48 kHz
size_t app_serialize_size();
bool app_serialize(void* data, size_t size);
bool app_unserialize(const void* data, size_t size);
void app_set_option(const char* key, const char* value);
bool app_exit_requested();   // the player chose Exit: the frontend closes the game
// test hooks (headless bot runs)
int app_test_status();   // 0 running, 1 pass, 2 fail
const char* app_test_message();

}  // namespace q
