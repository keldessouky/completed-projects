#!/usr/bin/env bash
# Pictures for the art review: the `gallery` bot posed in every zone (each act with its own class), on every screen
# and in every pinnacle, rendered off-screen (needs a GL context: Xvfb on Linux) into build/gal_<part>/.
#   tools/review/capture.sh            all seven parts, four at a time
#   python3 tools/review/build.py      then build/review/index.html and its pictures
set -euo pipefail
cd "$(dirname "$0")/../.."
QHOST=${QHOST:-$PWD/build/linux/qhost}
PACK=$PWD/build/Qahira.qpk
PARTS="1:warrior 2:ranger 3:mercenary 4:shadow 5:templar 6:wanderer end:sorcerer"
run() {
  local part=${1%%:*} cls=${1##*:} d=build/gal_${1%%:*}
  rm -rf "$d"; mkdir -p "$d/build"; ln -s "$PACK" "$d/build/Qahira.qpk"
  (cd "$d" && QAHIRA_DRAW_EVERY=130 QAHIRA_GALLERY=$part QAHIRA_CLASS=$cls "$QHOST" build/Qahira.qpk --hidden --bot gallery --shot-every 130 2>&1 |
     grep -E "^gallery|TEST" > names.txt)
  echo "$part ($cls): $(ls "$d"/build/seq_*.png | wc -l) pictures, $(grep TEST "$d/names.txt")"
}
export -f run; export QHOST PACK
printf '%s\n' $PARTS | xargs -P 4 -I{} bash -c 'run {}'
