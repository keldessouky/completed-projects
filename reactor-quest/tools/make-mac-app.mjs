// `npm run app:mac`: package the built game as "Reactor Quest.app" — a real
// macOS app bundle you can drag to /Applications and launch from Launchpad or
// the Dock. It carries its own copy of the game and a tiny server; opening it
// starts the server and the game opens in your default browser. The server
// stops by itself about a minute after you close the game's tab.
//
// With --with-node the app carries its own Node.js (one universal executable
// for Apple silicon and Intel), so nothing else needs installing. Without it,
// Node.js must be installed; the app tells you if it isn't.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeIcns } from './icon.mjs';
import { bundleNode, nodeOptions } from './node-runtime.mjs';
import { ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('Reactor Quest.app');
ensureBuild();

rmSync(out, { recursive: true, force: true });
const contents = join(out, 'Contents');
const macos = join(contents, 'MacOS');
const resources = join(contents, 'Resources');
mkdirSync(macos, { recursive: true });
stageApp(resources);
writeFileSync(join(resources, 'AppIcon.icns'), makeIcns());
const withNode = nodeOptions();
if (withNode) await bundleNode('darwin', join(resources, 'runtime', 'node'), withNode);

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
# Reactor Quest launcher: find Node.js (its own copy first), start the bundled
# server, open the browser.
HERE="$(cd "$(dirname "$0")/../Resources" && pwd)"
# Pass on options like --no-open, but not the -psn_ process id older macOS adds.
ARGS=()
for a in "$@"; do case "$a" in -psn_*) ;; *) ARGS+=("$a") ;; esac; done
if "$HERE/runtime/node" -e 0 >/dev/null 2>&1; then
  exec "$HERE/runtime/node" "$HERE/server.mjs" "$HERE/app" --app "\${ARGS[@]}" >>"$HOME/Library/Logs/reactor-quest.log" 2>&1
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Reactor Quest needs Node.js to run. Install it from nodejs.org (or with Homebrew: brew install node), then open Reactor Quest again." with title "Reactor Quest" buttons {"Get Node.js", "OK"} default button "Get Node.js"' -e 'if button returned of result is "Get Node.js" then open location "https://nodejs.org/en/download"' >/dev/null 2>&1
  exit 1
fi
exec node "$HERE/server.mjs" "$HERE/app" --app "\${ARGS[@]}" >>"$HOME/Library/Logs/reactor-quest.log" 2>&1
`,
);
chmodSync(launcher, 0o755);
console.log(`Built ${out}${withNode ? ' (with its own Node.js)' : ''}\nDouble-click it, or drag it to /Applications.`);
