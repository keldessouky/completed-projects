#!/usr/bin/env bash
# Which asset sources and toolchain hosts can this machine reach right now?
#
# Run this before deciding that art, audio or a toolchain must be generated or
# rebuilt from source because "the site is unreachable". Reachability depends
# on the environment's network policy and on the sites themselves, and both
# change, so check instead of trusting a note written in an earlier session.
#
# Usage: tools/check-asset-hosts.sh
# Reads about 1 KB from each URL (a whole page when a site ignores the range,
# or an error page). Exits 0 whatever it finds.

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

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

# Prints "<site status> <proxy CONNECT status>" for a URL and leaves the body in $BODY.
fetch () {
  curl -s -m 15 -L -r 0-1023 -o "$BODY" -w '%{http_code} %{http_connect}' "$1" 2>/dev/null
}

devkitpro_blocked=0
printf '%-26s %-22s %-6s %s\n' SOURCE LICENCE HTTP RESULT
for check in "${CHECKS[@]}"; do
  IFS='|' read -r name licence url <<<"$check"
  read -r code connect <<<"$(fetch "$url")"
  if [ "$connect" = 403 ] || [ "$connect" = 407 ]; then
    # The proxy refused to open the connection: the environment's network policy.
    code=$connect; result="blocked by this environment's network policy (allow the domain in its settings)"
  else
    case "$code" in
      2??)     result="reachable" ;;
      403)     if grep -qiE 'you have been blocked|cf-error-details' "$BODY"; then
                 result="blocked by the site's own firewall (Cloudflare); network settings won't help"
               else
                 result="refused by the site"
               fi ;;
      429)     result="rate-limited by the site; try again in a few minutes" ;;
      5??)     result="the site is failing; try again later" ;;
      000)     result="no connection" ;;
      *)       result="unexpected; open $url to see why" ;;
    esac
  fi
  [ "$name" = devkitPro ] && [ "${code:0:1}" != 2 ] && devkitpro_blocked=1
  printf '%-26s %-22s %-6s %s\n' "$name" "$licence" "$code" "$result"
done

# devkitPro's official toolchain also ships as a Docker image on Docker Hub,
# which is outside devkitPro's firewall. Check that the image can be pulled.
token=$(curl -s -m 15 "https://auth.docker.io/token?service=registry.docker.io&scope=repository:devkitpro/devkitarm:pull" \
          | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
image=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" \
          -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' \
          https://registry-1.docker.io/v2/devkitpro/devkitarm/manifests/latest)
if [ "${image:0:1}" = 2 ]; then image_result="reachable"; else image_result="not reachable"; fi
printf '%-26s %-22s %-6s %s\n' "devkitPro Docker image" "toolchain" "$image" "$image_result"

echo
echo "Reachable is not the same as usable: read each pack's own licence file before"
echo "shipping it, and record it in that project's LICENSES.md."
if [ "$devkitpro_blocked" = 1 ] && [ "${image:0:1}" = 2 ]; then
  echo "devkitPro's own sites are blocked: if you need the official toolchain, use the"
  echo "devkitpro/devkitarm Docker image at a pinned date tag (see AGENTS.md)."
fi
