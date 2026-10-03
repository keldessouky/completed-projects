#include "audio/radio.hpp"
#include "core/log.hpp"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <dirent.h>
#include <sys/stat.h>

#include "minimp3_ex.h"
#define STB_VORBIS_HEADER_ONLY
#include "stb_vorbis.c"

namespace q {

namespace {
constexpr int kOutRate = 48000;
constexpr int kChunk = 2048;   // source frames decoded at a time

bool has_ext(const std::string& f, const char* ext) {
    const size_t n = strlen(ext);
    if (f.size() <= n) return false;
    for (size_t i = 0; i < n; i++)
        if (std::tolower((unsigned char)f[f.size() - n + i]) != ext[i]) return false;
    return true;
}

std::string base_name(const std::string& path) {
    const size_t cut = path.find_last_of("/\\");
    return cut == std::string::npos ? path : path.substr(cut + 1);
}
}  // namespace

// One episode's stream: MP3 (minimp3), Ogg Vorbis (stb_vorbis) or 16-bit PCM WAV, read a chunk at a time.
struct Radio::Decoder {
    enum Kind { Mp3, Ogg, Wav } kind = Mp3;
    mp3dec_ex_t mp3{};
    stb_vorbis* ogg = nullptr;
    FILE* wav = nullptr;
    long wav_data = 0;
    uint64_t wav_frames = 0, wav_read = 0;
    int rate = 44100, channels = 2;
    std::vector<int16_t> tmp;

    ~Decoder() {
        if (kind == Mp3) mp3dec_ex_close(&mp3);
        if (ogg) stb_vorbis_close(ogg);
        if (wav) fclose(wav);
    }

    bool open(const std::string& path) {
        if (has_ext(path, ".mp3")) {
            kind = Mp3;
            if (mp3dec_ex_open(&mp3, path.c_str(), MP3D_SEEK_TO_SAMPLE) || !mp3.info.hz || !mp3.info.channels) return false;
            rate = mp3.info.hz;
            channels = mp3.info.channels;
            return true;
        }
        if (has_ext(path, ".ogg")) {
            kind = Ogg;
            int err = 0;
            ogg = stb_vorbis_open_filename(path.c_str(), &err, nullptr);
            if (!ogg) return false;
            stb_vorbis_info i = stb_vorbis_get_info(ogg);
            rate = int(i.sample_rate);
            channels = i.channels;
            return rate > 0 && channels > 0;
        }
        kind = Wav;
        wav = fopen(path.c_str(), "rb");
        if (!wav) return false;
        char riff[12];
        if (fread(riff, 1, 12, wav) != 12 || memcmp(riff, "RIFF", 4) || memcmp(riff + 8, "WAVE", 4)) return false;
        int bits = 0;
        for (;;) {   // the chunks: "fmt " tells the format, "data" holds the samples
            char id[4];
            uint32_t size = 0;
            if (fread(id, 1, 4, wav) != 4 || fread(&size, 4, 1, wav) != 1) return false;
            if (!memcmp(id, "fmt ", 4)) {
                uint8_t f[16] = {};
                if (size < 16 || fread(f, 1, 16, wav) != 16) return false;
                const int format = f[0] | f[1] << 8;
                channels = f[2] | f[3] << 8;
                rate = int(f[4] | f[5] << 8 | f[6] << 16 | uint32_t(f[7]) << 24);
                bits = f[14] | f[15] << 8;
                if (format != 1 || bits != 16) return false;   // 16-bit PCM only
                fseek(wav, long(size - 16 + (size & 1)), SEEK_CUR);
            } else if (!memcmp(id, "data", 4)) {
                wav_data = ftell(wav);
                wav_frames = channels > 0 ? size / (2u * uint32_t(channels)) : 0;
                return bits == 16 && channels > 0 && rate > 0;
            } else {
                fseek(wav, long(size + (size & 1)), SEEK_CUR);
            }
        }
    }

    void seek(uint64_t frame) {
        if (kind == Mp3) mp3dec_ex_seek(&mp3, frame * uint64_t(channels));
        else if (kind == Ogg) stb_vorbis_seek(ogg, unsigned(frame));
        else {
            wav_read = std::min(frame, wav_frames);
            fseek(wav, long(wav_data + long(wav_read) * 2 * channels), SEEK_SET);
        }
    }

