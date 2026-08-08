import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG, type MetaKey } from '../config';
import { displayFont, FONT_CIRCUIT, FONT_CROWN } from '../assets/fonts';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { showSettings } from '../ui/overlays';
import { displayText, panel, uiText } from '../ui/widgets';
import type { RunResult } from '../types';
import { Scene } from './scene';

/** A slow drift of era colours behind the menus — the whole arc in one image. */
function menuBackdrop(ctx: { camera: { uiW: number; uiH: number } }): Graphics {
  const g = new Graphics();
  const W = ctx.camera.uiW;
  const H = ctx.camera.uiH;
  g.rect(0, 0, W, H).fill(CONFIG.colors.bg);
  // five era bands, faint, left to right
  for (let e = 0; e < 5; e++) {
    g.rect((W / 5) * e, 0, W / 5 + 1, H).fill({ color: CONFIG.palettes[e].ground, alpha: 0.55 });
    g.rect((W / 5) * e, H * 0.62, W / 5 + 1, 3).fill({ color: CONFIG.palettes[e].accent, alpha: 0.55 });
  }
  return g;
}

export class TitleScene extends Scene {
  private bg!: Graphics;
  private wrap = new Container();

  enter(): void {
    const ctx = this.ctx;
    this.bg = menuBackdrop(ctx);
    this.ui.addChild(this.bg, this.wrap);

    const save = ctx.save.data;

    const crown = new Text({
      text: 'CROWN',
      style: { fontFamily: FONT_CROWN, fontSize: 52, fontWeight: '900', fill: CONFIG.colors.gold, letterSpacing: 3 },
    });
    crown.anchor.set(0.5);
    const amp = uiText('&', 24, CONFIG.colors.inkDim, '400');
    const circuit = new Text({
      text: 'CIRCUIT',
      style: { fontFamily: FONT_CIRCUIT, fontSize: 46, fontWeight: '900', fill: 0x5cf5ff, letterSpacing: 4 },
    });
    circuit.anchor.set(0.5);
    const tag = uiText('Haul the gold. Raise the fort. Hold the line from swords to lasers.',
      14, CONFIG.colors.inkDim, '400', 420);

    const play = new Btn(ctx, {
      w: 260, h: 66, kind: 'gold', label: 'MARCH', labelSize: 22,
      onTap: () => ctx.router.goto('run'),
    });
    const shop = new Btn(ctx, {
      w: 260, h: 54, kind: 'blue', label: 'War Table', labelSize: 18,
      onTap: () => ctx.router.goto('shop'),
    });
    const gear = new Btn(ctx, { w: 50, h: 50, kind: 'dark', icon: 'iGear', onTap: () => showSettings(ctx) });

    const stat = uiText(
      save.runs > 0
        ? `${save.runs} runs · best wave ${save.bestWave}/${CONFIG.waves.total} · ${save.shards} shards`
        : 'a new reign',
      13, CONFIG.colors.inkDim,
    );

    this.wrap.addChild(crown, amp, circuit, tag, play, shop, gear, stat);
    this.parts = { crown, amp, circuit, tag, play, shop, gear, stat };

    const st = { a: 1 };
    const tw = new Tween(st).to({ a: 0.45 }, 950).easing(Easing.Sinusoidal.InOut)
      .yoyo(true).repeat(Infinity)
      .onUpdate(() => { play.alpha = st.a; })
      .start(performance.now());
    ctx.tweens.add(tw);

    ctx.audio.music('musicTitle');
    this.layout();
  }
  private parts!: Record<string, Container>;

  override layout(): void {
    if (!this.parts) return;
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    this.bg.clear();
    this.bg.rect(0, 0, W, H).fill(CONFIG.colors.bg);
    for (let e = 0; e < 5; e++) {
      this.bg.rect((W / 5) * e, 0, W / 5 + 1, H).fill({ color: CONFIG.palettes[e].ground, alpha: 0.55 });
      this.bg.rect((W / 5) * e, H * 0.66, W / 5 + 1, 3).fill({ color: CONFIG.palettes[e].accent, alpha: 0.6 });
    }
    const p = this.parts;
    p.crown.position.set(W / 2, H * 0.22);
    p.amp.position.set(W / 2, H * 0.22 + 40);
    p.circuit.position.set(W / 2, H * 0.22 + 82);
    p.tag.position.set(W / 2, H * 0.22 + 130);
    p.play.position.set(W / 2, H * 0.58);
    p.shop.position.set(W / 2, H * 0.58 + 78);
    p.gear.position.set(W - 40, Math.max(cam.safeTop, 10) + 36);
    p.stat.position.set(W / 2, H - Math.max(cam.safeBottom, 10) - 24);
  }
}

