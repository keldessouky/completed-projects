/*  Book One, Chapter One.
 *
 *  The book opens above ground and stays there for a while, which is the part
 *  a dungeon crawler usually skips: no floors, no loot, no fighting, just a man
 *  outside at 2:23 in the morning in his underwear and his ex-girlfriend's
 *  Crocs because her cat got out. All of it matters, because the reason he
 *  lives through the next ninety seconds is that he was not under a roof.
 *
 *  The prose here is written for this game. It follows the events of the
 *  chapter; it does not reproduce the book's text, and none of these lines are
 *  quotations.
 */
#include "game.h"

static const CutLine ch1[] = {
{ SP_NARRATOR, BD_STREET, CUT_NONE, 0,
  "January the third, 2:23 in the morning, Seattle. You cannot sleep, so you "
  "are out on the balcony with a cigarette.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "Bea spent Christmas in the Bahamas. With Brad, her ex, which you found out "
  "from Instagram. You ended it over the phone. She left you her cat.", {0}, {0} },
{ SP_NARRATOR, BD_STREET_CAT, CUT_NONE, 0,
  "The cat has followed you out, and gone straight through the window and "
  "into the tree. Princess Donut: Persian, grand champion, ribbons, sitting "
  "on a branch in the freezing dark as if she owns it.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "You go down after her in what you have on: the brown leather jacket, the "
  "boxers with the hearts on them, and Bea's pink Crocs, a size too small.",
  {0}, {0} },

{ SP_CARL, BD_KEEP, CUT_CHOICE, 0,
  "Okay. Cat. How do we do this.",
  { "Talk her down", "Reach for her", "Wait her out" },
  { "You say her name like she is a person. Her ears turn. It is not "
    "agreement, but it is attention.",
    "You stretch up into the branches. She is a Persian, not a saint, and "
    "your wrist learns the difference.",
    "You stand in the cold and outlast her, which takes a whole cigarette and "
    "all the feeling in your toes." }, },

{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "She drops into your arms at last. Eight pounds of cat and about four of "
  "hair.", {0}, {0} },

/* ---- and then everybody under a roof stops existing -------------------- */
{ SP_NARRATOR, BD_COLLAPSE, CUT_SHAKE, 0,
  "There is no bang. That is the part nobody manages to describe afterwards.",
  {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_SHAKE, 0,
  "Your building goes. So does the one behind it. So does every building you "
  "can see, all at once, like something letting go.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_SHAKE, 0,
  "The dust takes the street. You are on your knees with a cat inside your "
  "jacket and you cannot hear anything at all.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "Everyone who was indoors, or under any roof at all, is gone. You were "
  "outside because the cat was.", {0}, {0} },

/* ---- the announcement --------------------------------------------------- */
{ SP_SYSTEM, BD_ANNOUNCE, CUT_FLASH, 0,
  "ATTENTION, SURVIVORS.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "The interior of every building on your planet has been taken for its "
  "resources. What is left of your species has one way to win the planet "
  "back.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "Beneath you is the World Dungeon: eighteen floors. Beat it, and Earth is "
  "yours again. Every step of it is broadcast.", {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "Broadcast.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "Donut is still a cat. She looks at the sky as though it has finally said "
  "something worth hearing.", {0}, {0} },

{ SP_SYSTEM, BD_STAIRS, CUT_CHOICE, 0,
  "A staircase has opened where the intersection used to be. It goes down.",
  { "Go down", "Look back once", "Light a cigarette" },
  { "You go down. Not bravely. It is simply the only direction that still has "
    "anything in it.",
    "There is no building to look back at. There is not even a shape where a "
    "building was. You go down.",
    "Your hands are shaking too much. You put the pack back in your jacket and "
    "go down." }, },

{ SP_SYSTEM, BD_STAIRS, CUT_NONE, 0,
  "Crawler registered: CARL. Footwear: pink Crocs, one size too small, not "
  "his. The audience likes him already.", {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "I came out to get the cat.", {0}, {0} },
{ SP_SYSTEM, BD_DUNGEON, CUT_FLASH, 0,
  "Welcome to the first floor, crawler. It is on a timer. When the timer runs "
  "out, the floor collapses, with or without you on it.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "Find a staircase down before then. And look for a sign: there is a "
  "tutorial guild on this floor.", {0}, {0} },
};

const Chapter chapters[] = {
    { 1, "2:23 A.M.", ch1, (uint8_t)(sizeof ch1 / sizeof ch1[0]) },
};
const int chapter_count = (int)(sizeof chapters / sizeof chapters[0]);
