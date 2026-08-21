/*  The four channels, on real hardware.
 *
 *  libnds owns the sound hardware from the ARM7 and the ARM9 talks to it over
 *  the FIFO. Two details drive the shape of this file:
 *
 *    - soundPlayPSG() is synchronous. It posts a message and then spins waiting
 *      for the ARM7 to answer with a channel number. Calling it from the
 *      per-frame path backs the sound FIFO up and eventually the ARM9 waits
 *      forever, which looks exactly like the game freezing. So the four voices
 *      are claimed once, lazily, at silence, and never again.
 *    - every other call is a fire-and-forget FIFO word, so they are only sent
 *      when the value actually changes. A held note costs nothing, and a rest
 *      is a volume of zero rather than a kill.
 */
#include <nds.h>

#include "platform.h"

#define VOICES 4

static struct {
    int handle;         /* -1 not claimed yet, -2 gave up (no channel free) */
    int freq, volume, duty;
} voice[VOICES] = {
    { -1, 0, 0, -1 }, { -1, 0, 0, -1 }, { -1, 0, 0, -1 }, { -1, 0, 0, -1 },
};

static const DutyCycle kDuty[8] = {
    DutyCycle_0, DutyCycle_12, DutyCycle_25, DutyCycle_37,
    DutyCycle_50, DutyCycle_62, DutyCycle_75, DutyCycle_87,
};

/* Claims a PSG channel, silent, the first time a voice is asked for. */
static int claim(int v, int duty) {
    if (voice[v].handle >= 0) return voice[v].handle;
    if (voice[v].handle == -2) return -1;
    int h = soundPlayPSG(kDuty[duty & 7], 440, 0, 64);
    if (h < 0) {
        voice[v].handle = -2;          /* stop asking; the DS has 6 PSG channels */
        return -1;
    }
    voice[v].handle = h;
    voice[v].freq = 440;
    voice[v].volume = 0;
    voice[v].duty = duty & 7;
    return h;
}

void plat_sound(int voice_index, int freq, int volume, int duty) {
    if (voice_index < 0 || voice_index >= VOICES) return;
    if (freq < 30) freq = 30;
    if (freq > 12000) freq = 12000;
    if (volume < 0) volume = 0;
    if (volume > 127) volume = 127;
    duty &= 7;

    int h = claim(voice_index, duty);
    if (h < 0) return;

    if (voice[voice_index].duty != duty) {
        soundSetWaveDuty(h, kDuty[duty]);
        voice[voice_index].duty = duty;
    }
    if (voice[voice_index].freq != freq) {
        soundSetFreq(h, freq);
        voice[voice_index].freq = freq;
    }
    if (voice[voice_index].volume != volume) {
        soundSetVolume(h, volume);
        voice[voice_index].volume = volume;
    }
}

void plat_sound_stop(int voice_index) {
    if (voice_index < 0 || voice_index >= VOICES) return;
    int h = voice[voice_index].handle;
    if (h < 0) return;                  /* never claimed: nothing to silence */
    if (voice[voice_index].volume) {
        soundSetVolume(h, 0);
        voice[voice_index].volume = 0;
    }
}
