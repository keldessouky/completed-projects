#include "game/settings.hpp"
#include "audio/audio.hpp"
#include "ui/lang.hpp"
#include "ui/ui.hpp"
#include <algorithm>
#include <cstdio>

namespace q {

namespace {
std::string g_dir = ".";
std::string path() { return g_dir + "/qahira.settings"; }
std::string radio_path() { return g_dir + "/qahira.radio"; }   // every station's place
constexpr uint32_t kMagic = 0x54455351;   // "QSET"
constexpr uint8_t kVersion = 2;   // 2: the music and the radio's place
}  // namespace

Settings& settings() { static Settings s; return s; }
void set_settings_dir(const std::string& dir) { g_dir = dir; }

void apply_settings() {
    const Settings& s = settings();
    set_lang(s.lang == 1 ? Lang::Ar : Lang::En);
    ui().set_rtl(s.lang == 1);
    ui().set_text_scale(s.text == 2 ? 1.16f : s.text == 1 ? 1.08f : 1.f);
    // loot and comparison colours: red and green, or blue and yellow, are the pairs colour-blind players lose
    switch (s.colours) {
        case 1:   // red-green safe (after Okabe and Ito)
            pal::magic = Rgba::hex(0x56B4E9); pal::rare = Rgba::hex(0xF0E442); pal::unique = Rgba::hex(0xD55E00);
            pal::good = Rgba::hex(0x56B4E9); pal::bad = Rgba::hex(0xE69F00);
            break;
        case 2:   // blue-yellow safe
            pal::magic = Rgba::hex(0x30C8E8); pal::rare = Rgba::hex(0xFF6A7A); pal::unique = Rgba::hex(0xF2F2F2);
            pal::good = Rgba::hex(0x30C8E8); pal::bad = Rgba::hex(0xFF6A7A);
            break;
        default:
            pal::magic = Rgba::hex(0x7AA8FF); pal::rare = Rgba::hex(0xF5D76E); pal::unique = Rgba::hex(0xE08A3C);
            pal::good = Rgba::hex(0x7BD389); pal::bad = Rgba::hex(0xE0525C);
    }
}

bool load_settings() {
    FILE* f = fopen(path().c_str(), "rb");
    if (!f) return false;
    uint32_t magic = 0;
    uint8_t v[13] = {};
    bool ok = fread(&magic, 4, 1, f) == 1 && magic == kMagic && fread(v, 1, 6, f) == 6 && (v[0] == 1 || v[0] == kVersion);
    if (ok && v[0] >= 2) ok = fread(v + 6, 1, 7, f) == 7;
    fclose(f);
    if (!ok) return false;
    Settings& s = settings();
    s.lang = v[1] < 2 ? v[1] : 0;
    s.text = v[2] < 3 ? v[2] : 0;
    s.colours = v[3] < 3 ? v[3] : 0;
    s.shake = v[4] <= 4 ? v[4] : 4;
    s.bar2_toggle = v[5] < 2 ? v[5] : 0;
    if (v[0] >= 2) {
        s.music = v[6] < 2 ? v[6] : 0;
        s.radio_ep = uint16_t(v[7] | v[8] << 8);
        s.radio_pos = uint32_t(v[9] | v[10] << 8 | v[11] << 16 | uint32_t(v[12]) << 24);
    }
    return true;
}

bool save_settings() {
    FILE* f = fopen(path().c_str(), "wb");
    if (!f) return false;
    const Settings& s = settings();
    const uint8_t v[13] = {kVersion, s.lang, s.text, s.colours, s.shake, s.bar2_toggle, s.music,
                           uint8_t(s.radio_ep), uint8_t(s.radio_ep >> 8),
                           uint8_t(s.radio_pos), uint8_t(s.radio_pos >> 8), uint8_t(s.radio_pos >> 16), uint8_t(s.radio_pos >> 24)};
    bool ok = fwrite(&kMagic, 4, 1, f) == 1 && fwrite(v, 1, 13, f) == 13;
    fclose(f);
    return ok;
}

const char* setting_label(int row) {
    static const char* l[SET_COUNT] = {"Language", "Text size", "Loot colours", "Screen shake", "Second skill bar", "Music"};
    return l[row < 0 || row >= SET_COUNT ? 0 : row];
}

// the Music row: each station on the radio (one, Radio Kafr El-Sheikh, before any are found), then the game's music
static int music_stations() { return std::max(1, audio().radio.stations()); }

int setting_choices(int row) {
    if (row == SET_MUSIC) return music_stations() + 1;
    static const int n[SET_COUNT] = {2, 3, 3, 5, 2, 2};
    return n[row < 0 || row >= SET_COUNT ? 0 : row];
}

int setting_value(int row) {
    const Settings& s = settings();
    switch (row) {
        case SET_LANG: return s.lang;
        case SET_TEXT: return s.text;
        case SET_COLOURS: return s.colours;
        case SET_SHAKE: return s.shake;
        case SET_BAR2: return s.bar2_toggle;
        case SET_MUSIC: return s.music == 1 ? music_stations() : audio().radio.station();
        default: return 0;
    }
}

void set_setting(int row, int v) {
    Settings& s = settings();
    const int n = setting_choices(row);
    v = ((v % n) + n) % n;
    switch (row) {
        case SET_LANG: s.lang = uint8_t(v); break;
        case SET_TEXT: s.text = uint8_t(v); break;
        case SET_COLOURS: s.colours = uint8_t(v); break;
        case SET_SHAKE: s.shake = uint8_t(v); break;
        case SET_BAR2: s.bar2_toggle = uint8_t(v); break;
        case SET_MUSIC: {
            Radio& r = audio().radio;
            s.music = v == music_stations() ? 1 : 0;
            if (s.music == 0 && v < r.stations() && v != r.station()) r.tune(v, r.playing());
            apply_music();
            break;
        }
        default: break;
    }
    apply_settings();
}

std::string setting_choice_name(int row, int v) {
    switch (row) {
        case SET_LANG: return lang_name(v == 1 ? Lang::Ar : Lang::En);
        case SET_TEXT: return v == 2 ? "Largest" : v == 1 ? "Larger" : "Normal";
        case SET_COLOURS: return v == 2 ? "Blue-yellow safe" : v == 1 ? "Red-green safe" : "Standard";
        case SET_SHAKE: return v == 0 ? std::string("Off") : std::to_string(v * 25) + "%";
        case SET_BAR2: return v == 1 ? "Toggle with L2" : "Hold L2";
        case SET_MUSIC:
            if (v == music_stations()) return "The game's music";
            return audio().radio.stations() ? audio().radio.station_name(v) : std::string(Radio::kHome);
        default: return "";
    }
}

float shake_scale() { return settings().shake / 4.f; }

void set_radio_dirs(const std::vector<std::string>& dirs) {
    Radio& r = audio().radio;
    if (!r.scan(dirs)) return;
    // where every station was left; before there were stations, the settings kept Radio Kafr El-Sheikh's place
    if (FILE* f = fopen(radio_path().c_str(), "rb")) {
        std::string text;
        char buf[4096];
        for (size_t n; (n = fread(buf, 1, sizeof buf, f)) > 0;) text.append(buf, n);
        fclose(f);
        r.set_places(text);
    } else {
        r.set_place(0, settings().radio_ep, settings().radio_pos);
    }
}

void apply_music() {
    Settings& s = settings();
    Radio& r = audio().radio;
    const bool on = s.music == 0 && r.count() > 0;
    if (on && !r.playing()) r.resume();
    if (!on && r.playing()) { keep_radio_place(); r.stop(); }
    audio().radio_on = on;
}

void keep_radio_place() {
    Radio& r = audio().radio;
    if (!r.playing()) return;
    settings().radio_ep = uint16_t(r.current());   // the station tuned, as settings v2 keeps it
    settings().radio_pos = uint32_t(r.seconds());
    save_settings();
    const std::string text = r.places();
    if (FILE* f = fopen(radio_path().c_str(), "wb")) {
        fwrite(text.data(), 1, text.size(), f);
        fclose(f);
    }
}

}  // namespace q
