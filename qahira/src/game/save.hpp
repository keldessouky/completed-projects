#pragma once
#include "core/serial.hpp"
#include "game/world.hpp"

namespace q {
void write_item(ByteWriter& w, const Item& it);
Item read_item(ByteReader& r);
void write_world(ByteWriter& w, const World& W);
bool read_world(ByteReader& r, World& W);
}  // namespace q
