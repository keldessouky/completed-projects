// Areas the hero moves between: the rooftop hub, the generated City of the Dead, and the Slice 1 street
// (kept as a combat range for the fight bot). A zone instance stays alive while it is unfinished, so
// portals and the stair lead back into the same streets with the same monsters.
#pragma once
#include "core/serial.hpp"
#include "game/world.hpp"
#include "game/zone.hpp"

namespace q {

enum class AreaId : uint8_t { Hub, Necropolis, Street };
enum class Arrival : uint8_t { Entrance, Portal, Checkpoint };

struct ZoneInstance {
    bool valid = false;
    bool cleared = false;              // the boss is dead: an exit portal waits in her court
    bool has_portal = false;           // a town portal stands in the zone (and in the hub)
    ZoneLayout layout;
    std::vector<Actor> monsters;       // snapshot while the hero is elsewhere
    std::vector<GroundItem> loot;
    std::vector<Interactable> interacts;
    std::vector<uint8_t> revealed;     // per cell, for the overlay map
    vec2 portal;
    int level = 1;
    uint32_t seed = 0;
};

struct Areas {
    AreaId current = AreaId::Hub;
    ZoneInstance zone;

    void enter_hub(World& w, Arrival how);
    void enter_zone(World& w, Arrival how);
    void enter_street(World& w);
    void leave_zone(World& w);                 // snapshot the live zone into the instance
    void close_zone();                         // the instance is finished (exit portal) or abandoned
    void cast_portal(World& w);                // a town portal beside the hero (zones only)
    void open_exit_portal(World& w);           // after the boss falls
    void open_chest(World& w, int interact);   // the Lamplighter's cache
    void respawn(World& w);                    // after death: the zone entrance, the boss healed
    void reveal(const World& w);               // mark zone cells near the hero for the map
    void rebuild(World& w);                    // static geometry and NPCs after a save state loads
    const char* name() const;
    const char* subtitle() const;

    void write(ByteWriter& w) const;
    bool read(ByteReader& r);
};

void populate_zone(World& w, const ZoneLayout& z, int level);

}  // namespace q
