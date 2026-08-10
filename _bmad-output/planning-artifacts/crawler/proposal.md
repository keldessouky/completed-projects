# CRAWLER — a dungeon-crawler build on the Ziggurat Run engine

**Working title:** *Crawler* (Dungeon Crawler Carl flavour)
**Basis:** `ziggurat-run/` — PixiJS 8 auto-runner, 6,066 LOC, shipping and smoke-tested
**Ask:** a dungeon-crawler version where each map is a dungeon floor
**Recommendation:** Tier 2 scope (below), ~5–7 weeks, with a shippable Tier 1 milestone at week 2

---

## 1. What Ziggurat Run actually is

Two things, and it matters that they're separable.

**A game.** A vertical auto-runner in the *Count Masters* mould. The hero holds a fixed
screen-y at 700; the world scrolls past at 340 px/s. Drag anywhere steers 1:1 within a
±168 px lane. Hero and squad auto-fire on a shared 0.40 s beat, the squad trailing in a
spring-damped triangular V-wedge. Paired gates span the lane — `×2` / `×3` / `+5` / `+10`
against `−5` / `÷2` / `−50%` — and you steer through exactly one. Between gate sets, enemy
clusters close on the line and take units off you on contact. Every stage ends at a boss
gate whose HP you grind down with the arrow stream. **Damage-per-second *is* the surviving
squad**, so the entire run is one long argument about how many units you'll have when the
boss appears. 12 stages, 3 chapters, 1–3 stars from squad-alive-at-breach, four permanent
upgrade tracks bought with coins.

**An engine.** This is the valuable half, and it's better than the game needs.

| Subsystem | What it gives you | File |
|---|---|---|
| Fixed-timestep driver | 120 Hz sim decoupled from render, interpolation `alpha`, spiral-of-death clamp, rolling-2 s FPS governor that one-way-degrades to 60, thermal particle throttle | `core/loop.ts` (93) |
| Context object | Renderer, layers, all services, WebGL context-loss recovery, a `guard()` that stops one exception from permanently killing the ticker | `core/game.ts` (183) |
| Pools | Fixed-capacity swap-remove pools for arrows/particles/units/enemies/corpses — **zero allocation in the hot loop**, no GC hitches | `core/pool.ts` (36) |
| Persistence | Versioned localStorage, field-by-field sanitisation, a worked v1→v2 migration, `pagehide` flush | `core/save.ts` (128) |
| Procedural art | The **entire** spritesheet painted at boot onto one 2048² canvas from a 15-colour palette; per-chapter parallax strips generated from a seeded RNG. No image files exist. | `assets/atlas.ts` (605), `assets/backdrops.ts` (220) |
| Procedural audio | Offline synthesiser emits the whole audio sprite + Howler sprite map. No sound files exist either. | `tools/gen-audio.mjs` (489) |
| Seeded content gen | `getStage(i)` → deterministic, cached `StageDef` from curves over the stage index | `game/stages.ts` (120) |
| Scene shell | Manager with build-fresh-on-goto, wholesale destroy, tween-kill-before-destroy, fade | `scenes/scene.ts` (84) |
| UI kit | Buttons, tabular-digit displays, panels, star rows, pause/settings/confirm overlays, 5-tap dev overlay | `ui/*` (566) |
| Verification | Headless Chromium harness that drives the *real* UI through 11 flows and asserts a bot can win stage 1 | `tools/smoke.mjs` (240) |
| Distribution | `build-single.mjs` inlines code + fonts + audio into **one `.html` that makes zero network requests** | `tools/build-single.mjs` (99) |

Everything tunable lives in `config.ts` (261 lines, every constant commented). There are no
magic numbers elsewhere in the codebase. That single fact is what makes a genre pivot
tractable.

### The one structural constraint

`RunScene` (950 lines) hard-assumes **one continuous scroll from `dist = 0` to
`def.trackLength`, with a boss at the end.** Gates and waves are spawned by comparing their
track position against `dist`. A floor built of discrete rooms breaks that assumption — this
is the single biggest refactor in the whole proposal, and §4 addresses it head-on.

Second constraint, smaller but sharp: `SceneManager.goto()` destroys the outgoing scene
wholesale. Any state that must survive room-to-room movement inside a floor **cannot live in
a scene** — it needs a `RunState` object hanging off `Ctx`.

---

## 2. The translation table

This is the spine of the design. Read it as "what each existing concept becomes."

