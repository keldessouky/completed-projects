/*  Music and noise.
 *
 *  The DS's sound hardware has eight programmable-wave channels; this uses four
 *  of them — bass, melody, arpeggio and a percussion/effects slot — driven by a
 *  step sequencer that ticks once a frame. Every note below was written here;
 *  nothing is sampled and nothing is streamed, so the whole soundtrack costs a
 *  few hundred bytes of ROM.
 */
#include "game.h"

#include "audio.h"

/* Equal temperament, A4 = 440Hz, as a table so the ARM9 never divides. */
static const uint16_t kNoteHz[] = {
    /* C2 .. B5, twelve to the octave */
     65,  69,  73,  78,  82,  87,  92,  98, 104, 110, 117, 123,
    131, 139, 147, 156, 165, 175, 185, 196, 208, 220, 233, 247,
    262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494,
    523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988,
};
#define NOTE_COUNT ((int)(sizeof kNoteHz / sizeof kNoteHz[0]))

#define R 0       /* rest */
#define H 255     /* hold the previous note */

/* Note numbers are indices into kNoteHz: 0 = C2, 24 = C4, 36 = C5. */

/*  Title: slow, wide, faintly ceremonial — a game show that thinks well of
 *  itself. */
static const uint8_t title_bass[]  = { 12,H,H,H, 12,H,R,R, 10,H,H,H, 10,H,R,R,
                                        8,H,H,H,  8,H,R,R,  5,H,H,H,  7,H,H,H };
static const uint8_t title_lead[]  = { 36,H,38,H, 40,H,38,H, 36,H,R,R, 31,H,R,R,
                                       33,H,35,H, 36,H,H,H,  R,R,R,R, 31,H,33,H };
static const uint8_t title_arp[]   = { 24,28,31,28, 24,28,31,28, 22,26,29,26, 22,26,29,26,
                                       20,24,27,24, 20,24,27,24, 17,21,24,21, 19,23,26,23 };

/*  The floors: a four-bar loop that does not resolve, because the floor does
 *  not either. */
static const uint8_t crawl_bass[]  = { 10,H,H,H, R,R,10,H, 8,H,H,H, R,R,8,H,
                                        6,H,H,H, R,R,6,H, 8,H,H,H, 10,H,H,H };
static const uint8_t crawl_lead[]  = { 34,H,R,R, 32,H,R,R, R,R,29,H, 31,H,R,R,
                                        R,R,R,R, 27,H,29,H, 31,H,R,R, R,R,R,R };
static const uint8_t crawl_arp[]   = { 22,R,26,R, 22,R,26,R, 20,R,24,R, 20,R,24,R,
                                       18,R,22,R, 18,R,22,R, 20,R,24,R, 22,R,26,R };

/*  Fights: fast, two-chord, nothing clever. */
static const uint8_t fight_bass[]  = { 8,8,H,8, 8,8,H,8, 6,6,H,6, 6,6,H,6,
                                        4,4,H,4, 4,4,H,4, 6,6,H,6, 8,8,H,8 };
static const uint8_t fight_lead[]  = { 32,R,35,R, 32,R,39,R, 30,R,33,R, 30,R,37,R,
                                       28,R,31,R, 28,R,35,R, 30,R,33,R, 32,R,35,R };
static const uint8_t fight_arp[]   = { 20,24,27,24, 20,24,27,24, 18,22,25,22, 18,22,25,22,
                                       16,20,23,20, 16,20,23,20, 18,22,25,22, 20,24,27,24 };

/*  Bosses: same engine, half a step lower and twice as pleased with itself. */
static const uint8_t boss_bass[]   = { 5,H,5,H, 5,H,5,5, 3,H,3,H, 3,H,3,3,
                                        1,H,1,H, 1,H,1,1, 3,H,3,H, 5,H,5,5 };
static const uint8_t boss_lead[]   = { 29,31,32,H, 29,H,27,H, 27,29,31,H, 27,H,25,H,
                                       25,27,29,H, 32,H,34,H, 36,H,34,H, 32,H,R,R };
static const uint8_t boss_arp[]    = { 17,20,24,20, 17,20,24,20, 15,18,22,18, 15,18,22,18,
                                       13,16,20,16, 13,16,20,16, 15,18,22,18, 17,20,24,20 };

typedef struct {
    const uint8_t *bass, *lead, *arp;
    uint8_t len;
    uint8_t speed;        /* frames per step */
} Song;

static const Song kSongs[SONG_COUNT] = {
    { title_bass, title_lead, title_arp, 32, 11 },   /* SONG_TITLE  */
    { crawl_bass, crawl_lead, crawl_arp, 32, 12 },   /* SONG_CRAWL  */
    { fight_bass, fight_lead, fight_arp, 32,  7 },   /* SONG_FIGHT  */
    { boss_bass,  boss_lead,  boss_arp,  32,  8 },   /* SONG_BOSS   */
};

