#!/usr/bin/env node
/**
 * Build this game's cast out of Liberated Pixel Cup layers.
 *
 * LPC art is not one sprite per character — it is a body sheet plus a stack of
 * clothing, armour and weapon sheets, every one of them the same 13×21 grid of
 * 64 px cells, drawn to line up frame for frame. A character is therefore a
 * *recipe*: an ordered list of layers, some of them recoloured. That is the
 * whole reason LPC is worth the trouble over a fixed pack — the DCC cast needs
 * a barefoot man in boxer shorts, a crowd of levies in matching blue, a
 * red-hooded thug and a captain in gold, and no single downloaded pack contains
 * that set. Stacking does.
 *
 * This fetches the layers it needs (cached on disk), composites each recipe
 * into a full LPC sheet, and hands the result to art-import.mjs with
 * --preset lpc.
 *
 * Usage:
 *   node tools/art-lpc.mjs                 # build every recipe into public/art
 *   node tools/art-lpc.mjs hero grunt      # just these
 *   node tools/art-lpc.mjs --sheets-only   # composite, don't import
 *   node tools/art-lpc.mjs --out DIR       # somewhere other than public/art
 *
 * LICENCE. LPC art is dual GNU GPL 3.0 / CC-BY-SA 3.0. Both are compatible
 * with this project's AGPL-3.0-or-later, and both REQUIRE attribution. Running
 * this tool writes the credit block into LICENSES.md; do not delete it, and do
 * not ship the sheets without it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.lpc-cache');
const REPO = 'https://raw.githubusercontent.com/jrconway3/Universal-LPC-spritesheet/master';

// ─────────────────────────── the layer library ───────────────────────────

/**
 * Every LPC file this tool knows how to reach, under a short name.
 *
 * Spelled out rather than discovered because the repository cannot be listed:
 * the GitHub API and the HTML tree pages are both blocked from this sandbox,
 * and only raw file fetches get through. Every path below was verified to
 * return 200 before it was written down.
 */
const L = {
  bodyLight: 'body/male/light.png',
  bodyDark: 'body/male/dark.png',
  hairPlain: 'hair/male/plain/black.png',
  hairMessy: 'hair/male/messy1/black.png',
  hairBlonde: 'hair/male/bangs/blonde.png',
  shirt: 'torso/shirts/longsleeve/male/white_longsleeve.png',
  leatherChest: 'torso/leather/chest_male.png',
  leatherShoulders: 'torso/leather/shoulders_male.png',
  plateChest: 'torso/plate/chest_male.png',
  plateArms: 'torso/plate/arms_male.png',
  pants: 'legs/pants/male/white_pants_male.png',
  greaves: 'legs/armor/male/golden_greaves_male.png',
  skirt: 'legs/skirt/male/robe_skirt_male.png',
  shoes: 'feet/shoes/male/black_shoes_male.png',
  gloves: 'hands/gloves/male/golden_gloves_male.png',
  belt: 'belt/leather/male/leather_male.png',
  hood: 'head/hoods/male/cloth_hood_male.png',
  spear: 'weapons/right hand/male/spear_male.png',
  dagger: 'weapons/right hand/male/dagger_male.png',
};

// ─────────────────────────── the cast ───────────────────────────

/**
 * A layer is `[name]`, `[name, tint]` or `[name, tint, clip]`.
 *
 * `tint` multiplies the layer's colour, which is how one white shirt sheet
 * becomes a blue levy and a red thug. It multiplies rather than replaces so
 * the artist's own shading survives — a flat recolour would throw away the
 * only thing that makes these sprites read as cloth.
 *
 * `clip` keeps just a horizontal band of each 64 px cell, given as
 * `[top, bottom]` in cell pixels. It exists for exactly one character: LPC has
 * no boxer shorts, but trousers clipped at the thigh are boxer shorts, and
 * Carl being barefoot in boxer shorts is not a detail — it is the joke the
 * whole character is built on.
 */
