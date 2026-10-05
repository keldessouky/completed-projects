import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { codeFiles, fnOf, mustNotUse } from './helpers';

/** Run fn and return the message it throws — or fail the check if it doesn't throw. */
function thrown(fn: () => unknown, what: string): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new CheckFailure(`${what} should throw, but it didn't.`);
}

export const floor6: Deck = {
  id: 'vault',
  name: 'Type Vault',
  subtitle: 'Advanced TypeScript',
  outcome: 'You can model untrusted data, failure and whole APIs in the type system: the TypeScript of senior engineers.',
  hue: 300,
  levels: [
    {
      kind: 'code',
      id: 'unknown-values',
      title: 'unknown, Not any',
      system: 'Signal Scrubber',
      skills: ['narrowing', 'types'],
      ...codeFiles('unknown-values', 'ts'),
      brief: `**ARIA:** Floor 6: the Type Vault, where the station keeps its most sophisticated code. It starts at the door. Everything arriving from outside the station is untrusted: we don't know what it is until we look.

The signal scrubber treats incoming data as \`any\`. It crashes about twice a minute, and the compiler, which could have warned us, was told not to look.`,
      lesson: `## any switches checking off

\`any\` means "trust me". The compiler stops checking anything about that value:

\`\`\`ts
function shout(x: any) {
  return x.toUpperCase();   // compiles…
}
shout(42);                  // …and crashes: 42 has no toUpperCase
\`\`\`

And \`any\` spreads: whatever you get *from* an \`any\` is \`any\` too.

## unknown is the safe version

\`unknown\` also accepts every value, but you can't *use* it until you've checked what it is:

\`\`\`ts
function shout(x: unknown) {
  x.toUpperCase();          // ✗ 'x' is of type 'unknown'
}
\`\`\`

That error is a gift. It's every crash, found before it happens.

## Narrowing

Each check teaches the compiler something. Inside the \`if\`, the type is **narrowed**:

\`\`\`ts
if (typeof x === "string") { x.toUpperCase(); }   // string
if (typeof x === "number") { x.toFixed(1); }      // number
if (typeof x === "boolean") { … }                 // boolean
if (Array.isArray(x)) { x.length; }               // an array
if (x === null) { … }                             // null
\`\`\`

Watch out: \`typeof null\` is \`"object"\`, a famous JavaScript quirk. Check for null with \`x === null\`.

## Return early

A chain of \`if\`s that each \`return\` reads top to bottom, with the fallback at the end:

\`\`\`ts
if (typeof x === "string") return "text";
if (typeof x === "number") return "number";
return "unknown";
\`\`\``,
      hints: [
        'Change `x: any` to `x: unknown` in both functions. Now hover the red squiggles: the compiler refuses to call methods on a value it knows nothing about.',
        'Check one type at a time and return: ``if (typeof x === "string") return `text: ${x.toUpperCase()}`;`` then the same for `"number"` (with `x.toFixed(1)`) and `"boolean"`, then `Array.isArray(x)` and `x === null`, and finally `return "unknown";`.',
        '`signalLength`: `if (typeof x === "string" || Array.isArray(x)) return x.length;` then `return 0;`.',
      ],
      checks: [
        { label: 'Strings are upper-cased: "text: HELLO"', run: ({ mod, expect }) => expect(fnOf(mod, 'describeSignal')('hello')).toBe('text: HELLO') },
        { label: 'Numbers get one decimal place', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'describeSignal')(42.5)).toBe('number: 42.5');
          expect(fnOf(mod, 'describeSignal')(7)).toBe('number: 7.0');
        } },
        { label: 'Booleans, lists and null', run: ({ mod, expect }) => {
          const d = fnOf(mod, 'describeSignal');
          expect(d(true)).toBe('flag: on');
          expect(d(false)).toBe('flag: off');
          expect(d([1, 2, 3])).toBe('list of 3');
          expect(d(null)).toBe('empty');
        } },
        { label: 'Anything else is "unknown"', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'describeSignal')(undefined)).toBe('unknown');
          expect(fnOf(mod, 'describeSignal')({ freq: 9 })).toBe('unknown');
        } },
        { label: 'signalLength measures strings and arrays, and is 0 otherwise', run: ({ mod, expect }) => {
          const len = fnOf(mod, 'signalLength');
          expect(len('abc')).toBe(3);
          expect(len([1, 2])).toBe(2);
          expect(len(5)).toBe(0);
          expect(len(null)).toBe(0);
        } },
        { label: 'No `any` left', run: ({ source }) => mustNotUse(source, /\bany\b/, 'Replace every `any` with `unknown`, then narrow before you use the value.') },
      ],
    },
    {
      kind: 'code',
      id: 'type-guards',
      title: 'Type Guards',
      system: 'Deep Scanner',
      skills: ['narrowing', 'type-level'],
      ...codeFiles('type-guards', 'ts'),
      brief: `**ARIA:** The deep scanner reports *things*. Ships, cargo, debris, once a very confused pigeon. It needs to work out what each thing is, and tell the compiler what it found.`,
      lesson: `## Narrowing you already know

\`typeof x === "string"\`, \`Array.isArray(x)\`, \`x === null\` and checking a tag like \`x.kind === "ship"\` all **narrow** a type inside an \`if\`.

## Custom type guards

When the check is more complicated, put it in a function with a **type predicate** as its return type:

\`\`\`ts
function isShip(x: unknown): x is Ship {
  return typeof x === "object" && x !== null && (x as Ship).kind === "ship";
}

if (isShip(thing)) {
  thing.crew;   // TypeScript now knows thing is a Ship
}
\`\`\`

\`x is Ship\` means: "if this returns true, treat \`x\` as a \`Ship\`". With a plain \`boolean\` return type, the compiler learns nothing.

## Guards are a promise

The compiler **believes** your guard. If \`isShip\` returns true for something that isn't really a Ship, you've lied to the type system and bugs follow. So check **every** field you rely on: the tag *and* the types of \`name\` and \`crew\`.

A tiny helper makes property checks easy:

\`\`\`ts
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
// then: isRecord(x) && typeof x.name === "string" && …
\`\`\``,
      hints: [
        'Change the return types to predicates: `x is Ship` and `x is Cargo`.',
        'Write an `isRecord` helper (object and not null), then check the tag and every field: `isRecord(x) && x.kind === "ship" && typeof x.name === "string" && typeof x.crew === "number"`.',
        '`describeScan`: ``if (isShip(x)) return `Ship ${x.name} (${x.crew} crew)`;``, the same for cargo, then the fallback.',
      ],
      typeChecks: [
        { label: 'isShip narrows to Ship', code: `import { isShip } from './solution';\ndeclare const x: unknown;\nif (isShip(x)) {\n  const n: string = x.name;\n  const c: number = x.crew;\n}` },
        { label: 'isCargo narrows to Cargo', code: `import { isCargo } from './solution';\ndeclare const x: unknown;\nif (isCargo(x)) {\n  const m: number = x.mass;\n}` },
      ],
      checks: [
        { label: 'isShip accepts real ships', run: ({ mod, expect }) => expect(fnOf(mod, 'isShip')({ kind: 'ship', name: 'Kite', crew: 4 })).toBe(true) },
        { label: 'isShip rejects everything else', run: ({ mod, expect }) => {
          const isShip = fnOf(mod, 'isShip');
          for (const x of [null, undefined, 42, 'ship', [], { kind: 'ship', name: 'Kite' }, { kind: 'ship', name: 'Kite', crew: '4' }, { kind: 'cargo', label: 'x', mass: 1 }]) {
            if (isShip(x)) throw new CheckFailure(`isShip said yes to ${JSON.stringify(x) ?? String(x)}`);
          }
          expect(true).toBe(true);
        } },
        { label: 'isCargo checks the shape too', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'isCargo')({ kind: 'cargo', label: 'coolant', mass: 120 })).toBe(true);
          expect(fnOf(mod, 'isCargo')({ kind: 'cargo', label: 'coolant' })).toBe(false);
          expect(fnOf(mod, 'isCargo')(null)).toBe(false);
        } },
        { label: 'describeScan', run: ({ mod, expect }) => {
          const d = fnOf(mod, 'describeScan');
          expect(d({ kind: 'ship', name: 'Kite', crew: 4 })).toBe('Ship Kite (4 crew)');
          expect(d({ kind: 'cargo', label: 'coolant', mass: 120 })).toBe('Cargo coolant (120 kg)');
          expect(d({ kind: 'pigeon' })).toBe('Unknown object');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'unknown-parsing',
      title: 'Parsing Untrusted Data',
      system: 'Personnel Import',
      skills: ['narrowing', 'errors'],
      ...codeFiles('unknown-parsing', 'ts'),
      brief: `**ARIA:** Personnel records arrive as JSON from other stations. Other stations are not careful. Ages arrive as "thirty-ish", roles as "vibes", and one file was just the word \`null\`. The import system trusted all of it, because \`JSON.parse\` returns \`any\`, and \`any\` trusts everyone.`,
      lesson: `## any vs unknown

\`JSON.parse\` returns \`any\`, which switches type checking **off**: \`data.whatever.you.like\` compiles, and crashes at runtime. Treat outside data as \`unknown\` instead. You can't use an \`unknown\` until you've **proved** what it is:

\`\`\`ts
let data: unknown;
try {
  data = JSON.parse(text);
} catch {
  return null;                 // not even valid JSON
}
\`\`\`

## Proving a shape, step by step

\`\`\`ts
if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
const { name, age } = data as Record<string, unknown>;   // each field is still unknown
if (typeof name !== "string" || name === "") return null;
if (typeof age !== "number" || !Number.isInteger(age)) return null;
// from here on, TypeScript knows name is a string and age is a number
\`\`\`

Note: \`typeof null === "object"\` (a famous JavaScript mistake from 1995), and arrays are objects too. Check for both.

## Return a clean object

Build the result from the **checked** fields, rather than returning the input object. That drops any extra fields that came along for the ride, which can be a security issue in real systems.

This is called **validating at the boundary**: check data the moment it enters your program, so everything inside can trust its types. In real projects you'd often use a library to do this. You'll *build* one in this floor's boss.`,
      hints: [
        'Wrap `JSON.parse` in try/catch and store the result as `unknown`. Then reject anything that isn\'t a plain object: `typeof data !== "object" || data === null || Array.isArray(data)`.',
        'Destructure the fields from `data as Record<string, unknown>` and check each: `typeof name === "string" && name !== ""`, `Number.isInteger(age)` within range, the role in `ROLES`, and the callsign `undefined` or a string.',
        'Return only the validated fields, adding `callsign` only if it was present: `callsign === undefined ? { name, age, role } : { name, age, role, callsign }`.',
      ],
      typeChecks: [
        { label: 'parseCrew returns CrewMember | null', code: `import { parseCrew, type CrewMember } from './solution';\nconst c = parseCrew('{}');\nconst ok: CrewMember | null = c;\n// @ts-expect-error\nconst bad: CrewMember = c;` },
      ],
      checks: [
        { label: 'Parses a valid record', run: ({ mod, expect }) => expect(fnOf(mod, 'parseCrew')('{"name":"Ada","age":34,"role":"engineer"}')).toEqual({ name: 'Ada', age: 34, role: 'engineer' }) },
        { label: 'Keeps a callsign, drops extra fields', run: ({ mod, expect }) => expect(fnOf(mod, 'parseCrew')('{"name":"Bo","age":28,"role":"pilot","callsign":"Ace","admin":true}')).toEqual({ name: 'Bo', age: 28, role: 'pilot', callsign: 'Ace' }) },
        { label: 'Invalid JSON gives null (no crash)', run: ({ mod, expect }) => expect(fnOf(mod, 'parseCrew')('{name: Ada')).toBeNull() },
        { label: 'Wrong shapes give null', run: ({ mod }) => {
          const bad = [
            'null', '[]', '"Ada"', '42',
            '{"name":"","age":34,"role":"pilot"}',
            '{"name":"Ada","age":"34","role":"pilot"}',
            '{"name":"Ada","age":34.5,"role":"pilot"}',
            '{"name":"Ada","age":12,"role":"pilot"}',
            '{"name":"Ada","age":34,"role":"vibes"}',
            '{"name":"Ada","age":34,"role":"pilot","callsign":7}',
          ];
          for (const json of bad) {
            const result = fnOf(mod, 'parseCrew')(json);
            if (result !== null) throw new CheckFailure(`parseCrew(${json}) should be null, but returned ${JSON.stringify(result)}`);
          }
        } },
      ],
    },
    {
      kind: 'code',
      id: 'result-type',
      title: 'Errors as Values',
      system: 'Navigation Solver',
      skills: ['generics', 'type-level', 'errors'],
      ...codeFiles('result-type', 'ts'),
      brief: `**ARIA:** The navigation solver throws errors when a course can't be plotted. Nothing in its types says so, so every caller forgot to catch them. The last ship to ask for a course to "nowhere" took down the whole bridge.

Make failure part of the **type**, so callers *can't* forget.`,
      lesson: `## The problem with throwing

\`function plot(to: string): Course\` promises a Course. If it sometimes throws instead, that's invisible to the compiler and easy for callers to forget.

## Result types

Return a **discriminated union** that's either a success or a failure:

\`\`\`ts
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function plot(to: string): Result<Course> { … }

const r = plot("Vega");
r.value;            // ✖ error: might be a failure
if (r.ok) {
  r.value;          // ✔ narrowed to the success case
} else {
  r.error;
}
\`\`\`

The compiler now **forces** every caller to deal with both cases. This pattern comes from languages like Rust, and it's increasingly common in TypeScript codebases.

## Default type parameters

\`E = string\` gives the type parameter a default, so \`Result<number>\` means \`Result<number, string>\`.

## Small helpers

\`\`\`ts
const ok = <T,>(value: T) => ({ ok: true, value }) as const;
mapResult(r, (n) => n * 2);   // transform a success, pass a failure through
\`\`\`

\`never\` in \`Result<T, never>\` means "this side can't happen". A \`never\` fits anywhere, so \`ok(5)\` can be returned as any \`Result<number, E>\`.`,
      hints: [
        '`export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };`',
        '`divide`: `return b === 0 ? err("Division by zero") : ok(a / b);`',
        '`mapResult`: `return result.ok ? ok(fn(result.value)) : result;`. `unwrapOr`: `return result.ok ? result.value : fallback;`',
      ],
      typeChecks: [
        { label: 'Result is a union you must narrow', code: `import { divide } from './solution';\nconst r = divide(6, 3);\nif (r.ok) {\n  const v: number = r.value;\n} else {\n  const e: string = r.error;\n}\n// @ts-expect-error\nr.value;` },
        { label: 'The error type defaults to string, and can be changed', code: `import type { Result } from './solution';\nconst a: Result<number> = { ok: false, error: 'x' };\nconst b: Result<number, { code: number }> = { ok: false, error: { code: 404 } };\n// @ts-expect-error\nconst c: Result<number> = { ok: false, error: 404 };\n// @ts-expect-error\nconst d: Result<number> = { ok: true, error: 'x' };` },
        { label: 'mapResult changes the value type', code: `import { mapResult, ok } from './solution';\nconst r = mapResult(ok(2), (n) => String(n));\nif (r.ok) { const s: string = r.value; }` },
      ],
      checks: [
        { label: 'divide', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'divide')(6, 3)).toEqual({ ok: true, value: 2 });
          expect(fnOf(mod, 'divide')(1, 0)).toEqual({ ok: false, error: 'Division by zero' });
        } },
        { label: 'mapResult transforms successes and passes failures through', run: ({ mod, expect }) => {
          const double = (n: number) => n * 10;
          expect(fnOf(mod, 'mapResult')({ ok: true, value: 2 }, double)).toEqual({ ok: true, value: 20 });
          const failure = { ok: false, error: 'nope' };
          expect(fnOf(mod, 'mapResult')(failure, double)).toEqual(failure);
        } },
        { label: 'unwrapOr', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'unwrapOr')({ ok: true, value: 5 }, 0)).toBe(5);
          expect(fnOf(mod, 'unwrapOr')({ ok: false, error: 'x' }, 0)).toBe(0);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'mapped-types',
      title: 'Mapped Types',
      system: 'Change Tracker',
      skills: ['type-level', 'generics'],
      ...codeFiles('mapped-types', 'ts'),
      brief: `**ARIA:** The change tracker compares two versions of a configuration and flags what changed. Its types are all \`Record<string, boolean>\`, so it can't tell a real field from a typo. Generate the types *from* the objects instead.`,
      lesson: `## Mapped types

A **mapped type** loops over the keys of a type to build a new one:

\`\`\`ts
type Flags<T> = { [K in keyof T]: boolean };

type Ship = { name: string; crew: number };
type ShipFlags = Flags<Ship>;    // { name: boolean; crew: boolean }
\`\`\`

Read \`[K in keyof T]\` as "for each key K of T". \`T[K]\` is the type of that key's value, so \`{ [K in keyof T]: T[K] }\` is an exact copy.

## Modifiers

Add or remove \`?\` and \`readonly\` with \`+\` and \`-\`:

\`\`\`ts
type Optional<T> = { [K in keyof T]?: T[K] };             // = Partial<T>
type Mutable<T>  = { -readonly [K in keyof T]: T[K] };    // removes readonly
type Complete<T> = { [K in keyof T]-?: T[K] };            // = Required<T>
\`\`\`

The built-in utility types you used on Floor 5 (\`Partial\`, \`Readonly\`, \`Pick\`, \`Record\`) are all mapped types. Now you can write your own.

## Typed keys at runtime

\`Object.keys(obj)\` returns \`string[]\`, because at runtime an object might have extra keys. When you know it doesn't, assert the key type:

\`\`\`ts
for (const key of Object.keys(obj) as (keyof T)[]) { … }
\`\`\`

and build the result with \`const out = {} as Flags<T>;\`.`,
      hints: [
        '`export type Flags<T> = { [K in keyof T]: boolean };`',
        '`export type Mutable<T> = { -readonly [K in keyof T]: T[K] };`',
        'In `changedFields`: `const flags = {} as Flags<T>; for (const key of Object.keys(before) as (keyof T)[]) { flags[key] = before[key] !== after[key]; } return flags;`',
      ],
      typeChecks: [
        { label: 'Flags<T> has exactly T\'s keys, all boolean', code: `import type { Flags, ShipConfig } from './solution';\nconst f: Flags<ShipConfig> = { name: true, crew: false, armed: true };\n// @ts-expect-error\nconst g: Flags<ShipConfig> = { name: true, crew: false };\n// @ts-expect-error\nconst h: Flags<ShipConfig> = { name: true, crew: false, armed: 'yes' };` },
        { label: 'Mutable<T> removes readonly', code: `import type { Mutable } from './solution';\ntype Frozen = { readonly fuel: number };\nconst m: Mutable<Frozen> = { fuel: 1 };\nm.fuel = 2;\nconst f: Frozen = { fuel: 1 };\n// @ts-expect-error\nf.fuel = 2;` },
        { label: 'changedFields returns Flags of the input', code: `import { changedFields } from './solution';\nconst r = changedFields({ a: 1, b: 'x' }, { a: 2, b: 'x' });\nconst a: boolean = r.a;\n// @ts-expect-error\nr.c;` },
      ],
      checks: [
        { label: 'changedFields flags exactly what changed', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'changedFields')({ name: 'Kite', crew: 4, armed: false }, { name: 'Kite', crew: 5, armed: false })).toEqual({ name: false, crew: true, armed: false });
        } },
        { label: 'Nothing changed → all false', run: ({ mod, expect }) => {
          const s = { name: 'Kite', crew: 4 };
          expect(fnOf(mod, 'changedFields')(s, { ...s })).toEqual({ name: false, crew: false });
        } },
      ],
    },
    {
      kind: 'code',
      id: 'conditional-types',
      title: 'Conditional Types',
      system: 'Type Refinery',
      skills: ['type-level', 'generics'],
      ...codeFiles('conditional-types', 'ts'),
      brief: `**ARIA:** The type refinery takes types in and produces new types out. Yes, types can compute. TypeScript's type system is a small programming language of its own. This is where library authors live.`,
      lesson: `## Conditional types

Types can make decisions:

\`\`\`ts
type IsText<T> = T extends string ? "yes" : "no";
type A = IsText<"hi">;     // "yes"
type B = IsText<42>;       // "no"
\`\`\`

\`T extends U ? X : Y\` reads: "if T fits into U, then X, otherwise Y".

## infer

Inside the condition, \`infer\` captures part of the type being matched, like a variable for types:

\`\`\`ts
type ReturnOf<F> = F extends (...args: any[]) => infer R ? R : never;
type R = ReturnOf<() => number>;          // number

type First<T> = T extends [infer H, ...unknown[]] ? H : never;
type H = First<[string, number]>;         // string
\`\`\`

(The built-ins \`ReturnType\`, \`Awaited\` and \`NonNullable\` are written exactly like this.)

## Distribution over unions

Given a union, a conditional type is applied to **each member** separately, and the results are joined back up:

\`\`\`ts
type NoNumbers<T> = T extends number ? never : T;
type X = NoNumbers<string | number | boolean>;   // string | boolean
\`\`\`

\`never\` disappears from unions, so returning \`never\` removes a member.

## Making runtime and types agree

A function's return type can use a conditional type. Then a type guard on \`filter\` keeps the two in step:

\`\`\`ts
values.filter((v): v is NonNullish<T> => v !== null && v !== undefined)
\`\`\``,
      hints: [
        '`ElementOf<T> = T extends (infer U)[] ? U : never;` and `Unwrap<T> = T extends Promise<infer U> ? U : T;`',
        '`NonNullish<T> = T extends null | undefined ? never : T;` (distribution removes them from unions). `toArray`: `Array.isArray(value) ? value : [value]`.',
        '`compact` should return `NonNullish<T>[]`, using a type-guard callback: `values.filter((v): v is NonNullish<T> => v !== null && v !== undefined)`.',
      ],
      typeChecks: [
        { label: 'ElementOf', code: `import type { ElementOf } from './solution';\nconst a: ElementOf<string[]> = 'x';\nconst n: ElementOf<number> = undefined as never;\n// @ts-expect-error\nconst b: ElementOf<string[]> = 5;` },
        { label: 'Unwrap', code: `import type { Unwrap } from './solution';\nconst a: Unwrap<Promise<number>> = 5;\nconst b: Unwrap<string> = 'x';\n// @ts-expect-error\nconst c: Unwrap<Promise<number>> = 'x';` },
        { label: 'NonNullish removes null and undefined', code: `import type { NonNullish } from './solution';\ntype T = NonNullish<string | null | undefined>;\nconst a: T = 'x';\n// @ts-expect-error\nconst b: T = null;\n// @ts-expect-error\nconst c: T = undefined;` },
        { label: 'compact\'s type drops null and undefined', code: `import { compact } from './solution';\nconst xs = compact([1, null, 2, undefined]);\nconst ys: number[] = xs;` },
      ],
      checks: [
        { label: 'toArray', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'toArray')(5)).toEqual([5]);
          expect(fnOf(mod, 'toArray')([1, 2])).toEqual([1, 2]);
        } },
        { label: 'compact', run: ({ mod, expect }) => expect(fnOf(mod, 'compact')([1, null, 2, undefined, 0])).toEqual([1, 2, 0]) },
      ],
    },
    {
      kind: 'code',
      id: 'template-literal-types',
      title: 'Template Literal Types',
      system: 'Bay Allocator',
      skills: ['type-level'],
      ...codeFiles('template-literal-types', 'ts'),
      brief: `**ARIA:** Bay codes look like "A1" through "C4". Right now they're typed \`string\`, so "Z99", "banana" and "" are all valid bays. Shuttles keep trying to dock in "banana". Make the types spell out every real bay.`,
      lesson: `## Template literal types

Template strings work at the type level too:

\`\`\`ts
type Size = "S" | "M";
type Color = "red" | "blue";
type Sku = \`\${Color}-\${Size}\`;   // "red-S" | "red-M" | "blue-S" | "blue-M"
\`\`\`

Unions in the template **multiply out** into every combination.

## String helpers

\`Uppercase<T>\`, \`Lowercase<T>\`, \`Capitalize<T>\` and \`Uncapitalize<T>\` transform string literal types:

\`\`\`ts
type E = \`on\${Capitalize<"dock">}\`;   // "onDock"
\`\`\`

## Renaming keys

In a mapped type, \`as\` renames each key. Combined with a template, that's how libraries generate APIs from names:

\`\`\`ts
type Getters<T> = {
  [K in keyof T & string as \`get\${Capitalize<K>}\`]: () => T[K];
};
// Getters<{ fuel: number }> = { getFuel: () => number }
\`\`\`

## Precise function return types

A generic parameter lets the return type follow the input:

\`\`\`ts
function prefix<S extends string>(s: S): \`id-\${S}\` {
  return \`id-\${s}\` as \`id-\${S}\`;
}
prefix("kite");   // type "id-kite"
\`\`\`

At runtime the string is built normally. The \`as\` tells TypeScript what you know it will be.`,
      hints: [
        '``export type BayCode = `${Deck}${Bay}`;`` and for the guard, `s is BayCode` with a regular expression: `/^[ABC][1-4]$/.test(s)`.',
        '`handlerName` needs a type parameter: ``<E extends string>(event: E): `on${Capitalize<E>}` ``. Build the string with `event.charAt(0).toUpperCase() + event.slice(1)` and assert the type with `as`.',
        '``Handlers<E extends string> = { [K in E as `on${Capitalize<K>}`]: () => void };``',
      ],
      typeChecks: [
        { label: 'BayCode is exactly the 12 real bays', code: `import type { BayCode } from './solution';\nconst a: BayCode = 'A1';\nconst b: BayCode = 'C4';\n// @ts-expect-error\nconst c: BayCode = 'D1';\n// @ts-expect-error\nconst d: BayCode = 'A5';\n// @ts-expect-error\nconst e: BayCode = 'banana';` },
        { label: 'isBayCode narrows', code: `import { isBayCode, type BayCode } from './solution';\ndeclare const s: string;\nif (isBayCode(s)) { const b: BayCode = s; }` },
        { label: 'handlerName has a precise return type', code: `import { handlerName } from './solution';\nconst h: 'onDock' = handlerName('dock');\n// @ts-expect-error\nconst w: 'onUndock' = handlerName('dock');` },
        { label: 'Handlers maps event names to handler props', code: `import type { Handlers } from './solution';\nconst h: Handlers<'dock' | 'undock'> = { onDock: () => {}, onUndock: () => {} };\n// @ts-expect-error\nconst missing: Handlers<'dock' | 'undock'> = { onDock: () => {} };\n// @ts-expect-error\nconst wrong: Handlers<'dock'> = { dock: () => {} };` },
      ],
      checks: [
        { label: 'isBayCode at runtime', run: ({ mod, expect }) => {
          const is = fnOf(mod, 'isBayCode');
          expect(is('A1')).toBe(true);
          expect(is('C4')).toBe(true);
          expect(is('D1')).toBe(false);
          expect(is('A5')).toBe(false);
          expect(is('A12')).toBe(false);
          expect(is('')).toBe(false);
        } },
        { label: 'handlerName at runtime', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'handlerName')('dock')).toBe('onDock');
          expect(fnOf(mod, 'handlerName')('powerDown')).toBe('onPowerDown');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'satisfies-const',
      title: 'satisfies and as const',
      system: 'Route Table',
      skills: ['type-level', 'types'],
      ...codeFiles('satisfies-const', 'ts'),
      brief: `**ARIA:** The route table lists every screen on the station. It's typed \`Record<string, Route>\`, which checks the entries, but throws away the route names. So \`link("reactr")\` compiles, and sends people to a 404 in the middle of a meltdown drill.`,
      lesson: `## The annotation trade-off

\`\`\`ts
const ROUTES: Record<string, Route> = { home: …, crew: … };
\`\`\`

The annotation checks every entry is a Route. But it also **widens** the variable's type to \`Record<string, Route>\`, so TypeScript forgets that the keys are exactly \`home\` and \`crew\`.

## satisfies

\`satisfies\` checks a value against a type **without** changing the value's own, more specific type:

\`\`\`ts
const ROUTES = {
  home: { path: "/", auth: false },
  crew: { path: "/crew/:id", auth: true },
} satisfies Record<string, Route>;

type RouteName = keyof typeof ROUTES;   // "home" | "crew"
\`\`\`

## as const

\`as const\` freezes a value into its narrowest, readonly literal type: \`path\` becomes \`"/crew/:id"\` rather than \`string\`. \`as const satisfies T\` gives you both: exact literal types, checked against a shape.

## typeof and keyof typeof

- \`typeof ROUTES\` (in a type position) is the type of the value.
- \`keyof typeof ROUTES\` is the union of its keys.

This lets **one** declaration be the single source of truth. Add a route and the \`RouteName\` type updates itself. There's no list to keep in sync.`,
      hints: [
        'Remove the annotation and end the object with `as const satisfies Record<string, Route>`.',
        '`export type RouteName = keyof typeof ROUTES;`',
        '`link`: read `ROUTES[name].path` (store it as a `string`), then `id === undefined ? path : path.replace(":id", id)`. `protectedRoutes`: `(Object.keys(ROUTES) as RouteName[]).filter((n) => ROUTES[n].auth)`.',
      ],
      typeChecks: [
        { label: 'RouteName is derived from ROUTES', code: `import { link, type RouteName } from './solution';\nconst a: RouteName = 'crew';\n// @ts-expect-error\nconst b: RouteName = 'reactr';\n// @ts-expect-error\nlink('nowhere');` },
        { label: 'Routes are still checked against Route', code: `import { ROUTES } from './solution';\nconst p: '/crew/:id' = ROUTES.crew.path;\nconst auth: boolean = ROUTES.home.auth;` },
      ],
      checks: [
        { label: 'link fills in the id', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'link')('crew', '7')).toBe('/crew/7');
          expect(fnOf(mod, 'link')('home')).toBe('/');
          expect(fnOf(mod, 'link')('reactor')).toBe('/reactor');
        } },
        { label: 'protectedRoutes', run: ({ mod, expect }) => expect(fnOf(mod, 'protectedRoutes')()).toEqual(['crew', 'reactor']) },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-vault',
      title: 'Type-Level Thinking',
      system: 'Vault Lock',
      skills: ['type-level', 'narrowing'],
      brief: `**ARIA:** The vault lock asks questions about types, not values. Get them right and the Schema Forge opens.`,
      lesson: `## Quick reference

- \`unknown\` must be narrowed before use; \`any\` turns checking off.
- \`x is T\` return types teach the compiler what a check proved.
- \`[K in keyof T]\` maps over keys; \`as\` renames them.
- \`T extends U ? X : Y\` chooses; \`infer\` captures; unions distribute; \`never\` vanishes from unions.
- \`satisfies\` checks without widening; \`as const\` narrows to literals.`,
      questions: [
        {
          prompt: 'What is `A`?',
          code: `type NoStrings<T> = T extends string ? never : T;\ntype A = NoStrings<string | number | boolean>;`,
          options: ['never', 'number | boolean', 'string', 'string | number | boolean'],
          answer: 1,
          explain: 'The conditional distributes over the union: string → never, number → number, boolean → boolean. `never` disappears from the result.',
        },
        {
          prompt: 'What is `R`?',
          code: `type R = Awaited<ReturnType<() => Promise<string[]>>>;`,
          options: ['Promise<string[]>', 'string[]', 'string', '() => Promise<string[]>'],
          answer: 1,
          explain: '`ReturnType` gives `Promise<string[]>`, and `Awaited` unwraps the promise to `string[]`. Both are conditional types with `infer` under the hood.',
        },
        {
          prompt: 'Why is a plain `boolean` return type not enough for a type guard?',
          code: `function isShip(x: unknown): boolean {\n  return typeof x === "object" && x !== null && "crew" in x;\n}\nif (isShip(thing)) thing.crew;`,
          options: ['It is enough', 'The compiler learns nothing from a boolean, so thing is still unknown', 'Booleans can\'t be returned from functions', 'You need `as` instead'],
          answer: 1,
          explain: 'Only a type predicate (`x is Ship`) connects the runtime check to the type. With `boolean`, `thing.crew` is still an error.',
        },
        {
          prompt: 'What is the type of `Keys`?',
          code: `const PALETTE = { ok: "#0f0", bad: "#f00" } satisfies Record<string, string>;\ntype Keys = keyof typeof PALETTE;`,
          options: ['string', '"ok" | "bad"', 'Record<string, string>', 'never'],
          answer: 1,
          explain: '`satisfies` checks the object without widening it, so the specific keys survive. With `: Record<string, string>`, `Keys` would be `string`.',
        },
        {
          prompt: 'What does this mapped type produce for `{ fuel: number }`?',
          code: `type T<O> = { [K in keyof O & string as \`set\${Capitalize<K>}\`]: (v: O[K]) => void };`,
          options: ['{ fuel: (v: number) => void }', '{ setFuel: (v: number) => void }', '{ setfuel: (v: number) => void }', '{ setFuel: number }'],
          answer: 1,
          explain: '`as` renames each key using the template: "fuel" becomes "setFuel", and the value type uses the original property type, `O[K]`.',
        },
        {
          prompt: 'Which is the safest type for the result of `JSON.parse(text)`?',
          options: ['any', 'unknown', 'object', 'Record<string, any>'],
          answer: 1,
          explain: '`unknown` forces you to validate before use. `any` and `Record<string, any>` let invalid data flow through unchecked.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'schema-forge',
      title: 'BOSS: Schema Forge',
      system: 'Schema Forge',
      boss: true,
      skills: ['type-level', 'generics', 'narrowing'],
      ...codeFiles('schema-forge', 'ts'),
      brief: `**ARIA:** The Schema Forge validates every byte of data that enters the station, and its types are *inferred* from the schemas themselves. Describe a shape once, and you get both the runtime check and the static type. Libraries like this are used by millions of developers. You're about to write one.

**THE FEED:** *Folks, this is the moment. The Vault boss. Our engineer arrived not knowing what a string was. Now they're doing TYPE-LEVEL PROGRAMMING. The sponsors are going wild. One of them has fainted.*`,
      lesson: `## One source of truth

\`\`\`ts
const Ship = object({ name: string(), crew: number(), tags: array(string()) });
type Ship = Infer<typeof Ship>;      // { name: string; crew: number; tags: string[] }
const ship = Ship.parse(data);       // validated AND typed
\`\`\`

## How it fits together

Every schema has \`check(input, path)\`, which returns the value (typed) or throws a \`SchemaError\` via \`fail(path, "number")\`. \`makeSchema\` builds \`parse\` and \`safeParse\` around your check.

**Primitives** check \`typeof\` (and \`number()\` rejects \`NaN\`).

**Composites** call their children's \`check\`, extending the path:

\`\`\`ts
item.check(element, \`\${path}[\${i}]\`)         // arrays:  value.tags[2]
shape[key].check(record[key], \`\${path}.\${key}\`)  // objects: value.pilot.age
\`\`\`

## The types

\`\`\`ts
type Infer<S> = S extends Schema<infer T> ? T : never;

function object<S extends Record<string, Schema<unknown>>>(shape: S)
  : Schema<{ [K in keyof S]: Infer<S[K]> }>
\`\`\`

The mapped type turns "an object of schemas" into "an object of the types those schemas produce". That one line is the heart of libraries like zod.

## optional

\`optional(s)\` lets \`undefined\` through, and otherwise defers to \`s\`. In \`object\`, leave keys out of the result when their value is \`undefined\`.`,
      hints: [
        '`Infer<S> = S extends Schema<infer T> ? T : never;`. Primitives: `makeSchema((input, path) => typeof input === "string" ? input : fail(path, "string"))`. Add `!Number.isNaN(input)` for numbers.',
        '`array`: check `Array.isArray(input)` (else `fail(path, "array")`), then ``input.map((el, i) => item.check(el, `${path}[${i}]`))``. `optional`: `input === undefined ? undefined : schema.check(input, path)`.',
        '`object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }>`: reject non-objects, null and arrays, then for each key of `shape` call ``shape[key].check(record[key], `${path}.${key}`)``, adding it to the output unless it is `undefined`.',
      ],
      typeChecks: [
        { label: 'Infer extracts a schema\'s type', code: `import { number, string, type Infer } from './solution';\nconst n: Infer<ReturnType<typeof number>> = 5;\n// @ts-expect-error\nconst s: Infer<ReturnType<typeof string>> = 5;` },
        { label: 'object() infers the full shape', code: `import { object, string, number, array, optional, type Infer } from './solution';\nconst Ship = object({ name: string(), crew: number(), tags: array(string()), motto: optional(string()) });\ntype Ship = Infer<typeof Ship>;\nconst a: Ship = { name: 'Kite', crew: 4, tags: [], motto: undefined };\n// @ts-expect-error\nconst b: Ship = { name: 'Kite', crew: '4', tags: [], motto: undefined };\n// @ts-expect-error\nconst c: Ship = { name: 'Kite', crew: 4, tags: [1], motto: undefined };` },
        { label: 'parse returns the inferred type', code: `import { object, string, number } from './solution';\nconst Crew = object({ name: string(), age: number() });\nconst c = Crew.parse({});\nconst age: number = c.age;\n// @ts-expect-error\nc.rank;` },
      ],
      checks: [
        { label: 'Primitives accept their own type', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'string')().parse('hi')).toBe('hi');
          expect(fnOf(mod, 'number')().parse(4)).toBe(4);
          expect(fnOf(mod, 'boolean')().parse(false)).toBe(false);
        } },
        { label: 'Primitives reject other types, with a path', run: ({ mod, expect }) => {
          expect(thrown(() => fnOf(mod, 'string')().parse(4), 'string().parse(4)')).toBe('Expected string at value');
          expect(thrown(() => fnOf(mod, 'number')().parse('4'), 'number().parse("4")')).toBe('Expected number at value');
          expect(thrown(() => fnOf(mod, 'number')().parse(NaN), 'number().parse(NaN)')).toBe('Expected number at value');
          expect(thrown(() => fnOf(mod, 'boolean')().parse('true'), 'boolean().parse("true")')).toBe('Expected boolean at value');
        } },
        { label: 'array checks every element', run: ({ mod, expect }) => {
          const tags = fnOf(mod, 'array')(fnOf(mod, 'string')());
          expect(tags.parse(['a', 'b'])).toEqual(['a', 'b']);
          expect(thrown(() => tags.parse(['a', 2]), 'array(string()).parse(["a", 2])')).toBe('Expected string at value[1]');
          expect(thrown(() => tags.parse('a'), 'array(string()).parse("a")')).toBe('Expected array at value');
        } },
        { label: 'object checks nested fields and drops extras', run: ({ mod, expect }) => {
          const { object, string, number, array } = mod;
          const Ship = object({ name: string(), crew: number(), pilot: object({ name: string(), age: number() }), tags: array(string()) });
          const good = { name: 'Kite', crew: 4, pilot: { name: 'Nova', age: 30, extra: 1 }, tags: ['fast'], junk: true };
          expect(Ship.parse(good)).toEqual({ name: 'Kite', crew: 4, pilot: { name: 'Nova', age: 30 }, tags: ['fast'] });
          expect(thrown(() => Ship.parse({ ...good, pilot: { name: 'Nova', age: '30' } }), 'a wrong nested field')).toBe('Expected number at value.pilot.age');
          expect(thrown(() => Ship.parse({ ...good, tags: ['ok', false] }), 'a wrong array element')).toBe('Expected string at value.tags[1]');
          expect(thrown(() => Ship.parse(null), 'null')).toBe('Expected object at value');
          expect(thrown(() => Ship.parse([]), 'an array')).toBe('Expected object at value');
        } },
        { label: 'optional allows a missing key', run: ({ mod, expect }) => {
          const { object, string, optional } = mod;
          const S = object({ name: string(), motto: optional(string()) });
          expect(S.parse({ name: 'Kite' })).toEqual({ name: 'Kite' });
          expect(S.parse({ name: 'Kite', motto: 'Onward' })).toEqual({ name: 'Kite', motto: 'Onward' });
          expect(thrown(() => S.parse({ name: 'Kite', motto: 7 }), 'a wrong optional field')).toBe('Expected string at value.motto');
        } },
        { label: 'safeParse never throws', run: ({ mod, expect }) => {
          const S = mod.object({ crew: mod.number() });
          expect(S.safeParse({ crew: 3 })).toEqual({ success: true, data: { crew: 3 } });
          expect(S.safeParse({ crew: 'three' })).toEqual({ success: false, error: 'Expected number at value.crew' });
        } },
      ],
    },
  ],
};
