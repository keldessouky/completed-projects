// qbuildsim: the build simulator (architecture.md §6). For every playable class and level band it measures the
// Recommended Path against a crowd of random builds on the same gear, and flags outliers:
//   - a Recommended Path more than 2 sigma below the crowd's DPS or EHP (the advice would be bad);
//   - any build more than 4 sigma above the crowd (something on the tree is broken);
//   - a random build that beats the Recommended Path by half again on DPS and EHP at once (the advice is dominated);
//   - a Recommended Path that gets weaker as it levels.
// Writes build/buildsim_report.md; exits 1 when something is flagged.
//   qbuildsim [tree.json] [report.md]
#include "game/classes.hpp"
#include "game/sky.hpp"
#include "game/world.hpp"
#include <cmath>
#include <cstdio>
#include <fstream>
#include <sstream>

using namespace q;

namespace {

struct Sample { float dps, ehp; };

// average gear for a level: the best base of each slot the class would wear, rare, rolled from a seed
void gear_up(Hero& h, int level, uint32_t seed) {
    Rng rng(seed);
    const bool caster = h.passives.cls == "sorcerer";
    auto best_base = [&](Slot slot, bool want_es, int wkind) {
        int best = -1;
        for (size_t i = 0; i < item_bases().size(); i++) {
            const ItemBase& b = item_bases()[i];
            if (b.slot != slot || b.level > level) continue;
            if (slot == Slot::Weapon && b.wkind != wkind) continue;
            if (slot == Slot::Helmet || slot == Slot::Body || slot == Slot::Gloves || slot == Slot::Boots)
                if ((b.es > 0) != want_es) continue;
            if (best < 0 || b.level >= item_bases()[size_t(best)].level) best = int(i);
        }
        return best;
    };
    struct { int eq; Slot slot; } slots[] = {{EQ_WEAPON, Slot::Weapon}, {EQ_HELMET, Slot::Helmet}, {EQ_BODY, Slot::Body},
                                             {EQ_GLOVES, Slot::Gloves}, {EQ_BOOTS, Slot::Boots}, {EQ_BELT, Slot::Belt},
                                             {EQ_AMULET, Slot::Amulet}, {EQ_RING1, Slot::Ring}, {EQ_RING2, Slot::Ring}};
    for (auto& s : slots) {
        int b = best_base(s.slot, caster, caster ? WK_STAFF : WK_MAUL);
        if (b < 0 && s.slot != Slot::Weapon) b = best_base(s.slot, !caster, 0);
        if (b < 0) continue;
        h.equip[s.eq] = make_item(b, Rarity::Rare, level, rng);
    }
}

Hero make_hero(const std::string& cls, int level, uint32_t gear_seed) {
    Hero h;
    h.passives.reset(cls);
    apply_class_base(h, cls);
    give_class_kit(h);
    h.level = level;
    gear_up(h, level, gear_seed);
    // Talismans at the level a player would carve them to, and the attributes to use them are the tree's job
    for (auto& t : h.talismans) t.level = uint8_t(std::max(1, std::min(20, level / 2)));
    return h;
}

void recommended(Hero& h, Rng& rng) {
    const PassiveTree& T = tree();
    h.plan.clear();
    if (const auto* rec = T.recommended_for(h.passives.cls))
        for (int t : *rec) plan_to(h, t);
    int points = h.level - 1;
    for (uint16_t s : h.plan) {
        if (points <= 0) break;
        if (h.passives.can_take(s)) { h.passives.taken[s] = 1; points--; }
    }
    // past the path: the nearest stars, as a player topping up life and damage would
    while (points > 0) {
        std::vector<int> can;
        for (auto& st : T.stars) if (h.passives.can_take(st.id)) can.push_back(st.id);
        if (can.empty()) break;
        h.passives.taken[size_t(can[size_t(rng.irange(0, int(can.size()) - 1))])] = 1;
        points--;
    }
}

void random_build(Hero& h, Rng& rng) {
    const PassiveTree& T = tree();
    int points = h.level - 1;
    while (points > 0) {
        std::vector<int> can;
        for (auto& st : T.stars) if (h.passives.can_take(st.id)) can.push_back(st.id);
        if (can.empty()) break;
        h.passives.taken[size_t(can[size_t(rng.irange(0, int(can.size()) - 1))])] = 1;
        points--;
    }
}

Sample measure(const Hero& h) {
    HeroSummary s = summarize(h);
    return {s.dps, s.ehp};
}

void stats(const std::vector<Sample>& v, float Sample::*f, float& mean, float& sd) {
    mean = 0;
    for (auto& s : v) mean += s.*f;
    mean /= float(std::max<size_t>(1, v.size()));
    sd = 0;
    for (auto& s : v) sd += (s.*f - mean) * (s.*f - mean);
    sd = std::sqrt(sd / float(std::max<size_t>(1, v.size())));
}

}  // namespace

