import { Container, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { Ctx } from '../core/game';
import { stageName } from '../game/stages';
import { Btn } from '../ui/button';
import { NumberDisplay, RollingNumber } from '../ui/digits';
import { displayText, panel, uiText } from '../ui/widgets';
import type { RunOutcome } from '../types';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

function skyFor(ctx: Ctx, chapter: number): Sprite {
  const sky = new Sprite(ctx.backdrops[Math.min(2, chapter)].sky);
  sky.anchor.set(0.5, 0);
  sky.position.set(W / 2, -240);
  sky.width = W + 480;
  sky.height = H + 480;
  return sky;
}

function statRow(ctx: Ctx, y: number, label: string, value: string, tint: number = CONFIG.colors.bone): Container {
  const row = new Container();
  const l = uiText(label, 16, CONFIG.colors.boneDim, '600');
  l.anchor.set(0, 0.5);
  l.position.set(-132, 0);
  const v = new NumberDisplay(ctx.atlas, 6, 0.5, tint, 'right');
  v.position.set(138, 0);
  v.set(value);
  row.addChild(l, v);
  row.position.set(W / 2, y);
  return row;
}

/** Results: stars pop in one by one, coins count up, split retry/next. */
export class ResultsScene extends Scene {
  enter(data?: unknown): void {
    const out = data as RunOutcome;
    const ctx = this.ctx;
    const chapter = Math.floor(out.stage / CONFIG.stages.perChapter);
    this.container.addChild(skyFor(ctx, chapter));

    const p = panel(ctx, 360, 560);
    p.position.set(W / 2 - 180, H / 2 - 300);
    this.container.addChild(p);

    const head = displayText('THE GATE FALLS', 32, CONFIG.colors.gold, '900');
    head.position.set(W / 2, H / 2 - 240);
    const sub = uiText(stageName(out.stage), 15, CONFIG.colors.boneDim);
    sub.position.set(W / 2, H / 2 - 206);
    this.container.addChild(head, sub);

    // stars punch in one at a time
    const starsWrap = new Container();
    starsWrap.position.set(W / 2, H / 2 - 138);
    this.container.addChild(starsWrap);
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(ctx.atlas.get('iconStar'));
      s.anchor.set(0.5);
      s.position.set((i - 1) * 72, i === 1 ? -10 : 0);
      s.width = s.height = 58;
      const earned = i < out.stars;
      s.tint = earned ? CONFIG.colors.gold : CONFIG.colors.starEmpty;
      if (earned) {
        s.scale.set(0);
        const state = { k: 0 };
        const tw = new Tween(state)
          .to({ k: 1 }, 340)
          .delay(260 + i * 300)
          .easing(Easing.Back.Out)
          .onStart(() => ctx.audio.play('starPop', { rate: 1 + i * 0.12 }))
          .onUpdate(() => s.scale.set((state.k * 58) / s.texture.width))
          .start(performance.now());
        ctx.tweens.add(tw);
      }
      starsWrap.addChild(s);
    }

    this.container.addChild(statRow(ctx, H / 2 - 58, 'Squad at the gate', String(out.squadAtEnd)));
    if (out.newBestSquad) {
      const badge = displayText('NEW BEST', 14, CONFIG.colors.goodTeal, '700');
      badge.position.set(W / 2 + 96, H / 2 - 84);
      badge.rotation = 0.12;
      this.container.addChild(badge);
    }
    this.container.addChild(statRow(ctx, H / 2 - 16, 'Strongest march', String(out.squadPeak)));

    // coins count up
    const coinLabel = uiText('Coins earned', 16, CONFIG.colors.boneDim, '600');
    coinLabel.anchor.set(0, 0.5);
    coinLabel.position.set(W / 2 - 132, H / 2 + 26);
    const coinIcon = new Sprite(ctx.atlas.get('coin'));
    coinIcon.anchor.set(0.5);
    coinIcon.position.set(W / 2 + 66, H / 2 + 26);
    const coinNum = new RollingNumber(ctx.atlas, ctx.tweens, 6, 0.5, CONFIG.colors.goldBright, 900, 'right');
    coinNum.position.set(W / 2 + 138, H / 2 + 26);
    coinNum.snap(0);
    coinNum.roll(out.coinsEarned);
    this.container.addChild(coinLabel, coinIcon, coinNum);

    const bank = uiText(`treasury: ${ctx.save.data.coins}`, 13, CONFIG.colors.boneDim);
    bank.position.set(W / 2, H / 2 + 58);
    this.container.addChild(bank);

    // split button: retry | next (or the victory road after the last gate)
    const lastStage = out.stage === CONFIG.stages.count - 1;
    const retry = new Btn(ctx, {
      w: 150, h: 66, kind: 'dark', label: 'Retry', labelSize: 20,
      onTap: () => ctx.router.goto('run', { stage: out.stage }),
    });
    retry.position.set(W / 2 - 84, H / 2 + 130);
    const next = new Btn(ctx, {
      w: 150, h: 66, kind: 'gold', label: lastStage ? 'The Crown' : 'Next Stage', labelSize: 20,
      onTap: () => lastStage
        ? ctx.router.goto('victory', out)
        : ctx.router.goto('run', { stage: out.stage + 1 }),
    });
    next.position.set(W / 2 + 84, H / 2 + 130);
    const toMap = new Btn(ctx, {
      w: 318, h: 56, kind: 'blue', label: 'Back to the Map', labelSize: 18,
      onTap: () => ctx.router.goto('map'),
    });
    toMap.position.set(W / 2, H / 2 + 210);
    this.container.addChild(retry, next, toMap);

    ctx.audio.play('winJingle');
    ctx.audio.music('musicTitle');
  }
}

