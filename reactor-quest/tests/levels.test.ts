// Every level is proven playable: the reference solution compiles cleanly,
// satisfies every type check and passes every behaviour check — and the
// starter code does NOT, so there is always something to do.
import { describe, expect, test } from 'vitest';
import { ALL_LEVELS } from '../src/content';
import { Checker } from '../src/engine/checker';
import { grade, type Report } from '../src/engine/grade';
import type { CodeLevel } from '../src/game/types';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);
const compile = async (files: Record<string, string>) => checker.check(files);

const failures = (r: Report) => [
  ...r.typeErrors.map((d) => `type error L${d.line}: ${d.message}`),
  ...r.typeChecks.filter((c) => !c.pass).map((c) => `type check "${c.label}": ${c.message}`),
  ...r.checks.filter((c) => !c.pass).map((c) => `check "${c.label}": ${c.message}`),
  ...(r.loadError ? [`load: ${r.loadError}`] : []),
];

const codeLevels = ALL_LEVELS.filter((l): l is CodeLevel => l.kind === 'code');

test('level ids are unique', () => {
  const ids = ALL_LEVELS.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe.each(codeLevels.map((l) => [l.id, l] as const))('%s', (_id, level) => {
  test('solution passes everything', async () => {
    const report = await grade(level, level.solution, compile);
    expect(failures(report)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  test('starter does not pass', async () => {
    const report = await grade(level, level.starter, compile);
    expect(report.passed).toBe(false);
  });

  test('has three hints and at least one check', () => {
    expect(level.hints).toHaveLength(3);
    expect(level.checks.length).toBeGreaterThan(0);
  });
});

describe.each(ALL_LEVELS.filter((l) => l.kind === 'quiz').map((l) => [l.id, l] as const))('%s', (_id, level) => {
  test('every answer is a valid option', () => {
    if (level.kind !== 'quiz') return;
    for (const q of level.questions) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
