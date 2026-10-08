# Reactor Quest: the recipe

This file is everything you need to build **Reactor Quest** from an empty folder. You won't have the original repository, so it has the full source of every part that is easy to get subtly wrong: the in-browser compiler, the sandbox and test kit, the grading pipeline, the save format, the reward engine, the code editor, the colour profiles, the launchers, the app packagers, the tests and CI. The parts that are better written fresh, like most screens, the stylesheet and the 96 lessons, come as precise specs and worked examples.

It is long. Read **Part 0** first, then work through the parts in order. Each part ends in something you can run and check.

## Contents

- [Part 0. What you are building, and how to work](#part-0-what-you-are-building-and-how-to-work)
- [Part 1. Project setup](#part-1-project-setup)
- [Part 2. The compiler in a Web Worker](#part-2-the-compiler-in-a-web-worker)
- [Part 3. The sandbox and the testing kit](#part-3-the-sandbox-and-the-testing-kit)
- [Part 4. The level format and grading](#part-4-the-level-format-and-grading)
- [Part 5. The curriculum: 10 floors, 96 levels](#part-5-the-curriculum-10-floors-96-levels)
- [Part 6. Progress, the save file and the store](#part-6-progress-the-save-file-and-the-store)
- [Part 7. The reward engine and the loot catalogue](#part-7-the-reward-engine-and-the-loot-catalogue)
- [Part 8. The user interface](#part-8-the-user-interface)
- [Part 9. Look and feel: the stylesheet](#part-9-look-and-feel-the-stylesheet)
- [Part 10. Sixteen colour profiles](#part-10-sixteen-colour-profiles)
- [Part 11. Running it: server, launcher and double-click scripts](#part-11-running-it-server-launcher-and-double-click-scripts)
- [Part 12. Native packages for macOS, Windows and Linux](#part-12-native-packages-for-macos-windows-and-linux)
- [Part 13. Tests](#part-13-tests)
- [Part 14. The browser bot](#part-14-the-browser-bot)
- [Part 15. Continuous integration](#part-15-continuous-integration)
- [Part 16. README and licences](#part-16-readme-and-licences)
- [Part 17. Lessons learned the hard way](#part-17-lessons-learned-the-hard-way)
- [Part 18. Definition of done](#part-18-definition-of-done)

---

## Part 0. What you are building, and how to work

### The game in one paragraph

Reactor Quest teaches someone who has never written code to write professional TypeScript and React. The player is the new repair engineer on **Orrery Station**, a space station that has been dark for nine days. Every system aboard runs on code and none of it works. Each **level** is one broken system: the player reads a short story brief and a lesson, then fixes or writes real code in a real editor, and presses **Run**. The game type-checks the code with the **real TypeScript compiler** (running in the browser), runs it in a sandbox, and grades it with hidden checks, including **type-level checks** that grade the player's *types*. React levels render the player's components live. There are **96 levels on 10 floors** (86 code levels, 10 quizzes), from a first `console.log` to race conditions, accessibility and testing. Inspired by *Dungeon Crawler Carl*, the repair job is broadcast as a TV show: **THE FEED** narrates, viewers pile in, sponsors send gifts, and a reward engine pays out constantly. That means crawler levels and career titles, six tiers of loot boxes, 58 achievements, 21 skills, a companion pet with hats, five classes, daily quests and streaks, a shop, boss HP bars, and collectible Codex cheat sheets. Underneath the show, it is built on how people actually learn: one idea per level in prerequisite order, hints before solutions, plain-English compiler errors, quizzes that re-ask what you missed, **spaced review** that brings every idea back at growing intervals, and a **notebook** where the player explains each level back in their own words.

### How it teaches (the learning design)

Every feature below exists for a learning reason. Keep these when you build it; they matter more than any single level.

| Principle | How the game applies it |
|---|---|
| **Small steps in prerequisite order** (cognitive load) | One new idea per level; solutions only use constructs earlier lessons taught; where a step was big, a smaller bridge level comes first. Bosses interleave a floor's ideas. |
| **Advance organisers** | The Mission tab lists "You'll learn" (the lesson's section headings) before the player starts, with a link to the lesson. |
| **Instruction at the moment of need** | After two failed runs without opening the lesson, a note suggests it. |
| **Productive struggle, scaffolded** | Three hints, each more specific. The reference solution only opens after all three, and until the level is solved it can't be pasted in: the player rebuilds it. |
| **Immediate, specific feedback** | Every check explains its failure. Compiler errors get a plain-English line for the common ones (`src/engine/explain.ts`), in the results panel and the editor tooltip. |
| **Retrieval practice** | A quiz on every floor. A wrong answer comes back at the end of the quiz until it's answered right (successive relearning); only first-try mistakes cost stars. |
| **Spacing** | Spaced review (Leitner boxes): quiz questions and compiler-verified "does this compile?" cards join a deck when their level is cleared, first due the next day, then after 3, 7, 14, 30 and 60 days while remembered; a miss returns tomorrow and again at the end of the session. |
| **Self-explanation** | After each clear, an optional "Explain it back" prompt; notes go to a Notebook and reappear when the level is revisited. |
| **Mastery over speed** | Every level is proven passable and its starter failing. Replays for full stars, testing out of a floor by beating its boss, and no ticking clock while working (a hidden speed bonus remains). |
| **Rewards aligned with learning** | Achievements and quests reward reviewing, explaining, clean clears and improving on a replay, never late nights or reflexes. |

### Characters and voice

- **ARIA**, the station AI, gives every brief. Dry, warm, a little sardonic, never mean. Example: *"Oh good, you're awake. Orrery Station has been dark for nine days, and you are — I'm told — the new repair engineer. You've never written code? Excellent. Neither had anyone else who came aboard. Most of them are fine."*
- **THE FEED**, the broadcast of *Repair Crew LIVE* to "four billion viewers", is breathless, absurd and affectionate, always in italics. Example: *"Welcome, viewers, to Repair Crew LIVE! Our new engineer is about to write their very first line of code. Statistically, this is where things get funny."*
- Sponsors are fictional and slightly desperate (Quasar Cola, Stackwise Bank, Null Pointer Insurance…). The shopkeeper in the Safe Room is a cheerful huckster.
- Lessons are plain, friendly and exact. They teach one idea, show a small example, name the common mistake, and never talk down to the player.

### Platforms

It is a web app (Vite + React + TypeScript) that runs **locally** on macOS, Windows and Linux. A tiny zero-dependency Node server serves the build on `localhost` and opens the default browser. Players start it by double-clicking `Reactor Quest.command` (macOS), `Reactor Quest.cmd` (Windows) or `reactor-quest.sh` (Linux), or with `npm start`. It can also be packaged as a real `Reactor Quest.app`, a Windows folder with a per-user installer (Start menu and desktop shortcuts), or a Linux folder whose installer adds a desktop entry. All three share one icon drawn in code. Progress is saved in the browser's `localStorage`. There is no backend and no network access at runtime.

### How to work through this recipe

1. Build in the order of the parts. Parts 1–4 give you a working engine you can test without any UI.
2. Wherever a file is given in full, **copy it exactly**. These files encode fixes for real bugs (see Part 17). Change them only if a newer library version forces you to.
3. Where a part gives a spec instead of code, follow the spec closely. Names of CSS classes, routes, labels and button text matter, because the browser bot in Part 14 drives the UI by them.
4. Every code level must be **proven**: its reference solution passes every check, and its starter code does not. The test suite enforces this, and it is your main tool for writing the curriculum.
5. Keep LF line endings everywhere except Windows `.cmd`/`.ps1` files (Part 11).

### Versions

These are the versions the original was built with. If one is unavailable, use the newest release of the same major version, then run the tests.

| Tool | Version |
|---|---|
| Node.js | 20.19 or newer (CI uses 22) |
| TypeScript | ~6.0.3 (both the project's compiler and the one shipped to the browser) |
| React / react-dom | ^19.3 |
| Vite | ^8.3 with @vitejs/plugin-react ^6.1 |
| Vitest | ^5.0 with jsdom ^29 |
| CodeMirror | 6 (`@codemirror/*` packages listed below), `@lezer/highlight` ^1.2 |
| playwright-core | ^1.63 (for the browser bot only) |

---

## Part 1. Project setup

### Folder layout

~~~~text
reactor-quest/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  .gitignore
  .gitattributes
  LICENSES.md
  README.md
  Reactor Quest.command      # macOS double-click launcher (chmod +x)
  Reactor Quest.cmd          # Windows double-click launcher (CRLF)
  reactor-quest.sh           # Linux launcher (chmod +x)
  src/
    main.tsx  App.tsx  styles.css  vite-env.d.ts
    engine/   checker.ts  compiler.ts  compiler.worker.ts  runtime.ts  grade.ts
    game/     types.ts  skills.ts  progress.ts  rewards.ts  items.ts  store.ts  sound.ts
    content/  index.ts  helpers.ts  review.ts  floor1.ts … floor10.ts
              code/<level-id>/starter.ts|tsx  and  solution.ts|tsx   (86 folders)
    screens/  TitleScreen  MapScreen  CodeLevelScreen  QuizScreen  ReviewScreen
              LootScreen  ShopScreen  CharacterScreen   (.tsx)
    ui/       router.ts  overlays.ts  themes.ts  ThemePicker.tsx  Hud.tsx  CodeEditor.tsx
              Preview.tsx  Markdown.tsx  highlight.tsx  Modal.tsx  Victory.tsx  Announcer.tsx
              BoxOpener.tsx  Offers.tsx  Companion.tsx  useLevelTimer.ts
    generated/typings.json   # built by tools/gen-typings.mjs, gitignored
  tests/      levels  review  explain  checker  runtime  progress  rewards  themes  markdown
  tools/      gen-typings.mjs  server.mjs  launch.mjs  packaging.mjs  icon.mjs
              make-mac-app.mjs  make-win-app.mjs  make-linux-app.mjs  smoke.mjs
~~~~

### Configuration files

`gen:typings` runs before `dev`, `build` and `test`, so the compiler always has its library files. `build` typechecks the whole project first.

**`package.json`**

~~~~json
{
  "name": "reactor-quest",
  "private": true,
  "version": "1.0.0",
  "description": "An interactive game that teaches TypeScript and React from zero to professional: repair a dark space station one typed component at a time, with a real TypeScript compiler and React runtime in the browser. Runs on macOS, Windows and Linux.",
  "type": "module",
  "license": "MIT",
  "engines": {
    "node": ">=20.19"
  },
  "scripts": {
    "gen:typings": "node tools/gen-typings.mjs",
    "predev": "npm run gen:typings",
    "dev": "vite",
    "prebuild": "npm run gen:typings",
    "build": "tsc --noEmit -p . && vite build",
    "start": "node tools/launch.mjs",
    "pretest": "npm run gen:typings",
    "test": "vitest run",
    "smoke": "node tools/smoke.mjs",
    "app:mac": "node tools/make-mac-app.mjs",
    "app:win": "node tools/make-win-app.mjs",
    "app:linux": "node tools/make-linux-app.mjs"
  },
  "dependencies": {
    "@codemirror/autocomplete": "^6.20.3",
    "@codemirror/commands": "^6.11.1",
    "@codemirror/lang-javascript": "^6.2.5",
    "@codemirror/language": "^6.12.4",
    "@codemirror/lint": "^6.9.7",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.13",
    "@lezer/highlight": "^1.2.5",
    "codemirror": "^6.0.2",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "typescript": "~6.0.3"
  },
  "devDependencies": {
    "@types/node": "^26.6.4",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^29.1.1",
    "playwright-core": "^1.63.0",
    "vite": "^8.3.2",
    "vitest": "^5.0.3"
  }
}
~~~~

The `exclude` of `src/content/code` matters: starter files are *meant* to contain type errors, and solutions import from `'./solution'` paths that only exist inside the game's virtual file system.

**`tsconfig.json`**

~~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["src/content/code"]
}
~~~~

`base: './'` makes the build work from any folder (the app packages serve it from a subfolder). `worker.format: 'es'` is needed for the module worker.

**`vite.config.ts`**

~~~~ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 12_000, // the TypeScript compiler is one big, lazily loaded chunk
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
~~~~

**`vitest.config.ts`**

~~~~ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // A starter that forgets to handle a failing request (which is the bug
    // its level teaches) leaves a rejection unhandled. Those are expected;
    // anything else is still reported.
    onUnhandledError: (error) => ((error as { levelFixture?: boolean } | null)?.levelFixture ? false : undefined),
  },
});
~~~~

**`index.html`**

~~~~html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Reactor — a TypeScript & React quest</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='none' stroke='%234fd1ff' stroke-width='4'/%3E%3Cellipse cx='32' cy='32' rx='28' ry='10' fill='none' stroke='%234fd1ff' stroke-width='3' transform='rotate(60 32 32)'/%3E%3Cellipse cx='32' cy='32' rx='28' ry='10' fill='none' stroke='%234fd1ff' stroke-width='3' transform='rotate(-60 32 32)'/%3E%3Ccircle cx='32' cy='32' r='6' fill='%23ffb347'/%3E%3C/svg%3E" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
~~~~

**`src/vite-env.d.ts`**

~~~~ts
/// <reference types="vite/client" />
~~~~

**`.gitignore`**

~~~~text
node_modules/
dist/
src/generated/
test-results/
*.app/
tests/_explain.test.ts
tests/_xp.test.ts
Reactor Quest (Windows)/
reactor-quest-linux/
*.zip
*.tar.gz
~~~~

**`.gitattributes`**

~~~~text
# Keep LF everywhere (Windows checkouts included), so the code levels and
# tests see exactly the same text on every OS. Windows scripts want CRLF.
* text=auto eol=lf
*.cmd text eol=crlf
*.ps1 text eol=crlf
*.png binary
*.ico binary
*.icns binary
~~~~

### Entry point

`initTheme()` paints the remembered colour profile before React renders, so the page never flashes the wrong colours. The heartbeat keeps the local server alive while a tab is open (Part 11).

**`src/main.tsx`**

~~~~tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { initTheme } from './ui/themes';

// Paint the remembered colour profile before the first render, so it never flashes.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// When the game is served by one of its app launchers, let the server know a tab
// is still open; it shuts itself down a minute after the last one closes.
// Anywhere else (the dev server, a static host) the first ping fails and stops.
function heartbeat() {
  fetch('./__heartbeat', { method: 'POST' })
    .then((r) => r.ok && setTimeout(heartbeat, 15_000))
    .catch(() => {});
}
heartbeat();
~~~~

### The typings generator

The browser compiler needs the TypeScript standard library (`lib.es2022`, `lib.dom`, `lib.dom.iterable` and everything they reference) plus React's type declarations. This script collects them into one JSON file, a map from virtual path to file text (about 4 MB), that the worker loads lazily. It imports `isMain` from `tools/server.mjs` (Part 11), so write that file too.

**`tools/gen-typings.mjs`**

~~~~js
// Collects every declaration file the in-browser TypeScript compiler needs —
// the ES2022 + DOM standard library and React's types — into one JSON map of
// virtual path → source. The game's checker mounts it as a read-only file
// system, so the player's code is type-checked exactly as `tsc` would.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { isMain } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

export const ROOT_LIBS = ['es2022', 'dom', 'dom.iterable'];

export function collectTypings() {
  const files = {};
  const tsLib = dirname(require.resolve('typescript/lib/lib.d.ts'));
  const pending = [...ROOT_LIBS];
  const seen = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const text = readFileSync(join(tsLib, `lib.${name}.d.ts`), 'utf8');
    files[`/lib/lib.${name}.d.ts`] = text;
    for (const m of text.matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"/g)) pending.push(m[1].toLowerCase());
  }

  const pkg = (name, entries) => {
    const dir = dirname(require.resolve(`${name}/package.json`));
    for (const entry of ['package.json', ...entries]) {
      files[`/node_modules/${name}/${entry}`] = readFileSync(join(dir, entry), 'utf8');
    }
  };
  pkg('@types/react', ['index.d.ts', 'global.d.ts', 'jsx-runtime.d.ts', 'jsx-dev-runtime.d.ts']);
  pkg('csstype', ['index.d.ts']);
  return files;
}

if (isMain(import.meta.url)) {
  const files = collectTypings();
  const out = join(root, 'src/generated/typings.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(files));
  const kb = Math.round(Object.values(files).reduce((n, s) => n + s.length, 0) / 1024);
  console.log(`typings: ${Object.keys(files).length} files, ${kb} KB → src/generated/typings.json`);
}
~~~~

**Check:** `npm install`, then `npm run gen:typings` prints something like `typings: 66 files, 3821 KB → src/generated/typings.json`.

---

## Part 2. The compiler in a Web Worker

The heart of the game is a TypeScript **LanguageService** over a virtual file system. The library files are mounted read-only and the player's files are swapped in on every request. Because the library never changes, the service keeps its parsed ASTs and a re-check takes tens of milliseconds. The same class answers hover tooltips (`quickInfo`) and autocomplete (`completions`).

Two compiler settings matter:

- **Type checking** uses `strict: true`, `noImplicitReturns`, `jsx: react-jsx`, ES2022 and DOM libs, and `types: []` (no ambient `@types`).
- **Emit** uses `ts.transpileModule` to **CommonJS**, so the sandbox can run the result with a fake `require`. A custom transformer, the **loop guard**, inserts `__loopGuard();` at the top of every loop body. Then a beginner's `while (true)` throws a friendly error instead of freezing the tab.

**`src/engine/checker.ts`**

~~~~ts
// The in-game TypeScript compiler. A LanguageService over a virtual file system:
// the standard library and React's types are mounted read-only, the player's
// files are swapped in on every run. Because the library files never change,
// the service keeps their parsed ASTs between runs and re-checks in milliseconds.
import ts from 'typescript';

export interface Diagnostic {
  file: string;
  line: number; // 1-based
  col: number; // 1-based
  from: number; // character offsets in the file, for editor squiggles
  to: number;
  message: string;
  code: number;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  js: Record<string, string>; // CommonJS output for each user file
}

/** What hovering a name shows: its type signature and any documentation. */
export interface QuickInfo {
  from: number;
  to: number;
  signature: string;
  doc: string;
}

export interface Completion {
  name: string;
  kind: string;
  /** Lower sorts first: locals, then members, then globals. */
  sort: string;
}

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noImplicitReturns: true,
  esModuleInterop: true,
  skipLibCheck: true,
  types: [],
  noEmit: true,
};

const EMIT_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
};

export class Checker {
  private readonly lib: Map<string, string>;
  private user = new Map<string, { text: string; version: number }>();
  private service: ts.LanguageService;

  constructor(typings: Record<string, string>) {
    this.lib = new Map(Object.entries(typings));
    const dirs = new Set<string>();
    for (const path of this.lib.keys()) {
      for (let d = path.slice(0, path.lastIndexOf('/')); d; d = d.slice(0, d.lastIndexOf('/'))) dirs.add(d);
    }
    const read = (p: string) => this.user.get(p)?.text ?? this.lib.get(p);
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => COMPILER_OPTIONS,
      getScriptFileNames: () => [...this.user.keys()],
      getScriptVersion: (p) => String(this.user.get(p)?.version ?? 0),
      getScriptSnapshot: (p) => {
        const text = read(p);
        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => '/',
      getDefaultLibFileName: () => '/lib/lib.d.ts',
      fileExists: (p) => read(p) !== undefined,
      readFile: read,
      directoryExists: (d) => d === '/' || dirs.has(d.replace(/\/$/, '')) || [...this.user.keys()].some((k) => k.startsWith(d)),
      getDirectories: () => [],
      useCaseSensitiveFileNames: () => true,
    };
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  /** Swap in the player's files, bumping versions only for files that changed. */
  private setFiles(files: Record<string, string>) {
    const next = new Map<string, { text: string; version: number }>();
    for (const [path, text] of Object.entries(files)) {
      const prev = this.user.get(path);
      next.set(path, { text, version: prev ? (prev.text === text ? prev.version : prev.version + 1) : 1 });
    }
    this.user = next;
  }

  /** Type-check `files` (paths like "/solution.tsx") and transpile each to CommonJS. */
  check(files: Record<string, string>): CheckResult {
    this.setFiles(files);

    const diagnostics: Diagnostic[] = [];
    const js: Record<string, string> = {};
    for (const path of Object.keys(files)) {
      const sf = this.service.getProgram()?.getSourceFile(path);
      const all = [...this.service.getSyntacticDiagnostics(path), ...this.service.getSemanticDiagnostics(path)];
      for (const d of all) diagnostics.push(toDiagnostic(path, d, sf));
      js[path] = ts.transpileModule(files[path], {
        compilerOptions: EMIT_OPTIONS,
        fileName: path,
        transformers: { before: [loopGuard] },
      }).outputText;
    }
    return { diagnostics, js };
  }

  /** The type of whatever is at `pos` — what an IDE shows on hover. */
  quickInfo(files: Record<string, string>, path: string, pos: number): QuickInfo | null {
    this.setFiles(files);
    const info = this.service.getQuickInfoAtPosition(path, pos);
    if (!info) return null;
    const signature = ts.displayPartsToString(info.displayParts);
    if (!signature) return null;
    return {
      from: info.textSpan.start,
      to: info.textSpan.start + info.textSpan.length,
      signature,
      doc: ts.displayPartsToString(info.documentation).split(/\n\s*\n/)[0].trim(),
    };
  }

  /** Completions at `pos`: members after a dot, otherwise everything in scope. */
  completions(files: Record<string, string>, path: string, pos: number): Completion[] {
    this.setFiles(files);
    const result = this.service.getCompletionsAtPosition(path, pos, { includeCompletionsWithInsertText: true });
    if (!result) return [];
    return result.entries
      .filter((e) => !e.name.startsWith('__'))
      .map((e) => ({ name: e.name, kind: e.kind, sort: e.sortText }));
  }
}

/** The name of the sandbox function every loop calls on each iteration. */
export const LOOP_GUARD = '__loopGuard';

/**
 * Rewrites every loop so its body starts with `__loopGuard();`. The sandbox's
 * guard throws if one synchronous run has been looping for too long, so a
 * beginner's `while (true)` stops with a message instead of freezing the tab.
 */
const loopGuard: ts.TransformerFactory<ts.SourceFile> = (context) => {
  const f = context.factory;
  const guard = () => f.createExpressionStatement(f.createCallExpression(f.createIdentifier(LOOP_GUARD), undefined, []));
  const guarded = (body: ts.Statement) => f.createBlock([guard(), ...(ts.isBlock(body) ? body.statements : [body])], true);
  const visit = (node: ts.Node): ts.Node => {
    const n = ts.visitEachChild(node, visit, context);
    if (ts.isWhileStatement(n)) return f.updateWhileStatement(n, n.expression, guarded(n.statement));
    if (ts.isDoStatement(n)) return f.updateDoStatement(n, guarded(n.statement), n.expression);
    if (ts.isForStatement(n)) return f.updateForStatement(n, n.initializer, n.condition, n.incrementor, guarded(n.statement));
    if (ts.isForOfStatement(n)) return f.updateForOfStatement(n, n.awaitModifier, n.initializer, n.expression, guarded(n.statement));
    if (ts.isForInStatement(n)) return f.updateForInStatement(n, n.initializer, n.expression, guarded(n.statement));
    return n;
  };
  return (sf) => ts.visitNode(sf, visit) as ts.SourceFile;
};

function toDiagnostic(file: string, d: ts.Diagnostic, sf: ts.SourceFile | undefined): Diagnostic {
  const start = d.start ?? 0;
  const pos = sf ? sf.getLineAndCharacterOfPosition(start) : { line: 0, character: 0 };
  return {
    file,
    line: pos.line + 1,
    col: pos.character + 1,
    from: start,
    to: start + Math.max(1, d.length ?? 1),
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    code: d.code,
  };
}
~~~~

The worker loads the typings with a dynamic `import()`, so the 4 MB JSON becomes its own chunk. It warms up by checking a one-line file, then posts `{ ready: true }`:

**`src/engine/compiler.worker.ts`**

~~~~ts
// Hosts the TypeScript compiler off the main thread. The first request waits
// for the ~4 MB of standard-library typings to load; after that each request
// is incremental and takes tens of milliseconds.
import { Checker } from './checker';

export type WorkerRequest =
  | { id: number; kind: 'check'; files: Record<string, string> }
  | { id: number; kind: 'info' | 'complete'; files: Record<string, string>; path: string; pos: number };
export type WorkerResponse = { id: number; result?: unknown; error?: string } | { ready: true };

let checker: Promise<Checker> | null = null;

function getChecker() {
  checker ??= import('../generated/typings.json').then((m) => {
    const c = new Checker(m.default as Record<string, string>);
    c.check({ '/warmup.tsx': 'export const x: number = 1;\n' }); // parse the libs now, not on first Run
    (self as unknown as Worker).postMessage({ ready: true } satisfies WorkerResponse);
    return c;
  });
  return checker;
}

getChecker();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    const c = await getChecker();
    const result =
      req.kind === 'check' ? c.check(req.files)
      : req.kind === 'info' ? c.quickInfo(req.files, req.path, req.pos)
      : c.completions(req.files, req.path, req.pos);
    (self as unknown as Worker).postMessage({ id: req.id, result } satisfies WorkerResponse);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: req.id, error: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
  }
};
~~~~

The main thread talks to it through promises keyed by request id:

**`src/engine/compiler.ts`**

~~~~ts
// Main-thread handle on the compiler worker.
import type { CheckResult, Completion, QuickInfo } from './checker';
import type { WorkerRequest, WorkerResponse } from './compiler.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: any) => void; reject: (e: Error) => void }>();
let ready = false;
const readyListeners = new Set<() => void>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if ('ready' in msg) {
      ready = true;
      readyListeners.forEach((l) => l());
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error !== undefined) p.reject(new Error(msg.error));
    else p.resolve(msg.result);
  };
  return worker;
}

/** Start loading the compiler in the background. */
export function warmUp() {
  getWorker();
}

export function isReady() {
  return ready;
}

export function onReady(listener: () => void): () => void {
  if (ready) listener();
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function request<T>(req: DistributiveOmit<WorkerRequest, 'id'>): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export function compile(files: Record<string, string>): Promise<CheckResult> {
  return request({ kind: 'check', files });
}

/** The type at a position in `path` — for hover tooltips. */
export function quickInfo(files: Record<string, string>, path: string, pos: number): Promise<QuickInfo | null> {
  return request({ kind: 'info', files, path, pos });
}

/** Completions at a position in `path` — for autocomplete. */
export function completions(files: Record<string, string>, path: string, pos: number): Promise<Completion[]> {
  return request({ kind: 'complete', files, path, pos });
}
~~~~

The UI calls `warmUp()` as soon as the app mounts, so the compiler is usually ready before the player first presses Run. While it isn't, the level screen shows "Loading compiler…".

---

## Part 3. The sandbox and the testing kit

`runtime.ts` does three jobs:

1. **Sandbox**: it runs the player's CommonJS output with `new Function`, passing in a `require` that only knows `react` and `react/jsx-runtime`, and sandboxed globals: `console` (captured into the check's log), `setTimeout`/`setInterval`/`clear*` (tracked, so a check can count live timers and everything is cleared afterwards), and `__loopGuard`.
2. **Assertions**: a small `expect` with readable failure messages ("Expected 3 to be 4"), plus mock functions (`fn`).
3. **Stage**: it renders a React element into a real off-screen DOM node with React 19, and gives checks a tiny testing-library: `get`, `query`, `getByText`, `click`, `type`, `submit`, `key`, `focus`, `rerender`, `unmount`, `text()`. It also catches errors React reports from event handlers, unhandled promise rejections, and forms that would reload the page, and turns each of them into a failed check with a helpful message.

**`src/engine/runtime.ts`**

~~~~ts
// Runs the player's transpiled code and gives level checks a small, friendly
// testing kit: render a component for real (React 19 + react-dom), click it,
// type into it, read what it shows, and assert with readable failure messages.
import * as React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export type Module = Record<string, any>;

export class CheckFailure extends Error {}

const MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': JSXRuntime,
  'react/jsx-dev-runtime': JSXRuntime,
};

const LOOP_LIMIT_MS = 1500;

/**
 * Everything the player's module can reach that we need to observe or undo:
 * console output, and timers — so a forgotten setInterval can be counted by a
 * check and is always cleared when the code is replaced.
 */
export class Sandbox {
  private timers = new Map<number, 'timeout' | 'interval'>();
  constructor(readonly log: (line: string) => void = () => {}) {}

  get activeTimers() {
    return this.timers.size;
  }

  clearAll() {
    for (const [id, kind] of this.timers) (kind === 'interval' ? clearInterval : clearTimeout)(id);
    this.timers.clear();
  }

  globals() {
    const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : show(a))).join(' ');
    // Counts loop iterations within one synchronous run; a microtask resets it
    // as soon as the code yields, so only a loop that never lets go trips it.
    let iterations = 0;
    let started = 0;
    let armed = false;
    const loopGuard = () => {
      if (!armed) {
        armed = true;
        started = performance.now();
        queueMicrotask(() => {
          armed = false;
          iterations = 0;
        });
      }
      if ((++iterations & 0x3fff) === 0 && performance.now() - started > LOOP_LIMIT_MS) {
        armed = false;
        iterations = 0;
        throw new RangeError(`A loop has been running for over ${LOOP_LIMIT_MS / 1000} seconds without stopping. Check that its condition eventually becomes false (or that the counter changes each time round).`);
      }
    };
    return {
      __loopGuard: loopGuard,
      console: {
        log: (...a: unknown[]) => this.log(fmt(a)),
        info: (...a: unknown[]) => this.log(fmt(a)),
        warn: (...a: unknown[]) => this.log(`⚠ ${fmt(a)}`),
        error: (...a: unknown[]) => this.log(`✖ ${fmt(a)}`),
      },
      setTimeout: (cb: () => void, ms?: number, ...args: unknown[]) => {
        const id = window.setTimeout(() => {
          this.timers.delete(id);
          (cb as (...a: unknown[]) => void)(...args);
        }, ms);
        this.timers.set(id, 'timeout');
        return id;
      },
      setInterval: (cb: () => void, ms?: number, ...args: unknown[]) => {
        const id = window.setInterval(cb, ms, ...args);
        this.timers.set(id, 'interval');
        return id;
      },
      clearTimeout: (id?: number) => {
        if (id !== undefined) this.timers.delete(id);
        window.clearTimeout(id);
      },
      clearInterval: (id?: number) => {
        if (id !== undefined) this.timers.delete(id);
        window.clearInterval(id);
      },
    };
  }
}

/** Evaluate CommonJS output inside a sandbox's globals. */
export function loadModule(js: string, sandbox: Sandbox = new Sandbox()): Module {
  const module = { exports: {} as Module };
  const require = (name: string) => {
    if (name in MODULES) return MODULES[name];
    throw new Error(`Cannot find module '${name}'. On this station only 'react' is installed.`);
  };
  const globals = sandbox.globals();
  const names = Object.keys(globals);
  new Function('require', 'exports', 'module', ...names, js)(require, module.exports, module, ...names.map((n) => globals[n as keyof typeof globals]));
  return module.exports;
}

/** A short, readable rendering of any value for failure messages. */
export function show(v: unknown, depth = 0): string {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : `"${v}"`;
  if (typeof v === 'function') return `function ${v.name || '(anonymous)'}`;
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' && Number.isNaN(v)) return 'NaN';
  if (v instanceof Element) return `<${v.tagName.toLowerCase()}>`;
  if (Array.isArray(v)) return depth > 2 ? '[…]' : `[${v.map((x) => show(x, depth + 1)).join(', ')}]`;
  if (v && typeof v === 'object') {
    if (depth > 2) return '{…}';
    const body = Object.entries(v).map(([k, x]) => `${k}: ${show(x, depth + 1)}`).join(', ');
    return `{ ${body} }`;
  }
  return String(v);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => (a as any)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as any)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as any)[k], (b as any)[k]));
}

export interface Mock<A extends unknown[] = any[], R = any> {
  (...args: A): R;
  calls: A[];
}

function isMock(v: unknown): v is Mock {
  return typeof v === 'function' && Array.isArray((v as Mock).calls);
}

export interface Matchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(item: unknown): void;
  toMatch(re: RegExp): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeType(type: string): void;
  toHaveLength(n: number): void;
  toBeGreaterThan(n: number): void;
  toBeCalledTimes(n: number): void;
  toBeCalledWith(...args: unknown[]): void;
  toThrow(): void;
}

export function expect(actual: unknown): Matchers & { not: Matchers };
export function expect(actual: unknown, negate: true): Matchers;
export function expect(actual: unknown, negate = false): Matchers {
  const assert = (ok: boolean, msg: string) => {
    if (ok === negate) throw new CheckFailure(negate ? msg.replace(/\bto\b/, 'not to') : msg);
  };
  const matchers: Matchers = {
    toBe: (expected: unknown) => assert(Object.is(actual, expected), `Expected ${show(actual)} to be ${show(expected)}`),
    toEqual: (expected: unknown) => assert(deepEqual(actual, expected), `Expected ${show(actual)} to equal ${show(expected)}`),
    toContain: (item: unknown) =>
      assert(
        typeof actual === 'string' ? actual.includes(String(item)) : Array.isArray(actual) && actual.some((x) => deepEqual(x, item)),
        `Expected ${show(actual)} to contain ${show(item)}`,
      ),
    toMatch: (re: RegExp) => assert(typeof actual === 'string' && re.test(actual), `Expected ${show(actual)} to match ${re}`),
    toBeTruthy: () => assert(!!actual, `Expected ${show(actual)} to be truthy`),
    toBeFalsy: () => assert(!actual, `Expected ${show(actual)} to be falsy`),
    toBeNull: () => assert(actual === null, `Expected ${show(actual)} to be null`),
    toBeType: (type: string) => assert(typeof actual === type, `Expected ${show(actual)} to be a ${type}`),
    toHaveLength: (n: number) => assert((actual as { length?: number })?.length === n, `Expected ${show(actual)} to have length ${n}`),
    toBeGreaterThan: (n: number) => assert((actual as number) > n, `Expected ${show(actual)} to be greater than ${n}`),
    toBeCalledTimes: (n: number) => {
      if (!isMock(actual)) throw new CheckFailure('Expected a mock function');
      assert(actual.calls.length === n, `Expected the function to be called ${n} time(s), but it was called ${actual.calls.length} time(s)`);
    },
    toBeCalledWith: (...args: unknown[]) => {
      if (!isMock(actual)) throw new CheckFailure('Expected a mock function');
      const last = actual.calls.at(-1);
      assert(!!last && deepEqual(last, args), `Expected the function to be called with (${args.map((a) => show(a)).join(', ')}), but got ${last ? `(${last.map((a) => show(a)).join(', ')})` : 'no calls'}`);
    },
    toThrow: () => {
      let threw = false;
      try { (actual as () => unknown)(); } catch { threw = true; }
      assert(threw, 'Expected the call to throw');
    },
  };
  return negate ? matchers : Object.assign(matchers, { not: expect(actual, true) });
}

export function fn<A extends unknown[] = any[], R = any>(impl?: (...args: A) => R): Mock<A, R> {
  const mock = ((...args: A) => {
    mock.calls.push(args);
    return impl?.(...args) as R;
  }) as Mock<A, R>;
  mock.calls = [];
  return mock;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Let React finish whatever an event scheduled: microtasks, then a macrotask. */
export const settle = async () => {
  for (let i = 0; i < 3; i++) await wait(0);
};

export interface View {
  container: HTMLElement;
  text(): string;
  query<E extends Element = HTMLElement>(selector: string): E | null;
  queryAll<E extends Element = HTMLElement>(selector: string): E[];
  get<E extends Element = HTMLElement>(selector: string): E;
  getByText(text: string | RegExp, selector?: string): HTMLElement;
  click(target: Element | string): Promise<void>;
  type(target: Element | string, value: string): Promise<void>;
  submit(target?: Element | string): Promise<void>;
  rerender(el: React.ReactElement): Promise<void>;
  unmount(): Promise<void>;
  /** Press a key on an element (keydown, then keyup), e.g. 'ArrowRight', 'Enter', 'Escape'. */
  key(target: Element | string, key: string): Promise<void>;
  focus(target: Element | string): Promise<void>;
}

type Target = Element | string;

/** How many check stages are live — the preview ignores window errors while checks own them. */
export const activity = { stages: 0 };

export class Stage {
  private roots: { root: Root; host: HTMLElement }[] = [];
  private error: unknown = null;
  private reloaded = false;
  // React reports errors thrown in event handlers with reportError(), which
  // surfaces as a window "error" event. Claim those so they fail the check.
  private onWindowError = (e: ErrorEvent) => {
    e.preventDefault();
    this.error ??= e.error ?? new Error(e.message);
  };

  // A promise the player's code let fail with nothing to handle it.
  private onRejection = (e: PromiseRejectionEvent) => {
    e.preventDefault();
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    this.error ??= new CheckFailure(`A promise failed and nothing handled it: ${reason}. Add a .catch() or a second .then() callback (or try/catch around await).`);
  };

  constructor() {
    activity.stages++;
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  async render(el: React.ReactElement): Promise<View> {
    const host = document.createElement('div');
    host.setAttribute('data-test-host', '');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;width:800px';
    document.body.appendChild(host);
    const root = createRoot(host, {
      onUncaughtError: (e) => { this.error ??= e; },
      // An error caught by the player's own error boundary is handled, not a failure.
      onCaughtError: () => {},
    });
    this.roots.push({ root, host });
    // Registered after createRoot, so it runs after React's own listener: if the
    // player's onSubmit didn't prevent the default, note it — and prevent it
    // ourselves, so a buggy form can never reload the game.
    host.addEventListener('submit', (e) => {
      if (!e.defaultPrevented) this.reloaded = true;
      e.preventDefault();
    });
    const commit = async (node: React.ReactElement) => {
      flushSync(() => root.render(node));
      await settle();
      this.rethrow();
    };
    await commit(el);

    const find = <E extends Element>(t: Target | null | undefined): E => {
      if (t == null) throw new CheckFailure(`Expected an element that isn't on screen. Rendered: ${snippet(host)}`);
      if (typeof t !== 'string') return t as E;
      const found = host.querySelector<E>(t);
      if (!found) throw new CheckFailure(`Couldn't find any <${t}> on screen. Rendered: ${snippet(host)}`);
      return found;
    };
    const after = async () => { await settle(); this.rethrow(); };

    return {
      container: host,
      text: () => (host.textContent ?? '').replace(/\s+/g, ' ').trim(),
      query: (s) => host.querySelector(s),
      queryAll: <E extends Element>(s: string) => [...host.querySelectorAll<E>(s)],
      get: (s) => find(s),
      getByText: (text, selector = '*') => {
        const match = (s: string) => (typeof text === 'string' ? s.trim() === text : text.test(s));
        const all = [...host.querySelectorAll<HTMLElement>(selector)].filter((e) => match(e.textContent ?? ''));
        // The innermost matching element, so getByText('Save') returns the <button>, not its parents.
        const hit = all.find((e) => !all.some((o) => o !== e && e.contains(o)));
        if (!hit) throw new CheckFailure(`Couldn't find ${typeof text === 'string' ? `"${text}"` : text} on screen. Rendered: ${snippet(host)}`);
        return hit;
      },
      click: async (t) => {
        const el = find<HTMLElement>(t);
        if ((el as HTMLButtonElement).disabled) throw new CheckFailure(`Tried to click ${describe(el)}, but it is disabled.`);
        el.click();
        await after();
      },
      type: async (t, value) => {
        const input = find<HTMLInputElement>(t);
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        // React tracks the last value it saw; set through the native setter so it notices the change.
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await after();
      },
      submit: async (t = 'form') => {
        find<HTMLFormElement>(t).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await after();
      },
      rerender: (node) => commit(node),
      key: async (t, key) => {
        const el = find<HTMLElement>(t);
        const init = { key, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', init));
        el.dispatchEvent(new KeyboardEvent('keyup', init));
        await after();
      },
      focus: async (t) => {
        find<HTMLElement>(t).focus();
        await after();
      },
      unmount: async () => {
        root.unmount();
        await settle();
      },
    };
  }

  rethrow() {
    if (this.reloaded) {
      this.reloaded = false;
      throw new CheckFailure('The form submitted and would reload the page — call event.preventDefault() in onSubmit.');
    }
    if (this.error) {
      const e = this.error;
      this.error = null;
      throw e;
    }
  }

  cleanup() {
    for (const { root, host } of this.roots) {
      try { root.unmount(); } catch { /* already torn down */ }
      host.remove();
    }
    this.roots = [];
    this.error = null;
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onRejection);
    activity.stages--;
  }
}

function describe(el: Element) {
  const text = (el.textContent ?? '').trim();
  return `<${el.tagName.toLowerCase()}>${text ? ` "${text}"` : ''}`;
}

function snippet(host: HTMLElement) {
  const html = host.innerHTML.replace(/\s+/g, ' ');
  return html ? (html.length > 160 ? `${html.slice(0, 160)}…` : html) : '(nothing)';
}
~~~~

---

## Part 4. The level format and grading

### Types

**`src/game/types.ts`**

~~~~ts
import type { ReactElement, ReactNode, createElement } from 'react';
import type { Module, View, Mock, expect as expectFn } from '../engine/runtime';
import type { SkillId } from './skills';

/** Everything a level check gets to work with. */
export interface Kit {
  /** The player's exports. */
  mod: Module;
  /** The player's source, for checks like "uses .map()". */
  source: string;
  h: typeof createElement;
  expect: typeof expectFn;
  render(el: ReactElement): Promise<View>;
  fn<A extends unknown[] = any[], R = any>(impl?: (...args: A) => R): Mock<A, R>;
  wait(ms: number): Promise<void>;
  /** How many timers the player's code has started and not yet cleared. */
  activeTimers(): number;
  /** Every line the player's code has printed with console.log, so far. */
  logs: string[];
}

export interface Check {
  label: string;
  run(kit: Kit): void | Promise<void>;
}

/**
 * A type-level check: a TypeScript file that imports from './solution' and must
 * compile cleanly. Use `// @ts-expect-error` above lines your types must reject.
 */
export interface TypeCheck {
  label: string;
  code: string;
}

interface LevelBase {
  id: string;
  title: string;
  /** The station system this level restores — flavour for the map. */
  system: string;
  /** Story: what's broken and what ARIA asks of you. Mini-markdown. */
  brief: string;
  /** The concept, taught. Mini-markdown with code blocks. */
  lesson: string;
  /** The skills this level trains. */
  skills: SkillId[];
}

export interface CodeLevel extends LevelBase {
  kind: 'code';
  file: 'solution.ts' | 'solution.tsx';
  starter: string;
  solution: string;
  hints: string[];
  checks: Check[];
  typeChecks?: TypeCheck[];
  /** Render something live in the preview pane from the player's module. `log` writes to the console panel. */
  preview?: (mod: Module, h: typeof createElement, log: (line: string) => void) => ReactNode;
  boss?: boolean;
}

export interface Question {
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface QuizLevel extends LevelBase {
  kind: 'quiz';
  questions: Question[];
}

export type Level = CodeLevel | QuizLevel;

export interface Deck {
  id: string;
  name: string;
  subtitle: string;
  /** One line on what you can do once this floor is cleared — shown on the map. */
  outcome: string;
  /** Accent colour for the deck on the map. */
  hue: number;
  levels: Level[];
}

/** A "does this compile?" review card. */
export interface CompileCard {
  code: string;
  /** Does this compile under strict mode? */
  ok: boolean;
  /** The level that teaches this card's idea: the card unlocks when it's cleared. */
  after: string;
  why: string;
}

/** One spaced-review question. */
export interface ReviewItem {
  id: string;
  /** The level whose clear unlocks this question. */
  after: string;
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explain: string;
}
~~~~

### Content helpers

Each code level's starter and solution are **real `.ts`/`.tsx` files** in `src/content/code/<level-id>/`, loaded as raw strings with Vite's `import.meta.glob(..., { query: '?raw' })`. They read like code rather than escaped strings, and you can open them in an editor. The helpers also give checks friendly failure messages.

**`src/content/helpers.ts`**

~~~~ts
import type { ComponentType } from 'react';
import { CheckFailure, type Module } from '../engine/runtime';
import type { CodeLevel } from '../game/types';

// Starter and solution files live beside this module in code/<level-id>/, as
// real .ts/.tsx files, so they read like code rather than escaped strings.
const files = import.meta.glob<string>('./code/*/*', { query: '?raw', import: 'default', eager: true });

export function codeFiles(id: string, ext: 'ts' | 'tsx'): Pick<CodeLevel, 'starter' | 'solution' | 'file'> {
  const starter = files[`./code/${id}/starter.${ext}`];
  const solution = files[`./code/${id}/solution.${ext}`];
  if (starter === undefined || solution === undefined) throw new Error(`Missing code files for level ${id}`);
  return { starter, solution, file: `solution.${ext}` };
}

/** An exported function from the player's module, or a clear failure if it isn't there. */
export function fnOf<T = (...args: any[]) => any>(mod: Module, name: string): T {
  const v = mod[name];
  if (typeof v !== 'function') {
    throw new CheckFailure(v === undefined ? `Nothing named "${name}" is exported. Did you write \`export\` in front of it?` : `"${name}" is exported, but it isn't a function.`);
  }
  return v as T;
}

export const comp = (mod: Module, name: string) => fnOf<ComponentType<any>>(mod, name);

/** Source text with comments stripped, for checks like "uses useState". */
export const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The nth line the player's code printed, or a clear failure if it never got that far. */
export function line(logs: string[], n: number): string {
  if (logs.length <= n) {
    throw new CheckFailure(
      logs.length === 0
        ? 'Nothing was printed. Use console.log(...) to print something.'
        : `Only ${logs.length} line${logs.length > 1 ? 's were' : ' was'} printed — expected at least ${n + 1}.`,
    );
  }
  return logs[n];
}

/** Fail with a friendly message unless the (comment-free) source matches. */
export function mustUse(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(code(source))) throw new CheckFailure(message);
}

/** Fail if the (comment-free) source contains something it shouldn't. */
export function mustNotUse(source: string, pattern: RegExp, message: string) {
  if (pattern.test(code(source))) throw new CheckFailure(message);
}

/**
 * An error a check throws on purpose (a fake server failing, say). It's tagged
 * so the test runner can tell an expected rejection that a starter forgot to
 * handle from a real bug.
 */
export function fixtureError(message: string): Error {
  return Object.assign(new Error(message), { levelFixture: true });
}
~~~~

**`src/content/index.ts`**

~~~~ts
import type { Deck, Level } from '../game/types';
import { floor1 } from './floor1';
import { floor2 } from './floor2';
import { floor3 } from './floor3';
import { floor4 } from './floor4';
import { floor5 } from './floor5';
import { floor6 } from './floor6';
import { floor7 } from './floor7';
import { floor8 } from './floor8';
import { floor9 } from './floor9';
import { floor10 } from './floor10';

/** The floors of the station, in play order. */
export const DECKS: Deck[] = [floor1, floor2, floor3, floor4, floor5, floor6, floor7, floor8, floor9, floor10];

export const ALL_LEVELS: Level[] = DECKS.flatMap((d) => d.levels);

export function findLevel(id: string): { deck: Deck; level: Level; index: number } | undefined {
  for (const deck of DECKS) {
    const index = deck.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { deck, level: deck.levels[index], index };
  }
  return undefined;
}
~~~~

### Grading

`grade()` compiles the player's file **together with each hidden type check** (a file `/__typecheck_<n>.tsx` that imports from `'./solution'`). It then loads the module once and runs every behaviour check in its own `Stage`, with a 4-second timeout per check. A type check passes when its file compiles cleanly. Diagnostic code **2578** ("Unused '@ts-expect-error' directive") means the player's types accepted something they must reject, and gets its own message.

**`src/engine/grade.ts`**

~~~~ts
// Grading a code level: type-check the player's file plus each hidden type
// check, then run every behavioural check against the real module.
import { createElement } from 'react';
import type { CodeLevel, Kit } from '../game/types';
import type { CheckResult, Diagnostic } from './checker';
import { CheckFailure, Sandbox, Stage, expect, fn, loadModule, wait } from './runtime';

export type Compile = (files: Record<string, string>) => Promise<CheckResult>;

export interface CheckOutcome {
  label: string;
  pass: boolean;
  message?: string;
}

export interface Report {
  /** The player's file, compiled to CommonJS — for the live preview. */
  js: string;
  typeErrors: Diagnostic[];
  typeChecks: CheckOutcome[];
  checks: CheckOutcome[];
  logs: string[];
  /** The module failed to load at all (a throw at top level). */
  loadError?: string;
  passed: boolean;
}

const CHECK_TIMEOUT_MS = 4000;

export const typeCheckPath = (i: number) => `/__typecheck_${i}.tsx`;

export async function grade(level: CodeLevel, source: string, compile: Compile): Promise<Report> {
  const mainPath = `/${level.file}`;
  const files: Record<string, string> = { [mainPath]: source };
  (level.typeChecks ?? []).forEach((tc, i) => (files[typeCheckPath(i)] = tc.code));
  const { diagnostics, js } = await compile(files);

  const typeErrors = diagnostics.filter((d) => d.file === mainPath);
  const typeChecks: CheckOutcome[] = (level.typeChecks ?? []).map((tc, i) => {
    const errs = diagnostics.filter((d) => d.file === typeCheckPath(i));
    if (!errs.length) return { label: tc.label, pass: true };
    const unused = errs.find((d) => d.code === 2578);
    return {
      label: tc.label,
      pass: false,
      message: unused
        ? 'This should be rejected by the compiler, but your types allow it.'
        : `Your types reject code that should be allowed: ${errs[0].message}`,
    };
  });

  const logs: string[] = [];
  const sandbox = new Sandbox((l) => logs.push(l));
  let mod: Record<string, any>;
  try {
    mod = loadModule(js[mainPath], sandbox);
  } catch (e) {
    const loadError = errorText(e);
    return {
      js: js[mainPath], typeErrors, typeChecks, logs, loadError, passed: false,
      checks: level.checks.map((c) => ({ label: c.label, pass: false, message: 'Your code crashed before this could run.' })),
    };
  }

  const checks: CheckOutcome[] = [];
  for (const check of level.checks) {
    const stage = new Stage();
    const kit: Kit = { mod, source, h: createElement, expect, fn, wait, render: (el) => stage.render(el), activeTimers: () => sandbox.activeTimers, logs };
    try {
      await withTimeout(Promise.resolve().then(() => check.run(kit)), CHECK_TIMEOUT_MS);
      checks.push({ label: check.label, pass: true });
    } catch (e) {
      checks.push({ label: check.label, pass: false, message: errorText(e) });
    } finally {
      stage.cleanup();
      sandbox.clearAll();
    }
  }

  const passed = !typeErrors.length && typeChecks.every((c) => c.pass) && checks.every((c) => c.pass);
  return { js: js[mainPath], typeErrors, typeChecks, checks, logs, passed };
}

function errorText(e: unknown): string {
  if (e instanceof CheckFailure) return e.message;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new CheckFailure(`Timed out after ${ms / 1000}s — is something waiting forever?`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
~~~~

### Plain-English compiler errors

The compiler's messages are exact but written for people who already know the vocabulary. For the mistakes beginners make most, one extra sentence says what went wrong and what to try. The original message is always shown too, because learning to read it is part of the point. It is shown under each type error in the results panel and in the editor's error tooltip. Unknown codes get nothing rather than a guess.

**`src/engine/explain.ts`**

~~~~ts
// Compiler errors, in plain English. The TypeScript compiler is precise but
// terse, and its messages are written for people who already know the
// vocabulary. For the mistakes beginners make most, this adds one sentence
// that says what went wrong and what to try. The original message is always
// shown too: learning to read it is part of the point.

type Explainer = (m: RegExpMatchArray | null, message: string) => string | null;

const short = (type: string) => (type.length > 40 ? 'a different type' : `\`${type}\``);
const didYouMean = (message: string) => message.match(/Did you mean '([^']+)'\?/)?.[1];

const EXPLAIN: Record<number, [RegExp | null, Explainer]> = {
  2322: [/^Type '(.+?)' is not assignable to type '(.+?)'\./, (m, msg) => {
    const fix = didYouMean(msg);
    if (fix) return `Probably a typo: did you mean \`${fix}\`?`;
    if (m && m[1].endsWith('| undefined')) return 'This value might be `undefined`, but it has to be there. Check that it exists first (an `if`), or give a fallback with `??`.';
    return m ? `This is ${short(m[1])}, but the code promised ${short(m[2])} here. Change the value, or the type it's going into.` : null;
  }],
  2345: [/^Argument of type '(.+?)' is not assignable to parameter of type '(.+?)'\./, (m) =>
    m ? `You passed ${short(m[1])} to a function that expects ${short(m[2])}.` : null],
  2339: [/^Property '(.+?)' does not exist on type '(.+?)'\./, (m) =>
    m ? `\`${m[1]}\` isn't something this value has. Check the spelling (capitals count). If the value could be one of several types, check which one it is first.` : null],
  2551: [/^Property '(.+?)' does not exist/, (m, msg) => `Probably a typo: you wrote \`${m?.[1]}\`, did you mean \`${didYouMean(msg)}\`?`],
  2304: [/^Cannot find name '(.+?)'\./, (m) =>
    m ? `Nothing called \`${m[1]}\` exists here. Check the spelling (capitals count), or create it before you use it.` : null],
  2552: [/^Cannot find name '(.+?)'\./, (m, msg) => `Probably a typo: you wrote \`${m?.[1]}\`, did you mean \`${didYouMean(msg)}\`?`],
  2588: [/^Cannot assign to '(.+?)'/, (m) =>
    `\`${m?.[1]}\` was made with \`const\`, so it can never change. If it needs to change, make it with \`let\`.`],
  7006: [/^Parameter '(.+?)'/, (m) =>
    `Say what type \`${m?.[1]}\` is, like \`(${m?.[1]}: number)\`. Without it, TypeScript can't check anything you do with it.`],
  7031: [/^Binding element '(.+?)'/, (m) => `Say what type \`${m?.[1]}\` is: add a type after the \`{ … }\`, like \`({ name }: { name: string })\`.`],
  18046: [/^'(.+?)' is of type 'unknown'/, (m) =>
    `\`${m?.[1]}\` could be anything, so you have to check what it is before you use it: \`typeof ${m?.[1]} === "string"\`, \`Array.isArray(${m?.[1]})\`, and so on.`],
  18047: [/^'(.+?)' is possibly 'null'/, (m) =>
    `\`${m?.[1]}\` might be \`null\`. Check it first (\`if (${m?.[1]}) { … }\`), or use \`?.\` to skip it when it's missing.`],
  18048: [/^'(.+?)' is possibly 'undefined'/, (m) =>
    `\`${m?.[1]}\` might be \`undefined\`. Check it first (\`if (${m?.[1]}) { … }\`), use \`?.\`, or give a fallback with \`??\`.`],
  2532: [null, () => 'This might be `undefined`. Check it first, or use `?.` to skip it when it\'s missing.'],
  2554: [/^Expected (\d+) arguments?, but got (\d+)/, (m) =>
    m ? `This function takes ${m[1]} input${m[1] === '1' ? '' : 's'} and you gave it ${m[2]}.` : null],
  2366: [null, () => 'Some way through this function ends without a `return`. Make sure every path (every `if` and `else`) returns a value.'],
  7030: [null, () => 'Some way through this function ends without a `return`. Make sure every path (every `if` and `else`) returns a value.'],
  2367: [null, () => 'These two can never be equal: they\'re different types. Are you comparing the right things? (A number and a string that looks like one aren\'t equal with `===`.)'],
  2741: [/^Property '(.+?)' is missing/, (m) => `The object needs a \`${m?.[1]}\` too: its type says it's required.`],
  2353: [/and '(.+?)' does not exist in type/, (m) => `\`${m?.[1]}\` isn't part of this type. Is it a typo, or does it not belong here?`],
  2349: [null, () => 'You\'re calling something that isn\'t a function. Check the name, and whether you meant to put `()` after it.'],
  2454: [/^Variable '(.+?)'/, (m) => `\`${m?.[1]}\` is used before it's been given a value. Give it one first.`],
  2307: [null, () => 'On the station, only `react` can be imported. Everything else has to be written here.'],
  1002: [null, () => 'A piece of text is missing its closing quote.'],
  1005: [/^'(.+?)' expected/, (m) => `The compiler expected a \`${m?.[1]}\` here. Look for something unfinished just before this point: a missing bracket, comma or quote.`],
  1109: [null, () => 'Something is missing here: the line stops in the middle. Check for a missing value after an operator, or an extra symbol.'],
  1128: [null, () => 'The compiler got lost here. Often there\'s one bracket too many, or one missing, just before this point. Count your `{` and `}`.'],
};

/** One plain-English sentence about a compiler error, or null if there's nothing to add. */
export function explainDiagnostic(code: number, message: string): string | null {
  const entry = EXPLAIN[code];
  if (!entry) return null;
  const [pattern, explain] = entry;
  return explain(pattern ? message.match(pattern) : null, message);
}
~~~~

### Rules for authoring a level

- **Code level**: `id` (kebab-case, unique), `title` (the concept, e.g. "Generics"), `system` (the station system it fixes, e.g. "Universal Adapter"), `skills` (1–5 skill ids, Part 5), `brief` (ARIA's story, sometimes THE FEED), `lesson` (teaches the concept, in mini-markdown: `##` headings, paragraphs, lists, tables, fenced code, `` `code` ``, `**bold**`, `*italic*`), exactly **3 hints**, each more specific than the last, with the third close to the answer, `checks` (≥1), optional `typeChecks`, optional `preview`, and `boss: true` for the last code level of each floor.
- **The starter** is a working file with a bug or a gap, opened by a comment that tells the player exactly what to do. It must compile or fail in an *instructive* way, and it **must not pass**.
- **The solution** is short, idiomatic code that a good engineer would write. It **must pass everything** with no type errors.
- **Check labels** are objectives the player can read before running, e.g. `square(4) is 16` or `Never goes above 10`. They show on the Mission tab as a checklist and flip to ✓/✗ after each run. Wrap code in backticks in labels; they render as inline code.
- **Type checks** are tiny TypeScript files. Lines the player's types must *accept* are written plainly. Lines they must *reject* get `// @ts-expect-error` on the line above.
- **Checks that read the source** (e.g. "uses `.map()`") use `mustUse`/`mustNotUse` on comment-stripped code, so a hint in a comment can't satisfy them.
- **Checks involving time** use generous margins. Never assert a state that a busy machine could have moved past (see Part 17).
- **Fake failing servers** throw `fixtureError(...)`, so the test runner can ignore the unhandled rejection a buggy *starter* leaves behind.
- **Quizzes** have 5–6 multiple-choice questions, each with optional `code`, 4 options, the `answer` index and an `explain` line that teaches. The quiz's `lesson` is a short "quick reference".

### Worked example 1: the very first level (Floor 1)

The deck header and first level in `src/content/floor1.ts`:

~~~~ts
import type { Deck } from '../game/types';
import { codeFiles, fnOf, line, mustNotUse, mustUse } from './helpers';

export const floor1: Deck = {
  id: 'boot',
  name: 'Boot Sequence',
  subtitle: 'Your first lines of code',
  outcome: 'You can write small programs: values, variables, decisions and functions.',
  hue: 205,
  levels: [
    {
      kind: 'code',
      id: 'hello-world',
      title: 'Hello, Orrery',
      system: 'Main Console',
      skills: ['output'],
      ...codeFiles('hello-world', 'ts'),
      brief: `**ARIA:** Oh good, you're awake. Orrery Station has been dark for nine days, and you are — I'm told — the new repair engineer. You've never written code? Excellent. Neither had anyone else who came aboard. Most of them are fine.

Every system on this station runs on code, and every system is down. We start with the main console. It just needs to say something.

**THE FEED:** *Welcome, viewers, to Repair Crew LIVE! Our new engineer is about to write their very first line of code. Statistically, this is where things get funny.*`,
      lesson: `## What is code?

Code is a list of instructions for a computer, written in a language it understands. You'll be writing **TypeScript**, which is **JavaScript** with a few extras. JavaScript runs every website you've ever used.

The computer reads your instructions **top to bottom**, one at a time.

## Printing a message

This instruction prints a message to the **console**, the text output panel shown on the right after you press **Run**:

\`\`\`ts
console.log("Hello, world");
\`\`\`

- \`console.log\` means "print this".
- The message goes inside the parentheses \`( )\`.
- Text goes inside quotes: \`"like this"\`.
- The line ends with a semicolon \`;\`, like a full stop.

## Comments

A line starting with \`//\` is a **comment**: a note for people. The computer ignores it completely. The starter code uses comments to tell you what to do.

## Running your code

Press **Run** (or ⌘↵). Your code runs, and the **Checks** panel tells you whether it did what the mission asked. A red ✗ isn't failure. It's information. Every programmer sees hundreds of them a day.`,
      hints: [
        'Delete the `//` at the start of the last line, so it stops being a comment.',
        'Change the words inside the quotes from `Hello, world` to `Hello, Orrery`. Keep the quotes.',
        'The whole program is one line: `console.log("Hello, Orrery");`',
      ],
      checks: [
        { label: 'Prints "Hello, Orrery"', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('Hello, Orrery') },
      ],
    },
~~~~
~~~~ts
    // … the rest of Floor 1's levels …
  ],
};
~~~~

`src/content/code/hello-world/starter.ts`:

~~~~ts
// Welcome to your very first program!
//
// A program is a list of instructions that the computer follows, top to bottom.
// The last line below is an instruction that prints a message — but it's
// switched off. The two slashes // at the start turn a line into a *comment*:
// a note for humans that the computer skips.
//
//   1. Delete the two slashes at the start of the last line.
//   2. Change the message inside the quotes so it says:  Hello, Orrery
//   3. Press the Run button.

// console.log("Hello, world");
~~~~

`src/content/code/hello-world/solution.ts`:

~~~~ts
console.log("Hello, Orrery");
~~~~

### Worked example 2: generics, graded by type checks (Floor 5)

~~~~ts
    {
      kind: 'code',
      id: 'universal-adapter',
      skills: ['generics'],
      title: 'Generics',
      system: 'Universal Adapter',
      ...codeFiles('universal-adapter', 'ts'),
      brief: `**ARIA:** The universal adapter connects anything to anything. It does that by forgetting what everything is. Every value that goes through it comes out typed \`any\` — and \`any\` spreads like coolant leaks.`,
      lesson: `## Why not \`any\`?

\`\`\`ts
function first(items: any[]): any { return items[0]; }
const n = first([1, 2]); // n: any
n.toUpperCase();         // compiles. crashes.
\`\`\`

## Generics

A **type parameter** is a variable for types. Write it in angle brackets; TypeScript fills it in from the arguments:

\`\`\`ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
const n = first([1, 2]);     // T = number → n: number | undefined
const s = first(["a", "b"]); // T = string → s: string | undefined
\`\`\`

The function is written once but keeps the **relationship** between input and output: whatever goes in is what comes out.

(Why \`| undefined\`? Because \`first([])\` has nothing to return. Honest types beat surprises.)

Generics work for any shape: \`function pair<A, B>(a: A, b: B): [A, B]\`.`,
      hints: [
        'Add a type parameter: `function first<T>(items: T[])`.',
        'An empty array has no first element, so the return type is `T | undefined`.',
        '`export function wrap<T>(value: T): { value: T } { return { value }; }`',
      ],
      typeChecks: [
        { label: 'first() keeps the element type', code: `import { first } from './solution';\nconst n: number | undefined = first([1, 2]);\nconst s: string | undefined = first(['a']);\n// @ts-expect-error\nconst bad: string | undefined = first([1, 2]);` },
        { label: 'last() keeps the element type', code: `import { last } from './solution';\nconst b: boolean | undefined = last([true]);\n// @ts-expect-error\nconst bad: number | undefined = last(['x']);` },
        { label: 'first() admits it can come back empty', code: `import { first } from './solution';\n// @ts-expect-error\nconst n: number = first([1, 2]);` },
        { label: 'wrap() keeps the value type', code: `import { wrap } from './solution';\nconst w: { value: string } = wrap('x');\n// @ts-expect-error\nconst bad: { value: number } = wrap('x');` },
      ],
      checks: [
        { label: 'first and last pick the ends', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'first')([7, 8, 9])).toBe(7);
          expect(fnOf(mod, 'last')([7, 8, 9])).toBe(9);
        } },
        { label: 'first([]) is undefined', run: ({ mod, expect }) => expect(fnOf(mod, 'first')([])).toBe(undefined) },
        { label: 'wrap(5) is { value: 5 }', run: ({ mod, expect }) => expect(fnOf(mod, 'wrap')(5)).toEqual({ value: 5 }) },
      ],
    },
~~~~

`starter.ts`:

~~~~ts
// These helpers "work" — but `any` throws away every type that passes through.
// first([1, 2]) should be known to be a number, not "anything".
// Make them generic.

export function first(items: any[]): any {
  return items[0];
}

export function last(items: any[]): any {
  return items[items.length - 1];
}

// wrap(5) → { value: 5 }
export function wrap(value: any): { value: any } {
  return { value };
}
~~~~

`solution.ts`:

~~~~ts
export function first<T>(items: T[]): T | undefined {
  return items[0];
}

export function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

export function wrap<T>(value: T): { value: T } {
  return { value };
}
~~~~

### Worked example 3: a React level with a live preview (Floor 8)

Floor 8 starts with a small helper, used by its checks:

~~~~ts
import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { code, codeFiles, comp } from './helpers';

const buttonByText = (root: { getByText(t: string, s?: string): HTMLElement }, text: string) => root.getByText(text, 'button');
~~~~

~~~~ts
    {
      kind: 'code',
      id: 'thruster',
      skills: ['state'],
      title: 'useState',
      system: 'Thruster Control',
      ...codeFiles('thruster', 'tsx'),
      brief: `**ARIA:** The Control Room. Everything here *changes*: you press something, the screen responds. Or it should. The thruster panel ignores every press.

Try the buttons in the preview first. Then fix it.`,
      lesson: `## Why a plain variable doesn't work

A component is a function that React **calls** to find out what to show. When you write \`let thrust = 0\`:
1. Changing it doesn't tell React anything, so nothing re-renders.
2. Even if something else re-rendered, the function runs again from the top and \`thrust\` is \`0\` again.

## State

\`useState\` gives a component **memory** that survives re-renders, plus a function to update it. Calling the setter **schedules a re-render** with the new value:

\`\`\`tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0); // initial value
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
\`\`\`

- \`useState\` is a **hook**. Hooks are called at the top level of a component — never inside \`if\`s or loops.
- The type is inferred from the initial value: \`useState(0)\` holds a \`number\`.
- \`onClick\` takes a **function**: \`onClick={() => setCount(1)}\`, not \`onClick={setCount(1)}\` (that would call it during render).

To clamp a value: \`Math.min(10, n)\` and \`Math.max(0, n)\`.`,
      hints: [
        'Import the hook: `import { useState } from "react";`',
        'Replace the variable: `const [thrust, setThrust] = useState(0);` and call `setThrust(…)` in the handlers.',
        'Clamp it: `setThrust(Math.min(10, thrust + 1))` and `setThrust(Math.max(0, thrust - 1))`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Thruster')),
      checks: [
        { label: 'Starts at "Thrust: 0"', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          expect(view.get('p').textContent).toBe('Thrust: 0');
        } },
        { label: 'Increase raises it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          await view.click(buttonByText(view, 'Increase'));
          await view.click(buttonByText(view, 'Increase'));
          expect(view.get('p').textContent).toBe('Thrust: 2');
        } },
        { label: 'Decrease lowers it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          for (let i = 0; i < 3; i++) await view.click(buttonByText(view, 'Increase'));
          await view.click(buttonByText(view, 'Decrease'));
          expect(view.get('p').textContent).toBe('Thrust: 2');
        } },
        { label: 'Never goes below 0', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          await view.click(buttonByText(view, 'Decrease'));
          expect(view.get('p').textContent).toBe('Thrust: 0');
        } },
        { label: 'Never goes above 10', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          for (let i = 0; i < 12; i++) await view.click(buttonByText(view, 'Increase'));
          expect(view.get('p').textContent).toBe('Thrust: 10');
        } },
      ],
    },
~~~~

`starter.tsx`:

~~~~tsx
// The thruster panel:
//   <p>Thrust: {thrust}</p>
//   <button>Decrease</button> <button>Increase</button>
// Thrust starts at 0 and must stay between 0 and 10.
//
// Click the buttons in the preview. Nothing changes on screen. Why?

export function Thruster() {
  let thrust = 0;

  return (
    <div className="thruster">
      <p>Thrust: {thrust}</p>
      <button onClick={() => (thrust = thrust - 1)}>Decrease</button>
      <button onClick={() => (thrust = thrust + 1)}>Increase</button>
    </div>
  );
}
~~~~

`solution.tsx`:

~~~~tsx
import { useState } from 'react';

export function Thruster() {
  const [thrust, setThrust] = useState(0);

  return (
    <div className="thruster">
      <p>Thrust: {thrust}</p>
      <button onClick={() => setThrust(Math.max(0, thrust - 1))}>Decrease</button>
      <button onClick={() => setThrust(Math.min(10, thrust + 1))}>Increase</button>
    </div>
  );
}
~~~~

### Worked example 4: a quiz (Floor 1)

~~~~ts
{
  kind: 'quiz',
  id: 'quiz-basics',
  title: 'Read the Code',
  system: 'Boot Diagnostics Terminal',
  skills: ['output', 'logic'],
  brief: `**ARIA:** Before the boot sequence, a quick check that you can *read* code as well as write it. Professional programmers spend more time reading code than writing it. Nobody tells you that up front.`,
  lesson: `## Reading code like the computer

- Work **top to bottom**, one line at a time.
- Inside an expression, parentheses go first, then \`*\` \`/\` \`%\`, then \`+\` \`-\`.
- \`+\` with a string on either side glues **text**: \`"3" + 4\` is \`"34"\`.
- \`=\` stores, \`===\` compares.
- \`return\` hands a value back **and ends the function** immediately.`,
  questions: [
    {
      prompt: 'What does this print?',
      code: 'let shields = 40;\nshields = shields + 15;\nconsole.log(shields);',
      options: ['40', '15', '55', 'shields + 15'],
      answer: 2,
      explain: 'The right side is worked out first (40 + 15 = 55), then stored back into `shields`.',
    },
    {
      prompt: 'What does this print?',
      code: 'console.log("3" + 4);',
      options: ['7', '"34"', '34', 'An error'],
      answer: 2,
      explain: 'With a string on one side, `+` joins text instead of adding. `"3" + 4` becomes the string `34`. Mixing up numbers and number-looking strings is a classic bug, and TypeScript helps you catch it.',
    },
    // … four more …
  ],
},
~~~~

**Check (end of Part 4):** write the level-proof test from Part 13 (`tests/levels.test.ts`) and one floor of content. `npm test` should prove every level on it.

---

## Part 5. The curriculum: 10 floors, 96 levels

### Design principles

- **Zero to professional, smoothly.** Floor 1 assumes nothing: not what a string is, not where the semicolon key is. Each level adds **one** idea. Floor 10 is what a professional React team expects.
- **Three schools**: floors 1–3 are JavaScript (written as TypeScript), 4–6 TypeScript, 7–10 React. This decides class bonuses (Part 7).
- **Every floor** has 5–11 code levels, one quiz (second to last) and a **boss** (last): a bigger, multi-part code level that combines the floor's ideas. The boss of floors 9 and 10 is titled "FINAL BOSS". A floor's boss is playable as soon as the player reaches the floor, which is the way to skip a floor they already know.
- **Fix, don't just write.** Most starters are broken systems: a bug, an `any`, a missing state hook, a race condition. Debugging is taught from day one.
- **No cliffs.** Where an idea is big (lists, loops, reducers, data fetching, accessible forms, keyboard widgets), a smaller bridge level comes first and teaches half of it. When you measure solution size level by level, no regular level should be more than about twice the one before it.
- **Make the compiler a teacher.** Several early levels ask the player to press Run, *read* the red squiggle, and fix what it says. Type checks grade types the way a reviewer would.
- **React levels have a live preview** of the player's component, so they can click around before and after fixing it.

### Skills

Every level trains 1–5 of 21 skills. A skill gains 1 point for a level's first clear and 1 more for three stars. It levels up at 1, 3, 5, 8 and 12 points (Novice → Master).

**`src/game/skills.ts`**

~~~~ts
// Skills: every level trains one or more, and each grows from level 0 to 5 as
// you complete (and master) levels that use it — "Your Arrays skill is now
// level 3". Together they show the player's whole journey, JavaScript → React.

export type School = 'JavaScript' | 'TypeScript' | 'React';

export const SKILLS = {
  output: { name: 'Output & Values', school: 'JavaScript', icon: '💬' },
  logic: { name: 'Logic', school: 'JavaScript', icon: '🔀' },
  functions: { name: 'Functions', school: 'JavaScript', icon: '🧩' },
  arrays: { name: 'Arrays', school: 'JavaScript', icon: '📦' },
  objects: { name: 'Objects', school: 'JavaScript', icon: '🗂' },
  iteration: { name: 'Loops & Array Methods', school: 'JavaScript', icon: '🔁' },
  modern: { name: 'Modern JavaScript', school: 'JavaScript', icon: '✨' },
  errors: { name: 'Errors', school: 'JavaScript', icon: '🧯' },
  async: { name: 'Async', school: 'JavaScript', icon: '⏳' },
  types: { name: 'Types', school: 'TypeScript', icon: '🏷' },
  narrowing: { name: 'Narrowing', school: 'TypeScript', icon: '🔎' },
  generics: { name: 'Generics', school: 'TypeScript', icon: '🧬' },
  'type-level': { name: 'Type-Level Programming', school: 'TypeScript', icon: '🧠' },
  components: { name: 'Components', school: 'React', icon: '🧱' },
  state: { name: 'State & Events', school: 'React', icon: '🎛' },
  effects: { name: 'Effects', school: 'React', icon: '🌀' },
  hooks: { name: 'Hooks & Patterns', school: 'React', icon: '🪝' },
  data: { name: 'Data Fetching', school: 'React', icon: '📡' },
  performance: { name: 'Performance', school: 'React', icon: '⚡' },
  a11y: { name: 'Accessibility', school: 'React', icon: '♿' },
  testing: { name: 'Testing', school: 'React', icon: '🧪' },
} as const satisfies Record<string, { name: string; school: School; icon: string }>;

export type SkillId = keyof typeof SKILLS;

/** Skill points needed for each skill level: level 1 at 1 point … level 5 at 12. */
export const SKILL_THRESHOLDS = [1, 3, 5, 8, 12] as const;
export const MAX_SKILL_LEVEL = SKILL_THRESHOLDS.length;

export function skillLevel(points: number): number {
  let level = 0;
  for (const t of SKILL_THRESHOLDS) if (points >= t) level++;
  return level;
}

export const SKILL_RANKS = ['Untrained', 'Novice', 'Apprentice', 'Adept', 'Expert', 'Master'] as const;
~~~~

### The ten floors, level by level

What follows is the complete curriculum: every level's id, title, station system, file type and skills, and whether it has a live preview. For code levels it also gives the task as the starter's opening comment states it, the exports the solution provides (the API the checks call), the hidden type checks and the behaviour checks, as labels. Write each level's brief, lesson, three hints, starter, solution and checks to match. The labels tell you exactly what each check asserts.

### Floor 1 — Boot Sequence (`boot`, hue 205)

*Your first lines of code.* Outcome shown on the map: “You can write small programs: values, variables, decisions and functions.”

1. **`hello-world` — Hello, Orrery** · system *Main Console* · `solution.ts` · skills output
   - Starter says: Welcome to your very first program! A program is a list of instructions that the computer follows, top to bottom. The last line below is an instruction that prints a message — but it's switched off. The two slashes // at the start turn a line into a *comment*: a note for humans that the computer skips. 1. Delete the two slashes at the start of the last line. 2. Change the message inside the quotes so it says: Hello, Orrery 3. Press the Run button.
   - Checks: Prints "Hello, Orrery"

2. **`strings` — Strings** · system *Status Display* · `solution.ts` · skills output
   - Starter says: Text in code is called a *string*: characters between quotes. Join two strings with +, and ask a string how long it is with .length "Deck " + "Seven" → "Deck Seven" "Kite".length → 4
   - Checks: Line 1 prints "Status: ONLINE"; Line 2 prints the length of "Orrery" (6); Joins with + and measures with .length

3. **`numbers` — Numbers and Maths** · system *Power Calculator* · `solution.ts` · skills output
   - Starter says: Numbers work like a calculator: + add - subtract * multiply / divide % remainder after dividing: 7 % 3 is 1 Parentheses ( ) are worked out first, just like in maths. Each line below prints the wrong thing. Fix the maths — don't type the answers in yourself, let the computer work them out.
   - Checks: Total power is 420; Each deck gets 105; 2 crates left over; (2 + 3) × 4 is 20; The computer does the maths

4. **`variables` — Variables** · system *Backup Generator* · `solution.ts` · skills output
   - Starter says: A *variable* is a named box that holds a value, so you can use it later. const name = value; a box you fill once and never refill let name = value; a box you can refill: name = newValue; The station's power starts at 10, then the backup generator adds 25. Press Run first: the compiler refuses. Hover the red squiggle and read why. Then fix it, so the first line printed is: Orrery 35
   - Checks: Prints "Orrery 35"; A variable named crew holds 12, and is printed

5. **`template-strings` — Template Strings** · system *Docking Announcer* · `solution.ts` · skills output
   - Starter says: Joining lots of pieces with + gets messy. A *template string* uses backticks \` (top-left of your keyboard) instead of quotes, and anything inside ${ } is worked out and dropped into the text: const name = "Ada"; console.log(\`Hello, ${name}!\`); // Hello, Ada! console.log(\`2 + 2 is ${2 + 2}\`); // 2 + 2 is 4
   - Checks: Prints the docking announcement; Prints "Crew aboard: 5"; Built from the variables with ${ }

6. **`comparisons` — True or False** · system *Sensor Grid* · `solution.ts` · skills logic
   - Starter says: A comparison asks a yes-or-no question. The answer is a *boolean*: either true or false. === is equal to !== is not equal to &lt; is less than &gt; is greater than &lt;= less than or equal &gt;= greater than or equal console.log(3 &gt; 2); // true const isEmpty = 0 === 0; // a variable can hold a boolean too
   - Checks: Fuel is less than 50 → true; Fuel is exactly 35 → true; Hull is not "Swift" → true; Fuel is at least 40 → false; Asks with comparisons

7. **`functions` — Functions** · system *Fabricator* · `solution.ts` · skills functions
   - Starter says: A *function* is a reusable recipe: give it inputs, it does some work, and \`return\` hands back the result. function double(n: number): number { return n * 2; } double(4); // 8 n is the function's *parameter* — the name for whatever input it's given. The ": number" labels are *types*: they say what kind of value goes in and what comes out. \`export\` lets the rest of the station (and the tests) use it.
   - Solution exports: `export function square(n: number): number`; `export function greet(name: string): string`
   - Type checks: greet takes a string and returns a string
   - Checks: square(4) is 16; square(-3) is 9; greet("Ada") is "Welcome aboard, Ada!"; greet works for any name

8. **`if-else` — Making Decisions** · system *Core Monitor* · `solution.ts` · skills logic, functions
   - Starter says: \`if\` runs a block of code only when its condition is true. \`else if\` tries another condition, and \`else\` catches everything left over. if (score &gt; 90) { return "A"; } else if (score &gt; 75) { return "B"; } else { return "C"; }
   - Solution exports: `export function coreStatus(temp: number): string`; `export function canLaunch(fuel: number): boolean`
   - Checks: 950° is "OVERHEAT"; 700° is "WARM"; Exactly 900° is still "WARM" (it must be *above* 900); 600° and below is "STABLE"; canLaunch: 20 or more is true; canLaunch: below 20 is false

9. **`logic-ops` — And, Or, Not** · system *Safety Interlocks* · `solution.ts` · skills logic
   - Starter says: Combine yes/no answers with logical operators: a && b AND: true only if both are true a \|\| b OR: true if at least one is true !a NOT: flips true to false and false to true
   - Solution exports: `export function canOpenAirlock(innerClosed: boolean, pressure: number): boolean`; `export function shouldAlarm(fire: boolean, oxygen: number): boolean`; `export function isOffDuty(onShift: boolean): boolean`
   - Checks: Airlock opens: door closed, pressure 100; Airlock opens at exactly 90 and 110; Airlock stays shut: unsafe pressure, or door open; Alarm: fire, or low oxygen; Off duty means NOT on shift

10. **Quiz `quiz-basics` — Read the Code** · system *Boot Diagnostics Terminal* · skills output, logic · 6 questions: What does this print?; What does this print?; What does this print?; Which line is a mistake?; What does `check(5)` return?; What does this print?

11. **`boot-diagnostics` — BOSS: Boot Diagnostics** ☢ **BOSS** · system *Boot Sequence* · `solution.ts` · skills functions, logic, output
   - Starter says: BOSS — Boot Diagnostics. Everything from this floor, in one boot sequence.
   - Solution exports: `export function powerLevel(generators: number): number`; `export function systemReport(name: string, power: number): string`; `export function readyToBoot(power: number, crew: number, doorsSealed: boolean): boolean`
   - Checks: powerLevel(0) is 50, powerLevel(2) is 300; An OFFLINE report; A LOW report; An ONLINE report (100 counts as online); readyToBoot when everything is in order; readyToBoot refuses if anything is wrong; Prints the Reactor report


### Floor 2 — Supply Lines (`supply`, hue 165)

*Lists, loops and objects.* Outcome shown on the map: “You can store collections of data and process them with loops and array methods.”

1. **`lists` — Lists** · system *Cargo Lift* · `solution.ts` · skills arrays
   - Starter says: Floor 2 is all about lists. A list in code is called an *array*: values in order, between square brackets, separated by commas: const crates = ["coolant", "fuses", "rations"]; Each item has a position number, its *index*. Counting starts at 0, not 1: crates[0] is "coolant", crates[1] is "fuses", crates[2] is "rations" crates.length is how many items there are: 3 crates.push("tools") adds "tools" to the end of the list. The cargo lift's display prints the wrong things. Make it print, in order: fuses (the item at index 1) 3 (how many crates there are) rations (the last crate) Then add "tools" to the end of the list, and print the new length: 4 Read everything from the array: don't type the answers in yourself.
   - Checks: Line 1 prints the crate at index 1 ("fuses"); Line 2 prints how many crates there are (3); Line 3 prints the last crate ("rations"); After pushing "tools", line 4 prints the new length (4); Reads the answers from the array

2. **`arrays` — Arrays** · system *Cargo Racks* · `solution.ts` · skills arrays
   - Starter says: An *array* is a list of values, in order, inside square brackets: const crates = ["coolant", "fuses", "rations"]; Each item has a position number called its *index*, and indexes start at 0: crates[0] → "coolant" crates[2] → "rations" crates.length → 3 crates.push("tools"); adds "tools" to the end string[] is the type of a list of strings; number[] is a list of numbers.
   - Solution exports: `export function firstCrate(list: string[]): string`; `export function lastCrate(list: string[]): string`; `export function addCrate(list: string[], item: string): number`
   - Checks: firstCrate; lastCrate works for any length; addCrate adds to the end and returns the new length

3. **`loop-basics` — Repeat After Me** · system *Roll Call* · `solution.ts` · skills iteration, arrays
   - Starter says: A *loop* runs the same code once for every item in a list. A for...of loop looks like this: for (const name of crew) { console.log(name); // runs once for each name, in order } Inside the { }, \`name\` holds the current item: first "Ada", then "Bo", then "Cy". 1. The roll call below prints every name by hand. That breaks the moment someone joins the crew. Replace the three console.log lines with ONE loop that prints every name. 2. After the loop, print how many people answered, like this: Present: 3 (You don't need to count: the list knows its own length.) 3. Finally, add up the crate weights with a loop and print: Total: 59 Keep a running total in a variable: start it at 0, and add each weight to it.
   - Checks: Prints every name, in order; Then prints "Present: 3"; Then prints "Total: 59"; Uses for…of loops, not one line per name

4. **`loops` — Loops** · system *Weighbridge* · `solution.ts` · skills iteration, arrays
   - Starter says: A *loop* repeats code. A for...of loop runs once for each item in an array: for (const name of names) { console.log(name); // runs once per name } A common pattern: start a variable, then update it inside the loop. let total = 0; for (const n of numbers) { total = total + n; // or the shortcut: total += n; }
   - Solution exports: `export function totalWeight(weights: number[]): number`; `export function countHeavy(weights: number[], limit: number): number`; `export function longestName(names: string[]): string`
   - Checks: totalWeight adds everything; countHeavy counts weights over the limit; longestName; Uses for…of loops

5. **`for-while` — Counting Loops** · system *Launch Sequencer* · `solution.ts` · skills iteration
   - Starter says: Sometimes you need a loop that counts, not one that walks through a list. A classic for loop has three parts: start; keep going while; step for (let i = 1; i &lt;= 3; i++) { // i++ means "add 1 to i" console.log(i); // 1, 2, 3 } A while loop repeats as long as its condition is true: let fuel = 10; while (fuel &gt; 0) { fuel = fuel - 4; } Careful: if the condition never becomes false, the loop never ends!
   - Solution exports: `export function countdown(from: number): number[]`; `export function evens(limit: number): number[]`; `export function burnsUntilEmpty(fuel: number, burn: number): number`
   - Checks: countdown(3) is [3, 2, 1]; countdown(1) is [1], countdown(0) is []; evens(7) is [2, 4, 6], evens(8) includes 8; burnsUntilEmpty

6. **`objects` — Objects** · system *Ship Registry* · `solution.ts` · skills objects
   - Starter says: An *object* groups related values under names, called *properties*: const ship = { name: "Kite", crew: 4, docked: true }; ship.name → "Kite" ship.crew = 5; changes a property Its type lists each property and its type: { name: string; crew: number; docked: boolean }
   - Solution exports: `export function describeShip(ship: { name: string; crew: number; docked: boolean }): string`; `export function newShip(name: string): { name: string; crew: number; docked: boolean }`; `export function refuel(ship: { fuel: number }, amount: number): number`
   - Checks: Describes a docked ship; Describes a ship in flight; newShip makes a fresh ship; refuel adds fuel and updates the ship; refuel never goes above 100

7. **`crew-search` — Lists of Objects** · system *Crew Manifest* · `solution.ts` · skills objects, iteration
   - Starter says: Real data is usually a list of objects. A *type alias* gives a shape a name, so you don't have to repeat it:
   - Solution exports: `export type CrewMember = { name: string; role: string; age: number; onDuty: boolean };`; `export function findPilot(crew: CrewMember[]): string`; `export function onDutyNames(crew: CrewMember[]): string[]`; `export function averageAge(crew: CrewMember[]): number`
   - Checks: findPilot finds the first pilot; findPilot says "none" when there is no pilot; onDutyNames; averageAge

8. **`map-method` — Transform with map** · system *Label Printer* · `solution.ts` · skills iteration, functions
   - Starter says: Arrays have built-in *methods* that loop for you. .map() builds a NEW array by transforming every item with a function you give it: [1, 2, 3].map((n) =&gt; n * 10) → [10, 20, 30] ["a", "b"].map((s) =&gt; s + "!") → ["a!", "b!"] (n) =&gt; n * 10 is a short way to write a function: "take n, give back n * 10". The original array is not changed.
   - Solution exports: `export function shout(names: string[]): string[]`; `export function withTax(prices: number[]): number[]`; `export function labels(crew: { name: string; role: string }[]): string[]`
   - Checks: shout; withTax; labels; The original array is untouched; Uses .map() instead of loops

9. **`filter-method` — Select with filter** · system *Sensor Filter* · `solution.ts` · skills iteration
   - Starter says: .filter() builds a NEW array with only the items your function says yes to: [5, 12, 8, 20].filter((n) =&gt; n &gt; 10) → [12, 20] The function must return true (keep it) or false (drop it). Methods can be *chained* — filter first, then map what's left: items.filter((i) =&gt; i.qty &gt; 0).map((i) =&gt; i.name)
   - Solution exports: `export type Sensor = { id: string; online: boolean; reading: number };`; `export function onlineSensors(sensors: Sensor[]): Sensor[]`; `export function affordable(prices: number[], budget: number): number[]`; `export function overheatingIds(sensors: Sensor[]): string[]`
   - Checks: onlineSensors; affordable includes prices equal to the budget; overheatingIds: online AND above 900; Uses .filter()

10. **`find-some` — find, some, every** · system *Door Control* · `solution.ts` · skills iteration, arrays
   - Starter says: More questions you can ask an array: .find(fn) the FIRST item where fn says yes — or undefined if none .some(fn) true if AT LEAST ONE item passes .every(fn) true if ALL items pass .includes(x) true if x is in the array [3, 9, 14].find((n) =&gt; n &gt; 5) → 9 [3, 9, 14].some((n) =&gt; n &gt; 10) → true [3, 9, 14].every((n) =&gt; n &gt; 10) → false ["a", "b"].includes("b") → true
   - Solution exports: `export type Door = { id: string; sealed: boolean };`; `export function findDoor(doors: Door[], id: string): Door | undefined`; `export function anyCritical(readings: number[]): boolean`; `export function allSealed(doors: Door[]): boolean`; `export const ROLES = ["pilot", "engineer", "medic"];`; `export function isCertified(role: string): boolean`
   - Checks: findDoor finds by id, or gives undefined; anyCritical; allSealed; isCertified; Uses find, some, every and includes

11. **`reduce-method` — Summarize with reduce** · system *Ledger Core* · `solution.ts` · skills iteration
   - Starter says: .reduce() boils a whole array down to ONE value. You give it a function and a starting value. The function receives the running result so far (often called acc, the "accumulator") and the next item, and returns the new result: [4, 5, 6].reduce((acc, n) =&gt; acc + n, 0) → 15 acc: 0 → 4 → 9 → 15 The starting value can be anything — even an empty object {}.
   - Solution exports: `export function sum(numbers: number[]): number`; `export function largest(numbers: number[]): number`; `export function countByRole(crew: { role: string }[]): Record<string, number>`
   - Checks: sum; largest, even with negative numbers; countByRole; Uses .reduce()

12. **Quiz `quiz-collections` — Predict the Output** · system *Logistics Terminal* · skills arrays, iteration · 6 questions: What does this print?; What is `result`?; How many times does this loop print?; What is `found`?; What is `total`?; What does this print?

13. **`inventory-audit` — BOSS: Inventory Audit** ☢ **BOSS** · system *Quartermaster* · `solution.ts` · skills iteration, objects, arrays
   - Starter says: BOSS — Inventory Audit. The quartermaster's records are a mess. Audit them with array methods.
   - Solution exports: `export type Item = { name: string; category: string; qty: number; price: number };`; `export function totalValue(items: Item[]): number`; `export function lowStock(items: Item[]): string[]`; `export function unitsByCategory(items: Item[]): Record<string, number>`; `export function audit(items: Item[])`
   - Checks: totalValue; lowStock: under 5, sorted A→Z; unitsByCategory; audit puts it all together; audit handles an empty inventory; audit doesn't change the items it was given


### Floor 3 — Modern Systems (`modern`, hue 45)

*Modern JavaScript, errors and async.* Outcome shown on the map: “You write JavaScript the way professionals do: concise, safe with missing data, error-aware and asynchronous.”

1. **`arrow-callbacks` — Functions as Values** · system *Signal Processor* · `solution.ts` · skills functions, modern
   - Starter says: Functions are values: you can store them in variables, pass them into other functions, and return them from functions. const double = (n: number) =&gt; n * 2; // a function in a variable function apply(n: number, fn: (x: number) =&gt; number) { return fn(n); // call the function you were given } apply(5, double); // 10 (x: number) =&gt; number is the TYPE of "a function that takes a number and returns a number".
   - Solution exports: `export const triple = (n: number): number => n * 3;`; `export function applyAll(values: number[], fn: (n: number) => number): number[]`; `export function makeMultiplier(factor: number): (n: number) => number`
   - Checks: triple(4) is 12; triple is an arrow function in a const; applyAll calls the function on every value; makeMultiplier builds multipliers

2. **`destructuring` — Destructuring** · system *ID Badge Printer* · `solution.ts` · skills modern, objects
   - Starter says: Destructuring unpacks objects and arrays into variables in one line: const { name, crew } = ship; // same as name = ship.name; crew = ship.crew const [first, second] = list; // same as first = list[0]; second = list[1] const [head, ...rest] = list; // rest is everything after the first function hello({ name }: { name: string }) { … } // in a parameter, too const { crew = 1 } = ship; // a default, if crew is undefined
   - Solution exports: `export type CrewMember = { name: string; role: string; rank?: string };`; `export function badge({ name, role, rank }: CrewMember): string`; `export function swap(pair: [number, number]): [number, number]`; `export function nextInQueue(queue: string[]): { next: string | undefined; waiting: string[] }`
   - Checks: badge without a rank; badge with a rank; swap; nextInQueue; Uses destructuring

3. **`spread-rest` — Spread and Rest** · system *Config Manager* · `solution.ts` · skills modern, objects, arrays
   - Starter says: The spread operator ... copies everything out of an array or object: const more = [...list, "new"]; // a NEW array: list's items plus one const updated = { ...ship, crew: 5 }; // a NEW object: ship's properties, crew replaced Math.max(...[3, 9, 4]); // spreads the array into arguments: 9 In a parameter list, ... collects any number of arguments into an array (rest): function total(...nums: number[]) { … } total(1, 2, 3) → nums is [1, 2, 3] None of these functions may change what they were given — always return new values.
   - Solution exports: `export function addToRoster(roster: string[], name: string): string[]`; `export type Ship = { name: string; fuel: number };`; `export function withFuel(ship: Ship, fuel: number): Ship`; `export function settings(`; `export function highest(...readings: number[]): number`
   - Type checks: highest takes any number of arguments
   - Checks: addToRoster returns a new array and leaves the old one alone; withFuel returns a new ship and leaves the old one alone; settings: overrides win, defaults fill the gaps; highest(3, 9, 4) is 9; Copies with spread instead of changing things

4. **`optional-chaining` — Missing Data** · system *Flight Records* · `solution.ts` · skills modern, objects
   - Starter says: Data is often incomplete. Reading a property of undefined crashes: ship.pilot.name 💥 if ship has no pilot Optional chaining ?. stops early and gives undefined instead of crashing: ship.pilot?.name → undefined if there's no pilot Nullish coalescing ?? supplies a fallback ONLY for null or undefined: ship.pilot?.name ?? "unassigned" Careful: \|\| falls back for ANY falsy value — including 0 and "". 0 \|\| 50 → 50 (oops, 0 was a real setting) 0 ?? 50 → 0 (correct)
   - Solution exports: `export type Ship =`; `export function pilotName(ship: Ship): string`; `export function licenseLevel(ship: Ship): number`; `export function cargoCount(ship: Ship): number`; `export function volume(ship: Ship): number`
   - Checks: pilotName; licenseLevel through two gaps; cargoCount; volume keeps a real 0

5. **`closures` — Closures** · system *Serial Number Forge* · `solution.ts` · skills functions, modern
   - Starter says: A function remembers the variables that were around when it was created — even after the outer function has finished. This is called a *closure*: function makeGreeter(greeting: string) { return (name: string) =&gt; \`${greeting}, ${name}\`; // remembers greeting } const hi = makeGreeter("Hi"); hi("Ada"); // "Hi, Ada" Each call to makeGreeter makes a fresh closure with its own greeting.
   - Solution exports: `export function makeCounter()`; `export function makeIdGenerator(prefix: string): () => string`; `export function once(fn: () => number): () => number`
   - Checks: makeCounter counts; Each counter is independent; makeIdGenerator; once runs the function only the first time

6. **`string-methods` — Text Processing** · system *Nameplate Engraver* · `solution.ts` · skills output, modern
   - Starter says: Strings come with lots of built-in methods: " Hi ".trim() → "Hi" (removes spaces at both ends) "Deck 7".toLowerCase() → "deck 7" "a,b,c".split(",") → ["a", "b", "c"] ["a", "b"].join("-") → "a-b" "7".padStart(3, "0") → "007" "Ada"[0] → "A" Number("42") → 42 (NaN if it isn't a number) "Deck 7".replaceAll(" ", "_") → "Deck_7"
   - Solution exports: `export function slugify(title: string): string`; `export function initials(fullName: string): string`; `export function bayCode(n: number): string`; `export function parseCoordinates(text: string): [number, number]`
   - Checks: slugify; initials; bayCode; parseCoordinates

7. **`errors` — Errors** · system *Fuel Gauges* · `solution.ts` · skills errors
   - Starter says: When something goes wrong, code can *throw* an error. It stops the current function immediately and travels up until something *catches* it: if (amount &lt; 0) { throw new Error("Amount can't be negative"); } try { risky(); } catch (error) { console.log("That failed, but we carry on"); }
   - Solution exports: `export function parseFuel(text: string): number`; `export function safeParseFuel(text: string): number | null`; `export function parseBatch(texts: string[]): { ok: number[]; failed: string[] }`
   - Checks: parseFuel reads good numbers; parseFuel throws on nonsense, with the right message; safeParseFuel gives null instead of throwing; parseBatch sorts good from bad; Uses throw and try/catch

8. **`classes` — Classes** · system *Fuel Tanks* · `solution.ts` · skills objects, modern
   - Starter says: A *class* is a blueprint for objects that bundle data with the functions (called *methods*) that work on it. class Counter { private count = 0; // private: only the class can touch it constructor(public readonly name: string) {} // runs on \`new Counter("x")\` add(n: number) { // a method this.count += n; // \`this\` is the object itself return this.count; } get value() { // a getter: read it like a property return this.count; } } const c = new Counter("clicks"); c.add(2); c.value // 2
   - Solution exports: `export class FuelTank`
   - Type checks: The level is private: it can be read but not set
   - Checks: A new tank starts empty; fill adds fuel, up to capacity; drain removes fuel; drain throws when there isn't enough — and changes nothing; percent

9. **`async-await` — Async and Await** · system *Remote Telemetry* · `solution.ts` · skills async
   - Starter says: Some work takes time — asking a server, reading a file. Instead of freezing, JavaScript hands you a *Promise*: a value that will arrive later. async function load(api: (id: string) =&gt; Promise&lt;string&gt;) { const status = await api("core"); // wait for the promise, then carry on return status; } An \`async\` function always returns a Promise. \`await\` only works inside one. Promise.all([...]) starts several at once and waits for them all: const [a, b] = await Promise.all([api("a"), api("b")]); If an awaited promise fails (rejects), it throws — so try/catch works.
   - Solution exports: `export type Api = (id: string) => Promise<string>;`; `export async function statusLine(id: string, api: Api): Promise<string>`; `export async function allStatuses(ids: string[], api: Api): Promise<string[]>`; `export async function safeStatusLine(id: string, api: Api): Promise<string>`; `export async function firstHealthy(ids: string[], api: Api): Promise<string | null>`
   - Checks: statusLine waits for the answer; allStatuses keeps the order; allStatuses asks everyone at once; safeStatusLine survives a failure; firstHealthy asks in order and stops at the first "ok"; firstHealthy gives null when nobody is healthy

10. **Quiz `quiz-modern` — Modern JavaScript** · system *Systems Review* · skills modern, async · 6 questions: What does this print?; What does this print?; What is `x`?; What does `getStatus()` return, if `api()` resolves to "ok"?; Three requests each take 1 second. Roughly how long does this take?; What does this print?

11. **`comms-decoder` — BOSS: Comms Decoder** ☢ **BOSS** · system *Long-Range Comms* · `solution.ts` · skills async, errors, modern, functions
   - Starter says: BOSS — Comms Decoder. Raw transmissions arrive as text: " NOVA\|3\|Docking at bay 7 " from \| priority \| body
   - Solution exports: `export type Message = { from: string; priority: number; body: string };`; `export function parseTransmission(raw: string): Message`; `export function decodeAll(raws: string[]): { messages: Message[]; corrupt: number }`; `export async function translateAll(`; `export function makeInbox()`; `export async function processBatch(raws: string[], translate: (text: string) => Promise<string>)`
   - Checks: parseTransmission cleans and converts; parseTransmission rejects corrupt input; decodeAll skips and counts corrupt ones; translateAll translates in parallel without changing the originals; The inbox ranks by priority (first one wins a tie); Two inboxes don't share messages; processBatch runs the whole pipeline


### Floor 4 — Type Foundry (`foundry`, hue 190)

*TypeScript basics.* Outcome shown on the map: “You can describe data precisely with types, and the compiler catches your mistakes before they run.”

1. **`power-bus` — Annotate the Power Bus** · system *Power Bus* · `solution.ts` · skills types, functions
   - Starter says: The power bus adds two voltages together. Strict mode is on, so TypeScript refuses to guess what \`a\` and \`b\` are — they are implicitly \`any\`, and that's an error. Annotate them.
   - Solution exports: `export function addVoltage(a: number, b: number): number`
   - Type checks: Strings are rejected; Returns a number
   - Checks: addVoltage(2, 3) is 5; addVoltage(0.5, 0.25) is 0.75

2. **`comms-relay` — Read the Compiler** · system *Comms Relay* · `solution.ts` · skills types
   - Starter says: Two comms functions with the wrong types bolted on. Read the compiler's complaints, then fix the annotations.
   - Solution exports: `export function hail(name: string, sector: number): string`; `export function isPriority(sector: number): boolean`
   - Type checks: hail returns a string; isPriority takes a number and returns a boolean
   - Checks: hail("Vega", 3) → "Hailing Vega in sector 3"; isPriority(4) is true; isPriority(10) is false

3. **`cargo-manifest` — Arrays and Tuples** · system *Cargo Manifest* · `solution.ts` · skills types, arrays
   - Starter says: The cargo manifest is a list of crate masses, in kilograms.
   - Solution exports: `export function totalMass(masses: number[]): number`; `export function heaviest(masses: number[]): [index: number, mass: number]`
   - Type checks: totalMass only accepts numbers; heaviest returns a two-item tuple
   - Checks: totalMass([120, 80, 310]) is 510; totalMass([]) is 0; heaviest([120, 80, 310, 50]) is [2, 310]; heaviest works with negative values; heaviest([]) is [-1, 0]

4. **`crew-registry` — Interfaces** · system *Crew Registry* · `solution.ts` · skills types, objects
   - Starter says: Describe the shape of a crew member with an interface: id a number that must never change after creation name a string role a string callsign a string, but not everyone has one
   - Solution exports: `export interface CrewMember`; `export function badge(member: CrewMember): string`
   - Type checks: A member without a callsign is valid; callsign is a string when present; role is required; id is readonly
   - Checks: Badge without a callsign; Badge with a callsign

5. **`signal-decoder` — Unions and Narrowing** · system *Signal Decoder* · `solution.ts` · skills types, narrowing
   - Starter says: Signal ids arrive either as numbers or as strings. number → "#" + the number padded to 4 digits: 42 → "#0042" string → upper-cased: "kx-7" → "KX-7"
   - Solution exports: `export function formatId(id: string | number): string`; `export function channelLabel(channel: string | string[]): string`
   - Type checks: formatId accepts strings and numbers only; channelLabel takes a string or a string[]
   - Checks: formatId(42) → "#0042"; formatId(12345) → "#12345"; formatId("kx-7") → "KX-7"; channelLabel("alpha") → "alpha"; channelLabel(["alpha", "beta"]) → "alpha, beta"

6. **Quiz `quiz-inference` — Compiler Diagnostics** · system *Diagnostics Bay* · skills types · 6 questions: What does the compiler say?; What is the type of `mode`?; Inside this function, what is the type of `deck`?; What is inferred for `mixed`?; Which of these lets you call `.toUpperCase()` on it **without** checking first?; This program compiles. What happens when the JavaScript runs?

7. **`telemetry` — BOSS: Reactor Telemetry** ☢ **BOSS** · system *Reactor Telemetry* · `solution.ts` · skills types, narrowing, arrays
   - Starter says: BOSS — Reactor Telemetry. Every sensor reports a value, or null when it's offline.
   - Solution exports: `export interface Reading`; `export interface Summary`; `export function summarize(readings: Reading[]): Summary`; `export function hottest(readings: Reading[]): Reading | undefined`
   - Type checks: Summary.average is number | null; hottest may return undefined
   - Checks: Counts online and offline sensors; Averages only online values; average is null when every sensor is offline; A reading of 0 is online, not missing; hottest finds the highest online reading; hottest returns undefined when nothing is online


### Floor 5 — Generics Lab (`lab`, hue 275)

*TypeScript power tools.* Outcome shown on the map: “You can write reusable, type-safe code with unions, generics and utility types.”

1. **`literal-locks` — Literal Types** · system *Airlock Doors* · `solution.ts` · skills types
   - Starter says: Airlock doors have exactly three states. A plain \`string\` lets typos like "Open" or "ajar" through. Replace it with a union of string literals.
   - Solution exports: `export type Door = 'open' | 'closed' | 'locked';`; `export function next(door: Door): Door`; `export function canLock(door: Door): boolean`
   - Type checks: Valid states are accepted; Typos are rejected; next() only takes real states
   - Checks: open → closed → locked → open; Only a closed door can be locked

2. **`alarm-router` — Discriminated Unions** · system *Alarm Router* · `solution.ts` · skills narrowing, types
   - Starter says: Every alarm has a \`kind\` tag, and each kind carries different data.
   - Solution exports: `export type Alarm =`; `export function route(alarm: Alarm): string`
   - Type checks: Each kind requires its own fields
   - Checks: Routes fires; Routes breaches; Routes intruders

3. **`universal-adapter` — Generics** · system *Universal Adapter* · `solution.ts` · skills generics
   - Starter says: These helpers "work" — but \`any\` throws away every type that passes through. first([1, 2]) should be known to be a number, not "anything". Make them generic.
   - Solution exports: `export function first<T>(items: T[]): T | undefined`; `export function last<T>(items: T[]): T | undefined`; `export function wrap<T>(value: T): { value: T }`
   - Type checks: first() keeps the element type; last() keeps the element type; first() admits it can come back empty; wrap() keeps the value type
   - Checks: first and last pick the ends; first([]) is undefined; wrap(5) is { value: 5 }

4. **`constraint-field` — Constraints and keyof** · system *Constraint Field* · `solution.ts` · skills generics, type-level
   - Starter says: The longer of two things that have a length — strings, arrays, … (On a tie, return the first.)
   - Solution exports: `export function longest<T extends { length: number }>(a: T, b: T): T`; `export function pluck<T, K extends keyof T>(items: T[], key: K): T[K][]`
   - Type checks: longest works on strings and arrays; longest rejects things without a length; pluck only accepts real keys; pluck returns the property type
   - Checks: longest("hull", "hi") is "hull"; longest prefers the first on a tie; pluck(crew, "name")

5. **`config-matrix` — Utility Types** · system *Shield Config* · `solution.ts` · skills type-level, types
   - Solution exports: `export interface ShieldConfig`; `export const DEFAULTS: Readonly<ShieldConfig> = { strength: 50, frequency: 3, mode: 'steady' };`; `export function configure(overrides: Partial<ShieldConfig>): ShieldConfig`; `export type ShieldSummary = Pick<ShieldConfig, 'strength' | 'mode'>;`; `export function summarize(config: ShieldConfig): ShieldSummary`; `export const LABELS: Record<ShieldConfig['mode'], string> =`
   - Type checks: DEFAULTS is read-only; configure accepts partial overrides; ShieldSummary has exactly strength and mode; LABELS covers exactly the modes
   - Checks: configure({ strength: 90 }) keeps the other defaults; configure doesn't change DEFAULTS; summarize picks strength and mode

6. **Quiz `quiz-types` — Type Algebra** · system *Navigation Core* · skills type-level, generics · 5 questions: What is `keyof Pilot`?; What is `T` inferred as?; What is the type of `RANKS`?; In the `default` branch, what is the type of `s`?; What does `Omit<Ship, "id">` produce?

7. **`event-bus` — BOSS: Typed Event Bus** ☢ **BOSS** · system *Station Event Bus* · `solution.ts` · skills generics, type-level
   - Starter says: BOSS — the station event bus. \`E\` maps each event name to its payload type, for example: { dock: { ship: string }; undock: { ship: string; reason: string } } The compiler should then reject emit('dock', { ship: 7 }) and emit('warp', …).
   - Solution exports: `export interface Bus<E>`; `export function createBus<E>(): Bus<E>`
   - Type checks: Handlers receive the right payload type; Wrong payloads are rejected; Unknown events are rejected
   - Checks: emit calls the subscribed handler with the payload; Handlers only hear their own event; Several handlers run in subscription order; The returned function unsubscribes; Each bus is independent


### Floor 6 — Type Vault (`vault`, hue 300)

*Advanced TypeScript.* Outcome shown on the map: “You can model untrusted data, failure and whole APIs in the type system: the TypeScript of senior engineers.”

1. **`unknown-values` — unknown, Not any** · system *Signal Scrubber* · `solution.ts` · skills narrowing, types
   - Starter says: Signals arrive from outside the station, so nobody knows their type in advance. The last engineer typed them as \`any\`, which switches type checking OFF: the compiler happily lets you call .toUpperCase() on a number, and the scrubber crashes at runtime. \`unknown\` is the safe opposite: anything can go IN, but you have to check what it is before you use it. Each check *narrows* the type: if (typeof x === "string") { x.toUpperCase(); } // x is a string in here if (Array.isArray(x)) { x.length; } // x is an array in here 1. Change both \`any\`s to \`unknown\`. Press Run and read the new errors: each one is a crash waiting to happen. 2. Fix them by narrowing. describeSignal(x) returns: a string → "text: HELLO" (upper-cased) a number → "number: 42.5" (one decimal place: x.toFixed(1)) a boolean → "flag: on" or "flag: off" an array → "list of 3" (its length) null → "empty" anything else → "unknown" 3. signalLength(x) returns the length of a string or an array, otherwise 0.
   - Solution exports: `export function describeSignal(x: unknown): string`; `export function signalLength(x: unknown): number`
   - Checks: Strings are upper-cased: "text: HELLO"; Numbers get one decimal place; Booleans, lists and null; Anything else is "unknown"; signalLength measures strings and arrays, and is 0 otherwise; No `any` left

2. **`type-guards` — Type Guards** · system *Deep Scanner* · `solution.ts` · skills narrowing, type-level
   - Starter says: A *type guard* is a function that checks a value at runtime AND tells the compiler what it found. Its return type is a *type predicate*: function isString(x: unknown): x is string { return typeof x === "string"; } if (isString(v)) { v.toUpperCase(); } // v is string in here The \`in\` operator narrows unions by property: if ("crew" in thing) { … }
   - Solution exports: `export type Ship = { kind: "ship"; name: string; crew: number };`; `export type Cargo = { kind: "cargo"; label: string; mass: number };`; `export function isShip(x: unknown): x is Ship`; `export function isCargo(x: unknown): x is Cargo`; `export function describeScan(x: unknown): string`
   - Type checks: isShip narrows to Ship; isCargo narrows to Cargo
   - Checks: isShip accepts real ships; isShip rejects everything else; isCargo checks the shape too; describeScan

3. **`unknown-parsing` — Parsing Untrusted Data** · system *Personnel Import* · `solution.ts` · skills narrowing, errors
   - Starter says: Data from outside your program — a server, a file, a user — can't be trusted. JSON.parse returns \`any\`, which turns off type checking. Treat it as \`unknown\` instead, and *prove* its shape before you use it.
   - Solution exports: `export type Role = "pilot" | "engineer" | "medic";`; `export type CrewMember = { name: string; age: number; role: Role; callsign?: string };`; `export function parseCrew(json: string): CrewMember | null`
   - Type checks: parseCrew returns CrewMember | null
   - Checks: Parses a valid record; Keeps a callsign, drops extra fields; Invalid JSON gives null (no crash); Wrong shapes give null

4. **`result-type` — Errors as Values** · system *Navigation Solver* · `solution.ts` · skills generics, type-level, errors
   - Starter says: Throwing errors is invisible in types: nothing in \`parseAge(text: string): number\` warns the caller it might blow up. A *Result* type makes failure part of the return type, so the compiler forces callers to handle it: type Result&lt;T&gt; = { ok: true; value: T } \| { ok: false; error: string }; const r = parseAge("42"); if (r.ok) { r.value } else { r.error } // narrowed by the \`ok\` tag
   - Solution exports: `export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };`; `export function ok<T>(value: T): Result<T, never>`; `export function err<E>(error: E): Result<never, E>`; `export function divide(a: number, b: number): Result<number>`; `export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>`; `export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T`
   - Type checks: Result is a union you must narrow; The error type defaults to string, and can be changed; mapResult changes the value type
   - Checks: divide; mapResult transforms successes and passes failures through; unwrapOr

5. **`mapped-types` — Mapped Types** · system *Change Tracker* · `solution.ts` · skills type-level, generics
   - Starter says: A *mapped type* builds a new object type by looping over the keys of another: type Optional&lt;T&gt; = { [K in keyof T]?: T[K] }; // that's how Partial works type Strings&lt;T&gt; = { [K in keyof T]: string }; // every value becomes a string Modifiers can be added (+?, +readonly) or removed (-?, -readonly).
   - Solution exports: `export type ShipConfig = { name: string; crew: number; armed: boolean };`; `export type Flags<T> = { [K in keyof T]: boolean };`; `export type Mutable<T> = { -readonly [K in keyof T]: T[K] };`; `export function changedFields<T extends object>(before: T, after: T): Flags<T>`
   - Type checks: Flags&lt;T&gt; has exactly T's keys, all boolean; Mutable&lt;T&gt; removes readonly; changedFields returns Flags of the input
   - Checks: changedFields flags exactly what changed; Nothing changed → all false

6. **`conditional-types` — Conditional Types** · system *Type Refinery* · `solution.ts` · skills type-level, generics
   - Starter says: A *conditional type* chooses a type based on another type: type IsText&lt;T&gt; = T extends string ? "yes" : "no"; IsText&lt;"hi"&gt; → "yes" IsText&lt;42&gt; → "no" \`infer\` captures a part of the type being matched: type ReturnOf&lt;F&gt; = F extends (...args: any[]) =&gt; infer R ? R : never; ReturnOf&lt;() =&gt; number&gt; → number Conditional types *distribute* over unions: IsText&lt;string \| number&gt; → "yes" \| "no"
   - Solution exports: `export type ElementOf<T> = T extends (infer U)[] ? U : never;`; `export type Unwrap<T> = T extends Promise<infer U> ? U : T;`; `export type NonNullish<T> = T extends null | undefined ? never : T;`; `export function toArray<T>(value: T | T[]): T[]`; `export function compact<T>(values: T[]): NonNullish<T>[]`
   - Type checks: ElementOf; Unwrap; NonNullish removes null and undefined; compact's type drops null and undefined
   - Checks: toArray; compact

7. **`template-literal-types` — Template Literal Types** · system *Bay Allocator* · `solution.ts` · skills type-level
   - Starter says: Template literal types build string types the way template strings build strings: type Deck = "A" \| "B"; type Level = 1 \| 2; type Code = \`${Deck}${Level}\`; // "A1" \| "A2" \| "B1" \| "B2" Built-in helpers transform them: Uppercase&lt;"a"&gt; → "A", Capitalize&lt;"dock"&gt; → "Dock". In a mapped type, \`as\` renames keys: type Getters&lt;T&gt; = { [K in keyof T & string as \`get${Capitalize&lt;K&gt;}\`]: () =&gt; T[K] };
   - Solution exports: `export type Deck = "A" | "B" | "C";`; `export type Bay = 1 | 2 | 3 | 4;`; `` export type BayCode = `${Deck}${Bay}`; ``; `export function isBayCode(s: string): s is BayCode`; `` export function handlerName<E extends string>(event: E): `on${Capitalize<E>}` ``; `` export type Handlers<E extends string> = { [K in E as `on${Capitalize<K>}`]: () => void }; ``
   - Type checks: BayCode is exactly the 12 real bays; isBayCode narrows; handlerName has a precise return type; Handlers maps event names to handler props
   - Checks: isBayCode at runtime; handlerName at runtime

8. **`satisfies-const` — satisfies and as const** · system *Route Table* · `solution.ts` · skills type-level, types
   - Starter says: Two tools for configuration objects: as const — freeze a value into its narrowest, readonly literal type satisfies T — check a value matches T WITHOUT widening it to T const COLORS = { ok: "#0f0", bad: "#f00" } as const satisfies Record&lt;string, string&gt;; type ColorName = keyof typeof COLORS; // "ok" \| "bad" With a plain annotation (: Record&lt;string, string&gt;) you'd lose the key names.
   - Solution exports: `export type Route = { path: string; auth: boolean };`; `export const ROUTES =`; `export type RouteName = keyof typeof ROUTES;`; `export function link(name: RouteName, id?: string): string`; `export function protectedRoutes(): RouteName[]`
   - Type checks: RouteName is derived from ROUTES; Routes are still checked against Route
   - Checks: link fills in the id; protectedRoutes

9. **Quiz `quiz-vault` — Type-Level Thinking** · system *Vault Lock* · skills type-level, narrowing · 6 questions: What is `A`?; What is `R`?; Why is a plain `boolean` return type not enough for a type guard?; What is the type of `Keys`?; What does this mapped type produce for `{ fuel: number }`?; Which is the safest type for the result of `JSON.parse(text)`?

10. **`schema-forge` — BOSS: Schema Forge** ☢ **BOSS** · system *Schema Forge* · `solution.ts` · skills type-level, generics, narrowing
   - Starter says: BOSS — Schema Forge. Build a tiny runtime validator whose types are INFERRED from the schemas, the way professional libraries (like zod) work: const Ship = object({ name: string(), crew: number(), tags: array(string()) }); type Ship = Infer&lt;typeof Ship&gt;; // { name: string; crew: number; tags: string[] } const ship = Ship.parse(JSON.parse(text)); // throws if the data is wrong; typed if it's right
   - Solution exports: `export class SchemaError extends Error {}`; `export interface Schema<T>`; `export function makeSchema<T>(check: (input: unknown, path: string) => T): Schema<T>`; `export function fail(path: string, expected: string): never`; `export type Infer<S> = S extends Schema<infer T> ? T : never;`; `export function string(): Schema<string>`; `export function number(): Schema<number>`; `export function boolean(): Schema<boolean>`; `export function array<T>(item: Schema<T>): Schema<T[]>`; `export function object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }>`; `export function optional<T>(schema: Schema<T>): Schema<T | undefined>`
   - Type checks: Infer extracts a schema's type; object() infers the full shape; parse returns the inferred type
   - Checks: Primitives accept their own type; Primitives reject other types, with a path; array checks every element; object checks nested fields and drops extras; optional allows a missing key; safeParse never throws


### Floor 7 — Component Bay (`bay`, hue 150)

*React fundamentals.* Outcome shown on the map: “You can build user interfaces from typed React components.”

1. **`first-light` — Your First Component** · system *Status Lights* · `solution.tsx` · skills components · live preview
   - Starter says: A React component is a function that returns JSX. Its name must start with a capital letter.
   - Solution exports: `export function StatusLight()`; `export const STATION = 'Orrery';`; `export function Banner()`
   - Type checks: Both are valid components
   - Checks: StatusLight shows ONLINE in a &lt;p class="status"&gt;; Banner says "Welcome to Orrery" in an &lt;h1&gt;; Banner uses the STATION constant

2. **`gauge-panel` — Typed Props** · system *Gauge Panel* · `solution.tsx` · skills components, types · live preview
   - Starter says: A gauge shows a label and a value with a unit: Fuel 80% The unit is optional and defaults to "%".
   - Solution exports: `export function Gauge({ label, value, unit = '%' }: GaugeProps)`
   - Type checks: label and value are required, unit is optional; value must be a number
   - Checks: Shows the label; Unit defaults to %; Uses a custom unit

3. **`hull-plating` — Children and Composition** · system *Bridge Dashboard* · `solution.tsx` · skills components · live preview
   - Starter says: A Panel draws a framed section with a title, and whatever is placed between &lt;Panel&gt; and &lt;/Panel&gt; inside it: &lt;section className="panel"&gt;&lt;h2&gt;{title}&lt;/h2&gt; …children… &lt;/section&gt;
   - Solution exports: `export function Panel({ title, children }: PanelProps)`; `export function Dashboard()`
   - Type checks: Panel accepts children; Panel requires a title
   - Checks: Panel renders its title and children; Dashboard shows a Power panel and an Air panel; Each panel holds its reading

4. **`sensor-array` — Lists and Keys** · system *Sensor Array* · `solution.tsx` · skills components, iteration · live preview
   - Solution exports: `export interface Sensor`; `export function SensorList({ sensors }: { sensors: Sensor[] })`
   - Checks: One &lt;li&gt; per sensor, in order; Online/offline classes; An empty array renders an empty list; Each item has a stable key

5. **`warning-lights` — Conditional Rendering** · system *Warning Lights* · `solution.tsx` · skills components, logic · live preview
   - Starter says: level "ok" → render nothing at all level "warn" → &lt;p className="warn"&gt;⚠ {message}&lt;/p&gt;, message defaults to "Check systems" level "critical" → &lt;p className="critical"&gt;CRITICAL: {message}&lt;/p&gt;
   - Solution exports: `export function Alert({ level, message }: { level: 'ok' | 'warn' | 'critical'; message?: string })`; `export function AlertBadge({ count }: { count: number })`
   - Checks: level "ok" renders nothing; level "warn" uses the default message; level "warn" shows a given message; level "critical"; AlertBadge with 3 alerts; AlertBadge with 0 alerts shows no "0"

6. **Quiz `quiz-jsx` — JSX Inspection** · system *Render Pipeline* · skills components · 6 questions: What appears on screen?; Why does this render a plain, unknown HTML tag instead of your component?; Which is the correct way to set a CSS class in JSX?; This returns two sibling elements. What's the fix?; Which `key` is the best choice for a list of crew members?; A child component wants to change a value it received as a prop. What should happen?

7. **`crew-roster` — BOSS: Crew Roster** ☢ **BOSS** · system *Crew Roster* · `solution.tsx` · skills components · live preview
   - Starter says: BOSS — the crew roster screen.
   - Solution exports: `export interface Crew`; `export function CrewCard({ member }: { member: Crew })`; `export function Roster({ crew, title = 'Crew' }: { crew: Crew[]; title?: string })`
   - Type checks: CrewCard and Roster are valid, typed components
   - Checks: CrewCard shows name and role with the right classes; "off duty" appears only for off-duty crew; Roster heading counts who is on duty; Roster uses a custom title; Roster lists every member as a card; Empty roster shows "No crew aboard" and no list; Cards in the list have keys


### Floor 8 — Control Room (`control`, hue 35)

*State and events.* Outcome shown on the map: “You can build interactive screens: state, events, forms and lists that change.”

1. **`thruster` — useState** · system *Thruster Control* · `solution.tsx` · skills state · live preview
   - Starter says: The thruster panel: &lt;p&gt;Thrust: {thrust}&lt;/p&gt; &lt;button&gt;Decrease&lt;/button&gt; &lt;button&gt;Increase&lt;/button&gt; Thrust starts at 0 and must stay between 0 and 10. Click the buttons in the preview. Nothing changes on screen. Why?
   - Solution exports: `export function Thruster()`
   - Checks: Starts at "Thrust: 0"; Increase raises it; Decrease lowers it; Never goes below 0; Never goes above 10

2. **`airlock` — Typed State and Callbacks** · system *Airlock Control* · `solution.tsx` · skills state, types · live preview
   - Solution exports: `export function Airlock({ initiallyOpen = false, onChange }: AirlockProps)`
   - Checks: Starts sealed; Clicking opens it; Clicking again seals it; initiallyOpen starts it open; onChange reports each new state

3. **`callsign` — Controlled Inputs** · system *Nav Computer* · `solution.tsx` · skills state · live preview
   - Starter says: &lt;input aria-label="Callsign" /&gt; &lt;p className="preview"&gt;Callsign: NOVA&lt;/p&gt; (upper-cased; "Callsign: —" when empty) &lt;p className="count"&gt;4/12&lt;/p&gt; Callsigns are at most 12 characters: typing past that is ignored.
   - Solution exports: `export function CallsignInput()`
   - Checks: Shows "—" and 0/12 when empty; Typing updates the preview in upper case; The input is controlled by state; Refuses a 13th character

4. **`docking-form` — Forms** · system *Docking Requests* · `solution.tsx` · skills state · live preview
   - Solution exports: `export function DockingForm({ onRequest }: DockingFormProps)`
   - Checks: Submitting doesn't reload the page; Sends the trimmed ship name and the bay as a number; Clears the ship name after a request, keeps the bay; A blank name shows an alert and sends nothing; The alert goes away after a good request

5. **`ledger` — Immutable Updates** · system *Supply Ledger* · `solution.tsx` · skills state, arrays · live preview
   - Solution exports: `export function Ledger()`
   - Checks: Adds items and clears the input; Ignores blank items and trims names; Remove takes out exactly that item — immediately; Total reads "0 items", "1 item", "2 items"; State is never mutated (no push / splice)

6. **`shared-power` — Lifting State Up** · system *Power Distribution* · `solution.tsx` · skills state, components · live preview
   - Starter says: Two components, two copies of the power level. Boost in the controls, and the readout never hears about it. Lift the state up: Reactor owns \`power\` (starts at 50, stays within 0–100). Readout just displays what it's given. Controls just reports clicks.
   - Solution exports: `export function Readout({ power }: { power: number })`; `export function Controls({ onBoost, onVent }: ControlsProps)`; `export function Reactor()`
   - Type checks: Readout and Controls take typed props
   - Checks: Readout shows the power it is given; Controls report clicks through callbacks; Reactor: Boost raises the readout; Reactor: stays within 0–100%

7. **Quiz `quiz-state` — State of Mind** · system *Control Logic* · skills state · 6 questions: count is 0. After one click, what does the screen show?; count is 0. After one click, what does the screen show?; name is "Ada". What gets logged when the button is clicked?; Why doesn't this re-render?; Where should state live when two sibling components both need it?; Which of these should **not** be stored in state?

8. **`checklist` — BOSS: Launch Checklist** ☢ **BOSS** · system *Mission Control* · `solution.tsx` · skills state, components · live preview
   - Starter says: BOSS — the launch checklist.
   - Solution exports: `export interface Task`; `export function Checklist({ initial = [] }: { initial?: string[] })`
   - Type checks: Checklist is a valid component with an optional initial list
   - Checks: Shows the initial tasks, none done; Ticking a task marks it done; Adding a task through the form; "Clear completed" removes finished tasks, and is disabled when there are none; "All systems go" only when every task is done; New tasks get unique ids (toggle after add + clear)


### Floor 9 — Reactor Core (`core`, hue 350)

*Effects, refs, reducers and context.* Outcome shown on the map: “You can wire components to timers, the DOM and shared state with hooks.”

1. **`countdown` — useEffect and Cleanup** · system *Ignition Countdown* · `solution.tsx` · skills effects · live preview
   - Solution exports: `export function Countdown({ from, tickMs = 1000, onDone }: CountdownProps)`
   - Checks: Starts at T-3; Counts all the way down to T-0; Stops at T-0 and calls onDone exactly once; Unmounting stops the timer

2. **`targeting` — useRef** · system *Targeting Computer* · `solution.tsx` · skills hooks · live preview
   - Starter says: &lt;input aria-label="Target" /&gt; &lt;button&gt;Lock on&lt;/button&gt; → moves keyboard focus into the input &lt;button&gt;Fire&lt;/button&gt; → counts a shot; &lt;p className="shots"&gt;Shots: 3&lt;/p&gt; The ref isn't connected to anything yet, and TypeScript doesn't know what it will point at.
   - Solution exports: `export function Targeting()`
   - Checks: "Lock on" focuses the target input; Fire counts shots

3. **`use-reducer` — useReducer** · system *Cargo Hold* · `solution.tsx` · skills hooks, state · live preview
   - Starter says: useReducer keeps state, like useState, but every change goes through ONE function you write, the *reducer*: reducer(currentState, action) → nextState Components don't change the state themselves. They *dispatch* an action that describes what happened, and the reducer decides what it means: const [state, dispatch] = useReducer(holdReducer, { crates: 0 }); &lt;button onClick={() =&gt; dispatch({ type: 'load', crates: 5 })}&gt;Load 5&lt;/button&gt; The cargo hold's actions are already typed below. Your jobs: 1. Write the reducer: load → crates goes up by action.crates unload → crates goes down by action.crates, but never below 0 clear → crates goes back to 0 Always return a NEW object, like { ...state, crates: 7 }. Never change \`state\`. 2. Wire up the "Unload 2" and "Clear" buttons. "Load 5" is done for you.
   - Solution exports: `export type HoldState = { crates: number };`; `export type HoldAction =`; `export function holdReducer(state: HoldState, action: HoldAction): HoldState`; `export function CargoHold()`
   - Checks: load adds crates; unload removes crates, but never below 0; clear empties the hold; Returns a new object instead of changing the old one; The buttons dispatch actions

4. **`sequencer` — Reducers with Rules** · system *Ignition Sequencer* · `solution.tsx` · skills hooks, narrowing · live preview
   - Solution exports: `export interface ReactorState`; `export type Action =`; `export function reactorReducer(state: ReactorState, action: Action): ReactorState`; `export const INITIAL: ReactorState = { status: 'offline', temp: 0 };`; `export function ReactorPanel()`
   - Type checks: Actions are a typed union
   - Checks: prime → ignite brings the core online; Out-of-order actions change nothing; heat raises the temperature while online; Above 1000° the core scrams; scram works from any status; The reducer never mutates state; The panel buttons dispatch actions

5. **`use-toggle` — Custom Hooks** · system *Lighting Grid* · `solution.tsx` · skills hooks · live preview
   - Starter says: A custom hook: a boolean plus a function that flips it. const [on, toggle] = useToggle(); starts false const [on, toggle] = useToggle(true); starts true
   - Solution exports: `export function useToggle(initial = false): [boolean, () => void]`; `export function LightSwitch({ label }: { label: string })`
   - Type checks: useToggle returns a [boolean, function] tuple; useToggle takes an optional boolean
   - Checks: LightSwitch toggles ON and OFF; useToggle(true) starts on; Each component gets its own state; Calling toggle twice in one event flips twice

6. **`theme-context` — Context** · system *Station Lighting* · `solution.tsx` · skills hooks · live preview
   - Solution exports: `export type Theme = 'day' | 'night';`; `export const ThemeContext = createContext<ThemeValue | null>(null);`; `export function ThemeProvider({ children }: { children: ReactNode })`; `export function useTheme(): ThemeValue`; `export function Screen({ children }: { children: ReactNode })`; `export function ThemeButton()`
   - Checks: Starts in day mode; The button switches every screen; Works through layers that pass no props; useTheme outside a ThemeProvider throws a helpful error

7. **`generic-list` — Generic Components** · system *Universal Display* · `solution.tsx` · skills generics, components · live preview
   - Starter says: One list component for anything: crew, ships, sensors… &lt;List items={crew} keyOf={(m) =&gt; m.id} render={(m) =&gt; m.name} /&gt; The props are typed \`any\`, so the compiler can't help whoever uses it: \`render\` gets an \`any\`, and typos sail straight through. Make the component generic, so \`render\` and \`keyOf\` receive the real item type.
   - Solution exports: `export function List<T>({ items, keyOf, render, empty = 'Nothing here' }: ListProps<T>)`
   - Type checks: render and keyOf get the item type; Typos in render are caught; Item types flow through
   - Checks: Renders each item with its key function; render can return JSX; Empty list shows the default message; Empty list shows a custom message

8. **Quiz `quiz-effects` — Effect Horizon** · system *Core Diagnostics* · skills effects, hooks · 6 questions: When does this effect run?; What's wrong with this?; Which of these does NOT need an effect?; Changing a ref's `.current`…; You call useState inside an `if`. What happens?; Which value does every component under this provider receive?

9. **`core-reboot` — FINAL BOSS: Core Reboot** ☢ **BOSS** · system *Reactor Core* · `solution.tsx` · skills hooks, effects, state · live preview
   - Starter says: FINAL BOSS — reboot the reactor core.
   - Solution exports: `export type Phase = 'idle' | 'charging' | 'ready' | 'online';`; `export function CoreConsole({ chargeMs = 3000, onOnline }: CoreConsoleProps)`
   - Type checks: CoreConsole takes optional chargeMs and onOnline
   - Checks: Starts idle, with only "Begin charge" enabled; Begin charge → charging; Abort → back to idle at 0; Charges to 100 and becomes ready, then stops its timer; Ignite needs the authorization code; The code alone isn't enough while idle; Ignite brings the core online and reports it once


### Floor 10 — Production Deck (`production`, hue 15)

*Professional React.* Outcome shown on the map: “You build React apps the way professional teams do: resilient to slow and failing networks, fast, accessible and tested.”

1. **`first-fetch` — Fetching Data** · system *Personnel Server* · `solution.tsx` · skills data, effects · live preview
   - Starter says: Data from a server arrives *later*. \`load()\` returns a Promise: a value that isn't ready yet. \`.then(fn)\` runs fn with the crew list once it arrives. This component asks the server for the crew on EVERY render. Each answer updates state, which renders again, which asks again… forever. The personnel server is melting. Fix it: 1. Ask once, when the component appears: move the request into useEffect, with [load] as its list of dependencies. 2. Until the answer arrives, show &lt;p className="loading"&gt;Loading crew…&lt;/p&gt; (Tip: start the state as null, meaning "not loaded yet".) 3. Then show the names: a &lt;ul&gt; with an &lt;li&gt; for each name.
   - Solution exports: `export function CrewList({ load }: { load: () => Promise<string[]> })`
   - Checks: Shows "Loading crew…" while waiting; Shows the names when they arrive; Asks the server only once; Requests from an effect, not during render

2. **`loading-states` — Loading and Error States** · system *Crew Directory* · `solution.tsx` · skills data, effects, state · live preview
   - Starter says: Real data comes from a server, which takes time — and sometimes fails. Every screen that loads data has (at least) three states: loading → &lt;p className="loading"&gt;Loading crew…&lt;/p&gt; loaded → &lt;ul&gt; with an &lt;li&gt; per name failed → &lt;p role="alert"&gt;Couldn't load crew: &lt;error message&gt;&lt;/p&gt; plus a &lt;button&gt;Retry&lt;/button&gt; that loads again \`load\` is the request. Call it when the component appears (and on Retry).
   - Solution exports: `export function CrewLoader({ load }: { load: () => Promise<string[]> })`
   - Checks: Shows a loading message first; Shows the crew when the request succeeds; Shows the error when the request fails; Retry loads again

3. **`race-conditions` — Race Conditions** · system *Ship Search* · `solution.tsx` · skills data, effects
   - Starter says: Search as you type. Each keystroke starts a new request — and requests can come back in ANY order. If "ka" is slow and "kite" is fast, the "ka" results can arrive LAST and overwrite the correct "kite" results. &lt;input aria-label="Search ships" /&gt; &lt;ul&gt; with an &lt;li&gt; per result An empty query shows no results and makes no request. Make sure a stale response can never overwrite a newer one.
   - Solution exports: `export function ShipSearch({ search }: { search: (query: string) => Promise<string[]> })`
   - Checks: Shows the results for a search; An empty query makes no request; A slow, stale response never overwrites a newer one; Clearing the box clears the results

4. **`debounce` — Debouncing** · system *Request Throttle* · `solution.tsx` · skills hooks, effects, performance
   - Starter says: Typing "reactor" fires seven requests — one per letter. Wasteful, and rude to the server. *Debouncing* waits until the user pauses before acting.
   - Solution exports: `export function useDebouncedValue<T>(value: T, delayMs: number): T`; `export function SearchBox({ onSearch, delayMs = 300 }: { onSearch: (text: string) => void; delayMs?: number })`
   - Type checks: useDebouncedValue keeps the value's type
   - Checks: The hook returns the first value straight away; The hook waits for a pause before updating; A burst of typing triggers one search, for the final text; Never searches twice for the same text; No timers left running after unmount

5. **`memoization` — Memoization** · system *Fleet Display* · `solution.tsx` · skills performance, hooks · live preview
   - Solution exports: `export type Ship = { id: string; name: string };`; `export const ShipRow = memo(function ShipRow({ ship, onSelect, onRender }: { ship: Ship; onSelect: (id: string) => void; onRender?: (id: string) => void })`; `export function Fleet({ ships, sortShips, onRowRender }: { ships: Ship[]; sortShips: (ships: Ship[]) => Ship[]; onRowRender?: (id: string) => void })`
   - Checks: Renders the fleet sorted, and selection works; An unrelated update doesn't re-sort; New ships do re-sort; Rows don't re-render when nothing about them changed

6. **`oxygen-field` — Labels and Error Messages** · system *Oxygen Console* · `solution.tsx` · skills a11y, components · live preview
   - Starter says: Lieutenant Osei uses a screen reader. To her, this console is an input with no name, and an error that is never read out. Fix both: 1. A real label, connected to the input with htmlFor → id: &lt;label htmlFor="oxygen"&gt;Oxygen level (%)&lt;/label&gt; &lt;input id="oxygen" … /&gt; A &lt;p&gt; that just happens to sit nearby isn't connected to anything. 2. An error people can perceive. When the value is out of range, show &lt;p id="oxygen-error"&gt;Oxygen must be between 19 and 23&lt;/p&gt; and give the input aria-invalid="true" and aria-describedby="oxygen-error". That links the message to the field, so it's read out when the field has focus. When the value is fine (or empty), show no error and no aria-invalid.
   - Solution exports: `export function OxygenField()`
   - Checks: The input has a connected &lt;label&gt;; No error while the value is fine; An out-of-range value shows the error message; The error is linked to the input with ARIA; Fixing the value clears the error

7. **`accessible-form` — Accessible Forms** · system *Crew Registration* · `solution.tsx` · skills a11y, state · live preview
   - Starter says: A registration form that works for everyone — including people using a screen reader or only a keyboard. Fields (each with a real &lt;label&gt; connected by htmlFor/id): Callsign id="callsign" required, 3–12 characters Email id="email" must contain "@" Errors: - show a field's error after the user leaves it (blur), or on submit - the error is &lt;p id="callsign-error"&gt; / &lt;p id="email-error"&gt; with the message - the input gets aria-invalid="true" and aria-describedby pointing at its error Messages: "Callsign must be 3–12 characters" and "Enter a valid email" On submit: - invalid → show all errors and move keyboard focus to the FIRST invalid field - valid → onRegister({ callsign, email })
   - Solution exports: `export function RegisterForm({ onRegister }: { onRegister: (data: { callsign: string; email: string }) => void })`
   - Checks: Each input has a connected &lt;label&gt;; No errors before the user has done anything; Leaving a field shows its error, linked with ARIA; A failed submit focuses the first invalid field; A valid form registers

8. **`disclosure` — ARIA States and Keys** · system *Incident Reports* · `solution.tsx` · skills a11y, hooks · live preview
   - Starter says: The incident panel opens when you click its title… with a mouse. With a keyboard you can't even reach it: a &lt;div&gt; with onClick isn't focusable, and a screen reader has no idea it does anything. Make it a proper "disclosure" widget: 1. The toggle is a real &lt;button&gt;. Buttons are focusable, and Enter and Space press them, for free. 2. The button says whether it's open, and what it opens: aria-expanded={open} aria-controls="details-panel" 3. The panel is &lt;div id="details-panel"&gt;…&lt;/div&gt;, shown only while open. 4. Pressing Escape (on the button, or anywhere inside the panel) closes it and puts keyboard focus back on the button.
   - Solution exports: `export function Details({ summary, children }: { summary: string; children: ReactNode })`
   - Checks: The toggle is a real &lt;button&gt;; aria-expanded and aria-controls describe the panel; Clicking again closes it; Escape closes it and returns focus to the button

9. **`keyboard-tabs` — Keyboard Navigation** · system *Bridge Tabs* · `solution.tsx` · skills a11y, hooks · live preview
   - Starter says: Accessible tabs, following the WAI-ARIA "tabs" pattern used across the web. &lt;div role="tablist"&gt; &lt;button role="tab" id="tab-&lt;id&gt;" aria-selected aria-controls="panel-&lt;id&gt;" tabIndex={selected ? 0 : -1}&gt;label&lt;/button&gt; … &lt;/div&gt; &lt;div role="tabpanel" id="panel-&lt;id&gt;" aria-labelledby="tab-&lt;id&gt;"&gt;content&lt;/div&gt; Only the selected tab's panel is shown. Clicking a tab selects it. Keyboard, on a focused tab: ArrowRight / ArrowLeft → select AND focus the next / previous tab (wrapping around) Home / End → select and focus the first / last tab "Roving tabIndex": only the selected tab is in the Tab order (tabIndex 0).
   - Solution exports: `export type Tab = { id: string; label: string; content: ReactNode };`; `export function Tabs({ tabs }: { tabs: Tab[] })`
   - Checks: Roles and ARIA attributes; Roving tabIndex; Arrow keys move selection and focus, wrapping around; Home and End

10. **`error-boundary` — Error Boundaries** · system *Bridge Widgets* · `solution.tsx` · skills components, errors
   - Starter says: One broken widget shouldn't take down the whole bridge. An *error boundary* catches errors thrown while rendering its children, and shows a fallback. (Error boundaries must be class components — React has no hook for this yet.) &lt;ErrorBoundary fallback={(error, reset) =&gt; &lt;button onClick={reset}&gt;Retry&lt;/button&gt;}&gt; &lt;Widget /&gt; &lt;/ErrorBoundary&gt; - render children normally while there is no error - after a child throws, render fallback(error, reset) - reset() clears the error, so the children render again - call onError(error) (if given) once for each error caught
   - Solution exports: `export class ErrorBoundary extends Component<Props, State>`
   - Checks: Renders children while nothing is wrong; Shows the fallback when a child throws; Reports each error once with onError; reset() recovers once the problem is fixed

11. **`test-design` — Writing Good Tests** · system *Quality Control* · `solution.ts` · skills testing
   - Starter says: Professionals don't just write code — they write the tests that prove it works. Good tests are chosen carefully: they probe the *edges*, where bugs live. Here is the spec for the station's shipping calculator: shippingCost(weightKg, express) - weight must be greater than 0, otherwise it THROWS - cost is 5 credits plus 2 credits per kg - shipments of 50 kg or more get 10% off (50 itself counts!) - express doubles the final cost You don't write shippingCost. You write the TEST CASES. The station runs your cases against the real calculator (they must all pass) and against several broken versions written by a careless intern. Every broken version must fail at least one of your cases.
   - Solution exports: `export type Case = { weight: number; express: boolean; expected: number };`; `export const cases: Case[] = [`; `export const throwingWeights: number[] = [0, -5];`
   - Checks: Every case is correct for the real calculator; Every throwing weight really throws; Catches the bug: forgets the 5-credit base fee; Catches the bug: only discounts above 50 kg (not at 50); Catches the bug: discounts from 49 kg; Catches the bug: never discounts; Catches the bug: adds 5 for express instead of doubling; Catches the bug: skips the discount on express shipments; Catches the bug: rounds to whole credits; Catches the bug: accepts a weight of 0; Catches the bug: never throws at all

12. **Quiz `quiz-production` — Production Readiness** · system *Launch Review* · skills data, performance, a11y, testing · 6 questions: A user types "a", then "ab". The "a" request is slower. What can go wrong without a cleanup?; `Row` is wrapped in `memo`, but still re-renders on every parent render. Why?; Which of these is accessible to a screen reader?; The spec says "orders of 100 or more ship free". Which pair of test inputs best checks the boundary?; Where should error boundaries go?; A screen loads data. Which states must it handle?

13. **`mission-dashboard` — FINAL BOSS: Mission Control** ☢ **BOSS** · system *Mission Control* · `solution.tsx` · skills data, state, a11y, performance, components · live preview
   - Starter says: FINAL BOSS — Mission Control Dashboard. Everything a real production screen needs, in one component.
   - Solution exports: `export type Ship = { id: string; name: string; status: 'docked' | 'in-flight'; crew: number };`; `export function MissionDashboard({ loadShips }: { loadShips: () => Promise<Ship[]> })`
   - Type checks: MissionDashboard is a valid component
   - Checks: Loading, then the fleet sorted A→Z; Failure shows an alert, and Retry recovers; Search is case-insensitive; Status filters, with aria-pressed; Details open on click and close with Close or Escape; Hooks are called before the early returns

### Spaced review

Learning something once isn't enough to keep it. Every quiz question, plus 40 "does this compile with `strict` on?" cards, form a **review deck**. Each item is tied to the level that teaches its idea (`after`) and joins the player's deck the day after that level is cleared. Every card's verdict is verified against the real compiler by a test, and a test checks that no card unlocks before the TypeScript floors. Write cards that each teach one gotcha, and only about things a lesson has taught. The scheduling rules are in Part 7, and the screen in Part 8.

**`src/content/review.ts`**

~~~~ts
import { ALL_LEVELS } from '.';
import type { CompileCard, ReviewItem } from '../game/types';

// Spaced review: short retrieval questions that come back on a schedule after
// you've learned their topic. Two sources:
//   - every quiz question, unlocked once you've finished that quiz;
//   - "does this compile?" cards, each unlocked by the level that teaches its
//     idea. Every card's verdict is checked against the real compiler (strict
//     mode, the same settings as the levels) by tests/review.test.ts.
// Card ids come from their position: add new cards at the end.
export const COMPILE_CARDS: CompileCard[] = [
  { code: `let fuel: number = "80";`, ok: false, after: 'power-bus', why: 'A string literal is not a number. Annotations are promises the compiler holds you to.' },
  { code: `const names: string[] = ["Ada", "Bo"];\nnames.push("Cy");`, ok: true, after: 'cargo-manifest', why: '`const` stops reassigning the variable, not changing the array it points to.' },
  { code: `function greet(name) {\n  return "Hi " + name;\n}`, ok: false, after: 'power-bus', why: 'Under strict mode, an unannotated parameter is an implicit `any` — an error.' },
  { code: `let id: string | number = 7;\nid = "seven";`, ok: true, after: 'signal-decoder', why: 'Both values fit the union `string | number`.' },
  { code: `function len(s: string | null) {\n  return s.length;\n}`, ok: false, after: 'signal-decoder', why: '`s` is possibly `null`. Narrow it first.' },
  { code: `function len(s: string | null) {\n  return s?.length ?? 0;\n}`, ok: true, after: 'signal-decoder', why: '`?.` short-circuits on null and `??` supplies the fallback.' },
  { code: `const pt: { x: number; y: number } = { x: 1 };`, ok: false, after: 'crew-registry', why: 'Property `y` is missing.' },
  { code: `interface Ship { name: string }\nconst s: Ship = { name: "Kite", crew: 3 };`, ok: false, after: 'crew-registry', why: 'Object literals get an excess property check: `crew` isn\'t in `Ship`.' },
  { code: `interface Ship { name: string }\nconst data = { name: "Kite", crew: 3 };\nconst s: Ship = data;`, ok: true, after: 'crew-registry', why: 'Gotcha! Excess property checks only apply to fresh object literals. `data` has a `name: string`, so it fits.' },
  { code: `type Dir = "up" | "down";\nconst d: Dir = "left";`, ok: false, after: 'literal-locks', why: '"left" is not one of the literal members of `Dir`.' },
  { code: `const pair: [string, number] = ["a", 1, 2];`, ok: false, after: 'cargo-manifest', why: 'A tuple has a fixed length. Three elements don\'t fit `[string, number]`.' },
  { code: `const nums = [1, 2, 3];\nconst doubled: number[] = nums.map((n) => n * 2);`, ok: true, after: 'cargo-manifest', why: '`n` is inferred as `number`, so the result is `number[]`.' },
  { code: `const nums = [1, 2, 3];\nconst hit: number = nums.find((n) => n > 1);`, ok: false, after: 'cargo-manifest', why: '`find` returns `number | undefined` — it might not find anything.' },
  { code: `function first<T>(xs: T[]): T | undefined {\n  return xs[0];\n}\nconst s: string | undefined = first([1, 2]);`, ok: false, after: 'universal-adapter', why: 'T is inferred as `number`, so the result is `number | undefined`, not string.' },
  { code: `const ro: readonly number[] = [1, 2];\nro.push(3);`, ok: false, after: 'config-matrix', why: 'Readonly arrays have no `push`.' },
  { code: `let v: unknown = "hi";\nv.toUpperCase();`, ok: false, after: 'unknown-values', why: '`unknown` must be narrowed before you can use it.' },
  { code: `let v: unknown = "hi";\nif (typeof v === "string") v.toUpperCase();`, ok: true, after: 'unknown-values', why: 'The `typeof` check narrows `unknown` to `string`.' },
  { code: `let a: any = 4;\na.fly.to.the.moon();`, ok: true, after: 'unknown-values', why: '`any` turns checking off. It compiles — and crashes at runtime. That\'s why `any` is dangerous.' },
  { code: `function sign(n: number): string {\n  if (n > 0) return "pos";\n}`, ok: false, after: 'comms-relay', why: 'Not every path returns a string: for n ≤ 0 it returns `undefined`.' },
  { code: `const o = { level: 1 } as const;\no.level = 2;`, ok: false, after: 'satisfies-const', why: '`as const` makes every property readonly.' },
  { code: `type User = { name: string; age?: number };\nconst u: User = { name: "Ada" };\nconst next = u.age + 1;`, ok: false, after: 'crew-registry', why: '`u.age` is possibly `undefined`.' },
  { code: `const el = document.querySelector("input");\nel.value = "x";`, ok: false, after: 'targeting', why: '`querySelector` returns `HTMLInputElement | null`. It might not exist.' },
  { code: `const el = document.querySelector("input");\nif (el) el.value = "x";`, ok: true, after: 'targeting', why: 'With a tag name, TypeScript knows it\'s an `HTMLInputElement`, and the `if` removes `null`.' },
  { code: `const el = document.querySelector(".field");\nif (el) el.value = "x";`, ok: false, after: 'targeting', why: 'A class selector gives a plain `Element`, which has no `value`. You\'d need `querySelector<HTMLInputElement>(…)`.' },
  { code: `import { useState } from "react";\nfunction Fuel() {\n  const [n, setN] = useState(0);\n  setN("full");\n  return null;\n}`, ok: false, after: 'thruster', why: '`useState(0)` holds a number; "full" is a string.' },
  { code: `function Badge({ name }: { name: string }) {\n  return <b>{name}</b>;\n}\nconst el = <Badge />;`, ok: false, after: 'gauge-panel', why: 'The required prop `name` is missing.' },
  { code: `function Badge({ name }: { name: string }) {\n  return <b>{name}</b>;\n}\nconst el = <Badge name="Ada" />;`, ok: true, after: 'gauge-panel', why: 'All required props are there, with the right types.' },
  { code: `const el = <div class="panel" />;`, ok: false, after: 'first-light', why: 'In JSX it\'s `className`. The compiler even suggests it.' },
  { code: `const el = (\n  <input onChange={(e) => console.log(e.target.value)} />\n);`, ok: true, after: 'callsign', why: 'The handler\'s event type is inferred from `onChange` on an `<input>`, so `e.target.value` is a string.' },
  { code: `import { useState } from "react";\nfunction List() {\n  const [items, setItems] = useState([]);\n  setItems(["fuel"]);\n  return null;\n}`, ok: false, after: 'airlock', why: '`useState([])` infers `never[]` — an array that can hold nothing. Write `useState<string[]>([])`.' },
  { code: `import { useRef } from "react";\nfunction Field() {\n  const r = useRef<HTMLInputElement>(null);\n  r.current.focus();\n  return <input ref={r} />;\n}`, ok: false, after: 'targeting', why: '`r.current` is `null` until React attaches it. Use `r.current?.focus()`.' },
  { code: `type Shape =\n  | { kind: "sq"; size: number }\n  | { kind: "circ"; r: number };\nconst area = (s: Shape) =>\n  s.kind === "sq" ? s.size ** 2 : Math.PI * s.r ** 2;`, ok: true, after: 'alarm-router', why: 'Checking the `kind` tag narrows each branch to one member.' },
  { code: `type Shape =\n  | { kind: "sq"; size: number }\n  | { kind: "circ"; r: number };\nconst size = (s: Shape) => s.size;`, ok: false, after: 'alarm-router', why: 'Without narrowing, `size` only exists on one member of the union.' },
  { code: `function sum(...xs: number[]) {\n  return xs.reduce((a, b) => a + b, 0);\n}\nsum(1, 2, "3");`, ok: false, after: 'cargo-manifest', why: '"3" is a string; every rest argument must be a number.' },
  { code: `const crew: string[] = [];\nconst first: string = crew[0];`, ok: true, after: 'cargo-manifest', why: 'Gotcha! Reading by index is typed as the element type, even though `crew[0]` is `undefined` here. TypeScript trusts you with indexes, so check the length first.' },
  { code: `function pick<T, K extends keyof T>(o: T, k: K) {\n  return o[k];\n}\npick({ a: 1 }, "b");`, ok: false, after: 'constraint-field', why: '"b" is not a key of `{ a: number }`.' },
  { code: `function shout(s?: string) {\n  return s.toUpperCase();\n}`, ok: false, after: 'signal-decoder', why: '`s?` means `s` may be `undefined`. Narrow it first, or give it a default: `s = ""`.' },
  { code: `const n = "42".length;\nconst s: string = n;`, ok: false, after: 'power-bus', why: '`.length` is a number, and a number can\'t go where a string was promised.' },
  { code: 'type Bay = `bay-${1 | 2}`;\nconst b: Bay = "bay-3";', ok: false, after: 'template-literal-types', why: '"bay-3" isn\'t one of the two codes `Bay` allows: "bay-1" and "bay-2".' },
  { code: `import type { ReactNode } from "react";\nfunction Panel({ children }: { children: ReactNode }) {\n  return <section>{children}</section>;\n}\nconst p = <Panel>{42}{"text"}{null}</Panel>;`, ok: true, after: 'hull-plating', why: '`ReactNode` accepts numbers, strings, null, elements and arrays of them.' },
];

export const REVIEW_ITEMS: ReviewItem[] = [
  ...ALL_LEVELS.flatMap((level) =>
    level.kind === 'quiz'
      ? level.questions.map((q, i): ReviewItem => ({ id: `${level.id}/${i + 1}`, after: level.id, prompt: q.prompt, code: q.code, options: q.options, answer: q.answer, explain: q.explain }))
      : [],
  ),
  ...COMPILE_CARDS.map((c, i): ReviewItem => ({
    id: `compiles/${i + 1}`,
    after: c.after,
    prompt: 'Does this compile with `strict` on?',
    code: c.code,
    options: ['Yes, it compiles', "No, it's a type error"],
    answer: c.ok ? 0 : 1,
    explain: c.why,
  })),
];

export const reviewItem = (id: string) => REVIEW_ITEMS.find((r) => r.id === id);
~~~~

---

## Part 6. Progress, the save file and the store

All game state is one plain `Save` object. Every rule is a pure function over it, so everything is unit-testable. The store persists the save to `localStorage` on each change.

Key rules:

- **Stars (code levels)**: the first hint on each attempt is free; after that, 3 − (hints revealed without a token), minimum 1 (`FREE_HINTS`, `nextHintCosts`). Seeing the solution caps the attempt at 1 star. **Stars (quizzes)**: 3 − mistakes, minimum 1.
- **XP per level**: quiz 60, code 100, boss 250, × (1 + 0.1 × floor index), × stars/3. Only *improvements* pay, so replaying for the same stars pays nothing.
- **Crawler level**: going from level L to L+1 costs `100 + 25n` XP while n = L − 1 ≤ 10, then `350 + 6(n − 10)`. So the first clear is the first level-up, and because later levels pay more XP, **every floor brings a level-up every two or three clears** (a test enforces this). Max level 50. **Career titles**: Intern (1), Junior Developer (4), Developer (9), Senior Developer (16), Staff Engineer (22), Principal Engineer (29), Reactor Architect (36), Living Legend (45). Clearing everything perfectly ends around level 41, as a Reactor Architect.
- **Unlocking**: levels open in order. A floor's boss is open as soon as the floor's first level is, and beating it opens the next floor. Settings has an "Open every system" switch.
- **Station power** = the percentage of levels done. The title screen's reactor core glows brighter with it.
- `parseSave` validates untrusted JSON field by field and falls back to defaults. (It also migrates a version-1 save from before the reward systems existed. A fresh build can keep that branch, since it is harmless.)

**`src/game/progress.ts`**

~~~~ts
// The save file and the rules about levels: stars, XP, unlocking, crawler
// level. Pure functions over a plain object, so every rule is unit-testable;
// the store persists the object to localStorage.
import { ALL_LEVELS, DECKS } from '../content';
import type { SkillId } from './skills';
import { SKILLS, type School } from './skills';
import type { Level } from './types';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary' | 'celestial';
export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'legendary', 'celestial'];

export interface Box {
  id: string;
  tier: Tier;
  /** What earned it, e.g. "Level clear: Arrays". */
  source: string;
  /** An item this box is guaranteed to contain (a floor boss's Codex scroll). */
  guarantee?: string;
}

export interface LevelProgress {
  done: boolean;
  stars: number; // best so far, 0–3
  hints: number; // hints revealed on the current attempt
  freeHints: number; // …of which were paid for with hint tokens (no star cost)
  solution: boolean; // solution revealed on the current attempt
  runs: number; // runs on the current attempt
  bestSeconds?: number;
  code?: string; // the player's latest code, so leaving never loses work
}

/** Lifetime tallies. Achievements and daily quests are measured against these. */
export interface Counters {
  levelsPassed: number;
  threeStars: number;
  firstTries: number;
  cleanClears: number; // code levels cleared with no hints and no solution
  quizzesDone: number;
  perfectQuizzes: number;
  bossesBeaten: number;
  boxesOpened: number;
  runs: number;
  failedRuns: number;
  tokensUsed: number;
  solutionsSeen: number;
  speedBonuses: number;
  goldSpent: number;
  /** Replays that raised a level's stars. */
  improvedClears: number;
  reviewSessions: number;
  reviewsAnswered: number;
  reviewsCorrect: number;
  /** Review sessions of five or more cards with no mistakes. */
  perfectReviews: number;
  /** Levels explained back in the player's own words. */
  notesWritten: number;
}

export const ZERO_COUNTERS: Counters = {
  levelsPassed: 0, threeStars: 0, firstTries: 0, cleanClears: 0, quizzesDone: 0, perfectQuizzes: 0, bossesBeaten: 0,
  boxesOpened: 0, runs: 0, failedRuns: 0, tokensUsed: 0, solutionsSeen: 0, speedBonuses: 0, goldSpent: 0,
  improvedClears: 0, reviewSessions: 0, reviewsAnswered: 0, reviewsCorrect: 0, perfectReviews: 0, notesWritten: 0,
};

/**
 * A spaced-review card's place in the schedule (a Leitner box): box 0 is new
 * or forgotten, and each right answer moves it up a box and further out.
 */
export interface ReviewState {
  box: number;
  /** The day it's next due, YYYY-MM-DD. */
  due: string;
}

/** What the player wrote when they explained a level back in their own words. */
export interface Note {
  text: string;
  at: number;
}

export type ClassId = 'type-sorcerer' | 'component-artificer' | 'bug-hunter' | 'speedrunner' | 'crowd-favourite';
export type PetKind = 'drone' | 'cat' | 'octopus' | 'owl' | 'fox' | 'dragon';

export interface Notice {
  id: string;
  at: number;
  kind: 'achievement' | 'level-up' | 'skill-up' | 'box' | 'sponsor' | 'fans' | 'feed' | 'quest' | 'streak' | 'loot';
  title: string;
  body: string;
  icon: string;
}

export interface Save {
  v: 2;
  name: string;
  levels: Record<string, LevelProgress>;
  xp: number;
  gold: number;
  viewers: number;
  hintTokens: number;
  /** Levels left on the XP boost (+50%). */
  boosts: number;
  boxes: Box[];
  items: Record<string, number>;
  equipped: { title: string; theme: string; hat: string | null };
  classId: ClassId | null;
  pet: { kind: PetKind; name: string } | null;
  skills: Partial<Record<SkillId, number>>;
  achievements: string[];
  sponsors: string[];
  fanMilestones: number;
  quests: { day: string; ids: string[]; claimed: string[]; base: Counters } | null;
  streak: { day: string; count: number; best: number };
  counters: Counters;
  /** Spaced review: every card that has joined the review deck, by id. */
  reviews: Record<string, ReviewState>;
  /** The player's notebook: their own explanation of each level, by level id. */
  notes: Record<string, Note>;
  inbox: Notice[];
  nextBoxId: number;
  sound: boolean;
  unlockAll: boolean;
}

export const emptySave = (): Save => ({
  v: 2,
  name: '',
  levels: {},
  xp: 0,
  gold: 0,
  viewers: 0,
  hintTokens: 1,
  boosts: 0,
  boxes: [],
  items: { 'title-crawler': 1, 'theme-reactor': 1 },
  equipped: { title: 'title-crawler', theme: 'theme-reactor', hat: null },
  classId: null,
  pet: null,
  skills: {},
  achievements: [],
  sponsors: [],
  fanMilestones: 0,
  quests: null,
  streak: { day: '', count: 0, best: 0 },
  counters: { ...ZERO_COUNTERS },
  reviews: {},
  notes: {},
  inbox: [],
  nextBoxId: 1,
  sound: true,
  unlockAll: false,
});

export const blankLevel = (): LevelProgress => ({ done: false, stars: 0, hints: 0, freeHints: 0, solution: false, runs: 0 });

export function levelState(save: Save, id: string): LevelProgress {
  return save.levels[id] ?? blankLevel();
}

/** Stars for a code level: hints you paid for with stars, and peeking at the solution, cost stars. */
/** Hints you can see on each attempt before they start to cost stars: asking for help should never feel like losing. */
export const FREE_HINTS = 1;

export function codeStars(p: Pick<LevelProgress, 'hints' | 'freeHints' | 'solution'>): number {
  if (p.solution) return 1;
  return 3 - Math.min(Math.max(0, p.hints - (p.freeHints ?? 0) - FREE_HINTS), 2);
}

/** Would revealing the next hint (without a token) cost a star? */
export function nextHintCosts(p: Pick<LevelProgress, 'hints' | 'freeHints' | 'solution'>): boolean {
  return codeStars({ ...p, hints: p.hints + 1 }) < codeStars(p);
}

/** Stars for a quiz: one off per wrong answer, never below 1. */
export function quizStars(mistakes: number): number {
  return Math.max(1, 3 - mistakes);
}

// ---------------------------------------------------------------- floors and levels

export function floorOf(levelId: string): { index: number; id: string; name: string } {
  const index = DECKS.findIndex((d) => d.levels.some((l) => l.id === levelId));
  return { index, id: DECKS[index]?.id ?? '', name: DECKS[index]?.name ?? '' };
}

/** The school a level belongs to: floors 1–3 are JavaScript, 4–6 TypeScript, 7–10 React. */
export function levelSchool(level: Level): School {
  const index = floorOf(level.id).index;
  return index < 3 ? 'JavaScript' : index < 6 ? 'TypeScript' : 'React';
}

export const isBoss = (level: Level) => level.kind === 'code' && !!level.boss;

/** Full XP for a level, growing gently floor by floor (×1.0 on Floor 1 up to ×1.9 on Floor 10). */
export function maxXp(level: Level): number {
  const base = level.kind === 'quiz' ? 60 : isBoss(level) ? 250 : 100;
  return Math.round(base * (1 + Math.max(0, floorOf(level.id).index) * 0.1));
}

export function xpFor(level: Level, stars: number): number {
  return Math.round((maxXp(level) * stars) / 3);
}

/**
 * Levels unlock in order. A floor's boss is also open as soon as you reach the
 * floor ("skip the floor by beating its boss"), and beating it opens the next floor.
 */
export function isUnlocked(save: Save, id: string): boolean {
  if (save.unlockAll) return true;
  const index = ALL_LEVELS.findIndex((l) => l.id === id);
  if (index < 0) return false;
  if (index === 0 || levelState(save, id).done) return true;
  if (levelState(save, ALL_LEVELS[index - 1].id).done) return true;
  const level = ALL_LEVELS[index];
  if (isBoss(level)) {
    const floor = DECKS[floorOf(id).index];
    return isUnlocked(save, floor.levels[0].id);
  }
  return false;
}

export function stationPower(save: Save): number {
  const done = ALL_LEVELS.filter((l) => levelState(save, l.id).done).length;
  return Math.round((done / ALL_LEVELS.length) * 100);
}

export function floorCleared(save: Save, floorIndex: number): boolean {
  const deck = DECKS[floorIndex];
  return !!deck && deck.levels.every((l) => levelState(save, l.id).done);
}

// ---------------------------------------------------------------- crawler level

/**
 * XP to go from crawler level L to L+1. It starts at 100 (so your first level
 * clear is your first level-up) and rises by 25 a level until level 11. After
 * that it rises by only 6 a level: later levels pay more XP, so every floor
 * brings a level-up every two or three clears.
 */
export function xpForNext(level: number): number {
  const n = level - 1;
  return n <= 10 ? 100 + 25 * n : 350 + 6 * (n - 10);
}

/** Total XP needed to reach crawler level L. */
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNext(l);
  return total;
}

export const MAX_LEVEL = 50;

export const CAREER = [
  { level: 1, title: 'Intern' },
  { level: 4, title: 'Junior Developer' },
  { level: 9, title: 'Developer' },
  { level: 16, title: 'Senior Developer' },
  { level: 22, title: 'Staff Engineer' },
  { level: 29, title: 'Principal Engineer' },
  { level: 36, title: 'Reactor Architect' },
  { level: 45, title: 'Living Legend' },
];

export function careerTitle(level: number): string {
  let title = CAREER[0].title;
  for (const c of CAREER) if (level >= c.level) title = c.title;
  return title;
}

export function crawlerLevel(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  const floor = xpToReach(level);
  const next = level < MAX_LEVEL ? xpToReach(level + 1) : floor;
  return {
    level,
    title: careerTitle(level),
    into: xp - floor,
    span: next - floor,
    progress: level < MAX_LEVEL ? (xp - floor) / (next - floor) : 1,
    toNext: level < MAX_LEVEL ? next - xp : 0,
  };
}

// ---------------------------------------------------------------- persistence

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const obj = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});

function parseLevels(raw: unknown): Record<string, LevelProgress> {
  const levels: Record<string, LevelProgress> = {};
  for (const [id, l] of Object.entries(obj(raw))) {
    if (!l || typeof l !== 'object') continue;
    const hints = Math.min(3, num(l.hints, 0));
    levels[id] = {
      done: l.done === true,
      stars: Math.min(3, num(l.stars, 0)),
      hints,
      freeHints: Math.min(hints, num(l.freeHints, 0)),
      solution: l.solution === true,
      runs: num(l.runs, 0),
      ...(typeof l.bestSeconds === 'number' && l.bestSeconds >= 0 ? { bestSeconds: l.bestSeconds } : {}),
      ...(typeof l.code === 'string' ? { code: l.code } : {}),
    };
  }
  return levels;
}

/**
 * Validate untrusted JSON from storage field by field. Anything odd falls back
 * to defaults; a version-1 save (from before the reward systems) is migrated,
 * keeping its levels, stars and XP.
 */
export function parseSave(raw: string | null): Save {
  const base = emptySave();
  if (!raw) return base;
  let data: Record<string, any>;
  try {
    data = obj(JSON.parse(raw));
  } catch {
    return base;
  }
  if (data.v !== 1 && data.v !== 2) return base;

  const save: Save = {
    ...base,
    levels: parseLevels(data.levels),
    xp: num(data.xp, 0),
    sound: data.sound !== false,
    unlockAll: data.unlockAll === true,
  };
  if (data.v === 1) {
    // Credit what v1 players already did: one point per finished level's skills.
    for (const level of ALL_LEVELS) {
      if (save.levels[level.id]?.done) for (const s of level.skills) save.skills[s] = (save.skills[s] ?? 0) + 1;
    }
    save.counters.levelsPassed = Object.values(save.levels).filter((l) => l.done).length;
    save.counters.threeStars = Object.values(save.levels).filter((l) => l.stars === 3).length;
    return save;
  }

  const counters = obj(data.counters);
  const items: Record<string, number> = { ...base.items };
  for (const [k, v] of Object.entries(obj(data.items))) if (typeof v === 'number' && v > 0) items[k] = Math.floor(v);
  const equipped = obj(data.equipped);
  const pet = obj(data.pet);
  const quests = obj(data.quests);
  const streak = obj(data.streak);
  const skills: Partial<Record<SkillId, number>> = {};
  for (const [k, v] of Object.entries(obj(data.skills))) if (k in SKILLS) skills[k as SkillId] = num(v, 0);

  return {
    ...save,
    name: str(data.name, '').slice(0, 24),
    gold: num(data.gold, 0),
    viewers: num(data.viewers, 0),
    hintTokens: num(data.hintTokens, 0),
    boosts: num(data.boosts, 0),
    boxes: Array.isArray(data.boxes)
      ? data.boxes
          .filter((b: any) => b && typeof b.id === 'string' && TIERS.includes(b.tier))
          .map((b: any) => ({ id: b.id, tier: b.tier, source: str(b.source, 'Mystery'), ...(typeof b.guarantee === 'string' ? { guarantee: b.guarantee } : {}) }))
      : [],
    items,
    equipped: {
      title: items[equipped.title] ? equipped.title : base.equipped.title,
      theme: items[equipped.theme] ? equipped.theme : base.equipped.theme,
      hat: typeof equipped.hat === 'string' && items[equipped.hat] ? equipped.hat : null,
    },
    classId: (['type-sorcerer', 'component-artificer', 'bug-hunter', 'speedrunner', 'crowd-favourite'] as const).find((c) => c === data.classId) ?? null,
    pet: typeof pet.kind === 'string' && ['drone', 'cat', 'octopus', 'owl', 'fox', 'dragon'].includes(pet.kind) ? { kind: pet.kind as PetKind, name: str(pet.name, 'Pal').slice(0, 20) } : null,
    skills,
    achievements: Array.isArray(data.achievements) ? data.achievements.filter((a: unknown) => typeof a === 'string') : [],
    sponsors: Array.isArray(data.sponsors) ? data.sponsors.filter((a: unknown) => typeof a === 'string') : [],
    fanMilestones: num(data.fanMilestones, 0),
    quests:
      typeof quests.day === 'string' && Array.isArray(quests.ids)
        ? {
            day: quests.day,
            ids: quests.ids.filter((x: unknown) => typeof x === 'string'),
            claimed: Array.isArray(quests.claimed) ? quests.claimed.filter((x: unknown) => typeof x === 'string') : [],
            base: Object.fromEntries(Object.keys(ZERO_COUNTERS).map((k) => [k, num(obj(quests.base)[k], 0)])) as unknown as Counters,
          }
        : null,
    streak: { day: str(streak.day, ''), count: num(streak.count, 0), best: num(streak.best, 0) },
    counters: Object.fromEntries(Object.keys(ZERO_COUNTERS).map((k) => [k, num(counters[k], 0)])) as unknown as Counters,
    reviews: Object.fromEntries(
      Object.entries(obj(data.reviews)).flatMap(([id, r]) =>
        r && typeof r.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.due) ? [[id, { box: Math.min(10, Math.floor(num(r.box, 0))), due: r.due }]] : [],
      ),
    ),
    notes: Object.fromEntries(
      Object.entries(obj(data.notes)).flatMap(([id, n]) => (n && typeof n.text === 'string' ? [[id, { text: n.text.slice(0, 600), at: num(n.at, 0) }]] : [])),
    ),
    inbox: Array.isArray(data.inbox) ? data.inbox.filter((n: any) => n && typeof n.title === 'string').slice(-60) : [],
    nextBoxId: num(data.nextBoxId, 1),
  };
}
~~~~

The store is a tiny external store read with `useSyncExternalStore`. `act()` runs a reward-engine action, saves the result, adds notices to the inbox, and broadcasts the reward events to the UI (the announcer, the companion, offers):

**`src/game/store.ts`**

~~~~ts
// The one piece of shared game state: the save. A tiny external store, read
// with useSyncExternalStore and persisted on every change. Reward events from
// the engine are broadcast to the UI (for announcements) and logged in the inbox.
import { useSyncExternalStore } from 'react';
import { parseSave, type Save } from './progress';
import { dayOf, ensureQuests, noticesFor, syncReviews, type Result, type Reward } from './rewards';

const KEY = 'reactor-quest/save';

function load(): Save {
  try {
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return parseSave(null);
  }
}

const today = () => dayOf(new Date());
// Every change also brings newly earned review cards into the deck, and today's quests.
const settle = (s: Save) => ensureQuests(syncReviews(s, today()), today());

let save = settle(load());
const listeners = new Set<() => void>();
const rewardListeners = new Set<(events: Reward[]) => void>();

export function getSave() {
  return save;
}

function commit(next: Save) {
  save = settle(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lasts for this session */
  }
  listeners.forEach((l) => l());
}

/** Replace the save with a plain update (no rewards involved). */
export function setSave(update: (s: Save) => Save) {
  commit(update(save));
}

/** Run a reward-engine action: store the new save, log and announce its events. */
export function act(action: (s: Save) => Result | null): Reward[] {
  const result = action(save);
  if (!result) return [];
  const notices = noticesFor(result.events, Date.now());
  commit(notices.length ? { ...result.save, inbox: [...result.save.inbox, ...notices].slice(-60) } : result.save);
  if (result.events.length) rewardListeners.forEach((l) => l(result.events));
  return result.events;
}

export function useSave(): Save {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => save,
  );
}

export function onRewards(listener: (events: Reward[]) => void) {
  rewardListeners.add(listener);
  return () => {
    rewardListeners.delete(listener);
  };
}
~~~~

---

## Part 7. The reward engine and the loot catalogue

This is the *Dungeon Crawler Carl* layer, and the source of most of the fun. It is pure functions too: each takes a save and returns a new save plus a list of **events** for the UI to announce. Randomness is injected (`rng`), so tests use a seeded generator.

What happens when a level is cleared (`completeLevel`):

1. **XP** for improved stars. +25% if the player's class matches the level's school (Type Sorcerer for TypeScript, Component Artificer for React). +50% if an XP boost is active, which uses one boost. Each level-up gives a box (bronze; silver every 5th level; gold every 10th) and 10 + 5 × level gold.
2. **Gold**: on first clear, 10 (quiz 6, boss 40) + 5 per star, plus a hidden **speed bonus** of 15 if cleared under par: 6 min for a level, 3 for a quiz, 15 for a boss. Bug Hunters get +20% gold.
3. **Viewers**: (30 + 20 × floor index) × stars. ×2 on a first-try pass, ×3 for a boss, halved on replays, ×1.5 for Crowd Favourites. **Fan milestones** at 100, 1K, 5K, 25K, 100K, 500K, 1M and 5M viewers each send a Fan Box.
4. **Skill points** (Part 5).
5. **Boxes**, for bosses only (a box for every level piled up faster than anyone opened them: a perfect run now brings about 110 boxes instead of 280): a **gold Boss Box** on a boss's first clear, which always contains that floor's Codex scroll, a silver "Flawless" box for first reaching 3 stars on a boss, a **platinum Sponsor Box** when a whole floor is cleared (legendary for Floor 10), and the **Celestial Box** when the whole station is restored.
6. **Counters** feed achievements and daily quests. **THE FEED** comments with a line chosen by how it went: boss, first try, flawless, struggle (5+ failed runs), peeked at the solution, or normal.
7. **Offers**: the companion pet is offered after Floor 1's boss, and the class after Floor 3's boss.
8. **Achievements** are checked (58 in all, each with its own box, some with a title).

After a clear, the player can also **explain it back** (`saveNote`): notes earn no XP, deliberately (a reward for any five words invites five words). The first note of five or more words for a level counts toward the Rubber Duck achievement and the daily quest. The Archivist class earns +50% XP from review. **Spaced review** (`syncReviews`, `dueReviews`, `answerReview`, `finishReview`) uses Leitner boxes: a right answer moves a card up a box and due again after 3, 7, 14, 30 or 60 days; a wrong one sends it to box 0, due tomorrow. Only the first answer in a session counts. A right answer earns 12 XP and a wrong one 4, because effort counts too. The store syncs the deck on every change, so newly cleared levels add their cards straight away.

Also included: opening boxes (loot tables per tier, duplicate cosmetics salvaged for gold, preferring items the player doesn't own), classes and pets, sponsors, daily quests (3 a day, picked by a hash of the date, so they're the same for everyone that day), streaks (boxes at 3, 7, 14 and 30 days), the **Safe Room** shop, and the small actions: run, hint, solution, replay. Copy this file exactly; the numbers are tuned.

**`src/game/rewards.ts`**

~~~~ts
// The reward engine: everything that happens when you clear a level — XP and
// crawler levels, gold, viewers, skill points, loot boxes, sponsors,
// achievements, daily quests — plus opening boxes, the shop, classes and pets.
// Every function takes a save and returns a new one alongside a list of
// events for the UI to announce. Randomness is injected, so it's testable.
import { ALL_LEVELS, DECKS } from '../content';
import { REVIEW_ITEMS } from '../content/review';
import { ALL_ITEMS, FLOOR_SCROLLS, item, RARITY_ORDER, type Item, type Rarity } from './items';
import {
  codeStars,
  crawlerLevel,
  floorCleared,
  floorOf,
  isBoss,
  levelSchool,
  levelState,
  nextHintCosts,
  xpFor,
  xpToReach,
  type Box,
  type ClassId,
  type Counters,
  type Notice,
  type PetKind,
  type Save,
  type Tier,
} from './progress';
import { MAX_SKILL_LEVEL, SKILLS, skillLevel, type SkillId } from './skills';
import type { Level, ReviewItem } from './types';

export type Rng = () => number;

export type Reward =
  | { kind: 'xp'; amount: number; detail: string }
  | { kind: 'gold'; amount: number; detail: string }
  | { kind: 'viewers'; amount: number; total: number }
  | { kind: 'level-up'; level: number; title: string; newTitle: boolean }
  | { kind: 'skill-up'; skill: SkillId; level: number }
  | { kind: 'box'; box: Box }
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'sponsor'; sponsor: Sponsor; floor: string }
  | { kind: 'fans'; milestone: number }
  | { kind: 'feed'; text: string }
  | { kind: 'streak'; count: number }
  | { kind: 'offer'; what: 'class' | 'pet' };

export interface Result {
  save: Save;
  events: Reward[];
}

// ---------------------------------------------------------------- boxes

export const TIER_INFO: Record<Tier, { name: string; color: string; icon: string }> = {
  bronze: { name: 'Bronze', color: '#cd8b52', icon: '🟫' },
  silver: { name: 'Silver', color: '#c9d3e3', icon: '⬜' },
  gold: { name: 'Gold', color: '#ffc94d', icon: '🟨' },
  platinum: { name: 'Platinum', color: '#9be6ff', icon: '🟦' },
  legendary: { name: 'Legendary', color: '#ff8a3d', icon: '🟧' },
  celestial: { name: 'Celestial', color: '#e8b6ff', icon: '🟪' },
};

export function addBox(save: Save, tier: Tier, source: string, guarantee?: string): Result {
  const box: Box = { id: `box-${save.nextBoxId}`, tier, source, ...(guarantee ? { guarantee } : {}) };
  return { save: { ...save, boxes: [...save.boxes, box], nextBoxId: save.nextBoxId + 1 }, events: [{ kind: 'box', box }] };
}

const LOOT: Record<Tier, { rolls: number; gold: [number, number]; weights: Partial<Record<Rarity, number>>; tokens: number; boosts: number; minRarity?: Rarity }> = {
  bronze: { rolls: 2, gold: [10, 25], weights: { common: 80, uncommon: 18, rare: 2 }, tokens: 0, boosts: 0 },
  silver: { rolls: 3, gold: [25, 60], weights: { common: 50, uncommon: 38, rare: 11, epic: 1 }, tokens: 0, boosts: 0 },
  gold: { rolls: 4, gold: [60, 140], weights: { common: 25, uncommon: 40, rare: 27, epic: 7, legendary: 1 }, tokens: 1, boosts: 0 },
  platinum: { rolls: 5, gold: [150, 300], weights: { uncommon: 35, rare: 42, epic: 19, legendary: 4 }, tokens: 2, boosts: 2 },
  legendary: { rolls: 5, gold: [300, 600], weights: { rare: 45, epic: 42, legendary: 13 }, tokens: 3, boosts: 3, minRarity: 'legendary' },
  celestial: { rolls: 6, gold: [1000, 1500], weights: { epic: 50, legendary: 50 }, tokens: 5, boosts: 5, minRarity: 'celestial' },
};

export type Loot =
  | { kind: 'gold'; amount: number; note?: string }
  | { kind: 'tokens'; amount: number }
  | { kind: 'boost'; amount: number }
  | { kind: 'item'; item: Item; isNew: boolean };

const SALVAGE: Record<Rarity, number> = { common: 8, uncommon: 20, rare: 50, epic: 120, legendary: 300, celestial: 600 };

function pickWeighted<K extends string>(weights: Partial<Record<K, number>>, rng: Rng): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let roll = rng() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll < 0) return k;
  }
  return entries[entries.length - 1][0];
}

const between = (rng: Rng, [lo, hi]: [number, number]) => Math.round(lo + rng() * (hi - lo));

function droppable(rarity: Rarity): Item[] {
  return ALL_ITEMS.filter((i) => i.drops && i.rarity === rarity);
}

/** Pick an item of this rarity, preferring ones the player doesn't own yet. */
function rollItem(save: Save, rarity: Rarity, rng: Rng): Item | null {
  for (let r = RARITY_ORDER.indexOf(rarity); r >= 0; r--) {
    const pool = droppable(RARITY_ORDER[r]);
    if (!pool.length) continue;
    const fresh = pool.filter((i) => !save.items[i.id]);
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(rng() * from.length)];
  }
  return null;
}

function grantItem(save: Save, it: Item, loot: Loot[]): Save {
  const owned = !!save.items[it.id];
  // Cosmetics and scrolls are unique: a duplicate is salvaged for gold.
  if (owned && it.kind !== 'collectible') {
    loot.push({ kind: 'gold', amount: SALVAGE[it.rarity], note: `Duplicate ${it.name} salvaged` });
    return { ...save, gold: save.gold + SALVAGE[it.rarity] };
  }
  loot.push({ kind: 'item', item: it, isNew: !owned });
  return { ...save, items: { ...save.items, [it.id]: (save.items[it.id] ?? 0) + 1 } };
}

/** Open a box: roll its contents, apply them, and remove it. */
export function openBox(save: Save, boxId: string, rng: Rng): { save: Save; loot: Loot[]; box: Box } | null {
  const box = save.boxes.find((b) => b.id === boxId);
  if (!box) return null;
  const table = LOOT[box.tier];
  const loot: Loot[] = [];
  let s: Save = { ...save, boxes: save.boxes.filter((b) => b.id !== boxId), counters: { ...save.counters, boxesOpened: save.counters.boxesOpened + 1 } };

  const gold = between(rng, table.gold);
  loot.push({ kind: 'gold', amount: gold });
  s = { ...s, gold: s.gold + gold };
  if (table.tokens) {
    loot.push({ kind: 'tokens', amount: table.tokens });
    s = { ...s, hintTokens: s.hintTokens + table.tokens };
  }
  if (table.boosts) {
    loot.push({ kind: 'boost', amount: table.boosts });
    s = { ...s, boosts: s.boosts + table.boosts };
  }
  if (box.guarantee) s = grantItem(s, item(box.guarantee), loot);
  if (table.minRarity) {
    const it = table.minRarity === 'celestial' ? item('orrery-heart') : rollItem(s, table.minRarity, rng);
    if (it) s = grantItem(s, it, loot);
  }
  for (let i = 0; i < table.rolls; i++) {
    const what = rng();
    if (what < 0.22) {
      const g = between(rng, [Math.round(table.gold[0] / 2), Math.round(table.gold[1] / 2)]);
      loot.push({ kind: 'gold', amount: g });
      s = { ...s, gold: s.gold + g };
    } else if (what < 0.3) {
      loot.push({ kind: 'tokens', amount: 1 });
      s = { ...s, hintTokens: s.hintTokens + 1 };
    } else {
      const it = rollItem(s, pickWeighted(table.weights, rng), rng);
      if (it) s = grantItem(s, it, loot);
    }
  }
  return { save: s, loot: mergeLoot(loot), box };
}

/** Combine repeated gold, token and boost lines into one each. */
function mergeLoot(loot: Loot[]): Loot[] {
  const out: Loot[] = [];
  let gold = 0;
  let tokens = 0;
  let boosts = 0;
  for (const l of loot) {
    if (l.kind === 'gold' && !l.note) gold += l.amount;
    else if (l.kind === 'tokens') tokens += l.amount;
    else if (l.kind === 'boost') boosts += l.amount;
    else out.push(l);
  }
  const head: Loot[] = [];
  if (gold) head.push({ kind: 'gold', amount: gold });
  if (tokens) head.push({ kind: 'tokens', amount: tokens });
  if (boosts) head.push({ kind: 'boost', amount: boosts });
  return [...head, ...out];
}

// ---------------------------------------------------------------- classes and pets

export interface ClassInfo {
  id: ClassId;
  name: string;
  icon: string;
  perk: string;
  flavor: string;
}

export const CLASSES: ClassInfo[] = [
  { id: 'type-sorcerer', name: 'Type Sorcerer', icon: '🧙', perk: '+25% XP on TypeScript levels.', flavor: 'Bends the compiler to their will. The compiler has mixed feelings about this.' },
  { id: 'component-artificer', name: 'Component Artificer', icon: '🛠', perk: '+25% XP on React levels.', flavor: 'Builds interfaces out of tiny reusable pieces. Has opinions about prop names.' },
  { id: 'bug-hunter', name: 'Bug Hunter', icon: '🔍', perk: '+20% gold from everything, and a free hint token for every boss you beat.', flavor: 'Tracks bugs across a codebase by scent alone. Smells faintly of coffee.' },
  // (Stored as 'speedrunner' so older saves keep their class: it used to be about speed.)
  { id: 'speedrunner', name: 'Archivist', icon: '📚', perk: '+50% XP from spaced review.', flavor: 'Never forgets a thing. Keeps notes on the notes.' },
  { id: 'crowd-favourite', name: 'Crowd Favourite', icon: '🌟', perk: '+50% viewers, and every Fan Box is one tier better.', flavor: 'The camera loves them. The audience loves them. The compiler is indifferent.' },
];

export const classInfo = (id: ClassId | null) => CLASSES.find((c) => c.id === id) ?? null;

export const PETS: { kind: PetKind; name: string; icon: string; blurb: string }[] = [
  { kind: 'drone', name: 'Maintenance Drone', icon: '🤖', blurb: 'Beeps encouragingly. Fixed a fuse once.' },
  { kind: 'cat', name: "Ship's Cat", icon: '🐈', blurb: 'Sits on the keyboard at the worst possible moment.' },
  { kind: 'octopus', name: 'Octo', icon: '🐙', blurb: 'Can type with eight arms. Chooses not to.' },
  { kind: 'owl', name: 'Debug Owl', icon: '🦉', blurb: 'Stays up all night. Judges your variable names.' },
  { kind: 'fox', name: 'Station Fox', icon: '🦊', blurb: 'Clever, quick, and has stolen three sandwiches.' },
  { kind: 'dragon', name: 'Pocket Dragon', icon: '🐉', blurb: 'Breathes tiny flames at failing tests.' },
];

export const PET_LINES = {
  pass: ['*does a little victory spin*', '*chirps proudly*', '*high-fives you, somehow*', '*knew you could do it*', '*tells the other pets about you*'],
  fail: ['*pats your hand reassuringly*', '*reads the error message with you*', '*offers you a snack*', '*suggests a rubber duck*', '*believes in you*'],
  box: ['*shakes the box*', '*wants the box itself, not what\'s in it*', '*sniffs the loot*'],
};

export function choosePet(save: Save, kind: PetKind, name: string): Save {
  return { ...save, pet: { kind, name: name.trim().slice(0, 20) || PETS.find((p) => p.kind === kind)!.name } };
}

export function chooseClass(save: Save, id: ClassId): Save {
  return { ...save, classId: id };
}

// ---------------------------------------------------------------- sponsors and fans

export interface Sponsor {
  name: string;
  icon: string;
  message: string;
}

/** Each floor you clear, a sponsor sends a gift. All fictional, all slightly desperate. */
export const SPONSORS: Record<string, Sponsor> = {
  boot: { name: 'Quasar Cola', icon: '🥤', message: 'Quasar Cola: the official drink of engineers who just printed "Hello". Fizzier than a stack overflow!' },
  supply: { name: 'Stackwise Bank', icon: '🏦', message: 'Stackwise Bank noticed how well you handle arrays. Have you considered a career in accounting? Please?' },
  modern: { name: 'Null Pointer Insurance', icon: '🛡', message: 'Null Pointer Insurance: for when your code goes undefined. You clearly don\'t need us. Here\'s a gift anyway.' },
  foundry: { name: 'Typesafe Tyres', icon: '🛞', message: 'Typesafe Tyres: strongly typed, never deflated. Our engineers watched you work and wept.' },
  lab: { name: 'Generic Brand Generics', icon: '🧪', message: 'Generic Brand Generics<T>: works with whatever you\'ve got. Congratulations from all of us, whoever we are.' },
  vault: { name: 'Infer & Daughters', icon: '⚖', message: 'Infer & Daughters, Type-Level Solicitors: we have read your conditional types and are legally obliged to be impressed.' },
  bay: { name: 'Pixel Perfect Paints', icon: '🖌', message: 'Pixel Perfect Paints: we only sponsor engineers whose components are pure. You qualify. Barely.' },
  control: { name: 'StateFarm Hydroponics', icon: '🌱', message: 'StateFarm Hydroponics: we grow things immutably. Our tomatoes have never been mutated. Neither has your state.' },
  core: { name: 'Hookline Fishing Co.', icon: '🎣', message: 'Hookline Fishing Co.: we know a good hook when we see one. useEffect, useRef, useReducer… you caught them all.' },
  production: { name: 'The Consortium of Everything', icon: '🌌', message: 'The Consortium of Everything has been watching since Floor 1. On behalf of every viewer in the galaxy: well done, engineer.' },
};

export const FAN_MILESTONES = [100, 1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000, 5_000_000];
const FAN_TIERS: Tier[] = ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'legendary'];

function nextTier(t: Tier): Tier {
  const all: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'legendary', 'celestial'];
  return all[Math.min(all.length - 2, all.indexOf(t) + 1)];
}

export function addViewers(save: Save, amount: number): Result {
  const events: Reward[] = [];
  let s: Save = { ...save, viewers: save.viewers + amount };
  events.push({ kind: 'viewers', amount, total: s.viewers });
  while (s.fanMilestones < FAN_MILESTONES.length && s.viewers >= FAN_MILESTONES[s.fanMilestones]) {
    const milestone = FAN_MILESTONES[s.fanMilestones];
    let tier = FAN_TIERS[s.fanMilestones];
    if (s.classId === 'crowd-favourite') tier = nextTier(tier);
    s = { ...s, fanMilestones: s.fanMilestones + 1 };
    events.push({ kind: 'fans', milestone });
    const r = addBox(s, tier, `Fan Box: ${formatViewers(milestone)} viewers`);
    s = r.save;
    events.push(...r.events);
  }
  return { save: s, events };
}

export function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return String(n);
}

// ---------------------------------------------------------------- XP and skills

/** Add XP and pay out any level-ups: a box per level (better every 5th and 10th) and some gold. */
export function addXp(save: Save, amount: number, detail: string): Result {
  if (amount <= 0) return { save, events: [] };
  const before = crawlerLevel(save.xp);
  let s: Save = { ...save, xp: save.xp + amount };
  const events: Reward[] = [{ kind: 'xp', amount, detail }];
  const after = crawlerLevel(s.xp);
  for (let level = before.level + 1; level <= after.level; level++) {
    const title = crawlerLevel(xpToReach(level)).title;
    const prevTitle = crawlerLevel(xpToReach(level - 1)).title;
    events.push({ kind: 'level-up', level, title, newTitle: title !== prevTitle });
    const tier: Tier = level % 10 === 0 ? 'gold' : level % 5 === 0 ? 'silver' : 'bronze';
    const r = addBox(s, tier, `Level-Up Box: level ${level}`);
    // Level-ups come often, so the gold bonus grows gently with level.
    const gold = 10 + 5 * level;
    s = { ...r.save, gold: r.save.gold + gold };
    events.push(...r.events, { kind: 'gold', amount: gold, detail: `Level ${level} bonus` });
  }
  return { save: s, events };
}

export function addSkillPoints(save: Save, skills: SkillId[], points: number): Result {
  const events: Reward[] = [];
  const next = { ...save.skills };
  for (const skill of skills) {
    const before = skillLevel(next[skill] ?? 0);
    next[skill] = (next[skill] ?? 0) + points;
    const after = Math.min(MAX_SKILL_LEVEL, skillLevel(next[skill]!));
    if (after > before) events.push({ kind: 'skill-up', skill, level: after });
  }
  return { save: { ...save, skills: next }, events };
}

// ---------------------------------------------------------------- completing a level

export interface Outcome {
  stars: number;
  /** Code levels: passed on the very first run of this attempt. */
  firstTry: boolean;
  /** Code levels: failed runs before passing (on this attempt). */
  failedRuns: number;
  /** Code levels: no hints at all and no solution on this attempt. */
  clean: boolean;
  /** Quizzes: answered without a single mistake. */
  perfect?: boolean;
  /** Seconds spent on the level this visit. */
  seconds: number;
}

/** Par time for a speed bonus: a generous target, not a race. */
export function parSeconds(level: Level): number {
  return level.kind === 'quiz' ? 180 : isBoss(level) ? 900 : 360;
}

const FEED = {
  firstTry: [
    'First try! The chat is going absolutely feral.',
    'Did you SEE that? First run, all green. Somebody check if they\'re a robot.',
    'Not a single failed run. Our producers are in tears. Happy ones. Mostly.',
  ],
  flawless: [
    'Three stars! The sponsors are reaching for their wallets.',
    'Flawless. FLAWLESS. We may have to replay that in slow motion.',
  ],
  struggle: [
    'After a heroic number of attempts — victory! Viewers love a comeback.',
    'Persistence pays, folks. Literally. In loot boxes.',
  ],
  solution: [
    'They peeked at the solution. We saw that. The whole galaxy saw that.',
    'A solution was "consulted". Our legal team prefers the term "research".',
  ],
  boss: [
    'THE BOSS IS DOWN! Ratings are through the roof — and the roof is in space!',
    'Boss defeated! Somewhere, a sponsor is printing a very large cheque.',
  ],
  normal: [
    'Another system back online. Steady hands, steady ratings.',
    'Clean work. The audience nods approvingly. Some of them have several heads.',
    'Progress! The station hums. The chat spams little reactor emojis.',
  ],
};
const pick = <T,>(xs: T[], rng: Rng) => xs[Math.floor(rng() * xs.length)];

/**
 * Everything that happens when a level is passed. XP, gold and viewers are
 * paid only for *improvements* (a first clear, or more stars than before), so
 * replays can't be farmed — but they can still earn the stars you missed.
 */
export function completeLevel(save: Save, level: Level, outcome: Outcome, rng: Rng): Result {
  const prev = levelState(save, level.id);
  const firstClear = !prev.done;
  const best = Math.max(prev.stars, outcome.stars);
  const school = levelSchool(level);
  const floor = floorOf(level.id);
  const boss = isBoss(level);
  const events: Reward[] = [];
  let s: Save = {
    ...save,
    levels: { ...save.levels, [level.id]: { ...prev, done: true, stars: best, bestSeconds: Math.min(prev.bestSeconds ?? Infinity, outcome.seconds) } },
  };
  const apply = (r: Result) => {
    s = r.save;
    events.push(...r.events);
  };

  // XP: for the stars you improved, with class and boost bonuses.
  const baseXp = Math.max(0, xpFor(level, best) - xpFor(level, prev.stars));
  if (baseXp > 0) {
    let multiplier = 1;
    const parts: string[] = [];
    if ((s.classId === 'type-sorcerer' && school === 'TypeScript') || (s.classId === 'component-artificer' && school === 'React')) {
      multiplier += 0.25;
      parts.push('class +25%');
    }
    if (s.boosts > 0) {
      multiplier += 0.5;
      parts.push('boost +50%');
      s = { ...s, boosts: s.boosts - 1 };
    }
    apply(addXp(s, Math.round(baseXp * multiplier), parts.length ? parts.join(', ') : 'level clear'));
  }

  // Gold: a clear, its stars, and a speed bonus on first clears.
  let gold = firstClear ? (boss ? 40 : level.kind === 'quiz' ? 6 : 10) + best * 5 : Math.max(0, best - prev.stars) * 5;
  const underPar = firstClear && outcome.seconds <= parSeconds(level);
  if (underPar) gold += 15;
  if (s.classId === 'bug-hunter') gold = Math.round(gold * 1.2);
  if (gold > 0) {
    s = { ...s, gold: s.gold + gold };
    events.push({ kind: 'gold', amount: gold, detail: underPar ? 'clear + speed bonus' : 'clear' });
  }

  // Viewers: grow with the floor you're on, and love a show.
  if (firstClear || best > prev.stars) {
    let v = (30 + 20 * Math.max(0, floor.index)) * best;
    if (outcome.firstTry) v *= 2;
    if (boss) v *= 3;
    if (!firstClear) v = Math.round(v / 2);
    if (s.classId === 'crowd-favourite') v = Math.round(v * 1.5);
    apply(addViewers(s, v));
  }

  // Skill points: one for the first clear, one more for reaching three stars.
  if (firstClear) apply(addSkillPoints(s, level.skills, 1));
  if (best === 3 && prev.stars < 3) apply(addSkillPoints(s, level.skills, 1));

  // Loot.
  // Boxes are for bosses. Ordinary clears pay XP, gold and stars: a box for
  // every one of them piled up faster than anyone opened them, and stopped
  // meaning anything.
  if (firstClear && boss) apply(addBox(s, 'gold', `Boss Box: ${level.system}`, FLOOR_SCROLLS[floor.id]));
  if (boss && best === 3 && prev.stars < 3) apply(addBox(s, 'silver', `Flawless: ${level.title}`));
  if (firstClear && boss && s.classId === 'bug-hunter') s = { ...s, hintTokens: s.hintTokens + 1 };

  // Counters, for achievements and quests.
  const c = { ...s.counters };
  if (firstClear) c.levelsPassed++;
  if (best === 3 && prev.stars < 3) c.threeStars++;
  if (outcome.firstTry) c.firstTries++;
  if (outcome.clean && level.kind === 'code') c.cleanClears++;
  if (level.kind === 'quiz') c.quizzesDone++;
  if (outcome.perfect) c.perfectQuizzes++;
  if (firstClear && boss) c.bossesBeaten++;
  if (underPar) c.speedBonuses++;
  if (!firstClear && best > prev.stars) c.improvedClears++;
  s = { ...s, counters: c };

  // A whole floor cleared: the sponsor sends a gift.
  if (floor.index >= 0 && floorCleared(s, floor.index) && !s.sponsors.includes(floor.id)) {
    const sponsor = SPONSORS[floor.id];
    s = { ...s, sponsors: [...s.sponsors, floor.id] };
    events.push({ kind: 'sponsor', sponsor, floor: DECKS[floor.index].name });
    apply(addBox(s, floor.id === 'production' ? 'legendary' : 'platinum', `Sponsor Box: ${sponsor.name}`));
  }
  // The whole station restored: the Celestial box.
  if (ALL_LEVELS.every((l) => levelState(s, l.id).done) && !s.sponsors.includes('station')) {
    s = { ...s, sponsors: [...s.sponsors, 'station'] };
    apply(addBox(s, 'celestial', 'Celestial Box: Station Restored'));
  }

  // The commentary.
  const lines = boss ? FEED.boss : outcome.firstTry ? FEED.firstTry : best === 3 && prev.stars < 3 ? FEED.flawless : outcome.failedRuns >= 5 ? FEED.struggle : levelState(save, level.id).solution ? FEED.solution : FEED.normal;
  events.push({ kind: 'feed', text: pick(lines, rng) });

  // Offers that unlock with progress.
  if (floor.id === 'boot' && boss && !s.pet) events.push({ kind: 'offer', what: 'pet' });
  if (floor.id === 'modern' && boss && !s.classId) events.push({ kind: 'offer', what: 'class' });

  apply(checkAchievements(s));
  return { save: s, events };
}

/** Code levels: compute the outcome from the attempt's progress record. */
export function codeOutcome(save: Save, level: Level, seconds: number): Outcome {
  const p = levelState(save, level.id);
  return {
    stars: codeStars(p),
    firstTry: p.runs === 1,
    failedRuns: Math.max(0, p.runs - 1),
    clean: p.hints === 0 && !p.solution,
    seconds,
  };
}

// ---------------------------------------------------------------- achievements

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  /** What you did. */
  description: string;
  /** What THE FEED says about it. */
  quip: string;
  tier: Tier;
  /** A title unlocked along with it. */
  title?: string;
  earned(save: Save): boolean;
}

const skillLevels = (s: Save) => Object.values(s.skills).map((p) => skillLevel(p ?? 0));
const ownedCount = (s: Save, kind?: string) => Object.keys(s.items).filter((id) => !kind || ALL_ITEMS.find((i) => i.id === id)?.kind === kind).length;
const level = (s: Save) => crawlerLevel(s.xp).level;

const FLOOR_ACHIEVEMENTS: { name: string; icon: string; quip: string }[] = [
  { name: 'Booted Up', icon: '💡', quip: 'You can now make a computer do things. Use this power responsibly. Or entertainingly.' },
  { name: 'Supply Chain', icon: '📦', quip: 'Arrays, loops and reduce. The quartermaster has asked for your autograph.' },
  { name: 'Modern Times', icon: '✨', quip: 'Closures, async, classes. You now write JavaScript better than most of the internet.' },
  { name: 'Type Founder', icon: '🔩', quip: 'The compiler is no longer your enemy. It\'s your extremely pedantic friend.' },
  { name: 'Lab Director', icon: '🧪', quip: 'Generics! Unions! Utility types! The lab coats suit you.' },
  { name: 'Vault Breaker', icon: '🔐', quip: 'You wrote a schema library. People get jobs for that. Real ones.' },
  { name: 'Component Architect', icon: '🧩', quip: 'Your components are small, typed and reusable. Unlike most furniture.' },
  { name: 'Mission Controller', icon: '🎛', quip: 'State, events, forms. The Control Room finally responds to buttons.' },
  { name: 'Core Engineer', icon: '☢', quip: 'Effects, refs, reducers and context. The reactor is online, and so are you.' },
  { name: 'Ship It', icon: '🚀', quip: 'Loading states, race conditions, accessibility, tests. That\'s not a student. That\'s a professional.' },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'hello-world', name: 'Hello, World', icon: '👋', tier: 'bronze', description: 'Clear your first level.', quip: 'You told a computer to say something and it did. Power is a slippery slope.', earned: (s) => s.counters.levelsPassed >= 1 },
  { id: 'first-try', name: 'First Try', icon: '🎯', tier: 'silver', description: 'Pass a code level on your very first run.', quip: 'No failed runs. Not one. The compiler is suspicious of you now.', earned: (s) => s.counters.firstTries >= 1 },
  { id: 'persistence', name: 'Persistence', icon: '🔧', tier: 'silver', description: 'Pass a level after 5 or more failed runs.', quip: 'They say insanity is trying the same thing and expecting a different result. They say programming is the same thing, but it works on try six.', earned: (s) => s.counters.failedRuns >= 5 && s.counters.levelsPassed >= 1 },
  { id: 'ten-down', name: 'Ten Down', icon: '🔟', tier: 'silver', description: 'Clear 10 levels.', quip: 'Ten systems back online. The coffee machine is still broken. Priorities.', earned: (s) => s.counters.levelsPassed >= 10 },
  { id: 'quarter', name: 'Quarter Master', icon: '🗺', tier: 'gold', description: 'Clear 25 levels.', quip: 'A quarter of the station restored. The rest of the crew have started calling you "boss".', earned: (s) => s.counters.levelsPassed >= 25 },
  { id: 'halfway', name: 'Halfway There', icon: '🌗', tier: 'gold', description: 'Clear 45 levels.', quip: 'Halfway. Livin\' on a prayer. And on well-typed code.', earned: (s) => s.counters.levelsPassed >= 45 },
  { id: 'all-levels', name: 'Station Restored', icon: '🌟', tier: 'legendary', title: 'title-architect', description: 'Clear every level on the station.', quip: 'Every system online. You arrived not knowing what a string was. Look at you now.', earned: (s) => ALL_LEVELS.every((l) => levelState(s, l.id).done) },
  { id: 'self-taught', name: 'Self-Taught', icon: '📘', tier: 'silver', description: 'Earn 3 stars on 5 levels.', quip: 'Five flawless clears. Your teachers would be proud. Your teachers are a space station.', earned: (s) => s.counters.threeStars >= 5 },
  { id: 'perfectionist', name: 'Perfectionist', icon: '💎', tier: 'gold', title: 'title-perfect', description: 'Earn 3 stars on 25 levels.', quip: 'Twenty-five perfect scores. Have you considered that you might have a problem? Don\'t. It\'s working.', earned: (s) => s.counters.threeStars >= 25 },
  { id: 'flawless-floor', name: 'Flawless Floor', icon: '⭐', tier: 'gold', description: '3 stars on every level of a floor.', quip: 'An entire floor, flawless. The floor itself is blushing.', earned: (s) => DECKS.some((d) => d.levels.every((l) => levelState(s, l.id).stars === 3)) },
  { id: 'unassisted', name: 'Unassisted', icon: '🧠', tier: 'silver', description: 'Clear 10 code levels without hints or the solution.', quip: 'Ten levels, no hints. The hint system has filed for unemployment.', earned: (s) => s.counters.cleanClears >= 10 },
  { id: 'sharp-eye', name: 'Sharp Eye', icon: '👁', tier: 'silver', description: 'Finish a quiz without a mistake.', quip: 'Six questions, six right answers. You read code like other people read menus.', earned: (s) => s.counters.perfectQuizzes >= 1 },
  { id: 'quiz-master', name: 'Quiz Master', icon: '🎓', tier: 'gold', description: 'Finish 5 quizzes without a mistake.', quip: 'Five perfect quizzes. The quiz machine would like a word. It has run out of questions.', earned: (s) => s.counters.perfectQuizzes >= 5 },
  { id: 'boss-slayer', name: 'Boss Slayer', icon: '⚔', tier: 'silver', title: 'title-boss', description: 'Beat your first boss.', quip: 'Your first boss, defeated. It had a family. Well, a test suite.', earned: (s) => s.counters.bossesBeaten >= 1 },
  { id: 'pest-control', name: 'Pest Control', icon: '🪲', tier: 'gold', description: 'Beat 5 bosses.', quip: 'Five bosses down. The remaining bosses have started a support group.', earned: (s) => s.counters.bossesBeaten >= 5 },
  ...FLOOR_ACHIEVEMENTS.map((f, i): Achievement => ({
    id: `floor-${i + 1}`,
    name: f.name,
    icon: f.icon,
    tier: i === 9 ? 'legendary' : i >= 5 ? 'platinum' : 'gold',
    title: i === 9 ? 'title-production' : undefined,
    description: `Clear Floor ${i + 1}: ${DECKS[i]?.name ?? ''}.`,
    quip: f.quip,
    earned: (s) => floorCleared(s, i),
  })),
  { id: 'skill-2', name: 'Skill Issue (Resolved)', icon: '📈', tier: 'bronze', description: 'Raise any skill to level 2.', quip: 'Your first skill is level 2. The galaxy\'s bookmakers are revising their odds.', earned: (s) => skillLevels(s).some((l) => l >= 2) },
  { id: 'skill-3', name: 'Adept', icon: '🥉', tier: 'silver', description: 'Raise any skill to level 3.', quip: 'Adept! That\'s a real word with a real meaning and it applies to you.', earned: (s) => skillLevels(s).some((l) => l >= 3) },
  { id: 'skill-5', name: 'Master of One', icon: '🥇', tier: 'gold', description: 'Master a skill (level 5).', quip: 'A mastered skill. Somewhere, a recruiter just felt a disturbance.', earned: (s) => skillLevels(s).some((l) => l >= 5) },
  { id: 'polymath', name: 'Polymath', icon: '🎨', tier: 'gold', description: 'Have 10 skills at level 2 or higher.', quip: 'Ten skills. You\'re not a one-trick pony. You\'re a whole circus.', earned: (s) => skillLevels(s).filter((l) => l >= 2).length >= 10 },
  { id: 'full-stack', name: 'Full Stack of Pancakes', icon: '🥞', tier: 'platinum', description: 'A skill at level 3+ in JavaScript, TypeScript and React.', quip: 'All three schools. JavaScript, TypeScript, React. Syrup optional.', earned: (s) => (['JavaScript', 'TypeScript', 'React'] as const).every((school) => Object.entries(s.skills).some(([k, p]) => SKILLS[k as SkillId].school === school && skillLevel(p ?? 0) >= 3)) },
  { id: 'level-5', name: 'Getting Started', icon: '5️⃣', tier: 'bronze', description: 'Reach crawler level 5.', quip: 'Level 5. Junior developers have been hired for less.', earned: (s) => level(s) >= 5 },
  { id: 'level-10', name: 'Double Digits', icon: '🔢', tier: 'silver', description: 'Reach crawler level 10.', quip: 'Level 10! Please hold while we update your LinkedIn.', earned: (s) => level(s) >= 10 },
  { id: 'level-20', name: 'Veteran', icon: '🎖', tier: 'gold', description: 'Reach crawler level 20.', quip: 'Level 20. You\'ve seen things. Terrible things. Like `any`.', earned: (s) => level(s) >= 20 },
  { id: 'level-45', name: 'Living Legend', icon: '🗿', tier: 'platinum', description: 'Reach crawler level 45.', quip: 'Level 45. There are statues of you on several moons.', earned: (s) => level(s) >= 45 },
  { id: 'unboxing', name: 'Unboxing Video', icon: '📦', tier: 'bronze', description: 'Open your first loot box.', quip: 'Your first box! Four billion viewers just watched you open a box. This is what the galaxy wants.', earned: (s) => s.counters.boxesOpened >= 1 },
  { id: 'box-addict', name: 'Box Addict', icon: '🎁', tier: 'gold', description: 'Open 50 loot boxes.', quip: 'Fifty boxes. Our lawyers would like us to remind you that loot boxes are entirely free here. Unlike elsewhere.', earned: (s) => s.counters.boxesOpened >= 50 },
  { id: 'collector', name: 'Collector', icon: '🏺', tier: 'silver', description: 'Own 25 different items.', quip: 'Twenty-five items. Your quarters are starting to look like a museum of developer culture.', earned: (s) => ownedCount(s) >= 25 },
  { id: 'librarian', name: 'Librarian', icon: '📚', tier: 'gold', description: 'Collect 10 Codex scrolls.', quip: 'Ten scrolls. You now own more documentation than most codebases.', earned: (s) => ownedCount(s, 'scroll') >= 10 },
  { id: 'legendary-pull', name: 'Legendary Pull', icon: '🌠', tier: 'gold', description: 'Find a legendary item.', quip: 'LEGENDARY! The chat has crashed. Engineers are being dispatched.', earned: (s) => Object.keys(s.items).some((id) => ['legendary', 'celestial'].includes(ALL_ITEMS.find((i) => i.id === id)?.rarity ?? '')) },
  { id: 'credit-score', name: 'Credit Score', icon: '💰', tier: 'silver', description: 'Hold 1,000 gold at once.', quip: 'A thousand gold. Stackwise Bank has sent you a pen. A nice one.', earned: (s) => s.gold >= 1000 },
  { id: 'big-spender', name: 'Big Spender', icon: '🛍', tier: 'silver', description: 'Spend 500 gold in the Safe Room.', quip: 'Five hundred gold, spent. The shopkeeper bought a second ship.', earned: (s) => s.counters.goldSpent >= 500 },
  { id: 'token-gesture', name: 'Token Gesture', icon: '🎟', tier: 'bronze', description: 'Use a hint token.', quip: 'A hint, for free. Your stars remain un-besmirched.', earned: (s) => s.counters.tokensUsed >= 1 },
  { id: 'peeked', name: 'I Was Never Here', icon: '🙈', tier: 'bronze', description: 'Look at a reference solution.', quip: 'We saw that. The whole galaxy saw that. It\'s fine. Reading good code is how everyone learns.', earned: (s) => s.counters.solutionsSeen >= 1 },
  { id: 'fail-fast', name: 'Fail Fast', icon: '💥', tier: 'silver', description: 'Have 100 failed runs.', quip: 'One hundred failed runs. Every one of them taught you something. You have learned SO much.', earned: (s) => s.counters.failedRuns >= 100 },
  { id: 'remember-when', name: 'Remember When', icon: '🧠', tier: 'bronze', description: 'Finish your first review session.', quip: 'Your first review. Remembering things on purpose: the closest thing programming has to a cheat code.', earned: (s) => s.counters.reviewSessions >= 1 },
  { id: 'spaced-out', name: 'Spaced Out', icon: '📇', tier: 'silver', description: 'Answer 50 review cards.', quip: 'Fifty cards. Memory scientists have been saying this works since 1885. You are now one of their success stories.', earned: (s) => s.counters.reviewsAnswered >= 50 },
  { id: 'clean-sweep', name: 'Clean Sweep', icon: '🧹', tier: 'silver', description: 'Finish a review of five or more cards without a mistake.', quip: 'Not one wrong. Last week\'s lessons are still in there, filed neatly.', earned: (s) => s.counters.perfectReviews >= 1 },
  { id: 'long-term-memory', name: 'Long-Term Memory', icon: '🐘', tier: 'gold', title: 'title-recall', description: 'Remember 10 review cards for a month or more.', quip: 'Ten cards, remembered across a month. That\'s not cramming. That\'s knowing.', earned: (s) => Object.values(s.reviews).filter((r) => r.box >= REVIEW_MONTH_BOX).length >= 10 },
  { id: 'second-wind', name: 'Second Wind', icon: '🔁', tier: 'silver', description: 'Replay a level and raise its stars.', quip: 'They came back to a level they\'d already cleared, and did it better. That\'s the whole job, really.', earned: (s) => s.counters.improvedClears >= 1 },
  { id: 'rubber-duck', name: 'Rubber Duck', icon: '🦆', tier: 'silver', description: 'Explain 10 levels back in your own words.', quip: 'Ten explanations. If you can explain it, you understand it. The duck agrees.', earned: (s) => s.counters.notesWritten >= 10 },
  { id: 'going-viral', name: 'Going Viral', icon: '📈', tier: 'silver', description: 'Reach 10,000 viewers.', quip: 'Ten thousand viewers. Clip channels are making compilations of your semicolons.', earned: (s) => s.viewers >= 10_000 },
  { id: 'galactic-celebrity', name: 'Galactic Celebrity', icon: '🌌', tier: 'gold', title: 'title-celebrity', description: 'Reach 1,000,000 viewers.', quip: 'A MILLION viewers. You have fans on planets you can\'t pronounce.', earned: (s) => s.viewers >= 1_000_000 },
  { id: 'clocking-in', name: 'Clocking In', icon: '⏰', tier: 'bronze', description: 'Claim a daily quest.', quip: 'Your first daily quest. Consistency: the secret ingredient nobody wants to hear about.', earned: (s) => (s.quests?.claimed.length ?? 0) > 0 || s.streak.best >= 1 },
  { id: 'habit-forming', name: 'Habit Forming', icon: '📅', tier: 'silver', description: 'A 3-day streak.', quip: 'Three days in a row. Science says this is how habits start. Science is watching.', earned: (s) => s.streak.best >= 3 },
  { id: 'dedicated', name: 'Dedicated', icon: '🗓', tier: 'gold', description: 'A 7-day streak.', quip: 'A whole week. The station has given you your own parking space.', earned: (s) => s.streak.best >= 7 },
  { id: 'speed-demon', name: 'Speed Demon', icon: '🏎', tier: 'silver', description: 'Earn 5 speed bonuses.', quip: 'Five levels under par. Your keyboard is smoking slightly.', earned: (s) => s.counters.speedBonuses >= 5 },
  { id: 'class-act', name: 'Class Act', icon: '🎭', tier: 'bronze', description: 'Choose a class.', quip: 'A class! Your character sheet is finally more than a name and a frown.', earned: (s) => !!s.classId },
  { id: 'best-friend', name: 'Best Friend', icon: '🐾', tier: 'bronze', description: 'Adopt a companion.', quip: 'A companion! It will love you unconditionally, even when your tests fail.', earned: (s) => !!s.pet },
];

export const achievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Award every newly earned achievement: its box and any title that comes with it. */
export function checkAchievements(save: Save): Result {
  let s = save;
  const events: Reward[] = [];
  // Earning one can earn another (e.g. its box pushes you to Hoarder), so loop until stable.
  for (let pass = 0; pass < 5; pass++) {
    const fresh = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.earned(s));
    if (!fresh.length) break;
    for (const a of fresh) {
      s = { ...s, achievements: [...s.achievements, a.id] };
      if (a.title) s = { ...s, items: { ...s.items, [a.title]: 1 } };
      events.push({ kind: 'achievement', achievement: a });
      const r = addBox(s, a.tier, `Achievement: ${a.name}`);
      s = r.save;
      events.push(...r.events);
    }
  }
  return { save: s, events };
}

// ---------------------------------------------------------------- daily quests and streaks

export interface Quest {
  id: string;
  text: string;
  counter: keyof Counters;
  goal: number;
}

export const QUESTS: Quest[] = [
  { id: 'clear-2', text: 'Clear 2 levels', counter: 'levelsPassed', goal: 2 },
  { id: 'three-star', text: 'Earn 3 stars on a level', counter: 'threeStars', goal: 1 },
  { id: 'first-try', text: 'Pass a level on your first run', counter: 'firstTries', goal: 1 },
  { id: 'clean', text: 'Clear a level without hints', counter: 'cleanClears', goal: 1 },
  { id: 'quiz', text: 'Finish a quiz', counter: 'quizzesDone', goal: 1 },
  { id: 'review', text: 'Answer 5 review cards', counter: 'reviewsAnswered', goal: 5 },
  { id: 'explain', text: 'Explain a level back in your own words', counter: 'notesWritten', goal: 1 },
  { id: 'boxes', text: 'Open 2 loot boxes', counter: 'boxesOpened', goal: 2 },
  { id: 'runs', text: 'Run your code 5 times', counter: 'runs', goal: 5 },
];

/** A day as YYYY-MM-DD in the player's own time zone. */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Make sure today's three quests exist (the same three for everyone on the same day). */
export function ensureQuests(save: Save, today: string): Save {
  if (save.quests?.day === today) return save;
  // Reviewing needs something to review: that quest waits until the deck has cards.
  const pool = QUESTS.filter((q) => q.id !== 'review' || Object.keys(save.reviews).length > 0);
  const ids: string[] = [];
  let h = hash(today);
  while (ids.length < 3) {
    ids.push(pool.splice(h % pool.length, 1)[0].id);
    h = hash(String(h));
  }
  return { ...save, quests: { day: today, ids, claimed: [], base: { ...save.counters } } };
}

export function questProgress(save: Save, quest: Quest): number {
  if (!save.quests) return 0;
  return Math.min(quest.goal, save.counters[quest.counter] - save.quests.base[quest.counter]);
}

export function claimQuest(save: Save, questId: string, today: string): Result {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest || !save.quests || save.quests.day !== today || !save.quests.ids.includes(questId) || save.quests.claimed.includes(questId)) return { save, events: [] };
  if (questProgress(save, quest) < quest.goal) return { save, events: [] };
  let s: Save = { ...save, quests: { ...save.quests, claimed: [...save.quests.claimed, questId] }, gold: save.gold + 30 };
  const events: Reward[] = [{ kind: 'gold', amount: 30, detail: `Quest: ${quest.text}` }];
  const r = addBox(s, 'silver', `Daily Quest: ${quest.text}`);
  s = r.save;
  events.push(...r.events);
  const streak = touchStreak(s, today);
  s = streak.save;
  events.push(...streak.events);
  const a = checkAchievements(s);
  return { save: a.save, events: [...events, ...a.events] };
}

const STREAK_REWARDS: Record<number, Tier> = { 3: 'silver', 7: 'gold', 14: 'platinum', 30: 'legendary' };

/** Count today toward the streak (once per day); missing a day starts it over. */
export function touchStreak(save: Save, today: string): Result {
  if (save.streak.day === today) return { save, events: [] };
  const yesterday = dayOf(new Date(new Date(`${today}T12:00:00`).getTime() - 86_400_000));
  const count = save.streak.day === yesterday ? save.streak.count + 1 : 1;
  let s: Save = { ...save, streak: { day: today, count, best: Math.max(save.streak.best, count) } };
  const events: Reward[] = [{ kind: 'streak', count }];
  const tier = STREAK_REWARDS[count];
  if (tier) {
    const r = addBox(s, tier, `Streak Box: ${count} days`);
    s = r.save;
    events.push(...r.events);
  }
  return { save: s, events };
}

// ---------------------------------------------------------------- the Safe Room shop

export type Ware =
  | { id: string; kind: 'token'; name: string; icon: string; price: number; description: string }
  | { id: string; kind: 'boost'; name: string; icon: string; price: number; description: string }
  | { id: string; kind: 'box'; name: string; icon: string; price: number; description: string; tier: Tier }
  | { id: string; kind: 'item'; name: string; icon: string; price: number; description: string; itemId: string };

export const WARES: Ware[] = [
  { id: 'token', kind: 'token', name: 'Hint Token', icon: '🎟', price: 60, description: 'Reveal a hint without losing a star.' },
  { id: 'boost', kind: 'boost', name: 'XP Boost ×3', icon: '🚀', price: 150, description: '+50% XP on your next 3 level clears.' },
  { id: 'box-bronze', kind: 'box', name: 'Bronze Box', icon: '🟫', price: 50, description: 'A little something.', tier: 'bronze' },
  { id: 'box-silver', kind: 'box', name: 'Silver Box', icon: '⬜', price: 120, description: 'A better something.', tier: 'silver' },
  { id: 'box-gold', kind: 'box', name: 'Gold Box', icon: '🟨', price: 300, description: 'Rare things live in here.', tier: 'gold' },
  ...ALL_ITEMS.filter((i) => i.price).map((i): Ware => ({ id: `item-${i.id}`, kind: 'item', name: i.name, icon: i.icon, price: i.price!, description: i.description, itemId: i.id })),
];

export const CLASS_CHANGE_PRICE = 300;

export function buy(save: Save, wareId: string): Result | null {
  const ware = WARES.find((w) => w.id === wareId);
  if (!ware || save.gold < ware.price) return null;
  if (ware.kind === 'item' && save.items[ware.itemId]) return null;
  let s: Save = { ...save, gold: save.gold - ware.price, counters: { ...save.counters, goldSpent: save.counters.goldSpent + ware.price } };
  const events: Reward[] = [];
  if (ware.kind === 'token') s = { ...s, hintTokens: s.hintTokens + 1 };
  if (ware.kind === 'boost') s = { ...s, boosts: s.boosts + 3 };
  if (ware.kind === 'item') s = { ...s, items: { ...s.items, [ware.itemId]: 1 } };
  if (ware.kind === 'box') {
    const r = addBox(s, ware.tier, `Bought: ${ware.name}`);
    s = r.save;
    events.push(...r.events);
  }
  const a = checkAchievements(s);
  return { save: a.save, events: [...events, ...a.events] };
}

export function changeClass(save: Save, id: ClassId): Save | null {
  if (!save.classId) return chooseClass(save, id);
  if (save.classId === id || save.gold < CLASS_CHANGE_PRICE) return null;
  return { ...save, classId: id, gold: save.gold - CLASS_CHANGE_PRICE, counters: { ...save.counters, goldSpent: save.counters.goldSpent + CLASS_CHANGE_PRICE } };
}

// ---------------------------------------------------------------- the inbox

/** Turn events into inbox notices (the persistent log of everything that happened). */
export function noticesFor(events: Reward[], at: number): Notice[] {
  const out: Notice[] = [];
  let n = 0;
  const add = (kind: Notice['kind'], icon: string, title: string, body: string) => out.push({ id: `${at}-${n++}`, at, kind, icon, title, body });
  for (const e of events) {
    if (e.kind === 'achievement') add('achievement', e.achievement.icon, `Achievement: ${e.achievement.name}`, e.achievement.quip);
    else if (e.kind === 'level-up') add('level-up', '⬆', `Crawler level ${e.level}`, e.newTitle ? `New career title: ${e.title}.` : `You're now level ${e.level}.`);
    else if (e.kind === 'skill-up') add('skill-up', SKILLS[e.skill].icon, `${SKILLS[e.skill].name} → level ${e.level}`, 'Your skill grows.');
    else if (e.kind === 'sponsor') add('sponsor', e.sponsor.icon, `Sponsor: ${e.sponsor.name}`, e.sponsor.message);
    else if (e.kind === 'fans') add('fans', '👁', `${formatViewers(e.milestone)} viewers!`, 'Your fans sent a Fan Box.');
    else if (e.kind === 'streak' && e.count > 1) add('streak', '🔥', `${e.count}-day streak`, 'Keep it going!');
  }
  return out;
}

// ---------------------------------------------------------------- small actions

const withLevel = (save: Save, id: string, patch: Partial<ReturnType<typeof levelState>>): Save => ({
  ...save,
  levels: { ...save.levels, [id]: { ...levelState(save, id), ...patch } },
});

/** A press of Run. A failure counts toward Persistence and Fail Fast. */
export function recordRun(save: Save, levelId: string, passed: boolean): Result {
  const p = levelState(save, levelId);
  const s = withLevel(
    { ...save, counters: { ...save.counters, runs: save.counters.runs + 1, failedRuns: save.counters.failedRuns + (passed ? 0 : 1) } },
    levelId,
    { runs: p.runs + 1 },
  );
  return passed ? { save: s, events: [] } : checkAchievements(s);
}

/** Reveal the next hint — with a hint token (free) if asked and available, otherwise at a star's cost. */
export function revealHint(save: Save, levelId: string, maxHints: number, useToken: boolean): Result {
  const p = levelState(save, levelId);
  if (p.hints >= maxHints) return { save, events: [] };
  // A token is only spent when the hint would otherwise cost a star.
  const token = useToken && save.hintTokens > 0 && nextHintCosts(p);
  const s = withLevel(
    token ? { ...save, hintTokens: save.hintTokens - 1, counters: { ...save.counters, tokensUsed: save.counters.tokensUsed + 1 } } : save,
    levelId,
    { hints: p.hints + 1, freeHints: p.freeHints + (token ? 1 : 0) },
  );
  return checkAchievements(s);
}

export function revealSolution(save: Save, levelId: string): Result {
  if (levelState(save, levelId).solution) return { save, events: [] };
  return checkAchievements(withLevel({ ...save, counters: { ...save.counters, solutionsSeen: save.counters.solutionsSeen + 1 } }, levelId, { solution: true }));
}

/** Start a level over, for three stars: hints, solution and runs reset (best stars are kept). */
export function replayLevel(save: Save, levelId: string, starter: string): Save {
  return withLevel(save, levelId, { hints: 0, freeHints: 0, solution: false, runs: 0, code: starter });
}

// ---------------------------------------------------------------- spaced review

/**
 * Days until a card comes back, by box. A right answer moves a card up a box;
 * a wrong one sends it back to box 0 and tomorrow. Gaps that grow each time
 * you remember are what move knowledge into long-term memory.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];
export const REVIEW_TOP = REVIEW_INTERVALS.length - 1;
/** Cards in this box or above come back a month or more apart. */
export const REVIEW_MONTH_BOX = 4;
/** At most this many cards in one session. */
export const REVIEW_SESSION = 10;

export function addDays(day: string, n: number): string {
  return dayOf(new Date(new Date(`${day}T12:00:00`).getTime() + n * 86_400_000));
}

/** Cards for levels you've cleared join the review deck, first due the next day. */
export function syncReviews(save: Save, today: string): Save {
  let reviews: Save['reviews'] | null = null;
  for (const item of REVIEW_ITEMS) {
    if (save.reviews[item.id] || !levelState(save, item.after).done) continue;
    reviews ??= { ...save.reviews };
    reviews[item.id] = { box: 0, due: addDays(today, 1) };
  }
  return reviews ? { ...save, reviews } : save;
}

/** Cards due today or earlier: the most overdue first, then the least known. */
export function dueReviews(save: Save, today: string): ReviewItem[] {
  return REVIEW_ITEMS.filter((r) => save.reviews[r.id] && save.reviews[r.id].due <= today).sort(
    (a, b) => save.reviews[a.id].due.localeCompare(save.reviews[b.id].due) || save.reviews[a.id].box - save.reviews[b.id].box,
  );
}

/** The next day anything is due, after today (or null if the deck is empty). */
export function nextReviewDay(save: Save, today: string): string | null {
  const days = Object.values(save.reviews).map((r) => r.due).filter((d) => d > today).sort();
  return days[0] ?? null;
}

/** Answer a review card. Only the first answer in a session should be recorded. */
export function answerReview(save: Save, id: string, correct: boolean, today: string): Result {
  const state = save.reviews[id];
  if (!state) return { save, events: [] };
  const box = correct ? Math.min(REVIEW_TOP, state.box + 1) : 0;
  let s: Save = {
    ...save,
    reviews: { ...save.reviews, [id]: { box, due: addDays(today, REVIEW_INTERVALS[box]) } },
    counters: { ...save.counters, reviewsAnswered: save.counters.reviewsAnswered + 1, reviewsCorrect: save.counters.reviewsCorrect + (correct ? 1 : 0) },
  };
  // Effort counts too: a card you got wrong is a card you're about to learn.
  const x = addXp(s, Math.round((correct ? 12 : 4) * (s.classId === 'speedrunner' ? 1.5 : 1)), 'review');
  s = x.save;
  const a = checkAchievements(s);
  return { save: a.save, events: [...x.events, ...a.events] };
}

/** The end of a review session. */
export function finishReview(save: Save, answered: number, mistakes: number): Result {
  const s: Save = {
    ...save,
    counters: {
      ...save.counters,
      reviewSessions: save.counters.reviewSessions + 1,
      perfectReviews: save.counters.perfectReviews + (answered >= 5 && mistakes === 0 ? 1 : 0),
    },
  };
  return checkAchievements(s);
}

// ---------------------------------------------------------------- the notebook

/** A note needs a few words to count as explaining something. */
export const NOTE_MIN_WORDS = 5;

/**
 * Save the player's own explanation of a level (empty text deletes it). There
 * is deliberately no XP for it: a reward for any five words invites five
 * words. The first real note for each level counts toward the notebook
 * achievement and the daily quest.
 */
export function saveNote(save: Save, levelId: string, text: string, at: number): Result {
  const clean = text.trim().slice(0, 600);
  if (!clean) {
    const { [levelId]: _gone, ...notes } = save.notes;
    return { save: { ...save, notes }, events: [] };
  }
  const first = !save.notes[levelId] && clean.split(/\s+/).length >= NOTE_MIN_WORDS;
  let s: Save = { ...save, notes: { ...save.notes, [levelId]: { text: clean, at } } };
  if (!first) return { save: s, events: [] };
  s = { ...s, counters: { ...s.counters, notesWritten: s.counters.notesWritten + 1 } };
  return checkAchievements(s);
}
~~~~

The loot catalogue: 29 collectibles that developers will recognise, 14 titles, 6 editor skins, 8 companion hats, and 15 **Codex scrolls**. The scrolls are cheat sheets the player keeps forever: one guaranteed per floor boss, plus five that drop at random.

**`src/game/items.ts`**

~~~~ts
// Everything that can drop from a loot box: collectibles, cosmetics, and
// Codex scrolls — cheat sheets you keep forever, so some loot also teaches.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'celestial';
export type ItemKind = 'collectible' | 'title' | 'theme' | 'hat' | 'scroll';

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  icon: string;
  description: string;
  /** Scrolls only: the cheat sheet, in mini-markdown. */
  body?: string;
  /** Can this drop at random from boxes? (Floor scrolls only come from that floor's boss.) */
  drops?: boolean;
  /** Price in the Safe Room shop, if it's sold there. */
  price?: number;
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'celestial'];

const collectible = (id: string, name: string, rarity: Rarity, icon: string, description: string): Item => ({ id, kind: 'collectible', name, rarity, icon, description, drops: true });

export const COLLECTIBLES: Item[] = [
  collectible('rubber-duck', 'Rubber Duck of Listening', 'common', '🦆', 'Explain your bug to it, out loud. It says nothing. You find the bug anyway. Nobody knows how this works.'),
  collectible('cold-coffee', 'Mug of Cold Coffee', 'common', '☕', 'Brewed at the start of a "quick fix". Discovered six hours later.'),
  collectible('sticky-note', 'Sticky Note: "Works on my machine"', 'common', '📝', 'The most-quoted sentence in software history. Legally inadmissible.'),
  collectible('semicolon', 'Loose Semicolon', 'common', '⁏', 'Found rattling around the bottom of a codebase. JavaScript says you mostly don\'t need it. It disagrees.'),
  collectible('off-by-one', 'Off-by-One Ruler', 'common', '📏', 'Starts at 0. Ends one short of where you meant. Perfectly calibrated for array indexes.'),
  collectible('todo-comment', 'Ancient TODO Comment', 'common', '🗒', '"// TODO: fix this properly" — dated eleven years ago. The author has since retired.'),
  collectible('stack-overflow', 'Printed-Out Forum Answer', 'common', '📄', 'Accepted answer from 2011. Has 4,000 upvotes and is now subtly wrong.'),
  collectible('keyboard-key', 'Worn-Out Ctrl Key', 'common', '⌨', 'C and V are worn through too. Make of that what you will.'),
  collectible('null-plush', 'Null Pointer Plushie', 'uncommon', '🧸', 'Soft, cuddly, and points at absolutely nothing. Do not dereference.'),
  collectible('promise', 'Unresolved Promise', 'uncommon', '🤞', 'Still pending. Will resolve "later". Has been saying that for three years.'),
  collectible('callback-pyramid', 'Callback Pyramid (Scale Model)', 'uncommon', '🔺', 'A replica of the ancient wonder, built before async/await. Each level is nested inside the one below.'),
  collectible('merge-conflict', 'Merge Conflict in a Jar', 'uncommon', '🫙', '<<<<<<< HEAD. Keep the lid on.'),
  collectible('mechanical-keyboard', 'Very Loud Mechanical Keyboard', 'uncommon', '🎹', 'Clicky blue switches. Your coworkers know exactly how productive you are.'),
  collectible('bug-jar', 'Bug in a Jar', 'uncommon', '🐞', 'Caught alive in production. It still reproduces sometimes.'),
  collectible('tabs-spaces', 'Tabs-vs-Spaces Peace Treaty', 'uncommon', '📜', 'Unsigned. Both parties walked out over the indentation of the signature line.'),
  collectible('dark-mode', 'Bottled Dark Mode', 'uncommon', '🌑', 'One drop and every screen goes easy on the eyes. The bottle is, inexplicably, white.'),
  collectible('infinite-loop', 'Infinite Loop (Contained)', 'rare', '♾', 'Safely trapped by the station\'s loop guard. Still spinning. You can hear it if you listen.'),
  collectible('cursed-any', 'The Cursed `any`', 'rare', '🫥', 'Makes every type say yes. Every single one. Do not let it near your codebase.'),
  collectible('legacy-codebase', 'Haunted Legacy Codebase', 'rare', '👻', 'Nobody understands it. Nobody dares delete it. It runs the payroll.'),
  collectible('git-blame', 'Mirror of Git Blame', 'rare', '🪞', 'Shows you who wrote the worst line in the file. It is always you, from six months ago.'),
  collectible('regex', 'Regular Expression Charm', 'rare', '🔣', '/^(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)$/ — nobody remembers what it matches. It wards off email addresses.'),
  collectible('deprecated', 'Deprecated Warning Sign', 'rare', '⚠', 'Yellow, triangular, and ignored by everyone for years.'),
  collectible('production-db', 'Key to the Production Database', 'epic', '🗝', 'Comes with a note: "Please, please, please use a transaction."'),
  collectible('10x-cape', 'Cape of the 10x Engineer', 'epic', '🦸', 'Mythical. Several people claim to have seen one. Their teammates disagree.'),
  collectible('friday-deploy', 'Friday Afternoon Deploy Button', 'epic', '🔴', 'Big, red, and pressed by brave fools at 4:55 pm. Comes with a weekend\'s worth of pager alerts.'),
  collectible('compiler-blessing', 'Blessing of the Compiler', 'epic', '✨', 'Zero errors, zero warnings, first try. The compiler smiled, once. This is proof.'),
  collectible('golden-semicolon', 'The Golden Semicolon', 'legendary', '🏆', 'Forged from the final statement of the first program ever to compile without warnings.'),
  collectible('last-working-build', 'The Last Working Build', 'legendary', '💾', 'Before the refactor. Before the dependency update. Before everything went wrong. Treasure it.'),
  collectible('orrery-heart', 'Heart of the Orrery', 'celestial', '💠', 'The reactor core\'s first spark, crystallised. Awarded to the engineer who brought the station back to life.'),
];

const title = (id: string, name: string, rarity: Rarity, extra: Partial<Item> = {}): Item => ({ id, kind: 'title', name, rarity, icon: '🎖', description: `A title to wear under your name: “${name}”.`, ...extra });

export const TITLES: Item[] = [
  title('title-crawler', 'Fresh Recruit', 'common'),
  title('title-semicolon', 'Semicolon Survivor', 'common', { drops: true }),
  title('title-debugger', 'Professional Debugger', 'uncommon', { drops: true }),
  title('title-console', 'Console Whisperer', 'uncommon', { drops: true, price: 150 }),
  title('title-loop', 'Lord of the Loops', 'uncommon', { drops: true }),
  title('title-async', 'Awaiter of Promises', 'rare', { drops: true }),
  title('title-types', 'Type Whisperer', 'rare', { drops: true, price: 400 }),
  title('title-hooks', 'Hook Wrangler', 'rare', { drops: true }),
  title('title-a11y', 'Champion of Accessibility', 'epic', { drops: true }),
  title('title-boss', 'Boss Slayer', 'rare'),
  title('title-perfect', 'the Perfectionist', 'epic'),
  title('title-recall', 'Total Recall', 'epic'),
  title('title-architect', 'Reactor Architect', 'legendary'),
  title('title-celebrity', 'Galactic Celebrity', 'legendary'),
  title('title-production', 'Production Engineer', 'legendary'),
];

const theme = (id: string, name: string, rarity: Rarity, description: string, price?: number): Item => ({ id, kind: 'theme', name, rarity, icon: '🎨', description, drops: true, price });

export const THEMES: Item[] = [
  { id: 'theme-reactor', kind: 'theme', name: 'Standard Issue', rarity: 'common', icon: '🎨', description: 'The editor wears your colour profile (🎨 at the top right).' },
  theme('theme-phosphor', 'Phosphor Terminal', 'uncommon', 'Green on black, like the machines your grandparents swore at.', 250),
  theme('theme-solar', 'Solar Flare', 'uncommon', 'Hot ambers and oranges. Wear sunglasses.', 250),
  theme('theme-nebula', 'Nebula', 'rare', 'Deep purples and pinks from the edge of the galaxy.', 400),
  theme('theme-arctic', 'Arctic Station', 'rare', 'Icy blues and crisp whites.', 400),
  theme('theme-gold', 'Gilded Console', 'legendary', 'Gold leaf on obsidian. Tasteful? No. Earned? Absolutely.'),
];

const hat = (id: string, name: string, rarity: Rarity, icon: string, price?: number): Item => ({ id, kind: 'hat', name, rarity, icon, description: `A ${name.toLowerCase()} for your companion.`, drops: true, price });

export const HATS: Item[] = [
  hat('hat-party', 'Party Hat', 'common', '🥳', 80),
  hat('hat-hard', 'Hard Hat', 'common', '⛑', 80),
  hat('hat-headphones', 'Headphones', 'uncommon', '🎧', 150),
  hat('hat-cap', 'Propeller Cap', 'uncommon', '🧢', 150),
  hat('hat-top', 'Top Hat', 'rare', '🎩', 300),
  hat('hat-wizard', 'Wizard Hat', 'rare', '🧙'),
  hat('hat-crown', 'Tiny Crown', 'epic', '👑'),
  hat('hat-halo', 'Halo', 'legendary', '😇'),
];

const scroll = (id: string, name: string, rarity: Rarity, drops: boolean, body: string): Item => ({ id, kind: 'scroll', name, rarity, icon: '📜', description: 'A Codex scroll: a cheat sheet you keep forever. Read it in your inventory.', drops, body });

export const SCROLLS: Item[] = [
  scroll('scroll-basics', 'Scroll of First Principles', 'uncommon', false, `## Values and variables
\`\`\`ts
const name = "Ada";      // string: text in quotes
let fuel = 50;           // number; let can be reassigned
const ok = fuel > 10;    // boolean: true or false
fuel = fuel + 5;         // or fuel += 5
console.log(\`\${name} has \${fuel}\`);   // template string
\`\`\`
## Decisions and functions
\`\`\`ts
export function grade(score: number): string {
  if (score > 90) return "A";
  else if (score > 75) return "B";
  else return "C";
}
\`\`\`
- \`===\` compares, \`=\` assigns. \`&&\` and, \`||\` or, \`!\` not.
- Order: ( ) first, then * / %, then + -.`),
  scroll('scroll-collections', 'Scroll of Collections', 'uncommon', false, `## Arrays
\`\`\`ts
const xs = [3, 9, 14];
xs[0]; xs.length; xs[xs.length - 1];   // first, count, last
xs.push(20);                            // add to end
for (const x of xs) { … }               // each item
\`\`\`
## Array methods
| Method | Gives |
|---|---|
| \`map(fn)\` | new array, each item transformed |
| \`filter(fn)\` | new array, only items that pass |
| \`find(fn)\` | first match, or undefined |
| \`some / every\` | boolean |
| \`includes(x)\` | boolean |
| \`reduce(fn, start)\` | one value |
## Objects
\`\`\`ts
const ship = { name: "Kite", crew: 4 };
ship.crew = 5;
type Ship = { name: string; crew: number };
\`\`\``),
  scroll('scroll-modern', 'Scroll of Modern JavaScript', 'rare', false, `## Shapes
\`\`\`ts
const { name, crew = 1 } = ship;     // destructuring + default
const [first, ...rest] = list;       // rest
const copy = { ...ship, crew: 5 };   // spread: new object
const more = [...list, "x"];         // spread: new array
ship.pilot?.name ?? "unassigned";    // optional chaining + nullish fallback
\`\`\`
## Functions
\`\`\`ts
const double = (n: number) => n * 2;
function makeCounter() { let n = 0; return () => ++n; }   // closure
\`\`\`
## Errors and async
\`\`\`ts
try { risky(); } catch (e) { … }
throw new Error("Clear message");
const x = await api();                          // inside async functions
const all = await Promise.all(ids.map(api));    // in parallel
\`\`\``),
  scroll('scroll-types', 'Scroll of Types', 'rare', false, `## Annotations
\`\`\`ts
function f(a: number, b: string[]): boolean { … }
let id: string | number;          // union
type Dir = "up" | "down";         // literal union
interface Ship { readonly id: number; name: string; motto?: string }
\`\`\`
## Narrowing
\`typeof x === "string"\`, \`Array.isArray(x)\`, \`x === null\`, \`"prop" in x\`, checking a tag like \`x.kind === "ship"\`.
## Remember
- \`unknown\` must be narrowed; \`any\` turns checking off.
- \`T | null\` / \`T | undefined\` for "maybe nothing".`),
  scroll('scroll-generics', 'Scroll of Generics', 'rare', false, `## Generics
\`\`\`ts
function first<T>(xs: T[]): T | undefined { return xs[0]; }
function get<T, K extends keyof T>(o: T, k: K): T[K] { return o[k]; }
\`\`\`
## Utility types
| Type | Does |
|---|---|
| \`Partial<T>\` | all optional |
| \`Required<T>\` | all required |
| \`Readonly<T>\` | all readonly |
| \`Pick<T, K>\` / \`Omit<T, K>\` | keep / drop keys |
| \`Record<K, V>\` | object with keys K |
## Exhaustive switches
\`default: { const x: never = value; }\` errors if a case is missing.`),
  scroll('scroll-vault', 'Scroll of the Vault', 'epic', false, `## Type guards
\`\`\`ts
function isShip(x: unknown): x is Ship { … }
\`\`\`
## Type-level tools
\`\`\`ts
type Flags<T> = { [K in keyof T]: boolean };                  // mapped
type Elem<T> = T extends (infer U)[] ? U : never;             // conditional + infer
type Code = \`\${"A" | "B"}\${1 | 2}\`;                           // template literal
type Get<T> = { [K in keyof T & string as \`get\${Capitalize<K>}\`]: () => T[K] };
const CFG = { … } as const satisfies Record<string, Route>;   // exact + checked
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
\`\`\``),
  scroll('scroll-components', 'Scroll of Components', 'rare', false, `## Components
\`\`\`tsx
interface Props { title: string; count?: number; children: ReactNode }
export function Card({ title, count = 0, children }: Props) {
  return <section className="card"><h2>{title} ({count})</h2>{children}</section>;
}
\`\`\`
- Capitalised names; \`className\`; \`{expressions}\`; one root (or \`<>…</>\`).
- Lists: \`items.map((i) => <li key={i.id}>…</li>)\`, with stable keys.
- Conditionals: \`cond ? a : b\`, \`count > 0 && …\` (never \`count && …\`).`),
  scroll('scroll-state', 'Scroll of State', 'rare', false, `## useState
\`\`\`tsx
const [items, setItems] = useState<Item[]>([]);
setItems([...items, item]);                       // add
setItems(items.filter((i) => i.id !== id));       // remove
setItems(items.map((i) => i.id === id ? { ...i, done: true } : i));   // update
setCount((c) => c + 1);                           // based on previous
\`\`\`
## Inputs and forms
\`\`\`tsx
<input value={text} onChange={(e) => setText(e.target.value)} />
<form onSubmit={(e) => { e.preventDefault(); … }}>
\`\`\`
- Never mutate state. Derive what you can. Lift shared state up.`),
  scroll('scroll-hooks', 'Scroll of Hooks', 'epic', false, `## Effects
\`\`\`tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);       // cleanup
}, [deps]);
\`\`\`
## The rest
\`\`\`tsx
const ref = useRef<HTMLInputElement>(null);  ref.current?.focus();
const [state, dispatch] = useReducer(reducer, initial);
const Ctx = createContext<Value | null>(null);   <Ctx value={v}>…</Ctx>   useContext(Ctx);
function useToggle(init = false): [boolean, () => void] { … }   // custom hook
\`\`\`
- Hooks: top level only, same order every render.`),
  scroll('scroll-production', 'Scroll of Production', 'legendary', false, `## Network data
- Always design **loading**, **error**, **empty** and **loaded** states.
- Ignore stale responses: \`let stale = false; … return () => { stale = true; }\`.
- Debounce user input before requesting.
## Performance
- Measure first. \`useMemo\` for expensive work; \`memo\` + \`useCallback\` for skipping renders.
## Accessibility
- Real \`<label htmlFor>\`; \`aria-invalid\`, \`aria-describedby\`; roles and states on custom widgets; full keyboard support; manage focus.
## Resilience and testing
- Error boundaries around independent regions.
- Test boundaries, each rule alone, combinations, invalid input.`),
  scroll('scroll-debugging', 'Scroll of Debugging', 'rare', true, `## A method that always works
1. **Reproduce** it reliably. If you can't trigger it, you can't confirm a fix.
2. **Read the error message**, all of it, including the line number.
3. **Check your assumptions**: \`console.log\` the values you're *sure* about.
4. **Halve the problem**: comment out half the code; which half has the bug?
5. **Explain it out loud** (the rubber duck method).
6. Fix it, then add a test so it never comes back.`),
  scroll('scroll-errors', 'Scroll of Reading Errors', 'uncommon', true, `## Common compiler messages, translated
| Message | Means |
|---|---|
| *X is not assignable to type Y* | You gave an X where a Y was promised |
| *Property P does not exist on type T* | Typo, or you haven't narrowed a union |
| *Object is possibly 'undefined'* | Check it first, or use \`?.\` / \`??\` |
| *Parameter implicitly has an 'any' type* | Annotate the parameter |
| *Cannot assign to X because it is a constant* | Use \`let\`, or don't reassign |
| *Cannot find name X* | Not declared, misspelled, or not imported |`),
  scroll('scroll-naming', 'Scroll of Naming Things', 'uncommon', true, `## Names are documentation
- Booleans read as questions: \`isOpen\`, \`hasFuel\`, \`canLaunch\`.
- Functions are verbs: \`loadCrew\`, \`formatId\`; components are nouns: \`CrewList\`.
- Plurals for lists: \`ships\`; singular in loops: \`for (const ship of ships)\`.
- Say what it *is*, not its type: \`retryCount\`, not \`num\`.
- Short names for short scopes (\`i\`, \`x\`), long names for long ones.`),
  scroll('scroll-git', 'Scroll of Git', 'rare', true, `## The daily loop
\`\`\`
git status                    # what changed?
git diff                      # how?
git add -p                    # stage pieces, reviewing each
git commit -m "Add crew search"
git pull --rebase && git push
\`\`\`
## Branches
\`\`\`
git switch -c fix-login       # new branch
git switch main               # back
\`\`\`
- Small commits with clear messages: *what* changed and *why*.`),
  scroll('scroll-review', 'Scroll of Code Review', 'epic', true, `## Reviewing someone else's code
- Read the description first: what is this *supposed* to do?
- Check behaviour before style: edge cases, errors, empty states, accessibility.
- Ask questions instead of giving orders: "What happens if the list is empty?"
- Praise what's good. Be specific about what isn't.
## Having your code reviewed
- Keep changes small. Explain the *why*. Thank people. Nobody's code is perfect, including the reviewer's.`),
];

export const ALL_ITEMS: Item[] = [...COLLECTIBLES, ...TITLES, ...THEMES, ...HATS, ...SCROLLS];
const BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function item(id: string): Item {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown item ${id}`);
  return found;
}

/** The scroll each floor's boss guarantees, by floor id. */
export const FLOOR_SCROLLS: Record<string, string> = {
  boot: 'scroll-basics',
  supply: 'scroll-collections',
  modern: 'scroll-modern',
  foundry: 'scroll-types',
  lab: 'scroll-generics',
  vault: 'scroll-vault',
  bay: 'scroll-components',
  control: 'scroll-state',
  core: 'scroll-hooks',
  production: 'scroll-production',
};
~~~~

The game's sounds are synthesised with the Web Audio API. There are no audio files.

**`src/game/sound.ts`**

~~~~ts
// A handful of synthesized UI sounds — no audio files.
import { getSave } from './store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function play(fn: () => void) {
  if (!getSave().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    fn();
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  click: () => play(() => tone(660, 0, 0.05, 'square', 0.03)),
  run: () => play(() => { tone(440, 0, 0.06); tone(660, 0.06, 0.08); }),
  pass: () => play(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.08))),
  fail: () => play(() => { tone(196, 0, 0.12, 'sawtooth', 0.04); tone(147, 0.1, 0.2, 'sawtooth', 0.04); }),
  right: () => play(() => { tone(880, 0, 0.06, 'triangle', 0.06); tone(1320, 0.05, 0.08, 'triangle', 0.06); }),
  wrong: () => play(() => tone(150, 0, 0.18, 'sawtooth', 0.05)),
  unlock: () => play(() => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.06))),
};
~~~~

---

## Part 8. The user interface

### Shell, routing and overlays

Routing is hash-based (`#/map`, `#/level/<id>`, `#/review`, `#/loot/<tab>`, `#/shop`, `#/character/<tab>`), read with `useSyncExternalStore`. The app shell renders the HUD (except on the title screen, which instead shows only the 🎨 colour-profile button in its top-right corner), the current screen, and four global overlays: the announcer, the box opener, the offers and the companion.

**`src/ui/router.ts`**

~~~~ts
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'level'; id: string }
  | { name: 'review' }
  | { name: 'loot'; tab?: string }
  | { name: 'shop' }
  | { name: 'character'; tab?: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'map') return { name: 'map' };
  if (parts[0] === 'level' && parts[1]) return { name: 'level', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'review') return { name: 'review' };
  if (parts[0] === 'loot') return { name: 'loot', tab: parts[1] };
  if (parts[0] === 'shop') return { name: 'shop' };
  if (parts[0] === 'character' || parts[0] === 'profile') return { name: 'character', tab: parts[1] };
  return { name: 'title' };
}

export function go(path: string) {
  window.location.hash = `#${path}`;
}

const subscribe = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}
~~~~

**`src/ui/overlays.ts`**

~~~~ts
// App-wide overlays that any screen can open: the box opener, the pet and
// class offers, and the companion's speech bubble.
import { useSyncExternalStore } from 'react';

interface Overlays {
  /** Box ids waiting to be opened, in order (null when the opener is closed). */
  boxes: string[] | null;
  offer: 'pet' | 'class' | 'name' | null;
  petSays: { text: string; at: number } | null;
  /** The player is working on a level: announcements wait until they finish. */
  focus: boolean;
}

let state: Overlays = { boxes: null, offer: null, petSays: null, focus: false };
// Offers earned during a level wait until its victory screen closes.
let pendingOffers: NonNullable<Overlays['offer']>[] = [];
const listeners = new Set<() => void>();

function set(patch: Partial<Overlays>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const overlays = {
  openBoxes: (ids: string[]) => ids.length && set({ boxes: ids }),
  closeBoxes: () => set({ boxes: null }),
  offer: (what: Overlays['offer']) => {
    if (what === null && pendingOffers.length) set({ offer: pendingOffers.shift()! });
    else set({ offer: what });
  },
  queueOffer: (what: NonNullable<Overlays['offer']>) => {
    if (!pendingOffers.includes(what)) pendingOffers.push(what);
  },
  /** Show the next waiting offer, if any (called when a victory screen closes). */
  flushOffers: () => {
    if (pendingOffers.length && !state.offer) set({ offer: pendingOffers.shift()! });
  },
  petSay: (text: string) => set({ petSays: { text, at: Date.now() } }),
  setFocus: (focus: boolean) => {
    if (state.focus !== focus) set({ focus });
  },
};

export function useOverlays(): Overlays {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
~~~~

**`src/App.tsx`**

~~~~tsx
import { useEffect } from 'react';
import { findLevel } from './content';
import { warmUp } from './engine/compiler';
import { isUnlocked } from './game/progress';
import { onRewards, useSave } from './game/store';
import { CharacterScreen } from './screens/CharacterScreen';
import { CodeLevelScreen } from './screens/CodeLevelScreen';
import { LootScreen } from './screens/LootScreen';
import { MapScreen } from './screens/MapScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { ShopScreen } from './screens/ShopScreen';
import { TitleScreen } from './screens/TitleScreen';
import { Announcer } from './ui/Announcer';
import { BoxOpener } from './ui/BoxOpener';
import { Companion } from './ui/Companion';
import { Hud } from './ui/Hud';
import { Offers } from './ui/Offers';
import { overlays } from './ui/overlays';
import { go, useRoute } from './ui/router';
import { ThemePicker } from './ui/ThemePicker';

export function App() {
  const route = useRoute();
  const save = useSave();

  useEffect(() => warmUp(), []);
  // Class and pet offers wait for the victory screen to close.
  useEffect(
    () =>
      onRewards((events) => {
        for (const e of events) if (e.kind === 'offer') overlays.queueOffer(e.what);
      }),
    [],
  );

  let screen;
  switch (route.name) {
    case 'title':
      screen = <TitleScreen />;
      break;
    case 'map':
      screen = <MapScreen />;
      break;
    case 'review':
      screen = <ReviewScreen key={route.name} />;
      break;
    case 'loot':
      screen = <LootScreen tab={route.tab} />;
      break;
    case 'shop':
      screen = <ShopScreen />;
      break;
    case 'character':
      screen = <CharacterScreen tab={route.tab} />;
      break;
    case 'level': {
      const found = findLevel(route.id);
      if (!found) screen = <NotFound />;
      else if (!isUnlocked(save, route.id)) screen = <Locked />;
      else
        screen =
          found.level.kind === 'code' ? (
            <CodeLevelScreen key={found.level.id} level={found.level} deck={found.deck} index={found.index} />
          ) : (
            <QuizScreen key={found.level.id} level={found.level} deck={found.deck} index={found.index} />
          );
      break;
    }
  }

  return (
    <div className={`app ${save.equipped.theme}`}>
      {route.name !== 'title' ? (
        <Hud route={route} />
      ) : (
        <div className="title-corner">
          <ThemePicker />
        </div>
      )}
      <main className={route.name === 'title' ? 'title-main' : ''}>{screen}</main>
      <Announcer />
      <BoxOpener />
      <Offers />
      <Companion />
    </div>
  );
}

function NotFound() {
  return (
    <div className="panel center-msg">
      <h2>No such system</h2>
      <button className="btn primary" onClick={() => go('/map')}>Back to the map</button>
    </div>
  );
}

function Locked() {
  return (
    <div className="panel center-msg">
      <h2>🔒 This system is still dark</h2>
      <p>Restore the systems before it first. Or beat the floor's boss to skip ahead, or open everything from Character → Settings.</p>
      <button className="btn primary" onClick={() => go('/map')}>Back to the map</button>
    </div>
  );
}
~~~~

### The code editor

CodeMirror 6, wired to the compiler worker. **Live type errors** appear as red squiggles (the level screen re-checks 350 ms after typing stops). **Hovering** any name shows its type, syntax-highlighted, plus its docs. **Autocomplete** comes from TypeScript. **⌘↵ / Ctrl↵ / ⌘S** run the code. Syntax colours come from `@lezer/highlight`'s `classHighlighter`, which emits `tok-*` classes the stylesheet colours with the active profile.

**`src/ui/CodeEditor.tsx`**

~~~~tsx
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers } from '@codemirror/view';
import { tsxLanguage } from '@codemirror/lang-javascript';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from '../engine/checker';
import { completions, quickInfo } from '../engine/compiler';
import { explainDiagnostic } from '../engine/explain';

interface Props {
  value: string;
  /** The file's path for the compiler, e.g. "/solution.tsx". */
  path: string;
  tsx: boolean;
  diagnostics: Diagnostic[];
  onChange(value: string): void;
  onRun(): void;
}

// TypeScript's completion kinds → CodeMirror's icon types.
const KIND: Record<string, string> = {
  function: 'function', 'local function': 'function', method: 'method', property: 'property', getter: 'property', setter: 'property',
  var: 'variable', let: 'variable', const: 'constant', 'local var': 'variable', parameter: 'variable', alias: 'variable',
  class: 'class', interface: 'interface', type: 'type', 'type parameter': 'type', enum: 'enum', 'enum member': 'enum',
  module: 'namespace', keyword: 'keyword', 'JSX attribute': 'property',
};

/** A hover card: the type signature, highlighted like the editor, plus any docs. */
function typeCard(signature: string, doc: string) {
  const dom = document.createElement('div');
  dom.className = 'cm-type-tip';
  const pre = document.createElement('pre');
  highlightCode(
    signature,
    tsxLanguage.parser.parse(signature),
    classHighlighter,
    (text, classes) => {
      const span = document.createElement('span');
      if (classes) span.className = classes;
      span.textContent = text;
      pre.appendChild(span);
    },
    () => pre.appendChild(document.createTextNode('\n')),
  );
  dom.appendChild(pre);
  if (doc) {
    const p = document.createElement('p');
    p.textContent = doc;
    dom.appendChild(p);
  }
  return dom;
}

export function CodeEditor({ value, path, tsx, diagnostics, onChange, onRun }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor (created once) never calls stale ones.
  const handlers = useRef({ onChange, onRun, path });
  handlers.current = { onChange, onRun, path };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({
            override: [
              async (ctx: CompletionContext): Promise<CompletionResult | null> => {
                const word = ctx.matchBefore(/[\w$]*/);
                if (!word) return null;
                const afterDot = ctx.state.sliceDoc(word.from - 1, word.from) === '.';
                if (word.from === word.to && !afterDot && !ctx.explicit) return null;
                const file = handlers.current.path;
                const items = await completions({ [file]: ctx.state.doc.toString() }, file, ctx.pos).catch(() => []);
                if (ctx.aborted || !items.length) return null;
                return {
                  from: word.from,
                  validFor: /^[\w$]*$/,
                  options: items.map((c) => ({
                    label: c.name,
                    type: KIND[c.kind] ?? 'text',
                    boost: Math.max(-99, 40 - (parseInt(c.sort, 10) || 20) * 3),
                  })),
                };
              },
            ],
          }),
          // Hover any name to see its type — the compiler's view of your code.
          hoverTooltip(async (v, pos) => {
            const file = handlers.current.path;
            const info = await quickInfo({ [file]: v.state.doc.toString() }, file, pos).catch(() => null);
            if (!info) return null;
            return { pos: info.from, end: info.to, above: true, create: () => ({ dom: typeCard(info.signature, info.doc) }) };
          }),
          syntaxHighlighting(classHighlighter),
          javascript({ typescript: true, jsx: tsx }),
          lintGutter(),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          keymap.of([
            // ⌘↵ on a Mac, Ctrl+↵ elsewhere — and Ctrl+↵ on a Mac too, for muscle memory.
            { key: 'Mod-Enter', run: () => (handlers.current.onRun(), true) },
            { key: 'Ctrl-Enter', run: () => (handlers.current.onRun(), true) },
            { key: 'Mod-s', run: () => (handlers.current.onRun(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Code editor', spellcheck: 'false' }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsx]);

  // Outside changes (reset, load solution) replace the document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const cm: CmDiagnostic[] = diagnostics
      .filter((d) => d.from <= len)
      .map((d) => {
        // The compiler's words first, then what they mean, in plain English.
        const plain = explainDiagnostic(d.code, d.message);
        return { from: d.from, to: Math.min(d.to, len), severity: 'error' as const, message: plain ? `${d.message}\n\n💡 ${plain.replace(/`/g, '')}` : d.message };
      });
    v.dispatch(setDiagnostics(v.state, cm));
  }, [diagnostics]);

  return <div className="editor" ref={host} />;
}
~~~~

### The live preview

The preview renders the player's component in **its own React root** inside an error boundary, so nothing the player writes can take down the game. It re-mounts on every Run, logs uncaught errors and form reloads to the console panel, and stays quiet while a check is running (the check owns those errors).

**`src/ui/Preview.tsx`**

~~~~tsx
// Renders the player's component live, in its own React root, so nothing the
// player writes can take the game's UI down with it.
import { Component, createElement, useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sandbox, activity, loadModule } from '../engine/runtime';
import type { CodeLevel } from '../game/types';

interface Props {
  level: CodeLevel;
  js: string;
  runId: number;
  log(line: string): void;
}

class Boundary extends Component<{ children: ReactNode; onError(e: Error): void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? <p className="preview-error">💥 {this.state.error.message}</p> : this.props.children;
  }
}

export function Preview({ level, js, runId, log }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const sandbox = new Sandbox(log);
    const mount = document.createElement('div');
    el.replaceChildren(mount);
    const root = createRoot(mount, { onUncaughtError: (e) => log(`✖ ${(e as Error).message ?? e}`) });
    const onSubmit = (e: Event) => {
      if (!e.defaultPrevented) log('⚠ The form tried to reload the page. Call event.preventDefault() in onSubmit.');
      e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (activity.stages > 0) return; // a check is running; the error is its to report
      e.preventDefault();
      log(`✖ ${e.message}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (activity.stages > 0) return;
      e.preventDefault();
      log(`✖ Unhandled promise rejection: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`);
    };
    mount.addEventListener('submit', onSubmit);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    try {
      const mod = loadModule(js, sandbox);
      const node = level.preview?.(mod, createElement, log) ?? null;
      root.render(<Boundary onError={(e) => log(`✖ ${e.message}`)}>{node}</Boundary>);
    } catch (e) {
      root.render(<p className="preview-error">💥 {(e as Error).message}</p>);
    }
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      sandbox.clearAll();
      // Unmount after the current render pass finishes.
      setTimeout(() => root.unmount());
    };
    // Re-mount on every run, even if the code is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [js, runId]);

  return <div className="preview-surface" ref={host} />;
}
~~~~

### Markdown and highlighting

Lessons, briefs, hints and scrolls use a deliberately small markdown renderer that builds React elements directly. There are no HTML strings, so there is nothing to sanitise.

**`src/ui/Markdown.tsx`**

~~~~tsx
// A deliberately small markdown renderer for lessons and briefs: headings,
// paragraphs, lists, tables, fenced code, `inline code`, **bold**, *italic*.
// It builds React elements directly — no HTML strings, nothing to sanitize.
import type { ReactNode } from 'react';
import { Code } from './highlight';

export function Markdown({ text }: { text: string }) {
  return <div className="md">{blocks(text)}</div>;
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  const key = () => out.length;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(<Code key={key()} code={body.join('\n')} />);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(level <= 2 ? <h3 key={key()}>{inline(heading[2])}</h3> : <h4 key={key()}>{inline(heading[2])}</h4>);
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i].trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c.trim()))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div className="table-wrap" key={key()}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c.trim())}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, j) => (
                <tr key={j}>{r.map((c, n) => <td key={n}>{inline(c.trim())}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const lis = items.map((t, j) => <li key={j}>{inline(t)}</li>);
      out.push(ordered ? <ol key={key()}>{lis}</ol> : <ul key={key()}>{lis}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key()}>{inline(para.join(' '))}</p>);
  }
  return out;
}

function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  for (let i = 1; i < row.length; i++) {
    const ch = row[i];
    if (ch === '\\' && row[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '`') {
      inCode = !inCode;
      cur += ch;
    } else if (ch === '|' && !inCode) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  return cells;
}

/** Inline spans: ``code with `ticks` ``, `code`, **bold**, *italic*. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /``\s?(.+?)\s?``|`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = out.length;
    if (m[1] !== undefined || m[2] !== undefined) out.push(<code key={k}>{m[1] ?? m[2]}</code>);
    else if (m[3] !== undefined) out.push(<strong key={k}>{inline(m[3])}</strong>);
    else out.push(<em key={k}>{inline(m[4])}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
~~~~

**`src/ui/highlight.tsx`**

~~~~tsx
import { tsxLanguage } from '@codemirror/lang-javascript';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { ReactNode } from 'react';

/** Syntax-highlight TS/TSX into React spans, using the same token classes as the editor. */
export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let k = 0;
  highlightCode(
    code,
    tsxLanguage.parser.parse(code),
    classHighlighter,
    (text, classes) => out.push(classes ? <span key={k++} className={classes}>{text}</span> : text),
    () => out.push('\n'),
  );
  return out;
}

export function Code({ code, className = '' }: { code: string; className?: string }) {
  return (
    <pre className={`code ${className}`}>
      <code>{highlight(code)}</code>
    </pre>
  );
}
~~~~

**`src/ui/Modal.tsx`**

~~~~tsx
import { useEffect, type ReactNode } from 'react';

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose(): void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
~~~~

**`src/ui/useLevelTimer.ts`**

~~~~ts
import { useEffect, useState } from 'react';

/**
 * Seconds spent on a level during this visit — counting only while the tab is
 * visible and `running` is true (it stops once you've won).
 */
export function useLevelTimer(levelId: string, running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => setSeconds(0), [levelId]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, levelId]);

  return seconds;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
~~~~

### The code level screen

This is where the game is played, and where every system meets: editor, compiler, grader, preview, rewards, victory. It is a three-column layout:

- **Left (brief)**: the floor tag, title, system, and "Worth ★★★" (the stars still available on this attempt). It has three tabs. **Mission** holds the brief, a "You'll learn" box (the lesson's `##` headings, with "Read the lesson first →"), the objectives checklist (type checks tagged `type`, plus a final "No type errors" line), and the player's note from last time if there is one. **Lesson** holds the lesson. **Hints n/3** reveals hints one at a time, using a 🎟 hint token for free if the player has one, otherwise −1 ★. It also has "Show the solution…": until all three hints are seen, that modal sends the player back to the hints. Once it's revealed, there's no "Load it into the editor" until the level is solved, because the player rebuilds it.
- **Middle (work)**: a toolbar with the file name, "Loading compiler…" while needed (no clock: time is tracked silently for the speed bonus), Reset (with a confirm modal) and **Run** (with a ⌘↵/Ctrl↵ hint). Below it, the editor, then a status line ("✓ No type errors" or "✗ n type errors — hover the red squiggles").
- **Right (results)**: the **boss HP bar** on boss levels (each passing check is a hit), the live **Preview** on React levels, and **Checks n/m** with ✓/✗, each failure's message, type errors with line numbers and a 💡 plain-English line, a crash box, and the **Console** output. After two failed runs without opening the lesson, a `.nudge` above the checks suggests it.

The player's code autosaves 500 ms after typing stops. Leaving and coming back never loses work.

**`src/screens/CodeLevelScreen.tsx`**

~~~~tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Diagnostic } from '../engine/checker';
import { compile, isReady, onReady } from '../engine/compiler';
import { explainDiagnostic } from '../engine/explain';
import { grade, type Report } from '../engine/grade';
import { codeStars, isBoss, levelState, nextHintCosts } from '../game/progress';
import { codeOutcome, completeLevel, PET_LINES, recordRun, replayLevel, revealHint as revealHintAction, revealSolution as revealSolutionAction, type Reward } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, setSave, useSave } from '../game/store';
import type { CodeLevel, Deck } from '../game/types';
import { CodeEditor } from '../ui/CodeEditor';
import { Code } from '../ui/highlight';
import { Markdown, inline } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { overlays } from '../ui/overlays';
import { Preview } from '../ui/Preview';
import { Victory } from '../ui/Victory';
import { useLevelTimer } from '../ui/useLevelTimer';

type Tab = 'mission' | 'lesson' | 'hints';

const RUN_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ ↵' : 'Ctrl ↵';

export function CodeLevelScreen({ level, deck, index }: { level: CodeLevel; deck: Deck; index: number }) {
  const save = useSave();
  const progress = levelState(save, level.id);
  const [code, setCode] = useState(() => progress.code ?? level.starter);
  const [tab, setTabState] = useState<Tab>('mission');
  const [lessonSeen, setLessonSeen] = useState(false);
  const [failedRuns, setFailedRuns] = useState(0);
  const setTab = (t: Tab) => {
    if (t === 'lesson') setLessonSeen(true);
    setTabState(t);
  };
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<{ code: string; diagnostics: Diagnostic[] }>({ code: '', diagnostics: [] });
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState(0);
  const [modal, setModal] = useState<'reset' | 'solution' | null>(null);
  const [victory, setVictory] = useState<{ stars: number; events: Reward[] } | null>(null);
  // Time is tracked quietly for the speed bonus, but never shown ticking:
  // a visible clock adds pressure and pulls attention away from the problem.
  const seconds = useLevelTimer(level.id, !victory);
  const [compilerReady, setCompilerReady] = useState(isReady());
  const mainPath = `/${level.file}`;

  useEffect(() => onReady(() => setCompilerReady(true)), []);

  // Hold announcements while the player works; let them through on the victory screen.
  useEffect(() => {
    overlays.setFocus(!victory);
    return () => overlays.setFocus(false);
  }, [victory]);

  // Live type checking as you type, debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      compile({ [mainPath]: code }).then((r) => setLive({ code, diagnostics: r.diagnostics.filter((d) => d.file === mainPath) }), () => {});
    }, 350);
    return () => clearTimeout(t);
  }, [code, mainPath]);

  // Autosave the player's code.
  useEffect(() => {
    const t = setTimeout(() => {
      setSave((s) => ({ ...s, levels: { ...s.levels, [level.id]: { ...levelState(s, level.id), code } } }));
    }, 500);
    return () => clearTimeout(t);
  }, [code, level.id]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    sfx.run();
    try {
      const r = await grade(level, code, compile);
      setReport(r);
      setLogs(r.logs);
      setRunId((n) => n + 1);
      act((st) => recordRun({ ...st, levels: { ...st.levels, [level.id]: { ...levelState(st, level.id), code } } }, level.id, r.passed));
      if (r.passed) {
        const outcome = codeOutcome(getSave(), level, seconds);
        const events = act((st) => completeLevel(st, level, outcome, Math.random));
        sfx.pass();
        overlays.petSay(PET_LINES.pass[Math.floor(Math.random() * PET_LINES.pass.length)]);
        setVictory({ stars: outcome.stars, events });
      } else {
        sfx.fail();
        setFailedRuns((n) => n + 1);
      }
    } catch (e) {
      setLogs([`✖ ${(e as Error).message}`]);
      sfx.fail();
    } finally {
      setRunning(false);
    }
  }, [code, level, running, seconds]);

  // The Run shortcut works anywhere on the level screen, not only in the editor
  // (the editor handles it itself and marks the event as handled).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.defaultPrevented || modal || victory) return;
      e.preventDefault();
      void run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, modal, victory]);

  function revealHint(useToken: boolean) {
    sfx.click();
    act((s) => revealHintAction(s, level.id, level.hints.length, useToken));
  }

  function revealSolution() {
    act((s) => revealSolutionAction(s, level.id));
  }

  function loadSolution() {
    setCode(level.solution);
    setModal(null);
  }

  function replay() {
    setSave((s) => replayLevel(s, level.id, level.starter));
    setCode(level.starter);
    setReport(null);
    setVictory(null);
  }

  const diagnostics = live.code === code ? live.diagnostics : [];
  const potential = codeStars(progress);
  const allChecks = report ? [...report.typeChecks.map((c) => ({ ...c, type: true })), ...report.checks.map((c) => ({ ...c, type: false }))] : [];
  const passCount = allChecks.filter((c) => c.pass).length;

  // The lesson's sections, as a list of what this level teaches.
  const goals = useMemo(() => [...level.lesson.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim()), [level]);
  const hintsLeft = level.hints.length - progress.hints;
  const note = save.notes[level.id];

  const objectives = useMemo(
    () => [...(level.typeChecks ?? []).map((c) => ({ label: c.label, type: true })), ...level.checks.map((c) => ({ label: c.label, type: false }))],
    [level],
  );

  return (
    <div className="level">
      <aside className="panel brief">
        <div className="level-head">
          <span className="deck-tag" style={{ ['--hue' as string]: deck.hue }}>{deck.name} · {index + 1}</span>
          <h2>{level.title}</h2>
          <p className="system">System: {level.system}</p>
          <p className="stars-line" title="Stars you can still earn on this attempt">
            {progress.done && <span className="best">Best {'★'.repeat(progress.stars)}{'☆'.repeat(3 - progress.stars)} · </span>}
            Worth {'★'.repeat(potential)}{'☆'.repeat(3 - potential)}
          </p>
        </div>
        <div className="tabs" role="tablist">
          {(['mission', 'lesson', 'hints'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'mission' ? 'Mission' : t === 'lesson' ? 'Lesson' : `Hints ${progress.hints}/${level.hints.length}`}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'mission' && (
            <>
              <Markdown text={level.brief} />
              {goals.length > 0 && (
                <div className="learn-goals">
                  <h4>You'll learn</h4>
                  <ul>
                    {goals.map((g) => <li key={g}>{inline(g)}</li>)}
                  </ul>
                  <button className="link" onClick={() => setTab('lesson')}>Read the lesson first →</button>
                </div>
              )}
              <h4>Objectives</h4>
              <ul className="objectives">
                {objectives.map((o) => {
                  const r = allChecks.find((c) => c.label === o.label);
                  return (
                    <li key={o.label} className={r ? (r.pass ? 'pass' : 'fail') : ''}>
                      <span className="mark">{r ? (r.pass ? '✓' : '✗') : '○'}</span>
                      {o.type && <span className="type-tag">type</span>}
                      {inline(o.label)}
                    </li>
                  );
                })}
                <li className={report ? (report.typeErrors.length ? 'fail' : 'pass') : ''}>
                  <span className="mark">{report ? (report.typeErrors.length ? '✗' : '✓') : '○'}</span>
                  <span className="type-tag">type</span>
                  No type errors
                </li>
              </ul>
              <p className="muted small">Stuck? The <button className="link" onClick={() => setTab('lesson')}>Lesson</button> tab teaches the idea; <button className="link" onClick={() => setTab('hints')}>Hints</button> nudge you toward the answer.</p>
              {note && (
                <div className="your-note">
                  <b>Your note from last time</b>
                  <p>{note.text}</p>
                </div>
              )}
            </>
          )}
          {tab === 'lesson' && <Markdown text={level.lesson} />}
          {tab === 'hints' && (
            <div className="hints">
              {level.hints.slice(0, progress.hints).map((h, i) => (
                <div className="hint" key={i}>
                  <span className="hint-n">Hint {i + 1}</span>
                  <Markdown text={h} />
                </div>
              ))}
              {progress.hints < level.hints.length ? (
                <div className="hint-buttons">
                  {save.hintTokens > 0 && nextHintCosts(progress) && (
                    <button className="btn" onClick={() => revealHint(true)}>
                      🎟 Use a hint token <span className="muted small">(free · {save.hintTokens} left)</span>
                    </button>
                  )}
                  <button className={`btn ${save.hintTokens > 0 && nextHintCosts(progress) ? 'ghost' : ''}`} onClick={() => revealHint(false)}>
                    Reveal hint {progress.hints + 1}
                    {nextHintCosts(progress) ? <span className="cost"> (−1 ★)</span> : !progress.solution && <span className="muted small"> (free)</span>}
                  </button>
                </div>
              ) : (
                <p className="muted">That's every hint.</p>
              )}
              <hr />
              <button className="btn ghost danger" onClick={() => setModal('solution')}>Show the solution…</button>
              {hintsLeft > 0 && !progress.done && !progress.solution && <p className="muted small">The solution opens once you've seen all three hints.</p>}
            </div>
          )}
        </div>
      </aside>

      <section className="panel work">
        <div className="toolbar">
          <span className="file">{level.file}</span>
          <span className="spacer" />
          {!compilerReady && <span className="muted small">Loading compiler…</span>}
          <button className="btn ghost" onClick={() => setModal('reset')}>Reset</button>
          <button className="btn primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run'} <kbd>{RUN_SHORTCUT}</kbd>
          </button>
        </div>
        <CodeEditor value={code} path={mainPath} tsx={level.file.endsWith('tsx')} diagnostics={diagnostics} onChange={setCode} onRun={run} />
        <div className="status-line">
          {live.code === code && (live.diagnostics.length ? <span className="err">✗ {live.diagnostics.length} type error{live.diagnostics.length > 1 ? 's' : ''} — hover the red squiggles</span> : <span className="ok">✓ No type errors</span>)}
        </div>
      </section>

      <section className="panel results">
        {isBoss(level) && <BossBar name={level.system} report={report} />}
        {level.preview && (
          <div className="preview">
            <h4>Preview</h4>
            {report && !report.loadError ? (
              <Preview level={level} js={report.js} runId={runId} log={(l) => setLogs((ls) => [...ls.slice(-49), l])} />
            ) : (
              <p className="muted small">{report?.loadError ? 'Your code crashed — see below.' : 'Run your code to see it here.'}</p>
            )}
          </div>
        )}
        <div className="report">
          {failedRuns >= 2 && !lessonSeen && !report?.passed && (
            <div className="nudge">
              💡 <b>Stuck?</b> The lesson explains exactly the idea this level needs, with an example.{' '}
              <button className="link" onClick={() => setTab('lesson')}>Open the lesson</button>
            </div>
          )}
          <h4>
            Checks {report && <span className={report.passed ? 'ok' : 'err'}>{passCount}/{allChecks.length}</span>}
          </h4>
          {!report && <p className="muted small">Press <b>Run</b> to compile your code and test it.</p>}
          {report?.loadError && <div className="crash">💥 {report.loadError}</div>}
          {report && report.typeErrors.length > 0 && (
            <div className="type-errors">
              {report.typeErrors.map((d, i) => (
                <div key={i} className="diag">
                  <span className="loc">line {d.line}</span> {d.message}
                  {explainDiagnostic(d.code, d.message) && <span className="plain">💡 {inline(explainDiagnostic(d.code, d.message)!)}</span>}
                </div>
              ))}
            </div>
          )}
          {report && (
            <ul className="checks">
              {allChecks.map((c) => (
                <li key={c.label} className={c.pass ? 'pass' : 'fail'}>
                  <span className="mark">{c.pass ? '✓' : '✗'}</span>
                  <div>
                    {c.type && <span className="type-tag">type</span>}
                    {inline(c.label)}
                    {c.message && <div className="why">{c.message}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {logs.length > 0 && (
            <div className="console">
              <h4>Console</h4>
              {logs.map((l, i) => <div key={i} className={`log ${l.startsWith('✖') ? 'err' : l.startsWith('⚠') ? 'warn' : ''}`}>{l}</div>)}
            </div>
          )}
        </div>
      </section>

      {modal === 'reset' && (
        <Modal title="Reset the code?" onClose={() => setModal(null)}>
          <p>Your changes to {level.file} will be replaced with the starter code.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { setCode(level.starter); setReport(null); setModal(null); }}>Reset</button>
          </div>
        </Modal>
      )}
      {modal === 'solution' && (
        <Modal title="Reference solution" onClose={() => setModal(null)} wide>
          {progress.solution || progress.done ? (
            <>
              <Code code={level.solution} />
              {!progress.done && <p className="muted">Close it, then write it yourself. Rebuilding it from memory is what makes it stick; pasting it doesn't.</p>}
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setModal(null)}>Close</button>
                {progress.done && <button className="btn" onClick={loadSolution}>Load it into the editor</button>}
              </div>
            </>
          ) : hintsLeft > 0 ? (
            <>
              <p>
                Try the hints first: {hintsLeft === level.hints.length ? 'there are three' : `${hintsLeft} left`}. Each one gets you closer without giving the answer away,
                and working it out (even slowly) is what makes it stick.
              </p>
              <p className="muted">The solution opens once you've seen every hint.</p>
              <div className="modal-actions">
                <button className="btn primary" onClick={() => { setModal(null); setTab('hints'); }}>Back to the hints</button>
              </div>
            </>
          ) : (
            <>
              <p>Seeing the solution caps this attempt at <b>★☆☆</b>. You can always replay the level later for three stars.</p>
              <p className="muted">Reading it, closing it, and writing it yourself from memory is a perfectly good way to learn.</p>
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setModal(null)}>Keep trying</button>
                <button className="btn danger" onClick={revealSolution}>Reveal the solution</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {victory && <Victory level={level} stars={victory.stars} events={victory.events} onReplay={replay} onClose={() => setVictory(null)} />}
    </div>
  );
}

/** A boss's health: every failing check is armour it still has. Each Run that passes more checks does damage. */
function BossBar({ name, report }: { name: string; report: Report | null }) {
  const total = report ? report.checks.length + report.typeChecks.length + 1 : 1;
  const failing = report ? report.checks.filter((c) => !c.pass).length + report.typeChecks.filter((c) => !c.pass).length + (report.typeErrors.length ? 1 : 0) : total;
  const hp = report ? Math.round((failing / total) * 100) : 100;
  return (
    <div className={`boss-bar ${hp === 0 ? 'defeated' : ''}`} role="meter" aria-label={`Boss health ${hp}%`} aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100}>
      <div className="boss-name">
        <span>☢ BOSS: {name}</span>
        <span>{hp === 0 ? 'DEFEATED' : `${hp}% HP`}</span>
      </div>
      <div className="boss-hp"><div style={{ width: `${hp}%` }} /></div>
      {report && hp > 0 && <span className="muted small">Each check you pass is a hit. {failing} to go.</span>}
    </div>
  );
}
~~~~

### The other screens (specs)

Build these to the specs below. Copy class names and visible text exactly; the browser bot depends on them.

**Title screen** (`TitleScreen`): an animated reactor core (three spinning rings and a glowing nucleus, brightness scaled by station power, minimum 8%), the logo `RE<span>ACT</span>OR` (the "ACT" in accent colour), the tagline "A TypeScript & React quest", two intro paragraphs (the story; a THE FEED line), and buttons: **Begin** (or **Continue** / **Return to the station**), **Station map**, and **Review (n due)** when cards are due. Begin asks for a name first if there isn't one: the "Sign the crew register" modal, with an input labelled **Your name** and a **Go live** button. It then goes to the next unfinished level. Under the buttons: "Station power N%", plus name, crawler level and viewers once started.

**HUD** (`Hud`, a `<header className="hud">`): the brand (back to the title), nav buttons **Map · Review · Loot · Safe Room · Character** (Review shows a badge with the number of cards due, Loot with the unopened box count), then a crawler chip (`Lv n`, name, class icon, career title · equipped title, XP bar) that links to Character. Then stats: 🪙 gold, 👁 viewers, 🎟 tokens, 🚀 boosts if any, a 🎁 button that opens all boxes, ⚡ power%. Then a sound toggle (🔊/🔈) and the 🎨 **ThemePicker** at the far right.

**Map** (`MapScreen`): a "Next up" card, then a **Review** panel once the deck has cards ("n cards to review" with **Start review →**, or "All caught up" and when the next cards come back, plus the deck size and how many are remembered for a month or more), then **Daily quests** ("Today's contracts", with a 🔥 streak). Each quest has a progress bar, n/goal, and a **Claim 🎁** button when done ("Reward: Silver box + 30 gold" before then). Then one panel per floor, tinted by its hue (`--hue`): "Floor n · subtitle", name, outcome, n/m online, ★ count, and the sponsor chip once cleared. Each level is a node button with an orb (number, `?` for quizzes, ☢ for bosses, 🔒 if locked), its title, and stars. A boss that is open early shows "skip ahead?".

**Quiz** (`QuizScreen`): the brief and "Quick reference" (the lesson) on the left. On the right, a progress strip of dots, then the prompt, the code and options lettered A–D. After answering, the right answer turns green and a wrong pick turns red. An explanation box ("Correct." / "Not quite.") has a **Next question →** / **Finish** button. A missed question goes to the back of the queue ("This one comes back at the end…") and is asked again until it's right; stars count first-try mistakes only. Finishing calls `completeLevel` with quiz stars.

**Review** (`ReviewScreen`, given in full below): a session of at most 10 due cards, no timer. Each card shows where it came from ("From <floor>: <level>"), the prompt, code and options (shuffled per day), then an explanation with **Revisit the lesson: <level>** and **Next card →**. A missed card returns at the end of the session ("One more try"). The end screen shows first-try score and when cards come back, with empty-deck and all-caught-up states that explain spacing.

**Loot** (`LootScreen`, tabs in the URL): **Boxes** (list with source and tier colour; "Open all n"), **Collection** (collectibles sorted by rarity; unfound shown as ❔ ???), **Codex** (scrolls; **Read** opens the scroll's markdown in a modal), **Wardrobe** (titles, editor skins and companion hats, with Equip/Equipped/Take off; locked ones show their shop price).

**Safe Room** (`ShopScreen`): the shopkeeper's welcome, a wallet line, a grid of **wares** (hint token 60, XP boost ×3 for 150, bronze/silver/gold boxes for 50/120/300, priced cosmetics), **Retraining** (change class for 300 gold) and **Companion** (rename the pet).

**Character** (`CharacterScreen`, tabs in the URL): a header with a portrait (the class icon, or 🧑‍🚀), the equipped title, name with **rename**, crawler level, career title, an XP bar, and buttons to choose a class or adopt a pet if eligible and not yet done. Then a stat grid: power, systems online, stars, viewers, achievements, best streak. Tabs: **Skills** (21 skills grouped by school with pips, rank and points/next, plus the career ladder and class/companion), **Achievements** (all 58; unearned ones dimmed), **Notebook** (the player's own explanations, in curriculum order, each with a "revisit" link), **Log** (the inbox, newest first), **Settings** (sound, "Open every system", **Download a backup** (a JSON file of the save) and **Restore from a backup…** (validated with `parseSave`, then confirmed in a modal showing what the backup holds), and "Reset all progress…" with a confirm modal).

**Victory** (`Victory` modal, after a pass; given in full below): a kicker (`<system> — online`, or `☢ BOSS DEFEATED · <system>`), three big stars animating in, an ARIA line (rotating; special for bosses and for the final level), THE FEED's line, a reward row (+XP with detail, +gold, +viewers, boxes), crawler level-ups and skill-ups, an **Explain it back** textarea with **Save note**, a rank bar, and actions: **Replay for ★★★** (if under 3 stars), **🎁 Open box(es)**, **Stay here**, **Next system →** (autofocused; Enter also works). When it closes, pending offers (pet or class) are shown.

**Announcer** (THE FEED's cards, top right): every reward event becomes a card. Achievements, level-ups, sponsors and fan milestones get big cards (7 s, with a fanfare sound). Skill-ups, streaks and FEED lines get slim cards (4.5 s). An achievement's own box rides on its card with an **Open** button. All other boxes merge into one "You received … **Open**" card. **One card shows at a time**, and the rest queue (maximum 12, shedding small news first). While the player is working on a level (`overlays.focus`, set by the level screen until its victory modal opens), nothing is shown at all: news waits until they finish. An "n more · see everything in your log" link appears when cards are queued.

**Box opener** (`BoxOpener` modal): the box's source, "<Tier> Box", a big animated box (it shakes for 0.7 s on **Open it**), then the loot lines animating in one by one: gold, tokens, boosts, and items with rarity colour, a NEW tag, and the description (scrolls say "Added to your Codex"). Buttons: **Next box (n left)** / **Collect**, and **Later**.

**Offers** (modals): the name entry (above), **pet adoption** (6 pets to choose from, a name field, **Adopt** / "Maybe later") and the **class picker** (5 classes with perk and flavour, **Become a <Class>** / "Decide later"; retraining costs 300 gold).

**Companion**: the pet floats in the bottom-left corner, wearing its equipped hat. It says a line in a speech bubble for 3.5 s on a pass, sometimes on a fail, and when a box is opened.

The three components below show the expected style of the rest. They are given in full because the browser bot drives them closely.

**`src/screens/ReviewScreen.tsx`**

~~~~tsx
// Spaced review: a short session of questions about things you've already
// learned, each due on its own schedule. Remembering on purpose, with growing
// gaps in between, is what moves knowledge into long-term memory. Cards you
// miss come back at the end of the session (so you finish having got them
// right) and again tomorrow; cards you know come back later and less often.
import { useState } from 'react';
import { findLevel } from '../content';
import { addDays, answerReview, dayOf, dueReviews, finishReview, nextReviewDay, REVIEW_INTERVALS, REVIEW_MONTH_BOX, REVIEW_SESSION } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, useSave } from '../game/store';
import type { ReviewItem } from '../game/types';
import { Code } from '../ui/highlight';
import { inline } from '../ui/Markdown';
import { go } from '../ui/router';

/** A stable shuffle of a card's options for today, so the answer isn't always in the same place. */
function order(item: ReviewItem, today: string): number[] {
  const idx = item.options.map((_, i) => i);
  let h = 2166136261;
  for (const ch of item.id + today) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function when(day: string | null, today: string): string {
  if (!day) return 'when you clear more levels';
  if (day === addDays(today, 1)) return 'tomorrow';
  const days = Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  return `in ${days} days`;
}

export function ReviewScreen() {
  // Each round is a fresh session of whatever is due.
  const [round, setRound] = useState(0);
  return <ReviewSession key={round} onAgain={() => setRound((r) => r + 1)} />;
}

function ReviewSession({ onAgain }: { onAgain(): void }) {
  const save = useSave();
  const today = dayOf(new Date());
  const [queue, setQueue] = useState<ReviewItem[]>(() => dueReviews(getSave(), today).slice(0, REVIEW_SESSION));
  const [size] = useState(queue.length);
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  /** Cards missed this session, waiting at the back of the line for another try. */
  const [retrying, setRetrying] = useState<string[]>([]);
  /** Cards seen for the first time so far, counting the one on screen. */
  const [position, setPosition] = useState(1);
  const deckSize = Object.keys(save.reviews).length;

  const item = queue[0];
  const firstTry = Object.values(recorded).filter(Boolean).length;
  const mistakes = Object.values(recorded).filter((r) => !r).length;

  if (!item || finished) {
    const due = dueReviews(save, today).length;
    const next = nextReviewDay(save, today);
    return (
      <div className="review">
        <section className="panel review-intro">
          <p className="kicker">Review</p>
          {size > 0 ? (
            <>
              <h2>Session complete</h2>
              <div className="final-score">{firstTry}/{size}</div>
              <p>remembered on the first try.</p>
              <p className="muted">
                Cards you knew come back in {REVIEW_INTERVALS[1]} to {REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]} days, a little later each time you remember them.
                {mistakes > 0 && ` The ${mistakes} you missed come back tomorrow.`}
              </p>
            </>
          ) : deckSize === 0 ? (
            <>
              <h2>Nothing to review yet</h2>
              <p>
                When you finish a quiz, or a TypeScript or React level, its key ideas join your review deck. They come back the next day,
                then again a few days later, then a week, a month… each time you remember them, the gap grows.
              </p>
              <p className="muted">Remembering on purpose, spaced out over days, is the most reliable way to make what you learn stick.</p>
            </>
          ) : (
            <>
              <h2>All caught up</h2>
              <p>Nothing is due today. Your next review is {when(next, today)}.</p>
            </>
          )}
          <p className="muted small">
            {deckSize} card{deckSize === 1 ? '' : 's'} in your deck · {Object.values(save.reviews).filter((r) => r.box >= REVIEW_MONTH_BOX).length} remembered for a month or more
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => go('/map')}>Back to the map</button>
            {due > 0 && size > 0 && <button className="btn primary" autoFocus onClick={onAgain}>Review {Math.min(due, REVIEW_SESSION)} more</button>}
          </div>
        </section>
      </div>
    );
  }

  const shown = order(item, today);
  const answered = picked !== null;
  const correct = answered && shown[picked] === item.answer;
  const source = findLevel(item.after);
  const box = save.reviews[item.id]?.box ?? 0;
  const again = retrying.includes(item.id);

  function pick(i: number) {
    if (answered) return;
    setPicked(i);
    const right = shown[i] === item.answer;
    if (right) sfx.right();
    else sfx.wrong();
    // Only the first answer in a session moves the card through its schedule.
    if (!(item.id in recorded)) {
      setRecorded((r) => ({ ...r, [item.id]: right }));
      act((s) => answerReview(s, item.id, right, today));
    }
  }

  function next() {
    const rest = queue.slice(1);
    // A missed card goes to the back of the line, until you get it right.
    const nextQueue = correct ? rest : [...rest, item];
    setPicked(null);
    setQueue(nextQueue);
    if (!correct && !again) setRetrying((r) => [...r, item.id]);
    if (correct && again) setRetrying((r) => r.filter((id) => id !== item.id));
    if (!again && nextQueue.length && !retrying.includes(nextQueue[0].id) && nextQueue[0].id !== item.id) setPosition((p) => p + 1);
    if (!nextQueue.length) {
      const all = { ...recorded };
      act((s) => finishReview(s, Object.keys(all).length, Object.values(all).filter((r) => !r).length));
      sfx.pass();
      setFinished(true);
    }
  }

  return (
    <div className="review">
      <div className="review-progress">
        <span className="muted small">
          {again ? 'One more try' : `Card ${Math.min(position, size)} of ${size}`}
        </span>
        <span className="pips" aria-label={`Known: box ${box} of ${REVIEW_INTERVALS.length - 1}`} title="How well you know this card">
          {REVIEW_INTERVALS.slice(1).map((_, i) => <span key={i} className={i < box ? 'on' : ''} />)}
        </span>
      </div>
      <section className="panel quiz-card review-card">
        <p className="kicker">From {source ? `${source.deck.name}: ${source.level.title}` : 'an earlier level'}</p>
        <h3 className="prompt">{inline(item.prompt)}</h3>
        {item.code && <Code code={item.code} />}
        <div className="options">
          {shown.map((o, i) => {
            const state = !answered ? '' : o === item.answer ? 'right' : i === picked ? 'wrong' : 'dim';
            return (
              <button key={o} className={`option ${state}`} onClick={() => pick(i)} disabled={answered && state !== 'right' && state !== 'wrong'}>
                <span className="letter">{'ABCD'[i]}</span>
                <span>{inline(item.options[o])}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`explain ${correct ? 'right' : 'wrong'}`}>
            <b>{correct ? 'Correct.' : 'Not quite.'}</b> {inline(item.explain)}
            {!correct && !again && <p className="muted small">You'll see this one again at the end of this session, and again tomorrow.</p>}
            <div className="modal-actions">
              {source && (
                <button className="btn ghost" onClick={() => go(`/level/${source.level.id}`)}>
                  Revisit the lesson: {source.level.title}
                </button>
              )}
              <button className="btn primary" autoFocus onClick={next}>
                {queue.length > 1 || !correct ? 'Next card →' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
~~~~

**`src/ui/Hud.tsx`**

~~~~tsx
import { item } from '../game/items';
import { crawlerLevel, stationPower } from '../game/progress';
import { classInfo, dayOf, dueReviews, formatViewers } from '../game/rewards';
import { setSave, useSave } from '../game/store';
import { overlays } from './overlays';
import { go, type Route } from './router';
import { ThemePicker } from './ThemePicker';

export function Hud({ route }: { route: Route }) {
  const save = useSave();
  const lvl = crawlerLevel(save.xp);
  const power = stationPower(save);
  const cls = classInfo(save.classId);
  const due = dueReviews(save, dayOf(new Date())).length;
  const nav: [Route['name'], string, string][] = [
    ['map', '/map', 'Map'],
    ['review', '/review', 'Review'],
    ['loot', '/loot', 'Loot'],
    ['shop', '/shop', 'Safe Room'],
    ['character', '/character', 'Character'],
  ];
  return (
    <header className="hud">
      <button className="brand" onClick={() => go('/')} aria-label="Title screen">
        RE<span>ACT</span>OR
      </button>
      <nav>
        {nav.map(([name, path, label]) => (
          <button key={name} className={route.name === name ? 'active' : ''} onClick={() => go(path)}>
            {label}
            {name === 'loot' && save.boxes.length > 0 && <span className="badge">{save.boxes.length}</span>}
            {name === 'review' && due > 0 && <span className="badge" title={`${due} card${due === 1 ? '' : 's'} due for review`}>{due}</span>}
          </button>
        ))}
      </nav>
      <span className="spacer" />
      <button className="crawler" onClick={() => go('/character')} title={`${save.xp} XP — ${lvl.toNext} to level ${lvl.level + 1}`}>
        <span className="lvl">Lv {lvl.level}</span>
        <span className="who">
          <b>{save.name || 'Engineer'}</b>
          <span className="muted small">{cls ? `${cls.icon} ` : ''}{lvl.title} · {item(save.equipped.title).name}</span>
        </span>
        <span className="bar xp" aria-label={`XP ${Math.round(lvl.progress * 100)}%`}><span style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></span>
      </button>
      <div className="stats">
        <span title="Gold — spend it in the Safe Room">🪙 {save.gold}</span>
        <span title="Viewers watching THE FEED">👁 {formatViewers(save.viewers)}</span>
        <span title="Hint tokens — reveal a hint without losing a star">🎟 {save.hintTokens}</span>
        {save.boosts > 0 && <span title="XP boost: +50% on your next clears">🚀 {save.boosts}</span>}
        <button className="stat-btn" title="Open your boxes" onClick={() => (save.boxes.length ? overlays.openBoxes(save.boxes.map((b) => b.id)) : go('/loot'))}>
          🎁 {save.boxes.length}
        </button>
        <span className="power" title={`Station power ${power}%`}>⚡ {power}%</span>
      </div>
      <button className="icon-btn" onClick={() => setSave((s) => ({ ...s, sound: !s.sound }))} aria-label={save.sound ? 'Mute sound' : 'Unmute sound'}>
        {save.sound ? '🔊' : '🔈'}
      </button>
      <ThemePicker />
    </header>
  );
}
~~~~

**`src/ui/Victory.tsx`**

~~~~tsx
import { useEffect, useState } from 'react';
import { ALL_LEVELS } from '../content';
import { crawlerLevel, isBoss } from '../game/progress';
import { formatViewers, saveNote, type Reward } from '../game/rewards';
import { SKILLS, SKILL_RANKS } from '../game/skills';
import { act, useSave } from '../game/store';
import type { Level } from '../game/types';
import { overlays } from './overlays';
import { go } from './router';

const LINES = [
  'System restored. The station hums a little louder.',
  'Compiler satisfied. That is not a small thing.',
  'Green across the board. The crew noticed.',
  'Another light comes on down the corridor.',
  'Clean build. ARIA approves.',
];

export function Victory({ level, stars, events, onReplay, onClose }: { level: Level; stars: number; events: Reward[]; onReplay(): void; onClose(): void }) {
  const save = useSave();
  const lvl = crawlerLevel(save.xp);
  const idx = ALL_LEVELS.findIndex((l) => l.id === level.id);
  const next = ALL_LEVELS[idx + 1];
  const final = !next;
  const boss = isBoss(level);

  const xp = events.filter((e) => e.kind === 'xp').reduce((n, e) => n + (e.kind === 'xp' ? e.amount : 0), 0);
  const xpDetail = events.find((e) => e.kind === 'xp' && e.detail !== 'level clear');
  const gold = events.reduce((n, e) => n + (e.kind === 'gold' ? e.amount : 0), 0);
  const viewers = events.find((e) => e.kind === 'viewers');
  const skillUps = events.filter((e) => e.kind === 'skill-up');
  const boxes = events.flatMap((e) => (e.kind === 'box' ? [e.box] : []));
  const feed = events.find((e) => e.kind === 'feed');
  const levelUps = events.filter((e) => e.kind === 'level-up');

  const leave = (path?: string) => {
    onClose();
    overlays.flushOffers();
    if (path) go(path);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !typing && !(e.target instanceof HTMLButtonElement)) leave(next ? `/level/${next.id}` : '/map');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const line = final ? 'The last system is online. Orrery Station is alive again — because of you, engineer.' : boss ? 'Floor boss defeated! The next section of the station powers up.' : LINES[idx % LINES.length];
  return (
    <div className="modal-backdrop victory-backdrop">
      <div className={`modal victory ${final ? 'final' : ''} ${boss ? 'boss-win' : ''}`} role="dialog" aria-modal="true" aria-label="Level complete">
        <div className="burst" aria-hidden />
        <p className="victory-kicker">{boss ? `☢ BOSS DEFEATED · ${level.system}` : `${level.system} — online`}</p>
        <div className="big-stars" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? 'on' : ''} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>★</span>
          ))}
        </div>
        <p className="aria-line"><b>ARIA:</b> {line}</p>
        {feed?.kind === 'feed' && <p className="feed-line"><b>THE FEED:</b> <i>{feed.text}</i></p>}

        <div className="reward-row">
          <div className="reward"><b>{xp > 0 ? `+${xp}` : '—'}</b><span>XP{xpDetail?.kind === 'xp' ? ` (${xpDetail.detail})` : ''}</span></div>
          <div className="reward"><b>{gold > 0 ? `+${gold}` : '—'}</b><span>gold</span></div>
          <div className="reward"><b>{viewers?.kind === 'viewers' ? `+${formatViewers(viewers.amount)}` : '—'}</b><span>viewers</span></div>
          <div className="reward"><b>{boxes.length || '—'}</b><span>box{boxes.length === 1 ? '' : 'es'}</span></div>
        </div>
        {xp === 0 && <p className="muted small">No new rewards: beat your best stars to earn more.</p>}
        {events.some((e) => e.kind === 'gold' && e.detail.includes('speed bonus')) && <p className="muted small">⚡ Cleared under par time: speed bonus included.</p>}

        {(skillUps.length > 0 || levelUps.length > 0) && (
          <ul className="ups">
            {levelUps.map((e) => e.kind === 'level-up' && (
              <li key={`l${e.level}`}>⬆ Crawler level <b>{e.level}</b>{e.newTitle && <> — promoted to <b>{e.title}</b></>}</li>
            ))}
            {skillUps.map((e) => e.kind === 'skill-up' && (
              <li key={e.skill}>{SKILLS[e.skill].icon} <b>{SKILLS[e.skill].name}</b> is now level {e.level} <span className="muted">({SKILL_RANKS[e.level]})</span></li>
            ))}
          </ul>
        )}

        <ExplainBack level={level} />

        <div className="rank-row">
          <span>Lv {lvl.level} · {lvl.title}</span>
          <div className="bar"><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          <span className="muted small">{lvl.toNext} XP to level {lvl.level + 1}</span>
        </div>

        <div className="modal-actions">
          {stars < 3 && <button className="btn ghost" onClick={onReplay}>Replay for ★★★</button>}
          {boxes.length > 0 && (
            <button className="btn" onClick={() => overlays.openBoxes(boxes.map((b) => b.id))}>
              🎁 Open {boxes.length === 1 ? 'box' : `${boxes.length} boxes`}
            </button>
          )}
          <button className="btn ghost" onClick={() => leave()}>Stay here</button>
          {next ? (
            <button className="btn primary" autoFocus onClick={() => leave(`/level/${next.id}`)}>Next system →</button>
          ) : (
            <button className="btn primary" autoFocus onClick={() => leave('/map')}>See the station</button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Explaining what you just did, in your own words, is one of the most reliable
 * ways to understand it (and to notice what you don't). Optional, kept in the
 * notebook, and shown again next time you open the level.
 */
function ExplainBack({ level }: { level: Level }) {
  const save = useSave();
  const existing = save.notes[level.id]?.text ?? '';
  const [text, setText] = useState(existing);
  const [saved, setSaved] = useState(false);
  const prompt =
    level.kind === 'code'
      ? 'Explain it back: what was wrong, and why does your fix work? Write it as if to a crewmate.'
      : "Explain it back: what's one thing from this quiz you want to remember?";

  function save_() {
    act((s) => saveNote(s, level.id, text, Date.now()));
    setSaved(true);
  }

  return (
    <div className="explain-back">
      <label htmlFor="explain-back">{prompt}</label>
      <textarea
        id="explain-back"
        value={text}
        maxLength={600}
        placeholder="In a sentence or two… (optional)"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="row">
        <span className="muted small">
          {saved ? 'Saved to your notebook.' : 'Kept in Character → Notebook, and shown next time you open this level.'}
        </span>
        <button className="btn small-btn" disabled={!text.trim() || text.trim() === existing} onClick={save_}>
          Save note
        </button>
      </div>
    </div>
  );
}
~~~~

**`src/ui/Announcer.tsx`**

~~~~tsx
// THE FEED's announcements: a stack of cards for everything the reward engine
// reports — achievements get the full treatment, smaller things a slim line.
import { useEffect, useRef, useState } from 'react';
import { TIER_INFO, formatViewers, type Reward } from '../game/rewards';
import { SKILLS, SKILL_RANKS } from '../game/skills';
import { sfx } from '../game/sound';
import { getSave, onRewards } from '../game/store';
import { overlays, useOverlays } from './overlays';
import { go } from './router';

interface Card {
  key: number;
  big: boolean;
  icon: string;
  kicker: string;
  title: string;
  body?: string;
  tone: string;
  action?: { label: string; run(): void };
  /** Set on the "You received" card, so a new one can absorb an older one. */
  boxIds?: string[];
}

let nextKey = 1;

function cardsFor(events: Reward[]): Card[] {
  const out: Card[] = [];
  // An achievement's own box rides on the achievement's card instead of getting a card of its own.
  const boxFor = new Map<string, string>();
  for (const e of events) if (e.kind === 'box' && e.box.source.startsWith('Achievement: ')) boxFor.set(e.box.source.slice('Achievement: '.length), e.box.id);
  const boxes = events.filter((e) => e.kind === 'box' && !(e.box.source.startsWith('Achievement: ') && events.some((a) => a.kind === 'achievement' && boxFor.get(a.achievement.name) === e.box.id)));
  for (const e of events) {
    const key = nextKey++;
    switch (e.kind) {
      case 'achievement': {
        const a = e.achievement;
        const box = boxFor.get(a.name);
        out.push({
          key,
          big: true,
          icon: a.icon,
          kicker: 'New achievement!',
          title: a.name,
          body: `${a.description} ${a.quip}${box ? ` +${TIER_INFO[a.tier].name} box` : ''}`,
          tone: TIER_INFO[a.tier].color,
          action: box ? { label: 'Open', run: () => overlays.openBoxes([box]) } : undefined,
        });
        break;
      }
      case 'level-up':
        out.push({ key, big: true, icon: '⬆', kicker: 'Level up!', title: `Crawler level ${e.level}`, body: e.newTitle ? `Promotion! You are now a ${e.title}.` : undefined, tone: '#4fd1ff' });
        break;
      case 'skill-up':
        out.push({ key, big: false, icon: SKILLS[e.skill].icon, kicker: 'Skill up', title: `${SKILLS[e.skill].name} is now level ${e.level}`, body: SKILL_RANKS[e.level], tone: '#b794f6' });
        break;
      case 'sponsor':
        out.push({ key, big: true, icon: e.sponsor.icon, kicker: `Sponsor gift · ${e.floor} cleared`, title: e.sponsor.name, body: e.sponsor.message, tone: '#9be6ff' });
        break;
      case 'fans':
        out.push({ key, big: true, icon: '👁', kicker: 'Viewer milestone!', title: `${formatViewers(e.milestone)} viewers`, body: 'Your fans pooled together and sent you a Fan Box.', tone: '#ff8ad8' });
        break;
      case 'streak':
        if (e.count > 1) out.push({ key, big: false, icon: '🔥', kicker: 'Streak', title: `${e.count} days in a row`, tone: '#ffb347' });
        break;
      case 'feed':
        out.push({ key, big: false, icon: '📺', kicker: 'THE FEED', title: e.text, tone: '#ffb347' });
        break;
    }
  }
  if (boxes.length) out.push(boxCard(boxes.map((b) => (b.kind === 'box' ? b.box.id : '')), boxes.length === 1 && boxes[0].kind === 'box' ? `${TIER_INFO[boxes[0].box.tier].name} box: ${boxes[0].box.source}` : undefined));
  return out;
}

function boxCard(ids: string[], label = `${ids.length} loot boxes`): Card {
  return { key: nextKey++, big: false, icon: '🎁', kicker: 'You received', title: label, tone: '#ffc94d', boxIds: ids, action: { label: 'Open', run: () => overlays.openBoxes(ids) } };
}

/** Fold box cards together: `into`'s boxes (if any) absorb `fresh`'s, keeping `into`'s key. */
function mergeBox(into: Card, fresh: Card): Card {
  const unopened = new Set(getSave().boxes.map((b) => b.id));
  const ids = [...new Set([...into.boxIds!, ...fresh.boxIds!])].filter((id) => unopened.has(id));
  return { ...boxCard(ids, ids.length === 1 ? fresh.title : undefined), key: into.key };
}

// One card at a time: news should be noticed, not pile up over the work.
const MAX_SHOWN = 1;
const MAX_WAITING = 12;

export function Announcer({ quiet }: { quiet?: boolean }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [queued, setQueued] = useState(0);
  const dismissRef = useRef<(key: number) => void>(() => {});
  const { focus } = useOverlays();
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const syncRef = useRef<() => void>(() => {});
  // While the player is working on a level, news waits; it arrives when they finish.
  useEffect(() => syncRef.current(), [focus]);

  // At most four cards on screen; the rest wait their turn, so a burst of news
  // (a boss clear can bring a dozen) never buries a level-up or an achievement.
  useEffect(() => {
    let shown: Card[] = [];
    let waiting: Card[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sync = () => {
      while (!focusRef.current && shown.length < MAX_SHOWN && waiting.length) {
        const c = waiting.shift()!;
        shown.push(c);
        const t = setTimeout(() => {
          timers.delete(t);
          dismiss(c.key);
        }, c.big ? 7000 : 4500);
        timers.add(t);
      }
      setCards([...shown]);
      setQueued(waiting.length);
    };
    const dismiss = (key: number) => {
      shown = shown.filter((c) => c.key !== key);
      sync();
    };
    dismissRef.current = dismiss;
    syncRef.current = sync;
    const off = onRewards((events) => {
      const fresh = cardsFor(events);
      if (!fresh.length) return;
      if (fresh.some((c) => c.big)) sfx.unlock();
      for (const c of fresh) {
        // One "You received" card at a time: a new one tops up the one already there.
        const i = c.boxIds ? shown.findIndex((x) => x.boxIds) : -1;
        const j = c.boxIds ? waiting.findIndex((x) => x.boxIds) : -1;
        if (i !== -1) shown[i] = mergeBox(shown[i], c);
        else if (j !== -1) waiting[j] = mergeBox(waiting[j], c);
        else waiting.push(c);
      }
      // A long backlog sheds its small news first; everything is in the log anyway.
      while (waiting.length > MAX_WAITING) {
        const small = waiting.findIndex((c) => !c.big && !c.action);
        waiting.splice(small === -1 ? 0 : small, 1);
      }
      sync();
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  if (quiet) return null;
  return (
    <div className="announcer" aria-live="polite">
      {cards.map((c) => (
        <div key={c.key} className={`card-note ${c.big ? 'big' : ''}`} style={{ ['--tone' as string]: c.tone }}>
          <span className="note-icon" aria-hidden>{c.icon}</span>
          <div className="note-body">
            <span className="kicker">{c.kicker}</span>
            <b>{c.title}</b>
            {c.body && <span className="note-text">{c.body}</span>}
          </div>
          {c.action && (
            <button className="btn small-btn" onClick={() => { c.action!.run(); dismissRef.current(c.key); }}>
              {c.action.label}
            </button>
          )}
          <button className="note-close" aria-label="Dismiss" onClick={() => dismissRef.current(c.key)}>×</button>
        </div>
      ))}
      {cards.length > 0 && queued > 0 && (
        <button className="link small" onClick={() => go('/character/log')}>{queued} more · see everything in your log</button>
      )}
    </div>
  );
}
~~~~

**`src/ui/Offers.tsx`**

~~~~tsx
import { useState } from 'react';
import { CLASSES, PETS, changeClass, checkAchievements, choosePet, CLASS_CHANGE_PRICE } from '../game/rewards';
import type { ClassId, PetKind } from '../game/progress';
import { sfx } from '../game/sound';
import { act, setSave, useSave } from '../game/store';
import { Modal } from './Modal';
import { overlays, useOverlays } from './overlays';

export function Offers() {
  const { offer } = useOverlays();
  if (offer === 'name') return <NameEntry />;
  if (offer === 'pet') return <PetAdoption />;
  if (offer === 'class') return <ClassPicker />;
  return null;
}

function NameEntry() {
  const save = useSave();
  const [name, setName] = useState(save.name);
  const done = () => {
    setSave((s) => ({ ...s, name: name.trim().slice(0, 24) || 'Engineer' }));
    overlays.offer(null);
  };
  return (
    <Modal title="Sign the crew register" onClose={done}>
      <p><b>THE FEED:</b> <i>Welcome to Repair Crew LIVE, the galaxy's favourite show about one person fixing an entire space station with code! What should our four billion viewers call you?</i></p>
      <form onSubmit={(e) => { e.preventDefault(); done(); }}>
        <label htmlFor="crawler-name" className="field-label">Your name</label>
        <input id="crawler-name" className="text-input" autoFocus maxLength={24} value={name} placeholder="Engineer" onChange={(e) => setName(e.target.value)} />
        <div className="modal-actions">
          <button className="btn primary" type="submit">Go live</button>
        </div>
      </form>
    </Modal>
  );
}

function PetAdoption() {
  const [kind, setKind] = useState<PetKind>('drone');
  const [name, setName] = useState('');
  const adopt = () => {
    sfx.unlock();
    act((s) => checkAchievements(choosePet(s, kind, name)));
    overlays.offer(null);
  };
  return (
    <Modal title="A companion wants to join you" onClose={() => overlays.offer(null)} wide>
      <p><b>ARIA:</b> Something followed you out of the Boot Sequence. Several somethings, actually. They've decided you're their engineer now. Pick one: it'll keep you company, cheer when your code runs, and console you when it doesn't.</p>
      <div className="choice-grid">
        {PETS.map((p) => (
          <button key={p.kind} className={`choice ${kind === p.kind ? 'picked' : ''}`} aria-pressed={kind === p.kind} onClick={() => setKind(p.kind)}>
            <span className="choice-icon">{p.icon}</span>
            <b>{p.name}</b>
            <span className="muted small">{p.blurb}</span>
          </button>
        ))}
      </div>
      <label htmlFor="pet-name" className="field-label">Name it</label>
      <input id="pet-name" className="text-input" maxLength={20} value={name} placeholder={PETS.find((p) => p.kind === kind)!.name} onChange={(e) => setName(e.target.value)} />
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => overlays.offer(null)}>Maybe later</button>
        <button className="btn primary" onClick={adopt}>Adopt</button>
      </div>
    </Modal>
  );
}

export function ClassPicker({ onDone }: { onDone?: () => void }) {
  const save = useSave();
  const [pick, setPick] = useState<ClassId>(save.classId ?? 'type-sorcerer');
  const changing = !!save.classId;
  const close = () => (onDone ? onDone() : overlays.offer(null));
  const confirm = () => {
    act((s) => {
      const next = changeClass(s, pick);
      return next ? checkAchievements(next) : null;
    });
    sfx.unlock();
    close();
  };
  return (
    <Modal title={changing ? 'Change your class' : 'Choose your class'} onClose={close} wide>
      {changing ? (
        <p className="muted">Retraining costs {CLASS_CHANGE_PRICE} gold. You have {save.gold}.</p>
      ) : (
        <p><b>THE FEED:</b> <i>Our engineer has conquered JavaScript itself! Tradition demands they choose a CLASS. Choose wisely — or don't, you can retrain later for a fee. We're not monsters. We're a television network.</i></p>
      )}
      <div className="choice-grid">
        {CLASSES.map((c) => (
          <button key={c.id} className={`choice ${pick === c.id ? 'picked' : ''}`} aria-pressed={pick === c.id} onClick={() => setPick(c.id)}>
            <span className="choice-icon">{c.icon}</span>
            <b>{c.name}</b>
            <span className="perk">{c.perk}</span>
            <span className="muted small">{c.flavor}</span>
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={close}>{changing ? 'Cancel' : 'Decide later'}</button>
        <button className="btn primary" onClick={confirm} disabled={changing && (pick === save.classId || save.gold < CLASS_CHANGE_PRICE)}>
          {changing ? `Retrain (${CLASS_CHANGE_PRICE} gold)` : `Become a ${CLASSES.find((c) => c.id === pick)!.name}`}
        </button>
      </div>
    </Modal>
  );
}
~~~~

---

## Part 9. Look and feel: the stylesheet

One stylesheet, `src/styles.css` (about 600 dense lines, roughly 50 KB). The look is a dark sci-fi console: deep navy panels with soft gradients and borders, cool cyan accent, warm amber for rewards, monospace code, and gentle motion. Everything is driven by CSS custom properties, so a colour profile (Part 10) restyles the whole game, syntax highlighting included. Derived colours use `color-mix()` so every profile gets them for free.

The tokens, base elements, buttons and panels, copied exactly:

~~~~css
:root {
  /* Base palette: these are the defaults (the Reactor profile); src/ui/themes.ts
     overwrites them on <html> with the chosen colour profile. */
  --bg: #070b16;
  --bg2: #0c1324;
  --panel: #111a2f;
  --panel2: #16213b;
  --line: #22304f;
  --text: #dbe5f7;
  --muted: #8a9abb;
  --accent: #4fd1ff;
  --on-accent: #031018;
  --gold: #ffb347;
  --green: #4ade80;
  --red: #f87171;
  --violet: #b794f6;
  --editor: #0a1122;
  --gutter: #4a5a7d;
  --syn-keyword: #c792ea;
  --syn-string: #c3e88d;
  --syn-number: #f78c6c;
  --syn-comment: #5c6f94;
  --syn-type: #ffcb6b;
  --syn-fn: #82aaff;
  --syn-prop: #82aaff;
  --syn-variable: #dbe5f7;
  --syn-tag: #f07178;
  --syn-attr: #ffcb6b;
  --syn-op: #89ddff;

  /* Derived from the palette, so every profile gets them for free. */
  --accent-2: color-mix(in srgb, var(--accent) 55%, white);
  --gold-2: color-mix(in srgb, var(--gold) 55%, white);
  --panel-end: color-mix(in srgb, var(--panel) 70%, var(--bg));
  --hud-bg: color-mix(in srgb, var(--bg) 85%, transparent);
  --note-bg: color-mix(in srgb, var(--panel) 97%, transparent);
  --star-off: color-mix(in srgb, var(--line) 75%, var(--muted));
  --on-gold: #1a1000;
  --strong: color-mix(in srgb, var(--text) 40%, white);
  --backdrop: rgba(3, 6, 14, 0.72);
  --shadow: rgba(0, 0, 0, 0.5);
  /* Floor colours and announcement tones are tuned for dark surfaces; light profiles pull them darker. */
  --hue-l: 68%;
  --hue-l2: 62%;
  --tone-mix: 100%;

  --mono: 'SF Mono', ui-monospace, Menlo, Monaco, 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, Ubuntu, Cantarell, sans-serif;
  --radius: 10px;
  color-scheme: dark;
}
:root[data-scheme='light'] {
  --on-gold: #ffffff;
  --strong: color-mix(in srgb, var(--text) 60%, black);
  --backdrop: rgba(30, 36, 48, 0.45);
  --shadow: rgba(30, 40, 60, 0.18);
  --hue-l: 36%;
  --hue-l2: 45%;
  --tone-mix: 55%;
  --accent-2: color-mix(in srgb, var(--accent) 70%, white);
  color-scheme: light;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background:
    radial-gradient(1200px 600px at 80% -10%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, color-mix(in srgb, var(--gold) 6%, transparent), transparent 60%),
    var(--bg);
  color: var(--text);
  font: 15px/1.55 var(--sans);
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; }
code, kbd, pre { font-family: var(--mono); }
code { font-size: 0.88em; background: color-mix(in srgb, var(--accent) 9%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 15%, transparent); padding: 0.05em 0.35em; border-radius: 4px; }
kbd { font-size: 0.75em; padding: 0.1em 0.4em; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; background: var(--bg2); color: var(--muted); }
h1, h2, h3, h4 { line-height: 1.2; margin: 0 0 0.5em; }
h4 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-top: 1.2em; }
.muted { color: var(--muted); }
.small { font-size: 0.85em; }
.ok { color: var(--green); }
.err { color: var(--red); }
.kicker { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); margin: 0 0 0.3em; }
hr { border: 0; border-top: 1px solid var(--line); margin: 1.2em 0; }

/* ---------- buttons */
.btn {
  display: inline-flex; align-items: center; gap: 0.5em; justify-content: center;
  padding: 0.5em 1em; border-radius: 8px; border: 1px solid var(--line);
  background: var(--panel2); cursor: pointer; transition: transform 0.08s, background 0.15s, border-color 0.15s;
}
.btn:hover:not(:disabled) { border-color: var(--accent); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn.primary { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, white), color-mix(in srgb, var(--accent) 82%, black)); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
.btn.primary kbd { background: rgba(0, 0, 0, 0.15); color: var(--on-accent); border-color: rgba(0, 0, 0, 0.25); }
.btn.ghost { background: transparent; }
.btn.danger { border-color: color-mix(in srgb, var(--red) 50%, transparent); color: var(--red); }
.btn.danger:not(.ghost) { background: color-mix(in srgb, var(--red) 12%, transparent); }
.btn.big { padding: 0.75em 1.4em; font-size: 1.05rem; }
.link { background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; text-decoration: underline; }
.icon-btn { background: none; border: 1px solid transparent; border-radius: 8px; padding: 0.2em 0.45em; cursor: pointer; font-size: 1.1rem; }
.icon-btn:hover { border-color: var(--line); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.panel { background: linear-gradient(180deg, var(--panel), var(--panel-end)); border: 1px solid var(--line); border-radius: var(--radius); }

~~~~

Syntax colours map CodeMirror/Lezer token classes to the profile:

~~~~css
pre.code code { background: none; border: 0; padding: 0; font-size: inherit; }
.tok-keyword, .tok-modifier, .tok-controlKeyword, .tok-definitionKeyword, .tok-moduleKeyword, .tok-operatorKeyword { color: var(--syn-keyword); }
.tok-string, .tok-string2 { color: var(--syn-string); }
.tok-number, .tok-bool, .tok-null, .tok-atom { color: var(--syn-number); }
.tok-comment { color: var(--syn-comment); font-style: italic; }
.tok-typeName, .tok-className, .tok-namespace { color: var(--syn-type); }
.tok-propertyName { color: var(--syn-prop); }
.tok-variableName.tok-definition, .tok-function { color: var(--syn-fn); }
.tok-variableName { color: var(--syn-variable); }
.tok-tagName { color: var(--syn-tag); }
.tok-attributeName { color: var(--syn-attr); }
.tok-operator, .tok-punctuation { color: var(--syn-op); }
~~~~

The rest, as a spec:

- **Shell**: `.app` is a full-height flex column. `.hud` is a blurred translucent bar (z-index 45). `main` scrolls and has 12–16 px padding.
- **Level layout**: `.level` is a 3-column grid, `minmax(260px, .95fr) minmax(360px, 1.5fr) minmax(280px, 1fr)` with a 12 px gap, filling the height (minimum 560 px). `.quiz` has 2 columns. Under 1100 px the level is 2 columns. Under 760 px everything is one column and nothing scrolls sideways (the browser bot checks this at 420 px wide).
- **Editor**: `.editor` flexes to fill. `.cm-editor` uses `var(--editor)` and 14 px `var(--mono)` at line-height 1.6. Gutters use `--gutter`. The cursor is in accent colour. Selection and matching brackets are tinted with `color-mix`. Hover cards are `.cm-type-tip`: a panel with a highlighted `<pre>`, then muted doc text.
- **Checks and objectives**: `li.pass` is green ✓ and `li.fail` is red ✗, with `.why` in muted small text. `.type-tag` is a tiny violet pill reading "type".
- **Map**: each `.deck` panel has a 3 px left border in `hsl(var(--hue) 85% var(--hue-l2))` and its kicker in `hsl(var(--hue) 85% var(--hue-l))`. The `--hue-l` values are lighter on dark profiles and darker on light ones. `.nodes` is an auto-fill grid of 118 px node cards, each a round `.orb` above the title and a star line. A `.node.done` orb is tinted and glows in the floor's hue, a `.node.next` orb glows in a slow accent pulse, a `.node.boss` orb is bigger (54 px, double border), and locked nodes are dimmed.
- **Boss bar**: a red gradient HP bar with a "☢ BOSS: name / n% HP" row. It turns green and shows "DEFEATED" at 0.
- **Victory**: a centred modal with a slowly rotating conic-gradient `.burst` behind it, `.big-stars` that pop in with staggered `animation-delay`, a 4-column `.reward-row`, and gold accents. `.final` and `.boss-win` variants get bigger bursts.
- **Loot box**: `.loot-box.<tier>` is a big emoji box with a glow in the tier colour (`--tone`). `.shaking` wiggles. Loot lines slide in using their `animation-delay`.
- **Announcer**: `position: fixed; right: 14px; top: 64px; z-index: 70; width: min(380px, calc(100vw - 28px)); pointer-events: none`, with the cards themselves clickable. Each `.card-note` has a coloured left border (`--tone`). `.big` cards are larger and pop in.
- **Companion**: fixed bottom-left (`left: 14px; bottom: 14px; z-index: 40; pointer-events: none`). The pet bobs gently, the hat sits above it, and the speech bubble pops up beside it.
- **Editor skins** (the cosmetic `theme-*` items) are classes on `.app` that override the editor's background and token colours. For example, `.theme-phosphor` is green on black with a glow, `.theme-solar` amber, `.theme-nebula` purple and pink, `.theme-arctic` icy blue, and `.theme-gold` gold leaf. `theme-reactor` ("Standard Issue") changes nothing.
- **Motion**: honour `prefers-reduced-motion: reduce` by turning off animations and transitions.
- **Focus**: `:focus-visible` shows a 2 px accent outline everywhere.

---

## Part 10. Sixteen colour profiles

The 🎨 button at the top right of every screen opens a menu of **17 profiles**: the station's own **Reactor** look (the default) plus **sixteen** modelled on the best-loved VS Code and IntelliJ themes. Hovering, or arrowing through the grid, **previews** a profile live. Clicking or Return keeps it. Escape, or clicking away, restores the old one. The choice is remembered per device in `localStorage` (`reactor-quest/theme`), separately from the save. Light profiles set `data-scheme="light"` on `<html>`, which flips a few derived tokens (Part 9). SynthWave '84 sets `data-glow`, which adds a neon text-shadow to syntax tokens, the logo, the brand, kickers and `h2`s, and a glow around primary buttons.

Each profile sets 15 base colours and 11 syntax colours. A test (Part 13) enforces readable contrast for every profile and that no two look alike. If you change a colour, keep those tests green.

**`src/ui/themes.ts`**

~~~~ts
// Colour profiles: the station's original look plus sixteen others modelled
// on the best-loved VS Code and IntelliJ themes. Each one is a set of CSS
// custom properties applied to <html>; the stylesheet derives everything else
// (gradients, glows, tints) from these, so a profile recolours the whole game,
// syntax highlighting included.
import { useSyncExternalStore } from 'react';

export interface Palette {
  /** Page background, and the slightly darker wells inside panels. */
  bg: string;
  bg2: string;
  /** Panel surfaces, and raised controls on them. */
  panel: string;
  panel2: string;
  line: string;
  text: string;
  muted: string;
  /** The theme's signature colour: links, focus, primary buttons, progress. */
  accent: string;
  /** Text on an accent-coloured button. */
  onAccent: string;
  /** Rewards, stars and warnings. */
  gold: string;
  green: string;
  red: string;
  violet: string;
  editor: string;
  gutter: string;
  syntax: {
    keyword: string;
    string: string;
    number: string;
    comment: string;
    type: string;
    fn: string;
    prop: string;
    variable: string;
    tag: string;
    attr: string;
    op: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  /** Where the original lives. */
  from: 'VS Code' | 'IntelliJ' | 'VS Code · IntelliJ' | 'Reactor';
  blurb: string;
  scheme: 'dark' | 'light';
  /** Neon text glow, for themes that are all about the glow. */
  glow?: boolean;
  palette: Palette;
}

export const DEFAULT_THEME = 'reactor';

export const THEMES: Theme[] = [
  {
    id: 'reactor',
    name: 'Reactor',
    from: 'Reactor',
    blurb: "The station's own colours: cool blue, warm amber.",
    scheme: 'dark',
    palette: {
      bg: '#070b16', bg2: '#0c1324', panel: '#111a2f', panel2: '#16213b', line: '#22304f', text: '#dbe5f7', muted: '#8a9abb',
      accent: '#4fd1ff', onAccent: '#031018', gold: '#ffb347', green: '#4ade80', red: '#f87171', violet: '#b794f6',
      editor: '#0a1122', gutter: '#4a5a7d',
      syntax: { keyword: '#c792ea', string: '#c3e88d', number: '#f78c6c', comment: '#5c6f94', type: '#ffcb6b', fn: '#82aaff', prop: '#82aaff', variable: '#dbe5f7', tag: '#f07178', attr: '#ffcb6b', op: '#89ddff' },
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    from: 'VS Code · IntelliJ',
    blurb: 'Hot pink and electric purple on a vampire-grey night.',
    scheme: 'dark',
    palette: {
      bg: '#21222c', bg2: '#191a21', panel: '#282a36', panel2: '#343746', line: '#44475a', text: '#f8f8f2', muted: '#a4abd0',
      accent: '#ff79c6', onAccent: '#21222c', gold: '#ffb86c', green: '#50fa7b', red: '#ff5555', violet: '#bd93f9',
      editor: '#282a36', gutter: '#6272a4',
      syntax: { keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9', comment: '#7282b4', type: '#8be9fd', fn: '#50fa7b', prop: '#ffb86c', variable: '#f8f8f2', tag: '#ff79c6', attr: '#50fa7b', op: '#ff79c6' },
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    from: 'VS Code',
    blurb: "Atom's classic: calm slate, soft blue, nothing shouting.",
    scheme: 'dark',
    palette: {
      bg: '#21252b', bg2: '#1b1f23', panel: '#282c34', panel2: '#2f343e', line: '#3e4451', text: '#abb2bf', muted: '#9199a6',
      accent: '#61afef', onAccent: '#14171c', gold: '#e5c07b', green: '#98c379', red: '#e06c75', violet: '#c678dd',
      editor: '#282c34', gutter: '#636d83',
      syntax: { keyword: '#c678dd', string: '#98c379', number: '#d19a66', comment: '#7f848e', type: '#e5c07b', fn: '#61afef', prop: '#e06c75', variable: '#abb2bf', tag: '#e06c75', attr: '#d19a66', op: '#56b6c2' },
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    from: 'VS Code',
    blurb: 'Neon signs reflected in a midnight street.',
    scheme: 'dark',
    palette: {
      bg: '#16161e', bg2: '#111118', panel: '#1a1b26', panel2: '#222436', line: '#2f334d', text: '#c0caf5', muted: '#7f88b5',
      accent: '#bb9af7', onAccent: '#16161e', gold: '#e0af68', green: '#9ece6a', red: '#f7768e', violet: '#7aa2f7',
      editor: '#1a1b26', gutter: '#545c7e',
      syntax: { keyword: '#bb9af7', string: '#9ece6a', number: '#ff9e64', comment: '#636da6', type: '#2ac3de', fn: '#7aa2f7', prop: '#73daca', variable: '#c0caf5', tag: '#f7768e', attr: '#bb9af7', op: '#89ddff' },
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    from: 'VS Code · IntelliJ',
    blurb: 'Soothing pastels on a warm, dark mocha.',
    scheme: 'dark',
    palette: {
      bg: '#181825', bg2: '#11111b', panel: '#1e1e2e', panel2: '#313244', line: '#45475a', text: '#cdd6f4', muted: '#a6adc8',
      accent: '#fab387', onAccent: '#1e1e2e', gold: '#f9e2af', green: '#a6e3a1', red: '#f38ba8', violet: '#cba6f7',
      editor: '#1e1e2e', gutter: '#6c7086',
      syntax: { keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387', comment: '#7f849c', type: '#f9e2af', fn: '#89b4fa', prop: '#b4befe', variable: '#cdd6f4', tag: '#89b4fa', attr: '#f9e2af', op: '#94e2d5' },
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    from: 'VS Code · IntelliJ',
    blurb: 'Arctic frost and polar night. Very calm. Very Scandinavian.',
    scheme: 'dark',
    palette: {
      bg: '#2e3440', bg2: '#292e39', panel: '#3b4252', panel2: '#434c5e', line: '#4c566a', text: '#eceff4', muted: '#b0bacb',
      accent: '#88c0d0', onAccent: '#2e3440', gold: '#ebcb8b', green: '#a3be8c', red: '#e5838b', violet: '#b48ead',
      editor: '#2e3440', gutter: '#616e88',
      syntax: { keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead', comment: '#8390a8', type: '#8fbcbb', fn: '#88c0d0', prop: '#d8dee9', variable: '#d8dee9', tag: '#81a1c1', attr: '#8fbcbb', op: '#81a1c1' },
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    from: 'VS Code · IntelliJ',
    blurb: 'Retro groove: earthy browns, toasted yellows, burnt orange.',
    scheme: 'dark',
    palette: {
      bg: '#1d2021', bg2: '#171a1a', panel: '#282828', panel2: '#32302f', line: '#504945', text: '#ebdbb2', muted: '#a89984',
      accent: '#fabd2f', onAccent: '#282828', gold: '#fe8019', green: '#b8bb26', red: '#fb4934', violet: '#d3869b',
      editor: '#282828', gutter: '#7c6f64',
      syntax: { keyword: '#fb4934', string: '#b8bb26', number: '#d3869b', comment: '#928374', type: '#fabd2f', fn: '#8ec07c', prop: '#83a598', variable: '#ebdbb2', tag: '#fe8019', attr: '#fabd2f', op: '#fe8019' },
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    from: 'VS Code · IntelliJ',
    blurb: 'The classic Monokai, refined: lime, pink and lemon on charcoal.',
    scheme: 'dark',
    palette: {
      bg: '#221f22', bg2: '#19181a', panel: '#2d2a2e', panel2: '#383539', line: '#4a474b', text: '#fcfcfa', muted: '#a9a7a9',
      accent: '#a9dc76', onAccent: '#221f22', gold: '#ffd866', green: '#a9dc76', red: '#ff6188', violet: '#ab9df2',
      editor: '#2d2a2e', gutter: '#6b696b',
      syntax: { keyword: '#ff6188', string: '#ffd866', number: '#ab9df2', comment: '#848284', type: '#78dce8', fn: '#a9dc76', prop: '#fc9867', variable: '#fcfcfa', tag: '#ff6188', attr: '#78dce8', op: '#ff6188' },
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    from: 'VS Code',
    blurb: 'Made for coding at 2 a.m.: deep ocean blue, sea-glass teal.',
    scheme: 'dark',
    palette: {
      bg: '#011627', bg2: '#010e1a', panel: '#0b2942', panel2: '#13344f', line: '#1d3b53', text: '#d6deeb', muted: '#8ba3bd',
      accent: '#7fdbca', onAccent: '#011627', gold: '#ecc48d', green: '#addb67', red: '#ef5350', violet: '#c792ea',
      editor: '#011627', gutter: '#4b6479',
      syntax: { keyword: '#c792ea', string: '#ecc48d', number: '#f78c6c', comment: '#7a9292', type: '#ffcb8b', fn: '#82aaff', prop: '#7fdbca', variable: '#d6deeb', tag: '#caece6', attr: '#addb67', op: '#7fdbca' },
    },
  },
  {
    id: 'synthwave-84',
    name: "SynthWave '84",
    from: 'VS Code',
    blurb: 'Neon on a purple horizon. Yes, the code glows.',
    scheme: 'dark',
    glow: true,
    palette: {
      bg: '#1e1830', bg2: '#171226', panel: '#262335', panel2: '#34294f', line: '#463465', text: '#f4eee4', muted: '#a8a2c8',
      accent: '#36f9f6', onAccent: '#1e1830', gold: '#fede5d', green: '#72f1b8', red: '#fe4450', violet: '#ff7edb',
      editor: '#262335', gutter: '#6d77b3',
      syntax: { keyword: '#fede5d', string: '#ff8b39', number: '#f97e72', comment: '#8a91c4', type: '#fe4450', fn: '#36f9f6', prop: '#ff7edb', variable: '#f4eee4', tag: '#72f1b8', attr: '#fede5d', op: '#f97e72' },
    },
  },
  {
    id: 'cobalt2',
    name: 'Cobalt2',
    from: 'VS Code',
    blurb: "Wes Bos's punchy yellow-on-cobalt. Impossible to ignore.",
    scheme: 'dark',
    palette: {
      bg: '#15232d', bg2: '#0f1c25', panel: '#193549', panel2: '#1f4662', line: '#2a5576', text: '#ffffff', muted: '#a3bed4',
      accent: '#ffc600', onAccent: '#15232d', gold: '#ff9d00', green: '#3ad900', red: '#ff628c', violet: '#fb94ff',
      editor: '#193549', gutter: '#5b86a8',
      syntax: { keyword: '#ff9d00', string: '#3ad900', number: '#ff628c', comment: '#4ea1ff', type: '#80ffbb', fn: '#ffc600', prop: '#9effff', variable: '#e1efff', tag: '#9effff', attr: '#ffc600', op: '#ff9d00' },
    },
  },
  {
    id: 'darcula',
    name: 'Darcula',
    from: 'IntelliJ',
    blurb: "JetBrains' own dark theme: orange keywords, olive strings, zero fuss.",
    scheme: 'dark',
    palette: {
      bg: '#2b2b2b', bg2: '#232425', panel: '#3c3f41', panel2: '#424547', line: '#55595c', text: '#cbcbcb', muted: '#a3a3a3',
      accent: '#e8914c', onAccent: '#1e1e1e', gold: '#e8bf6a', green: '#7fb35a', red: '#ff6b68', violet: '#9876aa',
      editor: '#2b2b2b', gutter: '#606366',
      syntax: { keyword: '#cc7832', string: '#7a9a63', number: '#6897bb', comment: '#808080', type: '#a9b7c6', fn: '#ffc66d', prop: '#a685b8', variable: '#a9b7c6', tag: '#e8bf6a', attr: '#bababa', op: '#a9b7c6' },
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    from: 'VS Code · IntelliJ',
    blurb: 'All natural pine, faux fur and a bit of soho vibes.',
    scheme: 'dark',
    palette: {
      bg: '#191724', bg2: '#13111c', panel: '#1f1d2e', panel2: '#26233a', line: '#403d52', text: '#e0def4', muted: '#908caa',
      accent: '#ebbcba', onAccent: '#191724', gold: '#f6c177', green: '#9ccfd8', red: '#eb6f92', violet: '#c4a7e7',
      editor: '#191724', gutter: '#6e6a86',
      syntax: { keyword: '#4a9fc4', string: '#f6c177', number: '#ebbcba', comment: '#7c7896', type: '#9ccfd8', fn: '#ebbcba', prop: '#c4a7e7', variable: '#e0def4', tag: '#9ccfd8', attr: '#c4a7e7', op: '#908caa' },
    },
  },
  {
    id: 'ayu-mirage',
    name: 'Ayu Mirage',
    from: 'VS Code · IntelliJ',
    blurb: 'Dusky blue-grey with a marigold glow.',
    scheme: 'dark',
    palette: {
      bg: '#1f2430', bg2: '#1a1f29', panel: '#242936', panel2: '#2d3343', line: '#3a4152', text: '#cccac2', muted: '#959ca5',
      accent: '#ffcc66', onAccent: '#1f2430', gold: '#ffad66', green: '#d5ff80', red: '#f28779', violet: '#dfbfff',
      editor: '#242936', gutter: '#6c7380',
      syntax: { keyword: '#ffad66', string: '#d5ff80', number: '#dfbfff', comment: '#7a8699', type: '#73d0ff', fn: '#ffd173', prop: '#f28779', variable: '#cccac2', tag: '#5ccfe6', attr: '#ffd173', op: '#f29e74' },
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    from: 'VS Code · IntelliJ',
    blurb: 'A green, comfortable forest. Easy on the eyes for long sessions.',
    scheme: 'dark',
    palette: {
      bg: '#272e33', bg2: '#1e2326', panel: '#2d353b', panel2: '#343f44', line: '#475258', text: '#d3c6aa', muted: '#9da9a0',
      accent: '#a7c080', onAccent: '#232a2e', gold: '#dbbc7f', green: '#a7c080', red: '#e67e80', violet: '#d699b6',
      editor: '#2d353b', gutter: '#7a8478',
      syntax: { keyword: '#e67e80', string: '#a7c080', number: '#d699b6', comment: '#859289', type: '#dbbc7f', fn: '#83c092', prop: '#7fbbb3', variable: '#d3c6aa', tag: '#e69875', attr: '#dbbc7f', op: '#e69875' },
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    from: 'VS Code · IntelliJ',
    blurb: "Crisp white, exactly like reading code on GitHub.",
    scheme: 'light',
    palette: {
      bg: '#f0f3f6', bg2: '#f6f8fa', panel: '#ffffff', panel2: '#eef1f4', line: '#d0d7de', text: '#1f2328', muted: '#59636e',
      accent: '#0969da', onAccent: '#ffffff', gold: '#9a6700', green: '#1a7f37', red: '#cf222e', violet: '#8250df',
      editor: '#ffffff', gutter: '#8c959f',
      syntax: { keyword: '#cf222e', string: '#0a3069', number: '#0550ae', comment: '#6e7781', type: '#953800', fn: '#8250df', prop: '#0550ae', variable: '#1f2328', tag: '#116329', attr: '#0550ae', op: '#cf222e' },
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    from: 'VS Code · IntelliJ',
    blurb: 'Precision-tuned warm parchment. A classic for daylight coding.',
    scheme: 'light',
    palette: {
      bg: '#eee8d5', bg2: '#f5efdc', panel: '#fdf6e3', panel2: '#f2ebd6', line: '#d9d0b6', text: '#475b62', muted: '#5d6f70',
      accent: '#2176b5', onAccent: '#fdf6e3', gold: '#946f00', green: '#6b7a00', red: '#cb2b28', violet: '#5b60b5',
      editor: '#fdf6e3', gutter: '#93a1a1',
      syntax: { keyword: '#6b7a00', string: '#1d8279', number: '#c42d78', comment: '#7a8888', type: '#946f00', fn: '#2176b5', prop: '#2176b5', variable: '#475b62', tag: '#2176b5', attr: '#946f00', op: '#6b7a00' },
    },
  },
];

/** The CSS custom properties a theme sets on <html>. */
export function themeVars(t: Theme): Record<string, string> {
  const p = t.palette;
  const vars: Record<string, string> = {
    '--bg': p.bg, '--bg2': p.bg2, '--panel': p.panel, '--panel2': p.panel2, '--line': p.line, '--text': p.text, '--muted': p.muted,
    '--accent': p.accent, '--on-accent': p.onAccent, '--gold': p.gold, '--green': p.green, '--red': p.red, '--violet': p.violet,
    '--editor': p.editor, '--gutter': p.gutter,
  };
  for (const [k, v] of Object.entries(p.syntax)) vars[`--syn-${k}`] = v;
  return vars;
}

export const findTheme = (id: string | null | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

const KEY = 'reactor-quest/theme';
let current = DEFAULT_THEME;
const listeners = new Set<() => void>();

function readStored(): string {
  try {
    return findTheme(localStorage.getItem(KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Paint a theme onto the page (without remembering it — used for hover previews too). */
export function paintTheme(id: string) {
  const t = findTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  root.dataset.scheme = t.scheme;
  if (t.glow) root.dataset.glow = '';
  else delete root.dataset.glow;
  root.style.colorScheme = t.scheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t.scheme);
}

/** Choose a theme: paint it, remember it on this device, and tell subscribers. */
export function setTheme(id: string) {
  current = findTheme(id).id;
  paintTheme(current);
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  for (const l of listeners) l();
}

/** Apply the remembered theme. Called once, before the first render, so there's no flash. */
export function initTheme() {
  current = readStored();
  paintTheme(current);
}

export function useTheme(): Theme {
  const id = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return findTheme(id);
}
~~~~

**`src/ui/ThemePicker.tsx`**

~~~~tsx
// The 🎨 button at the top right: pick one of the colour profiles. Hovering or
// arrowing through the list previews a profile live; clicking (or Return)
// keeps it; Escape or clicking away puts the old one back.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../game/sound';
import { paintTheme, setTheme, THEMES, useTheme, type Theme } from './themes';

function Swatch({ theme }: { theme: Theme }) {
  const p = theme.palette;
  const s = p.syntax;
  return (
    <span className="swatch" style={{ background: p.editor }} aria-hidden>
      <span className="bar-row">
        <i style={{ background: s.keyword, width: 14 }} />
        <i style={{ background: s.fn, width: 22 }} />
      </span>
      <span className="bar-row">
        <i style={{ background: s.variable, width: 10, marginLeft: 6 }} />
        <i style={{ background: s.string, width: 26 }} />
      </span>
      <span className="bar-row">
        <i style={{ background: s.type, width: 18, marginLeft: 6 }} />
        <i style={{ background: s.number, width: 8 }} />
      </span>
      <i style={{ background: p.accent, width: '100%', marginTop: 'auto' }} />
    </span>
  );
}

export function ThemePicker() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (refocus: boolean) => {
    paintTheme(theme.id); // drop any preview
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    options.current[THEMES.findIndex((t) => t.id === theme.id)]?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) close(false);
    };
    const resized = () => close(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('resize', resized);
    };
  }, [open]);

  const choose = (t: Theme) => {
    sfx.click();
    setTheme(t.id);
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1, Home: -i, End: THEMES.length - 1 - i }[e.key];
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (step !== undefined) {
      e.preventDefault();
      options.current[Math.min(THEMES.length - 1, Math.max(0, i + step))]?.focus();
    }
  };

  return (
    <div className="theme-picker" ref={root}>
      <button
        ref={button}
        className="icon-btn theme-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour profile: ${theme.name}`}
        title={`Colour profile: ${theme.name}`}
        onClick={() => {
          if (open) return close(false);
          // The menu lives above everything (THE FEED's cards included), anchored under this button.
          const r = button.current!.getBoundingClientRect();
          const width = Math.min(560, window.innerWidth - 24); // matches .theme-menu's width
          setPlace({ top: r.bottom + 8, left: Math.min(Math.max(12, r.right - width), window.innerWidth - 12 - width) });
          setOpen(true);
        }}
      >
        <span aria-hidden>🎨</span>
        <span className="dots" aria-hidden>
          {[theme.palette.accent, theme.palette.gold, theme.palette.violet].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
      </button>
      {open &&
        createPortal(
          <div ref={menu} className="theme-menu" style={place} role="dialog" aria-label="Colour profiles" onMouseLeave={() => paintTheme(theme.id)}>
            <header>
              <b>Colour profile</b>
              <span className="muted small">Hover to preview · click to keep</span>
            </header>
            <ul className="theme-grid" role="radiogroup" aria-label="Colour profiles">
              {THEMES.map((t, i) => (
                <li key={t.id}>
                  <button
                    ref={(el) => {
                      options.current[i] = el;
                    }}
                    role="radio"
                    aria-checked={t.id === theme.id}
                    className="theme-option"
                    title={t.blurb}
                    onMouseEnter={() => paintTheme(t.id)}
                    onFocus={() => paintTheme(t.id)}
                    onClick={() => choose(t)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <Swatch theme={t} />
                    <span>
                      <span className="name">
                        {t.name}
                        {t.id === theme.id && <span className="check">✓</span>}
                      </span>
                      <span className="from">{t.from === 'Reactor' ? 'The original' : t.from}{t.scheme === 'light' ? ' · light' : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
~~~~

The menu (`.theme-menu`) is a portal on `<body>`, fixed under the button, 560 px wide (or the viewport width minus 24 px), with a 2-column `.theme-grid` of option buttons. Each option shows a swatch: four tiny code-like bars on the editor colour, in the profile's keyword, function, string and type colours, with an accent strip, then the name with ✓ if current, and the origin ("VS Code · IntelliJ", "· light").

---

## Part 11. Running it: server, launcher and double-click scripts

### The server

`tools/server.mjs` is a tiny static server with **no dependencies**, so it can be copied as-is into the app packages:

- It serves one folder on `127.0.0.1`, always on port **4310**. If that's taken by another program it refuses to start and says why. It never moves to another port, because the browser keeps progress per address and a different port would make the save seem to vanish.
- `GET /__reactor` answers `reactor-quest`. Launchers use it to detect an already-running game and just open the browser.
- `POST /__heartbeat` is the game tab saying it's still open. With `--app`, the server exits a minute after the last heartbeat. That's how the packaged apps clean up after themselves.
- It blocks path traversal, sends long-cache headers for hashed `assets/`, and `no-cache` for everything else.
- It takes the flags `--app`, `--no-open`, `--port N` and `--log FILE`. `--log` is used by launchers that have no console.

**`tools/server.mjs`**

~~~~js
// A tiny static server for the built game — no dependencies, so it can be
// copied as-is into the macOS, Windows and Linux app packages. Serves one
// folder on localhost, opens the default browser, and (with --app) exits a
// minute after the last open game tab stops sending heartbeats.
import { createServer, request } from 'node:http';
import { createWriteStream, mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export const DEFAULT_PORT = 4310;
const SIGNATURE = 'reactor-quest';

/** Is a Reactor server already answering on this port? */
export function probe(port) {
  return new Promise((done) => {
    const req = request({ host: '127.0.0.1', port, path: '/__reactor', timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => done(body === SIGNATURE));
    });
    req.on('error', () => done(false));
    req.on('timeout', () => { req.destroy(); done(false); });
    req.end();
  });
}

export function startServer({ root, port = DEFAULT_PORT, idleExitMs = 0, quiet = false }) {
  const base = resolve(root);
  let lastBeat = Date.now();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__reactor') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(SIGNATURE);
    }
    if (url.pathname === '/__heartbeat') {
      lastBeat = Date.now();
      res.writeHead(204);
      return res.end();
    }
    let path = normalize(join(base, decodeURIComponent(url.pathname)));
    if (path !== base && !path.startsWith(base + sep)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, {
        'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': path.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  // Always the same port: the browser keeps progress per address, so moving
  // to another port when this one is busy would make the save seem to vanish.
  return new Promise((resolveStart, reject) => {
    const listen = (p) => {
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          reject(Object.assign(new Error(
            `Port ${p} is being used by another program, so Reactor can't start there.\n` +
              `Close that program and try again. (Reactor always uses the same port, because your progress is saved for that address.)`,
          ), { code: 'EADDRINUSE' }));
        } else reject(e);
      });
      server.listen(p, '127.0.0.1', () => {
        const url = `http://localhost:${p}/`;
        if (!quiet) console.log(`Reactor is running at ${url}  (Ctrl+C to stop)`);
        if (idleExitMs > 0) {
          setInterval(() => {
            if (Date.now() - lastBeat > idleExitMs) {
              if (!quiet) console.log('No open game tabs — shutting down.');
              process.exit(0);
            }
          }, 5000).unref();
        }
        resolveStart({ server, url, port: p });
      });
    };
    listen(port);
  });
}

export function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser launcher available: the URL is printed above */
  }
}

/** Is this module the script node was started with? (Case-insensitive on Windows, where drive letters vary.) */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  const [a, b] = [resolve(process.argv[1]), fileURLToPath(metaUrl)];
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// Run directly: node server.mjs [folder] [--app] [--no-open] [--port N] [--log FILE]
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const value = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const port = Number(value('--port') ?? DEFAULT_PORT);
  const root = args.find((a, i) => !a.startsWith('--') && !['--port', '--log'].includes(args[i - 1])) ?? join(fileURLToPath(new URL('.', import.meta.url)), 'app');
  // Launchers that start the server without a console (the Windows and Linux
  // apps) pass --log so its messages land somewhere you can read them.
  const log = value('--log');
  if (log) {
    mkdirSync(dirname(log), { recursive: true });
    const out = createWriteStream(log, { flags: 'a' });
    const write = (...parts) => out.write(`[${new Date().toISOString()}] ${parts.join(' ')}\n`);
    console.log = write;
    console.error = write;
  }
  if (await probe(port)) {
    console.log(`Reactor is already running — opening http://localhost:${port}/`);
    if (!flag('--no-open')) openBrowser(`http://localhost:${port}/`);
  } else {
    try {
      const { url } = await startServer({ root, port, idleExitMs: flag('--app') ? 60_000 : 0 });
      if (!flag('--no-open')) openBrowser(url);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
}
~~~~

### `npm start`

It checks the Node version (with OS-specific advice), installs dependencies on first run, rebuilds if any source file is newer than the build, then serves `dist/` and opens the browser.

**`tools/launch.mjs`**

~~~~js
// `npm start`: build the game if the source is newer than the last build,
// then serve it on localhost and open it in the default browser.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, openBrowser, probe, startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  const how = {
    darwin: 'download it from https://nodejs.org, or run `brew upgrade node`',
    win32: 'download it from https://nodejs.org, or run `winget install OpenJS.NodeJS.LTS`',
  }[process.platform] ?? 'see https://nodejs.org/en/download (your distro\'s package may be too old; `sudo snap install node --classic` or nvm get you a current one)';
  console.error(`Reactor needs Node.js 20.19 or newer (you have ${process.versions.node}). To update, ${how}.`);
  process.exit(1);
}

function newest(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(0, ...readdirSync(path).filter((n) => n !== 'generated').map((n) => newest(join(path, n))));
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(join(root, 'node_modules'))) {
  console.log('First run: installing dependencies…');
  run(npm, ['install', '--no-audit', '--no-fund']);
}

const built = join(root, 'dist', 'index.html');
const sourceTime = Math.max(newest(join(root, 'src')), newest(join(root, 'index.html')), newest(join(root, 'package.json')));
if (!existsSync(built) || statSync(built).mtimeMs < sourceTime) {
  console.log('Building the game…');
  run(npm, ['run', 'build', '--silent']);
}

if (await probe(DEFAULT_PORT)) {
  console.log(`Reactor is already running — opening http://localhost:${DEFAULT_PORT}/`);
  if (!args.includes('--no-open')) openBrowser(`http://localhost:${DEFAULT_PORT}/`);
} else {
  try {
    const { url } = await startServer({ root: join(root, 'dist') });
    if (!args.includes('--no-open')) openBrowser(url);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
~~~~

### Double-click launchers (in the project root)

macOS (`chmod +x`). Finder gives scripts a minimal `PATH`, so the script adds Homebrew, Volta, `~/.local/bin` and nvm:

~~~~bash
#!/bin/bash
# Double-click this file in Finder to play Reactor.
# It installs dependencies on first run, builds the game when needed,
# and opens it in your default browser. Close this window to stop it.
cd "$(dirname "$0")" || exit 1

# Finder starts scripts with a minimal PATH; add the usual Node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Reactor needs Node.js (version 20.19 or newer)."
  echo "Install it from https://nodejs.org  — or with Homebrew:  brew install node"
  open "https://nodejs.org/en/download" 2>/dev/null
  read -r -p "Press Return to close."
  exit 1
fi

exec node tools/launch.mjs "$@"
~~~~

Windows (must have **CRLF** line endings, which `.gitattributes` enforces):

~~~~bat
@echo off
rem Double-click this file in File Explorer to play Reactor.
rem It installs dependencies on first run, builds the game when needed,
rem and opens it in your default browser. Close this window to stop it.
setlocal
cd /d "%~dp0"
title Reactor Quest

where node >nul 2>nul && goto run
rem Not on PATH yet (a fresh install needs a new window): try the usual places.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PATH=%NVM_SYMLINK%;%PATH%"
where node >nul 2>nul && goto run

echo Reactor needs Node.js (version 20.19 or newer).
echo Install it from https://nodejs.org  - or in a terminal:  winget install OpenJS.NodeJS.LTS
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:run
node tools\launch.mjs %*
if errorlevel 1 pause
~~~~

Linux (`chmod +x`):

~~~~bash
#!/usr/bin/env bash
# Play Reactor on Linux: run ./reactor-quest.sh (or, in your file manager,
# right-click it → "Run as a Program"). It installs dependencies on first run,
# builds the game when needed, and opens it in your default browser.
# Press Ctrl+C (or close the terminal) to stop it.
cd "$(dirname "$0")" || exit 1

# Desktop launchers start scripts with a minimal PATH; add the usual Node locations.
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/snap/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Reactor needs Node.js (version 20.19 or newer)."
  echo "Get it from https://nodejs.org/en/download, or for example:"
  echo "  sudo snap install node --classic        (Ubuntu and friends)"
  echo "  sudo dnf install nodejs                 (Fedora)"
  echo "  sudo pacman -S nodejs npm               (Arch)"
  (xdg-open "https://nodejs.org/en/download" >/dev/null 2>&1 &)
  [ -t 0 ] && read -r -p "Press Return to close."
  exit 1
fi

exec node tools/launch.mjs "$@"
~~~~

**Check:** `npm run build && npm start` opens the game. Double-clicking the launcher for your OS does the same.

---

## Part 12. Native packages for macOS, Windows and Linux

Each packager builds the game (unless given `--skip-build`), copies `dist/` to `app/` and `server.mjs` beside it, and adds a launcher and the icon. Node.js must be installed on the player's machine; every launcher detects a missing Node and says how to install it, with a native dialog where possible.

**`tools/packaging.mjs`**

~~~~js
// Shared by the app packagers (make-mac-app, make-win-app, make-linux-app):
// build the game unless told not to, then copy the build and the zero-dependency
// server into a package folder.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** The output folder: the first non-flag argument, or `fallback` inside the project. */
export const outDir = (fallback) => process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(root, fallback);

export function ensureBuild() {
  if (!process.argv.includes('--skip-build')) {
    // npm is a .cmd on Windows, which Node only runs through a shell.
    const win = process.platform === 'win32';
    const r = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'build', '--silent'], { cwd: root, stdio: 'inherit', shell: win });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    console.error('No build found in dist/. Run `npm run build` first.');
    process.exit(1);
  }
}

/** Start `dir` afresh and put the game (app/) and its server (server.mjs) in it. */
export function stageApp(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(root, 'dist'), join(dir, 'app'), { recursive: true });
  cpSync(join(root, 'tools', 'server.mjs'), join(dir, 'server.mjs'));
}

/** Windows scripts want CRLF line endings. */
export const crlf = (text) => text.replace(/\r?\n/g, '\r\n');
~~~~

### The icon, drawn in code

A reactor core (three orbit rings and a glowing nucleus) on a dark rounded-square tile, rendered pixel by pixel with 3×3 supersampling. It is encoded as PNG with only `node:zlib`, then wrapped as a macOS `.icns` (256/512/1024) and a Windows `.ico` (16–256 px PNG entries). Linux uses the 256 px PNG.

**`tools/icon.mjs`**

~~~~js
// Draws the app icon in code — a reactor core on a dark tile — and encodes it
// as PNG, a macOS .icns and a Windows .ico, with nothing but node:zlib.
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Signed distance-ish coverage of the icon at (u, v) in [-1, 1]². Returns [r, g, b, a] in 0–1. */
function shade(u, v) {
  const over = (dst, src) => {
    const a = src[3] + dst[3] * (1 - src[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (src[i] * src[3] + dst[i] * dst[3] * (1 - src[3])) / a).concat(a);
  };
  // Rounded-square tile (macOS icon grid: ~80% of the canvas).
  const s = 0.8, r = 0.36;
  const qx = Math.abs(u) - (s - r), qy = Math.abs(v) - (s - r);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  if (d > 0) return [0, 0, 0, 0];
  const t = (v + 1) / 2;
  let px = [0.03 + 0.03 * t, 0.05 + 0.04 * t, 0.1 + 0.07 * t, 1];
  // Glow behind the core.
  const rr = Math.hypot(u, v);
  px = over(px, [1, 0.7, 0.28, Math.max(0, 0.55 - rr * 1.1)]);
  // Three orbit rings: ellipses rotated 0°, 60°, 120°.
  for (const deg of [0, 60, 120]) {
    const a = (deg * Math.PI) / 180;
    const x = u * Math.cos(a) + v * Math.sin(a);
    const y = -u * Math.sin(a) + v * Math.cos(a);
    const e = Math.hypot(x / 0.6, y / 0.22) - 1; // 0 on the ellipse
    const line = Math.max(0, 1 - Math.abs(e) / 0.06);
    px = over(px, [0.31, 0.82, 1, Math.min(1, line * 1.4)]);
  }
  // Nucleus.
  const n = Math.max(0, 1 - rr / 0.16);
  px = over(px, [1, 0.95, 0.85, Math.min(1, n * 2.2)]);
  px = over(px, [1, 0.7, 0.28, Math.min(1, Math.max(0, 1 - rr / 0.13) * 1.6) * 0.6]);
  return px;
}

export function drawIcon(size) {
  const out = Buffer.alloc(size * size * 4);
  const ss = 3; // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const u = ((x + (i + 0.5) / ss) / size) * 2 - 1;
          const v = ((y + (j + 0.5) / ss) / size) * 2 - 1;
          const p = shade(u, v);
          acc = [acc[0] + p[0] * p[3], acc[1] + p[1] * p[3], acc[2] + p[2] * p[3], acc[3] + p[3]];
        }
      }
      const a = acc[3] / (ss * ss);
      const o = (y * size + x) * 4;
      out[o] = a ? Math.round((acc[0] / acc[3]) * 255) : 0;
      out[o + 1] = a ? Math.round((acc[1] / acc[3]) * 255) : 0;
      out[o + 2] = a ? Math.round((acc[2] / acc[3]) * 255) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, out);
}

/** An .icns holding PNG renditions — macOS reads 'ic08' (256), 'ic09' (512), 'ic10' (1024). */
export function makeIcns() {
  const parts = [['ic08', 256], ['ic09', 512], ['ic10', 1024]].map(([type, size]) => {
    const png = drawIcon(size);
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

/** A Windows .ico holding PNG renditions (16–256 px), which Windows Vista and later read directly. */
export function makeIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => drawIcon(s));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // 1 = icon
  head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; // 0 means 256
    e[1] = s === 256 ? 0 : s;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...pngs]);
}
~~~~

### macOS: `npm run app:mac` → `Reactor Quest.app`

A real app bundle: `Info.plist` (with `LSUIElement` so no Dock icon lingers), the icon, and a launcher script that finds Node and runs the bundled server with `--app`, logging to `~/Library/Logs/reactor-quest.log`.

**`tools/make-mac-app.mjs`**

~~~~js
// `npm run app:mac`: package the built game as "Reactor Quest.app" — a real
// macOS app bundle you can drag to /Applications and launch from Launchpad or
// the Dock. It carries its own copy of the game and a tiny server; opening it
// starts the server and the game opens in your default browser. The server
// stops by itself about a minute after you close the game's tab.
// (Node.js must be installed; the app tells you if it isn't.)
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeIcns } from './icon.mjs';
import { ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('Reactor Quest.app');
ensureBuild();

rmSync(out, { recursive: true, force: true });
const contents = join(out, 'Contents');
const macos = join(contents, 'MacOS');
const resources = join(contents, 'Resources');
mkdirSync(macos, { recursive: true });
stageApp(resources);
writeFileSync(join(resources, 'AppIcon.icns'), makeIcns());

writeFileSync(
  join(contents, 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Reactor Quest</string>
  <key>CFBundleDisplayName</key><string>Reactor Quest</string>
  <key>CFBundleIdentifier</key><string>dev.completed-projects.reactor-quest</string>
  <key>CFBundleVersion</key><string>${pkg.version}</string>
  <key>CFBundleShortVersionString</key><string>${pkg.version}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>reactor-quest</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`,
);

const launcher = join(macos, 'reactor-quest');
writeFileSync(
  launcher,
  `#!/bin/bash
# Reactor Quest launcher: find Node.js, start the bundled server, open the browser.
HERE="$(cd "$(dirname "$0")/../Resources" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Reactor Quest needs Node.js to run. Install it from nodejs.org (or with Homebrew: brew install node), then open Reactor Quest again." with title "Reactor Quest" buttons {"Get Node.js", "OK"} default button "Get Node.js"' -e 'if button returned of result is "Get Node.js" then open location "https://nodejs.org/en/download"' >/dev/null 2>&1
  exit 1
fi
exec node "$HERE/server.mjs" "$HERE/app" --app >>"$HOME/Library/Logs/reactor-quest.log" 2>&1
`,
);
chmodSync(launcher, 0o755);
console.log(`Built ${out}\nDouble-click it, or drag it to /Applications.`);
~~~~

### Windows: `npm run app:win` → `Reactor Quest (Windows)/`

A folder to zip and copy anywhere. `Reactor Quest.cmd` plays with no install. `Install.cmd` copies the game to `%LOCALAPPDATA%\Programs\Reactor Quest` (no admin rights) and adds Start menu and desktop shortcuts. `Uninstall.cmd` removes both. PowerShell does the work: it finds Node, shows a message box if it's missing, starts the server with no console window, and creates the shortcuts.

**`tools/make-win-app.mjs`**

~~~~js
// `npm run app:win`: package the built game for Windows as a folder you can
// zip up, copy anywhere and double-click:
//
//   Reactor Quest (Windows)/
//     Reactor Quest.cmd   double-click to play (no install needed)
//     Install.cmd         adds Reactor Quest to the Start menu and the desktop
//     Uninstall.cmd       removes it again
//     launch.ps1 install.ps1 uninstall.ps1 reactor-quest.ico server.mjs app/
//
// Playing starts the bundled server with no console window and opens the game
// in your default browser; the server stops by itself about a minute after you
// close the game's tab. Node.js must be installed; the launcher says so if not.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeIco } from './icon.mjs';
import { crlf, ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('Reactor Quest (Windows)');
ensureBuild();
stageApp(out);
writeFileSync(join(out, 'reactor-quest.ico'), makeIco());

const write = (name, text) => writeFileSync(join(out, name), crlf(text));

// PowerShell does the real work: it can find Node.js, show a friendly dialog,
// start a process without a console window, and make shortcuts.
write(
  'launch.ps1',
  `# Reactor Quest ${pkg.version}: find Node.js, start the game's server with no
# console window, and open the game in the default browser.
# Extra arguments (for example --no-open) are passed to the server.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\\nodejs\\node.exe",
    "$env:LOCALAPPDATA\\Programs\\nodejs\\node.exe",
    "$env:NVM_SYMLINK\\node.exe",
    "$env:LOCALAPPDATA\\Volta\\bin\\node.exe",
    "$env:ProgramFiles\\Volta\\node.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

$node = Find-Node
if (-not $node) {
  Add-Type -AssemblyName PresentationFramework
  $answer = [System.Windows.MessageBox]::Show(
    "Reactor Quest needs Node.js (version 20.19 or newer) to run.\`n\`nInstall it from nodejs.org, or in a terminal run:\`n    winget install OpenJS.NodeJS.LTS\`n\`nOpen the Node.js download page now?",
    'Reactor Quest', 'YesNo', 'Information')
  if ($answer -eq 'Yes') { Start-Process 'https://nodejs.org/en/download' }
  exit 1
}

$log = Join-Path $env:LOCALAPPDATA 'Reactor Quest\\reactor-quest.log'
$serverArgs = @("\`"$here\\server.mjs\`"", "\`"$here\\app\`"", '--app', '--log', "\`"$log\`"") + $args
Start-Process -FilePath $node -ArgumentList $serverArgs -WorkingDirectory $here -WindowStyle Hidden
`,
);

write(
  'install.ps1',
  `# Install Reactor Quest for this Windows user: copy it to
# %LOCALAPPDATA%\\Programs\\Reactor Quest and add Start menu + desktop shortcuts.
# No administrator rights needed.
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:LOCALAPPDATA 'Programs\\Reactor Quest'

if ((Resolve-Path $src).Path -ne $dest) {
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Recurse -Force -Path (Join-Path $src '*') -Destination $dest
}
# Files from a downloaded zip are marked as "from the internet"; the copies are ours now.
Get-ChildItem -Recurse -File $dest | Unblock-File

$powershell = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Reactor Quest.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk')
)
foreach ($path in $links) {
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $powershell
  $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$dest\\launch.ps1\`""
  $link.WorkingDirectory = $dest
  $link.IconLocation = "$dest\\reactor-quest.ico,0"
  $link.WindowStyle = 7
  $link.Description = 'Reactor Quest: learn TypeScript and React by playing'
  $link.Save()
}
Write-Host ''
Write-Host "Reactor Quest is installed in $dest"
Write-Host 'Start it from the Start menu or the desktop shortcut.'
`,
);

write(
  'uninstall.ps1',
  `# Remove Reactor Quest's shortcuts and installed copy. Your progress lives in
# your browser, so it stays.
$ErrorActionPreference = 'SilentlyContinue'
$dest = Join-Path $env:LOCALAPPDATA 'Programs\\Reactor Quest'
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Reactor Quest.lnk')
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk')
Set-Location $env:TEMP
Remove-Item -Recurse -Force $dest
Write-Host 'Reactor Quest has been removed.'
`,
);

const runPs = (script, { hidden = false, pause = false } = {}) => `@echo off
powershell -NoProfile -ExecutionPolicy Bypass${hidden ? ' -WindowStyle Hidden' : ''} -File "%~dp0${script}" %*${pause ? '\r\npause' : ''}
`;
write('Reactor Quest.cmd', `@rem Double-click to play Reactor Quest.\n${runPs('launch.ps1', { hidden: true })}`);
write('Install.cmd', `@rem Double-click to add Reactor Quest to the Start menu and the desktop.\n${runPs('install.ps1', { pause: true })}`);
write('Uninstall.cmd', `@rem Double-click to remove Reactor Quest's shortcuts and installed copy.\n${runPs('uninstall.ps1', { pause: true })}`);
write(
  'README.txt',
  `Reactor Quest ${pkg.version} for Windows

Needs Node.js 20.19 or newer: https://nodejs.org (or: winget install OpenJS.NodeJS.LTS)

  Reactor Quest.cmd   Double-click to play. The game opens in your browser.
  Install.cmd         Adds Reactor Quest to the Start menu and the desktop.
  Uninstall.cmd       Removes it again.

If Windows says "Windows protected your PC", click "More info", then "Run anyway".
Logs: %LOCALAPPDATA%\\Reactor Quest\\reactor-quest.log
`,
);
console.log(`Built ${out}\nZip it, copy it anywhere, and double-click "Reactor Quest.cmd" (or "Install.cmd").`);
~~~~

### Linux: `npm run app:linux` → `reactor-quest-linux/`

`./reactor-quest` plays. It falls back to zenity, kdialog or notify-send to report a missing Node. `./install.sh` installs to `~/.local/share/reactor-quest`, adds a validated `.desktop` entry and icon, and symlinks `~/.local/bin/reactor-quest`, all without sudo. `./uninstall.sh` removes it all.

**`tools/make-linux-app.mjs`**

~~~~js
// `npm run app:linux`: package the built game for Linux as a folder you can
// tar up and copy anywhere:
//
//   reactor-quest-linux/
//     reactor-quest       run it to play (no install needed)
//     install.sh          adds Reactor Quest to your app menu (no sudo)
//     uninstall.sh        removes it again
//     reactor-quest.png server.mjs app/
//
// Playing starts the bundled server in the background and opens the game in
// your default browser; the server stops by itself about a minute after you
// close the game's tab. Node.js must be installed; the launcher says so if not.
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawIcon } from './icon.mjs';
import { ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('reactor-quest-linux');
ensureBuild();
stageApp(out);
writeFileSync(join(out, 'reactor-quest.png'), drawIcon(256));

const script = (name, text) => {
  writeFileSync(join(out, name), text);
  chmodSync(join(out, name), 0o755);
};

script(
  'reactor-quest',
  `#!/usr/bin/env bash
# Reactor Quest ${pkg.version}: find Node.js, start the game's server in the
# background, and open the game in the default browser.
# Extra arguments (for example --no-open) are passed to the server.
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
export PATH="$HOME/.local/bin:$HOME/.volta/bin:/usr/local/bin:/snap/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  MSG="Reactor Quest needs Node.js (version 20.19 or newer).
Get it from https://nodejs.org/en/download
or, for example:  sudo snap install node --classic"
  if [ -t 1 ]; then
    echo "$MSG"
  elif command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Reactor Quest" --text="$MSG" 2>/dev/null
  elif command -v kdialog >/dev/null 2>&1; then
    kdialog --title "Reactor Quest" --error "$MSG" 2>/dev/null
  elif command -v notify-send >/dev/null 2>&1; then
    notify-send "Reactor Quest" "$MSG"
  fi
  (xdg-open "https://nodejs.org/en/download" >/dev/null 2>&1 &)
  exit 1
fi

LOG="\${XDG_STATE_HOME:-$HOME/.local/state}/reactor-quest/reactor-quest.log"
nohup node "$HERE/server.mjs" "$HERE/app" --app --log "$LOG" "$@" >/dev/null 2>&1 &
`,
);

script(
  'install.sh',
  `#!/usr/bin/env bash
# Install Reactor Quest for this user: copy it to ~/.local/share/reactor-quest,
# add it to your desktop's app menu, and put \`reactor-quest\` on your PATH.
# No sudo needed.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DATA="\${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/reactor-quest"

if [ "$SRC" != "$DEST" ]; then
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -R "$SRC/." "$DEST/"
fi

mkdir -p "$DATA/icons/hicolor/256x256/apps" "$DATA/applications" "$HOME/.local/bin"
cp "$DEST/reactor-quest.png" "$DATA/icons/hicolor/256x256/apps/reactor-quest.png"
ln -sf "$DEST/reactor-quest" "$HOME/.local/bin/reactor-quest"
cat > "$DATA/applications/reactor-quest.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Reactor Quest
GenericName=Coding game
Comment=Learn TypeScript and React by playing
Exec="$DEST/reactor-quest"
Icon=reactor-quest
Terminal=false
Categories=Education;ComputerScience;
Keywords=typescript;react;programming;learn;game;
StartupNotify=false
DESKTOP
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true

echo "Reactor Quest is installed in $DEST"
echo "Start it from your app menu, or run: reactor-quest"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "(Add ~/.local/bin to your PATH to use the reactor-quest command.)" ;; esac
`,
);

script(
  'uninstall.sh',
  `#!/usr/bin/env bash
# Remove Reactor Quest's menu entry, command and installed copy. Your progress
# lives in your browser, so it stays.
DATA="\${XDG_DATA_HOME:-$HOME/.local/share}"
rm -f "$DATA/applications/reactor-quest.desktop" "$DATA/icons/hicolor/256x256/apps/reactor-quest.png" "$HOME/.local/bin/reactor-quest"
rm -rf "$DATA/reactor-quest"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
echo "Reactor Quest has been removed."
`,
);

writeFileSync(
  join(out, 'README.txt'),
  `Reactor Quest ${pkg.version} for Linux

Needs Node.js 20.19 or newer: https://nodejs.org/en/download
(Ubuntu: sudo snap install node --classic · Fedora: sudo dnf install nodejs · Arch: sudo pacman -S nodejs npm)

  ./reactor-quest     Play. The game opens in your browser.
  ./install.sh        Adds Reactor Quest to your app menu and ~/.local/bin (no sudo).
  ./uninstall.sh      Removes it again.

Logs: ~/.local/state/reactor-quest/reactor-quest.log
`,
);
console.log(`Built ${out}\nRun ./reactor-quest to play, or ./install.sh to add it to your app menu.`);
~~~~

---

## Part 13. Tests

`npm test` runs Vitest in jsdom: 443 tests in 9 files. The level proofs are the most important, because they are what lets you write 86 code levels with confidence.

| File | What it proves |
|---|---|
| `tests/levels.test.ts` | Level ids are unique. For **every code level**: the solution passes everything, the starter does not, and there are exactly 3 hints and ≥1 check. For every quiz: answers are valid and options distinct. |
| `tests/review.test.ts` | Every compile card's `ok` matches the real compiler, between ¼ and ¾ of cards compile, and no card unlocks before the TypeScript floors. Review ids are unique, every item unlocks from a real level, every answer is an option, and every floor contributes cards. |
| `tests/explain.test.ts` | For 18 common beginner mistakes, the real compiler's error gets the right plain-English explanation; unknown codes get none. |
| `tests/themes.test.ts` | 1 default + 16 profiles, with unique ids and names, and every value a `#rrggbb` colour. No two look alike (summed RGB distance of bg, panel, accent, keyword and string > 150). Every profile is **readable**: text ≥ 5.5:1 and muted ≥ 3.8:1 on every surface, accent/gold/green/red ≥ 3.4:1 on panels, button text ≥ 4.5:1, syntax ≥ 3.8:1 (comments ≥ 3:1), and `scheme` matches the background's luminance. |
| `tests/checker.test.ts` | `quickInfo` shows inferred types and React hook docs, and nothing on whitespace. `completions` offers members after a dot, locals and React exports in scope, and the props of a typed component inside JSX. |
| `tests/runtime.test.ts` | Matchers pass and fail with good messages. `deepEqual` ignores undefined-valued keys. The sandbox captures console output and counts timers (one-shot timeouts stop counting once fired). Only `react` can be required. The stage renders, clicks and reads updates. Handler errors, would-be page reloads and render errors fail the check. The loop guard stops `while (true)` and leaves normal loops alone. |
| `tests/progress.test.ts` | Star rules. The first clear is the first level-up. The curve gets steadily (not wildly) harder. Perfect play reaches Reactor Architect, and every floor gives a level-up at least every three clears. Unlocking order and boss skip. Station power hits 100%. Garbage saves fall back to defaults, fields are validated one by one, saves round-trip, and v1 saves migrate. |
| `tests/rewards.test.ts` | With a seeded RNG: clearing pays XP, gold, viewers, skill points and a box; same-star replays pay nothing; improvements pay the difference. Boss boxes guarantee the floor scroll. Floor clears bring a sponsor and a platinum box. Pet and class offers appear at the right time. Spaced review: cards join the deck the day after their level, remembering pushes them out and forgetting brings them back tomorrow, reviewing pays more for remembering, a clean session counts, and the review quest waits for a deck. The notebook pays XP once per level for a real explanation and deletes on empty. Replaying for more stars earns Second Wind. Class and boost bonuses apply. The station clear gives a celestial box. Perfect play takes every skill past level 1. Better boxes are better on average. Legendary and celestial guarantees hold. Duplicates are salvaged. Floor scrolls never drop at random. Viewer milestones and Crowd Favourite upgrades work. Achievements are awarded once each, with titles. Persistence counts. Tokens and stars work. Quests are deterministic per day, count from the day's start and pay once. Streaks grow and reset. Shop purchases, one-time cosmetics and the class change fee work. |
| `tests/markdown.test.tsx` | Inline spans render, tables honour escaped pipes, HTML in the source stays text, and **every lesson, brief and hint in the game renders without leftover `**`, backticks or `*` markers**. |

These three are worth copying exactly:

**`tests/levels.test.ts`**

~~~~ts
// Every level is proven playable: the reference solution compiles cleanly,
// satisfies every type check and passes every behaviour check — and the
// starter code does NOT, so there is always something to do.
import { describe, expect, test } from 'vitest';
import { ALL_LEVELS } from '../src/content';
import { Checker } from '../src/engine/checker';
import { grade, type Report } from '../src/engine/grade';
import type { CodeLevel } from '../src/game/types';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);
const compile = async (files: Record<string, string>) => checker.check(files);

const failures = (r: Report) => [
  ...r.typeErrors.map((d) => `type error L${d.line}: ${d.message}`),
  ...r.typeChecks.filter((c) => !c.pass).map((c) => `type check "${c.label}": ${c.message}`),
  ...r.checks.filter((c) => !c.pass).map((c) => `check "${c.label}": ${c.message}`),
  ...(r.loadError ? [`load: ${r.loadError}`] : []),
];

const codeLevels = ALL_LEVELS.filter((l): l is CodeLevel => l.kind === 'code');

test('level ids are unique', () => {
  const ids = ALL_LEVELS.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe.each(codeLevels.map((l) => [l.id, l] as const))('%s', (_id, level) => {
  test('solution passes everything', async () => {
    const report = await grade(level, level.solution, compile);
    expect(failures(report)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  test('starter does not pass', async () => {
    const report = await grade(level, level.starter, compile);
    expect(report.passed).toBe(false);
  });

  test('has three hints and at least one check', () => {
    expect(level.hints).toHaveLength(3);
    expect(level.checks.length).toBeGreaterThan(0);
  });
});

describe.each(ALL_LEVELS.filter((l) => l.kind === 'quiz').map((l) => [l.id, l] as const))('%s', (_id, level) => {
  test('every answer is a valid option', () => {
    if (level.kind !== 'quiz') return;
    for (const q of level.questions) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
~~~~

**`tests/review.test.ts`**

~~~~ts
// Every review card's verdict is checked against the real compiler, and every
// review question is tied to a real level that comes before or with its topic.
import { describe, expect, test } from 'vitest';
import { ALL_LEVELS, DECKS } from '../src/content';
import { COMPILE_CARDS, REVIEW_ITEMS } from '../src/content/review';
import { Checker } from '../src/engine/checker';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);

describe('compile cards', () => {
  test.each(COMPILE_CARDS.map((c, i) => [i + 1, c] as const))('card %i', (_i, card) => {
    const { diagnostics } = checker.check({ '/card.tsx': `${card.code}\nexport {};\n` });
    expect({ compiles: diagnostics.length === 0, errors: diagnostics.map((d) => d.message) }).toMatchObject({ compiles: card.ok });
  });

  test('a healthy mix of yes and no', () => {
    const yes = COMPILE_CARDS.filter((c) => c.ok).length;
    expect(yes).toBeGreaterThan(COMPILE_CARDS.length / 4);
    expect(yes).toBeLessThan((COMPILE_CARDS.length * 3) / 4);
  });

  test('no card unlocks before the TypeScript floors', () => {
    const firstTypeScriptLevel = ALL_LEVELS.findIndex((l) => l.id === 'power-bus');
    for (const c of COMPILE_CARDS) expect(ALL_LEVELS.findIndex((l) => l.id === c.after), c.after).toBeGreaterThanOrEqual(firstTypeScriptLevel);
  });
});

describe('review items', () => {
  test('ids are unique and every item unlocks from a real level', () => {
    expect(new Set(REVIEW_ITEMS.map((r) => r.id)).size).toBe(REVIEW_ITEMS.length);
    const ids = new Set(ALL_LEVELS.map((l) => l.id));
    for (const r of REVIEW_ITEMS) expect(ids.has(r.after), r.id).toBe(true);
  });

  test('every answer is one of the options', () => {
    for (const r of REVIEW_ITEMS) {
      expect(r.answer).toBeGreaterThanOrEqual(0);
      expect(r.answer).toBeLessThan(r.options.length);
    }
  });

  test('every floor contributes something to review', () => {
    for (const deck of DECKS) expect(REVIEW_ITEMS.some((r) => deck.levels.some((l) => l.id === r.after)), deck.name).toBe(true);
  });
});
~~~~

**`tests/themes.test.ts`**

~~~~ts
import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME, THEMES, themeVars, type Theme } from '../src/ui/themes';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

const profiles = THEMES.filter((t) => t.id !== DEFAULT_THEME);

describe('colour profiles', () => {
  test('sixteen profiles, plus the original Reactor look as the default', () => {
    expect(THEMES[0].id).toBe(DEFAULT_THEME);
    expect(profiles).toHaveLength(16);
    expect(profiles.every((t) => t.from !== 'Reactor')).toBe(true);
  });

  test('ids and names are unique', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(THEMES.length);
  });

  test('every value is a #rrggbb colour', () => {
    for (const t of THEMES) for (const [k, v] of Object.entries(themeVars(t))) expect(v, `${t.id} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('no two profiles look alike', () => {
    // A profile's look is its page, its panels, its signature colour and its keywords.
    const look = (t: Theme) => [t.palette.bg, t.palette.panel, t.palette.accent, t.palette.syntax.keyword, t.palette.syntax.string];
    for (const a of THEMES)
      for (const b of THEMES) {
        if (a.id >= b.id) continue;
        const d = look(a).reduce((n, c, i) => n + distance(c, look(b)[i]), 0);
        expect(d, `${a.name} vs ${b.name}`).toBeGreaterThan(150);
      }
  });

  test.each(THEMES.map((t) => [t.name, t] as const))('%s is readable', (_, t) => {
    const p = t.palette;
    for (const surface of [p.bg, p.panel, p.panel2, p.bg2]) {
      expect(contrast(p.text, surface), `text on ${surface}`).toBeGreaterThanOrEqual(5.5);
      expect(contrast(p.muted, surface), `muted on ${surface}`).toBeGreaterThanOrEqual(3.8);
    }
    for (const c of [p.accent, p.gold, p.green, p.red]) expect(contrast(c, p.panel), `${c} on panel`).toBeGreaterThanOrEqual(3.4);
    expect(contrast(p.onAccent, p.accent), 'button text').toBeGreaterThanOrEqual(4.5);
    for (const [k, c] of Object.entries(p.syntax)) {
      expect(contrast(c, p.editor), `syntax ${k}`).toBeGreaterThanOrEqual(k === 'comment' ? 3 : 3.8);
    }
    expect(t.scheme === 'light').toBe(luminance(p.bg) > 0.5);
  });
});
~~~~

`tests/progress.test.ts` exports a seeded RNG and a "perfect" outcome, and `tests/rewards.test.ts` imports both, so loot and commentary are repeatable:

~~~~ts
/** A deterministic random number generator, so loot and commentary are repeatable. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const perfect: Outcome = { stars: 3, firstTry: true, failedRuns: 0, clean: true, perfect: true, seconds: 60, hour: 12 };
~~~~

---

## Part 14. The browser bot

`npm run smoke` (`tools/smoke.mjs`) builds nothing itself; run `npm run build` first. It serves `dist/` with `startServer` on port 4390, launches headless Chromium with `playwright-core` (it uses `CHROMIUM_PATH` if set, else Playwright's own Chromium, else installed Chrome), and plays the game through the real UI at 1440×900. It prints ✓/✗ per step, saves screenshots to `test-results/`, and exits non-zero on any failure. `SMOKE_PLATFORM=mac` makes it use ⌘ shortcuts. `SMOKE_LEVELS=a,b` limits which levels it plays. There are 107 steps:

1. The title screen renders.
2. **Begin** asks for a name (fill **Your name**, click **Go live**), then opens Floor 1 level 1, whose starter prints nothing when run.
3. Two failed runs bring up the lesson nudge, a compiler error shows its plain-English line, and the nudge opens the lesson.
4. The first hint is free (no token is offered for it), and a hint token pays for the second. The solution waits until all three hints are seen, can't be pasted in, and caps the win at one star.
5. Explaining the level back saves a note to the notebook.
6. Opening the loot boxes from the victory screen works.
7. **Next system →** goes to level 2, which is solved *by typing* (keyboard), earning three stars and First Try.
8. The map shows progress, daily quests (one claimable), floors and the next level.
9. Locked levels stay locked, and a floor's boss is open from the start.
10. Character → Settings → **Download a backup** produces a file holding the progress; after the save is wiped, **Restore from a backup…** brings it back. Then "Open every system" works.
11. Hovering a name shows its type, and typing a dot offers members.
12. **For every code level** (86 steps): open it, put the solution in the editor (select all + insert text), Run with the keyboard shortcut, and see the victory screen.
13. The companion and the class are offered, and chosen.
14. Loot: a boss box guarantees a Codex scroll, which can be read.
15. The Safe Room sells things.
16. A quiz plays through to victory, and a missed question comes back until it's right.
17. Review: cleared quizzes become review cards (the bot moves their due date to today), a missed card returns within the session, the session completes, and the notebook lists the note from step 5.
18. Colour profiles: 🎨 previews on hover, Escape reverts, a click keeps it, and the choice survives a reload.
19. A narrow (420 px) layout renders without horizontal scroll.
20. The launcher server answers its probe and heartbeat, and a second server on the same busy port refuses to start instead of moving.
21. There were no uncaught page errors during the whole run.

Helpers worth having: `setEditor(text)` (focus `.cm-content`, select all, `insertText`), `waitCompiler()` (wait until "Loading compiler…" is gone), `dismissModals()`, and `clearNotes()` (close announcer cards so they don't cover buttons).

---

## Part 15. Continuous integration

One GitHub Actions workflow runs on macOS, Windows and Linux. On each OS it installs, typechecks, builds, runs every test, and runs the browser bot (twice on macOS: once with ⌘ shortcuts). It then builds that OS's package, **installs it, launches it exactly as a user would, checks that the server serves the game, and uninstalls it**, and uploads the zipped package and the screenshots as artifacts. (In the original monorepo the project lives in a `reactor-quest/` subfolder, hence `working-directory`.)

**`.github/workflows/reactor-quest.yml`**

~~~~yaml
name: Reactor Quest (macOS, Windows, Linux)

on:
  push:
    branches: ['**']
    paths:
      - 'reactor-quest/**'
      - '.github/workflows/reactor-quest.yml'
  pull_request:
    paths:
      - 'reactor-quest/**'
      - '.github/workflows/reactor-quest.yml'

defaults:
  run:
    shell: bash
    working-directory: reactor-quest

jobs:
  build:
    name: ${{ matrix.label }} — typecheck, level proofs, browser bot, app package
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            label: macOS
          - os: windows-latest
            label: Windows
          - os: ubuntu-latest
            label: Linux
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: reactor-quest/package-lock.json
      - run: npm ci
      - name: Typecheck and build
        run: npm run build
      - name: Every level, quiz, review card and colour profile proven
        run: npm test
      - name: Headless Chrome plays every level through the UI
        run: npm run smoke
      - name: Headless Chrome plays it again as a Mac (⌘ shortcuts)
        if: runner.os == 'macOS'
        run: SMOKE_PLATFORM=mac npm run smoke

      # ---------------------------------------------------------------- macOS
      - name: Package Reactor Quest.app
        if: runner.os == 'macOS'
        run: npm run app:mac -- --skip-build
      - name: The .app's bundled server serves the game
        if: runner.os == 'macOS'
        run: |
          node "Reactor Quest.app/Contents/Resources/server.mjs" "Reactor Quest.app/Contents/Resources/app" --no-open --port 4500 &
          for i in $(seq 1 20); do curl -fs http://127.0.0.1:4500/__reactor && break; sleep 0.5; done
          curl -fs http://127.0.0.1:4500/ | grep -q '<div id="root">'
          plutil -lint "Reactor Quest.app/Contents/Info.plist"
      - name: Zip the .app
        if: runner.os == 'macOS'
        run: ditto -c -k --sequesterRsrc --keepParent "Reactor Quest.app" reactor-quest-macos.zip

      # -------------------------------------------------------------- Windows
      - name: Reactor Quest.cmd starts the game from the source folder
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          Start-Process cmd -ArgumentList '/c', '"Reactor Quest.cmd" --no-open' -WindowStyle Hidden
          $ok = $false
          for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
            try { $ok = "$((Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4310/__reactor).Content)" -eq 'reactor-quest' } catch {}
            if (-not $ok) { Start-Sleep -Milliseconds 500 }
          }
          if (-not $ok) { throw 'Reactor Quest.cmd did not start the server' }
          Get-Process node | Stop-Process -Force
      - name: Package for Windows
        if: runner.os == 'Windows'
        run: npm run app:win -- --skip-build
      - name: Install, launch, serve and uninstall the Windows package
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          $pkg = Resolve-Path 'Reactor Quest (Windows)'
          powershell -NoProfile -ExecutionPolicy Bypass -File "$pkg\install.ps1"
          if ($LASTEXITCODE) { throw 'install failed' }
          $dest = Join-Path $env:LOCALAPPDATA 'Programs\Reactor Quest'
          foreach ($lnk in @((Join-Path ([Environment]::GetFolderPath('Programs')) 'Reactor Quest.lnk'), (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk'))) {
            if (-not (Test-Path $lnk)) { throw "missing shortcut $lnk" }
            $target = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
            if ($target.Arguments -notlike "*$dest\launch.ps1*") { throw "shortcut points elsewhere: $($target.Arguments)" }
          }
          # Launch exactly as the shortcut does, minus the browser.
          powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$dest\launch.ps1" --no-open --port 4500
          $ok = $false
          for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
            try { $ok = "$((Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4500/__reactor).Content)" -eq 'reactor-quest' } catch {}
            if (-not $ok) { Start-Sleep -Milliseconds 500 }
          }
          if (-not $ok) { Get-Content "$env:LOCALAPPDATA\Reactor Quest\reactor-quest.log" -ErrorAction SilentlyContinue; throw 'the installed launcher did not start the server' }
          if ((Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4500/).Content -notmatch '<div id="root">') { throw 'the game page is wrong' }
          Get-Content "$env:LOCALAPPDATA\Reactor Quest\reactor-quest.log"
          Get-Process node | Stop-Process -Force
          powershell -NoProfile -ExecutionPolicy Bypass -File "$dest\uninstall.ps1"
          if (Test-Path $dest) { throw 'uninstall left files behind' }
          if (Test-Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk')) { throw 'uninstall left the shortcut' }
      - name: Zip the Windows package
        if: runner.os == 'Windows'
        shell: pwsh
        run: Compress-Archive -Path 'Reactor Quest (Windows)' -DestinationPath reactor-quest-windows.zip

      # ---------------------------------------------------------------- Linux
      - name: reactor-quest.sh starts the game from the source folder
        if: runner.os == 'Linux'
        run: |
          ./reactor-quest.sh --no-open &
          for i in $(seq 1 60); do curl -fs http://127.0.0.1:4310/__reactor && break; sleep 0.5; done
          curl -fs http://127.0.0.1:4310/ | grep -q '<div id="root">'
          kill %1
      - name: Package for Linux
        if: runner.os == 'Linux'
        run: npm run app:linux -- --skip-build
      - name: Install, launch, serve and uninstall the Linux package
        if: runner.os == 'Linux'
        run: |
          sudo apt-get install -y -qq desktop-file-utils >/dev/null
          export HOME="$RUNNER_TEMP/home" && mkdir -p "$HOME"
          ./reactor-quest-linux/install.sh
          desktop-file-validate "$HOME/.local/share/applications/reactor-quest.desktop"
          "$HOME/.local/bin/reactor-quest" --no-open --port 4500
          for i in $(seq 1 40); do curl -fs http://127.0.0.1:4500/__reactor && break; sleep 0.5; done
          curl -fs http://127.0.0.1:4500/ | grep -q '<div id="root">'
          cat "$HOME/.local/state/reactor-quest/reactor-quest.log"
          pkill -f 'reactor-quest/server.mjs'
          "$HOME/.local/share/reactor-quest/uninstall.sh"
          test ! -e "$HOME/.local/share/reactor-quest" && test ! -e "$HOME/.local/share/applications/reactor-quest.desktop"
      - name: Tar the Linux package
        if: runner.os == 'Linux'
        run: tar -czf reactor-quest-linux.tar.gz reactor-quest-linux

      - uses: actions/upload-artifact@v4
        with:
          name: reactor-quest-${{ runner.os == 'macOS' && 'macos' || runner.os == 'Windows' && 'windows' || 'linux' }}
          path: |
            reactor-quest/reactor-quest-macos.zip
            reactor-quest/reactor-quest-windows.zip
            reactor-quest/reactor-quest-linux.tar.gz
          if-no-files-found: error
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: reactor-quest-screenshots-${{ matrix.label }}
          path: reactor-quest/test-results/
~~~~

---

## Part 16. README and licences

The README is for players first. It covers what the game is, **how to play on each OS** (install Node 20.19+; double-click the launcher, or `npm start`), the optional app packages and how to install and uninstall them, how progress is saved (per browser; Character → Settings to reset), the floors and what each teaches, how it teaches (the learning design in Part 0), the reward systems in brief, the colour profiles, and a short developer section (`npm run dev`, `npm test`, `npm run smoke`, how to add a level). Screenshots go in `docs/` (the original has title, map, level, hover-type, react-level, victory, box, character, review, theme-menu and themes images, taken by the browser bot).

**`LICENSES.md`**

~~~~markdown
# Licenses

Reactor Quest's own code, curriculum, art (the icon is generated by
`tools/icon.mjs`) and sounds (synthesized at runtime) are released under the MIT
license.

The built game bundles these third-party packages:

| Package | License | Used for |
|---|---|---|
| [TypeScript](https://github.com/microsoft/TypeScript) 6 | Apache-2.0 | the in-browser compiler, and its standard-library declaration files |
| [React](https://github.com/facebook/react) / react-dom 19 | MIT | the game UI and the player's components |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | MIT | React's types, served to the in-browser compiler |
| [csstype](https://github.com/frenic/csstype) | MIT | a dependency of @types/react |
| [CodeMirror 6](https://codemirror.net) and [Lezer](https://lezer.codemirror.net) | MIT | the code editor and syntax highlighting |

Development-only tools (Vite, Vitest, jsdom, Playwright) are not shipped in the build.
~~~~

---

## Part 17. Lessons learned the hard way

These are real bugs from building the original. The code above already handles each of them; keep the fixes if you change things.

1. **Timing in checks must survive a slow machine.** CI runners, especially Windows ones, can be several times slower than a laptop. A check that renders a countdown with 20 ms ticks and then asserts "T-3" will sometimes see "T-2". Read initial values with a slow tick (e.g. `tickMs: 10_000`). In debounce checks, use waits well apart: the debounce delay (e.g. 200–300 ms) against a final wait of 450–700 ms, never 50 ms against 120 ms.
2. **Forms reload the page.** A beginner's `onSubmit` without `preventDefault()` would reload the whole game. The `Stage` catches the submit, prevents it, and fails the check with an explanation. The `Preview` prevents it and logs a warning.
3. **React 19 reports handler errors with `reportError`**, which surfaces as a window `error` event, not a thrown exception. The `Stage` listens for it, otherwise a crashing `onClick` would "pass".
4. **Infinite loops freeze the tab.** The loop-guard transformer and the sandbox's `__loopGuard` turn them into a readable error after 1.5 s. The guard resets on each microtask, so async code is unaffected.
5. **Uncleared timers leak between checks.** The sandbox tracks every timer the player starts, and `grade()` clears them all after each check. This also lets a check assert that unmounting stops a timer (`activeTimers()`).
6. **A starter's unhandled rejection is expected.** Levels about error handling deliberately leave a failing promise unhandled in the starter. Tag fake failures with `fixtureError()`, so Vitest's `onUnhandledError` ignores them while still reporting real ones.
7. **Typing into React inputs** must go through the native value setter, then dispatch `input`. Otherwise React ignores the change.
8. **Line endings.** Checks compare printed output and source text. Force LF in Git (`.gitattributes`) so Windows checkouts behave the same, but keep `.cmd`/`.ps1` as CRLF or Windows won't run them properly.
9. **`npm` is `npm.cmd` on Windows**, and Node only spawns it through a shell (`shell: true`).
10. **Double-clicked scripts get a minimal `PATH`** (Finder, desktop launchers). Add the usual Node locations and source nvm before giving up.
11. **Port already in use**: try the next ports. If a Reactor server is already running (it answers `/__reactor`), just open the browser.
12. **The compiler is big** (about 3.5 MB of compiler JS plus about 4 MB of typings). Load it in a worker, start it on app mount, and show "Loading compiler…" until it's ready. Raise Vite's `chunkSizeWarningLimit` for it.
13. **Flash of wrong colours**: apply the stored profile in `main.tsx` before `createRoot().render()`.
14. **A light profile behind a dark page**: never hard-code a background on `<body>` in `index.html`. Let the stylesheet's `var(--bg)` do it.
15. **Announcement floods**: a boss clear can produce a dozen events. Cap the visible cards, merge box notices, and keep everything in the inbox log.
16. **Farming**: pay XP, gold and viewers only for improvements (first clear, or more stars than before). Replays can still earn the stars a player missed.
17. **Don't let comments satisfy source checks**: strip comments before matching (`code()` in helpers).
18. **StrictMode double-invokes effects in development.** Every effect in the UI must clean up after itself (timers, listeners, React roots).
19. **Practice must only test what's been taught.** The old timed arcade showed every card from day one, so a Floor 1 beginner faced generics, and four cards tested things no lesson covered (`Map`, `enum`, `parseInt`, the `!` assertion). Tie every review item to the level that teaches it.
20. **Saves live per address.** `localStorage` belongs to the exact origin, port included, so a server that hops to the next free port makes a player's progress seem to vanish. Use one fixed port, and give players a backup file.

---

## Part 18. Definition of done

- [ ] `npm run build` typechecks and builds with no errors.
- [ ] `npm test` passes: every one of the 86 code levels is proven both ways, all 10 quizzes are valid, all 40 compile cards match the compiler and no review card tests untaught material, all 17 profiles are readable and distinct, and the rewards, progress, runtime, checker and markdown tests pass.
- [ ] `npm run smoke` passes all 107 steps.
- [ ] `npm start` and the double-click launcher for each OS open the game in the browser. A second launch just opens the browser.
- [ ] `npm run app:mac`, `app:win` and `app:linux` produce packages that install, launch, serve the game and uninstall cleanly.
- [ ] CI is green on macOS, Windows and Linux.
- [ ] A new player can go from "Begin" to their first ✓ in under two minutes, and nothing on screen assumes they know what code is.

