#include "game/updater.hpp"
#include "core/json.hpp"
#include "core/log.hpp"
#include <cstdio>
#include <cstdlib>
#include <sys/stat.h>
#include <sys/statvfs.h>

#include "mbedtls/sha256.h"

#ifndef QAHIRA_COMMIT
#define QAHIRA_COMMIT "dev"
#endif
#ifndef QAHIRA_RUN
#define QAHIRA_RUN 0
#endif

namespace q {

namespace {

uint64_t file_size(const std::string& p) {
    struct stat st {};
    return stat(p.c_str(), &st) == 0 ? uint64_t(st.st_size) : 0;
}

std::string dir_of(const std::string& p) {
    const size_t cut = p.find_last_of('/');
    return cut == std::string::npos ? std::string(".") : p.substr(0, cut);
}

std::string mb(uint64_t bytes) { return std::to_string((bytes + 500000) / 1000000) + " MB"; }

}  // namespace

const UpdateFile* UpdateInfo::file(const std::string& name) const {
    for (const UpdateFile& f : files)
        if (f.name == name) return &f;
    return nullptr;
}

bool parse_update_info(const std::string& text, UpdateInfo& out) {
    const Json j = Json::parse(text);
    out = UpdateInfo{};
    out.commit = j["commit"].str_or("");
    out.run = j["run"].i(0);
    const Json& fs = j["files"];
    for (size_t i = 0; i < fs.size(); i++) {
        UpdateFile f;
        f.name = fs[i]["name"].str_or("");
        f.sha256 = fs[i]["sha256"].str_or("");
        f.size = uint64_t(fs[i]["size"].n);
        if (!f.name.empty() && f.sha256.size() == 64 && f.size) out.files.push_back(f);
    }
    return !out.commit.empty() && !out.files.empty();
}

std::string sha256_file(const std::string& path) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) return "";
    mbedtls_sha256_context c;
    mbedtls_sha256_init(&c);
    mbedtls_sha256_starts(&c, 0);
    static thread_local unsigned char buf[1 << 16];
    for (size_t n; (n = fread(buf, 1, sizeof buf, f)) > 0;) mbedtls_sha256_update(&c, buf, n);
    fclose(f);
    unsigned char h[32];
    mbedtls_sha256_finish(&c, h);
    mbedtls_sha256_free(&c);
    static const char* hex = "0123456789abcdef";
    std::string out;
    for (unsigned char b : h) { out += hex[b >> 4]; out += hex[b & 15]; }
    return out;
}

Updater::Config Updater::defaults(const std::string& core_path, const std::string& pack_path) {
    Config c;
    c.base_url = "https://github.com/keldessouky/completed-projects/releases/download/qahira-latest";
#ifdef __ANDROID__
    c.core_asset = "qahira_libretro_android.so";
#endif
    if (const char* b = getenv("QAHIRA_UPDATE_BASE")) c.base_url = b;           // a test release
    if (const char* a = getenv("QAHIRA_UPDATE_CORE_ASSET")) c.core_asset = a;
    c.core_path = core_path;
    c.pack_path = pack_path;
    c.commit = QAHIRA_COMMIT;
    c.run = QAHIRA_RUN;
    return c;
}

void Updater::configure(const Config& c) {
    stop();
    cfg_ = c;
    state_ = cfg_.core_asset.empty() || cfg_.core_path.empty() || cfg_.pack_path.empty() ? State::Unsupported : State::Idle;
}

int Updater::available_run() const {
    std::lock_guard<std::mutex> l(m_);
    return info_.run;
}

std::string Updater::build() const {
    return "Build " + (cfg_.run ? std::to_string(cfg_.run) : std::string("dev")) + " (" + cfg_.commit.substr(0, 7) + ")";
}

std::string Updater::text() const {
    std::lock_guard<std::mutex> l(m_);
    uint64_t total = 0;
    for (const UpdateFile& f : info_.files) total += f.size;
    switch (state_.load()) {
        case State::Idle: return "Check for updates";
        case State::Checking: return "Checking for updates...";
        case State::UpToDate: return "Up to date: build " + std::to_string(cfg_.run ? cfg_.run : info_.run);
        case State::Available: return "Download the update: build " + std::to_string(info_.run) + ", " + mb(total);
        case State::Downloading: return "Downloading the update: " + std::to_string(int(progress_ * 100)) + "%";
        case State::Installed: return "Installed. Exit and start the game again";
        case State::Failed: return "Update failed: " + error_;
        case State::Unsupported: return "Updates are for the RP6's core";
    }
    return "";
}

void Updater::fail(const std::string& why) {
    QLOG("update: %s", why.c_str());
    {
        std::lock_guard<std::mutex> l(m_);
        error_ = why;
    }
    state_ = State::Failed;
}

