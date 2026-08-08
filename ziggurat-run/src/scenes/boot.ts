import { Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { GameAtlas } from '../assets/atlas';
import { buildBackdrops } from '../assets/backdrops';
import { loadFonts } from '../assets/fonts';
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
  private zig = new Graphics();
  private t = 0;
  private ticking = true;

  enter(): void {
    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.bitumen);
    this.container.addChild(bg);

    // ziggurat glyph, pulsing while we haul bricks
    this.drawZig(1);
    this.zig.position.set(W / 2, H / 2 - 90);
    this.container.addChild(this.zig);

    const title = displayText('ZIGGURAT RUN', 34, CONFIG.colors.bone, '900');
    title.position.set(W / 2, H / 2 + 24);
    this.container.addChild(title);

    const barBack = new Graphics();
    barBack.roundRect(W / 2 - 130, H / 2 + 74, 260, 14, 7)
      .fill(CONFIG.colors.bitumenLift)
      .stroke({ color: CONFIG.colors.boneDim, width: 1.5 });
    this.container.addChild(barBack, this.barFill);
    this.pct.position.set(W / 2, H / 2 + 112);
    this.container.addChild(this.pct);

    const pulse = (): void => {
      if (!this.ticking) return;
      this.t += 0.016;
      this.zig.alpha = 0.75 + Math.sin(this.t * 3.4) * 0.25;
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

      ctx.atlas = GameAtlas.build();
      this.setProgress(0.30);
      ctx.backdrops = buildBackdrops();
      this.setProgress(0.36);

      // Audio sprite with genuine byte progress (the heaviest asset).
      // A single-file host (see tools/build-single.mjs) can hand us a blob URL
      // for an already-embedded sprite instead of a path to fetch.
      const embedded = (window as unknown as { __ZR_AUDIO__?: string }).__ZR_AUDIO__;
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
      this.pct.text = 'The scribe dropped the tablets. Tap to retry.';
      this.pct.style.fill = CONFIG.colors.trapRed;
      this.container.eventMode = 'static';
      this.container.once('pointertap', () => location.reload());
      console.error('boot failed', err);
    }
  }

  private drawZig(_s: number): void {
    const z = this.zig;
    z.clear();
    z.rect(-66, 22, 132, 30).fill(CONFIG.colors.lapis);
    z.rect(-46, -6, 92, 26).fill(CONFIG.colors.ochre);
    z.rect(-26, -32, 52, 24).fill(CONFIG.colors.gold);
    z.rect(-8, -52, 16, 18).fill(CONFIG.colors.bone);
  }
}