/** Fail: distinct look, one-line diagnostic, straight back into the fight. */
export class FailScene extends Scene {
  enter(data?: unknown): void {
    const out = data as RunOutcome;
    const ctx = this.ctx;
    const chapter = Math.floor(out.stage / CONFIG.stages.perChapter);
    const sky = skyFor(ctx, chapter);
    sky.tint = 0x8a6a6a; // the same land, gone cold
    this.container.addChild(sky);

    const p = panel(ctx, 360, 460);
    p.position.set(W / 2 - 180, H / 2 - 250);
    this.container.addChild(p);

    const head = displayText('THE LINE BROKE', 32, CONFIG.colors.trapRedBright, '900');
    head.position.set(W / 2, H / 2 - 188);
    this.container.addChild(head);

    // the one-line diagnostic: why you lost, in plain words
    const why = uiText(out.failReason, 17, CONFIG.colors.bone, '600', 300);
    why.position.set(W / 2, H / 2 - 116);
    this.container.addChild(why);

    this.container.addChild(statRow(ctx, H / 2 - 40, 'Strongest march', String(out.squadPeak)));
    this.container.addChild(
      statRow(ctx, H / 2 + 2, 'Salvaged coins', String(out.coinsEarned), CONFIG.colors.goldBright),
    );
    const hint = uiText('The workshop remembers every coin.', 13, CONFIG.colors.boneDim);
    hint.position.set(W / 2, H / 2 + 36);
    this.container.addChild(hint);

    const retry = new Btn(ctx, {
      w: 318, h: 68, kind: 'gold', label: 'March Again', labelSize: 21,
      onTap: () => ctx.router.goto('run', { stage: out.stage }),
    });
    retry.position.set(W / 2, H / 2 + 96);
    const toMap = new Btn(ctx, {
      w: 318, h: 56, kind: 'dark', label: 'Back to the Map', labelSize: 18,
      onTap: () => ctx.router.goto('map'),
    });
    toMap.position.set(W / 2, H / 2 + 172);
    this.container.addChild(retry, toMap);

    ctx.audio.music(null);
  }
}

/** Victory: the chapter-3 crown — a golden send-off with lifetime numbers. */
export class VictoryScene extends Scene {
  private motes: { sp: Sprite; vx: number; vy: number; vr: number }[] = [];
  private raf = 0;

  enter(): void {
    const ctx = this.ctx;
    this.container.addChild(skyFor(ctx, 2));

    const emblem = new Sprite(ctx.atlas.get('emblem'));
    emblem.anchor.set(0.5);
    emblem.scale.set(2.6);
    emblem.position.set(W / 2, H * 0.27);
    this.container.addChild(emblem);

    const head = displayText('THE CROWN\nIS YOURS', 44, CONFIG.colors.gold, '900');
    head.position.set(W / 2, H * 0.47);
    const sub = uiText('Marsh, steppe and city — every gate has fallen.', 15, CONFIG.colors.bone);
    sub.position.set(W / 2, H * 0.565);
    this.container.addChild(head, sub);

    const save = ctx.save.data;
    const stars = save.stars.reduce((a, b) => a + b, 0);
    const best = Math.max(...save.bestSquad);
    this.container.addChild(statRow(ctx, H * 0.64, 'Stars gathered', `${stars}`, CONFIG.colors.gold));
    this.container.addChild(statRow(ctx, H * 0.685, 'Greatest levy', String(best)));
    this.container.addChild(statRow(ctx, H * 0.73, 'Runs recorded', String(save.totalRuns)));

    const done = new Btn(ctx, {
      w: 318, h: 68, kind: 'gold', label: 'Return in Glory', labelSize: 21,
      onTap: () => ctx.router.goto('map'),
    });
    done.position.set(W / 2, H * 0.84);
    this.container.addChild(done);

    // slow golden rain — cheap, and stops with the scene
    const reduced = ctx.fx.reducedMotion();
    const n = reduced ? 14 : 40;
    for (let i = 0; i < n; i++) {
      const sp = new Sprite(ctx.atlas.get(i % 3 === 0 ? 'star4' : 'softDot'));
      sp.anchor.set(0.5);
      sp.tint = i % 2 === 0 ? CONFIG.colors.goldBright : CONFIG.colors.bone;
      sp.blendMode = 'add';
      sp.alpha = 0.7;
      sp.scale.set(0.5 + Math.random());
      sp.position.set(Math.random() * W, Math.random() * H);
      this.container.addChild(sp);
      this.motes.push({ sp, vx: (Math.random() - 0.5) * 18, vy: 24 + Math.random() * 42, vr: (Math.random() - 0.5) * 2 });
    }
    let last = performance.now();
    const tick = (): void => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const m of this.motes) {
        m.sp.x += m.vx * dt;
        m.sp.y += m.vy * dt;
        m.sp.rotation += m.vr * dt;
        if (m.sp.y > H + 20) { m.sp.y = -20; m.sp.x = Math.random() * W; }
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);

    ctx.audio.play('musicVictory'); // one-shot sting sprite
    ctx.haptics.bossBreach();
    setTimeout(() => ctx.audio.music('musicTitle'), 3400);
  }

  override exit(): void {
    cancelAnimationFrame(this.raf);
  }
}
