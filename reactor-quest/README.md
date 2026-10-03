# Reactor — a TypeScript & React quest

An interactive game that teaches **TypeScript** and **React** by having you write
both for real. Orrery Station has been dark for nine days. Every system aboard is
written in TypeScript and React, and the compiler won't bring any of them back
online until they're right. You restore the station one system at a time, in a
real editor, against the **real TypeScript compiler** and the **real React
runtime**, both running in your browser.

It runs on macOS and opens in your browser.

![Title screen](docs/title.png)

## Setup (macOS)

You only do this once.

1. **Install Node.js 20.19 or newer.** Download the macOS installer from
   [nodejs.org](https://nodejs.org/en/download), or, if you use Homebrew, run
   `brew install node`. To check, open Terminal and run `node --version`. It
   should print `v20.19` or higher.
2. **Get the code.** In Terminal:

   ```bash
   git clone https://github.com/keldessouky/completed-projects.git
   cd completed-projects/reactor-quest
   ```

   (No git? Download the repository as a ZIP from GitHub, unzip it, and open the
   `reactor-quest` folder.)
3. **Install and build.** Still in the `reactor-quest` folder:

   ```bash
   npm install
   npm run build
   ```

   You can skip this step if you launch with the `.command` file below. It
   does this for you the first time.

## Start the game

Pick one of these. Each one opens the game in your default browser at
`http://localhost:4310`.

- **Double-click `Reactor Quest.command`** in Finder (inside `reactor-quest`).
  A Terminal window opens. The first run installs and builds the game, which
  takes about a minute, then your browser opens. Leave the Terminal window
  open while you play, and close it when you're done.
- **Or run `npm start`** in Terminal from the `reactor-quest` folder. It does
  the same thing. Press `Ctrl+C` to stop.
- **Or make a Mac app:** run `npm run app:mac`. This creates
  **`Reactor Quest.app`** in the `reactor-quest` folder. Drag it to
  Applications and open it like any other app, from Launchpad, Spotlight or the
  Dock. It opens the game in your browser, runs quietly in the background, and
  quits on its own about a minute after you close the game's tab.

The first time you open the `.command` or the `.app`, macOS may say it's from an
unidentified developer. **Right-click it and choose Open**, then click **Open**
again. You only have to do this once.

Your progress (stars, XP, achievements, and the code you've typed in every
level) saves automatically in your browser. Use the same browser each time to
keep it.

### If something goes wrong

| Problem | Fix |
|---|---|
| "Reactor needs Node.js" | Install Node.js (step 1), then launch again. |
| "Reactor needs Node.js 20.19 or newer" | Update Node: download the latest version from nodejs.org, or run `brew upgrade node`. |
| The browser didn't open | Open `http://localhost:4310` yourself. If that port was taken, the Terminal window prints the address it used instead. |
| "Loading compiler…" stays for a few seconds | That's normal on the first level you open. The browser is loading the TypeScript compiler (about 7 MB). |
| You want to start over | **Profile → Settings → Reset all progress**. |

## How to play

![A level: mission on the left, editor in the middle, checks on the right](docs/level.png)

1. **Start.** On the title screen, click **Begin**. Once you have progress, it
   says **Continue** and takes you to your next level.
2. **Read the mission.** The left panel has three tabs:
   - **Mission:** the story, plus the list of **objectives** your code must meet.
   - **Lesson:** teaches the TypeScript or React idea you need, with examples.
     Read this first if the topic is new to you.
   - **Hints:** three hints, revealed one at a time. Each hint you reveal costs a
     star (see below).
3. **Write code** in the editor in the middle. The starter code is broken or
   unfinished. Comments in it tell you what to build. Type errors get **red
   squiggles** as you type. Hover over one to read the compiler's message. The
   bar under the editor says whether your file currently has type errors.
   - **Hover over any name** to see the type TypeScript gave it, like
     `let count: number` or `const setN: React.Dispatch<React.SetStateAction<number>>`.
     It's the fastest way to learn what the compiler infers.
   - **Autocomplete** pops up as you type: members after a `.`, names in
     scope, and a component's props inside JSX. Press **Ctrl+Space** to open it
     yourself. It comes from the same compiler, so it only offers what's valid.

   ![Hovering a function shows its type](docs/hover-type.png)
4. **Run** with the **Run** button, or press **⌘↵** (Cmd+Return; Ctrl+Return
   works too). The shortcut works anywhere on the level screen. The right
   panel then shows:
   - **Checks:** every objective, ticked ✓ or crossed ✗, with the reason for each
     failure. Checks tagged **TYPE** test your *types* (for example, "strings must
     be rejected"). The others test what your code *does*.
   - **Preview** (React levels): your component, live. Click it and type into
     it like a real web page.
   - **Console:** anything your code prints with `console.log`.
5. **Pass every check with no type errors** and the system comes back online.
   You get stars and XP. Click **Next system →**, or press Return, to go on.

![A React level, with the live preview at the top right](docs/react-level.png)

**Stars.** A level is worth ★★★ if you solve it without help. Revealing the
first hint drops it to ★★, and the second to ★. Looking at the reference
solution (**Hints → Show the solution…**) also caps it at ★. You can **replay**
any level later to earn all three. Your best result is kept.

**The station map** (**Map** at the top) shows all five decks, your stars, and
what's next. Levels open in order. Each deck ends with a boss level (☢) that
combines everything in that deck. Already know the basics? Go to **Profile →
Settings** and turn on **Open every system** to jump ahead.

![The station map](docs/map.png)

**Quizzes** (the **?** levels) are multiple choice, and each answer comes with
an explanation. Every wrong answer costs a star, but you always get at least one.

**Arcade: Compiler Says** (**Arcade** at the top). You have 60 seconds. Each
card shows a snippet of TypeScript. Decide whether it compiles:

| Key | Answer |
|---|---|
| `→` or `Y` | It compiles |
| `←` or `N` | It's a type error |
| `Return` | Next card, after a wrong answer |

A wrong answer pauses the clock and shows why, along with the compiler's real
error message. Your score earns XP, and your best score is kept.

![Compiler Says: a wrong answer shows the real compiler error](docs/arcade.png)

**Profile** shows your rank, stats and achievements. It also has the settings:
sound, **Open every system**, and **Reset all progress**. The speaker icon at the
top right mutes sound effects.

The whole game is keyboard-friendly: **⌘↵** runs your code, **Return**
continues after a win, and **Esc** closes dialogs.

## Ranks and achievements

- **XP and ranks.** You earn XP for every level, from Cadet up to Reactor
  Architect. XP is only paid when you beat your best stars, so replaying a level
  for the same result earns nothing.
- **Station power.** Every system you restore powers up the station. The bar at
  the top shows it, and the reactor on the title screen glows brighter.
- **Achievements**, including First Try, Persistence, Sharp Eye, Flawless Deck
  and `tsc --strict`. A banner pops up when you earn one. See them all under
  **Profile**.

## What you'll learn: 5 decks, 37 levels

| Deck | Teaches | Boss |
|---|---|---|
| **Type Foundry** | annotations, return types, inference, arrays and tuples, interfaces, `readonly`/optional, unions and narrowing, `null` handling | Reactor Telemetry |
| **Generics Lab** | literal types, discriminated unions, `never` exhaustiveness, generics, constraints, `keyof` and indexed access, utility types (`Partial`, `Pick`, `Readonly`, `Record`), mapped types | a fully typed event bus |
| **Component Bay** | components and JSX, typed props and defaults, `children` and composition, lists and keys, conditional rendering (and the `0 &&` trap) | Crew Roster |
| **Control Room** | `useState`, typed state, callback props, controlled inputs, typed events, forms and `preventDefault`, immutable updates, lifting state up, updater functions | Launch Checklist |
| **Reactor Core** | `useEffect` and cleanup, stale closures, `useRef`, `useReducer` with typed actions, custom hooks and tuple returns, context, generic components | Core Reboot: reducer, timer effect, controlled input, derived state |

Each deck also has a quiz, and the arcade holds 40 compile-or-not cards.

## How it works

```
 editor ──► Web Worker: TypeScript 6 LanguageService over a virtual file system
            (lib.es2022 + lib.dom + @types/react, ~3.8 MB, mounted read-only)
              │  diagnostics for the player's file and each hidden type test
              │  + the file transpiled to CommonJS
              ▼
 main thread: evaluate it in a sandbox (console + timers are intercepted;
              only `react` can be imported) ──► behaviour checks with a small
              testing kit (render · click · type · submit · expect)
              ──► live preview in its own React root, behind an error boundary
```

- **Real type checking.** `tools/gen-typings.mjs` collects every declaration file
  the compiler needs at build time. The worker's language service keeps the parsed
  library ASTs, so the first check takes about a second and later ones take tens
  of milliseconds. The same language service answers the editor's hover types
  (`getQuickInfoAtPosition`) and autocomplete (`getCompletionsAtPosition`).
- **Type tests.** A level can require that your *types* are right, not just your
  output. Each type check is a hidden `.tsx` file that imports your module and
  marks lines your types must reject with `// @ts-expect-error`. If your types are
  too loose (say, `any`), the directive goes unused and the check fails with
  "This should be rejected by the compiler, but your types allow it."
- **Behaviour checks** render your component with the real `react-dom`, dispatch
  real DOM events, and read the result. The kit catches the things beginners
  trip on and says so plainly: errors thrown in event handlers, forms that would
  reload the page, timers still running after unmount (the sandbox counts them),
  and reducers that mutate frozen state.
- **Safety.** Your code runs in the page, so the sandbox clears every timer it
  started on each run, a guard stops any form from reloading the game, and the
  preview lives in a separate React root, so a crash in your component can't take
  the game down.
- The **title, map, and every screen** are themselves React + TypeScript (Vite 8,
  React 19, CodeMirror 6). All sound is synthesized with WebAudio. The `.app` icon
  is drawn by `tools/icon.mjs` and encoded to PNG/ICNS with nothing but `node:zlib`.

## Proven playable

```bash
npm test        # 171 tests
npm run smoke   # 45 checks in headless Chromium/Chrome
```

- **`npm test`** checks every one of the 32 code levels both ways: the reference
  solution compiles cleanly and passes every type and behaviour check, *and* the
  starter code does not, so every level has something to do. Every arcade card's
  verdict is checked against the real compiler. Every quiz answer is valid. Every
  lesson renders without stray markdown. The grading kit, sandbox, scoring,
  unlock rules and save validation have their own tests too.
- **`npm run smoke`** is a bot that plays the built game through its UI. It runs
  the first-run flow (starter fails → hint → solution → victory at ★, then a typed
  solve for ★★★ and the First Try achievement), checks locking, then opens *every*
  code level, types the solution into the editor, presses Run and waits for the
  victory screen. That covers the effect and timer levels in a real browser. It
  also hovers a name and checks the type tooltip, checks autocomplete, plays a
  quiz and an arcade round, checks the phone layout for horizontal scroll,
  exercises the launcher server, and fails on any uncaught page error.
  Screenshots land in `test-results/`. `SMOKE_PLATFORM=mac npm run smoke` makes
  the page believe it's on macOS, so the ⌘ keyboard paths can be tested from any
  machine.

![The final boss, beaten](docs/victory.png)

CI (`.github/workflows/reactor-quest.yml`) runs all of this on **macOS**, packages
`Reactor Quest.app`, checks that its bundled server serves the game, and uploads
the zipped app as an artifact.

## Development

```bash
npm install
npm run dev      # http://localhost:5173, with hot reload
npm run build    # typecheck + production build → dist/
npm start        # build if stale, serve dist/, open the browser
```

```
src/
  content/         the curriculum: deck1–5.ts, arcade.ts
    code/<level>/  starter + reference solution for every code level, as real .ts/.tsx
  engine/          checker.ts (TS language service), compiler.worker.ts, runtime.ts
                   (sandbox + test kit), grade.ts
  game/            types, progress (stars/XP/ranks/achievements/save), store, sound
  screens/         Title, Map, CodeLevel, Quiz, Arcade, Profile
  ui/              CodeEditor, Preview, Markdown, Victory, Modal, router
tools/             gen-typings, launch, server (zero-dependency), make-mac-app, icon, smoke
tests/             levels, arcade, progress, runtime, markdown
```

### Adding a level

1. Write `src/content/code/<id>/starter.tsx` and `solution.tsx`.
2. Add an entry to a deck with a brief, a lesson, three hints, `checks` (behaviour)
   and optionally `typeChecks` (`@ts-expect-error` files) and a `preview`.
3. Run `npm test`. The level suite fails until the solution passes everything and
   the starter doesn't.