| Ziggurat Run | Crawler |
|---|---|
| Stage (1 of 12) | **Floor** (1 of 18) |
| Chapter (1 of 3) | Act — floors 1–6 / 7–12 / 13–18 |
| Chapter map scene (static list of nodes) | **Floor map — a seeded node graph you route through** |
| Squad count | **Party** — Carl, Donut, and the NPCs/summons you pick up |
| Squad = DPS | Unchanged. Party size still drives the volley. |
| Gate pair (`×2` vs `−50%`) | **System door pair** — same arithmetic, delivered as a snide System notification |
| Trap resistance (Ward Seals) | CON / ward-type gear |
| Enemy wave | Mob pack; elite variants at floor thresholds |
| Boss gate + lamassu that wake at 50 % | Floor boss + a phase change; the stairs open on kill |
| Track length / stage duration | **Floor timer** — a countdown, not a distance |
| Stars (1–3) | Floor rank + achievement unlocks |
| Coins | Gold, plus Borant-style credits for the cash shop |
| Workshop (4 upgrade tracks × 5) | **Character sheet** — level, XP, seven stats, class, gear slots |
| `economy.startSquad()` | Party slots from CHA + class |
| `economy.arrowDamage()` | Weapon damage from STR + equipped gear |
| Fail line (*"You lost 40 units to the scorpion wave"*) | **Death broadcast** — the announcers narrate your death over a viewer count |
| — *(new)* | System notification queue |
| — *(new)* | Loot boxes: bronze / silver / gold |
| — *(new)* | Achievements with sarcastic names |
| — *(new)* | 2 tap-to-cast ability buttons |

---

## 3. The design

### 3.1 Frame

You are a crawler in a dungeon that is also a televised game show. A corporation runs it,
badly and cheaply. A guide manages you between floors. Announcers commentate your kills and
your death. Eighteen floors, each with a theme, a boss, and a clock.

### 3.2 A floor is a map

`MapScene` currently paints three static chapter panels of four stage buttons. Replace it
with a **seeded node graph per floor**, generated the same way stages are today —
`getFloor(i)` returning a cached, deterministic `FloorDef`:

```
                    ┌── mob ──── loot ──┐
   entry ── corridor┤                   ├── safe room ── corridor ── BOSS ── stairs
                    └── loot ── mob ────┘
```

Node types, and what each one reuses:

| Node | Scene | Reuse |
|---|---|---|
| **Corridor** | scrolling encounter | `RunScene` almost verbatim — doors, mobs, the drag verb |
| **Mob room** | static arena encounter | `RunScene` with `scroll = 0`; waves spawn from the top edge |
| **Loot box** | choice overlay | the gate-pair UI (`GatePairView`) promoted to a full-screen pick |
| **Safe room** | menu scene | `UpgradeScene`'s layout — heal, shop, spend stat points, talk to your guide |
| **Boss** | arena + `BossFight` | `boss.ts` unchanged in structure; per-floor stat and phase tables |
| **Stairs** | transition | new, trivial |

### 3.3 The clock is the new mechanic

Ziggurat Run has no resource you spend on *choices* — you steer, and that's the whole
decision surface. A dungeon crawler needs a route decision, and the floor timer supplies it:
**every node you visit costs time; loot and XP only come from nodes you visit; the stairs
close when the timer hits zero and everything still on the floor dies.**

That one addition turns the node graph from decoration into the game. It's also the most
faithful thing in the design — the collapsing floor is the genre's signature pressure.

### 3.4 Character progression replaces the Workshop

Out: four upgrade tracks, five levels each, bought with coins.
In: level + XP from kills, seven stats (STR/DEX/CON/INT/WIS/CHA/LUCK) taking points on
level-up, a class chosen at floor 3, gear slots filled from loot boxes.

The existing `economy.ts` functions are the exact seam — `startSquad`, `fireInterval`,
`arrowDamage`, `trapResist` already isolate "how do upgrades affect the run." Swap their
bodies to read stats and gear instead of upgrade levels and the run scene never notices.

### 3.5 One new input verb

Today the only input is drag. A crawler needs more. The minimum viable addition is **two
tap-to-cast ability buttons in the HUD** on cooldowns — a class ability and a consumable.
`Input` already handles pointers and `Btn` already exists, so this is cheap, and it's the
difference between "auto-runner with an RPG skin" and "a game you play."

### 3.6 The cheap flavour wins

Two features with an absurd flavour-per-line ratio, both built from existing widgets:

- **System notifications** — a queue of boxed, deadpan messages (`panel()` + `uiText()`).
  Fires on level-up, loot, achievements, deaths, and unprompted editorial commentary.
- **Achievements** — sarcastically named, with small rewards. Pure data plus a toast.

Build these in Tier 1. They carry more of the feel than any amount of sprite work.

---

## 4. What survives, what changes

### Keep untouched (~2,000 LOC)

`core/loop.ts` · `core/game.ts` · `core/scaler.ts` · `core/pool.ts` · `core/fx.ts` ·
`core/audio.ts` · `core/haptics.ts` · `core/input.ts` · `scenes/scene.ts` · all of `ui/` ·
`tools/build-single.mjs`

None of this is genre-specific. The fixed-step + interpolation + pooling architecture serves
a real-time crawler exactly as well as it serves a runner.

### Extend

- **`core/save.ts`** — v2→v3 migration (the file already ships a worked v1→v2 example to copy).
  The save grows a lot: floor, level, XP, stats, class, inventory, achievements, **and
  in-progress run state** (see §6).
- **`assets/atlas.ts`** — new painters for the cast, mobs, doors, boxes, icons. Keep the
  procedural approach; it's the reason the game ships as one self-contained file.
