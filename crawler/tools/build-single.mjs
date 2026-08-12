#!/usr/bin/env node
/**
 * Build Crawler as ONE self-contained .html file.
 *
 * Everything — JS, CSS, both fonts, and the whole audio sprite — is inlined,
 * so the page runs with zero network requests of any kind. That makes it
 * hostable anywhere a single file can go, including strict-CSP sandboxes that
 * forbid external hosts.
 *
 * The audio sprite is embedded as base64 and rehydrated into a Blob URL at
 * runtime (blob: survives CSP rules that would block a bare data: fetch),
 * handed to the boot scene through `window.__CR_AUDIO__`.
 *
 * Usage: node tools/build-single.mjs [outfile] [--embed]
 *
 * --embed emits a body fragment instead of a whole document (no doctype/html/
 * head/body tags), for hosts that supply their own document shell.
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMBED = process.argv.includes('--embed');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = args[0] ?? join(ROOT, 'dist-single', EMBED ? 'crawler.embed.html' : 'crawler.html');
const TMP = join(ROOT, 'dist-single', '_stage');

await build({
  root: ROOT,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: TMP,
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    // inline every referenced asset (fonts) straight into the CSS as data URIs
    assetsInlineLimit: 1024 * 1024 * 64,
    rollupOptions: {
      output: {
        // Pixi lazy-loads its renderer backends; fold them into one chunk
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app[extname]',
      },
    },
  },
});

const html = readFileSync(join(TMP, 'index.html'), 'utf8');
const js = readFileSync(join(TMP, 'app.js'), 'utf8');
const cssPath = join(TMP, 'app.css');
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
const wav = readFileSync(join(ROOT, 'public/assets/audio.wav'));

/**
 * Custom art, inlined.
 *
 * public/art/ is fetched at runtime in the normal build. The one-file build has
 * nothing to fetch from, so every sheet is embedded as a data URL and handed to
 * the loader on `window.__CR_ART__`. Without this, the single-file bundle would
 * be the one build that silently drops replaced characters.
 */
function inlineArt() {
  const dir = join(ROOT, 'public/art');
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return '';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const files = {};
  let bytes = 0;
  for (const f of readdirSync(dir)) {
    if (!/\.(png|webp)$/i.test(f)) continue;
    const buf = readFileSync(join(dir, f));
    bytes += buf.length;
    const mime = f.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
    files[f] = `data:${mime};base64,${buf.toString('base64')}`;
  }
  const n = Object.keys(files).length;
  if (n === 0) return '';
  console.log(`  + ${n} custom art sheet${n === 1 ? '' : 's'} inlined (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  return `<script>window.__CR_ART__=${JSON.stringify({ manifest, files })};</script>\n`;
}
const artBoot = inlineArt();

// Strip the built tags; we re-emit their contents inline.
let out = html
  .replace(/<script[^>]*src="[^"]*"[^>]*>\s*<\/script>/g, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
  .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');

const audioBoot = `
<script>
// Rehydrate the embedded audio sprite into a Blob URL before the game boots.
(function () {
  var b64 = document.getElementById('zr-audio').textContent.trim();
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  window.__CR_AUDIO__ = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
})();
</script>`;

// Replacement values are spliced in via a function, never a string: bundled
// code contains literal `$&` sequences (Pixi's regex-escape helper), and a
// string replacement would expand those into the matched text and corrupt the JS.
const splice = (haystack, needle, value) => haystack.replace(needle, () => value);

const payload =
  `<script type="application/base64" id="zr-audio">${wav.toString('base64')}</script>\n`
  + `${audioBoot}\n${artBoot}<script type="module">\n${js}\n</script>\n`;

if (EMBED) {
  // Body fragment: keep the page chrome (splash, context-loss notice, styles)
  // and the game mount, drop the document shell the host provides.
  const pageStyle = (html.match(/<style>([\s\S]*?)<\/style>/) ?? [, ''])[1];
  const bodyInner = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? [, ''])[1]
    .replace(/<script[^>]*src="[^"]*"[^>]*>\s*<\/script>/g, '');
  out = `<style>\n${pageStyle}\n${css}\n</style>\n${bodyInner}\n${payload}`;
} else {
  out = splice(out, '</head>', `<style>\n${css}\n</style>\n</head>`);
  out = splice(out, '</body>', `${payload}</body>`);
}

writeFileSync(OUT, out);
const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
console.log(`single-file build → ${OUT}  (${mb} MB)`);
