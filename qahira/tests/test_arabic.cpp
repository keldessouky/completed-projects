// Slice 11: Arabic in the UI. Letters take their contextual forms, lam-alef is one sign, and a line runs right to
// left with its numbers and Latin words left to right inside it.
#include "tests/check.hpp"
#include "ui/arabic.hpp"
#include "ui/lang.hpp"
#include "ui/ui.hpp"
#include "game/settings.hpp"
#include <cstdio>

using namespace q;

TEST(arabic_letters_join_by_context) {
    // قاهرة: qaf (initial), alef (final), heh (isolated: alef does not join on), reh (isolated), teh marbuta (isolated)
    std::u32string s = shape_arabic(utf8_to_u32("\xD9\x82\xD8\xA7\xD9\x87\xD8\xB1\xD8\xA9"));
    CHECK(s.size() == 5);
    CHECK(s[0] == 0xFED7 && s[1] == 0xFE8E);
    CHECK(s[2] == 0xFEEB && s[3] == 0xFEAE && s[4] == 0xFE93);   // heh joins the reh after it: initial; reh final
    // بيت: beh initial, yeh medial, teh final
    s = shape_arabic(utf8_to_u32("\xD8\xA8\xD9\x8A\xD8\xAA"));
    CHECK(s.size() == 3 && s[0] == 0xFE91 && s[1] == 0xFEF4 && s[2] == 0xFE96);
    // لا is one sign, and after a joining letter its final form: سلام
    s = shape_arabic(utf8_to_u32("\xD9\x84\xD8\xA7"));
    CHECK(s.size() == 1 && s[0] == 0xFEFB);
    s = shape_arabic(utf8_to_u32("\xD8\xB3\xD9\x84\xD8\xA7\xD9\x85"));
    CHECK(s.size() == 3 && s[0] == 0xFEB3 && s[1] == 0xFEFC && s[2] == 0xFEE1);
    // harakat are dropped and do not break the joining: بَيت
    s = shape_arabic(utf8_to_u32("\xD8\xA8\xD9\x8E\xD9\x8A\xD8\xAA"));
    CHECK(s.size() == 3 && s[0] == 0xFE91);
}

TEST(an_arabic_line_runs_right_to_left_with_numbers_left_to_right) {
    // "بيت 25": drawn as "25 " then the word reversed
    std::u32string v = visual_order(shape_arabic(utf8_to_u32("\xD8\xA8\xD9\x8A\xD8\xAA 25")));
    CHECK(v.size() == 6);
    CHECK(v[0] == '2' && v[1] == '5' && v[2] == ' ');
    CHECK(v[3] == 0xFE96 && v[5] == 0xFE91);   // teh first on the left, beh last
    // a Latin word stays in order inside Arabic, and brackets mirror
    v = visual_order(utf8_to_u32("\xD8\xA8 (Q1S) \xD8\xAA"));
    std::u32string want = utf8_to_u32("\xD8\xAA (Q1S) \xD8\xA8");
    CHECK(v == want);
    // an English line is untouched
    CHECK(visual_order(utf8_to_u32("Level 12 (70%)")) == utf8_to_u32("Level 12 (70%)"));
    CHECK(has_arabic("\xD8\xA8") && !has_arabic("Qahira"));
    CHECK(u32_to_utf8(utf8_to_u32("\xD9\x82\xD8\xA7 \xC2\xB7 x")) == "\xD9\x82\xD8\xA7 \xC2\xB7 x");
}

// the UI's strings: whole, by prefix and by suffix in Arabic, untouched in English
TEST(the_ui_speaks_arabic_when_asked) {
    std::string out;
    set_lang(Lang::En);
    CHECK(!translate("Settings", out) && tr("Settings") == "Settings");
    set_lang(Lang::Ar);
    CHECK(translate("Settings", out) && has_arabic(out));
    CHECK(translate("Level 24", out) && out.find("24") != std::string::npos && has_arabic(out));
    CHECK(translate("23 stars to place", out) && out.compare(0, 2, "23") == 0 && has_arabic(out));
    CHECK(!translate("Eclipse Verdict", out));   // item names stay as they are
    CHECK(!translate("Buy 12 stars to place", out) || out.find("Buy") == std::string::npos);
    CHECK(translation_count() > 150);
    set_lang(Lang::En);
}

// the settings belong to the device: saved beside the characters, read back, and applied to the UI
TEST(settings_are_kept_and_applied) {
    set_settings_dir(std::string(QAHIRA_SOURCE_DIR) + "/build");
    Settings keep = settings();
    set_setting(SET_LANG, 1);
    set_setting(SET_TEXT, 2);
    set_setting(SET_COLOURS, 1);
    set_setting(SET_SHAKE, 2);
    set_setting(SET_BAR2, 1);
    CHECK(lang() == Lang::Ar && ui().rtl() && ui().text_scale() > 1.1f && shake_scale() == 0.5f);
    CHECK(pal::unique.r == 0xD5);   // the red-green safe palette
    CHECK(save_settings());
    settings() = Settings{};
    CHECK(load_settings());
    CHECK(settings().lang == 1 && settings().text == 2 && settings().colours == 1 && settings().shake == 2 && settings().bar2_toggle == 1);
    set_setting(SET_SHAKE, 5);   // wraps round
    CHECK(settings().shake == 0);
    settings() = keep;
    apply_settings();
    CHECK(lang() == Lang::En && !ui().rtl() && pal::unique.r == 0xE0);
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.settings").c_str());
}
