import { Container, Sprite } from 'pixi.js';
import { CONFIG } from '../../config';
import type { Ctx } from '../../core/game';
import { Btn } from '../../ui/button';
import { RollingNumber } from '../../ui/digits';
import { Bar, displayText, uiText } from '../../ui/widgets';
import { stageName } from '../../game/stages';

/**
 * In-run HUD. Everything lives inside the design box AND below safeTop /
 * above safeBottom, so the Dynamic Island and home indicator never cover it.
 * Numerals are atlas digits — tabular, no reflow jitter.
 */
export class RunHud extends Container {
  squadNum: RollingNumber;
  private coinNum: RollingNumber;
  private progress: Bar;
  private bossBar: Bar;
  private bossWrap = new Container();
  private pauseBtn: Btn;

  constructor(ctx: Ctx, stage: number, onPause: () => void) {
    super();
    const W = CONFIG.design.width;
    const topY = Math.max(ctx.scaler.safeTop(), 12) + 30;

    // stage progress — thin bar, chapter-gold
    this.progress = new Bar(180, 10, CONFIG.colors.gold);
    this.progress.position.set(W / 2, topY);
    const label = uiText(stageName(stage).toUpperCase(), 11, CONFIG.colors.boneDim, '600');
    label.position.set(W / 2, topY - 16);
    const emblem = new Sprite(ctx.atlas.get('emblem'));
    emblem.anchor.set(0.5);
    emblem.scale.set(0.28);
    emblem.position.set(W / 2 + 104, topY - 2);

    // coins — top-left
    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5);
    coin.position.set(26, topY);
    this.coinNum = new RollingNumber(ctx.atlas, ctx.tweens, 6, 0.42, CONFIG.colors.goldBright, 300, 'left');
    this.coinNum.position.set(44, topY);

    // pause — top-right corner, inside the safe area
    this.pauseBtn = new Btn(ctx, {
      w: 54, h: 54, kind: 'dark', icon: 'iconPause', onTap: onPause,
    });
    this.pauseBtn.position.set(W - 38, topY);

    // squad count — big, bottom center, rolls rather than snaps
    this.squadNum = new RollingNumber(ctx.atlas, ctx.tweens, 4, 1.05, CONFIG.colors.bone, CONFIG.squad.countRollMs);
    const bottomY = CONFIG.design.height - Math.max(ctx.scaler.safeBottom(), 10) - 34;
    this.squadNum.position.set(W / 2, bottomY);

    // boss HP — hidden until the gate arrives
    this.bossBar = new Bar(300, 16, CONFIG.colors.trapRed);
    const bossTitle = displayText('THE GATE', 15, CONFIG.colors.bone);
    bossTitle.position.set(0, -20);
    this.bossWrap.addChild(bossTitle, this.bossBar);
    this.bossWrap.position.set(W / 2, topY + 44);
    this.bossWrap.visible = false;

    this.addChild(label, this.progress, emblem, coin, this.coinNum, this.pauseBtn, this.squadNum, this.bossWrap);
  }

  setSquad(n: number): void { this.squadNum.roll(n); }
  snapSquad(n: number): void { this.squadNum.snap(n); }
  setCoins(n: number): void { this.coinNum.roll(n); }
  setProgress(frac: number): void { this.progress.set(frac); }

  showBossBar(): void { this.bossWrap.visible = true; }
  setBossHp(frac: number): void { this.bossBar.set(frac); }

  get coinTargetX(): number { return 26; }
  get coinTargetY(): number { return this.coinNum.y; }
}
