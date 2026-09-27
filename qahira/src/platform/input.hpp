// Controller state in RetroPad terms. Face buttons are named by position (the RP6 can swap labels).
#pragma once
#include "core/math.hpp"
#include <cstdint>

namespace q {

enum Btn : uint32_t {
    BTN_SOUTH, BTN_EAST, BTN_WEST, BTN_NORTH, BTN_L1, BTN_R1, BTN_L2, BTN_R2, BTN_L3, BTN_R3,
    BTN_SELECT, BTN_START, BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_COUNT
};

struct Input {
    uint32_t down = 0, pressed = 0, released = 0;
    vec2 lstick, rstick;       // x right, y up, unit disc
    float l2 = 0, r2 = 0;      // analog trigger depth 0..1
    bool touching = false;
    bool tapped = false;
    vec2 touch;                // 0..1920 x 0..1080 logical
    bool held(Btn b) const { return (down >> b) & 1; }
    bool hit(Btn b) const { return (pressed >> b) & 1; }
    bool up(Btn b) const { return (released >> b) & 1; }
    void update_edges(uint32_t prev) { pressed = down & ~prev; released = prev & ~down; }
};

}  // namespace q
