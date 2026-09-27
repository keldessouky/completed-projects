// Presentation: turns World state into draw calls (renderer) and HUD (ui). Holds no game state
// except cosmetic smoothing (camera, displayed values, flashes).
#pragma once
#include "game/areas.hpp"
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
    void render_hud(World& w, const Input& in, const Areas& areas);
    void render_map(const World& w, const Areas& areas);
    bool map_open = false;
    float fade = 0;                 // black between areas

private:
    Pose pose_;
    std::vector<Xform> scratch_;
    void draw_actor(Renderer& r, World& w, Actor& a, int index);
    void draw_skinned(Renderer& r, const CharacterModel& m, const Animator& anim, vec2 pos, float facing, float scale, Instance in);
    void draw_portal(Renderer& r, const World& w, vec2 pos, vec3 color, float t);
};

void draw_button_glyph(float cx, float cy, float s, int button);  // Btn, drawn by position not label
// An item's tooltip card; returns its height. With draw=false it only measures.
float draw_item_card(float x, float y, float w, const Item& it, const World& world, const Item* compare, const std::string& footer, bool draw);
void draw_skill_icon(float cx, float cy, float s, int glyph, bool ready);

}  // namespace q
