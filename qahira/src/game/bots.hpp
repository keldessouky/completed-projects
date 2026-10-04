// Headless test pilots: they drive the game through the same Input a player would (menus included), and
// report pass/fail.
//   walk   the hub: move, and a save state round trip
//   fight  the Slice 1 street: clear the packs and the rare, equip upgrades through the inventory
//   zone   Slice 2's exit, now in Downtown: hub -> the waypoint list -> Wust el-Balad -> town portal round trip ->
//          the cache -> the Iron Microbus (with a save state mid-fight) -> home -> vendor, then a character file round trip
//   act1   Slice 4's exit: a fresh character plays Act I through, Downtown to the Mokattam cliffs, the Bab Zuweila
//          trial and the bench included, spending its stars and ascendancy points and wearing what it finds
//   charts Slice 5's exit: a level-14 character, as Act I leaves one, runs charts at the Map of al-Idrisi (through the
//          map screen) until it has finished a site of the Fourth Clime, spending Astrolabe points on the way
//   act2   Slice 6's exit: a character as Act I leaves one plays Act II through, the River Road to the Deep Tomb
//   rifts  Slice 6's endgame piece: after Act II, a chart with a Marid Rift; its splinters make a Rift Seal, and the
//          seal opens the Rift Lord's court at the chart table, where the Rift Lord dies
//   act3   Slice 7's exit: a character as Act II leaves one plays Act III through, the White Desert to the Hill of the
//          Oracle, Trial II at Bab al-Futuh included
//   act4   Slice 8's exit: a character as Act III leaves one plays Act IV through, Ghadames to the Sebkha of Sijoumi
//   act5   Slice 9's exit: a character as Act IV leaves one plays Act V through, Fes to the sea walls of the Strait, Trial III
//          at Bab al-Nasr included
//   digs   Slice 7's endgame piece: after Act III, a chart with an Excavation: every charge set, fired from the stake,
//          the chamber's guardians killed, the chamber searched, and its relics bartered with Amm Ramadan
//   zar    Slice 8's endgame piece: after Act IV, a chart with a Zar Night: the drum sat at, the circle held against what
//          comes to it until the song is over, at least one trance, and what the night paid out picked up
//   reaches Slice 9's endgame piece: after Act V, the charts climb past the old edge of the map, from the Fifth Clime until
//          a site of the Eighth Reach is finished
//   king   Slice 9's pinnacle: four King's Pearls spent at the chart table open the throne, and the Marid King dies
//   tour   not a test: a scripted visit of every screen for screenshots (it gives itself gear)
#pragma once
#include "game/areas.hpp"
#include "game/atlas_ui.hpp"
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
    MapScreen* map_ui = nullptr;
    struct RoofScreen* roof_ui = nullptr;   // the rooftop's building board (game/roof_ui.hpp)
    std::string save_dir;
    void start(const char* s);
    bool uses_title() const { return scenario == "title"; }
    const char* default_class() const { return scenario == "sorcerer" || scenario == "sky" || scenario == "tour3" ? "sorcerer" : "warrior"; }
    void drive(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void prepare(World& w);   // before the first area: a character further on, for the scenarios that need one

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
    vec2 unstick_pos_;
    uint64_t unstick_frame_ = 0;

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
    void charts(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour6(World& w, Areas& a, Input& in, uint64_t frame);
    void rifts(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void king(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    int king_stage_ = 0;
    vec2 pin_last_pos_{1e9f, 1e9f};   // the pinnacle pilot's stall breaker
    uint64_t pin_still_ = 0, pin_walk_until_ = 0;
    uint64_t mark_frame_ = 0;   // the Wanderer's last Mark
    void tour7(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    int rift_stage_ = 0, rift_splinters0_ = 0;
    void digs(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void zar(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour8(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour9(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour10(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour11(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void tour12(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    void gallery(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);
    std::vector<int> gallery_zones_;
    int dig_stage_ = 0, dig_relics_ = 0;
    bool recovering_ = false;    // backed off from a site's master until life comes back (see combat)
    uint64_t recover_frame_ = 0;
    // charts scenario
    int chart_runs_ = 0, chart_target_ = -1, map_presses_ = 0, best_tier_done_ = 0, haboobs_seen_ = 0;
    uint32_t run_seed_ = 0;
    uint64_t run_frame_ = 0;
    const char* branch_ = "";
    // act1 scenario
    uint32_t act_seed_ = 0;
    std::vector<uint8_t> visited_;
    uint64_t act_zone_frame_ = 0, act_moved_frame_ = 0;
    vec2 act_last_pos_;
    int act_goal_ = -1, act_zones_ = 0;
    int zone_deaths_ = 0, grind_zone_ = -1, grind_until_ = 0, last_target_ = -1;
    // shopping: Amm Sayed's stock last looked through (its first item), the weapon on its way, the last trip home for it
    uint32_t shop_seen_ = 0, shop_want_ = 0;
    uint64_t shop_frame_ = 0;
    bool shop_home_ = false;
    bool shop_weapon(World& w, Menu& m, Areas& a, Input& in, uint64_t frame);   // true while busy at the vendor
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
    // a direction to back off in, bent round a boss's court when the hero has strayed from it (she goes home and heals if led away)
    vec2 keep_to_court(const World& w, vec2 dir) const;
    bool loot_and_equip(World& w, Menu& m, Input& in, uint64_t frame);  // true while busy with loot or the menu
    bool menu_nav(const World& w, const Menu& m, Input& in, uint64_t frame, Region r, int x, int y);
    void steer(World& w, Input& in, vec2 target);
    void chase(World& w, Input& in, const Actor& e);
    std::vector<uint32_t> ignored_, ignored_loot_;
    uint32_t loot_seed_ = 0;
    uint64_t loot_frame_ = 0;
    uint32_t chase_id_ = 0;
    float chase_best_ = 0;
    uint64_t chase_frame_ = 0;
    bool unreachable(uint32_t id) const { for (uint32_t i : ignored_) if (i == id) return true; return false; }
    bool pinnacle_run() const { return scenario == "king" || scenario == "falak" || scenario == "uber" || scenario == "subyan"; }
    int pinnacle_wanted() const { return scenario == "falak" ? PIN_FALAK : scenario == "subyan" ? PIN_SUBYAN : scenario == "uber" ? PIN_KING_UBER : PIN_KING; }
    bool go_to_interact(World& w, Input& in, uint64_t frame, Interactable::Kind k, int target = -1);   // target: a Gate/Next zone, a toll slot
};

}  // namespace q
