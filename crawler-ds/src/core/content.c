/*  Every table the game reads: gear, skills, the bestiary, achievements and the
 *  script.
 *
 *  This is a fan game. The characters and the premise belong to Matt Dinniman;
 *  none of the prose below is his. Every line here was written for this ROM.
 */
#include "game.h"

#include "art.h"

/* -------------------------------------------------------------- the shop -- */

/*  Order is load-bearing. item_sprite() maps an item id straight onto the
 *  sprite table as SPR_ITEM_SPLINT_POTION + (id - 1), so the icons in
 *  tools/art/items.py have to be declared in exactly this sequence. A test
 *  holds the two lengths together; nothing else would notice them drifting.
 *
 *  The `floor` column is the descent's gear curve. Three tiers sit on top of
 *  the two the game shipped with, at floors 5, 9 and 13, priced against what
 *  a run of that depth has actually banked.
 */
const ItemDef item_defs[] = {
    { "-",               IT_NONE,     0,    0, 0,  0, "" },
    { "Splint Potion",   IT_HEAL,    40,   30, 0,  1, "Tastes like pennies. Closes a wound anyway." },
    { "Cold Slice",      IT_HEAL,    95,   75, 0,  1, "Pizza the dungeon swears is fresh. Restores a lot." },
    { "Energy Drink",    IT_STAMINA, 30,   45, 0,  1, "Legally distinct from the one you know. +30 stamina." },
    { "Pipe Bomb",       IT_BOMB,    48,   60, 0,  1, "Thrown, not placed. Hurts everything in the room." },
    { "Second Wind",     IT_REVIVE,  50,  140, 0,  1, "Puts a downed crawler back on their feet." },
    { "Adrenaline Shot", IT_BUFF,     4,   50, 0,  1, "Three turns of hitting much harder." },
    { "Length of Rebar", IT_WEAPON,   5,  140, 0,  1, "Concrete still attached. That is the point." },
    { "Fire Axe Handle", IT_WEAPON,   9,  400, 0,  2, "No head. The handle was always the good part." },
    { "Duct-Tape Wrap",  IT_ARMOUR,   4,  130, 1,  1, "Wrapped over everything that bleeds." },
    { "Riot Vest",       IT_ARMOUR,   8,  430, 1,  2, "Looted off something that failed to riot." },
    { "Lucky Molar",     IT_TRINKET,  4,  260, 2,  2, "Not yours. Luckier than yours." },
    /*  Deeper floors were a city too, so the debris gets heavier rather than
        more magical. Nothing here is enchanted; it is all something large
        that used to be bolted down. */
    { "Bus Stop Halberd", IT_WEAPON, 15, 1100, 0,  5, "The pole, the sign, and most of the concrete." },
    { "Escalator Tooth", IT_WEAPON,  22, 2600, 0,  9, "One step's worth of comb plate. Still moving." },
    { "Girder Maul",     IT_WEAPON,  31, 5200, 0, 13, "Two crawlers to lift. One to swing. Same one." },
    { "Manhole Pauldron", IT_ARMOUR, 14, 1000, 1,  5, "Cast iron, city seal, worn on the strong side." },
    { "Turnstile Cuirass", IT_ARMOUR,20, 2400, 1,  9, "Still counts everything that hits you." },
    { "Bank Door Plate", IT_ARMOUR,  28, 4800, 1, 13, "Rated for a siege. Repurposed for a stairwell." },
    { "Payphone Slug",   IT_TRINKET,  8, 1200, 2,  6, "Bought one call. Buys better odds now." },
    { "Ratings Chip",    IT_TRINKET, 13, 3400, 2, 12, "The show tracks you closer. That helps, mostly." },
};
const int item_count = (int)(sizeof item_defs / sizeof item_defs[0]);

/*  What Bopca has out on the counter, for a party this far down.
 *
 *  One function, because this rule used to be written twice -- once in
 *  update_shop to decide what buying does and once in draw_shop to decide
 *  what to draw. Two copies of a filter that a cursor indexes into is a bug
 *  waiting for the day they stop agreeing, and the day would have been this
 *  one.
 *
 *  The old rule was "everything priced under 500", which is why the shop
 *  looked the same on floor eighteen as on floor one. Stock is what the floor
 *  has unlocked; the price cap is gone, because affording it is the player's
 *  problem and having something to save for is the point.
 */
