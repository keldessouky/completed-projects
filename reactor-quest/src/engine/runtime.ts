// Runs the player's transpiled code and gives level checks a small, friendly
// testing kit: render a component for real (React 19 + react-dom), click it,
// type into it, read what it shows, and assert with readable failure messages.
import * as React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export type Module = Record<string, any>;

export class CheckFailure extends Error {}

const MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': JSXRuntime,
  'react/jsx-dev-runtime': JSXRuntime,
};

const LOOP_LIMIT_MS = 1500;

/**
 * Everything the player's module can reach that we need to observe or undo:
 * console output, and timers — so a forgotten setInterval can be counted by a
 * check and is always cleared when the code is replaced.
 */
export class Sandbox {
  private timers = new Map<number, 'timeout' | 'interval'>();
  constructor(readonly log: (line: string) => void = () => {}) {}

  get activeTimers() {
    return this.timers.size;
  }

  clearAll() {
    for (const [id, kind] of this.timers) (kind === 'interval' ? clearInterval : clearTimeout)(id);
    this.timers.clear();
  }

  globals() {
    const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : show(a))).join(' ');
    // Counts loop iterations within one synchronous run; a microtask resets it
    // as soon as the code yields, so only a loop that never lets go trips it.
    let iterations = 0;
    let started = 0;
    let armed = false;
    const loopGuard = () => {
      if (!armed) {
        armed = true;
        started = performance.now();
        queueMicrotask(() => {
          armed = false;
          iterations = 0;
        });
      }
      if ((++iterations & 0x3fff) === 0 && performance.now() - started > LOOP_LIMIT_MS) {
        armed = false;
        iterations = 0;
        throw new RangeError(`A loop has been running for over ${LOOP_LIMIT_MS / 1000} seconds without stopping. Check that its condition eventually becomes false (or that the counter changes each time round).`);
      }
    };
    return {
      __loopGuard: loopGuard,
      console: {
        log: (...a: unknown[]) => this.log(fmt(a)),
        info: (...a: unknown[]) => this.log(fmt(a)),
        warn: (...a: unknown[]) => this.log(`⚠ ${fmt(a)}`),
        error: (...a: unknown[]) => this.log(`✖ ${fmt(a)}`),
      },
      setTimeout: (cb: () => void, ms?: number, ...args: unknown[]) => {
        const id = window.setTimeout(() => {
          this.timers.delete(id);
          (cb as (...a: unknown[]) => void)(...args);
        }, ms);
        this.timers.set(id, 'timeout');
        return id;
      },
      setInterval: (cb: () => void, ms?: number, ...args: unknown[]) => {
        const id = window.setInterval(cb, ms, ...args);
        this.timers.set(id, 'interval');
        return id;
      },
      clearTimeout: (id?: number) => {
        if (id !== undefined) this.timers.delete(id);
        window.clearTimeout(id);
      },
      clearInterval: (id?: number) => {
        if (id !== undefined) this.timers.delete(id);
        window.clearInterval(id);
      },
    };
  }
}

/** Evaluate CommonJS output inside a sandbox's globals. */
export function loadModule(js: string, sandbox: Sandbox = new Sandbox()): Module {
  const module = { exports: {} as Module };
  const require = (name: string) => {
    if (name in MODULES) return MODULES[name];
    throw new Error(`Cannot find module '${name}'. On this station only 'react' is installed.`);
  };
  const globals = sandbox.globals();
  const names = Object.keys(globals);
  new Function('require', 'exports', 'module', ...names, js)(require, module.exports, module, ...names.map((n) => globals[n as keyof typeof globals]));
  return module.exports;
}

/** A short, readable rendering of any value for failure messages. */
export function show(v: unknown, depth = 0): string {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : `"${v}"`;
  if (typeof v === 'function') return `function ${v.name || '(anonymous)'}`;
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' && Number.isNaN(v)) return 'NaN';
  if (v instanceof Element) return `<${v.tagName.toLowerCase()}>`;
  if (Array.isArray(v)) return depth > 2 ? '[…]' : `[${v.map((x) => show(x, depth + 1)).join(', ')}]`;
  if (v && typeof v === 'object') {
    if (depth > 2) return '{…}';
    const body = Object.entries(v).map(([k, x]) => `${k}: ${show(x, depth + 1)}`).join(', ');
    return `{ ${body} }`;
  }
  return String(v);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => (a as any)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as any)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as any)[k], (b as any)[k]));
}

export interface Mock<A extends unknown[] = any[], R = any> {
  (...args: A): R;
  calls: A[];
}

