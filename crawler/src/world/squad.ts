import { Container, Sprite } from 'pixi.js';
import { CONFIG } from '../config';
import { Pool } from '../core/pool';
import { screenX, screenY } from '../iso';
import { LOOK_S, STRIDE, frameFor, frameName, lookFrom, type Look } from '../anim';
import type { GameAtlas } from '../assets/atlas';

/**
 * The crowd behind you.
 *
 * The squad IS the power curve — how many people are following you is your
 * damage, your health bar and your score at once — so it gets its own module
 * rather than being a field on the world state.
 *
 * Two things make a crowd of sixty feel like a crowd rather than a conga line:
 * every member owns a *slot* in a ring packing around the hero and springs
 * toward it (so the shape is stable and legible), and the spring is slightly
 * underdamped with a per-member phase (so the shape is never still).
 */

export interface Member {
  sp: Sprite;
  x: number; y: number;
  vx: number; vy: number;
  /** which formation slot this member holds */
  slot: number;
  /** walk-cycle position in cycles, advanced by distance travelled */
  phase: number;
  /** the facing last drawn, kept so a stopped member does not snap to south */
  look: Look;
  /**
   * Promotion rank: 0 straggler … CONFIG.squad.maxRank champion.
   *
   * Rank is worth, art and damage all at once — see CONFIG.squad.rankWorth.
   */
  rank: number;
  /**
   * Worth already knocked off this unit.
   *
   * Units are atomic — you cannot field two thirds of a knight — but losses
   * are counted in WORTH, so a hit that does not finish a unit has to be
   * remembered somewhere. When `hurt` reaches the unit's worth it dies and
   * any excess carries to the next one.
   */
  hurt: number;
  /** >0 while this member is being consumed by a merge */
  merging: number;
  /** where the merge is pulling it, so the five converge on one point */
  mx: number; my: number;
  /** counts down while the attack pose plays */
  attackT: number;
  /** attack cooldown, seconds */
  cd: number;
  /** >0 while dying: the fly-off before the sprite is returned to the pool */
  dying: number;
  dx: number; dy: number;
  /**
   * Which alternate look this member wears, fixed for its whole life.
   *
   * Rolled once on recruitment rather than derived from the slot, because
   * slots are re-packed every time somebody dies — deriving the look from the
   * slot would make the whole crowd change clothes each time it took a hit.
   */
  variant: number;
}

const SQ = CONFIG.squad;

/** How far back the whole crew is pushed in the depth sort. See draw(). */
const CROWD_DEPTH_BIAS = 400;

/**
 * Formation slot → offset from the hero, in world units.
 *
 * Rings of `perRing` growing outward, each ring rotated half a step off the
 * one inside it so the packing does not produce visible spokes. The jitter is
 * a hash of the slot rather than a random number: a member must land on the
 * same offset every frame or the crowd shimmers.
 */
export function slotOffset(slot: number, out: { x: number; y: number }): void {
  let ring = 0;
  let base = 0;
  // ring k holds perRing·(k+1) slots
  for (;;) {
    const cap = SQ.perRing * (ring + 1);
    if (slot < base + cap) break;
    base += cap;
    ring++;
  }
  const within = slot - base;
  const cap = SQ.perRing * (ring + 1);
  const a = (within / cap) * Math.PI * 2 + ring * 0.5;
  const r = SQ.ringGap * (ring + 1);
  // deterministic per-slot jitter
  const h = Math.sin(slot * 12.9898) * 43758.5453;
  const j = (h - Math.floor(h)) - 0.5;
  out.x = Math.cos(a) * (r + j * SQ.jitter * 2);
  out.y = Math.sin(a) * (r + j * SQ.jitter * 2);
}

export class Squad {
  members: Pool<Member>;
  /** live members, excluding the ones mid-death-animation */
  count = 0;
  /** the largest this squad has ever been, for the run summary */
  peak = 0;
  private scratch = { x: 0, y: 0 };
  private nextSlot = 0;

  constructor(private atlas: GameAtlas, layer: Container) {
    this.members = new Pool<Member>(SQ.max + 24, () => {
      const sp = new Sprite(atlas.get('levy0_s_0'));
      sp.anchor.set(0.5, 1);
      sp.visible = false;
      layer.addChild(sp);
      return {
        sp, x: 0, y: 0, vx: 0, vy: 0, slot: 0, phase: 0, cd: 0,
        look: LOOK_S, attackT: 0, dying: 0, dx: 0, dy: 0, variant: 0,
        rank: 0, hurt: 0, merging: 0, mx: 0, my: 0,
      };
    });
  }

