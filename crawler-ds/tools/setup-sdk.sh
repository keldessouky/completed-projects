#!/usr/bin/env bash
#
# Builds a Nintendo DS toolchain into ./sdk from upstream sources, using the
# stock `arm-none-eabi-gcc` from your distribution instead of devkitARM.
#
#   sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi \
#                    libnewlib-arm-none-eabi build-essential autoconf automake zlib1g-dev
#   tools/setup-sdk.sh
#
# It fetches three devkitPro repositories at pinned revisions (libnds, the
# crt0/linker scripts, and ndstool), compiles libnds9/libnds7, and installs
# everything under sdk/. If you already have devkitPro installed, you do not
# need any of this — see README.md, "Building with devkitPro".
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK="${SDK_DIR:-$HERE/sdk}"
WORK="$SDK/src"

LIBNDS_REPO=https://github.com/devkitPro/libnds.git
LIBNDS_REV=v1.8.3
CRTLS_REPO=https://github.com/devkitPro/devkitarm-crtls.git
CRTLS_REV=1c0c10257c44bbb5a433453bb6bba91582825492
NDSTOOL_REPO=https://github.com/devkitPro/ndstool.git
NDSTOOL_REV=76e8b681bb225d945a48852821e03114e6c7ce1c

CC=arm-none-eabi-gcc
AR=arm-none-eabi-ar
command -v $CC >/dev/null || { echo "error: $CC not found; install gcc-arm-none-eabi" >&2; exit 1; }

mkdir -p "$SDK"/{lib,include,bin,share} "$WORK"

clone_at () { # repo rev dir
    local repo="$1" rev="$2" dir="$3"
    if [ ! -d "$dir/.git" ]; then
        git clone -q "$repo" "$dir"
    fi
    git -C "$dir" fetch -q --tags origin
    git -C "$dir" checkout -q "$rev"
}

echo "==> fetching sources"
clone_at "$LIBNDS_REPO"  "$LIBNDS_REV"  "$WORK/libnds"
clone_at "$CRTLS_REPO"   "$CRTLS_REV"   "$WORK/devkitarm-crtls"
clone_at "$NDSTOOL_REPO" "$NDSTOOL_REV" "$WORK/ndstool"

echo "==> ndstool"
if [ ! -x "$SDK/bin/ndstool" ]; then
    ( cd "$WORK/ndstool" && ./autogen.sh >/dev/null 2>&1 && ./configure --prefix="$SDK" >/dev/null && make -j"$(nproc)" >/dev/null && make install >/dev/null )
fi

echo "==> libnds"
cat > "$WORK/libnds/include/nds/libversion.h" <<'EOF'
#ifndef __LIBNDSVERSION_H__
#define __LIBNDSVERSION_H__
#define _LIBNDS_MAJOR_ 1
#define _LIBNDS_MINOR_ 8
#define _LIBNDS_PATCH_ 3
#define _LIBNDS_STRING "libnds release 1.8.3"
#endif
EOF

# Shims for the two devkitPro newlib extensions libnds expects. console.c and
# keyboard.c are the only files that need the full devoptab layer and neither is
# used by this game (it draws its own text and its own touch keyboard), so they
# are left out of the library and the header only has to carry the syscall hook.
mkdir -p "$WORK/shim/sys"
cat > "$WORK/shim/sys/iosupport.h" <<'EOF'
/* Minimal stand-in for devkitPro newlib's <sys/iosupport.h>. */
#ifndef _NDS_MINIMAL_IOSUPPORT_H_
#define _NDS_MINIMAL_IOSUPPORT_H_
#include <sys/time.h>
#include <sys/reent.h>
#define _SYSCALL_gettod_r _gettimeofday_r
#define __SYSCALL(name) _SYSCALL_##name
#endif
EOF
cat > "$WORK/shim/default_font_bin.h" <<'EOF'
#ifndef _default_font_bin_h_
#define _default_font_bin_h_
extern const unsigned char default_font_bin[];
extern const unsigned char default_font_bin_end[];
extern const unsigned int  default_font_bin_size;
#endif
EOF
cat > "$WORK/shim/newlib_glue.c" <<'EOF'
/* What devkitARM's patched newlib provides and the stock one does not: the heap
   window the crt0 hands to sbrk, the argv builder the crt0 calls, and the file
   syscalls newlib's stdio pulls in. The game touches no filesystem, so the I/O
   stubs simply fail. */
#include <errno.h>
#include <sys/stat.h>
#include <sys/times.h>
#include <nds/system.h>

char *fake_heap_start;
char *fake_heap_end;

void build_argv(struct __argv *argv) { (void)argv; }

void *_sbrk_r(struct _reent *r, ptrdiff_t incr) {
    static char *brk;
    char *old;
    (void)r;
    if (!brk) brk = fake_heap_start;
    old = brk;
    if (brk + incr > fake_heap_end) { errno = ENOMEM; return (void *)-1; }
    brk += incr;
    return old;
}