const CAST = {
  hero: {
    cell: '66x84',
    note: 'Carl — barefoot, bare-chested, blue boxers',
    layers: [
      [L.bodyLight],
      // No clip: this pack's "pants" layer is already cut like briefs, sitting
      // at roughly y 44-56 of the 64 px cell. Clipping it to the thigh — which
      // is what you would reach for to turn trousers into shorts — leaves a
      // two-pixel sliver at the waistband and nothing else.
      [L.pants, '#4f6ea8'],
      [L.hairMessy],
    ],
  },
  levy0: {
    cell: '48x62',
    note: 'crew, under 12 — whatever they had on',
    layers: [[L.bodyLight], [L.pants, '#6a6f7d'], [L.shirt, '#6b8fd6'], [L.shoes], [L.hairPlain]],
  },
  levy1: {
    cell: '48x62',
    note: 'crew, 12-29 — someone found the leather',
    layers: [
      [L.bodyLight], [L.pants, '#5b6070'], [L.shirt, '#6b8fd6'],
      [L.leatherChest], [L.belt], [L.shoes], [L.hairPlain],
    ],
  },
  levy2: {
    // Wider than its peers on purpose. The shared crop box has to contain the
    // spear, and a box 60 px wide inside a 48 px cell forces the scale down a
    // whole step — which would draw the veteran levy SMALLER than the recruit
    // standing next to him. The extra cell width is transparent margin; it
    // buys the body back its scale.
    cell: '64x62',
    note: 'crew, 30+ — an actual line unit, with spears',
    layers: [
      [L.bodyLight], [L.pants, '#5b6070'], [L.shirt, '#6b8fd6'],
      [L.leatherChest], [L.leatherShoulders], [L.belt], [L.shoes],
      [L.hairPlain], [L.spear],
    ],
  },
  grunt: {
    cell: '52x64',
    note: 'Redcloak — red hood, short blade',
    layers: [
      [L.bodyDark], [L.pants, '#4a3f38'], [L.shirt, '#8c3a2c'],
      [L.belt], [L.shoes], [L.hood, '#d63a2c'], [L.dagger],
    ],
  },
  archer: {
    cell: '54x64',
    note: 'Slinger — leather, hood, no bow in this pack (see the report)',
    layers: [
      [L.bodyLight], [L.pants, '#6b5638'], [L.shirt, '#a8875c'],
      [L.leatherChest], [L.leatherShoulders], [L.belt], [L.shoes],
      [L.hood, '#8c6a3f'], [L.dagger],
    ],
  },
  heavy: {
    cell: '72x80',
    note: 'Bruiser — full plate',
    layers: [
      [L.bodyDark], [L.pants, '#4a4a52'], [L.shirt, '#7a7f8c'],
      [L.plateChest], [L.plateArms], [L.greaves, '#c6ccd4'],
      [L.belt], [L.shoes], [L.gloves, '#c6ccd4'], [L.dagger],
    ],
  },
  captain: {
    // Same spear problem as levy2, and it matters more here: the captain is
    // meant to read as the biggest thing on the field.
    cell: '110x106',
    note: 'Floor Captain — plate and gold, red tabard',
    layers: [
      [L.bodyLight], [L.pants, '#3f3f48'], [L.shirt, '#8c1f18'],
      [L.plateChest], [L.plateArms], [L.skirt, '#d63a2c'],
      [L.greaves], [L.belt], [L.shoes], [L.gloves],
      [L.hairBlonde], [L.spear],
    ],
  },
};

// Princess Donut is deliberately absent. She is a cat, this is a library of
// humanoids, and a humanoid Donut would be worse than the painted cat.

// ─────────────────────────── arguments ───────────────────────────

const argv = process.argv.slice(2);
const flagOf = (n, d = null) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const OUT = resolvePath(flagOf('out', join(ROOT, 'public/art')));
const SHEETS_ONLY = argv.includes('--sheets-only');
const SCALE = flagOf('scale', '3');
const want = argv.filter((a) => !a.startsWith('--') && a in CAST);
const kinds = want.length ? want : Object.keys(CAST);

// ─────────────────────────── fetch, cached ───────────────────────────

