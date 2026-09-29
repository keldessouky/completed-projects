#include "game/settings.hpp"
#include "ui/lang.hpp"
#include "ui/ui.hpp"
#include <cstdio>

namespace q {

namespace {
std::string g_dir = ".";
std::string path() { return g_dir + "/qahira.settings"; }
constexpr uint32_t kMagic = 0x54455351;   // "QSET"
constexpr uint8_t kVersion = 1;
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
    uint8_t v[6] = {};
    bool ok = fread(&magic, 4, 1, f) == 1 && magic == kMagic && fread(v, 1, 6, f) == 6 && v[0] == kVersion;
    fclose(f);
    if (!ok) return false;
    Settings& s = settings();
    s.lang = v[1] < 2 ? v[1] : 0;
    s.text = v[2] < 3 ? v[2] : 0;
    s.colours = v[3] < 3 ? v[3] : 0;
    s.shake = v[4] <= 4 ? v[4] : 4;
    s.bar2_toggle = v[5] < 2 ? v[5] : 0;
    return true;
}

bool save_settings() {
    FILE* f = fopen(path().c_str(), "wb");
    if (!f) return false;
    const Settings& s = settings();
    const uint8_t v[6] = {kVersion, s.lang, s.text, s.colours, s.shake, s.bar2_toggle};
    bool ok = fwrite(&kMagic, 4, 1, f) == 1 && fwrite(v, 1, 6, f) == 6;
    fclose(f);
    return ok;
}

const char* setting_label(int row) {
    static const char* l[SET_COUNT] = {"Language", "Text size", "Loot colours", "Screen shake", "Second skill bar"};
    return l[row < 0 || row >= SET_COUNT ? 0 : row];
}

int setting_choices(int row) {
    static const int n[SET_COUNT] = {2, 3, 3, 5, 2};
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
        default: return "";
    }
}

float shake_scale() { return settings().shake / 4.f; }

}  // namespace q
