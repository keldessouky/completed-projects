// `npm run app:mac`: package the built game as "Reactor Quest.app" — a real
// macOS app bundle you can drag to /Applications and launch from Launchpad or
// the Dock. It carries its own copy of the game and a tiny server; opening it
// starts the server and the game opens in your default browser. The server
// stops by itself about a minute after you close the game's tab.
// (Node.js must be installed; the app tells you if it isn't.)
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIcns } from './icon.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(root, 'Reactor Quest.app');
const pkg = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(root, 'package.json'), 'utf8')));

if (!process.argv.includes('--skip-build')) {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--silent'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('No build found in dist/. Run `npm run build` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
const contents = join(out, 'Contents');
const macos = join(contents, 'MacOS');
const resources = join(contents, 'Resources');
mkdirSync(macos, { recursive: true });
mkdirSync(resources, { recursive: true });

cpSync(join(root, 'dist'), join(resources, 'app'), { recursive: true });
cpSync(join(root, 'tools', 'server.mjs'), join(resources, 'server.mjs'));
writeFileSync(join(resources, 'AppIcon.icns'), makeIcns());

writeFileSync(
  join(contents, 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Reactor Quest</string>
  <key>CFBundleDisplayName</key><string>Reactor Quest</string>
  <key>CFBundleIdentifier</key><string>dev.completed-projects.reactor-quest</string>
  <key>CFBundleVersion</key><string>${pkg.version}</string>
  <key>CFBundleShortVersionString</key><string>${pkg.version}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>reactor-quest</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`,
);

const launcher = join(macos, 'reactor-quest');
writeFileSync(
  launcher,
  `#!/bin/bash
# Reactor Quest launcher: find Node.js, start the bundled server, open the browser.
HERE="$(cd "$(dirname "$0")/../Resources" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Reactor Quest needs Node.js to run. Install it from nodejs.org (or with Homebrew: brew install node), then open Reactor Quest again." with title "Reactor Quest" buttons {"Get Node.js", "OK"} default button "Get Node.js"' -e 'if button returned of result is "Get Node.js" then open location "https://nodejs.org/en/download"' >/dev/null 2>&1
  exit 1
fi
exec node "$HERE/server.mjs" "$HERE/app" --app >>"$HOME/Library/Logs/reactor-quest.log" 2>&1
`,
);
chmodSync(launcher, 0o755);
console.log(`Built ${out}\nDouble-click it, or drag it to /Applications.`);
