// qchartsim: tier progression on the Map of al-Idrisi (Slice 5's exit, the simulation half; Slice 9's Reaches). Many
// simulated players run charts: each run spends a chart of a revealed site's tier, kills what the site holds and draws
// charts by the game's own rules (game/atlas.cpp), and a Haboob (when there is one) leaves its share. Kill counts come
// from the real zone generator and spawner, over the generated tiles.
//   The early map: players start where Act I leaves them (the First Clime revealed, four charts), with drops held to the
//   Fourth Clime, and run until they finish a site of it. Flagged: a stall rate over 5%, a median over 45 runs, or under 8.
//   The Reaches: players start where Act V leaves them (the four Climes charted, four charts of the Fourth), with drops
//   open to the Sixteenth, and run until four King's Pearls from the last Reaches' masters open the Marid King's throne.
//   Flagged: a stall rate over 5%, a median over 220 runs to the throne, or under 40, or a tier to the Fourteenth that
//   under 90% of players reach.
//   Levels: the same players, from level 60 as Act V leaves them, earn each run's experience by the game's rules (the
//   site's monsters' own, its area level, the Astrolabe, outgrown areas) on the way to the throne, then farm the
//   Sixteenth Reach. Flagged: level 80 in under 30 runs or not in 150, level 90 not in 700, level 100 in under 500.
//   qchartsim [pack] [report.md]
#include "core/pack.hpp"
#include "game/areas.hpp"
#include "game/level.hpp"
#include "game/zone.hpp"
#include <algorithm>
#include <cstdlib>
#include <cstdio>
#include <fstream>
#include <map>

using namespace q;

