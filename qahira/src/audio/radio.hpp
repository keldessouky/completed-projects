// Radio Kafr El-Sheikh: the game's radio, in the manner of GTA's stations. It plays the owner's own show, episode
// after episode, from audio files the player puts beside the pack (a "radio" folder: MP3, Ogg Vorbis or 16-bit WAV).
// Each episode streams from its file (an hour of it would not fit in memory), resampled to the mixer's 48 kHz. R3 in
// the field tunes to the next one through a burst of static. The episode and the place in it are kept in the
// settings, so the show goes on where it was left.
#pragma once
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace q {

class Radio {
public:
    Radio();
    ~Radio();
    // finds the episodes in these folders (the first that has any), in natural order ("Episode 2" before "Episode 10")
    int scan(const std::vector<std::string>& dirs);
    int count() const { return int(files_.size()); }
    std::string title(int i) const;   // "Episode 3 - The Canal" from "episode_3-the_canal.mp3"
    int current() const { return ep_; }
    double seconds() const;           // how far into the current episode
    bool playing() const { return dec_ != nullptr; }
    // opens an episode at a place in it; false when there is nothing to play
    bool start(int ep, double at_seconds);
    // tunes to the next (or previous) episode, through a burst of static
    void next(int dir = 1);
    void stop();
    // adds the radio to an interleaved stereo mix at 48 kHz
    void mix(float* stereo, int frames, float gain);
    uint32_t tuned = 0;               // counts every episode that starts (the HUD shows the station card on a change)

    static bool natural_less(const std::string& a, const std::string& b);
    static std::string clean_title(const std::string& file);

private:
    struct Decoder;
    bool refill();
    std::vector<std::string> files_;
    int ep_ = -1;
    std::unique_ptr<Decoder> dec_;
    std::vector<float> buf_;          // decoded stereo frames at the source rate
    double pos_ = 0;                  // read position in buf_ (frames)
    uint64_t consumed_ = 0;           // source frames played before buf_[0]
    std::vector<float> static_;       // the tuning noise, mono at 48 kHz
    size_t static_pos_ = 0;
};

}  // namespace q
