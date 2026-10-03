#!/bin/bash
# Double-click this file in Finder to play Reactor.
# It installs dependencies on first run, builds the game when needed,
# and opens it in your default browser. Close this window to stop it.
cd "$(dirname "$0")" || exit 1

# Finder starts scripts with a minimal PATH; add the usual Node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Reactor needs Node.js (version 20.19 or newer)."
  echo "Install it from https://nodejs.org  — or with Homebrew:  brew install node"
  open "https://nodejs.org/en/download" 2>/dev/null
  read -r -p "Press Return to close."
  exit 1
fi

exec node tools/launch.mjs "$@"