export class ResultsScene extends Scene {
  private r!: RunResult;
  private wrap = new Container();
  private bg!: Graphics;

  enter(data?: unknown): void {
    const ctx = this.ctx;
    this.r = data as RunResult;
    this.bg = menuBackdrop(ctx);
    this.ui.addChild(this.bg, this.wrap);

    const won = this.r.won;
    const head = new Text({
      text: won ? 'THE AGE IS YOURS' : 'THE KEEP HAS FALLEN',
      style: {
        fontFamily: displayFont(this.r.era), fontSize: 30, fontWeight: '900',
        fill: won ? CONFIG.colors.gold : CONFIG.colors.bad, align: 'center',
      },
    });
    head.anchor.set(0.5);

    const sub = uiText(
      won
        ? `You carried a bronze-age levy all the way to ${CONFIG.eras[4].name}.`
        : this.r.epitaph,
      15, CONFIG.colors.ink, '600', 420,
    );

    const rows = new Container();
    const stat = (i: number, label: string, value: string, tint: number = CONFIG.colors.ink): void => {
      const l = uiText(label, 15, CONFIG.colors.inkDim, '600');
      l.anchor.set(0, 0.5);
      l.position.set(-140, i * 34);
      const v = new NumberDisplay(ctx.atlas, 7, 0.48, tint, 'right');
      v.position.set(140, i * 34);
      v.set(value);
      rows.addChild(l, v);
    };
    stat(0, 'Waves survived', `${this.r.wave}/${CONFIG.waves.total}`);
    stat(1, 'Enemies felled', String(this.r.kills));
    stat(2, 'Structures raised', String(this.r.structures));
    stat(3, 'Coins in hand', String(this.r.coinsBanked), CONFIG.colors.gold as number);
    stat(4, 'Shards earned', String(this.r.shardsEarned), 0x9fe8ff);

    const eraLine = uiText(
      `reached ${CONFIG.eras[this.r.era].name} — ${CONFIG.eras[this.r.era].weapon}`,
      13, CONFIG.palettes[this.r.era].accent, '600',
    );

    const best = uiText('NEW BEST', 14, CONFIG.colors.good, '800');
    best.visible = this.r.newBest;

    const again = new Btn(ctx, {
      w: 200, h: 60, kind: 'gold', label: 'March Again', labelSize: 19,
      onTap: () => ctx.router.goto('run'),
    });
    const shop = new Btn(ctx, {
      w: 200, h: 52, kind: 'blue', label: 'War Table', labelSize: 17,
      onTap: () => ctx.router.goto('shop'),
    });
    const home = new Btn(ctx, {
      w: 200, h: 46, kind: 'dark', label: 'Title', labelSize: 15,
      onTap: () => ctx.router.goto('title'),
    });

    this.wrap.addChild(head, sub, rows, eraLine, best, again, shop, home);
    this.parts = { head, sub, rows, eraLine, best, again, shop, home };
    ctx.audio.music('musicTitle');
    this.layout();
  }
  private parts!: Record<string, Container>;

  override layout(): void {
    if (!this.parts) return;
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    this.bg.clear();
    this.bg.rect(0, 0, W, H).fill(CONFIG.colors.bg);
    for (let e = 0; e <= this.r.era; e++) {
      this.bg.rect((W / 5) * e, 0, W / 5 + 1, H).fill({ color: CONFIG.palettes[e].ground, alpha: 0.6 });
    }
    const p = this.parts;
    p.head.position.set(W / 2, H * 0.14);
    p.sub.position.set(W / 2, H * 0.21);
    p.rows.position.set(W / 2, H * 0.36);
    p.eraLine.position.set(W / 2, H * 0.36 + 5 * 34 + 6);
    p.best.position.set(W / 2 + 120, H * 0.36 - 26);
    p.again.position.set(W / 2, H * 0.74);
    p.shop.position.set(W / 2, H * 0.74 + 66);
    p.home.position.set(W / 2, H * 0.74 + 124);
  }
}

/** The War Table: permanent upgrades bought with shards. */
export class ShopScene extends Scene {
  private wrap = new Container();
  private bg!: Graphics;
  private shardNum!: NumberDisplay;

