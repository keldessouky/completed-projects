import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { code, codeFiles, comp } from './helpers';

const SENSORS = [
  { id: 'o2', name: 'Oxygen', online: true },
  { id: 'rad', name: 'Radiation', online: false },
  { id: 'grav', name: 'Gravity', online: true },
];

const CREW = [
  { id: 1, name: 'Ada', role: 'engineer', onDuty: true },
  { id: 2, name: 'Bo', role: 'pilot', onDuty: false },
  { id: 3, name: 'Cy', role: 'medic', onDuty: true },
];

export const floor7: Deck = {
  id: 'bay',
  name: 'Component Bay',
  subtitle: 'React fundamentals',
  outcome: 'You can build user interfaces from typed React components.',
  hue: 150,
  levels: [
    {
      kind: 'code',
      id: 'first-light',
      skills: ['components'],
      title: 'Your First Component',
      system: 'Status Lights',
      ...codeFiles('first-light', 'tsx'),
      brief: `**ARIA:** Welcome to the Component Bay. Every screen on this station is built with **React** — a tree of small functions called *components*, each returning a description of what to show.

The status light is dark. Give it something to say. Your component appears live in the **Preview** panel when you run it.`,
      lesson: `## Components and JSX

A **component** is a function, named with a Capital letter, that returns **JSX** — HTML-like syntax inside TypeScript:

\`\`\`tsx
export function Greeting() {
  return <p className="hello">Hello, crew</p>;
}
\`\`\`

JSX differences from HTML worth knowing on day one:
- \`className\` instead of \`class\` (\`class\` is a JavaScript keyword).
- Every tag must close: \`<br />\`, \`<img />\`.
- A component returns **one** root element. Need several? Wrap them in a fragment: \`<>…</>\`.

## Embedding values with \`{}\`

Curly braces drop back into TypeScript inside JSX:

\`\`\`tsx
const crew = 12;
return <p>Crew aboard: {crew}</p>;          // "Crew aboard: 12"
return <p>{crew > 10 ? "Full" : "Space"}</p>;
\`\`\`

Text outside braces is literal text, so \`<h1>Hi NAME</h1>\` shows the word "NAME".`,
      hints: [
        '`StatusLight` needs a `return` statement with JSX: `return <p …>ONLINE</p>;`',
        'In JSX the attribute is `className`, not `class`.',
        'In `Banner`, wrap the constant in braces: `Welcome to {STATION}`.',
      ],
      preview: (mod, h) => h('div', null, h(comp(mod, 'Banner')), h(comp(mod, 'StatusLight'))),
      typeChecks: [
        { label: 'Both are valid components', code: `import { Banner, StatusLight } from './solution';\nconst a = <StatusLight />;\nconst b = <Banner />;` },
      ],
      checks: [
        { label: 'StatusLight shows ONLINE in a <p class="status">', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'StatusLight')));
          expect(view.get('p.status').textContent).toBe('ONLINE');
        } },
        { label: 'Banner says "Welcome to Orrery" in an <h1>', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Banner')));
          expect(view.get('h1').textContent).toBe('Welcome to Orrery');
        } },
        { label: 'Banner uses the STATION constant', run: ({ source }) => {
          if (!/\{\s*STATION\s*\}/.test(code(source))) throw new CheckFailure('Put the constant inside curly braces: {STATION}.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'gauge-panel',
      skills: ['components', 'types'],
      title: 'Typed Props',
      system: 'Gauge Panel',
      ...codeFiles('gauge-panel', 'tsx'),
      brief: `**ARIA:** One gauge component, reused for fuel, oxygen, pressure… if only it knew what it was being given. Right now \`props\` is implicitly \`any\`, so a gauge passed \`value="lots"\` would cheerfully display "lots%".`,
      lesson: `## Props

Components take one argument: an object of **props** — the attributes you write where it's used.

\`\`\`tsx
<Badge name="Nova" rank={3} />
\`\`\`

Strings can be quoted; any other value goes in braces.

## Typing props

Describe the props with an interface, and **destructure** them in the parameter list. Default values work just like any function parameter:

\`\`\`tsx
interface BadgeProps {
  name: string;
  rank: number;
  title?: string; // optional
}

export function Badge({ name, rank, title = "Cadet" }: BadgeProps) {
  return <p>{title} {name}, rank {rank}</p>;
}
\`\`\`

Now every place that uses \`<Badge>\` is checked: a missing \`name\` or \`rank="3"\` is a compile error, and your editor autocompletes the props.

Props are **read-only** inputs. A component never changes its own props.`,
      hints: [
        'Write an interface with `label: string`, `value: number` and an optional `unit?: string`.',
        'Destructure in the parameter list with a default: `({ label, value, unit = "%" }: GaugeProps)`.',
        'Render the unit right after the value: `{value}{unit}`.',
      ],
      preview: (mod, h) => h('div', { className: 'preview-row' },
        h(comp(mod, 'Gauge'), { label: 'Fuel', value: 80 }),
        h(comp(mod, 'Gauge'), { label: 'Pressure', value: 101, unit: 'kPa' })),
      typeChecks: [
        { label: 'label and value are required, unit is optional', code: `import { Gauge } from './solution';\nconst a = <Gauge label="Fuel" value={80} />;\nconst b = <Gauge label="Air" value={101} unit="kPa" />;\n// @ts-expect-error\nconst c = <Gauge value={80} />;` },
        { label: 'value must be a number', code: `import { Gauge } from './solution';\n// @ts-expect-error\nconst a = <Gauge label="Fuel" value="80" />;` },
      ],
      checks: [
        { label: 'Shows the label', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Gauge'), { label: 'Fuel', value: 80 }));
          expect(view.get('.label').textContent).toBe('Fuel');
        } },
        { label: 'Unit defaults to %', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Gauge'), { label: 'Fuel', value: 80 }));
          expect(view.get('.value').textContent).toBe('80%');
        } },
        { label: 'Uses a custom unit', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Gauge'), { label: 'Pressure', value: 101, unit: 'kPa' }));
          expect(view.get('.value').textContent).toBe('101kPa');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'hull-plating',
      skills: ['components'],
      title: 'Children and Composition',
      system: 'Bridge Dashboard',
      ...codeFiles('hull-plating', 'tsx'),
      brief: `**ARIA:** The bridge dashboard is built from panels, and the panels are empty. Whatever you put inside a \`<Panel>\` is being thrown away.`,
      lesson: `## \`children\`

Whatever you nest between a component's tags arrives as a special prop called **\`children\`**:

\`\`\`tsx
<Card title="Fuel">
  <p>80%</p>       {/* ← this is Card's children */}
</Card>
\`\`\`

Type it as \`ReactNode\` — anything React can render: elements, strings, numbers, arrays, \`null\`:

\`\`\`tsx
import type { ReactNode } from "react";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
\`\`\`

## Composition

That's how React apps are built: small components **composed** into bigger ones. \`Card\` doesn't need to know what goes inside it — it just frames it.`,
      hints: [
        'Add `children: ReactNode` to Panel\'s props type, and destructure it.',
        'Render `{children}` after the `<h2>` inside the section.',
        'In `Dashboard`: `<Panel title="Power"><p>98%</p></Panel>` and the same for Air.',
      ],
      preview: (mod, h) => h(comp(mod, 'Dashboard')),
      typeChecks: [
        { label: 'Panel accepts children', code: `import { Panel } from './solution';\nconst a = <Panel title="x"><p>hi</p></Panel>;\nconst b = <Panel title="x">text</Panel>;` },
        { label: 'Panel requires a title', code: `import { Panel } from './solution';\n// @ts-expect-error\nconst a = <Panel><p>hi</p></Panel>;` },
      ],
      checks: [
        { label: 'Panel renders its title and children', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Panel'), { title: 'Comms' }, h('p', { id: 'inner' }, 'Clear')));
          expect(view.get('section.panel h2').textContent).toBe('Comms');
          expect(view.get('section.panel #inner').textContent).toBe('Clear');
        } },
        { label: 'Dashboard shows a Power panel and an Air panel', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Dashboard')));
          const titles = view.queryAll('section.panel h2').map((e) => e.textContent);
          expect(titles).toEqual(['Power', 'Air']);
        } },
        { label: 'Each panel holds its reading', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Dashboard')));
          const panels = view.queryAll('section.panel');
          expect(panels).toHaveLength(2);
          expect(panels[0].querySelector('p')?.textContent).toBe('98%');
          expect(panels[1].querySelector('p')?.textContent).toBe('Nominal');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'sensor-array',
      skills: ['components', 'iteration'],
      title: 'Lists and Keys',
      system: 'Sensor Array',
      ...codeFiles('sensor-array', 'tsx'),
      brief: `**ARIA:** The sensor array has dozens of sensors. The display shows one. Always the first one. Always "online".`,
      lesson: `## Rendering lists

JSX can render an **array** of elements. Turn data into elements with \`.map()\`:

\`\`\`tsx
const names = ["Ada", "Bo", "Cy"];
return (
  <ul>
    {names.map((n) => <li key={n}>{n}</li>)}
  </ul>
);
\`\`\`

## Keys

Every element in a list needs a **\`key\`**: a string or number that's unique among its siblings and *stable* — the same item keeps the same key across renders. React uses keys to tell which item is which when the list changes (reordering, inserting, deleting).

- ✅ An id from the data: \`key={sensor.id}\`
- ⚠️ The array index: only if the list never reorders or changes.
- ❌ \`Math.random()\`: a new key every render — React throws the element away and rebuilds it each time.

## Dynamic attributes

Any attribute can be an expression: \`className={s.online ? "online" : "offline"}\`.`,
      hints: [
        'Replace the single `<li>` with `{sensors.map((s) => …)}`.',
        'Give each `<li>` a `key={s.id}` — ids are unique and stable.',
        'Pick the class with a ternary: `className={s.online ? "online" : "offline"}`.',
      ],
      preview: (mod, h) => h(comp(mod, 'SensorList'), { sensors: SENSORS }),
      checks: [
        { label: 'One <li> per sensor, in order', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'SensorList'), { sensors: SENSORS }));
          expect(view.queryAll('ul > li').map((li) => li.textContent)).toEqual(['Oxygen', 'Radiation', 'Gravity']);
        } },
        { label: 'Online/offline classes', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'SensorList'), { sensors: SENSORS }));
          expect(view.queryAll('ul > li').map((li) => li.className)).toEqual(['online', 'offline', 'online']);
        } },
        { label: 'An empty array renders an empty list', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'SensorList'), { sensors: [] }));
          expect(view.queryAll('li')).toHaveLength(0);
        } },
        { label: 'Each item has a stable key', run: ({ source }) => {
          const src = code(source);
          if (!/key=\{/.test(src)) throw new CheckFailure('Add a key prop to each <li>, e.g. key={s.id}.');
          if (/key=\{\s*(Math\.random|index|i)\b/.test(src)) throw new CheckFailure('Use the sensor id as the key — it stays the same when the list changes.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'warning-lights',
      skills: ['components', 'logic'],
      title: 'Conditional Rendering',
      system: 'Warning Lights',
      ...codeFiles('warning-lights', 'tsx'),
      brief: `**ARIA:** The warning lights are always on — even when everything is fine — and the alert badge reads "Alerts0", which the crew has started calling "Alert Zero". It is not a calming name.`,
      lesson: `## Choosing what to render

Components are just functions, so use plain TypeScript to decide:

\`\`\`tsx
function Door({ open }: { open: boolean }) {
  if (!open) return null;          // render nothing
  return <p>The door is open</p>;
}
\`\`\`

Inside JSX, use the **ternary** for either/or:

\`\`\`tsx
<p>{docked ? "Docked" : "In flight"}</p>
\`\`\`

…and **\`&&\`** for "only if":

\`\`\`tsx
{hasMail && <span>✉</span>}
\`\`\`

## The \`0 &&\` trap

\`a && b\` evaluates to \`a\` when \`a\` is falsy. React renders \`false\`, \`null\` and \`undefined\` as nothing — but it renders the **number \`0\`** as "0":

\`\`\`tsx
{count && <b>{count}</b>}      // count = 0 → shows "0" 😬
{count > 0 && <b>{count}</b>}  // count = 0 → shows nothing ✅
\`\`\`

Make the left side of \`&&\` a real boolean.`,
      hints: [
        'Use early returns in `Alert`: `if (level === "ok") return null;`',
        'For the default message, use `??`: `{message ?? "Check systems"}`.',
        'In `AlertBadge`, compare: `count > 0 && …` — so a zero count gives `false`, which React renders as nothing.',
      ],
      preview: (mod, h) => h('div', null,
        h(comp(mod, 'AlertBadge'), { count: 0 }), ' ', h(comp(mod, 'AlertBadge'), { count: 3 }),
        h(comp(mod, 'Alert'), { level: 'ok' }),
        h(comp(mod, 'Alert'), { level: 'warn' }),
        h(comp(mod, 'Alert'), { level: 'critical', message: 'Coolant leak' })),
      checks: [
        { label: 'level "ok" renders nothing', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Alert'), { level: 'ok', message: 'All good' }));
          expect(view.container.innerHTML).toBe('');
        } },
        { label: 'level "warn" uses the default message', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Alert'), { level: 'warn' }));
          expect(view.get('p.warn').textContent).toBe('⚠ Check systems');
        } },
        { label: 'level "warn" shows a given message', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Alert'), { level: 'warn', message: 'Low oxygen' }));
          expect(view.get('p.warn').textContent).toBe('⚠ Low oxygen');
        } },
        { label: 'level "critical"', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Alert'), { level: 'critical', message: 'Coolant leak' }));
          expect(view.get('p.critical').textContent).toBe('CRITICAL: Coolant leak');
        } },
        { label: 'AlertBadge with 3 alerts', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'AlertBadge'), { count: 3 }));
          expect(view.text()).toBe('Alerts (3)');
        } },
        { label: 'AlertBadge with 0 alerts shows no "0"', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'AlertBadge'), { count: 0 }));
          expect(view.text()).toBe('Alerts');
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-jsx',
      skills: ['components'],
      title: 'JSX Inspection',
      system: 'Render Pipeline',
      brief: `**ARIA:** The render pipeline wants to be sure you can read JSX the way React does. Predict what reaches the screen.`,
      lesson: `## How React reads JSX

- JSX compiles to function calls: \`<Ship name="Kite" />\` → \`jsx(Ship, { name: "Kite" })\`.
- Lower-case tags are HTML elements; Capitalised tags are your components.
- \`false\`, \`null\`, \`undefined\` and \`true\` render nothing. \`0\` and \`""\`… \`0\` renders.
- Props flow **down**, from parent to child. A component must not modify its props.`,
      questions: [
        {
          prompt: 'What appears on screen?',
          code: `const fuel = 0;\nreturn <p>{fuel && "Fuel OK"}</p>;`,
          options: ['Nothing', '0', 'Fuel OK', 'false'],
          answer: 1,
          explain: '`0 && …` evaluates to `0`, and React renders numbers — including zero. Use `fuel > 0 && …`.',
        },
        {
          prompt: 'Why does this render a plain, unknown HTML tag instead of your component?',
          code: `function gauge() { return <meter value={0.5} />; }\nreturn <gauge />;`,
          options: ['Components must be arrow functions', 'Component names must start with a capital letter', 'It needs a key', 'Self-closing tags are not allowed'],
          answer: 1,
          explain: 'JSX treats lower-case tags as built-in HTML elements. Name it `Gauge` and write `<Gauge />`.',
        },
        {
          prompt: 'Which is the correct way to set a CSS class in JSX?',
          options: ['<div class="panel">', '<div className="panel">', '<div css="panel">', '<div style="panel">'],
          answer: 1,
          explain: '`class` is a reserved word in JavaScript, so React uses the DOM property name `className`.',
        },
        {
          prompt: 'This returns two sibling elements. What\'s the fix?',
          code: `return (\n  <h1>Bridge</h1>\n  <p>All quiet</p>\n);`,
          options: ['Return an array without keys', 'Wrap them in a fragment: <>…</>', 'Use two return statements', 'Nothing — it works'],
          answer: 1,
          explain: 'A component returns one value. A fragment `<>…</>` groups siblings without adding an extra DOM element.',
        },
        {
          prompt: 'Which `key` is the best choice for a list of crew members?',
          code: `crew.map((m, i) => <li key={???}>{m.name}</li>)`,
          options: ['i', 'm.id', 'Math.random()', 'm.name + i'],
          answer: 1,
          explain: 'A stable, unique id from the data. Indexes break when the list reorders; random keys force React to rebuild every item on every render.',
        },
        {
          prompt: 'A child component wants to change a value it received as a prop. What should happen?',
          options: ['Assign to props.value directly', 'The parent passes down a callback, and the child calls it', 'Use a global variable', 'Re-render the child with forceUpdate'],
          answer: 1,
          explain: 'Props are read-only. Data flows down; requests to change it flow **up** through callback props like `onChange`. You\'ll do exactly this in the Control Room.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'crew-roster',
      skills: ['components'],
      title: 'BOSS: Crew Roster',
      system: 'Crew Roster',
      boss: true,
      ...codeFiles('crew-roster', 'tsx'),
      brief: `**ARIA:** The last screen in the Component Bay: the crew roster. Two components, one inside the other — typed props, a list with keys, conditional rendering, a default prop and an empty state.

When this is up, the crew can finally see who's on shift.`,
      lesson: `## Putting it together

A typical React screen is a **container** that shapes data and a **presentational** component for each item:

\`\`\`tsx
function ShipRow({ ship }: { ship: Ship }) {
  return <li className={\`ship \${ship.status}\`}>{ship.name}</li>;
}

function Fleet({ ships, title = "Fleet" }: { ships: Ship[]; title?: string }) {
  const active = ships.filter((s) => s.status === "active").length;
  return (
    <section>
      <h2>{title} ({active} active)</h2>
      {ships.length === 0
        ? <p>No ships</p>
        : <ul>{ships.map((s) => <ShipRow key={s.id} ship={s} />)}</ul>}
    </section>
  );
}
\`\`\`

Notes:
- The \`key\` goes on the element **in the \`.map()\`** — here \`<ShipRow key=…>\`, not on the \`<li>\` inside it.
- Derive counts from props during render (\`filter(...).length\`). No need to store them anywhere.
- Template literals build class names: \`\`className={\`card \${role}\`}\`\`.`,
      hints: [
        '`CrewCard` returns an `<li>` with ``className={`card ${member.role}`}``, then `{!member.onDuty && <em>off duty</em>}`.',
        'In `Roster`, default the title in the parameter: `{ crew, title = "Crew" }`. Count on-duty crew with `crew.filter((m) => m.onDuty).length`.',
        'Use a ternary for the empty state: `crew.length === 0 ? <p>No crew aboard</p> : <ul>{crew.map((m) => <CrewCard key={m.id} member={m} />)}</ul>`.',
      ],
      preview: (mod, h) => h(comp(mod, 'Roster'), { crew: CREW }),
      typeChecks: [
        { label: 'CrewCard and Roster are valid, typed components', code: `import { CrewCard, Roster, type Crew } from './solution';\nconst m: Crew = { id: 1, name: 'Ada', role: 'pilot', onDuty: true };\nconst a = <CrewCard member={m} />;\nconst b = <Roster crew={[m]} />;\nconst c = <Roster crew={[]} title="Night" />;\n// @ts-expect-error\nconst d = <Roster />;` },
      ],
      checks: [
        { label: 'CrewCard shows name and role with the right classes', run: async ({ mod, h, render, expect }) => {
          const view = await render(h('ul', null, h(comp(mod, 'CrewCard'), { member: CREW[2] })));
          const li = view.get('li');
          expect(li.className).toBe('card medic');
          expect(view.get('li b').textContent).toBe('Cy');
          expect(view.get('li span').textContent).toBe('medic');
        } },
        { label: '"off duty" appears only for off-duty crew', run: async ({ mod, h, render, expect }) => {
          const on = await render(h('ul', null, h(comp(mod, 'CrewCard'), { member: CREW[0] })));
          expect(on.query('em')).toBeNull();
          const off = await render(h('ul', null, h(comp(mod, 'CrewCard'), { member: CREW[1] })));
          expect(off.get('em').textContent).toBe('off duty');
        } },
        { label: 'Roster heading counts who is on duty', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Roster'), { crew: CREW }));
          expect(view.get('h2').textContent).toBe('Crew (2/3 on duty)');
        } },
        { label: 'Roster uses a custom title', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Roster'), { crew: CREW, title: 'Night shift' }));
          expect(view.get('h2').textContent).toBe('Night shift (2/3 on duty)');
        } },
        { label: 'Roster lists every member as a card', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Roster'), { crew: CREW }));
          expect(view.queryAll('ul > li.card b').map((b) => b.textContent)).toEqual(['Ada', 'Bo', 'Cy']);
        } },
        { label: 'Empty roster shows "No crew aboard" and no list', run: async ({ mod, h, render, expect }) => {
          const view = await render(h(comp(mod, 'Roster'), { crew: [] }));
          expect(view.get('p').textContent).toBe('No crew aboard');
          expect(view.query('ul')).toBeNull();
          expect(view.get('h2').textContent).toBe('Crew (0/0 on duty)');
        } },
        { label: 'Cards in the list have keys', run: ({ source }) => {
          if (!/<CrewCard[^>]*key=/.test(code(source))) throw new CheckFailure('Put key={m.id} on the <CrewCard> inside .map().');
        } },
      ],
    },
  ],
};
