// The test kit the levels are graded with must itself be trustworthy.
import { createElement as h, useState } from 'react';
import { describe, expect, test } from 'vitest';
import { CheckFailure, Sandbox, Stage, deepEqual, expect as kitExpect, loadModule, wait } from '../src/engine/runtime';

describe('expect', () => {
  test('passing and failing matchers', () => {
    kitExpect(2).toBe(2);
    kitExpect({ a: [1, { b: 2 }] }).toEqual({ a: [1, { b: 2 }] });
    kitExpect('hello').not.toContain('z');
    expect(() => kitExpect(1).toBe(2)).toThrow(CheckFailure);
    expect(() => kitExpect('x').not.toBe('x')).toThrow(/not to be/);
  });
  test('deepEqual ignores undefined-valued keys but not missing ones', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });
});

describe('sandbox', () => {
  test('captures console output and counts live timers', async () => {
    const lines: string[] = [];
    const sb = new Sandbox((l) => lines.push(l));
    const mod = loadModule('console.log("hi", 1 + 1); exports.start = () => setInterval(() => {}, 10);', sb);
    expect(lines).toEqual(['hi 2']);
    mod.start();
    mod.start();
    expect(sb.activeTimers).toBe(2);
    sb.clearAll();
    expect(sb.activeTimers).toBe(0);
  });
  test('only react can be required', () => {
    expect(() => loadModule('require("fs")')).toThrow(/only 'react'/);
  });
  test('one-shot timeouts stop counting once they fire', async () => {
    const sb = new Sandbox();
    loadModule('setTimeout(() => {}, 5);', sb);
    expect(sb.activeTimers).toBe(1);
    await wait(30);
    expect(sb.activeTimers).toBe(0);
  });
});

describe('stage', () => {
  test('renders, clicks and reads state updates', async () => {
    function Counter() {
      const [n, setN] = useState(0);
      return h('button', { onClick: () => setN(n + 1) }, `n=${n}`);
    }
    const stage = new Stage();
    const view = await stage.render(h(Counter));
    await view.click('button');
    expect(view.text()).toBe('n=1');
    stage.cleanup();
  });
  test('errors thrown in event handlers fail the check', async () => {
    const stage = new Stage();
    const view = await stage.render(h('button', { onClick: () => { throw new Error('boom'); } }, 'x'));
    await expect(view.click('button')).rejects.toThrow('boom');
    stage.cleanup();
  });
  test('a form that would reload the page fails the check', async () => {
    const stage = new Stage();
    const view = await stage.render(h('form', { onSubmit: () => {} }, h('button', { type: 'submit' }, 'Go')));
    await expect(view.submit()).rejects.toThrow(/preventDefault/);
    stage.cleanup();
  });
  test('render errors surface', async () => {
    const Broken = () => {
      throw new Error('kaput');
    };
    const stage = new Stage();
    await expect(stage.render(h(Broken))).rejects.toThrow('kaput');
    stage.cleanup();
  });
});
