export type Api = (id: string) => Promise<string>;

export async function statusLine(id: string, api: Api): Promise<string> {
  const status = await api(id);
  return `${id}: ${status}`;
}

export async function allStatuses(ids: string[], api: Api): Promise<string[]> {
  return Promise.all(ids.map((id) => api(id)));
}

export async function safeStatusLine(id: string, api: Api): Promise<string> {
  try {
    return await statusLine(id, api);
  } catch {
    return `${id}: offline`;
  }
}

export async function firstHealthy(ids: string[], api: Api): Promise<string | null> {
  for (const id of ids) {
    if ((await api(id)) === "ok") {
      return id;
    }
  }
  return null;
}
