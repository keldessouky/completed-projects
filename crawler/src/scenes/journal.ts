import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { POI_KIND_LABEL, UI, WORLD_NAME } from '../flavour';
import { ACHIEVEMENTS, has } from '../game/achievements';
import { QUESTS, goalLabel, goalTarget } from '../world/quests';
import { getWorld, poiById } from '../world/worldgen';
import { Btn } from '../ui/button';
import { Bar, displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/**
 * The journal: what you were asked to do, what you have found, and what the
 * show has decided to congratulate you for. Three tabs because they answer
 * three different questions and only one of them is ever urgent.
 */
export class JournalScene extends Scene {
  private list = new Container();
  private tab: 'quests' | 'places' | 'awards' = 'quests';

  enter(): void {
    const ctx = this.ctx;
    if (!ctx.world) { ctx.router.goto('title'); return; }

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.ink);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText('JOURNAL', 24, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 32);
    const sub = uiText(WORLD_NAME, 11, CONFIG.colors.boneDim);
    sub.position.set(W / 2, topY + 54);
    this.container.addChild(title, sub);

    const tabY = topY + 84;
    const mk = (label: string, key: 'quests' | 'places' | 'awards', x: number): void => {
      const b = new Btn(ctx, {
        w: 124, h: 44, kind: this.tab === key ? 'gold' : 'dark', label, labelSize: 14,
        onTap: () => { this.tab = key; this.rebuild(); },
      });
      b.position.set(x, tabY);
      this.container.addChild(b);
    };
    mk('Quests', 'quests', W / 2 - 132);
    mk('Places', 'places', W / 2);
    mk('Awards', 'awards', W / 2 + 132);

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
    this.list.removeChildren().forEach((c) => c.destroy({ children: true }));
    // the tab chrome lives outside the list, so redraw it by re-entering
    for (const child of this.container.children) {
      if (child instanceof Btn) { /* tabs restyle on next enter; cheap enough */ }
    }
    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const y0 = topY + 122;
    if (this.tab === 'quests') this.quests(y0);
    else if (this.tab === 'places') this.places(y0);
    else this.awards(y0);
  }

  private quests(y0: number): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    let y = y0;
    let shown = 0;

    // active and ready first — those are the ones with something to do
    const order = ['ready', 'active', 'offered', 'done'] as const;
    for (const want of order) {
      for (const q of QUESTS) {
        const st = ws.state(q.id);
        if (st !== want) continue;
        shown++;
        const prog = ws.getProgress(q.id);
        const h = 78;
        const wrap = new Container();
        wrap.position.set(W / 2, y + h / 2);
        wrap.addChild(panel(ctx, W - 24, h));

        const tint = st === 'ready' ? CONFIG.colors.amberBright
          : st === 'done' ? CONFIG.colors.stoneDim
          : st === 'active' ? CONFIG.colors.bone
          : CONFIG.colors.boneDim;
        const name = uiText(q.title, 15, tint, '600');
        name.anchor.set(0, 0.5);
        name.position.set(-W / 2 + 20, -h / 2 + 18);

        const state = uiText(
          st === 'ready' ? 'READY TO HAND IN' : st === 'done' ? 'COMPLETE' : st.toUpperCase(),
          8, tint, '800',
        );
        state.anchor.set(1, 0.5);
        state.position.set(W / 2 - 20, -h / 2 + 18);

        const brief = uiText(st === 'done' ? q.done : q.brief, 10, CONFIG.colors.boneDim, '400', W - 60);
        brief.anchor.set(0, 0);
        brief.style.align = 'left';
        brief.position.set(-W / 2 + 20, -h / 2 + 30);
        wrap.addChild(name, state, brief);

        if (st === 'active' || st === 'ready') {
          const bar = new Bar(W - 60, 6, CONFIG.colors.sysBright);
          bar.position.set(0, h / 2 - 16);
          bar.set(Math.min(1, prog / goalTarget(q)));
          const label = uiText(goalLabel(q, prog), 9, CONFIG.colors.sysBright, '600');
          label.position.set(0, h / 2 - 28);
          wrap.addChild(bar, label);
        }
        this.list.addChild(wrap);
        y += h + 8;
      }
    }
    if (shown === 0) {
      const empty = uiText(UI.noQuests, 12, CONFIG.colors.boneDim);
      empty.position.set(W / 2, y0 + 20);
      this.list.addChild(empty);
    }
  }

  private places(y0: number): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    let y = y0;
    const found = getWorld().pois.filter((p) => ws.discovered.has(p.id));

    const head = uiText(
      `${found.length} of ${getWorld().pois.length} places found`,
      11, CONFIG.colors.sysBright, '600',
    );
    head.position.set(W / 2, y);
    this.list.addChild(head);
    y += 22;

    const maxY = H - Math.max(ctx.scaler.safeBottom(), 10) - 80;
    for (const p of found) {
      if (y > maxY) break;
      const wrap = new Container();
      wrap.position.set(W / 2, y + 20);
      wrap.addChild(panel(ctx, W - 24, 40));
      const name = uiText(p.name, 13, CONFIG.colors.bone, '600');
      name.anchor.set(0, 0.5);
      name.position.set(-W / 2 + 20, -4);
      const kind = uiText(POI_KIND_LABEL[p.kind], 9, CONFIG.colors.boneDim, '600');
      kind.anchor.set(0, 0.5);
      kind.position.set(-W / 2 + 20, 11);
      const state = uiText(
        p.kind === 'camp' || p.kind === 'lair'
          ? (ws.isCleared(p.id) ? 'CLEARED' : 'ACTIVE')
          : p.kind === 'shrine' ? (ws.shrines.has(p.id) ? 'USED' : 'UNUSED') : '',
        8,
        ws.isCleared(p.id) || ws.shrines.has(p.id) ? CONFIG.colors.stoneDim : CONFIG.colors.amberBright,
        '800',
      );
      state.anchor.set(1, 0.5);
      state.position.set(W / 2 - 20, 0);
      wrap.addChild(name, kind, state);
      this.list.addChild(wrap);
      y += 46;
    }
    void poiById;
  }

  private awards(y0: number): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    let y = y0;
    const maxY = H - Math.max(ctx.scaler.safeBottom(), 10) - 80;

    const head = uiText(
      `${save.achievements.length} of ${ACHIEVEMENTS.length} unlocked`,
      11, CONFIG.colors.sysBright, '600',
    );
    head.position.set(W / 2, y);
    this.list.addChild(head);
    y += 22;

    for (const a of ACHIEVEMENTS) {
      if (y > maxY) break;
      const got = has(save, a.id);
      const wrap = new Container();
      wrap.position.set(W / 2, y + 22);
      wrap.addChild(panel(ctx, W - 24, 44));
      const name = uiText(got ? a.name : '???', 13, got ? CONFIG.colors.amberBright : CONFIG.colors.stoneDim, '600');
      name.anchor.set(0, 0.5);
      name.position.set(-W / 2 + 20, -5);
      const desc = uiText(a.desc, 9, CONFIG.colors.boneDim, '400');
      desc.anchor.set(0, 0.5);
      desc.position.set(-W / 2 + 20, 11);
      wrap.addChild(name, desc);
      this.list.addChild(wrap);
      y += 50;
    }
  }
}
