import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Dashboard() {
  return (
    <div className="dashboard">
      <Panel title="Power">
        <p>98%</p>
      </Panel>
      <Panel title="Air">
        <p>Nominal</p>
      </Panel>
    </div>
  );
}
