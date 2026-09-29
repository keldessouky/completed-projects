#include "game/sky.hpp"
#include "game/classes.hpp"
#include "game/view.hpp"
#include "ui/qr.hpp"
#include "ui/ui.hpp"
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <deque>

namespace q {

namespace {
const float kZooms[3] = {0.38f, 0.62f, 1.0f};
const char* kChips[] = {"Life", "Hirz", "Armour", "Mana", "Resist", "Fire", "Cold", "Lightning", "Spell", "Melee", "Slam",
                        "Critical", "Speed", "Area", "Break", "Warcry", "Keystone"};
constexpr int kChipCount = int(sizeof kChips / sizeof kChips[0]);
const char kKeys[] = "0123456789ABCDEFGHJKMNPQRSTVWXYZ-";
constexpr int kKeyCols = 9, kKeyCount = 33 + 2;   // the characters, then Delete and Done

std::string lower(std::string s) {
    for (auto& c : s) c = char(std::tolower(uint8_t(c)));
    return s;
}

bool star_matches(const Star& s, uint32_t chips) {
    if (!chips) return false;
    for (int c = 0; c < kChipCount; c++) {
        if (!(chips >> c & 1)) continue;
        if (std::string(kChips[c]) == "Keystone") { if (s.kind == StarKind::Keystone) return true; continue; }
        std::string k = lower(kChips[c]);
        if (lower(s.name).find(k) != std::string::npos) return true;
        for (auto& t : s.text) if (lower(t).find(k) != std::string::npos) return true;
    }
    return false;
}

bool planned(const Hero& h, int id) { return std::find(h.plan.begin(), h.plan.end(), uint16_t(id)) != h.plan.end(); }
}  // namespace

int respec_dinars(int level) { return level < 20 ? 0 : 5 * level; }

// ---------------------------------------------------------------- planning
std::vector<uint16_t> order_plan(const Allocation& held, const std::vector<int>& stars) {
    // take them in an order that can be allocated: each next star touches the start, a held star or one already ordered
    const PassiveTree& T = tree();
    Allocation a = held;
    std::vector<int> left;
    for (int s : stars) if (!a.has(s) && s >= 0 && s < int(T.stars.size())) left.push_back(s);
    std::vector<uint16_t> out;
    bool progress = true;
    while (!left.empty() && progress) {
        progress = false;
        for (size_t i = 0; i < left.size(); i++) {
            if (!a.can_take(left[i])) continue;
            a.taken[size_t(left[i])] = 1;
            out.push_back(uint16_t(left[i]));
            left.erase(left.begin() + long(i));
            progress = true;
            break;
        }
    }
    for (int s : left) out.push_back(uint16_t(s));   // unreachable leftovers stay at the end
    return out;
}

void plan_to(Hero& h, int star) {
    Allocation a = h.passives;
    for (uint16_t p : h.plan) if (size_t(p) < a.taken.size()) a.taken[p] = 1;
    for (int s : a.path_to(star)) h.plan.push_back(uint16_t(s));
}

int place_next_planned(World& w) {
    Hero& H = w.hero;
    while (!H.plan.empty() && H.passives.has(H.plan.front())) H.plan.erase(H.plan.begin());
    if (H.plan.empty() || H.passive_points() <= 0) return -1;
    int s = H.plan.front();
    if (!H.passives.can_take(s)) return -1;
    H.passives.taken[size_t(s)] = 1;
    H.plan.erase(H.plan.begin());
    w.recompute_hero();
    return s;
}

// ---------------------------------------------------------------- state
void Sky::show(World& w) {
    tree().load();
    open = true;
    staged = w.hero.passives;
    preview = -1;
    preview_path.clear();
    panel = typing = searching = false;
    int start = tree().class_start(w.hero.passives.cls);
    if (cursor < 0 || cursor >= int(tree().stars.size())) cursor = start;
    if (!w.hero.plan.empty()) cursor = w.hero.plan.front();
    if (cursor >= 0) cam = tree().stars[size_t(cursor)].pos;
    zoom = kZooms[zoom_level];
    summary_key_.clear();
}

int Sky::refunds(const Hero& h) const {
    int n = 0;
    for (size_t i = 0; i < staged.taken.size() && i < h.passives.taken.size(); i++) n += h.passives.taken[i] && !staged.taken[i];
    return n;
}

int Sky::additions(const Hero& h) const {
    int n = 0;
    for (size_t i = 0; i < staged.taken.size() && i < h.passives.taken.size(); i++) n += staged.taken[i] && !h.passives.taken[i];
    return n;
}

void Sky::magnet(vec2 dir) {
    // the nearest star in the push direction, favouring ones straight ahead
    const PassiveTree& T = tree();
    if (cursor < 0) return;
    vec2 at = T.stars[size_t(cursor)].pos;
    int best = -1;
    float bs = 1e9f;
    for (size_t i = 0; i < T.stars.size(); i++) {
        if (int(i) == cursor) continue;
        vec2 d = T.stars[i].pos - at;
        float dist = length(d);
        if (dist < 1.f) continue;
        float dev = std::fabs(wrap_angle(angle_of(d) - angle_of(dir)));
        if (dev > radians(55)) continue;
        float score = dist * (1.f + 2.2f * dev);
        if (score < bs) { bs = score; best = int(i); }
    }
    if (best >= 0) { cursor = best; preview = -1; }
}

void Sky::walk_edge(vec2 dir) {
    const PassiveTree& T = tree();
    if (cursor < 0) return;
    const Star& s = T.stars[size_t(cursor)];
    int best = -1;
    float bd = radians(80);
    for (int n : s.adj) {
        float dev = std::fabs(wrap_angle(angle_of(T.stars[size_t(n)].pos - s.pos) - angle_of(dir)));
        if (dev < bd) { bd = dev; best = n; }
    }
    if (best >= 0) { cursor = best; preview = -1; }
}

void Sky::follow_cursor(float dt) {
    if (cursor < 0) return;
    vec2 p = to_screen(tree().stars[size_t(cursor)].pos);
    // keep the cursor inside the middle of the screen (the info card takes the right side)
    vec2 want = cam;
    if (p.x < 300 || p.x > 1250 || p.y < 200 || p.y > 820) want = tree().stars[size_t(cursor)].pos;
    cam = lerp(cam, want, std::min(1.f, dt * 5.f));
}

void Sky::act_south(World& w) {
    Hero& H = w.hero;
    const PassiveTree& T = tree();
    if (cursor < 0) return;
    const Star& s = T.stars[size_t(cursor)];
    if (cursor == T.class_start(H.passives.cls) || (s.kind == StarKind::Start && H.passives.cls != "wanderer")) { say("Your class starts here"); return; }
    if (staged.has(cursor)) {
        // a refund (of a held star) or an unstaging (of a staged one): only if the rest stays connected
        if (!staged.can_refund(cursor)) { say("Other stars hang from this one: refund those first"); return; }
        bool was_held = H.passives.has(cursor);
        if (was_held && H.level >= 20) {
            int vials = refunds(H) + 1;
            if (H.currency[CUR_ROSEWATER] < vials) { say("Refunding a star after level 20 takes a Rosewater Vial"); return; }
            if (H.gold < vials * respec_dinars(H.level)) { say("Not enough dinars for the refund"); return; }
        }
        staged.taken[size_t(cursor)] = 0;
        w.emit(Ev::Craft, w.actors[0].pos, 0);
        say(was_held ? "Staged a refund: Start to apply" : "Unstaged");
        return;
    }
    std::vector<int> path = staged.path_to(cursor);
    if (path.empty()) { say("No path from your stars to this one"); return; }
    if (preview != cursor) {
        preview = cursor;
        preview_path = path;
        return;
    }
    int free_pts = H.level - 1 - staged.spent();
    if (int(path.size()) > free_pts) {
        say("Needs " + std::to_string(int(path.size()) - free_pts) + " more star" + (int(path.size()) - free_pts == 1 ? "" : "s") +
            ". West plans it for later");
        return;
    }
    for (int p : path) staged.taken[size_t(p)] = 1;
    preview = -1;
    preview_path.clear();
    w.emit(Ev::Pickup, w.actors[0].pos);
    say("Staged " + std::to_string(path.size()) + " star" + (path.size() == 1 ? "" : "s") + ": Start to apply");
}

void Sky::act_west(World& w) {
    Hero& H = w.hero;
    if (cursor < 0) return;
    auto it = std::find(H.plan.begin(), H.plan.end(), uint16_t(cursor));
    if (it != H.plan.end()) {
        H.plan.erase(it, H.plan.end());
        say("Plan cut here");
        return;
    }
    if (H.passives.has(cursor)) { say("You hold this star already"); return; }
    size_t before = H.plan.size();
    plan_to(H, cursor);
    if (H.plan.size() == before) { say("No path to plan"); return; }
    w.emit(Ev::Craft, w.actors[0].pos, 1);
    say("Planned " + std::to_string(H.plan.size() - before) + " more (" + std::to_string(H.plan.size()) + " in the plan)");
}

void Sky::apply(World& w) {
    Hero& H = w.hero;
    int add = additions(H), ref = refunds(H);
    if (!add && !ref) { say("Nothing staged"); return; }
    if (H.level - 1 < staged.spent()) { say("Not enough stars to place"); return; }
    if (ref && H.level >= 20) {
        int cost = ref * respec_dinars(H.level);
        if (H.currency[CUR_ROSEWATER] < ref || H.gold < cost) { say("The refunds cost more than you carry"); return; }
        H.currency[CUR_ROSEWATER] -= ref;
        H.gold -= cost;
    }
    H.passives = staged;
    while (!H.plan.empty() && H.passives.has(H.plan.front())) H.plan.erase(H.plan.begin());
    w.recompute_hero();
    applied = true;
    w.emit(Ev::LevelUp, w.actors[0].pos);
    char b[96];
    snprintf(b, sizeof b, "The sky shifts: %d placed, %d refunded", add, ref);
    say(b);
}

// ---------------------------------------------------------------- input
void Sky::keyboard(World& w, const Input& in, int dir) {
    if (dir == 0) key = std::max(0, key - kKeyCols);
    if (dir == 1) key = std::min(kKeyCount - 1, key + kKeyCols);
    if (dir == 2) key = std::max(0, key - 1);
    if (dir == 3) key = std::min(kKeyCount - 1, key + 1);
    if (in.hit(BTN_WEST) && !typed.empty()) typed.pop_back();
    if (in.hit(BTN_SOUTH)) {
        if (key < 33) typed += kKeys[key];
        else if (key == 33 && !typed.empty()) typed.pop_back();
        else if (key == 34) {
            Allocation a;
            if (!parse_build_code(typed, a)) { say("That code is not a build code"); return; }
            if (a.cls != w.hero.passives.cls) { say(std::string("That code is for ") + class_def(a.cls).name); return; }
            w.hero.plan = order_plan(w.hero.passives, a.held());
            typing = false;
            panel = false;
            say("Planned " + std::to_string(w.hero.plan.size()) + " stars from the code");
        }
    }
    if (in.hit(BTN_START) && !typed.empty()) { key = 34; }
}

void Sky::update(World& w, const Input& in, float dt) {
    msg_t = std::max(0.f, msg_t - dt);
    if (!open) return;
    Hero& H = w.hero;
    const PassiveTree& T = tree();
    zoom = damp(zoom, kZooms[zoom_level], 12.f, dt);
    // direction with repeat: D-pad or stick
    int dir = -1;
    bool dpad = false;
    if (in.held(BTN_UP)) { dir = 0; dpad = true; }
    else if (in.held(BTN_DOWN)) { dir = 1; dpad = true; }
    else if (in.held(BTN_LEFT)) { dir = 2; dpad = true; }
    else if (in.held(BTN_RIGHT)) { dir = 3; dpad = true; }
    vec2 stick = in.lstick;
    bool stick_on = length(stick) > 0.5f;
    int sdir = stick_on ? 100 + int((angle_of(stick) + kPi) / kTau * 16) : -1;   // the stick's direction, in sixteenths
    int d_any = dir >= 0 ? dir : sdir;
    bool step = false;
    if (d_any < 0) last_dir_ = -1;
    else if (d_any != last_dir_) { last_dir_ = d_any; repeat_t_ = 0.28f; step = true; }
    else if ((repeat_t_ -= dt) <= 0) { repeat_t_ = 0.14f; step = true; }
    if (typing) {
        if (in.hit(BTN_EAST)) { typing = false; return; }
        keyboard(w, in, step && dir >= 0 ? dir : -1);
        return;
    }
    if (panel) {
        if (in.hit(BTN_EAST) || in.hit(BTN_R3)) { panel = false; return; }
        if (in.hit(BTN_SOUTH)) { typing = true; typed.clear(); key = 0; }
        if (in.hit(BTN_WEST)) {
            if (const auto* rec = T.recommended_for(H.passives.cls)) {
                H.plan.clear();
                for (int t : *rec) plan_to(H, t);
                panel = false;
                say("Planned the Recommended Path: " + std::to_string(H.plan.size()) + " stars");
            }
        }
        return;
    }
    if (searching) {
        if (in.hit(BTN_EAST) || in.hit(BTN_NORTH)) { searching = false; return; }
        if (step && dir == 2) chip = (chip + kChipCount - 1) % kChipCount;
        if (step && dir == 3) chip = (chip + 1) % kChipCount;
        if (in.hit(BTN_SOUTH)) chips_on ^= 1u << chip;
        return;
    }
    // touch: tap a star to aim, tap it again to act; drag to pan
    if (in.touching) {
        if (!dragging_ && touch_t_ == 0) { drag_from_ = in.touch; cam_from_ = cam; }
        touch_t_ += dt;
        if (length(in.touch - drag_from_) > 14.f) dragging_ = true;
        if (dragging_) cam = cam_from_ - vec2{in.touch.x - drag_from_.x, -(in.touch.y - drag_from_.y)} / zoom;
    } else {
        if (in.tapped && !dragging_) {
            int hit = -1;
            float bd = 34.f;
            for (size_t i = 0; i < T.stars.size(); i++) {
                float d = length(to_screen(T.stars[i].pos) - in.touch);
                if (d < bd) { bd = d; hit = int(i); }
            }
            if (hit >= 0 && hit == cursor) act_south(w);
            else if (hit >= 0) { cursor = hit; preview = -1; }
        }
        dragging_ = false;
        touch_t_ = 0;
    }
    if (in.hit(BTN_EAST)) {
        if (additions(H) || refunds(H) || preview >= 0) { staged = H.passives; preview = -1; preview_path.clear(); say("Cancelled"); }
        else hide();
        return;
    }
    if (in.hit(BTN_START)) { apply(w); return; }
    if (in.hit(BTN_L2)) zoom_level = std::max(0, zoom_level - 1);
    if (in.hit(BTN_R2)) zoom_level = std::min(2, zoom_level + 1);
    if (in.hit(BTN_NORTH)) { searching = true; return; }
    if (in.hit(BTN_R3)) { panel = true; return; }
    if (in.hit(BTN_L1) || in.hit(BTN_R1)) {
        std::vector<int> marks;
        for (uint16_t p : H.plan) {
            StarKind k = T.stars[p].kind;
            if (k == StarKind::Notable || k == StarKind::Keystone) marks.push_back(p);
        }
        if (marks.empty() && !H.plan.empty()) marks.push_back(H.plan.back());
        if (!marks.empty()) {
            plan_jump = (plan_jump + (in.hit(BTN_R1) ? 1 : int(marks.size()) - 1)) % int(marks.size());
            if (plan_jump < 0) plan_jump = 0;
            cursor = marks[size_t(plan_jump) % marks.size()];
            preview = -1;
        }
    }
    if (in.hit(BTN_SELECT)) {
        int s = place_next_planned(w);
        if (s >= 0) {
            staged = H.passives;
            cursor = s;
            say("Placed " + (T.stars[size_t(s)].name.empty() ? std::string("a star") : T.stars[size_t(s)].name));
            applied = true;
        } else say(H.plan.empty() ? "Nothing planned: West plans a path" : "No star to place yet");
    }
    if (step) {
        static const vec2 dirs[4] = {{0, 1}, {0, -1}, {-1, 0}, {1, 0}};
        if (dpad) walk_edge(dirs[dir]);
        else magnet(normalize(stick));
    }
    if (length(in.rstick) > 0.2f) cam += in.rstick * (900.f / zoom) * dt;
    else follow_cursor(dt);
    if (in.hit(BTN_SOUTH)) act_south(w);
    if (in.hit(BTN_WEST)) act_west(w);
}

// ---------------------------------------------------------------- drawing
void Sky::render(const World& w) const {
    Ui& u = ui();
    struct KeepSky { bool was = ui().set_mirror_enabled(false); ~KeepSky() { ui().set_mirror_enabled(was); } } keep;   // the stars keep their places
    if (!open) {
        if (msg_t > 0) {  // a placement from the field
            float a = std::min(1.f, msg_t / 0.3f);
            float tw = u.text_width(msg, 30) + 60;
            u.frame(960 - tw / 2, 250, tw, 56, pal::panel.alpha(0.92f * a), pal::brass.alpha(a), 10, 2);
            u.text(960, 258, msg, 30, pal::bone.alpha(a), Align::Center, 0.6f);
        }
        return;
    }
    const Hero& H = w.hero;
    const PassiveTree& T = tree();
    u.rect(0, 0, 1920, 1080, pal::night);
    // a faint field of background stars, fixed to the sky so panning feels like the heavens turning
    Rng r(4242);
    for (int i = 0; i < 380; i++) {
        vec2 p{r.range(-1500, 1500), r.range(-1500, 1500)};
        vec2 s = to_screen(p);
        float b = r.range(0.08f, 0.35f);
        if (s.x > -10 && s.x < 1930 && s.y > -10 && s.y < 1090) u.disc(s.x, s.y, 1.2f + b * 2, pal::bone.alpha(b));
    }
    // constellation names at the wider zooms
    if (zoom < 0.9f)
        for (auto& c : T.constellations) {
            vec2 s = to_screen(c.centre);
            u.text(s.x, s.y - 12, c.english, 20, pal::brass.alpha(0.35f), Align::Center, 0.2f);
        }
    auto in_path = [&](int id) { return std::find(preview_path.begin(), preview_path.end(), id) != preview_path.end(); };
    auto state_of = [&](int id) {
        // 0 locked, 1 reachable, 2 staged, 3 held, 4 staged refund
        bool held = H.passives.has(id), st = staged.has(id);
        if (held && !st) return 4;
        if (held) return 3;
        if (st) return 2;
        return staged.can_take(id) ? 1 : 0;
    };
    // edges
    for (auto& e : T.edges) {
        vec2 a = to_screen(T.stars[size_t(e.first)].pos), b = to_screen(T.stars[size_t(e.second)].pos);
        if (std::max(a.x, b.x) < -20 || std::min(a.x, b.x) > 1940 || std::max(a.y, b.y) < -20 || std::min(a.y, b.y) > 1100) continue;
        int sa = state_of(e.first), sb = state_of(e.second);
        const int mine = T.class_start(H.passives.cls);   // (the Wanderer's is the Pole)
        bool sa_on = sa == 2 || sa == 3 || e.first == mine;
        bool sb_on = sb == 2 || sb == 3 || e.second == mine;
        Rgba c = pal::line.alpha(0.7f);
        float wd = 2.f;
        if (sa_on && sb_on) { c = (sa == 2 || sb == 2) ? pal::amber : pal::brass; wd = 5.f; }
        else if ((in_path(e.first) || sa_on) && (in_path(e.second) || sb_on) && (in_path(e.first) || in_path(e.second))) {
            c = pal::amber.alpha(0.55f + 0.35f * std::sin(w.time * 6.f));
            wd = 4.f;
        } else if (planned(H, e.first) && (planned(H, e.second) || sb_on) || planned(H, e.second) && sa_on) {
            c = pal::turquoise.alpha(0.6f);
            wd = 3.f;
        } else if (sa_on || sb_on) c = pal::brass.alpha(0.35f);
        u.line(a.x, a.y, b.x, b.y, wd * std::max(0.6f, zoom), c);
    }
    // stars
    for (size_t i = 0; i < T.stars.size(); i++) {
        const Star& s = T.stars[i];
        vec2 p = to_screen(s.pos);
        if (p.x < -40 || p.x > 1960 || p.y < -40 || p.y > 1120) continue;
        int st = state_of(int(i));
        float z = std::max(0.55f, zoom);
        float rad = (s.kind == StarKind::Minor ? 8.f : s.kind == StarKind::Attr ? 9.f : s.kind == StarKind::Notable ? 15.f
                     : s.kind == StarKind::Keystone ? 24.f : 20.f) * z;
        bool match = star_matches(s, chips_on);
        if (match) u.disc(p.x, p.y, rad * 2.2f, pal::amber.alpha(0.25f + 0.15f * std::sin(w.time * 5.f)));
        Rgba core = s.kind == StarKind::Attr ? Rgba::hex(0x8FB8E8) : s.kind == StarKind::Keystone ? pal::magenta : pal::brass;
        if (s.kind == StarKind::Start) core = s.cls == H.passives.cls ? pal::turquoise : pal::dim;
        if (s.kind == StarKind::Pole) core = pal::bone;
        switch (st) {
            case 3: u.disc(p.x, p.y, rad * 1.7f, core.alpha(0.18f)); u.disc(p.x, p.y, rad, core); break;
            case 2: u.disc(p.x, p.y, rad * 1.8f, pal::amber.alpha(0.25f)); u.disc(p.x, p.y, rad, pal::amber); break;
            case 4: u.disc(p.x, p.y, rad, pal::bad.alpha(0.8f)); break;
            case 1: u.ring(p.x, p.y, rad, rad * 0.62f, pal::bone.alpha(0.85f)); u.disc(p.x, p.y, rad * 0.3f, core.alpha(0.8f)); break;
            default: u.disc(p.x, p.y, rad * 0.85f, core.alpha(0.28f)); break;
        }
        if (s.kind == StarKind::Keystone) u.ring(p.x, p.y, rad + 6 * z, rad + 2 * z, pal::magenta.alpha(0.7f));
        if (s.cls == H.passives.cls && (s.kind == StarKind::Start || s.kind == StarKind::Pole)) u.ring(p.x, p.y, rad + 8, rad + 3, pal::turquoise);
        if (planned(H, int(i)) && st <= 1) u.ring(p.x, p.y, rad + 5, rad + 1.5f, pal::turquoise.alpha(0.9f));
        if (in_path(int(i))) u.ring(p.x, p.y, rad + 6, rad + 2, pal::amber.alpha(0.8f));
        if (zoom >= 0.9f && (s.kind == StarKind::Notable || s.kind == StarKind::Keystone))
            u.text(p.x, p.y + rad + 6, s.name.substr(0, s.name.find(',')), 20, pal::soft.alpha(0.8f), Align::Center, 0.3f);
    }
    // the cursor
    if (cursor >= 0) {
        vec2 p = to_screen(T.stars[size_t(cursor)].pos);
        float k = 30 + 4 * std::sin(w.time * 5.f);
        for (int q = 0; q < 4; q++) {
            float a = kPi / 4 + q * kPi / 2;
            vec2 d = from_angle(a);
            u.line(p.x + d.x * k, p.y + d.y * k, p.x + d.x * (k + 14), p.y + d.y * (k + 14), 4, pal::amber);
        }
    }
    // header
    char b[160];
    u.text(48, 34, "The Book of Fixed Stars", 44, pal::brass, Align::Left, 1.3f, true);
    int free_pts = H.level - 1 - staged.spent();
    snprintf(b, sizeof b, "%s  \xC2\xB7  Level %d  \xC2\xB7  %d star%s to place", class_def(H.passives.cls).name, H.level, free_pts,
             free_pts == 1 ? "" : "s");
    u.text(50, 92, b, 26, pal::soft);
    int add = additions(H), ref = refunds(H);
    if (add || ref) {
        snprintf(b, sizeof b, "Staged: +%d  \xE2\x88\x92%d", add, ref);
        std::string line = b;
        if (ref && H.level >= 20) line += "  (" + std::to_string(ref) + " Rosewater Vial" + (ref == 1 ? "" : "s") + ", " +
                                          std::to_string(ref * respec_dinars(H.level)) + " dinars)";
        u.text(50, 128, line, 26, pal::amber, Align::Left, 0.6f);
    }
    if (!H.plan.empty()) {
        snprintf(b, sizeof b, "Plan: %zu star%s", H.plan.size(), H.plan.size() == 1 ? "" : "s");
        u.text(50, add || ref ? 164 : 128, b, 26, pal::turquoise, Align::Left, 0.6f);
    }
    // the card for the star under the cursor, with what it would change
    if (cursor >= 0) {
        const Star& s = T.stars[size_t(cursor)];
        float x = 1330, y = 150, cw = 540;
        std::string title = s.name.empty() ? (s.kind == StarKind::Attr ? "Attribute Star" : "Minor Star") : s.name;
        std::vector<std::string> lines = s.text;
        float ch = 150 + lines.size() * 36;
        // the preview: stats with the path (or what is staged) against what is held now
        Hero now = H, then = H;
        then.passives = staged;
        if (preview >= 0) for (int p : preview_path) then.passives.taken[size_t(p)] = 1;
        std::string key = build_code(then.passives) + std::to_string(H.level) + std::to_string(H.equip[0].seed);
        if (key != summary_key_) { base_ = summarize(now); after_ = summarize(then); summary_key_ = key; }
        std::vector<std::pair<std::string, float>> deltas;
        auto dl = [&](const char* n, float a0, float a1) { if (std::fabs(a1 - a0) >= 0.5f) deltas.push_back({n, a1 - a0}); };
        dl("DPS", base_.dps, after_.dps);
        dl("Life", base_.life, after_.life);
        dl("Hirz", base_.es, after_.es);
        dl("Mana", base_.mana, after_.mana);
        dl("Armour", base_.armour, after_.armour);
        dl("Effective HP", base_.ehp, after_.ehp);
        dl("Fire res", base_.res[DT_FIRE], after_.res[DT_FIRE]);
        dl("Cold res", base_.res[DT_COLD], after_.res[DT_COLD]);
        dl("Lightning res", base_.res[DT_LIGHTNING], after_.res[DT_LIGHTNING]);
        dl("Strength", base_.str, after_.str);
        dl("Intelligence", base_.intel, after_.intel);
        if (!deltas.empty()) ch += 50 + deltas.size() * 32;
        u.frame(x, y, cw, ch, pal::panel.alpha(0.95f), s.kind == StarKind::Keystone ? pal::magenta : pal::brass, 14, 2);
        float ts = std::min(36.f, 36.f * (cw - 40) / std::max(1.f, u.text_width(title, 36)));
        u.text(x + cw / 2, y + 18, title, ts, s.kind == StarKind::Keystone ? pal::magenta : pal::amber, Align::Center, 1.2f);
        std::string sub = s.star.empty() ? "" : s.star;
        for (auto& c : T.constellations)
            if (c.name == s.constellation) sub += (sub.empty() ? "" : "  \xC2\xB7  ") + c.english;
        if (sub.empty() && !s.constellation.empty()) sub = s.constellation;
        u.text(x + cw / 2, y + 62, sub, 22, pal::dim, Align::Center);
        float cy = y + 104;
        for (auto& l : lines) { u.text(x + cw / 2, cy, l, 27, pal::magic, Align::Center); cy += 36; }
        std::string status;
        int st = state_of(cursor);
        if (cursor == T.class_start(H.passives.cls)) status = "Your start";
        else if (s.kind == StarKind::Start && H.passives.cls != "wanderer") status = "Class start";
        else if (st == 3) status = "Held";
        else if (st == 2) status = "Staged";
        else if (st == 4) status = "Staged refund";
        else if (preview == cursor) status = "Path: " + std::to_string(preview_path.size()) + " star" + (preview_path.size() == 1 ? "" : "s") + ". South again to stage";
        else {
            size_t n = staged.path_to(cursor).size();
            status = n ? std::to_string(n) + " star" + (n == 1 ? "" : "s") + " away" : "Out of reach";
        }
        if (planned(H, cursor) && st <= 1) status += "  \xC2\xB7  planned";
        u.text(x + cw / 2, cy + 6, status, 26, st >= 2 ? pal::amber : pal::soft, Align::Center, 0.6f);
        cy += 50;
        if (!deltas.empty()) {
            u.line(x + 30, cy, x + cw - 30, cy, 2, pal::line);
            cy += 12;
            for (auto& [n, d] : deltas) {
                snprintf(b, sizeof b, d > 0 ? "+%.0f %s" : "%.0f %s", d, n.c_str());
                if (std::string(n) == "DPS") snprintf(b, sizeof b, d > 0 ? "+%.1f DPS (%s)" : "%.1f DPS (%s)", d, after_.skill.c_str());
                u.text(x + cw / 2, cy, b, 26, d > 0 ? pal::good : pal::bad, Align::Center, 0.8f);
                cy += 32;
            }
        }
    }
    // search chips
    if (searching || chips_on) {
        float cx = 60, cy = 200;
        for (int c = 0; c < kChipCount; c++) {
            bool on = chips_on >> c & 1, cur = searching && chip == c;
            float tw = u.text_width(kChips[c], 24) + 30;
            if (cx + tw > 1300) { cx = 60; cy += 48; }
            u.frame(cx, cy, tw, 40, on ? pal::dusk : pal::panel.alpha(0.9f), cur ? pal::amber : on ? pal::brass : pal::line, 18, cur ? 3.f : 1.5f);
            u.text(cx + tw / 2, cy + 6, kChips[c], 24, on ? pal::amber : pal::soft, Align::Center, on ? 0.8f : 0.2f);
            cx += tw + 10;
        }
    }
    // the build code panel
    if (panel) {
        Allocation code_alloc = H.passives;
        for (uint16_t p : H.plan) code_alloc.taken[p] = 1;
        std::string code = build_code(code_alloc);
        QrCode qr = qr_encode(code);
        float pw = 1000, ph = 760, px = 460, py = 150;
        u.rect(0, 0, 1920, 1080, pal::night.alpha(0.6f));
        u.frame(px, py, pw, ph, pal::panel, pal::brass, 16, 2);
        u.text(px + pw / 2, py + 24, "Build Code", 40, pal::amber, Align::Center, 1.2f, true);
        u.text(px + pw / 2, py + 80, "Your stars and your plan, as a code to share or scan", 24, pal::dim, Align::Center);
        float ms = std::min(9.f, 420.f / float(std::max(1, qr.size + 8)));
        float qs = (qr.size + 8) * ms, qx = px + pw / 2 - qs / 2, qy = py + 130;
        u.rect(qx, qy, qs, qs, pal::bone);
        for (int yy = 0; yy < qr.size; yy++)
            for (int xx = 0; xx < qr.size; xx++)
                if (qr.at(xx, yy)) u.rect(qx + (xx + 4) * ms, qy + (yy + 4) * ms, ms + 0.5f, ms + 0.5f, pal::night);
        float fs = std::min(28.f, 28.f * (pw - 60) / std::max(1.f, u.text_width(code, 28)));
        u.text(px + pw / 2, qy + qs + 20, code, fs, pal::bone, Align::Center, 0.8f);
        float lx = px + 40, ly = py + ph - 64;
        draw_button_glyph(lx + 20, ly + 18, 38, BTN_SOUTH);
        lx += 48 + u.text(lx + 48, ly, "Import a code", 26, pal::soft) + 40;
        if (T.recommended_for(H.passives.cls)) {
            draw_button_glyph(lx + 20, ly + 18, 38, BTN_WEST);
            lx += 48 + u.text(lx + 48, ly, "Plan the Recommended Path", 26, pal::soft) + 40;
        }
        draw_button_glyph(lx + 20, ly + 18, 38, BTN_EAST);
        u.text(lx + 48, ly, "Back", 26, pal::soft);
        if (typing) {
            float kx = px + 60, ky = py + 180, kw = 96, kh = 64;
            u.frame(px + 30, py + 110, pw - 60, ph - 190, pal::panel2, pal::amber, 12, 2);
            u.text(px + pw / 2, py + 124, typed.empty() ? std::string("Type a build code") : typed, 30, typed.empty() ? pal::dim : pal::bone,
                   Align::Center, 0.6f);
            for (int k = 0; k < kKeyCount; k++) {
                float x = kx + (k % kKeyCols) * (kw + 8), y = ky + (k / kKeyCols) * (kh + 8);
                std::string l = k < 33 ? std::string(1, kKeys[k]) : k == 33 ? "Del" : "Done";
                u.frame(x, y, kw, kh, k == key ? pal::dusk : pal::panel, k == key ? pal::amber : pal::line, 10, k == key ? 3.f : 1.f);
                u.text(x + kw / 2, y + 14, l, 30, k == key ? pal::amber : pal::bone, Align::Center, 0.8f);
            }
        }
    }
    // legend, on a band of night so the sky does not show through the glyphs
    u.rect(0, 990, 1920, 90, pal::night.alpha(0.9f));
    float lx = 48, ly = 1012;
    auto leg = [&](int btn, const char* t) {
        draw_button_glyph(lx + 20, ly + 18, 36, btn);
        lx += 46;
        lx += u.text(lx, ly, t, 24, pal::soft) + 26;
    };
    if (typing) { leg(BTN_SOUTH, "Type"); leg(BTN_WEST, "Delete"); leg(BTN_EAST, "Back"); }
    else if (panel) {}
    else if (searching) { leg(BTN_LEFT, "Choose"); leg(BTN_SOUTH, "Toggle"); leg(BTN_EAST, "Done"); }
    else {
        leg(BTN_SOUTH, "Path / Stage");
        leg(BTN_WEST, "Plan");
        leg(BTN_NORTH, "Search");
        leg(BTN_SELECT, "Next planned");
        leg(BTN_L2, "Zoom");
        leg(BTN_R3, "Code");
        leg(BTN_START, "Apply");
        leg(BTN_EAST, additions(H) || refunds(H) ? "Cancel" : "Close");
    }
    if (msg_t > 0) {
        float a = std::min(1.f, msg_t / 0.3f);
        float tw = u.text_width(msg, 30) + 60;
        u.frame(960 - tw / 2, 930, tw, 56, pal::panel2.alpha(a), pal::brass.alpha(a), 10, 2);
        u.text(960, 938, msg, 30, pal::bone.alpha(a), Align::Center, 0.6f);
    }
}

}  // namespace q
