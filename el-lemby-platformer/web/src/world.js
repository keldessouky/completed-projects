// The gameplay simulation — a faithful port of windows/ElLemby.Core/World.cs
// (which mirrors the SpriteKit build's tuning). Deterministic and DOM-free,
// so the node test suite and the in-page attract mode run the same code the
// player does.

import { CFG } from "./config.js";
import { ENTITY, TILE, tileIsMystery } from "./parser.js";

export const EV = {
  JUMPED: "jumped",
  COIN: "coin",
  CRATE_COIN: "crateCoin",
  CRATE_SANDWICH: "crateSandwich",
  CRATE_SPENT: "crateSpent",
  POWERUP: "powerup",
  STOMPED: "stomped",
  PLAYER_HIT: "playerHit",
  CHECKPOINT: "checkpoint",
  GOAL: "goal",
};

export const PLAYER_HALF_W = 6; // 12×22 body
export const PLAYER_HALF_H = 11;
const THUG_HALF_W = 6.5;
const THUG_HALF_H = 11;
const COIN_HALF = 5;
const POWER_HALF_W = 7;
const POWER_HALF_H = 5.5;
const POWER_EMERGE_TIME = 0.35;
const POWER_EMERGE_RISE = 14;
const CHECKPOINT_HALF_W = 10;
const CHECKPOINT_HALF_H = 12;
const EPS = 0.01;

export function emptyInput() {
  return { moveX: 0, jumpHeld: false, jumpPressedAt: -Infinity };
}

export class World {
  constructor(level) {
    this.level = level;
    this.player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      lastGroundedAt: -Infinity,
      invulnerableUntil: -Infinity,
      dead: false,
    };
    this.thugs = [];
    this.coins = [];
    this.powerUps = [];
    this.checkpoints = [];
    this.crates = new Map(); // "col,row" → {column,row,kind,spent,nudgeT}
    this.goalX = 0;
    this.goalY = 0;
    this.goalReached = false;
    this.playerSpawn = { x: 3 * CFG.tile, y: 4 * CFG.tile };
    this.activeRespawn = null;

