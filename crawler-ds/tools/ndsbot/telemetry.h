/*  Shared between the ROM and the test harness.
 *
 *  The game keeps one of these structs in main RAM and flushes it after every
 *  frame. The harness takes an emulator save state — which contains a verbatim
 *  copy of the DS's main RAM — finds the magic, and reads the game's state out
 *  of the running ROM. Nothing is drawn to the screen for the benefit of the
 *  tests, so the ROM under test is exactly the ROM that ships.
 */
#ifndef CRAWLER_TELEMETRY_H
#define CRAWLER_TELEMETRY_H

#include <stdint.h>

#define TELEMETRY_MAGIC0 0x4C525743u   /* "CRWL" */
#define TELEMETRY_MAGIC1 0x53445F31u   /* "1_DS" */

typedef struct {
    uint32_t magic0, magic1;
    uint32_t frame;          /* frames since boot                              */
    uint32_t scene;          /* GameScene                                      */
    uint32_t floor;          /* dungeon floor, 1-based                         */
    uint32_t px, py, facing; /* party position and heading                     */
    uint32_t steps;          /* tiles walked                                   */
    uint32_t explored;       /* tiles seen on this floor                       */
    uint32_t carl_hp, carl_hp_max, carl_level, carl_xp;
    uint32_t donut_hp, donut_hp_max, donut_level;
    uint32_t gold, boxes, achievements;
    uint32_t battles_won, story_beat, flags;
    uint32_t collapse;       /* seconds left on the floor timer                */
    uint32_t touch;          /* last stylus contact: 1<<24 | x<<8 | y           */
    uint32_t touch_raw;      /* raw digitiser reading, for diagnosing calibration */
    uint32_t checksum;
} Telemetry;

#endif
