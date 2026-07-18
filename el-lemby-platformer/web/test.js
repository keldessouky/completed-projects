// Node test suite for the web build — same coverage philosophy as
// windows/ElLemby.Tests: parser, sim behavior, checkpoint semantics, audio
// synth sanity, and the runner bot completing every shipped stage.
// Run:  node web/test.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CFG, eastern, easternCount } from "./src/config.js";
import { parseLevel, ENTITY } from "./src/parser.js";
import { World, EV, emptyInput } from "./src/world.js";
import { botDrive } from "./src/bot.js";
import { renderEvents, musicEvents, SFX_DEFS, SAMPLE_RATE } from "./src/audio.js";

const here = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(here, "..", "Sources", "ElLembyCore", "Resources", "levels");

let passed = 0;
const failures = [];

function check(cond, name) {
  if (cond) {
    passed++;
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}`);
  }
}

function checkEqual(actual, expected, name) {
  check(actual === expected, `${name} (expected ${expected}, got ${actual})`);
}

function checkThrows(kind, fn, name) {
  try {
    fn();
    check(false, `${name}: no error`);
  } catch (e) {
    checkEqual(e.kind, kind, name);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

{
  const level = parseLevel(`// مثال صغير
....o....N
.P..?..E..
GGGGGGGGGG
DDDDDDDDDD`);
  checkEqual(level.columns, 10, "parser: columns");
  checkEqual(level.rows, 4, "parser: rows");
  checkEqual(level.playerSpawn.column, 1, "parser: spawn column");
  checkEqual(level.placements(ENTITY.COIN).length, 1, "parser: coins");
  checkEqual(level.tile(0, 2), "G", "parser: ground tile");
  checkEqual(level.tile(4, 1), "?", "parser: mystery tile");
  check(level.tile(0, 0) === null, "parser: air");
  check(!level.isSolid(-1, 2) && !level.isSolid(99, 2), "parser: out of bounds is air");

  const padded = parseLevel("P.N\nGGGGGG");
  checkEqual(padded.columns, 6, "parser: short rows padded");

  const cp = parseLevel("P.C.N\nGGGGG");
  checkEqual(cp.placements(ENTITY.CHECKPOINT).length, 1, "parser: checkpoint entity");

  checkThrows("unknownCharacter", () => parseLevel("P.N\nGGZ"), "parser: rejects unknown char");
  checkThrows("missingPlayerSpawn", () => parseLevel("..N\nGGG"), "parser: rejects missing spawn");
  checkThrows("duplicatePlayerSpawn", () => parseLevel("PPN\nGGG"), "parser: rejects duplicate spawn");
  checkThrows("missingGoal", () => parseLevel("P..\nGGG"), "parser: rejects missing goal");
  checkThrows("empty", () => parseLevel("\n\n"), "parser: rejects empty");
}

// ---------------------------------------------------------------------------
// L10n
// ---------------------------------------------------------------------------

checkEqual(eastern(0), "٠", "l10n: zero");
checkEqual(eastern(240), "٢٤٠", "l10n: 240");
checkEqual(easternCount(3), "×٣", "l10n: count");

// ---------------------------------------------------------------------------
// Sim
// ---------------------------------------------------------------------------

function run(world, seconds, input, startNow = 0, onEvents = null) {
  const dt = 1 / 60;
  let now = startNow;
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) {
    now += dt;
    const events = world.step(dt, input, now);
    if (onEvents) {
      onEvents(world, events, now);
    }
  }
  return now;
}

const FLAT = `..............................
..............................
..............................
..............................
..P..........................N
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD`;

{
  const w = new World(parseLevel(FLAT));
  const input = emptyInput();
  run(w, 0.5, input);
  check(Math.abs(w.player.y - 11 - 32) < 0.5, "sim: player rests on ground");
  check(w.player.grounded, "sim: grounded flag");
}

{
  const w = new World(parseLevel(FLAT));
  const input = emptyInput();
  input.moveX = 1;
  run(w, 1.0, input);
  check(Math.abs(w.player.vx - CFG.maxRunSpeed) < 1, "sim: reaches max run speed");
}

{
  const w = new World(parseLevel(FLAT));
  const input = emptyInput();
  run(w, 0.3, input);
  input.jumpHeld = true;
  input.jumpPressedAt = 0.3;
  let apex = 0;
  run(w, 1.0, input, 0.3, (world) => {
    apex = Math.max(apex, world.player.y - 11);
  });
  const tiles = (apex - 32) / CFG.tile;
  check(tiles > 3.9 && tiles < 4.8, `sim: jump apex ≈4.3 tiles (got ${tiles.toFixed(2)})`);
}

{
  const w = new World(parseLevel(FLAT));
  const input = emptyInput();
  run(w, 0.3, input);
  input.jumpHeld = false;
  input.jumpPressedAt = 0.3;
  let apex = 0;
  run(w, 1.0, input, 0.3, (world) => {
    apex = Math.max(apex, world.player.y - 11);
  });
  check((apex - 32) / CFG.tile < 2.5, "sim: tapped jump stays low");
}

{
  const w = new World(
    parseLevel(`..........
..........
..........
..P.......
..........
...E.....N
GGGGGGGGGG
DDDDDDDDDD`),
  );
  const input = emptyInput();
  let stomped = false;
  let hit = false;
  run(w, 1.2, input, 0, (world, events) => {
    for (const e of events) {
      if (e.kind === EV.STOMPED) stomped = true;
      if (e.kind === EV.PLAYER_HIT) hit = true;
    }
  });
  check(stomped && !hit, "sim: stomp works and is not a hit");
  check(w.thugs[0].squashed, "sim: thug squashed");
}

{
  const w = new World(
    parseLevel(`..........
...?......
..........
..........
...P.....N
GGGGGGGGGG
DDDDDDDDDD`),
  );
  const input = emptyInput();
  let popped = 0;
  let spentBumps = 0;
  let now = run(w, 0.3, input);
  for (let attempt = 0; attempt < 2; attempt++) {
    input.jumpHeld = true;
    input.jumpPressedAt = now;
    now = run(w, 1.2, input, now, (world, events) => {
      for (const e of events) {
        if (e.kind === EV.CRATE_COIN) popped++;
        if (e.kind === EV.CRATE_SPENT) spentBumps++;
      }
    });
    input.jumpHeld = false;
  }
  checkEqual(popped, 1, "sim: ؟ crate pops exactly once");
  check(spentBumps >= 1, "sim: spent crate still bumps");
}

{
  const w = new World(
    parseLevel(`..........
.P...C...N
GGGGGGGGGG
DDDDDDDDDD`),
  );
  const input = emptyInput();
  input.moveX = 1;
  let reached = 0;
  const now = run(w, 1.0, input, 0, (world, events) => {
    for (const e of events) {
      if (e.kind === EV.CHECKPOINT) reached++;
    }
  });
  checkEqual(reached, 1, "sim: checkpoint fires once");
  w.killPlayer();
  w.respawnPlayer(now);
  check(Math.abs(w.player.x - (5 * 16 + 8)) < 1, "sim: respawn at the foul cart");
  check(w.player.invulnerableUntil > now, "sim: respawn grants i-frames");
}

// ---------------------------------------------------------------------------
// Audio synth sanity
// ---------------------------------------------------------------------------

{
  for (const [name, def] of Object.entries(SFX_DEFS)) {
    const buf = renderEvents(def.events, def.length);
    let peak = 0;
    for (const s of buf) peak = Math.max(peak, Math.abs(s));
    check(buf.length === Math.floor(def.length * SAMPLE_RATE) && peak > 0.05 && peak <= 1,
          `audio: ${name} renders (peak ${peak.toFixed(2)})`);
  }
  const music = musicEvents();
  const buf = renderEvents(music.events, music.length);
  check(Math.abs(buf.length / SAMPLE_RATE - 17.45) < 0.05, "audio: music loop ≈17.45s");
  let nonZero = 0;
  for (const s of buf) if (Math.abs(s) > 0.01) nonZero++;
  check(nonZero / buf.length > 0.5, "audio: music is mostly sound, not silence");
}

// ---------------------------------------------------------------------------
// Shipped stages: integrity + the bot completes each one
// ---------------------------------------------------------------------------

for (let stage = 1; stage <= CFG.stageCount; stage++) {
  const name = `level${stage}`;
  const level = parseLevel(readFileSync(join(levelsDir, `${name}.txt`), "utf8"));
  check(level.columns >= 150, `${name}: real stage`);
  checkEqual(level.rows, 17, `${name}: 17 rows`);
  checkEqual(level.placements(ENTITY.NOUSA).length, 1, `${name}: one goal`);
  check(level.placements(ENTITY.THUG).length >= 4, `${name}: enough thugs`);
  check(level.placements(ENTITY.COIN).length >= 20, `${name}: enough coins`);
  checkEqual(level.placements(ENTITY.CHECKPOINT).length, stage >= 2 ? 1 : 0,
             `${name}: checkpoint count`);

  const world = new World(level);
  const input = emptyInput();
  const dt = 1 / 60;
  let now = 0;
  let won = false;
  let died = false;
  let lastX = world.player.x;
  let stuckSince = 0;
  for (let i = 0; i < 60 * 120 && !won && !died; i++) {
    now += dt;
    botDrive(world, input, now);
    const events = world.step(dt, input, now);
    for (const e of events) {
      if (e.kind === EV.GOAL) won = true;
    }
    if (world.player.y < CFG.fallDeathY) died = true;
    if (Math.abs(world.player.x - lastX) > 0.5) {
      lastX = world.player.x;
      stuckSince = now;
    } else if (now - stuckSince > 4) {
      break;
    }
  }
  check(won && !died,
        `${name}: bot completes the stage (won=${won}, died=${died}, x=${world.player.x.toFixed(0)}/${world.widthPoints})`);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
