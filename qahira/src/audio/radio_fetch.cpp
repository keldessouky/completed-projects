#include "audio/radio_fetch.hpp"
#include "audio/radio.hpp"
#include "core/json.hpp"
#include "core/log.hpp"
#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <sys/stat.h>

namespace q {

namespace {

bool exists(const std::string& p) {
    struct stat st {};
    return stat(p.c_str(), &st) == 0;
}

uint64_t file_size(const std::string& p) {
    struct stat st {};
    return stat(p.c_str(), &st) == 0 ? uint64_t(st.st_size) : 0;
}

// a name the SD card takes: Android's and Windows' file systems refuse <>:"/\|?* and control characters
std::string safe(const std::string& s) {
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        const unsigned char c = (unsigned char)s[i];
        if (c == ':') { out += " - "; continue; }
        if (c < 32 || strchr("<>\"/\\|?*", c)) { out += ' '; continue; }
        out += char(c);
    }
    std::string t;   // spaces run together, and none (nor dots) at the ends
    for (char c : out) if (!(c == ' ' && (t.empty() || t.back() == ' '))) t += c;
    while (!t.empty() && (t.back() == ' ' || t.back() == '.' || t.back() == '-')) t.pop_back();
    return t;
}

std::string ext_of(const std::string& name) {
    std::string n = name.substr(0, name.find_first_of("?#"));
    const size_t dot = n.find_last_of('.'), slash = n.find_last_of('/');
    if (dot == std::string::npos || (slash != std::string::npos && dot < slash)) return "";
    std::string e = n.substr(dot);
    for (char& c : e) c = char(std::tolower((unsigned char)c));
    return e;
}

bool playable(const std::string& ext) { return ext == ".mp3" || ext == ".ogg" || ext == ".wav"; }

std::string xml_text(std::string s) {
    size_t a = s.find("<![CDATA[");
    if (a != std::string::npos) {
        const size_t b = s.find("]]>", a);
        return s.substr(a + 9, b == std::string::npos ? std::string::npos : b - a - 9);
    }
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        if (s[i] != '&') { out += s[i]; continue; }
        const size_t semi = s.find(';', i);
        if (semi == std::string::npos || semi - i > 10) { out += s[i]; continue; }
        const std::string e = s.substr(i + 1, semi - i - 1);
        uint32_t cp = 0;
        if (e == "amp") cp = '&';
        else if (e == "lt") cp = '<';
        else if (e == "gt") cp = '>';
        else if (e == "quot") cp = '"';
        else if (e == "apos") cp = '\'';
        else if (!e.empty() && e[0] == '#') cp = uint32_t(e.size() > 1 && (e[1] == 'x' || e[1] == 'X') ? strtoul(e.c_str() + 2, nullptr, 16)
                                                                                                    : strtoul(e.c_str() + 1, nullptr, 10));
        if (!cp) { out += s[i]; continue; }
        if (cp < 0x80) out += char(cp);   // as UTF-8
        else if (cp < 0x800) { out += char(0xC0 | cp >> 6); out += char(0x80 | (cp & 63)); }
        else if (cp < 0x10000) { out += char(0xE0 | cp >> 12); out += char(0x80 | (cp >> 6 & 63)); out += char(0x80 | (cp & 63)); }
        else { out += char(0xF0 | cp >> 18); out += char(0x80 | (cp >> 12 & 63)); out += char(0x80 | (cp >> 6 & 63)); out += char(0x80 | (cp & 63)); }
        i = semi;
    }
    return out;
}

std::string attr(const std::string& tag, const char* name) {
    const std::string k = std::string(name) + "=";
    size_t a = tag.find(" " + k);
    if (a == std::string::npos) return "";
    a += k.size() + 1;
    if (a >= tag.size()) return "";
    const char q = tag[a];
    if (q != '"' && q != '\'') return "";
    const size_t b = tag.find(q, a + 1);
    return b == std::string::npos ? "" : xml_text(tag.substr(a + 1, b - a - 1));
}

}  // namespace

std::string RadioEpisode::file() const {
    const std::string t = safe(title).empty() ? std::string("Episode") : safe(title);
    return (n > 0 ? std::to_string(n) + " - " : std::string()) + t + ext;
}

std::string RadioStation::folder() const { return safe(name).empty() ? std::string("Station") : safe(name); }

