import { Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import { Btn } from '../ui/button';
import { showSettings } from '../ui/overlays';
import { displayText, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export class TitleScene extends Scene {
  enter(): void {
    const ctx = this.ctx;
    const art = ctx.backdrops[0];

    const sky = new Sprite(art.sky);
    sky.anchor.set(0.5, 0);
    sky.position.set(W / 2, -240);
    sky.width = W + 480;
    sky.height = H + 480;
    const far = new Sprite(art.far);
    far.anchor.set(0.5, 1);
    far.position.set(W / 2, H + 40);
    far.alpha = 0.85;
    this.container.addChild(sky, far);

    const emblem = new Sprite(ctx.atlas.get('emblem'));
    emblem.anchor.set(0.5);
    emblem.scale.set(2.1);
    emblem.position.set(W / 2, H * 0.3);
    this.container.addChild(emblem);

    const title = displayText('ZIGGURAT\nRUN', 58, CONFIG.colors.bone, '900');
    title.position.set(W / 2, H * 0.49);
    const sub = uiText('Raise the levy. Read the glyphs. Breach the gate.', 15, CONFIG.colors.boneDim);
    sub.position.set(W / 2, H * 0.585);
    this.container.addChild(title, sub);

    const tap = displayText('TAP TO BEGIN', 22, CONFIG.colors.gold, '700');
    tap.position.set(W / 2, H * 0.72);
    this.container.addChild(tap);
    const state = { a: 1 };
    const tw = new Tween(state)
      .to({ a: 0.35 }, 900)
      .easing(Easing.Sinusoidal.InOut)
      .yoyo(true)
      .repeat(Infinity)
      .onUpdate(() => { tap.alpha = state.a; })
      .start(performance.now());
    ctx.tweens.add(tw);

    const runs = ctx.save.data.totalRuns;
    const ver = uiText(
      `v1.0 — ${runs > 0 ? `${runs} runs recorded` : 'a new tablet'}`,
      12, CONFIG.colors.boneDim,
    );
    ver.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 12) - 18);
    ver.alpha = 0.7;
    this.container.addChild(ver);

    const gear = new Btn(ctx, {
      w: 56, h: 56, kind: 'dark', icon: 'iconGear',
      onTap: () => showSettings(ctx),
    });
    gear.position.set(W - 44, Math.max(ctx.scaler.safeTop(), 12) + 40);
    this.container.addChild(gear);

    // tap anywhere advances (buttons stop propagation, so the gear is safe)
    this.container.eventMode = 'static';
    this.container.on('pointertap', () => {
      ctx.audio.play('uiTap');
      ctx.router.goto('map');
    });

    ctx.audio.music('musicTitle');
  }
}
