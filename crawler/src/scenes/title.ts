import { Container, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import { CAST, CORP, GAME_SUBTITLE, GAME_TITLE, SHOW, floorName } from '../flavour';
import { RunState } from '../game/runstate';
import * as stats from '../game/stats';
import { Btn } from '../ui/button';
import { showConfirm, showSettings } from '../ui/overlays';
import { displayText, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

export class TitleScene extends Scene {
  enter(): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    const art = ctx.backdrops[0];

    const sky = new Sprite(art.sky);
    sky.anchor.set(0.5, 0);
    sky.position.set(W / 2, -240);
    sky.width = W + 480;
    sky.height = H + 480;
    const far = new Sprite(art.far);
    far.anchor.set(0.5, 1);
    far.position.set(W / 2, H + 40);
    far.alpha = 0.85;
    this.container.addChild(sky, far);

    const emblem = new Sprite(ctx.atlas.get('emblem'));
    emblem.anchor.set(0.5);
    emblem.scale.set(1.9);
    emblem.position.set(W / 2, H * 0.26);
    this.container.addChild(emblem);

    const title = displayText(GAME_TITLE, 62, CONFIG.colors.bone, '900');
    title.position.set(W / 2, H * 0.42);
    const sub = displayText(GAME_SUBTITLE.toUpperCase(), 19, CONFIG.colors.sysBright, '700');
    sub.position.set(W / 2, H * 0.475);
    const tag = uiText(`A ${CORP} production. ${SHOW}.`, 12, CONFIG.colors.boneDim);
    tag.position.set(W / 2, H * 0.515);
    this.container.addChild(title, sub, tag);

    // ── the buttons ──
    const resume = save.inProgress ? RunState.fromSave(save.inProgress) : null;
    const btns = new Container();
    let y = H * 0.615;

    if (resume) {
      this.button(btns, y, 'Resume Crawl', 'gold', () => this.start(resume));
      const note = uiText(
        `${floorName(resume.floor)} · ${Math.floor(resume.timeLeft / 60)}:${String(Math.round(resume.timeLeft % 60)).padStart(2, '0')} left · party ${resume.party}`,
        11, CONFIG.colors.boneDim,
      );
      note.position.set(W / 2, y + 40);
      btns.addChild(note);
      y += 96;
      this.button(btns, y, 'Abandon & Restart', 'dark', () => {
        showConfirm(ctx, {
          title: 'Abandon the crawl?',
          body: 'The floor resets. Gold and levels you already banked are kept.',
          yesLabel: 'Abandon',
          onYes: () => {
            save.inProgress = null;
            ctx.save.flush();
            ctx.router.goto('title');
          },
        });
      });
      y += 88;
    } else {
      this.button(btns, y, 'Enter the Dungeon', 'gold', () => this.start(null));
      y += 88;
    }

    this.button(btns, y, 'Character', 'blue', () => ctx.router.goto('charsheet', { from: 'title' }));
    this.container.addChild(btns);

    // pulse the primary action so the entry point is never ambiguous
    const state = { a: 1 };
    const tw = new Tween(state)
      .to({ a: 0.55 }, 1100)
      .easing(Easing.Sinusoidal.InOut)
      .yoyo(true)
      .repeat(Infinity)
      .onUpdate(() => { if (btns.children[0]) btns.children[0].alpha = state.a; })
      .start(performance.now());
    ctx.tweens.add(tw);

    const stat = uiText(
      save.totalRuns > 0
        ? `${save.totalRuns} crawls · ${save.totalDeaths} deaths · level ${save.level}`
        : `${CAST.hero} and ${CAST.companion}. No plan.`,
      12, CONFIG.colors.boneDim,
    );
    stat.position.set(W / 2, H - Math.max(ctx.scaler.safeBottom(), 12) - 18);
    stat.alpha = 0.75;
    this.container.addChild(stat);

    const gear = new Btn(ctx, { w: 56, h: 56, kind: 'dark', icon: 'iconGear', onTap: () => showSettings(ctx) });
    gear.position.set(W - 44, Math.max(ctx.scaler.safeTop(), 12) + 40);
    this.container.addChild(gear);

    ctx.audio.music('musicTitle');
  }

  private button(parent: Container, y: number, label: string, kind: 'gold' | 'blue' | 'dark', onTap: () => void): void {
    const b = new Btn(this.ctx, { w: 262, h: 64, kind, label, labelSize: 20, onTap });
    b.position.set(W / 2, y);
    parent.addChild(b);
  }

  /** Begin (or resume) a floor and hand off to the map. */
  private start(resume: RunState | null): void {
    const ctx = this.ctx;
    ctx.audio.play('uiTap');
    ctx.system.clear();
    ctx.run = resume ?? new RunState(0, stats.startParty(ctx.save.data));
    ctx.save.data.inProgress = ctx.run.toSave();
    ctx.save.flush();
    ctx.router.goto('floormap');
  }
}
