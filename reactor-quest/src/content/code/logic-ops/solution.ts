export function canOpenAirlock(innerClosed: boolean, pressure: number): boolean {
  return innerClosed && pressure >= 90 && pressure <= 110;
}

export function shouldAlarm(fire: boolean, oxygen: number): boolean {
  return fire || oxygen < 18;
}

export function isOffDuty(onShift: boolean): boolean {
  return !onShift;
}
