/*  Every table the game reads: gear, skills, the bestiary, achievements and the
 *  script.
 *
 *  This is a fan game. The characters and the premise belong to Matt Dinniman;
 *  none of the prose below is his. Every line here was written for this ROM.
 */
#include "game.h"

#include "art.h"

/* -------------------------------------------------------------- the shop -- */

const ItemDef item_defs[] = {
    { "-",               IT_NONE,     0,   0, 0, "" },
    { "Splint Potion",   IT_HEAL,    40,  30, 0, "Tastes like pennies. Closes a wound anyway." },
    { "Cold Slice",      IT_HEAL,    95,  75, 0, "Pizza the dungeon swears is fresh. Restores a lot." },
    { "Energy Drink",    IT_STAMINA, 30,  45, 0, "Legally distinct from the one you know. +30 stamina." },
    { "Pipe Bomb",       IT_BOMB,    48,  60, 0, "Thrown, not placed. Hurts everything in the room." },
    { "Second Wind",     IT_REVIVE,  50, 140, 0, "Puts a downed crawler back on their feet." },
    { "Adrenaline Shot", IT_BUFF,     4,  50, 0, "Three turns of hitting much harder." },
    { "Length of Rebar", IT_WEAPON,   5, 140, 0, "Concrete still attached. That is the point." },
    { "Fire Axe Handle", IT_WEAPON,   9, 400, 0, "No head. The handle was always the good part." },
    { "Duct-Tape Wrap",  IT_ARMOUR,   4, 130, 1, "Wrapped over everything that bleeds." },
    { "Riot Vest",       IT_ARMOUR,   8, 430, 1, "Looted off something that failed to riot." },
    { "Lucky Molar",     IT_TRINKET,  4, 260, 2, "Not yours. Luckier than yours." },
};
const int item_count = (int)(sizeof item_defs / sizeof item_defs[0]);

/* ---------------------------------------------------------------- skills -- */

const SkillDef skill_defs[] = {
    /* FIGHT opens this list, so the free option has to be in it: every hero
       has one move that costs nothing and always works. */
    { "Barefoot Kick", 0, SK_HIT_ONE,    0, 100,  1, "No stamina, no wind-up, no shoes." },
    /* Carl fights with what the apocalypse left him: bare feet and momentum. */
    { "Stomp",         0, SK_HIT_ONE,    3, 145,  1, "Both heels, one target, no follow-through." },
    { "Shoulder Check",0, SK_STUN,       5,  90,  3, "Puts something on the floor and keeps it there a turn." },
    { "Sweep",         0, SK_HIT_ALL,    7, 105,  5, "A low arc through everything standing." },
    { "Cover Her",     0, SK_GUARD_ALL,  4,   0,  4, "Carl eats the next round for the party." },
    { "Righteous Fury",0, SK_BUFF_ATK,   6,   5,  6, "Three turns of extremely poor decisions." },
    { "Haymaker",      0, SK_HIT_ONE,   10, 235,  8, "Wind-up included. Worth it." },
    /* Princess Donut fights with claws and an audience. */
    { "Swipe",         1, SK_HIT_ONE,    0, 100,  1, "One paw, full commitment, free of charge." },
    { "Claw Flurry",   1, SK_HIT_ONE,    3, 125,  1, "Seven strikes, one second, no apology." },
    { "Hiss",          1, SK_DEBUFF_DEF, 4,  40,  2, "The target's defence remembers it has other plans." },
    { "Royal Grooming",1, SK_HEAL,       5,  55,  3, "She licks a wound closed and expects thanks." },
    { "Pounce",        1, SK_BLEED,      5, 110,  4, "Opens something that keeps opening." },
    { "Adoring Public",1, SK_TAUNT,      6,   0,  5, "The viewers scream. Everything looks at her." },
    { "Command Presence",1, SK_HIT_ALL,  9, 120,  7, "The room is reminded whose show this is." },
    /* Mordecai fights the way a man fights who would rather not. */
    { "Read The Room", 2, SK_HIT_ONE,    0, 100,  1, "Finds the soft spot. Costs nothing but dignity." },
    { "Old Trick",     2, SK_DEBUFF_DEF, 3,  55,  1, "Something he has done a thousand times to a thousand of these." },
    { "Field Dressing",2, SK_HEAL,       4,  40,  2, "Not medicine. Adjacent to medicine." },
    { "Hard Word",     2, SK_STUN,       5,  85,  3, "One sentence, delivered flatly, and the thing stops." },
    { "Long Odds",     2, SK_BUFF_ATK,   6,   5,  5, "He has done the maths and is choosing to ignore it." },
    { "Closing Time",  2, SK_HIT_ALL,    9, 150,  7, "Everyone out." },
    /* The Bopca was drafted and is compensating with inventory and luck. */
    { "Till Swing",    3, SK_HIT_ONE,    0, 100,  1, "Free, heavy, and entirely unlicensed." },
    { "Price Gouge",   3, SK_HIT_ONE,    4, 165,  2, "Charges the target for the privilege." },
    { "Stock Take",    3, SK_BUFF_ATK,   4,   4,  3, "Counts what is left and gets alarming about it." },
    { "Loss Prevention",3,SK_GUARD_ALL,  5,   0,  4, "Nothing leaves this floor unpaid for." },
    { "Clearance",     3, SK_HIT_ALL,    8, 145,  6, "Everything must go, including you." },
    { "Final Notice",  3, SK_BLEED,      7, 175,  8, "Written in red, twice." },
};
const int skill_count = (int)(sizeof skill_defs / sizeof skill_defs[0]);

