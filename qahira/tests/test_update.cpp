// The in-game update: version.json read, a newer build found, both files downloaded (from files here), checked
// against their SHA-256 and swapped in; a damaged download swaps nothing; a cut-off one goes on.
#include "tests/check.hpp"
#include "game/updater.hpp"
#include <cstdio>
#include <string>
#include <sys/stat.h>
#include <unistd.h>

using namespace q;

namespace {
const std::string kDir = std::string(QAHIRA_SOURCE_DIR) + "/build/update_test";

void put(const std::string& path, const std::string& text) {
    FILE* f = fopen(path.c_str(), "wb");
    fwrite(text.data(), 1, text.size(), f);
    fclose(f);
}
std::string get(const std::string& path) {
    std::string s;
    if (FILE* f = fopen(path.c_str(), "rb")) {
        char b[256];
        for (size_t n; (n = fread(b, 1, sizeof b, f)) > 0;) s.append(b, n);
        fclose(f);
    }
    return s;
}
bool exists(const std::string& p) { struct stat st {}; return stat(p.c_str(), &st) == 0; }

// a release with a new core and pack, and a game with the old ones
Updater::Config setup(const std::string& pack_sha = "") {
    mkdir(kDir.c_str(), 0755);
    mkdir((kDir + "/release").c_str(), 0755);
    mkdir((kDir + "/game").c_str(), 0755);
    for (const char* f : {"/game/core.so.part", "/game/Qahira.qpk.part", "/game/core.so.old"}) remove((kDir + f).c_str());
    put(kDir + "/release/core.so", "NEW CORE");
    put(kDir + "/release/Qahira.qpk", "NEW PACK, A LITTLE LONGER");
    put(kDir + "/game/core.so", "OLD CORE");
    put(kDir + "/game/Qahira.qpk", "OLD PACK");
    const std::string core_sha = sha256_file(kDir + "/release/core.so");
    const std::string p_sha = pack_sha.empty() ? sha256_file(kDir + "/release/Qahira.qpk") : pack_sha;
    put(kDir + "/release/version.json", R"({"commit": "new", "run": 52, "files": [
        {"name": "core.so", "size": 8, "sha256": ")" + core_sha + R"("},
        {"name": "Qahira.qpk", "size": 25, "sha256": ")" + p_sha + R"("}]})");
    Updater::Config c;
    c.base_url = "file://" + kDir + "/release";
    c.core_asset = "core.so";
    c.core_path = kDir + "/game/core.so";
    c.pack_path = kDir + "/game/Qahira.qpk";
    c.commit = "old";
    c.run = 51;
    return c;
}
}  // namespace

