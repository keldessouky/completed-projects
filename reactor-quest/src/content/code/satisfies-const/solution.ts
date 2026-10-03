export type Route = { path: string; auth: boolean };

export const ROUTES = {
  home: { path: "/", auth: false },
  crew: { path: "/crew/:id", auth: true },
  reactor: { path: "/reactor", auth: true },
} as const satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

export function link(name: RouteName, id?: string): string {
  const path: string = ROUTES[name].path;
  return id === undefined ? path : path.replace(":id", id);
}

export function protectedRoutes(): RouteName[] {
  return (Object.keys(ROUTES) as RouteName[]).filter((name) => ROUTES[name].auth);
}
