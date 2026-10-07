import { ALL_LEVELS } from '.';
import type { CompileCard, ReviewItem } from '../game/types';

// Spaced review: short retrieval questions that come back on a schedule after
// you've learned their topic. Two sources:
//   - every quiz question, unlocked once you've finished that quiz;
//   - "does this compile?" cards, each unlocked by the level that teaches its
//     idea. Every card's verdict is checked against the real compiler (strict
//     mode, the same settings as the levels) by tests/review.test.ts.
// Card ids come from their position: add new cards at the end.
export const COMPILE_CARDS: CompileCard[] = [
  { code: `let fuel: number = "80";`, ok: false, after: 'power-bus', why: 'A string literal is not a number. Annotations are promises the compiler holds you to.' },
  { code: `const names: string[] = ["Ada", "Bo"];\nnames.push("Cy");`, ok: true, after: 'cargo-manifest', why: '`const` stops reassigning the variable, not changing the array it points to.' },
  { code: `function greet(name) {\n  return "Hi " + name;\n}`, ok: false, after: 'power-bus', why: 'Under strict mode, an unannotated parameter is an implicit `any` — an error.' },
  { code: `let id: string | number = 7;\nid = "seven";`, ok: true, after: 'signal-decoder', why: 'Both values fit the union `string | number`.' },
  { code: `function len(s: string | null) {\n  return s.length;\n}`, ok: false, after: 'signal-decoder', why: '`s` is possibly `null`. Narrow it first.' },
  { code: `function len(s: string | null) {\n  return s?.length ?? 0;\n}`, ok: true, after: 'signal-decoder', why: '`?.` short-circuits on null and `??` supplies the fallback.' },
  { code: `const pt: { x: number; y: number } = { x: 1 };`, ok: false, after: 'crew-registry', why: 'Property `y` is missing.' },
  { code: `interface Ship { name: string }\nconst s: Ship = { name: "Kite", crew: 3 };`, ok: false, after: 'crew-registry', why: 'Object literals get an excess property check: `crew` isn\'t in `Ship`.' },
  { code: `interface Ship { name: string }\nconst data = { name: "Kite", crew: 3 };\nconst s: Ship = data;`, ok: true, after: 'crew-registry', why: 'Gotcha! Excess property checks only apply to fresh object literals. `data` has a `name: string`, so it fits.' },
  { code: `type Dir = "up" | "down";\nconst d: Dir = "left";`, ok: false, after: 'literal-locks', why: '"left" is not one of the literal members of `Dir`.' },
  { code: `const pair: [string, number] = ["a", 1, 2];`, ok: false, after: 'cargo-manifest', why: 'A tuple has a fixed length. Three elements don\'t fit `[string, number]`.' },
  { code: `const nums = [1, 2, 3];\nconst doubled: number[] = nums.map((n) => n * 2);`, ok: true, after: 'cargo-manifest', why: '`n` is inferred as `number`, so the result is `number[]`.' },
  { code: `const nums = [1, 2, 3];\nconst hit: number = nums.find((n) => n > 1);`, ok: false, after: 'cargo-manifest', why: '`find` returns `number | undefined` — it might not find anything.' },
  { code: `function first<T>(xs: T[]): T | undefined {\n  return xs[0];\n}\nconst s: string | undefined = first([1, 2]);`, ok: false, after: 'universal-adapter', why: 'T is inferred as `number`, so the result is `number | undefined`, not string.' },
  { code: `const ro: readonly number[] = [1, 2];\nro.push(3);`, ok: false, after: 'config-matrix', why: 'Readonly arrays have no `push`.' },
  { code: `let v: unknown = "hi";\nv.toUpperCase();`, ok: false, after: 'unknown-values', why: '`unknown` must be narrowed before you can use it.' },
  { code: `let v: unknown = "hi";\nif (typeof v === "string") v.toUpperCase();`, ok: true, after: 'unknown-values', why: 'The `typeof` check narrows `unknown` to `string`.' },
  { code: `let a: any = 4;\na.fly.to.the.moon();`, ok: true, after: 'unknown-values', why: '`any` turns checking off. It compiles — and crashes at runtime. That\'s why `any` is dangerous.' },
  { code: `function sign(n: number): string {\n  if (n > 0) return "pos";\n}`, ok: false, after: 'comms-relay', why: 'Not every path returns a string: for n ≤ 0 it returns `undefined`.' },
  { code: `const o = { level: 1 } as const;\no.level = 2;`, ok: false, after: 'satisfies-const', why: '`as const` makes every property readonly.' },
  { code: `type User = { name: string; age?: number };\nconst u: User = { name: "Ada" };\nconst next = u.age + 1;`, ok: false, after: 'crew-registry', why: '`u.age` is possibly `undefined`.' },
  { code: `const el = document.querySelector("input");\nel.value = "x";`, ok: false, after: 'targeting', why: '`querySelector` returns `HTMLInputElement | null`. It might not exist.' },
  { code: `const el = document.querySelector("input");\nif (el) el.value = "x";`, ok: true, after: 'targeting', why: 'With a tag name, TypeScript knows it\'s an `HTMLInputElement`, and the `if` removes `null`.' },
  { code: `const el = document.querySelector(".field");\nif (el) el.value = "x";`, ok: false, after: 'targeting', why: 'A class selector gives a plain `Element`, which has no `value`. You\'d need `querySelector<HTMLInputElement>(…)`.' },
  { code: `import { useState } from "react";\nfunction Fuel() {\n  const [n, setN] = useState(0);\n  setN("full");\n  return null;\n}`, ok: false, after: 'thruster', why: '`useState(0)` holds a number; "full" is a string.' },
  { code: `function Badge({ name }: { name: string }) {\n  return <b>{name}</b>;\n}\nconst el = <Badge />;`, ok: false, after: 'gauge-panel', why: 'The required prop `name` is missing.' },
  { code: `function Badge({ name }: { name: string }) {\n  return <b>{name}</b>;\n}\nconst el = <Badge name="Ada" />;`, ok: true, after: 'gauge-panel', why: 'All required props are there, with the right types.' },
  { code: `const el = <div class="panel" />;`, ok: false, after: 'first-light', why: 'In JSX it\'s `className`. The compiler even suggests it.' },
  { code: `const el = (\n  <input onChange={(e) => console.log(e.target.value)} />\n);`, ok: true, after: 'callsign', why: 'The handler\'s event type is inferred from `onChange` on an `<input>`, so `e.target.value` is a string.' },
  { code: `import { useState } from "react";\nfunction List() {\n  const [items, setItems] = useState([]);\n  setItems(["fuel"]);\n  return null;\n}`, ok: false, after: 'airlock', why: '`useState([])` infers `never[]` — an array that can hold nothing. Write `useState<string[]>([])`.' },
  { code: `import { useRef } from "react";\nfunction Field() {\n  const r = useRef<HTMLInputElement>(null);\n  r.current.focus();\n  return <input ref={r} />;\n}`, ok: false, after: 'targeting', why: '`r.current` is `null` until React attaches it. Use `r.current?.focus()`.' },
  { code: `type Shape =\n  | { kind: "sq"; size: number }\n  | { kind: "circ"; r: number };\nconst area = (s: Shape) =>\n  s.kind === "sq" ? s.size ** 2 : Math.PI * s.r ** 2;`, ok: true, after: 'alarm-router', why: 'Checking the `kind` tag narrows each branch to one member.' },
  { code: `type Shape =\n  | { kind: "sq"; size: number }\n  | { kind: "circ"; r: number };\nconst size = (s: Shape) => s.size;`, ok: false, after: 'alarm-router', why: 'Without narrowing, `size` only exists on one member of the union.' },
  { code: `function sum(...xs: number[]) {\n  return xs.reduce((a, b) => a + b, 0);\n}\nsum(1, 2, "3");`, ok: false, after: 'cargo-manifest', why: '"3" is a string; every rest argument must be a number.' },
  { code: `const crew: string[] = [];\nconst first: string = crew[0];`, ok: true, after: 'cargo-manifest', why: 'Gotcha! Reading by index is typed as the element type, even though `crew[0]` is `undefined` here. TypeScript trusts you with indexes, so check the length first.' },
  { code: `function pick<T, K extends keyof T>(o: T, k: K) {\n  return o[k];\n}\npick({ a: 1 }, "b");`, ok: false, after: 'constraint-field', why: '"b" is not a key of `{ a: number }`.' },
  { code: `function shout(s?: string) {\n  return s.toUpperCase();\n}`, ok: false, after: 'signal-decoder', why: '`s?` means `s` may be `undefined`. Narrow it first, or give it a default: `s = ""`.' },
  { code: `const n = "42".length;\nconst s: string = n;`, ok: false, after: 'power-bus', why: '`.length` is a number, and a number can\'t go where a string was promised.' },
  { code: 'type Bay = `bay-${1 | 2}`;\nconst b: Bay = "bay-3";', ok: false, after: 'template-literal-types', why: '"bay-3" isn\'t one of the two codes `Bay` allows: "bay-1" and "bay-2".' },
  { code: `import type { ReactNode } from "react";\nfunction Panel({ children }: { children: ReactNode }) {\n  return <section>{children}</section>;\n}\nconst p = <Panel>{42}{"text"}{null}</Panel>;`, ok: true, after: 'hull-plating', why: '`ReactNode` accepts numbers, strings, null, elements and arrays of them.' },
];

export const REVIEW_ITEMS: ReviewItem[] = [
  ...ALL_LEVELS.flatMap((level) =>
    level.kind === 'quiz'
      ? level.questions.map((q, i): ReviewItem => ({ id: `${level.id}/${i + 1}`, after: level.id, prompt: q.prompt, code: q.code, options: q.options, answer: q.answer, explain: q.explain }))
      : [],
  ),
  ...COMPILE_CARDS.map((c, i): ReviewItem => ({
    id: `compiles/${i + 1}`,
    after: c.after,
    prompt: 'Does this compile with `strict` on?',
    code: c.code,
    options: ['Yes, it compiles', "No, it's a type error"],
    answer: c.ok ? 0 : 1,
    explain: c.why,
  })),
];

export const reviewItem = (id: string) => REVIEW_ITEMS.find((r) => r.id === id);
