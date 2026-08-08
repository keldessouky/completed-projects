import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG } from '../config';
import { chapterName } from '../game/stages';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { showSettings } from '../ui/overlays';
import { displayText, panel, StarsRow, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/** Chapter map: 12 stages across 3 chapter panels, sequential unlock,
 *  star ratings on every node, plus the doors to the workshop and settings. */
export class MapScene extends Scene {
  enter(): void {
    const ctx = this.ctx;
    const save = ctx.save.data;

    const sky = new Sprite(ctx.backdrops[Math.min(2, Math.floor(save.unlocked / 4))].sky);
    sky.anchor.set(0.5, 0);
    sky.position.set(W / 2, -240);
    sky.width = W + 480;
    sky.height = H + 480;
    this.container.addChild(sky);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText('THE ROAD TO THE CROWN', 24, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 34);
    this.container.addChild(title);

    // total stars
    const star = new Sprite(ctx.atlas.get('iconStar'));
    star.anchor.set(0.5);
    star.scale.set(0.62);
    star.tint = CONFIG.colors.gold;
    star.position.set(W / 2 - 30, topY + 66);
    const totStars = save.stars.reduce((a, b) => a + b, 0);
    const starNum = new NumberDisplay(ctx.atlas, 4, 0.5, CONFIG.colors.bone, 'left');
    starNum.position.set(W / 2 - 12, topY + 66);
    starNum.set(String(totStars));
    this.container.addChild(star, starNum);

    // three chapter panels
    const bandTop = topY + 92;
    const bandH = (H - bandTop - 132) / 3;
    for (let c = 2; c >= 0; c--) {
      // chapters stack bottom-up: the marsh at the bottom, the city crowning the map
      const py = bandTop + (2 - c) * bandH;
      this.chapterPanel(c, py, bandH - 14);
    }

    // footer: coins + workshop + settings
    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 56;
    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5);
    coin.position.set(40, footY);
    const coinNum = new NumberDisplay(ctx.atlas, 7, 0.52, CONFIG.colors.goldBright, 'left');
    coinNum.position.set(60, footY);
    coinNum.set(String(save.coins));
    this.container.addChild(coin, coinNum);

    const upBtn = new Btn(ctx, {
      w: 168, h: 60, kind: 'gold', label: 'Workshop', labelSize: 20,
      onTap: () => ctx.router.goto('upgrade'),
    });
    upBtn.position.set(W - 196, footY);
    const gear = new Btn(ctx, {
      w: 56, h: 56, kind: 'dark', icon: 'iconGear',
      onTap: () => showSettings(ctx),
    });
    gear.position.set(W - 48, footY);
    this.container.addChild(upBtn, gear);

    ctx.audio.music('musicTitle');
  }

  private chapterPanel(c: number, y: number, h: number): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    const wrap = new Container();
    wrap.position.set(W / 2, y + h / 2);
    const p = panel(ctx, W - 36, h);
    wrap.addChild(p);

    const done = [0, 1, 2, 3].every((s) => save.stars[c * 4 + s] > 0);
    const name = displayText(chapterName(c).toUpperCase(), 17, done ? CONFIG.colors.gold : CONFIG.colors.bone, '700');
    name.position.set(0, -h / 2 + 26);
    wrap.addChild(name);

    const chLocked = save.unlocked < c * 4;
    if (chLocked) {
      const lock = new Sprite(ctx.atlas.get('iconLock'));
      lock.anchor.set(0.5);
      lock.tint = CONFIG.colors.boneDim;
      lock.position.set(0, 8);
      const hint = uiText(`finish ${chapterName(c - 1)}`, 13, CONFIG.colors.boneDim);
      hint.position.set(0, 42);
      wrap.addChild(lock, hint);
      wrap.alpha = 0.75;
      this.container.addChild(wrap);
      return;
    }

    for (let s = 0; s < 4; s++) {
      const idx = c * 4 + s;
      const nx = -((W - 36) / 2) + 62 + s * ((W - 36 - 124) / 3);
      const node = this.stageNode(idx, save.unlocked >= idx, save.stars[idx]);
      node.position.set(nx, 14);
      wrap.addChild(node);
    }
    this.container.addChild(wrap);
  }

  private stageNode(idx: number, unlocked: boolean, stars: number): Container {
    const ctx = this.ctx;
    const node = new Container();
    if (unlocked) {
      const current = idx === ctx.save.data.unlocked;
      const b = new Btn(ctx, {
        w: 74, h: 74, kind: current ? 'gold' : 'blue',
        onTap: () => ctx.router.goto('run', { stage: idx }),
      });
      const num = new NumberDisplay(ctx.atlas, 2, 0.62, current ? CONFIG.colors.bitumen : CONFIG.colors.bone);
      num.position.set(0, -4);
      num.set(String(idx + 1));
      b.addChild(num);
      node.addChild(b);
      const row = new StarsRow(ctx, stars, 17, 3);
      row.position.set(0, 47);
      node.addChild(row);
      if (current) {
        // gently bob the frontier stage so the next step is obvious
        const ring = new Graphics();
        ring.roundRect(-42, -42, 84, 84, 18).stroke({ color: CONFIG.colors.goldBright, width: 3, alpha: 0.9 });
        node.addChildAt(ring, 0);
      }
    } else {
      const g = new Graphics();
      g.roundRect(-37, -37, 74, 74, 16).fill({ color: CONFIG.colors.bitumenLift, alpha: 0.9 })
        .stroke({ color: CONFIG.colors.boneDim, width: 1.5, alpha: 0.5 });
      const lock = new Sprite(ctx.atlas.get('iconLock'));
      lock.anchor.set(0.5);
      lock.scale.set(0.8);
      lock.tint = CONFIG.colors.boneDim;
      node.addChild(g, lock);
      node.alpha = 0.8;
    }
    return node;
  }
}
