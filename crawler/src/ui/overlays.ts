import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import type { Ctx } from '../core/game';
import { Btn } from './button';
import { displayText, HSlider, panel, Toggle, uiText } from './widgets';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/** full-screen input-eating dim */
function dim(alpha = 0.62): Graphics {
  const g = new Graphics();
  g.rect(-60, -60, W + 120, H + 120).fill({ color: CONFIG.colors.ink, alpha });
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
    ctx.root.addChild(this.root);
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

/** Pause: resume / restart / settings / quit to map. */
export function showPause(ctx: Ctx, opts: PauseOpts): void {
  const o = new Overlay(ctx, 600);
  o.root.addChild(dim());
  const p = panel(ctx, 320, 434);
  p.position.set(W / 2 - 160, H / 2 - 217);
  o.root.addChild(p);

  const title = displayText('THE RUN WAITS', 26, CONFIG.colors.amber, '900');
  title.position.set(W / 2, H / 2 - 158);
  o.root.addChild(title);

  const mk = (y: number, label: string, kind: 'gold' | 'blue' | 'dark', onTap: () => void): Btn => {
    const b = new Btn(ctx, { w: 252, h: 62, kind, label, labelSize: 21, onTap });
    b.position.set(W / 2, y);
    o.root.addChild(b);
    return b;
  };
  mk(H / 2 - 84, 'Resume', 'gold', () => o.close(true));
  mk(H / 2 - 8, 'Restart Stage', 'blue', () => { o.close(true); opts.onRestart(); });
  mk(H / 2 + 68, 'Settings', 'dark', () => showSettings(ctx));
  mk(H / 2 + 144, 'Quit to Map', 'dark', () => { o.close(true); opts.onQuit(); });
}

/** Settings sheet — usable from the map and from inside a paused run. */
export function showSettings(ctx: Ctx): void {
  const o = new Overlay(ctx, 700);
  o.root.addChild(dim(0.88));
  const p = panel(ctx, 356, 604);
  p.position.set(W / 2 - 178, H / 2 - 302);
  o.root.addChild(p);

  const title = displayText('SETTINGS', 28, CONFIG.colors.bone, '900');
  title.position.set(W / 2, H / 2 - 250);
  o.root.addChild(title);

  const close = new Btn(ctx, {
    w: 52, h: 52, kind: 'dark', icon: 'iconClose', onTap: () => o.close(),
  });
  close.position.set(W / 2 + 142, H / 2 - 252);
  o.root.addChild(close);

  const s = ctx.save.data.settings;
  let y = H / 2 - 178;
  const row = (label: string): number => {
    const t = uiText(label, 17, CONFIG.colors.boneDim, '600');
    t.anchor.set(0, 0.5);
    t.position.set(W / 2 - 138, y);
    o.root.addChild(t);
    const rowY = y;
    y += 78;
    return rowY;
  };

  const musicY = row('Music volume');
  const music = new HSlider(ctx, 180, s.music, (v) => { s.music = v; ctx.applySettings(); });
  music.position.set(W / 2, musicY + 32);
  o.root.addChild(music);
  y += 4;

  const sfxY = row('Effects volume');
  const sfx = new HSlider(ctx, 180, s.sfx, (v) => { s.sfx = v; ctx.applySettings(); }, () => ctx.audio.play('doorGood'));
  sfx.position.set(W / 2, sfxY + 32);
  o.root.addChild(sfx);
  y += 4;

  const shakeY = row('Screen shake');
  const shake = new HSlider(ctx, 180, s.shake, (v) => { s.shake = v; ctx.applySettings(); }, () => ctx.fx.shake(10));
  shake.position.set(W / 2, shakeY + 32);
  o.root.addChild(shake);
  y += 4;

  const hapY = row('Haptics');
  const hap = new Toggle(ctx, s.haptics, (v) => { s.haptics = v; ctx.applySettings(); ctx.haptics.hurt(); });
  hap.position.set(W / 2 + 106, hapY);
  o.root.addChild(hap);
  y -= 24;

  const rmY = row('Reduce motion');
  const rmNote = uiText('kills shake & slow-mo', 12, CONFIG.colors.boneDim);
  rmNote.anchor.set(0, 0.5);
  rmNote.position.set(W / 2 - 138, rmY + 20);
  const rm = new Toggle(ctx, s.reducedMotion, (v) => { s.reducedMotion = v; ctx.applySettings(); });
  rm.position.set(W / 2 + 106, rmY);
  o.root.addChild(rmNote, rm);
  y += 6;

  const reset = new Btn(ctx, {
    w: 252, h: 56, kind: 'dark', label: 'Reset Progress', labelSize: 18,
    labelColor: CONFIG.colors.hpRedBright,
    onTap: () => showConfirm(ctx, {
      title: 'BREAK THE TABLETS?',
      body: 'All stars, coins, upgrades and unlocks will be erased. Settings survive.',
      yesLabel: 'Erase',
      onYes: () => {
        ctx.save.resetProgress();
        o.close(true);
        ctx.router.goto('title');
      },
    }),
  });
  reset.position.set(W / 2, y + 10);
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
  o.root.addChild(dim(0.75));
  const p = panel(ctx, 340, 300);
  p.position.set(W / 2 - 170, H / 2 - 150);
  o.root.addChild(p);

  const title = displayText(opts.title, 22, CONFIG.colors.hpRedBright, '900');
  title.position.set(W / 2, H / 2 - 96);
  const body = uiText(opts.body, 16, CONFIG.colors.bone, '400', 280);
  body.position.set(W / 2, H / 2 - 26);
  o.root.addChild(title, body);

  const yes = new Btn(ctx, {
    w: 132, h: 58, kind: 'dark', label: opts.yesLabel, labelColor: CONFIG.colors.hpRedBright, labelSize: 19,
    onTap: () => { o.close(); opts.onYes(); },
  });
  yes.position.set(W / 2 - 74, H / 2 + 82);
  const no = new Btn(ctx, {
    w: 132, h: 58, kind: 'gold', label: 'Keep', labelSize: 19,
    onTap: () => o.close(),
  });
  no.position.set(W / 2 + 74, H / 2 + 82);
  o.root.addChild(yes, no);
}
