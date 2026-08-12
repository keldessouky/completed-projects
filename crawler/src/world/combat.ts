import { CONFIG, type EnemyKind } from '../config';
import type { GameAtlas } from '../assets/atlas';
import type { Entities } from './entities';
import type { Squad } from './squad';

/**
 * Presentation hooks the simulation needs but must not own. Combat decides
 * *that* something was hit; the scene decides what that looks and sounds like.
 */
export interface CombatFx {
  hit(x: number, y: number, dmg: number, kind: EnemyKind): void;
  die(x: number, y: number, kind: EnemyKind): void;
  shot(friendly: boolean): void;
}

export interface CombatWorld {
  entities: Entities;
  squad: Squad;
  atlas: GameAtlas;
  fx: CombatFx;
  /** live hero position, refreshed every step */
  px: number;
  py: number;
  heroRadius: number;
  /** called when an enemy connects; the scene decides who in the line dies */
  onSquadHit(contact: number, kind: EnemyKind, x: number, y: number): void;
  /** called when an enemy dies, before it is released */
  onEnemyDeath(kind: EnemyKind, x: number, y: number, poi: string): void;
}

const E = CONFIG.enemies;
const SQ = CONFIG.squad;

/**
 * Enemy behaviour, the squad's volleys, and every projectile in the world.
 *
 * The AI is deliberately three states — idle, chasing, returning — because at
 * a phone's screen size anything subtler is invisible, and a leash that
 * actually works is what lets a player walk away from a camp they misjudged.
 *
 * Note that enemies path toward the HERO, not toward the nearest squad member:
 * a crowd of sixty would otherwise shred any pack from the flanks before it
 * ever arrived, and the fight would stop being about where you stand.
 */
export class Combat {
  constructor(private w: CombatWorld) {}

  /** The scene refreshes these every step; the AI reads them constantly. */
  set px(v: number) { this.w.px = v; }
  set py(v: number) { this.w.py = v; }

  step(dt: number): void {
    this.w.entities.reindex();
    this.stepEnemies(dt);
    this.stepVolley(dt);
    this.stepShots(dt);
  }

  // ─────────────────────────── enemies ───────────────────────────

  private stepEnemies(dt: number): void {
    const w = this.w;
    const ents = w.entities;

    for (let i = ents.enemies.count - 1; i >= 0; i--) {
      const e = ents.enemies.items[i];
      const stat = E[e.kind];
      e.px = e.x; e.py = e.y;
      e.cd -= dt;
      e.phase += dt * 6;

      // knockback first, so a hit visibly interrupts an approach
      if (e.kx !== 0 || e.ky !== 0) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        const decay = Math.max(0, 1 - E.knockbackDecay * dt);
        e.kx *= decay; e.ky *= decay;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) { e.kx = 0; e.ky = 0; }
      }

      const dx = w.px - e.x, dy = w.py - e.y;
      const toHero = Math.hypot(dx, dy);
      const fromHome = Math.hypot(e.x - e.hx, e.y - e.hy);

      if (!e.aggro) {
        if (toHero < stat.aggro) e.aggro = true;
        else {
          // idle drift around the spawn point, so a camp looks occupied
          e.x += Math.cos(e.phase * 0.22) * 9 * dt;
          e.y += Math.sin(e.phase * 0.17) * 9 * dt;
        }
      } else if (fromHome > stat.leash) {
        // too far from post: walk back and forget about it
        const hx = e.hx - e.x, hy = e.hy - e.y;
        const d = Math.hypot(hx, hy) || 1;
        e.x += (hx / d) * stat.speed * dt;
        e.y += (hy / d) * stat.speed * dt;
        e.face = hx < 0 ? -1 : 1;
        this.clampToWorld(e);
        if (d < 40) e.aggro = false;
        continue;
      }

      if (e.aggro) {
        e.face = dx < 0 ? -1 : 1;
        const ranged = 'range' in stat ? (stat as { range: number }).range : 0;
        // A ranged enemy must never out-range the squad, or the correct play
        // becomes standing still and losing people to something you cannot
        // reach. Cap its stand-off inside the squad's own throwing range.
        const stopAt = ranged > 0
          ? Math.min(ranged * 0.85, SQ.range * 0.8)
          : stat.radius + w.heroRadius + 2;

        if (toHero > stopAt) {
          const d = toHero || 1;
          e.x += (dx / d) * stat.speed * dt;
          e.y += (dy / d) * stat.speed * dt;
        } else if (e.cd <= 0) {
          if (ranged > 0) {
            e.cd = E.shotInterval;
            const d = toHero || 1;
            ents.spawnShot(
              w.atlas, e.x, e.y,
              (dx / d) * E.arrowSpeed, (dy / d) * E.arrowSpeed,
              stat.dmg, false,
            );
            w.fx.shot(false);
          } else {
            e.cd = E.contactInterval;
            w.onSquadHit(stat.contact, e.kind, e.x, e.y);
          }
        }
      }

