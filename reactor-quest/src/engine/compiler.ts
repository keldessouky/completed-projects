// Main-thread handle on the compiler worker.
import type { CheckResult } from './checker';
import type { WorkerRequest, WorkerResponse } from './compiler.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: CheckResult) => void; reject: (e: Error) => void }>();
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
    if (msg.result) p.resolve(msg.result);
    else p.reject(new Error(msg.error ?? 'Compiler failed'));
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

export function compile(files: Record<string, string>): Promise<CheckResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, files } satisfies WorkerRequest);
  });
}
