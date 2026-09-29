#include "ui/arabic.hpp"
#include <vector>

namespace q {

namespace {
// Presentation Forms-B for U+0621..U+064A: isolated, final, initial, medial (0: the letter has no such form)
struct Forms { char32_t iso, fin, ini, med; };
constexpr Forms kForms[] = {
    {0xFE80, 0, 0, 0},                  // 0621 hamza
    {0xFE81, 0xFE82, 0, 0},             // 0622 alef with madda
    {0xFE83, 0xFE84, 0, 0},             // 0623 alef with hamza above
    {0xFE85, 0xFE86, 0, 0},             // 0624 waw with hamza
    {0xFE87, 0xFE88, 0, 0},             // 0625 alef with hamza below
    {0xFE89, 0xFE8A, 0xFE8B, 0xFE8C},   // 0626 yeh with hamza
    {0xFE8D, 0xFE8E, 0, 0},             // 0627 alef
    {0xFE8F, 0xFE90, 0xFE91, 0xFE92},   // 0628 beh
    {0xFE93, 0xFE94, 0, 0},             // 0629 teh marbuta
    {0xFE95, 0xFE96, 0xFE97, 0xFE98},   // 062A teh
    {0xFE99, 0xFE9A, 0xFE9B, 0xFE9C},   // 062B theh
    {0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0},   // 062C jeem
    {0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4},   // 062D hah
    {0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8},   // 062E khah
    {0xFEA9, 0xFEAA, 0, 0},             // 062F dal
    {0xFEAB, 0xFEAC, 0, 0},             // 0630 thal
    {0xFEAD, 0xFEAE, 0, 0},             // 0631 reh
    {0xFEAF, 0xFEB0, 0, 0},             // 0632 zain
    {0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4},   // 0633 seen
    {0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8},   // 0634 sheen
    {0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC},   // 0635 sad
    {0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0},   // 0636 dad
    {0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4},   // 0637 tah
    {0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8},   // 0638 zah
    {0xFEC9, 0xFECA, 0xFECB, 0xFECC},   // 0639 ain
    {0xFECD, 0xFECE, 0xFECF, 0xFED0},   // 063A ghain
    {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0},   // 063B..063F (rare: drawn as they are)
    {0x0640, 0x0640, 0x0640, 0x0640},   // 0640 tatweel
    {0xFED1, 0xFED2, 0xFED3, 0xFED4},   // 0641 feh
    {0xFED5, 0xFED6, 0xFED7, 0xFED8},   // 0642 qaf
    {0xFED9, 0xFEDA, 0xFEDB, 0xFEDC},   // 0643 kaf
    {0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0},   // 0644 lam
    {0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4},   // 0645 meem
    {0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8},   // 0646 noon
    {0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC},   // 0647 heh
    {0xFEED, 0xFEEE, 0, 0},             // 0648 waw
    {0xFEEF, 0xFEF0, 0, 0},             // 0649 alef maksura
    {0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4},   // 064A yeh
};

bool letter(char32_t c) { return c >= 0x0621 && c <= 0x064A; }
bool haraka(char32_t c) { return (c >= 0x064B && c <= 0x065F) || c == 0x0670; }
const Forms& forms(char32_t c) { return kForms[c - 0x0621]; }
bool joins_next(char32_t c) { return letter(c) && forms(c).ini != 0; }           // dual-joining (and tatweel)
bool joins_prev(char32_t c) { return letter(c) && forms(c).fin != 0; }           // every joining letter
char32_t lam_alef(char32_t alef) {
    switch (alef) {
        case 0x0622: return 0xFEF5;
        case 0x0623: return 0xFEF7;
        case 0x0625: return 0xFEF9;
        case 0x0627: return 0xFEFB;
        default: return 0;
    }
}

enum Dir { L, R, N };
Dir dir_of(char32_t c) {
    if ((c >= 0x0600 && c <= 0x06FF && !(c >= 0x0660 && c <= 0x0669)) || (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF))
        return R;
    if ((c >= '0' && c <= '9') || (c >= 0x0660 && c <= 0x0669)) return L;   // numbers run left to right inside Arabic
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= 0xC0 && c < 0x0600)) return L;
    return N;
}
char32_t mirror(char32_t c) {
    switch (c) {
        case '(': return ')'; case ')': return '(';
        case '[': return ']'; case ']': return '[';
        case '<': return '>'; case '>': return '<';
        case 0xAB: return 0xBB; case 0xBB: return 0xAB;
        default: return c;
    }
}
}  // namespace

