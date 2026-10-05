import type { Deck } from '../game/types';
import { CheckFailure, wait } from '../engine/runtime';
import { codeFiles, comp, fixtureError, mustUse } from './helpers';

/** A promise the check controls: resolve or reject it whenever the test wants. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A fake request: each call returns a fresh deferred, kept in order for the test. */
function controlled<T>() {
  const calls: { args: unknown[]; d: ReturnType<typeof deferred<T>> }[] = [];
  const request = (...args: unknown[]) => {
    const d = deferred<T>();
    calls.push({ args, d });
    return d.promise;
  };
  return { request, calls };
}

const tick = () => wait(5);

/** The real shipping calculator, and the intern's broken versions of it. */
function realShipping(w: number, express: boolean) {
  if (!(w > 0)) throw new Error('Invalid weight');
  let cost = 5 + 2 * w;
  if (w >= 50) cost *= 0.9;
  return express ? cost * 2 : cost;
}
const MUTANTS: { name: string; fn: (w: number, e: boolean) => number }[] = [
  { name: 'forgets the 5-credit base fee', fn: (w, e) => { if (!(w > 0)) throw new Error(); let c = 2 * w; if (w >= 50) c *= 0.9; return e ? c * 2 : c; } },
  { name: 'only discounts above 50 kg (not at 50)', fn: (w, e) => { if (!(w > 0)) throw new Error(); let c = 5 + 2 * w; if (w > 50) c *= 0.9; return e ? c * 2 : c; } },
  { name: 'discounts from 49 kg', fn: (w, e) => { if (!(w > 0)) throw new Error(); let c = 5 + 2 * w; if (w >= 49) c *= 0.9; return e ? c * 2 : c; } },
  { name: 'never discounts', fn: (w, e) => { if (!(w > 0)) throw new Error(); const c = 5 + 2 * w; return e ? c * 2 : c; } },
  { name: 'adds 5 for express instead of doubling', fn: (w, e) => { if (!(w > 0)) throw new Error(); let c = 5 + 2 * w; if (w >= 50) c *= 0.9; return e ? c + 5 : c; } },
  { name: 'skips the discount on express shipments', fn: (w, e) => { if (!(w > 0)) throw new Error(); let c = 5 + 2 * w; if (w >= 50 && !e) c *= 0.9; return e ? c * 2 : c; } },
  { name: 'rounds to whole credits', fn: (w, e) => Math.round(realShipping(w, e)) },
  { name: 'accepts a weight of 0', fn: (w, e) => { if (w < 0) throw new Error(); let c = 5 + 2 * w; if (w >= 50) c *= 0.9; return e ? c * 2 : c; } },
  { name: 'never throws at all', fn: (w, e) => { let c = 5 + 2 * w; if (w >= 50) c *= 0.9; return e ? c * 2 : c; } },
];

type Case = { weight: number; express: boolean; expected: number };
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
/** Does this implementation fail at least one of the player's cases? */
function caught(fn: (w: number, e: boolean) => number, cases: Case[], throwing: number[]) {
  for (const c of cases) {
    let out: number;
    try {
      out = fn(c.weight, c.express);
    } catch {
      return true;
    }
    if (!same(out, c.expected)) return true;
  }
  for (const w of throwing) {
    try {
      fn(w, false);
      return true;
    } catch {
      /* threw, as it should */
    }
  }
  return false;
}

const FLEET = [
  { id: 's1', name: 'Vega', status: 'in-flight', crew: 3 },
  { id: 's2', name: 'Kite', status: 'docked', crew: 4 },
  { id: 's3', name: 'Orion', status: 'docked', crew: 6 },
  { id: 's4', name: 'Swift', status: 'in-flight', crew: 2 },
  { id: 's5', name: 'Kestrel', status: 'docked', crew: 5 },
];