/* ------------------------------------------------------------- bestiary --- */

const FoeDef foe_defs[] = {
    /* name             sprite         hp atk def spd   xp gold trick kind         pow fl rk quip */
    { "Sewer Rat",      SPR_RAT,       22,  6,  2,  7,  12,   8, 10, SK_BLEED,      60, 1, 0, "It has been eating better than you." },
    { "Goblin Trapper", SPR_GOBLIN,    30,  8,  4,  6,  18,  14, 20, SK_DEBUFF_DEF, 30, 1, 0, "Sponsored by nobody. Trying very hard." },
    /*  A Rot Sticker is a delivery mechanism, not a fighter: almost no health,
        almost no defence, and it hits the whole party when it goes. Killing it
        fast is the entire counterplay, which is why it is also slow. */
    { "Rot Sticker",    SPR_ROTSTICKER, 14, 11,  1,  2,  16,   6, 55, SK_HIT_ALL,   130, 1, 0, "Do not let it get comfortable." },
    { "Troglodyte",     SPR_TROGLODYTE, 34,  9,  5,  5,  20,  10, 20, SK_STUN,       60, 1, 0, "No eyes. Did not need them to find you." },
    { "Screaming Sofa", SPR_SOFA,      44,  7,  8,  3,  22,  20, 15, SK_STUN,       70, 1, 0, "Floor one keeps sending furniture." },
    { "Sludge Mound",   SPR_SLUDGE,    36,  7,  5,  4,  20,  12, 25, SK_HIT_ALL,    70, 1, 0, "Wet. Patient. Faintly sweet." },
    { "Kobold Sapper",  SPR_KOBOLD,    46, 12,  6,  9,  34,  26, 30, SK_HIT_ALL,    85, 2, 0, "Carrying something with a fuse." },
    { "Bramble Hound",  SPR_HOUND,     54, 14,  7, 12,  40,  22, 25, SK_BLEED,      90, 2, 0, "It was a dog. The floor improved it." },
    { "Doom Beetle",    SPR_BEETLE,    62, 13, 12,  6,  44,  30, 20, SK_DEBUFF_DEF, 45, 2, 0, "Armoured, unbothered, extremely purple." },
    { "Bone Bailiff",   SPR_BAILIFF,   58, 16,  9,  8,  48,  38, 35, SK_STUN,       80, 2, 0, "It has a warrant. It will not show you." },
    { "Neon Mimic",     SPR_MIMIC,     72, 19, 10, 11,  62,  55, 35, SK_HIT_ONE,   150, 3, 0, "A loot box with opinions." },
    { "Club Bouncer",   SPR_BOUNCER,   88, 22, 14,  9,  72,  60, 30, SK_STUN,       90, 3, 0, "You are not on the list." },
    { "Vulture Fan",    SPR_VULTURE,   66, 20,  8, 15,  64,  44, 40, SK_BLEED,     110, 3, 0, "Here for the highlights. Yours." },
    /*  Neighbourhood bosses. The floor is four to a square, they sit between
        levels seven and nine, and each is a caricature of the local mob
        crossed with something from the surface. Killing one shuts its
        neighbourhood down: nothing spawns there afterwards. */
    { "The Hoarder",    SPR_SLUDGE,     120, 15,  9,  4, 110,   0, 40, SK_HIT_ALL,    80, 1, 1, "It has kept everything. All of it." },
    { "The Juicer",     SPR_TROGLODYTE, 110, 18,  6,  7, 105,   0, 45, SK_BLEED,      95, 1, 1, "A troglodyte that found a use for people." },
    { "Goblin War Chief", SPR_GOBLIN,   130, 16, 11,  6, 120,   0, 35, SK_DEBUFF_DEF, 70, 1, 1, "Sponsored. Finally." },
    /*  Tiers two and three need their own, or foe_nboss falls back to the
        borough boss and every chamber on floor seven downward holds a Foreman.
        Each is still the local mob with something from the surface welded on,
        which is what the show does with them. */
    { "The Sapper Foreman", SPR_KOBOLD,   190, 24, 13,  9, 230,  90, 40, SK_HIT_ALL,   85, 2, 1, "It has requisitioned the whole quadrant." },
    { "The Kennelmaster", SPR_HOUND,      170, 27,  9, 16, 220,  80, 45, SK_BLEED,    100, 2, 1, "Whistles once. Everything with teeth comes." },
    { "The Bailiff Prime", SPR_BAILIFF,   200, 25, 15,  8, 240, 100, 35, SK_STUN,      85, 2, 1, "Serving papers on the entire floor." },
    { "The Doorman", SPR_BOUNCER,         290, 33, 18, 11, 420, 180, 40, SK_STUN,     100, 3, 1, "The list got shorter. You were on it." },
    { "The House Mimic", SPR_MIMIC,       260, 36, 14, 14, 400, 190, 45, SK_HIT_ONE,  160, 3, 1, "It was the room. It was always the room." },
    { "The Carrion Anchor", SPR_VULTURE,  240, 34, 12, 19, 390, 170, 50, SK_BLEED,    130, 3, 1, "Live from the top of the pile." },


    /* Borough bosses: the ones with a stairwell in the room. */
    { "Ball of Swine",  SPR_BOSS_RATKING, 220, 17,  9,  8, 260,   0, 40, SK_HIT_ALL,  95, 1, 2, "It only does one thing. It does it downhill." },
    /*  Promoted out of a neighbourhood in the second round of patch notes,
        which is the only reason it is standing on a stairwell. */
    { "The Street Preacher", SPR_BAILIFF, 240, 20, 13,  9, 270,   0, 45, SK_STUN,     90, 1, 2, "Has been expecting you. Personally." },
    /*  One borough boss a tier meant the same gate six floors running. */
    { "The Silk Road Toll", SPR_MIMIC,    420, 29, 17, 13, 560, 280, 45, SK_HIT_ONE,  170, 2, 2, "Everything that passes pays. You are passing." },
    { "The Foreman",    SPR_BOSS_FOREMAN, 380, 26, 16, 10, 520, 250, 45, SK_STUN,    100, 2, 2, "Management has come down to the floor." },
    { "The Producer",   SPR_BOSS_PRODUCER,560, 34, 20, 14, 900, 400, 50, SK_HIT_ALL, 120, 3, 2, "The show, wearing a person." },
    { "The Ratings Spike", SPR_VULTURE,   520, 38, 16, 21, 860, 380, 50, SK_BLEED,    150, 3, 2, "Numbers are up. That is your fault." },
};
const int foe_count = (int)(sizeof foe_defs / sizeof foe_defs[0]);