  enter(): void {
    const ctx = this.ctx;
    this.bg = menuBackdrop(ctx);
    this.ui.addChild(this.bg, this.wrap);

    const title = displayText('THE WAR TABLE', 26, CONFIG.colors.ink, '900');
    const shardIcon = new Sprite(ctx.atlas.get('shard'));
    shardIcon.anchor.set(0.5);
    shardIcon.scale.set(0.8);
    this.shardNum = new NumberDisplay(ctx.atlas, 7, 0.5, 0x9fe8ff, 'left');
    const back = new Btn(ctx, { w: 50, h: 50, kind: 'dark', icon: 'iClose', onTap: () => ctx.router.goto('title') });
    const hint = uiText('Shards come home from every run, won or lost.', 13, CONFIG.colors.inkDim);
    this.wrap.addChild(title, shardIcon, this.shardNum, back, hint);
    this.parts = { title, shardIcon, back, hint };
    this.rebuild();
    ctx.audio.music('musicTitle');
    this.layout();
  }
  private parts!: Record<string, Container>;
  private cards = new Container();

  private rebuild(): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    this.shardNum.set(String(save.shards));
    if (!this.cards.parent) this.wrap.addChild(this.cards);
    this.cards.removeChildren().forEach((c) => c.destroy({ children: true }));

    const keys = Object.keys(CONFIG.meta.upgrades) as MetaKey[];
    keys.forEach((key, i) => {
      const track = CONFIG.meta.upgrades[key];
      const level = save.meta[key];
      const maxed = level >= CONFIG.meta.maxLevel;
      const cost = maxed ? 0 : track.costs[level];
      const afford = !maxed && save.shards >= cost;

      const row = new Container();
      row.addChild(panel(ctx, 420, 74));
      const name = uiText(track.name, 16, CONFIG.colors.ink, '800');
      name.anchor.set(0, 0.5);
      name.position.set(-196, -16);
      const desc = uiText(track.desc, 12, CONFIG.colors.inkDim);
      desc.anchor.set(0, 0.5);
      desc.position.set(-196, 6);
      const pips = new Graphics();
      for (let p = 0; p < CONFIG.meta.maxLevel; p++) {
        pips.roundRect(-196 + p * 22, 18, 16, 8, 4)
          .fill(p < level ? CONFIG.colors.gold : CONFIG.colors.panel)
          .stroke({ color: CONFIG.colors.inkDim, width: 1, alpha: 0.6 });
      }
      row.addChild(name, desc, pips);

      if (maxed) {
        const m = uiText('MAX', 16, CONFIG.colors.good, '800');
        m.position.set(150, 0);
        row.addChild(m);
      } else {
        const buy = new Btn(ctx, {
          w: 110, h: 52, kind: afford ? 'gold' : 'dark', silent: true,
          onTap: () => this.buy(key, cost),
        });
        buy.position.set(150, 0);
        const c = uiText(`${cost}`, 15, afford ? CONFIG.colors.bg : CONFIG.colors.inkDim, '800');
        c.position.set(4, 0);
        const si = new Sprite(ctx.atlas.get('shard'));
        si.anchor.set(0.5);
        si.scale.set(0.5);
        si.position.set(-22, 0);
        buy.addChild(si, c);
        buy.setEnabled(afford);
        row.addChild(buy);
      }
      row.position.set(0, i * 84);
      this.cards.addChild(row);
    });
    this.layout();
  }

  private buy(key: MetaKey, cost: number): void {
    const save = this.ctx.save.data;
    if (save.shards < cost || save.meta[key] >= CONFIG.meta.maxLevel) return;
    save.shards -= cost;
    save.meta[key] += 1;
    this.ctx.save.mark();
    this.ctx.audio.play('sfxBuild', { vol: 0.6 });
    this.rebuild();
  }

  override layout(): void {
    if (!this.parts) return;
    const cam = this.ctx.camera;
    const W = cam.uiW;
    const H = cam.uiH;
    const top = Math.max(cam.safeTop, 10);
    this.bg.clear();
    this.bg.rect(0, 0, W, H).fill(CONFIG.colors.bg);
    for (let e = 0; e < 5; e++) {
      this.bg.rect((W / 5) * e, 0, W / 5 + 1, H).fill({ color: CONFIG.palettes[e].ground, alpha: 0.45 });
    }
    const p = this.parts;
    p.title.position.set(W / 2, top + 34);
    p.shardIcon.position.set(W / 2 - 40, top + 68);
    this.shardNum.position.set(W / 2 - 24, top + 68);
    p.back.position.set(W - 40, top + 34);
    this.cards.position.set(W / 2, top + 140);
    p.hint.position.set(W / 2, H - Math.max(cam.safeBottom, 10) - 22);
  }
}
