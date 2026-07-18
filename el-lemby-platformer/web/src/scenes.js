// Scenes: title (with arcade attract mode), gameplay, and results — the
// canvas port of the WinForms scene layer, driven by the shared JS sim.

import { CFG, L10N, eastern, easternCount } from "./config.js";
import { parseLevel } from "./parser.js";
import { World, EV, emptyInput } from "./world.js";
import { botDrive } from "./bot.js";
import { LEVELS } from "./assets.js";
import { PALETTE, SPRITES, flipped, drawText } from "./render.js";

const W = CFG.sceneW;
const H = CFG.sceneH;

export class GameState {
  constructor() {
    this.money = 0;
    this.score = 0;
    this.lives = CFG.startLives;
    this.isPowered = false;
  }

  get highScore() {
    try {
      return Number(globalThis.localStorage?.getItem("ellemby.highscore") ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  collectCoin() {
    this.money += 1;
    this.score += CFG.coinScore;
  }

  awardTimeBonus(secondsLeft) {
    const bonus = Math.max(0, secondsLeft) * CFG.timeBonusPerSecond;
    this.score += bonus;
    return bonus;
  }

  commitHighScore() {
    try {
      if (this.score > this.highScore) {
        globalThis.localStorage?.setItem("ellemby.highscore", String(this.score));
      }
    } catch {
      // storage unavailable (private mode etc.) — high score just won't stick
    }
  }
}

function spriteAt(ctx, name, cx, sy, w, h) {
  ctx.drawImage(SPRITES[name], Math.round(cx - w / 2), Math.round(sy), w, h);
}

// ---------------------------------------------------------------------------

export class TitleScene {
  constructor(host) {
    this.host = host;
    this.idleSince = null;
  }

  update(dt, now) {
    if (this.idleSince === null) {
      this.idleSince = now;
    }
    if (now - this.idleSince > 7) {
      this.host.switch(new GameScene(this.host, 1, { demo: true }));
    }
  }

  keyPressed(code, now) {
    this.idleSince = now;
    if (code === "Space" || code === "Enter") {
      this.host.state = new GameState();
      this.host.switch(new GameScene(this.host, 1));
    } else if (code === "KeyM") {
      this.host.audio.toggleMute();
    }
  }

  keyReleased() {}

  draw(ctx, now) {
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, W, H);

    const near = SPRITES.bg_near;
    ctx.drawImage(near, 0, H - 32 - near.height);
    for (let col = 0; col <= W / 16; col++) {
      ctx.drawImage(SPRITES.tile_ground, col * 16, H - 32);
      ctx.drawImage(SPRITES.tile_dirt, col * 16, H - 16);
    }

    const lemby = Math.floor(now / 0.45) % 2 === 0 ? "lemby_idle_0" : "lemby_idle_1";
    const nousa = Math.floor(now / 0.5) % 2 === 0 ? "nousa_0" : "nousa_1";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(SPRITES[lemby], W / 2 - 90 - 24, H - 32 - 72, 48, 72);
    ctx.drawImage(SPRITES[nousa], W / 2 + 90 - 24, H - 32 - 72, 48, 72);

    // El-Lemby is smitten: a heart floats between the two of them.
    const beat = Math.round(9 + 2.5 * Math.sin(now * 4.2));
    const bob = Math.round(3 * Math.sin(now * 2.1));
    ctx.drawImage(SPRITES.heart, W / 2 - beat, H - 32 - 58 - bob - beat, beat * 2, beat * 2);

    drawText(ctx, L10N.gameTitle, { x: W / 2, y: 22, size: 44, color: PALETTE.maroon, bold: true });
    drawText(ctx, L10N.gameSubtitle, { x: W / 2, y: 80, size: 16, color: PALETTE.ink, bold: true });
    if (Math.floor(now / 0.55) % 2 === 0) {
      drawText(ctx, L10N.pressStart, { x: W / 2, y: 116, size: 13, color: PALETTE.ink, bold: true });
    }
    drawText(ctx, L10N.controlsHint, { x: W / 2, y: 140, size: 9, color: PALETTE.ink });
    if (this.host.state.highScore > 0) {
      drawText(ctx, `${L10N.highScoreLabel}: ${eastern(this.host.state.highScore)}`, {
        x: W / 2, y: 156, size: 9, color: PALETTE.ink,
      });
    }
    drawText(ctx, L10N.fanDisclaimer, {
      x: W / 2, y: H - 15, size: 8.5, color: PALETTE.cream, alpha: 0.9,
    });
  }
}

// ---------------------------------------------------------------------------

const PHASE = { PLAYING: 0, PAUSED: 1, DYING: 2, WON: 3 };

export class GameScene {
  constructor(host, stage, { demo = false } = {}) {
    this.host = host;
    this.stage = stage;
    this.demo = demo;
    this.state = demo ? new GameState() : host.state;
    this.world = new World(parseLevel(LEVELS[`level${stage}`]));
    this.input = emptyInput();
    this.phase = PHASE.PLAYING;
    this.phaseAt = 0;
    this.camX = this.clampCam(this.world.playerSpawn.x);
    this.timeLeft = CFG.stageTimeSeconds;
    this.clockAcc = 0;
    this.bornAt = null;
    this.pendingBonus = 0;
    this.toastAt = -Infinity;
    this.toastText = "";
    this.particles = [];
    if (!demo) {
      host.audio.startMusic();
    }
  }

  clampCam(x) {
    const half = W / 2;
    return Math.min(Math.max(x, half), Math.max(half, this.world.widthPoints - half));
  }

  keyPressed(code, now) {
    if (this.demo) {
      // Any button leaves the demo and starts a real game.
      this.host.state = new GameState();
      this.host.switch(code === "Space" || code === "Enter"
        ? new GameScene(this.host, 1)
        : new TitleScene(this.host));
      return;
    }
    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      this.input.jumpPressedAt = now;
    } else if (code === "KeyP" || code === "Escape") {
      this.togglePause();
    } else if (code === "KeyM") {
      this.host.audio.toggleMute();
    }
  }

  keyReleased() {}

  togglePause() {
    if (this.phase === PHASE.PLAYING) {
      this.phase = PHASE.PAUSED;
      this.host.audio.stopMusic();
    } else if (this.phase === PHASE.PAUSED) {
      this.phase = PHASE.PLAYING;
      this.host.audio.startMusic();
    }
  }

  update(dt, now) {
    if (this.bornAt === null) {
      this.bornAt = now;
      this.phaseAt = now;
    }
    this.particles = this.particles.filter((p) => now - p.bornAt - p.delay <= p.life);

    switch (this.phase) {
      case PHASE.PAUSED:
        return;

      case PHASE.PLAYING: {
        if (this.demo) {
          botDrive(this.world, this.input, now);
        } else {
          const inp = this.host.inputState;
          this.input.moveX =
            (inp.has("ArrowLeft") || inp.has("KeyA") ? -1 : 0) +
            (inp.has("ArrowRight") || inp.has("KeyD") ? 1 : 0);
          this.input.jumpHeld = inp.has("Space") || inp.has("ArrowUp") || inp.has("KeyW");
        }
        const events = this.world.step(dt, this.input, now);
        this.handleEvents(events, now);
        this.tickClock(dt, now);
        if (this.phase === PHASE.PLAYING && this.world.player.y < CFG.fallDeathY) {
          this.startDeath(now);
        }
        this.moveCamera();
        break;
      }

      case PHASE.DYING: {
        this.world.step(dt, emptyInput(), now);
        if (now - this.phaseAt > 1.5) {
          this.afterDeath(now);
        }
        break;
      }

      case PHASE.WON: {
        this.world.step(dt, emptyInput(), now, true);
        this.moveCamera();
        if (now - this.phaseAt > 2.0) {
          if (this.demo) {
            this.host.switch(new TitleScene(this.host));
          } else if (this.stage < CFG.stageCount) {
            this.host.switch(new GameScene(this.host, this.stage + 1));
          } else {
            this.host.switch(new ResultScene(this.host, "clear", this.pendingBonus));
          }
        }
        break;
      }
    }
  }

  moveCamera() {
    const target = this.clampCam(this.world.player.x);
    this.camX += (target - this.camX) * CFG.cameraLerp;
  }

  tickClock(dt, now) {
    this.clockAcc += dt;
    while (this.clockAcc >= 1) {
      this.clockAcc -= 1;
      this.timeLeft -= 1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.startDeath(now);
        return;
      }
    }
  }

