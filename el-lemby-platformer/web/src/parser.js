// The ASCII level format — a straight port of LevelParser.swift /
// LevelParser.cs. One character per 16×16 tile, top row first; `//` lines
// are comments; short rows are padded with air.
//
//   .  air          G  ground        D  dirt fill     B  brick
//   X  crate        =  sandstone     ?  crate → coin  F  crate → sandwich
//   o  coin         P  player        E  thug          N  Nousa (goal)
//   C  checkpoint (عربية الفول)

export const TILE = {
  GROUND: "G",
  DIRT: "D",
  BRICK: "B",
  CRATE: "X",
  STONE: "=",
  MYSTERY_COIN: "?",
  MYSTERY_SANDWICH: "F",
};

const TILE_CHARS = new Set(Object.values(TILE));

export const ENTITY = {
  PLAYER: "P",
  THUG: "E",
  COIN: "o",
  NOUSA: "N",
  CHECKPOINT: "C",
};

const ENTITY_CHARS = new Set(Object.values(ENTITY));

export function tileIsMystery(t) {
  return t === TILE.MYSTERY_COIN || t === TILE.MYSTERY_SANDWICH;
}

export const TILE_SPRITE = {
  G: "tile_ground",
  D: "tile_dirt",
  B: "tile_brick",
  X: "tile_crate",
  "=": "tile_stone",
  "?": "tile_mystery",
  F: "tile_mystery",
};

export class LevelParseError extends Error {
  constructor(kind, detail = "") {
    super(`${kind} ${detail}`.trim());
    this.kind = kind;
  }
}

export class LevelData {
  constructor(columns, rows, tiles, entities) {
    this.columns = columns;
    this.rows = rows;
    this.tiles = tiles; // tiles[row][col] → tile char or null, row 0 = top
    this.entities = entities; // [{kind, column, row}]
  }

  tile(column, row) {
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
      return null;
    }
    return this.tiles[row][column];
  }

  isSolid(column, row) {
    return this.tile(column, row) !== null;
  }

  placements(kind) {
    return this.entities.filter((e) => e.kind === kind);
  }

  get playerSpawn() {
    return this.entities.find((e) => e.kind === ENTITY.PLAYER) ?? null;
  }
}

export function parseLevel(text) {
  let lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => !l.startsWith("//"));
  while (lines.length > 0 && lines[0].trim().length === 0) {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
    lines.pop();
  }
  if (lines.length === 0) {
    throw new LevelParseError("empty");
  }

  const columns = Math.max(...lines.map((l) => l.length));
  if (columns === 0) {
    throw new LevelParseError("empty");
  }

  const tiles = [];
  const entities = [];
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    const out = new Array(columns).fill(null);
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === "." || ch === " ") {
        continue;
      }
      if (TILE_CHARS.has(ch)) {
        out[col] = ch;
      } else if (ENTITY_CHARS.has(ch)) {
        entities.push({ kind: ch, column: col, row });
      } else {
        throw new LevelParseError("unknownCharacter", `'${ch}' at ${row}:${col}`);
      }
    }
    tiles.push(out);
  }

  const spawns = entities.filter((e) => e.kind === ENTITY.PLAYER).length;
  if (spawns === 0) {
    throw new LevelParseError("missingPlayerSpawn");
  }
  if (spawns > 1) {
    throw new LevelParseError("duplicatePlayerSpawn");
  }
  if (!entities.some((e) => e.kind === ENTITY.NOUSA)) {
    throw new LevelParseError("missingGoal");
  }

  return new LevelData(columns, lines.length, tiles, entities);
}
