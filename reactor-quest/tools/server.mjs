// A tiny static server for the built game — no dependencies, so it can be
// copied as-is into the macOS, Windows and Linux app packages. Serves one
// folder on localhost, opens the default browser, and (with --app) exits a
// minute after the last open game tab stops sending heartbeats.
import { createServer, request } from 'node:http';
import { createWriteStream, mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
/**
 * Show a message in a native dialog. The packaged apps start the server with
 * no console, so without this an error would only reach the log file.
 * Best effort: if no dialog tool is available, the message is still logged.
 */
export function showDialog(message) {
  const env = { ...process.env, REACTOR_MESSAGE: message };
  const run = (cmd, args) => {
    try {
      return spawnSync(cmd, args, { env, stdio: 'ignore', timeout: 10 * 60_000 }).status === 0;
    } catch {
      return false;
    }
  };
  // The message travels in an environment variable, so nothing needs escaping.
  if (process.platform === 'darwin') {
    return run('osascript', ['-e', 'display dialog (system attribute "REACTOR_MESSAGE") with title "Reactor Quest" buttons {"OK"} default button "OK" with icon caution']);
  }
  if (process.platform === 'win32') {
    return run('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show($env:REACTOR_MESSAGE, 'Reactor Quest', 'OK', 'Warning')"]);
  }
  const markup = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return run('zenity', ['--warning', '--title=Reactor Quest', '--no-wrap', `--text=${markup}`])
    || run('kdialog', ['--title', 'Reactor Quest', '--sorry', message])
    || run('notify-send', ['Reactor Quest', message]);
}

export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  const [a, b] = [resolve(process.argv[1]), fileURLToPath(metaUrl)];
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// Run directly: node server.mjs [folder] [--app] [--no-open] [--port N] [--log FILE]
// With --app (the packaged apps, which have no console), a failure to start is
// also shown in a dialog, unless --no-open says nobody is watching.
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
      if (flag('--app') && !flag('--no-open')) showDialog(e.message);
      process.exit(1);
    }
  }
}