  handleEvents(events, now) {
    const audio = this.host.audio;
    for (const e of events) {
      switch (e.kind) {
        case EV.JUMPED:
          audio.play("jump");
          break;
        case EV.COIN:
          this.state.collectCoin();
          audio.play("coin");
          break;
        case EV.CRATE_COIN:
          this.state.collectCoin();
          audio.play("coin");
          this.particles.push({
            frames: ["coin_0", "coin_1", "coin_2", "coin_3"],
            x: e.x, y: e.y + 14, vy: 110,
            bornAt: now, delay: 0, life: 0.34, frameTime: 0.06,
          });
          break;
        case EV.CRATE_SANDWICH:
        case EV.CRATE_SPENT:
          audio.play("bump");
          break;
        case EV.POWERUP:
          this.state.isPowered = true;
          this.state.score += CFG.powerUpScore;
          audio.play("powerup");
          break;
        case EV.STOMPED:
          this.state.score += CFG.stompScore;
          audio.play("stomp");
          break;
        case EV.PLAYER_HIT:
          this.onPlayerHit(now);
          break;
        case EV.CHECKPOINT:
          audio.play("checkpoint");
          this.toastAt = now;
          this.toastText = L10N.checkpointToast;
          break;
        case EV.GOAL:
          this.winStage(now);
          break;
      }
      if (this.phase !== PHASE.PLAYING) {
        break;
      }
    }
  }