int shop_stock(int floor_no, int *out, int max) {
    int n = 0;
    for (int i = 1; i < item_count && n < max; i++)
        if (item_defs[i].price > 0 && item_defs[i].floor <= floor_no) out[n++] = i;
    return n;
}

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
    /*  name  sprite  hp atk def spd  xp gold trick kind pow floor rank bulk quip
        ...and, for anything with a way to be broken, the answer its opening
        wants and what that opening looks like. Mobs stop at the quip. */
    { "Sewer Rat",      SPR_RAT,       22,  6,  2,  7,  12,   8, 10, SK_BLEED,      60, 1, 0, 55, "It has been eating better than you.", WEAK_NONE, 0 },
    { "Goblin Trapper", SPR_GOBLIN,    30,  8,  4,  6,  18,  14, 20, SK_DEBUFF_DEF, 30, 1, 0, 85, "Sponsored by nobody. Trying very hard.", WEAK_NONE, 0 },
    /*  A Rot Sticker is a delivery mechanism, not a fighter: almost no health,
        almost no defence, and it hits the whole party when it goes. Killing it
        fast is the entire counterplay, which is why it is also slow. */
    { "Rot Sticker",    SPR_ROTSTICKER, 14, 11,  1,  2,  16,   6, 55, SK_HIT_ALL,   130, 1, 0, 45, "Do not let it get comfortable.", WEAK_NONE, 0 },
    { "Troglodyte",     SPR_TROGLODYTE, 34,  9,  5,  5,  20,  10, 20, SK_STUN,       60, 1, 0, 105, "No eyes. Did not need them to find you.", WEAK_NONE, 0 },
    { "Screaming Sofa", SPR_SOFA,      44,  7,  8,  3,  22,  20, 15, SK_STUN,       70, 1, 0, 125, "Floor one keeps sending furniture.", WEAK_NONE, 0 },
    { "Sludge Mound",   SPR_SLUDGE,    36,  7,  5,  4,  20,  12, 25, SK_HIT_ALL,    70, 1, 0, 100, "Wet. Patient. Faintly sweet.", WEAK_NONE, 0 },
    { "Kobold Sapper",  SPR_KOBOLD,    46, 12,  6,  9,  34,  26, 30, SK_HIT_ALL,    85, 2, 0, 80, "Carrying something with a fuse.", WEAK_NONE, 0 },
    { "Bramble Hound",  SPR_HOUND,     54, 14,  7, 12,  40,  22, 25, SK_BLEED,      90, 2, 0, 90, "It was a dog. The floor improved it.", WEAK_NONE, 0 },
    { "Doom Beetle",    SPR_BEETLE,    62, 13, 12,  6,  44,  30, 20, SK_DEBUFF_DEF, 45, 2, 0, 85, "Armoured, unbothered, extremely purple.", WEAK_NONE, 0 },
    { "Bone Bailiff",   SPR_BAILIFF,   58, 16,  9,  8,  48,  38, 35, SK_STUN,       80, 2, 0, 110, "It has a warrant. It will not show you.", WEAK_NONE, 0 },
    { "Neon Mimic",     SPR_MIMIC,     72, 19, 10, 11,  62,  55, 35, SK_HIT_ONE,   150, 3, 0, 115, "A loot box with opinions.", WEAK_NONE, 0 },
    { "Club Bouncer",   SPR_BOUNCER,   88, 22, 14,  9,  72,  60, 30, SK_STUN,       90, 3, 0, 140, "You are not on the list.", WEAK_NONE, 0 },
    { "Vulture Fan",    SPR_VULTURE,   66, 20,  8, 15,  64,  44, 40, SK_BLEED,     110, 3, 0, 100, "Here for the highlights. Yours.", WEAK_NONE, 0 },
    { "Bad Llama",      SPR_LLAMA,        36, 10,  4,  8,  20,  16, 30, SK_HIT_ONE,    75, 1, 0, 115, "Do not let the wool fool you.", WEAK_NONE, 0 },
    /*  Not a resident. Ninety-three levels of consequence, released by the
        floor when its own posted rules get ignored often enough. It is not
        meant to be killed. */
    { "Rage Elemental", SPR_BOSS_RAGE,  9000, 90, 40, 18,   0,   0, 60, SK_HIT_ALL,   200, 1, 0, 230, "You were told where to open those.", WEAK_NONE, 0 },
    { "Brindle Grub",   SPR_GRUB,         16,  5,  2,  3,   8,   4,  0, SK_HIT_ONE,    50, 1, 0,  15, "Nature's cleanup crew, and there are thousands.", WEAK_NONE, 0 },
    { "Mind Horror",    SPR_MINDHORROR,   30,  9,  3,  6,  26,  20, 45, SK_STUN,       80, 1, 0,  45, "All brain, no spine. Literally.", WEAK_NONE, 0 },
    /*  The block: street furniture that the dungeon gave teeth to.
        Deliberately NOT on the first tier. Book one's floors are tunnels,
        mazes and mob neighbourhoods -- lichen and corridors. The reskinned
        city with its shopfronts and street fittings is the Over City, which
        is deeper, so a parking meter on floor one would be a whole setting
        arriving two books early. They start where the streets do. */
    { "Snack Machine",  SPR_SNACKMACHINE, 40,  9,  7,  4,  21,  18, 20, SK_DEBUFF_DEF, 40, 2, 0, 130, "It ate your change. Now it is hungry.", WEAK_NONE, 0 },
    { "Wheelie Bin",    SPR_WHEELIEBIN,   38,  8,  6,  5,  19,  15, 25, SK_HIT_ALL,    60, 2, 0, 110, "Bins on this floor have opinions about you.", WEAK_NONE, 0 },
    { "Rusted Boiler",  SPR_BOILER,       58, 13, 10,  4,  42,  28, 30, SK_HIT_ALL,    80, 2, 0, 120, "The gauge is in the red. It has been for years.", WEAK_NONE, 0 },
    { "Parking Meter",  SPR_METER,        44, 15,  5, 13,  38,  24, 35, SK_STUN,       70, 3, 0,  95, "Your time expired before you arrived.", WEAK_NONE, 0 },
    { "Payphone",       SPR_PAYPHONE,     70, 18,  9, 10,  60,  46, 40, SK_STUN,       85, 3, 0, 115, "It is ringing. It is for you.", WEAK_NONE, 0 },
    /*  Neighbourhood bosses, from the books: each floor's are the ones book
        one (and, for the third, book two) actually puts in front of Carl and
        Donut. Killing one shuts its neighbourhood down: nothing spawns there
        afterwards. Tier one is book one's first floor, tier two its second,
        tier three the circus on the third. */
    { "The Hoarder",    SPR_BOSS_HOARDER,     120, 15,  9,  4, 110,   0, 40, SK_HIT_ALL,    80, 1, 1, 250, "She has kept everything. All of it.",
      WEAK_HIT, "A Scatterer is halfway out of her mouth." },
    { "The Juicer",     SPR_BOSS_JUICER, 110, 18,  6,  7, 105,   0, 45, SK_BLEED,      95, 1, 1, 150, "Pushing iron. Snapping necks.",
      WEAK_MOVE, "The veins in his arms stand right out." },
    /*  Carl never fought him so much as delivered a cart of explosives to
        him, and that is the opening: something out of the bag, thrown while
        his back is to it. */
    { "Goblin War Chieftain", SPR_BOSS_WARCHIEF, 130, 16, 11,  6, 120,   0, 35, SK_DEBUFF_DEF, 70, 1, 1, 170, "Towering, for a goblin, and he knows it.",
      WEAK_ITEM, "His back is to the explosives cart." },
    /*  The second floor's. The clones do not move from where they grew, so
        the shriek is the thing to brace for. */
    { "Krakaren Clone", SPR_BOSS_KRAKAREN,     190, 24, 13,  9, 230,  90, 40, SK_HIT_ALL,   85, 2, 1, 245, "Every mouth on it is shrieking at you.",
      WEAK_GUARD, "Every mouth on it draws breath at once." },
    { "Ralph",          SPR_BOSS_RALPH,        170, 27,  9, 16, 220,  80, 45, SK_BLEED,    100, 2, 1,  25, "A gerbil. Frenzied. Mostly jaw.",
      WEAK_MOVE, "It crouches, frothing, to spring." },
    /*  The third floor's, out of Grimaldi's circus. */
    { "Heather the Bear", SPR_BOSS_HEATHER,    290, 33, 18, 11, 420, 180, 40, SK_STUN,     100, 3, 1, 200, "Old, on skates, and not alone in there.",
      WEAK_MOVE, "She winds up to charge on her skates." },
    { "Clammy the Clown", SPR_BOSS_CLAMMY,     260, 36, 14, 14, 400, 190, 45, SK_HIT_ONE,  160, 3, 1, 150, "The greasepaint is the clean part.",
      WEAK_GUARD, "He reaches for you, nails first." },

    /*  Stairwell bosses. The first floor's is a borough boss. Book one
        names none for its second floor, so foe_boss puts one of that floor's
        own neighbourhood bosses on the stairs rather than inventing one. The
        third floor's is the circus's master, who is a city boss -- rank 3,
        the rank above a borough's. Grimaldi stays last: foe_boss falls back
        to the last row. */
    { "Ball of Swine",  SPR_BOSS_SWINE,   220, 17,  9,  8, 260,   0, 40, SK_HIT_ALL,  95, 1, 2, 255, "It only does one thing. It does it downhill.",
      WEAK_GUARD, "It is picking up speed down the slope." },
    { "Grimaldi",       SPR_BOSS_GRIMALDI, 560, 34, 20, 14, 900, 400, 50, SK_HIT_ALL, 120, 3, 3, 255, "The ringmaster. The rest of him is roots.",
      WEAK_HIT, "The vines part over something pulsing." },
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

