#include "ui/qr.hpp"
#include <algorithm>
#include <cstdlib>

namespace q {

namespace {

// Level M, versions 1-10: error correction codewords per block, and (count, data codewords) for the two block groups
struct Blocks { int ec; int n1, d1, n2, d2; };
const Blocks kM[11] = {{0, 0, 0, 0, 0},     {10, 1, 16, 0, 0}, {16, 1, 28, 0, 0}, {26, 1, 44, 0, 0},
                       {18, 2, 32, 0, 0},   {24, 2, 43, 0, 0}, {16, 4, 27, 0, 0}, {18, 4, 31, 0, 0},
                       {22, 2, 38, 2, 39},  {22, 3, 36, 2, 37}, {26, 4, 43, 1, 44}};
const int kAlign[11][3] = {{0}, {0}, {6, 18}, {6, 22}, {6, 26}, {6, 30}, {6, 34}, {6, 22, 38}, {6, 24, 42}, {6, 26, 46}, {6, 28, 50}};

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1
uint8_t gf_mul(uint8_t a, uint8_t b) {
    int r = 0;
    for (int i = 7; i >= 0; i--) {
        r = (r << 1) ^ ((r >> 7) * 0x11D);
        r ^= ((b >> i) & 1) * a;
    }
    return uint8_t(r);
}

std::vector<uint8_t> rs_divisor(int degree) {
    std::vector<uint8_t> r(size_t(degree), 0);
    r.back() = 1;
    uint8_t root = 1;
    for (int i = 0; i < degree; i++) {
        for (size_t j = 0; j < r.size(); j++) {
            r[j] = gf_mul(r[j], root);
            if (j + 1 < r.size()) r[j] ^= r[j + 1];
        }
        root = gf_mul(root, 0x02);
    }
    return r;
}

std::vector<uint8_t> rs_remainder(const std::vector<uint8_t>& data, const std::vector<uint8_t>& div) {
    std::vector<uint8_t> r(div.size(), 0);
    for (uint8_t b : data) {
        uint8_t f = b ^ r[0];
        r.erase(r.begin());
        r.push_back(0);
        for (size_t i = 0; i < r.size(); i++) r[i] ^= gf_mul(div[i], f);
    }
    return r;
}

struct Grid {
    int n;
    std::vector<uint8_t> m, fn;  // modules, and "is a function module"
    explicit Grid(int size) : n(size), m(size_t(size * size), 0), fn(size_t(size * size), 0) {}
    void set(int x, int y, bool d, bool func = true) {
        m[size_t(y * n + x)] = d;
        if (func) fn[size_t(y * n + x)] = 1;
    }
    bool get(int x, int y) const { return m[size_t(y * n + x)]; }
};

void finder(Grid& g, int cx, int cy) {
    for (int dy = -4; dy <= 4; dy++)
        for (int dx = -4; dx <= 4; dx++) {
            int x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= g.n || y >= g.n) continue;
            int d = std::max(std::abs(dx), std::abs(dy));
            g.set(x, y, d != 2 && d != 4);
        }
}

void alignment(Grid& g, int cx, int cy) {
    for (int dy = -2; dy <= 2; dy++)
        for (int dx = -2; dx <= 2; dx++) g.set(cx + dx, cy + dy, std::max(std::abs(dx), std::abs(dy)) != 1);
}

void format_bits(Grid& g, int mask) {
    int data = (0 << 3) | mask;  // level M's indicator is 00
    int rem = data;
    for (int i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    int bits = ((data << 10) | rem) ^ 0x5412;
    auto bit = [&](int i) { return ((bits >> i) & 1) != 0; };
    for (int i = 0; i <= 5; i++) g.set(8, i, bit(i));
    g.set(8, 7, bit(6));
    g.set(8, 8, bit(7));
    g.set(7, 8, bit(8));
    for (int i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));
    for (int i = 0; i < 8; i++) g.set(g.n - 1 - i, 8, bit(i));
    for (int i = 8; i < 15; i++) g.set(8, g.n - 15 + i, bit(i));
    g.set(8, g.n - 8, true);  // the dark module
}

void version_bits(Grid& g, int version) {
    if (version < 7) return;
    int rem = version;
    for (int i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
    long bits = long(version) << 12 | rem;
    for (int i = 0; i < 18; i++) {
        bool b = ((bits >> i) & 1) != 0;
        int a = g.n - 11 + i % 3, c = i / 3;
        g.set(a, c, b);
        g.set(c, a, b);
    }
}

bool mask_bit(int mask, int x, int y) {
    switch (mask) {
        case 0: return (x + y) % 2 == 0;
        case 1: return y % 2 == 0;
        case 2: return x % 3 == 0;
        case 3: return (x + y) % 3 == 0;
        case 4: return (x / 3 + y / 2) % 2 == 0;
        case 5: return x * y % 2 + x * y % 3 == 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 == 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 == 0;
    }
}

long penalty(const Grid& g) {
    const int n = g.n;
    long p = 0;
    // rule 1 (runs of five or more) and rule 3 (finder-like patterns), along rows and then columns
    for (int pass = 0; pass < 2; pass++) {
        for (int a = 0; a < n; a++) {
            int run = 0;
            bool prev = false;
            for (int b = 0; b < n; b++) {
                bool c = pass == 0 ? g.get(b, a) : g.get(a, b);
                if (b == 0 || c != prev) { run = 1; prev = c; }
                else if (++run == 5) p += 3;
                else if (run > 5) p++;
            }
            for (int b = 0; b + 10 < n + 4; b++) {
                auto at = [&](int k) { int i = b + k - 4; return i >= 0 && i < n && (pass == 0 ? g.get(i, a) : g.get(a, i)); };
                static const bool pat[11] = {1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0};
                bool fwd = true, back = true;
                for (int k = 0; k < 11; k++) {
                    if (at(k) != pat[k]) fwd = false;
                    if (at(k) != pat[10 - k]) back = false;
                }
                if (fwd) p += 40;
                if (back) p += 40;
            }
        }
    }
    // rule 2: 2x2 blocks of one colour
    for (int y = 0; y + 1 < n; y++)
        for (int x = 0; x + 1 < n; x++) {
            bool c = g.get(x, y);
            if (c == g.get(x + 1, y) && c == g.get(x, y + 1) && c == g.get(x + 1, y + 1)) p += 3;
        }
    // rule 4: balance of dark and light
    long dark = 0;
    for (uint8_t v : g.m) dark += v;
    long total = long(n) * n;
    long k = (std::abs(dark * 20 - total * 10) + total - 1) / total - 1;
    p += std::max(0L, k) * 10;
    return p;
}

}  // namespace

QrCode qr_encode(const std::string& text) {
    QrCode out;
    int version = 0;
    for (int v = 1; v <= 10; v++) {
        const Blocks& b = kM[v];
        int capacity = b.n1 * b.d1 + b.n2 * b.d2;
        int bits = 4 + (v < 10 ? 8 : 16) + 8 * int(text.size());
        if (bits <= capacity * 8) { version = v; break; }
    }
    if (!version) return out;
    const Blocks& B = kM[version];
    const int capacity = B.n1 * B.d1 + B.n2 * B.d2;
    // the bit stream: byte mode, the count, the bytes, a terminator, then padding
    std::vector<bool> bs;
    auto put = [&](uint32_t v, int n) { for (int i = n - 1; i >= 0; i--) bs.push_back((v >> i) & 1); };
    put(4, 4);
    put(uint32_t(text.size()), version < 10 ? 8 : 16);
    for (unsigned char c : text) put(c, 8);
    put(0, std::min(4, capacity * 8 - int(bs.size())));
    while (bs.size() % 8) bs.push_back(false);
    std::vector<uint8_t> data;
    for (size_t i = 0; i < bs.size(); i += 8) {
        uint8_t v = 0;
        for (int k = 0; k < 8; k++) v = uint8_t(v << 1 | bs[i + size_t(k)]);
        data.push_back(v);
    }
    for (uint8_t pad = 0xEC; int(data.size()) < capacity; pad ^= 0xEC ^ 0x11) data.push_back(pad);
    // split into blocks, add Reed-Solomon codewords, and interleave
    std::vector<std::vector<uint8_t>> blocks, ecs;
    std::vector<uint8_t> div = rs_divisor(B.ec);
    size_t at = 0;
    for (int i = 0; i < B.n1 + B.n2; i++) {
        int len = i < B.n1 ? B.d1 : B.d2;
        std::vector<uint8_t> blk(data.begin() + long(at), data.begin() + long(at + size_t(len)));
        at += size_t(len);
        ecs.push_back(rs_remainder(blk, div));
        blocks.push_back(std::move(blk));
    }
    std::vector<uint8_t> words;
    for (int i = 0; i < std::max(B.d1, B.d2); i++)
        for (auto& b : blocks) if (i < int(b.size())) words.push_back(b[size_t(i)]);
    for (int i = 0; i < B.ec; i++)
        for (auto& e : ecs) words.push_back(e[size_t(i)]);
    // function patterns
    const int n = 17 + 4 * version;
    Grid g(n);
    for (int i = 0; i < n; i++) { g.set(6, i, i % 2 == 0); g.set(i, 6, i % 2 == 0); }
    finder(g, 3, 3);
    finder(g, n - 4, 3);
    finder(g, 3, n - 4);
    for (int a : kAlign[version])
        for (int c : kAlign[version]) {
            if (!a || !c) continue;
            if ((a == 6 && c == 6) || (a == 6 && c == n - 7) || (a == n - 7 && c == 6)) continue;
            alignment(g, a, c);
        }
    format_bits(g, 0);   // reserve the format areas (rewritten with the chosen mask)
    version_bits(g, version);
    // the codewords, in the zig-zag from the bottom right, two columns at a time, skipping the timing column
    size_t bit = 0;
    for (int right = n - 1; right >= 1; right -= 2) {
        if (right == 6) right = 5;
        for (int vert = 0; vert < n; vert++)
            for (int j = 0; j < 2; j++) {
                int x = right - j;
                bool upward = ((right + 1) & 2) == 0;
                int y = upward ? n - 1 - vert : vert;
                if (g.fn[size_t(y * n + x)]) continue;
                bool b = bit < words.size() * 8 && ((words[bit >> 3] >> (7 - (bit & 7))) & 1);
                g.set(x, y, b, false);
                bit++;
            }
    }
    // try every mask, keep the one with the least penalty
    long best = -1;
    int best_mask = 0;
    for (int mk = 0; mk < 8; mk++) {
        Grid t = g;
        for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
                if (!t.fn[size_t(y * n + x)] && mask_bit(mk, x, y)) t.m[size_t(y * n + x)] ^= 1;
        format_bits(t, mk);
        long p = penalty(t);
        if (best < 0 || p < best) { best = p; best_mask = mk; }
    }
    for (int y = 0; y < n; y++)
        for (int x = 0; x < n; x++)
            if (!g.fn[size_t(y * n + x)] && mask_bit(best_mask, x, y)) g.m[size_t(y * n + x)] ^= 1;
    format_bits(g, best_mask);
    out.size = n;
    out.version = version;
    out.mask = best_mask;
    out.dark = g.m;
    return out;
}

}  // namespace q
