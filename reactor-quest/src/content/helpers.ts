import type { ComponentType } from 'react';
import { CheckFailure, type Module } from '../engine/runtime';
import type { CodeLevel } from '../game/types';

// Starter and solution files live beside this module in code/<level-id>/, as
// real .ts/.tsx files, so they read like code rather than escaped strings.
const files = import.meta.glob<string>('./code/*/*', { query: '?raw', import: 'default', eager: true });

export function codeFiles(id: string, ext: 'ts' | 'tsx'): Pick<CodeLevel, 'starter' | 'solution' | 'file'> {
  const starter = files[`./code/${id}/starter.${ext}`];
  const solution = files[`./code/${id}/solution.${ext}`];
  if (starter === undefined || solution === undefined) throw new Error(`Missing code files for level ${id}`);
  return { starter, solution, file: `solution.${ext}` };
}

/** An exported function from the player's module, or a clear failure if it isn't there. */
export function fnOf<T = (...args: any[]) => any>(mod: Module, name: string): T {
  const v = mod[name];
  if (typeof v !== 'function') {
    throw new CheckFailure(v === undefined ? `Nothing named "${name}" is exported. Did you write \`export\` in front of it?` : `"${name}" is exported, but it isn't a function.`);
  }
  return v as T;
}

export const comp = (mod: Module, name: string) => fnOf<ComponentType<any>>(mod, name);

/** Source text with comments stripped, for checks like "uses useState". */
export const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The nth line the player's code printed, or a clear failure if it never got that far. */
export function line(logs: string[], n: number): string {
  if (logs.length <= n) {
    throw new CheckFailure(
      logs.length === 0
        ? 'Nothing was printed. Use console.log(...) to print something.'
        : `Only ${logs.length} line${logs.length > 1 ? 's were' : ' was'} printed — expected at least ${n + 1}.`,
    );
  }
  return logs[n];
}

/** Fail with a friendly message unless the (comment-free) source matches. */
export function mustUse(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(code(source))) throw new CheckFailure(message);
}

/** Fail if the (comment-free) source contains something it shouldn't. */
export function mustNotUse(source: string, pattern: RegExp, message: string) {
  if (pattern.test(code(source))) throw new CheckFailure(message);
}

/**
 * An error a check throws on purpose (a fake server failing, say). It's tagged
 * so the test runner can tell an expected rejection that a starter forgot to
 * handle from a real bug.
 */
export function fixtureError(message: string): Error {
  return Object.assign(new Error(message), { levelFixture: true });
}

/**
 * The lesson for a "from a blank file" level: how to begin with nothing but a
 * spec, then a reminder of the floor's tools. Every floor has one, so writing
 * code from scratch is practised all the way up, not only fixing starters.
 */
export function blankPage(tools: string): string {
  return `## Starting from nothing

No starter code this time: just a spec, like real work. You've already used every tool you need. What's new is deciding where to begin. Professionals do it like this:

1. **Read the whole spec first.** List what you must export, and what each piece takes and gives back.
2. **Write the outlines.** Each function or component, with its types and a placeholder result (\`return 0;\`, \`return "";\`, \`return null;\`). Press **Run**: the checks now tell you exactly what's left.
3. **One check at a time.** Make the simplest one pass, run, then the next. Small steps, run often.
4. **Edge cases last.** Empty lists, ties, exact limits, missing values: specs hide their bugs at the edges.

Stuck? Look back at a level that used the same tool. Rebuilding it from memory is the point, so try that before the hints.

## Tools from this floor

${tools}`;
}
