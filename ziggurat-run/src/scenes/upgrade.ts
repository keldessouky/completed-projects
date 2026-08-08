import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG, type UpgradeKey } from '../config';
import { upgradeCost } from '../game/economy';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;
const KEYS: UpgradeKey[] = ['squad', 'rate', 'dmg', 'resist'];

/** The workshop: 4 permanent upgrade tracks, 5 levels each, priced by the
 *  CONFIG cost curve. Rebuilds in place after every purchase. */
export class UpgradeScene extends Scene {
  private coinNum!: NumberDisplay;
  private cards = new Container();

  enter(): void {
    const ctx = this.ctx;
    const sky = new Sprite(ctx.backdrops[1].sky);
    sky.anchor.set(0.5, 0);
    sky.position.set(W / 2, -240);
    sky.width = W + 480;
    sky.height = H + 480;
    this.container.addChild(sky);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    // sized to clear the close button at the right edge
    const title = displayText('TEMPLE WORKSHOP', 22, CONFIG.colors.bone, '900');
    title.position.set(W / 2 - 14, topY + 34);
    this.container.addChild(title);

    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5);
    coin.position.set(W / 2 - 34, topY + 70);
    this.coinNum = new NumberDisplay(ctx.atlas, 7, 0.52, CONFIG.colors.goldBright, 'left');
    this.coinNum.position.set(W / 2 - 14, topY + 70);
    this.container.addChild(coin, this.coinNum);

    const back = new Btn(ctx, {
      w: 56, h: 56, kind: 'dark', icon: 'iconClose',
      onTap: () => ctx.router.goto('map'),
    });
    back.position.set(W - 48, topY + 40);
    this.container.addChild(back);

    this.container.addChild(this.cards);
    this.rebuild(topY);
  }

  private rebuild(topY: number): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    this.cards.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.coinNum.set(String(save.coins));

    const cardH = 118;
    KEYS.forEach((key, i) => {
      const track = CONFIG.economy.upgrades[key];
      const level = save.upgrades[key];
      const cost = upgradeCost(key, level);
      const y = topY + 158 + i * (cardH + 16);

      const card = new Container();
      card.position.set(W / 2, y);
      card.addChild(panel(ctx, W - 44, cardH));

      const name = displayText(track.name.toUpperCase(), 19, CONFIG.colors.gold, '700');
      name.anchor.set(0, 0.5);
      name.position.set(-(W - 44) / 2 + 22, -32);
      const desc = uiText(track.desc, 14, CONFIG.colors.boneDim);
      desc.anchor.set(0, 0.5);
      desc.position.set(-(W - 44) / 2 + 22, -6);
      card.addChild(name, desc);

      // level pips
      const pips = new Graphics();
      for (let p = 0; p < CONFIG.economy.maxLevel; p++) {
        const px = -(W - 44) / 2 + 24 + p * 30;
        pips.roundRect(px, 20, 22, 12, 5).fill(
          p < level ? CONFIG.colors.gold : CONFIG.colors.bitumenLift,
        ).stroke({ color: CONFIG.colors.boneDim, width: 1.2, alpha: 0.7 });
      }
      card.addChild(pips);

      if (cost === null) {
        const max = displayText('MAX', 20, CONFIG.colors.goodTeal, '700');
        max.position.set((W - 44) / 2 - 70, 0);
        card.addChild(max);
      } else {
        const afford = save.coins >= cost;
        const buy = new Btn(ctx, {
          w: 116, h: 64, kind: afford ? 'gold' : 'dark', silent: true,
          onTap: () => this.buy(key, cost, topY),
        });
        buy.position.set((W - 44) / 2 - 70, 0);
        const bc = new Sprite(ctx.atlas.get('coin'));
        bc.anchor.set(0.5);
        bc.scale.set(0.8);
        bc.position.set(-32, 0);
        const cn = new NumberDisplay(ctx.atlas, 5, 0.42, afford ? CONFIG.colors.bitumen : CONFIG.colors.boneDim, 'left');
        cn.position.set(-16, 0);
        cn.set(String(cost));
        buy.addChild(bc, cn);
        buy.setEnabled(afford);
        card.addChild(buy);
      }
      this.cards.addChild(card);
    });

    const hint = uiText('Coins come home from every run — win or lose.', 13, CONFIG.colors.boneDim);
    hint.position.set(W / 2, topY + 158 + 4 * (cardH + 16) + 6);
    this.cards.addChild(hint);

    // a full-width way out at the bottom of the thumb's reach, not just the corner X
    const back = new Btn(this.ctx, {
      w: 300, h: 62, kind: 'blue', label: 'Back to the Map', labelSize: 19,
      onTap: () => this.ctx.router.goto('map'),
    });
    back.position.set(W / 2, H - Math.max(this.ctx.scaler.safeBottom(), 10) - 54);
    this.cards.addChild(back);
  }

  private buy(key: UpgradeKey, cost: number, topY: number): void {
    const save = this.ctx.save.data;
    if (save.coins < cost || save.upgrades[key] >= CONFIG.economy.maxLevel) return;
    save.coins -= cost;
    save.upgrades[key] += 1;
    this.ctx.save.mark();
    this.ctx.audio.play('upgrade');
    this.rebuild(topY);
  }
}
