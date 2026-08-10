/**
 * Vendor the LPC character layers this game uses into `public/lpc/`.
 *
 * The Universal LPC Spritesheet Character Generator is a ~520 MB library of
 * 13,853 layered character sprites. The game needs about forty of them, so this
 * script clones the repo to a cache, copies exactly the roster below, and writes
 * an attribution file covering precisely the files that ship — every LPC asset
 * carries a per-file author and licence list in the project's CREDITS.csv, and
 * OGA-BY / CC-BY-SA both require that attribution to travel with the art.
 *
 * These assets are freely redistributable, so unlike the drop-in art-pack path
 * they are committed to the repo: the build stays reproducible without anyone
 * having to fetch half a gigabyte.
 *
 *   node tools/vendor-lpc.mjs [--repo <path to an existing clone>]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'lpc');
const UPSTREAM = 'https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git';

const argRepo = process.argv.indexOf('--repo');
let repo = argRepo >= 0 ? process.argv[argRepo + 1] : join(ROOT, '.cache', 'lpc');
if (!existsSync(join(repo, 'CREDITS.csv'))) {
  mkdirSync(dirname(repo), { recursive: true });
  rmSync(repo, { recursive: true, force: true });
  console.log('cloning LPC (this is a large repo, once)…');
  execFileSync('git', ['clone', '--depth', '1', UPSTREAM, repo], { stdio: 'inherit' });
}

/**
 * The roster. `to` is the name the game loads; `from` is the path inside the
 * LPC spritesheets tree, minus the animation file. Only walk and slash ship:
 * walk covers every kind of movement, slash covers every kind of attack, and
 * each extra animation is another 3 KB × 40 layers for frames nothing plays.
 */
const ANIMS = ['walk', 'thrust', 'shoot'];
const ROSTER = [
  // ---- bodies
  ['body_male', 'body/bodies/male'],
  ['body_king', 'body/bodies/muscular'],
  ['body_skeleton', 'body/bodies/skeleton'],
  ['body_zombie', 'body/bodies/zombie/@/zombie'],
  // ---- heads
  ['head_human', 'head/heads/human/male'],
  ['head_skeleton', 'head/heads/skeleton/adult'],
  ['head_orc', 'head/heads/orc/male'],
  ['head_goblin', 'head/heads/goblin/adult'],
  ['head_minotaur', 'head/heads/minotaur/male'],
  ['head_zombie', 'head/heads/zombie/adult'],
  // ---- torso: one per soldier tier, recoloured per era
  ['torso_leather', 'torso/armour/leather/male'],
  ['torso_chain', 'torso/chainmail/male'],
  ['torso_plate', 'torso/armour/plate/male'],
  ['torso_legion', 'torso/armour/legion/male'],
  // ---- legs and feet
  ['legs_pants', 'legs/pants/male'],
  ['legs_plate', 'legs/armour/plate/male'],
  ['feet_boots', 'feet/boots/revised/male'],
  ['feet_plate', 'feet/armour/plate/male'],
  // ---- headgear, one per tier
  ['hat_cloth', 'hat/cloth/hood/adult'],
  ['helm_legion', 'hat/helmet/legion/adult'],
  ['helm_bascinet', 'hat/helmet/bascinet/adult'],
  ['helm_armet', 'hat/helmet/armet/adult'],
  ['helm_xeon', 'hat/helmet/xeon/adult'],
  // ---- weapons LPC already has; eras 1-3 are drawn by the game
  // LPC names a weapon's attack directory after the attack, not the body's
  // animation, so these entries remap it
  ['weapon_sword', 'weapon/sword/longsword/@', { thrust: 'attack_thrust' }],
  ['weapon_glow', 'weapon/sword/glowsword/@', { thrust: 'attack_slash' }],
];

/**
 * LPC stores some layers as `<dir>/<anim>.png` and others as
 * `<dir>/<anim>/<leaf>.png`. `@` in a roster path marks where the animation
 * name goes; without it the animation is the filename.
 */
function sourceFor(repoRoot, from, anim) {
  const base = join(repoRoot, 'spritesheets');
  if (!from.includes('@')) return join(base, from, `${anim}.png`);
  const [head, tail] = from.split('/@');
  const leaf = tail.replace(/^\//, '');
  if (leaf) return join(base, head, anim, `${leaf}.png`);
  // no leaf named: the animation directory holds a single sheet under some
  // other name, so take whatever PNG is in it
  const dir = join(base, head, anim);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return dir;
  const png = readdirSync(dir).find((f) => f.endsWith('.png'));
  return png ? join(dir, png) : dir;
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();

mkdirSync(OUT, { recursive: true });
const shipped = [];
const missing = [];
let bytes = 0;

for (const [name, from, alias] of ROSTER) {
  for (const anim of ANIMS) {
    const src = sourceFor(repo, from, (alias && alias[anim]) || anim);
    if (!isFile(src)) { missing.push(`${name}/${anim}`); continue; }
    const dst = join(OUT, `${name}_${anim}.png`);
    cpSync(src, dst);
    bytes += Buffer.byteLength(readFileSync(dst));
    shipped.push([`${name}_${anim}.png`, src.slice(src.indexOf('spritesheets/') + 13)]);
  }
}

// ---- attribution for exactly what shipped
const credits = readFileSync(join(repo, 'CREDITS.csv'), 'utf8');
const rows = parseCsv(credits);
const byFile = new Map(rows.map((r) => [r.filename, r]));
const lines = [
  '# LPC asset attribution',
  '',
  'Character art in `public/lpc/` comes from the Universal LPC Spritesheet',
  'Character Generator. Every file below is listed with its original path, its',
  'authors and its licence, as OGA-BY 3.0 and CC-BY-SA 3.0 both require.',
  '',
  'Upstream: <' + UPSTREAM.replace(/\.git$/, '') + '>',
  '',
  'Regenerate this file with `node tools/vendor-lpc.mjs`.',
  '',
];
const allLicences = new Set();
for (const [ship, orig] of shipped) {
  const row = byFile.get(orig) ?? byFile.get(orig.replace(/\\/g, '/'));
  lines.push(`### ${ship}`);
  lines.push(`- source: \`${orig}\``);
  if (row) {
    lines.push(`- authors: ${row.authors}`);
    lines.push(`- licences: ${row.licenses}`);
    for (const l of row.licenses.split(',')) allLicences.add(l.trim());
    if (row.urls) lines.push(`- urls: ${row.urls.split(',').slice(0, 3).join(', ')}`);
  } else {
    lines.push('- authors: see upstream CREDITS.csv');
  }
  lines.push('');
}
lines.splice(9, 0, `Licences across these files: ${[...allLicences].sort().join(', ')}.`, '');
writeFileSync(join(OUT, 'CREDITS.md'), lines.join('\n'));

console.log(`vendored ${shipped.length} sheets → public/lpc/  (${(bytes / 1024).toFixed(0)} KB)`);
if (missing.length) console.log(`missing (skipped): ${missing.join(', ')}`);

/** Minimal CSV reader: LPC's credits file quotes fields containing commas. */
function parseCsv(text) {
  const out = [];
  const lines = [];
  let cur = '';
  let q = false;
  for (const ch of text) {
    if (ch === '"') q = !q;
    if (ch === '\n' && !q) { lines.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) lines.push(cur);
  const head = splitRow(lines.shift());
  for (const l of lines) {
    const cells = splitRow(l);
    if (cells.length < 2) continue;
    const row = {};
    head.forEach((h, i) => { row[h.trim()] = (cells[i] ?? '').trim(); });
    out.push(row);
  }
  return out;
}
function splitRow(line) {
  const cells = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}
