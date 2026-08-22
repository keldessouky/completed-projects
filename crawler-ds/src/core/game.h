/*  Dungeon Crawler Carl: Book One - game state.
 *
 *  Everything below the platform layer is portable C with no allocation: one
 *  Game struct holds the entire run, which is what makes both the recall codes
 *  and the desktop bot possible.
 */
#ifndef CRAWLER_GAME_H
#define CRAWLER_GAME_H

#include <stdint.h>

#include "platform.h"

/* ------------------------------------------------------------- constants -- */

#define MAP_MAX      32
#define FLOORS       3
#define MAX_FOES     3
#define PARTY        2
#define INVENTORY    12
#define MAX_TOASTS   4
#define MAX_LOG      6


typedef enum {
    SCENE_TITLE, SCENE_STORY, SCENE_DUNGEON, SCENE_BATTLE, SCENE_MENU,
    SCENE_SHOP, SCENE_BOX, SCENE_LEVELUP, SCENE_CODE, SCENE_GAMEOVER,
    SCENE_VICTORY, SCENE_COUNT
} Scene;

typedef enum { DIR_N, DIR_E, DIR_S, DIR_W } Dir;

/* Tiles, as they appear in the ASCII maps under tools/floors. */
enum {
    T_WALL = '#', T_FLOOR = '.', T_START = '@', T_UP = '<', T_DOWN = '>',
    T_DOOR = '+', T_SHOP = 'S', T_SHRINE = 'R', T_KIOSK = '*',
    T_BOX = 'c', T_BOX_GOLD = 'C', T_BOSS = 'b',
};

/* --------------------------------------------------------------- content -- */

typedef enum {
    IT_NONE, IT_HEAL, IT_STAMINA, IT_BOMB, IT_REVIVE, IT_BUFF,
    IT_WEAPON, IT_ARMOUR, IT_TRINKET
} ItemKind;

typedef struct {
    const char *name;
    uint8_t     kind;
    int8_t      power;      /* healing, damage, or the stat it adds */
    int16_t     price;
    uint8_t     slot;       /* equipment slot for gear: 0 weapon 1 armour 2 trinket */
    const char *blurb;
} ItemDef;

typedef enum {
    SK_HIT_ONE, SK_HIT_ALL, SK_BLEED, SK_STUN, SK_HEAL, SK_GUARD_ALL,
    SK_BUFF_ATK, SK_DEBUFF_DEF, SK_TAUNT, SK_REVIVE
} SkillKind;

typedef struct {
    const char *name;
    uint8_t     owner;      /* 0 Carl, 1 Donut */
    uint8_t     kind;
    uint8_t     cost;
    uint8_t     power;      /* percent of a normal hit, or the effect size */
    uint8_t     unlock;     /* level it arrives at */
    const char *blurb;
} SkillDef;

typedef struct {
    const char *name;
    uint8_t     sprite;
    int16_t     hp;
    uint8_t     atk, def, spd;
    int16_t     xp, gold;
    uint8_t     trick;      /* percent chance of using its trick */
    uint8_t     trick_kind; /* a SkillKind */
    uint8_t     trick_power;
    uint8_t     floor;      /* which floor it wanders */
    const char *quip;       /* the announcers love a caption */
} FoeDef;

typedef struct {
    const char *name;
    const char *how;
    uint8_t     box;        /* loot box tier it pays out, 255 for none */
    int16_t     gold;
} AchDef;

typedef enum { SP_SYSTEM, SP_CARL, SP_DONUT, SP_MORDECAI, SP_BOPCA, SP_ANNOUNCER } Speaker;

typedef struct {
    uint8_t     speaker;
    const char *text;
} Line;

typedef struct {
    uint8_t      id;
    uint8_t      floor;      /* 0 = any */
    uint8_t      trigger;    /* map digit, or one of the TRIG_* codes */
    const Line  *lines;
    uint8_t      count;
} Beat;

