// `npm run app:linux`: package the built game for Linux as a folder you can
// tar up and copy anywhere:
//
//   reactor-quest-linux/
//     reactor-quest       run it to play (no install needed)
//     install.sh          adds Reactor Quest to your app menu (no sudo)
//     uninstall.sh        removes it again
//     reactor-quest.png server.mjs app/
//
// Playing starts the bundled server in the background and opens the game in
// your default browser; the server stops by itself about a minute after you
// close the game's tab. Node.js must be installed; the launcher says so if not.
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawIcon } from './icon.mjs';
import { ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('reactor-quest-linux');
ensureBuild();
stageApp(out);
writeFileSync(join(out, 'reactor-quest.png'), drawIcon(256));

const script = (name, text) => {
  writeFileSync(join(out, name), text);
  chmodSync(join(out, name), 0o755);
};

script(
  'reactor-quest',
  `#!/usr/bin/env bash
# Reactor Quest ${pkg.version}: find Node.js, start the game's server in the
# background, and open the game in the default browser.
# Extra arguments (for example --no-open) are passed to the server.
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/snap/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  MSG="Reactor Quest needs Node.js (version 20.19 or newer).
Get it from https://nodejs.org/en/download
or, for example:  sudo snap install node --classic"
  if [ -t 1 ]; then
    echo "$MSG"
  elif command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Reactor Quest" --text="$MSG" 2>/dev/null
  elif command -v kdialog >/dev/null 2>&1; then
    kdialog --title "Reactor Quest" --error "$MSG" 2>/dev/null
  elif command -v notify-send >/dev/null 2>&1; then
    notify-send "Reactor Quest" "$MSG"
  fi
  (xdg-open "https://nodejs.org/en/download" >/dev/null 2>&1 &)
  exit 1
fi

LOG="\${XDG_STATE_HOME:-$HOME/.local/state}/reactor-quest/reactor-quest.log"
nohup node "$HERE/server.mjs" "$HERE/app" --app --log "$LOG" "$@" >/dev/null 2>&1 &
`,
);

script(
  'install.sh',
  `#!/usr/bin/env bash
# Install Reactor Quest for this user: copy it to ~/.local/share/reactor-quest,
# add it to your desktop's app menu, and put \`reactor-quest\` on your PATH.
# No sudo needed.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DATA="\${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/reactor-quest"

if [ "$SRC" != "$DEST" ]; then
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -R "$SRC/." "$DEST/"
fi

mkdir -p "$DATA/icons/hicolor/256x256/apps" "$DATA/applications" "$HOME/.local/bin"
cp "$DEST/reactor-quest.png" "$DATA/icons/hicolor/256x256/apps/reactor-quest.png"
ln -sf "$DEST/reactor-quest" "$HOME/.local/bin/reactor-quest"
cat > "$DATA/applications/reactor-quest.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Reactor Quest
GenericName=Coding game
Comment=Learn TypeScript and React by playing
Exec="$DEST/reactor-quest"
Icon=reactor-quest
Terminal=false
Categories=Education;ComputerScience;
Keywords=typescript;react;programming;learn;game;
StartupNotify=false
DESKTOP
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true

echo "Reactor Quest is installed in $DEST"
echo "Start it from your app menu, or run: reactor-quest"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "(Add ~/.local/bin to your PATH to use the reactor-quest command.)" ;; esac
`,
);

script(
  'uninstall.sh',
  `#!/usr/bin/env bash
# Remove Reactor Quest's menu entry, command and installed copy. Your progress
# lives in your browser, so it stays.
DATA="\${XDG_DATA_HOME:-$HOME/.local/share}"
rm -f "$DATA/applications/reactor-quest.desktop" "$DATA/icons/hicolor/256x256/apps/reactor-quest.png" "$HOME/.local/bin/reactor-quest"
rm -rf "$DATA/reactor-quest"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
echo "Reactor Quest has been removed."
`,
);

writeFileSync(
  join(out, 'README.txt'),
  `Reactor Quest ${pkg.version} for Linux

Needs Node.js 20.19 or newer: https://nodejs.org/en/download
(Ubuntu: sudo snap install node --classic · Fedora: sudo dnf install nodejs · Arch: sudo pacman -S nodejs npm)

  ./reactor-quest     Play. The game opens in your browser.
  ./install.sh        Adds Reactor Quest to your app menu and ~/.local/bin (no sudo).
  ./uninstall.sh      Removes it again.

Logs: ~/.local/state/reactor-quest/reactor-quest.log
`,
);
console.log(`Built ${out}\nRun ./reactor-quest to play, or ./install.sh to add it to your app menu.`);