    // up to n frames as float stereo appended to out; returns the frames read (0 at the end)
    int read(std::vector<float>& out, int n) {
        tmp.resize(size_t(n) * size_t(channels));
        int frames = 0;
        if (kind == Mp3) frames = int(mp3dec_ex_read(&mp3, tmp.data(), tmp.size()) / size_t(channels));
        else if (kind == Ogg) frames = stb_vorbis_get_samples_short_interleaved(ogg, channels, tmp.data(), int(tmp.size()));
        else {
            const uint64_t left = wav_frames - wav_read;
            const size_t want = size_t(std::min<uint64_t>(uint64_t(n), left));
            frames = int(fread(tmp.data(), size_t(2 * channels), want, wav));
            wav_read += uint64_t(frames);
        }
        for (int i = 0; i < frames; i++) {
            const int16_t* s = &tmp[size_t(i) * size_t(channels)];
            const float l = s[0] / 32768.f, r = channels > 1 ? s[1] / 32768.f : l;
            out.push_back(l);
            out.push_back(r);
        }
        return frames;
    }
};

Radio::Radio() {
    // the tuning noise: hiss that swells and fades, with a whistle sliding down through it
    static_.resize(size_t(kOutRate * 0.45f));
    uint32_t seed = 0x9E3779B9u;
    float lp = 0, ph = 0;
    for (size_t i = 0; i < static_.size(); i++) {
        const float t = float(i) / float(static_.size());
        seed = seed * 1664525u + 1013904223u;
        const float white = float(int32_t(seed >> 8) - (1 << 23)) / float(1 << 23);
        lp += (white - lp) * 0.35f;
        ph += (2600.f - 2000.f * t) / kOutRate;
        const float env = std::sin(t * 3.14159f) * (0.7f + 0.3f * std::sin(t * 60.f));
        static_[i] = (lp * 0.55f + 0.12f * std::sin(ph * 6.2831853f)) * env;
    }
    static_pos_ = static_.size();
}

Radio::~Radio() = default;

bool Radio::natural_less(const std::string& a, const std::string& b) {
    size_t i = 0, j = 0;
    while (i < a.size() && j < b.size()) {
        if (std::isdigit((unsigned char)a[i]) && std::isdigit((unsigned char)b[j])) {
            size_t i2 = i, j2 = j;
            while (i2 < a.size() && a[i2] == '0') i2++;
            while (j2 < b.size() && b[j2] == '0') j2++;
            size_t ie = i2, je = j2;
            while (ie < a.size() && std::isdigit((unsigned char)a[ie])) ie++;
            while (je < b.size() && std::isdigit((unsigned char)b[je])) je++;
            if (ie - i2 != je - j2) return ie - i2 < je - j2;
            const int c = a.compare(i2, ie - i2, b, j2, je - j2);
            if (c) return c < 0;
            i = ie;
            j = je;
            continue;
        }
        const int ca = std::tolower((unsigned char)a[i]), cb = std::tolower((unsigned char)b[j]);
        if (ca != cb) return ca < cb;
        i++;
        j++;
    }
    return a.size() - i < b.size() - j;
}

std::string Radio::clean_title(const std::string& file) {
    std::string s = file.substr(file.find_last_of("/\\") == std::string::npos ? 0 : file.find_last_of("/\\") + 1);
    const size_t dot = s.find_last_of('.');
    if (dot != std::string::npos && dot > 0) s.resize(dot);
    for (char& c : s) if (c == '_') c = ' ';
    // "episode 3-the canal" -> "Episode 3 - the canal"
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        if (s[i] == '-' && i > 0 && s[i - 1] != ' ' && i + 1 < s.size() && s[i + 1] != ' ') { out += " - "; continue; }
        out += s[i];
    }
    if (!out.empty()) out[0] = char(std::toupper((unsigned char)out[0]));
    return out;
}

std::string Radio::station_name(int s) const {
    return s >= 0 && s < stations() ? stations_[size_t(s)].name : std::string();
}

int Radio::episodes() const {
    int n = 0;
    for (const Station& s : stations_) n += int(s.files.size());
    return n;
}

int Radio::count() const { return st_ < stations() ? int(stations_[size_t(st_)].files.size()) : 0; }

std::string Radio::title(int i) const {
    return i >= 0 && i < count() ? clean_title(stations_[size_t(st_)].files[size_t(i)]) : std::string();
}

