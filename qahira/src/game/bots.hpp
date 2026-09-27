// Headless test pilots: they drive the game through the same Input a player would, and report pass/fail.
#pragma once
#include "game/world.hpp"
#include <string>

namespace q {

struct Bot {
    std::string scenario;
    int status = 0;              // 0 running, 1 pass, 2 fail
    std::string message;
    int deaths = 0;
    int initial_enemies = 0;
    bool rare_seen = false, rare_killed = false, picked_up = false, state_ok = false;
    vec2 start_pos;
    void start(const char* s);
    void drive(World& w, Input& in, uint64_t frame);

private:
    void press(Input& in, Btn b) { in.down |= 1u << b; in.pressed |= 1u << b; }
    void pass(const std::string& m) { status = 1; message = m; }
    void fail(const std::string& m) { status = 2; message = m; }
    void walk(World& w, Input& in, uint64_t frame);
    void fight(World& w, Input& in, uint64_t frame);
};

}  // namespace q