- **`assets/backdrops.ts`** — 18 floor themes instead of 3 chapters. Biggest art lift in the
  project. **Must become lazy** — generating 18 themes at boot is not acceptable.
- **`config.ts`** — curves become functions of floor index; add stat, class, loot, and
  timer tables.
- **`tools/gen-audio.mjs`** — retune the synth patches; add stingers for level-up, loot,
  achievement, and the death broadcast.
- **`tools/smoke.mjs`** — extend the 11 flows to cover routing a floor, a loot pick, a
  level-up, and a mid-floor resume.

### Rewrite

- **`scenes/run/runscene.ts`** → split into an `Encounter` base plus `CorridorEncounter`
  (scrolling) and `ArenaEncounter` (static). Roughly 60 % of the body survives: pools,
  springs, volleys, collisions, contact, and the ending machinery are all encounter-agnostic.
  What changes is the spawn driver — from "compare track position against `dist`" to "run a
  wave script."
- **`scenes/map.ts`** → `scenes/floor/floormap.ts`, the node graph.
- **`game/stages.ts`** → `game/floors.ts`, same seeded-and-cached shape, emitting a graph
  instead of a linear track.

### New

`game/stats.ts` · `game/loot.ts` · `game/classes.ts` · `game/system.ts` (notification queue)
· `game/achievements.ts` · `game/runstate.ts` · scenes for `lootbox`, `safehouse`,
`charsheet`, `levelup`

---

## 5. Scope tiers

**Tier 1 — Reskin + System · ~2 weeks · ships**
18 floors replacing 12 stages, new cast and mobs in the atlas, System notification queue,
achievements, announcer death lines, corp flavour throughout. No node graph, no stats.
Plays exactly like Ziggurat Run; *feels* like a dungeon crawl. Worth shipping on its own.

**Tier 2 — Floor as a map · ~5–7 weeks · recommended**
Everything in Tier 1, plus: the seeded node graph, the floor timer, loot boxes, level/XP/stats,
two ability buttons, safe rooms, and the encounter refactor. This is where the ask —
*each map is a dungeon floor* — is actually satisfied, and where it stops being a runner
with a skin on it.

**Tier 3 — Full crawl · 3+ months**
Classes with distinct run verbs, gear slots and set bonuses, Donut as a second controllable
character, a hub with sponsorships and a cash shop, a persistent leaderboard, and 18
hand-tuned floor gimmicks rather than 18 parameterisations of one.

**Build Tier 2, sequenced so Tier 1 is a real milestone you could stop at.**

---

## 6. Risks — read these before committing

**Session length is the sharpest problem.** Ziggurat Run stages run 60–88 seconds. A dungeon
floor is 10–20 minutes. That breaks the "playable ad" framing the whole project was tuned
for, and it forces **mid-floor save/resume**, which the current save layer does not do at
all. Compounding it: `SceneManager` destroys scenes on every `goto`, so floor-scoped state
has to be lifted into a `RunState` on `Ctx` and serialised on `pagehide`. Design this on day
one — retrofitting resume into a scene-destroying router is miserable.

**Boot cost.** Today: one 2048² atlas, three backdrop sets, painted at boot. Eighteen floor
themes at boot would blow the loading screen out. Backdrops must become lazy per floor, and
the atlas may need to split into a core sheet plus per-act sheets.

**Scope multiplication.** The runner is 950 lines because it's one scene. A crawler is
5–10× the game, and the node graph is the piece that quietly triples the scene count. The
tiering above exists specifically to keep a shippable thing on the table at all times.

**IP.** *Dungeon Crawler Carl* is live, commercially active intellectual property, and
`completed-projects` is a public repo under AGPL-3.0. Using the characters and names in a
public repo is a real takedown risk. The cheap insurance: put **every string and character
name in one `flavour/` module** from the first commit. Personal build keeps the names; if it
ever goes public, swapping to an original cast is an afternoon's work instead of a rewrite.
This costs nothing to do now and is expensive to add later.

**Balance surface.** `config.ts` is currently ~40 tunables over 12 stages. Adding stats,
classes, gear, and loot tables over 18 floors makes that a genuinely hard tuning problem.
The smoke harness's "can a bot win floor 1" assertion should be extended into a broader
bot-playthrough matrix — it's the only cheap defence against an unwinnable floor 14.

---

## 7. First week, concretely

1. Branch and copy `ziggurat-run/` → `crawler/`; strip Mesopotamian strings into `flavour/`.
2. Widen `config.stages` (12) → `config.floors` (18), retune the curves, confirm smoke passes.
3. Build `game/system.ts` + the notification widget. Wire it to gate pickups and deaths.
   *This is the moment it starts feeling like the right game.*
4. Build `game/achievements.ts` and a toast.
5. Land the `RunState`-on-`Ctx` + save-v3 spine **before** any of the node-graph work.

Steps 1–4 are Tier 1. Step 5 is the load-bearing wall for Tier 2.