async function fetchLayer(path) {
  const local = join(CACHE, path.replace(/[/ ]/g, '_'));
  if (existsSync(local)) return local;
  const url = REPO + '/' + path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // A 404 body is 14 bytes of text; a real layer is tens of kilobytes. Checking
  // the PNG magic rather than the status alone means a proxy that helpfully
  // returns an error page cannot be mistaken for art.
  if (buf.length < 100 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path} did not come back as a PNG (${buf.length} bytes)`);
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(local, buf);
  return local;
}

const needed = [...new Set(kinds.flatMap((k) => CAST[k].layers.map((l) => l[0])))];
console.log(`layers      ${needed.length} needed`);
const paths = {};
for (const p of needed) {
  process.stdout.write(`  ${existsSync(join(CACHE, p.replace(/[/ ]/g, '_'))) ? 'cached' : 'fetch '}  ${p}\n`);
  paths[p] = await fetchLayer(p);
}

// ─────────────────────────── composite ───────────────────────────

const files = {};
for (const p of needed) files[p] = readFileSync(paths[p]);

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').slice(1));
  if (url in files) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(files[url]);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset="utf-8"><title>lpc</title><body></body>');
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const SHEETS = join(ROOT, '.lpc-cache/sheets');
mkdirSync(SHEETS, { recursive: true });

for (const kind of kinds) {
  const recipe = CAST[kind];
  const png = await page.evaluate(async ({ base, layers }) => {
    const load = (u) => new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error('load ' + u));
      i.src = u;
    });

    let out = null;
    let c = null;
    for (const [file, tint, clip] of layers) {
      const img = await load(base + encodeURIComponent(file));
      if (!out) {
        out = document.createElement('canvas');
        out.width = img.width;
        out.height = img.height;
        c = out.getContext('2d');
      }

      // Tint on a scratch canvas, not on the output: `multiply` composited
      // straight onto the stack would darken everything already drawn under
      // this layer, not just this layer.
      let src = img;
      if (tint || clip) {
        const tmp = document.createElement('canvas');
        tmp.width = img.width;
        tmp.height = img.height;
        const t = tmp.getContext('2d');
        t.drawImage(img, 0, 0);
        if (tint) {
          t.globalCompositeOperation = 'multiply';
          t.fillStyle = tint;
          t.fillRect(0, 0, tmp.width, tmp.height);
          // multiply also hit the transparent margin; put the original alpha
          // back so the recolour cannot leak a rectangle around the sprite
          t.globalCompositeOperation = 'destination-in';
          t.drawImage(img, 0, 0);
        }
        if (clip) {
          // keep only [top, bottom) of every 64 px cell
          const [y0, y1] = clip;
          t.globalCompositeOperation = 'destination-out';
          t.fillStyle = '#000';
          for (let cy = 0; cy < tmp.height; cy += 64) {
            t.fillRect(0, cy, tmp.width, y0);
            t.fillRect(0, cy + y1, tmp.width, 64 - y1);
          }
        }
        src = tmp;
      }
      c.drawImage(src, 0, 0);
    }
    return out.toDataURL('image/png');
  }, { base: `http://127.0.0.1:${port}/`, layers: recipe.layers });

  const sheet = join(SHEETS, `${kind}.png`);
  writeFileSync(sheet, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`\ncomposite   ${kind}  ${recipe.note}`);
  console.log(`            ${recipe.layers.length} layers → ${sheet}`);

  if (!SHEETS_ONLY) {
    const out = execFileSync('node', [
      join(ROOT, 'tools/art-import.mjs'), sheet,
      '--kind', kind, '--cell', recipe.cell,
      '--preset', 'lpc', '--scale', SCALE, '--out', OUT,
    ], { encoding: 'utf8' });
    console.log(out.split('\n').filter((l) => /^(source|cells|resampled|wrote)/.test(l))
      .map((l) => '            ' + l).join('\n'));
  }
}

await browser.close();
server.close();

// ─────────────────────────── attribution ───────────────────────────

const CREDIT_START = '<!-- lpc-credit-start -->';
const CREDIT_END = '<!-- lpc-credit-end -->';
const credit = `${CREDIT_START}
### Liberated Pixel Cup character art

The character sheets in \`public/art/\` are composited by \`tools/art-lpc.mjs\`
from Liberated Pixel Cup layers, and are **not** original to this project.

| | |
| --- | --- |
| Source | https://github.com/jrconway3/Universal-LPC-spritesheet |
| Upstream | Liberated Pixel Cup, https://lpc.opengameart.org |
| Licence | GNU GPL 3.0 **and** CC-BY-SA 3.0 (dual) |
| Attribution | required — keep this section, and credit the LPC contributors in any build you distribute |

Both licences are compatible with this project's AGPL-3.0-or-later, and both
require attribution and share-alike. The per-layer author list lives with the
upstream repository; if you ship this, carry that list too.

Composited into: ${kinds.join(', ')}.
${CREDIT_END}`;

const licPath = join(ROOT, 'LICENSES.md');
let lic = readFileSync(licPath, 'utf8');
if (lic.includes(CREDIT_START)) {
  lic = lic.replace(new RegExp(`${CREDIT_START}[\\s\\S]*?${CREDIT_END}`), credit);
} else {
  lic = lic.trimEnd() + '\n\n---\n\n' + credit + '\n';
}
writeFileSync(licPath, lic);

console.log(`\ncredit      LPC attribution written into ${licPath}`);
console.log(`\nnext        npm run art:check && npm run dev`);
