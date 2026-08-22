/*  Recall codes.
 *
 *  A DS cartridge saves to a chip; a homebrew ROM running under whichever
 *  emulator the handheld ships with often cannot count on one. So the System
 *  issues a code instead — twenty characters at a System kiosk that put a run
 *  back on its floor with its levels, purse, achievements and story intact.
 *  It carries the season seed too, because with the floors generated rather
 *  than drawn a code that restored your level into somebody else's dungeon
 *  would not be the same run.
 *  Attribute points spent on the way are re-spent for you, which is the one
 *  thing the code does not carry.
 */
#include "game.h"

#include <string.h>

/* No I, O, 0 or 1: nobody should lose a run to a squinting mistake. */
static const char kAlphabet[33] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#define CODE_BITS 100
#define CODE_CHARS (CODE_BITS / 5)
/* Round up: 100 bits is twelve and a half bytes, and truncating loses the
   tail of the checksum. */
#define CODE_BYTES ((CODE_BITS + 7) / 8)

typedef struct { uint8_t bits[CODE_BYTES]; int pos; } BitBuf;

static void put_bits(BitBuf *b, uint32_t value, int n) {
    for (int i = n - 1; i >= 0; i--) {
        int bit = (value >> i) & 1;
        if (bit) b->bits[b->pos >> 3] |= (uint8_t)(0x80 >> (b->pos & 7));
        b->pos++;
    }
}

static uint32_t get_bits(BitBuf *b, int n) {
    uint32_t v = 0;
    for (int i = 0; i < n; i++) {
        int bit = (b->bits[b->pos >> 3] >> (7 - (b->pos & 7))) & 1;
        v = (v << 1) | (uint32_t)bit;
        b->pos++;
    }
    return v;
}

/*  Checksums the whole buffer with the checksum field itself blanked, so both
 *  sides compute over identical bytes. (Checking only the payload bits does not
 *  work: the last payload byte shares space with the checksum.) */
static uint32_t checksum(const BitBuf *b) {
    BitBuf t = *b;
    t.bits[(CODE_BITS - 10) >> 3] &= (uint8_t)~((1u << (8 - ((CODE_BITS - 10) & 7))) - 1u);
    for (int i = ((CODE_BITS - 10) >> 3) + 1; i < CODE_BYTES; i++) t.bits[i] = 0;
    uint32_t sum = 0x5A;
    for (int i = 0; i < CODE_BYTES; i++) sum = (sum * 31 + t.bits[i]) & 0xFFFF;
    return sum & 0x3FF;
}

void save_make_code(char *out) {
    BitBuf b;
    memset(&b, 0, sizeof b);
    put_bits(&b, 3, 3);                              /* format version        */
    put_bits(&b, g.season & 0xFFFF, 16);             /* the season's seed     */
    put_bits(&b, g.dun.index, 2);                    /* floor                 */
    put_bits(&b, g.hero[0].level, 5);
    put_bits(&b, g.hero[1].level, 5);
    put_bits(&b, (uint32_t)(g.gold < 0 ? 0 : g.gold > 16000 ? 16000 : g.gold) / 4, 12);
    put_bits(&b, g.flags & 0xFFF, 12);
    put_bits(&b, g.achievements & 0xFFFF, 16);   /* fourteen of them now */
    put_bits(&b, g.battles_won > 255 ? 255 : g.battles_won, 8);
    put_bits(&b, g.boxes_opened > 63 ? 63 : g.boxes_opened, 6);
    put_bits(&b, g.story_beat & 0xF, 4);
    while (b.pos < CODE_BITS - 10) put_bits(&b, 0, 1);
    put_bits(&b, checksum(&b), 10);

    BitBuf r = b;
    r.pos = 0;
    for (int i = 0; i < CODE_CHARS; i++) out[i] = kAlphabet[get_bits(&r, 5)];
    out[CODE_CHARS] = 0;
}

static int alphabet_index(char c) {
    if (c >= 'a' && c <= 'z') c = (char)(c - 'a' + 'A');
    for (int i = 0; i < 32; i++) if (kAlphabet[i] == c) return i;
    return -1;
}

/* Rebuilds a run from a code. Attribute points are auto-spent along each
   hero's own line: Carl into muscle and bone, Donut into speed and charisma. */
int save_apply_code(const char *code) {
    BitBuf b;
    memset(&b, 0, sizeof b);
    int n = 0;
    for (const char *p = code; *p && n < CODE_CHARS; p++) {
        if (*p == '-' || *p == ' ') continue;
        int idx = alphabet_index(*p);
        if (idx < 0) return 0;
        put_bits(&b, (uint32_t)idx, 5);
        n++;
    }
    if (n != CODE_CHARS) return 0;

    BitBuf r = b;
    r.pos = 0;
    if (get_bits(&r, 3) != 3) return 0;
    uint32_t season = get_bits(&r, 16);
    int floor_index = (int)get_bits(&r, 2);
    int carl_level = (int)get_bits(&r, 5);
    int donut_level = (int)get_bits(&r, 5);
    int gold = (int)get_bits(&r, 12) * 4;
    uint32_t flags = get_bits(&r, 12);
    uint32_t achievements = get_bits(&r, 16);
    int battles = (int)get_bits(&r, 8);
    int boxes = (int)get_bits(&r, 6);
    int beat = (int)get_bits(&r, 4);
    r.pos = CODE_BITS - 10;
    if (get_bits(&r, 10) != checksum(&b)) return 0;
    if (floor_index >= FLOORS || carl_level < 1 || carl_level > 30 || donut_level < 1) return 0;

    party_new();
    g.season = season ? season : 0x1BADCA7Du;
    rng_seed(0x9E3779B9u ^ (g.season * 2654435761u));
    g.gold = (int16_t)gold;
    g.flags = flags;
    g.achievements = achievements;
    g.battles_won = (uint16_t)battles;
    g.boxes_opened = (uint16_t)boxes;
    g.story_beat = (uint8_t)beat;
    memset(g.inventory, 0, sizeof g.inventory);
    inventory_add(1, 3);
    inventory_add(3, 2);

    static const uint8_t carl_line[6]  = { 0, 2, 0, 2, 0, 1 };  /* str, con, str, con... */
    static const uint8_t donut_line[6] = { 1, 4, 1, 4, 5, 3 };
    for (int hero = 0; hero < PARTY; hero++) {
        Hero *h = &g.hero[hero];
        int want = hero ? donut_level : carl_level;
        const uint8_t *line = hero ? donut_line : carl_line;
        for (int lvl = 1; lvl < want; lvl++) {
            for (int p = 0; p < 2; p++) {
                uint8_t *stats = &h->st.str;
                stats[line[(lvl * 2 + p) % 6]]++;
            }
            h->level++;
        }
        hero_recompute(h);
        h->hp = h->hp_max;
        h->mp = h->mp_max;
    }
    dungeon_enter(floor_index);
    return 1;
}
