/*  Recall codes.
 *
 *  A DS cartridge saves to a chip; a homebrew ROM running under whichever
 *  emulator the handheld ships with often cannot count on one. So the System
 *  issues a code instead — twenty characters at a System kiosk that put a run
 *  back on its floor with its levels, purse, achievements and story intact.
 *  It carries the season seed too, because with the floors generated rather
 *  than drawn a code that restored your level into somebody else's dungeon
 *  would not be the same run.
 *
 *  A code is a suspend, not a life. The show only prints one while the crawler
 *  is alive; when a season ends it ends, and the next one is somebody else.
 *  Attribute points spent on the way are re-spent for you, which is the one
 *  thing the code does not carry.
 */
#include "game.h"

#include <string.h>

/* No I, O, 0 or 1: nobody should lose a run to a squinting mistake. */
static const char kAlphabet[33] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#define CODE_BITS 100
/*  CODE_CHARS lives in game.h: the display and the keyboard both have to agree
    with it, and when this grew from sixteen to twenty they did not. */
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

int code_format(char *out, const char *code, int from, int count, char sep) {
    int o = 0;
    for (int i = from; i < from + count && code[i]; i++) {
        if (i > from && (i - from) % CODE_GROUP == 0) out[o++] = sep;
        out[o++] = code[i];
    }
    out[o] = 0;
    return o;
}

void save_make_code(char *out) {
    BitBuf b;
    memset(&b, 0, sizeof b);
    put_bits(&b, 6, 3);                              /* format version        */
    put_bits(&b, g.season & 0xFFFF, 16);             /* the season's seed     */
    put_bits(&b, g.hero[0].crawler & 3, 2);          /* who went down         */
    put_bits(&b, g.hero[1].crawler & 3, 2);
    put_bits(&b, g.dun.index, 5);                    /* floor, of eighteen    */
    put_bits(&b, g.hero[0].level, 5);
    put_bits(&b, g.hero[1].level, 5);
    put_bits(&b, (uint32_t)(g.gold < 0 ? 0 : g.gold > 16000 ? 16000 : g.gold) / 8, 11);
    put_bits(&b, g.flags & 0xFFF, 12);
    /*  Only the earned ones. The six the draft decides are rebuilt on load
        from the crawler pair above, which is the only reason twenty-one of
        them fit a payload that has no spare bits. */
    put_bits(&b, (g.achievements >> ACH_ENTRY_COUNT) & 0xFFFF, 16);
    put_bits(&b, g.battles_won > 127 ? 127 : g.battles_won, 7);
    put_bits(&b, g.boxes_opened > 15 ? 15 : g.boxes_opened, 4);
    put_bits(&b, g.story_beat & 3, 2);
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
    if (get_bits(&r, 3) != 6) return 0;   /* v5 laid the achievements out differently */
    uint32_t season = get_bits(&r, 16);
    int crawler_a = (int)get_bits(&r, 2);
    int crawler_b = (int)get_bits(&r, 2);
    int floor_index = (int)get_bits(&r, 5);
    int carl_level = (int)get_bits(&r, 5);
    int donut_level = (int)get_bits(&r, 5);
    int gold = (int)get_bits(&r, 11) * 8;
    uint32_t flags = get_bits(&r, 12);
    uint32_t achievements = get_bits(&r, 16);
    int battles = (int)get_bits(&r, 7);
    int boxes = (int)get_bits(&r, 4);
    int beat = (int)get_bits(&r, 2);
    r.pos = CODE_BITS - 10;
    if (get_bits(&r, 10) != checksum(&b)) return 0;
    if (floor_index >= FLOORS || carl_level < 1 || carl_level > 30 || donut_level < 1) return 0;

    /*  The code has to say who went down. Restoring a season's floor and
        levels onto the default pair would hand the run to two people who were
        never in it. */
    party_draft(crawler_a, crawler_b);
    g.season = season ? season : 0x1BADCA7Du;
    rng_seed(0x9E3779B9u ^ (g.season * 2654435761u));
    g.gold = (int16_t)gold;
    g.flags = flags;
    /*  Set directly rather than awarded: these are already-earned history
        being restored, and awarding them again would re-toast them and pay
        out their boxes a second time. */
    g.achievements = (achievements << ACH_ENTRY_COUNT) | game_entry_achievements();
    memset(g.boxes_held, 0, sizeof g.boxes_held);
    g.battles_won = (uint16_t)battles;
    g.boxes_opened = (uint16_t)boxes;
    g.story_beat = (uint8_t)beat;
    memset(g.inventory, 0, sizeof g.inventory);
    inventory_add(ITEM_SPLINT, 3);
    inventory_add(ITEM_ENERGY, 2);

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