  /**
   * Effective head count: what the crowd is worth in recruits.
   *
   * This, not `count`, is the number the player is shown. Promotion trades
   * five bodies for one better one, so the number of BODIES falls at every
   * merge — and a counter that fell when you got stronger would read as a
   * loss no matter how good the trade was. Worth only ever goes up.
   */
  headcount(): number {
    let n = 0;
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      // `merging` must be excluded as well as `dying`. The four being consumed
      // still hold their old rank for the length of the fuse animation, and
      // counting them alongside the survivor's NEW rank double-counts the
      // whole set — the number spikes to 64 and then drops to 36 as the
      // animation ends, which is the falling counter this design exists to
      // avoid, arriving by the back door.
      if (m.dying <= 0 && m.merging <= 0) n += Math.max(0, (SQ.rankWorth[m.rank] ?? 1) - m.hurt);
    }
    return n;
  }

  /** The name band the HUD shows, driven by worth rather than by bodies. */
  tier(): 0 | 1 | 2 {
    const h = this.headcount();
    return h < 12 ? 0 : h < 30 ? 1 : 2;
  }

  /**
   * How much the squad is worth in a fight. The hero counts for several people
   * so that a squad of zero is still a fight rather than a cutscene.
   */
  strength(): number {
    return this.headcount() + SQ.heroWeight;
  }

  /**
   * Fuse every full set of `mergeAt` same-rank units into one of the next.
   *
   * Runs lowest rank upward and repeats, so a single recruitment can cascade:
   * the fifth straggler makes a spearman, which may complete a set of five
   * spearmen, which makes a swordsman. Returns the ranks reached, so the
   * caller can announce them.
   *
   * The four consumed are marked `merging` rather than deleted outright —
   * they fly into the survivor and vanish there, which is what makes a merge
   * read as five people becoming one instead of four people evaporating.
   */
  promote(): number[] {
    const reached: number[] = [];
    for (let rank = 0; rank < SQ.maxRank; rank++) {
      for (;;) {
        const pool: Member[] = [];
        for (let i = 0; i < this.members.count && pool.length < SQ.mergeAt; i++) {
          const m = this.members.items[i];
          if (m.dying <= 0 && m.merging <= 0 && m.rank === rank) pool.push(m);
        }
        if (pool.length < SQ.mergeAt) break;

        // the survivor is the one closest to the hero's slot, so the promoted
        // unit appears at the front of the crowd rather than at its edge
        pool.sort((a, b) => a.slot - b.slot);
        const keep = pool[0];
        keep.rank = rank + 1;
        keep.variant = (Math.random() * 1024) | 0;
        for (let k = 1; k < pool.length; k++) {
          const m = pool[k];
          m.merging = SQ.mergeMs / 1000;
          m.mx = keep.x;
          m.my = keep.y;
          this.count--;
        }
        reached.push(rank + 1);
      }
    }
    if (reached.length) this.reslot();
    return reached;
  }

  /** Add up to `n` members around (x, y). Returns how many actually joined. */
  add(n: number, x: number, y: number): number {
    let joined = 0;
    for (let i = 0; i < n && this.count < SQ.max; i++) {
      const m = this.members.obtain();
      if (!m) break;
      m.slot = this.nextSlot++;
      slotOffset(m.slot, this.scratch);
      // spawn at the pad and walk in, rather than popping into formation
      m.x = x + (Math.random() - 0.5) * 30;
      m.y = y + (Math.random() - 0.5) * 30;
      m.vx = m.vy = 0;
      // a random phase per member is the difference between a crowd and a
      // marching band: sixty people in lockstep reads as one object
      m.phase = Math.random();
      m.look = LOOK_S;
      m.attackT = 0;
      m.cd = Math.random() * SQ.interval;
      m.dying = 0;
      m.variant = (Math.random() * 1024) | 0;
      m.rank = 0;
      m.hurt = 0;
      m.merging = 0;
      m.sp.visible = true;
      m.sp.alpha = 1;
      m.sp.scale.set(1);
      this.count++;
      joined++;
    }
    this.reslot();
    return joined;
  }

  /**
   * Rebuild an army worth `worth` recruits, from the top rank down.
   *
   * This is how a run reloads. Saving the body count would lose every
   * promotion — twelve knights would come back as twelve stragglers — so the
   * save stores WORTH, and worth decomposes exactly.
   *
   * Greedy from the highest rank is not an approximation here: rankWorth is
   * powers of `mergeAt + 1`, and promotion never leaves `mergeAt` of a rank
   * unmerged, so an army's canonical shape is simply its worth written in
   * base six. Taking the largest unit that fits, repeatedly, reproduces it.
   */
  addWorth(worth: number, x: number, y: number): number {
    let rem = Math.max(0, Math.floor(worth));
    let made = 0;
    for (let rank = SQ.maxRank; rank >= 0 && rem > 0; rank--) {
      const w = SQ.rankWorth[rank] ?? 1;
      let n = Math.floor(rem / w);
      if (n <= 0) continue;
      n = Math.min(n, SQ.max - this.count);
      if (n <= 0) break;
      for (let i = 0; i < n; i++) {
        const m = this.members.obtain();
        if (!m) break;
        m.slot = this.nextSlot++;
        m.x = x + (Math.random() - 0.5) * 30;
        m.y = y + (Math.random() - 0.5) * 30;
        m.vx = m.vy = 0;
        m.phase = Math.random();
        m.look = LOOK_S;
        m.attackT = 0;
        m.cd = Math.random() * SQ.interval;
        m.dying = 0;
        m.merging = 0;
        m.hurt = 0;
        m.rank = rank;
        m.variant = (Math.random() * 1024) | 0;
        m.sp.visible = true;
        m.sp.alpha = 1;
        m.sp.scale.set(1);
        this.count++;
        made++;
        rem -= w;
      }
    }
    this.reslot();
    return made;
  }

  /** Live units per rank, lowest first — for the dev overlay and the tests. */
  rankTally(): number[] {
    const out = new Array<number>(SQ.maxRank + 1).fill(0);
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      if (m.dying <= 0 && m.merging <= 0) out[m.rank]++;
    }
    return out;
  }

  /** How many live units currently hold a given rank. */
  rankCount(rank: number): number {
    let n = 0;
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      if (m.dying <= 0 && m.merging <= 0 && m.rank === rank) n++;
    }
    return n;
  }

  /** Where the highest-ranked unit stands, for centring a promotion effect. */
  bestPosition(out: { x: number; y: number }): boolean {
    let best: Member | null = null;
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      if (m.dying > 0 || m.merging > 0) continue;
      if (!best || m.rank > best.rank) best = m;
    }
    if (!best) return false;
    out.x = best.x; out.y = best.y;
    return true;
  }

  /**
   * Lose `n` members. Returns how many were actually there to lose.
   *
   * The ones taken are the outermost slots — the crowd shrinks from its edge
   * inward, which is both what it should look like and what keeps the
   * formation from developing holes.
   */
  lose(worth: number): number {
    let paid = 0;
    let debt = Math.max(0, Math.round(worth));
    while (debt > 0) {
      // Lowest rank first, and among equals the outermost slot.
      //
      // Taking the outermost body regardless of rank would mean one unlucky
      // hit deletes a Champion worth 1,296 recruits while five stragglers
      // stand behind it, which turns every contact into a lottery on the whole
      // run. Losses eat the cheap bodies first — the crowd is armour for the
      // units it promoted.
      let worst = -1, worstRank = Infinity, worstSlot = -1;
      for (let i = 0; i < this.members.count; i++) {
        const m = this.members.items[i];
        if (m.dying > 0 || m.merging > 0) continue;
        if (m.rank < worstRank || (m.rank === worstRank && m.slot > worstSlot)) {
          worstRank = m.rank; worstSlot = m.slot; worst = i;
        }
      }
      if (worst < 0) break;

      const m = this.members.items[worst];
      const left = (SQ.rankWorth[m.rank] ?? 1) - m.hurt;
      if (debt < left) {
        // Not enough to finish it. The damage sticks, so a knight genuinely
        // absorbs thirty-six recruits' worth of punishment rather than dying
        // to the first bite that reaches him.
        m.hurt += debt;
        paid += debt;
        debt = 0;
        break;
      }
      debt -= left;
      paid += left;
      m.dying = SQ.deathFlyMs / 1000;
      const a = Math.random() * Math.PI * 2;
      m.dx = Math.cos(a) * 130;
      m.dy = Math.sin(a) * 130;
      this.count--;
    }
    this.reslot();
    return paid;
  }

  /** Pack the live members back into slots 0..count−1, closest first. */
  private reslot(): void {
    const live: Member[] = [];
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      if (m.dying <= 0 && m.merging <= 0) live.push(m);
    }
    live.sort((a, b) => a.slot - b.slot);
    live.forEach((m, i) => { m.slot = i; });
    this.nextSlot = live.length;
  }

  /**
   * Move everyone toward their slot, and advance the death animations.
   *
   * The spring is deliberately soft: at CONFIG.squad.springK the crowd lags a
   * body-length behind a sharp turn and takes a beat to re-form, which is the
   * whole reason a crowd is fun to steer rather than an extension of the
   * player's collider.
   */
  step(dt: number, hx: number, hy: number, t: number): void {
    for (let i = this.members.count - 1; i >= 0; i--) {
      const m = this.members.items[i];

      // Being consumed by a merge: fly into the survivor and shrink out.
      if (m.merging > 0) {
        m.merging -= dt;
        const k = Math.min(1, dt * 14);
        m.x += (m.mx - m.x) * k;
        m.y += (m.my - m.y) * k;
        const f = Math.max(0, m.merging / (SQ.mergeMs / 1000));
        m.sp.alpha = f;
        m.sp.scale.set(f * (m.look.flip ? -1 : 1), f);
        if (m.merging <= 0) {
          m.sp.visible = false;
          m.sp.alpha = 1;
          m.sp.scale.set(1);
          this.members.release(i);
        }
        continue;
      }

      if (m.dying > 0) {
        m.dying -= dt;
        m.x += m.dx * dt;
        m.y += m.dy * dt;
        m.dx *= 0.9; m.dy *= 0.9;
        m.sp.alpha = Math.max(0, m.dying / (SQ.deathFlyMs / 1000));
        if (m.dying <= 0) {
          m.sp.visible = false;
          this.members.release(i);
        }
        continue;
      }

      slotOffset(m.slot, this.scratch);
      const tx = hx + this.scratch.x;
      const ty = hy + this.scratch.y;
      const dx = tx - m.x, dy = ty - m.y;
      const d = Math.hypot(dx, dy);
      // a slack radius: inside it there is no pull at all, so a stationary
      // crowd stands still instead of vibrating on its slot
      const pull = d > SQ.slack ? (d - SQ.slack) / d : 0;
      m.vx += dx * pull * SQ.springK * dt - m.vx * SQ.springD * dt;
      m.vy += dy * pull * SQ.springK * dt - m.vy * SQ.springD * dt;
      const stepX = m.vx * dt, stepY = m.vy * dt;
      m.x += stepX;
      m.y += stepY;
      // the cycle is driven by ground covered, so the feet never slide
      m.phase = (m.phase + Math.hypot(stepX, stepY) / STRIDE) % 1;
      if (m.attackT > 0) m.attackT -= dt;
      if (m.cd > 0) m.cd -= dt;
      void t;
    }
  }

  /**
   * The members that should throw this step, given a target.
   *
   * Only the front few throw, and each spear carries the damage of everyone it
   * stands for. Sixty individual projectiles a second would be both unreadable
   * and, at 120 Hz, genuinely expensive; twelve is enough to look like a
   * volley.
   */
  throwers(): Member[] {
    const out: Member[] = [];
    const want = Math.min(12, Math.max(1, this.count));
    for (let i = 0; i < this.members.count && out.length < want; i++) {
      const m = this.members.items[i];
      if (m.dying <= 0 && m.merging <= 0 && m.cd <= 0) out.push(m);
    }
    return out;
  }

  /** Damage one spear carries, so a volley is worth the whole squad. */
  spearDamage(throwerCount: number): number {
    if (throwerCount <= 0) return 0;
    return Math.max(1, Math.round((SQ.damage * this.strength()) / throwerCount));
  }

  /**
   * Update every sprite. Called once per frame.
   *
   * The bob that used to fake a gait is gone: the walk cycle carries it now,
   * inside the art, where it can also move the arms and squash the shadow.
   */
  draw(camX: number, camY: number): void {
    for (let i = 0; i < this.members.count; i++) {
      const m = this.members.items[i];
      // Rank is the art now, not the crowd's size. A knight standing next to
      // a straggler is the whole point of promotion being visible.
      const base = 'levy' + m.rank;
      m.sp.x = screenX(m.x, m.y) - camX;
      m.sp.y = screenY(m.x, m.y) - camY;
      // The crew carries a constant depth penalty so the hero, the cat and
      // anything trying to kill you are always legible over the mass. Sixty
      // near-identical bodies will otherwise swallow the one the stick is
      // attached to, and "where am I" is not a question this game should ever
      // ask. Internally the crew still sorts correctly among itself.
      m.sp.zIndex = m.x + m.y - CROWD_DEPTH_BIAS;

      if (m.dying > 0 || m.merging > 0) continue;  // keep the last pose
      const moving = Math.abs(m.vx) + Math.abs(m.vy) > 8;
      if (moving) m.look = lookFrom(m.vx, m.vy, m.look);
      const kind = this.atlas.variantKind(base, m.variant);
      m.sp.texture = this.atlas.get(frameName(kind, m.look, frameFor(m.phase, moving, m.attackT)));
      m.sp.scale.x = m.look.flip ? -1 : 1;
    }
  }

  clear(): void {
    for (let i = 0; i < this.members.count; i++) this.members.items[i].sp.visible = false;
    this.members.releaseAll();
    this.count = 0;
    this.nextSlot = 0;
  }
}
