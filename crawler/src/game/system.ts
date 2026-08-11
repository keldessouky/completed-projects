import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { uiText } from '../ui/widgets';

const W = CONFIG.design.width;

type Tone = 'info' | 'good' | 'bad';

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
  private pending: { lines: string[]; tone: Tone }[] = [];
  private topY = 0;

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
  push(lines: string[], tone: Tone = 'info'): void {
    if (lines.length === 0) return;
    if (this.notes.length >= CONFIG.system.maxVisible) {
      if (this.pending.length < CONFIG.system.maxQueue) this.pending.push({ lines, tone });
      return;
    }
    this.show(lines, tone);
  }

  private show(lines: string[], tone: Tone): void {
    const pad = 14;
    const lh = CONFIG.system.lineHeight;
    const width = CONFIG.system.width;
    const view = new Container();

    const accent = tone === 'good' ? CONFIG.colors.goodTeal
      : tone === 'bad' ? CONFIG.colors.trapRed
      : CONFIG.colors.sysBright;

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
      .fill({ color: CONFIG.colors.pit, alpha: 0.93 })
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
        if (next) this.show(next.lines, next.tone);
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
