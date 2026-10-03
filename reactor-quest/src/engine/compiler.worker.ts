// Hosts the TypeScript compiler off the main thread. The first request waits
// for the ~4 MB of standard-library typings to load; after that each check
// is incremental and takes tens of milliseconds.
import { Checker, type CheckResult } from './checker';

export type WorkerRequest = { id: number; files: Record<string, string> };
export type WorkerResponse = { id: number; result?: CheckResult; error?: string } | { ready: true };

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
  const { id, files } = event.data;
  try {
    const result = (await getChecker()).check(files);
    (self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
  }
};
