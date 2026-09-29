// Radio Kafr El-Sheikh: the episodes found beside the pack, in natural order, each streamed and resampled to 48 kHz,
// the place in an episode kept, and on to the next when one ends.
#include "tests/check.hpp"
#include "audio/radio.hpp"
#include "game/settings.hpp"
#include <cmath>
#include <cstdio>
#include <vector>

using namespace q;

static float rms(const std::vector<float>& v) {
    double s = 0;
    for (float x : v) s += double(x) * x;
    return float(std::sqrt(s / double(std::max<size_t>(1, v.size()))));
}

TEST(the_radio_finds_its_episodes_in_order) {
    CHECK(Radio::natural_less("episode 2", "Episode 10") && !Radio::natural_less("episode 10", "episode 2"));
    CHECK(Radio::natural_less("a", "b") && Radio::natural_less("ep 02", "ep 3"));
    CHECK(Radio::clean_title("/x/radio/episode_3-the_canal.mp3") == "Episode 3 - the canal");
    Radio r;
    CHECK(r.scan({"/nowhere", std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio"}) == 3);   // not notes.txt
    CHECK(r.title(0) == "Episode 1 - the canal" && r.title(1) == "Episode 2 - the market" && r.title(2) == "Episode 10 - the river");
}

TEST(the_radio_streams_mp3_ogg_and_wav_at_48khz) {
    Radio r;
    r.scan({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio"});
    for (int ep = 0; ep < 3; ep++) {
        CHECK(r.start(ep, 0));
        std::vector<float> out(48000 / 4 * 2, 0.f);   // a quarter of a second
        r.mix(out.data(), 48000 / 4, 1.f);
        CHECK(rms(out) > 0.1f && rms(out) < 0.6f);
        CHECK(std::fabs(r.seconds() - 0.25) < 0.02);  // the source's own rate, resampled
        CHECK(r.current() == ep);
    }
    // a place in an episode: the MP3 from a second in
    CHECK(r.start(0, 1.0));
    std::vector<float> out(4800 * 2, 0.f);
    r.mix(out.data(), 4800, 1.f);
    CHECK(std::fabs(r.seconds() - 1.1) < 0.03);
    // the last episode ends (half a second): the radio tunes through static to the first
    CHECK(r.start(2, 0));
    const uint32_t tuned = r.tuned;
    std::vector<float> more(48000 * 2, 0.f);
    r.mix(more.data(), 48000, 1.f);
    CHECK(r.tuned == tuned + 1 && r.current() == 0 && r.playing());
    CHECK(!Radio().start(0, 0));   // nothing found, nothing played
}

TEST(the_settings_keep_the_music_and_the_radio_place) {
    set_settings_dir(std::string(QAHIRA_SOURCE_DIR) + "/build");
    Settings keep = settings();
    settings().music = 1;
    settings().radio_ep = 7;
    settings().radio_pos = 1234;
    CHECK(save_settings());
    settings() = Settings{};
    CHECK(load_settings());
    CHECK(settings().music == 1 && settings().radio_ep == 7 && settings().radio_pos == 1234);
    // a version 1 file (before the radio) still loads, with the radio on
    FILE* f = fopen((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.settings").c_str(), "wb");
    const uint32_t magic = 0x54455351;
    const uint8_t v1[6] = {1, 0, 1, 0, 3, 0};
    fwrite(&magic, 4, 1, f);
    fwrite(v1, 1, 6, f);
    fclose(f);
    settings() = Settings{};
    CHECK(load_settings() && settings().text == 1 && settings().shake == 3 && settings().music == 0);
    settings() = keep;
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.settings").c_str());
}
