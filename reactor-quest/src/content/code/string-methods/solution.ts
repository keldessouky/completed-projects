export function slugify(title: string): string {
  return title.trim().toLowerCase().split(" ").join("-");
}

export function initials(fullName: string): string {
  return fullName
    .split(" ")
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function bayCode(n: number): string {
  return `BAY-${String(n).padStart(3, "0")}`;
}

export function parseCoordinates(text: string): [number, number] {
  const [x, y] = text.split(",").map((part) => Number(part.trim()));
  return [x, y];
}
