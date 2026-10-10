// Test helper: the real card snapshot, loaded from disk.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildUniverse, type Snapshot, type Universe } from '../src/data/cards';

let cached: Universe | null = null;
export function universe(): Universe {
  cached ??= buildUniverse(JSON.parse(gunzipSync(readFileSync(new URL('../public/data/cards.json.gz', import.meta.url))).toString()) as Snapshot);
  return cached;
}
export const card = (name: string) => {
  const c = universe().cards.find((x) => x.name === name || x.fullName === name);
  if (!c) throw new Error(`no card ${name}`);
  return c;
};