  onPlayerHit(now) {
    const p = this.world.player;
    if (p.dead || now < p.invulnerableUntil) {
      return;
    }
    if (this.state.isPowered) {
      this.state.isPowered = false;
      this.host.audio.play("hurt");
      p.invulnerableUntil = now + CFG.hurtInvulnerabilityTime;
    } else {
      this.startDeath(now);
    }
  }

  startDeath(now) {
    if (this.phase !== PHASE.PLAYING) {
      return;
    }
    this.phase = PHASE.DYING;
    this.phaseAt = now;
    this.state.lives -= 1;
    this.state.isPowered = false;
    this.world.killPlayer();
    if (this.state.lives <= 0) {
      this.host.audio.stopMusic();
      this.host.audio.play("gameover");
    } else {
      this.host.audio.play("hurt");
    }
  }

  afterDeath(now) {
    if (this.demo) {
      this.host.switch(new TitleScene(this.host));
      return;
    }
    if (this.state.lives > 0) {
      this.timeLeft = CFG.stageTimeSeconds;
      this.clockAcc = 0;
      this.world.respawnPlayer(now);
      this.camX = this.clampCam(this.world.player.x);
      this.phase = PHASE.PLAYING;
      this.phaseAt = now;
    } else {
      this.state.commitHighScore();
      this.host.switch(new ResultScene(this.host, "gameover", 0));
    }
  }

