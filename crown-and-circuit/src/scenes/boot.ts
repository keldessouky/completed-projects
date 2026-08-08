import { Graphics, Text } from 'pixi.js';
import { CONFIG } from '../config';
import { GameAtlas } from '../assets/atlas';
import { buildTerrain } from '../assets/terrain';
import { applyArtPack } from '../assets/artpack';
import { FONT_CIRCUIT, FONT_CROWN, loadFonts } from '../assets/fonts';
import { uiText } from '../ui/widgets';
import { Scene } from './scene';

/**
 * Loading screen with real progress: fonts → atlas → terrain → audio sprite
 * (fetched with byte-level progress). After this the game makes no further
 * network requests.
 */
export class BootScene extends Scene {
  private bar = new Graphics();
  private bg = new Graphics();
  private pct!: Text;
  private crown!: Text;
  private circuit!: Text;

  enter(): void {
    const cam = this.ctx.camera;
    this.ui.addChild(this.bg, this.bar);

    this.crown = new Text({
      text: 'CROWN',
      style: { fontFamily: FONT_CROWN, fontSize: 40, fontWeight: '900', fill: CONFIG.colors.gold, letterSpacing: 3 },
    });
    this.crown.anchor.set(0.5);
    this.circuit = new Text({
      text: 'CIRCUIT',
      style: { fontFamily: FONT_CIRCUIT, fontSize: 34, fontWeight: '900', fill: 0x5cf5ff, letterSpacing: 4 },
    });
    this.circuit.anchor.set(0.5);
    this.pct = uiText('0%', 14, CONFIG.colors.inkDim, '600');
    this.ui.addChild(this.crown, this.circuit, this.pct);
    void cam;
    this.layout();
    void this.load();
  }

  override layout(): void {
    if (!this.pct) return;
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    this.bg.clear();
    this.bg.rect(0, 0, W, H).fill(CONFIG.colors.bg);
    this.crown.position.set(W / 2, H / 2 - 60);
    this.circuit.position.set(W / 2, H / 2 - 16);
    this.pct.position.set(W / 2, H / 2 + 66);
    this.drawBar(this.progress);
  }

  private progress = 0;
  private drawBar(f: number): void {
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    this.bar.clear();
    this.bar.roundRect(W / 2 - 120, H / 2 + 30, 240, 10, 5)
      .fill(CONFIG.colors.panel)
      .stroke({ color: CONFIG.colors.inkDim, width: 1.4, alpha: 0.7 });
    const w = Math.max(6, 232 * Math.max(0.02, Math.min(1, f)));
    this.bar.roundRect(W / 2 - 116, H / 2 + 33, w, 4, 2).fill(CONFIG.colors.gold);
  }

  private set(f: number): void {
    this.progress = f;
    this.drawBar(f);
    this.pct.text = `${Math.round(f * 100)}%`;
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    try {
      this.set(0.03);
      await loadFonts();
      this.set(0.16);
      ctx.atlas = GameAtlas.build();
      this.set(0.28);
      // optional drop-in art pack from public/art/ — absent by default
      await applyArtPack(ctx.atlas, import.meta.env.BASE_URL);
      this.set(0.32);
      ctx.terrain = buildTerrain();
      this.set(0.38);

      const url = `${import.meta.env.BASE_URL}assets/audio.wav`;
      const embedded = (window as unknown as { __CC_AUDIO__?: string }).__CC_AUDIO__;
      let audioUrl = embedded ?? url;
      if (!embedded) {
        try {
          const res = await fetch(url);
          const total = Number(res.headers.get('content-length')) || 3_200_000;
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
                this.set(0.38 + 0.55 * Math.min(1, got / total));
              }
            }
            audioUrl = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'audio/wav' }));
          }
        } catch { /* fall back to letting Howler fetch it */ }
      }
      await ctx.audio.load(audioUrl);
      this.set(1);

      requestAnimationFrame(() => ctx.router.goto('title'));
    } catch (err) {
      this.pct.text = 'The forge went cold. Tap to retry.';
      this.pct.style.fill = CONFIG.colors.bad;
      this.ui.eventMode = 'static';
      this.ui.once('pointertap', () => location.reload());
      console.error('boot failed', err);
    }
  }
}
