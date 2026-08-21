#ifndef CRAWLER_AUDIO_H
#define CRAWLER_AUDIO_H

enum { SONG_TITLE, SONG_CRAWL, SONG_FIGHT, SONG_BOSS, SONG_COUNT };
enum { SFX_SELECT, SFX_STEP, SFX_HIT, SFX_CRIT, SFX_HURT, SFX_LOOT, SFX_LEVEL, SFX_DOOR, SFX_DOWN };

void audio_frame(void);
void audio_play_song(int song, int transpose);
void audio_stop(void);
void audio_sfx(int kind);

#endif
