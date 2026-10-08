export class Logbook {
  private entries: string[] = [];

  add(text: string): number {
    const entry = text.trim();
    if (!entry) throw new Error("Entry can't be empty");
    this.entries.push(entry);
    return this.entries.length;
  }

  latest(n: number): string[] {
    return this.entries.slice(Math.max(0, this.entries.length - n)).reverse();
  }

  search(word: string): string[] {
    const needle = word.toLowerCase();
    return this.entries.filter((e) => e.toLowerCase().includes(needle));
  }
}
