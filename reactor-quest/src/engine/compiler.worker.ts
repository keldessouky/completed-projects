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
