#include "game/title.hpp"
#include "core/serial.hpp"
#include "game/classes.hpp"
#include "game/save.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"
#include <algorithm>
#include <cstdio>

namespace q {

std::string slot_path(const std::string& dir, int slot) { return dir + "/qahira_" + std::to_string(slot + 1) + ".character"; }

static bool read_file(const std::string& path, std::vector<uint8_t>& buf) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) return false;
    uint8_t chunk[4096];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, f)) > 0) buf.insert(buf.end(), chunk, chunk + n);
    fclose(f);
    return true;
}

void Title::scan(const std::string& dir) {
    // a Slice 2 save (one character, no slots) becomes the first slot
    std::string legacy = dir + "/qahira.character";
    if (FILE* f = fopen(legacy.c_str(), "rb")) {
        fclose(f);
        FILE* g = fopen(slot_path(dir, 0).c_str(), "rb");
        if (!g) rename(legacy.c_str(), slot_path(dir, 0).c_str());
        else fclose(g);
    }
    for (int i = 0; i < kSlots; i++) {
        slots[i] = Slot{};
        std::vector<uint8_t> buf;
        if (!read_file(slot_path(dir, i), buf)) continue;
        ByteReader r(buf.data(), buf.size());
        Hero h;
        if (!read_character(r, h)) continue;
        slots[i].exists = true;
        slots[i].cls = h.passives.cls;
        slots[i].level = h.level;
        slots[i].kills = h.kills;
    }
}

std::string Title::new_class() const {
    int n = 0;
    for (auto& c : class_defs())
        if (c.playable && n++ == cls_cursor) return c.id;
    return "warrior";
}

Title::Action Title::update(const Input& in, float dt) {
    t += dt;
    if (!open) return Action::None;
    if (picking) {
        int n = 0;
        for (auto& c : class_defs()) n += c.playable;
        if (in.hit(BTN_LEFT) || in.hit(BTN_UP)) cls_cursor = (cls_cursor + n - 1) % n;
        if (in.hit(BTN_RIGHT) || in.hit(BTN_DOWN)) cls_cursor = (cls_cursor + 1) % n;
        if (in.hit(BTN_EAST)) picking = false;
        if (in.hit(BTN_SOUTH) || in.hit(BTN_START)) { picking = false; return Action::New; }
        return Action::None;
    }
    if (in.hit(BTN_UP)) { cursor = (cursor + kSlots - 1) % kSlots; delete_armed = -1; }
    if (in.hit(BTN_DOWN)) { cursor = (cursor + 1) % kSlots; delete_armed = -1; }
    if (in.hit(BTN_SOUTH) || in.hit(BTN_START)) {
        if (slots[cursor].exists) return Action::Play;
        picking = true;
        cls_cursor = 0;
    }
    if (in.hit(BTN_NORTH) && slots[cursor].exists) {
        if (delete_armed == cursor) { delete_armed = -1; return Action::Delete; }
        delete_armed = cursor;
    }
    return Action::None;
}