int Radio::scan(const std::vector<std::string>& dirs) {
    // what plays, and where every station was, carry over: the fetcher adds episodes while the radio plays
    const std::string kept = places();
    const std::string playing = dec_ && st_ < stations() ? stations_[size_t(st_)].files[size_t(ep_)] : std::string();
    const std::string playing_on = station_name(st_);
    stations_.clear();
    st_ = 0;
    ep_ = -1;
    // the episodes in one folder, and the folders beside them
    auto list = [](const std::string& d, std::vector<std::string>& audio, std::vector<std::string>* folders) {
        DIR* dir = opendir(d.c_str());
        if (!dir) return false;
        while (dirent* e = readdir(dir)) {
            const std::string n = e->d_name;
            if (n.empty() || n[0] == '.') continue;   // also the fetch tool's manifest
            if (has_ext(n, ".mp3") || has_ext(n, ".ogg") || has_ext(n, ".wav")) audio.push_back(d + "/" + n);
            else if (folders) {
                struct stat st {};
                if (stat((d + "/" + n).c_str(), &st) == 0 && S_ISDIR(st.st_mode)) folders->push_back(n);
            }
        }
        closedir(dir);
        return true;
    };
    auto add = [&](const std::string& name, std::vector<std::string>& files) {
        if (files.empty()) return;
        auto it = std::find_if(stations_.begin(), stations_.end(), [&](const Station& s) { return s.name == name; });
        if (it == stations_.end()) it = stations_.insert(stations_.end(), Station{name, {}, 0, 0});
        for (const std::string& f : files)   // an episode in two of the folders plays once
            if (std::none_of(it->files.begin(), it->files.end(), [&](const std::string& g) { return base_name(g) == base_name(f); }))
                it->files.push_back(f);
    };
    auto by_file = [](const std::string& a, const std::string& b) { return natural_less(base_name(a), base_name(b)); };
    // every folder: the player's own beside the pack, and what the radio fetched itself
    for (const std::string& d : dirs) {
        std::vector<std::string> loose, folders;
        if (!list(d, loose, &folders)) continue;
        add(kHome, loose);
        std::sort(folders.begin(), folders.end(), natural_less);
        for (const std::string& f : folders) {
            std::vector<std::string> files;
            list(d + "/" + f, files, nullptr);
            add(f, files);
        }
    }
    // the home station first (loose or in its own folder), the rest by name
    std::stable_partition(stations_.begin(), stations_.end(), [](const Station& s) { return s.name == kHome; });
    for (Station& s : stations_) std::sort(s.files.begin(), s.files.end(), by_file);
    apply_places(kept);
    if (dec_) {   // the episode playing goes on, wherever it now sits in the list
        st_ = -1;
        for (int i = 0; i < stations() && st_ < 0; i++)
            if (stations_[size_t(i)].name == playing_on)
                for (size_t k = 0; k < stations_[size_t(i)].files.size(); k++)
                    if (stations_[size_t(i)].files[k] == playing) { st_ = i; ep_ = int(k); break; }
        if (st_ < 0) {   // its file is gone: the radio falls quiet (stop() would keep a place in the old list)
            st_ = 0;
            dec_.reset();
            buf_.clear();
            pos_ = 0;
        }
    }
    if (st_ >= stations()) st_ = 0;
    return stations();
}

double Radio::seconds() const {
    if (!dec_) return 0;
    return (double(consumed_) + pos_) / double(dec_->rate);
}

bool Radio::start(int ep, double at) {
    stop();
    if (!count()) return false;
    const std::vector<std::string>& files = stations_[size_t(st_)].files;
    ep_ = ((ep % count()) + count()) % count();
    auto d = std::make_unique<Decoder>();
    if (!d->open(files[size_t(ep_)])) {
        QLOG("radio: cannot play %s", files[size_t(ep_)].c_str());
        return false;
    }
    const uint64_t frame = at > 0 ? uint64_t(at * d->rate) : 0;
    if (frame) d->seek(frame);
    dec_ = std::move(d);
    buf_.clear();
    pos_ = 0;
    consumed_ = frame;
    tuned++;
    return true;
}

bool Radio::resume() {
    if (!count()) return false;
    const Station& s = stations_[size_t(st_)];
    if (start(s.ep, s.at)) return true;
    next(1);   // the episode it was on will not open: the one after
    return playing();
}

void Radio::tune(int station, bool play) {
    if (stations_.empty()) return;
    keep_place();
    dec_.reset();
    st_ = ((station % stations()) + stations()) % stations();
    ep_ = stations_[size_t(st_)].ep;
    if (!play) return;
    static_pos_ = 0;
    resume();
}

