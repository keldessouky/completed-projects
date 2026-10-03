// A gauge shows a label and a value with a unit:  Fuel  80%
// The unit is optional and defaults to "%".

export function Gauge(props) {
  return (
    <div className="gauge">
      <span className="label">{props.label}</span>
      <span className="value">{props.value}</span>
    </div>
  );
}
