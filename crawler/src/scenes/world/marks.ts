import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG } from '../../config';
import { ISO_X, ISO_Y, screenX, screenY } from '../../iso';
import { Pool } from '../../core/pool';
import type { GameAtlas } from '../../assets/atlas';
import type { Enemy } from '../../world/entities';
import { NumberDisplay } from '../../ui/digits';

/**
 * The world's read-at-a-glance layer: the ring the crew stands in, the trail
 * that says where to go, the bars over things that are still alive, and the
 * pile of gold you are carrying.
 *
 * None of it is gameplay. All of it is the difference between a field of
 * identical blue people and a game you can play with your thumb.
 */

/**
 * A world-space circle projects to an axis-aligned ellipse whose semi-axes are
 * these multiples of the radius. Falling back to a plain circle here is the
 * single most obvious way to break the illusion that the ring lies flat on the
 * ground, so it is worth the two constants.
 */
const ELL_X = ISO_X * Math.SQRT2;    // ≈ 1.000
const ELL_Y = ISO_Y * Math.SQRT2;    // ≈ 0.577

/**
 * The white ring the crew stands in.
 *
 * It grows with the crowd, which makes the squad counter legible without
 * reading it: a ring that fills a third of the screen means something
 * different from one you could step over, and you learn that in one recruit.
 */
export class SquadRing extends Container {
  private g = new Graphics();
  private drawnR = -1;

  constructor() {
    super();
    this.addChild(this.g);
    this.eventMode = 'none';
  }

  /** `r` is the crowd's radius in WORLD units. */
  update(wx: number, wy: number, r: number): void {
    this.position.set(screenX(wx, wy), screenY(wx, wy));
    // redraw only on a real change: this is a tessellated ellipse, not a sprite
    if (Math.abs(r - this.drawnR) > 2) {
      this.drawnR = r;
      this.g.clear();
      this.g.ellipse(0, 0, r * ELL_X, r * ELL_Y)
        .stroke({ color: CONFIG.colors.white, width: 3.5, alpha: 0.85 });
      this.g.ellipse(0, 0, r * ELL_X, r * ELL_Y)
        .fill({ color: CONFIG.colors.white, alpha: 0.06 });
    }
  }
}

/**
 * The chevron trail: a dashed arrow along the ground from the crew to whatever
 * they should be walking at.
 *
 * The reference uses this instead of a minimap, and it is the better call on a
 * phone — a trail tells you the direction *and* the distance without asking you
 * to look away from the thing you are steering.
 */
export class ChevronTrail extends Container {
  private marks: Sprite[] = [];
  private phase = 0;

  constructor(atlas: GameAtlas, count = 9) {
    super();
    this.eventMode = 'none';
    for (let i = 0; i < count; i++) {
      const s = new Sprite(atlas.get('chevron'));
      s.anchor.set(0.5);
      s.scale.set(0.82);
      s.visible = false;
      this.marks.push(s);
      this.addChild(s);
    }
  }

  hide(): void { for (const m of this.marks) m.visible = false; }

  /**
   * Lay the trail from (fx, fy) toward (tx, ty), all in world units.
   * `gap` is the spacing in SCREEN pixels, so the trail reads evenly however
   * the projection has squashed that direction.
   */
  update(
    dt: number, fx: number, fy: number, tx: number, ty: number,
    tint: number, gap = 34, startPx = 56,
  ): void {
    const sx = screenX(fx, fy), sy = screenY(fx, fy);
    const dxs = screenX(tx - fx, ty - fy), dys = screenY(tx - fx, ty - fy);
    const len = Math.hypot(dxs, dys);
    if (len < startPx + gap) { this.hide(); return; }

    const ux = dxs / len, uy = dys / len;
    const angle = Math.atan2(dys, dxs) + Math.PI / 2;
    // the whole trail crawls toward the target, one gap per cycle
    this.phase = (this.phase + dt * 46) % gap;

    for (let i = 0; i < this.marks.length; i++) {
      const m = this.marks[i];
      const along = startPx + this.phase + i * gap;
      if (along > len - 8) { m.visible = false; continue; }
      m.visible = true;
      m.tint = tint;
      m.position.set(sx + ux * along, sy + uy * along);
      m.rotation = angle;
      // fade the head and tail so the trail has no hard ends
      const f = i / Math.max(1, this.marks.length - 1);
      m.alpha = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, f * 1.15));
    }
  }
}

interface BarView { view: Container; back: Sprite; fill: Sprite; }

/**
 * Health bars over anything still alive.
 *
 * Pooled sprites rather than a redrawn Graphics: with twenty enemies at 120 Hz
 * the difference between scaling a sprite and re-tessellating a rounded rect
 * is most of a frame.
 */
