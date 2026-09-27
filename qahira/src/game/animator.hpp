// Plays clips on a skeleton with short crossfades.
#pragma once
#include "anim/anim.hpp"

namespace q {

struct Animator {
    const Skeleton* skel = nullptr;
    const AnimSet* set = nullptr;
    const Clip* cur = nullptr;
    const Clip* prev = nullptr;
    float t = 0, prev_t = 0, speed = 1, fade = 0, fade_len = 0.12f;
    uint32_t fired = 0;  // bitmask of events already fired this play

    void bind(const Skeleton* s, const AnimSet* a) { skel = s; set = a; }
    bool play(const char* name, float fade_time = 0.12f, bool restart = false, float spd = 1.f) {
        const Clip* c = set ? set->find(name) : nullptr;
        if (!c) return false;
        if (c == cur && !restart) { speed = spd; return true; }
        prev = cur;
        prev_t = t;
        cur = c;
        t = 0;
        speed = spd;
        fade = fade_time;
        fade_len = fade_time;
        fired = 0;
        return true;
    }
    bool playing(const char* name) const { return cur && cur->name == name; }
    bool done() const { return cur && !cur->loop && t >= cur->duration(); }
    float progress() const { return cur && cur->duration() > 0 ? std::min(1.f, t / cur->duration()) : 1.f; }
    // returns true once when the named event is crossed
    bool event(const char* name) {
        if (!cur) return false;
        for (size_t i = 0; i < cur->events.size() && i < 32; i++)
            if (cur->events[i].name == name && t >= cur->events[i].time && !(fired & (1u << i))) {
                fired |= 1u << i;
                return true;
            }
        return false;
    }
    void update(float dt) {
        t += dt * speed;
        prev_t += dt;
        if (fade > 0) fade = std::max(0.f, fade - dt);
    }
    void pose(Pose& p, std::vector<Xform>& scratch) const {
        p.set_bind(*skel);
        if (!cur) return;
        cur->sample(t, p.local);
        if (prev && fade > 0 && fade_len > 0) {
            prev->sample(prev_t, scratch);
            float w = fade / fade_len;  // weight of the previous clip
            for (size_t i = 0; i < p.local.size(); i++) p.local[i] = blend(p.local[i], scratch[i], w);
        }
    }
};

}  // namespace q
