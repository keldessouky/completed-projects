// The Settings (GDD §11 accessibility, Slice 11): the language (English, or Arabic laid out right to left), the text
// size, loot colours safe for colour-blind players, the screen shake, and whether L2 holds or toggles the second skill
// bar. They belong to the device, not a character: kept in qahira.settings beside the character files.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace q {

struct Settings {
    uint8_t lang = 0;         // 0 English, 1 Arabic
    uint8_t text = 0;         // 0 normal, 1 larger, 2 largest
    uint8_t colours = 0;      // 0 standard, 1 red-green safe, 2 blue-yellow safe
    uint8_t shake = 4;        // in quarters: 0 off .. 4 full
    uint8_t bar2_toggle = 0;  // 0 hold L2, 1 L2 toggles
    uint8_t music = 0;        // 0 Radio Kafr El-Sheikh (when it has episodes), 1 the game's music
    uint16_t radio_ep = 0;    // the episode on the radio, and how far into it (seconds)
    uint32_t radio_pos = 0;
};

enum SettingRow { SET_LANG, SET_TEXT, SET_COLOURS, SET_SHAKE, SET_BAR2, SET_MUSIC, SET_COUNT };

Settings& settings();
void apply_settings();                         // to the UI (language, mirroring, text size) and the palettes
void set_settings_dir(const std::string& dir); // where qahira.settings lives
bool load_settings();
bool save_settings();
const char* setting_label(int row);
int setting_choices(int row);
int setting_value(int row);
void set_setting(int row, int v);
std::string setting_choice_name(int row, int v);
float shake_scale();                           // 0..1
// the radio: where its episodes are looked for, and tuning it in or out as the Music setting says
void set_radio_dirs(const std::vector<std::string>& dirs);
void apply_music();
void keep_radio_place();                       // the episode and the place in it, into the settings (and saved)

}  // namespace q
