// The Map of al-Idrisi on screen (GDD §10), opened at the chart table on the rooftop. South is at the top, so east
// is on the left, as al-Idrisi drew it for King Roger. The eclipse's path is a dark band across it.
//   Stick / D-pad  the cursor jumps to the nearest site in the push direction
//   South          on a revealed site: choose a chart of its Clime, then South again to set out
//   L1 / R1        the Map, or the Astrolabe (the atlas tree); South takes a node there
//   East           back, or close
#pragma once
#include "game/world.hpp"
#include <string>
#include <vector>

namespace q {

struct MapScreen {
    bool open = false;
    int view = 0;                  // 0 the map, 1 the Astrolabe
    int cursor = 0;                // a site
    bool picking = false;          // choosing a chart for the site under the cursor
    std::vector<int> picks;        // inventory indices of the charts that fit
    int pick = 0;
    int astro_cursor = 0;
    int go_site = -1;              // set when a chart is chosen: the app consumes it and sets out
    int go_chart = -1;             // the inventory index of that chart
    bool go_rift = false;          // a Rift Seal spent: the app sets out for the Rift Lord's court
    std::string msg;
    float msg_t = 0;

    void show(const World& w);
    void hide() { open = picking = false; }
    void update(World& w, const Input& in, float dt);
    void render(const World& w) const;
    void say(const std::string& s) { msg = s; msg_t = 2.4f; }

private:
    float repeat_t_ = 0;
    int last_dir_ = -1;
};

vec2 site_screen(const Site& s);   // where a site sits on the map, in UI space

}  // namespace q