export class HealthBars extends Container {
  private pool: Pool<BarView>;

  constructor(atlas: GameAtlas, capacity = 48) {
    super();
    this.eventMode = 'none';
    this.pool = new Pool<BarView>(capacity, () => {
      const view = new Container();
      const back = new Sprite(atlas.get('bar'));
      back.anchor.set(0.5);
      back.tint = CONFIG.colors.ink;
      back.alpha = 0.75;
      const fill = new Sprite(atlas.get('bar'));
      fill.anchor.set(0, 0.5);
      view.addChild(back, fill);
      view.visible = false;
      this.addChild(view);
      return { view, back, fill };
    });
  }

  /** Re-lay every bar for this frame. Call once, then `commit`. */
  begin(): void {
    for (let i = 0; i < this.pool.count; i++) this.pool.items[i].view.visible = false;
    this.pool.releaseAll();
  }

  add(sx: number, sy: number, frac: number, width: number, tint: number): void {
    const b = this.pool.obtain();
    if (!b) return;
    const f = Math.max(0, Math.min(1, frac));
    b.view.visible = true;
    b.view.position.set(sx, sy);
    b.back.width = width;
    b.back.height = 7;
    b.fill.tint = tint;
    b.fill.height = 5;
    b.fill.width = Math.max(0.5, (width - 3) * f);
    b.fill.position.set(-width / 2 + 1.5, 0);
  }

  /** Bars for every enemy that has taken a scratch. */
  fromEnemies(items: Enemy[], count: number, alpha: number): void {
    this.begin();
    for (let i = 0; i < count; i++) {
      const e = items[i];
      // an untouched enemy gets no bar: a screen of full bars is noise, and
      // the bar appearing is itself the feedback that you connected
      if (e.hp >= e.maxHp) continue;
      const ex = e.px + (e.x - e.px) * alpha;
      const ey = e.py + (e.y - e.py) * alpha;
      const stat = CONFIG.enemies[e.kind];
      this.add(
        screenX(ex, ey), screenY(ex, ey) - (stat.radius * 1.7 + 20),
        e.hp / e.maxHp, e.kind === 'captain' ? 54 : 30, CONFIG.colors.hpRed,
      );
    }
  }
}

/**
 * The gold you are carrying, drawn as an actual pile on the hero's back.
 *
 * The purse is also a number in the corner, but the corner is not where the
 * player is looking. A stack that visibly grows as you walk over coins and
 * visibly drains on a recruit plate is the entire economy made physical.
 */
export class CoinStack extends Container {
  private coins: Sprite[] = [];
  private shown = -1;

  constructor(atlas: GameAtlas, private max = 9) {
    super();
    this.eventMode = 'none';
    for (let i = 0; i < max; i++) {
      const s = new Sprite(atlas.get('coin'));
      s.anchor.set(0.5, 1);
      s.scale.set(0.9);
      s.visible = false;
      // stacked bottom-up, each disc sitting on the one below
      s.position.set(0, -i * 7);
      this.coins.push(s);
      this.addChild(s);
    }
  }

  /** `coins` is the purse; the stack is a log scale so it never towers. */
  update(sx: number, sy: number, coins: number): void {
    this.position.set(sx, sy);
    const n = coins <= 0 ? 0 : Math.min(this.max, 1 + Math.floor(Math.log2(coins + 1)));
    if (n === this.shown) return;
    this.shown = n;
    for (let i = 0; i < this.coins.length; i++) this.coins[i].visible = i < n;
  }
}

/**
 * The number printed on a recruit plate: a coin and what the next body costs,
 * standing up out of the ground where the plate is.
 */
export class PadTag extends Container {
  private num: NumberDisplay;
  private icon: Sprite;
  private shown = -1;

  constructor(atlas: GameAtlas) {
    super();
    this.eventMode = 'none';
    this.icon = new Sprite(atlas.get('iconCoin'));
    this.icon.anchor.set(0.5);
    this.icon.scale.set(0.5);
    this.icon.tint = CONFIG.colors.gold;
    this.icon.position.set(-14, 0);
    this.num = new NumberDisplay(atlas, 3, 0.5, CONFIG.colors.white, 'left');
    this.num.position.set(-2, 0);
    this.addChild(this.icon, this.num);
  }

  set(sx: number, sy: number, cost: number, dry: boolean): void {
    this.position.set(sx, sy);
    this.alpha = dry ? 0.35 : 1;
    if (cost === this.shown) return;
    this.shown = cost;
    this.num.setValue(cost);
  }
}