std::vector<RadioStation> parse_stations(const std::string& text) {
    std::vector<RadioStation> out;
    const Json j = Json::parse(text);
    const Json& list = j["stations"];
    for (size_t i = 0; i < list.size(); i++) {
        const Json& s = list[i];
        RadioStation st;
        st.name = s["name"].str_or(Radio::kHome);
        st.archive = s["archive"].str_or("");
        st.rss = s["rss"].str_or("");
        const Json& eps = s["episodes"];
        for (size_t k = 0; k < eps.size(); k++) {
            const Json& e = eps[k];
            RadioEpisode ep;
            ep.n = e["n"].i(0);
            const std::string file = e["file"].str_or("");
            ep.url = e["url"].str_or("");
            if (ep.url.empty() && !file.empty() && !st.archive.empty())
                ep.url = "https://archive.org/download/" + st.archive + "/" + net::encode_path(file);
            ep.ext = ext_of(file.empty() ? ep.url : file);
            ep.title = e["title"].str_or(file.empty() ? "" : file.substr(0, file.size() - ep.ext.size()).c_str());
            if (!ep.url.empty() && playable(ep.ext)) st.episodes.push_back(ep);
        }
        out.push_back(st);
    }
    return out;
}

std::vector<RadioEpisode> archive_episodes(const std::string& item, const std::string& metadata) {
    struct F { std::string base, name, ext; int track; };
    std::vector<F> files;
    const Json j = Json::parse(metadata);
    const Json& fs = j["files"];
    for (size_t i = 0; i < fs.size(); i++) {
        const std::string name = fs[i]["name"].str_or("");
        const std::string ext = ext_of(name);
        if (ext != ".mp3" && ext != ".ogg") continue;
        const std::string base = name.substr(0, name.size() - ext.size());
        const Json& tr = fs[i]["track"];
        const int track = tr.type == Json::String ? atoi(tr.str().c_str()) : tr.i(0);
        auto it = std::find_if(files.begin(), files.end(), [&](const F& f) { return f.base == base; });
        if (it == files.end()) files.push_back({base, name, ext, track});
        else {
            if (ext == ".ogg") { it->name = name; it->ext = ext; }   // the smaller of the two
            if (track) it->track = track;
        }
    }
    std::sort(files.begin(), files.end(), [](const F& a, const F& b) {
        if ((a.track > 0) != (b.track > 0)) return a.track > 0;
        if (a.track != b.track) return a.track < b.track;
        return Radio::natural_less(a.base, b.base);
    });
    std::vector<RadioEpisode> out;
    for (const F& f : files)
        out.push_back({int(out.size()) + 1, f.base, "https://archive.org/download/" + item + "/" + net::encode_path(f.name), f.ext});
    return out;
}

std::vector<RadioEpisode> rss_episodes(const std::string& xml) {
    std::vector<RadioEpisode> out;
    size_t p = 0;
    for (;;) {
        const size_t a = xml.find("<item", p);
        if (a == std::string::npos) break;
        const size_t b = xml.find("</item>", a);
        if (b == std::string::npos) break;
        const std::string item = xml.substr(a, b - a);
        p = b + 7;
        RadioEpisode ep;
        if (size_t t = item.find("<title"); t != std::string::npos) {
            t = item.find('>', t);
            const size_t te = item.find("</title>", t);
            if (t != std::string::npos && te != std::string::npos) ep.title = xml_text(item.substr(t + 1, te - t - 1));
        }
        const size_t e = item.find("<enclosure");
        if (e == std::string::npos) continue;
        const std::string tag = item.substr(e, item.find('>', e) - e);
        ep.url = attr(tag, "url");
        const std::string type = attr(tag, "type");
        ep.ext = type == "audio/mpeg" || type == "audio/mp3" ? ".mp3"
                 : type == "audio/ogg" || type == "audio/vorbis" ? ".ogg"
                 : type == "audio/wav" || type == "audio/x-wav" ? ".wav" : ext_of(ep.url);
        if (!ep.url.empty() && playable(ep.ext)) out.push_back(ep);
    }
    std::reverse(out.begin(), out.end());   // feeds put the newest first; a show starts at its beginning
    for (size_t i = 0; i < out.size(); i++) out[i].n = int(i) + 1;
    return out;
}

void RadioFetch::note(const std::string& what, bool error) {
    QLOG("radio: %s", what.c_str());
    if (error) {
        std::lock_guard<std::mutex> l(m_);
        error_ = what;
    }
    // and in "radio log.txt" in the radio folder, for a player to read in the Files app (kept under 64 KB)
    mkdir(dir_.c_str(), 0755);
    const std::string log = dir_ + "/radio log.txt";
    FILE* f = fopen(log.c_str(), file_size(log) > 65536 ? "w" : "a");
    if (!f) return;
    char when[32];
    const time_t t = time(nullptr);
    strftime(when, sizeof when, "%Y-%m-%d %H:%M:%S", localtime(&t));
    fprintf(f, "%s  %s\n", when, what.c_str());
    fclose(f);
}

void RadioFetch::set_status(const std::string& s) {
    std::lock_guard<std::mutex> l(m_);
    status_ = s;
}

std::string RadioFetch::status() const {
    std::lock_guard<std::mutex> l(m_);
    return status_;
}

