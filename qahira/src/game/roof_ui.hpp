// The rooftop's building board on screen: what the roof can have, each in three tiers, what the next one gives and
// what it costs. Up and down choose; South builds the next tier; East closes.
#pragma once
#include "game/world.hpp"
#include <string>

namespace q {

struct RoofScreen {
    bool open = false;
    int cursor = 0;
    bool built = false;            // something was built: the app puts it on the roof and saves
    std::string msg;
    float msg_t = 0;

    void show(const World& w);
    void hide() { open = false; }
    void update(World& w, const Input& in, float dt);
    void render(const World& w) const;
    void say(const std::string& s) { msg = s; msg_t = 2.4f; }

private:
    float repeat_t_ = 0;
    int last_dir_ = 0;
};

}  // namespace q
