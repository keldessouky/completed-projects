import { Container, Graphics, Text } from 'pixi.js';
import { CONFIG, GEAR_SLOTS, type GearSlot, type GearTier } from '../config';
import { SLOT_NAME, UI } from '../flavour';
import { checkAchievements, announce } from '../game/achievements';
import { gearEffect, sellValue } from '../game/loot';
import * as stats from '../game/stats';
import type { GearItem } from '../types';
import { Btn } from '../ui/button';
import { displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export const TIER_COLOR: Record<GearTier, number> = {
  worn: CONFIG.colors.boneDim,
  solid: CONFIG.colors.goodTeal,
  fine: CONFIG.colors.sysBright,
  prime: CONFIG.colors.amberBright,
};

/**
 * The bag.
 *
 * Every item is one line: what it is, what it does, and the single button that
 * changes something. The equipped row sits at the top with the live derived
 * numbers under it, so swapping a weapon is a before/after you can read without
 * opening a second screen.
 */
export class InventoryScene extends Scene {
  private list = new Container();
  private summary!: Text;

  enter(): void {
    const ctx = this.ctx;
    const ws = ctx.world;
    if (!ws) { ctx.router.goto('title'); return; }

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText('EQUIPMENT', 24, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 34);
    this.container.addChild(title);

    this.summary = uiText('', 11, CONFIG.colors.sysBright, '600');
    this.summary.position.set(W / 2, topY + 58);
    this.container.addChild(this.summary);

    this.container.addChild(this.list);

    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 38;
    const back = new Btn(ctx, {
      w: 200, h: 56, kind: 'blue', label: 'Back', labelSize: 18,
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

    this.summary.text =
      `${Math.round(stats.damage(save, ws.equipped) * 10) / 10} dmg · ` +
      `${stats.maxHp(save, ws.equipped)} hp · ` +
      `${(1 / stats.attackInterval(save, ws.equipped)).toFixed(2)}/s`;

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    let y = topY + 92;

    // ── equipped ──
    for (const slot of GEAR_SLOTS) {
      const g = ws.equipped[slot];
      this.row(y, slot, g, true);
      y += 62;
    }

    const rule = new Graphics();
    rule.moveTo(20, y - 12).lineTo(W - 20, y - 12).stroke({ color: CONFIG.colors.stoneDim, width: 1 });
    this.list.addChild(rule);

    const bagLabel = uiText(`BAG (${ws.inventory.length})`, 10, CONFIG.colors.boneDim, '800');
    bagLabel.position.set(W / 2, y + 6);
    this.list.addChild(bagLabel);
    y += 26;

    // ── bag: newest first, so a fresh drop is at the top where you look ──
    const items = [...ws.inventory].reverse();
    if (items.length === 0) {
      const empty = uiText(UI.emptyBag, 12, CONFIG.colors.boneDim, '400', W - 70);
      empty.position.set(W / 2, y + 20);
      this.list.addChild(empty);
      return;
    }
    const maxY = H - Math.max(ctx.scaler.safeBottom(), 10) - 80;
    for (const g of items) {
      if (y > maxY - 50) {
        const more = uiText(`…and ${items.length - items.indexOf(g)} more`, 10, CONFIG.colors.boneDim);
        more.position.set(W / 2, y + 10);
        this.list.addChild(more);
        break;
      }
      this.row(y, g.slot, g, false);
      y += 56;
    }
  }

  /** One gear line. `equipped` decides whether the action equips or removes. */
  private row(y: number, slot: GearSlot, g: GearItem | undefined, equipped: boolean): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const wrap = new Container();
    wrap.position.set(W / 2, y);
    wrap.addChild(panel(ctx, W - 24, equipped ? 56 : 50));

    const slotTag = uiText(SLOT_NAME[slot].toUpperCase(), 8, CONFIG.colors.boneDim, '800');
    slotTag.anchor.set(0, 0.5);
    slotTag.position.set(-W / 2 + 20, equipped ? -16 : -13);
    wrap.addChild(slotTag);

    if (!g) {
      const none = uiText('— empty —', 13, CONFIG.colors.stoneDim, '400');
      none.anchor.set(0, 0.5);
      none.position.set(-W / 2 + 20, 6);
      wrap.addChild(none);
      this.list.addChild(wrap);
      return;
    }

    const name = uiText(g.name, 14, TIER_COLOR[g.tier], '600');
    name.anchor.set(0, 0.5);
    name.position.set(-W / 2 + 20, equipped ? 2 : 3);
    const eff = uiText(gearEffect(g), 10, CONFIG.colors.bone, '400');
    eff.anchor.set(0, 0.5);
    eff.position.set(-W / 2 + 20, equipped ? 19 : 19);
    wrap.addChild(name, eff);

    const act = new Btn(ctx, {
      w: 84, h: 42, kind: equipped ? 'dark' : 'gold',
      label: equipped ? 'Remove' : 'Equip', labelSize: 13,
      onTap: () => {
        if (equipped) ws.unequip(slot);
        else ws.equip(g.id);
        ctx.audio.play('upgrade', { vol: 0.6 });
        ctx.haptics.hit();
        // equipping armour raises max HP; never leave the player over their cap
        ws.hp = Math.min(ws.hp, stats.maxHp(ctx.save.data, ws.equipped));
        for (const a of checkAchievements(ctx.save.data, ws)) ctx.system.push(announce(a), 'good');
        ctx.save.data.world = ws.toSave();
        ctx.save.mark();
        this.rebuild();
      },
    });
    act.position.set(W / 2 - 66, 0);
    wrap.addChild(act);

    if (!equipped) {
      const worth = uiText(`${sellValue(g)}g`, 9, CONFIG.colors.amberBright, '600');
      worth.position.set(W / 2 - 66, 26);
      wrap.addChild(worth);
    }
    this.list.addChild(wrap);
  }
}
