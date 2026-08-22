/*  Screen furniture shared by the scene updates (which hit-test taps) and the
 *  renderer (which draws the same rectangles). One table, two readers. */
#ifndef CRAWLER_UI_LAYOUT_H
#define CRAWLER_UI_LAYOUT_H

typedef struct { int16_t x, y, w, h; const char *label; } Rect;

/* Bottom screen, dungeon: a d-pad on the left, actions on the right. */
static const Rect kDunPad[] = {
    {  30, 116, 34, 26, "\177" },      /* forward   */
    {  30, 160, 34, 22, "\200" },      /* back      */
    {   4, 138, 24, 26, "\201" },      /* turn left */
    {  66, 138, 24, 26, "\202" },      /* turn right*/
};
static const Rect kDunActions[] = {
    { 100, 116, 72, 24, "LOOK" },
    { 176, 116, 76, 24, "PARTY" },
    { 100, 144, 72, 24, "MAP+" },
    { 176, 144, 76, 24, "CODE" },
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
    { 132, 4, 60, 20, "BOX" },
    { 196, 4, 56, 20, "SHOW" },
};

#endif