/* ---------------------------------------------------------- neighbourhood -- */

/*  Book One's first floor is not one maze. It is squares of neighbourhoods
 *  bordered by wide passageways, each neighbourhood with its own local mob,
 *  and that structure is what the generator now builds: rooms get tagged, the
 *  top bar says where you are, and what jumps you depends on it.
 *
 *  The named ones here are the book's, on the floors the book covers. Which
 *  creature stands in each is this game's own bestiary — nothing below claims
 *  to be what is actually in the Goblin Workshop.
 */
const ZoneDef zone_defs[] = {
    /* Floor one: squares of four, each with its own residents. */
    { "THE TUNNELS",          0,  1 },   /* Sewer Rat      */
    { "GOBLIN WORKSHOP",      1,  1 },   /* Goblin Trapper */
    { "ROT STICKER BLOCK",    2,  1 },   /* Rot Sticker    */
    { "THE TROG WARRENS",     3,  1 },   /* Troglodyte     */
    { "KOBOLD QUADRANT",      6,  1 },   /* Kobold Sapper  */
    { "KOBOLD FIGHTING PITS", 6,  2 },
    { "THE FURNISHED ROOMS",  4,  2 },   /* Screaming Sofa */
    { "THE WET FLOOR",        5,  2 },   /* Sludge Mound   */
    /* Floor two: boroughs, and something guarding every staircase. */
    { "THE BOROUGHS",         7,  3 },   /* Bramble Hound  */
    { "BAILIFF ROW",          9,  4 },   /* Bone Bailiff   */
    { "THE HATCHERY",         8,  5 },   /* Doom Beetle    */
    /* Past where Book One goes. */
    { "THE SILK ROAD",       10,  7 },   /* Neon Mimic     */
    { "THE DOOR POLICY",     11,  9 },   /* Club Bouncer   */
    { "THE CHEAP SEATS",     12, 11 },   /* Vulture Fan    */
};
const int zone_count = (int)(sizeof zone_defs / sizeof zone_defs[0]);

