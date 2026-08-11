import { Container, Graphics, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import { CLEAR_LINES, DEATH_LINES, floorName } from '../flavour';
import type { FloorOutcome } from '../types';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { displayText, panel, uiText } from '../ui/widgets';
import { clockText } from './encounter/hud';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Shared scaffolding: dark ground, a headline, a stat block, and the way out. */
abstract class EndScene extends Scene {
  protected out!: FloorOutcome;

  protected ground(): void {
    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.pit);
    this.container.addChild(bg);
  }

  /** A viewer counter, because the whole conceit is that this is televised. */
  protected broadcastBar(y: number, tint: number): void {
    const ctx = this.ctx;
    const wrap = new Container();
    wrap.position.set(W / 2, y);
    const dot = new Graphics();
    dot.circle(-96, 0, 4).fill(tint);
    const live = uiText('LIVE', 10, tint, '800');
    live.position.set(-76, 0);
    // A deterministic-ish number that still moves between runs: viewers scale
    // with what you actually did, so the show is reacting, not decorating.
    const viewers = 40_000 + this.out.kills * 1_370 + this.out.partyPeak * 2_100;
    const count = uiText(`${viewers.toLocaleString()} watching`, 11, CONFIG.colors.boneDim, '600');
    count.position.set(22, 0);
    wrap.addChild(dot, live, count);
    this.container.addChild(wrap);

    const st = { a: 1 };
    const tw = new Tween(st).to({ a: 0.25 }, 700).easing(Easing.Sinusoidal.InOut)
      .yoyo(true).repeat(Infinity).onUpdate(() => { dot.alpha = st.a; })
      .start(performance.now());
    ctx.tweens.add(tw);
  }

  /** Two columns of label/value rows inside a panel. */
  protected statBlock(y: number, rows: [string, string][]): void {
    const ctx = this.ctx;
    const h = 26 + rows.length * 30;
    const wrap = new Container();
    wrap.position.set(W / 2, y + h / 2);
    wrap.addChild(panel(ctx, W - 64, h));
    rows.forEach(([label, value], i) => {
      const ry = -h / 2 + 26 + i * 30;
      const l = uiText(label, 13, CONFIG.colors.boneDim, '400');
      l.anchor.set(0, 0.5);
      l.position.set(-W / 2 + 52, ry);
      const v = uiText(value, 15, CONFIG.colors.bone, '600');
      v.anchor.set(1, 0.5);
      v.position.set(W / 2 - 52, ry);
      wrap.addChild(l, v);
    });
    this.container.addChild(wrap);
  }

  protected achievements(y: number): number {
    if (this.out.newAchievements.length === 0) return y;
    const head = uiText('ACHIEVEMENTS UNLOCKED', 10, CONFIG.colors.amberBright, '800');
    head.position.set(W / 2, y);
    this.container.addChild(head);
    this.out.newAchievements.forEach((name, i) => {
      const t = uiText(name, 13, CONFIG.colors.amber, '600');
      t.position.set(W / 2, y + 20 + i * 20);
      this.container.addChild(t);
    });
    return y + 26 + this.out.newAchievements.length * 20;
  }

  protected exitButton(label: string, kind: 'gold' | 'blue'): void {
    const ctx = this.ctx;
    const b = new Btn(ctx, {
      w: 240, h: 64, kind, label, labelSize: 20,
      onTap: () => ctx.router.goto('title'),
    });
    b.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 10) - 56);
    this.container.addChild(b);
  }
}