/*  Safe rooms: nothing hostile can come in, and they are the only places a
 *  loot box can be opened. The staffed ones are run by a Bopca Protector and
 *  have a kitchen, beds, a bathroom and three screens showing the show.
 *
 *  The first is from the book: Sebastian's Peruvian Taco Bell, on the first
 *  floor near the Juicer's neighbourhood. The rest are this game's own, built
 *  the same way -- somewhere ordinary from the surface, with a Bopca behind
 *  the counter.
 */
const SafeRoomDef safe_room_defs[] = {
    { "PERUVIAN TACO BELL",   "Sebastian, a Bopca Protector, runs the kitchen. Coffee, Peruvian beer, beds and a bathroom." },
    { "ALABAMA WAFFLE HOUSE", "The grill is hot and a Bopca is working it, grumbling about the price of eggs." },
    { "DMV WAITING ROOM",     "Now serving number 41. The Bopca at the counter has been saying so since the world ended." },
    { "AIRPORT SMOKING BOX",  "A glass cube that smells like 1994. The Bopca sells cigarettes and does not give discounts." },
    { "TURNPIKE REST STOP",   "Vending machines, a map of a state that is gone, a Bopca at the till and a bathroom that locks." },
    { "LAUNDROMAT",           "Fluorescent, humming, warm. The Bopca folding towels will sell you a clean one." },
    { "HOSPITAL CAFETERIA",   "Jello in four colours, served by a Bopca. The particular quiet of a room built for bad news." },
    { "BOWLING ALLEY BAR",    "Lane three is set up. The Bopca behind the bar pours, and watches the screens with you." },
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

/*  The first floor's achievement list, as Carl earns it in book one. Rewards
 *  are the box tier each one pays: 0 bronze, 1 silver, 2 gold, 3 legendary,
 *  255 for the ones that pay nothing but a notification. The book's names are
 *  whole sentences ("You've killed an armed mob with your bare fucking
 *  hands!"); where one will not fit a toast it is cut down to the words
 *  people remember, and the rest of it is the description.
 *
 *  Absent on purpose: "You Monster" and "War Criminal", both jokes about
 *  atrocity that work on the page, where nobody has to do them, and neither
 *  survives being a thing a player is rewarded for pressing a button to do;
 *  and "Oooh Magic" and "Fall into an Obvious Trap", because this game has no
 *  magic and no traps to earn them with.
 */
const AchDef ach_defs[] = {
    { "Crazy Cat Lady",   "Enter the dungeon with a cat.",         0,   0 },
    /*  The first crawler anywhere to walk in with a cat. It pays the
        Legendary Pet Box, and what is in that box is the Enhanced Pet
        Biscuit: it is opened in the guild hall, in the story, not here. */
    { "Trailblazing Crazy Cat Lady",
                          "The first crawler in with a cat.",    255,   0 },
    { "Early Adopter",    "Be one of the first 5,000 in.",         1,   0 },
    { "Empty Pockets",    "Enter with nothing at all.",            0,   0 },
    { "Why Aren't You Wearing Pants?",
                          "Enter the dungeon in your boxers.",     2,   0 },
    { "Unarmed Combat",   "Enter without a weapon.",               0,   0 },
    { "Loner",            "Enter with no human companions.",     255,   0 },
    { "Read a Dungeon Sign",
                          "Discover and read an official sign.", 255,   0 },
    { "Inflicted Damage", "Inflict damage on a mob.",            255,   0 },
    /*  The one that matters: until a crawler has killed something, they do
        not earn experience at all. */
    { "You've Killed a Mob",
                          "Kill your first mob.",                255,   0 },
    { "Bare Fucking Hands",
                          "Kill an armed mob, unarmed.",          0,   0 },
    { "Killed a Higher Level Mob",
                          "Kill a mob a higher level than you.",   0,   0 },
    { "You've Entered a Guildhall",
                          "Find a tutorial guild and go in.",    255,   0 },
    { "Podophilia",       "Crush and kill a mob with bare feet.",  2,   0 },
    { "Boom",             "Set off a blast the floor can feel.",   1,   0 },
    { "Level-Up, Baby!",  "Gain a level.",                       255,   0 },
    { "Loot",             "Wear something you found down here.", 255,   0 },
    { "Boss Babe",        "Draw blood from a boss.",             255,   0 },
};
const int ach_count = (int)(sizeof ach_defs / sizeof ach_defs[0]);

const char *const speaker_names[] = { "THE SYSTEM", "CARL", "PRINCESS DONUT",
                                     "MORDECAI", "BOPCA", "THE SHOW", "" };

/*  Chapter one now opens the game, so the old floor-one briefing that used
 *  to do that job is gone: it said the same things worse and later. */
/* ---------------------------------------------------------------- script -- */


/*  Floor one, in the order the book takes it: a sign, the guild hall it
 *  points to, and Mordecai in it -- a Rat Hooligan on this floor, because a
 *  Changeling gets a new body every floor and does not get to choose it. The
 *  boxes are opened there, because a safe room is the only place they open,
 *  and one of them is the Legendary Pet Box with the biscuit in it. */
static const Line beat_f1_1[] = {
    { SP_NARRATOR, "An official dungeon sign, lit up on the wall: TUTORIAL GUILD, and an arrow." },
    { SP_CARL,     "Finally. Directions." },
    { SP_SYSTEM,   "Official dungeon signage will be easier to spot from now on." },
};

static const Line beat_f1_2[] = {
    { SP_NARRATOR, "A heavy door with a guild crest on it. It will not open while anything hostile is near." },
    { SP_MORDECAI, "Is it gone? It's gone. Get in here." },
    { SP_NARRATOR, "A rat of a man, a head shorter than Carl: grey fur, a beard, a black vest, blue trousers, sandals." },
    { SP_MORDECAI, "Mordecai. Your game guide. I was a crawler myself, once. Got to floor eleven." },
    { SP_MORDECAI, "I'm a Changeling now. New floor, new body, and I don't get a say. This floor I'm a Rat Hooligan." },
    { SP_MORDECAI, "This is a guild hall, and it's a safe room. Loot boxes only open in a safe room. Open yours." },
    { SP_SYSTEM,   "Trailblazing Crazy Cat Lady: a Legendary Pet Box. Inside it, an Enhanced Pet Biscuit." },
    { SP_NARRATOR, "Donut takes it out of Carl's hand, eats it, and melts into a heap of furry goo." },
    { SP_NARRATOR, "The goo pulls itself back together into a cat. She looks exactly the same, and not at all." },
    { SP_DONUT,    "Carl. We need to talk about those shoes." },
    { SP_SYSTEM,   "Princess Donut is now a crawler. Her stats are the highest in the party: she is the party leader." },
    { SP_DONUT,    "Then we are the Royal Court of Princess Donut. Carl, you were my manservant. You are my Royal Bodyguard." },
};

static const Line beat_f1_3[] = {
    { SP_SYSTEM, "Your view count is climbing. Viewers become followers, and followers become patrons." },
    { SP_SYSTEM, "Patrons and benefactors can send boxes, further down. Be worth watching." },
    { SP_DONUT,  "Carl, did you hear? They adore me." },
    { SP_CARL,   "I heard." },
};

static const Line beat_f1_4[] = {
    { SP_SYSTEM, "Reminder: when the timer runs out, this floor collapses, with every crawler still on it." },
    { SP_DONUT,  "Then my Royal Bodyguard should stop reading walls and find the stairs." },
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

/*  The first floor's stairwell is the Ball of Swine's room, and the book's
 *  Carl did not take it on his own: the four carers from the Meadow Lark care
 *  home helped him trap the thing. */
static const Line beat_f1_boss[] = {
    { SP_SYSTEM,   "Borough boss defeated: the Ball of Swine." },
    { SP_NARRATOR, "It took Carl, Donut and the four carers from the Meadow Lark care home to trap it." },
    { SP_SYSTEM,   "The stairwell is open. Take it before the floor collapses." },
    { SP_DONUT,    "Well done, bodyguard. Adequately done." },
};

/*  Floor two. Mordecai has a new body, as he does every floor. Classes are
 *  still a floor away: race and class are chosen on the third floor. */
static const Line beat_f2_enter[] = {
    { SP_MORDECAI, "Don't stare. Floor two, new body. I'm a Bugaboo now. Long arms, big eyes, and it itches." },
    { SP_CARL,     "You look like an owl had a bear." },
    { SP_MORDECAI, "Charming. Mobs drop gold from here on. Neighbourhood bosses drop maps. Get both." },
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
    { SP_SYSTEM,   "Floor two stairwell cleared." },
    { SP_MORDECAI, "That's a real kill. Not a mob, a name. They'll run it on the recaps." },
    { SP_CARL,     "Good. Where's the next one." },
    { SP_MORDECAI, "That's the wrong attitude and exactly the right attitude." },
};

static const Line beat_f3_enter[] = {
    { SP_SYSTEM,   "Floor three. Welcome to the Over City." },
    { SP_SYSTEM,   "Race and class selection is open. Carl: Primal, Compensated Anarchist. Traps, bombs and a following." },
    { SP_SYSTEM,   "Princess Donut: Former Child Actor." },
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
    { SP_SYSTEM,   "City boss defeated: Grimaldi." },
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
    { 1,  1, 1,                beat_f1_1,    (uint8_t)(sizeof beat_f1_1 / sizeof(Line)), ACH_SIGN + 1 },
    { 2,  1, 2,                beat_f1_2,    (uint8_t)(sizeof beat_f1_2 / sizeof(Line)), ACH_GUILDHALL + 1 },
    { 3,  1, 3,                beat_f1_3,    (uint8_t)(sizeof beat_f1_3 / sizeof(Line)), 0 },
    { 4,  1, 4,                beat_f1_4,    (uint8_t)(sizeof beat_f1_4 / sizeof(Line)), 0 },
    { 5,  0, TRIG_SHOP,        beat_shop,    (uint8_t)(sizeof beat_shop / sizeof(Line)), 0 },
    { 6,  0, TRIG_FIRST_BOX,   beat_box,     (uint8_t)(sizeof beat_box / sizeof(Line)), 0 },
    { 7,  1, TRIG_BOSS_WIN,    beat_f1_boss, (uint8_t)(sizeof beat_f1_boss / sizeof(Line)), 0 },
    { 8,  2, TRIG_FLOOR_ENTER, beat_f2_enter,(uint8_t)(sizeof beat_f2_enter / sizeof(Line)), 0 },
    { 9,  2, 1,                beat_f2_1,    (uint8_t)(sizeof beat_f2_1 / sizeof(Line)), 0 },
    { 10, 2, 2,                beat_f2_2,    (uint8_t)(sizeof beat_f2_2 / sizeof(Line)), 0 },
    { 11, 2, TRIG_BOSS_WIN,    beat_f2_boss, (uint8_t)(sizeof beat_f2_boss / sizeof(Line)), 0 },
    { 12, 3, TRIG_FLOOR_ENTER, beat_f3_enter,(uint8_t)(sizeof beat_f3_enter / sizeof(Line)), 0 },
    { 13, 3, 1,                beat_f3_1,    (uint8_t)(sizeof beat_f3_1 / sizeof(Line)), 0 },
    { 14, 3, TRIG_BOSS_WIN,    beat_f3_boss, (uint8_t)(sizeof beat_f3_boss / sizeof(Line)), 0 },
    { 15, 0, TRIG_GAME_END,    beat_end,     (uint8_t)(sizeof beat_end / sizeof(Line)), 0 },
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

/*  Looked up by name once rather than hard-coded, so inserting a row above it
 *  cannot silently turn the grub swarm into a swarm of something else. */
int foe_grub(void) {
    static int cached = -1;
    if (cached < 0) {
        cached = 0;
        for (int i = 0; i < foe_count; i++)
            if (foe_defs[i].sprite == SPR_GRUB) { cached = i; break; }
    }
    return cached;
}

int foe_rage(void) {
    static int cached = -1;
    if (cached < 0) {
        cached = 0;
        for (int i = 0; i < foe_count; i++)
            if (foe_defs[i].sprite == SPR_BOSS_RAGE) { cached = i; break; }
    }
    return cached;
}

int foe_pick(int floor_no) {
    int tier = tier_for(floor_no);
    /*  The pool used to be the current tier and nothing else, so it narrowed
        as the run went on: six kinds of thing on the early floors, three by
        the end. Backwards -- the deepest stretch is the longest one. Deeper
        floors keep everything shallower alive alongside their own, scaled up
        by foe_scale, so variety grows with depth instead of collapsing. */
    /*  The Rage Elemental is rank 0 and lives on tier 1, which made it a
        perfectly ordinary candidate here -- ninety-three levels of it, in a
        random corridor, on floor one. It is released by the floor's own rules
        and by nothing else, so it is excluded by name. */
    int candidates[24], n = 0;
    for (int i = 0; i < foe_count && n < 24; i++)
        if (!foe_defs[i].rank && foe_defs[i].floor <= tier && i != foe_rage())
            candidates[n++] = i;
    if (!n) return 0;

    /*  Weighted toward this tier's own residents: a floor eighteen corridor
        should still mostly hold floor eighteen things. */
    if (tier > 1 && rng_chance(65)) {
        int own[12], m = 0;
        for (int i = 0; i < foe_count && m < 12; i++)
            if (!foe_defs[i].rank && foe_defs[i].floor == tier && i != foe_rage())
                own[m++] = i;
        if (m) return own[rng_range(0, m - 1)];
    }
    return candidates[rng_range(0, n - 1)];
}

/*  The boss on the stairwell. Borough bosses are the rare ones, and every one
 *  of them has a stairwell in the room; so does a city boss. Where the books
 *  name none for a floor, one of the floor's own neighbourhood bosses holds
 *  the stairs instead (battle_start stands it up with more health). */
int foe_boss(int floor_no) {
    int tier = tier_for(floor_no);
    int candidates[8], n = 0;
    for (int i = 0; i < foe_count && n < 8; i++)
        if (foe_defs[i].rank >= 2 && foe_defs[i].floor == tier) candidates[n++] = i;
    if (!n)
        for (int i = 0; i < foe_count && n < 8; i++)
            if (foe_defs[i].rank == 1 && foe_defs[i].floor == tier) candidates[n++] = i;
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

/*  Percent to scale a foe by at this depth. Rewards grow with absolute depth:
 *  a floor eighteen kill is worth more than a floor one kill whatever it is. */
int foe_scale(int floor_no) {
    if (floor_no < 1) floor_no = 1;
    return 100 + (floor_no - 1) * 17;
}

/*  Percent to scale a foe's own statline by. Not the same thing: a tier's mobs
 *  are already stronger on paper than the tier above them, so scaling them by
 *  absolute depth stacked one increase on the other and put a cliff at every
 *  tier boundary. Thirty runs died between floors two and nine and seventeen
 *  of them died on floor seven, which is exactly where tier two starts.
 *
 *  So a mob scales from the first floor it can appear on. A kobold arrives on
 *  floor seven at its printed statline and is half again as strong by twelve,
 *  the same shape a rat has over floors one to six.
 */
int foe_stat_scale(int floor_no, int def) {
    static const int tier_start[4] = { 1, 1, 7, 13 };
    if (floor_no < 1) floor_no = 1;
    if (def < 0 || def >= foe_count) return 100;
    int tier = foe_defs[def].floor;
    if (tier < 0 || tier > 3) tier = 1;
    int from = floor_no - tier_start[tier];
    if (from < 0) from = 0;
    return 100 + from * 17;
}
