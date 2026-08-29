/*  Screen furniture shared by the scene updates (which hit-test taps) and the
 *  renderer (which draws the same rectangles). One table, two readers. */
#ifndef CRAWLER_UI_LAYOUT_H
#define CRAWLER_UI_LAYOUT_H

typedef struct { int16_t x, y, w, h; const char *label; } Rect;

/* Bottom screen, dungeon: a d-pad on the left, actions on the right. */
/*  A plain four-way pad. Overhead there is nothing to turn: the way you press
    is the way you face, so the sixth and fifth buttons a first-person view
    needed are gone and the four that are left can be bigger. */
static const Rect kDunPad[] = {
    {  34, 118, 30, 24, "\177" },      /* north */
    {  34, 164, 30, 24, "\200" },      /* south */
    {   4, 141, 28, 22, "\201" },      /* west  */
    {  66, 141, 28, 22, "\202" },      /* east  */
};
#define DUN_PAD_N ((int)(sizeof kDunPad / sizeof kDunPad[0]))
static const Rect kDunActions[] = {
    { 102, 118, 72, 26, "USE" },
    { 178, 118, 74, 26, "PARTY" },
    { 102, 146, 72, 26, "MAP+" },
    { 178, 146, 74, 26, "CODE" },
};

/*  Four commands in a two-by-two block. Pokemon puts the party switch in the
    third slot; both of these two fight every turn, so that slot is GUARD —
    same shape, and the label says what the button actually does.

    These used to start at y=92, under a copy of the enemy roster that the top
    screen was already showing. Two screens each doing half of both jobs is
    what made the fight look cluttered at the top and empty at the bottom, so
    the roster went back to the foes it belongs to and the buttons grew into
    the sixty pixels it had been occupying. A touch target on a handheld
    wants to be bigger than the minimum anyway. */
static const Rect kBatCommands[] = {
    {   8,  44, 116, 54, "FIGHT" },
    { 132,  44, 116, 54, "BAG" },
    {   8, 102, 116, 54, "GUARD" },
    { 132, 102, 116, 54, "RUN" },
    {  84, 176, 88,  14, "BACK" },
};
/* Referring to the last entry by a bare 5 is how it ended up reading one Rect
   off the end of the array when the third and fourth buttons merged. */
#define BAT_BACK ((int)(sizeof kBatCommands / sizeof kBatCommands[0]) - 1)

/*  The two things you can do from the title. These were written out twice --
    once as Rects in update_title's hit test, once as literals in the drawing
    code -- and the two had drifted apart, so the buttons were being drawn in
    one place and tapped in another. Same fault the comment above kBatCommands
    describes; same fix. */
static const Rect kTitleOpts[] = {
    { 28,  96, 200, 34, "NEW SEASON" },
    { 28, 136, 200, 34, "RESUME FROM CODE" },
};

/* Menu tabs across the top of the bottom screen. */
static const Rect kMenuTabs[] = {
    {   4, 4, 60, 20, "PARTY" },
    {  68, 4, 60, 20, "GEAR" },
    { 132, 4, 60, 20, "FEATS" },   /* it lists achievements, not boxes */
    { 196, 4, 56, 20, "SHOW" },
};

#endif
