// Combine yes/no answers with logical operators:
//   a && b    AND: true only if both are true
//   a || b    OR:  true if at least one is true
//   !a        NOT: flips true to false and false to true

// 1. The airlock may open only if the inner door is closed
//    AND the pressure is safe: between 90 and 110, including both.
export function canOpenAirlock(innerClosed: boolean, pressure: number): boolean {
  return innerClosed;
}

// 2. Sound the alarm if there's a fire OR oxygen is below 18.
export function shouldAlarm(fire: boolean, oxygen: number): boolean {
  return fire;
}

// 3. A crew member is off duty when they are NOT on shift.
export function isOffDuty(onShift: boolean): boolean {
  return onShift;
}
