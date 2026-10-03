# Playing QAHIRA on the Retroid Pocket 6

This guide starts on the handheld and needs no PC. The game is two files that a build server makes on every
update:

| File | What it is | Size |
|---|---|---|
| `qahira_libretro_android.so` | The game engine, installed into RetroArch once as a "core" | a few MB |
| `Qahira.qpk` | The game's content (models, sound, maps), which you open like a ROM | about 200 MB |

**Always use both files from the same build.** The core and the pack change together, so an old pack with a new core
(or the other way round) may not load.

> **Status: nobody has run it on the device yet.** The core builds for Android, and bots play Acts I to VI and the Fourth Trial through
> on every change, but the checks that need the real RP6 are still open: launching through RetroArch, frame
> pacing, all the buttons, rumble, save states and a long play session (see the
> [device checklist](RP6.md#device-checklist-slice-0-exit)). If something below doesn't match what you see, that's
> probably why. Please note what happened.

## 1. Download the two files (on the RP6)

1. Connect the RP6 to Wi-Fi and open the web browser (Chrome is fine).
2. Go to:

   **https://github.com/keldessouky/completed-projects/releases/tag/qahira-latest**

   This page always holds the newest build. It says which commit it was built from.
3. Under **Assets**, tap `qahira_libretro_android.so` and then `Qahira.qpk`. Both land in the `Download` folder.
   - Chrome may warn that the file "can harm your device". Choose **Download anyway**. That's only because it
     doesn't recognise the file type.
   - The pack is about 200 MB, so it takes a while on slow Wi-Fi.

The repository is public, so you don't need a GitHub account. If it's ever made private, sign in to GitHub in the
browser first. You can also download the files on another computer and copy them to the RP6's `Download` folder
over USB.

Direct links, if you'd rather type them:

- https://github.com/keldessouky/completed-projects/releases/download/qahira-latest/qahira_libretro_android.so
- https://github.com/keldessouky/completed-projects/releases/download/qahira-latest/Qahira.qpk

## 2. Install RetroArch (once)

Use the RetroArch from **retroarch.com**, not the Play Store version. The Play Store build won't install cores from a
file.

1. In the browser, open **https://www.retroarch.com/?page=platforms**, find **Android** and download the
   **aarch64 (64-bit)** APK.
2. Open the downloaded APK. If Android asks, let the browser **install unknown apps**, then install.
3. Open RetroArch once. When it asks for storage access, allow it (**All files access**), so that it can see your
   `Download` and `ROMs` folders.

If you already have RetroArch from retroarch.com, skip this part.

## 3. Install the core (once, and again for each update)

1. In RetroArch: **Main Menu → Load Core → Install or Restore a Core**.
2. Browse to `/storage/emulated/0/Download/` and pick `qahira_libretro_android.so`.
3. RetroArch copies it into its own cores folder. It then shows up under **Load Core** as "Qahira". After that, you can
   delete the `.so` from `Download` if you like.

The file name must be exactly `qahira_libretro_android.so`. If the browser saved it as something like
`qahira_libretro_android (1).so` or `qahira_libretro_android.so.bin`, rename it in the Files app first.

## 4. Put the pack in place

Move `Qahira.qpk` out of `Download` into a folder of its own. Any folder works; this guide uses:

```
/storage/emulated/0/ROMs/Qahira/Qahira.qpk
```

Use the RP6's **Files** app: long-press `Qahira.qpk` → **Move** → create `ROMs/Qahira` (the RP6 may already have a
`ROMs` folder, possibly on the SD card) → **Move here**.

### The radio

The game has a radio in place of its music, the way GTA has stations. **Radio Kafr El-Sheikh** plays Mohamed
Andeel's show one episode after another. There is nothing to set up: the game downloads the episodes by itself over
Wi-Fi, in the background, from the [Internet Archive](https://archive.org/details/radiokafrelshikh), and the radio
comes on as soon as the first one has arrived (a minute or so). Until then the game's own music plays.

A second station, **Midnight Signal AM**, is late-night sci-fi: a man in a bar who says he is the last Martian, a
saucer that whispers to one woman on a beach, a radio crew sent to meet a ship from space, a phone call from the
future. It plays 18 half-hour dramas from NBC's *Dimension X* (1950–51) and *X Minus One* (1955–58), which the game
downloads from the [Old Time Radio Researchers' items](https://archive.org/details/OTRR_X_Minus_One_Singles) on the
Internet Archive, where both series are listed as public domain.

- **Storage:** the episodes go in a `radio` folder in RetroArch's saves folder, about 560 MB for Radio Kafr
  El-Sheikh's 18 and up to about 250 MB for Midnight Signal AM's.
- **Offline:** what has arrived keeps playing without Wi-Fi. A download that was cut off picks up where it stopped
  the next time the game runs with Wi-Fi.
- **Order:** Radio Kafr El-Sheikh in the show's own airing order; Midnight Signal AM in its own running order.
- **Which first:** the first episode of every station downloads before the rest, so each station has something to
  play early.
- **Where it picks up:** each station remembers its own episode and the place in it, so you can tune away and come
  back to where you were. When an episode ends, the next one starts.
- **In the field, R3** (the right stick pressed in, or M2 if you mapped it):
  - **tap** for the next station;
  - **hold** for half a second for the next episode on this station.

  With only one station, a tap also goes to the next episode. The dial goes through a burst of static, and a card at
  the top of the screen names the station and the episode.
- **Choosing a station, or turning it off:** in **Settings → Music**, pick a station or the game's own music. The tab
  also shows how the download is going.
- **If it doesn't come on:**
  - Open **Settings**. Below the list, it says what the radio is doing: "Downloading the radio: 3/18", or
    "Radio: …" with what went wrong.
  - Check that the **Music** row names the station, not "The game's music".
  - The same messages, with times, are in `radio log.txt` in the `radio` folder, which you can open in the Files
    app.
- **Your own episodes (optional):** a `radio` folder beside the pack can hold more.
  - A folder inside it is a station of its own, named after the folder.
  - Loose files play on Radio Kafr El-Sheikh.
  - Formats: MP3, Ogg Vorbis or 16-bit WAV.

## 5. Set the video driver to `gl` (once)

The core draws with OpenGL ES 3.2 and can't run under the Vulkan driver.

1. **Main Menu → Settings → Drivers → Video** → choose **gl**.
2. **Quit RetroArch completely and open it again.** A new video driver only takes effect after a restart.

Optional, for the rear buttons: in the RP6's own Android settings (the Retroid handheld/controller settings), map
**M1 → L3**, which drinks the life flask. You can also press in the left stick.

## 6. Play

1. **Main Menu → Load Core → Qahira**.
2. **Main Menu → Load Content** → browse to `ROMs/Qahira/` → pick `Qahira.qpk`.
3. The title screen has four character slots. Pick an empty one to make a new character and choose a class.

After the first time, **Main Menu → History** (or **Load Content** again) gets you back in faster.

You can also use a frontend such as **Daijisho**: add a custom platform for the `qpk` extension, set its player to
RetroArch and its core to Qahira. See [RP6.md](RP6.md#launching).

## Controls

The game uses RetroArch's standard controller (the "RetroPad"). The face buttons below are named by **position**
(bottom, right, left, top), so they don't depend on the letters printed on the RP6's buttons. The on-screen prompts
use the same positions.

**Title screen**

| Button | Does |
|---|---|
| D-pad up / down | Choose a character slot |
| Bottom button (or Start) | Play the character in that slot, or make a new one in an empty slot |
| Top button, twice | Delete the character in that slot |
| D-pad, bottom button, right button | Choose a class, begin, go back (when making a character) |

**In the world**

| Button | Does |
|---|---|
| Left stick | Move |
| Right stick | Aim skills (otherwise they go where you're moving) |
| Bottom button | Skill 1. When no enemy is close, it also talks, uses, travels and picks things up |
| Left, top buttons, R1, R2 | Skills 2, 3, 4 and 5 |
| Hold L2 | Switch to the second skill bar while held |
| Right button | Dodge |
| L3 (press left stick, or M1 if mapped) | Life flask |
| D-pad left | Pick up |
| D-pad up | Cast a portal home (in a zone) |
| D-pad down | Show or hide the map (in a zone) |
| D-pad right | Next loot filter preset |
| R3 (press right stick, or M2 if mapped) | The radio: tap for the next station, hold for the next episode |
| Start | Menu: inventory, Talismans, character, loot filter |
| Hold Select | The Book of Fixed Stars, the passive tree |
| Tap Select | Place the next star you planned in the Book |
| Bottom button, after dying | Get up again |

**Performance** (RetroArch's **Quick Menu → Core Options**): *Balanced* (60 fps, the default) or *Battery* (40 fps,
which divides the RP6's 120 Hz screen evenly, with the 3D drawn at a lower resolution). The game itself runs at the
same speed in both. Neither has been timed on the device yet.

**Where to go:** a gold arrow at your feet points the way to the next objective, round walls, and the top right of
the screen names it and how far it is.

**The life flask** heals half your life to begin with. Amm Sayed upgrades it (the **top button** at his wares) through
seven tiers, each healing more and every second one holding a charge more, for dinars once you're at the level it
asks. High-level belts, amulets and rings, and the affix *of the Spring*, regenerate life every second.

**Settings** (the menu's last tab):
- the language (English, or Arabic laid out right to left);
- the text size;
- loot colours safe for colour-blind players;
- the screen shake;
- whether L2 holds or toggles the second skill bar;
- the music: a station on the radio (Radio Kafr El-Sheikh first) or the game's own. Below the list, the tab says
  how many episodes the station has.

**In the menu:** L1 / R1 switch tabs, the bottom button equips or uses, the top button drops (on the Character tab it
shows "Why?" for any number), and the right button or Start closes it. The world is paused while any menu is open.
Every screen shows its own button prompts at the bottom.

**The Game tab** (the menu's last):
- **Resume** closes the menu.
- **Update** gets a newer build (see [Updating](#updating-to-a-newer-build)).
- **Quit to the title** saves your character and goes back to the four slots.
- **Exit the game** saves and closes the game.

Quitting and exiting each ask for a second press. The tab also shows which build you're on.

**RetroArch's own menu** (for save states) usually opens with the Android **Back** button. If it doesn't,
set a combination under **Settings → Input → Hotkeys → Menu Toggle Controller Combo**. The game uses every button,
so any combination also reaches the game. Pick one you won't press during play.

## Saving

- **Your character saves itself** when you get home, close the menu, level up or quit. There's no save button.
  - The files are `qahira_1.character` to `qahira_4.character`, one for each title-screen slot.
  - They're in RetroArch's save folder (usually `RetroArch/saves/`, possibly in a `Qahira` subfolder).
  - If **Settings → Directory → Save Files** is set to *Default*, the files are next to `Qahira.qpk` instead.
  - To back up a character, copy its file somewhere else.
- **Save states** work too. The RP6 can suspend mid-fight: turn on **Settings → Saving → Auto Save State** and
  **Auto Load State**, and the game carries on where you left it. Save-state round trips pass in the automated
  tests, but haven't been tried on the device yet.

## Updating to a newer build

**In the game** (from the build that has the Game tab on):
1. With Wi-Fi on, press **Start** and go to the **Game** tab (R1 until you reach it). When a new build is out, the
   game says so in the field ("A new build is ready"), and the Update row offers it with its size.
2. Press the bottom button on **Download the update**.
   - The core (a few MB) and the pack (about 200 MB) download in the background, so you can close the menu and play
     on.
   - If the download is cut off, the next try goes on from where it stopped.
3. Both files are checked against the release's SHA-256 before anything is replaced. A damaged download replaces
   nothing.
4. When the row says **Installed**, choose **Exit the game** and start the game again. If the Game tab still shows
   the old build number, close RetroArch completely (swipe it away) and open it again.

The update needs room for a second copy of the pack (about 200 MB). It also needs RetroArch to be allowed to write
where the core and the pack are, which it normally is. If it can't, the Update row says why, and the steps below
still work.

**By hand:**

1. Open the [release page](https://github.com/keldessouky/completed-projects/releases/tag/qahira-latest) again. It
   says which commit it was built from, so you can tell whether it's new.
2. Download **both** files again.
3. **Load Core → Install or Restore a Core** with the new `qahira_libretro_android.so`. It replaces the old one.
4. Replace `ROMs/Qahira/Qahira.qpk` with the new one. Delete the old file first, or Android may name the new copy
   `Qahira (1).qpk`.

Your characters live in the save folder, not in either file, so updating leaves them in place. Still, copy the
`.character` files somewhere safe before updating, just in case.

## Troubleshooting

| What you see | Try |
|---|---|
| Black screen, or RetroArch closes as soon as the game loads | Set **Settings → Drivers → Video** to **gl**, then quit and reopen RetroArch. The core can't run under Vulkan. |
| "Install or Restore a Core" is missing | You have the Play Store RetroArch. Install the one from retroarch.com (step 2). |
| The `.so` doesn't show up in the file picker, or Qahira isn't in **Load Core** | Check that the file is named exactly `qahira_libretro_android.so` (step 3), then install it again. The core is built for 64-bit Android (arm64-v8a), which is what the RP6 runs; the 32-bit RetroArch can't load it. |
| **Load Content** doesn't show `Qahira.qpk` | In order: (1) in the Files app, check `Download` holds `Qahira.qpk` at about 200 MB. A browser may have saved it as `Qahira.bin` or `Qahira.qpk.bin` (rename it back; a core from after 29 September also takes `.bin`), and a much smaller file is a cut-off download. (2) In Load Content, browse from `/storage/emulated/0/` into `Download`. (3) If Download looks empty, give RetroArch file access: Android Settings → Apps → RetroArch → Permissions → Files and media → **Allow management of all files**, then quit and reopen RetroArch. (4) Still nothing: **Settings → File Browser → Filter by Supported Extensions → Off**, pick the file, and run it with the Qahira core. |
| "Failed to load content" | The pack and core are probably from different builds, or the download was cut short. Download both again. The pack should be about 200 MB. |
| Some buttons do nothing, or the wrong button does it | Check the RP6's controller mode, and that **Settings → Input → Port 1 Controls** hasn't been remapped. Buttons follow their position (see Controls). |
| No rumble | Rumble hasn't been tested on the device yet. |

For logs, connect over USB with USB debugging on and run `adb logcat -s RetroArch`. The game's lines start with
`[qahira]`. See [RP6.md](RP6.md#development-over-usb).

## Playing on a PC instead

You can play on a computer with `qhost`, the small SDL2 window used for development. It runs the same game code, and
it can open the same `Qahira.qpk` from the release page, so you don't need Blender.

Use the release's `Qahira.qpk` with a `qhost` built from the **same commit**. The release page names the commit.

Linux (Ubuntu/Debian) or macOS:

```bash
# Linux:  sudo apt install git cmake ninja-build g++ libsdl2-dev libgl-dev
# macOS:  brew install cmake ninja sdl2
git clone -b qahira https://github.com/keldessouky/completed-projects.git
cd completed-projects/qahira
git checkout <commit from the release page>        # optional, but keeps the host and pack in step
cmake -S . -B build/pc -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/pc --target qhost
curl -L -o build/Qahira.qpk \
  https://github.com/keldessouky/completed-projects/releases/download/qahira-latest/Qahira.qpk
./build/pc/qhost build/Qahira.qpk
```

- Run it from the `qahira/` folder. Characters are saved in `build/saves/` there.
- A gamepad works through SDL. On the keyboard, WASD moves, the mouse aims, and J/K/U/I are the bottom, right, left
  and top buttons. The full list is under [Dev host controls](../README.md#dev-host-controls).
- On the Mac, `qhost` is the everyday development window. On Linux, CI only runs it headless, so a Linux window hasn't
  been checked by anyone yet. It needs an OpenGL 4.1 driver.

To build everything yourself, including the art and the pack, see [the README](../README.md#build) and
`tools/build_all.sh`.

## Where these files come from

The workflow `.github/workflows/qahira.yml` has a job, *RP6 core and pack*, that runs on every push to the `qahira`
branch. It builds the art, the pack and the Android core. It then moves the `qahira-latest` tag to that commit and
replaces the two files on the release. The same files are also attached to each workflow run as the `qahira-rp6`
artifact, but downloading artifacts needs a GitHub login and they come zipped, so use the release page on the RP6.

This job doesn't wait for the long bot playthroughs in the `build` job. To be sure a build passed them, check that
the *Art, pack, tests…* job for the same commit is green on the repository's **Actions** tab.
