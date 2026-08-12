import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { CONFIG, type AbilityKey } from '../../config';
import type { Ctx } from '../../core/game';
import { ABILITY, UI } from '../../flavour';
import { Btn } from '../../ui/button';
import { RollingNumber } from '../../ui/digits';
import { Bar, uiText } from '../../ui/widgets';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export interface HudHooks {
  onPause: () => void;
  onBlast: () => void;
  onSurge: () => void;
  onInteract: () => void;
  onBag: () => void;
  onChar: () => void;
  onJournal: () => void;
}

/**
 * One ability button: icon, cooldown shutter, and a ready state.
 * The shutter is redrawn only while cooling, so a ready button costs nothing.
 */
class AbilityBtn extends Container {
  private sweep = new Graphics();
  private btn: Btn;
  private frac = 1;
  private ready = true;

  constructor(ctx: Ctx, key: AbilityKey, icon: string, onFire: () => void) {
    super();
    const size = CONFIG.abilities.buttonSize;
    this.btn = new Btn(ctx, {
      w: size, h: size, kind: 'dark', icon, iconScale: 0.85,
      onTap: () => { if (this.ready) onFire(); },
    });
    const label = uiText(ABILITY[key].name, 10, CONFIG.colors.boneDim, '600');
    label.position.set(0, size / 2 + 11);
    this.addChild(this.btn, this.sweep, label);
  }

  setCooldown(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this.frac) < 0.02 && (f >= 1) === this.ready) return;
    this.frac = f;
    this.ready = f >= 1;
    const size = CONFIG.abilities.buttonSize;
    this.sweep.clear();
    if (!this.ready) {
      const h = size * (1 - f);
      this.sweep.rect(-size / 2, -size / 2, size, h).fill({ color: CONFIG.colors.ink, alpha: 0.72 });
    }
    this.btn.alpha = this.ready ? 1 : 0.75;
  }
}

/** A menu button that can show an attention dot. */
class MenuBtn extends Container {
  private dot = new Graphics();
  constructor(ctx: Ctx, icon: string, onTap: () => void) {
    super();
    this.addChild(new Btn(ctx, { w: 52, h: 52, kind: 'dark', icon, iconScale: 0.8, onTap }));
    this.dot.circle(19, -19, 6).fill(CONFIG.colors.amberBright)
      .circle(19, -19, 6).stroke({ color: CONFIG.colors.ink, width: 2 });
    this.dot.visible = false;
    this.addChild(this.dot);
  }
  setBadge(on: boolean): void { this.dot.visible = on; }
}

/**
 * The roaming HUD.
 *
 * Health is the loudest thing on screen because it is the only number that can
 * end the session. Everything else — gold, level, region — sits in a quiet
 * strip, and the menus live along the right edge where a thumb can reach them
 * without covering the play area.
 */
export class WorldHud extends Container {
  private hpBar: Bar;
  private hpText: Text;
  private xpBar: Bar;
  private lvlText: Text;
  private goldNum: RollingNumber;
  private region: Text;
  private interactBtn: Btn;
  private interactWrap = new Container();
  private interactLabel: Text;
  private blast: AbilityBtn;
  private surge: AbilityBtn;
  private bag: MenuBtn;
  private char: MenuBtn;
  private journal: MenuBtn;
  private lastHp = -1;
  private lastLabel = '';

