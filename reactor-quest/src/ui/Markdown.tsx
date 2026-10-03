// A deliberately small markdown renderer for lessons and briefs: headings,
// paragraphs, lists, tables, fenced code, `inline code`, **bold**, *italic*.
// It builds React elements directly — no HTML strings, nothing to sanitize.
import type { ReactNode } from 'react';
import { Code } from './highlight';

export function Markdown({ text }: { text: string }) {
  return <div className="md">{blocks(text)}</div>;
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  const key = () => out.length;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(<Code key={key()} code={body.join('\n')} />);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(level <= 2 ? <h3 key={key()}>{inline(heading[2])}</h3> : <h4 key={key()}>{inline(heading[2])}</h4>);
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i].trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c.trim()))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div className="table-wrap" key={key()}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c.trim())}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, j) => (
                <tr key={j}>{r.map((c, n) => <td key={n}>{inline(c.trim())}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const lis = items.map((t, j) => <li key={j}>{inline(t)}</li>);
      out.push(ordered ? <ol key={key()}>{lis}</ol> : <ul key={key()}>{lis}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key()}>{inline(para.join(' '))}</p>);
  }
  return out;
}

function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  for (let i = 1; i < row.length; i++) {
    const ch = row[i];
    if (ch === '\\' && row[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '`') {
      inCode = !inCode;
      cur += ch;
    } else if (ch === '|' && !inCode) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  return cells;
}

/** Inline spans: ``code with `ticks` ``, `code`, **bold**, *italic*. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /``\s?(.+?)\s?``|`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = out.length;
    if (m[1] !== undefined || m[2] !== undefined) out.push(<code key={k}>{m[1] ?? m[2]}</code>);
    else if (m[3] !== undefined) out.push(<strong key={k}>{inline(m[3])}</strong>);
    else out.push(<em key={k}>{inline(m[4])}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
