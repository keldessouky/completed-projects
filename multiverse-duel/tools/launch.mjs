// `npm start` (or double-clicking "Multiverse Duel.command"): install on first run,
// build if the source changed, serve on localhost and open the browser.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, openBrowser, probe, startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : DEFAULT_PORT;
const open = !args.includes('--no-open');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(`Multiverse Duel needs Node.js 20.19 or newer (you have ${process.versions.node}). Get it from https://nodejs.org or run: brew upgrade node`);
  process.exit(1);
}

const newest = (path) => {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  return s.isDirectory() ? Math.max(0, ...readdirSync(path).map((n) => newest(join(path, n)))) : s.mtimeMs;
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmdArgs) => {
  const r = spawnSync(npm, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(join(root, 'node_modules'))) {
  console.log('First run: installing dependencies (about a minute)…');
  run(['install', '--no-audit', '--no-fund']);
}
if (!existsSync(join(root, 'public', 'data', 'cards.json.gz'))) {
  console.log('Downloading the card database from Scryfall…');
  run(['run', 'cards:update']);
}
const built = join(root, 'dist', 'index.html');
const source = Math.max(newest(join(root, 'src')), newest(join(root, 'public')), newest(join(root, 'index.html')), newest(join(root, 'package.json')));
if (!existsSync(built) || statSync(built).mtimeMs < source) {
  console.log('Building the game…');
  run(['run', 'build', '--silent']);
}

if (await probe(port)) {
  console.log(`Multiverse Duel is already running — opening http://localhost:${port}/`);
  if (open) openBrowser(`http://localhost:${port}/`);
} else {
  try {
    const { url } = await startServer({ root: join(root, 'dist'), port });
    if (open) openBrowser(url);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
