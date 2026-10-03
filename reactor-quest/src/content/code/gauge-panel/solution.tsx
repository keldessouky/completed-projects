interface GaugeProps {
  label: string;
  value: number;
  unit?: string;
}

export function Gauge({ label, value, unit = '%' }: GaugeProps) {
  return (
    <div className="gauge">
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit}
      </span>
    </div>
  );
}
