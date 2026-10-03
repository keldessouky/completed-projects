import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ALL_LEVELS } from '../src/content';
import { Markdown } from '../src/ui/Markdown';

const html = (md: string) => renderToStaticMarkup(<Markdown text={md} />);

describe('markdown', () => {
  test('inline spans', () => {
    expect(html('a `b` **c** *d* ``e `f` g``')).toBe('<div class="md"><p>a <code>b</code> <strong>c</strong> <em>d</em> <code>e `f` g</code></p></div>');
  });
  test('tables honour escaped pipes', () => {
    expect(html('| a | b |\n|---|---|\n| `x \\| y` | z |')).toContain('<td><code>x | y</code></td>');
  });
  test('HTML in the source is text, never markup', () => {
    expect(html('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });
  test('every lesson, brief and hint renders without leftover markers', () => {
    for (const l of ALL_LEVELS) {
      const texts = [l.brief, l.lesson, ...(l.kind === 'code' ? l.hints : [])];
      for (const t of texts) {
        const out = html(t).replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '');
        expect(out, `${l.id}: stray markdown in ${t.slice(0, 40)}…`).not.toMatch(/\*\*|```|`/);
      }
    }
  });
});
