// Types for node-runtime.mjs, so the tests can import it.
export const NODE_LINE: number;
export function fromTarGz(archive: Buffer, suffix: string): Buffer;
export function universal(slices: Buffer[]): Buffer;
export function nodeOptions(): { version?: string; arch?: string } | null;
export function bundleNode(target: 'darwin' | 'win32' | 'linux', dest: string, options?: { version?: string; arch?: string }): Promise<string>;