function isMock(v: unknown): v is Mock {
  return typeof v === 'function' && Array.isArray((v as Mock).calls);
}

export interface Matchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(item: unknown): void;
  toMatch(re: RegExp): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeType(type: string): void;
  toHaveLength(n: number): void;
  toBeGreaterThan(n: number): void;
  toBeCalledTimes(n: number): void;
  toBeCalledWith(...args: unknown[]): void;
  toThrow(): void;
}

export function expect(actual: unknown): Matchers & { not: Matchers };
export function expect(actual: unknown, negate: true): Matchers;
export function expect(actual: unknown, negate = false): Matchers {
  const assert = (ok: boolean, msg: string) => {
    if (ok === negate) throw new CheckFailure(negate ? msg.replace(/\bto\b/, 'not to') : msg);
  };
  const matchers: Matchers = {
    toBe: (expected: unknown) => assert(Object.is(actual, expected), `Expected ${show(actual)} to be ${show(expected)}`),
    toEqual: (expected: unknown) => assert(deepEqual(actual, expected), `Expected ${show(actual)} to equal ${show(expected)}`),
    toContain: (item: unknown) =>
      assert(
        typeof actual === 'string' ? actual.includes(String(item)) : Array.isArray(actual) && actual.some((x) => deepEqual(x, item)),
        `Expected ${show(actual)} to contain ${show(item)}`,
      ),
    toMatch: (re: RegExp) => assert(typeof actual === 'string' && re.test(actual), `Expected ${show(actual)} to match ${re}`),
    toBeTruthy: () => assert(!!actual, `Expected ${show(actual)} to be truthy`),
    toBeFalsy: () => assert(!actual, `Expected ${show(actual)} to be falsy`),
    toBeNull: () => assert(actual === null, `Expected ${show(actual)} to be null`),
    toBeType: (type: string) => assert(typeof actual === type, `Expected ${show(actual)} to be a ${type}`),
    toHaveLength: (n: number) => assert((actual as { length?: number })?.length === n, `Expected ${show(actual)} to have length ${n}`),
    toBeGreaterThan: (n: number) => assert((actual as number) > n, `Expected ${show(actual)} to be greater than ${n}`),
    toBeCalledTimes: (n: number) => {
      if (!isMock(actual)) throw new CheckFailure('Expected a mock function');
      assert(actual.calls.length === n, `Expected the function to be called ${n} time(s), but it was called ${actual.calls.length} time(s)`);
    },
    toBeCalledWith: (...args: unknown[]) => {
      if (!isMock(actual)) throw new CheckFailure('Expected a mock function');
      const last = actual.calls.at(-1);
      assert(!!last && deepEqual(last, args), `Expected the function to be called with (${args.map((a) => show(a)).join(', ')}), but got ${last ? `(${last.map((a) => show(a)).join(', ')})` : 'no calls'}`);
    },
    toThrow: () => {
      let threw = false;
      try { (actual as () => unknown)(); } catch { threw = true; }
      assert(threw, 'Expected the call to throw');
    },
  };
  return negate ? matchers : Object.assign(matchers, { not: expect(actual, true) });
}

