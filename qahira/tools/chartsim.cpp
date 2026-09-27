// qchartsim: tier progression on the Map of al-Idrisi (Slice 5's exit, the simulation half). Many simulated players
// start where Act I leaves them (the First Clime revealed, four charts) and run charts: each run spends a chart of a
// revealed site's Clime, kills what the site holds and draws charts by the game's own rules (game/atlas.cpp), and a
// Haboob (when there is one) leaves its share. Kill counts come from the real zone generator and spawner, over the
// generated tiles. It reports how many runs a player needs to finish a site of the Fourth Clime, how many stall (out
// of charts), and charts gained per run; it flags a stall rate over 5%, a median over 45 runs, or under 8.
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

struct Counts { float normal = 0, magic = 0, rare = 0, cells = 0; };

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
            if (r == Rarity::Normal) c.normal++;
            else if (r == Rarity::Magic) c.magic++;
            else if (r == Rarity::Rare) c.rare++;
        }
        for (auto& cell : z.cells) if (cell.kind == ZoneCell::Normal) c.cells++;
    }
    c.normal /= seeds; c.magic /= seeds; c.rare /= seeds; c.cells /= seeds;
    return c;
}

struct Player {
    std::vector<Item> charts;
    uint32_t revealed = 0, done = 0, astro = 0;
    int runs = 0;
    int t4_at = -1;
    bool stalled = false;
};

// the order a sensible player takes the Astrolabe in: the charts arm first, then the storm, then riches
const int kAstroOrder[] = {0, 1, 3, 4, 2, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 18, 17, 19, 9};

void spend_astro(Player& p) {
    while (astro_points(p.done) - __builtin_popcount(p.astro) > 0) {
        bool took = false;
        for (int n : kAstroOrder)
            if (astro_can_take(p.astro, n)) { p.astro |= 1u << n; took = true; break; }
        if (!took) break;
    }
}

}  // namespace

int main(int argc, char** argv) {
    std::string pack_path = argc > 1 ? argv[1] : std::string(QAHIRA_SOURCE_DIR) + "/build/Qahira.qpk";
    std::string out = argc > 2 ? argv[2] : std::string(QAHIRA_SOURCE_DIR) + "/build/chartsim_report.md";
    if (!pack().open_file(pack_path.c_str())) { std::fprintf(stderr, "qchartsim: no pack at %s\n", pack_path.c_str()); return 2; }
    std::vector<Counts> counts;
    for (size_t s = 0; s < sites().size(); s++) counts.push_back(site_counts(int(s)));

    const int players = 600, max_runs = 80;
    Rng rng(20260927);
    std::vector<int> t4;
    int stalls = 0, slow = 0;
    std::map<int, std::pair<double, int>> gained;   // per tier: charts gained, runs
    int haboobs = 0, total_runs = 0;
    for (int pi = 0; pi < players; pi++) {
        Player p;
        p.revealed = starting_sites();
        for (int k = 0; k < 4; k++) p.charts.push_back(make_chart(1, rng, 0.25f, 0.f));
        while (p.runs < max_runs && p.t4_at < 0) {
            spend_astro(p);
            // the highest Clime we can run; a site not yet done first (it pays an Astrolabe point)
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
                    std::fprintf(stderr, "stall after %d runs: done %x revealed %x charts:", p.runs, p.done, p.revealed);
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
            for (int k = 0, n = boss_chart_drops(run, rng); k < n; k++) p.charts.push_back(make_chart(roll_chart_tier(run, rng), rng, 0.4f, 0.12f));
            if (rng.chance(haboob_chance(run))) {   // a player stays in the storm for about half of it
                haboobs++;
                float meter = rng.range(25.f, 60.f) * (1.f + astro_value(run.astro, AX_HABOOB_METER) / 100.f);
                if (rng.chance(std::min(0.9f, meter / 90.f))) p.charts.push_back(make_chart(roll_chart_tier(run, rng), rng));
            }
            auto& g = gained[run.tier];
            g.first += int(p.charts.size()) - before;
            g.second++;
            p.runs++;
            total_runs++;
            p.done |= 1u << best_site;
            p.revealed |= reveal_after(best_site);
            if (run.tier == kChartTiers) p.t4_at = p.runs;
        }
        if (p.t4_at >= 0) t4.push_back(p.t4_at);
        else if (p.stalled) stalls++;
        else slow++;
    }
    std::sort(t4.begin(), t4.end());
    float stall_rate = float(stalls) / players;
    int median = t4.empty() ? -1 : t4[t4.size() / 2], p90 = t4.empty() ? -1 : t4[t4.size() * 9 / 10];
    std::vector<std::string> flags;
    if (stall_rate > 0.05f) flags.push_back("more than 5% of players run out of charts before the Fourth Clime");
    if (median < 0 || median > 45) flags.push_back("the median player needs more than 45 runs to finish a Fourth Clime site");
    if (float(slow) / players > 0.05f) flags.push_back("more than 5% of players have not finished a Fourth Clime site after " + std::to_string(max_runs) + " runs");
    if (median >= 0 && median < 8) flags.push_back("the Fourth Clime comes too fast: under 8 runs for the median player");

    std::ofstream f(out);
    f << "# Chart simulation\n\n" << players << " simulated players start where Act I leaves them: the First Clime revealed and four "
      << "charts. Each run spends the best chart they can use (a site not yet finished first), kills what the site holds (counted "
      << "from the real spawner over the generated tiles), and draws charts by the game's rules. Flagged: a stall rate over 5%, "
      << "a median over 45 runs to finish a Fourth Clime site, or under 8.\n\n";
    f << "| | |\n|---|---|\n";
    char b[200];
    std::snprintf(b, sizeof b, "| Runs to finish a Fourth Clime site | median %d, 90th percentile %d |\n", median, p90);
    f << b;
    std::snprintf(b, sizeof b, "| Players who ran out of charts | %d of %d (%.1f%%) |\n", stalls, players, stall_rate * 100.f);
    f << b;
    std::snprintf(b, sizeof b, "| Players not there after %d runs | %d |\n", max_runs, slow);
    f << b;
    std::snprintf(b, sizeof b, "| Runs with a Haboob | %.0f%% |\n", total_runs ? 100.0 * haboobs / total_runs : 0.0);
    f << b;
    f << "\n| Clime | Charts gained per run (net of the one spent: subtract 1) |\n|---|---|\n";
    for (auto& [t, g] : gained) {
        std::snprintf(b, sizeof b, "| %d | %.2f over %d runs |\n", t, g.second ? g.first / g.second : 0.0, g.second);
        f << b;
    }
    f << "\n| Site | Normal | Magic | Rare (unmodded, per run) |\n|---|---|---|---|\n";
    for (size_t s = 0; s < sites().size(); s++) {
        std::snprintf(b, sizeof b, "| %s (Clime %d) | %.1f | %.1f | %.1f |\n", sites()[s].name, sites()[s].tier, counts[s].normal,
                      counts[s].magic, counts[s].rare);
        f << b;
    }
    f << "\n## Flags\n\n";
    if (flags.empty()) f << "None.\n";
    for (auto& fl : flags) f << "- " << fl << "\n";
    std::printf("CHARTSIM runs to T4: median %d, p90 %d; stalled %.1f%%, slow %d; ", median, p90, stall_rate * 100.f, slow);
    for (auto& [t, g] : gained) std::printf("T%d %.2f/run ", t, g.second ? g.first / g.second : 0.0);
    std::printf("\nCHARTSIM %zu flags -> %s\n", flags.size(), out.c_str());
    return flags.empty() ? 0 : 1;
}
