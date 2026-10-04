#include "audio/audio.hpp"
#include "core/pack.hpp"
#include "core/log.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>

namespace q {

Audio& audio() { static Audio a; return a; }

static bool parse_wav(Blob b, Sound& out) {
    Reader r(b);
    char id[4];
    r.bytes(id, 4);
    if (memcmp(id, "RIFF", 4)) return false;
    r.get<uint32_t>();
    r.bytes(id, 4);
    if (memcmp(id, "WAVE", 4)) return false;
    int channels = 1, bits = 16;
    while (r.ok(8)) {
        r.bytes(id, 4);
        uint32_t len = r.get<uint32_t>();
        if (!memcmp(id, "fmt ", 4)) {
            const uint8_t* p = r.skip(len);
            channels = p[2] | (p[3] << 8);
            out.rate = int(p[4] | (p[5] << 8) | (p[6] << 16) | (uint32_t(p[7]) << 24));
            bits = p[14] | (p[15] << 8);
        } else if (!memcmp(id, "data", 4)) {
            if (bits != 16) return false;
            size_t n = len / 2 / size_t(channels);
            out.pcm.resize(n);
            const int16_t* s = (const int16_t*)r.skip(len);
            for (size_t i = 0; i < n; i++) out.pcm[i] = s[i * size_t(channels)];
            return true;
        } else r.skip(len + (len & 1));
    }
    return false;
}

void Audio::init() {
    for (auto& name : pack().list("audio/")) {
        Sound s;
        if (parse_wav(pack().get(name), s)) {
            std::string key = name.substr(6, name.size() - 10);
            sounds_[key] = std::move(s);
        }
    }
    QLOG("audio: %zu sounds", sounds_.size());
}

const Sound* Audio::get(const std::string& name) {
    auto it = sounds_.find(name);
    return it == sounds_.end() ? nullptr : &it->second;
}

int Audio::play(const std::string& name, float gain, float pan, float pitch) {
    const Sound* s = get(name);
    if (!s) return -1;
    int best = -1;
    double oldest = -1;
    for (int i = 0; i < 32; i++) {
        if (!voices_[i].active) { best = i; break; }
        if (voices_[i].pos > oldest) { oldest = voices_[i].pos; best = i; }
    }
    Voice& v = voices_[best];
    v.s = s;
    v.pos = 0;
    v.step = double(s->rate) / 48000.0 * pitch;
    pan = pan < -1 ? -1 : pan > 1 ? 1 : pan;
    float g = gain * sfx_volume;
    v.gl = g * std::sqrt(0.5f * (1 - pan));
    v.gr = g * std::sqrt(0.5f * (1 + pan));
    v.loop = false;
    v.active = true;
    return best;
}

void Audio::music(const std::string& name, float gain, float fade) {
    const Sound* s = get(name);
    if (music_[music_cur_].s == s) { music_[music_cur_].target = gain; return; }
    music_[music_cur_].target = 0;
    music_[music_cur_].rate = 1.f / std::max(0.05f, fade);
    music_cur_ ^= 1;
    music_[music_cur_] = Bed{s, 0, 0, gain, 1.f / std::max(0.05f, fade)};
}

void Audio::ambience(const std::string& name, float gain, float fade) {
    const Sound* s = get(name);
    if (amb_[amb_cur_].s == s) { amb_[amb_cur_].target = gain; return; }
    amb_[amb_cur_].target = 0;
    amb_[amb_cur_].rate = 1.f / std::max(0.05f, fade);
    amb_cur_ ^= 1;
    amb_[amb_cur_] = Bed{s, 0, 0, gain, 1.f / std::max(0.05f, fade)};
}

void Audio::mix_bed(Bed& b, float* out, int frames, float vol) {
    if (!b.s || b.s->pcm.empty()) return;
    double step = double(b.s->rate) / 48000.0;
    size_t n = b.s->pcm.size();
    float dg = b.rate / 48000.f;
    for (int i = 0; i < frames; i++) {
        if (b.gain < b.target) b.gain = std::min(b.target, b.gain + dg);
        else if (b.gain > b.target) b.gain = std::max(b.target, b.gain - dg);
        size_t i0 = size_t(b.pos);
        float f = float(b.pos - double(i0));
        float s = (b.s->pcm[i0 % n] * (1 - f) + b.s->pcm[(i0 + 1) % n] * f) / 32768.f;
        float v = s * b.gain * vol;
        out[i * 2] += v;
        out[i * 2 + 1] += v;
        b.pos += step;
        if (b.pos >= double(n)) b.pos -= double(n);
    }
}

void Audio::mix(int16_t* stereo, int frames) {
    acc_.assign(size_t(frames) * 2, 0.f);
    float* out = acc_.data();
    for (auto& v : voices_) {
        if (!v.active) continue;
        const std::vector<int16_t>& pcm = v.s->pcm;
        size_t n = pcm.size();
        for (int i = 0; i < frames; i++) {
            size_t i0 = size_t(v.pos);
            if (i0 + 1 >= n) { v.active = false; break; }
            float f = float(v.pos - double(i0));
            float s = (pcm[i0] * (1 - f) + pcm[i0 + 1] * f) / 32768.f;
            out[i * 2] += s * v.gl;
            out[i * 2 + 1] += s * v.gr;
            v.pos += v.step;
        }
    }
    // a crossfade of a second between the game's music and the radio
    const bool live = radio_on && radio.playing();
    radio_mix_ = std::clamp(radio_mix_ + (live ? 1.f : -1.f) * float(frames) / 48000.f, 0.f, 1.f);
    for (auto& b : music_) mix_bed(b, out, frames, music_volume * (1.f - radio_mix_));
    if (live) radio.mix(out, frames, radio_volume * radio_gain * radio_mix_);
    for (auto& b : amb_) mix_bed(b, out, frames, ambience_volume);
    for (int i = 0; i < frames * 2; i++) {
        float x = out[i] * master;
        x = x / (1.f + std::fabs(x) * 0.35f);  // gentle limiter
        int v = int(x * 32767.f);
        stereo[i] = int16_t(v < -32768 ? -32768 : v > 32767 ? 32767 : v);
    }
}

}  // namespace q
