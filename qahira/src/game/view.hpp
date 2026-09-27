// Presentation: turns World state into draw calls (renderer) and HUD (ui). Holds no game state
// except cosmetic smoothing (camera, displayed values, flashes).
#pragma once
#include "game/world.hpp"
#include "gfx/renderer.hpp"

namespace q {

struct Flash { vec3 pos; vec3 color; float radius, t, life; };

class View {
public:
    Camera cam;
    Environment env;
    std::vector<Flash> flashes;
    float shown_life = 1, shown_mana = 1;
    float banner_t = 0;
    std::string banner, banner_sub;

    void follow(const World& w, float dt, bool snap = false);
    void on_events(const World& w);
    void render_world(Renderer& r, World& w);
    void render_hud(World& w, const Input& in);

private:
    Pose pose_;
    std::vector<Xform> scratch_;
    void draw_actor(Renderer& r, World& w, Actor& a, int index);
};

void draw_button_glyph(float cx, float cy, float s, int button);  // Btn, drawn by position not label
void draw_skill_icon(float cx, float cy, float s, int glyph, bool ready);

}  // namespace q
