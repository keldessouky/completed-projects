export function parseFuel(text: string): number {
  const value = Number(text);
  if (text.trim() === "" || Number.isNaN(value) || value < 0) {
    throw new Error(`Invalid fuel reading: ${text}`);
  }
  return value;
}

export function safeParseFuel(text: string): number | null {
  try {
    return parseFuel(text);
  } catch {
    return null;
  }
}

export function parseBatch(texts: string[]): { ok: number[]; failed: string[] } {
  const ok: number[] = [];
  const failed: string[] = [];
  for (const text of texts) {
    const value = safeParseFuel(text);
    if (value === null) {
      failed.push(text);
    } else {
      ok.push(value);
    }
  }
  return { ok, failed };
}