int _close_r(struct _reent *r, int fd) { (void)r; (void)fd; return -1; }
int _fstat_r(struct _reent *r, int fd, struct stat *st) { (void)r; (void)fd; st->st_mode = S_IFCHR; return 0; }
int _isatty_r(struct _reent *r, int fd) { (void)r; (void)fd; return 1; }
_off_t _lseek_r(struct _reent *r, int fd, _off_t pos, int dir) { (void)r; (void)fd; (void)pos; (void)dir; return 0; }
_ssize_t _read_r(struct _reent *r, int fd, void *p, size_t len) { (void)r; (void)fd; (void)p; (void)len; return 0; }
_ssize_t _write_r(struct _reent *r, int fd, const void *p, size_t len) { (void)r; (void)fd; (void)p; return (_ssize_t)len; }
int _open_r(struct _reent *r, const char *path, int fl, int mo) { (void)r; (void)path; (void)fl; (void)mo; return -1; }
int _kill_r(struct _reent *r, int pid, int sig) { (void)r; (void)pid; (void)sig; return -1; }
int _getpid_r(struct _reent *r) { (void)r; return 1; }
clock_t _times_r(struct _reent *r, struct tms *buf) { (void)r; (void)buf; return (clock_t)-1; }
EOF

COMMON="-g -Wall -O2 -ffunction-sections -fdata-sections -fomit-frame-pointer -DNDEBUG -D__NDS__"
A9="-mthumb -mthumb-interwork -march=armv5te -mtune=arm946e-s -DARM9"
A7="-mthumb -mthumb-interwork -mcpu=arm7tdmi -mtune=arm7tdmi -DARM7"
INC="-I$WORK/libnds/include -I$WORK/libnds/source/common -I$WORK/shim"

build_lib () { # name arch dirs...
    local name="$1"; shift; local arch="$1"; shift
    local out="$WORK/build/$name"; rm -rf "$out"; mkdir -p "$out"
    local objs=()
    for d in "$@"; do
        for f in "$d"/*.c "$d"/*.s; do
            [ -e "$f" ] || continue
            case "$(basename "$f")" in keyboard.c|console.c) continue;; esac
            local xa=""; case "$f" in *.s) xa="-x assembler-with-cpp";; esac
            local o="$out/$(echo "${f#$WORK/libnds/source/}" | tr '/' '_').o"
            $CC $COMMON $arch $INC $xa -c "$f" -o "$o" 2>/dev/null
            objs+=("$o")
        done
    done
    $CC $COMMON $arch $INC -c "$WORK/shim/newlib_glue.c" -o "$out/newlib_glue.o"
    objs+=("$out/newlib_glue.o")
    if [ "$name" = nds9 ]; then
        python3 "$HERE/tools/bin2s.py" "$WORK/libnds/source/arm9/default_font.bin" "$out/default_font.s"
        $CC $COMMON $arch -c "$out/default_font.s" -o "$out/default_font.o"
        objs+=("$out/default_font.o")
    fi
    rm -f "$SDK/lib/lib$name.a"
    $AR rcs "$SDK/lib/lib$name.a" "${objs[@]}"
    echo "    lib$name.a ($(echo "${objs[@]}" | wc -w) objects)"
}

build_lib nds9 "$A9" "$WORK/libnds/source/arm9" "$WORK/libnds/source/arm9/dldi" \
                     "$WORK/libnds/source/arm9/system" "$WORK/libnds/source/common"
build_lib nds7 "$A7" "$WORK/libnds/source/arm7" "$WORK/libnds/source/common"

echo "==> crt0 and linker scripts"
cd "$WORK/devkitarm-crtls"
$CC -x assembler-with-cpp -mthumb-interwork -c ds_arm9_crt0.s -o "$SDK/lib/ds_arm9_crt0.o"
$CC -x assembler-with-cpp -mthumb-interwork -c ds_arm7_crt0.s -o "$SDK/lib/ds_arm7_crt0.o"
cp ds_arm9.ld ds_arm7.ld "$SDK/lib/"

# The ARM9 binary is linked at 0x02004000 rather than devkitARM's historical
# 0x02000000: the low 16 KiB of main RAM is where a DS card's secure area lands,
# and emulators that boot a homebrew ROM directly will not start an ARM9 image
# placed there. Modern devkitPro (calico) makes the same move.
sed 's/ewram\t: ORIGIN = 0x02000000, LENGTH = 4M - 512k/ewram\t: ORIGIN = 0x02004000, LENGTH = 4M - 512k - 16K/' \
    ds_arm9.mem > "$SDK/lib/ds_arm9.mem"
grep -q '0x02004000' "$SDK/lib/ds_arm9.mem" || { echo "error: ds_arm9.mem patch missed" >&2; exit 1; }

# devkitARM's specs pull in <sync-none.specs>, which stock arm-none-eabi gcc does
# not ship; everything else about them is reproduced here.
cat > "$SDK/lib/ds_arm9.specs" <<'EOF'
*link:
+ -T ds_arm9.mem%s -T ds_arm9.ld%s --gc-sections --no-warn-rwx-segments

*startfile:
ds_arm9_crt0%O%s crti%O%s crtbegin%O%s
EOF
cat > "$SDK/lib/ds_arm7.specs" <<'EOF'
*link:
+ -T ds_arm7.ld%s --gc-sections --no-warn-rwx-segments

*startfile:
ds_arm7_crt0%O%s crti%O%s crtbegin%O%s
EOF

rm -rf "$SDK/include"/*
cp -r "$WORK/libnds/include/"* "$SDK/include/"
cp "$WORK/shim/default_font_bin.h" "$SDK/include/"

echo "==> done: $SDK"
