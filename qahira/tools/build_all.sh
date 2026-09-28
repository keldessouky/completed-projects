#!/usr/bin/env bash
# Regenerates every asset, packs the ROM, builds the Mac host and the RP6 core, and runs the checks.
#   tools/build_all.sh            full build + tests
#   tools/build_all.sh --no-art   skip the Blender step (reuse assets/generated)
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
NDK=${ANDROID_NDK:-/opt/homebrew/share/android-ndk}
# On Linux (CI) the art runs under the `bpy` module (pip install bpy==5.0.1) instead of the Blender app:
#   BLENDER_PY=/opt/bpyenv/bin/python tools/build_all.sh
BLENDER_PY=${BLENDER_PY:-}

if [[ "${1:-}" != "--no-art" ]]; then
  echo "== art (Blender)"
  if [[ -n "$BLENDER_PY" ]]; then
    "$BLENDER_PY" tools/art/build.py -- --preview 2>&1 | grep -E "EXPORT|PREVIEW|BUILD|Error|Traceback" || true
  else
    "$BLENDER" -b --factory-startup -P tools/art/build.py -- --preview 2>&1 | grep -E "EXPORT|PREVIEW|BUILD|Error|Traceback" || true
  fi
fi
echo "== passive tree (layout + validator)"
python3 tools/tree/build_tree.py
echo "== pack"
python3 tools/pack.py
echo "== shaders (GLSL ES 3.00)"
python3 tools/check_shaders.py
echo "== mac host + core"
cmake -S . -B build/mac -G Ninja >/dev/null && cmake --build build/mac
if [[ -d "$NDK" ]]; then
echo "== android core (arm64-v8a)"
cmake -S . -B build/android -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-29 >/dev/null
cmake --build build/android
"$NDK"/toolchains/llvm/prebuilt/*/bin/llvm-strip -o build/qahira_libretro_android.so build/android/qahira_libretro_android.so
else
echo "== android core: skipped (no NDK at $NDK)"
fi
echo "== unit tests"
./build/mac/qtests
echo "== build simulator"
./build/mac/qbuildsim
echo "== chart simulation"
./build/mac/qchartsim
echo "== bot tests"
for bot in walk fight zone sorcerer sky title act1 charts act2 rifts act3 digs; do ./build/mac/qhost build/Qahira.qpk --headless --bot "$bot"; done
for cls in ranger mercenary; do QAHIRA_CLASS=$cls ./build/mac/qhost build/Qahira.qpk --headless --bot zone; done
echo "== screenshot"
./build/mac/qhost build/Qahira.qpk --hidden --frames 90 --shot build/screenshot.png
echo "done: build/Qahira.qpk + build/qahira_libretro_android.so"
