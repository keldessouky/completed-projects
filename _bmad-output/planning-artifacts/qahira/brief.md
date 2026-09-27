---
title: "QAHIRA — Game Brief"
status: draft v2
created: 2026-09-27
updated: 2026-09-27
companions: [gdd.md, architecture.md, slices.md]
decisions:
  engine: custom C++ engine shipped as a libretro core (architecture.md §1)
  art: all generated in-house with free, open tools (architecture.md §9)
  setting: modern-day Cairo, North Africa and the Arab world
  delivery: one content file in the RP6 roms folder, launched through RetroArch
  process: vertical end-to-end slices only (slices.md)
---

# QAHIRA — Game Brief

*Working title.* **al-Qāhira** (القاهرة) is Cairo's name. The city was named
for **al-Najm al-Qāhir**, the planet Mars, which was rising the night it was
founded. The game is an offline, single-player action RPG in the tradition of
*Path of Exile* 1 and 2. It is built for one device, the **Retroid Pocket 6
(8 GB)**, and it is meant to be that device's launch title: the game that shows
off what the hardware can do and runs well on it.

> **2 August 2027.** The Moon's shadow crosses the Arab world: Tangier, the
> Maghreb, Libya, the Nile at Luxor, the Red Sea, Jeddah, Yemen. Totality over
> Luxor lasts six minutes and twenty-three seconds, the longest on land for a
> century.
>
> Then it doesn't end.
>
> A band of permanent night now lies across North Africa and Arabia along the
> path of the eclipse. Cairo sits just outside it, in an endless violet dusk,
> with a black, burning ring hanging over the southern horizon. The old stories
> were right about eclipses: something is swallowing the sun. In the dark, the
> jinn walk openly.
>
> Some people looked straight at the black sun during totality, and it looked
> back. Now they can see what everyone else can't. You're one of the
> **Eclipse-Eyed**.

The eclipse is real: 2 August 2027, with 6 min 23 s of totality at Luxor. Its
path of totality maps onto the campaign exactly.

---

## 1. Pillars

1. **The build is the game.** Depth on the level of PoE: a large shared passive
   tree, ascendancies, skill and support composition, crafting, and uniques
   that break rules.
2. **Weight in the hands.** PoE2-style deliberate combat with a dodge roll,
   readable telegraphs and setup-and-payoff combos. Endgame power earns PoE1
   speed.
3. **A launch title for one device.** Every millisecond of the budget is spent
   on the RP6's actual hardware: its Adreno 740, its 120 Hz AMOLED, its analog
   triggers, gyro and rumble. It looks like a showcase and still runs cool for
   three hours.
4. **The art of the Arab world, at night.** Islamic geometric pattern, Arabic
   calligraphy, mashrabiya light, khayamiya colour, and the hand-painted look of
   Egyptian cinema posters and shop signs. All of it is lit by neon, lanterns and
   a black sun, and the AMOLED shows it in true black.
5. **Solo and complete.** No trade, no servers, no network. Loot and crafting
   are tuned so a self-found player can reach every build.

## 2. Designed around the RP6

| Retroid Pocket 6 | Design response |
|---|---|
| Snapdragon 8 Gen 2 / Adreno 740, active cooling | A custom renderer: clustered lighting with **~64 on-screen lights** (a neon city), HDR + bloom, GPU-skinned hordes. Budget: 150 enemies + 400 projectiles at a locked 60 fps. |
| 8 GB LPDDR5X shared with Android and RetroArch | 2 GB process budget, textures ≤ 800 MB, ASTC-compressed |
| 5.5" 1920×1080 AMOLED, 120 Hz | True-black art direction, native-resolution UI, minimum text 36 px, a HUD that avoids burn-in, **40 / 60 / 120 fps** modes |
| Hall sticks, **analog L2/R2**, gyro, rumble, rear M1/M2 | Analog-trigger charged skills, optional gyro fine-aim, rumble on every impact, flasks on the rear buttons |
| 6000 mAh | ≥ 3 h at the default 60 fps mode, **measured on the device in every slice** |
| Android 13 + RetroArch | The game is a **libretro core** plus a **content file** in the roms folder. RetroArch save states provide suspend-anywhere for free. |

## 3. How it gets onto the device

```
RP6 internal storage / SD card
├─ ROMs/Qahira/Qahira.qpk          ← the "ROM": every asset, level tile, data table
└─ (one time) qahira_libretro_android.so
       installed via RetroArch → Load Core → Install or Restore a Core
```

