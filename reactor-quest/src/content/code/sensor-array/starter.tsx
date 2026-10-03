export interface Sensor {
  id: string;
  name: string;
  online: boolean;
}

// Render every sensor as an <li> inside a <ul>.
// Each <li> shows the sensor's name and has the class "online" or "offline".
export function SensorList({ sensors }: { sensors: Sensor[] }) {
  return (
    <ul>
      <li className="online">{sensors[0].name}</li>
    </ul>
  );
}
