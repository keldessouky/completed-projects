// A React component is a function that returns JSX.
// Its name must start with a capital letter.

// Show a <p> with the class "status" that reads: ONLINE
export function StatusLight() {
  // TODO
}

export const STATION = 'Orrery';

// Show an <h1> that reads "Welcome to Orrery" — use the STATION constant,
// not the word typed out, so renaming the station updates the banner.
export function Banner() {
  return <h1>Welcome to STATION</h1>;
}
