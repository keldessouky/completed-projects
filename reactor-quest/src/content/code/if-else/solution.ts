export function coreStatus(temp: number): string {
  if (temp > 900) {
    return "OVERHEAT";
  } else if (temp > 600) {
    return "WARM";
  } else {
    return "STABLE";
  }
}

export function canLaunch(fuel: number): boolean {
  return fuel >= 20;
}
