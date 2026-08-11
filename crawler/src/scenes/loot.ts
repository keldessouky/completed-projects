import { Container, Graphics, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG, type LootTier } from '../config';
import { STAT_NAME } from '../flavour';
import { award } from '../game/achievements';
import { announce } from '../game/achievements';
import { describe, tierLabel } from '../game/loot';
import type { LootRoll } from '../game/loot';
import { Btn } from '../ui/button';
import { displayText, panel, uiText } from '../ui/widgets';
import { applyLoot } from './floormap';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

const TIER_TINT: Record<LootTier, number> = {
  bronze: CONFIG.colors.rust,
  silver: CONFIG.colors.boneDim,
  gold: CONFIG.colors.amberBright,
};

/**
 * A loot box. The roll is resolved the instant you arrive — the tap is
 * theatre, not chance — because a box that decides its contents while you
 * watch invites save-scumming, and this one is already generous.
 */
export class LootScene extends Scene {
  enter(data?: unknown): void {
    const ctx = this.ctx;
    if (!ctx.run) { ctx.router.goto('title'); return; }
    const tier = ((data as { tier?: LootTier })?.tier ?? 'bronze') as LootTier;

    const roll = applyLoot(ctx, tier);
    const a = award(ctx.save.data, 'boxOpener');
    if (a) ctx.system.push(announce(a), 'good');

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.pit);
    this.container.addChild(bg);

    const title = displayText(`${tierLabel(roll.tier)} LOOT BOX`.toUpperCase(), 22, TIER_TINT[roll.tier], '900');
    title.position.set(W / 2, H / 2 - 210);
    this.container.addChild(title);

    if (roll.upgraded) {
      const up = uiText('Luck upgraded this box.', 12, CONFIG.colors.goodTeal, '600');
      up.position.set(W / 2, H / 2 - 186);
      this.container.addChild(up);
    }

    // the box itself, popping open on arrival
    const box = new Sprite(ctx.atlas.get('lootBox'));
    box.anchor.set(0.5);
    box.tint = TIER_TINT[roll.tier];
    box.position.set(W / 2, H / 2 - 110);
    box.scale.set(0.2);
    this.container.addChild(box);

    const st = { s: 0.2, r: -0.4 };
    const tw = new Tween(st)
      .to({ s: 1.15, r: 0 }, 420)
      .easing(Easing.Back.Out)
      .onUpdate(() => { box.scale.set(st.s); box.rotation = st.r; })
      .start(performance.now());
    ctx.tweens.add(tw);

    ctx.audio.play('upgrade');
    ctx.haptics.doorTap();

    this.contents(roll);

    const cont = new Btn(ctx, {
      w: 220, h: 62, kind: 'gold', label: 'Continue', labelSize: 20,
      onTap: () => ctx.router.goto('floormap'),
    });
    cont.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 10) - 60);
    this.container.addChild(cont);
  }

  private contents(roll: LootRoll): void {
    const ctx = this.ctx;
    const lines = describe(roll);
    const wrap = new Container();
    const h = 40 + lines.length * 32;
    wrap.position.set(W / 2, H / 2 + 40);
    wrap.addChild(panel(ctx, W - 90, h));

    lines.forEach((line, i) => {
      const t = uiText(line, 17, CONFIG.colors.bone, '600');
      t.position.set(0, -h / 2 + 30 + i * 32);
      wrap.addChild(t);
    });
    this.container.addChild(wrap);

    if (roll.statPoint) {
      const hint = uiText(
        `Spend it on ${STAT_NAME[roll.statPoint]} — or anything else.`,
        11, CONFIG.colors.boneDim,
      );
      hint.position.set(W / 2, H / 2 + h / 2 + 58);
      this.container.addChild(hint);
    }
  }
}
