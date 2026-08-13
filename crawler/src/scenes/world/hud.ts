import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { CONFIG } from '../../config';
import type { Ctx } from '../../core/game';
import { KEEP_NAME } from '../../flavour';
import { Btn } from '../../ui/button';
import { RollingNumber } from '../../ui/digits';
import { Bar, uiText } from '../../ui/widgets';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export interface HudHooks {
  onPause: () => void;
}

/**
 * The whole HUD.
 *
 * There are exactly three numbers in this game — how many people are behind
 * you, how many coins you are carrying, and how much gate is left — and this
 * is all of them. There is no inventory, no character sheet, no map screen and
 * no fire button, because the only decision the player makes is where to walk.
 *
 * The squad counter is the loudest thing on screen: it is the health bar, the
 * damage stat and the score at once, and watching it tick down is what losing
 * feels like.
 */
export class WorldHud extends Container {
  private squadNum: RollingNumber;
  private squadTier: Text;
  private coinNum: RollingNumber;
  private gateWrap = new Container();
  private gateBar: Bar;
  private gateLabel: Text;
  private padWrap = new Container();
  private padBar: Bar;
  private padLabel: Text;
  private hint: Text;
  private lastTier = '';
  private lastHint = '';
  private lastPad = '';

  constructor(ctx: Ctx, hooks: HudHooks) {
    super();
    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const bottomY = H - Math.max(ctx.scaler.safeBottom(), 10);

    // ── the squad counter: the only number that matters ──
    const squadIcon = new Sprite(ctx.atlas.get('iconSquad'));
    squadIcon.anchor.set(0.5);
    squadIcon.scale.set(0.9);
    squadIcon.tint = CONFIG.colors.ally;
    squadIcon.position.set(26, topY + 26);
    this.squadNum = new RollingNumber(
      ctx.atlas, ctx.tweens, 3, 0.72, CONFIG.colors.white,
      CONFIG.squad.countRollMs, 'left',
    );
    this.squadNum.position.set(46, topY + 26);
    this.squadTier = uiText('', 11, CONFIG.colors.boneDim, '700');
    this.squadTier.anchor.set(0, 0.5);
    this.squadTier.position.set(46, topY + 50);

    // ── the purse ──
    const coinIcon = new Sprite(ctx.atlas.get('iconCoin'));
    coinIcon.anchor.set(0.5);
    coinIcon.scale.set(0.62);
    coinIcon.tint = CONFIG.colors.gold;
    coinIcon.position.set(W / 2 + 8, topY + 24);
    this.coinNum = new RollingNumber(
      ctx.atlas, ctx.tweens, 5, 0.46, CONFIG.colors.gold, 300, 'left',
    );
    this.coinNum.position.set(W / 2 + 24, topY + 24);

    const pauseBtn = new Btn(ctx, { w: 46, h: 46, kind: 'dark', icon: 'iconPause', onTap: hooks.onPause });
    pauseBtn.position.set(W - 32, topY + 24);

    // ── the gate: only on screen once you are in range of it ──
    this.gateBar = new Bar(300, 16, CONFIG.colors.foe);
    this.gateBar.position.set(0, 16);
    this.gateLabel = uiText(KEEP_NAME, 13, CONFIG.colors.bone, '700');
    this.gateLabel.anchor.set(0.5, 0.5);
    this.gateLabel.position.set(0, -6);
    const gateIcon = new Sprite(ctx.atlas.get('iconGate'));
    gateIcon.anchor.set(0.5);
    gateIcon.scale.set(0.66);
    gateIcon.tint = CONFIG.colors.boneDim;
    gateIcon.position.set(-96, -6);
    this.gateWrap.addChild(gateIcon, this.gateLabel, this.gateBar);
    this.gateWrap.position.set(W / 2, topY + 74);
    this.gateWrap.visible = false;

    // ── the pad drain meter, shown while you stand on one ──
    this.padBar = new Bar(220, 12, CONFIG.colors.hpGreen);
    this.padBar.position.set(0, 16);
    this.padLabel = uiText('', 13, CONFIG.colors.bone, '700');
    this.padLabel.anchor.set(0.5, 0.5);
    this.padWrap.addChild(this.padLabel, this.padBar);
    this.padWrap.position.set(W / 2, bottomY - 138);
    this.padWrap.visible = false;

    // ── one line of guidance, and never more than one ──
    this.hint = uiText('', 13, CONFIG.colors.bone, '700');
    this.hint.anchor.set(0.5, 0.5);
    this.hint.position.set(W / 2, bottomY - 96);
    this.hint.visible = false;

    this.addChild(
      squadIcon, this.squadNum, this.squadTier,
      coinIcon, this.coinNum, pauseBtn,
      this.gateWrap, this.padWrap, this.hint,
    );
  }

