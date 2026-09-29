// The menu hub on Start: inventory and equipment, the character sheet and the loot filter; and the same
// inventory beside the vendor's wares at the ahwa. Controller-first: a cursor that walks cells and hops
// over whole items, South to use, North to drop, East to back out. The world is paused while it is open.
#pragma once
#include "game/world.hpp"
#include <string>
#include <vector>

namespace q {

enum class MenuTab : uint8_t { Inventory, Talismans, Character, Ascendancy, Journal, Filter, Settings, Game, Count };
// the Game tab's rows
enum GameRow { GAME_RESUME, GAME_UPDATE, GAME_TITLE, GAME_EXIT, GAME_ROWS };
enum class Region : uint8_t { Grid, Equip, Purse, Stock, Bench };

struct Menu {
    bool open = false;
    bool vendor = false;
    bool dealer = false;          // the vendor is Amm Ramadan, the antiquities dealer (Excavations): relics, not dinars
    bool bench = false;           // opened at the Coppersmith's Bench
    MenuTab tab = MenuTab::Inventory;
    Region region = Region::Grid;
    int cx = 0, cy = 0;          // cell under the cursor (Grid and Stock)
    int eq = EQ_WEAPON;          // equipment slot under the cursor
    int purse = 0;               // currency under the cursor
    int purse_scroll = 0;        // the first currency the purse row shows
    int held = -1;               // currency picked up to be used on an item
    // the Coppersmith's Bench: a recipe list beside your belongings
    int bench_cursor = 0;
    int held_recipe = -1;        // a recipe chosen, waiting for an item (kTakeOff: take a bench mod off)
    static constexpr int kTakeOff = 1000;
    // the Ascendancy tab and the Journal
    int asc_cursor = 1;
    int asc_choice = 0;            // a class with two ascendancies: the one looked at before choosing
    int journal_section = 0;     // quests, codex, posters
    int journal_row = 0;
    int filter_cursor = 0;
    int settings_cursor = 0;   // the Settings tab (Slice 11)
    int game_cursor = 0;       // the Game tab: resume, update, quit to the title, exit
    int game_armed = -1;       // quitting and exiting ask for a second press
    enum class Request : uint8_t { None, Title, Exit } request = Request::None;   // for the app to carry out
    Inventory stock;             // Amm Sayed's wares, restocked each visit
    std::string toast;
    float toast_t = 0;
    // the Talismans tab: rows 0-9 are the two bars, row 10 the Blank Talismans; a picker list opens over it
    int tal_row = 0, tal_col = 0;
    enum class Pick : uint8_t { None, Talisman, Wafq, Carve } pick = Pick::None;
    std::vector<int> pick_items;
    int pick_cursor = 0;
    // the Character tab: a cursor over the stat rows, and the "Why?" breakdown of the one under it
    int why_row = 0;
    bool why_open = false;

    void show(World& w, bool at_vendor);
    void show_bench(World& w);
    void show_dealer(World& w);
    void restock_dealer(World& w);
    static int relic_price(const Item& it);
    void hide();
    void restock(World& w);
    void update(World& w, const Input& in, float dt);
    void render(const World& w) const;
    void say(const std::string& s) { toast = s; toast_t = 2.4f; }

    int hovered_inv(const World& w) const;       // index into hero.inv.items, -1 if none
    int hovered_stock() const;                   // index into stock.items, -1 if none
    static int buy_price(const Item& it) { return std::max(5, sell_price(it) * 4); }

private:
    float repeat_t_ = 0;
    int last_dir_ = -1;
    void move(World& w, int dir);
    void act_south(World& w);
    void act_north(World& w);
    void tal_update(World& w, const Input& in, int dir);
    void tal_render(const World& w) const;
    void char_update(World& w, const Input& in, int dir);
    void char_render(const World& w) const;
    void bench_move(World& w, int dir);
    bool bench_south(World& w);            // true if it handled the press
    void bench_render(const World& w, const Item*& tip, float& tip_y, std::string& footer) const;
    void asc_update(World& w, const Input& in, int dir);
    void asc_render(const World& w) const;
    void journal_update(World& w, const Input& in, int dir);
    void journal_render(const World& w) const;
    void game_update(World& w, const Input& in, int dir);
    void game_render() const;
};

// A film's poster (GDD §7.4), with the scraps you hold of it; missing quarters are torn away.
void draw_poster(float x, float y, float w, float h, int unique, int scraps, float alpha = 1);
int journal_rows(const Hero& h, int section);

// Controller-safe item art for the grid: simple vector silhouettes per slot, tinted by rarity.
void draw_item_icon(float x, float y, float w, float h, const Item& it, float alpha = 1);
void draw_currency_icon(float cx, float cy, float s, int currency, float alpha = 1);

}  // namespace q
