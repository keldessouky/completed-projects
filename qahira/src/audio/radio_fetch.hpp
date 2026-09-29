// The radio fetches its own episodes: nothing for the player to set up. The stations are listed in the pack
// (data/radio.json); each takes its episodes from the Internet Archive (an item, all its audio or a chosen list),
// a podcast's RSS feed, or plain links. A thread downloads them over Wi-Fi into a folder per station in the saves
// folder, the first episode of every station first, then the rest in order; the radio plays each one as it lands.
// Half-fetched files are ".part" (the radio skips them) and resume where they stopped; without Wi-Fi it tries again
// later, and what it already has plays offline.
//
//   {"stations": [{"name": "Radio Kafr El-Sheikh", "archive": "radiokafrelshikh",
//                  "episodes": [{"n": 2, "title": "The Second", "file": "second.mp3"}, ...]},
//                 {"name": "Nile FM", "rss": "https://example.org/feed.xml"},
//                 {"name": "Other", "episodes": [{"n": 1, "title": "One", "url": "https://..."}]}]}
#pragma once
#include "net/http.hpp"
#include <atomic>
#include <condition_variable>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace q {

struct RadioEpisode {
    int n = 0;                // its place in the show (the file name starts with it, so the radio plays in order)
    std::string title;
    std::string url;
    std::string ext;          // ".mp3", ".ogg" or ".wav"
    std::string file() const; // "12 - The Canal.ogg", safe for the SD card
};

struct RadioStation {
    std::string name;
    std::string archive, rss;               // where the episode list comes from, when it isn't given
    std::vector<RadioEpisode> episodes;     // given, or found
    std::string folder() const;             // the name, safe for the SD card
};

std::vector<RadioStation> parse_stations(const std::string& json);
// the audio in an Internet Archive item's metadata: Ogg where there is one (smaller), else MP3, by track and name
std::vector<RadioEpisode> archive_episodes(const std::string& item, const std::string& metadata_json);
// a podcast feed's episodes, oldest first
std::vector<RadioEpisode> rss_episodes(const std::string& xml);

class RadioFetch {
public:
    ~RadioFetch() { stop(); }
    void start(const std::string& stations_json, const std::string& dir);
    void stop();
    bool running() const { return thread_.joinable() && !done_; }
    uint32_t arrived() const { return arrived_; }   // episodes finished so far (the radio looks again on a change)
    std::string status() const;                     // "Downloading the radio: 3/18", or empty
    void run_once_for_tests(const std::string& stations_json, const std::string& dir);

private:
    bool pass();                                    // one round; true when everything is here
    bool fetch(const RadioStation& st, const RadioEpisode& ep);
    void set_status(const std::string& s);
    std::vector<RadioStation> stations_;
    std::string dir_;
    std::thread thread_;
    std::atomic<bool> quit_{false}, done_{false};
    std::atomic<uint32_t> arrived_{0};
    net::Cancel cancel_;
    mutable std::mutex m_;
    std::condition_variable cv_;
    std::string status_;
};

}  // namespace q