- **Emulator:** RetroArch, the free build from retroarch.com. The Play Store
  build limits which cores you can install.
- **Launchers:** a RetroArch playlist (`Qahira.lpl`, shipped with the game) or
  **Daijisho** (free) with a custom platform whose player is RetroArch + the
  Qahira core. The stock Retroid launcher works if it accepts custom
  RetroArch cores; Slice 0 checks that on the device.
- Updating the game means copying a new `.qpk` over the old one, plus the `.so`
  when the engine changes. Saves live in RetroArch's save folder.

## 4. What we take from PoE, and what's new

| From PoE1 / PoE2 | In Qahira |
|---|---|
| Shared passive tree, class starts, keystones, masteries, jewels | **The Book of Fixed Stars**, a sky of real Arabic star names from al-Sufi's 10th-century atlas, with **28 keystones, one per lunar mansion** |
| Ascendancies earned through trials | Cairo's three surviving Fatimid gates (Zuweila, al-Futuh, al-Nasr) plus a fourth. **Every gate takes a toll**: you enter each trial with one gear slot sealed. |
| PoE2 skill gems with support sockets; Spirit | **Talismans** carved with **Wafq** (magic-square) supports; the **Nafas** (breath) reservation pool |
| Currency crafting, Omens, Essences, divination cards | Blue beads, broken tea glasses, attar, khamsa hands. **Coffee-cup Omens** from fortune-reading. **Spice blends** give guaranteed mods. **Poster scraps**: collect the pieces of a hand-painted cinema poster to get a specific unique. |
| Atlas endgame | **The Map of al-Idrisi** (1154, drawn with south at the top), with four myth-themed mechanics |
| Built-in filter; Path of Building-style breakdowns | Both built in and usable on a controller |
| — | Suspend anywhere (RetroArch save states), ±DPS/EHP on every drop, QR build codes |

We borrow mechanics only. All names, art, text and music are original or drawn
from public-domain history, astronomy and folklore.

## 5. Cultural care (for you to veto or extend)

The setting is real and loved, so these are rules:
- **No Qur'anic text or divine names** anywhere, including decoration,
  talismans, items and enemies. Calligraphy uses poetry, proverbs, place names
  and invented shop signs.
- **Mosques, churches and shrines are never combat spaces.** They appear on the
  skyline and as places of refuge at most.
- **No prophets, religious figures or real historical people** as enemies or
  loot. Jinn and monsters come from **folklore** (ghūl, ifrīt, mārid, siʿlāh,
  nasnās, El Naddāha, Umm al-Ṣubyān, ʿAisha Qandisha) and **ancient Egyptian
  myth** (Apep).
- **No real modern conflicts.** Places are shown as themselves: lived-in,
  beautiful, funny, specific.
- Egyptian Arabic flavour in the barks. You are the authenticity check.

## 6. Scope and slices

Work proceeds in **vertical end-to-end slices** (slices.md). Every slice runs on
the RP6 from the roms folder within the performance budget, has a bot playing
it in CI, and is playable by you. Nothing is built horizontally ("all the
renderer, then all the items") unless a slice needs it.

**v1.0 content target:** 6 classes + 1 · 12 ascendancies (18 planned) · ~850
tree nodes · ~60 Talismans, ~80 Wafq, ~20 Nafas skills · ~250 bases, ~400
affixes, ~150 uniques · 6 acts along the eclipse path (~36 zones) · al-Idrisi
endgame, 16 tiers, 4 mechanics, 3 pinnacles.

## 7. Top risks

| Risk | Mitigation |
|---|---|
| A custom engine is a big build | Keep it thin and purpose-built: one camera, one platform, one GPU. Build slice by slice. libretro provides the window, input, audio output, saves and save states. |
| Generating all the art ourselves | Choose styles that suit procedural generation: geometric pattern, architecture built from kits, stylised characters on one shared rig. Generators are scripts, so the art can always be regenerated. |
| libretro constraints: a 16-button RetroPad, gyro support on Android | Slice 0 probes all of it on the device. The control scheme fits the RetroPad from the start (gdd.md §2). |
| Balancing a PoE-scale system solo | Data-driven stat engine, a headless build simulator, and outlier reports in CI |
| Cultural missteps | §5 as hard rules, plus your review in every slice demo |
