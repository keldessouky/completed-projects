// Two tools for configuration objects:
//
//   as const       — freeze a value into its narrowest, readonly literal type
//   satisfies T    — check a value matches T WITHOUT widening it to T
//
//   const COLORS = { ok: "#0f0", bad: "#f00" } as const satisfies Record<string, string>;
//   type ColorName = keyof typeof COLORS;            // "ok" | "bad"
//
// With a plain annotation (: Record<string, string>) you'd lose the key names.

export type Route = { path: string; auth: boolean };

// 1. The station's routes. Keep the literal keys AND check every entry is a Route.
//    Fix the declaration so RouteName below becomes "home" | "crew" | "reactor".
export const ROUTES: Record<string, Route> = {
  home: { path: "/", auth: false },
  crew: { path: "/crew/:id", auth: true },
  reactor: { path: "/reactor", auth: true },
};

// 2. The union of route names, derived from ROUTES (don't type it out by hand).
export type RouteName = string;

// 3. Build a link. Replace ":id" in the path with the id, if given.
//      link("crew", "7") → "/crew/7"      link("home") → "/"
export function link(name: RouteName, id?: string): string {
  return "";
}

// 4. The names of routes that need authentication, in declaration order.
export function protectedRoutes(): RouteName[] {
  return [];
}
