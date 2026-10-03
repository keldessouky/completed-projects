# Reactor — a TypeScript & React quest

An interactive game that teaches **TypeScript** and **React** by having you write
both for real. Orrery Station has been dark for nine days. Every system aboard is
written in TypeScript and React, and the compiler won't bring any of them back
online until they're right. You restore the station one system at a time, in a
real editor, against the **real TypeScript compiler** and the **real React
runtime**, both running in your browser.

It runs on macOS and opens in your browser.

![Title screen](docs/title.png)

## Play it on a Mac

You need [Node.js](https://nodejs.org) 20.19 or newer (`brew install node` works).

| How | What happens |
|---|---|
| **Double-click `Reactor Quest.command`** in Finder | Installs dependencies on first run, builds the game if needed, and opens it in your default browser. Close the Terminal window to stop. |
| `npm start` | The same thing, from a terminal. |
| `npm run app:mac` | Builds **`Reactor Quest.app`**, a real app bundle with a code-drawn icon. Drag it to /Applications and launch it from Launchpad or the Dock. It carries its own copy of the game and a small local server, opens the game in your browser, and quits on its own about a minute after you close the tab. |

On first launch, macOS Gatekeeper may say the `.command` or `.app` is from an
unidentified developer. Right-click it and choose **Open** once.

Progress saves automatically in the browser: stars, XP, achievements, and the
code you've typed in every level.

## The game

![A level](docs/level.png)

Each level is one broken station system. The left panel holds the **mission**
(story and objectives), a **lesson** that teaches the concept, and three
**hints**. The middle is a CodeMirror editor with live type checking: errors get
red squiggles as you type, and hovering one shows the compiler's message.
**Run** (⌘↵) compiles your file, runs hidden type tests against it, runs
behaviour checks against what it actually does, and, for React levels, renders
your component live in the **Preview**, where you can click it.

![A React level, with a live preview](docs/react-level.png)

- **Stars.** Three for a clean solve. Each hint you reveal costs a star (down to
  one), and so does looking at the reference solution. You can replay any level
  for three stars.
- **XP and ranks.** From Cadet to Reactor Architect. XP is paid only when you
  beat your best stars, so replays can't be farmed.
- **Station power.** Every system you restore powers up the station. The reactor
  on the title screen glows brighter with it.
- **Bosses.** Each deck ends in a larger level that combines everything in it.
- **Quizzes.** Short "think like the compiler" or "predict the render" rounds.
- **Compiler Says (arcade).** 60 seconds and a stream of snippets. Does it compile
  under `strict`? Arrow keys answer. A wrong answer pauses the clock and shows
  why, along with the real `tsc` error message.
- **Achievements**, including First Try, Persistence, Flawless Deck and
  `tsc --strict`.

![Compiler Says: a wrong answer shows the real compiler error](docs/arcade.png)

![Station map](docs/map.png)

### Curriculum: 5 decks, 37 levels

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
  of milliseconds.
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
npm test        # 165 tests
npm run smoke   # 44 checks in headless Chromium/Chrome
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
  also plays a quiz and an arcade round, checks the phone layout for horizontal
  scroll, exercises the launcher server, and fails on any uncaught page error.
  Screenshots land in `test-results/`.

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
