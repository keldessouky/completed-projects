import { Container, Graphics, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import {
  CAST, CORP, GAME_SUBTITLE, GAME_TITLE, KEEP_NAME, SHOW, WORLD_NAME, WORLD_TAG,
} from '../flavour';
import { getFieldTexture } from '../assets/terrain';
import { Btn } from '../ui/button';
import { showConfirm, showSettings } from '../ui/overlays';
import { displayText, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export class TitleScene extends Scene {
  enter(): void {
    const ctx = this.ctx;
    const save = ctx.save.data;

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    // The whole field, drifting behind the title — it is the one image that
    // says "walk across this" before a single word does.
    const map = new Sprite(getFieldTexture());
    map.anchor.set(0.5);
    map.width = W * 1.7;
    map.height = W * 1.7 * (map.texture.height / map.texture.width);
    map.position.set(W / 2, H * 0.42);
    map.alpha = 0.34;
    this.container.addChild(map);
    const drift = { r: 0 };
    ctx.tweens.add(
      new Tween(drift).to({ r: Math.PI * 2 }, 90_000).repeat(Infinity)
        .onUpdate(() => {
          map.x = W / 2 + Math.cos(drift.r) * 18;
          map.y = H * 0.42 + Math.sin(drift.r * 0.7) * 14;
        })
        .start(performance.now()),
    );
    const vignette = new Graphics();
    vignette.rect(-40, -40, W + 80, H * 0.5).fill({ color: CONFIG.colors.ink, alpha: 0.55 });
    vignette.rect(-40, H * 0.55, W + 80, H * 0.6).fill({ color: CONFIG.colors.ink, alpha: 0.72 });
    this.container.addChild(vignette);

    const emblem = new Sprite(ctx.atlas.get('emblem'));
    emblem.anchor.set(0.5);
    emblem.scale.set(1.5);
    emblem.position.set(W / 2, H * 0.2);
    this.container.addChild(emblem);

    const title = displayText(GAME_TITLE, 60, CONFIG.colors.bone, '900');
    title.position.set(W / 2, H * 0.36);
    const sub = displayText(GAME_SUBTITLE.toUpperCase(), 18, CONFIG.colors.ally, '700');
    sub.position.set(W / 2, H * 0.415);
    const tag = uiText(`A ${CORP} production. ${SHOW}.`, 11, CONFIG.colors.boneDim);
    tag.position.set(W / 2, H * 0.45);
    this.container.addChild(title, sub, tag);

    const worldLine = uiText(`${WORLD_NAME} — ${WORLD_TAG}`, 11, CONFIG.colors.boneDim, '400', W - 60);
    worldLine.position.set(W / 2, H * 0.49);
    this.container.addChild(worldLine);

    // ── buttons ──
    const btns = new Container();
    let y = H * 0.62;
    const run = save.run;

    if (run) {
      this.button(btns, y, 'Continue', 'gold', () => this.start(false));
      const note = uiText(
        run.breached
          ? `${KEEP_NAME} is open · ${run.coins} coins`
          : `${run.squad} in the squad · ${run.coins} coins · ${run.cleared.length} camps cleared`,
        11, CONFIG.colors.boneDim,
      );
      note.position.set(W / 2, y + 40);
      btns.addChild(note);
      y += 100;
      this.button(btns, y, 'Muster Again', 'dark', () => {
        showConfirm(ctx, {
          title: 'Start over?',
          body: 'The field resets — camps refill, pads refill, and your squad goes home. Achievements are kept.',
          yesLabel: 'Start over',
          onYes: () => this.start(true),
        });
      });
    } else {
      this.button(btns, y, 'Take the Field', 'gold', () => this.start(true));
    }
    this.container.addChild(btns);

    // pulse the primary action so the entry point is never ambiguous
    const state = { a: 1 };
    ctx.tweens.add(
      new Tween(state).to({ a: 0.55 }, 1100).easing(Easing.Sinusoidal.InOut)
        .yoyo(true).repeat(Infinity)
        .onUpdate(() => { if (btns.children[0]) btns.children[0].alpha = state.a; })
        .start(performance.now()),
    );

    const stat = uiText(
      save.kills > 0
        ? `${save.kills} killed · biggest squad ${save.bestSquad} · ${save.totalRuns} musters`
        : `${CAST.hero}: ${CAST.heroTag}.`,
      12, CONFIG.colors.boneDim,
    );
    stat.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 12) - 18);
    stat.alpha = 0.75;
    this.container.addChild(stat);

    const gear = new Btn(ctx, { w: 56, h: 56, kind: 'dark', icon: 'iconGear', onTap: () => showSettings(ctx) });
    gear.position.set(W - 44, Math.max(ctx.scaler.safeTop(), 12) + 40);
    this.container.addChild(gear);

    ctx.audio.music('musicTitle');
  }

  private button(parent: Container, y: number, label: string, kind: 'gold' | 'blue' | 'dark', onTap: () => void): void {
    const b = new Btn(this.ctx, { w: 262, h: 64, kind, label, labelSize: 20, onTap });
    b.position.set(W / 2, y);
    parent.addChild(b);
  }

  private start(fresh: boolean): void {
    const ctx = this.ctx;
    ctx.audio.play('uiTap');
    ctx.enterWorld(fresh);
  }
}
