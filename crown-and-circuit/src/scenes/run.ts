import { Container, Sprite, Text, TilingSprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG, type EraId, type StructureKind } from '../config';
import type { Ctx } from '../core/game';
import type { Stepper } from '../core/loop';
import { displayFont } from '../assets/fonts';
import { drawCards } from '../game/cards';
import type { Pad } from '../game/fort';
import { WaveDirector } from '../game/waves';
import { World, type RunStats } from '../game/world';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { Bar, panel, uiText } from '../ui/widgets';
import { showCards, showPause } from '../ui/overlays';
import type { RunResult } from '../types';
import { Scene } from './scene';

const KINDS: StructureKind[] = ['tower', 'barracks', 'forge'];
const KIND_LABEL: Record<StructureKind, string> = {
  tower: 'Tower', barracks: 'Barracks', forge: 'Forge',
};

/** Permanent meta levels become the run's starting stat block. */
function statsFromMeta(ctx: Ctx): RunStats {
  const m = ctx.save.data.meta;
  const U = CONFIG.meta.upgrades;
  return {
    dmg: 1,
    fireRate: 1,
    range: 1,
    moveSpeed: 1 + m.speed * U.speed.per,
    magnet: 1 + m.magnet * U.magnet.per,
    carry: 1 + m.carry * U.carry.per,
    coin: 1,
    extraSoldiers: m.squad * U.squad.per,
    // behaviour stats all start neutral; only cards switch them on
    pierce: 0, fork: 0, explode: 0, heavyEvery: 0, volley: false, aura: 0, chain: 0,
    evolved: { lance: false, storm: false, broadside: false },
  };
}

export class RunScene extends Scene implements Stepper {
  private sim!: World;
  private waves!: WaveDirector;
  private ground!: TilingSprite;
  private startedAt = 0;
  private ending = false;

  private hud = new Container();
  private carryWrap = new Container();
  private carryNum!: NumberDisplay;
  private carryBar!: Bar;
  private keepBar!: Bar;
  private kingBar!: Bar;
  private waveText!: Text;
  private eraText!: Text;
  private phaseText!: Text;
  private pauseBtn!: Btn;
  private buildPanel = new Container();
  private stick = new Container();
  private stickBase!: Sprite;
  private stickKnob!: Sprite;
  private banner!: Text;
  private tutorial!: Text;
  private panelPad: Pad | null = null;
  /** the expanding ring dropped where the squad was sent */
  private rallyMark!: Sprite;
  /** HUD dot showing whether the rally is ready */
  private rallyPip!: Sprite;
  private progressBar: Bar | null = null;

  enter(): void {
    const ctx = this.ctx;

    // ground first, so everything the World creates sorts above it
    this.ground = new TilingSprite({
      texture: ctx.terrain[0],
      width: CONFIG.world.size,
      height: CONFIG.world.size,
    });
    this.world.addChild(this.ground);

    const simLayer = new Container();
    simLayer.sortableChildren = true;
    this.world.addChild(simLayer);

    this.sim = new World(ctx, simLayer, statsFromMeta(ctx));
    this.waves = new WaveDirector(this.sim);

    this.sim.soldierTarget = 1;
    this.sim.syncSquad();
    // Opening purse: enough to raise one structure before the first wave,
    // plus whatever the War Chest meta adds on top.
    this.sim.carry = CONFIG.fort.startingCoins
      + ctx.save.data.meta.purse * CONFIG.meta.upgrades.purse.per;

    this.rallyMark = new Sprite(ctx.atlas.get('padGlow'));
    this.rallyMark.anchor.set(0.5);
    this.rallyMark.blendMode = 'add';
    this.rallyMark.visible = false;
    this.rallyMark.tint = CONFIG.colors.gold;
    simLayer.addChild(this.rallyMark);

    ctx.camera.snap(this.sim.kx, this.sim.ky);
    this.wire();
    this.buildHud();

    ctx.audio.music(CONFIG.eras[0].music);
    ctx.loop.stepper = this;
    ctx.onAutoPause = () => this.openPause();
    ctx.runStats = () => ({ ...this.sim.stats0(), wave: this.waves.wave });
    const dbg = (window as unknown as { __cc?: Record<string, unknown> }).__cc!;
    dbg.skipLull = () => this.waves.callWaveEarly();
    // request a build on whatever pad the king is standing on — the coins still
    // have to be ferried, so this exercises the real deposit loop
    dbg.buildHere = (kind: StructureKind = 'tower') => {
      if (this.sim.onPad) this.sim.requestBuild(this.sim.onPad, kind);
      return !!this.sim.onPad;
    };
    dbg.nearestPad = () => {
      const p = this.sim.fort.pads.find((q) => q.ring < this.sim.fort.unlockedRings && !q.kind);
      return p ? { x: p.x, y: p.y } : null;
    };
    dbg.pads = () => this.sim.fort.pads
      .filter((q) => q.ring < this.sim.fort.unlockedRings && !q.kind && q.rubble <= 0)
      .map((q) => ({ x: q.x, y: q.y, ring: q.ring, pending: !!q.pending, progress: q.progress, goal: q.goal }));
    dbg.kingAt = () => ({ x: this.sim.kx, y: this.sim.ky });
    dbg.rallyReady = () => this.sim.rallyCool <= 0;
    /** rally onto the densest nearby knot of enemies, which is what a player does */
    dbg.rallyAt = () => this.sim.rallyBest();
    // a live window on the simulation, so balance probes can read horde size,
    // time-to-kill and keep health without driving the UI
    dbg.probe = () => ({
      wave: this.waves.wave,
      phase: this.waves.phase,
      era: this.sim.era,
      enemies: this.sim.enemies.count,
      soldiers: this.sim.soldiers.count,
      projs: this.sim.projs.count,
      coins: this.sim.coins.count,
      kills: this.sim.kills,
      keepHp: this.sim.fort.keepHp,
      kingHp: this.sim.kingHp,
      banked: this.sim.banked,
      carry: this.sim.carry,
    });
    this.startedAt = performance.now();
  }

