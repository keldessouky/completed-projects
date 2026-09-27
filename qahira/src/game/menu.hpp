// The menu hub on Start: inventory and equipment, the character sheet and the loot filter; and the same
// inventory beside the vendor's wares at the ahwa. Controller-first: a cursor that walks cells and hops
// over whole items, South to use, North to drop, East to back out. The world is paused while it is open.
#pragma once
#include "game/world.hpp"
#include <string>

namespace q {

enum class MenuTab : uint8_t { Inventory, Character, Filter, Count };
enum class Region : uint8_t { Grid, Equip, Purse, Stock };

struct Menu {
    bool open = false;
    bool vendor = false;
    MenuTab tab = MenuTab::Inventory;
    Region region = Region::Grid;
    int cx = 0, cy = 0;          // cell under the cursor (Grid and Stock)
    int eq = EQ_WEAPON;          // equipment slot under the cursor
    int purse = 0;               // currency under the cursor
    int held = -1;               // currency picked up to be used on an item
    int filter_cursor = 0;
    Inventory stock;             // Amm Sayed's wares, restocked each visit
    std::string toast;
    float toast_t = 0;

    void show(World& w, bool at_vendor);
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
};

// Controller-safe item art for the grid: simple vector silhouettes per slot, tinted by rarity.
void draw_item_icon(float x, float y, float w, float h, const Item& it, float alpha = 1);
void draw_currency_icon(float cx, float cy, float s, int currency, float alpha = 1);

}  // namespace q
