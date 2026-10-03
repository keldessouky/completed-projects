// The in-browser compiler's IDE features: hover types and completions.
import { describe, expect, test } from 'vitest';
import { Checker } from '../src/engine/checker';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);
const at = (src: string, marker: string) => src.indexOf(marker);

describe('quickInfo', () => {
  test('shows inferred types', () => {
    const src = 'let count = 3;\nconst mode = "warp";\n';
    expect(checker.quickInfo({ '/s.ts': src }, '/s.ts', at(src, 'count'))?.signature).toBe('let count: number');
    expect(checker.quickInfo({ '/s.ts': src }, '/s.ts', at(src, 'mode'))?.signature).toBe('const mode: "warp"');
  });
  test('shows React hook types and documentation', () => {
    const src = "import { useState } from 'react';\nexport function C() { const [n, setN] = useState(0); return <b>{n}</b>; }\n";
    const info = checker.quickInfo({ '/s.tsx': src }, '/s.tsx', at(src, 'setN'));
    expect(info?.signature).toBe('const setN: React.Dispatch<React.SetStateAction<number>>');
    const hook = checker.quickInfo({ '/s.tsx': src }, '/s.tsx', at(src, 'useState(0)'));
    expect(hook?.doc.length).toBeGreaterThan(0);
  });
  test('nothing on whitespace', () => {
    expect(checker.quickInfo({ '/s.ts': 'let a = 1;\n\n' }, '/s.ts', 11)).toBeNull();
  });
});

describe('completions', () => {
  test('members after a dot', () => {
    const src = 'const s = "hi";\ns.';
    const names = checker.completions({ '/s.ts': src }, '/s.ts', src.length).map((c) => c.name);
    expect(names).toContain('toUpperCase');
    expect(names).not.toContain('push');
  });
  test('locals and React exports in scope', () => {
    const src = "import { useState } from 'react';\nconst fuelLevel = 1;\nfu";
    const names = checker.completions({ '/s.tsx': src }, '/s.tsx', src.length).map((c) => c.name);
    expect(names).toContain('fuelLevel');
    expect(names).toContain('useState');
  });
  test('props of a typed component inside JSX', () => {
    const src = 'function Gauge(p: { label: string; value: number }) { return null; }\nconst g = <Gauge ';
    const names = checker.completions({ '/s.tsx': src }, '/s.tsx', src.length).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['label', 'value']));
  });
});
