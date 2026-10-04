// Software mixer: WAV samples from the pack, 32 voices, looping music and ambience beds, 48 kHz stereo out.
#pragma once
#include "audio/radio.hpp"
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace q {

struct Sound {
    std::vector<int16_t> pcm;  // mono
    int rate = 48000;
};

class Audio {
public:
    void init();
    int play(const std::string& name, float gain = 1.f, float pan = 0.f, float pitch = 1.f);
    void music(const std::string& name, float gain = 0.55f, float fade = 2.f);
    void ambience(const std::string& name, float gain = 0.45f, float fade = 2.f);
    void mix(int16_t* stereo, int frames);
    // the three volumes the Settings set: the game's music (and its ambience beds), the sound effects, the radio
    float master = 1.f, sfx_volume = 1.f, music_volume = 0.8f, ambience_volume = 1.f, radio_volume = 0.8f;
    // Radio Kafr El-Sheikh in place of the game's music: while it plays, the music beds fade out under it
    Radio radio;
    bool radio_on = false;
    float radio_gain = 0.9f;

private:
    struct Voice { const Sound* s = nullptr; double pos = 0, step = 1; float gl = 0, gr = 0; bool loop = false; bool active = false; };
    struct Bed { const Sound* s = nullptr; double pos = 0; float gain = 0, target = 0, rate = 0.5f; };
    const Sound* get(const std::string& name);
    void mix_bed(Bed& b, float* out, int frames, float vol);
    std::unordered_map<std::string, Sound> sounds_;
    Voice voices_[32];
    Bed music_[2], amb_[2];
    int music_cur_ = 0, amb_cur_ = 0;
    std::vector<float> acc_;
    float radio_mix_ = 0;   // 0 the game's music .. 1 the radio
};

Audio& audio();

}  // namespace q
