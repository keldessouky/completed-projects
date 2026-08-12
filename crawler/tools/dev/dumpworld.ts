/**
 * Print the generated world: POI layout, distances from the first town, and
 * each camp's population. Balance work happens here rather than by wandering.
 *
 *   npx esbuild tools/dev/dumpworld.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/dw.mjs && node /tmp/dw.mjs
 */
import { CONFIG } from '../../src/config';
import { getWorld, biomeAt } from '../../src/world/worldgen';

const w = getWorld();
const town = w.pois.find((p) => p.id === 'town_a')!;
console.log(`world ${CONFIG.world.size}² · ${w.pois.length} POIs · spawn ${w.spawn.x | 0},${w.spawn.y | 0}`);

const rows = w.pois.map((p) => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  d: Math.round(Math.hypot(p.x - town.x, p.y - town.y)),
  biome: biomeAt(p.x, p.y),
  pop: (p.spawns ?? []).join(','),
})).sort((a, b) => a.d - b.d);

for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(9)} ${r.kind.padEnd(7)} ${String(r.d).padStart(5)}u  ${r.biome.padEnd(7)} ${r.name.padEnd(18)} ${r.pop}`,
  );
}

// closest pair, to see whether populations will overlap on screen
let worst = Infinity, pair = '';
for (let i = 0; i < w.pois.length; i++) {
  for (let j = i + 1; j < w.pois.length; j++) {
    const d = Math.hypot(w.pois[i].x - w.pois[j].x, w.pois[i].y - w.pois[j].y);
    if (d < worst) { worst = d; pair = `${w.pois[i].id}/${w.pois[j].id}`; }
  }
}
console.log(`closest pair: ${pair} at ${Math.round(worst)}u (spawn radius ${CONFIG.enemies.despawnDist * 0.8})`);
