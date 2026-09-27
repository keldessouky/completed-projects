#pragma once
#include "core/serial.hpp"
#include "game/world.hpp"

namespace q {
void write_item(ByteWriter& w, const Item& it);
Item read_item(ByteReader& r);
void write_character(ByteWriter& w, const Hero& h);   // the character save file's payload
bool read_character(ByteReader& r, Hero& h);
void write_actor(ByteWriter& w, const Actor& a);
void read_actor(ByteReader& r, Actor& a);
void write_ground_item(ByteWriter& w, const GroundItem& g);
GroundItem read_ground_item(ByteReader& r);
void write_world(ByteWriter& w, const World& W);
bool read_world(ByteReader& r, World& W);
}  // namespace q
