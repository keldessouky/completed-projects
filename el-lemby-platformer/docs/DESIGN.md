# اللمبي: مغامرات الحارة — وثيقة التصميم
# El-Lemby: Alley Adventures — Design Document

A native pixel platformer for web, macOS and Windows starring اللمبي,
modeled on the language of Super Mario Bros. Side-scrolling strictly
**left → right** (the movement is LTR; the UI and all text are Arabic).
The visual identity is a swappable **theme**: the active theme is
«اللي بالي بالك» (2003) — El-Lemby in prison; the original «اللمبي» (2002)
alley theme remains selectable (see Theming below).

## Pillars

1. **Mario's grammar, El-Lemby's accent** — every mechanic should be readable
   to anyone who has played a platformer, but every noun is from the film's
   world (الحارة، الفكة، البلطجية، ساندوتش الفول، نوسة).
2. **Arabic-first** — HUD, menus, numerals (٠-٩), quotes. Latin appears only in
   developer-facing docs.
3. **Everything regenerable** — art, audio, and levels come from committed
   Python generators; no opaque binaries that can't be rebuilt or tweaked.

## Mario → El-Lemby mapping

| Mario | هنا (bali theme) | Notes |
|---|---|---|
| Mario | اللمبي | maroon tracksuit, messy hair, stubble |
| Peach / flagpole | سونيا عند باب الزيارة | reach her to clear the stage (نوسة in the harah theme) |
| Goomba | بلطجي العنبر | patrols, turns at walls/ledges, stompable |
| Coin | العيش (رغيف) | +100 pts; gold coin in the harah theme |
| ? block | صندوق «؟» | wooden crate, Arabic question mark |
| Super Mushroom | ساندوتش فول | absorbs one hit («مفوّل» state) |
| Timer | الوقت | 240s countdown per stage, timeout costs a life |
| Midpoint flag | عربية الفول (checkpoint) | touch once → deaths respawn there |
| 1-1 | المرحلة ١ «العنبر» | ~7 screens, 205 tiles |
| 1-2 | المرحلة ٢ «فناء السجن» | ~7.5 screens, 230 tiles, harder |

## 2.5D presentation

Gameplay is strictly 2D; depth is a presentation stack shared by all three
frontends:

- **Extruded tiles** — the pipeline's `bevel()` pass gives every solid tile
  a light-catching top face and shadowed right/bottom edges, so runs read
  as slabs.
- **Dynamic drop shadows** — a soft ellipse on the first solid surface under
  the player, thugs, NPCs and power-ups, shrinking/fading with height (also
  a genuine landing aid).
- **Three parallax planes** — far (0.15) and near (0.30) behind the action,
  plus a new theme-built **foreground plane at 1.25** (yard railing and
  chain in bali, crates and pots in harah) sliding in front of it.

## Theming

The game's entire look is data, produced by `tools/generate_assets.py` and
selected by `THEMES` / `ACTIVE_THEME` (or the `LEMBY_THEME` env var). A theme
contributes palette overrides (El-Lemby's outfit, the bully's cap), tile
colors, the coin's colors, the two parallax backdrop builders, and the
**goal/love-interest role** (the `nousa_*` sprite names are the role; the
harah theme draws نوسة, the bali theme draws سونيا — the sequel's glamorous
sweetheart in her red dress, drawn in the stylized فتاة الأحلام comedy
register, and the reason El-Lemby keeps running). Because all three
frontends load sprites by name, regenerating assets rethemes every platform
with zero platform-code changes; only the UI strings are set per platform.
Stage layouts are theme-independent — the walkthroughs below describe both
skins.

## Movement feel (see `Core/GameConfig.swift` — single source of truth)

- Internal resolution **480×272** (30×17 tiles of 16px), nearest-neighbor
  scaling, default window 2×.
- Run: accel 900 pt/s² to max 122 pt/s; skid deceleration 1500 pt/s² when
  reversing on the ground (feel v2 — turnarounds are immediate); ground
  friction 1000 pt/s²; air control at 620 pt/s².
- Jump: impulse 452 pt/s under gravity ≈1470 pt/s² → apex ≈ 4.3 tiles.
  Variable height: releasing the key caps vy at 145 pt/s. Falls pull 1.3×
  gravity so arcs are crisp, not floaty; three level spots were re-tuned for
  the shorter carry (stage 2's pit 5 narrowed, both takeoffs/summits widened
  — the runner bots caught all three).
