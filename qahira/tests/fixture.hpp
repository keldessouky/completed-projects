// Shared test setup: the generated passive tree (tools/tree/build_tree.py writes it before the tests run).
#pragma once
#include "game/tree.hpp"
#include <fstream>
#include <sstream>
#include <string>

inline bool load_generated_tree() {
    if (q::tree().loaded()) return true;
    std::ifstream f(std::string(QAHIRA_SOURCE_DIR) + "/assets/generated/tree/tree.json");
    if (!f) return false;
    std::stringstream ss;
    ss << f.rdbuf();
    return q::tree().load_json(ss.str());
}
