// The game's radio, in the manner of GTA's stations. Each station is a folder of episodes (MP3, Ogg Vorbis or 16-bit
// WAV) inside the "radio" folder beside the pack, named after it: radio/Radio Kafr El-Sheikh/, radio/Nile FM/, ...
// Episodes lying loose in the radio folder belong to Radio Kafr El-Sheikh, the owner's own show, which always comes
// first. A new station is a new folder: nothing in the game needs to change for it.
// Each episode streams from its file (an hour of it would not fit in memory), resampled to the mixer's 48 kHz. Every
// station keeps its own episode and place in it, so tuning away and back picks up where it was; places() writes them
// out for the settings, keyed by names, so stations and episodes added later don't move anyone's place.
#pragma once
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace q {

class Radio {
public:
    static constexpr const char* kHome = "Radio Kafr El-Sheikh";   // the station of the loose episodes

    Radio();
    ~Radio();
    // finds the stations in these folders (the first that has any): the home station first, the rest by name, each
    // one's episodes in natural order ("Episode 2" before "Episode 10"); returns how many stations
    int scan(const std::vector<std::string>& dirs);
    int stations() const { return int(stations_.size()); }
    std::string station_name(int s) const;
    int station() const { return st_; }
    int episodes() const;             // on every station
    // the station tuned
    int count() const;                // its episodes
    std::string title(int i) const;   // "Episode 3 - The Canal" from "episode_3-the_canal.mp3"
    int current() const { return ep_; }
    double seconds() const;           // how far into the current episode
    bool playing() const { return dec_ != nullptr; }
    // opens an episode of the station tuned at a place in it; false when there is nothing to play
    bool start(int ep, double at_seconds);
    bool resume();                    // the station tuned, at its episode and place
    // to another station, through a burst of static; it picks up where it was left. Plays when play is true.
    void tune(int station, bool play);
    void next_station(int dir = 1) { tune(st_ + dir, true); }
    // the next (or previous) episode on this station, through a burst of static
    void next(int dir = 1);
    void stop();                      // keeps the place
    // adds the radio to an interleaved stereo mix at 48 kHz
    void mix(float* stereo, int frames, float gain);
    uint32_t tuned = 0;               // counts every episode that starts (the HUD shows the station card on a change)

    // every station's place, as lines of text ("tuned\t<station>", "place\t<station>\t<file>\t<seconds>"), and back
    std::string places() const;
    void set_places(const std::string& text);
    void set_place(int station, int ep, double at);

    static bool natural_less(const std::string& a, const std::string& b);
    static std::string clean_title(const std::string& file);

private:
    struct Decoder;
    struct Station {
        std::string name;
        std::vector<std::string> files;
        int ep = 0;                   // where it was left
        double at = 0;
    };
    void keep_place();
    bool refill();
    std::vector<Station> stations_;
    int st_ = 0;
    int ep_ = -1;
    std::unique_ptr<Decoder> dec_;
    std::vector<float> buf_;          // decoded stereo frames at the source rate
    double pos_ = 0;                  // read position in buf_ (frames)
    uint64_t consumed_ = 0;           // source frames played before buf_[0]
    std::vector<float> static_;       // the tuning noise, mono at 48 kHz
    size_t static_pos_ = 0;
};

}  // namespace q
