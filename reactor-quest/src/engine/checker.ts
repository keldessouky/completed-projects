// The in-game TypeScript compiler. A LanguageService over a virtual file system:
// the standard library and React's types are mounted read-only, the player's
// files are swapped in on every run. Because the library files never change,
// the service keeps their parsed ASTs between runs and re-checks in milliseconds.
import ts from 'typescript';

export interface Diagnostic {
  file: string;
  line: number; // 1-based
  col: number; // 1-based
  from: number; // character offsets in the file, for editor squiggles
  to: number;
  message: string;
  code: number;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  js: Record<string, string>; // CommonJS output for each user file
}

/** What hovering a name shows: its type signature and any documentation. */
export interface QuickInfo {
  from: number;
  to: number;
  signature: string;
  doc: string;
}

export interface Completion {
  name: string;
  kind: string;
  /** Lower sorts first: locals, then members, then globals. */
  sort: string;
}

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noImplicitReturns: true,
  esModuleInterop: true,
  skipLibCheck: true,
  types: [],
  noEmit: true,
};

const EMIT_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
};

export class Checker {
  private readonly lib: Map<string, string>;
  private user = new Map<string, { text: string; version: number }>();
  private service: ts.LanguageService;

  constructor(typings: Record<string, string>) {
    this.lib = new Map(Object.entries(typings));
    const dirs = new Set<string>();
    for (const path of this.lib.keys()) {
      for (let d = path.slice(0, path.lastIndexOf('/')); d; d = d.slice(0, d.lastIndexOf('/'))) dirs.add(d);
    }
    const read = (p: string) => this.user.get(p)?.text ?? this.lib.get(p);
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => COMPILER_OPTIONS,
      getScriptFileNames: () => [...this.user.keys()],
      getScriptVersion: (p) => String(this.user.get(p)?.version ?? 0),
      getScriptSnapshot: (p) => {
        const text = read(p);
        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => '/',
      getDefaultLibFileName: () => '/lib/lib.d.ts',
      fileExists: (p) => read(p) !== undefined,
      readFile: read,
      directoryExists: (d) => d === '/' || dirs.has(d.replace(/\/$/, '')) || [...this.user.keys()].some((k) => k.startsWith(d)),
      getDirectories: () => [],
      useCaseSensitiveFileNames: () => true,
    };
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  /** Swap in the player's files, bumping versions only for files that changed. */
  private setFiles(files: Record<string, string>) {
    const next = new Map<string, { text: string; version: number }>();
    for (const [path, text] of Object.entries(files)) {
      const prev = this.user.get(path);
      next.set(path, { text, version: prev ? (prev.text === text ? prev.version : prev.version + 1) : 1 });
    }
    this.user = next;
  }

  /** Type-check `files` (paths like "/solution.tsx") and transpile each to CommonJS. */
  check(files: Record<string, string>): CheckResult {
    this.setFiles(files);

    const diagnostics: Diagnostic[] = [];
    const js: Record<string, string> = {};
    for (const path of Object.keys(files)) {
      const sf = this.service.getProgram()?.getSourceFile(path);
      const all = [...this.service.getSyntacticDiagnostics(path), ...this.service.getSemanticDiagnostics(path)];
      for (const d of all) diagnostics.push(toDiagnostic(path, d, sf));
      js[path] = ts.transpileModule(files[path], {
        compilerOptions: EMIT_OPTIONS,
        fileName: path,
        transformers: { before: [loopGuard] },
      }).outputText;
    }
    return { diagnostics, js };
  }

  /** The type of whatever is at `pos` — what an IDE shows on hover. */
  quickInfo(files: Record<string, string>, path: string, pos: number): QuickInfo | null {
    this.setFiles(files);
    const info = this.service.getQuickInfoAtPosition(path, pos);
    if (!info) return null;
    const signature = ts.displayPartsToString(info.displayParts);
    if (!signature) return null;
    return {
      from: info.textSpan.start,
      to: info.textSpan.start + info.textSpan.length,
      signature,
      doc: ts.displayPartsToString(info.documentation).split(/\n\s*\n/)[0].trim(),
    };
  }

  /** Completions at `pos`: members after a dot, otherwise everything in scope. */
  completions(files: Record<string, string>, path: string, pos: number): Completion[] {
    this.setFiles(files);
    const result = this.service.getCompletionsAtPosition(path, pos, { includeCompletionsWithInsertText: true });
    if (!result) return [];
    return result.entries
      .filter((e) => !e.name.startsWith('__'))
      .map((e) => ({ name: e.name, kind: e.kind, sort: e.sortText }));
  }
}

/** The name of the sandbox function every loop calls on each iteration. */
export const LOOP_GUARD = '__loopGuard';

/**
 * Rewrites every loop so its body starts with `__loopGuard();`. The sandbox's
 * guard throws if one synchronous run has been looping for too long, so a
 * beginner's `while (true)` stops with a message instead of freezing the tab.
 */
const loopGuard: ts.TransformerFactory<ts.SourceFile> = (context) => {
  const f = context.factory;
  const guard = () => f.createExpressionStatement(f.createCallExpression(f.createIdentifier(LOOP_GUARD), undefined, []));
  const guarded = (body: ts.Statement) => f.createBlock([guard(), ...(ts.isBlock(body) ? body.statements : [body])], true);
  const visit = (node: ts.Node): ts.Node => {
    const n = ts.visitEachChild(node, visit, context);
    if (ts.isWhileStatement(n)) return f.updateWhileStatement(n, n.expression, guarded(n.statement));
    if (ts.isDoStatement(n)) return f.updateDoStatement(n, guarded(n.statement), n.expression);
    if (ts.isForStatement(n)) return f.updateForStatement(n, n.initializer, n.condition, n.incrementor, guarded(n.statement));
    if (ts.isForOfStatement(n)) return f.updateForOfStatement(n, n.awaitModifier, n.initializer, n.expression, guarded(n.statement));
    if (ts.isForInStatement(n)) return f.updateForInStatement(n, n.initializer, n.expression, guarded(n.statement));
    return n;
  };
  return (sf) => ts.visitNode(sf, visit) as ts.SourceFile;
};

function toDiagnostic(file: string, d: ts.Diagnostic, sf: ts.SourceFile | undefined): Diagnostic {
  const start = d.start ?? 0;
  const pos = sf ? sf.getLineAndCharacterOfPosition(start) : { line: 0, character: 0 };
  return {
    file,
    line: pos.line + 1,
    col: pos.character + 1,
    from: start,
    to: start + Math.max(1, d.length ?? 1),
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    code: d.code,
  };
}