    const t = CFG.tile;
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.columns; col++) {
        const kind = level.tile(col, row);
        if (kind !== null && tileIsMystery(kind)) {
          this.crates.set(`${col},${row}`, {
            column: col,
            row,
            kind,
            spent: false,
            nudgeT: 0,
          });
        }
      }
    }

    for (const p of level.entities) {
      const centerX = p.column * t + t / 2;
      const cellBottom = (level.rows - 1 - p.row) * t;
      switch (p.kind) {
        case ENTITY.PLAYER:
          this.playerSpawn = { x: centerX, y: cellBottom + PLAYER_HALF_H + 1 };
          break;
        case ENTITY.THUG:
          this.thugs.push({
            x: centerX,
            y: cellBottom + THUG_HALF_H + 1,
            vx: 0,
            vy: 0,
            direction: -1,
            squashed: false,
            squashedAt: 0,
            gone: false,
            hasCommandedMove: false,
          });
          break;
        case ENTITY.COIN:
          this.coins.push({ x: centerX, y: cellBottom + t / 2, collected: false });
          break;
        case ENTITY.NOUSA:
          this.goalX = centerX;
          this.goalY = cellBottom + 12;
          break;
        case ENTITY.CHECKPOINT:
          this.checkpoints.push({ x: centerX, y: cellBottom + 12, activated: false });
          break;
      }
    }

    this.player.x = this.playerSpawn.x;
    this.player.y = this.playerSpawn.y;
  }

  get widthPoints() {
    return this.level.columns * CFG.tile;
  }

  // ------------------------------------------------------------------

  step(dt, input, now, ambientOnly = false) {
    const events = [];
    const p = this.player;

    if (p.dead) {
      p.vy = Math.max(p.vy + CFG.gravity * dt, -CFG.maxFallSpeed);
      p.y += p.vy * dt;
      return events;
    }

    this.stepPlayer(dt, input, now, events);

    for (const crate of this.crates.values()) {
      if (crate.nudgeT > 0) {
        crate.nudgeT = Math.max(0, crate.nudgeT - dt);
      }
    }

    if (ambientOnly) {
      return events;
    }

    for (const thug of this.thugs) {
      this.stepThug(thug, dt, now);
    }
    for (const power of this.powerUps) {
      if (!power.collected && power.emergeT < POWER_EMERGE_TIME) {
        power.emergeT += dt;
      }
    }

    this.resolveInteractions(now, events);
    return events;
  }

  stepPlayer(dt, input, now, events) {
    const p = this.player;

    p.grounded = this.probeGround(p.x, p.y, PLAYER_HALF_W - 1, PLAYER_HALF_H);
    if (p.grounded) {
      p.lastGroundedAt = now;
    }

    if (input.moveX !== 0) {
      // Reversing on the ground uses the stronger skid deceleration so
      // turnarounds feel immediate.
      const reversing = p.vx !== 0 && Math.sign(input.moveX) !== Math.sign(p.vx)
        && Math.abs(p.vx) > 30;
      const accel = !p.grounded ? CFG.airAcceleration
        : reversing ? CFG.skidDeceleration
        : CFG.runAcceleration;
      p.vx += input.moveX * accel * dt;
      p.vx = Math.max(-CFG.maxRunSpeed, Math.min(CFG.maxRunSpeed, p.vx));
      p.facing = input.moveX;
    } else if (p.grounded) {
      const drop = CFG.groundFriction * dt;
      p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - drop * Math.sign(p.vx);
    }

    // Falling pulls harder than rising, so jumps feel snappy, not floaty.
    const gravityScale = p.vy < 0 ? CFG.fallGravityMultiplier : 1;
    p.vy = Math.max(p.vy + CFG.gravity * gravityScale * dt, -CFG.maxFallSpeed);

    const buffered = now - input.jumpPressedAt <= CFG.jumpBufferTime;
    const coyote = now - p.lastGroundedAt <= CFG.coyoteTime;
    if (buffered && coyote && p.vy <= 1) {
      p.vy = CFG.jumpSpeed;
      p.lastGroundedAt = -Infinity;
      input.jumpPressedAt = -Infinity;
      p.grounded = false;
      events.push({ kind: EV.JUMPED, x: p.x, y: p.y });
    }

    if (!input.jumpHeld && p.vy > CFG.jumpCutSpeed) {
      p.vy = CFG.jumpCutSpeed;
    }

    const moved = this.moveBody(p, PLAYER_HALF_W, PLAYER_HALF_H, dt, true);
    for (const cell of moved.headHits) {
      this.handleHeadHit(cell, events);
    }
  }

  handleHeadHit(cell, events) {
    const crate = this.crates.get(cell);
    if (!crate) {
      return;
    }
    const t = CFG.tile;
    const cx = crate.column * t + t / 2;
    const cy = (this.level.rows - 1 - crate.row) * t + t / 2;
    crate.nudgeT = 0.12;
    if (crate.spent) {
      events.push({ kind: EV.CRATE_SPENT, x: cx, y: cy });
      return;
    }
    crate.spent = true;
    if (crate.kind === TILE.MYSTERY_COIN) {
      events.push({ kind: EV.CRATE_COIN, x: cx, y: cy });
    } else {
      this.powerUps.push({ x: cx, startY: cy + 2, emergeT: 0, collected: false });
      events.push({ kind: EV.CRATE_SANDWICH, x: cx, y: cy });
    }
  }

  stepThug(thug, dt, now) {
    if (thug.gone) {
      return;
    }
    if (thug.squashed) {
      if (now - thug.squashedAt > 1.1) {
        thug.gone = true;
      }
      return;
    }

    const standing = Math.abs(thug.vy) < 5;
    if (standing) {
      const probeX = thug.x + thug.direction * (THUG_HALF_W + 3);
      const probeY = thug.y - THUG_HALF_H - 4;
      if (!this.isSolidAtPoint(probeX, probeY)) {
        thug.direction = -thug.direction;
      }
    }

    thug.vx = thug.direction * CFG.thugSpeed;
    thug.vy = Math.max(thug.vy + CFG.gravity * dt, -CFG.maxFallSpeed);

    const moved = this.moveBody(thug, THUG_HALF_W, THUG_HALF_H, dt, false);
    if (moved.hitWall && thug.hasCommandedMove) {
      thug.direction = -thug.direction;
    }
    thug.hasCommandedMove = true;
  }

  powerUpY(power) {
    return power.startY + POWER_EMERGE_RISE * Math.min(1, power.emergeT / POWER_EMERGE_TIME);
  }

  resolveInteractions(now, events) {
    const p = this.player;
    const pLeft = p.x - PLAYER_HALF_W;
    const pRight = p.x + PLAYER_HALF_W;
    const pBottom = p.y - PLAYER_HALF_H;
    const pTop = p.y + PLAYER_HALF_H;

    const overlaps = (cx, cy, hw, hh) =>
      pRight > cx - hw && pLeft < cx + hw && pTop > cy - hh && pBottom < cy + hh;

    for (const coin of this.coins) {
      if (!coin.collected && overlaps(coin.x, coin.y, COIN_HALF, COIN_HALF)) {
        coin.collected = true;
        events.push({ kind: EV.COIN, x: coin.x, y: coin.y });
      }
    }

    for (const power of this.powerUps) {
      if (
        !power.collected &&
        power.emergeT >= POWER_EMERGE_TIME &&
        overlaps(power.x, this.powerUpY(power), POWER_HALF_W, POWER_HALF_H)
      ) {
        power.collected = true;
        events.push({ kind: EV.POWERUP, x: power.x, y: this.powerUpY(power) });
      }
    }

    for (const checkpoint of this.checkpoints) {
      if (
        !checkpoint.activated &&
        overlaps(checkpoint.x, checkpoint.y, CHECKPOINT_HALF_W, CHECKPOINT_HALF_H)
      ) {
        checkpoint.activated = true;
        this.activeRespawn = { x: checkpoint.x, y: checkpoint.y };
        events.push({ kind: EV.CHECKPOINT, x: checkpoint.x, y: checkpoint.y });
      }
    }

    for (const thug of this.thugs) {
      if (thug.squashed || thug.gone) {
        continue;
      }
      if (!overlaps(thug.x, thug.y, THUG_HALF_W, THUG_HALF_H)) {
        continue;
      }
      if (p.vy <= CFG.stompVelocityThreshold && pBottom > thug.y) {
        thug.squashed = true;
        thug.squashedAt = now;
        p.vy = CFG.stompBounceSpeed;
        events.push({ kind: EV.STOMPED, x: thug.x, y: thug.y });
      } else if (now >= p.invulnerableUntil) {
        events.push({ kind: EV.PLAYER_HIT, x: thug.x, y: thug.y });
      }
    }

    if (!this.goalReached && overlaps(this.goalX, this.goalY, 8, 12)) {
      this.goalReached = true;
      events.push({ kind: EV.GOAL, x: this.goalX, y: this.goalY });
    }
  }

  // ------------------------------------------------------------------

  killPlayer() {
    this.player.dead = true;
    this.player.vx = 0;
    this.player.vy = 330;
  }

  respawnPlayer(now) {
    const point = this.activeRespawn ?? this.playerSpawn;
    const p = this.player;
    p.dead = false;
    p.x = point.x;
    p.y = point.y;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.invulnerableUntil = now + CFG.hurtInvulnerabilityTime;
  }

  // ------------------------------------------------------------------
  // Tile collision (axis-separated AABB, same as the C# sim)
  // ------------------------------------------------------------------

  isSolidCell(column, rowFromBottom) {
    return this.level.isSolid(column, this.level.rows - 1 - rowFromBottom);
  }

  isSolidAtPoint(x, y) {
    if (x < 0 || y < 0) {
      return false;
    }
    return this.isSolidCell(Math.floor(x / CFG.tile), Math.floor(y / CFG.tile));
  }

  probeGround(x, y, halfW, halfH) {
    const below = y - halfH - 1;
    return this.isSolidAtPoint(x - halfW, below) || this.isSolidAtPoint(x + halfW, below);
  }

  moveBody(body, halfW, halfH, dt, collectHeadHits) {
    const t = CFG.tile;
    const result = { hitWall: false, headHits: [] };

    // X axis
    body.x += body.vx * dt;
    if (body.x < halfW) {
      body.x = halfW;
      body.vx = 0;
      result.hitWall = true;
    } else if (body.x > this.widthPoints - halfW) {
      body.x = this.widthPoints - halfW;
      body.vx = 0;
      result.hitWall = true;
    }
    if (body.vx !== 0) {
      const c0 = Math.floor((body.x - halfW) / t);
      const c1 = Math.floor((body.x + halfW - EPS) / t);
      const r0 = Math.floor((body.y - halfH) / t);
      const r1 = Math.floor((body.y + halfH - EPS) / t);
      outer: for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          if (r < 0 || !this.isSolidCell(c, r)) {
            continue;
          }
          if (body.vx > 0) {
            body.x = c * t - halfW - EPS;
          } else {
            body.x = (c + 1) * t + halfW + EPS;
          }
          body.vx = 0;
          result.hitWall = true;
          break outer;
        }
      }
    }

    // Y axis
    body.y += body.vy * dt;
    if (body.vy !== 0) {
      const c0 = Math.floor((body.x - halfW) / t);
      const c1 = Math.floor((body.x + halfW - EPS) / t);
      const r0 = Math.floor((body.y - halfH) / t);
      const r1 = Math.floor((body.y + halfH - EPS) / t);
      let hit = false;
      if (body.vy < 0) {
        for (let c = c0; c <= c1 && !hit; c++) {
          if (r0 >= 0 && this.isSolidCell(c, r0)) {
            body.y = (r0 + 1) * t + halfH + EPS;
            hit = true;
          }
        }
      } else {
        for (let c = c0; c <= c1; c++) {
          if (r1 >= 0 && this.isSolidCell(c, r1)) {
            if (!hit) {
              body.y = r1 * t - halfH - EPS;
              hit = true;
            }
            if (collectHeadHits) {
              result.headHits.push(`${c},${this.level.rows - 1 - r1}`);
            }
          }
        }
      }
      if (hit) {
        body.vy = 0;
      }
    }

    return result;
  }
}
