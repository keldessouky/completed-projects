export interface Sensor {
  id: string;
  name: string;
  online: boolean;
}

export function SensorList({ sensors }: { sensors: Sensor[] }) {
  return (
    <ul>
      {sensors.map((s) => (
        <li key={s.id} className={s.online ? 'online' : 'offline'}>
          {s.name}
        </li>
      ))}
    </ul>
  );
}