  setSquad(n: number, tier: string): void {
    this.squadNum.roll(n);
    if (tier !== this.lastTier) { this.lastTier = tier; this.squadTier.text = tier; }
  }

  setCoins(n: number): void { this.coinNum.roll(n); }

  /** `frac` < 0 hides the bar entirely. */
  setGate(frac: number): void {
    const on = frac >= 0;
    if (this.gateWrap.visible !== on) this.gateWrap.visible = on;
    if (on) this.gateBar.set(frac);
  }

  /**
   * The boss bar, which is the gate bar wearing a different hat.
   *
   * Reused rather than added alongside because the two can never be on screen
   * together — the gate has to be down before the Warden walks out of it — and
   * a second bar in the same slot would be a second thing to lay out, keep in
   * sync and hide correctly for no gain the player can see.
   */
  setBoss(frac: number, label: string): void {
    const on = frac >= 0;
    if (this.gateWrap.visible !== on) this.gateWrap.visible = on;
    if (!on) return;
    if (this.gateLabel.text !== label) this.gateLabel.text = label;
    this.gateBar.set(frac);
  }

  /** Put the shared bar's label back to the keep's name. */
  resetGateLabel(): void {
    if (this.gateLabel.text !== KEEP_NAME) this.gateLabel.text = KEEP_NAME;
  }

  setPad(label: string | null, frac: number): void {
    const on = label !== null;
    if (this.padWrap.visible !== on) this.padWrap.visible = on;
    if (!on) return;
    if (label !== this.lastPad) { this.lastPad = label; this.padLabel.text = label; }
    this.padBar.set(frac);
  }

  setHint(text: string | null): void {
    const on = text !== null;
    if (this.hint.visible !== on) this.hint.visible = on;
    if (on && text !== this.lastHint) { this.lastHint = text; this.hint.text = text; }
  }
}

/**
 * The off-screen objective chevron: a pointer at the edge of the screen toward
 * the keep. Without it a 3600-unit field is a place to get lost in, and getting
 * lost is not one of the things this game is about.
 */
export class Compass extends Container {
  private arrow: Sprite;
  private ring = new Graphics();

  constructor(ctx: Ctx) {
    super();
    this.ring.circle(0, 0, 21).fill({ color: CONFIG.colors.ink, alpha: 0.5 });
    this.arrow = new Sprite(ctx.atlas.get('chevron'));
    this.arrow.anchor.set(0.5);
    this.arrow.scale.set(0.8);
    this.arrow.tint = CONFIG.colors.gold;
    this.addChild(this.ring, this.arrow);
    this.eventMode = 'none';
  }

  /** `sx, sy` is the target's screen offset from the hero. */
  aim(sx: number, sy: number, visible: boolean): void {
    this.visible = visible;
    if (!visible) return;
    const a = Math.atan2(sy, sx);
    // park it on an inset ellipse rather than the screen rectangle: the corners
    // of a phone are where the thumbs are
    const rx = W / 2 - 46, ry = H / 2 - 190;
    this.position.set(W / 2 + Math.cos(a) * rx, H / 2 + Math.sin(a) * ry);
    this.arrow.rotation = a + Math.PI / 2;
  }
}
