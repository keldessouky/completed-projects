#!/usr/bin/env node
/**
 * Validate public/art/ before you find out in the browser.
 *
 * Checks that every file the manifest names exists, is a PNG, and has exactly
 * the pixel dimensions its declared cell size and scale imply. Sheet size is
 * the one thing that is silently wrong-looking rather than loudly broken — a
 * sheet 4 px too wide slices every frame slightly off and the whole cast
 * jitters — so it is worth a command that just tells you.
 *
 * Usage: npm run art:check
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv[2] ?? join(ROOT, 'public/art');
const ROWS = 5;   // s, se, e, ne, n
const COLS = 5;   // walk 0-3, attack

if (!existsSync(DIR)) {
  console.log(`no ${DIR} — the game will use its own painted art`);
  process.exit(0);
}
const manifestPath = join(DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  // An empty folder is the shipped state and not a problem. Sheets sitting in
  // it with nothing to point at them almost certainly are.
  const strays = readdirSync(DIR).filter((f) => /\.(png|webp)$/i.test(f));
  if (strays.length === 0) {
    console.log('no manifest.json — the game will use its own painted art');
    process.exit(0);
  }
  console.error(`FAIL  ${strays.length} sheet(s) here but no manifest.json:`);
  for (const f of strays) console.error(`        ${f}`);
  console.error('      Nothing is replaced without one. Copy the manifest that');
  console.error('      `npm run art:export` wrote next to your sheets.');
  process.exit(1);
}

/** PNG header: width and height are big-endian u32 at bytes 16 and 20. */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`FAIL  manifest.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const defScale = manifest.scale ?? 3;
let problems = 0;
let checked = 0;
const named = new Set(['manifest.json']);

const report = (ok, line) => {
  if (!ok) problems++;
  console.log(`${ok ? '  ok  ' : 'FAIL  '}${line}`);
};

for (const [kind, entry] of Object.entries(manifest.actors ?? {})) {
  checked++;
  named.add(entry.file);
  const file = join(DIR, entry.file);
  if (!existsSync(file)) { report(false, `${kind}: ${entry.file} is missing`); continue; }
  const size = pngSize(file);
  if (!size) { report(false, `${kind}: ${entry.file} is not a PNG`); continue; }
  if (!Array.isArray(entry.cell) || entry.cell.length !== 2) {
    report(false, `${kind}: "cell" must be [width, height] in design pixels`);
    continue;
  }
  const scale = entry.scale ?? defScale;
  const wantW = Math.round(entry.cell[0] * scale) * COLS;
  const wantH = Math.round(entry.cell[1] * scale) * ROWS;
  const ok = size.w === wantW && size.h === wantH;
  report(ok, `${kind}: ${entry.file} is ${size.w}×${size.h}`
    + (ok ? '' : `, expected ${wantW}×${wantH}`
      + ` (cell ${entry.cell[0]}×${entry.cell[1]} × scale ${scale} × ${COLS}×${ROWS} cells)`));
}

for (const [name, entry] of Object.entries(manifest.sprites ?? {})) {
  checked++;
  named.add(entry.file);
  const file = join(DIR, entry.file);
  if (!existsSync(file)) { report(false, `${name}: ${entry.file} is missing`); continue; }
  const size = pngSize(file);
  if (!size) { report(false, `${name}: ${entry.file} is not a PNG`); continue; }
  const scale = entry.scale ?? defScale;
  const wantW = Math.round(entry.size[0] * scale);
  const wantH = Math.round(entry.size[1] * scale);
  const ok = size.w === wantW && size.h === wantH;
  report(ok, `${name}: ${entry.file} is ${size.w}×${size.h}`
    + (ok ? '' : `, expected ${wantW}×${wantH}`));
}

// Files sitting in the folder that nothing points at are almost always a
// forgotten manifest line rather than deliberate.
for (const f of readdirSync(DIR)) {
  if (!named.has(f) && /\.png$/i.test(f)) {
    console.log(`  --  ${f} is in the folder but not in manifest.json (ignored)`);
  }
}

if (checked === 0) console.log('manifest.json names nothing to replace');
console.log(problems === 0
  ? `\nART OK — ${checked} entr${checked === 1 ? 'y' : 'ies'} check out`
  : `\n${problems} problem${problems === 1 ? '' : 's'}`);
process.exit(problems === 0 ? 0 : 1);