  override exit(): void {
    this.ctx.loop.stepper = null;
    this.ctx.runStats = null;
    this.ctx.onAutoPause = null;
  }

  private wire(): void {
    const ctx = this.ctx;
    this.sim.onDeath = (why) => this.endRun(false, why);
    this.waves.onWaveStart = () => {
      ctx.audio.play('sfxWave');
      this.showBanner(`WAVE ${this.waves.wave + 1}${this.waves.isBossWave ? ' — BOSS' : ''}`);
    };
    this.waves.onWaveClear = () => {
      if (this.waves.wave + 1 < CONFIG.waves.total) this.offerCards();
    };
    this.waves.onEraUp = (era) => this.advanceEra(era);
    this.waves.onWin = () => this.endRun(true, '');
  }

  private advanceEra(era: EraId): void {
    const ctx = this.ctx;
    this.sim.setEra(era);
    this.sim.syncSquad();   // each age brings its own levy
    this.ground.texture = ctx.terrain[era];
    ctx.audio.play('sfxEra');
    ctx.audio.music(CONFIG.eras[era].music);
    ctx.fx.flash(0.85, 1000 / CONFIG.fx.eraFlashMs);
    ctx.fx.shake(CONFIG.fx.shakeEraUp);
    ctx.fx.slowmo(CONFIG.fx.eraSlowScale, CONFIG.fx.eraSlowMs);
    ctx.haptics.tap(CONFIG.fx.hapticEra);
    this.showBanner(CONFIG.eras[era].name.toUpperCase(), CONFIG.eras[era].weapon);
    this.eraText.text = CONFIG.eras[era].short;
    this.eraText.style.fontFamily = displayFont(era);
    this.eraText.style.fill = CONFIG.palettes[era].accent;
  }

  private offerCards(): void {
    this.ctx.audio.play('sfxCard');
    showCards(this.ctx, drawCards(this.sim));
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    const ctx = this.ctx;
    this.ui.addChild(this.hud);

    const left = new Container();
    this.keepBar = new Bar(190, 15, CONFIG.colors.good);
    this.kingBar = new Bar(140, 9, CONFIG.colors.bad);
    const keepIcon = new Sprite(ctx.atlas.get('iHome'));
    keepIcon.anchor.set(0.5);
    keepIcon.scale.set(0.62);
    keepIcon.tint = CONFIG.colors.inkDim;
    keepIcon.position.set(-16, 0);
    this.keepBar.position.set(101, 0);
    this.kingBar.position.set(76, 20);
    left.addChild(keepIcon, this.keepBar, this.kingBar);
    left.position.set(34, 30);
    this.hud.addChild(left);
    this.leftWrap = left;

    this.waveText = uiText('WAVE 1', 15, CONFIG.colors.ink, '800');
    this.waveText.anchor.set(1, 0.5);
    this.eraText = new Text({
      text: CONFIG.eras[0].short,
      style: { fontFamily: displayFont(0), fontSize: 20, fontWeight: '900', fill: CONFIG.palettes[0].accent },
    });
    this.eraText.anchor.set(1, 0.5);
    this.phaseText = uiText('', 13, CONFIG.colors.inkDim, '600');
    this.phaseText.anchor.set(1, 0.5);
    this.hud.addChild(this.waveText, this.eraText, this.phaseText);

    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5);
    coin.position.set(-46, 0);
    this.carryNum = new NumberDisplay(ctx.atlas, 5, 0.62, CONFIG.colors.gold, 'left');
    this.carryNum.position.set(-30, 0);
    this.carryBar = new Bar(150, 8, CONFIG.colors.gold, 0.35);
    this.carryBar.position.set(20, 20);
    this.carryWrap.addChild(coin, this.carryNum, this.carryBar);
    this.hud.addChild(this.carryWrap);

