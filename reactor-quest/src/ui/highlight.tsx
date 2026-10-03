import { tsxLanguage } from '@codemirror/lang-javascript';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { ReactNode } from 'react';

/** Syntax-highlight TS/TSX into React spans, using the same token classes as the editor. */
export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let k = 0;
  highlightCode(
    code,
    tsxLanguage.parser.parse(code),
    classHighlighter,
    (text, classes) => out.push(classes ? <span key={k++} className={classes}>{text}</span> : text),
    () => out.push('\n'),
  );
  return out;
}

export function Code({ code, className = '' }: { code: string; className?: string }) {
  return (
    <pre className={`code ${className}`}>
      <code>{highlight(code)}</code>
    </pre>
  );
}