enum {
    TRIG_FLOOR_ENTER = 20, TRIG_BOSS_WIN, TRIG_FIRST_BLOOD, TRIG_FIRST_BOX,
    TRIG_SHOP, TRIG_SHRINE, TRIG_KIOSK, TRIG_STAIRS, TRIG_GAME_END,
};

/* Story flags that outlive a scene. */
enum {
    F_MET_MORDECAI = 1u << 0, F_CLASS_PICKED = 1u << 1, F_DONUT_TALKS = 1u << 2,
    F_FLOOR1_BOSS  = 1u << 3, F_FLOOR2_BOSS = 1u << 4, F_FLOOR3_BOSS = 1u << 5,
    F_SEEN_SHOP    = 1u << 6, F_SPONSOR = 1u << 7, F_TUTORIAL_DONE = 1u << 8,
};

/* ------------------------------------------------------------------ party -- */

typedef struct { uint8_t str, dex, con, wit, cha, luck; } Stats;

enum { ST_BLEED, ST_STUN, ST_ATKUP, ST_DEFDOWN, ST_COUNT };

typedef struct {
    const char *name;
    Stats    st;
    uint8_t  level;
    int16_t  xp;
    int16_t  hp, hp_max;
    int16_t  mp, mp_max;
    int8_t   equip[3];          /* item ids, -1 for empty */
    uint8_t  status[ST_COUNT];  /* turns remaining */
    uint8_t  points;            /* unspent level-up points */
    uint8_t  guard;
    const char *title;
} Hero;

typedef struct {
    uint8_t  def;               /* index into foe_defs */
    int16_t  hp, hp_max;
    uint8_t  status[ST_COUNT];
    uint8_t  alive;
} Foe;

/* ---------------------------------------------------------------- battle -- */

typedef enum {
    BAT_INTRO, BAT_CHOOSE, BAT_TARGET, BAT_SKILL, BAT_ITEM, BAT_RESOLVE,
    BAT_WON, BAT_LOST, BAT_FLED
} BattlePhase;

typedef struct {
    uint8_t  phase;
    uint8_t  boss;
    uint8_t  n_foes;
    Foe      foes[MAX_FOES];
    uint8_t  turn_order[PARTY + MAX_FOES];
    uint8_t  n_turns, turn_index;
    uint8_t  actor;             /* 0..1 party, 2+ foes */
    uint8_t  cursor, target, menu;
    uint16_t timer;
    int16_t  xp_won, gold_won;
    uint8_t  shake;
    int16_t  pop_damage[MAX_FOES + PARTY];
    uint8_t  pop_life[MAX_FOES + PARTY];
    char     log[MAX_LOG][40];
    uint8_t  n_log;
} Battle;

/* --------------------------------------------------------------- dungeon -- */

typedef struct {
    uint8_t  index;                       /* 0..FLOORS-1 */
    uint8_t  w, h;
    char     tiles[MAP_MAX * MAP_MAX];    /* built per run by mapgen */
    uint8_t  px, py, facing;
    uint8_t  seen[MAP_MAX * MAP_MAX / 8];
    uint8_t  used[MAP_MAX * MAP_MAX / 8]; /* boxes opened, triggers fired */
    uint16_t steps_to_encounter;
    int32_t  collapse;                    /* frames left before the floor goes */
    uint16_t steps;
    uint16_t explored;
} Dungeon;

/* ------------------------------------------------------------------ game -- */

typedef struct {
    char     text[38];
    uint8_t  life;
    uint8_t  kind;      /* 0 system, 1 achievement, 2 loot */
} Toast;