namespace {

struct Counts { float normal = 0, magic = 0, rare = 0, cells = 0, xp = 0; };   // xp: the monsters' own, rarity counted

// what a site holds with no chart mods: the average over seeds of the real spawner
Counts site_counts(int site) {
    const ZoneDef& zd = zone_def(find_zone(sites()[size_t(site)].zone));
    Counts c;
    const int seeds = 6;
    for (int s = 1; s <= seeds; s++) {
        ZoneLayout z = generate_zone(uint32_t(s) * 2654435761u + uint32_t(site), zd.w, zd.h, zd.branches);
        World w;
        build_zone_level(z, zd.tileset, w.level);
        w.actors.resize(1);
        populate_zone(w, z, zd, zd.level);
        for (size_t i = 1; i < w.actors.size(); i++) {
            Rarity r = w.actors[i].rarity;
            c.xp += monster_defs()[size_t(w.actors[i].def)].xp * (r == Rarity::Rare ? 6.f : r == Rarity::Magic ? 2.f : 1.f);
            if (r == Rarity::Normal) c.normal++;
            else if (r == Rarity::Magic) c.magic++;
            else if (r == Rarity::Rare) c.rare++;
        }
        for (auto& cell : z.cells) if (cell.kind == ZoneCell::Normal) c.cells++;
    }
    c.normal /= seeds; c.magic /= seeds; c.rare /= seeds; c.cells /= seeds; c.xp /= seeds;
    return c;
}

struct Player {
    std::vector<Item> charts;
    uint32_t revealed = 0, done = 0, astro = 0;
    int runs = 0, pearls = 0;
    int goal_at = -1;              // the run that reached the goal
    int tier_at[kChartTiers + 1];  // the run that first finished a site of each tier
    bool stalled = false;
    int level = 60;                // as Act V leaves you
    float xp = 0;
    int level_at[101];             // the run that reached each level
    Player() { std::fill(std::begin(tier_at), std::end(tier_at), -1); std::fill(std::begin(level_at), std::end(level_at), -1); }
    // a run's experience by the game's rules (World::kill), with the chart's packs and elites in the counts
    void learn(const Counts& c, float normal, float magic, float rare, int area, uint32_t astro_nodes, int run) {
        const float plain = c.normal + 2.f * c.magic + 6.f * c.rare;
        float gain = plain > 0 ? c.xp * (normal + 2.f * magic + 6.f * rare) / plain : 0.f;
        gain *= (1.f + 0.3f * float(area - 1)) * (1.f + astro_value(astro_nodes, AX_XP) / 100.f);
        if (int over = level - area - xp_allowance(area); over > 0) gain *= std::max(0.15f, 1.f - 0.2f * float(over));
        xp += gain;
        while (level < 100 && xp >= level_xp_need(level)) {
            xp -= level_xp_need(level);
            level++;
            if (level_at[level] < 0) level_at[level] = run;
        }
    }
};

// the order a sensible player takes the Astrolabe in: the charts arm first, then the storm, then riches; the Reaches'
// nodes (the tier and the pearls) once they matter
const int kAstroOrder[] = {0, 1, 3, 4, 2, 20, 21, 5, 6, 7, 8, 10, 11, 12, 13, 22, 14, 15, 16, 18, 17, 19, 9};

void spend_astro(Player& p) {
    while (astro_points(p.done) - __builtin_popcount(p.astro) > 0) {
        bool took = false;
        for (int n : kAstroOrder)
            if (astro_can_take(p.astro, n)) { p.astro |= 1u << n; took = true; break; }
        if (!took) break;
    }
}

struct Phase {
    const char* name;
    std::vector<int> goal_runs;
    int stalls = 0, slow = 0, haboobs = 0, total_runs = 0, players = 0;
    std::map<int, std::pair<double, int>> gained;   // per tier: charts gained, runs
    std::map<int, std::vector<int>> reach;          // per tier: the runs to finish a site of it
    int median() const { return goal_runs.empty() ? -1 : goal_runs[goal_runs.size() / 2]; }
    int p90() const { return goal_runs.empty() ? -1 : goal_runs[goal_runs.size() * 9 / 10]; }
    float stall_rate() const { return players ? float(stalls) / float(players) : 0.f; }
};

// one player's charts, from how they start until the goal: a site of `goal_tier` finished, or (goal_tier 0) the throne
void play(Player& p, Phase& ph, const std::vector<Counts>& counts, int max_tier, int goal_tier, int max_runs, Rng& rng) {
    while (p.runs < max_runs && p.goal_at < 0) {
        spend_astro(p);
        // the highest tier we can run; a site not yet done first (it pays an Astrolabe point)
        int best_site = -1, best_chart = -1, best_score = -1;
        for (size_t ci = 0; ci < p.charts.size(); ci++) {
            int tier = chart_tier(p.charts[ci]);
            for (size_t s = 0; s < sites().size(); s++) {
                if (!(p.revealed >> s & 1) || sites()[s].tier != tier) continue;
                int score = tier * 10 + ((p.done >> s & 1) ? 0 : 15);   // an unfinished site: a point, and the road on
                if (score > best_score) { best_score = score; best_site = int(s); best_chart = int(ci); }
            }
        }
        if (best_site < 0) {
            p.stalled = true;
            if (getenv("CHARTSIM_TRACE")) {
                std::fprintf(stderr, "%s: stall after %d runs: done %x revealed %x charts:", ph.name, p.runs, p.done, p.revealed);
                for (auto& c : p.charts) std::fprintf(stderr, " T%d", chart_tier(c));
                std::fprintf(stderr, "\n");
            }
            break;
        }
        Item chart = p.charts[size_t(best_chart)];
        p.charts.erase(p.charts.begin() + best_chart);
        ChartRun run;
        run.tier = sites()[size_t(best_site)].tier;
        run.mods = chart_mods(chart);
        run.astro = p.astro;
        run.max_tier = max_tier;
        const Counts& c = counts[size_t(best_site)];
        // the chart's mods on the site's population, as populate_zone applies them
        float packs = 1.f + run.mods.pack_size / 100.f, elites = run.mods.magic_packs / 100.f;
        float normal = c.normal * packs, magic = c.magic + c.normal * packs * elites * 0.12f, rare = c.rare + c.cells * elites * 0.3f;
        int before = int(p.charts.size());
        auto kills = [&](float n, Rarity r) {
            int whole = int(n) + (rng.chance(n - float(int(n))) ? 1 : 0);
            for (int k = 0; k < whole; k++)
                if (rng.chance(chart_drop_chance(run, r))) p.charts.push_back(make_chart(roll_chart_tier(run, rng), rng));
        };
        kills(normal, Rarity::Normal);
        kills(magic, Rarity::Magic);
        kills(rare, Rarity::Rare);
        p.learn(c, normal, magic, rare, chart_area_level(run.tier), p.astro, p.runs + 1);
        for (int k = 0, n = boss_chart_drops(run, rng); k < n; k++) p.charts.push_back(make_chart(roll_chart_tier(run, rng), rng, 0.4f, 0.12f));
        p.pearls += pearl_drops(run, rng);
        if (rng.chance(haboob_chance(run))) {   // a player stays in the storm for about half of it
            ph.haboobs++;
            float meter = rng.range(25.f, 60.f) * (1.f + astro_value(run.astro, AX_HABOOB_METER) / 100.f);
            if (rng.chance(std::min(0.9f, meter / 90.f))) p.charts.push_back(make_chart(roll_chart_tier(run, rng), rng));
        }
        auto& g = ph.gained[run.tier];
        g.first += int(p.charts.size()) - before;
        g.second++;
        p.runs++;
        ph.total_runs++;
        p.done |= 1u << best_site;
        p.revealed |= reveal_after(best_site);
        if (p.tier_at[run.tier] < 0) p.tier_at[run.tier] = p.runs;
        if (goal_tier > 0 ? run.tier == goal_tier : p.pearls >= kPearlsPerThrone) p.goal_at = p.runs;
    }
    ph.players++;
    for (int t = 1; t <= kChartTiers; t++) if (p.tier_at[t] >= 0) ph.reach[t].push_back(p.tier_at[t]);
    if (p.goal_at >= 0) ph.goal_runs.push_back(p.goal_at);
    else if (p.stalled) ph.stalls++;
    else ph.slow++;
}

}  // namespace

