import { Container, Graphics, Text } from 'pixi.js';
import { CONFIG, GEAR_SLOTS, type GearTier } from '../config';
import { NPC, SYS } from '../flavour';
import { checkAchievements, announce } from '../game/achievements';
import { gearEffect, gearValue, makeGear, sellValue } from '../game/loot';
import * as stats from '../game/stats';
import type { GearItem } from '../types';
import { Btn } from '../ui/button';
import { displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';
import { TIER_COLOR } from './inventory';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/** Stock is rolled once per visit from the player's level, so it stays relevant. */
function rollStock(level: number, seed: number): GearItem[] {
  let a = seed >>> 0;
  const rand = (): number => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tiers: GearTier[] = ['solid', 'fine', 'solid', 'prime'];
  return GEAR_SLOTS.map((slot, i) => makeGear(slot, tiers[i % tiers.length], level, rand))
    .concat(makeGear('weapon', 'fine', level, rand));
}

/**
 * The vendor.
 *
 * Buying and selling share one screen because they are the same decision seen
 * from two sides: gold you have versus gold an item is worth. CHA moves the
 * asking price, which is the only place in the game a social stat does
 * anything, so it is shown explicitly rather than folded in silently.
 */
export class ShopScene extends Scene {
  private list = new Container();
  private goldText!: Text;
  private stock: GearItem[] = [];
  private mode: 'buy' | 'sell' = 'buy';

  enter(): void {
    const ctx = this.ctx;
    const ws = ctx.world;
    if (!ws) { ctx.router.goto('title'); return; }

    // one roll per visit, keyed to level and gold so it is stable while open
    this.stock = rollStock(ctx.save.data.level, ctx.save.data.level * 7919 + ws.discovered.size * 131);

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText(NPC.quartermaster.name.toUpperCase(), 20, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 32);
    const flavour = uiText(NPC.quartermaster.greet[1], 11, CONFIG.colors.boneDim, '400', W - 60);
    flavour.position.set(W / 2, topY + 56);
    this.container.addChild(title, flavour);

    this.goldText = uiText('', 14, CONFIG.colors.amberBright, '600');
    this.goldText.position.set(W / 2, topY + 82);
    this.container.addChild(this.goldText);

    const tabY = topY + 112;
    const buyTab = new Btn(ctx, {
      w: 150, h: 46, kind: 'gold', label: 'Buy', labelSize: 16,
      onTap: () => { this.mode = 'buy'; this.rebuild(); },
    });
    buyTab.position.set(W / 2 - 82, tabY);
    const sellTab = new Btn(ctx, {
      w: 150, h: 46, kind: 'blue', label: 'Sell', labelSize: 16,
      onTap: () => { this.mode = 'sell'; this.rebuild(); },
    });
    sellTab.position.set(W / 2 + 82, tabY);
    this.container.addChild(buyTab, sellTab, this.list);

    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 38;
    const back = new Btn(ctx, {
      w: 200, h: 56, kind: 'dark', label: 'Leave', labelSize: 18,
      onTap: () => ctx.router.goto('world'),
    });
    back.position.set(W / 2, footY);
    this.container.addChild(back);

    this.rebuild();
    ctx.audio.music('musicTitle');
  }

  private rebuild(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    this.list.removeChildren().forEach((c) => c.destroy({ children: true }));

    const mult = stats.priceMult(save, ws.equipped);
    this.goldText.text = `${save.gold} gold` +
      (mult < 0.999 ? `  ·  ${Math.round((1 - mult) * 100)}% off` : '');

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    let y = topY + 158;
    const maxY = H - Math.max(ctx.scaler.safeBottom(), 10) - 80;

    const items = this.mode === 'buy' ? this.stock : [...ws.inventory].reverse();
    if (items.length === 0) {
      const empty = uiText(
        this.mode === 'buy' ? 'Sold out. Try me later.' : 'You have nothing I want.',
        12, CONFIG.colors.boneDim,
      );
      empty.position.set(W / 2, y + 10);
      this.list.addChild(empty);
      return;
    }

    for (const g of items) {
      if (y > maxY) break;
      const price = this.mode === 'buy' ? Math.max(1, Math.round(gearValue(g) * mult)) : sellValue(g);
      this.row(y, g, price);
      y += 58;
    }
  }

  private row(y: number, g: GearItem, price: number): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    const buying = this.mode === 'buy';
    const affordable = !buying || save.gold >= price;

    const wrap = new Container();
    wrap.position.set(W / 2, y);
    wrap.addChild(panel(ctx, W - 24, 52));

    const name = uiText(g.name, 14, TIER_COLOR[g.tier], '600');
    name.anchor.set(0, 0.5);
    name.position.set(-W / 2 + 20, -8);
    const eff = uiText(gearEffect(g), 10, CONFIG.colors.bone, '400');
    eff.anchor.set(0, 0.5);
    eff.position.set(-W / 2 + 20, 10);
    wrap.addChild(name, eff);

    const btn = new Btn(ctx, {
      w: 96, h: 42, kind: buying ? 'gold' : 'blue',
      label: `${buying ? 'Buy' : 'Sell'} ${price}`, labelSize: 12,
      onTap: () => {
        if (buying) {
          if (save.gold < price) {
            ctx.audio.play('doorBad', { vol: 0.5 });
            return;
          }
          save.gold -= price;
          ws.addGear(g);
          this.stock = this.stock.filter((s) => s.id !== g.id);
          ctx.system.push(SYS.bought(g.name), 'good');
        } else {
          if (!ws.removeGear(g.id)) return;
          save.gold += price;
          ctx.system.push(SYS.sold(g.name, price), 'good');
        }
        ctx.audio.play('coin', { vol: 0.7 });
        ctx.haptics.hit();
        for (const a of checkAchievements(save, ws)) ctx.system.push(announce(a), 'good');
        ctx.save.data.world = ws.toSave();
        ctx.save.mark();
        this.rebuild();
      },
    });
    btn.position.set(W / 2 - 70, 0);
    btn.setEnabled(affordable);
    wrap.addChild(btn);
    this.list.addChild(wrap);
  }
}
