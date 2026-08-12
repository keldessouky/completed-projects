import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG } from '../config';
import { UI } from '../flavour';
import type { GameAtlas } from '../assets/atlas';
import { uiText } from '../ui/widgets';

const W = CONFIG.design.width;

type Tone = 'info' | 'good' | 'bad';

/** An achievement unlock, which gets a card instead of a line. */
export interface CardData {
  name: string;
  sting: string;
  coins: number;
}

interface Note {
  view: Container;
  t: number;      // seconds shown
  h: number;      // measured height
  y: number;      // current y
  targetY: number;
}

/**
 * The System's notification feed: boxed, deadpan messages that stack down
 * from the top of the screen and expire on their own.
 *
 * It lives on the game context rather than in a scene, because notifications
 * routinely outlive the scene that raised them — a level-up fired by the last
 * arrow of an encounter should still be readable on the floor map two
 * transitions later.
 */
export class SystemFeed {
  root = new Container();
  /** on screen right now — never more than CONFIG.system.maxVisible */
  private notes: Note[] = [];
  /** waiting for a slot; the System is verbose but it takes turns */
  private pending: { lines: readonly string[]; tone: Tone; card?: CardData }[] = [];
  private topY = 0;
  /** set once at boot; only the achievement card needs artwork */
  atlas: GameAtlas | null = null;

  constructor() {
    this.root.zIndex = 400;
    this.root.eventMode = 'none';
  }

  /** Move the anchor. Scenes call this on enter so the feed dodges their HUD. */
  setTop(y: number): void {
    if (this.topY === y) return;
    this.topY = y;
    this.relayout();
  }

  /**
   * Queue a notification. Only a couple are ever on screen at once — three
   * stacked boxes cover the header of whatever scene raised them, and the
   * System is funnier one line at a time than as a wall.
   */
  push(lines: readonly string[], tone: Tone = 'info'): void {
    if (lines.length === 0) return;
    if (this.notes.length >= CONFIG.system.maxVisible) {
      if (this.pending.length < CONFIG.system.maxQueue) this.pending.push({ lines, tone });
      return;
    }
    this.show(lines, tone);
  }

  /**
   * An achievement gets a card, not a line.
   *
   * The System hands these out constantly and the joke only lands if the thing
   * arrives with the pomp of an award and the content of a parking notice — so
   * it is the same feed, the same queue and the same timer, with gold trim.
   */
  pushAchievement(card: CardData): void {
    if (this.notes.length >= CONFIG.system.maxVisible) {
      if (this.pending.length < CONFIG.system.maxQueue) {
        this.pending.push({ lines: [], tone: 'good', card });
      }
      return;
    }
    this.showCard(card);
  }

  private showCard(card: CardData): void {
    const width = CONFIG.system.width;
    const pad = 14;
    const view = new Container();
    const gold = CONFIG.colors.gold;

    const header = uiText(UI.achievement, 10, gold, '800');
    header.anchor.set(0, 0);
    header.style.letterSpacing = 2;
    header.position.set(pad + 46, pad);

    const name = uiText(card.name, 19, CONFIG.colors.bone, '800');
    name.anchor.set(0, 0);
    name.position.set(pad + 46, pad + 15);

    const sting = uiText(card.sting, 12, CONFIG.colors.boneDim, '400');
    sting.anchor.set(0, 0);
    sting.style.align = 'left';
    sting.style.wordWrap = true;
    sting.style.wordWrapWidth = width - pad * 2 - 52;
    sting.position.set(pad + 46, pad + 40);

    const reward = uiText(`${UI.rewardBox}: ${card.coins} gold`, 12, gold, '700');
    reward.anchor.set(0, 0);
    reward.position.set(pad + 46, pad + 42 + Math.max(16, sting.height));

    const h = reward.y + reward.height + pad;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, 4)
      .fill({ color: CONFIG.colors.ink, alpha: 0.95 })
      .stroke({ color: gold, width: 2, alpha: 0.95 });
    bg.rect(0, 3, 4, h - 6).fill({ color: gold, alpha: 0.95 });