void Title::render() const {
    if (!open) return;
    Ui& u = ui();
    u.rect(0, 0, 1920, 1080, pal::night);
    // the black sun low in the south, its corona burning, over a skyline of domes and minarets
    float sx = 1330, sy = 470;
    for (int i = 14; i >= 1; i--) u.disc(sx, sy, 150 + i * 16, Rgba::hex(0xF2A541).alpha(0.018f * (15 - i)));
    for (int k = 0; k < 48; k++) {
        float a = k * kTau / 48 + t * 0.05f, len = 60 + 40 * std::sin(k * 2.3f + t * 0.7f);
        u.line(sx + std::cos(a) * 150, sy + std::sin(a) * 150, sx + std::cos(a) * (150 + len), sy + std::sin(a) * (150 + len), 3,
               Rgba::hex(0xFFB060).alpha(0.35f));
    }
    u.ring(sx, sy, 158, 146, Rgba::hex(0xFFD08A).alpha(0.9f));
    u.disc(sx, sy, 147, pal::night);
    Rgba sil = Rgba::hex(0x0E0A14);
    u.rect(0, 760, 1920, 320, sil);
    for (int i = 0; i < 26; i++) {   // rooftops and domes
        float x = i * 78.f + (i % 3) * 12, h = 40 + (i * 37 % 90);
        u.rect(x, 760 - h, 70, h + 2, sil);
        if (i % 4 == 1) u.disc(x + 35, 760 - h, 30, sil);
        if (i % 7 == 3) { u.rect(x + 30, 760 - h - 150, 12, 150, sil); u.disc(x + 36, 760 - h - 150, 10, sil); }
    }
    u.text(160, 150, "QAHIRA", 150, pal::brass, Align::Left, 1.6f, true);
    u.text(170, 320, "Cairo, under an eclipse that never ended", 34, pal::soft);
    // character slots
    float y = 430;
    for (int i = 0; i < kSlots; i++) {
        bool cur = cursor == i && !picking;
        u.frame(160, y, 760, 96, cur ? pal::dusk : pal::panel.alpha(0.9f), cur ? pal::amber : pal::line, 14, cur ? 3.f : 1.5f);
        if (slots[i].exists) {
            u.text(200, y + 14, class_def(slots[i].cls).name, 36, cur ? pal::amber : pal::bone, Align::Left, 1.f);
            char b[96];
            snprintf(b, sizeof b, "Level %d  \xC2\xB7  %d laid to rest", slots[i].level, slots[i].kills);
            u.text(200, y + 58, b, 24, pal::dim);
            if (delete_armed == i) u.text(880, y + 30, "North again to delete", 26, pal::bad, Align::Right, 0.8f);
        } else {
            u.text(200, y + 28, "New character", 34, cur ? pal::amber : pal::soft, Align::Left, 0.6f);
        }
        y += 112;
    }
    if (picking) {
        u.rect(0, 0, 1920, 1080, pal::night.alpha(0.7f));
        u.text(960, 170, "Choose a class", 56, pal::amber, Align::Center, 1.4f, true);
        int n = 0;
        std::vector<const ClassDef*> list;
        for (auto& c : class_defs()) if (c.playable) list.push_back(&c);
        const float gap = list.size() > 3 ? 40.f : 60.f, cw = std::min(560.f, (1800.f - (list.size() - 1) * gap) / list.size());
        const float x0 = 960 - (list.size() * cw + (list.size() - 1) * gap) / 2;
        const float big = cw < 380 ? 34.f : cw < 500 ? 40.f : 46.f;
        for (auto* c : list) {
            float x = x0 + n * (cw + gap), yy = 300;
            bool cur = n == cls_cursor;
            u.frame(x, yy, cw, 460, cur ? pal::dusk : pal::panel, cur ? pal::amber : pal::line, 16, cur ? 3.f : 1.5f);
            u.text(x + cw / 2, yy + 30, c->name, big, cur ? pal::amber : pal::bone, Align::Center, 1.3f);
            u.text(x + cw / 2, yy + 96, c->attr, 28, pal::turquoise, Align::Center, 0.6f);
            u.wrap(x + 30, yy + 160, cw - 60, c->blurb, cw < 380 ? 23 : cw < 500 ? 26 : 28, pal::soft);
            n++;
        }
        float lx = 700, ly = 900;
        for (auto [b, t] : {std::pair<int, const char*>{BTN_LEFT, "Choose"}, {BTN_SOUTH, "Begin"}, {BTN_EAST, "Back"}}) {
            draw_button_glyph(lx + 20, ly + 18, 40, b);
            lx += 50 + u.text(lx + 50, ly, t, 28, pal::soft) + 40;
        }
        return;
    }
    float lx = 160, ly = 980;
    for (auto [b, t] : {std::pair<int, const char*>{BTN_SOUTH, "Play"}, {BTN_NORTH, "Delete"}}) {
        draw_button_glyph(lx + 20, ly + 18, 40, b);
        lx += 50 + u.text(lx + 50, ly, t, 28, pal::soft) + 40;
    }
}

}  // namespace q