bool RadioFetch::fetch(const RadioStation& st, const RadioEpisode& ep) {
    const std::string folder = dir_ + "/" + st.folder();
    mkdir(dir_.c_str(), 0755);
    mkdir(folder.c_str(), 0755);
    const std::string path = folder + "/" + ep.file(), part = path + ".part";
    uint64_t from = file_size(part);
    FILE* f = fopen(part.c_str(), from ? "ab" : "wb");
    if (!f) { note("cannot write " + part); return false; }
    bool wrote = true;
    net::Result r = net::get(ep.url, [&](const char* b, size_t n) {
        wrote = f && fwrite(b, 1, n, f) == n;
        return wrote && !quit_;
    }, from, &cancel_, [&](const net::Result& head) {
        if (from && !head.resumed) f = freopen(part.c_str(), "wb", f);   // the server starts over: so does the file
    });
    if (f) fclose(f);
    if (r.status == 416 && from) {   // it had all of it already
        r.complete = true;
        r.status = 206;
    }
    if (!r.ok() || !wrote) {
        if (!quit_) note(ep.file() + ": " + (wrote ? r.error : std::string("the card is full")));
        return false;
    }
    if (rename(part.c_str(), path.c_str()) != 0) { note("cannot rename " + part); return false; }
    note(st.name + " / " + ep.file() + " is here", false);
    arrived_++;
    return true;
}

bool RadioFetch::pass() {
    {
        std::lock_guard<std::mutex> l(m_);
        error_.clear();
    }
    // the episode lists that come from the Internet Archive or a feed, once per run
    bool listed = true;
    for (RadioStation& st : stations_) {
        if (!st.episodes.empty() || quit_) continue;
        std::string text, err;
        if (!st.archive.empty() && net::get_text("https://archive.org/metadata/" + st.archive, text, &cancel_, &err))
            st.episodes = archive_episodes(st.archive, text);
        else if (!st.rss.empty() && net::get_text(st.rss, text, &cancel_, &err))
            st.episodes = rss_episodes(text);
        if (st.episodes.empty()) {
            listed = false;
            note(st.name + ": " + (err.empty() ? std::string("no episodes it can play") : err));
        }
    }
    // what is missing: every station's first missing episode, then the rest in order
    struct Todo { const RadioStation* st; const RadioEpisode* ep; };
    std::vector<Todo> first, rest;
    int total = 0, have = 0;
    for (const RadioStation& st : stations_) {
        bool any = false;
        for (const RadioEpisode& ep : st.episodes) {
            total++;
            if (exists(dir_ + "/" + st.folder() + "/" + ep.file())) { have++; continue; }
            (any ? rest : first).push_back({&st, &ep});
            any = true;
        }
    }
    first.insert(first.end(), rest.begin(), rest.end());
    bool all = true;
    for (const Todo& t : first) {
        if (quit_) return false;
        set_status("Downloading the radio: " + std::to_string(have + 1) + "/" + std::to_string(total));
        if (fetch(*t.st, *t.ep)) have++;
        else {
            all = false;
            if (!exists(dir_)) break;   // nowhere to write
            std::lock_guard<std::mutex> l(m_);   // no network: the others would fail the same way
            if (error_.find("cannot find") != std::string::npos || error_.find("cannot connect") != std::string::npos ||
                error_.find("TLS") != std::string::npos || error_.find("certificate") != std::string::npos)
                break;
        }
    }
    set_status("");
    return all && listed;
}

void RadioFetch::start(const std::string& stations_json, const std::string& dir) {
    stop();
    stations_ = parse_stations(stations_json);
    dir_ = dir;
    if (stations_.empty()) return;
    quit_ = false;
    done_ = false;
    cancel_.stop = false;
    note("fetching " + std::to_string(stations_.size()) + " station(s) into " + dir_, false);
    thread_ = std::thread([this] {
        note(net::trust_summary(), false);
        // until everything is here: without Wi-Fi, again after half a minute, then less often, up to every 15 minutes
        for (int wait = 30; !quit_; wait = std::min(wait * 2, 900)) {
            if (pass()) break;
            std::unique_lock<std::mutex> l(m_);
            if (!error_.empty()) status_ = "Radio: " + error_;   // shown in Settings until the next try
            cv_.wait_for(l, std::chrono::seconds(wait), [this] { return bool(quit_); });
            status_.clear();
        }
        done_ = true;
    });
}

void RadioFetch::stop() {
    if (!thread_.joinable()) return;
    {
        std::lock_guard<std::mutex> l(m_);
        quit_ = true;
    }
    cancel_.abort();
    cv_.notify_all();
    thread_.join();
    set_status("");
}

void RadioFetch::run_once_for_tests(const std::string& stations_json, const std::string& dir) {
    stations_ = parse_stations(stations_json);
    dir_ = dir;
    quit_ = false;
    cancel_.stop = false;
    pass();
}

}  // namespace q
