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

/* Bottom screen, battle: four commands and a row of targets. */
static const Rect kBatCommands[] = {
    {   6, 108, 72, 30, "STRIKE" },
    {  84, 108, 72, 30, "SKILL" },
    { 162, 108, 88, 30, "ITEM" },
    {   6, 144, 72, 30, "GUARD" },
    {  84, 144, 72, 30, "RUN" },
    { 162, 144, 88, 30, "BACK" },
};

/* Menu tabs across the top of the bottom screen. */
static const Rect kMenuTabs[] = {
    {   4, 4, 60, 20, "PARTY" },
    {  68, 4, 60, 20, "GEAR" },
    { 132, 4, 60, 20, "BOX" },
    { 196, 4, 56, 20, "SHOW" },
};

#endif