  constructor(ctx: Ctx, hooks: HudHooks) {
    super();
    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const bottomY = H - Math.max(ctx.scaler.safeBottom(), 10);

    // ── health: the one number that can end the session ──
    this.hpBar = new Bar(196, 18, CONFIG.colors.hpRed);
    this.hpBar.position.set(W / 2 - 42, topY + 22);
    this.hpText = uiText('', 12, CONFIG.colors.bone, '600');
    this.hpText.position.set(W / 2 - 42, topY + 22);

    // ── level and XP ──
    this.lvlText = uiText('LV 1', 12, CONFIG.colors.sysBright, '600');
    this.lvlText.anchor.set(0, 0.5);
    this.lvlText.position.set(16, topY + 16);
    this.xpBar = new Bar(96, 6, CONFIG.colors.sysBright);
    this.xpBar.position.set(64, topY + 32);

    // ── gold ──
    const coin = new Sprite(ctx.atlas.get('coinDrop'));
    coin.anchor.set(0.5);
    coin.scale.set(0.7);
    coin.position.set(18, topY + 52);
    this.goldNum = new RollingNumber(ctx.atlas, ctx.tweens, 7, 0.42, CONFIG.colors.amberBright, 300, 'left');
    this.goldNum.position.set(32, topY + 52);

    // ── where you are ──
    this.region = uiText('', 11, CONFIG.colors.boneDim, '600');
    this.region.anchor.set(0, 0.5);
    this.region.position.set(16, topY + 74);

    const pauseBtn = new Btn(ctx, { w: 46, h: 46, kind: 'dark', icon: 'iconPause', onTap: hooks.onPause });
    pauseBtn.position.set(W - 32, topY + 22);

    // ── menus, down the right edge under the minimap ──
    const menuX = W - 36;
    let menuY = topY + CONFIG.minimap.size + 96;
    this.bag = new MenuBtn(ctx, 'iconBag', hooks.onBag);
    this.bag.position.set(menuX, menuY);
    menuY += 60;
    this.char = new MenuBtn(ctx, 'iconChar', hooks.onChar);
    this.char.position.set(menuX, menuY);
    menuY += 60;
    this.journal = new MenuBtn(ctx, 'iconQuest', hooks.onJournal);
    this.journal.position.set(menuX, menuY);

    // ── the contextual action, right above the thumb ──
    this.interactBtn = new Btn(ctx, {
      w: 132, h: 58, kind: 'gold', label: UI.talkPrompt, labelSize: 18, onTap: hooks.onInteract,
    });
    this.interactLabel = uiText('', 11, CONFIG.colors.boneDim, '600');
    this.interactLabel.position.set(0, 40);
    this.interactWrap.addChild(this.interactBtn, this.interactLabel);
    this.interactWrap.position.set(W / 2, bottomY - 140);
    this.interactWrap.visible = false;

    // ── abilities flank the bottom, thumbs-reachable ──
    this.blast = new AbilityBtn(ctx, 'blast', 'iconBlast', hooks.onBlast);
    this.blast.position.set(58, bottomY - 52);
    this.surge = new AbilityBtn(ctx, 'surge', 'iconSurge', hooks.onSurge);
    this.surge.position.set(W - 58, bottomY - 52);

    this.addChild(
      this.hpBar, this.hpText, this.lvlText, this.xpBar, coin, this.goldNum, this.region,
      pauseBtn, this.bag, this.char, this.journal, this.interactWrap, this.blast, this.surge,
    );
  }

  setHp(hp: number, max: number): void {
    const v = Math.max(0, Math.round(hp));
    this.hpBar.set(max > 0 ? v / max : 0);
    if (v !== this.lastHp) {
      this.lastHp = v;
      this.hpText.text = `${v} / ${max}`;
    }
  }

  setXp(level: number, frac: number): void {
    this.lvlText.text = `LV ${level}`;
    this.xpBar.set(frac);
  }

  setGold(n: number): void { this.goldNum.roll(n); }
  setRegion(name: string): void { if (this.region.text !== name) this.region.text = name; }

  setInteract(label: string | null): void {
    const on = label !== null;
    if (this.interactWrap.visible !== on) this.interactWrap.visible = on;
    if (on && label !== this.lastLabel) { this.lastLabel = label; this.interactBtn.setLabel(label); }
  }

  setBadges(points: boolean, quests: boolean): void {
    this.char.setBadge(points);
    this.journal.setBadge(quests);
    this.bag.setBadge(false);
  }

  setCooldowns(blast: number, surge: number): void {
    this.blast.setCooldown(blast);
    this.surge.setCooldown(surge);
  }
}
