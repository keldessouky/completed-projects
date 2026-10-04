// The menu's Game tab: back to the game, the update (Start → Game → Update), quitting to the title screen and
// exiting, both of which ask for a second press. The app carries out the quitting (Menu::request).
#include "game/menu.hpp"
#include "game/updater.hpp"
#include "game/view.hpp"
#include "ui/ui.hpp"

namespace q {

namespace {
constexpr float PX = 1030, PY = 36, PW = 850, PH = 1008;   // the right panel (as in menu.cpp)
enum Dir { D_UP, D_DOWN, D_LEFT, D_RIGHT };
}  // namespace

void Menu::game_update(World& w, const Input& in, int dir) {
    if (dir == D_UP || dir == D_DOWN) {
        game_cursor = (game_cursor + (dir == D_DOWN ? 1 : GAME_ROWS - 1)) % GAME_ROWS;
        game_armed = -1;
        w.emit(Ev::Craft, w.actors[0].pos, 0);
    }
    if (!in.hit(BTN_SOUTH)) return;
    w.emit(Ev::Craft, w.actors[0].pos, 0);
    switch (game_cursor) {
        case GAME_RESUME: hide(); break;
        case GAME_UPDATE: {
            Updater& up = updater();
            const Updater::State s = up.state();
            if (s == Updater::State::Available) up.install();
            else if (s == Updater::State::Idle || s == Updater::State::UpToDate || s == Updater::State::Failed) up.check();
            else if (s == Updater::State::Installed || s == Updater::State::NeedsCore) { game_cursor = GAME_EXIT; game_armed = -1; }
            break;
        }
        case GAME_TITLE:
        case GAME_EXIT:
            if (game_armed == game_cursor) request = game_cursor == GAME_TITLE ? Request::Title : Request::Exit;
            else game_armed = game_cursor;
            break;
    }
}

void Menu::game_render() const {
    Ui& u = ui();
    const Updater& up = updater();
    float x = PX + 60, y = PY + 130;
    u.text(x, y, "Your character is saved as you go", 26, pal::dim);
    y += 70;
    for (int r = 0; r < GAME_ROWS; r++) {
        const bool cur = game_cursor == r;
        std::string label;
        switch (r) {
            case GAME_RESUME: label = "Resume"; break;
            case GAME_UPDATE: label = up.text(); break;
            case GAME_TITLE: label = game_armed == r ? "Quit to the title? Press again" : "Quit to the title"; break;
            case GAME_EXIT: label = game_armed == r ? "Exit the game? Press again" : "Exit the game"; break;
        }
        const bool warn = game_armed == r || (r == GAME_UPDATE && up.state() == Updater::State::Failed);
        const bool news = r == GAME_UPDATE && (up.state() == Updater::State::Available || up.state() == Updater::State::Installed ||
                                               up.state() == Updater::State::NeedsCore);
        u.frame(x - 10, y, PW - 100, 86, cur ? pal::dusk : pal::panel2, cur ? pal::amber : news ? pal::rare : pal::line, 12,
                cur ? 3.f : 1.f);
        u.text(x + 20, y + 23, label, 32, warn ? pal::bad : news ? pal::rare : cur ? pal::amber : pal::bone, Align::Left, 0.8f);
        y += 98;
    }
    // what the update row does, and which build this is
    const Updater::State s = up.state();
    const char* help = s == Updater::State::Available ? "Downloads the new core and pack; your characters stay"
                       : s == Updater::State::Downloading ? "You can go on playing while it downloads"
                       : s == Updater::State::Installed ? "The new build starts the next time the game does"
                       : nullptr;
    if (help) { u.text(x, y, help, 24, pal::dim); y += 34; }
    if (s == Updater::State::NeedsCore) {   // RetroArch won't let the running core be replaced: the player does it
        const std::string core = up.manual_core();
        const std::string name = core.substr(core.find_last_of('/') + 1);
        u.text(x, y, "Exit the game, then in RetroArch:", 24, pal::bone);
        y += 34;
        u.text(x, y, "Load Core > Install or Restore a Core, and pick", 24, pal::bone);
        y += 34;
        u.text(x, y, name, 24, pal::rare);
        y += 34;
        u.text(x, y, "in " + core.substr(0, core.find_last_of('/')), 22, pal::dim, Align::Left, 0.8f);
        y += 34;
        u.text(x, y, "The new pack goes in by itself when the new core starts", 24, pal::dim);
        y += 34;
    }
    u.text(x, y, up.build(), 24, pal::dim);
    float lx = PX + 30;
    const float ly = PY + PH - 58;
    draw_button_glyph(lx + 20, ly + 18, 38, BTN_SOUTH);
    lx += 48;
    lx += u.text(lx, ly, "Choose", 26, pal::soft) + 30;
    draw_button_glyph(lx + 20, ly + 18, 38, BTN_EAST);
    u.text(lx + 48, ly, "Close", 26, pal::soft);
}

}  // namespace q
