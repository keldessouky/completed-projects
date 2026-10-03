export type Role = "pilot" | "engineer" | "medic";
export type CrewMember = { name: string; age: number; role: Role; callsign?: string };

const ROLES: Role[] = ["pilot", "engineer", "medic"];

function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLES as string[]).includes(x);
}

export function parseCrew(json: string): CrewMember | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { name, age, role, callsign } = data as Record<string, unknown>;
  if (typeof name !== "string" || name === "") return null;
  if (typeof age !== "number" || !Number.isInteger(age) || age < 16 || age > 120) return null;
  if (!isRole(role)) return null;
  if (callsign !== undefined && typeof callsign !== "string") return null;
  return callsign === undefined ? { name, age, role } : { name, age, role, callsign };
}
