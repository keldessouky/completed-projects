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