int main(int argc, char** argv) {
    std::string pack_path = argc > 1 ? argv[1] : std::string(QAHIRA_SOURCE_DIR) + "/build/Qahira.qpk";
    std::string out = argc > 2 ? argv[2] : std::string(QAHIRA_SOURCE_DIR) + "/build/chartsim_report.md";
    if (!pack().open_file(pack_path.c_str())) { std::fprintf(stderr, "qchartsim: no pack at %s\n", pack_path.c_str()); return 2; }
    std::vector<Counts> counts;
    for (size_t s = 0; s < sites().size(); s++) counts.push_back(site_counts(int(s)));

    const int players = 600, early_runs = 80, late_runs = 400;
    Rng rng(20260927);
    Phase early{"early"}, late{"reaches"};
    std::map<int, std::vector<int>> level_runs;   // per level: the runs after Act V to reach it
    for (int pi = 0; pi < players; pi++) {   // the early map, as Act I leaves you
        Player p;
        p.revealed = starting_sites();
        for (int k = 0; k < 4; k++) p.charts.push_back(make_chart(1, rng, 0.25f, 0.f));
        play(p, early, counts, kChartTiersEarly, kChartTiersEarly, early_runs, rng);
    }
    for (int pi = 0; pi < players; pi++) {   // the Reaches, as Act V leaves you
        Player p;
        for (size_t s = 0; s < sites().size(); s++) if (sites()[s].tier <= kChartTiersEarly) p.done |= 1u << s;
        p.revealed = starting_sites();
        for (size_t s = 0; s < sites().size(); s++) if (p.done >> s & 1) p.revealed |= reveal_after(int(s));
        for (int k = 0; k < 4; k++) p.charts.push_back(make_chart(kChartTiersEarly, rng, 0.25f, 0.f));
        play(p, late, counts, kChartTiers, 0, late_runs, rng);
        // then the Sixteenth Reach, over and over (its sites in turn, unmodded, with the Astrolabe they have)
        std::vector<int> top;
        for (size_t s = 0; s < sites().size(); s++) if (sites()[s].tier == kChartTiers) top.push_back(int(s));
        for (int r = p.runs + 1; r <= 3000 && p.level < 100; r++) {
            const Counts& c = counts[size_t(top[size_t(r) % top.size()])];
            p.learn(c, c.normal, c.magic, c.rare, chart_area_level(kChartTiers), p.astro, r);
        }
        for (int l = 61; l <= 100; l++) if (p.level_at[l] >= 0) level_runs[l].push_back(p.level_at[l]);
    }
    for (auto& [l, v] : level_runs) std::sort(v.begin(), v.end());
    auto level_median = [&](int l) { auto it = level_runs.find(l); return it == level_runs.end() || it->second.size() < size_t(players / 2) ? -1 : it->second[it->second.size() / 2]; };
    for (Phase* ph : {&early, &late}) {
        std::sort(ph->goal_runs.begin(), ph->goal_runs.end());
        for (auto& [t, v] : ph->reach) std::sort(v.begin(), v.end());
    }
    std::vector<std::string> flags;
    if (level_median(80) >= 0 && level_median(80) < 30) flags.push_back("level 80 comes too fast: under 30 runs after Act V");
    if (level_median(80) < 0 || level_median(80) > 150) flags.push_back("the median player is not level 80 within 150 runs after Act V");
    if (level_median(90) < 0 || level_median(90) > 700) flags.push_back("the median player is not level 90 within 700 runs after Act V");
    if (level_median(100) >= 0 && level_median(100) < 500) flags.push_back("level 100 comes too fast: under 500 runs after Act V");
    if (early.stall_rate() > 0.05f) flags.push_back("more than 5% of players run out of charts before the Fourth Clime");
    if (early.median() < 0 || early.median() > 45) flags.push_back("the median player needs more than 45 runs to finish a Fourth Clime site");
    if (float(early.slow) / players > 0.05f)
        flags.push_back("more than 5% of players have not finished a Fourth Clime site after " + std::to_string(early_runs) + " runs");
    if (early.median() >= 0 && early.median() < 8) flags.push_back("the Fourth Clime comes too fast: under 8 runs for the median player");
    if (late.stall_rate() > 0.05f) flags.push_back("more than 5% of players run out of charts in the Reaches before the Marid King");
    if (late.median() < 0 || late.median() > 220) flags.push_back("the median player needs more than 220 runs after Act V to open the throne");
    if (float(late.slow) / players > 0.05f)
        flags.push_back("more than 5% of players have not opened the throne after " + std::to_string(late_runs) + " runs");
    if (late.median() >= 0 && late.median() < 40) flags.push_back("the throne comes too fast: under 40 runs after Act V for the median player");
    for (int t = kChartTiersEarly + 1; t <= kPearlTier; t++)   // (past it, the pearls can open the throne first)
        if (late.reach[t].size() < size_t(players * 9 / 10)) flags.push_back("under 90% of players finish a site of " + tier_name(t));

    std::ofstream f(out);
    f << "# Chart simulation\n\n" << players << " simulated players, twice. Each run spends the best chart they can use (a site not yet "
      << "finished first), kills what the site holds (counted from the real spawner over the generated tiles), and draws charts by "
      << "the game's rules.\n\n"
      << "- **The early map**: from where Act I leaves you (the First Clime revealed, four charts), drops held to the Fourth Clime, "
      << "until a site of the Fourth Clime is finished. Flagged: a stall rate over 5%, a median over 45 runs, or under 8.\n"
      << "- **The Reaches**: from where Act V leaves you (the four Climes charted, four charts of the Fourth), drops open to the "
      << "Sixteenth Reach, until four King's Pearls open the Marid King's throne. Flagged: a stall rate over 5%, a median over 220 "
      << "runs, or under 40, or under 90% of players finishing a site of any tier to the Fourteenth.\n\n";
    f << "| | |\n|---|---|\n";
    char b[240];
    auto row = [&](const char* label, const Phase& ph, int max_runs, const char* goal) {
        std::snprintf(b, sizeof b, "| %s: runs to %s | median %d, 90th percentile %d |\n", label, goal, ph.median(), ph.p90());
        f << b;
        std::snprintf(b, sizeof b, "| %s: players who ran out of charts | %d of %d (%.1f%%) |\n", label, ph.stalls, ph.players, ph.stall_rate() * 100.f);
        f << b;
        std::snprintf(b, sizeof b, "| %s: players not there after %d runs | %d |\n", label, max_runs, ph.slow);
        f << b;
        std::snprintf(b, sizeof b, "| %s: runs with a Haboob | %.0f%% |\n", label, ph.total_runs ? 100.0 * ph.haboobs / ph.total_runs : 0.0);
        f << b;
    };
    row("The early map", early, early_runs, "finish a Fourth Clime site");
    row("The Reaches", late, late_runs, "open the Marid King's throne");
    f << "\n| Tier | Charts gained per run (net of the one spent: subtract 1) | Runs after Act V to finish a site of it (median) |\n|---|---|---|\n";
    for (int t = 1; t <= kChartTiers; t++) {
        auto& g = t <= kChartTiersEarly ? early.gained[t] : late.gained[t];
        const auto& r = late.reach[t];
        std::snprintf(b, sizeof b, "| %s | %.2f over %d runs | %s |\n", tier_name(t).c_str() + 4, g.second ? g.first / g.second : 0.0, g.second,
                      t <= kChartTiersEarly || r.empty() ? "" : std::to_string(r[r.size() / 2]).c_str());
        f << b;
    }
    f << "\n| Site | Normal | Magic | Rare (unmodded, per run) |\n|---|---|---|---|\n";
    for (size_t s = 0; s < sites().size(); s++) {
        std::snprintf(b, sizeof b, "| %s (tier %d) | %.1f | %.1f | %.1f |\n", sites()[s].name, sites()[s].tier, counts[s].normal,
                      counts[s].magic, counts[s].rare);
        f << b;
    }
    f << "\n## Levels\n\nThe Reaches' players from level 60 as Act V leaves them, by the game's experience rules, to the throne and "
      << "then farming the Sixteenth Reach. Flagged: level 80 in under 30 runs or not in 150, level 90 not in 700, level 100 in under 500.\n\n"
      << "| Level | Runs after Act V (median) | Players who reach it in 3000 runs |\n|---|---|---|\n";
    for (int l : {65, 70, 75, 80, 85, 90, 95, 100}) {
        char b[160];
        const int m = level_median(l);
        snprintf(b, sizeof b, "| %d | %s | %zu of %d |\n", l, m < 0 ? "-" : std::to_string(m).c_str(),
                 level_runs.count(l) ? level_runs[l].size() : size_t(0), players);
        f << b;
    }
    f << "\n## Flags\n\n";
    if (flags.empty()) f << "None.\n";
    for (auto& fl : flags) f << "- " << fl << "\n";
    std::printf("CHARTSIM runs to T4: median %d, p90 %d; stalled %.1f%%, slow %d; ", early.median(), early.p90(), early.stall_rate() * 100.f, early.slow);
    for (int t = 1; t <= kChartTiersEarly; t++) {
        auto& g = early.gained[t];
        std::printf("T%d %.2f/run ", t, g.second ? g.first / g.second : 0.0);
    }
    std::printf("\nCHARTSIM after Act V, runs to the throne: median %d, p90 %d; stalled %.1f%%, slow %d; to T8 %d, T12 %d, T16 %d\n",
                late.median(), late.p90(), late.stall_rate() * 100.f, late.slow,
                late.reach[8].empty() ? -1 : late.reach[8][late.reach[8].size() / 2],
                late.reach[12].empty() ? -1 : late.reach[12][late.reach[12].size() / 2],
                late.reach[16].empty() ? -1 : late.reach[16][late.reach[16].size() / 2]);
    std::printf("CHARTSIM levels after Act V: 70 at %d runs, 80 at %d, 90 at %d, 100 at %d\n", level_median(70), level_median(80),
                level_median(90), level_median(100));
    std::printf("CHARTSIM %zu flags -> %s\n", flags.size(), out.c_str());
    for (auto& fl : flags) std::printf("  flag: %s\n", fl.c_str());
    return flags.empty() ? 0 : 1;
}
