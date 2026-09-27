// The .qpk content pack: the "ROM" that sits in the RP6's roms folder.
// Layout: "QPK1" u32 version u32 count, then per entry {u16 name_len, name, u64 offset, u64 size}, then data.
#pragma once
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace q {

struct Blob {
    const uint8_t* data = nullptr;
    size_t size = 0;
    explicit operator bool() const { return data != nullptr; }
    std::string str() const { return std::string((const char*)data, size); }
};

class Pack {
public:
    bool open_file(const char* path);
    bool open_memory(const void* data, size_t size);
    Blob get(const std::string& name) const;
    bool has(const std::string& name) const { return index_.count(name) != 0; }
    std::vector<std::string> list(const std::string& prefix) const;
    uint32_t version() const { return version_; }

private:
    bool parse();
    std::vector<uint8_t> bytes_;
    std::unordered_map<std::string, std::pair<uint64_t, uint64_t>> index_;
    uint32_t version_ = 0;
};

Pack& pack();  // the loaded content pack

// Little-endian stream reader for binary assets.
struct Reader {
    const uint8_t* p;
    const uint8_t* end;
    explicit Reader(Blob b) : p(b.data), end(b.data + b.size) {}
    bool ok(size_t n) const { return p + n <= end; }
    template <class T> T get() { T v{}; if (ok(sizeof(T))) { __builtin_memcpy(&v, p, sizeof(T)); p += sizeof(T); } return v; }
    void bytes(void* dst, size_t n) { if (ok(n)) { __builtin_memcpy(dst, p, n); p += n; } }
    const uint8_t* skip(size_t n) { const uint8_t* r = p; p += n; return r; }
};

}  // namespace q
