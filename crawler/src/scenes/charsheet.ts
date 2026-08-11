import { Container, Graphics } from 'pixi.js';
import { CONFIG, STAT_KEYS, type StatKey } from '../config';
import { CAST, STAT_DESC, STAT_NAME } from '../flavour';
import * as stats from '../game/stats';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { Bar, displayText, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/**
 * The character sheet. Seven attributes, unspent points, and — the part that
 * matters — the live derived value beside each one, so a point is spent
 * against a number the player can actually see move.
 */
export class CharSheetScene extends Scene {
  private rows = new Map<StatKey, { value: NumberDisplay; derived: import('pixi.js').Text; plus: Btn }>();
  private pointsLabel!: import('pixi.js').Text;
  private xpBar!: Bar;
  private xpLabel!: import('pixi.js').Text;
  private returnTo: string = 'floormap';

  enter(data?: unknown): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    this.returnTo = (data as { from?: string })?.from ?? (ctx.run ? 'floormap' : 'title');

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.pit);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText(CAST.hero.toUpperCase(), 26, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 40);
    const tag = uiText(CAST.heroTag, 11, CONFIG.colors.boneDim);
    tag.position.set(W / 2, topY + 64);
    this.container.addChild(title, tag);

    // level + xp
    const lvl = displayText(`LEVEL ${save.level}`, 16, CONFIG.colors.sysBright, '700');
    lvl.position.set(W / 2, topY + 92);
    this.xpBar = new Bar(220, 9, CONFIG.colors.sysBright);
    this.xpBar.position.set(W / 2, topY + 114);
    this.xpBar.set(stats.xpFrac(save));
    this.xpLabel = uiText(`${save.xp} / ${stats.xpToNext(save.level)} XP`, 10, CONFIG.colors.boneDim, '600');
    this.xpLabel.position.set(W / 2, topY + 130);
    this.container.addChild(lvl, this.xpBar, this.xpLabel);

    this.pointsLabel = uiText('', 13, CONFIG.colors.amberBright, '600');
    this.pointsLabel.position.set(W / 2, topY + 154);
    this.container.addChild(this.pointsLabel);

    // ── the seven rows ──
    const listTop = topY + 182;
    const rowH = 62;
    STAT_KEYS.forEach((k, i) => this.statRow(k, listTop + i * rowH));

    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 40;
    const back = new Btn(ctx, {
      w: 200, h: 58, kind: 'blue', label: 'Back', labelSize: 18,
      onTap: () => ctx.router.goto(this.returnTo as never),
    });
    back.position.set(W / 2, footY);
    this.container.addChild(back);

    this.refresh();
    ctx.audio.music('musicTitle');
  }

  private statRow(k: StatKey, y: number): void {
    const ctx = this.ctx;
    const wrap = new Container();
    wrap.position.set(W / 2, y);

    const rule = new Graphics();
    rule.moveTo(-W / 2 + 24, 26).lineTo(W / 2 - 24, 26)
      .stroke({ color: CONFIG.colors.concreteDim, width: 1 });
    wrap.addChild(rule);

    const name = uiText(STAT_NAME[k], 16, CONFIG.colors.bone, '600');
    name.anchor.set(0, 0.5);
    name.position.set(-W / 2 + 26, -8);
    const desc = uiText(STAT_DESC[k], 10, CONFIG.colors.boneDim);
    desc.anchor.set(0, 0.5);
    desc.position.set(-W / 2 + 26, 10);
    wrap.addChild(name, desc);

    // the value column has to clear the 52px "+" button on its right
    const value = new NumberDisplay(ctx.atlas, 2, 0.44, CONFIG.colors.bone);
    value.position.set(W / 2 - 122, -4);
    const derived = uiText('', 9, CONFIG.colors.sysBright, '600');
    derived.position.set(W / 2 - 122, 16);
    wrap.addChild(value, derived);

    const plus = new Btn(ctx, {
      w: 52, h: 52, kind: 'gold', label: '+', labelSize: 26,
      onTap: () => {
        if (stats.spendPoint(ctx.save.data, k)) {
          ctx.audio.play('upgrade');
          ctx.haptics.doorTap();
          ctx.save.mark();
          this.refresh();
        }
      },
    });
    plus.position.set(W / 2 - 44, 0);
    wrap.addChild(plus);

    this.container.addChild(wrap);
    this.rows.set(k, { value, derived, plus });
  }

  /** What one more point in each stat would actually buy you, right now. */
  private derivedText(k: StatKey): string {
    const save = this.ctx.save.data;
    switch (k) {
      case 'str': return `${stats.arrowDamage(save).toFixed(2)} dmg`;
      case 'dex': return `${(1 / stats.fireInterval(save)).toFixed(2)}/s`;
      case 'con': return `−${Math.round(stats.lossResist(save) * 100)}% losses`;
      case 'int': return `${stats.abilityCooldown(save, 'blast').toFixed(1)}s cd`;
      case 'wis': return `×${stats.abilityPotency(save).toFixed(2)}`;
      case 'cha': return `${stats.startParty(save)} start`;
      case 'luck': return `+${Math.round(stats.lootLuck(save) * 100)}% tier`;
    }
  }

  private refresh(): void {
    const save = this.ctx.save.data;
    this.pointsLabel.text = save.points > 0
      ? `${save.points} attribute point${save.points === 1 ? '' : 's'} to spend`
      : 'No points to spend.';
    this.pointsLabel.style.fill = save.points > 0 ? CONFIG.colors.amberBright : CONFIG.colors.boneDim;
    this.xpBar.set(stats.xpFrac(save));
    this.xpLabel.text = `${save.xp} / ${stats.xpToNext(save.level)} XP`;

    for (const k of STAT_KEYS) {
      const row = this.rows.get(k);
      if (!row) continue;
      row.value.set(String(save.stats[k]));
      row.derived.text = this.derivedText(k);
      const canSpend = save.points > 0 && save.stats[k] < CONFIG.stats.max;
      row.plus.enabled = canSpend;
      row.plus.alpha = canSpend ? 1 : 0.35;
    }
  }
}
