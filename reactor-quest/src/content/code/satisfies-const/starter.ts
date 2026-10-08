// Keep the route names exact AND checked. (Examples of `as const` and `satisfies` are in the Lesson tab.)

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
