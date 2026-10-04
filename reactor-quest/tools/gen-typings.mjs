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
