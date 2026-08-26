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
/*  The show runs eighteen floors and a season ends when the crawler does.
    Depth is the score. */
#define FLOORS       18
#define MAX_FOES     3
#define PARTY        2
#define INVENTORY    12
#define MAX_TOASTS   4
#define MAX_LOG      6
#define MAX_ROOMS    9


typedef enum {
    SCENE_TITLE, SCENE_STORY, SCENE_DUNGEON, SCENE_BATTLE, SCENE_MENU,
    SCENE_SHOP, SCENE_BOX, SCENE_LEVELUP, SCENE_CODE, SCENE_GAMEOVER,
    SCENE_VICTORY, SCENE_CUTSCENE, SCENE_DRAFT, SCENE_SAFEROOM, SCENE_COUNT
} Scene;

typedef enum { DIR_N, DIR_E, DIR_S, DIR_W } Dir;

/* Tiles, as they appear in the ASCII maps under tools/floors. */
enum {
    T_WALL = '#', T_FLOOR = '.', T_START = '@', T_UP = '<', T_DOWN = '>',
    T_DOOR = '+', T_SHOP = 'S', T_SHRINE = 'R', T_KIOSK = '*',
    T_BOX = 'c', T_BOX_GOLD = 'C', T_BOSS = 'b', T_NBOSS = 'n',
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
    /*  0 mob, 1 neighbourhood boss, 2 borough boss. The floor is four
        neighbourhoods to a square, each with its own boss, and borough bosses
        are the rarer ones that sit on a stairwell. */
    uint8_t     rank;
    const char *quip;       /* the announcers love a caption */
} FoeDef;

typedef struct {
    const char *name;
    const char *how;
    uint8_t     box;        /* loot box tier it pays out, 255 for none */
    int16_t     gold;
} AchDef;

typedef enum { SP_SYSTEM, SP_CARL, SP_DONUT, SP_MORDECAI, SP_BOPCA, SP_ANNOUNCER,
               SP_NARRATOR } Speaker;

typedef struct {
    uint8_t     speaker;
    const char *text;
} Line;

/* ------------------------------------------------------------- cutscene -- */

/*  Book One opens above ground, so the game has to as well: the chapter that
 *  matters most has no dungeon in it at all. A cutscene is a backdrop, a
 *  speaker and a line, with the occasional question that expects an answer.
 */
enum {
    BD_KEEP = 0,        /* leave the backdrop as it was */
    BD_STREET, BD_STREET_CAT, BD_COLLAPSE, BD_ANNOUNCE, BD_STAIRS, BD_DUNGEON,
    BD_COUNT
};

enum {
    CUT_NONE   = 0,
    CUT_SHAKE  = 1 << 0,     /* the world coming down                     */
    CUT_FLASH  = 1 << 1,     /* the System cutting in                     */
    CUT_CHOICE = 1 << 2,     /* stop and wait for an answer               */
    CUT_AWARD  = 1 << 3,     /* hand over whatever this line is worth     */
};

typedef struct {
    uint8_t     speaker;
    uint8_t     backdrop;
    uint8_t     flags;
    uint8_t     award;          /* achievement index when CUT_AWARD       */
    const char *text;
    const char *opt[3];         /* the answers, when CUT_CHOICE           */
    const char *reply[3];       /* what the answer gets you               */
} CutLine;

typedef struct {
    uint8_t      chapter;       /* 1-based, as printed on the card        */
    const char  *title;
    const CutLine *lines;
    uint8_t      count;
} Chapter;

extern const Chapter chapters[];
extern const int chapter_count;

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
    uint8_t  crawler;           /* which CrawlerDef this slot was filled from */
} Hero;

/* -------------------------------------------------------------- crawlers -- */

/*  A season is a new crawler, so who you take down is the run's first real
 *  decision. Skills belong to a crawler rather than to a party slot: it is the
 *  same list whether they are drafted first or second. */
typedef struct {
    const char *name;
    const char *title;
    uint8_t     sprite;
    Stats       st;
    const char *blurb;
} CrawlerDef;

/* ---------------------------------------------------------- recall codes -- */

/*  One recall code, in characters. Everything that prints a code, accepts one,
 *  or sizes a buffer for one derives from this. It used to be sixteen; when the
 *  payload grew to carry the drafted crawlers it became twenty, and the three
 *  places in the UI that had the old number written into them did not change --
 *  which left the kiosk printing sixteen of twenty characters and the keyboard
 *  refusing the last four, so no code the game printed could be typed back in.
 */
#define CODE_CHARS   20
#define CODE_GROUP   5          /* characters between separators */
#define CODE_PER_ROW 10         /* what fits across the kiosk panel at 2x */

/*  Writes `count` characters of a code starting at `from`, with a separator
 *  every CODE_GROUP. `out` needs room for count + count/CODE_GROUP + 1. */
int   code_format(char *out, const char *code, int from, int count, char sep);

/* ------------------------------------------------------------ safe rooms -- */

typedef struct {
    const char *name;
    const char *blurb;
} SafeRoomDef;

int32_t crawlers_left(void);

extern const SafeRoomDef safe_room_defs[];
extern const int safe_room_count;

/* ---------------------------------------------------------- neighbourhood -- */

typedef struct {
    const char *name;
    uint8_t     foe;        /* index into foe_defs: the local mob */
    uint8_t     from_floor; /* first floor this neighbourhood turns up on */
} ZoneDef;

extern const ZoneDef zone_defs[];
extern const int zone_count;

/*  Indices into crawler_defs. Named for the same reason the achievements are:
 *  a bare 1 in a condition somewhere else is a bug waiting to be written. */
