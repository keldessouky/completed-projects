# اللمبي: مغامرات الحارة — وثيقة التصميم
# El-Lemby: Alley Adventures — Design Document

A native pixel platformer for macOS and Windows starring اللمبي, modeled on
the language of Super Mario Bros. and reskinned into the world of the 2002
Egyptian comedy. Side-scrolling strictly **left → right** (the movement is
LTR; the UI and all text are Arabic).

## Pillars

1. **Mario's grammar, El-Lemby's accent** — every mechanic should be readable
   to anyone who has played a platformer, but every noun is from the film's
   world (الحارة، الفكة، البلطجية، ساندوتش الفول، نوسة).
2. **Arabic-first** — HUD, menus, numerals (٠-٩), quotes. Latin appears only in
   developer-facing docs.
3. **Everything regenerable** — art, audio, and levels come from committed
   Python generators; no opaque binaries that can't be rebuilt or tweaked.

## Mario → El-Lemby mapping

| Mario | هنا | Notes |
|---|---|---|
| Mario | اللمبي | maroon tracksuit, messy hair, stubble |
| Peach / flagpole | نوسة | reach her to clear the stage |
| Goomba | البلطجي | patrols, turns at walls/ledges, stompable |
| Coin | الفكة | +100 pts, spinning gold pound |
| ? block | صندوق «؟» | wooden crate, Arabic question mark |
| Super Mushroom | ساندوتش فول | absorbs one hit («مفوّل» state) |
| Timer | الوقت | 240s countdown, timeout costs a life |
| 1-1 | المرحلة ١ «الحارة» | ~7 screens, 205 tiles |

## Movement feel (see `Core/GameConfig.swift` — single source of truth)

- Internal resolution **480×272** (30×17 tiles of 16px), nearest-neighbor
  scaling, default window 2×.
- Run: accel 640 pt/s² to max 116 pt/s; ground friction 820 pt/s²; air control
  at 470 pt/s².
- Jump: impulse 452 pt/s under gravity ≈1470 pt/s² → apex ≈ 4.3 tiles.
  Variable height: releasing the key caps vy at 145 pt/s.
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
| 0.2 | Arabic pixel font, Lemby voice-quote stingers, walk-off-ledge Goomba variant |
| 0.3 | Stage 2 «شارع السوق» (vendor carts as moving platforms), stage select |
| 0.4 | Stage 3 «الميكروباص» (auto-scroller on the microbus roof) |
| 0.5 | Boss: الفتوة + stage 4 «الفرح» finale, save/continue |
| 0.6 | Game-controller support, settings scene, screen-shake & juice pass |

## The two frontends

| | macOS | Windows |
|---|---|---|
| Stack | Swift + SpriteKit + AppKit | C# (.NET 8) + WinForms + GDI+ |
| Physics | SpriteKit bodies (merged terrain runs) | Custom AABB/tile sim in `windows/ElLemby.Core` |
| Arabic text | Core Text via `SKLabelNode` (Geeza Pro) | GDI+ `DrawString` shaping (Segoe UI, RTL formats) |
| Audio | `AVAudioPlayer` per effect | winmm **MCI** alias per effect (`type mpegvideo` for looping) |
| Loop | SpriteKit `update(_:)` | `Application.Idle` + `PeekMessage`, fixed 60Hz steps |
| Deps | none | none (no NuGet packages) |

Both load the **same** `level1.txt`, PNGs, and WAVs (the csproj links
`Sources/ElLembyCore/Resources` into the exe's output), and both use the same
tuning constants — `GameConfig.swift` and `GameConfig.cs` must be kept in
lockstep when tuning.

The Windows split (`ElLemby.Core` sim + thin `ElLemby.App` shell) exists so
gameplay is test-driven: 53 dependency-free tests cover the parser, movement
(jump apex ≈ 4.3 tiles, jump-cut, max speed), stomps, crate pops, thug patrol
bounds, and a **runner bot that must finish stage 1** — they run on any OS via
`dotnet run --project windows/ElLemby.Tests`, and in CI on the Windows job.
Porting that sim back under the SpriteKit frontend is a roadmap candidate.

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