/* -------------------------------------------------------- the crawl itself -- */

/*  How many crawlers are left. Just under thirteen million walk in; the number
 *  on the safe room screens is the one everybody down there watches, because
 *  it only ever goes one way and it moves while you are looking at it.
 *
 *  Derived rather than simulated: floor and elapsed time give a curve that
 *  starts steep and flattens, which is the shape the real one has.
 */
int32_t crawlers_left(void) {
    int32_t n = 12800000;
    for (int f = 0; f < g.dun.index; f++)
        n = n / 3 + n / 12;                     /* each floor takes most of them */
    int32_t full = 60 * 60 * 14;
    int32_t gone = full - (g.dun.collapse > 0 ? g.dun.collapse : 0);
    if (gone < 0) gone = 0;
    if (gone > full) gone = full;
    /*  Within a floor, down by a bit over a third by the time it collapses. */
    return n - (int32_t)((int64_t)n * 38 * gone / (100 * full));
}

/* ------------------------------------------------------------ safe rooms -- */

/*  The one thing about the dungeon that everybody who has read the book
 *  remembers: the safe rooms are not shrines or checkpoints, they are ordinary
 *  buildings from Earth, lifted whole and set into the rock. A Waffle House
 *  with the lights still on, four hundred feet underground, on a floor that is
 *  going to stop existing. The joke only works if they are mundane, so none of
 *  these are impressive and one of them is a DMV.
 *
 *  Everything here is written for the game. The premise is Matt Dinniman's;
 *  the specific rooms are not from the books.
 */