  winStage(now) {
    if (this.phase !== PHASE.PLAYING) {
      return;
    }
    this.phase = PHASE.WON;
    this.phaseAt = now;
    this.input = emptyInput();
    this.world.player.vx = 0;
    this.host.audio.stopMusic();
    this.host.audio.play("win");
    this.pendingBonus = this.state.awardTimeBonus(this.timeLeft);
    if (!this.demo) {
      this.state.commitHighScore();
    }
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        frames: ["heart"],
        x: this.world.goalX + ((i % 3) - 1) * 12 + i * 2,
        y: this.world.goalY + 10,
        vy: 29,
        bornAt: now, delay: 0.15 * i, life: 1.15, frameTime: 1,
      });
    }
  }

  // ------------------------------------------------------------------

  get camLeft() {
    return this.camX - W / 2;
  }

  worldRect(wx, wy, w, h) {
    return [Math.round(wx - this.camLeft - w / 2), Math.round(H - (wy + h / 2)), w, h];
  }

  draw(ctx, now) {
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    this.drawParallax(ctx, SPRITES.bg_far, CFG.parallaxFar, 44);
    this.drawParallax(ctx, SPRITES.bg_near, CFG.parallaxNear, 32);
    this.drawTiles(ctx);
    this.drawEntities(ctx, now);
    this.drawParticles(ctx, now);
    this.drawParallax(ctx, SPRITES.bg_fore, CFG.parallaxFore, 0);
    this.drawHud(ctx);
    this.drawOverlays(ctx, now);
  }

  drawParallax(ctx, strip, parallax, bottomWorldY) {
    const y = H - bottomWorldY - strip.height;
    const w = strip.width;
    const phase = ((((-this.camLeft * parallax) % w) + w) % w) - w;
    for (let x = phase; x < W; x += w) {
      ctx.drawImage(strip, Math.round(x), y);
    }
  }

  drawTiles(ctx) {
    const level = this.world.level;
    const t = CFG.tile;
    const first = Math.max(0, Math.floor(this.camLeft / t) - 1);
    const last = Math.min(level.columns - 1, first + W / t + 2);
    for (let col = first; col <= last; col++) {
      const sx = Math.round(col * t - this.camLeft);
      for (let row = 0; row < level.rows; row++) {
        const kind = level.tile(col, row);
        if (kind === null) {
          continue;
        }
        let sy = H - (level.rows - row) * t;
        let sprite = {
          G: "tile_ground", D: "tile_dirt", B: "tile_brick", X: "tile_crate",
          "=": "tile_stone", "?": "tile_mystery", F: "tile_mystery",
        }[kind];
        const crate = this.world.crates.get(`${col},${row}`);
        if (crate) {
          if (crate.spent) {
            sprite = "tile_crate_used";
          }
          if (crate.nudgeT > 0) {
            sy -= Math.round(3 * (crate.nudgeT / 0.12));
          }
        }
        ctx.drawImage(SPRITES[sprite], sx, sy);
      }
    }
  }

  // The 2.5D grounding cue: a soft ellipse on the first solid surface
  // below the entity, shrinking and fading with height.
  shadowGroundY(x, fromY) {
    const col = Math.floor(x / CFG.tile);
    for (let rfb = Math.floor((fromY - 1) / CFG.tile); rfb >= 0; rfb--) {
      if (this.world.isSolidCell(col, rfb)) {
        return (rfb + 1) * CFG.tile;
      }
    }
    return null;
  }

  drawShadow(ctx, x, bottom) {
    const groundY = this.shadowGroundY(x, bottom);
    if (groundY === null) {
      return;
    }
    const height = Math.max(0, bottom - groundY);
    const rx = Math.max(3, 7 - height / 26);
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, 0.28 - height / 500);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(Math.round(x - this.camLeft), Math.round(H - groundY), rx, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawEntities(ctx, now) {
    const w = this.world;

    if (!w.player.dead) {
      this.drawShadow(ctx, w.player.x, w.player.y - 11);
    }
    for (const thug of w.thugs) {
      if (!thug.squashed && !thug.gone) {
        this.drawShadow(ctx, thug.x, thug.y - 11);
      }
    }
    this.drawShadow(ctx, w.goalX, w.goalY - 12);
    for (const cp of w.checkpoints) {
      this.drawShadow(ctx, cp.x, cp.y - 12);
    }
    for (const power of w.powerUps) {
      if (!power.collected && power.emergeT >= 0.35) {
        this.drawShadow(ctx, power.x, w.powerUpY(power) - 5.5);
      }
    }

    const coinFrame = Math.floor(now / 0.12) % 4;
    for (const coin of w.coins) {
      if (!coin.collected) {
        ctx.drawImage(SPRITES[`coin_${coinFrame}`], ...this.worldRect(coin.x, coin.y, 12, 12));
      }
    }
    for (const power of w.powerUps) {
      if (!power.collected) {
        ctx.drawImage(SPRITES.sandwich, ...this.worldRect(power.x, w.powerUpY(power), 14, 11));
      }
    }
    const nousa = Math.floor(now / 0.5) % 2 === 0 ? "nousa_0" : "nousa_1";
    ctx.drawImage(SPRITES[nousa], ...this.worldRect(w.goalX, w.goalY, 16, 24));

    for (const cp of w.checkpoints) {
      const cart = cp.activated ? "checkpoint_active" : "checkpoint_idle";
      ctx.drawImage(SPRITES[cart], ...this.worldRect(cp.x, cp.y, 16, 24));
    }

    for (const thug of w.thugs) {
      if (thug.gone) {
        continue;
      }
      if (thug.squashed) {
        const age = now - thug.squashedAt;
        ctx.globalAlpha = age < 0.8 ? 1 : Math.max(0, 1 - (age - 0.8) / 0.3);
        ctx.drawImage(SPRITES.thug_squashed, ...this.worldRect(thug.x, thug.y - 11 + 5, 16, 10));
        ctx.globalAlpha = 1;
      } else {
        const frame = Math.floor(now / 0.22) % 2 === 0 ? "thug_walk_0" : "thug_walk_1";
        const img = thug.direction > 0 ? flipped(frame) : SPRITES[frame];
        ctx.drawImage(img, ...this.worldRect(thug.x, thug.y, 16, 24));
      }
    }

    this.drawPlayer(ctx, now);
  }

  drawPlayer(ctx, now) {
    const p = this.world.player;
    if (!p.dead && now < p.invulnerableUntil && Math.floor(now * 10) % 2 === 1) {
      return;
    }
    let frame;
    if (p.dead) {
      frame = "lemby_hurt_0";
    } else if (!p.grounded) {
      frame = "lemby_jump_0";
    } else if (Math.abs(p.vx) > 8) {
      frame = `lemby_run_${[0, 1, 2, 1][Math.floor(now / 0.09) % 4]}`;
    } else {
      frame = Math.floor(now / 0.45) % 2 === 0 ? "lemby_idle_0" : "lemby_idle_1";
    }
    const img = p.facing < 0 ? flipped(frame) : SPRITES[frame];
    ctx.drawImage(img, ...this.worldRect(p.x, p.y, 16, 24));
  }

  drawParticles(ctx, now) {
    for (const part of this.particles) {
      const age = now - part.bornAt - part.delay;
      if (age < 0) {
        continue;
      }
      const y = part.y + part.vy * age;
      const frame = part.frames[Math.floor(age / part.frameTime) % part.frames.length];
      const img = SPRITES[frame];
      ctx.globalAlpha = Math.max(0, Math.min(1, 1.6 - (age / part.life) * 1.6));
      ctx.drawImage(img, ...this.worldRect(part.x, y, img.width, img.height));
      ctx.globalAlpha = 1;
    }
  }

  drawHud(ctx) {
    drawText(ctx, `${L10N.hudMoney} ${easternCount(this.state.money)}`, {
      x: W - 10, y: 5, size: 11, align: "right", color: PALETTE.ink, bold: true,
    });
    drawText(ctx, `${L10N.hudLives} ${easternCount(this.state.lives)}`, {
      x: W / 2, y: 5, size: 11, color: PALETTE.ink, bold: true,
    });
    drawText(ctx, `${L10N.hudTime} ${eastern(this.timeLeft)}`, {
      x: 10, y: 5, size: 11, align: "left", color: PALETTE.ink, bold: true,
    });
    if (this.state.isPowered) {
      drawText(ctx, L10N.hudPowered, {
        x: W - 10, y: 21, size: 11, align: "right", color: PALETTE.gold, bold: true,
      });
    }
  }

  drawOverlays(ctx, now) {
    if (this.bornAt !== null) {
      const age = now - this.bornAt;
      if (age < 2.3) {
        drawText(ctx, L10N.stageName(this.stage), {
          x: W / 2, y: 84, size: 15, color: PALETTE.ink, bold: true,
          alpha: Math.max(0, Math.min(1, (2.3 - age) / 0.5)),
        });
      }
    }
    const toastAge = now - this.toastAt;
    if (toastAge >= 0 && toastAge < 1.6) {
      drawText(ctx, this.toastText, {
        x: W / 2, y: 44, size: 11, color: PALETTE.gold, bold: true,
        alpha: Math.max(0, Math.min(1, (1.6 - toastAge) / 0.4)),
      });
    }
    if (this.demo && Math.floor(now / 0.6) % 2 === 0) {
      drawText(ctx, L10N.demo, {
        x: W / 2, y: H - 24, size: 12, color: PALETTE.cream, bold: true,
      });
    }
    if (this.phase === PHASE.PAUSED) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, L10N.paused, { x: W / 2, y: 118, size: 15, color: PALETTE.cream, bold: true });
    }
  }
}

