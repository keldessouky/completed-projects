import { Container, Graphics } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import { DEATH_LINES, RESPAWN_LINE, UI } from '../flavour';
import { poiById } from '../world/worldgen';
import { Btn } from '../ui/button';
import { displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Death.
 *
 * Open-world rules: it costs you gold and time, not the world. Everything you
 * discovered, cleared and looted is still yours, which is what makes wandering
 * somewhere obviously too dangerous a reasonable thing to try.
 */
export class DeathScene extends Scene {
  enter(data?: unknown): void {
    const ctx = this.ctx;
    const lost = (data as { lost?: number })?.lost ?? 0;
    const ws = ctx.world;

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText('YOU DIED', 36, CONFIG.colors.hpRedBright, '900');
    title.position.set(W / 2, H * 0.3);
    this.container.addChild(title);

    const quip = uiText(`"${pick(DEATH_LINES)}"`, 13, CONFIG.colors.boneDim, '400', W - 70);
    quip.position.set(W / 2, H * 0.3 + 40);
    this.container.addChild(quip);

    // ── the broadcast never stops ──
    const live = new Container();
    live.position.set(W / 2, H * 0.3 + 74);
    const dot = new Graphics();
    dot.circle(-70, 0, 4).fill(CONFIG.colors.hpRedBright);
    const liveText = uiText('LIVE', 10, CONFIG.colors.hpRedBright, '800');
    liveText.position.set(-50, 0);
    const viewers = 40_000 + ctx.save.data.kills * 1_370 + ctx.save.data.level * 8_800;
    const count = uiText(`${viewers.toLocaleString()} watching`, 11, CONFIG.colors.boneDim, '600');
    count.position.set(38, 0);
    live.addChild(dot, liveText, count);
    this.container.addChild(live);
    const st = { a: 1 };
    ctx.tweens.add(
      new Tween(st).to({ a: 0.25 }, 700).easing(Easing.Sinusoidal.InOut)
        .yoyo(true).repeat(Infinity).onUpdate(() => { dot.alpha = st.a; })
        .start(performance.now()),
    );

    // ── the bill ──
    const rows: [string, string][] = [
      ['Gold lost', `−${lost}`],
      ['Deaths', String(ctx.save.data.totalDeaths)],
      ['Kills so far', String(ctx.save.data.kills)],
      ['Level', String(ctx.save.data.level)],
    ];
    const h = 26 + rows.length * 30;
    const block = new Container();
    block.position.set(W / 2, H * 0.52 + h / 2);
    block.addChild(panel(ctx, W - 64, h));
    rows.forEach(([label, value], i) => {
      const ry = -h / 2 + 26 + i * 30;
      const l = uiText(label, 13, CONFIG.colors.boneDim, '400');
      l.anchor.set(0, 0.5);
      l.position.set(-W / 2 + 52, ry);
      const v = uiText(value, 15, CONFIG.colors.bone, '600');
      v.anchor.set(1, 0.5);
      v.position.set(W / 2 - 52, ry);
      block.addChild(l, v);
    });
    this.container.addChild(block);

    const home = ws ? poiById(ws.home) : null;
    const where = uiText(
      `${RESPAWN_LINE}${home ? ` (${home.name})` : ''}`,
      12, CONFIG.colors.boneDim, '400', W - 70,
    );
    where.position.set(W / 2, H * 0.52 + h + 34);
    this.container.addChild(where);

    const btn = new Btn(ctx, {
      w: 240, h: 64, kind: 'gold', label: UI.respawn, labelSize: 20,
      onTap: () => ctx.router.goto('world'),
    });
    btn.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 10) - 56);
    this.container.addChild(btn);

    void topY;
    ctx.audio.music(null);
  }
}