export const floor10: Deck = {
  id: 'production',
  name: 'Production Deck',
  subtitle: 'Professional React',
  outcome: 'You build React apps the way professional teams do: resilient to slow and failing networks, fast, accessible and tested.',
  hue: 15,
  levels: [
    {
      kind: 'code',
      id: 'loading-states',
      title: 'Loading and Error States',
      system: 'Crew Directory',
      skills: ['data', 'effects', 'state'],
      ...codeFiles('loading-states', 'tsx'),
      brief: `**ARIA:** The Production Deck. This is where code meets the real world: slow networks, failing servers, impatient users, screen readers, and thousands of ships. Everything here is what professional teams do every day.

The crew directory loads names from the personnel server. While it waits, it shows nothing. When the server fails, it shows nothing *forever*. Users assume it's broken. Because it is.`,
      lesson: `## Three states, always

Anything loaded over the network is in one of three states, and the UI must show all three:

\`\`\`ts
type State =
  | { status: "loading" }
  | { status: "loaded"; crew: string[] }
  | { status: "failed"; message: string };
\`\`\`

A discriminated union (Floor 5!) makes impossible combinations, like "loaded *and* failed", unrepresentable.

## Handling both outcomes

\`.then(onSuccess, onFailure)\` handles both resolution and rejection:

\`\`\`ts
useEffect(() => {
  let ignore = false;
  setState({ status: "loading" });
  load().then(
    (crew) => { if (!ignore) setState({ status: "loaded", crew }); },
    (error) => { if (!ignore) setState({ status: "failed", message: error.message }); },
  );
  return () => { ignore = true; };   // the component went away, or we're re-loading
}, [load, attempt]);
\`\`\`

The \`ignore\` flag makes sure a response that arrives after the component unmounted, or after a newer request started, is thrown away.

## Retry

To run an effect again on demand, give it a dependency you can bump:

\`\`\`ts
const [attempt, setAttempt] = useState(0);
<button onClick={() => setAttempt((a) => a + 1)}>Retry</button>
\`\`\`

\`role="alert"\` makes screen readers announce the error the moment it appears.`,
      hints: [
        'Model the state as a union: `{ status: "loading" } | { status: "loaded"; crew: string[] } | { status: "failed"; message: string }`, starting as loading.',
        'In the effect, set loading, then `load().then(onSuccess, onFailure)`, each guarded by an `ignore` flag that the cleanup sets. Add an `attempt` counter to the dependencies for Retry.',
        'Render by status: the loading `<p>`, the alert with ``Couldn\'t load crew: {state.message}`` plus `<button onClick={() => setAttempt((a) => a + 1)}>Retry</button>`, or the list.',
      ],
      preview: (mod, h) => h(comp(mod, 'CrewLoader'), { load: () => new Promise((r) => setTimeout(() => r(['Ada', 'Bo', 'Cy']), 1200)) }),
      checks: [
        { label: 'Shows a loading message first', run: async ({ mod, h, render, expect }) => {
          const { request } = controlled<string[]>();
          const view = await render(h(comp(mod, 'CrewLoader'), { load: request }));
          expect(view.get('.loading').textContent).toBe('Loading crew…');
        } },
        { label: 'Shows the crew when the request succeeds', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'CrewLoader'), { load: request }));
          calls[0].d.resolve(['Ada', 'Bo']);
          await tick();
          expect(view.queryAll('li').map((li) => li.textContent)).toEqual(['Ada', 'Bo']);
          expect(view.query('.loading')).toBeNull();
        } },
        { label: 'Shows the error when the request fails', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'CrewLoader'), { load: request }));
          calls[0].d.reject(fixtureError('Server on fire'));
          await tick();
          expect(view.get('[role=alert]').textContent).toBe("Couldn't load crew: Server on fire");
        } },
        { label: 'Retry loads again', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'CrewLoader'), { load: request }));
          calls[0].d.reject(fixtureError('Timeout'));
          await tick();
          await view.click(view.getByText('Retry', 'button'));
          expect(calls.length).toBe(2);
          expect(view.get('.loading').textContent).toBe('Loading crew…');
          calls[1].d.resolve(['Cy']);
          await tick();
          expect(view.queryAll('li').map((li) => li.textContent)).toEqual(['Cy']);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'race-conditions',
      title: 'Race Conditions',
      system: 'Ship Search',
      skills: ['data', 'effects'],
      ...codeFiles('race-conditions', 'tsx'),
      brief: `**ARIA:** Ship search is fast, except when it isn't. Type "kite": the results for "kite" arrive, then the slow results for "ka" arrive *after* them and replace them. The screen now shows search results for something you're no longer searching for. This bug ships in real products every single day.`,
      lesson: `## Responses arrive in any order

Each keystroke starts a request. The network makes no promises about which finishes first:

\`\`\`
type "ka"   → request A starts (slow)
type "kite" → request B starts (fast)
B finishes  → show kite results ✔
A finishes  → show ka results   ✖ stale!
\`\`\`

This is a **race condition**: the result depends on timing you don't control.

## The fix: ignore stale responses

An effect's cleanup runs before the next effect starts. Use it to mark the previous request as stale:

\`\`\`ts
useEffect(() => {
  let stale = false;
  search(query).then((found) => {
    if (!stale) setResults(found);   // only the latest request may update the screen
  });
  return () => { stale = true; };     // runs when query changes
}, [query]);
\`\`\`

Each effect run gets its **own** \`stale\` variable (a closure, from Floor 3). When \`query\` changes, the old run's cleanup flips the old flag, so its late response is ignored.

## Don't ask silly questions

An empty query should clear the results without making a request at all.

(Real apps can also cancel the request itself with an \`AbortController\`. The ignore-flag pattern is the core idea either way.)`,
      hints: [
        'At the top of the effect, handle the empty query: `if (query === "") { setResults([]); return; }`.',
        'Add `let stale = false;` and only call `setResults` when `!stale`.',
        'Return a cleanup: `return () => { stale = true; };`.',
      ],
      checks: [
        { label: 'Shows the results for a search', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'ShipSearch'), { search: request }));
          await view.type('input', 'kite');
          calls.at(-1)!.d.resolve(['Kite', 'Kitefin']);
          await tick();
          expect(view.queryAll('li').map((li) => li.textContent)).toEqual(['Kite', 'Kitefin']);
        } },
        { label: 'An empty query makes no request', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          await render(h(comp(mod, 'ShipSearch'), { search: request }));
          expect(calls.length).toBe(0);
        } },
        { label: 'A slow, stale response never overwrites a newer one', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'ShipSearch'), { search: request }));
          await view.type('input', 'ka');
          await view.type('input', 'kite');
          const forKa = calls.find((c) => c.args[0] === 'ka');
          const forKite = calls.find((c) => c.args[0] === 'kite');
          if (!forKa || !forKite) throw new CheckFailure('Expected one search for "ka" and one for "kite".');
          forKite.d.resolve(['Kite']);
          await tick();
          forKa.d.resolve(['Kara', 'Kite', 'Kestrel']);
          await tick();
          expect(view.queryAll('li').map((li) => li.textContent)).toEqual(['Kite']);
        } },
        { label: 'Clearing the box clears the results', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<string[]>();
          const view = await render(h(comp(mod, 'ShipSearch'), { search: request }));
          await view.type('input', 'kite');
          calls.at(-1)!.d.resolve(['Kite']);
          await tick();
          await view.type('input', '');
          expect(view.queryAll('li')).toHaveLength(0);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'debounce',
      title: 'Debouncing',
      system: 'Request Throttle',
      skills: ['hooks', 'effects', 'performance'],
      ...codeFiles('debounce', 'tsx'),
      brief: `**ARIA:** Every letter typed into the search box fires a request. Typing "reactor core diagnostics" sent twenty-four of them, and the server filed a complaint with HR. Wait until the user pauses.`,
      lesson: `## Debouncing

**Debouncing** delays an action until things have stopped changing for a moment. Each new change restarts the timer, so a burst of typing produces one action at the end.

## As a hook

Effects plus cleanup (Floor 9) do exactly this:

\`\`\`ts
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);     // a new value cancels the pending update
  }, [value, delayMs]);
  return debounced;
}
\`\`\`

The hook is generic (\`<T>\`), so it works for strings, numbers, objects…

## Reacting to the debounced value

Then an effect that depends on the **debounced** value only runs after a pause:

\`\`\`ts
const debounced = useDebouncedValue(text, 300);
useEffect(() => {
  if (debounced) onSearch(debounced);
}, [debounced, onSearch]);
\`\`\`

Because effects only re-run when a dependency *changes*, typing "rea", then "reac", then back to "rea" within the delay causes no new search. The debounced value never changed.`,
      hints: [
        'In the hook, keep `const [debounced, setDebounced] = useState(value);` and set it from a `setTimeout` inside an effect on `[value, delayMs]`.',
        'The effect\'s cleanup must cancel the pending timer: `return () => clearTimeout(id);`.',
        'In `SearchBox`, call the hook with `text` and run the `onSearch` effect on the **debounced** value instead of `text`.',
      ],
      typeChecks: [
        { label: 'useDebouncedValue keeps the value\'s type', code: `import { useDebouncedValue } from './solution';\nfunction T() {\n  const n: number = useDebouncedValue(5, 100);\n  const s: string = useDebouncedValue('x', 100);\n  // @ts-expect-error\n  const bad: number = useDebouncedValue('x', 100);\n  return null;\n}` },
      ],
      checks: [
        { label: 'The hook returns the first value straight away', run: async ({ mod, h, render, expect }) => {
          const use = mod.useDebouncedValue;
          if (typeof use !== 'function') throw new CheckFailure('Export useDebouncedValue.');
          const Probe = ({ v }: { v: string }) => h('p', null, use(v, 50));
          const view = await render(h(Probe, { v: 'first' }));
          expect(view.text()).toBe('first');
        } },
        { label: 'The hook waits for a pause before updating', run: async ({ mod, h, render, expect, wait }) => {
          const use = mod.useDebouncedValue;
          const Probe = ({ v }: { v: string }) => h('p', null, use(v, 200));
          const view = await render(h(Probe, { v: 'a' }));
          await view.rerender(h(Probe, { v: 'b' }));
          expect(view.text()).toBe('a');
          await wait(450);
          expect(view.text()).toBe('b');
        } },
        { label: 'A burst of typing triggers one search, for the final text', run: async ({ mod, h, render, expect, fn, wait }) => {
          const onSearch = fn();
          const view = await render(h(comp(mod, 'SearchBox'), { onSearch, delayMs: 300 }));
          await view.type('input', 'r');
          await view.type('input', 're');
          await view.type('input', 'rea');
          expect(onSearch).toBeCalledTimes(0);
          await wait(700);
          expect(onSearch).toBeCalledTimes(1);
          expect(onSearch).toBeCalledWith('rea');
        } },
        { label: 'Never searches twice for the same text', run: async ({ mod, h, render, expect, fn, wait }) => {
          const onSearch = fn();
          const view = await render(h(comp(mod, 'SearchBox'), { onSearch, delayMs: 300 }));
          await view.type('input', 'rea');
          await wait(700);
          await view.type('input', 'reac');
          await view.type('input', 'rea');
          await wait(700);
          expect(onSearch).toBeCalledTimes(1);
        } },
        { label: 'No timers left running after unmount', run: async ({ mod, h, render, activeTimers, fn }) => {
          const view = await render(h(comp(mod, 'SearchBox'), { onSearch: fn(), delayMs: 60 }));
          await view.type('input', 'r');
          await view.unmount();
          if (activeTimers() > 0) throw new CheckFailure('A debounce timer is still running after the box was removed. Clear it in the effect cleanup.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'memoization',
      title: 'Memoization',
      system: 'Fleet Display',
      skills: ['performance', 'hooks'],
      ...codeFiles('memoization', 'tsx'),
      brief: `**ARIA:** The fleet display redraws every ship, and re-sorts the entire fleet, whenever *anything* happens. Clicking the clock, selecting a ship, breathing near the console. With four thousand ships it takes two seconds per click. The pilots have taken up knitting.`,
      lesson: `## Why React re-renders

When a component's state changes, React re-runs it **and all its children**. That's usually fine, since rendering is fast. But when a render does expensive work, or renders thousands of rows, you can skip the work that hasn't changed.

**Measure first.** Optimize the parts you can prove are slow, not everything.

## useMemo: cache a calculation

\`\`\`ts
const sorted = useMemo(() => sortShips(ships), [ships, sortShips]);
\`\`\`

The calculation runs again only when a dependency changes. Otherwise React hands back the cached result.

## memo: skip re-rendering a component

\`\`\`ts
const ShipRow = memo(function ShipRow(props) { … });
\`\`\`

A \`memo\` component skips re-rendering when its props are the **same** as last time, compared with \`Object.is\`, one prop at a time.

## useCallback: keep functions the same

There's a catch. An inline arrow, \`onSelect={(id) => setSelected(id)}\`, is a **new function on every render**, so \`memo\` sees a "changed" prop and re-renders anyway. \`useCallback\` keeps the same function between renders:

\`\`\`ts
const select = useCallback((id: string) => setSelected(id), []);
\`\`\`

(\`setSelected\` never changes, so the dependency list is empty.)

memo + stable props = skipped renders. Each one is useless without the other.`,
      hints: [
        'Wrap the sort: `const sorted = useMemo(() => sortShips(ships), [ships, sortShips]);`.',
        'Wrap the row: `export const ShipRow = memo(function ShipRow({ ... }) { ... });`.',
        'Make the handler stable: `const select = useCallback((id: string) => setSelected(id), []);` and pass `onSelect={select}`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Fleet'), { ships: FLEET, sortShips: (s: { name: string }[]) => [...s].sort((a, b) => a.name.localeCompare(b.name)) }),
      checks: [
        { label: 'Renders the fleet sorted, and selection works', run: async ({ mod, h, render, expect }) => {
          const sortShips = (s: { name: string }[]) => [...s].sort((a, b) => a.name.localeCompare(b.name));
          const view = await render(h(comp(mod, 'Fleet'), { ships: FLEET, sortShips }));
          expect(view.queryAll('li').map((li) => li.textContent)).toEqual(['Kestrel', 'Kite', 'Orion', 'Swift', 'Vega']);
          await view.click(view.getByText('Orion', 'button'));
          expect(view.get('.selected').textContent).toBe('Selected: s3');
        } },
        { label: 'An unrelated update doesn\'t re-sort', run: async ({ mod, h, render, expect, fn }) => {
          const sortShips = fn((s: { name: string }[]) => [...s].sort((a, b) => a.name.localeCompare(b.name)));
          const view = await render(h(comp(mod, 'Fleet'), { ships: FLEET, sortShips }));
          await view.click(view.getByText('Refresh clock (0)', 'button'));
          await view.click(view.getByText('Refresh clock (1)', 'button'));
          expect(sortShips).toBeCalledTimes(1);
        } },
        { label: 'New ships do re-sort', run: async ({ mod, h, render, expect, fn }) => {
          const sortShips = fn((s: { name: string }[]) => [...s]);
          const view = await render(h(comp(mod, 'Fleet'), { ships: FLEET, sortShips }));
          await view.rerender(h(comp(mod, 'Fleet'), { ships: FLEET.slice(0, 2), sortShips }));
          expect(sortShips).toBeCalledTimes(2);
        } },
        { label: 'Rows don\'t re-render when nothing about them changed', run: async ({ mod, h, render, expect, fn }) => {
          const sortShips = (s: { name: string }[]) => [...s];
          const onRowRender = fn();
          const view = await render(h(comp(mod, 'Fleet'), { ships: FLEET, sortShips, onRowRender }));
          expect(onRowRender).toBeCalledTimes(5);
          await view.click(view.getByText('Refresh clock (0)', 'button'));
          await view.click(view.getByText('Kite', 'button'));
          if (onRowRender.calls.length !== 5) {
            throw new CheckFailure(`Rows rendered ${onRowRender.calls.length - 5} extra time(s). Wrap ShipRow in memo() and keep onSelect stable with useCallback.`);
          }
        } },
      ],
    },
    {
      kind: 'code',
      id: 'accessible-form',
      title: 'Accessible Forms',
      system: 'Crew Registration',
      skills: ['a11y', 'state'],
      ...codeFiles('accessible-form', 'tsx'),
      brief: `**ARIA:** Crew registration works if you can see the screen and use a mouse. Lieutenant Osei uses a screen reader. To her, the form is two unlabelled boxes and a button that silently does nothing. That's not just unkind. In many countries it's illegal, and it's always a bug.`,
      lesson: `## Labels

Every input needs a real \`<label>\`, connected by \`htmlFor\` → \`id\`:

\`\`\`tsx
<label htmlFor="email">Email</label>
<input id="email" />
\`\`\`

Screen readers announce the label when the input is focused, and clicking the label focuses the input. A \`<p>\` that just happens to sit nearby does neither.

## Errors people can perceive

When a field is invalid:

\`\`\`tsx
<input id="email" aria-invalid="true" aria-describedby="email-error" />
<p id="email-error">Enter a valid email</p>
\`\`\`

- \`aria-invalid\` tells assistive technology the field has a problem.
- \`aria-describedby\` links the message to the field, so it's read out on focus.

## When to show errors

Shouting "Invalid!" before someone has typed anything is hostile. Common practice is to show a field's error once they've **left** it (\`onBlur\`), or tried to **submit**. Track a \`touched\` flag per field.

## Focus management

After a failed submit, move keyboard focus to the **first invalid field** with a ref: \`ref.current?.focus()\`. Keyboard and screen-reader users land right on the problem instead of hunting for it.

## Derive, don't store

Errors come straight from the values: \`const errors = validate(values)\`. Don't keep them in their own state, where they can drift out of sync.`,
      hints: [
        'Give each input an `id` and a matching `<label htmlFor>`. Keep `touched` state per field, set it in `onBlur`, and set both to true on submit.',
        'Compute the errors from the values on every render. When a field is touched and has an error, render `<p id="callsign-error">` and give the input `aria-invalid` and `aria-describedby="callsign-error"`.',
        'On submit, find the first invalid field and call `refs[field].current?.focus()`. If there are none, call `onRegister` with the trimmed values.',
      ],
      preview: (mod, h, log) => h(comp(mod, 'RegisterForm'), { onRegister: (d: unknown) => log(`onRegister(${JSON.stringify(d)})`) }),
      checks: [
        { label: 'Each input has a connected <label>', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'RegisterForm'), { onRegister: () => {} }));
          for (const id of ['callsign', 'email']) {
            const label = view.query(`label[for="${id}"]`);
            if (!label) throw new CheckFailure(`Add <label htmlFor="${id}"> for the ${id} input.`);
            if (!view.query(`input#${id}`)) throw new CheckFailure(`Give the ${id} input id="${id}".`);
          }
          expect(view.get('label[for="callsign"]').textContent).toBe('Callsign');
        } },
        { label: 'No errors before the user has done anything', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'RegisterForm'), { onRegister: () => {} }));
          expect(view.query('#callsign-error')).toBeNull();
          expect(view.get('#callsign').getAttribute('aria-invalid')).toBeNull();
        } },
        { label: 'Leaving a field shows its error, linked with ARIA', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'RegisterForm'), { onRegister: () => {} }));
          await view.type('#callsign', 'Al');
          await view.focus('#callsign');
          await view.focus('#email');
          const input = view.get('#callsign');
          expect(input.getAttribute('aria-invalid')).toBe('true');
          expect(input.getAttribute('aria-describedby')).toBe('callsign-error');
          expect(view.get('#callsign-error').textContent).toBe('Callsign must be 3–12 characters');
        } },
        { label: 'A failed submit focuses the first invalid field', run: async ({ mod, h, render, expect, fn }) => {
          const onRegister = fn();
          const view = await render(h(comp(mod, 'RegisterForm'), { onRegister }));
          await view.submit();
          expect(document.activeElement?.id).toBe('callsign');
          expect(view.get('#email-error').textContent).toBe('Enter a valid email');
          await view.type('#callsign', 'Nova');
          await view.submit();
          expect(document.activeElement?.id).toBe('email');
          expect(onRegister).toBeCalledTimes(0);
        } },
        { label: 'A valid form registers', run: async ({ mod, h, render, expect, fn }) => {
          const onRegister = fn();
          const view = await render(h(comp(mod, 'RegisterForm'), { onRegister }));
          await view.type('#callsign', ' Nova ');
          await view.type('#email', 'nova@orrery.space');
          await view.submit();
          expect(onRegister).toBeCalledWith({ callsign: 'Nova', email: 'nova@orrery.space' });
        } },
      ],
    },
    {
      kind: 'code',
      id: 'keyboard-tabs',
      title: 'Keyboard Navigation',
      system: 'Bridge Tabs',
      skills: ['a11y', 'hooks'],
      ...codeFiles('keyboard-tabs', 'tsx'),
      brief: `**ARIA:** The bridge console has tabs that only work with a mouse. In an emergency the captain uses the keyboard, because it's faster. Right now she can't. Build them to the WAI-ARIA tabs pattern: the standard that screen readers, keyboards and users already expect.`,
      lesson: `## Roles and states

ARIA attributes describe custom widgets to assistive technology:

\`\`\`tsx
<div role="tablist">
  <button role="tab" id="tab-a" aria-selected={true} aria-controls="panel-a" tabIndex={0}>A</button>
  <button role="tab" id="tab-b" aria-selected={false} aria-controls="panel-b" tabIndex={-1}>B</button>
</div>
<div role="tabpanel" id="panel-a" aria-labelledby="tab-a">…</div>
\`\`\`

## Roving tabIndex

The Tab key should move *into* the tab list and then *out* to the next thing. It shouldn't stop on every tab. So only the selected tab has \`tabIndex={0}\`, and the rest get \`-1\`. The **arrow keys** move between tabs.

## Handling keys

\`\`\`tsx
function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key === "ArrowRight") { … }
}
\`\`\`

A lookup object keeps it tidy:

\`\`\`ts
const moves: Record<string, number> = {
  ArrowRight: selected === last ? 0 : selected + 1,   // wrap around
  ArrowLeft:  selected === 0 ? last : selected - 1,
  Home: 0,
  End: last,
};
\`\`\`

## Focusing elements in a list

Keep a ref holding an **array** of elements, filled with callback refs:

\`\`\`tsx
const buttons = useRef<(HTMLButtonElement | null)[]>([]);
<button ref={(el) => { buttons.current[i] = el; }} … />
buttons.current[index]?.focus();
\`\`\``,
      hints: [
        'Add `role="tablist"` to the wrapper, and to each button `role="tab"`, `id={`tab-${tab.id}`}`, `aria-selected`, `aria-controls` and `tabIndex={i === selected ? 0 : -1}`. Give the panel `role="tabpanel"`, its `id` and `aria-labelledby`.',
        'Keep a ref array of the buttons: `useRef<(HTMLButtonElement | null)[]>([])`, filled with `ref={(el) => { buttons.current[i] = el; }}`.',
        'In `onKeyDown`, compute the new index for ArrowRight/ArrowLeft (wrapping) and Home/End, then `setSelected(index)` and `buttons.current[index]?.focus()`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Tabs'), { tabs: [
        { id: 'nav', label: 'Navigation', content: 'Course: Vega. ETA 4h.' },
        { id: 'comms', label: 'Comms', content: '3 unread transmissions.' },
        { id: 'power', label: 'Power', content: 'Reactor at 98%.' },
      ] }),
      checks: [
        { label: 'Roles and ARIA attributes', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Tabs'), { tabs: [{ id: 'a', label: 'A', content: 'Alpha' }, { id: 'b', label: 'B', content: 'Bravo' }] }));
          const tabs = view.queryAll('[role=tablist] [role=tab]');
          expect(tabs).toHaveLength(2);
          expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
          expect(tabs[0].id).toBe('tab-a');
          expect(tabs[0].getAttribute('aria-controls')).toBe('panel-a');
          const panel = view.get('[role=tabpanel]');
          expect(panel.id).toBe('panel-a');
          expect(panel.getAttribute('aria-labelledby')).toBe('tab-a');
          expect(panel.textContent).toBe('Alpha');
        } },
        { label: 'Roving tabIndex', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Tabs'), { tabs: [{ id: 'a', label: 'A', content: 'Alpha' }, { id: 'b', label: 'B', content: 'Bravo' }, { id: 'c', label: 'C', content: 'Charlie' }] }));
          expect(view.queryAll('[role=tab]').map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
          await view.click(view.queryAll('[role=tab]')[2]);
          expect(view.queryAll('[role=tab]').map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
          expect(view.get('[role=tabpanel]').textContent).toBe('Charlie');
        } },
        { label: 'Arrow keys move selection and focus, wrapping around', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Tabs'), { tabs: [{ id: 'a', label: 'A', content: 'Alpha' }, { id: 'b', label: 'B', content: 'Bravo' }, { id: 'c', label: 'C', content: 'Charlie' }] }));
          const tab = (i: number) => view.queryAll('[role=tab]')[i];
          await view.focus(tab(0));
          await view.key(tab(0), 'ArrowRight');
          expect(view.get('[role=tabpanel]').textContent).toBe('Bravo');
          expect(document.activeElement).toBe(tab(1));
          await view.key(tab(1), 'ArrowRight');
          await view.key(tab(2), 'ArrowRight');
          expect(view.get('[role=tabpanel]').textContent).toBe('Alpha');
          await view.key(tab(0), 'ArrowLeft');
          expect(view.get('[role=tabpanel]').textContent).toBe('Charlie');
          expect(document.activeElement).toBe(tab(2));
        } },
        { label: 'Home and End', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Tabs'), { tabs: [{ id: 'a', label: 'A', content: 'Alpha' }, { id: 'b', label: 'B', content: 'Bravo' }, { id: 'c', label: 'C', content: 'Charlie' }] }));
          const tab = (i: number) => view.queryAll('[role=tab]')[i];
          await view.key(tab(0), 'End');
          expect(view.get('[role=tabpanel]').textContent).toBe('Charlie');
          expect(document.activeElement).toBe(tab(2));
          await view.key(tab(2), 'Home');
          expect(view.get('[role=tabpanel]').textContent).toBe('Alpha');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'error-boundary',
      title: 'Error Boundaries',
      system: 'Bridge Widgets',
      skills: ['components', 'errors'],
      ...codeFiles('error-boundary', 'tsx'),
      brief: `**ARIA:** One weather widget had a bug. It threw an error, and React unmounted *the entire bridge*. Navigation, comms, life support displays, all gone over a weather forecast. Contain the blast.`,
      lesson: `## What happens when a component throws

If a component throws while rendering, React unmounts the **whole tree** above it, up to the root. A blank screen is safer than a corrupted one, but one broken widget shouldn't blank the entire app.

## Error boundaries

An **error boundary** catches errors from its children's rendering and shows a fallback instead:

\`\`\`tsx
class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };                    // switch to the fallback on the next render
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logToMonitoring(error);              // side effects (logging) go here
  }

  render() {
    if (this.state.error) return <p>Something broke.</p>;
    return this.props.children;
  }
}
\`\`\`

They have to be **class components** (Floor 3), because there's no hook for this yet. Most teams write one once and reuse it everywhere.

## Recovery

Offer a way out: a \`reset\` method that clears the error, so the children render again:

\`\`\`ts
reset = () => this.setState({ error: null });   // an arrow keeps \`this\`
\`\`\`

## What they don't catch

Errors in event handlers, timers and promises aren't render errors. Handle those with \`try/catch\` and state, as on the Production Deck's loading level.`,
      hints: [
        'Add state `{ error: Error | null }`, starting at null, and `static getDerivedStateFromError(error: Error) { return { error }; }`.',
        '`componentDidCatch(error: Error) { this.props.onError?.(error); }` and `reset = () => { this.setState({ error: null }); };`.',
        'In `render`: `if (this.state.error) return this.props.fallback(this.state.error, this.reset);`, otherwise the children.',
      ],
      checks: [
        { label: 'Renders children while nothing is wrong', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(mod.ErrorBoundary, { fallback: () => 'fallback' }, h('p', null, 'All systems normal')));
          expect(view.text()).toBe('All systems normal');
        } },
        { label: 'Shows the fallback when a child throws', run: async ({ mod, h, render, expect }) => {
          const Widget = () => {
            throw new Error('Weather sensor exploded');
          };
          const view = await render(h(mod.ErrorBoundary, { fallback: (e: Error) => h('p', { className: 'oops' }, e.message) }, h('div', null, h('p', null, 'Bridge'), h(Widget))));
          expect(view.get('.oops').textContent).toBe('Weather sensor exploded');
        } },
        { label: 'Reports each error once with onError', run: async ({ mod, h, render, expect, fn }) => {
          const onError = fn();
          const Widget = () => {
            throw new Error('Boom');
          };
          await render(h(mod.ErrorBoundary, { fallback: () => 'x', onError }, h(Widget)));
          expect(onError).toBeCalledTimes(1);
          expect(onError.calls[0][0].message).toBe('Boom');
        } },
        { label: 'reset() recovers once the problem is fixed', run: async ({ mod, h, render, expect }) => {
          const sensor = { broken: true };
          const Widget = () => {
            if (sensor.broken) throw new Error('Sensor offline');
            return h('p', { className: 'ok' }, 'Sunny, 21°');
          };
          const view = await render(h(mod.ErrorBoundary, { fallback: (_e: Error, reset: () => void) => h('button', { onClick: reset }, 'Retry') }, h(Widget)));
          sensor.broken = false;
          await view.click(view.getByText('Retry', 'button'));
          expect(view.get('.ok').textContent).toBe('Sunny, 21°');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'test-design',
      title: 'Writing Good Tests',
      system: 'Quality Control',
      skills: ['testing'],
      ...codeFiles('test-design', 'ts'),
      brief: `**ARIA:** You've passed a lot of tests on this station. Now you write them. Quality Control has a shipping calculator and an intern who keeps "improving" it. Your job: write test cases good enough that **every** broken version gets caught.

This is how professionals know their code works, and keeps working after the next person touches it.`,
      lesson: `## What makes a good test?

A test runs code with a chosen input and checks the output. A good **set** of tests catches bugs. And bugs cluster in predictable places:

- **Boundaries.** "50 kg or more" means you test 49 and 50 (and maybe 51). Off-by-one mistakes (\`>\` vs \`>=\`) live here.
- **Each rule on its own.** If express doubles the price, have a case where express is the *only* thing that differs.
- **Rules together.** Does the discount still apply to express shipments? Test the combination.
- **Invalid input.** If 0 should throw, test 0 and a negative number.
- **Precision.** If the answer is 94.5, a version that rounds to 95 is wrong. Pick inputs whose answers aren't whole numbers.

## Working out the expected answer

Calculate it **from the spec**, by hand, not by running the code (it might be the buggy version!):

\`\`\`
weight 50, standard: (5 + 2 × 50) × 0.9 = 94.5
\`\`\`

## Mutation testing

This level grades you the way serious teams grade their test suites: by deliberately breaking the code (**mutants**) and checking that the tests notice. A suite that still passes against broken code isn't protecting you.`,
      hints: [
        'Add a case for each rule on its own. Express: weight 10, express → 50. Just under the discount boundary: 49 → 103. Exactly on it: 50 → 94.5.',
        'Add a combination case (large and express together, e.g. 60 express → 225), and one whose answer isn\'t a whole number (to catch rounding).',
        'For `throwingWeights`, include both 0 and a negative weight.',
      ],
      checks: [
        { label: 'Every case is correct for the real calculator', run: ({ mod }) => {
          const cases = mod.cases as Case[];
          if (!Array.isArray(cases)) throw new CheckFailure('Export a cases array.');
          for (const c of cases) {
            const real = realShipping(c.weight, c.express);
            if (!same(real, c.expected)) throw new CheckFailure(`Case ${JSON.stringify(c)} is wrong: the real calculator gives ${real}. Work the expected value out from the spec.`);
          }
        } },
        { label: 'Every throwing weight really throws', run: ({ mod }) => {
          const weights = mod.throwingWeights as number[];
          if (!Array.isArray(weights) || weights.length === 0) throw new CheckFailure('Add at least one weight to throwingWeights.');
          for (const w of weights) {
            let threw = false;
            try {
              realShipping(w, false);
            } catch {
              threw = true;
            }
            if (!threw) throw new CheckFailure(`Weight ${w} is valid, so it doesn't throw. Only weights of 0 or less should be in throwingWeights.`);
          }
        } },
        ...MUTANTS.map((m) => ({
          label: `Catches the bug: ${m.name}`,
          run: ({ mod }: { mod: Record<string, unknown> }) => {
            const cases = (mod.cases as Case[]) ?? [];
            const weights = (mod.throwingWeights as number[]) ?? [];
            if (!caught(m.fn, cases, weights)) throw new CheckFailure('Every one of your tests passes against this broken version. Add a case that exposes it.');
          },
        })),
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-production',
      title: 'Production Readiness',
      system: 'Launch Review',
      skills: ['data', 'performance', 'a11y', 'testing'],
      brief: `**ARIA:** Before any feature ships, it passes launch review. These are the questions senior engineers ask in code review every day.`,
      lesson: `## The review checklist

- Network data: loading, error **and** empty states; stale responses ignored.
- Effects: cleaned up; dependencies honest.
- Performance: measure first; memo needs stable props; useMemo for expensive work, not everything.
- Accessibility: real labels, keyboard support, ARIA states, focus management.
- Tests: boundaries, each rule, combinations, invalid input.`,
      questions: [
        {
          prompt: 'A user types "a", then "ab". The "a" request is slower. What can go wrong without a cleanup?',
          code: `useEffect(() => {\n  search(query).then(setResults);\n}, [query]);`,
          options: ['Nothing: React orders the responses', 'The "a" results can arrive last and overwrite the "ab" results', 'It throws an error', 'It makes no requests'],
          answer: 1,
          explain: 'Responses can arrive in any order. Without a stale flag set in the cleanup, whichever arrives last wins, even if it\'s for an old query.',
        },
        {
          prompt: '`Row` is wrapped in `memo`, but still re-renders on every parent render. Why?',
          code: `<Row item={item} onPick={() => pick(item.id)} />`,
          options: ['memo only works on class components', 'The inline arrow is a new function every render, so the props changed', 'Rows can\'t be memoized', 'item is an object'],
          answer: 1,
          explain: 'memo compares props with `Object.is`. A new arrow each render is a "different" prop. Pass a stable `useCallback` function (and the id as a prop) instead.',
        },
        {
          prompt: 'Which of these is accessible to a screen reader?',
          options: ['<p>Email</p><input />', '<label htmlFor="em">Email</label><input id="em" />', '<input placeholder="Email" />', '<div>Email<input /></div>'],
          answer: 1,
          explain: 'Only a real label connected by `htmlFor`/`id` is reliably announced. Placeholders disappear as you type and are often not read out.',
        },
        {
          prompt: 'The spec says "orders of 100 or more ship free". Which pair of test inputs best checks the boundary?',
          options: ['0 and 1000', '99 and 100', '100 and 1000', '50 and 150'],
          answer: 1,
          explain: 'Boundary bugs (`>` vs `>=`) only show up right at the edge. 99 must not be free and 100 must be.',
        },
        {
          prompt: 'Where should error boundaries go?',
          options: ['Around every single element', 'Around independent parts of the UI, so one failure doesn\'t blank the rest', 'Only around the root', 'Error boundaries are deprecated'],
          answer: 1,
          explain: 'Wrap regions that can fail independently (a widget, a panel, a route), so a bug in one shows a fallback while the rest keeps working. A root boundary is a good last resort too.',
        },
        {
          prompt: 'A screen loads data. Which states must it handle?',
          options: ['Loaded', 'Loading and loaded', 'Loading, loaded, error and empty', 'Only error'],
          answer: 2,
          explain: 'Real networks are slow and fail, and real lists are sometimes empty. Each of those states needs designing, or users get blank screens.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'mission-dashboard',
      title: 'FINAL BOSS: Mission Control',
      system: 'Mission Control',
      boss: true,
      skills: ['data', 'state', 'a11y', 'performance', 'components'],
      ...codeFiles('mission-dashboard', 'tsx'),
      brief: `**ARIA:** This is the last system on the station, engineer. Mission Control: the dashboard every ship, crew member and cargo crate reports to. It loads from a server that can fail. It searches, filters, sorts, summarizes and shows details. It works with a keyboard. It doesn't fall over.

When you first came aboard, you didn't know what a string was. This is a real production screen. Build it.

**THE FEED:** *VIEWERS. This is it. The FINAL BOSS. Our engineer started on Floor 1 with \`console.log\`. Every sponsor is watching. Every viewer is watching. Somewhere, a former intern is quietly watching too.*`,
      lesson: `## Plan the state

Keep state **minimal**, and derive everything else during render:

| State | Why |
|---|---|
| \`load\`: loading / failed / loaded with ships | network |
| \`attempt\` | Retry |
| \`query\`, \`filter\` | user input |
| \`openId\` | which ship's details are open |

Derived, **not** stored: the visible ships (filter + search + sort), the summary count, and the open ship object.

\`\`\`ts
const visible = useMemo(() =>
  ships
    .filter((s) => (filter === "all" || s.status === filter) && s.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [ships, query, filter]);
\`\`\`

(\`.sort\` changes an array in place, but after \`.filter\` it's a fresh array, so that's safe.)

## Hooks before returns

All hooks (\`useState\`, \`useEffect\`, \`useMemo\`) must run on **every** render, in the same order. Call them all **before** any early \`return\` for the loading or error states.

## Pieces you've already built

- The loading/error/retry effect from **Loading and Error States**.
- \`aria-pressed\` on toggle buttons; an \`aria-label\` on the \`<aside>\`.
- An Escape-key handler on the panel (\`onKeyDown\`), like **Keyboard Navigation**.
- \`localeCompare\` for alphabetical sorting.`,
      hints: [
        'Start from your Loading States solution (a union state, an `attempt` counter, an `ignore` flag), then add `query`, `filter` and `openId` state. Call every hook before the early returns.',
        'Derive `visible` with `useMemo`: filter by status and by `name.toLowerCase().includes(query.trim().toLowerCase())`, then `.sort((a, b) => a.name.localeCompare(b.name))`. The summary is `{visible.length} of {ships.length} ships`.',
        'Render the filter buttons with `aria-pressed={filter === value}`. Show the `<aside aria-label="Ship details">` when `openId` matches a ship, with `onKeyDown` closing it on Escape, and a Close button.',
      ],
      preview: (mod, h) => h(comp(mod, 'MissionDashboard'), { loadShips: () => new Promise((r) => setTimeout(() => r(FLEET), 800)) }),
      typeChecks: [
        { label: 'MissionDashboard is a valid component', code: `import { MissionDashboard, type Ship } from './solution';\nconst load = async (): Promise<Ship[]> => [];\nconst a = <MissionDashboard loadShips={load} />;\n// @ts-expect-error\nconst b = <MissionDashboard />;` },
      ],
      checks: [
        { label: 'Loading, then the fleet sorted A→Z', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<typeof FLEET>();
          const view = await render(h(comp(mod, 'MissionDashboard'), { loadShips: request }));
          expect(view.get('.loading').textContent).toBe('Loading fleet…');
          calls[0].d.resolve(FLEET);
          await tick();
          expect(view.queryAll('ul button').map((b) => b.textContent)).toEqual(['Kestrel', 'Kite', 'Orion', 'Swift', 'Vega']);
          expect(view.get('.summary').textContent).toBe('5 of 5 ships');
        } },
        { label: 'Failure shows an alert, and Retry recovers', run: async ({ mod, h, render, expect }) => {
          const { request, calls } = controlled<typeof FLEET>();
          const view = await render(h(comp(mod, 'MissionDashboard'), { loadShips: request }));
          calls[0].d.reject(fixtureError('Relay down'));
          await tick();
          expect(view.get('[role=alert]').textContent).toBe('Fleet unavailable: Relay down');
          await view.click(view.getByText('Retry', 'button'));
          calls[1].d.resolve(FLEET.slice(0, 2));
          await tick();
          expect(view.get('.summary').textContent).toBe('2 of 2 ships');
        } },
        { label: 'Search is case-insensitive', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'MissionDashboard'), { loadShips: async () => FLEET }));
          await tick();
          await view.type('input', 'KE');
          expect(view.queryAll('ul button').map((b) => b.textContent)).toEqual(['Kestrel']);
          expect(view.get('.summary').textContent).toBe('1 of 5 ships');
        } },
        { label: 'Status filters, with aria-pressed', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'MissionDashboard'), { loadShips: async () => FLEET }));
          await tick();
          expect(view.getByText('All', 'button').getAttribute('aria-pressed')).toBe('true');
          await view.click(view.getByText('In flight', 'button'));
          expect(view.queryAll('ul button').map((b) => b.textContent)).toEqual(['Swift', 'Vega']);
          expect(view.getByText('In flight', 'button').getAttribute('aria-pressed')).toBe('true');
          expect(view.getByText('All', 'button').getAttribute('aria-pressed')).toBe('false');
          await view.type('input', 'k');
          expect(view.queryAll('ul button')).toHaveLength(0);
          expect(view.get('.empty').textContent).toBe('No ships match');
          expect(view.query('ul')).toBeNull();
        } },
        { label: 'Details open on click and close with Close or Escape', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'MissionDashboard'), { loadShips: async () => FLEET }));
          await tick();
          await view.click(view.getByText('Orion', 'button'));
          const aside = view.get('aside[aria-label="Ship details"]');
          expect(aside.querySelector('h3')?.textContent).toBe('Orion');
          expect(aside.querySelector('p')?.textContent).toBe('6 crew · docked');
          await view.click(view.getByText('Close', 'button'));
          expect(view.query('aside')).toBeNull();
          await view.click(view.getByText('Swift', 'button'));
          expect(view.get('aside p').textContent).toBe('2 crew · in flight');
          await view.key(view.getByText('Close', 'button'), 'Escape');
          expect(view.query('aside')).toBeNull();
        } },
        { label: 'Hooks are called before the early returns', run: ({ source }) => {
          mustUse(source, /useMemo\(/, 'Derive the visible ships with useMemo.');
        } },
      ],
    },
  ],
};