const SafeRoomDef safe_room_defs[] = {
    { "PERUVIAN TACO BELL",   "The menu is in Spanish. The horchata is free and nobody can explain why it is here." },
    { "ALABAMA WAFFLE HOUSE", "Open. Always was, always will be. The grill is hot and there is nobody working it." },
    { "DMV WAITING ROOM",     "Now serving number 41. The board has been showing 41 since the world ended." },
    { "AIRPORT SMOKING BOX",  "A glass cube that smells like 1994, and somehow the most comforting place on the floor." },
    { "TURNPIKE REST STOP",   "Vending machines, a wall map of a state that is gone, and a bathroom that locks." },
    { "LAUNDROMAT",           "Fluorescent, humming, warm. One dryer is running. Do not ask whose clothes." },
    { "HOSPITAL CAFETERIA",   "Jello in four colours. Trays. The particular quiet of a room built for bad news." },
    { "BOWLING ALLEY BAR",    "Lane three is set up. The pins reset if you knock them down, which is worse." },
};
const int safe_room_count = (int)(sizeof safe_room_defs / sizeof safe_room_defs[0]);

/* -------------------------------------------------------------- crawlers -- */

/*  Four of them, drawn from what the show has on file. Two go down each
 *  season. The spread is deliberate: nothing here is strictly better than
 *  anything else, and the Bopca is a genuinely bad idea that sometimes works.
 */
const CrawlerDef crawler_defs[] = {
    { "Carl",     "Crawler",     SPR_CARL,
      { 9, 6, 9, 5, 4, 5 },
      "No shoes, no plan, no reverse gear. Hits hard and stays up." },
    { "Donut",    "Princess",    SPR_DONUT,
      { 4, 10, 5, 6, 12, 8 },
      "Fastest thing on the floor and knows it. Fragile, lucky, insufferable." },
    { "Mordecai", "Guide",       SPR_MORDECAI,
      { 6, 5, 7, 11, 7, 6 },
      "Has seen more seasons than you have had floors. Fights with the wit." },
    { "Bopca",    "Shopkeeper",  SPR_BOPCA,
      { 7, 8, 4, 4, 3, 12 },
      "Was not supposed to be a crawler. Enormously lucky about it." },
};
const int crawler_count = (int)(sizeof crawler_defs / sizeof crawler_defs[0]);

/* ---------------------------------------------------------- achievements -- */

/*  The first floor's achievement list, as the show actually hands them out.
 *  Rewards are the box tier each one pays: 0 bronze, 1 silver, 2 gold,
 *  3 legendary, 255 for the ones that pay nothing but a notification.
 *
 *  Two from the real list are deliberately absent. Both are jokes about
 *  atrocity that work on the page, where nobody has to do them, and neither
 *  survives being a thing a player is rewarded for pressing a button to do.
 *  The rest are here, including the ones that pay nothing, because a list of
 *  achievements where everything pays out is a list nobody reads.
 */
const AchDef ach_defs[] = {
    { "Crazy Cat Lady",   "Enter the dungeon with a cat.",         0,   0 },
    { "Early Adopter",    "Be one of the first 5,000 in.",         1,   0 },
    { "Empty Pockets",    "Enter with nothing at all.",            0,   0 },
    { "Why Aren't You Wearing Pants",
                          "Enter the dungeon in your boxers.",     2,   0 },
    { "Unarmed Combat",   "Enter without a weapon.",               0,   0 },
    { "Loner",            "Enter with no human company.",        255,   0 },
    { "Damage",           "Inflict damage on a mob.",            255,   0 },
    /*  The one that matters: until a crawler has killed something, they do
        not earn experience at all. */
    { "You've Killed a Mob",
                          "Kill your first mob.",                255,   0 },
    { "Bare Fucking Hands",
                          "Kill an armed mob unarmed.",            0,   0 },
    { "Podophilia",       "Kill something with your bare feet.",   2,   0 },
    { "Boom",             "Set off a blast the floor can feel.",   1,   0 },
    { "Level-Up, Baby",   "Gain a level.",                       255,   0 },
    { "Loot",             "Wear something you found down here.",  255,   0 },
    { "Boss Babe",        "Draw blood from a boss.",             255,   0 },
    { "Two Chicks at the Same Time",
                          "Kill two mobs with one blow.",          2,   0 },
    { "Neighbourhood Watch",
                          "Put a neighbourhood boss down.",        1,   0 },
    { "Stairwell",        "Take a borough boss off a stairwell.",  1, 120 },
    { "Cartographer",     "See two hundred tiles of one floor.",   0,  60 },
    { "Read The Room",    "Sit through every System briefing.",    0,  70 },
    /*  Chapter one: neither is earned in a dungeon, and neither pays out in a
        box -- a loot box scene opening in the middle of a cutscene takes the
        screen away from the thing the player was reading. */
    { "No Shoes",         "Go outside for the cat anyway.",      255,  40 },
    { "Outside At The Time", "Be in the road when it happened.",  255,   0 },
};
const int ach_count = (int)(sizeof ach_defs / sizeof ach_defs[0]);

