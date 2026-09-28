// The Book of Fixed Stars: the passive tree's data (loaded from data/tree.json, laid out by tools/tree) and a
// character's allocation on it. PoE rules: a star can be taken when it touches your class start or a star you
// hold; a star can be refunded only if everything you hold stays connected to your start.
#pragma once
#include "core/math.hpp"
#include "game/stats.hpp"
#include <string>
#include <vector>

namespace q {

enum class StarKind : uint8_t { Minor, Attr, Notable, Keystone, Start, Pole };

// keystone rules the simulation has to know about
enum Keystone : uint64_t { KS_FOLLOWER = 1u << 0, KS_OVERLOAD = 1u << 1, KS_POINT_BLANK = 1u << 2, KS_BRAND = 1u << 3, KS_AGONY = 1u << 4 };

struct Star {
    int id = 0;
    StarKind kind = StarKind::Minor;
    vec2 pos;                       // sky units, +y up
    std::string name, star, constellation, cls;
    std::vector<Mod> mods;
    std::vector<std::string> text;
    uint64_t keystone = 0;
    std::vector<int> adj;
};

struct Constellation {
    std::string name, english;
    vec2 centre;
    std::vector<int> stars;
};

class PassiveTree {
public:
    std::vector<Star> stars;
    std::vector<std::pair<int, int>> edges;
    std::vector<Constellation> constellations;
    std::vector<std::string> implemented;   // classes you can play
    int pole = -1;
    // Recommended Paths (GDD §13): per class, the notables and keystones to aim for, in order
    std::vector<std::pair<std::string, std::vector<int>>> recommended;
    const std::vector<int>* recommended_for(const std::string& cls) const {
        for (auto& r : recommended) if (r.first == cls) return &r.second;
        return nullptr;
    }

    bool load();                            // from the pack; true if already loaded
    bool load_json(const std::string& text);
    int class_start(const std::string& cls) const;
    bool loaded() const { return !stars.empty(); }
};
PassiveTree& tree();

struct Allocation {
    std::string cls = "warrior";
    std::vector<uint8_t> taken;             // one per star

    void reset(const std::string& c);
    bool has(int s) const { return s >= 0 && size_t(s) < taken.size() && taken[size_t(s)]; }
    int spent() const;
    bool can_take(int s) const;             // adjacent to the start or a held star
    bool can_refund(int s) const;
    // the cheapest set of stars to take to reach `target`, in allocation order (empty if unreachable or held)
    std::vector<int> path_to(int target) const;
    void apply(Stats& s) const;             // every held star's mods, sourced 1000 + star id
    uint64_t keystones() const;
    std::vector<int> held() const;
};

// Build codes: a short string for a class and its stars, e.g. "Q1W-3F2A..." (base-32, checksummed).
std::string build_code(const Allocation& a);
bool parse_build_code(const std::string& code, Allocation& out);

}  // namespace q
