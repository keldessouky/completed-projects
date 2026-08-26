/*  Book One, Chapter One.
 *
 *  The book opens above ground and stays there for a while, which is the part
 *  a dungeon crawler usually skips: no floors, no loot, no fighting, just a man
 *  outside at three in the morning in his underwear because a cat got out. All
 *  of it matters, because the reason he lives through the next ninety seconds
 *  is that he was not indoors.
 *
 *  The prose here is written for this game. It follows the events of the
 *  chapter; it does not reproduce the book's text, and none of these lines are
 *  quotations.
 */
#include "game.h"

static const CutLine ch1[] = {
{ SP_NARRATOR, BD_STREET, CUT_NONE, 0,
  "Three in the morning, and the cold off the water has opinions about a man "
  "in boxer shorts.", {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "The door shut behind me. Of course it did.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_NONE, 0,
  "Bea took the apartment, the furniture and most of the last four years. She "
  "left the cat, and the cat has left the apartment.", {0}, {0} },
{ SP_NARRATOR, BD_STREET_CAT, CUT_NONE, 0,
  "Princess Donut is up a fire escape, six feet above the pavement, entirely "
  "unbothered. She has ribbons. She has a title. She has never once come when "
  "called.", {0}, {0} },

{ SP_CARL, BD_KEEP, CUT_CHOICE, 0,
  "Okay. Cat. How do we do this.",
  { "Talk her down", "Grab her fast", "Wait her out" },
  { "You crouch and say her name like she is a person. Her ears turn. It is "
    "not agreement, but it is attention.",
    "You lunge. She is a Persian, not a saint, and your forearm learns the "
    "difference. She lands two feet away and sits down to watch you bleed.",
    "You stand in the cold and outlast her, which takes eleven minutes and "
    "costs you all feeling below the ankle." }, },

{ SP_NARRATOR, BD_KEEP, CUT_AWARD, ACH_NO_SHOES,
  "You get a hand under her. Eight pounds of cat and about four of hair.",
  {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "Right. Now I just need someone to let me back in.", {0}, {0} },

/* ---- and then everybody indoors stops existing ------------------------- */
{ SP_NARRATOR, BD_COLLAPSE, CUT_SHAKE, 0,
  "There is no bang. That is the part nobody manages to describe afterwards.",
  {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_SHAKE, 0,
  "The building folds the way a wet box folds. So does the one behind it. So "
  "does every building you can see, all at once, quietly, like something "
  "letting go.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_SHAKE, 0,
  "The dust arrives a second later and takes the street with it. You are on "
  "your knees with a cat under your shirt and you cannot hear anything at all.",
  {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0, "Bea. BEA.", {0}, {0} },
{ SP_NARRATOR, BD_KEEP, CUT_AWARD, ACH_OUTSIDE,
  "Everyone who was inside is gone. Everyone who was outside is standing in "
  "the road in whatever they had on. There are not many of you.", {0}, {0} },

/* ---- the announcement --------------------------------------------------- */
{ SP_SYSTEM, BD_ANNOUNCE, CUT_FLASH, 0,
  "GOOD MORNING, SURVIVORS.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "The surface of your planet has been repossessed. This is not a negotiation "
  "and there is no appeal, but there is an opportunity, and we are legally "
  "required to describe it as generous.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "Beneath you is a dungeon of eighteen floors. It is open. It is broadcast. "
  "It is, as of this moment, the only part of this world with a future in it.",
  {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "Entry is voluntary. Remaining on the surface is also voluntary, in the same "
  "way that holding your breath is voluntary.", {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "Voluntary.", {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "Pets may accompany their owners. Congratulations: yours has been assessed "
  "and found interesting.", {0}, {0} },
{ SP_DONUT, BD_KEEP, CUT_NONE, 0,
  "(She looks at the sky as though it has finally said something worth "
  "hearing.)", {0}, {0} },

{ SP_SYSTEM, BD_STAIRS, CUT_CHOICE, 0,
  "A stairwell has opened where the intersection used to be. Do come down.",
  { "Go down", "Look for Bea first", "Say nothing" },
  { "You go down. Not bravely. It is simply the only direction that still has "
    "anything in it.",
    "You go back to where the building was. There is no building. There is not "
    "even a shape where a building was. Then you go down.",
    "You do not dignify it with an answer, which the audience is told is "
    "characteristic, and then you go down anyway." }, },

{ SP_SYSTEM, BD_STAIRS, CUT_NONE, 0,
  "Recording. Name displayed as CARL. Footwear: none. The audience is already "
  "enjoying that more than you are.", {0}, {0} },
{ SP_CARL, BD_KEEP, CUT_NONE, 0,
  "I came out to get the cat.", {0}, {0} },
{ SP_SYSTEM, BD_DUNGEON, CUT_FLASH, 0,
  "Everybody came out to get something. Welcome to the first floor, crawler.",
  {0}, {0} },
{ SP_SYSTEM, BD_KEEP, CUT_NONE, 0,
  "The floor is timed. When the clock runs out the floor stops existing, with "
  "or without you on it. Find the stairs. Try to be entertaining on the way.",
  {0}, {0} },
};

const Chapter chapters[] = {
    { 1, "NO SHOES", ch1, (uint8_t)(sizeof ch1 / sizeof ch1[0]) },
};
const int chapter_count = (int)(sizeof chapters / sizeof chapters[0]);
