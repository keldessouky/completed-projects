#include "game/tree.hpp"
#include "core/json.hpp"
#include "core/log.hpp"
#include "core/pack.hpp"
#include <algorithm>
#include <cstring>
#include <deque>

namespace q {

PassiveTree& tree() {
    static PassiveTree t;
    return t;
}

bool PassiveTree::load() {
    if (loaded()) return true;
    Blob b = pack().get("data/tree.json");
    if (!b) { QERR("data/tree.json missing"); return false; }
    return load_json(b.str());
}

bool PassiveTree::load_json(const std::string& text) {
    std::string err;
    Json j = Json::parse(text, &err);
    if (!err.empty()) { QERR("tree.json: %s", err.c_str()); return false; }
    stars.clear();
    edges.clear();
    constellations.clear();
    implemented.clear();
    for (auto& n : j["nodes"].arr) {
        Star s;
        s.id = n["id"].i();
        const std::string& k = n["kind"].str();
        s.kind = k == "attr" ? StarKind::Attr : k == "notable" ? StarKind::Notable : k == "keystone" ? StarKind::Keystone
               : k == "start" ? StarKind::Start : k == "pole" ? StarKind::Pole : StarKind::Minor;
        s.pos = {n["x"].f(), n["y"].f()};
        s.name = n["name"].str();
        s.star = n["star"].str();
        s.constellation = n["const"].str();
        s.cls = n["cls"].str();
        for (auto& t : n["text"].arr) s.text.push_back(t.str());
        for (auto& m : n["mods"].arr) {
            Mod mod{};
            if (!stat_from_key(m[0].str(), mod.stat)) { QWARN("tree: unknown stat %s", m[0].str().c_str()); continue; }
            const std::string& kind = m[1].str();
            mod.kind = kind == "inc" ? MK_INC : kind == "more" ? MK_MORE : MK_FLAT;
            mod.value = m[2].f();
            for (auto& t : m[3].arr) {
                uint32_t tag = 0;
                if (tag_from_key(t.str(), tag)) mod.tags |= tag;
            }
            mod.source = uint16_t(1000 + s.id);
            s.mods.push_back(mod);
        }
        const std::string& flag = n["flag"].str();
        if (flag == "follower") s.keystone = KS_FOLLOWER;
        if (flag == "overload") s.keystone = KS_OVERLOAD;
        if (flag == "point_blank") s.keystone = KS_POINT_BLANK;
        if (flag == "brand") s.keystone = KS_BRAND;
        if (flag == "agony") s.keystone = KS_AGONY;
        if (flag == "all_fire") s.keystone = KS_ALL_FIRE;
        if (s.id != int(stars.size())) { QERR("tree.json: ids out of order"); return false; }
        stars.push_back(std::move(s));
    }
    for (auto& e : j["edges"].arr) {
        int a = e[0].i(), b = e[1].i();
        if (a < 0 || b < 0 || a >= int(stars.size()) || b >= int(stars.size())) continue;
        edges.push_back({a, b});
        stars[size_t(a)].adj.push_back(b);
        stars[size_t(b)].adj.push_back(a);
    }
    for (auto& c : j["constellations"].arr) {
        Constellation k;
        k.name = c["name"].str();
        k.english = c["english"].str();
        k.centre = {c["x"].f(), c["y"].f()};
        for (auto& s : c["stars"].arr) k.stars.push_back(s.i());
        constellations.push_back(std::move(k));
    }
    for (auto& c : j["implemented"].arr) implemented.push_back(c.str());
    recommended.clear();
    for (auto& kv : j["recommended"].obj) {
        std::vector<int> ids;
        for (auto& s : kv.second.arr) ids.push_back(s.i());
        recommended.push_back({kv.first, ids});
    }
    pole = j["pole"].i(-1);
    return !stars.empty();
}

int PassiveTree::class_start(const std::string& cls) const {
    for (auto& s : stars) if (s.kind == StarKind::Start && s.cls == cls) return s.id;
    return -1;
}

// ---------------------------------------------------------------- allocation
void Allocation::reset(const std::string& c) {
    cls = c;
    taken.assign(tree().stars.size(), 0);
}

int Allocation::spent() const {
    int n = 0;
    for (uint8_t t : taken) n += t;
    return n;
}

static bool passable(const Star& s, const std::string& cls) { return s.kind != StarKind::Start || s.cls == cls; }

bool Allocation::can_take(int id) const {
    const PassiveTree& T = tree();
    if (id < 0 || id >= int(T.stars.size()) || has(id)) return false;
    const Star& s = T.stars[size_t(id)];
    if (s.kind == StarKind::Start) return false;
    int start = T.class_start(cls);
    for (int n : s.adj)
        if (n == start || has(n)) return true;
    return false;
}

bool Allocation::can_refund(int id) const {
    if (!has(id)) return false;
    const PassiveTree& T = tree();
    int start = T.class_start(cls);
    std::vector<uint8_t> seen(T.stars.size(), 0);
    std::deque<int> q{start};
    seen[size_t(start)] = 1;
    while (!q.empty()) {
        int c = q.front();
        q.pop_front();
        for (int n : T.stars[size_t(c)].adj)
            if (!seen[size_t(n)] && n != id && has(n)) { seen[size_t(n)] = 1; q.push_back(n); }
    }
    for (size_t i = 0; i < taken.size(); i++)
        if (taken[i] && int(i) != id && !seen[i]) return false;
    return true;
}

std::vector<int> Allocation::path_to(int target) const {
    const PassiveTree& T = tree();
    std::vector<int> out;
    if (target < 0 || target >= int(T.stars.size()) || has(target)) return out;
    if (!passable(T.stars[size_t(target)], cls) || T.stars[size_t(target)].kind == StarKind::Start) return out;
    // breadth-first from everything we hold (and the start): the first time we reach the target is the cheapest
    std::vector<int> prev(T.stars.size(), -2);
    std::deque<int> q;
    int start = T.class_start(cls);
    prev[size_t(start)] = -1;
    q.push_back(start);
    for (size_t i = 0; i < taken.size(); i++)
        if (taken[i]) { prev[i] = -1; q.push_back(int(i)); }
    while (!q.empty()) {
        int c = q.front();
        q.pop_front();
        if (c == target) break;
        for (int n : T.stars[size_t(c)].adj) {
            if (prev[size_t(n)] != -2 || !passable(T.stars[size_t(n)], cls)) continue;
            prev[size_t(n)] = c;
            q.push_back(n);
        }
    }
    if (prev[size_t(target)] == -2) return out;
    for (int c = target; c >= 0 && !has(c) && c != start; c = prev[size_t(c)]) out.push_back(c);
    std::reverse(out.begin(), out.end());
    return out;
}

void Allocation::apply(Stats& s) const {
    const PassiveTree& T = tree();
    for (size_t i = 0; i < taken.size() && i < T.stars.size(); i++)
        if (taken[i])
            for (const Mod& m : T.stars[i].mods) s.add(m);
}

uint64_t Allocation::keystones() const {
    uint64_t k = 0;
    const PassiveTree& T = tree();
    for (size_t i = 0; i < taken.size() && i < T.stars.size(); i++)
        if (taken[i]) k |= T.stars[i].keystone;
    return k;
}

std::vector<int> Allocation::held() const {
    std::vector<int> v;
    for (size_t i = 0; i < taken.size(); i++) if (taken[i]) v.push_back(int(i));
    return v;
}

// ---------------------------------------------------------------- build codes
// "Q1" + class letter + "-" + the held-star bitset in Crockford base-32 + "-" + two checksum characters.
static const char kB32[] = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
static const struct { const char* cls; char letter; } kClassLetters[] = {
    {"warrior", 'W'}, {"sorcerer", 'S'}, {"templar", 'T'}, {"ranger", 'R'}, {"mercenary", 'M'}, {"shadow", 'H'}, {"wanderer", 'P'}};

static uint32_t crc(const std::string& s) {
    uint32_t c = 0xFFFFFFFFu;
    for (unsigned char ch : s) {
        c ^= ch;
        for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1u)));
    }
    return ~c;
}