enum { CR_CARL, CR_DONUT, CR_MORDECAI, CR_BOPCA };

extern const CrawlerDef crawler_defs[];
extern const int crawler_count;

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
    /*  A Pokemon battle says one thing at a time and waits to be read. The
     *  log was already the right data; what was missing was the pacing. */
    uint8_t  log_shown;         /* lines the player has actually been shown */
    uint16_t reveal;            /* characters of the current line typed out */
    uint16_t hold;              /* frames to wait once a line is fully typed */
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

    /*  Book One describes the first floor as squares of neighbourhoods, each
     *  with its own local mob, rather than one undifferentiated maze. The
     *  generator already builds rooms; tagging each one with a neighbourhood
     *  is what turns "a floor" into "somewhere on a floor". */
    uint8_t  n_rooms;
    int8_t   room_x[MAX_ROOMS], room_y[MAX_ROOMS];
    int8_t   room_w[MAX_ROOMS], room_h[MAX_ROOMS];
    uint8_t  room_zone[MAX_ROOMS];
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

    /* the draft: who goes down this season */
    uint8_t  draft_cursor;
    uint8_t  draft_pick[PARTY];
    uint8_t  draft_slot;        /* 0 or 1: which chair is being filled */

    /* chapters and cutscenes */
    uint8_t  chapter;           /* which chapter of Book One is running   */
    uint8_t  cut_line;
    uint16_t cut_reveal;
    uint8_t  cut_backdrop;
    uint8_t  cut_choice;        /* cursor while a question is up          */
    uint8_t  cut_answer;        /* which answer was taken, 255 = not yet  */
    uint16_t cut_shake;

    /* story scene */
    const Beat *beat;
    uint8_t  beat_line;
    uint8_t  beat_after;        /* scene to return to */
    uint16_t beat_reveal;

    /* menus, shop, boxes */
    uint8_t  menu_tab, menu_cursor;
    uint8_t  shop_cursor;
    uint8_t  box_tier, box_phase, box_item;
    uint8_t  safe_room;         /* index into safe_room_defs, while in one */
    uint16_t zone_cleared;      /* bit per zone whose boss is down */
    uint8_t  pending_zone;      /* zone+1 whose boss is being fought, 0 for none */
    /*  Boxes owed. Achievements can pay out several at once and each one is a
        scene, so they wait here until the party is somewhere a scene can run. */
    uint8_t  box_queue[8];
    int      box_queue_n;
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
int      battle_message(const char **out);   /* the line being read, if any */
void     chapter_begin(int chapter);
void     chapter_update(const PlatInput *in);
const CutLine *chapter_line(void);
int      chapter_text(const char **out);   /* characters typed so far */
int      chapter_asking(void);             /* a question is up and readable */
void     mapgen_build(int floor_index, uint32_t season);
int      game_season_number(void);
void     rng_seed(uint32_t seed);
uint32_t rng_next(void);
int      rng_range(int lo, int hi);      /* inclusive */
int      rng_chance(int percent);

/* party.c */
void  party_new(void);
int   season_count(void);
int   season_best_floor(void);
int   season_best_level(void);
int   season_best_kills(void);
void  draft_begin(void);
void  draft_update(const PlatInput *in);
void  party_draft(int a, int b);   /* fill both slots from the roster */
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
/*  Indices into item_defs. Bare 1s and 3s were scattered across three files
 *  handing out starting kit; a reordered table would have silently changed
 *  what the party walks in with. */
enum { ITEM_NONE, ITEM_SPLINT, ITEM_COLD_SLICE, ITEM_ENERGY };

extern const ItemDef  item_defs[];
extern const int      item_count;
extern const SkillDef skill_defs[];
extern const int      skill_count;
extern const FoeDef   foe_defs[];
extern const int      foe_count;
/*  Named, because these were bare integers scattered across four files and
 *  that is exactly how an index drifts off the end of its array. */
/*  The first six are decided entirely by which pair went down, and a recall
 *  code already carries that. Keeping them at the bottom of the enum lets the
 *  code store only the ones actually earned by playing -- which is what makes
 *  twenty-one achievements fit a payload with no spare bits left in it. */
enum {
    ACH_CAT_LADY, ACH_EARLY_ADOPTER, ACH_EMPTY_POCKETS, ACH_NO_PANTS,
    ACH_UNARMED, ACH_LONER,
    ACH_ENTRY_COUNT,                    /* everything below is earned, not given */

    ACH_DAMAGE = ACH_ENTRY_COUNT, ACH_FIRST_KILL, ACH_BARE_HANDS,
    ACH_PODOPHILIA, ACH_BOOM, ACH_LEVEL_UP, ACH_LOOT, ACH_BOSS_BABE,
    ACH_TWO_AT_ONCE, ACH_NEIGHBOURHOOD, ACH_STAIRWELL, ACH_CARTOGRAPHER,
    ACH_READ_THE_ROOM, ACH_NO_SHOES, ACH_OUTSIDE
};

void     game_award_entry(void);        /* the six the draft decides */
uint32_t game_entry_achievements(void);
void     game_drain_box_queue(void);

extern const AchDef   ach_defs[];
extern const int      ach_count;
extern const Beat     story_beats[];
extern const int      beat_count;
extern const char    *const speaker_names[];
int   dungeon_zone(void);            /* which neighbourhood the party is in */
int   foe_pick(int floor_no);
int   dungeon_zone_at(int x, int y);
int   dungeon_zone_cleared(void);
int   foe_boss(int floor_no);
int   foe_nboss(int floor_no);
int   foe_scale(int floor_no);   /* percent, by depth */
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
