// Some work takes time — asking a server, reading a file. Instead of freezing,
// JavaScript hands you a *Promise*: a value that will arrive later.
//
//   async function load(api: (id: string) => Promise<string>) {
//     const status = await api("core");   // wait for the promise, then carry on
//     return status;
//   }
//
// An `async` function always returns a Promise. `await` only works inside one.
// Promise.all([...]) starts several at once and waits for them all:
//   const [a, b] = await Promise.all([api("a"), api("b")]);
// If an awaited promise fails (rejects), it throws — so try/catch works.

// `api` asks a remote system for its status, e.g. "ok" or "fault".
export type Api = (id: string) => Promise<string>;

// 1. "<id>: <status>",  e.g.  "core: ok"
export async function statusLine(id: string, api: Api): Promise<string> {
  return id;
}

// 2. The statuses of all the ids, in the same order — asked for all at once,
//    not one after another.
export async function allStatuses(ids: string[], api: Api): Promise<string[]> {
  return [];
}

// 3. Like statusLine, but if the api fails, return "<id>: offline" instead.
export async function safeStatusLine(id: string, api: Api): Promise<string> {
  return statusLine(id, api);
}

// 4. Ask about each id ONE AT A TIME, in order, and return the first one whose
//    status is "ok" — or null if none are. Stop asking once you find one.
export async function firstHealthy(ids: string[], api: Api): Promise<string | null> {
  return null;
}
