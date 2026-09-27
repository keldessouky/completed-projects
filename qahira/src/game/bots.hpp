// Headless test pilots: they drive the game through the same Input a player would (menus included), and
// report pass/fail.
//   walk   the hub: move, and a save state round trip
//   fight  the Slice 1 street: clear the packs and the rare, equip upgrades through the inventory
//   zone   Slice 2's exit, now in Downtown: hub -> the waypoint list -> Wust el-Balad -> town portal round trip ->
//          the cache -> the Iron Microbus (with a save state mid-fight) -> home -> vendor, then a character file round trip
//   act1   Slice 4's exit: a fresh character plays Act I through, Downtown to the Mokattam cliffs, the Bab Zuweila
//          trial and the bench included, spending its stars and ascendancy points and wearing what it finds
//   tour   not a test: a scripted visit of every screen for screenshots (it gives itself gear)
#pragma once
#include "game/areas.hpp"
#include "game/menu.hpp"
#include "game/sky.hpp"
#include "game/title.hpp"
#include "game/world.hpp"
#include <string>
#include <vector>

namespace q {

struct Bot {
    std::string scenario;
    int status = 0;              // 0 running, 1 pass, 2 fail
    std::string message;
    int deaths = 0;
    int initial_enemies = 0;
    bool rare_seen = false, rare_killed = false, picked_up = false, state_ok = false;
    vec2 start_pos;
    Sky* sky_ui = nullptr;       // the app's tree screen
    Title* title_ui = nullptr;   // and its title screen
    WaypointList* wp_ui = nullptr;
    std::string save_dir;
    void start(const char* s);
    bool uses_title() const { return scenario == "title"; }
    const char* default_class() const { return scenario == "sorcerer" || scenario == "sky" || scenario == "tour3" ? "sorcerer" : "warrior"; }
    void drive(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);

private:
    // zone scenario
    int stage = 0;
    int zone_kills0 = 0, portal_monsters = 0, sold = 0, zone_cells = 0;
    bool portal_done = false, vendor_done = false, chest_done = false, boss_state_ok = false, upgraded = false;
    uint64_t stage_frame = 0, boss_frame = 0;
    int menu_guard = 0, equips = 0, gold_expected = 0, beads0 = 0;
    uint32_t equip_target = 0;   // seed of the item being equipped through the menu
    // path following on the level's nav grid
    std::vector<vec2> path_;
    vec2 path_goal_;
    uint64_t path_frame_ = 0, now_ = 0;
    size_t path_i_ = 0;

    void press(Input& in, Btn b) { in.down |= 1u << b; in.pressed |= 1u << b; }
    void pass(const std::string& m) { status = 1; message = m; }
    void fail(const std::string& m) { status = 2; message = m; }
    void walk(World& w, Input& in, uint64_t frame);
    void fight(World& w, Menu& m, Input& in, uint64_t frame);
    void zone(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void sky(World& w, Input& in, uint64_t frame);
    void title(World& w, Input& in, uint64_t frame);
    void tour3(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void bestiary(World& w, Areas& a, Input& in, uint64_t frame);
    void tour4(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void act1(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour5(World& w, Areas& a, Input& in, uint64_t frame);
    // act1 scenario
    uint32_t act_seed_ = 0;
    std::vector<uint8_t> visited_;
    uint64_t act_zone_frame_ = 0, act_moved_frame_ = 0;
    vec2 act_last_pos_;
    int act_goal_ = -1, act_zones_ = 0;
    int zone_deaths_ = 0, grind_zone_ = -1, grind_until_ = 0, last_target_ = -1;
    std::vector<std::pair<uint32_t, bool>> judged_;   // gear already weighed: seed, upgrade?
    bool upgrade(World& w, const Item& it);
    // sky scenario
    std::vector<int> sky_targets_;
    int sky_steps_ = 0, sky_last_cursor_ = -1, sky_stuck_ = 0, placed_ = 0;
    uint64_t sky_open_frame_ = 0;
    int vials_ = 0, gold_ = 0;
    std::string zone_name_;

    // shared skills
    bool combat(World& w, Input& in, uint64_t frame, float reach);   // true while fighting
    bool caster_combat(World& w, Input& in, uint64_t frame, float reach);
    bool loot_and_equip(World& w, Menu& m, Input& in, uint64_t frame);  // true while busy with loot or the menu
    bool menu_nav(const World& w, const Menu& m, Input& in, uint64_t frame, Region r, int x, int y);
    void steer(World& w, Input& in, vec2 target);
    void chase(World& w, Input& in, const Actor& e);
    std::vector<uint32_t> ignored_;
    uint32_t chase_id_ = 0;
    vec2 chase_pos_;
    uint64_t chase_frame_ = 0;
    bool unreachable(uint32_t id) const { for (uint32_t i : ignored_) if (i == id) return true; return false; }
    bool go_to_interact(World& w, Input& in, uint64_t frame, Interactable::Kind k);
};

}  // namespace q
