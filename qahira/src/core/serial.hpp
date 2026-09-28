// Byte streams for save states (libretro serialize) and save files. Little-endian, versioned by the caller.
#pragma once
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace q {

struct ByteWriter {
    std::vector<uint8_t> buf;
    template <class T> void put(const T& v) { const uint8_t* p = (const uint8_t*)&v; buf.insert(buf.end(), p, p + sizeof(T)); }
    void bytes(const void* d, size_t n) { const uint8_t* p = (const uint8_t*)d; buf.insert(buf.end(), p, p + n); }
    void str(const std::string& s) { put(uint32_t(s.size())); bytes(s.data(), s.size()); }
    template <class T> void vec(const std::vector<T>& v) { put(uint32_t(v.size())); bytes(v.data(), v.size() * sizeof(T)); }
};

struct ByteReader {
    const uint8_t* p;
    const uint8_t* end;
    bool ok = true;
    ByteReader(const void* d, size_t n) : p((const uint8_t*)d), end((const uint8_t*)d + n) {}
    template <class T> T get() {
        T v{};
        if (p + sizeof(T) > end) { ok = false; return v; }
        memcpy(&v, p, sizeof(T));
        p += sizeof(T);
        return v;
    }
    template <class T> void get(T& v) { v = get<T>(); }
    void bytes(void* d, size_t n) { if (p + n > end) { ok = false; return; } memcpy(d, p, n); p += n; }
    std::string str() { uint32_t n = get<uint32_t>(); if (p + n > end) { ok = false; return {}; } std::string s((const char*)p, n); p += n; return s; }
    template <class T> void vec(std::vector<T>& v) {
        uint32_t n = get<uint32_t>();
        if (p + size_t(n) * sizeof(T) > end) { ok = false; return; }
        v.resize(n);
        bytes(v.data(), n * sizeof(T));
    }
};

}  // namespace q
