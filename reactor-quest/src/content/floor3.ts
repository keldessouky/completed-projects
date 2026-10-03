import type { Deck } from '../game/types';
import { CheckFailure, wait } from '../engine/runtime';
import { codeFiles, fixtureError, fnOf, mustNotUse, mustUse } from './helpers';

/**
 * A fake remote API for the async levels: answers after a short delay, can
 * fail on purpose ("throw"), and records how many requests were in flight at
 * once and in what order they were made — so checks can tell sequential from
 * parallel code.
 */
function fakeApi(answers: Record<string, string>, delay = 15) {
  const stats = { calls: [] as string[], inFlight: 0, maxInFlight: 0 };
  const api = async (id: string) => {
    stats.calls.push(id);
    stats.inFlight++;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    await wait(delay);
    stats.inFlight--;
    if (answers[id] === 'throw') throw fixtureError(`${id} is not responding`);
    return answers[id] ?? 'unknown';
  };
  return { api, stats };
}

const RAWS = [
  '  NOVA|3|Docking at bay 7  ',
  'KITE | 5 | Requesting fuel',
  'garbled transmission',
  'VEGA|x|Hello',
  'ORION|5|All clear',
];

export const floor3: Deck = {
  id: 'modern',
  name: 'Modern Systems',
  subtitle: 'Modern JavaScript, errors and async',
  outcome: 'You write JavaScript the way professionals do: concise, safe with missing data, error-aware and asynchronous.',
  hue: 45,
  levels: [
    {
      kind: 'code',
      id: 'arrow-callbacks',
      title: 'Functions as Values',
      system: 'Signal Processor',
      skills: ['functions', 'modern'],
      ...codeFiles('arrow-callbacks', 'ts'),
      brief: `**ARIA:** Floor 3: Modern Systems. This is where the station's newest code lives, and modern code passes functions around like notes in a classroom. The signal processor takes a list of readings and *whatever transformation you hand it*.`,
      lesson: `## Functions are values

In JavaScript a function is a value, just like a number or a string. You can:

\`\`\`ts
// store one in a variable (an arrow function in a const)
const double = (n: number) => n * 2;

// pass one into another function
[1, 2, 3].map(double);              // [2, 4, 6]

// return one from a function
function makeAdder(amount: number) {
  return (n: number) => n + amount;
}
const addTen = makeAdder(10);
addTen(5);                          // 15
\`\`\`

A function you pass into another function is called a **callback**. You've been writing them since \`.map\`.

## Arrow function shapes

\`\`\`ts
const square = (n: number) => n * n;            // one expression: returned automatically
const shout = (s: string) => {                  // a block: needs return
  const loud = s.toUpperCase();
  return loud + "!";
};
\`\`\`

## Function types

\`(n: number) => number\` is the **type** of "a function that takes a number and returns a number". Use it for parameters that are functions:

\`\`\`ts
function applyTwice(n: number, fn: (x: number) => number): number {
  return fn(fn(n));
}
\`\`\``,
      hints: [
        'Replace the `triple` function with `export const triple = (n: number): number => n * 3;`.',
        '`applyAll` can simply be `return values.map(fn);`: `map` calls `fn` on every value.',
        '`makeMultiplier` returns a new arrow that remembers `factor`: `return (n) => n * factor;`',
      ],
      checks: [
        { label: 'triple(4) is 12', run: ({ mod, expect }) => expect(fnOf(mod, 'triple')(4)).toBe(12) },
        { label: 'triple is an arrow function in a const', run: ({ source }) => mustUse(source, /export\s+const\s+triple\s*=\s*\(/, 'Write triple as: export const triple = (n: number) => …') },
        { label: 'applyAll calls the function on every value', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'applyAll')([1, 2, 3], (n: number) => n + 100)).toEqual([101, 102, 103]);
          expect(fnOf(mod, 'applyAll')([], (n: number) => n)).toEqual([]);
        } },
        { label: 'makeMultiplier builds multipliers', run: ({ mod, expect }) => {
          const times5 = fnOf(mod, 'makeMultiplier')(5);
          const times2 = fnOf(mod, 'makeMultiplier')(2);
          expect(times5(3)).toBe(15);
          expect(times2(3)).toBe(6);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'destructuring',
      title: 'Destructuring',
      system: 'ID Badge Printer',
      skills: ['modern', 'objects'],
      ...codeFiles('destructuring', 'ts'),
      brief: `**ARIA:** The badge printer types \`member.name\`, \`member.role\` and \`member.rank\` so many times its keyboard has worn smooth. Modern JavaScript has a shortcut for unpacking values. You'll see it in nearly every professional codebase.`,
      lesson: `## Destructuring objects

Pull properties out into variables of the same name:

\`\`\`ts
const ship = { name: "Kite", crew: 4 };
const { name, crew } = ship;     // name = "Kite", crew = 4
\`\`\`

It works directly in a function's parameter list, which you'll see constantly in React:

\`\`\`ts
function label({ name, crew }: { name: string; crew: number }) {
  return \`\${name} (\${crew})\`;
}
\`\`\`

## Destructuring arrays

Arrays unpack by **position**:

\`\`\`ts
const [first, second] = ["Kite", "Swift", "Vega"];   // "Kite", "Swift"
\`\`\`

## The rest

\`...\` collects whatever's left into a new array (or object):

\`\`\`ts
const [head, ...rest] = ["Kite", "Swift", "Vega"];   // "Kite", ["Swift", "Vega"]
\`\`\`

## Defaults and optional properties

\`rank?: string\` in a type means the property might be missing. In that case it's \`undefined\`. Destructuring can supply a default:

\`\`\`ts
const { rank = "Crew" } = member;
\`\`\`

## Building objects back up

When a variable has the same name as the property, write it once:

\`\`\`ts
return { next, waiting };   // same as { next: next, waiting: waiting }
\`\`\``,
      hints: [
        'Destructure in the parameter: `export function badge({ name, role, rank }: CrewMember): string`. Use a ternary to put the rank in front when it exists.',
        '`swap`: `const [a, b] = pair; return [b, a];`',
        '`nextInQueue`: `const [next, ...waiting] = queue; return { next, waiting };`',
      ],
      checks: [
        { label: 'badge without a rank', run: ({ mod, expect }) => expect(fnOf(mod, 'badge')({ name: 'Ada', role: 'engineer' })).toBe('Ada — engineer') },
        { label: 'badge with a rank', run: ({ mod, expect }) => expect(fnOf(mod, 'badge')({ name: 'Ada', role: 'engineer', rank: 'Lt.' })).toBe('Lt. Ada — engineer') },
        { label: 'swap', run: ({ mod, expect }) => expect(fnOf(mod, 'swap')([1, 2])).toEqual([2, 1]) },
        { label: 'nextInQueue', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'nextInQueue')(['Kite', 'Swift', 'Vega'])).toEqual({ next: 'Kite', waiting: ['Swift', 'Vega'] });
          expect(fnOf(mod, 'nextInQueue')([])).toEqual({ next: undefined, waiting: [] });
        } },
        { label: 'Uses destructuring', run: ({ source }) => {
          mustUse(source, /badge\(\s*\{/, 'Destructure badge\'s parameter: badge({ name, role, rank }: CrewMember).');
          mustUse(source, /\[\s*\w+\s*,\s*\.\.\.\w+\s*\]\s*=/, 'Use [first, ...rest] = queue to split the queue.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'spread-rest',
      title: 'Spread and Rest',
      system: 'Config Manager',
      skills: ['modern', 'objects', 'arrays'],
      ...codeFiles('spread-rest', 'ts'),
      brief: `**ARIA:** The config manager has a habit: when you ask for a changed copy of something, it changes the original. Last Tuesday someone asked to *preview* a lower oxygen setting. We don't talk about last Tuesday.

Professional code avoids changing data it was handed. **Spread** makes that easy.`,
      lesson: `## Spread: copy and extend

\`...\` in front of an array or object **spreads** its contents into a new one:

\`\`\`ts
const crew = ["Ada", "Bo"];
const bigger = [...crew, "Cy"];          // ["Ada", "Bo", "Cy"]: crew is unchanged

const ship = { name: "Kite", fuel: 40 };
const fuelled = { ...ship, fuel: 100 };   // { name: "Kite", fuel: 100 }: ship is unchanged
\`\`\`

Later properties win, so this is how you **merge** objects:

\`\`\`ts
const final = { ...defaults, ...overrides };
\`\`\`

## Why not just change it?

If two parts of a program share an object and one of them changes it, the other is surprised. That's a whole category of bug. Making a **new** value instead ("immutable updates") avoids it. React depends on this completely. You'll see why on Floor 8.

## Spreading into arguments

\`\`\`ts
Math.max(...[3, 9, 4]);    // same as Math.max(3, 9, 4) → 9
\`\`\`

## Rest parameters

In a parameter list, \`...\` does the opposite: it **collects** any number of arguments into an array:

\`\`\`ts
function total(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
total(1, 2, 3);   // nums is [1, 2, 3]
\`\`\``,
      hints: [
        '`addToRoster`: `return [...roster, name];`. `withFuel`: `return { ...ship, fuel };`.',
        '`settings`: spread the defaults first, then the overrides, so the overrides win: `{ ...defaults, ...overrides }`.',
        'Make `highest` take a rest parameter, `(...readings: number[])`, and spread it into `Math.max(...readings)`.',
      ],
      typeChecks: [
        { label: 'highest takes any number of arguments', code: `import { highest } from './solution';\nconst a: number = highest(3, 9, 4);\nconst b: number = highest();` },
      ],
      checks: [
        { label: 'addToRoster returns a new array and leaves the old one alone', run: ({ mod, expect }) => {
          const roster = ['Ada', 'Bo'];
          expect(fnOf(mod, 'addToRoster')(roster, 'Cy')).toEqual(['Ada', 'Bo', 'Cy']);
          expect(roster).toEqual(['Ada', 'Bo']);
        } },
        { label: 'withFuel returns a new ship and leaves the old one alone', run: ({ mod, expect }) => {
          const ship = { name: 'Kite', fuel: 40 };
          expect(fnOf(mod, 'withFuel')(ship, 100)).toEqual({ name: 'Kite', fuel: 100 });
          expect(ship).toEqual({ name: 'Kite', fuel: 40 });
        } },
        { label: 'settings: overrides win, defaults fill the gaps', run: ({ mod, expect }) => {
          const defaults = { volume: 50, theme: 'dark', alerts: true };
          expect(fnOf(mod, 'settings')(defaults, { theme: 'light' })).toEqual({ volume: 50, theme: 'light', alerts: true });
          expect(fnOf(mod, 'settings')(defaults, { volume: 0, alerts: false })).toEqual({ volume: 0, theme: 'dark', alerts: false });
          expect(defaults).toEqual({ volume: 50, theme: 'dark', alerts: true });
        } },
        { label: 'highest(3, 9, 4) is 9', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'highest')(3, 9, 4)).toBe(9);
          expect(fnOf(mod, 'highest')(-2)).toBe(-2);
        } },
        { label: 'Copies with spread instead of changing things', run: ({ source }) => {
          mustNotUse(source, /\.push\(|ship\.fuel\s*=[^=]/, 'Make new values with spread (...) instead of changing the ones you were given.');
          mustUse(source, /\.\.\./, 'Use the spread operator (...).');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'optional-chaining',
      title: 'Missing Data',
      system: 'Flight Records',
      skills: ['modern', 'objects'],
      ...codeFiles('optional-chaining', 'ts'),
      brief: `**ARIA:** Flight records are full of gaps. Ships with no pilot, pilots with no license, ships with no cargo manifest. Every gap crashes the records system. Also, the volume setting of every muted ship has been reset to 50. They were muted for a *reason*.`,
      lesson: `## Reading through gaps: \`?.\`

Reading a property of \`undefined\` crashes the program:

\`\`\`ts
ship.pilot.name   // 💥 TypeError, if ship.pilot is undefined
\`\`\`

**Optional chaining** \`?.\` checks first. If the left side is \`null\` or \`undefined\`, the whole expression stops and gives \`undefined\` instead of crashing:

\`\`\`ts
ship.pilot?.name                // the name, or undefined
ship.pilot?.license?.level      // chains as deep as you like
ship.cargo?.length              // works for methods and arrays too
\`\`\`

TypeScript knows which properties are optional (the \`?\` in \`pilot?:\`) and **won't let you forget the check**. That's what the red squiggles in the starter are telling you.

## Fallbacks: \`??\`

The **nullish coalescing** operator gives a fallback only when the left side is \`null\` or \`undefined\`:

\`\`\`ts
ship.pilot?.name ?? "unassigned"
\`\`\`

## \`||\` vs \`??\`

\`||\` falls back for **any** "falsy" value: \`false\`, \`0\`, \`""\`, \`null\`, \`undefined\`. That's a trap when 0 or "" are real values:

\`\`\`ts
const volume = 0;          // muted, on purpose
volume || 50               // 50  ✖ unmuted the ship!
volume ?? 50               // 0   ✔
\`\`\`

Rule of thumb: use \`??\` for defaults.`,
      hints: [
        'Add `?.` wherever a property might be missing: `ship.pilot?.name`.',
        'Then supply fallbacks with `??`: `ship.pilot?.name ?? "unassigned"`, `ship.pilot?.license?.level ?? 0`, `ship.cargo?.length ?? 0`.',
        'For `volume`, swap `||` for `??`, so that a real 0 is kept.',
      ],
      checks: [
        { label: 'pilotName', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'pilotName')({ name: 'Kite', pilot: { name: 'Nova' } })).toBe('Nova');
          expect(fnOf(mod, 'pilotName')({ name: 'Kite' })).toBe('unassigned');
        } },
        { label: 'licenseLevel through two gaps', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'licenseLevel')({ name: 'Kite', pilot: { name: 'Nova', license: { level: 3 } } })).toBe(3);
          expect(fnOf(mod, 'licenseLevel')({ name: 'Kite', pilot: { name: 'Nova' } })).toBe(0);
          expect(fnOf(mod, 'licenseLevel')({ name: 'Kite' })).toBe(0);
        } },
        { label: 'cargoCount', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'cargoCount')({ name: 'Kite', cargo: ['a', 'b'] })).toBe(2);
          expect(fnOf(mod, 'cargoCount')({ name: 'Kite', cargo: [] })).toBe(0);
          expect(fnOf(mod, 'cargoCount')({ name: 'Kite' })).toBe(0);
        } },
        { label: 'volume keeps a real 0', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'volume')({ name: 'Kite', volume: 0 })).toBe(0);
          expect(fnOf(mod, 'volume')({ name: 'Kite', volume: 80 })).toBe(80);
          expect(fnOf(mod, 'volume')({ name: 'Kite' })).toBe(50);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'closures',
      title: 'Closures',
      system: 'Serial Number Forge',
      skills: ['functions', 'modern'],
      ...codeFiles('closures', 'ts'),
      brief: `**ARIA:** The serial number forge gives every new ship an id. It has given every ship the id "SHIP". Every ship. There are forty ships called SHIP. Docking control has resorted to describing them by colour.

You need functions that **remember** things between calls.`,
      lesson: `## Closures

When a function is created inside another function, it keeps access to the outer function's variables, even after the outer function has returned. This is called a **closure**:

\`\`\`ts
function makeCounter() {
  let count = 0;                 // lives on, privately
  return () => {
    count++;
    return count;
  };
}

const a = makeCounter();
a();   // 1
a();   // 2

const b = makeCounter();         // a brand-new count, separate from a's
b();   // 1
\`\`\`

Nothing outside can touch \`count\` directly. Only the returned function can. That makes closures a way to keep **private state**.

## Returning several functions

Return an object of functions that share the same private variable:

\`\`\`ts
function makeWallet() {
  let balance = 0;
  return {
    deposit: (n: number) => { balance += n; },
    balance: () => balance,
  };
}
\`\`\`

## Where you'll see this

Closures are everywhere in real code: event handlers, timers, and every React component you'll write. React's hooks are built on them.`,
      hints: [
        '`makeCounter`: put `let count = 0;` before the return, and make `increment` do `count++; return count;`.',
        '`makeIdGenerator`: keep `let n = 0;` outside the returned arrow. Inside: ``n++; return `${prefix}-${n}`;``.',
        '`once`: keep `let called = false;` and `let result = 0;`. On the first call, set `called = true` and `result = fn()`. Always `return result`.',
      ],
      checks: [
        { label: 'makeCounter counts', run: ({ mod, expect }) => {
          const c = fnOf(mod, 'makeCounter')();
          expect(c.increment()).toBe(1);
          expect(c.increment()).toBe(2);
          expect(c.current()).toBe(2);
        } },
        { label: 'Each counter is independent', run: ({ mod, expect }) => {
          const a = fnOf(mod, 'makeCounter')();
          const b = fnOf(mod, 'makeCounter')();
          a.increment();
          a.increment();
          expect(b.increment()).toBe(1);
          expect(a.current()).toBe(2);
        } },
        { label: 'makeIdGenerator', run: ({ mod, expect }) => {
          const ship = fnOf(mod, 'makeIdGenerator')('SHIP');
          const crate = fnOf(mod, 'makeIdGenerator')('CRATE');
          expect(ship()).toBe('SHIP-1');
          expect(ship()).toBe('SHIP-2');
          expect(crate()).toBe('CRATE-1');
        } },
        { label: 'once runs the function only the first time', run: ({ mod, expect, fn }) => {
          const setup = fn(() => 42);
          const init = fnOf(mod, 'once')(setup);
          expect(init()).toBe(42);
          expect(init()).toBe(42);
          expect(init()).toBe(42);
          expect(setup).toBeCalledTimes(1);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'string-methods',
      title: 'Text Processing',
      system: 'Nameplate Engraver',
      skills: ['output', 'modern'],
      ...codeFiles('string-methods', 'ts'),
      brief: `**ARIA:** The nameplate engraver turns human-written names into tidy codes. Humans type names with extra spaces, capitals in odd places, and numbers where letters should be. The engraver panics. Teach it some string methods.`,
      lesson: `## String methods

| Method | Example | Result |
|---|---|---|
| \`.trim()\` | \`"  hi  ".trim()\` | \`"hi"\` |
| \`.toLowerCase()\` / \`.toUpperCase()\` | \`"Deck".toUpperCase()\` | \`"DECK"\` |
| \`.split(sep)\` | \`"a b c".split(" ")\` | \`["a", "b", "c"]\` |
| \`.padStart(len, ch)\` | \`"7".padStart(3, "0")\` | \`"007"\` |
| \`.includes(text)\` | \`"Deck 7".includes("7")\` | \`true\` |
| \`.replaceAll(a, b)\` | \`"a-b-c".replaceAll("-", " ")\` | \`"a b c"\` |
| \`[i]\` | \`"Ada"[0]\` | \`"A"\` |

And on arrays, \`.join(sep)\` glues strings back together: \`["a", "b"].join("-")\` → \`"a-b"\`.

## Chaining

Each string method returns a **new** string (strings never change in place), so you can chain them:

\`\`\`ts
"  Deck 7 ".trim().toLowerCase().split(" ").join("_")   // "deck_7"
\`\`\`

## Text ↔ numbers

\`\`\`ts
Number("42")      // 42
Number(" 42 ")    // 42  (spaces around a number are fine)
Number("abc")     // NaN, "Not a Number"
String(7)         // "7"
\`\`\`

Splitting, cleaning and converting text is a huge part of real programming. Data almost never arrives in the shape you want.`,
      hints: [
        '`slugify`: `title.trim().toLowerCase().split(" ").join("-")`.',
        '`initials`: split on spaces, `.map((part) => part[0].toUpperCase())`, then `.join("")`. `bayCode`: `String(n).padStart(3, "0")`.',
        '`parseCoordinates`: `text.split(",").map((part) => Number(part.trim()))`, then destructure into `[x, y]` and return it.',
      ],
      checks: [
        { label: 'slugify', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'slugify')('  Deck 7 Galley ')).toBe('deck-7-galley');
          expect(fnOf(mod, 'slugify')('BRIDGE')).toBe('bridge');
        } },
        { label: 'initials', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'initials')('Ada Okafor')).toBe('AO');
          expect(fnOf(mod, 'initials')('Bo')).toBe('B');
          expect(fnOf(mod, 'initials')('nova kale ray')).toBe('NKR');
        } },
        { label: 'bayCode', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'bayCode')(7)).toBe('BAY-007');
          expect(fnOf(mod, 'bayCode')(42)).toBe('BAY-042');
          expect(fnOf(mod, 'bayCode')(120)).toBe('BAY-120');
        } },
        { label: 'parseCoordinates', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'parseCoordinates')('12, 40')).toEqual([12, 40]);
          expect(fnOf(mod, 'parseCoordinates')('-3,7')).toEqual([-3, 7]);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'errors',
      title: 'Errors',
      system: 'Fuel Gauges',
      skills: ['errors'],
      ...codeFiles('errors', 'ts'),
      brief: `**ARIA:** The fuel gauges read whatever the sensors send them. Sometimes the sensors send "42.5". Sometimes they send "-8". Once, memorably, "banana". The gauges believed every one of them.

Good code doesn't trust its input. It checks, and when something's wrong it says so, loudly and clearly.`,
      lesson: `## Throwing errors

When a function can't do its job, it can **throw** an error. That stops the function immediately:

\`\`\`ts
function withdraw(balance: number, amount: number): number {
  if (amount > balance) {
    throw new Error("Insufficient funds");
  }
  return balance - amount;
}
\`\`\`

An uncaught error stops the whole program. That's better than carrying on with garbage, but you usually want to handle it.

## Catching errors

\`try { … } catch { … }\` runs the risky code, and if anything inside it throws, jumps to the \`catch\` block instead of crashing:

\`\`\`ts
try {
  const left = withdraw(10, 50);
  console.log(left);           // skipped: withdraw threw
} catch (error) {
  console.log("Couldn't withdraw");
}
\`\`\`

Write \`catch (error)\` when you want to look at the error (\`error.message\`), or just \`catch\` when you don't.

## Not a Number

\`Number("banana")\` doesn't throw. It quietly gives \`NaN\`, which then spreads through every calculation. Check for it with \`Number.isNaN(value)\`. (\`value === NaN\` is *always* false, even when the value is NaN. Yes, really.)

Also, \`Number("")\` is \`0\`, not NaN. Empty text is worth checking for separately.

## Throw early, catch where you can act

Validate input as soon as it arrives and throw with a **clear message**. Catch the error where you can actually do something useful about it.`,
      hints: [
        '`parseFuel`: `const value = Number(text);`, then `if (text.trim() === "" || Number.isNaN(value) || value < 0)` throw ``new Error(`Invalid fuel reading: ${text}`)``.',
        '`safeParseFuel`: `try { return parseFuel(text); } catch { return null; }`',
        '`parseBatch`: loop through the texts, call `safeParseFuel`, and push into `ok` or `failed` depending on whether you got `null`.',
      ],
      checks: [
        { label: 'parseFuel reads good numbers', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'parseFuel')('42.5')).toBe(42.5);
          expect(fnOf(mod, 'parseFuel')('0')).toBe(0);
        } },
        { label: 'parseFuel throws on nonsense, with the right message', run: ({ mod }) => {
          for (const bad of ['banana', '-8', '']) {
            let message = '';
            try {
              fnOf(mod, 'parseFuel')(bad);
            } catch (e) {
              message = (e as Error).message;
            }
            if (message !== `Invalid fuel reading: ${bad}`) {
              throw new CheckFailure(message ? `For "${bad}" the error message was "${message}"` : `parseFuel("${bad}") should throw, but it returned a value`);
            }
          }
        } },
        { label: 'safeParseFuel gives null instead of throwing', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'safeParseFuel')('banana')).toBeNull();
          expect(fnOf(mod, 'safeParseFuel')('12')).toBe(12);
        } },
        { label: 'parseBatch sorts good from bad', run: ({ mod, expect }) => expect(fnOf(mod, 'parseBatch')(['10', 'oops', '5', '-1'])).toEqual({ ok: [10, 5], failed: ['oops', '-1'] }) },
        { label: 'Uses throw and try/catch', run: ({ source }) => {
          mustUse(source, /throw\s+new\s+Error/, 'Throw an Error when the reading is invalid.');
          mustUse(source, /try\s*\{/, 'Catch the error with try { … } catch { … }.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'classes',
      title: 'Classes',
      system: 'Fuel Tanks',
      skills: ['objects', 'modern'],
      ...codeFiles('classes', 'ts'),
      brief: `**ARIA:** Each fuel tank is an object with rules. It can't go over capacity, and it can't go below empty. Right now anyone can reach in and set \`tank.level = 9000\`. Someone did. The tank is now a crater.

A **class** bundles data together with the only functions allowed to change it.`,
      lesson: `## Classes

A **class** is a blueprint for making objects that have both data and behaviour:

\`\`\`ts
class Counter {
  private count = 0;                        // a property, hidden from outside

  constructor(public readonly name: string) {}   // runs when you write new Counter(...)

  add(n: number): number {                  // a method
    this.count += n;                        // \`this\` is the object the method was called on
    return this.count;
  }

  get value(): number {                     // a getter: read like a property, no ()
    return this.count;
  }
}

const clicks = new Counter("clicks");       // make an object from the blueprint
clicks.add(2);
clicks.value;                               // 2
clicks.name;                                // "clicks"
clicks.count = 99;                          // ✖ compile error: count is private
\`\`\`

## The keywords

- \`new ClassName(...)\` creates an object (an **instance**) and runs the \`constructor\`.
- \`private\`: only code inside the class can read or change it. This protects the rules.
- \`public readonly\` in the constructor's parameters creates a property that anyone can read and nobody can change.
- \`get name()\`: a computed property.

## When to use a class

Use a class when some data has **rules** about how it may change: only through methods that enforce them. Modern JavaScript often uses closures and plain objects instead, but you'll meet classes in libraries everywhere, and in React's error boundaries on Floor 10.`,
      hints: [
        'Replace `level = 0;` with a private property, e.g. `private amount = 0;`, and add `get level() { return this.amount; }`.',
        '`fill`: `this.amount = Math.min(this.capacity, this.amount + amount); return this.amount;`',
        '`drain` checks first: `if (amount > this.amount) throw new Error("Not enough fuel");`. `percent`: `Math.round((this.amount / this.capacity) * 100)`.',
      ],
      typeChecks: [
        { label: 'The level is private: it can be read but not set', code: `import { FuelTank } from './solution';\nconst t = new FuelTank(100);\nconst l: number = t.level;\n// @ts-expect-error\nt.level = 50;` },
      ],
      checks: [
        { label: 'A new tank starts empty', run: ({ mod, expect }) => {
          const Tank = mod.FuelTank;
          if (typeof Tank !== 'function') throw new CheckFailure('Export the FuelTank class.');
          const t = new Tank(200);
          expect(t.level).toBe(0);
          expect(t.capacity).toBe(200);
        } },
        { label: 'fill adds fuel, up to capacity', run: ({ mod, expect }) => {
          const t = new mod.FuelTank(200);
          expect(t.fill(150)).toBe(150);
          expect(t.fill(150)).toBe(200);
          expect(t.level).toBe(200);
        } },
        { label: 'drain removes fuel', run: ({ mod, expect }) => {
          const t = new mod.FuelTank(200);
          t.fill(100);
          expect(t.drain(30)).toBe(70);
        } },
        { label: 'drain throws when there isn\'t enough — and changes nothing', run: ({ mod, expect }) => {
          const t = new mod.FuelTank(200);
          t.fill(20);
          let message = '';
          try {
            t.drain(50);
          } catch (e) {
            message = (e as Error).message;
          }
          expect(message).toBe('Not enough fuel');
          expect(t.level).toBe(20);
        } },
        { label: 'percent', run: ({ mod, expect }) => {
          const t = new mod.FuelTank(300);
          t.fill(100);
          expect(t.percent).toBe(33);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'async-await',
      title: 'Async and Await',
      system: 'Remote Telemetry',
      skills: ['async'],
      ...codeFiles('async-await', 'ts'),
      brief: `**ARIA:** The remote telemetry system asks distant stations how they're doing. Answers take time to arrive. The current code doesn't wait for them, so it reports the status of every station as "core". That is not a status. That is the name of the station.

This is the last big JavaScript idea, and the one every web app depends on: code that **waits**.`,
      lesson: `## Promises

Asking a server something takes time. Freezing everything while waiting would be terrible, so slow operations return a **Promise**: a placeholder for a value that will arrive later. A promise either **resolves** with a value, or **rejects** with an error.

## async / await

Inside an \`async\` function, \`await\` pauses *that function* until the promise settles, then hands you the value. The rest of the program keeps running in the meantime:

\`\`\`ts
async function report(api: (id: string) => Promise<string>): Promise<string> {
  const status = await api("core");   // wait for the answer…
  return \`core is \${status}\`;          // …then carry on
}
\`\`\`

- An \`async\` function **always** returns a Promise. \`Promise<string>\` means "a string, later".
- To get its result, the caller also has to \`await\` it.

## Several at once: Promise.all

Awaiting in a loop asks **one at a time**: three 1-second requests take 3 seconds. Usually you want to ask everyone at once:

\`\`\`ts
const results = await Promise.all(ids.map((id) => api(id)));   // ~1 second total
\`\`\`

\`Promise.all\` takes an array of promises and resolves to an array of results, **in the same order**.

But sometimes one-at-a-time is exactly right: when each answer decides whether to ask the next. Then a \`for…of\` loop with \`await\` is the tool.

## Errors

A rejected promise makes \`await\` **throw**, so plain \`try/catch\` handles it:

\`\`\`ts
try {
  const s = await api("core");
} catch {
  // the request failed
}
\`\`\`

(Inside \`try\`, write \`return await …\`. Without the \`await\`, the error escapes the \`try\`.)`,
      hints: [
        '`statusLine`: ``const status = await api(id); return `${id}: ${status}`;``',
        '`allStatuses`: `return Promise.all(ids.map((id) => api(id)));`. `safeStatusLine`: wrap `return await statusLine(id, api);` in try/catch, returning ``\`${id}: offline\` `` from the catch.',
        '`firstHealthy`: `for (const id of ids) { if ((await api(id)) === "ok") return id; }` then `return null;`',
      ],
      checks: [
        { label: 'statusLine waits for the answer', run: async ({ mod, expect }) => {
          const { api } = fakeApi({ core: 'ok' });
          expect(await fnOf(mod, 'statusLine')('core', api)).toBe('core: ok');
        } },
        { label: 'allStatuses keeps the order', run: async ({ mod, expect }) => {
          const { api } = fakeApi({ a: 'ok', b: 'fault', c: 'ok' });
          expect(await fnOf(mod, 'allStatuses')(['a', 'b', 'c'], api)).toEqual(['ok', 'fault', 'ok']);
        } },
        { label: 'allStatuses asks everyone at once', run: async ({ mod }) => {
          const { api, stats } = fakeApi({ a: 'ok', b: 'ok', c: 'ok', d: 'ok' });
          await fnOf(mod, 'allStatuses')(['a', 'b', 'c', 'd'], api);
          if (stats.maxInFlight < 4) throw new CheckFailure(`Only ${stats.maxInFlight} request(s) were in flight at a time. Start them all, then wait with Promise.all.`);
        } },
        { label: 'safeStatusLine survives a failure', run: async ({ mod, expect }) => {
          const { api } = fakeApi({ core: 'throw', pump: 'ok' });
          expect(await fnOf(mod, 'safeStatusLine')('core', api)).toBe('core: offline');
          expect(await fnOf(mod, 'safeStatusLine')('pump', api)).toBe('pump: ok');
        } },
        { label: 'firstHealthy asks in order and stops at the first "ok"', run: async ({ mod, expect }) => {
          const { api, stats } = fakeApi({ a: 'fault', b: 'ok', c: 'ok' });
          expect(await fnOf(mod, 'firstHealthy')(['a', 'b', 'c'], api)).toBe('b');
          expect(stats.calls).toEqual(['a', 'b']);
          expect(stats.maxInFlight).toBe(1);
        } },
        { label: 'firstHealthy gives null when nobody is healthy', run: async ({ mod, expect }) => {
          const { api } = fakeApi({ a: 'fault' });
          expect(await fnOf(mod, 'firstHealthy')(['a'], api)).toBeNull();
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-modern',
      title: 'Modern JavaScript',
      system: 'Systems Review',
      skills: ['modern', 'async'],
      brief: `**ARIA:** Before the Comms Decoder, a review of the trickiest parts of modern JavaScript: the bits that catch out people with years of experience.`,
      lesson: `## Quick reference

- \`?.\` stops at \`null\`/\`undefined\`; \`??\` falls back only for \`null\`/\`undefined\`; \`||\` falls back for any falsy value (\`0\`, \`""\`, \`false\`…).
- Spread makes **shallow** copies: nested objects are still shared.
- Closures capture variables, not snapshots of their values.
- \`async\` functions return promises; \`await\` unwraps them; \`Promise.all\` runs things in parallel.`,
      questions: [
        {
          prompt: 'What does this print?',
          code: `const settings = { volume: 0 };\nconsole.log(settings.volume || 50, settings.volume ?? 50);`,
          options: ['0 0', '50 50', '50 0', '0 50'],
          answer: 2,
          explain: '`0 || 50` falls back because 0 is falsy. `0 ?? 50` keeps the 0, because 0 is not null or undefined.',
        },
        {
          prompt: 'What does this print?',
          code: `const a = { name: "Kite", tags: ["fast"] };\nconst b = { ...a };\nb.name = "Swift";\nb.tags.push("new");\nconsole.log(a.name, a.tags.length);`,
          options: ['Kite 1', 'Swift 2', 'Kite 2', 'Swift 1'],
          answer: 2,
          explain: 'Spread copies one level deep. `name` was copied, but `tags` is the *same array* in both objects, so pushing to `b.tags` changes `a.tags` too. To be safe, copy nested arrays as well: `{ ...a, tags: [...a.tags] }`.',
        },
        {
          prompt: 'What is `x`?',
          code: `const [x, ...y] = [10, 20, 30];`,
          options: ['[10]', '10', '[10, 20, 30]', '30'],
          answer: 1,
          explain: 'Array destructuring takes the first item into `x`. `...y` collects the rest: `[20, 30]`.',
        },
        {
          prompt: 'What does `getStatus()` return, if `api()` resolves to "ok"?',
          code: `async function getStatus() {\n  const s = await api();\n  return s;\n}`,
          options: ['"ok"', 'A Promise that resolves to "ok"', 'undefined', 'A function'],
          answer: 1,
          explain: 'An `async` function always returns a Promise. To get "ok" out, the caller writes `await getStatus()`.',
        },
        {
          prompt: 'Three requests each take 1 second. Roughly how long does this take?',
          code: `await Promise.all([api("a"), api("b"), api("c")]);`,
          options: ['1 second', '3 seconds', '0 seconds', 'It depends on the order'],
          answer: 0,
          explain: 'All three start immediately and run at the same time, so the wait is as long as the slowest one. Awaiting them one by one in a loop would take 3 seconds.',
        },
        {
          prompt: 'What does this print?',
          code: `function make() {\n  let n = 0;\n  return () => ++n;\n}\nconst f = make();\nconst g = make();\nf(); f();\nconsole.log(g());`,
          options: ['3', '1', '2', '0'],
          answer: 1,
          explain: 'Each call to `make()` creates its own private `n`. `f` has counted to 2, but `g` is a separate closure starting from 0, so it returns 1.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'comms-decoder',
      title: 'BOSS: Comms Decoder',
      system: 'Long-Range Comms',
      boss: true,
      skills: ['async', 'errors', 'modern', 'functions'],
      ...codeFiles('comms-decoder', 'ts'),
      brief: `**ARIA:** Long-range comms are receiving transmissions from every ship in the sector. Half of them are garbled, all of them are in different languages, and the translator is slow. Parse, validate, translate in parallel, rank. The whole modern JavaScript toolkit, in one pipeline.

Clear this, and you've finished the JavaScript floors. After this, you choose your **class**.

**THE FEED:** *Ladies, gentlemen and sentient gas clouds: the Comms Decoder! Three engineers have tried. Two are now in marketing.*`,
      lesson: `## Pipelines

Real programs are pipelines: data comes in messy, and each step cleans, checks or transforms it before handing it on:

\`\`\`
raw text → parse (may throw) → collect good + count bad → translate (async, parallel) → store → report
\`\`\`

Write **each step as its own small function**, and test it on its own. Then the final function just connects them:

\`\`\`ts
export async function processBatch(raws, translate) {
  const { messages, corrupt } = decodeAll(raws);
  const translated = await translateAll(messages, translate);
  …
}
\`\`\`

## async inside map

\`map\` with an \`async\` callback gives you an array of **promises**, which is exactly what \`Promise.all\` wants:

\`\`\`ts
await Promise.all(messages.map(async (m) => ({ ...m, body: await translate(m.body) })));
\`\`\`

Note the spread: you build **new** message objects rather than changing the originals.

## Checklist

- \`parseTransmission\`: trim → split("|") → trim each part → check there are 3 → \`Number(priority)\` → check for NaN (and for an empty priority).
- \`decodeAll\`: try/catch around each parse.
- \`makeInbox\`: a closure over a private array.
- \`processBatch\`: connect everything; \`top()?.from ?? "nobody"\`.`,
      hints: [
        '`parseTransmission`: `const parts = raw.trim().split("|").map((p) => p.trim());`. Throw if `parts.length !== 3`, destructure `[from, priorityText, body]`, then throw if `Number.isNaN(Number(priorityText))`.',
        '`decodeAll` loops with try/catch, pushing good messages and counting failures. `translateAll` uses `Promise.all(messages.map(async (m) => ({ ...m, body: await translate(m.body) })))`.',
        '`makeInbox` keeps `const stored: Message[] = []`. `top()` keeps the best so far using `>` (so ties keep the first). `processBatch` returns `{ count: inbox.count(), corrupt, topFrom: inbox.top()?.from ?? "nobody" }`.',
      ],
      checks: [
        { label: 'parseTransmission cleans and converts', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'parseTransmission')(RAWS[0])).toEqual({ from: 'NOVA', priority: 3, body: 'Docking at bay 7' });
          expect(fnOf(mod, 'parseTransmission')(RAWS[1])).toEqual({ from: 'KITE', priority: 5, body: 'Requesting fuel' });
        } },
        { label: 'parseTransmission rejects corrupt input', run: ({ mod }) => {
          for (const bad of [RAWS[2], RAWS[3], 'A||B']) {
            let message = '';
            try {
              fnOf(mod, 'parseTransmission')(bad);
            } catch (e) {
              message = (e as Error).message;
            }
            if (message !== `Corrupt transmission: ${bad}`) throw new CheckFailure(`"${bad}" should throw "Corrupt transmission: ${bad}" (got ${message ? `"${message}"` : 'no error'})`);
          }
        } },
        { label: 'decodeAll skips and counts corrupt ones', run: ({ mod, expect }) => {
          const { messages, corrupt } = fnOf(mod, 'decodeAll')(RAWS);
          expect(messages.map((m: { from: string }) => m.from)).toEqual(['NOVA', 'KITE', 'ORION']);
          expect(corrupt).toBe(2);
        } },
        { label: 'translateAll translates in parallel without changing the originals', run: async ({ mod, expect }) => {
          let inFlight = 0;
          let max = 0;
          const translate = async (t: string) => {
            inFlight++;
            max = Math.max(max, inFlight);
            await wait(10);
            inFlight--;
            return t.toUpperCase();
          };
          const original = [{ from: 'A', priority: 1, body: 'hi' }, { from: 'B', priority: 2, body: 'yo' }];
          const out = await fnOf(mod, 'translateAll')(original, translate);
          expect(out).toEqual([{ from: 'A', priority: 1, body: 'HI' }, { from: 'B', priority: 2, body: 'YO' }]);
          expect(original[0].body).toBe('hi');
          if (max < 2) throw new CheckFailure('Translate all the messages at once with Promise.all.');
        } },
        { label: 'The inbox ranks by priority (first one wins a tie)', run: ({ mod, expect }) => {
          const inbox = fnOf(mod, 'makeInbox')();
          expect(inbox.top()).toBe(undefined);
          inbox.add({ from: 'A', priority: 2, body: '' });
          inbox.add({ from: 'B', priority: 5, body: '' });
          inbox.add({ from: 'C', priority: 5, body: '' });
          expect(inbox.top().from).toBe('B');
          expect(inbox.count()).toBe(3);
        } },
        { label: 'Two inboxes don\'t share messages', run: ({ mod, expect }) => {
          const a = fnOf(mod, 'makeInbox')();
          const b = fnOf(mod, 'makeInbox')();
          a.add({ from: 'A', priority: 1, body: '' });
          expect(b.count()).toBe(0);
        } },
        { label: 'processBatch runs the whole pipeline', run: async ({ mod, expect }) => {
          const translate = async (t: string) => t;
          expect(await fnOf(mod, 'processBatch')(RAWS, translate)).toEqual({ count: 3, corrupt: 2, topFrom: 'KITE' });
          expect(await fnOf(mod, 'processBatch')(['junk'], translate)).toEqual({ count: 0, corrupt: 1, topFrom: 'nobody' });
        } },
      ],
    },
  ],
};
