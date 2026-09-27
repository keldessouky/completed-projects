#include "core/pack.hpp"
#include "core/log.hpp"
#include <cstdio>
#include <cstring>
#include <algorithm>

namespace q {

Pack& pack() { static Pack p; return p; }

bool Pack::open_file(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) { QERR("cannot open pack %s", path); return false; }
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    bytes_.resize(size_t(n));
    size_t got = fread(bytes_.data(), 1, size_t(n), f);
    fclose(f);
    if (got != size_t(n)) { QERR("short read on pack"); return false; }
    return parse();
}

bool Pack::open_memory(const void* data, size_t size) {
    bytes_.assign((const uint8_t*)data, (const uint8_t*)data + size);
    return parse();
}

bool Pack::parse() {
    index_.clear();
    Reader r(Blob{bytes_.data(), bytes_.size()});
    char magic[4];
    r.bytes(magic, 4);
    if (memcmp(magic, "QPK1", 4) != 0) { QERR("not a Qahira pack"); return false; }
    version_ = r.get<uint32_t>();
    uint32_t count = r.get<uint32_t>();
    for (uint32_t i = 0; i < count; i++) {
        uint16_t len = r.get<uint16_t>();
        std::string name((const char*)r.skip(len), len);
        uint64_t off = r.get<uint64_t>(), size = r.get<uint64_t>();
        if (off + size > bytes_.size()) { QERR("pack entry %s out of range", name.c_str()); return false; }
        index_[name] = {off, size};
    }
    QLOG("pack v%u: %u entries, %.1f MB", version_, count, bytes_.size() / 1048576.0);
    return true;
}

Blob Pack::get(const std::string& name) const {
    auto it = index_.find(name);
    if (it == index_.end()) return {};
    return Blob{bytes_.data() + it->second.first, size_t(it->second.second)};
}

std::vector<std::string> Pack::list(const std::string& prefix) const {
    std::vector<std::string> out;
    for (auto& kv : index_)
        if (kv.first.compare(0, prefix.size(), prefix) == 0) out.push_back(kv.first);
    std::sort(out.begin(), out.end());
    return out;
}

}  // namespace q