- **Coyote time** 90ms, **jump buffering** 120ms, stomp bounce 310 pt/s.
- Death: hop-and-fall through the world (classic), 1.6s respawn invulnerability
  with blink.

## Systems groundwork already in place

- **ASCII level format** with parser (`World/LevelParser.swift`), validation
  errors, and unit tests. Levels are data, not code.
- **Merged terrain physics**: contiguous solid tiles collapse into one static
  body per row so the player never snags on tile seams.
- **Parallax**: two generated strips (skyline with minaret + alley buildings
  with laundry/dishes), repositioned per frame at 0.15 / 0.30 of camera travel.
- **Contact-driven interactions**: coins, power-up, stomp-vs-hurt resolution,
  head-bump crate popping, goal trigger — all in `GameScene.didBegin`.
- **Scene routing**: title → game → result (clear/game-over) with shared
  `SceneRouter`; run state in `GameState` (money/score/lives/high score via
  UserDefaults).
- **Audio**: 8 generated SFX + looping music in **maqam hijaz on E**
  (E F G# A B C D) — square lead, triangle bass, noise hats @110bpm — the
  chiptune take on a shaabi street vibe.
- **Input**: raw macOS keycodes (works on Arabic keyboard layouts), Eastern
  Arabic numeral formatter, mute toggle, pause overlay.

## Stage 1 «الحارة» walkthrough

Authored in `tools/build_level1.py` (regenerates `levels/level1.txt`);
rendered to `docs/level1.png` by `tools/render_level.py`.

1. **Act 1 — تعلّم (cols 0–52):** flat opener by El-Lemby's door, first coin
   row, one thug, the classic `B ? B F B` crate line (the F crate holds the
   فول sandwich), pit 1, a brick ledge, pit 2 with a coin arc.
2. **Act 2 — الوسط (cols 53–113):** sandstone pyramid, coin rows, overhead
   bricks with a ؟ crate, raised takeoff stones over the wide pit 3, then the
   **market gauntlet**: three thugs under a crate ceiling, pit 4, breather.
3. **Act 3 — الختام (cols 114–204):** grand five-step staircase, leap over
   pit 5 from the top, step-down, last thug pair, crate hop, final coins —
   and نوسة waving in front of her brick house. Hearts, «مبروك يا لمبي!».

Budget: 40 loose coins + 4 ؟/F crates, 9 thugs, 5 pits, 2 power-ups.

## Stage 2 «شارع السوق» walkthrough

Authored in `tools/build_level2.py`; rendered to `docs/level2.png`. Lives and
score carry over from stage 1; the stage is meaner (7 pits, 12 thugs) and
introduces the **checkpoint**:

1. **Act 1 — الأكشاك (cols 0–53):** crate-stall steps, pit 1, a brick canopy
   over a thug pair (with ؟ and فول crates), sandstone stairs with an
   optional high coin ledge, and a wide pit 2 crossed from takeoff stones.
2. **Act 2 — الدور التاني (cols 54–112):** a double-decker stretch (coin
   route up top, thug traffic below), pit 3, the alley of 2-high crate walls
   with a caged thug patrol, pit 4, and an optional stone-outpost climb to a
   floating فول crate.
3. **Act 3 — التفتيش والختام (cols 113–229):** the **عربية الفول checkpoint**,
   a takeoff over pit 5, a four-thug gauntlet under a brick canopy, rhythm
   pits 6/7 around a coin island, a grand double staircase with a coin
   crown, and the home stretch to Nousa.

Budget: 55 loose coins + 4 ؟/F crates, 12 thugs, 7 pits, 1 checkpoint.

### Checkpoints (عربية الفول)

Touching the cart once flips it to its lit "active" art, plays a two-note
ding, shows a toast, and moves the death-respawn point to the cart (both
platforms; the timer still resets on death). Level letter: `C`. Sim coverage:
activation fires exactly once, respawn returns to the cart with i-frames,
and stages without checkpoints still respawn at the start.

## Scoring

فكة 100 · دهس بلطجي 200 · ساندوتش 400 · مكافأة وقت 10/ث ·
أعلى نقاط محفوظة في UserDefaults.

## Art direction

- Palette: warm Cairo daylight — sand/beige buildings hazed toward a dusty sky
  so gameplay elements (saturated maroon/gold/blue) pop in front.
- 16×24 characters, 16×16 tiles, 12×12 coins. Flip via child-sprite xScale
  (physics bodies never scale).
- Backgrounds carry the flavor: minaret + dome skyline, satellite dishes,
  water tanks, laundry lines.
- All from `tools/generate_assets.py` (pure stdlib PNG encoder). Contact sheet:
  `docs/sprites.png`.

## Roadmap

| Milestone | Content |
|---|---|
| ~~0.3~~ ✅ | ~~Stage 2 «شارع السوق»~~ shipped, plus checkpoints (عربية الفول) |
| 0.2 | Arabic pixel font, Lemby voice-quote stingers, walk-off-ledge Goomba variant |
| 0.4 | Stage 3 «الميكروباص» (auto-scroller on the microbus roof), stage select |
| 0.5 | Boss: الفتوة + stage 4 «الفرح» finale, save/continue |
| 0.6 | Game-controller support, settings scene, screen-shake & juice pass |

## The three frontends

| | macOS | Windows | Web |
|---|---|---|---|
| Stack | Swift + SpriteKit + AppKit | C# (.NET 8) + WinForms + GDI+ | JS + canvas (single HTML file) |
| Physics | SpriteKit bodies (merged terrain runs) | Custom AABB/tile sim in `windows/ElLemby.Core` | JS port of the same sim (`web/src/world.js`) |
| Arabic text | Core Text via `SKLabelNode` (Geeza Pro) | GDI+ `DrawString` shaping (Segoe UI, RTL formats) | canvas `fillText` + `direction: rtl` (browser HarfBuzz) |
| Audio | `AVAudioPlayer` per effect | winmm **MCI** alias per effect (`type mpegvideo` for looping) | **WebAudio buffers synthesized in-page** from the note tables |
| Loop | SpriteKit `update(_:)` | `Application.Idle` + `PeekMessage`, fixed 60Hz steps | `requestAnimationFrame` + fixed-step accumulator |
| Input | NSEvent key codes | WinForms `Keys` | `KeyboardEvent.code` + on-screen touch buttons |
| Extras | universal .app artifact | portable exe artifact | attract-mode bot demo, ~70 KB total, zero requests |
| Deps | none | none (no NuGet packages) | none (no npm packages) |

Both load the **same** `level1.txt`, PNGs, and WAVs (the csproj links
`Sources/ElLembyCore/Resources` into the exe's output), and both use the same
tuning constants — `GameConfig.swift` and `GameConfig.cs` must be kept in
lockstep when tuning.

The Windows split (`ElLemby.Core` sim + thin `ElLemby.App` shell) exists so
gameplay is test-driven: the dependency-free suite covers the parser, movement
(jump apex ≈ 4.3 tiles, jump-cut, max speed), stomps, crate pops, thug patrol
bounds, checkpoints, and a **runner bot that must finish every stage** — run
via `dotnet run --project windows/ElLemby.Tests` on any OS, and in CI.
The web build carries the same suite in JS (`node web/test.js`), where the
bot doubles as the title screen's arcade **attract mode**. Porting the sim
back under the SpriteKit frontend is a roadmap candidate.

The web bundle (`tools/build_web.py`) inlines the shared sprites as base64
and the level texts verbatim, and ships **no audio at all**: the SFX and the
hijaz music loop are rendered at load time by a JS port of the Python synth
(same event tables, deterministic xorshift noise) into WebAudio buffers.
Headless-Chromium screenshots of `ellemby.html?demo=1` are the render-layer
verification path on machines with no display.

## Tech notes / known gaps (MVP)

- `swift run` opens the window directly; `make app` wraps the release binary +
  SPM resource bundle into an ad-hoc-signed `dist/ElLemby.app`
  (`UNIVERSAL=1` for arm64+x86_64; `make install` copies it to
  /Applications — see docs/INSTALL-macOS.md). On Windows,
  `dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true`
  produces a portable exe. CI uploads both as artifacts:
  `ElLemby-macos` (universal .app zip) and `ElLemby-windows-x64`.
- Thugs idle-animate during the win freeze (harmless; polish later).
- One audio channel per effect on both platforms — rapid same-effect
  retriggers restart the sound instead of overlapping. Fine at this scale.
- Arabic renders correctly shaped on both platforms, but with system fonts,
  not a pixel font yet (roadmap 0.2 bitmap font, shared between frontends).
- No breakable bricks or multi-hit crates yet; crates bump-nudge only.
- Windows sim resolves upward head-bumps against every overlapped crate cell
  (the player can span two columns); stage 1 never places two mystery crates
  adjacent, so at most one pops per bump today.
