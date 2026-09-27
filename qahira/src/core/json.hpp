// Small JSON reader for game data tables.
#pragma once
#include <string>
#include <vector>
#include <utility>

namespace q {

struct Json {
    enum Type { Null, Bool, Number, String, Array, Object } type = Null;
    bool b = false;
    double n = 0;
    std::string s;
    std::vector<Json> arr;
    std::vector<std::pair<std::string, Json>> obj;

    static Json parse(const std::string& text, std::string* err = nullptr);
    const Json& operator[](const char* key) const;
    const Json& operator[](size_t i) const { static Json nil; return i < arr.size() ? arr[i] : nil; }
    bool has(const char* key) const;
    size_t size() const { return type == Array ? arr.size() : obj.size(); }
    bool is_null() const { return type == Null; }
    float f(float def = 0) const { return type == Number ? float(n) : def; }
    int i(int def = 0) const { return type == Number ? int(n) : def; }
    bool boolean(bool def = false) const { return type == Bool ? b : def; }
    const std::string& str() const { return s; }
    std::string str_or(const char* def) const { return type == String ? s : std::string(def); }
};

}  // namespace q
