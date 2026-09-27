// Areas the hero moves between: the rooftop hub, the campaign's generated zones (game/acts.hpp), and the Slice 1
// street (kept as a combat range for the fight bot). One zone instance stays alive while it is unfinished, so
// portals lead back into the same streets with the same monsters; travelling to another zone starts a new one.
#pragma once
#include "core/serial.hpp"
#include "game/world.hpp"
#include "game/zone.hpp"

namespace q {

enum class AreaId : uint8_t { Hub, Zone, Street };
enum class Arrival : uint8_t { Entrance, Portal, Checkpoint };

struct ZoneInstance {
    bool valid = false;
    int def = -1;                      // the zone (game/acts.hpp)
    bool cleared = false;              // its boss is dead: the way on (or home) is open
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

// The waypoint list (a zone's waypoint or the rooftop stair opens it): zones you can travel to.
struct WaypointList {
    bool open = false;
    int cursor = 0;
    std::vector<int> items;   // zone indices; -1 is the rooftop
};

struct Areas {
    AreaId current = AreaId::Hub;
    ZoneInstance zone;

    void enter_hub(World& w, Arrival how);
    void enter_zone(World& w, int def, Arrival how);   // def -1: the kept instance
    void enter_chart(World& w, int site, const Item& chart);   // a chart consumed at the table: a fresh site
    void arm_haboob(World& w);
    void enter_rift_court(World& w);   // a Rift Seal spent: the Rift Lord's court                 // this site gets a Haboob (its bounds from the layout)
    void enter_street(World& w);
    void leave_zone(World& w);                 // snapshot the live zone into the instance
    void close_zone(World& w);                 // the instance is finished or abandoned (a trial's toll comes back)
    void cast_portal(World& w);                // a town portal beside the hero (zones only)
    void open_exit(World& w);                  // after the boss falls: the way on, or home
    void open_chest(World& w, int interact);   // the landmark's cache
    void respawn(World& w);                    // after death: the zone entrance, the boss healed
    void reveal(const World& w);               // mark zone cells near the hero for the map
    void rebuild(World& w);                    // static geometry and NPCs after a save state loads
    const char* name() const;
    const char* subtitle() const;
    const ZoneDef* def() const { return current == AreaId::Zone && zone.valid ? &zone_def(zone.def) : nullptr; }

    void write(ByteWriter& w) const;
    bool read(ByteReader& r);
};

void populate_zone(World& w, const ZoneLayout& z, const ZoneDef& d, int level, const ChartMods* chart = nullptr);

}  // namespace q