TEST(the_update_reads_the_release) {
    UpdateInfo u;
    CHECK(parse_update_info(R"({"commit": "abc", "run": 7, "files": [{"name": "a", "size": 3,
        "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}, {"name": "bad", "size": 1, "sha256": "x"}]})", u));
    CHECK(u.commit == "abc" && u.run == 7 && u.files.size() == 1 && u.file("a") && !u.file("bad"));
    CHECK(!parse_update_info("{}", u));
    put(std::string(QAHIRA_SOURCE_DIR) + "/build/abc.txt", "abc");
    CHECK(sha256_file(std::string(QAHIRA_SOURCE_DIR) + "/build/abc.txt") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/abc.txt").c_str());
}

TEST(the_update_installs_a_newer_build) {
    Updater up;
    up.configure(setup());
    CHECK(up.state() == Updater::State::Idle && up.build() == "Build 51 (old)");
    CHECK(up.check_now() && up.state() == Updater::State::Available && up.available_run() == 52);
    CHECK(up.text() == "Download the update: build 52, 0 MB");
    // a download that was cut off: it goes on from there
    put(kDir + "/game/core.so.part", "NEW");
    CHECK(up.install_now() && up.state() == Updater::State::Installed);
    CHECK(get(kDir + "/game/core.so") == "NEW CORE" && get(kDir + "/game/Qahira.qpk") == "NEW PACK, A LITTLE LONGER");
    CHECK(!exists(kDir + "/game/core.so.part") && !exists(kDir + "/game/Qahira.qpk.part") && !exists(kDir + "/game/core.so.old"));
    // the same build: nothing to do
    Updater::Config same = setup();
    same.commit = "new";
    up.configure(same);
    CHECK(up.check_now() && up.state() == Updater::State::UpToDate);
}

TEST(a_damaged_update_changes_nothing) {
    Updater up;
    up.configure(setup(std::string(64, 'a')));   // the pack's SHA-256 won't match
    CHECK(!up.install_now() && up.state() == Updater::State::Failed);
    CHECK(up.text().rfind("Update failed: Qahira.qpk came damaged", 0) == 0);
    CHECK(get(kDir + "/game/core.so") == "OLD CORE" && get(kDir + "/game/Qahira.qpk") == "OLD PACK");
    CHECK(!exists(kDir + "/game/Qahira.qpk.part") && !exists(kDir + "/game/core.so.old"));
    // no release there at all
    Updater::Config none = setup();
    none.base_url = "file://" + kDir + "/nowhere";
    up.configure(none);
    CHECK(!up.check_now() && up.state() == Updater::State::Failed);
    // not a core (the dev host): no updates this way
    Updater::Config host = setup();
    host.core_asset.clear();
    up.configure(host);
    CHECK(up.state() == Updater::State::Unsupported && !up.check_now());
}

// RetroArch won't let the core it runs be replaced (here: a folder where the core would go): the new core goes beside
// the pack for Install or Restore a Core, and the pack waits for it as Qahira.qpk.next
Updater::Config setup_locked(const std::string& core_dir) {
    Updater::Config c = setup();
    const std::string roms = kDir + "/roms";
    mkdir(roms.c_str(), 0755);
    for (const char* f : {"/roms/core.so", "/roms/core.so.part", "/roms/Qahira.qpk.part", "/roms/Qahira.qpk.next",
                          "/roms/Qahira.qpk.next.commit"})
        remove((kDir + f).c_str());
    put(roms + "/Qahira.qpk", "OLD PACK");
    c.pack_path = roms + "/Qahira.qpk";
    c.core_path = core_dir + "/core.so";
    return c;
}

TEST(an_update_that_cant_replace_the_running_core_leaves_it_to_retroarch) {
    const std::string cores = kDir + "/cores";
    mkdir(cores.c_str(), 0755);
    mkdir((cores + "/core.so").c_str(), 0755);   // can't be renamed over
    put(cores + "/core.so/keep", "x");
    remove((cores + "/core.so.part").c_str());
    Updater up;
    up.configure(setup_locked(cores));
    CHECK(up.install_now() && up.state() == Updater::State::NeedsCore);
    CHECK(up.text() == "Downloaded: one step left, below" && up.manual_core() == kDir + "/roms/core.so");
    CHECK(get(kDir + "/roms/core.so") == "NEW CORE" && !exists(cores + "/core.so.part"));
    CHECK(get(kDir + "/roms/Qahira.qpk") == "OLD PACK");   // the old core goes on with its own pack
    CHECK(get(kDir + "/roms/Qahira.qpk.next") == "NEW PACK, A LITTLE LONGER" && get(kDir + "/roms/Qahira.qpk.next.commit") == "new");
    // asked again, it knows: nothing to download
    Updater again;
    again.configure(setup_locked(cores));
    put(kDir + "/roms/core.so", "NEW CORE");
    put(kDir + "/roms/Qahira.qpk.next", "NEW PACK, A LITTLE LONGER");
    put(kDir + "/roms/Qahira.qpk.next.commit", "new");
    CHECK(again.check_now() && again.state() == Updater::State::NeedsCore && again.manual_core() == kDir + "/roms/core.so");
    // the old core starting again leaves the pack waiting; the new one puts it in place and tidies up
    CHECK(!Updater::apply_staged(kDir + "/roms/Qahira.qpk", "old", "core.so") && get(kDir + "/roms/Qahira.qpk") == "OLD PACK");
    CHECK(Updater::apply_staged(kDir + "/roms/Qahira.qpk", "new", "core.so"));
    CHECK(get(kDir + "/roms/Qahira.qpk") == "NEW PACK, A LITTLE LONGER" && !exists(kDir + "/roms/Qahira.qpk.next"));
    CHECK(!exists(kDir + "/roms/Qahira.qpk.next.commit") && !exists(kDir + "/roms/core.so"));
    CHECK(!Updater::apply_staged(kDir + "/roms/Qahira.qpk", "new", "core.so"));   // nothing waiting
    remove((cores + "/core.so/keep").c_str());
    rmdir((cores + "/core.so").c_str());
}

TEST(an_update_downloads_the_core_beside_the_pack_when_the_cores_folder_is_shut) {
    Updater up;
    up.configure(setup_locked(kDir + "/no_such_folder"));
    CHECK(up.install_now() && up.state() == Updater::State::NeedsCore);
    CHECK(get(kDir + "/roms/core.so") == "NEW CORE" && !exists(kDir + "/roms/core.so.part"));
    CHECK(get(kDir + "/roms/Qahira.qpk.next.commit") == "new" && get(kDir + "/roms/Qahira.qpk") == "OLD PACK");
}

#include "game/menu.hpp"
#include <chrono>
#include <thread>

TEST(the_update_runs_in_the_background) {
    Updater up;
    up.configure(setup());
    up.check();
    for (int i = 0; i < 200 && (up.state() == Updater::State::Checking || up.state() == Updater::State::Idle); i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    CHECK(up.state() == Updater::State::Available);
    up.install();
    for (int i = 0; i < 300 && up.state() != Updater::State::Installed && up.state() != Updater::State::Failed; i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    CHECK(up.state() == Updater::State::Installed && get(kDir + "/game/core.so") == "NEW CORE");
    up.stop();
}

TEST(the_game_tab_asks_twice_before_quitting) {
    World w;
    w.actors.resize(1);
    Menu m;
    m.show(w, false);
    m.tab = MenuTab::Game;
    auto press = [&](Btn b) {
        Input in;
        in.down = 1u << b;
        in.update_edges(0);
        m.update(w, in, 1.f / 60);
        Input up;   // and let go, so the next press is a press
        up.update_edges(in.down);
        m.update(w, up, 1.f / 60);
    };
    press(BTN_DOWN);
    press(BTN_DOWN);
    CHECK(m.game_cursor == GAME_TITLE);
    press(BTN_SOUTH);
    CHECK(m.game_armed == GAME_TITLE && m.request == Menu::Request::None && m.open);
    press(BTN_DOWN);   // moving on disarms it
    CHECK(m.game_cursor == GAME_EXIT && m.game_armed == -1);
    press(BTN_SOUTH);
    press(BTN_SOUTH);
    CHECK(m.request == Menu::Request::Exit);
    m.show(w, false);
    CHECK(m.request == Menu::Request::None);
    m.tab = MenuTab::Game;
    m.game_cursor = GAME_RESUME;
    press(BTN_SOUTH);
    CHECK(!m.open);
}