bool Updater::check_now() {
    if (state_ == State::Unsupported) return false;
    state_ = State::Checking;
    std::string text, err;
    if (!net::get_text(cfg_.base_url + "/version.json", text, &cancel_, &err, 1 << 20)) {
        fail(err.empty() ? "no answer" : err);
        return false;
    }
    UpdateInfo info;
    if (!parse_update_info(text, info) || !info.file(cfg_.core_asset) || !info.file("Qahira.qpk")) {
        fail("the release lists no build for this device");
        return false;
    }
    {
        std::lock_guard<std::mutex> l(m_);
        info_ = info;
    }
    state_ = info.commit == cfg_.commit ? State::UpToDate : State::Available;
    QLOG("update: this build %s, the release %s (run %d)", cfg_.commit.c_str(), info.commit.c_str(), info.run);
    return true;
}

bool Updater::fetch(const UpdateFile& f, const std::string& target, uint64_t done, uint64_t total) {
    const std::string part = target + ".part";
    uint64_t from = file_size(part);
    if (from > f.size) { remove(part.c_str()); from = 0; }
    FILE* out = fopen(part.c_str(), from ? "ab" : "wb");
    if (!out) { fail("can't write beside " + target); return false; }
    uint64_t got = from;
    bool wrote = true;
    net::Result r;
    if (from < f.size) {
        r = net::get(cfg_.base_url + "/" + f.name, [&](const char* b, size_t n) {
            wrote = out && fwrite(b, 1, n, out) == n;
            got += n;
            progress_ = float(double(done + got) / double(std::max<uint64_t>(1, total)));
            return wrote;
        }, from, &cancel_, [&](const net::Result& head) {
            if (from && !head.resumed) { out = freopen(part.c_str(), "wb", out); got = 0; }
        });
    } else {
        r.status = 206;
        r.complete = true;
    }
    if (out) fclose(out);
    if (cancel_.stop) return false;
    if (!wrote) { fail("the card is full"); return false; }
    if (!r.ok()) { fail(f.name + ": " + r.error); return false; }
    if (file_size(part) != f.size || sha256_file(part) != f.sha256) {
        remove(part.c_str());   // damaged: the next try starts over
        fail(f.name + " came damaged; try again");
        return false;
    }
    return true;
}

bool Updater::install_now() {
    if (state_ != State::Available && !check_now()) return false;
    if (state_ != State::Available) return state_ == State::UpToDate;
    UpdateInfo info;
    {
        std::lock_guard<std::mutex> l(m_);
        info = info_;
    }
    const UpdateFile& core = *info.file(cfg_.core_asset);
    const UpdateFile& pack = *info.file("Qahira.qpk");
    // room for both beside the ones in use
    for (const auto& [f, target] : {std::pair{&core, cfg_.core_path}, std::pair{&pack, cfg_.pack_path}}) {
        struct statvfs vs {};
        const uint64_t need = f->size - std::min(f->size, file_size(target + ".part"));
        if (statvfs(dir_of(target).c_str(), &vs) == 0 && uint64_t(vs.f_bavail) * vs.f_frsize < need + (8u << 20)) {
            fail("not enough space: it needs " + mb(need));
            return false;
        }
    }
    state_ = State::Downloading;
    progress_ = 0;
    const uint64_t total = core.size + pack.size;
    if (!fetch(core, cfg_.core_path, 0, total) || !fetch(pack, cfg_.pack_path, core.size, total)) {
        if (cancel_.stop) state_ = State::Available;
        return false;
    }
    // both here and sound: the core first (the old one kept until the pack is in), then the pack
    const std::string old = cfg_.core_path + ".old";
    remove(old.c_str());
    if (rename(cfg_.core_path.c_str(), old.c_str()) != 0 || rename((cfg_.core_path + ".part").c_str(), cfg_.core_path.c_str()) != 0) {
        rename(old.c_str(), cfg_.core_path.c_str());
        fail("can't replace the core in " + dir_of(cfg_.core_path));
        return false;
    }
    if (rename((cfg_.pack_path + ".part").c_str(), cfg_.pack_path.c_str()) != 0) {
        rename(cfg_.core_path.c_str(), (cfg_.core_path + ".part").c_str());   // the new core waits for its pack
        rename(old.c_str(), cfg_.core_path.c_str());
        fail("can't replace the pack in " + dir_of(cfg_.pack_path));
        return false;
    }
    remove(old.c_str());
    progress_ = 1;
    state_ = State::Installed;
    QLOG("update: installed run %d (%s)", info.run, info.commit.c_str());
    return true;
}

void Updater::run(bool install) {
    stop();
    if (state_ == State::Unsupported || state_ == State::Downloading || state_ == State::Checking) return;
    cancel_.stop = false;
    if (install) state_ = State::Downloading;   // at once, so the row doesn't offer it twice
    else state_ = State::Checking;
    thread_ = std::thread([this, install] {
        if (install) {
            state_ = State::Available;
            install_now();
        } else {
            check_now();
        }
    });
}

void Updater::check() { run(false); }

void Updater::install() {
    if (state_ != State::Available) return;
    run(true);
}

void Updater::stop() {
    if (!thread_.joinable()) return;
    cancel_.abort();
    thread_.join();
    cancel_.stop = false;
}

Updater& updater() {
    static Updater u;
    return u;
}

}  // namespace q
