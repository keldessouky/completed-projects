// `npm start`: build the game if the source is newer than the last build,
// then serve it on localhost and open it in the default browser.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, openBrowser, probe, startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  const how = {
    darwin: 'download it from https://nodejs.org, or run `brew upgrade node`',
    win32: 'download it from https://nodejs.org, or run `winget install OpenJS.NodeJS.LTS`',
  }[process.platform] ?? 'see https://nodejs.org/en/download (your distro\'s package may be too old; `sudo snap install node --classic` or nvm get you a current one)';
  console.error(`Reactor needs Node.js 20.19 or newer (you have ${process.versions.node}). To update, ${how}.`);
  process.exit(1);
}

function newest(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(0, ...readdirSync(path).filter((n) => n !== 'generated').map((n) => newest(join(path, n))));
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(join(root, 'node_modules'))) {
  console.log('First run: installing dependencies…');
  run(npm, ['install', '--no-audit', '--no-fund']);
}

const built = join(root, 'dist', 'index.html');
const sourceTime = Math.max(newest(join(root, 'src')), newest(join(root, 'index.html')), newest(join(root, 'package.json')));
if (!existsSync(built) || statSync(built).mtimeMs < sourceTime) {
  console.log('Building the game…');
  run(npm, ['run', 'build', '--silent']);
}

if (await probe(DEFAULT_PORT)) {
  console.log(`Reactor is already running — opening http://localhost:${DEFAULT_PORT}/`);
  if (!args.includes('--no-open')) openBrowser(`http://localhost:${DEFAULT_PORT}/`);
} else {
  try {
    const { url } = await startServer({ root: join(root, 'dist') });
    if (!args.includes('--no-open')) openBrowser(url);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
