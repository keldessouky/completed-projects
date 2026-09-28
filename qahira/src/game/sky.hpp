// The Book of Fixed Stars on screen (GDD §5.6): the passive tree as gold stars on true black, driven by the sticks.
//   Left stick   a magnetised cursor that snaps to the nearest star in the push direction
//   D-pad        walk along the tree's edges
//   Right stick  pan;  L2 / R2 zoom through three levels;  L1 / R1 jump between planned notables
//   South        preview the cheapest path and its cost; again to stage it. On a held star: stage a refund
//   West         plan a path to this star (ghost stars); on a planned star, cut the plan there
//   North        search by keyword chips;  Select  place the next planned star
//   R3 (M2)      the build code: text and QR, import a code, or plan the Recommended Path
//   Start        apply what is staged;  East  cancel what is staged, or close
// Touch: tap a star to put the cursor on it, tap it again for South; drag to pan.
#pragma once
#include "game/world.hpp"
#include <string>
#include <vector>

namespace q {

// Places the hero's next planned star if a point is free. Returns the star, or -1.
int place_next_planned(World& w);
// Adds the cheapest path to `star` (from what is held and already planned) to the plan.
void plan_to(Hero& h, int star);
// A plan from a build code or a list of target stars, in an order that can be allocated.
std::vector<uint16_t> order_plan(const Allocation& held, const std::vector<int>& stars);
// Respec: free before level 20; after, each refunded star costs a Rosewater Vial and dinars.
int respec_dinars(int level);

struct Sky {
    bool open = false;
    vec2 cam;
    int zoom_level = 1;
    float zoom = 0.62f;
    int cursor = -1;
    int preview = -1;
    std::vector<int> preview_path;
    Allocation staged;
    // search chips
    bool searching = false;
    int chip = 0;
    uint32_t chips_on = 0;
    // the build code panel and its keyboard
    bool panel = false, typing = false;
    std::string typed;
    int key = 0;
    int plan_jump = -1;
    std::string msg;
    float msg_t = 0;
    bool applied = false;          // set when Start applied changes (the app saves the character)

    void show(World& w);
    void hide() { open = false; panel = typing = searching = false; }
    void update(World& w, const Input& in, float dt);
    void render(const World& w) const;
    void say(const std::string& s) { msg = s; msg_t = 2.6f; }
    int refunds(const Hero& h) const;   // held stars the staged allocation lets go
    int additions(const Hero& h) const;
    vec2 to_screen(vec2 sky) const { return {960 + (sky.x - cam.x) * zoom, 540 - (sky.y - cam.y) * zoom}; }

private:
    float repeat_t_ = 0;
    int last_dir_ = -1;
    bool dragging_ = false;
    vec2 drag_from_, cam_from_;
    float touch_t_ = 0;
    mutable HeroSummary base_, after_;
    mutable std::string summary_key_;
    void magnet(vec2 dir);
    void walk_edge(vec2 dir);
    void act_south(World& w);
    void act_west(World& w);
    void apply(World& w);
    void follow_cursor(float dt);
    void keyboard(World& w, const Input& in, int dir);
};

}  // namespace q
