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
    same shape, and the label says what the button actually does. */
static const Rect kBatCommands[] = {
    {   8,  92, 116, 40, "FIGHT" },
    { 132,  92, 116, 40, "BAG" },
    {   8, 136, 116, 40, "GUARD" },
    { 132, 136, 116, 40, "RUN" },
    {  84, 176, 88,  14, "BACK" },
};
/* Referring to the last entry by a bare 5 is how it ended up reading one Rect
   off the end of the array when the third and fourth buttons merged. */
#define BAT_BACK ((int)(sizeof kBatCommands / sizeof kBatCommands[0]) - 1)

/* Menu tabs across the top of the bottom screen. */
static const Rect kMenuTabs[] = {
    {   4, 4, 60, 20, "PARTY" },
    {  68, 4, 60, 20, "GEAR" },
    { 132, 4, 60, 20, "FEATS" },   /* it lists achievements, not boxes */
    { 196, 4, 56, 20, "SHOW" },
};

#endif