void Radio::next(int dir) {
    if (!count()) return;
    static_pos_ = 0;
    // an episode that will not open is skipped, but not for ever
    for (int k = 1; k <= count(); k++)
        if (start(ep_ + dir * k, 0)) return;
}

void Radio::keep_place() {
    if (!dec_ || st_ >= stations()) return;
    stations_[size_t(st_)].ep = ep_;
    stations_[size_t(st_)].at = seconds();
}

void Radio::stop() {
    keep_place();
    dec_.reset();
    buf_.clear();
    pos_ = 0;
}

void Radio::set_place(int station, int ep, double at) {
    if (station < 0 || station >= stations()) return;
    Station& s = stations_[size_t(station)];
    s.ep = s.files.empty() ? 0 : std::clamp(ep, 0, int(s.files.size()) - 1);
    s.at = std::max(0.0, at);
    if (station == st_ && !dec_) ep_ = s.ep;
}

std::string Radio::places() const {
    std::string out = "tuned\t" + station_name(st_) + "\n";
    for (int i = 0; i < stations(); i++) {
        const Station& s = stations_[size_t(i)];
        const bool live = i == st_ && dec_;
        const int ep = live ? ep_ : s.ep;
        if (ep < 0 || ep >= int(s.files.size())) continue;
        char at[32];
        snprintf(at, sizeof at, "%.0f", live ? seconds() : s.at);
        out += "place\t" + s.name + "\t" + base_name(s.files[size_t(ep)]) + "\t" + at + "\n";
    }
    return out;
}

void Radio::set_places(const std::string& text) {
    stop();
    apply_places(text);
}

void Radio::apply_places(const std::string& text) {
    auto find = [&](const std::string& name) {
        for (int i = 0; i < stations(); i++)
            if (stations_[size_t(i)].name == name) return i;
        return -1;
    };
    size_t p = 0;
    while (p < text.size()) {
        size_t e = text.find('\n', p);
        if (e == std::string::npos) e = text.size();
        std::vector<std::string> f;
        for (size_t a = p;;) {
            const size_t b = text.find('\t', a);
            if (b == std::string::npos || b > e) { f.push_back(text.substr(a, e - a)); break; }
            f.push_back(text.substr(a, b - a));
            a = b + 1;
        }
        p = e + 1;
        const int s = f.size() >= 2 ? find(f[1]) : -1;
        if (s < 0) continue;   // a station that is gone
        if (f[0] == "tuned") {
            st_ = s;
            if (!dec_) ep_ = stations_[size_t(s)].ep;
        } else if (f[0] == "place" && f.size() >= 4) {
            const std::vector<std::string>& files = stations_[size_t(s)].files;
            for (size_t i = 0; i < files.size(); i++)
                if (base_name(files[i]) == f[2]) { set_place(s, int(i), atof(f[3].c_str())); break; }
        }
    }
}

bool Radio::refill() {
    // keep the frame under the read position and the one after it; drop the rest
    const size_t keep_from = size_t(pos_);
    const size_t frames = buf_.size() / 2;
    if (keep_from > 0 && keep_from <= frames) {
        buf_.erase(buf_.begin(), buf_.begin() + ptrdiff_t(keep_from * 2));
        pos_ -= double(keep_from);
        consumed_ += keep_from;
    }
    return dec_->read(buf_, kChunk) > 0;
}

void Radio::mix(float* out, int frames, float gain) {
    for (int i = 0; i < frames && static_pos_ < static_.size(); i++, static_pos_++) {
        out[i * 2] += static_[static_pos_] * gain;
        out[i * 2 + 1] += static_[static_pos_] * gain;
    }
    if (!dec_) return;
    const double step = double(dec_->rate) / kOutRate;
    // the episode comes in under the static as it clears
    const float under = static_pos_ < static_.size() ? 0.35f : 1.f;
    for (int i = 0; i < frames; i++) {
        while (size_t(pos_) + 1 >= buf_.size() / 2) {
            if (!refill()) {   // the episode is over: on to the next, as a station would
                next(1);
                if (!dec_) return;
                mix(out + i * 2, frames - i, gain);
                return;
            }
        }
        const size_t i0 = size_t(pos_);
        const float f = float(pos_ - double(i0));
        const float* a = &buf_[i0 * 2];
        out[i * 2] += (a[0] + (a[2] - a[0]) * f) * gain * under;
        out[i * 2 + 1] += (a[1] + (a[3] - a[1]) * f) * gain * under;
        pos_ += step;
    }
}

}  // namespace q
