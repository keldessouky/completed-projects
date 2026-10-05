import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { codeFiles, comp, fnOf } from './helpers';

const progressOf = (el: Element) => Number(el.getAttribute('value') ?? (el as HTMLProgressElement).value);
const button = (view: { getByText(t: string, s?: string): HTMLElement }, text: string) => view.getByText(text, 'button') as HTMLButtonElement;

export const floor9: Deck = {
  id: 'core',
  name: 'Reactor Core',
  subtitle: 'Effects, refs, reducers and context',
  outcome: 'You can wire components to timers, the DOM and shared state with hooks.',
  hue: 350,
  levels: [
    {
      kind: 'code',
      id: 'countdown',
      skills: ['effects'],
      title: 'useEffect and Cleanup',
      system: 'Ignition Countdown',
      ...codeFiles('countdown', 'tsx'),
      brief: `**ARIA:** We've reached the reactor core. These systems don't just respond to clicks — they run on **time**, talk to hardware, and remember things between renders.

First: the ignition countdown. It ticks once and freezes. And when the panel closes, its timer keeps ticking in the dark, forever.`,
      lesson: `## Effects

Rendering must be **pure**: compute JSX from props and state, nothing else. Work that reaches *outside* React — timers, subscriptions, network, the DOM — goes in an **effect**, which runs *after* the render is on screen:

\`\`\`tsx
useEffect(() => {
  const id = setTimeout(() => setLeft(left - 1), 1000);
  return () => clearTimeout(id); // cleanup
}, [left]);                       // dependencies
\`\`\`

- **Dependencies**: the effect re-runs whenever one of these values changes. \`[]\` means "only after the first render".
- **Cleanup**: the function you return runs before the effect re-runs, and when the component unmounts. Anything you start, you stop.

## Stale closures

An effect sees the values from the render that created it. With \`[]\` deps, an interval's callback captures the *first* \`left\` forever — so \`setLeft(left - 1)\` keeps setting the same number. Either list \`left\` as a dependency, or use the updater form \`setLeft((n) => n - 1)\`.

## Reacting to a value

"When \`left\` reaches 0, call \`onDone\`" is also an effect — check the value at the top of the effect and return early.`,
      hints: [
        'Put `left` in the dependency array and use `setTimeout` for one tick per effect run, so each tick schedules the next.',
        'Return a cleanup: `return () => clearTimeout(id);`',
        'At the top of the effect: `if (left <= 0) { onDone?.(); return; }` — no timer is started, so the countdown stops.',
      ],
      preview: (mod, h, log) => h(comp(mod, 'Countdown'), { from: 5, onDone: () => log('onDone()') }),
      checks: [
        { label: 'Starts at T-3', run: async ({ mod, h, render, expect }) => {
          // A slow tick: this only reads the first number, even on a busy machine.
          const view = await render(h(comp(mod, 'Countdown'), { from: 3, tickMs: 10_000 }));
          expect(view.get('.countdown').textContent).toBe('T-3');
        } },
        { label: 'Counts all the way down to T-0', run: async ({ mod, h, render, expect, wait }) => {
          const view = await render(h(comp(mod, 'Countdown'), { from: 3, tickMs: 20 }));
          await wait(300);
          expect(view.get('.countdown').textContent).toBe('T-0');
        } },
        { label: 'Stops at T-0 and calls onDone exactly once', run: async ({ mod, h, render, expect, wait, fn }) => {
          const onDone = fn();
          const view = await render(h(comp(mod, 'Countdown'), { from: 2, tickMs: 20, onDone }));
          await wait(350);
          expect(view.get('.countdown').textContent).toBe('T-0');
          expect(onDone).toBeCalledTimes(1);
        } },
        { label: 'Unmounting stops the timer', run: async ({ mod, h, render, expect, wait, activeTimers }) => {
          const view = await render(h(comp(mod, 'Countdown'), { from: 50, tickMs: 20 }));
          await wait(70);
          await view.unmount();
          if (activeTimers() > 0) throw new CheckFailure(`${activeTimers()} timer(s) still running after the countdown was removed. Return a cleanup function from the effect.`);
          expect(activeTimers()).toBe(0);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'targeting',
      skills: ['hooks'],
      title: 'useRef',
      system: 'Targeting Computer',
      ...codeFiles('targeting', 'tsx'),
      brief: `**ARIA:** Debris field ahead. The targeting computer has a "Lock on" button that should put the cursor straight into the target field — every second counts — but it's not connected to anything.`,
      lesson: `## Refs to DOM elements

React owns the DOM, but sometimes you need the actual element: to focus it, measure it, scroll it. A **ref** gives you a handle:

\`\`\`tsx
const inputRef = useRef<HTMLInputElement>(null);

<input ref={inputRef} />

inputRef.current?.focus();
\`\`\`

- The type parameter says what it will point at. It starts as \`null\` (nothing is rendered yet), so \`current\` is \`HTMLInputElement | null\` — hence \`?.\`.
- React sets \`.current\` after rendering the element, and back to \`null\` when it's removed.

## Refs vs state

A ref is also a box for any value that should **survive re-renders without causing one**: a timer id, the previous value, a counter you never display.

| | state | ref |
|---|---|---|
| survives re-renders | ✅ | ✅ |
| changing it re-renders | ✅ | ❌ |
| read during render | ✅ | avoid |

If it's on screen, it's state. If it's bookkeeping, it can be a ref.`,
      hints: [
        'Tell the ref what it holds: `useRef<HTMLInputElement>(null)`.',
        'Attach it: `<input aria-label="Target" ref={inputRef} />`.',
        '`current` may be null, so use optional chaining: `inputRef.current?.focus();`',
      ],
      preview: (mod, h) => h(comp(mod, 'Targeting')),
      checks: [
        { label: '"Lock on" focuses the target input', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Targeting')));
          (document.activeElement as HTMLElement | null)?.blur?.();
          await view.click(button(view, 'Lock on'));
          expect(document.activeElement).toBe(view.get('input'));
        } },
        { label: 'Fire counts shots', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Targeting')));
          await view.click(button(view, 'Fire'));
          await view.click(button(view, 'Fire'));
          expect(view.get('.shots').textContent).toBe('Shots: 2');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'sequencer',
      skills: ['hooks', 'narrowing'],
      title: 'useReducer',
      system: 'Ignition Sequencer',
      ...codeFiles('sequencer', 'tsx'),
      brief: `**ARIA:** The ignition sequencer has rules: prime before you ignite, only heat a running core, scram if it overheats. Scattered across a dozen \`setState\` calls, those rules got broken. Put them all in one place.`,
      lesson: `## Reducers

When the next state depends on the previous state *and* on what happened, gather every rule into one pure function — a **reducer**:

\`\`\`tsx
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add":   return { ...state, count: state.count + action.amount };
    case "reset": return { ...state, count: 0 };
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0 });
<button onClick={() => dispatch({ type: "add", amount: 5 })}>+5</button>
\`\`\`

Components **describe what happened** (\`dispatch\`); the reducer **decides what it means**.

## Typing actions

Actions are a **discriminated union** — the pattern from the Generics Lab:

\`\`\`ts
type Action =
  | { type: "add"; amount: number }
  | { type: "reset" };
\`\`\`

Now \`dispatch({ type: "add" })\` without an amount is a compile error, and inside \`case "add":\` TypeScript knows \`action.amount\` exists.

## Rules for reducers

- **Pure**: same inputs, same output. No timers, no randomness, no mutation.
- Return a **new object** for a change — or the same \`state\` to change nothing.`,
      hints: [
        "Write the action union: `{ type: 'prime' } | { type: 'ignite' } | { type: 'heat'; by: number } | { type: 'scram' }`.",
        'Switch on `action.type`. For "no change", return `state` itself. For a change, return a new object: `{ ...state, status: "priming" }`.',
        "Wire the buttons: `onClick={() => dispatch({ type: 'heat', by: 300 })}` and so on.",
      ],
      preview: (mod, h) => h(comp(mod, 'ReactorPanel')),
      typeChecks: [
        { label: 'Actions are a typed union', code: `import { reactorReducer, INITIAL } from './solution';\nreactorReducer(INITIAL, { type: 'prime' });\nreactorReducer(INITIAL, { type: 'heat', by: 10 });\n// @ts-expect-error\nreactorReducer(INITIAL, { type: 'heat' });\n// @ts-expect-error\nreactorReducer(INITIAL, { type: 'explode' });` },
      ],
      checks: [
        { label: 'prime → ignite brings the core online', run: ({ mod, expect }) => {
          const r = fnOf(mod, 'reactorReducer');
          const primed = r({ status: 'offline', temp: 0 }, { type: 'prime' });
          expect(primed).toEqual({ status: 'priming', temp: 0 });
          expect(r(primed, { type: 'ignite' })).toEqual({ status: 'online', temp: 0 });
        } },
        { label: 'Out-of-order actions change nothing', run: ({ mod, expect }) => {
          const r = fnOf(mod, 'reactorReducer');
          const offline = { status: 'offline', temp: 0 };
          expect(r(offline, { type: 'ignite' })).toBe(offline);
          expect(r(offline, { type: 'heat', by: 100 })).toBe(offline);
          const online = { status: 'online', temp: 0 };
          expect(r(online, { type: 'prime' })).toBe(online);
        } },
        { label: 'heat raises the temperature while online', run: ({ mod, expect }) => {
          const r = fnOf(mod, 'reactorReducer');
          expect(r({ status: 'online', temp: 300 }, { type: 'heat', by: 400 })).toEqual({ status: 'online', temp: 700 });
          expect(r({ status: 'online', temp: 600 }, { type: 'heat', by: 400 })).toEqual({ status: 'online', temp: 1000 });
        } },
        { label: 'Above 1000° the core scrams', run: ({ mod, expect }) => {
          const r = fnOf(mod, 'reactorReducer');
          expect(r({ status: 'online', temp: 900 }, { type: 'heat', by: 200 })).toEqual({ status: 'scrammed', temp: 0 });
        } },
        { label: 'scram works from any status', run: ({ mod, expect }) => {
          const r = fnOf(mod, 'reactorReducer');
          expect(r({ status: 'priming', temp: 0 }, { type: 'scram' })).toEqual({ status: 'scrammed', temp: 0 });
          expect(r({ status: 'online', temp: 500 }, { type: 'scram' })).toEqual({ status: 'scrammed', temp: 0 });
        } },
        { label: 'The reducer never mutates state', run: ({ mod }) => {
          const r = fnOf(mod, 'reactorReducer');
          const frozen = Object.freeze({ status: 'online', temp: 100 });
          try {
            r(frozen, { type: 'heat', by: 50 });
            r(Object.freeze({ status: 'offline', temp: 0 }), { type: 'prime' });
          } catch {
            throw new CheckFailure('The reducer tried to modify the state object. Return a new object instead: { ...state, temp }.');
          }
        } },
        { label: 'The panel buttons dispatch actions', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'ReactorPanel')));
          await view.click(button(view, 'Prime'));
          await view.click(button(view, 'Ignite'));
          await view.click(button(view, 'Heat'));
          expect(view.get('.status').textContent).toBe('online · 300°');
          await view.click(button(view, 'Scram'));
          expect(view.get('.status').textContent).toBe('scrammed · 0°');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'use-toggle',
      skills: ['hooks'],
      title: 'Custom Hooks',
      system: 'Lighting Grid',
      ...codeFiles('use-toggle', 'tsx'),
      brief: `**ARIA:** Every switch on the station re-implements the same on/off logic. Let's write it once, as a hook. The draft hook works at runtime — but its return type is a mess, and double-taps misbehave.`,
      lesson: `## Custom hooks

A **custom hook** is a function whose name starts with \`use\` and that calls other hooks. It packages stateful logic for reuse — each component that calls it gets its **own** state:

\`\`\`tsx
function useCounter(start = 0) {
  const [n, setN] = useState(start);
  const inc = () => setN((x) => x + 1);
  return [n, inc] as const;
}
\`\`\`

## Returning tuples

Return an array literal without help, and TypeScript infers an **array of a union**:

\`\`\`ts
return [on, toggle];  // (boolean | (() => void))[]
\`\`\`

Now \`const [on, toggle] = useToggle()\` gives two values that are each "boolean or function" — useless. Fix it with an explicit tuple return type, or \`as const\`:

\`\`\`ts
function useToggle(initial = false): [boolean, () => void] { … }
\`\`\`

## Updater functions, again

\`setOn(!on)\` reads \`on\` from the render that created \`toggle\`. Call \`toggle\` twice in one event and both calls see the same \`on\`. \`setOn((o) => !o)\` always flips the *latest* value.`,
      hints: [
        'Annotate the return type: `function useToggle(initial = false): [boolean, () => void]`.',
        'Inside, flip with an updater so repeated calls stack: `setOn((o) => !o)`.',
        'Nothing in `LightSwitch` needs to change — once the types are right, its destructuring just works.',
      ],
      preview: (mod, h) => h('div', { className: 'preview-row' }, h(comp(mod, 'LightSwitch'), { label: 'Deck lights' }), h(comp(mod, 'LightSwitch'), { label: 'Beacon' })),
      typeChecks: [
        { label: 'useToggle returns a [boolean, function] tuple', code: `import { useToggle } from './solution';\nfunction Test() {\n  const [on, toggle] = useToggle();\n  const b: boolean = on;\n  toggle();\n  return null;\n}` },
        { label: 'useToggle takes an optional boolean', code: `import { useToggle } from './solution';\nfunction Test() {\n  useToggle(true);\n  // @ts-expect-error\n  useToggle('yes');\n  return null;\n}` },
      ],
      checks: [
        { label: 'LightSwitch toggles ON and OFF', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'LightSwitch'), { label: 'Bay' }));
          expect(view.get('button').textContent).toBe('Bay: OFF');
          await view.click('button');
          expect(view.get('button').textContent).toBe('Bay: ON');
          expect(view.get('button').className).toBe('switch on');
        } },
        { label: 'useToggle(true) starts on', run: async ({ mod, h, render, expect }) => {
          const useToggle = fnOf(mod, 'useToggle');
          function Probe() {
            const [on] = useToggle(true);
            return h('p', null, on ? 'on' : 'off');
          }
          const view = await render(h(Probe));
          expect(view.text()).toBe('on');
        } },
        { label: 'Each component gets its own state', run: async ({ mod, h, render, expect }) => {
          const view = await render(h('div', null, h(comp(mod, 'LightSwitch'), { label: 'A' }), h(comp(mod, 'LightSwitch'), { label: 'B' })));
          await view.click(view.queryAll('button')[0]);
          expect(view.queryAll('button').map((b) => b.textContent)).toEqual(['A: ON', 'B: OFF']);
        } },
        { label: 'Calling toggle twice in one event flips twice', run: async ({ mod, h, render, expect }) => {
          const useToggle = fnOf(mod, 'useToggle');
          function Probe() {
            const [on, toggle] = useToggle();
            return h('button', { onClick: () => { toggle(); toggle(); } }, on ? 'on' : 'off');
          }
          const view = await render(h(Probe));
          await view.click('button');
          expect(view.text()).toBe('off');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'theme-context',
      skills: ['hooks'],
      title: 'Context',
      system: 'Station Lighting',
      ...codeFiles('theme-context', 'tsx'),
      brief: `**ARIA:** Night cycle. Every screen on the station should dim together — but the theme would have to be passed as a prop through forty layers of components that don't care about it. There's a better way.`,
      lesson: `## Context

**Context** lets a component provide a value to *everything* below it, at any depth, without passing props through each layer.

\`\`\`tsx
// 1. Create it, with a type. null = "no provider above me".
const UserContext = createContext<User | null>(null);

// 2. Provide it (React 19: the context itself is the provider).
<UserContext value={currentUser}>
  <App />
</UserContext>

// 3. Read it anywhere below.
const user = useContext(UserContext);
\`\`\`

(Before React 19 you'd write \`<UserContext.Provider value={…}>\` — you'll see both.)

## Provider components and a safe hook

The usual pattern: a component that owns the state and provides it, plus a hook that reads it and **throws** when used outside the provider — turning a confusing \`null\` bug into a clear error:

\`\`\`tsx
export function useUser(): User {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside a UserProvider");
  return user; // narrowed: User, not User | null
}
\`\`\`

When the provided value changes, every component reading it re-renders. Context is for values many components need: theme, current user, language.`,
      hints: [
        'In `ThemeProvider`: `const [theme, setTheme] = useState<Theme>("day")`, a `toggle` that flips it, and return `<ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>`.',
        '`useTheme`: `const value = useContext(ThemeContext); if (!value) throw new Error("…ThemeProvider…"); return value;`',
        '`Screen` and `ThemeButton` each call `useTheme()` and use `theme` / `toggle`.',
      ],
      preview: (mod, h) => h(comp(mod, 'ThemeProvider'), null,
        h(comp(mod, 'Screen'), null, h('p', null, 'Deck 7 — corridor lighting'), h(comp(mod, 'ThemeButton')))),
      checks: [
        { label: 'Starts in day mode', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'ThemeProvider'), null, h(comp(mod, 'Screen'), null, h(comp(mod, 'ThemeButton')))));
          expect(view.get('.screen').className).toBe('screen day');
          expect(view.get('button').textContent).toBe('Switch to night');
        } },
        { label: 'The button switches every screen', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'ThemeProvider'), null,
            h(comp(mod, 'Screen'), null, 'A'), h(comp(mod, 'Screen'), null, 'B'), h(comp(mod, 'ThemeButton'))));
          await view.click('button');
          expect(view.queryAll('.screen').map((s) => s.className)).toEqual(['screen night', 'screen night']);
          expect(view.get('button').textContent).toBe('Switch to day');
          await view.click('button');
          expect(view.get('.screen').className).toBe('screen day');
        } },
        { label: 'Works through layers that pass no props', run: async ({ mod, h, render, expect }) => {
          const Layer = ({ children }: { children?: unknown }) => h('div', { className: 'layer' }, children as never);
          const view = await render(h(comp(mod, 'ThemeProvider'), null, h(Layer, null, h(Layer, null, h(Layer, null, h(comp(mod, 'ThemeButton')), h(comp(mod, 'Screen'), null, 'deep'))))));
          await view.click('button');
          expect(view.get('.screen').className).toBe('screen night');
        } },
        { label: 'useTheme outside a ThemeProvider throws a helpful error', run: async ({ mod, h, render }) => {
          let error: unknown;
          try {
            await render(h(comp(mod, 'ThemeButton')));
          } catch (e) {
            error = e;
          }
          if (!error) throw new CheckFailure('ThemeButton rendered without a provider. useTheme should throw when the context is null.');
          if (!/ThemeProvider/.test(String((error as Error).message ?? error))) throw new CheckFailure(`It threw, but the message doesn't mention ThemeProvider: "${(error as Error).message}"`);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'generic-list',
      skills: ['generics', 'components'],
      title: 'Generic Components',
      system: 'Universal Display',
      ...codeFiles('generic-list', 'tsx'),
      brief: `**ARIA:** One list component displays crew, ships, cargo — anything. Which is why its props are typed \`any\`, and why last week it displayed "undefined" for every crew member when someone typed \`m.nmae\`.

Components are functions. Functions can be generic.`,
      lesson: `## Generic components

A component can take a type parameter, exactly like a function. TypeScript infers it from the props you pass:

\`\`\`tsx
interface SelectProps<T> {
  options: T[];
  label: (option: T) => string;
  onPick: (option: T) => void;
}

function Select<T>({ options, label, onPick }: SelectProps<T>) {
  return (
    <div>
      {options.map((o) => (
        <button key={label(o)} onClick={() => onPick(o)}>{label(o)}</button>
      ))}
    </div>
  );
}

<Select options={ships} label={(s) => s.name} onPick={dock} />
//                         ↑ s: Ship — inferred from \`options\`
\`\`\`

The relationship is the point: whatever \`items\` holds, \`render\` and \`keyOf\` receive. A typo inside \`render\` is now caught where it's written.

## Render props

Passing a function that returns JSX (\`render={(m) => <b>{m.name}</b>}\`) lets the *caller* decide how each item looks while the component handles the structure.`,
      hints: [
        'Make the props interface generic: `interface ListProps<T> { items: T[]; keyOf: (item: T) => string | number; render: (item: T) => ReactNode; … }`.',
        'Make the component generic too: `export function List<T>({ … }: ListProps<T>)`.',
        "Handle the empty state first: `if (items.length === 0) return <p className=\"empty\">{empty}</p>;`",
      ],
      preview: (mod, h) => h('div', null,
        h(comp(mod, 'List'), { items: [{ id: 1, name: 'Kite' }, { id: 2, name: 'Swift' }], keyOf: (s: { id: number }) => s.id, render: (s: { name: string }) => `🚀 ${s.name}` }),
        h(comp(mod, 'List'), { items: [], keyOf: String, render: String, empty: 'No cargo' })),
      typeChecks: [
        { label: 'render and keyOf get the item type', code: `import { List } from './solution';\nconst crew = [{ id: 1, name: 'Ada' }];\nconst a = <List items={crew} keyOf={(m) => m.id} render={(m) => m.name.toUpperCase()} />;` },
        { label: 'Typos in render are caught', code: `import { List } from './solution';\nconst crew = [{ id: 1, name: 'Ada' }];\n// @ts-expect-error\nconst a = <List items={crew} keyOf={(m) => m.id} render={(m) => m.nmae} />;` },
        { label: 'Item types flow through', code: `import { List } from './solution';\n// @ts-expect-error\nconst a = <List items={[1, 2]} keyOf={(n) => n} render={(n) => n.toUpperCase()} />;` },
      ],
      checks: [
        { label: 'Renders each item with its key function', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'List'), { items: [{ id: 1, name: 'Kite' }, { id: 2, name: 'Swift' }], keyOf: (s: { id: number }) => s.id, render: (s: { name: string }) => s.name }));
          expect(view.queryAll('ul.list > li').map((li) => li.textContent)).toEqual(['Kite', 'Swift']);
        } },
        { label: 'render can return JSX', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'List'), { items: ['a'], keyOf: (s: string) => s, render: (s: string) => h('b', null, s) }));
          expect(view.get('li b').textContent).toBe('a');
        } },
        { label: 'Empty list shows the default message', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'List'), { items: [], keyOf: String, render: String }));
          expect(view.get('p.empty').textContent).toBe('Nothing here');
          expect(view.query('ul')).toBeNull();
        } },
        { label: 'Empty list shows a custom message', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'List'), { items: [], keyOf: String, render: String, empty: 'No cargo' }));
          expect(view.get('p.empty').textContent).toBe('No cargo');
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-effects',
      skills: ['effects', 'hooks'],
      title: 'Effect Horizon',
      system: 'Core Diagnostics',
      brief: `**ARIA:** One last diagnostic before the core. Effects are where React meets the outside world, and where the subtlest bugs hide.`,
      lesson: `## Effect rules of thumb

- Effects run **after** the render is committed to the screen.
- Deps \`[a, b]\`: re-run when \`a\` or \`b\` changes. \`[]\`: once after mount. No array: after **every** render.
- Cleanup runs before the next run and on unmount.
- In development, React's Strict Mode mounts components **twice** on purpose, to flush out effects that forget to clean up.
- If you can calculate something during render, you don't need an effect for it.`,
      questions: [
        {
          prompt: 'When does this effect run?',
          code: `useEffect(() => {\n  document.title = \`\${unread} new messages\`;\n}, [unread]);`,
          options: ['Before every render', 'After the first render, and after any render where unread changed', 'Only once', 'Every time any state changes'],
          answer: 1,
          explain: 'Effects run after rendering. The dependency array limits re-runs to renders where `unread` is different from last time.',
        },
        {
          prompt: 'What\'s wrong with this?',
          code: `useEffect(() => {\n  const id = setInterval(poll, 1000);\n}, []);`,
          options: ['setInterval isn\'t allowed in effects', 'Nothing', 'No cleanup: the interval keeps running after unmount', 'It needs poll in a ref'],
          answer: 2,
          explain: 'Return `() => clearInterval(id)`. Without it, the interval outlives the component — and in Strict Mode you\'ll see two of them.',
        },
        {
          prompt: 'Which of these does NOT need an effect?',
          options: ['Subscribing to a WebSocket', 'Computing fullName from firstName and lastName', 'Starting a timer', 'Focusing an input after it appears'],
          answer: 1,
          explain: 'Derived values are computed during render: `const fullName = first + " " + last;`. An effect would cause an extra render with a stale value first.',
        },
        {
          prompt: 'Changing a ref\'s `.current`…',
          options: ['re-renders the component', 're-renders the whole app', 'does not cause a re-render', 'throws in Strict Mode'],
          answer: 2,
          explain: 'Refs are mutable boxes React doesn\'t watch. That\'s what makes them right for bookkeeping — and wrong for anything shown on screen.',
        },
        {
          prompt: 'You call useState inside an `if`. What happens?',
          code: `if (isAdmin) {\n  const [log, setLog] = useState<string[]>([]);\n}`,
          options: ['It works only for admins', 'React matches hooks by call order, so it breaks when isAdmin changes', 'It\'s a TypeScript error', 'Nothing special'],
          answer: 1,
          explain: 'React identifies each hook by the order it\'s called in. Hooks must run unconditionally, at the top level, in the same order every render.',
        },
        {
          prompt: 'Which value does every component under this provider receive?',
          code: `<ThemeContext value="night">\n  <ThemeContext value="day">\n    <Screen />\n  </ThemeContext>\n</ThemeContext>`,
          options: ['"night"', '"day"', 'Both, as an array', 'The default from createContext'],
          answer: 1,
          explain: 'useContext reads the **nearest** provider above the component. Nesting providers is how you override a value for one subtree.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'core-reboot',
      skills: ['hooks', 'effects', 'state'],
      title: 'FINAL BOSS: Core Reboot',
      system: 'Reactor Core',
      boss: true,
      ...codeFiles('core-reboot', 'tsx'),
      brief: `**ARIA:** This is it, engineer. The reactor core console. Charge the core, authorize ignition, bring Orrery Station back to life.

Typed props, a reducer for the phase machine, an effect with a timer that cleans up after itself, a controlled input, derived state for the buttons, and a callback to tell the rest of the station.

The authorization code is **REACT**. Of course it is.`,
      lesson: `## A state machine in a reducer

When several values must stay consistent — here \`phase\` and \`charge\` — a reducer with typed actions makes illegal states unrepresentable:

\`\`\`ts
type Phase = "idle" | "charging" | "ready" | "online";
type Action = { type: "begin" } | { type: "tick" } | { type: "abort" } | { type: "ignite" };
\`\`\`

Each \`case\` checks the current phase and either moves on or returns \`state\` unchanged.

## An effect that follows the phase

Start the timer only while charging; the cleanup stops it the moment the phase changes:

\`\`\`tsx
useEffect(() => {
  if (phase !== "charging") return;
  const id = setInterval(() => dispatch({ type: "tick" }), chargeMs / 10);
  return () => clearInterval(id);
}, [phase, chargeMs]);
\`\`\`

\`dispatch\` is stable — it never changes — so it doesn't need to be a dependency.

## Derived conditions

\`\`\`tsx
const authorized = code.trim().toUpperCase() === "REACT";
<button disabled={phase !== "ready" || !authorized}>Ignite</button>
\`\`\`

A \`<progress value={charge} max={100} />\` draws the charge bar.`,
      hints: [
        'State: `useReducer` over `{ phase: Phase; charge: number }` with actions begin / tick / abort / ignite, plus `useState("")` for the code.',
        'The `tick` case adds 10 (capped at 100) and switches to "ready" at 100. The effect runs an interval only while `phase === "charging"`, and returns `() => clearInterval(id)`.',
        'Disable buttons with derived conditions: Begin `phase !== "idle"`, Abort `phase !== "charging"`, Ignite `phase !== "ready" || !authorized`. Ignite dispatches and calls `onOnline?.()`.',
      ],
      preview: (mod, h, log) => h(comp(mod, 'CoreConsole'), { onOnline: () => log('onOnline() — the station is restored!') }),
      typeChecks: [
        { label: 'CoreConsole takes optional chargeMs and onOnline', code: `import { CoreConsole } from './solution';\nconst a = <CoreConsole />;\nconst b = <CoreConsole chargeMs={500} onOnline={() => {}} />;\n// @ts-expect-error\nconst c = <CoreConsole chargeMs="fast" />;` },
      ],
      checks: [
        { label: 'Starts idle, with only "Begin charge" enabled', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 100 }));
          expect(view.get('.phase').textContent).toBe('Phase: idle');
          expect(progressOf(view.get('progress'))).toBe(0);
          expect(button(view, 'Begin charge').disabled).toBe(false);
          expect(button(view, 'Abort').disabled).toBe(true);
          expect(button(view, 'Ignite').disabled).toBe(true);
        } },
        { label: 'Begin charge → charging; Abort → back to idle at 0', run: async ({ mod, h, render, expect, wait }) => {
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 1000 }));
          await view.click(button(view, 'Begin charge'));
          expect(view.get('.phase').textContent).toBe('Phase: charging');
          expect(button(view, 'Begin charge').disabled).toBe(true);
          await wait(250);
          expect(progressOf(view.get('progress'))).toBeGreaterThan(0);
          await view.click(button(view, 'Abort'));
          expect(view.get('.phase').textContent).toBe('Phase: idle');
          expect(progressOf(view.get('progress'))).toBe(0);
        } },
        { label: 'Charges to 100 and becomes ready, then stops its timer', run: async ({ mod, h, render, expect, wait, activeTimers }) => {
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 100 }));
          await view.click(button(view, 'Begin charge'));
          await wait(400);
          expect(view.get('.phase').textContent).toBe('Phase: ready');
          expect(progressOf(view.get('progress'))).toBe(100);
          if (activeTimers() > 0) throw new CheckFailure('The core is ready but a timer is still running. Clean up the interval when charging ends.');
        } },
        { label: 'Ignite needs the authorization code', run: async ({ mod, h, render, expect, wait }) => {
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 100 }));
          await view.click(button(view, 'Begin charge'));
          await wait(400);
          expect(button(view, 'Ignite').disabled).toBe(true);
          await view.type('input', 'reboot');
          expect(button(view, 'Ignite').disabled).toBe(true);
          await view.type('input', '  react ');
          expect(button(view, 'Ignite').disabled).toBe(false);
        } },
        { label: 'The code alone isn\'t enough while idle', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 100 }));
          await view.type('input', 'REACT');
          expect(button(view, 'Ignite').disabled).toBe(true);
        } },
        { label: 'Ignite brings the core online and reports it once', run: async ({ mod, h, render, expect, wait, fn }) => {
          const onOnline = fn();
          const view = await render(h(comp(mod, 'CoreConsole'), { chargeMs: 100, onOnline }));
          await view.click(button(view, 'Begin charge'));
          await wait(400);
          await view.type('input', 'REACT');
          await view.click(button(view, 'Ignite'));
          expect(view.get('.phase').textContent).toBe('Phase: online');
          expect(view.get('.restored').textContent).toBe('Core online. Station restored.');
          expect(onOnline).toBeCalledTimes(1);
          expect(button(view, 'Ignite').disabled).toBe(true);
        } },
      ],
    },
  ],
};
