// Plain-English explanations, checked against the messages the real compiler gives.
import { describe, expect, test } from 'vitest';
import { Checker } from '../src/engine/checker';
import { explainDiagnostic } from '../src/engine/explain';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);
const firstError = (code: string) => checker.check({ '/solution.tsx': `${code}\nexport {};` }).diagnostics[0];

describe('explaining compiler errors', () => {
  test.each([
    ['let n: number = "a";', /is `string`, but the code promised `number`/],
    ['function f(x: number) {} f("a");', /passed `string` to a function that expects `number`/],
    ['const o = { name: 1 }; o.nme;', /did you mean `name`/],
    ['const counter = 1; countr;', /did you mean `counter`/],
    ['foo;', /Nothing called `foo` exists/],
    ['const x = 1; x = 2;', /made with `const`/],
    ['function f(x) { return x; }', /Say what type `x` is/],
    ['function f(s: string | null) { return s.length; }', /might be `null`/],
    ['function f(s?: string) { return s.length; }', /might be `undefined`/],
    ['let v: unknown = 1; v.toFixed();', /could be anything/],
    ['function f(a: number) {} f();', /takes 1 input and you gave it 0/],
    ['function f(n: number): string { if (n) return "a"; }', /without a `return`/],
    ['const t = [1].find((n) => n > 0); const u: number = t;', /might be `undefined`/],
    ['const e = <div class="a" />;', /did you mean `className`/],
    ['const p: { a: number; b: number } = { a: 1 };', /needs a `b` too/],
    ['const s = "abc', /closing quote/],
    ['const a = (1 + 2;', /expected a `\)`/],
    ['import x from "lodash";', /only `react` can be imported/],
  ])('%s', (code, expected) => {
    const d = firstError(code);
    expect(d, 'the snippet should not compile').toBeTruthy();
    expect(explainDiagnostic(d.code, d.message)).toMatch(expected);
  });

  test('unfamiliar errors get no explanation rather than a wrong one', () => {
    expect(explainDiagnostic(99999, 'Something new')).toBeNull();
  });
});
