#!/usr/bin/env bash
# Play Reactor on Linux: run ./reactor-quest.sh (or, in your file manager,
# right-click it → "Run as a Program"). It installs dependencies on first run,
# builds the game when needed, and opens it in your default browser.
# Press Ctrl+C (or close the terminal) to stop it.
cd "$(dirname "$0")" || exit 1

# Desktop launchers start scripts with a minimal PATH; add the usual Node locations.
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/snap/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Reactor needs Node.js (version 20.19 or newer)."
  echo "Get it from https://nodejs.org/en/download, or for example:"
  echo "  sudo snap install node --classic        (Ubuntu and friends)"
  echo "  sudo dnf install nodejs                 (Fedora)"
  echo "  sudo pacman -S nodejs npm               (Arch)"
  (xdg-open "https://nodejs.org/en/download" >/dev/null 2>&1 &)
  [ -t 0 ] && read -r -p "Press Return to close."
  exit 1
fi

exec node tools/launch.mjs "$@"
