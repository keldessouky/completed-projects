import { Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { GameAtlas } from '../assets/atlas';
import { getFieldTexture } from '../assets/terrain';
import { loadFonts } from '../assets/fonts';
import { CORP, GAME_TITLE } from '../flavour';
import { displayText, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/**
 * Loading screen with REAL progress: fonts → sprite atlas → backdrops →
 * audio sprite (fetched with byte-level progress) → done. After this scene
 * the game performs zero network requests.
 */
export class BootScene extends Scene {
  private barFill = new Graphics();
  private pct = uiText('0%', 15, CONFIG.colors.boneDim, '600');
  private mark = new Graphics();
  private t = 0;
  private ticking = true;

  enter(): void {
    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    // the show's mark, pulsing while the dungeon loads
    this.drawMark();
    this.mark.position.set(W / 2, H / 2 - 90);
    this.container.addChild(this.mark);

    const title = displayText(GAME_TITLE, 40, CONFIG.colors.bone, '900');
    title.position.set(W / 2, H / 2 + 24);
    this.container.addChild(title);

    const barBack = new Graphics();
    barBack.roundRect(W / 2 - 130, H / 2 + 74, 260, 14, 7)
      .fill(CONFIG.colors.inkLift)
      .stroke({ color: CONFIG.colors.boneDim, width: 1.5 });
    this.container.addChild(barBack, this.barFill);
    this.pct.position.set(W / 2, H / 2 + 112);
    this.container.addChild(this.pct);

    const pulse = (): void => {
      if (!this.ticking) return;
      this.t += 0.016;
      this.mark.alpha = 0.75 + Math.sin(this.t * 3.4) * 0.25;
      requestAnimationFrame(pulse);
    };
    pulse();

    void this.load();
  }

  private setProgress(f: number): void {
    const w = Math.max(0.02, Math.min(1, f)) * 252;
    this.barFill.clear();
    this.barFill.roundRect(W / 2 - 126, H / 2 + 77, Math.max(8, w), 8, 4).fill(CONFIG.colors.gold);
    this.pct.text = `${Math.round(f * 100)}%`;
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    try {
      // fonts must land before the atlas bakes its digit glyphs
      this.setProgress(0.02);
      await loadFonts();
      this.setProgress(0.16);

      const t0 = performance.now();
      ctx.atlas = GameAtlas.build();
      // surfaced on the debug object: the atlas is the single biggest thing
      // between a tap and a playable frame, so it is worth being able to see
      (window as unknown as Record<string, { atlasMs?: number }>).__cr
        && ((window as unknown as Record<string, { atlasMs?: number }>).__cr.atlasMs =
          Math.round(performance.now() - t0));
      // the System's achievement card is the one notification with artwork
      ctx.system.atlas = ctx.atlas;
      this.setProgress(0.30);
      // The world map thumbnail samples every biome across 5120 units; it is
      // the one terrain product worth paying for up front, because the title
      // screen and the minimap both want it immediately.
      getFieldTexture();
      this.setProgress(0.36);

      // Audio sprite with genuine byte progress (the heaviest asset).
      // A single-file host (see tools/build-single.mjs) can hand us a blob URL
      // for an already-embedded sprite instead of a path to fetch.
      const embedded = (window as unknown as { __CR_AUDIO__?: string }).__CR_AUDIO__;
      const url = embedded ?? `${import.meta.env.BASE_URL}assets/audio.wav`;
      let audioUrl = url;
      try {
        const res = await fetch(url);
        const total = Number(res.headers.get('content-length')) || 2_500_000;
        const reader = res.body?.getReader();
        if (reader) {
          const chunks: Uint8Array[] = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              got += value.length;
              this.setProgress(0.36 + 0.56 * Math.min(1, got / total));
            }
          }
          audioUrl = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'audio/wav' }));
        }
      } catch { /* fall back to letting Howler fetch it directly */ }
      await ctx.audio.load(audioUrl);
      this.setProgress(1);

      // hand over to the title after one painted frame at 100 %
      requestAnimationFrame(() => {
        this.ticking = false;
        ctx.router.goto('title');
      });
    } catch (err) {
      this.ticking = false;
      this.pct.text = `${CORP} regrets the interruption. Tap to retry.`;
      this.pct.style.fill = CONFIG.colors.hpRed;
      this.container.eventMode = 'static';
      this.container.once('pointertap', () => location.reload());
      console.error('boot failed', err);
    }
  }

  /** A stair going down: three treads and the dark at the bottom. */
  private drawMark(): void {
    const z = this.mark;
    z.clear();
    for (let i = 0; i < 3; i++) {
      const x = -54 + i * 36, y = -30 + i * 24;
      z.rect(x, y, 40, 9).fill(CONFIG.colors.bone);
      z.rect(x, y, 9, 24).fill(CONFIG.colors.boneDim);
    }
    z.rect(-54, 44, 112, 8).fill(CONFIG.colors.ally);
    z.rect(18, 18, 40, 26).fill(CONFIG.colors.ink);
  }
}
