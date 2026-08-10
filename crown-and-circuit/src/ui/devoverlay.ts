import { Container, Graphics, Text } from 'pixi.js';
import type { Ctx } from '../core/game';
import { FONT_UI } from '../assets/fonts';
import { Btn } from './button';

/**
 * Dev overlay, opened by 5 quick taps in the top-left corner: FPS, frame
 * time, draw calls, live pool counts, squad — plus jump-to-stage buttons,
 * a coin grant, and a turbo toggle for soak testing.
 */
export class DevOverlay {
  private root = new Container();
  private stats: Text | null = null;
  private open = false;
  private built = false;
  private timer = 0;
  private drawCalls = 0;
  private frameDraws = 0;
  private glPatched = false;

  constructor(private ctx: Ctx) {
    this.root.zIndex = 900;
    this.root.visible = false;
    ctx.ui.addChild(this.root);
    ctx.input.onDevGesture = () => this.toggle(!this.open);
    ctx.app.ticker.add(() => this.tick());
  }

  /** UI is built lazily on first open — the atlas doesn't exist until the
   *  boot scene finishes, and the gesture is meaningless before that. */
  private build(): void {
    this.built = true;
    const ctx = this.ctx;
    const bg = new Graphics();
    bg.roundRect(10, 90, 300, 470, 14).fill({ color: 0x000000, alpha: 0.82 });
    bg.eventMode = 'static';
    this.root.addChild(bg);

    this.stats = new Text({
      text: '',
      style: { fontFamily: FONT_UI, fontSize: 13, fill: 0x8ef58e, lineHeight: 19 },
    });
    this.stats.position.set(26, 104);
    this.root.addChild(this.stats);

    const restart = new Btn(ctx, {
      w: 120, h: 44, kind: 'blue', label: 'restart run', labelSize: 14, silent: true,
      onTap: () => { this.toggle(false); ctx.router.goto('run'); },
    });
    restart.position.set(84, 330);
    const title = new Btn(ctx, {
      w: 120, h: 44, kind: 'blue', label: 'title', labelSize: 14, silent: true,
      onTap: () => { this.toggle(false); ctx.router.goto('title'); },
    });
    title.position.set(220, 330);
    const shop = new Btn(ctx, {
      w: 120, h: 44, kind: 'blue', label: 'war table', labelSize: 14, silent: true,
      onTap: () => { this.toggle(false); ctx.router.goto('shop'); },
    });
    shop.position.set(84, 384);
    const shards = new Btn(ctx, {
      w: 120, h: 44, kind: 'dark', label: '+2000 shards', labelSize: 12, silent: true,
      onTap: () => { ctx.save.data.shards += 2000; ctx.save.mark(); },
    });
    shards.position.set(220, 384);
    this.root.addChild(restart, title, shop, shards);

    const coins = new Btn(ctx, {
      w: 120, h: 44, kind: 'dark', label: 'skip lull', labelSize: 14, silent: true,
      onTap: () => { (window as unknown as { __cc?: { skipLull?: () => void } }).__cc?.skipLull?.(); },
    });
    coins.position.set(84, 486);
    const turbo = new Btn(ctx, {
      w: 120, h: 44, kind: 'dark', label: 'turbo ×1', labelSize: 14, silent: true,
      onTap: () => {
        ctx.loop.turbo = ctx.loop.turbo > 1 ? 1 : 8;
        turbo.setLabel(`turbo ×${ctx.loop.turbo}`);
      },
    });
    turbo.position.set(220, 486);
    const close = new Btn(ctx, {
      w: 64, h: 40, kind: 'dark', label: 'close', labelSize: 13, silent: true,
      onTap: () => this.toggle(false),
    });
    close.position.set(262, 116);
    this.root.addChild(coins, turbo, close);
  }

  private patchGl(): void {
    if (this.glPatched) return;
    this.glPatched = true;
    const gl = (this.ctx.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    if (!gl) return; // WebGPU path — draw calls read n/a
    const self = this;
    const de = gl.drawElements.bind(gl);
    const da = gl.drawArrays.bind(gl);
    gl.drawElements = function (...args: Parameters<WebGLRenderingContext['drawElements']>) {
      self.frameDraws++;
      return de(...args);
    };
    gl.drawArrays = function (...args: Parameters<WebGLRenderingContext['drawArrays']>) {
      self.frameDraws++;
      return da(...args);
    };
  }

  toggle(on: boolean): void {
    if (on && this.ctx.router.current === 'boot') return; // atlas not ready yet
    if (on && !this.built) this.build();
    this.open = on;
    this.root.visible = on;
    if (on) this.patchGl();
  }

  private tick(): void {
    if (this.open && this.stats) {
      this.drawCalls = this.frameDraws;
      this.timer += this.ctx.app.ticker.deltaMS;
      if (this.timer > 250) {
        this.timer = 0;
        const loop = this.ctx.loop;
        const gl = (this.ctx.app.renderer as unknown as { gl?: unknown }).gl;
        const pools = this.ctx.runStats?.() ?? {};
        const poolLines = Object.entries(pools).map(([k, v]) => `${k}: ${v}`).join('\n');
        this.stats.text =
          `fps: ${(1000 / Math.max(0.01, loop.avgFrameMs)).toFixed(0)}${loop.capped ? ' (capped 60)' : ''}\n` +
          `frame: ${loop.lastFrameMs.toFixed(2)} ms (avg ${loop.avgFrameMs.toFixed(2)})\n` +
          `draw calls: ${gl ? this.drawCalls : 'n/a (webgpu)'}\n` +
          `renderer: ${this.ctx.app.renderer.name}\n` +
          `play time: ${loop.playTime.toFixed(0)} s${loop.thermalSoften() ? ' (thermal soften)' : ''}\n` +
          (poolLines ? poolLines + '\n' : '') +
          `scene: ${this.ctx.router.current}`;
      }
    }
    this.frameDraws = 0;
  }
}