static struct {
    uint8_t song, playing;
    uint8_t step, tick;
    uint8_t transpose;
    uint8_t last[3];
    /* the effects channel */
    uint16_t sfx_freq;
    uint8_t  sfx_life, sfx_decay, sfx_duty;
    int16_t  sfx_slide;
} snd;

static int note_hz(int note, int transpose) {
    int n = note + transpose;
    if (n < 0) n = 0;
    if (n >= NOTE_COUNT) n = NOTE_COUNT - 1;
    return kNoteHz[n];
}

void audio_play_song(int song, int transpose) {
    if (song < 0 || song >= SONG_COUNT) return;
    if (snd.playing && snd.song == song && snd.transpose == transpose) return;
    snd.song = (uint8_t)song;
    snd.transpose = (uint8_t)transpose;
    snd.playing = 1;
    snd.step = 0;
    snd.tick = 0;
    for (int i = 0; i < 3; i++) snd.last[i] = 0;
}

void audio_stop(void) {
    snd.playing = 0;
    for (int i = 0; i < 3; i++) plat_sound_stop(i);
}

/*  Effects are one channel with a falling envelope and an optional pitch slide,
 *  which is enough for a punch, a coin and a door. */
void audio_sfx(int kind) {
    switch (kind) {
    case SFX_SELECT: snd.sfx_freq = 900;  snd.sfx_life = 5;  snd.sfx_decay = 3; snd.sfx_slide = 40;  snd.sfx_duty = 2; break;
    case SFX_STEP:   snd.sfx_freq = 150;  snd.sfx_life = 4;  snd.sfx_decay = 4; snd.sfx_slide = -20; snd.sfx_duty = 6; break;
    case SFX_HIT:    snd.sfx_freq = 320;  snd.sfx_life = 9;  snd.sfx_decay = 2; snd.sfx_slide = -34; snd.sfx_duty = 5; break;
    case SFX_CRIT:   snd.sfx_freq = 620;  snd.sfx_life = 14; snd.sfx_decay = 1; snd.sfx_slide = -46; snd.sfx_duty = 1; break;
    case SFX_HURT:   snd.sfx_freq = 240;  snd.sfx_life = 12; snd.sfx_decay = 2; snd.sfx_slide = -18; snd.sfx_duty = 7; break;
    case SFX_LOOT:   snd.sfx_freq = 700;  snd.sfx_life = 20; snd.sfx_decay = 1; snd.sfx_slide = 55;  snd.sfx_duty = 0; break;
    case SFX_LEVEL:  snd.sfx_freq = 520;  snd.sfx_life = 26; snd.sfx_decay = 1; snd.sfx_slide = 30;  snd.sfx_duty = 1; break;
    case SFX_DOOR:   snd.sfx_freq = 190;  snd.sfx_life = 16; snd.sfx_decay = 1; snd.sfx_slide = -8;  snd.sfx_duty = 6; break;
    case SFX_DOWN:   snd.sfx_freq = 480;  snd.sfx_life = 24; snd.sfx_decay = 1; snd.sfx_slide = -22; snd.sfx_duty = 3; break;
    default: return;
    }
}

void audio_frame(void) {
    /* The score follows the scene without anyone having to remember to ask. */
    switch (g.scene) {
    case SCENE_TITLE:    audio_play_song(SONG_TITLE, 0); break;
    case SCENE_BATTLE:   audio_play_song(g.bat.boss ? SONG_BOSS : SONG_FIGHT, 0); break;
    case SCENE_VICTORY:  audio_play_song(SONG_TITLE, 5); break;
    case SCENE_GAMEOVER: audio_stop(); break;
    default:             audio_play_song(SONG_CRAWL, (uint8_t)(g.dun.index * 2)); break;
    }

    if (snd.playing) {
        const Song *s = &kSongs[snd.song];
        if (++snd.tick >= s->speed) {
            snd.tick = 0;
            snd.step = (uint8_t)((snd.step + 1) % s->len);
            const uint8_t *lines[3] = { s->bass, s->lead, s->arp };
            static const uint8_t volume[3] = { 46, 54, 30 };
            static const uint8_t duty[3] = { 4, 2, 0 };
            for (int ch = 0; ch < 3; ch++) {
                uint8_t note = lines[ch][snd.step];
                if (note == H) continue;
                if (note == R) { plat_sound_stop(ch); snd.last[ch] = 0; continue; }
                int hz = note_hz(note, ch == 0 ? snd.transpose : snd.transpose);
                plat_sound(ch, hz, volume[ch], duty[ch]);
                snd.last[ch] = note;
            }
        }
    }

    if (snd.sfx_life) {
        snd.sfx_life--;
        int freq = (int)snd.sfx_freq + snd.sfx_slide;
        if (freq < 60) freq = 60;
        snd.sfx_freq = (uint16_t)freq;
        int vol = snd.sfx_life * 6;
        if (vol > 60) vol = 60;
        if (snd.sfx_life) plat_sound(3, snd.sfx_freq, vol, snd.sfx_duty);
        else plat_sound_stop(3);
    }
}