    view.addChild(bg, header, name, sting, reward);
    if (this.atlas) {
      const star = new Sprite(this.atlas.get('iconStar'));
      star.anchor.set(0.5);
      star.scale.set(0.78);
      star.tint = gold;
      star.position.set(pad + 18, h / 2);
      view.addChild(star);
    }

    view.position.set((W - width) / 2, this.topY);
    view.alpha = 0;
    this.root.addChild(view);

    const note: Note = { view, t: 0, h, y: this.topY, targetY: 0 };
    this.notes.push(note);
    this.relayout();
    note.y = note.targetY - 16;
  }

  private show(lines: readonly string[], tone: Tone): void {
    const pad = 14;
    const lh = CONFIG.system.lineHeight;
    const width = CONFIG.system.width;
    const view = new Container();

    const accent = tone === 'good' ? CONFIG.colors.hpGreen
      : tone === 'bad' ? CONFIG.colors.hpRed
      : CONFIG.colors.ally;

    const body = new Container();
    // Stack on MEASURED height, not on line index: any of these lines can wrap
    // to two, and an index-stepped layout draws the next one straight through it.
    let y = pad;
    lines.forEach((line, i) => {
      // The first line is the headline; the rest is the System being unhelpful.
      const t = uiText(line, i === 0 ? 15 : 13, i === 0 ? CONFIG.colors.bone : CONFIG.colors.boneDim,
        i === 0 ? '600' : '400');
      t.anchor.set(0, 0);
      // left-align explicitly: uiText centres by default, which leaves a
      // wrapped second line floating in the middle of the box
      t.style.align = 'left';
      t.style.wordWrap = true;
      t.style.wordWrapWidth = width - pad * 2 - 6;
      t.position.set(pad + 4, y);
      body.addChild(t);
      y += Math.max(lh, t.height + 2);
    });
    const h = y + pad - 2;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, h, 4)
      .fill({ color: CONFIG.colors.ink, alpha: 0.93 })
      .stroke({ color: accent, width: 1.5, alpha: 0.85 });
    // a solid rule down the left edge — the System's letterhead
    bg.rect(0, 3, 3, h - 6).fill({ color: accent, alpha: 0.95 });

    view.addChild(bg, body);
    view.position.set((W - width) / 2, this.topY);
    view.alpha = 0;
    this.root.addChild(view);

    const note: Note = { view, t: 0, h, y: this.topY, targetY: 0 };
    this.notes.push(note);
    this.relayout();
    note.y = note.targetY - 16; // slide in from just above its resting place
  }

  private relayout(): void {
    let y = this.topY;
    for (const n of this.notes) {
      n.targetY = y;
      y += n.h + 8;
    }
  }

  private retire(i: number): void {
    const n = this.notes[i];
    if (!n) return;
    n.view.destroy({ children: true });
    this.notes.splice(i, 1);
    this.relayout();
  }

  /** Real-time update; notifications ignore slow-mo and pause. */
  update(dtReal: number): void {
    const showSec = CONFIG.system.showMs / 1000;
    const fadeSec = CONFIG.system.fadeMs / 1000;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.t += dtReal;
      if (n.t >= showSec) {
        this.retire(i);
        // a slot opened: let the next queued message in
        const next = this.pending.shift();
        if (next?.card) this.showCard(next.card);
        else if (next) this.show(next.lines, next.tone);
        continue;
      }
      n.y += (n.targetY - n.y) * Math.min(1, 14 * dtReal);
      n.view.y = n.y;
      const fadeIn = Math.min(1, n.t / fadeSec);
      const fadeOut = Math.min(1, (showSec - n.t) / fadeSec);
      n.view.alpha = Math.min(fadeIn, fadeOut) * 0.98;
    }
  }

  clear(): void {
    this.pending.length = 0;
    while (this.notes.length > 0) this.retire(0);
  }
}