std::string build_code(const Allocation& a) {
    char letter = 'W';
    for (auto& e : kClassLetters) if (a.cls == e.cls) letter = e.letter;
    std::string bits;
    uint32_t acc = 0;
    int n = 0;
    for (size_t i = 0; i < a.taken.size(); i++) {
        acc = (acc << 1) | (a.taken[i] ? 1u : 0u);
        if (++n == 5) { bits += kB32[acc]; acc = 0; n = 0; }
    }
    if (n) bits += kB32[acc << (5 - n)];
    while (bits.size() > 1 && bits.back() == '0') bits.pop_back();  // trailing empty stars
    std::string body = std::string("Q1") + letter + "-" + bits;
    uint32_t c = crc(body) & 1023;
    return body + "-" + kB32[c >> 5] + kB32[c & 31];
}

bool parse_build_code(const std::string& code, Allocation& out) {
    size_t d1 = code.find('-'), d2 = code.rfind('-');
    if (code.size() < 8 || code.compare(0, 2, "Q1") != 0 || d1 != 3 || d2 == d1) return false;
    std::string body = code.substr(0, d2), sum = code.substr(d2 + 1);
    uint32_t c = crc(body) & 1023;
    if (sum.size() != 2 || sum[0] != kB32[c >> 5] || sum[1] != kB32[c & 31]) return false;
    std::string cls;
    for (auto& e : kClassLetters) if (code[2] == e.letter) cls = e.cls;
    if (cls.empty()) return false;
    Allocation a;
    a.reset(cls);
    std::string bits = code.substr(4, d2 - 4);
    size_t i = 0;
    for (char ch : bits) {
        const char* p = strchr(kB32, ch);
        if (!p || !*p) return false;
        int v = int(p - kB32);
        for (int k = 4; k >= 0; k--, i++)
            if (v >> k & 1) {
                if (i >= a.taken.size()) return false;
                a.taken[i] = 1;
            }
    }
    out = a;
    return true;
}

}  // namespace q
