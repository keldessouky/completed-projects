# AGENTS.md

Karim Eldessouky's portfolio monorepo. Each top-level folder is an independent project with its own toolchain;
there is no shared build. The 2020 Java projects (`catering-system`, `excelsior-venues`, `tenmo`,
`roaming-in-rome/team-golf-*`) are frozen bootcamp work. Everything else is active and mostly agent-built.

## Commands

Run each from that project's folder.

| Project | Build | Check |
|---|---|---|
| `reactor-quest` (Node ≥ 20.19) | `npm ci && npm run build` | `npm test`, then `npm run smoke` (headless Chrome bot) |
| `qahira` (C++20, CMake) | `tools/build_all.sh` (`--no-art` skips Blender) | `./build/linux/qtests`, then `./build/linux/qhost build/Qahira.qpk --headless --bot <name>` |
| `crawler-ds` (C, libnds) | `make sdk` once, then `make` | `make test` (ROM in DeSmuME) and `make hosttest` (desktop bot) |
| `el-lemby-platformer` macOS | `swift build` | `swift test` |
| `el-lemby-platformer/windows` | `dotnet build ElLemby.App/ElLemby.App.csproj -c Release` | `dotnet run --project ElLemby.Tests/ElLemby.Tests.csproj -c Release` |
| `ziggurat-run`, `crown-and-circuit`, `crawler` | `npm ci && npm run build` | `npm run smoke` (`smoke:single` for the one-file build) |
| `meccha-chameleon` (Node ≥ 20) | `npm run build` | `npm run typecheck && npm run test:sim` |
| `roaming-in-rome/server` | `npm run build` | `npm run lint && npm test && npm run test:e2e` (needs Postgres) |
| `roaming-in-rome/web` | `npm run build` | `npm run lint && npm test` |

CI lives in `.github/workflows/`: `qahira.yml`, `reactor-quest.yml`, `el-lemby.yml` and `ci.yml` (Roaming in
Rome). The four web games have no CI, so run their smoke bot yourself before you push.

## Definition of done

A change is done when a machine can show it works, not when it compiles.

- **Prove gameplay with a bot that uses the real input path** (buttons, the UI, `Input`), not internal calls.
  Every Reactor level is proven both ways (the solution passes, the starter fails). Every QAHIRA act and every
  El-Lemby stage is played to the end by a bot.
- **State what was verified and what wasn't.** PR and commit bodies list the test and bot counts that passed, and
  name anything left unchecked, such as "not yet tried on the RP6" or "the feed can't be reached from the
  container".
- **Keep the gates you're given.** If a written gate (for example, QAHIRA's on-device RP6 check in
  `_bmad-output/planning-artifacts/qahira/slices.md`) can't run, say so in the slice log and the PR. Don't drop it
  quietly.
- **Update docs in the same change.** That means the project's README, its handoff and slice logs
  (`qahira/docs/HANDOFF.md`, `SLICES.md`, `reactor-quest/recipe.md`), and the project's entry in the root
  `README.md` when what it is or does changes.

## Working with the owner

- **Big projects are planned first:** brief → GDD → architecture → vertical slices, in
  `_bmad-output/planning-artifacts/<project>/`. Each slice cuts through every layer (generator → pack → engine →
  gameplay → UI → save → tests) and ends playable.
- **When a request names something real** (a show, a game, an art style, a reference video), confirm which one you
  understood before you build around it. Ask for a link or an example if the name is ambiguous.
- **Before a pivot** (a new platform, genre or rebuild), propose a short spike with one line saying what result
  would drop the idea. Get a yes before you start the full build.
- **Feedback after playing comes as observations** ("too glowy"). Take the notes one at a time, choose concrete
  values, and report the before → after numbers.
- **Cut what doesn't serve the goal.** The owner prefers removing a feature to carrying one that works against it.
  Removals clean out every route, save field, achievement and doc that referred to the feature.
- **Write in plain English.** Commit subjects look like `Project: what changed, in plain words`. Bodies explain
  why, then list what was verified.

## Boundaries

**Always**
- Before deciding that art or audio must be generated from code, run `tools/check-asset-hosts.sh` from the repo
  root. If a CC0 pack fits the look, use it instead of generated art.
- Bring third-party assets in through a script that pins the URLs and checks a SHA-256 for each file (as
  `reactor-quest/tools/node-runtime.mjs` does for Node.js). Commit only the files the game uses, and record each
  one's licence, read from the pack's own licence file, in that project's `LICENSES.md`. QAHIRA's `assets/generated/` is build
  output and isn't committed.
- Version saves and migrate old ones. Clamp every loaded field.

**Ask first**
- Before starting a rebuild, a new platform port, or a new project folder.
- Before merging to `master` without a PR. Release work goes through a PR.

**Never**
- Commit secrets or real credentials (use a gitignored `.env`).
- Ship audio, art or other media you haven't confirmed the license for. Public-domain claims for recordings need
  checking against US law.
- Touch the frozen 2020 projects unless asked.

**Flag for review in the PR body**
- Anything that downloads, self-updates, installs software, or handles network TLS (for example, QAHIRA's
  `game/updater.*` and `audio/radio_fetch.*`, or Reactor's packagers and installers). Suggest a security-review
  pass.

## Gotchas

- **Which outside sites can be reached changes over time.** Don't trust a note saying a site is unreachable,
  including notes in this repo; run `tools/check-asset-hosts.sh` instead.
- **devkitPro's own sites block cloud machines with a Cloudflare firewall**, so changing network settings won't help.
  - The DS game doesn't need them: `make sdk` builds its toolchain from devkitPro's GitHub sources at pinned
    revisions.
  - When the official toolchain is needed (other DS homebrew, or `make sdk` fails), use the `devkitpro/devkitarm`
    Docker image from Docker Hub, at a pinned date tag such as `devkitpro/devkitarm:20260610`, never `latest`.
  - Cloud sessions have the Docker CLI but no Docker engine, so run the image in GitHub Actions
    (`container: devkitpro/devkitarm:<tag>`).
  - The game is written against libnds 1.8.3. Newer images ship a newer libnds, so prove the build in CI before
    relying on an image.
  - Never try to get past devkitPro's firewall (for example by pretending to be a browser).
- **A "CC0" label on a pack isn't proof of its licence.** Packs ship code licences next to the art (an MIT `LICENSE`
  for the code in an itch.io pack labelled CC0), copy-pasted licence headers, and non-CC0 art (LPC is OGA-BY,
  CC-BY-SA or GPL, and needs credits).
- **QAHIRA's art build** needs Blender as the `bpy` module (`pip install bpy==5.0.1` into Python 3.11). For
  screenshots on Linux, run `qhost --hidden` under Xvfb. Set `QAHIRA_BOT_TRACE=1` for bot commentary, and use
  `QAHIRA_CLASS=<class>` to pick a bot's hero.
- **Reactor always uses port 4310** because browser saves are tied to that address; don't make it fall back to
  another port. Its `gen:typings` step runs automatically before `dev`, `build` and `test`.
- **The DS ARM9 image must link at `0x02004000`**, or a direct-booted ROM never starts (see `crawler-ds/README.md`).
