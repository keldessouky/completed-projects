// Updating from inside the game (Start → Game → Update): the newest build of the `qahira` branch is the
// qahira-latest release on GitHub, which lists its files in version.json (the commit, the run, each file's size and
// SHA-256). The game compares that commit with its own, and on the player's say-so downloads the RetroArch core and
// the pack beside the ones in use (".part", resumed if cut off), checks both against their SHA-256, and only then
// swaps them in. The running game keeps what it loaded (the pack is in memory, the old core stays mapped); the new
// build starts the next time the game does.
// Where the core in use can't be replaced while RetroArch runs it, the new core goes beside the pack for the player
// to install with RetroArch's own Install or Restore a Core, and the new pack waits beside the old one
// ("Qahira.qpk.next", with its commit in "Qahira.qpk.next.commit"): the new core puts it in place when it starts,
// so an old core never runs a new pack.
#pragma once
#include "net/http.hpp"
#include <atomic>
#include <cstdint>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace q {

struct UpdateFile {
    std::string name, sha256;
    uint64_t size = 0;
};

struct UpdateInfo {
    std::string commit;
    int run = 0;
    std::vector<UpdateFile> files;
    const UpdateFile* file(const std::string& name) const;
};

bool parse_update_info(const std::string& json, UpdateInfo& out);
std::string sha256_file(const std::string& path);   // lowercase hex, empty if unreadable

class Updater {
public:
    enum class State { Idle, Checking, UpToDate, Available, Downloading, Installed, Failed, Unsupported,
                       NeedsCore };   // downloaded; the player installs the core beside the pack (manual_core())
    struct Config {
        std::string base_url;     // where version.json and the files are
        std::string core_asset;   // the core's name in the release (empty: this platform isn't updated this way)
        std::string core_path;    // the core in use, and the pack in use: what the update replaces
        std::string pack_path;
        std::string commit;       // this build's
        int run = 0;
    };
    static Config defaults(const std::string& core_path, const std::string& pack_path);
    // at start, before the pack is read: a pack waiting for this build's core goes in place (and the core copy left
    // beside it for the player is deleted); true when it did
    static bool apply_staged(const std::string& pack_path, const std::string& commit, const std::string& core_asset);

    ~Updater() { stop(); }
    void configure(const Config& c);
    void check();                 // in the background: is there a newer build?
    void install();               // in the background: download, check and swap in the newer build
    void stop();                  // what was downloading stays, to go on from next time
    State state() const { return state_; }
    int available_run() const;
    std::string text() const;     // the Update row: what it is doing, or what South will do
    std::string build() const;    // "Build 47 (8440256)"
    std::string manual_core() const;   // NeedsCore: the new core, for Install or Restore a Core
    bool check_now();             // the same, on this thread (the tests)
    bool install_now();

private:
    bool fetch(const UpdateFile& f, const std::string& target, uint64_t done, uint64_t total);
    void fail(const std::string& why);
    void run(bool install);
    Config cfg_;
    UpdateInfo info_;
    std::atomic<State> state_{State::Idle};
    std::atomic<float> progress_{0};
    mutable std::mutex m_;
    std::string error_;
    std::string manual_;
    std::thread thread_;
    net::Cancel cancel_;
};

Updater& updater();

}  // namespace q