/** Floor cleared: the stairs, the payout, and a grudging compliment. */
export class ClearScene extends EndScene {
  enter(data?: unknown): void {
    const ctx = this.ctx;
    this.out = data as FloorOutcome;
    if (!this.out) { ctx.router.goto('title'); return; }
    this.ground();

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const stairs = new Sprite(ctx.atlas.get('iconStairs'));
    stairs.anchor.set(0.5);
    stairs.scale.set(1.5);
    stairs.tint = CONFIG.colors.goodTeal;
    stairs.position.set(W / 2, topY + 66);
    this.container.addChild(stairs);

    const title = displayText('FLOOR CLEARED', 30, CONFIG.colors.goodTeal, '900');
    title.position.set(W / 2, topY + 126);
    const which = uiText(`Floor ${this.out.floor + 1} — ${floorName(this.out.floor)}`, 13, CONFIG.colors.boneDim);
    which.position.set(W / 2, topY + 152);
    const line = uiText(pick(CLEAR_LINES), 13, CONFIG.colors.bone, '600', W - 70);
    line.position.set(W / 2, topY + 180);
    this.container.addChild(title, which, line);

    this.broadcastBar(topY + 210, CONFIG.colors.goodTeal);

    // the clock left on the stairs is the headline number of a crawl
    const bigLabel = uiText('TIME REMAINING', 10, CONFIG.colors.boneDim, '600');
    bigLabel.position.set(W / 2, topY + 244);
    const big = new NumberDisplay(ctx.atlas, 5, 0.86, CONFIG.colors.amberBright);
    big.position.set(W / 2, topY + 278);
    big.set(clockText(this.out.timeLeft));
    this.container.addChild(bigLabel, big);

    let y = topY + 318;
    this.statBlock(y, [
      ['Party at the stairs', String(this.out.partyAtEnd)],
      ['Largest party', String(this.out.partyPeak)],
      ['Kills', String(this.out.kills)],
      ['Rooms cleared', `${this.out.nodesVisited} / ${this.out.nodesTotal}`],
      ['Gold earned', String(this.out.goldEarned)],
      ...(this.out.levelsGained > 0
        ? [['Levels gained', `+${this.out.levelsGained}`] as [string, string]]
        : []),
    ]);
    y += 26 + (5 + (this.out.levelsGained > 0 ? 1 : 0)) * 30 + 24;
    this.achievements(y);

    ctx.audio.music(null);
    ctx.audio.play('winJingle');
    ctx.haptics.bossBreach();
    this.exitButton('Continue', 'gold');
  }
}

/** Death: the announcers get the last word. */
export class DeathScene extends EndScene {
  enter(data?: unknown): void {
    const ctx = this.ctx;
    this.out = data as FloorOutcome;
    if (!this.out) { ctx.router.goto('title'); return; }
    this.ground();

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText('RUN TERMINATED', 30, CONFIG.colors.trapRedBright, '900');
    title.position.set(W / 2, topY + 92);
    const which = uiText(`Floor ${this.out.floor + 1} — ${floorName(this.out.floor)}`, 13, CONFIG.colors.boneDim);
    which.position.set(W / 2, topY + 118);
    this.container.addChild(title, which);

    // the diagnostic first, then the commentary — cause, then colour
    if (this.out.failReason) {
      const reason = uiText(this.out.failReason, 15, CONFIG.colors.bone, '600', W - 70);
      reason.position.set(W / 2, topY + 154);
      this.container.addChild(reason);
    }
    const quip = uiText(`"${pick(DEATH_LINES)}"`, 12, CONFIG.colors.boneDim, '400', W - 80);
    quip.position.set(W / 2, topY + 190);
    this.container.addChild(quip);

    this.broadcastBar(topY + 224, CONFIG.colors.trapRedBright);

    const y = topY + 258;
    this.statBlock(y, [
      ['Survived', clockText(this.out.elapsedSec)],
      ['Largest party', String(this.out.partyPeak)],
      ['Kills', String(this.out.kills)],
      ['Rooms cleared', `${this.out.nodesVisited} / ${this.out.nodesTotal}`],
      ['Gold salvaged', String(this.out.goldEarned)],
    ]);

    const consolation = uiText(
      'Levels and gold are yours to keep. The floor resets.',
      11, CONFIG.colors.boneDim, '400', W - 70,
    );
    consolation.position.set(W / 2, y + 26 + 5 * 30 + 34);
    this.container.addChild(consolation);

    ctx.audio.music(null);
    this.exitButton('Try Again', 'blue');
  }
}
