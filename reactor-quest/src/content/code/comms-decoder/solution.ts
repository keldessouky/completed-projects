export type Message = { from: string; priority: number; body: string };

export function parseTransmission(raw: string): Message {
  const parts = raw.trim().split("|").map((part) => part.trim());
  if (parts.length !== 3) {
    throw new Error(`Corrupt transmission: ${raw}`);
  }
  const [from, priorityText, body] = parts;
  const priority = Number(priorityText);
  if (priorityText === "" || Number.isNaN(priority)) {
    throw new Error(`Corrupt transmission: ${raw}`);
  }
  return { from, priority, body };
}

export function decodeAll(raws: string[]): { messages: Message[]; corrupt: number } {
  const messages: Message[] = [];
  let corrupt = 0;
  for (const raw of raws) {
    try {
      messages.push(parseTransmission(raw));
    } catch {
      corrupt++;
    }
  }
  return { messages, corrupt };
}

export async function translateAll(
  messages: Message[],
  translate: (text: string) => Promise<string>,
): Promise<Message[]> {
  return Promise.all(messages.map(async (m) => ({ ...m, body: await translate(m.body) })));
}

export function makeInbox() {
  const stored: Message[] = [];
  return {
    add: (message: Message) => {
      stored.push(message);
    },
    top: (): Message | undefined => {
      let best: Message | undefined;
      for (const m of stored) {
        if (best === undefined || m.priority > best.priority) best = m;
      }
      return best;
    },
    count: () => stored.length,
  };
}

export async function processBatch(raws: string[], translate: (text: string) => Promise<string>) {
  const { messages, corrupt } = decodeAll(raws);
  const translated = await translateAll(messages, translate);
  const inbox = makeInbox();
  translated.forEach((m) => inbox.add(m));
  return { count: inbox.count(), corrupt, topFrom: inbox.top()?.from ?? "nobody" };
}
