#!/usr/bin/env bash
# Which asset sources and toolchain hosts can this machine reach right now?
#
# Run this before deciding that art, audio or a toolchain must be generated or
# rebuilt from source because "the site is unreachable". Reachability depends
# on the environment's network policy and on the sites themselves, and both
# change, so check instead of trusting a note written in an earlier session.
#
# Usage: tools/check-asset-hosts.sh
# Reads at most 1 KB from each URL. Exits 0 whatever it finds.

set -u

# name | licence most of it carries | a URL that serves real content
CHECKS=(
  "Kenney|CC0|https://kenney.nl/assets"
  "itch.io|per pack: check each|https://itch.io/game-assets/free/tag-cc0"
  "Quaternius (Google Drive)|CC0|https://drive.google.com/embeddedfolderview?id=18m4KpzpEzhC9wl7jzr6dUc0N8Jozr79C"
  "Poly Haven|CC0|https://api.polyhaven.com/assets?t=textures"
  "ambientCG|CC0|https://ambientcg.com/api/v2/full_json?limit=1"
  "GitHub raw (e.g. LPC)|per repo: check each|https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/README.md"
  "Internet Archive|per item: check each|https://archive.org/advancedsearch.php?q=cc0&rows=1&output=json"
  "OpenGameArt|per asset: check each|https://opengameart.org/"
  "Freesound|per sound: check each|https://freesound.org/"
  "devkitPro|toolchain|https://pkg.devkitpro.org/packages/"
)

printf '%-26s %-22s %-6s %s\n' SOURCE LICENCE HTTP RESULT
for check in "${CHECKS[@]}"; do
  IFS='|' read -r name licence url <<<"$check"
  code=$(curl -s -o /dev/null -m 15 -L -r 0-1023 -w '%{http_code}' "$url" 2>/dev/null)
  case "$code" in
    2??)     result="reachable" ;;
    403|407) result="blocked (network policy or the site itself)" ;;
    5??)     result="the site is failing; try again later" ;;
    000)     result="no connection" ;;
    *)       result="unexpected; open $url to see why" ;;
  esac
  printf '%-26s %-22s %-6s %s\n' "$name" "$licence" "$code" "$result"
done

echo
echo "Reachable is not the same as usable: read each pack's own licence file before"
echo "shipping it, and record it in that project's LICENSES.md."
