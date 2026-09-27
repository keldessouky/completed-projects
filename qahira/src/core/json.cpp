#include "core/json.hpp"
#include <cstdlib>
#include <cstring>

namespace q {

namespace {
struct P {
    const char* p;
    const char* e;
    std::string err;
    void ws() {
        for (;;) {
            while (p < e && (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t')) p++;
            if (p + 1 < e && p[0] == '/' && p[1] == '/') { while (p < e && *p != '\n') p++; continue; }
            break;
        }
    }
    bool lit(const char* s) { size_t n = strlen(s); if (size_t(e - p) >= n && !strncmp(p, s, n)) { p += n; return true; } return false; }
    static void utf8(std::string& o, unsigned cp) {
        if (cp < 0x80) o += char(cp);
        else if (cp < 0x800) { o += char(0xC0 | (cp >> 6)); o += char(0x80 | (cp & 63)); }
        else if (cp < 0x10000) { o += char(0xE0 | (cp >> 12)); o += char(0x80 | ((cp >> 6) & 63)); o += char(0x80 | (cp & 63)); }
        else { o += char(0xF0 | (cp >> 18)); o += char(0x80 | ((cp >> 12) & 63)); o += char(0x80 | ((cp >> 6) & 63)); o += char(0x80 | (cp & 63)); }
    }
    bool string(std::string& o) {
        if (*p != '"') return false;
        p++;
        while (p < e && *p != '"') {
            if (*p == '\\') {
                p++;
                char c = *p++;
                switch (c) {
                    case 'n': o += '\n'; break; case 't': o += '\t'; break; case 'r': o += '\r'; break;
                    case 'b': o += '\b'; break; case 'f': o += '\f'; break;
                    case 'u': { unsigned cp = strtoul(std::string(p, 4).c_str(), nullptr, 16); p += 4; utf8(o, cp); break; }
                    default: o += c;
                }
            } else o += *p++;
        }
        if (p >= e) return false;
        p++;
        return true;
    }
    bool value(Json& v) {
        ws();
        if (p >= e) { err = "unexpected end"; return false; }
        char c = *p;
        if (c == '{') {
            v.type = Json::Object; p++; ws();
            if (*p == '}') { p++; return true; }
            for (;;) {
                ws();
                std::string k;
                if (!string(k)) { err = "expected key"; return false; }
                ws();
                if (*p != ':') { err = "expected :"; return false; }
                p++;
                Json child;
                if (!value(child)) return false;
                v.obj.emplace_back(std::move(k), std::move(child));
                ws();
                if (*p == ',') { p++; ws(); if (*p == '}') { p++; return true; } continue; }
                if (*p == '}') { p++; return true; }
                err = "expected , or }"; return false;
            }
        }
        if (c == '[') {
            v.type = Json::Array; p++; ws();
            if (*p == ']') { p++; return true; }
            for (;;) {
                Json child;
                if (!value(child)) return false;
                v.arr.push_back(std::move(child));
                ws();
                if (*p == ',') { p++; ws(); if (*p == ']') { p++; return true; } continue; }
                if (*p == ']') { p++; return true; }
                err = "expected , or ]"; return false;
            }
        }
        if (c == '"') { v.type = Json::String; if (!string(v.s)) { err = "bad string"; return false; } return true; }
        if (lit("true")) { v.type = Json::Bool; v.b = true; return true; }
        if (lit("false")) { v.type = Json::Bool; v.b = false; return true; }
        if (lit("null")) { v.type = Json::Null; return true; }
        char* end;
        v.n = strtod(p, &end);
        if (end == p) { err = std::string("unexpected '") + c + "'"; return false; }
        v.type = Json::Number;
        p = end;
        return true;
    }
};
}  // namespace

Json Json::parse(const std::string& text, std::string* err) {
    P ps{text.data(), text.data() + text.size(), {}};
    Json v;
    if (!ps.value(v)) {
        if (err) *err = ps.err + " at offset " + std::to_string(ps.p - text.data());
        return Json{};
    }
    return v;
}

const Json& Json::operator[](const char* key) const {
    static Json nil;
    for (auto& kv : obj) if (kv.first == key) return kv.second;
    return nil;
}

bool Json::has(const char* key) const {
    for (auto& kv : obj) if (kv.first == key) return true;
    return false;
}

}  // namespace q
