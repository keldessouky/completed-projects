// Data from outside your program — a server, a file, a user — can't be trusted.
// JSON.parse returns `any`, which turns off type checking. Treat it as
// `unknown` instead, and *prove* its shape before you use it.

export type Role = "pilot" | "engineer" | "medic";
export type CrewMember = { name: string; age: number; role: Role; callsign?: string };

const ROLES: Role[] = ["pilot", "engineer", "medic"];

// Parse a crew record from JSON text. Return null unless ALL of these hold:
//   - the text is valid JSON (JSON.parse throws on invalid JSON)
//   - it's an object (not null, not an array)
//   - name is a non-empty string
//   - age is a whole number from 16 to 120   (Number.isInteger)
//   - role is one of ROLES
//   - callsign is either missing or a string
// Return a CLEAN object containing only those fields (drop anything extra).
export function parseCrew(json: string): CrewMember | null {
  const data = JSON.parse(json);
  return data;
}
