#!/usr/bin/env bash
# Regenerates every asset, packs the ROM, builds the Mac host and the RP6 core, and runs the checks.
#   tools/build_all.sh            full build + tests
#   tools/build_all.sh --no-art   skip the Blender step (reuse assets/generated)
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
NDK=${ANDROID_NDK:-/opt/homebrew/share/android-ndk}

if [[ "${1:-}" != "--no-art" ]]; then
  echo "== art (Blender)"
  "$BLENDER" -b --factory-startup -P tools/art/build.py -- --preview 2>&1 | grep -E "EXPORT|PREVIEW|BUILD|Error|Traceback" || true
fi
echo "== pack"
python3 tools/pack.py
echo "== shaders (GLSL ES 3.00)"
python3 tools/check_shaders.py
echo "== mac host + core"
cmake -S . -B build/mac -G Ninja >/dev/null && cmake --build build/mac
echo "== android core (arm64-v8a)"
cmake -S . -B build/android -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-29 >/dev/null
cmake --build build/android
"$NDK"/toolchains/llvm/prebuilt/*/bin/llvm-strip -o build/qahira_libretro_android.so build/android/qahira_libretro_android.so
echo "== bot tests"
for bot in walk; do ./build/mac/qhost build/Qahira.qpk --headless --bot "$bot"; done
echo "== screenshot"
./build/mac/qhost build/Qahira.qpk --hidden --frames 90 --shot build/screenshot.png
echo "done: build/Qahira.qpk + build/qahira_libretro_android.so"
