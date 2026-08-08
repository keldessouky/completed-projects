import { Container, Graphics, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { Ctx } from '../core/game';
import type { CardDef } from '../types';
import { Btn } from './button';
import { displayText, HSlider, panel, Toggle, uiText } from './widgets';

/** Full-screen input-eating dim, sized to the current viewport. */
function dim(ctx: Ctx, alpha = 0.66): Graphics {
  const g = new Graphics();
  g.rect(-2000, -2000, ctx.camera.uiW + 4000, ctx.camera.uiH + 4000)
    .fill({ color: CONFIG.colors.bg, alpha });
  g.eventMode = 'static';
  return g;
}

class Overlay {
  root = new Container();
  private prevPaused: boolean;

  constructor(protected ctx: Ctx, z: number) {
    this.prevPaused = ctx.loop.paused;
    ctx.loop.paused = true;
    this.root.zIndex = z;
    ctx.overlays.addChild(this.root);
  }

  close(unpause = false): void {
    this.ctx.loop.paused = unpause ? false : this.prevPaused;
    this.root.destroy({ children: true });
  }
}

export interface PauseOpts {
  onRestart: () => void;
  onQuit: () => void;
}

export function showPause(ctx: Ctx, opts: PauseOpts): void {
  const o = new Overlay(ctx, 600);
  const W = ctx.camera.uiW;
  const H = ctx.camera.uiH;
  o.root.addChild(dim(ctx));
  const p = panel(ctx, 320, 400);
  p.position.set(W / 2 - 160, H / 2 - 200);
  o.root.addChild(p);

  const title = displayText('THE LINE HOLDS', 24, CONFIG.colors.gold, '900');
  title.position.set(W / 2, H / 2 - 150);
  o.root.addChild(title);

  const mk = (y: number, label: string, kind: 'gold' | 'blue' | 'dark', onTap: () => void): void => {
    const b = new Btn(ctx, { w: 250, h: 60, kind, label, labelSize: 19, onTap });
    b.position.set(W / 2, y);
    o.root.addChild(b);
  };
  mk(H / 2 - 76, 'Resume', 'gold', () => o.close(true));
  mk(H / 2 - 4, 'Restart Run', 'blue', () => { o.close(true); opts.onRestart(); });
  mk(H / 2 + 68, 'Settings', 'dark', () => showSettings(ctx));
  mk(H / 2 + 140, 'Abandon Run', 'dark', () => { o.close(true); opts.onQuit(); });
}

export function showSettings(ctx: Ctx): void {
  const o = new Overlay(ctx, 700);
  const W = ctx.camera.uiW;
  const H = ctx.camera.uiH;
  o.root.addChild(dim(ctx, 0.88));
  const p = panel(ctx, 356, 580);
  p.position.set(W / 2 - 178, H / 2 - 290);
  o.root.addChild(p);

  const title = displayText('SETTINGS', 26, CONFIG.colors.ink, '900');
  title.position.set(W / 2 - 14, H / 2 - 240);
  const close = new Btn(ctx, { w: 50, h: 50, kind: 'dark', icon: 'iClose', onTap: () => o.close() });
  close.position.set(W / 2 + 140, H / 2 - 242);
  o.root.addChild(title, close);

  const s = ctx.save.data.settings;
  let y = H / 2 - 172;
  const row = (label: string): number => {
    const t = uiText(label, 16, CONFIG.colors.inkDim, '600');
    t.anchor.set(0, 0.5);
    t.position.set(W / 2 - 140, y);
    o.root.addChild(t);
    const at = y;
    y += 76;
    return at;
  };

  const musicY = row('Music volume');
  const music = new HSlider(ctx, 180, s.music, (v) => { s.music = v; ctx.applySettings(); });
  music.position.set(W / 2, musicY + 30);
  const sfxY = row('Effects volume');
  const sfx = new HSlider(ctx, 180, s.sfx, (v) => { s.sfx = v; ctx.applySettings(); }, () => ctx.audio.play('sfxCoin'));
  sfx.position.set(W / 2, sfxY + 30);
  const shakeY = row('Screen shake');
  const shake = new HSlider(ctx, 180, s.shake, (v) => { s.shake = v; ctx.applySettings(); }, () => ctx.fx.shake(10));
  shake.position.set(W / 2, shakeY + 30);
  o.root.addChild(music, sfx, shake);

  const hapY = row('Haptics');
  const hap = new Toggle(ctx, s.haptics, (v) => { s.haptics = v; ctx.applySettings(); ctx.haptics.tap(20); });
  hap.position.set(W / 2 + 108, hapY);
  y -= 22;
  const rmY = row('Reduce motion');
  const note = uiText('kills shake & slow-mo', 12, CONFIG.colors.inkDim);
  note.anchor.set(0, 0.5);
  note.position.set(W / 2 - 140, rmY + 19);
  const rm = new Toggle(ctx, s.reducedMotion, (v) => { s.reducedMotion = v; ctx.applySettings(); });
  rm.position.set(W / 2 + 108, rmY);
  o.root.addChild(hap, note, rm);

  const reset = new Btn(ctx, {
    w: 250, h: 54, kind: 'dark', label: 'Reset Progress', labelSize: 17, labelColor: CONFIG.colors.bad,
    onTap: () => showConfirm(ctx, {
      title: 'RAZE IT ALL?',
      body: 'Shards, upgrades and records are erased. Settings survive.',
      yesLabel: 'Erase',
      onYes: () => { ctx.save.reset(); o.close(true); ctx.router.goto('title'); },
    }),
  });
  reset.position.set(W / 2, y + 16);
  o.root.addChild(reset);
}

export interface ConfirmOpts {
  title: string;
  body: string;
  yesLabel: string;
  onYes: () => void;
}

export function showConfirm(ctx: Ctx, opts: ConfirmOpts): void {
  const o = new Overlay(ctx, 800);
  const W = ctx.camera.uiW;
  const H = ctx.camera.uiH;
  o.root.addChild(dim(ctx, 0.8));
  const p = panel(ctx, 340, 290);
  p.position.set(W / 2 - 170, H / 2 - 145);
  o.root.addChild(p);
  const title = displayText(opts.title, 21, CONFIG.colors.bad, '900');
  title.position.set(W / 2, H / 2 - 92);
  const body = uiText(opts.body, 15, CONFIG.colors.ink, '400', 280);
  body.position.set(W / 2, H / 2 - 24);
  o.root.addChild(title, body);
  const yes = new Btn(ctx, {
    w: 130, h: 56, kind: 'dark', label: opts.yesLabel, labelColor: CONFIG.colors.bad, labelSize: 18,
    onTap: () => { o.close(); opts.onYes(); },
  });
  yes.position.set(W / 2 - 72, H / 2 + 78);
  const no = new Btn(ctx, {
    w: 130, h: 56, kind: 'gold', label: 'Keep', labelSize: 18, onTap: () => o.close(),
  });
  no.position.set(W / 2 + 72, H / 2 + 78);
  o.root.addChild(yes, no);
}

/**
 * Between-wave card picker. Pauses the sim, deals three cards face-down and
 * flips them in, then applies the chosen one and resumes.
 */
export function showCards(ctx: Ctx, cards: CardDef[]): void {
  const o = new Overlay(ctx, 750);
  const W = ctx.camera.uiW;
  const H = ctx.camera.uiH;
  o.root.addChild(dim(ctx, 0.72));

  const era = ctx.save.data.bestEra;
  void era;
  const title = displayText('SPOILS OF THE WAVE', 22, CONFIG.colors.gold, '900');
  title.position.set(W / 2, H / 2 - 190);
  const sub = uiText('Choose one', 14, CONFIG.colors.inkDim);
  sub.position.set(W / 2, H / 2 - 162);
  o.root.addChild(title, sub);

  const cw = Math.min(150, (W - 60) / cards.length - 10);
  const ch = 210;
  cards.forEach((card, i) => {
    const wrap = new Container();
    wrap.position.set(W / 2 + (i - (cards.length - 1) / 2) * (cw + 14), H / 2 - 20);
    const bg = panel(ctx, cw, ch);
    const icon = new Sprite(ctx.atlas.get(card.icon));
    icon.anchor.set(0.5);
    icon.tint = CONFIG.colors.gold;
    icon.position.set(0, -62);
    const name = uiText(card.title, 15, CONFIG.colors.ink, '800', cw - 18);
    name.position.set(0, -12);
    const body = uiText(card.body, 13, CONFIG.colors.inkDim, '400', cw - 18);
    body.position.set(0, 26);
    const take = new Btn(ctx, {
      w: cw - 22, h: 42, kind: 'gold', label: 'Take', labelSize: 15,
      onTap: () => { card.apply(); ctx.audio.play('sfxBuild', { vol: 0.5 }); o.close(true); },
    });
    take.position.set(0, ch / 2 - 30);
    wrap.addChild(bg, icon, name, body, take);
    o.root.addChild(wrap);

    // deal-in
    wrap.alpha = 0;
    wrap.y += 26;
    const st = { a: 0, y: wrap.y };
    const tw = new Tween(st)
      .to({ a: 1, y: H / 2 - 20 }, 240)
      .delay(i * 70)
      .easing(Easing.Quadratic.Out)
      .onUpdate(() => { wrap.alpha = st.a; wrap.y = st.y; })
      .start(performance.now());
    ctx.tweens.add(tw);
  });
}