    this.pauseBtn = new Btn(ctx, { w: 46, h: 46, kind: 'dark', icon: 'iPause', onTap: () => this.openPause() });
    this.hud.addChild(this.pauseBtn);

    // rally readiness, parked under the pause button
    this.rallyPip = new Sprite(ctx.atlas.get('iSword'));
    this.rallyPip.anchor.set(0.5);
    this.rallyPip.tint = CONFIG.colors.gold;
    this.hud.addChild(this.rallyPip);

    this.hud.addChild(this.buildPanel);
    this.buildPanel.visible = false;

    this.stickBase = new Sprite(ctx.atlas.get('stickBase'));
    this.stickBase.anchor.set(0.5);
    this.stickKnob = new Sprite(ctx.atlas.get('stickKnob'));
    this.stickKnob.anchor.set(0.5);
    this.stick.addChild(this.stickBase, this.stickKnob);
    this.stick.visible = false;
    this.hud.addChild(this.stick);

    this.banner = new Text({
      text: '',
      style: {
        fontFamily: displayFont(0), fontSize: 34, fontWeight: '900',
        fill: CONFIG.colors.ink, align: 'center',
      },
    });
    this.banner.anchor.set(0.5);
    this.banner.alpha = 0;
    this.tutorial = uiText('', 15, CONFIG.colors.ink, '600');
    this.tutorial.anchor.set(0.5);
    this.tutorial.alpha = 0;
    this.hud.addChild(this.banner, this.tutorial);

