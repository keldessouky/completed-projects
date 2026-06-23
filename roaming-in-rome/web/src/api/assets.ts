/**
 * Landmark image filenames are stored bare in the DB (e.g. "colosseum-main.jpg").
 * The images live under public/landmarks/, so resolve them to that path.
 */
export function landmarkImageUrl(filename: string): string {
  return `/landmarks/${filename}`;
}