// ---------------------------------------------------------------------------

export class ResultScene {
  constructor(host, kind, timeBonus) {
    this.host = host;
    this.kind = kind;
    this.timeBonus = timeBonus;
  }

  update() {}

  keyPressed(code) {
    if (code === "Space") {
      this.host.state = new GameState();
      this.host.switch(new GameScene(this.host, 1));
    } else if (code === "Enter" || code === "Escape") {
      this.host.switch(new TitleScene(this.host));
    } else if (code === "KeyM") {
      this.host.audio.toggleMute();
    }
  }

  keyReleased() {}

  draw(ctx, now) {
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const state = this.host.state;

    const stats = [];
    if (this.kind === "clear") {
      drawText(ctx, L10N.stageClear, { x: W / 2, y: 36, size: 26, color: PALETTE.gold, bold: true });
      drawText(ctx, L10N.stageClearSub, { x: W / 2, y: 74, size: 12, color: PALETTE.cream });
      stats.push(`${L10N.timeBonusLabel}: ${eastern(this.timeBonus)}`);
      ctx.drawImage(SPRITES.lemby_idle_0, W / 2 - 60, 106, 40, 60);
      ctx.drawImage(SPRITES.nousa_0, W / 2 + 20, 106, 40, 60);
      const beat = Math.round(6 + 4 * Math.abs(Math.sin(now * 3.5)));
      ctx.drawImage(SPRITES.heart, W / 2 - beat, 96 - beat, beat * 2, beat * 2);
    } else {
      drawText(ctx, L10N.gameOver, { x: W / 2, y: 36, size: 26, color: PALETTE.maroon, bold: true });
      drawText(ctx, L10N.gameOverQuote, { x: W / 2, y: 74, size: 12, color: PALETTE.cream });
      ctx.drawImage(SPRITES.lemby_hurt_0, W / 2 - 20, 106, 40, 60);
    }
    stats.push(`${L10N.moneyLabel}: ${eastern(state.money)}`);
    stats.push(`${L10N.scoreLabel}: ${eastern(state.score)}`);
    stats.push(`${L10N.highScoreLabel}: ${eastern(state.highScore)}`);
    stats.forEach((line, i) => {
      drawText(ctx, line, { x: W / 2, y: 180 + i * 17, size: 11, color: PALETTE.cream });
    });
    if (Math.floor(now / 0.6) % 2 === 0) {
      drawText(ctx, L10N.retryHint, { x: W / 2, y: 248, size: 10, color: PALETTE.cream, alpha: 0.85 });
    }
  }
}