int main(int argc, char** argv) {
    std::string tree_path = argc > 1 ? argv[1] : std::string(QAHIRA_SOURCE_DIR) + "/assets/generated/tree/tree.json";
    std::string report = argc > 2 ? argv[2] : std::string(QAHIRA_SOURCE_DIR) + "/build/buildsim_report.md";
    std::ifstream f(tree_path);
    if (!f) { fprintf(stderr, "buildsim: no tree at %s (run tools/tree/build_tree.py)\n", tree_path.c_str()); return 2; }
    std::stringstream ss;
    ss << f.rdbuf();
    if (!tree().load_json(ss.str())) return 2;
    const int bands[] = {10, 20, 30};
    const int kRandom = 200, kGear = 6;
    std::vector<std::string> flags;
    std::ostringstream out;
    out << "# Build simulator\n\nEach row: the class's Recommended Path against " << kRandom << " random builds, each on the same "
        << kGear << " sets of level-appropriate rare gear (median of the gear sets). Flagged: a Recommended Path more than 2 sd below "
        << "the crowd; any build more than 4 sd above it and 5% above the Recommended Path; a random build 50% ahead of the Recommended Path on DPS and EHP at once; a "
        << "Recommended Path that weakens as it levels. DPS is the first damaging skill's; EHP is life and Hirz "
        << "through armour and resistances.\n\n| Class | Level | Recommended DPS | Crowd DPS (mean +/- sd) | Recommended EHP | Crowd EHP | Flags |\n"
        << "|---|---|---|---|---|---|---|\n";
    for (auto& cd : class_defs()) {
        if (!cd.playable) continue;
        float last_dps = 0;
        for (int band : bands) {
            Rng rng(uint64_t(band) * 7919u + std::string(cd.id).size());
            std::vector<Sample> crowd;
            std::vector<Sample> rec_by_gear;
            float best_dps = 0, best_ehp = 0;
            std::vector<Sample> all;
            for (int g = 0; g < kGear; g++) {
                uint32_t seed = uint32_t(1000 + band * 31 + g);
                Hero r = make_hero(cd.id, band, seed);
                recommended(r, rng);
                rec_by_gear.push_back(measure(r));
                for (int i = 0; i < kRandom / kGear; i++) {
                    Hero h = make_hero(cd.id, band, seed);
                    random_build(h, rng);
                    Sample s = measure(h);
                    crowd.push_back(s);
                    all.push_back(s);
                    best_dps = std::max(best_dps, s.dps);
                    best_ehp = std::max(best_ehp, s.ehp);
                }
            }
            std::sort(rec_by_gear.begin(), rec_by_gear.end(), [](const Sample& a, const Sample& b) { return a.dps < b.dps; });
            Sample rec = rec_by_gear[rec_by_gear.size() / 2];
            float dm, ds, em, es;
            stats(crowd, &Sample::dps, dm, ds);
            stats(crowd, &Sample::ehp, em, es);
            std::string fl;
            auto flag = [&](const std::string& m) { fl += (fl.empty() ? "" : "; ") + m; flags.push_back(std::string(cd.name) + " level " + std::to_string(band) + ": " + m); };
            if (rec.dps < dm - 2 * ds) flag("Recommended DPS is more than 2 sd below the crowd");
            if (rec.ehp < em - 2 * es) flag("Recommended EHP is more than 2 sd below the crowd");
            // an outlier is a problem when it also beats the curated path: a corner of the sky that is simply better
            if (best_dps > dm + 4 * ds + 1e-3f && ds > 0.02f * dm && best_dps > rec.dps * 1.05f)
                flag("a random build's DPS is more than 4 sd above the crowd, and 5% above the Recommended Path");
            if (best_ehp > em + 4 * es + 1e-3f && es > 0.02f * em && best_ehp > rec.ehp * 1.05f)
                flag("a random build's EHP is more than 4 sd above the crowd, and 5% above the Recommended Path");
            for (auto& s : all)
                if (s.dps > rec.dps * 1.5f && s.ehp > rec.ehp * 1.5f) { flag("a random build beats the Recommended Path by 50% on DPS and EHP"); break; }
            if (rec.dps < last_dps) flag("the Recommended Path got weaker since the last band");
            last_dps = rec.dps;
            char row[400];
            snprintf(row, sizeof row, "| %s | %d | %.1f | %.1f +/- %.1f | %.0f | %.0f +/- %.0f | %s |\n", cd.name, band, rec.dps, dm, ds, rec.ehp, em, es,
                     fl.empty() ? "none" : fl.c_str());
            out << row;
            fprintf(stderr, "BUILDSIM %-12s level %2d: recommended %.1f DPS / %.0f EHP; crowd %.1f+/-%.1f DPS (best %.1f), %.0f+/-%.0f EHP (best %.0f)%s\n",
                    cd.name, band, rec.dps, rec.ehp, dm, ds, best_dps, em, es, best_ehp, fl.empty() ? "" : "  <- FLAGGED");
        }
    }
    out << "\n## Flags\n\n";
    if (flags.empty()) out << "none\n";
    for (auto& fl : flags) out << "- " << fl << "\n";
    std::ofstream(report) << out.str();
    fprintf(stderr, "BUILDSIM %zu flag%s -> %s\n", flags.size(), flags.size() == 1 ? "" : "s", report.c_str());
    return flags.empty() ? 0 : 1;
}
