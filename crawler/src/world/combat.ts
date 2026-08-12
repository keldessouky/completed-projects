import { CONFIG, type EnemyKind } from '../config';
import type { GameAtlas } from '../assets/atlas';
import type { Entities } from './entities';

/**
 * Presentation hooks the simulation needs but must not own. Combat decides
 * *that* something was hit; the scene decides what that looks and sounds like.
 */
export interface CombatFx {
  hit(x: number, y: number, dmg: number, crit: boolean, kind: EnemyKind): void;
  die(x: number, y: number, kind: EnemyKind): void;
  playerHurt(dmg: number): void;
  shot(friendly: boolean): void;
}

export interface CombatWorld {
  entities: Entities;
  atlas: GameAtlas;
  fx: CombatFx;
  /** live player state, read every step */
  px: number;
  py: number;
  playerRadius: number;
  /** true while the player is in i-frames or already dead */
  playerInvulnerable: boolean;
  /** called when an enemy connects; returns true if the hit landed */
  onPlayerHit(dmg: number): boolean;
  /** called when an enemy dies, before it is released */
  onEnemyDeath(kind: EnemyKind, x: number, y: number, poi: string): void;
}

const E = CONFIG.enemies;

/**
 * Enemy behaviour and every projectile in the world.
 *
 * The AI is deliberately three states — idle, chasing, returning — because at
 * a phone's screen size anything subtler is invisible, and a leash that
 * actually works is what lets a player disengage from a camp they misjudged.
 */
export class Combat {
  constructor(private w: CombatWorld) {}

  /** The scene refreshes these every step; the AI reads them constantly. */
  set px(v: number) { this.w.px = v; }
  set py(v: number) { this.w.py = v; }
  set playerInvulnerable(v: boolean) { this.w.playerInvulnerable = v; }

  step(dt: number): void {
    const w = this.w;
    w.entities.reindex();
    this.stepEnemies(dt);
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
        const decay = Math.max(0, 1 - CONFIG.combat.knockbackDecay * dt);
        e.kx *= decay; e.ky *= decay;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) { e.kx = 0; e.ky = 0; }
      }

      const dx = w.px - e.x, dy = w.py - e.y;
      const distToPlayer = Math.hypot(dx, dy);
      const fromHome = Math.hypot(e.x - e.hx, e.y - e.hy);

      if (!e.aggro) {
        if (distToPlayer < stat.aggro) e.aggro = true;
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
        if (d < 40) e.aggro = false;
        continue;
      }

      if (e.aggro) {
        e.face = dx < 0 ? -1 : 1;
        const stopAt = stat.range > 0
          ? stat.range * 0.8
          : stat.radius + w.playerRadius + 2;

        if (distToPlayer > stopAt) {
          const d = distToPlayer || 1;
          e.x += (dx / d) * stat.speed * dt;
          e.y += (dy / d) * stat.speed * dt;
        } else if (e.cd <= 0) {
          e.cd = stat.cooldown;
          if (stat.range > 0) {
            const d = distToPlayer || 1;
            ents.spawnShot(
              w.atlas, e.x, e.y - 10,
              (dx / d) * E.shotSpeed, (dy / d) * E.shotSpeed,
              stat.dmg, false,
            );
            w.fx.shot(false);
          } else if (!w.playerInvulnerable) {
            w.onPlayerHit(stat.dmg);
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

      if (s.life > CONFIG.combat.projLifeSec || s.x < 0 || s.y < 0 || s.x > size || s.y > size) {
        s.sp.visible = false;
        ents.shots.release(i);
        continue;
      }

      if (s.friendly) {
        const hits = ents.near(s.x, s.y, CONFIG.combat.projRadius);
        if (hits.length > 0) {
          // nearest of the candidates, so a shot into a crowd hits the front
          let best = hits[0], bestD = Infinity;
          for (const j of hits) {
            const e = ents.enemies.items[j];
            const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
            if (d < bestD) { bestD = d; best = j; }
          }
          this.damageEnemy(best, s.dmg, s.crit, s.vx, s.vy);
          s.sp.visible = false;
          ents.shots.release(i);
        }
      } else {
        const dx = s.x - w.px, dy = s.y - w.py;
        const r = CONFIG.combat.projRadius + w.playerRadius;
        if (dx * dx + dy * dy <= r * r) {
          if (!w.playerInvulnerable) w.onPlayerHit(s.dmg);
          s.sp.visible = false;
          ents.shots.release(i);
        }
      }
    }
  }

  // ─────────────────────────── damage ───────────────────────────

  /** Apply damage to one enemy, with knockback along the shot direction. */
  damageEnemy(index: number, dmg: number, crit: boolean, dirX = 0, dirY = 0): void {
    const w = this.w;
    const e = w.entities.enemies.items[index];
    if (!e) return;
    e.hp -= dmg;
    e.flashT = CONFIG.combat.hitFlashMs / 1000;
    e.aggro = true;
    w.fx.hit(e.x, e.y, dmg, crit, e.kind);

    // the boss is too heavy to shove around; everything else slides
    if (e.kind !== 'boss') {
      const d = Math.hypot(dirX, dirY);
      if (d > 0.01) {
        const k = CONFIG.combat.knockback * (crit ? 1.6 : 1);
        e.kx += (dirX / d) * k;
        e.ky += (dirY / d) * k;
      }
    }

    if (e.hp <= 0) {
      w.fx.die(e.x, e.y, e.kind);
      w.onEnemyDeath(e.kind, e.x, e.y, e.poi);
      w.entities.killEnemy(index);
    }
  }

  /** Everything inside a circle takes damage — the Firecracker. */
  blast(x: number, y: number, radius: number, dmg: number): number {
    const hits = this.w.entities.near(x, y, radius);
    // iterate high-to-low: killing an enemy swap-removes it from the pool
    hits.sort((a, b) => b - a);
    let struck = 0;
    for (const i of hits) {
      const e = this.w.entities.enemies.items[i];
      if (!e) continue;
      this.damageEnemy(i, dmg, false, e.x - x, e.y - y);
      struck++;
    }
    return struck;
  }
}
