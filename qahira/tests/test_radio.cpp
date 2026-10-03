// The radio: its stations found beside the pack (loose episodes are Radio Kafr El-Sheikh's), each station's episodes in
// natural order, streamed and resampled to 48 kHz, every station's place kept, and on to the next when one ends.
#include "tests/check.hpp"
#include "audio/audio.hpp"
#include "audio/radio.hpp"
#include "game/settings.hpp"
#include <algorithm>
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
    CHECK(r.scan({"/nowhere", std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio"}) == 1);   // one station
    CHECK(r.station_name(0) == Radio::kHome && r.count() == 3 && r.episodes() == 3);            // not notes.txt
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

TEST(the_radio_has_a_station_for_each_folder) {
    // loose episodes are Radio Kafr El-Sheikh's, first; a folder of episodes is a station named after it; a folder
    // with none, or hidden, is not
    Radio r;
    CHECK(r.scan({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/stations"}) == 2);
    CHECK(r.station_name(0) == Radio::kHome && r.station_name(1) == "Nile FM" && r.episodes() == 3);
    CHECK(r.station() == 0 && r.count() == 1 && r.title(0) == "Episode 1 - the canal");
    // to Nile FM, through static: its own episodes
    CHECK(r.start(0, 0));
    std::vector<float> out(4800 * 2, 0.f);
    r.mix(out.data(), 4800, 1.f);
    const uint32_t tuned = r.tuned;
    r.next_station(1);
    CHECK(r.station() == 1 && r.count() == 2 && r.playing() && r.tuned == tuned + 1);
    CHECK(r.title(0) == "Episode 2 - the market" && r.title(1) == "Episode 10 - the river");
    CHECK(r.start(1, 0.2));
    r.mix(out.data(), 4800, 1.f);
    // back to Kafr El-Sheikh and to Nile FM again: each picks up where it was left
    r.next_station(1);
    CHECK(r.station() == 0 && r.current() == 0 && std::fabs(r.seconds() - 0.1) < 0.03);
    r.tune(1, true);
    CHECK(r.station() == 1 && r.current() == 1 && std::fabs(r.seconds() - 0.3) < 0.03);
    // the places, by name, into a radio that finds the same stations
    r.set_place(0, 0, 1);
    const std::string kept = r.places();
    Radio r2;
    r2.scan({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/stations"});
    r2.set_places(kept + "place\tGone FM\tx.mp3\t9\n");   // a station that is gone changes nothing
    CHECK(r2.station() == 1 && r2.current() == 1 && !r2.playing());
    CHECK(r2.resume() && r2.current() == 1);
    r2.tune(0, true);
    CHECK(r2.current() == 0 && std::fabs(r2.seconds() - 1.0) < 0.03);
    // the same places when the home station has only its loose folder: they are keyed by name, not by number
    Radio r3;
    r3.scan({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio"});
    r3.set_places(kept);
    CHECK(r3.station() == 0 && r3.stations() == 1);
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

TEST(the_music_setting_chooses_a_station) {
    set_settings_dir(std::string(QAHIRA_SOURCE_DIR) + "/build");
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.radio").c_str());
    Settings keep = settings();
    settings().music = 0;
    settings().radio_ep = 0;
    settings().radio_pos = 0;
    Radio& r = audio().radio;
    set_radio_dirs({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/stations"});
    apply_music();
    // the Music row: Radio Kafr El-Sheikh, Nile FM, the game's music
    CHECK(setting_choices(SET_MUSIC) == 3 && setting_value(SET_MUSIC) == 0 && r.playing());
    CHECK(setting_choice_name(SET_MUSIC, 1) == "Nile FM" && setting_choice_name(SET_MUSIC, 2) == "The game's music");
    set_setting(SET_MUSIC, 1);
    CHECK(r.station() == 1 && r.playing() && settings().music == 0 && setting_value(SET_MUSIC) == 1);
    set_setting(SET_MUSIC, 2);
    CHECK(!r.playing() && settings().music == 1 && setting_value(SET_MUSIC) == 2);
    set_setting(SET_MUSIC, 3);   // on round to the first station
    CHECK(r.station() == 0 && r.playing() && settings().music == 0);
    // every station's place, kept beside the settings and found again
    r.tune(1, true);
    keep_radio_place();
    r.stop();
    set_radio_dirs({std::string(QAHIRA_SOURCE_DIR) + "/tests/data/stations"});
    CHECK(r.station() == 1);
    // no radio at all: the row is Radio Kafr El-Sheikh or the game's music, as before
    set_radio_dirs({"/nowhere"});
    apply_music();
    CHECK(setting_choices(SET_MUSIC) == 2 && setting_choice_name(SET_MUSIC, 0) == "Radio Kafr El-Sheikh" && !r.playing());
    settings() = keep;
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.settings").c_str());
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.radio").c_str());
}

// the radio's own fetching: the stations in the pack, the Internet Archive's and a feed's episode lists, and the
// downloads themselves (from files here, so the tests need no network), resumed when cut off
#include "audio/radio_fetch.hpp"
#include <sys/stat.h>
#include <unistd.h>

static std::string slurp(const std::string& p) {
    std::string s;
    if (FILE* f = fopen(p.c_str(), "rb")) {
        char b[4096];
        for (size_t n; (n = fread(b, 1, sizeof b, f)) > 0;) s.append(b, n);
        fclose(f);
    }
    return s;
}

TEST(the_pack_lists_radio_kafr_el_sheikh) {
    const auto st = parse_stations(slurp(std::string(QAHIRA_SOURCE_DIR) + "/data/radio.json"));
    CHECK(st.size() == 2 && st[0].name == Radio::kHome && st[0].folder() == "Radio Kafr El-Sheikh");
    CHECK(st[0].episodes.size() == 18);
    const RadioEpisode& e = st[0].episodes[0];
    CHECK(e.n == 2 && e.ext == ".mp3" && e.file() == "2 - \xD8\xA7\xD9\x84\xD8\xAD\xD9\x84\xD9\x82\xD8\xA9 \xD8\xA7\xD9\x84\xD8\xAB\xD8\xA7\xD9\x86\xD9\x8A\xD8\xA9.mp3");
    CHECK(e.url == "https://archive.org/download/radiokafrelshikh/%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9.mp3");
    // in the show's order, the special without a number last
    int last = 0;
    for (size_t i = 0; i + 1 < st[0].episodes.size(); i++) { CHECK(st[0].episodes[i].n > last); last = st[0].episodes[i].n; }
    CHECK(st[0].episodes.back().n == 0 && st[0].episodes.back().file().find(" - ") == std::string::npos);
    // the files sort in the order they play: 2 before 12, the special after 26
    std::vector<std::string> names;
    for (const auto& ep : st[0].episodes) names.push_back(ep.file());
    for (size_t i = 0; i + 1 < names.size(); i++) CHECK(Radio::natural_less(names[i], names[i + 1]));
    // Coast to Coast AM: the show's own podcast feed, its newest 5 and the best-loved shows it carries
    const RadioStation& cc = st[1];
    CHECK(cc.name == "Coast to Coast AM" && cc.episodes.empty() && cc.newest == 5 && cc.keep.size() == 13);
    CHECK(cc.keep[0].match == "artbell" && cc.keep[0].count == 3 && cc.keep[1].match == "ghosttoghost");
    CHECK(std::any_of(cc.keep.begin(), cc.keep.end(), [](const RadioKeep& k) { return k.match == "melshole" && k.count == 1; }));
    CHECK(cc.rss.rfind("https://www.omnycontent.com/", 0) == 0 && cc.rss.find("podcast.rss") != std::string::npos);
}

TEST(the_radio_finds_episodes_by_a_piece_of_their_name) {
    // an item with the Archive's derived copies: each recording is one episode, as Ogg when there is one
    const char* meta = R"({"files": [
        {"name": "XMinusOne56-08-07067TheLastMartian.mp3", "source": "original"},
        {"name": "XMinusOne56-08-07067TheLastMartian_64kb.mp3", "source": "derivative", "original": "XMinusOne56-08-07067TheLastMartian.mp3"},
        {"name": "XMinusOne56-10-24076PicturesDontLie.mp3", "source": "original"},
        {"name": "XMinusOne56-10-24076PicturesDontLie_64kb.mp3", "source": "derivative", "original": "XMinusOne56-10-24076PicturesDontLie.mp3"},
        {"name": "XMinusOne56-10-24076PicturesDontLie.ogg", "source": "derivative", "original": "XMinusOne56-10-24076PicturesDontLie.mp3"},
        {"name": "XMinusOne57-01-09085SaucerOfLonliness.mp3", "source": "original"},
        {"name": "XMinusOne57-09-05120SaucerOfLoneliness.mp3", "source": "original"},
        {"name": "XMinusOne.jpg", "source": "original"}]})";
    const auto all = archive_episodes("xm", meta);
    CHECK(all.size() == 4 && all[0].title == "XMinusOne56-08-07067TheLastMartian" && all[0].ext == ".mp3");
    CHECK(all[0].url == "https://archive.org/download/xm/XMinusOne56-08-07067TheLastMartian.mp3");
    CHECK(all[1].ext == ".ogg" && all[1].url == "https://archive.org/download/xm/XMinusOne56-10-24076PicturesDontLie.ogg");
    const auto st = parse_stations(R"({"stations": [{"name": "Sci-Fi", "archive": "xm", "episodes": [
        {"n": 1, "title": "The Last Martian", "match": "Last Martian"},
        {"n": 2, "title": "Pictures Don't Lie", "match": "picturesdont"},
        {"n": 3, "title": "Saucer of Loneliness", "match": "SaucerOf"},
        {"n": 4, "title": "Elsewhere", "archive": "dx", "match": "Knock"},
        {"n": 5, "title": "Missing", "match": "NoSuchShow"},
        {"n": 6, "title": "By file", "archive": "dx", "file": "Knock.mp3"},
        {"n": 7, "title": "Nothing to find by"}]}]})");
    CHECK(st.size() == 1 && st[0].episodes.size() == 6);   // the last names no file, link or match
    auto eps = st[0].episodes;
    CHECK(eps[3].archive == "dx" && eps[5].url == "https://archive.org/download/dx/Knock.mp3");
    match_episodes("xm", meta, eps);
    CHECK(eps[0].url == all[0].url && eps[0].ext == ".mp3" && eps[0].file() == "1 - The Last Martian.mp3");
    CHECK(eps[1].url == all[1].url && eps[1].file() == "2 - Pictures Don't Lie.ogg");
    CHECK(eps[2].url == "https://archive.org/download/xm/XMinusOne57-01-09085SaucerOfLonliness.mp3");   // the first broadcast
    CHECK(eps[3].url.empty() && eps[4].url.empty());   // another item's, and one the item hasn't got
}

TEST(the_radio_lists_an_archive_item_and_a_feed) {
    const char* meta = R"({"files": [
        {"name": "b.mp3", "track": "02"}, {"name": "b.ogg"}, {"name": "a.mp3", "track": "01"},
        {"name": "b.png"}, {"name": "c.mp3"}]})";
    const auto a = archive_episodes("item", meta);
    CHECK(a.size() == 3 && a[0].title == "a" && a[0].ext == ".mp3" && a[1].title == "b" && a[1].ext == ".ogg");
    CHECK(a[1].url == "https://archive.org/download/item/b.ogg" && a[2].title == "c" && a[2].n == 3);
    const char* rss = R"(<rss><channel><title>Show</title>
        <item><title><![CDATA[Newest: <b>]]></title><enclosure url="https://x.org/3.mp3?id=1" type="audio/mpeg"/></item>
        <item><title>M4A &amp; more</title><enclosure url="https://x.org/2.m4a" type="audio/x-m4a"/></item>
        <item><title>The first &#1575;</title><enclosure length="9" url='https://x.org/1.ogg' type="audio/ogg"></enclosure></item>
        </channel></rss>)";
    const auto r = rss_episodes(rss);
    CHECK(r.size() == 2);   // the M4A can't play
    CHECK(r[0].n == 1 && r[0].title == "The first \xD8\xA7" && r[0].url == "https://x.org/1.ogg" && r[0].ext == ".ogg");
    CHECK(r[1].n == 2 && r[1].title == "Newest: <b>" && r[1].ext == ".mp3" && r[1].file() == "2 - Newest - b.mp3");
}

TEST(a_feed_keeps_its_newest_episodes_by_date) {
    CHECK(rss_date("Wed, 07 Dec 2022 08:00:00 -0000") == 20221207 && rss_date("1 Jan 2024") == 20240101);
    CHECK(rss_date("Tue, 31 Sept 2024 10:00:00 GMT") == 20240931 && rss_date("tomorrow") == 0 && rss_date("") == 0);
    const char* rss = R"(<rss><channel>
        <item><title>Alien Abductions - 12/7/22</title><pubDate>Wed, 07 Dec 2022 08:00:00 GMT</pubDate>
              <enclosure url="https://x.org/c.mp3?a=1&amp;b=2" type="audio/mpeg"/></item>
        <item><title>Shroud of Turin</title><pubDate>Tue, 26 Jun 2018 08:00:00 GMT</pubDate><enclosure url="https://x.org/a.mp3" type="audio/mpeg"/></item>
        <item><title>Bigfoot</title><pubDate>Fri, 01 Jan 2021 08:00:00 GMT</pubDate><enclosure url="https://x.org/b.mp3" type="audio/mpeg"/></item>
        </channel></rss>)";
    const auto all = rss_episodes(rss);
    CHECK(all.size() == 3 && all[0].title == "Bigfoot" && all[0].n == 1);   // as the feed lists them, without a cut
    const auto two = rss_episodes(rss, 2);   // the two newest by date, oldest first, each named by its date
    CHECK(two.size() == 2 && two[0].title == "Bigfoot" && two[0].n == 20210101 && two[1].n == 20221207);
    CHECK(two[1].url == "https://x.org/c.mp3?a=1&b=2" && two[1].file() == "20221207 - Alien Abductions - 12 7 22.mp3");
    CHECK(rss_episodes(rss, 9).size() == 3);
    // what keep names stays whatever its age: the newest count whose titles hold its match, alongside the newest
    const char* feed = R"(<rss><channel>
        <item><title>Open Lines - 3/1/26</title><pubDate>Sun, 01 Mar 2026 08:00:00 GMT</pubDate><enclosure url="https://x.org/7.mp3" type="audio/mpeg"/></item>
        <item><title>Art Bell - 4/13/25</title><pubDate>Sun, 13 Apr 2025 08:00:00 GMT</pubDate><enclosure url="https://x.org/6.mp3" type="audio/mpeg"/></item>
        <item><title>Ghost To Ghost Halloween Special - 10/31/24</title><pubDate>Thu, 31 Oct 2024 08:00:00 GMT</pubDate><enclosure url="https://x.org/5.mp3" type="audio/mpeg"/></item>
        <item><title>Art Bell - 4/13/24</title><pubDate>Sat, 13 Apr 2024 08:00:00 GMT</pubDate><enclosure url="https://x.org/4.mp3" type="audio/mpeg"/></item>
        <item><title>Ghost to Ghost - 10/31/23</title><pubDate>Tue, 31 Oct 2023 08:00:00 GMT</pubDate><enclosure url="https://x.org/3.mp3" type="audio/mpeg"/></item>
        <item><title>Mel's Hole Revisited</title><pubDate>Mon, 01 May 2023 08:00:00 GMT</pubDate><enclosure url="https://x.org/2.mp3" type="audio/mpeg"/></item>
        <item><title>Gardening</title><pubDate>Sun, 01 Jan 2023 08:00:00 GMT</pubDate><enclosure url="https://x.org/1.mp3" type="audio/mpeg"/></item>
        </channel></rss>)";
    const std::vector<RadioKeep> keep = {{"ghosttoghost", 2}, {"melshole", 1}, {"artbell", 1}, {"bigfoot", 1}};
    const auto kept = rss_episodes(feed, 1, keep);
    std::vector<std::string> urls;
    for (const auto& ep : kept) urls.push_back(ep.url);
    CHECK((urls == std::vector<std::string>{"https://x.org/2.mp3", "https://x.org/3.mp3", "https://x.org/5.mp3", "https://x.org/6.mp3",
                                            "https://x.org/7.mp3"}));   // oldest first; not Gardening, nor the older Art Bell
    CHECK(kept[0].n == 20230501 && kept[4].n == 20260301);
    CHECK(rss_episodes(feed, 0, {{"artbell", 5}}).size() == 2);   // keep alone: only what it names
    const auto parsed = parse_stations(R"({"stations": [{"name": "T", "rss": "https://x.org/f", "keep": ["Area 51", {"match": "Ghost to Ghost!", "count": 2}, {"match": "x", "count": 0}]}]})");
    CHECK(parsed[0].keep.size() == 2 && parsed[0].keep[0].match == "area51" && parsed[0].keep[0].count == 1);
    CHECK(parsed[0].keep[1].match == "ghosttoghost" && parsed[0].keep[1].count == 2 && parsed[0].newest == 0);
}

TEST(a_newest_station_deletes_what_fell_out_of_its_feed) {
    const std::string src = std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio/";
    const std::string dir = std::string(QAHIRA_SOURCE_DIR) + "/build/radio_newest_test", st_dir = dir + "/Talk";
    mkdir(dir.c_str(), 0755);
    mkdir(st_dir.c_str(), 0755);
    const std::string feed = dir + "/feed.rss", old = st_dir + "/20200101 - Old Show.mp3", half = st_dir + "/20200102 - Half.ogg.part",
                      mine = st_dir + "/notes.txt", now = st_dir + "/20240301 - The Canal.mp3";
    remove(now.c_str());
    for (const std::string& f : {old, half, mine})
        if (FILE* o = fopen(f.c_str(), "wb")) { fputs("x", o); fclose(o); }
    if (FILE* o = fopen(feed.c_str(), "wb")) {
        fputs(("<rss><channel><item><title>The Canal</title><pubDate>Fri, 01 Mar 2024 00:00:00 GMT</pubDate>"
               "<enclosure url=\"file://" + src + "Episode_1-the_canal.mp3\" type=\"audio/mpeg\"/></item></channel></rss>").c_str(), o);
        fclose(o);
    }
    RadioFetch rf;
    rf.run_once_for_tests(R"({"stations": [{"name": "Talk", "rss": "file://)" + feed + R"(", "newest": 1}]})", dir);
    struct stat sb {};
    CHECK(stat(now.c_str(), &sb) == 0 && sb.st_size > 1000);   // the newest arrived
    CHECK(stat(old.c_str(), &sb) != 0 && stat(half.c_str(), &sb) != 0);   // the older ones, whole or half, are gone
    CHECK(stat(mine.c_str(), &sb) == 0);   // what isn't audio stays
}

TEST(the_radio_fetches_its_episodes_and_plays_them) {
    const std::string src = std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio/";
    const std::string dir = std::string(QAHIRA_SOURCE_DIR) + "/build/radio_fetch_test";
    const std::string st_dir = dir + "/Nile FM";
    const std::string json = R"({"stations": [{"name": "Nile FM", "episodes": [
        {"n": 1, "title": "The Canal: A Walk?", "url": "file://)" + src + R"(Episode_1-the_canal.mp3"},
        {"n": 2, "title": "The Market", "url": "file://)" + src + R"(episode_2-the_market.ogg"},
        {"n": 3, "title": "Gone", "url": "file:///nowhere/gone.wav"}]}]})";
    const std::string one = st_dir + "/1 - The Canal - A Walk.mp3", two = st_dir + "/2 - The Market.ogg";
    remove(one.c_str());
    remove(two.c_str());
    // a download cut off half way: it goes on from where it stopped
    mkdir(dir.c_str(), 0755);
    mkdir(st_dir.c_str(), 0755);
    const std::string whole = slurp(src + "episode_2-the_market.ogg");
    if (FILE* f = fopen((two + ".part").c_str(), "wb")) { fwrite(whole.data(), 1, 1000, f); fclose(f); }
    RadioFetch rf;
    rf.run_once_for_tests(json, dir);
    CHECK(rf.arrived() == 2);   // not the one that is gone
    CHECK(slurp(one) == slurp(src + "Episode_1-the_canal.mp3") && slurp(two) == whole);
    CHECK(slurp(two + ".part").empty() && rf.status().empty());
    // the radio plays what came, and goes on playing when more comes
    Radio r;
    remove(two.c_str());
    CHECK(r.scan({"/nowhere", dir}) == 1 && r.station_name(0) == "Nile FM" && r.count() == 1);
    CHECK(r.start(0, 0));
    std::vector<float> out(4800 * 2, 0.f);
    r.mix(out.data(), 4800, 1.f);
    rf.run_once_for_tests(json, dir);   // the second episode again
    CHECK(rf.arrived() == 3);   // it counts on
    r.scan({"/nowhere", dir});
    CHECK(r.count() == 2 && r.playing() && r.current() == 0 && std::fabs(r.seconds() - 0.1) < 0.03);
    CHECK(r.title(1) == "2 - The Market");
    remove(one.c_str());
    remove(two.c_str());
    rmdir(st_dir.c_str());
    rmdir(dir.c_str());
}