const char *const speaker_names[] = { "THE SYSTEM", "CARL", "PRINCESS DONUT",
                                     "MORDECAI", "BOPCA", "THE SHOW", "" };

/*  Chapter one now opens the game, so the old floor-one briefing that used
 *  to do that job is gone: it said the same things worse and later. */
/* ---------------------------------------------------------------- script -- */


static const Line beat_f1_1[] = {
    { SP_SYSTEM, "Tutorial floor. The rules are short." },
    { SP_SYSTEM, "Walk with the pad. Turn with left and right. The bottom screen maps itself as you go." },
    { SP_SYSTEM, "Touch a wall on that map and nothing happens. Touch a button and something does." },
    { SP_CARL,   "And the timer at the top?" },
    { SP_SYSTEM, "That is how long this floor exists. Do try to be elsewhere." },
};

static const Line beat_f1_2[] = {
    { SP_DONUT,  "Carl." },
    { SP_CARL,   "...Donut?" },
    { SP_DONUT,  "I have been given words. I intend to use all of them." },
    { SP_DONUT,  "Also a title. I am a princess now. You may continue carrying things." },
    { SP_SYSTEM, "Party member registered: Princess Donut. Charisma is a combat stat here, and hers is obscene." },
};

static const Line beat_f1_3[] = {
    { SP_SYSTEM, "You are being watched by roughly four billion viewers." },
    { SP_SYSTEM, "They like you. Not respect. Like. It is worth actual money." },
    { SP_CARL,   "How much money?" },
    { SP_SYSTEM, "Enough that the things down here have started auditioning." },
};

static const Line beat_f1_4[] = {
    { SP_SYSTEM, "Reminder: when the countdown ends, this floor stops being a floor." },
    { SP_SYSTEM, "Crawlers still standing on it stop being crawlers." },
    { SP_DONUT,  "Then we should stop reading walls and start finding stairs." },
};

static const Line beat_shop[] = {
    { SP_BOPCA,  "Store's open. Don't touch the goods with those hands." },
    { SP_CARL,   "You sell bandages?" },
    { SP_BOPCA,  "I sell whatever the last crawler was carrying. He isn't using it." },
    { SP_SYSTEM, "Bopca vendors are protected. Attacking one is not a strategy, it is a highlight reel." },
};

static const Line beat_box[] = {
    { SP_SYSTEM, "Loot box awarded." },
    { SP_SYSTEM, "Bronze. Do not make that face. Bronze is what the audience gives people they are still deciding about." },
};

static const Line beat_f1_boss[] = {
    { SP_SYSTEM, "Floor one boss defeated." },
    { SP_SYSTEM, "The crown was not load-bearing. Neither were the rats." },
    { SP_CARL,   "It had a crown." },
    { SP_DONUT,  "It had my crown, briefly. That has been corrected." },
    { SP_SYSTEM, "Stairs unlocked. Take them before the ceiling takes an interest." },
};

static const Line beat_f2_enter[] = {
    { SP_MORDECAI, "There you are. I've been assigned to you." },
    { SP_CARL,     "Assigned." },
    { SP_MORDECAI, "Guide, manager, the man who explains why you're about to die. Mordecai." },
    { SP_MORDECAI, "Floor two is where the show starts caring. Pick a class before something eats you mid-explanation." },
    { SP_SYSTEM,   "Class assigned - Carl: Compensated Anarchist. Damage scales with how unfair the fight is." },
    { SP_SYSTEM,   "Class assigned - Princess Donut: Former Child Actor. Charisma now hurts people." },
};

