/**
 * Print a generated floor: node graph, per-node clock estimates, and a sample
 * corridor's door/wave script. Balance work happens here rather than by
 * replaying the game.
 *
 *   npx esbuild tools/dev/dumpfloor.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/df.mjs && node /tmp/df.mjs [floorIndex]
 */
import { CONFIG } from '../../src/config';
import { clearableNodes, getFloor } from '../../src/game/floors';

const idx = Number(process.argv[2] ?? 0);
const f = getFloor(idx);
console.log(`floor ${idx + 1}: clock ${f.timeLimitSec}s, boss ${f.bossHp} hp`);
console.log('layers', JSON.stringify(f.layers));

let est = 0;
for (const id of Object.keys(f.nodes)) {
  const n = f.nodes[id];
  console.log(
    `  ${id.padEnd(7)} ${n.kind.padEnd(9)} est=${String(n.estSec).padStart(3)}s ` +
    `tier=${(n.tier ?? '-').padEnd(6)} links=${n.links.join(',')}`,
  );
  est += n.estSec;
}
const travel = clearableNodes(f).length * CONFIG.floors.travelCostSec;
console.log(`full sweep ≈ ${est + travel}s of a ${f.timeLimitSec}s clock`);

for (const n of Object.values(f.nodes)) {
  if (n.kind !== 'corridor' || !n.enc) continue;
  console.log(
    `  corridor ${n.id}: len ${n.enc.length}px, ${n.enc.doors.length} doors, ${n.enc.waves.length} waves`,
  );
  console.log('    doors:', n.enc.doors.map((d) => `${d.left}|${d.right}`).join(' '));
  console.log('    waves:', n.enc.waves.map((w) => `${w.kind}×${w.count}`).join(' '));
}