      this.separate(e, i, dt);
      this.clampToWorld(e);
    }
  }

  /** Light mutual push-apart so a pack fans out instead of stacking. */
  private separate(e: import('./entities').Enemy, index: number, dt: number): void {
    const ents = this.w.entities;
    const r = E[e.kind].radius;
    for (const j of ents.hash.query(e.x, e.y, r * 2.2, [])) {
      if (j === index) continue;
      const o = ents.enemies.items[j];
      if (!o) continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      const d = Math.hypot(dx, dy);
      const want = r + E[o.kind].radius;
      if (d > 0.01 && d < want) {
        const push = ((want - d) / want) * 90 * dt;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
      }
    }
  }

  private clampToWorld(e: { x: number; y: number }): void {
    const pad = 8;
    const size = CONFIG.world.size;
    e.x = Math.max(pad, Math.min(size - pad, e.x));
    e.y = Math.max(pad, Math.min(size - pad, e.y));
  }

  // ─────────────────────────── the squad's volley ───────────────────────────

  /**
   * The squad attacks on its own. There is no fire button in this game — the
   * player's only decision is where the crowd stands, so the crowd has to be
   * trusted to shoot at whatever it can reach.
   */
  private stepVolley(dt: number): void {
    void dt;
    const w = this.w;
    const ents = w.entities;
    if (ents.enemies.count === 0) return;

    const throwers = w.squad.throwers();
    if (throwers.length === 0) return;
    const dmg = w.squad.spearDamage(throwers.length);

    let fired = false;
    for (const m of throwers) {
      const t = ents.nearest(m.x, m.y, SQ.range);
      if (t < 0) continue;
      const e = ents.enemies.items[t];
      const dx = e.x - m.x, dy = e.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      ents.spawnShot(
        w.atlas, m.x, m.y,
        (dx / d) * CONFIG.combat.spearSpeed, (dy / d) * CONFIG.combat.spearSpeed,
        dmg, true,
      );
      m.cd = SQ.interval;
      fired = true;
    }
    if (fired) w.fx.shot(true);
  }

  // ─────────────────────────── projectiles ───────────────────────────

  private stepShots(dt: number): void {
    const w = this.w;
    const ents = w.entities;
    const size = CONFIG.world.size;

    for (let i = ents.shots.count - 1; i >= 0; i--) {
      const s = ents.shots.items[i];
      s.px = s.x; s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life += dt;

      if (s.life > s.maxLife || s.x < 0 || s.y < 0 || s.x > size || s.y > size) {
        s.sp.visible = false;
        ents.shots.release(i);
        continue;
      }

      if (s.friendly) {
        const hits = ents.near(s.x, s.y, CONFIG.combat.hitRadius);
        if (hits.length > 0) {
          // nearest of the candidates, so a spear into a pack hits the front
          let best = hits[0], bestD = Infinity;
          for (const j of hits) {
            const e = ents.enemies.items[j];
            const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
            if (d < bestD) { bestD = d; best = j; }
          }
          this.damageEnemy(best, s.dmg, s.vx, s.vy);
          s.sp.visible = false;
          ents.shots.release(i);
        }
      } else {
        // An arrow is aimed at the hero but lands on the crowd: anything that
        // reaches the formation costs you a person, wherever it actually is.
        const dx = s.x - w.px, dy = s.y - w.py;
        const r = CONFIG.combat.hitRadius + w.heroRadius + 14;
        if (dx * dx + dy * dy <= r * r) {
          w.onSquadHit(1, 'archer', s.x, s.y);
          s.sp.visible = false;
          ents.shots.release(i);
        }
      }
    }
  }

  // ─────────────────────────── damage ───────────────────────────

  /** Apply damage to one enemy, with knockback along the shot direction. */
  damageEnemy(index: number, dmg: number, dirX = 0, dirY = 0): void {
    const w = this.w;
    const e = w.entities.enemies.items[index];
    if (!e) return;
    e.hp -= dmg;
    e.flashT = E.hitFlashMs / 1000;
    e.aggro = true;
    w.fx.hit(e.x, e.y, dmg, e.kind);

    // a captain is too heavy to shove around; everything else slides
    if (e.kind !== 'captain') {
      const d = Math.hypot(dirX, dirY);
      if (d > 0.01) {
        e.kx += (dirX / d) * E.knockback;
        e.ky += (dirY / d) * E.knockback;
      }
    }

    if (e.hp <= 0) {
      w.fx.die(e.x, e.y, e.kind);
      w.onEnemyDeath(e.kind, e.x, e.y, e.poi);
      w.entities.killEnemy(index);
    }
  }

  /** Everything inside a circle takes damage — the gate's collapse. */
  blast(x: number, y: number, radius: number, dmg: number): number {
    const hits = this.w.entities.near(x, y, radius);
    // iterate high-to-low: killing an enemy swap-removes it from the pool
    hits.sort((a, b) => b - a);
    let struck = 0;
    for (const i of hits) {
      const e = this.w.entities.enemies.items[i];
      if (!e) continue;
      this.damageEnemy(i, dmg, e.x - x, e.y - y);
      struck++;
    }
    return struck;
  }
}