static const Line beat_f2_1[] = {
    { SP_MORDECAI, "Sponsors are watching this floor. Get seen doing something stupid and brave." },
    { SP_DONUT,    "I do stupid and brave professionally." },
    { SP_MORDECAI, "You do photogenic. It's close enough." },
};

static const Line beat_f2_2[] = {
    { SP_SYSTEM,   "Sponsorship offer received: a mid-tier armour brand would like Carl to keep not wearing shoes." },
    { SP_CARL,     "That's the offer? Keep having no shoes?" },
    { SP_SYSTEM,   "It tests extremely well." },
};

static const Line beat_f2_boss[] = {
    { SP_SYSTEM,   "Floor two boss defeated. Site supervisor terminated." },
    { SP_MORDECAI, "That's a real kill. Not a mob, a name. They'll run it on the recaps." },
    { SP_CARL,     "Good. Where's the next one." },
    { SP_MORDECAI, "That's the wrong attitude and exactly the right attitude." },
};

static const Line beat_f3_enter[] = {
    { SP_SYSTEM,   "Floor three. Welcome to the Over City." },
    { SP_MORDECAI, "There's a club down here. Real drinks, real safety, real cameras." },
    { SP_MORDECAI, "Everything in it wants something from you. Some of it will settle for the rights to your name." },
    { SP_DONUT,    "Finally. A floor with a green room." },
};

static const Line beat_f3_1[] = {
    { SP_SYSTEM,   "You are, as of this floor, a recognisable face." },
    { SP_SYSTEM,   "Mobs are now dropping better loot when they lose to you on camera." },
    { SP_CARL,     "So the trick is to be entertaining while nearly dying." },
    { SP_SYSTEM,   "The trick was always that." },
};

static const Line beat_f3_boss[] = {
    { SP_SYSTEM,   "Production interrupted." },
    { SP_SYSTEM,   "That was not a monster. That was a department." },
    { SP_MORDECAI, "They'll send another. They always send another." },
    { SP_CARL,     "Then we keep going down." },
    { SP_DONUT,    "Obviously. My audience is on floor four." },
};

static const Line beat_end[] = {
    { SP_SYSTEM,   "End of Book One." },
    { SP_SYSTEM,   "Three floors cleared. Fifteen remain, and the show has your ratings on a wall somewhere." },
    { SP_SYSTEM,   "Carl: still barefoot. Princess Donut: still a princess. The audience: extremely invested." },
    { SP_SYSTEM,   "Thank you for crawling." },
};

const Beat story_beats[] = {
    { 1,  1, 1,                beat_f1_1,    (uint8_t)(sizeof beat_f1_1 / sizeof(Line)) },
    { 2,  1, 2,                beat_f1_2,    (uint8_t)(sizeof beat_f1_2 / sizeof(Line)) },
    { 3,  1, 3,                beat_f1_3,    (uint8_t)(sizeof beat_f1_3 / sizeof(Line)) },
    { 4,  1, 4,                beat_f1_4,    (uint8_t)(sizeof beat_f1_4 / sizeof(Line)) },
    { 5,  0, TRIG_SHOP,        beat_shop,    (uint8_t)(sizeof beat_shop / sizeof(Line)) },
    { 6,  0, TRIG_FIRST_BOX,   beat_box,     (uint8_t)(sizeof beat_box / sizeof(Line)) },
    { 7,  1, TRIG_BOSS_WIN,    beat_f1_boss, (uint8_t)(sizeof beat_f1_boss / sizeof(Line)) },
    { 8,  2, TRIG_FLOOR_ENTER, beat_f2_enter,(uint8_t)(sizeof beat_f2_enter / sizeof(Line)) },
    { 9,  2, 1,                beat_f2_1,    (uint8_t)(sizeof beat_f2_1 / sizeof(Line)) },
    { 10, 2, 2,                beat_f2_2,    (uint8_t)(sizeof beat_f2_2 / sizeof(Line)) },
    { 11, 2, TRIG_BOSS_WIN,    beat_f2_boss, (uint8_t)(sizeof beat_f2_boss / sizeof(Line)) },
    { 12, 3, TRIG_FLOOR_ENTER, beat_f3_enter,(uint8_t)(sizeof beat_f3_enter / sizeof(Line)) },
    { 13, 3, 1,                beat_f3_1,    (uint8_t)(sizeof beat_f3_1 / sizeof(Line)) },
    { 14, 3, TRIG_BOSS_WIN,    beat_f3_boss, (uint8_t)(sizeof beat_f3_boss / sizeof(Line)) },
    { 15, 0, TRIG_GAME_END,    beat_end,     (uint8_t)(sizeof beat_end / sizeof(Line)) },
};
const int beat_count = (int)(sizeof story_beats / sizeof story_beats[0]);