typedef struct {
    Scene    scene;
    Scene    scene_return;
    uint32_t frame;
    uint32_t rng;
    uint32_t season;            /* the seed this run's dungeon is built from */

    Hero     hero[PARTY];
    int16_t  gold;
    uint8_t  inventory[INVENTORY];
    uint32_t flags;
    uint32_t achievements;
    uint16_t boxes_opened;
    uint16_t battles_won;
    uint8_t  story_beat;

    Dungeon  dun;
    Battle   bat;

    /* story scene */
    const Beat *beat;
    uint8_t  beat_line;
    uint8_t  beat_after;        /* scene to return to */
    uint16_t beat_reveal;

    /* menus, shop, boxes */
    uint8_t  menu_tab, menu_cursor;
    uint8_t  shop_cursor;
    uint8_t  box_tier, box_phase, box_item;
    uint16_t box_timer;
    uint8_t  levelup_hero;

    /* recall codes */
    char     code[24];
    uint8_t  code_len, code_mode, code_cursor;
    uint8_t  code_status;

    Toast    toast[MAX_TOASTS];
    uint16_t fade;
    uint8_t  fade_dir;
    uint8_t  pending_scene;
    uint16_t hurt_flash;
    uint8_t  title_cursor;
    uint16_t anim;
} Game;

extern Game g;

/* ------------------------------------------------------------------- api -- */

/* rng.c */
void     mapgen_build(int floor_index, uint32_t season);
int      game_season_number(void);
void     rng_seed(uint32_t seed);
uint32_t rng_next(void);
int      rng_range(int lo, int hi);      /* inclusive */
int      rng_chance(int percent);

/* party.c */
void  party_new(void);
int   hero_attack(const Hero *h);
int   hero_defence(const Hero *h);
int   hero_speed(const Hero *h);
int   hero_max_hp(const Hero *h);
int   hero_max_mp(const Hero *h);
void  hero_recompute(Hero *h);
int   hero_xp_needed(int level);
int   hero_gain_xp(Hero *h, int xp);      /* returns levels gained */
void  hero_heal(Hero *h, int amount);
int   party_alive(void);
int   inventory_add(int item, int count);
int   inventory_count(int item);
int   equip_item(Hero *h, int item);

/* dungeon.c */
void  dungeon_enter(int floor_index);
char  dungeon_tile(int x, int y);
void  dungeon_set_used(int x, int y);
int   dungeon_is_used(int x, int y);
int   dungeon_seen(int x, int y);
void  dungeon_mark_seen(int x, int y);
int   dungeon_walkable(int x, int y);
void  dungeon_step(int forward);
void  dungeon_turn(int delta);
void  dungeon_interact(void);
void  dungeon_tick(void);
void  dungeon_light_of_sight(void);
void  dungeon_strafe(int right);

/* battle.c */
void  battle_start(int boss);
void  battle_update(const PlatInput *in);
void  battle_log(const char *fmt_text);
int   battle_foe_count(void);

/* content.c */
extern const ItemDef  item_defs[];
extern const int      item_count;
extern const SkillDef skill_defs[];
extern const int      skill_count;
extern const FoeDef   foe_defs[];
extern const int      foe_count;
extern const AchDef   ach_defs[];
extern const int      ach_count;
extern const Beat     story_beats[];
extern const int      beat_count;
extern const char    *const speaker_names[];
int   foe_pick(int floor_index);
int   foe_boss(int floor_index);
const Beat *beat_find(int floor, int trigger);

/* save.c */
void  save_make_code(char *out);
int   save_apply_code(const char *code);   /* 1 on success */

/* game.c */
void  game_boot(void);
int   game_frame(const PlatInput *in);
void  game_toast(const char *text, int kind);
void  game_award(int achievement);
void  game_story(int floor, int trigger, Scene after);
void  game_open_box(int tier);
void  game_set_scene(Scene s);
int   game_hero_skills(int hero, const SkillDef **out, int max);

/* render */
int   render_frame(void);
void  ui_touch_reset(void);
int   ui_button(int screen, int x, int y, int w, int h, const char *label, int enabled);
int   ui_button_pressed(int id);

#endif
