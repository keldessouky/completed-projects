/*  Screen furniture shared by the scene updates (which hit-test taps) and the
 *  renderer (which draws the same rectangles). One table, two readers. */
#ifndef CRAWLER_UI_LAYOUT_H
#define CRAWLER_UI_LAYOUT_H

typedef struct { int16_t x, y, w, h; const char *label; } Rect;

/* Bottom screen, dungeon: a d-pad on the left, actions on the right. */
/*  Six controls, laid out the way a first-person game splits them: the middle
    column walks, the sides step sideways, and the two at the top corners turn.
    A DS has no analog sticks for a ROM to read, so move and look live on
    separate physical controls instead -- which is also what lets a handheld
    with sticks bind one to each. */
static const Rect kDunPad[] = {
    {  34, 140, 28, 22, "\177" },      /* forward     */
    {  34, 166, 28, 22, "\200" },      /* back        */
    {   4, 140, 26, 22, "\201" },      /* strafe left */
    {  66, 140, 26, 22, "\202" },      /* strafe right*/
    {   4, 114, 26, 22, "\210" },      /* turn left   */
    {  66, 114, 26, 22, "\211" },      /* turn right  */
};
#define DUN_PAD_N ((int)(sizeof kDunPad / sizeof kDunPad[0]))
static const Rect kDunActions[] = {
    { 102, 118, 72, 26, "LOOK" },
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