export function fn<A extends unknown[] = any[], R = any>(impl?: (...args: A) => R): Mock<A, R> {
  const mock = ((...args: A) => {
    mock.calls.push(args);
    return impl?.(...args) as R;
  }) as Mock<A, R>;
  mock.calls = [];
  return mock;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Let React finish whatever an event scheduled: microtasks, then a macrotask. */
export const settle = async () => {
  for (let i = 0; i < 3; i++) await wait(0);
};

export interface View {
  container: HTMLElement;
  text(): string;
  query<E extends Element = HTMLElement>(selector: string): E | null;
  queryAll<E extends Element = HTMLElement>(selector: string): E[];
  get<E extends Element = HTMLElement>(selector: string): E;
  getByText(text: string | RegExp, selector?: string): HTMLElement;
  click(target: Element | string): Promise<void>;
  type(target: Element | string, value: string): Promise<void>;
  submit(target?: Element | string): Promise<void>;
  rerender(el: React.ReactElement): Promise<void>;
  unmount(): Promise<void>;
  /** Press a key on an element (keydown, then keyup), e.g. 'ArrowRight', 'Enter', 'Escape'. */
  key(target: Element | string, key: string): Promise<void>;
  focus(target: Element | string): Promise<void>;
}

type Target = Element | string;

/** How many check stages are live — the preview ignores window errors while checks own them. */
export const activity = { stages: 0 };

export class Stage {
  private roots: { root: Root; host: HTMLElement }[] = [];
  private error: unknown = null;
  private reloaded = false;
  // React reports errors thrown in event handlers with reportError(), which
  // surfaces as a window "error" event. Claim those so they fail the check.
  private onWindowError = (e: ErrorEvent) => {
    e.preventDefault();
    this.error ??= e.error ?? new Error(e.message);
  };

  constructor() {
    activity.stages++;
    window.addEventListener('error', this.onWindowError);
  }

  async render(el: React.ReactElement): Promise<View> {
    const host = document.createElement('div');
    host.setAttribute('data-test-host', '');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;width:800px';
    document.body.appendChild(host);
    const root = createRoot(host, {
      onUncaughtError: (e) => { this.error ??= e; },
      onCaughtError: (e) => { this.error ??= e; },
    });
    this.roots.push({ root, host });
    // Registered after createRoot, so it runs after React's own listener: if the
    // player's onSubmit didn't prevent the default, note it — and prevent it
    // ourselves, so a buggy form can never reload the game.
    host.addEventListener('submit', (e) => {
      if (!e.defaultPrevented) this.reloaded = true;
      e.preventDefault();
    });
    const commit = async (node: React.ReactElement) => {
      flushSync(() => root.render(node));
      await settle();
      this.rethrow();
    };
    await commit(el);

    const find = <E extends Element>(t: Target | null | undefined): E => {
      if (t == null) throw new CheckFailure(`Expected an element that isn't on screen. Rendered: ${snippet(host)}`);
      if (typeof t !== 'string') return t as E;
      const found = host.querySelector<E>(t);
      if (!found) throw new CheckFailure(`Couldn't find any <${t}> on screen. Rendered: ${snippet(host)}`);
      return found;
    };
    const after = async () => { await settle(); this.rethrow(); };

    return {
      container: host,
      text: () => (host.textContent ?? '').replace(/\s+/g, ' ').trim(),
      query: (s) => host.querySelector(s),
      queryAll: <E extends Element>(s: string) => [...host.querySelectorAll<E>(s)],
      get: (s) => find(s),
      getByText: (text, selector = '*') => {
        const match = (s: string) => (typeof text === 'string' ? s.trim() === text : text.test(s));
        const all = [...host.querySelectorAll<HTMLElement>(selector)].filter((e) => match(e.textContent ?? ''));
        // The innermost matching element, so getByText('Save') returns the <button>, not its parents.
        const hit = all.find((e) => !all.some((o) => o !== e && e.contains(o)));
        if (!hit) throw new CheckFailure(`Couldn't find ${typeof text === 'string' ? `"${text}"` : text} on screen. Rendered: ${snippet(host)}`);
        return hit;
      },
      click: async (t) => {
        const el = find<HTMLElement>(t);
        if ((el as HTMLButtonElement).disabled) throw new CheckFailure(`Tried to click ${describe(el)}, but it is disabled.`);
        el.click();
        await after();
      },
      type: async (t, value) => {
        const input = find<HTMLInputElement>(t);
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        // React tracks the last value it saw; set through the native setter so it notices the change.
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await after();
      },
      submit: async (t = 'form') => {
        find<HTMLFormElement>(t).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await after();
      },
      rerender: (node) => commit(node),
      key: async (t, key) => {
        const el = find<HTMLElement>(t);
        const init = { key, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', init));
        el.dispatchEvent(new KeyboardEvent('keyup', init));
        await after();
      },
      focus: async (t) => {
        find<HTMLElement>(t).focus();
        await after();
      },
      unmount: async () => {
        root.unmount();
        await settle();
      },
    };
  }

  rethrow() {
    if (this.reloaded) {
      this.reloaded = false;
      throw new CheckFailure('The form submitted and would reload the page — call event.preventDefault() in onSubmit.');
    }
    if (this.error) {
      const e = this.error;
      this.error = null;
      throw e;
    }
  }

  cleanup() {
    for (const { root, host } of this.roots) {
      try { root.unmount(); } catch { /* already torn down */ }
      host.remove();
    }
    this.roots = [];
    this.error = null;
    window.removeEventListener('error', this.onWindowError);
    activity.stages--;
  }
}

function describe(el: Element) {
  const text = (el.textContent ?? '').trim();
  return `<${el.tagName.toLowerCase()}>${text ? ` "${text}"` : ''}`;
}

function snippet(host: HTMLElement) {
  const html = host.innerHTML.replace(/\s+/g, ' ');
  return html ? (html.length > 160 ? `${html.slice(0, 160)}…` : html) : '(nothing)';
}
