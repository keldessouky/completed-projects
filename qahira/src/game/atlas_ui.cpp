#include "game/atlas_ui.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <cmath>
#include <cstdio>

namespace q {

namespace {
constexpr float MX = 720, MY = 540, MR = 480;   // the round world
constexpr float IX = 1300, IW = 580;            // the side panel
enum Dir { D_UP, D_DOWN, D_LEFT, D_RIGHT };

// the schematic world: units of its radius, south up (so east is on the left)
vec2 disc_pt(float x, float y) { return {MX + x * (MR - 30), MY + y * (MR - 30)}; }

Rgba tier_color(int t) {   // the Climes warm to cool, then the Reaches from sea-green to pearl
    static const uint32_t c[kChartTiers] = {0xE8C070, 0x7AC8A0, 0x8AA8F2, 0xE07AB0, 0xF08A5A, 0xC8D860, 0xB08AF0,
                                            0x4ACAC0, 0x48B8D8, 0x4A9AE8, 0x6A84F0, 0x8A7AF0, 0xA894F0, 0xC8B4F0, 0xDCD0F4, 0xF0ECF8};
    return Rgba::hex(c[std::clamp(t, 1, kChartTiers) - 1]);
}

std::string tier_title(int t) { return std::string("The ") + tier_ordinal(t) + (t <= 7 ? " Clime" : " Reach"); }

void legend(float x, float y, std::initializer_list<std::pair<int, const char*>> items) {
    Ui& u = ui();
    for (auto& [b, label] : items) {
        draw_button_glyph(x + 20, y + 18, 38, b);
        x += 48;
        x += u.text(x, y, label, 26, pal::soft) + 30;
    }
}

float fit(const std::string& t, float fs, float w) { return std::min(fs, fs * w / std::max(1.f, ui().text_width(t, fs))); }

vec2 astro_screen(const AstroNode& n) { return {MX + n.pos.x * 92.f, MY - n.pos.y * 92.f}; }
}  // namespace

vec2 site_screen(const Site& s) { return disc_pt(s.mx, s.my); }

void MapScreen::show(const World& w) {
    open = true;
    view = 0;
    picking = pinnacles = false;
    go_site = go_chart = go_pinnacle = -1;
    last_dir_ = -1;
    // start on the first revealed site not yet finished
    cursor = 0;
    for (size_t i = 0; i < sites().size(); i++)
        if ((w.hero.sites_revealed >> i & 1) && !(w.hero.sites_done >> i & 1)) { cursor = int(i); break; }
}

void MapScreen::update(World& w, const Input& in, float dt) {
    msg_t = std::max(0.f, msg_t - dt);
    if (!open) return;
    Hero& H = w.hero;
    // the push: the stick's own direction (so a diagonal reaches a site that lies diagonally), or the D-pad's
    vec2 push{0, 0};
    if (length(in.lstick) > 0.6f) push = normalize(vec2{in.lstick.x, -in.lstick.y});   // screen space: up is -y
    else if (in.held(BTN_UP)) push = {0, -1};
    else if (in.held(BTN_DOWN)) push = {0, 1};
    else if (in.held(BTN_LEFT)) push = {-1, 0};
    else if (in.held(BTN_RIGHT)) push = {1, 0};
    int dir = length(push) > 0 ? int(std::lround((angle_of(push) + kPi) / (kTau / 8))) % 8 : -1;   // one of eight, for the repeat
    int step = -1;
    if (dir < 0) last_dir_ = -1;
    else if (dir != last_dir_) { last_dir_ = dir; repeat_t_ = 0.3f; step = dir; }
    else if ((repeat_t_ -= dt) <= 0) { repeat_t_ = 0.12f; step = dir; }
    // the four-way step for the lists (the chart picker) reads the dominant axis
    const int step4 = step < 0 ? -1 : std::fabs(push.x) > std::fabs(push.y) ? (push.x < 0 ? D_LEFT : D_RIGHT) : (push.y < 0 ? D_UP : D_DOWN);
    if (in.hit(BTN_EAST)) {
        if (pinnacles) pinnacles = false;
        else if (picking) picking = false;
        else hide();
        return;
    }
    if (pinnacles) {   // the list: the cursor, then North or South sets out if the keys are there
        if (step4 == D_UP) pin_cursor = (pin_cursor + PIN_COUNT - 1) % PIN_COUNT;
        if (step4 == D_DOWN) pin_cursor = (pin_cursor + 1) % PIN_COUNT;
        if (in.hit(BTN_NORTH) || in.hit(BTN_SOUTH)) {
            const PinnacleDef& d = pinnacle_def(pin_cursor);
            if (H.currency[d.currency] < d.cost) { say(std::string("Not enough keys: ") + d.where); return; }
            H.currency[d.currency] -= d.cost;
            go_pinnacle = pin_cursor;
            pinnacles = false;
            open = false;
        }
        return;
    }
    if (!picking && (in.hit(BTN_L1) || in.hit(BTN_R1))) { view ^= 1; w.emit(Ev::Craft, w.actors[0].pos, 0); return; }
    if (!picking && view == 0 && in.hit(BTN_WEST)) {   // a Rift Seal: the Rift Lord's court
        if (w.hero.currency[CUR_RIFT_SEAL] <= 0) { say("A Rift Seal opens the Rift Lord's court: fifty Marid Splinters make one"); return; }
        w.hero.currency[CUR_RIFT_SEAL]--;
        go_rift = true;
        open = false;
        return;
    }
    if (!picking && view == 0 && in.hit(BTN_NORTH)) {   // the pinnacles: the cursor starts on the first one the keys open
        if (w.hero.currency[CUR_PEARL] <= 0 && w.hero.currency[CUR_SCALE] <= 0) {
            say("Four King's Pearls open the Marid King's throne: the masters of the last Reaches carry them");
            return;
        }
        pinnacles = true;
        pin_cursor = 0;
        for (int p = PIN_COUNT - 1; p >= 0; p--)
            if (H.currency[pinnacle_def(p).currency] >= pinnacle_def(p).cost && !pinnacle_def(p).uber) pin_cursor = p;
        return;
    }
    // the nearest candidate in the push direction (screen space: up is up)
    auto nearest = [&](vec2 from, int n, auto pos, auto ok) {
        vec2 want = push;
        int best = -1;
        float bs = 1e9f;
        for (int i = 0; i < n; i++) {
            if (!ok(i)) continue;
            vec2 d = pos(i) - from;
            float along = dot(d, want);
            if (along <= 4 || along < 0.57f * length(d)) continue;   // ahead, within about 55 degrees of the push
            float score = along + std::fabs(dot(d, vec2{want.y, -want.x})) * 1.8f;
            if (score < bs) { bs = score; best = i; }
        }
        return best;
    };
    if (view == 1) {   // the Astrolabe
        auto& nodes = astro_nodes();
        if (step >= 0) {
            int b = nearest(astro_screen(nodes[size_t(astro_cursor)]), int(nodes.size()), [&](int i) { return astro_screen(nodes[size_t(i)]); },
                            [](int) { return true; });
            if (b >= 0) { astro_cursor = b; w.emit(Ev::Craft, w.actors[0].pos, 0); }
        }
        if (in.hit(BTN_SOUTH)) {
            if (H.astro >> astro_cursor & 1) say("You hold this already");
            else if (H.astro_points() <= 0) say("Finish a site for another Astrolabe point");
            else if (!astro_can_take(H.astro, astro_cursor)) say("Take the node before it first");
            else {
                H.astro |= 1u << astro_cursor;
                say(std::string("Set: ") + nodes[size_t(astro_cursor)].name);
                w.emit(Ev::LevelUp, w.actors[0].pos);
            }
        }
        return;
    }
    if (picking) {
        int n = int(picks.size());
        if (step4 == D_UP) pick = (pick + n - 1) % n;
        if (step4 == D_DOWN) pick = (pick + 1) % n;
        if (in.hit(BTN_SOUTH) && n > 0) { go_site = cursor; go_chart = picks[size_t(pick)]; picking = false; open = false; }
        return;
    }
    auto visible = [&](int i) { return (H.sites_revealed >> i & 1) != 0; };
    if (step >= 0) {
        int b = nearest(site_screen(sites()[size_t(cursor)]), int(sites().size()), [&](int i) { return site_screen(sites()[size_t(i)]); }, visible);
        if (b >= 0) { cursor = b; w.emit(Ev::Craft, w.actors[0].pos, 0); }
    }
    if (in.hit(BTN_SOUTH)) {
        if (!visible(cursor)) { say("Finish a neighbouring site to reveal this one"); return; }
        int tier = sites()[size_t(cursor)].tier;
        picks.clear();
        for (size_t i = 0; i < H.inv.items.size(); i++)
            if (chart_tier(H.inv.items[i].item) == tier) picks.push_back(int(i));
        if (picks.empty()) { say("You carry no chart of " + tier_name(tier)); return; }
        pick = 0;
        picking = true;
    }
}

void MapScreen::render(const World& w) const {
    if (!open) return;
    Ui& u = ui();
    struct KeepEast { bool was = ui().set_mirror_enabled(false); ~KeepEast() { ui().set_mirror_enabled(was); } } keep;   // al-Idrisi's map is not mirrored
    const Hero& H = w.hero;
    u.rect(0, 0, 1920, 1080, pal::night.alpha(0.96f));
    // the round world: the encircling ocean, the land, the seas
    u.disc(MX, MY, MR + 14, Rgba::hex(0x1A2A48));
    u.disc(MX, MY, MR, Rgba::hex(0x24406A));
    u.disc(MX, MY, MR - 30, Rgba::hex(0xC8A870));
    auto sea = [&](std::initializer_list<vec2> pts, float wdt, Rgba c) {
        vec2 prev{-999, -999};
        for (vec2 p : pts) {
            vec2 q = disc_pt(p.x, p.y);
            if (prev.x > -998) u.line(prev.x, prev.y, q.x, q.y, wdt, c);
            u.disc(q.x, q.y, wdt * 0.5f, c);
            prev = q;
        }
    };
    Rgba water = Rgba::hex(0x3A6A9A);
    // the Sea of the Rum, across the lower middle (north is down): Africa above it, the lands of the Rum below
    sea({{-0.66f, 0.40f}, {-0.45f, 0.38f}, {-0.2f, 0.37f}, {0.05f, 0.33f}, {0.3f, 0.32f}, {0.5f, 0.42f}, {0.62f, 0.44f}, {0.8f, 0.42f},
         {0.92f, 0.40f}}, 70, water);
    sea({{0.05f, 0.45f}, {0.15f, 0.58f}}, 40, water);                                    // the Adriatic's mouth
    sea({{-0.2f, 0.45f}, {-0.28f, 0.56f}}, 34, water);                                   // the Aegean
    sea({{-0.63f, 0.18f}, {-0.7f, -0.05f}, {-0.78f, -0.3f}, {-0.86f, -0.55f}}, 26, water); // the Sea of Qulzum, up the page
    sea({{-0.74f, 0.05f}, {-0.79f, -0.1f}}, 12, water);                                   // the gulf of Ayla
    sea({{-0.42f, 0.33f}, {-0.46f, 0.18f}, {-0.47f, 0.10f}, {-0.47f, -0.08f}, {-0.5f, -0.3f}, {-0.52f, -0.52f}, {-0.48f, -0.78f}}, 8,
        Rgba::hex(0x4A7AAA));                                                              // the Nile, running up to the south
    // the eclipse's path: a dark band across the world
    for (int k = -3; k <= 3; k++) {
        vec2 a = {MX - MR * 0.95f, MY - MR * 0.55f + k * 7}, b = {MX + MR * 0.95f, MY + MR * 0.35f + k * 7};
        u.line(a.x, a.y, b.x, b.y, 6, Rgba::hex(0x100C18).alpha(0.16f));
    }
    u.text(MX, MY - MR - 58, "SOUTH", 22, pal::dim, Align::Center, 1.f);
    u.text(MX, MY + MR + 26, "NORTH", 22, pal::dim, Align::Center, 1.f);
    // Cairo: the rooftop
    vec2 cairo = disc_pt(-0.47f, 0.10f);
    u.disc(cairo.x, cairo.y, 10, pal::amber);
    u.ring(cairo.x, cairo.y, 18, 15, pal::amber.alpha(0.6f));
    u.text(cairo.x + 16, cairo.y + 6, "Misr", 20, pal::night, Align::Left, 1.f);
    auto& S = sites();
    // links first
    for (size_t i = 0; i < S.size(); i++)
        for (const char* l : S[i].links) {
            int j = find_site(l);
            if (j < 0 || !((H.sites_revealed >> i & 1) || (H.sites_revealed >> j & 1))) continue;
            vec2 a = site_screen(S[i]), b = site_screen(S[size_t(j)]);
            bool lit = (H.sites_done >> i & 1) && (H.sites_revealed >> j & 1);
            u.line(a.x, a.y, b.x, b.y, lit ? 3.f : 2.f, lit ? pal::brass.alpha(0.8f) : Rgba::hex(0x5A4428).alpha(0.6f));
        }
    for (size_t i = 0; i < S.size(); i++) {   // the First Clime's roads from Cairo
        if (S[i].tier != 1 || !(H.sites_revealed >> i & 1)) continue;
        vec2 b = site_screen(S[i]);
        u.line(cairo.x, cairo.y, b.x, b.y, 2, Rgba::hex(0x5A4428).alpha(0.5f));
    }
    float pulse = 0.5f + 0.5f * std::sin(w.time * 4.f);
    for (size_t i = 0; i < S.size(); i++) {
        vec2 p = site_screen(S[i]);
        bool rev = H.sites_revealed >> i & 1, done = H.sites_done >> i & 1;
        Rgba tc = tier_color(S[i].tier);
        if (!rev) { u.disc(p.x, p.y, 5, Rgba::hex(0x5A4428).alpha(0.5f)); continue; }
        if (!done) u.ring(p.x, p.y, 21, 17, tc.alpha(0.4f + 0.5f * pulse));
        u.disc(p.x, p.y, 13, done ? tc : pal::night);
        u.ring(p.x, p.y, 13, 10, tc);
        u.text(p.x, p.y + 18, S[i].name, 20, pal::night, Align::Center, 1.f);
        if (int(i) == cursor && view == 0) u.ring(p.x, p.y, 30, 26, pal::amber);
    }
    // the side panel
    u.frame(IX, 36, IW, 1008, pal::panel.alpha(0.96f), pal::line, 16, 2);
    float y = 60;
    u.text(IX + IW / 2, y, view == 0 ? "The Map of al-Idrisi" : "The Astrolabe", 38, pal::amber, Align::Center, 1.2f, true);
    y += 54;
    u.text(IX + IW / 2, y, view == 0 ? "Drawn for King Roger of Sicily, 1154, with south at the top" : "Its rete turns one pointer for every site you finish", 20, pal::dim, Align::Center);
    y += 50;
    // your charts, by tier: the four Climes of the early map in one row; once Act V is over, all sixteen in two
    const bool reaches = (H.quests & Q_ACT5) != 0;
    for (int t = 1; t <= (reaches ? kChartTiers : kChartTiersEarly); t++) {
        int n = 0;
        for (auto& e : H.inv.items) if (chart_tier(e.item) == t) n++;
        float x = reaches ? IX + 30 + ((t - 1) % 8) * 66 : IX + 40 + (t - 1) * 92, ty = reaches ? y + ((t - 1) / 8) * 44 : y;
        u.disc(x + 14, ty + 16, 11, tier_color(t));
        u.text(x + 32, ty + 2, std::to_string(n), reaches ? 26 : 30, n ? pal::bone : pal::dim, Align::Left, 1.f);
    }
    if (!reaches) u.text(IX + IW - 30, y + 6, "charts by Clime", 20, pal::dim, Align::Right);
    y += reaches ? 100 : 60;
    char b[160];
    if (H.currency[CUR_PEARL] > 0 || reaches)
        snprintf(b, sizeof b, "Sites finished: %d of %zu    Astrolabe points: %d    Pearls: %d", __builtin_popcount(H.sites_done), S.size(),
                 H.astro_points(), H.currency[CUR_PEARL]);
    else
        snprintf(b, sizeof b, "Sites finished: %d of %zu      Astrolabe points: %d", __builtin_popcount(H.sites_done), S.size(), H.astro_points());
    u.text(IX + IW / 2, y, b, fit(b, 22, IW - 40), pal::soft, Align::Center);
    y += reaches ? 40 : 50;
    if (view == 0) {
        const Site& s = S[size_t(cursor)];
        bool rev = H.sites_revealed >> cursor & 1, done = H.sites_done >> cursor & 1;
        u.frame(IX + 24, y, IW - 48, 380, pal::panel2, tier_color(s.tier).alpha(0.7f), 12, 2);
        u.text(IX + IW / 2, y + 18, rev ? s.name : "Unknown", 36, rev ? tier_color(s.tier) : pal::dim, Align::Center, 1.f);
        snprintf(b, sizeof b, "%s  \xC2\xB7  Area Level %d", tier_title(s.tier).c_str(), chart_area_level(s.tier));
        u.text(IX + IW / 2, y + 66, b, 24, pal::bone, Align::Center);
        if (rev) {
            u.wrap(IX + 50, y + 110, IW - 100, s.note, 24, pal::soft);
            const ZoneDef& zd = zone_def(find_zone(s.zone));
            int boss = find_monster(zd.boss);
            snprintf(b, sizeof b, "Its master: %s", monster_defs()[size_t(boss)].name);
            u.text(IX + IW / 2, y + 200, b, fit(b, 24, IW - 80), pal::unique, Align::Center);
            u.text(IX + IW / 2, y + 240, done ? "Finished" : "Not yet finished", 24, done ? pal::good : pal::dim, Align::Center, 0.6f);
            ChartRun cr;
            cr.astro = H.astro;
            snprintf(b, sizeof b, "Chance of a Haboob: %d%% (more with the chart's own mods)", int(haboob_chance(cr) * 100 + 0.5f));
            u.text(IX + IW / 2, y + 290, b, fit(b, 22, IW - 80), pal::sand, Align::Center);
            int next = 0;
            for (size_t j = 0; j < S.size(); j++) if (site_linked(cursor, int(j)) && !(H.sites_revealed >> j & 1)) next++;
            if (next && !done) {
                snprintf(b, sizeof b, "Finishing it reveals %d more", next);
                u.text(IX + IW / 2, y + 330, b, 22, pal::dim, Align::Center);
            }
        } else {
            u.wrap(IX + 50, y + 110, IW - 100, "Finish a neighbouring site to see where this road leads.", 24, pal::dim);
        }
        y += 400;
        if (picking) {
            u.frame(IX + 24, y, IW - 48, 60 + 52 * std::min<size_t>(6, picks.size()), pal::panel2, pal::amber, 12, 2);
            u.text(IX + 44, y + 12, "Which chart?", 26, pal::amber, Align::Left, 1.f);
            float py = y + 54;
            int first = std::clamp(pick - 3, 0, std::max(0, int(picks.size()) - 6));
            for (int k = first; k < int(picks.size()) && k < first + 6; k++) {
                const Item& it = H.inv.items[size_t(picks[size_t(k)])].item;
                bool cur = k == pick;
                if (cur) u.frame(IX + 34, py - 4, IW - 68, 46, pal::dusk, pal::amber, 8, 2);
                std::string n = it.display_name() + (it.affixes.empty() ? "" : "  (" + std::to_string(it.affixes.size()) + " mods)");
                u.text(IX + 50, py + 4, n, fit(n, 24, IW - 110), Rgba::hex(rarity_color(it.rarity)));
                py += 52;
            }
            // the chosen chart's mods
            if (!picks.empty()) {
                const Item& it = H.inv.items[size_t(picks[size_t(pick)])].item;
                float my = y + 70 + 52 * std::min<size_t>(6, picks.size());
                for (auto& l : it.lines()) {
                    if (l.empty() || l[0] == '#' || l[0] == '~') continue;
                    if (my > 940) break;   // the legend's line
                    u.text(IX + IW / 2, my, l, fit(l, 22, IW - 80), pal::magic, Align::Center);
                    my += 28;
                }
            }
        }
        const bool seal = H.currency[CUR_RIFT_SEAL] > 0,
                   pearls = H.currency[CUR_PEARL] >= kPearlsPerThrone || H.currency[CUR_SCALE] >= kPearlsPerThrone;
        if (!picking && seal && pearls)
            legend(IX + 24, 986, {{BTN_SOUTH, "Chart"}, {BTN_WEST, "Seal"}, {BTN_NORTH, "Pinnacles"}, {BTN_R1, "Astrolabe"}});
        else if (!picking && pearls)
            legend(IX + 24, 986, {{BTN_SOUTH, "Choose a chart"}, {BTN_NORTH, "Pinnacles"}, {BTN_R1, "Astrolabe"}, {BTN_EAST, "Close"}});
        else if (!picking && seal)
            legend(IX + 24, 986, {{BTN_SOUTH, "Choose a chart"}, {BTN_WEST, "Rift Seal"}, {BTN_R1, "Astrolabe"}, {BTN_EAST, "Close"}});
        else
            legend(IX + 24, 986, {{BTN_SOUTH, picking ? "Set out" : "Choose a chart"}, {BTN_R1, "Astrolabe"}, {BTN_EAST, picking ? "Back" : "Close"}});
    } else {
        // the Astrolabe: a rete of four pointers over the plate; nodes along them
        auto& nodes = astro_nodes();
        u.rect(0, 0, IX - 20, 1080, pal::night.alpha(0.75f));
        u.ring(MX, MY, 430, 424, pal::brass.alpha(0.7f));
        u.ring(MX, MY, 350, 347, pal::brass.alpha(0.35f));
        for (int k = 0; k < 24; k++) {   // the limb's hour marks
            float a = kTau * k / 24;
            u.line(MX + std::cos(a) * 410, MY + std::sin(a) * 410, MX + std::cos(a) * 428, MY + std::sin(a) * 428, 3, pal::brass.alpha(0.6f));
        }
        u.disc(MX, MY, 26, pal::brass.alpha(0.8f));
        for (size_t i = 0; i < nodes.size(); i++) {
            vec2 p = astro_screen(nodes[i]);
            vec2 q = nodes[i].parent < 0 ? vec2{MX, MY} : astro_screen(nodes[size_t(nodes[i].parent)]);
            bool lit = H.astro >> i & 1;
            u.line(p.x, p.y, q.x, q.y, lit ? 5.f : 2.f, lit ? pal::brass : pal::line);
        }
        for (size_t i = 0; i < nodes.size(); i++) {
            vec2 p = astro_screen(nodes[i]);
            bool held = H.astro >> i & 1, can = H.astro_points() > 0 && astro_can_take(H.astro, int(i));
            if (can) u.ring(p.x, p.y, 24, 20, pal::amber.alpha(0.4f + 0.5f * pulse));
            u.disc(p.x, p.y, 15, held ? pal::brass : pal::panel2);
            u.ring(p.x, p.y, 15, 12, pal::brass);
            if (int(i) == astro_cursor) u.ring(p.x, p.y, 30, 26, pal::amber);
        }
        for (const char* star : {"Suhail", "al-Simak", "al-Shi'ra", "al-Nasr"}) {   // the pointers' names
            for (size_t i = 0; i < nodes.size(); i++)
                if (std::string(nodes[i].star) == star && nodes[i].parent < 0) {
                    vec2 p = astro_screen(nodes[i]);
                    vec2 d = normalize(p - vec2{MX, MY});
                    u.text(MX + d.x * 470, MY + d.y * 470 - 12, star, 24, pal::brass, Align::Center, 1.f);
                }
        }
        const AstroNode& n = nodes[size_t(astro_cursor)];
        u.frame(IX + 24, y, IW - 48, 220, pal::panel2, pal::brass.alpha(0.7f), 12, 2);
        u.text(IX + IW / 2, y + 18, n.name, fit(n.name, 34, IW - 90), pal::brass, Align::Center, 1.f);
        u.text(IX + IW / 2, y + 66, std::string("on the pointer of ") + n.star, 22, pal::dim, Align::Center);
        u.wrap(IX + 50, y + 110, IW - 100, n.text, 26, pal::magic);
        legend(IX + 24, 986, {{BTN_SOUTH, "Set"}, {BTN_L1, "Map"}, {BTN_EAST, "Close"}});
    }
    if (pinnacles) {
        const float x = IX + 24, wdt = IW - 48, y0 = 300;
        u.rect(IX, 0, 1920 - IX, 1080, pal::night.alpha(0.9f));
        u.text(IX + IW / 2, y0 - 80, "The Pinnacles", 40, pal::brass, Align::Center, 1.f);
        for (int p = 0; p < PIN_COUNT; p++) {
            const PinnacleDef& d = pinnacle_def(p);
            const bool can = H.currency[d.currency] >= d.cost, cur = p == pin_cursor;
            const float y = y0 + p * 120.f;
            u.frame(x, y, wdt, 104, cur ? pal::panel2 : pal::panel2.alpha(0.5f), cur ? pal::amber : pal::brass.alpha(0.4f), 10, 2);
            u.text(x + 24, y + 12, d.name, fit(d.name, 32, wdt - 48), d.uber ? Rgba::hex(0xE07AB0) : pal::bone, Align::Left, 1.f);
            char k[96];
            snprintf(k, sizeof k, "%d %s  (you hold %d)", d.cost, d.currency == CUR_PEARL ? "King's Pearls" : "Scales of Falak",
                     H.currency[d.currency]);
            u.text(x + 24, y + 60, k, 24, can ? pal::magic : pal::dim);
        }
        const PinnacleDef& d = pinnacle_def(pin_cursor);
        u.wrap(x + 12, y0 + PIN_COUNT * 120.f + 20, wdt - 24, std::string("Its keys: ") + d.where, 24, pal::soft);
        legend(IX + 24, 986, {{BTN_SOUTH, "Set out"}, {BTN_UP, "Choose"}, {BTN_EAST, "Back"}});
    }
    if (msg_t > 0) {
        float a = std::min(1.f, msg_t / 0.3f);
        float tw = u.text_width(msg, 30) + 60;
        u.frame(MX - tw / 2, 960, tw, 56, pal::panel2.alpha(a), pal::brass.alpha(a), 10, 2);
        u.text(MX, 968, msg, 30, pal::bone.alpha(a), Align::Center, 0.6f);
    }
}

}  // namespace q
