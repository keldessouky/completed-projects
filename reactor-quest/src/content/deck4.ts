import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { code, codeFiles, comp } from './helpers';

const buttonByText = (root: { getByText(t: string, s?: string): HTMLElement }, text: string) => root.getByText(text, 'button');

export const deck4: Deck = {
  id: 'control',
  name: 'Control Room',
  subtitle: 'State and events',
  hue: 35,
  levels: [
    {
      kind: 'code',
      id: 'thruster',
      title: 'useState',
      system: 'Thruster Control',
      ...codeFiles('thruster', 'tsx'),
      brief: `**ARIA:** The Control Room. Everything here *changes*: you press something, the screen responds. Or it should. The thruster panel ignores every press.

Try the buttons in the preview first. Then fix it.`,
      lesson: `## Why a plain variable doesn't work

A component is a function that React **calls** to find out what to show. When you write \`let thrust = 0\`:
1. Changing it doesn't tell React anything, so nothing re-renders.
2. Even if something else re-rendered, the function runs again from the top and \`thrust\` is \`0\` again.

## State

\`useState\` gives a component **memory** that survives re-renders, plus a function to update it. Calling the setter **schedules a re-render** with the new value:

\`\`\`tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0); // initial value
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
\`\`\`

- \`useState\` is a **hook**. Hooks are called at the top level of a component — never inside \`if\`s or loops.
- The type is inferred from the initial value: \`useState(0)\` holds a \`number\`.
- \`onClick\` takes a **function**: \`onClick={() => setCount(1)}\`, not \`onClick={setCount(1)}\` (that would call it during render).

To clamp a value: \`Math.min(10, n)\` and \`Math.max(0, n)\`.`,
      hints: [
        'Import the hook: `import { useState } from "react";`',
        'Replace the variable: `const [thrust, setThrust] = useState(0);` and call `setThrust(…)` in the handlers.',
        'Clamp it: `setThrust(Math.min(10, thrust + 1))` and `setThrust(Math.max(0, thrust - 1))`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Thruster')),
      checks: [
        { label: 'Starts at "Thrust: 0"', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          expect(view.get('p').textContent).toBe('Thrust: 0');
        } },
        { label: 'Increase raises it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          await view.click(buttonByText(view, 'Increase'));
          await view.click(buttonByText(view, 'Increase'));
          expect(view.get('p').textContent).toBe('Thrust: 2');
        } },
        { label: 'Decrease lowers it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          for (let i = 0; i < 3; i++) await view.click(buttonByText(view, 'Increase'));
          await view.click(buttonByText(view, 'Decrease'));
          expect(view.get('p').textContent).toBe('Thrust: 2');
        } },
        { label: 'Never goes below 0', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          await view.click(buttonByText(view, 'Decrease'));
          expect(view.get('p').textContent).toBe('Thrust: 0');
        } },
        { label: 'Never goes above 10', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Thruster')));
          for (let i = 0; i < 12; i++) await view.click(buttonByText(view, 'Increase'));
          expect(view.get('p').textContent).toBe('Thrust: 10');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'airlock',
      title: 'Typed State and Callbacks',
      system: 'Airlock Control',
      ...codeFiles('airlock', 'tsx'),
      brief: `**ARIA:** The airlock panel's state has no initial value — so TypeScript decided it can only ever be \`undefined\`. It's not wrong. It's just very, very literal.

The docking computer also wants to hear about every change.`,
      lesson: `## Typing state

\`useState\` infers its type from the initial value:

\`\`\`tsx
const [open, setOpen] = useState(false);   // boolean
const [name, setName] = useState("");      // string
const [x, setX] = useState();              // undefined — and only undefined!
\`\`\`

When the initial value can't describe every possible value, pass the type explicitly:

\`\`\`tsx
const [pilot, setPilot] = useState<string | null>(null);
\`\`\`

## Initial state from props

Props can seed state: \`useState(initiallyOpen)\`. The prop is only used for the **first** render — after that the state is the component's own.

## Callback props

A parent finds out about changes by passing a function down. Optional callbacks are called with \`?.()\`, which does nothing when they're \`undefined\`:

\`\`\`tsx
function toggle() {
  const next = !open;
  setOpen(next);
  onChange?.(next);
}
\`\`\`

(When the new state depends only on the old one, the **updater form** \`setOpen((o) => !o)\` is the safest choice. Here we need \`next\` for the callback too, so compute it first.)`,
      hints: [
        'Give `useState` the initial value: `useState(initiallyOpen)` — now it\'s a `boolean`.',
        'Use the state in the JSX: `Airlock is {open ? "open" : "sealed"}`, and the same idea for the button label.',
        'In `toggle`: `const next = !open; setOpen(next); onChange?.(next);`',
      ],
      preview: (mod, h, log) => h(comp(mod, 'Airlock'), { onChange: (open: boolean) => log(`onChange(${open})`) }),
      checks: [
        { label: 'Starts sealed', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Airlock')));
          expect(view.get('p.status').textContent).toBe('Airlock is sealed');
          expect(view.get('button').textContent).toBe('Open airlock');
        } },
        { label: 'Clicking opens it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Airlock')));
          await view.click('button');
          expect(view.get('p.status').textContent).toBe('Airlock is open');
          expect(view.get('button').textContent).toBe('Close airlock');
        } },
        { label: 'Clicking again seals it', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Airlock')));
          await view.click('button');
          await view.click('button');
          expect(view.get('p.status').textContent).toBe('Airlock is sealed');
        } },
        { label: 'initiallyOpen starts it open', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Airlock'), { initiallyOpen: true }));
          expect(view.get('p.status').textContent).toBe('Airlock is open');
        } },
        { label: 'onChange reports each new state', run: async ({ mod, h, render, expect, fn }) => {
          const onChange = fn();
          const view = await render(h(comp(mod, 'Airlock'), { onChange }));
          await view.click('button');
          expect(onChange).toBeCalledWith(true);
          await view.click('button');
          expect(onChange).toBeCalledWith(false);
          expect(onChange).toBeCalledTimes(2);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'callsign',
      title: 'Controlled Inputs',
      system: 'Nav Computer',
      ...codeFiles('callsign', 'tsx'),
      brief: `**ARIA:** The nav computer needs your callsign. The text box accepts typing, but the computer never sees a single letter of it.`,
      lesson: `## Controlled inputs

In React, the usual way to handle a text field is to make **state the source of truth**: the input shows the state, and every keystroke updates the state.

\`\`\`tsx
const [name, setName] = useState("");

<input value={name} onChange={(e) => setName(e.target.value)} />
\`\`\`

This is a **controlled input**. Because every change passes through your code, you can transform it, validate it, or refuse it — if you don't call \`setName\`, the input doesn't change.

## Typing events

Inline handlers get their event type inferred. For a separate function, annotate it:

\`\`\`tsx
import type { ChangeEvent } from "react";

function handleChange(event: ChangeEvent<HTMLInputElement>) {
  setName(event.target.value); // event.target: HTMLInputElement
}
\`\`\`

The type parameter says which element fired it, so \`.value\` is known to be a \`string\`.

## Derived values

Don't store what you can compute. The upper-cased version and the length come straight from \`value\` during render.`,
      hints: [
        'Type the handler: `function handleChange(event: ChangeEvent<HTMLInputElement>)` — import `ChangeEvent` as a type from "react".',
        'Wire the input: `<input aria-label="Callsign" value={value} onChange={handleChange} />`.',
        'Only accept short values: `if (next.length <= 12) setValue(next);`. Compute `value.toUpperCase()` and `value.length` in the JSX.',
      ],
      preview: (mod, h) => h(comp(mod, 'CallsignInput')),
      checks: [
        { label: 'Shows "—" and 0/12 when empty', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'CallsignInput')));
          expect(view.get('.preview').textContent).toBe('Callsign: —');
          expect(view.get('.count').textContent).toBe('0/12');
        } },
        { label: 'Typing updates the preview in upper case', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'CallsignInput')));
          await view.type('input', 'nova');
          expect(view.get('.preview').textContent).toBe('Callsign: NOVA');
          expect(view.get('.count').textContent).toBe('4/12');
        } },
        { label: 'The input is controlled by state', run: async ({ mod, h, render, expect, source }) => {
          if (!/value=\{/.test(code(source))) throw new CheckFailure('Give the <input> a value={…} from state, so React controls it.');
          const view = await render(h(comp(mod, 'CallsignInput')));
          await view.type('input', 'kite');
          expect(view.get<HTMLInputElement>('input').value).toBe('kite');
        } },
        { label: 'Refuses a 13th character', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'CallsignInput')));
          await view.type('input', 'starfarer123');
          await view.type('input', 'starfarer1234');
          expect(view.get<HTMLInputElement>('input').value).toBe('starfarer123');
          expect(view.get('.count').textContent).toBe('12/12');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'docking-form',
      title: 'Forms',
      system: 'Docking Requests',
      ...codeFiles('docking-form', 'tsx'),
      brief: `**ARIA:** Docking requests come through this form. Every time someone presses the button, the whole console reboots — that's the browser's default form behaviour, reloading the page. Also, a bay number of "3" isn't the same as bay 3. The compiler noticed. Did you?`,
      lesson: `## Submitting forms

Handle \`onSubmit\` on the \`<form>\` (not \`onClick\` on the button) so pressing Enter works too. Browsers submit a form by **reloading the page**; in a React app you almost always stop that:

\`\`\`tsx
import type { SubmitEvent } from "react";

function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
  event.preventDefault();
  // …use the state
}

<form onSubmit={handleSubmit}>
  …
  <button type="submit">Send</button>
</form>
\`\`\`

## Inputs give you strings

Even \`<input type="number">\` hands you a **string** in \`e.target.value\`. Convert where you need a number: \`Number(bay)\`.

## Validation state

An error message is just more state:

\`\`\`tsx
const [error, setError] = useState(false);
…
{error && <p role="alert">Name required</p>}
\`\`\`

\`role="alert"\` makes screen readers announce it.`,
      hints: [
        'Start `handleSubmit` with `event.preventDefault();`.',
        'Add `const [error, setError] = useState(false);` — set it when `ship.trim()` is empty and return early; render `{error && <p role="alert">Ship name required</p>}`.',
        'On success: `setError(false); onRequest(ship.trim(), Number(bay)); setShip("");`',
      ],
      preview: (mod, h, log) => h(comp(mod, 'DockingForm'), { onRequest: (ship: string, bay: number) => log(`onRequest(${JSON.stringify(ship)}, ${JSON.stringify(bay)})`) }),
      checks: [
        { label: 'Submitting doesn\'t reload the page', run: async ({ mod, h, render, fn }) => {
          const view = await render(h(comp(mod, 'DockingForm'), { onRequest: fn() }));
          await view.type('input[name=ship]', 'Kite');
          await view.submit();
        } },
        { label: 'Sends the trimmed ship name and the bay as a number', run: async ({ mod, h, render, expect, fn }) => {
          const onRequest = fn();
          const view = await render(h(comp(mod, 'DockingForm'), { onRequest }));
          await view.type('input[name=ship]', '  Kite  ');
          await view.type('input[name=bay]', '3');
          await view.submit();
          expect(onRequest).toBeCalledWith('Kite', 3);
        } },
        { label: 'Clears the ship name after a request, keeps the bay', run: async ({ mod, h, render, expect, fn }) => {
          const view = await render(h(comp(mod, 'DockingForm'), { onRequest: fn() }));
          await view.type('input[name=ship]', 'Kite');
          await view.type('input[name=bay]', '4');
          await view.submit();
          expect(view.get<HTMLInputElement>('input[name=ship]').value).toBe('');
          expect(view.get<HTMLInputElement>('input[name=bay]').value).toBe('4');
        } },
        { label: 'A blank name shows an alert and sends nothing', run: async ({ mod, h, render, expect, fn }) => {
          const onRequest = fn();
          const view = await render(h(comp(mod, 'DockingForm'), { onRequest }));
          await view.type('input[name=ship]', '   ');
          await view.submit();
          expect(onRequest).toBeCalledTimes(0);
          expect(view.get('[role=alert]').textContent).toBe('Ship name required');
        } },
        { label: 'The alert goes away after a good request', run: async ({ mod, h, render, expect, fn }) => {
          const view = await render(h(comp(mod, 'DockingForm'), { onRequest: fn() }));
          await view.submit();
          await view.type('input[name=ship]', 'Kite');
          await view.submit();
          expect(view.query('[role=alert]')).toBeNull();
        } },
      ],
    },
    {
      kind: 'code',
      id: 'ledger',
      title: 'Immutable Updates',
      system: 'Supply Ledger',
      ...codeFiles('ledger', 'tsx'),
      brief: `**ARIA:** The supply ledger adds items… sometimes. And removing one does nothing until you type something else. The quartermaster believes the ledger is haunted. It is not haunted. It is *mutating state*.`,
      lesson: `## React compares, it doesn't watch

When you call a setter, React compares the new value with the old one using \`Object.is\`. If it's the **same object**, React assumes nothing changed and skips the re-render.

\`\`\`tsx
items.push(newItem);
setItems(items);  // same array → "nothing changed" → no re-render ❌
\`\`\`

Never change state in place. Make a **new** array or object instead:

| Instead of | Write |
|---|---|
| \`items.push(x)\` | \`[...items, x]\` |
| \`items.splice(i, 1)\` | \`items.filter((it) => it.id !== id)\` |
| \`items[i].done = true\` | \`items.map((it) => it.id === id ? { ...it, done: true } : it)\` |
| \`obj.name = "x"\` | \`{ ...obj, name: "x" }\` |

The **spread** \`...\` copies everything from the old value into the new one.

## Typing array state

An empty array can't tell TypeScript what it will hold — say it explicitly: \`useState<Item[]>([])\`.`,
      hints: [
        'In `add`, build a new array: `setItems([...items, { id: nextId++, name }])`.',
        'In `remove`, `filter` returns a new array without the item: `setItems(items.filter((item) => item.id !== id))`.',
        'Trim and ignore blanks in `add`, then `setText("")`. For the total: `{items.length === 1 ? "item" : "items"}`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Ledger')),
      checks: [
        { label: 'Adds items and clears the input', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Ledger')));
          await view.type('input', 'Coolant');
          await view.click(buttonByText(view, 'Add'));
          expect(view.queryAll('li')).toHaveLength(1);
          expect(view.get<HTMLInputElement>('input').value).toBe('');
        } },
        { label: 'Ignores blank items and trims names', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Ledger')));
          await view.type('input', '   ');
          await view.click(buttonByText(view, 'Add'));
          expect(view.queryAll('li')).toHaveLength(0);
          await view.type('input', '  Rations ');
          await view.click(buttonByText(view, 'Add'));
          expect(view.get('li').firstChild?.textContent?.trim()).toBe('Rations');
        } },
        { label: 'Remove takes out exactly that item — immediately', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Ledger')));
          for (const name of ['Coolant', 'Rations', 'Fuses']) {
            await view.type('input', name);
            await view.click(buttonByText(view, 'Add'));
          }
          await view.click(view.queryAll('li')[1].querySelector('button')!);
          expect(view.queryAll('li').map((li) => li.firstChild?.textContent?.trim())).toEqual(['Coolant', 'Fuses']);
        } },
        { label: 'Total reads "0 items", "1 item", "2 items"', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Ledger')));
          expect(view.get('.total').textContent).toBe('0 items');
          await view.type('input', 'Coolant');
          await view.click(buttonByText(view, 'Add'));
          expect(view.get('.total').textContent).toBe('1 item');
          await view.type('input', 'Fuses');
          await view.click(buttonByText(view, 'Add'));
          expect(view.get('.total').textContent).toBe('2 items');
        } },
        { label: 'State is never mutated (no push / splice)', run: ({ source }) => {
          if (/\.\s*(push|splice)\s*\(/.test(code(source))) throw new CheckFailure('push/splice change the array in place. Build a new array with [...items, x] or items.filter(...).');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'shared-power',
      title: 'Lifting State Up',
      system: 'Power Distribution',
      ...codeFiles('shared-power', 'tsx'),
      brief: `**ARIA:** Power distribution has two panels: a readout and a set of controls. Each keeps its own idea of the power level. The controls say 90%. The readout says 50%. The reactor says *help*.`,
      lesson: `## One source of truth

When two components need the same changing value, neither should own it. Move the state **up** to their closest common parent, and pass it **down**:

\`\`\`tsx
function Parent() {
  const [temp, setTemp] = useState(20);
  return (
    <>
      <Display temp={temp} />                       {/* reads it */}
      <Dial onUp={() => setTemp((t) => t + 1)} />   {/* asks to change it */}
    </>
  );
}
\`\`\`

- Data flows **down** as props.
- Requests to change it flow **up** as callbacks.
- The children become simple and reusable: \`Display\` shows whatever it's given; \`Dial\` doesn't care what the number is.

## The updater form

When the next state depends on the previous one, pass a **function** to the setter. React calls it with the latest value — safe even if several updates happen at once:

\`\`\`tsx
setTemp((t) => Math.min(100, t + 10));
\`\`\``,
      hints: [
        '`Readout` should take `{ power }: { power: number }` and drop its own `useState`.',
        '`Controls` takes `onBoost` and `onVent` callbacks (both `() => void`) and passes them straight to `onClick`.',
        '`Reactor` owns `const [power, setPower] = useState(50)` and passes `onBoost={() => setPower((p) => Math.min(100, p + 10))}`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Reactor')),
      typeChecks: [
        { label: 'Readout and Controls take typed props', code: `import { Readout, Controls } from './solution';\nconst a = <Readout power={42} />;\nconst b = <Controls onBoost={() => {}} onVent={() => {}} />;\n// @ts-expect-error\nconst c = <Readout power="42" />;` },
      ],
      checks: [
        { label: 'Readout shows the power it is given', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Readout'), { power: 42 }));
          expect(view.get('.readout').textContent).toBe('Power: 42%');
        } },
        { label: 'Controls report clicks through callbacks', run: async ({ mod, h, render, expect, fn }) => {
          const onBoost = fn();
          const onVent = fn();
          const view = await render(h(comp(mod, 'Controls'), { onBoost, onVent }));
          await view.click(buttonByText(view, 'Boost'));
          await view.click(buttonByText(view, 'Vent'));
          await view.click(buttonByText(view, 'Vent'));
          expect(onBoost).toBeCalledTimes(1);
          expect(onVent).toBeCalledTimes(2);
        } },
        { label: 'Reactor: Boost raises the readout', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Reactor')));
          expect(view.get('.readout').textContent).toBe('Power: 50%');
          await view.click(buttonByText(view, 'Boost'));
          expect(view.get('.readout').textContent).toBe('Power: 60%');
        } },
        { label: 'Reactor: stays within 0–100%', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Reactor')));
          for (let i = 0; i < 8; i++) await view.click(buttonByText(view, 'Boost'));
          expect(view.get('.readout').textContent).toBe('Power: 100%');
          for (let i = 0; i < 13; i++) await view.click(buttonByText(view, 'Vent'));
          expect(view.get('.readout').textContent).toBe('Power: 0%');
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-state',
      title: 'State of Mind',
      system: 'Control Logic',
      brief: `**ARIA:** State is where most React bugs live. The control logic wants proof you know when — and how — state actually changes.`,
      lesson: `## How state updates behave

- Setting state **schedules** a re-render; it doesn't change the variable you're holding. Inside the current render, \`count\` is a constant snapshot.
- Several \`setX\` calls in one event are **batched** into one re-render.
- \`setX(x + 1)\` uses the snapshot; \`setX((x) => x + 1)\` uses the latest queued value.
- React bails out of a re-render when the new state is \`Object.is\`-equal to the old one.`,
      questions: [
        {
          prompt: 'count is 0. After one click, what does the screen show?',
          code: `<button onClick={() => {\n  setCount(count + 1);\n  setCount(count + 1);\n}}>{count}</button>`,
          options: ['0', '1', '2', 'It throws'],
          answer: 1,
          explain: '`count` is 0 throughout this render, so both calls say "set it to 1". Use `setCount((c) => c + 1)` twice to get 2.',
        },
        {
          prompt: 'count is 0. After one click, what does the screen show?',
          code: `<button onClick={() => {\n  setCount((c) => c + 1);\n  setCount((c) => c + 1);\n}}>{count}</button>`,
          options: ['0', '1', '2', '3'],
          answer: 2,
          explain: 'Updater functions are queued and each receives the result of the one before: 0 → 1 → 2.',
        },
        {
          prompt: 'name is "Ada". What gets logged when the button is clicked?',
          code: `function rename() {\n  setName("Bo");\n  console.log(name);\n}`,
          options: ['"Bo"', '"Ada"', 'undefined', 'It depends on timing'],
          answer: 1,
          explain: 'Setting state doesn\'t change the `name` constant in this render — it asks React for a new render, where `name` will be "Bo".',
        },
        {
          prompt: 'Why doesn\'t this re-render?',
          code: `crew[0].name = "Nova";\nsetCrew(crew);`,
          options: ['Strings are immutable', 'It\'s the same array, so React sees no change', 'setCrew needs a callback', 'Arrays can\'t be state'],
          answer: 1,
          explain: 'React compares old and new state by identity. Mutate-then-set passes the same array. Make a new one: `crew.map(...)` with a spread copy of the changed member.',
        },
        {
          prompt: 'Where should state live when two sibling components both need it?',
          options: ['In each sibling, kept in sync with effects', 'In their closest common parent', 'In a global variable', 'In the first sibling, read by the second'],
          answer: 1,
          explain: 'Lift it to the nearest common parent and pass it down as props. One source of truth, no syncing.',
        },
        {
          prompt: 'Which of these should **not** be stored in state?',
          code: `const [items, setItems] = useState<Item[]>([]);\nconst [count, setCount] = useState(0); // items.length`,
          options: ['items', 'count', 'both', 'neither'],
          answer: 1,
          explain: '`count` can be computed from `items` during render. Storing it twice means one day they disagree.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'checklist',
      title: 'BOSS: Launch Checklist',
      system: 'Mission Control',
      boss: true,
      ...codeFiles('checklist', 'tsx'),
      brief: `**ARIA:** Mission Control runs on one screen: the launch checklist. Add tasks, tick them off, clear the finished ones. When everything's ticked, the board lights up.

State, events, forms, immutable updates, derived values. This is the Control Room's final exam.`,
      lesson: `## Patterns for a list you can edit

\`\`\`tsx
const [tasks, setTasks] = useState<Task[]>(() =>
  initial.map((label, i) => ({ id: i + 1, label, done: false })),
);
\`\`\`

Passing a **function** to \`useState\` runs it only on the first render — handy when building the initial value takes work.

| Action | Update |
|---|---|
| add | \`setTasks([...tasks, newTask])\` |
| toggle | \`setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t))\` |
| clear done | \`setTasks(tasks.filter((t) => !t.done))\` |

**Derive** the rest during render:

\`\`\`tsx
const doneCount = tasks.filter((t) => t.done).length;
const allDone = tasks.length > 0 && doneCount === tasks.length;
\`\`\`

A checkbox is controlled with \`checked\` + \`onChange\`. A button is disabled with \`disabled={condition}\`.

A new id that can't collide: \`Math.max(0, ...tasks.map((t) => t.id)) + 1\`.`,
      hints: [
        'State: `useState<Task[]>(() => initial.map((label, i) => ({ id: i + 1, label, done: false })))` and a `text` string for the input.',
        'The form\'s `onSubmit` calls `event.preventDefault()`, trims the text, appends a task with a fresh id, and clears the input.',
        'Toggle with `map` and a spread copy; clear with `filter`; compute `doneCount` and `allDone` from `tasks` during render.',
      ],
      preview: (mod, h) => h(comp(mod, 'Checklist'), { initial: ['Seal hatches', 'Prime thrusters', 'Notify crew'] }),
      typeChecks: [
        { label: 'Checklist is a valid component with an optional initial list', code: `import { Checklist } from './solution';\nconst a = <Checklist />;\nconst b = <Checklist initial={['a']} />;\n// @ts-expect-error\nconst c = <Checklist initial={[1]} />;` },
      ],
      checks: [
        { label: 'Shows the initial tasks, none done', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['Seal hatches', 'Prime thrusters'] }));
          expect(view.queryAll('li').map((li) => li.textContent?.trim())).toEqual(['Seal hatches', 'Prime thrusters']);
          expect(view.get('.progress').textContent).toBe('0/2 complete');
          expect(view.queryAll<HTMLInputElement>('input[type=checkbox]').map((c) => c.checked)).toEqual([false, false]);
        } },
        { label: 'Ticking a task marks it done', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['Seal hatches', 'Prime thrusters'] }));
          await view.click(view.queryAll('input[type=checkbox]')[1]);
          expect(view.get('.progress').textContent).toBe('1/2 complete');
          expect(view.queryAll('li')[1].className).toBe('done');
          expect(view.queryAll<HTMLInputElement>('input[type=checkbox]')[1].checked).toBe(true);
          await view.click(view.queryAll('input[type=checkbox]')[1]);
          expect(view.get('.progress').textContent).toBe('0/2 complete');
        } },
        { label: 'Adding a task through the form', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['Seal hatches'] }));
          await view.type('input[aria-label="New task"]', '  Notify crew ');
          await view.submit('form');
          expect(view.queryAll('li').map((li) => li.textContent?.trim())).toEqual(['Seal hatches', 'Notify crew']);
          expect(view.get<HTMLInputElement>('input[aria-label="New task"]').value).toBe('');
          await view.submit('form');
          expect(view.queryAll('li')).toHaveLength(2);
        } },
        { label: '"Clear completed" removes finished tasks, and is disabled when there are none', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['A', 'B', 'C'] }));
          const clear = () => view.getByText('Clear completed', 'button') as HTMLButtonElement;
          expect(clear().disabled).toBe(true);
          await view.click(view.queryAll('input[type=checkbox]')[0]);
          await view.click(view.queryAll('input[type=checkbox]')[2]);
          expect(clear().disabled).toBe(false);
          await view.click(clear());
          expect(view.queryAll('li').map((li) => li.textContent?.trim())).toEqual(['B']);
          expect(view.get('.progress').textContent).toBe('0/1 complete');
        } },
        { label: '"All systems go" only when every task is done', run: async ({ mod, h, render, expect }) => {
          const empty = await render(h(comp(mod, 'Checklist')));
          expect(empty.query('.go')).toBeNull();
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['A', 'B'] }));
          await view.click(view.queryAll('input[type=checkbox]')[0]);
          expect(view.query('.go')).toBeNull();
          await view.click(view.queryAll('input[type=checkbox]')[1]);
          expect(view.get('.go').textContent).toBe('All systems go');
        } },
        { label: 'New tasks get unique ids (toggle after add + clear)', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Checklist'), { initial: ['A', 'B'] }));
          await view.click(view.queryAll('input[type=checkbox]')[0]);
          await view.click(view.getByText('Clear completed', 'button'));
          await view.type('input[aria-label="New task"]', 'C');
          await view.submit('form');
          await view.click(view.queryAll('input[type=checkbox]')[1]);
          expect(view.queryAll<HTMLInputElement>('input[type=checkbox]').map((c) => c.checked)).toEqual([false, true]);
        } },
      ],
    },
  ],
};
