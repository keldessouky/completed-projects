// A tiny static file server for the built game (dist/), so it runs from a double-click
// with nothing but Node installed.
import { exec } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

export const DEFAULT_PORT = 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.gz': 'application/gzip',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function startServer({ root, port = DEFAULT_PORT, host = '127.0.0.1' }) {
  const base = resolve(root);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/__multiverse') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('multiverse-duel');
      return;
    }
    let file = normalize(join(base, decodeURIComponent(url.pathname)));
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const cache = file.includes(`${join(base, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', (e) => fail(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is busy. Close whatever is using it, or run with --port <number>.`) : e));
    server.listen(port, host, () => {
      const url = `http://localhost:${port}/`;
      console.log(`Multiverse Duel is running at ${url}  (press Ctrl+C to stop)`);
      ok({ server, url });
    });
  });
}

/** Is our server already answering on this port? */
export async function probe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__multiverse`, { signal: AbortSignal.timeout(800) });
    return (await res.text()) === 'multiverse-duel';
  } catch {
    return false;
  }
}

export function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
