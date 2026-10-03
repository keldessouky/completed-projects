// The thruster panel:
//   <p>Thrust: {thrust}</p>
//   <button>Decrease</button> <button>Increase</button>
// Thrust starts at 0 and must stay between 0 and 10.
//
// Click the buttons in the preview. Nothing changes on screen. Why?

export function Thruster() {
  let thrust = 0;

  return (
    <div className="thruster">
      <p>Thrust: {thrust}</p>
      <button onClick={() => (thrust = thrust - 1)}>Decrease</button>
      <button onClick={() => (thrust = thrust + 1)}>Increase</button>
    </div>
  );
}