const Beat *beat_find(int floor, int trigger) {
    for (int i = 0; i < beat_count; i++) {
        const Beat *b = &story_beats[i];
        if (b->trigger != trigger) continue;
        if (b->floor && b->floor != floor) continue;
        return b;
    }
    return 0;
}

/* Which mob wanders which floor. */
/*  The bestiary is written in three tiers and the dungeon is eighteen floors
 *  deep, so depth picks the tier and then scales what it finds. A floor-14
 *  Bramble Hound is the same drawing and a different problem. */
static int tier_for(int floor_no) {
    int tier = (floor_no + 5) / 6;          /* 1-6 -> 1, 7-12 -> 2, 13-18 -> 3 */
    if (tier < 1) tier = 1;
    if (tier > 3) tier = 3;
    return tier;
}

int foe_pick(int floor_no) {
    int tier = tier_for(floor_no);
    /*  The pool used to be the current tier and nothing else, so it narrowed
        as the run went on: six kinds of thing on the early floors, three by
        the end. Backwards -- the deepest stretch is the longest one. Deeper
        floors keep everything shallower alive alongside their own, scaled up
        by foe_scale, so variety grows with depth instead of collapsing. */
    int candidates[24], n = 0;
    for (int i = 0; i < foe_count && n < 24; i++)
        if (!foe_defs[i].rank && foe_defs[i].floor <= tier) candidates[n++] = i;
    if (!n) return 0;

    /*  Weighted toward this tier's own residents: a floor eighteen corridor
        should still mostly hold floor eighteen things. */
    if (tier > 1 && rng_chance(65)) {
        int own[12], m = 0;
        for (int i = 0; i < foe_count && m < 12; i++)
            if (!foe_defs[i].rank && foe_defs[i].floor == tier) own[m++] = i;
        if (m) return own[rng_range(0, m - 1)];
    }
    return candidates[rng_range(0, n - 1)];
}

/*  The boss on the stairwell. Borough bosses are the rare ones, and every one
 *  of them has a stairwell in the room. */
int foe_boss(int floor_no) {
    int tier = tier_for(floor_no);
    int candidates[8], n = 0;
    for (int i = 0; i < foe_count && n < 8; i++)
        if (foe_defs[i].rank == 2 && foe_defs[i].floor == tier) candidates[n++] = i;
    if (n) return candidates[rng_range(0, n - 1)];
    return foe_count - 1;
}

/*  A neighbourhood's own boss: a caricature of whatever lives there, so where
 *  one exists for this depth it is preferred over a generic pick. */
int foe_nboss(int floor_no) {
    int tier = tier_for(floor_no);
    int candidates[8], n = 0;
    for (int i = 0; i < foe_count && n < 8; i++)
        if (foe_defs[i].rank == 1 && foe_defs[i].floor == tier) candidates[n++] = i;
    if (n) return candidates[rng_range(0, n - 1)];
    return foe_boss(floor_no);
}

/*  Percent to scale a foe by at this depth. Floor one is the printed
 *  statline; by broadcast it is a little under four times it. */
int foe_scale(int floor_no) {
    if (floor_no < 1) floor_no = 1;
    return 100 + (floor_no - 1) * 17;
}
