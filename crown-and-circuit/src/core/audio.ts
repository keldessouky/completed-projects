import { Howl, Howler } from 'howler';
import { CONFIG } from '../config';
import spriteData from '../generated/audio-sprites.json';

export type SfxName =
  | 'uiTap' | 'uiBack'
  | 'sfxBlade' | 'sfxMusket' | 'sfxRifle' | 'sfxMg' | 'sfxLaser'
  | 'sfxHit' | 'sfxKill' | 'sfxCoin' | 'sfxBuild' | 'sfxCrumble'
  | 'sfxKeepHit' | 'sfxHurt' | 'sfxDown' | 'sfxWave' | 'sfxEra' | 'sfxCard'
  | 'sfxWin' | 'sfxLose';
export type MusicName =
  | 'musicTitle' | 'musicIron' | 'musicPowder' | 'musicIndustry' | 'musicModern' | 'musicNeon';

/**
 * One Howl, one audio sprite file, all sounds. Howler handles the iOS
 * AudioContext unlock on first touch; we add throttling, music crossfade,
 * and settings-driven mix on top.
 */
export class AudioBus {
  private howl: Howl | null = null;
  private musicId = -1;
  private musicName: MusicName | null = null;
  private lastPlay: Record<string, number> = {};
  musicVol = 1; // user setting 0..1 (scaled by CONFIG.audio.musicVol)
  sfxVol = 1;

  /** Load the sprite; resolves when decodable (boot screen awaits this).
   *  The boot scene passes a blob: URL it fetched with byte progress. */
  load(url = `${import.meta.env.BASE_URL}assets/audio.wav`): Promise<void> {
    return new Promise((resolve) => {
      this.howl = new Howl({
        src: [url],
        format: ['wav'],
        sprite: spriteData.sprites as unknown as Record<string, [number, number] | [number, number, boolean]>,
        onload: () => resolve(),
        onloaderror: () => resolve(), // a silent game is better than a hung boot
      });
    });
  }

  /** Fire-and-forget SFX (music stings allowed) with optional throttle and rate variance. */
  play(name: SfxName | MusicName, opts?: { throttleMs?: number; rate?: number; vol?: number }): void {
    if (!this.howl) return;
    const now = performance.now();
    const throttle = opts?.throttleMs ?? 0;
    if (throttle > 0 && now - (this.lastPlay[name] ?? -1e9) < throttle) return;
    this.lastPlay[name] = now;
    const id = this.howl.play(name);
    const vol = (opts?.vol ?? 1) * this.sfxVol * CONFIG.audio.sfxVol;
    this.howl.volume(vol, id);
    const rate = opts?.rate ?? 1 + (Math.random() * 0.06 - 0.03);
    this.howl.rate(rate, id);
  }


  /** Crossfade to a music loop (or stop with `null`). */
  music(name: MusicName | null): void {
    if (!this.howl || this.musicName === name) return;
    const fade = CONFIG.audio.fadeMs;
    if (this.musicId >= 0) {
      const old = this.musicId;
      this.howl.fade(this.howl.volume(old) as number, 0, fade, old);
      const h = this.howl;
      setTimeout(() => h.stop(old), fade + 40);
      this.musicId = -1;
    }
    this.musicName = name;
    if (name) {
      const id = this.howl.play(name);
      const target = this.musicVol * CONFIG.audio.musicVol;
      this.howl.volume(0, id);
      this.howl.fade(0, target, fade, id);
      this.musicId = id;
    }
  }

  /** Settings changed: retune live music without restarting it. */
  applyVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.howl && this.musicId >= 0) {
      this.howl.volume(music * CONFIG.audio.musicVol, this.musicId);
    }
  }

  /** Global mute for phone calls / app switches (visibilitychange). */
  muteAll(muted: boolean): void {
    Howler.mute(muted);
  }
}
