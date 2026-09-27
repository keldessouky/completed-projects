// The title screen: the black sun, four character slots, and the class choice for a new character.
#pragma once
#include "platform/input.hpp"
#include <string>
#include <vector>

namespace q {

struct Title {
    static constexpr int kSlots = 4;
    struct Slot { bool exists = false; std::string cls; int level = 0, kills = 0; };
    bool open = false;
    int cursor = 0;
    bool picking = false;          // choosing a class for a new character
    int cls_cursor = 0;
    int delete_armed = -1;         // North once arms a delete, twice confirms
    Slot slots[kSlots];
    float t = 0;

    enum class Action { None, Play, New, Delete };
    void scan(const std::string& save_dir);                // reads every slot's file
    Action update(const Input& in, float dt);             // Play/Delete: slot `cursor`; New: slot `cursor`, class `new_class()`
    std::string new_class() const;
    void render() const;
};

std::string slot_path(const std::string& save_dir, int slot);   // qahira_1.character ...

}  // namespace q
