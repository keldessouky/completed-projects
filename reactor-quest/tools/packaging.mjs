// Shared by the app packagers (make-mac-app, make-win-app, make-linux-app):
// build the game unless told not to, then copy the build and the zero-dependency
// server into a package folder.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** The output folder: the first non-flag argument, or `fallback` inside the project. */
export const outDir = (fallback) => process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(root, fallback);

export function ensureBuild() {
  if (!process.argv.includes('--skip-build')) {
    // npm is a .cmd on Windows, which Node only runs through a shell.
    const win = process.platform === 'win32';
    const r = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'build', '--silent'], { cwd: root, stdio: 'inherit', shell: win });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    console.error('No build found in dist/. Run `npm run build` first.');
    process.exit(1);
  }
}

/** Start `dir` afresh and put the game (app/) and its server (server.mjs) in it. */
export function stageApp(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(root, 'dist'), join(dir, 'app'), { recursive: true });
  cpSync(join(root, 'tools', 'server.mjs'), join(dir, 'server.mjs'));
}

/** Windows scripts want CRLF line endings. */
export const crlf = (text) => text.replace(/\r?\n/g, '\r\n');
