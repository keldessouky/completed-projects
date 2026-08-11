import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG, type AbilityKey } from '../../config';
import type { Ctx } from '../../core/game';
import { ABILITY, BOSS_NAME, NODE_LABEL } from '../../flavour';
import { Btn } from '../../ui/button';
import { NumberDisplay, RollingNumber } from '../../ui/digits';
import { Bar, displayText, uiText } from '../../ui/widgets';

const W = CONFIG.design.width;

/** mm:ss, always two digits of seconds so the glyphs never reflow */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * One ability button: icon, cooldown sweep, and a ready-state pulse.
 * The sweep is redrawn only while cooling, so a ready button costs nothing.
 */
class AbilityBtn extends Container {
  private sweep = new Graphics();
  private btn: Btn;
  private frac = 1;
  private ready = true;

  constructor(ctx: Ctx, key: AbilityKey, icon: string, private onFire: () => void) {
    super();
    const size = CONFIG.abilities.buttonSize;
    this.btn = new Btn(ctx, {
      w: size, h: size, kind: 'dark', icon, iconScale: 0.8,
      onTap: () => { if (this.ready) this.onFire(); },
    });
    const label = uiText(ABILITY[key].name, 10, CONFIG.colors.boneDim, '600');
    label.position.set(0, size / 2 + 11);
    this.addChild(this.btn, this.sweep, label);
  }

  /** frac: 1 = ready, 0 = just fired */
  setCooldown(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this.frac) < 0.02 && (f >= 1) === this.ready) return;
    this.frac = f;
    this.ready = f >= 1;
    const size = CONFIG.abilities.buttonSize;
    this.sweep.clear();
    if (!this.ready) {
      // a dark shutter that retracts upward as the cooldown burns off
      const h = size * (1 - f);
      this.sweep.rect(-size / 2, -size / 2, size, h).fill({ color: CONFIG.colors.pit, alpha: 0.72 });
    }
    this.btn.alpha = this.ready ? 1 : 0.75;
  }
}

/**
 * In-encounter HUD. Everything lives inside the design box AND below safeTop /
 * above safeBottom, so the Dynamic Island and home indicator never cover it.
 * Numerals are atlas digits — tabular, no reflow jitter.
 */
export class EncounterHud extends Container {
  private partyNum: RollingNumber;
  private goldNum: RollingNumber;
  private clock: NumberDisplay;
  private clockLabel = uiText('FLOOR CLOSES IN', 9, CONFIG.colors.boneDim, '600');
  private progress: Bar;
  private bossBar: Bar;
  private bossWrap = new Container();
  private objective: import('pixi.js').Text;
  private blast: AbilityBtn;
  private rally: AbilityBtn;
  private lastUrgent = false;

  constructor(
    ctx: Ctx,
    kind: 'corridor' | 'arena' | 'boss',
    onPause: () => void,
    onBlast: () => void,
    onRally: () => void,
  ) {
    super();
    const topY = Math.max(ctx.scaler.safeTop(), 12) + 30;

    // ── floor clock: the loudest thing on screen, because it is the game ──
    this.clockLabel.position.set(W / 2, topY - 15);
    this.clock = new NumberDisplay(ctx.atlas, 5, 0.58, CONFIG.colors.bone);
    this.clock.position.set(W / 2, topY + 8);

    // gold — top-left
    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5);
    coin.position.set(26, topY);
    this.goldNum = new RollingNumber(ctx.atlas, ctx.tweens, 6, 0.42, CONFIG.colors.amberBright, 300, 'left');
    this.goldNum.position.set(44, topY);

    // pause — top-right corner, inside the safe area
    const pauseBtn = new Btn(ctx, { w: 54, h: 54, kind: 'dark', icon: 'iconPause', onTap: onPause });
    pauseBtn.position.set(W - 38, topY);

    // what this room wants from you
    this.objective = uiText(
      kind === 'corridor' ? NODE_LABEL.corridor.toUpperCase()
        : kind === 'arena' ? NODE_LABEL.mob.toUpperCase()
        : NODE_LABEL.boss.toUpperCase(),
      10, CONFIG.colors.boneDim, '600',
    );
    this.objective.position.set(W / 2, topY + 34);

    // progress: distance for a tunnel, waves cleared for a nest
    this.progress = new Bar(180, 8, CONFIG.colors.sysBright);
    this.progress.position.set(W / 2, topY + 50);
    this.progress.visible = kind !== 'boss';

    // party count — big, bottom center, rolls rather than snaps
    this.partyNum = new RollingNumber(ctx.atlas, ctx.tweens, 4, 1.05, CONFIG.colors.bone, CONFIG.party.countRollMs);
    const bottomY = CONFIG.design.height - Math.max(ctx.scaler.safeBottom(), 10) - 34;
    this.partyNum.position.set(W / 2, bottomY);

    // Boss HP sits at the BOTTOM, not under the clock: the hulk is 250 px tall
    // and parks at the top of the screen, so a top-anchored bar would be drawn
    // across its face. Hidden until it arrives.
    this.bossBar = new Bar(300, 16, CONFIG.colors.trapRed);
    const bossTitle = displayText(BOSS_NAME.toUpperCase(), 12, CONFIG.colors.bone);
    bossTitle.position.set(0, -20);
    this.bossWrap.addChild(bossTitle, this.bossBar);
    this.bossWrap.position.set(W / 2, bottomY - 78);
    this.bossWrap.visible = false;

    // abilities flank the party count, thumbs-reachable at the screen edges
    this.blast = new AbilityBtn(ctx, 'blast', 'iconBlast', onBlast);
    this.blast.position.set(56, bottomY - 12);
    this.rally = new AbilityBtn(ctx, 'rally', 'iconRally', onRally);
    this.rally.position.set(W - 56, bottomY - 12);

    this.addChild(
      this.clockLabel, this.clock, coin, this.goldNum, pauseBtn,
      this.objective, this.progress, this.partyNum, this.bossWrap, this.blast, this.rally,
    );
  }

  setParty(n: number): void { this.partyNum.roll(n); }
  snapParty(n: number): void { this.partyNum.snap(n); }
  setGold(n: number): void { this.goldNum.roll(n); }
  setProgress(frac: number): void { this.progress.set(frac); }

  /** Red and slightly larger once the floor is about to seal. */
  setClock(sec: number): void {
    this.clock.set(clockText(sec));
    const urgent = sec <= CONFIG.floors.warnAtSec;
    if (urgent !== this.lastUrgent) {
      this.lastUrgent = urgent;
      this.clock.tint = urgent ? CONFIG.colors.trapRedBright : CONFIG.colors.bone;
      this.clock.scale.set(urgent ? 0.66 : 0.58);
      this.clockLabel.style.fill = urgent ? CONFIG.colors.trapRedBright : CONFIG.colors.boneDim;
    }
  }

  setObjective(text: string): void { this.objective.text = text; }
  showBossBar(): void { this.bossWrap.visible = true; }
  setBossHp(frac: number): void { this.bossBar.set(frac); }
  setCooldowns(blast: number, rally: number): void {
    this.blast.setCooldown(blast);
    this.rally.setCooldown(rally);
  }
}
