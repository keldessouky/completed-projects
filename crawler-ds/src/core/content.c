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
};
const int skill_count = (int)(sizeof skill_defs / sizeof skill_defs[0]);

/* ------------------------------------------------------------- bestiary --- */

const FoeDef foe_defs[] = {
    /* name             sprite         hp atk def spd   xp gold trick kind         pow fl quip */
    { "Sewer Rat",      SPR_RAT,       22,  6,  2,  7,  12,   8, 10, SK_BLEED,      60, 1, "It has been eating better than you." },
    { "Goblin Trapper", SPR_GOBLIN,    30,  8,  4,  6,  18,  14, 20, SK_DEBUFF_DEF, 30, 1, "Sponsored by nobody. Trying very hard." },
    { "Screaming Sofa", SPR_SOFA,      44,  7,  8,  3,  22,  20, 15, SK_STUN,       70, 1, "Floor one keeps sending furniture." },
    { "Sludge Mound",   SPR_SLUDGE,    36,  7,  5,  4,  20,  12, 25, SK_HIT_ALL,    70, 1, "Wet. Patient. Faintly sweet." },
    { "Kobold Sapper",  SPR_KOBOLD,    46, 12,  6,  9,  34,  26, 30, SK_HIT_ALL,    85, 2, "Carrying something with a fuse." },
    { "Bramble Hound",  SPR_HOUND,     54, 14,  7, 12,  40,  22, 25, SK_BLEED,      90, 2, "It was a dog. The floor improved it." },
    { "Doom Beetle",    SPR_BEETLE,    62, 13, 12,  6,  44,  30, 20, SK_DEBUFF_DEF, 45, 2, "Armoured, unbothered, extremely purple." },
    { "Bone Bailiff",   SPR_BAILIFF,   58, 16,  9,  8,  48,  38, 35, SK_STUN,       80, 2, "It has a warrant. It will not show you." },
    { "Neon Mimic",     SPR_MIMIC,     72, 19, 10, 11,  62,  55, 35, SK_HIT_ONE,   150, 3, "A loot box with opinions." },
    { "Club Bouncer",   SPR_BOUNCER,   88, 22, 14,  9,  72,  60, 30, SK_STUN,       90, 3, "You are not on the list." },
    { "Vulture Fan",    SPR_VULTURE,   66, 20,  8, 15,  64,  44, 40, SK_BLEED,     110, 3, "Here for the highlights. Yours." },
    /* Bosses */
    { "The Rat King",   SPR_BOSS_RATKING, 220, 17,  9,  8, 260, 130, 40, SK_HIT_ALL,  95, 1, "Six heads. One deeply stupid crown." },
    { "The Foreman",    SPR_BOSS_FOREMAN, 380, 26, 16, 10, 520, 250, 45, SK_STUN,    100, 2, "Management has come down to the floor." },
    { "The Producer",   SPR_BOSS_PRODUCER,560, 34, 20, 14, 900, 400, 50, SK_HIT_ALL, 120, 3, "The show, wearing a person." },
};
const int foe_count = (int)(sizeof foe_defs / sizeof foe_defs[0]);

/* ---------------------------------------------------------- achievements -- */

const AchDef ach_defs[] = {
    { "First Blood",      "Win a fight.",                        0,  20 },
    { "Box Opener",       "Open a loot box.",                    0,  0 },
    { "Barefoot Doctrine","Reach level 5.",                      1,  30 },
    { "Pest Control",     "Win ten fights.",                     1,  80 },
    { "Cartographer",     "See two hundred tiles of one floor.", 1,  60 },
    { "Solvent",          "Hold five hundred gold at once.",     0, 0 },
    { "Untouchable",      "Win a fight without taking a hit.",   2, 150 },
    { "Rat Deposed",      "Put the Rat King down.",              2, 120 },
    { "Site Closed",      "Fire the Foreman.",                   2, 200 },
    { "Cancelled",        "Finish the Producer.",                3, 400 },
    { "Deep Pockets",     "Carry four kinds of gear at once.",   1, 60 },
    { "Read The Room",    "Sit through every System briefing.",  1,  70 },
    /*  Chapter one: neither of these is earned in a dungeon, and neither pays
        out in a box — a loot box scene opening in the middle of a cutscene
        takes the screen away from the thing the player was reading. */
    { "No Shoes",         "Go outside for the cat anyway.",    255,  40 },
    { "Outside At The Time", "Be in the road when it happened.", 255,  0 },
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
int foe_pick(int floor_index) {
    int candidates[8], n = 0;
    for (int i = 0; i < foe_count && n < 8; i++)
        if (foe_defs[i].floor == floor_index && foe_defs[i].hp < 150) candidates[n++] = i;
    if (!n) return 0;
    return candidates[rng_range(0, n - 1)];
}

int foe_boss(int floor_index) {
    for (int i = 0; i < foe_count; i++)
        if (foe_defs[i].floor == floor_index && foe_defs[i].hp >= 150) return i;
    return foe_count - 1;
}
