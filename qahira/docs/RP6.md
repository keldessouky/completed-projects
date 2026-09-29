# Running QAHIRA on the Retroid Pocket 6

> **Just want to play?** Follow [PLAY.md](PLAY.md). It starts on the RP6 and uses the prebuilt files from the
> [`qahira-latest` release](https://github.com/keldessouky/completed-projects/releases/tag/qahira-latest), so you
> don't need a toolchain. This page is the developer view.

The game is two files:

| File | Where it goes |
|---|---|
| `Qahira.qpk` | Your roms folder, e.g. `ROMs/Qahira/Qahira.qpk` |
| `qahira_libretro_android.so` | Installed once into RetroArch as a core |

Both come out of `tools/build_all.sh` in `build/`. CI also builds them on every push to `qahira` (the *RP6 core and
pack* job in `.github/workflows/qahira.yml`) and publishes them on the `qahira-latest` prerelease.

## One-time setup

1. **Install RetroArch from retroarch.com** (the "aarch64" APK). The Play Store build restricts which cores can
   be installed.
2. Copy `qahira_libretro_android.so` to the RP6, for example into `Download/`.
3. In RetroArch go to **Main Menu → Load Core → Install or Restore a Core** and pick the `.so`. It then appears
   as "Qahira" in the core list.
4. **Settings → Drivers → Video** must be `gl`. This is the RetroArch default on Android, and the core needs a
   GLES 3.2 context. The Vulkan driver can't host a GL core.
5. Optional: in the RP6's Android settings, map the rear buttons to the stick clicks: **M1 → L3** (life flask) and
   **M2 → R3**. R3 does nothing in the field yet. So far it's only
   used in the Book of Fixed Stars, for build codes.

## Launching

- **From RetroArch:** Load Core → Qahira, then Load Content → `ROMs/Qahira/Qahira.qpk`.
- **From a launcher (Daijisho, free):** add a custom platform for the `qpk` extension. Set its player to RetroArch
  with the Qahira core.
- **Suspend anywhere:** RetroArch save states capture the whole simulation. Turning on *Auto Save State* and
  *Auto Load State* resumes mid-fight after sleep.
- **Your characters** are kept in `qahira_1.character` … `qahira_4.character` (one per title-screen slot) in
  RetroArch's save directory (by default `RetroArch/saves/`). An old `qahira.character` moves into slot 1 if that
  slot is empty. A character is written when you get home, close the menu, level up or quit. Back them up by
  copying those files.

## Development over USB

With USB debugging enabled on the RP6:

```bash
adb push build/Qahira.qpk /sdcard/ROMs/Qahira/Qahira.qpk
adb push build/qahira_libretro_android.so /sdcard/Download/
adb logcat -s RetroArch   # core logs are prefixed with [qahira]
```

## Device checklist (Slice 0 exit)

These can only be checked on the device:

| Check | Status |
|---|---|
| Core installs and launches the pack through RetroArch and a launcher | not yet run |
| GLES 3.2 context granted; `[qahira] scene target 1440x810` in the log | not yet run |
| Frame pacing at 60 on the 120 Hz panel | not yet run |
| All RetroPad inputs, analog L2/R2, touch, rumble | not yet run |
| Save state round trip mid-run | not yet run (passes in the headless bot on the Mac) |
| 30-minute thermal soak, battery drain logged | not yet run |