TEST(the_game_starts_the_radio_when_its_first_episode_lands) {
    // as the game runs it: nothing on the radio, the fetcher's thread, and the radio coming on with the first episode
    const std::string src = std::string(QAHIRA_SOURCE_DIR) + "/tests/data/radio/";
    const std::string dir = std::string(QAHIRA_SOURCE_DIR) + "/build/radio_game_test";
    const std::string st_dir = dir + "/" + Radio::kHome, ep = st_dir + "/1 - The Canal.mp3";
    remove(ep.c_str());
    set_settings_dir(std::string(QAHIRA_SOURCE_DIR) + "/build");
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.radio").c_str());
    Settings keep = settings();
    settings() = Settings{};
    Radio& r = audio().radio;
    set_radio_dirs({"/nowhere", dir});
    apply_music();
    CHECK(r.stations() == 0 && !audio().radio_on);
    start_radio_fetch(R"({"stations": [{"name": "Radio Kafr El-Sheikh", "episodes": [
        {"n": 1, "title": "The Canal", "url": "file://)" + src + R"(Episode_1-the_canal.mp3"}]}]})", dir);
    for (int i = 0; i < 500 && !r.stations(); i++) {   // up to five seconds
        poll_radio();
        usleep(10000);
    }
    CHECK(r.stations() == 1 && audio().radio_on && r.playing() && r.title(0) == "1 - The Canal");
    stop_radio_fetch();
    CHECK(radio_fetch_status().empty());
    r.stop();
    audio().radio_on = false;
    settings() = keep;
    remove(ep.c_str());
    rmdir(st_dir.c_str());
    rmdir(dir.c_str());
    remove((std::string(QAHIRA_SOURCE_DIR) + "/build/qahira.settings").c_str());
}