std::u32string utf8_to_u32(const std::string& s) {
    std::u32string out;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = (unsigned char)s[i];
        char32_t cp;
        int n;
        if (c < 0x80) { cp = c; n = 1; }
        else if ((c >> 5) == 6) { cp = c & 0x1F; n = 2; }
        else if ((c >> 4) == 14) { cp = c & 0x0F; n = 3; }
        else { cp = c & 0x07; n = 4; }
        for (int k = 1; k < n && i + size_t(k) < s.size(); k++) cp = (cp << 6) | ((unsigned char)s[i + size_t(k)] & 0x3F);
        out.push_back(cp);
        i += size_t(n);
    }
    return out;
}

std::string u32_to_utf8(const std::u32string& s) {
    std::string out;
    for (char32_t c : s) {
        if (c < 0x80) out += char(c);
        else if (c < 0x800) { out += char(0xC0 | (c >> 6)); out += char(0x80 | (c & 0x3F)); }
        else if (c < 0x10000) { out += char(0xE0 | (c >> 12)); out += char(0x80 | ((c >> 6) & 0x3F)); out += char(0x80 | (c & 0x3F)); }
        else {
            out += char(0xF0 | (c >> 18)); out += char(0x80 | ((c >> 12) & 0x3F));
            out += char(0x80 | ((c >> 6) & 0x3F)); out += char(0x80 | (c & 0x3F));
        }
    }
    return out;
}

bool is_arabic(char32_t c) { return (c >= 0x0600 && c <= 0x06FF) || (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF); }

bool has_arabic(const std::string& s) {
    for (size_t i = 0; i + 1 < s.size(); i++)   // U+0600..06FF are D8..DB in UTF-8; the presentation forms start with EF
        if ((unsigned char)s[i] >= 0xD8 && (unsigned char)s[i] <= 0xDB) return true;
    return false;
}

std::u32string shape_arabic(const std::u32string& in) {
    // drop the harakat: the UI's text is unvowelled, and they would break the joining
    std::u32string s;
    for (char32_t c : in) if (!haraka(c)) s.push_back(c);
    std::u32string out;
    for (size_t i = 0; i < s.size(); i++) {
        char32_t c = s[i];
        if (!letter(c) || forms(c).iso == 0) { out.push_back(c); continue; }
        const bool prev = i > 0 && joins_next(s[i - 1]);
        if (c == 0x0644 && i + 1 < s.size() && lam_alef(s[i + 1])) {   // lam and alef make one sign
            out.push_back(lam_alef(s[i + 1]) + (prev ? 1 : 0));
            i++;
            continue;
        }
        const bool next = joins_next(c) && i + 1 < s.size() && joins_prev(s[i + 1]);
        const Forms& f = forms(c);
        out.push_back(prev && next ? f.med : prev ? f.fin : next ? f.ini : f.iso);
    }
    return out;
}

std::u32string visual_order(const std::u32string& s) {
    const size_t n = s.size();
    std::vector<Dir> d(n);
    Dir para = N;
    for (size_t i = 0; i < n; i++) {
        d[i] = dir_of(s[i]);
        if (para == N && d[i] != N) para = d[i];
    }
    if (para == N) return s;
    // separators inside a number stay with it (1,500 · 3.5 · 40%)
    for (size_t i = 0; i < n; i++)
        if (d[i] == N && i > 0 && d[i - 1] == L && s[i - 1] >= '0' && s[i - 1] <= '9') {
            if ((s[i] == '.' || s[i] == ',' || s[i] == ':') && i + 1 < n && s[i + 1] >= '0' && s[i + 1] <= '9') d[i] = L;
            if (s[i] == '%') d[i] = L;
        }
    // a neutral takes its neighbours' side when they agree, else the paragraph's
    for (size_t i = 0; i < n; i++) {
        if (d[i] != N) continue;
        size_t j = i;
        while (j < n && d[j] == N) j++;
        Dir before = i > 0 ? d[i - 1] : para, after = j < n ? d[j] : para;
        Dir r = before == after ? before : para;
        for (size_t k = i; k < j; k++) d[k] = r;
        i = j - 1;
    }
    // runs, then their order
    struct Run { size_t a, b; Dir dir; };
    std::vector<Run> runs;
    for (size_t i = 0; i < n;) {
        size_t j = i;
        while (j < n && d[j] == d[i]) j++;
        runs.push_back({i, j, d[i]});
        i = j;
    }
    std::u32string out;
    out.reserve(n);
    auto emit = [&](const Run& r) {
        if (r.dir == R) for (size_t k = r.b; k-- > r.a;) out.push_back(mirror(s[k]));
        else out.append(s, r.a, r.b - r.a);
    };
    if (para == R) for (size_t k = runs.size(); k-- > 0;) emit(runs[k]);
    else for (auto& r : runs) emit(r);
    return out;
}

std::u32string arabic_line(const std::string& utf8) { return visual_order(shape_arabic(utf8_to_u32(utf8))); }

}  // namespace q
