// A small QR Code encoder for build codes (GDD §5.6): byte mode, error correction level M, versions 1-10
// (up to 213 bytes), with the mask chosen by the standard's penalty rules. No dependencies.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace q {

struct QrCode {
    int size = 0;                    // modules per side (21 for version 1 ... 57 for version 10)
    int version = 0, mask = -1;
    std::vector<uint8_t> dark;       // size*size, row-major, 1 = dark
    bool at(int x, int y) const { return x >= 0 && y >= 0 && x < size && y < size && dark[size_t(y * size + x)]; }
};

// Returns an empty code (size 0) if the text does not fit in version 10.
QrCode qr_encode(const std::string& text);

}  // namespace q