    this.layout();
  }
  private leftWrap!: Container;

  override layout(): void {
    if (!this.waveText) return;
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    const top = Math.max(cam.safeTop, 10);
    const bottom = Math.max(cam.safeBottom, 10);

    this.leftWrap.position.set(34, top + 22);
    this.waveText.position.set(W - 24, top + 18);
    this.eraText.position.set(W - 24, top + 44);
    this.phaseText.position.set(W - 24, top + 66);
    this.pauseBtn.position.set(W - 36, top + 108);
    this.rallyPip.position.set(W - 36, top + 166);
    this.carryWrap.position.set(W / 2, H - bottom - 34);
    this.banner.position.set(W / 2, H * 0.3);
    this.tutorial.position.set(W / 2, H * 0.8);
    this.buildPanel.position.set(W / 2, H - bottom - 110);
  }

  private showBanner(text: string, sub = ''): void {
    this.banner.text = sub ? `${text}\n${sub}` : text;
    this.banner.style.fontFamily = displayFont(this.sim.era);
    this.banner.style.fill = CONFIG.palettes[this.sim.era].accent;
    this.banner.alpha = 0;
    this.banner.scale.set(0.85);
    const st = { a: 0, s: 0.85 };
    const tw = new Tween(st)
      .to({ a: 1, s: 1 }, 260)
      .easing(Easing.Back.Out)
      .onUpdate(() => { this.banner.alpha = st.a; this.banner.scale.set(st.s); })
      .onComplete(() => {
        const out = { a: 1 };
        const t2 = new Tween(out).to({ a: 0 }, 500).delay(1100)
          .onUpdate(() => { this.banner.alpha = out.a; })
          .start(performance.now());
        this.ctx.tweens.add(t2);
      })
      .start(performance.now());
    this.ctx.tweens.add(tw);
  }

  private refreshBuildPanel(pad: Pad | null): void {
    if (pad === this.panelPad) {
      if (pad && pad.goal > 0 && this.progressBar) this.progressBar.set(pad.progress / pad.goal);
      return;
    }
    this.panelPad = pad;
    this.progressBar = null;
    this.buildPanel.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.buildPanel.visible = !!pad;
    if (!pad) return;

    const ctx = this.ctx;
    const w = 300;
    const h = 78;
    this.buildPanel.addChild(panel(ctx, w, h));

    if (pad.goal > 0) {
      const label = uiText(`${KIND_LABEL[pad.pending!]} — stand here to pay`, 13, CONFIG.colors.ink, '600');
      label.position.set(0, -20);
      this.progressBar = new Bar(240, 12, CONFIG.colors.gold);
      this.progressBar.position.set(-14, 8);
      const cancel = new Btn(ctx, {
        w: 40, h: 40, kind: 'dark', icon: 'iClose', iconScale: 0.7,
        onTap: () => { this.ctx.audio.play('uiBack'); this.sim.cancelBuild(pad); this.refreshBuildPanel(null); },
      });
      cancel.position.set(w / 2 - 26, 8);
      this.buildPanel.addChild(label, this.progressBar, cancel);
      this.progressBar.set(pad.progress / pad.goal);
      return;
    }

    // an occupied pad can only upgrade what is already there
    const options = pad.kind ? [pad.kind] : KINDS;
    const bw = pad.kind ? 150 : 92;
    options.forEach((kind, i) => {
      const maxed = pad.kind === kind && pad.level >= CONFIG.fort.upgradeMaxLevel;
      const cost = this.sim.fort.cost(pad, kind, this.sim.era);
      const b = new Btn(ctx, {
        w: bw, h: 58, kind: maxed ? 'dark' : 'gold',
        label: maxed ? 'MAX LEVEL' : pad.kind === kind ? `Upgrade ${KIND_LABEL[kind]}` : KIND_LABEL[kind],
        labelSize: 13,
        onTap: () => { this.sim.requestBuild(pad, kind); this.refreshBuildPanel(null); },
      });
      b.position.set((i - (options.length - 1) / 2) * (bw + 8), -2);
      if (!maxed) {
        const cn = uiText(`${cost} coins`, 11, CONFIG.colors.bg, '800');
        cn.position.set(0, 16);
        b.addChild(cn);
      }
      b.setEnabled(!maxed);
      this.buildPanel.addChild(b);
    });
  }

  // ---------------------------------------------------------------- loop

  step(dt: number): void {
    if (this.ending) return;
    this.sim.step(dt);
    this.waves.step(dt);
  }

  frame(dtReal: number, alpha: number): void {
    const ctx = this.ctx;
    const cam = ctx.camera;
    ctx.input.update(dtReal * CONFIG.king.speed);

    // a tap anywhere calls the rally; steering owns press-and-drag, so this is
    // the one gesture left that costs the player nothing to learn
    if (ctx.input.takeTap()) {
      const wx = cam.toWorldX(ctx.input.tapX);
      const wy = cam.toWorldY(ctx.input.tapY);
      if (this.sim.rally(wx, wy)) {
        ctx.audio.play('sfxWave', { vol: 0.5 });
        ctx.haptics.tap(CONFIG.fx.hapticEra);
        ctx.fx.shake(CONFIG.fx.shakeEraUp * 0.35);
        this.rallyMark.position.set(wx, wy);
        this.rallyMark.visible = true;
        this.rallyMark.alpha = 0.9;
        const ring = { s: 0.4, a: 0.9 };
        const tw = new Tween(ring)
          .to({ s: 1.8, a: 0 }, 520)
          .easing(Easing.Cubic.Out)
          .onUpdate(() => { this.rallyMark.scale.set(ring.s); this.rallyMark.alpha = ring.a; })
          .onComplete(() => { this.rallyMark.visible = false; })
          .start(performance.now());
        ctx.tweens.add(tw);
      } else {
        // refused, not swallowed: a tap on cooldown still answers
        ctx.audio.play('sfxHit', { vol: 0.25, throttleMs: 200 });
      }
    }

    this.sim.frame(dtReal, alpha);
    // the cooldown ring: the player needs to know when the verb is back
    this.rallyPip.scale.set(this.sim.rallyCool > 0 ? 0.55 : 1);
    this.rallyPip.alpha = this.sim.rallyCool > 0
      ? 0.3 + 0.4 * (1 - this.sim.rallyCool / CONFIG.king.rallyCooldown)
      : 1;
    cam.follow(this.sim.kx, this.sim.ky, this.sim.kvx, this.sim.kvy, dtReal);

    const cap = CONFIG.coins.carryCap * this.sim.stats.carry;
    this.carryNum.set(String(Math.floor(this.sim.carry)));
    this.carryBar.set(this.sim.carry / cap);
    this.keepBar.set(this.sim.fort.keepHp / this.sim.fort.keepMaxHp);
    this.kingBar.set(this.sim.kingHp / this.sim.kingMaxHp);
    this.waveText.text = `WAVE ${Math.min(CONFIG.waves.total, this.waves.wave + 1)}/${CONFIG.waves.total}`;
    this.phaseText.text = this.waves.phase === 'build'
      ? `build ${Math.ceil(Math.max(0, this.waves.buildLeft))}s`
      : this.waves.toSpawn > 0 ? 'incoming…' : `${this.sim.enemies.count} left`;

    this.refreshBuildPanel(this.sim.onPad);

    const inp = ctx.input;
    this.stick.visible = inp.active;
    if (inp.active) {
      const s = cam.uiScale;
      this.stickBase.position.set(inp.originX / s, inp.originY / s);
      const dx = inp.curX - inp.originX;
      const dy = inp.curY - inp.originY;
      const len = Math.hypot(dx, dy);
      const clamp = Math.min(len, 96);
      const nx = len > 0.001 ? (dx / len) * clamp : 0;
      const ny = len > 0.001 ? (dy / len) * clamp : 0;
      this.stickKnob.position.set((inp.originX + nx) / s, (inp.originY + ny) / s);
    }

    this.stepTutorial(dtReal);
  }

  private tutStage = 0;
  private tutHold = 0;
  private stepTutorial(dtReal: number): void {
    if (this.ctx.save.data.tutorialDone || this.tutStage >= 4) {
      if (this.tutorial.alpha > 0) this.tutorial.alpha = Math.max(0, this.tutorial.alpha - dtReal * 2);
      return;
    }
    const set = (t: string): void => { if (this.tutorial.text !== t) this.tutorial.text = t; this.tutorial.alpha = 1; };
    if (this.tutStage === 0) {
      set('Drag anywhere to march  ·  WASD works too');
      if (this.ctx.input.travelled > CONFIG.tutorial.moveDismissPx) this.tutStage = 1;
    } else if (this.tutStage === 1) {
      set('Your soldiers fight for you — sweep up the coins they drop');
      if (this.sim.carry >= CONFIG.tutorial.collectDismiss) this.tutStage = 2;
    } else if (this.tutStage === 2) {
      set('Stand on a glowing ring and spend coins to build');
      if (this.sim.fort.builtCount > 0) { this.tutStage = 3; this.tutHold = CONFIG.tutorial.holdSec; }
    } else {
      set('Hold the keep for 20 waves. The age advances every four.');
      this.tutHold -= dtReal;
      if (this.tutHold <= 0) {
        this.tutStage = 4;
        this.ctx.save.data.tutorialDone = true;
        this.ctx.save.mark();
      }
    }
  }

  private openPause(): void {
    if (this.ctx.loop.paused || this.ending) return;
    showPause(this.ctx, {
      onRestart: () => this.ctx.router.goto('run'),
      onQuit: () => this.ctx.router.goto('title'),
    });
  }

  private endRun(won: boolean, why: string): void {
    if (this.ending) return;
    this.ending = true;
    const ctx = this.ctx;
    const save = ctx.save.data;
    const banked = Math.floor(this.sim.carry);
    const shards = Math.round(
      banked * CONFIG.meta.shardPerCoin + this.waves.wave * CONFIG.meta.shardPerWave,
    );
    const newBest = this.waves.wave > save.bestWave;

    save.shards += shards;
    save.runs += 1;
    if (won) save.wins += 1;
    if (newBest) save.bestWave = this.waves.wave;
    if (this.sim.era > save.bestEra) save.bestEra = this.sim.era;
    ctx.save.flush();

    const result: RunResult = {
      won,
      wave: this.waves.wave,
      era: this.sim.era,
      coinsBanked: banked,
      kills: this.sim.kills,
      structures: this.sim.fort.builtCount,
      shardsEarned: shards,
      newBest,
      durationSec: (performance.now() - this.startedAt) / 1000,
      epitaph: why || 'The keep fell.',
    };

    ctx.audio.play(won ? 'sfxWin' : 'sfxLose');
    ctx.audio.music(null);
    ctx.fx.flash(0.5, 1.4);
    setTimeout(() => ctx.router.goto('results', result), won ? 1700 : 1300);
  }
}
